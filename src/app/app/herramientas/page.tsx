import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { SKILL_FAMILIES, TOOLS } from "@/lib/scan/tools";
import { getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";
import { ToolToggle } from "./tool-toggle";

export const metadata: Metadata = { title: "Herramientas" };

export default async function ToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settings = await getMySettings(user.id);
  const disabled = new Set(settings.disabledTools);
  const activeCount = TOOLS.length - TOOLS.filter((t) => disabled.has(t.key)).length;

  return (
    <>
      <PageHeader title="Herramientas" meta={`${activeCount}/${TOOLS.length} activas`} />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Panel title="Comprobaciones del motor (recon · passive)">
          <div className="p-4 pb-2 text-dim">
            <p>
              Son las comprobaciones que corre AuditForge en cada escaneo. No son intrusivas: solo leen respuestas
              públicas. Desactiva las que no te interesen y no se ejecutarán ni gastarán tiempo.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {TOOLS.map((tool) => {
              const enabled = !disabled.has(tool.key);
              return (
                <li key={tool.key} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tool.name}</span>
                      <span className="rounded-[4px] border border-line px-1.5 font-mono text-[10px] text-dim">{tool.category}</span>
                    </div>
                    <p className="mt-0.5 text-dim">{tool.description}</p>
                  </div>
                  <ToolToggle toolKey={tool.key} enabled={enabled} />
                </li>
              );
            })}
          </ul>
          {activeCount === 0 && (
            <EmptyState
              title="No queda ninguna comprobación activa"
              detail="Con todo desactivado, un escaneo se conectará al objetivo pero no revisará nada. Activa al menos una."
            />
          )}
        </Panel>

        <Panel
          title="Librería de skills del agente"
          action={<span className="inline-flex items-center gap-1 font-mono text-[10px] text-accent"><Sparkles size={11} aria-hidden /> PRÓXIMAMENTE</span>}
        >
          <div className="p-4 pb-2 text-dim">
            <p>
              Cuando llegue el <strong className="text-fg">orquestador con IA</strong> y el modo <strong className="text-fg">active</strong>,
              el agente podrá elegir playbooks del pack Claude-BugHunter según el objetivo. Las intrusivas exigirán
              propiedad verificada, autorización explícita y el worker aislado.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {SKILL_FAMILIES.map((fam) => (
              <li key={fam.tag} className="flex items-start justify-between gap-4 px-4 py-3 opacity-80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fam.name}</span>
                    <span className="font-mono text-[10px] text-dim">{fam.tag}</span>
                  </div>
                  <p className="mt-0.5 text-dim">{fam.description}</p>
                </div>
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-[4px] border px-1.5 font-mono text-[10px] ${
                    fam.mode === "active" ? "border-sev-medium/50 text-sev-medium" : "border-accent/40 text-accent"
                  }`}
                >
                  {fam.mode === "active" ? "ACTIVE" : "PASSIVE"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <p className="px-1 text-xs text-dim">
          AuditForge orquesta herramientas de terceros; tú eres responsable de auditar solo activos propios o
          autorizados. Consulta los <a href="/legal" className="text-fg underline underline-offset-2">términos y el uso responsable</a>.
        </p>
      </div>
    </>
  );
}
