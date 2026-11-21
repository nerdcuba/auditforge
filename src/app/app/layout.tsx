import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { AssistantBubble } from "@/components/assistant-bubble";
import { SidebarNav } from "@/components/sidebar";
import { getMySettings } from "@/lib/settings/store";
import { createClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settings = await getMySettings(user.id);
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:w-52 md:border-r md:border-b-0">
        <div className="flex h-12 items-center border-b border-line px-4">
          <Link href="/app" className="flex items-center gap-2" aria-label="AuditForge">
            <span className="size-2 rounded-[2px] bg-accent" aria-hidden />
            <span className="font-mono text-xs font-semibold tracking-wide">AUDITFORGE</span>
          </Link>
        </div>
        <SidebarNav />
        <div className="flex items-center gap-2 border-t border-line p-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-control border border-line bg-surface-2 font-mono text-xs text-dim" aria-hidden>
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-dim" title={user.email}>{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid size-7 cursor-pointer place-items-center rounded-control text-dim transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut size={14} aria-hidden />
            </button>
          </form>
        </div>
        <Link
          href="/legal"
          className="hidden border-t border-line px-3 py-1.5 font-mono text-[10px] text-dim/70 transition-colors hover:text-dim md:block"
        >
          Términos · uso responsable
        </Link>
      </aside>
      <main className="app-enter min-w-0 flex-1">{children}</main>
      <AssistantBubble hasKey={settings.hasKey} />
    </div>
  );
}
