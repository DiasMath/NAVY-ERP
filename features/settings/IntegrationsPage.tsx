"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { navyApi } from "@/lib/firebase/navy-api";
import "./integrations.css";

type DriveStatus = {
  configured: boolean;
  connected: boolean;
  canConnect: boolean;
  ownerEmail?: string;
};

export default function IntegrationsPage() {
  const { user, signOut } = useAuth();
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusRevision, setStatusRevision] = useState(0);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("drive");
    if (result === "connected") setMessage("Google Drive conectado. As fotos das clientes já podem ser enviadas.");
    if (result === "error") setMessage("Não foi possível concluir a autorização. Confira a conta Google e tente novamente.");
    if (result) window.history.replaceState(null, "", "/configuracoes/integracoes");
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setStatusError("");
    navyApi(user, "/api/drive/status")
      .then(response => response.json())
      .then((status: DriveStatus) => { if (active) setDrive(status); })
      .catch(error => { if (active) { setDrive(null); setStatusError(error instanceof Error ? error.message : "Não foi possível consultar as integrações."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, statusRevision]);

  const connectDrive = async () => {
    if (!user || connecting) return;
    setConnecting(true);
    setMessage("");
    try {
      const response = await navyApi(user, "/api/drive/oauth/start", { method: "POST" });
      const data = await response.json() as { url: string };
      const destination = new URL(data.url);
      if (destination.origin !== "https://accounts.google.com") throw new Error("Destino de autorização inválido.");
      window.location.assign(destination.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a conexão com o Drive.");
      setConnecting(false);
    }
  };

  return <div className="si-page">
    <div className="si-heading">
      <div className="si-eyebrow">ADMINISTRAÇÃO <span>•</span> CONFIGURAÇÕES GERAIS</div>
      <h1>Integrações</h1>
      <p>Conecte serviços externos usados pela unidade NAVY.</p>
    </div>
    <nav className="si-tabs" aria-label="Seções de configurações">
      <Link href="/configuracoes"><span className="material-symbols-outlined">tune</span> Políticas Clínicas &amp; Agenda</Link>
      <span className="si-tab-active" aria-current="page"><span className="material-symbols-outlined">hub</span> Integrações &amp; WhatsApp API</span>
    </nav>
    {message && <div className="si-message" role="status">{message}</div>}
    {statusError && <div className="si-message si-message-error" role="alert"><span>Não foi possível verificar o Drive: {statusError}</span><div><button type="button" onClick={() => setStatusRevision(value => value + 1)}>Tentar novamente</button><button type="button" onClick={() => void signOut().then(() => window.location.assign("/login?next=%2Fconfiguracoes%2Fintegracoes"))}>Entrar novamente</button></div></div>}
    <div className="si-grid">
      <section className="si-card" aria-labelledby="si-drive-title">
        <div className="si-card-top"><span className="si-icon"><span className="material-symbols-outlined">cloud</span></span><span className={`si-status ${drive?.connected ? "si-connected" : ""}`}>{loading ? "Verificando" : statusError ? "Verificação indisponível" : drive?.connected ? "Conectado" : "Não conectado"}</span></div>
        <h2 id="si-drive-title">Google Drive</h2>
        <p>Armazena as fotos de perfil e a galeria das clientes em uma pasta privada. A NAVY libera cada imagem somente para usuários autenticados.</p>
        {drive?.connected && <div className="si-account"><span>Conta autorizada</span><strong>{drive.ownerEmail}</strong><small>Pasta do aplicativo: NAVY Clientes</small></div>}
        {!loading && drive && !drive.connected && <div className="si-account"><span>Conta Google da clínica</span><strong>Escolha a conta na tela do Google</strong><small>Use a conta proprietária da pasta NAVY-ERP.</small></div>}
        <div className="si-actions">
          {drive?.configured && drive.canConnect && <button type="button" className="si-primary" disabled={connecting} onClick={() => void connectDrive()}>{connecting ? "Abrindo Google..." : drive.connected ? "Reconectar Google Drive" : "Escolher conta Google"}</button>}
          {drive?.connected && <Link className="si-secondary" href="/clientes">Abrir Clientes</Link>}
        </div>
        {!loading && drive && !drive.configured && <p className="si-hint">As credenciais privadas do aplicativo ainda precisam ser configuradas no servidor.</p>}
        {!loading && drive && !drive.canConnect && !drive.connected && <p className="si-hint">Peça a um administrador da NAVY para autorizar esta integração.</p>}
      </section>
      <section className="si-card" aria-labelledby="si-whatsapp-title">
        <div className="si-card-top"><span className="si-icon"><span className="material-symbols-outlined">chat</span></span><span className="si-status">Planejado</span></div>
        <h2 id="si-whatsapp-title">WhatsApp API</h2>
        <p>A conexão para envio de mensagens será configurada nesta área quando o módulo de comunicação estiver pronto.</p>
        <div className="si-account"><span>Estado atual</span><strong>Rascunhos manuais em Clientes</strong><small>O sistema não envia mensagens automaticamente.</small></div>
      </section>
    </div>
  </div>;
}
