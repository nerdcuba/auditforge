"use client";

import { Crosshair, FileText, LayoutDashboard, type LucideIcon, Server, Settings, ShieldAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Resumen", icon: LayoutDashboard },
  { href: "/app/activos", label: "Activos", icon: Server },
  { href: "/app/escaneos", label: "Escaneos", icon: Crosshair },
  { href: "/app/hallazgos", label: "Hallazgos", icon: ShieldAlert },
  { href: "/app/reportes", label: "Reportes", icon: FileText },
  { href: "/app/herramientas", label: "Herramientas", icon: Wrench },
  { href: "/app/ajustes", label: "Ajustes", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex gap-0.5 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-visible">
      <p className="hidden px-2 pt-1 pb-1.5 font-mono text-[10px] tracking-wide text-dim/70 md:block">NAVEGACIÓN</p>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-8 shrink-0 items-center gap-2 rounded-control px-2 transition-colors ${
              active ? "bg-surface-2 text-fg" : "text-dim hover:bg-surface-2/60 hover:text-fg"
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity md:block ${
                active ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            />
            <Icon size={15} strokeWidth={1.75} className={active ? "text-accent" : "transition-colors group-hover:text-fg"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
