import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SRC = path.join(ROOT, 'build', 'setup')
const OUT = path.join(SRC, 'art')
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version as string
const SCALES = [100, 125, 150, 200]

const THEMES = {
  dark: {
    toast: [12, 17, 27], text: [242, 245, 251], muted: [163, 172, 190], faint: [115, 125, 146],
    stroke: [242, 245, 251, 31], accent: [59, 199, 245], ink: [5, 7, 12], button: [242, 245, 251, 10],
    keycap: [242, 245, 251, 82], track: 28, shadow: 150, brand: [242, 245, 251],
  },
  light: {
    toast: [255, 255, 255], text: [9, 18, 48], muted: [70, 81, 106], faint: [99, 109, 132],
    stroke: [9, 18, 48, 26], accent: [11, 88, 220], ink: [255, 255, 255], button: [9, 18, 48, 9],
    keycap: [9, 18, 48, 77], track: 22, shadow: 60, brand: [11, 88, 220],
  },
}

const TEXT = {
  tr: {
    version: `Sürüm ${VERSION}`,
    folder: 'Kurulum klasörü',
    autostart: 'Oturum açınca başlat (önerilir)',
    shortcut: 'Masaüstüne kısayol ekle',
    note: 'Next Notify yeni sürümleri kendiliğinden indirir ve sessizce kurar.',
    cancel: 'İptal',
    install: 'Kur',
    copying: 'Dosyalar kopyalanıyor…',
    launch: 'Next Notify’ı şimdi başlat',
    done: 'Next Notify kuruldu. Başlat menüsünden açabilirsiniz; yeni sürümler otomatik olarak kurulur.',
    finish: 'Bitir',
    rights: '© 2026 Next to Future. Tüm hakları saklıdır.',
    uninstall: 'Kaldır',
    removeNote: 'Next Notify ve tüm ayarları bu bilgisayardan kaldırılacak.',
    removing: 'Dosyalar siliniyor…',
    removed: 'Next Notify ve ayarları bu bilgisayardan kaldırıldı.',
  },
  en: {
    version: `Version ${VERSION}`,
    folder: 'Install folder',
    autostart: 'Start when I sign in (recommended)',
    shortcut: 'Add a desktop shortcut',
    note: 'Next Notify downloads new versions by itself and installs them silently.',
    cancel: 'Cancel',
    install: 'Install',
    copying: 'Copying files…',
    launch: 'Start Next Notify now',
    done: 'Next Notify is installed. Open it from the Start menu; new versions install automatically.',
    finish: 'Finish',
    rights: '© 2026 Next to Future. All rights reserved.',
    uninstall: 'Uninstall',
    removeNote: 'Next Notify and all of its settings will be removed from this computer.',
    removing: 'Removing files…',
    removed: 'Next Notify and its settings have been removed from this computer.',
  },
}

const font = (file: string) => `data:font/ttf;base64,${fs.readFileSync(path.join(SRC, 'fonts', file)).toString('base64')}`
const ASSETS = {
  fonts: { 'REM Light': font('REM-Light.ttf'), 'Martian Mono': font('MartianMono-Regular.ttf') },
  display: `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'museomoderno-latin.woff2')).toString('base64')}`,
  logo: `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'build', 'icon.png')).toString('base64')}`,
}

