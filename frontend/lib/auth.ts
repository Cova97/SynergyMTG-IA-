// lib/auth.ts — llamadas de registro/login. Separado de api.ts porque
// estas dos NO necesitan token (son como lo consigues).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AuthResult {
  accessToken: string;
  username: string;
  displayName: string;
}

async function authFetch(path: string, body: unknown): Promise<AuthResult> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message ?? `Error ${res.status}`);
  }

  return res.json();
}

export function registerUser(displayName: string, password: string): Promise<AuthResult> {
  return authFetch('/auth/register', { displayName, password });
}

export function loginUser(username: string, password: string): Promise<AuthResult> {
  return authFetch('/auth/login', { username, password });
}