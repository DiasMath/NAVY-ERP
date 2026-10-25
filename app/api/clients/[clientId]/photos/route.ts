import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { deleteDriveFile, uploadDriveJpeg } from "@/lib/server/google-drive";
import { prepareJpeg } from "@/lib/server/drive-images";
import { apiError, requireClient, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request);
    const { clientId } = await context.params;
    await requireClient(user.clinicId, clientId);
    const snapshot = await adminDb().collection(`clinics/${user.clinicId}/clientPhotos`).where("clientId", "==", clientId).get();
    const photos = snapshot.docs.map(item => ({ id: item.id, name: item.get("name") as string, createdAt: item.get("createdAt") as string })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ photos });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request);
    const { clientId } = await context.params;
    await requireClient(user.clinicId, clientId);
    const form = await request.formData();
    if (form.get("consentConfirmed") !== "true") return NextResponse.json({ error: "Confirme o consentimento da cliente antes de enviar." }, { status: 400 });
    const input = form.get("file");
    const image = await prepareJpeg(input, "gallery");
    const id = crypto.randomUUID();
    const name = input instanceof File ? input.name.slice(0, 160) : "Foto";
    const driveFileId = await uploadDriveJpeg(user.clinicId, `foto-${clientId}-${id}.jpg`, image);
    try {
      await adminDb().doc(`clinics/${user.clinicId}/clientPhotos/${id}`).set({ clientId, driveFileId, name, mimeType: "image/jpeg", createdAt: new Date().toISOString(), consentConfirmedBy: user.uid });
    } catch (error) { await deleteDriveFile(user.clinicId, driveFileId).catch(() => {}); throw error; }
    return NextResponse.json({ id, name }, { status: 201 });
  } catch (error) { return apiError(error); }
}
