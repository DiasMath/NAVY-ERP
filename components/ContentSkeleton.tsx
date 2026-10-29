"use client";

export default function ContentSkeleton({ label = "Carregando conteúdo", rows = 3 }: { label?: string; rows?: number }) {
  return <div className="navy-content-skeleton" role="status" aria-label={label}>{Array.from({ length: rows }, (_, index) => <span key={index} />)}<span className="sr-only">{label}</span></div>;
}
