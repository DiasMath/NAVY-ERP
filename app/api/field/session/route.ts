import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, assertDocumentId, requireNavyUser } from "@/lib/server/navy-auth";
import type { AppointmentDocument, ClinicalSessionDocument } from "@/lib/firebase/documents";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireNavyUser(request, "sessions.write");
    if (user.role !== "professional" || !user.professionalId) throw new ApiError(403, "Acesso exclusivo a profissionais.");
    const body = await request.json() as { appointmentId?: string; notes?: string };
    const appointmentId = body.appointmentId;
    const notes = body.notes;
    if (!appointmentId) throw new ApiError(400, "Agendamento não informado.");
    assertDocumentId(appointmentId);
    if (typeof notes !== "string" || notes.trim().length < 3 || notes.length > 2000) throw new ApiError(400, "Registre observações de 3 a 2000 caracteres.");
    const base = adminDb().collection("clinics").doc(user.clinicId);
    const appointmentRef = base.collection("appointments").doc(appointmentId);
    const sessionRef = base.collection("sessions").doc(appointmentId);
    const session = await adminDb().runTransaction(async transaction => {
      const [appointmentSnapshot, sessionSnapshot] = await Promise.all([transaction.get(appointmentRef), transaction.get(sessionRef)]);
      const appointment = appointmentSnapshot.data() as AppointmentDocument | undefined;
      if (!appointment || appointment.professionalId !== user.professionalId || appointment.status !== "Concluído") throw new ApiError(403, "Conclua um atendimento vinculado à sua conta antes de registrar a sessão.");
      if (sessionSnapshot.exists) throw new ApiError(409, "Esta sessão já foi registrada.");
      const now = new Date().toISOString();
      const duration = appointment.lines.reduce((sum, line) => sum + line.durationMinutes, 0);
      const record: ClinicalSessionDocument = {
        id: appointmentId, clientId: appointment.clientId, appointmentId,
        ...(appointment.bookingKind === "catalog" && appointment.lines.length === 1 ? { serviceId: appointment.lines[0].serviceId } : {}),
        startedAt: appointment.startedAt ?? now, completedAt: appointment.completedAt ?? now, serviceName: appointment.lines.map(line => line.name).join(" + "),
        durationLabel: `${duration} min`, amount: appointment.lines.reduce((sum, line) => sum + line.price, 0),
        paymentStatus: "pending", notes: notes.trim(), createdAt: now,
      };
      transaction.set(sessionRef, record);
      return record;
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) { return apiError(error); }
}
