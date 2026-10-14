import { describe, it, expect } from "vitest";
import { insurers, sampleDocuments, apiDocument } from "../src/lib/catalog";
import {
  searchSamples,
  searchOptions,
  retrieveAll,
  simulatedProvider,
} from "../src/server/provider";
import { createSamplePdf } from "../src/server/pdf";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
const ids = insurers.map((i) => i.uuid);
describe("Document API contract and pagination", () => {
  it("has 18 documents, unique IDs, and valid insurer/file relationships", () => {
    expect(sampleDocuments).toHaveLength(18);
    expect(new Set(sampleDocuments.map((d) => d.uuid)).size).toBe(18);
    const files = sampleDocuments.flatMap((d) => d.files);
    expect(new Set(files.map((f) => f.uuid)).size).toBe(21);
    for (const d of sampleDocuments) {
      expect(ids).toContain(d.insuranceCompanyUuid);
      expect(d.files.length).toBeGreaterThan(0);
    }
  });
  it("corrects the insurer 401 response without changing contract vocabulary", () => {
    const schema = parse(readFileSync("contracts/DocumentApi.yaml", "utf8"));
    expect(schema.paths["/insurance-infos"].get.responses["401"].$ref).toBe(
      "#/components/responses/UnauthorizedError",
    );
    expect(schema.components.schemas.BusinessLine.enum).toContain("casuality");
    expect(schema.components.schemas.DocumentCategory.enum).toEqual([
      "application",
      "policy",
      "billing",
      "service",
      "benefitClaim",
    ]);
    expect(apiDocument(sampleDocuments[0])).not.toHaveProperty("amount");
    expect(apiDocument(sampleDocuments[0])).not.toHaveProperty("titleI18n");
  });
  it("validates required sorting, timestamps and inverted bounds", () => {
    for (const query of [
      "",
      "?sortAsc=yes",
      "?sortAsc=true&fromTimestamp=bad",
      "?sortAsc=true&fromTimestamp=2026-02-30T08:00:00Z",
      "?sortAsc=false&fromTimestamp=2026-09-10T00:00:00Z&toTimestamp=2026-09-01T00:00:00Z",
    ])
      expect(() =>
        searchOptions(new URL("http://localhost/documents" + query)),
      ).toThrow();
    expect(
      searchOptions(new URL("http://localhost/documents?sortAsc=false")),
    ).toEqual({ sortAsc: false });
  });
  it("applies inclusive date boundaries and both sort orders", () => {
    const result = searchSamples(ids, {
      sortAsc: true,
      fromTimestamp: "2026-09-06T08:00:00Z",
      toTimestamp: "2026-09-07T08:00:00Z",
    });
    expect(result.documents).toHaveLength(6);
    expect(result.resultLimitExceeded).toBe(false);
    expect(result.documents[0].publishedAt).toBe("2026-09-06T08:00:00.000Z");
    expect(
      searchSamples(ids, { sortAsc: false }).documents[0].publishedAt,
    ).toBe("2026-09-09T08:00:00.000Z");
    expect(searchSamples([], { sortAsc: true }).documents).toEqual([]);
  });
  it("keeps an entire boundary timestamp group even with a limit of one", () => {
    const page = searchSamples(ids, { sortAsc: true }, 1);
    expect(page.documents).toHaveLength(3);
    expect(new Set(page.documents.map((d) => d.publishedAt)).size).toBe(1);
    expect(page.resultLimitExceeded).toBe(true);
  });
  it("retrieves every page without omissions or duplicates", async () => {
    const result = await retrieveAll(simulatedProvider, ids[0]);
    expect(result).toHaveLength(6);
    expect(new Set(result.map((d) => d.uuid)).size).toBe(6);
  });
  it("fails explicitly when a provider stops making progress", async () => {
    await expect(
      retrieveAll(
        {
          ...simulatedProvider,
          search: async () => ({ documents: [], resultLimitExceeded: true }),
        },
        ids[0],
      ),
    ).rejects.toThrow("PAGINATION_STALLED");
  });
});
describe("Sample PDFs", () => {
  it("creates readable, labeled PDF files for both languages and multiple attachments", async () => {
    for (const locale of ["de", "en"] as const)
      for (const [index] of sampleDocuments[0].files.entries()) {
        const bytes = await createSamplePdf(sampleDocuments[0], index, locale);
        expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
        const pdf = await PDFDocument.load(bytes);
        expect(pdf.getPageCount()).toBe(1);
        expect(pdf.getTitle()).toMatch(/SAMPLE|MUSTER/);
      }
  });
});
