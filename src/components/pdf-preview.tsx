"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const { t } = useI18n();
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | undefined;
    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const pdf = await loading.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale: 1.8 });
        const element = canvas.current;
        element.width = viewport.width;
        element.height = viewport.height;
        await page.render({ canvas: element, viewport }).promise;
        if (!cancelled) setState("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("PDF preview failed", error);
          setState("error");
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);
  return (
    <div className="rendered-pdf" aria-busy={state === "loading"}>
      {state === "loading" && (
        <div className="pdf-render-status">
          <Loader2 className="spin" size={20} />
          <span>{t("working")}</span>
        </div>
      )}
      {state === "error" && (
        <div className="pdf-render-status" role="alert">
          {t("pdfFallback")}
        </div>
      )}
      <canvas
        ref={canvas}
        aria-label={title}
        role="img"
        data-ready={state === "ready"}
        style={{ display: state === "ready" ? "block" : "none" }}
      />
    </div>
  );
}
