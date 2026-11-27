/**
 * Captions for audio and video (Section 3.1.5): the transcript shown on the recording as it plays, in the reader's
 * language where the translation service is available.
 */
export interface Cue { start: number | null; end: number | null; text: string }

/** A typed transcript has no timings: it is cut into short lines, which the player spreads over the recording. */
export function captionLines(text: string, max = 90): string[] {
  const out: string[] = [];
  for (const sentence of text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?。！？।؟…])\s+/)) {
    let line = '';
    for (const word of sentence.split(' ')) {
      if (line && (line + ' ' + word).length > max) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
    }
    if (line) out.push(line);
  }
  return out;
}

/** The cues as numbered lines for the translator, and back. Null when the answer does not have every line. */
export const numbered = (cues: Cue[]) => cues.map((c, i) => `${i + 1}. ${c.text.replace(/\s+/g, ' ').trim()}`).join('\n');
export function fromNumbered(answer: string, count: number): string[] | null {
  const lines = new Map<number, string>();
  for (const l of answer.split('\n')) {
    const m = /^\s*(\d+)\s*[.)\]:：、]\s*(.+?)\s*$/.exec(l);
    if (m) lines.set(Number(m[1]), m[2]);
  }
  const out: string[] = [];
  for (let i = 1; i <= count; i++) { const v = lines.get(i); if (!v) return null; out.push(v); }
  return out;
}

/** Times for cues that have none, in proportion to their length. */
export function spread(cues: Cue[], duration: number): Array<{ start: number; end: number; text: string }> {
  if (cues.every((c) => c.start !== null && c.end !== null)) return cues as Array<{ start: number; end: number; text: string }>;
  const total = cues.reduce((n, c) => n + Math.max(1, c.text.length), 0) || 1;
  let at = 0;
  return cues.map((c) => { const len = (Math.max(1, c.text.length) / total) * Math.max(0, duration); const cue = { start: at, end: at + len, text: c.text }; at += len; return cue; });
}
