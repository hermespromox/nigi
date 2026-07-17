import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlacesEvidence,
  buildPlacesIntelligence,
  normalizePlaceRating,
  normalizeReviewCount,
  validCoordinates,
  validatePlacesStrategy,
} from '../lib/nigi-core.mjs'

const brief = {
  businessType: 'premium bakery',
  positioning: 'premium',
  targetCustomer: 'local professionals',
  address: '18 rue de la République, Lyon',
}

const analysis = {
  score: 62,
  metrics: {
    activePoiCount: 12,
    avgRating: 4.35,
    totalReviews: 24000,
    medianReviews: 380,
    reviewsInWindow: 18,
    activityIndex: 45,
    reviewCoverage: 100,
  },
  topPlaces: [
    {
      evidenceId: 'P1',
      name: 'Maison Alpha',
      types: ['bakery', 'cafe'],
      rating: 4.8,
      reviewCount: 4100,
      distanceMeters: 120,
      priceLevel: '$$$',
      workingHours: ['Monday: 08:00-19:00'],
      recentReviewSnippets: [{ rating: 5, text: 'Excellent croissants and friendly service.' }],
    },
    {
      evidenceId: 'P2',
      name: 'Boulangerie Beta',
      types: ['bakery'],
      rating: 3.9,
      reviewCount: 700,
      distanceMeters: 340,
      priceLevel: '$$',
      workingHours: [],
      recentReviewSnippets: [{ rating: 2, text: 'Long wait and disappointing value.' }],
    },
  ],
}

test('provider numerics reject non-finite, out-of-range and unsafe values', () => {
  assert.equal(normalizePlaceRating('4.8'), 4.8)
  assert.equal(normalizePlaceRating(null), null)
  assert.equal(normalizePlaceRating(7), null)
  assert.equal(normalizeReviewCount('4100'), 4100)
  assert.equal(normalizeReviewCount('Infinity'), null)
  assert.equal(normalizeReviewCount(-1), null)
  assert.equal(validCoordinates(48.8, 2.3), true)
  assert.equal(validCoordinates(999, 2.3), false)
  assert.equal(validCoordinates(null, null), false)
  assert.equal(validCoordinates('', ''), false)
})

test('missing ratings do not create rating-variation patterns', () => {
  const evidence = buildPlacesEvidence(brief, {
    ...analysis,
    topPlaces: [analysis.topPlaces[0], { ...analysis.topPlaces[1], rating: null }],
  })
  assert.equal(evidence.eligibleMarketPatternCodes.includes('UNEVEN_RATINGS'), false)
})

test('review themes require lexical support in actual excerpts and confidence is evidence-capped', () => {
  const sparse = buildPlacesEvidence(brief, {
    ...analysis,
    metrics: { ...analysis.metrics, reviewCoverage: 50 },
    topPlaces: [
      { ...analysis.topPlaces[0], recentReviewSnippets: [{ rating: 5, text: 'Excellent croissants.' }] },
      { ...analysis.topPlaces[1], recentReviewSnippets: [] },
    ],
  })
  const strategy = validatePlacesStrategy({
    reviewThemes: [
      { code: 'SERVICE', placeIds: ['P1', 'P2'] },
      { code: 'PRODUCT_QUALITY', placeIds: ['P1'] },
    ],
    confidence: 'medium-high',
  }, sparse)
  assert.deepEqual(strategy.reviewThemes, [{ code: 'PRODUCT_QUALITY', placeIds: ['P1'] }])
  assert.equal(strategy.confidence, 'medium')

  const substringTrap = buildPlacesEvidence(brief, {
    ...analysis,
    topPlaces: [{ ...analysis.topPlaces[0], recentReviewSnippets: [{ rating: 5, text: 'I cherish the excellent painting.' }] }],
  })
  const trapped = validatePlacesStrategy({
    reviewThemes: [
      { code: 'PRICE_VALUE', placeIds: ['P1'] },
      { code: 'WAIT_TIME', placeIds: ['P1'] },
      { code: 'PRODUCT_QUALITY', placeIds: ['P1'] },
    ],
  }, substringTrap)
  assert.deepEqual(trapped.reviewThemes, [])
})

