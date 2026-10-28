import "server-only";
import { adminDb } from "./firebase-admin";
import { ApiError, type ServerNavyUser } from "./navy-auth";
import { defaultPermissions, validPermissions, type NavyPermission, type UserRole } from "@/lib/access-control";

export type AccessRecord = { id: string; name: string; permissions: NavyPermission[]; description: string };
export type ManagedUser = { uid: string; name: string; email: string; active: boolean; role: UserRole; roleId: string; groupIds: string[]; directPermissions: NavyPermission[]; professionalId: string; permissions: NavyPermission[]; createdAt?: string; lastSignInAt?: string; emailVerified?: boolean };
const assignableRoles: UserRole[] = ["admin", "reception", "professional", "employee"];

export function cleanName(value: unknown, label = "Nome") {
  if (typeof value !== "string") throw new ApiError(400, `${label} inválido.`);
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 100) throw new ApiError(400, `${label} deve ter de 3 a 100 caracteres.`);
  return name;
}

export function cleanPermissions(value: unknown) {
  if (!Array.isArray(value) || value.length > 30 || value.some(item => typeof item !== "string")) throw new ApiError(400, "Permissões inválidas.");
  const permissions = validPermissions(value);
  if (permissions.length !== new Set(value).size) throw new ApiError(400, "Há permissões desconhecidas.");
  return permissions;
}

export function cleanIds(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 30 || value.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) throw new ApiError(400, `${label} inválidos.`);
  return [...new Set(value as string[])];
}

export function assertCanGrant(actor: ServerNavyUser, permissions: NavyPermission[]) {
  if (permissions.some(permission => !actor.permissions.includes(permission))) throw new ApiError(403, "Você só pode conceder permissões que já possui.");
}

export async function accessCatalog(clinicId: string) {
  const base = adminDb().collection("clinics").doc(clinicId);
  const [roles, groups] = await Promise.all([base.collection("accessRoles").get(), base.collection("accessGroups").get()]);
  const map = (snapshot: typeof roles) => snapshot.docs.map(doc => ({ id: doc.id, name: String(doc.data().name ?? ""), description: String(doc.data().description ?? ""), permissions: validPermissions(doc.data().permissions) }));
  return { roles: map(roles), groups: map(groups) };
}

export function effectivePermissions(role: UserRole, roleId: string, groupIds: string[], directPermissions: NavyPermission[], catalog: Awaited<ReturnType<typeof accessCatalog>>) {
  const custom = roleId ? catalog.roles.find(item => item.id === roleId) : undefined;
  if (roleId && !custom) throw new ApiError(400, "Papel não encontrado.");
  if (roleId && groupIds.length) throw new ApiError(400, "Escolha um grupo ou um papel personalizado.");
  const groups = groupIds.map(id => {
    const group = catalog.groups.find(item => item.id === id);
    if (!group) throw new ApiError(400, "Grupo não encontrado.");
    return group;
  });
  const base = groups.length ? [] : custom?.permissions ?? defaultPermissions[role];
  return validPermissions([...base, ...groups.flatMap(group => group.permissions), ...directPermissions]);
}

export function cleanUserAssignment(body: Record<string, unknown>, catalog: Awaited<ReturnType<typeof accessCatalog>>, actor: ServerNavyUser) {
  if (!assignableRoles.includes(body.role as UserRole)) throw new ApiError(400, "Papel base inválido.");
  const role = body.role as UserRole;
  const roleId = typeof body.roleId === "string" ? body.roleId : "";
  const groupIds = cleanIds(body.groupIds ?? [], "Grupos");
  if (groupIds.length > 1) throw new ApiError(400, "Escolha um grupo principal por usuário.");
  const directPermissions = cleanPermissions(body.directPermissions ?? []);
  const permissions = effectivePermissions(role, roleId, groupIds, directPermissions, catalog);
  assertCanGrant(actor, permissions);
  return { role, roleId, groupIds, directPermissions, permissions };
}

export function managedUser(uid: string, data: Record<string, unknown>): ManagedUser {
  const role = assignableRoles.includes(data.role as UserRole) || data.role === "master_admin" ? data.role as UserRole : "employee";
  return { uid, name: String(data.name ?? ""), email: String(data.email ?? ""), active: data.active === true, role, roleId: String(data.roleId ?? ""), groupIds: Array.isArray(data.groupIds) ? data.groupIds.filter((id): id is string => typeof id === "string") : [], directPermissions: validPermissions(data.directPermissions), professionalId: String(data.professionalId ?? ""), permissions: Array.isArray(data.permissions) ? validPermissions(data.permissions) : defaultPermissions[role], createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined };
}
