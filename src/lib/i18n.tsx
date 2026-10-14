"use client";
import { createContext, useContext, useState } from "react";
import type { Locale, Category, BusinessLine } from "./types";
const copy = {
  de: {
    inbox: "Postfach",
    connections: "Versicherer",
    account: "Mein Konto",
    sandbox: "Sandbox · Beispieldaten",
    language: "Sprache ändern",
    logout: "Abmelden",
    greeting: "Alles Wichtige. An einem Ort.",
    inboxIntro:
      "Ihre Versicherungsunterlagen, übersichtlich und jederzeit griffbereit.",
    connect: "Versicherer verbinden",
    documents: "Dokumente",
    unread: "Ungelesen",
    connected: "Verbunden",
    allDocuments: "Alle Dokumente",
    search: "Dokumente durchsuchen …",
    allInsurers: "Alle Versicherer",
    allCategories: "Alle Dokumentenarten",
    from: "Von",
    to: "Bis",
    clear: "Filter zurücksetzen",
    new: "Neu",
    date: "Datum",
    insurer: "Versicherer",
    document: "Dokument",
    emptyTitle: "Ihr Postfach wartet auf Sie.",
    emptyText:
      "Verbinden Sie Ihren ersten Demo-Versicherer. Ihre Unterlagen finden Sie anschließend hier — ganz ohne Papierkram.",
    noResults: "Keine passenden Dokumente",
    noResultsText: "Ändern Sie Ihre Suche oder setzen Sie die Filter zurück.",
    demoNote: "Ein echtes Postfachgefühl. Mit Beispieldaten.",
    demoText:
      "Versicherer, Einwilligungen und Unterlagen sind simuliert. Ihr Konto und Ihr gespeicherter Fortschritt sind echt.",
    connectionsIntro:
      "Verwalten Sie Ihre Verbindungen und die Freigabe Ihrer Dokumente.",
    fictional: "Fiktiver Demo-Versicherer",
    notConnected: "Nicht verbunden",
    disconnected: "Getrennt",
    sync: "Aktualisieren",
    disconnect: "Verbindung trennen",
    lastSync: "Zuletzt abgerufen",
    consentSince: "Einwilligung seit",
    never: "Noch nicht abgerufen",
    connectTitle: "Ein neues Stück Übersicht.",
    connectIntro:
      "Wählen Sie einen Demo-Versicherer, um Ihre Dokumente abzurufen.",
    selectInsurer: "Versicherer auswählen",
    authorization: "Demo-Autorisierung",
    consent: "Einwilligung",
    continue: "Weiter",
    back: "Zurück",
    cancel: "Abbrechen",
    close: "Schließen",
    simulatedLogin: "Sie sind als Alex Morgan angemeldet.",
    simulatedLoginText:
      "Dieser Versicherer-Zugang ist simuliert. Sie benötigen keine echten Zugangsdaten.",
    demoCustomer: "Fiktive Kundin",
    consentTitle: "Ihre Dokumente. Ihre Entscheidung.",
    consentText:
      "Ich erlaube FRIDA Digital Documents, meine Beispieldokumente bei diesem Demo-Versicherer abzurufen und in meinem Sandbox-Postfach zu speichern. Ich kann die Verbindung jederzeit trennen. Bereits abgerufene Dokumente bleiben im Postfach.",
    accept: "Ich stimme der simulierten Dokumentenfreigabe zu.",
    consentVersion: "Simulierte Einwilligung · Version 1.0",
    retrieve: "Verbinden & Dokumente abrufen",
    working: "Wird verarbeitet …",
    syncSuccess: "Ihr Postfach ist auf dem neuesten Stand.",
    connectedSuccess: "Versicherer verbunden. Ihre Dokumente sind angekommen.",
    connectPartial:
      "Verbunden, aber der Abruf ist fehlgeschlagen. Bitte unter Versicherer erneut aktualisieren.",
    disconnectedSuccess:
      "Verbindung getrennt. Ihre abgerufenen Dokumente bleiben erhalten.",
    details: "Dokumentdetails",
    policyNumber: "Vertragsnummer",
    businessLine: "Sparte",
    category: "Dokumentenart",
    published: "Bereitgestellt am",
    attachments: "Anhänge",
    download: "Herunterladen",
    preview: "Vorschau",
    pdfFallback:
      "Keine PDF-Vorschau? Öffnen oder laden Sie die Datei herunter.",
    openPdf: "PDF öffnen",
    samplePdf: "Musterdokument · Keine echte Police",
    accountIntro: "Ihr Zugang und Ihre Sandbox-Einstellungen.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    newPassword: "Neues Passwort",
    login: "Anmelden",
    register: "Konto erstellen",
    forgot: "Passwort vergessen?",
    noAccount: "Noch kein Konto?",
    hasAccount: "Bereits registriert?",
    loginTitle: "Willkommen in Ihrem digitalen Postfach.",
    loginText:
      "Melden Sie sich an und behalten Sie Ihre Versicherungsunterlagen im Blick.",
    registerTitle: "Weniger Papier. Mehr Überblick.",
    registerText:
      "Erstellen Sie Ihr Konto und entdecken Sie das digitale Versicherungspostfach mit Beispieldaten.",
    passwordHint: "Mindestens 12 Zeichen.",
    forgotTitle: "Ein neuer Zugang zu Ihrem Postfach.",
    forgotText: "Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.",
    sendLink: "Link senden",
    resetTitle: "Legen Sie ein neues Passwort fest.",
    savePassword: "Passwort speichern",
    confirmation:
      "Prüfen Sie Ihr E-Mail-Postfach. Falls eine Bestätigung erforderlich ist, finden Sie dort den nächsten Schritt.",
    recoverySent:
      "Falls ein Konto zu dieser Adresse existiert, erhalten Sie einen Link zum Zurücksetzen.",
    passwordSaved: "Ihr Passwort wurde aktualisiert.",
    authFailed:
      "Anmeldung fehlgeschlagen. Prüfen Sie Ihre Angaben und bestätigen Sie gegebenenfalls Ihre E-Mail-Adresse.",
    requestFailed:
      "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    setupTitle: "Das Postfach wird eingerichtet.",
    setupText:
      "Die Kontoverbindung ist noch nicht konfiguriert. Registrierung und Anmeldung stehen nach der Einrichtung zur Verfügung.",
    resetDemo: "Sandbox zurücksetzen",
    resetText:
      "Entfernt Ihre Demo-Verbindungen, Einwilligungen und importierten Dokumente. Ihr Konto bleibt bestehen.",
    resetConfirm: "Möchten Sie Ihren Demo-Fortschritt zurücksetzen?",
    resetDone: "Ihre Sandbox wurde zurückgesetzt.",
    disconnectConfirm: "Verbindung wirklich trennen?",
    disconnectText:
      "Es werden keine neuen Dokumente abgerufen. Bereits importierte Unterlagen bleiben in Ihrem Postfach.",
    security: "Ihr Konto",
    realAccount:
      "Ihr Konto ist echt. Verwenden Sie für die Sandbox keine echten Versicherungsdaten.",
    loading: "Postfach wird geladen …",
    count: "Dokumente",
    shown: "angezeigt",
    legalNote: "Demonstration des FRIDA Document API Standards.",
    privacy: "Datenschutzhinweis",
    privacyText:
      "Für Ihr Konto werden E-Mail-Adresse, Anmeldedaten und Sandbox-Fortschritt im konfigurierten Supabase-Projekt verarbeitet. Alle Versicherungsinhalte sind fiktiv. Laden Sie keine persönlichen Versicherungsdaten hoch.",
    newest: "Neueste zuerst",
    helpTitle: "So funktioniert Ihr Postfach",
    helpText:
      "Versicherer auswählen, Demo-Freigabe erteilen und Dokumente abrufen. Sie entscheiden, welche Verbindungen aktiv bleiben.",
  },
  en: {
    inbox: "Inbox",
    connections: "Insurers",
    account: "My account",
    sandbox: "Sandbox · Sample data",
    language: "Change language",
    logout: "Sign out",
    greeting: "Everything important. In one place.",
    inboxIntro: "Your insurance documents, organized and always close at hand.",
    connect: "Connect insurer",
    documents: "Documents",
    unread: "Unread",
    connected: "Connected",
    allDocuments: "All documents",
    search: "Search documents …",
    allInsurers: "All insurers",
    allCategories: "All document types",
    from: "From",
    to: "To",
    clear: "Reset filters",
    new: "New",
    date: "Date",
    insurer: "Insurer",
    document: "Document",
    emptyTitle: "Your inbox is ready for you.",
    emptyText:
      "Connect your first demo insurer. Your documents will appear here — without the paperwork.",
    noResults: "No matching documents",
    noResultsText: "Change your search or reset your filters.",
    demoNote: "A real inbox experience. With sample data.",
    demoText:
      "Insurers, consent and documents are simulated. Your account and saved progress are real.",
    connectionsIntro: "Manage your connections and access to your documents.",
    fictional: "Fictional demo insurer",
    notConnected: "Not connected",
    disconnected: "Disconnected",
    sync: "Refresh",
    disconnect: "Disconnect",
    lastSync: "Last retrieved",
    consentSince: "Consent since",
    never: "Not retrieved yet",
    connectTitle: "A little more peace of mind.",
    connectIntro: "Choose a demo insurer to retrieve your documents.",
    selectInsurer: "Choose insurer",
    authorization: "Demo authorization",
    consent: "Consent",
    continue: "Continue",
    back: "Back",
    cancel: "Cancel",
    close: "Close",
    simulatedLogin: "You are signed in as Alex Morgan.",
    simulatedLoginText:
      "This insurer sign-in is simulated. You do not need real credentials.",
    demoCustomer: "Fictional customer",
    consentTitle: "Your documents. Your decision.",
    consentText:
      "I allow FRIDA Digital Documents to retrieve my sample documents from this demo insurer and store them in my sandbox inbox. I can disconnect at any time. Previously retrieved documents remain in my inbox.",
    accept: "I agree to the simulated document sharing.",
    consentVersion: "Simulated consent · Version 1.0",
    retrieve: "Connect & retrieve documents",
    working: "Processing …",
    syncSuccess: "Your inbox is up to date.",
    connectedSuccess: "Insurer connected. Your documents have arrived.",
    connectPartial:
      "Connected, but retrieval failed. Please retry from Insurers.",
    disconnectedSuccess:
      "Disconnected. Your retrieved documents are still available.",
    details: "Document details",
    policyNumber: "Policy number",
    businessLine: "Business line",
    category: "Document type",
    published: "Published on",
    attachments: "Attachments",
    download: "Download",
    preview: "Preview",
    pdfFallback: "No PDF preview? Open or download the file.",
    openPdf: "Open PDF",
    samplePdf: "Sample document · Not an actual policy",
    accountIntro: "Your access and sandbox settings.",
    email: "Email address",
    password: "Password",
    newPassword: "New password",
    login: "Sign in",
    register: "Create account",
    forgot: "Forgot password?",
    noAccount: "No account yet?",
    hasAccount: "Already registered?",
    loginTitle: "Welcome to your digital inbox.",
    loginText: "Sign in and keep your insurance documents in view.",
    registerTitle: "Less paperwork. More clarity.",
    registerText:
      "Create your account and explore a digital insurance inbox with sample data.",
    passwordHint: "At least 12 characters.",
    forgotTitle: "A fresh start for your inbox.",
    forgotText: "We will send you a link to reset your password.",
    sendLink: "Send link",
    resetTitle: "Choose a new password.",
    savePassword: "Save password",
    confirmation:
      "Check your email. If confirmation is required, you will find the next step there.",
    recoverySent:
      "If an account exists for this address, you will receive a reset link.",
    passwordSaved: "Your password has been updated.",
    authFailed:
      "Sign-in failed. Check your details and confirm your email address if needed.",
    requestFailed: "Something went wrong. Please try again.",
    retry: "Try again",
    setupTitle: "Your inbox is being prepared.",
    setupText:
      "The account service is not configured yet. Registration and sign-in will be available after setup.",
    resetDemo: "Reset sandbox",
    resetText:
      "Removes your demo connections, consent history and imported documents. Your account is kept.",
    resetConfirm: "Reset your demo progress?",
    resetDone: "Your sandbox has been reset.",
    disconnectConfirm: "Disconnect this insurer?",
    disconnectText:
      "No new documents will be retrieved. Previously imported documents stay in your inbox.",
    security: "Your account",
    realAccount:
      "Your account is real. Do not use real insurance data in this sandbox.",
    loading: "Loading your inbox …",
    count: "documents",
    shown: "shown",
    legalNote: "A demonstration of the FRIDA Document API standard.",
    privacy: "Privacy notice",
    privacyText:
      "Your email address, authentication data and sandbox progress are processed in the configured Supabase project. All insurance content is fictional. Do not upload personal insurance data.",
    newest: "Newest first",
    helpTitle: "How your inbox works",
    helpText:
      "Choose an insurer, approve demo access and retrieve documents. You decide which connections stay active.",
  },
};
export type CopyKey = keyof typeof copy.de;
const Context = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: CopyKey) => string;
}>({ locale: "de", setLocale: () => {}, t: (k) => copy.de[k] });
export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, update] = useState(initialLocale);
  function setLocale(value: Locale) {
    update(value);
    document.documentElement.lang = value;
    document.cookie = `locale=${value};path=/;max-age=31536000;SameSite=Lax`;
  }
  return (
    <Context.Provider value={{ locale, setLocale, t: (k) => copy[locale][k] }}>
      {children}
    </Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
export const categoryNames: Record<Category, Record<Locale, string>> = {
  application: { de: "Antrag", en: "Application" },
  policy: { de: "Vertrag", en: "Policy" },
  billing: { de: "Abrechnung", en: "Billing" },
  service: { de: "Service", en: "Service" },
  benefitClaim: { de: "Leistung", en: "Claim" },
};
export const lineNames: Record<BusinessLine, Record<Locale, string>> = {
  lifeInsurance: { de: "Leben & Rente", en: "Life & retirement" },
  damage: { de: "Schaden", en: "Property" },
  casuality: { de: "Unfall", en: "Accident" },
  liability: { de: "Haftpflicht", en: "Liability" },
  motorVehicleInsurance: { de: "Kfz", en: "Motor" },
  health: { de: "Gesundheit", en: "Health" },
  legal: { de: "Rechtsschutz", en: "Legal protection" },
};
export function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
