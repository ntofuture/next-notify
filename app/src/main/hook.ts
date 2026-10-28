import fs from 'node:fs'
import path from 'node:path'
import type { Agent, Category, Config, Hook, Note } from '../types.js'
import type { Translate } from '../renderer/shared/i18n.js'
import { AGENTS } from '../renderer/shared/look.js'

type Raw = Record<string, any>

const NORMALIZE: Record<Agent, (r: Raw) => Hook | null> = {
  claude: (r) => r,
  opencode: (r) => r,
  codex: (r) =>
    r.hook_event_name === 'Stop'
      ? { hook_event_name: 'Stop', last_assistant_message: r.last_assistant_message ?? '', cwd: r.cwd }
      : r.hook_event_name === 'PermissionRequest'
        ? { hook_event_name: 'Notification', notification_type: 'permission_prompt', message: String(r.tool_input?.description || r.tool_input?.command || r.tool_name || ''), cwd: r.cwd }
        : null,
  cursor: (r) => (r.hook_event_name === 'stop' && r.status !== 'aborted' ? { hook_event_name: 'Stop', cwd: r.workspace_roots?.[0] } : null),
  gemini: (r) =>
    r.hook_event_name === 'AfterAgent'
      ? { hook_event_name: 'Stop', last_assistant_message: r.prompt_response ?? '', cwd: r.cwd }
      : r.hook_event_name === 'Notification'
        ? { hook_event_name: 'Notification', notification_type: 'permission_prompt', message: r.message ?? '', cwd: r.cwd }
        : null,
}

export function normalize(agent: Agent, raw: Raw): Hook | null {
  const hook = NORMALIZE[agent](raw)
  return hook && { ...hook, agent }
}

export function categorize(hook: Hook): Category {
  if (hook.hook_event_name === 'Stop' || hook.hook_event_name === 'SubagentStop') return 'stop'
  const type = hook.notification_type ?? ''
  if (type === 'permission_prompt' || (!type && /permission/i.test(hook.message ?? ''))) return 'permission'
  return 'idle'
}

export function projectRoot(cwd: string) {
  for (let dir = cwd; path.dirname(dir) !== dir; dir = path.dirname(dir)) if (fs.existsSync(path.join(dir, '.git'))) return dir
  return cwd
}

export function plainText(text: string | undefined, max: number) {
  if (!text) return ''
  let t = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (max > 0 && t.length > max) t = `${t.slice(0, max).trimEnd()}…`
  return t
}

function transcriptTail(file: string) {
  let fd: number | undefined
  try {
    fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    const len = Math.min(size, 512 * 1024)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    const lines = buf.toString('utf8').split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"assistant"')) continue
      try {
        const o = JSON.parse(lines[i])
        if (o.type !== 'assistant') continue
        const content: { type: string; text?: string }[] = o.message?.content ?? []
        const text = content.filter((c) => c.type === 'text').map((c) => c.text).join(' ')
        if (text) return text
      } catch {}
    }
  } catch {
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
  return ''
}

const format = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))

export function buildNote(hook: Hook, cfg: Config, t: Translate): Note {
  const category = categorize(hook)
  const ev = cfg.events[category]
  const cwd = String(hook.cwd ?? '')
  const agent = hook.agent ?? 'claude'
  const project = cwd ? path.basename(projectRoot(cwd).replace(/[\\/]+$/, '')) : AGENTS[agent]
  const max = cfg.behavior.summaryLength
  const summary = category === 'stop' ? plainText(hook.last_assistant_message || (hook.transcript_path ? transcriptTail(hook.transcript_path) : ''), max) : ''
  const vars = {
    agent,
    project,
    cwd,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    message: plainText(hook.message, max) || (category === 'permission' ? t('ev.permission.fallback') : ''),
    summary: summary || t('ev.stop.fallback'),
  }
  return {
    category,
    cwd,
    project,
    time: vars.time,
    title: format(ev.title || t(`ev.${category}.title`), vars),
    body: format(ev.message, vars),
    icon: ev.icon,
    accent: ev.accent,
    sticky: ev.sticky,
    sound: ev.sound,
  }
}
