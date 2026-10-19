import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth client for the React frontend.
 *
 * The client is transport-agnostic: it only issues fetches against
 * `/api/auth/*`, so the auth host can be a standalone Node service (the
 * development setup) or mounted inside the Go binary via better-auth-go,
 * without any change here.
 *
 * The session user carries the MGM role as an additional field. See
 * auth/src/auth.ts for how it is declared.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? window.location.origin,
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession } = authClient
