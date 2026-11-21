import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reportes" };

type ScanRow = {
  id: string; mode: string; summary: string | null; created_at: string;
  assets: { value: string; label: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scans")
    .select("id, mode, summary, created_at, assets(value, label)")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ScanRow[]>();
  const scans = data ?? [];
  if (error) console.error("reportes: error de consulta", error.code);

  return (
    <>
      <PageHeader title="Reportes" meta={`${scans.length} escaneos`} />
      <div className="p-4">
        <Panel title="Escaneos terminados">
          {scans.length === 0 ? (
            <EmptyState
              title="Aún no hay reportes."
              detail="Cuando termines una auditoría, podrás exportarla aquí a Markdown o PDF."
              action={
                <Link href="/app/activos" className="inline-flex h-8 items-center rounded-control border border-line px-3 text-fg hover:bg-surface-2">
                  Ir a activos
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="text-xs text-dim">
                  <tr className="h-8 border-b border-line">
                    <th scope="col" className="px-3 font-normal">Activo</th>
                    <th scope="col" className="px-3 font-normal">Resumen</th>
                    <th scope="col" className="px-3 font-normal">Fecha (UTC)</th>
                    <th scope="col" className="px-3 font-normal text-right">Informe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="h-11 transition-colors hover:bg-surface-2">
                      <td className="max-w-[220px] px-3">
                        <span className="block truncate font-mono text-xs">{scan.assets?.value ?? "—"}</span>
                        {scan.assets?.label && <span className="block truncate text-[11px] text-dim">{scan.assets.label}</span>}
                      </td>
                      <td className="max-w-[240px] truncate px-3 text-xs text-dim">{scan.summary ?? "—"}</td>
                      <td className="px-3 font-mono text-xs whitespace-nowrap text-dim">{dateFormat.format(new Date(scan.created_at))}</td>
                      <td className="px-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/app/reportes/${scan.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-2.5 text-xs text-fg hover:bg-surface-2">
                            <FileText size={13} aria-hidden /> Ver
                          </Link>
                          <a href={`/app/reportes/${scan.id}/md`} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-2.5 text-xs text-fg hover:bg-surface-2">
                            <Download size={13} aria-hidden /> Markdown
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
