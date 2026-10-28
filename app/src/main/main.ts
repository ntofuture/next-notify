import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, Tray } from 'electron'
import updater from 'electron-updater'
import type { Agent, Category, Config, Hook, LogEntry, LogStatus, PluginStatus, Sample, ServerStatus, State, TrayAction } from '../types.js'
import { DEFAULTS, loadConfig, merge, resetConfig, saveConfig } from './config.js'
import { buildNote, normalize } from './hook.js'
import { clientPid, focusOrigin, resolveOrigin, type Origin } from './origin.js'
import { entryFor, popupReady, showPopup } from './popups.js'
import { startServer } from './server.js'
import { hideTrayMenu, isTrayMenu, placeTrayMenu, showTrayMenu } from './traymenu.js'
import { translator } from '../renderer/shared/i18n.js'

export const PORT = 47821
const REPO = 'ntofuture/next-notify'
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const PRELOAD = path.join(ROOT, 'out', 'src', 'preload.cjs')
const ICON = path.join(ROOT, 'assets', 'icon.png')
const AUDIO = /\.(wav|mp3|ogg|oga|m4a|flac|aac)$/i
const page = (name: string) => `app://next-notify/src/renderer/${name}.html`

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

if (!app.requestSingleInstanceLock()) app.exit()

let cfg: Config
let tray: Tray | undefined
let dashboard: BrowserWindow | null = null
let audioHost: BrowserWindow | undefined
let server: ServerStatus = { listening: false, error: null }
let lastHook: number | null = null
let pendingUrl = process.argv.find((a) => a.startsWith('nextnotify://'))
const events: LogEntry[] = []

const lang = () => (cfg.language === 'auto' ? (app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en') : cfg.language)
const t = (key: string, vars?: Record<string, string | number>) => translator(lang())(key, vars)

function serveFiles() {
  const allowed = [path.join(ROOT, 'src'), path.join(ROOT, 'out', 'src'), path.join(ROOT, 'assets')]
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.pathname === '/sound') {
      const file = url.searchParams.get('path') ?? ''
      if (!AUDIO.test(file) || !fs.existsSync(file)) return new Response(null, { status: 404 })
      return net.fetch(pathToFileURL(file).href)
    }
    const pathname = decodeURIComponent(url.pathname)
    const file = path.join(ROOT, pathname.endsWith('.js') ? 'out' : '', pathname)
    if (!allowed.some((dir) => file.startsWith(dir + path.sep))) return new Response(null, { status: 403 })
    return net.fetch(pathToFileURL(file).href)
  })
}

function notify(hook: Hook, { test = false, config = cfg, origin = null }: { test?: boolean; config?: Config; origin?: Promise<Origin> | null } = {}) {
  if (!test) lastHook = Date.now()
  const agent = hook.agent ?? 'claude'
  let note: Pick<LogEntry, 'category' | 'agent' | 'project' | 'title'> = { category: '?', agent, project: '', title: '' }
  try {
    const built = buildNote(hook, config, t)
    note = { ...built, agent }
    if (!config.enabled || !config.events[built.category].enabled) return log(note, 'skipped')
    if (config.sound.enabled) playSound(built.sound, config.sound.volume)
    showPopup({ note: built, origin, cfg: config, url: page('popup'), preload: PRELOAD, icon: ICON })
    log(note, test ? 'test' : 'shown')
  } catch (err) {
    log(note, 'error', (err as Error).message)
  }
}

async function openOrigin(origin: Promise<Origin> | null, cwd: string) {
  focusOrigin(await origin, cwd)
}

function onHook(raw: Hook, port: number, agent: Agent) {
  const hook = normalize(agent, raw)
  if (!hook) return Promise.resolve(null)
  const pid = clientPid(port, PORT)
  notify(hook, { origin: pid.then(resolveOrigin) })
  return pid
}

function playSound(spec: string, volume: number) {
  if (!spec) return
  if (!audioHost || audioHost.isDestroyed()) audioHost = createAudioHost()
  const contents = audioHost.webContents
  const send = () => contents.send('audio:play', { spec, volume })
  if (contents.isLoading()) contents.once('did-finish-load', send)
  else send()
}

function createAudioHost() {
  const win = new BrowserWindow({
    show: false,
    icon: ICON,
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  })
  win.loadURL(page('audio'))
  return win
}

function sampleHook(category: Category, { sample, project }: Sample = {}): Hook {
  const hook: Hook = {
    stop: { hook_event_name: 'Stop', last_assistant_message: t('sample.stop') },
    permission: { hook_event_name: 'Notification', notification_type: 'permission_prompt', message: t('sample.permission') },
    idle: { hook_event_name: 'Notification', notification_type: 'idle_prompt', message: t('sample.idle') },
  }[category]
  hook.cwd = path.join(os.homedir(), 'projects', project || 'next-notify')
  if (sample) hook[category === 'stop' ? 'last_assistant_message' : 'message'] = sample
  return hook
}

