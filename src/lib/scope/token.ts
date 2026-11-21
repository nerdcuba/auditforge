// scope_token — el contrato de confianza entre el web (firma) y el worker (verifica).
//
// Es un JWS compacto (estilo JWT) firmado con Ed25519 (EdDSA). El web tiene la clave
// PRIVADA y firma; el worker solo tiene la PÚBLICA y verifica, de modo que un worker
// comprometido no puede emitir tokens. El payload ata el job a un objetivo EXACTO:
// {jti, scan_id, asset_id, value, mode, exp}. Ver README §5 y CLAUDE.md regla 2.
//
// Módulo puro (solo node:crypto): lo importan tanto el web como el worker. No lee env
// ni toca Supabase; quien llama aporta las claves.
import { createPrivateKey, createPublicKey, randomUUID, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

export type ScanMode = "recon" | "passive" | "active";
export const SCAN_MODES: readonly ScanMode[] = ["recon", "passive", "active"];

export type ScopePayload = {
  jti: string;
  scan_id: string;
  asset_id: string;
  value: string;
  mode: ScanMode;
  exp: number; // segundos unix
};

const MAX_TTL_MS = 60 * 60 * 1000; // 1 hora: el máximo que acepta launch_scan.
const HEADER_B64 = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SignedScope = { token: string; jti: string; expiresAt: Date };

/** Firma un scope_token. ttlMs se acota a 1 hora (lo que exige la BD). */
export function signScopeToken(
  input: { scan_id: string; asset_id: string; value: string; mode: ScanMode },
  privateKeyPem: string,
  ttlMs = 15 * 60 * 1000,
): SignedScope {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("la clave de firma no es Ed25519");
  const ttl = Math.min(Math.max(ttlMs, 60 * 1000), MAX_TTL_MS);
  const jti = randomUUID();
  const expMs = Date.now() + ttl;
  const payload: ScopePayload = { jti, ...input, exp: Math.floor(expMs / 1000) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${HEADER_B64}.${body}`;
  const sig = cryptoSign(null, Buffer.from(signingInput), key).toString("base64url");
  return { token: `${signingInput}.${sig}`, jti, expiresAt: new Date(expMs) };
}

export type VerifyResult = { ok: true; payload: ScopePayload } | { ok: false; reason: string };

/** Verifica firma, estructura y caducidad. No comprueba el objetivo: usa scopeMatches. */
export function verifyScopeToken(token: string, publicKeyPem: string, now: number = Date.now()): VerifyResult {
  const parts = token.split(".");
  const [header, body, signature] = parts;
  if (parts.length !== 3 || !header || !body || !signature) {
    return { ok: false, reason: "formato de token inválido" };
  }
  if (header !== HEADER_B64) return { ok: false, reason: "cabecera no soportada" };

  let valid = false;
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return { ok: false, reason: "clave pública no es Ed25519" };
    valid = cryptoVerify(null, Buffer.from(`${header}.${body}`), key, Buffer.from(signature, "base64url"));
  } catch {
    return { ok: false, reason: "no se pudo verificar la firma" };
  }
  if (!valid) return { ok: false, reason: "firma inválida" };

  let payload: ScopePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "payload ilegible" };
  }
  if (
    !payload ||
    !UUID_RE.test(payload.jti) || !UUID_RE.test(payload.scan_id) || !UUID_RE.test(payload.asset_id) ||
    typeof payload.value !== "string" || !SCAN_MODES.includes(payload.mode) || typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "payload incompleto o mal formado" };
  }
  if (payload.exp * 1000 <= now) return { ok: false, reason: "token caducado" };
  return { ok: true, payload };
}

/** Compara el payload firmado con lo que el worker lee de la cola. Todo debe coincidir. */
export function scopeMatches(
  payload: ScopePayload,
  expected: { scan_id: string; asset_id: string; value: string; mode: ScanMode; jti?: string },
): boolean {
  return (
    payload.scan_id === expected.scan_id &&
    payload.asset_id === expected.asset_id &&
    payload.value === expected.value &&
    payload.mode === expected.mode &&
    (expected.jti === undefined || payload.jti === expected.jti)
  );
}

/** Deriva la clave pública SPKI PEM de una privada. Útil para repartir la pública al worker. */
export function derivePublicKeyPem(privateKeyPem: string): string {
  return createPublicKey(createPrivateKey(privateKeyPem)).export({ type: "spki", format: "pem" }).toString();
}
