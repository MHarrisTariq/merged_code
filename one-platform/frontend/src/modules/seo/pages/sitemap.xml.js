function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBaseUrl() {
  // On the server we can use API_URL (docker) or NEXT_PUBLIC_API_URL (local)
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function getServerSideProps({ res }) {
  let slugs = [];
  try {
    const r = await fetch(`${apiBaseUrl()}/api/seo/routes?limit=5000`);
    const data = await r.json();
    slugs = Array.isArray(data?.routes) ? data.routes.map((x) => x.slug).filter(Boolean) : [];
  } catch {
    slugs = [];
  }

  const urls = [
    { loc: `${siteUrl()}/`, changefreq: "daily", priority: "1.0" },
    ...slugs.map((slug) => ({
      loc: `${siteUrl()}/flights/${slug}`,
      changefreq: "daily",
      priority: "0.8",
    })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${xmlEscape(u.loc)}</loc>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Sitemap() {
  return null;
}

