-- AuditForge — herramientas de escaneo desactivadas por usuario.
alter table public.user_settings add column if not exists disabled_tools jsonb not null default '[]'::jsonb;
