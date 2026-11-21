"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FINDING_STATUSES, type FindingStatus } from "./constants";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setFindingStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FindingStatus;
  if (!UUID_PATTERN.test(id) || !FINDING_STATUSES.includes(status)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS + grant update(status): solo cambia el estado de hallazgos propios.
  await supabase.from("findings").update({ status }).eq("id", id);
  revalidatePath("/app/hallazgos");
  revalidatePath("/app");
}
