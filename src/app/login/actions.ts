"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "invalid" | "wait" | "quota"; email?: string };
export type PasswordState = { status: "idle" | "invalid" | "wait"; email?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = readEmail(formData);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { status: "invalid", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error?.status === 429) {
    return { status: error.message.includes("email rate limit") ? "quota" : "wait", email };
  }
  if (error) console.warn("login: fallo al pedir enlace", error.code ?? error.status);

  // Misma respuesta exista o no la cuenta, para no revelar qué correos están dados de alta.
  return { status: "sent", email };
}

export async function signInWithPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !password || password.length > 72) {
    return { status: "invalid", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.status === 429) return { status: "wait", email };
  if (error) return { status: "invalid", email };

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
