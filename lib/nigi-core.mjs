const MAX_TEXT = 500
const MIN_REVIEW_COVERAGE = 0.6

function cleanText(value, fallback = '', max = MAX_TEXT) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return (text || fallback).slice(0, max)
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function normalizePlaceRating(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null
}

export function normalizeReviewCount(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 && count <= 1000000000 ? count : null
}

export function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function calculateAskLizyScore(metrics) {
  const densityScore = Math.min(Number(metrics.poiCount || 0) / 180, 1) * 12
  const volumeScore = Math.min(Number(metrics.totalReviews || 0) / 60000, 1) * 22
  const reviewDepthScore = Math.min(Number(metrics.medianReviews || 0) / 450, 1) * 10
  const qualityScore = Math.min(Math.max((Number(metrics.avgRating || 0) - 4.0) / 0.8, 0), 1) * 16
  const velocityScore = Math.min(Number(metrics.reviewVelocity || 0) / 0.8, 1) * 10
  const activityScore = Math.min(Number(metrics.activityIndex || 0) / 100, 1) * 30
  return Math.max(0, Math.min(100, Math.round(
    densityScore + volumeScore + reviewDepthScore + qualityScore + velocityScore + activityScore
  )))
}

export function validateReviewCoverage(successful, requested) {
  const requestedCount = Math.max(0, Math.floor(Number(requested) || 0))
  const successfulCount = Math.min(requestedCount, Math.max(0, Math.floor(Number(successful) || 0)))
  const coverage = requestedCount === 0 ? 1 : successfulCount / requestedCount
  return { sufficient: coverage >= MIN_REVIEW_COVERAGE, coverage }
}

export function buildMetrics({
  activePlaces,
  reviewsInWindow,
  successfulSampleCount,
  requestedSampleCount,
  samplePlaceCount,
  windowDays,
  reviewsPerPlaceLimit,
  rawPoiCount,
}) {
  // samplePlaceCount remains accepted for compatibility, but successful samples are authoritative.
  const successful = Number(successfulSampleCount ?? samplePlaceCount ?? 0)
  const requested = Number(requestedSampleCount ?? samplePlaceCount ?? 0)
  const ratings = activePlaces
    .map((place) => place.rating)
    .filter((rating) => rating !== null && rating !== undefined && String(rating).trim() !== '')
    .map(Number)
    .filter(Number.isFinite)
  const reviewCounts = activePlaces.map((place) => Number(place.review_count || 0))
  const totalReviews = reviewCounts.reduce((sum, value) => sum + value, 0)
  const avgRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0
  const reviewVelocity = Number(reviewsInWindow || 0) / Math.max(Number(windowDays || 1), 1)
  const capacity = successful * Number(reviewsPerPlaceLimit || 0)
  const activityIndex = capacity ? (Number(reviewsInWindow || 0) / capacity) * 100 : 0
  const coverage = validateReviewCoverage(successful, requested).coverage

  return {
    poiCount: activePlaces.length,
    activePoiCount: activePlaces.length,
    rawPoiCount: Number(rawPoiCount || 0),
    avgRating: Number(avgRating.toFixed(3)),
    medianRating: Number(median(ratings).toFixed(3)),
    totalReviews,
    medianReviews: median(reviewCounts),
    reviewsInWindow: Number(reviewsInWindow || 0),
    reviewSampleCapacity: capacity,
    reviewVelocity: Number(reviewVelocity.toFixed(3)),
    reviewVelocityPerPlace: Number((reviewVelocity / Math.max(successful, 1)).toFixed(3)),
    activityIndex: Number(activityIndex.toFixed(1)),
    successfulReviewSamples: successful,
    requestedReviewSamples: requested,
    reviewCoverage: Number((coverage * 100).toFixed(1)),
  }
}

export function parseJsonObject(text) {
  const input = String(text || '').trim()
  const unwrapped = input.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  if (unwrapped.startsWith('[')) throw new Error('Expected a JSON object')
  const firstBrace = unwrapped.indexOf('{')
  const lastBrace = unwrapped.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace < firstBrace) throw new Error('Expected a JSON object')
  const value = JSON.parse(unwrapped.slice(firstBrace, lastBrace + 1))
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Expected a JSON object')
  return value
}

