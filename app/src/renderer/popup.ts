import { createCard } from './shared/card.js'

const MAX = 5
const DEPTH = 3
const PEEK = 10
const GAP = 10
const SETTLE = 450

type Slot = { id: number; el: HTMLElement; shell: HTMLElement; card: HTMLElement; h: number }

const stack = document.createElement('div')
stack.className = 'nn-stack'
const deck = document.createElement('div')
deck.className = 'nn-deck'
stack.append(deck)
document.body.append(stack)

const slots: Slot[] = []
let open = false
let room = Infinity
let sent = 0
let shrink = 0

deck.addEventListener('mouseenter', () => {
  open = true
  layout()
})
deck.addEventListener('mouseleave', () => {
  open = false
  layout()
})

function resize(height: number) {
  const h = Math.min(Math.ceil(height), room)
  clearTimeout(shrink)
  if (h === sent) return
  const send = () => {
    sent = h
    window.nn.resize(h)
  }
  if (h > sent) send()
  else shrink = window.setTimeout(send, SETTLE)
}

function layout() {
  if (!slots.length) return
  if (slots.length < 2) open = false
  const dir = document.body.dataset.pos!.startsWith('top') ? 1 : -1
  const spread = open && slots.length > 1
  let offset = 0
  slots.forEach((s, i) => {
    const depth = Math.min(i, DEPTH)
    const behind = !spread && i > 0
    const y = spread ? offset : depth * PEEK
    s.el.style.transform = `translateY(${dir * y}px) scale(${spread ? 1 : 1 - depth * 0.05})`
    s.el.style.zIndex = String(MAX + 1 - i)
    s.el.classList.toggle('behind', behind)
    s.el.classList.toggle('gone', !spread && i >= DEPTH)
    s.card.style.height = `${behind ? slots[0].h : s.h}px`
    offset += s.h + GAP
  })
  const height = spread ? offset - GAP : slots[0].h + Math.min(slots.length - 1, DEPTH - 1) * PEEK
  const style = getComputedStyle(stack)
  const total = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + height
  deck.style.height = `${height}px`
  stack.classList.toggle('open', spread)
  stack.classList.toggle('clip', spread && total > room)
  resize(total)
}

function close(slot: Slot) {
  const i = slots.indexOf(slot)
  if (i < 0) return
  slots.splice(i, 1)
  slot.el.style.zIndex = String(MAX + 2)
  slot.shell.classList.remove('in')
  slot.shell.classList.add('out')
  slot.shell.addEventListener('animationend', function done(e) {
    if (e.target !== slot.shell) return
    slot.shell.removeEventListener('animationend', done)
    slot.el.remove()
    window.nn.close(slot.id)
  })
  layout()
}

window.nn.onShow(async ({ id, note, popup, room: max }) => {
  room = max
  stack.style.maxHeight = `${max}px`
  document.body.dataset.pos = popup.position
  deck.style.width = `${popup.width}px`
  const shell = createCard(note, popup)
  const card = shell.firstElementChild as HTMLElement
  const el = document.createElement('div')
  el.className = 'nn-slot'
  el.append(shell)
  deck.append(el)
  await document.fonts.ready

  const slot: Slot = { id, el, shell, card, h: card.offsetHeight }
  slots.unshift(slot)
  card.querySelector('.nn-progress i')!.addEventListener('animationend', () => close(slot))
  card.querySelector('.nn-close')!.addEventListener('click', (e) => {
    e.stopPropagation()
    close(slot)
  })
  card.addEventListener('click', () => {
    window.nn.click(id)
    close(slot)
  })
  for (const old of slots.slice(MAX)) close(old)
  layout()
  setTimeout(() => shell.classList.add('in'), 40)
})
