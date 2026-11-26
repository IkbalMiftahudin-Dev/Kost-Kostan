# Kontrakan Teh Amoy — Sistem Manajemen & Tur 3D Interaktif

Aplikasi web manajemen kontrakan modern dengan **visualisasi lingkungan & tur interior 3D interaktif** untuk calon penyewa serta **Dashboard Admin** terintegrasi database **PostgreSQL**.

🌐 **Live Website (Hosting):** [https://kontrakan-teh-amoy.vercel.app](https://kontrakan-teh-amoy.vercel.app)  
📍 **Lokasi Google Maps:** [Kontrakan Teh Amoy — Pameungpeuk, Jawa Barat](https://maps.app.goo.gl/jueJMjUPuNPdtNwk9)

> Versi arsip lama berbasis PHP + MySQL tetap tersimpan di branch [`legacy-php`](https://github.com/IkbalMiftahudin-Dev/Kost-Kostan/tree/legacy-php).

---

## Fitur Utama

### 1. Halaman Publik 3D Interaktif (`/`)
- **Lingkungan 3D Sesuai Lokasi Asli:**
  - **Blok Bertingkat (Leter L):** 1 unit lantai bawah (`#07`) + tangga besi terbuka & 2 unit lantai atas (`#08`–`#09`) dengan balkon & gerbang besi, sudah termasuk **Free WiFi**.
  - **Blok 4 Unit Memanjang (`#01`–`#04`):** 4 unit lantai 1 berjajar dengan halaman depan & pagar masing-masing, sudah termasuk **Free WiFi**.
  - **Blok 2 Unit Terpisah (`#05`–`#06`):** 2 unit lantai 1 terpisah di gang barat.
  - **Lingkungan Sekitar Realistis:** Rumah Utama pengelola + Warung Bubur Ayam Barokah, gang beton sempit, rumah warga sekitar, dan hamparan sawah di sisi utara.
- **Tur Interior 3D Masuk Ruangan (Walk-in 360°):**
  - Klik unit manapun untuk membuka pintu dan masuk ke dalam ruangan 3D sesuai kondisi asli (dinding krem-peach, plint keramik abu-abu, lantai keramik putih, jendela 2 daun + boven, sekat kusen cokelat tua, meja dapur beton cor, dan kamar mandi belakang).
  - Navigasi antar **4 ruangan** (*Ruang Depan*, *Ruang Tengah*, *Lorong Dapur*, *Kamar Mandi*) melalui tombol HUD, klik *Floor Hotspot* 3D, atau tombol `WASD`/Panah, plus **Mode Denah 3D (Cutaway)**.
  - Unit berstatus **Kosong** tampil 100% kosongan polos sesuai kondisi aktual.
- **Privasi & Responsif Penuh:**
  - Halaman publik hanya menampilkan **nama depan + inisial belakang** penghuni (tanpa nomor HP & tanpa tautan login admin).
  - Tampilan adaptif untuk **Mobile** (*Bottom Dock* & *Bottom Sheet*), **Tablet**, dan **Desktop**.

### 2. Dashboard Admin (`/admin`)
- **Autentikasi Aman:** Menggunakan password hash `scrypt` dan sesi cookie `HttpOnly` bertanda tangan HMAC-SHA256.
- **Manajemen Unit Dinamis:** Tambah unit baru (otomatis muncul di denah 3D), atur harga sewa per unit, ubah status (*Kosong* / *Terisi* / *Perbaikan*), blok/lantai, dan warna aksen.
- **Manajemen Penghuni & Pembayaran:** Kelola data lengkap penghuni, tanggal masuk/checkout, pembuatan tagihan bulanan, pencatatan status bayar, serta tombol pengingat **WhatsApp** otomatis.
- **Database Permanen (PostgreSQL):** Terhubung ke **Neon Serverless PostgreSQL** via `DATABASE_URL` dengan inisialisasi skema otomatis, serta fallback *Mode Demo* saat dijalankan lokal tanpa database.

---

## Teknologi yang Digunakan
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling & Ikon:** Tailwind CSS + Lucide React
- **Visualisasi 3D:** Three.js
- **Database:** PostgreSQL (`pg`) — di-host di [Neon](https://neon.tech)
- **Deployment:** [Vercel](https://vercel.com)

---

## Menjalankan di Lokal

1. Clone repository dan pasang dependensi:
   ```bash
   git clone https://github.com/IkbalMiftahudin-Dev/Kost-Kostan.git
   cd Kost-Kostan
   npm install
   ```
2. *(Opsional)* Salin `.env.example` menjadi `.env.local` lalu isi `DATABASE_URL` dan `AUTH_SECRET`:
   ```bash
   cp .env.example .env.local
   ```
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
4. Buka di browser:
   - Halaman Publik 3D: `http://localhost:3000`
   - Dashboard Admin: `http://localhost:3000/admin/login`

---

## Panduan Deployment
Lihat panduan konfigurasi Vercel & PostgreSQL lengkap di **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)**.
