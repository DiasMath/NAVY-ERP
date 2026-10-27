import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { apiError, ApiError, requireClient, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, "clients.delete");
    const { clientId } = await context.params;
    const { ref, data } = await requireClient(user.clinicId, clientId);
    const photos = await adminDb().collection(`clinics/${user.clinicId}/clientPhotos`).where("clientId", "==", clientId).limit(1).get();
    if (data.avatarDriveFileId || !photos.empty) throw new ApiError(409, "Remova as fotos da cliente antes de excluir o cadastro.");
    const appointments = await adminDb().collection(`clinics/${user.clinicId}/appointments`).where("clientId", "==", clientId).get();
    const todayParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    if (appointments.docs.some(item => item.data().status !== "Cancelado" && item.data().date >= today)) throw new ApiError(409, "Cancele os agendamentos futuros desta cliente antes de excluir o cadastro.");
    const sessions = await adminDb().collection(`clinics/${user.clinicId}/sessions`).where("clientId", "==", clientId).get();
    if (sessions.size + appointments.size > 498) throw new ApiError(409, "Há muitos registros vinculados para excluir de uma vez. Contate a administração.");
    const batch = adminDb().batch();
    for (const session of sessions.docs) batch.delete(session.ref);
    for (const appointment of appointments.docs) batch.delete(appointment.ref);
    batch.delete(ref);
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
