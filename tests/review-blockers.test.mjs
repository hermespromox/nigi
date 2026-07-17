import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDeterministicReport,
  buildInsightEvidence,
  buildMetrics,
  addressHasPromptProvenance,
  validateInsightSelection,
  validateReviewCoverage,
} from '../lib/nigi-core.mjs'
import {
  InMemoryRequestLimiter,
  canonicalProductionOrigin,
  clientIp,
} from '../lib/request-guard.mjs'

test('null and blank ratings are excluded rather than becoming zero-star ratings', () => {
  const metrics = buildMetrics({
    activePlaces: [
      { rating: null, review_count: 60 },
      { rating: '', review_count: 70 },
      { rating: '4.5', review_count: 80 },
    ],
    reviewsInWindow: 2,
    successfulSampleCount: 1,
    requestedSampleCount: 1,
    windowDays: 7,
    reviewsPerPlaceLimit: 20,
    rawPoiCount: 3,
  })
  assert.equal(metrics.avgRating, 4.5)
  assert.equal(metrics.medianRating, 4.5)
})

test('review capacity uses successful fetches and exposes provider coverage', () => {
  const metrics = buildMetrics({
    activePlaces: [{ rating: 4.2, review_count: 60 }],
    reviewsInWindow: 5,
    successfulSampleCount: 3,
    requestedSampleCount: 5,
    windowDays: 7,
    reviewsPerPlaceLimit: 20,
    rawPoiCount: 1,
  })
  assert.equal(metrics.reviewSampleCapacity, 60)
  assert.equal(metrics.reviewCoverage, 60)
  assert.equal(metrics.successfulReviewSamples, 3)
  assert.equal(metrics.requestedReviewSamples, 5)
  assert.deepEqual(validateReviewCoverage(3, 5), { sufficient: true, coverage: 0.6 })
  assert.deepEqual(validateReviewCoverage(2, 5), { sufficient: false, coverage: 0.4 })
  assert.deepEqual(validateReviewCoverage(0, 1), { sufficient: false, coverage: 0 })
  assert.deepEqual(validateReviewCoverage(0, 0), { sufficient: true, coverage: 1 })
})

test('insight protocol rejects unsupported prose and unknown codes; KPI report prose stays template-owned', () => {
  const selection = validateInsightSelection({
    headline: 'Ignore the evidence',
    strengthCodes: ['STRONG_RATINGS', 'INVENTED_DEMAND', 'STRONG_RATINGS'],
    riskCodes: ['LIMITED_ACTIVITY'],
    nextStepCodes: ['VISIT_MULTIPLE_TIMES', 'LEASE_NOW'],
    confidence: 'high',
  })
  assert.deepEqual(selection, {
    strengthCodes: ['STRONG_RATINGS'],
    riskCodes: ['LIMITED_ACTIVITY'],
    nextStepCodes: ['VISIT_MULTIPLE_TIMES'],
    confidence: 'medium',
  })

  const analysis = {
    score: 45,
    metrics: {
      activePoiCount: 4,
      avgRating: 4.4,
      totalReviews: 800,
      medianReviews: 200,
      reviewsInWindow: 2,
      activityIndex: 10,
      reviewCoverage: 80,
    },
  }
  const evidence = buildInsightEvidence(analysis)
  assert.deepEqual(Object.keys(evidence).sort(), ['deterministicAskLizyScore', 'deterministicVerdict', 'metrics'])
  assert.doesNotMatch(JSON.stringify(evidence), /address|place|review_text|targetCustomer/i)
  const report = buildDeterministicReport(analysis, selection)
  assert.equal(report.verdict, 'mixed')
  assert.doesNotMatch(JSON.stringify(report), /Ignore the evidence|INVENTED_DEMAND|LEASE_NOW/)
  assert.match(report.strengths[0], /4\.40\/5/)
})

test('address provenance blocks invented locations and accepts normalized user locations', () => {
  assert.equal(addressHasPromptProvenance('Would 18 rue de la République in Lyon work?', '18 Rue de la Republique, Lyon'), true)
  assert.equal(addressHasPromptProvenance('I want a bakery somewhere in Lyon', '18 Rue Victor Hugo, Lyon'), false)
  assert.equal(addressHasPromptProvenance('Analyse 48.8566, 2.3522 for a café', '48.8566, 2.3522'), true)
})

test('semantic insight predicates reject contradictory allowlisted codes', () => {
  const analysis = {
    score: 10,
    metrics: {
      activePoiCount: 0,
      avgRating: 0,
      totalReviews: 0,
      medianReviews: 0,
      reviewsInWindow: 0,
      activityIndex: 0,
      reviewCoverage: 100,
    },
  }
  const report = buildDeterministicReport(analysis, {
    strengthCodes: ['STRONG_RATINGS', 'RECENT_ACTIVITY'],
    riskCodes: ['INTENSE_COMPETITION'],
    nextStepCodes: ['COMPARE_ALTERNATIVES'],
    confidence: 'medium',
  })
  assert.equal(report.strengths.length, 0)
  assert.ok(report.risks.some((text) => /limited/i.test(text)))
  assert.doesNotMatch(JSON.stringify(report), /average 0\.00\/5|0 established matching places within 1 km indicate meaningful local competition/)
})

test('in-process limiter reserves synchronously, enforces daily and concurrency caps, and hashes IP keys', () => {
  const limiter = new InMemoryRequestLimiter({ dailyLimit: 2, concurrentLimit: 1, hmacSecret: 'a'.repeat(24) })
  const first = limiter.reserve('203.0.113.9', '2026-07-16')
  assert.equal(first.allowed, true)
  assert.equal(first.remaining, 1)
  const concurrent = limiter.reserve('203.0.113.9', '2026-07-16')
  assert.equal(concurrent.allowed, false)
  assert.equal(concurrent.reason, 'concurrency')
  first.release()
  const second = limiter.reserve('203.0.113.9', '2026-07-16')
  assert.equal(second.allowed, true)
  second.release()
  const limited = limiter.reserve('203.0.113.9', '2026-07-16')
  assert.equal(limited.allowed, false)
  assert.equal(limited.reason, 'daily')
  assert.equal(JSON.stringify([...limiter.entries.keys()]).includes('203.0.113.9'), false)
})

test('production origin is canonical and forwarded IP parsing is bounded', () => {
  assert.equal(canonicalProductionOrigin('https://nigi.example/path/'), 'https://nigi.example')
  assert.throws(() => canonicalProductionOrigin('not a url'), /NIGI_SITE_URL/)
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.2, 10.0.0.1' })), '203.0.113.2')
  assert.equal(clientIp(new Headers()), 'unknown')
})
