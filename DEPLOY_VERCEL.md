# Panduan Deploy ke Vercel — Kontrakan Teh Amoy

Website ini berjalan di **Vercel** dan terhubung langsung ke repository GitHub `https://github.com/IkbalMiftahudin-Dev/Kost-Kostan`.

- **Live Production URL:** https://kontrakan-teh-amoy.vercel.app

---

## Langkah 1 — Import Repository ke Vercel
1. Buka **https://vercel.com/** lalu login dengan akun **GitHub**.
2. Klik **Add New... → Project**.
3. Pilih repository **`Kost-Kostan`** lalu klik **Import**.
4. Framework otomatis terdeteksi sebagai **Next.js**. Klik **Deploy**.

---

## Langkah 2 — Hubungkan Database Permanen (Neon Serverless PostgreSQL)
Agar perubahan data di Dashboard Admin (unit, harga, penghuni, pembayaran) **tersimpan permanen**:

1. Buat project gratis di **[Neon](https://neon.tech)** (pilih region terdekat, misal *AWS Asia Pacific — Singapore*).
2. Salin **Pooled Connection String** (`postgresql://...`) dari dashboard Neon.
3. Di project Vercel, buka **Settings → Environment Variables**, lalu tambahkan:
   - `DATABASE_URL`: paste connection string PostgreSQL dari Neon.
   - `AUTH_SECRET`: isi string acak panjang (minimal 32 karakter) untuk menandatangani cookie sesi Admin.
4. Buka tab **Deployments** → klik menu titik tiga (`...`) pada deployment paling atas → klik **Redeploy**.

---

## Langkah 3 — Verifikasi
- Saat website pertama kali diakses setelah *Redeploy*, tabel PostgreSQL (`admins`, `units`, `tenants`, `payments`) dan data awal akan otomatis diinisialisasi.
- Di Dashboard Admin (`/admin`), indikator database di sidebar akan menampilkan **`PostgreSQL Terhubung`**.
- Setiap `git push` ke branch `main` di GitHub akan otomatis memicu build & deploy terbaru di Vercel.
