import { BrowserWindow, screen, type WebContents } from 'electron'
import type { TrayState } from '../types.js'

const PAD = 14 // gölge payı, traymenu.html ile aynı
const WIDTH = 252 + PAD * 2

let win: BrowserWindow | undefined
let hiddenAt = 0

const alive = () => !!win && !win.isDestroyed()
export const isTrayMenu = (sender: WebContents) => alive() && win!.webContents === sender

export function showTrayMenu({ url, preload, icon, data }: { url: string; preload: string; icon: string; data: TrayState }) {
  // Odak kaybı tıklamadan hemen önce gelir.
  if (data.place && Date.now() - hiddenAt < 300) return
  if (!data.place && !(alive() && win!.isVisible())) return
  if (!alive()) create(url, preload, icon)
  const w = win!
  const send = () => w.webContents.send('tray:show', data)
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send)
  else send()
}

export function placeTrayMenu(height: number) {
  if (!alive()) return
  const point = screen.getCursorScreenPoint()
  const wa = screen.getDisplayNearestPoint(point).workArea
  const h = Math.ceil(height)
  const x = Math.min(Math.max(point.x - WIDTH / 2, wa.x), wa.x + wa.width - WIDTH)
  const y = point.y > wa.y + wa.height / 2 ? wa.y + wa.height - h : wa.y
  win!.setBounds({ x: Math.round(x), y: Math.round(y), width: WIDTH, height: h })
  win!.show()
  win!.focus()
}

export function hideTrayMenu() {
  if (alive() && win!.isVisible()) win!.hide()
}

function create(url: string, preload: string, icon: string) {
  const w = new BrowserWindow({
    width: WIDTH,
    height: 240,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Next Notify',
    icon,
    webPreferences: { preload, sandbox: true, contextIsolation: true },
  })
  w.setAlwaysOnTop(true, 'pop-up-menu')
  w.on('blur', () => {
    hiddenAt = Date.now()
    w.hide()
  })
  w.loadURL(url)
  win = w
}
