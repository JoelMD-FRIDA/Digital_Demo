"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    { t } = useI18n();
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (
      !returnFocus.current &&
      document.activeElement instanceof HTMLElement &&
      !dialog.contains(document.activeElement)
    ) {
      returnFocus.current = document.activeElement;
    }
    dialog.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = original;
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <header className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
