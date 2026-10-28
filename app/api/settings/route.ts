import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, requireNavyUser } from "@/lib/server/navy-auth";
import { displaySettings, isSettingsSection, settingsConfig } from "@/lib/settings-schema";
import { validateSettings } from "@/lib/server/settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.read");
    const section = request.nextUrl.searchParams.get("section");
    if (!isSettingsSection(section)) throw new ApiError(400, "Seção inválida.");
    const snapshot = await adminDb().doc(`clinics/${actor.clinicId}/settings/${section}`).get();
    const data = snapshot.data();
    return NextResponse.json({ section, values: displaySettings(section, data), updatedAt: data?.updatedAt ?? null, revision: Number.isInteger(data?.revision) ? data!.revision : 0 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "access.manage");
    const body = await request.json() as Record<string, unknown>;
    const section = body.section;
    if (!isSettingsSection(section)) throw new ApiError(400, "Seção inválida.");
    const expectedRevision = body.expectedRevision;
    if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ApiError(400, "Versão das configurações inválida.");
    const values = validateSettings(section, body.values);
    const db = adminDb();
    const base = db.collection("clinics").doc(actor.clinicId);
    const now = new Date().toISOString();
    const ref = base.collection("settings").doc(section);
    const revision = await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      const currentRevision = Number.isInteger(current.data()?.revision) ? current.data()!.revision as number : 0;
      if (currentRevision !== expectedRevision) throw new ApiError(409, "Estas configurações foram alteradas por outra pessoa. Recarregue a seção antes de salvar.");
      const nextRevision = currentRevision + 1;
      transaction.set(ref, { ...values, updatedAt: now, updatedBy: actor.uid, revision: nextRevision });
      transaction.set(base.collection("accessAudit").doc(), { actorUid: actor.uid, action: "settings.updated", targetId: section, targetName: settingsConfig[section].title, createdAt: now });
      return nextRevision;
    });
    return NextResponse.json({ section, values: displaySettings(section, values), updatedAt: now, revision });
  } catch (error) { return apiError(error); }
}
