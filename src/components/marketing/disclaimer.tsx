import { ShieldAlert } from "lucide-react";
import Link from "next/link";

// Aviso breve reutilizable. `variant` ajusta el énfasis según dónde se muestre.
export function Disclaimer({ variant = "inline" }: { variant?: "inline" | "banner" }) {
  const text = (
    <>
      AuditForge es una ayuda de revisión, no una garantía de seguridad. Úsalo{" "}
      <strong className="font-medium text-fg">solo sobre activos de tu propiedad o con autorización expresa</strong>.
      Tú eres responsable de cómo lo usas.{" "}
      <Link href="/legal" className="underline underline-offset-2 hover:text-fg">Términos y responsabilidad</Link>.
    </>
  );

  if (variant === "banner") {
    return (
      <div className="flex items-start gap-2.5 rounded-control border border-sev-medium/40 bg-sev-medium/5 px-3 py-2 text-xs text-dim">
        <ShieldAlert size={15} className="mt-px shrink-0 text-sev-medium" aria-hidden />
        <p>{text}</p>
      </div>
    );
  }
  return <p className="text-xs text-dim">{text}</p>;
}
