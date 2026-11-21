import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y responsabilidad",
  description: "Condiciones de uso, descargo de responsabilidad y uso aceptable de AuditForge.",
};

const UPDATED = "21 de noviembre de 2026";

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="flex items-baseline gap-2.5 text-lg font-semibold">
        <span className="font-mono text-sm text-accent">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm text-dim [&_strong]:font-medium [&_strong]:text-fg">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="AuditForge, inicio">
            <span className="size-2 rounded-[2px] bg-accent" aria-hidden />
            <span className="font-mono text-sm font-semibold tracking-wide">AUDITFORGE</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-dim hover:text-fg">
            <ArrowLeft size={14} aria-hidden /> Inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-mono text-xs tracking-wide text-accent">LEGAL</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Términos de uso y responsabilidad</h1>
        <p className="mt-2 text-sm text-dim">Última actualización: {UPDATED}.</p>

        <div className="mt-4 rounded-panel border border-sev-medium/40 bg-sev-medium/5 p-4 text-sm text-dim">
          <p>
            <strong className="font-medium text-fg">Resumen en una línea:</strong> usa AuditForge únicamente sobre
            activos de tu propiedad o con autorización expresa por escrito. No garantiza que tu producto quede seguro, y
            el uso es bajo tu entera responsabilidad.
          </p>
        </div>

        <Section n="01" title="Uso aceptable">
          <p>
            AuditForge solo puede usarse para auditar <strong>sistemas, webs, aplicaciones o infraestructuras de tu
            propiedad</strong>, o para los que cuentes con <strong>autorización expresa y por escrito</strong> del titular.
          </p>
          <p>
            Escanear, sondear o atacar sistemas de terceros sin permiso es ilegal en la mayoría de países. En España, por
            ejemplo, puede constituir delito conforme a los artículos 197 bis y 264 del Código Penal; en otras
            jurisdicciones existen normas equivalentes sobre acceso no autorizado a sistemas informáticos. Cumplir la ley
            aplicable es responsabilidad exclusiva del usuario.
          </p>
          <p>
            Por eso AuditForge exige verificar la propiedad del activo y autorizarlo antes de escanear. No intentes
            eludir esos controles.
          </p>
        </Section>

        <Section n="02" title="Sin garantías">
          <p>
            AuditForge se ofrece <strong>«tal cual», sin garantías de ningún tipo</strong>, expresas o implícitas. No
            garantizamos que detecte todas las vulnerabilidades, que no produzca falsos positivos o negativos, ni que esté
            disponible de forma ininterrumpida.
          </p>
          <p>
            Una revisión con AuditForge <strong>no significa que tu producto sea seguro</strong> ni sustituye a una
            auditoría de seguridad profesional ni a un pentest manual. Es una ayuda previa al lanzamiento, no un
            certificado.
          </p>
        </Section>

        <Section n="03" title="Limitación de responsabilidad">
          <p>
            En la máxima medida permitida por la ley, los autores y colaboradores de AuditForge{" "}
            <strong>no serán responsables</strong> de ningún daño directo, indirecto, incidental o consecuente derivado del
            uso o de la imposibilidad de uso del software, incluyendo, sin limitación, interrupciones de servicio, pérdida
            de datos, daños a sistemas propios o de terceros, o consecuencias legales derivadas de un uso no autorizado.
          </p>
          <p>El usuario asume por completo el riesgo del uso de la herramienta.</p>
        </Section>

        <Section n="04" title="Responsabilidad del usuario">
          <p>Al usar AuditForge te comprometes a:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Usarlo solo sobre activos propios o con autorización expresa y verificable.</li>
            <li>Cumplir toda la legislación aplicable en tu jurisdicción y en la del objetivo.</li>
            <li>Revisar y validar los resultados antes de actuar sobre ellos; no tomar decisiones críticas a ciegas.</li>
            <li>No usar la herramienta para actividades ilícitas, intrusivas o dañinas contra terceros.</li>
          </ul>
        </Section>

        <Section n="05" title="Tu clave de Claude y tus datos">
          <p>
            El análisis con inteligencia artificial se realiza con <strong>tu propia clave de API de Claude
            (Anthropic)</strong>. Las peticiones que generes se envían a Anthropic y quedan sujetas a los términos y a la
            política de privacidad de Anthropic. Tú gestionas y pagas ese consumo.
          </p>
          <p>
            AuditForge almacena los datos necesarios para funcionar (tus activos, escaneos, hallazgos y registros de
            actividad). Si alojas la herramienta tú mismo, esos datos residen en tu propia infraestructura.
          </p>
        </Section>

        <Section n="06" title="Software de terceros">
          <p>
            El motor de auditoría se basa en{" "}
            <a href="https://github.com/elementalsouls/Claude-BugHunter" target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2">
              Claude-BugHunter
            </a>{" "}
            de Sachin Sharma, bajo licencias MIT (código) y CC BY 4.0 (contenido). Cada componente de terceros conserva su
            propia licencia. AuditForge es open source; consulta el repositorio para el detalle de licencias.
          </p>
        </Section>

        <Section n="07" title="Cambios en estos términos">
          <p>
            Podemos actualizar estos términos. La versión vigente es la publicada aquí, con su fecha de actualización. El
            uso continuado de AuditForge tras un cambio implica la aceptación de la versión actualizada.
          </p>
        </Section>

        <p className="mt-8 border-t border-line pt-6 text-xs text-dim">
          Este documento es un descargo de responsabilidad y unas condiciones de uso de carácter general; no constituye
          asesoramiento legal. Para un uso comercial o en producción, conviene la revisión de un profesional del derecho.
        </p>
      </main>
    </div>
  );
}
