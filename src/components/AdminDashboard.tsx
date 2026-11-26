'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Building2,
  Calendar,
  CalendarCheck2,
  Clock,
  Coins,
  Database,
  EyeOff,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserPen,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatBlockLabel, formatRupiah, formatWaNumber, getCurrentPeriod, getTodayISO } from '@/lib/helpers';
import type {
  AdminPaymentRow,
  AdminTenantRow,
  AdminUnitRow,
  AdminUser,
  PaymentStatus,
  PaymentSummary,
  StorageMode,
  UnitStatus,
} from '@/lib/types';

type TabKey = 'overview' | 'units' | 'tenants' | 'payments';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const TAB_META: Record<TabKey, [string, string]> = {
  overview: ['Ringkasan Kontrakan', 'Pantau status kontrakan, penghuni, dan pembayaran secara real-time'],
  units: ['Kontrakan & Harga', 'Tambah kontrakan baru, ubah harga per nomor, dan atur posisi bangunan 3D'],
  tenants: ['Data Penghuni', 'Nama lengkap hanya di Admin • Halaman 3D publik otomatis nama depan + inisial'],
  payments: ['Jadwal Pembayaran', 'Atur jadwal jatuh tempo bulanan, konfirmasi lunas, dan kirim pengingat WhatsApp'],
};

