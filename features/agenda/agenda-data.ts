export type AgendaStatus = "Pendente" | "Confirmado" | "Em atendimento" | "Concluído" | "Cancelado";
export type AgendaPlace = "Studio" | "Home";
export type AgendaLine = { serviceId: string; name: string; price: number; durationMinutes: number; bufferMinutes: number };
export type AgendaAppointment = {
  id: string;
  bookingKind?: "catalog" | "manual";
  clientId: string;
  professionalId: string;
  date: string;
  time: string;
  place: AgendaPlace;
  address?: string;
  lines: AgendaLine[];
  status: AgendaStatus;
  startedAt?: string;
  completedAt?: string;
  earlyStartConfirmedAt?: string;
  paymentMethod?: string;
  materials: string[];
  note?: string;
  demo?: boolean;
};

export const agendaStorageKey = "navy-agenda-local-v1";
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
export const moveDate = (key: string, days: number) => { const date = dateFromKey(key); date.setDate(date.getDate() + days); return dateKey(date); };
export const mondayOfKey = (key: string) => { const date = dateFromKey(key); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return dateKey(date); };
export const monthKey = (key: string) => key.slice(0, 7);
export const appointmentDuration = (item: AgendaAppointment) => item.lines.reduce((total, line) => total + line.durationMinutes, 0);
export const appointmentPrice = (item: AgendaAppointment) => item.lines.reduce((total, line) => total + line.price, 0);
export const appointmentEnd = (item: AgendaAppointment) => {
  const [hour, minute] = item.time.split(":").map(Number);
  const end = hour * 60 + minute + appointmentDuration(item);
  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};

export function initialAgenda(today: string): AgendaAppointment[] {
  const line = (serviceId: string, name: string, price: number, durationMinutes: number, bufferMinutes = 15): AgendaLine => ({ serviceId, name, price, durationMinutes, bufferMinutes });
  return [
    { id: "NV-1082", clientId: "juliana", professionalId: "camila-navy", date: today, time: "09:00", place: "Studio", lines: [line("cil-002", "Volume Brasileiro Personalizado", 280, 105), line("sob-001", "Design de Sobrancelhas", 60, 45, 0)], status: "Concluído", paymentMethod: "Pix", materials: ["Fios Ellipse Cashmere 0.07 C", "Cola Master Lash Elite", "Pads de Gel com Colágeno"], demo: true },
    { id: "NV-1083", clientId: "fernanda", professionalId: "camila-navy", date: today, time: "12:00", place: "Home", address: "Alameda Santos, Jardins • endereço ilustrativo", lines: [line("lft-001", "Lash Lifting + Nutrição com Queratina", 190, 75, 30)], status: "Em atendimento", materials: [], demo: true },
    { id: "NV-1084", clientId: "carla", professionalId: "camila-navy", date: today, time: "14:30", place: "Studio", lines: [line("cil-005", "Manutenção Volume Brasileiro", 140, 75)], status: "Confirmado", materials: [], demo: true },
    { id: "NV-1085", clientId: "patricia", professionalId: "camila-navy", date: today, time: "17:00", place: "Studio", lines: [line("cil-003", "Volume Russo Glamour VIP", 380, 150)], status: "Pendente", materials: [], demo: true },
    { id: "NV-1086", clientId: "mariana", professionalId: "camila-navy", date: moveDate(today, 1), time: "10:00", place: "Studio", lines: [line("cil-001", "Extensão Clássica Fio a Fio", 220, 120)], status: "Confirmado", materials: [], demo: true },
  ];
}
