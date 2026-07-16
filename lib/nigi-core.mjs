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
