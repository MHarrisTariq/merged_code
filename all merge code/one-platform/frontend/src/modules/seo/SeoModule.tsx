import { useMemo, useState } from 'react'

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

export default function SeoModule() {
  const [from, setFrom] = useState('New York')
  const [to, setTo] = useState('Miami')
  const slug = useMemo(() => buildSlug(from, to), [from, to])

  return (
    <section className="card">
      <h2>SEO Module</h2>
      <p className="muted">
        SEO source is merged from the original project. This screen exposes the core route-slug
        workflow inside one-platform.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label>
          From
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="New York" />
        </label>
        <label>
          To
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Miami" />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          Generated SEO slug:
        </p>
        <code>{slug}</code>
      </div>

      <ul className="checks" style={{ marginTop: 14 }}>
        <li>Original Next.js SEO pages are in <code>frontend/src/modules/seo/pages</code></li>
        <li>This merged screen is React/Vite-compatible</li>
        <li>Next step can be full parity port of dynamic SEO pages into React routes</li>
      </ul>
    </section>
  )
}

