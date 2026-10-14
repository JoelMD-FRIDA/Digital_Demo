import { serverClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/supabase/config";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next =
    url.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/";
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const db = await serverClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, siteOrigin()));
    } catch {
      /* Show a retryable sign-in error. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", siteOrigin()));
}
