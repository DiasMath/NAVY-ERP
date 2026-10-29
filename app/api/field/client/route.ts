import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, assertAssignedClient, requireClient, requireNavyUser } from "@/lib/server/navy-auth";
import type { ClinicalSessionDocument } from "@/lib/firebase/documents";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireNavyUser(request, "clients.read");
    if (user.role !== "professional") throw new ApiError(403, "Acesso exclusivo a profissionais.");
    const clientId = request.nextUrl.searchParams.get("clientId") ?? "";
    const { data } = await requireClient(user.clinicId, clientId);
    await assertAssignedClient(user, clientId);
    const appointments = await adminDb().collection(`clinics/${user.clinicId}/appointments`).where("clientId", "==", clientId).get();
    const ownAppointmentIds = new Set(appointments.docs.filter(snapshot => snapshot.data().professionalId === user.professionalId).map(snapshot => snapshot.id));
    const sessions = user.permissions.includes("sessions.read")
      ? await adminDb().collection(`clinics/${user.clinicId}/sessions`).where("clientId", "==", clientId).get()
      : null;
    const history = sessions?.docs.filter(snapshot => ownAppointmentIds.has(snapshot.data().appointmentId)).map(snapshot => {
      const item = snapshot.data() as ClinicalSessionDocument;
      return { id: snapshot.id, appointmentId: item.appointmentId ?? "", serviceName: item.serviceName, startedAt: item.startedAt, notes: item.notes ?? "" };
    }).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30) ?? [];
    return NextResponse.json({ client: { id: clientId, name: data.name, phone: data.phone, city: data.city ?? "", clinicalNote: data.clinicalNote ?? "", preferences: data.preferences ?? "" }, history });
  } catch (error) { return apiError(error); }
}
