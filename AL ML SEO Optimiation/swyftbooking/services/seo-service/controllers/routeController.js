import Route from "../models/Route.js";
import redis from "../../../packages/cache/redis.js";
import { getAIContent } from "../services/aiClient.js";

const SEO_TTL_SECONDS = Number(process.env.SEO_CACHE_TTL_SECONDS || 86400);

function fallbackContent(from, to) {
  return `Find the best deals on flights from ${from} to ${to}. Compare airlines, track price trends, and book at the right time with SwyftBooking.`;
}

function buildFaqs({ from, to }) {
  return [
    {
      q: `When is the best time to book flights from ${from} to ${to}?`,
      a: "In general, prices are lowest when you track for a few days and book once the trend starts rising. If prices are stable, set an alert and watch for dips.",
    },
    {
      q: `How do I find cheap flights from ${from} to ${to}?`,
      a: "Compare multiple departure times and airlines, be flexible by a day or two, and track the route over time so you can book during a dip.",
    },
    {
      q: `Does SwyftBooking update route data often?`,
      a: "Yes—route pages are generated dynamically and cached for performance. Pricing intel and predictions update regularly depending on the service TTL.",
    },
  ];
}

async function buildInternalLinks({ from, to, slug }) {
  const links = [];

  // Reverse route if it exists
  const reverseSlug = `flights-from-${String(to).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}-to-${String(from)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}`;

  if (reverseSlug !== slug) {
    const reverse = await Route.findOne({ slug: reverseSlug }).select("from to slug").lean();
    if (reverse) {
      links.push({ type: "reverse_route", label: `${reverse.from} → ${reverse.to}`, href: `/flights/${reverse.slug}` });
    }
  }

  // Related routes: same origin OR same destination
  const related = await Route.find({
    slug: { $ne: slug },
    $or: [{ from }, { to }],
  })
    .select("from to slug")
    .limit(6)
    .lean();

  for (const r of related) {
    links.push({ type: "related_route", label: `${r.from} → ${r.to}`, href: `/flights/${r.slug}` });
  }

  // Destination hotels page (even if not implemented yet, link structure is in the spec)
  links.push({
    type: "hotels",
    label: `Hotels in ${to}`,
    href: `/hotels-in-${String(to).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
  });

  return links;
}

export async function getRouteSEO(req, res) {
  const { slug } = req.params;

  try {
    const cached = await redis.get(`seo:${slug}`);
    if (cached) return res.json(JSON.parse(cached));

    const route = await Route.findOne({ slug }).lean();
    if (!route) return res.status(404).json({ error: "Not found" });

    let content = "";
    try {
      content = await getAIContent({ from: route.from, to: route.to, type: "flight" });
    } catch {
      content = fallbackContent(route.from, route.to);
    }

    const [internal_links, faqs] = await Promise.all([
      buildInternalLinks({ from: route.from, to: route.to, slug: route.slug }),
      Promise.resolve(buildFaqs({ from: route.from, to: route.to })),
    ]);

    const response = { ...route, content, faqs, internal_links };
    await redis.set(`seo:${slug}`, JSON.stringify(response), "EX", SEO_TTL_SECONDS);

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}

export async function listRoutes(req, res) {
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));
  const skip = Math.max(0, Number(req.query.skip || 0));

  try {
    const routes = await Route.find({})
      .select("slug updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      count: routes.length,
      skip,
      limit,
      routes: routes.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, createdAt: r.createdAt })),
    });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
}

