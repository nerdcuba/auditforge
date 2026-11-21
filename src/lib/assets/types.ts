export const ASSET_TYPES = ["domain", "repo", "ip", "app"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const VERIFICATION_METHODS = ["dns_txt", "well_known", "repo_file"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export type Asset = {
  id: string;
  label: string;
  type: AssetType;
  value: string;
  ownership_verified: boolean;
  verification_method: VerificationMethod | null;
  verification_token: string;
  verified_at: string | null;
  verification_expires_at: string | null;
  allowlisted: boolean;
  active_mode_enabled: boolean;
  scope_notes: string | null;
  created_at: string;
};

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };
export type OwnershipStatus = "pending" | "verified" | "expired";

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  domain: "Dominio",
  repo: "Repositorio",
  ip: "IP",
  app: "Aplicación",
};

export const ASSET_TYPE_PLACEHOLDER: Record<AssetType, string> = {
  domain: "app.tudominio.com",
  repo: "https://github.com/usuario/repo",
  ip: "203.0.113.10",
  app: "https://app.tudominio.com",
};

export const METHOD_LABEL: Record<VerificationMethod, string> = {
  dns_txt: "DNS TXT",
  well_known: "Fichero web",
  repo_file: "Fichero en repo",
};

export const METHODS_BY_TYPE: Record<AssetType, VerificationMethod[]> = {
  domain: ["dns_txt", "well_known"],
  repo: ["repo_file"],
  ip: ["well_known"],
  app: ["well_known"],
};

export function ownershipStatus(
  asset: Pick<Asset, "ownership_verified" | "verification_expires_at">,
  now: number,
): OwnershipStatus {
  if (!asset.ownership_verified) return "pending";
  if (!asset.verification_expires_at || new Date(asset.verification_expires_at).getTime() <= now) return "expired";
  return "verified";
}

export function expectedProof(token: string): string {
  return `auditforge-verify=${token}`;
}

export function wellKnownUrl(asset: Pick<Asset, "type" | "value">): string | null {
  const path = "/.well-known/auditforge.txt";
  if (asset.type === "domain") return `https://${asset.value}${path}`;
  if (asset.type === "ip") return `http://${asset.value.includes(":") ? `[${asset.value}]` : asset.value}${path}`;
  if (asset.type === "app") return `${new URL(asset.value).origin}${path}`;
  return null;
}
