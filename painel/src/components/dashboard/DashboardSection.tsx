import type { ReactNode } from "react";

export function DashboardSection({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-5 ${className}`}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="space-y-1 min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-500/90">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-zinc-500 max-w-full sm:max-w-3xl leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
