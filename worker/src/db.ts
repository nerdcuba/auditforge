// Acceso a Postgres como rol auditforge_worker. SOLO llama a funciones del esquema worker
// (no tiene acceso directo a tablas). Todas las puertas de alcance las impone la BD.
import pg from "pg";
import type { ContractFinding } from "./scan/contract.js";

export type ClaimedJob = {
  jobId: string;
  scanId: string;
  scopeToken: string;
  payload: { scan_id: string; asset_id: string; type: string; value: string; mode: string };
  leaseExpiresAt: Date;
};

export class WorkerDb {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000 });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async claimJob(workerId: string): Promise<ClaimedJob | null> {
    const { rows } = await this.pool.query(
      "select job_id, scan_id, scope_token, payload, lease_expires_at from worker.claim_job($1)",
      [workerId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      jobId: r.job_id,
      scanId: r.scan_id,
      scopeToken: r.scope_token,
      payload: r.payload,
      leaseExpiresAt: new Date(r.lease_expires_at),
    };
  }

  // false => el worker debe parar (cancelación o alcance revocado).
  async heartbeat(jobId: string, workerId: string): Promise<boolean> {
    const { rows } = await this.pool.query("select worker.heartbeat($1, $2) as alive", [jobId, workerId]);
    return rows[0]?.alive === true;
  }

  async appendLog(jobId: string, workerId: string, level: string, message: string): Promise<void> {
    await this.pool.query("select worker.append_log($1, $2, $3, $4)", [jobId, workerId, level, message]);
  }

  async submitFinding(jobId: string, workerId: string, f: ContractFinding): Promise<void> {
    await this.pool.query(
      `select worker.submit_finding($1, $2, $3, $4::public.severity, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        jobId, workerId, f.title, f.severity,
        f.category ?? null, f.cwe ?? null, f.location ?? null, f.description ?? null,
        f.evidence ? JSON.stringify(f.evidence) : null, f.remediation ?? null,
      ],
    );
  }

  async finishJob(jobId: string, workerId: string, status: "done" | "failed" | "cancelled", summary: string | null, engineVersion: string | null): Promise<void> {
    await this.pool.query("select worker.finish_job($1, $2, $3, $4, $5)", [jobId, workerId, status, summary, engineVersion]);
  }

  async reportScopeIncident(jobId: string, workerId: string, reason: string): Promise<void> {
    await this.pool.query("select worker.report_scope_incident($1, $2, $3)", [jobId, workerId, reason]);
  }
}
