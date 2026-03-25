export function formatBRL(value: unknown): string {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatNumber(value: unknown, fractionDigits = 2): string {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatInt(value: unknown): string {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Fração 0–1 como percentual pt-BR (ex.: 0.0535 → 5,35%). */
export function formatPercentFrac(value: unknown, fractionDigits = 2): string {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return "—";
  return (n * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }) + "%";
}
