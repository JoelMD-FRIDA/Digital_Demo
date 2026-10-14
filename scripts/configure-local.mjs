import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local")) {
  console.error(
    ".env.local already exists; keep it or move it before configuring a fresh local instance.",
  );
  process.exit(1);
}
const config = JSON.parse(
  execFileSync("npx", ["--yes", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (!["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname))
  throw new Error("Expected a local Supabase API.");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${config.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://localhost:3007\n`,
  { mode: 0o600 },
);
console.log(
  "Local configuration written. No service-role key is used by the application.",
);
