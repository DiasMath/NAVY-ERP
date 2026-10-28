import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";

// Migração única solicitada pelo proprietário. Esta rota será removida após a execução.
export async function POST(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.manage");
    const snapshot = await adminDb().collection("users").where("clinicId", "==", actor.clinicId).get();
    const owners = snapshot.docs.filter(doc => doc.data().role === "master_admin");
    if (owners.length !== 1) throw new ApiError(409, "A conta proprietária não foi identificada com segurança.");
    const target = owners[0];
    const previous = await adminAuth().getUser(target.id);
    await adminAuth().updateUser(target.id, { displayName: "Matheus Dias" });
    try { await target.ref.update({ name: "Matheus Dias", updatedAt: new Date().toISOString() }); }
    catch (error) { await adminAuth().updateUser(target.id, { displayName: previous.displayName }).catch(() => {}); throw error; }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
