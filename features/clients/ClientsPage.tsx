"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ContentDialog from "@/components/ContentDialog";
import Link from "next/link";
import type { User } from "firebase/auth";
import { writeBatch, doc, runTransaction } from "firebase/firestore";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFirebaseClient } from "@/lib/firebase/client";
import { navyApi, NavyApiError } from "@/lib/firebase/navy-api";
import type { AppointmentDocument, ClientDocument, ClinicalSessionDocument } from "@/lib/firebase/documents";
import { createFirebaseRepositories } from "@/lib/firebase/repositories";
import { type ClientRecord, type ClientSession, type ClientSource, type PreferredContact } from "./client-data";
import { toClientDocument, toClientRecord, toSessionDocument } from "./client-firestore";
import { prepareImageUpload } from "./client-images";
import { appointmentDuration, appointmentPrice } from "@/features/agenda/agenda-data";
import { durationLabel } from "@/features/services/service-data";
import { formatBrazilPhone, validDateOnly, validateClient, validateSession, type ClientErrors, type ClientField, type ClientInput, type SessionErrors, type SessionField, type SessionInput } from "./client-validation";

type Filter = "Todas" | "VIP / Retorno" | "Instagram" | "Indicação";
type Tab = "timeline" | "anamnesis" | "gallery" | "preferences";
type Dialog = "create" | "edit" | "delete" | "session" | "maintenance" | "sessionEdit" | "sessionDelete" | "reminder" | "contact" | "clinical" | "preferences" | null;
type Photo = { id: string; name: string; url?: string };
type DriveStatus = { connected: boolean };

const filters: Filter[] = ["Todas", "VIP / Retorno", "Instagram", "Indicação"];
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const normalise = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const todayInput = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const dateTimeInput = (planned = false) => {
  const date = new Date();
  if (planned) { date.setDate(date.getDate() + 1); date.setHours(14, 0, 0, 0); }
  else date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const formatShortDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const formatBirthDate = (value: string) => value.split("-").reverse().join("/");
const nextPlannedDate = (sessions: ClientSession[]) => sessions.filter(session => session.payment === "Agendado" && session.date.slice(0, 10) >= todayInput()).map(session => session.date.slice(0, 10)).sort()[0] ?? "";

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size }}>{name}</span>;
}

function Avatar({ client, large = false }: { client: ClientRecord; large?: boolean }) {
  return client.avatar ? <img className={`nc-avatar ${large ? "nc-avatar-large" : ""}`} src={client.avatar} alt="" /> : <span className={`nc-avatar nc-avatar-initials ${large ? "nc-avatar-large" : ""}`}>{initials(client.name)}</span>;
}

const DialogFrame = ContentDialog;

function FieldError({ field, errors }: { field: ClientField; errors: ClientErrors }) {
  return errors[field] ? <span className="nc-field-error" id={`nc-error-${field}`}>{errors[field]}</span> : null;
}

function SessionForm({ client, planned, editing, appointment, saving, onSave, onClose }: { client: ClientRecord; planned: boolean; editing?: ClientSession; appointment?: AppointmentDocument; saving: boolean; onSave: (values: SessionInput, planned: boolean) => void; onClose: () => void }) {
  const [errors, setErrors] = useState<SessionErrors>({});
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateSession(new FormData(event.currentTarget), planned, client.sessions, editing?.id);
    setErrors(result.errors);
    const first = Object.keys(result.errors)[0] as SessionField | undefined;
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    onSave(result.input, planned);
  };
  const clearError = (field: string) => { if (field in errors) setErrors((current) => ({ ...current, [field]: undefined })); };
  const error = (field: SessionField) => errors[field] ? <span className="nc-field-error" id={`nc-session-error-${field}`}>{errors[field]}</span> : null;
  return <form className="nc-form" noValidate onSubmit={submit} onChange={(event) => clearError(event.target.getAttribute("name") ?? "")}>
    <p>{appointment ? "Esta sessão ficará vinculada ao agendamento concluído da Agenda." : "Esta ação salva a sessão na ficha da cliente no Firestore. Retornos planejados ficam na ficha; use “Agendar” para reservar um horário na Agenda."} <strong>* Campos obrigatórios; os demais são opcionais.</strong></p>
    {Object.values(errors).some(Boolean) && <div className="nc-validation-summary" role="alert">Revise os campos destacados antes de salvar.</div>}
    <label>Procedimento *<input name="service" required minLength={3} maxLength={100} defaultValue={editing?.service ?? (appointment ? appointment.lines.map(line => line.name).join(" + ").slice(0, 100) : planned ? client.sessions.find((session) => session.payment !== "Agendado")?.service ?? "" : "")} placeholder="Ex: Manutenção Volume Brasileiro" aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? "nc-session-error-service" : undefined} />{error("service")}</label>
    <div className="nc-form-row"><label>Data e horário *<input name="date" type="datetime-local" required defaultValue={editing?.date ?? (appointment ? `${appointment.date}T${appointment.time}` : dateTimeInput(planned))} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "nc-session-error-date" : undefined} />{error("date")}</label>{!planned && <label>Valor (R$) *<input name="amount" type="number" inputMode="decimal" min="0" max="999999" step="0.01" required defaultValue={editing?.amount ?? (appointment ? appointmentPrice(appointment) : 0)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "nc-session-error-amount" : undefined} />{error("amount")}</label>}</div>
    {!planned && <div className="nc-form-row"><label>Pagamento *<select name="payment" required defaultValue={editing?.payment ?? "Pendente"} aria-invalid={Boolean(errors.payment)} aria-describedby={errors.payment ? "nc-session-error-payment" : undefined}><option>Pendente</option><option>Pix</option><option>Cartão Crédito</option><option>Cartão Débito</option><option>Dinheiro</option>{editing?.payment === "Pago" && <option>Pago</option>}</select>{error("payment")}</label><label>Duração<input name="duration" maxLength={40} defaultValue={editing?.duration ?? (appointment ? durationLabel(appointmentDuration(appointment)) : "1h")} placeholder="Ex: 1h 30m" aria-invalid={Boolean(errors.duration)} aria-describedby={errors.duration ? "nc-session-error-duration" : undefined} />{error("duration")}</label></div>}
    <label>Observações<textarea name="note" rows={3} maxLength={500} defaultValue={editing?.note} placeholder="Detalhes do atendimento" aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "nc-session-error-note" : undefined} />{error("note")}</label>
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="nc-btn nc-btn-primary" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar sessão" : planned ? "Planejar retorno" : "Registrar sessão"}</button></div>
  </form>;
}

