import { createInternalNeonAuth } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env?.VITE_NEON_AUTH_URL?.trim()

// Neon owns the session cookie. This client only asks Neon for a short lived
// access JWT when the API client needs to call FastAPI.
export const neonAuth = authUrl
  ? createInternalNeonAuth(authUrl, { adapter: BetterAuthReactAdapter() })
  : null

export const authClient = neonAuth?.adapter ?? null

export async function getAccessToken() {
  if (!neonAuth) return null
  return neonAuth.getJWTToken()
}
