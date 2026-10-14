import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { insurerById } from "@/lib/catalog";
import type { Locale, SampleDocument } from "@/lib/types";
export async function createSamplePdf(
  document: SampleDocument,
  attachment: number,
  locale: Locale,
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0, 0.412, 0.427),
    ink = rgb(0.1, 0.14, 0.14),
    muted = rgb(0.38, 0.44, 0.44);
  const insurer = insurerById(document.insuranceCompanyUuid)!;
  const en = locale === "en";
  pdf.setTitle(`${en ? "SAMPLE" : "MUSTER"} - ${document.titleI18n[locale]}`);
  pdf.setAuthor(`${insurer.name} - FRIDA Sandbox`);
  page.drawRectangle({ x: 0, y: 779, width: 596, height: 63, color: teal });
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    heavy = false,
    color = ink,
  ) => page.drawText(text, { x, y, size, font: heavy ? bold : font, color });
  const paragraph = (text: string, y: number) => {
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (font.widthOfTextAtSize(`${line} ${word}`, 11) > 482) {
        draw(line, 56, y);
        y -= 18;
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) draw(line, 56, y);
    return y - 30;
  };
  draw(insurer.name, 56, 802, 23, true, rgb(1, 1, 1));
  draw(
    en ? "FICTIONAL DEMO INSURER" : "FIKTIVER DEMO-VERSICHERER",
    56,
    756,
    9,
    false,
    muted,
  );
  draw("Alex Morgan", 56, 697, 12, true);
  draw("Musterstrasse 12", 56, 679);
  draw("20095 Hamburg", 56, 661);
  draw(en ? "Fictional customer" : "Fiktive Kundin", 56, 642, 9, false, muted);
  draw(en ? "Policy number" : "Vertragsnummer", 370, 697, 9, false, muted);
  draw(document.contractNumber!, 370, 679, 11, true);
  draw(
    new Intl.DateTimeFormat(en ? "en-GB" : "de-DE", { timeZone: "UTC" }).format(
      new Date(document.publishedAt),
    ),
    370,
    654,
  );
  const title =
    attachment > 0
      ? en
        ? "Your cover at a glance"
        : "Ihr Schutz im Überblick"
      : document.titleI18n[locale];
  draw(title, 56, 582, 19, true, teal);
  draw(en ? "Dear Alex Morgan," : "Guten Tag Alex Morgan,", 56, 540);
  let y = paragraph(
    en
      ? "Thank you for placing your trust in us. This document summarizes your fictional insurance arrangement in the FRIDA Digital Documents sandbox."
      : "vielen Dank für Ihr Vertrauen. Dieses Dokument fasst Ihre fiktive Versicherungsvereinbarung in der FRIDA Digital Documents Sandbox zusammen.",
    514,
  );
  const content =
    document.documentCategory === "billing"
      ? en
        ? `Your sample monthly premium is EUR ${document.amount.replace(",", ".")}. This is a demonstration statement. No payment is due and no money will be collected.`
        : `Ihr monatlicher Musterbeitrag beträgt ${document.amount} EUR. Dies ist eine Beispielabrechnung. Es ist keine Zahlung fällig und es erfolgt kein Einzug.`
      : document.documentCategory === "benefitClaim"
        ? en
          ? "Your fictional claim has been reviewed. The enclosed statement illustrates how an insurer can make claim documents available in your digital inbox. No actual claim or payout exists."
          : "Ihr fiktiver Leistungsfall wurde geprüft. Diese Abrechnung zeigt, wie ein Versicherer Leistungsunterlagen im digitalen Postfach bereitstellen kann. Es besteht kein echter Anspruch und es erfolgt keine Auszahlung."
        : en
          ? "Your sample cover begins on 1 September 2026. Please keep this document with your policy records. The coverage, terms and customer details shown here are entirely fictional."
          : "Ihr beispielhafter Versicherungsschutz beginnt am 1. September 2026. Bewahren Sie dieses Dokument bei Ihren Vertragsunterlagen auf. Versicherungsschutz, Bedingungen und Kundendaten sind vollständig fiktiv.";
  y = paragraph(content, y);
  page.drawLine({
    start: { x: 56, y },
    end: { x: 539, y },
    color: rgb(0.75, 0.8, 0.8),
    thickness: 1,
  });
  draw(en ? "Reference" : "Referenz", 56, y - 24, 10, false, muted);
  draw(
    document.billingNumber ||
      document.benefitClaimsId ||
      document.contractNumber!,
    280,
    y - 24,
    10,
    true,
  );
  draw(en ? "Attachment" : "Anhang", 56, y - 46, 10, false, muted);
  draw(`${attachment + 1} / ${document.files.length}`, 280, y - 46, 10);
  paragraph(
    en
      ? "Kind regards,\nYour demo insurance team"
      : "Freundliche Grüße von Ihrem Demo-Versicherungsteam",
    y - 90,
  );
  page.drawRectangle({
    x: 40,
    y: 74,
    width: 515,
    height: 55,
    color: rgb(0.93, 0.97, 0.97),
  });
  draw(
    en
      ? "SAMPLE DOCUMENT - NOT AN ACTUAL POLICY"
      : "MUSTERDOKUMENT - KEINE ECHTE POLICE",
    56,
    107,
    11,
    true,
    teal,
  );
  draw(
    en
      ? "No legal effect. No payment required. All insurance data is fictional."
      : "Keine Rechtswirkung. Keine Zahlung erforderlich. Alle Versicherungsdaten sind fiktiv.",
    56,
    89,
    9,
    false,
    muted,
  );
  draw("FRIDA Digital Documents | Sandbox", 56, 41, 9, false, muted);
  draw("1 / 1", 510, 41, 9, false, muted);
  return pdf.save();
}
