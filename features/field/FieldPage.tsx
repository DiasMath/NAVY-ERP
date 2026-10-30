"use client";

import { useEffect, useRef, useState } from "react";
import type { AppointmentDocument } from "@/lib/firebase/documents";
import { useAuth } from "@/features/auth/AuthProvider";
import { navyApi } from "@/lib/firebase/navy-api";
import { prepareImageUpload } from "@/features/clients/client-images";
import { hasPermission } from "@/lib/access-control";
import ContentSkeleton from "@/components/ContentSkeleton";
import ContentDialog from "@/components/ContentDialog";
import "./field.css";

type ClientSummary = { id: string; name: string; phone: string; city: string };
type History = { id: string; appointmentId: string; serviceName: string; startedAt: string; notes: string };
type ClientDetail = { id: string; name: string; phone: string; city: string; clinicalNote: string; preferences: string };
type Photo = { id: string; name: string; canRemove: boolean; url?: string };
type ServiceDetail = { description: string; consumables: { name: string; quantity: string }[] };
type Mode = "today" | "upcoming" | "history";

const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", weekday: "long" }).format(new Date(`${value}T12:00:00`));
const historyLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
const totalMinutes = (item: AppointmentDocument) => item.lines.reduce((sum, line) => sum + line.durationMinutes, 0);
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const clock = (milliseconds: number) => {
  if (!Number.isFinite(milliseconds)) return "";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
};
const saoPauloMinuteKey = (milliseconds: number) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(milliseconds)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export default function FieldPage() {
  const { user, profile } = useAuth();
  const adminPreview = profile?.role === "admin" || profile?.role === "master_admin";
  const [appointments, setAppointments] = useState<AppointmentDocument[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});
  const [today, setToday] = useState("");
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [mode, setMode] = useState<Mode>("today");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmEarlyId, setConfirmEarlyId] = useState("");
  const [confirmCompletionId, setConfirmCompletionId] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!user) return;
    const response = await navyApi(user, "/api/field");
    const data = await response.json() as { appointments: AppointmentDocument[]; clients: ClientSummary[]; serviceDetails: Record<string, ServiceDetail>; today: string; serverNow: string };
    const offset = Date.parse(data.serverNow) - Date.now();
    setAppointments(data.appointments); setClients(data.clients); setServiceDetails(data.serviceDetails ?? {}); setToday(data.today);
    if (Number.isFinite(offset)) { setServerOffset(offset); setNow(Date.now() + offset); }
    setSelectedId(current => current && data.appointments.some(item => item.id === current) ? current : data.appointments.find(item => item.date >= data.today)?.id ?? data.appointments.at(-1)?.id ?? "");
  };
  useEffect(() => {
    let active = true;
    (async () => { try { await reload(); } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Não foi possível carregar sua agenda."); } finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  // A lista é recarregada quando a conta autenticada muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => window.clearInterval(interval);
  }, [serverOffset]);

  const selected = appointments.find(item => item.id === selectedId);
  const selectedSummary = clients.find(item => item.id === selected?.clientId);
  useEffect(() => {
    if (!user || !selected?.clientId) { setDetail(null); setHistory([]); return; }
    let active = true;
    (async () => {
      setDetail(null); setHistory([]);
      try {
        const response = await navyApi(user, `/api/field/client?clientId=${encodeURIComponent(selected.clientId)}`);
        const data = await response.json() as { client: ClientDetail; history: History[] };
        if (active) { setDetail(data.client); setHistory(data.history); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Não foi possível abrir a cliente."); }
    })();
    return () => { active = false; };
  }, [user, selected?.clientId, photoRevision]);
  useEffect(() => {
    if (!user || !selected?.clientId) { setPhotos([]); return; }
    let active = true;
    const urls: string[] = [];
    (async () => {
      setPhotos([]);
      try {
        const response = await navyApi(user, `/api/clients/${selected.clientId}/photos`);
        const data = await response.json() as { photos: Photo[] };
        const loaded = await Promise.all(data.photos.slice(0, 30).map(async photo => {
          try {
            const image = await navyApi(user, `/api/clients/${selected.clientId}/images/${photo.id}`);
            const url = URL.createObjectURL(await image.blob()); urls.push(url);
            return { ...photo, url };
          } catch { return photo; }
        }));
        if (active) setPhotos(loaded);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Não foi possível abrir as fotos."); }
    })();
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [user, selected?.clientId, photoRevision]);

  const visible = appointments.filter(item => mode === "today" ? item.date === today : mode === "upcoming" ? item.date > today : item.date < today);
  const existingSession = history.find(item => item.appointmentId === selectedId);
  const phone = (detail?.phone ?? selectedSummary?.phone ?? "").replace(/[^\d+]/g, "");
  const route = selected?.place === "Home" && selected.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address)}` : "";
  const canChangeStatus = !adminPreview && hasPermission(profile, "agenda.write");
  const canSaveSession = !adminPreview && hasPermission(profile, "sessions.write");
  const canUploadPhoto = !adminPreview && hasPermission(profile, "clients.write");

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await action(); await reload(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação."); }
    finally { setBusy(false); }
  };
  const changeStatus = (id: string, status: "Em atendimento" | "Concluído", earlyStartConfirmed = false) => run(async () => {
    if (!user) return;
    await navyApi(user, "/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, ...(earlyStartConfirmed ? { earlyStartConfirmed: true } : {}) }) });
    setConfirmEarlyId("");
    setConfirmCompletionId("");
  }, status === "Concluído" ? "Atendimento concluído." : "Atendimento iniciado.");
  const startAppointment = (item: AppointmentDocument) => {
    if (now && saoPauloMinuteKey(now) < `${item.date}T${item.time}`) setConfirmEarlyId(item.id);
    else void changeStatus(item.id, "Em atendimento");
  };
  const completeAppointment = (item: AppointmentDocument) => {
    if (now && saoPauloMinuteKey(now) < `${item.date}T${item.time}` && !item.earlyStartConfirmedAt) setConfirmCompletionId(item.id);
    else void changeStatus(item.id, "Concluído");
  };
  const saveSession = () => run(async () => {
    if (!user || !selected) return;
    await navyApi(user, "/api/field/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: selected.id, notes }) });
    setNotes(""); setPhotoRevision(current => current + 1);
  }, "Sessão registrada na ficha da cliente.");
  const upload = (file?: File) => run(async () => {
    if (!user || !selected || !file || !consent) throw new Error("Confirme o consentimento e escolha uma imagem.");
    const prepared = await prepareImageUpload(file, "gallery");
    const form = new FormData(); form.set("file", prepared); form.set("consentConfirmed", "true");
    await navyApi(user, `/api/clients/${selected.clientId}/photos`, { method: "POST", body: form });
    setPhotoRevision(current => current + 1);
  }, "Foto salva na galeria da cliente.");
  const removePhoto = (photo: Photo) => run(async () => {
    if (!user || !selected || !photo.canRemove) return;
    await navyApi(user, `/api/clients/${selected.clientId}/photos/${photo.id}`, { method: "DELETE" });
    setPhotoRevision(current => current + 1);
  }, "Foto removida.");

  return <div className="field-page">
    <header className="field-heading"><span>ATENDIMENTO EM CAMPO</span><h1>{adminPreview ? "Prévia da agenda em campo" : "Minha agenda"}</h1><p>{adminPreview ? "Visualização da equipe para revisar a experiência mobile. Registros e alterações são feitos pela profissional vinculada." : `${profile?.name ? `Olá, ${profile.name}. ` : ""}Seus atendimentos e as informações necessárias para cada visita.`}</p><button type="button" onClick={() => void run(reload, "Agenda atualizada.")} disabled={busy}>Atualizar agenda</button></header>
    {adminPreview && <p className="field-preview-note">Prévia administrativa · somente leitura · atendimentos da equipe</p>}
    {message && <div className="field-message" role="status">{message}</div>}
    <div className="field-tabs" role="tablist" aria-label="Período da agenda">{([["today", "Hoje"], ["upcoming", "Próximos"], ["history", "Recentes"]] as const).map(([id, label]) => <button type="button" role="tab" aria-selected={mode === id} className={mode === id ? "active" : ""} key={id} onClick={() => setMode(id)}>{label}</button>)}</div>
    {loading ? <ContentSkeleton label="Carregando sua agenda" rows={3} /> : visible.length === 0 ? <p className="field-empty">Nenhum atendimento neste período.</p> : <div className="field-list">{visible.map(item => {
      const client = clients.find(value => value.id === item.clientId);
      const open = selectedId === item.id;
      const supplies = item.lines.flatMap(line => (serviceDetails[line.serviceId]?.consumables ?? []).map(supply => ({ ...supply, serviceName: line.name })));
      const approximateStart = !item.startedAt && item.status === "Em atendimento" ? item.updatedAt : "";
      const timerStart = item.startedAt ?? approximateStart;
      const estimated = Boolean(approximateStart || item.startedAtEstimated);
      const elapsed = timerStart && now ? clock((item.completedAt ? Date.parse(item.completedAt) : now) - Date.parse(timerStart)) : "";
      return <article className={`field-card ${open ? "open" : ""}`} key={item.id}>
        <button type="button" className="field-card-trigger" aria-expanded={open} onClick={() => { setSelectedId(item.id); setNotes(""); setConsent(false); }}>
          <span><small>{dateLabel(item.date)} · {item.time}</small><strong>{client?.name ?? "Cliente indisponível"}</strong><em>{item.lines.map(line => line.name).join(" + ")} · {totalMinutes(item)} min</em></span>
          <span className="field-trigger-status"><b>{item.status}</b>{item.status === "Em atendimento" && elapsed && <small aria-label={`Tempo ${estimated ? "aproximado" : "real"} de atendimento ${elapsed}`}>{estimated ? "≈ " : ""}{elapsed}</small>}</span>
        </button>
        {open && <div className="field-card-content">
          {item.status === "Em atendimento" && <div className="field-timer" role="timer"><span>{estimated ? "Tempo aproximado em andamento" : "Atendimento em andamento"}</span><strong>{elapsed || "Início não registrado"}</strong>{estimated ? <small>O início exato não foi registrado antes desta atualização.</small> : item.startedAt && <small>Iniciado às {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(item.startedAt))}</small>}</div>}
          <section className="field-plan"><h2>Serviço e valor</h2><div className="field-service-list">{item.lines.map((line, index) => <div key={`${line.serviceId}-${index}`}><strong>{line.name}</strong><span>{line.durationMinutes} min · {currency(line.price)}</span>{serviceDetails[line.serviceId]?.description && <p>{serviceDetails[line.serviceId].description}</p>}</div>)}</div><div className="field-amount"><span>Valor previsto para a cliente</span><strong>{currency(item.lines.reduce((sum, line) => sum + line.price, 0))}</strong></div>{item.paymentMethod && <p className="field-muted">Forma de pagamento prevista: {item.paymentMethod}</p>}</section>
          <section className="field-supplies"><h2>Itens para levar e usar</h2>{item.materials?.length || supplies.length ? <ul>{(item.materials ?? []).map((material, index) => <li key={`agenda-${index}`}>{material}<small>Informado na agenda</small></li>)}{supplies.map((supply, index) => <li key={`service-${index}`}>{supply.name}{supply.quantity && <span> · {supply.quantity}</span>}<small>{supply.serviceName}</small></li>)}</ul> : <p className="field-muted">Nenhum item informado para este atendimento.</p>}</section>
          <section className="field-location"><h2>Local e contato</h2><div className="field-info"><span>Local do atendimento</span><strong>{item.place === "Home" ? item.address ?? "Endereço não informado" : "NAVY Matriz"}</strong></div><div className="field-actions"><a href={`tel:${phone}`} aria-disabled={!phone} onClick={event => { if (!phone) event.preventDefault(); }}>Ligar</a>{route && <a href={route} target="_blank" rel="noopener noreferrer">Abrir rota</a>}</div></section>
          {item.note && <section className="field-note"><h2>Orientações da agenda</h2><p>{item.note}</p></section>}
          {detail ? <section className="field-client"><h2>Ficha da cliente</h2><p><strong>Observações clínicas:</strong> {detail.clinicalNote || "Nenhuma observação registrada."}</p><p><strong>Preferências:</strong> {detail.preferences || "Nenhuma preferência registrada."}</p>{history.length > 0 && <div className="field-history"><h3>Atendimentos anteriores</h3>{history.map(entry => <p key={entry.id}><strong>{entry.serviceName}</strong> · {historyLabel(entry.startedAt)}<br />{entry.notes || "Sem observações."}</p>)}</div>}</section> : <p className="field-muted">Carregando ficha da cliente...</p>}
          <section className="field-photos"><h2>Fotos da cliente</h2>{canUploadPhoto && <><label className="field-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Confirmo o consentimento da cliente para armazenar estas imagens.</label><input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /><input ref={galleryRef} type="file" accept="image/*" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /><div className="field-actions"><button type="button" onClick={() => cameraRef.current?.click()} disabled={busy || !consent}>Tirar foto</button><button type="button" onClick={() => galleryRef.current?.click()} disabled={busy || !consent}>Escolher imagem</button></div></>}{photos.length ? <div className="field-photo-grid">{photos.map(photo => <div key={photo.id}>{photo.url ? <img src={photo.url} alt={photo.name} /> : <span>Imagem indisponível</span>}<small>{photo.name}</small>{canUploadPhoto && photo.canRemove && <button type="button" onClick={() => void removePhoto(photo)} disabled={busy}>Remover</button>}</div>)}</div> : <p className="field-muted">Nenhuma foto registrada.</p>}</section>
          <section className="field-progress"><h2>Andamento do atendimento</h2>{adminPreview ? <p className="field-muted">Esta prévia é somente leitura. As ações aparecem no acesso da profissional.</p> : item.status === "Concluído" ? <p>Atendimento concluído{elapsed ? ` · duração ${estimated ? "aproximada" : "real"} ${elapsed}` : ""}.</p> : item.status === "Em atendimento" ? <><p>Confira os dados acima antes de finalizar.</p>{canChangeStatus && <button type="button" className="field-finish" onClick={() => completeAppointment(item)} disabled={busy}>Concluir atendimento</button>}</> : canChangeStatus ? <button type="button" onClick={() => startAppointment(item)} disabled={busy}>Iniciar atendimento</button> : null}</section>
          {item.status === "Concluído" && <section className="field-session"><h2>Registro da sessão</h2>{existingSession ? <p>Sessão registrada: {existingSession.notes || "Sem observações."}</p> : canSaveSession ? <><label htmlFor="field-notes">Observações da sessão</label><textarea id="field-notes" value={notes} onChange={event => setNotes(event.target.value)} rows={4} maxLength={2000} placeholder="Procedimento realizado, intercorrências e orientações..." /><button type="button" onClick={() => void saveSession()} disabled={busy || notes.trim().length < 3}>Registrar sessão</button></> : <p className="field-muted">O registro da sessão é feito pela profissional.</p>}</section>}
        </div>}
      </article>;
    })}</div>}
    {confirmEarlyId && <ContentDialog title="Iniciar antes do horário" onClose={() => setConfirmEarlyId("")}><div className="field-early-confirm"><p>O atendimento de <strong>{clients.find(client => client.id === appointments.find(item => item.id === confirmEarlyId)?.clientId)?.name ?? "esta cliente"}</strong> está agendado para <strong>{appointments.find(item => item.id === confirmEarlyId)?.time}</strong>.</p><p>Ao confirmar, você registra que a cliente pode começar antes do horário agendado. O horário real de início será salvo e o cronômetro começará agora.</p><div className="field-actions"><button type="button" onClick={() => setConfirmEarlyId("")} disabled={busy}>Voltar</button><button type="button" onClick={() => void changeStatus(confirmEarlyId, "Em atendimento", true)} disabled={busy}>Confirmar início antecipado</button></div></div></ContentDialog>}
    {confirmCompletionId && <ContentDialog title="Confirmar atendimento antecipado" onClose={() => setConfirmCompletionId("")}><div className="field-early-confirm"><p>Este atendimento está em andamento antes das <strong>{appointments.find(item => item.id === confirmCompletionId)?.time}</strong>, mas não há confirmação de início antecipado registrada.</p><p>Confirme que a cliente pôde começar antes do horário e que o atendimento já terminou. Para registros iniciados antes desta atualização, a duração será marcada como aproximada.</p><div className="field-actions"><button type="button" onClick={() => setConfirmCompletionId("")} disabled={busy}>Voltar</button><button type="button" onClick={() => void changeStatus(confirmCompletionId, "Concluído", true)} disabled={busy}>Confirmar e concluir</button></div></div></ContentDialog>}
  </div>;
}
