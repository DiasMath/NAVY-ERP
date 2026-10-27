"use client";

import { type ReactNode } from "react";
import RightViewDialog from "./RightViewDialog";

export default function ContentDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <RightViewDialog title={title} onClose={onClose} wide={wide}>
    <section className="nc-side-panel">
      <div className="nc-dialog-head"><span className="nc-dialog-dot" /><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`Fechar ${title}`}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
      <div className="nc-side-panel-body">{children}</div>
    </section>
  </RightViewDialog>;
}
