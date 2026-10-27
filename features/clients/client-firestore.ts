import type { ClientDocument, ClinicalSessionDocument } from "@/lib/firebase/documents";
import type { ClientRecord, ClientSession } from "./client-data";
import type { ClientInput, SessionInput } from "./client-validation";

const joined = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data não informada" : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
};

export function toClientDocument(id: string, input: ClientInput, previous?: ClientDocument): ClientDocument {
  const now = new Date().toISOString();
  return {
    id,
    ...input,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    clinicalNote: previous?.clinicalNote ?? "Ficha de anamnese ainda não preenchida.",
    preferences: previous?.preferences ?? "Nenhuma preferência registrada.",
    ...(previous?.returnDate ? { returnDate: previous.returnDate } : {}),
    ...(previous?.avatarDriveFileId ? { avatarDriveFileId: previous.avatarDriveFileId } : {}),
  };
}

export function toSessionDocument(clientId: string, input: SessionInput): ClinicalSessionDocument {
  return {
    id: crypto.randomUUID(),
    clientId,
    startedAt: input.date,
    serviceName: input.service,
    durationLabel: input.duration,
    amount: input.amount,
    paymentStatus: input.payment === "Agendado" ? "planned" : input.payment === "Pendente" ? "pending" : "paid",
    paymentMethod: input.payment,
    notes: input.note,
    createdAt: new Date().toISOString(),
  };
}

export function toClientRecord(document: ClientDocument, documents: ClinicalSessionDocument[]): ClientRecord {
  const sessions: ClientSession[] = documents
    .filter(session => session.clientId === document.id)
    .map(session => ({
      id: session.id,
      appointmentId: session.appointmentId,
      serviceId: session.serviceId,
      date: session.startedAt,
      service: session.serviceName,
      amount: session.amount,
      payment: session.paymentStatus === "planned" ? "Agendado" : session.paymentStatus === "pending" ? "Pendente" : session.paymentMethod || "Pago",
      note: session.notes ?? "",
      duration: session.durationLabel,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const completed = sessions.filter(session => session.payment !== "Agendado");
  const paid = completed.filter(session => session.payment !== "Pendente");
  const lifetimeValue = paid.reduce((total, session) => total + session.amount, 0);
  const pending = completed.find(session => session.payment === "Pendente");
  const planned = sessions.some(session => session.payment === "Agendado");
  const status = pending ? `Pendente ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pending.amount)}` : planned ? "Retorno agendado" : completed.length ? "Ativa" : "Novo Cadastro";
  const statusTone = pending ? "rose" : planned ? "sage" : completed.length ? "slate" : "blue";
  const dates = completed.map(session => new Date(session.date).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const frequencyDays = dates.length > 1 ? Math.round((dates.at(-1)! - dates[0]) / (dates.length - 1) / 86_400_000) : undefined;
  return {
    id: document.id,
    name: document.name,
    phone: document.phone,
    email: document.email,
    birthDate: document.birthDate,
    instagram: document.instagram ?? "",
    preferredContact: document.preferredContact ?? undefined,
    source: document.source,
    sourceDetail: document.sourceDetail ?? document.source,
    city: document.city ?? "",
    joined: joined(document.createdAt),
    avatarDriveFileId: document.avatarDriveFileId,
    vip: document.vip,
    status,
    statusTone,
    lifetimeValue,
    visits: completed.length,
    frequencyDays,
    clinicalNote: document.clinicalNote ?? "Ficha de anamnese ainda não preenchida.",
    preferences: document.preferences ?? "Nenhuma preferência registrada.",
    returnDate: document.returnDate,
    sessions,
  };
}
