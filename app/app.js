/* SuperPrompt v2: shared behaviour for every page. No network requests. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var I18N = window.MPZ_I18N || { en: {}, ar: {} };
  var S = window.MPZStore;
  var K = S.KEYS;
  var LS = (function () { try { var t = "__mpz"; localStorage.setItem(t, "1"); localStorage.removeItem(t); return localStorage; } catch (e) { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; } })();

  function get(k, fb) { return S.read(LS, k, fb); }
  function set(k, v) { S.write(LS, k, v); }
  function del(k) { try { LS.removeItem(k); } catch (e) { } }
  function getJSON(k, fb) { var v = S.readJSON(LS, k, fb); return v && v.__corrupt ? fb : v; }
  function setJSON(k, v) { set(k, JSON.stringify(v)); }

  function uiLang() { return doc.getAttribute("lang") === "ar" ? "ar" : "en"; }
  function tr(key, vars) {
    var s = (I18N[uiLang()] && I18N[uiLang()][key]) || (I18N.en && I18N.en[key]) || key;
    if (vars) for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------- file:// support: folder links need index.html ---------- */
  function fixFileLinks() {
    if (location.protocol !== "file:") return;
    $all("a[href]").forEach(function (a) {
      var h = a.getAttribute("href");
      if (!h || /^(https?:|mailto:|#|javascript:|data:)/i.test(h) || /index\.html/.test(h)) return;
      var parts = h.split("#"), path = parts[0];
      if (path === "") return;
      if (path === "." || path === "./") path = "./index.html";
      else if (/\/$/.test(path)) path = path + "index.html";
      a.setAttribute("href", path + (parts[1] ? "#" + parts[1] : ""));
    });
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    var list = $("#toaster");
    if (!list) { list = el("ol", "toaster"); list.id = "toaster"; list.setAttribute("aria-live", "polite"); document.body.appendChild(list); }
    while (list.children.length > 2) list.removeChild(list.firstChild);
    var li = el("li", "toast"); li.setAttribute("role", "status");
    li.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span></span>';
    li.querySelector("span").textContent = msg;
    list.appendChild(li);
    setTimeout(function () { li.classList.add("hide"); setTimeout(function () { if (li.parentNode) li.parentNode.removeChild(li); }, 250); }, 3400);
  }

  /* ---------- clipboard ---------- */
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      function fallback() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
          document.body.appendChild(ta); ta.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(ta);
          ok ? resolve() : reject();
        } catch (e) { reject(e); }
      }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(resolve, fallback);
      else fallback();
    });
  }
  function flashCopied(btn) {
    btn.classList.add("copied");
    var label = btn.querySelector("[data-copy-label]");
    if (label) label.textContent = tr("copied");
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.classList.remove("copied"); if (label) label.textContent = tr(label.getAttribute("data-copy-label") || "copy"); }, 2000);
  }

  /* ---------- interface language ---------- */
  function applyLang(lang) {
    var dict = I18N[lang] || {};
    doc.setAttribute("lang", lang);
    doc.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    $all("[data-i18n]").forEach(function (e) { var v = dict[e.getAttribute("data-i18n")]; if (v != null) e.textContent = v; });
    $all("[data-i18n-attr]").forEach(function (e) {
      e.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"); if (p.length !== 2) return;
        var v = dict[p[1].trim()]; if (v != null) e.setAttribute(p[0].trim(), v);
      });
    });
    var tk = doc.getAttribute("data-title-key");
    if (tk && dict[tk]) document.title = dict[tk];
    document.dispatchEvent(new CustomEvent("mpz:lang", { detail: lang }));
  }

  /* ---------- theme ---------- */
  function toggleTheme() {
    var next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
    doc.setAttribute("data-theme", next);
    set(K.theme, next);
  }

  /* ---------- menu ---------- */
  function initMenu() {
    var btn = $(".menu-btn"), panel = $("#menu-panel");
    if (!btn || !panel) return;
    function open(v) {
      btn.setAttribute("aria-expanded", v ? "true" : "false");
      btn.setAttribute("aria-label", v ? (uiLang() === "ar" ? "إغلاق القائمة" : "Close menu") : tr("aria.menu"));
      panel.classList.toggle("open", v);
    }
    btn.addEventListener("click", function () { open(btn.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("click", function (e) { if (panel.classList.contains("open") && !panel.contains(e.target) && !btn.contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) { open(false); btn.focus(); } });
  }

  /* ---------- hosted site only: "Use in Browser" / "Download for Windows" ---------- */
  function initGetBar() {
    var bar = document.getElementById("get-bar");
    if (!bar) return;
    var h = location.hostname, local = location.protocol === "file:" || h === "127.0.0.1" || h === "localhost" || h === "[::1]" || /\.localhost$/.test(h);
    bar.hidden = true;
    if (local || !window.fetch) return;   // the local copy and the Windows app never offer a download of themselves
    // release.json sits next to the site root; it exists only on the hosted site
    var root = ($("#home-link") && $("#home-link").getAttribute("href")) || "./";
    fetch(root + "release.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rel) {
      if (!rel || !rel.url || !rel.version) return;
      var a = document.getElementById("get-win"), m = document.getElementById("get-meta");
      a.setAttribute("href", root + rel.url);
      m.textContent = "v" + rel.version + " · " + rel.size_label + " · " + rel.type;
      a.setAttribute("title", rel.file + " · SHA-256 " + rel.sha256);
      var notes = document.getElementById("get-notes");
      if (notes && rel.notes_url) notes.setAttribute("href", rel.notes_url);
      bar.hidden = false;
    }).catch(function () { bar.hidden = true; });
  }

  /* ---------- generic actions ---------- */
  function initActions() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var a = t.getAttribute("data-action");
      if (a === "theme") toggleTheme();
      else if (a === "focus-goal") {
        e.preventDefault();
        var gl = document.getElementById("goal");
        if (gl) { gl.scrollIntoView({ behavior: "smooth", block: "center" }); gl.focus({ preventScroll: true }); }
      }
      else if (a === "lang") {
        e.preventDefault();
        var next = uiLang() === "ar" ? "en" : "ar";
        set(K.ui, next); applyLang(next);
      } else if (a === "copy-from") {
        var src = document.getElementById(t.getAttribute("data-target"));
        if (!src) return;
        copyText(src.tagName === "TEXTAREA" ? src.value : src.textContent).then(function () { flashCopied(t); }, function () { toast(tr("toast.copyfail")); });
      } else if (a === "load-goal") {
        e.preventDefault();
        var s = document.getElementById(t.getAttribute("data-target"));
        if (!s) return;
        setJSON(K.pending, { goal: s.textContent.trim() });
        location.href = t.getAttribute("href");
      } else if (a === "load-example") {
        e.preventDefault();
        var g = document.getElementById(t.getAttribute("data-goal")), b = t.getAttribute("data-base") ? document.getElementById(t.getAttribute("data-base")) : null;
        setJSON(K.pending, { goal: g ? g.textContent.trim() : "", base: b ? b.textContent.trim() : "", mode: t.getAttribute("data-mode") || "auto" });
        location.href = t.getAttribute("href");
      } else if (a === "copy-example") {
        var out = document.getElementById(t.getAttribute("data-out"));
        if (!out) return;
        if (!out.textContent) fillExample(out.closest(".lib-card").querySelector(".lib-fold"));
        copyText(out.textContent).then(function () { flashCopied(t); }, function () { toast(tr("toast.copyfail")); });
      }
    });
  }

  /* ---------- result rendering (per-line direction, no monospace) ---------- */
  // paths/URLs inside running text are isolated as one left-to-right unit so a sentence in the
  // other direction cannot split or reorder them on screen (the copied text is unchanged)
  function appendIsolated(row, part, lits) {
    if (!lits || !lits.length) { row.appendChild(document.createTextNode(part)); return; }
    var esc = lits.map(function (l) { return l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    part.split(new RegExp("(" + esc.join("|") + ")")).forEach(function (seg) {
      if (!seg) return;
      if (lits.indexOf(seg) !== -1) { var b = el("bdi", "rv-path", seg); b.setAttribute("dir", "ltr"); row.appendChild(b); }
      else row.appendChild(document.createTextNode(seg));
    });
  }
  function renderView(view, text, lits) {
    view.innerHTML = "";
    lits = (lits || []).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    String(text || "").split("\n").forEach(function (line) {
      var row;
      if (/^##\s+/.test(line)) { row = el("h4", "rv-h", line.replace(/^##\s+/, "")); }
      else if (/^\s*$/.test(line)) { row = el("div", "rv-gap"); }
      else {
        row = el("p", /^\s*(\d+\.|-)\s/.test(line) ? "rv-li" : "rv-p");
        // show `literals` as code-like chips without changing the copied text
        line.split(/(`[^`]+`)/).forEach(function (part) {
          if (/^`[^`]+`$/.test(part)) { var c = el("code", "rv-code", part.slice(1, -1)); c.setAttribute("dir", "ltr"); row.appendChild(c); }
          else appendIsolated(row, part, lits);
        });
      }
      row.setAttribute("dir", "auto");
      view.appendChild(row);
    });
  }

  /* ---------- home: generator ---------- */
  function initGenerator() {
    var goal = $("#goal"), btn = $("#gen-btn"), result = $("#result"), copyBtn = $("#copy-btn");
    if (!goal || !btn || !window.MPZGen) return;
    var G = window.MPZGen;
    var base = $("#base"), baseFold = $("#base-fold"), errEl = $("#gen-error");
    var selBtn = $("#lang-btn"), list = $("#lang-list"), label = $("#lang-label"), box = $(".result-box"), view = $("#result-view");
    var und = $("#understand"), qcard = $("#qcard"), tabs = $("#rtabs"), actions = $("#result-actions");
    var modeSel = $("#opt-mode"), altsBox = $("#opt-alts");
    var settings = S.getSettings(LS);
    var outLang = get(K.out, "ar"); if (!G.NATIVE[outLang]) outLang = "ar";
    var state = { res: null, texts: [], tab: 0, editing: false, answers: {}, skipQ: false, modeOverride: null };
    function activeMode() { return state.modeOverride || settings.mode; }

    /* options */
    function applySettingsToUI() {
      modeSel.value = settings.mode;
      ["level", "target", "format"].forEach(function (n) { $all('input[name="' + n + '"]').forEach(function (r) { r.checked = r.value === settings[n]; }); });
      altsBox.checked = !!settings.alternatives;
    }
    function saveSettings() { settings = S.setSettings(LS, settings); }
    modeSel.addEventListener("change", function () { settings.mode = modeSel.value; state.modeOverride = null; saveSettings(); if (settings.mode === "improve") baseFold.open = true; });
    ["level", "target", "format"].forEach(function (n) {
      $all('input[name="' + n + '"]').forEach(function (r) { r.addEventListener("change", function () { if (r.checked) { settings[n] = r.value; saveSettings(); } }); });
    });
    altsBox.addEventListener("change", function () { settings.alternatives = altsBox.checked; saveSettings(); });

    function setOut(l, persist) {
      outLang = l;
      label.textContent = G.NATIVE[l]; label.setAttribute("lang", l);
      $all(".option", list).forEach(function (o) { o.setAttribute("aria-selected", o.getAttribute("data-value") === l ? "true" : "false"); });
      if (persist) set(K.out, l);
    }
    function autogrow(t) { t.style.height = "auto"; t.style.height = Math.min(Math.max(t.scrollHeight + 2, t === goal ? 140 : 110), 520) + "px"; }
    $all("textarea.autogrow").forEach(function (t) { t.addEventListener("input", function () { autogrow(t); }); });
    function refreshBtn() { btn.disabled = !goal.value.trim() && !(base && base.value.trim()); if (!btn.disabled) showError(""); }
    function showError(msg) { errEl.textContent = msg; errEl.hidden = !msg; }

    /* result area */
    function currentText() { return result.value; }
    function showResult(text, keepEditing) {
      result.value = text || "";
      // the prompt's own language sets the editor direction, not the interface language
      var pl = (state.res && (state.res.lang || state.res.outLang)) || outLang;
      result.setAttribute("dir", G.isRTL(pl) ? "rtl" : "ltr"); result.setAttribute("lang", pl); view.setAttribute("lang", pl);
      copyBtn.disabled = !text;
      box.classList.toggle("filled", !!text);
      actions.hidden = !text;
      var lits = ((state.res && state.res.givens) || []).filter(function (g) { return /^(path|url|name|version|code)$/.test(g.type) && /[A-Za-z]/.test(g.value); }).map(function (g) { return g.value; });
      if (text && !keepEditing) { renderView(view, text, lits); view.hidden = false; result.hidden = true; state.editing = false; }
      else { view.hidden = true; result.hidden = false; }
      $("#r-edit span").textContent = tr(state.editing ? "r.view" : "r.edit");
    }
    function renderTabs() {
      tabs.innerHTML = "";
      var res = state.res;
      if (!res || !res.alternatives || !res.alternatives.length) { tabs.hidden = true; return; }
      var labels = [tr("r.main")].concat(res.alternatives.map(function (a) { return a.label; }));
      labels.forEach(function (lb, i) {
        var b = el("button", "rtab" + (i === state.tab ? " on" : ""), lb);
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", i === state.tab ? "true" : "false");
        b.addEventListener("click", function () { state.texts[state.tab] = currentText(); state.tab = i; renderTabs(); showResult(state.texts[i]); });
        tabs.appendChild(b);
      });
      tabs.hidden = false;
    }
    function chip(text, cls, ltr) { var c = el("span", "u-chip" + (cls ? " " + cls : ""), text); if (ltr) c.setAttribute("dir", "ltr"); return c; }
    function renderUnderstanding(res) {
      und.innerHTML = "";
      var title = el("p", "u-title", tr("u.title"));
      und.appendChild(title);
      var row = el("div", "u-row");
      var ml = el("label", "u-mode"); ml.appendChild(el("span", "u-k", tr("u.mode")));
      var sel = modeSel.cloneNode(true); sel.removeAttribute("id"); sel.className = "u-select"; sel.value = res.mode;
      sel.setAttribute("aria-label", tr("u.change"));
      // changing the mode here regenerates only this request; the default (Advanced options) stays as it is
      sel.addEventListener("change", function () { state.modeOverride = sel.value === settings.mode ? null : sel.value; generate(); });
      ml.appendChild(sel); row.appendChild(ml);
      row.appendChild(chip(tr("u.domain") + ": " + res.domainLabel, "u-soft"));
      und.appendChild(row);
      function line(k, items, cls, ltr) {
        if (!items || !items.length) return;
        var r = el("div", "u-row"); r.appendChild(el("span", "u-k", tr(k)));
        items.forEach(function (x) { r.appendChild(chip(x, cls, ltr)); });
        und.appendChild(r);
      }
      line("u.kept", res.givens.filter(function (g) { return g.type !== "answer"; }).map(function (g) { return g.value; }), "u-lit", true);
      line("u.protected", res.protected, "u-prot");
      line("u.unknown", res.unknowns, "u-unk");
      if (res.subtasks && res.subtasks.length > 1) line("u.tasks", res.subtasks.map(function (t, i) { return (i + 1) + ". " + t; }), "u-soft");
      und.hidden = false;
    }
    function renderQuestions(res) {
      qcard.innerHTML = "";
      if (!res.questions.length || state.skipQ) { qcard.hidden = true; return; }
      qcard.appendChild(el("p", "q-title", tr("q.title")));
      var picks = {};
      res.questions.forEach(function (q) {
        var wrap = el("div", "q-item");
        wrap.appendChild(el("p", "q-q", q.q));
        var opts = el("div", "q-opts");
        q.options.forEach(function (o) {
          var b = el("button", "q-chip", o); b.type = "button";
          b.addEventListener("click", function () { picks[q.id] = o; $all(".q-chip", opts).forEach(function (x) { x.classList.toggle("on", x === b); }); inp.value = ""; });
          opts.appendChild(b);
        });
        wrap.appendChild(opts);
        var inp = el("input", "field q-free"); inp.type = "text"; inp.placeholder = tr("q.free"); inp.setAttribute("dir", "auto");
        inp.addEventListener("input", function () { if (inp.value.trim()) { picks[q.id] = inp.value.trim(); $all(".q-chip", opts).forEach(function (x) { x.classList.remove("on"); }); } });
        wrap.appendChild(inp);
        qcard.appendChild(wrap);
      });
      var row = el("div", "prompt-actions");
      var apply = el("button", "chip-btn primary", tr("q.apply")); apply.type = "button";
      apply.addEventListener("click", function () { for (var k in picks) state.answers[k] = picks[k]; generate(); });
      var skip = el("button", "chip-btn", tr("q.skip")); skip.type = "button";
      skip.addEventListener("click", function () { state.skipQ = true; qcard.hidden = true; });
      row.appendChild(apply); row.appendChild(skip); qcard.appendChild(row);
      qcard.hidden = false;
    }

    /* history */
    function saveToHistory(text, isNew) {
      var h = S.loadHistory(LS), id = get(K.current, ""), now = Date.now(), res = state.res || {};
      var idx = -1; for (var i = 0; i < h.length; i++) if (h[i].id === id) idx = i;
      if (isNew || idx < 0) {
        var item = { id: S.newId(), goal: goal.value.trim(), base: base.value.trim(), lang: outLang, mode: res.mode || activeMode(), chosenMode: activeMode(),
          level: settings.level, target: settings.target, format: settings.format, domain: res.domain || "", result: text, created: now, updated: now };
        h.unshift(item); set(K.current, item.id);
      } else { h[idx].result = text; h[idx].updated = now; h[idx].edited = true; }
      S.saveHistory(LS, h); updateHistoryCount();
    }

    /* generate */
    function generate() {
      var g = goal.value.trim(), b = base.value.trim();
      if (!g && !b) { showError(tr("err.empty")); goal.focus(); return; }
      showError("");
      btn.disabled = true; btn.classList.add("busy");
      var lab = btn.querySelector("[data-i18n]"); lab.textContent = tr("gen.busy");
      setTimeout(function () {
        var res;
        try {
          res = G.generate({ goal: g, base: b, mode: activeMode(), level: settings.level, outLang: outLang, target: settings.target, format: settings.format, answers: state.answers, alternatives: settings.alternatives });
        } catch (err) {
          btn.classList.remove("busy"); lab.textContent = tr("gen.btn"); refreshBtn();
          showError(String(err && err.message || err)); return;
        }
        state.res = res; state.tab = 0;
        state.texts = [res.text].concat((res.alternatives || []).map(function (a) { return a.text; }));
        renderUnderstanding(res); renderQuestions(res); renderTabs(); showResult(res.text);
        set(K.goal, goal.value); set(K.base, base.value); set(K.result, res.text);
        saveToHistory(res.text, true);
        btn.classList.remove("busy"); lab.textContent = tr("gen.btn"); refreshBtn();
        // one column (phones and tablets): bring the result panel into view
        if (window.matchMedia("(max-width: 1023px)").matches) ($("#result-panel") || box).scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }

    /* restore */
    applySettingsToUI();
    goal.value = get(K.goal, ""); base.value = get(K.base, "");
    if (base.value) baseFold.open = true;
    setOut(outLang, false);
    var last = get(K.result, "");
    if (last) showResult(last);
    var pending = getJSON(K.pending, null);
    if (pending) {
      del(K.pending);
      if (pending.id) {
        var item = S.loadHistory(LS).filter(function (x) { return x.id === pending.id; })[0];
        if (item) {
          goal.value = item.goal || ""; base.value = item.base || ""; baseFold.open = !!item.base;
          setOut(item.lang || outLang, true);
          ["level", "target", "format"].forEach(function (k) { if (item[k]) settings[k] = item[k]; });
          var im = item.chosenMode || "auto";
          state.modeOverride = im !== "auto" && im !== settings.mode ? im : null;   // reopened request keeps its mode, the default does not change
          saveSettings(); applySettingsToUI();
          showResult(item.result); set(K.goal, goal.value); set(K.base, base.value); set(K.result, item.result); set(K.current, item.id);
          toast(tr("toast.loaded"));
        }
      } else {
        goal.value = pending.goal || ""; base.value = pending.base || ""; baseFold.open = !!pending.base;
        state.modeOverride = pending.mode && pending.mode !== "auto" && pending.mode !== settings.mode ? pending.mode : null;   // example mode for this request only
        set(K.goal, goal.value); set(K.base, base.value);
        toast(tr("toast.loaded"));
        setTimeout(function () { goal.focus(); }, 50);
      }
    }
    $all("textarea.autogrow").forEach(autogrow);
    refreshBtn();

    goal.addEventListener("input", function () { set(K.goal, goal.value); state.answers = {}; state.skipQ = false; state.modeOverride = null; refreshBtn(); });
    base.addEventListener("input", function () { set(K.base, base.value); state.modeOverride = null; refreshBtn(); });
    [goal, base].forEach(function (t) { t.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate(); } }); });
    btn.addEventListener("click", generate);
    $("#r-regen").addEventListener("click", generate);
    $("#r-edit").addEventListener("click", function () {
      if (state.editing) { state.editing = false; showResult(currentText()); }
      else { state.editing = true; showResult(currentText(), true); result.focus(); }
    });
    $("#r-save").addEventListener("click", function () {
      var t = currentText(); if (!t) return;
      state.texts[state.tab] = t; set(K.result, t);
      saveToHistory(t, false); toast(tr("toast.savedHist"));
      var sv = $("#r-save span"); sv.textContent = tr("r.saved"); setTimeout(function () { sv.textContent = tr("r.save"); }, 1800);
    });
    var saveT;
    result.addEventListener("input", function () {
      copyBtn.disabled = !result.value;
      clearTimeout(saveT);
      saveT = setTimeout(function () { set(K.result, result.value); state.texts[state.tab] = result.value; }, 300);
    });

    /* custom language list */
    var active = -1, opts = $all(".option", list);
    function openList(v) {
      selBtn.setAttribute("aria-expanded", v ? "true" : "false");
      selBtn.classList.toggle("open", v); list.classList.toggle("open", v);
      selBtn.closest(".step-card").classList.toggle("has-pop", v);
      if (v) { active = G.LANGS.indexOf(outLang); mark(); } else selBtn.removeAttribute("aria-activedescendant");
    }
    opts.forEach(function (o, i) { if (!o.id) o.id = "lang-opt-" + i; });
    function mark() {
      opts.forEach(function (o, i) { o.classList.toggle("active", i === active); });
      // keyboard focus stays on the button; tell assistive tech which option is highlighted
      if (opts[active]) { selBtn.setAttribute("aria-activedescendant", opts[active].id); opts[active].scrollIntoView({ block: "nearest" }); }
      else selBtn.removeAttribute("aria-activedescendant");
    }
    selBtn.addEventListener("click", function () { openList(selBtn.getAttribute("aria-expanded") !== "true"); });
    selBtn.addEventListener("keydown", function (e) {
      var isOpen = selBtn.getAttribute("aria-expanded") === "true";
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!isOpen) { openList(true); return; } active = (active + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; mark(); }
      else if ((e.key === "Enter" || e.key === " ") && isOpen) { e.preventDefault(); setOut(opts[active].getAttribute("data-value"), true); openList(false); }
      else if (e.key === "Escape" && isOpen) openList(false);
    });
    opts.forEach(function (o) { o.addEventListener("click", function () { setOut(o.getAttribute("data-value"), true); openList(false); selBtn.focus(); }); });
    var selWrap = selBtn.closest(".select");
    document.addEventListener("click", function (e) { if (!selWrap.contains(e.target)) openList(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") openList(false); });
    document.addEventListener("mpz:lang", function () {
      if (state.res) { renderUnderstanding(state.res); renderQuestions(state.res); renderTabs(); }
      $("#r-edit span").textContent = tr(state.editing ? "r.view" : "r.edit");
    });
  }

  function updateHistoryCount() {
    var n = S.loadHistory(LS).length;
    $all("[data-history-count]").forEach(function (e) { e.textContent = n ? " (" + n + ")" : ""; });
  }

  /* ---------- library page: preview / copy the generated prompt ---------- */
  function fillExample(fold) {
    if (!fold || !window.MPZGen) return;
    var g = document.getElementById(fold.getAttribute("data-goal")), bId = fold.getAttribute("data-base"), b = bId ? document.getElementById(bId) : null;
    var out = fold.querySelector(".lib-out"), st = S.getSettings(LS);
    var r = window.MPZGen.generate({ goal: g.textContent.trim(), base: b ? b.textContent.trim() : "", mode: fold.getAttribute("data-mode") || "auto", level: st.level, target: st.target, format: st.format, outLang: get(K.out, "ar") });
    out.textContent = r.text;
  }
  function initLibrary() {
    $all(".lib-fold").forEach(function (f) { f.addEventListener("toggle", function () { if (f.open) fillExample(f); }); });
  }

  /* ---------- history page ---------- */
  function initHistoryPage() {
    var listEl = $("#hist-list");
    if (!listEl) return;
    var search = $("#hist-search"), countEl = $("#hist-count"), G = window.MPZGen;
    function fmt(ts) {
      try { return new Date(ts).toLocaleString(uiLang() === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
      catch (e) { return new Date(ts).toISOString().slice(0, 16).replace("T", " "); }
    }
    function icon(id) { var t = document.getElementById("icon-" + id); return t ? t.innerHTML : ""; }
    function modeName(m) { var L = uiLang() === "ar" ? "ar" : "en"; return (G && G.MODE_LABEL && G.MODE_LABEL[L][m]) || m; }
    function render() {
      var q = (search.value || "").toLowerCase().trim();
      var all = S.loadHistory(LS);
      var items = q ? all.filter(function (h) { return ((h.goal || "") + "\n" + (h.base || "") + "\n" + (h.result || "")).toLowerCase().indexOf(q) !== -1; }) : all;
      countEl.textContent = tr("history.count", { n: all.length });
      listEl.innerHTML = "";
      if (!items.length) {
        var empty = el("div", "card hist-empty");
        if (q && all.length) {
          // the history is not empty, only the search found nothing
          empty.appendChild(el("p", "", tr("history.nomatch")));
          var clr = el("button", "btn-dark", tr("history.clearsearch")); clr.type = "button";
          clr.addEventListener("click", function () { search.value = ""; render(); search.focus(); });
          empty.appendChild(clr);
        } else {
          empty.appendChild(el("p", "", tr("history.empty")));
          var go = el("a", "btn-dark", tr("history.go")); go.href = "../"; empty.appendChild(go);
        }
        listEl.appendChild(empty); fixFileLinks(); return;
      }
      items.forEach(function (h) {
        var card = el("article", "card hist-item");
        card.innerHTML =
          "<div class='hist-top'><h2></h2></div><div class='hist-meta'></div>" +
          "<textarea class='field' readonly spellcheck='false'></textarea>" +
          "<div class='prompt-actions'>" +
          "<button type='button' class='chip-btn primary' data-h='open'>" + icon("open") + "<span></span></button>" +
          "<button type='button' class='chip-btn' data-h='copy'><span class='i-copy'>" + icon("copy") + "</span><span class='i-check'>" + icon("check") + "</span><span data-copy-label='copy'></span></button>" +
          "<button type='button' class='chip-btn' data-h='edit'>" + icon("edit") + "<span></span></button>" +
          "<button type='button' class='chip-btn' data-h='more'><span></span></button>" +
          "<button type='button' class='chip-btn danger' data-h='delete'>" + icon("trash") + "<span></span></button></div>";
        var title = (h.goal || h.base || "").trim();
        card.querySelector("h2").textContent = title.length > 160 ? title.slice(0, 160) + "…" : title;
        card.querySelector("h2").setAttribute("dir", "auto");
        var meta = card.querySelector(".hist-meta");
        [modeName(h.mode || "auto"), (G && G.NATIVE[h.lang]) || h.lang, fmt(h.updated || h.created), h.edited ? tr("history.edited") : ""].forEach(function (x) { if (x) meta.appendChild(el("span", "", x)); });
        var ta = card.querySelector("textarea"); ta.value = h.result || ""; ta.setAttribute("dir", h.lang === "ar" ? "rtl" : "auto");
        card.querySelector("[data-h=open] span").textContent = tr("history.open");
        card.querySelector("[data-copy-label]").textContent = tr("copy");
        card.querySelector("[data-h=edit] span").textContent = tr("history.edit");
        card.querySelector("[data-h=more] span").textContent = tr("history.more");
        card.querySelector("[data-h=delete] span").textContent = tr("history.delete");
        card.setAttribute("data-id", h.id);
        listEl.appendChild(card);
      });
    }
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-h]");
      if (!b) return;
      var card = b.closest(".hist-item"), id = card.getAttribute("data-id"), ta = card.querySelector("textarea"), act = b.getAttribute("data-h");
      var h = S.loadHistory(LS), idx = -1;
      for (var i = 0; i < h.length; i++) if (h[i].id === id) idx = i;
      if (idx < 0) return;
      if (act === "open") { setJSON(K.pending, { id: id }); location.href = $("#home-link").getAttribute("href"); }
      else if (act === "copy") copyText(ta.value).then(function () { flashCopied(b); }, function () { toast(tr("toast.copyfail")); });
      else if (act === "more") { var on = !card.classList.contains("expanded"); card.classList.toggle("expanded", on); b.querySelector("span").textContent = tr(on ? "history.less" : "history.more"); }
      else if (act === "edit") {
        if (ta.hasAttribute("readonly")) { ta.removeAttribute("readonly"); card.classList.add("expanded"); ta.focus(); b.querySelector("span").textContent = tr("history.save"); b.classList.add("primary"); }
        else { h[idx].result = ta.value; h[idx].updated = Date.now(); h[idx].edited = true; S.saveHistory(LS, h); if (get(K.current, "") === id) set(K.result, ta.value); toast(tr("toast.saved")); render(); }
      } else if (act === "delete") {
        if (!confirm(tr("history.confirmDel"))) return;
        h.splice(idx, 1); S.saveHistory(LS, h);
        if (get(K.current, "") === id) del(K.current);
        toast(tr("toast.deleted")); render();
      }
    });
    search.addEventListener("input", render);
    $("#hist-clear").addEventListener("click", function () {
      if (!S.loadHistory(LS).length || !confirm(tr("history.confirmClear"))) return;
      S.saveHistory(LS, []); del(K.current); render();
    });
    $("#hist-export").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(S.exportPayload(S.loadHistory(LS)), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "superprompt-history-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    var file = $("#hist-file");
    $("#hist-import").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var r = S.parseImport(String(rd.result || ""));
        if (r.error) { toast(tr(r.error === "badjson" ? "history.badjson" : "history.badfile")); file.value = ""; return; }
        var cur = S.loadHistory(LS), added = S.mergeImported(cur, r.items);
        S.saveHistory(LS, cur); render();
        toast(tr("history.imported", { n: added, s: r.skipped + (r.items.length - added) }));
        file.value = "";
      };
      rd.onerror = function () { toast(tr("history.badjson")); };
      rd.readAsText(f);
    });
    document.addEventListener("mpz:lang", render);
    window.addEventListener("storage", function (e) { if (e.key === K.history) render(); });
    render();
  }

  /* ---------- start ---------- */
  function start() {
    S.migrate(LS);
    var pageLang = doc.getAttribute("data-page-lang") || "en";
    var wanted = get(K.ui, "") || pageLang;
    if (wanted !== pageLang) applyLang(wanted);
    fixFileLinks();
    initMenu();
    initActions();
    initGetBar();
    initGenerator();
    initLibrary();
    initHistoryPage();
    updateHistoryCount();
    document.addEventListener("mpz:lang", function () {
      var b = $(".menu-btn");
      if (b && b.getAttribute("aria-expanded") !== "true") b.setAttribute("aria-label", tr("aria.menu"));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
