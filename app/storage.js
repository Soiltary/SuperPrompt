/* SuperPrompt v2: local storage helpers: settings, history migration, export/import.
   No DOM access; works with any object that has getItem/setItem (localStorage or a test double). */
(function (root) {
  "use strict";

  var KEYS = {
    theme: "mpz-theme", ui: "mpz-ui-lang", goal: "mpz-goal", base: "mpz-base", out: "mpz-out-lang",
    result: "mpz-result", current: "mpz-current-id", history: "mpz-history", pending: "mpz-pending",
    note: "mpz-note", settings: "mpz-settings", schema: "mpz-schema"
  };
  var SCHEMA = 2;
  var DEFAULT_SETTINGS = { mode: "auto", level: "balanced", target: "agent", format: "sections", alternatives: false };
  var ITEM_DEFAULTS = { mode: "auto", level: "balanced", target: "agent", format: "sections", base: "" };
  var OUT_LANGS = ["ar", "en", "es", "fr", "de", "tr", "pt", "ja", "ko", "zh"];

  function read(st, k, fb) { try { var v = st.getItem(k); return v === null || v === undefined ? fb : v; } catch (e) { return fb; } }
  function write(st, k, v) { try { st.setItem(k, v); return true; } catch (e) { return false; } }
  function readJSON(st, k, fb) { var raw = read(st, k, null); if (raw === null) return fb; try { return JSON.parse(raw); } catch (e) { return { __corrupt: true, raw: raw }; } }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function getSettings(st) {
    var s = readJSON(st, KEYS.settings, null), out = {};
    for (var k in DEFAULT_SETTINGS) out[k] = s && !s.__corrupt && s[k] !== undefined ? s[k] : DEFAULT_SETTINGS[k];
    return out;
  }
  function setSettings(st, s) { var cur = getSettings(st); for (var k in s) if (k in DEFAULT_SETTINGS) cur[k] = s[k]; write(st, KEYS.settings, JSON.stringify(cur)); return cur; }

  // Fill v2 fields on one item without touching its text, dates or id.
  function upgradeItem(x) {
    if (!x || typeof x !== "object") return null;
    var changed = false;
    for (var k in ITEM_DEFAULTS) if (x[k] === undefined || x[k] === null) { x[k] = ITEM_DEFAULTS[k]; changed = true; }
    if (!x.lang || OUT_LANGS.indexOf(x.lang) < 0) { if (!x.lang) { x.lang = "ar"; changed = true; } }
    if (!x.id) { x.id = newId(); changed = true; }
    if (!x.created) { x.created = x.updated || Date.now(); changed = true; }
    if (!x.updated) { x.updated = x.created; changed = true; }
    return changed;
  }

  // Idempotent migration; never removes data. Returns a small report.
  function migrate(st) {
    var report = { from: Number(read(st, KEYS.schema, "1")) || 1, to: SCHEMA, items: 0, upgraded: 0, corrupt: false };
    var h = readJSON(st, KEYS.history, []);
    if (h && h.__corrupt) { report.corrupt = true; return report; } // leave unreadable data untouched
    if (!Array.isArray(h)) { report.corrupt = true; return report; }
    h.forEach(function (x) { if (upgradeItem(x)) report.upgraded++; });
    report.items = h.length;
    if (report.upgraded) write(st, KEYS.history, JSON.stringify(h));
    if (read(st, KEYS.settings, null) === null) write(st, KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    write(st, KEYS.schema, String(SCHEMA));
    return report;
  }

  function loadHistory(st) { var h = readJSON(st, KEYS.history, []); return Array.isArray(h) ? h : []; }
  function saveHistory(st, h) { return write(st, KEYS.history, JSON.stringify(h.slice(0, 1000))); }

  function exportPayload(items) {
    return { app: "SuperPrompt", version: SCHEMA, exported: new Date().toISOString(), items: items };
  }
  // Accepts the v2 export ({app, version: 2, items}), the v1 export ({app, version: 1, history}) or a bare array.
  function parseImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { error: "badjson", items: [], skipped: 0 }; }
    var list = Array.isArray(data) ? data : data && (Array.isArray(data.items) ? data.items : Array.isArray(data.history) ? data.history : null);
    if (!list) return { error: "badfile", items: [], skipped: 0 };
    var items = [], skipped = 0;
    list.forEach(function (x) {
      if (!x || typeof x.goal !== "string" || typeof x.result !== "string") { skipped++; return; }
      var y = {}; for (var k in x) y[k] = x[k];
      upgradeItem(y);
      items.push(y);
    });
    return { error: null, items: items, skipped: skipped };
  }
  function mergeImported(existing, incoming) {
    var ids = {}, added = 0;
    existing.forEach(function (x) { ids[x.id] = 1; });
    incoming.forEach(function (x) {
      if (ids[x.id]) {
        var same = existing.some(function (e) { return e.id === x.id && e.result === x.result && e.goal === x.goal; });
        if (same) return;          // exact duplicate: skip
        x.id = newId();            // same id, different content: keep both
      }
      existing.push(x); ids[x.id] = 1; added++;
    });
    existing.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    return added;
  }

  root.MPZStore = {
    KEYS: KEYS, SCHEMA: SCHEMA, DEFAULT_SETTINGS: DEFAULT_SETTINGS, ITEM_DEFAULTS: ITEM_DEFAULTS,
    read: read, write: write, readJSON: readJSON, newId: newId,
    getSettings: getSettings, setSettings: setSettings, migrate: migrate, upgradeItem: upgradeItem,
    loadHistory: loadHistory, saveHistory: saveHistory, exportPayload: exportPayload, parseImport: parseImport, mergeImported: mergeImported
  };
})(typeof window !== "undefined" ? window : this);
