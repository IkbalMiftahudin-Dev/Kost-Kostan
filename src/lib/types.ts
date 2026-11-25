export type UnitBlock = 'memanjang_4' | 'memanjang_2' | 'bertingkat';
export type UnitStatus = 'kosong' | 'terisi' | 'maintenance';
export type TenantStatus = 'aktif' | 'keluar';
export type PaymentStatus = 'belum_bayar' | 'lunas' | 'telat';
export type StorageMode = 'postgres' | 'demo';

export interface AdminUser {
  id: number;
  username: string;
  nama_lengkap: string;
}

export interface PublicUnit {
  id: number;
  nomor_unit: number;
  nama_unit: string;
  blok: UnitBlock;
  lantai: number;
  urutan: number;
  harga_bulanan: number;
  status: UnitStatus;
  ukuran: string;
  fasilitas: string[];
  deskripsi: string;
  warna_aksen: string;
  penghuni_publik: string | null;
}

export interface AdminUnitRow {
  id: number;
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
  tenant_id: number | null;
  nama_penghuni: string | null;
  penghuni_publik: string | null;
  no_hp: string | null;
  tanggal_masuk: string | null;
  tanggal_jatuh_tempo: number | null;
  tenant_catatan: string | null;
  payment_id: number | null;
  payment_status: PaymentStatus | null;
  payment_due_date: string | null;
  payment_nominal: number | null;
  payment_paid_date: string | null;
}

export interface AdminTenantRow {
  id: number;
  unit_id: number;
  nomor_unit: number;
  nama_unit: string;
  harga_bulanan: number;
  nama_penghuni: string;
  penghuni_publik: string | null;
  no_hp: string;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  tanggal_jatuh_tempo: number;
  status: TenantStatus;
  catatan: string;
}

export interface AdminPaymentRow {
  id: number;
  unit_id: number;
  tenant_id: number;
  nomor_unit: number;
  nama_unit: string;
  harga_bulanan: number;
  nama_penghuni: string;
  no_hp: string;
  tanggal_jatuh_tempo: number;
  periode_bulan: string;
  jatuh_tempo: string;
  nominal: number;
  tanggal_bayar: string | null;
  metode_bayar: string | null;
  status: PaymentStatus;
  catatan: string;
}

export interface PaymentSummary {
  total_tagihan: number;
  total_lunas: number;
  total_belum: number;
  count_lunas: number;
  count_belum: number;
  count_telat: number;
}
