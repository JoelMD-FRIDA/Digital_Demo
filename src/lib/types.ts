export type Locale = "de" | "en";
export type Localized = Record<Locale, string>;
export type Category =
  "application" | "policy" | "billing" | "service" | "benefitClaim";
export type BusinessLine =
  | "lifeInsurance"
  | "damage"
  | "casuality"
  | "liability"
  | "motorVehicleInsurance"
  | "health"
  | "legal";
export interface InsuranceInfo {
  uuid: string;
  name: string;
  links: { name: string; url: string }[];
}
export interface Insurer extends InsuranceInfo {
  initials: string;
  color: string;
  description: Localized;
  product: Localized;
}
export interface DocumentFile {
  uuid: string;
  fileName: string;
  mimeType: string;
  createdAt?: string;
  description?: string;
}
export interface Document {
  uuid: string;
  publishedAt: string;
  availableUntil?: string;
  contractNumber?: string;
  documentCategory?: Category;
  businessLine?: BusinessLine;
  source?: "customer" | "insuranceCompany";
  benefitClaimsId?: string;
  billingNumber?: string;
  title?: string;
  description?: string;
  insuranceCompanyUuid: string;
  files: DocumentFile[];
}
export interface SampleDocument extends Document {
  titleI18n: Localized;
  descriptionI18n: Localized;
  amount: string;
}
export interface DocumentList {
  documents: Document[];
  resultLimitExceeded: boolean;
  listId?: string;
}
export interface Connection {
  insurer_id: string;
  status: "active" | "disconnected";
  consent_at: string;
  last_sync_at: string | null;
}
export interface SavedDocument {
  document_id: string;
  imported_at: string;
  read_at: string | null;
  metadata: SampleDocument;
}
export interface Workspace {
  email: string;
  documents: SavedDocument[];
  connections: Connection[];
}
