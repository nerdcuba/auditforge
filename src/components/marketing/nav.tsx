"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#capacidades", label: "Capacidades" },
  { href: "#como", label: "Cómo funciona" },
  { href: "#asistente", label: "Asistente" },
  { href: "#precios", label: "Precios" },
];

export function MarketingNav({ authed }: { authed: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled ? "border-line bg-bg/85 backdrop-blur-md" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="AuditForge, inicio">
          <span className="size-2 rounded-[2px] bg-accent" aria-hidden />
          <span className="font-mono text-sm font-semibold tracking-wide">AUDITFORGE</span>
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-dim transition-colors hover:text-fg">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="https://github.com/nerdcuba/auditforge"
            target="_blank"
            rel="noreferrer"
            className="text-dim transition-colors hover:text-fg"
          >
            GitHub
          </a>
          {authed ? (
            <Link href="/app" className="inline-flex h-9 items-center rounded-control bg-accent px-3.5 text-sm font-medium text-accent-ink hover:brightness-95">
              Ir al panel
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex h-9 items-center rounded-control border border-line px-3.5 text-fg hover:bg-surface-2">
                Entrar
              </Link>
              <Link href="/login" className="inline-flex h-9 items-center rounded-control bg-accent px-3.5 text-sm font-medium text-accent-ink hover:brightness-95">
                Probar gratis
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-control border border-line text-fg md:hidden"
        >
          {open ? <X size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-bg px-4 py-3 md:hidden">
          <nav aria-label="Secciones" className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-control px-2 py-2 text-dim hover:bg-surface-2 hover:text-fg"
              >
                {link.label}
              </a>
            ))}
            <Link href={authed ? "/app" : "/login"} className="mt-1 inline-flex h-10 items-center justify-center rounded-control bg-accent text-sm font-medium text-accent-ink">
              {authed ? "Ir al panel" : "Probar gratis"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
