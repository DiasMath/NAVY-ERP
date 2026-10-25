import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { ApiError } from "./navy-auth";

const redirectUri = "https://navy-frontend.vercel.app/api/drive/oauth/callback";
const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

function secretKey() {
  const key = Buffer.from(process.env.DRIVE_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new ApiError(503, "Integração do Drive ainda não configurada.");
  return key;
}

function oauthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ApiError(503, "Credencial OAuth do Drive ainda não configurada.");
  return { clientId, clientSecret };
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".").map(part => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new ApiError(503, "Conexão do Drive inválida.");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.DRIVE_TOKEN_ENCRYPTION_KEY && (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS));
}

export function makeOAuthUrl(uid: string, clinicId: string) {
  const { clientId } = oauthConfig();
  const payload = Buffer.from(JSON.stringify({ uid, clinicId, at: Date.now(), nonce: randomBytes(16).toString("base64url") })).toString("base64url");
  const signature = createHmac("sha256", secretKey()).update(payload).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", `${payload}.${signature}`);
  return url.toString();
}

export function verifyOAuthState(value: string): { uid: string; clinicId: string } {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new ApiError(400, "Autorização inválida.");
  const expected = createHmac("sha256", secretKey()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new ApiError(400, "Autorização inválida.");
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; clinicId: string; at: number };
  if (!state.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(state.clinicId) || Date.now() - state.at > 10 * 60_000 || state.at > Date.now() + 60_000) throw new ApiError(400, "Autorização expirada.");
  return { uid: state.uid, clinicId: state.clinicId };
}

export async function exchangeOAuthCode(code: string) {
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; refresh_token?: string };
  if (!response.ok || !data.access_token || !data.refresh_token) throw new ApiError(400, "O Google não forneceu acesso permanente. Autorize novamente.");
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function googleAccountEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new ApiError(400, "Não foi possível confirmar a conta Google.");
  const data = await response.json() as { email?: string; email_verified?: boolean };
  return data.email_verified ? data.email?.toLowerCase() : undefined;
}

type DriveConnection = { refreshTokenEncrypted: string; folderId: string; ownerEmail: string; connectedAt: string };
const connectionRef = (clinicId: string) => adminDb().doc(`clinics/${clinicId}/integrations/drive`);

export async function driveStatus(clinicId: string) {
  const snapshot = await connectionRef(clinicId).get();
  const data = snapshot.data() as DriveConnection | undefined;
  return data?.refreshTokenEncrypted && data.folderId ? { connected: true, folderId: data.folderId, ownerEmail: data.ownerEmail } : { connected: false };
}

export async function saveDriveConnection(clinicId: string, refreshToken: string, folderId: string, ownerEmail: string) {
  await connectionRef(clinicId).set({ refreshTokenEncrypted: encrypt(refreshToken), folderId, ownerEmail, connectedAt: new Date().toISOString() });
}

async function accessToken(clinicId: string) {
  const snapshot = await connectionRef(clinicId).get();
  const connection = snapshot.data() as DriveConnection | undefined;
  if (!connection?.refreshTokenEncrypted) throw new ApiError(503, "Conecte o Google Drive antes de enviar imagens.");
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: decrypt(connection.refreshTokenEncrypted), client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }), cache: "no-store",
  });
  const data = await response.json() as { access_token?: string };
  if (!response.ok || !data.access_token) throw new ApiError(503, "A autorização do Drive expirou. Reconecte a conta Google.");
  return { token: data.access_token, folderId: connection.folderId };
}

async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) {
    console.error("Google Drive API", response.status, await response.text());
    throw new ApiError(response.status === 404 ? 404 : 502, "Falha na comunicação com o Google Drive.");
  }
  return response;
}

export async function createDriveFolder(accessToken: string, name: string) {
  const response = await driveFetch(accessToken, "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  const data = await response.json() as { id?: string };
  if (!data.id) throw new ApiError(502, "O Drive não retornou o ID da pasta.");
  return data.id;
}

export async function uploadDriveJpeg(clinicId: string, name: string, bytes: Buffer) {
  const { token, folderId } = await accessToken(clinicId);
  const boundary = `navy_${randomBytes(12).toString("hex")}`;
  const metadata = JSON.stringify({ name, parents: [folderId], mimeType: "image/jpeg" });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
  const data = await response.json() as { id?: string };
  if (!data.id) throw new ApiError(502, "O Drive não retornou o ID da imagem.");
  return data.id;
}

export async function downloadDriveImage(clinicId: string, fileId: string) {
  const { token } = await accessToken(clinicId);
  return driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
}

export async function deleteDriveFile(clinicId: string, fileId: string) {
  const { token } = await accessToken(clinicId);
  await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}
