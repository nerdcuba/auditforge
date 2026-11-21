// Catálogo de comprobaciones del motor (recon/passive). Cada una se puede activar/desactivar.
export type Tool = { key: string; name: string; category: string; description: string };

export const TOOLS: Tool[] = [
  { key: "https", name: "HTTPS forzado", category: "transporte", description: "Comprueba que la versión http redirige a https." },
  { key: "headers", name: "Cabeceras de seguridad", category: "cabeceras", description: "CSP, HSTS, X-Frame-Options, nosniff y Referrer-Policy." },
  { key: "version", name: "Divulgación de versión", category: "divulgación", description: "Cabeceras Server y X-Powered-By que revelan el software." },
  { key: "cookies", name: "Cookies seguras", category: "cookies", description: "Flags Secure, HttpOnly y SameSite de las cookies." },
  { key: "cors", name: "Política CORS", category: "cors", description: "Orígenes permitidos y uso de credenciales." },
  { key: "exposed", name: "Ficheros expuestos", category: "exposición", description: "Busca .env, .git, .DS_Store accesibles públicamente." },
  { key: "secrets", name: "Secretos en JavaScript", category: "secretos", description: "Claves de API o tokens filtrados en el JS público." },
];

export const TOOL_KEYS = TOOLS.map((t) => t.key);

// Playbooks del agente (Claude-BugHunter). Informativo: llegan con el modo active y el worker.
export type SkillFamily = { name: string; tag: string; mode: "passive" | "active"; description: string };

export const SKILL_FAMILIES: SkillFamily[] = [
  { name: "Reconocimiento y OSINT", tag: "recon · osint", mode: "passive", description: "Mapeo de superficie, subdominios y exposición." },
  { name: "Cross-Site Scripting", tag: "hunt-xss", mode: "active", description: "Inyección de scripts (requiere pruebas intrusivas)." },
  { name: "Inyección SQL", tag: "hunt-sqli", mode: "active", description: "Acceso no autorizado a la base de datos." },
  { name: "SSRF", tag: "hunt-ssrf", mode: "active", description: "El servidor engañado para pedir recursos internos." },
  { name: "IDOR", tag: "hunt-idor", mode: "active", description: "Acceso a datos de otros usuarios." },
  { name: "Fallos de autenticación", tag: "hunt-auth-bypass", mode: "active", description: "Saltarse el login, OAuth o el doble factor." },
];
