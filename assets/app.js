/* =====================================================================
   Maritime Safety Heritage Archive - CLICKABLE PROTOTYPE
   Single-page app in plain JavaScript. No server or database needed:
   data lives in the browser (localStorage) so the demo can be run by
   opening index.html. The full build replaces this with a secure API.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- State ---------- */
  const KEY = "msh-prototype-state";
  const SEED = window.MSH_SEED;
  const TYPES = SEED.types;
  const APP_MODE = new URLSearchParams(location.search).get("app") === "1";
  let S;

  function fresh() {
    const s = JSON.parse(JSON.stringify(SEED));
    s.session = null;
    s.prefs = { largeText: false, lowBw: false };
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === SEED.version) return s;
      }
    } catch (e) { /* storage unavailable: run in memory */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  S = load();

  /* ---------- Helpers ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const me = () => S.session && S.users.find((u) => u.id === S.session);
  const isAdmin = () => me() && me().role === "admin";
  const userById = (id) => S.users.find((u) => u.id === id) || { name: "Unknown", email: "" };
  const now = () => { const d = new Date(); return d.toISOString().slice(0, 10) + " " + d.toTimeString().slice(0, 5); };
  const today = () => new Date().toISOString().slice(0, 10);
  const published = () => S.records.filter((r) => r.status === "published");
  const nextRecordId = () => "MSH-" + String(Math.max(...S.records.map((r) => +r.id.split("-")[1])) + 1).padStart(4, "0");
  function logAct(what) { S.activity.unshift({ t: now(), who: me() ? me().name : "System", what }); save(); }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const words = q.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) return safe;
    return safe.replace(new RegExp("(" + words.join("|") + ")", "gi"), "<mark>$1</mark>");
  }
  function typeBadge(t) { const T = TYPES[t]; return `<span class="badge type" style="--c:${T.color}">${T.icon} ${T.label}</span>`; }
  function statusBadge(s) { return `<span class="badge status-${esc(s)}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`; }

  /* ---------- Generated placeholder artwork (stands in for real media) ---------- */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function art(rec, w = 800, h = 450, noLabel) {
    const s = hash(rec.id + rec.title);
    const sepia = rec.type === "photo" && rec.year < 1990;
    const palettes = {
      oral: ["#0b2a3f", "#0f766e", "#7dd3c0"],
      photo: sepia ? ["#4a3b28", "#8a6d45", "#e3cfa3"] : ["#123b57", "#2f7ea3", "#f2c48d"],
      record: ["#1e2f4f", "#3b5b8c", "#cbd8ea"],
      testimony: ["#2e1f47", "#6b4fa0", "#e2d4f5"]
    };
    const [a, b, c] = palettes[rec.type];
    const sunX = 120 + (s % 560), hor = 230 + (s % 60);
    let boats = "";
    const nb = 1 + (s % 3);
    for (let i = 0; i < nb; i++) {
      const x = 90 + ((s >> (i * 3)) % 600), y = hor + 30 + i * 28, k = 0.7 + i * 0.25;
      boats += `<g transform="translate(${x} ${y}) scale(${k})" fill="${a}" opacity=".9"><path d="M-60 0 L60 0 L42 18 L-44 18 Z"/>${rec.scene === "harbour" && i === 0 ? '<rect x="-20" y="-34" width="40" height="34"/><rect x="-6" y="-52" width="10" height="18"/>' : '<path d="M0 -70 L0 0 L36 0 Z" fill="' + c + '" opacity=".85"/><rect x="-2" y="-72" width="3" height="72"/>'}</g>`;
    }
    let waves = "";
    for (let i = 0; i < 6; i++) {
      const y = hor + 12 + i * 34;
      waves += `<path d="M0 ${y} Q 100 ${y - 8} 200 ${y} T 400 ${y} T 600 ${y} T 800 ${y}" stroke="${c}" stroke-opacity="${0.18 - i * 0.02}" stroke-width="3" fill="none"/>`;
    }
    const label = rec.type === "photo" ? "SAMPLE PHOTOGRAPH" : TYPES[rec.type].label.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="${w}" height="${h}">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
      <rect width="800" height="450" fill="url(#sky)"/>
      <circle cx="${sunX}" cy="${hor - 40}" r="46" fill="${c}" opacity=".55"/>
      <path d="M0 ${hor} L 140 ${hor - 22} L 260 ${hor - 8} L 400 ${hor - 30} L 520 ${hor - 6} L 800 ${hor - 18} L 800 ${hor} Z" fill="${a}" opacity=".55"/>
      <rect y="${hor}" width="800" height="${450 - hor}" fill="url(#sea)"/>${waves}${boats}
      ${noLabel ? "" : `<text x="24" y="430" font-family="Arial" font-size="15" letter-spacing="3" fill="#fff" opacity=".55">${label} · ${rec.id}</text>`}
      ${sepia ? '<rect width="800" height="450" fill="#704214" opacity=".12"/>' : ""}
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------- Search ---------- */
  function searchText(r) {
    const extra = (r.transcript || []).map((x) => x[1]).join(" ") + " " + (r.body || "") + " " + (r.pages || []).join(" ");
    return [r.id, r.title, r.summary, r.place, r.county, r.waterBody, r.tags.join(" "), r.creator, r.language, String(r.year), extra].join(" ").toLowerCase();
  }
  function runSearch(opts) {
    const q = (opts.q || "").trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let list = published().map((r) => {
      const txt = searchText(r);
      let score = 0;
      for (const w of words) {
        if (!txt.includes(w)) return null;
        if (r.title.toLowerCase().includes(w)) score += 5;
        if (r.tags.join(" ").toLowerCase().includes(w)) score += 3;
        score += 1;
      }
      return { r, score };
    }).filter(Boolean);
    if (opts.types && opts.types.length) list = list.filter((x) => opts.types.includes(x.r.type));
    if (opts.waters && opts.waters.length) list = list.filter((x) => opts.waters.includes(x.r.waterBody));
    if (opts.decade) list = list.filter((x) => Math.floor(x.r.year / 10) * 10 === +opts.decade);
    if (opts.county) list = list.filter((x) => x.r.county === opts.county);
    const sort = opts.sort || (q ? "relevance" : "newest");
    list.sort((a, b) => sort === "relevance" ? b.score - a.score :
      sort === "oldest" ? a.r.year - b.r.year :
      sort === "popular" ? b.r.views - a.r.views : b.r.year - a.r.year);
    return list.map((x) => x.r);
  }
  function snippet(r, q) {
    if (!q) return esc(r.summary);
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const pool = [r.summary, ...(r.transcript || []).map((x) => x[1]), r.body || "", ...(r.pages || [])];
    const hit = pool.find((p) => words.some((w) => p.toLowerCase().includes(w))) || r.summary;
    return highlight(hit.length > 220 ? hit.slice(0, 220) + "…" : hit, q);
  }

  /* ---------- Router ---------- */
  function parse() {
    const h = location.hash.replace(/^#/, "") || "/home";
    const [path, qs] = h.split("?");
    return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  }
  function go(h) { location.hash = h; }
  const PUBLIC = ["home", "about", "contact", "login", "app"];

  let cleanup = [];
  function render() {
    cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
    const { parts, q } = parse();
    const page = parts[0] || "home";
    if (!PUBLIC.includes(page) && !me()) { S.afterLogin = location.hash; save(); return go("#/login"); }
    if (page === "admin" && !isAdmin()) { toast("Admins only: sign in with an admin account."); return go("#/home"); }
    const view = ROUTES[page] || ROUTES.notfound;
    document.title = (view.title ? view.title + " · " : "") + "Maritime Safety Heritage Archive";
    renderShell(page);
    $("#main").innerHTML = view.html(parts, q);
    if (view.after) view.after(parts, q);
    if (!view.keepScroll) window.scrollTo(0, 0);
    $("#main").focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", render);

  /* ---------- Shell (header / footer / tab bar) ---------- */
  function renderShell(page) {
    const u = me();
    const navLink = (h, label, key) => `<a href="#/${h}" class="${page === key ? "active" : ""}">${label}</a>`;
    $("#nav").innerHTML = [
      navLink("home", "Home", "home"),
      navLink("browse", "Browse", "browse"),
      navLink("map", "Map", "map"),
      navLink("submit", "Contribute", "submit"),
      navLink("about", "About", "about"),
      navLink("app", "📱 App", "app"),
      u && u.role === "admin" ? navLink("admin", "Admin", "admin") : "",
      u ? `<a href="#/profile" class="user-chip ${page === "profile" ? "active" : ""}"><span class="avatar">${initials(u.name)}</span>${esc(u.name.split(" ")[0])}${u.role === "admin" ? ' <span class="role-pill">Admin</span>' : ""}</a>
           <a href="#" id="logout" class="small">Sign out</a>`
        : `<a href="#/login" class="btn buoy sm">Sign in</a>`
    ].join("");
    $("#nav").classList.remove("open");
    const lo = $("#logout");
    if (lo) lo.onclick = (e) => { e.preventDefault(); logAct("signed out"); S.session = null; save(); toast("Signed out"); go("#/home"); };
    $("#tabbar").innerHTML = [
      ["home", "🏠", "Home"], ["browse", "🔎", "Search"], ["map", "🗺️", "Map"], ["submit", "➕", "Share"],
      [u && u.role === "admin" ? "admin" : (u ? "profile" : "login"), "👤", u ? (u.role === "admin" ? "Admin" : "Me") : "Sign in"]
    ].map(([h, i, l]) => `<a href="#/${h}" class="${page === h ? "active" : ""}"><span>${i}</span>${l}</a>`).join("");
    $("#lt").setAttribute("aria-pressed", S.prefs.largeText);
    $("#lb").setAttribute("aria-pressed", S.prefs.lowBw);
    document.documentElement.classList.toggle("large-text", S.prefs.largeText);
    document.body.classList.toggle("low-bw", S.prefs.lowBw);
  }

  /* ---------- Reusable pieces ---------- */
  function recCard(r, q) {
    return `<a class="card rec-card" href="#/record/${r.id}">
      <div class="thumb"><img src="${art(r, 480, 270)}" alt="${esc(TYPES[r.type].label)}: ${esc(r.title)}" loading="lazy"><span class="type-flag">${typeBadge(r.type)}</span></div>
      <div class="body">
        <h3>${highlight(r.title, q)}</h3>
        <p>${snippet(r, q)}</p>
        <div class="meta-line"><span>📍 ${esc(r.place)}</span><span>🗓️ ${r.year}</span>${r.duration ? `<span>⏱️ ${fmt(r.duration)}</span>` : ""}</div>
      </div></a>`;
  }
  const wavesSvg = `<svg class="waves" viewBox="0 0 1440 120" preserveAspectRatio="none" width="100%" height="90" aria-hidden="true"><path d="M0 60 Q 180 20 360 60 T 720 60 T 1080 60 T 1440 60 V120 H0Z" fill="#12405c"/><path d="M0 80 Q 180 50 360 80 T 720 80 T 1080 80 T 1440 80 V120 H0Z" fill="#f6f1e7"/></svg>`;

  /* ---------- Pages ---------- */
  const ROUTES = {};

  ROUTES.home = {
    html() {
      const pub = published();
      const counts = Object.keys(TYPES).map((t) => [t, pub.filter((r) => r.type === t).length]);
      const featured = [...pub].sort((a, b) => b.views - a.views).slice(0, 6);
      const u = me();
      return `
      <section class="hero">
        <div class="wrap">
          <div class="eyebrow" style="color:#7dd3c0">Remembering the Waters · Kenya</div>
          <h1>Kenya's memory of the water, preserved so its safety lessons are never lost.</h1>
          <p class="lead">Oral histories, photographs, records and testimonies from the Indian Ocean coast, the great lakes and the rivers, open to communities, researchers, educators and policymakers.</p>
          <form class="search-big" id="heroSearch" role="search">
            <label for="hq" class="sr">Search the archive</label>
            <input id="hq" placeholder="Search stories, places, years… e.g. ferry, Lake Turkana, life jackets">
            <button class="btn buoy">Search</button>
          </form>
          <div class="stats-strip">
            <div><b>${pub.length}</b><span>Items in the archive</span></div>
            <div><b>${new Set(pub.map((r) => r.county)).size}</b><span>Counties represented</span></div>
            <div><b>${new Set(pub.map((r) => r.waterBody)).size}</b><span>Waters covered</span></div>
            <div><b>${Math.round(pub.filter((r) => r.duration).reduce((a, r) => a + r.duration, 0) / 60)} min</b><span>Recorded voices</span></div>
          </div>
        </div>${wavesSvg}
      </section>
      <div class="wrap">
        ${u ? "" : `<div class="card pad row" style="margin-bottom:22px;border-left:4px solid var(--buoy)"><div><b>Sign in to explore the archive.</b> <span class="muted">Every visitor signs in with their own account, on the website or the app.</span></div><span class="spacer"></span><a class="btn" href="#/login">Sign in or create account</a></div>`}
        <div class="eyebrow">What the archive holds</div>
        <h2>Four kinds of heritage, one search</h2>
        <div class="grid g4" style="margin-bottom:38px">
          ${counts.map(([t, n]) => `<a class="card type-tile" style="--c:${TYPES[t].color}" href="#/browse?type=${t}"><span class="ico">${TYPES[t].icon}</span><b>${TYPES[t].label}s</b><span class="muted small">${n} item${n === 1 ? "" : "s"}</span></a>`).join("")}
        </div>
        <div class="row" style="margin-bottom:12px"><div><div class="eyebrow">Most visited</div><h2 style="margin:0">Featured from the collection</h2></div><span class="spacer"></span><a href="#/browse" class="btn ghost">Browse everything →</a></div>
        <div class="grid g3" style="margin-bottom:38px">${featured.map((r) => recCard(r)).join("")}</div>
        <div class="grid g2">
          <div class="card pad">
            <div class="eyebrow">Incident map</div>
            <h2>Where the stories happened</h2>
            <p class="muted">Every item is placed on the map, from Likoni to Lake Turkana, so you can explore the heritage of the waters near you.</p>
            <a class="btn" href="#/map">Open the map 🗺️</a>
          </div>
          <div class="card pad">
            <div class="eyebrow">Contribute</div>
            <h2>Share a story or a photograph</h2>
            <p class="muted">Families and communities hold much of this history. Submit a recording, photo or document; the research team reviews it before it is published.</p>
            <a class="btn buoy" href="#/submit">Submit material</a>
          </div>
        </div>
      </div>`;
    },
    after() {
      $("#heroSearch").onsubmit = (e) => { e.preventDefault(); go("#/browse?q=" + encodeURIComponent($("#hq").value)); };
    }
  };

  ROUTES.browse = {
    title: "Browse & search",
    html(parts, qs) {
      const opts = {
        q: qs.get("q") || "", types: qs.getAll("type"), waters: qs.getAll("water"),
        decade: qs.get("decade") || "", county: qs.get("county") || "", sort: qs.get("sort") || ""
      };
      const res = runSearch(opts);
      const per = 9, pageN = Math.max(1, +qs.get("page") || 1), pages = Math.max(1, Math.ceil(res.length / per));
      const shown = res.slice((pageN - 1) * per, pageN * per);
      const pub = published();
      const decades = [...new Set(pub.map((r) => Math.floor(r.year / 10) * 10))].sort();
      const counties = [...new Set(pub.map((r) => r.county))].sort();
      const chk = (name, val, label, on, n) => `<label class="check"><input type="checkbox" data-f="${name}" value="${esc(val)}" ${on ? "checked" : ""}> ${label} <span class="muted small">(${n})</span></label>`;
      const active = [...opts.types.map((t) => TYPES[t].label), ...opts.waters, opts.decade && opts.decade + "s", opts.county].filter(Boolean);
      return `<div class="wrap">
        <form id="sform" class="search-big" style="max-width:none;margin:0 0 20px;box-shadow:var(--shadow);border:1px solid var(--line)" role="search">
          <label for="q" class="sr">Search</label>
          <input id="q" value="${esc(opts.q)}" placeholder="Full-text search across titles, transcripts, documents and tags">
          <button class="btn">Search</button>
        </form>
        <div class="browse">
          <aside class="card pad filters" aria-label="Filters">
            <h3>Type of material</h3>
            ${Object.keys(TYPES).map((t) => chk("type", t, TYPES[t].icon + " " + TYPES[t].label, opts.types.includes(t), pub.filter((r) => r.type === t).length)).join("")}
            <h3>Water body</h3>
            ${SEED.waterBodies.map((w) => chk("water", w, w, opts.waters.includes(w), pub.filter((r) => r.waterBody === w).length)).join("")}
            <h3>Decade</h3>
            <select data-f="decade"><option value="">Any decade</option>${decades.map((d) => `<option ${+opts.decade === d ? "selected" : ""} value="${d}">${d}s</option>`).join("")}</select>
            <h3>County</h3>
            <select data-f="county"><option value="">Any county</option>${counties.map((c) => `<option ${opts.county === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
            <p style="margin-top:16px"><a href="#/browse" class="small">Clear all filters</a></p>
          </aside>
          <section aria-live="polite">
            <div class="results-head">
              <b>${res.length} result${res.length === 1 ? "" : "s"}</b>${opts.q ? `<span class="muted">for “${esc(opts.q)}”</span>` : ""}
              ${active.map((a) => `<span class="badge">${esc(a)}</span>`).join("")}
              <span class="spacer"></span>
              <label for="sort" class="sr">Sort</label>
              <select id="sort" data-f="sort">
                ${[["", opts.q ? "Most relevant" : "Newest first"], ["relevance", "Most relevant"], ["newest", "Newest first"], ["oldest", "Oldest first"], ["popular", "Most viewed"]].filter((x, i, a) => i === 0 || x[1] !== a[0][1]).map(([v, l]) => `<option value="${v}" ${opts.sort === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>
            ${!opts.q ? `<div class="chip-row"><span class="muted small">Try:</span>${["life jackets", "ferry", "wind", "rescue", "children", "rules"].map((s) => `<button class="chip" data-try="${s}">${s}</button>`).join("")}</div>` : ""}
            ${shown.length ? `<div class="grid g3">${shown.map((r) => recCard(r, opts.q)).join("")}</div>` :
              `<div class="card empty"><div style="font-size:2rem">🌊</div><h3>No items match</h3><p>Try fewer words or clear some filters.</p></div>`}
            ${pages > 1 ? `<nav class="pager" aria-label="Pages">${Array.from({ length: pages }, (_, i) => `<button class="btn ${i + 1 === pageN ? "" : "ghost"} sm" data-page="${i + 1}">${i + 1}</button>`).join("")}</nav>` : ""}
          </section>
        </div></div>`;
    },
    after(parts, qs) {
      const build = (extra = {}) => {
        const p = new URLSearchParams();
        const q = $("#q").value.trim(); if (q) p.set("q", q);
        $$("[data-f=type]:checked").forEach((c) => p.append("type", c.value));
        $$("[data-f=water]:checked").forEach((c) => p.append("water", c.value));
        ["decade", "county", "sort"].forEach((k) => { const v = $(`[data-f=${k}]`).value; if (v) p.set(k, v); });
        for (const k in extra) p.set(k, extra[k]);
        go("#/browse?" + p.toString());
      };
      $("#sform").onsubmit = (e) => { e.preventDefault(); build(); };
      $$("[data-f]").forEach((el) => (el.onchange = () => build()));
      $$("[data-try]").forEach((b) => (b.onclick = () => { $("#q").value = b.dataset.try; build(); }));
      $$("[data-page]").forEach((b) => (b.onclick = () => build({ page: b.dataset.page })));
    }
  };

  ROUTES.record = {
    title: "Record",
    html(parts) {
      const r = S.records.find((x) => x.id === parts[1]);
      if (!r || (r.status !== "published" && !isAdmin())) return `<div class="wrap narrow"><div class="card empty"><h2>Item not found</h2><p>It may have been unpublished.</p><a class="btn" href="#/browse">Back to the archive</a></div></div>`;
      if (!ROUTES.record._counted || ROUTES.record._counted !== r.id) { r.views++; save(); ROUTES.record._counted = r.id; }
      const related = published().filter((x) => x.id !== r.id && (x.waterBody === r.waterBody || x.tags.some((t) => r.tags.includes(t)))).slice(0, 3);
      let media = "";
      if (r.format === "audio") {
        media = `<div class="player" id="player"><div class="ctrl"><button class="play" id="playBtn" aria-label="Play">▶</button>
          <div class="wave" id="wave" aria-hidden="true">${Array.from({ length: 70 }, (_, i) => `<i style="height:${18 + (hash(r.id + i) % 82)}%"></i>`).join("")}</div>
          <span class="time" id="time">0:00 / ${fmt(r.duration)}</span></div>
          <p class="small" style="margin:12px 0 0;color:#a9c4d2">🎙️ Oral history audio · sample playback for the prototype (the full build streams the real recording)</p></div>`;
      } else if (r.format === "video") {
        media = `<div class="video-frame"><img src="${art(r, 800, 450, true)}" alt="Video still: ${esc(r.title)}"><div class="subs" id="subs">${esc(r.transcript[0][1])}</div>
          <div class="vbar"><button class="play" id="playBtn" aria-label="Play">▶</button><div class="track" id="wave"><b id="vprog"></b></div><span class="time" id="time">0:00 / ${fmt(r.duration)}</span></div>
          <span class="watermark" style="top:10px;bottom:auto">© Remembering the Waters</span></div>`;
      } else if (r.format === "image") {
        media = `<div class="media-box"><img class="media-img" src="${art(r, 1200, 675)}" alt="${esc(r.summary)}"><span class="watermark">© Remembering the Waters · ${r.id}</span></div>`;
      } else if (r.format === "document") {
        media = `<div class="scan">${r.pages.map((p) => `<p>${esc(p)}</p>`).join("")}<span class="stamp">ARCHIVE COPY</span></div>`;
      } else {
        media = `<blockquote class="quote">${esc(r.body)}</blockquote>`;
      }
      const transcript = r.transcript ? `<div class="card pad transcript"><div class="row"><h3 style="margin:0">Transcript</h3><span class="spacer"></span><span class="muted small">Click a line to jump to it</span></div>
        <div style="margin-top:10px">${r.transcript.map(([t, line]) => `<p data-t="${t}"><span class="ts">${fmt(t)}</span>${esc(line)}</p>`).join("")}</div></div>` : "";
      const metaRows = [
        ["Identifier", r.id], ["Type", TYPES[r.type].label], ["Date", r.year], ["Place", r.place], ["County", r.county], ["Water body", r.waterBody],
        ["Narrator", r.narrator], ["Interviewer", r.interviewer], ["Photographer", r.photographer], ["Creator", r.creator],
        ["Language", r.language], ["Duration", r.duration && fmt(r.duration)], ["Consent", r.consent], ["Rights", r.rights], ["Added", r.added]
      ].filter((x) => x[1]);
      return `<div class="wrap">
        <p class="small"><a href="#/browse">← Back to results</a></p>
        ${r.status !== "published" ? `<div class="card pad" style="background:#fff8e6;margin-bottom:16px">⚠️ This item is <b>${r.status}</b> and only visible to admins. <a href="#/admin/edit/${r.id}">Edit</a></div>` : ""}
        <div class="record-layout">
          <article>
            <div class="row" style="margin-bottom:8px">${typeBadge(r.type)}<span class="muted small">${r.id} · ${r.views.toLocaleString()} views</span></div>
            <h1 style="font-size:2rem">${esc(r.title)}</h1>
            <p class="muted" style="font-size:1.05rem">${esc(r.summary)}</p>
            ${media}
            ${transcript}
            <div class="row" style="margin-top:18px">
              <button class="btn ghost sm" id="cite">❝ Cite this item</button>
              <button class="btn ghost sm" id="share">🔗 Copy link</button>
              ${isAdmin() ? `<a class="btn ghost sm" href="#/admin/edit/${r.id}">✏️ Edit (admin)</a>` : ""}
            </div>
          </article>
          <aside class="grid" style="gap:16px">
            <div class="card pad"><h3>Catalogue record</h3><dl class="meta">${metaRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
              <h3 style="margin-top:16px">Subjects</h3><div class="tags">${r.tags.map((t) => `<a class="tag" href="#/browse?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div></div>
            <div class="card pad"><h3>Location</h3><div class="mini-map" id="miniMap"></div><p class="small muted" style="margin:8px 0 0">📍 ${esc(r.place)}, ${esc(r.county)} County</p></div>
            <div class="licence">© Remembering the Waters and contributors. Shared under <b>${esc(r.rights)}</b>. Please credit the archive and the item identifier when reusing.</div>
          </aside>
        </div>
        ${related.length ? `<h2 style="margin-top:40px">Related items</h2><div class="grid g3">${related.map((x) => recCard(x)).join("")}</div>` : ""}
      </div>`;
    },
    after(parts) {
      const r = S.records.find((x) => x.id === parts[1]);
      if (!r) return;
      if (r.duration) setupPlayer(r);
      drawMap($("#miniMap"), [r], { zoom: 8, center: [r.lat, r.lng], mini: true });
      $("#cite").onclick = () => {
        const c = `${r.narrator || r.creator}. “${r.title}.” ${r.year}. Maritime Safety Heritage Archive, Remembering the Waters, ${r.id}.`;
        modal(`<h3>Cite this item</h3><p class="muted small">Suggested citation:</p><p class="card pad" style="font-family:var(--serif)">${esc(c)}</p><button class="btn" data-close>Done</button>`);
      };
      $("#share").onclick = () => { try { navigator.clipboard.writeText(location.href); } catch (e) {} toast("Link copied"); };
    }
  };

  function setupPlayer(r) {
    let t = 0, playing = false, iv = null;
    const SPEED = 6; // prototype plays at 6x so a demo moves along
    const btn = $("#playBtn"), time = $("#time"), bars = $$("#wave i"), prog = $("#vprog"), subs = $("#subs");
    const lines = $$(".transcript p[data-t]");
    function paint() {
      const f = t / r.duration;
      time.textContent = fmt(t) + " / " + fmt(r.duration);
      bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < f));
      if (prog) prog.style.width = f * 100 + "%";
      let cur = 0; r.transcript.forEach(([s], i) => { if (t >= s) cur = i; });
      lines.forEach((l, i) => l.classList.toggle("now", i === cur && (playing || t > 0)));
      if (subs) subs.textContent = r.transcript[cur][1];
    }
    function stop() { playing = false; clearInterval(iv); btn.textContent = "▶"; btn.setAttribute("aria-label", "Play"); }
    function play() {
      playing = true; btn.textContent = "❚❚"; btn.setAttribute("aria-label", "Pause");
      iv = setInterval(() => { t += 0.25 * SPEED; if (t >= r.duration) { t = r.duration; stop(); } paint(); }, 250);
    }
    btn.onclick = () => (playing ? stop() : play());
    $("#wave").onclick = (e) => { const b = e.currentTarget.getBoundingClientRect(); t = ((e.clientX - b.left) / b.width) * r.duration; paint(); };
    lines.forEach((l) => (l.onclick = () => { t = +l.dataset.t; paint(); if (!playing) play(); }));
    cleanup.push(stop);
    paint();
  }

  /* ---------- Map (Leaflet + OpenStreetMap, with offline fallback) ---------- */
  function pinIcon(r) {
    return window.L.divIcon({ className: "", html: `<div class="pin" style="background:${TYPES[r.type].color}"><span>${TYPES[r.type].icon}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] });
  }
  function drawMap(el, recs, o = {}) {
    if (!el) return null;
    if (window.L) {
      const m = window.L.map(el, { scrollWheelZoom: !o.mini, zoomControl: !o.mini, attributionControl: !o.mini }).setView(o.center || [0.2, 37.6], o.zoom || 6);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(m);
      const markers = {};
      recs.forEach((r) => {
        markers[r.id] = window.L.marker([r.lat, r.lng], { icon: pinIcon(r), title: r.title }).addTo(m)
          .bindPopup(`${typeBadge(r.type)}<br><b>${esc(r.title)}</b><br><span class="muted">${esc(r.place)} · ${r.year}</span><br><a href="#/record/${r.id}">Open item →</a>`);
      });
      setTimeout(() => m.invalidateSize(), 60);
      cleanup.push(() => m.remove());
      return { map: m, markers, focus: (id) => { const r = recs.find((x) => x.id === id); m.setView([r.lat, r.lng], 9); markers[id].openPopup(); } };
    }
    // Offline fallback: simple plot of Kenya's bounding box
    const B = { n: 5.0, s: -4.9, w: 33.8, e: 41.9 };
    const pos = (r) => [((r.lng - B.w) / (B.e - B.w)) * 100, ((B.n - r.lat) / (B.n - B.s)) * 100];
    el.innerHTML = `<div class="fallback-map">
      ${[["Lake Victoria", -0.6, 33.9], ["Lake Turkana", 3.9, 35.9], ["Indian Ocean", -3.4, 40.6], ["Nairobi", -1.29, 36.82]].map(([n, la, ln]) => { const [x, y] = pos({ lat: la, lng: ln }); return `<span class="fm-label" style="left:${x}%;top:${y}%">${n}</span>`; }).join("")}
      ${recs.map((r) => { const [x, y] = pos(r); return `<a class="fm-pin" href="#/record/${r.id}" title="${esc(r.title)}" style="left:${x}%;top:${y}%">📍</a>`; }).join("")}
      <span class="fm-label" style="left:8px;bottom:6px;font-style:normal">Offline map view (connect to the internet for the full map)</span></div>`;
    return { focus: (id) => go("#/record/" + id) };
  }

  ROUTES.map = {
    title: "Incident map",
    keepScroll: false,
    html(parts, qs) {
      const t = qs.get("type") || "";
      const recs = published().filter((r) => !t || r.type === t);
      return `<div class="map-page"><div id="bigmap" role="region" aria-label="Map of archive items"></div>
        <aside class="map-side"><h2 style="font-size:1.3rem">Incident map</h2>
          <p class="small muted">Every archive item is pinned where it happened. Select an item to fly to it.</p>
          <div class="chip-row"><button class="chip" data-t="" style="${!t ? "border-color:var(--sea);font-weight:700" : ""}">All</button>${Object.keys(TYPES).map((k) => `<button class="chip" data-t="${k}" style="${t === k ? "border-color:var(--sea);font-weight:700" : ""}">${TYPES[k].icon} ${TYPES[k].label}</button>`).join("")}</div>
          ${recs.map((r) => `<div class="map-item" data-id="${r.id}" tabindex="0"><b>${esc(r.title)}</b><span class="small muted">${TYPES[r.type].icon} ${esc(r.place)} · ${r.year}</span></div>`).join("")}
        </aside></div>`;
    },
    after(parts, qs) {
      const t = qs.get("type") || "";
      const recs = published().filter((r) => !t || r.type === t);
      const m = drawMap($("#bigmap"), recs, {});
      $$(".map-item").forEach((el) => {
        const f = () => { $$(".map-item").forEach((x) => x.classList.remove("on")); el.classList.add("on"); m && m.focus(el.dataset.id); };
        el.onclick = f; el.onkeydown = (e) => { if (e.key === "Enter") f(); };
      });
      $$("[data-t]").forEach((b) => (b.onclick = () => go("#/map" + (b.dataset.t ? "?type=" + b.dataset.t : ""))));
      $("footer").style.display = "none";
      cleanup.push(() => ($("footer").style.display = ""));
    }
  };

  ROUTES.submit = {
    title: "Contribute",
    html() {
      const mine = S.submissions.filter((s) => s.by === S.session);
      return `<div class="wrap narrow">
        <div class="eyebrow">Contribute</div><h1>Share a story or material</h1>
        <p class="muted">Your submission goes to the research team for review. They check consent and catalogue it before it appears in the archive.</p>
        <form class="card pad" id="subForm">
          <div class="field"><label for="st">Title</label><input id="st" required placeholder="e.g. My grandfather's fishing boat at Mbita"></div>
          <div class="grid g2"><div class="field"><label for="sty">Type of material</label><select id="sty">${Object.keys(TYPES).map((t) => `<option value="${t}">${TYPES[t].label}</option>`).join("")}</select></div>
          <div class="field"><label for="sy">Year (approximate)</label><input id="sy" type="number" min="1900" max="2026" placeholder="e.g. 1985"></div></div>
          <div class="grid g2"><div class="field"><label for="sw">Water body</label><select id="sw">${SEED.waterBodies.map((w) => `<option>${w}</option>`).join("")}</select></div>
          <div class="field"><label for="sp">Place</label><input id="sp" placeholder="Beach, village or town"></div></div>
          <div class="field"><label for="sd">Tell us about it</label><textarea id="sd" required placeholder="Who, what, when, and the safety lesson it holds"></textarea></div>
          <div class="field"><label>File</label><div class="dropzone" id="drop" tabindex="0">📎 <b>Drop a file here</b> or click to choose<br><span class="small muted">Audio, video, photo or PDF · max 500 MB in the full build</span><div id="fname" class="small" style="margin-top:6px;color:var(--sea)"></div></div><input type="file" id="sf" hidden></div>
          <label class="check field"><input type="checkbox" id="sc" required> I have the right to share this material and everyone recorded or pictured has given consent.</label>
          <button class="btn buoy">Submit for review</button>
        </form>
        ${mine.length ? `<h2 style="margin-top:34px">Your submissions</h2><div class="card"><table class="tbl"><thead><tr><th>Title</th><th>Sent</th><th>Status</th></tr></thead><tbody>${mine.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.date}</td><td>${statusBadge(s.status)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>`;
    },
    after() {
      let fileName = "";
      const pick = (f) => { if (f) { fileName = f.name; $("#fname").textContent = "Selected: " + f.name; } };
      dropzone($("#drop"), $("#sf"), pick);
      $("#subForm").onsubmit = (e) => {
        e.preventDefault();
        const s = { id: "SUB-" + (100 + S.submissions.length + 1), by: S.session, date: today(), status: "pending",
          title: $("#st").value.trim(), type: $("#sty").value, year: +$("#sy").value || null, waterBody: $("#sw").value,
          place: $("#sp").value.trim(), county: "", description: $("#sd").value.trim(), file: fileName || "(no file attached)", consent: true };
        S.submissions.unshift(s); logAct(`submitted '${s.title}' for review`); save();
        toast("Thanks! Your submission is with the research team."); render();
      };
    }
  };
  function dropzone(zone, input, cb) {
    zone.onclick = () => input.click();
    zone.onkeydown = (e) => { if (e.key === "Enter") input.click(); };
    input.onchange = () => cb(input.files[0]);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag"); };
    zone.ondragleave = () => zone.classList.remove("drag");
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drag"); cb(e.dataTransfer.files[0]); };
  }

  ROUTES.contact = {
    title: "Contact",
    html() {
      const u = me();
      return `<div class="wrap narrow"><div class="eyebrow">Contact</div><h1>Get in touch with the research team</h1>
        <p class="muted">Questions about the archive, reusing material, or a story you would like the team to record.</p>
        <form class="card pad" id="cForm">
          <div class="grid g2"><div class="field"><label for="cn">Your name</label><input id="cn" required value="${esc(u ? u.name : "")}"></div>
          <div class="field"><label for="ce">Email</label><input id="ce" type="email" required value="${esc(u ? u.email : "")}"></div></div>
          <div class="field"><label for="cs">Subject</label><input id="cs" required></div>
          <div class="field"><label for="cb">Message</label><textarea id="cb" required></textarea></div>
          <button class="btn">Send message</button></form></div>`;
    },
    after() {
      $("#cForm").onsubmit = (e) => {
        e.preventDefault();
        S.messages.unshift({ id: "M" + Date.now(), name: $("#cn").value, email: $("#ce").value, subject: $("#cs").value, body: $("#cb").value, date: today(), read: false });
        save(); toast("Message sent. The team usually replies within 3 working days."); go("#/home");
      };
    }
  };

  ROUTES.about = {
    title: "About",
    html() {
      return `<div class="wrap narrow">
        <div class="eyebrow">About the archive</div><h1>Remembering the Waters</h1>
        <p style="font-size:1.1rem">Kenya's first national digital archive of maritime and inland-water safety heritage. The research team gathers oral histories, photographs, historical records, reports and testimonies so their lessons stay available to communities, researchers, policymakers, educators and the public.</p>
        <div class="grid g2" style="margin:26px 0">
          <div class="card pad"><h3>🌍 Open access</h3><p class="muted small">Free to everyone with an account, on the web and on the Android and iOS app.</p></div>
          <div class="card pad"><h3>🔒 Respectful by design</h3><p class="muted small">Every item carries consent and rights information. Narrators can be anonymised.</p></div>
          <div class="card pad"><h3>🗂️ Properly catalogued</h3><p class="muted small">Standard metadata (identifier, date, place, creator, language, rights, subjects) for long-term preservation.</p></div>
          <div class="card pad"><h3>📶 Low-bandwidth friendly</h3><p class="muted small">Use the “Light” switch at the top to hide images on slow connections.</p></div>
        </div>
        <h2>Project timeline</h2>
        <div class="card"><table class="tbl"><thead><tr><th>Phase</th><th>When</th><th>Delivers</th></tr></thead><tbody>
          <tr><td>1. Discovery &amp; design</td><td>Month 12</td><td>Approved prototype (this) and metadata schema</td></tr>
          <tr><td>2. Build</td><td>Months 13–14</td><td>Working website and app on a test site</td></tr>
          <tr><td>3. Content &amp; testing</td><td>Months 14–15</td><td>Populated and tested archive</td></tr>
          <tr><td>4. Launch &amp; handover</td><td>Month 16</td><td>Live archive, documentation and full ownership</td></tr>
        </tbody></table></div>
        <p class="muted small" style="margin-top:20px">Developer: Francis Mutuku · contactfrancismutuku@gmail.com · <a href="#/contact">Contact the team</a></p>
      </div>`;
    }
  };

  ROUTES.login = {
    title: "Sign in",
    html() {
      return `<div class="auth"><div class="auth-art">${wavesSvg.replace('class="waves"', 'class="waves" style="position:absolute;left:0;right:0;top:0;transform:scaleY(-1)"')}
        <h2>“The water does not care how late you are.”</h2><p>From an oral history recorded at the Likoni crossing (sample).</p></div>
        <div class="auth-form"><div class="card pad">
          <div class="tabs" role="tablist"><button class="on" data-tab="in" role="tab">Sign in</button><button data-tab="up" role="tab">Create account</button></div>
          <form id="inForm"><div class="field"><label for="le">Email</label><input id="le" type="email" required autocomplete="username"></div>
            <div class="field"><label for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"></div>
            <div id="lerr" class="small" style="color:var(--bad);margin-bottom:8px"></div>
            <button class="btn" style="width:100%;justify-content:center">Sign in</button>
            <p class="small" style="margin:10px 0 0"><a href="#" id="forgot">Forgot password?</a></p></form>
          <form id="upForm" hidden><div class="field"><label for="un">Full name</label><input id="un" required></div>
            <div class="field"><label for="ue">Email</label><input id="ue" type="email" required></div>
            <div class="field"><label for="uo">Organisation or community (optional)</label><input id="uo"></div>
            <div class="field"><label for="up">Password</label><input id="up" type="password" minlength="8" required><div class="hint">At least 8 characters.</div></div>
            <button class="btn buoy" style="width:100%;justify-content:center">Create account</button></form>
          <div class="demo-box"><b>Prototype demo accounts</b><br>
            <button class="btn sm ghost" data-demo="researcher@demo.ke" style="margin-top:6px">Sign in as researcher (user)</button>
            <button class="btn sm ghost" data-demo="admin@demo.ke" style="margin-top:6px">Sign in as admin</button></div>
        </div></div></div>`;
    },
    after() {
      $$("[data-tab]").forEach((b) => (b.onclick = () => {
        $$("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
        $("#inForm").hidden = b.dataset.tab !== "in"; $("#upForm").hidden = b.dataset.tab !== "up";
      }));
      const finish = (u) => {
        S.session = u.id; logAct("signed in"); const back = S.afterLogin; S.afterLogin = null; save();
        toast("Welcome, " + u.name.split(" ")[0]); go(back && back !== "#/login" ? back : (u.role === "admin" ? "#/admin" : "#/browse"));
      };
      const attempt = (email, pw) => {
        const u = S.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
        if (!u || u.password !== pw) return ($("#lerr").textContent = "Email or password is incorrect.");
        if (u.status === "suspended") return ($("#lerr").textContent = "This account is suspended. Contact the research team.");
        finish(u);
      };
      $("#inForm").onsubmit = (e) => { e.preventDefault(); attempt($("#le").value.trim(), $("#lp").value); };
      $$("[data-demo]").forEach((b) => (b.onclick = () => {
        const u = S.users.find((x) => x.email === b.dataset.demo);
        $("#le").value = u.email; $("#lp").value = u.password; attempt(u.email, u.password);
      }));
      $("#upForm").onsubmit = (e) => {
        e.preventDefault();
        const email = $("#ue").value.trim();
        if (S.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return toast("An account with that email already exists.");
        const u = { id: "U" + (S.users.length + 1) + Date.now() % 1000, name: $("#un").value.trim(), email, password: $("#up").value, role: "user", status: "active", joined: today(), org: $("#uo").value.trim() };
        S.users.push(u); save(); finish(u);
      };
      $("#forgot").onclick = (e) => { e.preventDefault(); modal(`<h3>Reset your password</h3><p class="muted">In the full build, a one-time reset link is emailed to you. For the prototype, ask an admin to reset it from the Users screen.</p><button class="btn" data-close>OK</button>`); };
    }
  };

  ROUTES.profile = {
    title: "My profile",
    html() {
      const u = me();
      const mine = S.submissions.filter((s) => s.by === u.id);
      return `<div class="wrap narrow"><div class="row" style="margin-bottom:18px"><span class="avatar" style="width:56px;height:56px;font-size:1.2rem">${initials(u.name)}</span><div><h1 style="margin:0">${esc(u.name)}</h1><span class="muted">${esc(u.email)} · ${u.role === "admin" ? "Admin" : "User"} since ${u.joined}</span></div></div>
        <div class="grid g2">
          <form class="card pad" id="pForm"><h3>Profile</h3>
            <div class="field"><label for="pn">Name</label><input id="pn" value="${esc(u.name)}" required></div>
            <div class="field"><label for="po">Organisation or community</label><input id="po" value="${esc(u.org || "")}"></div>
            <button class="btn">Save profile</button></form>
          <form class="card pad" id="pwForm"><h3>Change password</h3>
            <div class="field"><label for="p1">Current password</label><input id="p1" type="password" required></div>
            <div class="field"><label for="p2">New password</label><input id="p2" type="password" minlength="8" required></div>
            <button class="btn ghost">Update password</button>
            <p class="hint">Stored as a salted hash in the full build, never as plain text.</p></form>
        </div>
        <h2 style="margin-top:30px">My submissions</h2>
        ${mine.length ? `<div class="card"><table class="tbl"><thead><tr><th>Title</th><th>Sent</th><th>Status</th></tr></thead><tbody>${mine.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.date}</td><td>${statusBadge(s.status)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Nothing yet. <a href="#/submit">Share a story →</a></p>`}
      </div>`;
    },
    after() {
      $("#pForm").onsubmit = (e) => { e.preventDefault(); const u = me(); u.name = $("#pn").value.trim(); u.org = $("#po").value.trim(); logAct("updated their profile"); save(); toast("Profile saved"); render(); };
      $("#pwForm").onsubmit = (e) => {
        e.preventDefault(); const u = me();
        if ($("#p1").value !== u.password) return toast("Current password is incorrect");
        u.password = $("#p2").value; logAct("changed their password"); save(); toast("Password updated"); e.target.reset();
      };
    }
  };

  /* ---------- Admin ---------- */
  function adminShell(active, inner) {
    const pend = S.submissions.filter((s) => s.status === "pending").length;
    const unread = S.messages.filter((m) => !m.read).length;
    const link = (h, label, key, n) => `<a href="#/admin/${h}" class="${active === key ? "active" : ""}">${label}${n ? `<span class="count">${n}</span>` : ""}</a>`;
    return `<div class="admin"><nav class="admin-side" aria-label="Admin"><h3>Admin dashboard</h3>
      ${link("", "📊 Overview", "overview")}${link("records", "🗂️ Records", "records")}${link("upload", "⬆️ Upload &amp; catalogue", "upload")}
      ${link("submissions", "📥 Submissions", "submissions", pend)}${link("users", "👥 Users &amp; roles", "users")}
      ${link("messages", "✉️ Messages", "messages", unread)}${link("activity", "📜 Reports &amp; logs", "activity")}
      </nav><div class="admin-main">${inner}</div></div>`;
  }
  const ADMIN = {};
  ROUTES.admin = {
    title: "Admin",
    html(parts, qs) { const sub = parts[1] || "overview"; const v = ADMIN[sub] || ADMIN.overview; return adminShell(sub === "edit" ? "upload" : sub, v.html(parts, qs)); },
    after(parts, qs) { const v = ADMIN[parts[1] || "overview"]; if (v && v.after) v.after(parts, qs); }
  };

  ADMIN.overview = {
    html() {
      const pub = published();
      const pend = S.submissions.filter((s) => s.status === "pending");
      const max = Math.max(...S.visitsByMonth.map((x) => x[1]));
      const byType = Object.keys(TYPES).map((t) => [t, S.records.filter((r) => r.type === t).length]);
      const maxT = Math.max(...byType.map((x) => x[1]));
      return `<div class="row"><div><h1 style="margin:0">Good day, ${esc(me().name.split(" ")[0])}</h1><p class="muted">Here is what is happening in the archive.</p></div><span class="spacer"></span><a class="btn buoy" href="#/admin/upload">⬆️ Upload new item</a></div>
        <div class="grid g4" style="margin:10px 0 22px">
          <div class="card kpi"><b>${pub.length}</b><span>Published items</span></div>
          <div class="card kpi"><b>${S.records.length - pub.length}</b><span>Drafts / unpublished</span></div>
          <div class="card kpi"><b>${pend.length}</b><span>Submissions awaiting review</span></div>
          <div class="card kpi"><b>${S.users.length}</b><span>Registered users</span></div>
        </div>
        <div class="grid g2">
          <div class="card pad"><h3>Visits per month</h3><div class="bars">${S.visitsByMonth.map(([m, v]) => `<div class="b"><em>${v.toLocaleString()}</em><i style="height:${(v / max) * 100}%"></i><small>${m}</small></div>`).join("")}</div></div>
          <div class="card pad"><h3>Items by type</h3>${byType.map(([t, n]) => `<div class="hbar"><span>${TYPES[t].icon} ${TYPES[t].label}</span><div><i style="width:${(n / maxT) * 100}%;background:${TYPES[t].color}"></i></div><b>${n}</b></div>`).join("")}
            <h3 style="margin-top:18px">Most viewed</h3>${[...pub].sort((a, b) => b.views - a.views).slice(0, 3).map((r) => `<div class="row small" style="margin:6px 0"><a href="#/record/${r.id}">${esc(r.title)}</a><span class="spacer"></span><b>${r.views}</b></div>`).join("")}</div>
          <div class="card pad"><div class="row"><h3 style="margin:0">Awaiting review</h3><span class="spacer"></span><a href="#/admin/submissions" class="small">Review all →</a></div>
            ${pend.length ? pend.slice(0, 3).map((s) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>${esc(s.title)}</b><br><span class="small muted">${TYPES[s.type].label} · by ${esc(userById(s.by).name)} · ${s.date}</span></div>`).join("") : `<p class="muted">All caught up 🎉</p>`}</div>
          <div class="card pad"><div class="row"><h3 style="margin:0">Recent activity</h3><span class="spacer"></span><a href="#/admin/activity" class="small">Full log →</a></div>
            <ul class="log">${S.activity.slice(0, 5).map((a) => `<li><time>${a.t}</time><b>${esc(a.who)}</b> ${esc(a.what)}</li>`).join("")}</ul></div>
        </div>`;
    }
  };

  ADMIN.records = {
    html(parts, qs) {
      const f = qs.get("f") || "", st = qs.get("s") || "";
      let list = S.records.filter((r) => (!st || r.status === st) && (!f || (r.title + r.id + r.place).toLowerCase().includes(f.toLowerCase())));
      return `<div class="row"><h1 style="margin:0">Records</h1><span class="spacer"></span><a class="btn buoy" href="#/admin/upload">+ New item</a></div>
        <div class="row" style="margin:16px 0"><input id="rf" placeholder="Filter by title, ID or place" value="${esc(f)}" style="max-width:320px">
          <select id="rs" style="width:auto"><option value="">All statuses</option>${["published", "draft", "unpublished"].map((s) => `<option ${st === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <span class="muted small">${list.length} item(s)</span></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Place</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td class="small">${r.id}</td><td><a href="#/record/${r.id}">${esc(r.title)}</a></td><td>${TYPES[r.type].icon}</td><td class="small">${esc(r.place)}</td><td>${statusBadge(r.status)}</td><td>${r.views}</td>
          <td><div class="actions"><a class="btn sm ghost" href="#/admin/edit/${r.id}">Edit</a>
          ${r.status === "published" ? `<button class="btn sm ghost" data-unpub="${r.id}">Unpublish</button>` : `<button class="btn sm" data-pub="${r.id}">Publish</button>`}</div></td></tr>`).join("")}
        </tbody></table></div>`;
    },
    after() {
      const upd = () => { const p = new URLSearchParams(); if ($("#rf").value) p.set("f", $("#rf").value); if ($("#rs").value) p.set("s", $("#rs").value); go("#/admin/records?" + p); };
      $("#rf").onchange = upd; $("#rs").onchange = upd;
      $$("[data-pub]").forEach((b) => (b.onclick = () => { const r = S.records.find((x) => x.id === b.dataset.pub); r.status = "published"; logAct(`published ${r.id} '${r.title}'`); toast("Published"); render(); }));
      $$("[data-unpub]").forEach((b) => (b.onclick = () => { const r = S.records.find((x) => x.id === b.dataset.unpub); r.status = "unpublished"; logAct(`unpublished ${r.id} '${r.title}'`); toast("Unpublished: now hidden from the public"); render(); }));
    }
  };

  function recordForm(r, fromSub) {
    const v = (k, d = "") => esc(r ? (r[k] ?? d) : (fromSub ? (fromSub[k] ?? d) : d));
    const type = r ? r.type : (fromSub ? fromSub.type : "oral");
    return `<form class="card pad" id="recForm">
      <div class="grid g2"><div class="field"><label>Identifier</label><input value="${r ? r.id : nextRecordId()}" disabled><div class="hint">Assigned automatically.</div></div>
      <div class="field"><label for="ft">Type</label><select id="ft">${Object.keys(TYPES).map((t) => `<option value="${t}" ${t === type ? "selected" : ""}>${TYPES[t].label}</option>`).join("")}</select></div></div>
      <div class="field"><label for="fti">Title *</label><input id="fti" required value="${v("title")}"></div>
      <div class="field"><label for="fsu">Summary / description *</label><textarea id="fsu" required>${r ? esc(r.summary) : (fromSub ? esc(fromSub.description) : "")}</textarea></div>
      <div class="grid g3"><div class="field"><label for="fy">Year *</label><input id="fy" type="number" required value="${v("year")}"></div>
        <div class="field"><label for="fw">Water body</label><select id="fw">${SEED.waterBodies.map((w) => `<option ${(r || fromSub || {}).waterBody === w ? "selected" : ""}>${w}</option>`).join("")}</select></div>
        <div class="field"><label for="fc">County</label><input id="fc" value="${v("county")}"></div></div>
      <div class="grid g3"><div class="field"><label for="fp">Place</label><input id="fp" value="${v("place")}"></div>
        <div class="field"><label for="fla">Latitude</label><input id="fla" type="number" step="any" value="${v("lat", -1.29)}"></div>
        <div class="field"><label for="flo">Longitude</label><input id="flo" type="number" step="any" value="${v("lng", 36.82)}"></div></div>
      <div class="grid g2"><div class="field"><label for="fcr">Creator / collector</label><input id="fcr" value="${v("creator", "Remembering the Waters field team")}"></div>
        <div class="field"><label for="fn">Narrator / photographer</label><input id="fn" value="${r ? esc(r.narrator || r.photographer || "") : ""}"><div class="hint">Use “anonymised” if the person asked not to be named.</div></div></div>
      <div class="grid g3"><div class="field"><label for="fl">Language</label><input id="fl" value="${v("language", "English")}"></div>
        <div class="field"><label for="fr">Rights / licence</label><select id="fr">${["CC BY-NC 4.0", "Used with permission", "Public record", "© Lender, used with permission"].map((x) => `<option ${(r && r.rights === x) ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="fco">Consent</label><select id="fco">${["Signed consent form on file", "Verbal consent recorded", "Online consent given at submission", "Permission letter on file", "Not applicable (public record)"].map((x) => `<option ${(r && r.consent === x) || (!r && fromSub && x.startsWith("Online")) ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
      <div class="field"><label for="ftg">Subject tags</label><input id="ftg" value="${r ? esc(r.tags.join(", ")) : ""}" placeholder="comma separated, e.g. ferry, life jackets"><div class="hint">Drawn from a controlled vocabulary in the full build.</div></div>
      ${r ? "" : `<div class="field"><label>Media file</label><div class="dropzone" id="drop" tabindex="0">⬆️ <b>Drop audio, video, photo or document</b> or click to browse<br><span class="small muted">Stored in cloud object storage in the full build; originals kept, web copies compressed</span><div id="fname" class="small" style="margin-top:6px;color:var(--sea)">${fromSub ? "From submission: " + esc(fromSub.file) : ""}</div></div><input type="file" id="ff" hidden></div>`}
      <div class="row"><button class="btn" name="act" value="draft">Save as draft</button><button class="btn buoy" name="act" value="published">Save &amp; publish</button><span class="spacer"></span><a href="#/admin/records" class="btn ghost">Cancel</a></div>
    </form>`;
  }
  function bindRecordForm(r, fromSub) {
    let fileName = fromSub ? fromSub.file : "";
    if ($("#drop")) dropzone($("#drop"), $("#ff"), (f) => { if (f) { fileName = f.name; $("#fname").textContent = "Selected: " + f.name + " (" + Math.max(1, Math.round(f.size / 1024)) + " KB)"; } });
    let act = "draft";
    $$("#recForm [name=act]").forEach((b) => (b.onclick = () => (act = b.value)));
    $("#recForm").onsubmit = (e) => {
      e.preventDefault();
      const t = $("#ft").value;
      const data = {
        type: t, title: $("#fti").value.trim(), summary: $("#fsu").value.trim(), year: +$("#fy").value, waterBody: $("#fw").value,
        county: $("#fc").value.trim(), place: $("#fp").value.trim(), lat: +$("#fla").value, lng: +$("#flo").value,
        creator: $("#fcr").value.trim(), language: $("#fl").value.trim(), rights: $("#fr").value, consent: $("#fco").value,
        tags: $("#ftg").value.split(",").map((x) => x.trim()).filter(Boolean), status: act
      };
      const who = $("#fn").value.trim();
      if (t === "photo") data.photographer = who; else data.narrator = who;
      if (r) {
        Object.assign(r, data); logAct(`edited ${r.id} '${r.title}'${act === "published" ? " and published it" : ""}`); toast("Saved"); go("#/admin/records");
      } else {
        const fmtMap = { oral: "audio", photo: "image", record: "document", testimony: "text" };
        const nr = Object.assign({ id: nextRecordId(), format: fmtMap[t], views: 0, added: today(), file: fileName }, data);
        if (nr.format === "audio") { nr.duration = 120; nr.transcript = [[0, "Transcript to be added by the cataloguer."]]; }
        if (nr.format === "document") nr.pages = [nr.title.toUpperCase(), nr.summary];
        if (nr.format === "text") nr.body = nr.summary;
        S.records.unshift(nr);
        if (fromSub) { fromSub.status = "approved"; fromSub.recordId = nr.id; logAct(`approved submission '${fromSub.title}' as ${nr.id}`); }
        logAct(`uploaded ${nr.id} '${nr.title}' as ${act}`);
        toast(act === "published" ? `${nr.id} published to the archive` : `${nr.id} saved as draft`); go("#/admin/records");
      }
      save();
    };
  }
  ADMIN.upload = {
    html(parts, qs) {
      const sub = qs.get("from") && S.submissions.find((s) => s.id === qs.get("from"));
      return `<h1>Upload &amp; catalogue</h1><p class="muted">Add a new item with its metadata. ${sub ? `<b>Cataloguing submission ${sub.id}</b> from ${esc(userById(sub.by).name)}.` : ""}</p>${recordForm(null, sub)}`;
    },
    after(parts, qs) { bindRecordForm(null, qs.get("from") && S.submissions.find((s) => s.id === qs.get("from"))); }
  };
  ADMIN.edit = {
    html(parts) { const r = S.records.find((x) => x.id === parts[2]); return r ? `<h1>Edit ${r.id}</h1><p class="muted">Changes are logged in the activity log.</p>${recordForm(r)}` : "<p>Not found</p>"; },
    after(parts) { const r = S.records.find((x) => x.id === parts[2]); if (r) bindRecordForm(r); }
  };

  ADMIN.submissions = {
    html() {
      const order = { pending: 0, approved: 1, rejected: 2 };
      const list = [...S.submissions].sort((a, b) => order[a.status] - order[b.status]);
      return `<h1>Submissions</h1><p class="muted">Material sent in by users. Approving opens the cataloguing form so metadata is completed before publishing.</p>
        <div class="grid" style="gap:14px">${list.map((s) => `<div class="card pad"><div class="row">${typeBadge(s.type)}${statusBadge(s.status)}<span class="muted small">${s.id} · ${s.date}</span></div>
          <h3 style="margin:10px 0 4px">${esc(s.title)}</h3><p class="small muted" style="margin:0 0 6px">From <b>${esc(userById(s.by).name)}</b> (${esc(userById(s.by).email)}) · ${esc(s.place || "")} ${s.year ? "· " + s.year : ""} · ${esc(s.waterBody)}</p>
          <p style="margin:0 0 8px">${esc(s.description)}</p><p class="small" style="margin:0 0 10px">📎 ${esc(s.file)} · ${s.consent ? "✅ Consent confirmed by contributor" : "⚠️ No consent"}</p>
          ${s.status === "pending" ? `<div class="actions"><a class="btn sm" href="#/admin/upload?from=${s.id}">Approve &amp; catalogue</a><button class="btn sm ghost" data-reject="${s.id}">Reject</button></div>` : s.recordId ? `<a class="small" href="#/record/${s.recordId}">View ${s.recordId} →</a>` : ""}
        </div>`).join("")}</div>`;
    },
    after() {
      $$("[data-reject]").forEach((b) => (b.onclick = () => {
        const s = S.submissions.find((x) => x.id === b.dataset.reject);
        modal(`<h3>Reject “${esc(s.title)}”?</h3><div class="field"><label for="rr">Reason sent to the contributor</label><textarea id="rr">Thank you for your submission. Unfortunately we cannot include it because…</textarea></div><div class="row"><button class="btn danger" id="rok">Reject submission</button><button class="btn ghost" data-close>Cancel</button></div>`);
        $("#rok").onclick = () => { s.status = "rejected"; logAct(`rejected submission '${s.title}'`); closeModal(); toast("Submission rejected and contributor notified"); render(); };
      }));
    }
  };

  ADMIN.users = {
    html() {
      return `<div class="row"><h1 style="margin:0">Users &amp; roles</h1><span class="spacer"></span><button class="btn buoy" id="newUser">+ Create user</button></div>
        <p class="muted">Normal users search, browse, play media and submit material. Admins also catalogue, publish, review and manage users.</p>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
        ${S.users.map((u) => `<tr><td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${initials(u.name)}</span>${esc(u.name)}</div></td><td class="small">${esc(u.email)}</td>
          <td><select data-role="${u.id}" style="width:auto" ${u.id === S.session ? "disabled" : ""}><option value="user" ${u.role === "user" ? "selected" : ""}>User</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option></select></td>
          <td>${statusBadge(u.status)}</td><td class="small">${u.joined}</td>
          <td><div class="actions"><button class="btn sm ghost" data-reset="${u.id}">Reset password</button>${u.id === S.session ? "" : `<button class="btn sm ${u.status === "active" ? "ghost" : ""}" data-susp="${u.id}">${u.status === "active" ? "Suspend" : "Reactivate"}</button>`}</div></td></tr>`).join("")}
        </tbody></table></div>`;
    },
    after() {
      $$("[data-role]").forEach((s) => (s.onchange = () => { const u = S.users.find((x) => x.id === s.dataset.role); u.role = s.value; logAct(`changed ${u.email} role to ${s.value}`); toast("Role updated"); render(); }));
      $$("[data-susp]").forEach((b) => (b.onclick = () => { const u = S.users.find((x) => x.id === b.dataset.susp); u.status = u.status === "active" ? "suspended" : "active"; logAct(`${u.status === "suspended" ? "suspended" : "reactivated"} account ${u.email}`); toast("Account " + u.status); render(); }));
      $$("[data-reset]").forEach((b) => (b.onclick = () => {
        const u = S.users.find((x) => x.id === b.dataset.reset);
        const tmp = "Tmp-" + Math.random().toString(36).slice(2, 8);
        u.password = tmp; logAct(`reset password for ${u.email}`); save();
        modal(`<h3>Password reset</h3><p>A temporary password was set for <b>${esc(u.email)}</b>:</p><p class="card pad" style="font-family:monospace;font-size:1.2rem">${tmp}</p><p class="muted small">In the full build the user receives a secure, expiring reset link by email instead.</p><button class="btn" data-close>Done</button>`);
      }));
      $("#newUser").onclick = () => {
        modal(`<h3>Create user</h3><form id="nuForm"><div class="field"><label for="nn">Name</label><input id="nn" required></div><div class="field"><label for="ne">Email</label><input id="ne" type="email" required></div>
          <div class="field"><label for="nr">Role</label><select id="nr"><option value="user">User</option><option value="admin">Admin</option></select></div>
          <div class="field"><label for="np">Temporary password</label><input id="np" required minlength="8" value="Welcome-${Math.random().toString(36).slice(2, 6)}"></div>
          <div class="row"><button class="btn">Create</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`);
        $("#nuForm").onsubmit = (e) => {
          e.preventDefault();
          const u = { id: "U" + Date.now(), name: $("#nn").value.trim(), email: $("#ne").value.trim(), role: $("#nr").value, password: $("#np").value, status: "active", joined: today(), org: "" };
          S.users.push(u); logAct(`created ${u.role} account ${u.email}`); closeModal(); toast("User created"); render();
        };
      };
    }
  };

  ADMIN.messages = {
    html() {
      return `<h1>Messages</h1><p class="muted">From the public contact form.</p>
        <div class="grid" style="gap:12px">${S.messages.map((m) => `<div class="card pad" style="${m.read ? "" : "border-left:4px solid var(--buoy)"}"><div class="row"><b>${esc(m.subject)}</b><span class="spacer"></span><span class="small muted">${m.date}</span></div>
          <p class="small muted" style="margin:2px 0 8px">${esc(m.name)} · ${esc(m.email)}</p><p style="margin:0 0 10px">${esc(m.body)}</p>
          <div class="actions">${m.read ? '<span class="small muted">Read</span>' : `<button class="btn sm ghost" data-read="${m.id}">Mark as read</button>`}<a class="btn sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: " + m.subject)}">Reply by email</a></div></div>`).join("") || '<p class="muted">No messages.</p>'}</div>`;
    },
    after() { $$("[data-read]").forEach((b) => (b.onclick = () => { S.messages.find((m) => m.id === b.dataset.read).read = true; save(); render(); })); }
  };

  ADMIN.activity = {
    html() {
      const pub = published();
      const byWater = SEED.waterBodies.map((w) => [w, pub.filter((r) => r.waterBody === w).reduce((a, r) => a + r.views, 0)]);
      const mx = Math.max(...byWater.map((x) => x[1]), 1);
      return `<div class="row"><h1 style="margin:0">Reports &amp; activity log</h1><span class="spacer"></span><button class="btn ghost" id="csv">⬇️ Export usage CSV</button></div>
        <div class="grid g2" style="margin-top:16px"><div class="card pad"><h3>Views by water body</h3>${byWater.map(([w, n]) => `<div class="hbar"><span>${w}</span><div><i style="width:${(n / mx) * 100}%;background:var(--sea)"></i></div><b>${n}</b></div>`).join("")}</div>
        <div class="card pad"><h3>Collection health</h3>
          <div class="hbar"><span>With consent</span><div><i style="width:100%;background:var(--ok)"></i></div><b>${S.records.length}</b></div>
          <div class="hbar"><span>With location</span><div><i style="width:100%;background:var(--ok)"></i></div><b>${S.records.filter((r) => r.lat).length}</b></div>
          <div class="hbar"><span>With transcript</span><div><i style="width:${(S.records.filter((r) => r.transcript).length / S.records.filter((r) => r.duration).length) * 100}%;background:var(--sea)"></i></div><b>${S.records.filter((r) => r.transcript).length}</b></div>
          <p class="small muted">All audio and video items need a transcript for search and accessibility.</p></div></div>
        <div class="card pad" style="margin-top:18px"><h3>Activity log</h3><ul class="log">${S.activity.map((a) => `<li><time>${a.t}</time><b>${esc(a.who)}</b> ${esc(a.what)}</li>`).join("")}</ul></div>`;
    },
    after() {
      $("#csv").onclick = () => {
        const rows = [["id", "title", "type", "water_body", "county", "year", "status", "views"], ...S.records.map((r) => [r.id, r.title, r.type, r.waterBody, r.county, r.year, r.status, r.views])];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "archive-usage-report.csv"; a.click();
        logAct("exported the usage report"); toast("Report downloaded");
      };
    }
  };

  ROUTES.app = {
    title: "App preview",
    html() {
      return `<div class="wrap" style="padding-bottom:0"><div class="eyebrow">Hybrid app · Android and iOS</div><h1>The same archive, in your pocket</h1>
        <p class="muted" style="max-width:680px">This is the mobile app experience: one hybrid app for phones and tablets, using the same secure API and database as the website, so content is managed once. Try it right inside the phone.</p></div>
        <div class="app-stage"><div class="phone"><iframe src="index.html?app=1#/home" title="Mobile app preview"></iframe></div>
        <div class="app-notes card pad"><h3>What the app does</h3><ul>
          <li>Sign in with the same account as the website</li><li>Full-text search, browse and filters</li><li>Incident map with GPS “near me” (full build)</li>
          <li>Play oral histories and read transcripts</li><li>Submit stories and photos straight from the phone camera (full build)</li><li>Admins can review submissions on the go</li></ul>
          <p class="small muted">Store-ready for Google Play and the Apple App Store in the full build.</p></div></div>`;
    }
  };

  ROUTES.notfound = { html: () => `<div class="wrap narrow"><div class="card empty"><div style="font-size:2rem">🧭</div><h2>Page not found</h2><a class="btn" href="#/home">Go home</a></div></div>` };

  /* ---------- Modal ---------- */
  function modal(inner) {
    closeModal();
    const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "modalBg";
    bg.innerHTML = `<div class="modal card pad" role="dialog" aria-modal="true">${inner}</div>`;
    document.body.appendChild(bg);
    bg.onclick = (e) => { if (e.target === bg || e.target.hasAttribute("data-close")) closeModal(); };
    const first = bg.querySelector("input, textarea, button"); if (first) first.focus();
  }
  function closeModal() { const m = $("#modalBg"); if (m) m.remove(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* ---------- Boot ---------- */
  if (APP_MODE) document.documentElement.classList.add("app-mode");
  $("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
  $("#lt").onclick = () => { S.prefs.largeText = !S.prefs.largeText; save(); renderShell(parse().parts[0] || "home"); };
  $("#lb").onclick = () => { S.prefs.lowBw = !S.prefs.lowBw; save(); renderShell(parse().parts[0] || "home"); toast(S.prefs.lowBw ? "Light mode: images hidden to save data" : "Images restored"); };
  $("#resetDemo").onclick = () => { if (confirm("Reset all demo data to its original state?")) { S = fresh(); save(); toast("Demo data reset"); go("#/home"); render(); } };
  render();
})();
