import { Check, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { LEVEL_HINT, LEVEL_LABEL, LEVELS } from "@/lib/scan/models";
import { getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";
import { changeLevel, removeKey } from "./actions";
import { KeyForm } from "./key-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settings = await getMySettings(user.id);

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Panel title="Clave de Claude (Anthropic)">
          <div className="space-y-4 p-4">
            <p className="text-dim">
              El análisis con IA usa tu propia clave de Claude. Se guarda <strong className="text-fg">cifrada</strong> y
              solo se usa en el servidor; nunca se muestra ni viaja al navegador. Tú gestionas y pagas ese consumo.
            </p>

            {settings.hasKey && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-accent/30 bg-accent/5 px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Check size={15} className="text-accent" aria-hidden />
                  Clave configurada
                  <span className="font-mono text-xs text-dim">sk-ant-…{settings.keyHint}</span>
                </span>
                <form action={removeKey}>
                  <button type="submit" className="inline-flex h-8 cursor-pointer items-center rounded-control border border-line px-3 text-fg hover:bg-surface-2">
                    Quitar clave
                  </button>
                </form>
              </div>
            )}

            <KeyForm hasKey={settings.hasKey} />

            <p className="flex items-center gap-1.5 text-xs text-dim">
              <KeyRound size={13} aria-hidden />
              ¿No tienes clave? Créala en{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2">
                console.anthropic.com
              </a>
            </p>
          </div>
        </Panel>

        <Panel title="Nivel por defecto">
          <div className="space-y-3 p-4">
            <p className="text-dim">
              Controla qué modelo de Claude usa el análisis: más barato para revisiones frecuentes, más potente para lo
              complejo. Puedes cambiarlo en cada escaneo.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map((level) => {
                const active = settings.defaultLevel === level;
                return (
                  <form key={level} action={changeLevel}>
                    <input type="hidden" name="level" value={level} />
                    <button
                      type="submit"
                      aria-pressed={active}
                      className={`w-full cursor-pointer rounded-panel border p-3 text-left transition-colors ${
                        active ? "border-accent/50 bg-accent/5" : "border-line hover:bg-surface-2"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium">{LEVEL_LABEL[level]}</span>
                        {active && <Check size={14} className="text-accent" aria-hidden />}
                      </span>
                      <span className="mt-1 block text-xs text-dim">{LEVEL_HINT[level]}</span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Motor de escaneo">
          <div className="p-4 text-dim">
            <p>
              Las comprobaciones recon y passive (cabeceras, cookies, CORS, ficheros expuestos, secretos) funcionan sin
              clave. Con clave configurada se activa el <strong className="text-fg">orquestador IA</strong>: un agente de
              Claude que, en modo passive y solo sobre tu activo autorizado, investiga de forma adaptativa, añade
              hallazgos nuevos y te explica y prioriza qué arreglar. El nivel elige el modelo y la profundidad.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
