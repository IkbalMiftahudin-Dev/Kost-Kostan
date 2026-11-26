import { Pool } from 'pg';
import { hashPassword, verifyPassword } from './auth';
import { buildDueDateForPeriod, getCurrentPeriod, getTodayISO, maskTenantName } from './helpers';
import type {
  AdminPaymentRow,
  AdminTenantRow,
  AdminUnitRow,
  AdminUser,
  PaymentStatus,
  PaymentSummary,
  PublicUnit,
  StorageMode,
  TenantStatus,
  UnitBlock,
  UnitStatus,
} from './types';

// ============================================================================
// SEED DATA AWAL (9 KONTRAKAN: 4 MEMANJANG + 2 TERPISAH + 1 BAWAH + 2 ATAS)
// ============================================================================
interface SeedUnit {
  nomor_unit: number;
  nama_unit: string;
  blok: UnitBlock;
  lantai: number;
  urutan: number;
  harga_bulanan: number;
  status: UnitStatus;
  ukuran: string;
  fasilitas: string;
  deskripsi: string;
  warna_aksen: string;
}

const DEFAULT_UNITS: SeedUnit[] = [
  { nomor_unit: 1, nama_unit: 'Kontrakan 01', blok: 'memanjang_4', lantai: 1, urutan: 1, harga_bulanan: 550000, status: 'terisi', ukuran: '3.5 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Pagar Depan, Token Listrik', deskripsi: 'Unit terdepan deret 4 melebar berpagar dengan fasilitas WiFi.', warna_aksen: '#2563eb' },
  { nomor_unit: 2, nama_unit: 'Kontrakan 02', blok: 'memanjang_4', lantai: 1, urutan: 2, harga_bulanan: 550000, status: 'terisi', ukuran: '3.5 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Pagar Depan, Token Listrik', deskripsi: 'Unit deret 4 melebar berpagar, sirkulasi udara lancar dan tersedia WiFi.', warna_aksen: '#0d9488' },
  { nomor_unit: 3, nama_unit: 'Kontrakan 03', blok: 'memanjang_4', lantai: 1, urutan: 3, harga_bulanan: 550000, status: 'kosong', ukuran: '3.5 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Pagar Depan, Token Listrik', deskripsi: 'Unit kosongan bersih siap huni di deret 4 melebar berpagar + Free WiFi.', warna_aksen: '#16a34a' },
  { nomor_unit: 4, nama_unit: 'Kontrakan 04', blok: 'memanjang_4', lantai: 1, urutan: 4, harga_bulanan: 550000, status: 'terisi', ukuran: '3.5 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Pagar Depan, Token Listrik', deskripsi: 'Unit pojok deret 4 melebar berpagar dengan privasi nyaman dan Free WiFi.', warna_aksen: '#d97706' },
  { nomor_unit: 5, nama_unit: 'Kontrakan 05', blok: 'memanjang_2', lantai: 1, urutan: 1, harga_bulanan: 550000, status: 'kosong', ukuran: '3.5 x 7 m', fasilitas: 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik', deskripsi: 'Unit kosongan di Blok 2 terpisah belakang rumah utama, suasana tenang.', warna_aksen: '#7c3aed' },
  { nomor_unit: 6, nama_unit: 'Kontrakan 06', blok: 'memanjang_2', lantai: 1, urutan: 2, harga_bulanan: 550000, status: 'terisi', ukuran: '3.5 x 7 m', fasilitas: 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik', deskripsi: 'Unit di Blok 2 terpisah belakang rumah utama, nyaman dan bebas bising.', warna_aksen: '#e11d48' },
  { nomor_unit: 7, nama_unit: 'Kontrakan 07 (Bawah)', blok: 'bertingkat', lantai: 1, urutan: 1, harga_bulanan: 550000, status: 'terisi', ukuran: '4 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Halaman Berpagar', deskripsi: 'Unit lantai bawah gedung bertingkat leter L, teduh sepanjang hari dan tersedia WiFi.', warna_aksen: '#0284c7' },
  { nomor_unit: 8, nama_unit: 'Kontrakan 08 (Atas)', blok: 'bertingkat', lantai: 2, urutan: 1, harga_bulanan: 550000, status: 'terisi', ukuran: '3.8 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Balkon Atas', deskripsi: 'Unit lantai 2 gedung bertingkat leter L di puncak tangga, sejuk dan tersedia WiFi.', warna_aksen: '#ea580c' },
  { nomor_unit: 9, nama_unit: 'Kontrakan 09 (Atas)', blok: 'bertingkat', lantai: 2, urutan: 2, harga_bulanan: 550000, status: 'kosong', ukuran: '3.8 x 7 m', fasilitas: 'Free WiFi, Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Balkon Leter L', deskripsi: 'Unit kosongan lantai 2 sayap depan leter L dengan balkon luas dan Free WiFi.', warna_aksen: '#4f46e5' },
];

const DEFAULT_TENANTS: Array<{
  nomor_unit: number;
  nama_penghuni: string;
  no_hp: string;
  tanggal_masuk: string;
  due_day: number;
  pay_status: PaymentStatus;
  metode: string | null;
}> = [
  { nomor_unit: 1, nama_penghuni: 'Ahmad Fauzi', no_hp: '081234567801', tanggal_masuk: '2025-03-05', due_day: 5, pay_status: 'lunas', metode: 'Transfer BCA' },
  { nomor_unit: 2, nama_penghuni: 'Siti Rahmawati', no_hp: '081234567802', tanggal_masuk: '2025-06-10', due_day: 10, pay_status: 'lunas', metode: 'Tunai' },
  { nomor_unit: 4, nama_penghuni: 'Budi Santoso', no_hp: '081234567804', tanggal_masuk: '2025-08-12', due_day: 12, pay_status: 'belum_bayar', metode: null },
  { nomor_unit: 6, nama_penghuni: 'Dewi Lestari', no_hp: '081234567806', tanggal_masuk: '2025-01-03', due_day: 3, pay_status: 'telat', metode: null },
  { nomor_unit: 7, nama_penghuni: 'Rizky Pratama', no_hp: '081234567807', tanggal_masuk: '2025-09-18', due_day: 18, pay_status: 'belum_bayar', metode: null },
  { nomor_unit: 8, nama_penghuni: 'Nadia Putri', no_hp: '081234567808', tanggal_masuk: '2025-05-07', due_day: 7, pay_status: 'lunas', metode: 'Transfer Mandiri' },
];

// ============================================================================
// POSTGRES POOL + IN-MEMORY DEMO FALLBACK
// ============================================================================
function getPostgresUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null;
}

export function getStorageMode(): StorageMode {
  return getPostgresUrl() ? 'postgres' : 'demo';
}

const globalRef = globalThis as unknown as {
  __ktaPool?: Pool;
  __ktaBootstrapped?: boolean;
  __ktaDemo?: DemoState;
};

interface DemoAdmin extends AdminUser {
  password_hash: string;
}
interface DemoUnit extends SeedUnit {
  id: number;
}
interface DemoTenant {
  id: number;
  unit_id: number;
  nama_penghuni: string;
  no_hp: string;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  tanggal_jatuh_tempo: number;
  status: TenantStatus;
  catatan: string;
}
interface DemoPayment {
  id: number;
  unit_id: number;
  tenant_id: number;
  periode_bulan: string;
  jatuh_tempo: string;
  nominal: number;
  tanggal_bayar: string | null;
  metode_bayar: string | null;
  status: PaymentStatus;
  catatan: string;
}
const DEMO_SEED_VERSION = 2;

interface DemoState {
  seedVersion: number;
  admins: DemoAdmin[];
  units: DemoUnit[];
  tenants: DemoTenant[];
  payments: DemoPayment[];
  nextUnitId: number;
  nextTenantId: number;
  nextPaymentId: number;
}

function getDemoState(): DemoState {
  if (globalRef.__ktaDemo && globalRef.__ktaDemo.seedVersion === DEMO_SEED_VERSION) {
    return globalRef.__ktaDemo;
  }

  const period = getCurrentPeriod();
  const units: DemoUnit[] = DEFAULT_UNITS.map((u, i) => ({ ...u, id: i + 1 }));
  const unitByNum = new Map(units.map((u) => [u.nomor_unit, u]));

  const tenants: DemoTenant[] = [];
  const payments: DemoPayment[] = [];
  let tId = 1;
  let pId = 1;

  for (const t of DEFAULT_TENANTS) {
    const unit = unitByNum.get(t.nomor_unit);
    if (!unit) continue;
    const tenant: DemoTenant = {
      id: tId++,
      unit_id: unit.id,
      nama_penghuni: t.nama_penghuni,
      no_hp: t.no_hp,
      tanggal_masuk: t.tanggal_masuk,
      tanggal_keluar: null,
      tanggal_jatuh_tempo: t.due_day,
      status: 'aktif',
      catatan: 'Penghuni awal terdaftar',
    };
    tenants.push(tenant);

    const dueDate = buildDueDateForPeriod(period, t.due_day);
    payments.push({
      id: pId++,
      unit_id: unit.id,
      tenant_id: tenant.id,
      periode_bulan: period,
      jatuh_tempo: dueDate,
      nominal: unit.harga_bulanan,
      tanggal_bayar: t.pay_status === 'lunas' ? dueDate : null,
      metode_bayar: t.metode,
      status: t.pay_status,
      catatan:
        t.pay_status === 'lunas'
          ? 'Pembayaran tepat waktu'
          : t.pay_status === 'telat'
          ? 'Mohon segera dikonfirmasi'
          : 'Jadwal tagihan bulan berjalan',
    });
  }

  globalRef.__ktaDemo = {
    seedVersion: DEMO_SEED_VERSION,
    admins: [
      {
        id: 1,
        username: 'admin',
        nama_lengkap: 'Teh Amoy (Admin)',
        password_hash: hashPassword('admin123'),
      },
    ],
    units,
    tenants,
    payments,
    nextUnitId: units.length + 1,
    nextTenantId: tId,
    nextPaymentId: pId,
  };

  return globalRef.__ktaDemo;
}

async function getPgPool(): Promise<Pool> {
  const url = getPostgresUrl();
  if (!url) {
    throw new Error('DATABASE_URL tidak ditemukan.');
  }
  if (!globalRef.__ktaPool) {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    globalRef.__ktaPool = new Pool({
      connectionString: url,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }

  if (!globalRef.__ktaBootstrapped) {
    await bootstrapPostgres(globalRef.__ktaPool);
    globalRef.__ktaBootstrapped = true;
  }

  return globalRef.__ktaPool;
}

async function bootstrapPostgres(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      nama_lengkap VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      nomor_unit INT NOT NULL UNIQUE,
      nama_unit VARCHAR(100) NOT NULL,
      blok VARCHAR(20) NOT NULL DEFAULT 'memanjang_4',
      lantai SMALLINT NOT NULL DEFAULT 1,
      urutan INT NOT NULL DEFAULT 1,
      harga_bulanan INT NOT NULL DEFAULT 550000,
      status VARCHAR(20) NOT NULL DEFAULT 'kosong',
      ukuran VARCHAR(50) NOT NULL DEFAULT '3.5 x 7 m',
      fasilitas TEXT DEFAULT '',
      deskripsi TEXT DEFAULT '',
      warna_aksen VARCHAR(20) NOT NULL DEFAULT '#2563eb',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      unit_id INT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      nama_penghuni VARCHAR(120) NOT NULL,
      no_hp VARCHAR(30) DEFAULT '',
      tanggal_masuk DATE NOT NULL,
      tanggal_keluar DATE NULL,
      tanggal_jatuh_tempo SMALLINT NOT NULL DEFAULT 5,
      status VARCHAR(20) NOT NULL DEFAULT 'aktif',
      catatan TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      unit_id INT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      periode_bulan CHAR(7) NOT NULL,
      jatuh_tempo DATE NOT NULL,
      nominal INT NOT NULL,
      tanggal_bayar DATE NULL,
      metode_bayar VARCHAR(50) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'belum_bayar',
      catatan TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (unit_id, tenant_id, periode_bulan)
    );
  `);

  const adminCheck = await pool.query('SELECT COUNT(*)::int AS cnt FROM admins');
  if (adminCheck.rows[0].cnt === 0) {
    await pool.query(
      'INSERT INTO admins (username, password_hash, nama_lengkap) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
      ['admin', hashPassword('admin123'), 'Teh Amoy (Admin)']
    );
  }

  const unitCheck = await pool.query('SELECT COUNT(*)::int AS cnt FROM units');
  if (unitCheck.rows[0].cnt === 0) {
    const idByNum = new Map<number, number>();
    const priceByNum = new Map<number, number>();

    for (const u of DEFAULT_UNITS) {
      const res = await pool.query(
        `INSERT INTO units (nomor_unit, nama_unit, blok, lantai, urutan, harga_bulanan, status, ukuran, fasilitas, deskripsi, warna_aksen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [u.nomor_unit, u.nama_unit, u.blok, u.lantai, u.urutan, u.harga_bulanan, u.status, u.ukuran, u.fasilitas, u.deskripsi, u.warna_aksen]
      );
      idByNum.set(u.nomor_unit, res.rows[0].id);
      priceByNum.set(u.nomor_unit, u.harga_bulanan);
    }

    const period = getCurrentPeriod();
    for (const t of DEFAULT_TENANTS) {
      const unitId = idByNum.get(t.nomor_unit);
      if (!unitId) continue;
      const tRes = await pool.query(
        `INSERT INTO tenants (unit_id, nama_penghuni, no_hp, tanggal_masuk, tanggal_jatuh_tempo, status, catatan)
         VALUES ($1,$2,$3,$4,$5,'aktif','Penghuni awal terdaftar') RETURNING id`,
        [unitId, t.nama_penghuni, t.no_hp, t.tanggal_masuk, t.due_day]
      );
      const tenantId = tRes.rows[0].id;
      const dueDate = buildDueDateForPeriod(period, t.due_day);
      const tglBayar = t.pay_status === 'lunas' ? dueDate : null;
      const catatan =
        t.pay_status === 'lunas'
          ? 'Pembayaran tepat waktu'
          : t.pay_status === 'telat'
          ? 'Mohon segera dikonfirmasi'
          : 'Jadwal tagihan bulan berjalan';

      await pool.query(
        `INSERT INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, tanggal_bayar, metode_bayar, status, catatan)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [unitId, tenantId, period, dueDate, priceByNum.get(t.nomor_unit) || 550000, tglBayar, t.metode, t.pay_status, catatan]
      );
    }
  }
}

function fmtDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

// ============================================================================
// REPOSITORY OPERATIONS (TRANSPARENT POSTGRES OR DEMO MODE)
// ============================================================================

export async function authenticateAdmin(username: string, password: string): Promise<AdminUser | null> {
  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const admin = demo.admins.find((a) => a.username === username);
    if (!admin || !verifyPassword(password, admin.password_hash)) return null;
    return { id: admin.id, username: admin.username, nama_lengkap: admin.nama_lengkap };
  }

  const pool = await getPgPool();
  const res = await pool.query('SELECT id, username, password_hash, nama_lengkap FROM admins WHERE username = $1 LIMIT 1', [username]);
  const row = res.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return { id: Number(row.id), username: row.username, nama_lengkap: row.nama_lengkap };
}

export async function getPublicUnits(): Promise<{
  storageMode: StorageMode;
  stats: { total: number; terisi: number; kosong: number; maintenance: number };
  units: PublicUnit[];
}> {
  const mode = getStorageMode();
  const stats = { total: 0, terisi: 0, kosong: 0, maintenance: 0 };

  if (mode === 'demo') {
    const demo = getDemoState();
    const units: PublicUnit[] = [...demo.units]
      .sort((a, b) => a.nomor_unit - b.nomor_unit)
      .map((u) => {
        stats.total++;
        stats[u.status]++;
        const activeTenant = demo.tenants.find((t) => t.unit_id === u.id && t.status === 'aktif');
        return {
          id: u.id,
          nomor_unit: u.nomor_unit,
          nama_unit: u.nama_unit,
          blok: u.blok,
          lantai: u.lantai,
          urutan: u.urutan,
          harga_bulanan: u.harga_bulanan,
          status: u.status,
          ukuran: u.ukuran,
          fasilitas: u.fasilitas.split(',').map((s) => s.trim()).filter(Boolean),
          deskripsi: u.deskripsi,
          warna_aksen: u.warna_aksen,
          penghuni_publik: u.status === 'terisi' ? maskTenantName(activeTenant?.nama_penghuni) : null,
        };
      });
    return { storageMode: mode, stats, units };
  }

  const pool = await getPgPool();
  const res = await pool.query(`
    SELECT u.*, t.nama_penghuni AS raw_tenant_name
    FROM units u
    LEFT JOIN tenants t ON t.unit_id = u.id AND t.status = 'aktif'
    ORDER BY u.nomor_unit ASC
  `);

  const units: PublicUnit[] = res.rows.map((r) => {
    const status = r.status as UnitStatus;
    stats.total++;
    if (status in stats) stats[status]++;
    return {
      id: Number(r.id),
      nomor_unit: Number(r.nomor_unit),
      nama_unit: r.nama_unit,
      blok: r.blok as UnitBlock,
      lantai: Number(r.lantai),
      urutan: Number(r.urutan),
      harga_bulanan: Number(r.harga_bulanan),
      status,
      ukuran: r.ukuran || '3.5 x 7 m',
      fasilitas: String(r.fasilitas || '').split(',').map((s) => s.trim()).filter(Boolean),
      deskripsi: r.deskripsi || '',
      warna_aksen: r.warna_aksen || '#2563eb',
      penghuni_publik: status === 'terisi' ? maskTenantName(r.raw_tenant_name) : null,
    };
  });

  return { storageMode: mode, stats, units };
}

export async function getAdminUnits(periode: string): Promise<{ storageMode: StorageMode; units: AdminUnitRow[] }> {
  const mode = getStorageMode();

  if (mode === 'demo') {
    const demo = getDemoState();
    const units: AdminUnitRow[] = [...demo.units]
      .sort((a, b) => a.nomor_unit - b.nomor_unit)
      .map((u) => {
        const t = demo.tenants.find((x) => x.unit_id === u.id && x.status === 'aktif') || null;
        const p = t ? demo.payments.find((x) => x.unit_id === u.id && x.tenant_id === t.id && x.periode_bulan === periode) || null : null;
        return {
          ...u,
          tenant_id: t?.id ?? null,
          nama_penghuni: t?.nama_penghuni ?? null,
          penghuni_publik: t ? maskTenantName(t.nama_penghuni) : null,
          no_hp: t?.no_hp ?? null,
          tanggal_masuk: t?.tanggal_masuk ?? null,
          tanggal_jatuh_tempo: t?.tanggal_jatuh_tempo ?? null,
          tenant_catatan: t?.catatan ?? null,
          payment_id: p?.id ?? null,
          payment_status: p?.status ?? null,
          payment_due_date: p?.jatuh_tempo ?? null,
          payment_nominal: p?.nominal ?? null,
          payment_paid_date: p?.tanggal_bayar ?? null,
        };
      });
    return { storageMode: mode, units };
  }

  const pool = await getPgPool();
  const res = await pool.query(
    `SELECT u.*,
            t.id AS tenant_id, t.nama_penghuni, t.no_hp, t.tanggal_masuk, t.tanggal_jatuh_tempo, t.catatan AS tenant_catatan,
            p.id AS payment_id, p.status AS payment_status, p.jatuh_tempo AS payment_due_date, p.nominal AS payment_nominal, p.tanggal_bayar AS payment_paid_date
     FROM units u
     LEFT JOIN tenants t ON t.unit_id = u.id AND t.status = 'aktif'
     LEFT JOIN payments p ON p.unit_id = u.id AND p.tenant_id = t.id AND p.periode_bulan = $1
     ORDER BY u.nomor_unit ASC`,
    [periode]
  );

  const units: AdminUnitRow[] = res.rows.map((r) => ({
    id: Number(r.id),
    nomor_unit: Number(r.nomor_unit),
    nama_unit: r.nama_unit,
    blok: r.blok as UnitBlock,
    lantai: Number(r.lantai),
    urutan: Number(r.urutan),
    harga_bulanan: Number(r.harga_bulanan),
    status: r.status as UnitStatus,
    ukuran: r.ukuran || '3.5 x 7 m',
    fasilitas: r.fasilitas || '',
    deskripsi: r.deskripsi || '',
    warna_aksen: r.warna_aksen || '#2563eb',
    tenant_id: r.tenant_id ? Number(r.tenant_id) : null,
    nama_penghuni: r.nama_penghuni || null,
    penghuni_publik: r.nama_penghuni ? maskTenantName(r.nama_penghuni) : null,
    no_hp: r.no_hp || null,
    tanggal_masuk: fmtDate(r.tanggal_masuk),
    tanggal_jatuh_tempo: r.tanggal_jatuh_tempo ? Number(r.tanggal_jatuh_tempo) : null,
    tenant_catatan: r.tenant_catatan || null,
    payment_id: r.payment_id ? Number(r.payment_id) : null,
    payment_status: (r.payment_status as PaymentStatus) || null,
    payment_due_date: fmtDate(r.payment_due_date),
    payment_nominal: r.payment_nominal ? Number(r.payment_nominal) : null,
    payment_paid_date: fmtDate(r.payment_paid_date),
  }));

  return { storageMode: mode, units };
}

export async function createUnit(input: {
  nomor_unit?: number;
  nama_unit?: string;
  blok?: string;
  lantai?: number;
  harga_bulanan?: number;
  status?: string;
  ukuran?: string;
  fasilitas?: string;
  deskripsi?: string;
  warna_aksen?: string;
}): Promise<{ id: number; nomor_unit: number }> {
  const validBlocks: UnitBlock[] = ['memanjang_4', 'memanjang_2', 'bertingkat'];
  const blok: UnitBlock = validBlocks.includes(input.blok as UnitBlock) ? (input.blok as UnitBlock) : 'memanjang_4';
  const lantai = blok === 'bertingkat' ? Math.max(1, Math.min(2, Number(input.lantai || 2))) : 1;
  const harga = Math.max(0, Number(input.harga_bulanan ?? 550000));
  const status: UnitStatus = input.status === 'maintenance' ? 'maintenance' : 'kosong';
  const ukuran = (input.ukuran || '3.5 x 7 m').trim() || '3.5 x 7 m';
  const fasilitas = (input.fasilitas || 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam').trim();
  const deskripsi = (input.deskripsi || 'Unit kontrakan baru siap huni.').trim();
  const warna = /^#[0-9a-fA-F]{6}$/.test(input.warna_aksen || '') ? (input.warna_aksen as string) : '#2563eb';

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const maxNum = demo.units.reduce((m, u) => Math.max(m, u.nomor_unit), 0);
    const nomor = Number(input.nomor_unit) > 0 ? Number(input.nomor_unit) : maxNum + 1;
    if (demo.units.some((u) => u.nomor_unit === nomor)) {
      throw new Error(`Nomor kontrakan #${nomor} sudah digunakan.`);
    }
    const maxUrut = demo.units.filter((u) => u.blok === blok && u.lantai === lantai).reduce((m, u) => Math.max(m, u.urutan), 0);
    const nama = (input.nama_unit || '').trim() || `Kontrakan ${String(nomor).padStart(2, '0')}`;
    const newUnit: DemoUnit = {
      id: demo.nextUnitId++,
      nomor_unit: nomor,
      nama_unit: nama,
      blok,
      lantai,
      urutan: maxUrut + 1,
      harga_bulanan: harga,
      status,
      ukuran,
      fasilitas,
      deskripsi,
      warna_aksen: warna,
    };
    demo.units.push(newUnit);
    return { id: newUnit.id, nomor_unit: nomor };
  }

  const pool = await getPgPool();
  let nomor = Number(input.nomor_unit || 0);
  if (nomor <= 0) {
    const maxRes = await pool.query('SELECT COALESCE(MAX(nomor_unit), 0)::int AS m FROM units');
    nomor = maxRes.rows[0].m + 1;
  }
  const dup = await pool.query('SELECT id FROM units WHERE nomor_unit = $1', [nomor]);
  if (dup.rows.length > 0) {
    throw new Error(`Nomor kontrakan #${nomor} sudah digunakan.`);
  }
  const urutRes = await pool.query('SELECT COALESCE(MAX(urutan), 0)::int AS m FROM units WHERE blok = $1 AND lantai = $2', [blok, lantai]);
  const urutan = urutRes.rows[0].m + 1;
  const nama = (input.nama_unit || '').trim() || `Kontrakan ${String(nomor).padStart(2, '0')}`;

  const ins = await pool.query(
    `INSERT INTO units (nomor_unit, nama_unit, blok, lantai, urutan, harga_bulanan, status, ukuran, fasilitas, deskripsi, warna_aksen)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [nomor, nama, blok, lantai, urutan, harga, status, ukuran, fasilitas, deskripsi, warna]
  );
  return { id: Number(ins.rows[0].id), nomor_unit: nomor };
}

export async function updateUnit(input: {
  id: number;
  nomor_unit?: number;
  nama_unit?: string;
  blok?: string;
  lantai?: number;
  harga_bulanan?: number;
  status?: string;
  ukuran?: string;
  fasilitas?: string;
  deskripsi?: string;
  warna_aksen?: string;
  sync_unpaid_price?: boolean;
}): Promise<string> {
  const validBlocks: UnitBlock[] = ['memanjang_4', 'memanjang_2', 'bertingkat'];
  const validStatuses: UnitStatus[] = ['kosong', 'terisi', 'maintenance'];

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const u = demo.units.find((x) => x.id === input.id);
    if (!u) throw new Error('Unit tidak ditemukan.');

    const nextNum = input.nomor_unit ? Number(input.nomor_unit) : u.nomor_unit;
    if (nextNum !== u.nomor_unit && demo.units.some((x) => x.nomor_unit === nextNum && x.id !== u.id)) {
      throw new Error(`Nomor kontrakan #${nextNum} sudah digunakan unit lain.`);
    }
    const nextBlok = validBlocks.includes(input.blok as UnitBlock) ? (input.blok as UnitBlock) : u.blok;
    const nextLantai = nextBlok === 'bertingkat' ? Math.max(1, Math.min(2, Number(input.lantai ?? u.lantai))) : 1;
    if (nextBlok !== u.blok || nextLantai !== u.lantai) {
      u.urutan = demo.units.filter((x) => x.blok === nextBlok && x.lantai === nextLantai).reduce((m, x) => Math.max(m, x.urutan), 0) + 1;
    }

    u.nomor_unit = nextNum;
    u.nama_unit = input.nama_unit !== undefined ? input.nama_unit.trim() : u.nama_unit;
    u.blok = nextBlok;
    u.lantai = nextLantai;
    u.harga_bulanan = input.harga_bulanan !== undefined ? Math.max(0, Number(input.harga_bulanan)) : u.harga_bulanan;
    u.status = validStatuses.includes(input.status as UnitStatus) ? (input.status as UnitStatus) : u.status;
    u.ukuran = input.ukuran !== undefined ? input.ukuran.trim() : u.ukuran;
    u.fasilitas = input.fasilitas !== undefined ? input.fasilitas.trim() : u.fasilitas;
    u.deskripsi = input.deskripsi !== undefined ? input.deskripsi.trim() : u.deskripsi;
    if (input.warna_aksen && /^#[0-9a-fA-F]{6}$/.test(input.warna_aksen)) u.warna_aksen = input.warna_aksen;

    if (input.sync_unpaid_price) {
      const period = getCurrentPeriod();
      demo.payments.forEach((p) => {
        if (p.unit_id === u.id && p.periode_bulan === period && p.status !== 'lunas') {
          p.nominal = u.harga_bulanan;
        }
      });
    }
    return u.nama_unit;
  }

  const pool = await getPgPool();
  const exRes = await pool.query('SELECT * FROM units WHERE id = $1', [input.id]);
  const ex = exRes.rows[0];
  if (!ex) throw new Error('Unit tidak ditemukan.');

  const nextNum = input.nomor_unit ? Number(input.nomor_unit) : Number(ex.nomor_unit);
  if (nextNum !== Number(ex.nomor_unit)) {
    const dup = await pool.query('SELECT id FROM units WHERE nomor_unit = $1 AND id != $2', [nextNum, input.id]);
    if (dup.rows.length > 0) throw new Error(`Nomor kontrakan #${nextNum} sudah digunakan unit lain.`);
  }

  const nextBlok = validBlocks.includes(input.blok as UnitBlock) ? (input.blok as UnitBlock) : (ex.blok as UnitBlock);
  const nextLantai = nextBlok === 'bertingkat' ? Math.max(1, Math.min(2, Number(input.lantai ?? ex.lantai))) : 1;
  let nextUrutan = Number(ex.urutan);
  if (nextBlok !== ex.blok || nextLantai !== Number(ex.lantai)) {
    const ur = await pool.query('SELECT COALESCE(MAX(urutan), 0)::int AS m FROM units WHERE blok = $1 AND lantai = $2', [nextBlok, nextLantai]);
    nextUrutan = ur.rows[0].m + 1;
  }

  const nama = input.nama_unit !== undefined ? input.nama_unit.trim() : ex.nama_unit;
  const harga = input.harga_bulanan !== undefined ? Math.max(0, Number(input.harga_bulanan)) : Number(ex.harga_bulanan);
  const status = validStatuses.includes(input.status as UnitStatus) ? (input.status as UnitStatus) : (ex.status as UnitStatus);
  const ukuran = input.ukuran !== undefined ? input.ukuran.trim() : ex.ukuran;
  const fasilitas = input.fasilitas !== undefined ? input.fasilitas.trim() : ex.fasilitas;
  const deskripsi = input.deskripsi !== undefined ? input.deskripsi.trim() : ex.deskripsi;
  const warna = input.warna_aksen && /^#[0-9a-fA-F]{6}$/.test(input.warna_aksen) ? input.warna_aksen : ex.warna_aksen;

  await pool.query(
    `UPDATE units
     SET nomor_unit=$1, nama_unit=$2, blok=$3, lantai=$4, urutan=$5, harga_bulanan=$6, status=$7, ukuran=$8, fasilitas=$9, deskripsi=$10, warna_aksen=$11, updated_at=NOW()
     WHERE id=$12`,
    [nextNum, nama, nextBlok, nextLantai, nextUrutan, harga, status, ukuran, fasilitas, deskripsi, warna, input.id]
  );

  if (input.sync_unpaid_price) {
    await pool.query(
      `UPDATE payments SET nominal = $1, updated_at = NOW() WHERE unit_id = $2 AND periode_bulan = $3 AND status != 'lunas'`,
      [harga, input.id, getCurrentPeriod()]
    );
  }
  return nama;
}

export async function deleteUnit(id: number): Promise<void> {
  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const idx = demo.units.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Unit tidak ditemukan.');
    demo.units.splice(idx, 1);
    demo.tenants = demo.tenants.filter((t) => t.unit_id !== id);
    demo.payments = demo.payments.filter((p) => p.unit_id !== id);
    return;
  }

  const pool = await getPgPool();
  const res = await pool.query('DELETE FROM units WHERE id = $1', [id]);
  if (res.rowCount === 0) throw new Error('Unit tidak ditemukan.');
}

