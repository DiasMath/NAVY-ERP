import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [address, port] = host.split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-navy-rules",
  firestore: { host: address, port: Number(port), rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

try {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users/admin"), { name: "Admin", role: "admin", clinicId: "navy-matriz", active: true }),
      setDoc(doc(db, "users/reader"), { name: "Reader", role: "employee", clinicId: "navy-matriz", active: true, permissions: ["clients.read", "professionals.read", "agenda.read"] }),
      setDoc(doc(db, "users/editor"), { name: "Editor", role: "employee", clinicId: "navy-matriz", active: true, permissions: ["clients.read", "clients.write", "professionals.read", "professionals.write", "sessions.read", "sessions.write"] }),
      setDoc(doc(db, "users/disabled"), { name: "Disabled", role: "admin", clinicId: "navy-matriz", active: false }),
      setDoc(doc(db, "users/other"), { name: "Other", role: "admin", clinicId: "other-clinic", active: true }),
      setDoc(doc(db, "clinics/navy-matriz/clients/client1"), { name: "Cliente" }),
      setDoc(doc(db, "clinics/navy-matriz/services/service1"), { name: "Serviço" }),
      setDoc(doc(db, "clinics/navy-matriz/professionals/free"), { name: "Livre", active: true }),
      setDoc(doc(db, "clinics/navy-matriz/professionals/linked"), { name: "Vinculada", active: true, userUid: "owner" }),
      setDoc(doc(db, "clinics/navy-matriz/appointments/appointment1"), { date: "2026-10-28" }),
      setDoc(doc(db, "clinics/navy-matriz/sessions/session1"), { notes: "Registro" }),
    ]);
  });

  const admin = environment.authenticatedContext("admin").firestore();
  const reader = environment.authenticatedContext("reader").firestore();
  const editor = environment.authenticatedContext("editor").firestore();
  const disabled = environment.authenticatedContext("disabled").firestore();
  const other = environment.authenticatedContext("other").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(admin, "clinics/navy-matriz/clients/client1")));
  await assertSucceeds(getDoc(doc(reader, "clinics/navy-matriz/clients/client1")));
  await assertFails(setDoc(doc(reader, "clinics/navy-matriz/clients/new"), { name: "Não autorizado" }));
  await assertSucceeds(setDoc(doc(editor, "clinics/navy-matriz/clients/new"), { name: "Autorizado" }));
  await assertFails(getDoc(doc(reader, "clinics/navy-matriz/services/service1")));
  await assertFails(getDoc(doc(disabled, "clinics/navy-matriz/clients/client1")));
  await assertFails(getDoc(doc(other, "clinics/navy-matriz/clients/client1")));
  await assertFails(getDoc(doc(anonymous, "clinics/navy-matriz/clients/client1")));
  await assertSucceeds(getDoc(doc(reader, "clinics/navy-matriz/appointments/appointment1")));
  await assertFails(setDoc(doc(admin, "clinics/navy-matriz/appointments/new"), { date: "2026-10-28" }));
  await assertFails(setDoc(doc(admin, "clinics/navy-matriz/scheduleLocks/new"), { revision: 1 }));

  await assertSucceeds(updateDoc(doc(editor, "clinics/navy-matriz/professionals/free"), { name: "Livre editada" }));
  await assertFails(updateDoc(doc(editor, "clinics/navy-matriz/professionals/linked"), { name: "Tentativa" }));
  await assertFails(deleteDoc(doc(editor, "clinics/navy-matriz/professionals/linked")));
  await assertFails(setDoc(doc(editor, "clinics/navy-matriz/professionals/spoof"), { name: "Tentativa", userUid: "editor" }));

  await assertSucceeds(updateDoc(doc(editor, "clinics/navy-matriz/sessions/session1"), { notes: "Editado" }));
  await assertFails(deleteDoc(doc(editor, "clinics/navy-matriz/sessions/session1")));
  await assertSucceeds(deleteDoc(doc(admin, "clinics/navy-matriz/sessions/session1")));
  await assertFails(deleteDoc(doc(editor, "clinics/navy-matriz/services/service1")));

  await assertSucceeds(getDoc(doc(reader, "users/reader")));
  await assertSucceeds(getDoc(doc(admin, "users/admin")));
  await assertFails(getDoc(doc(reader, "users/admin")));
  await assertFails(getDocs(collection(admin, "users")));
  await assertFails(updateDoc(doc(admin, "users/reader"), { permissions: ["users.manage"] }));
  await assertFails(getDoc(doc(admin, "clinics/navy-matriz/accessRoles/any")));
  await assertFails(setDoc(doc(admin, "clinics/navy-matriz/accessGroups/any"), { name: "Grupo" }));

  console.log("Firestore rules: 26 access checks passed.");
} finally {
  await environment.cleanup();
}
