"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { stitchNavigation } from "@/lib/stitch-navigation";
import { useAuth } from "@/features/auth/AuthProvider";

const scrollStorageKey = "navy-sidebar-scroll-top";
let rememberedScrollTop: number | null = null;

const logoUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuBOPwmN8ubExq7S84y-7r1VFs4XjAMwKTL0TCyEvbh2H5YeLyn3Hy41lQmZLf8FhXOSxveVJzv-z0RmRXkpPJml4mOQWHIy9GLXDq22HYzfs5kuNP8TtuzW2PA2L6vxU_vnEMVaO4TIOp-1b8vTus2vlDMhnYDwE8OEpky6ZmLIv6oVtFyRZj3EDUzyPX5dcNWUY1ZVQO8dHq6MM-CBhGrkCee6jkyJT97mcgpaVuwMbPo9Fur6sK1i";

function Icon({ name }: { name: string }) {
  return <span aria-hidden="true" className="material-symbols-outlined">{name}</span>;
}

export default function StitchSidebar({ path, collapsed, onCollapse, onMobileClose }: { path: string; collapsed: boolean; onCollapse: () => void; onMobileClose: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  const { profile } = useAuth();
  const fieldMode = profile?.role === "professional";

  const rememberScroll = () => {
    if (collapsed || !navRef.current) return;
    rememberedScrollTop = navRef.current.scrollTop;
    try { sessionStorage.setItem(scrollStorageKey, String(rememberedScrollTop)); } catch { /* Navegação continua sem armazenamento. */ }
  };

  useLayoutEffect(() => {
    if (collapsed || !navRef.current) return;
    if (rememberedScrollTop === null) {
      try { rememberedScrollTop = Number(sessionStorage.getItem(scrollStorageKey)) || 0; } catch { rememberedScrollTop = 0; }
    }
    navRef.current.scrollTop = rememberedScrollTop;
  }, [path, collapsed]);

  return <aside id="stitch-navigation" className="stitch-sidebar" aria-label="Navegação lateral">
    <div className="stitch-sidebar-top">
      <Link href={fieldMode ? "/campo" : "/dashboard"} className="stitch-brand" onClick={onMobileClose} aria-label={fieldMode ? "NAVY — Minha agenda" : "NAVY — Dashboard"}><img src={logoUrl} alt="" /><span><strong>NAVY</strong><small>Clinical ERP</small></span></Link>
      <button type="button" className="stitch-sidebar-toggle" onClick={() => { rememberScroll(); onCollapse(); }} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-expanded={!collapsed}><Icon name={collapsed ? "menu_open" : "left_panel_close"} /></button>
      <button type="button" className="stitch-sidebar-mobile-close" onClick={onMobileClose} aria-label="Fechar menu"><Icon name="close" /></button>
    </div>
    <nav ref={navRef} className="stitch-sidebar-nav" aria-label="Menu principal" onScroll={rememberScroll}>
      {fieldMode ? <div className="stitch-nav-group"><span className="stitch-nav-heading">ATENDIMENTOS</span><Link href="/campo" onClick={onMobileClose} className="stitch-nav-link stitch-nav-active" aria-current="page"><Icon name="calendar_month" /><span>Minha agenda</span></Link></div> : stitchNavigation.map((group) => <div className="stitch-nav-group" key={group.label}>
        <span className="stitch-nav-heading">{group.label}</span>
        {group.items.map((item) => { const active = path === item.href || (item.href === "/configuracoes" && path.startsWith("/configuracoes/")); return <Link key={item.href} href={item.href} onClick={() => { rememberScroll(); onMobileClose(); }} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={active ? "page" : undefined} className={`stitch-nav-link ${active ? "stitch-nav-active" : ""}`}><Icon name={item.icon} /><span>{item.label}</span></Link>; })}
      </div>)}
    </nav>
    {!fieldMode && <Link href="/configuracoes" className="stitch-sidebar-unit" onClick={() => { rememberScroll(); onMobileClose(); }} aria-label="Configurações da Unidade Matriz"><span><strong>Unidade Matriz</strong><small>São Paulo • Jardins</small></span><Icon name="settings" /></Link>}
  </aside>;
}
