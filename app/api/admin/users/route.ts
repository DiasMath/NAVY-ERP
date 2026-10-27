import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, assertDocumentId, requireNavyUser } from "@/lib/server/navy-auth";
import { accessCatalog, cleanName, cleanUserAssignment, managedUser } from "@/lib/server/admin-access";

export const runtime = "nodejs";

function emailAddress(value: unknown) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new ApiError(400, "Informe um e-mail válido.");
  return value.trim().toLowerCase();
}

async function professionalLink(clinicId: string, professionalId: string, createProfessional: boolean, uid: string) {
  if (!professionalId && !createProfessional) return "";
  if (createProfessional) return uid;
  assertDocumentId(professionalId);
  const db = adminDb();
  const ref = db.doc(`clinics/${clinicId}/professionals/${professionalId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(400, "Profissional não encontrada.");
  if (snapshot.data()?.userUid && snapshot.data()?.userUid !== uid) throw new ApiError(409, "Esta profissional já está vinculada a outra conta.");
  const linked = await db.collection("users").where("clinicId", "==", clinicId).where("professionalId", "==", professionalId).get();
  if (linked.docs.some(doc => doc.id !== uid)) throw new ApiError(409, "Esta profissional já está vinculada a outra conta.");
  return professionalId;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.read");
    const snapshot = await adminDb().collection("users").where("clinicId", "==", actor.clinicId).get();
    const users = await Promise.all(snapshot.docs.map(async doc => {
      const item = managedUser(doc.id, doc.data());
      if (!item.email) {
        try { item.email = (await adminAuth().getUser(doc.id)).email ?? ""; } catch { /* Conta legada sem e-mail recuperável. */ }
      }
      return item;
    }));
    const professionals = actor.permissions.includes("professionals.read") ? (await adminDb().collection("clinics").doc(actor.clinicId).collection("professionals").get()).docs.map(doc => ({ id: doc.id, name: String(doc.data().name ?? ""), active: doc.data().active !== false, userUid: String(doc.data().userUid ?? "") })) : [];
    return NextResponse.json({ users: users.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), professionals });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.manage");
    const body = await request.json() as Record<string, unknown>;
    const name = cleanName(body.name);
    const email = emailAddress(body.email);
    const active = body.active !== false;
    const catalog = await accessCatalog(actor.clinicId);
    const assignment = cleanUserAssignment(body, catalog, actor);
    const createProfessional = body.createProfessional === true;
    const requestedProfessionalId = typeof body.professionalId === "string" ? body.professionalId : "";
    if (createProfessional && requestedProfessionalId) throw new ApiError(400, "Escolha uma forma de vínculo profissional.");
    if (assignment.role === "professional" && !createProfessional && !requestedProfessionalId) throw new ApiError(400, "Vincule ou crie a profissional para este usuário.");
    const authUser = await adminAuth().createUser({ email, displayName: name, password: `${crypto.randomUUID()}${crypto.randomUUID()}`, disabled: !active });
    try {
      const uid = authUser.uid;
      const professionalId = await professionalLink(actor.clinicId, requestedProfessionalId, createProfessional, uid);
      const db = adminDb();
      const batch = db.batch();
      const now = new Date().toISOString();
      batch.set(db.doc(`users/${uid}`), { uid, name, email, clinicId: actor.clinicId, active, ...assignment, professionalId, createdAt: now, updatedAt: now });
      if (professionalId) batch.set(db.doc(`clinics/${actor.clinicId}/professionals/${professionalId}`), { id: professionalId, name, active, userUid: uid, updatedAt: now, ...(createProfessional ? { createdAt: now } : {}) }, { merge: true });
      await batch.commit();
      return NextResponse.json({ uid, email, inviteNeeded: active }, { status: 201 });
    } catch (error) {
      await adminAuth().deleteUser(authUser.uid).catch(() => {});
      throw error;
    }
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/email-already-exists") return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.manage");
    const body = await request.json() as Record<string, unknown>;
    const uid = typeof body.uid === "string" ? body.uid : "";
    assertDocumentId(uid);
    const name = cleanName(body.name);
    if (typeof body.active !== "boolean") throw new ApiError(400, "Status inválido.");
    const active = body.active;
    const db = adminDb();
    const ref = db.doc(`users/${uid}`);
    const snapshot = await ref.get();
    const previous = snapshot.data();
    if (!previous || previous.clinicId !== actor.clinicId) throw new ApiError(404, "Usuário não encontrado.");
    if (previous.role === "master_admin") throw new ApiError(403, "A conta principal é protegida.");
    if (uid === actor.uid) throw new ApiError(403, "Altere sua própria conta por outro administrador.");
    if (!active && previous.active === true && typeof previous.professionalId === "string" && previous.professionalId) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      const upcoming = await db.collection("clinics").doc(actor.clinicId).collection("appointments").where("professionalId", "==", previous.professionalId).get();
      if (upcoming.docs.some(doc => doc.data().date >= today && doc.data().status !== "Cancelado")) throw new ApiError(409, "Reagende ou cancele os compromissos futuros desta profissional antes de desativar a conta.");
    }
    const catalog = await accessCatalog(actor.clinicId);
    const assignment = cleanUserAssignment(body, catalog, actor);
    const createProfessional = body.createProfessional === true;
    const requestedProfessionalId = typeof body.professionalId === "string" ? body.professionalId : "";
    if (createProfessional && requestedProfessionalId) throw new ApiError(400, "Escolha uma forma de vínculo profissional.");
    if (assignment.role === "professional" && !createProfessional && !requestedProfessionalId) throw new ApiError(400, "Vincule ou crie a profissional para este usuário.");
    const professionalId = await professionalLink(actor.clinicId, requestedProfessionalId, createProfessional, uid);
    if (professionalId && professionalId !== previous.professionalId) {
      const linked = await db.collection("users").where("clinicId", "==", actor.clinicId).where("professionalId", "==", professionalId).get();
      if (linked.docs.some(doc => doc.id !== uid)) throw new ApiError(409, "Esta profissional já está vinculada a outra conta.");
    }
    const authBefore = await adminAuth().getUser(uid);
    await adminAuth().updateUser(uid, { displayName: name, disabled: !active });
    try {
      const now = new Date().toISOString();
      const batch = db.batch();
      batch.update(ref, { name, active, ...assignment, professionalId, updatedAt: now });
      if (previous.professionalId && previous.professionalId !== professionalId) {
        const oldRef = db.doc(`clinics/${actor.clinicId}/professionals/${previous.professionalId}`);
        if ((await oldRef.get()).exists) batch.update(oldRef, { userUid: "", updatedAt: now });
      }
      if (professionalId) batch.set(db.doc(`clinics/${actor.clinicId}/professionals/${professionalId}`), { id: professionalId, name, active, userUid: uid, updatedAt: now, ...(createProfessional ? { createdAt: now } : {}) }, { merge: true });
      await batch.commit();
      return NextResponse.json({ ok: true });
    } catch (error) {
      await adminAuth().updateUser(uid, { displayName: authBefore.displayName, disabled: authBefore.disabled }).catch(() => {});
      throw error;
    }
  } catch (error) { return apiError(error); }
}
