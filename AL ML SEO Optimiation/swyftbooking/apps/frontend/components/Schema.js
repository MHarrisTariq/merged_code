function safeUrlJoin(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

export default function Schema({ from, to, slug, faqs = [] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const pageUrl = slug ? safeUrlJoin(siteUrl, `flights/${slug}`) : siteUrl;

  const travelAction = {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    fromLocation: { name: from },
    toLocation: { name: to },
  };

  const breadcrumb = slug
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Flights",
            item: safeUrlJoin(siteUrl, ""),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${from} to ${to}`,
            item: pageUrl,
          },
        ],
      }
    : null;

  const faqSchema =
    faqs && faqs.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const schemas = [travelAction, breadcrumb, faqSchema].filter(Boolean);

  return (
    <>
      {schemas.map((s, i) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}

