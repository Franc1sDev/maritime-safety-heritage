import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './lib/i18n';
import './styles.css';
import { AppProvider } from './lib/app';
import App from './App';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppProvider><App /></AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// The web app: installable, with an offline shell. A new version is offered, not forced.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');
    wb.addEventListener('waiting', () => { window.dispatchEvent(new CustomEvent('app-update', { detail: () => { wb.messageSkipWaiting(); wb.addEventListener('controlling', () => window.location.reload()); } })); });
    wb.register().catch(() => undefined);
  });
}
