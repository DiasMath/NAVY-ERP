import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type ServerNavyUser = { uid: string; clinicId: string; role: "master_admin" | "admin" | "reception" | "professional" };
const roles = ["master_admin", "admin", "reception", "professional"];

export async function requireNavyUser(request: NextRequest, manager = false): Promise<ServerNavyUser> {
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
  if (manager && !["master_admin", "admin"].includes(data.role)) throw new ApiError(403, "Apenas administradores podem realizar esta ação.");
  return { uid, clinicId: data.clinicId, role: data.role };
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

export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("NAVY API error", error);
  return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 500 });
}
