/* SuperPrompt v2 — language understanding helpers (offline, no DOM).
   Arabic normalisation for matching, Saudi/Gulf + MSA + English intent words,
   and extraction of literals that must be kept exactly as written. */
(function (root) {
  "use strict";

  /* ---------- normalisation (matching only; literals are never altered) ---------- */
  function normAr(s) {
    return String(s || "")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // diacritics
      .replace(/\u0640/g, "")                               // tatweel
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")    // alef forms -> ا
      .replace(/\u0649/g, "\u064A")                         // ى -> ي
      .replace(/\u0629(?=[^\u0600-\u06FF]|$)/g, "\u0647")   // ة -> ه at word end
      .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A")
      .toLowerCase()
      .replace(/[\u200c\u200d\u200e\u200f]/g, "");
  }
  function tokens(norm) { return norm.split(/[^\u0600-\u06FFa-z0-9+#]+/i).filter(Boolean); }

  // Arabic proclitics allowed before a cue word: و ف ب ل ك ال وال بال لل فال
  var PRE = "(?:^|[^\\u0600-\\u06FFa-z0-9])(?:و|ف)?(?:ب|ل|ك)?(?:ال)?";
  var cache = {};
  function cueRe(cue) {
    if (cache[cue]) return cache[cue];
    // a trailing "$" in a cue means "whole word only" (e.g. واصل$ must not match واصلح)
    var exact = /\$$/.test(cue), raw = exact ? cue.slice(0, -1) : cue;
    var c = normAr(raw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    var latin = /^[a-z0-9 '\-]+$/i.test(raw);
    var word = /^[a-z]+$/i.test(raw) && !/(?:kb|0x)/i.test(raw);
    var re = latin ? new RegExp("(?:^|[^a-z0-9])" + c + (raw.length <= 3 || exact ? "(?![a-z0-9])" : word ? "(?:s|es|ed|d|ing)?(?![a-z0-9])" : ""), "i")
                   : new RegExp(PRE + c + (c.length <= 2 || exact ? "(?![\\u0600-\\u06FF])" : ""));
    cache[cue] = re;
    return re;
  }
  function hasCue(norm, list) {
    for (var i = 0; i < list.length; i++) if (cueRe(list[i]).test(norm)) return list[i];
    return null;
  }
  function countCues(norm, list) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (cueRe(list[i]).test(norm)) n++;
    return n;
  }

  /* ---------- intent cues per mode (Saudi/Gulf + MSA + English) ---------- */
  var CUES = {
    improve: ["حسن البرومبت", "حسن هذا البرومبت", "حسن البرمبت", "حسن الامر", "طور البرومبت", "عدل البرومبت", "اعد صياغه البرومبت", "صحح البرومبت", "برومبت افضل", "improve this prompt", "improve my prompt", "rewrite this prompt", "make this prompt better", "refine this prompt", "fix this prompt"],
    resume: ["كمل", "كملي", "استكمل", "واصل$", "واصل من", "تابع من", "تابع الشغل", "من اخر نقطه", "من مكان ما وقفت", "من حيث وقفت", "وين وقفت", "حد الاستخدام", "بعد الانقطاع", "resume from", "resume where", "resume the", "continue from", "continue where", "pick up where", "pick up the", "carry on", "where you left off", "where we left off", "usage limit",
             "where it stopped", "where i stopped", "where we stopped", "where it left off", "left off", "from where", "finish the rest", "finish the remaining", "the rest of the", "remaining batches", "restart from batch"],
    files: ["انقل", "نقل", "رتب", "ترتيب", "نظف", "تنظيف", "احذف", "حذف", "شيل", "امسح", "جمع الملفات", "جمع الصور", "فرز", "افرز", "move", "organize", "organise", "clean up", "cleanup", "delete", "remove the files", "remove duplicate", "uninstall", "declutter", "sort my", "tidy", "copy", "back up", "backup", "dedupe", "deduplicate", "archive", "consolidate", "free up space", "rename all", "rename my"],
    project: ["اضف", "ضيف", "اضيف", "نضيف", "حدث$", "حدثه$", "حدث برنامج", "حدث موقع", "حدث مشروع", "حدث تطبيق", "حدث البرنامج", "حدث برنامجي", "طور", "ميزه", "خاصيه", "اضبط", "اربط", "جهز المشروع", "عدل في", "غير الاسم", "حول", "add ", "implement", "feature", "integrate", "configure", "upgrade my", "update my", "extend", "migrate", "connect my", "hook up", "change the", "redesign", "refactor", "rename the", "replace the", "convert my", "port my", "switch my"],
    diagnose: ["خرب", "خربان", "ينهار", "انهيار", "يطفي", "طافي", "يعلق", "معلق", "يهنق", "هنق", "ما يشتغل", "مايشتغل", "ما اشتغل", "لا يعمل", "ما يفتح", "ما ينفتح", "ما تنفتح", "ما يرضى", "مايرضى", "يطلع خطا", "يعطيني خطا", "رساله خطا", "خطا$", "الخطا$", "مشكله", "شاشه زرقاء", "شاشه زرقا", "الشاشه الزرقاء", "شاشه سوداء", "شاشه سودا", "شاشه بيضاء", "يطفي لحاله", "ينطفي", "طفى", "يعيد التشغيل", "يعيد تشغيل نفسه", "يرستر", "ريستارت لحاله", "يفرمت", "صوت تكتكه", "ما يقلع", "ما يشحن", "خلل$", "عطل$", "عطلان", "معطل", "بطيء", "بطي$", "بطيئ", "ثقيل", "يقفل", "ينقفل", "كراش", "يفصل", "يقطع", "ينقطع", "انقطاع", "يسخن", "حراره عاليه", "صوت عالي", "يرمش", "يتاخر", "يحمل بطي", "ما يحمل", "ما يتصل", "ما يرد", "ما يطلع", "ما يطبع", "ما تطبع", "ما يشحن", "ما يقرا", "ما يعرف",
             "crash", "crashes", "error", "fails", "failing", "not working", "doesn't", "does not", "isn't", "won't", "cannot", "can't", "couldn't", "broken", "slow", "slower", "freeze", "freezes", "freezing", "frozen", "hangs", "lagging", "laggy", "dropping", "bug", "exception", "stutter", "lag", "drops", "disconnect", "keeps asking", "keeps crashing", "keeps restarting", "loud", "noisy", "overheat", "stopped working", "not responding", "black screen", "blue screen", "bsod",
             "throws", "throwing", "raises", "returns an error", "returns error", "error code", "exit code", "stack trace", "traceback", "failed", "denied", "refused", "rejected",
             "timeout", "timed out", "times out", "stuck", "closes by itself", "closes on its own", "shuts down", "shutting down", "restarts", "reboots", "quits", "no longer",
             "keeps", "every few minutes", "randomly", "intermittent", "drains", "draining", "not loading", "not opening", "not showing", "not detected", "isn't detected", "not recognized",
             "since the update", "since the last update", "after the update", "after updating", "after upgrading", "after installing", "after sleep", "after waking", "shows offline", "is offline", "goes offline", "says offline", "appears offline", "not printing", "printing blank", "paper jam", "not charging", "no sound", "no signal", "no internet", "can't connect", "won't connect", "won't turn on", "won't boot"],
    review: ["تاكد", "افحص", "فحص", "دقق", "تدقيق", "راجع", "مراجعه", "قيم", "تقييم", "شيك", "صحح لي", "وين الاخطاء", "وين الغلط", "check", "review", "audit", "verify", "inspect", "assess", "evaluate", "proofread", "look over", "go over", "critique", "what's wrong with", "whats wrong with", "find mistakes", "spot errors", "sanity check", "double-check", "double check"],
    research: ["قارن", "مقارنه", "ايهما افضل", "ايهما احسن", "ايهم افضل", "ايهم احسن", "وش الافضل", "وش افضل", "وش احسن", "ايش الافضل", "ايش افضل", "ايش احسن", "مين افضل", "اي افضل", "ابحث", "بحث عن", "رشح", "ترشح", "تنصحني", "انصحني", "اختار بين", "ابي اختار", "ابغى اختار", "ودي اختار", "وش اشتري", "ايش اشتري", "compare", "comparison", "versus", " vs ", "which is better", "which one", "research", "recommend", "pros and cons"],
    learn: ["اشرح", "شرح", "علمني", "فهمني", "ابغى افهم", "ابي افهم", "ودي افهم", "كاني مبتدئ", "للمبتدئين", "درسني", "اتعلم", "الفرق بين", "وش الفرق", "ايش الفرق", "كيف يشتغل", "كيف تشتغل", "وش يعني", "ايش يعني", "explain", "teach me", "help me understand", "like i'm", "eli5", "learn", "difference between", "how does", "how do", "what is a", "what are", "what does", "how it works", "walk me through", "understand how"],
    transform: ["لخص", "تلخيص", "ترجم", "ترجمه", "اعد صياغه", "صيغ", "اعد كتابه", "summarize", "summarise", "summary of", "translate", "rewrite", "paraphrase", "reword"],
    quick: ["اكتب", "سو لي", "سوي لي", "جهز لي", "رساله", "ايميل", "write", "draft", "email", "message", "list"]
  };

  var FILE_OBJECTS = ["ملف", "ملفات", "مجلد", "مجلدات", "صور", "الصور", "صوره", "فيديو", "فيديوهات", "مقاطع", "لقطات", "الحفظ", "حفظ", "التنزيلات", "التحميلات", "سطح المكتب", "المستندات", "المكرر", "مكرر", "التخزين المؤقت", "كاش", "pdf", "الاغاني", "مستندات", "فواتير", "ارشيف",
    "file", "files", "folder", "folders", "photos", "pictures", "images", "videos", "documents", "downloads", "desktop", "duplicates", "cache", "saves", "screenshots", "invoices", "backups", "archive", "music", "pdfs"];
  var CREATE_VERBS = ["اسوي", "سوي", "ابني", "ابرمج", "اصمم", "اعمل", "اكتب لي برنامج", "build", "make", "create", "develop", "code", "write a script", "program"];
  var CREATE_OBJECTS = ["لعبه", "لعبة", "موقع", "برنامج", "تطبيق", "بوت", "سكربت", "اداه", "صفحه", "اضافه", "game", "website", "site", "app", "tool", "bot", "script", "extension", "plugin", "web page", "landing page", "dashboard"];
  var EXISTING = ["مشروعي", "برنامجي", "موقعي", "تطبيقي", "مدونتي", "متجري", "لعبتي", "البوت حقي", "الموجود", "الحالي", "my app", "my site", "my website", "my project", "my bot", "my blog", "my store", "my game", "existing", "current", "my discord", "my flask", "my react", "my python", "my node", "my repo", "my code", "my shop", "my portfolio"];
  var INSTALL = ["ثبت", "نزل", "حمل التحديث", "حدث اللعبه", "install", "download and install", "reinstall", "update the game"];
  var DELIVERABLE = ["ايميل", "رساله", "مقال", "منشور", "خطاب", "تغريده", "سيره", "تقرير", "email", "message", "article", "post", "letter", "tweet", "cover letter", "report", "caption"];
  var FILLER_START = ["ابغى", "ابغي", "ابي", "ابيك", "ابغاك", "ودي", "ممكن", "لو سمحت", "من فضلك", "تكفى", "ياليت", "اريد", "أريد", "عندي", "please", "can you", "could you", "i want", "i need", "i'd like", "help me"];

  var NEG_AR = /(?:^|[\s،,.؛;:])((?:و|ف)?(?:لا\s+ت|ما\s+(?:تحذف|تعدل|تغير|تنشر|ترفع|تلمس|تقرب|تشيل|تنقل|تمسح|تثبت|تسوي|تكرر|تعيد|تستخدم|تحط)|ما\s+(?:ابغى|ابغي|ابي|أبي|أبغى|ودي|احب|أحب|ابغاه|ابيه)|ما\s+يتغير|(?:بدون|بلا|مو|مب|ليس|دون)\s)[^،,.؛;\n؟?!]*)/g;
  var NEG_EN = /(?:^|[\s,.;:])((?:don't|do not|never|without|no need to|avoid|not to|must not|shouldn't|leave\s+\S+\s+alone)[^,.;\n?!]*)/gi;

  var PROTECT_AR = /(?:لا\s+(?:تقرب|تلمس|تمس)|(?:^|\s)(?:استثن(?:ي)?|ما\s*عدا|عدا|الا|إلا)(?=\s)|خل\S*\s+(?=\S+\s+(?:على\s+حال|زي\s+ما)))\s*([^،,.؛;\n]+)/g;
  var PROTECT_EN = /(?:don't|do not)\s+(?:touch|break|change|delete|remove|modify)\s+([^,.;\n]+)|except(?:\s+for)?\s+([^,.;\n]+)|leave\s+([^,.;\n]+?)\s+(?:alone|as is|untouched)/gi;

  var READONLY = ["قراءه بس", "قراءه فقط", "للقراءه فقط", "فحص بس", "فحص فقط", "لا تحذف", "لا تعدل", "لا تغير", "لا تنشر", "بدون تعديل", "بدون حذف", "بس شوف", "لا تسوي شي", "لا تلمس", "read-only", "read only", "don't change", "do not change", "don't delete", "do not delete", "don't publish", "just check", "only check", "without changing"];
  var NO_PUBLISH = ["لا تنشر", "ما ابغى ينشر", "ما ابي ينشر", "بدون نشر", "لا ترفع", "don't publish", "do not publish", "don't push", "do not push", "no deploy"];

  var KNOWN_FOLDERS = ["سطح المكتب", "التنزيلات", "التحميلات", "المستندات", "الصور", "الفيديو", "الفيديوهات", "desktop", "downloads", "documents", "pictures", "videos", "appdata", "program files", "temp"];

  /* ---------- domains ---------- */
  var DOMAINS = {
    slides: { cues: ["عرض تقديمي", "العرض التقديمي", "عروض تقديميه", "شرائح", "شريحه", "بوربوينت", "باوربوينت", "بوربوينت", "برزنتيشن", "بريزنتيشن", "powerpoint", "slides", "slide deck", "deck", "presentation", "keynote"], ar: "عروض تقديمية", en: "Presentations" },
    social: { cues: ["منشور", "بوست", "تغريده", "ثريد", "كابشن", "ريلز", "post", "tweet", "thread", "caption", "reel"], ar: "منشورات التواصل", en: "Social posts" },
    travel: { cues: ["رحله", "سفر", "سفره", "سياحه", "اجازه", "trip", "travel", "itinerary", "vacation", "holiday"], ar: "سفر ورحلات", en: "Travel" },
    fitness: { cues: ["تمارين", "تمرين", "جيم", "لياقه", "رياضه", "workout", "exercise", "gym", "fitness", "training plan"], ar: "لياقة وتمارين", en: "Fitness" },
    events: { cues: ["حفله", "حفل", "عزيمه", "مناسبه", "زواج", "تخرج", "event", "party", "wedding", "birthday", "graduation"], ar: "مناسبات وحفلات", en: "Events" },
    recipe: { cues: ["وصفه", "طبخه", "طبخ", "اكله", "recipe", "cook", "dish"], ar: "طبخ ووصفات", en: "Cooking" },
    printer: { cues: ["طابعه", "الطابعه", "طباعه", "تطبع", "يطبع", "printer", "printing", "print"], ar: "طابعات وطباعة", en: "Printers" },
    network: { cues: ["واي فاي", "الواي فاي", "وايفاي", "النت", "الانترنت", "الراوتر", "راوتر", "شبكه", "wifi", "wi-fi", "router", "network", "internet", "vpn"], ar: "شبكة وإنترنت", en: "Network and internet" },
    audio: { cues: ["الصوت", "سماعه", "السماعات", "مايك", "المايك", "audio", "sound", "speaker", "headset", "microphone"], ar: "الصوت", en: "Audio" },
    browser: { cues: ["يوتيوب", "كروم", "المتصفح", "متصفح", "youtube", "chrome", "edge", "firefox", "browser"], ar: "المتصفح والفيديو", en: "Browser and video" },
    meal: { cues: ["وجبات", "وجبه", "دايت", "رجيم", "سعرات", "سعره", "حميه", "غذائي", "نظام اكل", "تنشيف", "meal", "diet", "calorie", "kcal", "macro", "nutrition"], ar: "تغذية وخطط وجبات", en: "Meal planning" },
    winupdate: { cues: ["تحديث ويندوز", "تحديثات ويندوز", "windows update", "kb5", "kb4", "0x8", "dism", "sfc"], ar: "تحديثات ويندوز", en: "Windows Update" },
    driver: { cues: ["تعريف", "درايفر", "nvidia", "amd", "radeon", "geforce", "driver", "gpu", "كرت الشاشه"], ar: "تعريفات وعتاد", en: "Drivers and hardware" },
    games: { cues: ["لعبه", "العاب", "ستيم", "steam", "game", "games", "launcher", "fps", "vrchat", "fivem", "gta"], ar: "ألعاب", en: "Games" },
    web: { cues: ["موقع", "الموقع", "صفحه ويب", "صفحه الموقع", "html", "css", "website", "web page", "checkout", "frontend", "react", "cloudflare", "github pages"], ar: "مواقع وويب", en: "Web" },
    code: { cues: ["كود", "سكربت", "بايثون", "برمجه", "python", "script", "code", "api", "pandas", "node", "javascript", "repo", "github", "build-", "محاكي", "emulator"], ar: "برمجة وبرامج", en: "Software" },
    data: { cues: ["بيانات", "اكسل", "csv", "excel", "spreadsheet", "dataset", "data"], ar: "بيانات وتحليل", en: "Data" },
    files: { cues: ["ملفات", "ملف", "مجلد", "صور", "لقطات", "مساحه", "files", "folder", "photos", "screenshots", "disk space"], ar: "ملفات وتخزين", en: "Files and storage" },
    career: { cues: ["سيره", "سيرتي", "مقابله", "وظيفه", "لوظيفه", "خطاب تقديم", "خطاب التقديم", "cv", "resume for", "my resume", "cover letter", "interview", "linkedin", "data analyst role", "new job"], ar: "وظائف وسيرة ذاتية", en: "Career" },
    study: { cues: ["مذاكره", "اختبار", "دراسه", "طالب", "منهج", "خطه دراسيه", "study", "exam", "student", "course", "revision plan"], ar: "دراسة وتعلم", en: "Study" },
    writing: { cues: ["مقال", "ايميل", "رساله", "بريد", "قصه", "منشور", "تقرير", "report", "article", "email", "letter", "post", "essay", "blog"], ar: "كتابة", en: "Writing" },
    shopping: { cues: ["لابتوب", "جوال", "شاشه", "سماعه", "laptop", "phone", "monitor", "headphones", "buy"], ar: "مشتريات ومقارنات", en: "Buying and comparing" },
    knowledge: { cues: ["المعرفه", "مصادر", "تغطيه", "knowledge base", "sources", "coverage"], ar: "معرفة ومصادر", en: "Knowledge and sources" }
  };
  var DOMAIN_ORDER = ["meal", "slides", "winupdate", "printer", "network", "audio", "browser", "driver", "career", "web", "games", "code", "data", "files", "study", "travel", "fitness", "events", "recipe", "knowledge", "social", "writing", "shopping"];

  /* ---------- literal extraction (exact text kept) ---------- */
  var STOP_EN = { and: 1, then: 1, to: 1, from: 1, with: 1, on: 1, in: 1, for: 1, but: 1, or: 1, using: 1, using: 1, "don't": 1, dont: 1, is: 1, are: 1, the: 1, a: 1, an: 1, into: 1, as: 1, at: 1, by: 1, of: 1, it: 1, that: 1, which: 1, where: 1 };
  var EXT = "html?|css|js|mjs|ts|tsx|jsx|py|json|txt|md|exe|bat|cmd|ps1|csv|xlsx?|docx?|pdf|zip|7z|rar|png|jpe?g|gif|webp|mp4|mkv|mov|log|ini|cfg|ya?ml|xml|sql|java|cs|cpp|h|go|rs|rb|php|apk|msi|iso|dll|sys|db|sqlite";

  function addLit(list, type, value, idx) {
    if (type !== "name" && type !== "number" && idx != null) (list.spans || (list.spans = [])).push([idx, idx + value.length + 2]);
    value = value.replace(/^[\s"'“”«»`]+|[\s"'“”«»`]+$/g, "");
    if (!value) return;
    for (var i = 0; i < list.length; i++) {
      var v = list[i].value;
      if (v === value) return;
      var ve = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (v.indexOf(value) !== -1 && new RegExp("(^|[^A-Za-z0-9])" + ve + "($|[^A-Za-z0-9])").test(v) && list[i].type !== "name" && !(type === "name" && list[i].type === "path")) return;   // already inside a longer literal
    }
    for (var j = list.length - 1; j >= 0; j--) {
      var lv = list[j].value;
      if (lv === value || !/^(name|version|number)$/.test(list[j].type) || type === "quote" || (type === "number" && list[j].type !== "number")) continue;
      var esc = lv.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp("(^|[^A-Za-z0-9])" + esc + "($|[^A-Za-z0-9])").test(value)) list.splice(j, 1);
    }
    list.push({ type: type, value: value, at: idx, len: value.length });
  }

  // Arabic words that end a path written inside an Arabic sentence ("D:\Archive\تقارير 2026 وخل 3 نسخ")
  var STOP_AR_PATH = /^(?:و\S*|من|في|الى|إلى|على|عن|عشان|علشان|لين|بس|ثم|بعدين|مع|حق|حقت|اللي|الي|خل|خله|خلها|لمجلد|للمجلد|لمسار|بدل|مو|لا|او|أو|ثاني|كامل|كاملة|كلها|كله)$/;
  function extractPaths(text, out) {
    // a path segment may contain Arabic letters (folder names like D:\Archive\تقارير); spaces are handled below
    var re = /(?:[A-Za-z]:\\|\\\\[A-Za-z0-9_.\-]+\\)[^\s،,;"'«»<>|?*()\[\]{}]*/g, m;
    while ((m = re.exec(text))) {
      var val = m[0], extra = 0, stop = false;
      var colon = /^(.{3,}?):(?=$)/.exec(val);           // "C:\dev\notes: add login" -> C:\dev\notes
      if (colon) { val = colon[1]; stop = true; }
      var end = m.index + val.length;
      // continue across spaces for names like "Atlas v2" or "تقارير 2026" (max 3 tokens, no stop words).
      // Arabic tokens are taken only when the last path segment is itself Arabic, so
      // "C:\Sites\store زر واتساب" stays C:\Sites\store.
      var rest = text.slice(end), mm;
      while (!stop && extra < 3 && (mm = /^ ([A-Za-z0-9_.\-]+|[\u0600-\u06FF][\u0600-\u06FF0-9_.\-]*)(?=$|[\s،,;.]|\\)/.exec(rest))) {
        var tok = mm[1], lastSeg = val.slice(val.lastIndexOf("\\") + 1);
        var arTok = /[\u0600-\u06FF]/.test(tok), arSeg = /[\u0600-\u06FF]/.test(lastSeg);
        if (arTok && (!arSeg || STOP_AR_PATH.test(tok))) break;
        if (!arTok && (STOP_EN[tok.toLowerCase()] || /^[a-z]+$/.test(tok) && !/\d/.test(tok))) break;
        val += " " + tok; rest = rest.slice(mm[0].length); extra++;
        var tail = /^\\[^\s،,;"'«»<>|?*]*/.exec(rest);
        if (tail) { val += tail[0]; rest = rest.slice(tail[0].length); }
      }
      val = val.replace(/[.\\]+$/, function (x) { return x === "\\" ? "" : ""; });
      addLit(out, "path", val, m.index);
      re.lastIndex = m.index + val.length;
    }
  }

  function inSpan(list, i) {
    var sp = list.spans || [];
    for (var k = 0; k < sp.length; k++) if (i >= sp[k][0] && i < sp[k][1]) return true;
    return false;
  }
  function extractLiterals(text) {
    var out = [], m, re;
    text = String(text || "");
    // quoted text
    re = /«([^»]{1,200})»|“([^”]{1,200})”|"([^"\n]{1,200})"|`([^`\n]{1,200})`/g;
    while ((m = re.exec(text))) addLit(out, "quote", m[1] || m[2] || m[3] || m[4], m.index);
    re = /(?:^|[\s(:])'([^'\n]{3,80})'(?=[\s.,;:!?)]|$)/g;
    while ((m = re.exec(text))) addLit(out, "quote", m[1], m.index + m[0].indexOf(m[1]));
    re = /\bE(?:ADDRINUSE|ADDRNOTAVAIL|CONNREFUSED|CONNRESET|CONNABORTED|TIMEDOUT|ACCES|PERM|NOENT|EXIST|ISDIR|NOTDIR|NOTEMPTY|MFILE|NOSPC|PIPE|AI_AGAIN|NOTFOUND|HOSTUNREACH|NETUNREACH|BUSY|INVAL|ROFS)\b/g;
    while ((m = re.exec(text))) addLit(out, "code", m[0], m.index);
    re = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;
    while ((m = re.exec(text))) addLit(out, "code", m[0], m.index);
    // URLs
    re = /\bhttps?:\/\/[^\s<>"'«»،]+/gi;
    while ((m = re.exec(text))) addLit(out, "url", m[0].replace(/[.,)]+$/, ""), m.index);
    extractPaths(text, out);
    // commands
    re = /\b(?:sfc\s*\/scannow|DISM(?:\.exe)?(?:\s+\/[A-Za-z\-]+(?::\S+)?)*|chkdsk(?:\s+[A-Z]:)?(?:\s+\/\w)*|winget\s+\w+(?:\s+[\w.\-]+)?|pip\s+install\s+[\w.\-=]+|npm\s+(?:run\s+)?\w+|git\s+(?:status|pull|push|log|diff|commit|clone|checkout)\b|wsreset|ipconfig\s*\/\w+)/gi;
    while ((m = re.exec(text))) addLit(out, "command", m[0].trim(), m.index);
    // KB numbers, hex/error codes, exception names
    re = /\bKB\d{5,8}\b/gi; while ((m = re.exec(text))) addLit(out, "kb", m[0], m.index);
    re = /\b0x[0-9A-Fa-f]{4,8}\b/g; while ((m = re.exec(text))) addLit(out, "code", m[0], m.index);
    re = /\b[A-Z][A-Za-z]+(?:Error|Exception)\b/g; while ((m = re.exec(text))) addLit(out, "code", m[0], m.index);
    // file names with extensions
    re = new RegExp("(?:^|[^\\\\/\\w])([\\w\\-.]+\\.(?:" + EXT + "))\\b", "gi");
    while ((m = re.exec(text))) addLit(out, "file", m[1], m.index);
    // model names kept as one unit: RTX 3060 Ti, Windows 11 24H2, Chrome 131, iPhone 11, Galaxy S24 Ultra
    re = /\b(?:[A-Z]{2,}\s+)?(?:i[A-Z][a-z]+|[A-Z][A-Za-z]*[A-Z0-9][A-Za-z0-9]*|[A-Z][a-z]+)(?:[ \-](?:\d+[A-Za-z]{0,3}\d*|[A-Z]{1,3}\d+[A-Za-z]?|\d{2}H\d|Ti|Super|Pro|Max|Ultra|Plus|Mini|Lite|SE|XL|FE))+\b/g;
    while ((m = re.exec(text))) {
      if (inSpan(out, m.index) || !/\d/.test(m[0])) continue;
      if (/^(?:KB|Windows Update)\b/.test(m[0])) continue;
      addLit(out, "model", m[0], m.index);
    }
    re = /\b\d{2}H\d\b/g; while ((m = re.exec(text))) addLit(out, "version", m[0], m.index);
    re = /(?:ويندوز|وندوز|آيفون|ايفون|أيفون|جالكسي|قالكسي|بلايستيشن|بلاستيشن|اكس بوكس|ماك بوك|آيباد|ايباد)\s+[A-Za-z]{0,3}\d+[A-Za-z]{0,3}(?:\s+(?:برو|ماكس|الترا|بلس|Pro|Max|Ultra|Plus))?/g;
    while ((m = re.exec(text))) addLit(out, "model", m[0], m.index);
    // versions and builds
    re = /\b(?:[A-Za-z][\w+.\-]*\s+)?v?\d+(?:\.\d+){1,3}\b|\bbuild[-_ ]?\d+\b/gi;
    while ((m = re.exec(text))) {
      var v = m[0];
      if (/^[A-Za-z]/.test(v) && !/^v?\d/i.test(v)) {
        var parts = v.split(/\s+/);
        if (parts.length === 2 && STOP_EN[parts[0].toLowerCase()]) v = parts[1];
      }
      if (out.some(function (x) { return x.type === "model" && x.value.indexOf(v) !== -1; })) continue;
      addLit(out, "version", v, m.index);
    }
    re = /\b(?:Windows|Python|Node(?:\.js)?|Java|iOS|Android|macOS|Office|Excel|Ubuntu|PHP|\.NET)\s+\d+(?:\.\d+)*\b/g;
    while ((m = re.exec(text))) { if (!out.some(function (x) { return x.type === "model" && x.value.indexOf(m[0]) !== -1; })) addLit(out, "version", m[0], m.index); }
    re = /\b\d+-(?:day|week|month|hour|minute|word|page|step|year)s?\b|\b\d{3,4}p\b|\b\d+\s?(?:fps|Hz|GHz|MHz|mAh|W)\b/gi;
    while ((m = re.exec(text))) addLit(out, "number", m[0], m.index);
    // numbers with units
    re = /\d+(?:[.,]\d+)?\s?(?:GB|MB|KB|TB|جيجا|قيقا|ميجا|ميقا|ريال|ر\.س|SAR|USD|\$|دولار|سعرة|سعره|سعرات|كالوري|kcal|calories|كيلو|كجم|kg|غرام|جرام|g\b|كلمة|كلمه|words?|دقيقة|دقيقه|دقائق|minutes?|mins?|ساعة|ساعه|ساعات|hours?|يوم|أيام|ايام|days?|أسبوع|اسبوع|weeks?|شهر|أشهر|months?|سنة|سنه|سنوات|years?|%|٪|ملف|files?|صورة|صور|images?)/gi;
    while ((m = re.exec(text))) addLit(out, "number", m[0].trim(), m.index);
    // every other number the user gave (progress like 40 من 120, counts, prices)
    re = /(?:^|[^\w\\.\-])([0-9\u0660-\u0669]+(?:[.,][0-9]+)?%?)(?![\w.\-])/g;
    while ((m = re.exec(text))) {
      var ni = m.index + m[0].indexOf(m[1]);
      if (inSpan(out, ni)) continue;
      if (out.some(function (x) { return x.at != null && ni >= x.at && ni < x.at + x.len; })) continue;
      addLit(out, "number", m[1], ni);
    }
    // Latin product / proper names inside Arabic text, and capitalised names in English text
    var arabicShare = (text.match(/[\u0600-\u06FF]/g) || []).length / Math.max(1, text.replace(/\s/g, "").length);
    if (arabicShare > 0.25) {
      re = /[A-Za-z][A-Za-z0-9+#.\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9+#.\-]*)*/g;
      while ((m = re.exec(text))) {
        if (inSpan(out, m.index)) continue;
        var name = m[0].replace(/[.\-]+$/, "");
        if (name.length < 2 && !/^[A-Z]$/.test(name)) continue;
        if (/^(?:https?|www)$/i.test(name)) continue;
        addLit(out, "name", name, m.index);
      }
    } else {
      re = /\b(?:[A-Z][a-zA-Z0-9+#]*(?:[ \-][A-Z][a-zA-Z0-9+#]*)*(?:\s+\d{1,4}[A-Za-z]?\b(?![.,]\d))?|[A-Z]{2,}[a-z]?)\b|\b[a-z]+\.py\b/g;
      while ((m = re.exec(text))) {
        if (inSpan(out, m.index)) continue;
        if (m.index === 0 || /[.!?]\s*$/.test(text.slice(0, m.index))) {
          if (!/^[A-Z]{2,}/.test(m[0])) {                       // "My HP LaserJet": drop only the capitalised first word
            var restRun = m[0].replace(/^\S+\s+/, "");
            if (restRun === m[0] || !/^[A-Z]/.test(restRun)) continue;
            m = { 0: restRun, index: m.index + m[0].length - restRun.length };
          }
        }
        var nm = m[0].replace(/^(?:GB|MB|KB|TB|AM|PM)\s*/, "");
        if (!nm || /^(I|My|The|A|An|Add|Write|Review|Make|Fix|Please|GB|MB|KB|TB)$/.test(nm)) continue;
        addLit(out, "name", nm, m.index);
      }
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out.map(function (x) { return { type: x.type, value: x.value }; });
  }

  root.MPZLex = {
    normAr: normAr, tokens: tokens, hasCue: hasCue, countCues: countCues, cueRe: cueRe,
    CUES: CUES, FILLER_START: FILLER_START, NEG_AR: NEG_AR, NEG_EN: NEG_EN, PROTECT_AR: PROTECT_AR, PROTECT_EN: PROTECT_EN,
    READONLY: READONLY, NO_PUBLISH: NO_PUBLISH, FILE_OBJECTS: FILE_OBJECTS, CREATE_VERBS: CREATE_VERBS, CREATE_OBJECTS: CREATE_OBJECTS, EXISTING: EXISTING, INSTALL: INSTALL, DELIVERABLE: DELIVERABLE, KNOWN_FOLDERS: KNOWN_FOLDERS, DOMAINS: DOMAINS, DOMAIN_ORDER: DOMAIN_ORDER,
    extractLiterals: extractLiterals
  };
})(typeof window !== "undefined" ? window : this);
