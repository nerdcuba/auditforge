"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TOOL_KEYS } from "@/lib/scan/tools";
import { setToolEnabled } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";

export async function toggleTool(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!TOOL_KEYS.includes(key)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await setToolEnabled(user.id, key, enabled);
  revalidatePath("/app/herramientas");
}
