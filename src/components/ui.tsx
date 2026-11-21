import type { ReactNode } from "react";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_STYLE: Record<Severity, { label: string; text: string; dot: string; bar: string }> = {
  critical: { label: "CRÍTICA", text: "text-sev-critical", dot: "bg-sev-critical", bar: "bg-sev-critical" },
  high: { label: "ALTA", text: "text-sev-high", dot: "bg-sev-high", bar: "bg-sev-high" },
  medium: { label: "MEDIA", text: "text-sev-medium", dot: "bg-sev-medium", bar: "bg-sev-medium" },
  low: { label: "BAJA", text: "text-sev-low", dot: "bg-sev-low", bar: "bg-sev-low" },
  info: { label: "INFO", text: "text-sev-info", dot: "bg-sev-info", bar: "bg-sev-info" },
};

export function SeverityPill({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${style.text}`}>
      <span className={`size-1.5 rounded-[1px] ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

// Barra de severidad proporcional al máximo de la vista — lectura de un vistazo.
export function SeverityBar({ severity, count, max }: { severity: Severity; count: number; max: number }) {
  const style = SEVERITY_STYLE[severity];
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-20 shrink-0"><SeverityPill severity={severity} /></div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${style.bar} transition-[width] duration-500`} style={{ width: `${count > 0 ? Math.max(pct, 6) : 0}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums">{count}</span>
    </div>
  );
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        {meta && <p className="shrink-0 font-mono text-xs text-dim">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-line px-3">
        <h2 className="text-xs font-medium tracking-wide text-dim uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({ label, value, accent = false, hint }: {
  label: string;
  value: number;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="group bg-surface px-3.5 py-3 transition-colors hover:bg-surface-2">
      <p className={`font-mono text-2xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-dim">{label}</p>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-dim/70">{hint}</p>}
    </div>
  );
}

const SCAN_STATUS_STYLE: Record<string, { label: string; className: string; live?: boolean }> = {
  queued: { label: "en cola", className: "text-dim" },
  running: { label: "en curso", className: "text-accent", live: true },
  done: { label: "terminado", className: "text-sev-low" },
  failed: { label: "fallido", className: "text-sev-critical" },
  cancelled: { label: "cancelado", className: "text-dim" },
};

export function ScanStatusBadge({ status }: { status: string }) {
  const style = SCAN_STATUS_STYLE[status] ?? { label: status, className: "text-dim" };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${style.className}`}>
      {style.live && <span className="size-1.5 rounded-full bg-accent" style={{ animation: "af-pulse-dot 1.4s ease-in-out infinite" }} aria-hidden />}
      {style.label}
    </span>
  );
}

const OWNERSHIP_STYLE = {
  verified: { label: "VERIFICADO", className: "border-accent/40 text-accent" },
  pending: { label: "PENDIENTE", className: "border-line text-dim" },
  expired: { label: "CADUCADO", className: "border-sev-medium/50 text-sev-medium" },
} as const;

export function OwnershipBadge({ status }: { status: keyof typeof OWNERSHIP_STYLE }) {
  const style = OWNERSHIP_STYLE[status];
  return (
    <span className={`inline-flex h-5 items-center rounded-[4px] border px-1.5 font-mono text-[10px] ${style.className}`}>
      {style.label}
    </span>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 max-w-prose text-dim">{detail}</p>
      </div>
      {action}
    </div>
  );
}
