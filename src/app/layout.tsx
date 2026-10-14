import type { Metadata } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
export const metadata: Metadata = {
  title: "FRIDA Digital Documents",
  description:
    "Das digitale Versicherungspostfach. Eine Sandbox mit realen Konten und fiktiven Versicherungsdokumenten.",
  icons: { icon: "/frida-icon.png" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "de";
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