export async function getAdminTenants(statusFilter: string): Promise<AdminTenantRow[]> {
  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const unitMap = new Map(demo.units.map((u) => [u.id, u]));
    return demo.tenants
      .filter((t) => (statusFilter === 'aktif' || statusFilter === 'keluar' ? t.status === statusFilter : true))
      .map((t) => {
        const u = unitMap.get(t.unit_id);
        return {
          ...t,
          nomor_unit: u?.nomor_unit ?? 0,
          nama_unit: u?.nama_unit ?? '-',
          harga_bulanan: u?.harga_bulanan ?? 0,
          penghuni_publik: maskTenantName(t.nama_penghuni),
        };
      })
      .sort((a, b) => a.nomor_unit - b.nomor_unit || b.id - a.id);
  }

  const pool = await getPgPool();
  const params: string[] = [];
  let where = '';
  if (statusFilter === 'aktif' || statusFilter === 'keluar') {
    where = 'WHERE t.status = $1';
    params.push(statusFilter);
  }
  const res = await pool.query(
    `SELECT t.*, u.nomor_unit, u.nama_unit, u.harga_bulanan
     FROM tenants t
     INNER JOIN units u ON u.id = t.unit_id
     ${where}
     ORDER BY u.nomor_unit ASC, t.id DESC`,
    params
  );

  return res.rows.map((r) => ({
    id: Number(r.id),
    unit_id: Number(r.unit_id),
    nomor_unit: Number(r.nomor_unit),
    nama_unit: r.nama_unit,
    harga_bulanan: Number(r.harga_bulanan),
    nama_penghuni: r.nama_penghuni,
    penghuni_publik: maskTenantName(r.nama_penghuni),
    no_hp: r.no_hp || '',
    tanggal_masuk: fmtDate(r.tanggal_masuk) || getTodayISO(),
    tanggal_keluar: fmtDate(r.tanggal_keluar),
    tanggal_jatuh_tempo: Number(r.tanggal_jatuh_tempo),
    status: r.status as TenantStatus,
    catatan: r.catatan || '',
  }));
}

