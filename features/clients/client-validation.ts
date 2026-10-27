import type { ClientRecord, ClientSession, ClientSource, PreferredContact } from "./client-data";

export type ClientField = "name" | "phone" | "email" | "birthDate" | "city" | "instagram" | "preferredContact" | "source" | "sourceDetail";
export type ClientErrors = Partial<Record<ClientField, string>>;

export type ClientInput = {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  city: string;
  instagram: string;
  preferredContact?: PreferredContact;
  source: ClientSource;
  sourceDetail: string;
  vip: boolean;
};

const sources: ClientSource[] = ["Não informado", "Instagram", "Indicação", "WhatsApp", "Outros"];
const contacts: PreferredContact[] = ["WhatsApp", "Telefone", "Instagram", "E-mail"];
const read = (values: FormData, field: ClientField) => String(values.get(field) ?? "").trim();

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

function validBrazilPhone(value: string): boolean {
  if (!/^\+?[\d().\s-]+$/.test(value)) return false;
  const digits = phoneDigits(value);
  return /^[1-9]{2}[2-9]\d{7}$/.test(digits) || /^[1-9]{2}9\d{8}$/.test(digits);
}

export function formatBrazilPhone(value: string): string | null {
  if (!validBrazilPhone(value)) return null;
  const digits = phoneDigits(value);
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validBirthDate(value: string): "invalid" | "future" | "old" | null {
  if (!validDateOnly(value)) return "invalid";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const thisDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > thisDay) return "future";
  if (date < new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())) return "old";
  return null;
}

