# Panduan Deploy Gratis ke Vercel — Kontrakan Teh Amoy (Next.js)

Website ini sudah 100% siap deploy ke **Vercel** langsung dari repository GitHub `https://github.com/IkbalMiftahudin-Dev/Kost-Kostan`.

---

## Langkah 1 — Import Repository ke Vercel (1 Menit Langsung Online)
1. Buka **https://vercel.com/** lalu login dengan akun **GitHub** Anda.
2. Klik **Add New... → Project**.
3. Pilih repository **`Kost-Kostan`** lalu klik **Import**.
4. Framework otomatis terdeteksi sebagai **Next.js**. Biarkan semua setting default lalu klik **Deploy**.
5. Tunggu ~1 menit → Website langsung online di URL `https://kost-kostan-xxxx.vercel.app`!

> Website sudah langsung bisa dibuka dan dicoba (termasuk 3D & login admin `admin` / `admin123`) dalam **Mode Demo** meskipun database belum dihubungkan.

---

## Langkah 2 — Pasang Database Permanen Gratis (Neon Postgres di Vercel)
Agar data yang diubah Admin (tambah unit, ubah harga, penghuni, jadwal bayar) **tersimpan permanen**:

1. Buka halaman Project Anda di Vercel Dashboard → klik tab **Storage**.
2. Klik **Create Database** → pilih **Neon** (*Serverless Postgres* — Gratis Free Tier) → klik **Continue** → buat database baru & hubungkan ke project Anda.
3. Vercel akan **otomatis** mengisi environment variable `DATABASE_URL` (dan `POSTGRES_URL`) ke project Anda.
4. (Disarankan) Masuk ke **Settings → Environment Variables**, tambahkan:
   - Key: `AUTH_SECRET`
   - Value: isi string acak panjang (misal 32+ karakter acak untuk keamanan cookie sesi admin).
5. Buka tab **Deployments** → klik tombol titik tiga (`...`) pada deployment terakhir → klik **Redeploy**.

---

## Langkah 3 — Selesai!
- Begitu website dibuka pertama kali setelah Redeploy, **tabel PostgreSQL (`admins`, `units`, `tenants`, `payments`), akun admin default (`admin` / `admin123`), dan 9 kontrakan awal akan otomatis terbuat sendiri!**
- Di pojok kiri bawah Dashboard Admin, indikator akan berubah hijau menjadi **`PostgreSQL Terhubung`**.
- Setiap kali kita melakukan `git push` ke branch `main` di GitHub, Vercel akan otomatis build & update website Anda!
