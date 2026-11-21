import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Severity } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Informe" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_LABEL: Record<Severity, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Info" };
const SEV_COLOR: Record<Severity, string> = {
  critical: "var(--color-sev-critical)", high: "var(--color-sev-high)", medium: "var(--color-sev-medium)",
  low: "var(--color-sev-low)", info: "var(--color-sev-info)",
};

type Scan = { id: string; mode: string; status: string; summary: string | null; ai_summary: string | null; ai_model: string | null; created_at: string; assets: { value: string; label: string } | null };
type Finding = { id: string; title: string; severity: Severity; category: string | null; cwe: string | null; location: string | null; description: string | null; remediation: string | null };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data: scan } = await supabase
    .from("scans")
    .select("id, mode, status, summary, ai_summary, ai_model, created_at, assets(value, label)")
    .eq("id", id)
    .maybeSingle<Scan>();
  if (!scan) notFound();

  const { data: occ } = await supabase
    .from("finding_occurrences")
    .select("finding:findings(*)")
    .eq("scan_id", id)
    .returns<{ finding: Finding }[]>();
  const findings = (occ ?? []).map((r) => r.finding).filter(Boolean)
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  return (
    <>
      <div className="no-print flex h-12 items-center justify-between border-b border-line px-4">
        <Link href="/app/reportes" className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-fg">
          <ArrowLeft size={14} aria-hidden /> Reportes
        </Link>
        <ReportActions scanId={scan.id} />
      </div>

      <div className="report-print mx-auto max-w-3xl p-6">
        <header className="border-b border-line pb-4">
          <p className="font-mono text-xs tracking-wide text-accent">AUDITFORGE · INFORME DE AUDITORÍA</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{scan.assets?.value}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-dim">Activo</dt><dd>{scan.assets?.label}</dd></div>
            <div><dt className="text-xs text-dim">Modo</dt><dd className="font-mono text-xs">{scan.mode}</dd></div>
            <div><dt className="text-xs text-dim">Hallazgos</dt><dd className="font-mono tabular-nums">{findings.length}</dd></div>
            <div><dt className="text-xs text-dim">Fecha (UTC)</dt><dd className="text-xs">{dateFormat.format(new Date(scan.created_at))}</dd></div>
          </dl>
        </header>

        {scan.ai_summary && (
          <section className="border-b border-line py-4">
            <h2 className="text-sm font-semibold">Análisis con IA</h2>
            <p className="mt-2 text-sm whitespace-pre-wrap">{scan.ai_summary}</p>
            {scan.ai_model && <p className="mt-2 font-mono text-[11px] text-dim">Generado por {scan.ai_model}</p>}
          </section>
        )}

        <section className="py-4">
          <h2 className="text-sm font-semibold">Hallazgos</h2>
          {findings.length === 0 ? (
            <p className="mt-2 text-sm text-dim">Sin hallazgos en las comprobaciones pasivas.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {findings.map((f) => (
                <article key={f.id} className="break-inside-avoid">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-[2px] [print-color-adjust:exact]" style={{ background: SEV_COLOR[f.severity] }} aria-hidden />
                    <span className="font-mono text-[11px] text-dim">{SEV_LABEL[f.severity]}</span>
                    {f.cwe && <span className="font-mono text-[11px] text-dim">· {f.cwe}</span>}
                    {f.category && <span className="font-mono text-[11px] text-dim">· {f.category}</span>}
                  </div>
                  <h3 className="mt-1 font-medium">{f.title}</h3>
                  {f.location && <p className="font-mono text-xs break-all text-dim">{f.location}</p>}
                  {f.description && <p className="mt-1 text-sm text-dim">{f.description}</p>}
                  {f.remediation && <p className="mt-1 text-sm"><span className="text-dim">Cómo arreglarlo:</span> {f.remediation}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-line pt-4 text-xs text-dim">
          Generado por AuditForge. Este informe es una revisión no intrusiva, no una garantía de seguridad. Úsalo solo
          sobre activos de tu propiedad o con autorización.
        </footer>
      </div>
    </>
  );
}
