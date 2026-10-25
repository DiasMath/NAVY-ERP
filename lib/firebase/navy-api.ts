import type { User } from "firebase/auth";

export class NavyApiError extends Error {}

export async function navyApi(user: User, path: string, init: RequestInit = {}) {
  const request = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  };
  let response = await request(false);
  if (response.status === 401) {
    try { response = await request(true); }
    catch { throw new NavyApiError("Sua sessão expirou. Saia da NAVY e entre novamente."); }
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new NavyApiError(data.error ?? "Não foi possível concluir a operação.");
  }
  return response;
}
