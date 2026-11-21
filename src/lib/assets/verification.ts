import "server-only";
import { Resolver } from "node:dns/promises";
import { dnsProofName } from "./dns-name";
import { fetchProof } from "./network";
import { expectedProof, METHODS_BY_TYPE, wellKnownUrl, type Asset, type VerificationMethod } from "./types";

export type VerificationResult = { ok: true } | { ok: false; message: string };

async function checkDns(domain: string, expected: string): Promise<VerificationResult> {
  const name = dnsProofName(domain);
  if (!name) return { ok: false, message: "No se pudo determinar la zona DNS de este dominio." };
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  try {
    const records = await resolver.resolveTxt(name.full);
    if (records.some((chunks) => chunks.join("").trim() === expected)) return { ok: true };
    return { ok: false, message: "No encontramos el registro TXT. Si acabas de crearlo, espera a que se propague." };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND") {
      return { ok: false, message: "No encontramos el registro TXT. Si acabas de crearlo, espera a que se propague." };
    }
    return { ok: false, message: "No se pudo consultar el DNS. Inténtalo de nuevo." };
  }
}

async function checkFile(url: string, expected: string): Promise<VerificationResult> {
  const result = await fetchProof(url);
  if (!result.ok) return { ok: false, message: result.reason };
  if (result.body.trim() !== expected) return { ok: false, message: "El fichero existe, pero su contenido no coincide." };
  return { ok: true };
}

export function repoProofUrl(value: string): string | null {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || !segments.every((segment) => /^[\w.-]+$/.test(segment) && !/^\.+$/.test(segment))) {
    return null;
  }
  if (url.hostname === "github.com" && segments.length === 2) {
    return `https://raw.githubusercontent.com/${segments.join("/")}/HEAD/auditforge-verify.txt`;
  }
  if (url.hostname === "gitlab.com") {
    return `https://gitlab.com/${segments.join("/")}/-/raw/HEAD/auditforge-verify.txt`;
  }
  return null;
}

export async function checkOwnership(
  asset: Pick<Asset, "type" | "value" | "verification_token">,
  method: VerificationMethod,
): Promise<VerificationResult> {
  if (!METHODS_BY_TYPE[asset.type].includes(method)) {
    return { ok: false, message: "Ese método no sirve para este tipo de activo." };
  }
  const expected = expectedProof(asset.verification_token);

  if (method === "dns_txt") return checkDns(asset.value, expected);
  if (method === "repo_file") {
    const url = repoProofUrl(asset.value);
    if (!url) return { ok: false, message: "Solo se pueden verificar repos públicos de GitHub o GitLab." };
    return checkFile(url, expected);
  }
  const url = wellKnownUrl(asset);
  if (!url) return { ok: false, message: "Ese método no sirve para este tipo de activo." };
  return checkFile(url, expected);
}
