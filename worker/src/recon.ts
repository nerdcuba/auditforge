// Recon pasivo del worker (v1). Solo LEE recursos públicos del objetivo ya acotado.
// Produce hallazgos en el contrato compartido. Es el punto donde, más adelante, se
// enchufan las skills de Claude-BugHunter (recon primero, hunt-* solo en modo active).
import type { ContractFinding } from "./scan/contract.js";
import { safeRequest, type SafeResponse } from "./net.js";

export type ReconLog = { level: "info" | "warn" | "error"; message: string };
export type ReconResult = { findings: ContractFinding[]; logs: ReconLog[]; summary: string };

type Target = { type: string; value: string };

function origin(target: Target): string | null {
  if (target.type === "domain") return `https://${target.value}`;
  if (target.type === "ip") return `https://${target.value.includes(":") ? `[${target.value}]` : target.value}`;
  if (target.type === "app") {
    try { return new URL(target.value).origin; } catch { return null; }
  }
  return null; // repo: no aplica al recon web
}

const header = (r: Extract<SafeResponse, { ok: true }>, name: string) => r.headers[name.toLowerCase()];

const SENSITIVE: { path: string; sig: RegExp; title: string }[] = [
  { path: "/.env", sig: /^[A-Z][A-Z0-9_]+=\S/m, title: "Fichero .env accesible" },
  { path: "/.git/config", sig: /\[core\]/, title: "Repositorio .git expuesto" },
  { path: "/.git/HEAD", sig: /^ref:\s/, title: "Repositorio .git expuesto" },
  { path: "/.DS_Store", sig: /Bud1/, title: "Fichero .DS_Store accesible" },
];

export async function runRecon(target: Target): Promise<ReconResult> {
  const logs: ReconLog[] = [];
  const log = (message: string, level: ReconLog["level"] = "info") => logs.push({ level, message });
  const findings: ContractFinding[] = [];
  const add = (f: ContractFinding) => findings.push(f);

  const base = origin(target);
  if (!base) {
    return { findings, logs: [{ level: "warn", message: "El recon web no aplica a este activo." }], summary: "Recon no aplicable." };
  }

  log(`Conectando con ${base}…`);
  const main = await safeRequest(base, { maxBytes: 512 * 1024 });
  if (!main.ok) {
    log(`No se pudo conectar: ${main.reason}`, "error");
    return { findings, logs, summary: `No se pudo conectar con ${base}.` };
  }
  log(`Objetivo alcanzable (HTTP ${main.status}).`);
  const isHttps = base.startsWith("https:");

  // Cabeceras de seguridad
  log("Analizando cabeceras de seguridad…");
  const csp = header(main, "content-security-policy");
  if (!csp) add({
    title: "Falta Content-Security-Policy", severity: "medium", category: "cabeceras", cwe: "CWE-693", location: base,
    description: "Sin CSP, el navegador no limita de dónde se cargan los scripts; facilita ataques de inyección (XSS).",
    remediation: "Añade una cabecera Content-Security-Policy que restrinja script-src, object-src y base-uri.",
  });
  if (isHttps && !header(main, "strict-transport-security")) add({
    title: "Falta HSTS", severity: "medium", category: "cabeceras", cwe: "CWE-319", location: base,
    description: "Sin Strict-Transport-Security, un atacante puede intentar forzar una conexión sin cifrar la primera vez.",
    remediation: "Añade Strict-Transport-Security: max-age=31536000; includeSubDomains.",
  });
  if (!header(main, "x-frame-options") && !/frame-ancestors/i.test(csp ?? "")) add({
    title: "Tu web se puede incrustar en otra (clickjacking)", severity: "medium", category: "cabeceras", cwe: "CWE-1021", location: base,
    description: "Sin X-Frame-Options ni frame-ancestors, otra web puede meter la tuya en un iframe y engañar a tus usuarios.",
    remediation: "Añade X-Frame-Options: DENY o frame-ancestors 'none' en tu CSP.",
  });
  if ((header(main, "x-content-type-options") ?? "").toLowerCase() !== "nosniff") add({
    title: "Falta X-Content-Type-Options", severity: "low", category: "cabeceras", cwe: "CWE-693", location: base,
    description: "Sin nosniff, el navegador puede interpretar un fichero como un tipo distinto al declarado.",
    remediation: "Añade X-Content-Type-Options: nosniff.",
  });
  if (!header(main, "referrer-policy")) add({
    title: "Falta Referrer-Policy", severity: "info", category: "cabeceras", location: base,
    description: "Sin Referrer-Policy, tu web puede filtrar a dónde navega el usuario a sitios de terceros.",
    remediation: "Añade Referrer-Policy: strict-origin-when-cross-origin.",
  });

  // Divulgación de versión
  const server = header(main, "server");
  const poweredBy = header(main, "x-powered-by");
  if ((server && /\d/.test(server)) || poweredBy) add({
    title: "Revelas la versión del servidor o framework", severity: "low", category: "divulgación", cwe: "CWE-200", location: base,
    description: "Las cabeceras Server o X-Powered-By exponen qué software y versión usas, lo que ayuda a elegir el exploit.",
    remediation: "Oculta o reduce las cabeceras Server y X-Powered-By.",
    evidence: { server, "x-powered-by": poweredBy },
  });

  // Ficheros sensibles expuestos
  log("Buscando ficheros sensibles expuestos…");
  const probes = await Promise.all(SENSITIVE.map(async (p) => ({ p, res: await safeRequest(base + p.path, { maxBytes: 8192 }) })));
  for (const { p, res } of probes) {
    if (res.ok && res.status === 200 && !/<html/i.test(res.body) && p.sig.test(res.body)) add({
      title: p.title, severity: "critical", category: "exposición", cwe: "CWE-538", location: base + p.path,
      description: `El recurso ${p.path} es accesible públicamente y contiene datos internos. Puede filtrar credenciales o código fuente.`,
      remediation: "Bloquea el acceso a ese fichero o carpeta en el servidor y rota cualquier credencial expuesta.",
    });
  }

  const summary = findings.length === 0
    ? "Recon pasivo sin hallazgos. Buen punto de partida."
    : `Recon pasivo: ${findings.length} hallazgo(s).`;
  log(summary);
  return { findings, logs, summary };
}
