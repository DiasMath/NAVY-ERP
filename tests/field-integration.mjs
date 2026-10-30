import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "demo-navy-field";
const port = 3108;
const origin = `http://127.0.0.1:${port}`;
const app = initializeApp({ projectId });
const db = getFirestore(app);
const serverMode = process.env.FIELD_TEST_SERVER === "start" ? "start" : "dev";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", serverMode, "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, FIREBASE_PROJECT_ID: projectId, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", data => { serverOutput = (serverOutput + data.toString()).slice(-6000); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next.js exited: ${serverOutput}`);
    try { if ((await fetch(`${origin}/campo`, { signal: AbortSignal.timeout(2500) })).ok) return; } catch {}
    await sleep(1000);
  }
  throw new Error(`Next.js did not start: ${serverOutput}`);
}
async function signUp(email) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "TestField123!", returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function request(path, method, token, body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
function expectStatus(result, status) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  return result.body;
}

try {
  await ready();
  const [one, two, admin, master] = await Promise.all([signUp("professional1@example.test"), signUp("professional2@example.test"), signUp("admin@example.test"), signUp("master@example.test")]);
  const permissions = ["agenda.read", "agenda.write", "clients.read", "clients.write", "sessions.read", "sessions.write"];
  await Promise.all([
    db.doc(`users/${one.localId}`).set({ name: "Profissional 1", role: "professional", clinicId: "navy-matriz", active: true, professionalId: "pro1", permissions }),
    db.doc(`users/${two.localId}`).set({ name: "Profissional 2", role: "professional", clinicId: "navy-matriz", active: true, professionalId: "pro2", permissions }),
    db.doc(`users/${admin.localId}`).set({ name: "Admin Teste", role: "admin", clinicId: "navy-matriz", active: true, permissions: ["clients.read"] }),
    db.doc(`users/${master.localId}`).set({ name: "Master Teste", role: "master_admin", clinicId: "navy-matriz", active: true }),
    db.doc("clinics/navy-matriz/professionals/pro1").set({ name: "Profissional 1", active: true, userUid: one.localId }),
    db.doc("clinics/navy-matriz/professionals/pro2").set({ name: "Profissional 2", active: true, userUid: two.localId }),
    db.doc("clinics/navy-matriz/clients/shared").set({ name: "Cliente Compartilhada", phone: "11999999999", city: "São Paulo", clinicalNote: "Observação clínica" }),
    db.doc("clinics/navy-matriz/clients/other").set({ name: "Cliente da outra profissional", phone: "11888888888", city: "São Paulo" }),
    db.doc("clinics/navy-matriz/services/service1").set({ name: "Procedimento", description: "Preparação e aplicação", consumables: [{ name: "Kit descartável", quantity: "1 unidade", cost: 12 }] }),
  ]);
  const line = { serviceId: "service1", name: "Procedimento", price: 50, durationMinutes: 60, bufferMinutes: 0 };
  const appointment = (id, professionalId, clientId) => ({ id, bookingKind: "catalog", professionalId, clientId, date: "2026-10-28", time: "10:00", place: "Studio", lines: [line], status: "Concluído", materials: [], createdAt: "2026-10-27T10:00:00Z", updatedAt: "2026-10-28T11:00:00Z" });
  await Promise.all([
    db.doc("clinics/navy-matriz/appointments/own").set(appointment("own", "pro1", "shared")),
    db.doc("clinics/navy-matriz/appointments/sharedOther").set(appointment("sharedOther", "pro2", "shared")),
    db.doc("clinics/navy-matriz/appointments/other").set(appointment("other", "pro2", "other")),
    db.doc("clinics/navy-matriz/sessions/sharedOther").set({ id: "sharedOther", appointmentId: "sharedOther", clientId: "shared", serviceName: "Outro procedimento", startedAt: "2026-10-28T11:00:00Z", notes: "Anotação privada da outra profissional" }),
    db.doc("clinics/navy-matriz/clientPhotos/otherPhoto").set({ clientId: "shared", driveFileId: "fake-file", name: "Foto de teste", consentConfirmedBy: two.localId, createdAt: "2026-10-28T11:00:00Z" }),
  ]);

  const adminListing = expectStatus(await request("/api/field", "GET", admin.idToken), 200);
  assert.deepEqual(adminListing.appointments.map(item => item.id), ["other", "own", "sharedOther"]);
  const masterListing = expectStatus(await request("/api/field", "GET", master.idToken), 200);
  assert.deepEqual(masterListing.appointments.map(item => item.id), ["other", "own", "sharedOther"]);
  const adminDetail = expectStatus(await request("/api/field/client?clientId=shared", "GET", admin.idToken), 200);
  assert.deepEqual(adminDetail.history.map(item => item.id), ["sharedOther"]);
  expectStatus(await request("/api/field/session", "POST", admin.idToken, { appointmentId: "own", notes: "Prévia sem gravação" }), 403);

  const listing = expectStatus(await request("/api/field", "GET", one.idToken), 200);
  assert.deepEqual(listing.appointments.map(item => item.id), ["own"]);
  assert.deepEqual(listing.clients.map(item => item.id), ["shared"]);
  assert.equal(listing.serviceDetails.service1.description, "Preparação e aplicação");
  assert.deepEqual(listing.serviceDetails.service1.consumables, [{ name: "Kit descartável", quantity: "1 unidade" }]);
  assert.ok(!JSON.stringify(listing.serviceDetails).includes('"cost"'));
  const detail = expectStatus(await request("/api/field/client?clientId=shared", "GET", one.idToken), 200);
  assert.equal(detail.client.name, "Cliente Compartilhada");
  assert.deepEqual(detail.history, []);
  expectStatus(await request("/api/field/client?clientId=other", "GET", one.idToken), 403);
  expectStatus(await request("/api/clients/other/photos", "GET", one.idToken), 403);
  expectStatus(await request("/api/clients/other/images/avatar", "GET", one.idToken), 403);
  expectStatus(await request("/api/clients/shared/photos/otherPhoto", "PATCH", one.idToken), 403);
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "other", status: "Em atendimento" }), 403);
  expectStatus(await request("/api/appointments", "POST", one.idToken, {}), 403);
  expectStatus(await request("/api/field/session", "POST", one.idToken, { appointmentId: "other", notes: "Tentativa" }), 403);
  expectStatus(await request("/api/field/session", "POST", one.idToken, { appointmentId: "own", notes: "Procedimento realizado sem intercorrências." }), 201);
  expectStatus(await request("/api/field/session", "POST", one.idToken, { appointmentId: "own", notes: "Duplicado" }), 409);
  const own = (await db.doc("clinics/navy-matriz/sessions/own").get()).data();
  assert.equal(own.paymentStatus, "pending");
  assert.equal(own.amount, 50);
  const updated = expectStatus(await request("/api/field/client?clientId=shared", "GET", one.idToken), 200);
  assert.deepEqual(updated.history.map(item => item.id), ["own"]);
  assert.ok(!JSON.stringify(updated).includes("Anotação privada"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const futureDate = tomorrow.toISOString().slice(0, 10);
  await db.doc("clinics/navy-matriz/appointments/future").set({ ...appointment("future", "pro1", "shared"), date: futureDate, status: "Pendente", materials: ["Maleta de teste"] });
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "future", status: "Concluído" }), 409);
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "future", status: "Em atendimento" }), 409);
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "future", status: "Concluído", earlyStartConfirmed: true }), 400);
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "future", status: "Em atendimento", earlyStartConfirmed: true }), 200);
  const started = (await db.doc("clinics/navy-matriz/appointments/future").get()).data();
  assert.equal(started.status, "Em atendimento");
  assert.ok(Date.parse(started.startedAt) > 0);
  assert.ok(Date.parse(started.earlyStartConfirmedAt) > 0);
  const running = expectStatus(await request("/api/field", "GET", one.idToken), 200);
  assert.equal(running.appointments.find(item => item.id === "future").startedAt, started.startedAt);
  assert.deepEqual(running.appointments.find(item => item.id === "future").materials, ["Maleta de teste"]);
  expectStatus(await request("/api/appointments", "PATCH", one.idToken, { id: "future", status: "Concluído" }), 200);
  const completed = (await db.doc("clinics/navy-matriz/appointments/future").get()).data();
  assert.equal(completed.startedAt, started.startedAt);
  assert.ok(Date.parse(completed.completedAt) >= Date.parse(started.startedAt));
  expectStatus(await request("/api/field/session", "POST", one.idToken, { appointmentId: "future", notes: "Atendimento antecipado concluído." }), 201);
  const session = (await db.doc("clinics/navy-matriz/sessions/future").get()).data();
  assert.equal(session.startedAt, started.startedAt);
  assert.equal(session.completedAt, completed.completedAt);
  console.log("Field API integration: scoped data, supplies, early start confirmation, persisted timer and session recording passed.");
} finally {
  server.kill();
  await deleteApp(app);
}
