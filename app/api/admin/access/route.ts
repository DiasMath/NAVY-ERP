import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { ApiError, apiError, assertDocumentId, requireNavyUser } from "@/lib/server/navy-auth";
import { accessCatalog, assertCanGrant, cleanName, cleanPermissions, effectivePermissions } from "@/lib/server/admin-access";
import type { UserRole } from "@/lib/access-control";

export const runtime = "nodejs";
type Kind = "role" | "group";
const segment = (kind: Kind) => kind === "role" ? "accessRoles" : "accessGroups";
function parseKind(value: unknown): Kind {
  if (value !== "role" && value !== "group") throw new ApiError(400, "Tipo inválido.");
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "users.read");
    return NextResponse.json(await accessCatalog(actor.clinicId));
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "access.manage");
    const body = await request.json() as Record<string, unknown>;
    const kind = parseKind(body.kind);
    const name = cleanName(body.name, kind === "role" ? "Papel" : "Grupo");
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
    const permissions = cleanPermissions(body.permissions);
    assertCanGrant(actor, permissions);
    const base = adminDb().collection("clinics").doc(actor.clinicId);
    const collection = base.collection(segment(kind));
    const existing = await collection.get();
    if (existing.docs.some(doc => String(doc.data().name).toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) throw new ApiError(409, "Já existe um item com este nome.");
    const ref = collection.doc();
    await ref.set({ name, description, permissions, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "access.manage");
    const body = await request.json() as Record<string, unknown>;
    const kind = parseKind(body.kind);
    if (typeof body.id !== "string") throw new ApiError(400, "Identificador não informado.");
    assertDocumentId(body.id);
    const name = cleanName(body.name, kind === "role" ? "Papel" : "Grupo");
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
    const permissions = cleanPermissions(body.permissions);
    assertCanGrant(actor, permissions);
    const db = adminDb();
    const base = db.collection("clinics").doc(actor.clinicId);
    const ref = base.collection(segment(kind)).doc(body.id);
    if (!(await ref.get()).exists) throw new ApiError(404, "Item não encontrado.");
    const catalog = await accessCatalog(actor.clinicId);
    const newCatalog = { ...catalog, [kind === "role" ? "roles" : "groups"]: catalog[kind === "role" ? "roles" : "groups"].map(item => item.id === body.id ? { id: body.id as string, name, description, permissions } : item) };
    const affected = await db.collection("users").where("clinicId", "==", actor.clinicId).get();
    const updates = affected.docs.filter(doc => kind === "role" ? doc.data().roleId === body.id : Array.isArray(doc.data().groupIds) && doc.data().groupIds.includes(body.id)).map(doc => {
      const data = doc.data();
      const next = effectivePermissions(data.role as UserRole, String(data.roleId ?? ""), Array.isArray(data.groupIds) ? data.groupIds : [], newCatalog);
      assertCanGrant(actor, next);
      return { ref: doc.ref, permissions: next };
    });
    if (updates.length > 450) throw new ApiError(409, "Muitos usuários vinculados. Contate o suporte para atualizar este papel.");
    const batch = db.batch();
    batch.update(ref, { name, description, permissions, updatedAt: new Date().toISOString() });
    updates.forEach(item => batch.update(item.ref, { permissions: item.permissions, updatedAt: new Date().toISOString() }));
    await batch.commit();
    return NextResponse.json({ ok: true, updatedUsers: updates.length });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireNavyUser(request, "access.manage");
    const kind = parseKind(request.nextUrl.searchParams.get("kind"));
    const id = request.nextUrl.searchParams.get("id") ?? "";
    assertDocumentId(id);
    const db = adminDb();
    const base = db.collection("clinics").doc(actor.clinicId);
    const ref = base.collection(segment(kind)).doc(id);
    if (!(await ref.get()).exists) throw new ApiError(404, "Item não encontrado.");
    const users = await db.collection("users").where("clinicId", "==", actor.clinicId).get();
    if (users.docs.some(doc => kind === "role" ? doc.data().roleId === id : Array.isArray(doc.data().groupIds) && doc.data().groupIds.includes(id))) throw new ApiError(409, "Remova os usuários deste papel ou grupo antes de excluí-lo.");
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
