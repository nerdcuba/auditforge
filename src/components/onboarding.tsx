import { ArrowRight, Check, KeyRound, Lock } from "lucide-react";
import Link from "next/link";

export type OnboardingState = {
  hasAsset: boolean;
  hasVerifiedAsset: boolean;
  hasScan: boolean;
  hasKey: boolean;
  firstVerifiedAssetId: string | null;
};

type Step = { title: string; detail: string; href: string; cta: string; done: boolean };

export function onboardingComplete(s: OnboardingState): boolean {
  return s.hasAsset && s.hasVerifiedAsset && s.hasScan;
}

export function OnboardingGuide({ state }: { state: OnboardingState }) {
  const steps: Step[] = [
    {
      title: "Añade tu primer activo",
      detail: "Registra la web, IP o app que quieres auditar. Solo activos tuyos o que tengas permiso para probar.",
      href: "/app/activos",
      cta: "Añadir activo",
      done: state.hasAsset,
    },
    {
      title: "Verifica que es tuyo y autorízalo",
      detail: "Demuestra la propiedad con un registro DNS o un fichero, y marca el activo como autorizado. Es una de las tres puertas que exigimos antes de escanear.",
      href: "/app/activos",
      cta: "Verificar propiedad",
      done: state.hasVerifiedAsset,
    },
    {
      title: "Lanza tu primera auditoría",
      detail: "Una revisión pasiva en segundos: HTTPS, cabeceras, cookies, CORS, ficheros expuestos y secretos en el JavaScript.",
      href: state.firstVerifiedAssetId ? `/app/activos/${state.firstVerifiedAssetId}` : "/app/activos",
      cta: "Escanear ahora",
      done: state.hasScan,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <section className="overflow-hidden rounded-panel border border-accent/30 bg-gradient-to-br from-accent/[0.07] to-transparent">
      <div className="flex items-center justify-between gap-3 border-b border-accent/20 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Bienvenido a AuditForge</h2>
          <p className="text-xs text-dim">Tres pasos para tu primera auditoría.</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-accent tabular-nums">{doneCount}/{steps.length}</span>
      </div>

      <ol className="divide-y divide-line">
        {steps.map((step, i) => {
          const active = i === currentIndex;
          const locked = currentIndex !== -1 && i > currentIndex;
          return (
            <li key={step.title} className={`flex items-start gap-3 px-4 py-3 ${locked ? "opacity-55" : ""}`}>
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] ${
                  step.done
                    ? "bg-accent text-accent-ink"
                    : active
                      ? "border border-accent text-accent"
                      : "border border-line text-dim"
                }`}
                aria-hidden
              >
                {step.done ? <Check size={13} /> : locked ? <Lock size={11} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${step.done ? "text-dim line-through decoration-dim/40" : ""}`}>{step.title}</p>
                {!step.done && <p className="mt-0.5 text-sm text-dim">{step.detail}</p>}
              </div>
              {active && (
                <Link
                  href={step.href}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-accent-ink transition-[filter] hover:brightness-95"
                >
                  {step.cta}
                  <ArrowRight size={13} aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2 border-t border-line bg-surface/40 px-4 py-2.5 text-xs text-dim">
        <KeyRound size={13} className={state.hasKey ? "text-accent" : ""} aria-hidden />
        {state.hasKey ? (
          <span>Clave de Claude conectada: tus auditorías incluyen análisis con IA.</span>
        ) : (
          <span>
            Opcional: conecta tu clave de Claude en{" "}
            <Link href="/app/ajustes" className="text-fg underline underline-offset-2">Ajustes</Link>{" "}
            para que la IA explique y priorice cada hallazgo.
          </span>
        )}
      </div>
    </section>
  );
}
