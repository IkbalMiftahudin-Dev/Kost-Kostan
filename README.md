# Kontrakan Teh Amoy — Next.js 15 + 3D Interaktif (Siap Deploy Vercel)

Sistem manajemen kontrakan berbasis **Next.js 15 (App Router) + TypeScript + Tailwind CSS + Three.js + PostgreSQL (`pg`)**.

> Versi lama berbasis PHP + MySQL tetap tersimpan aman di branch **`legacy-php`**.

## Fitur Utama
1. **Tampilan 3D Interaktif Halaman User (`/`)**
   - **3 Bangunan Terpisah (9 Unit Awal + Dinamis)**:
     - **Blok A**: 4 unit memanjang di Lantai 1 (`#01` – `#04`).
     - **Blok B**: 2 unit memanjang terpisah di Lantai 1 (`#05` – `#06`).
     - **Blok C**: Gedung bertingkat — 1 unit di lantai bawah (`#07`) + tangga & 2 unit di lantai atas (`#08` – `#09`) + balkon.
   - **Interior 3D Sesuai Video Asli**: Dinding krem peach, plint keramik abu-abu gelap, lantai keramik putih, jendela 2 daun kusen cokelat tua + 2 ventilasi boven, sekat kusen cokelat tua, meja dapur beton cor + backsplash keramik, serta kamar mandi belakang berkeramik biru-abu. **Unit kosong 100% kosongan polos** tanpa kasur atau peralatan apapun.
   - **Klik Masuk 3D + Responsif Penuh**: Adaptif di **Mobile** (*Bottom Dock*, *Bottom Sheet*, *framing* kamera portrait otomatis), **Tablet** (*Slide-Over Drawer*), dan **Desktop** (*Split HUD*).
   - **Privasi Publik**: Hanya menampilkan **nama depan + inisial** penghuni di halaman publik.

2. **Dashboard Admin (`/admin`)**
   - Login aman berbasis cookie HttpOnly tertandatangani (`admin` / `admin123`).
   - Kelola kontrakan & tambah unit baru (otomatis tampil di 3D), ubah harga per nomor, kelola data penghuni lengkap, serta jadwal & status pembayaran bulanan + pengingat WhatsApp.
   - **PostgreSQL + Demo Fallback**: Otomatis terhubung ke PostgreSQL (Neon / Vercel Storage / Supabase) lewat `DATABASE_URL` dan otomatis membuat tabel + 9 data awal. Jika `DATABASE_URL` belum dipasang, otomatis berjalan dalam **Mode Demo** agar langsung bisa dicoba.

## Jalankan di Lokal
```bash
npm install
npm run dev
```
Buka `http://localhost:3000` (Halaman 3D User) dan `http://localhost:3000/admin/login` (Dashboard Admin).

## Deploy Gratis ke Vercel
Lihat panduan lengkap 3 langkah di **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)**.
