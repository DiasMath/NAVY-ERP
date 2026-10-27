import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, assertDocumentId, requireNavyUser } from "@/lib/server/navy-auth";
import type { AppointmentDocument } from "@/lib/firebase/documents";
import type { AgendaPlace, AgendaStatus } from "@/features/agenda/agenda-data";

export const runtime = "nodejs";

const statuses: AgendaStatus[] = ["Pendente", "Confirmado", "Em atendimento", "Concluído", "Cancelado"];
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const reserved = (item: AppointmentDocument) => item.lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0);
const saoPauloNow = () => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(part => [part.type, part.value]));

export async function POST(request: NextRequest) {
  try {
    const user = await requireNavyUser(request);
    const body = await request.json() as { id?: string; bookingKind?: "catalog" | "manual"; clientId?: string; professionalId?: string; serviceIds?: string[]; manualName?: string; manualDurationMinutes?: number; manualPrice?: number; date?: string; time?: string; place?: AgendaPlace; address?: string };
    const { clientId, professionalId, date, time, place } = body;
    const manual = body.bookingKind === "manual";
    if (body.bookingKind !== undefined && !["catalog", "manual"].includes(body.bookingKind)) throw new ApiError(400, "Tipo de agendamento inválido.");
    if (!clientId || !date || !time || (!manual && !professionalId)) throw new ApiError(400, "Preencha cliente, data, horário e, para serviços do catálogo, a profissional.");
    assertDocumentId(clientId);
    if (!manual) assertDocumentId(professionalId!);
    if (body.id) assertDocumentId(body.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || Number.isNaN(new Date(`${date}T${time}`).valueOf()) || new Date(`${date}T12:00:00`).toISOString().slice(0, 10) !== date || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59) throw new ApiError(400, "Data ou horário inválido.");
    if (place !== "Studio" && place !== "Home") throw new ApiError(400, "Selecione o local do atendimento.");
    if (place === "Home" && (!body.address || body.address.trim().length < 5 || body.address.length > 300)) throw new ApiError(400, "Informe o endereço do atendimento domiciliar.");
    if (manual) {
      if (professionalId || body.serviceIds?.length) throw new ApiError(400, "Agendamento avulso não usa profissional nem serviço do catálogo.");
      if (typeof body.manualName !== "string" || !body.manualName.trim() || body.manualName.trim().length > 120) throw new ApiError(400, "Informe uma descrição de até 120 caracteres.");
      if (!Number.isInteger(body.manualDurationMinutes) || body.manualDurationMinutes! < 15 || body.manualDurationMinutes! > 480) throw new ApiError(400, "A duração deve ser de 15 a 480 minutos.");
      if (typeof body.manualPrice !== "number" || !Number.isFinite(body.manualPrice) || body.manualPrice < 0 || body.manualPrice > 100000) throw new ApiError(400, "Informe um valor válido para o atendimento.");
    } else {
      if (!Array.isArray(body.serviceIds) || body.serviceIds.length < 1 || body.serviceIds.length > 10 || new Set(body.serviceIds).size !== body.serviceIds.length) throw new ApiError(400, "Selecione de 1 a 10 serviços distintos.");
      body.serviceIds.forEach(assertDocumentId);
    }
    const db = adminDb();
    const base = db.collection("clinics").doc(user.clinicId);
    const appointmentId = body.id ?? crypto.randomUUID();
    const appointmentRef = base.collection("appointments").doc(appointmentId);
    const lockRef = base.collection("scheduleLocks").doc(`${manual ? "unassigned" : professionalId}_${date}`);
    const result = await db.runTransaction(async transaction => {
      const [lock, existing, client] = await Promise.all([
        transaction.get(lockRef), transaction.get(appointmentRef), transaction.get(base.collection("clients").doc(clientId)),
      ]);
      const professional = manual ? null : await transaction.get(base.collection("professionals").doc(professionalId!));
      const services = manual ? [] : await Promise.all(body.serviceIds!.map(id => transaction.get(base.collection("services").doc(id))));
      if (body.id && !existing.exists) throw new ApiError(404, "Agendamento não encontrado.");
      if (existing.exists && (await transaction.get(base.collection("sessions").doc(appointmentId))).exists) throw new ApiError(409, "Este agendamento já tem uma sessão registrada. Exclua a sessão antes de alterar a reserva.");
      if (!client.exists) throw new ApiError(404, "Cliente não encontrada.");
      if (!manual && (!professional?.exists || professional.data()?.active === false)) throw new ApiError(400, "Profissional indisponível.");
      const lines = manual ? [{ serviceId: "manual", name: body.manualName!.trim(), price: body.manualPrice!, durationMinutes: body.manualDurationMinutes!, bufferMinutes: 0 }] : services.map(snapshot => {
        const data = snapshot.data();
        if (!data || data.status !== "Ativo" || !Array.isArray(data.professionalIds) || !data.professionalIds.includes(professionalId) || (place === "Studio" ? data.modality === "Home" : data.modality === "Studio")) throw new ApiError(400, "Um dos serviços não está disponível para esta profissional e local.");
        if (!Number.isFinite(data.price) || !Number.isFinite(data.durationMinutes) || !Number.isFinite(data.bufferMinutes) || data.durationMinutes <= 0 || data.bufferMinutes < 0) throw new ApiError(400, "Confira preço e duração dos serviços.");
        return { serviceId: snapshot.id, name: String(data.name), price: data.price as number, durationMinutes: data.durationMinutes as number, bufferMinutes: data.bufferMinutes as number };
      });
      const duration = lines.reduce((sum, line) => sum + line.durationMinutes + line.bufferMinutes, 0);
      const start = minutes(time);
      const previous = existing.data() as AppointmentDocument | undefined;
      if (previous && (previous.bookingKind === "manual") !== manual) throw new ApiError(400, "O tipo de um agendamento existente não pode ser alterado.");
      const nowLocal = saoPauloNow();
      const nowKey = `${nowLocal.year}-${nowLocal.month}-${nowLocal.day}T${nowLocal.hour}:${nowLocal.minute}`;
      const unchangedPastSlot = Boolean(previous && previous.date === date && previous.time === time);
      if (start < 8 * 60 || start + duration > 20 * 60 || (!unchangedPastSlot && `${date}T${time}` <= nowKey)) throw new ApiError(400, "Escolha um horário futuro entre 08:00 e 20:00.");
      const sameDay = await transaction.get(base.collection("appointments").where("date", "==", date));
      const conflict = sameDay.docs.some(snapshot => {
        if (snapshot.id === appointmentId) return false;
        const item = snapshot.data() as AppointmentDocument;
        return item.professionalId === (manual ? "" : professionalId) && item.status !== "Cancelado" && start < minutes(item.time) + reserved(item) && start + duration > minutes(item.time);
      });
      if (conflict) throw new ApiError(409, manual ? "Já existe um agendamento avulso neste horário. Escolha outro horário." : "Esta profissional já tem um atendimento neste horário. Escolha outro horário.");
      const now = new Date().toISOString();
      const item: AppointmentDocument = {
        id: appointmentId, bookingKind: manual ? "manual" : "catalog", clientId, professionalId: manual ? "" : professionalId!, date, time, place,
        ...(place === "Home" ? { address: body.address!.trim() } : {}), lines,
        status: previous?.status === "Cancelado" ? "Pendente" : previous?.status ?? "Pendente",
        materials: previous?.materials ?? [],
        ...(previous?.paymentMethod ? { paymentMethod: previous.paymentMethod } : {}),
        ...(previous?.note ? { note: previous.note } : {}),
        createdAt: previous?.createdAt ?? now, updatedAt: now,
      };
      transaction.set(lockRef, { revision: (lock.data()?.revision ?? 0) + 1, updatedAt: now });
      transaction.set(appointmentRef, item);
      return item;
    });
    return NextResponse.json({ appointment: result });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireNavyUser(request);
    const body = await request.json() as { id?: string; status?: AgendaStatus; paymentMethod?: string; materials?: string[]; note?: string };
    if (!body.id) throw new ApiError(400, "Agendamento não informado.");
    assertDocumentId(body.id);
    const changes: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!statuses.includes(body.status)) throw new ApiError(400, "Status inválido.");
      changes.status = body.status;
    }
    if (body.paymentMethod !== undefined) {
      if (!["Pix", "Débito", "Crédito", "Dinheiro"].includes(body.paymentMethod)) throw new ApiError(400, "Forma de pagamento inválida.");
      changes.paymentMethod = body.paymentMethod;
    }
    if (body.materials !== undefined) {
      if (!Array.isArray(body.materials) || body.materials.length > 50 || body.materials.some(item => typeof item !== "string" || item.length > 120)) throw new ApiError(400, "Lista de insumos inválida.");
      changes.materials = body.materials;
    }
    if (body.note !== undefined) {
      if (typeof body.note !== "string" || body.note.length > 1000) throw new ApiError(400, "Observação inválida.");
      changes.note = body.note.trim();
    }
    if (!Object.keys(changes).length) throw new ApiError(400, "Nenhuma alteração informada.");
    const db = adminDb();
    const base = db.collection("clinics").doc(user.clinicId);
    const ref = base.collection("appointments").doc(body.id);
    const sessionRef = base.collection("sessions").doc(body.id);
    await db.runTransaction(async transaction => {
      const [appointment, session] = await Promise.all([transaction.get(ref), transaction.get(sessionRef)]);
      if (!appointment.exists) throw new ApiError(404, "Agendamento não encontrado.");
      if (changes.status && changes.status !== "Concluído" && session.exists) throw new ApiError(409, "Este atendimento já tem uma sessão registrada. Exclua a sessão antes de reabrir ou cancelar.");
      if (changes.status === "Concluído") {
        const item = appointment.data() as AppointmentDocument;
        const now = saoPauloNow();
        const nowKey = `${now.year}-${now.month}-${now.day}T${now.hour}:${now.minute}`;
        if (`${item.date}T${item.time}` > nowKey) throw new ApiError(400, "Conclua o atendimento somente após o início do horário agendado.");
      }
      transaction.update(ref, { ...changes, updatedAt: new Date().toISOString() });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
