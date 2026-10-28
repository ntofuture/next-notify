import type { Agent, Category, Config, Lang, State, Theme } from '../types.js'
import { createCard } from './shared/card.js'
import { translator, type Translate } from './shared/i18n.js'
import { ACCENTS, AGENTS, FONTS, ICONS, THEMES, iconSvg } from './shared/look.js'
import { PRESET_NAMES, playSound } from './shared/sounds.js'

type Field = HTMLInputElement | HTMLSelectElement
type Bag = Record<string, unknown>

const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!
const $$ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)]
const closest = (e: Event, s: string) => (e.target as Element).closest<HTMLElement>(s)
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const clock = (ts: number, seconds = false) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(seconds && { second: '2-digit' }) })
const CATEGORIES: Category[] = ['stop', 'permission', 'idle']
const VARS = ['agent', 'project', 'summary', 'message', 'time', 'cwd']
const FORMATS: Record<string, (v: number) => string> = {
  pct: (v) => `${Math.round(v * 100)}%`,
  sec: (v) => (v ? `${v}s` : '∞'),
  px: (v) => `${v}px`,
  chr: (v) => String(v),
}

let S: State
let cfg: Config
let lang: Lang
let t: Translate
let category: Category = 'stop'
let agent: Agent = 'claude'
let tab = 'design'
let seen = 0
try {
  seen = Number(localStorage.getItem('nn.seen')) || 0
} catch {}

const get = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Bag | undefined)?.[k], cfg)
function put(path: string, value: unknown) {
  const keys = path.split('.')
  const last = keys.pop()!
  keys.reduce((o, k) => o[k] as Bag, cfg as unknown as Bag)[last] = value
}
const pathOf = (el: HTMLElement) => el.dataset.path ?? `events.${category}.${el.dataset.ev}`

let saveTimer: ReturnType<typeof setTimeout> | undefined
function update(path: string, value: unknown) {
  put(path, value)
  if (path.startsWith('popup.colors.')) cfg.popup.theme = 'custom'
  commit()
}

function commit() {
  sync()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 300)
}

async function save() {
  const r = await window.nn.save(cfg)
  if (r.lang !== lang) applyLang(r.lang)
}

function sync() {
  for (const el of $$<Field>('[data-path], [data-ev]')) {
    const v = el.dataset.path === 'language' ? lang : get(pathOf(el))
    if (el.matches('.segmented, .posgrid')) for (const b of $$('button[data-v]', el)) b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))
    else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(v)
    else if (el.type !== 'text' || el !== document.activeElement) el.value = String(v)
  }
  for (const out of $$('output[data-show]')) out.textContent = FORMATS[out.dataset.fmt!](Number(get(out.dataset.show!)))

  const ev = cfg.events[category]
  for (const b of $$('#themes .theme')) b.setAttribute('aria-pressed', String(b.dataset.id === cfg.popup.theme))
  for (const b of $$('#icons button')) b.setAttribute('aria-pressed', String(b.dataset.icon === ev.icon))
  for (const b of $$('#accents button')) b.setAttribute('aria-pressed', String(b.dataset.c!.toLowerCase() === ev.accent.toLowerCase()))
  for (const b of $$('.event-tabs button')) {
    b.style.setProperty('--c', cfg.events[b.dataset.cat as Category].accent)
    b.setAttribute('aria-pressed', String(b.dataset.cat === category))
  }
  $<HTMLInputElement>('#evTitle').placeholder = t(`ev.${category}.title`)
  renderPreview()
}