test('buildPlacesEvidence sends bounded place, category, operating and review evidence to the model', () => {
  const evidence = buildPlacesEvidence(brief, analysis)
  assert.equal(evidence.businessContext.businessType, 'premium bakery')
  assert.equal(evidence.places.length, 2)
  assert.deepEqual(evidence.places[0].types, ['bakery', 'cafe'])
  assert.equal(evidence.places[0].priceLevel, '$$$')
  assert.equal(evidence.places[0].hasWorkingHours, true)
  assert.deepEqual(evidence.places[0].workingHours, ['Monday: 08:00-19:00'])
  assert.match(evidence.places[0].recentReviewSnippets[0].text, /croissants/)
  assert.ok(evidence.eligibleMarketPatternCodes.includes('CLOSE_COMPETITION'))
  assert.ok(evidence.eligibleMarketPatternCodes.includes('UNEVEN_RATINGS'))
  assert.ok(evidence.eligibleOpportunityCodes.includes('STUDY_REVIEW_THEMES'))
  assert.doesNotMatch(JSON.stringify(evidence), /user_name|review_link|phone_number/)
})

test('validatePlacesStrategy rejects unsupported claims and unknown place references', () => {
  const evidence = buildPlacesEvidence(brief, analysis)
  const strategy = validatePlacesStrategy({
    marketPatternCodes: ['CLOSE_COMPETITION', 'INVENTED_FOOTFALL'],
    opportunityCodes: ['STUDY_REVIEW_THEMES', 'LEASE_NOW'],
    competitorPlaceIds: ['P1', 'P999'],
    reviewThemes: [
      { code: 'SERVICE', placeIds: ['P1', 'P999'] },
      { code: 'INVENTED_THEME', placeIds: ['P2'] },
    ],
    confidence: 'high',
    narrative: 'Invented prose must not pass through.',
  }, evidence)

  assert.deepEqual(strategy.marketPatternCodes, ['CLOSE_COMPETITION'])
  assert.deepEqual(strategy.opportunityCodes, ['STUDY_REVIEW_THEMES'])
  assert.deepEqual(strategy.competitorPlaceIds, ['P1'])
  assert.deepEqual(strategy.reviewThemes, [{ code: 'SERVICE', placeIds: ['P1'] }])
  assert.equal(strategy.confidence, 'medium')
  assert.doesNotMatch(JSON.stringify(strategy), /Invented prose|INVENTED/)
})

test('buildPlacesIntelligence turns model selections into evidence-linked deterministic copy', () => {
  const evidence = buildPlacesEvidence(brief, analysis)
  const intelligence = buildPlacesIntelligence(brief, evidence, {
    marketPatternCodes: ['CLOSE_COMPETITION', 'UNEVEN_RATINGS'],
    opportunityCodes: ['DIFFERENTIATION_ESSENTIAL', 'STUDY_REVIEW_THEMES'],
    competitorPlaceIds: ['P1'],
    reviewThemes: [{ code: 'SERVICE', placeIds: ['P1'] }],
    confidence: 'medium-high',
  })

  assert.match(intelligence.headline, /premium bakery/i)
  assert.match(intelligence.summary, /competitive local market with strong demand momentum/i)
  assert.match(intelligence.competitorHighlights[0], /Maison Alpha.*immediate competitor.*excellent customer standing.*entrenched market visibility/)
  assert.ok(intelligence.marketPatterns.some((item) => /direct competition is immediate/i.test(item)))
  assert.ok(intelligence.opportunities.some((item) => /differentiat/i.test(item)))
  assert.match(intelligence.reviewThemes[0], /service.*Maison Alpha/i)
  assert.doesNotMatch(JSON.stringify(intelligence), /footfall|sales forecast/i)
})
