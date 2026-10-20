// The deck's terminal drawer, Windows side: a real console (ConPTY) behind a WebSocket on the presenter kit's
// local server. serve.ps1 compiles this with Add-Type (C# 5, .NET Framework 4.5+, Windows 10 1809 or later).
// Protocol: the page sends text frames "0<keys>" (input) and "1<cols>,<rows>" (resize); output comes back as binary frames.
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class DeckTerm {
  [StructLayout(LayoutKind.Sequential)] struct COORD { public short X; public short Y; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX; public int dwY; public int dwXSize; public int dwYSize; public int dwXCountChars; public int dwYCountChars;
    public int dwFillAttribute; public int dwFlags; public short wShowWindow; public short cbReserved2;
    public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }

  [DllImport("kernel32.dll", SetLastError = true)] static extern bool CreatePipe(out SafeFileHandle r, out SafeFileHandle w, IntPtr sa, int size);
  [DllImport("kernel32.dll", SetLastError = true)] static extern int CreatePseudoConsole(COORD size, SafeFileHandle input, SafeFileHandle output, uint flags, out IntPtr hpc);
  [DllImport("kernel32.dll", SetLastError = true)] static extern int ResizePseudoConsole(IntPtr hpc, COORD size);
  [DllImport("kernel32.dll", SetLastError = true)] static extern void ClosePseudoConsole(IntPtr hpc);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attr, IntPtr value, IntPtr size, IntPtr prev, IntPtr ret);
  [DllImport("kernel32.dll", SetLastError = true)] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool CreateProcessW(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFOEX si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr h, uint code);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr h, uint ms);

  const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000, CREATE_UNICODE_ENVIRONMENT = 0x00000400;
  static readonly IntPtr PSEUDOCONSOLE = (IntPtr)0x00020016;
  static readonly List<Session> live = new List<Session>();

  // hand a WebSocket request over; returns at once, the session runs on its own threads
  static DeckTerm() { int w, io; ThreadPool.GetMinThreads(out w, out io); ThreadPool.SetMinThreads(Math.Max(w, 32), Math.Max(io, 32)); }   // async waits complete without stalls

  public static void Start(HttpListenerContext ctx, string cmdLine, string cwd, int cols, int rows) {
    // each session gets its own thread: its loops block, and on the shared pool a few tabs would starve new connections
    Thread th = new Thread(delegate () {
      Session s = null; WebSocket ws = null;
      try {
        ws = ctx.AcceptWebSocketAsync(null).Result.WebSocket;
        s = new Session(ws, cmdLine, cwd, cols, rows);
        lock (live) live.Add(s);
        s.Run();
      } catch (Exception e) {
        Exception r = e is AggregateException && e.InnerException != null ? e.InnerException : e;
        Console.WriteLine("terminal: " + r.Message);
        if (s == null && ws != null && ws.State == WebSocketState.Open) {   // tell the page why (a text frame is shown as an error)
          try {
            ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes("The shell could not start: " + r.Message)), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);
            ws.CloseOutputAsync(WebSocketCloseStatus.InternalServerError, "no shell", CancellationToken.None).Wait(1000);
          } catch { }
        }
      }
      finally { if (s != null) { s.Close(); lock (live) live.Remove(s); } }
    });
    th.IsBackground = true; th.Start();
  }

  // close every shell (the deck window closed)
  public static void CloseAll() { Session[] all; lock (live) all = live.ToArray(); foreach (Session s in all) s.Close(); }

  class Session {
    readonly WebSocket ws; IntPtr hpc = IntPtr.Zero; PROCESS_INFORMATION pi; FileStream toPty, fromPty; int closed, pcClosed;
    readonly object sendLock = new object();

    public Session(WebSocket ws, string cmdLine, string cwd, int cols, int rows) {
      this.ws = ws;
      SafeFileHandle inRead, inWrite, outRead, outWrite;
      if (!CreatePipe(out inRead, out inWrite, IntPtr.Zero, 0) || !CreatePipe(out outRead, out outWrite, IntPtr.Zero, 0)) throw new Exception("CreatePipe failed");
      COORD size; size.X = (short)Math.Max(20, cols); size.Y = (short)Math.Max(5, rows);
      int hr = CreatePseudoConsole(size, inRead, outWrite, 0, out hpc);
      if (hr != 0) throw new Exception("CreatePseudoConsole failed (needs Windows 10 1809 or later): 0x" + hr.ToString("X"));
      IntPtr lsize = IntPtr.Zero;
      InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref lsize);
      IntPtr list = Marshal.AllocHGlobal(lsize);
      try {
        if (!InitializeProcThreadAttributeList(list, 1, 0, ref lsize)) throw new Exception("InitializeProcThreadAttributeList failed");
        if (!UpdateProcThreadAttribute(list, 0, PSEUDOCONSOLE, hpc, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero)) throw new Exception("UpdateProcThreadAttribute failed");
        STARTUPINFOEX si = new STARTUPINFOEX();
        si.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
        si.lpAttributeList = list;
        si.StartupInfo.dwFlags = 0x00000100;   // STARTF_USESTDHANDLES with no handles: the child talks to the pseudoconsole, never to this window's (possibly redirected) output
        if (!CreateProcessW(null, new StringBuilder(cmdLine), IntPtr.Zero, IntPtr.Zero, false, EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT, IntPtr.Zero, cwd, ref si, out pi))
          throw new Exception("could not start " + cmdLine + " (error " + Marshal.GetLastWin32Error() + ")");
      } finally { DeleteProcThreadAttributeList(list); Marshal.FreeHGlobal(list); }
      inRead.Dispose(); outWrite.Dispose();   // the console holds its own ends
      toPty = new FileStream(inWrite, FileAccess.Write, 1, false);
      fromPty = new FileStream(outRead, FileAccess.Read, 1, false);
    }

    public void Run() {
      Thread reader = new Thread(Pump); reader.IsBackground = true; reader.Start();
      // a console's output pipe stays open after its shell exits: when the shell ends, close the console so the page hears it
      // the watcher owns the process handles: it closes them only after the shell has gone (Close() terminates it)
      Thread watch = new Thread(delegate () { WaitForSingleObject(pi.hProcess, 0xFFFFFFFF); ClosePc(); CloseHandle(pi.hProcess); CloseHandle(pi.hThread); });
      watch.IsBackground = true; watch.Start();
      byte[] buf = new byte[16384]; MemoryStream msg = new MemoryStream();
      while (ws.State == WebSocketState.Open) {
        WebSocketReceiveResult r = ws.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None).Result;
        if (r.MessageType == WebSocketMessageType.Close) break;
        msg.Write(buf, 0, r.Count);
        if (!r.EndOfMessage) continue;
        string m = Encoding.UTF8.GetString(msg.ToArray()); msg.SetLength(0);
        if (m.Length == 0) continue;
        if (m[0] == '0') { byte[] b = Encoding.UTF8.GetBytes(m.Substring(1)); toPty.Write(b, 0, b.Length); toPty.Flush(); }
        else if (m[0] == '1') {
          string[] p = m.Substring(1).Split(','); int c, w;
          if (p.Length == 2 && int.TryParse(p[0], out c) && int.TryParse(p[1], out w) && c > 0 && w > 0) {
            COORD sz; sz.X = (short)c; sz.Y = (short)w; ResizePseudoConsole(hpc, sz);
          }
        }
      }
    }

    // console output -> page, until the shell exits
    void Pump() {
      byte[] buf = new byte[16384];
      try {
        while (true) {
          int n = fromPty.Read(buf, 0, buf.Length);
          if (n <= 0) break;
          lock (sendLock) ws.SendAsync(new ArraySegment<byte>(buf, 0, n), WebSocketMessageType.Binary, true, CancellationToken.None).Wait();
        }
      } catch { }
      try { lock (sendLock) ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "exited", CancellationToken.None).Wait(2000); } catch { }
    }

    // exactly once: a second ClosePseudoConsole could hit the console a newer tab has just been given
    void ClosePc() { if (hpc != IntPtr.Zero && Interlocked.Exchange(ref pcClosed, 1) == 0) try { ClosePseudoConsole(hpc); } catch { } }

    public void Close() {
      if (Interlocked.Exchange(ref closed, 1) == 1) return;
      try { if (pi.hProcess != IntPtr.Zero) TerminateProcess(pi.hProcess, 0); } catch { }
      ClosePc();
      try { if (toPty != null) toPty.Dispose(); } catch { }
      try { if (fromPty != null) fromPty.Dispose(); } catch { }
      try { ws.Abort(); } catch { }
    }
  }
}

