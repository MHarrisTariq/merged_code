export const formatCurrency = (value: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
