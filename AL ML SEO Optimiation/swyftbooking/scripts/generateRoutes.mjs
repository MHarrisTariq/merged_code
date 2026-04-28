const cities = ["New York", "Miami", "Los Angeles", "Chicago", "Toronto"];

function slugifyCity(s) {
  return String(s).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const routes = [];
for (const from of cities) {
  for (const to of cities) {
    if (from === to) continue;
    routes.push({
      from,
      to,
      slug: `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`,
    });
  }
}

console.log(JSON.stringify(routes, null, 2));