export function normalizeBrief(value) {
  const address = cleanText(value?.address, '', 300)
  const businessType = cleanText(value?.businessType, 'retail store', 120).toLowerCase()
  const positioning = cleanText(value?.positioning, 'mainstream', 80).toLowerCase()
  const targetCustomer = cleanText(value?.targetCustomer, 'local customers', 160)
  const rawCountry = cleanText(value?.country, 'fr', 2).toLowerCase()
  const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : 'fr'
  const ready = Boolean(address)
  return {
    ready,
    address,
    businessType,
    positioning,
    targetCustomer,
    country,
    clarifyingQuestion: ready ? '' : 'What address or precise area would you like me to analyse?',
  }
}

function normalizedTokens(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().match(/[a-z0-9]+/g) || []
}

export function addressHasPromptProvenance(prompt, address) {
  const promptTokens = new Set(normalizedTokens(prompt))
  const addressTokens = normalizedTokens(address)
  if (!addressTokens.length) return false
  const numbers = addressTokens.filter((token) => /^\d+$/.test(token))
  if (numbers.some((token) => !promptTokens.has(token))) return false
  const significant = addressTokens.filter((token) => token.length > 2 || /^\d+$/.test(token))
  if (!significant.length) return false
  const matches = significant.filter((token) => promptTokens.has(token)).length
  return matches / significant.length >= 0.6
}

export function verdictForScore(score) {
  const value = Number(score || 0)
  if (value >= 80) return 'strong'
  if (value >= 60) return 'promising'
  if (value >= 40) return 'mixed'
  return 'weak'
}

const CODE_ALLOWLISTS = {
  strengthCodes: new Set(['ESTABLISHED_PRESENCE', 'STRONG_RATINGS', 'DEEP_REVIEW_HISTORY', 'RECENT_ACTIVITY']),
  riskCodes: new Set(['INTENSE_COMPETITION', 'WEAK_RATINGS', 'LIMITED_ACTIVITY', 'LIMITED_EVIDENCE']),
  nextStepCodes: new Set(['VISIT_MULTIPLE_TIMES', 'COMPARE_ALTERNATIVES', 'VALIDATE_COSTS', 'INSPECT_COMPETITORS']),
}

function allowlistedCodes(value, key) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((code) => typeof code === 'string' && CODE_ALLOWLISTS[key].has(code)))].slice(0, 4)
}

export function validateInsightSelection(value) {
  const confidence = new Set(['medium-high', 'medium', 'low']).has(value?.confidence) ? value.confidence : 'medium'
  return {
    strengthCodes: allowlistedCodes(value?.strengthCodes, 'strengthCodes'),
    riskCodes: allowlistedCodes(value?.riskCodes, 'riskCodes'),
    nextStepCodes: allowlistedCodes(value?.nextStepCodes, 'nextStepCodes'),
    confidence,
  }
}

export function buildInsightEvidence(analysis) {
  const metrics = analysis?.metrics || {}
  return {
    deterministicAskLizyScore: Number(analysis?.score || 0),
    deterministicVerdict: verdictForScore(analysis?.score),
    metrics: {
      activePoiCount: Number(metrics.activePoiCount || 0),
      avgRating: Number(metrics.avgRating || 0),
      totalReviews: Number(metrics.totalReviews || 0),
      medianReviews: Number(metrics.medianReviews || 0),
      reviewsInWindow: Number(metrics.reviewsInWindow || 0),
      activityIndex: Number(metrics.activityIndex || 0),
      reviewCoverage: Number(metrics.reviewCoverage || 0),
    },
  }
}

const HEADLINES = {
  strong: 'Strong digital location signals',
  promising: 'Promising signals, with checks still needed',
  mixed: 'Mixed signals call for careful validation',
  weak: 'Weak signals suggest comparing alternatives',
}

function defaultCodes(metrics) {
  const strengths = []
  const risks = []
  if (metrics.activePoiCount > 0) strengths.push('ESTABLISHED_PRESENCE')
  if (metrics.avgRating >= 4.2) strengths.push('STRONG_RATINGS')
  if (metrics.medianReviews >= 150) strengths.push('DEEP_REVIEW_HISTORY')
  if (metrics.activityIndex >= 25) strengths.push('RECENT_ACTIVITY')
  if (metrics.activePoiCount >= 3) risks.push('INTENSE_COMPETITION')
  if (metrics.avgRating > 0 && metrics.avgRating < 4.2) risks.push('WEAK_RATINGS')
  if (metrics.activityIndex < 25) risks.push('LIMITED_ACTIVITY')
  if (metrics.reviewCoverage < 100 || metrics.activePoiCount === 0) risks.push('LIMITED_EVIDENCE')
  return { strengths, risks }
}

