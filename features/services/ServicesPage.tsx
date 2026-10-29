"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { doc, writeBatch } from "firebase/firestore";
import ContentDialog from "@/components/ContentDialog";
import ContentSkeleton from "@/components/ContentSkeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFirebaseClient } from "@/lib/firebase/client";
import { navyApi } from "@/lib/firebase/navy-api";
import { createFirebaseRepositories } from "@/lib/firebase/repositories";
import { newAgendaHref } from "@/features/agenda/agenda-links";
import type { ServiceDocument, ProfessionalDocument } from "@/lib/firebase/documents";
import { categoryPrefixes, durationLabel, modalityLabel, serviceCategories, type ServiceCategory, type ServiceModality, type ServiceProfessional, type ServiceRecord, type ServiceStatus } from "./service-data";
import { validateService, type ServiceErrors, type ServiceField, type ServiceInput } from "./service-validation";

type CategoryFilter = ServiceCategory | "Todos";
type StatusFilter = ServiceStatus | "Todos";
type ModalityFilter = ServiceModality | "Todas";
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const normalise = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const categoryShort: Record<ServiceCategory, string> = { "Cílios & Extensão": "Cílios", "Sobrancelhas & Design": "Sobrancelhas", "Lash Lifting & Tratamentos": "Tratamentos", "Facial & Pele": "Facial", "Combos & Pacotes": "Combos" };
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const returnLabel = (service: ServiceRecord) => service.returnMinDays ? `${service.returnMinDays}${service.returnMaxDays && service.returnMaxDays !== service.returnMinDays ? ` a ${service.returnMaxDays}` : ""} dias` : "A definir";
const Icon = ({ name, size = 18 }: { name: string; size?: number }) => <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size }}>{name}</span>;

function nextSku(category: ServiceCategory, services: ServiceRecord[]): string {
  const prefix = categoryPrefixes[category];
  const used = services.map((service) => new RegExp(`^${prefix}-(\\d+)$`).exec(service.sku)?.[1]).filter(Boolean).map(Number);
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
}

async function prepareServicePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use uma foto JPG, PNG ou WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A foto pode ter até 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / bitmap.width, 1200 / bitmap.height);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto neste navegador.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close();
  }
}

