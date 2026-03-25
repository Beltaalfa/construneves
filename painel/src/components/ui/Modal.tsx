"use client";

import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

type Max = "sm" | "md" | "lg" | "xl";

const maxWidth: Record<Max, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthSize?: Max;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthSize = "md",
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth[maxWidthSize]} max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-10`}
      >
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-zinc-100"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
            aria-label="Fechar modal"
          >
            <IconX size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
