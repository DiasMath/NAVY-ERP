"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import ContentDialog from "@/components/ContentDialog";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFirebaseClient } from "@/lib/firebase/client";
import { navyApi } from "@/lib/firebase/navy-api";
import { defaultPermissions, permissionCatalog, roleLabels, validPermissions, type NavyPermission, type UserRole } from "@/lib/access-control";
import type { AccessRecord, ManagedUser } from "@/lib/server/admin-access";
import "./users.css";

type Tab = "users" | "roles" | "groups";
type Professional = { id: string; name: string; active: boolean; userUid: string };
type AccessData = { roles: AccessRecord[]; groups: AccessRecord[] };
type UserForm = { uid: string; name: string; email: string; active: boolean; role: UserRole; roleId: string; groupIds: string[]; professionalId: string; createProfessional: boolean };
const blankUser = (): UserForm => ({ uid: "", name: "", email: "", active: true, role: "employee", roleId: "", groupIds: [], professionalId: "", createProfessional: false });
const roleOptions: UserRole[] = ["admin", "reception", "professional", "employee"];
const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;

function PermissionGrid({ selected, onChange, allowed }: { selected: NavyPermission[]; onChange: (next: NavyPermission[]) => void; allowed?: NavyPermission[] }) {
  const modules = [...new Set(permissionCatalog.map(item => item.module))];
  return <div className="ad-permissions">{modules.map(module => <fieldset key={module}><legend>{module}</legend>{permissionCatalog.filter(item => item.module === module).map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={allowed ? !allowed.includes(item.id) : false} onChange={event => onChange(validPermissions(event.target.checked ? [...selected, item.id] : selected.filter(value => value !== item.id)))} /><span>{item.label}</span></label>)}</fieldset>)}</div>;
}

