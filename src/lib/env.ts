function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

// Next solo inyecta las NEXT_PUBLIC_ cuando se leen por su nombre literal.
export function supabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

// URL pública fija: no se deriva de cabeceras que puede manipular el cliente.
export function siteUrl(): string {
  return required("SITE_URL", process.env.SITE_URL).replace(/\/$/, "");
}
