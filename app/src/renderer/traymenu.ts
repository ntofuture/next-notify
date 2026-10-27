import type { TrayAction } from '../types.js'
import { translator } from './shared/i18n.js'
import { MENU_ICONS } from './shared/look.js'

const $ = (s: string) => document.querySelector<HTMLElement>(s)!
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)]
const svg = (body: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

for (const el of $$('[data-icon]')) el.innerHTML = svg(MENU_ICONS[el.dataset.icon!])

window.nn.onTray(async (s) => {
  const t = translator(s.lang)
  document.documentElement.dataset.theme = s.theme
  document.documentElement.lang = s.lang
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n!)
  $('#toggle').setAttribute('aria-checked', String(s.enabled))
  const status = $('#status')
  status.classList.toggle('paused', !s.enabled)
  status.classList.toggle('error', s.enabled && !s.listening)
  status.lastElementChild!.textContent = !s.enabled ? t('tray.paused') : s.listening ? `${t('setup.listening')} · ${s.port}` : `${t('log.error')} · ${s.port}`
  if (!s.place) return
  await document.fonts.ready
  window.nn.traySize(document.body.offsetHeight)
  $('#menu').focus()
})

$('#menu').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-action]')
  if (b) window.nn.trayAction(b.dataset.action as TrayAction)
})

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return window.nn.trayAction('close')
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const items = $$('.item')
  const i = items.indexOf(document.activeElement as HTMLElement)
  items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1 + (i < 0 ? 1 : 0))) % items.length].focus()
})
