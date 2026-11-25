import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { AdminUser } from './types';

export const SESSION_COOKIE_NAME = 'kta_admin_session';

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || 'kontrakan-teh-amoy-default-dev-secret-change-in-vercel';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

interface SessionPayload extends AdminUser {
  exp: number;
}

export function createSessionToken(admin: AdminUser): string {
  const payload: SessionPayload = {
    ...admin,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 hari
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): AdminUser | null {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.id || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return {
      id: parsed.id,
      username: parsed.username,
      nama_lengkap: parsed.nama_lengkap,
    };
  } catch {
    return null;
  }
}

export async function getSessionAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
