// Records the SuperPrompt walkthrough video from the real generator (app\), frame by frame, in headless Chrome.
// Each frame is a screenshot taken after a scripted step, so the video plays at an exact, even pace.
// A drawn cursor shows where each click happens. Output per language (ar / en):
//   out\frames-<lang>\00001.jpg ...   out\superprompt-demo-<lang>.mp4   out\poster-<lang>.jpg   out\hero-<lang>.jpg
//   out\captions-<lang>.json (cue times in seconds)
// Usage: node record-demo.js <ffmpeg.exe> [ar|en|both]
"use strict";
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), path = require("path"), http = require("http");
const FFMPEG = process.argv[2];
const LANGS = (process.argv[3] || "both") === "both" ? ["en", "ar"] : [process.argv[3]];
const ROOT = path.resolve(__dirname, "..", "..", "app");
const OUT = path.join(__dirname, "out"); fs.mkdirSync(OUT, { recursive: true });
const FPS = 24, CSS_W = 1152, CSS_H = 648, DPR = 1920 / 1152;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const BRAND = path.resolve(__dirname, "..", "brand", "v3");
  const f = p.startsWith("/__brand/") ? path.join(BRAND, p.slice(9)) : path.join(ROOT, p);
  if (!(f.startsWith(ROOT) || f.startsWith(BRAND)) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(8790, "127.0.0.1");
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));

const TEXT = {
  en: { goal: "Plan a 3-day family trip to AlUla in March, budget 6,000 SAR, with easy activities for the kids",
    cues: ["Write what you need in your own words", "Choose the detail level and the format", "Generate a clear prompt", "Read it and edit it if you like", "Copy it into any AI assistant", "Use it in the browser or download it for Windows"],
    end: { web: "Use in Browser", win: "Download for Windows", tag: "Your idea. A clear prompt." } },
  ar: { goal: "خطة رحلة عائلية للعلا 3 أيام في مارس، الميزانية 6000 ريال، مع أنشطة سهلة للأطفال",
    cues: ["اكتب اللي تبغاه بكلامك", "اختر مستوى التفصيل والصيغة", "ولّد برومبت واضح", "اقرأه وعدّله إذا حبيت", "انسخه والصقه في أي مساعد ذكاء اصطناعي", "استخدمه في المتصفح أو نزّله لويندوز"],
    end: { web: "استخدم في المتصفح", win: "تحميل لويندوز", tag: "فكرتك برومبت واضح" } }
};
// both captions files share the same cue times, taken from the English run
const CUE_TEXT = { en: TEXT.en.cues, ar: TEXT.ar.cues };

