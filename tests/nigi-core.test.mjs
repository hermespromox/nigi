import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateAskLizyScore,
  buildMetrics,
  normalizeBrief,
  parseJsonObject,
  verdictForScore,
} from '../lib/nigi-core.mjs'

test('AskLizy score preserves the existing KPI weights', () => {
  const metrics = {
    poiCount: 180,
    totalReviews: 60000,
    medianReviews: 450,
    avgRating: 4.8,
    reviewVelocity: 0.8,
    activityIndex: 100,
  }
  assert.equal(calculateAskLizyScore(metrics), 100)
  assert.equal(calculateAskLizyScore({ ...metrics, activityIndex: 0 }), 70)
  assert.equal(calculateAskLizyScore({ ...metrics, poiCount: 0 }), 88)
})

test('buildMetrics derives activity indicators without a visitors/day proxy', () => {
  const metrics = buildMetrics({
    activePlaces: [
      { rating: 4.5, review_count: 100 },
      { rating: 4.0, review_count: 300 },
    ],
    reviewsInWindow: 8,
    successfulSampleCount: 2,
    requestedSampleCount: 2,
    windowDays: 7,
    reviewsPerPlaceLimit: 20,
    rawPoiCount: 9,
  })
  assert.equal(metrics.avgRating, 4.25)
  assert.equal(metrics.reviewSampleCapacity, 40)
  assert.equal(metrics.activityIndex, 20)
  assert.equal(metrics.reviewCoverage, 100)
  assert.equal('areaVisitorsPerDay' in metrics, false)
})

test('parseJsonObject accepts fenced OpenRouter JSON and rejects arrays', () => {
  assert.deepEqual(parseJsonObject('```json\n{"address":"Paris"}\n```'), { address: 'Paris' })
  assert.throws(() => parseJsonObject('[{"address":"Paris"}]'), /JSON object/)
})

test('normalizeBrief asks one clarification when the address is missing', () => {
  assert.deepEqual(normalizeBrief({ businessType: 'bakery' }), {
    ready: false,
    address: '',
    businessType: 'bakery',
    positioning: 'mainstream',
    targetCustomer: 'local customers',
    country: 'fr',
    clarifyingQuestion: 'What address or precise area would you like me to analyse?',
  })
})

test('normalizeBrief returns a bounded ready brief', () => {
  const brief = normalizeBrief({
    address: ' 18 rue de la République, Lyon ',
    businessType: ' premium bakery ',
    positioning: 'premium',
    targetCustomer: 'office workers',
    country: 'FR',
  })
  assert.equal(brief.ready, true)
  assert.equal(brief.address, '18 rue de la République, Lyon')
  assert.equal(brief.country, 'fr')
})

test('verdictForScore uses deterministic AskLizy score bands', () => {
  assert.equal(verdictForScore(82), 'strong')
  assert.equal(verdictForScore(65), 'promising')
  assert.equal(verdictForScore(45), 'mixed')
  assert.equal(verdictForScore(22), 'weak')
})
