"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, CreditCard, History, MapPin, Package, Plus, TrendingUp, UsersRound } from "lucide-react";
import { demoAppointments, demoClients, demoMaterials } from "@/lib/demo-data";
import { brl, dateLabel, timeLabel } from "@/lib/format";
import { Avatar, IconTile, PageIntro, Panel, StatusBadge } from "@/components/ui";

const metrics = [
  { label: "Serviços realizados", value: "R$ 4.850,00", context: "Exemplo de faturamento do mês", detail: "28 procedimentos ilustrativos", icon: CheckCircle2, tone: "blue" },
  { label: "Valor recebido", value: "R$ 4.250,00", context: "Exemplo de entradas registradas", detail: "Recebido não inclui o valor a receber", icon: CreditCard, tone: "sage" },
  { label: "A receber", value: "R$ 600,00", context: "Exemplo de pendências", detail: "Sem entrada fictícia no caixa", icon: AlertTriangle, tone: "gold" },
  { label: "Receita prevista", value: "R$ 3.100,00", context: "Agendamentos futuros", detail: "Separada dos serviços realizados", icon: TrendingUp, tone: "blue" },
];

function MetricCard({ metric }: { metric: typeof metrics[number] }) {
  const Icon = metric.icon;
  return <div className="metric-card"><div className="metric-top"><div><span className="metric-label">{metric.label}</span><small>{metric.context}</small></div><IconTile icon={Icon} tone={metric.tone} /></div><strong>{metric.value}</strong><span className="metric-foot">{metric.detail}</span></div>;
}

export default function DashboardPage() {
  return <div className="dashboard-page"><PageIntro eyebrow="PAINEL EXECUTIVO · PRÉVIA" title="Sua operação, em foco" subtitle={dateLabel(new Date(), { weekday: "long", day: "numeric", month: "long" })} actions={<div className="intro-actions"><Link href="/atividades" className="action-button action-secondary"><History size={17} /> Histórico</Link><Link href="/agenda" className="action-button"><Plus size={17} /> Novo agendamento</Link></div>} />
    <div className="operation-strip"><span className="operation-indicator"><span className="live-dot" /> Ambiente de demonstração</span><span><CalendarDays size={16} /> {demoAppointments.length} atendimentos de exemplo na semana</span><span><UsersRound size={16} /> {demoClients.length} clientes fictícias</span></div>
    <div className="metric-grid">{metrics.map(metric => <MetricCard key={metric.label} metric={metric} />)}</div>
    <div className="dashboard-layout"><div className="dashboard-primary"><Panel title="Próximos atendimentos" kicker="AGENDA OPERACIONAL" action={<Link href="/agenda" className="text-link">Ver agenda completa <ArrowRight size={15} /></Link>}><div className="upcoming-list">{demoAppointments.slice(0, 3).map(appointment => { const client = demoClients.find(item => item.id === appointment.clientId)!; return <div className="upcoming-row" key={appointment.id}><div className="upcoming-time"><strong>{timeLabel(appointment.start)}</strong><small>{timeLabel(appointment.start + appointment.duration)}</small></div><span className={`upcoming-rule tone-${appointment.tone}`} /><Avatar initials={client.initials} tone={client.tone} /><div className="upcoming-info"><strong>{client.name}</strong><span>{appointment.service} · {appointment.location}</span></div><StatusBadge status={appointment.status} /><Link href="/agenda" className="row-link" aria-label={`Ver agendamento de ${client.name}`}><ArrowRight size={17} /></Link></div>; })}</div></Panel>
        <Panel title="Uma jornada conectada" kicker="VISÃO DE PRODUTO"><div className="journey-row"><div className="journey-step"><span>01</span><strong>Agendar</strong><small>Cliente e serviços</small></div><i /><div className="journey-step"><span>02</span><strong>Atender</strong><small>Procedimento e materiais</small></div><i /><div className="journey-step"><span>03</span><strong>Receber</strong><small>Registro financeiro</small></div><i /><div className="journey-step"><span>04</span><strong>Acompanhar</strong><small>Retorno e manutenção</small></div></div><p className="panel-caption">Este fluxo orienta os próximos incrementos. Somente as telas visuais estão disponíveis agora.</p></Panel>
      </div><div className="dashboard-secondary"><Panel title="Estoque operacional" kicker="PONTOS DE ATENÇÃO" action={<IconTile icon={Package} tone="gold" />}><div className="stock-list">{demoMaterials.map(material => <div className="stock-row" key={material.name}><span className={`stock-dot ${material.tone}`} /><div><strong>{material.name}</strong><small>{material.minimum}</small></div><span>{material.amount}</span></div>)}</div><Link href="/estoque" className="panel-bottom-link">Abrir módulo de estoque <ArrowRight size={15} /></Link></Panel><Panel title="Retornos próximos" kicker="RELACIONAMENTO"><div className="return-list">{demoClients.filter(client => client.returnHint).map(client => <div className="return-row" key={client.id}><Avatar initials={client.initials} tone={client.tone} /><div><strong>{client.name}</strong><small>{client.returnHint}</small></div><Clock3 size={16} /></div>)}</div><Link href="/clientes" className="panel-bottom-link">Ver clientes <ArrowRight size={15} /></Link></Panel><div className="dashboard-side-note"><MapPin size={18} /><span>Atendimentos no espaço ou a domicílio, reunidos em uma só agenda.</span></div></div></div>
  </div>;
}
