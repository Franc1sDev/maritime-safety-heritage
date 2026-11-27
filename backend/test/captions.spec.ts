import { captionLines, fromNumbered, numbered, spread } from '../src/stories/captions';

describe('Captions (Section 3.1.5)', () => {
  it('cuts a typed transcript into short lines at sentence ends', () => {
    const lines = captionLines('We left at dawn. The wind rose quickly and the boat began to take on water, so we turned back towards the landing at Dunga before it was too late!   Everyone wore a life jacket.');
    expect(lines[0]).toBe('We left at dawn.');
    expect(lines.every((l) => l.length <= 90)).toBe(true);
    expect(lines.join(' ')).toContain('Everyone wore a life jacket.');
    expect(captionLines('')).toEqual([]);
  });
  it('numbers lines for the translator and reads the answer back', () => {
    const cues = [{ start: 0, end: 2, text: 'We left at dawn.' }, { start: 2, end: 5, text: 'The wind rose.' }];
    expect(numbered(cues)).toBe('1. We left at dawn.\n2. The wind rose.');
    expect(fromNumbered('1. Tuliondoka alfajiri.\n2) Upepo uliongezeka.', 2)).toEqual(['Tuliondoka alfajiri.', 'Upepo uliongezeka.']);
    // A line lost by the translator means the timings would no longer match: the original is used instead.
    expect(fromNumbered('1. Tuliondoka alfajiri.', 2)).toBeNull();
  });
  it('spreads untimed lines over the recording by their length, and leaves timed ones alone', () => {
    const out = spread([{ start: null, end: null, text: 'aaaa' }, { start: null, end: null, text: 'aaaaaaaaaaaa' }], 16);
    expect(out[0]).toMatchObject({ start: 0, end: 4 });
    expect(out[1]).toMatchObject({ start: 4, end: 16 });
    const timed = [{ start: 1, end: 2, text: 'x' }];
    expect(spread(timed, 100)).toBe(timed);
  });
});
