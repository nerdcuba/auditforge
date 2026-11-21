import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeroBackdrop } from "@/components/marketing/backdrop";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const GATES = [
  { id: "01", name: "Propiedad", detail: "Demuestras que es tuyo con un registro DNS TXT o un fichero.", rule: "verificada" },
  { id: "02", name: "Allowlist", detail: "Decides qué activos verificados pueden escanearse.", rule: "autorizado" },
  { id: "03", name: "Modo", detail: "Recon y passive por defecto. Active exige confirmación.", rule: "permitido" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app");

  const { error } = await searchParams;

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_460px]">
      <section className="scope-grid relative order-2 flex flex-col justify-between gap-10 overflow-hidden border-t border-line p-6 lg:order-1 lg:border-t-0 lg:p-12">
        <HeroBackdrop />
        <p className="relative z-10 hidden font-mono text-sm font-medium tracking-wide text-accent lg:block">AUDITFORGE</p>

        <div className="relative z-10 max-w-[640px]">
          <h2 className="text-2xl leading-tight font-semibold tracking-tight lg:text-[40px]">
            Audita lo tuyo.
            <br />
            Nada más.
          </h2>
          <p className="mt-3 max-w-[480px] text-sm text-dim lg:text-base">
            Orquesta auditorías de seguridad sobre tus webs y proyectos, sigue cada hallazgo y corrígelo con evidencia.
          </p>

          <div className="mt-8 overflow-hidden rounded-panel border border-line bg-surface">
            <p className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-xs text-dim">
              <span>control de alcance</span>
              <span>3 puertas</span>
            </p>
            <ol className="divide-y divide-line">
              {GATES.map((gate) => (
                <li key={gate.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2 px-4 py-3 sm:grid-cols-[28px_96px_minmax(0,1fr)_84px] sm:items-center">
                  <span className="font-mono text-xs text-dim">{gate.id}</span>
                  <span className="font-medium">{gate.name}</span>
                  <span className="col-start-2 text-dim sm:col-start-3">{gate.detail}</span>
                  <span className="col-start-2 mt-1 font-mono text-xs text-accent sm:col-start-4 sm:mt-0 sm:text-right">{gate.rule}</span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line bg-surface-2 px-4 py-2.5 font-mono text-xs text-dim">
              si una puerta falla, el escaneo no corre
            </p>
          </div>
        </div>

        <p className="relative z-10 font-mono text-xs text-dim">
          Solo para activos propios y autorizados.{" "}
          <Link href="/legal" className="underline underline-offset-2 hover:text-fg">Términos</Link>.
        </p>
      </section>

      <main className="order-1 flex flex-col justify-center bg-surface p-6 lg:order-2 lg:border-l lg:border-line lg:p-12">
        <div className="mx-auto w-full max-w-[360px]">
          <p className="mb-8 font-mono text-sm font-medium tracking-wide text-accent lg:hidden">AUDITFORGE</p>
          <h1 className="text-xl font-semibold tracking-tight">Entrar al panel</h1>
          <p className="mt-1 mb-6 text-sm text-dim">
            Accede con tu correo y tu contraseña.
          </p>
          {error === "enlace" && (
            <p role="alert" className="mb-4 rounded-control border border-sev-critical/40 px-3 py-2 text-sev-critical">
              El enlace ha caducado o ya se usó. Pide otro.
            </p>
          )}
          <LoginForm />
          <p className="mt-6 border-t border-line pt-4 text-xs text-dim">
            Acceso solo por invitación. No hay registro público.
          </p>
        </div>
      </main>
    </div>
  );
}
