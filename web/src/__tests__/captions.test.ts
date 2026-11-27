import { describe, expect, it } from 'vitest';
import { spreadCues } from '../components/Media';

describe('Captions on recordings', () => {
  it('keeps timed captions as they are', () => {
    const timed = [{ start: 0, end: 2, text: 'We left at dawn.' }];
    expect(spreadCues(timed, 60)).toBe(timed);
  });
  it('spreads a typed transcript over the recording by the length of each line', () => {
    const out = spreadCues([{ start: null, end: null, text: 'aaaa' }, { start: null, end: null, text: 'aaaaaaaaaaaa' }], 16);
    expect(out).toEqual([{ start: 0, end: 4, text: 'aaaa' }, { start: 4, end: 16, text: 'aaaaaaaaaaaa' }]);
  });
});
