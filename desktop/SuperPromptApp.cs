// SuperPrompt for Windows: a single-file offline app.
// The website files are embedded as resources and served on 127.0.0.1 only; the interface opens in its own
// app window (Microsoft Edge, Chrome or Brave in --app mode with a private profile). Closing the window stops it.
// Builds with the C# compiler that ships with Windows (.NET Framework 4.x), no SDK or downloads needed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("SuperPrompt")]
[assembly: AssemblyProduct("SuperPrompt")]
[assembly: AssemblyDescription("Offline personal prompt builder")]
[assembly: AssemblyCopyright("SuperPrompt 2026")]
[assembly: AssemblyVersion("2.1.1.0")]
[assembly: AssemblyFileVersion("2.1.1.0")]
[assembly: AssemblyInformationalVersion("2.1.1")]

static class SuperPromptApp
{
    const int PreferredPort = 8766;       // fixed so the saved history (browser storage) stays with the same address
    static readonly Dictionary<string, byte[]> Files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
    static TcpListener listener;
    static int port;
    static volatile bool running = true;

    [STAThread]
    static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        bool noWindow = Array.IndexOf(args, "--server-only") >= 0;   // used by the automated tests
        bool created;
        using (Mutex single = new Mutex(true, "Local\\SuperPrompt.Desktop.SingleInstance", out created))
        {
            if (!created)
            {
                // already running: just open another window on the running copy
                Process w = OpenAppWindow("http://127.0.0.1:" + PreferredPort + "/");
                if (w == null) TryOpenDefault("http://127.0.0.1:" + PreferredPort + "/");
                return 0;
            }
            LoadFiles();
            if (!StartServer())
            {
                MessageBox.Show("SuperPrompt could not start its local server.\n\nتعذّر تشغيل الخادم المحلي لـ SuperPrompt.", "SuperPrompt", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            if (port != PreferredPort)
            {
                MessageBox.Show("Port " + PreferredPort + " is busy, so SuperPrompt is using port " + port + ".\nPrompts saved on the usual port will not show in this session.\n\n" +
                                "المنفذ " + PreferredPort + " مشغول، فاشتغل SuperPrompt على المنفذ " + port + ".\nالبرومبتات المحفوظة على المنفذ المعتاد ما راح تظهر في هذي الجلسة.",
                                "SuperPrompt", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            string url = "http://127.0.0.1:" + port + "/";
            if (noWindow)
            {
                Console.WriteLine(url);
                while (running) Thread.Sleep(500);
                return 0;
            }
            // 1) own window on the WebView2 runtime that ships with Windows 10/11 (works without Edge, Chrome or Brave)
            if (TryRunWebView2Window(url)) { running = false; try { listener.Stop(); } catch { } return 0; }
            // 2) fallback: an app window of Edge, Chrome or Brave
            Log("fallback: browser app window");
            Process win = OpenAppWindow(url);
            if (win != null)
            {
                win.WaitForExit();
            }
            else
            {
                // no Edge/Chrome/Brave: use the default browser if one is registered, and keep a small window to stop the app
                bool opened = HasDefaultBrowser() && TryOpenDefault(url);
                Application.Run(new StopForm(url, opened));
            }
            running = false;
            try { listener.Stop(); } catch { }
            return 0;
        }
    }

    // ---------- embedded website ----------
    static void LoadFiles()
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        foreach (string name in asm.GetManifestResourceNames())
        {
            if (!name.StartsWith("site/")) continue;
            using (Stream s = asm.GetManifestResourceStream(name))
            using (MemoryStream ms = new MemoryStream())
            {
                s.CopyTo(ms);
                Files[name.Substring(5)] = ms.ToArray();
            }
        }
    }

    // ---------- local server (loopback only) ----------
    static bool StartServer()
    {
        for (int p = PreferredPort; p < PreferredPort + 10; p++)
        {
            try
            {
                listener = new TcpListener(IPAddress.Loopback, p);
                listener.Start();
                port = p;
                Thread t = new Thread(AcceptLoop);
                t.IsBackground = true;
                t.Start();
                return true;
            }
            catch (SocketException) { }
        }
        return false;
    }

    static void AcceptLoop()
    {
        while (running)
        {
            TcpClient c;
            try { c = listener.AcceptTcpClient(); }
            catch { if (!running) return; continue; }
            ThreadPool.QueueUserWorkItem(Handle, c);
        }
    }

    static void Handle(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            client.ReceiveTimeout = 5000;
            NetworkStream ns = client.GetStream();
            string head = ReadHead(ns);
            if (head == null) return;
            string[] lines = head.Split(new[] { "\r\n" }, StringSplitOptions.None);
            string[] req = lines[0].Split(' ');
            if (req.Length < 2) { Send(ns, 400, "text/plain", Encoding.UTF8.GetBytes("Bad request"), false); return; }
            string method = req[0];
            string host = "";
            foreach (string l in lines)
                if (l.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) host = l.Substring(5).Trim().ToLowerInvariant();
            // refuse requests that were not addressed to this computer (DNS-rebinding protection)
            if (host != "127.0.0.1:" + port && host != "localhost:" + port) { Send(ns, 403, "text/plain", Encoding.UTF8.GetBytes("Forbidden"), false); return; }
            if (method != "GET" && method != "HEAD") { Send(ns, 405, "text/plain", Encoding.UTF8.GetBytes("Method not allowed"), false); return; }
            string path = req[1];
            int q = path.IndexOfAny(new[] { '?', '#' });
            if (q >= 0) path = path.Substring(0, q);
            path = Uri.UnescapeDataString(path).TrimStart('/');
            if (path.Contains("..") || path.Contains("\\")) { Send(ns, 400, "text/plain", Encoding.UTF8.GetBytes("Bad path"), false); return; }
            string key = path.Length == 0 || path.EndsWith("/") ? path + "index.html" : path;
            byte[] body;
            if (!Files.TryGetValue(key, out body))
            {
                if (Files.ContainsKey(path + "/index.html")) { Redirect(ns, "/" + path + "/"); return; }
                Send(ns, 404, "text/html; charset=utf-8", Encoding.UTF8.GetBytes("<!doctype html><meta charset=utf-8><title>404</title><p>Not found</p>"), method == "HEAD");
                return;
            }
            Send(ns, 200, Mime(key), body, method == "HEAD");
        }
        catch { }
        finally { try { client.Close(); } catch { } }
    }

    static string ReadHead(NetworkStream ns)
    {
        byte[] buf = new byte[16384];
        int total = 0;
        while (total < buf.Length)
        {
            int n = ns.Read(buf, total, buf.Length - total);
            if (n <= 0) break;
            total += n;
            string s = Encoding.ASCII.GetString(buf, 0, total);
            int end = s.IndexOf("\r\n\r\n");
            if (end >= 0) return s.Substring(0, end);
        }
        return null;
    }

    const string Csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'";

    static void Send(NetworkStream ns, int code, string type, byte[] body, bool headOnly)
    {
        string status = code == 200 ? "OK" : code == 404 ? "Not Found" : code == 403 ? "Forbidden" : code == 405 ? "Method Not Allowed" : "Bad Request";
        string h = "HTTP/1.1 " + code + " " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.Length +
                   "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: " + Csp +
                   "\r\nConnection: close\r\n\r\n";
        byte[] hb = Encoding.ASCII.GetBytes(h);
        ns.Write(hb, 0, hb.Length);
        if (!headOnly) ns.Write(body, 0, body.Length);
    }

    static void Redirect(NetworkStream ns, string to)
    {
        byte[] hb = Encoding.ASCII.GetBytes("HTTP/1.1 301 Moved Permanently\r\nLocation: " + to + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        ns.Write(hb, 0, hb.Length);
    }

    static string Mime(string p)
    {
        string e = Path.GetExtension(p).ToLowerInvariant();
        switch (e)
        {
            case ".html": return "text/html; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".ico": return "image/x-icon";
            case ".ttf": return "font/ttf";
            case ".woff2": return "font/woff2";
            case ".txt": return "text/plain; charset=utf-8";
            default: return "application/octet-stream";
        }
    }

    // ---------- WebView2 window ----------
    // Kept in its own non-inlined method so a missing WebView2 DLL only fails this call, not the whole app.
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    static bool TryRunWebView2Window(string url)
    {
        string folder = null;   // null = the registered (Evergreen) runtime
        try
        {
            string ver = Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString();
            Log("webview2 runtime: " + (ver ?? "(none)"));
            if (string.IsNullOrEmpty(ver)) return false;
        }
        catch (Exception ex)
        {
            Log("webview2 check failed: " + ex.GetType().Name + ": " + ex.Message);
            // the runtime files can be present without their registration (seen in Windows Sandbox): use the folder directly
            folder = FindRuntimeFolder();
            if (folder == null) return false;
            try
            {
                string ver = Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString(folder);
                Log("webview2 runtime folder: " + folder + " (" + ver + ")");
                if (string.IsNullOrEmpty(ver)) return false;
            }
            catch (Exception ex2) { Log("webview2 folder failed: " + ex2.Message); return false; }
        }
        WebForm f = new WebForm(url, folder);
        Application.Run(f);
        return f.Started;   // false when the runtime failed to start: the caller falls back to a browser window
    }

    class WebForm : Form
    {
        readonly Microsoft.Web.WebView2.WinForms.WebView2 view = new Microsoft.Web.WebView2.WinForms.WebView2();
        readonly string url, origin, runtimeFolder;
        public bool Started;
        public WebForm(string url, string runtimeFolder)
        {
            this.url = url; origin = url.TrimEnd('/'); this.runtimeFolder = runtimeFolder;
            Text = "SuperPrompt";
            try { Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            StartPosition = FormStartPosition.CenterScreen;
            Size = new System.Drawing.Size(1320, 880);
            MinimumSize = new System.Drawing.Size(420, 560);
            view.Dock = DockStyle.Fill;
            Controls.Add(view);
            Load += OnLoadAsync;
        }

        async void OnLoadAsync(object sender, EventArgs e)
        {
            try
            {
                string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SuperPrompt", "WebView2");
                Microsoft.Web.WebView2.Core.CoreWebView2Environment env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(runtimeFolder, data, null);
                await view.EnsureCoreWebView2Async(env);
                Microsoft.Web.WebView2.Core.CoreWebView2 core = view.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = true;
                core.DocumentTitleChanged += delegate { Text = string.IsNullOrEmpty(core.DocumentTitle) ? "SuperPrompt" : core.DocumentTitle; };
                // anything outside the app opens in the user's browser, never inside the app window
                core.NewWindowRequested += delegate (object s, Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; OpenExternal(a.Uri); };
                core.NavigationStarting += delegate (object s, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs a)
                {
                    if ((a.Uri.StartsWith("http:") || a.Uri.StartsWith("https:")) && !a.Uri.StartsWith(origin)) { a.Cancel = true; OpenExternal(a.Uri); }
                };
                core.Navigate(url);
                Started = true;
                Log("webview2 window started");
            }
            catch (Exception ex)
            {
                Log("webview2 start failed: " + ex.GetType().Name + " 0x" + ex.HResult.ToString("X8") + ": " + ex.Message);
                Started = false;
                Close();
            }
        }

        static void OpenExternal(string uri)
        {
            if (uri != null && (uri.StartsWith("https://") || uri.StartsWith("http://"))) { try { Process.Start(uri); } catch { } }
        }
    }

    // newest installed WebView2 runtime folder (…\EdgeWebView\Application\<version>\msedgewebview2.exe)
    static string FindRuntimeFolder()
    {
        string best = null; Version bestV = null;
        foreach (string pfv in new[] { "ProgramFiles(x86)", "ProgramFiles" })
        {
            string pf = Environment.GetEnvironmentVariable(pfv);
            if (string.IsNullOrEmpty(pf)) continue;
            string root = Path.Combine(pf, "Microsoft\\EdgeWebView\\Application");
            if (!Directory.Exists(root)) continue;
            foreach (string d in Directory.GetDirectories(root))
            {
                Version v;
                if (!Version.TryParse(Path.GetFileName(d), out v) || !File.Exists(Path.Combine(d, "msedgewebview2.exe"))) continue;
                if (bestV == null || v > bestV) { bestV = v; best = d; }
            }
        }
        return best;
    }

    // short local startup log (no prompts or personal data), overwritten on each start: %LOCALAPPDATA%\SuperPrompt\startup.log
    static bool logStarted;
    static void Log(string line)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SuperPrompt");
            Directory.CreateDirectory(dir);
            string f = Path.Combine(dir, "startup.log");
            string text = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + line + Environment.NewLine;
            if (!logStarted) { File.WriteAllText(f, text); logStarted = true; } else File.AppendAllText(f, text);
        }
        catch { }
    }

    // ---------- app window (fallback) ----------
    static Process OpenAppWindow(string url)
    {
        string exe = FindBrowser();
        if (exe == null) return null;
        string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SuperPrompt", "AppWindow");
        Directory.CreateDirectory(profile);
        string a = "--app=" + url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check --disable-sync" +
                   " --disable-background-networking --disable-component-update --disable-features=Translate,msEdgeSidebar --window-size=1320,880";
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo(exe, a);
            psi.UseShellExecute = false;
            return Process.Start(psi);
        }
        catch { return null; }
    }

