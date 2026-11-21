"use client";

import { Download, Printer } from "lucide-react";

export function ReportActions({ scanId }: { scanId: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-accent-ink hover:brightness-95"
      >
        <Printer size={13} aria-hidden /> Imprimir / PDF
      </button>
      <a
        href={`/app/reportes/${scanId}/md`}
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-xs text-fg hover:bg-surface-2"
      >
        <Download size={13} aria-hidden /> Markdown
      </a>
    </div>
  );
}