export function buildDeterministicReport(analysis, rawSelection) {
  const selection = validateInsightSelection(rawSelection)
  const metrics = buildInsightEvidence(analysis).metrics
  const verdict = verdictForScore(analysis?.score)
  const defaults = defaultCodes(metrics)
  // OpenRouter may only order codes whose deterministic predicates are true.
  const eligibleStrengths = new Set(defaults.strengths)
  const eligibleRisks = new Set(defaults.risks)
  const selectedStrengths = selection.strengthCodes.filter((code) => eligibleStrengths.has(code))
  const selectedRisks = selection.riskCodes.filter((code) => eligibleRisks.has(code))
  const strengthCodes = selectedStrengths.length ? selectedStrengths : defaults.strengths
  const riskCodes = selectedRisks.length ? selectedRisks : defaults.risks
  const nextCodes = selection.nextStepCodes.length ? selection.nextStepCodes : ['VISIT_MULTIPLE_TIMES', 'COMPARE_ALTERNATIVES']
  const strengthTemplates = {
    ESTABLISHED_PRESENCE: `${metrics.activePoiCount} established matching places were observed within 1 km.`,
    STRONG_RATINGS: `Observed matching places average ${metrics.avgRating.toFixed(2)}/5 across available ratings.`,
    DEEP_REVIEW_HISTORY: `The median observed place has ${Math.round(metrics.medianReviews).toLocaleString('en-US')} reviews, indicating a substantial digital history.`,
    RECENT_ACTIVITY: `Recent review activity produced an activity index of ${metrics.activityIndex.toFixed(1)}/100.`,
  }
  const riskTemplates = {
    INTENSE_COMPETITION: `${metrics.activePoiCount} established matching places within 1 km indicate meaningful local competition.`,
    WEAK_RATINGS: `Average observed ratings are ${metrics.avgRating.toFixed(2)}/5, a signal that needs closer competitor review.`,
    LIMITED_ACTIVITY: `Recent review activity is limited: ${metrics.reviewsInWindow} sampled reviews and an activity index of ${metrics.activityIndex.toFixed(1)}/100.`,
    LIMITED_EVIDENCE: `Review-provider coverage was ${metrics.reviewCoverage.toFixed(1)}%, so the available evidence should be treated cautiously.`,
  }
  const nextTemplates = {
    VISIT_MULTIPLE_TIMES: 'Visit the site at several relevant trading times before making a commitment.',
    COMPARE_ALTERNATIVES: 'Compare this site with at least two realistic alternatives using the same checks.',
    VALIDATE_COSTS: 'Validate rent, service charges and fit-out costs against a conservative sales scenario.',
    INSPECT_COMPETITORS: 'Inspect the strongest nearby competitors and document their offer, pricing and busy periods.',
  }
  return {
    headline: HEADLINES[verdict],
    verdict,
    summary: `The ${verdict} assessment is based on an AskLizy score of ${Number(analysis?.score || 0)}/100, ${metrics.activePoiCount} established matching places, ${metrics.totalReviews.toLocaleString('en-US')} combined reviews and an activity index of ${metrics.activityIndex.toFixed(1)}/100. These digital signals require on-site and financial validation.`,
    strengths: strengthCodes.map((code) => strengthTemplates[code]).filter(Boolean),
    risks: riskCodes.map((code) => riskTemplates[code]).filter(Boolean),
    nextSteps: nextCodes.map((code) => nextTemplates[code]).filter(Boolean),
    confidence: selection.confidence,
  }
}


const MARKET_PATTERN_CODES = new Set([
  'DENSE_COMPETITION', 'CLOSE_COMPETITION', 'STRONG_LEADERS', 'HIGH_RATING_BAR',
  'UNEVEN_RATINGS', 'REPEAT_BRAND_PRESENCE', 'RECENT_MARKET_ACTIVITY', 'LOW_RECENT_ACTIVITY',
])

