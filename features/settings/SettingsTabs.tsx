"use client";

import Link from "next/link";

const tabs = [
  { href: "/configuracoes", label: "Políticas Clínicas & Agenda", icon: "tune" },
  { href: "/configuracoes/financeiro", label: "Financeiro & Margens de Segurança", icon: "shield_with_heart" },
  { href: "/configuracoes/biosseguranca", label: "Biossegurança & Prazos", icon: "sanitizer" },
  { href: "/configuracoes/unidade", label: "Dados da Unidade & Fiscal", icon: "domain" },
  { href: "/configuracoes/integracoes", label: "Integrações & WhatsApp API", icon: "hub" },
];

export default function SettingsTabs({ active, onNavigate }: { active: string; onNavigate?: () => boolean }) {
  return <nav className="si-tabs" aria-label="Seções de configurações">{tabs.map(tab => tab.href === active
    ? <span key={tab.href} className="si-tab-active" aria-current="page"><span className="material-symbols-outlined">{tab.icon}</span>{tab.label}</span>
    : <Link key={tab.href} href={tab.href} onClick={event => { if (onNavigate && !onNavigate()) event.preventDefault(); }}><span className="material-symbols-outlined">{tab.icon}</span>{tab.label}</Link>)}</nav>;
}