    static string FindBrowser()
    {
        string[] names = { "msedge.exe", "chrome.exe", "brave.exe" };
        foreach (string n in names)
        {
            foreach (RegistryKey root in new[] { Registry.CurrentUser, Registry.LocalMachine })
            {
                try
                {
                    using (RegistryKey k = root.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" + n))
                    {
                        if (k != null)
                        {
                            string v = k.GetValue("") as string;
                            if (!string.IsNullOrEmpty(v) && File.Exists(v.Trim('"'))) return v.Trim('"');
                        }
                    }
                }
                catch { }
            }
        }
        string pf86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "C:\\Program Files (x86)";
        string pf = Environment.GetEnvironmentVariable("ProgramFiles") ?? "C:\\Program Files";
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] guesses = {
            Path.Combine(pf86, "Microsoft\\Edge\\Application\\msedge.exe"), Path.Combine(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(pf, "Google\\Chrome\\Application\\chrome.exe"), Path.Combine(pf86, "Google\\Chrome\\Application\\chrome.exe"),
            Path.Combine(local, "Google\\Chrome\\Application\\chrome.exe"),
            Path.Combine(pf, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"), Path.Combine(local, "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
        };
        foreach (string g in guesses) if (File.Exists(g)) return g;
        return null;
    }

    static bool HasDefaultBrowser()
    {
        try
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice"))
            {
                string prog = k == null ? null : k.GetValue("ProgId") as string;
                if (string.IsNullOrEmpty(prog)) return false;
                using (RegistryKey c = Registry.ClassesRoot.OpenSubKey(prog + "\\shell\\open\\command"))
                    return c != null && !string.IsNullOrEmpty(c.GetValue("") as string);
            }
        }
        catch { return false; }
    }

    static bool TryOpenDefault(string url)
    {
        try { Process.Start(url); return true; } catch { return false; }
    }

    class StopForm : Form
    {
        public StopForm(string url, bool opened)
        {
            Text = "SuperPrompt";
            Width = 520; Height = opened ? 220 : 280; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            try { Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            // English (left to right) on top, Arabic (right to left, right aligned) below; Latin names inside the Arabic
            // text are wrapped in LRI…PDI so they keep their order
            const string L = "⁦", P = "⁩";
            Label en = new Label();
            en.Dock = DockStyle.Top; en.Padding = new Padding(14, 14, 14, 4); en.Font = new System.Drawing.Font("Segoe UI", 10f);
            en.Text = opened
                ? "SuperPrompt is open in your browser at " + url + "\nClose this window to stop it"
                : "No web browser was found on this PC, so SuperPrompt cannot open its window\nInstall Microsoft Edge (free, from microsoft.com) or any browser, then run SuperPrompt again\nWhile this window is open, SuperPrompt is available at " + url;
            Label ar = new Label();
            ar.Dock = DockStyle.Fill; ar.Padding = new Padding(14, 4, 14, 8); ar.Font = new System.Drawing.Font("Segoe UI", 10f);
            ar.RightToLeft = RightToLeft.Yes; ar.TextAlign = System.Drawing.ContentAlignment.TopRight;
            ar.Text = opened
                ? "البرنامج مفتوح في متصفحك على العنوان " + L + url + P + "\nاقفل هذي النافذة لإيقافه"
                : "ما لقيت متصفح على هذا الجهاز، فما يقدر " + L + "SuperPrompt" + P + " يفتح نافذته\nثبّت " + L + "Microsoft Edge" + P + " (مجاني من موقع مايكروسوفت) أو أي متصفح، ثم شغّل البرنامج مرة ثانية\nوهذي النافذة مفتوحة، البرنامج شغّال على " + L + url + P;
            Button copy = new Button();
            copy.Text = "Copy address / نسخ العنوان"; copy.Dock = DockStyle.Bottom; copy.Height = 36;
            copy.Click += delegate { try { Clipboard.SetText(url); } catch { } };
            Controls.Add(ar);
            Controls.Add(en);
            Controls.Add(copy);
            en.Height = opened ? 70 : 104;
            Height = opened ? 260 : 330;
        }
    }
}
