import { cookies } from 'next/headers';

const COOKIE_NAME = 'synergymtg_token';

// next/headers cookies() es async desde Next 15+ (mismo cambio que
// afecto a 'params' en las paginas dinamicas) — hay que await-earlo.
export async function getServerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}