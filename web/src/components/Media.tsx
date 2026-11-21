import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../lib/app';
import { Icon } from './Icon';

export interface MediaItem {
  id: string; kind: 'image' | 'video' | 'audio' | 'document'; name: string; mimeType: string; sizeBytes: number; width?: number; height?: number; durationSeconds?: number;
  altText: string; transcript: string | null; segments: Array<{ start: number; end: number; text: string }> | null; processing: string; urls: Record<string, string>; sizes: Record<string, number>;
}
const mb = (n?: number) => (n ? `${(n / 1048576).toFixed(n > 10_485_760 ? 0 : 1)} MB` : '');

/**
 * One file of a story. Videos autoplay muted and pause when the STORIES page is blurred, when the story scrolls off screen
 * or while a priority notification is shown. In low-data mode nothing loads until tapped, and the size is shown first.
 */
export function MediaView({ m, active, paused }: { m: MediaItem; active: boolean; paused: boolean }) {
  const { t } = useTranslation();
  const { lowData } = useApp();
  const [load, setLoad] = useState(!lowData);
  const [captions, setCaptions] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (!lowData) setLoad(true); }, [lowData]);

  // Adaptive streaming: the player picks the quality that suits the connection (HLS), lower by default in low-data mode.
  useEffect(() => {
    const v = video.current;
    if (!v || !load || m.kind !== 'video') return;
    let hls: any;
    const src = m.urls.hls;
    if (src && !v.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) { v.src = m.urls.web ?? m.urls.original; return; }
        hls = new Hls({ startLevel: lowData ? 0 : -1, capLevelToPlayerSize: true });
        hls.loadSource(src); hls.attachMedia(v);
      });
    } else v.src = src ?? m.urls.web ?? m.urls.original;
    return () => hls?.destroy();
  }, [load, m, lowData]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active && !paused && load && !lowData) void v.play().catch(() => undefined); else v.pause();
    if (paused || !active) audio.current?.pause();
  }, [active, paused, load, lowData]);

  // Captions from the transcript's timestamps.
  useEffect(() => {
    const el = video.current ?? audio.current;
    if (!el || !m.segments?.length) return;
    const tick = () => setCaptions(m.segments!.find((s) => el.currentTime >= s.start && el.currentTime <= s.end)?.text ?? '');
    el.addEventListener('timeupdate', tick);
    return () => el.removeEventListener('timeupdate', tick);
  }, [m.segments, load]);

  if (m.processing !== 'done' && m.kind !== 'document' && !Object.keys(m.urls).length) return <div className="media"><div className="placeholder"><span className="spinner" />{t('This file is still being prepared.')}</div></div>;
  if (!load && m.kind !== 'document') {
    const size = m.kind === 'image' ? m.sizes.medium : m.sizes.web;
    return (
      <div className="media">
        <button className="placeholder" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setLoad(true)}>
          <Icon name={m.kind} size={34} />
          <b>{m.kind === 'image' ? t('Tap to load the photo') : m.kind === 'video' ? t('Tap to load the video') : t('Tap to load the audio')}</b>
          <span className="small">{mb(size)}{m.altText ? ` · ${m.altText}` : ''}</span>
        </button>
      </div>
    );
  }
  if (m.kind === 'image') {
    return <div className="media"><img src={m.urls.medium ?? m.urls.full} srcSet={m.urls.thumb && m.urls.full ? `${m.urls.thumb} 320w, ${m.urls.medium} 960w, ${m.urls.full} 2400w` : undefined} sizes="(max-width: 860px) 92vw, 540px" alt={m.altText || t('Photo with this story')} loading="lazy" decoding="async" /></div>;
  }
  if (m.kind === 'video') {
    return (
      <div className="media">
        <video ref={video} poster={m.urls.poster} muted playsInline controls preload={lowData ? 'none' : 'metadata'} aria-label={m.altText || t('Video with this story')} />
        {captions && <div style={{ position: 'absolute', bottom: 44, insetInline: 8, textAlign: 'center', pointerEvents: 'none' }}><span style={{ background: 'rgba(0,0,0,.75)', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>{captions}</span></div>}
      </div>
    );
  }
  if (m.kind === 'audio') {
    return <div className="media" style={{ padding: '.6rem' }}><div className="row small dim" style={{ marginBottom: '.3rem' }}><Icon name="audio" size={18} />{m.name}</div><audio ref={audio} src={m.urls.web ?? m.urls.original} controls preload="none" />{captions && <p className="small" style={{ margin: '.3rem 0 0' }}>{captions}</p>}</div>;
  }
  return (
    <div className="media">
      <a className="doc" href={m.urls.original} target="_blank" rel="noopener noreferrer"><Icon name="document" size={30} /><span><b>{m.name}</b><br /><span className="small dim">{mb(m.sizeBytes)} · {t('Opens in a safe viewer')}</span></span></a>
    </div>
  );
}
