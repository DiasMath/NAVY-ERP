"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import ContentDialog from "@/components/ContentDialog";
import ContentSkeleton from "@/components/ContentSkeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFirebaseClient } from "@/lib/firebase/client";
import { navyApi } from "@/lib/firebase/navy-api";
import { defaultPermissions, permissionCatalog, roleLabels, validPermissions, type NavyPermission, type UserRole } from "@/lib/access-control";
import type { AccessRecord, ManagedUser } from "@/lib/server/admin-access";
import "./users.css";

type Tab = "users" | "roles" | "groups";
type Filter = "all" | "admin" | "professional" | "reception" | "employee" | "inactive";
type Professional = { id: string; name: string; active: boolean; userUid: string };
type AuditRecord = { id: string; actorUid: string; action: string; targetId: string; targetName: string; createdAt: string };
type AccessData = { roles: AccessRecord[]; groups: AccessRecord[]; audit: AuditRecord[] };
type UserForm = { uid: string; name: string; email: string; active: boolean; role: UserRole; roleId: string; groupIds: string[]; directPermissions: NavyPermission[]; professionalId: string; createProfessional: boolean };
type AccessForm = { kind: "role" | "group"; id: string; name: string; description: string; permissions: NavyPermission[] };

const roleOptions: UserRole[] = ["admin", "reception", "professional", "employee"];
const modules = [...new Set(permissionCatalog.map(item => item.module))];
const blankUser = (): UserForm => ({ uid: "", name: "", email: "", active: true, role: "employee", roleId: "", groupIds: [], directPermissions: [], professionalId: "", createProfessional: false });
const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;

function formatDate(value?: string) {
  if (!value) return "Nunca acessou";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nunca acessou" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function permissionSummary(permissions: NavyPermission[], module: string) {
  const matching = permissionCatalog.filter(item => item.module === module && permissions.includes(item.id));
  if (!matching.length) return "—";
  return matching.some(item => /write|manage|delete/.test(item.id)) ? "Gerenciar" : "Consultar";
}

function PermissionGrid({ selected, onChange, allowed }: { selected: NavyPermission[]; onChange: (next: NavyPermission[]) => void; allowed?: NavyPermission[] }) {
  return <div className="ad-permissions">{modules.map(module => <fieldset key={module}><legend>{module}</legend>{permissionCatalog.filter(item => item.module === module).map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={allowed ? !allowed.includes(item.id) : false} onChange={event => onChange(validPermissions(event.target.checked ? [...selected, item.id] : selected.filter(value => value !== item.id)))} /><span>{item.label}</span></label>)}</fieldset>)}</div>;
}

