import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { resilientSupabaseFetch } from "./fetch";
import { authConfigured } from "./config";
export async function serverClient(request?: Request) {
  if (!authConfigured()) throw new Error("NOT_CONFIGURED");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authorization = request?.headers.get("authorization");
  if (authorization) {
    if (!/^Bearer [^\s]+$/i.test(authorization))
      throw new Error("UNAUTHORIZED");
    return createClient(url, key, {
      global: {
        headers: { Authorization: authorization },
        fetch: resilientSupabaseFetch,
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const store = await cookies();
  return createServerClient(url, key, {
    global: { fetch: resilientSupabaseFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          store.set(name, value, options);
      },
    },
  });
}