// The deck's browser: opens a page in the presenter's own browser (their profile, signed in, with tabs) and, on Windows,
// puts the deck window on the left of the screen and that browser window on the right. Deck.config({ browser: true }).
public static class DeckWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);

  // visible top-level browser windows (Edge and Chrome share this class)
  static List<IntPtr> Windows() {
    List<IntPtr> all = new List<IntPtr>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;   // 4 = GW_OWNER: skip popups and menus
      StringBuilder c = new StringBuilder(64); GetClassName(h, c, 64);
      if (c.ToString() == "Chrome_WidgetWin_1") all.Add(h);
      return true;
    }, IntPtr.Zero);
    return all;
  }
  static IntPtr DeckWindow(int deckPid) {
    if (deckPid <= 0) return IntPtr.Zero;
    foreach (IntPtr h in Windows()) { uint p; GetWindowThreadProcessId(h, out p); if (p == (uint)deckPid) return h; }
    return IntPtr.Zero;
  }

  // open url in a new window of the presenter's browser; then deck left (60%), browser right (40%). Returns at once.
  public static void Open(string exe, string url, int deckPid) {
    Thread th = new Thread(delegate () {
      try {
        SetProcessDPIAware();
        Dictionary<IntPtr, bool> before = new Dictionary<IntPtr, bool>(); foreach (IntPtr b in Windows()) before[b] = true;
        System.Diagnostics.ProcessStartInfo si = new System.Diagnostics.ProcessStartInfo(exe, "--new-window \"" + url.Replace("\"", "%22") + "\"");
        si.UseShellExecute = false; System.Diagnostics.Process.Start(si);
        // the page's window: a new browser window whose title names a page ("… - Microsoft Edge"). While a browser starts it can
        // show windows titled with just its name; one of those is used only if no page window turns up within 8 s.
        IntPtr deck = DeckWindow(deckPid), win = IntPtr.Zero, fallback = IntPtr.Zero;
        for (int i = 0; i < 53 && win == IntPtr.Zero; i++) {
          Thread.Sleep(150);
          fallback = IntPtr.Zero;
          foreach (IntPtr h in Windows()) {
            uint p; GetWindowThreadProcessId(h, out p); if (before.ContainsKey(h) || p == (uint)deckPid) continue;
            StringBuilder t = new StringBuilder(300); GetWindowText(h, t, 300);
            if (t.ToString().Contains(" - ")) { win = h; break; }
            fallback = h;
          }
        }
        if (win == IntPtr.Zero) win = fallback;
        if (deck == IntPtr.Zero || win == IntPtr.Zero) return;   // no deck window to share the screen with: the browser opens where it likes
        MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        GetMonitorInfo(MonitorFromWindow(deck, 2), ref mi);
        RECT wa = mi.rcWork; int w = wa.R - wa.L, h2 = wa.B - wa.T, left = (int)(w * 0.6);
        // a new browser window restores its own saved size just after it appears: place both again while it settles
        for (int k = 0; k < 8; k++) {
          ShowWindow(deck, 9); ShowWindow(win, 9);   // 9 = SW_RESTORE (out of maximized)
          SetWindowPos(deck, IntPtr.Zero, wa.L, wa.T, left, h2, 0x0044);   // SWP_NOZORDER | SWP_SHOWWINDOW
          SetWindowPos(win, IntPtr.Zero, wa.L + left, wa.T, w - left, h2, 0x0044);
          if (k == 0) SetForegroundWindow(win);
          Thread.Sleep(250);
        }
      } catch (Exception e) { Console.WriteLine("browser: " + e.Message); }
    });
    th.IsBackground = true; th.Start();
  }

  // the deck takes the whole screen again (the browser window stays open behind it)
  public static void DeckFull(int deckPid) {
    SetProcessDPIAware();
    IntPtr deck = DeckWindow(deckPid); if (deck == IntPtr.Zero) return;
    ShowWindow(deck, 3); SetForegroundWindow(deck);   // 3 = SW_MAXIMIZE
  }
}


