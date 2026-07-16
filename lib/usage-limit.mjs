import { createHmac, timingSafeEqual } from 'node:crypto'

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createUsageToken(value, secret) {
  if (!secret || secret.length < 24) throw new Error('NIGI_COOKIE_SECRET must contain at least 24 characters')
  const payload = Buffer.from(JSON.stringify({ day: value.day, count: value.count })).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

export function readUsageToken(token, secret) {
  if (!token || !secret || !String(token).includes('.')) return null
  const [payload, provided] = String(token).split('.')
  const expected = signature(payload, secret)
  const providedBuffer = Buffer.from(provided || '')
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value?.day) || !Number.isInteger(value?.count) || value.count < 0) return null
    return { day: value.day, count: value.count }
  } catch {
    return null
  }
}

export function usageDecision(current, today, limit) {
  const count = current?.day === today ? current.count : 0
  if (count >= limit) return { allowed: false, count, remaining: 0 }
  const nextCount = count + 1
  return { allowed: true, count: nextCount, remaining: Math.max(0, limit - nextCount) }
}
