import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { safeRequest } from "@/lib/assets/network";
import type { Asset } from "@/lib/assets/types";
import { targetBase, type ScanFinding, type ScanLog, type Severity } from "./engine";
import { LEVEL_MODEL, type Level } from "./models";

export type OrchestratorResult =
  | { ok: true; summary: string; model: string; findings: ScanFinding[]; logs: ScanLog[] }
  | { ok: false; reason: string; logs: ScanLog[] };

// Rondas de exploración (llamadas al modelo que pueden pedir http_get) por nivel de coste.
const ROUNDS: Record<Level, number> = { economico: 3, equilibrado: 5, maximo: 7 };
const SEVERITIES: readonly Severity[] = ["info", "low", "medium", "high", "critical"];
const BODY_SNIPPET = 2000;
const HEADERS_OF_INTEREST = [
  "server", "x-powered-by", "content-type", "content-length", "location",
  "content-security-policy", "strict-transport-security", "x-frame-options",
  "x-content-type-options", "referrer-policy", "access-control-allow-origin",
  "cache-control", "www-authenticate",
];

const SYSTEM = `Eres el orquestador de seguridad de AuditForge: un agente que audita de forma PASIVA la web de una persona que construye software pero NO es experta en seguridad. Trabajas sobre UN ÚNICO objetivo autorizado.

Reglas infranqueables:
- SOLO el origen autorizado que se te indica. Nunca pidas otro dominio, subdominio, IP o puerto.
- Modo PASSIVE: solo LEER recursos públicos con http_get (GET). PROHIBIDO cualquier payload, inyección (XSS, SQLi), fuerza bruta, prueba de credenciales, salto de autenticación, carga de ficheros o acción que modifique estado. Nada de /wp-login intentos, nada de parámetros maliciosos.
- Parte de los hallazgos deterministas que ya tienes; NO los repitas. Añade solo hallazgos NUEVOS que puedas confirmar leyendo recursos.
- Confirma antes de afirmar: si crees que algo está expuesto, léelo con http_get y básate en lo que devuelve. No inventes vulnerabilidades.

Qué investigar (ejemplos pasivos): /robots.txt y rutas que revele, /sitemap.xml, /.well-known/security.txt, /humans.txt, cabeceras por recurso, páginas de error, ficheros de configuración o copias (.env.example, config.json, /backup), paneles o rutas de administración accesibles sin pedir contraseña, directorios listables, metadatos que filtren tecnología o versiones.

Cuando termines, llama a submit_report con:
- summary: 3 partes en español claro, sin jerga, para quien no es experto: (1) una frase de estado general, (2) qué arreglar primero y por qué, (3) un siguiente paso concreto. Máximo ~150 palabras.
- findings: solo los hallazgos NUEVOS que confirmaste (puede ser una lista vacía).`;

const tools: Anthropic.Tool[] = [
  {
    name: "http_get",
    description: "Hace una petición GET de solo lectura a una ruta del MISMO origen autorizado y devuelve estado, cabeceras y un fragmento del cuerpo. La ruta debe empezar por '/'.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del mismo origen, p. ej. /robots.txt o /.well-known/security.txt" },
        reason: { type: "string", description: "Motivo breve de por qué la consultas (se muestra al usuario)." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_report",
    description: "Entrega el informe final y termina la auditoría.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumen claro para una persona no experta (ver instrucciones)." },
        findings: {
          type: "array",
          description: "Hallazgos NUEVOS confirmados (no repitas los deterministas).",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
              category: { type: "string" },
              location: { type: "string", description: "URL o ruta donde se observa." },
              description: { type: "string", description: "Qué es y por qué importa, en claro." },
              remediation: { type: "string", description: "Cómo arreglarlo, en un paso concreto." },
              cwe: { type: "string" },
            },
            required: ["title", "severity", "category", "location", "description", "remediation"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "findings"],
      additionalProperties: false,
    },
  },
];

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
}

async function runHttpGet(origin: string, input: unknown): Promise<string> {
  const path = typeof (input as { path?: unknown }).path === "string" ? (input as { path: string }).path : "";
  if (!path.startsWith("/")) {
    return JSON.stringify({ error: "La ruta debe empezar por '/' y pertenecer al origen autorizado." });
  }
  let target: URL;
  try {
    target = new URL(path, origin);
  } catch {
    return JSON.stringify({ error: "Ruta no válida." });
  }
  if (target.origin !== origin) {
    return JSON.stringify({ error: "Fuera de alcance: solo se permite el origen autorizado." });
  }
  const res = await safeRequest(target.toString(), { maxBytes: 64 * 1024 });
  if (!res.ok) return JSON.stringify({ status: 0, error: res.reason });

  const headers: Record<string, string> = {};
  for (const name of HEADERS_OF_INTEREST) {
    if (res.headers[name]) headers[name] = res.headers[name];
  }
  const isText = (res.headers["content-type"] ?? "").match(/text|json|xml|javascript|html/i);
  return JSON.stringify({
    status: res.status,
    headers,
    has_cookies: res.setCookies.length > 0,
    body_snippet: isText ? res.body.slice(0, BODY_SNIPPET) : "(contenido binario o no textual)",
    truncated: res.body.length > BODY_SNIPPET,
  });
}