const RENDER = String.raw`async ({ assets, theme: c, text, lang, scale, page, on }) => {
  for (const [family, src] of Object.entries(assets.fonts)) document.fonts.add(await new FontFace(family, 'url(' + src + ')').load())
  document.fonts.add(await new FontFace('MuseoModerno', 'url(' + assets.display + ')', { weight: '100 900' }).load())
  const logo = new Image()
  logo.src = assets.logo
  await logo.decode()

  const s = scale / 100
  const px = (v) => Math.round(v * s)
  const rgba = (v, a = v[3] ?? 255) => 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a / 255 + ')'
  const canvas = document.createElement('canvas')
  canvas.width = px(560)
  canvas.height = px(464)
  const g = canvas.getContext('2d')
  g.fillStyle = rgba(c.toast)
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.setTransform(s, 0, 0, s, 0, 0)

  const rounded = (x, y, w, h, r) => {
    const d = Math.min(r * 2, w, h) / 2
    const p = new Path2D()
    p.roundRect(x, y, w, h, d)
    return p
  }
  const fill = (x, y, w, h, r, color) => { g.fillStyle = color; g.fill(rounded(x, y, w, h, r)) }
  const stroke = (x, y, w, h, r, color, width) => { g.strokeStyle = color; g.lineWidth = width; g.stroke(rounded(x, y, w, h, r)) }
  const shadow = (x, y, w, h, r, spread, alpha) => {
    for (let step = 7; step >= 1; step--) {
      const grow = (spread * step) / 7
      fill(x - grow * 0.5, y + spread * 0.35 - grow * 0.15, w + grow, h + grow * 0.85, r + grow * 0.5, 'rgba(0,0,0,' + Math.max(1, Math.floor(alpha / 10)) / 255 + ')')
    }
  }
  const BODY = '13.5px "REM Light"'
  const SMALL = '12px "REM Light"'
  const LABEL = '9.5px "Martian Mono"'
  const measure = (t, f) => { g.font = f; return g.measureText(t).width }
  const top = (t, f, color, x, y) => {
    g.font = f
    const m = g.measureText(t)
    g.fillStyle = color
    g.textBaseline = 'alphabetic'
    g.fillText(t, x, y + m.fontBoundingBoxAscent)
    return m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
  }
  const middle = (t, f, color, x, y, h, align = 'left', w = 0) => {
    g.font = f
    const m = g.measureText(t)
    g.fillStyle = color
    g.textBaseline = 'alphabetic'
    const tx = align === 'center' ? x + (w - m.width) / 2 : x + 2.25
    g.fillText(t, tx, y + (h - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent)
  }
  const label = (t, color, x, y) => {
    g.letterSpacing = 9.5 * 0.12 + 'px'
    top(t.toLocaleUpperCase(lang), LABEL, color, x, y)
    g.letterSpacing = '0px'
  }
  const wrap = (t, f, color, x, y, w, h) => {
    g.font = f
    const m = g.measureText('Ag')
    const line = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
    let row = ''
    let ty = y
    for (const word of t.split(' ')) {
      const next = row ? row + ' ' + word : word
      if (g.measureText(next).width > w - 4.5 && row) {
        top(row, f, color, x + 2.25, ty)
        ty += line
        row = word
      } else row = next
    }
    if (row && ty + line <= y + h + 1) top(row, f, color, x + 2.25, ty)
  }
  const toggle = (row, t, value, alpha) => {
    middle(t, BODY, rgba(c.text, alpha), row.x + 10, row.y, row.h)
    const x = row.x + row.w - 10 - 34
    const y = row.y + (row.h - 18) / 2
    if (value) fill(x, y, 34, 18, 9, rgba(c.accent, alpha))
    else {
      fill(x, y, 34, 18, 9, rgba(c.button, (c.button[3] * alpha) / 255))
      stroke(x, y, 34, 18, 9, rgba(c.keycap, (c.keycap[3] * alpha) / 255), 1)
    }
    g.fillStyle = value ? rgba(c.ink, alpha) : rgba(c.muted, (200 * alpha) / 255)
    g.beginPath()
    g.arc((value ? x + 34 - 3 - 12 : x + 3) + 6, y + 3 + 6, 6, 0, Math.PI * 2)
    g.fill()
  }

  const un = page.startsWith('un')
  const installing = page === 'installing' || page === 'uninstalling'
  const finished = page === 'finish' || page === 'unfinish'
  const rows = [{ x: 22, y: 166, w: 516, h: 40 }, { x: 22, y: 210, w: 516, h: 40 }]
  const primaryText = finished ? text.finish : un ? text.uninstall : text.install
  const primaryW = Math.round(Math.max(120, measure(primaryText, BODY) + 44))
  const cancelW = Math.round(measure(text.cancel, BODY) + 40)
  const primary = { x: 528 - primaryW, y: 337, w: primaryW, h: 42 }
  const cancel = { x: primary.x - 12 - cancelW, y: 337, w: cancelW, h: 42 }

  stroke(0.5 / s, 0.5 / s, 560 - 1 / s, 464 - 1 / s, 16, rgba(c.stroke), 1)

  shadow(32, 32, 48, 48, 12, 10, c.shadow / 2)
  g.imageSmoothingQuality = 'high'
  g.drawImage(logo, 32, 32, 48, 48)
  g.letterSpacing = 27 * -0.03 + 'px'
  const wordmark = top('next notify', '700 27px MuseoModerno', rgba(c.text), 96, 28)
  g.letterSpacing = '0px'
  label(text.version, rgba(c.faint), 96, 28 + wordmark + 4)
  if (!installing && !finished) {
    g.font = '12.5px "Segoe Fluent Icons", "Segoe MDL2 Assets"'
    const m = g.measureText('')
    g.fillStyle = rgba(c.muted)
    g.textBaseline = 'alphabetic'
    g.fillText('', 512 + (32 - (m.actualBoundingBoxRight + m.actualBoundingBoxLeft)) / 2 + m.actualBoundingBoxLeft,
      16 + (32 - (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)) / 2 + m.actualBoundingBoxAscent)
  }

  label(text.folder, rgba(c.faint), 32, 108)

  const alpha = installing ? 110 : 255
  if (finished && !un) toggle(rows[0], text.launch, on[0], alpha)
  else if (!un) {
    toggle(rows[0], text.autostart, on[0], alpha)
    toggle(rows[1], text.shortcut, on[1], alpha)
  }

  if (installing || finished) {
    fill(32, 268, 496, 5, 2.5, rgba(c.text, c.track))
    fill(32, 268, finished ? 496 : 5, 5, 2.5, rgba(c.accent))
  }
  const note = finished ? (un ? text.removed : text.done) : installing ? (un ? text.removing : text.copying) : un ? text.removeNote : text.note
  wrap(note, SMALL, rgba(c.muted), 32, 283, 496, 38)

  if (installing) {
    fill(primary.x, primary.y, primary.w, primary.h, 21, rgba(c.button))
    middle(primaryText, BODY, rgba(c.muted, 150), primary.x, primary.y, primary.h, 'center', primary.w)
  } else {
    shadow(primary.x, primary.y, primary.w, primary.h, 21, 10, c.shadow / 2)
    fill(primary.x, primary.y, primary.w, primary.h, 21, rgba(c.accent))
    middle(primaryText, BODY, rgba(c.ink), primary.x, primary.y, primary.h, 'center', primary.w)
  }
  if (!finished) {
    fill(cancel.x, cancel.y, cancel.w, cancel.h, 21, rgba(c.button))
    stroke(cancel.x, cancel.y, cancel.w, cancel.h, 21, rgba(c.stroke), 1)
    middle(text.cancel, BODY, installing ? rgba(c.muted, 150) : rgba(c.text), cancel.x, cancel.y, cancel.h, 'center', cancel.w)
  }

  g.fillStyle = rgba(c.stroke)
  g.fillRect(32, 405, 496, 1)
  const brandH = 13
  g.font = SMALL
  const rights = g.measureText(text.rights)
  g.fillStyle = rgba(c.faint)
  g.textBaseline = 'alphabetic'
  g.fillText(text.rights, 32 + 2.25, 427 + (brandH - (rights.fontBoundingBoxAscent + rights.fontBoundingBoxDescent)) / 2 + rights.fontBoundingBoxAscent)
  g.font = '700 17px MuseoModerno'
  g.letterSpacing = 17 * -0.03 + 'px'
  const brand = g.measureText('next to future')
  g.fillStyle = rgba(c.brand)
  g.fillText('next to future', 528 - brand.width, 427 + (brandH - (brand.fontBoundingBoxAscent + brand.fontBoundingBoxDescent)) / 2 + brand.fontBoundingBoxAscent)
  g.letterSpacing = '0px'

  return { png: canvas.toDataURL('image/png'), primaryW, cancelW }
}`

