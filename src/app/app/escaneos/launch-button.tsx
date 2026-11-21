"use client";

import { Crosshair, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { LEVEL_HINT, LEVEL_LABEL, LEVELS, type Level } from "@/lib/scan/models";
import { launchScan, type LaunchState } from "./actions";

const idle: LaunchState = { status: "idle" };

function Button({ withAi, queued }: { withAi: boolean; queued: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-accent px-4 font-medium text-accent-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
    >
      <Crosshair size={15} aria-hidden />
      {pending
        ? queued ? "Encolando…" : withAi ? "Auditando con IA… (puede tardar)" : "Escaneando…"
        : queued ? "Encolar auditoría" : "Lanzar auditoría"}
    </button>
  );
}

export function LaunchScanButton({ assetId, defaultLevel, hasKey, queued = false }: { assetId: string; defaultLevel: Level; hasKey: boolean; queued?: boolean }) {
  const [state, action] = useActionState(launchScan, idle);
  const [level, setLevel] = useState<Level>(defaultLevel);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={assetId} />

      {queued ? (
        <p className="text-xs text-dim">
          El escaneo se ejecuta en el <strong className="text-fg">worker aislado</strong>; verás el progreso en vivo. El nivel y el análisis los decide el worker.
        </p>
      ) : hasKey ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-dim">
            <Sparkles size={12} className="text-accent" aria-hidden /> Nivel del análisis con IA
          </p>
          <input type="hidden" name="level" value={level} />
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Nivel del análisis con IA">
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLevel(l)}
                  title={LEVEL_HINT[l]}
                  className={`cursor-pointer rounded-control border px-2 py-1.5 text-xs transition-colors ${
                    active ? "border-accent/50 bg-accent/5 text-fg" : "border-line text-dim hover:bg-surface-2"
                  }`}
                >
                  {LEVEL_LABEL[l]}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-dim">{LEVEL_HINT[level]}</p>
        </div>
      ) : (
        <p className="text-xs text-dim">
          Sin clave de Claude, la auditoría es solo determinista. Conéctala en{" "}
          <Link href="/app/ajustes" className="text-fg underline underline-offset-2">Ajustes</Link>{" "}
          para activar el análisis con IA.
        </p>
      )}

      <Button withAi={hasKey} queued={queued} />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sev-critical">{state.message}</p>
      )}
      <p className="text-xs text-dim">Revisión no intrusiva (recon + passive): solo lee lo que tu web muestra públicamente.</p>
    </form>
  );
}
