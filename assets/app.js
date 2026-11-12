/* =====================================================================
   Maritime Safety Heritage Archive - CLICKABLE PROTOTYPE v0.2
   Minimal, visual UI: main options are round "orbs" inside the page;
   extra options appear only after "See more" (left rail + top bar).
   Plain JavaScript, no server needed. Data lives in the browser
   (localStorage). The full build replaces this with a secure API.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- State ---------- */
  const KEY = "msh-prototype-state";
  const SEED = window.MSH_SEED;
  const ICONS = window.MSH_ICONS || {};
  const APP_MODE = new URLSearchParams(location.search).get("app") === "1";
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TYPES = {
    oral:      { label: "Oral history",    plural: "Oral histories", icon: "mic" },
    photo:     { label: "Photograph",      plural: "Photographs",    icon: "camera" },
    record:    { label: "Record / report", plural: "Records",        icon: "file-text" },
    testimony: { label: "Testimony",       plural: "Testimonies",    icon: "message-square-quote" }
  };
  const WATER_ICONS = { "Indian Ocean coast": "waves", "Lake Victoria": "fish", "Lake Turkana": "sun", "Lake Naivasha": "sailboat", "Lake Baringo": "compass", "Rivers": "map" };

  /* Welcome-page footage: Mixkit free licence (no attribution required). */
  const CLIPS = [
    { id: 7194,  caption: "Waves rolling in from the open ocean" },
    { id: 48365, caption: "Fishermen heading out on a wooden boat" },
    { id: 48525, caption: "The tide running onto the shore" },
    { id: 4004,  caption: "Passenger ferries arriving at port" },
    { id: 50244, caption: "Rowing a small boat off the beach" },
    { id: 18758, caption: "A fishing boat crossing at dusk" }
  ].map((c) => Object.assign(c, {
    src: `https://assets.mixkit.co/videos/${c.id}/${c.id}-720.mp4`,
    poster: `https://assets.mixkit.co/videos/${c.id}/${c.id}-thumb-360-0.jpg`
  }));

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
      if (raw) { const s = JSON.parse(raw); if (s && s.version === SEED.version) return s; }
    } catch (e) { /* storage unavailable: run in memory */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  S = load();
  const UI = { more: false, justOpened: false, slide: 0 };

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
  const pending = () => S.submissions.filter((s) => s.status === "pending");
  const unread = () => S.messages.filter((m) => !m.read);
  const nextRecordId = () => "MSH-" + String(Math.max(...S.records.map((r) => +r.id.split("-")[1])) + 1).padStart(4, "0");
  function logAct(what) { S.activity.unshift({ t: now(), who: me() ? me().name : "System", what }); save(); }
  function ic(name, cls = "") {
    const body = ICONS[name] || ICONS["circle-help"] || "";
    return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  function toast(msg, icon = "circle-check") {
    const t = $("#toast"); t.innerHTML = ic(icon) + `<span>${esc(msg)}</span>`; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const words = q.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return words.length ? safe.replace(new RegExp("(" + words.join("|") + ")", "gi"), "<mark>$1</mark>") : safe;
  }
  const typeTag = (t) => `<span class="tag">${ic(TYPES[t].icon)}${TYPES[t].label}</span>`;
  const status = (s) => `<span class="st st-${esc(s)}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`;
  function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

  /* ---------- Generated placeholder artwork (stands in for real media) ---------- */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function art(rec, w = 800, h = 450, noLabel) {
    const s = hash(rec.id + rec.title);
    const pal = { oral: ["#03122a", "#0d3d8a", "#9cc2ff"], photo: ["#061a36", "#1e6bff", "#e9f1ff"], record: ["#020a18", "#123a73", "#b8d2ff"], testimony: ["#04102a", "#2a58b8", "#d4e4ff"] }[rec.type];
    const [a, b, c] = pal;
    const sunX = 120 + (s % 560), hor = 230 + (s % 60);
    let boats = "";
    for (let i = 0; i < 1 + (s % 3); i++) {
      const x = 90 + ((s >> (i * 3)) % 600), y = hor + 30 + i * 28, k = 0.7 + i * 0.25;
      boats += `<g transform="translate(${x} ${y}) scale(${k})" fill="${a}" opacity=".92"><path d="M-60 0 L60 0 L42 18 L-44 18 Z"/>${rec.scene === "harbour" && i === 0 ? '<rect x="-20" y="-34" width="40" height="34"/><rect x="-6" y="-52" width="10" height="18"/>' : '<path d="M0 -70 L0 0 L36 0 Z" fill="' + c + '" opacity=".85"/><rect x="-2" y="-72" width="3" height="72"/>'}</g>`;
    }
    let waves = "";
    for (let i = 0; i < 6; i++) { const y = hor + 12 + i * 34; waves += `<path d="M0 ${y} Q 100 ${y - 8} 200 ${y} T 400 ${y} T 600 ${y} T 800 ${y}" stroke="${c}" stroke-opacity="${0.2 - i * 0.025}" stroke-width="3" fill="none"/>`; }
    const label = rec.type === "photo" ? "SAMPLE PHOTOGRAPH" : TYPES[rec.type].label.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="${w}" height="${h}"><defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="800" height="450" fill="url(#k)"/><circle cx="${sunX}" cy="${hor - 40}" r="46" fill="${c}" opacity=".5"/><path d="M0 ${hor} L 140 ${hor - 22} L 260 ${hor - 8} L 400 ${hor - 30} L 520 ${hor - 6} L 800 ${hor - 18} L 800 ${hor} Z" fill="${a}" opacity=".6"/><rect y="${hor}" width="800" height="${450 - hor}" fill="url(#m)"/>${waves}${boats}${noLabel ? "" : `<text x="24" y="430" font-family="Arial" font-size="15" letter-spacing="3" fill="#fff" opacity=".5">${label} ${rec.id}</text>`}</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------- Search ---------- */
  function searchText(r) {
    const extra = (r.transcript || []).map((x) => x[1]).join(" ") + " " + (r.body || "") + " " + (r.pages || []).join(" ");
    return [r.id, r.title, r.summary, r.place, r.county, r.waterBody, r.tags.join(" "), r.creator, r.language, String(r.year), extra].join(" ").toLowerCase();
  }
  function runSearch(o) {
    const q = (o.q || "").trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    let list = published().map((r) => {
      const txt = searchText(r); let score = 0;
      for (const w of words) {
        if (!txt.includes(w)) return null;
        if (r.title.toLowerCase().includes(w)) score += 5;
        if (r.tags.join(" ").toLowerCase().includes(w)) score += 3;
        score += 1;
      }
      return { r, score };
    }).filter(Boolean);
    if (o.type) list = list.filter((x) => x.r.type === o.type);
    if (o.waters && o.waters.length) list = list.filter((x) => o.waters.includes(x.r.waterBody));
    if (o.decade) list = list.filter((x) => Math.floor(x.r.year / 10) * 10 === +o.decade);
    if (o.county) list = list.filter((x) => x.r.county === o.county);
    const sort = o.sort || (q ? "relevance" : "newest");
    list.sort((a, b) => sort === "relevance" ? b.score - a.score : sort === "oldest" ? a.r.year - b.r.year : sort === "popular" ? b.r.views - a.r.views : b.r.year - a.r.year);
    return list.map((x) => x.r);
  }
  function snippet(r, q) {
    if (!q) return esc(r.summary);
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const pool = [r.summary, ...(r.transcript || []).map((x) => x[1]), r.body || "", ...(r.pages || [])];
    const hit = pool.find((p) => words.some((w) => p.toLowerCase().includes(w))) || r.summary;
    return highlight(hit.length > 200 ? hit.slice(0, 200) + "…" : hit, q);
  }

  /* ---------- Orbs ---------- */
  // Each orb: icon, label, desc (shown on click), and either go (hash) or act (function).
  let ACTS = {}, actN = 0, pendingOrb = null;
  function cancelOrb() { if (pendingOrb) { clearTimeout(pendingOrb._t); pendingOrb.classList.remove("zoom"); pendingOrb.parentElement.classList.remove("show"); pendingOrb = null; } }
  function orb(o) {
    let data = "";
    if (o.go) data = `data-go="${esc(o.go)}"`;
    if (o.act) { const k = "a" + (++actN); ACTS[k] = o.act; data = `data-act="${k}"`; }
    const cls = ["orb", o.primary ? "primary" : "", o.on ? "on" : "", o.ghost ? "ghost" : ""].join(" ");
    return `<div class="orb-wrap" style="--n:${o.n || 0}">
      <button class="${cls}" ${data} data-desc="${esc(o.desc || "")}" aria-label="${esc(o.label)}${o.desc ? ": " + esc(o.desc) : ""}" ${o.id ? `id="${o.id}"` : ""}>${ic(o.icon)}${o.badge ? `<span class="badge-n">${o.badge}</span>` : ""}</button>
      <span class="orb-label">${esc(o.label)}</span>
      <span class="orb-desc" role="status">${esc(o.desc || "")}</span></div>`;
  }
  const MORE_DESC = ["Shows every other option on the left and at the top.", "Hides the extra options on the left and top."];
  const seeMoreOrb = (n) => orb({ icon: "ellipsis", label: UI.more ? "See less" : "See more", desc: MORE_DESC[UI.more ? 1 : 0], act: () => toggleMore(), ghost: true, n });
  function orbRow(list, extra = "") { list = list.filter(Boolean); return `<div class="orbs ${extra}">${list.map((o, i) => orb(Object.assign({ n: i }, o))).join("")}${seeMoreOrb(list.length)}</div>`; }

  // Click: zoom in, show the description, let it fade, then act. A second click skips the wait.
  document.addEventListener("click", (e) => {
    let b = e.target.closest(".orb");
    if (!b) { const lab = e.target.closest(".orb-label"); if (lab) b = lab.parentElement.querySelector(".orb"); }
    if (!b) return;
    const wrap = b.parentElement;
    const run = () => {
      clearTimeout(b._t); pendingOrb = null;
      setTimeout(() => { b.classList.remove("zoom"); wrap.classList.remove("show"); }, 60);
      if (b.dataset.go) { if (location.hash === b.dataset.go) render(); else go(b.dataset.go); }
      else if (b.dataset.act && ACTS[b.dataset.act]) ACTS[b.dataset.act](b);
    };
    if (b.classList.contains("zoom") || !b.dataset.desc) return run();
    $$(".orb.zoom").forEach((x) => { x.classList.remove("zoom"); x.parentElement.classList.remove("show"); clearTimeout(x._t); });
    const life = REDUCED ? 500 : 1500;
    wrap.style.setProperty("--life", life + "ms");
    b.classList.add("zoom"); wrap.classList.remove("show"); void wrap.offsetWidth; wrap.classList.add("show");
    pendingOrb = b; b._t = setTimeout(run, life - 150);
  });

  /* ---------- See more: left rail + top extras ---------- */
  function toggleMore(force) {
    UI.more = typeof force === "boolean" ? force : !UI.more;
    UI.justOpened = UI.more;
    renderChrome(currentPage());
    $$(".orb.ghost").forEach((b) => { b.parentElement.querySelector(".orb-label").textContent = UI.more ? "See less" : "See more"; b.dataset.desc = MORE_DESC[UI.more ? 1 : 0]; b.parentElement.querySelector(".orb-desc").textContent = b.dataset.desc; });
  }
  function renderChrome(page) {
    const u = me();
    const cur = location.hash || "#/home";
    const L = (h, i, l, extra = "") => `<a href="${h}" class="${cur === h ? "active" : ""}"><span class="ri-ic">${ic(i)}</span><span>${l}</span>${extra}</a>`;
    const T = (id, i, l, pressed) => `<button class="ri" id="${id}" aria-pressed="${pressed}"><span class="ri-ic">${ic(i)}</span><span>${l}</span>${pressed ? '<span class="count">On</span>' : ""}</button>`;
    const n = (x) => x ? `<span class="count">${x}</span>` : "";
    $("#rail").innerHTML = `<span class="rail-title">More options</span><button class="pill icon-only rail-close" id="railClose" aria-label="Close extra options">${ic("x")}</button>
      <h4>Explore</h4>
      ${L("#/home", "house", "Welcome")}
      ${u ? L("#/browse", "layout-grid", "Browse the archive") : ""}
      ${u ? L("#/map", "map", "Incident map") : ""}
      ${u ? Object.keys(TYPES).map((t) => L("#/browse?type=" + t, TYPES[t].icon, TYPES[t].plural)).join("") : ""}
      <h4>Take part</h4>
      ${u ? L("#/submit", "hand-heart", "Share a story") : L("#/login", "log-in", "Sign in or create account")}
      ${L("#/contact", "mail", "Contact the team")}
      ${u && u.role === "admin" ? `<h4>Admin</h4>
        ${L("#/admin", "chart-column", "Dashboard")}
        ${L("#/admin/records", "archive", "Records")}
        ${L("#/admin/upload", "upload", "Upload and catalogue")}
        ${L("#/admin/submissions", "inbox", "Submissions", n(pending().length))}
        ${L("#/admin/users", "users", "Users and roles")}
        ${L("#/admin/messages", "mail", "Messages", n(unread().length))}
        ${L("#/admin/activity", "activity", "Reports and logs")}` : ""}
      <h4>About</h4>
      ${L("#/about", "anchor", "About the archive")}
      ${L("#/app", "smartphone", "Mobile app preview")}
      ${u ? L("#/profile", "user", "My account") : ""}
      <h4>Display</h4>
      ${T("lt", "type", "Larger text", S.prefs.largeText)}
      ${T("lb", "wifi-off", "Light mode: no images or video", S.prefs.lowBw)}
      <h4>Prototype</h4>
      <button class="ri" id="resetDemo"><span class="ri-ic">${ic("rotate-ccw")}</span><span>Reset demo data</span></button>`;
    $("#topExtras").hidden = !UI.more;
    $("#topExtras").innerHTML = `
      ${u ? `<button class="pill has-lbl" id="qsBtn">${ic("search")}<span class="lbl">Quick search</span></button>` : ""}
      <button class="pill icon-only" id="ltTop" aria-pressed="${S.prefs.largeText}" aria-label="Larger text" title="Larger text">${ic("type")}</button>
      <button class="pill icon-only" id="lbTop" aria-pressed="${S.prefs.lowBw}" aria-label="Light mode: no images or video" title="Light mode: no images or video">${ic("wifi-off")}</button>
      <a class="pill has-lbl" href="#/app">${ic("smartphone")}<span class="lbl">App</span></a>`;
    $("#topRight").innerHTML = u
      ? `<a class="pill has-lbl" href="#/profile" title="My account"><span class="avatar">${initials(u.name)}</span><span class="lbl">My account</span>${u.role === "admin" ? '<span class="role lbl">Admin</span>' : ""}</a>
         <button class="pill has-lbl" id="logout" title="Sign out">${ic("log-out")}<span class="lbl">Sign out</span></button>`
      : (page === "login" ? "" : `<a class="pill has-lbl" href="#/login">${ic("log-in")}<span class="lbl">Sign in</span></a>`);
    $("#tabbar").innerHTML = [["home", "house", "Home"], ["browse", "search", "Search"], ["map", "map", "Map"], ["submit", "hand-heart", "Share"], [u ? (u.role === "admin" ? "admin" : "profile") : "login", "user", u ? (u.role === "admin" ? "Admin" : "Me") : "Sign in"]]
      .map(([h, i, l]) => `<a href="#/${h}" class="${page === h ? "active" : ""}">${ic(i)}${l}</a>`).join("");
    document.body.classList.toggle("more", UI.more);
    document.documentElement.classList.toggle("large-text", S.prefs.largeText);
    document.body.classList.toggle("low-bw", S.prefs.lowBw);
    $(".top").classList.toggle("solid", !(page === "home" && u));
    if (UI.justOpened) {
      UI.justOpened = false;
      $$("#rail a, #rail button.ri").forEach((el, i) => { el.style.setProperty("--n", i); el.classList.add("flash"); });
      $$("#topExtras > *").forEach((el) => el.classList.add("flash"));
    }
    $("#railClose").onclick = () => toggleMore(false);
    const lo = $("#logout");
    if (lo) lo.onclick = () => { logAct("signed out"); S.session = null; save(); UI.more = false; toast("Signed out", "log-out"); go("#/home"); };
    const setPref = (k, msg) => { S.prefs[k] = !S.prefs[k]; save(); if (k === "lowBw") render(); else renderChrome(currentPage()); toast(msg(S.prefs[k]), k === "lowBw" ? "wifi-off" : "type"); };
    [$("#lt"), $("#ltTop")].forEach((b) => b && (b.onclick = () => setPref("largeText", (on) => on ? "Larger text on" : "Larger text off")));
    [$("#lb"), $("#lbTop")].forEach((b) => b && (b.onclick = () => setPref("lowBw", (on) => on ? "Light mode on: images and video hidden" : "Light mode off")));
    if ($("#qsBtn")) $("#qsBtn").onclick = quickSearch;
    $("#resetDemo").onclick = () => modal("rotate-ccw", "Reset the demo?", `<p class="muted">All records, users and submissions go back to their original sample state.</p><div class="row"><button class="btn" id="rsOk">${ic("rotate-ccw")}Reset demo data</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
      $("#rsOk").onclick = () => { S = fresh(); save(); UI.more = false; closeModal(); toast("Demo data reset"); if (location.hash === "#/home") render(); else go("#/home"); };
    });
  }
  $("#scrim").onclick = () => toggleMore(false);

  /* ---------- Background: video slideshow (welcome) or a big page icon ---------- */
  let slideTimer = null;
  function startSlides() { clearInterval(slideTimer); slideTimer = setInterval(() => showSlide((UI.slide + 1) % CLIPS.length), 9000); }
  function setBg(kind) {
    clearInterval(slideTimer);
    const bg = $("#bg");
    if (kind === "video" && !S.prefs.lowBw) {
      bg.className = "bg video";
      bg.innerHTML = CLIPS.map((c, i) => REDUCED
        ? `<img class="still" data-i="${i}" src="${c.poster}" alt="">`
        : `<video data-i="${i}" muted playsinline loop preload="${i === UI.slide % CLIPS.length ? "auto" : "none"}" poster="${c.poster}"><source src="${c.src}" type="video/mp4"></video>`).join("") + `<div class="shade"></div>`;
      showSlide(UI.slide % CLIPS.length);
      startSlides();
      return;
    }
    bg.className = "bg";
    bg.innerHTML = `<div class="bg-icon">${ic(kind === "video" ? "waves" : (kind || "waves"))}</div>
      <svg class="bg-waves" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90 Q 180 50 360 90 T 720 90 T 1080 90 T 1440 90" stroke="#1e6bff" stroke-opacity=".5" fill="none" stroke-width="2"/><path d="M0 120 Q 180 85 360 120 T 720 120 T 1080 120 T 1440 120" stroke="#4d8dff" stroke-opacity=".35" fill="none" stroke-width="2"/></svg>`;
  }
  function showSlide(i) {
    UI.slide = i;
    $$("#bg video, #bg .still").forEach((v) => {
      const on = +v.dataset.i === i;
      v.classList.toggle("on", on);
      if (v.tagName === "VIDEO") {
        if (on) { v.preload = "auto"; try { v.currentTime = 0; } catch (e) {} const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else setTimeout(() => { if (!v.classList.contains("on")) v.pause(); }, 1700);
      }
    });
    const nxt = $(`#bg video[data-i="${(i + 1) % CLIPS.length}"]`); if (nxt) nxt.preload = "auto";
    const cap = $("#slideCap"); if (cap) cap.textContent = CLIPS[i].caption;
    $$(".dots button").forEach((d, k) => d.classList.toggle("on", k === i));
  }

  /* ---------- Router ---------- */
  function parse() {
    const h = location.hash.replace(/^#/, "") || "/home";
    const [path, qs] = h.split("?");
    return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  }
  const currentPage = () => parse().parts[0] || "home";
  function go(h) { location.hash = h; }
  const PUBLIC = ["home", "about", "contact", "login", "app"];
  let cleanup = [];
  function render() {
    cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
    cancelOrb(); ACTS = {}; actN = 0; closeModal(); closeSheet();
    const { parts, q } = parse();
    const page = parts[0] || "home";
    if (!PUBLIC.includes(page) && !me()) { S.afterLogin = location.hash; save(); return go("#/login"); }
    if (page === "admin" && !isAdmin()) { toast("That area is for admins. Sign in with an admin account.", "lock"); return go("#/home"); }
    const view = ROUTES[page] || ROUTES.notfound;
    document.title = (view.title ? view.title + " | " : "") + "Maritime Safety Heritage Archive";
    renderChrome(page);
    setBg(typeof view.bg === "function" ? view.bg(parts, q) : view.bg);
    $("#main").innerHTML = view.html(parts, q);
    if (view.after) view.after(parts, q);
    window.scrollTo(0, 0);
    $("#main").focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", render);

  /* ---------- Popups ---------- */
  function modal(icon, title, inner, after, wide) {
    closeModal();
    const bg = document.createElement("div");
    bg.className = "modal-bg"; bg.id = "modalBg";
    bg.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <button class="pill icon-only modal-x" data-close aria-label="Close">${ic("x")}</button>
      <div class="modal-ic">${ic(icon)}</div><h2>${esc(title)}</h2>${inner}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) closeModal(); });
    if (after) after(bg);
    const f = bg.querySelector(".modal input, .modal textarea, .modal select"); if (f) f.focus(); else bg.querySelector(".modal-x").focus();
  }
  function closeModal() { const m = $("#modalBg"); if (m) m.remove(); }
  function sheet(title, inner, after) {
    closeSheet();
    const wrap = document.createElement("div"); wrap.id = "sheetWrap";
    wrap.innerHTML = `<div class="sheet-bg" data-close-sheet></div><aside class="sheet" role="dialog" aria-label="${esc(title)}"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(title)}</h2><span class="spacer"></span><button class="pill icon-only" data-close-sheet aria-label="Close">${ic("x")}</button></div>${inner}</aside>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close-sheet]")) closeSheet(); });
    if (after) after(wrap);
  }
  function closeSheet() { const s = $("#sheetWrap"); if (s) s.remove(); }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (pendingOrb) cancelOrb(); else if ($("#modalBg")) closeModal(); else if ($("#sheetWrap")) closeSheet(); else if (UI.more) toggleMore(false); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me()) { e.preventDefault(); quickSearch(); }
  });
  function quickSearch() {
    if (!me()) return go("#/login");
    modal("search", "Quick search", `<input id="qsIn" placeholder="Try life jackets, ferry, Lake Turkana" autocomplete="off"><div id="qsRes" style="margin-top:12px"></div><p class="hint">Tip: press Ctrl + K from any page.</p>`, () => {
      const draw = () => {
        const q = $("#qsIn").value.trim();
        const res = q ? runSearch({ q }).slice(0, 6) : [];
        $("#qsRes").innerHTML = q ? (res.length ? res.map((r) => `<a class="list-item" href="#/record/${r.id}"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${highlight(r.title, q)}</b><span>${esc(r.place)}, ${r.year}</span></span>${ic("chevron-right")}</a>`).join("") + `<a class="btn ghost sm" style="margin-top:10px" href="#/browse?q=${encodeURIComponent(q)}">See all results</a>` : `<p class="muted">Nothing matches "${esc(q)}". Try fewer words.</p>`) : "";
      };
      $("#qsIn").oninput = draw;
      $("#qsIn").onkeydown = (e) => { if (e.key === "Enter" && $("#qsIn").value.trim()) go("#/browse?q=" + encodeURIComponent($("#qsIn").value.trim())); };
    });
  }

  /* ---------- Reusable pieces ---------- */
  function recCard(r, q) {
    return `<a class="card" href="#/record/${r.id}">
      <div class="thumb"><img src="${art(r, 480, 300)}" alt="" loading="lazy"><span class="type-dot" title="${TYPES[r.type].label}">${ic(TYPES[r.type].icon)}</span></div>
      <div class="body"><h3>${highlight(r.title, q)}</h3><p>${snippet(r, q)}</p>
        <div class="meta"><span>${ic("map-pin")}${esc(r.place)}</span><span>${ic("calendar")}${r.year}</span>${r.duration ? `<span>${ic("clock")}${fmt(r.duration)}</span>` : ""}</div></div></a>`;
  }
  function head(title, sub, center) { return `<div class="page-head ${center ? "center" : ""}"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`; }
  function dropzone(zone, input, cb) {
    zone.onclick = () => input.click();
    zone.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
    input.onchange = () => cb(input.files[0]);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag"); };
    zone.ondragleave = () => zone.classList.remove("drag");
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drag"); cb(e.dataTransfer.files[0]); };
  }

  /* =====================================================================
     PAGES
     ===================================================================== */
  const ROUTES = {};

  /* ----- Welcome (signed in: video slideshow) / landing (signed out) ----- */
  ROUTES.home = {
    bg: () => me() ? "video" : "life-buoy",
    html() {
      const u = me();
      if (!u) {
        return `<div class="stage welcome">
          <h1>Kenya's memory of the water, kept for everyone</h1>
          <p class="lede">Oral histories, photographs, records and testimonies from the coast, the lakes and the rivers, so their safety lessons are never lost.</p>
          ${orbRow([
            { icon: "log-in", label: "Sign in", desc: "Sign in with your own account to explore the archive.", go: "#/login", primary: true },
            { icon: "user-plus", label: "Create account", desc: "Open a free account in under a minute.", go: "#/login?tab=up" },
            { icon: "anchor", label: "About", desc: "Who is behind the archive and why it matters.", go: "#/about" },
            { icon: "smartphone", label: "Mobile app", desc: "See the same archive on an Android or iOS phone.", go: "#/app" }
          ])}</div>`;
      }
      const user = [
        { icon: "search", label: "Search", desc: "Search titles, transcripts, documents and places.", act: quickSearch, primary: true },
        { icon: "layout-grid", label: "Browse", desc: "Explore every item, filtered by type, water and decade.", go: "#/browse" },
        { icon: "map", label: "Incident map", desc: "See where each story happened, from Likoni to Lake Turkana.", go: "#/map" },
        { icon: "headphones", label: "Listen", desc: "Play oral histories in the voices of those who lived them.", go: "#/browse?type=oral" },
        { icon: "hand-heart", label: "Share a story", desc: "Send a recording, photo or document to the research team.", go: "#/submit" }
      ];
      const admin = [
        { icon: "chart-column", label: "Dashboard", desc: "Visits, collection health and recent activity.", go: "#/admin", primary: true },
        { icon: "inbox", label: "Review", desc: "Approve or reject material sent in by the public.", go: "#/admin/submissions", badge: pending().length || "" },
        { icon: "upload", label: "Upload", desc: "Add a new item and catalogue its metadata.", go: "#/admin/upload" },
        { icon: "search", label: "Search", desc: "Search titles, transcripts, documents and places.", act: quickSearch },
        { icon: "map", label: "Incident map", desc: "See where each story happened.", go: "#/map" }
      ];
      return `<div class="stage welcome">
        <h1>${greeting()}, ${esc(u.name.split(" ")[0])}</h1>
        <p class="lede">Stories, photographs and records from Kenya's coast, lakes and rivers.</p>
        ${orbRow(u.role === "admin" ? admin : user)}
      </div>
      ${S.prefs.lowBw ? "" : `<div class="slide-bar"><div class="dots">${CLIPS.map((c, i) => `<button aria-label="Show clip ${i + 1}: ${esc(c.caption)}"></button>`).join("")}</div><span id="slideCap">${esc(CLIPS[UI.slide % CLIPS.length].caption)}</span></div>
      <div class="credit">Footage: Mixkit (free licence)</div>`}`;
    },
    after() {
      $$(".dots button").forEach((d, i) => (d.onclick = () => { showSlide(i); startSlides(); }));
      $$(".dots button").forEach((d, k) => d.classList.toggle("on", k === UI.slide % CLIPS.length));
      cleanup.push(() => clearInterval(slideTimer));
    }
  };

  /* ----- Browse & search ----- */
  ROUTES.browse = {
    title: "Browse the archive",
    bg: "search",
    html(parts, qs) {
      const o = { q: qs.get("q") || "", type: qs.get("type") || "", waters: qs.getAll("water"), decade: qs.get("decade") || "", county: qs.get("county") || "", sort: qs.get("sort") || "" };
      const res = runSearch(o);
      const per = 9, pageN = Math.max(1, +qs.get("page") || 1), pages = Math.max(1, Math.ceil(res.length / per));
      const shown = res.slice((pageN - 1) * per, pageN * per);
      const nFilters = o.waters.length + (o.decade ? 1 : 0) + (o.county ? 1 : 0) + (o.sort ? 1 : 0);
      const link = (patch) => { const p = new URLSearchParams(qs); p.delete("page"); for (const k in patch) { if (patch[k]) p.set(k, patch[k]); else p.delete(k); } return "#/browse" + (p.toString() ? "?" + p.toString() : ""); };
      const dropWater = (v) => { const p = new URLSearchParams(qs); const w = p.getAll("water").filter((x) => x !== v); p.delete("water"); p.delete("page"); w.forEach((x) => p.append("water", x)); return "#/browse?" + p.toString(); };
      const chips = [...o.waters.map((w) => [dropWater(w), WATER_ICONS[w] || "waves", w]), o.decade && [link({ decade: "" }), "calendar", o.decade + "s"], o.county && [link({ county: "" }), "map-pin", o.county]].filter(Boolean);
      return `<div class="stage">
        ${head(o.type ? TYPES[o.type].plural : "Browse the archive", "", true)}
        <form class="searchbar" id="sform" role="search">${ic("search")}<label for="q" class="sr">Search the archive</label>
          <input id="q" value="${esc(o.q)}" placeholder="Search stories, places, years, transcripts"><button>Search</button></form>
        ${orbRow([
          { icon: "layers", label: "Everything", desc: "Show all types of material.", go: link({ type: "" }), on: !o.type },
          ...Object.keys(TYPES).map((t) => ({ icon: TYPES[t].icon, label: TYPES[t].plural, desc: `Show only ${TYPES[t].plural.toLowerCase()}.`, go: link({ type: t }), on: o.type === t })),
          { icon: "sliders-horizontal", label: nFilters ? `Filters (${nFilters})` : "Filters", desc: "Narrow by water body, decade or county, or change the order.", act: () => filterSheet(qs) }
        ])}
        <div class="results-line"><b style="color:#fff">${res.length} item${res.length === 1 ? "" : "s"}</b>${o.q ? `<span>matching "${esc(o.q)}"</span>` : ""}
          ${chips.map(([h, i, l]) => `<a class="chip on" href="${h}" title="Remove this filter">${ic(i)}${esc(l)}${ic("x")}</a>`).join("")}
          ${!o.q && !chips.length ? `<span>Try</span>${["life jackets", "ferry", "wind", "rescue", "children"].map((s) => `<a class="chip" href="${link({ q: s })}">${esc(s)}</a>`).join("")}` : ""}</div>
        ${shown.length ? `<div class="grid g3">${shown.map((r) => recCard(r, o.q)).join("")}</div>`
          : `<div class="panel empty">${ic("waves")}<h3>Nothing matches yet</h3><p>Try fewer words or remove a filter.</p><a class="btn" href="#/browse">Clear search and filters</a></div>`}
        ${pages > 1 ? `<div class="row" style="justify-content:center;margin-top:22px">${Array.from({ length: pages }, (_, i) => `<a class="pill" ${i + 1 === pageN ? 'aria-pressed="true"' : ""} href="${link({ page: i + 1 })}" aria-label="Page ${i + 1}">${i + 1}</a>`).join("")}</div>` : ""}
      </div>`;
    },
    after(parts, qs) {
      $("#sform").onsubmit = (e) => { e.preventDefault(); const p = new URLSearchParams(qs); p.delete("page"); const v = $("#q").value.trim(); if (v) p.set("q", v); else p.delete("q"); go("#/browse?" + p.toString()); };
    }
  };
  function filterSheet(qs) {
    const pub = published();
    const decades = [...new Set(pub.map((r) => Math.floor(r.year / 10) * 10))].sort();
    const counties = [...new Set(pub.map((r) => r.county))].sort();
    const waters = qs.getAll("water");
    sheet("Filters", `
      <label>Water body</label>
      <div class="row" style="margin-bottom:16px">${SEED.waterBodies.map((w) => `<button type="button" class="chip ${waters.includes(w) ? "on" : ""}" data-w="${esc(w)}" aria-pressed="${waters.includes(w)}">${ic(WATER_ICONS[w] || "waves")}${esc(w)}</button>`).join("")}</div>
      <div class="field"><label for="fd">Decade</label><select id="fd"><option value="">Any decade</option>${decades.map((d) => `<option value="${d}" ${qs.get("decade") == d ? "selected" : ""}>${d}s</option>`).join("")}</select></div>
      <div class="field"><label for="fcn">County</label><select id="fcn"><option value="">Any county</option>${counties.map((c) => `<option ${qs.get("county") === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="field"><label for="fs">Order</label><select id="fs">${[["", "Best match, then newest"], ["newest", "Newest first"], ["oldest", "Oldest first"], ["popular", "Most viewed"]].map(([v, l]) => `<option value="${v}" ${(qs.get("sort") || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row"><button class="btn" id="fApply">${ic("check")}Show results</button><button class="btn ghost" id="fClear">Clear filters</button></div>`, (w) => {
      $$("[data-w]", w).forEach((b) => (b.onclick = () => { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); }));
      const base = () => { const p = new URLSearchParams(); if (qs.get("q")) p.set("q", qs.get("q")); if (qs.get("type")) p.set("type", qs.get("type")); return p; };
      $("#fApply", w).onclick = () => {
        const p = base();
        $$("[data-w].on", w).forEach((b) => p.append("water", b.dataset.w));
        if ($("#fd", w).value) p.set("decade", $("#fd", w).value); if ($("#fcn", w).value) p.set("county", $("#fcn", w).value); if ($("#fs", w).value) p.set("sort", $("#fs", w).value);
        closeSheet(); go("#/browse?" + p.toString());
      };
      $("#fClear", w).onclick = () => { closeSheet(); go("#/browse?" + base().toString()); };
    });
  }

  /* ----- Record ----- */
  ROUTES.record = {
    title: "Archive item",
    bg: (parts) => { const r = S.records.find((x) => x.id === parts[1]); return r ? TYPES[r.type].icon : "archive"; },
    html(parts) {
      const r = S.records.find((x) => x.id === parts[1]);
      if (!r || (r.status !== "published" && !isAdmin())) return `<div class="stage narrow panel empty">${ic("compass")}<h2>This item isn't available</h2><p>It may have been unpublished.</p><a class="btn" href="#/browse">Back to the archive</a></div>`;
      if (ROUTES.record._counted !== r.id) { r.views++; save(); ROUTES.record._counted = r.id; }
      const related = published().filter((x) => x.id !== r.id && (x.waterBody === r.waterBody || x.tags.some((t) => r.tags.includes(t)))).slice(0, 3);
      let media = "";
      if (r.format === "audio") {
        media = `<div class="player"><button class="play" id="playBtn" aria-label="Play">${ic("play")}</button>
          <div class="wave" id="wave" aria-hidden="true">${Array.from({ length: 64 }, (_, i) => `<i style="height:${18 + (hash(r.id + i) % 82)}%"></i>`).join("")}</div>
          <span class="time" id="time">0:00 / ${fmt(r.duration)}</span></div>`;
      } else if (r.format === "video") {
        media = `<div class="media vframe"><img src="${art(r, 800, 450, true)}" alt="Video still: ${esc(r.title)}"><div class="subs" id="subs">${esc(r.transcript[0][1])}</div>
          <div class="vbar"><button class="play" id="playBtn" aria-label="Play">${ic("play")}</button><div class="track" id="wave"><b id="vprog"></b></div><span class="time" id="time">0:00 / ${fmt(r.duration)}</span></div>
          <span class="watermark" style="top:12px;bottom:auto">${ic("life-buoy")}Remembering the Waters</span></div>`;
      } else if (r.format === "image") {
        media = `<div class="media"><img class="media-img" src="${art(r, 1200, 675)}" alt="${esc(r.summary)}"><span class="watermark">${ic("life-buoy")}Remembering the Waters, ${r.id}</span></div>`;
      } else if (r.format === "document") {
        media = `<div class="scan">${r.pages.map((p) => `<p>${esc(p)}</p>`).join("")}<span class="stamp">ARCHIVE COPY</span></div>`;
      } else {
        media = `<blockquote class="quote">${ic("quote")}${esc(r.body)}</blockquote>`;
      }
      const transcript = r.transcript ? `<div class="panel transcript" aria-label="Transcript">${r.transcript.map(([t, line]) => `<p data-t="${t}"><span class="ts">${fmt(t)}</span><span>${esc(line)}</span></p>`).join("")}</div>` : "";
      return `<div class="stage narrow">
        <a class="pill" href="#/browse" style="margin-bottom:18px">${ic("arrow-left")}Back to the archive</a>
        ${r.status !== "published" ? `<div class="panel row" style="margin-bottom:16px">${ic("eye")}<span>This item is <b>${r.status}</b>. Only admins can see it.</span></div>` : ""}
        <div class="rec-head"><span class="rec-ic">${ic(TYPES[r.type].icon)}</span><div>
          <h1 style="font-size:clamp(1.6rem,3.4vw,2.3rem);margin-bottom:.3em">${esc(r.title)}</h1>
          <div class="facts"><span>${ic("map-pin")}${esc(r.place)}</span><span>${ic("calendar")}${r.year}</span>${r.duration ? `<span>${ic("clock")}${fmt(r.duration)}</span>` : ""}<span>${ic("eye")}${r.views.toLocaleString()} views</span></div></div></div>
        <p class="muted" style="font-size:1.04rem">${esc(r.summary)}</p>
        ${media}${transcript}
        ${orbRow([
          r.duration && { icon: "play", label: "Play", desc: "Plays the recording. The transcript follows along.", act: () => $("#playBtn").click(), id: "orbPlay", primary: true },
          { icon: "info", label: "Details", desc: "The full catalogue record: people, language, consent and rights.", act: () => detailsModal(r), primary: !r.duration },
          { icon: "map-pin", label: "Location", desc: "Where this happened, on the map.", act: () => locationModal(r) },
          { icon: "quote", label: "Cite", desc: "A ready-made citation for your work.", act: () => citeModal(r) },
          { icon: "share-2", label: "Share", desc: "Copies a link to this item.", act: () => { try { navigator.clipboard.writeText(location.href); } catch (e) {} toast("Link copied", "link"); } },
          isAdmin() && { icon: "pencil", label: "Edit", desc: "Change this item's metadata (admins only).", go: "#/admin/edit/" + r.id }
        ])}
        ${related.length ? `<h2>Related items</h2><div class="grid g3">${related.map((x) => recCard(x)).join("")}</div>` : ""}
      </div>`;
    },
    after(parts) {
      const r = S.records.find((x) => x.id === parts[1]);
      if (r && r.duration && $("#playBtn")) setupPlayer(r);
    }
  };
  function detailsModal(r) {
    const rows = [["tag", "Identifier", r.id], [TYPES[r.type].icon, "Type", TYPES[r.type].label], ["calendar", "Date", r.year], ["map-pin", "Place", r.place + ", " + r.county + " County"], ["waves", "Water body", r.waterBody],
      ["user", "Narrator", r.narrator], ["mic", "Interviewer", r.interviewer], ["camera", "Photographer", r.photographer], ["users", "Creator", r.creator], ["globe", "Language", r.language],
      ["clock", "Duration", r.duration && fmt(r.duration)], ["badge-check", "Consent", r.consent], ["shield", "Rights", r.rights], ["history", "Added", r.added]].filter((x) => x[2]);
    modal("info", "Catalogue record", `<dl class="meta-list">${rows.map(([i, k, v]) => `${ic(i)}<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <h3 style="margin-top:18px">Subjects</h3><div class="row">${r.tags.map((t) => `<a class="chip" href="#/browse?q=${encodeURIComponent(t)}">${ic("tag")}${esc(t)}</a>`).join("")}</div>
      <p class="hint" style="margin-top:16px">© Remembering the Waters and contributors. Shared under ${esc(r.rights)}. Please credit the archive and ${r.id} when reusing.</p>`, null, true);
  }
  function locationModal(r) {
    modal("map-pin", r.place, `<p class="muted">${esc(r.county)} County, ${esc(r.waterBody)}</p><div class="mini-map" id="miniMap"></div><a class="btn ghost sm" style="margin-top:14px" href="#/map">${ic("map")}Open the full map</a>`, () => drawMap($("#miniMap"), [r], { zoom: 8, center: [r.lat, r.lng], mini: true }));
  }
  function citeModal(r) {
    const c = `${r.narrator || r.creator}. "${r.title}." ${r.year}. Maritime Safety Heritage Archive, Remembering the Waters, ${r.id}.`;
    modal("quote", "Cite this item", `<p class="panel" style="font-family:var(--display)">${esc(c)}</p><button class="btn" id="cpy">${ic("copy")}Copy citation</button>`, () => { $("#cpy").onclick = () => { try { navigator.clipboard.writeText(c); } catch (e) {} closeModal(); toast("Citation copied", "copy"); }; });
  }
  function setupPlayer(r) {
    let t = 0, playing = false, iv = null;
    const SPEED = 6; // prototype plays at 6x so a demo moves along
    const btn = $("#playBtn"), time = $("#time"), bars = $$("#wave i"), prog = $("#vprog"), subs = $("#subs"), lines = $$(".transcript p[data-t]");
    const orbBtn = $("#orbPlay");
    function paint() {
      const f = t / r.duration;
      time.textContent = fmt(t) + " / " + fmt(r.duration);
      bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < f));
      if (prog) prog.style.width = f * 100 + "%";
      let cur = 0; r.transcript.forEach(([s], i) => { if (t >= s) cur = i; });
      lines.forEach((l, i) => l.classList.toggle("now", i === cur && (playing || t > 0)));
      const box = $(".transcript"), nowLine = lines[cur];
      if (box && nowLine && playing) box.scrollTop = nowLine.offsetTop - box.offsetTop - 40;
      if (subs) subs.textContent = r.transcript[cur][1];
    }
    function setIcon(p) {
      btn.innerHTML = ic(p ? "pause" : "play"); btn.setAttribute("aria-label", p ? "Pause" : "Play");
      if (orbBtn) { orbBtn.innerHTML = ic(p ? "pause" : "play"); orbBtn.parentElement.querySelector(".orb-label").textContent = p ? "Pause" : "Play"; orbBtn.dataset.desc = p ? "Pauses the recording." : "Plays the recording. The transcript follows along."; orbBtn.parentElement.querySelector(".orb-desc").textContent = orbBtn.dataset.desc; }
    }
    function stop() { playing = false; clearInterval(iv); setIcon(false); }
    function play() { if (t >= r.duration) t = 0; playing = true; setIcon(true); iv = setInterval(() => { t += 0.25 * SPEED; if (t >= r.duration) { t = r.duration; stop(); } paint(); }, 250); }
    btn.onclick = () => (playing ? stop() : play());
    $("#wave").onclick = (e) => { const b = e.currentTarget.getBoundingClientRect(); t = ((e.clientX - b.left) / b.width) * r.duration; paint(); };
    lines.forEach((l) => (l.onclick = () => { t = +l.dataset.t; paint(); if (!playing) play(); }));
    cleanup.push(stop);
    paint();
  }

  /* ----- Map ----- */
  function pinIcon(r) { return window.L.divIcon({ className: "", html: `<div class="pin">${ic(TYPES[r.type].icon)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }); }
  function drawMap(el, recs, o = {}) {
    if (!el) return null;
    if (window.L) {
      const m = window.L.map(el, { scrollWheelZoom: !o.mini, zoomControl: !o.mini }).setView(o.center || [0.1, 37.9], o.zoom || 6);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abcd", attribution: "© OpenStreetMap contributors © CARTO" }).addTo(m);
      const markers = {};
      recs.forEach((r) => {
        markers[r.id] = window.L.marker([r.lat, r.lng], { icon: pinIcon(r), title: r.title }).addTo(m)
          .bindPopup(`${typeTag(r.type)}<br><b>${esc(r.title)}</b><br><span style="color:#93a7c6">${esc(r.place)}, ${r.year}</span><br><a href="#/record/${r.id}">Open this item</a>`);
      });
      setTimeout(() => m.invalidateSize(), 80);
      cleanup.push(() => m.remove());
      return { focus: (id) => { const r = recs.find((x) => x.id === id); m.flyTo([r.lat, r.lng], 9, { duration: 1.2 }); setTimeout(() => markers[id].openPopup(), 1250); } };
    }
    const B = { n: 5.0, s: -4.9, w: 33.8, e: 41.9 };
    const pos = (r) => [((r.lng - B.w) / (B.e - B.w)) * 100, ((B.n - r.lat) / (B.n - B.s)) * 100];
    el.innerHTML = `<div class="fallback-map">${[["Lake Victoria", -0.6, 33.95], ["Lake Turkana", 3.9, 35.9], ["Indian Ocean", -3.4, 40.7], ["Nairobi", -1.29, 36.82]].map(([n, la, ln]) => { const [x, y] = pos({ lat: la, lng: ln }); return `<span class="fm-label" style="left:${x}%;top:${y}%">${n}</span>`; }).join("")}
      ${recs.map((r) => { const [x, y] = pos(r); return `<a class="fm-pin" href="#/record/${r.id}" title="${esc(r.title)}" style="left:${x}%;top:${y}%"><span class="pin">${ic(TYPES[r.type].icon)}</span></a>`; }).join("")}
      <span class="fm-label" style="left:12px;top:12px;font-style:normal">${ic("wifi-off")} Offline map view. Connect to the internet for the full map.</span></div>`;
    return { focus: (id) => go("#/record/" + id) };
  }
  ROUTES.map = {
    title: "Incident map",
    bg: "map",
    html(parts, qs) {
      const t = qs.get("type") || "";
      return `<div class="mapwrap"><div id="bigmap" role="region" aria-label="Map of archive items"></div></div>
        ${orbRow([
          { icon: "layers", label: "Everything", desc: "Show every item on the map.", go: "#/map", on: !t },
          ...Object.keys(TYPES).map((k) => ({ icon: TYPES[k].icon, label: TYPES[k].plural, desc: `Show only ${TYPES[k].plural.toLowerCase()}.`, go: "#/map?type=" + k, on: t === k })),
          { icon: "list", label: "List", desc: "A list of the items on the map. Pick one to fly to it.", act: () => mapList(t) }
        ], "map-orbs")}`;
    },
    after(parts, qs) {
      const t = qs.get("type") || "";
      ROUTES.map._m = drawMap($("#bigmap"), published().filter((r) => !t || r.type === t), {});
    }
  };
  function mapList(t) {
    const recs = published().filter((r) => !t || r.type === t);
    sheet(`${recs.length} places`, recs.map((r) => `<div class="list-item" tabindex="0" role="button" data-id="${r.id}"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${esc(r.title)}</b><span>${esc(r.place)}, ${r.year}</span></span></div>`).join(""), (w) => {
      $$("[data-id]", w).forEach((el) => { const f = () => { const m = ROUTES.map._m; if (window.innerWidth < 760) closeSheet(); if (m) m.focus(el.dataset.id); }; el.onclick = f; el.onkeydown = (e) => { if (e.key === "Enter") f(); }; });
    });
  }

  /* ----- Contribute ----- */
  ROUTES.submit = {
    title: "Share a story",
    bg: "hand-heart",
    html(parts, qs) {
      const t = qs.get("type");
      const mine = S.submissions.filter((s) => s.by === S.session);
      return `<div class="stage narrow">
        ${head("Share a story or material", "The research team checks consent and catalogues every submission before it appears in the archive.", true)}
        ${orbRow([
          ...Object.keys(TYPES).map((k) => ({ icon: TYPES[k].icon, label: TYPES[k].label, desc: { oral: "A recorded memory: audio or video.", photo: "A photograph from a family or community collection.", record: "A document, licence, notice or report.", testimony: "Your own written account." }[k], go: "#/submit?type=" + k, on: t === k })),
          { icon: "folder-open", label: "My submissions", desc: "What you've sent and its review status.", act: () => mySubmissions(), badge: mine.filter((s) => s.status === "pending").length || "" }
        ])}
        ${t ? `<form class="panel" id="subForm">
          <div class="row" style="margin-bottom:16px">${typeTag(t)}<span class="muted small">Change the type with the circles above.</span></div>
          <div class="field"><label for="st">Title</label><input id="st" required placeholder="For example: My grandfather's fishing boat at Mbita"></div>
          <div class="grid g2"><div class="field"><label for="sy">Year (approximate)</label><input id="sy" type="number" min="1900" max="2026" placeholder="1985"></div>
          <div class="field"><label for="sp">Place</label><input id="sp" placeholder="Beach, village or town"></div></div>
          <div class="field"><label>Water body</label><div class="seg">${SEED.waterBodies.map((w, i) => `<input type="radio" name="sw" id="sw${i}" value="${esc(w)}" ${i === 0 ? "checked" : ""}><label for="sw${i}">${ic(WATER_ICONS[w])}${esc(w)}</label>`).join("")}</div></div>
          <div class="field"><label for="sd">Tell us about it</label><textarea id="sd" required placeholder="Who, what, when, and the safety lesson it holds"></textarea></div>
          <div class="field"><label>File</label><div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a file">${ic("file-up")}<div><b>Drop a file here</b> or choose one</div><div class="hint">Audio, video, photo or PDF, up to 500 MB in the full build</div><div id="fname" class="small" style="color:var(--sky);margin-top:6px"></div></div><input type="file" id="sf" hidden></div>
          <label class="check field"><input type="checkbox" id="sc" required> I have the right to share this, and everyone recorded or pictured has agreed.</label>
          <button class="btn">${ic("upload")}Send for review</button></form>`
          : `<div class="panel empty">${ic("hand-heart")}<h3>Choose what you're sharing</h3><p>Pick one of the circles above to start.</p></div>`}
      </div>`;
    },
    after(parts, qs) {
      const t = qs.get("type"); if (!t) return;
      let fileName = "";
      dropzone($("#drop"), $("#sf"), (f) => { if (f) { fileName = f.name; $("#fname").textContent = "Selected: " + f.name; } });
      $("#subForm").onsubmit = (e) => {
        e.preventDefault();
        const s = { id: "SUB-" + (100 + S.submissions.length + 1), by: S.session, date: today(), status: "pending", title: $("#st").value.trim(), type: t, year: +$("#sy").value || null,
          waterBody: $("[name=sw]:checked").value, place: $("#sp").value.trim(), county: "", description: $("#sd").value.trim(), file: fileName || "(no file attached)", consent: true };
        S.submissions.unshift(s); logAct(`submitted '${s.title}' for review`); save();
        toast("Sent. The research team will review it.", "circle-check"); go("#/submit");
      };
    }
  };
  function mySubmissions() {
    const mine = S.submissions.filter((s) => s.by === S.session);
    modal("folder-open", "My submissions", mine.length ? mine.map((s) => `<div class="list-item"><span class="li-ic">${ic(TYPES[s.type].icon)}</span><span class="li-main"><b>${esc(s.title)}</b><span>Sent ${s.date}</span></span>${status(s.status)}</div>`).join("") : `<p class="muted">Nothing yet. Choose a type of material to share your first story.</p>`);
  }

  /* ----- Contact ----- */
  ROUTES.contact = {
    title: "Contact",
    bg: "mail",
    html() {
      const u = me();
      return `<div class="stage narrow">${head("Talk to the research team", "Questions about the archive, reusing material, or a story you'd like recorded.", true)}
        ${orbRow([
          { icon: "mail", label: "Write", desc: "Fill in the form below. The team replies by email.", act: () => $("#cs").focus(), primary: true },
          { icon: "phone", label: "Call", desc: "Phone details are added in the full build.", act: () => toast("Phone details are added in the full build", "phone") },
          { icon: "shield", label: "Reusing material", desc: "Most items can be reused with credit. Check each item's licence.", act: () => modal("shield", "Reusing material", `<p>Each item shows its licence in its catalogue record. Most are shared under CC BY-NC 4.0: you can reuse them for non-commercial work if you credit the archive and the item number.</p>`) }
        ])}
        <form class="panel" id="cForm">
          <div class="grid g2"><div class="field"><label for="cn">Your name</label><input id="cn" required value="${esc(u ? u.name : "")}"></div>
          <div class="field"><label for="ce">Email</label><input id="ce" type="email" required value="${esc(u ? u.email : "")}"></div></div>
          <div class="field"><label for="cs">Subject</label><input id="cs" required></div>
          <div class="field"><label for="cb">Message</label><textarea id="cb" required></textarea></div>
          <button class="btn">${ic("mail")}Send message</button></form></div>`;
    },
    after() {
      $("#cForm").onsubmit = (e) => {
        e.preventDefault();
        S.messages.unshift({ id: "M" + Date.now(), name: $("#cn").value, email: $("#ce").value, subject: $("#cs").value, body: $("#cb").value, date: today(), read: false });
        save(); toast("Message sent. The team usually replies within 3 working days.", "mail"); go("#/home");
      };
    }
  };

  /* ----- About ----- */
  ROUTES.about = {
    title: "About",
    bg: "anchor",
    html() {
      const info = [
        ["globe", "Open access", "Free to everyone with an account, on the web and on the Android and iOS app."],
        ["badge-check", "Respectful", "Every item carries its consent and rights. Narrators can stay anonymous."],
        ["archive", "Catalogued", "Standard metadata for every item: identifier, date, place, creator, language, rights and subjects, for long-term preservation."],
        ["wifi-off", "Slow-connection friendly", "Light mode hides images and video to save data. Find it under See more."]
      ];
      return `<div class="stage">${head("Remembering the Waters", "Kenya's first national digital archive of maritime and inland-water safety heritage, gathered so its lessons stay with communities, researchers, educators and policymakers.", true)}
        ${orbRow(info.map(([i, l, d]) => ({ icon: i, label: l, desc: d, act: () => modal(i, l, `<p>${d}</p>`) })))}
        <h2 class="center">How the archive is being built</h2>
        <div class="steps">${[["Discovery and design", "Month 12", "Requirements, metadata and this prototype"], ["Build", "Months 13 to 14", "Website, app, search and map on a test site"], ["Content and testing", "Months 14 to 15", "Materials catalogued, then tested and secured"], ["Launch and handover", "Month 16", "Public launch, training and full ownership"]]
          .map(([t, w, d], i) => `<div class="step panel"><div class="num">${i + 1}</div><b>${t}</b><span class="muted small" style="display:block;margin:4px 0">${w}</span><span>${d}</span></div>`).join("")}</div>
        <p class="center muted small" style="margin-top:24px">Developer: Francis Mutuku, contactfrancismutuku@gmail.com</p></div>`;
    }
  };

  /* ----- Sign in ----- */
  ROUTES.login = {
    title: "Sign in",
    bg: "life-buoy",
    html(parts, qs) {
      const up = qs.get("tab") === "up";
      return `<div class="stage">${head("Welcome aboard", "Everyone signs in with their own account, on the website or the app.", true)}
        <div class="panel auth-card">
          <div class="tabs" role="tablist"><button class="${up ? "" : "on"}" data-tab="in" role="tab">Sign in</button><button class="${up ? "on" : ""}" data-tab="up" role="tab">Create account</button></div>
          <form id="inForm" ${up ? "hidden" : ""}><div class="field"><label for="le">Email</label><input id="le" type="email" required autocomplete="username"></div>
            <div class="field"><label for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"></div>
            <div class="err" id="lerr"></div>
            <button class="btn" style="width:100%">${ic("log-in")}Sign in</button>
            <p class="small center" style="margin:12px 0 0"><a href="#" id="forgot">Forgot your password?</a></p></form>
          <form id="upForm" ${up ? "" : "hidden"}><div class="field"><label for="un">Full name</label><input id="un" required></div>
            <div class="field"><label for="ue">Email</label><input id="ue" type="email" required></div>
            <div class="field"><label for="uo">Organisation or community (optional)</label><input id="uo"></div>
            <div class="field"><label for="up">Password</label><input id="up" type="password" minlength="8" required><div class="hint">At least 8 characters.</div></div>
            <button class="btn" style="width:100%">${ic("user-plus")}Create account</button></form>
        </div>
        <p class="center muted small" style="margin:28px 0 0">Prototype demo accounts</p>
        <div class="orbs" style="margin-top:12px">
          ${orb({ icon: "user", label: "Researcher", desc: "Signs in as Peter, a normal user.", act: () => demo("researcher@demo.ke") })}
          ${orb({ icon: "user-round-cog", label: "Admin", desc: "Signs in as Grace, a research team admin.", act: () => demo("admin@demo.ke"), n: 1 })}
          ${seeMoreOrb(2)}
        </div></div>`;
    },
    after() {
      $$("[data-tab]").forEach((b) => (b.onclick = () => { $$("[data-tab]").forEach((x) => x.classList.toggle("on", x === b)); $("#inForm").hidden = b.dataset.tab !== "in"; $("#upForm").hidden = b.dataset.tab !== "up"; }));
      $("#inForm").onsubmit = (e) => { e.preventDefault(); attempt($("#le").value.trim(), $("#lp").value); };
      $("#upForm").onsubmit = (e) => {
        e.preventDefault();
        const email = $("#ue").value.trim();
        if (S.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return toast("An account with that email already exists. Sign in instead.", "info");
        const u = { id: "U" + Date.now(), name: $("#un").value.trim(), email, password: $("#up").value, role: "user", status: "active", joined: today(), org: $("#uo").value.trim() };
        S.users.push(u); save(); finish(u);
      };
      $("#forgot").onclick = (e) => { e.preventDefault(); modal("key-round", "Reset your password", `<p class="muted">In the full build a one-time reset link is emailed to you. In the prototype, an admin can reset it from Users and roles.</p>`); };
    }
  };
  function finish(u) {
    S.session = u.id; logAct("signed in"); const back = S.afterLogin; S.afterLogin = null; save(); UI.more = false;
    toast(`Welcome, ${u.name.split(" ")[0]}`, "life-buoy");
    const target = back && back !== "#/login" ? back : "#/home";
    if (location.hash === target) render(); else go(target);
  }
  function attempt(email, pw) {
    const u = S.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    const err = $("#lerr");
    if (!u || u.password !== pw) { if (err) err.textContent = "That email and password don't match. Check them and try again."; return; }
    if (u.status === "suspended") { if (err) err.textContent = "This account is suspended. Contact the research team."; return; }
    finish(u);
  }
  function demo(email) { const u = S.users.find((x) => x.email === email); if (u) attempt(u.email, u.password); }

  /* ----- My account ----- */
  ROUTES.profile = {
    title: "My account",
    bg: "user",
    html() {
      const u = me();
      return `<div class="stage narrow center">
        <span class="avatar" style="width:84px;height:84px;font-size:1.8rem;margin:0 auto 14px">${initials(u.name)}</span>
        ${head(esc(u.name), `${esc(u.email)}<br>${u.role === "admin" ? "Admin" : "Member"} since ${u.joined}${u.org ? ", " + esc(u.org) : ""}`, true)}
        ${orbRow([
          { icon: "pencil", label: "Edit profile", desc: "Change your name or organisation.", act: editProfile, primary: true },
          { icon: "key-round", label: "Password", desc: "Change your password.", act: changePassword },
          { icon: "folder-open", label: "My submissions", desc: "What you've sent and its review status.", act: mySubmissions },
          { icon: "log-out", label: "Sign out", desc: "Signs you out on this device.", act: () => $("#logout").click() }
        ])}</div>`;
    }
  };
  function editProfile() {
    const u = me();
    modal("pencil", "Edit profile", `<form id="pForm"><div class="field"><label for="pn">Name</label><input id="pn" value="${esc(u.name)}" required></div>
      <div class="field"><label for="po">Organisation or community</label><input id="po" value="${esc(u.org || "")}"></div><button class="btn">${ic("check")}Save profile</button></form>`, () => {
      $("#pForm").onsubmit = (e) => { e.preventDefault(); u.name = $("#pn").value.trim(); u.org = $("#po").value.trim(); logAct("updated their profile"); save(); closeModal(); toast("Profile saved"); render(); };
    });
  }
  function changePassword() {
    modal("key-round", "Change password", `<form id="pwForm"><div class="field"><label for="p1">Current password</label><input id="p1" type="password" required></div>
      <div class="field"><label for="p2">New password</label><input id="p2" type="password" minlength="8" required><div class="hint">Stored as a salted hash in the full build, never as plain text.</div></div>
      <div class="err" id="pwErr"></div><button class="btn">${ic("check")}Change password</button></form>`, () => {
      $("#pwForm").onsubmit = (e) => { e.preventDefault(); const u = me(); if ($("#p1").value !== u.password) { $("#pwErr").textContent = "Your current password is wrong."; return; } u.password = $("#p2").value; logAct("changed their password"); save(); closeModal(); toast("Password changed", "key-round"); };
    });
  }

  /* ----- App preview ----- */
  ROUTES.app = {
    title: "Mobile app",
    bg: "smartphone",
    html() {
      return `<div class="stage">${head("The same archive, in your pocket", "One hybrid app for Android and iOS phones and tablets, using the same secure API and database as the website. Try it inside the phone.", true)}
        <div class="app-stage"><div class="phone"><iframe src="index.html?app=1#/home" title="Mobile app preview"></iframe></div>
        <div class="panel" style="max-width:380px"><h3>What the app does</h3><ul class="feature-list">
          ${[["log-in", "Sign in with the same account as the website"], ["search", "Search, browse and filter"], ["map", "Incident map with GPS \"near me\" (full build)"], ["headphones", "Play oral histories and read transcripts"], ["camera", "Share stories and photos from the phone camera (full build)"], ["inbox", "Admins can review submissions on the go"]]
            .map(([i, t]) => `<li><span class="li-ic">${ic(i)}</span>${t}</li>`).join("")}</ul>
          <p class="hint">Store-ready for Google Play and the Apple App Store in the full build.</p></div></div>
        <div class="orbs">${seeMoreOrb(0)}</div></div>`;
    }
  };
  ROUTES.notfound = { bg: "compass", html: () => `<div class="stage narrow panel empty">${ic("compass")}<h2>That page doesn't exist</h2><a class="btn" href="#/home">Go to the welcome page</a></div>` };

  /* =====================================================================
     ADMIN
     ===================================================================== */
  const ADMIN = {};
  const dash = { icon: "chart-column", label: "Dashboard", desc: "Back to the admin dashboard.", go: "#/admin" };
  ROUTES.admin = {
    title: "Admin",
    bg: (parts) => ({ records: "archive", upload: "upload", edit: "pencil", submissions: "inbox", users: "users", messages: "mail", activity: "activity" }[parts[1]] || "chart-column"),
    html(parts, qs) { return `<div class="stage">${(ADMIN[parts[1] || "overview"] || ADMIN.overview).html(parts, qs)}</div>`; },
    after(parts, qs) { const v = ADMIN[parts[1] || "overview"] || ADMIN.overview; if (v.after) v.after(parts, qs); }
  };
  ADMIN.overview = {
    html() {
      const pub = published();
      const max = Math.max(...S.visitsByMonth.map((x) => x[1]));
      return `${head("Archive dashboard", "What's happening in the archive today.", true)}
        <div class="grid g4">
          <div class="kpi"><span class="li-ic">${ic("archive")}</span><div><b>${pub.length}</b><span>Published items</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("pencil")}</span><div><b>${S.records.length - pub.length}</b><span>Drafts and unpublished</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("inbox")}</span><div><b>${pending().length}</b><span>Waiting for review</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("users")}</span><div><b>${S.users.length}</b><span>Registered users</span></div></div>
        </div>
        ${orbRow([
          { icon: "archive", label: "Records", desc: "Edit, publish or unpublish items.", go: "#/admin/records" },
          { icon: "upload", label: "Upload", desc: "Add a new item and catalogue it.", go: "#/admin/upload", primary: true },
          { icon: "inbox", label: "Review", desc: "Approve or reject material sent in by the public.", go: "#/admin/submissions", badge: pending().length || "" },
          { icon: "users", label: "Users", desc: "Create users, change roles, suspend accounts.", go: "#/admin/users" },
          { icon: "mail", label: "Messages", desc: "Messages from the contact form.", go: "#/admin/messages", badge: unread().length || "" },
          { icon: "activity", label: "Reports", desc: "Usage, collection health and the activity log.", go: "#/admin/activity" }
        ])}
        <div class="grid g2">
          <div class="panel"><h3>${ic("trending-up")} Visits per month</h3><div class="bars">${S.visitsByMonth.map(([m, v]) => `<div class="b"><em>${v.toLocaleString()}</em><i style="height:${(v / max) * 82}%"></i><small>${m}</small></div>`).join("")}</div></div>
          <div class="panel"><h3>${ic("history")} Recent activity</h3><ul class="log">${S.activity.slice(0, 5).map((a) => `<li><span class="li-ic">${ic("activity")}</span><div><time>${a.t}</time><b>${esc(a.who)}</b> ${esc(a.what)}</div></li>`).join("")}</ul></div>
        </div>`;
    }
  };

  ADMIN.records = {
    html(parts, qs) {
      const f = qs.get("f") || "", st = qs.get("s") || "";
      const list = S.records.filter((r) => (!st || r.status === st) && (!f || (r.title + r.id + r.place).toLowerCase().includes(f.toLowerCase())));
      return `${head("Records", `${list.length} of ${S.records.length} items${st ? `, ${st}` : ""}${f ? `, matching "${esc(f)}"` : ""}`, true)}
        ${orbRow([dash,
          { icon: "plus", label: "New item", desc: "Add and catalogue a new item.", go: "#/admin/upload", primary: true },
          { icon: "sliders-horizontal", label: "Filter", desc: "Find items by title, ID, place or status.", act: () => recordFilter(qs) },
          { icon: "download", label: "Export", desc: "Download the records list as a CSV file.", act: exportCsv }
        ])}
        <div class="panel tbl-wrap"><table class="tbl"><thead><tr><th><span class="sr">Type</span></th><th>Title</th><th>Place</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td><span class="li-ic" title="${TYPES[r.type].label}">${ic(TYPES[r.type].icon)}</span></td><td><a href="#/record/${r.id}"><b style="color:#fff">${esc(r.title)}</b></a><div class="small muted">${r.id}</div></td><td class="small">${esc(r.place)}</td><td>${status(r.status)}</td><td>${r.views}</td>
          <td><div class="actions"><a class="btn ghost sm" href="#/admin/edit/${r.id}">${ic("pencil")}Edit</a>${r.status === "published" ? `<button class="btn ghost sm" data-unpub="${r.id}">${ic("eye")}Unpublish</button>` : `<button class="btn sm" data-pub="${r.id}">${ic("check")}Publish</button>`}</div></td></tr>`).join("")}
        </tbody></table></div>`;
    },
    after() {
      $$("[data-pub]").forEach((b) => (b.onclick = () => { const r = S.records.find((x) => x.id === b.dataset.pub); r.status = "published"; logAct(`published ${r.id} '${r.title}'`); toast("Published"); render(); }));
      $$("[data-unpub]").forEach((b) => (b.onclick = () => { const r = S.records.find((x) => x.id === b.dataset.unpub); r.status = "unpublished"; logAct(`unpublished ${r.id} '${r.title}'`); toast("Unpublished. The public can no longer see it.", "eye"); render(); }));
    }
  };
  function recordFilter(qs) {
    sheet("Filter records", `<div class="field"><label for="rf">Title, ID or place</label><input id="rf" value="${esc(qs.get("f") || "")}"></div>
      <label>Status</label><div class="seg" style="margin-bottom:18px">${["", "published", "draft", "unpublished"].map((s, i) => `<input type="radio" name="rs" id="rs${i}" value="${s}" ${(qs.get("s") || "") === s ? "checked" : ""}><label for="rs${i}">${s ? s[0].toUpperCase() + s.slice(1) : "All"}</label>`).join("")}</div>
      <button class="btn" id="rfApply">${ic("check")}Apply</button>`, (w) => {
      $("#rfApply", w).onclick = () => { const p = new URLSearchParams(); if ($("#rf", w).value) p.set("f", $("#rf", w).value); const s = $("[name=rs]:checked", w).value; if (s) p.set("s", s); closeSheet(); go("#/admin/records" + (p.toString() ? "?" + p : "")); };
    });
  }
  function exportCsv() {
    const rows = [["id", "title", "type", "water_body", "county", "year", "status", "views"], ...S.records.map((r) => [r.id, r.title, r.type, r.waterBody, r.county, r.year, r.status, r.views])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "archive-records.csv"; a.click();
    logAct("exported the records list"); toast("Records list downloaded", "download");
  }

  function recordForm(r, fromSub) {
    const v = (k, d = "") => esc(r ? (r[k] ?? d) : (fromSub ? (fromSub[k] ?? d) : d));
    const type = r ? r.type : (fromSub ? fromSub.type : "oral");
    const water = (r || fromSub || {}).waterBody || SEED.waterBodies[0];
    return `<form class="panel" id="recForm">
      <div class="field"><label>Type of material</label><div class="seg">${Object.keys(TYPES).map((t) => `<input type="radio" name="ft" id="ft-${t}" value="${t}" ${t === type ? "checked" : ""}><label for="ft-${t}">${ic(TYPES[t].icon)}${TYPES[t].label}</label>`).join("")}</div></div>
      <div class="grid g2"><div class="field"><label for="fti">Title</label><input id="fti" required value="${v("title")}"></div>
        <div class="field"><label for="fid">Identifier</label><input id="fid" value="${r ? r.id : nextRecordId()}" disabled><div class="hint">Assigned automatically.</div></div></div>
      <div class="field"><label for="fsu">Summary</label><textarea id="fsu" required>${r ? esc(r.summary) : (fromSub ? esc(fromSub.description) : "")}</textarea></div>
      <div class="field"><label>Water body</label><div class="seg">${SEED.waterBodies.map((w, i) => `<input type="radio" name="fw" id="fw${i}" value="${esc(w)}" ${w === water ? "checked" : ""}><label for="fw${i}">${ic(WATER_ICONS[w])}${esc(w)}</label>`).join("")}</div></div>
      <div class="grid g3"><div class="field"><label for="fy">Year</label><input id="fy" type="number" required value="${v("year")}"></div>
        <div class="field"><label for="fp">Place</label><input id="fp" value="${v("place")}"></div>
        <div class="field"><label for="fc">County</label><input id="fc" value="${v("county")}"></div></div>
      <div class="grid g2"><div class="field"><label for="fla">Latitude</label><input id="fla" type="number" step="any" value="${v("lat", -1.29)}"></div>
        <div class="field"><label for="flo">Longitude</label><input id="flo" type="number" step="any" value="${v("lng", 36.82)}"></div></div>
      <div class="grid g2"><div class="field"><label for="fcr">Creator or collector</label><input id="fcr" value="${v("creator", "Remembering the Waters field team")}"></div>
        <div class="field"><label for="fn">Narrator or photographer</label><input id="fn" value="${r ? esc(r.narrator || r.photographer || "") : ""}"><div class="hint">Write "anonymised" if the person asked not to be named.</div></div></div>
      <div class="grid g3"><div class="field"><label for="fl">Language</label><input id="fl" value="${v("language", "English")}"></div>
        <div class="field"><label for="fr">Rights</label><select id="fr">${["CC BY-NC 4.0", "Used with permission", "Public record", "© Lender, used with permission"].map((x) => `<option ${r && r.rights === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="fco">Consent</label><select id="fco">${["Signed consent form on file", "Verbal consent recorded", "Online consent given at submission", "Permission letter on file", "Not applicable (public record)"].map((x) => `<option ${(r && r.consent === x) || (!r && fromSub && x.startsWith("Online")) ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
      <div class="field"><label for="ftg">Subjects</label><input id="ftg" value="${r ? esc(r.tags.join(", ")) : ""}" placeholder="Separate with commas: ferry, life jackets"><div class="hint">Chosen from a controlled vocabulary in the full build.</div></div>
      ${r ? "" : `<div class="field"><label>Media file</label><div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a media file">${ic("upload")}<div><b>Drop audio, video, a photo or a document</b></div><div class="hint">Kept in cloud storage in the full build: originals preserved, web copies compressed</div><div id="fname" class="small" style="color:var(--sky);margin-top:6px">${fromSub ? "From submission: " + esc(fromSub.file) : ""}</div></div><input type="file" id="ff" hidden></div>`}
      <div class="row"><button class="btn" name="act" value="published">${ic("check")}Save and publish</button><button class="btn ghost" name="act" value="draft">${ic("pencil")}Save as draft</button><span class="spacer"></span><a href="#/admin/records" class="btn ghost">Cancel</a></div>
    </form>`;
  }
  function bindRecordForm(r, fromSub) {
    let fileName = fromSub ? fromSub.file : "";
    if ($("#drop")) dropzone($("#drop"), $("#ff"), (f) => { if (f) { fileName = f.name; $("#fname").textContent = "Selected: " + f.name + " (" + Math.max(1, Math.round(f.size / 1024)) + " KB)"; } });
    let act = "published";
    $$("#recForm [name=act]").forEach((b) => (b.onclick = () => (act = b.value)));
    $("#recForm").onsubmit = (e) => {
      e.preventDefault();
      const t = $("[name=ft]:checked").value;
      const data = { type: t, title: $("#fti").value.trim(), summary: $("#fsu").value.trim(), year: +$("#fy").value, waterBody: $("[name=fw]:checked").value,
        county: $("#fc").value.trim(), place: $("#fp").value.trim(), lat: +$("#fla").value, lng: +$("#flo").value, creator: $("#fcr").value.trim(),
        language: $("#fl").value.trim(), rights: $("#fr").value, consent: $("#fco").value, tags: $("#ftg").value.split(",").map((x) => x.trim()).filter(Boolean), status: act };
      const who = $("#fn").value.trim(); if (t === "photo") data.photographer = who; else data.narrator = who;
      if (r) { Object.assign(r, data); logAct(`edited ${r.id} '${r.title}'${act === "published" ? " and published it" : ""}`); save(); toast("Changes saved"); go("#/admin/records"); return; }
      const nr = Object.assign({ id: nextRecordId(), format: { oral: "audio", photo: "image", record: "document", testimony: "text" }[t], views: 0, added: today(), file: fileName }, data);
      if (nr.format === "audio") { nr.duration = 120; nr.transcript = [[0, "Transcript to be added by the cataloguer."]]; }
      if (nr.format === "document") nr.pages = [nr.title.toUpperCase(), nr.summary];
      if (nr.format === "text") nr.body = nr.summary;
      S.records.unshift(nr);
      if (fromSub) { fromSub.status = "approved"; fromSub.recordId = nr.id; logAct(`approved submission '${fromSub.title}' as ${nr.id}`); }
      logAct(`uploaded ${nr.id} '${nr.title}' as ${act}`); save();
      toast(act === "published" ? `${nr.id} published to the archive` : `${nr.id} saved as a draft`); go("#/admin/records");
    };
  }
  ADMIN.upload = {
    html(parts, qs) {
      const sub = qs.get("from") && S.submissions.find((s) => s.id === qs.get("from"));
      return `${head("Upload and catalogue", sub ? `Cataloguing submission ${sub.id} from ${esc(userById(sub.by).name)}.` : "Add a new item with its metadata.", true)}
        ${orbRow([dash, { icon: "archive", label: "Records", desc: "Back to the list of records.", go: "#/admin/records" }])}${recordForm(null, sub)}`;
    },
    after(parts, qs) { bindRecordForm(null, qs.get("from") && S.submissions.find((s) => s.id === qs.get("from"))); }
  };
  ADMIN.edit = {
    html(parts) { const r = S.records.find((x) => x.id === parts[2]); return r ? `${head("Edit " + r.id, "Every change is recorded in the activity log.", true)}${orbRow([dash, { icon: "eye", label: "View item", desc: "See the item as the public sees it.", go: "#/record/" + r.id }, { icon: "archive", label: "Records", desc: "Back to the list of records.", go: "#/admin/records" }])}${recordForm(r)}` : `<div class="panel empty"><h2>Item not found</h2></div>`; },
    after(parts) { const r = S.records.find((x) => x.id === parts[2]); if (r) bindRecordForm(r); }
  };

  ADMIN.submissions = {
    html(parts, qs) {
      const show = qs.get("show") || "pending";
      const list = S.submissions.filter((s) => s.status === show);
      return `${head("Submissions", "Material sent in by the public. Approving opens the cataloguing form so the metadata is complete before publishing.", true)}
        ${orbRow([dash,
          { icon: "inbox", label: "Waiting", desc: "Submissions still to review.", go: "#/admin/submissions", on: show === "pending", badge: pending().length || "" },
          { icon: "circle-check", label: "Approved", desc: "Submissions already added to the archive.", go: "#/admin/submissions?show=approved", on: show === "approved" },
          { icon: "ban", label: "Rejected", desc: "Submissions that were turned down.", go: "#/admin/submissions?show=rejected", on: show === "rejected" }
        ])}
        <div class="grid" style="gap:14px">${list.length ? list.map((s) => `<div class="panel"><div class="row">${typeTag(s.type)}${status(s.status)}<span class="spacer"></span><span class="small muted">${s.id}, ${s.date}</span></div>
          <h3 style="margin:12px 0 4px">${esc(s.title)}</h3>
          <div class="facts" style="margin-bottom:8px"><span>${ic("user")}${esc(userById(s.by).name)}</span>${s.place ? `<span>${ic("map-pin")}${esc(s.place)}</span>` : ""}${s.year ? `<span>${ic("calendar")}${s.year}</span>` : ""}<span>${ic(WATER_ICONS[s.waterBody] || "waves")}${esc(s.waterBody)}</span></div>
          <p style="margin:0 0 8px">${esc(s.description)}</p>
          <div class="facts" style="margin-bottom:12px"><span>${ic("file-up")}${esc(s.file)}</span><span>${ic(s.consent ? "badge-check" : "ban")}${s.consent ? "Consent confirmed by contributor" : "No consent"}</span></div>
          ${s.status === "pending" ? `<div class="actions"><a class="btn sm" href="#/admin/upload?from=${s.id}">${ic("check")}Approve and catalogue</a><button class="btn ghost sm" data-reject="${s.id}">${ic("ban")}Reject</button></div>` : s.recordId ? `<a class="btn ghost sm" href="#/record/${s.recordId}">${ic("eye")}View ${s.recordId}</a>` : ""}
        </div>`).join("") : `<div class="panel empty">${ic("circle-check")}<h3>Nothing here</h3><p>${show === "pending" ? "Every submission has been reviewed." : "No submissions in this list yet."}</p></div>`}</div>`;
    },
    after() {
      $$("[data-reject]").forEach((b) => (b.onclick = () => {
        const s = S.submissions.find((x) => x.id === b.dataset.reject);
        modal("ban", "Reject this submission?", `<p class="muted">"${esc(s.title)}"</p><div class="field"><label for="rr">Message to the contributor</label><textarea id="rr">Thank you for your submission. We can't include it because…</textarea></div><div class="row"><button class="btn danger" id="rok">${ic("ban")}Reject submission</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
          $("#rok").onclick = () => { s.status = "rejected"; logAct(`rejected submission '${s.title}'`); save(); closeModal(); toast("Submission rejected. The contributor has been told.", "ban"); render(); };
        });
      }));
    }
  };

  ADMIN.users = {
    html() {
      return `${head("Users and roles", "Users search, browse, play media and share material. Admins also catalogue, publish, review and manage users.", true)}
        ${orbRow([dash, { icon: "user-plus", label: "Create user", desc: "Add a user or admin with a temporary password.", act: createUser, primary: true }])}
        <div class="panel tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
        ${S.users.map((u) => `<tr><td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${initials(u.name)}</span><div><b style="color:#fff">${esc(u.name)}</b><div class="small muted">${esc(u.email)}</div></div></div></td>
          <td><select data-role="${u.id}" style="width:auto" ${u.id === S.session ? "disabled" : ""} aria-label="Role for ${esc(u.name)}"><option value="user" ${u.role === "user" ? "selected" : ""}>User</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option></select></td>
          <td>${status(u.status)}</td><td class="small">${u.joined}</td>
          <td><div class="actions"><button class="btn ghost sm" data-reset="${u.id}">${ic("key-round")}Reset password</button>${u.id === S.session ? "" : `<button class="btn ${u.status === "active" ? "danger" : ""} sm" data-susp="${u.id}">${ic(u.status === "active" ? "ban" : "circle-check")}${u.status === "active" ? "Suspend" : "Reactivate"}</button>`}</div></td></tr>`).join("")}
        </tbody></table></div>`;
    },
    after() {
      $$("[data-role]").forEach((s) => (s.onchange = () => { const u = S.users.find((x) => x.id === s.dataset.role); u.role = s.value; logAct(`changed ${u.email} role to ${s.value}`); save(); toast("Role changed"); render(); }));
      $$("[data-susp]").forEach((b) => (b.onclick = () => { const u = S.users.find((x) => x.id === b.dataset.susp); u.status = u.status === "active" ? "suspended" : "active"; logAct(`${u.status === "suspended" ? "suspended" : "reactivated"} account ${u.email}`); save(); toast(u.status === "suspended" ? "Account suspended" : "Account reactivated", u.status === "suspended" ? "ban" : "circle-check"); render(); }));
      $$("[data-reset]").forEach((b) => (b.onclick = () => {
        const u = S.users.find((x) => x.id === b.dataset.reset);
        const tmp = "Tmp-" + Math.random().toString(36).slice(2, 8);
        u.password = tmp; logAct(`reset password for ${u.email}`); save();
        modal("key-round", "Password reset", `<p>Temporary password for <b>${esc(u.email)}</b>:</p><p class="panel" style="font-family:monospace;font-size:1.2rem;color:#fff">${tmp}</p><p class="hint">In the full build the user gets a secure, expiring reset link by email instead.</p>`);
      }));
    }
  };
  function createUser() {
    modal("user-plus", "Create user", `<form id="nuForm"><div class="field"><label for="nn">Name</label><input id="nn" required></div><div class="field"><label for="ne">Email</label><input id="ne" type="email" required></div>
      <div class="field"><label>Role</label><div class="seg"><input type="radio" name="nr" id="nr1" value="user" checked><label for="nr1">${ic("user")}User</label><input type="radio" name="nr" id="nr2" value="admin"><label for="nr2">${ic("user-round-cog")}Admin</label></div></div>
      <div class="field"><label for="np">Temporary password</label><input id="np" required minlength="8" value="Welcome-${Math.random().toString(36).slice(2, 6)}"></div>
      <button class="btn">${ic("user-plus")}Create user</button></form>`, () => {
      $("#nuForm").onsubmit = (e) => {
        e.preventDefault();
        const u = { id: "U" + Date.now(), name: $("#nn").value.trim(), email: $("#ne").value.trim(), role: $("[name=nr]:checked").value, password: $("#np").value, status: "active", joined: today(), org: "" };
        S.users.push(u); logAct(`created ${u.role} account ${u.email}`); save(); closeModal(); toast("User created", "user-plus"); render();
      };
    });
  }

  ADMIN.messages = {
    html() {
      return `${head("Messages", "From the public contact form.", true)}
        ${orbRow([dash, unread().length && { icon: "check", label: "Mark all read", desc: "Marks every message as read.", act: () => { S.messages.forEach((m) => (m.read = true)); save(); toast("All messages marked as read"); render(); } }])}
        <div class="grid" style="gap:12px">${S.messages.length ? S.messages.map((m) => `<div class="panel" style="${m.read ? "" : "border-color:var(--blue-2)"}"><div class="row"><span class="li-ic">${ic(m.read ? "mail" : "bell")}</span><b style="color:#fff">${esc(m.subject)}</b><span class="spacer"></span><span class="small muted">${m.date}</span></div>
          <p class="small muted" style="margin:8px 0">${esc(m.name)}, ${esc(m.email)}</p><p>${esc(m.body)}</p>
          <div class="actions">${m.read ? `<span class="small muted">${ic("check")} Read</span>` : `<button class="btn ghost sm" data-read="${m.id}">${ic("check")}Mark as read</button>`}<a class="btn sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: " + m.subject)}">${ic("mail")}Reply by email</a></div></div>`).join("") : `<div class="panel empty">${ic("inbox")}<h3>No messages</h3></div>`}</div>`;
    },
    after() { $$("[data-read]").forEach((b) => (b.onclick = () => { S.messages.find((m) => m.id === b.dataset.read).read = true; save(); render(); })); }
  };

  ADMIN.activity = {
    html() {
      const pub = published();
      const byWater = SEED.waterBodies.map((w) => [w, pub.filter((r) => r.waterBody === w).reduce((a, r) => a + r.views, 0)]);
      const mx = Math.max(...byWater.map((x) => x[1]), 1);
      const av = S.records.filter((r) => r.duration);
      return `${head("Reports and activity", "How the archive is used, and everything admins have done.", true)}
        ${orbRow([dash, { icon: "download", label: "Export", desc: "Download the records list as a CSV file.", act: exportCsv }])}
        <div class="grid g2">
          <div class="panel"><h3>${ic("eye")} Views by water body</h3>${byWater.map(([w, n]) => `<div class="hbar">${ic(WATER_ICONS[w])}<span>${w}</span><div><i style="width:${(n / mx) * 100}%"></i></div><b>${n}</b></div>`).join("")}</div>
          <div class="panel"><h3>${ic("badge-check")} Collection health</h3>
            <div class="hbar">${ic("badge-check")}<span>Consent recorded</span><div><i style="width:100%"></i></div><b>${S.records.length}</b></div>
            <div class="hbar">${ic("map-pin")}<span>Placed on the map</span><div><i style="width:${(S.records.filter((r) => r.lat).length / S.records.length) * 100}%"></i></div><b>${S.records.filter((r) => r.lat).length}</b></div>
            <div class="hbar">${ic("subtitles")}<span>Transcribed</span><div><i style="width:${(av.filter((r) => r.transcript).length / Math.max(1, av.length)) * 100}%"></i></div><b>${av.filter((r) => r.transcript).length}</b></div>
            <p class="hint">Every audio and video item needs a transcript for search and accessibility.</p></div>
        </div>
        <div class="panel" style="margin-top:18px"><h3>${ic("history")} Activity log</h3><ul class="log">${S.activity.map((a) => `<li><span class="li-ic">${ic("activity")}</span><div><time>${a.t}</time><b>${esc(a.who)}</b> ${esc(a.what)}</div></li>`).join("")}</ul></div>`;
    }
  };

  /* ---------- Boot ---------- */
  if (APP_MODE) document.documentElement.classList.add("app-mode");
  render();
})();
