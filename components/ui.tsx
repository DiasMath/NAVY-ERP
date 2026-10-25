import type { ReactNode } from "react";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";

export function PageIntro({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function Panel({ title, kicker, action, children, className = "" }: { title?: string; kicker?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{(title || kicker || action) && <div className="panel-heading"><div>{kicker && <span className="eyebrow">{kicker}</span>}{title && <h2>{title}</h2>}</div>{action}</div>}{children}</section>;
}

export function PreviewNotice({ children }: { children?: ReactNode }) {
  return <div className="preview-notice"><span className="preview-dot" /><span>{children ?? "Prévia visual com dados fictícios. Nenhum registro é salvo nesta etapa."}</span></div>;
}

export function IconTile({ icon: Icon, tone = "blue" }: { icon: LucideIcon; tone?: string }) {
  return <span className={`icon-tile tone-${tone}`}><Icon size={19} strokeWidth={1.85} /></span>;
}

export function Avatar({ initials, tone = "blue", large = false }: { initials: string; tone?: string; large?: boolean }) {
  return <span className={`avatar tone-${tone} ${large ? "avatar-large" : ""}`}>{initials}</span>;
}

export function StatusBadge({ status }: { status: "Confirmado" | "Pendente" | "Concluído" | "Em construção" }) {
  return <span className={`status-badge status-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(" ", "-")}`}>{status}</span>;
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="empty-state"><Icon size={26} /><h3>{title}</h3><p>{description}</p></div>;
}

export function Modal({ title, eyebrow, children, onClose, footer }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><div className="modal-top"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>;
}

export function PreviewFeedback({ text = "Prévia concluída. Nenhum dado foi salvo." }: { text?: string }) {
  return <div className="preview-feedback"><Check size={17} />{text}</div>;
}

export function ActionButton({ children, onClick, secondary = false, disabled = false, type = "button" }: { children: ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean; type?: "button" | "submit" }) {
  return <button className={`action-button ${secondary ? "action-secondary" : ""}`} onClick={onClick} disabled={disabled} type={type}>{children}</button>;
}

export function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-action" onClick={onClick}>{children}<ArrowRight size={15} /></button>;
}