const OPPORTUNITY_CODES = new Set([
  'DIFFERENTIATION_ESSENTIAL', 'PREMIUM_EXECUTION_BAR', 'CHALLENGE_WEAKLY_RATED',
  'STUDY_REVIEW_THEMES', 'AUDIT_OPENING_HOURS',
])

const REVIEW_THEME_CODES = new Set(['PRODUCT_QUALITY', 'SERVICE', 'PRICE_VALUE', 'ATMOSPHERE', 'WAIT_TIME', 'ACCESSIBILITY'])
const REVIEW_THEME_TERMS = {
  PRODUCT_QUALITY: ['quality', 'qualite', 'taste', 'tasty', 'delicious', 'food', 'product', 'produit', 'pain', 'bread', 'croissant', 'croissants'],
  SERVICE: ['service', 'staff', 'friendly', 'waiter', 'personnel', 'accueil', 'serveur'],
  PRICE_VALUE: ['price', 'value', 'expensive', 'cheap', 'prix', 'cher', 'rapport qualite'],
  ATMOSPHERE: ['atmosphere', 'ambiance', 'decor', 'cosy', 'cozy'],
  WAIT_TIME: ['wait', 'queue', 'slow', 'attente', 'lent'],
  ACCESSIBILITY: ['access', 'accessible', 'wheelchair', 'parking', 'acces'],
}

function themeSupportedByPlace(code, place) {
  const text = (place?.recentReviewSnippets || []).map((snippet) => snippet.text).join(' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return (REVIEW_THEME_TERMS[code] || []).some((term) => {
    const pattern = term.split(' ').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
    return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, 'i').test(text)
  })
}

