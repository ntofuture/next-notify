import { BrowserWindow, screen, type Display, type WebContents } from 'electron'
import type { Config, Note } from '../types.js'
import type { Origin } from './origin.js'

const PAD = 28
const MARGIN = 16

type Entry = { note: Note; origin: Promise<Origin> | null }
type Stack = { key: string; win: BrowserWindow; display: Display; position: string; ids: Set<number>; loaded: Promise<void> }

const stacks = new Map<string, Stack>()
const entries = new Map<number, Entry>()
let lastId = 0

export const entryFor = (id: number) => entries.get(id)

const stackFor = (sender: WebContents) => [...stacks.values()].find((s) => s.win.webContents === sender)

export function showPopup({ note, origin, cfg, url, preload, icon }: { note: Note; origin: Promise<Origin> | null; cfg: Config; url: string; preload: string; icon: string }) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const key = `${display.id}:${cfg.popup.position}:${cfg.popup.width}`
  const stack = stacks.get(key) ?? openStack(key, display, cfg, url, preload, icon)
  const id = ++lastId
  entries.set(id, { note, origin })
  stack.ids.add(id)
  const room = display.workArea.height - MARGIN + PAD
  stack.loaded.then(() => {
    if (!stack.win.isDestroyed()) stack.win.webContents.send('popup:show', { id, note, popup: cfg.popup, room })
  })
}

function openStack(key: string, display: Display, cfg: Config, url: string, preload: string, icon: string) {
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

  const loaded = new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()))
  const stack: Stack = { key, win, display, position: cfg.popup.position, ids: new Set(), loaded }
  stacks.set(key, stack)
  win.on('closed', () => {
    for (const id of stack.ids) entries.delete(id)
    if (stacks.get(key) === stack) stacks.delete(key)
  })
  win.loadURL(url)
  return stack
}

export function popupResize(sender: WebContents, height: number) {
  const stack = stackFor(sender)
  if (!stack) return
  const h = Math.ceil(height)
  const wa = stack.display.workArea
  const [width] = stack.win.getSize()
  const card = width - PAD * 2
  const x = stack.position.endsWith('left')
    ? wa.x + MARGIN - PAD
    : stack.position.endsWith('right')
      ? wa.x + wa.width - MARGIN - card - PAD
      : wa.x + (wa.width - width) / 2
  const y = stack.position.startsWith('top') ? wa.y : wa.y + wa.height - MARGIN + PAD - h
  stack.win.setBounds({ x: Math.round(x), y: Math.round(y), width, height: h })
  if (!stack.win.isVisible()) stack.win.showInactive()
}

export function popupClose(sender: WebContents, id: number) {
  const stack = stackFor(sender)
  if (!stack) return
  entries.delete(id)
  stack.ids.delete(id)
  if (stack.ids.size) return
  stacks.delete(stack.key)
  stack.win.close()
}
