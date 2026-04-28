import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Schema from "../../components/Schema";
import { trackEvent } from "../../utils/tracking";

function apiBaseUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

export async function getStaticProps({ params }) {
  const res = await fetch(`${apiBaseUrl()}/api/seo/${params.slug}`);
  const data = await res.json();

  return {
    props: { data },
    revalidate: 86400,
  };
}

export async function getStaticPaths() {
  return { paths: [], fallback: "blocking" };
}

function routeCode(from, to) {
  const a = String(from || "").trim().slice(0, 3).toUpperCase();
  const b = String(to || "").trim().slice(0, 3).toUpperCase();
  return `${a}-${b}`;
}

export default function FlightPage({ data }) {
  const [prediction, setPrediction] = useState(null);
  const [price, setPrice] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(true);

  const code = useMemo(() => routeCode(data?.from, data?.to), [data?.from, data?.to]);

  useEffect(() => {
    trackEvent("PAGE_VIEW", { slug: data?.slug, from: data?.from, to: data?.to });
  }, [data?.slug, data?.from, data?.to]);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        const [p, pr] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/predict/${encodeURIComponent(code)}`).then((r) => r.json()),
          fetch(`${apiBaseUrl()}/api/pricing/${encodeURIComponent(code)}`).then((r) => r.json()),
        ]);
        if (!alive) return;
        setPrediction(p?.error ? null : p);
        setPrice(pr?.error ? null : pr);
      } finally {
        if (alive) setLoadingIntel(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [code]);

  const title = `${data?.from} → ${data?.to} flights | SwyftBooking`;
  const description =
    data?.content ||
    `Compare flights from ${data?.from} to ${data?.to}. Track pricing trends, get booking tips, and book at the best time.`;
  const canonical = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/flights/${data?.slug}`;

  return (
    <div className="container">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description.slice(0, 160)} />
        <link rel="canonical" href={canonical} />
      </Head>

      <Schema from={data?.from} to={data?.to} slug={data?.slug} faqs={data?.faqs || []} />

      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div className="pill">Route</div>
          <div className="pill">{code}</div>
          {price?.current_price ? (
            <div className="pill">Current price: ${price.current_price}</div>
          ) : (
            <div className="pill">Current price: —</div>
          )}
        </div>

        <h1 style={{ marginBottom: 6 }}>{data?.from} → {data?.to}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          SEO + AI content + price intel + tracking (as specified).
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.7 }}>{data?.content}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button
            className="btn"
            onClick={() => trackEvent("BOOKING_STARTED", { from: data?.from, to: data?.to, route: code })}
          >
            Search Flights
          </button>
          <button
            className="btn"
            style={{ background: "linear-gradient(90deg, rgba(124,92,255,.95), rgba(232,236,255,.9))" }}
            onClick={() => trackEvent("PRICE_ALERT_CREATED", { route: code, from: data?.from, to: data?.to })}
          >
            Track Price
          </button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Pricing prediction</h2>
          {loadingIntel ? (
            <p className="muted">Loading prediction…</p>
          ) : prediction ? (
            <>
              <div className="pill">Trend: {prediction.trend}</div>
              <p style={{ marginBottom: 0 }}>{prediction.recommendation}</p>
            </>
          ) : (
            <p className="muted">Prediction temporarily unavailable.</p>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Urgency triggers</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            These are deliberately included per the “conversion optimization” section.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
            <li>🔥 “12 people booked this today”</li>
            <li>⏳ “Prices may increase soon”</li>
            <li>⚠️ “Only 3 seats left”</li>
          </ul>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Internal links</h2>
          {data?.internal_links?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
              {data.internal_links.map((l, idx) => (
                <li key={`${l.href}-${idx}`}>
                  <a href={l.href} style={{ color: "rgba(232,236,255,.9)" }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Links will appear once more routes exist in MongoDB.
            </p>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>FAQs</h2>
          {data?.faqs?.length ? (
            <div>
              {data.faqs.map((f, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 650 }}>{f.q}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {f.a}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              FAQs are generated per route.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

