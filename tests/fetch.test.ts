import { it, expect, vi, afterEach } from "vitest";
import { resilientSupabaseFetch } from "../src/lib/supabase/fetch";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("retries only an explicit pre-execution future-JWT rejection once", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { code: "PGRST303", message: "JWT issued at future" },
        { status: 401 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const request = resilientSupabaseFetch(
    "http://localhost/rest/v1/dd_documents",
  );
  await vi.runAllTimersAsync();
  expect((await request).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("does not replay invalid credentials or ambiguous mutation failures", async () => {
  for (const status of [401, 500, 503]) {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: "OTHER", message: "failure" }, { status }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await resilientSupabaseFetch(
          "http://localhost/rest/v1/rpc/dd_connect",
          { method: "POST", body: "{}" },
        )
      ).status,
    ).toBe(status);
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});
