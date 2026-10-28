import "server-only";
import { settingsConfig, type SettingsSection } from "@/lib/settings-schema";
import { ApiError } from "./navy-auth";

function validCnpj(value: string) {
  if (value && !/^[\d./-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  if (!value) return true;
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(digits[12]) && digit(13) === Number(digits[13]);
}

export function validateSettings(section: SettingsSection, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "Configurações inválidas.");
  const input = value as Record<string, unknown>;
  const fields = settingsConfig[section].fields;
  const allowed = new Set(fields.map(field => field.key));
  if (Object.keys(input).some(key => !allowed.has(key))) throw new ApiError(400, "Campo de configuração desconhecido.");
  const result: Record<string, string | number | boolean | null> = {};

  for (const field of fields) {
    if (!Object.hasOwn(input, field.key)) throw new ApiError(400, `Informe ${field.label}.`);
    const raw = input[field.key];
    if (field.type === "checkbox") {
      if (typeof raw !== "boolean") throw new ApiError(400, `${field.label} inválido.`);
      result[field.key] = raw;
      continue;
    }
    if (field.type === "number") {
      if (raw === "" || raw === null) { result[field.key] = null; continue; }
      const number = typeof raw === "number" ? raw : typeof raw === "string" && /^-?\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw) : NaN;
      if (!Number.isFinite(number) || number < (field.min ?? -Infinity) || number > (field.max ?? Infinity) || (field.step === 1 && !Number.isInteger(number))) throw new ApiError(400, `${field.label} fora do intervalo permitido.`);
      result[field.key] = number;
      continue;
    }
    if (typeof raw !== "string") throw new ApiError(400, `${field.label} inválido.`);
    const cleaned = raw.trim();
    if (cleaned.length > (field.maxLength ?? 1000)) throw new ApiError(400, `${field.label} excede o limite de caracteres.`);
    if (field.type === "select" && !field.options?.some(option => option.value === cleaned)) throw new ApiError(400, `${field.label} inválido.`);
    if (field.type === "date" && cleaned && (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(Date.parse(cleaned)) || new Date(cleaned).toISOString().slice(0, 10) !== cleaned)) throw new ApiError(400, `${field.label} inválida.`);
    if (field.key === "cnpj" && !validCnpj(cleaned)) throw new ApiError(400, "CNPJ inválido.");
    result[field.key] = cleaned;
  }

  if (section === "clinica" && result.depositEnabled === true && (typeof result.depositPercent !== "number" || result.depositPercent <= 0)) throw new ApiError(400, "Informe um percentual de sinal maior que zero.");
  if (section === "biosseguranca") {
    const compare = (minimum: string, maximum: string, message: string) => {
      if (typeof result[minimum] === "number" && typeof result[maximum] === "number" && result[minimum] > result[maximum]) throw new ApiError(400, message);
    };
    compare("minimumTemperatureC", "maximumTemperatureC", "A temperatura mínima não pode exceder a máxima.");
    compare("minimumHumidityPercent", "maximumHumidityPercent", "A umidade mínima não pode exceder a máxima.");
    if (typeof result.adhesiveAlertDays === "number" && typeof result.openedAdhesiveDays === "number" && result.adhesiveAlertDays > result.openedAdhesiveDays) throw new ApiError(400, "O aviso da cola deve ocorrer antes do descarte.");
  }
  return result;
}
