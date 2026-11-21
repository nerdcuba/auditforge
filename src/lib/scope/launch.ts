import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { signScopeToken, type ScanMode } from "./token";

// La clave PRIVADA de firma vive SOLO en el servidor web (nunca en el worker). Admite \n
// escapados para pegarla en una sola línea en Coolify.
function scopePrivateKey(): string {
  const k = process.env.SCOPE_TOKEN_PRIVATE_KEY;
  if (!k) throw new Error("Falta la variable de entorno SCOPE_TOKEN_PRIVATE_KEY");
  return k.replace(/\\n/g, "\n");
}

export type ScanDispatch = "inline" | "queue";

// Cómo se ejecutan los escaneos recon/passive:
//  - "inline" (por defecto): en el propio servidor web (rápido, sin worker).
//  - "queue": se encolan y los recoge el worker aislado. Actívalo SOLO cuando el worker esté
//    desplegado; si no, los escaneos quedarían en cola sin quien los consuma.
export function scanDispatchMode(): ScanDispatch {
  return process.env.AUDITFORGE_SCAN_DISPATCH?.trim() === "queue" ? "queue" : "inline";
}

export type LaunchResult = { ok: true; scanId: string } | { ok: false; reason: string };

/**
 * Camino de cola (worker): el web genera scan_id y jti, firma el scope_token atado al
 * objetivo exacto, y lo entrega a launch_scan en una sola transacción. La BD reimpone las
 * tres puertas y encola el job; lo recoge el worker aislado. El modo active exige
 * confirmación explícita del usuario (activeConfirmed).
 *
 * Nota: aún no está cableado al botón de la UI. Se activará cuando el worker esté desplegado
 * (si no, los escaneos quedarían en cola sin quien los consuma). Hasta entonces, recon/passive
 * sigue corriendo inline en el web.
 */
export async function launchQueuedScan(args: {
  userId: string;
  assetId: string;
  value: string;
  mode: ScanMode;
  activeConfirmed?: boolean;
}): Promise<LaunchResult> {
  const scanId = randomUUID();
  const { token, jti, expiresAt } = signScopeToken(
    { scan_id: scanId, asset_id: args.assetId, value: args.value, mode: args.mode },
    scopePrivateKey(),
  );

  const { data, error } = await createAdminClient().rpc("launch_scan", {
    p_user_id: args.userId,
    p_scan_id: scanId,
    p_asset_id: args.assetId,
    p_value: args.value,
    p_mode: args.mode,
    p_active_confirmed: args.mode === "active" ? Boolean(args.activeConfirmed) : false,
    p_jti: jti,
    p_scope_token: token,
    p_token_expires_at: expiresAt.toISOString(),
  });

  if (error) return { ok: false, reason: error.message };
  return { ok: true, scanId: data as string };
}
