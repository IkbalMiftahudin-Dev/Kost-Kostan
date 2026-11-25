import { NextResponse } from 'next/server';
import { getPublicUnits } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getPublicUnits();
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data kontrakan.',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
