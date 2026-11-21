-- AuditForge — ajustes por usuario (clave de Claude cifrada, nivel por defecto).
-- La tabla solo la toca el servidor (service_role). El navegador nunca la lee:
-- la clave se cifra en el servidor y nunca se expone al cliente.

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anthropic_key_cipher text,                 -- AES-256-GCM, cifrado en el servidor
  anthropic_key_hint text,                   -- últimos caracteres, para mostrar
  default_level text not null default 'equilibrado'
    check (default_level in ('economico', 'equilibrado', 'maximo')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
-- Sin políticas: inaccesible para anon/authenticated. Solo el servidor (service_role).
revoke all on table public.user_settings from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.user_settings to service_role;
