import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth';
import { getCurrentPeriod } from '@/lib/helpers';
import { createUnit, deleteUnit, getAdminUnits, updateUnit } from '@/lib/store';

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
    const periode = /^\d{4}-\d{2}$/.test(rawPeriode) ? rawPeriode : getCurrentPeriod();
    const data = await getAdminUnits(periode);
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
    const result = await createUnit(body);
    return NextResponse.json(
      {
        success: true,
        id: result.id,
        message: `Kontrakan #${result.nomor_unit} berhasil ditambahkan dan langsung muncul di tampilan 3D!`,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal menambah unit.' }, { status: 422 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const id = Number(body.id || 0);
    if (id <= 0) {
      return NextResponse.json({ success: false, message: 'ID unit tidak valid.' }, { status: 422 });
    }
    const nama = await updateUnit({ ...body, id });
    return NextResponse.json({ success: true, message: `Data ${nama} berhasil diperbarui.` });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal memperbarui unit.' }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = Number(req.nextUrl.searchParams.get('id') || 0);
    if (id <= 0) {
      return NextResponse.json({ success: false, message: 'ID unit tidak valid.' }, { status: 422 });
    }
    await deleteUnit(id);
    return NextResponse.json({ success: true, message: 'Unit kontrakan berhasil dihapus.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Gagal menghapus unit.' }, { status: 422 });
  }
}
