/**
 * Privasi Halaman Publik: Hanya tampilkan nama depan + inisial nama belakang.
 * Contoh: "Ahmad Fauzi" -> "Ahmad F.", "Siti Nur Rahmawati" -> "Siti R.", "Budi" -> "Budi"
 */
export function maskTenantName(fullName?: string | null): string | null {
  if (!fullName) return null;
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastWord = parts[parts.length - 1];
  return `${firstName} ${lastWord.charAt(0).toUpperCase()}.`;
}

export function getCurrentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildDueDateForPeriod(periodeBulan: string, dueDay: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodeBulan);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) : now.getMonth() + 1;
  const maxDay = new Date(year, month, 0).getDate();
  const safeDay = Math.max(1, Math.min(dueDay, maxDay));
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function formatRupiah(amount: number | null | undefined): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

export function formatShortRupiah(amount: number | null | undefined): string {
  const n = Number(amount || 0);
  if (n >= 1000000) {
    const jt = (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 2).replace(/\.?0+$/, '');
    return `Rp ${jt}jt`;
  }
  return `Rp ${Math.round(n / 1000)}rb`;
}

export function formatWaNumber(hp: string | null | undefined): string {
  const digits = String(hp || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export function formatBlockLabel(blok: string, lantai: number): string {
  if (blok === 'bertingkat') return `Blok Bertingkat • Lt. ${lantai}`;
  if (blok === 'memanjang_4') return 'Blok 4 Melebar (Kanan Bertingkat) • Lt. 1';
  return 'Blok 2 Terpisah (Belakang Rumah Utama) • Lt. 1';
}
