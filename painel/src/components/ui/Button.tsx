import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-blue-600 hover:bg-blue-500 text-white border-transparent",
  secondary:
    "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700",
  ghost:
    "bg-transparent hover:bg-zinc-800/50 text-zinc-300 border-transparent",
  danger:
    "bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30",
} as const;

type Variant = keyof typeof variants;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  loading,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
