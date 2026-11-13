/* SuperPrompt v2 — public generator API (offline).
   Load order: prompt-lexicon.js, prompt-engine.js, generator.js. No DOM access. */
(function (root) {
  "use strict";
  var E = root.MPZEngine;
  if (!E) throw new Error("SuperPrompt: prompt-engine.js must be loaded before generator.js");

  function generate(opts) { return E.generate(opts || {}); }

  // v1 compatibility: build(goal, lang) -> { text, domain, lang }
  function build(goal, lang) {
    var r = E.generate({ goal: goal, mode: "auto", level: "balanced", outLang: lang || "ar", target: "agent", format: "sections" });
    return { text: r.text, domain: r.domain, lang: lang || "ar", mode: r.mode };
  }

  root.MPZGen = {
    generate: generate,
    build: build,
    detectDomain: E.detectDomain,
    LANGS: E.LANGS,
    NATIVE: E.NATIVE,
    MODES: E.MODES,
    MODE_LABEL: E.MODE_LABEL,
    isRTL: function (l) { return l === "ar"; },
    version: 2
  };
})(typeof window !== "undefined" ? window : this);