export default function UsersPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [access, setAccess] = useState<AccessData>({ roles: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [accessForm, setAccessForm] = useState<{ kind: "role" | "group"; id: string; name: string; description: string; permissions: NavyPermission[] } | null>(null);
  const canManageUsers = Boolean(profile?.permissions.includes("users.manage"));
  const canManageAccess = Boolean(profile?.permissions.includes("access.manage"));

  const reload = useCallback(async () => {
    if (!user) return;
    const [userResponse, accessResponse] = await Promise.all([navyApi(user, "/api/admin/users"), navyApi(user, "/api/admin/access")]);
    const userData = await userResponse.json() as { users: ManagedUser[]; professionals: Professional[] };
    const accessData = await accessResponse.json() as AccessData;
    setUsers(userData.users); setProfessionals(userData.professionals); setAccess(accessData); setLoadedData(true); setError("");
  }, [user]);
  useEffect(() => { let active = true; setLoading(true); reload().catch(cause => { if (active) { setLoadedData(false); setError(cause instanceof Error ? cause.message : "Não foi possível carregar os acessos."); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reload]);
  const retry = () => { setLoading(true); reload().catch(cause => { setLoadedData(false); setError(cause instanceof Error ? cause.message : "Não foi possível carregar os acessos."); }).finally(() => setLoading(false)); };

  const effective = useMemo(() => {
    if (!userForm) return [];
    const base = userForm.roleId ? access.roles.find(item => item.id === userForm.roleId)?.permissions ?? [] : defaultPermissions[userForm.role];
    return validPermissions([...base, ...access.groups.filter(group => userForm.groupIds.includes(group.id)).flatMap(group => group.permissions)]);
  }, [userForm, access]);
  const filtered = users.filter(item => `${item.name} ${item.email}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const request = async (path: string, method: string, body: unknown) => {
    if (!user) throw new Error("Faça login para continuar.");
    const response = await navyApi(user, path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return response.json();
  };
  const invite = async (email: string) => {
    await sendPasswordResetEmail(getFirebaseClient().auth, email);
    setNotice(`E-mail de acesso enviado para ${email}.`);
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
        catch { setNotice(`Conta criada para ${userForm.email}, mas o e-mail de acesso não foi enviado. Use “Enviar acesso” na lista.`); }
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
    if (!accessForm?.id || !user || busy || !canManageAccess || !window.confirm(`Excluir ${accessForm.kind === "role" ? "o papel" : "o grupo"} “${accessForm.name}”?`)) return;
    setBusy(true); setError("");
    try { await navyApi(user, `/api/admin/access?kind=${accessForm.kind}&id=${encodeURIComponent(accessForm.id)}`, { method: "DELETE" }); await reload(); setAccessForm(null); setNotice("Item excluído."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  };
    const openUser = (item?: ManagedUser) => { setError(""); setUserForm(item ? { uid: item.uid, name: item.name, email: item.email, active: item.active, role: item.role, roleId: item.roleId, groupIds: item.groupIds, professionalId: item.professionalId, createProfessional: false } : blankUser()); };
  const openAccess = (kind: "role" | "group", item?: AccessRecord) => { setError(""); setAccessForm({ kind, id: item?.id ?? "", name: item?.name ?? "", description: item?.description ?? "", permissions: item?.permissions ?? [] }); };

  return <div className="ad-page">
    <div className="ad-heading"><div><span className="ad-eyebrow">ADMINISTRAÇÃO · NAVY MATRIZ</span><h1>Usuários e acessos</h1><p>Gerencie as contas da equipe, seus papéis, grupos e permissões efetivas.</p></div>{tab === "users" && canManageUsers && <button className="ad-primary" type="button" disabled={!loadedData} onClick={() => openUser()}>{icon("person_add")} Novo usuário</button>}{tab !== "users" && canManageAccess && <button className="ad-primary" type="button" disabled={!loadedData} onClick={() => openAccess(tab === "roles" ? "role" : "group")}>{icon("add")} Novo {tab === "roles" ? "papel" : "grupo"}</button>}</div>
    <div className="ad-stats"><div><strong>{loadedData ? users.length : "—"}</strong><span>usuários cadastrados</span></div><div><strong>{loadedData ? users.filter(item => item.active).length : "—"}</strong><span>acessos ativos</span></div><div><strong>{loadedData ? users.filter(item => item.professionalId).length : "—"}</strong><span>profissionais vinculados</span></div></div>
    <nav className="ad-tabs" aria-label="Administração de acessos"><button type="button" className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Usuários</button><button type="button" className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")}>Papéis</button><button type="button" className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>Grupos</button></nav>
    {notice && <div className="ad-notice" role="status">{notice}</div>}{error && !userForm && !accessForm && <div className="ad-error" role="alert">{error} <button type="button" onClick={retry}>Tentar novamente</button></div>}
    {loading || !loadedData ? <div className="ad-empty">{loading ? "Carregando acessos…" : "Dados indisponíveis. Tente novamente."}</div> : tab === "users" ? <section className="ad-card"><div className="ad-card-head"><h2>Equipe</h2><input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="ad-list">{loadedData && filtered.length ? filtered.map(item => <div className="ad-row" key={item.uid}><span className="ad-avatar">{item.name.slice(0, 2).toUpperCase()}</span><div className="ad-row-main"><strong>{item.name}</strong><small>{item.email || "E-mail não cadastrado"}</small></div><div className="ad-row-meta"><span>{item.roleId ? access.roles.find(role => role.id === item.roleId)?.name ?? "Papel removido" : roleLabels[item.role]}</span>{item.professionalId && <small>Profissional vinculada</small>}</div><span className={`ad-status ${item.active ? "ad-active" : ""}`}>{item.active ? "Ativo" : "Inativo"}</span><button type="button" className="ad-row-action" onClick={() => openUser(item)} aria-label={`Ver acesso de ${item.name}`}>{icon("chevron_right")}</button></div>) : <div className="ad-empty">{loadedData ? "Nenhum usuário encontrado." : "Dados indisponíveis. Tente novamente."}</div>}</div></section> : <section className="ad-card"><div className="ad-card-head"><div><h2>{tab === "roles" ? "Papéis personalizados" : "Grupos de acesso"}</h2><p>{tab === "roles" ? "Cada usuário recebe um papel base ou personalizado." : "Grupos acrescentam permissões ao papel do usuário."}</p></div></div><div className="ad-list">{(tab === "roles" ? access.roles : access.groups).length ? (tab === "roles" ? access.roles : access.groups).map(item => <button type="button" className="ad-access-row" key={item.id} onClick={() => openAccess(tab === "roles" ? "role" : "group", item)}><span className="ad-access-icon">{icon(tab === "roles" ? "badge" : "groups")}</span><span><strong>{item.name}</strong><small>{item.description || `${item.permissions.length} permissões`}</small></span><span className="ad-permission-count">{item.permissions.length} permissões</span>{icon("chevron_right")}</button>) : <div className="ad-empty">Nenhum {tab === "roles" ? "papel personalizado" : "grupo"} cadastrado.</div>}</div>{tab === "roles" && <div className="ad-base-roles"><h3>Papéis padrão</h3><div>{roleOptions.map(role => <span key={role}>{roleLabels[role]} · {defaultPermissions[role].length} permissões</span>)}</div></div>}</section>}
    {userForm && <ContentDialog title={userForm.uid ? "Acesso do usuário" : "Novo usuário"} onClose={() => setUserForm(null)} wide><form className="ad-form" onSubmit={saveUser}><p>O acesso é criado no Firebase Authentication e o perfil fica no Firestore.</p><label>Nome completo<input required minLength={3} maxLength={100} value={userForm.name} onChange={event => setUserForm({ ...userForm, name: event.target.value })} /></label><label>E-mail<input type="email" required disabled={Boolean(userForm.uid)} value={userForm.email} onChange={event => setUserForm({ ...userForm, email: event.target.value })} /></label><label>Papel base<select value={userForm.role} disabled={userForm.role === "master_admin"} onChange={event => setUserForm({ ...userForm, role: event.target.value as UserRole, roleId: "" })}>{roleOptions.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><label>Papel personalizado<select value={userForm.roleId} onChange={event => setUserForm({ ...userForm, roleId: event.target.value })}><option value="">Usar permissões do papel base</option>{access.roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><fieldset className="ad-groups"><legend>Grupos</legend>{access.groups.length ? access.groups.map(group => <label key={group.id}><input type="checkbox" checked={userForm.groupIds.includes(group.id)} onChange={event => setUserForm({ ...userForm, groupIds: event.target.checked ? [...userForm.groupIds, group.id] : userForm.groupIds.filter(id => id !== group.id) })} />{group.name}</label>) : <small>Sem grupos cadastrados.</small>}</fieldset><fieldset className="ad-groups"><legend>Vínculo profissional</legend><label><input type="checkbox" checked={userForm.createProfessional} onChange={event => setUserForm({ ...userForm, createProfessional: event.target.checked, professionalId: "" })} /> Criar ficha de profissional para esta conta</label><select aria-label="Vincular profissional existente" disabled={userForm.createProfessional} value={userForm.professionalId} onChange={event => setUserForm({ ...userForm, professionalId: event.target.value })}><option value="">Sem vínculo</option>{professionals.filter(item => !item.userUid || item.userUid === userForm.uid).map(item => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inativa)"}</option>)}</select><small>Profissionais vinculadas aparecem nos Serviços e na Agenda.</small></fieldset><label className="ad-check"><input type="checkbox" checked={userForm.active} onChange={event => setUserForm({ ...userForm, active: event.target.checked })} /> Acesso ativo</label><div className="ad-effective"><strong>Permissões efetivas · {effective.length}</strong><div>{effective.map(permission => <span key={permission}>{permissionCatalog.find(item => item.id === permission)?.label}</span>)}</div></div>{error && <div className="ad-error" role="alert">{error}</div>}<div className="ad-form-actions"><button type="button" onClick={() => setUserForm(null)}>Cancelar</button>{userForm.uid && userForm.active && userForm.email && canManageUsers && <button type="button" onClick={() => { void invite(userForm.email).then(() => setUserForm(null)).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível enviar o acesso.")); }}>Enviar acesso</button>}{canManageUsers && userForm.role !== "master_admin" && userForm.uid !== profile?.uid && <button className="ad-primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar usuário"}</button>}</div></form></ContentDialog>}
    {accessForm && <ContentDialog title={accessForm.kind === "role" ? "Papel de acesso" : "Grupo de acesso"} onClose={() => setAccessForm(null)} wide><form className="ad-form" onSubmit={saveAccess}><p>{accessForm.kind === "role" ? "O papel define as permissões principais de cada usuário." : "O grupo soma permissões ao papel principal."}</p><label>Nome<input required minLength={3} maxLength={100} value={accessForm.name} onChange={event => setAccessForm({ ...accessForm, name: event.target.value })} /></label><label>Descrição<textarea maxLength={300} rows={2} value={accessForm.description} onChange={event => setAccessForm({ ...accessForm, description: event.target.value })} /></label><PermissionGrid selected={accessForm.permissions} onChange={permissions => setAccessForm({ ...accessForm, permissions })} allowed={profile?.permissions} />{error && <div className="ad-error" role="alert">{error}</div>}<div className="ad-form-actions"><button type="button" onClick={() => setAccessForm(null)}>Cancelar</button>{accessForm.id && canManageAccess && <button type="button" className="ad-danger" disabled={busy} onClick={() => void removeAccess()}>Excluir</button>}{canManageAccess && <button className="ad-primary" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>}</div></form></ContentDialog>}
  </div>;
}
