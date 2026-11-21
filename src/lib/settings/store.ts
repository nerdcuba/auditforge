import "server-only";
import { isLevel, type Level } from "@/lib/scan/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "./crypto";

export type MySettings = { hasKey: boolean; keyHint: string | null; defaultLevel: Level; disabledTools: string[] };

const nowIso = () => new Date().toISOString();

export async function getMySettings(userId: string): Promise<MySettings> {
  const { data } = await createAdminClient()
    .from("user_settings")
    .select("anthropic_key_cipher, anthropic_key_hint, default_level, disabled_tools")
    .eq("user_id", userId)
    .maybeSingle<{ anthropic_key_cipher: string | null; anthropic_key_hint: string | null; default_level: string; disabled_tools: unknown }>();

  const level = data && isLevel(data.default_level) ? data.default_level : "equilibrado";
  const disabledTools = Array.isArray(data?.disabled_tools) ? (data.disabled_tools as string[]) : [];
  return {
    hasKey: Boolean(data?.anthropic_key_cipher),
    keyHint: data?.anthropic_key_hint ?? null,
    defaultLevel: level,
    disabledTools,
  };
}

export async function setToolEnabled(userId: string, key: string, enabled: boolean): Promise<void> {
  const current = (await getMySettings(userId)).disabledTools;
  const next = enabled ? current.filter((k) => k !== key) : Array.from(new Set([...current, key]));
  await createAdminClient().from("user_settings").upsert({ user_id: userId, disabled_tools: next, updated_at: nowIso() });
}

export async function saveAnthropicKey(userId: string, key: string): Promise<void> {
  const cipher = encryptSecret(key);
  await createAdminClient().from("user_settings").upsert({
    user_id: userId,
    anthropic_key_cipher: cipher,
    anthropic_key_hint: key.slice(-4),
    updated_at: nowIso(),
  });
}

export async function clearAnthropicKey(userId: string): Promise<void> {
  await createAdminClient().from("user_settings").upsert({
    user_id: userId,
    anthropic_key_cipher: null,
    anthropic_key_hint: null,
    updated_at: nowIso(),
  });
}

export async function setDefaultLevel(userId: string, level: Level): Promise<void> {
  await createAdminClient().from("user_settings").upsert({
    user_id: userId,
    default_level: level,
    updated_at: nowIso(),
  });
}

// Solo servidor: descifra la clave para usarla en una llamada a Claude.
export async function getAnthropicKey(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("user_settings")
    .select("anthropic_key_cipher")
    .eq("user_id", userId)
    .maybeSingle<{ anthropic_key_cipher: string | null }>();
  if (!data?.anthropic_key_cipher) return null;
  try {
    return decryptSecret(data.anthropic_key_cipher);
  } catch {
    return null;
  }
}
