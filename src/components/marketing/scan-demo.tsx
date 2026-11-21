"use client";

const LINES = [
  "→ resolviendo tu-web.com",
  "→ comprobando cabeceras de seguridad",
  "→ analizando cookies y CORS",
  "→ buscando ficheros expuestos (.env, .git)",
  "→ revisando secretos en bundles JS",
];

const FINDINGS = [
  { sev: "ALTA", color: "text-sev-high", dot: "bg-sev-high", title: "Falta Content-Security-Policy", detail: "Tu web no limita de dónde se cargan los scripts." },
  { sev: "MEDIA", color: "text-sev-medium", dot: "bg-sev-medium", title: "Cookie de sesión sin flag Secure", detail: "La sesión podría viajar sin cifrar." },
  { sev: "INFO", color: "text-sev-info", dot: "bg-sev-info", title: "La cabecera Server revela la versión", detail: "Le facilita al atacante elegir el exploit." },
];

export function ScanDemo() {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-sev-high/70" aria-hidden />
          <span className="size-2 rounded-full bg-sev-medium/70" aria-hidden />
          <span className="size-2 rounded-full bg-sev-low/70" aria-hidden />
          <span className="ml-2 font-mono text-xs text-dim">auditforge · escaneo recon+passive</span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
          <span className="size-1.5 rounded-full bg-accent" style={{ animation: "af-pulse-dot 1.4s ease-in-out infinite" }} aria-hidden />
          en curso
        </span>
      </div>

      <div className="space-y-1 border-b border-line bg-bg/40 px-4 py-3 font-mono text-xs">
        {LINES.map((line, i) => (
          <p key={line} className="text-dim" style={{ animation: "af-rise 0.5s both", animationDelay: `${i * 0.5}s` }}>
            {line}
          </p>
        ))}
        <p className="pt-1 text-accent" style={{ animation: "af-rise 0.5s both", animationDelay: `${LINES.length * 0.5}s` }}>
          ✓ 5 comprobaciones · 3 hallazgos
        </p>
      </div>

      <div className="space-y-2 p-3">
        {FINDINGS.map((f, i) => (
          <div
            key={f.title}
            className="flex items-start gap-3 rounded-control border border-line bg-surface-2/60 px-3 py-2.5"
            style={{ animation: "af-rise 0.5s both", animationDelay: `${(LINES.length + 1 + i) * 0.4}s` }}
          >
            <span className={`mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] ${f.color}`}>
              <span className={`size-1.5 rounded-[1px] ${f.dot}`} aria-hidden />
              {f.sev}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-dim">{f.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