function NotesForm({ client, clinical, saving, onSave, onClose }: { client: ClientRecord; clinical: boolean; saving: boolean; onSave: (values: { clinicalNote?: string; preferences?: string; returnDate?: string }) => void; onClose: () => void }) {
  const [errors, setErrors] = useState<{ note?: string; preferences?: string; returnDate?: string }>({});
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const note = String(values.get("note") ?? "").trim();
    const preferences = String(values.get("preferences") ?? "").trim();
    const returnDate = String(values.get("returnDate") ?? "").trim();
    const next: typeof errors = {};
    if (clinical && !note) next.note = "Descreva as observações clínicas ou a ausência de sensibilidades.";
    else if (clinical && note.length > 1000) next.note = "Use até 1.000 caracteres.";
    if (!clinical && preferences.length > 1000) next.preferences = "Use até 1.000 caracteres.";
    if (!clinical && returnDate && !validDateOnly(returnDate)) next.returnDate = "Informe uma data válida.";
    else if (!clinical && returnDate && returnDate < todayInput()) next.returnDate = "Escolha hoje ou uma data futura para o próximo retorno.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    onSave(clinical ? { clinicalNote: note } : { preferences: preferences || "Nenhuma preferência registrada.", returnDate });
  };
  return <form className="nc-form" noValidate onSubmit={submit} onChange={(event) => { const field = event.target.getAttribute("name") ?? ""; if (field in errors) setErrors((current) => ({ ...current, [field]: undefined })); }}>
    <p>As alterações serão salvas no Firestore. {clinical ? <strong>* Campo obrigatório.</strong> : "Os campos são opcionais."}</p>
    {Object.values(errors).some(Boolean) && <div className="nc-validation-summary" role="alert">Revise os campos destacados antes de salvar.</div>}
    {clinical ? <label>Observações e sensibilidades *<textarea name="note" rows={6} required maxLength={1000} defaultValue={client.clinicalNote} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "nc-notes-error-note" : undefined} />{errors.note && <span className="nc-field-error" id="nc-notes-error-note">{errors.note}</span>}</label> : <><label>Preferências<textarea name="preferences" rows={5} maxLength={1000} defaultValue={client.preferences === "Nenhuma preferência registrada." ? "" : client.preferences} aria-invalid={Boolean(errors.preferences)} aria-describedby={errors.preferences ? "nc-notes-error-preferences" : undefined} />{errors.preferences && <span className="nc-field-error" id="nc-notes-error-preferences">{errors.preferences}</span>}</label><label>Próximo retorno<input type="date" name="returnDate" min={todayInput()} defaultValue={client.returnDate} aria-invalid={Boolean(errors.returnDate)} aria-describedby={errors.returnDate ? "nc-notes-error-returnDate" : undefined} />{errors.returnDate && <span className="nc-field-error" id="nc-notes-error-returnDate">{errors.returnDate}</span>}</label></>}
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="nc-btn nc-btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar ficha"}</button></div>
  </form>;
}

function ClientForm({ client, clients, saving, photoSaving, canDelete, driveConnected, driveLoading, avatarUrl, onSave, onClose, onDelete, onAvatarUpload, onAvatarRemove }: { client?: ClientRecord; clients: ClientRecord[]; saving: boolean; photoSaving: boolean; canDelete: boolean; driveConnected: boolean; driveLoading: boolean; avatarUrl: string; onSave: (values: ClientInput) => void; onClose: () => void; onDelete: () => void; onAvatarUpload: (file: File) => Promise<void>; onAvatarRemove: () => Promise<void> }) {
  const [errors, setErrors] = useState<ClientErrors>({});
  const [source, setSource] = useState<ClientSource>(client?.source ?? "Não informado");
  const [preferredContact, setPreferredContact] = useState(client?.preferredContact ?? "");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const result = validateClient(new FormData(event.currentTarget), clients, client?.id);
    setErrors(result.errors);
    const first = Object.keys(result.errors)[0] as ClientField | undefined;
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    onSave(result.input);
  };
  const clearError = (field: string) => {
    if (field in errors) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  return <form className="nc-form" noValidate onSubmit={submit} onChange={(event) => clearError(event.target.getAttribute("name") ?? "")}>
    <p>Os dados do cadastro serão salvos no Firestore. <strong>* Campos obrigatórios; os demais são opcionais.</strong></p>
    {Object.values(errors).some(Boolean) && <div className="nc-validation-summary" role="alert">Revise os campos destacados antes de salvar.</div>}
    <div className="nc-photo-field"><span className="nc-photo-preview">{avatarUrl ? <img src={avatarUrl} alt="Foto de perfil da cliente" /> : <Icon name="person" size={27} />}</span><div><strong>Foto de perfil</strong><span>{client ? driveLoading ? "Verificando conexão com o Google Drive..." : driveConnected ? "Imagem privada guardada no Google Drive." : "Integração de fotos indisponível. Consulte Configurações → Integrações." : "Salve o cadastro antes de adicionar a foto."}</span>{client && <div className="nc-photo-actions"><button type="button" className="nc-btn nc-btn-soft" disabled={!driveConnected || photoSaving || saving} onClick={() => avatarInputRef.current?.click()}><Icon name="photo_camera" size={16} /> {photoSaving ? "Processando..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}</button>{client.avatarDriveFileId && <button type="button" className="nc-btn nc-btn-quiet" disabled={!driveConnected || photoSaving || saving} onClick={() => void onAvatarRemove()}>Remover</button>}<input ref={avatarInputRef} className="nc-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAvatarUpload(file); event.target.value = ""; }} /></div>}</div></div>
    <label>Nome completo *<input name="name" required minLength={2} maxLength={100} autoComplete="name" defaultValue={client?.name} placeholder="Ex: Beatriz Vasconcellos" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "nc-error-name" : undefined} /><FieldError field="name" errors={errors} /></label>
    <div className="nc-form-row">
      <label>WhatsApp / Telefone *<input name="phone" type="tel" inputMode="tel" required maxLength={22} autoComplete="tel" defaultValue={client?.phone} placeholder="(11) 90000-0000" onBlur={(event) => { const formatted = formatBrazilPhone(event.currentTarget.value); if (formatted) event.currentTarget.value = formatted; }} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "nc-error-phone" : undefined} /><FieldError field="phone" errors={errors} /></label>
      <label>E-mail {preferredContact === "E-mail" && "*"}<input name="email" type="email" maxLength={254} required={preferredContact === "E-mail"} autoComplete="email" defaultValue={client?.email} placeholder="cliente@email.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "nc-error-email" : undefined} /><FieldError field="email" errors={errors} /></label>
    </div>
    <div className="nc-form-row"><label>Data de nascimento<input name="birthDate" type="date" max={todayInput()} defaultValue={client?.birthDate} aria-invalid={Boolean(errors.birthDate)} aria-describedby={errors.birthDate ? "nc-error-birthDate" : undefined} /><FieldError field="birthDate" errors={errors} /></label><label>Cidade / UF<input name="city" maxLength={80} autoComplete="address-level2" defaultValue={client?.city} placeholder="Ex: São Paulo, SP" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "nc-error-city" : undefined} /><FieldError field="city" errors={errors} /></label></div>
    <div className="nc-form-row"><label>Instagram (@) {preferredContact === "Instagram" && "*"}<input name="instagram" maxLength={31} required={preferredContact === "Instagram"} defaultValue={client?.instagram} placeholder="@cliente" aria-invalid={Boolean(errors.instagram)} aria-describedby={errors.instagram ? "nc-error-instagram" : undefined} /><FieldError field="instagram" errors={errors} /></label><label>Contato preferido<select name="preferredContact" value={preferredContact} onChange={(event) => setPreferredContact(event.target.value as PreferredContact | "")} aria-invalid={Boolean(errors.preferredContact)} aria-describedby={errors.preferredContact ? "nc-error-preferredContact" : undefined}><option value="">Não informado</option><option>WhatsApp</option><option>Telefone</option><option>Instagram</option><option>E-mail</option></select><FieldError field="preferredContact" errors={errors} /></label></div>
    <div className="nc-form-row"><label>Canal de origem<select name="source" value={source} onChange={(event) => setSource(event.target.value as ClientSource)} aria-invalid={Boolean(errors.source)} aria-describedby={errors.source ? "nc-error-source" : undefined}><option>Não informado</option><option>Instagram</option><option>WhatsApp</option><option>Indicação</option><option>Outros</option></select><FieldError field="source" errors={errors} /></label><label>Detalhe da origem {source === "Indicação" && "*"}<input name="sourceDetail" maxLength={120} required={source === "Indicação"} defaultValue={client?.sourceDetail === "Não informado" ? "" : client?.sourceDetail} placeholder="Ex: indicação da Dra. Lúcia" aria-invalid={Boolean(errors.sourceDetail)} aria-describedby={errors.sourceDetail ? "nc-error-sourceDetail" : undefined} /><FieldError field="sourceDetail" errors={errors} /></label></div>
    <label className="nc-form-checkbox"><input type="checkbox" name="vip" defaultChecked={client?.vip} /> Cliente VIP</label>
    {client && canDelete && <button type="button" className="nc-delete-link" onClick={onDelete} disabled={saving}>Excluir cadastro</button>}
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving} className="nc-btn nc-btn-primary">{saving ? "Salvando..." : client ? "Salvar alterações" : "Salvar e iniciar ficha"}</button></div>
  </form>;
}

