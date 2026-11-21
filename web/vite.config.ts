import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The website is built into web/dist and served by the API at the same address, so sign-in, links and security policies stay simple.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'og-default.png'],
      manifest: {
        name: 'Remembering the Waters', short_name: 'Waters',
        description: 'Kenya’s Maritime and Inland-Water Safety Heritage Archive: stories, testimonies, records and photographs.',
        theme_color: '#0b5fbf', background_color: '#ffffff', display: 'standalone', start_url: '/', scope: '/', lang: 'en',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell works offline; stories already viewed stay readable from the cache (Section 8.3).
        importScripts: ['/push-sw.js'], navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/og\//, /\.[a-z0-9]{2,5}$/i],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 4_000_000, cleanupOutdatedCaches: true,
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname === '/api/v1/config', handler: 'StaleWhileRevalidate', options: { cacheName: 'config' } },
          { urlPattern: ({ url, request }) => request.method === 'GET' && /^\/api\/v1\/(stories|incidents|announcements|resources|collections|timeline|places|contributors|inbox|me\/stories)/.test(url.pathname),
            handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 6, expiration: { maxEntries: 300, maxAgeSeconds: 14 * 86400 } } },
          { urlPattern: ({ url }) => /^\/api\/v1\/media\/(avatar|file)\//.test(url.pathname) && !/\.(m3u8|ts)$/.test(url.pathname) && !/\/(web|original|hls)/.test(url.pathname),
            handler: 'CacheFirst', options: { cacheName: 'images', matchOptions: { ignoreSearch: true }, expiration: { maxEntries: 400, maxAgeSeconds: 30 * 86400 }, cacheableResponse: { statuses: [200] } } },
          { urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com', handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist', sourcemap: false, target: 'es2020',
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'], data: ['@tanstack/react-query', 'i18next', 'react-i18next', 'socket.io-client'] } } },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000', '/socket.io': { target: 'http://localhost:4000', ws: true }, '/og': 'http://localhost:4000' } },
});
