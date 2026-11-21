"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TERMINAL = new Set(["done", "failed", "cancelled"]);

// Mantiene viva la vista de un escaneo en curso: escucha scan_logs y scans por Realtime y
// refresca los datos del servidor. Si Realtime no está disponible, un sondeo de respaldo
// garantiza que el progreso igualmente aparezca. Se detiene al terminar el escaneo.
export function LiveScan({ scanId, status }: { scanId: string; status: string }) {
  const router = useRouter();
  const live = !TERMINAL.has(status);

  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        router.refresh();
      }, 400);
    };

    const channel = supabase
      .channel(`scan-${scanId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_logs", filter: `scan_id=eq.${scanId}` }, bump)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scans", filter: `id=eq.${scanId}` }, bump)
      .subscribe();

    const poll = setInterval(() => router.refresh(), 5000);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [scanId, live, router]);

  if (!live) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-accent">
      <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> en vivo
    </span>
  );
}
