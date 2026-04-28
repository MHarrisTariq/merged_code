import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import CarApp from './modules/car/App'
import { AuthProvider as CarAuthProvider } from './modules/car/auth/AuthContext'
import './modules/car/index.css'
import AirbnbApp from './modules/airbnb/App'
import './modules/airbnb/styles.css'
import SeoApp from './modules/seo/SeoApp'

type Health = { status: string; service?: string }
type PlatformSummary = {
  id: string
  name: string
  status: string
  runtime?: string
}
type BookingRow = {
  _id: string
  listingId: string
  guestId: string
  startDate: string
  endDate: string
  status: string
  platform?: string
  price?: number
}

const defaultListing = 'listing-demo-1'

const navBtn = ({ isActive }: { isActive: boolean }) =>
  `module-nav${isActive ? ' active-module' : ''}`

function LayoutWithHeader() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>SwyftBooking</h1>
          <p className="tagline">Hybrid channel manager — deterministic core + AI</p>
        </div>
        <div className={`pill ${health?.status === 'ok' ? 'ok' : 'warn'}`}>
          API: {health?.status ?? '…'}
        </div>
      </header>
      <Outlet />
    </div>
  )
}

function ModuleNav() {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>Platform Modules</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <NavLink to="/booking" className={navBtn}>
          Booking
        </NavLink>
        <NavLink to="/car" className={navBtn}>
          Car Models
        </NavLink>
        <NavLink to="/airbnb" className={navBtn}>
          Airbnb
        </NavLink>
        <NavLink to="/seo" className={navBtn}>
          SEO
        </NavLink>
        <NavLink to="/subplan" className={navBtn}>
          Subscription Plan
        </NavLink>
      </div>
    </section>
  )
}

function BookingPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [listingId, setListingId] = useState(defaultListing)
  const [guestId, setGuestId] = useState('guest-1')
  const [start, setStart] = useState('2026-05-01')
  const [end, setEnd] = useState('2026-05-05')
  const [submitting, setSubmitting] = useState(false)
  const [aiHint, setAiHint] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([])
  const [platformDetail, setPlatformDetail] = useState<string>('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const b = await fetch(`/api/bookings/listing/${listingId}`).then((r) => r.json())
      setBookings(Array.isArray(b) ? b : [])
      const p = await fetch('/api/platforms').then((r) => r.json()).catch(() => null)
      setPlatforms(Array.isArray(p?.modules) ? p.modules : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const blockedRanges = useMemo(
    () =>
      bookings.map((b) => ({
        from: b.startDate,
        to: b.endDate,
        status: b.status,
      })),
    [bookings],
  )

  async function createBooking() {
    setSubmitting(true)
    setAiHint(null)
    setError(null)
    try {
      const idem = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          guestId,
          startDate: `${start}T00:00:00.000Z`,
          endDate: `${end}T00:00:00.000Z`,
          idempotencyKey: idem,
          platform: 'direct',
          price: 199,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof data === 'object' && data && 'message' in data
            ? JSON.stringify((data as { message: unknown }).message)
            : res.statusText
        setError(msg)
        if (res.status === 409) {
          setAiHint(
            'Deterministic + AI: availability or risk blocked this booking.',
          )
        }
        if (res.status === 429) {
          setAiHint(
            'AI layer: high risk — retry after backoff (adaptive sync may run).',
          )
        }
        return
      }
      setAiHint('Booking confirmed; Kafka events emitted; sync orchestrator queued.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadPlatformDetail(id: string) {
    const data = await fetch(`/api/platforms/${id}`).then((r) => r.json())
    setPlatformDetail(JSON.stringify(data, null, 2))
  }

  return (
    <>
      <ModuleNav />
      <section className="grid">
        <div className="card">
          <h2>Host dashboard</h2>
          <ul className="checks">
            <li>Calendar & booking status (deterministic)</li>
            <li>Sync status (Kafka → orchestrator)</li>
            <li>AI: suggested guardrails on create (risk / availability probability)</li>
          </ul>
          {error && <p className="err">{error}</p>}
          {aiHint && <p className="hint">{aiHint}</p>}
        </div>

        <div className="card">
          <h2>New booking</h2>
          <label>
            Listing
            <input
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
            />
          </label>
          <label>
            Guest
            <input value={guestId} onChange={(e) => setGuestId(e.target.value)} />
          </label>
          <label>
            Start
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            End
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button type="button" disabled={submitting} onClick={() => void createBooking()}>
            {submitting ? 'Working…' : 'Create booking'}
          </button>
        </div>

        <div className="card">
          <h2>Calendar (bookings)</h2>
          <p className="muted">Listing: {listingId}</p>
          {blockedRanges.length === 0 ? (
            <p className="muted">No bookings yet.</p>
          ) : (
            <ul className="bookings">
              {blockedRanges.map((r, i) => (
                <li key={i}>
                  {r.from} → {r.to}{' '}
                  <span className="badge">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Sync & AI</h2>
          <p>
            Priority: <strong>availability &gt; booking &gt; pricing</strong>
          </p>
          <p className="muted">
            Redis locks, idempotency keys, and Kafka topics back the deterministic
            layer; FastAPI services score risk and availability probability.
          </p>
          <button type="button" className="secondary" onClick={() => void load()}>
            Refresh data
          </button>
        </div>

        <div className="card">
          <h2>All platforms (one frontend + one backend)</h2>
          {platforms.length === 0 ? (
            <p className="muted">No module metadata loaded.</p>
          ) : (
            <ul className="bookings">
              {platforms.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> — {p.status}
                  <button
                    type="button"
                    className="secondary"
                    style={{ marginLeft: 8 }}
                    onClick={() => void loadPlatformDetail(p.id)}
                  >
                    Open detail
                  </button>
                </li>
              ))}
            </ul>
          )}
          {platformDetail && (
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {platformDetail}
            </pre>
          )}
        </div>
      </section>
    </>
  )
}

function AirbnbPage() {
  return (
    <>
      <ModuleNav />
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AirbnbApp />
      </section>
    </>
  )
}

function SeoPage() {
  return (
    <>
      <ModuleNav />
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <SeoApp />
      </section>
    </>
  )
}

function SubplanPage() {
  return (
    <>
      <ModuleNav />
      <section className="card">
        <h2>Subscription Plan Module</h2>
        <p className="muted">Subscription/ranking source is merged at <code>backend/src/modules/subplan_python</code>.</p>
        <a href="/api/platforms/subplan">Open subplan API detail</a>
      </section>
    </>
  )
}

function CarModule() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Link
        to="/booking"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 30,
          border: '1px solid rgba(148,163,184,.45)',
          background: 'rgba(255,255,255,.92)',
          color: '#0f172a',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          textDecoration: 'none',
          fontSize: 14,
        }}
      >
        Back to booking
      </Link>
      <CarAuthProvider>
        <CarApp />
      </CarAuthProvider>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/car/*" element={<CarModule />} />
      <Route path="/" element={<LayoutWithHeader />}>
        <Route index element={<Navigate to="/booking" replace />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="airbnb" element={<AirbnbPage />} />
        <Route path="seo/*" element={<SeoPage />} />
        <Route path="subplan" element={<SubplanPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/booking" replace />} />
    </Routes>
  )
}
