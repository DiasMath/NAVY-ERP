"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browserLocalPersistence, browserSessionPersistence, onAuthStateChanged, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseClient } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export type UserRole = "master_admin" | "admin" | "reception" | "professional";
export type NavyUserProfile = { uid: string; name: string; clinicId: string; role: UserRole; active: true };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthState = {
  status: AuthStatus;
  user: User | null;
  profile: NavyUserProfile | null;
  error: string;
  signIn(email: string, password: string, remember: boolean): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
};

const roles: UserRole[] = ["master_admin", "admin", "reception", "professional"];
const AuthContext = createContext<AuthState | null>(null);

async function readProfile(uid: string): Promise<NavyUserProfile | null> {
  const { db } = getFirebaseClient();
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (data.active !== true || typeof data.clinicId !== "string" || !data.clinicId || !roles.includes(data.role) || typeof data.name !== "string") return null;
  return { uid, name: data.name, clinicId: data.clinicId, role: data.role, active: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isFirebaseConfigured ? "loading" : "unauthenticated");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<NavyUserProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth } = getFirebaseClient();
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async nextUser => {
      const current = ++revision;
      if (!nextUser) { setUser(null); setProfile(null); setStatus("unauthenticated"); return; }
      setStatus("loading");
      try {
        const nextProfile = await readProfile(nextUser.uid);
        if (current !== revision) return;
        if (!nextProfile) {
          setError("Esta conta não tem acesso ativo à NAVY. Peça autorização à administração.");
          await firebaseSignOut(auth);
          return;
        }
        setUser(nextUser); setProfile(nextProfile); setError(""); setStatus("authenticated");
      } catch {
        if (current !== revision) return;
        setError("Não foi possível verificar as permissões desta conta. Tente novamente.");
        await firebaseSignOut(auth);
      }
    });
    return () => { revision++; unsubscribe(); };
  }, []);

  const value = useMemo<AuthState>(() => ({
    status, user, profile, error,
    async signIn(email, password, remember) {
      if (!isFirebaseConfigured) throw new Error("Firebase ainda não foi configurado.");
      setError("");
      const { auth } = getFirebaseClient();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signOut() {
      if (!isFirebaseConfigured) return;
      await firebaseSignOut(getFirebaseClient().auth);
    },
    async resetPassword(email) {
      if (!isFirebaseConfigured) throw new Error("Firebase ainda não foi configurado.");
      await sendPasswordResetEmail(getFirebaseClient().auth, email);
    },
  }), [status, user, profile, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa de AuthProvider.");
  return context;
}
