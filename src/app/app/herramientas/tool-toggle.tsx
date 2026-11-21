"use client";

import { useFormStatus } from "react-dom";
import { toggleTool } from "./actions";

function Switch({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      aria-label={enabled ? "Desactivar comprobación" : "Activar comprobación"}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-accent" : "bg-surface-2 border border-line"
      }`}
    >
      <span
        className={`inline-block size-3.5 rounded-full bg-accent-ink transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
        aria-hidden
      />
    </button>
  );
}

export function ToolToggle({ toolKey, enabled }: { toolKey: string; enabled: boolean }) {
  return (
    <form action={toggleTool}>
      <input type="hidden" name="key" value={toolKey} />
      <input type="hidden" name="enabled" value={(!enabled).toString()} />
      <Switch enabled={enabled} />
    </form>
  );
}
