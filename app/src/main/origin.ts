import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'

export type Origin = { protocol: string; pids: number[] } | { win: number } | { app: string } | null
type Proc = { pid: number; exe: string; win?: number }

const run = (file: string, args: string[]) =>
  new Promise<string>((resolve) => execFile(file, args, { windowsHide: true, timeout: 8000, maxBuffer: 8 << 20 }, (err, out) => resolve(err ? '' : out)))
const ps = (script: string) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script])

export async function clientPid(port: number, serverPort: number) {
  if (process.platform === 'win32') {
    const out = await run('netstat', ['-ano', '-p', 'TCP'])
    const line = out.split('\n').find((l) => l.includes(`127.0.0.1:${port} `) && l.includes(`127.0.0.1:${serverPort} `))
    return Number(line?.trim().split(/\s+/).pop()) || null
  }
  if (process.platform === 'darwin') {
    const out = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:ESTABLISHED', '-Fp'])
    return out.split('\n').map((l) => Number(l.slice(1))).find((pid) => pid && pid !== process.pid) ?? null
  }
  const out = await run('ss', ['-tnpH', 'state', 'established', `( sport = :${port} )`])
  return Number(out.match(/pid=(\d+)/)?.[1]) || null
}

async function ancestors(pid: number) {
  const chain: Proc[] = []
  if (process.platform === 'win32') {
    const out = await ps(`$all = @{}; Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,ExecutablePath | ForEach-Object { $all[[int]$_.ProcessId] = $_ }
$id = ${pid}; $n = 0
while ($all.ContainsKey($id) -and $n -lt 16) { $p = $all[$id]; "$id|$($p.ExecutablePath)|$((Get-Process -Id $id -ErrorAction SilentlyContinue).MainWindowHandle)"; $id = [int]$p.ParentProcessId; $n++ }`)
    for (const line of out.trim().split(/\r?\n/).filter(Boolean)) {
      const [id, exe, win] = line.split('|')
      chain.push({ pid: Number(id), exe, win: Number(win) || 0 })
    }
    return chain
  }
  if (process.platform === 'darwin') {
    const procs = new Map<number, { ppid: number; exe: string }>()
    for (const line of (await run('ps', ['-A', '-o', 'pid=,ppid=,comm='])).split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
      if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), exe: m[3] })
    }
    for (let id = pid; procs.has(id) && chain.length < 16; id = procs.get(id)!.ppid) chain.push({ pid: id, exe: procs.get(id)!.exe })
    return chain
  }
  for (let id = pid; id > 1 && chain.length < 16; ) {
    try {
      chain.push({ pid: id, exe: fs.readlinkSync(`/proc/${id}/exe`) })
      id = Number(fs.readFileSync(`/proc/${id}/stat`, 'utf8').split(') ')[1].split(' ')[1])
    } catch {
      break
    }
  }
  return chain
}

const protocols = new Map<string, string | null>()
function editorProtocol(exe: string) {
  if (!exe) return null
  if (protocols.has(exe)) return protocols.get(exe)!
  const dir = path.dirname(exe)
  const candidates = [path.join(dir, 'resources', 'app'), path.join(dir, '..', 'Resources', 'app')]
  try {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) if (d.isDirectory()) candidates.push(path.join(dir, d.name, 'resources', 'app'))
  } catch {}
  let protocol: string | null = null
  for (const c of candidates) {
    try {
      protocol = JSON.parse(fs.readFileSync(path.join(c, 'product.json'), 'utf8')).urlProtocol || null
      if (protocol) break
    } catch {}
  }
  protocols.set(exe, protocol)
  return protocol
}

export async function resolveOrigin(pid: number | null): Promise<Origin> {
  if (!pid) return null
  const chain = await ancestors(pid)
  for (const p of chain) {
    const protocol = editorProtocol(p.exe)
    if (protocol) return { protocol, pids: chain.filter((c) => c.exe === p.exe).map((c) => c.pid) }
  }
  if (process.platform === 'win32') {
    const win = chain.find((p) => p.win)?.win
    return win ? { win } : null
  }
  if (process.platform === 'darwin') {
    const app = chain.map((p) => p.exe.match(/^(.*?\.app)\//)?.[1]).find(Boolean)
    return app ? { app } : null
  }
  return null
}

const USER32 = `Add-Type -Namespace NN -Name W -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
public delegate bool CB(IntPtr h, IntPtr l);
[DllImport("user32.dll")] static extern bool EnumWindows(CB cb, IntPtr l);
[DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
public static IntPtr Find(uint[] pids, string[] names) {
  var wins = new System.Collections.Generic.List<System.Tuple<IntPtr, string[]>>();
  EnumWindows((h, l) => {
    uint p; GetWindowThreadProcessId(h, out p);
    if (IsWindowVisible(h) && Array.IndexOf(pids, p) >= 0) { var s = new System.Text.StringBuilder(512); GetWindowText(h, s, 512); wins.Add(System.Tuple.Create(h, s.ToString().Split(new[] { " - " }, StringSplitOptions.None))); }
    return true;
  }, IntPtr.Zero);
  foreach (var n in names) foreach (var w in wins) foreach (var part in w.Item2) if (string.Equals(part.Trim(), n, StringComparison.OrdinalIgnoreCase)) return w.Item1;
  return IntPtr.Zero;
}'`

const FOCUS = `if ([NN.W]::IsIconic($h)) { [void][NN.W]::ShowWindow($h, 9) }
[NN.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [NN.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
[void][NN.W]::SetForegroundWindow($h)`

async function focusWindow(pids: number[], cwd: string) {
  const names: string[] = []
  for (let dir = cwd; path.dirname(dir) !== dir; dir = path.dirname(dir)) names.push(`'${path.basename(dir).replace(/'/g, "''")}'`)
  const out = await ps(`${USER32}
$h = [NN.W]::Find(@(${pids.join(',')}), @(${names.join(',')}))
if ($h -eq [IntPtr]::Zero) { 'none' } else { ${FOCUS}; 'found' }`)
  return out.trim()
}

export async function focusOrigin(origin: Origin, cwd: string) {
  if (!origin) return
  if ('protocol' in origin) {
    if (!cwd) return
    if (process.platform === 'win32' && (await focusWindow(origin.pids, cwd)) !== 'none') return
    const target = `/${cwd.replace(/\\/g, '/').replace(/^\/+/, '')}`
    return shell.openExternal(encodeURI(`${origin.protocol}://file${target}`)).catch(() => {})
  }
  if ('app' in origin) return run('open', ['-a', origin.app])
  return ps(`${USER32}
$h = [IntPtr]${origin.win}
${FOCUS}`)
}
