import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { post } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon } from './Icon';
import { Confirm, Dialog } from './ui';
import type { Story } from './Story';

/** What an admin sees at the top centre of every story: its ID and AI flag, the Recycle Bin, and the comment controls. */
export function AdminBar({ story, onChanged, full }: { story: Story; onChanged?: () => void; full?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const qc = useQueryClient();
  const [ask, setAsk] = useState<null | 'remove' | 'restore' | 'lock' | 'hide' | 'override' | 'correction' | 'keep' | 'release'>(null);
  const [note, setNote] = useState(''); const [link, setLink] = useState(''); const [why, setWhy] = useState(''); const [busy, setBusy] = useState(false);
  const m = story.moderation;
  const done = (msg?: string) => { toast(msg ?? t('Done.')); void qc.invalidateQueries({ queryKey: ['moderation'] }); void qc.invalidateQueries({ queryKey: ['stories'] }); void qc.invalidateQueries({ queryKey: ['approvals'] }); onChanged?.(); };
  const run = async (path: string, body: unknown) => { try { const r = await post(`/admin/stories/${story.id}/${path}`, body); done(r?.message); } catch (e: any) { toast(e.message, 'error'); throw e; } };
  const blocked = m?.aiFlag === 'RED' && !m.overridden && ['pending_review', 'blocked'].includes(story.status);
  return (
    <div className="adminbar" role="group" aria-label={t('Admin controls for this story')}>
      <span className="code">{story.code}</span>
      <span className={`flag ${m?.aiFlag ?? 'none'}`} title={m?.aiScore != null ? `${t('AI score')}: ${m.aiScore}` : undefined}>{m?.aiFlag ?? t('Not reviewed')}</span>
      {story.status !== 'published' && <span className="flag none">{t(story.status.replace(/_/g, ' '))}</span>}
      {story.status === 'removed'
        ? <button className="xbtn" onClick={() => setAsk('restore')} title={t('Restore story')} aria-label={t('Restore story')}><Icon name="check" size={17} /></button>
        : <button className="xbtn" onClick={() => setAsk('remove')} title={t('Delete story')} aria-label={t('Delete story')}><Icon name="trash" size={17} /></button>}
      <button className={`xbtn ${story.comments.locked ? 'on' : ''}`} onClick={() => setAsk('lock')} title={story.comments.locked ? t('Unlock comments') : t('Lock comments')} aria-label={story.comments.locked ? t('Unlock comments') : t('Lock comments')} aria-pressed={story.comments.locked}><Icon name="lock" size={17} /></button>
      <button className={`xbtn ${story.comments.hidden ? 'on' : ''}`} onClick={() => setAsk('hide')} title={story.comments.hidden ? t('Show comments') : t('Hide comments')} aria-label={story.comments.hidden ? t('Show comments') : t('Hide comments')} aria-pressed={story.comments.hidden}><Icon name="hide" size={17} /></button>
      {full && <button className="xbtn" onClick={() => { setNote(story.correction?.note ?? ''); setLink(story.correction?.link ?? ''); setAsk('correction'); }} title={t('Add a safety note')} aria-label={t('Add a safety note')}><Icon name="warning" size={17} /></button>}
      {blocked && <><button className="btn small" onClick={() => setAsk('override')}>{t('Override AI ban')}</button><button className="btn small quiet" onClick={() => setAsk('keep')}>{t('Keep blocked')}</button></>}
      {full && story.status === 'pending_review' && !blocked && <button className="btn small" onClick={() => setAsk('release')}>{t('Publish')}</button>}

      {ask === 'remove' && <Confirm title={t('Delete this story?')} text={t('The Contributor will see a notice with an “Ask Why” button.')} needReason={t('Reason (shown to the Contributor)')} yes={t('Delete story')} danger onClose={() => setAsk(null)} onYes={(reason) => run('remove', { reason })} />}
      {ask === 'restore' && <Confirm title={t('Restore this story?')} needReason={t('Reason')} yes={t('Restore story')} onClose={() => setAsk(null)} onYes={(reason) => run('restore', { reason })} />}
      {ask === 'keep' && <Confirm title={t('Keep this story blocked?')} needReason={t('Reason (shown to the Contributor)')} yes={t('Keep blocked')} onClose={() => setAsk(null)} onYes={(reason) => run('keep-blocked', { reason })} />}
      {ask === 'release' && <Confirm title={t('Publish this story?')} yes={t('Publish')} onClose={() => setAsk(null)} onYes={() => run('release', {})} />}
      {ask === 'lock' && (story.comments.locked
        ? <Confirm title={t('Unlock comments?')} yes={t('Unlock comments')} onClose={() => setAsk(null)} onYes={() => run('comments-lock', { on: false })} />
        : <Confirm title={t('Lock comments and replies?')} needReason={t('Reason (shown to Contributors)')} yes={t('Lock comments')} onClose={() => setAsk(null)} onYes={(reason) => run('comments-lock', { on: true, reason })} />)}
      {ask === 'hide' && (story.comments.hidden
        ? <Confirm title={t('Show comments again?')} yes={t('Show comments')} onClose={() => setAsk(null)} onYes={() => run('comments-hide', { on: false })} />
        : <Confirm title={t('Hide all comments?')} needReason={t('Reason (shown to Contributors)')} yes={t('Hide comments')} onClose={() => setAsk(null)} onYes={(reason) => run('comments-hide', { on: true, reason })} />)}
      {ask === 'override' && (
        <Dialog title={t('Override the AI ban')} onClose={() => setAsk(null)}>
          <p className="note bad"><b>{t('Overrides are irreversible.')}</b> {t('They feed into the AI review guidance and may weaken it. Override only when you are certain.')}</p>
          {m?.aiExplanation?.summary && <p className="small"><b>{t('Why the AI blocked it')}:</b> {m.aiExplanation.summary}</p>}
          <label className="field"><span>{t('Justification (required)')}</span><textarea value={why} onChange={(e) => setWhy(e.target.value)} /></label>
          <p className="small dim">{t('The override goes to the other admins for approval before the story is published.')}</p>
          <div className="actions"><button className="btn quiet" onClick={() => setAsk(null)}>{t('Cancel')}</button>
            <button className="btn primary danger" disabled={busy || why.trim().length < 3} onClick={async () => { setBusy(true); try { await run('override', { reason: why.trim() }); setAsk(null); setWhy(''); } catch { /* shown */ } finally { setBusy(false); } }}>{t('Send for approval')}</button></div>
        </Dialog>
      )}
      {ask === 'correction' && (
        <Dialog title={t('Safety note on this story')} onClose={() => setAsk(null)}>
          <p className="small dim">{t('Use this when a story describes an unsafe practice. The note is shown with the story, with a link to official guidance. Leave it empty to remove the note.')}</p>
          <label className="field"><span>{t('Note')}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
          <label className="field"><span>{t('Link to official guidance (optional)')}</span><input type="url" value={link} onChange={(e) => setLink(e.target.value)} /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setAsk(null)}>{t('Cancel')}</button><button className="btn primary" onClick={async () => { try { await run('correction', { note: note.trim(), link: link.trim() || undefined }); setAsk(null); } catch { /* shown */ } }}>{t('Save')}</button></div>
        </Dialog>
      )}
    </div>
  );
}
