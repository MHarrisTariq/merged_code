function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(text, size = 5) {
  const t = normalizeText(text);
  if (!t) return new Set();
  const tokens = t.split(" ");
  const set = new Set();
  for (let i = 0; i <= tokens.length - size; i += 1) {
    set.add(tokens.slice(i, i + size).join(" "));
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const small = a.size < b.size ? a : b;
  const big = a.size < b.size ? b : a;
  for (const x of small) if (big.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function uniquenessScore(candidate, previousTexts) {
  const cand = shingles(candidate, 5);
  let maxSim = 0;
  for (const prev of previousTexts) {
    const sim = jaccard(cand, shingles(prev, 5));
    if (sim > maxSim) maxSim = sim;
  }
  // 1.0 = totally unique vs previous, 0.0 = identical
  return Math.max(0, Math.min(1, 1 - maxSim));
}

