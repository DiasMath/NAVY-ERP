"use client";

import Link from "next/link";
import { newAgendaHref } from "@/features/agenda/agenda-links";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import ContentDialog from "@/components/ContentDialog";
import { categoryPrefixes, durationLabel, initialServiceProfessionals, initialServices, modalityLabel, serviceCategories, serviceProfessionalsStorageKey, serviceStorageKey, type ServiceCategory, type ServiceModality, type ServiceProfessional, type ServiceRecord, type ServiceStatus } from "./service-data";
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
    canvas.width = 960;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto neste navegador.");
    const targetRatio = canvas.width / canvas.height;
    const sourceRatio = bitmap.width / bitmap.height;
    const width = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
    const height = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
    context.drawImage(bitmap, (bitmap.width - width) / 2, (bitmap.height - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.76);
  } finally {
    bitmap.close();
  }
}

function ServiceForm({ service, services, professionals, onSave, onClose }: { service?: ServiceRecord; services: ServiceRecord[]; professionals: ServiceProfessional[]; onSave: (input: ServiceInput, addedProfessionals: ServiceProfessional[]) => void; onClose: () => void }) {
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [category, setCategory] = useState<ServiceCategory>(service?.category ?? serviceCategories[0]);
  const [sku, setSku] = useState(service?.sku ?? nextSku(serviceCategories[0], services));
  const [draftProfessionals, setDraftProfessionals] = useState<ServiceProfessional[]>(professionals);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>(service?.professionalIds ?? (professionals[0] ? [professionals[0].id] : []));
  const [newProfessionalName, setNewProfessionalName] = useState("");
  const [professionalError, setProfessionalError] = useState("");
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const addProfessional = () => {
    const name = newProfessionalName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 80) { setProfessionalError("Informe um nome com 3 a 80 caracteres."); return; }
    if (draftProfessionals.some((item) => normalise(item.name) === normalise(name))) { setProfessionalError("Este profissional já está na lista."); return; }
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
    try { setImageUrl(await prepareServicePhoto(file)); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : "Não foi possível abrir a foto."); }
    finally { setPhotoLoading(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (photoLoading) return;
    const result = validateService(new FormData(event.currentTarget), services, draftProfessionals.map((item) => item.id), service?.id, imageUrl || undefined);
    setErrors(result.errors);
    const first = Object.keys(result.errors)[0] as ServiceField | undefined;
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    onSave(result.input, draftProfessionals.filter((item) => !professionals.some((saved) => saved.id === item.id)));
  };
  const clearError = (field: string) => { if (field in errors) setErrors((current) => ({ ...current, [field]: undefined })); };
  const error = (field: ServiceField) => errors[field] ? <span className="nc-field-error" id={`sv-error-${field}`}>{errors[field]}</span> : null;
  const invalid = (field: ServiceField) => ({ "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `sv-error-${field}` : undefined });
  const consumables = service?.consumables.map((item) => `${item.name} | ${item.quantity} | ${item.cost.toFixed(2)}`).join("\n") ?? "";
  return <form className="nc-form sv-form" noValidate onSubmit={submit} onChange={(event) => clearError(event.target.getAttribute("name") ?? "")}>
    <p>Dados desta prévia ficam somente neste navegador. <strong>* Campos obrigatórios; os demais são opcionais.</strong></p>
    {Object.values(errors).some(Boolean) && <div className="nc-validation-summary" role="alert">Revise os campos destacados antes de salvar.</div>}
    <div className="sv-photo-field"><div className={`sv-photo-preview ${imageUrl ? "sv-photo-has-image" : ""}`}>{imageUrl ? <img src={imageUrl} alt="Prévia da imagem de apresentação do serviço" /> : <Icon name="add_photo_alternate" size={30} />}</div><div className="sv-photo-info"><strong>Imagem de apresentação do serviço</strong><span>Exibida na ficha técnica; fotos antes/depois ficam no atendimento. JPG, PNG ou WebP, até 8 MB.</span><div className="sv-photo-actions"><button type="button" className="nc-btn nc-btn-soft" disabled={photoLoading} onClick={() => photoInputRef.current?.click()}><Icon name="photo_camera" size={16} />{imageUrl ? "Trocar foto" : "Adicionar foto"}</button>{imageUrl && <button type="button" className="nc-btn nc-btn-quiet" onClick={() => { setImageUrl(""); setPhotoError(""); }}>Remover</button>}</div><input ref={photoInputRef} className="nc-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagem de apresentação do serviço" onChange={onPhotoChange} /></div></div>
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
    <div className="sv-form-professionals"><div><strong>Disponibilidade por profissional *</strong><small>Marque quem pode executar este procedimento. Pelo menos um profissional é necessário para serviços ativos.</small></div><div className="sv-professional-options">{draftProfessionals.map((item) => <label className="sv-professional-option" key={item.id}><input name="professionalIds" type="checkbox" value={item.id} checked={selectedProfessionalIds.includes(item.id)} onChange={(event) => { setSelectedProfessionalIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)); clearError("professionalIds"); }} {...invalid("professionalIds")} />{item.name}</label>)}</div>{error("professionalIds")}<div className="sv-add-professional"><input value={newProfessionalName} onChange={(event) => { setNewProfessionalName(event.target.value); setProfessionalError(""); }} placeholder="Nome de outro profissional" aria-label="Nome de outro profissional" maxLength={80} /><button type="button" className="nc-btn nc-btn-soft" onClick={addProfessional}><Icon name="person_add" size={16} />Adicionar profissional</button></div>{professionalError && <span className="nc-field-error" role="alert">{professionalError}</span>}<small className="sv-field-hint">Novos profissionais entram na lista ao salvar o procedimento.</small></div>
    <div className="sv-form-rules"><label className="nc-form-checkbox"><input type="checkbox" name="requiresAnamnesis" defaultChecked={service?.requiresAnamnesis} /> Exigir anamnese prévia</label><label className="nc-form-checkbox"><input type="checkbox" name="requiresPhoto" defaultChecked={service?.requiresPhoto} /> Solicitar foto antes/depois</label><label className="nc-form-checkbox"><input type="checkbox" name="requiresSocialConsent" defaultChecked={service?.requiresSocialConsent} /> Exigir autorização para divulgação</label></div>
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="nc-btn nc-btn-primary" disabled={photoLoading}>{service ? "Salvar alterações" : "Criar procedimento"}</button></div>
  </form>;
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

function ServiceDetail({ service, services, professionals, menuOpen, onMenu, onEdit, onDuplicate, onStatus, onDelete, onToggle }: { service: ServiceRecord; services: ServiceRecord[]; professionals: ServiceProfessional[]; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onDuplicate: () => void; onStatus: () => void; onDelete: () => void; onToggle: (key: "requiresAnamnesis" | "requiresPhoto" | "requiresSocialConsent") => void }) {
  const cost = service.consumables.reduce((sum, item) => sum + item.cost, 0);
  const margin = service.consumables.length && service.price > 0 ? (service.price - cost) / service.price * 100 : null;
  const assigned = professionals.filter((item) => service.professionalIds.includes(item.id));
  const maintenance = services.find((item) => item.id === service.maintenanceServiceId);
  return <aside className="sv-detail"><div className="sv-detail-card">
    <div className="sv-detail-header"><div><small>FICHA TÉCNICA DO PROCEDIMENTO</small><h2>{service.name}</h2><p>SKU: {service.sku} • Versão {service.version} ({service.status})</p></div><div className="sv-detail-actions"><button type="button" title="Editar Parâmetros" aria-label="Editar Parâmetros" onClick={onEdit}><Icon name="tune" size={18} /></button><div className="sv-menu-wrap"><button type="button" title="Mais opções" aria-label="Mais opções" aria-expanded={menuOpen} onClick={onMenu}><Icon name="more_vert" size={18} /></button>{menuOpen && <div className="sv-menu"><button type="button" onClick={onEdit}><Icon name="edit" size={16} /> Editar procedimento</button><button type="button" onClick={onDuplicate}><Icon name="content_copy" size={16} /> Duplicar como rascunho</button><button type="button" onClick={onStatus}><Icon name={service.status === "Inativo" ? "check_circle" : "block"} size={16} /> {service.status === "Inativo" ? "Reativar" : "Desativar"}</button><button type="button" className="sv-menu-delete" onClick={onDelete}><Icon name="delete" size={16} /> Excluir procedimento</button></div>}</div></div></div>
    <div className={`sv-hero ${service.imageUrl ? "sv-hero-image" : ""}`} style={service.imageUrl ? { backgroundImage: `linear-gradient(0deg,rgba(22,28,33,.78),rgba(22,28,33,.03) 70%),url('${service.imageUrl}')` } : undefined}><div><small>APRESENTAÇÃO DO SERVIÇO</small><strong>{service.heroSubtitle || service.name}</strong></div><Link href="/precificacao">Simular Preço <Icon name="arrow_outward" size={14} /></Link></div>
    <section className="sv-detail-section sv-availability"><div className="sv-section-heading"><strong><Icon name="groups" size={18} />Agenda e disponibilidade</strong></div><div className="sv-availability-facts"><span><small>Duração</small><strong>{durationLabel(service.durationMinutes)} + {service.bufferMinutes} min de intervalo</strong></span><span><small>Modalidade</small><strong>{modalityLabel(service.modality)}</strong></span></div><div className="sv-professional-chips"><small>Profissionais habilitados</small><div>{assigned.length ? assigned.map((item) => <span key={item.id}>{item.name}</span>) : <em>Nenhum profissional definido</em>}</div></div>{service.status === "Ativo" && assigned.length > 0 && <Link className="sv-book-service" href={newAgendaHref({ serviceId: service.id })}><Icon name="event_available" size={16} /> Agendar este serviço <Icon name="arrow_forward" size={15} /></Link>}</section>
    <section className="sv-detail-section"><div className="sv-section-heading"><strong><Icon name="inventory_2" size={18} />Insumos do procedimento</strong><small>Custo: {service.consumables.length ? currency(cost) : "a calcular"}</small></div><div className="sv-consumables">{service.consumables.length ? service.consumables.map((item, index) => <div key={`${item.name}-${index}`}><i /><span><strong>{item.name}</strong><small>{item.quantity}</small></span><b>{currency(item.cost)}</b></div>) : <p>Sem insumos vinculados nesta prévia. Use “Editar Parâmetros” para adicionar.</p>}</div><div className="sv-margin-note"><span>Margem preliminar após insumos</span><strong>{margin === null ? "a calcular" : `${margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</strong></div><small className="sv-margin-help">Considera o preço de tabela e apenas os insumos cadastrados. Outros custos serão tratados em Precificação.</small></section>
    <section className="sv-detail-section sv-consent"><div className="sv-section-heading"><strong><Icon name="verified_user" size={18} />Requisitos do atendimento</strong></div><label><input type="checkbox" checked={service.requiresAnamnesis} onChange={() => onToggle("requiresAnamnesis")} />Exigir anamnese prévia neste procedimento.</label><label><input type="checkbox" checked={service.requiresPhoto} onChange={() => onToggle("requiresPhoto")} />Solicitar foto antes/depois no atendimento, com consentimento.</label><label><input type="checkbox" checked={service.requiresSocialConsent} onChange={() => onToggle("requiresSocialConsent")} />Exigir autorização para divulgação, por sessão.</label><small className="sv-clinical-help">Fotos e consentimentos da cliente são registrados no atendimento; estas opções apenas configuram o requisito.</small></section>
    <div className="sv-maintenance"><Icon name="sync" size={20} /><span><strong>Retorno e manutenção</strong><small>{maintenance ? `${maintenance.name} • ${returnLabel(service)}` : service.returnMinDays ? `Retorno recomendado: ${returnLabel(service)}` : "Nenhum serviço de manutenção vinculado"}</small>{service.maintenancePrice && service.maintenanceDurationMinutes && <small>Referência de retoque: {currency(service.maintenancePrice)} • {service.maintenanceDurationMinutes} min</small>}</span><em>{maintenance ? "Vinculado" : "Opcional"}</em></div>
    <div className="sv-detail-footer"><span><Icon name="history" size={14} /> Atualizado em {formatDate(service.updatedAt)}</span><span>Prévia local do catálogo</span></div>
  </div></aside>;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>(initialServices);
  const [professionals, setProfessionals] = useState<ServiceProfessional[]>(initialServiceProfessionals);
  const [hydrated, setHydrated] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("Todos");
  const [modality, setModality] = useState<ModalityFilter>("Todas");
  const [professionalFilter, setProfessionalFilter] = useState("Todos");
  const [status, setStatus] = useState<StatusFilter>("Ativo");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("cil-002");
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(serviceStorageKey) ?? "null");
      if (Array.isArray(saved) && saved.every((item) => item && typeof item.id === "string" && typeof item.sku === "string" && typeof item.name === "string" && typeof item.durationMinutes === "number" && Array.isArray(item.consumables))) setServices(saved.map((item) => {
        const legacy = !Array.isArray(item.professionalIds);
        return { ...item, professionalIds: legacy ? [initialServiceProfessionals[0].id] : item.professionalIds.filter((id: unknown) => typeof id === "string"), maintenanceServiceId: legacy && item.id === "cil-002" && !item.maintenanceServiceId ? "cil-005" : item.maintenanceServiceId } as ServiceRecord;
      }));
      const savedProfessionals = JSON.parse(localStorage.getItem(serviceProfessionalsStorageKey) ?? "null");
      if (Array.isArray(savedProfessionals) && savedProfessionals.length && savedProfessionals.every((item) => item && typeof item.id === "string" && typeof item.name === "string")) setProfessionals(savedProfessionals as ServiceProfessional[]);
    } catch { /* A prévia continua com os dados ilustrativos. */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) { try { localStorage.setItem(serviceStorageKey, JSON.stringify(services)); localStorage.setItem(serviceProfessionalsStorageKey, JSON.stringify(professionals)); } catch { setToast("O navegador não conseguiu salvar os dados locais. Tente usar uma foto menor."); } } }, [services, professionals, hydrated]);
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
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const highest = [...active].sort((a, b) => b.price - a.price)[0];
  const averageDuration = active.length ? Math.round(active.reduce((sum, item) => sum + item.durationMinutes, 0) / active.length) : 0;
  const activeCategories = new Set(active.map((item) => item.category)).size;
  const withReturn = active.filter((item) => item.returnMinDays && item.returnMaxDays).length;

  const updateService = (id: string, updater: (service: ServiceRecord) => ServiceRecord) => setServices((current) => current.map((item) => item.id === id ? updater(item) : item));
  const saveService = (input: ServiceInput, addedProfessionals: ServiceProfessional[]) => {
    if (addedProfessionals.length) setProfessionals((current) => [...current, ...addedProfessionals]);
    if (dialog === "edit" && selected) {
      updateService(selected.id, (item) => ({ ...item, ...input, updatedAt: today(), version: (Number(item.version) + 0.1).toFixed(1) }));
      setToast("Procedimento atualizado nesta prévia.");
    } else {
      const id = crypto.randomUUID();
      const item: ServiceRecord = { id, sku: nextSku(input.category, services), ...input, heroSubtitle: input.name, version: "1.0", updatedAt: today() };
      setServices((current) => [...current, item]); setStatus(input.status); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setQuery(""); setSelectedId(id);
      setToast("Procedimento criado nesta prévia.");
    }
    setDialog(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const id = crypto.randomUUID();
    const baseName = `Cópia de ${selected.name}`;
    let copyName = baseName;
    let suffix = 2;
    while (services.some((item) => item.category === selected.category && normalise(item.name) === normalise(copyName))) copyName = `${baseName} (${suffix++})`;
    const copy: ServiceRecord = { ...selected, id, sku: nextSku(selected.category, services), name: copyName, status: "Homologação", version: "1.0", updatedAt: today(), imageUrl: undefined };
    setServices((current) => [...current, copy]); setStatus("Homologação"); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setQuery(""); setSelectedId(id); setMenuOpen(false); setToast("Rascunho duplicado em homologação.");
  };
  const toggleStatus = () => {
    if (!selected) return;
    const next = selected.status === "Inativo" ? "Ativo" : "Inativo";
    if (next === "Ativo" && !selected.professionalIds.length) {
      setMenuOpen(false);
      setDialog("edit");
      setToast("Selecione um profissional antes de reativar este procedimento.");
      return;
    }
    updateService(selected.id, (item) => ({ ...item, status: next, updatedAt: today() })); setMenuOpen(false); setToast(next === "Ativo" ? "Procedimento reativado. O filtro atual foi mantido." : "Procedimento desativado. O filtro atual foi mantido.");
  };
  const deleteService = () => {
    if (!selected) return;
    setServices((current) => current.filter((item) => item.id !== selected.id).map((item) => item.maintenanceServiceId === selected.id ? { ...item, maintenanceServiceId: undefined } : item));
    setSelectedId("");
    setDialog(null);
    setMenuOpen(false);
    setToast("Procedimento excluído desta demonstração.");
  };
  const exportCsv = () => {
    const columns = ["SKU", "Procedimento", "Categoria", "Status", "Duração (min)", "Intervalo (min)", "Preço (R$)", "Piso (R$)", "Retorno mínimo (dias)", "Retorno máximo (dias)", "Modalidade", "Profissionais habilitados", "Serviço de manutenção"];
    const rows = filtered.map((item) => [item.sku, item.name, item.category, item.status, String(item.durationMinutes), String(item.bufferMinutes), item.price.toFixed(2), item.floorPrice.toFixed(2), String(item.returnMinDays ?? ""), String(item.returnMaxDays ?? ""), modalityLabel(item.modality), professionals.filter((professional) => item.professionalIds.includes(professional.id)).map((professional) => professional.name).join(", "), services.find((service) => service.id === item.maintenanceServiceId)?.name ?? ""]);
    const csv = `\uFEFF${[columns, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "navy-servicos-demonstracao.csv"; link.click(); URL.revokeObjectURL(url);
    setToast(`${filtered.length} procedimento(s) exportado(s) da visualização atual.`);
  };

  return <div className="sv-page" onClick={(event) => { if (menuOpen && !(event.target as HTMLElement).closest(".sv-menu-wrap")) setMenuOpen(false); }}>
    <div className="sv-heading"><div><div className="sv-eyebrow">SERVIÇOS <Icon name="chevron_right" size={13} /> <strong>GESTÃO DO PORTFÓLIO</strong></div><h1>Catálogo de Procedimentos</h1><p>Configure categorias, durações clínicas, regras de manutenção preventiva e insumos vinculados com rastreabilidade de custos.</p></div><div className="sv-heading-actions"><button type="button" className="sv-btn sv-btn-soft" onClick={exportCsv}><Icon name="file_download" size={17} />Exportar Tabela</button><button type="button" className="sv-btn sv-btn-primary" onClick={() => setDialog("create")}><Icon name="add" size={18} />+ Novo Procedimento</button></div></div>
    <div className="sv-stats"><div><span>SERVIÇOS ATIVOS</span><strong>{active.length}</strong><small><i />Em {activeCategories} {activeCategories === 1 ? "categoria" : "categorias"}</small><Icon name="spa" size={22} /></div><div><span>DURAÇÃO MÉDIA</span><strong>{averageDuration}<em> min</em></strong><small><Icon name="schedule" size={13} /> Dos procedimentos ativos</small><Icon name="timer" size={22} /></div><div><span>MAIOR PREÇO DE TABELA</span><strong>{highest ? currency(highest.price) : "—"}</strong><small>{highest?.name ?? "Nenhum procedimento"}</small><Icon name="payments" size={22} /></div><div><span>COM RETORNO PREVISTO</span><strong>{withReturn}</strong><small><Icon name="event_repeat" size={13} /> Com prazo cadastrado</small><Icon name="autorenew" size={22} /></div></div>
    <div className="sv-toolbar"><div className="sv-category-tabs" role="group" aria-label="Filtrar por categoria">{(["Todos", ...serviceCategories] as CategoryFilter[]).map((item) => <button key={item} type="button" aria-pressed={category === item} className={category === item ? "sv-filter-active" : ""} onClick={() => setCategory(item)}>{item} ({item === "Todos" ? statusServices.length : statusServices.filter((service) => service.category === item).length})</button>)}</div><div className="sv-filter-row"><label className="sv-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome do procedimento, código SKU ou insumo..." aria-label="Buscar procedimentos" /></label><select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)} aria-label="Filtrar profissional"><option value="Todos">Todos os profissionais</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={modality} onChange={(event) => setModality(event.target.value as ModalityFilter)} aria-label="Filtrar modalidade"><option value="Todas">Todas as modalidades</option><option value="Studio">Apenas Cabine Studio</option><option value="Home">Atendimento Domiciliar VIP</option></select><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filtrar status"><option value="Ativo">Apenas Ativos ({active.length})</option><option value="Homologação">Em Homologação ({services.filter((item) => item.status === "Homologação").length})</option><option value="Inativo">Inativos ({services.filter((item) => item.status === "Inativo").length})</option><option value="Todos">Todos os status ({services.length})</option></select></div></div>
    <div className="sv-columns"><div className="sv-list">{filtered.length ? filtered.map((item) => <ServiceCard key={item.id} service={item} professionals={professionals} selected={item.id === selected?.id} onSelect={() => { setSelectedId(item.id); setMenuOpen(false); }} />) : <div className="sv-empty"><Icon name="search_off" size={26} /><strong>Nenhum procedimento encontrado</strong><p>Experimente outra busca ou ajuste os filtros.</p><button type="button" onClick={() => { setQuery(""); setCategory("Todos"); setModality("Todas"); setProfessionalFilter("Todos"); setStatus("Ativo"); }}>Limpar filtros</button></div>}</div>{selected && <ServiceDetail service={selected} services={services} professionals={professionals} menuOpen={menuOpen} onMenu={() => setMenuOpen((current) => !current)} onEdit={() => { setMenuOpen(false); setDialog("edit"); }} onDuplicate={duplicate} onStatus={toggleStatus} onDelete={() => { setMenuOpen(false); setDialog("delete"); }} onToggle={(key) => { updateService(selected.id, (item) => ({ ...item, [key]: !item[key], updatedAt: today() })); setToast("Regra atualizada nesta prévia."); }} />}</div>
    {(dialog === "create" || dialog === "edit") && <ContentDialog title={dialog === "create" ? "Novo Procedimento" : "Editar Parâmetros do Procedimento"} wide onClose={() => setDialog(null)}><ServiceForm key={dialog === "edit" ? selected?.id : "new"} service={dialog === "edit" ? selected ?? undefined : undefined} services={services} professionals={professionals} onSave={saveService} onClose={() => setDialog(null)} /></ContentDialog>}
    {dialog === "delete" && selected && <ContentDialog title="Excluir Procedimento" onClose={() => setDialog(null)}><div className="nc-form sv-delete-confirm"><p>Excluir <strong>{selected.name}</strong> ({selected.sku}) dos dados desta demonstração salvos neste navegador?</p><p>O procedimento será removido do catálogo. Para apenas ocultá-lo dos ativos, use “Desativar”.</p><div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={() => setDialog(null)}>Cancelar</button><button type="button" className="nc-btn nc-btn-danger" onClick={deleteService}>Excluir procedimento</button></div></div></ContentDialog>}
    {toast && <div className="nc-toast" role="status">{toast}</div>}
  </div>;
}
