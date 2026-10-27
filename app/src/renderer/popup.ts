import { createCard } from './shared/card.js'

window.nn.onShow(async ({ note, popup }) => {
  const shell = createCard(note, popup)
  const card = shell.firstElementChild as HTMLElement
  document.body.append(shell)
  await document.fonts.ready
  window.nn.ready(shell.offsetHeight)

  let closing = false
  const close = () => {
    if (closing) return
    closing = true
    shell.classList.replace('in', 'out')
    shell.addEventListener('animationend', () => window.nn.close(), { once: true })
  }

  card.querySelector('.nn-progress i')!.addEventListener('animationend', close)
  card.querySelector('.nn-close')!.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })
  card.addEventListener('click', () => {
    window.nn.click()
    close()
  })
  setTimeout(() => shell.classList.add('in'), 40)
})
