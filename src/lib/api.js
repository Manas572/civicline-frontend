import { getAccessToken } from '../auth/neonAuth.js'

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createApiClient({ baseUrl = API_BASE, tokenProvider = getAccessToken, fetcher = fetch } = {}) {
  return async function request(path, options = {}) {
    const token = await tokenProvider()
    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetcher(`${baseUrl}${path}`, {
      ...options,
      headers,
      // API auth is bearer based. Neon Auth's own SDK manages its HttpOnly cookie.
      credentials: 'omit',
    })
    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const payload = await response.json()
        message = payload.detail || message
      } catch { /* response did not contain JSON */ }
      const error = new ApiError(message, response.status)
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('civic-auth-expired'))
      }
      throw error
    }
    if (response.status === 204) return null
    return response.json()
  }
}

export const api = createApiClient()

export async function apiBlob(path) {
  const token = await getAccessToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { headers, credentials: 'omit' })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try { message = (await response.json()).detail || message } catch { /* response was not JSON */ }
    if (response.status === 401) window.dispatchEvent(new CustomEvent('civic-auth-expired'))
    throw new ApiError(message, response.status)
  }
  return URL.createObjectURL(await response.blob())
}