export async function assignOrUpdateTenant(input: {
  unit_id: number;
  nama_penghuni: string;
  no_hp?: string;
  tanggal_masuk?: string;
  tanggal_jatuh_tempo?: number;
  catatan?: string;
}): Promise<{ nomor_unit: number; penghuni_publik: string | null }> {
  const nama = input.nama_penghuni.trim();
  const noHp = (input.no_hp || '').trim();
  const tglMasuk = (input.tanggal_masuk || getTodayISO()).trim();
  const dueDay = Math.max(1, Math.min(28, Number(input.tanggal_jatuh_tempo || 5)));
  const catatan = (input.catatan || '').trim();
  const period = getCurrentPeriod();
  const dueDate = buildDueDateForPeriod(period, dueDay);

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const unit = demo.units.find((u) => u.id === input.unit_id);
    if (!unit) throw new Error('Unit tidak ditemukan.');

    const active = demo.tenants.find((t) => t.unit_id === unit.id && t.status === 'aktif');
    if (active) {
      active.nama_penghuni = nama;
      active.no_hp = noHp;
      active.tanggal_masuk = tglMasuk;
      active.tanggal_jatuh_tempo = dueDay;
      active.catatan = catatan;

      demo.payments.forEach((p) => {
        if (p.unit_id === unit.id && p.tenant_id === active.id && p.periode_bulan === period && p.status !== 'lunas') {
          p.jatuh_tempo = dueDate;
        }
      });
    } else {
      const tenant: DemoTenant = {
        id: demo.nextTenantId++,
        unit_id: unit.id,
        nama_penghuni: nama,
        no_hp: noHp,
        tanggal_masuk: tglMasuk,
        tanggal_keluar: null,
        tanggal_jatuh_tempo: dueDay,
        status: 'aktif',
        catatan,
      };
      demo.tenants.push(tenant);

      const existsPay = demo.payments.some((p) => p.unit_id === unit.id && p.tenant_id === tenant.id && p.periode_bulan === period);
      if (!existsPay) {
        demo.payments.push({
          id: demo.nextPaymentId++,
          unit_id: unit.id,
          tenant_id: tenant.id,
          periode_bulan: period,
          jatuh_tempo: dueDate,
          nominal: unit.harga_bulanan,
          tanggal_bayar: null,
          metode_bayar: null,
          status: getTodayISO() > dueDate ? 'telat' : 'belum_bayar',
          catatan: 'Jadwal otomatis saat penghuni masuk',
        });
      }
    }

    unit.status = 'terisi';
    return { nomor_unit: unit.nomor_unit, penghuni_publik: maskTenantName(nama) };
  }

  const pool = await getPgPool();
  const unitRes = await pool.query('SELECT id, nomor_unit, harga_bulanan FROM units WHERE id = $1', [input.unit_id]);
  const unit = unitRes.rows[0];
  if (!unit) throw new Error('Unit tidak ditemukan.');

  const activeRes = await pool.query("SELECT id FROM tenants WHERE unit_id = $1 AND status = 'aktif' LIMIT 1", [input.unit_id]);
  if (activeRes.rows[0]) {
    const tenantId = Number(activeRes.rows[0].id);
    await pool.query(
      `UPDATE tenants SET nama_penghuni=$1, no_hp=$2, tanggal_masuk=$3, tanggal_jatuh_tempo=$4, catatan=$5, updated_at=NOW() WHERE id=$6`,
      [nama, noHp, tglMasuk, dueDay, catatan, tenantId]
    );
    await pool.query(
      `UPDATE payments SET jatuh_tempo=$1, updated_at=NOW() WHERE unit_id=$2 AND tenant_id=$3 AND periode_bulan=$4 AND status != 'lunas'`,
      [dueDate, input.unit_id, tenantId, period]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO tenants (unit_id, nama_penghuni, no_hp, tanggal_masuk, tanggal_jatuh_tempo, status, catatan)
       VALUES ($1,$2,$3,$4,$5,'aktif',$6) RETURNING id`,
      [input.unit_id, nama, noHp, tglMasuk, dueDay, catatan]
    );
    const tenantId = Number(ins.rows[0].id);
    const payStatus: PaymentStatus = getTodayISO() > dueDate ? 'telat' : 'belum_bayar';
    await pool.query(
      `INSERT INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, status, catatan)
       VALUES ($1,$2,$3,$4,$5,$6,'Jadwal otomatis saat penghuni masuk') ON CONFLICT DO NOTHING`,
      [input.unit_id, tenantId, period, dueDate, Number(unit.harga_bulanan), payStatus]
    );
  }

  await pool.query("UPDATE units SET status = 'terisi', updated_at = NOW() WHERE id = $1", [input.unit_id]);
  return { nomor_unit: Number(unit.nomor_unit), penghuni_publik: maskTenantName(nama) };
}

export async function checkoutTenant(unitId: number): Promise<void> {
  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    demo.tenants.forEach((t) => {
      if (t.unit_id === unitId && t.status === 'aktif') {
        t.status = 'keluar';
        t.tanggal_keluar = getTodayISO();
      }
    });
    const unit = demo.units.find((u) => u.id === unitId);
    if (unit) unit.status = 'kosong';
    return;
  }

  const pool = await getPgPool();
  await pool.query("UPDATE tenants SET status = 'keluar', tanggal_keluar = CURRENT_DATE, updated_at = NOW() WHERE unit_id = $1 AND status = 'aktif'", [unitId]);
  await pool.query("UPDATE units SET status = 'kosong', updated_at = NOW() WHERE id = $1", [unitId]);
}

export async function getAdminPayments(
  periode: string,
  statusFilter: string
): Promise<{ summary: PaymentSummary; payments: AdminPaymentRow[] }> {
  const summary: PaymentSummary = {
    total_tagihan: 0,
    total_lunas: 0,
    total_belum: 0,
    count_lunas: 0,
    count_belum: 0,
    count_telat: 0,
  };
  const today = getTodayISO();

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    demo.payments.forEach((p) => {
      if (p.status === 'belum_bayar' && p.jatuh_tempo < today) {
        p.status = 'telat';
      }
    });

    const unitMap = new Map(demo.units.map((u) => [u.id, u]));
    const tenantMap = new Map(demo.tenants.map((t) => [t.id, t]));
    const orderRank: Record<PaymentStatus, number> = { telat: 0, belum_bayar: 1, lunas: 2 };

    const payments: AdminPaymentRow[] = demo.payments
      .filter((p) => (periode === 'all' ? true : p.periode_bulan === periode))
      .filter((p) => (statusFilter === 'belum_bayar' || statusFilter === 'lunas' || statusFilter === 'telat' ? p.status === statusFilter : true))
      .map((p) => {
        const u = unitMap.get(p.unit_id);
        const t = tenantMap.get(p.tenant_id);
        summary.total_tagihan += p.nominal;
        if (p.status === 'lunas') {
          summary.total_lunas += p.nominal;
          summary.count_lunas++;
        } else {
          summary.total_belum += p.nominal;
          if (p.status === 'telat') summary.count_telat++;
          else summary.count_belum++;
        }
        return {
          ...p,
          nomor_unit: u?.nomor_unit ?? 0,
          nama_unit: u?.nama_unit ?? '-',
          harga_bulanan: u?.harga_bulanan ?? p.nominal,
          nama_penghuni: t?.nama_penghuni ?? '-',
          no_hp: t?.no_hp ?? '',
          tanggal_jatuh_tempo: t?.tanggal_jatuh_tempo ?? 5,
        };
      })
      .sort((a, b) => orderRank[a.status] - orderRank[b.status] || a.jatuh_tempo.localeCompare(b.jatuh_tempo) || a.nomor_unit - b.nomor_unit);

    return { summary, payments };
  }

  const pool = await getPgPool();
  await pool.query("UPDATE payments SET status = 'telat', updated_at = NOW() WHERE status = 'belum_bayar' AND jatuh_tempo < CURRENT_DATE");

  const conds: string[] = [];
  const params: string[] = [];
  if (periode !== 'all') {
    params.push(periode);
    conds.push(`p.periode_bulan = $${params.length}`);
  }
  if (statusFilter === 'belum_bayar' || statusFilter === 'lunas' || statusFilter === 'telat') {
    params.push(statusFilter);
    conds.push(`p.status = $${params.length}`);
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT p.*, u.nomor_unit, u.nama_unit, u.harga_bulanan, t.nama_penghuni, t.no_hp, t.tanggal_jatuh_tempo
     FROM payments p
     INNER JOIN units u ON u.id = p.unit_id
     INNER JOIN tenants t ON t.id = p.tenant_id
     ${where}
     ORDER BY CASE p.status WHEN 'telat' THEN 0 WHEN 'belum_bayar' THEN 1 ELSE 2 END, p.jatuh_tempo ASC, u.nomor_unit ASC`,
    params
  );

  const payments: AdminPaymentRow[] = res.rows.map((r) => {
    const nominal = Number(r.nominal);
    const status = r.status as PaymentStatus;
    summary.total_tagihan += nominal;
    if (status === 'lunas') {
      summary.total_lunas += nominal;
      summary.count_lunas++;
    } else {
      summary.total_belum += nominal;
      if (status === 'telat') summary.count_telat++;
      else summary.count_belum++;
    }
    return {
      id: Number(r.id),
      unit_id: Number(r.unit_id),
      tenant_id: Number(r.tenant_id),
      nomor_unit: Number(r.nomor_unit),
      nama_unit: r.nama_unit,
      harga_bulanan: Number(r.harga_bulanan),
      nama_penghuni: r.nama_penghuni,
      no_hp: r.no_hp || '',
      tanggal_jatuh_tempo: Number(r.tanggal_jatuh_tempo),
      periode_bulan: String(r.periode_bulan).trim(),
      jatuh_tempo: fmtDate(r.jatuh_tempo) || today,
      nominal,
      tanggal_bayar: fmtDate(r.tanggal_bayar),
      metode_bayar: r.metode_bayar || null,
      status,
      catatan: r.catatan || '',
    };
  });

  return { summary, payments };
}

