import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Health = { status: string; service?: string }
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

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [listingId, setListingId] = useState(defaultListing)
  const [guestId, setGuestId] = useState('guest-1')
  const [start, setStart] = useState('2026-05-01')
  const [end, setEnd] = useState('2026-05-05')
  const [submitting, setSubmitting] = useState(false)
  const [aiHint, setAiHint] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [h, b] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch(`/api/bookings/listing/${listingId}`).then((r) => r.json()),
      ])
      setHealth(h)
      setBookings(Array.isArray(b) ? b : [])
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
      </section>
    </div>
  )
}
