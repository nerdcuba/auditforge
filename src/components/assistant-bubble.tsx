"use client";

import { ArrowUp, Bot, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage, type ChatState } from "@/app/app/asistente/actions";

const initial: ChatState = { messages: [] };
const SUGGESTIONS = ["¿Qué hallazgo arreglo primero?", "Explícame qué es un CSP", "¿Cómo fuerzo HTTPS?", "Resume mi seguridad"];

type Pos = { right: number; bottom: number };
const DEFAULT_POS: Pos = { right: 20, bottom: 20 };
const clamp = (v: number, max: number) => Math.min(Math.max(v, 12), Math.max(12, max));

export function AssistantBubble({ hasKey }: { hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(DEFAULT_POS);
  const [state, action, pending] = useActionState(sendMessage, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, origRight: 0, origBottom: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("af-bubble-pos");
      if (saved) setPos(JSON.parse(saved));
    } catch {
      /* sin posición guardada */
    }
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!pending && inputRef.current) inputRef.current.value = "";
  }, [state.messages.length, pending, open]);

  function ask(question: string) {
    if (!inputRef.current || !formRef.current) return;
    inputRef.current.value = question;
    formRef.current.requestSubmit();
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, origRight: pos.right, origBottom: pos.bottom };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    setPos({
      right: clamp(drag.current.origRight - dx, window.innerWidth - 60),
      bottom: clamp(drag.current.origBottom - dy, window.innerHeight - 60),
    });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (wasDrag) {
      try { localStorage.setItem("af-bubble-pos", JSON.stringify(pos)); } catch { /* ignore */ }
    } else {
      setOpen((v) => !v);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed z-50 flex h-[min(70dvh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-2xl shadow-black/50"
          style={{ right: pos.right, bottom: pos.bottom + 64 }}
        >
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
            <span className="flex items-center gap-2 text-sm font-medium"><Bot size={16} className="text-accent" aria-hidden /> Asistente</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-7 cursor-pointer place-items-center rounded-control text-dim hover:bg-surface-2 hover:text-fg">
              <X size={15} aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {state.messages.length === 0 && (
              <div>
                <p className="text-sm text-dim">Pregúntame sobre tus hallazgos y cómo arreglarlos.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((q) => (
                    <button key={q} type="button" onClick={() => ask(q)} disabled={!hasKey}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-dim transition-colors hover:border-accent/40 hover:text-fg disabled:opacity-50">
                      {q}
                    </button>
                  ))}
                </div>
                {!hasKey && (
                  <p className="mt-3 text-xs text-dim">
                    Configura tu clave de Claude en <Link href="/app/ajustes" className="text-fg underline underline-offset-2">Ajustes</Link> para usar el asistente.
                  </p>
                )}
              </div>
            )}
            {state.messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] rounded-panel border px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "rounded-br-sm border-line bg-surface-2" : "rounded-bl-sm border-accent/25 bg-bg"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-panel rounded-bl-sm border border-accent/25 bg-bg px-3 py-2 text-sm text-dim">
                  <span className="inline-flex items-center gap-1.5"><span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> pensando…</span>
                </div>
              </div>
            )}
            {state.error && <p role="alert" className="text-xs text-sev-critical">{state.error}</p>}
            <div ref={endRef} />
          </div>

          <form ref={formRef} action={action} className="flex items-end gap-2 border-t border-line p-2">
            <textarea ref={inputRef} name="message" rows={1} required disabled={!hasKey || pending}
              placeholder={hasKey ? "Escribe tu pregunta…" : "Configura tu clave en Ajustes"}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); formRef.current?.requestSubmit(); } }}
              className="max-h-28 min-h-9 flex-1 resize-none rounded-control border border-line bg-bg px-2.5 py-2 text-sm text-fg placeholder:text-dim disabled:opacity-60" />
            <button type="submit" disabled={!hasKey || pending} aria-label="Enviar"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-control bg-accent text-accent-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowUp size={16} aria-hidden />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        title="Asistente (arrástrame para moverme)"
        style={{ right: pos.right, bottom: pos.bottom, touchAction: "none" }}
        className="fixed z-50 grid size-12 cursor-grab touch-none place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-black/40 transition-transform hover:scale-105 active:cursor-grabbing"
      >
        {open ? <X size={20} aria-hidden /> : <Bot size={22} aria-hidden />}
      </button>
    </>
  );
}
