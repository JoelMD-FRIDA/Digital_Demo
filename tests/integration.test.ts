import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localSupabase } from "./local-supabase";
import { insurers, sampleDocuments } from "../src/lib/catalog";
const origin = "http://localhost:3007";
describe.skipIf(process.env.RUN_LOCAL_INTEGRATION !== "1")(
  "real local Supabase and protected HTTP API",
  () => {
    let local: ReturnType<typeof localSupabase>;
    const accounts: { id: string; token: string; client: SupabaseClient }[] =
      [];
    beforeAll(async () => {
      local = localSupabase();
      for (let n = 0; n < 2; n++) {
        const email = `dd-integration-${Date.now()}-${n}@example.test`,
          password = "Local-testing-only-Password-123!";
        const { data, error } = await local.admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) throw error || new Error("No user");
        const client = local.client(),
          result = await client.auth.signInWithPassword({ email, password });
        accounts.push({
          id: data.user.id,
          client,
          token: result.data.session!.access_token,
        });
      }
    });
    afterAll(async () => {
      for (const account of accounts)
        await local.admin.auth.admin.deleteUser(account.id);
    });
    const call = (
      path: string,
      account = 0,
      value?: unknown,
      method = "POST",
      requestOrigin = origin,
    ) =>
      fetch(origin + path, {
        method: value === undefined ? "GET" : method,
        headers: {
          Authorization: `Bearer ${accounts[account].token}`,
          Origin: requestOrigin,
          "Content-Type": "application/json",
        },
        ...(value === undefined ? {} : { body: JSON.stringify(value) }),
      });
    it("rejects unauthenticated reads and malformed tokens", async () => {
      for (const path of [
        "/api/workspace",
        "/api/documents?sortAsc=true",
        "/api/insurance-infos",
        `/api/files/${sampleDocuments[0].files[0].uuid}`,
      ])
        expect((await fetch(origin + path)).status).toBe(401);
      expect(
        (
          await fetch(origin + "/api/workspace", {
            headers: { Authorization: "Bearer invalid" },
          })
        ).status,
      ).toBe(401);
    });
    it("starts real accounts empty and rejects cross-origin mutation or missing consent", async () => {
      const initial = await call("/api/workspace");
      const initialBody = await initial.json();
      expect(initial.status, JSON.stringify(initialBody)).toBe(200);
      expect(initialBody.documents).toEqual([]);
      expect(
        (
          await call(
            "/api/connections",
            0,
            {
              action: "connect",
              insurerId: insurers[0].uuid,
              accepted: true,
              locale: "de",
            },
            "POST",
            "https://other.example",
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call("/api/connections", 0, {
            action: "connect",
            insurerId: insurers[0].uuid,
            accepted: false,
            locale: "de",
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await call("/api/connections", 0, {
            action: "sync",
            insurerId: insurers[0].uuid,
          })
        ).status,
      ).toBe(409);
    });
    it("records consent, pages documents, and imports idempotently", async () => {
      expect(
        (
          await call("/api/connections", 0, {
            action: "connect",
            insurerId: insurers[0].uuid,
            accepted: true,
            locale: "de",
          })
        ).status,
      ).toBe(200);
      const search = await call("/api/documents?sortAsc=true");
      expect(search.status).toBe(200);
      const result = await search.json();
      expect(result.resultLimitExceeded).toBe(true);
      expect(result.documents.length).toBe(5);
      expect((await call("/api/documents")).status).toBe(400);
      const infos = await (await call("/api/insurance-infos")).json();
      expect(infos).toHaveLength(1);
      expect(infos[0].uuid).toBe(insurers[0].uuid);
      for (let n = 0; n < 2; n++)
        expect(
          (
            await call("/api/connections", 0, {
              action: "sync",
              insurerId: insurers[0].uuid,
            })
          ).status,
        ).toBe(200);
      const workspace = await (await call("/api/workspace")).json();
      expect(workspace.documents).toHaveLength(6);
      expect(workspace.connections[0].last_sync_at).toBeTruthy();
      const { data } = await accounts[0].client
        .from("dd_consent_events")
        .select("*");
      expect(data).toHaveLength(1);
      expect(data![0].version).toBe("1.0");
      expect(data![0].consent_text).toContain("Beispieldokumente");
    });
    it("enforces account isolation for reads, mutations, and downloads", async () => {
      const uuid = sampleDocuments[0].uuid,
        file = sampleDocuments[0].files[0].uuid;
      expect(
        (await (await call("/api/workspace", 1)).json()).documents,
      ).toEqual([]);
      expect((await call(`/api/files/${file}`, 1)).status).toBe(404);
      expect(
        (await call(`/api/documents/${uuid}`, 1, {}, "PATCH")).status,
      ).toBe(404);
      const other = await accounts[1].client
        .from("dd_documents")
        .select("*")
        .eq("user_id", accounts[0].id);
      expect(other.data).toEqual([]);
      const change = await accounts[1].client
        .from("dd_documents")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", accounts[0].id)
        .select();
      expect(change.data).toEqual([]);
      const forge = await accounts[1].client
        .from("dd_connections")
        .insert({
          user_id: accounts[0].id,
          insurer_id: insurers[1].uuid,
          status: "active",
        });
      expect(forge.error).toBeTruthy();
      const metadata = await accounts[0].client
        .from("dd_documents")
        .update({ metadata: {} })
        .eq("document_id", uuid);
      expect(metadata.error).toBeTruthy();
      expect(
        (await call(`/api/documents/${uuid}`, 0, {}, "PATCH")).status,
      ).toBe(200);
      const saved = await (await call("/api/workspace")).json();
      expect(
        saved.documents.find(
          (d: { document_id: string }) => d.document_id === uuid,
        ).read_at,
      ).toBeTruthy();
    });
    it("streams PDFs and preserves imported access after disconnect, then resets only the owner", async () => {
      const file = sampleDocuments[0].files[0].uuid;
      const pdf = await call(`/api/files/${file}?preview=1&locale=en`);
      expect(pdf.headers.get("content-type")).toBe("application/pdf");
      expect(
        Buffer.from(await pdf.arrayBuffer())
          .subarray(0, 4)
          .toString(),
      ).toBe("%PDF");
      expect(
        (await call("/api/files/00000000-0000-4000-8000-000000000000")).status,
      ).toBe(404);
      expect(
        (
          await call("/api/connections", 0, {
            action: "disconnect",
            insurerId: insurers[0].uuid,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call("/api/connections", 0, {
            action: "sync",
            insurerId: insurers[0].uuid,
          })
        ).status,
      ).toBe(409);
      expect((await call(`/api/files/${file}`)).status).toBe(200);
      expect(
        (await (await call("/api/documents?sortAsc=true")).json()).documents,
      ).toEqual([]);
      expect(
        (
          await call("/api/connections", 1, {
            action: "connect",
            insurerId: insurers[1].uuid,
            accepted: true,
            locale: "en",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call("/api/connections", 1, {
            action: "sync",
            insurerId: insurers[1].uuid,
          })
        ).status,
      ).toBe(200);
      expect((await call("/api/reset", 0, {})).status).toBe(200);
      expect(
        (await (await call("/api/workspace")).json()).documents,
      ).toHaveLength(0);
      expect(
        (await (await call("/api/workspace", 1)).json()).documents,
      ).toHaveLength(6);
      expect((await call(`/api/files/${file}`)).status).toBe(404);
      expect((await accounts[0].client.auth.getUser()).data.user?.id).toBe(
        accounts[0].id,
      );
    });
  },
);