type Rect = { x: number; y: number; w: number; h: number }
type Result = { png: string; primaryW: number; cancelW: number }

function bmp(image: Electron.NativeImage) {
  const { width, height } = image.getSize()
  const bgra = image.toBitmap()
  const stride = Math.ceil((width * 3) / 4) * 4
  const out = Buffer.alloc(54 + stride * height)
  out.write('BM', 0)
  out.writeUInt32LE(out.length, 2)
  out.writeUInt32LE(54, 10)
  out.writeUInt32LE(40, 14)
  out.writeInt32LE(width, 18)
  out.writeInt32LE(height, 22)
  out.writeUInt16LE(1, 26)
  out.writeUInt16LE(24, 28)
  out.writeUInt32LE(stride * height, 34)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      out[row + x * 3] = bgra[i]
      out[row + x * 3 + 1] = bgra[i + 1]
      out[row + x * 3 + 2] = bgra[i + 2]
    }
  }
  return out
}

if (!process.versions.electron) {
  if (process.platform === 'win32') {
    const electron = (await import('electron')).default as unknown as string
    const { ELECTRON_RUN_AS_NODE, ...env } = process.env
    process.exitCode = spawnSync(electron, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env }).status ?? 1
  }
} else {
  const { app, BrowserWindow, nativeImage } = await import('electron')
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  app.on('window-all-closed', () => {})
  app.whenReady().then(() => draw(BrowserWindow, nativeImage).then(() => app.quit()))
}

