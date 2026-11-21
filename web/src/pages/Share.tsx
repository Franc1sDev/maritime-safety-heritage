import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, get, newKey, post } from '../lib/api';
import { useApp } from '../lib/app';
import { store } from '../lib/offline';
import { canBlurFaces, compressImage, uploadFile } from '../lib/upload';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { MediaItem } from '../components/Media';
import type { Story } from '../components/Story';
import { Celebrate, Dialog, Spinner } from '../components/ui';
import { Combo } from './Stories';

type Kind = 'video' | 'audio' | 'document' | 'image';
interface Slot { key: string; name: string; kind: Kind; pct: number; step: 'compressing' | 'uploading' | 'done' | 'failed'; error?: string; media?: MediaItem; preview?: string; cancel?: () => void; pause?: () => void; resume?: () => void; paused?: boolean }
interface Form {
  title: string; text: string; language: string; placeId: number | null; placeName: string; latitude: number | null; longitude: number | null; eventDate: string; dateApproximate: boolean; year: string;
  category: string; vessel: string; tags: string; incidentId: string | null; incidentTitle: string; suggestTitle: string; suggestDetails: string; postedAs: 'self' | 'told_by' | 'anonymous' | 'company'; toldBy: string;
  consentConfirmed: boolean; rights: string; allowDownload: boolean; sensitive: boolean; type: 'community' | 'testimony' | 'record';
  source: { institution: string; reference: string; originalDate: string; creator: string; rightsStatement: string; obtained: string }; consent: { storyteller: string; consentType: string; consentDate: string; validated: boolean };
}
const blank = (language: string): Form => ({ title: '', text: '', language, placeId: null, placeName: '', latitude: null, longitude: null, eventDate: '', dateApproximate: false, year: '', category: '', vessel: '', tags: '', incidentId: null, incidentTitle: '',
  suggestTitle: '', suggestDetails: '', postedAs: 'self', toldBy: '', consentConfirmed: false, rights: 'All rights reserved', allowDownload: true, sensitive: false, type: 'community',
  source: { institution: '', reference: '', originalDate: '', creator: '', rightsStatement: '', obtained: '' }, consent: { storyteller: '', consentType: 'written', consentDate: '', validated: false } });
const kindOf = (f: File): Kind | null => (f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('image/') ? 'image' : /pdf|msword|officedocument|opendocument|text\/plain|rtf/.test(f.type) || /\.(pdf|docx?|odt|txt|rtf)$/i.test(f.name) ? 'document' : null);

