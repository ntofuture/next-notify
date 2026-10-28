import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'
import { MENU_ICONS } from '../src/renderer/shared/look.js'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const logo = fs.readFileSync(path.join(ROOT, 'assets/brand/next-notify.svg'), 'utf8')

const appIcon = logo.replace(/^<\?xml[^>]*>\s*/, '').replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 15 428 428">')

const [cloud, , clapper, bell] = [...logo.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1])
const dot = 'cx="338" cy="255"'
const template = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="53 49 390 390">
  <mask id="cloud"><rect width="500" height="500" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="44" stroke-linejoin="round"><path d="${bell}"/><path d="${clapper}"/></g><circle ${dot} r="48" fill="#000"/></mask>
  <mask id="bell"><rect width="500" height="500" fill="#fff"/><circle ${dot} r="48" fill="#000"/></mask>
  <path d="${cloud}" mask="url(#cloud)"/>
  <g mask="url(#bell)"><path d="${bell}"/><path d="${clapper}"/></g>
  <circle ${dot} r="28"/>
</svg>`

const menuIcon = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2.5 20 20" fill="none" stroke="#0B58DC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

const SCALES: [string, number][] = [['', 16], ['@1.25x', 20], ['@1.5x', 24], ['@2x', 32]]
const targets: [string, number, string][] = [
  ['build/icon.png', 1024, appIcon],
  ['assets/icon.png', 256, appIcon],
  ...SCALES.map(([suffix, size]): [string, number, string] => [`assets/tray${suffix}.png`, size, appIcon]),
  ['assets/trayTemplate.png', 16, template],
  ['assets/trayTemplate@2x.png', 32, template],
  ...Object.entries(MENU_ICONS).flatMap(([name, body]) => SCALES.map(([suffix, size]): [string, number, string] => [`assets/menu/${name}${suffix}.png`, size, menuIcon(body)])),
]

app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  fs.mkdirSync(path.join(ROOT, 'assets/menu'), { recursive: true })
  for (const [file, size, svg] of targets) {
    const side = Math.max(size, 128)
    const win = new BrowserWindow({ show: false, width: side, height: side, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } })
    const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', `<svg style="display:block" width="${size}" height="${size}" `)}</body></html>`
    const tmp = path.join(app.getPath('temp'), `next-notify-icon-${size}.html`)
    fs.writeFileSync(tmp, html)
    await win.loadFile(tmp)
    fs.rmSync(tmp)
    await new Promise((r) => setTimeout(r, 300))
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
    fs.writeFileSync(path.join(ROOT, file), image.toPNG())
    console.log(`${file} ${size}px`)
    win.destroy()
  }
  app.quit()
})
