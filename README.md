# Kontrakan Teh Amoy — Web Manajemen Kost & Tur 3D Interaktif

Sistem manajemen kontrakan berbasis **PHP + MySQL (XAMPP) + Three.js + Tailwind CSS**.

## Fitur Utama
1. **Tampilan 3D Interaktif (Halaman User)**:
   - Layout asli **9 kontrakan dalam 3 bangunan terpisah**:
     - **Blok A**: 4 unit memanjang di Lantai 1 (#01–#04).
     - **Blok B**: 2 unit memanjang terpisah di Lantai 1 (#05–#06).
     - **Blok C**: Gedung bertingkat — 1 unit di bawah (#07) + 2 unit di lantai atas (#08–#09) lengkap dengan tangga & balkon.
   - Interior 3D mengikuti ruangan asli (dinding krem peach, plint abu-abu gelap, lantai keramik putih kotak, kusen cokelat tua + 2 ventilasi atas jendela, sekat tengah, lorong meja dapur beton cor + keramik backsplash, dan kamar mandi belakang berkeramik motif biru-abu). Unit berstatus **Kosong** ditampilkan 100% kosongan tanpa kasur atau peralatan apapun.
   - Otomatis berkembang secara dinamis di dunia 3D saat Admin menambahkan unit kontrakan baru (#10, #11, dst.).
   - Setiap unit menampilkan label nomor, status (`Kosong` / `Terisi` / `Perbaikan`), **nama depan + inisial penghuni** (privasi publik), dan harga sewa per bulan.
   - **Click-to-Enter 3D**: Klik bangunan atau label unit → pintu terbuka otomatis dan kamera meluncur masuk ke dalam ruangan 3D lengkap (ruang tamu, kamar tidur, kamar mandi, dapur mini), bisa diputar 360° atau diubah ke **Mode Denah 3D**, serta mode pencahayaan **Siang / Malam**.

2. **Dashboard Admin (`admin/index.php`)**:
   - Manajemen unit kontrakan & tambah unit baru (pilih posisi blok/lantai 3D).
   - Ubah harga sewa per nomor kontrakan secara individual.
   - Manajemen penghuni lengkap (nama lengkap & No. WA hanya tampil di Admin; otomatis disamarkan di tampilan publik).
   - Manajemen jadwal pembayaran bulanan per nomor kontrakan (ubah jatuh tempo, generate tagihan bulanan, tandai lunas, dan kirim pengingat WhatsApp).

## Cara Menjalankan di XAMPP
1. Buka **XAMPP Control Panel**, lalu jalankan **Apache** dan **MySQL**.
2. Buka browser ke:
   - Halaman User 3D: `http://localhost/Kontrakan-Teh-Amoy/`
   - Dashboard Admin: `http://localhost/Kontrakan-Teh-Amoy/admin/login.php`
3. Database `kontrakan_teh_amoy`, tabel, akun admin, serta 9 data kontrakan awal akan **otomatis dibuat saat pertama kali diakses** (atau bisa juga import manual dari `database/schema.sql` di phpMyAdmin).

## Akun Default Admin
- **Username**: `admin`
- **Password**: `admin123`
