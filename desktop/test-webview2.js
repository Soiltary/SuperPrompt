// Drives the real SuperPrompt.exe window (WebView2) through a temporary debugging port that is only enabled
// for this test run (WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS). Usage: node test-webview2.js <exe> [importFile] [label]
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), http = require("http");
const exe = process.argv[2], importFile = (process.argv[3] && process.argv[3] !== "none") ? process.argv[3] : "", label = process.argv[4] || "run";
const port = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
async function open() {
  const env = Object.assign({}, process.env, { WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` });
  const proc = spawn(exe, [], { env, stdio: "ignore", detached: false });
  let page;
  let last = "";
  for (let i = 0; i < 180 && !page; i++) { try { const list = await getJSON(`http://127.0.0.1:${port}/json`); last = JSON.stringify(list.map(t => t.type + " " + t.url)); page = list.find(t => t.type === "page" && t.url.startsWith("http://127.0.0.1:8766")); } catch (e) { last = String(e); } await sleep(500); }
  if (!page) throw new Error("WebView2 page not found; last: " + last + "; exe exited: " + (proc.exitCode !== null));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async x => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }); return r.result && r.result.result ? r.result.result.value : r; };
  await sleep(1200);
  return { proc, ws, ev, send };
}
(async () => {
  const report = { label };
  // run 1: use the app
  let a = await open();
  report.engine = await a.ev(`navigator.userAgent.includes('Edg') ? 'WebView2 (Edge engine)' : navigator.userAgent`);
  report.ui = await a.ev(`({title:document.title, dir:document.documentElement.dir, getBarHidden:document.getElementById('get-bar').hidden, brand:document.querySelector('.brand-name').textContent})`);
  report.generate = await a.ev(`(async()=>{ const $=s=>document.querySelector(s); const g=$('#goal'); g.value='Ø§Ù„Ø·Ø§Ø¨Ø¹Ø© HP LaserJet M111w Ù…Ø§ ØªØ·Ø¨Ø¹ Ù…Ù† Ø§Ù„Ù„Ø§Ø¨ØªÙˆØ¨ØŒ ÙˆÙŠÙ†Ø¯ÙˆØ² 11'; g.dispatchEvent(new Event('input',{bubbles:true})); $('#gen-btn').click(); await new Promise(r=>setTimeout(r,600)); const t=$('#result').value; return {mode:($('#understand select')||{}).value||null, chars:t.length, keeps:t.includes('HP LaserJet M111w')}; })()`);
  const copyState = await a.ev(`(async()=>{ const b=document.getElementById('copy-btn'); b.click(); await new Promise(r=>setTimeout(r,500)); return {state:b.className, label:b.textContent.trim(), result:document.getElementById('result').value}; })()`);
  // read the real Windows clipboard (what the user would paste), not navigator.clipboard.readText (that asks for permission)
  const clip = require("child_process").execFileSync("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Raw"], { encoding: "utf8" }).replace(/\r?\n$/, "");
  report.copy = { state: copyState.state, label: copyState.label, clipboardMatches: clip.replace(/\r\n/g, "\n") === copyState.result.replace(/\r\n/g, "\n"), clipChars: clip.length };
  report.save = await a.ev(`(async()=>{ document.getElementById('r-save').click(); await new Promise(r=>setTimeout(r,400)); return JSON.parse(localStorage.getItem('mpz-history')||'[]').length; })()`);
  await a.send("Page.navigate", { url: "http://127.0.0.1:8766/history/" }); await sleep(1500);
  report.export = await a.ev(`(async()=>{ let blob=null; const o=URL.createObjectURL; URL.createObjectURL=b=>{blob=b;return 'blob:x'}; const oc=HTMLAnchorElement.prototype.click; let name=null; HTMLAnchorElement.prototype.click=function(){name=this.download}; document.querySelector('#hist-export').click(); await new Promise(r=>setTimeout(r,400)); URL.createObjectURL=o; HTMLAnchorElement.prototype.click=oc; const text=blob?await blob.text():''; return {name, text}; })()`);
  const exp = report.export.text ? JSON.parse(report.export.text) : null;
  fs.writeFileSync(path.join(__dirname, `export-from-app-${label}.json`), report.export.text || "", "utf8");
  report.export = { name: report.export.name, app: exp && exp.app, version: exp && exp.version, items: exp && exp.items.length };
  if (importFile) {
    const txt = fs.readFileSync(importFile, "utf8");
    report.import = await a.ev(`(async()=>{ const input=document.getElementById('hist-file'); const f=new File([${JSON.stringify(txt)}],'from-web.json',{type:'application/json'}); const dt=new DataTransfer(); dt.items.add(f); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,800)); return {history:JSON.parse(localStorage.getItem('mpz-history')||'[]').length, cards:document.querySelectorAll('.hist-item').length}; })()`);
  }
  report.historyBeforeClose = await a.ev(`JSON.parse(localStorage.getItem('mpz-history')||'[]').length`);
  a.ws.close(); a.proc.kill(); await sleep(2500);
  // run 2: reopen the app, history and settings must still be there
  a = await open();
  report.reopen = await a.ev(`({history:JSON.parse(localStorage.getItem('mpz-history')||'[]').length, goal:(localStorage.getItem('mpz-goal')||'').slice(0,20), ui:document.documentElement.lang})`);
  a.ws.close(); a.proc.kill(); await sleep(1500);
  fs.writeFileSync(path.join(__dirname, `webview2-test-${label}.json`), JSON.stringify(report, null, 1), "utf8");
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(String(e)); process.exit(1); });