async function draw(BrowserWindow: typeof Electron.BrowserWindow, nativeImage: typeof Electron.nativeImage) {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('about:blank')
  const render = (args: object): Promise<Result> => win.webContents.executeJavaScript(`(${RENDER})(${JSON.stringify(args)})`)

  fs.rmSync(OUT, { recursive: true, force: true })
  const sets: string[] = []
  const widths: Record<string, { primary: number; cancel: number; finish: number; uninstall: number }> = {}
  for (const [themeName, theme] of Object.entries(THEMES)) {
    for (const [lang, text] of Object.entries(TEXT)) {
      for (const scale of SCALES) {
        const set = `${themeName}-${lang}-${scale}`
        const dir = path.join(OUT, set)
        fs.mkdirSync(dir, { recursive: true })
        const px = (v: number) => Math.round((v * scale) / 100)
        const crop = (image: Electron.NativeImage, r: Rect) => image.crop({ x: px(r.x), y: px(r.y), width: px(r.x + r.w) - px(r.x), height: px(r.y + r.h) - px(r.y) })
        const shot = async (page: string, on: boolean[]) => {
          const result = await render({ assets: ASSETS, theme, text, lang, scale, page, on })
          return { result, image: nativeImage.createFromDataURL(result.png) }
        }
        const save = (name: string, image: Electron.NativeImage) => fs.writeFileSync(path.join(dir, `${name}.bmp`), bmp(image))
        const rows = [{ x: 22, y: 166, w: 516, h: 40 }, { x: 22, y: 210, w: 516, h: 40 }]

        const welcome = await shot('welcome', [true, true])
        const welcomeOff = await shot('welcome', [false, false])
        const installing = await shot('installing', [true, true])
        const installingOff = await shot('installing', [false, false])
        const finish = await shot('finish', [true])
        const finishOff = await shot('finish', [false])
        const unwelcome = await shot('unwelcome', [])
        const uninstalling = await shot('uninstalling', [])
        const unfinish = await shot('unfinish', [])
        const { primaryW, cancelW } = welcome.result
        const primary = { x: 528 - primaryW, y: 337, w: primaryW, h: 42 }
        const done = { x: 528 - finish.result.primaryW, y: 337, w: finish.result.primaryW, h: 42 }
        const uninstall = { x: 528 - unwelcome.result.primaryW, y: 337, w: unwelcome.result.primaryW, h: 42 }

        save('welcome', welcome.image)
        save('installing', installing.image)
        save('finish', finish.image)
        save('unwelcome', unwelcome.image)
        save('uninstalling', uninstalling.image)
        save('unfinish', unfinish.image)
        save('uninstall', crop(unwelcome.image, uninstall))
        rows.forEach((r, i) => {
          save(`row${i + 1}-on`, crop(welcome.image, r))
          save(`row${i + 1}-off`, crop(welcomeOff.image, r))
          save(`dim${i + 1}-on`, crop(installing.image, r))
          save(`dim${i + 1}-off`, crop(installingOff.image, r))
        })
        save('launch-on', crop(finish.image, rows[0]))
        save('launch-off', crop(finishOff.image, rows[0]))
        save('close', crop(welcome.image, { x: 512, y: 16, w: 32, h: 32 }))
        save('cancel', crop(welcome.image, { x: primary.x - 12 - cancelW, y: 337, w: cancelW, h: 42 }))
        save('install', crop(welcome.image, primary))
        save('done', crop(finish.image, done))
        widths[lang] = { primary: primaryW, cancel: cancelW, finish: finish.result.primaryW, uninstall: unwelcome.result.primaryW }
        sets.push(set)
        console.log(set)
      }
    }
  }

  const files = fs.readdirSync(path.join(OUT, sets[0]))
  const nsh = [
    '!macro nnExtractArt',
    ...sets.flatMap((set) => [
      `  \${If} $nnSet == "${set}"`,
      ...files.map((f) => `    File "/oname=$PLUGINSDIR\\nn\\${f}" "\${BUILD_RESOURCES_DIR}\\setup\\art\\${set}\\${f}"`),
      '  ${EndIf}',
    ]),
    '!macroend',
    ...Object.keys(TEXT).flatMap((lang) => [
      `!define NN_PRIMARY_W_${lang} ${widths[lang].primary}`,
      `!define NN_CANCEL_W_${lang} ${widths[lang].cancel}`,
      `!define NN_FINISH_W_${lang} ${widths[lang].finish}`,
      `!define NN_UNINSTALL_W_${lang} ${widths[lang].uninstall}`,
    ]),
    '',
  ]
  fs.writeFileSync(path.join(OUT, 'art.nsh'), nsh.join('\r\n'))
}
