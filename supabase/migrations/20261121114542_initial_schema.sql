-- AuditForge — esquema inicial (Supabase / Postgres)
-- Aplicar con: supabase db push
--
-- Modelo de permisos:
--   authenticated      lee lo suyo; solo edita campos descriptivos y el estado de findings.
--   service_role       (solo servidor Next) lee y muta el alcance únicamente mediante RPC.
--   auditforge_worker  (solo worker) ejecuta funciones del esquema worker; sin acceso a tablas.
-- Los grants usan listas explícitas para no afectar a otras tablas del proyecto.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema private;
create schema worker;
revoke all on schema private from public;
revoke all on schema worker from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'auditforge_worker') then
    create role auditforge_worker nologin noinherit;
  end if;
end $$;
grant usage on schema worker to auditforge_worker;

-- ───────────────────────── enums ─────────────────────────
create type public.asset_type     as enum ('domain','repo','ip','app');
create type public.scan_mode      as enum ('recon','passive','active');
create type public.scan_status    as enum ('queued','running','done','failed','cancelled');
create type public.severity       as enum ('info','low','medium','high','critical');
create type public.finding_status as enum ('open','triaged','fixed','accepted','false_positive');

-- ──────────────────────── assets ─────────────────────────
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  type public.asset_type not null,
  value text not null,                       -- normalizado por trigger
  ownership_verified boolean not null default false,
  verification_method text,
  verification_token text not null,          -- generado por trigger
  verified_at timestamptz,
  verification_expires_at timestamptz,
  allowlisted boolean not null default false,
  active_mode_enabled boolean not null default false,
  scope_notes text,
  created_at timestamptz not null default now(),
  unique (user_id, type, value),
  unique (id, user_id),
  constraint verification_complete check (
    not ownership_verified
    or (verification_method is not null and verified_at is not null and verification_expires_at is not null)
  ),
  constraint verification_method_matches_type check (
    verification_method is null
    or (type = 'domain' and verification_method in ('dns_txt','well_known'))
    or (type = 'repo'   and verification_method = 'repo_file')
    or (type in ('ip','app') and verification_method = 'well_known')
  ),
  constraint allowlist_requires_verification check (not allowlisted or ownership_verified),
  constraint active_requires_allowlist check (not active_mode_enabled or allowlisted)
);

-- ───────────────────────── scans ─────────────────────────
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.scan_mode not null default 'recon',
  status public.scan_status not null default 'queued',
  active_confirmed_at timestamptz,
  engine_version text,
  summary text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (asset_id, user_id) references public.assets(id, user_id) on delete cascade,
  constraint active_requires_confirmation check (mode <> 'active' or active_confirmed_at is not null)
);
create index scans_asset_idx on public.scans (asset_id, created_at desc);
create index scans_user_idx on public.scans (user_id, created_at desc);

-- ──────────────────────── findings ───────────────────────
-- Un finding es una vulnerabilidad estable del activo; cada scan que la ve añade una ocurrencia.
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_scan_id uuid references public.scans(id) on delete set null,
  last_scan_id uuid references public.scans(id) on delete set null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  title text not null,
  severity public.severity not null default 'info',
  category text,
  cwe text,
  location text,                             -- endpoint, fichero o parámetro afectado
  description text,
  evidence jsonb,
  remediation text,
  status public.finding_status not null default 'open',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  foreign key (asset_id, user_id) references public.assets(id, user_id) on delete cascade,
  unique (asset_id, fingerprint)
);
create index findings_asset_severity_idx on public.findings (asset_id, severity);
create index findings_user_status_idx on public.findings (user_id, status);
create index findings_first_scan_idx on public.findings (first_scan_id);
create index findings_last_scan_idx on public.findings (last_scan_id);

