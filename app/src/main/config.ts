import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { Config } from '../types.js'
import { THEMES } from '../renderer/shared/look.js'

export const DEFAULTS: Config = {
  enabled: true,
  language: 'auto',
  theme: 'dark',
  autostart: true,
  sound: { enabled: true, volume: 0.7 },
  popup: {
    theme: 'nextofuture',
    colors: { ...THEMES.nextofuture },
    position: 'bottom-right',
    duration: 7,
    width: 380,
    radius: 20,
    opacity: 0.98,
    animation: 'slide',
    fonts: { project: 'Martian Mono', title: 'MuseoModerno', body: 'REM' },
    showProject: true,
    showIcon: true,
    accentStripe: false,
    showProgress: true,
  },
  behavior: { summaryLength: 140 },
  events: {
    stop: { enabled: true, title: '', message: '{summary}', icon: 'check', accent: '#3BC7F5', sound: 'preset:chime', sticky: false },
    permission: { enabled: true, title: '', message: '{message}', icon: 'alert', accent: '#FFB547', sound: 'preset:pulse', sticky: true },
    idle: { enabled: true, title: '', message: '{message}', icon: 'wait', accent: '#FF3D77', sound: 'preset:soft', sticky: false },
  },
}

type Bag = Record<string, unknown>
const isObject = (v: unknown): v is Bag => v !== null && typeof v === 'object' && !Array.isArray(v)

export function merge<T>(base: T, over?: unknown): T {
  const out = structuredClone(base) as Bag
  if (!isObject(over)) return out as T
  for (const [k, v] of Object.entries(over)) {
    if (!(k in out)) continue
    out[k] = isObject(out[k]) ? merge(out[k], v) : v
  }
  return out as T
}

const file = () => path.join(app.getPath('userData'), 'config.json')

export function loadConfig() {
  try {
    return merge(DEFAULTS, JSON.parse(fs.readFileSync(file(), 'utf8')))
  } catch {
    return merge(DEFAULTS)
  }
}

export function saveConfig(next: Config) {
  const cfg = merge(DEFAULTS, next)
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(`${file()}.tmp`, JSON.stringify(cfg, null, 2))
  fs.renameSync(`${file()}.tmp`, file())
  return cfg
}

export function resetConfig() {
  fs.rmSync(file(), { force: true })
  return merge(DEFAULTS)
}
