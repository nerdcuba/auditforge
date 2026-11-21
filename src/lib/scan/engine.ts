import "server-only";
import { safeRequest, type SafeResponse } from "@/lib/assets/network";
import type { Asset } from "@/lib/assets/types";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ScanFinding = {
  title: string;
  severity: Severity;
  category: string;
  cwe?: string;
  location: string;
  description: string;
  remediation: string;
  evidence?: Record<string, unknown>;
};

export type ScanLog = { level: "info" | "warn" | "error"; message: string };

export type ScanOutcome =
  | { ok: true; findings: ScanFinding[]; checks: number; summary: string; logs: ScanLog[] }
  | { ok: false; reason: string; logs: ScanLog[] };

const SENSITIVE_PATHS: { path: string; signature: RegExp; title: string }[] = [
  { path: "/.env", signature: /^[A-Z][A-Z0-9_]+=\S/m, title: "Fichero .env accesible" },
  { path: "/.git/config", signature: /\[core\]/, title: "Repositorio .git expuesto" },
  { path: "/.git/HEAD", signature: /^ref:\s/, title: "Repositorio .git expuesto" },
  { path: "/.svn/entries", signature: /^\d+\s*$/m, title: "Repositorio .svn expuesto" },
  { path: "/.DS_Store", signature: /Bud1/, title: "Fichero .DS_Store accesible" },
];

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /AKIA[0-9A-Z]{16}/, label: "clave de acceso de AWS" },
  { re: /AIza[0-9A-Za-z\-_]{35}/, label: "clave de API de Google" },
  { re: /sk_live_[0-9A-Za-z]{20,}/, label: "clave secreta de Stripe" },
  { re: /xox[baprs]-[0-9A-Za-z-]{10,}/, label: "token de Slack" },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: "clave privada" },
];

export function targetBase(asset: Pick<Asset, "type" | "value">): { httpsUrl: string; httpUrl: string | null; origin: string } | null {
  if (asset.type === "domain") {
    return { httpsUrl: `https://${asset.value}`, httpUrl: `http://${asset.value}`, origin: `https://${asset.value}` };
  }
  if (asset.type === "ip") {
    const host = asset.value.includes(":") ? `[${asset.value}]` : asset.value;
    return { httpsUrl: `https://${host}`, httpUrl: `http://${host}`, origin: `https://${host}` };
  }
  if (asset.type === "app") {
    try {
      const u = new URL(asset.value);
      return { httpsUrl: u.toString(), httpUrl: u.protocol === "http:" ? u.toString() : null, origin: u.origin };
    } catch {
      return null;
    }
  }
  return null; // repo: no aplica al escaneo web
}

function header(res: Extract<SafeResponse, { ok: true }>, name: string): string | undefined {
  return res.headers[name.toLowerCase()];
}

// Sigue un salto de redirección si apunta al mismo origen, para analizar la página real.
async function fetchMain(httpsUrl: string, origin: string): Promise<Extract<SafeResponse, { ok: true }> | null> {
  let res = await safeRequest(httpsUrl, { maxBytes: 512 * 1024 });
  if (!res.ok) return null;
  if (res.status >= 300 && res.status < 400) {
    const loc = header(res, "location");
    if (loc) {
      try {
        const next = new URL(loc, httpsUrl);
        if (next.origin === origin || next.hostname === new URL(origin).hostname) {
          const hop = await safeRequest(next.toString(), { maxBytes: 512 * 1024 });
          if (hop.ok && hop.status === 200) res = hop;
        }
      } catch {
        /* location no válida: nos quedamos con la respuesta original */
      }
    }
  }
  return res;
}

export type ScanOptions = { disabledTools?: string[] };

