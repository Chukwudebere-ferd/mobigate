/**
 * Dumps the rendered text of the design review index, so its contents can be
 * verified without a browser.
 *
 *   node scripts/render-check.mjs --dump /preview
 */
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const path = process.argv.includes('--dump')
  ? process.argv[process.argv.indexOf('--dump') + 1]
  : '/preview'

const { routes } = await import('../src/routes.tsx')
const { SessionProvider } = await import('../src/providers/session-provider.tsx')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

const handler = createStaticHandler(routes)
const context = await handler.query(
  new Request(`http://localhost${path}`, { method: 'GET' }),
)
const router = createStaticRouter(routes, context)

const html = renderToString(
  createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      SessionProvider,
      null,
      createElement(StaticRouterProvider, { router, context }),
    ),
  ),
)

const text = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .join('\n')

console.log(text)
