export const serviceCategories = ["Cílios & Extensão", "Sobrancelhas & Design", "Lash Lifting & Tratamentos", "Facial & Pele", "Combos & Pacotes"] as const;
export type ServiceCategory = typeof serviceCategories[number];
export type ServiceStatus = "Ativo" | "Homologação" | "Inativo";
export type ServiceModality = "Studio" | "Home" | "Ambos";
export type Consumable = { name: string; quantity: string; cost: number };
export type ServiceProfessional = { id: string; name: string };
export type ServiceRecord = {
  id: string;
  sku: string;
  name: string;
  category: ServiceCategory;
  description: string;
  status: ServiceStatus;
  durationMinutes: number;
  bufferMinutes: number;
  price: number;
  floorPrice: number;
  returnMinDays?: number;
  returnMaxDays?: number;
  modality: ServiceModality;
  professionalIds: string[];
  tags: string[];
  consumables: Consumable[];
  requiresAnamnesis: boolean;
  requiresPhoto: boolean;
  requiresSocialConsent: boolean;
  maintenancePrice?: number;
  maintenanceDurationMinutes?: number;
  maintenanceServiceId?: string;
  heroSubtitle?: string;
  imageUrl?: string;
  version: string;
  updatedAt: string;
};

export const serviceStorageKey = "navy-services-demo-v1";
export const serviceProfessionalsStorageKey = "navy-service-professionals-demo-v1";
export const initialServiceProfessionals: ServiceProfessional[] = [{ id: "camila-navy", name: "Dra. Camila NAVY" }];
export const categoryPrefixes: Record<ServiceCategory, string> = {
  "Cílios & Extensão": "CIL",
  "Sobrancelhas & Design": "SOB",
  "Lash Lifting & Tratamentos": "LFT",
  "Facial & Pele": "FAC",
  "Combos & Pacotes": "COM",
};

const heroImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuCpvezStiN2hVc-iomNyOmRZ_dcNNmxq_xiusDqtWBBiESTFzNsx5szjFI1f12E492X2eFkgPAA3VTyhjbFz43wfWqmhAwDqckpMoH-Z4mcPykMmEcvt16dcceyr3_RifTuI8kiDMyqNXrBTP-GLj4pvykSYnHiN_Kb2oTGJmC44TZr9vGuXQcdTP2F4t5sNYhZQEYRtM6MF3JxHX_kUgiqjyPDAkiC9D3CXQHw0LkEvdRCaY1i6TUH";
const seed = (id: string, sku: string, name: string, category: ServiceCategory, description: string, durationMinutes: number, price: number, floorPrice: number, returnMinDays: number | undefined, returnMaxDays: number | undefined, modality: ServiceModality, extra: Partial<ServiceRecord> = {}): ServiceRecord => ({
  id, sku, name, category, description, durationMinutes, price, floorPrice, returnMinDays, returnMaxDays, modality,
  status: "Ativo", bufferMinutes: 15, professionalIds: [initialServiceProfessionals[0].id], tags: [], consumables: [], requiresAnamnesis: false, requiresPhoto: false, requiresSocialConsent: false,
  version: "1.0", updatedAt: "2023-09-15", ...extra,
});