/** The share-story frame. It replaces the story frame; the close button returns to the stories. */
export default function ShareStory({ editId, onClose, company }: { editId: string | null; onClose: () => void; company?: boolean }) {
  const { t, i18n } = useTranslation();
  const { me, config, toast, online, socket } = useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isAdmin = me?.role === 'admin';
  const [f, setF] = useState<Form>(() => ({ ...blank(i18n.language), postedAs: company ? 'company' : 'self' }));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [draftId, setDraftId] = useState<string | null>(editId);
  const [wasPublished, setWasPublished] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const [review, setReview] = useState<null | { id: string; done: boolean; flag: string | null; message: string; explanation: any; status: string; started: number }>(null);
  const [pin, setPin] = useState(false);
  const [blur, setBlur] = useState(false);
  const [rec, setRec] = useState<null | { kind: 'audio' | 'video'; seconds: number }>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<null | Array<{ id: string; name: string; text: string }>>(null);
  const [why, setWhy] = useState(false);
  const recorder = useRef<{ mr: MediaRecorder; chunks: Blob[]; stream: MediaStream; timer: number } | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const key = useRef(newKey());
  const lim = config?.limits ?? { videoMb: 200, videoMinutes: 5, audioMb: 100, imageMb: 25, documentMb: 25, images: 20, documents: 4 };
  const max: Record<Kind, number> = { video: 1, audio: 1, document: lim.documents, image: lim.images };
  const maxMb: Record<Kind, number> = { video: lim.videoMb, audio: lim.audioMb, document: lim.documentMb, image: lim.imageMb };
  const count = (k: Kind) => slots.filter((s) => s.kind === k && s.step !== 'failed').length;
  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }));

  // Editing: load the story. New: restore the draft kept on this device.
  useEffect(() => {
    void (async () => {
      if (editId) {
        try {
          const s = await get<Story>(`/stories/${editId}`);
          setWasPublished(s.status !== 'draft');
          setF({ ...blank(s.language), title: s.title, text: s.text, language: s.language, placeId: s.place.id, placeName: s.place.name, latitude: s.place.latitude, longitude: s.place.longitude, eventDate: s.dateApproximate ? '' : s.eventDate ?? '', dateApproximate: s.dateApproximate,
            year: s.dateApproximate && s.eventDate ? s.eventDate.slice(0, 4) : '', category: s.category, vessel: s.vessel, tags: s.tags.join(', '), incidentId: s.incident?.id ?? null, incidentTitle: s.incident?.title ?? '', postedAs: s.postedAs as Form['postedAs'], toldBy: s.toldBy,
            consentConfirmed: s.postedAs === 'told_by', rights: s.rights, allowDownload: s.allowDownload, sensitive: s.sensitive, type: s.type as Form['type'], source: { ...blank('en').source, ...(s.source ?? {}) } as Form['source'] });
          setSlots(s.media.map((m) => ({ key: m.id, name: m.name, kind: m.kind, pct: 100, step: 'done', media: m, preview: m.urls.thumb })));
        } catch (e: any) { toast(e.message, 'error'); onClose(); }
      } else {
        const d = await store.get<{ id: string; form: Form }>('drafts', 'new');
        if (d?.form && (d.form.text || d.form.title)) { setF({ ...blank(i18n.language), ...d.form }); toast(t('Your unfinished story was restored.'), 'info'); }
      }
    })();
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps
  // The text is kept on the device as it is typed, so nothing is lost if the connection or the browser drops.
  useEffect(() => { if (editId || review) return; const h = setTimeout(() => { if (f.text || f.title) void store.put('drafts', { id: 'new', form: f, at: Date.now() }); }, 700); return () => clearTimeout(h); }, [f, editId, review]);
  useEffect(() => () => { recorder.current?.stream.getTracks().forEach((x) => x.stop()); }, []);

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const errs: string[] = [];
    const taken: Record<Kind, number> = { video: count('video'), audio: count('audio'), document: count('document'), image: count('image') };
    for (const file of Array.from(list)) {
      const kind = kindOf(file);
      if (!kind) { errs.push(t('“{name}”: this file type is not supported.', { name: file.name })); continue; }
      if (taken[kind] >= max[kind]) { errs.push(kind === 'image' ? t('You can add up to {n} images.', { n: max.image }) : kind === 'document' ? t('You can add up to {n} documents.', { n: max.document }) : kind === 'video' ? t('A story can have one video.') : t('A story can have one audio file.')); continue; }
      if (file.size > maxMb[kind] * 1048576) { errs.push(`“${file.name}”: ${t('This file is too large. The maximum for {kind} is {max} MB.', { kind: t(kind === 'video' ? 'a video' : kind === 'audio' ? 'an audio file' : kind === 'image' ? 'an image' : 'a document'), max: maxMb[kind] })}`); continue; }
      taken[kind]++;
      const k = newKey();
      const slot: Slot = { key: k, name: file.name, kind, pct: 0, step: kind === 'image' ? 'compressing' : 'uploading', preview: kind === 'image' ? URL.createObjectURL(file) : undefined };
      setSlots((s) => [...s, slot]);
      const upd = (p: Partial<Slot>) => setSlots((s) => s.map((x) => (x.key === k ? { ...x, ...p } : x)));
      void (async () => {
        try {
          const ready = kind === 'image' ? await compressImage(file, (pct) => upd({ pct: Math.round(pct / 4) }), blur) : file;
          upd({ step: 'uploading' });
          const h = uploadFile(ready, 'story', (pct) => upd({ pct: kind === 'image' ? 25 + Math.round(pct * 0.75) : pct }));
          upd({ cancel: h.cancel, pause: h.pause, resume: h.resume });
          const media = await h.promise;
          upd({ step: 'done', pct: 100, media, cancel: undefined, pause: undefined, resume: undefined, paused: false });
        } catch (e: any) { if (e?.name !== 'AbortError') upd({ step: 'failed', error: e.message }); }
      })();
    }
    setErrors(errs);
  }
  const removeSlot = (s: Slot) => { s.cancel?.(); if (s.media && !draftId) void api(`/media/${s.media.id}`, { method: 'DELETE' }).catch(() => undefined); setSlots((all) => all.filter((x) => x.key !== s.key)); };

  // Recording in the frame (voice-first sharing): the recording becomes the story's audio or video and is transcribed.
  async function startRecording(kind: 'audio' | 'video') {
    if (count(kind) >= 1) return setErrors([kind === 'video' ? t('A story can have one video.') : t('A story can have one audio file.')]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 } } } : { audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        const type = mr.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm');
        const ext = type.includes('mp4') ? (kind === 'video' ? 'mp4' : 'm4a') : type.includes('ogg') ? 'ogg' : 'webm';
        void addFiles([new File(chunks, `${kind === 'video' ? 'video' : 'voice'}-recording-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`, { type: type.split(';')[0] })]);
        setRec(null); recorder.current = null;
      };
      const timer = window.setInterval(() => setRec((r) => { if (!r) return r; if (r.seconds + 1 >= lim.videoMinutes * 60 && kind === 'video') mr.stop(); return { ...r, seconds: r.seconds + 1 }; }), 1000);
      recorder.current = { mr, chunks, stream, timer };
      mr.start(1000); setRec({ kind, seconds: 0 });
      setTimeout(() => { if (kind === 'video' && preview.current) { preview.current.srcObject = stream; void preview.current.play().catch(() => undefined); } }, 50);
    } catch { toast(t('We could not use the microphone or camera. Check the permission in your browser.'), 'error'); }
  }
  const stopRecording = () => { if (recorder.current) { clearInterval(recorder.current.timer); recorder.current.mr.stop(); } };

  const payload = (draft: boolean) => {
    const eventDate = f.dateApproximate ? (/^\d{4}$/.test(f.year) ? `${f.year}-01-01` : null) : f.eventDate || null;
    const b: Record<string, any> = {
      title: f.title.trim(), text: f.text, language: f.language, mediaIds: slots.filter((s) => s.media).map((s) => s.media!.id), placeId: f.placeId, placeName: f.placeName.trim(), latitude: f.latitude, longitude: f.longitude,
      eventDate, dateApproximate: f.dateApproximate, category: f.category, vessel: f.vessel.trim(), tags: f.tags.split(/[,#\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 10), incidentId: f.incidentId,
      postedAs: f.postedAs, toldBy: f.postedAs === 'told_by' ? f.toldBy.trim() : '', consentConfirmed: f.postedAs === 'told_by' ? f.consentConfirmed : undefined, rights: f.rights, allowDownload: f.allowDownload, sensitive: f.sensitive, draft,
    };
    const consentForm = slots.find((s) => s.kind === 'document' && (s as any).consentForm);
    if (consentForm?.media) { b.consentFormMediaId = consentForm.media.id; b.mediaIds = b.mediaIds.filter((x: string) => x !== consentForm.media!.id); }
    if (!f.incidentId && f.suggestTitle.trim().length >= 3) b.suggestIncident = { title: f.suggestTitle.trim(), details: f.suggestDetails.trim() || undefined };
    if (isAdmin) { b.type = f.type; if (f.type === 'record') b.source = f.source; if (f.type === 'testimony') b.consent = { ...f.consent, consentDate: f.consent.consentDate || undefined }; }
    return b;
  };
  const uploading = slots.some((s) => s.step === 'compressing' || s.step === 'uploading');

  async function save(draft: boolean): Promise<Story | null> {
    const errs: string[] = [];
    if (!draft) {
      if (!f.text.trim() && !slots.some((s) => s.media)) errs.push(t('Add text or at least one file before sending.'));
      if (f.postedAs === 'told_by' && (!f.toldBy.trim() || !f.consentConfirmed)) errs.push(t('Confirm that the person whose story this is has agreed to it being shared.'));
    }
    if (uploading) errs.push(t('Wait for the files to finish uploading.'));
    setErrors(errs);
    if (errs.length) return null;
    if (!online) {
      await store.put('drafts', { id: 'new', form: f, at: Date.now(), waiting: !draft });
      toast(draft ? t('You are offline. Your draft is saved on this device.') : `${t('You are offline. Your story will be sent when you are back online.')} ${t('It is waiting in My Profile › Drafts.')}`, 'info');
      return null;
    }
    setBusy(draft ? 'draft' : 'send');
    try {
      let s: Story & { message?: string };
      if (draftId) {
        s = await api(`/stories/${draftId}`, { method: 'PATCH', body: payload(draft || !wasPublished) });
        if (!draft && !wasPublished) s = await post(`/stories/${draftId}/submit`);
      } else s = await post('/stories', payload(draft), key.current);
      setDraftId(s.id);
      void store.del('drafts', 'new');
      void qc.invalidateQueries({ queryKey: ['my-stories'] });
      if (draft) { toast(s.message ?? t('Draft saved.')); return s; }
      if (s.status === 'reviewing' || (wasPublished && s.moderation?.pendingEdit)) setReview({ id: s.id, done: false, flag: null, message: s.message ?? t('Checking your story… This takes up to 3 minutes.'), explanation: null, status: s.status, started: Date.now() });
      else setReview({ id: s.id, done: true, flag: s.moderation?.aiFlag ?? null, message: s.message ?? t('Submitted for approval.'), explanation: s.moderation?.aiExplanation, status: s.status, started: Date.now() });
      return s;
    } catch (e: any) { setErrors([e.details?.reason ? `${e.message} ${e.details.reason}` : e.message]); return null; } finally { setBusy(''); }
  }
  // Review progress: checked every few seconds and pushed live when it finishes.
  useEffect(() => {
    if (!review || review.done) return;
    let live = true;
    const check = async () => { try { const r = await get(`/stories/${review.id}/review`); if (live) setReview((cur) => (cur ? { ...cur, ...r } : cur)); } catch { /* try again */ } };
    const h = setInterval(check, 3000);
    socket?.on('story.review', check);
    return () => { live = false; clearInterval(h); socket?.off('story.review', check); };
  }, [review?.id, review?.done, socket]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (review?.done) { void qc.invalidateQueries({ queryKey: ['stories'] }); void qc.invalidateQueries({ queryKey: ['my-stories'] }); } }, [review?.done, qc]);

  async function suggest() {
    if (f.text.trim().length < 40) return toast(t('Write a little more first, then ask for suggestions.'), 'info');
    try {
      const [r, m] = await Promise.all([post('/stories/suggest', { text: f.text }), post('/incidents/match', { text: f.text, eventDate: f.eventDate || undefined, vessel: f.vessel || undefined })]);
      set({ category: f.category || r.category || '', tags: f.tags || (r.tags ?? []).join(', '), language: r.language || f.language });
      setMatches(m ?? []);
      toast(r.category || r.tags?.length || m?.length ? t('Suggestions added. Please check them.') : t('No suggestions this time.'), 'info');
    } catch (e: any) { toast(e.message, 'error'); }
  }
  async function checkTranscripts() {
    const s = await save(true);
    if (!s) return;
    setTranscripts([]);
    for (let i = 0; i < 30; i++) {
      const cur = await get<Story>(`/stories/${s.id}`);
      const av = cur.media.filter((m) => m.kind === 'audio' || m.kind === 'video');
      if (!av.length) { setTranscripts(null); return toast(t('Add or record audio or video first.'), 'info'); }
      if (av.every((m) => m.transcript !== null || m.processing === 'failed' || m.processing === 'done')) { setTranscripts(av.map((m) => ({ id: m.id, name: m.name, text: m.transcript ?? '' }))); return; }
      await new Promise((r) => setTimeout(r, 3000));
    }
    setTranscripts(null); toast(t('The transcript is still being prepared. You can check it later from My Stories.'), 'info');
  }

  const group = (kind: Kind, icon: string, label: string, accept: string) => (
    <div className="slot" key={kind}>
      <span><Icon name={icon} size={18} /> {label} <span className="counter">{count(kind)} / {max[kind]}</span></span>
      <label className={`btn small ${count(kind) >= max[kind] ? 'disabled' : ''}`}><Icon name="plus" size={15} />{t('Add')}<input type="file" hidden accept={accept} multiple={max[kind] > 1} disabled={count(kind) >= max[kind]} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} /></label>
    </div>
  );

  if (review) {
    const pct = Math.min(96, Math.round(((Date.now() - review.started) / 180_000) * 100) + 8);
    return (
      <div className="frame" aria-live="polite">
        <Celebrate on={review.done && review.flag === 'GREEN' && review.status === 'published'} />
        <div className="empty">
          {!review.done ? (
            <><Spinner /><p><b>{review.message}</b></p><div className="progress busy" style={{ maxWidth: 320, margin: '0 auto' }}><i style={{ width: `${pct}%` }} /></div><p className="small dim">{t('You can leave this page. We will tell you when it is done.')}</p></>
          ) : (
            <>
              {review.flag && <p><span className={`flag ${review.flag}`}>{review.flag}</span></p>}
              <h2>{review.message}</h2>
              {review.flag === 'YELLOW' && <div className="note warn" style={{ textAlign: 'start' }}><b>{t('Please avoid this next time')}:</b> {review.explanation?.summary}</div>}
              {review.flag === 'RED' && (
                <div className="note bad" style={{ textAlign: 'start' }}>
                  <p><b>{t('Why it was blocked')}:</b> {review.explanation?.summary}</p>
                  <ul>{(review.explanation?.guidelines ?? []).filter((g: any) => g.score >= 20).map((g: any) => <li key={g.key}><b>{t(g.key)}</b>: {g.explanation}</li>)}</ul>
                  <p>{t('Your story is now waiting for an admin to review it. You will be told the outcome.')}</p>
                  <button className="btn" onClick={() => setWhy(true)}>{t('Ask Why')}</button>
                </div>
              )}
              {!review.flag && review.status !== 'published' && <p>{t('Your story is waiting for the team. You will be told the outcome.')}</p>}
            </>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            {review.done && review.status === 'published' && <button className="btn primary" onClick={() => { onClose(); nav('/profile/stories'); }}>{t('See my story')}</button>}
            <button className="btn" onClick={onClose}>{t('Back to the stories')}</button>
          </div>
        </div>
        {why && <AskWhy storyId={review.id} onClose={() => setWhy(false)} />}
      </div>
    );
  }

  return (
    <div className="frame share" role="form" aria-label={t('Share my story')}>
      <div className="row between"><h2 style={{ margin: 0 }}>{editId ? t('Edit my story') : isAdmin && f.postedAs === 'company' ? t('Add a company story') : t('Share my story')}</h2><button className="xbtn" onClick={onClose} aria-label={t('Close and return to the stories')}><Icon name="close" size={18} /></button></div>
      {wasPublished && <p className="note small">{t('Changes to a published story are checked before they show.')}</p>}

      {isAdmin && (
        <div className="grid2">
          <label className="field"><span>{t('Kind of item')}</span><select value={f.type} onChange={(e) => set({ type: e.target.value as Form['type'] })}><option value="community">{t('Community story')}</option><option value="testimony">{t('Testimony collected by the project')}</option><option value="record">{t('Historical record')}</option></select></label>
          <label className="field"><span>{t('Publish as')}</span><select value={f.postedAs} onChange={(e) => set({ postedAs: e.target.value as Form['postedAs'] })}><option value="self">{me?.name}</option><option value="company">{t('Admin (company story, needs approval)')}</option><option value="told_by">{t('As told by another person')}</option></select></label>
        </div>
      )}
      <label className="field"><span>{t('Title (optional)')}</span><input type="text" value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} /></label>
      <label className="field"><span>{t('Your story (optional if you add a recording or files)')}</span><textarea rows={7} value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder={t('What happened? Where? What did you learn?')} lang={f.language} /></label>
      <div className="row"><span className="counter">{t('{n} characters', { n: f.text.length })}</span><button type="button" className="linkbtn small" onClick={suggest}>{t('Suggest category and tags')}</button></div>

      <h3>{t('Tell it by voice or add files')}</h3>
      {rec ? (
        <div className="note" role="status">
          {rec.kind === 'video' && <video ref={preview} muted playsInline style={{ width: '100%', borderRadius: 10, maxHeight: 220, background: '#000' }} />}
          <p><span className="dot red" /> {rec.kind === 'video' ? t('Recording video') : t('Recording')} · {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, '0')}</p>
          <button className="btn primary" onClick={stopRecording}>{t('Stop and keep')}</button>
        </div>
      ) : typeof MediaRecorder !== 'undefined' && navigator.mediaDevices && (
        <div className="row"><button type="button" className="btn small" onClick={() => startRecording('audio')}><Icon name="mic" size={17} />{t('Record audio')}</button><button type="button" className="btn small" onClick={() => startRecording('video')}><Icon name="video" size={17} />{t('Record video')}</button>
          {slots.some((s) => s.media && (s.kind === 'audio' || s.kind === 'video')) && <button type="button" className="btn small quiet" onClick={checkTranscripts}>{t('Check the transcript')}</button>}</div>
      )}
      <div className="stack" style={{ marginTop: '.6rem' }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}>
        {group('video', 'video', t('Video'), 'video/*')}
        {group('audio', 'audio', t('Audio'), 'audio/*')}
        {group('document', 'document', t('Documents'), '.pdf,.doc,.docx,.odt,.txt,.rtf')}
        {group('image', 'image', t('Images'), 'image/jpeg,image/png,image/webp,image/heic,image/heif')}
      </div>
      {canBlurFaces() && <label className="check"><input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /><span>{t('Blur faces in the photos I add next')}</span></label>}
      <p className="hint" style={{ textAlign: 'start' }}>{t('Hidden location data is removed from photos automatically. Limits: video {v} MB and {m} minutes, audio {a} MB, images and documents {i} MB each.', { v: lim.videoMb, m: lim.videoMinutes, a: lim.audioMb, i: lim.imageMb })}</p>
      {slots.length > 0 && (
        <ul className="list">{slots.map((s) => (
          <li key={s.key} className="row" style={{ flexWrap: 'nowrap' }}>
            <span className="thumb">{s.preview ? <img src={s.preview} alt="" /> : <Icon name={s.kind} size={22} />}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="small" style={{ overflowWrap: 'anywhere' }}>{s.name}</span>
              {s.step === 'failed' ? <span className="error-text small" role="alert"> {s.error}</span> : s.step !== 'done' ? <><div className="progress"><i style={{ width: `${s.pct}%` }} /></div><span className="counter">{s.step === 'compressing' ? t('Compressing…') : s.paused ? t('Paused') : t('Uploading…')} {s.pct}%</span></> : <span className="counter"> <Icon name="check" size={13} /> {t('Ready')}</span>}
              {s.kind === 'document' && f.postedAs === 'told_by' && s.step === 'done' && <label className="check small"><input type="checkbox" checked={!!(s as any).consentForm} onChange={(e) => setSlots((all) => all.map((x) => ({ ...x, consentForm: x.key === s.key ? e.target.checked : false } as Slot)))} /><span>{t('This is the signed consent form (kept private)')}</span></label>}
            </span>
            {s.step === 'uploading' && s.pause && <button className="chip" onClick={() => { if (s.paused) s.resume?.(); else s.pause?.(); setSlots((all) => all.map((x) => (x.key === s.key ? { ...x, paused: !s.paused } : x))); }}>{s.paused ? t('Resume') : t('Pause')}</button>}
            <button className="xbtn" onClick={() => removeSlot(s)} aria-label={t('Remove {name}', { name: s.name })}><Icon name="close" size={15} /></button>
          </li>
        ))}</ul>
      )}

      <h3>{t('Story details')}</h3>
      <div className="grid2">
        <div className="field"><span>{t('Where it happened')}</span>
          <Combo<any> label={t('Where it happened')} placeholder={t('Type a place')} none={t('No match in the places list. Keep typing to use your own wording, or put a pin on the map.')} value={f.placeName}
            load={async (q) => { set({ placeName: q, placeId: null }); return get('/places', { q }); }} render={(p) => <><Icon name="pin" size={17} /><span>{p.name} <span className="dim small">{[p.county, p.waterBody].filter(Boolean).join(' · ')}</span></span></>}
            onPick={(p) => set({ placeId: p.id, placeName: p.name, latitude: p.latitude, longitude: p.longitude })} />
          <button type="button" className="linkbtn small" onClick={() => setPin(!pin)}>{pin ? t('Hide the map') : f.latitude != null ? t('Move the pin on the map') : t('Put a pin on the map')}</button>
        </div>
        <div className="field"><span>{t('When it happened')}</span>
          {f.dateApproximate ? <input type="number" inputMode="numeric" placeholder={t('Year, for example 1994')} min={1800} max={new Date().getFullYear()} value={f.year} onChange={(e) => set({ year: e.target.value })} aria-label={t('Approximate year')} />
            : <input type="date" value={f.eventDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ eventDate: e.target.value })} aria-label={t('Date')} />}
          <label className="check small"><input type="checkbox" checked={f.dateApproximate} onChange={(e) => set({ dateApproximate: e.target.checked })} /><span>{t('I only know roughly when')}</span></label>
        </div>
      </div>
      {pin && <div style={{ height: 300, display: 'flex', marginBottom: '.6rem' }}><MapView markers={[]} picked={f.latitude != null && f.longitude != null ? [f.latitude, f.longitude] : null} center={f.latitude != null ? [f.latitude, f.longitude!] : undefined} onPick={(lat, lng) => set({ latitude: Number(lat.toFixed(5)), longitude: Number(lng.toFixed(5)), placeId: null })} /></div>}
      <div className="grid2">
        <label className="field"><span>{t('Category')}</span><select value={f.category} onChange={(e) => set({ category: e.target.value })}><option value="">{t('Choose…')}</option>{config?.categories.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></label>
        <label className="field"><span>{t('Vessel name')}</span><input type="text" value={f.vessel} maxLength={120} onChange={(e) => set({ vessel: e.target.value })} /></label>
        <label className="field"><span>{t('Tags (separate with commas)')}</span><input type="text" value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder={t('ferry, life jackets')} /></label>
        <label className="field"><span>{t('Language of the story')}</span><select value={f.language} onChange={(e) => set({ language: e.target.value })}>{config?.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
      </div>

      <div className="field"><span>{t('Linked incident (optional)')}</span>
        {f.incidentId ? <p className="note small">{f.incidentTitle} <button className="linkbtn" onClick={() => set({ incidentId: null, incidentTitle: '' })}>{t('Remove')}</button></p> : (
          <Combo<any> label={t('Linked incident')} placeholder={t('Search incidents, for example Mtongwe 1994')} none={t('No incident record matches. You can suggest a new one below.')}
            load={(q) => get('/incidents', { q })} render={(i) => <><Icon name="incident" size={17} /><span>{i.title} <span className="dim small">{i.eventDate?.slice(0, 4)}</span></span></>} onPick={(i) => set({ incidentId: i.id, incidentTitle: i.title, suggestTitle: '' })} />
        )}
        {!f.incidentId && matches.length > 0 && <p className="small">{t('Is this about')} {matches.map((m) => <button key={m.id} className="chip" style={{ marginInlineEnd: 4 }} onClick={() => set({ incidentId: m.id, incidentTitle: m.title })}>{m.title}{m.eventDate ? `, ${m.eventDate.slice(0, 4)}` : ''}</button>)}?</p>}
        {!f.incidentId && <details className="small"><summary>{t('Suggest a new incident for the admins to add')}</summary>
          <label className="field"><span>{t('Name of the incident')}</span><input type="text" value={f.suggestTitle} maxLength={200} onChange={(e) => set({ suggestTitle: e.target.value })} /></label>
          <label className="field"><span>{t('What you know about it')}</span><textarea rows={2} value={f.suggestDetails} maxLength={2000} onChange={(e) => set({ suggestDetails: e.target.value })} /></label></details>}
      </div>

      {isAdmin && f.type === 'record' && (
        <fieldset className="card"><legend><b>{t('Source of this historical record')}</b></legend>
          <div className="grid2">{([['institution', 'Institution or archive'], ['reference', 'Archive reference'], ['originalDate', 'Original date'], ['creator', 'Creator or publisher'], ['rightsStatement', 'Rights statement'], ['obtained', 'How it was obtained']] as const).map(([k, label]) =>
            <label className="field" key={k}><span>{t(label)}</span><input type="text" value={f.source[k]} onChange={(e) => set({ source: { ...f.source, [k]: e.target.value } })} /></label>)}</div>
        </fieldset>
      )}
      {isAdmin && f.type === 'testimony' && (
        <fieldset className="card"><legend><b>{t('Consent record')}</b></legend>
          <div className="grid2">
            <label className="field"><span>{t('Storyteller')}</span><input type="text" value={f.consent.storyteller} onChange={(e) => set({ consent: { ...f.consent, storyteller: e.target.value } })} /></label>
            <label className="field"><span>{t('Type of consent')}</span><select value={f.consent.consentType} onChange={(e) => set({ consent: { ...f.consent, consentType: e.target.value } })}><option value="written">{t('Written')}</option><option value="recorded">{t('Recorded')}</option><option value="guardian">{t('Parent or guardian')}</option></select></label>
            <label className="field"><span>{t('Date of consent')}</span><input type="date" value={f.consent.consentDate} onChange={(e) => set({ consent: { ...f.consent, consentDate: e.target.value } })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.consent.validated} onChange={(e) => set({ consent: { ...f.consent, validated: e.target.checked } })} /><span>{t('The storyteller has confirmed how their contribution is represented')}</span></label>
          <p className="small dim">{t('A testimony is published only when its consent record is complete and it has been validated with the storyteller.')}</p>
        </fieldset>
      )}

      <h3>{t('Posting options')}</h3>
      {!isAdmin && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="label">{t('Post as')}</legend>
          {([['self', t('Myself ({name})', { name: me?.username ? `@${me.username}` : me?.name })], ['told_by', t('As told by another person')], ['anonymous', t('Anonymously')]] as const).map(([k, label]) =>
            <label key={k} className="check"><input type="radio" name="as" checked={f.postedAs === k} onChange={() => set({ postedAs: k })} /><span>{label}</span></label>)}
        </fieldset>
      )}
      {f.postedAs === 'told_by' && (
        <div className="note">
          <label className="field"><span>{t('Whose story is this?')}</span><input type="text" value={f.toldBy} maxLength={120} onChange={(e) => set({ toldBy: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={f.consentConfirmed} onChange={(e) => set({ consentConfirmed: e.target.checked })} /><span>{t('I confirm this person has agreed to their story being shared here. (For anyone under 18, a parent or guardian has agreed.)')}</span></label>
          <p className="small dim">{t('You can add a signed consent form as a document above and mark it as the consent form.')}</p>
        </div>
      )}
      {f.postedAs === 'anonymous' && <p className="note small">{t('Your name and picture will not be shown with this story. The admins can still see who posted it.')}</p>}
      <div className="grid2">
        <label className="field"><span>{t('Usage rights')}</span><select value={f.rights} onChange={(e) => set({ rights: e.target.value })}>{(config?.rights ?? ['All rights reserved']).map((r) => <option key={r}>{r}</option>)}</select></label>
        <div className="field"><span>{t('Options')}</span>
          <label className="check"><input type="checkbox" checked={f.allowDownload} onChange={(e) => set({ allowDownload: e.target.checked })} /><span>{t('Allow others to download this story')}</span></label>
          <label className="check"><input type="checkbox" checked={f.sensitive} onChange={(e) => set({ sensitive: e.target.checked })} /><span>{t('This story describes loss of life or may be distressing')}</span></label>
        </div>
      </div>
      {!online && <p className="note warn small">{t('You are offline. Your story will be sent when you are back online.')}</p>}
      {errors.length > 0 && <div className="note bad" role="alert">{errors.map((e, i) => <p key={i} style={{ margin: '.15rem 0' }}>{e}</p>)}</div>}
      <div className="actions sticky">
        <button className="btn quiet" onClick={onClose}>{t('Cancel')}</button>
        {!wasPublished && <button className="btn" disabled={!!busy || uploading} onClick={() => void save(true)}>{busy === 'draft' ? <span className="spinner" /> : t('Save draft')}</button>}
        <button className="btn primary" disabled={!!busy || uploading} onClick={() => void save(false)}>{busy === 'send' ? <span className="spinner" /> : <><Icon name="send" size={17} />{wasPublished ? t('Save changes') : isAdmin && f.postedAs === 'company' ? t('SUBMIT') : t('SEND')}</>}</button>
      </div>

      {transcripts && (
        <Dialog title={t('Check the transcript')} onClose={() => setTranscripts(null)} wide>
          {transcripts.length === 0 ? <Spinner label={t('Preparing the transcript…')} /> : transcripts.map((tr, i) => (
            <label className="field" key={tr.id}><span>{tr.name}</span><textarea rows={8} value={tr.text} onChange={(e) => setTranscripts(transcripts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={t('No speech was recognised. You can type the transcript here.')} /></label>
          ))}
          {transcripts.length > 0 && <div className="actions"><button className="btn quiet" onClick={() => setTranscripts(null)}>{t('Close')}</button><button className="btn primary" onClick={async () => { try { for (const tr of transcripts) await api(`/media/${tr.id}/transcript`, { method: 'PUT', body: { transcript: tr.text } }); toast(t('Transcript saved.')); setTranscripts(null); } catch (e: any) { toast(e.message, 'error'); } }}>{t('Save transcript')}</button></div>}
        </Dialog>
      )}
    </div>
  );
}

/** "Ask Why": the Contributor asks the admins about a removed or blocked story. The conversation continues in INBOX. */
export function AskWhy({ storyId, onClose, suspendedToken }: { storyId?: string; onClose: () => void; suspendedToken?: string }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const nav = useNavigate();
  const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const files = useRef<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const canSend = useMemo(() => description.trim().length >= 3, [description]);
  async function send() {
    setBusy(true); setError('');
    try {
      const r = suspendedToken ? await post('/auth/suspension/ask-why', { token: suspendedToken, description: description.trim() }) : await post(`/stories/${storyId}/ask-why`, { subject: subject.trim() || undefined, description: description.trim(), mediaIds: files.current.length ? files.current : undefined });
      toast(r.message ?? t('Sent. The admins will reply in your INBOX.')); onClose();
      if (r.conversationId && !suspendedToken) nav(`/inbox/${r.conversationId}`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <Dialog title={t('Ask Why')} onClose={onClose}>
      <p className="small dim">{t('Your question goes to the admins. Their reply arrives in your INBOX.')}</p>
      {!suspendedToken && <label className="field"><span>{t('Subject (optional)')}</span><input type="text" value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} /></label>}
      <label className="field"><span>{t('Your question')}</span><textarea rows={4} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} /></label>
      {!suspendedToken && <p className="small"><label className="linkbtn" style={{ cursor: 'pointer' }}><Icon name="clip" size={14} /> {t('Attach a file')}<input type="file" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const m = await uploadFile(file, 'message', () => undefined).promise; files.current.push(m.id); setNames((n) => [...n, m.name]); } catch (er: any) { setError(er.message); } }} /></label> {names.join(', ')}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><button className="btn quiet" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" disabled={busy || !canSend} onClick={send}>{t('Send')}</button></div>
    </Dialog>
  );
}
