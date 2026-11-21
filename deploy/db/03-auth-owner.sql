-- Deja que GoTrue (supabase_auth_admin) gestione el esquema auth: reasigna la propiedad de sus
-- funciones y del esquema, para que sus migraciones (create or replace auth.uid/role) no choquen
-- con las que ya creó la imagen de Supabase (propiedad de postgres).
do $$
declare r record;
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    for r in select p.oid::regprocedure as f
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'auth' loop
      execute 'alter function ' || r.f || ' owner to supabase_auth_admin';
    end loop;
    execute 'alter schema auth owner to supabase_auth_admin';
  end if;
end $$;
