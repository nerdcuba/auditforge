import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, SEVERITIES, SeverityPill, type Severity } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { FINDING_STATUSES, type FindingStatus } from "./constants";
import { StatusSelect } from "./status-select";

export const metadata: Metadata = { title: "Hallazgos" };

type Finding = {
  id: string; title: string; severity: Severity; category: string | null; cwe: string | null;
  location: string | null; description: string | null; remediation: string | null;
  status: FindingStatus; last_seen: string;
  assets: { value: string; label: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "UTC" });
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_LABEL: Record<Severity, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Info" };
const STATUS_SHORT: Record<FindingStatus, string> = {
  open: "Abierto", triaged: "En revisión", fixed: "Corregido", accepted: "Aceptado", false_positive: "Falso positivo",
};

function Chips({ active, base, options }: { active: string; base: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const href = o.value ? `${base}${base.includes("?") ? "&" : "?"}${o.value}` : base.split("?")[0] || "/app/hallazgos";
        return (
          <Link
            key={o.label}
            href={href}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active === o.value ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-dim hover:text-fg"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function FindingsPage({ searchParams }: { searchParams: Promise<{ sev?: string; estado?: string }> }) {
  const { sev, estado } = await searchParams;
  const severity = SEVERITIES.includes(sev as Severity) ? (sev as Severity) : null;
  const status = FINDING_STATUSES.includes(estado as FindingStatus) ? (estado as FindingStatus) : null;

  const supabase = await createClient();
  let query = supabase
    .from("findings")
    .select("id, title, severity, category, cwe, location, description, remediation, status, last_seen, assets(value, label)");
  if (severity) query = query.eq("severity", severity);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(300).returns<Finding[]>();
  if (error) console.error("hallazgos: error de consulta", error.code);

  const findings = (data ?? []).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.last_seen.localeCompare(a.last_seen),
  );

  // Preserva el otro filtro al cambiar uno.
  const estadoQS = status ? `estado=${status}` : "";
  const sevQS = severity ? `sev=${severity}` : "";

  return (
    <>
      <PageHeader title="Hallazgos" meta={`${findings.length} mostrados`} />
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Chips
            active={severity ?? ""}
            base={`/app/hallazgos${estadoQS ? `?${estadoQS}` : ""}`}
            options={[{ value: "", label: "Todas" }, ...SEVERITIES.map((s) => ({ value: `sev=${s}`, label: SEV_LABEL[s] }))]}
          />
          <Chips
            active={status ?? ""}
            base={`/app/hallazgos${sevQS ? `?${sevQS}` : ""}`}
            options={[{ value: "", label: "Todos" }, ...FINDING_STATUSES.map((s) => ({ value: `estado=${s}`, label: STATUS_SHORT[s] }))]}
          />
        </div>

        <Panel title="Hallazgos">
          {findings.length === 0 ? (
            <EmptyState
              title="No hay hallazgos con esos filtros."
              detail="Lanza una auditoría sobre un activo verificado, o cambia los filtros."
            />
          ) : (
            <div className="divide-y divide-line">
              {findings.map((f) => (
                <article key={f.id} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <SeverityPill severity={f.severity} />
                        {f.cwe && <span className="font-mono text-[10px] text-dim">{f.cwe}</span>}
                        {f.category && <span className="rounded-[4px] border border-line px-1.5 font-mono text-[10px] text-dim">{f.category}</span>}
                      </div>
                      <h3 className="font-medium">{f.title}</h3>
                      <p className="mt-0.5 font-mono text-xs break-all text-dim">
                        {f.assets?.value ?? "—"}{f.location && f.location !== f.assets?.value ? ` · ${f.location}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusSelect id={f.id} status={f.status} />
                    </div>
                  </div>
                  {f.description && <p className="mt-2 text-dim">{f.description}</p>}
                  {f.remediation && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm">
                      <Wrench size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                      <span><span className="text-dim">Cómo arreglarlo:</span> {f.remediation}</span>
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-dim">Visto por última vez: {dateFormat.format(new Date(f.last_seen))}</p>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
