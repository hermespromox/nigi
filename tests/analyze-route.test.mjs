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

test('oversized JSON is rejected by actual bytes even without a Content-Length header', async () => {
  configure()
  let calls = 0
  globalThis.fetch = async () => { calls += 1; throw new Error('should not run') }
  const oversized = request(JSON.stringify({ query: `bakery in Lyon ${'x'.repeat(17000)}` }), { ip: '203.0.113.45' })
  oversized.headers.delete('content-length')
  const response = await POST(oversized)
  assert.equal(response.status, 413)
  assert.equal(calls, 0)
})

test('blank provider coordinates are rejected instead of becoming zero-zero', async () => {
  configure()
  let call = 0
  globalThis.fetch = async () => {
    call += 1
    if (call === 1) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      status: 'ready', businessType: 'bakery', positioning: 'premium', targetCustomer: 'locals', address: '18 rue de la République, Lyon', city: 'Lyon', country: 'fr',
    }) } }] }), { status: 200 })
    return new Response(JSON.stringify({ data: { lat: null, lng: '' } }), { status: 200 })
  }
  const response = await POST(request(JSON.stringify({ query: 'Premium bakery at 18 rue de la République, Lyon' }), { ip: '203.0.113.46' }))
  assert.equal(response.status, 400)
  assert.equal(call, 2)
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
  assert.equal(payload.usage.remaining, 19)
  assert.match(response.headers.get('set-cookie') || '', /nigi_usage=/)
  assert.equal(openRouterBody.max_tokens, 300)
  assert.equal(JSON.parse(openRouterBody.messages[1].content).untrustedUserMessage, 'Would this address work for a bakery?')
  assert.doesNotMatch(JSON.stringify(payload), /SECRET_UPSTREAM_DETAIL/)
})

test('Places-first success path sends structured place evidence to GPT and hides raw review excerpts from clients', async () => {
  configure()
  const openRouterBodies = []
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url)
    if (href.includes('openrouter.ai')) {
      const body = JSON.parse(options.body)
      openRouterBodies.push(body)
      if (openRouterBodies.length === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
          address: '18 rue de la République, Lyon', businessType: 'premium bakery', positioning: 'premium', targetCustomer: 'local professionals', country: 'fr',
        }) } }] }), { status: 200 })
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        marketPatternCodes: ['CLOSE_COMPETITION', 'UNEVEN_RATINGS'],
        opportunityCodes: ['DIFFERENTIATION_ESSENTIAL', 'STUDY_REVIEW_THEMES'],
        competitorPlaceIds: ['P1'],
        reviewThemes: [{ code: 'SERVICE', placeIds: ['P1'] }],
        strengthCodes: ['ESTABLISHED_PRESENCE'], riskCodes: ['INTENSE_COMPETITION'],
        nextStepCodes: ['INSPECT_COMPETITORS'], confidence: 'medium-high',
      }) } }] }), { status: 200 })
    }
    if (href.includes('/geocoding.php')) {
      return new Response(JSON.stringify({ data: { lat: 45.764, lng: 4.8357, full_address: '18 Rue de la République, Lyon' } }), { status: 200 })
    }
    if (href.includes('/nearby.php')) {
      return new Response(JSON.stringify({ data: [
        { business_id: 'alpha', name: 'Maison Alpha', latitude: 45.765, longitude: 4.8357, rating: 4.8, review_count: 4100, full_address: '20 Rue de la République', types: ['bakery', 'cafe'], price_level: '$$$', working_hours: ['Monday: 08:00-19:00'] },
        { business_id: 'beta', name: 'Boulangerie Beta', latitude: 45.768, longitude: 4.8357, rating: 3.9, review_count: 700, full_address: '30 Rue de la République', types: ['bakery'], price_level: '$$', working_hours: [] },
      ] }), { status: 200 })
    }
    if (href.includes('/reviews.php')) {
      const stale = new Date(Date.now() - 30 * 86400000).toISOString()
      const future = new Date(Date.now() + 2 * 86400000).toISOString()
      return new Response(JSON.stringify({ data: { reviews: [
        { iso_date: new Date().toISOString(), review_rate: 5, review_text: 'Excellent croissants and friendly service.' },
        { iso_date: stale, review_rate: 1, review_text: 'STALE_REVIEW_CANARY' },
        { iso_date: future, review_rate: 5, review_text: 'FUTURE_REVIEW_CANARY' },
      ] } }), { status: 200 })
    }
    throw new Error(`Unexpected fetch: ${href}`)
  }

  const response = await POST(request(JSON.stringify({ query: 'Would 18 rue de la République, Lyon work for a premium bakery?' }), { ip: '203.0.113.44' }))
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.type, 'analysis')
  assert.match(payload.synthesis.headline, /premium bakery/i)
  assert.match(payload.synthesis.competitorHighlights[0], /Maison Alpha/)
  assert.equal(payload.signals.estimatedDailyFootfall, 500)
  assert.deepEqual(Object.keys(payload).sort(), ['location', 'recommendations', 'signals', 'synthesis', 'type', 'usage'])
  assert.equal(openRouterBodies.length, 2)
  assert.ok(openRouterBodies.every((body) => body.reasoning?.effort === 'medium'))
  const strategyEvidence = JSON.parse(openRouterBodies[1].messages[1].content).authoritativePlacesEvidence
  assert.equal(strategyEvidence.businessContext.businessType, 'premium bakery')
  assert.deepEqual(strategyEvidence.places[0].types, ['bakery', 'cafe'])
  assert.match(strategyEvidence.places[0].recentReviewSnippets[0].text, /croissants/)
  assert.equal(strategyEvidence.places[0].recentReviewSnippets.length, 1)
  assert.doesNotMatch(JSON.stringify(strategyEvidence), /STALE_REVIEW_CANARY|FUTURE_REVIEW_CANARY/)
  assert.doesNotMatch(JSON.stringify(payload), /croissants|STALE_REVIEW_CANARY|FUTURE_REVIEW_CANARY|recentReviewSnippets|workingHours|AskLizy|GPT|Places API|RapidAPI|OpenRouter|activityIndex|reviewCoverage|radiusMeters|reviewWindow|rawPoiCount|distanceMeters|reviewCount|4,100|120 m|rated 4\.80/i)
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
  assert.equal(payload.usage.remaining, 19)
  assert.match(response.headers.get('set-cookie') || '', /nigi_usage=/)
})
