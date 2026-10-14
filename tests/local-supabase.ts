import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
export function localSupabase() {
  const config = JSON.parse(
    execFileSync("npx", ["--yes", "supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (!["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname))
    throw new Error("Tests require a local Supabase instance.");
  return {
    url: config.API_URL as string,
    key: config.ANON_KEY as string,
    mail: config.MAILPIT_URL as string,
    admin: createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    client: () =>
      createClient(config.API_URL, config.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
  };
}
