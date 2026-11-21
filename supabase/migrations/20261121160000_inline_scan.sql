-- AuditForge — escaneo recon/passive ejecutado por el servidor (service_role).
-- Las puertas de alcance se imponen aquí también. El servidor solo llama a estas RPC
-- tras comprobar la sesión del usuario. No soporta modo active (eso va por el worker aislado).

-- Helper de deduplicación/upsert, compartido por las RPC inline.
create function private.upsert_finding(
  p_scan public.scans, p_title text, p_severity public.severity,
  p_category text, p_cwe text, p_location text,
  p_description text, p_evidence jsonb, p_remediation text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_fingerprint text;
  v_finding_id uuid;
begin
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_array(
    lower(btrim(p_title)), lower(btrim(coalesce(p_category, ''))),
    upper(btrim(coalesce(p_cwe, ''))), lower(btrim(coalesce(p_location, '')))
  )::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.findings as f (
    asset_id, user_id, first_scan_id, last_scan_id, fingerprint, title, severity,
    category, cwe, location, description, evidence, remediation
  ) values (
    p_scan.asset_id, p_scan.user_id, p_scan.id, p_scan.id, v_fingerprint, p_title, p_severity,
    p_category, p_cwe, p_location, p_description, p_evidence, p_remediation
  )
  on conflict (asset_id, fingerprint) do update
    set last_scan_id = excluded.last_scan_id, last_seen = now(), severity = excluded.severity,
        description = coalesce(excluded.description, f.description),
        evidence = coalesce(excluded.evidence, f.evidence),
        remediation = coalesce(excluded.remediation, f.remediation),
        status = case when f.status = 'fixed' then 'open'::public.finding_status else f.status end
  returning f.id into v_finding_id;

  insert into public.finding_occurrences (finding_id, scan_id, evidence)
  values (v_finding_id, p_scan.id, p_evidence)
  on conflict (finding_id, scan_id) do update set evidence = excluded.evidence, seen_at = now();
  return v_finding_id;
end $$;

-- Crea el scan tras pasar las puertas. Solo recon/passive.
create function public.start_inline_scan(p_user_id uuid, p_asset_id uuid, p_mode public.scan_mode)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_asset public.assets;
  v_error text;
  v_scan_id uuid;
begin
  if p_mode = 'active' then
    raise exception 'el escaneo inline no soporta el modo active' using errcode = '22023';
  end if;
  select * into v_asset from public.assets where id = p_asset_id and user_id = p_user_id for share;
  v_error := private.scope_gate_error(v_asset, p_mode);
  if v_error is not null then
    perform private.audit(p_user_id, 'scan.rejected', coalesce(v_asset.value, p_asset_id::text),
                          jsonb_build_object('reason', v_error, 'mode', p_mode));
    raise exception 'escaneo rechazado: %', v_error using errcode = '42501';
  end if;

  insert into public.scans (asset_id, user_id, mode, status, started_at)
  values (p_asset_id, p_user_id, p_mode, 'running', now())
  returning id into v_scan_id;

  perform private.audit(p_user_id, 'scan.launch', v_asset.value,
                        jsonb_build_object('scan_id', v_scan_id, 'mode', p_mode, 'runner', 'inline'));
  return v_scan_id;
end $$;

create function public.append_inline_log(p_scan_id uuid, p_level text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.scan_logs (scan_id, level, message)
  values (p_scan_id, coalesce(p_level, 'info'), left(p_message, 16000));
end $$;

-- Inserta un lote de hallazgos. p_findings: array JSON de objetos
-- {title, severity, category, cwe, location, description, evidence, remediation}.
create function public.submit_inline_findings(p_scan_id uuid, p_findings jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_scan public.scans;
  v_item jsonb;
  v_count integer := 0;
begin
  select * into v_scan from public.scans where id = p_scan_id;
  if not found then raise exception 'scan no encontrado' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_findings) <> 'array' then
    raise exception 'p_findings debe ser un array' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_findings) loop
    perform private.upsert_finding(
      v_scan,
      v_item ->> 'title',
      coalesce((v_item ->> 'severity')::public.severity, 'info'),
      v_item ->> 'category',
      v_item ->> 'cwe',
      v_item ->> 'location',
      v_item ->> 'description',
      v_item -> 'evidence',
      v_item ->> 'remediation'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.finish_inline_scan(
  p_scan_id uuid, p_status text, p_summary text default null, p_engine_version text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('done', 'failed', 'cancelled') then
    raise exception 'estado final no válido: %', p_status using errcode = '22023';
  end if;
  update public.scans
     set status = p_status::public.scan_status, finished_at = now(),
         summary = p_summary, engine_version = p_engine_version
   where id = p_scan_id;
end $$;

-- Permisos: solo el servidor (service_role).
revoke all on function private.upsert_finding(public.scans, text, public.severity, text, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.start_inline_scan(uuid, uuid, public.scan_mode) from public, anon, authenticated;
revoke all on function public.append_inline_log(uuid, text, text) from public, anon, authenticated;
revoke all on function public.submit_inline_findings(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.finish_inline_scan(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.start_inline_scan(uuid, uuid, public.scan_mode) to service_role;
grant execute on function public.append_inline_log(uuid, text, text) to service_role;
grant execute on function public.submit_inline_findings(uuid, jsonb) to service_role;
grant execute on function public.finish_inline_scan(uuid, text, text, text) to service_role;