function normalizedPlaceName(value) {
  return cleanText(value, '', 160).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function derivePlacesEligibility(places, metrics) {
  const ratings = places.filter((place) => place.rating !== null && place.rating !== undefined)
    .map((place) => Number(place.rating)).filter(Number.isFinite)
  const distances = places.map((place) => Number(place.distanceMeters)).filter(Number.isFinite)
  const names = places.map((place) => normalizedPlaceName(place.name)).filter(Boolean)
  const snippets = places.flatMap((place) => place.recentReviewSnippets || [])
  const patterns = []
  if (Number(metrics.activePoiCount || 0) >= 10) patterns.push('DENSE_COMPETITION')
  if (distances.length && Math.min(...distances) <= 300) patterns.push('CLOSE_COMPETITION')
  if (places.some((place) => Number(place.reviewCount || 0) >= 1000)) patterns.push('STRONG_LEADERS')
  if (ratings.length && ratings.reduce((sum, value) => sum + value, 0) / ratings.length >= 4.5) patterns.push('HIGH_RATING_BAR')
  if (ratings.length > 1 && Math.max(...ratings) - Math.min(...ratings) >= 0.6) patterns.push('UNEVEN_RATINGS')
  if (new Set(names).size < names.length) patterns.push('REPEAT_BRAND_PRESENCE')
  if (Number(metrics.activityIndex || 0) >= 25) patterns.push('RECENT_MARKET_ACTIVITY')
  else patterns.push('LOW_RECENT_ACTIVITY')

  const opportunities = []
  if (patterns.includes('DENSE_COMPETITION') || patterns.includes('CLOSE_COMPETITION')) opportunities.push('DIFFERENTIATION_ESSENTIAL')
  if (patterns.includes('HIGH_RATING_BAR') || patterns.includes('STRONG_LEADERS')) opportunities.push('PREMIUM_EXECUTION_BAR')
  if (patterns.includes('UNEVEN_RATINGS')) opportunities.push('CHALLENGE_WEAKLY_RATED')
  if (snippets.length) opportunities.push('STUDY_REVIEW_THEMES')
  if (places.some((place) => place.hasWorkingHours)) opportunities.push('AUDIT_OPENING_HOURS')
  return { patterns, opportunities }
}

export function buildPlacesEvidence(brief, analysis) {
  const places = (Array.isArray(analysis?.topPlaces) ? analysis.topPlaces : []).slice(0, 10).map((place, index) => ({
    id: cleanText(place.evidenceId, `P${index + 1}`, 12),
    name: cleanText(place.name, 'Unknown place', 160),
    types: (Array.isArray(place.types) ? place.types : []).map((type) => cleanText(type, '', 60)).filter(Boolean).slice(0, 8),
    rating: place.rating === null || place.rating === undefined ? null : Number(place.rating),
    reviewCount: Math.max(0, Number(place.reviewCount || 0)),
    distanceMeters: Number.isFinite(Number(place.distanceMeters)) ? Number(place.distanceMeters) : null,
    priceLevel: cleanText(place.priceLevel, '', 24),
    hasWorkingHours: Array.isArray(place.workingHours) && place.workingHours.length > 0,
    workingHours: (Array.isArray(place.workingHours) ? place.workingHours : []).map((hours) => cleanText(hours, '', 120)).filter(Boolean).slice(0, 7),
    recentReviewSnippets: (Array.isArray(place.recentReviewSnippets) ? place.recentReviewSnippets : []).slice(0, 2).map((review) => ({
      rating: review.rating === null || review.rating === undefined ? null : Number(review.rating),
      text: cleanText(review.text, '', 180),
    })).filter((review) => review.text),
  }))
  const metrics = buildInsightEvidence(analysis).metrics
  const eligible = derivePlacesEligibility(places, metrics)
  return {
    businessContext: {
      businessType: cleanText(brief?.businessType, 'retail store', 120),
      positioning: cleanText(brief?.positioning, 'mainstream', 80),
      targetCustomer: cleanText(brief?.targetCustomer, 'local customers', 160),
    },
    aggregateSignals: metrics,
    places,
    eligibleMarketPatternCodes: eligible.patterns,
    eligibleOpportunityCodes: eligible.opportunities,
  }
}

export function validatePlacesStrategy(value, evidence) {
  const places = evidence?.places || []
  const byId = new Map(places.map((place) => [place.id, place]))
  const knownIds = new Set(byId.keys())
  const eligiblePatterns = new Set(evidence?.eligibleMarketPatternCodes || [])
  const eligibleOpportunities = new Set(evidence?.eligibleOpportunityCodes || [])
  const uniqueEligible = (items, allowed, limit = 5) => [...new Set((Array.isArray(items) ? items : [])
    .filter((item) => typeof item === 'string' && allowed.has(item)))].slice(0, limit)
  const reviewThemes = (Array.isArray(value?.reviewThemes) ? value.reviewThemes : []).map((theme) => {
    const code = typeof theme?.code === 'string' && REVIEW_THEME_CODES.has(theme.code) ? theme.code : ''
    const placeIds = uniqueEligible(theme?.placeIds, knownIds, 3).filter((id) => code && themeSupportedByPlace(code, byId.get(id)))
    return { code, placeIds }
  }).filter((theme) => theme.code && theme.placeIds.length).slice(0, 4)
  const requestedConfidence = new Set(['medium-high', 'medium', 'low']).has(value?.confidence) ? value.confidence : 'medium'
  const snippetCount = places.reduce((sum, place) => sum + (place.recentReviewSnippets || []).length, 0)
  const coverage = Number(evidence?.aggregateSignals?.reviewCoverage || 0)
  const confidenceCeiling = places.length >= 5 && snippetCount >= 3 && coverage >= 80 ? 'medium-high' : places.length ? 'medium' : 'low'
  const confidenceRank = { low: 0, medium: 1, 'medium-high': 2 }
  const confidence = confidenceRank[requestedConfidence] <= confidenceRank[confidenceCeiling] ? requestedConfidence : confidenceCeiling
  return {
    marketPatternCodes: uniqueEligible(value?.marketPatternCodes, new Set([...MARKET_PATTERN_CODES].filter((code) => eligiblePatterns.has(code)))),
    opportunityCodes: uniqueEligible(value?.opportunityCodes, new Set([...OPPORTUNITY_CODES].filter((code) => eligibleOpportunities.has(code))), 4),
    competitorPlaceIds: uniqueEligible(value?.competitorPlaceIds, knownIds, 3),
    reviewThemes,
    confidence,
  }
}

export function buildPlacesIntelligence(brief, evidence, rawStrategy) {
  const strategy = validatePlacesStrategy(rawStrategy, evidence)
  const places = evidence?.places || []
  const byId = new Map(places.map((place) => [place.id, place]))
  const metrics = evidence?.aggregateSignals || {}
  const businessType = cleanText(brief?.businessType, 'business', 120)
  const positioning = cleanText(brief?.positioning, 'chosen', 80)
  const patterns = strategy.marketPatternCodes.length ? strategy.marketPatternCodes : (evidence?.eligibleMarketPatternCodes || []).slice(0, 3)
  const opportunities = strategy.opportunityCodes.length ? strategy.opportunityCodes : (evidence?.eligibleOpportunityCodes || []).slice(0, 3)
  const nearest = places.map((place) => Number(place.distanceMeters)).filter(Number.isFinite).sort((a, b) => a - b)[0]
  const patternTemplates = {
    DENSE_COMPETITION: `${Number(metrics.activePoiCount || 0)} established matching places within 1 km make this a dense competitive market.`,
    CLOSE_COMPETITION: `A leading sampled competitor is only ${Math.round(nearest || 0).toLocaleString('en-US')} m from the candidate location.`,
    STRONG_LEADERS: 'At least one nearby operator has a substantial review history, indicating entrenched digital visibility.',
    HIGH_RATING_BAR: 'The strongest nearby operators set a high customer-rating benchmark.',
    UNEVEN_RATINGS: 'Ratings vary materially across the sampled competitors, suggesting inconsistent customer experiences in the area.',
    REPEAT_BRAND_PRESENCE: 'A repeated name appears among the leading nearby results; verify whether this reflects multiple branches or duplicate provider records.',
    RECENT_MARKET_ACTIVITY: `Recent review activity is strong, with an activity index of ${Number(metrics.activityIndex || 0).toFixed(1)}/100.`,
    LOW_RECENT_ACTIVITY: `Recent review activity is limited, with an activity index of ${Number(metrics.activityIndex || 0).toFixed(1)}/100.`,
  }
  const opportunityTemplates = {
    DIFFERENTIATION_ESSENTIAL: `A ${businessType} here needs a clearly differentiated offer rather than a generic copy of nearby operators.`,
    PREMIUM_EXECUTION_BAR: `The ${positioning} positioning must match or exceed the strongest competitors on product, service and presentation.`,
    CHALLENGE_WEAKLY_RATED: 'Study lower-rated competitors to identify service or product weaknesses that a new entrant could address.',
    STUDY_REVIEW_THEMES: 'Use the recent review themes as hypotheses for fieldwork and customer interviews, not as a substitute for them.',
    AUDIT_OPENING_HOURS: 'Compare competitor opening hours to identify potentially underserved trading periods.',
  }
  const themeLabels = {
    PRODUCT_QUALITY: 'product quality', SERVICE: 'service', PRICE_VALUE: 'price and value',
    ATMOSPHERE: 'atmosphere', WAIT_TIME: 'waiting time', ACCESSIBILITY: 'accessibility',
  }
  const competitorIds = strategy.competitorPlaceIds.length ? strategy.competitorPlaceIds : places.slice(0, 3).map((place) => place.id)
  return {
    headline: `What the nearby places mean for this ${businessType}`,
    summary: `${Number(metrics.activePoiCount || 0)} established matching places were observed within 1 km. GPT-5.4 Mini prioritised the most relevant competitive signals for the proposed ${positioning} concept; numeric evidence is sourced from Places-provider data or derived using documented Nigi rules.`,
    marketPatterns: patterns.map((code) => patternTemplates[code]).filter(Boolean),
    competitorHighlights: competitorIds.map((id) => byId.get(id)).filter(Boolean).map((place) => {
      const rating = place.rating === null ? 'with no available rating' : `rated ${Number(place.rating).toFixed(2)}/5`
      return `${place.name} is ${Math.round(place.distanceMeters || 0).toLocaleString('en-US')} m away, ${rating}, with ${Number(place.reviewCount || 0).toLocaleString('en-US')} reviews.`
    }),
    opportunities: opportunities.map((code) => opportunityTemplates[code]).filter(Boolean),
    reviewThemes: strategy.reviewThemes.map((theme) => {
      const names = theme.placeIds.map((id) => byId.get(id)?.name).filter(Boolean).join(', ')
      return `Bounded review excerpts support investigating ${themeLabels[theme.code]} around ${names}.`
    }),
    confidence: strategy.confidence,
  }
}
