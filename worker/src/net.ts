// Petición HTTP de solo lectura con protección anti-SSRF. Defensa en profundidad:
// aunque el host del worker tenga firewall de salida (lo exige el README), el worker
// nunca debe conectar a IPs privadas, de enlace local o de metadatos cloud, ni antes ni
// después de una redirección o de la resolución DNS. Espejo de la lógica de la web.
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

const TIMEOUT_MS = 6000;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [["2001::", 32], ["2001:db8::", 32], ["2002::", 16]] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");

export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) return globalIpv6.check(ip, "ipv6") && !blocked.check(ip, "ipv6");
  return false;
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
      return callback(Object.assign(new Error("destino no público"), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: typeof addresses) => void)(null, addresses);
    const first = addresses[0]!;
    callback(null, first.address, first.family);
  });
};

export type SafeResponse =
  | { ok: true; status: number; headers: Record<string, string>; setCookies: string[]; body: string; url: string }
  | { ok: false; reason: string };

export function safeRequest(
  rawUrl: string,
  opts: { method?: "GET" | "HEAD"; maxBytes?: number; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 512 * 1024;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Promise.resolve({ ok: false, reason: "URL no válida" });
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    return Promise.resolve({ ok: false, reason: "URL no permitida" });
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return Promise.resolve({ ok: false, reason: "Puerto no permitido" });
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicIp(host)) {
    return Promise.resolve({ ok: false, reason: "Destino no público" });
  }

  return new Promise((resolve) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: opts.method ?? "GET",
        agent: false,
        lookup: safeLookup,
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
        headers: { "User-Agent": "AuditForge-Worker/1.0", Accept: "*/*", ...opts.headers },
      },
      (response) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(response.headers)) {
          if (k === "set-cookie") continue;
          if (typeof v === "string") headers[k] = v;
          else if (Array.isArray(v)) headers[k] = v.join(", ");
        }
        const setCookies = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [];
        const status = response.statusCode ?? 0;
        if (opts.method === "HEAD") {
          response.resume();
          resolve({ ok: true, status, headers, setCookies, body: "", url: url.toString() });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            resolve({ ok: true, status, headers, setCookies, body: Buffer.concat(chunks).toString("utf8"), url: url.toString() });
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ ok: true, status, headers, setCookies, body: Buffer.concat(chunks).toString("utf8"), url: url.toString() }));
        response.on("error", () => resolve({ ok: false, reason: "Error de lectura" }));
      },
    );
    request.on("error", (error: NodeJS.ErrnoException) => {
      resolve({
        ok: false,
        reason: error.code === "EBLOCKED"
          ? "Destino no público"
          : error.name === "TimeoutError" || error.name === "AbortError"
            ? "Tiempo de espera agotado"
            : "No se pudo conectar",
      });
    });
    request.end();
  });
}
