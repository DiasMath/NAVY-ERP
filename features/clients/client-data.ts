export type ClientSource = "Não informado" | "Instagram" | "Indicação" | "WhatsApp" | "Outros";
export type PreferredContact = "WhatsApp" | "Telefone" | "Instagram" | "E-mail";

export type ClientSession = {
  id: string;
  date: string;
  service: string;
  amount: number;
  payment: string;
  note: string;
  duration: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  instagram: string;
  preferredContact?: PreferredContact;
  source: ClientSource;
  sourceDetail: string;
  city: string;
  joined: string;
  avatar?: string;
  avatarDriveFileId?: string;
  vip: boolean;
  badge?: string;
  status: string;
  statusTone: "gold" | "rose" | "sage" | "slate" | "blue";
  lifetimeValue: number;
  visits: number;
  frequencyDays?: number;
  clinicalNote: string;
  preferences: string;
  returnDate?: string;
  sessions: ClientSession[];
};

const julianaAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuAHZT-4eYhBOMTXUZmJXuOqFK-dTAbhQYlf1ZUpEUaLNr3cEzQ35Nk6l-GF5blKSBm2QMFljC2u-hrDbMhbj0k1IGhxvwR6OJqzxOTNFD5r6ygsgLoJKmvk0LoPGM2f2pZY3EpXozm9XBpHgBNk-Rd1SPtRk1BSjTWRv1Kl8pghqtUV1NG7D_7HI1g-AwYJXjBnlMtJpITJ5adJZ8NN3w_CrtlAZK_QItRS3EA9KmvTXxGHSwmrlIHI";
const carlaAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuBwvoOZVpz9EG_pht5tXvhv3_LC7VSFMi-flktUZN-LpvHuIxzCytwYyBdEHcotIDAWiC0cExZCNT1RaoxQ_-htRdZaaj503bVkp2bsAKIvoxEnyLyY5eRnvPwFaMrGk6pVjGWT-6Lb1QSe7rRcVtB4MAR4s5zAZgzBTVKJvVrib1IcQucoZY-DenOmfVFplMUQeSt3MhJoVaTItJFeCrrgnVA__3m5BDa_dXtTmp1Zud98jPUHRO-N";

export const initialClients: ClientRecord[] = [
  {
    id: "juliana", name: "Juliana Silveira", phone: "(11) 98765-4321", instagram: "@ju.silveira", source: "Instagram", sourceDetail: "Instagram", city: "São Paulo, SP", joined: "Julho/2023", avatar: julianaAvatar, vip: true, status: "Manutenção em 5d", statusTone: "gold", lifetimeValue: 1120, visits: 4, frequencyDays: 19,
    clinicalNote: "Sensibilidade leve ao vaporizador na primeira sessão • Formato ocular amendoado • Fios naturais finos (curvatura C recomendada • adesivo de secagem rápida com baixo odor).",
    preferences: "Mapping gatinho suave, curvatura C e adesivo com baixo odor. Prefere atendimentos à tarde.", returnDate: "2026-10-28",
    sessions: [
      { id: "j-1", date: "2023-10-24T14:00", service: "Volume Brasileiro Personalizado (Manutenção Completa)", amount: 280, payment: "Pix", note: "Aplicação de fios 0.07D modelo Y com mapping gatinho suave (8mm a 12mm). Remoção de fios com crescimento excessivo (15 unidades por olho). Baixa de insumos automatizada no estoque.", duration: "1h 45m" },
      { id: "j-2", date: "2023-10-05T10:30", service: "Retoque Rápido & Higienização Profunda", amount: 140, payment: "Cartão Crédito", note: "Higienização com nano mousse hipoalergênico. Reposição de 40 fios por olho. Relatou excelente retenção de 85% após uso do sérum protetor indicado.", duration: "50m" },
      { id: "j-3", date: "2023-09-14T15:00", service: "Aplicação Inicial de Extensão de Cílios (Design Personalizado)", amount: 220, payment: "Pix", note: "Preenchimento completo de ficha cadastral e consentimento assinado digitalmente. Teste de adesivo sem reações alérgicas.", duration: "2h" },
    ],
  },
  { id: "fernanda", name: "Fernanda Costa", phone: "(11) 99123-8877", instagram: "", source: "Indicação", sourceDetail: "Indicação (Dra. Lúcia)", city: "São Paulo, SP", joined: "Outubro/2023", vip: false, badge: "Home Care", status: "Pendente R$ 190", statusTone: "rose", lifetimeValue: 190, visits: 1, clinicalNote: "Sem sensibilidades registradas nesta demonstração.", preferences: "Atendimento domiciliar.", sessions: [{ id: "f-1", date: "2023-10-23T11:30", service: "Lash Lifting + Nutrição com Queratina", amount: 190, payment: "Pendente", note: "Atendimento domiciliar demonstrativo.", duration: "1h 30m" }] },
  { id: "carla", name: "Carla Mendes", phone: "(11) 97766-5544", instagram: "", source: "WhatsApp", sourceDetail: "WhatsApp Oficial", city: "Jardins, SP", joined: "Setembro/2023", avatar: carlaAvatar, vip: false, status: "Confirmada hoje", statusTone: "sage", lifetimeValue: 310, visits: 2, clinicalNote: "Sem sensibilidades registradas nesta demonstração.", preferences: "Prefere procedimentos no Studio NAVY.", sessions: [{ id: "c-1", date: "2023-10-24T14:30", service: "Manutenção + Design de Sobrancelhas", amount: 310, payment: "Pix", note: "Atendimento demonstrativo no Studio NAVY.", duration: "1h 30m" }] },
  { id: "mariana", name: "Mariana Sampaio", phone: "(11) 98112-3344", instagram: "@mariana.sampaio", source: "Instagram", sourceDetail: "Instagram Ads", city: "São Paulo, SP", joined: "Setembro/2023", vip: false, status: "Janela Retoque", statusTone: "slate", lifetimeValue: 420, visits: 2, frequencyDays: 21, clinicalNote: "Sem sensibilidades registradas nesta demonstração.", preferences: "Volume Brasileiro; prefere horários no fim do dia.", returnDate: "2026-10-28", sessions: [{ id: "m-1", date: "2023-10-03T16:30", service: "Volume Brasileiro", amount: 210, payment: "Pix", note: "Aplicação inicial demonstrativa.", duration: "2h" }] },
  { id: "patricia", name: "Patrícia Albuquerque", phone: "(11) 96543-2109", instagram: "", source: "Outros", sourceDetail: "Cadastro recente", city: "São Paulo, SP", joined: "Outubro/2023", vip: false, status: "Novo Cadastro", statusTone: "blue", lifetimeValue: 0, visits: 0, clinicalNote: "Ficha de anamnese ainda não preenchida.", preferences: "Nenhuma preferência registrada.", sessions: [] },
];
