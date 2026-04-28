export function predictTrend(prices) {
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const latest = prices[prices.length - 1];
  if (latest > avg * 1.03) return "rising";
  if (latest < avg * 0.97) return "dropping";
  return "stable";
}

export function recommendationFromTrend(trend) {
  if (trend === "rising") return "🔥 Prices likely to rise soon. Book before prices increase.";
  if (trend === "dropping") return "💰 Good time to book. Prices appear to be dropping.";
  return "⏳ Wait or watch. Prices look stable right now.";
}

