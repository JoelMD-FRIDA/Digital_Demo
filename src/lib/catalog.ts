import type {
  Insurer,
  SampleDocument,
  Category,
  BusinessLine,
  Locale,
  Document,
} from "./types";
export const insurers: Insurer[] = [
  {
    uuid: "10000000-0000-4000-8000-000000000001",
    name: "Nordlicht",
    initials: "N",
    color: "#00696d",
    description: {
      de: "Für alles, was Ihnen wichtig ist.",
      en: "For everything that matters to you.",
    },
    product: {
      de: "Kfz & Privathaftpflicht",
      en: "Motor & personal liability",
    },
    links: [],
  },
  {
    uuid: "10000000-0000-4000-8000-000000000002",
    name: "Linden Leben",
    initials: "L",
    color: "#526a42",
    description: {
      de: "Heute an morgen denken.",
      en: "A little foresight for tomorrow.",
    },
    product: { de: "Leben & Altersvorsorge", en: "Life & retirement" },
    links: [],
  },
  {
    uuid: "10000000-0000-4000-8000-000000000003",
    name: "Elbe Gesund",
    initials: "E",
    color: "#446981",
    description: {
      de: "An Ihrer Seite. Ein Leben lang.",
      en: "By your side. Throughout life.",
    },
    product: {
      de: "Gesundheit & Zusatzschutz",
      en: "Health & supplementary cover",
    },
    links: [],
  },
];
const titles: [string, string, Category][] = [
  ["Ihr Versicherungsschein", "Your insurance policy", "policy"],
  [
    "Beitragsrechnung September 2026",
    "Premium statement September 2026",
    "billing",
  ],
  ["Ihre Vertragsinformationen", "Your policy information", "service"],
  ["Bestätigung Ihres Antrags", "Your application confirmation", "application"],
  ["Abrechnung Ihres Leistungsfalls", "Your claim settlement", "benefitClaim"],
  [
    "Nachtrag zu Ihrem Versicherungsschein",
    "Your policy endorsement",
    "policy",
  ],
];
const lines: BusinessLine[] = [
  "motorVehicleInsurance",
  "lifeInsurance",
  "health",
];
export const sampleDocuments: SampleDocument[] = insurers.flatMap(
  (insurer, provider) =>
    titles.map(([de, en, category], index) => {
      const id = provider * 6 + index + 1;
      const uuid = `20000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
      const file = (part: number) => ({
        uuid: `30000000-0000-4000-8000-${String(id * 10 + part).padStart(12, "0")}`,
        fileName: `${insurer.name.toLowerCase().replaceAll(" ", "-")}-${category}-${part}.pdf`,
        mimeType: "application/pdf",
      });
      return {
        uuid,
        publishedAt: `2026-09-${String(9 - index).padStart(2, "0")}T08:00:00.000Z`,
        insuranceCompanyUuid: insurer.uuid,
        contractNumber: `${["NL", "LL", "EG"][provider]}-2026-${String(48210 + provider).padStart(6, "0")}`,
        documentCategory: category,
        businessLine:
          provider === 0 && index === 2 ? "liability" : lines[provider],
        source: "insuranceCompany",
        title: de,
        description: `Ihre Unterlagen von ${insurer.name}. Erstellt für die fiktive Kundin Alex Morgan.`,
        titleI18n: { de, en },
        descriptionI18n: {
          de: `Ihre Unterlagen von ${insurer.name}. Erstellt für die fiktive Kundin Alex Morgan.`,
          en: `Your documents from ${insurer.name}. Prepared for fictional customer Alex Morgan.`,
        },
        files: index === 0 ? [file(1), file(2)] : [file(1)],
        amount: ["68,40", "125,00", "42,90"][provider],
        ...(category === "billing"
          ? { billingNumber: `RE-2026-${8100 + id}` }
          : {}),
        ...(category === "benefitClaim"
          ? { benefitClaimsId: `LS-2026-${6200 + id}` }
          : {}),
      } satisfies SampleDocument;
    }),
);
export function apiDocument(
  doc: SampleDocument,
  locale: Locale = "de",
): Document {
  const { titleI18n, descriptionI18n, amount: _amount, ...rest } = doc;
  void _amount;
  return {
    ...rest,
    title: titleI18n[locale],
    description: descriptionI18n[locale],
  };
}
export const insurerById = (uuid: string) =>
  insurers.find((i) => i.uuid === uuid);