create table public.finding_occurrences (
  finding_id uuid not null references public.findings(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  evidence jsonb,
  seen_at timestamptz not null default now(),
  primary key (finding_id, scan_id)
);
create index finding_occurrences_scan_idx on public.finding_occurrences (scan_id);

-- ──────────────────────── scan_logs ──────────────────────
create table public.scan_logs (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.scans(id) on delete cascade,
  ts timestamptz not null default now(),
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  message text not null
);
create index scan_logs_scan_ts_idx on public.scan_logs (scan_id, ts);

-- ────────────────────────── jobs ─────────────────────────
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null unique references public.scans(id) on delete cascade,
  jti uuid not null unique,                  -- identificador de un solo uso del token
  scope_token text not null,                 -- JWT EdDSA: {jti,scan_id,asset_id,value,mode,exp}
  token_expires_at timestamptz not null,
  payload jsonb not null,                    -- construido por launch_scan desde la BD
  status text not null default 'pending'
    check (status in ('pending','claimed','done','failed','cancelled')),
  cancel_requested boolean not null default false,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index jobs_pending_idx on public.jobs (created_at) where status = 'pending';
create index jobs_claimed_lease_idx on public.jobs (lease_expires_at) where status = 'claimed';

-- ─────────────────────── audit_events ────────────────────
-- Sin FK a auth.users: la bitácora debe sobrevivir al borrado de la cuenta.
create table public.audit_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,                      -- 'scan.launch','asset.verify','active.enable'...
  target text,
  meta jsonb,
  ts timestamptz not null default now()
);
create index audit_events_user_ts_idx on public.audit_events (user_id, ts desc);

