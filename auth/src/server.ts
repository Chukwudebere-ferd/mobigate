/**
 * Better Auth HTTP server.
 *
 * Mounted at /api/auth/* so the React client and the Go service can both
 * reach it. In production this can either run as a standalone service or be
 * mounted inside the Go binary via better-auth-go — the frontend is
 * unaffected either way.
 */
import { toNodeHandler } from 'better-auth/node'
import { createServer } from 'node:http'
import { auth } from './auth.js'

const port = Number(process.env.AUTH_PORT ?? 3000)

const server = createServer((req, res) => {
  // The Go API proxies its own requests through; allow the CORS origin the
  // frontend dev server runs on.
  const origin = req.headers.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  toNodeHandler(auth)(req, res)
})

server.listen(port, () => {
  console.log(`Better Auth listening on http://localhost:${port}/api/auth`)
})
