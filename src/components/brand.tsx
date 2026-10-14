"use client";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="FRIDA Digital Documents">
      <Image
        src="/frida-icon.png"
        width={33}
        height={33}
        alt=""
        unoptimized
        priority
      />
      <strong>Frida Digital Documents</strong>
    </Link>
  );
}
export function LanguageSwitch({ iconOnly = false }: { iconOnly?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const GlobeIcon = iconOnly ? Globe : Globe2;
  return (
    <label className={`language ${iconOnly ? "language-icon-only" : ""}`}>
      <GlobeIcon className="language-globe" aria-hidden="true" />
      {iconOnly && (
        <ChevronDown className="language-chevron" aria-hidden="true" />
      )}
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as "de" | "en")}
        aria-label={t("language")}
      >
        <option value="de">DE</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
