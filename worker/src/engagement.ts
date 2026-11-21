// Seam de integración con el pack ofensivo (Claude-BugHunter). El worker NO reimplementa
// exploits: ORQUESTA el pack. Ejecuta un comando externo (el driver del pack) en un
// directorio de trabajo AISLADO y efímero, pasándole el objetivo YA ACOTADO y el modo por
// variables de entorno (nunca interpoladas en el comando: sin inyección desde el target), y
// lee los hallazgos del fichero del contrato que el driver debe escribir.
//
// El modo se impone aquí y en el firewall del host: recon/passive no deben lanzar pruebas
// intrusivas. Las skills hunt-* del pack solo entran en modo active (fase posterior).
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { FINDINGS_FILENAME, parseFindingsReport, type ContractFinding } from "./scan/contract.js";

export type EngagementLog = { level: "info" | "warn" | "error"; message: string };
export type EngagementResult = { ok: boolean; findings: ContractFinding[]; logs: EngagementLog[]; summary: string };

const MAX_LOG_LINES = 400;

export async function runEngagement(
  cmd: string,
  target: { type: string; value: string },
  mode: string,
  timeoutMs: number,
): Promise<EngagementResult> {
  const logs: EngagementLog[] = [];
  const log = (message: string, level: EngagementLog["level"] = "info") => {
    if (logs.length < MAX_LOG_LINES) logs.push({ level, message });
  };

  const workdir = await mkdtemp(join(tmpdir(), "af-engagement-"));
  const findingsFile = join(workdir, FINDINGS_FILENAME);

  log(`Motor del pack en marcha (${mode}) sobre ${target.value}.`);

  const exit = await new Promise<{ code: number | null; timedOut: boolean }>((resolve) => {
    const child = spawn(cmd, {
      cwd: workdir,
      shell: true,
      // El objetivo viaja por entorno, nunca concatenado al comando.
      env: {
        ...process.env,
        AF_TARGET_VALUE: target.value,
        AF_TARGET_TYPE: target.type,
        AF_MODE: mode,
        AF_WORKDIR: workdir,
        AF_FINDINGS_FILE: findingsFile,
      },
      timeout: timeoutMs,
      killSignal: "SIGTERM",
    });

    const pipe = (stream: NodeJS.ReadableStream | null, level: EngagementLog["level"]) => {
      if (!stream) return;
      createInterface({ input: stream }).on("line", (line) => {
        const text = line.trim();
        if (text) log(text.slice(0, 500), level);
      });
    };
    pipe(child.stdout, "info");
    pipe(child.stderr, "warn");

    child.on("error", (err) => {
      log(`No se pudo ejecutar el motor del pack: ${err.message}`, "error");
      resolve({ code: null, timedOut: false });
    });
    child.on("close", (code, signal) => {
      resolve({ code, timedOut: signal === "SIGTERM" });
    });
  });

  if (exit.timedOut) log("El motor del pack superó el tiempo máximo y se detuvo.", "warn");

  // Leer y validar el fichero del contrato, escriba o no un código de salida limpio.
  let findings: ContractFinding[] = [];
  let ok = false;
  try {
    const text = await readFile(findingsFile, "utf8");
    const parsed = parseFindingsReport(text);
    if (parsed.ok) {
      findings = parsed.findings;
      ok = true;
      log(`Hallazgos del pack leídos: ${findings.length}.`);
    } else {
      log(`Fichero de hallazgos no válido: ${parsed.reason}`, "error");
    }
  } catch {
    log("El motor del pack no dejó fichero de hallazgos.", "warn");
  }

  await rm(workdir, { recursive: true, force: true }).catch(() => {});

  const summary = ok ? `Pack (${mode}): ${findings.length} hallazgo(s).` : `El motor del pack no entregó hallazgos válidos (${mode}).`;
  return { ok, findings, logs, summary };
}
