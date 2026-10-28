"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import StitchHeader from "./StitchHeader";
import StitchSidebar from "./StitchSidebar";
import StitchViewport from "./StitchViewport";
import { initialServiceProfessionals, initialServices, serviceProfessionalsStorageKey, serviceStorageKey } from "@/features/services/service-data";

export default function StitchShell({ path, screen, children }: { path: string; screen?: string; children?: ReactNode }) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("navy-menu-collapsed") === "1");
      setFocusMode(localStorage.getItem("navy-focus-mode") === "1");
    } catch { /* A prévia funciona sem armazenamento local. */ }
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => { setFrameReady(false); }, [screen]);

  useEffect(() => {
    const navigateFromFrame = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== "navy:navigate" || typeof event.data.path !== "string") return;
      const destination = event.data.path;
      if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes("\\")) return;
      router.push(destination);
    };
    window.addEventListener("message", navigateFromFrame);
    return () => window.removeEventListener("message", navigateFromFrame);
  }, [router]);

  useEffect(() => {
    try {
      if (localStorage.getItem(serviceStorageKey) === null) localStorage.setItem(serviceStorageKey, JSON.stringify(initialServices));
      if (localStorage.getItem(serviceProfessionalsStorageKey) === null) localStorage.setItem(serviceProfessionalsStorageKey, JSON.stringify(initialServiceProfessionals));
    } catch { /* The visual preview still opens without browser storage. */ }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("navy-menu-collapsed", next ? "1" : "0"); } catch { /* optional */ }
  };
  const toggleFocus = () => {
    const next = !focusMode;
    setFocusMode(next);
    try { localStorage.setItem("navy-focus-mode", next ? "1" : "0"); } catch { /* optional */ }
    frameRef.current?.contentWindow?.postMessage({ type: "navy-focus-mode", enabled: next }, window.location.origin);
  };
  const onFrameLoad = () => {
    setFrameReady(true);
    frameRef.current?.contentWindow?.postMessage({ type: "navy-focus-mode", enabled: focusMode }, window.location.origin);
  };

  return <div className={`stitch-shell ${collapsed ? "stitch-shell-collapsed" : ""} ${mobileOpen ? "stitch-shell-mobile-open" : ""} ${focusMode ? "stitch-shell-focus-mode" : ""}`}>
    {mobileOpen && <button type="button" className="stitch-mobile-shade" onClick={() => setMobileOpen(false)} aria-label="Fechar menu lateral" />}
    <StitchSidebar path={path} collapsed={collapsed} onCollapse={toggleCollapsed} onMobileClose={() => setMobileOpen(false)} />
    <StitchHeader mobileOpen={mobileOpen} onMobileMenu={() => setMobileOpen(true)} focusMode={focusMode} onToggleFocus={toggleFocus} />
    {screen ? <StitchViewport ref={frameRef} screen={screen} ready={frameReady} onLoad={onFrameLoad} /> : <main className="stitch-native-content">{children}</main>}
  </div>;
}
