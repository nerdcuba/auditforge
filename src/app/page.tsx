import {
  ArrowRight,
  Check,
  Code2,
  Database,
  Gauge,
  GitBranch,
  Globe,
  KeyRound,
  LogIn,
  MessagesSquare,
  Network,
  Settings2,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroBackdrop } from "@/components/marketing/backdrop";
import { BRANDS, BrandMark } from "@/components/marketing/brand-marks";
import { Disclaimer } from "@/components/marketing/disclaimer";
import { MarketingNav } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";
import { ScanDemo } from "@/components/marketing/scan-demo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AuditForge — audita tu producto antes de lanzarlo",
  description:
    "Revisa tu web en busca de fallos de seguridad y entiende, en lenguaje claro, qué arreglar. Para quien no es experto en ciberseguridad.",
  robots: { index: true, follow: true },
};

// Marcas con logo oficial + el kit (sin logo, como texto con enlace de atribución).
const STACK_EXTRA = [{ name: "Claude-BugHunter", href: "https://github.com/elementalsouls/Claude-BugHunter" }];

const CAPS: { icon: LucideIcon; name: string; tag: string; desc: string }[] = [
  { icon: Code2, name: "Cross-Site Scripting", tag: "hunt-xss", desc: "Scripts colados en tu web que roban sesiones o datos de tus usuarios." },
  { icon: Database, name: "Inyección SQL", tag: "hunt-sqli", desc: "Acceso no autorizado a tu base de datos a través de un simple formulario." },
  { icon: Network, name: "SSRF", tag: "hunt-ssrf", desc: "Tu servidor engañado para pedir recursos internos o claves de la nube." },
  { icon: Users, name: "IDOR", tag: "hunt-idor", desc: "Ver o editar datos de otros usuarios cambiando un número en la URL." },
  { icon: KeyRound, name: "Secretos expuestos", tag: "recon", desc: "Claves de API y tokens olvidados en tu JavaScript público." },
  { icon: Settings2, name: "Malas configuraciones", tag: "passive", desc: "Cabeceras, CORS y cookies inseguras que dejan la puerta entornada." },
  { icon: LogIn, name: "Fallos de acceso", tag: "hunt-auth-bypass", desc: "Formas de saltarse el login, el OAuth o el doble factor." },
  { icon: Globe, name: "Superficie expuesta", tag: "hunt-subdomain", desc: "Subdominios y endpoints olvidados que no sabías que estaban online." },
];

const STEPS: { n: string; title: string; desc: string }[] = [
  { n: "01", title: "Verifica que es tuyo", desc: "Un registro DNS o un fichero. AuditForge no escanea nada que no hayas demostrado que te pertenece." },
  { n: "02", title: "Lanza la auditoría", desc: "Elige el nivel según lo que quieras gastar y deja que el motor recorra tu web." },
  { n: "03", title: "Entiende y corrige", desc: "Cada hallazgo, explicado en claro, con el arreglo concreto para tu stack." },
];

const LEVELS: { name: string; model: string; for: string }[] = [
  { name: "Económico", model: "rápido y barato", for: "revisiones frecuentes mientras desarrollas" },
  { name: "Equilibrado", model: "el punto medio", for: "la mayoría de auditorías antes de lanzar" },
  { name: "Máximo", model: "la máxima profundidad", for: "cadenas complejas y análisis a fondo" },
];

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-xs tracking-wide text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {intro && <p className="mt-3 text-dim">{intro}</p>}
    </div>
  );
}

