export const permissionCatalog = [
  { id: "clients.read", module: "Clientes", label: "Ver cadastros" },
  { id: "clients.write", module: "Clientes", label: "Criar e editar cadastros e fotos" },
  { id: "clients.delete", module: "Clientes", label: "Excluir cadastros" },
  { id: "sessions.read", module: "Prontuário", label: "Ver sessões e anotações" },
  { id: "sessions.write", module: "Prontuário", label: "Registrar e editar sessões" },
  { id: "sessions.delete", module: "Prontuário", label: "Excluir sessões" },
  { id: "services.read", module: "Serviços", label: "Ver catálogo e preços" },
  { id: "services.write", module: "Serviços", label: "Criar e editar serviços e imagens" },
  { id: "services.delete", module: "Serviços", label: "Excluir serviços" },
  { id: "professionals.read", module: "Profissionais", label: "Ver profissionais" },
  { id: "professionals.write", module: "Profissionais", label: "Gerenciar profissionais" },
  { id: "agenda.read", module: "Agenda", label: "Ver agendamentos" },
  { id: "agenda.write", module: "Agenda", label: "Criar e alterar agendamentos" },
  { id: "users.read", module: "Administração", label: "Ver usuários, acessos e configurações" },
  { id: "users.manage", module: "Administração", label: "Criar e administrar usuários" },
  { id: "access.manage", module: "Administração", label: "Gerenciar papéis, grupos e configurações" },
  { id: "integrations.read", module: "Integrações", label: "Ver integrações" },
  { id: "integrations.manage", module: "Integrações", label: "Conectar integrações" },
] as const;

export type NavyPermission = typeof permissionCatalog[number]["id"];
export type UserRole = "master_admin" | "admin" | "reception" | "professional" | "employee";
export const roleLabels: Record<UserRole, string> = {
  master_admin: "Equipe NAVY",
  admin: "Administração",
  reception: "Recepção",
  professional: "Profissional",
  employee: "Funcionário",
};

const allPermissions = permissionCatalog.map(item => item.id);
export const defaultPermissions: Record<UserRole, NavyPermission[]> = {
  master_admin: allPermissions,
  admin: allPermissions,
  reception: ["clients.read", "clients.write", "sessions.read", "sessions.write", "services.read", "professionals.read", "agenda.read", "agenda.write", "integrations.read"],
  professional: ["clients.read", "clients.write", "sessions.read", "sessions.write", "services.read", "professionals.read", "agenda.read", "agenda.write", "integrations.read"],
  employee: ["services.read", "professionals.read"],
};

const permissionIds = new Set<string>(allPermissions);
export function validPermissions(values: unknown): NavyPermission[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is NavyPermission => typeof value === "string" && permissionIds.has(value)))].sort();
}

export function permissionsForProfile(profile: { role: UserRole; permissions?: unknown }): NavyPermission[] {
  if (profile.role === "master_admin" || profile.role === "admin") return allPermissions;
  return Array.isArray(profile.permissions) ? validPermissions(profile.permissions) : defaultPermissions[profile.role];
}

export function hasPermission(profile: { role: UserRole; permissions?: unknown } | null | undefined, permission: NavyPermission): boolean {
  return Boolean(profile && permissionsForProfile(profile).includes(permission));
}
