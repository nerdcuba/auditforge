// AuditForge worker (v1 recon). Bucle: reclama un job firmado, VERIFICA el scope_token
// con la clave pública y lo compara con el payload, ejecuta recon pasivo y entrega
// hallazgos + logs. El modo active aún NO se ejecuta aquí (se rechaza de forma segura).
import { loadConfig, type WorkerConfig } from "./config.js";
import { WorkerDb, type ClaimedJob } from "./db.js";
import { runEngagement } from "./engagement.js";
import { runRecon } from "./recon.js";
import { verifyScopeToken, scopeMatches, type ScanMode } from "./scope/token.js";
import type { ContractFinding } from "./scan/contract.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type EngineOutput = { findings: ContractFinding[]; logs: { level: "info" | "warn" | "error"; message: string }[]; summary: string };

let running = true;

async function processJob(db: WorkerDb, cfg: WorkerConfig, job: ClaimedJob): Promise<void> {
  const workerId = cfg.workerId;
  const p = job.payload;

  // 1. Verificar firma y caducidad del token.
  const verified = verifyScopeToken(job.scopeToken, cfg.publicKeyPem);
  if (!verified.ok) {
    await db.reportScopeIncident(job.jobId, workerId, `token inválido: ${verified.reason}`);
    return;
  }
  // 2. El payload firmado debe coincidir con lo que la cola entrega.
  const expected = { scan_id: p.scan_id, asset_id: p.asset_id, value: p.value, mode: p.mode as ScanMode };
  if (!scopeMatches(verified.payload, expected)) {
    await db.reportScopeIncident(job.jobId, workerId, "el token no coincide con el objetivo del job");
    return;
  }

  // 3. ¿Seguimos autorizados? (cancelación o alcance revocado)
  if (!(await db.heartbeat(job.jobId, workerId))) {
    await db.finishJob(job.jobId, workerId, "cancelled", "Cancelado antes de empezar.", "worker-1");
    return;
  }

  // 4. Puerta de modo: v1 solo recon/passive. El modo active NO se ejecuta todavía
  //    (las skills intrusivas hunt-* del pack llegan en la fase active).
  if (p.mode === "active") {
    await db.appendLog(job.jobId, workerId, "warn", "El modo active aún no está soportado por este worker.");
    await db.finishJob(job.jobId, workerId, "failed", "Modo active no soportado aún por el worker.", "worker-recon-1");
    return;
  }

  // 5. Motor: si hay pack configurado (Claude-BugHunter), se orquesta en aislamiento;
  //    si no, recon pasivo interno. Ambos entregan hallazgos en el contrato compartido.
  const usePack = Boolean(cfg.engagementCmd);
  const engineVersion = usePack ? "worker-pack-1" : "worker-recon-1";
  await db.appendLog(job.jobId, workerId, "info",
    `Worker ${workerId}: alcance verificado. ${usePack ? "Orquestando el pack" : "Recon pasivo"} de ${p.value} (${p.mode}).`);

  const result: EngineOutput = usePack
    ? await runEngagement(cfg.engagementCmd!, { type: p.type, value: p.value }, p.mode, cfg.engagementTimeoutMs)
    : await runRecon({ type: p.type, value: p.value });
  for (const l of result.logs) await db.appendLog(job.jobId, workerId, l.level, l.message);

  // 6. Comprobar de nuevo antes de escribir hallazgos.
  if (!(await db.heartbeat(job.jobId, workerId))) {
    await db.finishJob(job.jobId, workerId, "cancelled", "Cancelado durante la ejecución.", engineVersion);
    return;
  }

  // 7. Entregar hallazgos (la BD calcula fingerprint, deduplica y guarda ocurrencia).
  for (const f of result.findings) await db.submitFinding(job.jobId, workerId, f);

  await db.finishJob(job.jobId, workerId, "done", result.summary, engineVersion);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const db = new WorkerDb(cfg.databaseUrl);
  console.log(`[worker] ${cfg.workerId} en marcha. Esperando jobs…`);

  const stop = async () => { running = false; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    let job: ClaimedJob | null = null;
    try {
      job = await db.claimJob(cfg.workerId);
    } catch (error) {
      console.error("[worker] error al reclamar job:", (error as Error).message);
      await sleep(cfg.pollIntervalMs);
      continue;
    }

    if (!job) {
      await sleep(cfg.pollIntervalMs);
      continue;
    }

    console.log(`[worker] job ${job.jobId} (scan ${job.scanId}) reclamado.`);
    try {
      await processJob(db, cfg, job);
      console.log(`[worker] job ${job.jobId} terminado.`);
    } catch (error) {
      const msg = (error as Error).message ?? "error desconocido";
      console.error(`[worker] job ${job.jobId} falló:`, msg);
      try {
        await db.appendLog(job.jobId, cfg.workerId, "error", `Error del worker: ${msg}`);
        await db.finishJob(job.jobId, cfg.workerId, "failed", "Error interno del worker.", "worker-1");
      } catch { /* la BD puede estar inaccesible; el lease caduca y el scan se relanza */ }
    }
  }

  await db.close();
  console.log("[worker] detenido.");
}

main().catch((error) => {
  console.error("[worker] fallo fatal:", error);
  process.exit(1);
});
