"use client";

import { Button } from "@/components/ui/Button";
import { downloadRowsAsXlsx } from "@/lib/export-xlsx";
import { useCallback, useState } from "react";

export function TableExportXlsxButton({
  rows,
  columnKeys,
  fileNameBase,
  disabled,
  label = "Exportar XLSX",
}: {
  rows: Record<string, unknown>[];
  columnKeys: string[];
  fileNameBase: string;
  disabled?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(() => {
    if (!rows.length || !columnKeys.length) return;
    setLoading(true);
    try {
      downloadRowsAsXlsx(rows, columnKeys, fileNameBase);
    } finally {
      setLoading(false);
    }
  }, [rows, columnKeys, fileNameBase]);

  return (
    <Button
      type="button"
      variant="secondary"
      className="px-3 py-1.5 text-xs"
      disabled={disabled || !rows.length || loading}
      loading={loading}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
