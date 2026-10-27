import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { downloadDriveImage } from "@/lib/server/google-drive";
import { apiError, assertDocumentId, requireClient, requireNavyUser, ApiError } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string; imageId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, "clients.read");
    const { clientId, imageId } = await context.params;
    const { data } = await requireClient(user.clinicId, clientId);
    let fileId: string | undefined;
    if (imageId === "avatar") fileId = data.avatarDriveFileId;
    else {
      assertDocumentId(imageId);
      const photo = (await adminDb().doc(`clinics/${user.clinicId}/clientPhotos/${imageId}`).get()).data();
      if (photo?.clientId === clientId) fileId = photo.driveFileId;
    }
    if (!fileId) throw new ApiError(404, "Imagem não encontrada.");
    const response = await downloadDriveImage(user.clinicId, fileId);
    return new NextResponse(response.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
