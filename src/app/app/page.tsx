import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityBars, SeverityDonut } from "@/components/charts";
import { OnboardingGuide, onboardingComplete, type OnboardingState } from "@/components/onboarding";
import { EmptyState, MetricTile, PageHeader, Panel, ScanStatusBadge, SEVERITIES } from "@/components/ui";
import { ownershipStatus } from "@/lib/assets/types";
import { getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen" };

type RecentScan = {
  id: string;
  mode: string;
  status: string;
  created_at: string;
  assets: { label: string; value: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

type AssetRow = { id: string; ownership_verified: boolean; allowlisted: boolean; verification_expires_at: string | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const since = new Date(Date.now() - 13 * 86400000);
  since.setUTCHours(0, 0, 0, 0);

  const [assets, findings, running, recent, activity, settings] = await Promise.all([
    supabase.from("assets").select("id, ownership_verified, allowlisted, verification_expires_at").returns<AssetRow[]>(),
    supabase.from("findings").select("severity").eq("status", "open"),
    supabase.from("scans").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]),
    supabase
      .from("scans")
      .select("id, mode, status, created_at, assets(label, value)")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentScan[]>(),
    supabase.from("scans").select("created_at").gte("created_at", since.toISOString()).returns<{ created_at: string }[]>(),
    getMySettings(user.id),
  ]);

  const failed = assets.error ?? findings.error ?? running.error ?? recent.error ?? activity.error;
  if (failed) {
    console.error("dashboard: error de consulta", failed.code);
    return (
      <>
        <PageHeader title="Resumen" />
        <div className="p-4">
          <Panel title="Sin datos">
            <EmptyState
              title="No se pudo leer la base de datos."
              detail="Comprueba que la migración está aplicada y que las variables de Supabase son correctas."
            />
          </Panel>
        </div>
      </>
    );
  }

  const assetRows = assets.data ?? [];
  const openRows = findings.data ?? [];
  const scans = recent.data ?? [];

  const now = Date.now();
  const verifiedAsset = assetRows.find(
    (a) => a.allowlisted && ownershipStatus(a, now) === "verified",
  );
  const onboarding: OnboardingState = {
    hasAsset: assetRows.length > 0,
    hasVerifiedAsset: Boolean(verifiedAsset),
    hasScan: scans.length > 0,
    hasKey: settings.hasKey,
    firstVerifiedAssetId: verifiedAsset?.id ?? null,
  };
  const showOnboarding = !onboardingComplete(onboarding);

  const bySeverity = SEVERITIES.map((severity) => ({
    severity,
    count: openRows.filter((row) => row.severity === severity).length,
  }));

  const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  const buckets = new Map<string, number>();
  for (const row of activity.data ?? []) {
    const key = dayKey(new Date(row.created_at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000);
    return { label: String(d.getUTCDate()), count: buckets.get(dayKey(d)) ?? 0 };
  });

  return (
    <>
      <PageHeader
        title="Resumen"
        meta={`${openRows.length} hallazgos abiertos`}
        actions={
          <Link
            href="/app/activos"
            className="inline-flex h-8 items-center rounded-control bg-accent px-3 text-xs font-medium text-accent-ink hover:brightness-95"
          >
            Nueva auditoría
          </Link>
        }
      />
      <div className="space-y-4 p-4">
        {showOnboarding && <OnboardingGuide state={onboarding} />}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
          <MetricTile label="Activos" value={assetRows.length} />
          <MetricTile label="Verificados" value={assetRows.filter((a) => a.ownership_verified).length} />
          <MetricTile label="Escaneos activos" value={running.count ?? 0} />
          <MetricTile label="Hallazgos abiertos" value={openRows.length} accent={openRows.length > 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Hallazgos por severidad">
            {openRows.length === 0 ? (
              <EmptyState title="Sin hallazgos abiertos." detail="Cuando lances una auditoría, verás aquí el reparto por gravedad." />
            ) : (
              <SeverityDonut counts={bySeverity} />
            )}
          </Panel>
          <Panel title="Actividad de escaneos (14 días)">
            <ActivityBars days={days} />
          </Panel>
        </div>

        <Panel title="Últimos escaneos">
            {scans.length === 0 ? (
              <EmptyState
                title="Aún no has lanzado ningún escaneo."
                detail="Añade un activo, verifica su propiedad y lanza tu primera auditoría."
                action={
                  <Link
                    href="/app/activos"
                    className="inline-flex h-8 items-center rounded-control border border-line px-3 text-fg hover:bg-surface-2"
                  >
                    Ir a activos
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-dim">
                    <tr className="h-8 border-b border-line">
                      <th scope="col" className="px-3 font-normal">Activo</th>
                      <th scope="col" className="px-3 font-normal">Modo</th>
                      <th scope="col" className="px-3 font-normal">Estado</th>
                      <th scope="col" className="px-3 font-normal">Fecha (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {scans.map((scan) => (
                      <tr key={scan.id} className="h-10 transition-colors hover:bg-surface-2">
                        <td className="max-w-[280px] px-3">
                          <span className="block truncate font-mono text-xs">{scan.assets?.value ?? "—"}</span>
                          {scan.assets?.label && <span className="block truncate text-[11px] text-dim">{scan.assets.label}</span>}
                        </td>
                        <td className="px-3 font-mono text-xs text-dim">{scan.mode}</td>
                        <td className="px-3"><ScanStatusBadge status={scan.status} /></td>
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
