import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { deleteDriveFile, downloadDriveImage, uploadDriveJpeg } from "@/lib/server/google-drive";
import { prepareJpeg } from "@/lib/server/drive-images";
import { apiError, ApiError, assertDocumentId, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

async function service(clinicId: string, serviceId: string) {
  assertDocumentId(serviceId);
  const ref = adminDb().doc(`clinics/${clinicId}/services/${serviceId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Procedimento não encontrado.");
  return { ref, data: snapshot.data()! };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request);
    const { serviceId } = await context.params;
    const { data } = await service(user.clinicId, serviceId);
    if (typeof data.imageDriveFileId !== "string") throw new ApiError(404, "Imagem não encontrada.");
    const response = await downloadDriveImage(user.clinicId, data.imageDriveFileId);
    return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, true);
    const { serviceId } = await context.params;
    const { ref, data } = await service(user.clinicId, serviceId);
    const image = await prepareJpeg((await request.formData()).get("file"), "gallery");
    const fileId = await uploadDriveJpeg(user.clinicId, `servico-${serviceId}-${crypto.randomUUID()}.jpg`, image);
    try { await ref.update({ imageDriveFileId: fileId, updatedAt: new Date().toISOString().slice(0, 10) }); }
    catch (error) { await deleteDriveFile(user.clinicId, fileId).catch(() => {}); throw error; }
    if (typeof data.imageDriveFileId === "string") await deleteDriveFile(user.clinicId, data.imageDriveFileId).catch(error => console.error("NAVY old service image cleanup", error));
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, true);
    const { serviceId } = await context.params;
    const { ref, data } = await service(user.clinicId, serviceId);
    if (typeof data.imageDriveFileId !== "string") return NextResponse.json({ ok: true });
    await deleteDriveFile(user.clinicId, data.imageDriveFileId);
    await ref.update({ imageDriveFileId: FieldValue.delete(), updatedAt: new Date().toISOString().slice(0, 10) });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
