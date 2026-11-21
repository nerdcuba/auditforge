-- Índices para las claves foráneas compuestas hacia assets(id, user_id).
create index scans_asset_user_idx on public.scans (asset_id, user_id);
create index findings_asset_user_idx on public.findings (asset_id, user_id);
