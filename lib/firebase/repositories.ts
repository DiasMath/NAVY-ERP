import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import type { AppointmentDocument, ClientDocument, ClinicalSessionDocument, ProfessionalDocument, ServiceDocument } from "./documents";

export type CollectionRepository<T extends { id: string }> = {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  save(item: T): Promise<void>;
  update(id: string, changes: Partial<Omit<T, "id">>): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(onData: (items: T[]) => void, onError: (error: Error) => void): () => void;
};

const segments = ["clients", "services", "professionals", "appointments", "sessions"] as const;
type Segment = typeof segments[number];

function assertId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error("Identificador inválido.");
}

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, part]) => part !== undefined).map(([key, part]) => [key, clean(part)]));
  }
  return value;
}

function repository<T extends { id: string }>(db: Firestore, clinicId: string, segment: Segment): CollectionRepository<T> {
  assertId(clinicId);
  const path = ["clinics", clinicId, segment] as const;
  const document = (id: string) => { assertId(id); return doc(db, ...path, id); };
  return {
    async list() {
      const snapshot = await getDocs(collection(db, ...path));
      return snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as T);
    },
    async get(id) {
      const snapshot = await getDoc(document(id));
      return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as T) : null;
    },
    async save(item) {
      const { id, ...data } = item;
      await setDoc(document(id), clean(data) as Record<string, unknown>);
    },
    async update(id, changes) { await updateDoc(document(id), clean(changes) as Record<string, unknown>); },
    async remove(id) { await deleteDoc(document(id)); },
    subscribe(onData, onError) {
      return onSnapshot(collection(db, ...path), snapshot => {
        onData(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as T));
      }, onError);
    },
  };
}

// Uma interface por entidade permite trocar a implementação local sem alterar a UI.
export function createFirebaseRepositories(db: Firestore, clinicId: string) {
  return {
    clients: repository<ClientDocument>(db, clinicId, "clients"),
    services: repository<ServiceDocument>(db, clinicId, "services"),
    professionals: repository<ProfessionalDocument>(db, clinicId, "professionals"),
    appointments: repository<AppointmentDocument>(db, clinicId, "appointments"),
    sessions: repository<ClinicalSessionDocument>(db, clinicId, "sessions"),
  };
}
