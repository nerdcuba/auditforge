function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export type WorkerConfig = {
  databaseUrl: string;      // conexión Postgres con el rol auditforge_worker
  publicKeyPem: string;     // clave pública Ed25519 (SPKI PEM) que verifica los scope_token
  workerId: string;
  pollIntervalMs: number;
  // Comando del motor de engagement (el pack Claude-BugHunter). Si está vacío, el worker usa
  // su recon pasivo interno. El comando corre en un directorio aislado y DEBE escribir los
  // hallazgos en el fichero del contrato (auditforge-findings.json).
  engagementCmd: string | null;
  engagementTimeoutMs: number;
};

export function loadConfig(): WorkerConfig {
  // La pública puede venir con \n escapados si se pega en una sola línea en Coolify.
  const publicKeyPem = required("SCOPE_TOKEN_PUBLIC_KEY").replace(/\\n/g, "\n");
  return {
    databaseUrl: required("WORKER_DATABASE_URL"),
    publicKeyPem,
    workerId: process.env.WORKER_ID || "worker-1",
    pollIntervalMs: Number(process.env.WORKER_POLL_MS || 3000),
    engagementCmd: process.env.ENGAGEMENT_CMD?.trim() || null,
    engagementTimeoutMs: Number(process.env.ENGAGEMENT_TIMEOUT_MS || 10 * 60 * 1000),
  };
}
