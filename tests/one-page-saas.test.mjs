import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pageSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8')
const routeSource = fs.readFileSync(new URL('../app/api/analyze/route.js', import.meta.url), 'utf8')

function sourcePosition(token) {
  const position = pageSource.indexOf(token)
  assert.notEqual(position, -1, `Expected page source to contain ${token}`)
  return position
}

test('homepage is a complete single-page SaaS journey', () => {
  for (const id of ['product', 'how-it-works', 'use-cases', 'pricing', 'faq', 'contact']) {
    sourcePosition(`id="${id}"`)
  }

  const homeSource = pageSource.slice(sourcePosition('export default function Home()'))
  const order = [
    'id="analyser"',
    '<ProductSection />',
    '<HowItWorksSection />',
    '<UseCasesSection />',
    '<PricingSection />',
    '<FaqSection />',
    '<ContactSection />',
  ].map((token) => {
    const position = homeSource.indexOf(token)
    assert.notEqual(position, -1, `Expected Home composition to contain ${token}`)
    return position
  })
  assert.deepEqual(order, [...order].sort((a, b) => a - b))

  for (const href of ['#product', '#how-it-works', '#use-cases', '#pricing', '#faq']) {
    assert.match(pageSource, new RegExp(`href="${href}"`))
  }
})

test('free plan and API allow fifty analyses per day', () => {
  assert.match(pageSource, /Up to 50 analyses per day/)
  assert.match(pageSource, /Up to 50 free analyses per day/)
  assert.match(routeSource, /const DAILY_LIMIT = 50/)
  assert.match(routeSource, /today’s 50 free analyses/)
})

test('pricing uses the confirmed three tiers and a real enquiry path', () => {
  assert.match(pageSource, />Free</)
  assert.match(pageSource, />Starter</)
  assert.match(pageSource, />Pro</)
  assert.match(pageSource, /€29/)
  assert.match(pageSource, /€79/)
  assert.match(pageSource, /mailto:hello@artikle\.org\?subject=Nigi%20Starter/)
  assert.match(pageSource, /mailto:hello@artikle\.org\?subject=Nigi%20Pro/)
})

test('landing copy only claims capabilities that exist today', () => {
  for (const capability of ['Nigi location score', 'Market pulse', 'Nigi AI executive summary', 'PDF export']) {
    assert.match(pageSource, new RegExp(capability))
  }
  assert.doesNotMatch(pageSource, /saved projects|team workspace|API access|real-time footfall/i)
})

test('FAQ and legal trust content explain material product limits', () => {
  assert.match(pageSource, /How should I use the result\?/)
  assert.match(pageSource, /Does Nigi measure physical footfall\?/)
  assert.match(pageSource, /Does Nigi save my analysis history\?/)
  assert.match(pageSource, /decision-support estimate/i)
  assert.match(pageSource, /on-site and financial due diligence/i)
})
