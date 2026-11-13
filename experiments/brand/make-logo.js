// Turns the approved SuperPrompt logo (silver prompt caret + glowing blue underscore on a white background) into
// transparent PNGs in every size the website, the Windows app and Syntra need. Runs the image work inside headless
// Chrome (canvas), so nothing has to be installed. Usage: node make-logo.js <source image> <output folder>
//
// Background removal: the white background is flood-filled from the edges (near-white only), and the soft blue glow
// next to it is "un-mixed" from white so it keeps its colour and becomes semi-transparent instead of a pale box.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), http = require("http");
const src = process.argv[2], outDir = process.argv[3];
if (!src || !outDir) { console.error("usage: node make-logo.js <source> <outDir>"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const mime = /\.webp$/i.test(src) ? "image/webp" : /\.png$/i.test(src) ? "image/png" : "image/jpeg";
const dataUrl = `data:${mime};base64,` + fs.readFileSync(src).toString("base64");
const port = 9339, prof = path.join(outDir, ".chrome-profile");
fs.rmSync(prof, { recursive: true, force: true });
const proc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));

const PAGE = `(async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = new OffscreenCanvas(W, H), x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data;
  const minc = i => Math.min(d[i], d[i + 1], d[i + 2]);
  // 1) background = near-white pixels connected to the border
  const bg = new Uint8Array(W * H), soft = new Uint8Array(W * H), q = [];
  const push = (p) => { if (!bg[p] && minc(p * 4) >= 238) { bg[p] = 1; q.push(p); } };
  for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  while (q.length) { const p = q.pop(), px = p % W, py = (p / W) | 0;
    if (px > 0) push(p - 1); if (px < W - 1) push(p + 1); if (py > 0) push(p - W); if (py < H - 1) push(p + W); }
  // 2) glow/antialias ring = pixels touching the background whose colour is a mix of white and something darker
  const q2 = []; for (let p = 0; p < W * H; p++) if (bg[p]) q2.push(p);
  const grow = (p, from) => { if (bg[p] || soft[p]) return; const m = minc(p * 4); if (m < 120) return; if (m > minc(from * 4) + 6) return; soft[p] = 1; q2.push(p); };
  while (q2.length) { const p = q2.pop(), px = p % W, py = (p / W) | 0;
    if (px > 0) grow(p - 1, p); if (px < W - 1) grow(p + 1, p); if (py > 0) grow(p - W, p); if (py < H - 1) grow(p + W, p); }
  for (let p = 0; p < W * H; p++) { const i = p * 4;
    if (bg[p]) { d[i + 3] = 0; continue; }
    if (soft[p]) { // un-mix from white: c = a*fg + (1-a)*255  ->  a = (255 - min)/255
      const a = Math.min(1, (255 - minc(i)) / 255 * 1.15); if (a <= 0.01) { d[i + 3] = 0; continue; }
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] - 255 * (1 - a)) / a)));
      d[i + 3] = Math.round(a * 255); }
  }
  x.putImageData(id, 0, 0);
  // 3) tight square crop with a little room for the glow
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (d[(y * W + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const side = Math.max(x1 - x0, y1 - y0) * 1.06, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const master = new OffscreenCanvas(1024, 1024), mx = master.getContext("2d");
  mx.imageSmoothingQuality = "high";
  mx.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, 1024, 1024);
  const toUrl = async (cv) => { const b = await cv.convertToBlob({ type: "image/png" }); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); };
  // step-down resize for crisp small sizes
  const scaled = (n) => { let cur = master, s = 1024; while (s / 2 >= n) { const t = new OffscreenCanvas(s / 2, s / 2); const tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(cur, 0, 0, s / 2, s / 2); cur = t; s /= 2; }
    if (s !== n) { const t = new OffscreenCanvas(n, n); const tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(cur, 0, 0, n, n); cur = t; } return cur; };
  // tile: the mark on the dark SuperPrompt tile (for places that cannot be transparent: iOS icon, share image, taskbar)
  const tile = (n, pad) => { const t = new OffscreenCanvas(n, n), tx = t.getContext("2d"); const r = n * 0.22;
    const g = tx.createLinearGradient(0, 0, n, n); g.addColorStop(0, "#1a1440"); g.addColorStop(1, "#0b1330");
    tx.fillStyle = g; tx.beginPath(); tx.roundRect(0, 0, n, n, r); tx.fill();
    tx.strokeStyle = "rgba(139,92,246,0.55)"; tx.lineWidth = Math.max(1, n / 64); tx.beginPath(); tx.roundRect(tx.lineWidth / 2, tx.lineWidth / 2, n - tx.lineWidth, n - tx.lineWidth, r); tx.stroke();
    const m = scaled(Math.round(n * (1 - 2 * pad))); tx.drawImage(m, n * pad, n * pad); return t; };
  const out = {};
  out["superprompt-logo-1024.png"] = await toUrl(master);
  for (const n of [16, 24, 32, 48, 64, 128, 180, 256, 512]) out["logo-" + n + ".png"] = await toUrl(scaled(n));
  for (const n of [16, 24, 32, 48, 64, 128, 180, 192, 256, 512]) out["tile-" + n + ".png"] = await toUrl(tile(n, n <= 32 ? 0.06 : 0.12));
  // share image 1200x630: dark brand background, the mark and the name
  const og = new OffscreenCanvas(1200, 630), ox = og.getContext("2d");
  const bgg = ox.createLinearGradient(0, 0, 1200, 630); bgg.addColorStop(0, "#0c0a24"); bgg.addColorStop(1, "#08122e"); ox.fillStyle = bgg; ox.fillRect(0, 0, 1200, 630);
  const rg = ox.createRadialGradient(330, 315, 10, 330, 315, 420); rg.addColorStop(0, "rgba(124,58,237,0.35)"); rg.addColorStop(1, "rgba(124,58,237,0)"); ox.fillStyle = rg; ox.fillRect(0, 0, 1200, 630);
  ox.drawImage(scaled(512), 90, 75, 480, 480);
  ox.fillStyle = "#f5f3ff"; ox.font = "700 92px 'Segoe UI', Arial, sans-serif"; ox.fillText("Super", 600, 300);
  const sw = ox.measureText("Super").width; const tg = ox.createLinearGradient(600 + sw, 0, 600 + sw + 320, 0); tg.addColorStop(0, "#8b5cf6"); tg.addColorStop(1, "#3b82f6"); ox.fillStyle = tg; ox.fillText("Prompt", 600 + sw, 300);
  ox.fillStyle = "#c4c8e8"; ox.font = "500 34px 'Segoe UI', Arial, sans-serif"; ox.fillText("Your words. A clear prompt.", 604, 368);
  ox.fillStyle = "#8f95c0"; ox.font = "500 26px 'Segoe UI', Arial, sans-serif"; ox.fillText("Browser · Windows · Offline", 604, 418);
  out["og-image.png"] = await toUrl(og);
  // preview sheet: every size on light and dark backgrounds
  // rows: light/plain, light/tile, dark/plain, dark/tile
  const sheet = new OffscreenCanvas(1120, 4 * 290), sx = sheet.getContext("2d");
  const rows = [["#f6f5fb", false], ["#f6f5fb", true], ["#090d1d", false], ["#090d1d", true]];
  rows.forEach(([col, isTile], r) => { const yy = r * 290; sx.fillStyle = col; sx.fillRect(0, yy, 1120, 290);
    let px = 20; for (const n of [16, 24, 32, 48, 64, 128, 256]) { sx.drawImage(isTile ? tile(n, n <= 32 ? 0.06 : 0.12) : scaled(n), px, yy + 17 + (256 - n) / 2); px += n + 30; } });
  out["_preview-sheet.png"] = await toUrl(sheet);
  return out;
})`;

(async () => {
  let t; for (let i = 0; i < 40; i++) { try { t = await getJSON(`http://127.0.0.1:${port}/json`); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const r = await send("Runtime.evaluate", { expression: PAGE + "(" + JSON.stringify(dataUrl) + ")", awaitPromise: true, returnByValue: true });
  if (!r.result || r.result.exceptionDetails) throw new Error(JSON.stringify(r.result && r.result.exceptionDetails || r));
  const files = r.result.result.value;
  for (const [name, url] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(files).map(n => n + " " + fs.statSync(path.join(outDir, n)).size).join("\n"));
  ws.close(); proc.kill(); await sleep(500); fs.rmSync(prof, { recursive: true, force: true });
})().catch(e => { console.error(String(e)); proc.kill(); process.exit(1); });
