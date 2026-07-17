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

test('daily usage resets and blocks after the twentieth analysis', () => {
  assert.deepEqual(usageDecision(null, '2026-07-16', 20), { allowed: true, count: 1, remaining: 19 })
  assert.deepEqual(usageDecision({ day: '2026-07-15', count: 20 }, '2026-07-16', 20), { allowed: true, count: 1, remaining: 19 })
  assert.deepEqual(usageDecision({ day: '2026-07-16', count: 19 }, '2026-07-16', 20), { allowed: true, count: 20, remaining: 0 })
  assert.deepEqual(usageDecision({ day: '2026-07-16', count: 20 }, '2026-07-16', 20), { allowed: false, count: 20, remaining: 0 })
})
