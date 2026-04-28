import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

export async function generateSEOContent({ from, to, type }) {
  if (!openai) {
    return `Discover ${type === "hotel" ? "hotels" : "flights"} from ${from} to ${to}. Track prices, plan smarter, and book with confidence on SwyftBooking.`;
  }

  // Phase-1 prompt templating (better variety than a static prompt).
  const seed = Math.random().toString(36).slice(2, 8);
  const prompt = [
    `You are writing SEO content for a travel site.`,
    `Route: ${from} to ${to}. Type: ${type}. Seed: ${seed}.`,
    "",
    "Write ONE paragraph (no headings, no bullet points).",
    "Constraints:",
    "- 90 to 140 words",
    "- Must naturally include the cities and 'SwyftBooking'",
    "- Include: 1 practical tip, 1 pricing insight, 1 booking recommendation",
    "- Avoid generic filler, avoid repeating phrases",
    "- Make it feel different from other pages (vary structure and wording)",
  ].join("\n");

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices?.[0]?.message?.content?.trim() || "";
}

