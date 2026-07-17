'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { exportVisualPdf } from '../lib/pdf-export.mjs'

const examples = [
  'Would 18 rue de la République in Lyon work for a premium bakery?',
  'Is Place de la République in Paris promising for a coffee shop?',
  'Should I open a neighbourhood gym near Nice-Ville station?',
]

const progressSteps = [
  ['Understanding your project', 'Interpreting the concept, positioning and target customer'],
  ['Mapping local dynamics', 'Reading the commercial environment around the location'],
  ['Testing market fit', 'Challenging the concept against local demand and competition'],
  ['Building your synthesis', 'Prioritising the signals that matter to the decision'],
]

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="img">
        <path d="M7 24V9l9 10V8l9 15" />
        <circle cx="7" cy="24" r="2" />
        <circle cx="25" cy="23" r="2" />
      </svg>
    </span>
  )
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg>
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></svg>
}

function PdfIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2.5h5l3 3V17.5H6z" /><path d="M11 2.5v3h3M8 10h4M8 13h4" /></svg>
}

function Metric({ label, value, note }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}

function ScoreRing({ score }) {
  const bounded = Math.max(0, Math.min(100, Number(score) || 0))
  const scoreColor = bounded >= 80 ? '#16875d' : bounded >= 60 ? '#315ef4' : bounded >= 40 ? '#b76e00' : '#c2414d'
  return (
    <div className="score-ring" style={{ '--score': bounded, '--score-color': scoreColor }} aria-label={`Nigi location potential ${bounded} out of 100`}>
      <div><strong>{bounded}</strong><span>/100</span></div>
    </div>
  )
}

function AnalysisProgress({ stage }) {
  return (
    <section className="analysis-progress" aria-live="polite">
      <div className="thinking-orbit"><LogoMark /></div>
      <p className="eyebrow">Nigi is analysing</p>
      <h2>{progressSteps[stage]?.[0] || progressSteps[0][0]}</h2>
      <p>{progressSteps[stage]?.[1]}</p>
      <div className="progress-track"><span style={{ width: `${((stage + 1) / progressSteps.length) * 100}%` }} /></div>
      <div className="progress-list">
        {progressSteps.map(([title], index) => (
          <span key={title} className={index < stage ? 'done' : index === stage ? 'active' : ''}>
            <i>{index < stage ? '✓' : index + 1}</i>{title}
          </span>
        ))}
      </div>
    </section>
  )
}

function SignalPanel({ signals }) {
  return (
    <section className="evidence-panel signal-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Market pulse</p><h2>The numbers that shape the decision</h2></div>
        <span className="source-pill">Nigi proprietary signals</span>
      </div>
      <div className="metric-grid">
        <Metric label="Estimated daily footfall" value={`≈ ${Number(signals.estimatedDailyFootfall || 0).toLocaleString()}`} note="Potential visitors per day" />
        <Metric label="Competitive intensity" value={signals.competitiveIntensity} note="Pressure from established operators" />
        <Metric label="Demand momentum" value={signals.demandMomentum} note="Current commercial energy" />
        <Metric label="Customer reputation" value={signals.customerReputation === null ? 'Limited signal' : `${Number(signals.customerReputation).toFixed(2)} ★`} note="Local experience benchmark" />
      </div>
      <p className="method-disclaimer">Footfall is a proprietary Nigi estimate, not a physical pedestrian count or sales forecast.</p>
    </section>
  )
}

