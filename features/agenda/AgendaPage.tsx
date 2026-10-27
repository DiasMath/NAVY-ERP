"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFirebaseClient } from "@/lib/firebase/client";
import { navyApi } from "@/lib/firebase/navy-api";
import { createFirebaseRepositories } from "@/lib/firebase/repositories";
import type { AppointmentDocument, ClientDocument, ClinicalSessionDocument, ProfessionalDocument } from "@/lib/firebase/documents";
import ContentDialog from "@/components/ContentDialog";
import RightViewDialog from "@/components/RightViewDialog";
import { type ClientRecord } from "@/features/clients/client-data";
import { toClientRecord } from "@/features/clients/client-firestore";
import { durationLabel, type ServiceProfessional, type ServiceRecord } from "@/features/services/service-data";
import { appointmentDuration, appointmentEnd, appointmentPrice, dateFromKey, dateKey, mondayOfKey, moveDate, type AgendaAppointment, type AgendaPlace, type AgendaStatus } from "./agenda-data";
import "./agenda.css";

type View = "Dia" | "Semana" | "Mês";
type BookingPrefill = { clientId?: string; serviceId?: string; professionalId?: string; bookingKind?: "catalog" | "manual"; manualName?: string; manualDurationMinutes?: number; date?: string; time?: string; place?: AgendaPlace; intent?: "maintenance" };
const icon = (name: string, size = 18) => <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size }}>{name}</span>;
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const longDate = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", options).format(dateFromKey(key));
const shortTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const timeMinutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const statusClass: Record<AgendaStatus, string> = { Pendente: "pending", Confirmado: "confirmed", "Em atendimento": "running", Concluído: "done", Cancelado: "cancelled" };