export function validateClient(values: FormData, clients: ClientRecord[], editingId?: string): { input: ClientInput; errors: ClientErrors } {
  const errors: ClientErrors = {};
  const name = read(values, "name").replace(/\s+/g, " ");
  const phoneRaw = read(values, "phone");
  const phone = formatBrazilPhone(phoneRaw) ?? phoneRaw;
  const email = read(values, "email").toLowerCase();
  const birthDate = read(values, "birthDate");
  const city = read(values, "city").replace(/\s+/g, " ");
  const rawInstagram = read(values, "instagram");
  const handle = rawInstagram.replace(/^@/, "");
  const instagram = handle ? `@${handle}` : "";
  const sourceValue = read(values, "source");
  const source = (sources.includes(sourceValue as ClientSource) ? sourceValue : "Não informado") as ClientSource;
  const sourceDetail = read(values, "sourceDetail").replace(/\s+/g, " ");
  const contactValue = read(values, "preferredContact");
  const preferredContact = contacts.includes(contactValue as PreferredContact) ? contactValue as PreferredContact : undefined;

  if (!name) errors.name = "Informe o nome completo.";
  else if (name.length < 2 || name.length > 100 || !/^[\p{L}][\p{L}\p{M}\s.'’\-]*$/u.test(name)) errors.name = "Use de 2 a 100 caracteres, sem números ou símbolos.";
  else if (name.split(" ").length < 2) errors.name = "Informe nome e sobrenome.";

  if (!phoneRaw) errors.phone = "Informe um telefone com DDD.";
  else if (!validBrazilPhone(phoneRaw)) errors.phone = "Digite um telefone brasileiro válido com DDD.";
  else {
    const duplicate = clients.find((client) => client.id !== editingId && phoneDigits(client.phone) === phoneDigits(phoneRaw));
    if (duplicate) errors.phone = `Este telefone já está no cadastro de ${duplicate.name}.`;
  }

  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = "Digite um e-mail válido.";
  if (birthDate) {
    const issue = validBirthDate(birthDate);
    if (issue === "invalid") errors.birthDate = "Digite uma data de nascimento válida.";
    if (issue === "future") errors.birthDate = "A data de nascimento não pode ser futura.";
    if (issue === "old") errors.birthDate = "Confira a data de nascimento informada.";
  }
  if (city && (city.length < 2 || city.length > 80 || !/^[\p{L}\p{M}\s.,'’\-]+$/u.test(city))) errors.city = "Use de 2 a 80 caracteres para cidade/UF, sem números ou símbolos.";
  if (handle && (!/^[a-zA-Z0-9._]{1,30}$/.test(handle) || handle.startsWith(".") || handle.endsWith(".") || handle.includes(".."))) errors.instagram = "Digite apenas o @usuário, com até 30 caracteres.";
  if (contactValue && !preferredContact) errors.preferredContact = "Escolha um contato preferido válido.";
  if (preferredContact === "E-mail" && !email) errors.email = "Informe o e-mail para escolhê-lo como contato preferido.";
  if (preferredContact === "Instagram" && !instagram) errors.instagram = "Informe o Instagram para escolhê-lo como contato preferido.";
  if (!sources.includes(sourceValue as ClientSource)) errors.source = "Escolha um canal de origem válido.";
  if (source === "Indicação" && !sourceDetail) errors.sourceDetail = "Informe quem indicou a cliente.";
  else if (sourceDetail.length > 120) errors.sourceDetail = "Use até 120 caracteres no detalhe da origem.";
  else if (source === "Não informado" && sourceDetail) errors.sourceDetail = "Escolha um canal antes de detalhar a origem.";

  return {
    input: { name, phone, email, birthDate, city, instagram, preferredContact, source, sourceDetail: sourceDetail || source, vip: values.has("vip") },
    errors,
  };
}

export type SessionField = "service" | "date" | "amount" | "payment" | "duration" | "note";
export type SessionErrors = Partial<Record<SessionField, string>>;
export type SessionInput = Omit<ClientSession, "id" | "appointmentId" | "serviceId">;

export function validateSession(values: FormData, planned: boolean, sessions: ClientSession[], editingId?: string): { input: SessionInput; errors: SessionErrors } {
  const errors: SessionErrors = {};
  const service = String(values.get("service") ?? "").trim().replace(/\s+/g, " ");
  const date = String(values.get("date") ?? "").trim();
  const amountText = String(values.get("amount") ?? "").trim();
  const amount = planned ? 0 : Number(amountText.replace(",", "."));
  const payment = planned ? "Agendado" : String(values.get("payment") ?? "").trim();
  const duration = planned ? "A definir" : String(values.get("duration") ?? "").trim() || "Não informada";
  const note = String(values.get("note") ?? "").trim();

  if (service.length < 3 || service.length > 100) errors.service = "Informe o procedimento com 3 a 100 caracteres.";
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(date);
  const parsed = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]), Number(dateParts[4]), Number(dateParts[5])) : null;
  const timestamp = parsed?.getTime() ?? NaN;
  const validDate = Boolean(dateParts && parsed && parsed.getFullYear() === Number(dateParts[1]) && parsed.getMonth() + 1 === Number(dateParts[2]) && parsed.getDate() === Number(dateParts[3]) && parsed.getHours() === Number(dateParts[4]) && parsed.getMinutes() === Number(dateParts[5]));
  if (!validDate || !Number.isFinite(timestamp)) errors.date = "Informe uma data e um horário válidos.";
  else if (planned && timestamp < Date.now() - 60_000) errors.date = "Escolha um horário futuro para a manutenção.";
  else if (!planned && timestamp > Date.now() + 5 * 60_000) errors.date = "Uma sessão concluída não pode ter data futura.";
  else if (planned && sessions.some((session) => session.id !== editingId && session.payment === "Agendado" && session.date === date && session.service.toLocaleLowerCase("pt-BR") === service.toLocaleLowerCase("pt-BR"))) errors.date = "Já existe esta manutenção planejada neste horário.";

  if (!planned && (amountText === "" || !Number.isFinite(amount) || amount < 0 || amount > 999_999 || !/^\d+(?:[.,]\d{1,2})?$/.test(amountText))) errors.amount = "Informe um valor válido entre R$ 0 e R$ 999.999, com até 2 casas decimais.";
  if (!planned && !["Pix", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Pendente"].includes(payment)) errors.payment = "Escolha uma forma de pagamento válida.";
  if (duration.length > 40) errors.duration = "Use até 40 caracteres para a duração.";
  if (note.length > 500) errors.note = "Use até 500 caracteres nas observações.";

  return { input: { service, date, amount, payment, duration, note }, errors };
}
