import "server-only";
import { createHash } from "node:crypto";
import { getDomain } from "tldts";

export type DnsProofName = { full: string; relative: string };

const PREFIX = "_auditforge";
const MAX_LABEL = 63;

// El registro nunca se crea en el propio subdominio ni debajo de él: cualquiera de los dos
// casos anularía un comodín DNS (*.dominio) y dejaría el subdominio sin resolver.
export function dnsProofName(domain: string): DnsProofName | null {
  const zone = getDomain(domain, { allowPrivateDomains: true });
  if (!zone) return null;
  if (domain === zone) return { full: `${PREFIX}.${zone}`, relative: PREFIX };

  const subdomain = domain.slice(0, -(zone.length + 1));
  const flat = `${PREFIX}-${subdomain.replaceAll(".", "-")}`;
  const label = flat.length <= MAX_LABEL
    ? flat
    : `${PREFIX}-${createHash("sha256").update(subdomain).digest("hex").slice(0, 32)}`;
  return { full: `${label}.${zone}`, relative: label };
}
