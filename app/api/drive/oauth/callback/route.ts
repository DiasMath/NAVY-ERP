import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { createDriveFolder, driveStatus, exchangeOAuthCode, googleAccountEmail, saveDriveConnection, verifyOAuthState } from "@/lib/server/google-drive";
import { permissionsForProfile, roleLabels, type UserRole } from "@/lib/access-control";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const destination = new URL("/configuracoes/integracoes", "https://navy-erp-ecru.vercel.app");
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state || request.nextUrl.searchParams.has("error")) throw new Error("OAuth cancelado ou incompleto");
    const { uid, clinicId } = verifyOAuthState(state);
    const profile = (await adminDb().doc(`users/${uid}`).get()).data();
    if (!profile || profile.active !== true || profile.clinicId !== clinicId || !Object.hasOwn(roleLabels, profile.role) || !permissionsForProfile({ role: profile.role as UserRole, permissions: profile.permissions }).includes("integrations.manage")) throw new Error("Administrador sem acesso ativo");
    const { accessToken, refreshToken } = await exchangeOAuthCode(code);
    const email = await googleAccountEmail(accessToken);
    const expectedEmail = (process.env.GOOGLE_DRIVE_OWNER_EMAIL ?? "").toLowerCase();
    if (!email || !expectedEmail || email !== expectedEmail) throw new Error("Conta Google diferente da proprietária configurada");
    const current = await driveStatus(clinicId);
    const folderId = current.connected && current.folderId ? current.folderId : await createDriveFolder(accessToken, "NAVY Clientes");
    await saveDriveConnection(clinicId, refreshToken, folderId, email);
    destination.searchParams.set("drive", "connected");
  } catch (error) {
    console.error("NAVY Drive OAuth", error);
    destination.searchParams.set("drive", "error");
  }
  return NextResponse.redirect(destination);
}
