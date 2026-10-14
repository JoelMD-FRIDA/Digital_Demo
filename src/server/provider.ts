import { apiDocument, insurers, sampleDocuments } from "@/lib/catalog";
import type {
  Document,
  DocumentList,
  InsuranceInfo,
  DocumentFile,
  Locale,
} from "@/lib/types";
import { HttpError } from "./http";
import { createSamplePdf } from "./pdf";
export interface SearchOptions {
  fromTimestamp?: string;
  toTimestamp?: string;
  sortAsc: boolean;
}
export interface DocumentProvider {
  search(insurerIds: string[], options: SearchOptions): Promise<DocumentList>;
  insuranceInfos(insurerIds: string[]): Promise<InsuranceInfo[]>;
  fileInfo(uuid: string): Promise<{
    documentId: string;
    insurerId: string;
    file: DocumentFile;
  } | null>;
  fileContents(uuid: string, locale: Locale): Promise<Uint8Array>;
}
export function searchOptions(url: URL): SearchOptions {
  const ascending = url.searchParams.get("sortAsc");
  if (ascending !== "true" && ascending !== "false")
    throw new HttpError(400, "SORT_REQUIRED");
  const result: SearchOptions = { sortAsc: ascending === "true" };
  for (const key of ["fromTimestamp", "toTimestamp"] as const) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
          value,
        ) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(`${value.slice(0, 10)}T00:00:00Z`)
          .toISOString()
          .slice(0, 10) !== value.slice(0, 10)
      )
        throw new HttpError(400, "INVALID_TIMESTAMP");
      result[key] = value;
    }
  }
  if (
    result.fromTimestamp &&
    result.toTimestamp &&
    Date.parse(result.fromTimestamp) > Date.parse(result.toTimestamp)
  )
    throw new HttpError(400, "INVALID_RANGE");
  return result;
}
export function searchSamples(
  insurerIds: string[],
  options: SearchOptions,
  limit = 5,
): DocumentList {
  const matches = sampleDocuments
    .filter(
      (d) =>
        insurerIds.includes(d.insuranceCompanyUuid) &&
        (!options.fromTimestamp ||
          Date.parse(d.publishedAt) >= Date.parse(options.fromTimestamp)) &&
        (!options.toTimestamp ||
          Date.parse(d.publishedAt) <= Date.parse(options.toTimestamp)),
    )
    .sort(
      (a, b) =>
        (Date.parse(a.publishedAt) - Date.parse(b.publishedAt) ||
          a.uuid.localeCompare(b.uuid)) * (options.sortAsc ? 1 : -1),
    );
  // A page includes its entire boundary timestamp group. This avoids an unpageable
  // group when more documents share a timestamp than the nominal result limit.
  let end = Math.min(limit, matches.length);
  while (
    end > 0 &&
    end < matches.length &&
    matches[end].publishedAt === matches[end - 1].publishedAt
  )
    end++;
  return {
    documents: matches.slice(0, end).map((d) => apiDocument(d)),
    resultLimitExceeded: end < matches.length,
    listId: crypto.randomUUID(),
  };
}
export const simulatedProvider: DocumentProvider = {
  async search(ids, options) {
    return searchSamples(ids, options);
  },
  async fileInfo(uuid) {
    const document = sampleDocuments.find((d) =>
      d.files.some((f) => f.uuid === uuid),
    );
    return document
      ? {
          documentId: document.uuid,
          insurerId: document.insuranceCompanyUuid,
          file: document.files.find((f) => f.uuid === uuid)!,
        }
      : null;
  },
  async fileContents(uuid, locale) {
    const document = sampleDocuments.find((d) =>
      d.files.some((f) => f.uuid === uuid),
    );
    if (!document) throw new HttpError(404, "NOT_FOUND");
    return createSamplePdf(
      document,
      document.files.findIndex((f) => f.uuid === uuid),
      locale,
    );
  },
  async insuranceInfos(ids) {
    return insurers
      .filter((i) => ids.includes(i.uuid))
      .map(({ uuid, name, links }) => ({ uuid, name, links }));
  },
};
export async function retrieveAll(
  provider: DocumentProvider,
  insurerId: string,
): Promise<Document[]> {
  const found = new Map<string, Document>();
  let fromTimestamp: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const result = await provider.search([insurerId], {
      sortAsc: true,
      fromTimestamp,
    });
    result.documents.forEach((doc) => found.set(doc.uuid, doc));
    if (!result.resultLimitExceeded) return [...found.values()];
    const last = result.documents.at(-1)?.publishedAt;
    if (
      !last ||
      (fromTimestamp && Date.parse(last) < Date.parse(fromTimestamp))
    )
      throw new Error("PROVIDER_PAGINATION_STALLED");
    // Our simulator guarantees complete timestamp groups; advance exactly 1 ms.
    const next = new Date(Date.parse(last) + 1).toISOString();
    if (next === fromTimestamp) throw new Error("PROVIDER_PAGINATION_STALLED");
    fromTimestamp = next;
  }
  throw new Error("PROVIDER_PAGE_LIMIT");
}