function renderPreview(animate = false) {
  const ev = cfg.events[category]
  const project = $<HTMLInputElement>('#sampleProject').value.trim() || 'next-notify'
  const sample = $<HTMLInputElement>('#sampleText').value.trim()
  const max = cfg.behavior.summaryLength
  const clip = (s: string) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s)
  const time = clock(Date.now())
  const vars: Record<string, string> = {
    agent: 'claude',
    project,
    cwd: `~/projects/${project}`,
    time,
    summary: category === 'stop' ? clip(sample || t('sample.stop')) : t('ev.stop.fallback'),
    message: category === 'stop' ? '' : clip(sample || t(`sample.${category}`)),
  }
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
  const note = { title: fill(ev.title || t(`ev.${category}.title`)), body: fill(ev.message), project, time, icon: ev.icon, accent: ev.accent, sticky: ev.sticky }
  const shell = createCard(note, cfg.popup)
  if (animate) shell.classList.add('in')
  const desk = $('#desk')
  desk.dataset.pos = cfg.popup.position
  desk.replaceChildren(shell)
}

function applyLang(next: Lang) {
  lang = next
  t = translator(lang)
  document.documentElement.lang = lang
  build()
  sync()
  renderSetup()
  renderLog()
}

function build() {
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n!)
  for (const el of $$('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!)
  for (const b of $$('.posgrid button')) b.title = t(`pos.${b.dataset.v}`)

  $('#themes').innerHTML = Object.entries(THEMES)
    .map(([id, c]) => `<button class="theme" data-id="${id}" style="--c-bg:${c.background};--c-title:${c.title};--c-text:${c.text};--c-border:${c.border}"><span class="theme-card"><i></i><b></b><s></s></span>${esc(t(`theme.${id}`))}</button>`)
    .join('')
  for (const el of $$('.font-select')) el.innerHTML = Object.keys(FONTS).map((f) => `<option>${f}</option>`).join('')
  for (const el of $$('.event-tabs')) el.innerHTML = CATEGORIES.map((c) => `<button data-cat="${c}">${esc(t(`ev.${c}`))}</button>`).join('')
  $('#agentTabs').innerHTML = Object.entries(AGENTS).map(([id, name]) => `<button data-agent="${id}" lang="en"><i class="state"></i>${esc(name)}</button>`).join('')
  $('#vars').innerHTML = VARS.map((v) => `<button data-var="${v}" title="${esc(t(`var.${v}`))}">{${v}}</button>`).join('')
  $('#icons').innerHTML = [...Object.keys(ICONS), '']
    .map((id) => `<button data-icon="${id}" title="${id || '—'}">${id ? iconSvg(id, 16) : '—'}</button>`)
    .join('')
  $('#accents').innerHTML = ACCENTS.map((c) => `<button data-c="${c}" style="--c:${c}" title="${c}"></button>`).join('')
  buildSounds()
}

function buildSounds() {
  const sel = $<HTMLSelectElement>('#evSound')
  const current = cfg.events[category].sound
  const presets = PRESET_NAMES.map((n) => `<option value="preset:${n}">${esc(t(`preset.${n}`))}</option>`).join('')
  const system = S.sounds.map((s) => `<option value="${esc(s.path)}">${esc(s.name)}</option>`).join('')
  const known = !current || current.startsWith('preset:') || S.sounds.some((s) => s.path === current)
  sel.innerHTML =
    `<option value="">${esc(t('sound.none'))}</option>` +
    `<optgroup label="${esc(t('sound.presets'))}">${presets}</optgroup>` +
    (system ? `<optgroup label="${esc(t('sound.system'))}">${system}</optgroup>` : '') +
    (known ? '' : `<optgroup label="${esc(t('sound.custom'))}"><option value="${esc(current)}">${esc(current.split(/[\\/]/).pop())}</option></optgroup>`) +
    `<option value="__pick">${esc(t('sound.pick'))}</option>`
  sel.value = current
}

function renderSetup() {
  const ok = S.server.listening
  $('#serverStatus').classList.toggle('error', !ok)
  $('#serverStatus span').textContent = ok ? `${t('setup.listening')} · ${S.port}` : `${t('log.error')} · ${S.port}`
  $('#appStatus').textContent = ok ? `${t('setup.listening')} · 127.0.0.1:${S.port}` : t('setup.portBusy', { port: S.port })
  $('#appState').className = `state ${ok ? 'ok' : 'error'}`
  const linked = (Object.keys(AGENTS) as Agent[]).filter((a) => S.agents[a])
  $('#agentsStatus').textContent = linked.length ? linked.map((a) => AGENTS[a]).join(', ') : t('setup.agents.none')
  $('#agentsState').className = `state ${linked.length ? 'ok' : ''}`
  $('#setupState').className = `state ${!ok ? 'error' : linked.length ? 'ok' : 'warn'}`
  renderAgent()
  $('#lastHook').textContent = S.lastHook ? clock(S.lastHook, true) : t('setup.noHook')
  $('#hookState').className = `state ${S.lastHook ? 'ok' : ''}`
  $('#version').textContent = `next notify v${S.version} · ${S.platform}`
}

function agentSetup(id: Agent) {
  const win = S.platform === 'win32'
  const url = (a: Agent) => `http://127.0.0.1:${S.port}/hook/${a}`
  const curl = (a: Agent) => `${win ? 'curl.exe' : 'curl'} -s -m 5 --data-binary "@-" ${url(a)}`
  const home = (...parts: string[]) => (win ? `%USERPROFILE%\\${parts.join('\\')}` : `~/${parts.join('/')}`)
  const json = (value: unknown) => JSON.stringify(value, null, 2)
  const command = (a: Agent) => [{ hooks: [{ type: 'command', command: curl(a) }] }]
  if (id === 'claude') return { commands: [`/plugin marketplace add ${S.repo}`, '/plugin install next-notify@next-notify'] }
  if (id === 'codex') return { file: home('.codex', 'hooks.json'), code: json({ hooks: { Stop: command(id), PermissionRequest: command(id) } }) }
  if (id === 'cursor') return { file: home('.cursor', 'hooks.json'), code: json({ version: 1, hooks: { stop: [{ command: curl(id) }] } }) }
  if (id === 'gemini') return { file: home('.gemini', 'settings.json'), code: json({ hooks: { AfterAgent: command(id), Notification: command(id) } }) }
  return {
    file: home('.config', 'opencode', 'plugins', 'next-notify.js'),
    code: `export const NextNotify = async ({ directory }) => {
  const send = (body) =>
    fetch('${url(id)}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: directory, ...body }),
    }).catch(() => {})
  return {
    event: async ({ event }) => {
      if (event.type === 'session.idle') await send({ hook_event_name: 'Stop' })
      if (event.type === 'permission.asked') await send({ hook_event_name: 'Notification', notification_type: 'permission_prompt', message: event.properties?.title ?? '' })
    },
  }
}`,
  }
}

function renderAgent() {
  for (const b of $$('#agentTabs button')) {
    b.setAttribute('aria-pressed', String(b.dataset.agent === agent))
    b.firstElementChild!.className = `state ${S.agents[b.dataset.agent as Agent] ? 'ok' : ''}`
  }
  const setup = agentSetup(agent)
  const copy = `<button class="icon-button copy" title="${esc(t('copy'))}">⧉</button>`
  $('#agentSetup').innerHTML =
    `<small>${esc(t(`agent.${agent}.hint`))}</small>` +
    (setup.commands?.map((c) => `<div class="cmd"><code>${esc(c)}</code>${copy}</div>`).join('') ?? '') +
    (setup.file ? `<code class="path">${esc(setup.file)}</code><div class="cmd block"><pre>${esc(setup.code)}</pre>${copy}</div>` : '')
}

function renderLog() {
  const unread = $('#eventsPop').hidden ? S.events.filter((e) => e.at > seen).length : 0
  $('#bellBadge').hidden = !unread
  $('#bellBadge').textContent = unread > 9 ? '9+' : String(unread)
  const log = $('#log')
  if (!S.events.length) {
    log.innerHTML = `<li class="empty">${esc(t('events.empty'))}</li>`
    return
  }
  log.innerHTML = S.events
    .map((e) => {
      const color = esc(e.category === '?' ? 'var(--ink-mute)' : cfg.events[e.category].accent)
      const detail = e.detail ? ` · ${esc(e.detail)}` : ''
      return `<li class="${esc(e.status)}"><span class="ev-dot" style="--c:${color}"></span><div><b>${esc(e.title || '—')}</b><small>${clock(e.at, true)} · ${esc(AGENTS[e.agent])} · ${esc(e.project)} · ${esc(t(`log.${e.status}`))}${detail}</small></div></li>`
    })
    .join('')
}

function showTab() {
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab))
  for (const p of $$('.tab-panel')) p.hidden = p.dataset.panel !== tab
}

