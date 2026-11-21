import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnershipBadge, PageHeader, Panel } from "@/components/ui";
import { dnsProofName } from "@/lib/assets/dns-name";
import { ASSET_TYPE_LABEL, METHOD_LABEL, ownershipStatus, type Asset } from "@/lib/assets/types";
import { scanDispatchMode } from "@/lib/scope/launch";
import { getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";
import { LaunchScanButton } from "../../escaneos/launch-button";
import { DeleteAssetControl, GateControls, VerificationPanel } from "../asset-controls";

export const metadata: Metadata = { title: "Activo" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-xs text-dim">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-xs">{children}</dd>
    </div>
  );
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).maybeSingle<Asset>();
  if (!asset) notFound();

  const status = ownershipStatus(asset, Date.now());
  const settings = await getMySettings(user.id);

  return (
    <>
      <PageHeader title={asset.label} meta={ASSET_TYPE_LABEL[asset.type]} />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/app/activos" className="inline-flex items-center gap-1.5 text-dim hover:text-fg">
            <ArrowLeft size={14} aria-hidden /> Activos
          </Link>
          <OwnershipBadge status={status} />
        </div>

        <p className="font-mono text-base break-all">{asset.value}</p>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
          <Fact label="Método">{asset.verification_method ? METHOD_LABEL[asset.verification_method] : "—"}</Fact>
          <Fact label="Verificado (UTC)">{asset.verified_at ? dateFormat.format(new Date(asset.verified_at)) : "—"}</Fact>
          <Fact label="Caduca (UTC)">
            {asset.verification_expires_at ? dateFormat.format(new Date(asset.verification_expires_at)) : "—"}
          </Fact>
          <Fact label="Alta (UTC)">{dateFormat.format(new Date(asset.created_at))}</Fact>
        </dl>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Verificación de propiedad">
            <VerificationPanel
              key={asset.verification_token}
              asset={asset}
              status={status}
              dnsName={asset.type === "domain" ? dnsProofName(asset.value) : null}
            />
          </Panel>
          <div className="space-y-4">
            <Panel title="Auditoría">
              <div className="p-3">
                {status === "verified" && asset.allowlisted ? (
                  <LaunchScanButton assetId={asset.id} defaultLevel={settings.defaultLevel} hasKey={settings.hasKey} queued={scanDispatchMode() === "queue"} />
                ) : (
                  <p className="text-dim">
                    Para lanzar una auditoría, primero verifica la propiedad y autoriza el activo en las puertas de alcance.
                  </p>
                )}
              </div>
            </Panel>
            <Panel title="Puertas de alcance">
              <GateControls asset={asset} status={status} />
            </Panel>
            {asset.scope_notes && (
              <Panel title="Notas de alcance">
                <p className="px-3 py-2.5 whitespace-pre-wrap text-dim">{asset.scope_notes}</p>
              </Panel>
            )}
            <div className="flex justify-end"><DeleteAssetControl asset={asset} /></div>
          </div>
        </div>
      </div>
    </>
  );
}
