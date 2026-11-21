"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLevel } from "@/lib/scan/models";
import { clearAnthropicKey, saveAnthropicKey, setDefaultLevel } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { status: "idle" | "ok" | "error"; message?: string };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function saveKey(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const userId = await requireUserId();
  const key = String(formData.get("key") ?? "").trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return { status: "error", message: "La clave no parece válida. Las de Anthropic empiezan por sk-ant-." };
  }
  try {
    await saveAnthropicKey(userId, key);
  } catch {
    return { status: "error", message: "No se pudo guardar. Falta configurar SETTINGS_ENCRYPTION_KEY en el servidor." };
  }
  revalidatePath("/app/ajustes");
  return { status: "ok", message: "Clave guardada y cifrada." };
}

export async function removeKey(): Promise<void> {
  const userId = await requireUserId();
  await clearAnthropicKey(userId);
  revalidatePath("/app/ajustes");
}

export async function changeLevel(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const level = String(formData.get("level") ?? "");
  if (isLevel(level)) {
    await setDefaultLevel(userId, level);
    revalidatePath("/app/ajustes");
  }
}
