export type StitchNavItem = {
  label: string;
  href: string;
  icon: string;
};

export type StitchNavGroup = {
  label: string;
  items: StitchNavItem[];
};

export const stitchNavigation: StitchNavGroup[] = [
  { label: "Visão geral", items: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "Relatórios & Insights", href: "/relatorios", icon: "monitoring" },
  ] },
  { label: "Atendimentos", items: [
    { label: "Agenda Operacional", href: "/agenda", icon: "calendar_month" },
    { label: "Clientes", href: "/clientes", icon: "person_outline" },
    { label: "Fichas Anamnese", href: "/avaliacoes", icon: "clinical_notes" },
    { label: "Fotos Antes & Depois", href: "/historico-fotos", icon: "photo_camera" },
    { label: "Manutenções", href: "/manutencoes", icon: "event_repeat" },
    { label: "Pacotes & Sessões", href: "/pacotes", icon: "card_membership" },
  ] },
  { label: "Serviços", items: [
    { label: "Catálogo de Serviços", href: "/servicos", icon: "spa" },
    { label: "Precificação Estratégica", href: "/precificacao", icon: "price_change" },
  ] },
  { label: "Estoque & Compras", items: [
    { label: "Materiais & Estoque", href: "/estoque", icon: "inventory_2" },
    { label: "Fornecedores", href: "/fornecedores", icon: "storefront" },
    { label: "Pedidos de Compra", href: "/compras", icon: "shopping_bag" },
  ] },
  { label: "Financeiro", items: [
    { label: "Fluxo de Caixa", href: "/fluxo-caixa", icon: "account_balance_wallet" },
    { label: "Contas a Pagar / Receber", href: "/contas-pagar", icon: "receipt_long" },
    { label: "Plano de Contas", href: "/plano-contas", icon: "account_tree" },
  ] },
  { label: "Administração", items: [
    { label: "Configurações Gerais", href: "/configuracoes", icon: "settings" },
    { label: "Usuários & Acessos", href: "/usuarios", icon: "shield_person" },
  ] },
];

export const stitchNavItems = stitchNavigation.flatMap((group) => group.items);