export const initialServices: ServiceRecord[] = [
  seed("cil-002", "CIL-002", "Volume Brasileiro Personalizado", "Cílios & Extensão", "Técnica em formato Y para volume com leveza natural e máxima retenção.", 105, 280, 195, 18, 21, "Ambos", {
    tags: ["Anamnese Ocular", "Foto Antes & Depois", "3 insumos vinculados"],
    consumables: [{ name: "Fios Ellipse Cashmere Y 0.07D", quantity: "1 chicote proporcional", cost: 18.5 }, { name: "Cola Master Lash Elite", quantity: "4 gotas por atendimento", cost: 6.2 }, { name: "Kit Biossegurança & Pads Colágeno", quantity: "1 kit descartável esterilizado", cost: 8.3 }],
    requiresAnamnesis: true, requiresPhoto: true, maintenancePrice: 140, maintenanceDurationMinutes: 60, maintenanceServiceId: "cil-005",
    heroSubtitle: "Fios Cashmere Y 0.07D", imageUrl: heroImage, version: "3.4",
  }),
  seed("cil-001", "CIL-001", "Extensão Clássica Fio a Fio", "Cílios & Extensão", "Isolamento rigoroso fio por fio. Efeito rímel sofisticado com acabamento acetinado.", 120, 220, 160, 15, 18, "Studio", { tags: ["Fios Mink 0.15", "Cola Sensitive Hypo", "Retoque Tabela: R$ 120,00"], maintenancePrice: 120, maintenanceDurationMinutes: 60, requiresAnamnesis: true, requiresPhoto: true }),
  seed("cil-003", "CIL-003", "Volume Russo Glamour VIP", "Cílios & Extensão", "Montagem manual de fans artesanais de 3D a 6D ultra-leves para máxima densidade.", 150, 380, 255, 21, 24, "Ambos", { tags: ["Fans 0.05 / 0.07", "Retoque Tabela: R$ 190,00", "Avaliação Prévia"], maintenancePrice: 190, maintenanceDurationMinutes: 75, requiresAnamnesis: true, requiresPhoto: true }),
  seed("sob-001", "SOB-001", "Design de Sobrancelhas Personalizado", "Sobrancelhas & Design", "Mapeamento com paquímetro digital e linha orgânica com epilação de alta precisão.", 45, 60, 40, 20, 20, "Studio", { tags: ["Mapeamento Geométrico", "Pinça Cirúrgica Autoclavada"] }),
  seed("lft-001", "LFT-001", "Lash Lifting Nutritivo com Queratina", "Lash Lifting & Tratamentos", "Curvatura biológica dos fios naturais com infusão reparadora de botox e peptídeos.", 75, 190, 125, 45, 45, "Studio", { tags: ["Permanente Italiano", "Keratin Tint Booster"], requiresAnamnesis: true }),
  seed("cil-004", "CIL-004", "Volume Híbrido Natural", "Cílios & Extensão", "Combinação equilibrada de fios clássicos e fans leves.", 90, 260, 180, 18, 21, "Studio", { tags: ["Volume híbrido", "Acabamento natural"], requiresAnamnesis: true, requiresPhoto: true }),
  seed("cil-005", "CIL-005", "Manutenção Volume Brasileiro", "Cílios & Extensão", "Reposição dos fios e higienização da extensão existente.", 75, 140, 95, 18, 21, "Ambos", { tags: ["Retoque", "Higienização"], requiresAnamnesis: true }),
  seed("cil-006", "CIL-006", "Remoção Técnica de Extensão", "Cílios & Extensão", "Remoção cuidadosa de extensões com avaliação dos fios naturais.", 60, 80, 55, undefined, undefined, "Studio", { tags: ["Remoção", "Avaliação"], requiresAnamnesis: true }),
  seed("sob-002", "SOB-002", "Brow Lamination", "Sobrancelhas & Design", "Alinhamento e modelagem dos fios para sobrancelhas definidas.", 120, 220, 150, 35, 45, "Studio", { tags: ["Alinhamento", "Finalização"], requiresAnamnesis: true }),
  seed("sob-003", "SOB-003", "Design com Henna", "Sobrancelhas & Design", "Desenho personalizado com coloração suave de henna.", 60, 95, 65, 20, 30, "Studio", { tags: ["Henna", "Mapeamento"], requiresAnamnesis: true }),
  seed("lft-002", "LFT-002", "Tratamento Reparador de Cílios", "Lash Lifting & Tratamentos", "Protocolo nutritivo para revitalização dos fios naturais.", 90, 160, 110, 30, 45, "Studio", { tags: ["Nutrição", "Recuperação"], requiresAnamnesis: true }),
  seed("fac-001", "FAC-001", "Limpeza de Pele Clínica", "Facial & Pele", "Higienização, extração e cuidado calmante personalizados.", 120, 250, 175, 30, 45, "Studio", { tags: ["Avaliação de pele", "Higienização"], requiresAnamnesis: true, requiresPhoto: true }),
  seed("fac-002", "FAC-002", "Protocolo Facial Renovação", "Facial & Pele", "Sequência de cuidados faciais para luminosidade e hidratação.", 180, 340, 235, 28, 35, "Studio", { tags: ["Hidratação", "Renovação"], requiresAnamnesis: true, requiresPhoto: true }),
  seed("com-001", "COM-001", "Combo Olhar Completo", "Combos & Pacotes", "Extensão de cílios e design de sobrancelhas no mesmo atendimento.", 180, 330, 235, 18, 21, "Studio", { tags: ["Cílios", "Sobrancelhas"], requiresAnamnesis: true, requiresPhoto: true }),
  seed("fac-003", "FAC-003", "Protocolo Facial em Avaliação", "Facial & Pele", "Procedimento em revisão antes de entrar no catálogo ativo.", 60, 180, 120, undefined, undefined, "Studio", { status: "Homologação", tags: ["Em avaliação"] }),
];

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${String(remainder).padStart(2, "0")}m` : `${minutes} min`;
}

export function modalityLabel(modality: ServiceModality): string {
  return modality === "Ambos" ? "Studio & VIP Home" : modality === "Home" ? "VIP Home" : "Studio Cabine";
}