function normalizeFindings(raw: unknown, deterministic: ScanFinding[]): ScanFinding[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(deterministic.map((f) => `${f.title.toLowerCase()}|${f.location.toLowerCase()}`));
  const out: ScanFinding[] = [];
  for (const item of raw) {
    const f = item as Record<string, unknown>;
    const title = typeof f.title === "string" ? f.title.trim() : "";
    const location = typeof f.location === "string" ? f.location.trim() : "";
    const severity = SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : "info";
    if (!title || !location) continue;
    const key = `${title.toLowerCase()}|${location.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      severity,
      category: typeof f.category === "string" && f.category ? f.category : "ia",
      cwe: typeof f.cwe === "string" && f.cwe ? f.cwe : undefined,
      location,
      description: typeof f.description === "string" ? f.description : "",
      remediation: typeof f.remediation === "string" ? f.remediation : "",
      evidence: { origen: "orquestador-ia" },
    });
  }
  return out;
}

export async function orchestrateScan(
  apiKey: string,
  level: Level,
  asset: Pick<Asset, "type" | "value">,
  deterministic: ScanFinding[],
): Promise<OrchestratorResult> {
  const logs: ScanLog[] = [];
  const log = (message: string, lvl: ScanLog["level"] = "info") => logs.push({ level: lvl, message });

  const base = targetBase(asset);
  if (!base) return { ok: false, reason: "El orquestador no aplica a este tipo de activo.", logs };
  const origin = base.origin;
  const model = LEVEL_MODEL[level];
  const maxRounds = ROUNDS[level];
  // baseURL opcional: permite a quien se autohospeda enrutar por su propio gateway/proxy.
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

  log(`El agente IA (${model}) empieza a investigar ${origin} en modo passive…`);

  const detSummary = deterministic.length === 0
    ? "Las comprobaciones deterministas no encontraron hallazgos."
    : deterministic.map((f) => `- [${f.severity}] ${f.title} (${f.location})`).join("\n");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Objetivo autorizado (único origen permitido): ${origin}

Hallazgos deterministas ya detectados (NO los repitas):
${detSummary}

Investiga de forma pasiva qué más se puede observar leyendo recursos públicos de ese origen. Cuando termines, llama a submit_report. Tienes un presupuesto limitado de exploración, así que prioriza lo de mayor riesgo.`,
    },
  ];

  let report: { summary: unknown; findings: unknown } | null = null;
  let round = 0;

  try {
    while (round <= maxRounds + 1) {
      const response = await client.messages.create({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        tools,
        ...(level === "economico" ? { output_config: { effort: "low" as const } } : {}),
        messages,
      });

      if (response.stop_reason === "refusal") {
        log("El agente se detuvo por una negativa del modelo.", "warn");
        break;
      }

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const submit = toolUses.find((t) => t.name === "submit_report");
      if (submit) {
        report = submit.input as { summary: unknown; findings: unknown };
        break;
      }
      if (toolUses.length === 0) {
        // El modelo terminó con texto: lo usamos como resumen, sin hallazgos extra.
        report = { summary: textOf(response.content), findings: [] };
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      // Presupuesto agotado: no ejecutamos más http_get; pedimos cierre o usamos lo que haya.
      if (round >= maxRounds) {
        const results: Anthropic.ToolResultBlockParam[] = toolUses.map((t) => ({
          type: "tool_result",
          tool_use_id: t.id,
          content: "Presupuesto de exploración agotado. No se harán más consultas.",
        }));
        messages.push({
          role: "user",
          content: [
            ...results,
            { type: "text", text: "Has alcanzado el límite de exploración. Llama ahora a submit_report con tus conclusiones (sin más http_get)." },
          ],
        });
        round++;
        continue;
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const t of toolUses) {
        if (t.name === "http_get") {
          const path = typeof (t.input as { path?: unknown }).path === "string" ? (t.input as { path: string }).path : "?";
          const reason = typeof (t.input as { reason?: unknown }).reason === "string" ? (t.input as { reason: string }).reason : "";
          const content = await runHttpGet(origin, t.input);
          let status = "?";
          try { status = String((JSON.parse(content) as { status?: number }).status ?? "?"); } catch { /* texto no JSON */ }
          log(`El agente consultó ${path}${reason ? ` — ${reason}` : ""} (HTTP ${status}).`);
          results.push({ type: "tool_result", tool_use_id: t.id, content });
        } else {
          results.push({ type: "tool_result", tool_use_id: t.id, is_error: true, content: "Herramienta no disponible." });
        }
      }
      messages.push({ role: "user", content: results });
      round++;
    }
  } catch (error) {
    const err = error as { status?: number };
    const reason = err.status === 401
      ? "La clave de Claude no es válida."
      : err.status === 429
        ? "Se alcanzó el límite de uso de Claude."
        : "No se pudo completar el análisis con IA.";
    log(`El orquestador IA falló: ${reason}`, "warn");
    return { ok: false, reason, logs };
  }

  if (!report) {
    log("El agente no entregó un informe dentro del presupuesto.", "warn");
    return { ok: false, reason: "El agente no entregó un informe.", logs };
  }

  const summary = typeof report.summary === "string" && report.summary.trim()
    ? report.summary.trim()
    : "El agente completó la revisión pasiva.";
  const findings = normalizeFindings(report.findings, deterministic);
  log(
    findings.length === 0
      ? "El agente entregó su informe: sin hallazgos nuevos."
      : `El agente entregó su informe: ${findings.length} hallazgo(s) nuevo(s).`,
  );

  return { ok: true, summary, model, findings, logs };
}
