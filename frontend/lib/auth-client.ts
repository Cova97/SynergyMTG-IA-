'use client';

// Se usa una cookie (no localStorage) a proposito: asi tanto el
// navegador como el servidor de Next.js (en los Server Components)
// pueden leer el mismo token sin duplicar el mecanismo de guardado.
const COOKIE_NAME = 'synergymtg_token';

export function setClientToken(token: string): void {
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 dias, igual que la expiracion del JWT
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getClientToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearClientToken(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}