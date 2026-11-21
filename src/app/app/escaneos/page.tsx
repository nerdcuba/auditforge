import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, ScanStatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Escaneos" };

type ScanRow = {
  id: string;
  mode: string;
  status: string;
  created_at: string;
  summary: string | null;
  assets: { label: string; value: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function ScansPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scans")
    .select("id, mode, status, created_at, summary, assets(label, value)")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ScanRow[]>();
  const scans = data ?? [];
  if (error) console.error("escaneos: error de consulta", error.code);

  return (
    <>
      <PageHeader title="Escaneos" meta={`${scans.length} en total`} />
      <div className="p-4">
        <Panel title="Historial de escaneos">
          {scans.length === 0 ? (
            <EmptyState
              title="Todavía no has lanzado ningún escaneo."
              detail="Entra en un activo verificado y autorizado y pulsa «Lanzar auditoría»."
              action={
                <Link href="/app/activos" className="inline-flex h-8 items-center rounded-control border border-line px-3 text-fg hover:bg-surface-2">
                  Ir a activos
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="text-xs text-dim">
                  <tr className="h-8 border-b border-line">
                    <th scope="col" className="px-3 font-normal">Activo</th>
                    <th scope="col" className="px-3 font-normal">Modo</th>
                    <th scope="col" className="px-3 font-normal">Estado</th>
                    <th scope="col" className="px-3 font-normal">Resumen</th>
                    <th scope="col" className="px-3 font-normal">Fecha (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="h-11 transition-colors hover:bg-surface-2">
                      <td className="max-w-[240px] px-3">
                        <Link href={`/app/escaneos/${scan.id}`} className="block">
                          <span className="block truncate font-mono text-xs">{scan.assets?.value ?? "—"}</span>
                          {scan.assets?.label && <span className="block truncate text-[11px] text-dim">{scan.assets.label}</span>}
                        </Link>
                      </td>
                      <td className="px-3 font-mono text-xs text-dim">{scan.mode}</td>
                      <td className="px-3"><ScanStatusBadge status={scan.status} /></td>
                      <td className="max-w-[260px] truncate px-3 text-xs text-dim">{scan.summary ?? "—"}</td>
                      <td className="px-3 font-mono text-xs whitespace-nowrap text-dim">
                        {dateFormat.format(new Date(scan.created_at))}
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
