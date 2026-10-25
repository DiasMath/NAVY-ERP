export type DemoClient = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  source: "Instagram" | "WhatsApp" | "Indicação" | "Outros";
  tone: "blue" | "gold" | "sage" | "rose" | "lavender";
  visits: number;
  lastService: string;
  returnHint?: string;
};

export type DemoAppointment = {
  id: string;
  clientId: string;
  weekday: number;
  start: number;
  duration: number;
  service: string;
  location: "Espaço NAVY" | "Domicílio";
  status: "Confirmado" | "Pendente";
  tone: "blue" | "gold" | "sage" | "rose" | "lavender";
  price: number;
};

export const demoClients: DemoClient[] = [
  { id: "c1", name: "Cliente exemplo 01", initials: "C1", phone: "(00) 90000-0001", source: "Instagram", tone: "blue", visits: 4, lastService: "Extensão clássica", returnHint: "Retorno sugerido em 7 dias" },
  { id: "c2", name: "Cliente exemplo 02", initials: "C2", phone: "(00) 90000-0002", source: "Indicação", tone: "gold", visits: 2, lastService: "Lash lifting" },
  { id: "c3", name: "Cliente exemplo 03", initials: "C3", phone: "(00) 90000-0003", source: "WhatsApp", tone: "rose", visits: 3, lastService: "Volume brasileiro", returnHint: "Manutenção próxima" },
  { id: "c4", name: "Cliente exemplo 04", initials: "C4", phone: "(00) 90000-0004", source: "Instagram", tone: "sage", visits: 1, lastService: "Design de sobrancelhas" },
  { id: "c5", name: "Cliente exemplo 05", initials: "C5", phone: "(00) 90000-0005", source: "Outros", tone: "lavender", visits: 2, lastService: "Extensão clássica" },
];

export const demoAppointments: DemoAppointment[] = [
  { id: "NV-101", clientId: "c1", weekday: 0, start: 9, duration: 1.5, service: "Extensão clássica", location: "Espaço NAVY", status: "Confirmado", tone: "blue", price: 180 },
  { id: "NV-102", clientId: "c2", weekday: 0, start: 11.5, duration: 1, service: "Lash lifting", location: "Domicílio", status: "Pendente", tone: "gold", price: 140 },
  { id: "NV-103", clientId: "c3", weekday: 1, start: 10, duration: 2, service: "Volume brasileiro", location: "Espaço NAVY", status: "Confirmado", tone: "rose", price: 220 },
  { id: "NV-104", clientId: "c4", weekday: 2, start: 14, duration: .75, service: "Design de sobrancelhas", location: "Espaço NAVY", status: "Pendente", tone: "sage", price: 65 },
  { id: "NV-105", clientId: "c5", weekday: 3, start: 9, duration: 1.5, service: "Extensão clássica", location: "Domicílio", status: "Confirmado", tone: "lavender", price: 180 },
  { id: "NV-106", clientId: "c1", weekday: 4, start: 11, duration: 1, service: "Lash lifting", location: "Espaço NAVY", status: "Pendente", tone: "blue", price: 140 },
];

export const demoMaterials = [
  { name: "Insumo exemplo A", amount: "2 unidades", minimum: "Mínimo: 5", tone: "warning" },
  { name: "Insumo exemplo B", amount: "1 unidade", minimum: "Mínimo: 3", tone: "critical" },
];
