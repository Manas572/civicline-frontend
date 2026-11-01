import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../src/lib/api.js'

test('protected FastAPI calls fetch a fresh Neon access token and send it as Bearer', async () => {
  const sent = []
  let tokenCall = 0
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    tokenProvider: async () => `short-lived-${++tokenCall}`,
    fetcher: async (url, options) => {
      sent.push({ url, options })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.deepEqual(await client('/api/auth/me'), { ok: true })
  assert.deepEqual(await client('/api/tickets'), { ok: true })
  assert.equal(sent.length, 2)
  assert.equal(sent[0].options.headers.get('Authorization'), 'Bearer short-lived-1')
  assert.equal(sent[1].options.headers.get('Authorization'), 'Bearer short-lived-2')
  assert.equal(sent[0].options.credentials, 'omit')
  assert.equal(sent[0].url, 'https://api.example.test/api/auth/me')
})
