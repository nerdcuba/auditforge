import { SEVERITIES, type Severity } from "@/components/ui";

const SEV_COLOR: Record<Severity, string> = {
  critical: "var(--color-sev-critical)",
  high: "var(--color-sev-high)",
  medium: "var(--color-sev-medium)",
  low: "var(--color-sev-low)",
  info: "var(--color-sev-info)",
};
const SEV_LABEL: Record<Severity, string> = {
  critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Info",
};

// Dona de hallazgos abiertos por severidad. Pura SVG, accesible.
export function SeverityDonut({ counts }: { counts: { severity: Severity; count: number }[] }) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const segments = counts.filter((c) => c.count > 0);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 p-4">
      <svg
        viewBox="0 0 100 100"
        className="size-28 shrink-0 -rotate-90"
        role="img"
        aria-label={`${total} hallazgos abiertos por severidad`}
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="11" />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.count / total) * circumference;
            const dash = <circle
              key={s.severity}
              cx="50" cy="50" r={r} fill="none"
              stroke={SEV_COLOR[s.severity]} strokeWidth="11"
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
            />;
            offset += len;
            return dash;
          })}
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-semibold tabular-nums">{total}</p>
        <p className="mb-2 text-xs text-dim">hallazgos abiertos</p>
        <ul className="space-y-0.5">
          {SEVERITIES.map((sev) => {
            const count = counts.find((c) => c.severity === sev)?.count ?? 0;
            return (
              <li key={sev} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-[1px]" style={{ background: SEV_COLOR[sev] }} aria-hidden />
                <span className="w-14 text-dim">{SEV_LABEL[sev]}</span>
                <span className="font-mono tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Barras de actividad de escaneos por día.
export function ActivityBars({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="p-4">
      <div className="flex h-24 items-stretch gap-1" role="img" aria-label={`${total} escaneos en los últimos ${days.length} días`}>
        {days.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.count}`}>
            <div
              className="w-full rounded-t-[2px] bg-accent/70 transition-colors hover:bg-accent"
              style={{ height: `${d.count > 0 ? Math.max((d.count / max) * 100, 8) : 3}%`, opacity: d.count > 0 ? 1 : 0.3 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">
        <span>{days[0]?.label}</span>
        <span>{total} en {days.length} días</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}
