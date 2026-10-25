import type { ClientSource, PreferredContact } from "@/features/clients/client-data";
import type { ServiceRecord } from "@/features/services/service-data";
import type { AgendaAppointment } from "@/features/agenda/agenda-data";

// Documentos persistidos. Os modelos de demonstração das telas são adaptados
// para estes formatos durante a migração, sem levar contadores ou fotos base64.
export type ClientDocument = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  instagram?: string;
  preferredContact?: PreferredContact | null;
  source: ClientSource;
  sourceDetail?: string;
  city?: string;
  vip: boolean;
  clinicalNote?: string;
  preferences?: string;
  returnDate?: string;
  avatarDriveFileId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceDocument = Omit<ServiceRecord, "imageUrl"> & { imageDriveFileId?: string };
export type ProfessionalDocument = { id: string; name: string; active: boolean };
export type AppointmentDocument = Omit<AgendaAppointment, "demo"> & { createdAt: string; updatedAt: string };
export type ClinicalSessionDocument = {
  id: string;
  clientId: string;
  appointmentId?: string;
  serviceId?: string;
  startedAt: string;
  serviceName: string;
  durationLabel: string;
  amount: number;
  paymentStatus: "planned" | "pending" | "paid";
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
};
