import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../lib/i18n';
import { Guide, replayGuide } from '../components/Guide';

const Page = () => (
  <>
    <div data-guide="browse">tabs</div>
    <div data-guide="react">reactions</div>
    <div data-guide="share">plus</div>
    <Guide ready />
  </>
);

describe('first-use hints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('guide');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40, x: 10, y: 10, toJSON: () => ({}) });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('walks through the hints, skips a control that is not on screen, and is shown once', () => {
    const { unmount } = render(<Page />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole('dialog')).toHaveTextContent('Browse the stories');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('React to a story');
    // No comments control on this page: the next hint is the last one.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Share your first story');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('guide')).toBe('1');
    unmount();
    render(<Page />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be skipped, and shown again from Settings', () => {
    render(<Page />);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.click(screen.getByRole('button', { name: 'Skip the hints' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { replayGuide(); vi.advanceTimersByTime(600); });
    expect(screen.getByRole('dialog')).toHaveTextContent('Hint 1 of 4');
  });
});
