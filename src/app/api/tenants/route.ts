import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth';
import { assignOrUpdateTenant, checkoutTenant, getAdminTenants } from '@/lib/store';

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
    const status = req.nextUrl.searchParams.get('status') || 'aktif';
    const tenants = await getAdminTenants(status);
    return NextResponse.json({ success: true, tenants });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const action = body.action || 'assign';
    const unitId = Number(body.unit_id || 0);
    if (unitId <= 0) {
      return NextResponse.json({ success: false, message: 'Unit kontrakan tidak valid.' }, { status: 422 });
    }

    if (action === 'checkout') {
      await checkoutTenant(unitId);
      return NextResponse.json({
        success: true,
        message: 'Penghuni berhasil checkout dan kontrakan sekarang berstatus Kosong.',
      });
    }

    const nama = String(body.nama_penghuni || '').trim();
    if (!nama) {
      return NextResponse.json({ success: false, message: 'Nama penghuni wajib diisi.' }, { status: 422 });
    }

    const res = await assignOrUpdateTenant({
      unit_id: unitId,
      nama_penghuni: nama,
      no_hp: body.no_hp,
      tanggal_masuk: body.tanggal_masuk,
      tanggal_jatuh_tempo: body.tanggal_jatuh_tempo,
      catatan: body.catatan,
    });

    return NextResponse.json({
      success: true,
      penghuni_publik: res.penghuni_publik,
      message: `Penghuni ${nama} berhasil disimpan pada Kontrakan #${res.nomor_unit}.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal menyimpan penghuni.' }, { status: 422 });
  }
}
