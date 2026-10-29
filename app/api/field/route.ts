import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, requireNavyUser } from "@/lib/server/navy-auth";
import type { AppointmentDocument, ClientDocument } from "@/lib/firebase/documents";

export const runtime = "nodejs";

const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function GET(request: NextRequest) {
  try {
    const user = await requireNavyUser(request, "agenda.read");
    const adminPreview = user.role === "admin" || user.role === "master_admin";
    if ((!adminPreview && (user.role !== "professional" || !user.professionalId)) || !user.permissions.includes("clients.read") || !user.permissions.includes("sessions.read")) throw new ApiError(403, "Acesso indisponível para esta conta.");
    const base = adminDb().collection("clinics").doc(user.clinicId);
    const snapshot = adminPreview ? await base.collection("appointments").get() : await base.collection("appointments").where("professionalId", "==", user.professionalId).get();
    const today = dateKey();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const recentKey = cutoff.toISOString().slice(0, 10);
    const assigned = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as AppointmentDocument).filter(item => item.status !== "Cancelado");
    const future = assigned.filter(item => item.date >= today).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)).slice(0, 120);
    const recent = assigned.filter(item => item.date < today && item.date >= recentKey).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)).slice(0, 60);
    const appointments = [...future, ...recent].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const ids = [...new Set(appointments.map(item => item.clientId))];
    const clients = ids.length ? await adminDb().getAll(...ids.map(id => base.collection("clients").doc(id))) : [];
    const summaries = clients.filter(snapshot => snapshot.exists).map(snapshot => {
      const client = snapshot.data() as ClientDocument;
      return { id: snapshot.id, name: client.name, phone: client.phone, city: client.city ?? "" };
    });
    return NextResponse.json({ appointments, clients: summaries, today });
  } catch (error) { return apiError(error); }
}
