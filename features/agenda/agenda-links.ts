type NewAgendaLink = {
  clientId?: string;
  serviceId?: string;
  professionalId?: string;
  date?: string;
  intent?: "maintenance";
};

export function newAgendaHref(values: NewAgendaLink): string {
  const query = new URLSearchParams({ new: "1" });
  if (values.clientId) query.set("clientId", values.clientId);
  if (values.serviceId) query.set("serviceId", values.serviceId);
  if (values.professionalId) query.set("professionalId", values.professionalId);
  if (values.date) query.set("date", values.date);
  if (values.intent) query.set("intent", values.intent);
  return `/agenda?${query.toString()}`;
}

export function appointmentHref(appointmentId: string): string {
  return `/agenda?appointmentId=${encodeURIComponent(appointmentId)}`;
}