// The deck's workbench (Deck.config({ workbench: true })): files of one demo folder for the in-deck editor. Every path is
// resolved inside that folder (nothing outside it can be read or written); serve.ps1 checks the key and the origin first.
public static class DeckFs {
  static readonly string[] Skip = { ".git", "node_modules", "bin", "obj", "target", ".venv", "venv", "__pycache__", ".idea", ".vs", ".pytest_cache", ".gradle" };
  static string J(string s) {
    StringBuilder b = new StringBuilder("\"");
    foreach (char c in s) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4")); else b.Append(c); }
    return b.Append('"').ToString();
  }
  // a path inside root, or null
  static string Inside(string root, string rel) {
    if (rel == null) return null;
    rel = rel.Replace('/', '\\').TrimStart('\\');
    if (rel.Contains(":")) return null;
    string full = System.IO.Path.GetFullPath(System.IO.Path.Combine(root, rel)), r = root.TrimEnd('\\');
    if (string.Equals(full, r, StringComparison.OrdinalIgnoreCase) || full.StartsWith(r + "\\", StringComparison.OrdinalIgnoreCase)) return full;
    return null;
  }
  static string Rel(string root, string full) { return full.Substring(root.Length).TrimStart('\\').Replace('\\', '/'); }
  static void Send(HttpListenerResponse res, int code, string type, byte[] body) {
    res.StatusCode = code; res.Headers.Add("Cache-Control", "no-store");
    if (body != null) { res.ContentType = type; res.ContentLength64 = body.Length; res.OutputStream.Write(body, 0, body.Length); }
    res.Close();
  }
  static void Text(HttpListenerResponse res, int code, string s) { Send(res, code, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(s)); }

