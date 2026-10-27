"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { stitchNavItems } from "@/lib/stitch-navigation";
import { useAuth } from "@/features/auth/AuthProvider";

const avatarUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCofQkjk3DiiD6LDl1Q8geJ4XSkzkpbewIaJ_TMBaXjUP44noY7d548_5I7EVtFqIw2hmRFiLTM3roWoVPvW2j1WssKAc6zvPfamoZvOBbrzg8c36uw4fmJ0LfucV-712QNXQWIItYmosBpzqjSJwomPxW0OorrF0Fgy44TR3dvnKcVBLNTSY5GF9YzSaFYrSGn4zgEX7oG2pNhJ-Gig-4NXZVQRQzN3Bz4s3HSMZjxmshmlhdkGktA";

type Panel = "date" | "notifications" | "help" | "profile" | null;

function Icon({ name }: { name: string }) {
  return <span aria-hidden="true" className="material-symbols-outlined">{name}</span>;
}

export default function StitchHeader({ mobileOpen, onMobileMenu, focusMode, onToggleFocus }: { mobileOpen: boolean; onMobileMenu: () => void; focusMode: boolean; onToggleFocus: () => void }) {
  const router = useRouter();
  const { status, user, profile, signOut } = useAuth();
  const profileName = status === "authenticated" ? profile?.name ?? user?.email ?? "Usuário NAVY" : "Dra. Camila NAVY";
  const profileSubtitle = status === "authenticated" ? user?.email ?? "Equipe NAVY" : "Master Lash & Beauty";
  const panelRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateLabel, setDateLabel] = useState("Hoje");

  useEffect(() => {
    const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date());
    setDateLabel(`Hoje, ${date}`);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenPanel(null); setSearchOpen(false); }
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".stitch-header-popover-wrap")) setOpenPanel(null);
      if (!target.closest(".stitch-header-search")) setSearchOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("click", closeOnOutsideClick);
    return () => { window.removeEventListener("keydown", closeOnEscape); document.removeEventListener("click", closeOnOutsideClick); };
  }, []);

  useEffect(() => {
    if (openPanel === "profile") panelRef.current?.querySelector<HTMLElement>("a, input")?.focus();
  }, [openPanel]);

  useEffect(() => {
    if (mobileOpen) { setOpenPanel(null); setSearchOpen(false); }
  }, [mobileOpen]);

  const togglePanel = (panel: Exclude<Panel, null>) => {
    setOpenPanel((current) => current === panel ? null : panel);
    setSearchOpen(false);
  };
  const matches = search.trim()
    ? stitchNavItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))).slice(0, 6)
    : [];
  const navigateToFirst = () => {
    if (!matches[0]) return;
    router.push(matches[0].href);
    setSearch("");
    setSearchOpen(false);
  };

  return <>
    {(openPanel || (searchOpen && search.trim())) && <button type="button" className="stitch-popover-shade" onClick={() => { setOpenPanel(null); setSearchOpen(false); }} aria-label="Fechar menu aberto" />}
    <header className="stitch-header">
    <div className="stitch-header-search-wrap">
      <button type="button" className="stitch-mobile-menu" onClick={onMobileMenu} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="stitch-navigation"><Icon name="menu" /></button>
      <div className="stitch-header-search"><Icon name="search" /><input value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter") navigateToFirst(); if (event.key === "Escape") setSearchOpen(false); }} aria-label="Buscar módulo" placeholder="Buscar módulo..." />
        {searchOpen && search.trim() && <div className="stitch-search-results" aria-label="Resultados da busca">{matches.length ? matches.map((item) => <Link href={item.href} key={item.href} onClick={() => { setSearch(""); setSearchOpen(false); }}><Icon name={item.icon} />{item.label}</Link>) : <span className="stitch-search-empty">Nenhum módulo encontrado</span>}</div>}
      </div>
    </div>
    <div className="stitch-header-actions">
      <div className="stitch-header-popover-wrap"><button type="button" className="stitch-header-date" onClick={() => togglePanel("date")} aria-expanded={openPanel === "date"} aria-controls="stitch-date-popover"><Icon name="calendar_today" /><span>{dateLabel}</span><Icon name="expand_more" /></button>{openPanel === "date" && <div id="stitch-date-popover" className="stitch-help-popover" role="dialog" aria-label="Data e agenda"><strong>{dateLabel}</strong><p>Consulte os horários e atendimentos na agenda operacional.</p><Link href="/agenda" onClick={() => setOpenPanel(null)}>Abrir agenda</Link></div>}</div>
      <div className="stitch-header-popover-wrap stitch-notification-wrap"><button type="button" className="stitch-header-icon" onClick={() => togglePanel("notifications")} aria-label="Notificações" aria-expanded={openPanel === "notifications"} aria-controls="stitch-notification-popover"><Icon name="notifications" /></button>{openPanel === "notifications" && <div id="stitch-notification-popover" className="stitch-help-popover" role="dialog" aria-label="Notificações"><strong>Notificações</strong><p>Não há notificações configuradas.</p></div>}</div>
      <div className="stitch-header-popover-wrap stitch-help-wrap"><button type="button" className="stitch-header-icon" onClick={() => togglePanel("help")} aria-label="Ajuda" aria-expanded={openPanel === "help"} aria-controls="stitch-help-popover"><Icon name="help_outline" /></button>{openPanel === "help" && <div id="stitch-help-popover" className="stitch-help-popover" role="dialog" aria-label="Ajuda"><strong>{status === "authenticated" ? "Ajuda NAVY" : "Sobre esta prévia"}</strong><p>{status === "authenticated" ? "Clientes, Serviços e Agenda usam os dados da NAVY Matriz em tempo real." : "Estamos padronizando a interface NAVY. Os dados das telas são ilustrativos."}</p></div>}</div>
      <span className="stitch-header-divider" />
      <div className="stitch-header-popover-wrap"><button type="button" className="stitch-profile-trigger" onClick={() => togglePanel("profile")} aria-label="Abrir menu do perfil" aria-expanded={openPanel === "profile"} aria-controls="stitch-profile-menu"><span><strong>{profileName}</strong><small>{profileSubtitle}</small></span><img src={avatarUrl} alt="" /></button>
        {openPanel === "profile" && <div ref={panelRef} id="stitch-profile-menu" className="stitch-profile-menu" role="dialog" aria-label="Menu do perfil"><div className="stitch-profile-identity"><img src={avatarUrl} alt="" /><span><strong>{profileName} <Icon name="verified" /></strong><small>{status === "authenticated" ? `${profile?.role.replace("_", " ")} • NAVY Matriz` : "Master Admin & RT • NAVY Matriz"}</small><small>{status === "authenticated" ? profileSubtitle : "Prévia visual do perfil"}</small></span></div><div className="stitch-profile-section"><span>OPERAÇÃO NAVY</span><strong>NAVY Matriz</strong><small>{status === "authenticated" ? "Acesso autenticado" : "São Paulo • Jardins"}</small></div><div className="stitch-profile-links"><Link href="/configuracoes" onClick={() => setOpenPanel(null)}><Icon name="badge" /> Meu Perfil & Assinatura Digital</Link><Link href="/usuarios" onClick={() => setOpenPanel(null)}><Icon name="key" /> Segurança & Chaves de Acesso</Link><Link href="/configuracoes" onClick={() => setOpenPanel(null)}><Icon name="tune" /> Preferências da Clínica</Link><Link href="/atividades" onClick={() => setOpenPanel(null)}><Icon name="history_edu" /> Registro de Atividades</Link></div><label className="stitch-focus-toggle"><Icon name="visibility_off" /> Modo Foco <input type="checkbox" checked={focusMode} onChange={onToggleFocus} /></label>{status === "authenticated" ? <button type="button" className="stitch-profile-signout" onClick={() => { setOpenPanel(null); void signOut(); }}><Icon name="logout" /> Sair da conta</button> : <Link href="/login" className="stitch-profile-signout" onClick={() => setOpenPanel(null)}><Icon name="logout" /> Ver tela de acesso</Link>}</div>}
      </div>
    </div>
    </header>
  </>;
}
