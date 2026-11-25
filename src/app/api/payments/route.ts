import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth';
import { getCurrentPeriod } from '@/lib/helpers';
import { deletePayment, generateMonthlyPayments, getAdminPayments, updatePayment } from '@/lib/store';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Silakan login admin terlebih dahulu.' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const rawPeriode = req.nextUrl.searchParams.get('periode') || getCurrentPeriod();
    const periode = rawPeriode === 'all' || /^\d{4}-\d{2}$/.test(rawPeriode) ? rawPeriode : getCurrentPeriod();
    const status = req.nextUrl.searchParams.get('status') || 'all';

    const data = await getAdminPayments(periode, status);
    return NextResponse.json({ success: true, periode, ...data });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const periode = String(body.periode_bulan || getCurrentPeriod());
    if (!/^\d{4}-\d{2}$/.test(periode)) {
      return NextResponse.json({ success: false, message: 'Format periode tidak valid (YYYY-MM).' }, { status: 422 });
    }

    const created = await generateMonthlyPayments(periode);
    return NextResponse.json({
      success: true,
      created,
      message:
        created > 0
          ? `Berhasil membuat ${created} jadwal pembayaran untuk periode ${periode}.`
          : `Semua penghuni aktif sudah memiliki jadwal pembayaran pada periode ${periode}.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal generate tagihan.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const id = Number(body.id || 0);
    if (id <= 0) {
      return NextResponse.json({ success: false, message: 'ID pembayaran tidak valid.' }, { status: 422 });
    }
    await updatePayment({ ...body, id });
    return NextResponse.json({ success: true, message: 'Jadwal & status pembayaran berhasil diperbarui.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal memperbarui pembayaran.' }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = Number(req.nextUrl.searchParams.get('id') || 0);
    if (id <= 0) {
      return NextResponse.json({ success: false, message: 'ID pembayaran tidak valid.' }, { status: 422 });
    }
    await deletePayment(id);
    return NextResponse.json({ success: true, message: 'Data tagihan berhasil dihapus.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal menghapus tagihan.' }, { status: 500 });
  }
}
