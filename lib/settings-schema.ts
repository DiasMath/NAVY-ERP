export const settingsSections = ["clinica", "financeiro", "biosseguranca", "unidade"] as const;
export type SettingsSection = typeof settingsSections[number];
export type SettingsValue = string | boolean;
export type SettingsValues = Record<string, SettingsValue>;

export type SettingsField = {
  key: string;
  label: string;
  help?: string;
  type: "text" | "number" | "date" | "textarea" | "checkbox" | "select";
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export const settingsConfig: Record<SettingsSection, { title: string; description: string; icon: string; fields: SettingsField[] }> = {
  clinica: {
    title: "Políticas Clínicas & Agenda",
    description: "Defina as orientações de pontualidade, cancelamento e preparo entre atendimentos.",
    icon: "tune",
    fields: [
      { key: "lateToleranceMinutes", label: "Tolerância para atrasos", help: "Minutos após o horário agendado.", type: "number", min: 0, max: 180, step: 1, placeholder: "Ex.: 15" },
      { key: "cancellationNoticeHours", label: "Antecedência para cancelamento", help: "Horas antes do agendamento.", type: "number", min: 0, max: 720, step: 1, placeholder: "Ex.: 24" },
      { key: "sanitizationGapMinutes", label: "Intervalo de assepsia", help: "Minutos reservados entre atendimentos.", type: "number", min: 0, max: 180, step: 1, placeholder: "Ex.: 15" },
      { key: "depositEnabled", label: "Solicitar sinal na reserva", help: "Registra a política interna; cobrança automática ainda não está disponível.", type: "checkbox" },
      { key: "depositPercent", label: "Percentual do sinal", type: "number", min: 0, max: 100, step: 0.01, placeholder: "Ex.: 30" },
      { key: "cancellationPolicy", label: "Orientações de cancelamento", type: "textarea", maxLength: 1000, placeholder: "Descreva a política comunicada às clientes" },
    ],
  },
  financeiro: {
    title: "Financeiro & Margens de Segurança",
    description: "Guarde os limites e critérios financeiros usados pela equipe.",
    icon: "shield_with_heart",
    fields: [
      { key: "minimumMarginPercent", label: "Margem de contribuição mínima (%)", type: "number", min: 0, max: 100, step: 0.01, placeholder: "Ex.: 45" },
      { key: "serviceDiscountLimitPercent", label: "Desconto máximo em serviços avulsos (%)", type: "number", min: 0, max: 100, step: 0.01, placeholder: "Ex.: 10" },
      { key: "packageDiscountLimitPercent", label: "Desconto máximo em pacotes (%)", type: "number", min: 0, max: 100, step: 0.01, placeholder: "Ex.: 10" },
      { key: "paymentFeePolicy", label: "Política de taxas de pagamento", type: "select", options: [
        { value: "", label: "Não definida" },
        { value: "absorb_all", label: "Absorver todas as taxas" },
        { value: "absorb_pix", label: "Absorver Pix e repassar parcelamento" },
        { value: "pass_credit", label: "Repassar taxas do cartão de crédito" },
      ] },
      { key: "financialNotes", label: "Observações financeiras", type: "textarea", maxLength: 1000, placeholder: "Critérios adicionais para a equipe" },
    ],
  },
  biosseguranca: {
    title: "Biossegurança & Prazos",
    description: "Registre os parâmetros internos de insumos, ambiente e esterilização.",
    icon: "sanitizer",
    fields: [
      { key: "openedAdhesiveDays", label: "Validade de cola após abertura (dias)", type: "number", min: 1, max: 365, step: 1 },
      { key: "adhesiveAlertDays", label: "Aviso antes do descarte (dias após abertura)", type: "number", min: 0, max: 365, step: 1 },
      { key: "minimumTemperatureC", label: "Temperatura mínima da cabine (°C)", type: "number", min: 0, max: 50, step: 0.1 },
      { key: "maximumTemperatureC", label: "Temperatura máxima da cabine (°C)", type: "number", min: 0, max: 50, step: 0.1 },
      { key: "minimumHumidityPercent", label: "Umidade mínima (%)", type: "number", min: 0, max: 100, step: 0.1 },
      { key: "maximumHumidityPercent", label: "Umidade máxima (%)", type: "number", min: 0, max: 100, step: 0.1 },
      { key: "sterilizationRoutine", label: "Rotina de esterilização", type: "textarea", maxLength: 1000, placeholder: "Descreva o procedimento adotado" },
      { key: "patchTestRetentionYears", label: "Prazo de guarda de testes (anos)", type: "number", min: 0, max: 100, step: 1 },
    ],
  },
  unidade: {
    title: "Dados da Unidade & Fiscal",
    description: "Cadastre os dados oficiais da NAVY Matriz em um único lugar.",
    icon: "domain",
    fields: [
      { key: "legalName", label: "Razão social", type: "text", maxLength: 160 },
      { key: "tradeName", label: "Nome fantasia", type: "text", maxLength: 160 },
      { key: "cnpj", label: "CNPJ", type: "text", maxLength: 18, placeholder: "00.000.000/0000-00" },
      { key: "technicalLead", label: "Responsável técnica", type: "text", maxLength: 120 },
      { key: "technicalRegistration", label: "Registro profissional", type: "text", maxLength: 60 },
      { key: "address", label: "Endereço da unidade", type: "textarea", maxLength: 300 },
      { key: "pixKey", label: "Chave Pix para recebimentos", type: "text", maxLength: 120 },
      { key: "bankName", label: "Banco", type: "text", maxLength: 100 },
      { key: "sanitaryLicenseExpiresOn", label: "Validade da licença sanitária", type: "date" },
    ],
  },
};

export function emptySettings(section: SettingsSection): SettingsValues {
  return Object.fromEntries(settingsConfig[section].fields.map(field => [field.key, field.type === "checkbox" ? false : ""]));
}

export function displaySettings(section: SettingsSection, data: Record<string, unknown> | undefined): SettingsValues {
  return Object.fromEntries(settingsConfig[section].fields.map(field => {
    const value = data?.[field.key];
    if (field.type === "checkbox") return [field.key, value === true];
    if (field.type === "number") return [field.key, typeof value === "number" && Number.isFinite(value) ? String(value) : ""];
    return [field.key, typeof value === "string" ? value : ""];
  }));
}

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === "string" && settingsSections.includes(value as SettingsSection);
}
