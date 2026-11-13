/* SuperPrompt landing page: Arabic / English text, theme, and the demo video in the visitor's language.
   Language and theme use the same keys as the generator (mpz-ui-lang, mpz-theme), so both pages agree. */
(function () {
  "use strict";
  var T = {
    "skip": ["Skip to content", "انتقل إلى المحتوى"],
    "nav.aria": ["Main", "التنقل الرئيسي"],
    "nav.about": ["About", "عن التطبيق"], "nav.video": ["Watch", "شاهد"], "nav.download": ["Download", "التحميل"], "nav.support": ["Support", "ادعم"],
    "theme.aria": ["Switch light or dark theme", "تبديل الوضع الفاتح والداكن"],
    "cta.open": ["Open SuperPrompt", "افتح SuperPrompt"],
    "logo.alt": ["SuperPrompt logo", "شعار SuperPrompt"],
    "hero.eyebrow": ["OFFLINE PROMPT BUILDER / ARABIC + ENGLISH", "مولّد برومبتات بدون إنترنت / عربي وإنجليزي"],
    "hero.h1": ["Your idea\nA clear prompt", "فكرتك\nبرومبت واضح"],
    "hero.p": ["Write what you need in your own words. SuperPrompt turns it into a structured prompt you can edit, copy and paste into any AI assistant",
               "اكتب اللي تبغاه بكلامك، وSuperPrompt يحوّله إلى برومبت منظّم تقدر تعدّله وتنسخه وتلصقه في أي مساعد ذكاء اصطناعي"],
    "btn.web": ["Use in Browser", "استخدم في المتصفح"], "btn.win": ["Download for Windows", "تحميل لويندوز"],
    "btn.watch": ["See it in action", "شاهد كيف يعمل"],
    "hero.meta": ["v{v} · Windows 10 and 11, x64 · Portable ZIP · {size}", "الإصدار {v} · ويندوز 10 و11 بنظام x64 · ملف ZIP محمول · {size}"],
    "trust.1": ["No account", "بدون حساب"], "trust.2": ["No subscription", "بدون اشتراك"], "trust.3": ["Works offline", "يشتغل بدون إنترنت"], "trust.4": ["Arabic and English", "عربي وإنجليزي"],
    "shot.alt": ["The SuperPrompt generator with a request and its structured prompt", "مولّد SuperPrompt مع طلب والبرومبت المنظّم الناتج عنه"],
    "about.k": ["01 / WHAT IT DOES", "01 / وش يسوي"],
    "about.h": ["Your words in\nA ready prompt out", "تكتب بكلامك\nوتاخذ برومبت جاهز"],
    "about.p": ["SuperPrompt reads your request, picks the right approach and writes a prompt with a goal, steps, limits and a check. Everything runs on your device",
                "SuperPrompt يقرأ طلبك، ويختار الأسلوب المناسب، ويكتب برومبت فيه الهدف والخطوات والحدود وطريقة التحقق، وكل هذا يشتغل على جهازك"],
    "c1.h": ["Understands what you mean", "يفهم وش تقصد"],
    "c1.p": ["Saudi dialect, formal Arabic or English. Ten modes plus Auto, and three detail levels", "باللهجة السعودية أو الفصحى أو الإنجليزي، مع 10 أنماط والتلقائي، وثلاث مستويات تفصيل"],
    "c2.h": ["Keeps the details exact", "يحافظ على التفاصيل"],
    "c2.p": ["Paths, versions, error codes and names stay exactly as you wrote them", "المسارات والإصدارات وأكواد الأخطاء والأسماء تبقى مثل ما كتبتها"],
    "c3.h": ["Ready for any assistant", "جاهز لأي مساعد"],
    "c3.p": ["Edit the result, copy it and paste it into Claude, ChatGPT, Gemini, Copilot or Codex", "عدّل النتيجة وانسخها والصقها في Claude أو ChatGPT أو Gemini أو Copilot أو Codex"],
    "video.k": ["02 / SEE THE FLOW", "02 / شاهد الطريقة"],
    "video.h": ["One request\nOne clear prompt", "طلب واحد\nوبرومبت واضح"],
    "video.p": ["Write a request, choose the format and detail level, generate and copy", "اكتب طلبك، اختر الصيغة ومستوى التفصيل، ولّد البرومبت وانسخه"],
    "ways.k": ["03 / BROWSER OR WINDOWS", "03 / المتصفح أو ويندوز"],
    "ways.h": ["Two ways\nThe same engine", "طريقتين\nونفس المحرك"],
    "w1.h": ["In the browser", "في المتصفح"],
    "w1.p": ["Open it and start right away on a computer or a phone. Nothing to install, and your prompts stay in that browser", "افتحه وابدأ على طول من الكمبيوتر أو الجوال، بدون تثبيت، وبرومبتاتك تبقى في نفس المتصفح"],
    "w1.a": ["Open SuperPrompt", "افتح SuperPrompt"],
    "w2.h": ["On Windows", "على ويندوز"],
    "w2.p": ["Its own window that works fully offline. Your prompts stay on your PC", "نافذة مستقلة تشتغل كامل بدون إنترنت، وبرومبتاتك تبقى على جهازك"],
    "w2.a": ["Download for Windows", "تحميل لويندوز"],
    "mv.h": ["Move your history between them", "انقل سجلك بينهم"],
    "mv.1": ["Open History and choose Export", "افتح السجل واختر تصدير"],
    "mv.2": ["In the other copy, choose Import and pick the file", "في النسخة الثانية اختر استيراد وحدد الملف"],
    "mv.3": ["Your prompts are merged. Nothing is replaced", "تندمج برومبتاتك بدون ما يُستبدل أي شي"],
    "dl.k": ["04 / DOWNLOAD", "04 / التحميل"],
    "dl.h": ["Your prompts\nOn your desktop", "برومبتاتك\nعلى سطح المكتب"],
    "dl.gh": ["GitHub Release", "صفحة الإصدار على GitHub"],
    "dl.s1": ["Download the ZIP", "نزّل ملف ZIP"], "dl.s2": ["Unzip it", "فك الضغط"], "dl.s3": ["Open SuperPrompt.exe", "افتح SuperPrompt.exe"],
    "dl.note": ["Windows 10 and 11, 64-bit. No installation. The file is not code-signed, so Windows SmartScreen may ask once: More info, then Run anyway",
                "ويندوز 10 و11 بنظام 64 بت، بدون تثبيت. الملف غير موقّع رقميًا، فممكن يطلب Windows SmartScreen تأكيد مرة وحدة: More info ثم Run anyway"],
    "sup.k": ["05 / SUPPORT", "05 / الدعم"],
    "sup.h": ["Support the Project", "ادعم المشروع"],
    "sup.p": ["If SuperPrompt saves you time and you'd like to help it keep growing, you can support it here", "إذا SuperPrompt وفّر عليك وقت وحاب تدعم استمراره وتطويره، تقدر تدعمه من هنا"],
    "sup.btn": ["Support the Project", "ادعم المشروع"],
    "sup.x": ["Contact on X", "تواصل على X"],
    "sup.small": ["Always optional, always appreciated", "دعمك اختياري، وتقديره كبير"],
    "faq.k": ["GOOD TO KNOW", "قبل ما تبدأ"], "faq.h": ["Quick answers", "إجابات سريعة"],
    "q1": ["Is it free?", "هل هو مجاني؟"], "a1": ["Yes. No account and no subscription", "إي، بدون حساب ولا اشتراك"],
    "q2": ["Does it send what I type anywhere?", "هل يرسل اللي أكتبه لأي مكان؟"], "a2": ["No. The engine runs on your device, with no AI calls and no analytics", "لا. المحرك يشتغل على جهازك، بدون ذكاء اصطناعي سحابي ولا أدوات تحليل"],
    "q3": ["Does it work on a Mac or a phone?", "يشتغل على ماك أو الجوال؟"], "a3": ["Yes, in the browser. The download is for Windows only", "إي من المتصفح، والتحميل لويندوز فقط"],
    "q4": ["Where is my history saved?", "وين ينحفظ سجلي؟"],
    "a4": ["On the website, in the browser you use. In the Windows app, in %LOCALAPPDATA%\\SuperPrompt on your PC", "في الموقع داخل المتصفح اللي تستخدمه، وفي برنامج ويندوز داخل %LOCALAPPDATA%\\SuperPrompt على جهازك"],
    "foot.aria": ["Footer", "روابط التذييل"], "foot.tag": ["Your idea. A clear prompt", "فكرتك برومبت واضح"],
    "foot.app": ["Open the generator", "افتح المولّد"], "foot.download": ["Download", "تحميل"], "foot.support": ["Support ↗", "دعم ↗"], "foot.license": ["MIT License", "ترخيص MIT"]
  };
  var doc = document.documentElement, body = document.body;
  var vars = { v: body.getAttribute("data-version"), size: body.getAttribute("data-size") };
  // Latin words, versions and paths inside Arabic sentences are wrapped in invisible isolates so they keep their order
  var LATIN = /[A-Za-z0-9%@][A-Za-z0-9_.:\\/%@+\- ]*[A-Za-z0-9%]|[A-Za-z0-9]/g;   // spaces stay inside a run: "921 KB", "More info"
  function text(key, lang) {
    var s = (T[key] || ["", ""])[lang === "ar" ? 1 : 0].replace(/\{(\w+)\}/g, function (m, k) { return vars[k] || ""; });
    return lang === "ar" ? s.replace(LATIN, function (w) { return "⁦" + w + "⁩"; }) : s;
  }
  function fill(el, s, isH1) {
    var lines = s.split("\n"); el.textContent = "";
    lines.forEach(function (ln, i) {
      if (i) el.appendChild(document.createElement("br"));
      if (isH1 && i === lines.length - 1 && lines.length > 1) { var em = document.createElement("em"); em.textContent = ln; el.appendChild(em); }
      else el.appendChild(document.createTextNode(ln));
    });
  }
  function fmtDur(sec) { sec = Math.round(+sec || 0); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function apply(lang) {
    lang = lang === "ar" ? "ar" : "en";
    doc.lang = lang; doc.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach(function (el) { fill(el, text(el.getAttribute("data-t"), lang), el.tagName === "H1"); });
    document.querySelectorAll("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", text(el.getAttribute("data-t-aria"), lang)); });
    document.querySelectorAll("[data-t-alt]").forEach(function (el) { el.setAttribute("alt", text(el.getAttribute("data-t-alt"), lang)); });
    document.title = lang === "ar" ? "SuperPrompt | فكرتك برومبت واضح" : "SuperPrompt | Your idea. A clear prompt";
    var lb = document.getElementById("lang-btn"); lb.textContent = lang === "ar" ? "English" : "العربية"; lb.lang = lang === "ar" ? "en" : "ar";
    lb.setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
    // screenshot and video recorded with the interface in the same language
    document.getElementById("hero-shot").src = "assets/img/app-" + lang + ".jpg";
    var sec = body.getAttribute("data-video-" + lang); document.getElementById("hero-dur").textContent = fmtDur(sec);
    document.getElementById("video-tag").textContent = lang === "ar" ? Math.round(sec) + " ثانية / MP4" : Math.round(sec) + " SEC / MP4";
    // video in the page language: src/poster are set here (never preloaded: preload="none" and no load() call)
    var v = document.getElementById("demo");
    if (v.getAttribute("data-lang") !== lang) {
      var playing = !v.paused; v.setAttribute("data-lang", lang);
      v.setAttribute("poster", "assets/video/poster-" + lang + ".jpg");
      v.setAttribute("src", "assets/video/superprompt-demo-" + lang + ".mp4");
      if (playing) v.play().catch(function () {});
    }
    // no subtitle overlay: the recorded interface already shows its own text
    try { localStorage.setItem("mpz-ui-lang", lang); } catch (e) {}
  }
  document.getElementById("lang-btn").addEventListener("click", function () { apply(doc.lang === "ar" ? "en" : "ar"); });
  document.getElementById("theme-btn").addEventListener("click", function () {
    var t = doc.getAttribute("data-theme") === "dark" ? "light" : "dark"; doc.setAttribute("data-theme", t);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#0a0b1e" : "#f7f6fd");
    try { localStorage.setItem("mpz-theme", t); } catch (e) {}
  });
  document.getElementById("demo").addEventListener("loadedmetadata", function () { apply(doc.lang); });
  // the "See it in action" link also starts the video (muted autoplay is never used; the video has no sound)
  document.querySelector(".watch").addEventListener("click", function () { var v = document.getElementById("demo"); setTimeout(function () { v.play().catch(function () {}); }, 450); });
  apply(doc.lang);
})();
