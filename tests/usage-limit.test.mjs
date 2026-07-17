import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createUsageToken,
  readUsageToken,
  usageDecision,
} from '../lib/usage-limit.mjs'

const secret = 'test-secret-that-is-long-enough'

test('signed usage tokens round-trip without trusting caller input', () => {
  const token = createUsageToken({ day: '2026-07-16', count: 2 }, secret)
  assert.deepEqual(readUsageToken(token, secret), { day: '2026-07-16', count: 2 })
  assert.equal(readUsageToken(token + 'tampered', secret), null)
})

test('daily usage resets and blocks after the fiftieth analysis', () => {
  assert.deepEqual(usageDecision(null, '2026-07-16', 50), { allowed: true, count: 1, remaining: 49 })
  assert.deepEqual(usageDecision({ day: '2026-07-15', count: 50 }, '2026-07-16', 50), { allowed: true, count: 1, remaining: 49 })
  assert.deepEqual(usageDecision({ day: '2026-07-16', count: 49 }, '2026-07-16', 50), { allowed: true, count: 50, remaining: 0 })
  assert.deepEqual(usageDecision({ day: '2026-07-16', count: 50 }, '2026-07-16', 50), { allowed: false, count: 50, remaining: 0 })
})
