import "dotenv/config";

const API_URL = process.env.API_URL || "http://localhost:5000";

function must(v, name) {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const route = process.argv[2] || "NYC-MIA";

async function main() {
  const pricingRes = await fetch(`${API_URL}/api/pricing/${encodeURIComponent(route)}`);
  if (!pricingRes.ok) throw new Error(`pricing failed: ${pricingRes.status}`);
  const pricing = await pricingRes.json();

  const ingestRes = await fetch(`${must(process.env.PRICING_SERVICE_URL, "PRICING_SERVICE_URL")}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      route: pricing.route,
      date_checked: new Date().toISOString(),
      price: pricing.current_price,
      currency: pricing.currency,
      source: "collector",
    }),
  });
  if (!ingestRes.ok) throw new Error(`ingest failed: ${ingestRes.status}`);
  const out = await ingestRes.json();
  // eslint-disable-next-line no-console
  console.log("OK", out);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

