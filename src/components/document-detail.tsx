"use client";
import { useEffect, useState } from "react";
import { Download, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useI18n, formatDate, categoryNames, lineNames } from "@/lib/i18n";
import type { SampleDocument } from "@/lib/types";
import { insurerById } from "@/lib/catalog";
import { Modal } from "./modal";
import { PdfPreview } from "./pdf-preview";
export function DocumentDetail({
  document,
  onClose,
}: {
  document: SampleDocument;
  onClose: () => void;
}) {
  const { locale, t } = useI18n(),
    [fileIndex, setFileIndex] = useState(0),
    [resource, setResource] = useState({ key: "", url: "", failed: false }),
    [retry, setRetry] = useState(0),
    [downloading, setDownloading] = useState(false);
  const file = document.files[fileIndex];
  const resourceKey = `${file.uuid}/${locale}/${retry}`;
  const url = resource.key === resourceKey ? resource.url : "";
  const failed = resource.key === resourceKey && resource.failed;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    fetch(`/api/files/${file.uuid}?preview=1&locale=${locale}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResource({ key: resourceKey, url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResource({ key: resourceKey, url: "", failed: true });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.uuid, locale, resourceKey]);
  async function download() {
    setDownloading(true);
    try {
      const response = await fetch(`/api/files/${file.uuid}?locale=${locale}`);
      if (!response.ok) throw new Error();
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `SAMPLE-${file.fileName}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      setResource({ key: resourceKey, url: "", failed: true });
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Modal title={t("details")} onClose={onClose} wide>
      <div className="detail-layout">
        <div className="detail-information">
          <span className="section-kicker">
            {insurerById(document.insuranceCompanyUuid)?.name}
          </span>
          <h3>{document.titleI18n[locale]}</h3>
          <p className="muted">{document.descriptionI18n[locale]}</p>
          <dl className="metadata">
            <dt>{t("policyNumber")}</dt>
            <dd>{document.contractNumber || "—"}</dd>
            <dt>{t("published")}</dt>
            <dd>{formatDate(document.publishedAt, locale)}</dd>
            <dt>{t("category")}</dt>
            <dd>
              {document.documentCategory
                ? categoryNames[document.documentCategory][locale]
                : "—"}
            </dd>
            <dt>{t("businessLine")}</dt>
            <dd>
              {document.businessLine
                ? lineNames[document.businessLine][locale]
                : "—"}
            </dd>
          </dl>
          <h4>
            {t("attachments")}{" "}
            <span className="muted">({document.files.length})</span>
          </h4>
          <div className="attachments">
            {document.files.map((f, i) => (
              <button
                key={f.uuid}
                className={
                  fileIndex === i ? "attachment selected" : "attachment"
                }
                onClick={() => setFileIndex(i)}
                aria-pressed={fileIndex === i}
              >
                <FileText size={18} />
                <span>
                  {f.fileName}
                  <small>PDF</small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="button primary full-width"
            onClick={download}
            disabled={downloading}
          >
            <Download size={16} />
            {t("download")}
          </button>
          <p className="small muted">{t("samplePdf")}</p>
        </div>
        <div className="pdf-panel">
          <div className="pdf-toolbar">
            <span>{t("preview")}</span>
            {url && (
              <a href={url} target="_blank" rel="noreferrer">
                {t("openPdf")}
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {failed ? (
            <div className="pdf-status" role="alert">
              <p>{t("requestFailed")}</p>
              <button
                className="button secondary"
                onClick={() => setRetry((v) => v + 1)}
              >
                {t("retry")}
              </button>
            </div>
          ) : url ? (
            <PdfPreview
              key={url}
              url={url}
              title={document.titleI18n[locale]}
            />
          ) : (
            <div className="pdf-status">
              <Loader2 size={22} className="spin" />
              <span>{t("working")}</span>
            </div>
          )}
          <p className="small muted pdf-fallback">{t("pdfFallback")}</p>
        </div>
      </div>
    </Modal>
  );
}
