import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'
import { POST } from '../app/api/analyze/route.js'

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NIGI_SITE_URL: process.env.NIGI_SITE_URL,
  NIGI_COOKIE_SECRET: process.env.NIGI_COOKIE_SECRET,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
}
const originalFetch = globalThis.fetch

test.afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  globalThis.fetch = originalFetch
})

test.after(() => {
  // Importing NextRequest keeps framework handles open under the local Node 18 test runner.
  // Route tests execute in an isolated test-file worker, so exit that worker after the suite reports.
  setTimeout(() => process.exit(process.exitCode || 0), 25)
})

function request(body, { origin = 'https://nigi.example', ip = '203.0.113.20' } = {}) {
  const headers = { 'content-type': 'application/json', 'x-forwarded-for': ip }
  if (origin !== null) headers.origin = origin
  return new NextRequest('https://nigi.example/api/analyze', { method: 'POST', headers, body })
}

function configure() {
  process.env.NODE_ENV = 'production'
  process.env.NIGI_SITE_URL = 'https://nigi.example/path'
  process.env.NIGI_COOKIE_SECRET = 'route-test-secret-is-long-enough'
  process.env.OPENROUTER_API_KEY = 'openrouter-test'
  process.env.RAPIDAPI_KEY = 'rapid-test'
}

test('production rejects missing or non-canonical origins and malformed JSON is a sanitized 400', async () => {
  configure()
  assert.equal((await POST(request('{"query":"a valid location question"}', { origin: null }))).status, 403)
  assert.equal((await POST(request('{"query":"a valid location question"}', { origin: 'https://evil.example' }))).status, 403)
  const malformed = await POST(request('{'))
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'The request body must be valid JSON.' })
})

test('secret preflight happens before fetch and returns no configuration details', async () => {
  configure()
  process.env.NIGI_COOKIE_SECRET = 'short'
  let calls = 0
  globalThis.fetch = async () => { calls += 1; throw new Error('should not run') }
  const response = await POST(request('{"query":"a valid location question"}', { ip: '203.0.113.21' }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Nigi is temporarily unavailable.' })
  assert.equal(calls, 0)
})

test('request is charged before OpenRouter, max_tokens is set, and upstream details are sanitized', async () => {
  configure()
  let openRouterBody
  globalThis.fetch = async (_url, options) => {
    openRouterBody = JSON.parse(options.body)
    return new Response(JSON.stringify({ error: { message: 'SECRET_UPSTREAM_DETAIL' } }), { status: 500 })
  }
  const response = await POST(request('{"query":"Would this address work for a bakery?"}', { ip: '203.0.113.22' }))
  const payload = await response.json()
  assert.equal(response.status, 502)
  assert.equal(payload.error, 'Nigi could not reach a required analysis service. Please try again later.')
  assert.equal(payload.usage.remaining, 4)
  assert.match(response.headers.get('set-cookie') || '', /nigi_usage=/)
  assert.equal(openRouterBody.max_tokens, 300)
  assert.equal(JSON.parse(openRouterBody.messages[1].content).untrustedUserMessage, 'Would this address work for a bakery?')
  assert.doesNotMatch(JSON.stringify(payload), /SECRET_UPSTREAM_DETAIL/)
})

test('clarifications consume quota and only structured brief fields return', async () => {
  configure()
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.max_tokens, 300)
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ address: '', businessType: 'bakery', country: 'fr' }) } }],
    }), { status: 200 })
  }
  const response = await POST(request('{"query":"I want to open a bakery somewhere"}', { ip: '203.0.113.23' }))
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.type, 'clarification')
  assert.equal(payload.usage.remaining, 4)
  assert.match(response.headers.get('set-cookie') || '', /nigi_usage=/)
})
