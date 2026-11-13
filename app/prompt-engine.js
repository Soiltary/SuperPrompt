/* SuperPrompt v2; offline prompt engine (no DOM, no network).
   analyse(): understands the request (Saudi/Gulf colloquial, MSA, English).
   compose(): writes a structured prompt whose sections depend on mode, level, target and format. */
(function (root) {
  "use strict";
  var X = root.MPZLex;

  var LANGS = ["ar", "en", "es", "fr", "de", "tr", "pt", "ja", "ko", "zh"];
  var NATIVE = { ar: "العربية", en: "English", es: "Español", fr: "Français", de: "Deutsch", tr: "Türkçe", pt: "Português", ja: "日本語", ko: "한국어", zh: "中文" };
  var MODES = ["auto", "quick", "comprehensive", "diagnose", "project", "review", "research", "improve", "learn", "resume", "files"];
  var MODE_LABEL = {
    ar: { auto: "تلقائي", quick: "سريع", comprehensive: "شامل", diagnose: "تشخيص وإصلاح", project: "تطوير مشروع قائم", review: "فحص ومراجعة", research: "بحث ومقارنة", improve: "تحسين برومبت أو تصحيحه", learn: "شرح وتعلّم", resume: "استكمال من آخر نقطة", files: "نقل وترتيب وتنظيف ملفات" },
    en: { auto: "Auto", quick: "Quick", comprehensive: "Comprehensive", diagnose: "Diagnose & fix", project: "Change an existing project", review: "Check & review", research: "Research & compare", improve: "Improve or correct a prompt", learn: "Explain & learn", resume: "Resume from last point", files: "Move, organise, clean files" }
  };

  function trim(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { var k = trim(x).toLowerCase(); if (k && !seen[k]) { seen[k] = 1; out.push(trim(x)); } }); return out; }
  function isArabicText(s) { var a = (String(s).match(/[؀-ۿ]/g) || []).length; return a / Math.max(1, String(s).replace(/\s/g, "").length) > 0.25; }
  function stripLead(s) { return trim(String(s).replace(/^(?:و|ف|بس|بعدين|وبعدين|ثم|then|and|but|also)\s+/i, "").replace(/^و(?=[؀-ۿ])/, "")); }

  /* ---------- request parsing ---------- */
  function negations(raw) {
    var out = [], m;
    [X.NEG_AR, X.NEG_EN].forEach(function (re) {
      re.lastIndex = 0;
      while ((m = re.exec(raw))) {
        var p = stripLead(m[1]);
        if (p.split(/\s+/).length >= 2 && p.length <= 140) out.push(p);
      }
    });
    return uniq(out);
  }
  function removeNegations(norm) { return norm.replace(X.NEG_AR, " ").replace(X.NEG_EN, " "); }
  function protectedItems(raw) {
    var out = [], m;
    [X.PROTECT_AR, X.PROTECT_EN].forEach(function (re) {
      re.lastIndex = 0;
      while ((m = re.exec(raw))) {
        var grp = m[1] || m[2] || m[3] || "";
        grp.split(/\s+(?:ولا|و|او|أو|or|and|nor)\s+|[،,]/i).forEach(function (x) {
          x = stripLead(x).replace(/^(?:شي|شيء|اي شي|any)$/i, "");
          if (x && x.length < 60) out.push(x);
        });
      }
    });
    return uniq(out);
  }
  var VERB_SPLIT = /\s+و(?=(?:ا|أ)?(?:ضف|ضيف|صلح|ختبر|خذ|نقل|رتب|نظف|حذف|كتب|ربط|رفع|نشر|ثبت|شغل|فحص|قس|سو|سوي|عطني|جهز|غير|عدل|حدث|طور|قارن|جرب|تاكد|تأكد)(?:[؀-ۿ]{0,3})(?:\s|$))/;
  var ACTION = /(?:^|\s)(?:و)?(?:ا|أ)?(?:ضف|ضيف|صلح|ختبر|خذ|نقل|رتب|نظف|حذف|كتب|ربط|رفع|نشر|ثبت|شغل|فحص|قس|سو|سوي|عطني|اعطني|جهز|غير|عدل|حدث|طور|قارن|كمل|شيل|امسح|اشرح|راجع|تاكد|دقق|جرب|شغل)|\b(?:add|fix|test|move|clean|write|update|change|set up|deploy|delete|remove|review|check|compare|explain|build|create|make|migrate|rename|organi[sz]e|sort|list|book|send|plan|prepare|buy|call|schedule|order|install|download|copy|back up|print|share|invite)\b/i;
  function subtasks(raw) {
    var parts = String(raw).split(/\n+|[،,؛;]|\.(?=\s|$)|\s+(?:ثم|وبعدين|بعدين|وبعد كذا|and then|then)\s+/i);
    var out = [];
    parts.forEach(function (p) {
      p.split(VERB_SPLIT).forEach(function (q) {
        q = stripLead(q.replace(/^\s*\d+[.)-]\s*/, ""));
        q = trim(q.replace(/\s+(?:و|ف)?(?:ما\s+(?:ابغى|ابغي|ابي|أبي|أبغى|ودي)|لا\s+ت|بدون\s)[\s\S]*$/, "").replace(/\s+(?:but|and)\s+(?:don't|do not|without)\b[\s\S]*$/i, ""));
        q = q.replace(/^(?:ابغى|ابغي|ابي|أبي|أبغى|ودي|ابغاك|ابيك)\s+(?:انك\s+|إنك\s+)?/, "");
        if (!q || q.length < 4) return;
        if (/^(?:لا|ما|بدون|بلا|مو|don't|do not|never|without)\s/i.test(q)) return;
        if (!ACTION.test(X.normAr(q))) return;
        if (/\s(?:قبل|اول|أول|first|beforehand)$/i.test(q)) out.unshift(q); else out.push(q);
      });
    });
    return uniq(out);
  }
  function triedItems(raw) {
    var m = /(?:جربت|جرّبت|سويت|سوّيت|حاولت|already tried|i tried|i've tried|tried)\s+([^.؛;\n]+)/i.exec(raw);
    if (!m) return { items: [], result: "" };
    var seg = m[1], result = "";
    var r = /\s*(?:و\s*)?(?:نفس الشي|نفس الشيء|نفس المشكلة|نفس الخطأ|ما نفع|مانفع|ما زبط|بدون فايدة|ولا فاد|but|and (?:it )?still|still)(.*)$/i.exec(seg);
    if (r) { result = trim(r[0].replace(/^\s*و\s*/, "")); seg = seg.slice(0, r.index); }
    var items = seg.split(/\s+و(?=\S)|\s+و\s+|،|,|\s+and\s+/).map(function (x) { return trim(x.replace(/^(?:سويت|سوّيت|جربت|وسويت|and)\s+/, "")); }).filter(function (x) { return x && x.length < 50; });
    return { items: uniq(items), result: result };
  }
  function whatChanged(raw) {
    var m = /(?:^|\s)بعد\s+(?:ما\s+)?([^،,.؛\n]+?)(?=\s+و(?:ال)?[؀-ۿ]|[،,.؛\n]|$)/.exec(raw) || /\bafter\s+([^,.;\n]+)/i.exec(raw);
    return m ? trim(m[1]) : "";
  }
  function remaining(raw) {
    var m = /(?:كان\s+)?(?:باقي|الباقي|المتبقي|left|remaining)\s*:?\s*([^.؛\n]+)/i.exec(raw);
    return m ? trim(m[1]) : "";
  }
  function stripFillers(s) {
    var t = trim(s);
    for (var i = 0; i < 3; i++) t = t.replace(/^(?:ابغى|ابغي|ابي|أبي|أبغى|ابغاك|ابيك|ودي|ممكن|لو سمحت|من فضلك|تكفى|please|can you|could you|i want(?: you)? to|i need(?: you)? to|i'd like(?: you)? to)\s+/i, "");
    return t;
  }
  function firstToken(normNoNeg) {
    var t = X.tokens(normNoNeg).filter(function (w) { return !/^(ابغى|ابغي|ابي|ابيك|ابغاك|ودي|ممكن|تكفى|لو|سمحت|please|can|could|you|i|want|need|to|me|لي)$/.test(w); });
    return t[0] || "";
  }

  /* ---------- corrections merged into a base request (latest instruction wins) ---------- */
  function splitClauses(text) {
    var out = [];
    String(text).split(/\n+|[،؛;]|\.(?=\s|$)/).forEach(function (c) {
      c.split(/\s+و(?=(?:ا|أ)?(?:حتفظ|ختبر|حذف|خذ|نقل|رتب|شغل|غير|عدل|ثبت)[؀-ۿ]*\s)/).forEach(function (d) { d = trim(d); if (d) out.push(d); });
    });
    return out;
  }
  var STOPW = /^(من|الى|في|على|عن|مع|بس|بعد|قبل|ما|لا|هذا|هذي|ذا|كل|او|ثم|انه|اللي|the|a|an|to|of|and|in|on|for|with|it|from)$/;
  function keyTokens(s) {
    return X.tokens(X.normAr(s)).map(function (t) { return t.replace(/^(?:و|ف)?(?:ب|ل)?(?:ال)/, ""); }).filter(function (t) { return t.length > 2 && !STOPW.test(t); });
  }
  var NEW_ACTION = /(?:^|\s)(?:و|ف)?(?:ا|أ)?(?:حذف|نقل|ثبت|شغل|رفع|نشر|ختبر|ضف|ضيف)|\b(?:delete|remove|move|install|run|publish|deploy|test|add)\b/i;
  var LANG_WORDS = { "انجليزي": "en", "انقليزي": "en", "english": "en", "عربي": "ar", "arabic": "ar", "فرنسي": "fr", "french": "fr" };
  var TONES = [["رسمي", "formal"], ["ودي", "friendly"], ["لطيف", "friendly"], ["مختصر", "short"], ["قصير", "short"], ["احترافي", "professional"],
               ["formal", "formal"], ["friendly", "friendly"], ["casual", "casual"], ["concise", "short"], ["shorter", "short"], ["short", "short"], ["professional", "professional"], ["warmer", "friendly"], ["warm", "friendly"], ["friendlier", "friendly"], ["more formal", "formal"], ["more professional", "professional"], ["more casual", "casual"], ["simpler", "short"]];
  function deliverableAttrs(text) {
    var t = String(text), lang = null, tones = [];
    var lm = /(?:^|\s|و)(?:خل(?:ه|ها|يه|يها)?\s+|اكتب(?:ه|ها)?\s+|يكون\s+|تكون\s+|make it\s+|write it\s+|in\s+)?(?:ب|بال|باللغ[ةه]\s+ال)?(انجليزي|إنجليزي|انقليزي|عربي|فرنسي|english|arabic|french)(?![؀-ۿa-z])/i.exec(t);
    if (lm) { var lw = X.normAr(lm[1]).toLowerCase(); lang = /(انجليزي|انقليزي|english)/.test(lw) ? "en" : /(عربي|arabic)/.test(lw) ? "ar" : /(فرنسي|french)/.test(lw) ? "fr" : null; t = t.replace(lm[0], " "); }
    TONES.forEach(function (pair) {
      var re = new RegExp("(?:^|\\s|و)(?:خل(?:ه|ها|يه|يها)?\\s+|ب?اسلوب\\s+|make it\\s+|be\\s+|more\\s+|a\\s+)?" + pair[0] + "(?:ه|ة|ا)?(?=$|[\\s،,.])", "i");
      var m = re.exec(X.normAr(t)) ? re.exec(t) || re.exec(X.normAr(t)) : null;
      if (m) { if (tones.indexOf(pair[1]) < 0) tones.push(pair[1]); t = t.replace(m[0], " "); }
    });
    t = trim(t.replace(/^(?:و|and|,|،|خليها|خليه|خلها|خله|make it|it)(?=\s|$)\s*/gi, "").replace(/\s+(?:و|and)\s*$/i, ""));
    if (/^(?:و|and|خله|خليه|خلها|make it|it|بس|بعد)?$/i.test(t)) t = "";
    return { lang: lang, tones: tones, rest: t };
  }
  /* Arabic counted nouns: [singular, dual, plural]. Used only when the phrase must be built (the user's own phrase is preferred). */
  var COUNTED = [["صفحة", "صفحتين", "صفحات"], ["شريحة", "شريحتين", "شرائح"], ["كلمة", "كلمتين", "كلمات"], ["يوم", "يومين", "أيام"], ["أسبوع", "أسبوعين", "أسابيع"],
    ["شهر", "شهرين", "أشهر"], ["سنة", "سنتين", "سنوات"], ["ساعة", "ساعتين", "ساعات"], ["دقيقة", "دقيقتين", "دقائق"], ["ثانية", "ثانيتين", "ثوانٍ"], ["ملف", "ملفين", "ملفات"],
    ["صورة", "صورتين", "صور"], ["فقرة", "فقرتين", "فقرات"], ["سؤال", "سؤالين", "أسئلة"], ["نقطة", "نقطتين", "نقاط"], ["وجبة", "وجبتين", "وجبات"], ["سعرة", "سعرتين", "سعرات"],
    ["مرة", "مرتين", "مرات"], ["شخص", "شخصين", "أشخاص"], ["منشور", "منشورين", "منشورات"], ["مقطع", "مقطعين", "مقاطع"], ["فيديو", "فيديوين", "فيديوهات"], ["درس", "درسين", "دروس"],
    ["تمرين", "تمرينين", "تمارين"], ["خطوة", "خطوتين", "خطوات"], ["بند", "بندين", "بنود"], ["سطر", "سطرين", "أسطر"], ["حلقة", "حلقتين", "حلقات"], ["فكرة", "فكرتين", "أفكار"],
    ["مثال", "مثالين", "أمثلة"], ["عنوان", "عنوانين", "عناوين"], ["فصل", "فصلين", "فصول"], ["قسم", "قسمين", "أقسام"], ["ليلة", "ليلتين", "ليالٍ"], ["غرفة", "غرفتين", "غرف"],
    ["لعبة", "لعبتين", "ألعاب"], ["مقال", "مقالين", "مقالات"], ["رسالة", "رسالتين", "رسائل"], ["تغريدة", "تغريدتين", "تغريدات"], ["خيار", "خيارين", "خيارات"], ["ريال", "ريالين", "ريالات"]];
  function nounForms(word) {
    var w = X.normAr(String(word).replace(/^(?:ال|بال|لل)/, ""));
    for (var i = 0; i < COUNTED.length; i++) for (var j = 0; j < 3; j++) if (X.normAr(COUNTED[i][j]) === w) return { s: COUNTED[i][0], d: COUNTED[i][1], p: COUNTED[i][2] };
    var raw = String(word).replace(/^(?:ال|بال|لل)/, "");
    if (/ات$/.test(raw)) { var st = raw.slice(0, -2); return { s: st + "ة", d: st + "تين", p: raw }; }      // sound feminine plural
    if (/[ةه]$/.test(raw) && /[؀-ۿ]/.test(raw)) { var st2 = raw.slice(0, -1); return { s: st2 + "ة", d: st2 + "تين", p: st2 + "ات" }; }
    return null;
  }
  // Arabic number rules: 1 singular + واحد/واحدة, 2 dual, 3 to 10 (and x03 to x10) plural, otherwise singular.
  function countPhrase(n, forms, fallbackWord) {
    n = Number(n);
    if (!forms) return fallbackWord ? "عدد " + (/^ال/.test(fallbackWord) ? fallbackWord : "ال" + fallbackWord) + ": " + n : String(n);
    var k = n % 100;
    if (n === 1) return forms.s + (/ة$/.test(forms.s) ? " واحدة" : " واحد");
    if (n === 2) return forms.d;
    if (k >= 3 && k <= 10) return n + " " + forms.p;
    return n + " " + forms.s;
  }
  function numUnit(text) { var m = /(\d+(?:[.,]\d+)?)\s*([؀-ۿA-Za-z%٪-]+)/.exec(text); return m ? { n: m[1], u: X.normAr(m[2]) } : null; }
  function replaceAll(text, old, neu) {
    if (/^\d+(?:[.,]\d+)?$/.test(old)) return text.replace(new RegExp("(^|[^\\d.,])" + old.replace(/[.]/g, "\\.") + "(?![\\d])", "g"), function (m0, pre) { return pre + neu; });
    return text.split(old).join(neu);
  }
  function applyPair(clauses, oldV, newV) {
    oldV = trim(oldV).replace(/[،,.؟?]$/, ""); newV = trim(newV).replace(/[،,.؟?]$/, "");
    var baseText = clauses.map(function (c) { return c.text; }).join(" | ");
    var numeric = false;
    if (/^\d+(?:[.,]\d+)?$/.test(oldV)) {                      // "5 أيام مو 3": align the unit from the base
      numeric = true;
      var newNum = /(\d+(?:[.,]\d+)?)/.exec(newV);
      var hy = new RegExp("(?:^|[^\\d])" + oldV + "-([A-Za-z]+)").exec(baseText);   // "300-word" keeps its hyphenated form
      var um = new RegExp("(?:^|[^\\d])" + oldV + "\\s+([\\u0600-\\u06FFA-Za-z]+)").exec(baseText);
      if (hy && newNum) { oldV = oldV + "-" + hy[1]; newV = newNum[1] + "-" + hy[1]; }
      else if (um) {
        oldV = oldV + " " + um[1];
        var own = /(\d+(?:[.,]\d+)?)\s+([؀-ۿA-Za-z]{2,})(?!.*\d)/.exec(newV);
        if (own && !/^(?:مو|مب|بدل|not|instead)$/i.test(own[2])) newV = own[1] + " " + own[2];        // "10 شرائح": keep the user's phrase
        else if (newNum) newV = /[؀-ۿ]/.test(um[1]) ? countPhrase(newNum[1], nounForms(um[1]), um[1]) : newNum[1] + " " + um[1];
      } else if (newNum) newV = newNum[1];
    }
    if (baseText.indexOf(oldV) === -1 && !(/^\d/.test(oldV) && new RegExp("(^|[^\\d])" + oldV.split(" ")[0] + "(?!\\d)").test(baseText))) return null;
    var ko = oldV.split(/\s+/).length, kn = newV.split(/\s+/);
    if (!numeric && kn.length > ko) newV = kn.slice(kn.length - ko).join(" ");  // "الافتتاح يوم الجمعة" vs "الخميس" -> "الجمعة"
    clauses.forEach(function (c) { c.text = replaceAll(c.text, oldV, newV); });
    return newV;
  }
  function mergeCorrection(base, corr) {
    var clauses = splitClauses(base).map(function (t) { return { text: stripLead(t), mods: [], isNew: false }; });
    var corrText = trim(String(corr).replace(/^(?:تصحيح|تعديل|عدّل تعليمتي|عدل تعليمتي|عدّل|عدل|غيّر|غير|correction|update|edit|change of plan)\s*:\s*/i, ""));
    var corrClauses = corrText ? splitClauses(corrText) : [];
    var confirmed = [], replaced = [], keepTargets = [], changes = [], dLang = null, tones = [];
    corrClauses = corrClauses.map(function (c) {
      c = stripLead(c);
      var m, rest = c, newV = null;
      if ((m = /(?:بدل|بدال|بدلا من|بدلاً من|instead of)\s+(.+?)\s+(?:خلها|خله|خليها|خليه|استخدم|حط|use|make it|put)\s+(.+?)(?=\s+(?:and|but|then)\s|\s+و\S|[،,;]|$)(.*)$/i.exec(c))) {
        newV = applyPair(clauses, m[1], m[2]); if (newV) { replaced.push([m[1], m[2]]); rest = m[3]; }
      } else if ((m = /^(?:خل(?:ه|ها|يه|يها)?\s+|خليه\s+|خليها\s+|يكون\s+|تكون\s+)?(.+?)\s+(?:بدل|بدال|بدلا من|بدلاً من)\s+(.+?)(?=\s+و\S|[،,;]|$)(.*)$/.exec(c))) {
        newV = applyPair(clauses, m[2], m[1]); if (newV) rest = m[3];
      } else if ((m = /\b(?:change|replace|switch)\s+(.+?)\s+(?:to|with|for)\s+(.+?)(?=\s+(?:and|but|then)\s|[,;]|$)(.*)$/i.exec(c))) {
        newV = applyPair(clauses, m[1], m[2]); if (newV) rest = m[3];
      } else if ((m = /^(.+?)\s+instead of\s+(.+?)(?=$|\s+and\s|,)(.*)$/i.exec(c))) {
        newV = applyPair(clauses, m[2], m[1]); if (newV) rest = m[3];
      } else if ((m = /^(?:مو|مب|مش|not)\s+(.+?)\s*[،,]?\s*(?:بل|but|إنما|انما)?\s+(.+)$/i.exec(c))) {
        newV = applyPair(clauses, m[1], m[2]); if (newV) rest = "";
      } else if ((m = /^(.+?)\s+(?:مو|مب|مش|وليس|not)\s+(.+?)(?=$|\s+و\S|،|,)(.*)$/i.exec(c))) {
        newV = applyPair(clauses, m[2], m[1]); if (newV) rest = m[3];
      }
      if (!newV) {                                               // "خلها 11": the only counted value in the base takes the new number
        var lone = /^(?:خل(?:ه|ها|يه|يها)?\s+|خليه\s+|خليها\s+|make it\s+|change it to\s+)?(\d+(?:[.,]\d+)?)\s*$/i.exec(trim(c));
        if (lone) {
          var counted = [];
          clauses.forEach(function (b) { var re = /(\d+(?:[.,]\d+)?)\s+([؀-ۿA-Za-z]{2,})/g, mm; while ((mm = re.exec(b.text))) counted.push(mm); });
          if (counted.length === 1) {
            var cm = counted[0];
            var built = /[؀-ۿ]/.test(cm[2]) ? countPhrase(lone[1], nounForms(cm[2]), cm[2]) : lone[1] + " " + cm[2];
            clauses.forEach(function (b) { b.text = b.text.split(cm[0]).join(built); });
            newV = built; rest = "";
          }
        }
      }
      if (!newV) {                                               // "خلها 5 أيام": same unit as a value in the base
        var nu = numUnit(c);
        if (nu) clauses.forEach(function (b) {
          if (newV) return;
          var bu = new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(" + nu.u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")").exec(X.normAr(b.text));
          if (bu && bu[1] !== nu.n) {
            var ownM = /(\d+(?:[.,]\d+)?)\s*([؀-ۿA-Za-z%٪-]+)/.exec(c);
            var oldFull = new RegExp(bu[1] + "\\s*\\S+").exec(b.text);
            if (oldFull && ownM) { clauses.forEach(function (x) { x.text = x.text.split(oldFull[0]).join(ownM[1] + " " + ownM[2]); }); newV = ownM[1] + " " + ownM[2]; rest = c.replace(ownM[0], ""); }
          }
        });
      }
      if (newV) changes.push(newV);
      var at = deliverableAttrs(rest);
      if (at.lang) dLang = at.lang;
      at.tones.forEach(function (t) { if (tones.indexOf(t) < 0) tones.push(t); });
      return at.rest;
    }).filter(Boolean);
    corrClauses = corrClauses.filter(function (c) {
      if (!/(اعتبرها|اعتبره|اعتبرهم)\s+مؤكد|خلاص\s+اشتغل|اشتغلو?ا?\s+خلاص|confirmed|already works/i.test(c)) return true;
      confirmed.push(trim(c.replace(/(?:،|\s)*(?:اعتبرها|اعتبره|اعتبرهم)\s+مؤكد[ةه]?/, "").replace(/\s*خلاص\s*/g, " ")));
      return false;
    });
    corrClauses.forEach(function (c) {
      var m = /(?:لا\s+تحذف|لا\s+تشيل|ما\s+تحذف|don't delete|do not delete|keep)\s+(\S+)/i.exec(c);
      if (m) keepTargets.push(m[1].replace(/[،,]$/, ""));
    });
    if (keepTargets.length) clauses = clauses.filter(function (b) {
      if (!/(احذف|حذف|امسح|شيل|delete|remove)/i.test(b.text)) return true;
      return !keepTargets.some(function (t) { return b.text.indexOf(t) !== -1; }) && !/(القديم|المصدر|الأصل|الاصل|old|source|original)/i.test(b.text);
    });
    if (corrClauses.some(function (c) { return /(مؤقت|temporar)/i.test(c); }))
      clauses = clauses.filter(function (b) { return !(/(دائم|دايم|always|permanent|forever)/i.test(b.text) && /(احتفظ|خل|keep)/i.test(b.text)); });
    var last = -1;
    corrClauses.forEach(function (c) {
      c = stripLead(c);
      if (!c) return;
      var neg = /^(?:لا|ما|بدون|don't|do not|never)\s/i.test(c);
      var cont = /^(?:خل|خلي|خليه|خله|خلها|اتركه|اتركها|keep it|leave it)/i.test(c);
      var isAction = !neg && !cont && NEW_ACTION.test(X.normAr(c));
      var ct = keyTokens(c), best = -1, bestScore = 0;
      clauses.forEach(function (b, i) {
        if (b.isNew) return;
        var bt = keyTokens(b.text), sc = 0;
        ct.forEach(function (t) { if (bt.indexOf(t) !== -1) sc++; });
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      if (isAction || (best < 0 && !(cont && last >= 0))) { clauses.push({ text: c, mods: [], isNew: true }); last = clauses.length - 1; changes.push(c); }
      else if (cont && last >= 0 && bestScore === 0) clauses[last].mods.push(c);
      else { clauses[best].mods.push(c); last = best; }
    });
    return { clauses: clauses, confirmed: uniq(confirmed), replaced: replaced, keep: keepTargets, changes: uniq(changes), deliverableLang: dLang, tones: tones,
             changed: corrText.length > 0 };
  }

  /* ---------- analysis ---------- */
  var RESEARCH_RX = /\b(?:which|what)\b[^.?!]*\b(?:best|better)\b|\bbest\s+\w+(?:\s+\w+)?\s+(?:for|to|under)\b|\brecommend|\bvs\.?\s|\bversus\b|\bcompare\b|\bpros and cons\b|\bshould i (?:buy|get|choose|pick)\b/i;
  var CONSTRAINT_VERB = /^(?:تحذف|تعدل|تغير|تنشر|ترفع|تلمس|تقرب|تشيل|تنقل|تمسح|تثبت|تسوي|تكرر|تعيد|تستخدم|تحط|تخرب|تنسي|تنسى)/;
  function hasSymptom(norm, normI) {
    var re = /(?:^|\s)(?:و|بس\s+|لكن\s+)?(?:ما|مو|مب|ماعاد|عاد ما)\s+([يت][؀-ۿ]{2,})/g, m;
    while ((m = re.exec(norm))) if (!CONSTRAINT_VERB.test(m[1])) return true;
    if (/(?:^|\s)(?:ما|لا)(?=[يت][؀-ۿ]{3,})/.test(norm) && /(?:^|\s)ما(?:يشتغل|يفتح|يطبع|تطبع|يرضى)/.test(norm)) return true;
    if (/(?:^|\s)لا\s+ي[؀-ۿ]{2,}/.test(norm)) return true;
    return !!X.hasCue(normI, X.CUES.diagnose);
  }
  function classify(c) {
    if (c.hasBase || c.improveCue) return { mode: "improve" };
    var n = c.normI, first = firstToken(n);
    var paths = c.lits.some(function (l) { return l.type === "path" || l.type === "file"; });
    var latin = c.lits.some(function (l) { return l.type === "name" || l.type === "model"; });
    var errId = c.lits.some(function (l) { return l.type === "code" || l.type === "kb"; });
    var quotedMsg = c.lits.some(function (l) { return l.type === "quote"; }) && /\b(?:getting|get|got|shows?|showing|says|saying|message|popup|pop-up|prompt|error|warning)\b/i.test(c.raw);
    var sym = hasSymptom(c.norm, n) || errId || quotedMsg;
    if (/\b(?:continue|keep going|carry on|finish|resume)\b/i.test(c.raw) && /\b\d+\s*(?:of|out of|\/)\s*\d+\b/i.test(c.raw)) return { mode: "resume" };
    var fileObj = !!X.hasCue(n, X.FILE_OBJECTS) || paths || !!X.hasCue(c.norm, X.KNOWN_FOLDERS.map(X.normAr));
    var fileVerb = !!X.hasCue(n, X.CUES.files) || /(?:^|\s)(?:و)?جمع(?=\s|$)/.test(n);
    var existing = !!X.hasCue(n, X.EXISTING) || paths;
    var projCue = !!X.hasCue(n, X.CUES.project);
    var addCue = /(?:^|\s)(?:و|ف|ل)?(?:اضف|ضيف|اضيف|نضيف|ميزه|خاصيه)|\b(?:add|implement|feature)\b/i.test(n);
    var create = !!X.hasCue(n, X.CREATE_VERBS) && !!X.hasCue(n, X.CREATE_OBJECTS);
    if (first && X.hasCue(first, X.CUES.review) && !sym) return { mode: "review" };
    if (X.hasCue(n, X.CUES.resume)) return { mode: "resume" };
    if (fileVerb && (fileObj || (latin && /(?:احذف|حذف|شيل|delete|remove|uninstall)/i.test(n)))) return { mode: "files" };
    if (projCue && (existing || latin) && (!sym || addCue)) return { mode: "project" };
    if (create && !existing) return { mode: "project", newBuild: true };
    if (sym) return { mode: "diagnose" };
    if (X.hasCue(n, X.CUES.research) || RESEARCH_RX.test(c.raw)) return { mode: "research" };
    if (X.hasCue(n, X.CUES.review)) return { mode: "review" };
    if (X.hasCue(n, X.CUES.learn)) return { mode: "learn" };
    if (X.hasCue(n, X.CUES.transform)) return { mode: "quick", transform: /(?:لخص|تلخيص|summar)/i.test(n) ? "summarize" : /(?:ترجم|translat)/i.test(n) ? "translate" : "rewrite" };
    var lists = (n.match(/(?:جدول|قائمه|قايمه|قائمة|list|schedule|checklist|itinerary|timeline|budget|ميزانيه)/gi) || []).length;
    var parts = (c.raw.match(/[،,:]/g) || []).length;
    if (c.subs.length >= 3 || c.norm.length > 260 || (lists >= 2 && parts >= 3)) return { mode: "comprehensive" };
    return { mode: "quick" };
  }
  function detectMode(norm, normI, hasBase, improveCue, subs, raw, lits) {
    return classify({ norm: norm, normI: normI, hasBase: hasBase, improveCue: improveCue, subs: subs, raw: raw || norm, lits: lits || X.extractLiterals(raw || norm) }).mode;
  }
  function detectDomain(norm, mode) {
    for (var i = 0; i < X.DOMAIN_ORDER.length; i++) {
      var d = X.DOMAIN_ORDER[i];
      if (d === "shopping" && mode !== "research") continue;
      if (X.hasCue(norm, X.DOMAINS[d].cues)) return d;
    }
    return "general";
  }
  function fileActions(normI) {
    return {
      del: /(?:^|\s)(?:و|ف)?(?:احذف|حذف|امسح|شيل|نظف|تنظيف)|\b(?:delete|remove|clean|uninstall|declutter)/i.test(normI),
      move: /(?:^|\s)(?:و|ف)?(?:انقل|نقل|جمع)|\bmove\b/i.test(normI),
      organise: /(?:^|\s)(?:و|ف)?(?:رتب|ترتيب|فرز|افرز)|\b(?:organi[sz]e|sort|tidy)\b/i.test(normI)
    };
  }

  function dedupeLits(list) {
    return list.filter(function (g, i) {
      if (g.type === "answer") return true;
      var esc = g.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var inside = new RegExp("(^|[^A-Za-z0-9\\u0600-\\u06FF])" + esc + "($|[^A-Za-z0-9\\u0600-\\u06FF])");
      return !list.some(function (h, j) { return j !== i && h.type !== "answer" && h.value.length > g.value.length && inside.test(h.value); });
    });
  }
  function progressOf(raw) {
    var m = /(\d+)\s*(?:من|of|\/|out of)\s*(\d+)/i.exec(raw);
    if (!m) return null;
    var d = +m[1], t = +m[2];
    return d <= t ? { done: d, total: t, left: t - d } : null;
  }
  function analyse(goal, base, explicitMode, answers) {
    var rawGoal = String(goal || "").trim(), rawBase = String(base || "").trim();
    var improveCue = false;
    var im = /^(?:حسن|حسّن|طور|طوّر|عدل|عدّل|صحح|improve|rewrite|refine|fix)\s+(?:هذا|ذا|this|my)?\s*(?:البرومبت|البرمبت|البرومت|الامر|الأمر|prompt)\s*:?\s*/i.exec(rawGoal);
    if (im) { improveCue = true; if (!rawBase) { rawBase = rawGoal.slice(im[0].length); rawGoal = ""; } else rawGoal = rawGoal.slice(im[0].length); }
    var hasBase = !!rawBase;
    if (explicitMode === "improve" && !hasBase && rawGoal) { rawBase = rawGoal; rawGoal = ""; hasBase = true; }
    var merged = hasBase ? mergeCorrection(rawBase, rawGoal) : null;
    var working = hasBase ? merged.clauses.map(function (c) { return c.text + (c.mods.length ? "، " + c.mods.join("، ") : ""); }).join("، ") : rawGoal;
    var baseOnly = hasBase ? merged.clauses.filter(function (c) { return !c.isNew; }).map(function (c) { return c.text; }).join("، ") : rawGoal;
    var norm = X.normAr(working), normI = removeNegations(norm);
    var subs = subtasks(working);
    var lits = dedupeLits(X.extractLiterals(working));
    var cls = classify({ norm: norm, normI: normI, hasBase: hasBase, improveCue: improveCue, subs: subs, raw: working, lits: lits });
    var mode = explicitMode && explicitMode !== "auto" && MODES.indexOf(explicitMode) > 0 ? explicitMode : cls.mode;
    var inner = mode, innerCls = cls;
    if (mode === "improve") {
      var bn = X.normAr(baseOnly);
      innerCls = classify({ norm: bn, normI: removeNegations(bn), hasBase: false, improveCue: false, subs: subtasks(baseOnly), raw: baseOnly, lits: X.extractLiterals(baseOnly) });
      inner = innerCls.mode;
      if (inner === "quick" && subs.length >= 2 && !innerCls.transform) inner = "comprehensive";
    }
    var domain = detectDomain(norm, inner);
    var hasDeliverable = !!X.hasCue(norm, X.DELIVERABLE);
    var attrs = hasDeliverable && !hasBase ? deliverableAttrs(working) : { lang: null, tones: [] };
    var a = {
      raw: rawGoal, base: rawBase, working: working, norm: norm, normI: normI, mode: mode, inner: inner, domain: domain,
      newBuild: !!innerCls.newBuild && inner === "project", transform: innerCls.transform || null,
      givens: lits, constraints: negations(working), protected: protectedItems(working),
      noDelete: /(?:لا\s+تحذف|ما\s+تحذف|بدون\s+حذف|don't delete|do not delete)/i.test(working) || !!(merged && merged.keep.length),
      readOnly: !!X.hasCue(norm, X.READONLY.map(X.normAr)), noPublish: !!X.hasCue(norm, X.NO_PUBLISH.map(X.normAr)),
      tried: triedItems(rawGoal), changed: whatChanged(working), subtasks: subs, merged: merged, fileActions: fileActions(normI),
      inLang: isArabicText(working) ? "ar" : "en",
      reportLang: /(?:التقرير|ردك|رد علي|جاوبني|جاوب|report|reply|answer)\s+(?:يكون\s+)?(?:بال)?(?:انجليزي|إنجليزي|english)/i.test(rawGoal) ? "en"
                : /(?:التقرير|ردك|رد علي|جاوبني|جاوب|report|reply|answer)\s+(?:يكون\s+)?(?:بال)?(?:عربي|arabic)/i.test(rawGoal) ? "ar"
                : (!hasDeliverable && !hasBase && /(?:بالانجليزي|بالإنجليزي|in english)/i.test(rawGoal)) ? "en" : (!hasDeliverable && !hasBase && /(?:بالعربي|in arabic)/i.test(rawGoal)) ? "ar" : null,
      deliverableLang: merged && merged.deliverableLang || attrs.lang, tones: merged ? merged.tones : attrs.tones,
      progress: progressOf(working), install: !!X.hasCue(normI, X.INSTALL),
      contrast: /(?:\sبس\s|لكن|\bbut\b|\bwhile\b|\bwhereas\b|\bonly\b)/i.test(working) && /(عادي|تمام|سريع|يشتغل|تطبع|يطبع|works|fine|normally|is ok|okay)/i.test(working),
      remaining: remaining(rawGoal), answers: answers || {}, tokens: X.tokens(normI).length
    };
    a.risky = a.inner === "files" || /(?:احذف|حذف|امسح|delete|remove)/i.test(normI) || a.install;
    a.technical = /^(diagnose|project|files|resume)$/.test(inner) || (/^(winupdate|driver|web|code|files|games|data|printer|network|audio|browser)$/.test(domain) && /^(review|comprehensive)$/.test(inner));
    planQuestions(a);
    return a;
  }

  /* ---------- questions (0; 2, only when a missing fact changes execution) ---------- */
  function planQuestions(a) {
    var qs = [], un = [], as = [], ans = a.answers || {};
    function q(id, ar, en, optsAr, optsEn, assumeAr, assumeEn, unknownAr, unknownEn) {
      if (ans[id]) { a.givens.push({ type: "answer", value: String(ans[id]) }); a.answered = (a.answered || []).concat([{ ar: unknownAr + ": " + ans[id], en: unknownEn + ": " + ans[id] }]); return; }
      qs.push({ id: id, q: { ar: ar, en: en }, options: { ar: optsAr, en: optsEn } });
      as.push({ ar: assumeAr, en: assumeEn });
      un.push({ ar: unknownAr, en: unknownEn });
    }
    var n = a.normI, lit = a.givens.length;
    if (a.domain === "meal") {
      if (!/\d{3,4}/.test(a.working) && !/(تنشيف|تخسيس|نزول|زياده|تضخيم|عضل|lose|gain|bulk|cut|maintain)/i.test(n))
        q("meal_target", "كم سعراتك اليومية أو وش هدفك؟", "What daily calories or goal?", ["نزول وزن", "محافظة على الوزن", "زيادة عضل", "أحدد رقم"], ["Lose weight", "Maintain", "Build muscle", "I'll give a number"],
          "الهدف المحافظة على الوزن بحوالي 2000 سعرة يوميًا", "goal is weight maintenance at about 2,000 kcal per day", "السعرات اليومية والهدف", "daily calories and goal");
      if (!a.constraints.length && !/(حساسي|نباتي|بدون|allerg|vegan|vegetarian|no )/i.test(n))
        q("meal_limits", "فيه أكل ما تحبه أو عندك حساسية منه؟", "Any foods you avoid or are allergic to?", ["لا يوجد", "بدون ألبان", "بدون مكسرات", "نباتي"], ["None", "No dairy", "No nuts", "Vegetarian"],
          "لا توجد حساسية ولا أطعمة ممنوعة", "no allergies or excluded foods", "الأطعمة الممنوعة أو المسببة للحساسية", "foods to avoid or allergies");
    } else if (a.mode === "diagnose" && !lit && a.tokens <= 8 && !a.tried.items.length) {
      q("diag_error", "وش اللي يصير بالضبط؟ (نص رسالة الخطأ إن وجدت)", "What exactly happens? (the error text if any)", ["ينقفل بدون رسالة", "تطلع رسالة خطأ", "يعلق ولا يستجيب"], ["Closes with no message", "Shows an error", "Freezes"],
        "البرنامج ينقفل بدون رسالة واضحة", "the program closes without a clear message", "نص رسالة الخطأ أو الوصف الدقيق", "the exact error text or behaviour");
      q("diag_what", "أي برنامج، ووش اللي تحدّث بالضبط؟", "Which program, and what exactly was updated?", ["البرنامج نفسه", "ويندوز", "تعريف كرت الشاشة"], ["The program itself", "Windows", "A driver"],
        "المشكلة بدأت بعد آخر تحديث للبرنامج نفسه", "it started after the program's own latest update", "اسم البرنامج وإصداره وما الذي تحدّث", "the program, its version and what was updated");
    } else if (a.mode === "learn" && a.tokens <= 4 && !/(مبتدئ|مبتدي|beginner|متقدم|advanced)/i.test(n)) {
      q("learn_level", "وش مستواك الحالي في الموضوع؟", "What is your current level in this topic?", ["مبتدئ تمامًا", "أعرف الأساسيات", "متوسط"], ["Complete beginner", "I know the basics", "Intermediate"],
        "مبتدئ تمامًا", "a complete beginner", "مستواي الحالي", "my current level");
      q("learn_goal", "وش هدفك من التعلّم؟", "What do you want to be able to do?", ["أساسيات للاستخدام اليومي", "مستوى متقدم مع الوقت", "شيء محدد أكتبه"], ["Everyday basics", "Reach an advanced level over time", "Something specific (I'll type it)"],
        "أتعلم الأساسيات للاستخدام اليومي", "learn the basics for everyday use", "الهدف من التعلّم", "the learning goal");
    } else if (a.transform && !/[«"“`]/.test(a.working) && a.working.length < 90) {
      q("paste_text", "وين النص اللي تبغاه؟", "Where is the text?", ["بلصقه داخل البرومبت", "ملف على جهازي", "رابط"], ["I'll paste it into the prompt", "A file on my PC", "A link"],
        "سألصق النص مكان [الصق النص هنا]", "I will paste the text where it says [paste the text here]", "النص نفسه", "the text itself");
      if (a.transform === "summarize") q("sum_len", "كم طول الملخص؟", "How long should the summary be?", ["5 نقاط", "فقرة واحدة", "صفحة"], ["5 bullet points", "One paragraph", "One page"],
        "خمس نقاط وسطر خلاصة", "five bullet points and a one-line takeaway", "طول الملخص", "the summary length");
    } else if (a.mode === "files" && !lit && a.subtasks.length < 2 && !a.install && !X.hasCue(a.norm, X.KNOWN_FOLDERS.map(X.normAr)) && !a.protected.length) {
      q("files_where", "وين الملفات الحين، ووين تبيها تروح؟", "Where are the files now, and where should they go?", ["سطح المكتب والتنزيلات", "قرص D", "أحدد المسار"], ["Desktop and Downloads", "Drive D", "I'll give the path"],
        "المصدر سطح المكتب والتنزيلات والوجهة مجلد واحد أؤكده بعد الجرد", "source is Desktop and Downloads; destination is one folder I confirm after the inventory", "المصدر والوجهة بالمسار", "exact source and destination paths");
    } else if (a.tokens <= 2 && !lit && a.mode !== "improve") {
      q("vague_goal", "وش النتيجة اللي تبغاها بالضبط؟", "What result do you want exactly?", ["حل مشكلة في جهازي", "كتابة نص", "خطة أو قرار", "شرح موضوع"], ["Fix a problem on my PC", "Write something", "A plan or decision", "Explain a topic"],
        "المطلوب مساعدة عامة تبدأ بسؤالي عن الهدف", "the need is general help that starts by asking me for the goal", "الهدف والنتيجة المطلوبة", "the goal and the expected result");
      q("vague_where", "وين بتستخدم الناتج؟", "Where will you use the result?", ["في محادثة مع مساعد ذكي", "على جهازي مع أدوات", "للنشر أو الإرسال"], ["In a chat with an AI", "On my PC with tools", "To publish or send"],
        "الناتج للاستخدام الشخصي", "the result is for personal use", "مكان استخدام الناتج", "where the result will be used");
    }
    a.questions = qs.slice(0, 2); a.assumptions = as.slice(0, 2); a.unknowns = un.slice(0, 2);
  }

  /* ---------- small helpers ---------- */
  var TICK = { path: 1, command: 1, code: 1, kb: 1, file: 1, url: 1, quote: 1 };
  function lit(l) { return TICK[l.type] ? "`" + l.value + "`" : l.value; }
  function litList(a, sep) { return a.givens.filter(function (g) { return g.type !== "answer"; }).map(lit).join(sep); }
  function tick(text, a) {
    var out = String(text);
    a.givens.forEach(function (g) {
      if (!TICK[g.type] || out.indexOf("`" + g.value + "`") !== -1) return;
      out = out.split(g.value).join("`" + g.value + "`");
    });
    return out;
  }
  function section(h, items, type) { return { h: h, items: items.filter(Boolean), type: type || "ul" }; }
  function H(ar, en) { return { ar: ar, en: en }; }

  /* ---------- domain hints (Arabic/English) ---------- */
  var GEN = {
    env: H("إصدار البرنامج والنظام، ووش تغيّر مؤخرًا", "the program and OS version, and what changed recently"),
    logs: H("Event Viewer (Application) وسجلات البرنامج نفسه وملفات crash dump إن وجدت", "Event Viewer (Application), the program's own logs and any crash dumps"),
    use: H("افتح البرنامج بالطريقة اللي أستخدمها عادة وكرّر الخطوة اللي كانت تفشل", "open the program the way I normally do and repeat the step that failed"),
    criteria: H(["الاكتمال", "الدقة", "الوضوح", "قابلية التنفيذ"], ["Completeness", "Accuracy", "Clarity", "Actionability"]),
    compare: H(["الجودة والأداء", "السعر والقيمة", "سهولة الاستخدام", "الدعم والموثوقية"], ["Quality and performance", "Price and value", "Ease of use", "Support and reliability"])
  };
  var DOMAIN_HINTS = {
    winupdate: { env: H("إصدار ويندوز ورقم البناء، والتحديثات المثبتة والفاشلة، وحالة خدمات Windows Update والمساحة الحرة", "Windows edition and build, installed and failed updates, Windows Update service state and free space"), logs: H("سجل CBS وسجل DISM وسجل Windows Update وEvent Viewer", "the CBS log, DISM log, Windows Update log and Event Viewer"), use: H("التحديث يظهر مثبتًا في Windows Update بعد إعادة التشغيل ورقم البناء تغيّر", "the update shows as installed in Windows Update after a restart and the build number changed") },
    driver: { env: H("إصدار التعريف الحالي والسابق، وإصدار ويندوز، ودرجات الحرارة واستهلاك المعالج وكرت الشاشة والذاكرة أثناء المشكلة", "current and previous driver version, Windows build, temperatures and CPU/GPU/RAM usage during the problem"), logs: H("Event Viewer وReliability Monitor وسجلات التعريف", "Event Viewer, Reliability Monitor and driver logs"), use: H("شغّل نفس اللعبة أو الموقف اللي كان يهنق وقارن الأداء قبل وبعد", "run the same game or situation that stuttered and compare performance before and after") },
    printer: { env: H("موديل الطابعة وطريقة توصيلها (شبكة أو USB)، وحالة التعريف وقائمة الانتظار على الجهاز اللي ما يطبع، ومقارنتها بالجهاز اللي يطبع", "printer model and connection (network or USB), driver state and print queue on the device that fails, compared with the device that works"), logs: H("قائمة انتظار الطباعة وEvent Viewer (PrintService) وصفحة حالة الطابعة", "the print queue, Event Viewer (PrintService) and the printer status page"), use: H("اطبع صفحة اختبار من نفس البرنامج ونفس الجهاز اللي كان يفشل", "print a test page from the same app on the same device that failed") },
    network: { env: H("نوع الاتصال ومكان المشكلة (جهاز واحد أو كل الأجهزة)، وإعدادات الشبكة وإصدار تعريف كرت الشبكة، وأوقات الانقطاع", "connection type and scope (one device or all), network settings and adapter driver version, and when it drops"), logs: H("Event Viewer (WLAN-AutoConfig) وسجل الراوتر إن وجد ونتائج ping لفترة", "Event Viewer (WLAN-AutoConfig), the router log if available and a timed ping test"), use: H("راقب الاتصال في نفس الوقت والمكان اللي كان ينقطع فيه", "watch the connection at the same time and place it used to drop") },
    audio: { env: H("جهاز الإخراج الافتراضي وتعريف الصوت وما تغيّر في العتاد", "the default output device, audio driver and what changed in the hardware"), logs: H("إعدادات الصوت وDevice Manager وEvent Viewer", "sound settings, Device Manager and Event Viewer"), use: H("شغّل نفس الصوت من نفس البرنامج والسماعات", "play the same sound from the same app through the same speakers") },
    browser: { env: H("إصدار المتصفح وتسريع العتاد والإضافات وتعريف كرت الشاشة", "browser version, hardware acceleration, extensions and the GPU driver"), logs: H("صفحة chrome://gpu أو ما يقابلها وإحصاءات الفيديو للمطورين", "chrome://gpu (or equivalent) and the video stats for nerds overlay"), use: H("شغّل نفس الفيديو بنفس الدقة وقارن الإطارات المفقودة قبل وبعد", "play the same video at the same resolution and compare dropped frames before and after") },
    games: { use: H("شغّل اللعبة نفسها وتأكد إنها تفتح وتحمّل الحفظ القديم", "launch the game itself and confirm it opens and loads the old save"), env: H("إصدار اللعبة والمشغّل، وإصدار التعريف، ودرجات الحرارة والاستهلاك أثناء اللعب", "game and launcher version, driver version, temperatures and usage while playing") },
    web: { env: H("بنية الصفحة والكود المرتبط بالمشكلة، والمتصفحات والأجهزة اللي تظهر فيها", "the page structure and the code involved, and which browsers and devices show the problem"), logs: H("Console وNetwork في أدوات المطوّر ومحاكاة الجوال", "the browser Console and Network panels and mobile emulation"), use: H("جرّب نفس الخطوة على جوال حقيقي ومتصفحين وعلى الكمبيوتر", "repeat the same action on a real phone, two browsers and the desktop"), criteria: H(["الوظيفة تعمل على الجوال والكمبيوتر", "عدم وجود أخطاء في Console", "الروابط والصفحات سليمة", "الجاهزية للنشر بدون نشر"], ["Works on phone and desktop", "No console errors", "Links and pages are sound", "Ready to publish, without publishing"]) },
    code: { env: H("إصدار البرنامج واللغة والمكتبات، وطريقة التشغيل، وحجم البيانات، وأصغر مثال يعيد المشكلة", "program, language and library versions, how it is run, data size, and the smallest example that reproduces it"), logs: H("رسالة الخطأ كاملة (traceback) وسجلات البرنامج وEvent Viewer", "the full error/traceback, the program's logs and Event Viewer"), use: H("شغّل نفس الأمر على نفس البيانات الحقيقية بالطريقة اللي أستخدمها", "run the same command on the same real data the way I use it"), criteria: H(["الإعدادات والمسارات صحيحة", "الأدوات والإصدارات المطلوبة موجودة", "الصلاحيات والحسابات جاهزة", "خطوات البناء والنشر مجرّبة محليًا"], ["Settings and paths are correct", "Required tools and versions are present", "Permissions and accounts are ready", "Build and deploy steps are tried locally"]) },
    data: { env: H("حجم الملفات وعدد الصفوف، وإصدارات الأدوات، والذاكرة المتاحة", "file sizes and row counts, tool versions and available memory"), logs: H("رسالة الخطأ كاملة وسجلات الأداة", "the full error message and the tool's logs"), use: H("أعد نفس العملية على نفس الملف الحقيقي", "repeat the same operation on the same real file"), criteria: H(["صحة البيانات", "اكتمالها", "اتساق الصيغ"], ["Correctness", "Completeness", "Consistent formats"]) },
    files: { env: H("المسار والحجم والعدد وتاريخ آخر تعديل، والبرامج اللي تستخدم المجلد", "path, size, count and last-modified dates, and which programs use the folder"), use: H("افتح الملفات من مكانها النهائي", "open the files from their final location"), criteria: H(["وش داخل المجلد وحجم كل جزء", "مين يستخدمه (عمليات وبرامج مرتبطة)", "هل حذفه آمن ولماذا"], ["What is inside and the size of each part", "Who uses it (processes and linked programs)", "Whether removing it is safe, and why"]) },
    career: { criteria: H(["مطابقة السيرة للوظيفة المستهدفة", "الإنجازات بالأرقام", "الوضوح والترتيب", "الكلمات المفتاحية لأنظمة الفرز"], ["Fit for the target role", "Achievements with numbers", "Clarity and layout", "Keywords for screening systems"]) },
    knowledge: { criteria: H(["تغطية كل مصدر بأدلة من عينات حقيقية", "جودة المعرفة: الدقة والحداثة وعدم التناقض", "قابلية الرجوع للمصدر"], ["Coverage of each source, shown with real samples", "Knowledge quality: accuracy, recency, no contradictions", "Traceability back to the source"]) },
    shopping: { compare: H(["الأداء للاستخدام المطلوب (المعالج والذاكرة والتخزين)", "الشاشة والبطارية والوزن", "جودة التصنيع والضمان والدعم في بلدي", "السعر الفعلي والتوفر الآن"], ["Performance for the intended use (CPU, RAM, storage)", "Screen, battery and weight", "Build quality, warranty and local support", "Real price and availability now"]) }
  };
  function hint(domain, field, L) {
    var d = DOMAIN_HINTS[domain] || {};
    return (d[field] || GEN[field])[L === "ar" ? "ar" : "en"];
  }

  /* ---------- everyday domains with their own steps ---------- */
  function countOf(a, nounRx) {
    var g = a.givens.filter(function (x) { return /^(number|model)$/.test(x.type) && nounRx.test(x.value); })[0];
    if (g) return g.value;
    var m = new RegExp("(\\d+)\\s*-?\\s*(?:" + nounRx.source + ")", "i").exec(a.working);
    return m ? m[0] : "";
  }
  function everydayDirectives(a, T, task) {
    var d = a.domain;
    if (d === "slides") {
      var n = countOf(a, /(?:شرائح|شريحة|شريحه|slides?|-slide)/i);
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("حدّد الجمهور والهدف من العرض في سطرين: مين يسمع، ووش لازم يفهم أو يسوي بعد العرض.", "State the audience and the goal in two lines: who is listening and what they should understand or do afterwards."),
          T("فكرة وحدة لكل شريحة، بعنوان يقول الفكرة نفسها (مو عنوان عام).", "One idea per slide, with a title that states the idea itself (not a generic label)."),
          T("اكتب مخطط العرض شريحة شريحة: رقم الشريحة، والعنوان، و3 نقاط كحد أقصى، وملاحظات المتحدث (ما أقوله بصوتي في 30 إلى 60 ثانية).", "Write the outline slide by slide: number, title, at most 3 bullets, and speaker notes (what I say out loud in 30 to 60 seconds)."),
          T("اقترح لكل شريحة عنصرًا بصريًا (صورة، أو رسم بياني، أو أيقونة، أو مخطط) بدل النص الكثير.", "Suggest one visual per slide (image, chart, icon or diagram) instead of dense text."),
          T("اختم بشريحة خلاصة فيها الرسالة الرئيسية وخطوة تالية واضحة أو سؤال للنقاش.", "End with a closing slide: the key message and a clear next step or a question for discussion."),
          n ? T("عدد الشرائح: " + n + " بالضبط.", "Number of slides: exactly " + n + ".") : T("عدد الشرائح: من 8 إلى 12 ما لم أحدد غير كذا.", "Number of slides: 8 to 12 unless I say otherwise.")
        ],
        check: T("تأكد إن عدد الشرائح يطابق المطلوب، وإن كل شريحة فيها فكرة وحدة وملاحظات متحدث.", "Check that the slide count matches, and that every slide has one idea and speaker notes."),
        output: T("المخرجات: جدول بالشرائح (الرقم، العنوان، النقاط، ملاحظات المتحدث، العنصر البصري).", "Output: a table of slides (number, title, bullets, speaker notes, visual)."),
        rep: T("وفي النهاية اذكر أي افتراض عن الجمهور أو مدة العرض.", "and at the end list any assumption about the audience or the talk length.")
      };
    }
    if (d === "career" && /(?:مقابله|interview)/i.test(a.normI) && !/(?:سيره|cv|خطاب|cover letter)/i.test(a.normI)) {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("حدّد الوظيفة والمستوى، ووش يدور عليه المقابِل في هذا الدور.", "Identify the role and level, and what the interviewer looks for in it."),
          T("نوّع الأسئلة: سلوكية، وفنية، وعن الدافع والخبرة، بالعدد اللي طلبته.", "Mix the questions: behavioural, technical, and about motivation and experience, in the number I asked for."),
          T("لكل سؤال: ليش ينسأل، ونموذج إجابة قوية بطريقة الموقف ثم المهمة ثم التصرف ثم النتيجة (STAR).", "For each question: why it is asked, and a strong model answer using situation, task, action, result (STAR)."),
          T("اذكر لكل سؤال خطأ شائع في الإجابة وكيف أتجنبه.", "For each question, note a common mistake in answering and how to avoid it.")
        ],
        check: T("تأكد إن عدد الأسئلة يطابق طلبي وإن الإجابات واقعية ومناسبة للوظيفة.", "Check that the number of questions matches my request and the answers are realistic for the role."),
        output: T("المخرجات: الأسئلة مرقّمة، وتحت كل سؤال سببه ونموذج الإجابة.", "Output: numbered questions, each with its reason and model answer."),
        rep: T("وفي النهاية اقترح سؤالين أسألهم أنا للمقابِل.", "and at the end suggest two questions I can ask the interviewer.")
      };
    }
    if (d === "career" && /(?:سيره|سيرتي|cv|resume|خطاب تقديم|خطاب التقديم|cover letter|linkedin|لينكد)/i.test(a.normI)) {
      var letter = /(?:خطاب|cover letter)/i.test(a.normI);
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("حدّد الوظيفة المستهدفة واستخرج من وصفها (إن أعطيتك إياه) أهم المهارات والكلمات المفتاحية.", "Identify the target role and pull the key skills and keywords from its description (if I gave one)."),
          letter ? T("الخطاب أقل من 250 كلمة: افتتاحية تربطني بالوظيفة، ثم إنجازين بالأرقام، ثم طلب مقابلة واضح.", "Keep the letter under 250 words: an opening that ties me to the role, two achievements with numbers, then a clear request for an interview.")
                 : T("رتّب السيرة: الملخص، ثم الخبرات (الأحدث أولًا)، ثم المهارات والتعليم، في صفحة وحدة إن أمكن.", "Order the CV: summary, experience (newest first), then skills and education, on one page if possible."),
          T("اكتب الإنجازات بأفعال قوية وأرقام (كم، وكم نسبة، وخلال كم) بدل وصف المهام.", "Write achievements with strong verbs and numbers (how many, what percentage, in what time) instead of task descriptions."),
          T("لا تخترع خبرة أو شهادة؛ وحط [بين أقواس] أي معلومة ناقصة أعبّيها أنا.", "Do not invent experience or certificates; put [placeholders] for anything I need to fill in."),
          T("استخدم صياغة تناسب أنظمة فرز السير (ATS): عناوين أقسام عادية وبدون جداول معقدة.", "Use wording that suits applicant tracking systems (ATS): plain section headings and no complex tables.")
        ],
        check: T("تأكد إن كل سطر يخدم الوظيفة المستهدفة وإن ما فيه معلومة مخترعة.", "Check that every line serves the target role and nothing is invented."),
        output: letter ? T("المخرجات: الخطاب النهائي جاهز للإرسال، ثم سطر موضوع مقترح.", "Output: the final letter ready to send, then a suggested subject line.") : T("المخرجات: السيرة النهائية بأقسام واضحة جاهزة للنسخ.", "Output: the final CV with clear sections, ready to copy."),
        rep: T("وفي النهاية اذكر الأقواس اللي لازم أعبّيها.", "and at the end list the placeholders I need to fill in.")
      };
    }
    if (d === "social") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("حدّد المنصة والجمهور والهدف من المنشور (تفاعل، أو زيارة، أو إعلان).", "Identify the platform, the audience and the goal of the post (engagement, a visit, or an announcement)."),
          T("أول سطر يشد الانتباه ويقول الفكرة، بعدها فكرة وحدة واضحة.", "Open with a first line that grabs attention and states the point, then one clear idea."),
          T("التزم بطول يناسب المنصة (قصير للمنصات السريعة، وأطول قليلًا في لينكدإن).", "Fit the length to the platform (short for fast feeds, a little longer on LinkedIn)."),
          T("اختم بدعوة واضحة لاتخاذ إجراء، وأضف من 2 إلى 5 وسوم مناسبة.", "End with a clear call to action and 2 to 5 fitting hashtags."),
          T("أعطني 3 نسخ بزوايا مختلفة، بدون مبالغة ولا وعود غير صحيحة.", "Give me 3 versions with different angles, with no exaggeration or false promises.")
        ],
        check: T("تأكد إن كل نسخة ضمن الطول المناسب وإن ما فيها معلومة مخترعة.", "Check that every version fits the length and contains nothing invented."),
        output: T("المخرجات: النسخ الثلاث جاهزة للنشر، كل وحدة مع وسومها.", "Output: the three versions ready to post, each with its hashtags."),
        rep: T("وفي النهاية اقترح أفضل وقت للنشر إن كان يفرق.", "and at the end suggest the best time to post if it matters.")
      };
    }
    if (d === "study") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("ابدأ من موعد الاختبار والوقت المتاح يوميًا؛ وإذا ما ذكرتهما حط [بين أقواس] وافترض ساعتين يوميًا.", "Start from the exam date and the time available each day; if I did not give them, use [placeholders] and assume two hours a day."),
          T("قسّم المنهج لمواضيع ورتّبها حسب الصعوبة والوزن في الاختبار.", "Split the syllabus into topics and order them by difficulty and weight in the exam."),
          T("جدول يومي: المواضيع، والمدة، ونوع المذاكرة (فهم، أو حل مسائل، أو مراجعة).", "A daily table: topics, duration, and type of study (understanding, practice problems, or review)."),
          T("أضف مراجعة متباعدة للمواضيع اللي خلصت، واختبارات قصيرة، ويوم احتياطي قبل الاختبار.", "Add spaced review of finished topics, short practice tests, and a buffer day before the exam."),
          T("اقترح طريقة بسيطة أتابع فيها تقدمي يوميًا.", "Suggest a simple way to track my progress each day.")
        ],
        check: T("تأكد إن مجموع الساعات واقعي وإن كل المواضيع داخلة في الجدول قبل الاختبار.", "Check that the total hours are realistic and every topic fits before the exam."),
        output: T("المخرجات: جدول المذاكرة يوم بيوم، ثم قائمة المواضيع بالأولوية.", "Output: the day-by-day study table, then the topic list by priority."),
        rep: T("وفي النهاية اذكر أي افتراض عن الوقت أو المنهج.", "and at the end list any assumption about time or syllabus.")
      };
    }
    if (d === "travel") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("ثبّت المعطيات: المدة، والتواريخ، وعدد المسافرين وأعمارهم، والميزانية؛ والناقص حطه [بين أقواس].", "Pin down the facts: duration, dates, number and ages of travellers, and budget; put anything missing in [placeholders]."),
          T("قسّم الميزانية: المواصلات، والسكن، والأكل، والأنشطة، مع هامش للطوارئ.", "Split the budget: transport, accommodation, food, activities, and a contingency margin."),
          T("جدول يومي بالأوقات والأماكن والمسافة بينها، بدون زحمة أنشطة في يوم واحد.", "A daily itinerary with times, places and the distance between them, without overloading any day."),
          T("لكل يوم بديل للطقس السيئ أو للتعب، ومراعاة الأطفال أو كبار السن إن وجدوا.", "For each day, a fallback for bad weather or tiredness, and consideration for children or older travellers if any."),
          T("قائمة بالحجوزات المطلوبة وتكلفتها التقريبية، وقائمة أغراض مختصرة.", "A list of bookings needed with approximate costs, and a short packing list.")
        ],
        check: T("تحقّق إن المجموع ضمن الميزانية، واذكر إن الأسعار وأوقات الفتح لازم أتأكد منها قبل الحجز.", "Check that the total fits the budget, and note that prices and opening hours must be confirmed before booking."),
        output: T("المخرجات: الجدول اليومي، ثم جدول الميزانية، ثم الحجوزات، ثم قائمة الأغراض.", "Output: the daily itinerary, then the budget table, then bookings, then the packing list."),
        rep: T("وفي النهاية اذكر أي معلومة ما قدرت تتأكد منها.", "and at the end list anything you could not confirm.")
      };
    }
    if (d === "fitness") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("حدّد المستوى والأدوات المتاحة وعدد الأيام بالأسبوع؛ والناقص افترضه مبتدئ وحطه [بين أقواس].", "Set the level, available equipment and days per week; if missing, assume a beginner and mark it in [placeholders]."),
          T("لكل يوم: إحماء 5 إلى 10 دقائق، ثم التمارين، ثم تهدئة وإطالة.", "Each day: a 5 to 10 minute warm-up, the exercises, then a cool-down and stretching."),
          T("جدول لكل تمرين: الاسم، والمجموعات، والتكرارات أو المدة، والراحة، وطريقة الأداء الصحيحة باختصار.", "A table per exercise: name, sets, reps or duration, rest, and a short note on correct form."),
          T("خطة تدرّج أسبوعية بسيطة (زيادة التكرار أو المدة) وبديل أسهل لكل تمرين صعب.", "A simple weekly progression (more reps or time) and an easier alternative for each hard exercise."),
          T("نبّه: وقف عند أي ألم حاد، وراجع طبيب إذا عندك حالة صحية.", "Safety: stop at any sharp pain, and see a doctor if I have a health condition.")
        ],
        check: T("تأكد إن الخطة تطابق عدد الأيام والأدوات المذكورة وإن فيه أيام راحة.", "Check that the plan matches the stated days and equipment and includes rest days."),
        output: T("المخرجات: جدول الأسبوع، ثم تفاصيل تمارين كل يوم.", "Output: the weekly table, then each day's exercise details."),
        rep: T("وفي النهاية اذكر أي افتراض عن مستواي.", "and at the end list any assumption about my level.")
      };
    }
    if (d === "events") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("ثبّت المعطيات: نوع المناسبة، والتاريخ، وعدد الضيوف، والمكان، والميزانية؛ والناقص حطه [بين أقواس].", "Pin down the facts: type of event, date, guest count, venue and budget; put anything missing in [placeholders]."),
          T("برنامج المناسبة بالأوقات من الاستقبال إلى الختام.", "A timed programme from arrival to the close."),
          T("قائمة التجهيزات (أكل، وديكور، وصوت، وتصوير) مع التكلفة التقريبية والمسؤول.", "A checklist of preparations (food, decoration, sound, photography) with approximate cost and who is responsible."),
          T("جدول زمني للتحضير قبل المناسبة بأسبوعين وبأسبوع وباليوم نفسه.", "A preparation timeline: two weeks before, one week before, and on the day.")
        ],
        check: T("تأكد إن التكلفة ضمن الميزانية وإن كل بند له مسؤول وموعد.", "Check that costs fit the budget and every item has an owner and a date."),
        output: T("المخرجات: البرنامج، ثم قائمة التجهيزات، ثم الجدول الزمني للتحضير.", "Output: the programme, then the preparation checklist, then the timeline."),
        rep: T("وفي النهاية اذكر أي افتراض بنيت عليه.", "and at the end list any assumption you made.")
      };
    }
    if (d === "recipe") {
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: [
          T("المقادير بالكميات (غرام أو أكواب) حسب عدد الأشخاص المذكور.", "Ingredients with quantities (grams or cups) for the number of people I gave."),
          T("خطوات مرقّمة قصيرة مع الوقت والحرارة لكل خطوة.", "Short numbered steps with the time and heat for each."),
          T("وقت التحضير والطبخ الكلي، وأخطاء شائعة وكيف أتجنبها.", "Total preparation and cooking time, plus common mistakes and how to avoid them."),
          T("بدائل للمكونات الصعبة أو اللي ممكن تكون عليها حساسية.", "Substitutes for hard-to-find ingredients or common allergens.")
        ],
        check: T("تأكد إن الكميات تناسب عدد الأشخاص وإن الخطوات بالترتيب الصحيح.", "Check that the quantities fit the number of people and the steps are in the right order."),
        output: T("المخرجات: المقادير، ثم الخطوات، ثم الملاحظات.", "Output: ingredients, then steps, then notes."),
        rep: T("وفي النهاية اذكر أي افتراض بنيت عليه.", "and at the end list any assumption you made.")
      };
    }
    return null;
  }

  /* ---------- directives for quick / comprehensive by domain ---------- */
  function domainDirectives(a, L) {
    var AR = L === "ar";
    function T(ar, en) { return AR ? ar : en; }
    if (a.domain === "meal") {
      var avoid = a.constraints.filter(function (c) { return /(احب|أحب|ابغى|سمك|لحم|حليب|dislike|don't like|no |without)/i.test(c); });
      return {
        outcome: T("جهّز لي خطة وجبات لأسبوع كامل جاهزة للتطبيق، حسب المعطيات التالية.", "Prepare a complete one-week meal plan I can follow right away, based on the details below."),
        extraKnown: avoid.length ? [T("لا أحبه أو أتجنبه: ", "Foods I avoid: ") + avoid.join(T("، ", ", "))] : [],
        steps: [
          T("جدول 7 أيام: فطور وغداء وعشاء ووجبتين خفيفتين، مع السعرات والبروتين لكل وجبة ومجموع كل يوم.", "A 7-day table: breakfast, lunch, dinner and two snacks, with calories and protein per meal and a daily total."),
          T("التزم بالسعرات اليومية المطلوبة بفارق ±5٪، ووزّع البروتين على الوجبات.", "Stay within ±5% of the daily calories and spread protein across meals."),
          T("تجنّب أي طعام عندي حساسية منه أو لا أحبه أو أتجنبه، وحط بديلًا له.", "Avoid any food I am allergic to, dislike or avoid, and give a substitute."),
          T("قائمة مشتريات أسبوعية مجمّعة حسب القسم، مع تقدير التكلفة وكيف تبقى ضمن الميزانية إن ذكرتها.", "A weekly shopping list grouped by aisle, with an estimated cost and how it stays within my budget if I gave one."),
          T("وصفات سريعة (أقل من 30 دقيقة) والكميات بالغرام.", "Quick recipes (under 30 minutes) with quantities in grams.")
        ],
        check: T("تأكد إن مجموع كل يوم ضمن السعرات المطلوبة، وإن ما فيه أي طعام ممنوع، وإن تكلفة القائمة منطقية.", "Check that each day's total is within the calorie target, that no excluded food appears, and that the shopping cost is realistic."),
        output: T("المخرجات: جدول الأسبوع، ثم قائمة المشتريات، ثم الوصفات.", "Output: the weekly table, then the shopping list, then the recipes."),
        rep: T("وفي النهاية اذكر أي افتراض (مثل السعرات أو الوزن) بنيت عليه.", "and at the end list any assumption (such as calories or weight) you used.")
      };
    }
    var LANGNAME = { en: T("الإنجليزية", "English"), ar: T("العربية", "Arabic"), fr: T("الفرنسية", "French") };
    var TONENAME = { formal: T("رسمي", "formal"), friendly: T("ودي", "friendly"), short: T("مختصر", "concise"), professional: T("احترافي", "professional"), casual: T("عفوي", "casual") };
    var keepLits = litList(a, T("، ", ", "));
    var task = a.inLang === (AR ? "ar" : "en") ? stripFillers(a.working).replace(/[.؟?!]+$/, "") + "."
      : T("نفّذ طلبي المكتوب أدناه كما هو", "carry out my request written below as it is") + (keepLits ? T("، مع الحفاظ على: ", ", keeping: ") + keepLits : "") + ".";
    if (a.transform) {
      var tk = a.transform;
      var slot = !/[«"“`]/.test(a.working) && a.working.length < 90;
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        extraKnown: slot ? [T("النص: [الصق النص هنا]", "Text: [paste the text here]")] : [],
        steps: tk === "summarize" ? [
          T("حدّد الفكرة الرئيسية والغرض من النص قبل ما تلخّص.", "Identify the main idea and purpose of the text before summarising."),
          T("الطول: حسب طلبي، وإذا ما حددته فخمس نقاط وسطر خلاصة.", "Length: as I asked; if I did not say, five bullet points and a one-line takeaway."),
          T("احتفظ بالأرقام والأسماء والتواريخ كما هي، ولا تضف معلومة مو موجودة في النص.", "Keep numbers, names and dates exactly, and add nothing that is not in the text."),
          T("إذا فيه جزء غامض أو متناقض، اذكره بدل ما تخمّنه.", "If a part is unclear or contradictory, say so instead of guessing.")
        ] : tk === "translate" ? [
          T("ترجم إلى اللغة اللي ذكرتها، بمعنى دقيق وصياغة طبيعية مو حرفية.", "Translate into the language I named, accurately and naturally, not word for word."),
          T("حافظ على النبرة والتنسيق، والأسماء والأرقام والمصطلحات التقنية كما هي.", "Keep the tone and formatting, and keep names, numbers and technical terms exact."),
          T("إذا فيه كلمة ما لها مقابل واضح، اذكر اختيارك بين قوسين.", "If a word has no clear equivalent, note your choice in brackets.")
        ] : [
          T("حافظ على المعنى وكل المعلومات، وغيّر الصياغة فقط.", "Keep the meaning and every fact; change only the wording."),
          T("النبرة المطلوبة: حسب طلبي (مثلًا احترافية)، بجمل أقصر وأوضح.", "Target tone: as I asked (for example professional), with shorter, clearer sentences."),
          T("بعد النص، اذكر أهم ثلاثة تغييرات سويتها ولماذا.", "After the text, list the three main changes you made and why.")
        ],
        check: T("تأكد إن الناتج ما فيه معلومة مضافة ولا ناقصة مقارنة بالنص الأصلي.", "Check that nothing was added or lost compared with the original text."),
        output: T("المخرجات: الناتج النهائي فقط، جاهز للنسخ.", "Output: the final result only, ready to copy."),
        rep: T("وفي النهاية اذكر أي جزء احتاج قرار منك.", "and at the end note any part that needed a judgement call.")
      };
    }
    var EV = everydayDirectives(a, T, task);
    if (EV) return EV;
    if (/^(writing|career)$/.test(a.domain) || /(?:email|ايميل|رساله|خطاب|letter|منشور|مقال|article|post|سيره|تغريده|caption|تقرير|report)/i.test(a.normI)) {
      var wsteps = [];
      if (a.deliverableLang) wsteps.push(T("اكتب النص نفسه باللغة " + LANGNAME[a.deliverableLang] + "، حتى لو كان كلامي معك بالعربي.", "Write the text itself in " + LANGNAME[a.deliverableLang] + "."));
      if (a.tones && a.tones.length) wsteps.push(T("الأسلوب: ", "Tone: ") + a.tones.map(function (t) { return TONENAME[t] || t; }).join(T(" و", " and ")) + ".");
      return {
        outcome: T("المطلوب: ", "Task: ") + task,
        steps: wsteps.concat([
          T("حدّد الجمهور والغرض قبل الكتابة، والتزم بنبرة مناسبة (مهذبة وواضحة).", "Decide the audience and purpose before writing, and keep a fitting tone (polite and clear)."),
          T("استخدم كل التفاصيل اللي أعطيتك كما هي، وحط [بين أقواس] أي معلومة ناقصة بدل ما تخترعها.", "Use every detail I gave exactly as written, and put [placeholders] for anything missing instead of inventing it."),
          T("خلّ الطلب أو الفكرة الرئيسية واضحة من أول سطرين، مع خطوة تالية محددة (موعد أو رد).", "Make the main request clear in the first two lines, with a specific next step (a date or a reply)."),
          T("الطول مناسب للغرض (الرسائل أقل من 150 كلمة) مع سطر موضوع أو عنوان واضح.", "Keep the length fit for purpose (messages under 150 words) with a clear subject line or title.")
        ]),
        check: T("قبل التسليم تأكد إن ما فيه معلومة مخترعة، وإن كل الأقواس [ ] واضحة، وإن النبرة مناسبة للمستلم.", "Before returning it, check that there are no invented facts, that every [placeholder] is clear, and that the tone fits the recipient."),
        output: T("المخرجات: النص النهائي فقط (مع سطر الموضوع إن وجد)، ثم نسخة بديلة أقصر.", "Output: the final text only (with a subject line if relevant), then one shorter alternative."),
        rep: T("وفي النهاية اذكر الأقواس اللي لازم أعبّيها.", "and at the end list the placeholders I need to fill in.")
      };
    }
    return {
      outcome: T("المطلوب: ", "Task: ") + task,
      steps: [
        T("ابدأ بالنتيجة المطلوبة مباشرة، بدون مقدمات.", "Start directly with the requested result, no preamble."),
        T("استخدم كل التفاصيل اللي أعطيتك كما هي، ولا تخترع الناقص؛ اذكره كافتراض.", "Use every detail I gave exactly as written; do not invent missing facts; state them as assumptions."),
        T("قسّم الناتج لخطوات أو نقاط قصيرة قابلة للتنفيذ.", "Break the result into short, actionable steps or points.")
      ],
      accept: [T("كل مهمة في القائمة منفّذة ونتيجتها مذكورة.", "Every task in the list is done and its result stated."), T("ما فيه معلومة مخترعة، والافتراضات واضحة.", "No invented facts; assumptions are explicit."), T("الناتج قابل للاستخدام مباشرة.", "The result can be used directly.")],
      check: T("قبل التسليم تأكد إن كل جزء من طلبي متغطّى وإن ما فيه افتراض مخفي.", "Before returning it, check that every part of my request is covered and no assumption is hidden."),
      output: T("المخرجات: الناتج النهائي بعناوين قصيرة أو خطوات مرقّمة.", "Output: the final result with short headings or numbered steps."),
      rep: T("وفي النهاية اذكر أي افتراض بنيت عليه.", "and at the end list any assumption you made.")
    };
  }

  /* ---------- Arabic + English composition ---------- */
  function composeFull(a, o) {
    var L = o.outLang, AR = L === "ar", K = AR ? "ar" : "en";
    function T(ar, en) { return AR ? ar : en; }
    var mode = a.inner, short = o.level === "short", detailed = o.level === "detailed";
    var agent = o.target === "agent", chat = o.target === "chat";
    var tech = a.technical;
    var repLang = a.reportLang || (AR || a.inLang === "ar" ? "ar" : "en");
    var repLangTxt = repLang === "ar" ? T("بالعربي", "in Arabic") : T("بالإنجليزي", "in English");
    var req = a.mode === "improve" ? "" : T("طلبي كما كتبته: «" + a.raw + "»", "My request as I wrote it: \"" + a.raw + "\"");
    var givens = litList(a, T("، ", ", "));
    var S = [];
    var join = T("، ", ", ");

    function opening(outcome) {
      var lead = "";
      if (tech && agent) lead = short ? T("نفّذ بنفسك على جهازي ضمن الحدود أدناه وتحقّق من النتيجة. ", "Do this yourself on my computer within the limits below and verify the result. ")
        : T("اشتغل على جهازي ونفّذ بنفسك بالأدوات المتاحة لك ضمن الصلاحيات المذكورة هنا، ثم تحقّق من النتيجة بنفسك. ", "Work on my computer and do this yourself with the tools you have, within the permissions stated here, then verify the result yourself. ");
      else if (tech && chat) lead = T("ما تقدر تشغّل شيء على جهازي، فأعطني خطوات مرقّمة أنفّذها بنفسي مع النتيجة المتوقعة بعد كل خطوة. ", "You can't run anything on my computer, so give me numbered steps to follow, with the expected result after each step. ");
      return lead + outcome;
    }
    function knownBlock(extra) {
      var items = [];
      if (req) items.push(req);
      if (givens) items.push(T("معطى (استخدمه كما هو): ", "Given (use exactly as written): ") + givens + (tech && !short ? T("، هذه معلومات مني؛ تحقّق منها الآن واعتمد الأحدث إذا اختلفت.", "; these come from me; verify them now and use the newest real value if they differ.") : ""));
      (a.answered || []).forEach(function (x) { items.push(T("جوابي: ", "My answer: ") + x[K]); });
      (extra || []).forEach(function (x) { items.push(x); });
      return items.concat(unknownLines());
    }
    function unknownLines() {
      return a.unknowns.map(function (u, i) {
        return T("غير معروف بعد: ", "Not known yet: ") + u[K] + T("، لا تخترعه؛ وحتى أؤكد افترض: ", "; do not invent it; until I confirm, assume: ") + a.assumptions[i][K] + ".";
      });
    }
    function limits(extra) {
      var items = [];
      a.constraints.forEach(function (c) { if (!(a.noPublish && /(ينشر|تنشر|publish)/i.test(c) && extra && extra.some(function (x) { return /(تنشر|publish)/i.test(x); }))) items.push(tick(c, a)); });
      if (a.protected.length) items.push(T("لا تلمس ", "Do not touch ") + a.protected.map(function (p) { return tick(p, a); }).join(T(" ولا ", " or ")) + T(" ولا أي شيء مشترك معها.", ", or anything shared with them."));
      (extra || []).forEach(function (x) { items.push(x); });
      var hasPub = items.some(function (x) { return /(تنشر|ينشر|publish|push)/i.test(x); });
      if (a.noPublish && !hasPub) items.push(T("لا تنشر ولا ترفع (push) أي شيء.", "Do not publish, upload or push anything."));
      return uniq(items);
    }
    function report(extra) {
      var joinWord = /^(?:و|and\s)/i.test(extra || "");
      var t = extra ? T("التقرير " + repLangTxt + "، ابدأ بالنتيجة ثم التفاصيل" + (joinWord ? "، " : ": "), "Report " + repLangTxt + ", result first, then details" + (joinWord ? ", " : ": ")) + extra
                    : T("التقرير " + repLangTxt + "، ابدأ بالنتيجة ثم التفاصيل.", "Report " + repLangTxt + ", result first, then details.");
      if (agent && tech) t += short ? T(" افصل المؤكد عن المستنتج.", " Separate verified from inferred.") : T(" افصل بين ما تحقّقت منه الآن، وما استنتجته، وما تعذّر التحقق منه.", " Separate what you verified now, what you inferred, and what you could not verify.");
      return t;
    }
    function withChat(list) { return chat && tech ? list.concat([T("بعد كل خطوة اذكر النتيجة المتوقعة وكيف أعرف إنها نجحت.", "After each step, state the expected result and how I can tell it worked.")]) : list; }
    function evidenceRules() {
      return section(T("قواعد الدليل", "Evidence rules"), [
        T("صنّف كل نتيجة: مؤكد / مشتبه / تعذّر فحصه.", "Label every finding: confirmed / suspected / could not check."),
        T("تاريخ ملف أو اسم مجلد أو \"الأمر اشتغل\" ليس دليلًا كافيًا وحده.", "A file date, a folder name or \"the command ran\" is not proof on its own."),
        T("اذكر مصدر كل رقم: من فحصك الآن أو من تقرير سابق.", "Say where every number comes from: checked now, or from an earlier report.")
      ]);
    }
    function reportTable() {
      return section(T("جدول التقرير", "Report table"), [T("| البند | الحالة | الدليل | ما بقي |", "| Item | Status | Evidence | Left to do |")], "p");
    }

    if (mode === "quick" || mode === "comprehensive") {
      var D = domainDirectives(a, L);
      S.push(section(T("الهدف", "Goal"), [opening(D.outcome)], "p"));
      S.push(section(T("المعطيات", "What I gave you"), knownBlock(D.extraKnown)));
      if (mode === "comprehensive" && !short) S.push(section(T("الأولويات", "Priorities"), [T("الدقة والوضوح قبل الطول.", "Accuracy and clarity before length."), T("نفّذ المهام بالترتيب المذكور.", "Do the tasks in the order given.")]));
      var steps = (a.subtasks.length >= 2 ? a.subtasks.map(function (s) { return tick(s, a); }) : []).concat(D.steps);
      S.push(section(T("المطلوب", "What to do"), short ? steps.slice(0, 4) : steps, "ol"));
      var lim = limits([]);
      if (lim.length) S.push(section(T("القيود", "Constraints"), lim));
      if (mode === "comprehensive" && !short) S.push(section(T("معايير القبول", "Acceptance criteria"), D.accept || [D.check]));
      else S.push(section(T("التحقق", "Check"), [D.check], "p"));
      if (detailed) S.push(evidenceRules());
      S.push(section(T("المخرجات والتقرير", "Output and report"), [D.output, report(D.rep)], "p"));
      return S;
    }

    if (mode === "diagnose") {
      S.push(section(T("الهدف", "Goal"), [opening(T("أبغى أعرف السبب بدليل وأصلحه بأصغر تغيير ممكن، ثم أتأكد إنه انحل فعلًا عند الاستخدام.", "I want the cause found with evidence and fixed with the smallest possible change, then confirmed at the point of real use."))], "p"));
      var known = [T("المشكلة كما وصفتها: «", "The problem as I described it: \"") + a.raw + T("»", "\"")];
      if (givens) known.push(T("معطى (استخدمه كما هو): ", "Given (use exactly as written): ") + givens);
      known.push(a.changed ? T("ما تغيّر قبل ما تبدأ المشكلة: ", "What changed before it started: ") + tick(a.changed, a) : T("ما تغيّر قبل المشكلة: غير مذكور؛ استخرجه من السجلات وتاريخ التحديثات.", "What changed before it started: not stated; find it from the logs and update history."));
      if (a.tried.items.length) known.push(T("ما سبق تجربته (لا تكرره إلا لسبب واضح): ", "Already tried (do not repeat without a clear reason): ") + a.tried.items.map(function (x) { return tick(x, a); }).join(join) + (a.tried.result ? T("، والنتيجة: ", "; result: ") + a.tried.result : ""));
      else known.push(T("ما سبق تجربته: ما ذكرت شيئًا؛ اسألني إذا كان يفرق.", "Already tried: nothing stated; ask me if it matters."));
      (a.answered || []).forEach(function (x) { known.push(T("جوابي: ", "My answer: ") + x[K]); });
      if (a.contrast) known.push(T("دليل مهم من كلامي: المشكلة تظهر في حالة وما تظهر في حالة ثانية، والفرق بين الحالتين أقوى خيط.", "Strong clue from my description: it fails in one case and works in another; the difference between the two is the best lead."));
      known = known.concat(unknownLines());
      S.push(section(T("ما نعرفه", "What we know"), known));
      var st = [
        T("فحص للقراءة فقط بدون أي تعديل: ", "Read-only checks first, without changing anything: ") + hint(a.domain, "env", L) + T("؛ واقرأ السجلات: ", "; read the logs: ") + hint(a.domain, "logs", L) + ".",
        a.contrast ? T("قارن الحالة اللي تشتغل بالحالة اللي ما تشتغل (الجهاز، والإعدادات، والتعريف، والشبكة)، واكتب كل فرق تلقاه.", "Compare the working case with the failing one (device, settings, driver, network) and list every difference you find.") : "",
        T("رتّب الأسباب المحتملة حسب الدليل اللي لقيته، واكتب دليل كل سبب.", "Rank the likely causes by the evidence you found, with the evidence for each."),
        T("طبّق أصغر إصلاح يطابق الدليل، مع طريقة رجوع واضحة قبل أي تغيير على النظام.", "Apply the smallest fix that matches the evidence, with a clear rollback before any system change."),
        T("أعد الاختبار من نقطة الاستخدام: ", "Retest at the point of real use: ") + hint(a.domain, "use", L) + ".",
        T("إذا ما نجح الإصلاح: اذكر الفحص التالي وما تحتاجه مني بالضبط (صلاحية مدير، قرار، أو تنزيل من المصدر الرسمي).", "If the fix still fails: state the next check and exactly what you need from me (admin rights, a decision, or a download from the official source).")
      ];
      if (detailed) st.splice(2, 0, T("راجع إرشادات الشركة المصنّعة الرسمية لنفس الخطأ قبل ما تختار الإصلاح.", "Check the vendor's official guidance for this exact error before choosing the fix."));
      S.push(section(T("الخطوات", "Steps"), withChat(short ? [st[0], st[1], st[2], st[3]] : st), "ol"));
      if (!short) S.push(section(T("الحدود", "Limits"), limits([T("لا تحذف ولا تعيد تثبيت ولا تغيّر إعدادات النظام العامة بدون موافقتي.", "Do not delete, reinstall or change system-wide settings without my approval."), T("أي تنزيل أو تثبيت: من المصدر الرسمي فقط وبعد موافقتي.", "Any download or install: official source only, and only after I approve.")])));
      if (detailed) { S.push(evidenceRules()); S.push(reportTable()); }
      S.push(section(T("التقرير", "Report"), [report(T("السبب الأرجح ودليله، ووش تغيّر بالضبط، وطريقة الرجوع، ونتيجة إعادة الاختبار.", "the most likely cause and its evidence, exactly what changed, how to roll back, and the retest result."))], "p"));
      return S;
    }

    if (mode === "project" && a.newBuild) {
      S.push(section(T("الهدف", "Goal"), [opening(T("ابنِ لي من الصفر: ", "Build this for me from scratch: ") + tick(stripFillers(a.working), a).replace(/^(?:(?:ابي|ابغى|أبي|أبغى|ودي)\s+)?(?:اسوي|أسوي|سوي|ابني|أبني|اصمم|أصمم|اعمل|أعمل|ابرمج|أبرمج)\s+(?:لي\s+)?/, "").replace(/^(?:build|make|create|develop|code|write)\s+(?:me\s+)?/i, "") + T(". ابدأ بأبسط نسخة تشتغل، ثم كمّل عليها.", ". Start with the simplest version that works, then build on it."))], "p"));
      S.push(section(T("المعطيات", "What I gave you"), knownBlock()));
      S.push(section(T("الخطوات", "Steps"), withChat([
        T("حدّد النطاق: لمن هو، والمزايا الأساسية لأول نسخة، ووش خارج النطاق الحين.", "Define the scope: who it is for, the core features of the first version, and what is out of scope for now."),
        T("اختر التقنية الأنسب واذكر سببك؛ وإذا ذكرت لغة أو أداة فالتزم فيها، وفضّل الأبسط اللي يشتغل على جهازي بدون إعداد معقّد.", "Choose the stack and say why; if I named a language or tool, use it, and prefer the simplest option that runs on my PC without complex setup."),
        T("قسّم الشغل لخطوات صغيرة، وكل خطوة لها نتيجة أقدر أشوفها.", "Split the work into small steps, each with a result I can see."),
        T("ابنِ أصغر نسخة تشتغل أولًا وشغّلها، وبعدها أضف الباقي خطوة خطوة.", "Build the smallest working version first and run it, then add the rest step by step."),
        T("اختبرها من نقطة الاستخدام: طريقة التشغيل الفعلية، والحالات الأساسية، وحالة خطأ واحدة على الأقل.", "Test it at the point of use: the real way it is started, the core cases, and at least one error case.")
      ]), "ol"));
      S.push(section(T("الحدود", "Limits"), limits([T("خلّ كل الملفات داخل مجلد مشروع واحد، ولا تنشر شيئًا.", "Keep every file inside one project folder and publish nothing."), T("أي تثبيت أو تنزيل أو صلاحية مدير: ارجع لي أولًا.", "Any install, download or admin rights: ask me first.")])));
      S.push(section(T("التسليم والتقرير", "Delivery and report"), [T("سلّمني: مكان الملفات، وطريقة التشغيل خطوة بخطوة، ووش اختبرت، ووش الخطوة الجاية المقترحة.", "Deliver: where the files are, how to run it step by step, what you tested, and the suggested next step."), report("")], "p"));
      return S;
    }

    if (mode === "project") {
      S.push(section(T("الهدف", "Goal"), [opening(T("طوّر المشروع الموجود بالتغييرات التالية مع الحفاظ على كل ما يشتغل حاليًا.", "Change the existing project as listed below while keeping everything that works today."))], "p"));
      S.push(section(T("المعطيات", "What I gave you"), knownBlock()));
      var changes = a.subtasks.filter(function (s) { return !/(نسخه احتياطيه|نسخة احتياطية|نقطة رجوع|backup)/i.test(s); }).map(function (s) { return tick(s, a); });
      if (!changes.length) changes = [tick(stripFillers(a.working), a)];
      var ps = [
        T("اقرأ الوضع الحالي أولًا: التوثيق وملف التقدّم وحالة git وأي بناء أو عملية شغّالة، وسجّل الإصدار الحالي.", "Read the current state first: docs, progress file, git status and any running build or process; note the current version."),
        T("خذ نسخة احتياطية (نقطة رجوع) لكل ما بيتغيّر قبل التعديل.", "Take a backup (restore point) of everything that will change before editing."),
        T("اشتغل على المشروع الموجود، لا تبنيه من الصفر.", "Work on the existing project; do not rebuild it from scratch."),
        T("نفّذ التغييرات بالترتيب: ", "Make the changes in this order: ") + changes.join(T(" ← ", " → ")),
        T("حافظ على البيانات والإعدادات والتوافق؛ وإذا تغيّر شكل البيانات، اكتب ترحيلًا واختبره على نسخة من بيانات حقيقية.", "Preserve data, settings and compatibility; if a data format changes, write a migration and test it on a copy of real data."),
        T("اختبر من البداية للنهاية بطريقة التشغيل الفعلية ومن نقطة الاستخدام", "Test end to end with the real launch method, at the point of use") + (a.domain === "web" ? T(" (الجوال والكمبيوتر)", " (phone and desktop)") : "") + "."
      ];
      S.push(section(T("الخطوات", "Steps"), withChat(short ? [ps[0], ps[1], ps[3], ps[5]] : ps), "ol"));
      S.push(section(T("الحدود", "Limits"), limits([T("لا تنشر ولا ترفع (push) شيئًا إلا إذا طلبته صراحة.", "Do not publish or push anything unless I explicitly ask."), T("أي تثبيت أو تنزيل أو صلاحية مدير: ارجع لي أولًا.", "Any install, download or admin rights: ask me first.")])));
      if (detailed) { S.push(evidenceRules()); S.push(reportTable()); }
      S.push(section(T("التسليم والتقرير", "Delivery and report"), [T("سلّمني: مسار المشروع، وطريقة التشغيل، ووش تغيّر، ووش اختبرت وكيف، ووش بقي ولماذا.", "Deliver: the project path, how to run it, what changed, what you tested and how, and what is left and why."), report("")], "p"));
      return S;
    }

    if (mode === "files") {
      var fa = a.fileActions;
      var keepSrc = a.noDelete;
      if (a.subtasks.length >= 2) S.push(section(T("الهدف", "Goal"), [opening(T("نفّذ المهام التالية بالترتيب بدون فقد أي ملف أو حفظ: ", "Do these tasks in order without losing any file or save: ") + a.subtasks.map(function (x) { return tick(x, a); }).join(T("، ثم ", ", then ")) + ".")], "p"));
      else S.push(section(T("الهدف", "Goal"), [opening(fa.move && keepSrc ? T("أبغى نسخة عمل كاملة وموثّقة في الوجهة، والمصدر يبقى كما هو بدون حذف.", "I want a complete, verified working copy at the destination, with the source left as it is.") : fa.move ? T("أبغى الملفات في مكانها النهائي بنسخة واحدة موثّقة، بدون فقد أي شيء.", "I want the files in their final place as one verified copy, with nothing lost.") : fa.del ? T("أبغى أشيل المطلوب فقط وأوفّر المساحة، بدون ما ألمس أي شيء خارج الطلب.", "I want only what I asked for removed and the space freed, without touching anything else.") : T("أبغى الملفات مرتّبة حسب طلبي بدون فقد ولا تغيير غير مطلوب.", "I want the files organised as asked, with nothing lost and nothing changed that I did not ask for."))], "p"));
      S.push(section(T("المعطيات", "What I gave you"), knownBlock(a.subtasks.length >= 2 ? [T("المهام بالترتيب: ", "Tasks in order: ") + a.subtasks.map(function (s) { return tick(s, a); }).join(T(" ← ", " → "))] : [])));
      var fs = [T("جرد للقراءة فقط أولًا: سجّل المسارات الدقيقة لكل عنصر (المصدر والوجهة)، مع الأحجام والأعداد، وقس المساحة الحرة قبل أي تغيير.", "Read-only inventory first: record the exact paths of every item (source and destination), sizes and counts, and measure free space before any change."),
        T("حدّد اللي يخص الطلب فقط؛ وأي عنصر ما تقدر تثبت إنه يخصه، اتركه واذكره في التقرير.", "Select only what belongs to the request; anything you cannot prove belongs to it, leave it and list it.")];
      if (keepSrc && fa.move) fs.push(T("انسخ إلى الوجهة أولًا، ثم تحقّق من الوجهة (العدد والحجم وبصمة hash وإن الملفات تفتح)، ولا تحذف المصدر؛ يبقى كما هو.", "Copy to the destination first, then verify the destination (count, size, hash, files open), and do not delete the source; leave it as it is."));
      else if (keepSrc) fs.push(T("إذا احتاج الترتيب نقل ملفات: انسخ أولًا وتحقّق من الوجهة (العدد والحجم وبصمة hash)، ولا تحذف أي نسخة؛ الحذف خارج هذا الطلب.", "If organising needs files moved: copy first and verify the destination (count, size, hash), and delete nothing; deletion is outside this request."));
      else if (fa.move || !fa.del) fs.push(T("انسخ إلى الوجهة أولًا، ثم تحقّق من الوجهة (العدد والحجم وبصمة hash وإن الملفات تفتح)، وبعدها فقط احذف النسخة الزائدة.", "Copy to the destination first, then verify the destination (count, size, hash, files open), and only then remove the extra copy."));
      if (fa.organise) fs.push(T("جرّب الترتيب على عينة صغيرة أولًا، وتأكد إنه يطابق طلبي قبل ما تطبّقه على الكل.", "Try the organisation on a small sample first and confirm it matches my request before applying it to everything."));
      if (fa.del && !keepSrc) fs.push(T("احذف بالمسار الدقيق لا بأنماط عامة (wildcards). وقبل الحذف تأكد إنه ما فيه بيانات مهمة نسختها الوحيدة هنا (حفظ أو إعدادات)؛ لو فيه، انسخها لمكان واحد وتحقّق من الوجهة. استخدم الحذف القابل للاسترجاع إلا إذا طلبت حذفًا نهائيًا.", "Delete by exact path, never by wildcards. Before deleting, make sure no important data has its only copy here (saves, settings); if it does, copy it to one place and verify the destination. Use recoverable deletion unless I asked for permanent deletion."));
      fs.push(keepSrc && fa.move ? T("النسخة المعتمدة للعمل هي الوجهة وفي مكان واحد، والمصدر يبقى نسخة احتياطية؛ والملفات بنفس الاسم ومحتوى مختلف: احتفظ بالاثنين بأسماء واضحة.", "The working copy is the destination, in one place; the source stays as a backup. Same name with different content: keep both with clear names.")
        : T("النتيجة نسخة واحدة نهائية في مكان واحد؛ والملفات بنفس الاسم ومحتوى مختلف: احتفظ بالاثنين بأسماء واضحة.", "End with one final copy in one place; same name with different content: keep both with clear names."));
      fs.push(T("تجاوز الملفات المفتوحة أو اللي تغيّرت بعد الجرد، ولا تتبع الاختصارات والروابط خارج النطاق، والشغل محلي فقط (لا تلمس السحابة).", "Skip files in use or changed since the inventory, do not follow shortcuts or links out of scope, and stay local only (do not touch cloud copies)."));
      if (a.install) fs.splice(1, 0, T("قبل أي تثبيت أو تحديث: خذ نسخة احتياطية من الحفظ والإعدادات وتأكد إنها تنفتح.", "Before any install or update: back up the saves and settings and check the backup opens."));
      fs.push(T("قس المساحة الحرة بعد التنفيذ وقارنها بقبل.", "Measure free space afterwards and compare with before."));
      if (a.subtasks.length >= 2 || a.install) fs.push(T("تحقّق من نقطة الاستخدام: ", "Verify at the point of use: ") + hint(a.domain, "use", L) + ".");
      S.push(section(T("الخطوات", "Steps"), withChat(short ? fs.slice(0, 3).concat(fs.slice(-1)) : fs), "ol"));
      if (short) S.push(section(T("حدود الصلاحيات", "Permission boundary"), limits([T("الموافقة تغطي فقط ما في طلبي؛ سجّل المسارات الدقيقة، ولا حذف قبل التحقق من الوجهة.", "Approval covers only my request; record exact paths, and no deletion before the destination is verified.")])));
      else S.push(section(T("حدود الصلاحيات", "Permission boundary"), limits([
        T("الموافقة تغطي فقط ما في طلبي أعلاه؛ أي حذف أو نقل خارجه يحتاج موافقتي.", "My approval covers only what is in the request above; any deletion or move beyond it needs my approval."),
        T("سجّل المسارات الدقيقة قبل التنفيذ، ولا حذف قبل التحقق من الوجهة.", "Record exact paths before acting, and no deletion before the destination is verified."),
        a.install ? T("التثبيت أو التحديث: من المصدر الرسمي فقط، وأي صلاحية مدير أو دفع يحتاج موافقتي.", "Install or update only from the official source; any admin rights or payment needs my approval.") : ""
      ].filter(Boolean))));
      if (detailed) { S.push(evidenceRules()); S.push(reportTable()); }
      S.push(section(T("التقرير", "Report"), [report(T("المساحة قبل وبعد والمساحة اللي توفّرت، والأعداد لكل بند، والمسارات النهائية، والعناصر اللي تجاوزتها ولماذا.", "free space before and after and the space freed, counts per item, final paths, and skipped items with the reason."))], "p"));
      return S;
    }

    if (mode === "resume") {
      S.push(section(T("الهدف", "Goal"), [opening(T("كمّل الشغل من آخر نقطة مؤكدة لين يخلص، بدون تكرار ولا فقد.", "Continue the work from the last confirmed point until it is finished, without repeating or losing anything."))], "p"));
      var rk = knownBlock();
      if (a.progress) rk.push(T("التقدّم حسب كلامي: وصل الشغل إلى " + a.progress.done + " من " + a.progress.total + "، والباقي " + a.progress.left + " تقريبًا؛ تحقّق من العدد الفعلي وهل آخر دفعة اكتملت قبل ما تكمل.", "Progress as I reported it: reached " + a.progress.done + " of " + a.progress.total + ", about " + a.progress.left + " left; verify the real count and whether the last batch finished before continuing."));
      if (a.remaining && !a.progress) rk.push(T("الباقي حسب كلامي: ", "What I said is left: ") + tick(a.remaining, a));
      S.push(section(T("المعطيات", "What I gave you"), rk));
      var rs = [
        T("حدّد آخر نقطة مؤكدة من النتائج المحفوظة والسجلات وملف الاستئناف والحالة الحالية؛ أي قائمة مهام قديمة تاريخ وليست دليلًا.", "Find the last confirmed point from saved results, logs, the resume file and the current state; an old checklist is history, not proof."),
        T("قبل ما تبدأ أي شيء، تأكد إنه ما فيه عملية شغّالة من الدفعة السابقة حتى ما تتكرر.", "Before starting anything, check that no process from the previous batch is still running, so nothing runs twice."),
        T("وفّق الدفعات الناقصة: اللي اكتمل اتركه، واللي انقطع في النص أعد فحصه فقط.", "Reconcile partial batches: leave the finished ones and recheck only the one that was cut off."),
        T("لا تعيد شغل خلص؛ أصلح الفجوات المثبتة فقط، وكمّل الباقي بالترتيب.", "Do not redo finished work; fix only proven gaps and continue the rest in order."),
        T("احفظ نقطة استئناف بعد كل دفعة؛ ولو انقطع الشغل مرة ثانية، اكتب آخر دفعة خلصت والدفعة التالية.", "Save a resume point after each batch; if the work stops again, write down the last finished batch and the next one."),
        T("أثبت الاكتمال بدليل (أعداد، أو سجل نهائي، أو اختبار من نقطة الاستخدام).", "Prove completion with evidence (counts, a final log, or a test at the point of use).")
      ];
      S.push(section(T("الخطوات", "Steps"), withChat(short ? [rs[0], rs[1], rs[3], rs[4]] : rs), "ol"));
      var rl = a.readOnly ? [T("الشغل قراءة فقط: لا تحذف ولا تنقل ولا تعدّل أي ملف.", "This work is read-only: do not delete, move or change any file.")] : [];
      S.push(section(T("الحدود", "Limits"), limits(rl.concat([T("أي إجراء جديد غير المذكور يحتاج موافقتي.", "Any new action not listed here needs my approval.")]))));
      if (detailed) S.push(evidenceRules());
      S.push(section(T("التقرير", "Report"), [report(T("وش خلص قبل، ووش خلص الحين، ووش باقي ولماذا.", "what was done before, what is done now, and what is left and why."))], "p"));
      return S;
    }

    if (mode === "review") {
      S.push(section(T("الهدف", "Goal"), [opening(T("أبغى حكمًا مبنيًا على دليل لكل معيار، بدون أي تعديل.", "I want a verdict backed by evidence for each criterion, without changing anything."))], "p"));
      S.push(section(T("النطاق والمعطيات", "Scope and what I gave you"), knownBlock()));
      S.push(section(T("المعايير", "Criteria"), hint(a.domain, "criteria", L).concat([T("أضف أي معيار يلزم قبل ما تبدأ واذكره.", "Add any criterion that is needed before you start, and say so.")])));
      var rv = [
        T("المراجعة قراءة فقط: لا تحذف ولا تعدّل ولا تنشر ولا تثبّت شيئًا.", "The review is read-only: do not delete, change, publish or install anything."),
        T("افحص عينة حقيقية من الأدلة لكل معيار (ملفات أو سجلات أو إعدادات أو نصوص)، واذكر وش فحصت بالضبط.", "Check a real sample of evidence for each criterion (files, logs, settings or text) and say exactly what you checked."),
        T("لكل ملاحظة: الدليل، ومكانه، وأثره، والإصلاح المقترح.", "For each finding: the evidence, where it is, its impact, and the suggested fix."),
        T("أعطِ حكمًا منفصلًا لكل معيار (سليم / فيه ملاحظات / تعذّر التحقق).", "Give a separate verdict per criterion (pass / issues / could not verify)."),
        T("اذكر حدود الفحص: العينة السليمة لا تثبت الباقي، وأي شيء تعذّر فحصه وسببه.", "State the limits: a passing sample does not prove the rest; list anything you could not check and why.")
      ];
      S.push(section(T("الطريقة", "Method"), withChat(short ? [rv[0], rv[1], rv[3]] : rv), "ol"));
      var rvl = limits([]);
      if (rvl.length) S.push(section(T("الحدود", "Limits"), rvl));
      if (detailed) S.push(reportTable());
      S.push(section(T("التقرير", "Report"), [report(T("الحكم العام أولًا، ثم جدول بالمعايير والحكم والدليل، ثم الإصلاحات بالأولوية.", "the overall verdict first, then a table of criterion, verdict and evidence, then fixes by priority."))], "p"));
      return S;
    }

    if (mode === "research") {
      S.push(section(T("الهدف", "Goal"), [T("أبغى مقارنة موثوقة وتوصية مبنية على معايير واضحة.", "I want a reliable comparison and a recommendation tied to clear criteria.")], "p"));
      S.push(section(T("المعطيات", "What I gave you"), knownBlock()));
      S.push(section(T("معايير المقارنة", "Comparison criteria"), hint(a.domain, "compare", L)));
      var rr = [
        T("اكتب الأسئلة اللي لازم تجاوب عليها قبل البحث.", "Write down the questions you must answer before searching."),
        T("اعتمد على مصادر رسمية وحديثة، واذكر تاريخ كل معلومة ومصدرها.", "Use official and recent sources, and give the date and source of each fact."),
        T("قارن الخيارات في جدول حسب المعايير، مع الأسعار والتوفر في بلدي إن أمكن.", "Compare the options in a table by the criteria, with prices and availability in my country where possible."),
        T("اذكر وش تعذّر التحقق منه أو كان قديمًا أو متضاربًا بين المصادر.", "Say what could not be verified, was outdated, or conflicted between sources."),
        T("اختم بتوصية مرتبطة بالمعايير، ومتى يكون خيار ثاني أفضل.", "End with a recommendation tied to the criteria, and when another option would be better.")
      ];
      S.push(section(T("الخطوات", "Steps"), short ? [rr[1], rr[2], rr[3], rr[4]] : rr, "ol"));
      var rl2 = limits([]);
      if (rl2.length) S.push(section(T("القيود", "Constraints"), rl2));
      S.push(section(T("التقرير", "Report"), [report(T("التوصية أولًا، ثم جدول المقارنة، ثم المصادر بتواريخها، ثم ما تعذّر التحقق منه.", "the recommendation first, then the comparison table, then sources with dates, then what could not be verified."))], "p"));
      return S;
    }

    // learn
    var beginner = /(مبتدئ|مبتدي|beginner|eli5|من الصفر|from scratch|basics)/i.test(a.normI);
    var topic = stripFillers(a.working)
      .replace(/^(?:(?:ودي|ابي|ابغى|أبي|أبغى)\s+)?(?:اتعلم|أتعلم|اشرح\s+لي|اشرح|علمني|علّمني|فهمني|فهّمني|افهم|أفهم|درسني)\s+/, "")
      .replace(/^(?:explain(?:\s+to\s+me)?|teach\s+me(?:\s+about)?|help\s+me\s+understand|i\s+want\s+to\s+learn|learn)\s+/i, "")
      .replace(/\s*(?:كأني|كاني)\s+مبتدئ\s*$/, "").replace(/[.؟?!]+$/, "");
    var levelAsked = a.questions.some(function (q) { return q.id === "learn_level"; });
    S.push(section(T("الهدف", "Goal"), [T("اشرح لي هذا الموضوع بحيث أفهمه فعلًا وأقدر أشرحه لغيري: ", "Explain this topic so that I truly understand it and can explain it to someone else: ") + tick(topic, a) + "."], "p"));
    S.push(section(T("عني", "About me"), [levelAsked ? "" : T("المستوى: ", "My level: ") + (beginner ? T("مبتدئ، بدون خلفية سابقة.", "beginner, no background.") : T("متوسط؛ اسألني سؤالًا واحدًا عن خلفيتي إذا احتجت.", "intermediate; ask me one question about my background if needed.")), short ? "" : req].concat(unknownLines())));
    var ls = [
      T("ابدأ بالفكرة الأساسية في جملتين بلغة بسيطة.", "Start with the core idea in two plain sentences."),
      T("تدرّج خطوة بخطوة من الأساسيات إلى الأعمق، وعرّف كل مصطلح أول مرة يظهر.", "Build up step by step from basics to deeper parts, and define each term the first time it appears."),
      T("أعطِ مثالًا أو تشبيهًا من الحياة اليومية لكل فكرة رئيسية.", "Give an everyday example or analogy for each main idea."),
      T("اختم بثلاثة أسئلة قصيرة أختبر فيها فهمي، مع الإجابات في النهاية.", "End with three short questions to check my understanding, with answers at the end.")
    ];
    if (detailed) ls.push(T("اقترح تمرينًا عمليًا صغيرًا أطبّق فيه اللي تعلمته.", "Suggest one small hands-on exercise to apply it."));
    if (short) ls = [ls[0], T("تدرّج خطوة بخطوة مع مثال من الحياة اليومية لكل فكرة.", "Build up step by step with an everyday example for each idea."), ls[3]];
    S.push(section(T("طريقة الشرح", "How to explain"), ls, "ol"));
    S.push(section(T("التحقق والمخرجات", "Check and output"), [T("تأكد إن الشرح ما فيه أخطاء ولا مصطلحات بدون تعريف. الطول: ", "Make sure there are no errors and no undefined terms. Length: ") + (short ? T("قصير (حوالي 300 كلمة).", "short (about 300 words).") : T("متوسط (من 500 إلى 800 كلمة).", "medium (500 to 800 words).")), report(T("وفي النهاية لخّص الفكرة في ثلاث نقاط.", "and at the end summarise the idea in three bullet points."))], "p"));
    return S;
  }

  /* ---------- improve: intent + kept constraints + corrections, then the inner layout ---------- */
  function improveSections(a, o, inner) {
    var AR = o.outLang === "ar";
    function T(ar, en) { return AR ? ar : en; }
    var m = a.merged || { clauses: [], confirmed: [], changes: [], changed: false };
    var LANGNAME = { en: T("الإنجليزية", "English"), ar: T("العربية", "Arabic"), fr: T("الفرنسية", "French") };
    var TONENAME = { formal: T("رسمي", "formal"), friendly: T("ودي", "friendly"), short: T("مختصر", "concise"), professional: T("احترافي", "professional"), casual: T("عفوي", "casual") };
    var attrs = [];
    if (m.deliverableLang) attrs.push(T("باللغة ", "in ") + LANGNAME[m.deliverableLang]);
    if (m.tones && m.tones.length) attrs.push(T("بأسلوب ", "with a ") + m.tones.map(function (t) { return TONENAME[t] || t; }).join(T(" و", " and ")) + (AR ? "" : " tone"));
    var intent = m.clauses.map(function (c, i) {
      var t = tick(c.text, a);
      if (c.mods.length) t += T("، ", ", ") + c.mods.map(function (x) { return tick(x, a); }).join(T("، ", ", "));
      if (i === 0 && attrs.length) t += T("، ", ", ") + attrs.join(T(" و", " and "));
      return t;
    });
    var S = [section(T("المقصد", "Intent"), intent.length ? intent : [tick(a.working, a)], intent.length > 1 ? "ol" : "p")];
    var cons = a.constraints.map(function (c) { return tick(c, a); });
    var lits = litList(a, AR ? "، " : ", ");
    if (lits) cons.push(T("احتفظ بهذه كما هي: ", "Keep these exactly: ") + lits);
    if (/(احذف|حذف|delete|remove)/i.test(a.normI)) cons.push(T("أي حذف: بالمسار الدقيق، وبعد نجاح الخطوة السابقة والتحقق منها فقط، وموافقتي تغطي المذكور هنا فقط.", "Any deletion: by exact path, only after the previous step succeeded and was verified; my approval covers only what is listed here."));
    if (!cons.length) cons.push(T("حافظ على كل تفاصيل الطلب الأصلي ولا تضف قيودًا لم أطلبها.", "Keep every detail of the original request and add no constraints I did not ask for."));
    S.push(section(T("القيود", "Constraints"), uniq(cons)));
    if (m.confirmed.length) S.push(section(T("مؤكد مني (لا تعيد اختباره)", "Confirmed by me (do not retest)"), m.confirmed.map(function (c) { return tick(c, a); })));
    inner.forEach(function (s, i) {
      if (i === 0) return;
      if (/^(المعطيات|What I gave you|ما نعرفه|What we know|النطاق والمعطيات|Scope and what I gave you|القيود|Constraints)$/.test(s.h)) return;
      S.push(s);
    });
    if (m.changed) {
      var ch = (m.changes || []).map(function (c) { return tick(c, a); }).concat(attrs);
      S.push(section(T("اللي تغيّر عن النسخة السابقة", "What changed from the earlier version"),
        [(ch.length ? T("المعتمد الآن: ", "Now in effect: ") + ch.join(T("، ", ", ")) + T(". ", ". ") : "") + T("أي تعليمة قديمة تخالف هذا ملغاة.", "Any earlier instruction that conflicts with this is cancelled.")], "p"));
    }
    return S;
  }

  /* ---------- the 8 other languages: translated headings and phrases ---------- */
  var LITE = {
    es: { goal: "Objetivo", given: "Datos", steps: "Pasos", limits: "Límites", check: "Verificación", report: "Informe", request: "Mi solicitud tal como la escribí", keep: "Usa exactamente", unknown: "Aún desconocido", assume: "Supuesto provisional",
      open: "Trabaja en mi ordenador con tus herramientas, dentro de estos permisos, y verifica el resultado.", openChat: "No puedes ejecutar nada en mi equipo: dame pasos numerados con el resultado esperado de cada uno.",
      s: { readonly: "Primero revisa en modo solo lectura: versiones, registros y estado actual.", rank: "Ordena las causas probables según la evidencia.", fix: "Aplica la corrección más pequeña que encaje con la evidencia, con forma de revertirla.", retest: "Vuelve a probar en el punto de uso real.", stuck: "Si falla, indica la siguiente comprobación y qué necesitas de mí.", state: "Lee primero el estado actual (documentación, progreso, git, procesos en marcha).", backup: "Haz una copia de seguridad de lo que vaya a cambiar.", noscratch: "Trabaja sobre el proyecto existente; no lo rehagas desde cero.", preserve: "Conserva datos, ajustes y compatibilidad; prueba cualquier migración.", test: "Prueba de principio a fin con el método real de arranque.", last: "Busca el último punto confirmado en resultados, registros y estado actual.", running: "Comprueba que no haya procesos en marcha antes de empezar.", noredo: "No repitas trabajo terminado; corrige solo huecos probados.", resumept: "Guarda un punto de reanudación tras cada lote.", paths: "Registra las rutas exactas de origen y destino y mide el espacio libre.", copyverify: "Copia, verifica el destino (número, tamaño, hash) y solo entonces elimina la copia sobrante.", onecopy: "Deja una sola copia final en un solo lugar.", skip: "Omite lo que esté en uso o no puedas probar que corresponde, y lístalo.", space: "Mide el espacio libre antes y después.", criteriaFirst: "Define los criterios antes de empezar.", evidence: "Cada hallazgo con su evidencia y una valoración por criterio.", sample: "Una muestra correcta no prueba el resto; indica lo que no se pudo comprobar.", sources: "Usa fuentes oficiales y recientes, con fecha.", table: "Compara en una tabla y recomienda según los criterios.", level: "Adapta la explicación a mi nivel, de lo básico a lo avanzado, con ejemplos.", quiz: "Termina con tres preguntas de autoevaluación y sus respuestas.", direct: "Ve directo al resultado, sin rodeos.", details: "Usa todos mis datos tal cual; no inventes lo que falte.", keepIntent: "Conserva la intención y todas las restricciones del texto original.", latest: "Aplica mis correcciones: la instrucción más reciente prevalece." },
      lim: "Nada de borrar, instalar, publicar ni cambios del sistema sin mi aprobación.", rep: "Informe en español: primero el resultado, luego detalles; separa lo verificado ahora, lo deducido y lo no verificado." },
    fr: { goal: "Objectif", given: "Données", steps: "Étapes", limits: "Limites", check: "Vérification", report: "Rapport", request: "Ma demande telle que je l'ai écrite", keep: "À garder tel quel", unknown: "Encore inconnu", assume: "Hypothèse provisoire",
      open: "Travaille sur mon ordinateur avec tes outils, dans ces limites d'autorisation, puis vérifie le résultat.", openChat: "Tu ne peux rien exécuter sur ma machine : donne-moi des étapes numérotées avec le résultat attendu de chacune.",
      s: { readonly: "Commence par des vérifications en lecture seule : versions, journaux et état actuel.", rank: "Classe les causes probables selon les preuves.", fix: "Applique le plus petit correctif conforme aux preuves, avec un retour arrière possible.", retest: "Reteste au point d'utilisation réel.", stuck: "En cas d'échec, indique la vérification suivante et ce qu'il te faut de ma part.", state: "Lis d'abord l'état actuel (docs, avancement, git, processus en cours).", backup: "Fais une sauvegarde de ce qui va changer.", noscratch: "Travaille sur le projet existant ; ne le refais pas de zéro.", preserve: "Préserve données, réglages et compatibilité ; teste toute migration.", test: "Teste de bout en bout avec le vrai mode de lancement.", last: "Trouve le dernier point confirmé dans les résultats, journaux et l'état actuel.", running: "Vérifie qu'aucun processus ne tourne encore avant de commencer.", noredo: "Ne refais pas le travail terminé ; corrige seulement les manques prouvés.", resumept: "Enregistre un point de reprise après chaque lot.", paths: "Note les chemins exacts source et destination et mesure l'espace libre.", copyverify: "Copie, vérifie la destination (nombre, taille, hash), puis seulement supprime la copie en trop.", onecopy: "Garde une seule copie finale à un seul endroit.", skip: "Ignore ce qui est utilisé ou dont l'appartenance n'est pas prouvée, et liste-le.", space: "Mesure l'espace libre avant et après.", criteriaFirst: "Définis les critères avant de commencer.", evidence: "Chaque constat avec sa preuve et un verdict par critère.", sample: "Un échantillon correct ne prouve pas le reste ; dis ce qui n'a pas pu être vérifié.", sources: "Utilise des sources officielles et récentes, datées.", table: "Compare dans un tableau et recommande selon les critères.", level: "Adapte l'explication à mon niveau, des bases vers le plus avancé, avec des exemples.", quiz: "Termine par trois questions d'auto-évaluation avec réponses.", direct: "Va droit au résultat, sans préambule.", details: "Utilise toutes mes données telles quelles ; n'invente rien.", keepIntent: "Garde l'intention et toutes les contraintes du texte d'origine.", latest: "Applique mes corrections : la consigne la plus récente l'emporte." },
      lim: "Aucune suppression, installation, publication ou modification système sans mon accord.", rep: "Rapport en français : le résultat d'abord, puis les détails ; sépare ce qui est vérifié maintenant, déduit et non vérifiable." },
    de: { goal: "Ziel", given: "Angaben", steps: "Schritte", limits: "Grenzen", check: "Prüfung", report: "Bericht", request: "Meine Anfrage im Wortlaut", keep: "Genau so übernehmen", unknown: "Noch unbekannt", assume: "Vorläufige Annahme",
      open: "Arbeite auf meinem Computer mit deinen Werkzeugen innerhalb dieser Berechtigungen und prüfe das Ergebnis selbst.", openChat: "Du kannst auf meinem Rechner nichts ausführen: Gib mir nummerierte Schritte mit dem erwarteten Ergebnis jedes Schritts.",
      s: { readonly: "Zuerst nur lesend prüfen: Versionen, Protokolle und aktueller Zustand.", rank: "Ordne die wahrscheinlichen Ursachen nach Belegen.", fix: "Wende die kleinste passende Korrektur mit Rückweg an.", retest: "Teste erneut am Ort der tatsächlichen Nutzung.", stuck: "Wenn es scheitert: nenne die nächste Prüfung und was du von mir brauchst.", state: "Lies zuerst den aktuellen Stand (Doku, Fortschritt, git, laufende Prozesse).", backup: "Sichere alles, was sich ändern wird.", noscratch: "Arbeite am bestehenden Projekt; baue es nicht neu auf.", preserve: "Erhalte Daten, Einstellungen und Kompatibilität; teste jede Migration.", test: "Teste durchgängig mit der echten Startmethode.", last: "Finde den letzten bestätigten Punkt aus Ergebnissen, Protokollen und aktuellem Zustand.", running: "Prüfe vor dem Start, dass keine Prozesse mehr laufen.", noredo: "Wiederhole keine erledigte Arbeit; schließe nur belegte Lücken.", resumept: "Speichere nach jedem Durchgang einen Wiederaufnahmepunkt.", paths: "Notiere die genauen Quell- und Zielpfade und miss den freien Speicher.", copyverify: "Kopieren, Ziel prüfen (Anzahl, Größe, Hash), erst dann die überzählige Kopie entfernen.", onecopy: "Am Ende eine einzige Kopie an einem Ort.", skip: "Überspringe Benutztes oder nicht eindeutig Zugehöriges und liste es auf.", space: "Miss den freien Speicher vorher und nachher.", criteriaFirst: "Lege die Kriterien vor dem Start fest.", evidence: "Jeder Befund mit Beleg und ein Urteil pro Kriterium.", sample: "Eine bestandene Stichprobe beweist nicht den Rest; nenne, was nicht prüfbar war.", sources: "Nutze offizielle, aktuelle und datierte Quellen.", table: "Vergleiche in einer Tabelle und empfehle anhand der Kriterien.", level: "Passe die Erklärung meinem Niveau an, von den Grundlagen aufwärts, mit Beispielen.", quiz: "Schließe mit drei Selbsttest-Fragen samt Antworten.", direct: "Komm direkt zum Ergebnis, ohne Vorrede.", details: "Übernimm alle meine Angaben wörtlich; erfinde nichts.", keepIntent: "Behalte die Absicht und alle Vorgaben des Originals.", latest: "Übernimm meine Korrekturen: die neueste Anweisung gilt." },
      lim: "Kein Löschen, Installieren, Veröffentlichen oder Systemändern ohne meine Zustimmung.", rep: "Bericht auf Deutsch: zuerst das Ergebnis, dann Details; trenne jetzt Geprüftes, Abgeleitetes und nicht Prüfbares." },
    tr: { goal: "Hedef", given: "Veriler", steps: "Adımlar", limits: "Sınırlar", check: "Doğrulama", report: "Rapor", request: "Yazdığım haliyle isteğim", keep: "Aynen kullan", unknown: "Henüz bilinmeyen", assume: "Geçici varsayım",
      open: "Bilgisayarımda, sahip olduğun araçlarla ve bu izinler içinde çalış; sonucu kendin doğrula.", openChat: "Bilgisayarımda bir şey çalıştıramazsın: her adımın beklenen sonucuyla birlikte numaralı adımlar ver.",
      s: { readonly: "Önce salt okunur kontroller: sürümler, günlükler ve mevcut durum.", rank: "Olası nedenleri kanıta göre sırala.", fix: "Kanıta uyan en küçük düzeltmeyi geri alma yoluyla uygula.", retest: "Gerçek kullanım noktasında yeniden test et.", stuck: "Başarısız olursa bir sonraki kontrolü ve benden neye ihtiyacın olduğunu yaz.", state: "Önce mevcut durumu oku (belgeler, ilerleme, git, çalışan işlemler).", backup: "Değişecek her şeyin yedeğini al.", noscratch: "Mevcut proje üzerinde çalış; sıfırdan kurma.", preserve: "Verileri, ayarları ve uyumluluğu koru; her geçişi test et.", test: "Gerçek başlatma yöntemiyle baştan sona test et.", last: "Kaydedilmiş sonuçlardan, günlüklerden ve mevcut durumdan son doğrulanmış noktayı bul.", running: "Başlamadan önce çalışan işlem kalmadığını kontrol et.", noredo: "Biten işi tekrarlama; yalnızca kanıtlanmış eksikleri tamamla.", resumept: "Her gruptan sonra bir devam noktası kaydet.", paths: "Kaynak ve hedefin tam yollarını kaydet, boş alanı ölç.", copyverify: "Kopyala, hedefi doğrula (sayı, boyut, hash), ancak ondan sonra fazla kopyayı sil.", onecopy: "Sonunda tek yerde tek bir kopya kalsın.", skip: "Kullanımda olanları veya aidiyeti kanıtlanamayanları atla ve listele.", space: "Önce ve sonra boş alanı ölç.", criteriaFirst: "Başlamadan önce ölçütleri belirle.", evidence: "Her bulgu kanıtıyla, her ölçüt için ayrı karar.", sample: "Başarılı bir örnek gerisini kanıtlamaz; doğrulanamayanları belirt.", sources: "Resmi, güncel ve tarihli kaynaklar kullan.", table: "Bir tabloda karşılaştır ve ölçütlere göre öner.", level: "Anlatımı seviyeme göre, temelden ileriye, örneklerle yap.", quiz: "Cevaplarıyla birlikte üç öz-değerlendirme sorusuyla bitir.", direct: "Doğrudan sonuca geç, giriş yapma.", details: "Verdiğim tüm bilgileri aynen kullan; eksikleri uydurma.", keepIntent: "Orijinal metnin amacını ve tüm kısıtlarını koru.", latest: "Düzeltmelerimi uygula: en son talimat geçerlidir." },
      lim: "Onayım olmadan silme, kurulum, yayımlama veya sistem değişikliği yok.", rep: "Rapor Türkçe olsun: önce sonuç, sonra ayrıntılar; şimdi doğrulananı, çıkarımı ve doğrulanamayanı ayır." },
    pt: { goal: "Objetivo", given: "Dados", steps: "Passos", limits: "Limites", check: "Verificação", report: "Relatório", request: "Meu pedido como escrevi", keep: "Use exatamente", unknown: "Ainda desconhecido", assume: "Suposição provisória",
      open: "Trabalhe no meu computador com as suas ferramentas, dentro destas permissões, e verifique o resultado.", openChat: "Você não pode executar nada na minha máquina: dê passos numerados com o resultado esperado de cada um.",
      s: { readonly: "Primeiro verificações somente leitura: versões, logs e estado atual.", rank: "Ordene as causas prováveis pelas evidências.", fix: "Aplique a menor correção compatível com as evidências, com forma de reverter.", retest: "Teste de novo no ponto de uso real.", stuck: "Se falhar, diga a próxima verificação e o que precisa de mim.", state: "Leia primeiro o estado atual (documentação, progresso, git, processos em execução).", backup: "Faça backup de tudo o que vai mudar.", noscratch: "Trabalhe no projeto existente; não o refaça do zero.", preserve: "Preserve dados, configurações e compatibilidade; teste qualquer migração.", test: "Teste de ponta a ponta com o método real de inicialização.", last: "Encontre o último ponto confirmado nos resultados, logs e estado atual.", running: "Verifique se não há processos ainda em execução antes de começar.", noredo: "Não refaça trabalho concluído; corrija só lacunas comprovadas.", resumept: "Salve um ponto de retomada após cada lote.", paths: "Registre os caminhos exatos de origem e destino e meça o espaço livre.", copyverify: "Copie, verifique o destino (quantidade, tamanho, hash) e só então remova a cópia extra.", onecopy: "No fim, uma única cópia em um único lugar.", skip: "Pule o que estiver em uso ou sem pertença comprovada, e liste.", space: "Meça o espaço livre antes e depois.", criteriaFirst: "Defina os critérios antes de começar.", evidence: "Cada achado com evidência e um veredito por critério.", sample: "Uma amostra aprovada não prova o resto; diga o que não pôde ser verificado.", sources: "Use fontes oficiais, recentes e datadas.", table: "Compare numa tabela e recomende pelos critérios.", level: "Adapte a explicação ao meu nível, do básico ao avançado, com exemplos.", quiz: "Termine com três perguntas de autoavaliação e respostas.", direct: "Vá direto ao resultado, sem rodeios.", details: "Use todos os meus dados exatamente; não invente o que faltar.", keepIntent: "Mantenha a intenção e todas as restrições do texto original.", latest: "Aplique minhas correções: a instrução mais recente prevalece." },
      lim: "Nada de excluir, instalar, publicar ou alterar o sistema sem minha aprovação.", rep: "Relatório em português: primeiro o resultado, depois os detalhes; separe o verificado agora, o deduzido e o não verificável." },
    ja: { goal: "目標", given: "前提情報", steps: "手順", limits: "制限", check: "確認", report: "報告", request: "私が書いたままの依頼", keep: "そのまま使用", unknown: "未確認", assume: "暫定の前提",
      open: "私のPC上で、使えるツールを使い、この権限の範囲内で自分で作業し、結果を自分で確認してください。", openChat: "私のPCでは何も実行できないので、各手順の期待される結果つきで番号付きの手順をください。",
      s: { readonly: "まず読み取り専用で確認：バージョン、ログ、現在の状態。", rank: "考えられる原因を証拠の強さ順に並べる。", fix: "証拠に合う最小の修正を、元に戻せる形で行う。", retest: "実際に使う場所で再テストする。", stuck: "失敗したら、次の確認と私に必要なことを具体的に書く。", state: "最初に現状を読む（ドキュメント、進捗、git、実行中のプロセス）。", backup: "変更するものはすべてバックアップする。", noscratch: "既存のプロジェクトで作業し、一から作り直さない。", preserve: "データ・設定・互換性を守り、移行はテストする。", test: "実際の起動方法で最初から最後までテストする。", last: "保存された結果・ログ・現状から最後に確認できた地点を特定する。", running: "始める前に、前回の処理が実行中でないか確認する。", noredo: "終わった作業は繰り返さず、証明された不足だけを直す。", resumept: "各バッチの後に再開ポイントを保存する。", paths: "元と先の正確なパスを記録し、空き容量を測る。", copyverify: "コピーして移動先を確認（件数・サイズ・ハッシュ）してから、余分なコピーを消す。", onecopy: "最終的に一か所に一つのコピーだけを残す。", skip: "使用中や所属が証明できないものはスキップして一覧にする。", space: "作業前後の空き容量を測る。", criteriaFirst: "始める前に評価基準を決める。", evidence: "各指摘に証拠を付け、基準ごとに判定する。", sample: "合格したサンプルは残りを証明しない。確認できなかった点を書く。", sources: "公式で新しい、日付のある情報源を使う。", table: "表で比較し、基準に沿って推薦する。", level: "私のレベルに合わせ、基礎から段階的に、例を使って説明する。", quiz: "最後に答え付きの確認問題を3つ出す。", direct: "前置きなしで結果から書く。", details: "私の情報はそのまま使い、足りないことは作らない。", keepIntent: "元の文の意図と制約をすべて保つ。", latest: "私の修正を反映し、最新の指示を優先する。" },
      lim: "私の承認なしに削除・インストール・公開・システム変更をしない。", rep: "報告は日本語で、結果を先に、次に詳細。今確認したこと、推測、確認できなかったことを分ける。" },
    ko: { goal: "목표", given: "주어진 정보", steps: "단계", limits: "제한", check: "확인", report: "보고", request: "내가 쓴 그대로의 요청", keep: "그대로 사용", unknown: "아직 모름", assume: "임시 가정",
      open: "내 PC에서 사용할 수 있는 도구로 이 권한 범위 안에서 직접 작업하고 결과를 직접 확인하세요.", openChat: "내 PC에서는 아무것도 실행할 수 없으니, 각 단계의 예상 결과와 함께 번호가 매겨진 단계를 주세요.",
      s: { readonly: "먼저 읽기 전용으로 확인: 버전, 로그, 현재 상태.", rank: "가능한 원인을 증거에 따라 순위를 매긴다.", fix: "증거에 맞는 가장 작은 수정을 되돌릴 방법과 함께 적용한다.", retest: "실제 사용하는 지점에서 다시 테스트한다.", stuck: "실패하면 다음 확인 사항과 내게 필요한 것을 정확히 적는다.", state: "먼저 현재 상태를 읽는다(문서, 진행 상황, git, 실행 중인 프로세스).", backup: "바뀔 모든 것을 백업한다.", noscratch: "기존 프로젝트에서 작업하고 처음부터 다시 만들지 않는다.", preserve: "데이터, 설정, 호환성을 지키고 마이그레이션은 테스트한다.", test: "실제 실행 방식으로 처음부터 끝까지 테스트한다.", last: "저장된 결과, 로그, 현재 상태에서 마지막으로 확인된 지점을 찾는다.", running: "시작 전에 이전 작업이 아직 실행 중인지 확인한다.", noredo: "끝난 작업은 반복하지 말고 증명된 빈틈만 고친다.", resumept: "배치마다 재개 지점을 저장한다.", paths: "원본과 대상의 정확한 경로를 기록하고 여유 공간을 잰다.", copyverify: "복사하고 대상(개수, 크기, 해시)을 확인한 뒤에만 남는 사본을 지운다.", onecopy: "마지막에는 한 곳에 사본 하나만 남긴다.", skip: "사용 중이거나 소속을 증명할 수 없는 것은 건너뛰고 목록으로 남긴다.", space: "작업 전후의 여유 공간을 잰다.", criteriaFirst: "시작 전에 기준을 정한다.", evidence: "각 발견 사항에 증거를 붙이고 기준별로 판정한다.", sample: "통과한 샘플이 나머지를 증명하지 않으며, 확인하지 못한 것을 적는다.", sources: "공식적이고 최신이며 날짜가 있는 출처를 쓴다.", table: "표로 비교하고 기준에 따라 추천한다.", level: "내 수준에 맞춰 기초부터 단계적으로, 예시와 함께 설명한다.", quiz: "정답이 포함된 자기 점검 질문 세 개로 마무리한다.", direct: "서론 없이 결과부터 쓴다.", details: "내가 준 정보는 그대로 쓰고 없는 것은 지어내지 않는다.", keepIntent: "원문의 의도와 모든 제약을 유지한다.", latest: "내 수정 사항을 반영하고 가장 최근 지시를 우선한다." },
      lim: "내 승인 없이 삭제, 설치, 게시, 시스템 변경을 하지 않는다.", rep: "보고는 한국어로, 결과 먼저 그다음 세부 사항. 지금 확인한 것, 추론한 것, 확인하지 못한 것을 구분한다." },
    zh: { goal: "目标", given: "已知信息", steps: "步骤", limits: "限制", check: "检查", report: "报告", request: "我原样写下的请求", keep: "原样使用", unknown: "尚不清楚", assume: "暂定假设",
      open: "请在我的电脑上用你可用的工具、在这些权限范围内亲自完成，并亲自核实结果。", openChat: "你无法在我的电脑上运行任何东西，请给我编号步骤，并写出每一步的预期结果。",
      s: { readonly: "先做只读检查：版本、日志和当前状态。", rank: "按证据对可能原因排序。", fix: "采用与证据相符的最小修复，并保留回退方法。", retest: "在真实使用的地方重新测试。", stuck: "如果失败，写出下一步检查以及需要我提供什么。", state: "先读取当前状态（文档、进度、git、正在运行的进程）。", backup: "对所有将要改动的内容做备份。", noscratch: "在现有项目上修改，不要从头重建。", preserve: "保留数据、设置和兼容性；任何迁移都要测试。", test: "用真实的启动方式端到端测试。", last: "从已保存的结果、日志和当前状态找出最后确认的位置。", running: "开始前确认上一批处理没有仍在运行。", noredo: "不要重做已完成的工作，只补上已证实的缺口。", resumept: "每批完成后保存一个续做点。", paths: "记录源和目标的精确路径，并测量可用空间。", copyverify: "先复制，核实目标（数量、大小、哈希），之后才删除多余副本。", onecopy: "最终只在一个地方保留一份。", skip: "跳过正在使用或无法证明归属的文件，并列出来。", space: "在操作前后测量可用空间。", criteriaFirst: "开始前先定好标准。", evidence: "每个发现都附证据，并按标准分别给出结论。", sample: "通过的样本不能证明其余部分；写明无法核实的内容。", sources: "使用官方、最新且注明日期的来源。", table: "用表格比较，并按标准给出建议。", level: "按我的水平从基础到深入讲解，并配例子。", quiz: "最后给三道带答案的自测题。", direct: "直接给出结果，不要开场白。", details: "我给的信息原样使用，缺少的不要编造。", keepIntent: "保留原文的意图和全部约束。", latest: "应用我的更正：以最新指令为准。" },
      lim: "未经我同意，不删除、不安装、不发布、不改动系统。", rep: "用中文报告：先写结果，再写细节；区分现在已核实的、推断的和无法核实的。" }
  };
  var LITE_STEPS = {
    quick: ["direct", "details"], comprehensive: ["details", "direct"],
    diagnose: ["readonly", "rank", "fix", "retest", "stuck"],
    project: ["state", "backup", "noscratch", "preserve", "test"],
    files: ["paths", "copyverify", "onecopy", "skip", "space"],
    resume: ["last", "running", "noredo", "resumept"],
    review: ["criteriaFirst", "readonly", "evidence", "sample"],
    research: ["criteriaFirst", "sources", "table"],
    learn: ["level", "quiz"],
    improve: ["keepIntent", "latest"]
  };
  function composeLite(a, o) {
    var P = LITE[o.outLang], tech = a.technical;
    var S = [];
    S.push(section(P.goal, [(tech ? (o.target === "chat" ? P.openChat : P.open) + " " : "") + P.request + ": «" + (a.mode === "improve" ? a.working : a.raw) + "»"], "p"));
    var g = [];
    var lits = litList(a, ", ");
    if (lits) g.push(P.keep + ": " + lits);
    a.constraints.forEach(function (c) { g.push(tick(c, a)); });
    a.protected.forEach(function (p) { g.push("✗ " + tick(p, a)); });
    if (a.unknowns.length) g.push(P.unknown + ": " + a.unknowns.map(function (u) { return u.en; }).join(", "));
    if (g.length) S.push(section(P.given, g));
    var keys = (a.mode === "improve" ? LITE_STEPS.improve : []).concat(LITE_STEPS[a.inner] || []);
    var steps = (a.subtasks.length >= 2 ? a.subtasks.map(function (s) { return tick(s, a); }) : []).concat(keys.map(function (k) { return P.s[k]; }));
    S.push(section(P.steps, o.level === "short" ? steps.slice(0, 4) : steps, "ol"));
    if (tech || a.risky) S.push(section(P.limits, [P.lim]));
    S.push(section(P.check, [P.s.retest], "p"));
    S.push(section(P.report, [P.rep], "p"));
    return S;
  }

  /* ---------- rendering by format ---------- */
  function render(S, format, lang) {
    var sep = lang === "ar" ? "؛ " : "; ";
    // join items on one line: a sentence that already ends with a stop needs only a space (no ".;")
    function joinLine(items, type) {
      if (type === "p") return items.join(" ");
      return items.reduce(function (acc, it, i) { return i === 0 ? it : acc + (/[.!?؟…]["»”)]?$/.test(acc) ? " " : sep) + it; }, "");
    }
    // "Goal: Task: ..." -> "Task: ...": a single item that carries its own short label keeps that label only
    function line(s) {
      var body = joinLine(s.items, s.type);
      if (s.items.length === 1 && /^[^:\n«"]{1,28}:\s/.test(s.items[0])) return body;
      return s.h + ": " + body;
    }
    if (format === "plain") return S.map(line).join("\n\n");
    if (format === "steps") {
      var out = [], n = 1;
      S.forEach(function (s) {
        if (s.type === "ol") s.items.forEach(function (it) { out.push((n++) + ". " + it); });
        else out.push((n++) + ". " + line(s));
      });
      return out.join("\n");
    }
    return S.map(function (s) {
      var body = s.type === "ol" ? s.items.map(function (it, i) { return (i + 1) + ". " + it; }).join("\n")
               : s.type === "p" ? s.items.join("\n") : s.items.map(function (it) { return "- " + it; }).join("\n");
      return "## " + s.h + "\n" + body;
    }).join("\n\n");
  }

  /* ---------- public API ---------- */
  function domainLabel(d, lang) { var x = X.DOMAINS[d]; return x ? (lang === "ar" ? x.ar : x.en) : (lang === "ar" ? "عام" : "General"); }
  function composeBalanced(a, o) {
    var ob = Object.assign({}, o, { level: "balanced" }), S;
    if (o.outLang === "ar" || o.outLang === "en") {
      S = composeFull(a, ob);
      if (a.mode === "improve") S = improveSections(a, ob, S);
    } else S = composeLite(a, ob);
    return S.filter(function (x) { return x.items.length; });
  }
  function cloneS(S) { return S.map(function (x) { return { h: x.h, items: x.items.slice(), type: x.type }; }); }
  function firstSentence(t) { var m = /^(.+?[.؟?!])(?:\s|$)/.exec(String(t)); return m ? m[1] : t; }
  var CORE_H = /^(حدود الصلاحيات|Permission boundary|المقصد|Intent)$/;
  function shorten(S, a, o, B) {
    var S2 = cloneS(S), n = S2.length, target = 0.62 * B, floor = 0.5 * B;
    function len() { return render(S2.filter(function (x) { return x.items.length; }), o.format, o.outLang).length; }
    function core(i) { var x = S2[i]; return i === 0 || i === n - 1 || x.type === "ol" || CORE_H.test(x.h) || (a.risky && /^(الحدود|Limits)$/.test(x.h)); }
    var ops = [];
    S2.forEach(function (x, i) { if (!core(i) && x.items.length > 1) ops.push(function () { var old = x.items; x.items = old.slice(0, 1); return function () { x.items = old; }; }); });
    for (var i = n - 2; i > 0; i--) (function (x, i) { if (!core(i)) ops.push(function () { var old = x.items; x.items = []; return function () { x.items = old; }; }); })(S2[i], i);
    var VERIFY_RX = /(?:نقطة الاستخدام|أعد الاختبار|اختبر|تحقّق|تحقق|اختبار|retest|point of use|verify|test|check)/i;
    var ACT_RX = /(?:طبّق|طبق|نفّذ|نفذ|انسخ|ابنِ|ابن |احذف|apply|make the changes|copy|build|delete)/i;
    function keepK(list, k) {
      var scored = list.map(function (t, i) { return { i: i, s: (i === 0 ? 3 : 0) + (VERIFY_RX.test(t) ? 3 : 0) + (ACT_RX.test(t) ? 2 : 0) + 1 }; });
      var keep = scored.slice().sort(function (p, q) { return q.s - p.s || p.i - q.i; }).slice(0, k).map(function (x) { return x.i; });
      keep.sort(function (p, q) { return p - q; });
      return keep.map(function (i) { return list[i]; });
    }
    S2.forEach(function (x) { if (x.type === "ol" && x.items.length > 3) ops.push(function () { var old = x.items; x.items = keepK(old, Math.max(3, Math.ceil(old.length * 0.6))); return function () { x.items = old; }; }); });
    ops.push(function () { var x = S2[n - 1], old = x.items; x.items = old.map(firstSentence); return function () { x.items = old; }; });
    ops.push(function () { var x = S2[0], old = x.items; x.items = old.map(firstSentence); return function () { x.items = old; }; });
    S2.forEach(function (x) { if (x.type === "ol" && x.items.length > 2) ops.push(function () { var old = x.items; x.items = keepK(old, Math.max(2, old.length - 1)); return function () { x.items = old; }; }); });
    for (var k = 0; k < ops.length && len() > target; k++) { var undo = ops[k](); if (len() < floor) undo(); }
    return S2.filter(function (x) { return x.items.length; });
  }
  function detailExtras(a, o) {
    var L = o.outLang;
    if (L !== "ar" && L !== "en") {
      var P = LITE[L];
      return [section(P.check, [P.s.criteriaFirst, P.s.evidence, P.s.sample]), section(P.limits, [P.s.stuck, P.s.details]), section(P.report, ["| ✓ | ✗ | ? |"], "p")];
    }
    var AR = L === "ar"; function T(ar, en) { return AR ? ar : en; }
    var ACC = {
      quick: [T("كل جزء من طلبي متغطّى.", "Every part of my request is covered."), T("ما فيه معلومة مخترعة، والافتراضات مكتوبة.", "No invented facts; assumptions are written down."), T("الناتج جاهز للاستخدام بدون تعديل كبير.", "The result is ready to use without major edits.")],
      diagnose: [T("السبب مدعوم بدليل من الفحص أو السجلات.", "The cause is backed by evidence from checks or logs."), T("الإصلاح مجرّب من نقطة الاستخدام ونجح.", "The fix was retested at the point of use and works."), T("طريقة الرجوع مكتوبة ومجرّبة.", "The rollback is written down and tested.")],
      project: [T("كل تغيير مطلوب يشتغل كما وصفته.", "Every requested change works as described."), T("ما انكسر شيء كان يشتغل قبل.", "Nothing that worked before is broken."), T("البيانات والإعدادات سليمة بعد التحديث.", "Data and settings are intact after the change.")],
      files: [T("العدد والحجم متطابق بين المصدر والوجهة.", "Counts and sizes match between source and destination."), T("ما انحذف ولا انتقل شيء خارج الطلب.", "Nothing outside the request was deleted or moved."), T("المساحة قبل وبعد مذكورة بالأرقام.", "Free space before and after is reported in numbers.")],
      resume: [T("ما فيه دفعة متكررة ولا ناقصة.", "No batch is duplicated or missing."), T("نقطة الاستئناف محفوظة بعد كل دفعة.", "A resume point is saved after every batch."), T("الاكتمال مثبت بدليل.", "Completion is proven with evidence.")],
      review: [T("كل معيار له حكم ودليل.", "Every criterion has a verdict and evidence."), T("الملاحظات مرتّبة حسب الأولوية.", "Findings are ordered by priority."), T("حدود الفحص واضحة.", "The limits of the check are stated.")],
      research: [T("كل معلومة لها مصدر وتاريخ.", "Every fact has a source and a date."), T("كل الخيارات مقارنة على نفس المعايير.", "All options are compared on the same criteria."), T("التوصية مبررة بالمعايير.", "The recommendation is justified by the criteria.")],
      learn: [T("الشرح يناسب مستواي.", "The explanation fits my level."), T("كل مصطلح معرّف أول ما يظهر.", "Every term is defined when it first appears."), T("أسئلة التحقق تغطي الأفكار الرئيسية.", "The check questions cover the main ideas.")]
    };
    var acc = ACC[a.inner] || ACC.quick;
    return [
      section(T("معايير القبول", "Acceptance criteria"), acc),
      section(T("إذا تعثّرت", "If you get stuck"), [T("وقّف عند أول عائق حقيقي واكتب وش جربت ووش صار.", "Stop at the first real blocker and write what you tried and what happened."), T("اقترح طريقين للتعامل معه، واذكر وش تحتاج مني بالضبط.", "Propose two ways forward and say exactly what you need from me.")]),
      section(T("قواعد الدليل", "Evidence rules"), [T("صنّف كل نتيجة: مؤكد، أو مشتبه، أو تعذّر فحصه.", "Label every finding: confirmed, suspected, or could not check."), T("اذكر مصدر كل رقم: من فحصك الآن أو من كلامي.", "Say where every number comes from: checked now or from me."), T("لا تعتبر \"الأمر اشتغل\" دليلًا كافيًا لوحده.", "\"The command ran\" is not proof on its own.")]),
      section(T("جدول التقرير", "Report table"), [T("| البند | الحالة | الدليل | ما بقي |", "| Item | Status | Evidence | Left to do |")], "p"),
      section(T("قبل التسليم", "Before you deliver"), [T("راجع الناتج مقابل طلبي سطرًا بسطر.", "Check the result against my request line by line."), T("احذف أي حشو أو تكرار.", "Remove any filler or repetition.")])
    ];
  }
  function enrich(S, a, o, B) {
    var S2 = cloneS(S), lo = 1.3 * B, hi = 1.7 * B, extras = detailExtras(a, o);
    function len() { return render(S2, o.format, o.outLang).length; }
    for (var i = 0; i < extras.length && len() < lo; i++) {
      S2.splice(S2.length - 1, 0, extras[i]);
      if (len() > hi) S2.splice(S2.length - 2, 1);
    }
    return S2;
  }
  function cleanDashes(text, lang) {
    var sep = lang === "ar" ? "\u060C " : ", ";
    return String(text).split(/(\u00AB[^\u00BB\n]*\u00BB|"[^"\n]*"|`[^`\n]*`)/).map(function (part, i) {
      return i % 2 ? part : part.replace(/\s*[\u2014\u2013]\s*/g, sep).replace(/\u060C\s*\u060C/g, "\u060C").replace(/,\s*,/g, ",");
    }).join("");
  }
  function buildText(a, o) {
    var S = composeBalanced(a, o);
    if (o.level === "short" || o.level === "detailed") {
      var B = render(S, o.format, o.outLang).length;
      S = o.level === "short" ? shorten(S, a, o, B) : enrich(S, a, o, B);
    }
    return cleanDashes(render(S, o.format, o.outLang), o.outLang);
  }
  function normOpts(opts) {
    return {
      mode: MODES.indexOf(opts.mode) >= 0 ? opts.mode : "auto",
      level: /^(short|balanced|detailed)$/.test(opts.level) ? opts.level : "balanced",
      outLang: NATIVE[opts.outLang] ? opts.outLang : "ar",
      target: /^(agent|chat|generic)$/.test(opts.target) ? opts.target : "agent",
      format: /^(sections|plain|steps)$/.test(opts.format) ? opts.format : "sections"
    };
  }
  function alternativesFor(a, o) {
    var AR = o.outLang === "ar", out = [];
    function T(ar, en) { return AR ? ar : en; }
    out.push({ label: T("نسخة تنفيذ مختصرة", "Short execution version"), mode: a.mode, text: buildText(a, Object.assign({}, o, { level: "short" })) });
    if (a.technical) {
      var toChat = o.target !== "chat";
      out.push({ label: toChat ? T("نسخة خطوات لمحادثة بدون أدوات", "Step-by-step version for a chat without tools") : T("نسخة لمساعد ينفّذ على الجهاز", "Version for an assistant with tools"), mode: a.mode, text: buildText(a, Object.assign({}, o, { target: toChat ? "chat" : "agent", level: "detailed" })) });
    } else {
      var a2 = Object.assign({}, a, { inner: a.inner === "comprehensive" ? "quick" : "comprehensive" });
      out.push({ label: a2.inner === "comprehensive" ? T("نسخة شاملة بمعايير قبول", "Comprehensive version with acceptance criteria") : T("نسخة سريعة مركّزة", "Focused quick version"), mode: a2.inner, text: buildText(a2, Object.assign({}, o, { level: a2.inner === "comprehensive" ? "detailed" : "balanced" })) });
    }
    return out;
  }
  function generate(opts) {
    opts = opts || {};
    var o = normOpts(opts);
    var a = analyse(opts.goal, opts.base, o.mode, opts.answers);
    var L2 = o.outLang === "ar" ? "ar" : "en";
    var res = {
      text: buildText(a, o), mode: a.mode, modeLabel: MODE_LABEL[L2][a.mode], innerMode: a.inner,
      domain: a.domain, domainLabel: domainLabel(a.domain, L2),
      givens: a.givens.map(function (g) { return { type: g.type, value: g.value }; }),
      protected: a.protected.slice(), constraints: a.constraints.slice(),
      unknowns: a.unknowns.map(function (u) { return u[L2]; }), assumptions: a.assumptions.map(function (u) { return u[L2]; }),
      questions: a.questions.map(function (q) { return { id: q.id, q: q.q[L2], options: q.options[L2].slice() }; }),
      subtasks: a.subtasks.slice(), readOnly: a.readOnly, newBuild: a.newBuild, transform: a.transform, progress: a.progress,
      corrections: a.merged ? { clauses: a.merged.clauses, confirmed: a.merged.confirmed, replaced: a.merged.replaced, changes: a.merged.changes, deliverableLang: a.merged.deliverableLang, tones: a.merged.tones } : null,
      alternatives: [], options: o
    };
    if (opts.alternatives) res.alternatives = alternativesFor(a, o);
    return res;
  }

  root.MPZEngine = {
    analyse: analyse, generate: generate, LANGS: LANGS, NATIVE: NATIVE, MODES: MODES, MODE_LABEL: MODE_LABEL,
    detectDomain: function (g) { return detectDomain(X.normAr(g), "quick"); }
  };
})(typeof window !== "undefined" ? window : this);
