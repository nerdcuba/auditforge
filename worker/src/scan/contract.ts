// Contrato de salida de hallazgos (CLAUDE.md §"Antes de integrar el pack", README §7).
//
// Claude-BugHunter NO emite findings en JSON: los escribe como Markdown con frontmatter,
// y solo el recon produce JSON (manifest.json, live-hosts.json). Por eso AuditForge FIJA
// su propio contrato: el worker instruye al agente para que, además de su trabajo, escriba
// TODOS los hallazgos confirmados como JSON en un fichero con ESTE esquema, y el worker lee
// y valida ese fichero (no parsea prosa). Cada hallazgo se mapea 1:1 a worker.submit_finding.
//
// Módulo puro: lo comparten el web y el worker.

export const CONTRACT_VERSION = "auditforge.findings/1";
export const FINDINGS_FILENAME = "auditforge-findings.json";

export type ContractSeverity = "info" | "low" | "medium" | "high" | "critical";
const SEVERITIES: readonly ContractSeverity[] = ["info", "low", "medium", "high", "critical"];

export type ContractFinding = {
  title: string;
  severity: ContractSeverity;
  category?: string;
  cwe?: string;
  location?: string;
  description?: string;
  remediation?: string;
  evidence?: Record<string, unknown>;
};

export type FindingsReport = {
  version: string;
  mode: "recon" | "passive" | "active";
  findings: ContractFinding[];
};

// Topes defensivos: el fichero lo produce un agente; no confiamos en su tamaño.
const MAX_FINDINGS = 200;
const MAX_STR = 4000;
const trim = (v: unknown, max = MAX_STR): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export type ParseResult =
  | { ok: true; mode: string; findings: ContractFinding[] }
  | { ok: false; reason: string };

/** Lee y valida el fichero de hallazgos. Descarta entradas mal formadas en vez de fallar entero. */
export function parseFindingsReport(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, reason: "el fichero de hallazgos no es JSON válido" };
  }
  const report = doc as Partial<FindingsReport>;
  if (!report || report.version !== CONTRACT_VERSION) {
    return { ok: false, reason: `versión de contrato inesperada (se esperaba ${CONTRACT_VERSION})` };
  }
  if (!Array.isArray(report.findings)) {
    return { ok: false, reason: "el campo 'findings' debe ser una lista" };
  }

  const findings: ContractFinding[] = [];
  for (const raw of report.findings.slice(0, MAX_FINDINGS)) {
    const f = raw as Record<string, unknown>;
    const title = trim(f.title, 300);
    if (!title) continue; // sin título no es un hallazgo utilizable
    const severity = SEVERITIES.includes(f.severity as ContractSeverity) ? (f.severity as ContractSeverity) : "info";
    const evidence =
      f.evidence && typeof f.evidence === "object" && !Array.isArray(f.evidence)
        ? (f.evidence as Record<string, unknown>)
        : undefined;
    findings.push({
      title,
      severity,
      category: trim(f.category, 60),
      cwe: trim(f.cwe, 20),
      location: trim(f.location, 1000),
      description: trim(f.description),
      remediation: trim(f.remediation),
      evidence,
    });
  }

  const mode = typeof report.mode === "string" ? report.mode : "";
  return { ok: true, mode, findings };
}

// Ejemplo e instrucciones que el worker inyecta en el prompt del agente, para que escriba
// el fichero en el formato exacto que el worker sabe leer.
export const CONTRACT_EXAMPLE: FindingsReport = {
  version: CONTRACT_VERSION,
  mode: "active",
  findings: [
    {
      title: "IDOR en /api/invoices/{id}",
      severity: "high",
      category: "control-de-acceso",
      cwe: "CWE-639",
      location: "https://ejemplo.com/api/invoices/1042",
      description: "Un usuario puede leer facturas de otros cambiando el id de la URL.",
      remediation: "Comprueba la propiedad del recurso en el servidor antes de devolverlo.",
      evidence: { request: "GET /api/invoices/1042", observed: "200 con datos de otro usuario" },
    },
  ],
};

export function findingsContractInstructions(): string {
  return [
    `Cuando termines, escribe TODOS los hallazgos confirmados como JSON en el fichero "${FINDINGS_FILENAME}" de tu directorio de trabajo.`,
    `El fichero debe seguir EXACTAMENTE este esquema (version "${CONTRACT_VERSION}"):`,
    JSON.stringify(CONTRACT_EXAMPLE, null, 2),
    `Severidades válidas: ${SEVERITIES.join(", ")}. Si no hay hallazgos, escribe una lista "findings" vacía.`,
    `No incluyas hallazgos sin confirmar ni prosa fuera del JSON. El fichero es la única salida que se leerá.`,
  ].join("\n\n");
}