async function record(lang, port) {
  const dir = path.join(OUT, "frames-" + lang); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const prof = path.join(OUT, "profile-" + lang); fs.rmSync(prof, { recursive: true, force: true });
  const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });
  let t; for (let i = 0; i < 40; i++) { try { t = await getJSON(`http://127.0.0.1:${port}/json`); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async x => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: CSS_W, height: CSS_H, deviceScaleFactor: DPR, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:8790/" }); await sleep(1200);
  await ev(`localStorage.clear(); localStorage.setItem('mpz-ui-lang','${lang}'); localStorage.setItem('mpz-out-lang','${lang}'); localStorage.setItem('mpz-theme','dark'); true`);
  await send("Page.reload"); await sleep(1600);
  // cursor + click ring + end card, drawn above the page
  await ev(`(()=>{ const s=document.createElement('style'); s.textContent=\`
    #vc{position:fixed;left:0;top:0;width:30px;height:30px;z-index:99999;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))}
    #vr{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #8b5cf6;z-index:99998;pointer-events:none;opacity:0}
    #ve{position:fixed;inset:0;z-index:99997;display:grid;place-items:center;opacity:0;pointer-events:none;
        background:radial-gradient(ellipse at 30% 40%,rgba(124,58,237,.35),transparent 60%),radial-gradient(ellipse at 75% 70%,rgba(37,99,235,.3),transparent 60%),#070918;color:#f5f3ff;font-family:inherit}
    #ve .in{display:grid;justify-items:center;gap:22px;text-align:center}
    #ve img{width:150px;height:150px;filter:drop-shadow(0 0 24px rgba(59,130,246,.45))}
    #ve .nm{font-size:54px;font-weight:800;letter-spacing:-1px;direction:ltr}#ve .nm b{background:linear-gradient(90deg,#8b5cf6,#3b82f6);-webkit-background-clip:text;color:transparent}
    #ve .tg{font-size:24px;color:#c7c9ea;margin-top:-10px}
    #ve .bt{display:flex;gap:16px;margin-top:8px}#ve .bt span{padding:14px 26px;border-radius:14px;font-size:21px;font-weight:700}
    #ve .b1{background:linear-gradient(135deg,#7c3aed,#2563eb)}#ve .b2{border:1.5px solid rgba(196,181,253,.55);background:rgba(255,255,255,.04)}
    #ve .url{font-size:19px;color:#a5b4fc;direction:ltr;letter-spacing:.3px}\`; document.head.appendChild(s);
    const c=document.createElement('div'); c.id='vc'; c.innerHTML='<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11-6.6.9 3.9 7.3-2.6 1.4-3.9-7.4L4 20z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>'; document.body.appendChild(c);
    const r=document.createElement('div'); r.id='vr'; document.body.appendChild(r);
    const e=document.createElement('div'); e.id='ve'; e.innerHTML='<div class="in"><img src="/__brand/logo-512.png" alt=""><div class="nm">Super<b>Prompt</b></div><div class="tg">${TEXT[lang].end.tag}</div><div class="bt"><span class="b1">${TEXT[lang].end.web}</span><span class="b2">${TEXT[lang].end.win}</span></div><div class="url">superprompt.pages.dev</div></div>'; document.body.appendChild(e);
    window.__cur={x:${CSS_W * 0.62},y:${CSS_H * 0.7}}; const m=()=>{c.style.left=__cur.x+'px';c.style.top=__cur.y+'px'}; window.__mv=m; m(); return true; })()`);
  let frame = 0;
  const shot = async (n = 1) => { const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 90 }); const b = Buffer.from(s.result.data, "base64");
    for (let k = 0; k < n; k++) fs.writeFileSync(path.join(dir, String(++frame).padStart(5, "0") + ".jpg"), b); };
  const hold = s => shot(Math.round(s * FPS));
  const center = async sel => ev(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()`);
  const moveTo = async (sel, secs = 0.7) => { const [tx, ty] = await center(sel); const [sx, sy] = await ev(`[__cur.x,__cur.y]`); const n = Math.round(secs * FPS);
    for (let i = 1; i <= n; i++) { const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await ev(`__cur.x=${sx + (tx - sx) * e};__cur.y=${sy + (ty - sy) * e};__mv();true`); await shot(); } };
  const click = async (sel, js) => { await ev(`(()=>{const r=document.getElementById('vr'); r.style.left=__cur.x+'px'; r.style.top=__cur.y+'px'; r.style.opacity=1; r.style.transform='scale(.6)'; return true})()`); await shot(2);
    await ev(js || `document.querySelector(${JSON.stringify(sel)}).click(); true`);
    for (let i = 0; i < 6; i++) { await ev(`(()=>{const r=document.getElementById('vr'); r.style.transform='scale(${0.6 + i * 0.12})'; r.style.opacity=${1 - i / 6}; return true})()`); await shot(); }
    await ev(`document.getElementById('vr').style.opacity=0; true`); };
  const cues = []; const cue = i => cues.push([i, frame / FPS]);
  // 1) the request
  cue(0); await hold(1.0); await moveTo("#goal", 0.8); await click("#goal", `document.getElementById('goal').focus(); true`);
  const goal = TEXT[lang].goal; const per = Math.max(1, Math.round(goal.length / (3.2 * FPS)));
  for (let i = per; i < goal.length + per; i += per) { await send("Input.insertText", { text: goal.slice(i - per, Math.min(i, goal.length)) }); await shot(); }
  await hold(0.8);
  // 2) detail level and format
  cue(1); await moveTo('input[name="level"][value="detailed"] + span', 0.7); await click(null, `document.querySelector('input[name="level"][value="detailed"]').click(); true`); await hold(0.6);
  await moveTo("#adv-fold > summary", 0.7); await click(null, `document.getElementById('adv-fold').open=true; true`); await hold(0.6);
  await moveTo('input[name="format"][value="steps"] + span', 0.7); await click(null, `document.querySelector('input[name="format"][value="steps"]').click(); true`); await hold(0.9);
  // 3) generate
  cue(2); await moveTo("#gen-btn", 0.8); await click("#gen-btn"); await hold(1.2);
  // 4) read and scroll the result
  cue(3); const poster = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 }); fs.writeFileSync(path.join(OUT, `poster-${lang}.jpg`), Buffer.from(poster.result.data, "base64"));
  await moveTo("#result-view", 0.7);
  const maxScroll = await ev(`(()=>{const v=document.getElementById('result-view'); return Math.max(0, v.scrollHeight - v.clientHeight)})()`);
  const sn = Math.round(3.2 * FPS); for (let i = 1; i <= sn; i++) { await ev(`document.getElementById('result-view').scrollTop=${Math.round(maxScroll * Math.min(1, i / sn) * 0.6)};true`); await shot(); }
  await hold(0.6);
  // 5) copy
  cue(4); await moveTo("#copy-btn", 0.8); await click("#copy-btn"); await hold(1.6);
  // hero still for the landing page: the result, no cursor
  await ev(`document.getElementById('vc').style.opacity=0; document.getElementById('result-view').scrollTop=0; true`); await sleep(300);
  const hero = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 }); fs.writeFileSync(path.join(OUT, `hero-${lang}.jpg`), Buffer.from(hero.result.data, "base64"));
  await ev(`document.getElementById('vc').style.opacity=1; true`);
  // 6) end card
  cue(5); for (let i = 1; i <= 12; i++) { await ev(`document.getElementById('ve').style.opacity=${i / 12};document.getElementById('vc').style.opacity=${1 - i / 12};true`); await shot(); }
  await hold(3.4);
  const total = frame / FPS;
  ws.close(); chrome.kill(); await sleep(600); fs.rmSync(prof, { recursive: true, force: true });
  return { lang, frames: frame, seconds: total, cues };
}

(async () => {
  const results = {};
  let port = 9340;
  for (const lang of LANGS) {
    const r = await record(lang, port++); results[lang] = r;
    const mp4 = path.join(OUT, `superprompt-demo-${lang}.mp4`), master = path.join(OUT, `superprompt-demo-${lang}-master.mp4`);
    const inp = ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(OUT, `frames-${lang}`, "%05d.jpg")];
    execFileSync(FFMPEG, [...inp, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", master]);
    execFileSync(FFMPEG, [...inp, "-vf", "scale=1600:900:flags=lanczos", "-c:v", "libx264", "-preset", "veryslow", "-crf", "27", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
    results[lang].mp4Bytes = fs.statSync(mp4).size;
    // WebVTT in both languages with the same timing
    const vtt = (texts) => { const ts = s => { const m = Math.floor(s / 60), x = (s - m * 60).toFixed(3).padStart(6, "0"); return `00:${String(m).padStart(2, "0")}:${x}`; };
      let o = "WEBVTT\n\n"; r.cues.forEach(([i, start], k) => { const end = k + 1 < r.cues.length ? r.cues[k + 1][1] : r.seconds; o += `${k + 1}\n${ts(start)} --> ${ts(end - 0.05)}\n${texts[i]}\n\n`; }); return o; };
    for (const cl of ["en", "ar"]) fs.writeFileSync(path.join(OUT, `superprompt-demo-${lang}.${cl}.vtt`), vtt(CUE_TEXT[cl]), "utf8");
  }
  fs.writeFileSync(path.join(OUT, "video-meta.json"), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(Object.values(results).map(r => ({ lang: r.lang, frames: r.frames, seconds: r.seconds.toFixed(2), mp4Bytes: r.mp4Bytes })), null, 1));
  server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
