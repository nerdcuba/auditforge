import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const base = siteUrl();
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}/app`);
  }

  return NextResponse.redirect(`${base}/login?error=enlace`);
}
