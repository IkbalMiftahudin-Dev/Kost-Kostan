import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, getSessionAdmin, SESSION_COOKIE_NAME } from '@/lib/auth';
import { authenticateAdmin } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ success: true, authenticated: false });
  }
  return NextResponse.json({ success: true, authenticated: true, admin });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'login';

    if (action === 'logout') {
      const res = NextResponse.json({ success: true, message: 'Berhasil logout.' });
      res.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
      return res;
    }

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username dan password wajib diisi.' }, { status: 422 });
    }

    const admin = await authenticateAdmin(username, password);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Username atau password salah.' }, { status: 401 });
    }

    const token = createSessionToken(admin);
    const res = NextResponse.json({ success: true, message: 'Login berhasil.', admin });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Gagal memproses autentikasi.' },
      { status: 500 }
    );
  }
}
