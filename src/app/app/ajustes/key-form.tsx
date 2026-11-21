"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveKey, type SettingsState } from "./actions";

const idle: SettingsState = { status: "idle" };

function SaveButton({ hasKey }: { hasKey: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 cursor-pointer items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Guardando…" : hasKey ? "Reemplazar clave" : "Guardar clave"}
    </button>
  );
}

export function KeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, action] = useActionState(saveKey, idle);
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="anthropic-key" className="block text-xs text-dim">
        {hasKey ? "Pega una clave nueva para reemplazar la actual" : "Pega tu clave de Claude"}
      </label>
      <input
        id="anthropic-key"
        name="key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-ant-..."
        className="h-10 w-full rounded-control border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim"
      />
      {state.status === "error" && <p role="alert" className="text-sev-critical">{state.message}</p>}
      {state.status === "ok" && <p role="status" className="text-accent">{state.message}</p>}
      <SaveButton hasKey={hasKey} />
    </form>
  );
}
