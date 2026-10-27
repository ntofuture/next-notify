import { playSound } from './shared/sounds.js'

window.nn.onPlay(({ spec, volume }) => playSound(spec, volume))
