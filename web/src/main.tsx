import React, { startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion } from 'framer-motion';
import './lib/i18n';
import './styles.css';
import { AppProvider } from './lib/app';
import App from './App';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
// The first render is done in small slices, so the page stays responsive on slow phones while it is being drawn.
const root = createRoot(document.getElementById('root')!);
startTransition(() => root.render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {/* Animations start working as soon as their engine has been fetched; nothing waits for it. */}
        <LazyMotion features={() => import('./lib/motion-features').then((f) => f.default)}><AppProvider><App /></AppProvider></LazyMotion>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
));

// The web app: installable, with an offline shell. A new version is offered, not forced.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');
    wb.addEventListener('waiting', () => { window.dispatchEvent(new CustomEvent('app-update', { detail: () => { wb.messageSkipWaiting(); wb.addEventListener('controlling', () => window.location.reload()); } })); });
    wb.register().catch(() => undefined);
  });
}

// The Noto Sans font is fetched after the page is on screen, so it never holds up the first story. On a first visit
// the device's own font is used; the font is kept and used from the next page on, so text never re-flows mid-read.
const font = document.createElement('link');
font.rel = 'stylesheet';
font.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=optional';
document.head.appendChild(font);
