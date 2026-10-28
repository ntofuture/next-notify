import type { Agent, Colors } from '../../types.js'

export const AGENTS: Record<Agent, string> = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor', gemini: 'Gemini CLI', opencode: 'OpenCode' }

export const THEMES: Record<string, Colors> = {
  nextofuture: { background: '#0C111B', title: '#F2F5FB', text: '#A3ACBE', muted: '#737D92', border: '#232A38' },
  space: { background: '#05070C', title: '#F2F5FB', text: '#C9D2E3', muted: '#5F6980', border: '#1A2030' },
  daylight: { background: '#FFFFFF', title: '#091230', text: '#46516A', muted: '#636D84', border: '#DDE1EA' },
  graphite: { background: '#1E1F22', title: '#ECECEC', text: '#B5B5B5', muted: '#8A8A8A', border: '#34363B' },
  brand: { background: '#0B58DC', title: '#FFFFFF', text: '#DCE7FF', muted: '#A9C3F5', border: '#3A7BEA' },
}

export const ICONS: Record<string, string> = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 6.5v7.5"/><path d="M12 18h.01"/>',
  wait: '<path d="M6.5 12h.01M12 12h.01M17.5 12h.01" stroke-width="3.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6"/>',
  question: '<path d="M9.2 9.2a2.8 2.8 0 1 1 4 2.5c-.7.4-1.2 1-1.2 1.8v.5"/><path d="M12 18h.01"/>',
}

export const MENU_ICONS: Record<string, string> = {
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  test: ICONS.bell,
  pause: '<path d="M9 6.5v11M15 6.5v11"/>',
  resume: '<path d="M8.5 6.5v11l9-5.5z"/>',
  quit: '<path d="M12 4v7"/><path d="M7.1 7.1a7 7 0 1 0 9.8 0"/>',
}

export const iconSvg = (name: string, size = 18) =>
  ICONS[name]
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
    : ''

export const FONTS: Record<string, string> = {
  REM: '"REM", system-ui, sans-serif',
  MuseoModerno: '"MuseoModerno", system-ui, sans-serif',
  'Martian Mono': '"Martian Mono", ui-monospace, monospace',
  System: 'system-ui, -apple-system, "Segoe UI", Ubuntu, sans-serif',
}

export const ACCENTS = ['#3BC7F5', '#0B58DC', '#FF3D77', '#FFB547', '#2EC88C', '#A17DE4', '#F2F5FB', '#E5A067']

export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#05070C' : '#FFFFFF'
}
