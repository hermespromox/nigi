import { createHmac } from 'node:crypto'

export function canonicalProductionOrigin(siteUrl) {
  try {
    const url = new URL(String(siteUrl || ''))
    if (url.protocol !== 'https:' || !url.hostname) throw new Error('invalid')
    return url.origin
  } catch {
    throw new Error('NIGI_SITE_URL must be an absolute HTTPS URL in production')
  }
}

export function clientIp(headers) {
  const forwarded = String(headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const direct = String(headers.get('x-real-ip') || '').trim()
  return (forwarded || direct || 'unknown').slice(0, 128)
}

export function isTrustedOrigin(headers, nodeEnv, siteUrl) {
  const origin = headers.get('origin')
  if (nodeEnv === 'production') {
    const canonical = canonicalProductionOrigin(siteUrl)
    if (!origin) return false
    try { return new URL(origin).origin === canonical && origin === new URL(origin).origin } catch { return false }
  }
  if (!origin) return true
  if (!siteUrl) return true
  try { return new URL(origin).origin === new URL(siteUrl).origin } catch { return false }
}

export class InMemoryRequestLimiter {
  constructor({ dailyLimit, concurrentLimit, hmacSecret }) {
    if (!hmacSecret || hmacSecret.length < 24) throw new Error('Limiter HMAC secret must contain at least 24 characters')
    this.dailyLimit = dailyLimit
    this.concurrentLimit = concurrentLimit
    this.hmacSecret = hmacSecret
    this.entries = new Map()
    this.concurrent = 0
  }

  key(ip) {
    return createHmac('sha256', this.hmacSecret).update(String(ip)).digest('base64url')
  }

  reserve(ip, day) {
    // This method intentionally contains no await: each check/increment is one atomic JS turn.
    if (this.concurrent >= this.concurrentLimit) {
      return { allowed: false, reason: 'concurrency', remaining: 0, release() {} }
    }
    const key = this.key(ip)
    const current = this.entries.get(key)
    const count = current?.day === day ? current.count : 0
    if (count >= this.dailyLimit) {
      return { allowed: false, reason: 'daily', remaining: 0, release() {} }
    }
    const nextCount = count + 1
    this.entries.set(key, { day, count: nextCount })
    this.concurrent += 1
    let released = false
    return {
      allowed: true,
      reason: null,
      remaining: Math.max(0, this.dailyLimit - nextCount),
      release: () => {
        if (released) return
        released = true
        this.concurrent = Math.max(0, this.concurrent - 1)
      },
    }
  }
}

const GLOBAL_KEY = Symbol.for('nigi.requestLimiter')

export function sharedRequestLimiter(secret, dailyLimit, concurrentLimit) {
  const existing = globalThis[GLOBAL_KEY]
  if (existing?.secret === secret && existing?.dailyLimit === dailyLimit && existing?.concurrentLimit === concurrentLimit) {
    return existing.limiter
  }
  const limiter = new InMemoryRequestLimiter({ dailyLimit, concurrentLimit, hmacSecret: secret })
  globalThis[GLOBAL_KEY] = { secret, dailyLimit, concurrentLimit, limiter }
  return limiter
}
