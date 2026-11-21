-- Fija la contraseña de los roles de servicio que usan Auth (GoTrue) y REST (PostgREST).
\set pgpass `echo "$POSTGRES_PASSWORD"`
alter user authenticator with password :'pgpass';
alter user supabase_auth_admin with password :'pgpass';
