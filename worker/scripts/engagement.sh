#!/usr/bin/env bash
# Driver del pack Claude-BugHunter para el worker de AuditForge.
#
# El worker invoca este script en un directorio AISLADO y efímero, con el objetivo YA ACOTADO
# en variables de entorno (nunca en argumentos construidos a mano). El script orquesta el pack
# y DEBE escribir los hallazgos en "$AF_FINDINGS_FILE" con el contrato auditforge.findings/1.
#
# AuditForge ORQUESTA el pack; no reimplementa exploits. El modo manda:
#   recon/passive -> solo recon no intrusivo del pack (cbh recon/surface). NUNCA hunt-*.
#   active        -> aún no soportado por el worker (lo rechaza antes de llegar aquí).
#
# Entorno que recibe: AF_TARGET_VALUE, AF_TARGET_TYPE, AF_MODE, AF_WORKDIR, AF_FINDINGS_FILE.
set -euo pipefail

echo "[engagement] objetivo=$AF_TARGET_VALUE modo=$AF_MODE"

if [ "$AF_MODE" = "active" ]; then
  echo "[engagement] modo active no soportado por este worker." >&2
  exit 2
fi

# 1) Recon del pack (determinista, no intrusivo). Escribe en $AF_WORKDIR/recon/.
if command -v cbh >/dev/null 2>&1; then
  echo "[engagement] ejecutando cbh recon…"
  cbh recon "$AF_TARGET_VALUE" --out "$AF_WORKDIR/recon" || echo "[engagement] cbh recon terminó con avisos"
else
  echo "[engagement] cbh no está instalado en la imagen; solo se emite un informe vacío." >&2
fi

# 2) Convertir la salida del recon (manifest.json, live-hosts.json, RECON_SUMMARY.md) en
#    hallazgos del contrato. FINALIZAR EN EL WORKER DESPLEGADO: el esquema exacto de la salida
#    de cbh se fija leyendo el repo del pack en el commit que fijes (ver Dockerfile PACK_COMMIT).
#    Hasta entonces, se emite un informe válido vacío para que el pipeline del worker complete.
#
#    Para modo active, aquí se invocaría Claude Code con las skills hunt-* del pack, instruyéndole
#    con findingsContractInstructions() para que escriba $AF_FINDINGS_FILE. (Fase posterior.)
cat > "$AF_FINDINGS_FILE" <<JSON
{
  "version": "auditforge.findings/1",
  "mode": "$AF_MODE",
  "findings": []
}
JSON

echo "[engagement] informe escrito en $AF_FINDINGS_FILE"