  // each request on its own thread: a slow one (git status on a big repo) never holds up a save
  public static void Start(HttpListenerContext ctx, string root, string op) {
    Thread th = new Thread(delegate () { Handle(ctx, root, op); }); th.IsBackground = true; th.Start();
  }

  public static void Handle(HttpListenerContext ctx, string root, string op) {
    HttpListenerRequest req = ctx.Request; HttpListenerResponse res = ctx.Response;
    try {
      root = System.IO.Path.GetFullPath(root).TrimEnd('\\');
      bool post = req.HttpMethod == "POST";
      if (op == "list") {
        StringBuilder b = new StringBuilder("{\"root\":" + J(root) + ",\"entries\":["); int n = 0; bool first = true;
        Stack<string> todo = new Stack<string>(); todo.Push(root);
        while (todo.Count > 0 && n < 3000) {
          string d = todo.Pop(); string[] subs, fs;
          try { subs = Directory.GetDirectories(d); fs = Directory.GetFiles(d); } catch { continue; }
          foreach (string s in subs) {
            if (Array.IndexOf(Skip, System.IO.Path.GetFileName(s)) >= 0) continue;
            b.Append(first ? "" : ",").Append("{\"p\":" + J(Rel(root, s)) + ",\"d\":1}"); first = false; n++; todo.Push(s);
          }
          foreach (string f in fs) {
            FileInfo fi = new FileInfo(f);
            b.Append(first ? "" : ",").Append("{\"p\":" + J(Rel(root, f)) + ",\"d\":0,\"m\":" + fi.LastWriteTimeUtc.Ticks + ",\"s\":" + fi.Length + "}"); first = false; n++;
          }
        }
        b.Append("],\"more\":" + (n >= 3000 ? "true" : "false") + "}");
        Send(res, 200, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(b.ToString())); return;
      }
      if (op == "git") {
        System.Diagnostics.ProcessStartInfo si = new System.Diagnostics.ProcessStartInfo("git", "status --porcelain=v1 -uall");
        si.WorkingDirectory = root; si.UseShellExecute = false; si.RedirectStandardOutput = true; si.RedirectStandardError = true; si.CreateNoWindow = true;
        string outp = "";
        try { System.Diagnostics.Process p = System.Diagnostics.Process.Start(si); outp = p.StandardOutput.ReadToEnd(); p.WaitForExit(3000); if (p.ExitCode != 0) outp = ""; } catch { outp = ""; }
        Text(res, 200, outp); return;
      }
      if (op == "code" && post) {
        System.Diagnostics.ProcessStartInfo si = new System.Diagnostics.ProcessStartInfo("cmd.exe", "/c code \"" + root + "\"");
        si.UseShellExecute = false; si.CreateNoWindow = true;
        try { System.Diagnostics.Process.Start(si); Send(res, 204, null, null); } catch (Exception e) { Text(res, 500, "VS Code could not start: " + e.Message); }
        return;
      }
      string path = Inside(root, req.QueryString["path"]);
      if (op == "read") {
        if (path == null || !File.Exists(path)) { Text(res, 404, "No such file."); return; }
        FileInfo fi = new FileInfo(path);
        if (fi.Length > 2 * 1024 * 1024) { Text(res, 413, "This file is larger than 2 MB."); return; }
        byte[] data = File.ReadAllBytes(path);
        for (int i = 0; i < Math.Min(data.Length, 8000); i++) if (data[i] == 0) { Text(res, 415, "This looks like a binary file."); return; }
        res.Headers.Add("X-Mtime", fi.LastWriteTimeUtc.Ticks.ToString());
        Send(res, 200, "text/plain; charset=utf-8", data); return;
      }
      if (!post) { Text(res, 405, "Use POST."); return; }
      if (op == "write") {
        if (path == null || Directory.Exists(path)) { Text(res, 400, "Not a file inside the demo folder."); return; }
        MemoryStream ms = new MemoryStream(); req.InputStream.CopyTo(ms);
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)); File.WriteAllBytes(path, ms.ToArray());
        res.Headers.Add("X-Mtime", new FileInfo(path).LastWriteTimeUtc.Ticks.ToString()); Send(res, 204, null, null); return;
      }
      if (op == "mkdir") { if (path == null) { Text(res, 400, "Not inside the demo folder."); return; } Directory.CreateDirectory(path); Send(res, 204, null, null); return; }
      if (op == "rename") {
        string to = Inside(root, req.QueryString["to"]);
        if (path == null || to == null || string.Equals(path, root, StringComparison.OrdinalIgnoreCase)) { Text(res, 400, "Not inside the demo folder."); return; }
        if (File.Exists(to) || Directory.Exists(to)) { Text(res, 409, "Something with that name already exists."); return; }
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(to));
        if (Directory.Exists(path)) Directory.Move(path, to); else File.Move(path, to);
        Send(res, 204, null, null); return;
      }
      if (op == "delete") {
        if (path == null || string.Equals(path, root, StringComparison.OrdinalIgnoreCase)) { Text(res, 400, "Not inside the demo folder."); return; }
        if (Directory.Exists(path)) Directory.Delete(path, true); else if (File.Exists(path)) File.Delete(path); else { Text(res, 404, "No such file."); return; }
        Send(res, 204, null, null); return;
      }
      Text(res, 404, "Unknown request.");
    } catch (Exception e) { try { Text(res, 500, e.Message); } catch { } }
  }
}