export async function runScan(asset: Pick<Asset, "type" | "value">, opts: ScanOptions = {}): Promise<ScanOutcome> {
  const base = targetBase(asset);
  if (!base) {
    return { ok: false, reason: "El escaneo web no se aplica a este tipo de activo en esta versión.", logs: [] };
  }

  const logs: ScanLog[] = [];
  const log = (message: string, level: ScanLog["level"] = "info") => logs.push({ level, message });

  // Herramientas desactivadas por el usuario en "Herramientas".
  const disabled = new Set(opts.disabledTools ?? []);
  let checks = 0;
  const on = (key: string): boolean => {
    if (disabled.has(key)) return false;
    checks += 1;
    return true;
  };

  log(`Resolviendo y conectando con ${base.origin}…`);
  const main = await fetchMain(base.httpsUrl, base.origin);
  if (!main) {
    log("No se pudo conectar con el objetivo por HTTPS.", "error");
    return { ok: false, reason: "No se pudo conectar con el objetivo por HTTPS.", logs };
  }
  log(`Objetivo alcanzable (respondió HTTP ${main.status}).`);

  const findings: ScanFinding[] = [];
  const add = (f: ScanFinding) => findings.push(f);
  const isHttps = base.origin.startsWith("https:");

  // 1. HTTPS forzado
  if (on("https")) {
    log("Comprobando si se fuerza HTTPS…");
    if (base.httpUrl) {
      const http = await safeRequest(base.httpUrl, { method: "GET", maxBytes: 4096 });
      if (http.ok && http.status === 200) {
        add({
          title: "Tu web no fuerza HTTPS",
          severity: "medium", category: "transporte", cwe: "CWE-319", location: base.httpUrl,
          description: "La versión sin cifrar (http://) responde en lugar de redirigir a https://. Alguien en la misma red podría leer o modificar el tráfico.",
          remediation: "Configura una redirección 301 de http a https y activa HSTS.",
        });
      }
    }
  } else {
    log("HTTPS forzado: comprobación desactivada.");
  }

  // 2. Cabeceras de seguridad
  if (on("headers")) {
  log("Analizando las cabeceras de seguridad…");
  const csp = header(main, "content-security-policy");
  if (!csp) {
    add({
      title: "Falta Content-Security-Policy",
      severity: "medium", category: "cabeceras", cwe: "CWE-693", location: base.origin,
      description: "Sin CSP, el navegador no limita de dónde se cargan los scripts. Facilita ataques de inyección de scripts (XSS).",
      remediation: "Añade una cabecera Content-Security-Policy que restrinja script-src, object-src y base-uri.",
    });
  }
  if (isHttps && !header(main, "strict-transport-security")) {
    add({
      title: "Falta HSTS",
      severity: "medium", category: "cabeceras", cwe: "CWE-319", location: base.origin,
      description: "Sin Strict-Transport-Security, un atacante puede intentar forzar una conexión sin cifrar la primera vez.",
      remediation: "Añade Strict-Transport-Security: max-age=31536000; includeSubDomains.",
    });
  }
  if (!header(main, "x-frame-options") && !/frame-ancestors/i.test(csp ?? "")) {
    add({
      title: "Tu web se puede incrustar en otra (clickjacking)",
      severity: "medium", category: "cabeceras", cwe: "CWE-1021", location: base.origin,
      description: "Sin X-Frame-Options ni frame-ancestors, otra web puede meter la tuya en un iframe y engañar a tus usuarios.",
      remediation: "Añade X-Frame-Options: DENY o frame-ancestors 'none' en tu CSP.",
    });
  }
  if ((header(main, "x-content-type-options") ?? "").toLowerCase() !== "nosniff") {
    add({
      title: "Falta X-Content-Type-Options",
      severity: "low", category: "cabeceras", cwe: "CWE-693", location: base.origin,
      description: "Sin nosniff, el navegador puede interpretar un fichero como un tipo distinto al declarado.",
      remediation: "Añade X-Content-Type-Options: nosniff.",
    });
  }
  if (!header(main, "referrer-policy")) {
    add({
      title: "Falta Referrer-Policy",
      severity: "info", category: "cabeceras", location: base.origin,
      description: "Sin Referrer-Policy, tu web puede filtrar a dónde navega el usuario a sitios de terceros.",
      remediation: "Añade Referrer-Policy: strict-origin-when-cross-origin.",
    });
  }
  } else {
    log("Cabeceras de seguridad: comprobación desactivada.");
  }

  // 3. Divulgación de versión
  if (on("version")) {
    const server = header(main, "server");
    const poweredBy = header(main, "x-powered-by");
    log("Comprobando divulgación de versión del servidor…");
    if ((server && /\d/.test(server)) || poweredBy) {
      add({
        title: "Revelas la versión del servidor o framework",
        severity: "low", category: "divulgación", cwe: "CWE-200", location: base.origin,
        description: "Las cabeceras Server o X-Powered-By exponen qué software y versión usas, lo que ayuda a un atacante a elegir el exploit.",
        remediation: "Oculta o reduce las cabeceras Server y X-Powered-By.",
        evidence: { server, "x-powered-by": poweredBy },
      });
    }
  } else {
    log("Divulgación de versión: comprobación desactivada.");
  }

  // 4. Cookies inseguras
  if (on("cookies")) {
  log(main.setCookies.length > 0 ? `Revisando ${main.setCookies.length} cookie(s)…` : "No se recibieron cookies.");
  for (const cookie of main.setCookies) {
    const name = cookie.split("=")[0]?.trim() ?? "cookie";
    const flags = cookie.toLowerCase();
    const problems: string[] = [];
    if (isHttps && !flags.includes("secure")) problems.push("sin Secure");
    if (!flags.includes("httponly")) problems.push("sin HttpOnly");
    if (!flags.includes("samesite")) problems.push("sin SameSite");
    if (problems.length > 0) {
      add({
        title: `Cookie insegura: ${name}`,
        severity: problems.some((p) => p !== "sin SameSite") ? "medium" : "low",
        category: "cookies", cwe: "CWE-614", location: base.origin,
        description: `La cookie "${name}" se envía ${problems.join(", ")}. Eso facilita que se robe la sesión o viaje sin cifrar.`,
        remediation: "Marca las cookies de sesión con Secure, HttpOnly y SameSite.",
      });
    }
  }
  } else {
    log("Cookies seguras: comprobación desactivada.");
  }

  // 5. CORS permisivo
  if (on("cors")) {
  log("Probando la política CORS…");
  const probeOrigin = "https://auditforge-probe.example";
  const cors = await safeRequest(base.origin, { headers: { Origin: probeOrigin } });
  if (cors.ok) {
    const acao = header(cors, "access-control-allow-origin");
    const acac = (header(cors, "access-control-allow-credentials") ?? "").toLowerCase() === "true";
    if (acao === probeOrigin && acac) {
      add({
        title: "CORS refleja cualquier origen con credenciales",
        severity: "high", category: "cors", cwe: "CWE-942", location: base.origin,
        description: "Tu servidor devuelve Access-Control-Allow-Origin con el origen que le mandan y permite credenciales. Otra web podría leer datos de tus usuarios autenticados.",
        remediation: "No reflejes el Origin recibido; usa una lista blanca de orígenes de confianza.",
      });
    } else if (acao === "*") {
      add({
        title: "CORS abierto a cualquier origen",
        severity: "low", category: "cors", cwe: "CWE-942", location: base.origin,
        description: "Access-Control-Allow-Origin: * permite que cualquier web haga peticiones. Es un problema si sirves datos privados.",
        remediation: "Restringe CORS a los orígenes que de verdad lo necesiten.",
      });
    }
  }
  } else {
    log("Política CORS: comprobación desactivada.");
  }

  // 6. Ficheros sensibles expuestos
  if (on("exposed")) {
  log("Buscando ficheros sensibles expuestos (.env, .git, .DS_Store…)…");
  const probes = await Promise.all(
    SENSITIVE_PATHS.map(async (p) => ({ p, res: await safeRequest(base.origin + p.path, { maxBytes: 8192 }) })),
  );
  for (const { p, res } of probes) {
    if (res.ok && res.status === 200 && !/<html/i.test(res.body) && p.signature.test(res.body)) {
      add({
        title: p.title,
        severity: "critical", category: "exposición", cwe: "CWE-538", location: base.origin + p.path,
        description: `El recurso ${p.path} es accesible públicamente y contiene datos internos. Puede filtrar credenciales o tu código fuente.`,
        remediation: "Bloquea el acceso a ese fichero o carpeta en el servidor y rota cualquier credencial expuesta.",
      });
    }
  }
  } else {
    log("Ficheros expuestos: comprobación desactivada.");
  }

  // 7. Secretos en el JavaScript público
  if (on("secrets")) {
  const scripts = [...main.body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((s): s is string => Boolean(s))
    .slice(0, 4);
  log(scripts.length > 0 ? `Analizando ${scripts.length} fichero(s) JavaScript en busca de secretos…` : "No se encontraron scripts externos que analizar.");
  for (const src of scripts) {
    let jsUrl: string;
    try {
      jsUrl = new URL(src, base.origin).toString();
    } catch {
      continue;
    }
    if (new URL(jsUrl).origin !== base.origin) continue;
    const js = await safeRequest(jsUrl, { maxBytes: 1024 * 1024 });
    if (!js.ok) continue;
    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(js.body)) {
        add({
          title: "Posible secreto en el JavaScript público",
          severity: "high", category: "secretos", cwe: "CWE-200", location: jsUrl,
          description: `Encontramos lo que parece una ${label} dentro de un fichero JavaScript servido a cualquier visitante. Las claves nunca deben ir en el código del navegador.`,
          remediation: "Quita la clave del código cliente, muévela al servidor y rótala cuanto antes.",
          evidence: { patron: label },
        });
        break;
      }
    }
  }
  } else {
    log("Secretos en JavaScript: comprobación desactivada.");
  }

  log(
    findings.length === 0
      ? `Escaneo completado: ${checks} comprobaciones, sin hallazgos.`
      : `Escaneo completado: ${checks} comprobaciones, ${findings.length} hallazgo(s).`,
    findings.length === 0 ? "info" : "warn",
  );
  const summary = findings.length === 0
    ? "Sin hallazgos en las comprobaciones pasivas. Buen punto de partida."
    : `${findings.length} hallazgo(s) en ${checks} comprobaciones.`;
  return { ok: true, findings, checks, summary, logs };
}
