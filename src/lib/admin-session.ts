import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'ts_admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 jam

function sign(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET!;
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export async function createAdminSession() {
  const issuedAt = Date.now().toString();
  const signature = sign(issuedAt);
  const store = await cookies();
  store.set(COOKIE_NAME, `${issuedAt}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const [issuedAt, signature] = raw.split('.');
  if (!issuedAt || !signature) return false;
  if (sign(issuedAt) !== signature) return false;

  const age = Date.now() - Number(issuedAt);
  return age >= 0 && age <= MAX_AGE_SECONDS * 1000;
}
