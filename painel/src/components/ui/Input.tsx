import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, id, className = "", ...rest }: Props) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-zinc-300 mb-1"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`w-full px-3 py-2 rounded-lg bg-zinc-900/50 border text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-blue-500 ${
          error
            ? "border-red-500/50 focus:ring-red-500/50"
            : "border-zinc-700 focus:ring-blue-500/50 focus:border-blue-500"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
