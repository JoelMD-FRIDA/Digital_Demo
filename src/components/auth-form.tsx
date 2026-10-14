"use client";
import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Loader2, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { browserClient } from "@/lib/supabase/browser";
import { Brand, LanguageSwitch } from "./brand";
const subscribeHydration = () => () => {};
type Mode = "login" | "register" | "forgot-password" | "reset-password";
export function AuthForm({
  mode,
  configured,
  callbackError = false,
}: {
  mode: Mode;
  configured: boolean;
  callbackError?: boolean;
}) {
  const { t } = useI18n();
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(callbackError ? t("authFailed") : "");
  const [resetAllowed, setResetAllowed] = useState(false);
  useEffect(() => {
    if (mode === "reset-password" && configured)
      browserClient()
        .auth.getUser()
        .then(({ data }) => {
          if (!data.user) window.location.replace("/forgot-password");
          else setResetAllowed(true);
        });
  }, [configured, mode, t]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget),
      email = String(data.get("email") || ""),
      password = String(data.get("password") || "");
    try {
      const client = browserClient();
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.assign("/");
      } else if (mode === "register") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage(t("confirmation"));
      } else if (mode === "forgot-password") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setMessage(t("recoverySent"));
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage(t("passwordSaved"));
      }
    } catch {
      setError(t(mode === "login" ? "authFailed" : "requestFailed"));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "login"
      ? "loginTitle"
      : mode === "register"
        ? "registerTitle"
        : mode === "forgot-password"
          ? "forgotTitle"
          : "resetTitle";
  const button =
    mode === "login"
      ? "login"
      : mode === "register"
        ? "register"
        : mode === "forgot-password"
          ? "sendLink"
          : "savePassword";
  return (
    <div className="auth-page">
      <header className="topbar">
        <Brand />
        <div className="topbar-end">
          <span className="sandbox-label">{t("sandbox")}</span>
          <LanguageSwitch />
        </div>
      </header>
      <main className="auth-layout">
        <section className="auth-form-area">
          <div className="auth-form-wrap">
            <div className="auth-card-brand">
              <Image
                src="/frida-icon.png"
                width={40}
                height={40}
                alt=""
                unoptimized
              />
              <div>
                <strong>FRIDA e.V.</strong>
                <span>Digital Documents</span>
              </div>
            </div>
            <h2>{t(title)}</h2>
            <p className="intro">
              {t(
                mode === "login"
                  ? "loginText"
                  : mode === "register"
                    ? "registerText"
                    : mode === "forgot-password"
                      ? "forgotText"
                      : "passwordHint",
              )}
            </p>
            {!configured && (
              <div className="notice">
                <strong>{t("setupTitle")}</strong>
                <p>{t("setupText")}</p>
              </div>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {message ? (
              <div className="notice success" role="status">
                <Mail size={20} />
                <p>{message}</p>
                <Link href={mode === "reset-password" ? "/" : "/login"}>
                  {t(mode === "reset-password" ? "inbox" : "login")}{" "}
                  <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <form method="post" onSubmit={submit}>
                {mode !== "reset-password" && (
                  <label>
                    {t("email")}
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="alex@beispiel.de"
                      required
                      disabled={!hydrated || !configured || busy}
                    />
                  </label>
                )}
                {(mode === "login" ||
                  mode === "register" ||
                  mode === "reset-password") && (
                  <label>
                    {t(mode === "reset-password" ? "newPassword" : "password")}
                    <input
                      aria-label={t(
                        mode === "reset-password" ? "newPassword" : "password",
                      )}
                      name="password"
                      type="password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      minLength={mode === "login" ? 1 : 12}
                      required
                      disabled={!hydrated || !configured || busy}
                    />
                    {mode !== "login" && <small>{t("passwordHint")}</small>}
                  </label>
                )}
                {mode === "login" && (
                  <Link href="/forgot-password" className="forgot-link">
                    {t("forgot")}
                  </Link>
                )}
                <button
                  className="button primary auth-submit"
                  disabled={
                    !hydrated ||
                    !configured ||
                    busy ||
                    (mode === "reset-password" && !resetAllowed)
                  }
                >
                  {busy ? <Loader2 className="spin" size={17} /> : null}
                  {t(busy ? "working" : button)}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </form>
            )}
            <div className="auth-switch">
              {t(mode === "login" ? "noAccount" : "hasAccount")}{" "}
              <Link href={mode === "login" ? "/register" : "/login"}>
                {t(mode === "login" ? "register" : "login")}
              </Link>
            </div>
            <div className="auth-note">
              <ShieldCheck size={18} />
              <p>{t("realAccount")}</p>
            </div>
            <details className="privacy-details">
              <summary>{t("privacy")}</summary>
              <p>{t("privacyText")}</p>
            </details>
          </div>
        </section>
      </main>
      <footer className="public-footer">
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
  );
}
