import { ArrowLeft, Sparkles, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, Panel, ScanStatusBadge, SEVERITIES, SeverityPill, type Severity } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { LiveScan } from "./live";

export const metadata: Metadata = { title: "Escaneo" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

type Scan = {
  id: string; asset_id: string; mode: string; status: string; summary: string | null;
  ai_summary: string | null; ai_model: string | null;
  started_at: string | null; finished_at: string | null; created_at: string;
  assets: { label: string; value: string } | null;
};
type Finding = {
  id: string; title: string; severity: Severity; category: string | null; cwe: string | null;
  location: string | null; description: string | null; remediation: string | null; status: string;
};
type LogRow = { ts: string; level: string; message: string };

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="border-b border-line p-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SeverityPill severity={finding.severity} />
            {finding.cwe && <span className="font-mono text-[10px] text-dim">{finding.cwe}</span>}
            {finding.category && <span className="rounded-[4px] border border-line px-1.5 font-mono text-[10px] text-dim">{finding.category}</span>}
          </div>
          <h3 className="font-medium">{finding.title}</h3>
          {finding.location && <p className="mt-0.5 font-mono text-xs break-all text-dim">{finding.location}</p>}
        </div>
      </div>
      {finding.description && <p className="mt-2 text-dim">{finding.description}</p>}
      {finding.remediation && (
        <p className="mt-2 flex items-start gap-1.5 text-sm">
          <Wrench size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span><span className="text-dim">Cómo arreglarlo:</span> {finding.remediation}</span>
        </p>
      )}
    </article>
  );
}

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data: scan } = await supabase
    .from("scans")
    .select("id, asset_id, mode, status, summary, ai_summary, ai_model, started_at, finished_at, created_at, assets(label, value)")
    .eq("id", id)
    .maybeSingle<Scan>();
  if (!scan) notFound();

  const [occ, logsRes] = await Promise.all([
    supabase.from("finding_occurrences").select("finding:findings(*)").eq("scan_id", id).returns<{ finding: Finding }[]>(),
    supabase.from("scan_logs").select("ts, level, message").eq("scan_id", id).order("ts").returns<LogRow[]>(),
  ]);

  const findings = (occ.data ?? [])
    .map((row) => row.finding)
    .filter(Boolean)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const logs = logsRes.data ?? [];
  const counts = SEVERITIES.map((s) => ({ s, n: findings.filter((f) => f.severity === s).length })).filter((c) => c.n > 0);

  return (
    <>
      <PageHeader title="Escaneo" meta={scan.assets?.value ?? ""} />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/app/escaneos" className="inline-flex items-center gap-1.5 text-dim hover:text-fg">
            <ArrowLeft size={14} aria-hidden /> Escaneos
          </Link>
          <div className="flex items-center gap-3">
            <LiveScan scanId={scan.id} status={scan.status} />
            <ScanStatusBadge status={scan.status} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
          <div className="bg-surface px-3 py-2">
            <dt className="text-xs text-dim">Activo</dt>
            <dd className="mt-0.5 truncate font-mono text-xs">{scan.assets?.value ?? "—"}</dd>
          </div>
          <div className="bg-surface px-3 py-2">
            <dt className="text-xs text-dim">Modo</dt>
            <dd className="mt-0.5 font-mono text-xs">{scan.mode}</dd>
          </div>
          <div className="bg-surface px-3 py-2">
            <dt className="text-xs text-dim">Hallazgos</dt>
            <dd className="mt-0.5 font-mono text-xs tabular-nums">{findings.length}</dd>
          </div>
          <div className="bg-surface px-3 py-2">
            <dt className="text-xs text-dim">Fecha (UTC)</dt>
            <dd className="mt-0.5 font-mono text-xs">{dateFormat.format(new Date(scan.created_at))}</dd>
          </div>
        </dl>

        {scan.summary && <p className="text-dim">{scan.summary}</p>}

        {scan.ai_summary && (
          <Panel title="Análisis con IA">
            <div className="p-3">
              <p className="whitespace-pre-wrap text-sm">{scan.ai_summary}</p>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-dim">
                <Sparkles size={12} className="text-accent" aria-hidden />
                Generado por {scan.ai_model ?? "Claude"} con tu clave
              </p>
            </div>
          </Panel>
        )}

        {counts.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {counts.map(({ s, n }) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <SeverityPill severity={s} /><span className="font-mono text-xs tabular-nums text-dim">{n}</span>
              </span>
            ))}
          </div>
        )}

        <Panel title="Hallazgos">
          {scan.status === "failed" ? (
            <EmptyState title="El escaneo falló." detail={scan.summary ?? "No se pudo completar la revisión."} />
          ) : (scan.status === "queued" || scan.status === "running") && findings.length === 0 ? (
            <EmptyState title="Escaneo en curso…" detail="Los hallazgos aparecerán aquí a medida que se encuentren. Esta vista se actualiza sola." />
          ) : findings.length === 0 ? (
            <EmptyState title="Sin hallazgos." detail="Las comprobaciones pasivas no encontraron problemas. Buen punto de partida." />
          ) : (
            <div>{findings.map((f) => <FindingCard key={f.id} finding={f} />)}</div>
          )}
        </Panel>

        {logs.length > 0 && (
          <Panel title="Registro">
            <div className="space-y-0.5 p-3 font-mono text-xs">
              {logs.map((log, i) => (
                <p key={i} className={log.level === "error" ? "text-sev-critical" : "text-dim"}>
                  <span className="text-dim/60">{dateFormat.format(new Date(log.ts))}</span> {log.message}
                </p>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