export default async function LandingPage() {
  let authed = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    authed = Boolean(data.user);
  } catch {
    authed = false;
  }

  return (
    <div className="min-h-dvh">
      <MarketingNav authed={authed} />

      {/* Hero */}
      <section className="scope-grid relative overflow-hidden border-b border-line">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 font-mono text-xs text-dim">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Seguridad antes de lanzar
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Audita tu producto
              <br />
              antes de <span className="text-accent">lanzarlo</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-dim sm:text-lg">
              AuditForge revisa tu web en busca de fallos de seguridad y te explica, en claro, qué arreglar.
              Sin ser experto. Sin pelearte con la terminal.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="shine inline-flex h-11 items-center gap-2 rounded-control bg-accent px-5 font-medium text-accent-ink hover:brightness-95"
              >
                Probar gratis <ArrowRight size={16} aria-hidden />
              </Link>
              <a
                href="#como"
                className="inline-flex h-11 items-center rounded-control border border-line px-5 text-fg hover:bg-surface-2"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-dim">
              <span className="inline-flex items-center gap-1.5"><GitBranch size={13} aria-hidden /> Open source</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden /> Solo sobre activos propios o autorizados</span>
            </p>
          </div>

          <div className="lg:pl-6">
            <ScanDemo />
          </div>
        </div>

        {/* Stack */}
        <div className="relative border-t border-line bg-bg/60">
          <div className="mx-auto max-w-6xl overflow-hidden px-4 py-5">
            <p className="mb-3 text-center font-mono text-[11px] tracking-wide text-dim">CONSTRUIDO CON</p>
            <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
              <div className="marquee items-center gap-12">
                {[0, 1].map((pass) => (
                  <div key={pass} className="flex shrink-0 items-center gap-12" aria-hidden={pass === 1 ? true : undefined}>
                    {BRANDS.map((brand) => (
                      <span key={brand.name} className="flex shrink-0 items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
                        <BrandMark brand={brand} className="size-5" />
                        <span className="font-mono text-sm text-dim">{brand.name}</span>
                      </span>
                    ))}
                    {STACK_EXTRA.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={pass === 1 ? -1 : undefined}
                        title="Motor de auditoría (Sachin Sharma · MIT · CC BY 4.0)"
                        className="shrink-0 font-mono text-sm text-dim/80 transition-colors hover:text-fg"
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problema → solución */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Reveal>
            <SectionTitle
              eyebrow="El problema"
              title="Lanzas rápido. La seguridad se queda atrás."
              intro="Hoy cualquiera construye y publica software con IA. Pero las herramientas de seguridad son de terminal y están pensadas para expertos. AuditForge pone esa potencia a tu alcance y te la traduce."
            />
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Zap, title: "Construyes rápido", desc: "Sacas producto en días. Revisar la seguridad a mano no entra en el plan." },
              { icon: Terminal, title: "Las herramientas asustan", desc: "nmap, nuclei, scripts… potentes, pero de línea de comandos y jerga técnica." },
              { icon: MessagesSquare, title: "AuditForge lo traduce", desc: "Escanea por ti y te dice, en lenguaje normal, qué está mal y cómo arreglarlo." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="h-full rounded-panel border border-line bg-surface p-5">
                  <div className="grid size-9 place-items-center rounded-control border border-line text-accent">
                    <Icon size={17} aria-hidden />
                  </div>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-1 text-dim">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como" className="border-b border-line scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Reveal>
            <SectionTitle eyebrow="Cómo funciona" title="De la URL al arreglo, en tres pasos" />
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80}>
                <div className="relative h-full rounded-panel border border-line bg-surface p-5">
                  <span className="font-mono text-sm text-accent">{step.n}</span>
                  <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
                  <p className="mt-1.5 text-dim">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Niveles de coste */}
          <Reveal>
            <div className="mt-6 rounded-panel border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                <Gauge size={15} className="text-accent" aria-hidden />
                <p className="text-sm font-medium">Tú controlas el gasto</p>
                <p className="text-xs text-dim">· cada escaneo usa tu propia clave de Claude</p>
              </div>
              <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {LEVELS.map((lvl) => (
                  <div key={lvl.name} className="px-5 py-4">
                    <p className="font-medium">{lvl.name}</p>
                    <p className="font-mono text-xs text-accent">{lvl.model}</p>
                    <p className="mt-1.5 text-xs text-dim">Para {lvl.for}.</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capacidades */}
      <section id="capacidades" className="border-b border-line scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Reveal>
            <SectionTitle
              eyebrow="Qué detecta"
              title="Un motor serio, en lenguaje que entiendes"
              intro="Por dentro usa Claude-BugHunter: 83 skills curadas a partir de más de 574 informes reales de HackerOne. Por fuera, te lo cuenta sin jerga."
            />
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CAPS.map((cap, i) => (
              <Reveal key={cap.name} delay={(i % 4) * 70}>
                <div className="group h-full rounded-panel border border-line bg-surface p-4 transition-colors hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <div className="grid size-9 place-items-center rounded-control border border-line text-fg transition-colors group-hover:text-accent">
                      <cap.icon size={17} aria-hidden />
                    </div>
                    <span className="font-mono text-[10px] text-dim">{cap.tag}</span>
                  </div>
                  <h3 className="mt-3 font-medium">{cap.name}</h3>
                  <p className="mt-1 text-xs text-dim">{cap.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Asistente */}
      <section id="asistente" className="border-b border-line scroll-mt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-20">
          <Reveal>
            <div>
              <p className="font-mono text-xs tracking-wide text-accent">El asistente</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Un copiloto que no te deja solo</h2>
              <p className="mt-3 text-dim">
                No solo te lista problemas. Te explica cada hallazgo, por qué importa para tu caso y cómo arreglarlo
                paso a paso en tu propio código. Y si tienes dudas, le preguntas.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Traduce la jerga técnica a algo accionable.",
                  "Prioriza qué arreglar primero según el riesgo real.",
                  "Te redacta el reporte para tu equipo o tu cliente.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-panel border border-line bg-surface p-4">
              <div className="space-y-3">
                <div className="ml-auto max-w-[80%] rounded-panel rounded-br-sm border border-line bg-surface-2 px-3 py-2 text-sm">
                  ¿Qué es eso del CSP y cómo lo arreglo en Next.js?
                </div>
                <div className="max-w-[88%] rounded-panel rounded-bl-sm border border-accent/30 bg-bg px-3 py-2.5 text-sm">
                  <p className="mb-1.5 font-mono text-[11px] text-accent">asistente</p>
                  El CSP le dice al navegador de dónde puede cargar scripts, así un atacante no puede colar el suyo.
                  En Next.js lo añades con una cabecera en <span className="font-mono text-xs">next.config</span>. Te dejo el bloque listo para pegar 👇
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Las tres puertas */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Reveal>
            <SectionTitle
              eyebrow="Seguro por diseño"
              title="Solo lo tuyo. Nunca lo ajeno."
              intro="Antes de escanear, cada activo cruza tres puertas. Si una falla, no corre. Es lo que hace que una herramienta así se pueda poner en cualquier mano."
            />
          </Reveal>
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-panel border border-line bg-surface">
            {[
              { n: "01", name: "Propiedad", desc: "Demuestras que el activo es tuyo con un registro DNS o un fichero." },
              { n: "02", name: "Allowlist", desc: "Decides explícitamente qué activos verificados pueden escanearse." },
              { n: "03", name: "Modo", desc: "Recon y passive por defecto. Las pruebas intrusivas exigen confirmación." },
            ].map((gate) => (
              <div key={gate.n} className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-b-0">
                <span className="font-mono text-sm text-dim">{gate.n}</span>
                <div className="flex-1">
                  <p className="font-medium">{gate.name}</p>
                  <p className="text-dim">{gate.desc}</p>
                </div>
                <ShieldCheck size={16} className="mt-0.5 text-accent" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="border-b border-line scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Reveal>
            <SectionTitle eyebrow="Precios" title="Open source hoy. Alojado cuando quieras." />
          </Reveal>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Reveal>
              <div className="flex h-full flex-col rounded-panel border border-line bg-surface p-6">
                <p className="font-medium">Self-host</p>
                <p className="mt-1 text-dim">Lo alojas tú, con tu propia clave de Claude.</p>
                <p className="mt-4 text-3xl font-semibold">Gratis</p>
                <p className="font-mono text-xs text-dim">open source · para siempre</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {["Panel completo", "Auditoría recon + passive", "Asistente que te explica", "Un solo docker compose"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5"><Check size={15} className="text-accent" aria-hidden /> {f}</li>
                  ))}
                </ul>
                <a
                  href="https://github.com/nerdcuba/auditforge"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control border border-line text-fg hover:bg-surface-2"
                >
                  <GitBranch size={15} aria-hidden /> Ver en GitHub
                </a>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="relative flex h-full flex-col rounded-panel border border-accent/40 bg-surface p-6">
                <span className="absolute -top-2.5 right-5 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-accent-ink">PRÓXIMAMENTE</span>
                <p className="font-medium">Hosted / Pro</p>
                <p className="mt-1 text-dim">Nosotros lo alojamos y lo mantenemos.</p>
                <p className="mt-4 text-3xl font-semibold">Pronto</p>
                <p className="font-mono text-xs text-dim">mantenimiento incluido</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {["Todo lo de self-host", "Escaneo active profundo", "Reportes y exportación", "Equipos y colaboración", "Soporte y actualizaciones"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5"><Check size={15} className="text-accent" aria-hidden /> {f}</li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent font-medium text-accent-ink hover:brightness-95"
                >
                  Empezar gratis <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Legal / responsabilidad */}
      <section id="legal" className="border-b border-line scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <Reveal>
            <p className="font-mono text-xs tracking-wide text-accent">Uso responsable</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Una herramienta potente, con límites claros</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { t: "Solo lo tuyo", d: "Únicamente activos de tu propiedad o con autorización expresa por escrito." },
                { t: "Sin garantías", d: "Es una revisión previa, no un certificado de que tu producto sea seguro." },
                { t: "Tú respondes", d: "Eres responsable de cumplir la ley aplicable y de cómo usas la herramienta." },
              ].map((item) => (
                <div key={item.t} className="rounded-panel border border-line bg-surface p-4">
                  <p className="font-medium">{item.t}</p>
                  <p className="mt-1 text-xs text-dim">{item.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Disclaimer variant="banner" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section className="scope-grid relative overflow-hidden border-b border-line">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">¿Lo revisamos antes de que lo lancen tus usuarios?</h2>
            <p className="mx-auto mt-3 max-w-xl text-dim">
              Verifica tu dominio y lanza tu primera auditoría en minutos. Gratis y open source.
            </p>
            <div className="mt-7">
              <Link
                href="/login"
                className="shine inline-flex h-12 items-center gap-2 rounded-control bg-accent px-6 font-medium text-accent-ink hover:brightness-95"
              >
                Probar AuditForge <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-[2px] bg-accent" aria-hidden />
                <span className="font-mono text-sm font-semibold tracking-wide">AUDITFORGE</span>
              </div>
              <p className="mt-2 max-w-xs text-xs text-dim">
                Auditoría de seguridad para tus propios productos, antes de lanzarlos.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-mono text-[11px] text-dim">PRODUCTO</p>
                <a href="#capacidades" className="block text-dim hover:text-fg">Capacidades</a>
                <a href="#como" className="block text-dim hover:text-fg">Cómo funciona</a>
                <a href="#precios" className="block text-dim hover:text-fg">Precios</a>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-[11px] text-dim">ENLACES</p>
                <a href="https://github.com/nerdcuba/auditforge" target="_blank" rel="noreferrer" className="block text-dim hover:text-fg">GitHub</a>
                <Link href="/legal" className="block text-dim hover:text-fg">Términos y legal</Link>
                <Link href="/login" className="block text-dim hover:text-fg">Entrar</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-xs text-dim">
            <p>
              Motor de auditoría basado en{" "}
              <a href="https://github.com/elementalsouls/Claude-BugHunter" target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2">
                Claude-BugHunter
              </a>{" "}
              de Sachin Sharma (MIT · CC BY 4.0).
            </p>
            <p>Úsalo solo sobre activos de tu propiedad o con autorización expresa. © {new Date().getFullYear()} AuditForge.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