export default function AdminDashboard({ admin }: { admin: AdminUser }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [periode, setPeriode] = useState<string>(getCurrentPeriod());
  const [tenantFilter, setTenantFilter] = useState<string>('aktif');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const [storageMode, setStorageMode] = useState<StorageMode>('demo');
  const [units, setUnits] = useState<AdminUnitRow[]>([]);
  const [tenants, setTenants] = useState<AdminTenantRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    total_tagihan: 0,
    total_lunas: 0,
    total_belum: 0,
    count_lunas: 0,
    count_belum: 0,
    count_telat: 0,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Unit Modal State
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({
    id: 0,
    nomor_unit: 10,
    nama_unit: '',
    harga_bulanan: 850000,
    layout_pos: 'memanjang_4:1',
    ukuran: '3.5 x 7 m',
    warna_aksen: '#2563eb',
    status: 'kosong' as UnitStatus,
    fasilitas: 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik',
    deskripsi: 'Unit kontrakan baru nyaman dan siap huni.',
    sync_unpaid_price: true,
  });

  // Tenant Modal State
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    unit_id: 0,
    nama_penghuni: '',
    no_hp: '',
    tanggal_jatuh_tempo: 5,
    tanggal_masuk: getTodayISO(),
    catatan: '',
  });

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    id: 0,
    label: '',
    periode_bulan: '',
    jatuh_tempo: getTodayISO(),
    nominal: 850000,
    sync_tenant_due_day: false,
    status: 'belum_bayar' as PaymentStatus,
    metode_bayar: 'Tunai',
    tanggal_bayar: getTodayISO(),
    catatan: '',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const apiCall = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        cache: 'no-store',
        ...options,
      });
      if (res.status === 401) {
        router.push('/admin/login');
        throw new Error('Sesi berakhir, silakan login ulang.');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Permintaan gagal diproses.');
      }
      return data;
    },
    [router]
  );

  const loadAllData = useCallback(async () => {
    try {
      const [unitsRes, tenantsRes, paymentsRes] = await Promise.all([
        apiCall(`/api/units?periode=${encodeURIComponent(periode)}`),
        apiCall(`/api/tenants?status=${encodeURIComponent(tenantFilter)}`),
        apiCall(`/api/payments?periode=${encodeURIComponent(periode)}&status=${encodeURIComponent(paymentFilter)}`),
      ]);
      setStorageMode(unitsRes.storageMode || 'demo');
      setUnits(unitsRes.units || []);
      setTenants(tenantsRes.tenants || []);
      setPayments(paymentsRes.payments || []);
      setPaymentSummary(
        paymentsRes.summary || {
          total_tagihan: 0,
          total_lunas: 0,
          total_belum: 0,
          count_lunas: 0,
          count_belum: 0,
          count_telat: 0,
        }
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat data.', 'error');
    }
  }, [apiCall, paymentFilter, periode, showToast, tenantFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Modal Openers
  const openAddUnitModal = () => {
    const maxNum = units.reduce((m, u) => Math.max(m, u.nomor_unit), 0);
    setUnitForm({
      id: 0,
      nomor_unit: maxNum + 1,
      nama_unit: `Kontrakan ${String(maxNum + 1).padStart(2, '0')}`,
      harga_bulanan: 850000,
      layout_pos: 'memanjang_4:1',
      ukuran: '3.5 x 7 m',
      warna_aksen: '#2563eb',
      status: 'kosong',
      fasilitas: 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik',
      deskripsi: 'Unit kontrakan baru nyaman dan siap huni.',
      sync_unpaid_price: true,
    });
    setUnitModalOpen(true);
  };

  const openEditUnitModal = (u: AdminUnitRow) => {
    setUnitForm({
      id: u.id,
      nomor_unit: u.nomor_unit,
      nama_unit: u.nama_unit,
      harga_bulanan: u.harga_bulanan,
      layout_pos: `${u.blok}:${u.lantai}`,
      ukuran: u.ukuran || '3.5 x 7 m',
      warna_aksen: u.warna_aksen || '#2563eb',
      status: u.status,
      fasilitas: u.fasilitas || '',
      deskripsi: u.deskripsi || '',
      sync_unpaid_price: true,
    });
    setUnitModalOpen(true);
  };

  const fillTenantFromUnit = (u: AdminUnitRow | undefined) => {
    if (!u) return;
    setTenantForm({
      unit_id: u.id,
      nama_penghuni: u.nama_penghuni || '',
      no_hp: u.no_hp || '',
      tanggal_jatuh_tempo: u.tanggal_jatuh_tempo || 5,
      tanggal_masuk: u.tanggal_masuk || getTodayISO(),
      catatan: u.tenant_catatan || '',
    });
  };

  const openTenantModal = (unitId?: number) => {
    const target = unitId ? units.find((u) => u.id === unitId) : units.find((u) => u.status === 'kosong') || units[0];
    fillTenantFromUnit(target);
    setTenantModalOpen(true);
  };

  const openPaymentModal = (p: AdminPaymentRow) => {
    setPaymentForm({
      id: p.id,
      label: `Kontrakan #${String(p.nomor_unit).padStart(2, '0')} — ${p.nama_penghuni}`,
      periode_bulan: p.periode_bulan,
      jatuh_tempo: p.jatuh_tempo,
      nominal: p.nominal,
      sync_tenant_due_day: false,
      status: p.status,
      metode_bayar: p.metode_bayar || 'Tunai',
      tanggal_bayar: p.tanggal_bayar || getTodayISO(),
      catatan: p.catatan || '',
    });
    setPaymentModalOpen(true);
  };

  // Actions
  const handleSaveUnit = async (e: FormEvent) => {
    e.preventDefault();
    const [blok, lantaiStr] = unitForm.layout_pos.split(':');
    try {
      const res = await apiCall('/api/units', {
        method: unitForm.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          id: unitForm.id || undefined,
          nomor_unit: Number(unitForm.nomor_unit),
          nama_unit: unitForm.nama_unit.trim(),
          harga_bulanan: Number(unitForm.harga_bulanan),
          blok,
          lantai: Number(lantaiStr),
          ukuran: unitForm.ukuran.trim(),
          warna_aksen: unitForm.warna_aksen,
          status: unitForm.status,
          fasilitas: unitForm.fasilitas.trim(),
          deskripsi: unitForm.deskripsi.trim(),
          sync_unpaid_price: unitForm.sync_unpaid_price,
        }),
      });
      setUnitModalOpen(false);
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan unit.', 'error');
    }
  };

  const handleDeleteUnit = async (u: AdminUnitRow) => {
    if (!confirm(`Hapus ${u.nama_unit}? Data penghuni & riwayat pembayarannya juga akan terhapus.`)) return;
    try {
      const res = await apiCall(`/api/units?id=${u.id}`, { method: 'DELETE' });
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus unit.', 'error');
    }
  };

  const handleSaveTenant = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiCall('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({ action: 'assign', ...tenantForm }),
      });
      setTenantModalOpen(false);
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan penghuni.', 'error');
    }
  };

  const handleCheckoutTenant = async (unitId: number, name: string) => {
    if (!confirm(`Checkout penghuni "${name}" dan ubah status kontrakan menjadi Kosong?`)) return;
    try {
      const res = await apiCall('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({ action: 'checkout', unit_id: unitId }),
      });
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal checkout penghuni.', 'error');
    }
  };

  const handleQuickPay = async (payId: number) => {
    try {
      const res = await apiCall('/api/payments', {
        method: 'PUT',
        body: JSON.stringify({
          id: payId,
          status: 'lunas',
          tanggal_bayar: getTodayISO(),
          metode_bayar: 'Tunai',
        }),
      });
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui pembayaran.', 'error');
    }
  };

  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiCall('/api/payments', {
        method: 'PUT',
        body: JSON.stringify({
          id: paymentForm.id,
          jatuh_tempo: paymentForm.jatuh_tempo,
          nominal: Number(paymentForm.nominal),
          sync_tenant_due_day: paymentForm.sync_tenant_due_day,
          status: paymentForm.status,
          metode_bayar: paymentForm.metode_bayar,
          tanggal_bayar: paymentForm.tanggal_bayar,
          catatan: paymentForm.catatan,
        }),
      });
      setPaymentModalOpen(false);
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui jadwal.', 'error');
    }
  };

  const handleGeneratePayments = async () => {
    try {
      const res = await apiCall('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', periode_bulan: periode }),
      });
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal generate tagihan.', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
    router.refresh();
  };

  const terisiCount = units.filter((u) => u.status === 'terisi').length;
  const kosongCount = units.filter((u) => u.status === 'kosong').length;
  const potensiBulanan = units.reduce((acc, u) => acc + u.harga_bulanan, 0);
  const pendingPayments = payments.filter((p) => p.status !== 'lunas');
  const [pageTitle, pageSub] = TAB_META[tab];

  const renderStatusPill = (status: UnitStatus) => {
    if (status === 'kosong') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Kosong</span>;
    }
    if (status === 'maintenance') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Perbaikan</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">Terisi</span>;
  };

  const renderPayBadge = (status: PaymentStatus) => {
    if (status === 'lunas') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Lunas</span>;
    }
    if (status === 'telat') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">Telat</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Belum Bayar</span>;
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-[100dvh] flex">
      {/* Backdrop for Mobile/Tablet Slide-Over Sidebar */}
      {mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] lg:hidden" />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 lg:h-[100dvh] inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-900 border-r border-white/10 flex flex-col transition-transform duration-200 ease-out shrink-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white leading-tight">Kontrakan Teh Amoy</div>
              <div className="text-[11px] text-sky-400 font-medium">Admin Management</div>
            </div>
          </div>
          <button type="button" onClick={() => setMobileNavOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {(
            [
              ['overview', 'Ringkasan', LayoutDashboard],
              ['units', 'Kontrakan & Harga', Building2],
              ['tenants', 'Data Penghuni', Users],
              ['payments', 'Jadwal Pembayaran', CalendarCheck2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold border transition ${
                tab === key
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2.5 safe-bottom">
          {/* Storage Mode Badge */}
          <div
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold border flex items-center gap-2 ${
              storageMode === 'postgres'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {storageMode === 'postgres' ? 'PostgreSQL Terhubung' : 'Mode Demo (Belum konek DB)'}
            </span>
          </div>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition"
          >
            <Box className="w-4 h-4" />
            <span>Buka Tampilan 3D User</span>
          </Link>

          <div className="flex items-center justify-between px-2 pt-1">
            <div className="text-xs min-w-0">
              <div className="font-bold text-white truncate max-w-[155px]">{admin.nama_lengkap}</div>
              <div className="text-[11px] text-slate-400">Administrator</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="p-2.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-slate-950/88 backdrop-blur-md border-b border-white/10 px-3.5 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Menu"
                className="lg:hidden w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center shrink-0 transition"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-extrabold text-white truncate">{pageTitle}</h1>
                <p className="hidden sm:block text-xs text-slate-400 truncate">{pageSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-white/10 rounded-xl px-2.5 sm:px-3 py-2">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <input
                  type="month"
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none w-[112px] sm:w-auto"
                />
              </div>
              <button
                type="button"
                onClick={openAddUnitModal}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">Tambah Kontrakan</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-5 sm:space-y-6">
          {storageMode === 'demo' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Mode Demo Aktif:</strong> Variabel <code className="text-white">DATABASE_URL</code> belum dipasang.
                Tambahkan <strong>Neon Postgres</strong> di menu <em>Vercel Storage</em> agar semua perubahan tersimpan permanen!
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <section className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Total Unit</span>
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                      <Home className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-white mt-2.5 sm:mt-3">{units.length} Unit</div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                    {terisiCount} terisi • {kosongCount} kosong
                  </div>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Lunas Bulan Ini</span>
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-emerald-400 mt-2.5 sm:mt-3 truncate">
                    {formatRupiah(paymentSummary.total_lunas)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">{paymentSummary.count_lunas} unit lunas</div>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Belum / Telat</span>
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-amber-400 mt-2.5 sm:mt-3 truncate">
                    {formatRupiah(paymentSummary.total_belum)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                    {paymentSummary.count_belum} belum • {paymentSummary.count_telat} telat
                  </div>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Potensi / Bln</span>
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-white mt-2.5 sm:mt-3 truncate">{formatRupiah(potensiBulanan)}</div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">Jika semua terisi</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
                <div className="xl:col-span-7 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-white text-sm">Tagihan Perlu Perhatian</h2>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Belum bayar atau lewat jatuh tempo</p>
                    </div>
                    <button type="button" onClick={() => setTab('payments')} className="text-xs font-semibold text-sky-400 hover:text-sky-300 shrink-0">
                      Lihat Semua →
                    </button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {pendingPayments.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Semua tagihan periode {periode} sudah lunas atau belum digenerate.
                      </div>
                    ) : (
                      pendingPayments.map((p) => {
                        const isLate = p.status === 'telat';
                        return (
                          <div key={p.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02]">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                                  isLate ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                #{String(p.nomor_unit).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">{p.nama_penghuni}</div>
                                <div className="text-[11px] sm:text-xs text-slate-400 truncate">
                                  Tempo: <span className={isLate ? 'text-rose-400 font-semibold' : 'text-slate-300'}>{p.jatuh_tempo}</span> •{' '}
                                  {formatRupiah(p.nominal)}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickPay(p.id)}
                              className="px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold shrink-0 transition"
                            >
                              Lunas
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-white/10">
                    <h2 className="font-bold text-white text-sm">Peta Cepat Unit Kontrakan</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Ketuk unit untuk ubah harga atau detail</p>
                  </div>
                  <div className="p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {units.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => openEditUnitModal(u)}
                        className={`p-3 rounded-xl border text-left transition ${
                          u.status === 'kosong'
                            ? 'bg-emerald-500/15 border-emerald-500/35 hover:border-emerald-400'
                            : u.status === 'maintenance'
                            ? 'bg-amber-500/15 border-amber-500/35 hover:border-amber-400'
                            : 'bg-sky-500/15 border-sky-500/35 hover:border-sky-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-sm text-white">#{String(u.nomor_unit).padStart(2, '0')}</span>
                          <span
                            className={`text-[10px] font-semibold uppercase ${
                              u.status === 'kosong' ? 'text-emerald-300' : u.status === 'maintenance' ? 'text-amber-300' : 'text-sky-300'
                            }`}
                          >
                            {u.status === 'kosong' ? 'Kosong' : u.status === 'maintenance' ? 'Renov' : 'Terisi'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-200 truncate mt-1">{u.nama_penghuni || 'Tersedia'}</div>
                        <div className="text-[11px] font-bold text-slate-300 mt-0.5 truncate">{formatRupiah(u.harga_bulanan)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: KONTRAKAN & HARGA */}
          {tab === 'units' && (
            <section className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white text-base">Manajemen Unit & Harga Sewa</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Perubahan harga, blok 3D, dan penambahan kontrakan baru langsung aktif di tampilan 3D.</p>
                </div>
                <button
                  type="button"
                  onClick={openAddUnitModal}
                  className="w-full sm:w-auto justify-center bg-sky-500 hover:bg-sky-400 text-white px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kontrakan Baru</span>
                </button>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-3.5 space-y-3">
                {units.map((u) => (
                  <div key={u.id} className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0"
                          style={{ backgroundColor: u.warna_aksen || '#2563eb' }}
                        >
                          #{String(u.nomor_unit).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-sm truncate">{u.nama_unit}</div>
                          <div className="text-[11px] text-slate-400 truncate">{formatBlockLabel(u.blok, u.lantai)}</div>
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatusPill(u.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Harga / Bulan</div>
                        <div className="font-extrabold text-sky-300 text-sm mt-0.5">{formatRupiah(u.harga_bulanan)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Penghuni</div>
                        <div className="font-semibold text-white truncate mt-0.5">{u.nama_penghuni || 'Kosong'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditUnitModal(u)}
                        className="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit/Harga</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openTenantModal(u.id)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <UserPen className="w-3.5 h-3.5" />
                        <span>Penghuni</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u)}
                        aria-label="Hapus Unit"
                        className="w-10 h-10 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white flex items-center justify-center shrink-0 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet & Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-5 py-3.5">No. & Nama Unit</th>
                      <th className="px-4 py-3.5">Posisi 3D</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Penghuni</th>
                      <th className="px-4 py-3.5">Harga / Bulan</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {units.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shrink-0"
                              style={{ backgroundColor: u.warna_aksen || '#2563eb' }}
                            >
                              #{String(u.nomor_unit).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="font-bold text-white text-sm">{u.nama_unit}</div>
                              <div className="text-[11px] text-slate-400">{u.ukuran}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-300">{formatBlockLabel(u.blok, u.lantai)}</td>
                        <td className="px-4 py-3.5">{renderStatusPill(u.status)}</td>
                        <td className="px-4 py-3.5">
                          {u.nama_penghuni ? (
                            <>
                              <div className="font-semibold text-white text-xs">{u.nama_penghuni}</div>
                              <div className="text-[11px] text-slate-400">
                                Publik: {u.penghuni_publik} • Tempo tgl {u.tanggal_jatuh_tempo}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Belum ditempati</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-extrabold text-sky-300 text-sm">{formatRupiah(u.harga_bulanan)}</td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditUnitModal(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition"
                          >
                            Edit/Harga
                          </button>
                          <button
                            type="button"
                            onClick={() => openTenantModal(u.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-semibold transition"
                          >
                            Penghuni
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(u)}
                            title="Hapus Unit"
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold transition"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 3: DATA PENGHUNI */}
          {tab === 'tenants' && (
            <section className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white text-base">Daftar Penghuni Kontrakan</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Nama lengkap hanya di Admin. Tampilan publik 3D memakai nama depan + inisial.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={tenantFilter}
                    onChange={(e) => setTenantFilter(e.target.value)}
                    className="flex-1 sm:flex-none bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 sm:py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="aktif">Penghuni Aktif</option>
                    <option value="keluar">Riwayat Keluar</option>
                    <option value="all">Semua</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => openTenantModal()}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-3.5 space-y-3">
                {tenants.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">Belum ada data penghuni untuk filter ini.</div>
                ) : (
                  tenants.map((t) => {
                    const wa = formatWaNumber(t.no_hp);
                    return (
                      <div key={t.id} className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-extrabold">
                                #{String(t.nomor_unit).padStart(2, '0')}
                              </span>
                              <span className="font-bold text-white text-sm truncate">{t.nama_penghuni}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Tampilan Publik 3D: <span className="text-sky-200 font-semibold">{t.penghuni_publik || '-'}</span>
                            </div>
                          </div>
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                          <div>
                            <div className="text-[10px] text-slate-400">Masuk</div>
                            <div className="text-slate-200 font-medium">{t.tanggal_masuk}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Jatuh Tempo</div>
                            <div className="text-amber-300 font-bold">Tiap tgl {t.tanggal_jatuh_tempo}</div>
                          </div>
                        </div>

                        {t.status === 'aktif' ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openTenantModal(t.unit_id)}
                              className="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition"
                            >
                              Edit Penghuni
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCheckoutTenant(t.unit_id, t.nama_penghuni)}
                              className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold transition"
                            >
                              Checkout
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">Status: Keluar ({t.tanggal_keluar || '-'})</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tablet & Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-5 py-3.5">Kontrakan</th>
                      <th className="px-4 py-3.5">Nama Lengkap (Admin)</th>
                      <th className="px-4 py-3.5">Tampilan Publik 3D</th>
                      <th className="px-4 py-3.5">No. HP / WA</th>
                      <th className="px-4 py-3.5">Masuk & Jatuh Tempo</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {tenants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400">
                          Belum ada data penghuni untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      tenants.map((t) => {
                        const wa = formatWaNumber(t.no_hp);
                        return (
                          <tr key={t.id} className="hover:bg-white/[0.02]">
                            <td className="px-5 py-3.5">
                              <span className="font-extrabold text-sky-300">#{String(t.nomor_unit).padStart(2, '0')}</span>
                              <span className="text-xs text-slate-300 ml-1.5">{t.nama_unit}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-white text-sm">{t.nama_penghuni}</div>
                              <div className="text-[11px] text-slate-400">{t.catatan || '-'}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-sky-200 font-semibold">
                                <EyeOff className="w-3 h-3 text-slate-400" />
                                {t.penghuni_publik || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              {wa ? (
                                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 font-semibold">
                                  {t.no_hp}
                                </a>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-300">
                              <div>Masuk: {t.tanggal_masuk}</div>
                              <div className="text-amber-300 font-semibold">Jatuh tempo tiap tgl {t.tanggal_jatuh_tempo}</div>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                              {t.status === 'aktif' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openTenantModal(t.unit_id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCheckoutTenant(t.unit_id, t.nama_penghuni)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold transition"
                                  >
                                    Checkout
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-500">Keluar {t.tanggal_keluar || ''}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 4: JADWAL PEMBAYARAN */}
          {tab === 'payments' && (
            <section className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white text-base">Jadwal & Status Pembayaran</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Kelola jatuh tempo tiap nomor kontrakan, tandai lunas, dan kirim pengingat WhatsApp.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="flex-1 sm:flex-none bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 sm:py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all">Semua Status</option>
                    <option value="telat">Telat</option>
                    <option value="belum_bayar">Belum Bayar</option>
                    <option value="lunas">Lunas</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleGeneratePayments}
                    className="bg-sky-500 hover:bg-sky-400 text-white px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate</span>
                  </button>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-3.5 space-y-3">
                {payments.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-slate-400">
                    Belum ada jadwal pembayaran periode {periode}. Ketuk tombol <strong>Generate</strong> di atas.
                  </div>
                ) : (
                  payments.map((p) => {
                    const wa = formatWaNumber(p.no_hp);
                    const waText = encodeURIComponent(
                      `Halo Kak ${p.nama_penghuni}, izin mengingatkan jadwal pembayaran sewa Kontrakan Teh Amoy Unit #${String(p.nomor_unit).padStart(
                        2,
                        '0'
                      )} periode ${p.periode_bulan} sebesar ${formatRupiah(p.nominal)} dengan jatuh tempo ${p.jatuh_tempo}. Terima kasih.`
                    );
                    return (
                      <div key={p.id} className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm truncate">
                              #{String(p.nomor_unit).padStart(2, '0')} • {p.nama_penghuni}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Periode {p.periode_bulan}</div>
                          </div>
                          <div className="shrink-0">{renderPayBadge(p.status)}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                          <div>
                            <div className="text-[10px] text-slate-400">Nominal</div>
                            <div className="font-extrabold text-sky-300 text-sm">{formatRupiah(p.nominal)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Jatuh Tempo</div>
                            <div className={`font-bold ${p.status === 'telat' ? 'text-rose-400' : 'text-slate-200'}`}>{p.jatuh_tempo}</div>
                          </div>
                        </div>

                        {p.tanggal_bayar && (
                          <div className="text-[11px] text-emerald-300/90">
                            Dibayar {p.tanggal_bayar} ({p.metode_bayar || 'Tunai'})
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {p.status !== 'lunas' && (
                            <button
                              type="button"
                              onClick={() => handleQuickPay(p.id)}
                              className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition"
                            >
                              Tandai Lunas
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openPaymentModal(p)}
                            className="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition"
                          >
                            Atur Jadwal
                          </button>
                          {wa && p.status !== 'lunas' && (
                            <a
                              href={`https://wa.me/${wa}?text=${waText}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Pengingat WA"
                              className="w-10 h-10 rounded-xl bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-white flex items-center justify-center shrink-0 transition"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tablet & Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-5 py-3.5">Unit & Penghuni</th>
                      <th className="px-4 py-3.5">Periode</th>
                      <th className="px-4 py-3.5">Jatuh Tempo</th>
                      <th className="px-4 py-3.5">Nominal</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Tgl Bayar</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-400">
                          Belum ada jadwal pembayaran untuk periode {periode}. Klik tombol <strong>Generate</strong> di atas.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => {
                        const wa = formatWaNumber(p.no_hp);
                        const waText = encodeURIComponent(
                          `Halo Kak ${p.nama_penghuni}, izin mengingatkan jadwal pembayaran sewa Kontrakan Teh Amoy Unit #${String(p.nomor_unit).padStart(
                            2,
                            '0'
                          )} periode ${p.periode_bulan} sebesar ${formatRupiah(p.nominal)} dengan jatuh tempo ${p.jatuh_tempo}. Terima kasih.`
                        );
                        return (
                          <tr key={p.id} className="hover:bg-white/[0.02]">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-white text-sm">
                                #{String(p.nomor_unit).padStart(2, '0')} • {p.nama_penghuni}
                              </div>
                              <div className="text-[11px] text-slate-400">{p.catatan || p.nama_unit}</div>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-300">{p.periode_bulan}</td>
                            <td className={`px-4 py-3.5 text-xs font-semibold ${p.status === 'telat' ? 'text-rose-400' : 'text-slate-200'}`}>
                              {p.jatuh_tempo}
                            </td>
                            <td className="px-4 py-3.5 font-extrabold text-sky-300 text-sm">{formatRupiah(p.nominal)}</td>
                            <td className="px-4 py-3.5">{renderPayBadge(p.status)}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-300">
                              {p.tanggal_bayar ? (
                                <>
                                  <div>{p.tanggal_bayar}</div>
                                  <div className="text-[10px] text-slate-400">{p.metode_bayar || ''}</div>
                                </>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1">
                              {p.status !== 'lunas' && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPay(p.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition"
                                >
                                  Lunas
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openPaymentModal(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition"
                              >
                                Atur
                              </button>
                              {wa && p.status !== 'lunas' && (
                                <a
                                  href={`https://wa.me/${wa}?text=${waText}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Kirim Pengingat WA"
                                  className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-white text-xs font-semibold transition"
                                >
                                  WA
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Mobile & Tablet Bottom Tab Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 safe-bottom-bar">
        <div className="grid grid-cols-4 gap-1 max-w-lg mx-auto">
          {(
            [
              ['overview', 'Ringkasan', LayoutDashboard],
              ['units', 'Unit', Building2],
              ['tenants', 'Penghuni', Users],
              ['payments', 'Bayar', CalendarCheck2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
                tab === key ? 'text-sky-400 bg-sky-500/15' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold mt-1">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* MODAL: TAMBAH / EDIT UNIT */}
      {unitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="sm:hidden flex justify-center pt-2.5">
              <span className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {unitForm.id ? `Edit Kontrakan #${String(unitForm.nomor_unit).padStart(2, '0')}` : 'Tambah Kontrakan Baru'}
              </h3>
              <button type="button" onClick={() => setUnitModalOpen(false)} className="text-slate-400 hover:text-white p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUnit} className="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nomor Kontrakan *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={unitForm.nomor_unit}
                    onChange={(e) => setUnitForm((f) => ({ ...f, nomor_unit: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Harga Sewa / Bulan (Rp) *</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={unitForm.harga_bulanan}
                    onChange={(e) => setUnitForm((f) => ({ ...f, harga_bulanan: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Unit</label>
                <input
                  type="text"
                  value={unitForm.nama_unit}
                  onChange={(e) => setUnitForm((f) => ({ ...f, nama_unit: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Posisi Bangunan 3D</label>
                  <select
                    value={unitForm.layout_pos}
                    onChange={(e) => setUnitForm((f) => ({ ...f, layout_pos: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="bertingkat:1">Blok Bertingkat — Paling Kiri (Lt. 1 / Bawah)</option>
                    <option value="bertingkat:2">Blok Bertingkat — Paling Kiri (Lt. 2 / Atas)</option>
                    <option value="memanjang_4:1">Blok 4 Memanjang — Kanan Bertingkat (Lt. 1)</option>
                    <option value="memanjang_2:1">Blok 2 Terpisah — Belakang Rumah Pemilik (Lt. 1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ukuran & Warna Aksen 3D</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={unitForm.ukuran}
                      onChange={(e) => setUnitForm((f) => ({ ...f, ukuran: e.target.value }))}
                      className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                    />
                    <input
                      type="color"
                      value={unitForm.warna_aksen}
                      onChange={(e) => setUnitForm((f) => ({ ...f, warna_aksen: e.target.value }))}
                      className="w-11 h-10 bg-slate-950 border border-white/15 rounded-xl p-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status Unit</label>
                <select
                  value={unitForm.status}
                  onChange={(e) => setUnitForm((f) => ({ ...f, status: e.target.value as UnitStatus }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="kosong">Kosong (Tersedia)</option>
                  <option value="terisi">Terisi</option>
                  <option value="maintenance">Sedang Perbaikan (Maintenance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fasilitas (pisahkan koma)</label>
                <input
                  type="text"
                  value={unitForm.fasilitas}
                  onChange={(e) => setUnitForm((f) => ({ ...f, fasilitas: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={unitForm.deskripsi}
                  onChange={(e) => setUnitForm((f) => ({ ...f, deskripsi: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              {unitForm.id > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unitForm.sync_unpaid_price}
                    onChange={(e) => setUnitForm((f) => ({ ...f, sync_unpaid_price: e.target.checked }))}
                    className="rounded bg-slate-950 border-white/20 text-sky-500"
                  />
                  <span>Ikut perbarui nominal tagihan bulan ini yang belum lunas</span>
                </label>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setUnitModalOpen(false)} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">
                  Batal
                </button>
                <button type="submit" className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white shadow-lg shadow-sky-500/20">
                  Simpan Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PENGHUNI */}
      {tenantModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="sm:hidden flex justify-center pt-2.5">
              <span className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Atur Penghuni Kontrakan</h3>
              <button type="button" onClick={() => setTenantModalOpen(false)} className="text-slate-400 hover:text-white p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTenant} className="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Nomor Kontrakan *</label>
                <select
                  value={tenantForm.unit_id}
                  onChange={(e) => fillTenantFromUnit(units.find((u) => u.id === Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      #{String(u.nomor_unit).padStart(2, '0')} — {u.nama_unit} ({u.nama_penghuni ? `Diisi: ${u.nama_penghuni}` : 'Kosong'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap Penghuni *</label>
                <input
                  type="text"
                  required
                  value={tenantForm.nama_penghuni}
                  onChange={(e) => setTenantForm((f) => ({ ...f, nama_penghuni: e.target.value }))}
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">Di halaman publik 3D otomatis menjadi nama depan + inisial.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">No. HP / WhatsApp</label>
                  <input
                    type="tel"
                    value={tenantForm.no_hp}
                    onChange={(e) => setTenantForm((f) => ({ ...f, no_hp: e.target.value }))}
                    placeholder="0812xxxxxxxx"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tgl Jatuh Tempo (1-28) *</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    required
                    value={tenantForm.tanggal_jatuh_tempo}
                    onChange={(e) => setTenantForm((f) => ({ ...f, tanggal_jatuh_tempo: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal Masuk</label>
                <input
                  type="date"
                  value={tenantForm.tanggal_masuk}
                  onChange={(e) => setTenantForm((f) => ({ ...f, tanggal_masuk: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan</label>
                <input
                  type="text"
                  value={tenantForm.catatan}
                  onChange={(e) => setTenantForm((f) => ({ ...f, catatan: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setTenantModalOpen(false)} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">
                  Batal
                </button>
                <button type="submit" className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white shadow-lg shadow-emerald-500/20">
                  Simpan Penghuni
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: JADWAL & PEMBAYARAN */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="sm:hidden flex justify-center pt-2.5">
              <span className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Atur Jadwal & Pembayaran</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div className="font-bold text-white">{paymentForm.label}</div>
                <div className="text-slate-400 mt-0.5">Periode: {paymentForm.periode_bulan}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal Jatuh Tempo *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.jatuh_tempo}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, jatuh_tempo: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nominal (Rp) *</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={paymentForm.nominal}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, nominal: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentForm.sync_tenant_due_day}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, sync_tenant_due_day: e.target.checked }))}
                  className="rounded bg-slate-950 border-white/20 text-sky-500"
                />
                <span>Jadikan tanggal ini jadwal jatuh tempo rutin tiap bulan</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status Pembayaran</label>
                  <select
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, status: e.target.value as PaymentStatus }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="belum_bayar">Belum Bayar</option>
                    <option value="lunas">Lunas</option>
                    <option value="telat">Telat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Metode Pembayaran</label>
                  <select
                    value={paymentForm.metode_bayar}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, metode_bayar: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer BCA">Transfer BCA</option>
                    <option value="Transfer BRI">Transfer BRI</option>
                    <option value="Transfer Mandiri">Transfer Mandiri</option>
                    <option value="QRIS / E-Wallet">QRIS / E-Wallet</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal Bayar (jika Lunas)</label>
                <input
                  type="date"
                  value={paymentForm.tanggal_bayar}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, tanggal_bayar: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan</label>
                <input
                  type="text"
                  value={paymentForm.catatan}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, catatan: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">
                  Batal
                </button>
                <button type="submit" className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold ${
              t.type === 'error' ? 'bg-rose-600 border-rose-400/50 text-white' : 'bg-slate-800 border-emerald-400/50 text-emerald-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
