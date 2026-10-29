import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { permissionsForProfile, type NavyPermission, type UserRole } from "@/lib/access-control";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type ServerNavyUser = { uid: string; clinicId: string; role: UserRole; professionalId?: string; permissions: NavyPermission[] };
const roles: UserRole[] = ["master_admin", "admin", "reception", "professional", "employee"];

export async function requireNavyUser(request: NextRequest, permission?: NavyPermission): Promise<ServerNavyUser> {
  const token = /^Bearer (.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new ApiError(401, "Faça login para continuar.");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token, true)).uid; }
  catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    if (code.startsWith("app/")) {
      console.error("NAVY Firebase Admin indisponível", code);
      throw new ApiError(503, "Autenticação do servidor indisponível. Tente novamente em instantes.");
    }
    console.warn("NAVY ID token rejeitado", code);
    throw new ApiError(401, "Sessão expirada. Entre novamente.");
  }
  const snapshot = await adminDb().doc(`users/${uid}`).get();
  const data = snapshot.data();
  if (!data || data.active !== true || typeof data.clinicId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.clinicId) || !roles.includes(data.role)) throw new ApiError(403, "Esta conta não tem acesso ativo à NAVY.");
  const role = data.role as UserRole;
  const professionalId = typeof data.professionalId === "string" ? data.professionalId : undefined;
  if (role === "professional") {
    if (!professionalId) throw new ApiError(403, "Vincule esta conta a uma profissional ativa.");
    assertDocumentId(professionalId);
    const linked = (await adminDb().doc(`clinics/${data.clinicId}/professionals/${professionalId}`).get()).data();
    if (!linked || linked.active !== true || linked.userUid !== uid) throw new ApiError(403, "O vínculo profissional desta conta está inativo.");
  }
  const permissions = permissionsForProfile({ role, permissions: data.permissions });
  if (permission && !permissions.includes(permission)) throw new ApiError(403, "Você não tem permissão para realizar esta ação.");
  return { uid, clinicId: data.clinicId, role, professionalId, permissions };
}

export function assertDocumentId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ApiError(400, "Identificador inválido.");
}

export async function requireClient(clinicId: string, clientId: string) {
  assertDocumentId(clientId);
  const ref = adminDb().doc(`clinics/${clinicId}/clients/${clientId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Cliente não encontrada.");
  return { ref, data: snapshot.data()! };
}

export async function assertAssignedClient(user: ServerNavyUser, clientId: string) {
  if (user.role !== "professional") return;
  assertDocumentId(clientId);
  const appointments = await adminDb().collection(`clinics/${user.clinicId}/appointments`).where("clientId", "==", clientId).get();
  if (!appointments.docs.some(item => item.data().professionalId === user.professionalId && item.data().status !== "Cancelado")) {
    throw new ApiError(403, "Esta cliente não está vinculada aos seus atendimentos.");
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("NAVY API error", error);
  return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 500 });
}
