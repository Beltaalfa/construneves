/** Tema visual comum aos gráficos do painel (dark, harmonia cyan/teal/sky). */

export const VIZ = {
  grid: "rgba(63, 63, 70, 0.45)",
  axis: "#a1a1aa",
  axisMuted: "#71717a",
  tooltip: {
    bg: "rgba(9, 9, 11, 0.92)",
    border: "rgba(63, 63, 70, 0.85)",
    color: "#fafafa",
  },
  /** Séries temporais — três tons distintos e complementares */
  series: {
    monetary: { stroke: "#22d3ee", fill: "#22d3ee" },
    percent: { stroke: "#a78bfa", fill: "#a78bfa" },
    days: { stroke: "#34d399", fill: "#34d399" },
  },
} as const;

export const AGING_BAR_COLORS: Record<string, string> = {
  "A vencer": "#14b8a6",
  "1 a 7 dias": "#06b6d4",
  "8 a 15 dias": "#0ea5e9",
  "16 a 30 dias": "#3b82f6",
  "31 a 60 dias": "#8b5cf6",
  "61 a 90 dias": "#d946ef",
  "Acima de 90 dias": "#f43f5e",
};

export function agingBarColor(name: string): string {
  return AGING_BAR_COLORS[name] ?? "#64748b";
}