function ServiceForm({ service, services, professionals, knownProfessionals, canCreateProfessionals, saving, driveConnected, driveLoading, onSave, onClose }: { service?: ServiceRecord; services: ServiceRecord[]; professionals: ServiceProfessional[]; knownProfessionals: ProfessionalDocument[]; canCreateProfessionals: boolean; saving: boolean; driveConnected: boolean; driveLoading: boolean; onSave: (input: ServiceInput, addedProfessionals: ServiceProfessional[], image: File | null, removeImage: boolean) => void; onClose: () => void }) {
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [category, setCategory] = useState<ServiceCategory>(service?.category ?? serviceCategories[0]);
  const [sku, setSku] = useState(service?.sku ?? nextSku(serviceCategories[0], services));
  const [draftProfessionals, setDraftProfessionals] = useState<ServiceProfessional[]>(professionals);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>(service?.professionalIds ?? (professionals[0] ? [professionals[0].id] : []));
  const [newProfessionalName, setNewProfessionalName] = useState("");
  const [professionalError, setProfessionalError] = useState("");
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!imageFile && !removeImage) setImageUrl(service?.imageUrl ?? ""); }, [service?.imageUrl, imageFile, removeImage]);
  const addProfessional = () => {
    const name = newProfessionalName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 80) { setProfessionalError("Informe um nome com 3 a 80 caracteres."); return; }
    if (draftProfessionals.some((item) => normalise(item.name) === normalise(name)) || knownProfessionals.some((item) => normalise(item.name) === normalise(name))) { setProfessionalError("Este profissional já existe. Se estiver inativo, reative-o em Profissionais."); return; }
    const professional = { id: crypto.randomUUID(), name };
    setDraftProfessionals((current) => [...current, professional]);
    setSelectedProfessionalIds((current) => [...current, professional.id]);
    setNewProfessionalName("");
    setProfessionalError("");
  };
  const onPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoLoading(true);
    setPhotoError("");
    try {
      const preview = await prepareServicePhoto(file);
      setImageFile(new File([await (await fetch(preview)).blob()], "servico.jpg", { type: "image/jpeg" }));
      setImageUrl(preview);
      setRemoveImage(false);
    }
    catch (error) { setPhotoError(error instanceof Error ? error.message : "Não foi possível abrir a foto."); }
    finally { setPhotoLoading(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (photoLoading || saving) return;
    const result = validateService(new FormData(event.currentTarget), services, draftProfessionals.map((item) => item.id), service?.id);
    setErrors(result.errors);
    const first = Object.keys(result.errors)[0] as ServiceField | undefined;
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    onSave(result.input, draftProfessionals.filter((item) => !professionals.some((saved) => saved.id === item.id)), imageFile, removeImage);
  };
  const clearError = (field: string) => { if (field in errors) setErrors((current) => ({ ...current, [field]: undefined })); };
  const error = (field: ServiceField) => errors[field] ? <span className="nc-field-error" id={`sv-error-${field}`}>{errors[field]}</span> : null;
  const invalid = (field: ServiceField) => ({ "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `sv-error-${field}` : undefined });
  const consumables = service?.consumables.map((item) => `${item.name} | ${item.quantity} | ${item.cost.toFixed(2)}`).join("\n") ?? "";
  return <form className="nc-form sv-form" noValidate onSubmit={submit} onChange={(event) => clearError(event.target.getAttribute("name") ?? "")}>
    <p>Os procedimentos e profissionais são salvos no Firestore. Imagens ficam no Google Drive. <strong>* Campos obrigatórios; os demais são opcionais.</strong></p>
    {Object.values(errors).some(Boolean) && <div className="nc-validation-summary" role="alert">Revise os campos destacados antes de salvar.</div>}
    <div className="sv-photo-field"><div className={`sv-photo-preview ${imageUrl ? "sv-photo-has-image" : ""}`}>{imageUrl ? <img src={imageUrl} alt="Prévia da imagem de apresentação do serviço" /> : <Icon name="add_photo_alternate" size={30} />}</div><div className="sv-photo-info"><strong>Imagem de apresentação do serviço</strong><span>{driveLoading ? "Verificando conexão com o Google Drive..." : driveConnected ? "Exibida na ficha técnica; fotos antes/depois ficam no atendimento. JPG, PNG ou WebP, até 8 MB." : "Conecte o Google Drive em Configurações → Integrações para usar imagens."}</span><div className="sv-photo-actions"><button type="button" className="nc-btn nc-btn-soft" disabled={photoLoading || saving || !driveConnected} onClick={() => photoInputRef.current?.click()}><Icon name="photo_camera" size={16} />{imageUrl ? "Trocar foto" : "Adicionar foto"}</button>{imageUrl && <button type="button" className="nc-btn nc-btn-quiet" disabled={!driveConnected || saving} onClick={() => { setImageUrl(""); setImageFile(null); setRemoveImage(true); setPhotoError(""); }}>Remover</button>}</div><input ref={photoInputRef} className="nc-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagem de apresentação do serviço" onChange={onPhotoChange} /></div></div>
    {photoLoading && <span className="sv-photo-message" role="status">Preparando a foto...</span>}
    {photoError && <span className="sv-photo-message sv-photo-error" role="alert">{photoError}</span>}
    <div className="sv-form-grid"><label className="sv-form-span-2">Nome do procedimento *<input name="name" required minLength={3} maxLength={100} defaultValue={service?.name} placeholder="Ex: Volume Brasileiro Personalizado" {...invalid("name")} />{error("name")}</label>
      <label>Categoria *<select name="category" value={category} onChange={(event) => { const value = event.target.value as ServiceCategory; setCategory(value); if (!service) setSku(nextSku(value, services)); }} {...invalid("category")}>{serviceCategories.map((item) => <option key={item}>{item}</option>)}</select>{error("category")}</label>
      <label>Código SKU<input value={sku} readOnly aria-label="Código SKU gerado automaticamente" /><span className="sv-field-hint">Gerado automaticamente para evitar duplicatas.</span></label>
      <label className="sv-form-span-2">Descrição<textarea name="description" rows={2} maxLength={300} defaultValue={service?.description} placeholder="Resumo exibido no catálogo" {...invalid("description")} />{error("description")}</label>
      <label>Duração (min) *<input name="durationMinutes" type="number" inputMode="numeric" min={15} max={720} step={5} required defaultValue={service?.durationMinutes ?? 60} {...invalid("durationMinutes")} />{error("durationMinutes")}</label>
      <label>Intervalo após o serviço (min) *<input name="bufferMinutes" type="number" inputMode="numeric" min={0} max={120} step={5} required defaultValue={service?.bufferMinutes ?? 15} {...invalid("bufferMinutes")} />{error("bufferMinutes")}</label>
      <label>Preço de tabela (R$) *<input name="price" type="number" inputMode="decimal" min={0.01} max={999999} step="0.01" required defaultValue={service?.price ?? ""} placeholder="280,00" {...invalid("price")} />{error("price")}</label>
      <label>Preço piso (R$)<input name="floorPrice" type="number" inputMode="decimal" min={0} max={999999} step="0.01" defaultValue={service?.floorPrice || ""} placeholder="195,00" {...invalid("floorPrice")} />{error("floorPrice")}</label>
      <label>Retorno a partir de (dias)<input name="returnMinDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={service?.returnMinDays ?? ""} {...invalid("returnMinDays")} />{error("returnMinDays")}</label>
      <label>Retorno até (dias)<input name="returnMaxDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={service?.returnMaxDays ?? ""} {...invalid("returnMaxDays")} />{error("returnMaxDays")}</label>
      <label className="sv-form-span-2">Serviço de manutenção relacionado<select name="maintenanceServiceId" defaultValue={service?.maintenanceServiceId ?? ""} {...invalid("maintenanceServiceId")}><option value="">Nenhum serviço vinculado</option>{services.filter((item) => item.id !== service?.id).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}</select>{error("maintenanceServiceId")}<span className="sv-field-hint">O retorno pode apontar para outro procedimento do catálogo.</span></label>
      <label>Modalidade *<select name="modality" defaultValue={service?.modality ?? "Studio"} required {...invalid("modality")}><option value="Studio">Studio Cabine</option><option value="Home">Atendimento Domiciliar VIP</option><option value="Ambos">Studio &amp; VIP Home</option></select>{error("modality")}</label>
      <label>Status *<select name="status" defaultValue={service?.status ?? "Ativo"} required {...invalid("status")}><option>Ativo</option><option>Homologação</option><option>Inativo</option></select>{error("status")}</label>
      <label>Valor da manutenção (R$)<input name="maintenancePrice" type="number" inputMode="decimal" min={0.01} max={999999} step="0.01" defaultValue={service?.maintenancePrice ?? ""} {...invalid("maintenancePrice")} />{error("maintenancePrice")}</label>
      <label>Duração da manutenção (min)<input name="maintenanceDurationMinutes" type="number" inputMode="numeric" min={15} max={720} step={5} defaultValue={service?.maintenanceDurationMinutes ?? ""} {...invalid("maintenanceDurationMinutes")} />{error("maintenanceDurationMinutes")}</label>
      <label className="sv-form-span-2">Etiquetas<input name="tags" maxLength={400} defaultValue={service?.tags.join(", ")} placeholder="Separe por vírgulas" {...invalid("tags")} />{error("tags")}</label>
      <label className="sv-form-span-2">Insumos vinculados<textarea name="consumables" rows={3} defaultValue={consumables} placeholder={"Nome | quantidade | custo\nFios Cashmere | 1 chicote | 18,50"} {...invalid("consumables")} />{error("consumables")}<span className="sv-field-hint">Uma linha por insumo. A baixa de estoque será conectada no backend.</span></label>
    </div>
    <div className="sv-form-professionals"><div><strong>Disponibilidade por profissional *</strong><small>Marque quem pode executar este procedimento. Pelo menos um profissional é necessário para serviços ativos.</small></div><div className="sv-professional-options">{draftProfessionals.map((item) => <label className="sv-professional-option" key={item.id}><input name="professionalIds" type="checkbox" value={item.id} checked={selectedProfessionalIds.includes(item.id)} onChange={(event) => { setSelectedProfessionalIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)); clearError("professionalIds"); }} {...invalid("professionalIds")} />{item.name}</label>)}</div>{error("professionalIds")}{canCreateProfessionals && <><div className="sv-add-professional"><input value={newProfessionalName} onChange={(event) => { setNewProfessionalName(event.target.value); setProfessionalError(""); }} placeholder="Nome de outro profissional" aria-label="Nome de outro profissional" maxLength={80} /><button type="button" className="nc-btn nc-btn-soft" onClick={addProfessional}><Icon name="person_add" size={16} />Adicionar profissional</button></div>{professionalError && <span className="nc-field-error" role="alert">{professionalError}</span>}<small className="sv-field-hint">Novos profissionais entram na lista ao salvar o procedimento.</small></>}</div>
    <div className="sv-form-rules"><label className="nc-form-checkbox"><input type="checkbox" name="requiresAnamnesis" defaultChecked={service?.requiresAnamnesis} /> Exigir anamnese prévia</label><label className="nc-form-checkbox"><input type="checkbox" name="requiresPhoto" defaultChecked={service?.requiresPhoto} /> Solicitar foto antes/depois</label><label className="nc-form-checkbox"><input type="checkbox" name="requiresSocialConsent" defaultChecked={service?.requiresSocialConsent} /> Exigir autorização para divulgação</label></div>
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="nc-btn nc-btn-primary" disabled={photoLoading || saving}>{saving ? "Salvando..." : service ? "Salvar alterações" : "Criar procedimento"}</button></div>
  </form>;
}

