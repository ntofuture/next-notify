import { BrowserWindow, screen, type Display, type WebContents } from 'electron'
import type { Config, Note } from '../types.js'
import type { Origin } from './origin.js'

const PAD = 28
const MARGIN = 16
const GAP = 10
const MAX = 5

type Entry = { win: BrowserWindow; note: Note; origin: Promise<Origin> | null; display: Display; position: string; height: number; closing?: boolean }

const live: Entry[] = []

export const entryFor = (sender: WebContents) => live.find((e) => e.win.webContents === sender)

export function showPopup({ note, origin, cfg, url, preload, icon }: { note: Note; origin: Promise<Origin> | null; cfg: Config; url: string; preload: string; icon: string }) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const win = new BrowserWindow({
    width: cfg.popup.width + PAD * 2,
    height: 200,
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
    focusable: false,
    alwaysOnTop: true,
    title: 'Next Notify',
    icon,
    webPreferences: { preload, sandbox: true, contextIsolation: true, backgroundThrottling: false },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const entry: Entry = { win, note, origin, display, position: cfg.popup.position, height: 0 }
  live.push(entry)
  win.on('closed', () => {
    live.splice(live.indexOf(entry), 1)
    layout()
  })
  win.webContents.once('did-finish-load', () => win.webContents.send('popup:show', { note, popup: cfg.popup }))
  win.loadURL(url)

  for (const old of live.filter((e) => !e.closing).slice(0, -MAX)) {
    old.closing = true
    old.win.close()
  }
}

export function popupReady(sender: WebContents, height: number) {
  const entry = entryFor(sender)
  if (!entry) return
  entry.height = Math.ceil(height)
  layout()
  entry.win.showInactive()
}

function layout() {
  const offsets = new Map<string, number>()
  for (let i = live.length - 1; i >= 0; i--) {
    const e = live[i]
    if (!e.height || e.win.isDestroyed()) continue
    const key = `${e.display.id}:${e.position}`
    const offset = offsets.get(key) ?? 0
    const wa = e.display.workArea
    const [width] = e.win.getSize()
    const card = width - PAD * 2
    const x = e.position.endsWith('left')
      ? wa.x + MARGIN - PAD
      : e.position.endsWith('right')
        ? wa.x + wa.width - MARGIN - card - PAD
        : wa.x + (wa.width - width) / 2
    const y = e.position.startsWith('top') ? wa.y + MARGIN + offset - PAD : wa.y + wa.height - MARGIN - offset - e.height - PAD
    e.win.setBounds({ x: Math.round(x), y: Math.round(y), width, height: e.height + PAD * 2 })
    offsets.set(key, offset + e.height + GAP)
  }
}
