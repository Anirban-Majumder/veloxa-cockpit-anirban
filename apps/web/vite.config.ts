import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const api = `http://127.0.0.1:${process.env.PORT ?? 8787}`
const apiPages = ['/login', '/doc', '/openapi.json', '/db']

export default defineConfig({
  root: import.meta.dirname,
  // Relative asset URLs let one build serve at / locally and under PUBLIC_BASE_PATH behind the proxy.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'veloxa-session',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const path = new URL(request.url ?? '/', api).pathname
          if (apiPages.includes(path) || path === '/api' || path.startsWith('/api/')) return next()

          try {
            const session = await fetch(`${api}/api/session`, {
              headers: { cookie: request.headers.cookie ?? '' },
            })
            if (session.ok) return next()
            if (session.status === 401) {
              response.writeHead(302, { Location: '/login', 'Cache-Control': 'no-store' }).end()
              return
            }
          } catch {
            // The API may still be starting.
          }
          response.writeHead(503, { 'Content-Type': 'text/plain' }).end('The Veloxa Digital HQ API is unavailable.')
        })
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': api, ...Object.fromEntries(apiPages.map((path) => [path, api])) },
  },
})