function ProfessionalManager({ professionals, saving, onCreate, onRename, onToggle }: { professionals: ProfessionalDocument[]; saving: boolean; onCreate: (name: string) => Promise<void>; onRename: (id: string, name: string) => Promise<void>; onToggle: (id: string, active: boolean) => Promise<void> }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const attempt = async (action: () => Promise<void>, success: () => void = () => {}) => {
    setError("");
    try { await action(); success(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a profissional."); }
  };
  return <div className="sv-professional-manager">
    <p>Cadastre as profissionais antes de vinculá-las aos procedimentos. Apenas profissionais ativas aparecem na Agenda.</p>
    <form onSubmit={event => { event.preventDefault(); if (!saving) void attempt(() => onCreate(name), () => setName("")); }}>
      <label>Nome da profissional<input value={name} maxLength={80} onChange={event => { setName(event.target.value); setError(""); }} placeholder="Nome e sobrenome" /></label>
      <button type="submit" className="nc-btn nc-btn-primary" disabled={saving}>Adicionar</button>
    </form>
    {error && <div className="nc-validation-summary" role="alert">{error}</div>}
    <div className="sv-professional-list">{professionals.length ? [...professionals].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR")).map(item => <div key={item.id} className="sv-professional-row">
      {editingId === item.id ? <form onSubmit={event => { event.preventDefault(); if (!saving) void attempt(() => onRename(item.id, editingName), () => setEditingId("")); }}><input aria-label={`Novo nome de ${item.name}`} value={editingName} maxLength={80} onChange={event => setEditingName(event.target.value)} /><button type="submit" className="nc-btn nc-btn-soft" disabled={saving}>Salvar</button><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setEditingId("")} disabled={saving}>Cancelar</button></form> : <><span><strong>{item.name}</strong><small>{item.userUid ? "Conta vinculada · edite em Usuários" : item.active ? "Ativa" : "Inativa"}</small></span>{!item.userUid && <div><button type="button" className="nc-btn nc-btn-quiet" onClick={() => { setEditingId(item.id); setEditingName(item.name); setError(""); }} disabled={saving}>Renomear</button><button type="button" className="nc-btn nc-btn-soft" onClick={() => void attempt(() => onToggle(item.id, !item.active))} disabled={saving}>{item.active ? "Desativar" : "Reativar"}</button></div>}</>}
    </div>) : <p>Nenhuma profissional cadastrada.</p>}</div>
  </div>;
}

