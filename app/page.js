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
          <div className="advice-title"><span>◎</span><h3>Market reality</h3></div>
          <ul>{synthesis.marketPatterns.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card">
          <div className="advice-title"><span>↗</span><h3>Competitors that matter</h3></div>
          <ul>{synthesis.competitorHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card">
          <div className="advice-title"><span>◇</span><h3>Where the opportunity is</h3></div>
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
          <p className="result-summary">{synthesis.summary}</p>
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

      <section className="method-row location-confirmation"><span><b>Location analysed:</b> {result.location.displayAddress}</span></section>
      <SignalPanel signals={signals} />
      <IntelligencePanel synthesis={synthesis} />

      <section className="advice-grid">
        <article className="advice-card next-card full-width-card">
          <div className="advice-title"><span>→</span><h2>Your next moves</h2></div>
          <ol>{result.recommendations.nextMoves.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
      </section>
    </main>
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
        <div className="topbar-actions">
          <span className="engine-badge"><i />Nigi signal live</span>
        </div>
      </header>

      {!result && (
        <main className="home-shell">
          <section className="hero-copy">
            <div className="hero-badge"><SparkIcon />Proprietary location intelligence</div>
            <h1>Know where your<br /><em>business belongs.</em></h1>
            <p>One question. A complete commercial synthesis of demand, footfall, competition, customer expectations and the opportunity your concept can own.</p>
          </section>

          <section className="prompt-card">
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
                <button type="submit" disabled={loading || query.trim().length < 8}>Analyse location <ArrowIcon /></button>
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

          {!loading && <section className="method-section"><div className="method-intro"><p className="eyebrow">From question to conviction</p><h2>A sharper read<br />of the street.</h2><p>Nigi turns a location and a business idea into a decision-ready commercial narrative—so you see the demand, the pressure and the opening before you commit.</p></div></section>}
        </main>
      )}

      {result && <ResultView result={result} onReset={reset} />}

      <footer>
        <Link className="brand footer-brand" href="/"><LogoMark /><span>Nigi</span></Link>
        <p>Commercial location intelligence, distilled into one clear decision.</p>
        <span>Decision support only · Verify before you sign</span>
        <small>Nigi does not require an account or save your analysis history. Usage protection is applied automatically. Estimates are decision-support indicators and should be confirmed through on-site and financial due diligence.</small>
      </footer>
    </div>
  )
}
