import { useMemo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "../utils/tracking";

function slugifyCity(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function buildSlug(from, to) {
  return `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`;
}

export default function Home() {
  const [from, setFrom] = useState("New York");
  const [to, setTo] = useState("Miami");

  const slug = useMemo(() => buildSlug(from, to), [from, to]);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div className="pill">SwyftBooking • AI + ML + SEO</div>
          <h1 style={{ margin: "12px 0 6px", lineHeight: 1.1 }}>
            Find the best flights — and rank for it.
          </h1>
          <p className="muted" style={{ marginTop: 0, maxWidth: 680 }}>
            This demo matches your spec: SEO pages + AI content + price intel + tracking. Start by generating a route page.
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
            <div style={{ alignSelf: "end" }}>
              <Link
                className="btn"
                href={`/flights/${slug}`}
                onClick={() => trackEvent("SEARCH_INITIATED", { from, to })}
              >
                Search Flights
              </Link>
            </div>
          </div>
          <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
            Generated slug: <code>{slug}</code>
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>What’s included</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
            <li>SEO service (Mongo + Redis cache)</li>
            <li>AI content generation (OpenAI optional + Redis cache)</li>
            <li>Pricing & prediction services (stub ready for real APIs/models)</li>
            <li>Event tracking to analytics service</li>
          </ul>
          <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
            Tip: run <code>npm run seed:routes</code> once so SEO routes resolve from MongoDB.
          </p>
        </div>
      </div>
    </div>
  );
}