export async function generateMonthlyPayments(periode: string): Promise<number> {
  const today = getTodayISO();

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    let created = 0;
    for (const t of demo.tenants) {
      if (t.status !== 'aktif') continue;
      const u = demo.units.find((x) => x.id === t.unit_id && x.status === 'terisi');
      if (!u) continue;
      const exists = demo.payments.some((p) => p.unit_id === u.id && p.tenant_id === t.id && p.periode_bulan === periode);
      if (exists) continue;
      const dueDate = buildDueDateForPeriod(periode, t.tanggal_jatuh_tempo);
      demo.payments.push({
        id: demo.nextPaymentId++,
        unit_id: u.id,
        tenant_id: t.id,
        periode_bulan: periode,
        jatuh_tempo: dueDate,
        nominal: u.harga_bulanan,
        tanggal_bayar: null,
        metode_bayar: null,
        status: today > dueDate ? 'telat' : 'belum_bayar',
        catatan: 'Jadwal tagihan bulanan',
      });
      created++;
    }
    return created;
  }

  const pool = await getPgPool();
  const active = await pool.query(`
    SELECT t.id AS tenant_id, t.unit_id, t.tanggal_jatuh_tempo, u.harga_bulanan
    FROM tenants t
    INNER JOIN units u ON u.id = t.unit_id
    WHERE t.status = 'aktif' AND u.status = 'terisi'
  `);

  let created = 0;
  for (const row of active.rows) {
    const dueDate = buildDueDateForPeriod(periode, Number(row.tanggal_jatuh_tempo));
    const status: PaymentStatus = today > dueDate ? 'telat' : 'belum_bayar';
    const ins = await pool.query(
      `INSERT INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, status, catatan)
       VALUES ($1,$2,$3,$4,$5,$6,'Jadwal tagihan bulanan')
       ON CONFLICT (unit_id, tenant_id, periode_bulan) DO NOTHING`,
      [Number(row.unit_id), Number(row.tenant_id), periode, dueDate, Number(row.harga_bulanan), status]
    );
    if ((ins.rowCount ?? 0) > 0) created++;
  }
  return created;
}

