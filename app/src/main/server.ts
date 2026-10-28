import http from 'node:http'
import type { Agent, Category, Hook, ServerStatus } from '../types.js'

type Handlers = {
  hook: (hook: Hook, port: number, agent: Agent) => Promise<unknown>
  test: (category: Category) => void
  open: () => void
  version: string
}

export function startServer(port: number, handlers: Handlers) {
  const status: ServerStatus = { listening: false, error: null }

  const send = (res: http.ServerResponse, code: number, body = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const readJson = (req: http.IncomingMessage) =>
    new Promise<Hook>((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > 2 * 1024 * 1024) req.destroy(new Error('too large'))
        else chunks.push(c)
      })
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
        } catch (err) {
          reject(err)
        }
      })
      req.on('error', reject)
    })

  const server = http.createServer(async (req, res) => {
    const host = req.headers.host
    if (req.headers.origin || (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)) return send(res, 403, { error: 'forbidden' })
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (req.method === 'GET' && pathname === '/ping') return send(res, 200, { app: 'next-notify', version: handlers.version })
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
    try {
      const hook = pathname.match(/^\/hook(?:\/(codex|cursor|gemini|opencode))?$/)
      if (hook) {
        await handlers.hook(await readJson(req), req.socket.remotePort ?? 0, (hook[1] as Agent) ?? 'claude')
        return send(res, 200)
      }
      if (pathname === '/open') {
        handlers.open()
        return send(res, 200)
      }
      const test = pathname.match(/^\/test\/(stop|permission|idle)$/)
      if (test) {
        handlers.test(test[1] as Category)
        return send(res, 200)
      }
      send(res, 404, { error: 'not found' })
    } catch (err) {
      send(res, 400, { error: (err as Error).message })
    }
  })

  server.on('listening', () => Object.assign(status, { listening: true, error: null }))
  server.on('error', (err: NodeJS.ErrnoException) => Object.assign(status, { listening: false, error: err.code ?? err.message }))
  server.listen(port, '127.0.0.1')
  return status
}