function IntelligencePanel({ synthesis }) {
  return (
    <section className="evidence-panel places-intelligence">
      <div className="panel-heading">
        <div><p className="eyebrow">Nigi intelligence</p><h2>{synthesis.headline}</h2></div>
        <span className="source-pill">Commercial synthesis</span>
      </div>
      <p className="result-summary">{synthesis.summary}</p>
      <div className="advice-grid">
        <article className="advice-card">
          <div className="advice-title"><span className="material-symbols-rounded" aria-hidden="true">monitoring</span><h3>Market reality</h3></div>
          <ul>{synthesis.marketPatterns.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card">
          <div className="advice-title"><span className="material-symbols-rounded" aria-hidden="true">storefront</span><h3>Competitors that matter</h3></div>
          <ul>{synthesis.competitorHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card">
          <div className="advice-title"><span className="material-symbols-rounded" aria-hidden="true">lightbulb</span><h3>Where the opportunity is</h3></div>
          <ul>{synthesis.opportunities.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
      {synthesis.reviewThemes.length > 0 && (
        <section className="customer-themes">
          <div className="customer-themes-heading">
            <p className="eyebrow">Customer decision drivers</p>
            <h3>What customers care about most</h3>
            <p>These themes can shape preference, loyalty and word of mouth in this market.</p>
          </div>
          <div className="theme-grid">
            {synthesis.reviewThemes.map((theme, index) => (
              <article className="theme-card" key={theme.label}>
                <span className="theme-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{theme.label}</h4>
                  <div className="theme-businesses">
                    {theme.businesses.map((business) => <span key={business}>{business}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}

function ResultView({ result, onReset }) {
  const synthesis = result.synthesis
  const signals = result.signals
  return (
    <main className="result-shell pdf-report">
      <section className="result-hero">
        <div className="result-copy">
          <div className="result-meta">
            <span className="verdict">Nigi intelligence</span>
            <span>{signals.commercialOutlook} commercial outlook</span>
          </div>
          <p className="eyebrow">Your location synthesis</p>
          <h1>{synthesis.headline}</h1>
          <div className="result-actions no-print">
            <button className="secondary-button" type="button" onClick={onReset}>Analyse another location</button>
            <button
              className="secondary-button export-button"
              type="button"
              onClick={() => exportVisualPdf({ locationLabel: result.location.displayAddress })}
            >
              <PdfIcon />Export PDF
            </button>
          </div>
        </div>
        <div><ScoreRing score={signals.locationPotential} /><p className="eyebrow">Location potential</p></div>
      </section>

      {synthesis.executiveSummary && (
        <section className="executive-summary">
          <div className="executive-summary-label">
            <span className="ai-pulse" aria-hidden="true" />
            <span>Nigi AI analysis</span>
          </div>
          <h2>Executive summary</h2>
          <p>{synthesis.executiveSummary}</p>
        </section>
      )}

      <section className="method-row location-confirmation"><span><b>Location analysed:</b> {result.location.displayAddress}</span></section>
      <SignalPanel signals={signals} />
      <IntelligencePanel synthesis={synthesis} />

      <section className="advice-grid">
        <article className="advice-card next-card full-width-card">
          <div className="advice-title"><span className="material-symbols-rounded" aria-hidden="true">route</span><h2>Your next moves</h2></div>
          <ol>{result.recommendations.nextMoves.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
      </section>
    </main>
  )
}

function MarketingIcon({ name }) {
  return <span className="material-symbols-rounded" aria-hidden="true">{name}</span>
}

function ProductSection() {
  return (
    <section className="landing-section product-section" id="product">
      <div className="section-heading">
        <div><p className="eyebrow">One report. One decision.</p><h2>See the street before you commit to it.</h2></div>
        <p>Nigi turns a business concept and an address into a focused commercial report you can read, share and act on.</p>
      </div>
      <div className="product-layout">
        <div className="capability-grid">
          {[
            ['speed', 'Nigi location score', 'A clear 0–100 signal that frames the overall commercial outlook.'],
            ['query_stats', 'Market pulse', 'Estimated footfall, competitive intensity, demand momentum and reputation.'],
            ['auto_awesome', 'Nigi AI executive summary', 'A decision-ready interpretation of fit, opportunity, risk and what to validate next.'],
            ['picture_as_pdf', 'PDF export', 'Turn the full analysis into a polished report for your partners or decision file.'],
          ].map(([icon, title, copy]) => (
            <article className="capability-card" key={title}><MarketingIcon name={icon} /><div><h3>{title}</h3><p>{copy}</p></div></article>
          ))}
        </div>
        <div className="report-preview" aria-label="Illustrative Nigi report preview">
          <div className="preview-topline"><span>Example report</span><span>Commercial outlook</span></div>
          <div className="preview-score"><div><strong>81</strong><span>/100</span></div><p>Strong location potential</p></div>
          <div className="preview-metrics">
            <div><span>Demand</span><strong>Strong</strong></div>
            <div><span>Competition</span><strong>Very high</strong></div>
            <div><span>Reputation</span><strong>4.53 ★</strong></div>
          </div>
          <div className="preview-summary"><span><MarketingIcon name="auto_awesome" />Nigi AI analysis</span><p>A high-opportunity market where differentiation, service and a clear reason to choose you will decide the outcome.</p></div>
          <small>Illustrative report structure. Every result depends on the concept and location analysed.</small>
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section className="landing-section how-section" id="how-it-works">
      <div className="section-heading compact-heading"><div><p className="eyebrow">How it works</p><h2>From an address to an informed next move.</h2></div></div>
      <div className="steps-grid">
        {[
          ['01', 'Describe the project', 'Give Nigi the business concept, positioning and exact location you are considering.'],
          ['02', 'Read the local market', 'Nigi assesses demand momentum, commercial pressure, customer expectations and nearby alternatives.'],
          ['03', 'Make the decision clearer', 'Receive the score, executive summary, opportunities, risks, competitors and practical next moves.'],
        ].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
    </section>
  )
}

function UseCasesSection() {
  return (
    <section className="landing-section use-cases-section" id="use-cases">
      <div className="section-heading">
        <div><p className="eyebrow">Built for real location decisions</p><h2>Useful before the lease, launch or expansion.</h2></div>
        <p>Use Nigi to challenge assumptions before time, capital and reputation are committed to a site.</p>
      </div>
      <div className="use-case-grid">
        {[
          ['storefront', 'Independent operators', 'Test whether a first or next site fits the concept and its target customer.'],
          ['restaurant', 'Retail & hospitality', 'Understand demand, saturation and the customer experience bar around an address.'],
          ['fitness_center', 'Fitness & wellness', 'Read nearby alternatives, reputation signals and openings for differentiation.'],
          ['real_estate_agent', 'Commercial property', 'Frame which concepts may suit a location before deeper tenant or investment work.'],
          ['hub', 'Franchise teams', 'Create a consistent first commercial screen for candidate territories and addresses.'],
          ['strategy', 'Advisors & consultants', 'Add a clear location synthesis and PDF report to early-stage client decisions.'],
        ].map(([icon, title, copy]) => <article key={title}><MarketingIcon name={icon} /><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <section className="landing-section pricing-section" id="pricing">
      <div className="section-heading pricing-heading">
        <div><p className="eyebrow">Simple pricing</p><h2>Start free. Add support when the decisions repeat.</h2></div>
        <p>The analyzer is available immediately. Starter and Pro are activated directly with the Nigi team, with scope confirmed before billing.</p>
      </div>
      <div className="pricing-grid">
        <article className="pricing-card">
          <div><span className="plan-name">Free</span><p>Explore individual opportunities.</p></div>
          <div className="price"><strong>€0</strong><span>forever</span></div>
          <ul><li>Up to 20 analyses per day</li><li>Nigi location score</li><li>Market pulse and commercial synthesis</li><li>Nigi AI executive summary</li><li>PDF export</li></ul>
          <a className="plan-cta secondary-plan-cta" href="#analyser">Analyse a location</a>
        </article>
        <article className="pricing-card featured-plan">
          <span className="popular-badge">Most popular</span>
          <div><span className="plan-name">Starter</span><p>For operators using Nigi in recurring decisions.</p></div>
          <div className="price"><strong>€29</strong><span>/ month</span></div>
          <ul><li>Everything available in Free</li><li>Commercial use for an individual operator</li><li>Direct plan onboarding by email</li><li>Priority email assistance</li><li>Scope confirmed before activation</li></ul>
          <a className="plan-cta" href="mailto:hello@artikle.org?subject=Nigi%20Starter">Request Starter</a>
        </article>
        <article className="pricing-card">
          <div><span className="plan-name">Pro</span><p>For teams and advisors with higher-intent location work.</p></div>
          <div className="price"><strong>€79</strong><span>/ month</span></div>
          <ul><li>Everything available in Starter</li><li>Commercial use across a small team</li><li>Direct onboarding with the Nigi team</li><li>Priority assistance for recurring work</li><li>Scope confirmed before activation</li></ul>
          <a className="plan-cta secondary-plan-cta" href="mailto:hello@artikle.org?subject=Nigi%20Pro">Request Pro</a>
        </article>
      </div>
      <p className="pricing-note">No payment is taken on this website. Starter and Pro requests are reviewed and confirmed by email before any subscription begins.</p>
    </section>
  )
}

function FaqSection() {
  const faqs = [
    ['What does a Nigi analysis include?', 'A Nigi location score, market pulse, Nigi AI executive summary, local commercial synthesis, relevant competitors, customer decision themes, opportunities, next moves and PDF export.'],
    ['How should I use the result?', 'Use it as an early decision-support layer. Nigi helps you identify what looks promising, risky or worth validating, but it does not replace on-site and financial due diligence.'],
    ['Does Nigi measure physical footfall?', 'No. Footfall is a proprietary decision-support estimate, not a physical pedestrian count or a sales forecast. Confirm the location through site visits and appropriate professional studies.'],
    ['Does Nigi save my analysis history?', 'Nigi does not require an account and does not create a saved analysis history. Your request is processed to produce the report and to protect service usage.'],
    ['Can I export the analysis?', 'Yes. Every completed analysis includes a visual PDF export designed to preserve the complete report.'],
    ['How do Starter and Pro work?', 'Choose the relevant plan and email the Nigi team. The intended use, support scope and activation are confirmed before any subscription begins.'],
  ]
  return (
    <section className="landing-section faq-section" id="faq">
      <div className="section-heading"><div><p className="eyebrow">Frequently asked questions</p><h2>What to know before you decide.</h2></div><p>Clear limits matter when a product informs a commercial location decision.</p></div>
      <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<MarketingIcon name="add" /></summary><p>{answer}</p></details>)}</div>
    </section>
  )
}

function ContactSection() {
  return (
    <section className="landing-section final-cta" id="contact">
      <div><p className="eyebrow">Make the next address easier to judge</p><h2>Bring the location.<br />Nigi will sharpen the decision.</h2><p>Run a free analysis now, or contact the Nigi team for recurring professional use.</p></div>
      <div className="final-cta-actions"><a className="primary-link" href="#analyser">Analyse a location</a><a className="text-link" href="mailto:hello@artikle.org?subject=Nigi%20enquiry">Contact Nigi <ArrowIcon /></a></div>
    </section>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState(null)
  const [clarification, setClarification] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState(0)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (!loading) return undefined
    setStage(0)
    const timer = window.setInterval(() => setStage((value) => Math.min(3, value + 1)), 2300)
    return () => window.clearInterval(timer)
  }, [loading])

  const promptLabel = useMemo(() => clarification || 'Describe your business and the location you are considering.', [clarification])

  async function submit(event) {
    event.preventDefault()
    const message = query.trim()
    if (!message || loading) return
    const fullQuery = context
      ? `Additional detail: ${message.slice(0, 1000)}\nOriginal request: ${context.slice(0, 900)}`
      : message
    setLoading(true)
    setError('')
    setClarification('')
    setResult(null)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: fullQuery }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Nigi could not complete the analysis.')
      if (data.type === 'clarification') {
        setContext(fullQuery)
        setClarification(data.message)
        setQuery('')
        return
      }
      setResult(data)
      setUsage(data.usage || null)
      setContext('')
      setQuery('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nigi could not complete the analysis.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setClarification('')
    setContext('')
    setError('')
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="site-frame">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Nigi home"><LogoMark /><span>Nigi</span></Link>
        {!result ? (
          <div className="topbar-actions">
            <nav className="desktop-nav" aria-label="Primary navigation">
              <a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#use-cases">Use cases</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
            </nav>
            <a className="topbar-cta" href="#analyser">Analyse a location</a>
          </div>
        ) : <div className="topbar-actions"><span className="engine-badge"><i />Nigi signal live</span></div>}
      </header>

      {!result && (
        <main className="home-shell">
          <section className="hero-copy">
            <div className="hero-badge"><SparkIcon />Proprietary location intelligence</div>
            <h1>Know where your<br /><em>business belongs.</em></h1>
            <p>Assess demand, estimated footfall, competition, customer expectations and commercial opportunity for a location—before you commit.</p>
            <div className="hero-actions"><a className="primary-link" href="#analyser">Analyse a location</a><a className="text-link" href="#product">See what you receive <ArrowIcon /></a></div>
          </section>

          <section className="prompt-card" id="analyser">
            <div className="prompt-heading">
              <div><span className="prompt-icon"><SparkIcon /></span><div><strong>Ask anything about a location</strong><small>{promptLabel}</small></div></div>
              <span className="free-pill">No account required</span>
            </div>
            <form onSubmit={submit}>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={clarification ? 'Add the missing detail…' : 'e.g. Would 18 rue de la République in Lyon work for a premium bakery?'}
                rows={4}
                maxLength={2000}
                aria-label="Your location question"
                autoFocus
              />
              <div className="prompt-footer">
                <span>{usage ? `${usage.remaining} free analyses remaining today` : 'Up to 20 free analyses per day · No signup'}</span>
                <button type="submit" disabled={loading || query.trim().length < 8}>Analyse a location <ArrowIcon /></button>
              </div>
            </form>
          </section>

          {error && <div className="error-banner" role="alert">{error}</div>}

          {!clarification && !loading && (
            <section className="example-row" aria-label="Example questions">
              <span>Try asking</span>
              <div>{examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}<ArrowIcon /></button>)}</div>
            </section>
          )}

          {loading && <AnalysisProgress stage={stage} />}

          {!loading && (
            <>
              <section className="trust-strip" aria-label="Nigi product facts">
                <div><MarketingIcon name="bolt" /><span><strong>Immediate</strong> analysis flow</span></div>
                <div><MarketingIcon name="lock" /><span><strong>No account</strong> required</span></div>
                <div><MarketingIcon name="description" /><span><strong>Complete</strong> report and PDF</span></div>
                <div><MarketingIcon name="verified" /><span><strong>Clear</strong> decision-support limits</span></div>
              </section>
              <ProductSection />
              <HowItWorksSection />
              <UseCasesSection />
              <PricingSection />
              <FaqSection />
              <ContactSection />
            </>
          )}
        </main>
      )}

      {result && <ResultView result={result} onReset={reset} />}

      <footer>
        <div className="footer-main">
          <div className="footer-about"><Link className="brand footer-brand" href="/"><LogoMark /><span>Nigi</span></Link><p>Commercial location intelligence, distilled into one clear decision.</p></div>
          <div className="footer-links"><strong>Product</strong><a href="#product">What you receive</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></div>
          <div className="footer-links"><strong>Decisions</strong><a href="#use-cases">Use cases</a><a href="#faq">FAQ</a><a href="#analyser">Analyse a location</a></div>
          <div className="footer-links"><strong>Contact & legal</strong><a href="mailto:hello@artikle.org?subject=Nigi%20enquiry">Contact Nigi</a><a href="#faq">Privacy & data use</a><span>Decision support only</span></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Nigi</span><small>Nigi does not require an account or save your analysis history. Estimates are decision-support indicators and should be confirmed through on-site and financial due diligence before you sign.</small></div>
      </footer>
    </div>
  )
}
