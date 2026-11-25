# Panduan Hosting Gratis di InfinityFree — Kontrakan Teh Amoy

Project ini sudah disiapkan khusus agar **langsung jalan di InfinityFree** (kompatibel penuh dengan MySQL hosting, proteksi `.htaccess`, dan `POST` method override).

---

## Langkah 1 — Buat Akun & Hosting Gratis di InfinityFree
1. Buka **https://www.infinityfree.com/** lalu klik **Sign Up** (gratis, tanpa kartu kredit).
2. Setelah login ke Client Area, klik **Create Account**.
3. Pilih **Subdomain** gratis (misal: `kontrakantehamoy.rf.gd` atau `kontrakantehamoy.infinityfreeapp.com`) lalu klik **Create Account**.
4. Tunggu ~1 menit sampai status berubah menjadi **Active**, lalu klik **Manage**.

---

## Langkah 2 — Buat Database MySQL
1. Di halaman akun InfinityFree, klik **Control Panel** (VistaPanel) → klik **I Approve** jika muncul persetujuan pertama kali.
2. Cari menu **MySQL Databases** lalu klik.
3. Di bagian **Create New Database**, isi nama singkat misalnya `kontrakan`, lalu klik **Create Database**.
4. Catat **4 informasi penting** yang muncul di halaman MySQL Databases / Account Details:
   - **MySQL Hostname**: contoh `sql123.infinityfree.com`
   - **MySQL Database Name**: contoh `if0_38xxxxxx_kontrakan`
   - **MySQL Username**: contoh `if0_38xxxxxx`
   - **MySQL Password**: klik *Show/Hide* pada Password di halaman **Account Details** Client Area.

> 💡 **Tidak perlu import SQL manual!** Tabel `admins`, `units`, `tenants`, `payments`, akun admin default, serta 9 data kontrakan awal akan **otomatis dibuat saat website pertama kali dibuka**.

---

## Langkah 3 — Upload File Project ke Folder `htdocs/`
Anda bisa memakai file **`kontrakan-teh-amoy-hosting.zip`** yang sudah saya buatkan di folder lokal project (tidak ikut masuk GitHub).

### Cara Termudah (via FileZilla / FTP — Paling Cepat & Stabil untuk InfinityFree):
1. Di halaman **Account Details** InfinityFree, lihat bagian **FTP Details** (*FTP Hostname*, *FTP Username*, *FTP Password*).
2. Buka **FileZilla** (atau WinSCP), konek ke FTP tersebut, lalu masuk ke folder **`htdocs/`**.
3. Ekstrak `kontrakan-teh-amoy-hosting.zip` di komputer Anda, lalu drag-and-drop **seluruh isinya** ke dalam folder `htdocs/` di InfinityFree.
   *(Alternatif tanpa FileZilla: klik **File Manager** di Client Area → masuk `htdocs/` → upload file/folder via tombol Upload di kiri bawah).*

---

## Langkah 4 — Pasang Kredensial Database (`config/env.php`)
1. Di dalam folder `htdocs/config/` di hosting, salin/rename file `env.example.php` menjadi **`env.php`** (atau buat file baru bernama `env.php`).
2. Isi dengan 4 data MySQL dari Langkah 2:

```php
<?php
return [
    'DB_HOST' => 'sql123.infinityfree.com',
    'DB_PORT' => '3306',
    'DB_NAME' => 'if0_38xxxxxx_kontrakan',
    'DB_USER' => 'if0_38xxxxxx',
    'DB_PASS' => 'PASSWORD_VPANEL_ANDA',
];
```

3. Simpan (`Save`).

---

## Langkah 5 — Buka Website & Tes!
1. Buka domain gratis Anda di browser, contoh:
   - **Halaman 3D User**: `https://kontrakantehamoy.rf.gd/`
   - **Dashboard Admin**: `https://kontrakantehamoy.rf.gd/admin/login.php`
2. Login Admin default:
   - Username: `admin`
   - Password: `admin123`

> 🔒 **Tips Keamanan**: Setelah berhasil online, sangat disarankan mengganti password default `admin123` atau meminta saya menambahkan menu **"Ganti Password Admin"** di Dashboard Admin!