export default function UsersPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [filter, setFilter] = useState<Filter>("all");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [access, setAccess] = useState<AccessData>({ roles: [], groups: [], audit: [] });
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [accessForm, setAccessForm] = useState<AccessForm | null>(null);
  const canManageUsers = Boolean(profile?.permissions.includes("users.manage"));
  const canManageAccess = Boolean(profile?.permissions.includes("access.manage"));

  const reload = useCallback(async () => {
    if (!user) return;
    const [userResponse, accessResponse] = await Promise.all([navyApi(user, "/api/admin/users"), navyApi(user, "/api/admin/access")]);
    const userData = await userResponse.json() as { users: ManagedUser[]; professionals: Professional[] };
    const accessData = await accessResponse.json() as AccessData;
    setUsers(userData.users);
    setProfessionals(userData.professionals);
    setAccess({ ...accessData, audit: accessData.audit ?? [] });
    setLoadedData(true);
    setError("");
  }, [user]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    reload().catch(cause => { if (active) { setLoadedData(false); setError(cause instanceof Error ? cause.message : "Não foi possível carregar os acessos."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const retry = () => { setLoading(true); reload().catch(cause => { setLoadedData(false); setError(cause instanceof Error ? cause.message : "Não foi possível carregar os acessos."); }).finally(() => setLoading(false)); };

  const effective = useMemo(() => {
    if (!userForm) return [];
    const group = access.groups.find(item => item.id === userForm.groupIds[0]);
    const customRole = access.roles.find(item => item.id === userForm.roleId);
    const base = group ? group.permissions : customRole?.permissions ?? defaultPermissions[userForm.role];
    return validPermissions([...base, ...userForm.directPermissions]);
  }, [userForm, access]);
  const filtered = users.filter(item => {
    const roleName = item.roleId ? access.roles.find(role => role.id === item.roleId)?.name ?? "" : roleLabels[item.role];
    const groupName = access.groups.find(group => item.groupIds.includes(group.id))?.name ?? "";
    const search = (item.name + " " + item.email + " " + roleName + " " + groupName).toLocaleLowerCase("pt-BR");
    return search.includes(query.toLocaleLowerCase("pt-BR")) && (filter === "all" || (filter === "inactive" ? !item.active : item.role === filter));
  });
  const pending = users.filter(item => item.active && !item.lastSignInAt).length;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: users.length },
    { id: "admin", label: "Administração", count: users.filter(item => item.role === "admin").length },
    { id: "professional", label: "Profissionais", count: users.filter(item => item.role === "professional").length },
    { id: "reception", label: "Recepção", count: users.filter(item => item.role === "reception").length },
    { id: "employee", label: "Funcionários", count: users.filter(item => item.role === "employee").length },
    { id: "inactive", label: "Inativos", count: users.filter(item => !item.active).length },
  ];

  const request = async (path: string, method: string, body: unknown) => {
    if (!user) throw new Error("Faça login para continuar.");
    const response = await navyApi(user, path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return response.json();
  };
  const invite = async (email: string) => {
    await sendPasswordResetEmail(getFirebaseClient().auth, email);
    setNotice("E-mail de acesso enviado para " + email + ".");
  };
  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!userForm || busy || !canManageUsers || userForm.uid === profile?.uid || userForm.role === "master_admin") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const created = !userForm.uid;
      const result = await request("/api/admin/users", created ? "POST" : "PATCH", userForm) as { email?: string };
      setUserForm(null);
      try { await reload(); } catch { setLoadedData(false); setError("Usuário salvo, mas a lista não pôde ser atualizada. Recarregue antes de tentar de novo."); }
      if (created && userForm.active) {
        try { await invite(result.email ?? userForm.email); }
        catch { setNotice("Conta criada para " + userForm.email + ", mas o e-mail de acesso não foi enviado. Use “Enviar acesso” na lista."); }
      } else setNotice(created ? "Usuário criado." : "Usuário atualizado.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o usuário."); }
    finally { setBusy(false); }
  };
  const saveAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessForm || busy || !canManageAccess) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/admin/access", accessForm.id ? "PATCH" : "POST", accessForm);
      setAccessForm(null);
      try { await reload(); } catch { setLoadedData(false); setError("Item salvo, mas a lista não pôde ser atualizada. Recarregue antes de tentar de novo."); }
      setNotice(accessForm.kind === "role" ? "Papel salvo e permissões atualizadas." : "Grupo salvo e permissões atualizadas.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };
  const removeAccess = async () => {
    if (!accessForm?.id || !user || busy || !canManageAccess || !window.confirm("Excluir " + (accessForm.kind === "role" ? "o papel" : "o grupo") + " “" + accessForm.name + "”?")) return;
    setBusy(true); setError("");
    try { await navyApi(user, "/api/admin/access?kind=" + accessForm.kind + "&id=" + encodeURIComponent(accessForm.id), { method: "DELETE" }); await reload(); setAccessForm(null); setNotice("Item excluído."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  };
  const openUser = (item?: ManagedUser) => {
    setError("");
    setUserForm(item ? { uid: item.uid, name: item.name, email: item.email, active: item.active, role: item.role, roleId: item.groupIds.length ? "" : item.roleId, groupIds: item.groupIds.slice(0, 1), directPermissions: item.directPermissions ?? [], professionalId: item.professionalId, createProfessional: false } : blankUser());
  };
  const openAccess = (kind: "role" | "group", item?: AccessRecord) => {
    setError("");
    setAccessForm({ kind, id: item?.id ?? "", name: item?.name ?? "", description: item?.description ?? "", permissions: item?.permissions ?? [] });
  };
  const actionNames: Record<string, string> = {
    "user.created": "criou o acesso de", "user.updated": "atualizou o acesso de", "user.deactivated": "desativou o acesso de",
    "role.created": "criou o papel", "role.updated": "atualizou o papel", "role.deleted": "excluiu o papel",
    "group.created": "criou o grupo", "group.updated": "atualizou o grupo", "group.deleted": "excluiu o grupo",
    "settings.updated": "atualizou as configurações de",
  };

  return <div className="ad-page">
    <header className="ad-heading">
      <div><span className="ad-eyebrow">ADMINISTRAÇÃO <b>›</b> GOVERNANÇA &amp; SEGURANÇA</span><h1>Gestão de Usuários &amp; Controle de Acessos</h1><p>Equipe, grupos, permissões e histórico de alterações da NAVY Matriz.</p></div>
      {loadedData && tab === "users" && canManageUsers && <button className="ad-primary" type="button" onClick={() => openUser()}>{icon("person_add")} Convidar colaborador</button>}
      {loadedData && tab !== "users" && canManageAccess && <button className="ad-primary" type="button" onClick={() => openAccess(tab === "roles" ? "role" : "group")}>{icon("add")} Novo {tab === "roles" ? "papel" : "grupo"}</button>}
    </header>

    <div className="ad-stats">
      <div><span className="ad-stat-title">ACESSOS ATIVOS {icon("supervised_user_circle")}</span><strong>{loadedData ? users.filter(item => item.active).length : "—"}</strong><small>colaboradores habilitados</small></div>
      <div><span className="ad-stat-title">PROFISSIONAIS {icon("medical_services")}</span><strong>{loadedData ? users.filter(item => item.professionalId).length : "—"}</strong><small>vinculados à Agenda e Serviços</small></div>
      <div><span className="ad-stat-title">GRUPOS DE ACESSO {icon("groups")}</span><strong>{loadedData ? access.groups.length : "—"}</strong><small>conjuntos de permissões</small></div>
      <div><span className="ad-stat-title">PRIMEIRO ACESSO {icon("mark_email_unread")}</span><strong>{loadedData ? pending : "—"}</strong><small>contas que nunca entraram</small></div>
    </div>

    <nav className="ad-section-tabs" aria-label="Seções de usuários e acessos">
      <button type="button" className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>{icon("group")} Colaboradores</button>
      <button type="button" className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")}>{icon("badge")} Papéis</button>
      <button type="button" className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>{icon("groups")} Grupos</button>
    </nav>
    {notice && <div className="ad-notice" role="status">{notice}</div>}
    {error && !userForm && !accessForm && <div className="ad-error" role="alert">{error} <button type="button" onClick={retry}>Tentar novamente</button></div>}

    {loading || !loadedData ? loading ? <ContentSkeleton label="Carregando usuários e acessos" rows={4} /> : <div className="ad-empty ad-card">Dados indisponíveis. Tente novamente.</div> : tab === "users" ? <>
      <div className="ad-toolbar"><label className="ad-search">{icon("search")}<input aria-label="Buscar colaborador" placeholder="Buscar por nome, e-mail, função ou grupo…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="ad-filters" aria-label="Filtrar equipe">{filters.map(item => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label} <span>{item.count}</span></button>)}</div></div>
      <section className="ad-card ad-user-card"><div className="ad-card-head"><div><h2>Colaboradores &amp; Perfis Autorizados</h2><span>{users.filter(item => item.active).length} ativos</span></div><small>{icon("verified_user")} Dados do Firebase Auth e Firestore</small></div>
        <div className="ad-table-wrap"><table className="ad-user-table"><thead><tr><th>COLABORADOR / FUNÇÃO</th><th>PERFIL DE ACESSO &amp; ESCOPO</th><th>ÚLTIMO ACESSO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{filtered.length ? filtered.map(item => {
          const group = access.groups.find(record => item.groupIds.includes(record.id));
          const role = access.roles.find(record => record.id === item.roleId);
          const scope = group?.name ?? role?.name ?? roleLabels[item.role];
          return <tr key={item.uid}><td><div className="ad-person"><span className="ad-avatar">{item.name.slice(0, 2).toUpperCase()}</span><div><strong>{item.name}</strong><small>{roleLabels[item.role]}{item.professionalId ? " · Profissional vinculado" : ""}</small><small>{item.email || "E-mail não cadastrado"}</small></div></div></td><td><span className="ad-role-chip">{scope}</span><small>{group ? "Grupo principal" : role ? "Papel personalizado" : "Papel padrão"} · {item.permissions.length} permissões{item.directPermissions?.length ? " · " + item.directPermissions.length + " avulsas" : ""}</small></td><td><strong>{formatDate(item.lastSignInAt)}</strong><small>{item.lastSignInAt ? "Firebase Authentication" : "Convite ainda não utilizado"}</small></td><td><span className={"ad-status " + (item.active ? "ad-active" : "")}>{item.active ? "Ativo" : "Inativo"}</span><small>{item.emailVerified ? "E-mail verificado" : "E-mail não verificado"}</small></td><td><button type="button" className="ad-row-action" onClick={() => openUser(item)} aria-label={"Ver acesso de " + item.name}>{icon("more_vert")}</button></td></tr>;
        }) : <tr><td colSpan={5} className="ad-empty">Nenhum colaborador encontrado.</td></tr>}</tbody></table></div>
      </section>
      <section className="ad-card ad-matrix"><div className="ad-card-head"><div><h2>Matriz de Permissões por Papel</h2><p>Referência dos papéis padrão. Grupos e permissões avulsas definem o acesso efetivo de cada pessoa.</p></div></div><div className="ad-table-wrap"><table><thead><tr><th>MÓDULO</th>{roleOptions.map(role => <th key={role}>{roleLabels[role]}</th>)}</tr></thead><tbody>{modules.map(module => <tr key={module}><th>{module}</th>{roleOptions.map(role => <td key={role}><span className={permissionSummary(defaultPermissions[role], module) === "—" ? "ad-no-access" : ""}>{permissionSummary(defaultPermissions[role], module)}</span></td>)}</tr>)}</tbody></table></div></section>
      <section className="ad-card ad-audit"><div className="ad-card-head"><div><h2>Histórico de Administração</h2><p>Alterações de usuários, papéis e grupos registradas no Firestore.</p></div></div><div className="ad-audit-list">{access.audit.length ? access.audit.map(item => <div key={item.id}><span className="ad-audit-icon">{icon("history")}</span><p><strong>{users.find(record => record.uid === item.actorUid)?.name ?? "Administração NAVY"}</strong> {actionNames[item.action] ?? "alterou"} <strong>{item.targetName}</strong><small>{formatDate(item.createdAt)}</small></p></div>) : <div className="ad-empty">Nenhuma alteração registrada desde a ativação do histórico.</div>}</div></section>
    </> : <section className="ad-card"><div className="ad-card-head"><div><h2>{tab === "roles" ? "Papéis personalizados" : "Grupos de acesso"}</h2><p>{tab === "roles" ? "Papéis guardados no Firestore para acessos sem grupo." : "O grupo é o conjunto principal de permissões de cada colaborador."}</p></div></div><div className="ad-access-list">{(tab === "roles" ? access.roles : access.groups).length ? (tab === "roles" ? access.roles : access.groups).map(item => <button type="button" key={item.id} className="ad-access-row" onClick={() => openAccess(tab === "roles" ? "role" : "group", item)}><span className="ad-access-icon">{icon(tab === "roles" ? "badge" : "groups")}</span><span><strong>{item.name}</strong><small>{item.description || "Sem descrição"}</small></span><span className="ad-permission-count">{item.permissions.length} permissões</span>{icon("chevron_right")}</button>) : <div className="ad-empty">Nenhum {tab === "roles" ? "papel personalizado" : "grupo"} cadastrado.</div>}</div>{tab === "roles" && <div className="ad-base-roles"><h3>Papéis padrão</h3><div>{roleOptions.map(role => <span key={role}>{roleLabels[role]} · {defaultPermissions[role].length} permissões</span>)}</div></div>}</section>}

    {userForm && <ContentDialog title={userForm.uid ? "Acesso do colaborador" : "Novo colaborador"} onClose={() => setUserForm(null)} wide><form className="ad-form" onSubmit={saveUser}><p>Conta no Firebase Authentication; vínculo e permissões no Firestore.</p><label>Nome completo<input required minLength={3} maxLength={100} value={userForm.name} onChange={event => setUserForm({ ...userForm, name: event.target.value })} /></label><label>E-mail<input type="email" required disabled={Boolean(userForm.uid)} value={userForm.email} onChange={event => setUserForm({ ...userForm, email: event.target.value })} /></label><label>Função da equipe<select value={userForm.role} onChange={event => setUserForm({ ...userForm, role: event.target.value as UserRole })}>{roleOptions.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><label>Grupo principal<select value={userForm.groupIds[0] ?? ""} onChange={event => setUserForm({ ...userForm, groupIds: event.target.value ? [event.target.value] : [] , roleId: event.target.value ? "" : userForm.roleId })}><option value="">Sem grupo · usar papel</option>{access.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><small>Ao escolher um grupo, as permissões dele substituem as permissões padrão da função.</small></label>{!userForm.groupIds.length && <label>Papel personalizado<select value={userForm.roleId} onChange={event => setUserForm({ ...userForm, roleId: event.target.value })}><option value="">Usar papel padrão da função</option>{access.roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<fieldset className="ad-groups"><legend>Vínculo profissional</legend><label><input type="checkbox" checked={userForm.createProfessional} onChange={event => setUserForm({ ...userForm, createProfessional: event.target.checked, professionalId: "" })} /> Criar ficha de profissional para esta conta</label><select aria-label="Vincular profissional existente" disabled={userForm.createProfessional} value={userForm.professionalId} onChange={event => setUserForm({ ...userForm, professionalId: event.target.value })}><option value="">Sem vínculo</option>{professionals.filter(item => !item.userUid || item.userUid === userForm.uid).map(item => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inativo)"}</option>)}</select><small>Profissionais vinculados aparecem em Serviços e na Agenda.</small></fieldset><fieldset className="ad-direct"><legend>Permissões avulsas</legend><p>Exceções que se somam ao grupo ou papel. Conceda apenas o necessário.</p><PermissionGrid selected={userForm.directPermissions} onChange={permissions => setUserForm({ ...userForm, directPermissions: permissions })} allowed={profile?.permissions} /></fieldset><label className="ad-check"><input type="checkbox" checked={userForm.active} onChange={event => setUserForm({ ...userForm, active: event.target.checked })} /> Acesso ativo</label><div className="ad-effective"><strong>Permissões efetivas · {effective.length}</strong><div>{effective.map(permission => <span key={permission}>{permissionCatalog.find(item => item.id === permission)?.label}</span>)}</div></div>{error && <div className="ad-error" role="alert">{error}</div>}<div className="ad-form-actions"><button type="button" onClick={() => setUserForm(null)}>Cancelar</button>{userForm.uid && userForm.active && userForm.email && canManageUsers && <button type="button" onClick={() => { void invite(userForm.email).then(() => setUserForm(null)).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível enviar o acesso.")); }}>Enviar acesso</button>}{canManageUsers && userForm.role !== "master_admin" && userForm.uid !== profile?.uid && <button className="ad-primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar colaborador"}</button>}</div></form></ContentDialog>}
    {accessForm && <ContentDialog title={accessForm.kind === "role" ? "Papel de acesso" : "Grupo de acesso"} onClose={() => setAccessForm(null)} wide><form className="ad-form" onSubmit={saveAccess}><p>{accessForm.kind === "role" ? "Papel usado quando o colaborador não está em um grupo." : "Permissões compartilhadas por todos os colaboradores deste grupo."}</p><label>Nome<input required minLength={3} maxLength={100} value={accessForm.name} onChange={event => setAccessForm({ ...accessForm, name: event.target.value })} /></label><label>Descrição<textarea maxLength={300} rows={2} value={accessForm.description} onChange={event => setAccessForm({ ...accessForm, description: event.target.value })} /></label><PermissionGrid selected={accessForm.permissions} onChange={permissions => setAccessForm({ ...accessForm, permissions })} allowed={profile?.permissions} />{error && <div className="ad-error" role="alert">{error}</div>}<div className="ad-form-actions"><button type="button" onClick={() => setAccessForm(null)}>Cancelar</button>{accessForm.id && canManageAccess && <button type="button" className="ad-danger" disabled={busy} onClick={() => void removeAccess()}>Excluir</button>}{canManageAccess && <button className="ad-primary" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>}</div></form></ContentDialog>}
  </div>;
}