function ClientListItem({ client, selected, user, driveConnected, onSelect }: { client: ClientRecord; selected: boolean; user: User | null; driveConnected: boolean; onSelect: () => void }) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [avatar, setAvatar] = useState("");
  useEffect(() => {
    if (!user || !driveConnected || !client.avatarDriveFileId || !itemRef.current) { setAvatar(""); return; }
    setAvatar("");
    let active = true;
    let url = "";
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      navyApi(user, `/api/clients/${client.id}/images/avatar`).then(response => response.blob()).then(blob => {
        url = URL.createObjectURL(blob);
        if (active) setAvatar(url);
        else URL.revokeObjectURL(url);
      }).catch(() => { if (active) setAvatar(""); });
    }, { rootMargin: "200px" });
    observer.observe(itemRef.current);
    return () => { active = false; observer.disconnect(); if (url) URL.revokeObjectURL(url); };
  }, [client.id, client.avatarDriveFileId, driveConnected, user]);
  return <button ref={itemRef} type="button" className={`nc-client-item ${selected ? "nc-client-item-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
    <span className={`nc-client-stripe nc-tone-${client.statusTone}`} /><Avatar client={{ ...client, avatar }} />
    <span className="nc-client-summary"><span className="nc-client-name">{client.name}{client.vip && <em>VIP</em>}{client.badge && <small>{client.badge}</small>}</span><span>{client.instagram ? `${client.instagram} • ` : ""}{client.phone}</span><small>Origem: {client.sourceDetail}{client.visits ? ` • ${client.visits}º atendimento` : ""}</small></span>
    <span className={`nc-client-status nc-status-${client.statusTone}`}>{client.status}</span>
  </button>;
}

function ClientAgendaSection({ appointments, sessions }: { appointments: AppointmentDocument[]; sessions: ClientSession[] }) {
  return <section className="nc-agenda-section">
    <div className="nc-agenda-heading"><div><h3>Agendamentos na Agenda</h3><p>{appointments.length ? `${appointments.length} compromisso${appointments.length === 1 ? "" : "s"} vinculado${appointments.length === 1 ? "" : "s"} a esta cliente.` : "Nenhum agendamento vinculado a esta cliente."}</p></div></div>
    {appointments.map(item => <div className="nc-agenda-appointment" key={item.id}><span><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")} às {item.time}</strong><small>{item.lines.map(line => line.name).join(" + ")} · {item.status}{sessions.some(session => session.appointmentId === item.id) ? " · Sessão registrada" : ""}</small></span><Link href={`/agenda?appointmentId=${encodeURIComponent(item.id)}`}>Ver na Agenda</Link></div>)}
  </section>;
}

export default function ClientsPage() {
  const { profile, user } = useAuth();
  const repositories = useMemo(() => profile ? createFirebaseRepositories(getFirebaseClient().db, profile.clinicId) : null, [profile]);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [sessionDocuments, setSessionDocuments] = useState<ClinicalSessionDocument[]>([]);
  const [appointmentDocuments, setAppointmentDocuments] = useState<AppointmentDocument[]>([]);
  const [loaded, setLoaded] = useState({ clients: false, sessions: false, appointments: false });
  const [dataError, setDataError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Todas");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("timeline");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingSessionId, setEditingSessionId] = useState("");
  const [linkedAppointmentId, setLinkedAppointmentId] = useState("");
  const [highlightSessionId, setHighlightSessionId] = useState("");
  const openedSessionLink = useRef(false);
  const focusedSessionLink = useRef(false);
  const [toast, setToast] = useState("");
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [photoLoadState, setPhotoLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [photoLoadWarning, setPhotoLoadWarning] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState("");
  const photoUrls = useRef(new Set<string>());
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const requestedClient = new URLSearchParams(window.location.search).get("clientId");
    if (requestedClient) setSelectedId(requestedClient);
    const requestedSession = new URLSearchParams(window.location.search).get("sessionId");
    if (requestedSession) setHighlightSessionId(requestedSession);
    return () => { photoUrls.current.forEach(URL.revokeObjectURL); photoUrls.current.clear(); };
  }, []);

  useEffect(() => {
    if (openedSessionLink.current || !loaded.clients || !loaded.sessions || !loaded.appointments) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("newSession") !== "1") return;
    openedSessionLink.current = true;
    const appointmentId = params.get("appointmentId") ?? "";
    const appointment = appointmentDocuments.find(item => item.id === appointmentId && item.clientId === params.get("clientId"));
    if (!appointment || appointment.status !== "Concluído") { setToast("Conclua o agendamento na Agenda antes de registrar a sessão."); return; }
    if (sessionDocuments.some(item => item.appointmentId === appointmentId)) { setToast("Esta sessão já está registrada na ficha."); return; }
    setSelectedId(appointment.clientId);
    setTab("timeline");
    setLinkedAppointmentId(appointment.id);
    setDialog("session");
  }, [loaded, appointmentDocuments, sessionDocuments]);

  useEffect(() => {
    if (focusedSessionLink.current || !highlightSessionId || !loaded.clients || !loaded.sessions) return;
    const session = sessionDocuments.find(item => item.id === highlightSessionId);
    if (!session) return;
    focusedSessionLink.current = true;
    setSelectedId(session.clientId);
    setFilter("Todas");
    setQuery("");
    setTab("timeline");
    const timeout = window.setTimeout(() => document.getElementById(`nc-session-${highlightSessionId}`)?.scrollIntoView({ block: "center" }), 0);
    return () => window.clearTimeout(timeout);
  }, [highlightSessionId, loaded.clients, loaded.sessions, sessionDocuments]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setDrive(null);
    navyApi(user, "/api/drive/status").then(response => response.json()).then((status: DriveStatus) => { if (active) setDrive(status); }).catch(() => { if (active) setDrive({ connected: false }); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!repositories) return;
    setLoaded({ clients: false, sessions: false, appointments: false });
    setDataError("");
    setLoadError(false);
    const onError = () => { setLoadError(true); setDataError("Não foi possível carregar os dados do Firestore. Confira a conexão e tente recarregar a página."); };
    const stopClients = repositories.clients.subscribe(items => { setClientDocuments(items); setLoaded(current => ({ ...current, clients: true })); }, onError);
    const stopSessions = repositories.sessions.subscribe(items => { setSessionDocuments(items); setLoaded(current => ({ ...current, sessions: true })); }, onError);
    const stopAppointments = repositories.appointments.subscribe(items => { setAppointmentDocuments(items); setLoaded(current => ({ ...current, appointments: true })); }, onError);
    return () => { stopClients(); stopSessions(); stopAppointments(); };
  }, [repositories]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(""), 4200); return () => window.clearTimeout(timeout); }, [toast]);

  const clients = useMemo(() => clientDocuments.map(item => toClientRecord(item, sessionDocuments)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [clientDocuments, sessionDocuments]);
  const counts = useMemo(() => ({ "Todas": clients.length, "VIP / Retorno": clients.filter((client) => client.vip || client.returnDate).length, "Instagram": clients.filter((client) => client.source === "Instagram").length, "Indicação": clients.filter((client) => client.source === "Indicação").length }), [clients]);
  const filtered = useMemo(() => clients.filter((client) => {
    const term = normalise(query.trim());
    const matchesQuery = !term || normalise(`${client.name} ${client.phone} ${client.email ?? ""} ${client.instagram}`).includes(term);
    const matchesFilter = filter === "Todas" || filter === "VIP / Retorno" && (client.vip || Boolean(client.returnDate)) || client.source === filter;
    return matchesQuery && matchesFilter;
  }), [clients, query, filter]);
  const selected = filtered.find((client) => client.id === selectedId) ?? filtered[0] ?? null;
  const paidVisits = selected?.sessions.filter(session => session.payment !== "Agendado" && session.payment !== "Pendente").length ?? 0;
  const selectedAppointments = appointmentDocuments.filter(item => item.clientId === selected?.id).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const linkedAppointment = appointmentDocuments.find(item => item.id === linkedAppointmentId && item.clientId === selected?.id);
  const editingSession = selected?.sessions.find(session => session.id === editingSessionId);
  const canDeleteSessions = profile?.role === "master_admin" || profile?.role === "admin";
  useEffect(() => {
    if (!user || !selected?.avatarDriveFileId || !drive?.connected) { setAvatarUrl(""); return; }
    let active = true;
    let url = "";
    navyApi(user, `/api/clients/${selected.id}/images/avatar`).then(response => response.blob()).then(blob => {
      url = URL.createObjectURL(blob);
      if (active) setAvatarUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setAvatarUrl(""); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); setAvatarUrl(""); };
  }, [user, selected?.id, selected?.avatarDriveFileId, drive?.connected]);

  useEffect(() => {
    if (!user || !selected?.id || !drive?.connected || tab !== "gallery") return;
    let active = true;
    const clientId = selected.id;
    setPhotoLoadState("loading");
    setPhotoLoadWarning("");
    (async () => {
      try {
        const response = await navyApi(user, `/api/clients/${clientId}/photos`);
        const data = await response.json() as { photos: { id: string; name: string }[] };
        const loaded = await Promise.all(data.photos.map(async photo => {
          try {
            const image = await navyApi(user, `/api/clients/${clientId}/images/${photo.id}`);
            const url = URL.createObjectURL(await image.blob());
            photoUrls.current.add(url);
            return { ...photo, url };
          } catch { return { ...photo, url: "" }; }
        }));
        if (!active) { loaded.forEach(photo => { if (photo.url) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); } }); return; }
        setPhotos(current => { (current[clientId] ?? []).forEach(photo => { if (photo.url) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); } }); return { ...current, [clientId]: loaded }; });
        if (loaded.some(photo => !photo.url)) setPhotoLoadWarning("Algumas imagens não puderam ser abertas. Você ainda pode remover seus registros.");
        setPhotoLoadState("ready");
      } catch {
        if (active) { setPhotoLoadState("error"); setPhotoLoadWarning("Não foi possível carregar a galeria do Drive."); }
      }
    })();
    return () => { active = false; };
  }, [user, selected?.id, drive?.connected, tab, photoRevision]);
  const runSave = async (action: () => Promise<void>, success: string) => {
    if (saving) return;
    setSaving(true); setDataError("");
    try { await action(); setDialog(null); setLinkedAppointmentId(""); setToast(success); }
    catch (error) { const message = error instanceof NavyApiError ? error.message : "Não foi possível concluir a operação. Tente novamente."; setDataError(message); setToast(message); }
    finally { setSaving(false); }
  };
  const saveClient = (input: ClientInput) => runSave(async () => {
    if (!repositories) throw new Error("Firestore indisponível");
    if (dialog === "edit" && selected) {
      await repositories.clients.update(selected.id, { ...input, preferredContact: input.preferredContact ?? null, updatedAt: new Date().toISOString() });
    } else {
      const id = crypto.randomUUID();
      await repositories.clients.save(toClientDocument(id, input));
      setFilter("Todas"); setQuery(""); setSelectedId(id); setTab("timeline");
    }
  }, dialog === "edit" ? "Cadastro atualizado no Firestore." : "Cliente cadastrada no Firestore.");
  const saveSession = (values: SessionInput, planned: boolean) => runSave(async () => {
    if (!repositories || !selected) throw new Error("Cliente indisponível");
    const session = toSessionDocument(selected.id, values);
    const { id: _id, clientId: _clientId, createdAt: _createdAt, ...changes } = session;
    if (!planned && dialog === "session" && linkedAppointment) {
      if (!profile) throw new NavyApiError("Unidade indisponível.");
      const db = getFirebaseClient().db;
      const appointmentRef = doc(db, "clinics", profile.clinicId, "appointments", linkedAppointment.id);
      const sessionRef = doc(db, "clinics", profile.clinicId, "sessions", linkedAppointment.id);
      await runTransaction(db, async transaction => {
        const appointmentSnapshot = await transaction.get(appointmentRef);
        const sessionSnapshot = await transaction.get(sessionRef);
        const appointment = appointmentSnapshot.data() as AppointmentDocument | undefined;
        if (!appointment || appointment.clientId !== selected.id || appointment.status !== "Concluído") throw new NavyApiError("O agendamento precisa estar concluído e vinculado a esta cliente.");
        if (sessionSnapshot.exists()) throw new NavyApiError("Esta sessão já foi registrada. Abra a ficha para editá-la.");
        const { id: _generatedId, ...data } = session;
        transaction.set(sessionRef, { ...data, appointmentId: linkedAppointment.id, ...(appointment.bookingKind === "catalog" && appointment.lines.length === 1 ? { serviceId: appointment.lines[0].serviceId } : {}) });
      });
      setTab("timeline");
      return;
    }
    if (dialog === "sessionEdit" && editingSession) {
      if (planned) {
        if (!profile) throw new Error("Unidade indisponível");
        const db = getFirebaseClient().db;
        const batch = writeBatch(db);
        batch.update(doc(db, "clinics", profile.clinicId, "sessions", editingSession.id), changes);
        if (!selected.returnDate || selected.returnDate === editingSession.date.slice(0, 10)) {
          const sessions = selected.sessions.map(item => item.id === editingSession.id ? { ...item, ...values } : item);
          batch.update(doc(db, "clinics", profile.clinicId, "clients", selected.id), { returnDate: nextPlannedDate(sessions), updatedAt: new Date().toISOString() });
        }
        await batch.commit();
      } else await repositories.sessions.update(editingSession.id, changes);
      setEditingSessionId("");
      return;
    }
    if (planned) {
      if (!profile) throw new Error("Unidade indisponível");
      const db = getFirebaseClient().db;
      const batch = writeBatch(db);
      const { id, ...sessionData } = session;
      batch.set(doc(db, "clinics", profile.clinicId, "sessions", id), sessionData);
      batch.update(doc(db, "clinics", profile.clinicId, "clients", selected.id), { returnDate: nextPlannedDate([...selected.sessions, { id, ...values }]), updatedAt: new Date().toISOString() });
      await batch.commit();
    } else await repositories.sessions.save(session);
    setTab("timeline");
  }, dialog === "sessionEdit" ? "Sessão atualizada no Firestore." : planned ? "Retorno salvo na ficha." : "Sessão registrada no Firestore.");
  const deleteSession = () => runSave(async () => {
    if (!repositories || !profile || !selected || !editingSession || !canDeleteSessions) throw new Error("Sessão indisponível");
    if (editingSession.payment === "Agendado" && selected.returnDate === editingSession.date.slice(0, 10)) {
      const db = getFirebaseClient().db;
      const batch = writeBatch(db);
      batch.delete(doc(db, "clinics", profile.clinicId, "sessions", editingSession.id));
      batch.update(doc(db, "clinics", profile.clinicId, "clients", selected.id), { returnDate: nextPlannedDate(selected.sessions.filter(item => item.id !== editingSession.id)), updatedAt: new Date().toISOString() });
      await batch.commit();
    } else await repositories.sessions.remove(editingSession.id);
    setEditingSessionId("");
  }, "Sessão excluída do Firestore.");
  const saveNotes = (values: { clinicalNote?: string; preferences?: string; returnDate?: string }) => runSave(async () => {
    if (!repositories || !selected) throw new Error("Cliente indisponível");
    await repositories.clients.update(selected.id, { ...values, updatedAt: new Date().toISOString() });
  }, "Ficha atualizada no Firestore.");
  const deleteClient = () => runSave(async () => {
    if (!user || !selected) throw new Error("Cliente indisponível");
    await navyApi(user, `/api/clients/${selected.id}`, { method: "DELETE" });
    setSelectedId(""); setTab("timeline");
  }, "Cadastro e registros vinculados excluídos do Firestore.");

  const uploadAvatar = async (file: File) => {
    if (!user || !selected || !drive?.connected || photoSaving) return;
    setPhotoSaving(true);
    try {
      const prepared = await prepareImageUpload(file, "avatar");
      const form = new FormData(); form.set("file", prepared);
      await navyApi(user, `/api/clients/${selected.id}/avatar`, { method: "POST", body: form });
      setToast("Foto de perfil salva no Google Drive.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível enviar a foto."); }
    finally { setPhotoSaving(false); }
  };

  const removeAvatar = async () => {
    if (!user || !selected || photoSaving) return;
    setPhotoSaving(true);
    try {
      await navyApi(user, `/api/clients/${selected.id}/avatar`, { method: "DELETE" });
      setAvatarUrl(""); setToast("Foto de perfil removida do Google Drive.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível remover a foto."); }
    finally { setPhotoSaving(false); }
  };
  const exportCsv = () => {
    const rows = [["Nome", "Telefone", "E-mail", "Nascimento", "Cidade/UF", "Instagram", "Origem", "Detalhe da origem", "Contato preferido", "VIP", "Atendimentos", "Total recebido"], ...filtered.map((client) => [client.name, client.phone, client.email ?? "", client.birthDate ?? "", client.city, client.instagram, client.source, client.sourceDetail, client.preferredContact ?? "", client.vip ? "Sim" : "Não", String(client.visits), client.lifetimeValue.toFixed(2)])];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${/^[=+@\-\t\r]/.test(value) ? "'" : ""}${value.replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "navy-clientes.csv"; link.click(); URL.revokeObjectURL(url);
    setToast(`${filtered.length} cliente(s) exportada(s).`);
  };
  const copyMessage = async (text: string) => { if (!text.trim()) { setToast("Digite uma mensagem antes de copiar."); return; } try { await navigator.clipboard.writeText(text.trim()); setDialog(null); setToast("Mensagem copiada. Nenhum envio foi feito."); } catch { setToast("Não foi possível copiar automaticamente neste navegador."); } };
  const addPhotos = async (files: FileList | null) => {
    if (!user || !selected || !files || !photoConsent || !drive?.connected || photoSaving) return;
    setPhotoSaving(true);
    let uploaded = 0;
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const prepared = await prepareImageUpload(file, "gallery");
        const form = new FormData(); form.set("file", prepared); form.set("consentConfirmed", "true");
        await navyApi(user, `/api/clients/${selected.id}/photos`, { method: "POST", body: form });
        uploaded++;
      }
      setToast(`${uploaded} foto(s) salva(s) no Google Drive.`);
    } catch (error) { setToast(`${uploaded} foto(s) enviada(s). ${error instanceof Error ? error.message : "Falha no envio."}`); }
    finally { setPhotoSaving(false); setPhotoRevision(current => current + 1); }
  };

  const removePhoto = async (photo: Photo) => {
    if (!user || !selected || photoSaving) return;
    setPhotoSaving(true);
    try {
      await navyApi(user, `/api/clients/${selected.id}/photos/${photo.id}`, { method: "DELETE" });
      if (photo.url) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); }
      const remaining = (photos[selected.id] ?? []).filter(item => item.id !== photo.id);
      setPhotos(current => ({ ...current, [selected.id]: (current[selected.id] ?? []).filter(item => item.id !== photo.id) }));
      if (!remaining.some(item => !item.url)) setPhotoLoadWarning("");
      setToast("Registro da foto removido.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível remover a foto."); }
    finally { setPhotoSaving(false); }
  };

  return <div className="nc-page">
    <div className="nc-page-head"><div><div className="nc-eyebrow">ATENDIMENTOS <span>•</span> <em>Gestão Relacional</em></div><h1>Base de Clientes &amp; Relacionamento</h1><div className="nc-head-stats"><span><i />{clients.length} clientes cadastradas</span><span>•</span><span>{clients.filter((client) => client.visits > 0).length} com atendimentos</span><span>•</span><span>{clients.filter((client) => client.returnDate).length} próximas de retorno / manutenção</span></div></div><div className="nc-head-actions"><button type="button" className="nc-btn nc-btn-soft" onClick={exportCsv} disabled={!loaded.clients || !loaded.sessions || loadError}><Icon name="file_download" size={16} />Exportar</button><button type="button" className="nc-btn nc-btn-add" onClick={() => setDialog("create")} disabled={!loaded.clients || !loaded.sessions || loadError}><Icon name="person_add" size={18} />+ Nova Cliente</button></div></div>

    {dataError && <div className="nc-validation-summary" role="alert">{dataError}</div>}

    <div className="nc-columns"><div className="nc-left"><div className="nc-search-card"><label className="nc-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, telefone, e-mail ou @instagram..." aria-label="Buscar clientes" /></label><div className="nc-filters" role="group" aria-label="Filtrar clientes">{filters.map((item) => <button type="button" key={item} className={filter === item ? "nc-filter-active" : ""} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item} ({counts[item]})</button>)}</div></div><div className="nc-client-list">{loadError && (!loaded.clients || !loaded.sessions) ? <div className="nc-empty">Não foi possível carregar as clientes.</div> : !loaded.clients || !loaded.sessions ? <div className="nc-empty" role="status">Carregando clientes do Firestore...</div> : filtered.length ? filtered.map((client) => <ClientListItem key={client.id} client={client} selected={selected?.id === client.id} user={user} driveConnected={Boolean(drive?.connected)} onSelect={() => { setSelectedId(client.id); setTab("timeline"); setPhotoConsent(false); }} />) : <div className="nc-empty">{clients.length ? "Nenhuma cliente encontrada. Ajuste a busca ou o filtro." : "Nenhuma cliente cadastrada. Use “+ Nova Cliente” para começar."}</div>}</div></div>

    <div className="nc-right">{selected ? <div className="nc-dossier" key={selected.id}>
      <div className="nc-profile-top"><div className="nc-profile-identity"><div className="nc-profile-avatar"><Avatar client={{ ...selected, avatar: avatarUrl }} large /><span><Icon name="check" size={12} /></span></div><div><div className="nc-profile-title"><h2>{selected.name}</h2>{selected.vip && <span><Icon name="auto_awesome" size={13} /> Lash Fidelity VIP</span>}</div><p>{selected.city ? `${selected.city} • ` : ""}Cadastrada em {selected.joined}</p><small><Icon name="call" size={13} /> {selected.phone}{selected.instagram && <> <b>•</b> {selected.instagram}</>}</small>{(selected.email || selected.birthDate || selected.preferredContact) && <small className="nc-profile-extra">{selected.email && <><Icon name="mail" size={13} /> {selected.email}</>}{selected.birthDate && <><b>•</b> Nasc. {formatBirthDate(selected.birthDate)}</>}{selected.preferredContact && <><b>•</b> Prefere {selected.preferredContact}</>}</small>}</div></div><div className="nc-profile-actions"><button type="button" className="nc-btn nc-btn-primary" onClick={() => window.location.assign(`/agenda?new=1&clientId=${encodeURIComponent(selected.id)}`)}><Icon name="event_available" size={17} /> Agendar</button><button type="button" className="nc-btn nc-btn-whatsapp" onClick={() => setDialog("contact")}><Icon name="chat" size={17} /> WhatsApp</button><button type="button" className="nc-btn nc-btn-icon" onClick={() => setDialog("edit")} title="Editar cadastro" aria-label="Editar cadastro"><Icon name="edit_note" size={20} /></button></div></div>
      <div className="nc-metrics"><div><small>TOTAL RECEBIDO</small><strong>{money(selected.lifetimeValue)}</strong><span className="nc-metric-green"><Icon name="trending_up" size={13} /> {selected.visits} procedimentos registrados</span></div><div><small>TICKET MÉDIO RECEBIDO</small><strong>{money(paidVisits ? selected.lifetimeValue / paidVisits : 0)}</strong><span>{paidVisits} {paidVisits === 1 ? "sessão paga" : "sessões pagas"}</span></div><div><small>FREQUÊNCIA MÉDIA</small><strong className="nc-metric-blue">{selected.frequencyDays ? `A cada ${selected.frequencyDays} dias` : "A definir"}</strong><span>{selected.frequencyDays ? "Alta assiduidade" : "Após novos atendimentos"}</span></div></div>
      <div className="nc-tabs" role="tablist" aria-label="Seções da cliente">{([["timeline", "history", "Linha do Tempo & Atendimentos"], ["anamnesis", "medical_information", "Ficha Anamnese & Sensibilidades"], ["gallery", "photo_library", "Galeria Antes/Depois (Consentida)"], ["preferences", "tune", "Manutenções & Preferências"]] as const).map(([id, icon, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "nc-tab-active" : ""} onClick={() => setTab(id)}><Icon name={icon} size={17} />{label}</button>)}</div>
      {tab === "timeline" && <div className="nc-tab-content">
        <div className="nc-clinical-alert"><Icon name="info" size={21} /><div><strong>Alerta de Prontuário &amp; Mapeamento</strong><p>{selected.clinicalNote}</p></div></div>
        <div className="nc-return-banner"><span className="nc-return-icon"><Icon name="calendar_clock" size={21} /></span><div><small>AÇÃO PREVENTIVA SUGERIDA</small><strong>{selected.returnDate ? `Janela ideal de Retorno: ${formatShortDate(selected.returnDate)}` : "Planeje a próxima manutenção"}</strong><p>Organize o próximo contato e acompanhe as preferências da cliente.</p></div><div className="nc-return-actions"><button type="button" className="nc-btn nc-btn-primary" onClick={() => setDialog("maintenance")}>Planejar retorno na ficha</button><button type="button" className="nc-btn nc-btn-white" onClick={() => setDialog("reminder")}>Gerar Lembrete</button></div></div>
        <ClientAgendaSection appointments={selectedAppointments} sessions={selected.sessions} />
        <div className="nc-history-title"><h3>Histórico Clínico Detalhado <span>{selected.sessions.length} {selected.sessions.length === 1 ? "sessão" : "sessões"}</span></h3><button type="button" onClick={() => { setLinkedAppointmentId(""); setDialog("session"); }}>+ Registrar Nova Sessão</button></div>
        <div className="nc-timeline">{selected.sessions.length ? selected.sessions.map((session) => <div id={`nc-session-${session.id}`} className={`nc-timeline-item ${session.id === highlightSessionId ? "nc-session-highlight" : ""}`} key={session.id}>
          <span className="nc-timeline-node" />
          <div className="nc-session"><div><small>{formatDate(session.date)}</small><h4>{session.service}</h4></div>
            <span className={session.payment === "Agendado" ? "nc-session-planned" : session.payment === "Pendente" ? "nc-session-pending" : "nc-session-paid"}>{session.payment === "Agendado" ? "Retorno planejado" : session.payment === "Pendente" ? `Pagamento pendente • ${money(session.amount)}` : `Concluído • ${money(session.amount)} (${session.payment})`}</span>
            <p>{session.note || "Sem observações adicionais."}</p>
            <footer><Icon name="timer" size={14} /> Duração: {session.duration}</footer>
            <div className="nc-session-actions">{session.appointmentId && <Link href={`/agenda?appointmentId=${encodeURIComponent(session.appointmentId)}`}>Ver agendamento</Link>}{session.serviceId && <Link href={`/servicos?serviceId=${encodeURIComponent(session.serviceId)}`}>Ver serviço</Link>}<button type="button" onClick={() => { setEditingSessionId(session.id); setDialog("sessionEdit"); }}>Editar sessão</button>{canDeleteSessions && <button type="button" onClick={() => { setEditingSessionId(session.id); setDialog("sessionDelete"); }}>Excluir</button>}</div>
          </div>
        </div>) : <div className="nc-empty">Nenhuma sessão registrada. Use “Registrar Nova Sessão” para começar.</div>}</div>
      </div>}
      {tab === "anamnesis" && <div className="nc-tab-content nc-secondary-tab"><div><Icon name="medical_information" size={25} /><h3>Ficha Anamnese &amp; Sensibilidades</h3><p>Notas clínicas registradas para {selected.name}.</p></div><div className="nc-info-card"><small>ALERTA DE PRONTUÁRIO &amp; MAPEAMENTO</small><p>{selected.clinicalNote}</p></div><button type="button" className="nc-btn nc-btn-primary" onClick={() => setDialog("clinical")}>Editar observações clínicas</button></div>}
      {tab === "gallery" && <div className="nc-tab-content nc-secondary-tab">
        <div><Icon name="photo_library" size={25} /><h3>Galeria Antes/Depois</h3><p>{drive?.connected ? "Imagens privadas guardadas no Google Drive e vinculadas a esta cliente." : "A integração de fotos é administrada em Configurações → Integrações."}</p></div>
        <label className="nc-consent"><input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} /> Confirmo que existe consentimento da cliente para incluir estas imagens.</label>
        <button type="button" className="nc-btn nc-btn-primary nc-upload" disabled={!photoConsent || !drive?.connected || photoSaving} onClick={() => photoInputRef.current?.click()}>{photoSaving ? "Processando..." : "Adicionar fotos"}</button>
        <input ref={photoInputRef} className="nc-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos(event.target.files); event.target.value = ""; }} />
        {drive?.connected && photoLoadWarning && <div className="nc-validation-summary" role="alert">{photoLoadWarning} <button type="button" className="nc-retry-link" onClick={() => setPhotoRevision(current => current + 1)}>Tentar novamente</button></div>}
        <div className="nc-photo-grid">
          {drive?.connected && photoLoadState === "loading" ? <div className="nc-empty" role="status">Carregando fotos do Google Drive...</div>
            : drive?.connected && photoLoadState === "error" ? <div className="nc-empty">A galeria está indisponível no momento.</div>
            : drive?.connected && photos[selected.id]?.length ? photos[selected.id].map((photo) => <div className="nc-photo" key={photo.id}>
                {photo.url ? <img src={photo.url} alt={photo.name} /> : <div className="nc-photo-missing">Imagem indisponível</div>}
                <span>{photo.name}</span><button type="button" aria-label={`Remover ${photo.name}`} disabled={photoSaving} onClick={() => void removePhoto(photo)}>×</button>
              </div>) : <div className="nc-empty">{drive?.connected ? "Nenhuma foto cadastrada para esta cliente." : "A galeria estará disponível quando a integração estiver ativa."}</div>}
        </div>
      </div>}
      {tab === "preferences" && <div className="nc-tab-content nc-secondary-tab"><div><Icon name="tune" size={25} /><h3>Manutenções &amp; Preferências</h3><p>Dados organizados para preparar os próximos atendimentos.</p></div><div className="nc-info-card"><small>PREFERÊNCIAS</small><p>{selected.preferences}</p></div><div className="nc-info-card"><small>PRÓXIMO RETORNO</small><p>{selected.returnDate ? formatShortDate(selected.returnDate) : "Ainda não definido"}</p></div><button type="button" className="nc-btn nc-btn-primary" onClick={() => setDialog("preferences")}>Editar preferências</button></div>}
    </div> : <div className="nc-empty nc-empty-detail">Selecione uma cliente para abrir a ficha.</div>}</div></div>

    {(dialog === "create" || dialog === "edit") && <DialogFrame title={dialog === "create" ? "Cadastro da Cliente" : "Editar Cadastro da Cliente"} onClose={() => { if (!saving && !photoSaving) setDialog(null); }}><ClientForm key={dialog === "edit" ? selected?.id : "new"} client={dialog === "edit" ? selected ?? undefined : undefined} clients={clients} saving={saving} photoSaving={photoSaving} driveConnected={Boolean(drive?.connected)} driveLoading={drive === null} avatarUrl={avatarUrl} canDelete={profile?.role === "master_admin" || profile?.role === "admin"} onSave={saveClient} onClose={() => setDialog(null)} onDelete={() => setDialog("delete")} onAvatarUpload={uploadAvatar} onAvatarRemove={removeAvatar} /></DialogFrame>}
    {dialog === "delete" && selected && <DialogFrame title="Excluir Cadastro" onClose={() => { if (!saving) setDialog(null); }}><div className="nc-form"><p>Excluir permanentemente o cadastro de {selected.name}, suas sessões e os agendamentos anteriores ou cancelados? Agendamentos futuros ativos precisam ser cancelados antes.</p><div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setDialog("edit")} disabled={saving}>Cancelar</button><button type="button" className="nc-btn nc-btn-danger" onClick={deleteClient} disabled={saving}>{saving ? "Excluindo..." : "Excluir cadastro"}</button></div></div></DialogFrame>}
    {(dialog === "session" || dialog === "maintenance" || dialog === "sessionEdit") && selected && <DialogFrame title={dialog === "sessionEdit" ? "Editar Sessão" : dialog === "session" ? "Registrar Nova Sessão" : "Planejar Retorno"} onClose={() => { if (!saving) { setDialog(null); setLinkedAppointmentId(""); } }}><SessionForm key={`${selected.id}-${dialog}-${editingSessionId}-${linkedAppointmentId}`} client={selected} planned={dialog === "maintenance" || (dialog === "sessionEdit" && editingSession?.payment === "Agendado")} editing={dialog === "sessionEdit" ? editingSession : undefined} appointment={dialog === "session" ? linkedAppointment : undefined} saving={saving} onSave={saveSession} onClose={() => { setDialog(null); setLinkedAppointmentId(""); }} /></DialogFrame>}
    {dialog === "sessionDelete" && selected && editingSession && <DialogFrame title="Excluir Sessão" onClose={() => { if (!saving) setDialog(null); }}><div className="nc-form"><p>Excluir permanentemente “{editingSession.service}” de {selected.name}? O histórico e os indicadores serão recalculados.</p><div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setDialog(null)} disabled={saving}>Cancelar</button><button type="button" className="nc-btn nc-btn-danger" onClick={deleteSession} disabled={saving}>{saving ? "Excluindo..." : "Excluir sessão"}</button></div></div></DialogFrame>}
    {(dialog === "clinical" || dialog === "preferences") && selected && <DialogFrame title={dialog === "clinical" ? "Observações Clínicas" : "Manutenções & Preferências"} onClose={() => { if (!saving) setDialog(null); }}><NotesForm key={`${selected.id}-${dialog}`} client={selected} clinical={dialog === "clinical"} saving={saving} onSave={saveNotes} onClose={() => setDialog(null)} /></DialogFrame>}
    {(dialog === "contact" || dialog === "reminder") && selected && <DialogFrame title={dialog === "contact" ? "Rascunho para WhatsApp" : "Gerar Lembrete de Retorno"} onClose={() => setDialog(null)}><div className="nc-form"><p>Confira o rascunho e copie a mensagem. Nenhum contato será aberto ou enviado automaticamente.</p><label>Telefone da cliente<input readOnly value={selected.phone} /></label><label>Mensagem<textarea id="nc-message" rows={5} defaultValue={dialog === "contact" ? `Olá, ${selected.name.split(" ")[0]}! Aqui é da NAVY. Como podemos ajudar você?` : `Olá, ${selected.name.split(" ")[0]}! Sua janela de manutenção ${selected.returnDate ? `começa em ${formatShortDate(selected.returnDate)}` : "está chegando"}. Vamos encontrar um horário?`} /></label><div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setDialog(null)}>Fechar</button><button type="button" className="nc-btn nc-btn-primary" onClick={() => copyMessage((document.getElementById("nc-message") as HTMLTextAreaElement)?.value ?? "")}>Copiar mensagem</button></div></div></DialogFrame>}
    {toast && <div className="nc-toast" role="status">{toast}</div>}
  </div>;
}