function BookingDialog({ clients, professionals, catalog, appointments, onSave, onClose, editing, prefill }: { clients: ClientRecord[]; professionals: ServiceProfessional[]; catalog: ServiceRecord[]; appointments: AgendaAppointment[]; onSave: (item: AgendaAppointment) => Promise<void>; onClose: () => void; editing?: AgendaAppointment; prefill?: BookingPrefill }) {
  const requestedService = catalog.find(item => item.id === prefill?.serviceId && item.status === "Ativo");
  const catalogReady = professionals.length > 0 && catalog.some(item => item.status === "Ativo");
  const requestedProfessionalId = editing?.professionalId ?? prefill?.professionalId;
  const initialProfessionalId = professionals.find(item => item.id === requestedProfessionalId && (!requestedService || requestedService.professionalIds.includes(item.id)))?.id ?? requestedService?.professionalIds.find(id => professionals.some(item => item.id === id)) ?? professionals[0]?.id ?? "";
  const [bookingKind, setBookingKind] = useState<"catalog" | "manual">(editing?.bookingKind ?? prefill?.bookingKind ?? (catalogReady ? "catalog" : "manual"));
  const [clientId, setClientId] = useState(editing?.clientId ?? prefill?.clientId ?? "");
  const [professionalId, setProfessionalId] = useState(initialProfessionalId);
  const [place, setPlace] = useState<AgendaPlace>(editing?.place ?? prefill?.place ?? (requestedService?.modality === "Home" ? "Home" : "Studio"));
  const [address, setAddress] = useState(editing?.address ?? "");
  const [date, setDate] = useState(editing?.date ?? prefill?.date ?? dateKey(new Date()));
  const [time, setTime] = useState(editing?.time ?? prefill?.time ?? "14:30");
  const [serviceIds, setServiceIds] = useState<string[]>(editing?.bookingKind === "manual" ? [] : editing?.lines.map(line => line.serviceId) ?? (requestedService && requestedService.professionalIds.includes(initialProfessionalId) ? [requestedService.id] : []));
  const [manualName, setManualName] = useState(editing?.bookingKind === "manual" ? editing.lines[0]?.name ?? "" : prefill?.manualName ?? "");
  const [manualDuration, setManualDuration] = useState(String(editing?.bookingKind === "manual" ? editing.lines[0]?.durationMinutes ?? 60 : prefill?.manualDurationMinutes ?? 60));
  const [manualPrice, setManualPrice] = useState(String(editing?.bookingKind === "manual" ? editing.lines[0]?.price ?? 0 : 0));
  const [chosenService, setChosenService] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!professionalId && professionals.length) setProfessionalId(professionals[0].id);
  }, [professionalId, professionals]);
  const available = catalog.filter(item => item.status === "Ativo" && item.professionalIds.includes(professionalId) && (place === "Studio" ? item.modality !== "Home" : item.modality !== "Studio"));
  const selected = serviceIds.map(id => catalog.find(item => item.id === id)).filter((item): item is ServiceRecord => Boolean(item));
  const total = bookingKind === "manual" ? Number(manualPrice) || 0 : selected.reduce((sum, item) => sum + item.price, 0);
  const duration = bookingKind === "manual" ? Number(manualDuration) || 0 : selected.reduce((sum, item) => sum + item.durationMinutes, 0);
  const canAdd = available.filter(item => !serviceIds.includes(item.id));
  const reservedMinutes = bookingKind === "manual" ? duration : selected.reduce((sum, item) => sum + item.durationMinutes + item.bufferMinutes, 0);
  const candidateTimes = [...new Set([...Array.from({ length: 25 }, (_, index) => shortTime(8 * 60 + index * 30)), ...(editing ? [editing.time] : []), ...(prefill?.time ? [prefill.time] : [])])].sort();
  const slotProfessionalId = bookingKind === "manual" ? "" : professionalId;
  const availableSlots = reservedMinutes && date && (bookingKind === "manual" || professionalId) ? candidateTimes.filter(slot => {
    const start = timeMinutes(slot);
    const end = start + reservedMinutes;
    const currentEditingSlot = Boolean(editing && editing.date === date && editing.time === slot);
    if (start < 8 * 60 || end > 20 * 60 || (!currentEditingSlot && new Date(`${date}T${slot}`) <= new Date())) return false;
    return !appointments.some(item => item.id !== editing?.id && item.date === date && item.professionalId === slotProfessionalId && item.status !== "Cancelado" && start < timeMinutes(item.time) + item.lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0) && end > timeMinutes(item.time));
  }) : [];
  const slotKey = availableSlots.join("|");
  useEffect(() => { if (!availableSlots.includes(time)) setTime(availableSlots[0] ?? ""); }, [slotKey, time]);
  const changeProfessional = (value: string) => { setProfessionalId(value); setServiceIds(current => current.filter(id => catalog.some(item => item.id === id && item.professionalIds.includes(value) && (place === "Studio" ? item.modality !== "Home" : item.modality !== "Studio")))); setError(""); };
  const changePlace = (value: AgendaPlace) => { setPlace(value); setServiceIds(current => current.filter(id => catalog.some(item => item.id === id && item.professionalIds.includes(professionalId) && (value === "Studio" ? item.modality !== "Home" : item.modality !== "Studio")))); setError(""); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!clientId) { setError("Selecione uma cliente."); return; }
    if (bookingKind === "manual") {
      if (!manualName.trim() || manualName.trim().length > 120) { setError("Informe uma descrição de até 120 caracteres."); return; }
      if (!Number.isInteger(Number(manualDuration)) || Number(manualDuration) < 15 || Number(manualDuration) > 480) { setError("Informe uma duração entre 15 e 480 minutos."); return; }
      if (manualPrice.trim() === "" || !Number.isFinite(Number(manualPrice)) || Number(manualPrice) < 0 || Number(manualPrice) > 100000) { setError("Informe um valor válido, inclusive zero se ainda não houver preço."); return; }
    } else {
      if (!professionalId || !serviceIds.length) { setError("Selecione uma profissional e pelo menos um serviço disponível."); return; }
      if (selected.length !== serviceIds.length || selected.some(item => !available.includes(item))) { setError("Revise os serviços: todos devem estar ativos e habilitados para esta profissional e local."); return; }
    }
    if (place === "Home" && address.trim().length < 5) { setError("Informe o endereço do atendimento domiciliar."); return; }
    if (!date || !time || !availableSlots.includes(time)) { setError("Escolha um horário disponível para a duração informada."); return; }
    const lines = bookingKind === "manual" ? [{ serviceId: "manual", name: manualName.trim(), price: Number(manualPrice), durationMinutes: Number(manualDuration), bufferMinutes: 0 }] : selected.map(item => ({ serviceId: item.id, name: item.name, price: item.price, durationMinutes: item.durationMinutes, bufferMinutes: item.bufferMinutes }));
    const start = timeMinutes(time);
    const end = start + lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0);
    if (end > 24 * 60) { setError("Os serviços ultrapassam o fim do dia. Escolha outro horário."); return; }
    const conflict = appointments.find(item => item.id !== editing?.id && item.date === date && item.professionalId === slotProfessionalId && item.status !== "Cancelado" && start < timeMinutes(item.time) + item.lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0) && end > timeMinutes(item.time));
    if (conflict) { setError(`Já existe uma reserva às ${conflict.time} nesta agenda. Escolha outro horário.`); return; }
    setSaving(true);
    try { await onSave({ id: editing?.id ?? crypto.randomUUID(), bookingKind, clientId, professionalId: slotProfessionalId, date, time, place, address: place === "Home" ? address.trim() : undefined, lines, status: editing?.status ?? "Pendente", paymentMethod: editing?.paymentMethod, materials: editing?.materials ?? [], note: editing?.note }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o agendamento."); }
    finally { setSaving(false); }
  };
  return <ContentDialog title={editing ? "Editar agendamento" : prefill?.intent === "maintenance" ? "Agendar manutenção" : "Novo agendamento"} wide onClose={onClose}>
    <form className="ag-booking-form" onSubmit={submit} noValidate>
      <p className="ag-booking-intro">{prefill?.intent === "maintenance" ? "Cliente e data de retorno preenchidas. Defina o atendimento e um horário livre." : "Agendamentos salvos no Firestore, com confirmação de disponibilidade no servidor."}</p>
      {!editing && <div className="ag-place-choice" role="group" aria-label="Tipo de agendamento"><button type="button" className={bookingKind === "manual" ? "active" : ""} aria-pressed={bookingKind === "manual"} onClick={() => { setBookingKind("manual"); setError(""); }}>{icon("edit_calendar", 17)} Avulso</button><button type="button" className={bookingKind === "catalog" ? "active" : ""} aria-pressed={bookingKind === "catalog"} onClick={() => { setBookingKind("catalog"); setError(""); }}>{icon("design_services", 17)} Do catálogo</button></div>}
      {bookingKind === "catalog" && !catalogReady && <div className="ag-form-error" role="status">Para usar o catálogo, cadastre uma profissional ativa e um serviço ativo. Você já pode reservar com “Avulso”.</div>}
      <div className="ag-form-heading">{icon("person", 18)} Identificação da cliente</div>
      <label className="ag-field">Cliente *<select value={clientId} onChange={event => { setClientId(event.target.value); setError(""); }}><option value="">Selecione uma cliente</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="ag-form-heading">{icon("pin_drop", 18)} Local do atendimento</div>
      <div className="ag-place-choice" role="group" aria-label="Local do atendimento"><button type="button" className={place === "Studio" ? "active" : ""} aria-pressed={place === "Studio"} onClick={() => changePlace("Studio")}>{icon("spa", 17)} Cabine Estúdio</button><button type="button" className={place === "Home" ? "active" : ""} aria-pressed={place === "Home"} onClick={() => changePlace("Home")}>{icon("home", 17)} Atendimento Domiciliar</button></div>
      {bookingKind === "catalog" && <label className="ag-field">Profissional *<select value={professionalId} onChange={event => changeProfessional(event.target.value)}><option value="">Selecione uma profissional</option>{professionals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {place === "Home" && <label className="ag-field">Endereço do atendimento *<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número, complemento e bairro" /></label>}
      {bookingKind === "manual" && <><div className="ag-form-heading">{icon("edit_note", 18)} Atendimento avulso</div><label className="ag-field">Descrição *<input value={manualName} maxLength={120} onChange={event => { setManualName(event.target.value); setError(""); }} placeholder="Ex.: avaliação ou retorno" /></label><div className="ag-form-grid"><label className="ag-field">Duração em minutos *<input type="number" min={15} max={480} step={5} value={manualDuration} onChange={event => { setManualDuration(event.target.value); setError(""); }} /></label><label className="ag-field">Valor previsto (R$) *<input type="number" min={0} max={100000} step="0.01" value={manualPrice} onChange={event => { setManualPrice(event.target.value); setError(""); }} /></label></div><small className="ag-booking-help">Sem profissional definido. Reservas avulsas simultâneas são bloqueadas; o valor pode ser zero.</small></>}
      <div className="ag-form-heading">{icon("schedule", 18)} Data e janela de atendimento</div>
      <div className="ag-form-grid"><label className="ag-field">Data *<input type="date" min={editing ? undefined : dateKey(new Date())} value={date} onChange={event => { setDate(event.target.value); setError(""); }} /></label><label className="ag-field">Início *<select value={time} disabled={!availableSlots.length} onChange={event => { setTime(event.target.value); setError(""); }}><option value="">{reservedMinutes ? "Nenhum horário livre" : "Informe a duração"}</option>{availableSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></label><div className="ag-duration-box"><small>Duração estimada</small><strong>{duration ? durationLabel(duration) : "Informe a duração"}</strong><span>{duration && time ? `Término previsto: ${shortTime(timeMinutes(time) + duration)}` : bookingKind === "manual" ? "Definida acima" : "Calculada pelo catálogo"}</span></div></div>
      {bookingKind === "catalog" && <><div className="ag-form-heading">{icon("design_services", 18)} Procedimentos selecionados ({selected.length})</div><label className="ag-field ag-service-picker">Adicionar serviço<select value={chosenService} onChange={event => { if (event.target.value) setServiceIds(current => [...current, event.target.value]); setChosenService(""); setError(""); }}><option value="">Selecione um procedimento disponível</option>{canAdd.map(item => <option key={item.id} value={item.id}>{item.name} · {durationLabel(item.durationMinutes)}</option>)}</select></label><div className="ag-booking-lines">{selected.length ? selected.map(item => <div key={item.id}><span><strong>{item.name}</strong><small>{durationLabel(item.durationMinutes)} · {place === "Studio" ? "Cabine" : "Domicílio"}</small></span><b>{money(item.price)}</b><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setServiceIds(current => current.filter(id => id !== item.id))}>{icon("delete_outline", 17)}</button></div>) : <p>Nenhum procedimento selecionado.</p>}</div></>}
      <small className="ag-booking-help">Horários entre 08:00 e 20:00. O servidor confirma a disponibilidade ao salvar.</small>
      <div className="ag-booking-summary"><div><span>Valor previsto</span><strong>{money(total)}</strong></div><div><span>Tempo reservado</span><strong>{reservedMinutes ? durationLabel(reservedMinutes) : "—"}</strong></div><small>O pagamento é registrado na sessão da cliente após o atendimento.</small></div>
      {error && <div className="ag-form-error" role="alert">{error}</div>}
      <div className="ag-booking-actions"><button type="button" className="ag-quiet-btn" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="ag-primary-btn" disabled={saving}>{icon("event_available", 18)} {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar agendamento"}</button></div>
    </form>
  </ContentDialog>;
}

function TimelineCard({ item, client, selected, onSelect }: { item: AgendaAppointment; client?: ClientRecord; selected: boolean; onSelect: () => void }) {
  const name = client?.name ?? "Cliente não encontrada";
  return <div className="ag-time-row"><span className="ag-time-label">{item.time}</span><button type="button" className={`ag-appointment-card ag-card-${item.place.toLowerCase()} ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onSelect}><span className="ag-card-accent" /><span className="ag-card-main"><span className="ag-card-top"><span className="ag-card-client">{client?.avatar ? <img src={client.avatar} alt="" /> : <i>{initials(name)}</i>}<span><strong>{name}</strong><small>{item.place === "Studio" ? "NAVY Matriz" : "Domicílio VIP"}</small><em>{item.time} – {appointmentEnd(item)} ({durationLabel(appointmentDuration(item))}){item.place === "Home" && item.address ? ` · ${item.address}` : ""}</em></span></span><span className="ag-card-status"><b className={`ag-status ag-status-${statusClass[item.status]}`}>{item.status}</b><small>{item.status === "Cancelado" ? "Horário liberado" : item.paymentMethod ? `Forma indicada: ${item.paymentMethod}` : item.status === "Pendente" ? "Aguarda confirmação" : "Agendamento salvo"}</small></span></span><span className="ag-card-service">{icon(item.place === "Home" ? "spa" : "auto_fix_high", 17)}<span>{item.lines.map(line => line.name).join(" + ")}</span><strong>{money(appointmentPrice(item))}</strong></span><span className="ag-card-bottom">{icon(item.place === "Home" ? "navigation" : "visibility", 15)} {item.place === "Home" ? "Atendimento domiciliar" : "Selecione para ver a ficha"}<span>Ver detalhes {icon("arrow_forward", 14)}</span></span></span></button></div>;
}

function DetailPanel({ item, client, professional, session, onClose, onEdit, onCancel, onUpdate, onMaintenance, onToast }: { item: AgendaAppointment | null; client?: ClientRecord; professional?: ServiceProfessional; session?: ClinicalSessionDocument; onClose: () => void; onEdit: () => void; onCancel: () => void; onUpdate: (changes: Partial<AgendaAppointment>) => void; onMaintenance: () => void; onToast: (message: string) => void }) {
  const [newMaterial, setNewMaterial] = useState("");
  if (!item) return <aside className="ag-detail ag-detail-empty"><div>{icon("event_note", 28)}<strong>Selecione um atendimento</strong><span>Escolha um cartão da agenda para revisar os detalhes.</span></div></aside>;
  const total = appointmentPrice(item);
  const paymentMethods = ["Pix", "Débito", "Crédito", "Dinheiro"];
  const paymentRecorded = session?.paymentStatus === "paid";
  return <aside className="ag-detail"><div className="ag-detail-head"><div><small>ATENDIMENTO #{item.id} <span className={`ag-status ag-status-${statusClass[item.status]}`}>{item.status}</span></small><h2>Ficha do atendimento</h2></div><div><button type="button" title="Imprimir ficha" onClick={() => window.print()}>{icon("print", 17)}</button><button type="button" title="Fechar painel" onClick={onClose}>{icon("close", 18)}</button></div></div>
    <div className="ag-detail-scroll"><div className="ag-detail-client">{client?.avatar ? <img src={client.avatar} alt="" /> : <i>{initials(client?.name ?? "Cliente")}</i>}<span><strong>{client?.name ?? "Cliente não encontrada"}</strong><small>{client?.phone ?? ""} · {client?.source ?? "Cadastro"}</small><em>{client?.visits ?? 0} atendimentos anteriores</em></span><Link href={`/clientes?clientId=${encodeURIComponent(item.clientId)}`} aria-label="Abrir cadastro desta cliente">{icon("chat", 18)}</Link></div>
      <section className="ag-detail-section"><header><strong>{item.bookingKind === "manual" ? "ATENDIMENTO AVULSO" : "SERVIÇOS DO ATENDIMENTO"}</strong><small>Tempo total: {durationLabel(appointmentDuration(item))}</small></header>{item.lines.map((line, index) => <div className="ag-service-line" key={`${line.serviceId}-${index}`}><span>{line.serviceId === "manual" ? <strong>{line.name}</strong> : <Link href={`/servicos?serviceId=${encodeURIComponent(line.serviceId)}`}>{line.name}</Link>}<small>{durationLabel(line.durationMinutes)} · {professional?.name ?? "Profissional a definir"}</small></span><b>{money(line.price)}</b></div>)}<div className="ag-place-meta">{icon(item.place === "Home" ? "home_pin" : "meeting_room", 15)} {item.place === "Home" ? item.address ?? "Domicílio" : "NAVY Matriz"} · {longDate(item.date, { day: "2-digit", month: "short" })} · {item.time}–{appointmentEnd(item)}</div></section>
      {(item.status === "Concluído" || session) && <section className="ag-detail-section ag-session-link"><header><strong>HISTÓRICO DA CLIENTE</strong></header><p>{session ? "A sessão deste atendimento está registrada na ficha da cliente." : "Registre a sessão na ficha para atualizar visitas e histórico financeiro."}</p><Link href={session ? `/clientes?clientId=${encodeURIComponent(item.clientId)}&sessionId=${encodeURIComponent(session.id)}` : `/clientes?clientId=${encodeURIComponent(item.clientId)}&appointmentId=${encodeURIComponent(item.id)}&newSession=1`}>{session ? "Ver sessão na ficha" : "Registrar sessão deste agendamento"}</Link></section>}
      <section className="ag-detail-section"><header><strong>INSUMOS DO ATENDIMENTO</strong><button type="button" onClick={() => setNewMaterial(current => current ? "" : " ")}>+ Adicionar insumo</button></header>{newMaterial && <form className="ag-material-add" onSubmit={event => { event.preventDefault(); const value = newMaterial.trim(); if (value && !item.materials.includes(value)) onUpdate({ materials: [...item.materials, value] }); setNewMaterial(""); }}><input value={newMaterial.trimStart()} onChange={event => setNewMaterial(event.target.value)} placeholder="Nome do insumo" autoFocus /><button type="submit">Adicionar</button></form>}<div className="ag-materials">{item.materials.length ? item.materials.map(name => <label key={name}><input type="checkbox" checked onChange={() => onUpdate({ materials: item.materials.filter(value => value !== name) })} /><span>{name}</span></label>) : <p>Nenhum insumo registrado neste atendimento.</p>}</div><p>Itens salvos no agendamento; baixa de estoque ainda não configurada.</p></section>
      <section className="ag-detail-section"><header><strong>VALOR E PAGAMENTO</strong></header><div className="ag-money-box"><div><span>Valor previsto no agendamento</span><strong>{money(total)}</strong></div>{session && <><div><span>Valor registrado na sessão</span><strong>{money(session.amount)}</strong></div><div className="ag-money-total"><span>{paymentRecorded ? "Recebido" : "Pagamento pendente"}</span><strong>{money(session.amount)}</strong></div></>}</div>{session ? <p>{paymentRecorded ? `Pagamento registrado na ficha da cliente${session.paymentMethod ? ` via ${session.paymentMethod}` : ""}.` : "Pagamento pendente na ficha da cliente."}</p> : <><div className="ag-payment-options">{paymentMethods.map(method => <button type="button" key={method} className={item.paymentMethod === method ? "selected" : ""} aria-pressed={item.paymentMethod === method} onClick={() => onUpdate({ paymentMethod: method })}>{method}</button>)}</div><p>Forma de pagamento prevista. O recebimento é registrado na sessão da cliente após o atendimento.</p></>}</section>
      <section className="ag-detail-section ag-return"><header><strong>RETORNO E MANUTENÇÃO</strong></header><p>{item.bookingKind === "manual" ? "Use este atendimento como base para sugerir um novo horário de retorno." : "A manutenção pode ser pré-selecionada a partir do serviço vinculado no catálogo."}</p><button type="button" onClick={onMaintenance}>{icon("bookmark_add", 16)} Pré-agendar manutenção</button></section>
    </div><div className="ag-detail-footer"><button type="button" className="ag-quiet-btn" onClick={onEdit} disabled={Boolean(session)} title={session ? "Exclua a sessão vinculada antes de editar o agendamento." : undefined}>{icon("edit", 16)} Editar</button><button type="button" className="ag-primary-btn" disabled={Boolean(session)} onClick={() => item.status === "Cancelado" ? onToast("Este agendamento está cancelado.") : onUpdate({ status: item.status === "Concluído" ? "Confirmado" : "Concluído" })}>{icon("task_alt", 17)} {session ? "Sessão registrada" : item.status === "Concluído" ? "Reabrir" : "Concluir atendimento"}</button></div>{item.status !== "Cancelado" && !session && <button type="button" className="ag-cancel-link" onClick={onCancel}>Cancelar agendamento</button>}</aside>;
}

export default function AgendaPage() {
  const { user, profile } = useAuth();
  const repositories = useMemo(() => profile ? createFirebaseRepositories(getFirebaseClient().db, profile.clinicId) : null, [profile]);
  const [today, setToday] = useState("");
  const [anchor, setAnchor] = useState("");
  const [view, setView] = useState<View>("Dia");
  const [placeFilter, setPlaceFilter] = useState<"Todos" | AgendaPlace>("Todos");
  const [professionalFilter, setProfessionalFilter] = useState("Todos");
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [sessionDocuments, setSessionDocuments] = useState<ClinicalSessionDocument[]>([]);
  const [catalog, setCatalog] = useState<ServiceRecord[]>([]);
  const [professionalDocuments, setProfessionalDocuments] = useState<ProfessionalDocument[]>([]);
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [dataError, setDataError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialog, setDialog] = useState<"new" | "edit" | "cancel" | null>(null);
  const [prefill, setPrefill] = useState<BookingPrefill | undefined>();
  const [toast, setToast] = useState("");
  const openedFromLink = useRef(false);

  useEffect(() => {
    const current = dateKey(new Date());
    setToday(current); setAnchor(current);
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      const requestedDate = params.get("date") ?? "";
      setPrefill({
        clientId: params.get("clientId") ?? undefined,
        serviceId: params.get("serviceId") ?? undefined,
        professionalId: params.get("professionalId") ?? undefined,
        date: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= current ? requestedDate : current,
        intent: params.get("intent") === "maintenance" ? "maintenance" : undefined,
      });
      setDialog("new");
    }
  }, []);
  useEffect(() => {
    if (!repositories) return;
    setLoaded(false); setDataError("");
    const ready = new Set<string>();
    const mark = (segment: string) => { ready.add(segment); if (ready.size === 5) setLoaded(true); };
    const fail = () => setDataError("Não foi possível carregar a Agenda do Firestore. Recarregue a página.");
    const stops = [
      repositories.clients.subscribe(items => { setClientDocuments(items); mark("clients"); }, fail),
      repositories.sessions.subscribe(items => { setSessionDocuments(items); mark("sessions"); }, fail),
      repositories.services.subscribe(items => { setCatalog(items.map(item => ({ ...item, imageUrl: "" }))); mark("services"); }, fail),
      repositories.professionals.subscribe(items => { setProfessionalDocuments(items); mark("professionals"); }, fail),
      repositories.appointments.subscribe(items => { setAppointments(items as AgendaAppointment[]); mark("appointments"); }, fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [repositories]);
  useEffect(() => {
    if (openedFromLink.current) return;
    const appointmentId = new URLSearchParams(window.location.search).get("appointmentId");
    const requested = appointments.find(item => item.id === appointmentId);
    if (requested) { openedFromLink.current = true; setAnchor(requested.date); setSelectedId(requested.id); setPanelOpen(true); }
  }, [appointments]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timer); }, [toast]);

  const clients = useMemo(() => clientDocuments.map(item => toClientRecord(item, sessionDocuments)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [clientDocuments, sessionDocuments]);
  const professionals = useMemo(() => professionalDocuments.filter(item => item.active).map(item => ({ id: item.id, name: item.name })), [professionalDocuments]);
  const onDate = appointments.filter(item => item.date === anchor && (placeFilter === "Todos" || item.place === placeFilter) && (professionalFilter === "Todos" || item.professionalId === professionalFilter)).sort((a, b) => a.time.localeCompare(b.time));
  const selected = onDate.find(item => item.id === selectedId) ?? onDate[0] ?? null;
  const selectedClient = clients.find(item => item.id === selected?.clientId);
  const selectedProfessional = professionalDocuments.find(item => item.id === selected?.professionalId);
  const selectedSession = sessionDocuments.find(item => item.appointmentId === selected?.id);
  const period = !anchor ? "Carregando agenda" : view === "Mês" ? longDate(anchor, { month: "long", year: "numeric" }) : view === "Semana" ? `${longDate(mondayOfKey(anchor), { day: "numeric", month: "short" })} – ${longDate(moveDate(mondayOfKey(anchor), 6), { day: "numeric", month: "short", year: "numeric" })}` : longDate(anchor, { day: "numeric", month: "long", year: "numeric" });
  const movePeriod = (direction: number) => { if (!anchor) return; setPanelOpen(false); if (view === "Mês") { const next = dateFromKey(anchor); next.setMonth(next.getMonth() + direction); setAnchor(dateKey(next)); } else setAnchor(moveDate(anchor, direction * (view === "Semana" ? 7 : 1))); };
  const updateAppointment = async (changes: Partial<AgendaAppointment>): Promise<boolean> => {
    if (!selected || !user) return false;
    try {
      await navyApi(user, "/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, ...changes }) });
      setToast("Agendamento atualizado no Firestore.");
      return true;
    } catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível atualizar o agendamento."); return false; }
  };
  const saveBooking = async (item: AgendaAppointment) => {
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const response = await navyApi(user, "/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(appointments.some(existing => existing.id === item.id) ? { id: item.id } : {}), bookingKind: item.bookingKind ?? "catalog", clientId: item.clientId, professionalId: item.professionalId, ...(item.bookingKind === "manual" ? { manualName: item.lines[0].name, manualDurationMinutes: item.lines[0].durationMinutes, manualPrice: item.lines[0].price } : { serviceIds: item.lines.map(line => line.serviceId) }), date: item.date, time: item.time, place: item.place, address: item.address }) });
    const result = await response.json() as { appointment: AppointmentDocument };
    setAnchor(result.appointment.date); setView("Dia"); setPlaceFilter("Todos"); setProfessionalFilter("Todos"); setSelectedId(result.appointment.id); setPanelOpen(true); setDialog(null); setPrefill(undefined); setToast("Agendamento salvo no Firestore.");
  };
  const prepareMaintenance = () => { if (!selected) return; const base = catalog.find(item => item.id === selected.lines[0]?.serviceId); const maintenance = catalog.find(item => item.id === base?.maintenanceServiceId); const suggested = moveDate(selected.date, base?.returnMinDays ?? 21); setPrefill({ clientId: selected.clientId, serviceId: maintenance?.id, bookingKind: selected.bookingKind === "manual" ? "manual" : "catalog", manualName: selected.bookingKind === "manual" ? selected.lines[0]?.name : undefined, manualDurationMinutes: selected.bookingKind === "manual" ? selected.lines[0]?.durationMinutes : undefined, date: suggested, time: selected.time }); setDialog("new"); };
  const weekDays = anchor ? Array.from({ length: 7 }, (_, index) => moveDate(mondayOfKey(anchor), index)) : [];
  const monthDays = useMemo(() => {
    if (!anchor) return [];
    const first = `${anchor.slice(0, 7)}-01`;
    const start = mondayOfKey(first);
    const firstDate = dateFromKey(first);
    const last = dateKey(new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0));
    let count = 28;
    while (moveDate(start, count - 1) < last) count += 7;
    return Array.from({ length: count }, (_, index) => moveDate(start, index));
  }, [anchor]);
  const filteredAll = appointments.filter(item => (placeFilter === "Todos" || item.place === placeFilter) && (professionalFilter === "Todos" || item.professionalId === professionalFilter));
  const dayTotal = onDate.filter(item => item.status !== "Cancelado").reduce((sum, item) => sum + appointmentPrice(item), 0);
  const gaps = new Map<string, { time: string; minutes: number }>();
  const activeOnDate = onDate.filter(item => item.status !== "Cancelado");
  activeOnDate.forEach(item => {
    if (!item.professionalId) return;
    const next = activeOnDate.find(candidate => candidate.professionalId === item.professionalId && candidate.time > item.time);
    const end = timeMinutes(item.time) + item.lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0);
    const free = (next ? timeMinutes(next.time) : 20 * 60) - end;
    const eligible = catalog.filter(service => service.status === "Ativo" && service.professionalIds.includes(item.professionalId) && (item.place === "Studio" ? service.modality !== "Home" : service.modality !== "Studio"));
    const shortest = Math.min(...eligible.map(service => service.durationMinutes + service.bufferMinutes));
    if (free >= shortest && new Date(`${anchor}T${shortTime(end)}`) > new Date()) gaps.set(item.id, { time: shortTime(end), minutes: free });
  });
  const closingMinute = Math.max(19 * 60, ...onDate.map(item => timeMinutes(item.time) + appointmentDuration(item)));
  const closingTime = shortTime(Math.ceil(closingMinute / 60) * 60);

  return <div className="ag-page">{dataError && <div className="ag-form-error" role="alert">{dataError}</div>}{!loaded && !dataError && <div className="ag-booking-help" role="status">Carregando Agenda do Firestore...</div>}<section className="ag-toolbar"><div className="ag-toolbar-left"><div className="ag-segments" role="group" aria-label="Visualização da agenda">{(["Dia", "Semana", "Mês"] as View[]).map(item => <button type="button" key={item} className={view === item ? "active" : ""} aria-pressed={view === item} onClick={() => { setView(item); setPanelOpen(false); }}>{item}</button>)}</div><div className="ag-date-nav"><button type="button" onClick={() => movePeriod(-1)} aria-label="Período anterior">{icon("chevron_left", 18)}</button>{icon("calendar_month", 17)}<strong>{period}</strong><button type="button" onClick={() => movePeriod(1)} aria-label="Próximo período">{icon("chevron_right", 18)}</button><button type="button" className="ag-today" onClick={() => { setAnchor(today); setPanelOpen(false); }}>Hoje</button></div></div><div className="ag-toolbar-right"><select aria-label="Filtrar local" value={placeFilter} onChange={event => setPlaceFilter(event.target.value as "Todos" | AgendaPlace)}><option value="Todos">Todos os locais</option><option value="Studio">NAVY Matriz</option><option value="Home">Atendimento domiciliar</option></select><select aria-label="Filtrar profissional" value={professionalFilter} onChange={event => setProfessionalFilter(event.target.value)}><option value="Todos">Todas as profissionais</option>{professionals.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="button" className="ag-new-btn" disabled={!loaded || Boolean(dataError)} onClick={() => { setPrefill({ date: anchor, time: "14:30" }); setDialog("new"); }}>{icon("add_circle", 19)} Novo Agendamento</button></div></section>
    {view === "Semana" && <div className="ag-week-strip">{weekDays.map(day => <button type="button" key={day} className={day === anchor ? "active" : ""} onClick={() => { setAnchor(day); setPanelOpen(false); }}><small>{longDate(day, { weekday: "short" }).replace(".", "")}</small><strong>{dateFromKey(day).getDate()}</strong><em>{filteredAll.filter(item => item.date === day).length}</em></button>)}</div>}
    <div className="ag-layout"><div className="ag-schedule">{view === "Mês" ? <div className="ag-month"><header>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => <span key={day}>{day}</span>)}</header><div style={{ gridTemplateRows: `repeat(${monthDays.length / 7}, minmax(0, 1fr))` }}>{monthDays.map(day => { const items = filteredAll.filter(item => item.date === day); return <button type="button" key={day} className={`${day.slice(0, 7) !== anchor.slice(0, 7) ? "outside" : ""} ${day === today ? "today" : ""}`} onClick={() => { setAnchor(day); setView("Dia"); setPanelOpen(false); }}><strong>{dateFromKey(day).getDate()}</strong>{items.slice(0, 2).map(item => <span key={item.id}>{item.time} {clients.find(client => client.id === item.clientId)?.name ?? "Cliente"}</span>)}{items.length > 2 && <small>+ {items.length - 2} outros</small>}</button>; })}</div></div> : <><div className="ag-day-ribbon"><span className="ag-day-number">{anchor ? dateFromKey(anchor).getDate() : "—"}</span><div><strong>{anchor ? longDate(anchor, { weekday: "long" }) : "Agenda"}</strong><small>Agenda da Matriz · {onDate.length} {onDate.length === 1 ? "atendimento" : "atendimentos"} no dia</small></div><span className="ag-ribbon-stat">{money(dayTotal)} previstos</span></div><div className="ag-timeline"><div className="ag-timeline-line" />{onDate.length ? <><div className="ag-time-row ag-setup"><span className="ag-time-label">08:00</span><div>{icon("sanitizer", 16)} Preparação do espaço e materiais <small>Rotina ilustrativa</small></div></div>{onDate.map(item => <div key={item.id}><TimelineCard item={item} client={clients.find(client => client.id === item.clientId)} selected={item.id === selected?.id && panelOpen} onSelect={() => { setSelectedId(item.id); setPanelOpen(true); }} />{gaps.has(item.id) && <button type="button" className="ag-available-row" onClick={() => { setPrefill({ date: anchor, time: gaps.get(item.id)!.time, professionalId: item.professionalId, place: item.place }); setDialog("new"); }}><span>{gaps.get(item.id)!.time}</span><b>{icon("add_alarm", 18)} Consultar encaixe ({gaps.get(item.id)!.minutes} min)</b><small>Sujeito à validação</small></button>}</div>)}<div className="ag-time-row ag-close"><span className="ag-time-label">{closingTime}</span><div>{icon("lock_clock", 15)} Encerramento da agenda</div></div></> : <div className="ag-empty-day"><div>{icon("event_available", 28)}<strong>Nenhum atendimento neste dia</strong><p>Use “Novo Agendamento” para reservar um horário.</p><button type="button" onClick={() => { setPrefill({ date: anchor, time: "14:30" }); setDialog("new"); }}>Criar agendamento</button></div></div>}</div></>}</div>
      {panelOpen && selected && !dialog && <RightViewDialog title="Ficha do atendimento" onClose={() => setPanelOpen(false)}><DetailPanel key={selected.id} item={selected} client={selectedClient} professional={selectedProfessional} session={selectedSession} onClose={() => setPanelOpen(false)} onEdit={() => setDialog("edit")} onCancel={() => setDialog("cancel")} onUpdate={updateAppointment} onMaintenance={prepareMaintenance} onToast={setToast} /></RightViewDialog>}</div>
    {dialog === "new" && loaded && <BookingDialog clients={clients} professionals={professionals} catalog={catalog} appointments={appointments} prefill={prefill} onSave={saveBooking} onClose={() => { setDialog(null); setPrefill(undefined); }} />}
    {dialog === "edit" && selected && <BookingDialog key={selected.id} editing={selected} clients={clients} professionals={professionals} catalog={catalog} appointments={appointments} onSave={saveBooking} onClose={() => setDialog(null)} />}
    {dialog === "cancel" && selected && <ContentDialog title="Cancelar agendamento" onClose={() => setDialog(null)}><div className="ag-confirm"><p>Cancelar o atendimento de <strong>{selectedClient?.name}</strong> em {longDate(selected.date, { day: "numeric", month: "long" })} às {selected.time}?</p><div><button type="button" className="ag-quiet-btn" onClick={() => setDialog(null)}>Voltar</button><button type="button" className="ag-danger-btn" onClick={async () => { if (await updateAppointment({ status: "Cancelado" })) setDialog(null); }}>Cancelar agendamento</button></div></div></ContentDialog>}
    {toast && <div className="nc-toast" role="status">{toast}</div>}
  </div>;
}
