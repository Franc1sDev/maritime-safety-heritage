import { describe, expect, it } from 'vitest';
import { clsFromShifts, pageKind } from '../lib/vitals';

describe('Real-user monitoring (Section 9.4)', () => {
  it('scores layout shift by the worst session window', () => {
    expect(clsFromShifts([])).toBe(0);
    // Two shifts close together make one window; a later one after a 2 s gap starts another.
    expect(clsFromShifts([{ value: 0.05, startTime: 100 }, { value: 0.04, startTime: 600 }, { value: 0.06, startTime: 3000 }])).toBe(0.09);
    // A window ends after 5 s even without a gap.
    const steady = Array.from({ length: 12 }, (_, i) => ({ value: 0.01, startTime: i * 900 }));
    expect(clsFromShifts(steady)).toBeLessThanOrEqual(0.06);
  });
  it('sends only the kind of page, never its address', () => {
    expect(pageKind('/story/7f0c1a2e-1111-2222-3333-444455556666')).toBe('story');
    expect(pageKind('/')).toBe('stories');
    expect(pageKind('/search/<script>')).toBe('search');
  });
});
