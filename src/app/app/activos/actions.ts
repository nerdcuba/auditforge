"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ASSET_TYPES,
  VERIFICATION_METHODS,
  type ActionState,
  type Asset,
  type AssetType,
  type VerificationMethod,
} from "@/lib/assets/types";
import { checkOwnership } from "@/lib/assets/verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOT_FOUND: ActionState = { status: "error", message: "No encontramos ese activo." };

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// La lectura pasa por RLS: si no devuelve fila, el activo no es de este usuario.
async function loadOwnedAsset(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return null;
  const { supabase, user } = await session();
  const { data } = await supabase.from("assets").select("*").eq("id", id).maybeSingle<Asset>();
  return data ? { asset: data, supabase, user } : null;
}

async function scopeRpc(fn: string, args: Record<string, unknown>, assetId: string, success: string): Promise<ActionState> {
  try {
    const { error } = await createAdminClient().rpc(fn, args);
    if (error) {
      console.warn(`activos: ${fn} rechazada`, error.code);
      return { status: "error", message: "No se pudo aplicar. Comprueba que la verificación sigue vigente." };
    }
  } catch {
    console.error(`activos: ${fn} sin configuración de servidor`);
    return { status: "error", message: "Falta configurar la clave de servidor de Supabase." };
  }
  revalidatePath("/app/activos");
  revalidatePath(`/app/activos/${assetId}`);
  revalidatePath("/app");
  return { status: "ok", message: success };
}

export async function createAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AssetType;
  const value = String(formData.get("value") ?? "").trim();
  const notes = String(formData.get("scope_notes") ?? "").trim();

  if (!label || label.length > 120) return { status: "error", message: "Ponle un nombre de hasta 120 caracteres." };
  if (!ASSET_TYPES.includes(type)) return { status: "error", message: "Elige un tipo de activo." };
  if (!value || value.length > 2048) return { status: "error", message: "Indica el objetivo." };
  if (notes.length > 1000) return { status: "error", message: "Las notas no pueden pasar de 1000 caracteres." };

  const { supabase } = await session();
  const { data, error } = await supabase
    .from("assets")
    .insert({ label, type, value, scope_notes: notes || null })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") return { status: "error", message: "Ya tienes ese activo añadido." };
    if (error.code === "22023" || error.code === "22P02") {
      return { status: "error", message: "El objetivo no tiene un formato válido para ese tipo." };
    }
    console.warn("activos: alta rechazada", error.code);
    return { status: "error", message: "No se pudo añadir el activo." };
  }

  revalidatePath("/app/activos");
  revalidatePath("/app");
  redirect(`/app/activos/${data.id}`);
}

export async function verifyAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owned = await loadOwnedAsset(formData);
  if (!owned) return NOT_FOUND;
  const method = String(formData.get("method") ?? "") as VerificationMethod;
  if (!VERIFICATION_METHODS.includes(method)) return { status: "error", message: "Elige un método de verificación." };

  const result = await checkOwnership(owned.asset, method);
  if (!result.ok) return { status: "error", message: result.message };

  return scopeRpc(
    "mark_asset_verified",
    { p_user_id: owned.user.id, p_asset_id: owned.asset.id, p_method: method },
    owned.asset.id,
    "Propiedad verificada durante 30 días.",
  );
}

export async function revokeAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owned = await loadOwnedAsset(formData);
  if (!owned) return NOT_FOUND;
  return scopeRpc(
    "revoke_asset_verification",
    { p_user_id: owned.user.id, p_asset_id: owned.asset.id, p_reason: "revocada por el usuario" },
    owned.asset.id,
    "Verificación revocada.",
  );
}

export async function setAllowlisted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owned = await loadOwnedAsset(formData);
  if (!owned) return NOT_FOUND;
  const enabled = formData.get("enabled") === "true";
  return scopeRpc(
    "set_asset_allowlisted",
    { p_user_id: owned.user.id, p_asset_id: owned.asset.id, p_allowlisted: enabled },
    owned.asset.id,
    enabled ? "Activo autorizado." : "Activo retirado de la allowlist.",
  );
}

export async function setActiveMode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owned = await loadOwnedAsset(formData);
  if (!owned) return NOT_FOUND;
  const enabled = formData.get("enabled") === "true";
  const confirmed = String(formData.get("confirm") ?? "").trim() === owned.asset.value;
  if (enabled && !confirmed) return { status: "error", message: "Escribe el objetivo exacto para confirmar." };
  return scopeRpc(
    "set_active_mode",
    { p_user_id: owned.user.id, p_asset_id: owned.asset.id, p_enabled: enabled, p_confirmed: enabled && confirmed },
    owned.asset.id,
    enabled ? "Modo active habilitado." : "Modo active deshabilitado.",
  );
}

export async function deleteAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owned = await loadOwnedAsset(formData);
  if (!owned) return NOT_FOUND;
  if (String(formData.get("confirm") ?? "").trim() !== owned.asset.value) {
    return { status: "error", message: "Escribe el objetivo exacto para confirmar." };
  }
  const { error } = await owned.supabase.from("assets").delete().eq("id", owned.asset.id);
  if (error) {
    console.warn("activos: borrado rechazado", error.code);
    return { status: "error", message: "No se pudo eliminar el activo." };
  }
  revalidatePath("/app/activos");
  revalidatePath("/app");
  redirect("/app/activos");
}
