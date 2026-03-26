import { formatBRL, formatNumber } from "@/lib/format";

export function isDashboardNumericKey(key: string): boolean {
  const u = key.toUpperCase();
  return (
    u.includes("VLR") ||
    u.includes("VALOR") ||
    u.includes("SALDO") ||
    u.includes("QTD") ||
    u.includes("QUANT") ||
    u.includes("PREÇO") ||
    u.includes("PRECO") ||
    u.endsWith("_RS") ||
    u.includes("MARGEM") ||
    u.includes("PARTICIP") ||
    u.includes("CMV") ||
    u.includes("CUSTO") ||
    u.includes("CRESCIMENTO") ||
    u.includes("MARKUP") ||
    u.includes("ESTOQUE_EM_DIAS") ||
    u.includes("VENDA_DIA") ||
    u.includes("SUGESTAO_COMPRA") ||
    u.includes("ESTOQUE_IDEAL") ||
    u.includes("ESTOQUE_MEDIO") ||
    u.includes("ESTOQUE_MINIMO")
  );
}

export function formatDashboardCell(key: string, val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  const u = key.toUpperCase();
  if (
    u.includes("VLR") ||
    u.includes("VALOR") ||
    u.includes("SALDO") ||
    u.includes("DESCONTO") ||
    u.includes("TOTAL_LIQUIDO") ||
    u.includes("TOTAL_PAGTO") ||
    u.includes("CMV")
  )
    return formatBRL(val);
  if (
    (u.includes("PCT_") || u.includes("PCT_ACUM") || u.includes("PCT_DO")) &&
    typeof val === "number"
  )
    return `${formatNumber(val, 2)}%`;
  if (isDashboardNumericKey(key) && typeof val === "number")
    return formatNumber(val, 2);
  if (typeof val === "number") return formatNumber(val, 2);
  return String(val);
}
