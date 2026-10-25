import type { User } from "firebase/auth";

export class NavyApiError extends Error {}

export async function navyApi(user: User, path: string, init: RequestInit = {}) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new NavyApiError(data.error ?? "Não foi possível concluir a operação.");
  }
  return response;
}
