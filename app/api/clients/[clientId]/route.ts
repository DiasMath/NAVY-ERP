import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { apiError, ApiError, requireClient, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, true);
    const { clientId } = await context.params;
    const { ref, data } = await requireClient(user.clinicId, clientId);
    const photos = await adminDb().collection(`clinics/${user.clinicId}/clientPhotos`).where("clientId", "==", clientId).limit(1).get();
    if (data.avatarDriveFileId || !photos.empty) throw new ApiError(409, "Remova as fotos da cliente antes de excluir o cadastro.");
    const sessions = await adminDb().collection(`clinics/${user.clinicId}/sessions`).where("clientId", "==", clientId).get();
    if (sessions.size > 498) throw new ApiError(409, "Há muitas sessões para excluir de uma vez. Contate a administração.");
    const batch = adminDb().batch();
    for (const session of sessions.docs) batch.delete(session.ref);
    batch.delete(ref);
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
