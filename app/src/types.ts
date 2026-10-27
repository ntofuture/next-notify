export type Lang = 'tr' | 'en'
export type Category = 'stop' | 'permission' | 'idle'
export type Agent = 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
export type Theme = 'dark' | 'light'

export type Colors = { background: string; title: string; text: string; muted: string; border: string }

export type PopupConfig = {
  theme: string
  colors: Colors
  position: string
  duration: number
  width: number
  radius: number
  opacity: number
  animation: string
  fonts: { project: string; title: string; body: string }
  showProject: boolean
  showIcon: boolean
  accentStripe: boolean
  showProgress: boolean
}

export type EventConfig = { enabled: boolean; title: string; message: string; icon: string; accent: string; sound: string; sticky: boolean }

export type Config = {
  enabled: boolean
  language: 'auto' | Lang
  theme: Theme
  autostart: boolean
  sound: { enabled: boolean; volume: number }
  popup: PopupConfig
  behavior: { summaryLength: number }
  events: Record<Category, EventConfig>
}

export type Hook = {
  hook_event_name?: string
  notification_type?: string
  message?: string
  last_assistant_message?: string
  transcript_path?: string
  cwd?: string
  agent?: Agent
}

export type Note = {
  category: Category
  cwd: string
  project: string
  time: string
  title: string
  body: string
  icon: string
  accent: string
  sticky: boolean
  sound: string
}

export type CardNote = Pick<Note, 'title' | 'body' | 'project' | 'time' | 'icon' | 'accent' | 'sticky'>

export type LogStatus = 'shown' | 'skipped' | 'error' | 'test'
export type LogEntry = { at: number; category: Category | '?'; agent: Agent; project: string; title: string; status: LogStatus; detail: string }

export type ServerStatus = { listening: boolean; error: string | null }
export type PluginStatus = 'ok' | 'off' | 'missing'
export type SystemSound = { path: string; name: string }

export type State = {
  config: Config
  lang: Lang
  version: string
  platform: string
  port: number
  repo: string
  server: ServerStatus
  agents: Record<Agent, boolean>
  sounds: SystemSound[]
  events: LogEntry[]
  lastHook: number | null
}

export type TrayState = { place: boolean; lang: Lang; theme: Theme; enabled: boolean; listening: boolean; port: number }
export type TrayAction = 'open' | 'test' | 'toggle' | 'quit' | 'close'
export type Sample = { project?: string; sample?: string }

export type NnApi = {
  state: () => Promise<State>
  save: (config: Config) => Promise<{ config: Config; lang: Lang }>
  reset: () => Promise<{ config: Config; lang: Lang }>
  preview: (config: Config, category: Category, opts?: Sample) => Promise<void>
  pickSound: () => Promise<string | null>
  clearEvents: () => Promise<void>
  onEvents: (cb: (data: { events: LogEntry[]; lastHook: number | null }) => void) => void
  onConfig: (cb: (config: Config) => void) => void

  onShow: (cb: (data: { note: CardNote; popup: PopupConfig }) => void) => void
  ready: (height: number) => void
  click: () => void
  close: () => void

  onPlay: (cb: (data: { spec: string; volume: number }) => void) => void

  onTray: (cb: (data: TrayState) => void) => void
  traySize: (height: number) => void
  trayAction: (action: TrayAction) => void
}

declare global {
  interface Window {
    nn: NnApi
  }
}
