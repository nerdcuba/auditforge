"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownershipStatus, type Asset } from "@/lib/assets/types";
import { runScan } from "@/lib/scan/engine";
import { isLevel } from "@/lib/scan/models";
import { orchestrateScan } from "@/lib/scan/orchestrator";
import { launchQueuedScan, scanDispatchMode } from "@/lib/scope/launch";
import { getAnthropicKey, getMySettings } from "@/lib/settings/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LaunchState = { status: "idle" | "error"; message?: string };

type Admin = ReturnType<typeof createAdminClient>;
type Log = { level: "info" | "warn" | "error"; message: string };
const writeLogs = (admin: Admin, scanId: string, logs: Log[]) =>
  admin.rpc("append_inline_logs", { p_scan_id: scanId, p_logs: logs });

export async function launchScan(_prev: LaunchState, formData: FormData): Promise<LaunchState> {
  const assetId = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(assetId)) return { status: "error", message: "Activo no válido." };

  // Nivel elegido para este escaneo (solo afecta al orquestador IA). Si no viene o no es
  // válido, se usa el nivel por defecto del usuario más abajo.
  const rawLevel = formData.get("level");
  const chosenLevel = isLevel(rawLevel) ? rawLevel : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: asset } = await supabase.from("assets").select("*").eq("id", assetId).maybeSingle<Asset>();
  if (!asset) return { status: "error", message: "No encontramos ese activo." };

  const status = ownershipStatus(asset, Date.now());
  if (status !== "verified" || !asset.allowlisted) {
    return { status: "error", message: "Verifica la propiedad y autoriza el activo antes de escanear." };
  }

  // Modo cola: el escaneo se firma, se encola y lo recoge el worker aislado. La vista de
  // escaneo muestra el progreso en vivo. (Requiere el worker desplegado.)
  if (scanDispatchMode() === "queue") {
    const queued = await launchQueuedScan({ userId: user.id, assetId: asset.id, value: asset.value, mode: "passive" });
    if (!queued.ok) {
      console.warn("escaneo: no se pudo encolar", queued.reason);
      return { status: "error", message: "No se pudo encolar el escaneo. Comprueba la verificación y la firma." };
    }
    revalidatePath("/app/escaneos");
    revalidatePath("/app");
    revalidatePath(`/app/activos/${asset.id}`);
    redirect(`/app/escaneos/${queued.scanId}`);
  }

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: "error", message: "Falta configurar la clave de servidor de Supabase." };
  }

  const started = await admin.rpc("start_inline_scan", { p_user_id: user.id, p_asset_id: asset.id, p_mode: "passive" });
  if (started.error || !started.data) {
    console.warn("escaneo: no se pudo iniciar", started.error?.code);
    return { status: "error", message: "No se pudo iniciar el escaneo. Comprueba que la verificación sigue vigente." };
  }
  const scanId = started.data as string;

  try {
    const [settings, apiKey] = await Promise.all([getMySettings(user.id), getAnthropicKey(user.id)]);
    const level = chosenLevel ?? settings.defaultLevel;
    const outcome = await runScan(asset, { disabledTools: settings.disabledTools });
    await writeLogs(admin, scanId, outcome.logs);

    if (!outcome.ok) {
      await admin.rpc("finish_inline_scan", { p_scan_id: scanId, p_status: "failed", p_summary: outcome.reason });
    } else {
      if (outcome.findings.length > 0) {
        await admin.rpc("submit_inline_findings", { p_scan_id: scanId, p_findings: outcome.findings });
      }

      // Orquestador IA opcional: solo si el usuario tiene clave configurada.
      // Un agente de Claude investiga de forma pasiva y añade hallazgos nuevos.
      if (apiKey) {
        await writeLogs(admin, scanId, [{ level: "info", message: `Orquestador IA (nivel ${level}) en marcha…` }]);
        const orch = await orchestrateScan(apiKey, level, asset, outcome.findings);
        await writeLogs(admin, scanId, orch.logs);
        if (orch.ok) {
          if (orch.findings.length > 0) {
            await admin.rpc("submit_inline_findings", { p_scan_id: scanId, p_findings: orch.findings });
          }
          await admin.rpc("set_scan_ai", { p_scan_id: scanId, p_summary: orch.summary, p_model: orch.model });
        } else {
          await writeLogs(admin, scanId, [{ level: "warn", message: `El análisis con IA no se pudo completar: ${orch.reason}` }]);
        }
      }

      await admin.rpc("finish_inline_scan", {
        p_scan_id: scanId,
        p_status: "done",
        p_summary: outcome.summary,
        p_engine_version: "deterministic-1",
      });
    }
  } catch (error) {
    console.error("escaneo: error en ejecución", error);
    await admin.rpc("finish_inline_scan", { p_scan_id: scanId, p_status: "failed", p_summary: "Error interno durante el escaneo." });
  }

  revalidatePath("/app/escaneos");
  revalidatePath("/app");
  revalidatePath(`/app/activos/${asset.id}`);
  redirect(`/app/escaneos/${scanId}`);
}
