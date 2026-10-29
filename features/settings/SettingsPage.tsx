"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import ContentSkeleton from "@/components/ContentSkeleton";
import { navyApi } from "@/lib/firebase/navy-api";
import { emptySettings, settingsConfig, type SettingsField, type SettingsSection, type SettingsValues } from "@/lib/settings-schema";
import SettingsTabs from "./SettingsTabs";
import "./integrations.css";
import "./settings.css";

function SettingControl({ field, value, disabled, onChange }: { field: SettingsField; value: string | boolean; disabled: boolean; onChange: (value: string | boolean) => void }) {
  const id = `setting-${field.key}`;
  if (field.type === "checkbox") return <label className="sc-switch" htmlFor={id}><span><strong>{field.label}</strong>{field.help && <small>{field.help}</small>}</span><input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={event => onChange(event.target.checked)} /></label>;
  return <label className="sc-field" htmlFor={id}><span>{field.label}</span>{field.type === "textarea"
    ? <textarea id={id} rows={3} maxLength={field.maxLength} placeholder={field.placeholder} value={String(value)} disabled={disabled} onChange={event => onChange(event.target.value)} />
    : field.type === "select"
      ? <select id={id} value={String(value)} disabled={disabled} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input id={id} type={field.type} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} placeholder={field.placeholder} value={String(value)} disabled={disabled} onChange={event => onChange(event.target.value)} />}{field.help && <small>{field.help}</small>}</label>;
}

export default function SettingsPage({ section }: { section: SettingsSection }) {
  const { user, profile } = useAuth();
  const config = settingsConfig[section];
  const [values, setValues] = useState<SettingsValues>(() => emptySettings(section));
  const [saved, setSaved] = useState<SettingsValues>(() => emptySettings(section));
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManage = Boolean(profile?.permissions.includes("access.manage"));
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const path = section === "clinica" ? "/configuracoes" : `/configuracoes/${section}`;

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setLoaded(false);
    setError("");
    setNotice("");
    navyApi(user, `/api/settings?section=${section}`)
      .then(response => response.json())
      .then((data: { values: SettingsValues; updatedAt: string | null; revision: number }) => {
        if (!active) return;
        setValues(data.values);
        setSaved(data.values);
        setUpdatedAt(data.updatedAt);
        setDocumentRevision(data.revision);
        setLoaded(true);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as configurações."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, user, revision]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || saving || !canManage || !dirty) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await navyApi(user, "/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, values, expectedRevision: documentRevision }) });
      const result = await response.json() as { values: SettingsValues; updatedAt: string; revision: number };
      setValues(result.values); setSaved(result.values); setUpdatedAt(result.updatedAt); setDocumentRevision(result.revision);
      setNotice("Configurações salvas no Firestore.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar as configurações."); }
    finally { setSaving(false); }
  };

  const change = (key: string, value: string | boolean) => { setValues(current => ({ ...current, [key]: value })); setNotice(""); };
  const discard = () => { setValues(saved); setError(""); setNotice(""); };
  const confirmLeave = () => !dirty || window.confirm("Descartar alterações não salvas desta seção?");
  const updatedLabel = updatedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(updatedAt)) : "Ainda não configurada";

  return <div className="si-page sc-page">
    <div className="si-heading"><div className="si-eyebrow">ADMINISTRAÇÃO <span>•</span> CONFIGURAÇÕES GERAIS</div><h1>Configurações Gerais da Clínica</h1><p>Políticas e dados da NAVY Matriz.</p></div>
    <SettingsTabs active={path} onNavigate={confirmLeave} />
    <form className="sc-card" onSubmit={save}>
      <div className="sc-card-head"><span className="sc-icon material-symbols-outlined">{config.icon}</span><div><h2>{config.title}</h2><p>{config.description}</p></div><span className="sc-status">{updatedAt ? "Salvo no Firestore" : "Sem dados salvos"}</span></div>
      {loading ? <ContentSkeleton label="Carregando configurações" rows={4} /> : !loaded ? <div className="sc-loading">{error || "Não foi possível carregar as configurações."} <button type="button" className="sc-secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div> : <>
        <div className="sc-fields">{config.fields.map(field => <SettingControl key={field.key} field={field} value={values[field.key] ?? (field.type === "checkbox" ? false : "")} disabled={!canManage || saving} onChange={value => change(field.key, value)} />)}</div>
        {section !== "unidade" && <p className="sc-scope">Os valores desta seção ficam registrados no Firestore. A aplicação automática deles à Agenda, preços ou rotinas clínicas ainda não está ativa.</p>}
        {section === "unidade" && <p className="sc-scope">Estes dados são cadastrais. Documentos e licenças não são verificados automaticamente nesta tela.</p>}
        {error && <div className="sc-error" role="alert">{error} {error.includes("outra pessoa") && <button type="button" onClick={() => { if (window.confirm("Descartar suas alterações locais e carregar os dados mais recentes?")) setRevision(value => value + 1); }}>Recarregar dados</button>}</div>}
        {notice && <div className="sc-notice" role="status">{notice}</div>}
        <div className="sc-footer"><span>{canManage ? `Última atualização: ${updatedLabel}` : "Somente administradores de acesso podem editar."}</span><div>{dirty && <button type="button" className="sc-secondary" onClick={discard}>Descartar alterações</button>}{canManage && <button type="submit" className="si-primary" disabled={saving || !dirty}>{saving ? "Salvando…" : "Salvar alterações"}</button>}</div></div>
      </>}
    </form>
  </div>;
}
