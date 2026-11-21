import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl, supabaseEnv } from "@/lib/env";

const PUBLIC_PATHS = new Set(["/", "/legal", "/login", "/auth/callback", "/api/health"]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, searchParams } = request.nextUrl;

  // Si la URL de retorno no está permitida, Supabase vuelve a la Site URL con el código.
  const code = searchParams.get("code");
  if (pathname === "/" && code) {
    return NextResponse.redirect(`${siteUrl()}/auth/callback?code=${encodeURIComponent(code)}`);
  }

  if (!user && !PUBLIC_PATHS.has(pathname)) {
    // Detrás del proxy de Coolify, request.url apunta al host interno.
    return NextResponse.redirect(`${siteUrl()}/login`);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
