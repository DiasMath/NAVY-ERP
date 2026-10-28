import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "demo-navy-admin";
const port = 3107;
const origin = "http://127.0.0.1:" + port;
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, FIREBASE_PROJECT_ID: projectId, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", data => { serverOutput = (serverOutput + data.toString()).slice(-6000); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error("Next.js exited: " + serverOutput);
    try { if ((await fetch(origin + "/usuarios")).ok) return; } catch {}
    await sleep(1000);
  }
  throw new Error("Next.js did not start: " + serverOutput);
}
async function request(path, method, token, body) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
function expectStatus(response, status) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  return response.body;
}

try {
  await ready();
  const signup = await fetch("http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST + "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.test", password: "AdminTest123!", returnSecureToken: true }),
  });
  assert.equal(signup.status, 200);
  const { localId: adminUid, idToken } = await signup.json();
  await db.doc("users/" + adminUid).set({ name: "Admin Teste", email: "admin@example.test", clinicId: "navy-matriz", role: "admin", active: true });
  const owner = await auth.createUser({ email: "owner@example.test", displayName: "Matheus Dias", password: "OwnerTest123!" });
  await db.doc("users/" + owner.uid).set({ name: "Matheus Dias", email: "owner@example.test", clinicId: "navy-matriz", role: "master_admin", active: true });

  expectStatus(await request("/api/admin/users", "GET"), 401);
  let listing = expectStatus(await request("/api/admin/users", "GET", idToken), 200);
  assert.equal(listing.users.length, 1);
  assert.equal(listing.users[0].uid, adminUid);
  expectStatus(await request("/api/admin/users", "PATCH", idToken, { uid: owner.uid, name: "Alterado", active: true }), 403);

  const role = expectStatus(await request("/api/admin/access", "POST", idToken, { kind: "role", name: "Papel Teste", description: "Temporário", permissions: ["clients.read"] }), 201);
  const group = expectStatus(await request("/api/admin/access", "POST", idToken, { kind: "group", name: "Grupo Teste", description: "Temporário", permissions: ["services.read"] }), 201);
  const catalog = expectStatus(await request("/api/admin/access", "GET", idToken), 200);
  assert.equal(catalog.roles[0].id, role.id);
  assert.equal(catalog.groups[0].id, group.id);
  expectStatus(await request("/api/admin/access", "POST", idToken, { kind: "role", name: "Papel Invalido", permissions: ["invalid.permission"] }), 400);

  const create = { name: "Profissional Teste", email: "professional@example.test", role: "professional", roleId: role.id, groupIds: [group.id], createProfessional: true, professionalId: "", active: true };
  const created = expectStatus(await request("/api/admin/users", "POST", idToken, create), 201);
  const uid = created.uid;
  let profile = (await db.doc("users/" + uid).get()).data();
  assert.equal(profile.professionalId, uid);
  assert.deepEqual(profile.permissions, ["clients.read", "services.read"]);
  assert.equal((await db.doc("clinics/navy-matriz/professionals/" + uid).get()).data().userUid, uid);
  assert.equal((await auth.getUser(uid)).displayName, "Profissional Teste");
  listing = expectStatus(await request("/api/admin/users", "GET", idToken), 200);
  assert.equal(listing.users.length, 2);
  assert.ok(!listing.users.some(user => user.uid === owner.uid));
  expectStatus(await request("/api/admin/users", "POST", idToken, create), 409);
  expectStatus(await request("/api/admin/access?kind=role&id=" + role.id, "DELETE", idToken), 409);

  expectStatus(await request("/api/admin/access", "PATCH", idToken, { kind: "role", id: role.id, name: "Papel Teste Editado", description: "", permissions: ["clients.read", "agenda.read"] }), 200);
  profile = (await db.doc("users/" + uid).get()).data();
  assert.deepEqual(profile.permissions, ["agenda.read", "clients.read", "services.read"]);
  expectStatus(await request("/api/admin/access", "PATCH", idToken, { kind: "group", id: group.id, name: "Grupo Teste Editado", description: "", permissions: ["services.read", "professionals.read"] }), 200);
  profile = (await db.doc("users/" + uid).get()).data();
  assert.deepEqual(profile.permissions, ["agenda.read", "clients.read", "professionals.read", "services.read"]);

  expectStatus(await request("/api/admin/users", "PATCH", idToken, { uid, name: "Profissional Editada", role: "professional", roleId: "", groupIds: [], professionalId: uid, createProfessional: false, active: false }), 200);
  profile = (await db.doc("users/" + uid).get()).data();
  assert.equal(profile.active, false);
  assert.equal(profile.name, "Profissional Editada");
  assert.equal((await auth.getUser(uid)).disabled, true);
  assert.equal((await auth.getUser(uid)).displayName, "Profissional Editada");
  assert.equal((await db.doc("clinics/navy-matriz/professionals/" + uid).get()).data().name, "Profissional Editada");
  expectStatus(await request("/api/admin/access?kind=role&id=" + role.id, "DELETE", idToken), 200);
  expectStatus(await request("/api/admin/access?kind=group&id=" + group.id, "DELETE", idToken), 200);

  console.log("Admin API integration: users, roles, groups, permissions, owner protection and professional link passed.");
} finally {
  server.kill();
  await deleteApp(app);
}
