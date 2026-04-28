import "dotenv/config";

async function fetchJsonWithTimeout(url, { method = "GET", headers, body, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function getAIContent({ from, to, type = "flight" }) {
  const baseUrl = process.env.AI_SERVICE_URL || "http://localhost:5002";
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 5000);
  const res = await fetchJsonWithTimeout(
    `${baseUrl}/generate-content`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN || "" },
      body: JSON.stringify({ from, to, type }),
      timeoutMs,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI service error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.content || "";
}

