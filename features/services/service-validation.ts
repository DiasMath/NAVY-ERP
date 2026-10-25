import { serviceCategories, type Consumable, type ServiceCategory, type ServiceModality, type ServiceRecord, type ServiceStatus } from "./service-data";

export type ServiceField = "name" | "category" | "description" | "durationMinutes" | "bufferMinutes" | "price" | "floorPrice" | "returnMinDays" | "returnMaxDays" | "modality" | "status" | "professionalIds" | "maintenanceServiceId" | "maintenancePrice" | "maintenanceDurationMinutes" | "tags" | "consumables";
export type ServiceErrors = Partial<Record<ServiceField, string>>;
export type ServiceInput = Omit<ServiceRecord, "id" | "sku" | "version" | "updatedAt" | "heroSubtitle" | "imageUrl">;

const read = (values: FormData, field: ServiceField) => String(values.get(field) ?? "").trim();
const number = (value: string) => Number(value.replace(",", "."));
const moneyPattern = /^\d{1,6}(?:[.,]\d{1,2})?$/;
const integerPattern = /^\d{1,4}$/;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function validateService(values: FormData, services: ServiceRecord[], availableProfessionalIds: string[], editingId?: string): { input: ServiceInput; errors: ServiceErrors } {
  const errors: ServiceErrors = {};
  const name = read(values, "name").replace(/\s+/g, " ");
  const categoryRaw = read(values, "category");
  const category = serviceCategories.includes(categoryRaw as ServiceCategory) ? categoryRaw as ServiceCategory : serviceCategories[0];
  const description = read(values, "description").replace(/\s+/g, " ");
  const durationText = read(values, "durationMinutes");
  const bufferText = read(values, "bufferMinutes");
  const priceText = read(values, "price");
  const floorText = read(values, "floorPrice");
  const returnMinText = read(values, "returnMinDays");
  const returnMaxText = read(values, "returnMaxDays");
  const maintenancePriceText = read(values, "maintenancePrice");
  const maintenanceDurationText = read(values, "maintenanceDurationMinutes");
  const modalityRaw = read(values, "modality");
  const statusRaw = read(values, "status");
  const professionalIds = [...new Set(values.getAll("professionalIds").map(String))];
  const maintenanceServiceId = read(values, "maintenanceServiceId") || undefined;
  const tagsText = read(values, "tags");
  const consumablesText = read(values, "consumables");

  const durationMinutes = number(durationText);
  const bufferMinutes = number(bufferText);
  const price = number(priceText);
  const floorPrice = floorText ? number(floorText) : 0;
  const returnMinDays = returnMinText ? number(returnMinText) : undefined;
  const returnMaxDays = returnMaxText ? number(returnMaxText) : undefined;
  const maintenancePrice = maintenancePriceText ? number(maintenancePriceText) : undefined;
  const maintenanceDurationMinutes = maintenanceDurationText ? number(maintenanceDurationText) : undefined;
  const modality = (["Studio", "Home", "Ambos"].includes(modalityRaw) ? modalityRaw : "Studio") as ServiceModality;
  const status = (["Ativo", "Homologação", "Inativo"].includes(statusRaw) ? statusRaw : "Ativo") as ServiceStatus;
  const tags = tagsText ? tagsText.split(",").map((item) => item.trim()).filter(Boolean) : [];
  const consumables: Consumable[] = [];

  if (name.length < 3 || name.length > 100) errors.name = "Informe um nome com 3 a 100 caracteres.";
  else if (services.some((item) => item.id !== editingId && item.category === category && normalize(item.name) === normalize(name))) errors.name = "Já existe um procedimento com este nome nesta categoria.";
  if (!serviceCategories.includes(categoryRaw as ServiceCategory)) errors.category = "Selecione uma categoria válida.";
  if (description.length > 300) errors.description = "Use até 300 caracteres na descrição.";
  if (!integerPattern.test(durationText) || durationMinutes < 15 || durationMinutes > 720 || durationMinutes % 5 !== 0) errors.durationMinutes = "Use de 15 a 720 minutos, em intervalos de 5 minutos.";
  if (!integerPattern.test(bufferText) || bufferMinutes < 0 || bufferMinutes > 120 || bufferMinutes % 5 !== 0) errors.bufferMinutes = "Use de 0 a 120 minutos, em intervalos de 5 minutos.";
  if (!moneyPattern.test(priceText) || price <= 0 || price > 999999) errors.price = "Informe um preço maior que zero, com até 2 casas decimais.";
  if (floorText && (!moneyPattern.test(floorText) || floorPrice < 0 || floorPrice > price)) errors.floorPrice = "O piso deve ser válido e não pode superar o preço de tabela.";
  if (returnMinText || returnMaxText) {
    if (!integerPattern.test(returnMinText) || !integerPattern.test(returnMaxText) || (returnMinDays ?? 0) < 1 || (returnMaxDays ?? 0) > 365 || (returnMinDays ?? 0) > (returnMaxDays ?? 0)) {
      errors.returnMinDays = "Informe uma janela de 1 a 365 dias, do menor para o maior.";
      errors.returnMaxDays = errors.returnMinDays;
    }
  }
  if (maintenancePriceText || maintenanceDurationText) {
    if (!moneyPattern.test(maintenancePriceText) || (maintenancePrice ?? 0) <= 0 || (maintenancePrice ?? 0) > 999999) errors.maintenancePrice = "Informe um valor válido para a manutenção.";
    if (!integerPattern.test(maintenanceDurationText) || (maintenanceDurationMinutes ?? 0) < 15 || (maintenanceDurationMinutes ?? 0) > 720 || (maintenanceDurationMinutes ?? 0) % 5 !== 0) errors.maintenanceDurationMinutes = "Informe a duração da manutenção em intervalos de 5 minutos.";
  }
  if (!["Studio", "Home", "Ambos"].includes(modalityRaw)) errors.modality = "Selecione uma modalidade válida.";
  if (!["Ativo", "Homologação", "Inativo"].includes(statusRaw)) errors.status = "Selecione um status válido.";
  if (professionalIds.some((id) => !availableProfessionalIds.includes(id))) errors.professionalIds = "Selecione profissionais cadastrados.";
  if (status === "Ativo" && professionalIds.length === 0) errors.professionalIds = "Selecione pelo menos um profissional para um serviço ativo.";
  if (maintenanceServiceId && (maintenanceServiceId === editingId || !services.some((item) => item.id === maintenanceServiceId))) errors.maintenanceServiceId = "Selecione um serviço de manutenção válido.";
  if (tags.length > 8 || tags.some((tag) => tag.length > 50)) errors.tags = "Use até 8 etiquetas, cada uma com até 50 caracteres.";
  if (consumablesText) {
    const lines = consumablesText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 10) errors.consumables = "Use até 10 insumos vinculados.";
    else for (const line of lines) {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length !== 3 || !parts[0] || parts[0].length > 80 || !parts[1] || parts[1].length > 60 || !moneyPattern.test(parts[2]) || number(parts[2]) > 9999) { errors.consumables = "Use uma linha por insumo: Nome | quantidade | custo."; break; }
      consumables.push({ name: parts[0], quantity: parts[1], cost: number(parts[2]) });
    }
  }

  return {
    input: { name, category, description, durationMinutes, bufferMinutes, price, floorPrice, returnMinDays, returnMaxDays, modality, status, professionalIds, tags, consumables, requiresAnamnesis: values.has("requiresAnamnesis"), requiresPhoto: values.has("requiresPhoto"), requiresSocialConsent: values.has("requiresSocialConsent"), maintenanceServiceId, maintenancePrice, maintenanceDurationMinutes },
    errors,
  };
}
