import type { CardNote, PopupConfig } from '../../types.js'
import { FONTS, iconSvg, inkOn } from './look.js'

const CLOSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'

export function createCard(note: CardNote, popup: PopupConfig) {
  const shell = document.createElement('div')
  shell.className = 'nn-shell'
  shell.dataset.pos = popup.position
  shell.dataset.anim = popup.animation

  const card = document.createElement('div')
  card.className = 'nn-card'
  const timed = !note.sticky && popup.duration > 0
  card.dataset.titleFont = popup.fonts.title
  card.classList.toggle('striped', popup.accentStripe)
  card.classList.toggle('timed', timed)
  card.classList.toggle('progress', timed && popup.showProgress)
  const vars = {
    '--nn-bg': popup.colors.background,
    '--nn-title': popup.colors.title,
    '--nn-text': popup.colors.text,
    '--nn-muted': popup.colors.muted,
    '--nn-border': popup.colors.border,
    '--nn-accent': note.accent,
    '--nn-icon-ink': inkOn(note.accent),
    '--nn-radius': `${popup.radius}px`,
    '--nn-width': `${popup.width}px`,
    '--nn-opacity': String(popup.opacity),
    '--nn-font-project': FONTS[popup.fonts.project] ?? FONTS['Martian Mono'],
    '--nn-font-title': FONTS[popup.fonts.title] ?? FONTS.MuseoModerno,
    '--nn-font-body': FONTS[popup.fonts.body] ?? FONTS.REM,
    '--nn-duration': `${popup.duration}s`,
  }
  for (const [k, v] of Object.entries(vars)) card.style.setProperty(k, v)

  card.innerHTML = `
    <span class="nn-stripe"></span>
    <div class="nn-icon">${iconSvg(note.icon)}</div>
    <div class="nn-main">
      <div class="nn-meta"><b></b><span></span></div>
      <div class="nn-title"></div>
      <div class="nn-body"></div>
    </div>
    <button class="nn-close" type="button" aria-label="Close">${CLOSE}</button>
    <div class="nn-progress"><i></i></div>`
  const $ = (s: string) => card.querySelector<HTMLElement>(s)!
  $('.nn-meta').lang = 'en'
  $('.nn-meta b').textContent = note.project
  $('.nn-meta span').textContent = ` · ${note.time}`
  $('.nn-title').textContent = note.title
  $('.nn-body').textContent = note.body
  $('.nn-meta').hidden = !popup.showProject
  $('.nn-icon').hidden = !popup.showIcon || !note.icon
  $('.nn-stripe').hidden = !popup.accentStripe
  $('.nn-body').hidden = !note.body
  $('.nn-progress').hidden = !timed
  $('.nn-progress').classList.toggle('invisible', !popup.showProgress)

  shell.append(card)
  return shell
}