function ServiceCard({ service, professionals, selected, onSelect }: { service: ServiceRecord; professionals: ServiceProfessional[]; selected: boolean; onSelect: () => void }) {
  const assigned = professionals.filter((item) => service.professionalIds.includes(item.id));
  return <button type="button" className={`sv-card ${selected ? "sv-card-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
    <span className="sv-card-stripe" /><span className="sv-card-content"><span className="sv-card-top"><span><strong>{service.name}</strong><em>{service.sku}</em><em>{categoryShort[service.category]}</em></span><small className={`sv-status sv-status-${service.status === "Ativo" ? "active" : service.status === "Homologação" ? "review" : "inactive"}`}>{service.status}</small></span>
      <span className="sv-card-description">{service.description || "Sem descrição cadastrada."}</span>
      <span className="sv-attributes"><span><small>Duração</small><strong>{durationLabel(service.durationMinutes)}</strong></span><span><small>Tabela / Piso</small><strong>{currency(service.price)} <i>{service.floorPrice ? `/ ${currency(service.floorPrice)}` : ""}</i></strong></span><span><small>Profissionais</small><strong>{assigned.length ? assigned.length === 1 ? assigned[0].name : `${assigned.length} habilitados` : "Não definido"}</strong></span></span>
      <span className="sv-card-footer"><span><Icon name="place" size={14} />{modalityLabel(service.modality)}{service.returnMinDays ? ` • Retorno: ${returnLabel(service)}` : ""}</span><span className="sv-card-detail">{selected ? "Visualizando Ficha" : "Detalhes"}<Icon name={selected ? "arrow_forward" : "chevron_right"} size={16} /></span></span>
    </span>
  </button>;
}

function ServiceDetail({ service, services, professionals, canManage, canDelete, menuOpen, onMenu, onEdit, onDuplicate, onStatus, onDelete, onToggle }: { service: ServiceRecord; services: ServiceRecord[]; professionals: ServiceProfessional[]; canManage: boolean; canDelete: boolean; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onDuplicate: () => void; onStatus: () => void; onDelete: () => void; onToggle: (key: "requiresAnamnesis" | "requiresPhoto" | "requiresSocialConsent") => void }) {
  const cost = service.consumables.reduce((sum, item) => sum + item.cost, 0);
  const margin = service.consumables.length && service.price > 0 ? (service.price - cost) / service.price * 100 : null;
  const assigned = professionals.filter((item) => service.professionalIds.includes(item.id));
  const maintenance = services.find((item) => item.id === service.maintenanceServiceId);
  return <aside className="sv-detail"><div className="sv-detail-card">
    <div className="sv-detail-header"><div><small>FICHA TÉCNICA DO PROCEDIMENTO</small><h2>{service.name}</h2><p>SKU: {service.sku} • Versão {service.version} ({service.status})</p></div>{canManage && <div className="sv-detail-actions"><button type="button" title="Editar Parâmetros" aria-label="Editar Parâmetros" onClick={onEdit}><Icon name="tune" size={18} /></button><div className="sv-menu-wrap"><button type="button" title="Mais opções" aria-label="Mais opções" aria-expanded={menuOpen} onClick={onMenu}><Icon name="more_vert" size={18} /></button>{menuOpen && <div className="sv-menu"><button type="button" onClick={onEdit}><Icon name="edit" size={16} /> Editar procedimento</button><button type="button" onClick={onDuplicate}><Icon name="content_copy" size={16} /> Duplicar como rascunho</button><button type="button" onClick={onStatus}><Icon name={service.status === "Inativo" ? "check_circle" : "block"} size={16} /> {service.status === "Inativo" ? "Reativar" : "Desativar"}</button>{canDelete && <button type="button" className="sv-menu-delete" onClick={onDelete}><Icon name="delete" size={16} /> Excluir procedimento</button>}</div>}</div></div>}</div>
    <div className={`sv-hero ${service.imageUrl ? "sv-hero-image" : ""}`}>{service.imageUrl && <img className="sv-hero-photo" src={service.imageUrl} alt={`Foto do procedimento ${service.name}`} />}<div><small>APRESENTAÇÃO DO SERVIÇO</small><strong>{service.heroSubtitle || service.name}</strong></div><Link href="/precificacao">Simular Preço <Icon name="arrow_outward" size={14} /></Link></div>
    <section className="sv-detail-section sv-availability"><div className="sv-section-heading"><strong><Icon name="groups" size={18} />Agenda e disponibilidade</strong></div><div className="sv-availability-facts"><span><small>Duração</small><strong>{durationLabel(service.durationMinutes)} + {service.bufferMinutes} min de intervalo</strong></span><span><small>Modalidade</small><strong>{modalityLabel(service.modality)}</strong></span></div><div className="sv-professional-chips"><small>Profissionais habilitados</small><div>{assigned.length ? assigned.map((item) => <span key={item.id}>{item.name}</span>) : <em>Nenhum profissional definido</em>}</div></div>{service.status === "Ativo" && assigned.length > 0 && <Link className="sv-book-service" href={newAgendaHref({ serviceId: service.id, professionalId: assigned[0].id })}>Agendar este serviço <Icon name="arrow_forward" size={14} /></Link>}</section>
    <section className="sv-detail-section"><div className="sv-section-heading"><strong><Icon name="inventory_2" size={18} />Insumos do procedimento</strong><small>Custo: {service.consumables.length ? currency(cost) : "a calcular"}</small></div><div className="sv-consumables">{service.consumables.length ? service.consumables.map((item, index) => <div key={`${item.name}-${index}`}><i /><span><strong>{item.name}</strong><small>{item.quantity}</small></span><b>{currency(item.cost)}</b></div>) : <p>Sem insumos vinculados. Use “Editar Parâmetros” para adicionar.</p>}</div><div className="sv-margin-note"><span>Margem preliminar após insumos</span><strong>{margin === null ? "a calcular" : `${margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</strong></div><small className="sv-margin-help">Considera o preço de tabela e apenas os insumos cadastrados. Outros custos serão tratados em Precificação.</small></section>
    <section className="sv-detail-section sv-consent"><div className="sv-section-heading"><strong><Icon name="verified_user" size={18} />Requisitos do atendimento</strong></div><label><input type="checkbox" checked={service.requiresAnamnesis} disabled={!canManage} onChange={() => onToggle("requiresAnamnesis")} />Exigir anamnese prévia neste procedimento.</label><label><input type="checkbox" checked={service.requiresPhoto} disabled={!canManage} onChange={() => onToggle("requiresPhoto")} />Solicitar foto antes/depois no atendimento, com consentimento.</label><label><input type="checkbox" checked={service.requiresSocialConsent} disabled={!canManage} onChange={() => onToggle("requiresSocialConsent")} />Exigir autorização para divulgação, por sessão.</label><small className="sv-clinical-help">Fotos e consentimentos da cliente são registrados no atendimento; estas opções apenas configuram o requisito.</small></section>
    <div className="sv-maintenance"><Icon name="sync" size={20} /><span><strong>Retorno e manutenção</strong><small>{maintenance ? `${maintenance.name} • ${returnLabel(service)}` : service.returnMinDays ? `Retorno recomendado: ${returnLabel(service)}` : "Nenhum serviço de manutenção vinculado"}</small>{service.maintenancePrice && service.maintenanceDurationMinutes && <small>Referência de retoque: {currency(service.maintenancePrice)} • {service.maintenanceDurationMinutes} min</small>}</span><em>{maintenance ? "Vinculado" : "Opcional"}</em></div>
    <div className="sv-detail-footer"><span><Icon name="history" size={14} /> Atualizado em {formatDate(service.updatedAt)}</span><span>Salvo no Firestore</span></div>
  </div></aside>;
}

export default function ServicesPage() {
  const { profile, user } = useAuth();
  const canManage = Boolean(profile?.permissions.includes("services.write"));
  const canManageProfessionals = Boolean(profile?.permissions.includes("professionals.write"));
  const repositories = useMemo(() => profile ? createFirebaseRepositories(getFirebaseClient().db, profile.clinicId) : null, [profile]);
  const [serviceDocuments, setServiceDocuments] = useState<ServiceDocument[]>([]);
  const [professionalDocuments, setProfessionalDocuments] = useState<ProfessionalDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(true);
  const [serviceImageUrl, setServiceImageUrl] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("Todos");
  const [modality, setModality] = useState<ModalityFilter>("Todas");
  const [professionalFilter, setProfessionalFilter] = useState("Todos");
  const [status, setStatus] = useState<StatusFilter>("Ativo");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [linkedServiceId, setLinkedServiceId] = useState("");
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | "professionals" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const serviceId = new URLSearchParams(window.location.search).get("serviceId");
    if (serviceId) { setSelectedId(serviceId); setLinkedServiceId(serviceId); setStatus("Todos"); }
  }, []);

  useEffect(() => {
    if (!repositories) return;
    setLoaded(false); setLoadError("");
    let servicesReady = false;
    let professionalsReady = false;
    const ready = () => { if (servicesReady && professionalsReady) setLoaded(true); };
    const onError = () => { setLoadError("Não foi possível carregar o catálogo do Firestore. Recarregue a página."); setLoaded(false); };
    const stopServices = repositories.services.subscribe(items => { setServiceDocuments(items); servicesReady = true; ready(); }, onError);
    const stopProfessionals = repositories.professionals.subscribe(items => { setProfessionalDocuments(items); professionalsReady = true; ready(); }, onError);
    return () => { stopServices(); stopProfessionals(); };
  }, [repositories]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setDriveLoading(true);
    navyApi(user, "/api/drive/status").then(response => response.json()).then((value: { connected: boolean }) => { if (active) { setDriveConnected(value.connected); setDriveLoading(false); } }).catch(() => { if (active) { setDriveConnected(false); setDriveLoading(false); } });
    return () => { active = false; };
  }, [user]);
  const services: ServiceRecord[] = useMemo(() => serviceDocuments.map(item => ({ ...item, imageUrl: undefined })), [serviceDocuments]);
  const professionals: ServiceProfessional[] = useMemo(() => professionalDocuments.filter(item => item.active).map(item => ({ id: item.id, name: item.name })), [professionalDocuments]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4000); return () => window.clearTimeout(timer); }, [toast]);

  const active = useMemo(() => services.filter((item) => item.status === "Ativo"), [services]);
  const statusServices = useMemo(() => status === "Todos" ? services : services.filter((item) => item.status === status), [services, status]);
  const filtered = useMemo(() => statusServices.filter((item) => {
    if (category !== "Todos" && item.category !== category) return false;
    if (modality !== "Todas" && item.modality !== "Ambos" && item.modality !== modality) return false;
    if (professionalFilter !== "Todos" && !item.professionalIds.includes(professionalFilter)) return false;
    const term = normalise(query.trim());
    return !term || normalise(`${item.name} ${item.sku} ${item.description} ${item.tags.join(" ")} ${item.consumables.map((part) => part.name).join(" ")}`).includes(term);
  }), [statusServices, category, modality, professionalFilter, query]);
  const linkedServiceMissing = Boolean(loaded && linkedServiceId && !serviceDocuments.some(item => item.id === linkedServiceId));
  const selected = linkedServiceMissing ? null : filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const selectedDocument = serviceDocuments.find(item => item.id === selected?.id);
  useEffect(() => {
    if (!user || !selectedDocument?.imageDriveFileId || !driveConnected) { setServiceImageUrl(""); return; }
    let active = true;
    let url = "";
    navyApi(user, `/api/services/${selectedDocument.id}/image`).then(response => response.blob()).then(blob => {
      url = URL.createObjectURL(blob);
      if (active) setServiceImageUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setServiceImageUrl(""); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); setServiceImageUrl(""); };
  }, [user, selectedDocument?.id, selectedDocument?.imageDriveFileId, driveConnected]);
  const highest = [...active].sort((a, b) => b.price - a.price)[0];
  const averageDuration = active.length ? Math.round(active.reduce((sum, item) => sum + item.durationMinutes, 0) / active.length) : 0;
  const activeCategories = new Set(active.map((item) => item.category)).size;
  const withReturn = active.filter((item) => item.returnMinDays && item.returnMaxDays).length;

  const reportError = (error: unknown) => setToast(error instanceof Error ? error.message : "Não foi possível salvar no Firestore.");
  const professionalName = (raw: string, currentId?: string) => {
    const name = raw.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 80) throw new Error("Informe um nome com 3 a 80 caracteres.");
    if (professionalDocuments.some(item => item.id !== currentId && normalise(item.name) === normalise(name))) throw new Error("Já existe uma profissional com este nome.");
    return name;
  };
  const createProfessional = async (raw: string) => {
    if (!repositories || !canManageProfessionals || saving) return;
    const name = professionalName(raw);
    setSaving(true);
    try { await repositories.professionals.save({ id: crypto.randomUUID(), name, active: true }); setToast("Profissional cadastrada no Firestore."); }
    finally { setSaving(false); }
  };
  const renameProfessional = async (id: string, raw: string) => {
    if (!repositories || !canManageProfessionals || saving) return;
    const name = professionalName(raw, id);
    setSaving(true);
    try { await repositories.professionals.update(id, { name }); setToast("Nome da profissional atualizado."); }
    finally { setSaving(false); }
  };
  const toggleProfessional = async (id: string, active: boolean) => {
    if (!repositories || !canManageProfessionals || saving) return;
    setSaving(true);
    try {
      if (!active) {
        if (serviceDocuments.some(item => item.status === "Ativo" && item.professionalIds.includes(id))) throw new Error("Retire esta profissional dos serviços ativos antes de desativá-la.");
        const appointments = await repositories.appointments.list();
        if (appointments.some(item => item.professionalId === id && item.status !== "Cancelado" && item.date >= today())) throw new Error("Cancele ou reagende os compromissos futuros desta profissional antes de desativá-la.");
      }
      await repositories.professionals.update(id, { active });
      setToast(active ? "Profissional reativada." : "Profissional desativada.");
    }
    finally { setSaving(false); }
  };
  const saveService = async (input: ServiceInput, addedProfessionals: ServiceProfessional[], image: File | null, removeImage: boolean) => {
    if (!profile || !repositories || !canManage || saving) return;
    setSaving(true);
    let savedId = "";
    try {
      const editing = dialog === "edit" && selected;
      const id = editing ? selected.id : crypto.randomUUID();
      const previous = editing ? serviceDocuments.find(item => item.id === id) : undefined;
      const item: ServiceDocument = {
        ...input, id, sku: editing ? selected.sku : nextSku(input.category, services),
        heroSubtitle: input.name,
        version: editing ? (Number(selected.version) + 0.1).toFixed(1) : "1.0",
        updatedAt: today(),
        ...(previous?.imageDriveFileId ? { imageDriveFileId: previous.imageDriveFileId } : {}),
      };
      const batch = writeBatch(getFirebaseClient().db);
      for (const professional of addedProfessionals) batch.set(doc(getFirebaseClient().db, "clinics", profile.clinicId, "professionals", professional.id), { name: professional.name, active: true });
      const { id: documentId, ...data } = item;
      batch.set(doc(getFirebaseClient().db, "clinics", profile.clinicId, "services", documentId), JSON.parse(JSON.stringify(data)));
      await batch.commit();
      savedId = id;
      setDialog(null);
      if (!editing) { setStatus(input.status); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setQuery(""); setSelectedId(id); setLinkedServiceId(""); }
      if (image) {
        const form = new FormData(); form.set("file", image);
        await navyApi(user!, `/api/services/${id}/image`, { method: "POST", body: form });
      } else if (removeImage && previous?.imageDriveFileId) {
        await navyApi(user!, `/api/services/${id}/image`, { method: "DELETE" });
      }
      setToast(editing ? "Procedimento atualizado no Firestore." : "Procedimento criado no Firestore.");
    } catch (error) {
      setToast(savedId ? "Procedimento salvo no Firestore, mas a imagem não foi atualizada. Tente novamente." : error instanceof Error ? error.message : "Não foi possível salvar no Firestore.");
    } finally { setSaving(false); }
  };
  const duplicate = async () => {
    if (!selected || !repositories || !canManage || saving) return;
    const original = serviceDocuments.find(item => item.id === selected.id);
    if (!original) return;
    const id = crypto.randomUUID();
    const baseName = `Cópia de ${selected.name}`;
    let copyName = baseName;
    let suffix = 2;
    while (services.some((item) => item.category === selected.category && normalise(item.name) === normalise(copyName))) copyName = `${baseName} (${suffix++})`;
    const { imageDriveFileId: _image, ...fields } = original;
    const copy: ServiceDocument = { ...fields, id, sku: nextSku(selected.category, services), name: copyName, heroSubtitle: copyName, status: "Homologação", version: "1.0", updatedAt: today() };
    setSaving(true);
    try { await repositories.services.save(copy); setStatus("Homologação"); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setQuery(""); setSelectedId(id); setLinkedServiceId(""); setMenuOpen(false); setToast("Rascunho duplicado no Firestore."); }
    catch (error) { reportError(error); }
    finally { setSaving(false); }
  };
  const toggleStatus = async () => {
    if (!selected || !repositories || !canManage || saving) return;
    const next = selected.status === "Inativo" ? "Ativo" : "Inativo";
    if (next === "Ativo" && !selected.professionalIds.some((id) => professionals.some((professional) => professional.id === id))) {
      setMenuOpen(false);
      setDialog("edit");
      setToast("Selecione um profissional antes de reativar este procedimento.");
      return;
    }
    setSaving(true);
    try { await repositories.services.update(selected.id, { status: next, updatedAt: today() }); setMenuOpen(false); setToast(next === "Ativo" ? "Procedimento reativado. O filtro atual foi mantido." : "Procedimento desativado. O filtro atual foi mantido."); }
    catch (error) { reportError(error); }
    finally { setSaving(false); }
  };
  const toggleRule = async (key: "requiresAnamnesis" | "requiresPhoto" | "requiresSocialConsent") => {
    if (!selected || !repositories || !canManage || saving) return;
    setSaving(true);
    try { await repositories.services.update(selected.id, { [key]: !selected[key], updatedAt: today() }); setToast("Regra atualizada no Firestore."); }
    catch (error) { reportError(error); }
    finally { setSaving(false); }
  };
  const deleteService = async () => {
    if (!selected || !repositories || !profile || !profile.permissions.includes("services.delete") || saving) return;
    setSaving(true);
    try {
      const [sessions, appointments] = await Promise.all([repositories.sessions.list(), repositories.appointments.list()]);
      if (sessions.some(item => item.serviceId === selected.id) || appointments.some(item => item.lines.some(line => line.serviceId === selected.id))) throw new Error("Este procedimento já consta em atendimentos. Desative-o para preservar o histórico.");
      const linked = serviceDocuments.filter(item => item.maintenanceServiceId === selected.id);
      if (linked.length > 498) throw new Error("Há muitos procedimentos vinculados. Contate a administração.");
      if (selectedDocument?.imageDriveFileId) await navyApi(user!, `/api/services/${selected.id}/image`, { method: "DELETE" });
      const batch = writeBatch(getFirebaseClient().db);
      batch.delete(doc(getFirebaseClient().db, "clinics", profile.clinicId, "services", selected.id));
      for (const item of linked) {
        const { id, imageDriveFileId, maintenanceServiceId, ...fields } = item;
        batch.set(doc(getFirebaseClient().db, "clinics", profile.clinicId, "services", id), JSON.parse(JSON.stringify({ ...fields, ...(imageDriveFileId ? { imageDriveFileId } : {}), updatedAt: today() })));
      }
      await batch.commit();
      setSelectedId(""); setDialog(null); setMenuOpen(false); setToast("Procedimento excluído do Firestore.");
    } catch (error) { reportError(error); }
    finally { setSaving(false); }
  };
  const exportCsv = () => {
    const columns = ["SKU", "Procedimento", "Categoria", "Status", "Duração (min)", "Intervalo (min)", "Preço (R$)", "Piso (R$)", "Retorno mínimo (dias)", "Retorno máximo (dias)", "Modalidade", "Profissionais habilitados", "Serviço de manutenção"];
    const rows = filtered.map((item) => [item.sku, item.name, item.category, item.status, String(item.durationMinutes), String(item.bufferMinutes), item.price.toFixed(2), item.floorPrice.toFixed(2), String(item.returnMinDays ?? ""), String(item.returnMaxDays ?? ""), modalityLabel(item.modality), professionals.filter((professional) => item.professionalIds.includes(professional.id)).map((professional) => professional.name).join(", "), services.find((service) => service.id === item.maintenanceServiceId)?.name ?? ""]);
    const csv = `\uFEFF${[columns, ...rows].map((row) => row.map((value) => `"${/^[=+@\-\t\r]/.test(value) ? "'" : ""}${value.replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "navy-servicos.csv"; link.click(); URL.revokeObjectURL(url);
    setToast(`${filtered.length} procedimento(s) exportado(s) da visualização atual.`);
  };

  return <div className="sv-page" onClick={(event) => { if (menuOpen && !(event.target as HTMLElement).closest(".sv-menu-wrap")) setMenuOpen(false); }}>
    <div className="sv-heading"><div><div className="sv-eyebrow">SERVIÇOS <Icon name="chevron_right" size={13} /> <strong>GESTÃO DO PORTFÓLIO</strong></div><h1>Catálogo de Procedimentos</h1><p>Configure categorias, durações clínicas, regras de manutenção preventiva e insumos vinculados com rastreabilidade de custos.</p></div><div className="sv-heading-actions"><button type="button" className="sv-btn sv-btn-soft" onClick={exportCsv} disabled={!loaded || Boolean(loadError)}><Icon name="file_download" size={17} />Exportar Tabela</button>{canManageProfessionals && <button type="button" className="sv-btn sv-btn-soft" onClick={() => setDialog("professionals")} disabled={!loaded || Boolean(loadError)}><Icon name="groups" size={17} />Profissionais ({professionals.length})</button>}{canManage && <button type="button" className="sv-btn sv-btn-primary" onClick={() => setDialog("create")} disabled={!loaded || Boolean(loadError)}><Icon name="add" size={18} />+ Novo Procedimento</button>}</div></div>
    {loadError && <div className="nc-validation-summary" role="alert">{loadError}</div>}
    {linkedServiceMissing && <div className="nc-validation-summary" role="status">O serviço vinculado a este atendimento não está mais no catálogo. Os dados do agendamento continuam na Agenda.</div>}
    <div className="sv-stats"><div><span>SERVIÇOS ATIVOS</span><strong>{active.length}</strong><small><i />Em {activeCategories} {activeCategories === 1 ? "categoria" : "categorias"}</small><Icon name="spa" size={22} /></div><div><span>DURAÇÃO MÉDIA</span><strong>{averageDuration}<em> min</em></strong><small><Icon name="schedule" size={13} /> Dos procedimentos ativos</small><Icon name="timer" size={22} /></div><div><span>MAIOR PREÇO DE TABELA</span><strong>{highest ? currency(highest.price) : "—"}</strong><small>{highest?.name ?? "Nenhum procedimento"}</small><Icon name="payments" size={22} /></div><div><span>COM RETORNO PREVISTO</span><strong>{withReturn}</strong><small><Icon name="event_repeat" size={13} /> Com prazo cadastrado</small><Icon name="autorenew" size={22} /></div></div>
    <div className="sv-toolbar"><div className="sv-category-tabs" role="group" aria-label="Filtrar por categoria">{(["Todos", ...serviceCategories] as CategoryFilter[]).map((item) => <button key={item} type="button" aria-pressed={category === item} className={category === item ? "sv-filter-active" : ""} onClick={() => setCategory(item)}>{item} ({item === "Todos" ? statusServices.length : statusServices.filter((service) => service.category === item).length})</button>)}</div><div className="sv-filter-row"><label className="sv-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome do procedimento, código SKU ou insumo..." aria-label="Buscar procedimentos" /></label><select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)} aria-label="Filtrar profissional"><option value="Todos">Todos os profissionais</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={modality} onChange={(event) => setModality(event.target.value as ModalityFilter)} aria-label="Filtrar modalidade"><option value="Todas">Todas as modalidades</option><option value="Studio">Apenas Cabine Studio</option><option value="Home">Atendimento Domiciliar VIP</option></select><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filtrar status"><option value="Ativo">Apenas Ativos ({active.length})</option><option value="Homologação">Em Homologação ({services.filter((item) => item.status === "Homologação").length})</option><option value="Inativo">Inativos ({services.filter((item) => item.status === "Inativo").length})</option><option value="Todos">Todos os status ({services.length})</option></select></div></div>
    <div className="sv-columns"><div className="sv-list">{!loaded && !loadError ? <ContentSkeleton label="Carregando procedimentos" rows={3} /> : filtered.length ? filtered.map((item) => <ServiceCard key={item.id} service={item} professionals={professionals} selected={item.id === selected?.id} onSelect={() => { setSelectedId(item.id); setLinkedServiceId(""); setMenuOpen(false); }} />) : <div className="sv-empty"><Icon name="search_off" size={26} /><strong>{services.length ? "Nenhum procedimento encontrado" : "Nenhum procedimento cadastrado"}</strong><p>{services.length ? "Experimente outra busca ou ajuste os filtros." : "Crie o primeiro procedimento para montar o catálogo."}</p>{services.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setStatus("Ativo"); }}>Limpar filtros</button>}</div>}</div>{selected && <ServiceDetail service={{ ...selected, imageUrl: serviceImageUrl }} services={services} professionals={professionals} canManage={canManage} canDelete={Boolean(profile?.permissions.includes("services.delete"))} menuOpen={menuOpen} onMenu={() => setMenuOpen((current) => !current)} onEdit={() => { setMenuOpen(false); setDialog("edit"); }} onDuplicate={() => void duplicate()} onStatus={() => void toggleStatus()} onDelete={() => { setMenuOpen(false); setDialog("delete"); }} onToggle={(key) => void toggleRule(key)} />}</div>
    {(dialog === "create" || dialog === "edit") && <ContentDialog title={dialog === "create" ? "Novo Procedimento" : "Editar Parâmetros do Procedimento"} wide onClose={() => { if (!saving) setDialog(null); }}><ServiceForm key={dialog === "edit" ? selected?.id : "new"} service={dialog === "edit" && selected ? { ...selected, imageUrl: serviceImageUrl } : undefined} services={services} professionals={professionals} knownProfessionals={professionalDocuments} canCreateProfessionals={canManageProfessionals} saving={saving} driveConnected={driveConnected} driveLoading={driveLoading} onSave={(input, added, image, remove) => void saveService(input, added, image, remove)} onClose={() => setDialog(null)} /></ContentDialog>}
    {dialog === "professionals" && <ContentDialog title="Profissionais" onClose={() => { if (!saving) setDialog(null); }}><ProfessionalManager professionals={professionalDocuments} saving={saving} onCreate={createProfessional} onRename={renameProfessional} onToggle={toggleProfessional} /></ContentDialog>}
    {dialog === "delete" && selected && <ContentDialog title="Excluir Procedimento" onClose={() => { if (!saving) setDialog(null); }}><div className="nc-form sv-delete-confirm"><p>Excluir <strong>{selected.name}</strong> ({selected.sku}) do Firestore?</p><p>Se já foi usado em atendimentos, o histórico será preservado e você poderá desativar o procedimento.</p><div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setDialog(null)} disabled={saving}>Cancelar</button><button type="button" className="nc-btn nc-btn-danger" onClick={() => void deleteService()} disabled={saving}>{saving ? "Excluindo..." : "Excluir procedimento"}</button></div></div></ContentDialog>}
    {toast && <div className="nc-toast" role="status">{toast}</div>}
  </div>;
}
