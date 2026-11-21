"use client";

import { useActionState, useEffect, useState } from "react";
import { requestMagicLink, signInWithPassword, type LoginState, type PasswordState } from "./actions";

const initialLink: LoginState = { status: "idle" };
const initialPassword: PasswordState = { status: "idle" };

const inputClass =
  "h-10 w-full rounded-control border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim";
const submitClass =
  "h-10 w-full cursor-pointer rounded-control bg-accent text-sm font-medium text-accent-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-70";
const errorClass = "rounded-control border border-sev-critical/40 px-3 py-2 text-sev-critical";
const warningClass = "rounded-control border border-sev-medium/40 px-3 py-2 text-sev-medium";

function EmailField({ value, invalid }: { value?: string; invalid?: boolean }) {
  return (
    <div className="space-y-1">
      <label htmlFor="email" className="block text-xs text-dim">Correo</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={value}
        placeholder="tu@dominio.com"
        aria-invalid={invalid}
        className={inputClass}
      />
    </div>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState(signInWithPassword, initialPassword);

  return (
    <form action={action} className="space-y-3">
      {state.status === "invalid" && <p role="alert" className={errorClass}>Correo o contraseña incorrectos.</p>}
      {state.status === "wait" && (
        <p role="alert" className={warningClass}>Demasiados intentos. Espera unos minutos.</p>
      )}
      <EmailField value={state.email} invalid={state.status === "invalid"} />
      <div className="space-y-1">
        <label htmlFor="password" className="block text-xs text-dim">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          maxLength={72}
          autoComplete="current-password"
          aria-invalid={state.status === "invalid"}
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function MagicLinkForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialLink);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-dim">
        Si <span className="font-mono text-fg">{state.email}</span> tiene acceso, te llegará un enlace. Ábrelo en este
        mismo navegador.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {linkExpired && state.status === "idle" && (
        <p role="alert" className={errorClass}>Ese enlace ya se usó o ha caducado. Pide uno nuevo.</p>
      )}
      {state.status === "wait" && (
        <p role="alert" className={warningClass}>Acabamos de enviar un correo. Espera un minuto antes de pedir otro.</p>
      )}
      {state.status === "quota" && (
        <p role="alert" className={warningClass}>Se alcanzó el límite de correos por hora. Inténtalo más tarde.</p>
      )}
      {state.status === "invalid" && <p role="alert" className={errorClass}>Revisa el correo, no parece válido.</p>}
      <EmailField value={state.email} invalid={state.status === "invalid"} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Enviando enlace…" : "Enviar enlace de acceso"}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [linkExpired, setLinkExpired] = useState(false);

  // Supabase devuelve los errores del enlace en el fragmento, que el servidor no ve.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!hash.has("error_code")) return;
    setLinkExpired(true);
    setMode("link");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="space-y-3">
      {mode === "password" ? <PasswordForm /> : <MagicLinkForm linkExpired={linkExpired} />}
      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "link" : "password")}
        className="cursor-pointer text-xs text-dim underline underline-offset-2 hover:text-fg"
      >
        {mode === "password" ? "Entrar con enlace por correo" : "Entrar con contraseña"}
      </button>
    </div>
  );
}
