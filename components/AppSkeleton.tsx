"use client";

export default function AppSkeleton() {
  return <div className="navy-app-skeleton" role="status" aria-label="Carregando NAVY">
    <aside className="navy-skeleton-sidebar" aria-hidden="true"><span className="navy-skeleton-mark" /><span className="navy-skeleton-line" /><span className="navy-skeleton-line short" /><span className="navy-skeleton-line" /><span className="navy-skeleton-line short" /></aside>
    <div className="navy-skeleton-main" aria-hidden="true"><div className="navy-skeleton-header"><span /><span /></div><div className="navy-skeleton-content"><div className="navy-skeleton-title" /><div className="navy-skeleton-subtitle" /><div className="navy-skeleton-cards"><div /><div /><div /></div><div className="navy-skeleton-body"><div /><div /></div></div></div>
    <span className="sr-only">Carregando sua área de trabalho.</span>
  </div>;
}
