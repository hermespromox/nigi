import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import { validateExecutiveSummary } from '../lib/nigi-core.mjs'

const page = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8')

const generatedSummary = 'This location shows meaningful demand for a premium bakery, but the surrounding market is already crowded with visible, well-reviewed operators. The concept can succeed only if its product, service and presentation create an immediate reason to switch from established alternatives. The strongest opportunity is to build the offer around the customer themes found in nearby reviews while validating rent, trading patterns and direct competitors on site before committing.'

test('GPT executive summary is validated as bounded prose', () => {
  assert.equal(validateExecutiveSummary(generatedSummary), generatedSummary)
  assert.equal(validateExecutiveSummary('Too short.'), '')
  assert.ok(validateExecutiveSummary(`Evidence says ${'focus on differentiation '.repeat(100)}`).split(/\s+/).length <= 180)
})

test('result page renders the Nigi AI executive summary immediately after the score hero', () => {
  const scoreHero = page.indexOf('<section className="result-hero">')
  const heroEnd = page.indexOf('</section>', scoreHero)
  const summary = page.indexOf('className="executive-summary"')
  const marketSignals = page.indexOf('<SignalPanel', heroEnd)

  assert.ok(scoreHero >= 0)
  assert.ok(summary > heroEnd, 'executive summary must appear after the score hero')
  assert.ok(summary < marketSignals, 'executive summary must appear before detailed market signals')
  assert.match(page, /Nigi AI analysis/)
  assert.doesNotMatch(page, /GPT-5\.4 mini analysis/i)
  assert.match(page, /synthesis\.executiveSummary/)
})
