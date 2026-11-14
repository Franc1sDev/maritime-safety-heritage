import { INestApplication, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from '../config/config';

/**
 * Pages for search engines and link previews, served outside the API:
 *  - /robots.txt and /sitemap.xml
 *  - /items and /items/MSH-0001: public catalogue pages with the title, summary and description of each
 *    published item. Media, full text and transcripts stay behind sign-in. Turn off with PUBLIC_PREVIEWS=false.
 *  - the website's index.html with its canonical address filled in.
 */
const log = new Logger('Seo');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TYPES: Record<string, string> = { oral: 'Oral history', photo: 'Photograph', record: 'Historical record', testimony: 'Testimony' };
const PAGE = 60;

interface Row { identifier: string; title: string; summary: string; type: string; year: number | null; year_approximate: boolean; place: string; county: string;
  water_body: string | null; rights: string; creator: string; narrator: string; photographer: string; updated_at: Date; published_at: Date | null; subjects: string | null }

const site = () => config.siteUrl;
const year = new Date().getFullYear();

function shell(o: { title: string; description: string; path: string; body: string; jsonLd?: object; noindex?: boolean }) {
  const url = `${site()}${o.path}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="article"><meta property="og:site_name" content="Maritime Safety Heritage Archive">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="copyright" content="© ${year} Remembering the Waters">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&family=Sora:wght@600&display=swap">
<style>
:root{color-scheme:dark;--bg:#02060e;--ink:#e8eef8;--dim:#9fb0c8;--line:#1b2a42;--accent:#4d8dff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Manrope,system-ui,sans-serif}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.wrap{max-width:46rem;margin:0 auto;padding:2rem 1rem 3rem}
header{margin-bottom:2.5rem}header a{color:var(--ink);text-decoration:none;font:600 1rem Sora,sans-serif}
h1{font:600 clamp(1.6rem,4vw,2.3rem)/1.2 Sora,sans-serif;margin:.25rem 0 .75rem}
.meta{color:var(--dim);margin:0 0 1.5rem}.meta span+span:before{content:", "}
.cta{display:inline-block;margin:1.5rem 0;padding:.75rem 1.2rem;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem;color:var(--dim)}dt{color:var(--ink)}
ul.items{list-style:none;padding:0}ul.items li{padding:1rem 0;border-top:1px solid var(--line)}ul.items p{margin:.25rem 0;color:var(--dim)}
nav.pager{display:flex;gap:1rem;margin-top:1rem}
footer{border-top:1px solid var(--line);margin-top:3rem;padding-top:1rem;color:var(--dim);font-size:.875rem}
</style>
${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head><body><div class="wrap">
<header><a href="/">Maritime Safety Heritage Archive</a></header>
<main>${o.body}</main>
<footer>© ${year} Remembering the Waters research team. Testimonies, photographs and records are shared with the consent of their contributors.
Reuse needs permission; cite the item identifier. <a href="/#/terms">Terms and copyright</a> · <a href="/#/privacy">Privacy</a></footer>
</div></body></html>`;
}

export function registerPublicPages(app: INestApplication) {
  const ds = app.get(DataSource);
  const http = app.getHttpAdapter().getInstance() as import('express').Express;
  const send = (res: Response, type: string, body: string, maxAge = 600) => {
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.send(body);
  };
  const fail = (res: Response, e: unknown) => {
    log.error((e as Error).message);
    res.status(503).type('text/plain').send('The archive is temporarily unavailable.');
  };
  const SELECT = `SELECT r.identifier, r.title, r.summary, r.type, r.year, r.year_approximate, r.place, r.county, w.name AS water_body, r.rights,
      r.creator, r.narrator, r.photographer, r.updated_at, r.published_at,
      (SELECT string_agg(s.label, ', ' ORDER BY s.label) FROM record_subjects rs JOIN subjects s ON s.id = rs.subject_id WHERE rs.record_id = r.id) AS subjects
    FROM records r LEFT JOIN water_bodies w ON w.id = r.water_body_id WHERE r.status = 'published' AND r.deleted_at IS NULL`;

  // Bulk-scraping guard for these pages: 120 requests a minute per address.
  const hits = new Map<string, { n: number; reset: number }>();
  const limit = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now(), key = req.ip ?? '';
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + 60_000 }; hits.set(key, h); }
    if (++h.n > 120 * config.rateLimitScale) return void res.status(429).setHeader('Retry-After', '60').type('text/plain').send('Too many requests. Try again in a minute.');
    if (hits.size > 50_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
  http.use(['/items', '/sitemap.xml'], limit);

  http.get('/robots.txt', (_req: Request, res: Response) => {
    send(res, 'text/plain; charset=utf-8', `User-agent: *\nAllow: /\nDisallow: /api/\nCrawl-delay: 5\n\nSitemap: ${site()}/sitemap.xml\n`, 3600);
  });

  http.get('/sitemap.xml', async (_req: Request, res: Response) => {
    try {
      const rows: Pick<Row, 'identifier' | 'updated_at'>[] = config.publicPreviews
        ? await ds.query(`SELECT identifier, updated_at FROM records WHERE status = 'published' AND deleted_at IS NULL ORDER BY identifier LIMIT 45000`) : [];
      const urls = [
        `<url><loc>${esc(site())}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
        ...(config.publicPreviews ? [`<url><loc>${esc(site())}/items</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`] : []),
        ...rows.map((r) => `<url><loc>${esc(site())}/items/${esc(r.identifier)}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod></url>`),
      ];
      send(res, 'application/xml; charset=utf-8', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 3600);
    } catch (e) { fail(res, e); }
  });

  if (config.publicPreviews) {
    http.get('/items', async (req: Request, res: Response) => {
      try {
        const page = Math.max(1, Math.min(10_000, parseInt(String(req.query.page ?? '1'), 10) || 1));
        const rows: Row[] = await ds.query(`${SELECT} ORDER BY r.published_at DESC NULLS LAST, r.identifier LIMIT ${PAGE + 1} OFFSET ${(page - 1) * PAGE}`);
        const more = rows.length > PAGE;
        const list = rows.slice(0, PAGE).map((r) => `<li><a href="/items/${esc(r.identifier)}">${esc(r.title)}</a>
          <p>${esc(TYPES[r.type] ?? r.type)}${r.year ? `, ${r.year_approximate ? 'about ' : ''}${r.year}` : ''}${r.water_body ? `, ${esc(r.water_body)}` : ''}</p>
          <p>${esc(r.summary)}</p></li>`).join('');
        send(res, 'text/html; charset=utf-8', shell({
          title: page > 1 ? `Archive catalogue, page ${page} | Maritime Safety Heritage Archive` : 'Archive catalogue | Maritime Safety Heritage Archive',
          description: "Catalogue of Kenya's maritime and inland-water safety heritage: oral histories, photographs, historical records and testimonies.",
          path: page > 1 ? `/items?page=${page}` : '/items',
          body: `<h1>Archive catalogue</h1><p class="meta">Oral histories, photographs, records and testimonies of safety on Kenya's ocean, lakes and rivers.</p>
            <a class="cta" href="/#/login">Sign in to search, listen and watch</a>
            <ul class="items">${list || '<li>Nothing has been published yet.</li>'}</ul>
            <nav class="pager" aria-label="Pages">${page > 1 ? `<a href="/items${page > 2 ? `?page=${page - 1}` : ''}">Newer items</a>` : ''}${more ? `<a href="/items?page=${page + 1}">Older items</a>` : ''}</nav>`,
        }));
      } catch (e) { fail(res, e); }
    });

    http.get('/items/:identifier', async (req: Request, res: Response) => {
      try {
        const id = String(req.params.identifier ?? '').toUpperCase();
        if (!/^MSH-\d{1,9}$/.test(id)) return void res.status(404).type('text/plain').send('Not found');
        const [r]: Row[] = await ds.query(`${SELECT} AND r.identifier = $1`, [id]);
        if (!r) {
          return void res.status(404).type('text/html').send(shell({ title: 'Item not found | Maritime Safety Heritage Archive', description: 'This item is not in the public catalogue.',
            path: `/items/${id}`, noindex: true, body: `<h1>Item not found</h1><p>It may have been taken offline. <a href="/items">Browse the catalogue</a>.</p>` }));
        }
        const when = r.year ? `${r.year_approximate ? 'about ' : ''}${r.year}` : '';
        const where = [r.place, r.county, r.water_body].filter(Boolean).join(', ');
        const who = r.narrator || r.creator || r.photographer;
        const description = (r.summary || `${TYPES[r.type]} in the Maritime Safety Heritage Archive.`).slice(0, 300);
        const rows = [['Identifier', r.identifier], ['Type', TYPES[r.type] ?? r.type], ['Date', when], ['Place', where], ['By', who], ['Subjects', r.subjects], ['Rights', r.rights]]
          .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
        send(res, 'text/html; charset=utf-8', shell({
          title: `${r.title} | Maritime Safety Heritage Archive`, description, path: `/items/${r.identifier}`,
          jsonLd: {
            '@context': 'https://schema.org', '@type': 'ArchiveComponent', name: r.title, identifier: r.identifier, description,
            ...(r.year && { temporalCoverage: String(r.year) }), ...(where && { spatialCoverage: where }), ...(who && { creator: who }),
            ...(r.subjects && { keywords: r.subjects }), url: `${site()}/items/${r.identifier}`, ...(r.rights && { license: r.rights }),
            holdingArchive: { '@type': 'ArchiveOrganization', name: 'Maritime Safety Heritage Archive, Remembering the Waters', url: site() },
          },
          body: `<p class="meta"><span>${esc(TYPES[r.type] ?? r.type)}</span>${when ? `<span>${esc(when)}</span>` : ''}${where ? `<span>${esc(where)}</span>` : ''}</p>
            <h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p>
            <a class="cta" href="/#/record/${esc(r.identifier)}">Sign in to see the full item</a>
            <dl>${rows}</dl><p><a href="/items">Browse the catalogue</a></p>`,
        }));
      } catch (e) { fail(res, e); }
    });
  }

  // The website's start page, with the canonical address and social preview tags filled in.
  const indexFile = config.webDir ? join(config.webDir, 'index.html') : '';
  if (indexFile && existsSync(indexFile)) {
    // A new version tag on every release, so browsers never mix an old script with a new page.
    const version = (process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || String(Date.now())).slice(0, 12);
    const html = () => readFileSync(indexFile, 'utf8').replace(/__SITE_URL__/g, esc(site())).replace(/__V__/g, esc(version));
    const cached = config.isProd ? html() : null;
    http.get(['/', '/index.html'], (_req: Request, res: Response, next: NextFunction) => {
      try { send(res, 'text/html; charset=utf-8', cached ?? html(), config.isProd ? 300 : 0); } catch (e) { next(e); }
    });
  }
}
