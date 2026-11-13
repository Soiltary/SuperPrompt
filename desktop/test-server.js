// Checks SuperPrompt.exe's embedded server: pages, assets, 404, redirects, Host check, and no outbound links.
// Usage: node test-server.js [port]   (run "SuperPrompt.exe --server-only" first)
"use strict";
const http = require("http");
const port = +(process.argv[2] || 8766);
const req = (path, host) => new Promise(res => {
  const r = http.request({ host: "127.0.0.1", port, path, headers: host ? { Host: host } : {} }, s => { let b = ""; s.setEncoding("utf8"); s.on("data", d => b += d); s.on("end", () => res({ status: s.statusCode, type: s.headers["content-type"], csp: s.headers["content-security-policy"], loc: s.headers.location, body: b })); });
  r.on("error", e => res({ status: 0, err: String(e) })); r.end();
});
(async () => {
  const out = {};
  for (const p of ["/", "/guide/", "/prompts/", "/history/", "/about/", "/en/blog/", "/app.js", "/prompt-engine.js", "/brand.css", "/fonts/IBMPlexSansArabic-Regular.ttf", "/favicon.svg"]) {
    const r = await req(p); out[p] = r.status + " " + (r.type || "");
  }
  out.cspOnPages = !!(await req("/")).csp;
  out.redirect = (await req("/guide")).status + " -> " + (await req("/guide")).loc;
  out.notFound = (await req("/pricing/")).status;
  out.traversal = (await req("/..%2f..%2fwindows/win.ini")).status;
  out.foreignHost = (await req("/", "evil.example:" + port)).status;
  out.serverScriptNotServed = (await req("/server/serve.ps1")).status;
  out.launcherNotServed = (await req("/Start%20SuperPrompt.bat")).status;
  const home = (await req("/")).body;
  out.externalUrlsInHome = (home.match(/(?:src|href)="https?:\/\/[^"]+"/g) || []);
  out.getBarHiddenLocally = /id="get-bar"/.test(home) ? "present (hidden by app.js on 127.0.0.1)" : "not generated";
  console.log(JSON.stringify(out, null, 1));
})();
