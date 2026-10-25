"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function ContentDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="nc-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`nc-dialog ${wide ? "nc-dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="nc-dialog-head"><span className="nc-dialog-dot" /><h2>{title}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar diálogo"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
      <div className="nc-dialog-body">{children}</div>
    </section>
  </div>;
}
