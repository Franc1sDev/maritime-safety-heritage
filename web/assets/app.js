/* =====================================================================
   Maritime Safety Heritage Archive: website
   Same look as the approved prototype (round "orbs" inside each page,
   extra options behind "See more"), now backed by the secure API.
   ===================================================================== */
(function () {
  "use strict";

  const API = window.MSH_API;
  const ICONS = window.MSH_ICONS || {};
  const APP_MODE = new URLSearchParams(location.search).get("app") === "1";
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TYPES = {
    oral:      { label: "Oral history",     plural: "Oral histories", icon: "mic" },
    photo:     { label: "Photograph",       plural: "Photographs",    icon: "camera" },
    record:    { label: "Record or report", plural: "Records",        icon: "file-text" },
    testimony: { label: "Testimony",        plural: "Testimonies",    icon: "message-square-quote" }
  };
  const FORMATS = { audio: ["headphones", "Audio"], video: ["video", "Video"], image: ["image", "Image"], document: ["file-text", "Document"], text: ["scroll-text", "Text"] };
  const WATER_ICONS = { "Indian Ocean coast": "waves", "Lake Victoria": "fish", "Lake Turkana": "sun", "Lake Naivasha": "sailboat", "Lake Baringo": "compass", "Rivers": "map" };
  const MARK = ["⟦", "⟧"];

  /* Welcome-page footage: Mixkit free licence. To be replaced with the project's own footage. */
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

  /* ---------- Display preferences (this browser only) ---------- */
  const PREF_KEY = "msh-prefs";
  const P = (() => { try { return Object.assign({ largeText: false, lowBw: false, hints: true }, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch (e) { return { largeText: false, lowBw: false, hints: true }; } })();
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(P)); } catch (e) {} };
  const UI = { slide: 0, afterLogin: null };
  const COUNTS = { pending: 0, unread: 0 };
  let VOCAB = null, FACETS = null;

  /* ---------- Helpers ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.floor(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = String(sec % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`; };
  const parseTime = (t) => { const p = String(t).trim().split(":").map(Number); if (p.some((n) => !Number.isFinite(n))) return null; return p.reduce((a, n) => a * 60 + n, 0); };
  const initials = (n) => String(n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const me = () => API.user;
  const isAdmin = () => !!me() && me().role === "admin";
  /** Editors and admins: catalogue, publish and review. Only admins manage people, messages and reports. */
  const isStaff = () => !!me() && (me().role === "admin" || me().role === "editor");
  const roleName = (r) => ({ admin: "Admin", editor: "Editor" })[r] || "Member";
  const ADMIN_ONLY = ["users", "messages", "activity"];
  const date = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const dateTime = (d) => d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const size = (b) => b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB";
  const yearText = (r) => r.year ? (r.yearApproximate ? "c. " : "") + r.year : "Date unknown";
  const place = (r) => [r.place, r.county].filter(Boolean).join(", ") || (r.waterBody && r.waterBody.name) || "Place not recorded";
  function ic(name, cls = "") {
    const body = ICONS[name] || ICONS["circle-help"] || "";
    return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  function toast(msg, icon = "circle-check") {
    const t = $("#toast"); t.innerHTML = ic(icon) + `<span>${esc(msg)}</span>`; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const fail = (e) => toast(e && e.message ? e.message : "Something went wrong. Try again.", "ban");
  /** Escapes server text, then turns the API's highlight markers into <mark>. */
  const marked = (s) => esc(s).split(MARK[0]).join("<mark>").split(MARK[1]).join("</mark>");
  function highlight(text, q) {
    const safe = esc(text);
    const words = (q || "").trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
    return words.length ? safe.replace(new RegExp("(" + words.join("|") + ")", "giu"), "<mark>$1</mark>") : safe;
  }
  const typeTag = (t) => `<span class="tag">${ic(TYPES[t].icon)}${TYPES[t].label}</span>`;
  const status = (s) => `<span class="st st-${esc(s)}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`;
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
  const loading = (msg = "Loading") => `<div class="loading"><span class="ring"></span>${esc(msg)}</div>`;
  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn._html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `${ic("clock")}${esc(label || "Working")}`; } else { btn.disabled = false; if (btn._html) btn.innerHTML = btn._html; } };

  async function vocab() { if (!VOCAB) VOCAB = await API.get("/vocab"); return VOCAB; }
  async function facets() { if (!FACETS) FACETS = await API.get("/records/facets"); return FACETS; }
  const waterName = (id) => { const w = VOCAB && VOCAB.waterBodies.find((x) => x.id === +id); return w ? w.name : ""; };

  /* ---------- Placeholder artwork, used where an item has no picture yet ---------- */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function art(rec, w = 800, h = 450) {
    const s = hash(rec.identifier + rec.title);
    const [a, b, c] = { oral: ["#03122a", "#0d3d8a", "#9cc2ff"], photo: ["#061a36", "#1e6bff", "#e9f1ff"], record: ["#020a18", "#123a73", "#b8d2ff"], testimony: ["#04102a", "#2a58b8", "#d4e4ff"] }[rec.type];
    const sunX = 120 + (s % 560), hor = 230 + (s % 60);
    let boats = "", waves = "";
    for (let i = 0; i < 1 + (s % 3); i++) {
      const x = 90 + ((s >> (i * 3)) % 600), y = hor + 30 + i * 28, k = 0.7 + i * 0.25;
      boats += `<g transform="translate(${x} ${y}) scale(${k})" fill="${a}" opacity=".92"><path d="M-60 0 L60 0 L42 18 L-44 18 Z"/><path d="M0 -70 L0 0 L36 0 Z" fill="${c}" opacity=".85"/><rect x="-2" y="-72" width="3" height="72"/></g>`;
    }
    for (let i = 0; i < 6; i++) { const y = hor + 12 + i * 34; waves += `<path d="M0 ${y} Q 100 ${y - 8} 200 ${y} T 400 ${y} T 600 ${y} T 800 ${y}" stroke="${c}" stroke-opacity="${0.2 - i * 0.025}" stroke-width="3" fill="none"/>`; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="${w}" height="${h}"><defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="800" height="450" fill="url(#k)"/><circle cx="${sunX}" cy="${hor - 40}" r="46" fill="${c}" opacity=".5"/><path d="M0 ${hor} L 140 ${hor - 22} L 260 ${hor - 8} L 400 ${hor - 30} L 520 ${hor - 6} L 800 ${hor - 18} L 800 ${hor} Z" fill="${a}" opacity=".6"/><rect y="${hor}" width="800" height="${450 - hor}" fill="url(#m)"/>${waves}${boats}</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* =====================================================================
     NAVIGATION: everything is a round "orb" inside the page.
     - Welcome page: every option orbits the centre of the page (one or two rings, never scrolls).
     - Other pages: the same orbs fly to a dock on the left, and the dock lights up to show where they went.
     - Pointing at an orb zooms it in; its neighbours make way and fade into the background.
     - A guide watches what you are doing and points to the next thing to press.
     ===================================================================== */
  let ACTS = {}, actN = 0, pendingOrb = null;
  function cancelOrb() { if (pendingOrb) { clearTimeout(pendingOrb._t); pendingOrb.classList.remove("zoom"); pendingOrb.parentElement.classList.remove("show"); pendingOrb = null; } }
  function actKey(fn) { const k = "a" + (++actN); ACTS[k] = fn; return k; }
  function orb(o) {
    let data = "";
    if (o.go) data = `data-go="${esc(o.go)}"`;
    if (o.act) data = `data-act="${actKey(o.act)}"`;
    const cls = ["orb", o.primary ? "primary" : "", o.on ? "on" : "", o.ghost ? "ghost" : ""].join(" ");
    return `<div class="orb-wrap" style="--n:${o.n || 0}" ${o.key ? `data-key="${esc(o.key)}"` : ""}>
      <button class="${cls}" ${data} data-desc="${esc(o.desc || "")}" aria-label="${esc(o.label)}${o.desc ? ": " + esc(o.desc) : ""}" ${o.id ? `id="${o.id}"` : ""}><span class="halo" aria-hidden="true"></span>${ic(o.icon)}${o.badge ? `<span class="badge-n">${esc(o.badge)}</span>` : ""}</button>
      <span class="orb-label">${esc(o.label)}</span>
      <span class="orb-desc" role="status">${esc(o.desc || "")}</span></div>`;
  }
  function orbRow(list, extra = "") { list = list.filter(Boolean); return `<div class="orbs magnify ${extra}">${list.map((o, i) => orb(Object.assign({ n: i }, o))).join("")}</div>`; }

  /** The main menu: what this person can do, in the order they are most likely to want it. */
  function navItems() {
    const u = me(), staff = isStaff(), admin = isAdmin();
    const L = [];
    const add = (key, icon, label, desc, target, extra = {}) => L.push(Object.assign({ key, icon, label, desc }, typeof target === "function" ? { act: target } : { go: target }, extra));
    if (!u) {
      add("login", "log-in", "Sign in", "Sign in with your own account to explore the archive.", "#/login", { primary: true });
      add("signup", "user-plus", "Create account", "Open a free account in under a minute.", "#/login?tab=up");
    } else {
      add("search", "search", "Search", "Search titles, transcripts, documents and places.", () => quickSearch(), { primary: !staff });
      add("browse", "layout-grid", "Browse", "Explore every item, filtered by type, water and decade.", "#/browse");
      add("map", "map", "Incident map", "See where each story happened, from Likoni to Lake Turkana.", "#/map");
      add("listen", "headphones", "Listen", "Play oral histories in the voices of those who lived them.", "#/browse?type=oral");
      add("submit", "hand-heart", "Share a story", "Send a recording, photo or document to the research team.", "#/submit");
      if (staff) {
        add("admin", "chart-column", "Dashboard", "Usage, collection health and recent activity.", "#/admin", { primary: true });
        add("records", "archive", "Records", "Edit, publish, unpublish or restore catalogue records.", "#/admin/records");
        add("upload", "upload", "Upload", "Add a new item and catalogue its metadata.", "#/admin/upload");
        add("review", "inbox", "Review", "Approve or decline material sent in by the public.", "#/admin/submissions", { badge: COUNTS.pending || "" });
      }
      if (admin) {
        add("users", "users", "Users", "Create accounts, change roles, suspend accounts.", "#/admin/users");
        add("messages", "mail", "Messages", "Messages from the contact form.", "#/admin/messages", { badge: COUNTS.unread || "" });
        add("reports", "activity", "Reports", "Usage, the audit log and CSV exports.", "#/admin/activity");
      }
    }
    add("about", "anchor", "About", "Who is behind the archive, the app, privacy and terms.", "#/about");
    add("contact", "mail", "Contact", "Send a message to the research team.", "#/contact");
    if (!u) add("app", "smartphone", "Mobile app", "The same archive on an Android or iOS phone.", "#/app");
    add("display", "sliders-horizontal", "Display", "Larger text, light mode for slow connections, and the helper hints.", () => displayOptions());
    return L;
  }
  /** Which menu orb belongs to the page you are on. */
  function navKeyFor(parts, q) {
    const p = parts[0] || "home";
    if (p === "browse") return q && q.get("type") === "oral" ? "listen" : "browse";
    if (p === "admin") return ({ "": "admin", records: "records", upload: "upload", edit: "records", submissions: "review", users: "users", messages: "messages", activity: "reports" })[parts[1] || ""] || "admin";
    if (p === "login") return q && q.get("tab") === "up" ? "signup" : "login";
    if (["privacy", "terms", "app"].includes(p)) return p === "app" && !me() ? "app" : "about";
    return p;
  }

  /* ----- Orbit (welcome page, and the menu on phones) ----- */
  function orbitHtml(center, opts = {}) {
    const items = navItems();
    return `<div class="orbit ${opts.overlay ? "overlay" : ""}" id="${opts.id || "orbit"}" data-count="${items.length}">
      <div class="orbit-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="orbit-center">${center}</div>
      ${items.map((o, i) => orb(Object.assign({ n: i }, o))).join("")}</div>`;
  }
  function layoutOrbit(el) {
    if (!el) return;
    const wraps = $$(":scope > .orb-wrap", el), n = wraps.length;
    const W = el.clientWidth, H = el.clientHeight, small = Math.min(W, H) < 620;
    let s = small ? 60 : Math.min(92, Math.max(66, Math.min(W, H) / 8));
    const labelH = 34, cx = W / 2, cy = H / 2;
    const perim = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    let rx = Math.max(80, W / 2 - s * 0.75 - 46), ry = Math.max(80, H / 2 - s / 2 - labelH);
    let cap = Math.floor(perim(rx, ry) / (s + (small ? 30 : 48)));
    let rings;
    if (n <= cap) rings = [[rx, ry, n]];
    else {
      s = Math.max(52, s * 0.86);
      cap = Math.floor(perim(rx, ry) / (s + (small ? 24 : 40)));
      const outer = Math.min(n, Math.max(Math.ceil(n * 0.62), cap));
      rings = [[rx, ry, outer], [rx * 0.6, ry * 0.6, n - outer]];
    }
    let k = 0;
    // Spaced evenly along the ring's length (not by angle), so tall or wide rings never bunch up.
    const along = (a, b, count, offset) => {
      const N = 720, pts = [], len = [0];
      for (let i = 0; i <= N; i++) { const t = -Math.PI / 2 + (i / N) * 2 * Math.PI; pts.push([a * Math.cos(t), b * Math.sin(t)]); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
      const total = len[N], out = [];
      for (let j = 0; j < count; j++) { const want = ((j + offset) / count) * total; let i = 0; while (i < N && len[i] < want) i++; out.push(pts[i]); }
      return out;
    };
    rings.forEach(([a, b, count], r) => {
      const pts = along(a, b, count, r ? 0.5 : 0);
      for (let j = 0; j < count; j++, k++) {
        const x = cx + pts[j][0], y = cy + pts[j][1];
        const w = wraps[k];
        w.style.left = x + "px"; w.style.top = y + "px";
        w.style.setProperty("--fx", (cx - x) + "px"); w.style.setProperty("--fy", (cy - y) + "px");
      }
    });
    const inner = rings[rings.length - 1];
    el.style.setProperty("--s", s + "px");
    el.style.setProperty("--cw", Math.max(180, inner[0] * (rings.length > 1 ? 1.2 : 1.3)) + "px");
    el.style.setProperty("--ch", Math.max(150, inner[1] * (rings.length > 1 ? 1.2 : 1.35)) + "px");
    const ringEls = $$(".orbit-rings i", el);
    rings.forEach(([a, b], i) => { if (ringEls[i]) { ringEls[i].style.width = 2 * a + "px"; ringEls[i].style.height = 2 * b + "px"; } });
    for (let i = rings.length; i < ringEls.length; i++) ringEls[i].style.width = ringEls[i].style.height = (i === 2 ? 0 : 0) + "px";
    if (ringEls[2]) { ringEls[2].style.width = 2 * rx * 1.12 + "px"; ringEls[2].style.height = 2 * ry * 1.12 + "px"; }
  }
  window.addEventListener("resize", () => { $$(".orbit").forEach(layoutOrbit); placeCoach(); });

  /* ----- Dock (every page except the welcome page) ----- */
  function renderDock(parts, q) {
    const dock = $("#dock");
    const page = parts[0] || "home";
    const show = page !== "home";
    document.body.classList.toggle("has-dock", show);
    if (!show) { dock.innerHTML = ""; dock.hidden = true; return; }
    dock.hidden = false;
    const cur = navKeyFor(parts, q);
    const items = navItems();
    dock.innerHTML = `<button class="dock-orb hub" data-key="home" aria-label="Welcome page: every option around the centre"><span class="dock-ic">${ic("compass")}</span><span class="dock-tip">All options</span></button>
      ${items.map((o, i) => `<button class="dock-orb ${o.key === cur ? "here" : ""} ${o.primary ? "primary" : ""}" data-key="${o.key}" style="--n:${i}" ${o.go ? `data-go="${esc(o.go)}"` : `data-act="${actKey(o.act)}"`} aria-label="${esc(o.label)}${o.key === cur ? " (you are here)" : ""}" ${o.key === cur ? 'aria-current="page"' : ""}><span class="dock-ic">${ic(o.icon)}</span>${o.badge ? `<span class="badge-n">${esc(o.badge)}</span>` : ""}<span class="dock-tip">${esc(o.label)}</span></button>`).join("")}
      <button class="dock-fab" aria-label="Open the menu" data-act="${actKey(() => openMenuOverlay())}"><span class="dock-ic">${ic("compass")}</span><span>Menu</span></button>`;
    const avail = window.innerHeight - 64 - 36, per = avail / (items.length + 1);
    dock.style.setProperty("--d", Math.max(30, Math.min(48, per - 8)) + "px");
    flyIn(dock, ".dock-orb");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".dock-orb, .dock-fab");
    if (!b) return;
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    if (b.classList.contains("hub")) { captureFly("#dock .dock-orb"); return go("#/home"); }
    if (b.dataset.go) { if (location.hash === b.dataset.go) render(); else go(b.dataset.go); }
    else if (b.dataset.act && ACTS[b.dataset.act]) ACTS[b.dataset.act](b);
  });

  /* ----- Flying between the orbit and the dock (FLIP animation) ----- */
  let FLY = null;
  function captureFly(sel) {
    if (REDUCED) return;
    FLY = { at: Date.now(), rects: {} };
    $$(sel).forEach((el) => { const k = el.dataset.key || (el.closest("[data-key]") || {}).dataset?.key; if (k) FLY.rects[k] = (el.querySelector(".orb") || el).getBoundingClientRect(); });
  }
  function flyIn(container, sel) {
    if (!FLY || Date.now() - FLY.at > 2500) return;
    const rects = FLY.rects; FLY = null;
    let moved = 0;
    $$(sel, container).forEach((el, i) => {
      const k = el.dataset.key, from = rects[k];
      const target = el.querySelector(".orb") || el;
      if (!from) return;
      const to = target.getBoundingClientRect();
      if (!to.width) return;
      target.style.transition = "none";
      target.style.transform = `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.width / to.width})`;
      target.style.zIndex = 5;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        target.style.transition = `transform .85s cubic-bezier(.34, 1.4, .5, 1) ${i * 28}ms`;
        target.style.transform = "";
        setTimeout(() => { target.style.transition = ""; target.style.zIndex = ""; }, 950 + i * 28);
      }));
      moved++;
    });
    if (moved && container.classList.contains("orbit")) container.classList.add("flown");
    if (moved && container.id === "dock") {
      setTimeout(() => {
        container.classList.remove("landed"); void container.offsetWidth; container.classList.add("landed");
        let seen = 0; try { seen = +sessionStorage.getItem("msh-dock-tip") || 0; } catch (e) {}
        if (seen < 2) {
          try { sessionStorage.setItem("msh-dock-tip", seen + 1); } catch (e) {}
          bubble(container, "Your menu moved here. Point at it to see each option, or press the compass to bring everything back to the centre.");
        }
      }, 900);
    }
  }
  function bubble(anchor, text) {
    const r = anchor.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "hint-bubble"; b.setAttribute("role", "status"); b.textContent = text;
    b.style.left = r.right + 16 + "px"; b.style.top = Math.max(80, r.top + r.height / 2 - 40) + "px";
    document.body.appendChild(b);
    setTimeout(() => b.classList.add("out"), 5200);
    setTimeout(() => b.remove(), 5800);
  }

  /* ----- Phones: the dock folds into one round "Menu" button that opens the orbit over the page ----- */
  function openMenuOverlay() {
    closeMenuOverlay();
    const parts = parse().parts;
    const wrap = document.createElement("div");
    wrap.className = "menu-overlay"; wrap.id = "menuOverlay";
    wrap.innerHTML = orbitHtml(`<p class="orbit-kicker">Where to next?</p><button class="pill" id="menuClose">${ic("x")}Close</button>`, { overlay: true, id: "menuOrbit" });
    document.body.appendChild(wrap);
    const cur = navKeyFor(parts, parse().q);
    const here = $(`#menuOrbit .orb-wrap[data-key="${cur}"] .orb`); if (here) here.classList.add("on");
    layoutOrbit($("#menuOrbit"));
    $("#menuClose").onclick = closeMenuOverlay;
    wrap.addEventListener("click", (e) => { if (e.target === wrap) closeMenuOverlay(); });
  }
  function closeMenuOverlay() { const m = $("#menuOverlay"); if (m) m.remove(); }

  /* ----- Orb clicks: first press zooms in and explains, then it goes ----- */
  document.addEventListener("click", (e) => {
    let b = e.target.closest(".orb");
    if (!b) { const lab = e.target.closest(".orb-label"); if (lab) b = lab.parentElement.querySelector(".orb"); }
    if (!b) return;
    const wrap = b.parentElement;
    const run = () => {
      clearTimeout(b._t); pendingOrb = null;
      setTimeout(() => { b.classList.remove("zoom"); wrap.classList.remove("show"); }, 60);
      if (b.closest(".orbit") && b.dataset.go) captureFly(".orbit .orb-wrap");
      if (b.closest(".menu-overlay")) closeMenuOverlay();
      if (b.dataset.go) { if (location.hash === b.dataset.go) render(); else go(b.dataset.go); }
      else if (b.dataset.act && ACTS[b.dataset.act]) ACTS[b.dataset.act](b);
    };
    if (b.classList.contains("zoom") || !b.dataset.desc) return run();
    $$(".orb.zoom").forEach((x) => { x.classList.remove("zoom"); x.parentElement.classList.remove("show"); clearTimeout(x._t); });
    const life = REDUCED ? 500 : 1300;
    wrap.style.setProperty("--life", life + "ms");
    b.classList.add("zoom"); wrap.classList.remove("show"); void wrap.offsetWidth; wrap.classList.add("show");
    ripple(b);
    pendingOrb = b; b._t = setTimeout(run, life - 150);
  });
  function ripple(el) {
    if (REDUCED) return;
    const r = document.createElement("span"); r.className = "ripple"; el.appendChild(r);
    setTimeout(() => r.remove(), 800);
  }

  /* ----- Magnify: the orb you point at grows, its neighbours make way and fade back ----- */
  function magnifySetup(group) {
    if (group._mag) return; group._mag = true;
    const isDock = group.id === "dock";
    const items = () => isDock ? $$(".dock-orb", group) : $$(":scope > .orb-wrap", group);
    let centers = null;
    const measure = () => {
      const gr = group.getBoundingClientRect();
      centers = items().map((w) => {
        const t = isDock ? w : w.querySelector(".orb");
        const r = t.getBoundingClientRect();
        return [w, r.left + r.width / 2 - gr.left, r.top + r.height / 2 - gr.top];
      });
    };
    group.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") measure(); });
    group.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || REDUCED) return;
      if (!centers) measure();
      const gr = group.getBoundingClientRect(), px = e.clientX - gr.left, py = e.clientY - gr.top;
      const R = isDock ? 120 : 170;
      let best = 0;
      const fs = centers.map(([w, x, y]) => { const d = Math.hypot(px - x, py - y), f = Math.max(0, 1 - d / R); best = Math.max(best, f); return [w, x, y, f, d]; });
      fs.forEach(([w, x, y, f, d]) => {
        const m = 1 + (isDock ? 0.85 : 0.6) * f * f;
        let gx = 0, gy = 0;
        if (d > 8 && f > 0 && f < 0.97) {
          const push = (isDock ? 16 : 26) * f * (1 - f) * 4 * Math.min(1, best);
          if (isDock) gy = Math.sign(y - py) * push; else { gx = (x - px) / d * push; gy = (y - py) / d * push; }
        }
        w.style.setProperty("--m", m.toFixed(3));
        w.style.setProperty("--gx", gx.toFixed(1) + "px"); w.style.setProperty("--gy", gy.toFixed(1) + "px");
        w.classList.toggle("near", f > 0.55);
        w.classList.toggle("recede", best > 0.6 && f < 0.35);
      });
    });
    group.addEventListener("pointerleave", () => {
      centers = null;
      items().forEach((w) => { w.style.setProperty("--m", 1); w.style.setProperty("--gx", "0px"); w.style.setProperty("--gy", "0px"); w.classList.remove("near", "recede"); });
    });
  }
  function enhance() {
    $$(".orbs.magnify, .orbit, #dock").forEach(magnifySetup);
  }

  /* ----- Display options ----- */
  function displayOptions() {
    const body = () => orbRow([
      { icon: "type", label: P.largeText ? "Larger text: on" : "Larger text", on: P.largeText, act: () => setPref("largeText", (on) => on ? "Larger text on" : "Larger text off") },
      { icon: "wifi-off", label: P.lowBw ? "Light mode: on" : "Light mode", on: P.lowBw, act: () => setPref("lowBw", (on) => on ? "Light mode on: images and video hidden" : "Light mode off") },
      { icon: "sparkles", label: P.hints ? "Helper hints: on" : "Helper hints: off", on: P.hints, act: () => setPref("hints", (on) => on ? "Hints on: the archive will point to what to press next" : "Hints off") }
    ]);
    modal("sliders-horizontal", "Display", `<p class="muted">Saved on this device only.</p>${body()}`, (m) => magnifySetup($(".orbs", m)));
    function setPref(k, msg) {
      P[k] = !P[k]; savePrefs(); toast(msg(P[k]), k === "lowBw" ? "wifi-off" : k === "hints" ? "sparkles" : "type");
      closeModal(); applyPrefs();
      if (k === "lowBw") render(); else if (k === "hints") { if (P.hints) scheduleCoach(400); else hideCoach(); }
      displayOptions();
    }
  }
  function applyPrefs() {
    document.documentElement.classList.toggle("large-text", P.largeText);
    document.body.classList.toggle("low-bw", P.lowBw);
  }

  /* ----- Top right: your name (opens My account) and Sign out ----- */
  function renderChrome(page) {
    const u = me();
    $("#topRight").innerHTML = u
      ? `<a class="pill has-lbl who" href="#/profile" title="My account"><span class="avatar">${esc(initials(u.name))}</span><span class="lbl">${esc(u.name.split(" ")[0])}</span>${u.role !== "user" ? `<span class="role lbl">${roleName(u.role)}</span>` : ""}</a>
         <button class="pill has-lbl" id="logout" title="Sign out">${ic("log-out")}<span class="lbl">Sign out</span></button>`
      : (page === "login" ? "" : `<a class="pill has-lbl" href="#/login">${ic("log-in")}<span class="lbl">Sign in</span></a>`);
    const lo = $("#logout"); if (lo) lo.onclick = signOut;
    applyPrefs();
    $(".top").classList.toggle("solid", page !== "home");
  }

  /* =====================================================================
     GUIDE: points to the next thing to press, so nobody needs a manual.
     It reads the page and what you have done so far, waits until you pause,
     then shows a tapping hand, a pulsing ring and a short note.
     ===================================================================== */
  const SEEN = new Set();
  let coachTimer = null, coachTarget = null, coachRaf = 0;
  const coachEl = () => $("#coach");
  function scheduleCoach(delay = 2600) {
    clearTimeout(coachTimer);
    if (!P.hints) return;
    coachTimer = setTimeout(showCoach, delay);
  }
  function hideCoach() {
    clearTimeout(coachTimer);
    cancelAnimationFrame(coachRaf);
    const c = coachEl(); if (c) c.classList.remove("on");
    if (coachTarget) coachTarget.classList.remove("coach-target");
    coachTarget = null;
  }
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 60 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden"; };
  function labelOf(field) {
    const l = field.id && $(`label[for="${CSS.escape(field.id)}"]`);
    return (l ? l.textContent : field.getAttribute("aria-label") || field.placeholder || "this").replace(/\s+/g, " ").trim();
  }
  /** Works out the most useful next step. */
  function nextStep() {
    const box = $("#modalBg .modal") || $("#sheetWrap .sheet") || $("#main");
    // 1. A form in front of you: the first field still to fill in, then the button that sends it.
    const forms = $$("form", box).filter((f) => visible(f) && !f.classList.contains("searchbar"));
    for (const f of forms) {
      const fields = $$("input, select, textarea", f).filter((x) => !x.disabled && x.type !== "hidden" && (x.required || x.getAttribute("aria-required") === "true"));
      const todo = fields.find((x) => x.type === "radio" ? !$$(`input[name="${x.name}"]`, f).some((r) => r.checked) : x.type === "checkbox" ? !x.checked : !x.value.trim() || !x.checkValidity());
      if (todo) {
        const target = todo.type === "radio" ? todo.closest(".seg") || todo : todo.type === "checkbox" ? todo.closest("label") || todo : todo;
        return { el: target, text: todo.value && !todo.checkValidity() ? `Check "${labelOf(todo)}": ${todo.validationMessage}` : `Next: ${todo.type === "checkbox" ? "tick" : todo.tagName === "SELECT" || todo.type === "radio" ? "choose" : "fill in"} "${labelOf(todo)}"` };
      }
      const send = $("button:not([type=button]), button[type=submit]", f);
      if (send && fields.length) return { el: send, text: `All filled in. Press "${send.textContent.trim()}" to finish.` };
    }
    // 2. What this page is for.
    const { parts, q } = parse();
    const page = parts[0] || "home";
    const pick = (sel, text) => { const el = typeof sel === "string" ? $(sel) : sel; return visible(el) ? { el, text } : null; };
    const orbFor = (key) => $(`.orbit .orb-wrap[data-key="${key}"] .orb`);
    let s = null;
    if (page === "home") {
      if (!me()) s = pick(orbFor("login"), "Start here: sign in, or create a free account next to it.");
      else if (isStaff() && COUNTS.pending) s = pick(orbFor("review"), `${COUNTS.pending} submission${COUNTS.pending === 1 ? " is" : "s are"} waiting for your review.`);
      else {
        const k = ["browse", "map", "listen", "submit"].find((x) => !SEEN.has(x)) || "search";
        s = pick(orbFor(k), { browse: "Try this first: browse everything in the archive.", map: "Next, see where each story happened on the map.", listen: "Listen to oral histories in people's own voices.", submit: "Have a story or photo? Share it with the research team.", search: "Search for a place, a year or a word someone said." }[k]);
      }
    } else if (page === "browse") {
      if (!q.get("q") && !SEEN.has("searched")) s = pick("#q", "Type a place, a year or a word, then press Search.");
      else s = pick(".grid .card", "Open an item to read, listen or watch.");
    } else if (page === "record") {
      s = pick("#playBtn", "Press play. The transcript follows along as people speak.") || pick("#orbPlay", "Press play to listen.") || pick(".orbs .orb.primary", "See the full catalogue details here.");
    } else if (page === "map") {
      s = pick(".leaflet-marker-icon", "Each pin is a story. Press one to open it.");
    } else if (page === "admin") {
      const sub = parts[1] || "";
      if (!sub) s = COUNTS.pending ? pick(".orb-wrap .orb .badge-n", "Submissions are waiting. Press Review.") : pick(".orbs .orb.primary", "Start here.");
      else if (sub === "submissions") s = pick(".list-row, .grid .card, table tbody tr", "Open a submission to read it, then approve or decline.");
      else if (sub === "records") s = pick(".list-row, table tbody tr, .grid .card", "Open a record to edit it, or press Upload to add a new one.");
    }
    if (s) return s;
    // 3. The page's main option.
    const primary = $$("#main .orbs .orb.primary, #main .btn:not(.ghost)").find(visible);
    if (primary) return { el: primary, text: primary.classList.contains("orb") ? `Try "${primary.closest(".orb-wrap").querySelector(".orb-label").textContent}".` : `Next: "${primary.textContent.trim()}".` };
    return null;
  }
  function showCoach() {
    if (!P.hints || $("#menuOverlay") || pendingOrb) return;
    const step = nextStep();
    if (!step) return hideCoach();
    if (coachTarget && coachTarget !== step.el) coachTarget.classList.remove("coach-target");
    coachTarget = step.el;
    coachTarget.classList.add("coach-target");
    const c = coachEl();
    $(".coach-text", c).textContent = step.text;
    c.classList.add("on");
    placeCoach();
    const follow = () => { placeCoach(); coachRaf = requestAnimationFrame(follow); };
    cancelAnimationFrame(coachRaf); coachRaf = requestAnimationFrame(follow);
  }
  function placeCoach() {
    const c = coachEl();
    if (!c || !coachTarget || !c.classList.contains("on")) return;
    if (!document.contains(coachTarget)) return hideCoach();
    const r = coachTarget.getBoundingClientRect();
    const ring = $(".coach-ring", c), hand = $(".coach-hand", c), note = $(".coach-note", c);
    const pad = 10, size = Math.max(r.width, r.height) + pad * 2;
    const round = coachTarget.classList.contains("orb") || coachTarget.classList.contains("dock-orb") || coachTarget.classList.contains("leaflet-marker-icon") || coachTarget.id === "playBtn";
    ring.style.width = (round ? size : r.width + pad * 2) + "px"; ring.style.height = (round ? size : r.height + pad * 2) + "px";
    ring.style.borderRadius = round ? "50%" : "18px";
    ring.style.left = r.left + r.width / 2 + "px"; ring.style.top = r.top + r.height / 2 + "px";
    hand.style.left = r.left + r.width / 2 + Math.min(r.width / 2, 40) - 6 + "px"; hand.style.top = r.top + r.height / 2 + Math.min(r.height / 2, 30) - 4 + "px";
    const below = r.bottom + 120 < innerHeight;
    const nw = Math.min(280, innerWidth - 24);
    note.style.width = nw + "px";
    note.style.left = Math.max(12, Math.min(innerWidth - nw - 12, r.left + r.width / 2 - nw / 2)) + "px";
    note.style.top = (below ? r.bottom + 46 : Math.max(70, r.top - 76)) + "px";
    note.classList.toggle("above", !below);
  }
  // Any action hides the guide; it comes back when you pause.
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => document.addEventListener(ev, () => { hideCoach(); scheduleCoach(); }, { passive: true }));
  document.addEventListener("input", () => { hideCoach(); scheduleCoach(1800); });
  document.addEventListener("change", () => { hideCoach(); scheduleCoach(1200); });
  document.addEventListener("submit", (e) => { if (e.target.id === "sform") SEEN.add("searched"); }, true);

  async function signOut() {
    await API.logout();
    VOCAB = null; FACETS = null;
    toast("Signed out", "log-out"); go("#/home"); render();
  }
  async function refreshCounts() {
    if (!isStaff()) return;
    try {
      const [s, m] = await Promise.all([API.get("/submissions", { status: "pending", pageSize: 1 }), isAdmin() ? API.get("/messages", { filter: "unread", pageSize: 1 }) : Promise.resolve({ unread: 0 })]);
      const changed = s.total !== COUNTS.pending || m.unread !== COUNTS.unread;
      COUNTS.pending = s.total; COUNTS.unread = m.unread;
      if (changed) { const { parts, q } = parse(); renderDock(parts, q); enhance(); }
    } catch (e) { /* badges are optional */ }
  }

  /* ---------- Background: video slideshow (welcome) or a big page icon ---------- */
  let slideTimer = null;
  function startSlides() { clearInterval(slideTimer); slideTimer = setInterval(() => showSlide((UI.slide + 1) % CLIPS.length), 9000); }
  function setBg(kind) {
    clearInterval(slideTimer);
    const bg = $("#bg");
    if (kind === "video" && !P.lowBw) {
      if (bg.classList.contains("video")) { showSlide(UI.slide % CLIPS.length); startSlides(); return; }
      bg.className = "bg video";
      bg.innerHTML = CLIPS.map((c, i) => REDUCED
        ? `<img class="still" data-i="${i}" src="${c.poster}" alt="">`
        : `<video data-i="${i}" muted playsinline loop preload="${i === UI.slide % CLIPS.length ? "auto" : "none"}" poster="${c.poster}"><source src="${c.src}" type="video/mp4"></video>`).join("") + `<div class="shade"></div>`;
      showSlide(UI.slide % CLIPS.length);
      startSlides();
      return;
    }
    bg.className = "bg";
    const bubbles = P.lowBw || REDUCED ? "" : `<div class="bg-bubbles">${Array.from({ length: 14 }, (_, i) => `<span style="--x:${(i * 37 + 7) % 100}%;--z:${8 + (i * 13) % 26}px;--t:${14 + (i * 7) % 16}s;--dl:${-(i * 2.3).toFixed(1)}s"></span>`).join("")}</div>`;
    bg.innerHTML = bubbles + `<div class="bg-icon">${ic(kind === "video" ? "waves" : (kind || "waves"))}</div>
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
    return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || "") };
  }
  const currentPage = () => parse().parts[0] || "home";
  function go(h) { location.hash = h; }
  const PUBLIC = ["home", "about", "contact", "login", "app", "reset-password", "privacy", "terms"];
  const DEFAULT_DESC = "Archive of Kenya's maritime and inland-water safety heritage: oral histories, photographs, records and testimonies.";
  let cleanup = [], renderSeq = 0;

  async function render() {
    cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
    cancelOrb(); hideCoach(); closeMenuOverlay(); ACTS = {}; actN = 0; closeModal(); closeSheet();
    const seq = ++renderSeq;
    const { parts, q } = parse();
    const page = parts[0] || "home";
    if (!PUBLIC.includes(page) && !me()) { UI.afterLogin = location.hash; return go("#/login"); }
    if (page === "admin" && (!isStaff() || (ADMIN_ONLY.includes(parts[1]) && !isAdmin()))) { toast("That area is for the research team.", "lock"); return go(isStaff() ? "#/admin" : "#/home"); }
    const view = ROUTES[page] || ROUTES.notfound;
    document.title = (view.title ? view.title + " | " : "") + "Maritime Safety Heritage Archive";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", view.desc || DEFAULT_DESC);
    renderChrome(page);
    renderDock(parts, q);
    SEEN.add(navKeyFor(parts, q));
    setBg(typeof view.bg === "function" ? view.bg(parts, q) : view.bg);
    let data;
    if (view.load) {
      $("#main").innerHTML = loading();
      try { data = await view.load(parts, q); }
      catch (e) {
        if (seq !== renderSeq) return;
        if (e.status === 401) { UI.afterLogin = location.hash; return go("#/login"); }
        $("#main").innerHTML = `<div class="stage narrow panel empty">${ic(e.status === 404 ? "compass" : "wifi-off")}<h2>${e.status === 404 ? "This isn't available" : "The archive couldn't load this page"}</h2><p>${esc(e.message)}</p><div class="row" style="justify-content:center"><button class="btn" id="retry">${ic("rotate-ccw")}Try again</button><a class="btn ghost" href="#/home">Welcome page</a></div></div>`;
        $("#retry").onclick = render;
        return;
      }
      if (seq !== renderSeq) return; // the user moved on while this loaded
    }
    const main = $("#main");
    main.innerHTML = view.html(parts, q, data) + (page === "home" ? "" : footer());
    main.classList.toggle("is-home", page === "home");
    // Content comes into focus: blurred and small at first, then sharp, one piece after another.
    $$(".page-head, .searchbar, .results-line, .panel, .card, .orbs .orb-wrap, .grid > *, .list-row, .site-foot", main).slice(0, 40).forEach((el, i) => el.style.setProperty("--i", i));
    main.classList.remove("page-in"); void main.offsetWidth; main.classList.add("page-in");
    if (view.after) view.after(parts, q, data);
    const orbit = $("#orbit"); if (orbit) { layoutOrbit(orbit); flyIn(orbit, ".orb-wrap"); }
    enhance();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    refreshCounts();
    scheduleCoach(SEEN.has("coach:" + page) ? 3200 : 1300); SEEN.add("coach:" + page);
  }
  window.addEventListener("hashchange", render);

  /* ---------- Popups ---------- */
  let returnFocus = null;
  function modal(icon, title, inner, after, wide) {
    if (!$("#modalBg")) returnFocus = document.activeElement;
    closeModal(true);
    const bg = document.createElement("div");
    bg.className = "modal-bg"; bg.id = "modalBg";
    bg.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <button class="pill icon-only modal-x" data-close aria-label="Close">${ic("x")}</button>
      <div class="modal-ic">${ic(icon)}</div><h2>${esc(title)}</h2>${inner}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) closeModal(); });
    if (after) after(bg);
    const f = bg.querySelector(".modal input:not([type=checkbox]), .modal textarea, .modal select"); if (f) f.focus(); else bg.querySelector(".modal-x").focus();
  }
  function closeModal(keepFocus) {
    const m = $("#modalBg"); if (!m) return;
    m.remove();
    if (!keepFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  function sheet(title, inner, after) {
    closeSheet();
    const wrap = document.createElement("div"); wrap.id = "sheetWrap";
    returnFocus = document.activeElement;
    wrap.innerHTML = `<div class="sheet-bg" data-close-sheet></div><aside class="sheet" role="dialog" aria-label="${esc(title)}"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(title)}</h2><span class="spacer"></span><button class="pill icon-only" data-close-sheet aria-label="Close">${ic("x")}</button></div>${inner}</aside>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close-sheet]")) closeSheet(); });
    if (after) after(wrap);
    const first = wrap.querySelector("aside button, aside a, aside input"); if (first) first.focus();
  }
  function closeSheet() { const s = $("#sheetWrap"); if (s) { s.remove(); if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true }); } }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (pendingOrb) cancelOrb(); else if ($("#modalBg")) closeModal(); else if ($("#sheetWrap")) closeSheet(); else if ($("#menuOverlay")) closeMenuOverlay(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me()) { e.preventDefault(); quickSearch(); }
    // Keep keyboard focus inside an open pop-up.
    const box = $("#modalBg .modal") || $("#sheetWrap .sheet");
    if (e.key === "Tab" && box) {
      const items = $$('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function quickSearch() {
    if (!me()) return go("#/login");
    modal("search", "Quick search", `<input id="qsIn" placeholder="Try life jackets, ferry, Lake Turkana" autocomplete="off"><div id="qsRes" style="margin-top:12px"></div><p class="hint">Tip: press Ctrl + K from any page.</p>`, () => {
      let t = null, seq = 0;
      const draw = async () => {
        const q = $("#qsIn").value.trim(), my = ++seq;
        if (!q) { $("#qsRes").innerHTML = ""; return; }
        try {
          const res = await API.get("/records", { q, pageSize: 6 });
          if (my !== seq || !$("#qsRes")) return;
          $("#qsRes").innerHTML = res.items.length
            ? res.items.map((r) => `<a class="list-item" href="#/record/${esc(r.identifier)}"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${highlight(r.title, q)}</b><span>${esc(place(r))}, ${esc(yearText(r))}</span></span>${ic("chevron-right")}</a>`).join("") + `<a class="btn ghost sm" style="margin-top:10px" href="#/browse?q=${encodeURIComponent(q)}">See all ${res.total} results</a>`
            : `<p class="muted">Nothing matches "${esc(q)}". Try fewer words.</p>`;
        } catch (e) { if ($("#qsRes")) $("#qsRes").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
      };
      $("#qsIn").oninput = () => { clearTimeout(t); t = setTimeout(draw, 220); };
      $("#qsIn").onkeydown = (e) => { if (e.key === "Enter" && $("#qsIn").value.trim()) go("#/browse?q=" + encodeURIComponent($("#qsIn").value.trim())); };
    });
  }

  /* ---------- Reusable pieces ---------- */
  function thumbFor(r) {
    const img = (r.media || []).find((m) => m.mimeType && m.mimeType.startsWith("image/"));
    return img ? img.url : art(r, 480, 300);
  }
  function recCard(r, q) {
    const snip = r.snippet ? marked(r.snippet) : highlight(r.summary, q);
    return `<a class="card" href="#/record/${esc(r.identifier)}">
      <div class="thumb"><img src="${esc(thumbFor(r))}" alt="" loading="lazy"><span class="type-dot" title="${TYPES[r.type].label}">${ic(TYPES[r.type].icon)}</span></div>
      <div class="body"><h3>${highlight(r.title, q)}</h3><p>${snip}</p>
        <div class="meta"><span>${ic("map-pin")}${esc(place(r))}</span><span>${ic("calendar")}${esc(yearText(r))}</span>${r.durationSeconds ? `<span>${ic("clock")}${fmt(r.durationSeconds)}</span>` : ""}</div></div></a>`;
  }
  function head(title, sub, center) { return `<div class="page-head ${center ? "center" : ""}"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`; }
  function pager(page, pages, link) {
    if (pages <= 1) return "";
    return `<div class="pager">${page > 1 ? `<a class="pill" href="${link(page - 1)}">${ic("arrow-left")}Previous</a>` : ""}<span>Page ${page} of ${pages}</span>${page < pages ? `<a class="pill" href="${link(page + 1)}">Next${ic("arrow-right")}</a>` : ""}</div>`;
  }
  /** Drop zone for one or several files. cb receives an array of File objects. */
  function dropzone(zone, input, cb) {
    zone.onclick = () => input.click();
    zone.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
    input.onchange = () => cb(Array.from(input.files));
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag"); };
    zone.ondragleave = () => zone.classList.remove("drag");
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drag"); cb(Array.from(e.dataTransfer.files)); };
  }
  function slideBar() {
    if (P.lowBw) return `<div class="slide-bar"><button class="pill" id="videoOn">${ic("play")}Light mode is on, so the sea video is hidden. Show video</button></div>`;
    return `<div class="slide-bar"><div class="dots">${CLIPS.map((c, i) => `<button aria-label="Show clip ${i + 1}: ${esc(c.caption)}"></button>`).join("")}</div><span id="slideCap">${esc(CLIPS[UI.slide % CLIPS.length].caption)}</span></div>
      <div class="credit">Footage: Mixkit (free licence)</div>`;
  }
  function waterChoice(name, selected, allowNone) {
    const list = (VOCAB ? VOCAB.waterBodies : []);
    return `<div class="seg">${allowNone ? `<input type="radio" name="${name}" id="${name}-0" value="" ${!selected ? "checked" : ""}><label for="${name}-0">${ic("circle-help")}Not sure</label>` : ""}${list.map((w) => `<input type="radio" name="${name}" id="${name}-${w.id}" value="${w.id}" ${+selected === w.id ? "checked" : ""}><label for="${name}-${w.id}">${ic(WATER_ICONS[w.name] || "waves")}${esc(w.name)}</label>`).join("")}</div>`;
  }

  /* =====================================================================
     PAGES
     ===================================================================== */
  const ROUTES = {};

  ROUTES.home = {
    bg: "video",
    html() {
      const u = me();
      const center = !u
        ? `<h1>Kenya's memory of the water</h1>
           <p class="lede">Stories, photographs and records from the coast, the lakes and the rivers, so their safety lessons are never lost.</p>`
        : `<h1>${greeting()}, ${esc(u.name.split(" ")[0])}</h1>
           <p class="lede">${isStaff() && COUNTS.pending ? `${COUNTS.pending} submission${COUNTS.pending === 1 ? "" : "s"} waiting for review.` : "Where would you like to go? Point at an option to see what it does."}</p>`;
      return `${orbitHtml(center)}${slideBar()}`;
    },
    after() {
      const vo = $("#videoOn"); if (vo) vo.onclick = () => { P.lowBw = false; savePrefs(); render(); toast("Light mode off: video on", "play"); };
      $$(".dots button").forEach((d, i) => (d.onclick = () => { showSlide(i); startSlides(); }));
      $$(".dots button").forEach((d, k) => d.classList.toggle("on", k === UI.slide % CLIPS.length));
      cleanup.push(() => clearInterval(slideTimer));
    }
  };

  /* ----- Browse & search ----- */
  const PER_PAGE = 9;
  function browseQuery(qs) {
    const decade = +qs.get("decade") || 0;
    return { q: qs.get("q") || "", type: qs.get("type") || "", waterBodyId: qs.get("water") || "", county: qs.get("county") || "", sort: qs.get("sort") || "",
      yearFrom: decade || "", yearTo: decade ? decade + 9 : "", page: Math.max(1, +qs.get("page") || 1), pageSize: PER_PAGE };
  }
  ROUTES.browse = {
    title: "Browse the archive",
    bg: "search",
    async load(parts, qs) { await vocab(); return API.get("/records", browseQuery(qs)); },
    html(parts, qs, res) {
      const o = browseQuery(qs);
      const nFilters = ["water", "decade", "county", "sort"].filter((k) => qs.get(k)).length;
      const link = (patch) => { const p = new URLSearchParams(qs); if (!("page" in patch)) p.delete("page"); for (const k in patch) { if (patch[k]) p.set(k, patch[k]); else p.delete(k); } return "#/browse" + (p.toString() ? "?" + p.toString() : ""); };
      const chips = [qs.get("water") && [link({ water: "" }), WATER_ICONS[waterName(qs.get("water"))] || "waves", waterName(qs.get("water"))], qs.get("decade") && [link({ decade: "" }), "calendar", qs.get("decade") + "s"], qs.get("county") && [link({ county: "" }), "map-pin", qs.get("county")]].filter(Boolean);
      return `<div class="stage">
        ${head(o.type ? TYPES[o.type].plural : "Browse the archive", "", true)}
        <form class="searchbar" id="sform" role="search">${ic("search")}<label for="q" class="sr">Search the archive</label>
          <input id="q" value="${esc(o.q)}" placeholder="Search stories, places, years, transcripts"><button>Search</button></form>
        ${orbRow([
          { icon: "layers", label: "Everything", desc: "Show all types of material.", go: link({ type: "" }), on: !o.type },
          ...Object.keys(TYPES).map((t) => ({ icon: TYPES[t].icon, label: TYPES[t].plural, desc: `Show only ${TYPES[t].plural.toLowerCase()}.`, go: link({ type: t }), on: o.type === t })),
          { icon: "sliders-horizontal", label: nFilters ? `Filters (${nFilters})` : "Filters", desc: "Narrow by water body, decade or county, or change the order.", act: () => filterSheet(qs) }
        ])}
        <div class="results-line"><b style="color:#fff">${res.total} item${res.total === 1 ? "" : "s"}</b>${o.q ? `<span>matching "${esc(o.q)}"</span>` : ""}
          ${chips.map(([h, i, l]) => `<a class="chip on" href="${h}" title="Remove this filter">${ic(i)}${esc(l)}${ic("x")}</a>`).join("")}
          ${!o.q && !chips.length ? `<span>Try</span>${["life jackets", "ferry", "wind", "rescue", "children"].map((s) => `<a class="chip" href="${link({ q: s })}">${esc(s)}</a>`).join("")}` : ""}</div>
        ${res.items.length ? `<div class="grid g3">${res.items.map((r) => recCard(r, o.q)).join("")}</div>`
          : `<div class="panel empty">${ic("waves")}<h3>Nothing matches yet</h3><p>Try fewer words or remove a filter.</p><a class="btn" href="#/browse">Clear search and filters</a></div>`}
        ${pager(res.page, res.pages, (n) => link({ page: n }))}
      </div>`;
    },
    after(parts, qs) {
      $("#sform").onsubmit = (e) => { e.preventDefault(); const p = new URLSearchParams(qs); p.delete("page"); const v = $("#q").value.trim(); if (v) p.set("q", v); else p.delete("q"); go("#/browse?" + p.toString()); };
    }
  };
  async function filterSheet(qs) {
    let f; try { f = await facets(); } catch (e) { return fail(e); }
    sheet("Filters", `
      <label>Water body</label>
      <div class="row" style="margin-bottom:16px">${VOCAB.waterBodies.map((w) => `<button type="button" class="chip ${qs.get("water") == w.id ? "on" : ""}" data-w="${w.id}" aria-pressed="${qs.get("water") == w.id}">${ic(WATER_ICONS[w.name] || "waves")}${esc(w.name)}</button>`).join("")}</div>
      <div class="field"><label for="fd">Decade</label><select id="fd"><option value="">Any decade</option>${f.decades.map((d) => `<option value="${d.value}" ${qs.get("decade") == d.value ? "selected" : ""}>${d.value}s (${d.count})</option>`).join("")}</select></div>
      <div class="field"><label for="fcn">County</label><select id="fcn"><option value="">Any county</option>${f.counties.map((c) => `<option value="${esc(c.value)}" ${qs.get("county") === c.value ? "selected" : ""}>${esc(c.value)} (${c.count})</option>`).join("")}</select></div>
      <div class="field"><label for="fs">Order</label><select id="fs">${[["", "Best match, then most recently added"], ["newest", "Newest first"], ["oldest", "Oldest first"], ["popular", "Most viewed"], ["title", "Title A to Z"]].map(([v, l]) => `<option value="${v}" ${(qs.get("sort") || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row"><button class="btn" id="fApply">${ic("check")}Show results</button><button class="btn ghost" id="fClear">Clear filters</button></div>`, (w) => {
      $$("[data-w]", w).forEach((b) => (b.onclick = () => { const on = !b.classList.contains("on"); $$("[data-w]", w).forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); }); if (on) { b.classList.add("on"); b.setAttribute("aria-pressed", "true"); } }));
      const base = () => { const p = new URLSearchParams(); if (qs.get("q")) p.set("q", qs.get("q")); if (qs.get("type")) p.set("type", qs.get("type")); return p; };
      $("#fApply", w).onclick = () => {
        const p = base(); const wb = $("[data-w].on", w);
        if (wb) p.set("water", wb.dataset.w); if ($("#fd", w).value) p.set("decade", $("#fd", w).value); if ($("#fcn", w).value) p.set("county", $("#fcn", w).value); if ($("#fs", w).value) p.set("sort", $("#fs", w).value);
        closeSheet(); go("#/browse?" + p.toString());
      };
      $("#fClear", w).onclick = () => { closeSheet(); go("#/browse?" + base().toString()); };
    });
  }

  /* ----- Record ----- */
  ROUTES.record = {
    title: "Archive item",
    bg: "archive",
    load(parts) { return API.get("/records/" + encodeURIComponent(parts[1] || "")); },
    html(parts, q, r) {
      document.title = r.title + " | Maritime Safety Heritage Archive";
      const files = r.media || [];
      const pick = (prefix) => files.find((m) => m.role !== "thumbnail" && m.mimeType.startsWith(prefix));
      const audio = pick("audio/"), video = pick("video/"), image = pick("image/"), pdf = files.find((m) => m.mimeType === "application/pdf");
      const hasTranscript = r.transcript && r.transcript.length;
      let media = "";
      if (video) {
        media = `<div class="media vframe"><video id="av" class="protect" src="${esc(video.url)}" preload="metadata" playsinline controlslist="nodownload" poster="${esc(image ? image.url : art(r))}"></video>${hasTranscript ? `<div class="subs" id="subs" hidden></div>` : ""}
          <div class="vbar"><button class="play" id="playBtn" aria-label="Play">${ic("play")}</button><div class="track" id="seek" role="slider" aria-label="Position" tabindex="0"><b id="prog"></b></div><span class="time" id="time">0:00</span>
          <button class="play" id="fullBtn" aria-label="Full screen">${ic("maximize")}</button></div></div>`;
      } else if (audio) {
        media = `<div class="player"><audio id="av" src="${esc(audio.url)}" preload="metadata"></audio><button class="play" id="playBtn" aria-label="Play">${ic("play")}</button>
          <div class="track" id="seek" role="slider" aria-label="Position" tabindex="0"><b id="prog"></b></div><span class="time" id="time">0:00</span></div>`;
      } else if (image) {
        media = `<div class="media"><img class="media-img protect" src="${esc(image.url)}" alt="${esc(r.summary || r.title)}" draggable="false"><span class="watermark">${ic("life-buoy")}Remembering the Waters, ${esc(r.identifier)}</span></div>`;
      } else if (r.format === "audio" || r.format === "video") {
        media = `<div class="panel notice">${ic("clock")}<span>The ${r.format === "audio" ? "recording" : "video"} for this item is still being prepared.${hasTranscript ? " The transcript is below." : ""}</span></div>`;
      } else if (r.format === "image") {
        media = `<div class="media"><img class="media-img" src="${art(r, 1200, 675)}" alt=""><span class="watermark">${ic("image")}Picture to be added</span></div>`;
      }
      if (r.format === "document" && r.body) media += `<div class="scan">${r.body.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}<span class="stamp">ARCHIVE COPY</span></div>`;
      if (r.format === "text" && r.body) media += `<blockquote class="quote">${ic("quote")}${esc(r.body)}</blockquote>`;
      const docs = files.filter((m) => m !== audio && m !== video && m !== image);
      if (pdf || docs.length) media += `<div class="doc-actions">${docs.map((m) => `<a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">${ic(m.mimeType === "application/pdf" ? "file-text" : "download")}Open ${esc(m.originalName)} (${size(m.sizeBytes)})</a>`).join("")}</div>`;
      const transcript = hasTranscript ? `<div class="panel transcript" aria-label="Transcript">${r.transcript.map((t) => `<p data-t="${t.startSeconds}"><span class="ts">${fmt(t.startSeconds)}</span><span>${esc(t.text)}</span></p>`).join("")}</div>` : "";
      return `<div class="stage narrow">
        <a class="pill" href="#/browse" style="margin-bottom:18px">${ic("arrow-left")}Back to the archive</a>
        ${r.status !== "published" ? `<div class="panel row" style="margin-bottom:16px">${ic("eye")}<span>This item is <b>${esc(r.status)}</b>. Only the research team can see it.</span></div>` : ""}
        <div class="rec-head"><span class="rec-ic">${ic(TYPES[r.type].icon)}</span><div>
          <h1 style="font-size:clamp(1.6rem,3.4vw,2.3rem);margin-bottom:.3em">${esc(r.title)}</h1>
          <div class="facts"><span>${ic("tag")}${esc(r.identifier)}</span><span>${ic("map-pin")}${esc(place(r))}</span><span>${ic("calendar")}${esc(yearText(r))}</span>${r.durationSeconds ? `<span>${ic("clock")}${fmt(r.durationSeconds)}</span>` : ""}<span>${ic("eye")}${r.views.toLocaleString()} views</span></div></div></div>
        <p class="muted" style="font-size:1.04rem">${esc(r.summary)}</p>
        ${media}${transcript}
        ${orbRow([
          (audio || video) && { icon: "play", label: "Play", desc: "Plays the recording. The transcript follows along.", act: () => $("#playBtn").click(), id: "orbPlay", primary: true },
          { icon: "info", label: "Details", desc: "The full catalogue record: people, language, consent and rights.", act: () => detailsModal(r), primary: !(audio || video) },
          r.latitude != null && { icon: "map-pin", label: "Location", desc: "Where this happened, on the map.", act: () => locationModal(r) },
          { icon: "quote", label: "Cite", desc: "A ready-made citation for your work.", act: () => citeModal(r) },
          { icon: "share-2", label: "Share", desc: "Copies a link to this item.", act: () => copy(location.href, "Link copied") },
          isStaff() && { icon: "pencil", label: "Edit", desc: "Change this item's catalogue record and files.", go: "#/admin/edit/" + r.id }
        ])}
        ${r.related && r.related.length ? `<h2>Related items</h2><div class="grid g3">${r.related.map((x) => recCard(x)).join("")}</div>` : ""}
      </div>`;
    },
    after(parts, q, r) { if ($("#av")) setupPlayer(r); }
  };
  function copy(text, msg) {
    const done = () => toast(msg, "copy");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast("Copy didn't work. Select the text and copy it.", "info"));
    else toast("Copy didn't work. Select the text and copy it.", "info");
  }
  function detailsModal(r) {
    const rows = [["tag", "Identifier", r.identifier], [TYPES[r.type].icon, "Type", TYPES[r.type].label], [FORMATS[r.format][0], "Format", FORMATS[r.format][1]], ["calendar", "Date", yearText(r)], ["map-pin", "Place", [r.place, r.county && r.county + " County"].filter(Boolean).join(", ")], ["waves", "Water body", r.waterBody && r.waterBody.name],
      ["user", "Narrator", r.narrator], ["mic", "Interviewer", r.interviewer], ["camera", "Photographer", r.photographer], ["users", "Creator", r.creator], ["globe", "Language", r.language],
      ["clock", "Duration", r.durationSeconds && fmt(r.durationSeconds)], ["badge-check", "Consent", r.consent], ["shield", "Rights", r.rights], ["history", "Published", date(r.publishedAt)]].filter((x) => x[2]);
    modal("info", "Catalogue record", `<dl class="meta-list">${rows.map(([i, k, v]) => `${ic(i)}<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      ${r.subjects.length ? `<h3 style="margin-top:18px">Subjects</h3><div class="row">${r.subjects.map((s) => `<a class="chip" href="#/browse?q=${encodeURIComponent(s.label)}">${ic("tag")}${esc(s.label)}</a>`).join("")}</div>` : ""}
      ${(r.media || []).length ? `<h3 style="margin-top:18px">Files</h3>${r.media.map((m) => `<div class="small muted">${esc(m.originalName)}, ${esc(m.mimeType)}, ${size(m.sizeBytes)}<br>SHA-256 ${esc(m.sha256)}</div>`).join("")}` : ""}
      <p class="hint" style="margin-top:16px">© Remembering the Waters and contributors.${r.rights ? ` Shared under ${esc(r.rights)}.` : ""} Please credit the archive and ${esc(r.identifier)} when reusing.</p>`, null, true);
  }
  function locationModal(r) {
    modal("map-pin", r.place || "Location", `<p class="muted">${esc([r.county && r.county + " County", r.waterBody && r.waterBody.name].filter(Boolean).join(", "))}</p><div class="mini-map" id="miniMap"></div><a class="btn ghost sm" style="margin-top:14px" href="#/map">${ic("map")}Open the full map</a>`, () => drawMap($("#miniMap"), [r], { zoom: 8, center: [r.latitude, r.longitude], mini: true }));
  }
  function citeModal(r) {
    modal("quote", "Cite this item", `<p class="panel" style="font-family:var(--display)">${esc(r.citation)}</p><button class="btn" id="cpy">${ic("copy")}Copy citation</button>`, () => { $("#cpy").onclick = () => { copy(r.citation, "Citation copied"); closeModal(); }; });
  }
  /** Real playback with a transcript that follows along. */
  function setupPlayer(r) {
    const av = $("#av"), btn = $("#playBtn"), time = $("#time"), prog = $("#prog"), seek = $("#seek"), subs = $("#subs"), orbBtn = $("#orbPlay");
    const lines = $$(".transcript p[data-t]"), starts = (r.transcript || []).map((t) => t.startSeconds);
    let last = -1;
    const dur = () => (Number.isFinite(av.duration) && av.duration) || r.durationSeconds || 0;
    function paint() {
      time.textContent = fmt(av.currentTime) + " / " + fmt(dur());
      prog.style.width = (dur() ? (av.currentTime / dur()) * 100 : 0) + "%";
      let cur = -1; starts.forEach((s, i) => { if (av.currentTime >= s) cur = i; });
      if (cur !== last) {
        last = cur;
        lines.forEach((l, i) => l.classList.toggle("now", i === cur));
        const box = $(".transcript");
        if (box && lines[cur] && !av.paused) box.scrollTop = lines[cur].offsetTop - box.offsetTop - 40;
        if (subs) { subs.hidden = cur < 0; subs.textContent = cur >= 0 ? r.transcript[cur].text : ""; }
      }
    }
    function setIcon() {
      const p = !av.paused;
      btn.innerHTML = ic(p ? "pause" : "play"); btn.setAttribute("aria-label", p ? "Pause" : "Play");
      if (orbBtn) { orbBtn.innerHTML = ic(p ? "pause" : "play"); orbBtn.parentElement.querySelector(".orb-label").textContent = p ? "Pause" : "Play"; orbBtn.dataset.desc = p ? "Pauses the recording." : "Plays the recording. The transcript follows along."; orbBtn.parentElement.querySelector(".orb-desc").textContent = orbBtn.dataset.desc; }
    }
    btn.onclick = () => { if (av.paused) av.play().catch(() => toast("This file can't be played here. Try another browser.", "ban")); else av.pause(); };
    av.ontimeupdate = paint; av.onloadedmetadata = paint; av.onplay = setIcon; av.onpause = setIcon; av.onended = setIcon;
    av.onerror = () => toast("The recording couldn't load. Reload the page to get a fresh link.", "wifi-off");
    const jump = (t) => { av.currentTime = Math.max(0, Math.min(dur(), t)); paint(); };
    seek.onclick = (e) => { const b = seek.getBoundingClientRect(); jump(((e.clientX - b.left) / b.width) * dur()); };
    seek.onkeydown = (e) => { if (e.key === "ArrowRight") jump(av.currentTime + 5); if (e.key === "ArrowLeft") jump(av.currentTime - 5); };
    lines.forEach((l) => { l.style.cursor = "pointer"; l.onclick = () => { jump(+l.dataset.t); if (av.paused) av.play().catch(() => {}); }; });
    const fb = $("#fullBtn"); if (fb) fb.onclick = () => { const el = av.parentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); };
    cleanup.push(() => { av.pause(); av.removeAttribute("src"); av.load(); });
    paint();
  }

  /* ----- Map ----- */
  function pinIcon(r) { return window.L.divIcon({ className: "", html: `<div class="pin">${ic(TYPES[r.type].icon)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }); }
  function drawMap(el, recs, o = {}) {
    if (!el) return null;
    recs = recs.filter((r) => r.latitude != null && r.longitude != null);
    if (window.L) {
      const m = window.L.map(el, { scrollWheelZoom: !o.mini, zoomControl: !o.mini }).setView(o.center || [0.1, 37.9], o.zoom || 6);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abcd", attribution: "© OpenStreetMap contributors © CARTO" }).addTo(m);
      const markers = {};
      recs.forEach((r) => {
        markers[r.id] = window.L.marker([r.latitude, r.longitude], { icon: pinIcon(r), title: r.title }).addTo(m)
          .bindPopup(`${typeTag(r.type)}<br><b>${esc(r.title)}</b><br><span style="color:#93a7c6">${esc(r.place || "")}${r.year ? ", " + r.year : ""}</span><br><a href="#/record/${esc(r.identifier)}">Open this item</a>`);
      });
      setTimeout(() => m.invalidateSize(), 80);
      cleanup.push(() => m.remove());
      return { focus: (id) => { const r = recs.find((x) => x.id === id); if (!r) return; m.flyTo([r.latitude, r.longitude], 9, { duration: REDUCED ? 0 : 1.2 }); setTimeout(() => markers[id].openPopup(), REDUCED ? 50 : 1250); } };
    }
    el.innerHTML = `<div class="panel empty">${ic("wifi-off")}<p>The map couldn't load.</p></div>`;
    return { focus: (id) => { const r = recs.find((x) => x.id === id); if (r) go("#/record/" + r.identifier); } };
  }
  ROUTES.map = {
    title: "Incident map",
    bg: "map",
    load() { return API.get("/records/map"); },
    html(parts, qs) {
      const t = qs.get("type") || "";
      return `<h1 class="sr">Incident map</h1><div class="mapwrap"><div id="bigmap" role="region" aria-label="Map of archive items"></div></div>
        ${orbRow([
          { icon: "layers", label: "Everything", desc: "Show every item on the map.", go: "#/map", on: !t },
          ...Object.keys(TYPES).map((k) => ({ icon: TYPES[k].icon, label: TYPES[k].plural, desc: `Show only ${TYPES[k].plural.toLowerCase()}.`, go: "#/map?type=" + k, on: t === k })),
          { icon: "list", label: "List", desc: "A list of the items on the map. Pick one to fly to it.", act: () => mapList() }
        ], "map-orbs")}`;
    },
    after(parts, qs, pts) {
      const t = qs.get("type") || "";
      ROUTES.map._pts = pts.filter((r) => !t || r.type === t);
      ROUTES.map._m = drawMap($("#bigmap"), ROUTES.map._pts, {});
    }
  };
  function mapList() {
    const recs = ROUTES.map._pts || [];
    sheet(`${recs.length} place${recs.length === 1 ? "" : "s"}`, recs.map((r) => `<div class="list-item" tabindex="0" role="button" data-id="${esc(r.id)}"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${esc(r.title)}</b><span>${esc(r.place || r.waterBody || "")}${r.year ? ", " + r.year : ""}</span></span></div>`).join(""), (w) => {
      $$("[data-id]", w).forEach((el) => { const f = () => { const m = ROUTES.map._m; if (window.innerWidth < 760) closeSheet(); if (m) m.focus(el.dataset.id); }; el.onclick = f; el.onkeydown = (e) => { if (e.key === "Enter") f(); }; });
    });
  }

  /* ----- Share a story ----- */
  const ACCEPT = "audio/*,video/*,image/*,application/pdf,text/plain";
  ROUTES.submit = {
    title: "Share a story",
    bg: "hand-heart",
    load() { return vocab(); },
    html(parts, qs) {
      const t = TYPES[qs.get("type")] ? qs.get("type") : "";
      return `<div class="stage narrow">
        ${head("Share a story or material", "The research team checks consent and catalogues every submission before it appears in the archive.", true)}
        ${orbRow([
          ...Object.keys(TYPES).map((k) => ({ icon: TYPES[k].icon, label: TYPES[k].label, desc: { oral: "A recorded memory: audio or video.", photo: "A photograph from a family or community collection.", record: "A document, licence, notice or report.", testimony: "Your own written account." }[k], go: "#/submit?type=" + k, on: t === k })),
          { icon: "folder-open", label: "My submissions", desc: "What you've sent and its review status.", act: () => mySubmissions() }
        ])}
        ${t ? `<form class="panel" id="subForm" novalidate>
          <div class="row" style="margin-bottom:16px">${typeTag(t)}<span class="muted small">Change the type with the circles above.</span></div>
          <div class="field"><label for="st">Title</label><input id="st" required maxlength="300" placeholder="For example: My grandfather's fishing boat at Mbita"></div>
          <div class="grid g2"><div class="field"><label for="sy">Year (approximate)</label><input id="sy" type="number" min="1800" max="${new Date().getFullYear()}" placeholder="1985"></div>
          <div class="field"><label for="sp">Place</label><input id="sp" maxlength="200" placeholder="Beach, village or town, and county"></div></div>
          <div class="field"><label>Water body</label>${waterChoice("sw", "", true)}</div>
          <div class="field"><label for="sd">Tell us about it</label><textarea id="sd" required maxlength="10000" placeholder="Who, what, when, and the safety lesson it holds"></textarea></div>
          <div class="field"><label>Files (optional, up to 5)</label><div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose files">${ic("file-up")}<div><b>Drop files here</b> or choose them</div><div class="hint">Audio, video, photos, PDF or plain text. Up to 500 MB each.</div><div id="fname" class="small" style="color:var(--sky);margin-top:6px"></div></div><input type="file" id="sf" multiple accept="${ACCEPT}" hidden></div>
          <label class="check field"><input type="checkbox" id="sc"> I have the right to share this, and everyone recorded or pictured has agreed.</label>
          <div class="progress" id="prog" hidden><b></b></div>
          <div class="err" id="serr" role="alert"></div>
          <button class="btn" id="sbtn">${ic("upload")}Send for review</button></form>`
          : `<div class="panel empty">${ic("hand-heart")}<h3>Choose what you're sharing</h3><p>Pick one of the circles above to start.</p></div>`}
      </div>`;
    },
    after(parts, qs) {
      const t = qs.get("type"); if (!TYPES[t]) return;
      let files = [];
      dropzone($("#drop"), $("#sf"), (fs) => {
        files = fs.slice(0, 5);
        $("#fname").textContent = files.length ? files.map((f) => `${f.name} (${size(f.size)})`).join(", ") + (fs.length > 5 ? ". Only the first 5 will be sent." : "") : "";
      });
      $("#subForm").onsubmit = async (e) => {
        e.preventDefault();
        const err = $("#serr"); err.textContent = "";
        if ($("#st").value.trim().length < 3) return (err.textContent = "Give your story a title.");
        if ($("#sd").value.trim().length < 10) return (err.textContent = "Tell us a little about it (at least a sentence).");
        if (!$("#sc").checked) return (err.textContent = "Tick the box to confirm you have permission to share this.");
        const fd = new FormData();
        fd.append("type", t); fd.append("title", $("#st").value.trim()); fd.append("description", $("#sd").value.trim());
        if ($("#sy").value) fd.append("year", $("#sy").value);
        const wb = $("[name=sw]:checked"); if (wb && wb.value) fd.append("waterBodyId", wb.value);
        if ($("#sp").value.trim()) fd.append("place", $("#sp").value.trim());
        fd.append("consentConfirmed", "true");
        files.forEach((f) => fd.append("files", f));
        const btn = $("#sbtn"); busy(btn, true, files.length ? "Uploading" : "Sending");
        const bar = $("#prog"); bar.hidden = !files.length;
        try {
          const s = await API.upload("/submissions", fd, (p) => { $("b", bar).style.width = Math.round(p * 100) + "%"; });
          toast(`Sent as ${s.reference}. The research team will review it.`, "circle-check");
          go("#/submit");
        } catch (ex) { busy(btn, false); bar.hidden = true; err.textContent = ex.message; }
      };
    }
  };
  async function mySubmissions() {
    modal("folder-open", "My submissions", loading(), async () => {
      try {
        const res = await API.get("/submissions/mine", { pageSize: 50 });
        const box = $(".modal"); if (!box) return;
        $(".loading", box).outerHTML = res.items.length ? res.items.map((s) => `<div class="list-item"><span class="li-ic">${ic(TYPES[s.type].icon)}</span><span class="li-main"><b>${esc(s.title)}</b><span>${esc(s.reference)}, sent ${date(s.createdAt)}${s.reviewNote ? ". Note from the team: " + esc(s.reviewNote) : ""}</span></span>${status(s.status)}</div>`).join("")
          : `<p class="muted">Nothing yet. Choose a type of material to share your first story.</p>`;
      } catch (e) { fail(e); closeModal(); }
    });
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
          { icon: "shield", label: "Reusing material", desc: "Most items can be reused with credit. Check each item's licence.", act: () => modal("shield", "Reusing material", `<p>Each item shows its licence in its catalogue record. Most are shared under CC BY-NC 4.0: you can reuse them for non-commercial work if you credit the archive and the item number.</p>`) }
        ])}
        <form class="panel" id="cForm">
          <div class="grid g2"><div class="field"><label for="cn">Your name</label><input id="cn" required minlength="2" maxlength="120" value="${esc(u ? u.name : "")}"></div>
          <div class="field"><label for="ce">Email</label><input id="ce" type="email" required maxlength="254" value="${esc(u ? u.email : "")}"></div></div>
          <div class="field"><label for="cs">Subject</label><input id="cs" required minlength="3" maxlength="200"></div>
          <div class="field"><label for="cb">Message</label><textarea id="cb" required minlength="10" maxlength="5000"></textarea></div>
          <div class="honey" aria-hidden="true"><label for="cw">Leave this empty</label><input id="cw" tabindex="-1" autocomplete="off"></div>
          <div class="err" id="cerr" role="alert"></div>
          <button class="btn" id="cbtn">${ic("mail")}Send message</button></form></div>`;
    },
    after() {
      $("#cForm").onsubmit = async (e) => {
        e.preventDefault();
        const btn = $("#cbtn"); busy(btn, true, "Sending"); $("#cerr").textContent = "";
        try {
          const r = await API.post("/messages", { name: $("#cn").value.trim(), email: $("#ce").value.trim(), subject: $("#cs").value.trim(), body: $("#cb").value.trim(), website: $("#cw").value });
          toast(r.message, "mail"); go("#/home");
        } catch (ex) { busy(btn, false); $("#cerr").textContent = ex.message; }
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
        <div class="steps">${[["Discovery and design", "Month 12", "Requirements, metadata and the prototype"], ["Build", "Months 13 to 14", "Website, app, search and map on a test site"], ["Content and testing", "Months 14 to 15", "Materials catalogued, then tested and secured"], ["Launch and handover", "Month 16", "Public launch, training and full ownership"]]
          .map(([t, w, d], i) => `<div class="step panel"><div class="num">${i + 1}</div><b>${t}</b><span class="muted small" style="display:block;margin:4px 0">${w}</span><span>${d}</span></div>`).join("")}</div></div>`;
    }
  };

  /* ----- Privacy and terms ----- */
  const prose = (sections) => sections.map(([h, ...ps]) => `<section class="panel prose"><h2>${h}</h2>${ps.map((p) => Array.isArray(p) ? `<ul>${p.map((li) => `<li>${li}</li>`).join("")}</ul>` : `<p>${p}</p>`).join("")}</section>`).join("");
  ROUTES.privacy = {
    title: "Privacy",
    desc: "How the Maritime Safety Heritage Archive collects, protects and uses personal information.",
    bg: "shield",
    html() {
      return `<div class="stage narrow">${head("Privacy", "How the archive looks after your personal information. The Remembering the Waters research team is responsible for it, under Kenya's Data Protection Act, 2019.", true)}
        ${prose([
          ["What we collect", ["Your account: name, email address, optional organisation, and your password, stored only as a salted hash we cannot read.", "Sign-in records: when you sign in and the network address used, kept in an audit log to protect accounts.", "What you share: stories, files and the details you add when you submit material, and messages you send through the contact form.", "Which archive items are opened, counted without storing what you searched for."]],
          ["Why we use it", ["To let you sign in and use the archive on the website and the app.", "To review and, with your consent, add the material you share to the archive.", "To answer your messages.", "To keep the archive secure and to report on how it is used, in totals only."], "We never sell personal information or use it for advertising."],
          ["How we protect it", ["Every connection is encrypted (HTTPS).", "Stored files are encrypted, and backups are encrypted.", "Files are only reachable through private links that expire after an hour.", "Accounts lock after repeated wrong passwords, and every staff action is logged."]],
          ["How long we keep it", "Your account details are kept while your account is open. Sign-in records are kept for up to two years. Material accepted into the archive is kept permanently as part of Kenya's heritage record, credited as you agreed when you shared it."],
          ["Your choices", ["See and correct your details under My account.", "Change your password, or sign out on every device.", "Close your account under My account. Your name, email and organisation are erased, and submissions still waiting for review are withdrawn and deleted.", "Ask for a copy of your information, or ask us to remove material you shared, through the contact form."]],
          ["Contact", `Questions or requests: use the <a href="#/contact">contact form</a>. You can also complain to the Office of the Data Protection Commissioner of Kenya.`]
        ])}</div>`;
    }
  };
  ROUTES.terms = {
    title: "Terms and copyright",
    desc: "Terms of use and copyright for the Maritime Safety Heritage Archive.",
    bg: "scroll-text",
    html() {
      return `<div class="stage narrow">${head("Terms and copyright", "The archive is open to everyone with an account. These terms protect the people whose stories it holds.", true)}
        ${prose([
          ["Who owns the material", `The oral histories, photographs, records and testimonies belong to their contributors and communities, and are held by the Remembering the Waters research team. The website, app and catalogue are © ${new Date().getFullYear()} Remembering the Waters.`],
          ["What you may do", ["Read, watch and listen for personal study, teaching, research and safety work.", "Quote short passages with a citation. Every item shows a ready-made citation with its identifier, such as MSH-0001.", "Link to any item."]],
          ["What needs permission", ["Republishing or broadcasting whole items, photographs or recordings.", "Commercial use of any kind.", "Copying the archive or downloading it in bulk, including with automated tools. Automated access is rate-limited and monitored."], `Ask through the <a href="#/contact">contact form</a>.`],
          ["Sharing material", "When you share a story or file, you confirm you have the right to share it and the consent of the people in it. The research team reviews everything before it is published and may decline or edit the description."],
          ["The official archive", "This is the archive's only official address. Copies elsewhere are not endorsed. If you see archive material published without permission, tell us through the contact form and we will ask for it to be removed."],
          ["Your account", "Keep your password private. The team may suspend accounts that misuse the archive or other people's material."]
        ])}</div>`;
    }
  };
  function footer() {
    return `<footer class="site-foot"><span>© ${new Date().getFullYear()} Remembering the Waters research team. Shared with contributors' consent; reuse needs permission.</span>
      <span><a href="#/terms">Terms and copyright</a><a href="#/privacy">Privacy</a><a href="#/contact">Contact</a></span></footer>`;
  }
  // Discourage saving photos and videos with the right-click menu or by dragging.
  document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest(".protect, .media")) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".protect")) e.preventDefault(); });

  /* ----- Sign in, create account, reset password ----- */
  ROUTES.login = {
    title: "Sign in",
    bg: "life-buoy",
    html(parts, qs) {
      if (me()) { setTimeout(() => go("#/home")); return ""; }
      const up = qs.get("tab") === "up";
      return `<div class="stage">${head("Welcome aboard", "Everyone signs in with their own account, on the website or the app.", true)}
        <div class="panel auth-card">
          <div class="tabs" role="tablist"><button class="${up ? "" : "on"}" data-tab="in" role="tab" aria-selected="${!up}">Sign in</button><button class="${up ? "on" : ""}" data-tab="up" role="tab" aria-selected="${up}">Create account</button></div>
          <form id="inForm" ${up ? "hidden" : ""}><div class="field"><label for="le">Email</label><input id="le" type="email" required autocomplete="username"></div>
            <div class="field"><label for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"></div>
            <div class="err" id="lerr" role="alert"></div>
            <button class="btn" id="lbtn" style="width:100%">${ic("log-in")}Sign in</button>
            <p class="small center" style="margin:12px 0 0"><a href="#" id="forgot">Forgot your password?</a></p></form>
          <form id="upForm" ${up ? "" : "hidden"}><div class="field"><label for="un">Full name</label><input id="un" required minlength="2" maxlength="120" autocomplete="name"></div>
            <div class="field"><label for="ue">Email</label><input id="ue" type="email" required autocomplete="email"></div>
            <div class="field"><label for="uo">Organisation or community (optional)</label><input id="uo" maxlength="160"></div>
            <div class="field"><label for="up">Password</label><input id="up" type="password" minlength="8" required autocomplete="new-password"><div class="hint">At least 8 characters, with a letter and a number.</div></div>
            <div class="err" id="uerr" role="alert"></div>
            <button class="btn" id="ubtn" style="width:100%">${ic("user-plus")}Create account</button></form>
        </div></div>`;
    },
    after() {
      if (!$("#inForm")) return;
      $$("[data-tab]").forEach((b) => (b.onclick = () => { $$("[data-tab]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); $("#inForm").hidden = b.dataset.tab !== "in"; $("#upForm").hidden = b.dataset.tab !== "up"; }));
      $("#inForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#lbtn"); busy(btn, true, "Signing in"); $("#lerr").textContent = "";
        try { await API.login($("#le").value.trim(), $("#lp").value); signedIn(); }
        catch (ex) { busy(btn, false); $("#lerr").textContent = ex.message; }
      };
      $("#upForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#ubtn"); busy(btn, true, "Creating account"); $("#uerr").textContent = "";
        if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test($("#up").value)) { busy(btn, false); $("#uerr").textContent = "Use at least 8 characters, with a letter and a number."; return; }
        try { await API.register({ name: $("#un").value.trim(), email: $("#ue").value.trim(), password: $("#up").value, organisation: $("#uo").value.trim() || undefined }); signedIn(); }
        catch (ex) { busy(btn, false); $("#uerr").textContent = ex.message; }
      };
      $("#forgot").onclick = (e) => {
        e.preventDefault();
        modal("key-round", "Reset your password", `<form id="fpForm"><p class="muted">We'll email you a link to choose a new password. It works for 30 minutes.</p><div class="field"><label for="fe">Email</label><input id="fe" type="email" required value="${esc($("#le").value)}"></div><div class="err" id="fperr"></div><button class="btn" id="fpbtn">${ic("mail")}Email me a link</button></form>`, () => {
          $("#fpForm").onsubmit = async (ev) => {
            ev.preventDefault(); const btn = $("#fpbtn"); busy(btn, true, "Sending");
            try { const r = await API.post("/auth/forgot-password", { email: $("#fe").value.trim() }); closeModal(); toast(r.message, "mail"); }
            catch (ex) { busy(btn, false); $("#fperr").textContent = ex.message; }
          };
        });
      };
    }
  };
  function signedIn() {
    const u = me(); VOCAB = null; FACETS = null;
    toast(`Welcome, ${u.name.split(" ")[0]}`, "life-buoy");
    const back = UI.afterLogin; UI.afterLogin = null;
    const target = back && !/^#\/(login|reset-password)/.test(back) ? back : "#/home";
    if (location.hash === target) render(); else go(target);
  }
  ROUTES["reset-password"] = {
    title: "Choose a new password",
    bg: "key-round",
    html(parts, qs) {
      return `<div class="stage">${head("Choose a new password", "This link works once, for 30 minutes.", true)}
        <form class="panel auth-card" id="rpForm">${qs.get("token") ? "" : `<p class="err">This link is incomplete. Open the link from your email again, or ask for a new one.</p>`}
          <div class="field"><label for="rp1">New password</label><input id="rp1" type="password" required minlength="8" autocomplete="new-password"><div class="hint">At least 8 characters, with a letter and a number.</div></div>
          <div class="field"><label for="rp2">Type it again</label><input id="rp2" type="password" required minlength="8" autocomplete="new-password"></div>
          <div class="err" id="rperr" role="alert"></div>
          <button class="btn" id="rpbtn" style="width:100%">${ic("key-round")}Save new password</button></form></div>`;
    },
    after(parts, qs) {
      $("#rpForm").onsubmit = async (e) => {
        e.preventDefault(); const err = $("#rperr"); err.textContent = "";
        if ($("#rp1").value !== $("#rp2").value) return (err.textContent = "The two passwords don't match.");
        if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test($("#rp1").value)) return (err.textContent = "Use at least 8 characters, with a letter and a number.");
        const btn = $("#rpbtn"); busy(btn, true, "Saving");
        try { await API.post("/auth/reset-password", { token: qs.get("token") || "", password: $("#rp1").value }); API.clear(); toast("Password changed. Sign in with your new password.", "key-round"); go("#/login"); }
        catch (ex) { busy(btn, false); err.textContent = ex.message; }
      };
    }
  };

  /* ----- My account ----- */
  ROUTES.profile = {
    title: "My account",
    bg: "user",
    load() { return API.get("/auth/me"); },
    html(parts, q, u) {
      API.user = Object.assign(API.user || {}, u);
      return `<div class="stage narrow center">
        <span class="avatar" style="width:84px;height:84px;font-size:1.8rem;margin:0 auto 14px">${esc(initials(u.name))}</span>
        ${head(esc(u.name), `${esc(u.email)}<br>${roleName(u.role)} since ${date(u.createdAt)}${u.organisation ? ", " + esc(u.organisation) : ""}`, true)}
        ${orbRow([
          { icon: "pencil", label: "Edit profile", desc: "Change your name or organisation.", act: () => editProfile(u), primary: true },
          { icon: "key-round", label: "Password", desc: "Change your password. You'll sign in again everywhere.", act: changePassword },
          { icon: "folder-open", label: "My submissions", desc: "What you've sent and its review status.", act: mySubmissions },
          { icon: "shield", label: "Sign out everywhere", desc: "Ends your sessions on every device, including this one.", act: signOutEverywhere },
          { icon: "log-out", label: "Sign out", desc: "Signs you out on this device.", act: signOut },
          { icon: "ban", label: "Close account", desc: "Permanently deletes your account and personal details.", act: closeAccount }
        ])}</div>`;
    }
  };
  function editProfile(u) {
    modal("pencil", "Edit profile", `<form id="pForm"><div class="field"><label for="pn">Name</label><input id="pn" value="${esc(u.name)}" required minlength="2" maxlength="120"></div>
      <div class="field"><label for="po">Organisation or community</label><input id="po" value="${esc(u.organisation || "")}" maxlength="160"></div><div class="err" id="perr"></div><button class="btn" id="pbtn">${ic("check")}Save profile</button></form>`, () => {
      $("#pForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#pbtn"); busy(btn, true, "Saving");
        try { API.user = await API.patch("/auth/me", { name: $("#pn").value.trim(), organisation: $("#po").value.trim() }); closeModal(); toast("Profile saved"); render(); }
        catch (ex) { busy(btn, false); $("#perr").textContent = ex.message; }
      };
    });
  }
  function changePassword() {
    modal("key-round", "Change password", `<form id="pwForm"><div class="field"><label for="p1">Current password</label><input id="p1" type="password" required autocomplete="current-password"></div>
      <div class="field"><label for="p2">New password</label><input id="p2" type="password" minlength="8" required autocomplete="new-password"><div class="hint">At least 8 characters, with a letter and a number. You'll be signed out on every device.</div></div>
      <div class="err" id="pwErr"></div><button class="btn" id="pwbtn">${ic("check")}Change password</button></form>`, () => {
      $("#pwForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#pwbtn"); busy(btn, true, "Saving");
        try { await API.post("/auth/change-password", { currentPassword: $("#p1").value, newPassword: $("#p2").value }); API.clear(); closeModal(); toast("Password changed. Sign in with your new password.", "key-round"); go("#/login"); }
        catch (ex) { busy(btn, false); $("#pwErr").textContent = ex.message; }
      };
    });
  }
  function closeAccount() {
    modal("ban", "Close your account?", `<p class="muted">This can't be undone. Your name, email and organisation are erased and you can't sign in again. Submissions still waiting for review are withdrawn and their files deleted. Material already accepted into the archive stays in it.</p>
      <form id="caForm"><div class="field"><label for="cap">Your password</label><input id="cap" type="password" required autocomplete="current-password"></div>
      <div class="err" id="caErr" role="alert"></div><div class="row"><button class="btn danger" id="caBtn">${ic("ban")}Close my account</button><button type="button" class="btn ghost" data-close>Keep my account</button></div></form>`, () => {
      $("#caForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#caBtn"); busy(btn, true, "Closing");
        try { await API.post("/auth/delete-account", { password: $("#cap").value }); API.clear(); closeModal(); toast("Your account is closed", "ban"); go("#/home"); render(); }
        catch (ex) { busy(btn, false); $("#caErr").textContent = ex.message; }
      };
    });
  }
  function signOutEverywhere() {
    modal("shield", "Sign out everywhere?", `<p class="muted">You'll be signed out on every phone and computer, including this one.</p><div class="row"><button class="btn" id="soOk">${ic("log-out")}Sign out everywhere</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
      $("#soOk").onclick = async () => { try { await API.post("/auth/logout-all"); } catch (e) {} API.clear(); closeModal(); toast("Signed out on every device", "shield"); go("#/home"); render(); };
    });
  }

  /* ----- Mobile app ----- */
  ROUTES.app = {
    title: "Mobile app",
    bg: "smartphone",
    html() {
      return `<div class="stage">${head("The same archive, in your pocket", "One app for Android and iOS phones and tablets, using the same secure accounts and archive as this website. Try it inside the phone.", true)}
        <div class="app-stage"><div class="phone"><iframe src="index.html?app=1#/home" title="Mobile app preview"></iframe></div>
        <div class="panel" style="max-width:380px"><h3>What the app does</h3><ul class="feature-list">
          ${[["log-in", "Sign in with the same account as the website"], ["search", "Search, browse and filter"], ["map", "Incident map"], ["headphones", "Play oral histories and read transcripts"], ["camera", "Share stories and photos straight from the phone camera"], ["inbox", "The research team can review submissions on the go"]]
            .map(([i, t]) => `<li><span class="li-ic">${ic(i)}</span>${t}</li>`).join("")}</ul>
          <p class="hint">The store versions for Google Play and the App Store follow this website.</p></div></div>
</div>`;
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
    load(parts, qs) { const v = ADMIN[parts[1] || "overview"] || ADMIN.overview; return v.load ? v.load(parts, qs) : null; },
    html(parts, qs, data) { return `<div class="stage">${(ADMIN[parts[1] || "overview"] || ADMIN.overview).html(parts, qs, data)}</div>`; },
    after(parts, qs, data) { const v = ADMIN[parts[1] || "overview"] || ADMIN.overview; if (v.after) v.after(parts, qs, data); }
  };
  const bars = (rows, label, value) => { const max = Math.max(1, ...rows.map(value)); return `<div class="bars">${rows.map((r) => `<div class="b"><em>${value(r).toLocaleString()}</em><i style="height:${(value(r) / max) * 82}%"></i><small>${esc(label(r))}</small></div>`).join("")}</div>`; };
  const month = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" });
  const logList = (items) => items.length ? `<ul class="log">${items.map((a) => `<li><span class="li-ic">${ic(a.action.startsWith("login.") ? "lock" : a.action.startsWith("login") ? "log-in" : "activity")}</span><div><time>${dateTime(a.createdAt)}</time><b>${esc(a.actorName)}</b> ${esc(a.summary || a.action)}${a.ip ? ` <span class="small muted">(${esc(a.ip)})</span>` : ""}</div></li>`).join("")}</ul>` : `<p class="muted">Nothing recorded yet.</p>`;

  ADMIN.overview = {
    load() { return API.get("/reports/summary"); },
    html(parts, qs, s) {
      const t = s.totals;
      COUNTS.pending = t.pendingSubmissions; COUNTS.unread = isAdmin() ? t.unreadMessages : 0;
      return `${head("Archive dashboard", "What's happening in the archive today.", true)}
        <div class="grid g4">
          <div class="kpi"><span class="li-ic">${ic("archive")}</span><div><b>${t.published}</b><span>Published items</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("pencil")}</span><div><b>${t.records - t.published}</b><span>Drafts and unpublished</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("inbox")}</span><div><b>${t.pendingSubmissions}</b><span>Waiting for review</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("users")}</span><div><b>${t.users}</b><span>Accounts (${t.activeUsers30d} active this month)</span></div></div>
        </div>
        ${orbRow([
          { icon: "archive", label: "Records", desc: "Edit, publish or unpublish items.", go: "#/admin/records" },
          { icon: "upload", label: "Upload", desc: "Add a new item and catalogue it.", go: "#/admin/upload", primary: true },
          { icon: "inbox", label: "Review", desc: "Approve or decline material sent in by the public.", go: "#/admin/submissions", badge: t.pendingSubmissions || "" },
          isAdmin() && { icon: "users", label: "Users", desc: "Create accounts, change roles, suspend accounts.", go: "#/admin/users" },
          isAdmin() && { icon: "mail", label: "Messages", desc: "Messages from the contact form.", go: "#/admin/messages", badge: t.unreadMessages || "" },
          isAdmin() && { icon: "activity", label: "Reports", desc: "Usage, collection health and the audit log.", go: "#/admin/activity" }
        ].filter(Boolean))}
        ${t.storageAlertBytes ? `<div class="panel row" style="margin-bottom:16px">${ic("archive")}<span>Media storage: <b>${size(t.storageBytes)}</b> used of the ${size(t.storageAlertBytes)} alert level (${Math.round((t.storageBytes / t.storageAlertBytes) * 100)}%).</span></div>` : ""}
        <div class="grid g2">
          <div class="panel"><h3>${ic("trending-up")} Item views per month</h3>${bars(s.viewsByMonth, (r) => month(r.month), (r) => r.count)}</div>
          <div class="panel"><h3>${ic("history")} Recent activity</h3>${logList(s.recentActivity.slice(0, 6))}</div>
        </div>`;
    }
  };

  /* ----- Records list ----- */
  ADMIN.records = {
    load(parts, qs) { return API.get("/records", { q: qs.get("f") || "", status: qs.get("s") || "", page: Math.max(1, +qs.get("page") || 1), pageSize: 20, sort: qs.get("f") ? "relevance" : "added" }); },
    html(parts, qs, res) {
      const f = qs.get("f") || "", st = qs.get("s") || "";
      const link = (n) => { const p = new URLSearchParams(qs); p.set("page", n); return "#/admin/records?" + p.toString(); };
      return `${head("Records", `${res.total} item${res.total === 1 ? "" : "s"}${st ? `, ${st}` : ""}${f ? `, matching "${esc(f)}"` : ""}`, true)}
        ${orbRow([dash,
          { icon: "plus", label: "New item", desc: "Add and catalogue a new item.", go: "#/admin/upload", primary: true },
          { icon: "sliders-horizontal", label: "Filter", desc: "Find items by words or status.", act: () => recordFilter(qs) },
          { icon: "trash-2", label: "Deleted", desc: "Items that were deleted and can be restored.", act: deletedRecords },
          { icon: "download", label: "Export", desc: "Download every record as a CSV file.", act: () => exportCsv("records") }
        ])}
        ${res.items.length ? `<div class="panel tbl-wrap"><table class="tbl"><thead><tr><th><span class="sr">Type</span></th><th>Title</th><th>Place</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>
        ${res.items.map((r) => `<tr><td><span class="li-ic" title="${TYPES[r.type].label}">${ic(TYPES[r.type].icon)}</span></td><td><a href="#/record/${esc(r.identifier)}"><b style="color:#fff">${esc(r.title)}</b></a><div class="small muted">${esc(r.identifier)}</div></td><td class="small">${esc(place(r))}</td><td>${status(r.status)}</td><td>${r.views}</td>
          <td><div class="actions"><a class="btn ghost sm" href="#/admin/edit/${r.id}">${ic("pencil")}Edit</a>${r.status === "published" ? `<button class="btn ghost sm" data-unpub="${r.id}">${ic("eye")}Unpublish</button>` : `<button class="btn sm" data-pub="${r.id}">${ic("check")}Publish</button>`}</div></td></tr>`).join("")}
        </tbody></table></div>${pager(res.page, res.pages, link)}` : `<div class="panel empty">${ic("archive")}<h3>No items match</h3><a class="btn" href="#/admin/records">Show all records</a></div>`}`;
    },
    after() {
      $$("[data-pub]").forEach((b) => (b.onclick = async () => { busy(b, true, "Publishing"); try { await API.post(`/records/${b.dataset.pub}/publish`); toast("Published"); render(); } catch (e) { busy(b, false); fail(e); } }));
      $$("[data-unpub]").forEach((b) => (b.onclick = async () => { busy(b, true, "Unpublishing"); try { await API.post(`/records/${b.dataset.unpub}/unpublish`); toast("Unpublished. Users can no longer see it.", "eye"); render(); } catch (e) { busy(b, false); fail(e); } }));
    }
  };
  function recordFilter(qs) {
    sheet("Filter records", `<div class="field"><label for="rf">Words in the title, summary or transcript</label><input id="rf" value="${esc(qs.get("f") || "")}"></div>
      <label>Status</label><div class="seg" style="margin-bottom:18px">${["", "published", "draft", "unpublished"].map((s, i) => `<input type="radio" name="rs" id="rs${i}" value="${s}" ${(qs.get("s") || "") === s ? "checked" : ""}><label for="rs${i}">${s ? s[0].toUpperCase() + s.slice(1) : "All"}</label>`).join("")}</div>
      <button class="btn" id="rfApply">${ic("check")}Apply</button>`, (w) => {
      $("#rfApply", w).onclick = () => { const p = new URLSearchParams(); if ($("#rf", w).value.trim()) p.set("f", $("#rf", w).value.trim()); const s = $("[name=rs]:checked", w).value; if (s) p.set("s", s); closeSheet(); go("#/admin/records" + (p.toString() ? "?" + p : "")); };
    });
  }
  function deletedRecords() {
    modal("trash-2", "Deleted items", loading(), async () => {
      try {
        const list = await API.get("/records/deleted");
        const box = $(".modal"); if (!box) return;
        $(".loading", box).outerHTML = list.length ? `<div>${list.map((r) => `<div class="list-item"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${esc(r.title)}</b><span>${esc(r.identifier)}, deleted ${date(r.deletedAt)}</span></span><button class="btn ghost sm" data-restore="${r.id}">${ic("rotate-ccw")}Restore</button></div>`).join("")}</div>` : `<p class="muted">Nothing has been deleted.</p>`;
        $$("[data-restore]", box).forEach((b) => (b.onclick = async () => { busy(b, true, "Restoring"); try { await API.post(`/records/${b.dataset.restore}/restore`); closeModal(); toast("Restored as unpublished"); render(); } catch (e) { busy(b, false); fail(e); } }));
      } catch (e) { closeModal(); fail(e); }
    }, true);
  }
  async function exportCsv(kind) {
    try { await API.download("/reports/export", { kind }, `maritime-heritage-${kind}-${new Date().toISOString().slice(0, 10)}.csv`); toast("Downloaded", "download"); }
    catch (e) { fail(e); }
  }

  /* ----- Catalogue form (new item and edit) ----- */
  const RIGHTS = ["CC BY-NC 4.0", "CC BY 4.0", "Used with permission", "Public record", "© Lender, used with permission"];
  const CONSENTS = ["Signed consent form on file", "Verbal consent recorded", "Online consent given at submission", "Permission letter on file", "Not applicable (public record)"];
  const transcriptText = (t) => (t || []).map((x) => `${fmt(x.startSeconds)}  ${x.text}`).join("\n");
  function parseTranscript(text) {
    const out = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      const m = /^(\d{1,2}(?::\d{1,2}){0,2})\s+(.+)$/.exec(line);
      if (!m) throw new Error(`Transcript line ${i + 1} needs a start time first, like "1:05  What was said".`);
      out.push({ startSeconds: parseTime(m[1]), text: m[2].trim() });
    }
    return out.sort((a, b) => a.startSeconds - b.startSeconds);
  }
  function recordForm(r) {
    const v = (k, d = "") => esc(r && r[k] != null ? r[k] : d);
    const type = r ? r.type : "oral", format = r ? r.format : "audio";
    return `<form class="panel" id="recForm" novalidate>
      <div class="field"><label>Type of material</label><div class="seg">${Object.keys(TYPES).map((t) => `<input type="radio" name="ft" id="ft-${t}" value="${t}" ${t === type ? "checked" : ""}><label for="ft-${t}">${ic(TYPES[t].icon)}${TYPES[t].label}</label>`).join("")}</div></div>
      <div class="field"><label>Format</label><div class="seg">${Object.keys(FORMATS).map((f) => `<input type="radio" name="ff" id="ff-${f}" value="${f}" ${f === format ? "checked" : ""}><label for="ff-${f}">${ic(FORMATS[f][0])}${FORMATS[f][1]}</label>`).join("")}</div></div>
      <div class="grid g2"><div class="field"><label for="fti">Title</label><input id="fti" required maxlength="300" value="${v("title")}"></div>
        <div class="field"><label for="fid">Identifier</label><input id="fid" value="${r ? esc(r.identifier) : "Assigned when saved"}" disabled></div></div>
      <div class="field"><label for="fsu">Summary</label><textarea id="fsu" maxlength="2000">${v("summary")}</textarea><div class="hint">Two or three sentences shown in search results. Needed before publishing.</div></div>
      <div class="field"><label for="fbo">Full text</label><textarea id="fbo" maxlength="200000" placeholder="For a testimony, the full account. For a document, its transcribed pages.">${v("body")}</textarea></div>
      <div class="field"><label>Water body</label>${waterChoice("fw", r && r.waterBody ? r.waterBody.id : "", true)}</div>
      <div class="grid g3"><div class="field"><label for="fy">Year</label><input id="fy" type="number" min="1800" max="2200" value="${v("year")}"><label class="check small" style="margin-top:6px"><input type="checkbox" id="fya" ${r && r.yearApproximate ? "checked" : ""}> Approximate</label></div>
        <div class="field"><label for="fp">Place</label><input id="fp" maxlength="200" value="${v("place")}"></div>
        <div class="field"><label for="fc">County</label><input id="fc" maxlength="80" value="${v("county")}"></div></div>
      <div class="grid g2"><div class="field"><label for="fla">Latitude</label><input id="fla" type="number" step="any" min="-90" max="90" value="${v("latitude")}"></div>
        <div class="field"><label for="flo">Longitude</label><input id="flo" type="number" step="any" min="-180" max="180" value="${v("longitude")}"><div class="hint">Places the item on the incident map. Leave both empty if unknown.</div></div></div>
      <div class="grid g2"><div class="field"><label for="fcr">Creator or collector</label><input id="fcr" maxlength="200" value="${v("creator", r ? "" : "Remembering the Waters field team")}"></div>
        <div class="field"><label for="fna">Narrator</label><input id="fna" maxlength="200" value="${v("narrator")}"><div class="hint">Write "(anonymised)" if the person asked not to be named.</div></div></div>
      <div class="grid g3"><div class="field"><label for="fin">Interviewer</label><input id="fin" maxlength="200" value="${v("interviewer")}"></div>
        <div class="field"><label for="fph">Photographer</label><input id="fph" maxlength="200" value="${v("photographer")}"></div>
        <div class="field"><label for="fl">Language</label><input id="fl" maxlength="120" value="${v("language", r ? "" : "English")}"></div></div>
      <div class="grid g3"><div class="field"><label for="fr">Rights</label><input id="fr" list="rightsList" maxlength="200" value="${v("rights")}"><datalist id="rightsList">${RIGHTS.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
        <div class="field"><label for="fco">Consent</label><input id="fco" list="consentList" maxlength="300" value="${v("consent")}"><datalist id="consentList">${CONSENTS.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
        <div class="field"><label for="fdu">Duration</label><input id="fdu" placeholder="12:30" value="${r && r.durationSeconds ? fmt(r.durationSeconds) : ""}"><div class="hint">For audio and video, as minutes:seconds.</div></div></div>
      <div class="field"><label for="ftg">Subjects</label><input id="ftg" list="subjList" value="${r ? esc(r.subjects.map((s) => s.label).join(", ")) : ""}" placeholder="Separate with commas: ferry, life jackets"><datalist id="subjList">${(VOCAB ? VOCAB.subjects : []).map((s) => `<option value="${esc(s.label)}">`).join("")}</datalist><div class="hint">Use existing subjects where you can. New ones are added to the list.</div></div>
      <div class="field"><label for="ftr">Transcript</label><textarea id="ftr" class="mono" placeholder="0:00  First words of the recording&#10;0:28  The next part">${esc(transcriptText(r && r.transcript))}</textarea><div class="hint">One line per passage: start time, two spaces, then the words. The transcript is searchable.</div></div>
      ${r ? "" : `<div class="field"><label>Media file (optional)</label><div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a media file">${ic("upload")}<div><b>Drop audio, video, a photo, a PDF or a text file</b></div><div class="hint">The original is kept as it is, with a checksum. Up to 500 MB.</div><div id="fname" class="small" style="color:var(--sky);margin-top:6px"></div></div><input type="file" id="fmf" accept="${ACCEPT}" hidden><div class="progress" id="fprog" hidden><b></b></div></div>`}
      <div class="err" id="ferr" role="alert"></div>
      <div class="row">${r ? `<button class="btn" type="submit" data-act="save">${ic("check")}Save changes</button>${r.status !== "published" ? `<button class="btn ghost" type="submit" data-act="publish">${ic("eye")}Save and publish</button>` : ""}`
        : `<button class="btn" type="submit" data-act="publish">${ic("check")}Save and publish</button><button class="btn ghost" type="submit" data-act="save">${ic("pencil")}Save as draft</button>`}<span class="spacer"></span><a href="#/admin/records" class="btn ghost">Cancel</a></div>
    </form>`;
  }
  function readRecordForm() {
    const num = (id) => { const x = $(id).value.trim(); return x === "" ? null : Number(x); };
    const wb = $("[name=fw]:checked");
    const dur = $("#fdu").value.trim();
    const data = {
      type: $("[name=ft]:checked").value, format: $("[name=ff]:checked").value, title: $("#fti").value.trim(), summary: $("#fsu").value.trim(),
      body: $("#fbo").value.trim() || null, year: num("#fy"), yearApproximate: $("#fya").checked, waterBodyId: wb && wb.value ? +wb.value : null,
      place: $("#fp").value.trim(), county: $("#fc").value.trim(), latitude: num("#fla"), longitude: num("#flo"),
      creator: $("#fcr").value.trim(), narrator: $("#fna").value.trim(), interviewer: $("#fin").value.trim(), photographer: $("#fph").value.trim(),
      language: $("#fl").value.trim(), rights: $("#fr").value.trim(), consent: $("#fco").value.trim(),
      durationSeconds: dur ? parseTime(dur) : null,
      subjects: $("#ftg").value.split(",").map((x) => x.trim()).filter((x) => x.length >= 2),
      transcript: parseTranscript($("#ftr").value),
    };
    if (data.title.length < 3) throw new Error("Give the item a title (at least 3 characters).");
    if (dur && data.durationSeconds == null) throw new Error("Write the duration as minutes:seconds, like 12:30.");
    if ((data.latitude == null) !== (data.longitude == null)) throw new Error("Fill in both latitude and longitude, or leave both empty.");
    return data;
  }
  function bindRecordForm(r) {
    let act = "save", file = null;
    $$("#recForm [data-act]").forEach((b) => (b.onclick = () => (act = b.dataset.act)));
    if ($("#drop")) dropzone($("#drop"), $("#fmf"), (fs) => { file = fs[0] || null; $("#fname").textContent = file ? `Selected: ${file.name} (${size(file.size)})` : ""; });
    $("#recForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#ferr"); err.textContent = "";
      let data; try { data = readRecordForm(); } catch (ex) { err.textContent = ex.message; return; }
      const btn = $(`#recForm [data-act="${act}"]`); busy(btn, true, "Saving");
      try {
        const saved = r ? await API.patch("/records/" + r.id, data) : await API.post("/records", data);
        if (file) {
          const fd = new FormData(); fd.append("file", file); $("#fprog").hidden = false;
          await API.upload(`/records/${saved.id}/media`, fd, (p) => { $("#fprog b").style.width = Math.round(p * 100) + "%"; });
        }
        if (act === "publish") await API.post(`/records/${saved.id}/publish`);
        toast(act === "publish" ? `${saved.identifier} published` : r ? "Changes saved" : `${saved.identifier} saved as a draft`);
        if (r) render(); else go("#/admin/edit/" + saved.id);
      } catch (ex) { busy(btn, false); err.textContent = ex.message; }
    };
  }
  ADMIN.upload = {
    async load() { await vocab(); return null; },
    html() {
      return `${head("Upload and catalogue", "Add a new item with its catalogue record. You can add more files after saving.", true)}
        ${orbRow([dash, { icon: "archive", label: "Records", desc: "Back to the list of records.", go: "#/admin/records" }])}${recordForm(null)}`;
    },
    after() { bindRecordForm(null); }
  };
  ADMIN.edit = {
    async load(parts) { VOCAB = null; await vocab(); return API.get("/records/" + encodeURIComponent(parts[2] || "")); },
    html(parts, qs, r) {
      return `${head("Edit " + esc(r.identifier), `${status(r.status)} Every change is recorded in the audit log.`, true)}
        ${orbRow([dash,
          { icon: "eye", label: "View item", desc: "See the item as users see it.", go: "#/record/" + r.identifier },
          r.status === "published" ? { icon: "ban", label: "Unpublish", desc: "Takes the item offline for users.", act: () => setStatus(r, "unpublish") } : { icon: "check", label: "Publish", desc: "Makes the item visible to signed-in users.", act: () => setStatus(r, "publish"), primary: true },
          { icon: "trash-2", label: "Delete", desc: "Removes the item. It can be restored from Records.", act: () => deleteRecord(r) },
          { icon: "archive", label: "Records", desc: "Back to the list of records.", go: "#/admin/records" }
        ])}
        <div class="panel" style="margin-bottom:18px"><h3>${ic("folder-open")} Files</h3>
          <div class="files">${(r.media || []).length ? r.media.map((m) => `<div class="list-item"><span class="li-ic">${ic(m.mimeType.startsWith("audio/") ? "headphones" : m.mimeType.startsWith("video/") ? "video" : m.mimeType.startsWith("image/") ? "image" : "file-text")}</span><span class="li-main"><b>${esc(m.originalName)}</b><span>${esc(m.mimeType)}, ${size(m.sizeBytes)}, ${esc(m.role)}, added ${date(m.createdAt)}</span></span><div class="actions"><a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">${ic("eye")}Open</a><button class="btn danger sm" data-delmedia="${m.id}">${ic("trash-2")}Delete</button></div></div>`).join("") : `<p class="muted">No files yet.</p>`}</div>
          <div class="row" style="margin-top:14px"><select id="mrole" style="width:auto" aria-label="File role"><option value="original">Original</option><option value="web">Web copy</option><option value="thumbnail">Thumbnail</option></select><button class="btn ghost" id="addFile" type="button">${ic("upload")}Add a file</button><input type="file" id="mfile" accept="${ACCEPT}" hidden></div>
          <div class="progress" id="mprog" hidden><b></b></div></div>
        ${recordForm(r)}`;
    },
    after(parts, qs, r) {
      bindRecordForm(r);
      $("#addFile").onclick = () => $("#mfile").click();
      $("#mfile").onchange = async () => {
        const f = $("#mfile").files[0]; if (!f) return;
        const fd = new FormData(); fd.append("role", $("#mrole").value); fd.append("file", f);
        const bar = $("#mprog"); bar.hidden = false; busy($("#addFile"), true, "Uploading");
        try { await API.upload(`/records/${r.id}/media`, fd, (p) => { $("b", bar).style.width = Math.round(p * 100) + "%"; }); toast(`${f.name} added`); render(); }
        catch (e) { busy($("#addFile"), false); bar.hidden = true; fail(e); }
      };
      $$("[data-delmedia]").forEach((b) => (b.onclick = () => modal("trash-2", "Delete this file?", `<p class="muted">The stored file is removed permanently. The catalogue record stays.</p><div class="row"><button class="btn danger" id="dmOk">${ic("trash-2")}Delete file</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
        $("#dmOk").onclick = async () => { busy($("#dmOk"), true, "Deleting"); try { await API.del("/media/" + b.dataset.delmedia); closeModal(); toast("File deleted", "trash-2"); render(); } catch (e) { closeModal(); fail(e); } };
      })));
    }
  };
  async function setStatus(r, what) {
    try { await API.post(`/records/${r.id}/${what}`); toast(what === "publish" ? `${r.identifier} published` : `${r.identifier} unpublished`, what === "publish" ? "circle-check" : "eye"); render(); }
    catch (e) { fail(e); }
  }
  function deleteRecord(r) {
    modal("trash-2", "Delete this item?", `<p class="muted">"${esc(r.title)}" goes offline and moves to Deleted items, where it can be restored. Its files are kept.</p><div class="row"><button class="btn danger" id="drOk">${ic("trash-2")}Delete item</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
      $("#drOk").onclick = async () => { try { await API.del("/records/" + r.id); closeModal(); toast(`${r.identifier} deleted`, "trash-2"); go("#/admin/records"); } catch (e) { closeModal(); fail(e); } };
    });
  }

  /* ----- Submissions ----- */
  ADMIN.submissions = {
    load(parts, qs) { return API.get("/submissions", { status: qs.get("show") || "pending", page: Math.max(1, +qs.get("page") || 1), pageSize: 10 }); },
    html(parts, qs, res) {
      const show = qs.get("show") || "pending";
      if (show === "pending") COUNTS.pending = res.total;
      const link = (n) => `#/admin/submissions?show=${show}&page=${n}`;
      return `${head("Submissions", "Material sent in by the public. Approving creates a draft item for you to catalogue before publishing.", true)}
        ${orbRow([dash,
          { icon: "inbox", label: "Waiting", desc: "Submissions still to review.", go: "#/admin/submissions", on: show === "pending", badge: COUNTS.pending || "" },
          { icon: "circle-check", label: "Approved", desc: "Submissions already added to the archive.", go: "#/admin/submissions?show=approved", on: show === "approved" },
          { icon: "ban", label: "Declined", desc: "Submissions that were turned down.", go: "#/admin/submissions?show=rejected", on: show === "rejected" },
          { icon: "download", label: "Export", desc: "Download all submissions as a CSV file.", act: () => exportCsv("submissions") }
        ])}
        <div class="grid" style="gap:14px">${res.items.length ? res.items.map((s) => `<div class="panel"><div class="row">${typeTag(s.type)}${status(s.status)}<span class="spacer"></span><span class="small muted">${esc(s.reference)}, ${date(s.createdAt)}</span></div>
          <h3 style="margin:12px 0 4px">${esc(s.title)}</h3>
          <div class="facts" style="margin-bottom:8px"><span>${ic("user")}${esc(s.submittedBy ? s.submittedBy.name + " (" + s.submittedBy.email + ")" : "")}</span>${s.place ? `<span>${ic("map-pin")}${esc(s.place)}</span>` : ""}${s.year ? `<span>${ic("calendar")}${s.year}</span>` : ""}${s.waterBody ? `<span>${ic(WATER_ICONS[s.waterBody.name] || "waves")}${esc(s.waterBody.name)}</span>` : ""}</div>
          <p style="margin:0 0 8px;white-space:pre-line">${esc(s.description)}</p>
          <div class="facts" style="margin-bottom:12px"><span>${ic("badge-check")}Consent confirmed by contributor</span></div>
          ${s.files.length ? `<div class="files" style="margin-bottom:12px">${s.files.map((f) => `<a class="list-item" href="${esc(f.url)}" target="_blank" rel="noopener"><span class="li-ic">${ic("file-up")}</span><span class="li-main"><b>${esc(f.originalName)}</b><span>${esc(f.mimeType)}, ${size(f.sizeBytes)}</span></span>${ic("eye")}</a>`).join("")}</div>` : `<p class="small muted">No files attached.</p>`}
          ${s.reviewNote ? `<p class="small muted">Note: ${esc(s.reviewNote)}</p>` : ""}
          ${s.status === "pending" ? `<div class="actions"><button class="btn sm" data-approve="${s.id}">${ic("check")}Approve and catalogue</button><button class="btn ghost sm" data-reject="${s.id}">${ic("ban")}Decline</button></div>` : s.recordId ? `<a class="btn ghost sm" href="#/admin/edit/${s.recordId}">${ic("pencil")}Open the catalogue record</a>` : ""}
        </div>`).join("") : `<div class="panel empty">${ic("circle-check")}<h3>Nothing here</h3><p>${show === "pending" ? "Every submission has been reviewed." : "No submissions in this list yet."}</p></div>`}</div>
        ${pager(res.page, res.pages, link)}`;
    },
    after(parts, qs, res) {
      const find = (id) => res.items.find((x) => x.id === id);
      $$("[data-approve]").forEach((b) => (b.onclick = () => {
        const s = find(b.dataset.approve);
        modal("check", "Approve this submission?", `<p class="muted">"${esc(s.title)}" becomes a draft item with its files. You'll catalogue it next, then publish.</p><div class="field"><label for="an">Message to the contributor (optional)</label><textarea id="an" maxlength="2000"></textarea></div><div class="row"><button class="btn" id="aok">${ic("check")}Approve</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
          $("#aok").onclick = async () => {
            busy($("#aok"), true, "Approving");
            try { const r = await API.post(`/submissions/${s.id}/approve`, { reviewNote: $("#an").value.trim() || undefined }); closeModal(); toast(`Draft ${r.recordIdentifier} created. Complete it, then publish.`); go("#/admin/edit/" + r.recordId); }
            catch (e) { closeModal(); fail(e); render(); }
          };
        });
      }));
      $$("[data-reject]").forEach((b) => (b.onclick = () => {
        const s = find(b.dataset.reject);
        modal("ban", "Decline this submission?", `<p class="muted">"${esc(s.title)}"</p><div class="field"><label for="rr">Message to the contributor</label><textarea id="rr" maxlength="2000">Thank you for your submission. We can't include it because </textarea><div class="hint">Emailed to ${esc(s.submittedBy ? s.submittedBy.email : "the contributor")}.</div></div><div class="err" id="rerr"></div><div class="row"><button class="btn danger" id="rok">${ic("ban")}Decline</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
          $("#rok").onclick = async () => {
            busy($("#rok"), true, "Declining");
            try { await API.post(`/submissions/${s.id}/reject`, { reviewNote: $("#rr").value.trim() }); closeModal(); toast("Declined. The contributor has been told.", "ban"); render(); }
            catch (e) { busy($("#rok"), false); $("#rerr").textContent = e.message; }
          };
        });
      }));
    }
  };

  /* ----- Users ----- */
  ADMIN.users = {
    load(parts, qs) { return API.get("/users", { q: qs.get("q") || "", page: Math.max(1, +qs.get("page") || 1), pageSize: 25 }); },
    html(parts, qs, res) {
      const link = (n) => { const p = new URLSearchParams(qs); p.set("page", n); return "#/admin/users?" + p.toString(); };
      return `${head("Users and roles", "Members search, browse, play media and share material. Editors also catalogue, publish and review. Admins also manage people, messages and reports.", true)}
        ${orbRow([dash, { icon: "user-plus", label: "Create user", desc: "Add a member, editor or admin with a one-time password.", act: createUser, primary: true }])}
        <form class="searchbar" id="uform" role="search" style="margin-bottom:18px">${ic("search")}<label for="uq" class="sr">Find a user</label><input id="uq" value="${esc(qs.get("q") || "")}" placeholder="Name, email or organisation"><button>Find</button></form>
        <div class="panel tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>
        ${res.items.map((u) => { const self = u.id === me().id; return `<tr><td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(initials(u.name))}</span><div><b style="color:#fff">${esc(u.name)}</b><div class="small muted">${esc(u.email)}${u.organisation ? ", " + esc(u.organisation) : ""}</div></div></div></td>
          <td><select data-role="${u.id}" ${self ? "disabled title=\"You can't change your own role\"" : ""} aria-label="Role for ${esc(u.name)}">${["user", "editor", "admin"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${roleName(r)}</option>`).join("")}</select></td>
          <td>${status(u.status)}</td><td class="small">${u.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}</td>
          <td><div class="actions"><button class="btn ghost sm" data-reset="${u.id}">${ic("key-round")}Reset password</button>${self ? "" : `<button class="btn ${u.status === "active" ? "danger" : ""} sm" data-susp="${u.id}" data-to="${u.status === "active" ? "suspended" : "active"}">${ic(u.status === "active" ? "ban" : "circle-check")}${u.status === "active" ? "Suspend" : "Reactivate"}</button>`}</div></td></tr>`; }).join("")}
        </tbody></table></div>${pager(res.page, res.pages, link)}`;
    },
    after(parts, qs, res) {
      const find = (id) => res.items.find((x) => x.id === id);
      $("#uform").onsubmit = (e) => { e.preventDefault(); const v = $("#uq").value.trim(); go("#/admin/users" + (v ? "?q=" + encodeURIComponent(v) : "")); };
      $$("[data-role]").forEach((s) => (s.onchange = async () => { try { await API.patch("/users/" + s.dataset.role, { role: s.value }); toast("Role changed. Their sessions were ended so it takes effect now."); render(); } catch (e) { fail(e); render(); } }));
      $$("[data-susp]").forEach((b) => (b.onclick = async () => {
        busy(b, true, "Saving");
        try { await API.patch("/users/" + b.dataset.susp, { status: b.dataset.to }); toast(b.dataset.to === "suspended" ? "Account suspended and signed out" : "Account reactivated", b.dataset.to === "suspended" ? "ban" : "circle-check"); render(); }
        catch (e) { busy(b, false); fail(e); }
      }));
      $$("[data-reset]").forEach((b) => (b.onclick = () => {
        const u = find(b.dataset.reset);
        modal("key-round", "Reset password?", `<p class="muted">${esc(u.name)} gets a one-time password and is signed out everywhere. They can also reset it themselves with "Forgot your password?".</p><div class="row"><button class="btn" id="rpOk">${ic("key-round")}Reset password</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
          $("#rpOk").onclick = async () => {
            try { const r = await API.post(`/users/${u.id}/reset-password`); showTempPassword(u.email, r.temporaryPassword); }
            catch (e) { closeModal(); fail(e); }
          };
        });
      }));
    }
  };
  function showTempPassword(email, pw) {
    modal("key-round", "One-time password", `<p>Give this to <b>${esc(email)}</b> privately. It is shown only once.</p><p class="panel temp-pw">${esc(pw)}</p><button class="btn" id="cpw">${ic("copy")}Copy</button><p class="hint">Ask them to change it from My account after signing in.</p>`, () => { $("#cpw").onclick = () => copy(pw, "Copied"); });
  }
  function createUser() {
    modal("user-plus", "Create user", `<form id="nuForm"><div class="field"><label for="nn">Name</label><input id="nn" required minlength="2" maxlength="120"></div><div class="field"><label for="ne">Email</label><input id="ne" type="email" required></div>
      <div class="field"><label for="nor">Organisation (optional)</label><input id="nor" maxlength="160"></div>
      <div class="field"><label>Role</label><div class="seg"><input type="radio" name="nr" id="nr1" value="user" checked><label for="nr1">${ic("user")}Member</label><input type="radio" name="nr" id="nr3" value="editor"><label for="nr3">${ic("pencil")}Editor</label><input type="radio" name="nr" id="nr2" value="admin"><label for="nr2">${ic("user-round-cog")}Admin</label></div></div>
      <div class="err" id="nuerr"></div><button class="btn" id="nubtn">${ic("user-plus")}Create user</button></form>`, () => {
      $("#nuForm").onsubmit = async (e) => {
        e.preventDefault(); const btn = $("#nubtn"); busy(btn, true, "Creating");
        try {
          const r = await API.post("/users", { name: $("#nn").value.trim(), email: $("#ne").value.trim(), role: $("[name=nr]:checked").value, organisation: $("#nor").value.trim() || undefined });
          render(); setTimeout(() => showTempPassword(r.user.email, r.temporaryPassword), 300);
        } catch (ex) { busy(btn, false); $("#nuerr").textContent = ex.message; }
      };
    });
  }

  /* ----- Messages ----- */
  ADMIN.messages = {
    load(parts, qs) { return API.get("/messages", { filter: qs.get("f") || "", page: Math.max(1, +qs.get("page") || 1), pageSize: 20 }); },
    html(parts, qs, res) {
      COUNTS.unread = res.unread;
      const f = qs.get("f") || "";
      const link = (n) => `#/admin/messages?${f ? "f=" + f + "&" : ""}page=${n}`;
      return `${head("Messages", "From the contact form.", true)}
        ${orbRow([dash,
          { icon: "inbox", label: "All", desc: "Every message.", go: "#/admin/messages", on: !f },
          { icon: "bell", label: "Unread", desc: "Messages nobody has read yet.", go: "#/admin/messages?f=unread", on: f === "unread", badge: res.unread || "" }
        ])}
        <div class="grid" style="gap:12px">${res.items.length ? res.items.map((m) => `<div class="panel" style="${m.read ? "" : "border-color:var(--blue-2)"}"><div class="row"><span class="li-ic">${ic(m.read ? "mail" : "bell")}</span><b style="color:#fff">${esc(m.subject)}</b><span class="spacer"></span><span class="small muted">${dateTime(m.createdAt)}</span></div>
          <p class="small muted" style="margin:8px 0">${esc(m.name)}, ${esc(m.email)}</p><p style="white-space:pre-line">${esc(m.body)}</p>
          <div class="actions"><button class="btn ghost sm" data-read="${m.id}" data-to="${!m.read}">${ic(m.read ? "bell" : "check")}${m.read ? "Mark as unread" : "Mark as read"}</button><a class="btn sm" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: " + m.subject)}">${ic("mail")}Reply by email</a><button class="btn ghost sm" data-del="${m.id}">${ic("trash-2")}Delete</button></div></div>`).join("") : `<div class="panel empty">${ic("inbox")}<h3>No messages</h3></div>`}</div>
        ${pager(res.page, res.pages, link)}`;
    },
    after() {
      $$("[data-read]").forEach((b) => (b.onclick = async () => { try { await API.patch("/messages/" + b.dataset.read, { read: b.dataset.to === "true" }); render(); } catch (e) { fail(e); } }));
      $$("[data-del]").forEach((b) => (b.onclick = () => modal("trash-2", "Delete this message?", `<p class="muted">It is removed permanently.</p><div class="row"><button class="btn danger" id="dmok">${ic("trash-2")}Delete</button><button class="btn ghost" data-close>Cancel</button></div>`, () => {
        $("#dmok").onclick = async () => { try { await API.del("/messages/" + b.dataset.del); closeModal(); toast("Message deleted", "trash-2"); render(); } catch (e) { closeModal(); fail(e); } };
      })));
    }
  };

  /* ----- Reports and audit log ----- */
  ADMIN.activity = {
    async load(parts, qs) {
      const [summary, log] = await Promise.all([API.get("/reports/summary"), API.get("/reports/activity", { action: qs.get("a") || "", page: Math.max(1, +qs.get("page") || 1), pageSize: 25 })]);
      return { summary, log };
    },
    html(parts, qs, d) {
      const s = d.summary, t = s.totals, a = qs.get("a") || "";
      const mx = Math.max(1, ...s.byWaterBody.map((x) => x.count));
      const link = (n) => `#/admin/activity?${a ? "a=" + a + "&" : ""}page=${n}`;
      const filters = [["", "Everything"], ["login", "Sign-ins"], ["record", "Records"], ["submission", "Submissions"], ["user", "Users"], ["media", "Files"], ["password", "Passwords"]];
      return `${head("Reports and activity", "How the archive is used, and everything that happens in it.", true)}
        ${orbRow([dash,
          { icon: "download", label: "Records CSV", desc: "Download every record as a CSV file.", act: () => exportCsv("records") },
          { icon: "download", label: "Audit log CSV", desc: "Download the full audit log as a CSV file.", act: () => exportCsv("activity") }
        ])}
        <div class="grid g4">
          <div class="kpi"><span class="li-ic">${ic("eye")}</span><div><b>${t.totalViews.toLocaleString()}</b><span>Item views</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("users")}</span><div><b>${t.activeUsers30d}</b><span>Active users this month</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("hand-heart")}</span><div><b>${s.submissionsByMonth.reduce((n, x) => n + x.count, 0)}</b><span>Submissions this year</span></div></div>
          <div class="kpi"><span class="li-ic">${ic("archive")}</span><div><b>${size(t.storageBytes || 0)}</b><span>Media stored</span></div></div>
        </div>
        <div class="grid g2" style="margin-top:18px">
          <div class="panel"><h3>${ic("waves")} Published items by water body</h3>${s.byWaterBody.map((w) => `<div class="hbar">${ic(WATER_ICONS[w.water_body] || "waves")}<span>${esc(w.water_body)}</span><div><i style="width:${(w.count / mx) * 100}%"></i></div><b>${w.count}</b></div>`).join("") || `<p class="muted">Nothing published yet.</p>`}</div>
          <div class="panel"><h3>${ic("trending-up")} Most viewed</h3>${s.topRecords.map((r) => `<a class="list-item" href="#/record/${esc(r.identifier)}"><span class="li-ic">${ic(TYPES[r.type].icon)}</span><span class="li-main"><b>${esc(r.title)}</b><span>${esc(r.identifier)}, ${r.views} views</span></span></a>`).join("")}</div>
        </div>
        <div class="panel" style="margin-top:18px"><h3>${ic("hand-heart")} Submissions per month</h3>${bars(s.submissionsByMonth, (r) => month(r.month), (r) => r.count)}</div>
        <div class="panel" style="margin-top:18px"><div class="row"><h3 style="margin:0">${ic("history")} Audit log</h3><span class="spacer"></span><label for="af" class="sr">Show</label><select id="af" style="width:auto">${filters.map(([v, l]) => `<option value="${v}" ${a === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          ${logList(d.log.items)}${pager(d.log.page, d.log.pages, link)}</div>`;
    },
    after() { $("#af").onchange = () => go("#/admin/activity" + ($("#af").value ? "?a=" + $("#af").value : "")); }
  };

  /* ---------- Boot ---------- */
  if (APP_MODE) document.documentElement.classList.add("app-mode");
  API.onSignedOut = () => { toast("Your session ended. Sign in again.", "lock"); };
  (async () => {
    await API.refresh(); // restores the session from the secure cookie, if there is one
    render();
  })();
})();
