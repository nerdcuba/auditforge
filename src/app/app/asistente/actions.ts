"use server";

import Anthropic from "@anthropic-ai/sdk";
import { LEVEL_MODEL } from "@/lib/scan/models";
import { getAnthropicKey, getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatState = { messages: ChatMessage[]; error?: string };

const SYSTEM = `Eres el asistente de seguridad de AuditForge. Ayudas a una persona que construye software pero NO es experta en ciberseguridad, sobre SUS PROPIOS activos.

- Responde en español, claro y directo, sin jerga innecesaria; si usas un término técnico, explícalo.
- Céntrate en ayudarle a entender y corregir los hallazgos de sus auditorías, y en buenas prácticas de seguridad.
- Usa el contexto de sus auditorías cuando sea relevante. No inventes hallazgos que no estén.
- Solo ayudas con activos propios o autorizados. Si te piden atacar o escanear algo de terceros sin permiso, niégate y recuérdalo.
- Sé conciso: ve al grano y ofrece pasos accionables.`;

async function buildContext(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const [findings, scans] = await Promise.all([
    supabase.from("findings").select("title, severity, category, location, assets(value)").eq("status", "open").limit(40)
      .returns<{ title: string; severity: string; category: string | null; location: string | null; assets: { value: string } | null }[]>(),
    supabase.from("scans").select("mode, status, summary, created_at, assets(value)").order("created_at", { ascending: false }).limit(8)
      .returns<{ mode: string; status: string; summary: string | null; created_at: string; assets: { value: string } | null }[]>(),
  ]);

  const f = findings.data ?? [];
  const s = scans.data ?? [];
  if (f.length === 0 && s.length === 0) return "El usuario todavía no tiene hallazgos ni escaneos.";

  const findingLines = f.map((x) => `- [${x.severity}] ${x.title} (${x.assets?.value ?? "?"}${x.location ? ` · ${x.location}` : ""})`).join("\n");
  const scanLines = s.map((x) => `- ${x.assets?.value ?? "?"} · ${x.mode} · ${x.status}${x.summary ? ` · ${x.summary}` : ""}`).join("\n");
  return `Contexto de las auditorías del usuario.\n\nHallazgos abiertos (${f.length}):\n${findingLines || "ninguno"}\n\nEscaneos recientes:\n${scanLines || "ninguno"}`;
}

export async function sendMessage(prev: ChatState, formData: FormData): Promise<ChatState> {
  const input = String(formData.get("message") ?? "").trim();
  if (!input) return prev;
  if (input.length > 4000) return { messages: prev.messages, error: "El mensaje es demasiado largo." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { messages: prev.messages, error: "Sesión caducada. Vuelve a entrar." };

  const apiKey = await getAnthropicKey(user.id);
  if (!apiKey) {
    return { messages: [...prev.messages, { role: "user", content: input }], error: "Configura tu clave de Claude en Ajustes para usar el asistente." };
  }

  const [settings, context] = await Promise.all([getMySettings(user.id), buildContext(supabase)]);
  const history = prev.messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: LEVEL_MODEL[settings.defaultLevel],
      max_tokens: 1024,
      system: `${SYSTEM}\n\n${context}`,
      output_config: { effort: "low" },
      messages: [...history, { role: "user", content: input }],
    });
    if (message.stop_reason === "refusal") {
      return { messages: [...prev.messages, { role: "user", content: input }], error: "No puedo ayudar con eso." };
    }
    const reply = message.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    return { messages: [...prev.messages, { role: "user", content: input }, { role: "assistant", content: reply || "…" }] };
  } catch (error) {
    const err = error as { status?: number };
    const msg = err.status === 401 ? "Tu clave de Claude no es válida." : err.status === 429 ? "Límite de uso de Claude alcanzado." : "No se pudo contactar con Claude.";
    return { messages: [...prev.messages, { role: "user", content: input }], error: msg };
  }
}
