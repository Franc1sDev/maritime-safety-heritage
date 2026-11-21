import { INestApplication, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from '../config/config';
import { MediaService } from '../media/media.service';

/**
 * Pages for search engines and link previews (Section 3.2.1), served outside the API:
 *  - /robots.txt and /sitemap.xml
 *  - every public page of the website, rendered on the server with its title, description, canonical address,
 *    preview image and readable text, so shared links show rich previews and the archive can be found by search.
 *    The single-page app then takes over in the browser.
 *  - /og/stories/<story ID>: the small preview image used by WhatsApp, Facebook, email and other apps.
 * Only published content appears here. Sensitive stories show their notice instead of their text.
 */
const log = new Logger('PublicPages');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const SITE = 'Remembering the Waters';
const TAGLINE = 'Kenya’s Maritime and Inland-Water Safety Heritage Archive';
const TYPE: Record<string, string> = { community: 'Community story', testimony: 'Testimony', record: 'Historical record' };
interface Page { title: string; description: string; path: string; body: string; image?: string; jsonLd?: object; status?: number; noindex?: boolean }
const VISIBLE = `s.status = 'published' AND (au.id IS NULL OR au.status NOT IN ('deleted','removed'))`;

export function registerPublicPages(app: INestApplication) {
  const http = app.getHttpAdapter().getInstance();
  const ds = app.get(DataSource);
  const site = () => config.siteUrl;
  const indexFile = config.webDir ? join(config.webDir, 'index.html') : '';
  const version = (process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || String(Date.now())).slice(0, 12);
  let template: string | null = null;
  const shellHtml = () => {
    if (template && config.isProd) return template;
    const file = indexFile && existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    template = file.includes('<!--SEO-HEAD-->') ? file
      : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><!--SEO-HEAD--></head><body><div id="root"><!--SEO-BODY--></div></body></html>`;
    return template;
  };
  const render = (p: Page) => {
    const url = `${site()}${p.path}`;
    const head = `<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(url)}">${p.noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${esc(SITE)}"><meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(p.image ?? `${site()}/og-default.png`)}"><meta name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}">
${p.jsonLd ? `<script type="application/ld+json">${JSON.stringify(p.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}`;
    return shellHtml().replace(/__SITE_URL__/g, esc(site())).replace(/__V__/g, esc(version))
      .replace(/<title>[\s\S]*?<\/title>/, '').replace('<!--SEO-HEAD-->', head).replace('<!--SEO-BODY-->', `<main class="prerender">${p.body}</main>`);
  };
  const send = (res: Response, p: Page) => {
    res.status(p.status ?? 200).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', config.isProd && (p.status ?? 200) === 200 ? 'public, max-age=120, s-maxage=600' : 'no-cache');
    res.send(render(p));
  };
  const home = (): Page => ({ title: `${SITE} | ${TAGLINE}`, path: '/',
    description: 'Stories, testimonies, historical records and photographs of safety on Kenya’s ocean coast, lakes and rivers. Open to everyone: browse, listen, learn and share your own story.',
    body: `<h1>${esc(SITE)}</h1><p>${esc(TAGLINE)}. Stories, testimonies, historical records and photographs from the coast, Lake Victoria and Kenya’s other lakes and rivers.</p>` });
  const wrap = (fn: (req: Request) => Promise<Page | null>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const p = await fn(req);
      send(res, p ?? { ...home(), title: `Not found | ${SITE}`, path: req.path, status: 404, noindex: true, body: '<h1>Not found</h1><p>This page is not in the archive. It may have been removed.</p><p><a href="/">Go to the stories</a></p>' });
    } catch (e) { log.error((e as Error).stack); next(e); }
  };

  http.get('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /super\nDisallow: /inbox\nDisallow: /profile\n\nSitemap: ${site()}/sitemap.xml\n`);
  });

  http.get('/sitemap.xml', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const day = (d: Date) => new Date(d).toISOString().slice(0, 10);
      const stories = await ds.query(`SELECT s.code, s.updated_at FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE ${VISIBLE} ORDER BY s.published_at DESC LIMIT 40000`);
      const incidents = await ds.query(`SELECT code, updated_at FROM incidents WHERE status = 'published'`);
      const resources = await ds.query(`SELECT slug, updated_at FROM resources WHERE status = 'published'`);
      const collections = await ds.query(`SELECT id, updated_at FROM collections WHERE status = 'published'`);
      const urls = [
        ...['', '/incidents', '/map', '/timeline', '/collections', '/resources', '/about'].map((p) => `<url><loc>${esc(site())}${p || '/'}</loc><changefreq>daily</changefreq></url>`),
        ...stories.map((r: any) => `<url><loc>${esc(site())}/stories/${esc(r.code)}</loc><lastmod>${day(r.updated_at)}</lastmod></url>`),
        ...incidents.map((r: any) => `<url><loc>${esc(site())}/incidents/${esc(r.code)}</loc><lastmod>${day(r.updated_at)}</lastmod></url>`),
        ...resources.map((r: any) => `<url><loc>${esc(site())}/resources/${esc(r.slug)}</loc><lastmod>${day(r.updated_at)}</lastmod></url>`),
        ...collections.map((r: any) => `<url><loc>${esc(site())}/collections/${esc(r.id)}</loc><lastmod>${day(r.updated_at)}</lastmod></url>`),
      ];
      res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
    } catch (e) { next(e); }
  });

  /** The preview image for a shared story link: a small copy of its first photo, or of its video poster. Sensitive stories use the default image. */
  http.get('/og/stories/:code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [m] = await ds.query(`SELECT m.variants FROM media_files m JOIN stories s ON s.id = m.story_id LEFT JOIN users au ON au.id = s.author_id
        WHERE upper(s.code) = upper($1) AND ${VISIBLE} AND NOT s.sensitive AND m.kind IN ('image','video') AND m.processing = 'done' ORDER BY m.position LIMIT 1`, [String(req.params.code).replace(/\.\w+$/, '')]);
      const v = m?.variants?.medium ?? m?.variants?.poster;
      if (!v) return void res.redirect(302, '/og-default.png');
      const { stream, size } = await app.get(MediaService).openKey(v.key, v.encrypted);
      res.setHeader('Content-Type', v.mime); res.setHeader('Content-Length', String(size)); res.setHeader('Cache-Control', 'public, max-age=3600'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      stream.pipe(res);
    } catch (e) { next(e); }
  });

  if (config.publicPreviews) {
    http.get('/stories/:code', wrap(async (req) => {
      const [s] = await ds.query(
        `SELECT s.*, i.title AS incident_title, i.code AS incident_code,
                CASE WHEN s.posted_as = 'company' THEN 'Admin' WHEN s.posted_as = 'anonymous' THEN 'Anonymous' WHEN au.role <> 'contributor' THEN coalesce(ap.admin_name, 'Admin')
                     WHEN au.use_provider_identity AND au.provider_name <> '' THEN au.provider_name ELSE au.username END AS author_name,
                EXISTS (SELECT 1 FROM media_files m WHERE m.story_id = s.id AND m.kind IN ('image','video')) AS has_image
           FROM stories s LEFT JOIN users au ON au.id = s.author_id LEFT JOIN admin_profiles ap ON ap.user_id = au.id LEFT JOIN incidents i ON i.id = s.incident_id
          WHERE upper(s.code) = upper($1) AND ${VISIBLE}`, [String(req.params.code)]);
      if (!s) return null;
      const who = s.posted_as === 'told_by' && s.told_by ? `${s.told_by}, as told to ${s.author_name}` : s.author_name;
      const text = s.sensitive ? 'This story describes loss of life and may be distressing. Open it in the archive to read it.' : String(s.body ?? '');
      const title = s.title || `${text.split(/\s+/).slice(0, 10).join(' ')}…`;
      const description = (text.replace(/\s+/g, ' ').slice(0, 200) || `${TYPE[s.type]} in the archive.`) + (text.length > 200 ? '…' : '');
      const when = s.event_date ? `${s.date_approximate ? 'about ' : ''}${new Date(s.event_date).getFullYear()}` : '';
      return {
        title: `${title} | ${SITE}`, description, path: `/stories/${s.code}`, image: s.has_image && !s.sensitive ? `${site()}/og/stories/${s.code}` : undefined,
        jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: title, identifier: s.code, author: { '@type': 'Person', name: who }, datePublished: s.published_at, inLanguage: s.language,
          ...(s.place_name && { contentLocation: { '@type': 'Place', name: s.place_name } }), ...(when && { temporalCoverage: when }), license: s.rights, url: `${site()}/stories/${s.code}`,
          isPartOf: { '@type': 'ArchiveOrganization', name: `${SITE}: ${TAGLINE}`, url: site() } },
        body: `<article><p>${esc(TYPE[s.type])} · ${esc(s.code)}</p><h1>${esc(title)}</h1><p>By ${esc(who)}${s.place_name ? ` · ${esc(s.place_name)}` : ''}${when ? ` · ${esc(when)}` : ''}</p>
          ${s.incident_title ? `<p>Incident: <a href="/incidents/${esc(s.incident_code)}">${esc(s.incident_title)}</a></p>` : ''}
          ${text.split(/\n{2,}/).slice(0, 40).map((p: string) => `<p>${esc(p)}</p>`).join('')}<p>Rights: ${esc(s.rights)}</p></article>`,
      };
    }));
    http.get('/incidents/:code', wrap(async (req) => {
      const [i] = await ds.query(`SELECT * FROM incidents WHERE upper(code) = upper($1) AND status = 'published'`, [String(req.params.code)]);
      if (!i) return null;
      const linked = await ds.query(`SELECT s.code, s.title, left(s.body, 90) AS excerpt FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE s.incident_id = $1 AND ${VISIBLE} ORDER BY s.published_at DESC LIMIT 100`, [i.id]);
      const when = i.event_date ? new Date(i.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
      return {
        title: `${i.title} | ${SITE}`, description: String(i.summary).slice(0, 220), path: `/incidents/${i.code}`,
        jsonLd: { '@context': 'https://schema.org', '@type': 'Event', name: i.title, ...(i.event_date && { startDate: i.event_date }), ...(i.place_name && { location: { '@type': 'Place', name: i.place_name } }), description: i.summary, url: `${site()}/incidents/${i.code}` },
        body: `<article><p>Incident record ${esc(i.code)}</p><h1>${esc(i.title)}</h1><p>${[when && `${i.date_approximate ? 'About ' : ''}${when}`, i.place_name, i.water_body, i.vessel, i.incident_type].filter(Boolean).map(esc).join(' · ')}</p>
          <h2>What happened</h2><p>${esc(i.summary)}</p><h2>Outcome</h2><p>${esc(i.outcome)}</p><h2>Sources</h2><p>${esc(i.sources)}</p>
          <h2>Stories, testimonies and records</h2><ul>${linked.map((s: any) => `<li><a href="/stories/${esc(s.code)}">${esc(s.title || s.excerpt)}</a></li>`).join('') || '<li>None yet.</li>'}</ul></article>`,
      };
    }));
    http.get('/resources/:slug', wrap(async (req) => {
      const [r] = await ds.query(`SELECT * FROM resources WHERE slug = $1 AND status = 'published'`, [String(req.params.slug)]);
      if (!r) return null;
      return { title: `${r.title} | ${SITE}`, description: String(r.summary).slice(0, 220), path: `/resources/${r.slug}`,
        body: `<article><h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p>${String(r.body).split(/\n{2,}/).slice(0, 60).map((p: string) => `<p>${esc(p)}</p>`).join('')}</article>` };
    }));
    http.get('/collections/:id', wrap(async (req) => {
      if (!/^[0-9a-f-]{36}$/i.test(String(req.params.id))) return null;
      const [c] = await ds.query(`SELECT * FROM collections WHERE id = $1 AND status = 'published'`, [req.params.id]);
      if (!c) return null;
      const items = await ds.query(`SELECT s.code, s.title, left(s.body, 90) AS excerpt FROM collection_items ci JOIN stories s ON s.id = ci.story_id LEFT JOIN users au ON au.id = s.author_id WHERE ci.collection_id = $1 AND ${VISIBLE} ORDER BY ci.position`, [c.id]);
      return { title: `${c.title} | ${SITE}`, description: String(c.description).slice(0, 220), path: `/collections/${c.id}`,
        body: `<article><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p><ul>${items.map((s: any) => `<li><a href="/stories/${esc(s.code)}">${esc(s.title || s.excerpt)}</a></li>`).join('')}</ul></article>` };
    }));
    const lists: Record<string, () => Promise<Page>> = {
      '/incidents': async () => {
        const rows = await ds.query(`SELECT code, title, event_date, water_body FROM incidents WHERE status = 'published' ORDER BY event_date DESC NULLS LAST LIMIT 500`);
        return { title: `Incident records | ${SITE}`, description: 'Documented water-transport incidents on Kenya’s ocean coast, lakes and rivers, with the stories and records about each.', path: '/incidents',
          body: `<h1>Incident records</h1><ul>${rows.map((i: any) => `<li><a href="/incidents/${esc(i.code)}">${esc(i.title)}</a>${i.event_date ? `, ${new Date(i.event_date).getFullYear()}` : ''}${i.water_body ? `, ${esc(i.water_body)}` : ''}</li>`).join('')}</ul>` };
      },
      '/resources': async () => {
        const rows = await ds.query(`SELECT slug, title, summary FROM resources WHERE status = 'published' ORDER BY published_at DESC LIMIT 500`);
        return { title: `Learning resources | ${SITE}`, description: 'Policy briefs, learning summaries, educational materials, the contributor handbook and online exhibitions.', path: '/resources',
          body: `<h1>Learning resources</h1><ul>${rows.map((r: any) => `<li><a href="/resources/${esc(r.slug)}">${esc(r.title)}</a>: ${esc(r.summary)}</li>`).join('')}</ul>` };
      },
      '/collections': async () => {
        const rows = await ds.query(`SELECT id, title, description FROM collections WHERE status = 'published' ORDER BY published_at DESC LIMIT 200`);
        return { title: `Collections and exhibitions | ${SITE}`, description: 'Curated collections and online exhibitions of stories, photographs and records.', path: '/collections',
          body: `<h1>Collections and exhibitions</h1><ul>${rows.map((c: any) => `<li><a href="/collections/${esc(c.id)}">${esc(c.title)}</a>: ${esc(c.description)}</li>`).join('')}</ul>` };
      },
    };
    for (const [path, fn] of Object.entries(lists)) http.get(path, wrap(fn));
  }

  // The start page lists the latest stories, so the archive is readable and linkable without scripts.
  http.get(['/', '/index.html'], wrap(async () => {
    const rows = config.publicPreviews ? await ds.query(`SELECT s.code, s.title, left(s.body, 140) AS excerpt, s.place_name FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE ${VISIBLE} AND NOT s.sensitive ORDER BY s.trending_score DESC LIMIT 40`) : [];
    const h = home();
    return { ...h, body: `${h.body}<ul>${rows.map((s: any) => `<li><a href="/stories/${esc(s.code)}">${esc(s.title || s.excerpt)}</a>${s.place_name ? `, ${esc(s.place_name)}` : ''}</li>`).join('')}</ul>
      <p><a href="/incidents">Incident records</a> · <a href="/resources">Learning resources</a> · <a href="/collections">Collections</a></p>` };
  }));
}

/** Every other address of the website (profile, inbox, admin pages, …) opens the single-page app, which shows the right page. Registered after the static files. */
export function registerAppFallback(app: INestApplication) {
  const http = app.getHttpAdapter().getInstance();
  const indexFile = config.webDir ? join(config.webDir, 'index.html') : '';
  if (!indexFile || !existsSync(indexFile)) return;
  const version = (process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || String(Date.now())).slice(0, 12);
  http.get(/^\/(?!api\/|socket\.io\/|assets\/|og\/).*/, (req: Request, res: Response, next: NextFunction) => {
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
    const html = readFileSync(indexFile, 'utf8').replace(/__SITE_URL__/g, esc(config.siteUrl)).replace(/__V__/g, esc(version))
      .replace('<!--SEO-HEAD-->', `<title>${SITE}</title><meta name="robots" content="noindex">`).replace('<!--SEO-BODY-->', '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  });
}
