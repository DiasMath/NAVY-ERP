import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { deleteDriveFile } from "@/lib/server/google-drive";
import { apiError, assertAssignedClient, assertDocumentId, requireClient, requireNavyUser, ApiError } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string; photoId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, "clients.write");
    const { clientId, photoId } = await context.params;
    await requireClient(user.clinicId, clientId);
    await assertAssignedClient(user, clientId);
    assertDocumentId(photoId);
    const ref = adminDb().doc(`clinics/${user.clinicId}/clientPhotos/${photoId}`);
    const snapshot = await ref.get();
    const photo = snapshot.data();
    if (!photo || photo.clientId !== clientId) throw new ApiError(404, "Foto não encontrada.");
    if (user.role === "professional" && photo.consentConfirmedBy !== user.uid) throw new ApiError(403, "Você pode remover apenas fotos que enviou.");
    await deleteDriveFile(user.clinicId, photo.driveFileId);
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
