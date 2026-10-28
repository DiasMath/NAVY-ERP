import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp() {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = json ? cert(JSON.parse(json)) : applicationDefault();
  return initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID ?? "navy-erp" });
}

export function adminAuth() { return getAuth(adminApp()); }
export function adminDb() { return getFirestore(adminApp()); }