function showSetup(open: boolean) {
  $('#setupSheet').hidden = !open
  $('#btnSetup').setAttribute('aria-expanded', String(open))
  if (open) refresh()
  ;(open ? $('#btnSetupClose') : $('#btnSetup')).focus()
}

function showEvents(open: boolean) {
  $('#eventsPop').hidden = !open
  $('#btnBell').setAttribute('aria-expanded', String(open))
  seen = Date.now()
  try {
    localStorage.setItem('nn.seen', String(seen))
  } catch {}
  renderLog()
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  drawStars()
}

function switchTheme(event: MouseEvent) {
  const next = cfg.theme === 'light' ? 'dark' : 'light'
  const change = () => {
    setTheme(next)
    update('theme', next)
  }
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return change()
  const { clientX: x, clientY: y } = event
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  document.startViewTransition(change).ready.then(() =>
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 800, easing: 'cubic-bezier(0.77, 0.2, 0.05, 1)', pseudoElement: '::view-transition-new(root)' },
    ),
  )
}

function drawStars() {
  const canvas = $<HTMLCanvasElement>('#stars')
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(innerWidth * dpr)
  canvas.height = Math.round(innerHeight * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink-rgb')
  const light = document.documentElement.dataset.theme === 'light'
  let seed = 2325
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 220; i++) {
    const depth = random()
    ctx.fillStyle = `rgba(${ink}, ${light ? 0.08 + depth * 0.22 : 0.12 + depth * 0.5})`
    ctx.fillRect(Math.round(random() * innerWidth), Math.round(random() * innerHeight), depth > 0.92 ? 2 : 1, depth > 0.92 ? 2 : 1)
  }
}

