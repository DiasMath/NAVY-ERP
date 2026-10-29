"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { stitchNavItems } from "@/lib/stitch-navigation";
import { PageIntro } from "./ui";
import { stitchPages } from "@/lib/stitch-pages";
import StitchShell from "./StitchShell";
import ClientsPage from "@/features/clients/ClientsPage";
import ServicesPage from "@/features/services/ServicesPage";
import AgendaPage from "@/features/agenda/AgendaPage";
import IntegrationsPage from "@/features/settings/IntegrationsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import LoginPage from "@/features/auth/LoginPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { hasPermission, type NavyPermission } from "@/lib/access-control";
import UsersPage from "@/features/admin/UsersPage";
import FieldPage from "@/features/field/FieldPage";

function AccessDenied({ required }: { required: NavyPermission[] }) { return <div className="coming-page"><PageIntro eyebrow="ACESSO RESTRITO" title="Sem permissão" subtitle={`Esta tela precisa dos acessos: ${required.join(", ")}. Peça a um administrador da NAVY.`} /></div>; }

function ComingSoonPage({ path }: { path: string }) {
  const futureTitles: Record<string, string> = { "/whatsapp": "WhatsApp", "/agendamento-online": "Agendamento online", "/campanhas": "Campanhas", "/atividades": "Atividades" };
  const title = stitchNavItems.find((item) => item.href === path)?.label ?? futureTitles[path] ?? "Página não encontrada";
  return <div className="coming-page"><PageIntro eyebrow="PRÓXIMOS INCREMENTOS" title={title} subtitle="A navegação está preparada para crescer com a NAVY." /><div className="coming-card"><div className="coming-art"><span /><Sparkles size={42} strokeWidth={1.5} /></div><span className="eyebrow">EM CONSTRUÇÃO</span><h2>Vamos construir esta etapa<br />com atenção aos detalhes.</h2><p>Esta área será ativada quando tiver fluxos, dados persistidos e permissões reais.</p><Link href="/dashboard" className="action-button">Voltar ao dashboard <ArrowRight size={16} /></Link></div></div>;
}

function LoginRedirect({ path }: { path: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/login?next=${encodeURIComponent(path)}`); }, [router, path]);
  return <div className="login-loading">Redirecionando para o acesso…</div>;
}

function ProfessionalRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/campo"); }, [router]);
  return <div className="login-loading">Abrindo sua agenda…</div>;
}

const configurationSections: Record<string, string> = {
  "/configuracoes": "clinica",
  "/configuracoes/financeiro": "financeiro",
  "/configuracoes/biosseguranca": "biosseguranca",
  "/configuracoes/unidade": "unidade",
};

export default function NavyApp({ path }: { path: string }) {
  const current = path === "/" ? "/dashboard" : path;
  const { status, profile } = useAuth();
  if (current === "/login") return <LoginPage />;
  if (status === "loading") return <div className="login-loading">Verificando acesso…</div>;
  if (status === "unauthenticated") return <LoginRedirect path={current} />;
  if (profile?.role === "professional" && current !== "/campo") return <ProfessionalRedirect />;
  if (current === "/campo") {
    const required: NavyPermission[] = ["agenda.read", "clients.read", "sessions.read"];
    const missing = required.filter(permission => !hasPermission(profile, permission));
    return <StitchShell path={current}>{profile?.role === "professional" && !missing.length ? <FieldPage /> : <AccessDenied required={missing.length ? missing : required} />}</StitchShell>;
  }
  const protectedRoutes: Record<string, NavyPermission[]> = { "/clientes": ["clients.read", "sessions.read", "agenda.read"], "/servicos": ["services.read", "professionals.read"], "/agenda": ["agenda.read", "clients.read", "sessions.read", "services.read", "professionals.read"], "/usuarios": ["users.read"], "/configuracoes/integracoes": ["integrations.read"] };
  const missing = protectedRoutes[current]?.filter(permission => !hasPermission(profile, permission)) ?? [];
  if (missing.length) return <StitchShell path={current}><AccessDenied required={missing} /></StitchShell>;
  if (current === "/clientes") return <StitchShell path={current}><ClientsPage /></StitchShell>;
  if (current === "/servicos") return <StitchShell path={current}><ServicesPage /></StitchShell>;
  if (current === "/agenda") return <StitchShell path={current}><AgendaPage /></StitchShell>;
  if (current === "/usuarios") return <StitchShell path={current}><UsersPage /></StitchShell>;
  if (current === "/configuracoes/integracoes") return <StitchShell path={current}><IntegrationsPage /></StitchShell>;
  if (configurationSections[current]) return hasPermission(profile, "users.read")
    ? <StitchShell path={current}><SettingsPage key={current} section={configurationSections[current] as "clinica" | "financeiro" | "biosseguranca" | "unidade"} /></StitchShell>
    : <StitchShell path={current}><AccessDenied required={["users.read"]} /></StitchShell>;
  if (stitchPages[current]) return <StitchShell path={current} screen={stitchPages[current]} />;
  return <StitchShell path={current}><ComingSoonPage path={current} /></StitchShell>;
}