// The deck's demo setup and demo projects (Deck.config({ demo: … })): the presenter's answers (_present\demo.json, local only),
// pre-flight checks of the tools a demo needs, and the demo project's stages (demo-projects\<lang>\stages\NN-id\), laid into the
// demo folder on request. serve.ps1 checks the key and the origin first.
public static class DeckDemo {
  public static string DeckRoot = "";
  static readonly System.Text.RegularExpressions.Regex Id = new System.Text.RegularExpressions.Regex("^[a-z0-9][a-z0-9-]{0,40}$");
  static void Send(HttpListenerResponse res, int code, string type, string body) {
    byte[] b = Encoding.UTF8.GetBytes(body ?? ""); res.StatusCode = code; res.Headers.Add("Cache-Control", "no-store");
    res.ContentType = type; res.ContentLength64 = b.Length; res.OutputStream.Write(b, 0, b.Length); res.Close();
  }
  static string J(string s) {
    StringBuilder b = new StringBuilder("\"");
    foreach (char c in s ?? "") { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4")); else b.Append(c); }
    return b.Append('"').ToString();
  }
  // run a known tool (never anything the page names), with a time limit
  static string[] Run(string cmdLine, int ms) {
    System.Diagnostics.ProcessStartInfo si = new System.Diagnostics.ProcessStartInfo("cmd.exe", "/c " + cmdLine + " 2>&1");
    si.UseShellExecute = false; si.RedirectStandardOutput = true; si.CreateNoWindow = true; si.StandardOutputEncoding = Encoding.UTF8;   // the CLIs (git, gh, glab) print UTF-8
    try {
      System.Diagnostics.Process p = System.Diagnostics.Process.Start(si);
      System.Threading.Tasks.Task<string> t = p.StandardOutput.ReadToEndAsync();
      if (!p.WaitForExit(ms)) { try { p.Kill(); } catch { } return new string[] { "0", "No answer within " + (ms / 1000) + " s." }; }
      return new string[] { p.ExitCode == 0 ? "1" : "0", t.Result.Trim() };
    } catch (Exception e) { return new string[] { "0", e.Message }; }
  }
  public static void Start(HttpListenerContext ctx, string workspace, string op) {
    Thread th = new Thread(delegate () { Handle(ctx, workspace, op); }); th.IsBackground = true; th.Start();
  }
  static void Handle(HttpListenerContext ctx, string workspace, string op) {
    HttpListenerRequest req = ctx.Request; HttpListenerResponse res = ctx.Response;
    try {
      string cfg = System.IO.Path.Combine(DeckRoot, "_present", "demo.json");
      if (op == "config") {
        if (req.HttpMethod == "POST") {
          MemoryStream ms = new MemoryStream(); req.InputStream.CopyTo(ms);
          if (ms.Length > 65536) { Send(res, 413, "text/plain", "Too large."); return; }
          File.WriteAllBytes(cfg, ms.ToArray()); Send(res, 200, "application/json", "{\"ok\":true}"); return;
        }
        if (!File.Exists(cfg)) { Send(res, 404, "application/json", "{}"); return; }
        Send(res, 200, "application/json; charset=utf-8", File.ReadAllText(cfg, Encoding.UTF8)); return;
      }
      if (op == "check") {
        string what = req.QueryString["what"] ?? "", arg = req.QueryString["arg"] ?? "";
        string[] r;
        if (what == "git") r = Run("git --version", 8000);
        else if (what == "gh") r = Run("gh auth status", 10000);
        else if (what == "glab") r = Run("glab auth status", 15000);
        else if (what == "ansible") r = Run("ansible --version", 15000);
        else if (what == "terraform") r = Run("terraform version", 15000);
        else if (what == "aws") r = Run("aws --version", 15000);
        else if (what == "az") r = Run("az version --output tsv", 30000);
        else if (what == "gcloud") r = Run("gcloud --version", 30000);
        else if (what == "gitlab") {
          var gm = System.Text.RegularExpressions.Regex.Match(arg, "^https?://([A-Za-z0-9.-]+(?::[0-9]+)?)/([A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+?)(?:\\.git)?/?$");
          if (!gm.Success) r = new string[] { "0", "Use the project's address, for example https://gitlab.com/my-group/orders-api." };
          else r = Run("glab repo view https://" + gm.Groups[1].Value + "/" + gm.Groups[2].Value, 20000);
        }
        else if (what == "docker") r = Run("docker info --format \"Docker {{.ServerVersion}} is running\"", 15000);
        else if (what == "kubectl") r = Run("kubectl config current-context", 8000);
        else if (what == "python") r = Run("python --version", 8000);
        else if (what == "node") r = Run("node --version", 8000);
        else if (what == "java") r = Run("mvn -v", 15000);
        else if (what == "dotnet") r = Run("dotnet --version", 8000);
        else if (what == "repo") {
          if (!System.Text.RegularExpressions.Regex.IsMatch(arg, "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")) r = new string[] { "0", "Use owner/name, for example my-org/orders-api." };
          else r = Run("gh repo view " + arg + " --json nameWithOwner,url --jq .url", 15000);
        }
        else if (what == "sonar") {
          if (!System.Text.RegularExpressions.Regex.IsMatch(arg, "^https?://[A-Za-z0-9.:_-]+(/[A-Za-z0-9._/-]*)?$")) r = new string[] { "0", "Use an address like http://localhost:9000." };
          else {
            try {
              HttpWebRequest w = (HttpWebRequest)WebRequest.Create(arg.TrimEnd('/') + "/api/system/status"); w.Timeout = 6000;
              using (WebResponse wr = w.GetResponse()) using (StreamReader sr = new StreamReader(wr.GetResponseStream())) {
                string body = sr.ReadToEnd(); r = new string[] { body.Contains("\"UP\"") ? "1" : "0", body.Contains("\"UP\"") ? "SonarQube is up." : "SonarQube answered: " + body };
              }
            } catch (Exception e) { r = new string[] { "0", "Not reachable: " + e.Message }; }
          }
        }
        else { Send(res, 400, "text/plain", "Unknown check."); return; }
        Send(res, 200, "application/json; charset=utf-8", "{\"ok\":" + (r[0] == "1" ? "true" : "false") + ",\"text\":" + J(r[1].Length > 600 ? r[1].Substring(0, 600) : r[1]) + "}"); return;
      }
      string lang = req.QueryString["lang"] ?? "";
      if (!Id.IsMatch(lang)) { Send(res, 400, "text/plain", "Unknown language."); return; }
      string proj = System.IO.Path.Combine(DeckRoot, "demo-projects", lang);
      if (op == "stages") {
        string sj = System.IO.Path.Combine(proj, "stages.json");
        if (!File.Exists(sj)) { Send(res, 404, "application/json", "[]"); return; }
        Send(res, 200, "application/json; charset=utf-8", File.ReadAllText(sj, Encoding.UTF8)); return;
      }
      if (op == "apply" && req.HttpMethod == "POST") {
        // lay a stage into the demo folder: every stage up to it, in order (each holds only the files that change)
        string stage = req.QueryString["stage"] ?? ""; if (!Id.IsMatch(stage)) { Send(res, 400, "text/plain", "Unknown stage."); return; }
        string sd = System.IO.Path.Combine(proj, "stages");
        if (!Directory.Exists(sd)) { Send(res, 404, "text/plain", "This deck has no demo project for " + lang + "."); return; }
        string[] dirs = Directory.GetDirectories(sd); Array.Sort(dirs, StringComparer.Ordinal);
        int upto = -1; for (int i = 0; i < dirs.Length; i++) { string n = System.IO.Path.GetFileName(dirs[i]); int dash = n.IndexOf('-'); if ((dash >= 0 ? n.Substring(dash + 1) : n) == stage) upto = i; }
        if (upto < 0) { Send(res, 404, "text/plain", "No stage " + stage + "."); return; }
        string ws = System.IO.Path.GetFullPath(workspace).TrimEnd('\\'); int n2 = 0;
        for (int i = 0; i <= upto; i++) {
          foreach (string f in Directory.GetFiles(dirs[i], "*", SearchOption.AllDirectories)) {
            string rel = f.Substring(dirs[i].Length).TrimStart('\\');
            string dst = System.IO.Path.GetFullPath(System.IO.Path.Combine(ws, rel));
            if (!dst.StartsWith(ws + "\\", StringComparison.OrdinalIgnoreCase)) continue;
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(dst)); File.Copy(f, dst, true); n2++;
          }
        }
        Send(res, 200, "application/json", "{\"ok\":true,\"files\":" + n2 + "}"); return;
      }
      Send(res, 404, "text/plain", "Unknown request.");
    } catch (Exception e) { try { Send(res, 500, "text/plain", e.Message); } catch { } }
  }
}
