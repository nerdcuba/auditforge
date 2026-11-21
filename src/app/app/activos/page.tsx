import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, OwnershipBadge, PageHeader, Panel } from "@/components/ui";
import { Disclaimer } from "@/components/marketing/disclaimer";
import { ASSET_TYPE_LABEL, ownershipStatus, type Asset } from "@/lib/assets/types";
import { createClient } from "@/lib/supabase/server";
import { AddAssetDialog } from "./asset-controls";

export const metadata: Metadata = { title: "Activos" };

const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "UTC" });

export default async function AssetsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Asset[]>();
  const assets = data ?? [];
  const now = Date.now();
  if (error) console.error("activos: error de consulta", error.code);

  return (
    <>
      <PageHeader title="Activos" meta={`${assets.length} en total`} />
      <div className="space-y-3 p-4">
        <Disclaimer variant="banner" />
        <div className="flex justify-end"><AddAssetDialog /></div>
        <Panel title="Inventario">
          {error ? (
            <EmptyState title="No se pudo leer el inventario." detail="Comprueba la conexión con Supabase y recarga." />
          ) : assets.length === 0 ? (
            <EmptyState title="Aún no has verificado ningún activo." detail="Añade un dominio y pégale el TXT." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="text-xs text-dim">
                  <tr className="h-8 border-b border-line">
                    <th scope="col" className="px-3 font-normal">Activo</th>
                    <th scope="col" className="px-3 font-normal">Tipo</th>
                    <th scope="col" className="px-3 font-normal">Propiedad</th>
                    <th scope="col" className="px-3 font-normal">Allowlist</th>
                    <th scope="col" className="px-3 font-normal">Modo máximo</th>
                    <th scope="col" className="px-3 font-normal">Caduca (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {assets.map((asset) => {
                    const status = ownershipStatus(asset, now);
                    const allowed = status === "verified" && asset.allowlisted;
                    return (
                      <tr key={asset.id} className="h-11 hover:bg-surface-2">
                        <td className="px-3">
                          <Link href={`/app/activos/${asset.id}`} className="block max-w-[320px]">
                            <span className="block truncate font-medium">{asset.label}</span>
                            <span className="block truncate font-mono text-xs text-dim">{asset.value}</span>
                          </Link>
                        </td>
                        <td className="px-3 text-dim">{ASSET_TYPE_LABEL[asset.type]}</td>
                        <td className="px-3"><OwnershipBadge status={status} /></td>
                        <td className="px-3 font-mono text-xs">{allowed ? "sí" : "no"}</td>
                        <td className="px-3 font-mono text-xs text-dim">
                          {!allowed ? "ninguno" : asset.active_mode_enabled ? "active" : "passive"}
                        </td>
                        <td className="px-3 font-mono text-xs text-dim">
                          {asset.verification_expires_at ? dateFormat.format(new Date(asset.verification_expires_at)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
