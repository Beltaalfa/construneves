import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  variant?: "default" | "accent" | "warn" | "danger";
  /** Se definido, o cartão vira botão (filtro). */
  onClick?: () => void;
  selected?: boolean;
};

const ring: Record<NonNullable<Props["variant"]>, string> = {
  default:
    "border-zinc-700/40 bg-zinc-950/50 backdrop-blur-sm shadow-sm shadow-black/10",
  accent:
    "border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 to-zinc-950/60 backdrop-blur-sm shadow-md shadow-cyan-950/20",
  warn:
    "border-amber-500/20 bg-gradient-to-br from-amber-950/25 to-zinc-950/60 backdrop-blur-sm",
  danger:
    "border-rose-500/20 bg-gradient-to-br from-rose-950/30 to-zinc-950/60 backdrop-blur-sm",
};

export function KpiCard({
  label,
  value,
  hint,
  variant = "default",
  onClick,
  selected,
}: Props) {
  const interactive = Boolean(onClick);
  const base =
    `rounded-2xl border p-5 min-h-[6rem] flex flex-col justify-center transition-all duration-200 ${ring[variant]} ` +
    (!interactive ? "hover:border-zinc-600/50 hover:shadow-lg hover:shadow-black/15 " : "") +
    (interactive
      ? "text-left w-full cursor-pointer transition-colors hover:bg-zinc-800/40 hover:border-zinc-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 "
      : "") +
    (selected ? " ring-2 ring-blue-500/70 border-blue-500/40 " : "");

  const inner = (
    <>
      <p className="text-sm font-semibold text-zinc-500 uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-semibold text-zinc-50 mt-2 tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? <p className="text-sm text-zinc-500 mt-1.5 leading-snug">{hint}</p> : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}
