import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './seo-scoped.css'

type SeoPageData = {
  slug?: string
  from?: string
  to?: string
  content?: string
  faqs?: Array<{ q: string; a: string }>
  internal_links?: Array<{ href: string; label: string }>
}

function slugifyCity(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function buildSlug(from: string, to: string) {
  return `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`
}

function parseSlug(slug: string) {
  const m = slug.match(/^flights-from-(.+)-to-(.+)$/)
  if (!m) return { from: 'New York', to: 'Miami' }
  return {
    from: m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    to: m[2].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}

function routeCode(from?: string, to?: string) {
  const a = String(from || '').trim().slice(0, 3).toUpperCase()
  const b = String(to || '').trim().slice(0, 3).toUpperCase()
  return `${a}-${b}`
}

async function trackEvent(event: string, data: Record<string, unknown> = {}) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    })
  } catch {
    // analytics failures should not break UX
  }
}

function SeoSchema({ from, to, slug, faqs = [] }: { from?: string; to?: string; slug?: string; faqs?: Array<{ q: string; a: string }> }) {
  const siteUrl = window.location.origin
  const pageUrl = slug ? `${siteUrl}/seo/flights/${slug}` : `${siteUrl}/seo`
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'TravelAction',
      fromLocation: { name: from },
      toLocation: { name: to },
    },
    slug
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'SEO', item: `${siteUrl}/seo` },
            { '@type': 'ListItem', position: 3, name: `${from} to ${to}`, item: pageUrl },
          ],
        }
      : null,
    faqs.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null,
  ].filter(Boolean)

  return (
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  )
}

function SeoHomePage() {
  const [from, setFrom] = useState('New York')
  const [to, setTo] = useState('Miami')
  const navigate = useNavigate()
  const slug = useMemo(() => buildSlug(from, to), [from, to])

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div className="pill">SwyftBooking • AI + ML + SEO</div>
            <h1 style={{ margin: '12px 0 6px', lineHeight: 1.1 }}>Find the best flights — and rank for it.</h1>
            <p className="muted" style={{ marginTop: 0, maxWidth: 680 }}>
              Real SEO module from original platform, now wired in one-platform.
            </p>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 18 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Search route</h2>
            <div className="inputRow">
              <div>
                <label>From</label>
                <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="New York" />
              </div>
              <div>
                <label>To</label>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Miami" />
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void trackEvent('SEARCH_INITIATED', { from, to })
                    navigate(`/seo/flights/${slug}`)
                  }}
                >
                  Search Flights
                </button>
              </div>
            </div>
            <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
              Generated slug: <code>{slug}</code>
            </p>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>What’s included</h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--seo-text)' }}>
              <li>SEO page content via `/api/seo/:slug`</li>
              <li>Pricing intel via `/api/pricing/:route`</li>
              <li>Prediction via `/api/predict/:route`</li>
              <li>Tracking via `/api/track`</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function SeoFlightPage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<SeoPageData | null>(null)
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null)
  const [price, setPrice] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function run() {
      setLoading(true)
      const baseData = parseSlug(slug)
      try {
        const seoRes = await fetch(`/api/seo/${encodeURIComponent(slug)}`)
        const seoData = seoRes.ok ? ((await seoRes.json()) as SeoPageData) : null
        const resolved = seoData && typeof seoData === 'object' ? seoData : { slug, ...baseData, content: `Compare flights from ${baseData.from} to ${baseData.to}.` }
        const code = routeCode(resolved.from, resolved.to)

        const [predRes, priceRes] = await Promise.all([
          fetch(`/api/predict/${encodeURIComponent(code)}`),
          fetch(`/api/pricing/${encodeURIComponent(code)}`),
        ])

        if (!alive) return
        setData(resolved)
        setPrediction(predRes.ok ? ((await predRes.json()) as Record<string, unknown>) : null)
        setPrice(priceRes.ok ? ((await priceRes.json()) as Record<string, unknown>) : null)
        void trackEvent('PAGE_VIEW', { slug: resolved.slug ?? slug, from: resolved.from, to: resolved.to })
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    if (!data) return
    document.title = `${data.from} → ${data.to} flights | SwyftBooking`
  }, [data])

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p className="muted">Loading route page…</p>
        </div>
      </div>
    )
  }

  const code = routeCode(data?.from, data?.to)
  const currentPrice = typeof price?.current_price === 'number' ? Number(price.current_price) : null

  return (
    <div className="container">
      <SeoSchema from={data?.from} to={data?.to} slug={data?.slug ?? slug} faqs={data?.faqs ?? []} />

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div className="pill">Route</div>
          <div className="pill">{code}</div>
          <div className="pill">Current price: {currentPrice != null ? `$${currentPrice}` : '—'}</div>
        </div>
        <h1 style={{ marginBottom: 6 }}>
          {data?.from} → {data?.to}
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          SEO + AI content + price intel + tracking.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7 }}>
          {data?.content ?? `Compare flights from ${data?.from} to ${data?.to}.`}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="btn" type="button" onClick={() => void trackEvent('BOOKING_STARTED', { route: code })}>
            Search Flights
          </button>
          <button className="btn" type="button" onClick={() => void trackEvent('PRICE_ALERT_CREATED', { route: code })}>
            Track Price
          </button>
          <Link className="btn" to="/seo">
            Back
          </Link>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Pricing prediction</h2>
          {prediction ? (
            <>
              <div className="pill">Trend: {String(prediction.trend ?? 'n/a')}</div>
              <p style={{ marginBottom: 0 }}>{String(prediction.recommendation ?? 'No recommendation available.')}</p>
            </>
          ) : (
            <p className="muted">Prediction temporarily unavailable.</p>
          )}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Urgency triggers</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--seo-text)' }}>
            <li>🔥 12 people booked this today</li>
            <li>⏳ Prices may increase soon</li>
            <li>⚠️ Only 3 seats left</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function SeoApp() {
  return (
    <div className="seo-app">
      <Routes>
        <Route index element={<SeoHomePage />} />
        <Route path="flights/:slug" element={<SeoFlightPage />} />
        <Route path="*" element={<Navigate to="/seo" replace />} />
      </Routes>
    </div>
  )
}

