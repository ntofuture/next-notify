// [frekans (Hz), başlangıç (sn), süre (sn), dalga]
type Note = [number, number, number, OscillatorType?]

const PRESETS: Record<string, Note[] | 'pop'> = {
  chime: [[1318.5, 0, 0.9], [1975.5, 0.12, 1.1]],
  ping: [[1760, 0, 1.3, 'triangle']],
  soft: [[659.25, 0, 0.8], [987.77, 0.16, 1.0]],
  pulse: [[880, 0, 0.16, 'triangle'], [880, 0.2, 0.16, 'triangle'], [1174.7, 0.4, 0.55, 'triangle']],
  rise: [[523.25, 0, 0.5], [659.25, 0.1, 0.5], [783.99, 0.2, 0.9]],
  pop: 'pop',
}

export const PRESET_NAMES = Object.keys(PRESETS)

let ctx: AudioContext | undefined
function audio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(c: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(1, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

function synth(name: string, volume: number) {
  const notes = PRESETS[name]
  if (!notes) return
  const c = audio()
  const out = c.createGain()
  out.gain.value = 0.28 * volume
  out.connect(c.destination)
  const now = c.currentTime + 0.02
  if (notes === 'pop') {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.12)
    gain.gain.setValueAtTime(1, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    osc.connect(gain).connect(out)
    osc.start(now)
    osc.stop(now + 0.2)
    return
  }
  for (const [freq, at, dur, type] of notes) {
    tone(c, out, freq, now + at, dur, type)
    // Hafif bir üst ton sesi zil gibi yapar.
    if (!type) tone(c, out, freq * 2, now + at, dur * 0.6, 'sine')
  }
}

let current: HTMLAudioElement | undefined
export function playSound(spec: string, volume = 0.7) {
  if (!spec) return
  if (spec.startsWith('preset:')) return synth(spec.slice(7), volume)
  current?.pause()
  current = new Audio(`app://next-notify/sound?path=${encodeURIComponent(spec)}`)
  current.volume = Math.max(0, Math.min(1, volume))
  current.play().catch(() => {})
}
