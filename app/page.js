'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const examples = [
  'Would 18 rue de la République in Lyon work for a premium bakery?',
  'Is Place de la République in Paris promising for a coffee shop?',
  'Should I open a neighbourhood gym near Nice-Ville station?',
]

const progressSteps = [
  ['Understanding your project', 'Extracting the business, positioning and location'],
  ['Reading the local signals', 'Calling the AskLizy location and review data'],
  ['Calculating the KPIs', 'Applying the deterministic AskLizy scoring model'],
  ['Selecting grounded insights', 'OpenRouter classifies the brief and selects allowlisted evidence codes'],
]

const verdictCopy = {
  strong: 'Strong fit',
  promising: 'Promising',
  mixed: 'Mixed signals',
  weak: 'Weak fit',
}

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

function PinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></svg>
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

function ScoreRing({ score, verdict }) {
  const bounded = Math.max(0, Math.min(100, Number(score) || 0))
  const scoreColor = verdict === 'weak' ? '#c2414d' : verdict === 'mixed' ? '#b76e00' : verdict === 'strong' ? '#16875d' : '#315ef4'
  return (
    <div className="score-ring" style={{ '--score': bounded, '--score-color': scoreColor }} aria-label={`AskLizy score ${bounded} out of 100, ${verdictCopy[verdict] || verdict}`}>
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

function MapPanel({ location }) {
  const { lat, lng } = location.coordinates
  const delta = 0.012
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`
  return (
    <div className="map-panel">
      <iframe title={`Map of ${location.displayAddress}`} src={src} loading="eager" />
      <div className="map-caption">
        <PinIcon />
        <div><strong>{location.displayAddress}</strong><span>{lat.toFixed(5)}, {lng.toFixed(5)}</span></div>
      </div>
    </div>
  )
}

function EvidencePanel({ result }) {
  const metrics = result.metrics
  return (
    <aside className="evidence-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Evidence</p><h2>How Nigi reached this conclusion</h2></div>
        <span className="source-pill">AskLizy KPI engine</span>
      </div>
      <div className="metric-grid">
        <Metric label="Established nearby places" value={metrics.activePoiCount} note="≥50 reviews · within 1 km" />
        <Metric label="Average rating" value={`${Number(metrics.avgRating).toFixed(2)} ★`} note="Unweighted across matching places" />
        <Metric label="Activity index" value={`${Number(metrics.activityIndex).toFixed(1)}/100`} note={`${metrics.reviewsInWindow} sampled reviews · last 7 days`} />
        <Metric label="Review-provider coverage" value={metrics.requestedReviewSamples ? `${Number(metrics.reviewCoverage).toFixed(1)}%` : 'N/A'} note={metrics.requestedReviewSamples ? `${metrics.successfulReviewSamples} of ${metrics.requestedReviewSamples} samples returned` : 'No eligible places to sample'} />
      </div>
      <div className="method-row">
        <span><b>1 km</b> analysis radius</span>
        <span><b>{metrics.totalReviews.toLocaleString()}</b> total reviews</span>
        <span><b>{metrics.rawPoiCount}</b> raw places scanned</span>
      </div>
      <p className="method-disclaimer">{result.methodology.disclaimer}</p>
    </aside>
  )
}

function ResultView({ result, onReset }) {
  const report = result.report
  return (
    <main className="result-shell">
      <section className="result-hero">
        <div className="result-copy">
          <div className="result-meta">
            <span className={`verdict verdict-${result.verdict}`}>{verdictCopy[result.verdict] || result.verdict}</span>
            <span>Confidence: {report.confidence}</span>
          </div>
          <p className="eyebrow">Nigi’s assessment</p>
          <h1>{report.headline}</h1>
          <p className="result-summary">{report.summary}</p>
          <button className="secondary-button" type="button" onClick={onReset}>Analyse another location</button>
        </div>
        <ScoreRing score={result.score} verdict={result.verdict} />
      </section>

      <MapPanel location={result.location} />

      <section className="advice-grid">
        <article className="advice-card strengths-card">
          <div className="advice-title"><span>+</span><h2>Strengths</h2></div>
          <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card risks-card">
          <div className="advice-title"><span>!</span><h2>Risks</h2></div>
          <ul>{report.risks.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="advice-card next-card">
          <div className="advice-title"><span>→</span><h2>What to do next</h2></div>
          <ol>{report.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
      </section>

      <EvidencePanel result={result} />

      <section className="nearby-section">
        <div className="panel-heading"><div><p className="eyebrow">Local context</p><h2>Most active nearby places</h2></div></div>
        {result.topPlaces.length ? (
          <div className="place-list">
            {result.topPlaces.map((place, index) => (
              <article className="place-row" key={`${place.name}-${index}`}>
                <span className="place-index">{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{place.name}</strong><small>{place.distanceMeters} m away · {place.address}</small></div>
                <div className="place-stats"><b>{place.rating ?? '—'} ★</b><span>{place.reviewCount.toLocaleString()} reviews</span></div>
              </article>
            ))}
          </div>
        ) : <p className="empty-copy">No active matching places with at least 50 reviews were found within 1 km.</p>}
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
    const fullQuery = context ? `${context}\nAdditional detail: ${message}` : message
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
          <span className="engine-badge"><i />Powered by AskLizy</span>
          <a href="#method">Method</a>
        </div>
      </header>

      {!result && (
        <main className="home-shell">
          <section className="hero-copy">
            <div className="hero-badge"><SparkIcon />Natural-language location intelligence</div>
            <h1>Know where your<br /><em>business belongs.</em></h1>
            <p>Ask Nigi whether a commercial location fits your concept. Get a direct recommendation grounded in AskLizy’s deterministic KPIs—not an invented AI score.</p>
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
                <span>{usage ? `${usage.remaining} free analyses remaining today` : '5 free analyses per day · No signup'}</span>
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

          {!loading && (
            <section className="method-section" id="method">
              <div className="method-intro"><p className="eyebrow">Transparent by design</p><h2>AI classifies.<br />AskLizy calculates.</h2><p>Nigi separates language from evidence. OpenRouter classifies your brief and selects grounded, allowlisted insights; deterministic templates write the report, and the score comes from AskLizy’s fixed KPI model.</p></div>
              <div className="method-cards">
                <article><span>01</span><h3>Understand</h3><p>Nigi identifies the business, positioning, audience and exact location.</p></article>
                <article><span>02</span><h3>Measure</h3><p>AskLizy reads nearby active places, ratings, review depth and recent activity.</p></article>
                <article><span>03</span><h3>Explain</h3><p>OpenRouter selects grounded insight codes. Nigi’s fixed templates turn them into strengths, risks and next steps.</p></article>
              </div>
            </section>
          )}
        </main>
      )}

      {result && <ResultView result={result} onReset={reset} />}

      <footer>
        <Link className="brand footer-brand" href="/"><LogoMark /><span>Nigi</span></Link>
        <p>Location intelligence, explained. Powered by AskLizy KPIs and OpenRouter.</p>
        <span>Decision support only · Verify before you sign</span>
        <small>Your prompt is sent to OpenRouter; location and review queries are sent to the Maps Data provider. Result maps are loaded from OpenStreetMap. Nigi uses a signed usage cookie and a one-way hashed IP limiter, and does not require an account or save analysis history.</small>
      </footer>
    </div>
  )
}