-- ─────────────────────── helpers internos ────────────────
create function private.audit(p_user_id uuid, p_action text, p_target text, p_meta jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (user_id, action, target, meta)
  values (p_user_id, p_action, p_target, p_meta);
$$;

-- Devuelve el motivo de rechazo, o null si el activo pasa las tres puertas.
create function private.scope_gate_error(p_asset public.assets, p_mode public.scan_mode)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if p_asset.id is null then return 'activo inexistente'; end if;
  if not p_asset.ownership_verified then return 'propiedad no verificada'; end if;
  if p_asset.verification_expires_at <= now() then return 'verificación caducada'; end if;
  if not p_asset.allowlisted then return 'activo fuera de la allowlist'; end if;
  if p_mode = 'active' and not p_asset.active_mode_enabled then return 'modo active no habilitado'; end if;
  return null;
end $$;

create function private.prepare_asset()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_raw text := btrim(new.value);
  v_url text[];
begin
  case new.type
    when 'domain' then
      new.value := rtrim(lower(v_raw), '.');
      if new.value !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$' then
        raise exception 'dominio no válido: %', v_raw using errcode = '22023';
      end if;
    when 'ip' then
      if position('/' in v_raw) > 0 then
        raise exception 'indica una IP única, no un rango' using errcode = '22023';
      end if;
      new.value := host(v_raw::inet);
    else
      -- Sin credenciales en la URL, query ni fragmento.
      v_url := regexp_match(v_raw, '^(https?)://([^/:?#@[:space:]]+)(:[0-9]{1,5})?(/[^?#[:space:]]*)?$', 'i');
      if v_url is null then
        raise exception 'URL no válida: %', v_raw using errcode = '22023';
      end if;
      new.value := lower(v_url[1]) || '://' || lower(v_url[2]) || coalesce(v_url[3], '')
                   || rtrim(coalesce(v_url[4], ''), '/');
      if new.type = 'repo' then
        new.value := regexp_replace(new.value, '\.git$', '');
        if lower(v_url[1]) <> 'https' or coalesce(rtrim(v_url[4], '/'), '') = '' then
          raise exception 'el repositorio debe ser una URL https con ruta' using errcode = '22023';
        end if;
      end if;
  end case;

  if tg_op = 'INSERT' then
    new.verification_token := encode(extensions.gen_random_bytes(16), 'hex');
  elsif new.value is distinct from old.value or new.type is distinct from old.type then
    -- Cambiar el objetivo invalida toda autorización previa.
    new.ownership_verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verification_expires_at := null;
    new.allowlisted := false;
    new.active_mode_enabled := false;
    new.verification_token := encode(extensions.gen_random_bytes(16), 'hex');
  end if;
  return new;
end $$;

create trigger assets_prepare
  before insert or update of type, value on public.assets
  for each row execute function private.prepare_asset();

create function private.audit_asset_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit(new.user_id, 'asset.create', new.value, jsonb_build_object('asset_id', new.id));
    return new;
  end if;
  perform private.audit(old.user_id, 'asset.delete', old.value, jsonb_build_object('asset_id', old.id));
  return old;
end $$;

create trigger assets_audit
  after insert or delete on public.assets
  for each row execute function private.audit_asset_change();

-- Última línea de defensa: ningún job entra sin pasar las puertas.
create function private.enforce_job_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_scan public.scans;
  v_asset public.assets;
  v_error text;
begin
  select * into v_scan from public.scans where id = new.scan_id;
  select * into v_asset from public.assets where id = v_scan.asset_id;
  v_error := private.scope_gate_error(v_asset, v_scan.mode);
  if v_error is not null then
    raise exception 'job rechazado: %', v_error using errcode = '42501';
  end if;
  if v_scan.status <> 'queued' then
    raise exception 'job rechazado: el scan no está en cola' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger jobs_enforce_scope
  before insert on public.jobs
  for each row execute function private.enforce_job_scope();

create function private.block_audit_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'audit_events es de solo inserción' using errcode = '42501';
end $$;

create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function private.block_audit_mutation();
create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function private.block_audit_mutation();

create function private.expire_jobs()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Los tokens son de un solo uso: un job caducado no se reintenta, se relanza.
  with expired as (
    update public.jobs j
       set status = 'failed', finished_at = now()
     where j.id in (
       select id from public.jobs
        where (status = 'pending' and token_expires_at <= now())
           or (status = 'claimed' and lease_expires_at <= now())
        for update skip locked
     )
    returning j.scan_id
  )
  update public.scans s
     set status = 'failed', finished_at = now(),
         summary = coalesce(s.summary, 'Job caducado o worker sin latido')
    from expired e
   where s.id = e.scan_id and s.status in ('queued','running');
end $$;

create function private.owned_job(p_job_id uuid, p_worker_id text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs
   where id = p_job_id and claimed_by = p_worker_id
     and status = 'claimed' and lease_expires_at > now()
   for update;
  if not found then
    raise exception 'job no reclamado por este worker o lease caducado' using errcode = '42501';
  end if;
  return v_job;
end $$;

-- ───────────────── RPC del servidor (service_role) ───────
create function public.mark_asset_verified(p_user_id uuid, p_asset_id uuid, p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_value text;
begin
  update public.assets
     set ownership_verified = true, verification_method = p_method,
         verified_at = now(), verification_expires_at = now() + interval '30 days'
   where id = p_asset_id and user_id = p_user_id
  returning value into v_value;
  if not found then raise exception 'activo no encontrado' using errcode = 'P0002'; end if;
  perform private.audit(p_user_id, 'asset.verify', v_value, jsonb_build_object('method', p_method));
end $$;

create function public.revoke_asset_verification(p_user_id uuid, p_asset_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_value text;
begin
  update public.assets
     set ownership_verified = false, verification_method = null, verified_at = null,
         verification_expires_at = null, allowlisted = false, active_mode_enabled = false
   where id = p_asset_id and user_id = p_user_id
  returning value into v_value;
  if not found then raise exception 'activo no encontrado' using errcode = 'P0002'; end if;
  update public.jobs j set cancel_requested = true
    from public.scans s
   where j.scan_id = s.id and s.asset_id = p_asset_id and j.status in ('pending','claimed');
  perform private.audit(p_user_id, 'asset.unverify', v_value, jsonb_build_object('reason', p_reason));
end $$;

create function public.set_asset_allowlisted(p_user_id uuid, p_asset_id uuid, p_allowlisted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_value text;
begin
  update public.assets
     set allowlisted = p_allowlisted,
         active_mode_enabled = active_mode_enabled and p_allowlisted
   where id = p_asset_id and user_id = p_user_id
     and (not p_allowlisted or (ownership_verified and verification_expires_at > now()))
  returning value into v_value;
  if not found then
    raise exception 'activo no encontrado o sin verificación vigente' using errcode = '42501';
  end if;
  perform private.audit(p_user_id, case when p_allowlisted then 'allowlist.add' else 'allowlist.remove' end, v_value);
end $$;

create function public.set_active_mode(p_user_id uuid, p_asset_id uuid, p_enabled boolean, p_confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_value text;
begin
  if p_enabled and not coalesce(p_confirmed, false) then
    raise exception 'el modo active requiere confirmación explícita' using errcode = '42501';
  end if;
  update public.assets
     set active_mode_enabled = p_enabled
   where id = p_asset_id and user_id = p_user_id
     and (not p_enabled or (allowlisted and ownership_verified and verification_expires_at > now()))
  returning value into v_value;
  if not found then
    raise exception 'activo no encontrado o fuera de alcance' using errcode = '42501';
  end if;
  perform private.audit(p_user_id, case when p_enabled then 'active.enable' else 'active.disable' end, v_value);
end $$;

-- El servidor genera scan_id y jti, firma el token y lo entrega aquí en una sola transacción.
create function public.launch_scan(
  p_user_id uuid, p_scan_id uuid, p_asset_id uuid, p_value text, p_mode public.scan_mode,
  p_active_confirmed boolean, p_jti uuid, p_scope_token text, p_token_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_asset public.assets;
  v_error text;
begin
  select * into v_asset from public.assets
   where id = p_asset_id and user_id = p_user_id for share;
  v_error := private.scope_gate_error(v_asset, p_mode);
  if v_error is not null then
    perform private.audit(p_user_id, 'scan.rejected', p_value, jsonb_build_object('reason', v_error, 'mode', p_mode));
    raise exception 'escaneo rechazado: %', v_error using errcode = '42501';
  end if;
  if v_asset.value <> p_value then
    raise exception 'escaneo rechazado: el objetivo no coincide con el activo' using errcode = '42501';
  end if;
  if p_mode = 'active' and not coalesce(p_active_confirmed, false) then
    raise exception 'escaneo rechazado: falta la confirmación de modo active' using errcode = '42501';
  end if;
  if p_token_expires_at <= now() or p_token_expires_at > now() + interval '1 hour' then
    raise exception 'escaneo rechazado: caducidad de token fuera de rango' using errcode = '42501';
  end if;

  insert into public.scans (id, asset_id, user_id, mode, active_confirmed_at)
  values (p_scan_id, p_asset_id, p_user_id, p_mode, case when p_mode = 'active' then now() end);

  insert into public.jobs (scan_id, jti, scope_token, token_expires_at, payload)
  values (p_scan_id, p_jti, p_scope_token, p_token_expires_at,
          jsonb_build_object('scan_id', p_scan_id, 'asset_id', p_asset_id,
                             'type', v_asset.type, 'value', v_asset.value, 'mode', p_mode));

  perform private.audit(p_user_id, 'scan.launch', v_asset.value,
                        jsonb_build_object('scan_id', p_scan_id, 'mode', p_mode));
  return p_scan_id;
end $$;

-- ───────────────── RPC de usuario (authenticated) ────────
create function public.cancel_scan(p_scan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_scan public.scans;
begin
  select * into v_scan from public.scans
   where id = p_scan_id and user_id = auth.uid() for update;
  if not found then raise exception 'scan no encontrado' using errcode = 'P0002'; end if;

  if v_scan.status = 'queued' then
    update public.jobs set status = 'cancelled', finished_at = now()
     where scan_id = p_scan_id and status = 'pending';
    update public.scans set status = 'cancelled', finished_at = now() where id = p_scan_id;
  elsif v_scan.status = 'running' then
    update public.jobs set cancel_requested = true where scan_id = p_scan_id and status = 'claimed';
  else
    return;
  end if;
  perform private.audit(v_scan.user_id, 'scan.cancel', p_scan_id::text);
end $$;

-- ───────────────── RPC del worker (auditforge_worker) ────
create function worker.claim_job(p_worker_id text)
returns table (job_id uuid, scan_id uuid, scope_token text, payload jsonb, lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_scan public.scans;
  v_asset public.assets;
  v_error text;
begin
  perform private.expire_jobs();
  loop
    select * into v_job from public.jobs j
     where j.status = 'pending' and j.token_expires_at > now() and not j.cancel_requested
     order by j.created_at
     for update skip locked
     limit 1;
    if not found then return; end if;

    select * into v_scan from public.scans s where s.id = v_job.scan_id for update;
    select * into v_asset from public.assets a where a.id = v_scan.asset_id for share;
    v_error := private.scope_gate_error(v_asset, v_scan.mode);

    if v_error is null then
      update public.jobs j
         set status = 'claimed', claimed_by = p_worker_id, claimed_at = now(),
             lease_expires_at = now() + interval '2 minutes'
       where j.id = v_job.id
      returning * into v_job;
      update public.scans s set status = 'running', started_at = now() where s.id = v_scan.id;
      perform private.audit(v_scan.user_id, 'job.claim', v_asset.value,
                            jsonb_build_object('job_id', v_job.id, 'worker', p_worker_id));
      job_id := v_job.id; scan_id := v_job.scan_id; scope_token := v_job.scope_token;
      payload := v_job.payload; lease_expires_at := v_job.lease_expires_at;
      return next;
      return;
    end if;

    update public.jobs j set status = 'failed', finished_at = now() where j.id = v_job.id;
    update public.scans s set status = 'failed', finished_at = now(),
           summary = 'Rechazado al reclamar: ' || v_error where s.id = v_scan.id;
    perform private.audit(v_scan.user_id, 'scope.rejected', v_asset.value,
                          jsonb_build_object('job_id', v_job.id, 'reason', v_error));
  end loop;
end $$;

-- Devuelve false si el worker debe parar (cancelación o alcance revocado).
create function worker.heartbeat(p_job_id uuid, p_worker_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_scan public.scans;
  v_asset public.assets;
begin
  v_job := private.owned_job(p_job_id, p_worker_id);
  select * into v_scan from public.scans where id = v_job.scan_id;
  select * into v_asset from public.assets where id = v_scan.asset_id;
  if private.scope_gate_error(v_asset, v_scan.mode) is not null then
    v_job.cancel_requested := true;
  end if;
  update public.jobs
     set lease_expires_at = now() + interval '2 minutes', cancel_requested = v_job.cancel_requested
   where id = p_job_id;
  return not v_job.cancel_requested;
end $$;

create function worker.append_log(p_job_id uuid, p_worker_id text, p_level text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.jobs;
begin
  v_job := private.owned_job(p_job_id, p_worker_id);
  insert into public.scan_logs (scan_id, level, message)
  values (v_job.scan_id, p_level, left(p_message, 16000));
end $$;

create function worker.submit_finding(
  p_job_id uuid, p_worker_id text, p_title text, p_severity public.severity,
  p_category text default null, p_cwe text default null, p_location text default null,
  p_description text default null, p_evidence jsonb default null, p_remediation text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_scan public.scans;
  v_fingerprint text;
  v_finding_id uuid;
begin
  v_job := private.owned_job(p_job_id, p_worker_id);
  select * into v_scan from public.scans where id = v_job.scan_id;

  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_array(
    lower(btrim(p_title)), lower(btrim(coalesce(p_category, ''))),
    upper(btrim(coalesce(p_cwe, ''))), lower(btrim(coalesce(p_location, '')))
  )::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.findings as f (
    asset_id, user_id, first_scan_id, last_scan_id, fingerprint, title, severity,
    category, cwe, location, description, evidence, remediation
  ) values (
    v_scan.asset_id, v_scan.user_id, v_scan.id, v_scan.id, v_fingerprint, p_title, p_severity,
    p_category, p_cwe, p_location, p_description, p_evidence, p_remediation
  )
  on conflict (asset_id, fingerprint) do update
    set last_scan_id = excluded.last_scan_id, last_seen = now(), severity = excluded.severity,
        description = coalesce(excluded.description, f.description),
        evidence = coalesce(excluded.evidence, f.evidence),
        remediation = coalesce(excluded.remediation, f.remediation),
        -- Si reaparece algo marcado como corregido, es una regresión.
        status = case when f.status = 'fixed' then 'open'::public.finding_status else f.status end
  returning f.id into v_finding_id;

  insert into public.finding_occurrences (finding_id, scan_id, evidence)
  values (v_finding_id, v_scan.id, p_evidence)
  on conflict (finding_id, scan_id) do update set evidence = excluded.evidence, seen_at = now();
  return v_finding_id;
end $$;

create function worker.finish_job(
  p_job_id uuid, p_worker_id text, p_status text,
  p_summary text default null, p_engine_version text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_status text := p_status;
begin
  if p_status not in ('done','failed','cancelled') then
    raise exception 'estado final no válido: %', p_status using errcode = '22023';
  end if;
  v_job := private.owned_job(p_job_id, p_worker_id);
  if v_job.cancel_requested and p_status = 'done' then v_status := 'cancelled'; end if;
  update public.jobs set status = v_status, finished_at = now(), lease_expires_at = null where id = p_job_id;
  update public.scans
     set status = v_status::public.scan_status, finished_at = now(),
         summary = p_summary, engine_version = p_engine_version
   where id = v_job.scan_id;
end $$;

-- El worker llama a esto si el token no valida o no coincide con el payload.
create function worker.report_scope_incident(p_job_id uuid, p_worker_id text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_user uuid;
begin
  v_job := private.owned_job(p_job_id, p_worker_id);
  select user_id into v_user from public.scans where id = v_job.scan_id;
  perform private.audit(v_user, 'scope.incident', v_job.payload ->> 'value',
                        jsonb_build_object('job_id', p_job_id, 'worker', p_worker_id, 'reason', p_reason));
  perform worker.finish_job(p_job_id, p_worker_id, 'failed', 'Abortado: incidente de alcance');
end $$;

-- ────────────────────────── RLS ──────────────────────────
alter table public.assets              enable row level security;
alter table public.scans               enable row level security;
alter table public.findings            enable row level security;
alter table public.finding_occurrences enable row level security;
alter table public.scan_logs           enable row level security;
alter table public.audit_events        enable row level security;
alter table public.jobs                enable row level security;  -- sin políticas ni grants

create policy "own assets read"   on public.assets for select to authenticated using (user_id = (select auth.uid()));
create policy "own assets insert" on public.assets for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own assets update" on public.assets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own assets delete" on public.assets for delete to authenticated using (user_id = (select auth.uid()));
create policy "own scans read"    on public.scans for select to authenticated using (user_id = (select auth.uid()));
create policy "own findings read" on public.findings for select to authenticated using (user_id = (select auth.uid()));
create policy "own findings triage" on public.findings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own occurrences read" on public.finding_occurrences for select to authenticated using (
  exists (select 1 from public.findings f where f.id = finding_id and f.user_id = (select auth.uid()))
);
create policy "own logs read" on public.scan_logs for select to authenticated using (
  exists (select 1 from public.scans s where s.id = scan_id and s.user_id = (select auth.uid()))
);
create policy "own audit read" on public.audit_events for select to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── grants ────────────────────────
revoke all on table public.assets, public.scans, public.findings, public.finding_occurrences,
  public.scan_logs, public.jobs, public.audit_events from public, anon, authenticated, service_role;

grant select on table public.assets, public.scans, public.findings, public.finding_occurrences,
  public.scan_logs, public.audit_events to authenticated, service_role;
grant insert (label, type, value, scope_notes) on table public.assets to authenticated;
grant update (label, value, scope_notes) on table public.assets to authenticated;  -- value resetea la verificación
grant delete on table public.assets to authenticated;
grant update (status) on table public.findings to authenticated;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
revoke all on all functions in schema worker from public, anon, authenticated, service_role;
grant execute on all functions in schema worker to auditforge_worker;

revoke all on function public.mark_asset_verified(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_asset_verification(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_asset_allowlisted(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_active_mode(uuid, uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.launch_scan(uuid, uuid, uuid, text, public.scan_mode, boolean, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cancel_scan(uuid) from public, anon, service_role;

grant execute on function public.mark_asset_verified(uuid, uuid, text) to service_role;
grant execute on function public.revoke_asset_verification(uuid, uuid, text) to service_role;
grant execute on function public.set_asset_allowlisted(uuid, uuid, boolean) to service_role;
grant execute on function public.set_active_mode(uuid, uuid, boolean, boolean) to service_role;
grant execute on function public.launch_scan(uuid, uuid, uuid, text, public.scan_mode, boolean, uuid, text, timestamptz)
  to service_role;
grant execute on function public.cancel_scan(uuid) to authenticated;

-- ──────────────────────── Realtime ───────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.scan_logs, public.scans, public.findings;
  end if;
end $$;
