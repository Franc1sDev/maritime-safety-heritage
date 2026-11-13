/* =====================================================================
   Maritime Safety Heritage Archive: API client for the website.
   The access token lives only in memory. The refresh token is an
   httpOnly cookie the page cannot read; it is used with a custom header
   so other sites cannot trigger it.
   ===================================================================== */
(function () {
  "use strict";
  const BASE = "/api/v1";

  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const messageOf = (body, status) => {
    const m = body && body.message;
    if (Array.isArray(m)) return m.join(" ");
    if (typeof m === "string" && m) return m;
    if (status === 0) return "Can't reach the archive. Check your connection and try again.";
    return "Something went wrong. Try again.";
  };

  const API = {
    token: null,
    user: null,
    onSignedOut: null,
    _refreshing: null,

    async request(method, path, opts = {}) {
      const headers = { "X-Requested-With": "XMLHttpRequest" };
      if (this.token) headers.Authorization = "Bearer " + this.token;
      let body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
      let url = BASE + path;
      if (opts.query) {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(opts.query)) {
          if (v === undefined || v === null || v === "") continue;
          if (Array.isArray(v)) { if (v.length) p.set(k, v.join(",")); } else p.set(k, v);
        }
        const s = p.toString(); if (s) url += "?" + s;
      }
      let res;
      try { res = await fetch(url, { method, headers, body, credentials: "same-origin" }); }
      catch (e) { throw new ApiError(0, messageOf(null, 0)); }
      if (res.status === 401 && opts.retry !== false && !path.startsWith("/auth/")) {
        if (await this.refresh()) return this.request(method, path, Object.assign({}, opts, { retry: false }));
        this.clear();
        if (this.onSignedOut) this.onSignedOut();
      }
      if (opts.blob && res.ok) return res.blob();
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok) throw new ApiError(res.status, messageOf(data, res.status));
      return data;
    },
    get(path, query) { return this.request("GET", path, { query }); },
    post(path, body) { return this.request("POST", path, { body: body || {} }); },
    patch(path, body) { return this.request("PATCH", path, { body }); },
    del(path) { return this.request("DELETE", path); },

    /** Swaps the refresh cookie for a new access token. Concurrent callers share one attempt. */
    refresh() {
      if (!this._refreshing) {
        this._refreshing = this.request("POST", "/auth/refresh", { body: {}, retry: false })
          .then((s) => { this.setSession(s); return true; })
          .catch(() => false)
          .finally(() => { this._refreshing = null; });
      }
      return this._refreshing;
    },
    setSession(s) { this.token = s.accessToken; this.user = s.user; },
    clear() { this.token = null; this.user = null; },

    async login(email, password) { this.setSession(await this.request("POST", "/auth/login", { body: { email, password } })); return this.user; },
    async register(data) { this.setSession(await this.request("POST", "/auth/register", { body: data })); return this.user; },
    async logout() { try { await this.request("POST", "/auth/logout", { body: {} }); } catch (e) { /* signed out locally anyway */ } this.clear(); },

    /** Multipart upload with progress (fetch cannot report upload progress). */
    upload(path, form, onProgress) {
      const send = (retry) => new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open("POST", BASE + path);
        x.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        if (this.token) x.setRequestHeader("Authorization", "Bearer " + this.token);
        if (onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        x.onload = async () => {
          let data = null; try { data = JSON.parse(x.responseText); } catch (e) {}
          if (x.status === 401 && retry && (await this.refresh())) return resolve(send(false));
          if (x.status >= 200 && x.status < 300) resolve(data); else reject(new ApiError(x.status, messageOf(data, x.status)));
        };
        x.onerror = () => reject(new ApiError(0, messageOf(null, 0)));
        x.send(form);
      });
      return send(true);
    },

    /** Saves a file the API generates (for example a CSV export). */
    async download(path, query, filename) {
      const blob = await this.request("GET", path, { query, blob: true });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };

  window.MSH_API = API;
  window.MSH_ApiError = ApiError;
})();
