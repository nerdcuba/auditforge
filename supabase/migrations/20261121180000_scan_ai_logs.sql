-- AuditForge — registro en lote y resumen con IA para los escaneos.
alter table public.scans add column if not exists ai_summary text;
alter table public.scans add column if not exists ai_model text;

create function public.append_inline_logs(p_scan_id uuid, p_logs jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_count integer := 0;
begin
  if jsonb_typeof(p_logs) <> 'array' then
    raise exception 'p_logs debe ser un array' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_logs) loop
    insert into public.scan_logs (scan_id, level, message)
    values (p_scan_id, coalesce(v_item ->> 'level', 'info'), left(v_item ->> 'message', 16000));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.set_scan_ai(p_scan_id uuid, p_summary text, p_model text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.scans set ai_summary = p_summary, ai_model = p_model where id = p_scan_id;
end $$;

revoke all on function public.append_inline_logs(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_scan_ai(uuid, text, text) from public, anon, authenticated;
grant execute on function public.append_inline_logs(uuid, jsonb) to service_role;
grant execute on function public.set_scan_ai(uuid, text, text) to service_role;
