import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { deleteDriveFile, uploadDriveJpeg } from "@/lib/server/google-drive";
import { prepareJpeg } from "@/lib/server/drive-images";
import { apiError, requireClient, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ clientId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, "clients.read");
    const { clientId } = await context.params;
    const { ref, data } = await requireClient(user.clinicId, clientId);
    const image = await prepareJpeg((await request.formData()).get("file"), "avatar");
    const fileId = await uploadDriveJpeg(user.clinicId, `avatar-${clientId}-${crypto.randomUUID()}.jpg`, image);
    try { await ref.update({ avatarDriveFileId: fileId, updatedAt: new Date().toISOString() }); }
    catch (error) { await deleteDriveFile(user.clinicId, fileId).catch(() => {}); throw error; }
    if (typeof data.avatarDriveFileId === "string") await deleteDriveFile(user.clinicId, data.avatarDriveFileId).catch(error => console.error("NAVY old avatar cleanup", error));
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireNavyUser(request, "clients.write");
    const { clientId } = await context.params;
    const { ref, data } = await requireClient(user.clinicId, clientId);
    if (typeof data.avatarDriveFileId !== "string") return NextResponse.json({ ok: true });
    await deleteDriveFile(user.clinicId, data.avatarDriveFileId);
    await ref.update({ avatarDriveFileId: FieldValue.delete(), updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
