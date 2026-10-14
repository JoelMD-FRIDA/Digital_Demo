export function authConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
export function siteOrigin() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    .origin;
}
