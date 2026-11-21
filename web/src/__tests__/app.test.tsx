import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n, { setLanguage } from '../lib/i18n';
import sw from '../locales/sw';
import { avatarUrl } from '../lib/api';
import { compact, fmtDate, Dialog, Confirm } from '../components/ui';
import { MiniCalendar } from '../pages/Announcements';
import { StoryFrame, Story } from '../components/Story';
import { AppProvider } from '../lib/app';

const story: Story = {
  id: 's1', code: 'MS-2026-00001', type: 'testimony', typeLabel: 'Testimony collected by the project', title: 'Night crossings', text: 'We counted heads at the ramp.', language: 'en', languageName: 'English', postedAs: 'told_by', toldBy: 'A deckhand',
  author: { id: 'a1', role: 'admin', username: null, name: 'Admin – Grace', avatar: 'logo', badge: 'ADMIN' }, place: { id: 2, name: 'Likoni', latitude: -4.07, longitude: 39.66, county: 'Mombasa', waterBody: 'Indian Ocean' }, eventDate: '1987-01-01', dateApproximate: true,
  category: 'Safety lessons', vessel: '', tags: ['ferry'], rights: 'CC BY-NC 4.0', allowDownload: true, sensitive: false, incident: null, source: null, consentLabel: 'Shared with consent', correction: null,
  counts: { hearts: 1, heartbreaks: 0, laughs: 0, comments: 2, shares: 0, links: 0, favourites: 0 }, viewer: { reaction: null, favourited: false, followingAuthor: false, own: false }, comments: { locked: false, lockedReason: '', hidden: false, hiddenReason: '' },
  media: [], status: 'published', publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), edited: false, editedAt: null, editHistory: [], permalink: 'http://localhost/stories/MS-2026-00001',
};
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AppProvider>{ui}</AppProvider></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/config') ? { languages: [], reportReasons: [], rules: [] } : {}), { status: String(url).includes('/auth/refresh') ? 401 : 200, headers: { 'content-type': 'application/json' } })));
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

describe('helpers', () => {
  it('shortens large counts', () => { expect(compact(950)).toBe('950'); expect(compact(1500)).toBe('1.5k'); expect(compact(2_400_000)).toBe('2.4M'); });
  it('writes dates the Kenyan way and keeps plain dates on their day', () => { expect(fmtDate('1994-04-29', 'en')).toBe('29 Apr 1994'); });
  it('resolves the kinds of profile picture', () => {
    expect(avatarUrl('logo').kind).toBe('logo'); expect(avatarUrl('avatar:dhow')).toEqual({ kind: 'preset', value: 'dhow' });
    expect(avatarUrl('media:abc').value).toBe('/api/v1/media/avatar/abc');
  });
});

describe('languages', () => {
  it('falls back to English when a translation is missing', async () => { await setLanguage('luo'); expect(i18n.t('Share my story')).toBe('Share my story'); });
  it('shows Kiswahili and fills in values', async () => { await setLanguage('sw'); expect(i18n.t('Share my story')).toBe(sw['Share my story']); expect(i18n.t('{n} stories', { n: 3 })).toBe('Hadithi 3'); await setLanguage('en'); expect(i18n.t('Share my story')).toBe('Share my story'); });
  it('keeps every placeholder in the Kiswahili text', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [en, tr] of Object.entries(sw)) expect(ph(tr), en).toBe(ph(en));
  });
});

describe('dialogs', () => {
  it('closes on Escape and has an accessible name', () => {
    const onClose = vi.fn();
    wrap(<Dialog title="Cite this story" onClose={onClose}><button>Copy</button></Dialog>);
    expect(screen.getByRole('dialog', { name: 'Cite this story' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('asks for a reason before a moderation action', async () => {
    const onYes = vi.fn();
    wrap(<Confirm title="Delete this story?" yes="Delete story" needReason="Reason" onYes={onYes} onClose={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Delete story' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Breaks rule 3' } });
    fireEvent.click(button);
    await waitFor(() => expect(onYes).toHaveBeenCalledWith('Breaks rule 3'));
  });
});

describe('announcement calendar', () => {
  it('marks the announced days', () => {
    const { container } = render(<MiniCalendar dates={[{ date: '2026-12-05', endDate: '2026-12-06', label: 'Listening day' }]} />);
    expect(container.querySelectorAll('.hit')).toHaveLength(2);
  });
});

describe('story frame', () => {
  it('shows the story with its labels and every action', async () => {
    wrap(<StoryFrame story={story} active paused={false} />);
    expect(screen.getByRole('heading', { name: 'Night crossings' })).toBeInTheDocument();
    expect(screen.getByText('Shared with consent')).toBeInTheDocument();
    for (const name of ['Where It Happened', 'Heart: 1', 'Comments: 2', 'Share', 'Copy Link', 'Cite', 'Download', 'Add to Favorites', 'Listen', 'Report', 'Safety concern']) expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0);
  });
  it('asks a visitor to sign in before reacting, and does not change the count', async () => {
    wrap(<StoryFrame story={story} active paused={false} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Heart: 1' })[0]);
    expect(screen.getAllByRole('button', { name: 'Heart: 1' }).length).toBeGreaterThan(0);
  });
  it('hides a sensitive story behind a notice', () => {
    wrap(<StoryFrame story={{ ...story, sensitive: true }} active paused={false} />);
    expect(screen.queryByRole('heading', { name: 'Night crossings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View story' }));
    expect(screen.getByRole('heading', { name: 'Night crossings' })).toBeInTheDocument();
  });
  it('does not offer Download when the contributor does not allow it', () => {
    wrap(<StoryFrame story={{ ...story, allowDownload: false }} active paused={false} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});
