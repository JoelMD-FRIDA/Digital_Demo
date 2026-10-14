"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Inbox,
  Link2,
  UserRound,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  FileText,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Check,
  ChevronRight,
  Loader2,
  X,
  Unplug,
  RotateCcw,
  Mail,
} from "lucide-react";
import { Brand, LanguageSwitch } from "./brand";
import { useI18n, categoryNames, formatDate } from "@/lib/i18n";
import { insurers, insurerById } from "@/lib/catalog";
import type { Insurer, Workspace, SampleDocument, Category } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "./modal";
import { DocumentDetail } from "./document-detail";
export type View = "inbox" | "connections" | "account";
async function request(path: string, value?: unknown, method = "POST") {
  const response = await apiFetch(
    path,
    value === undefined
      ? { cache: "no-store" }
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
  );
  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (response.status === 503) throw new Error("TEMPORARILY_UNAVAILABLE");
  if (!response.ok) throw new Error("REQUEST_FAILED");
  return response.json();
}
export function InsurerMark({
  insurer,
  small = false,
}: {
  insurer: Insurer;
  small?: boolean;
}) {
  return (
    <span
      className={`insurer-mark ${small ? "small-mark" : ""}`}
      style={{ "--insurer-color": insurer.color } as React.CSSProperties}
    >
      {insurer.initials}
      <span className="mark-accent" />
    </span>
  );
}
export function Dashboard({ view }: { view: View }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(false),
    [step, setStep] = useState(0),
    [selected, setSelected] = useState<Insurer | null>(null),
    [accepted, setAccepted] = useState(false),
    [modalError, setModalError] = useState("");
  const [detail, setDetail] = useState<SampleDocument | null>(null),
    [confirmation, setConfirmation] = useState<"reset" | string | null>(null);
  const [search, setSearch] = useState(""),
    [insurerFilter, setInsurerFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [onlyUnread, setOnlyUnread] = useState(false);
  const load = useCallback(async () => {
    const value = await request("/api/workspace");
    setData(value);
    setError("");
  }, []);
  useEffect(() => {
    let live = true;
    request("/api/workspace")
      .then((value) => {
        if (live) setData(value);
      })
      .catch(() => {
        if (live) setError("requestFailed");
      });
    return () => {
      live = false;
    };
  }, []);
  function openWizard(insurer?: Insurer) {
    setSelected(insurer ?? null);
    setStep(insurer ? 1 : 0);
    setAccepted(false);
    setModalError("");
    setWizard(true);
  }
  async function action(task: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await load();
      setNotice(message);
    } catch {
      setError(t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    if (!selected || !accepted) return;
    setBusy(true);
    setModalError("");
    let connected = false;
    try {
      await request("/api/connections", {
        action: "connect",
        insurerId: selected.uuid,
        accepted,
        locale,
      });
      connected = true;
      await request("/api/connections", {
        action: "sync",
        insurerId: selected.uuid,
      });
      await load();
      setWizard(false);
      setNotice(t("connectedSuccess"));
    } catch {
      if (connected) {
        setWizard(false);
        setError(t("connectPartial"));
        try {
          await load();
          setError(t("connectPartial"));
        } catch {
          /* Keep actionable error visible. */
        }
      } else setModalError(t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function openDocument(doc: SampleDocument) {
    setDetail(doc);
    try {
      await request(`/api/documents/${doc.uuid}`, {}, "PATCH");
      setData(
        (current) =>
          current && {
            ...current,
            documents: current.documents.map((d) =>
              d.document_id === doc.uuid
                ? { ...d, read_at: new Date().toISOString() }
                : d,
            ),
          },
      );
    } catch {
      setError(t("requestFailed"));
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch('/api/auth/logout',{method:'POST'});
      if (!response.ok) throw new Error('REQUEST_FAILED');
      window.location.replace("/login");
    } catch {
      setError(t("requestFailed"));
      setBusy(false);
    }
  }
  async function confirmAction() {
    const value = confirmation;
    await action(
      async () => {
        if (value === "reset") await request("/api/reset", {});
        else
          await request("/api/connections", {
            action: "disconnect",
            insurerId: value,
          });
        setConfirmation(null);
      },
      t(value === "reset" ? "resetDone" : "disconnectedSuccess"),
    );
  }
  const documents = [...(data?.documents ?? [])].sort(
    (a, b) =>
      b.metadata.publishedAt.localeCompare(a.metadata.publishedAt) ||
      a.document_id.localeCompare(b.document_id),
  );
  const unread = documents.filter((d) => !d.read_at).length,
    active = data?.connections.filter((c) => c.status === "active") ?? [];
  const filtered = documents.filter(
    ({ metadata: d, read_at }) =>
      (!onlyUnread || !read_at) &&
      (!insurerFilter || d.insuranceCompanyUuid === insurerFilter) &&
      (!categoryFilter || d.documentCategory === categoryFilter) &&
      (!from || d.publishedAt.slice(0, 10) >= from) &&
      (!to || d.publishedAt.slice(0, 10) <= to) &&
      `${d.titleI18n[locale]} ${d.contractNumber} ${insurerById(d.insuranceCompanyUuid)?.name}`
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
  );
  const hasFilters =
    search || insurerFilter || categoryFilter || from || to || onlyUnread;
  const resetFilters = () => {
    setSearch("");
    setInsurerFilter("");
    setCategoryFilter("");
    setFrom("");
    setTo("");
    setOnlyUnread(false);
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="customer-nav" aria-label={t("inbox")}>
          {(
            [
              { view: "inbox", href: "/", icon: Inbox },
              { view: "connections", href: "/connections", icon: Link2 },
              { view: "account", href: "/account", icon: UserRound },
            ] as const
          ).map((item) => (
            <Link
              key={item.view}
              href={item.href}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              aria-current={view === item.view ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{t(item.view)}</span>
              {item.view === "inbox" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="topbar-end">
          <span className="sandbox-label">{t("sandbox")}</span>
          <LanguageSwitch iconOnly />
          <Link
            href="/account"
            className="user-avatar"
            aria-label={t("account")}
          >
            {data?.email?.charAt(0).toUpperCase() || <UserRound size={16} />}
          </Link>
        </div>
      </header>

      <div className="workspace">
        <main className="main-content" id="main-content">
          <div className="breadcrumb">
            Digital Documents <ChevronRight size={13} />
            <span>{t(view)}</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{view === "inbox" ? t("greeting") : t(view)}</h1>
              <p>
                {t(
                  view === "inbox"
                    ? "inboxIntro"
                    : view === "connections"
                      ? "connectionsIntro"
                      : "accountIntro",
                )}
              </p>
            </div>
            {view !== "account" && (
              <button
                className="button primary"
                onClick={() => openWizard()}
                disabled={busy || !data}
              >
                <Plus size={17} />
                {t("connect")}
              </button>
            )}
          </div>
          {error && (
            <div className="notice error" role="alert">
              <span>
                {error === "requestFailed" ? t("requestFailed") : error}
              </span>
              <button
                className="text-button"
                onClick={() => action(load, "")}
                disabled={busy}
              >
                {t("retry")}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice success inline-notice" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label={t("close")}
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-state">
              <Loader2 className="spin" size={24} />
              <p>{t("loading")}</p>
            </div>
          ) : (
            <>
              {view === "inbox" && (
                <>
                  <div className="overview-strip">
                    <div>
                      <span className="stat-icon">
                        <FileText size={20} />
                      </span>
                      <div>
                        <strong>
                          {documents.length.toString().padStart(2, "0")}
                        </strong>
                        <span>{t("documents")}</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <Mail size={20} />
                      </span>
                      <div>
                        <strong>{unread.toString().padStart(2, "0")}</strong>
                        <span>{t("unread")}</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <Link2 size={20} />
                      </span>
                      <div>
                        <strong>
                          {active.length.toString().padStart(2, "0")}
                          <small> / 3</small>
                        </strong>
                        <span>{t("connected")}</span>
                      </div>
                    </div>
                    <div className="overview-note">
                      <ShieldCheck size={20} />
                      <span>{t("demoNote")}</span>
                    </div>
                  </div>
                  <section className="inbox-panel" aria-label={t("documents")}>
                    <div className="panel-heading">
                      <div className="inbox-tabs">
                        <button
                          className={!onlyUnread ? "selected" : ""}
                          onClick={() => setOnlyUnread(false)}
                          aria-pressed={!onlyUnread}
                        >
                          {t("allDocuments")}
                          <span>{documents.length}</span>
                        </button>
                        <button
                          className={onlyUnread ? "selected" : ""}
                          onClick={() => setOnlyUnread(true)}
                          aria-pressed={onlyUnread}
                        >
                          {t("unread")}
                          {unread > 0 && <span>{unread}</span>}
                        </button>
                      </div>
                      <span className="sort-label">{t("newest")}</span>
                    </div>
                    <div className="filters">
                      <label className="search-field">
                        <Search size={17} />
                        <span className="sr-only">{t("search")}</span>
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t("search")}
                        />
                      </label>
                      <select
                        aria-label={t("insurer")}
                        value={insurerFilter}
                        onChange={(e) => setInsurerFilter(e.target.value)}
                      >
                        <option value="">{t("allInsurers")}</option>
                        {insurers.map((i) => (
                          <option key={i.uuid} value={i.uuid}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={t("category")}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">{t("allCategories")}</option>
                        {Object.entries(categoryNames).map(([key, label]) => (
                          <option value={key} key={key}>
                            {label[locale]}
                          </option>
                        ))}
                      </select>
                      <div className="date-filters">
                        <label>
                          {t("from")}
                          <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => setFrom(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("to")}
                          <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                    {documents.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-inbox">
                          <Inbox size={36} strokeWidth={1.3} />
                          <span>
                            <Plus size={13} />
                          </span>
                        </div>
                        <h2>{t("emptyTitle")}</h2>
                        <p>{t("emptyText")}</p>
                        <button
                          className="button primary"
                          onClick={() => openWizard()}
                        >
                          <Plus size={16} />
                          {t("connect")}
                        </button>
                        <div className="empty-insurers">
                          {insurers.map((i) => (
                            <span key={i.uuid}>
                              <InsurerMark insurer={i} small />
                              {i.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="empty-state compact">
                        <Search size={30} />
                        <h2>{t("noResults")}</h2>
                        <p>{t("noResultsText")}</p>
                        <button
                          className="button secondary"
                          onClick={resetFilters}
                        >
                          {t("clear")}
                        </button>
                      </div>
                    ) : (
                      <div className="document-list">
                        <div className="list-header">
                          <span>{t("document")}</span>
                          <span>{t("insurer")}</span>
                          <span>{t("category")}</span>
                          <span>{t("date")}</span>
                          <span />
                        </div>
                        {filtered.map(({ metadata: doc, read_at }) => (
                          <button
                            key={doc.uuid}
                            className={`document-row ${!read_at ? "unread" : ""}`}
                            onClick={() => openDocument(doc)}
                          >
                            <span className="document-cell">
                              <span className="file-icon">
                                <FileText size={22} strokeWidth={1.5} />
                                {!read_at && <span className="unread-dot" />}
                              </span>
                              <span className="document-title">
                                <strong>{doc.titleI18n[locale]}</strong>
                                <span>
                                  <span className="mobile-insurer">
                                    {
                                      insurerById(doc.insuranceCompanyUuid)
                                        ?.name
                                    }{" "}
                                    ·{" "}
                                  </span>
                                  {doc.contractNumber}
                                  <span className="inline-dot">·</span>
                                  {doc.files.length} PDF
                                </span>
                              </span>
                            </span>
                            <span className="row-insurer">
                              <InsurerMark
                                insurer={insurerById(doc.insuranceCompanyUuid)!}
                                small
                              />
                              {insurerById(doc.insuranceCompanyUuid)?.name}
                            </span>
                            <span>
                              <span
                                className={`category category-${doc.documentCategory}`}
                              >
                                {
                                  categoryNames[
                                    doc.documentCategory as Category
                                  ][locale]
                                }
                              </span>
                            </span>
                            <span className="row-date">
                              {formatDate(doc.publishedAt, locale)}
                            </span>
                            <ChevronRight size={16} className="row-arrow" />
                          </button>
                        ))}
                      </div>
                    )}
                    {documents.length > 0 && (
                      <div className="list-footer">
                        <span>
                          {filtered.length} / {documents.length} {t("count")}{" "}
                          {t("shown")}
                        </span>
                        {hasFilters && (
                          <button
                            className="text-button"
                            onClick={resetFilters}
                          >
                            {t("clear")}
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                  <div className="bottom-note">
                    <ShieldCheck size={18} />
                    <p>
                      <strong>{t("demoNote")}</strong> {t("demoText")}
                    </p>
                    <Link href="/connections" aria-label={t("connections")}>
                      <ArrowUpRight size={20} />
                    </Link>
                  </div>
                </>
              )}
              {view === "connections" && (
                <div className="insurer-grid">
                  {insurers.map((insurer) => {
                    const connection = data.connections.find(
                        (c) => c.insurer_id === insurer.uuid,
                      ),
                      isActive = connection?.status === "active";
                    return (
                      <article className="insurer-card" key={insurer.uuid}>
                        <div className="insurer-card-top">
                          <InsurerMark insurer={insurer} />
                          <span
                            className={`connection-status ${isActive ? "on" : ""}`}
                          >
                            {isActive && <Check size={12} />}{" "}
                            {t(
                              isActive
                                ? "connected"
                                : connection
                                  ? "disconnected"
                                  : "notConnected",
                            )}
                          </span>
                        </div>
                        <h2>{insurer.name}</h2>
                        <span className="small muted">{t("fictional")}</span>
                        <p>{insurer.description[locale]}</p>
                        <div className="insurer-product">
                          {insurer.product[locale]}
                        </div>
                        <dl className="connection-dates">
                          <dt>{t("consentSince")}</dt>
                          <dd>
                            {connection
                              ? formatDate(connection.consent_at, locale)
                              : "—"}
                          </dd>
                          <dt>{t("lastSync")}</dt>
                          <dd>
                            {connection?.last_sync_at
                              ? formatDate(connection.last_sync_at, locale)
                              : t("never")}
                          </dd>
                        </dl>
                        <div className="insurer-actions">
                          {isActive ? (
                            <>
                              <button
                                className="button secondary"
                                disabled={busy}
                                onClick={() =>
                                  action(async () => {
                                    await request("/api/connections", {
                                      action: "sync",
                                      insurerId: insurer.uuid,
                                    });
                                  }, t("syncSuccess"))
                                }
                              >
                                <RefreshCw
                                  size={15}
                                  className={busy ? "spin" : ""}
                                />
                                {t("sync")}
                              </button>
                              <button
                                className="text-button muted"
                                disabled={busy}
                                onClick={() => setConfirmation(insurer.uuid)}
                              >
                                {t("disconnect")}
                              </button>
                            </>
                          ) : (
                            <button
                              className="button primary"
                              disabled={busy}
                              onClick={() => openWizard(insurer)}
                            >
                              <Plus size={16} />
                              {t("connect")}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {view === "account" && (
                <div className="account-grid">
                  <section className="account-panel">
                    <h2>{t("security")}</h2>
                    <label>
                      {t("email")}
                      <input value={data.email} readOnly />
                    </label>
                    <p className="muted">{t("realAccount")}</p>
                    <div className="account-actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={logout}
                      >
                        <LogOut size={15} />
                        {t("logout")}
                      </button>
                    </div>
                  </section>
                  <section className="account-panel">
                    <h2>{t("resetDemo")}</h2>
                    <p>{t("resetText")}</p>
                    <button
                      className="button danger-outline"
                      disabled={busy}
                      onClick={() => setConfirmation("reset")}
                    >
                      <RotateCcw size={15} />
                      {t("resetDemo")}
                    </button>
                  </section>
                  <section className="account-panel privacy-panel">
                    <h2>{t("privacy")}</h2>
                    <p className="muted">{t("privacyText")}</p>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <div className="footer-brand">
            <Image
              src="/frida-icon.png"
              width={33}
              height={33}
              alt="FRIDA"
              unoptimized
            />
            <span>© {new Date().getFullYear()} FRIDA e.V.</span>
          </div>
          <span>{t("legalNote")}</span>
        </footer>
      </div>
      {wizard && (
        <Modal
          title={t("connect")}
          onClose={() => setWizard(false)}
          busy={busy}
        >
          <div className="wizard-body">
            <div className="stepper">
              {(["selectInsurer", "authorization", "consent"] as const).map(
                (label, i) => (
                  <div key={label} className={step >= i ? "current" : ""}>
                    <span>{step > i ? <Check size={13} /> : i + 1}</span>
                    <small>{t(label)}</small>
                  </div>
                ),
              )}
            </div>
            {step === 0 ? (
              <>
                <h3>{t("connectTitle")}</h3>
                <p className="muted">{t("connectIntro")}</p>
                <div className="insurer-options">
                  {insurers.map((insurer) => {
                    const linked = active.some(
                      (c) => c.insurer_id === insurer.uuid,
                    );
                    return (
                      <button
                        key={insurer.uuid}
                        className={`insurer-option ${selected?.uuid === insurer.uuid ? "selected" : ""}`}
                        onClick={() => setSelected(insurer)}
                        disabled={linked}
                        aria-pressed={selected?.uuid === insurer.uuid}
                      >
                        <InsurerMark insurer={insurer} />
                        <span>
                          <strong>{insurer.name}</strong>
                          <small>
                            {linked ? t("connected") : insurer.product[locale]}
                          </small>
                        </span>
                        {selected?.uuid === insurer.uuid || linked ? (
                          <Check size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : step === 1 ? (
              <>
                <div className="authorization-brand">
                  <InsurerMark insurer={selected!} />
                  <h3>{selected?.name}</h3>
                  <span className="small muted">{t("fictional")}</span>
                </div>
                <div className="simulated-account">
                  <span className="user-avatar">AM</span>
                  <div>
                    <strong>Alex Morgan</strong>
                    <span>{t("demoCustomer")}</span>
                  </div>
                  <Check size={18} />
                </div>
                <h3 className="small-heading">{t("simulatedLogin")}</h3>
                <p className="muted">{t("simulatedLoginText")}</p>
              </>
            ) : (
              <>
                <div className="consent-icon">
                  <ShieldCheck size={28} />
                </div>
                <h3>{t("consentTitle")}</h3>
                <p className="small muted">
                  {selected?.name} → FRIDA Digital Documents
                </p>
                <div className="consent-text">{t("consentText")}</div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={accepted}
                    disabled={busy}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>{t("accept")}</span>
                </label>
                <span className="small muted">{t("consentVersion")}</span>
              </>
            )}
            {modalError && (
              <div className="notice error" role="alert">
                {modalError}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                step === 0 ? setWizard(false) : setStep(step - 1)
              }
            >
              {t(step === 0 ? "cancel" : "back")}
            </button>
            {step < 2 ? (
              <button
                className="button primary"
                disabled={!selected || busy}
                onClick={() => setStep(step + 1)}
              >
                {t("continue")}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!accepted || busy}
                onClick={connect}
              >
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Link2 size={16} />
                )}{" "}
                {t(busy ? "working" : "retrieve")}
              </button>
            )}
          </div>
        </Modal>
      )}
      {detail && (
        <DocumentDetail document={detail} onClose={() => setDetail(null)} />
      )}
      {confirmation && (
        <Modal
          title={t(
            confirmation === "reset" ? "resetConfirm" : "disconnectConfirm",
          )}
          onClose={() => setConfirmation(null)}
          busy={busy}
        >
          <div className="wizard-body">
            <p>
              {t(confirmation === "reset" ? "resetText" : "disconnectText")}
            </p>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
              disabled={busy}
            >
              {t("cancel")}
            </button>
            <button
              className="button danger"
              onClick={confirmAction}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Unplug size={16} />
              )}{" "}
              {t(confirmation === "reset" ? "resetDemo" : "disconnect")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