export async function updatePayment(input: {
  id: number;
  jatuh_tempo?: string;
  nominal?: number;
  status?: PaymentStatus;
  tanggal_bayar?: string | null;
  metode_bayar?: string | null;
  catatan?: string;
  sync_tenant_due_day?: boolean;
}): Promise<void> {
  const today = getTodayISO();

  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    const p = demo.payments.find((x) => x.id === input.id);
    if (!p) throw new Error('Data pembayaran tidak ditemukan.');

    if (input.jatuh_tempo) p.jatuh_tempo = input.jatuh_tempo;
    if (input.nominal !== undefined) p.nominal = Math.max(0, Number(input.nominal));
    if (input.status) p.status = input.status;
    if (input.catatan !== undefined) p.catatan = input.catatan.trim();

    if (p.status === 'lunas') {
      p.tanggal_bayar = input.tanggal_bayar || p.tanggal_bayar || today;
      p.metode_bayar = (input.metode_bayar || p.metode_bayar || 'Tunai').trim();
    } else {
      p.tanggal_bayar = null;
      p.metode_bayar = input.metode_bayar ?? p.metode_bayar;
      if (p.status === 'belum_bayar' && p.jatuh_tempo < today) {
        p.status = 'telat';
      }
    }

    if (input.sync_tenant_due_day && /^\d{4}-\d{2}-(\d{2})$/.test(p.jatuh_tempo)) {
      const day = Math.max(1, Math.min(28, Number(p.jatuh_tempo.slice(8, 10))));
      const t = demo.tenants.find((x) => x.id === p.tenant_id);
      if (t) t.tanggal_jatuh_tempo = day;
    }
    return;
  }

  const pool = await getPgPool();
  const exRes = await pool.query('SELECT * FROM payments WHERE id = $1', [input.id]);
  const ex = exRes.rows[0];
  if (!ex) throw new Error('Data pembayaran tidak ditemukan.');

  const dueDate = input.jatuh_tempo || fmtDate(ex.jatuh_tempo) || today;
  const nominal = input.nominal !== undefined ? Math.max(0, Number(input.nominal)) : Number(ex.nominal);
  let status: PaymentStatus = input.status || (ex.status as PaymentStatus);
  let metode = input.metode_bayar !== undefined ? (input.metode_bayar || '').trim() : ex.metode_bayar;
  const catatan = input.catatan !== undefined ? input.catatan.trim() : ex.catatan;
  let tglBayar: string | null = null;

  if (status === 'lunas') {
    tglBayar = input.tanggal_bayar || fmtDate(ex.tanggal_bayar) || today;
    if (!metode) metode = 'Tunai';
  } else {
    tglBayar = null;
    if (status === 'belum_bayar' && dueDate < today) {
      status = 'telat';
    }
  }

  await pool.query(
    `UPDATE payments SET jatuh_tempo=$1, nominal=$2, status=$3, tanggal_bayar=$4, metode_bayar=$5, catatan=$6, updated_at=NOW() WHERE id=$7`,
    [dueDate, nominal, status, tglBayar, metode, catatan, input.id]
  );

  if (input.sync_tenant_due_day && /^\d{4}-\d{2}-(\d{2})$/.test(dueDate)) {
    const day = Math.max(1, Math.min(28, Number(dueDate.slice(8, 10))));
    await pool.query('UPDATE tenants SET tanggal_jatuh_tempo = $1, updated_at = NOW() WHERE id = $2', [day, Number(ex.tenant_id)]);
  }
}

export async function deletePayment(id: number): Promise<void> {
  if (getStorageMode() === 'demo') {
    const demo = getDemoState();
    demo.payments = demo.payments.filter((p) => p.id !== id);
    return;
  }
  const pool = await getPgPool();
  await pool.query('DELETE FROM payments WHERE id = $1', [id]);
}