const test = (category: Category, opts: Sample & { config?: Config } = {}) => notify(sampleHook(category, opts), { test: true, config: opts.config ?? cfg })

function log(note: Pick<LogEntry, 'category' | 'agent' | 'project' | 'title'>, status: LogStatus, detail = '') {
  events.unshift({ at: Date.now(), category: note.category, agent: note.agent, project: note.project, title: note.title, status, detail })
  events.length = Math.min(events.length, 50)
  dashboard?.webContents.send('events', { events, lastHook })
}

function applyConfig(next: Config, { push = false } = {}) {
  cfg = saveConfig(next)
  syncAutostart()
  updateTrayMenu()
  if (push) dashboard?.webContents.send('config', cfg)
}

function syncAutostart() {
  if (!app.isPackaged) return
  if (process.platform !== 'linux') return app.setLoginItemSettings({ openAtLogin: cfg.autostart, args: ['--hidden'] })
  const file = path.join(app.getPath('appData'), 'autostart', 'next-notify.desktop')
  if (!cfg.autostart) return fs.rmSync(file, { force: true })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Next Notify\nExec="${process.env.APPIMAGE || process.execPath}" --hidden\nX-GNOME-Autostart-enabled=true\n`)
}

function pluginStatus(): PluginStatus {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  const read = (f: string) => {
    try {
      return fs.readFileSync(path.join(dir, f), 'utf8')
    } catch {
      return ''
    }
  }
  if (!read('plugins/installed_plugins.json').includes('"next-notify@')) return 'missing'
  return /"next-notify@[^"]+"\s*:\s*true/.test(read('settings.json')) ? 'ok' : 'off'
}

function agentStatus(): Record<Agent, boolean> {
  const home = os.homedir()
  const linked = (agent: Agent, ...file: string[]) => {
    try {
      return fs.readFileSync(path.join(home, ...file), 'utf8').includes(`/hook/${agent}`)
    } catch {
      return false
    }
  }
  return {
    claude: pluginStatus() === 'ok',
    codex: linked('codex', '.codex', 'hooks.json') || linked('codex', '.codex', 'config.toml'),
    cursor: linked('cursor', '.cursor', 'hooks.json'),
    gemini: linked('gemini', '.gemini', 'settings.json'),
    opencode: linked('opencode', '.config', 'opencode', 'plugins', 'next-notify.js'),
  }
}

function systemSounds() {
  const dir = ({ win32: path.join(process.env.SystemRoot || 'C:\\Windows', 'Media'), linux: '/usr/share/sounds/freedesktop/stereo' } as Record<string, string>)[process.platform]
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => AUDIO.test(f))
      .sort()
      .map((f) => ({ path: path.join(dir, f), name: f.replace(/\.[^.]+$/, '') }))
  } catch {
    return []
  }
}

function openDashboard() {
  if (dashboard) {
    if (dashboard.isMinimized()) dashboard.restore()
    dashboard.show()
    dashboard.focus()
    return
  }
  if (process.platform === 'darwin') app.dock?.show()
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'Next Notify',
    icon: ICON,
    backgroundColor: cfg.theme === 'light' ? '#f1f3f8' : '#05070c',
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true },
  })
  dashboard = win
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    dashboard = null
    if (process.platform === 'darwin') app.dock?.hide()
    if (updateReady) installUpdate()
  })
  if (!app.isPackaged) win.webContents.on('before-input-event', (_e, input) => input.key === 'F12' && input.type === 'keyDown' && win.webContents.toggleDevTools())
  win.loadURL(page('dashboard'))
}

const customTrayMenu = process.platform !== 'linux'

function createTray() {
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  tray = new Tray(nativeImage.createFromPath(path.join(ROOT, 'assets', file)))
  tray.setToolTip('Next Notify')
  if (process.platform === 'win32') tray.on('click', openDashboard)
  if (customTrayMenu) {
    tray.on('right-click', () => openTrayMenu(true))
    if (process.platform === 'darwin') tray.on('click', () => openTrayMenu(true))
  }
  updateTrayMenu()
}

const openTrayMenu = (place: boolean) =>
  showTrayMenu({ url: page('traymenu'), preload: PRELOAD, icon: ICON, data: { place, lang: lang(), theme: cfg.theme, enabled: cfg.enabled, listening: server.listening, port: PORT } })

const menuIcon = (name: string) => nativeImage.createFromPath(path.join(ROOT, 'assets', 'menu', `${name}.png`))

function updateTrayMenu() {
  if (customTrayMenu) return openTrayMenu(false)
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Next Notify', enabled: false },
      { type: 'separator' },
      { label: t('tray.open'), icon: menuIcon('settings'), click: openDashboard },
      { label: t('tray.test'), icon: menuIcon('test'), click: () => test('stop') },
      { type: 'separator' },
      cfg.enabled
        ? { label: t('tray.pause'), icon: menuIcon('pause'), click: () => applyConfig({ ...cfg, enabled: false }, { push: true }) }
        : { label: t('tray.resume'), icon: menuIcon('resume'), click: () => applyConfig({ ...cfg, enabled: true }, { push: true }) },
      { type: 'separator' },
      { label: t('tray.quit'), icon: menuIcon('quit'), role: 'quit' },
    ]),
  )
}

function handleUrl(url: string) {
  const { host, pathname } = new URL(url)
  const category = pathname.slice(1)
  if (host === 'test') return test(category in DEFAULTS.events ? (category as Category) : 'stop')
  openDashboard()
}

const { autoUpdater } = updater
const UPDATED = () => path.join(app.getPath('userData'), 'updated')
let updateReady = false

function checkForUpdate() {
  autoUpdater.on('error', () => {})
  autoUpdater.on('update-downloaded', () => {
    updateReady = true
    if (!dashboard) installUpdate()
  })
  autoUpdater.checkForUpdates().catch(() => {})
}

function installUpdate() {
  fs.writeFileSync(UPDATED(), '')
  autoUpdater.quitAndInstall(true, true)
}

ipcMain.handle(
  'state',
  (): State => ({
    config: cfg,
    lang: lang(),
    version: app.getVersion(),
    platform: process.platform,
    port: PORT,
    repo: REPO,
    server: { ...server },
    agents: agentStatus(),
    sounds: systemSounds(),
    events,
    lastHook,
  }),
)
ipcMain.handle('save', (_e, next: Config) => {
  applyConfig(next)
  return { config: cfg, lang: lang() }
})
ipcMain.handle('reset', () => {
  applyConfig(resetConfig())
  return { config: cfg, lang: lang() }
})
ipcMain.handle('preview', (_e, config: Config, category: Category, opts?: Sample) => test(category, { ...opts, config: merge(DEFAULTS, config) }))
ipcMain.handle('pick-sound', async () => {
  const options = {
    title: t('dialog.sound'),
    properties: ['openFile' as const],
    filters: [{ name: t('dialog.audio'), extensions: ['wav', 'mp3', 'ogg', 'oga', 'm4a', 'flac', 'aac'] }],
  }
  const r = dashboard ? await dialog.showOpenDialog(dashboard, options) : await dialog.showOpenDialog(options)
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('clear-events', () => {
  events.length = 0
})
ipcMain.on('popup:ready', (e, height: number) => popupReady(e.sender, height))
ipcMain.on('popup:click', (e) => {
  const entry = entryFor(e.sender)
  if (entry) openOrigin(entry.origin, entry.note.cwd)
})
ipcMain.on('popup:close', (e) => entryFor(e.sender)?.win.close())

ipcMain.on('tray:size', (e, height: number) => isTrayMenu(e.sender) && placeTrayMenu(height))
ipcMain.on('tray:action', (e, action: TrayAction) => {
  if (!isTrayMenu(e.sender)) return
  if (action === 'toggle') return applyConfig({ ...cfg, enabled: !cfg.enabled }, { push: true })
  hideTrayMenu()
  if (action === 'open') openDashboard()
  else if (action === 'test') test('stop')
  else if (action === 'quit') app.quit()
})

app.on('second-instance', (_e, argv) => {
  const url = argv.find((a) => a.startsWith('nextnotify://'))
  if (url) handleUrl(url)
  else openDashboard()
})
app.on('open-url', (e, url) => {
  e.preventDefault()
  if (app.isReady() && cfg) handleUrl(url)
  else pendingUrl = url
})
app.on('window-all-closed', () => {})
app.on('activate', openDashboard)

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.nexttofuture.nextnotify')
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
  if (app.isPackaged) app.setAsDefaultProtocolClient('nextnotify')
  cfg = loadConfig()
  const noAutostart = path.join(app.getPath('userData'), 'no-autostart')
  if (fs.existsSync(noAutostart)) {
    cfg = saveConfig({ ...cfg, autostart: false })
    fs.rmSync(noAutostart, { force: true })
  }
  serveFiles()
  createTray()
  audioHost = createAudioHost()
  syncAutostart()
  server = startServer(PORT, { hook: onHook, test, open: openDashboard, version: app.getVersion() })

  const updated = fs.existsSync(UPDATED())
  fs.rmSync(UPDATED(), { force: true })
  if (app.isPackaged) checkForUpdate()

  const hidden = updated || process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)
  if (pendingUrl) handleUrl(pendingUrl)
  else if (!hidden) openDashboard()
  else if (process.platform === 'darwin') app.dock?.hide()
})
