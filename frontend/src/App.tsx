import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { createRouter } from '@/routes'
import { SessionProvider } from '@/providers/session-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const router = createRouter()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              'rounded-lg border border-ink-200 bg-white text-ink-900 shadow-lg',
          },
        }}
      />
    </QueryClientProvider>
  )
}
