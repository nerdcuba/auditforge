// Fondo animado para hero y CTA: luz lima que deriva + línea de escáner. Solo decorativo.
export function HeroBackdrop({ scan = true }: { scan?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="glow-accent absolute inset-x-0 top-0 h-[460px]" />
      <div className="af-blob af-blob-a -left-20 -top-16 size-80" />
      <div className="af-blob af-blob-b right-0 top-24 size-96" />
      {scan && <div className="af-scan" />}
    </div>
  );
}