function bind() {
  for (const el of $$('.segmented[data-path], .posgrid[data-path]')) {
    el.addEventListener('click', (e) => {
      const b = closest(e, 'button[data-v]')
      if (b) update(el.dataset.path!, b.dataset.v)
    })
  }
  for (const el of $$<Field>('input[data-path], select[data-path], input[data-ev]')) {
    const checkbox = el instanceof HTMLInputElement && el.type === 'checkbox'
    el.addEventListener(checkbox || el instanceof HTMLSelectElement ? 'change' : 'input', () =>
      update(pathOf(el), checkbox ? (el as HTMLInputElement).checked : el.type === 'range' ? Number(el.value) : el.value),
    )
  }

  $('.tabs').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-tab]')
    if (!b) return
    tab = b.dataset.tab!
    showTab()
  })
  $('#themes').addEventListener('click', (e) => {
    const b = closest(e, '.theme')
    if (!b) return
    cfg.popup.theme = b.dataset.id!
    cfg.popup.colors = { ...THEMES[b.dataset.id!] }
    commit()
  })
  for (const el of $$('.event-tabs')) {
    el.addEventListener('click', (e) => {
      const b = closest(e, 'button[data-cat]')
      if (!b) return
      category = b.dataset.cat as Category
      buildSounds()
      sync()
    })
  }
  $('#vars').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-var]')
    if (!b) return
    const input = $<HTMLInputElement>('#evMessage')
    const token = `{${b.dataset.var}}`
    const start = input.selectionStart ?? input.value.length
    const value = input.value.slice(0, start) + token + input.value.slice(input.selectionEnd ?? start)
    update(`events.${category}.message`, value)
    input.focus()
    input.setSelectionRange(start + token.length, start + token.length)
  })
  $('#icons').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-icon]')
    if (b) update(`events.${category}.icon`, b.dataset.icon)
  })
  $('#accents').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-c]')
    if (b) update(`events.${category}.accent`, b.dataset.c)
  })
  $<HTMLSelectElement>('#evSound').addEventListener('change', async (e) => {
    let value: string | null = (e.target as HTMLSelectElement).value
    if (value === '__pick') {
      value = await window.nn.pickSound()
      if (!value) return buildSounds()
    }
    update(`events.${category}.sound`, value)
    buildSounds()
    playSound(value, cfg.sound.volume)
  })
  const play = () => playSound(cfg.events[category].sound, cfg.sound.volume)
  $('#btnEvSound').addEventListener('click', play)
  $('#btnSound').addEventListener('click', play)
  $('input[data-path="sound.volume"]').addEventListener('change', play)
  $('#btnReplay').addEventListener('click', () => renderPreview(true))
  for (const b of $$('button.test')) {
    b.addEventListener('click', () =>
      window.nn.preview(cfg, category, { project: $<HTMLInputElement>('#sampleProject').value.trim(), sample: $<HTMLInputElement>('#sampleText').value.trim() }),
    )
  }
  $('#sampleProject').addEventListener('input', () => renderPreview())
  $('#sampleText').addEventListener('input', () => renderPreview())
  $('#btnSetup').addEventListener('click', () => showSetup(true))
  $('#btnSetupClose').addEventListener('click', () => showSetup(false))
  $('#btnBell').addEventListener('click', () => showEvents(Boolean($('#eventsPop').hidden)))
  addEventListener('pointerdown', (e) => !$('#eventsPop').hidden && !closest(e, '.bell-wrap') && showEvents(false))
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (!$('#eventsPop').hidden) showEvents(false)
    else if (!$('#setupSheet').hidden) showSetup(false)
  })
  $('#themeSwitch').addEventListener('click', switchTheme)
  $('#btnReset').addEventListener('click', async () => {
    if (!confirm(t('reset.confirm'))) return
    const r = await window.nn.reset()
    cfg = r.config
    setTheme(cfg.theme)
    applyLang(r.lang)
  })
  $('#btnClear').addEventListener('click', async () => {
    await window.nn.clearEvents()
    S.events = []
    renderLog()
  })
  $('#agentTabs').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-agent]')
    if (!b) return
    agent = b.dataset.agent as Agent
    renderAgent()
  })
  $('#agentSetup').addEventListener('click', async (e) => {
    const b = closest(e, '.copy')
    if (!b) return
    await navigator.clipboard.writeText(b.previousElementSibling!.textContent ?? '')
    b.textContent = '✓'
    setTimeout(() => (b.textContent = '⧉'), 1200)
  })
  addEventListener('resize', drawStars)
  addEventListener('focus', refresh)
}

async function refresh() {
  const s = await window.nn.state()
  Object.assign(S, { server: s.server, agents: s.agents, lastHook: s.lastHook, events: s.events })
  renderSetup()
  renderLog()
}

async function init() {
  S = await window.nn.state()
  cfg = S.config
  setTheme(cfg.theme)
  bind()
  applyLang(S.lang)
  showTab()
  window.nn.onEvents(({ events, lastHook }) => {
    Object.assign(S, { events, lastHook })
    renderLog()
    renderSetup()
  })
  window.nn.onConfig((next) => {
    cfg = next
    sync()
  })
  setTimeout(refresh, 800)
}

init()
