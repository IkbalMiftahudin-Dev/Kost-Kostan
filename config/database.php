<?php
declare(strict_types=1);

/**
 * Konfigurasi Database MySQL (XAMPP Lokal & Hosting InfinityFree / cPanel)
 * - Prioritas 1: config/env.php (khusus hosting, di-ignore Git)
 * - Prioritas 2: Environment variables (Railway/Docker)
 * - Prioritas 3: Default XAMPP lokal (127.0.0.1 / root / kosong)
 */

$localEnv = [];
$envFile = __DIR__ . '/env.php';
if (is_file($envFile)) {
    $loaded = require $envFile;
    if (is_array($loaded)) {
        $localEnv = $loaded;
    }
}

define('DB_HOST', (string)($localEnv['DB_HOST'] ?? getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: '127.0.0.1')));
define('DB_PORT', (string)($localEnv['DB_PORT'] ?? getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: '3306')));
define('DB_NAME', (string)($localEnv['DB_NAME'] ?? getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: 'kontrakan_teh_amoy')));
define('DB_USER', (string)($localEnv['DB_USER'] ?? getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: 'root')));
define('DB_PASS', (string)($localEnv['DB_PASS'] ?? (getenv('DB_PASS') !== false ? getenv('DB_PASS') : (getenv('MYSQLPASSWORD') !== false ? getenv('MYSQLPASSWORD') : ''))));

function getDB(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        $isLocalHost = in_array(DB_HOST, ['127.0.0.1', 'localhost'], true);
        // Di XAMPP lokal, jika database belum ada (1049), buat database otomatis lalu konek ulang
        if ($isLocalHost && (int)($e->errorInfo[1] ?? 0) === 1049) {
            $rootDsn = sprintf('mysql:host=%s;port=%s;charset=utf8mb4', DB_HOST, DB_PORT);
            $rootPdo = new PDO($rootDsn, DB_USER, DB_PASS, $options);
            $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } else {
            throw $e;
        }
    }

    bootstrapDatabaseIfNeeded($pdo);
    return $pdo;
}

function bootstrapDatabaseIfNeeded(PDO $pdo): void
{
    $stmt = $pdo->query("SHOW TABLES LIKE 'units'");
    if ($stmt->fetch()) {
        migrateBlocksIfNeeded($pdo);
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `admins` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `username` VARCHAR(50) NOT NULL UNIQUE,
          `password_hash` VARCHAR(255) NOT NULL,
          `nama_lengkap` VARCHAR(100) NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `units` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `nomor_unit` INT UNSIGNED NOT NULL UNIQUE,
          `nama_unit` VARCHAR(100) NOT NULL,
          `blok` ENUM('memanjang_4', 'memanjang_2', 'bertingkat') NOT NULL DEFAULT 'memanjang_4',
          `lantai` TINYINT UNSIGNED NOT NULL DEFAULT 1,
          `urutan` INT UNSIGNED NOT NULL DEFAULT 1,
          `harga_bulanan` INT UNSIGNED NOT NULL DEFAULT 850000,
          `status` ENUM('kosong', 'terisi', 'maintenance') NOT NULL DEFAULT 'kosong',
          `ukuran` VARCHAR(50) NOT NULL DEFAULT '3 x 6 m',
          `fasilitas` TEXT NULL,
          `deskripsi` TEXT NULL,
          `warna_aksen` VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_units_layout` (`blok`, `lantai`, `urutan`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `tenants` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `unit_id` INT UNSIGNED NOT NULL,
          `nama_penghuni` VARCHAR(120) NOT NULL,
          `no_hp` VARCHAR(30) NULL,
          `tanggal_masuk` DATE NOT NULL,
          `tanggal_keluar` DATE NULL,
          `tanggal_jatuh_tempo` TINYINT UNSIGNED NOT NULL DEFAULT 5,
          `status` ENUM('aktif', 'keluar') NOT NULL DEFAULT 'aktif',
          `catatan` TEXT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_tenants_unit_status` (`unit_id`, `status`),
          CONSTRAINT `fk_tenants_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `payments` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `unit_id` INT UNSIGNED NOT NULL,
          `tenant_id` INT UNSIGNED NOT NULL,
          `periode_bulan` CHAR(7) NOT NULL,
          `jatuh_tempo` DATE NOT NULL,
          `nominal` INT UNSIGNED NOT NULL,
          `tanggal_bayar` DATE NULL,
          `metode_bayar` VARCHAR(50) NULL,
          `status` ENUM('belum_bayar', 'lunas', 'telat') NOT NULL DEFAULT 'belum_bayar',
          `catatan` TEXT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uniq_payment_unit_tenant_periode` (`unit_id`, `tenant_id`, `periode_bulan`),
          INDEX `idx_payments_periode_status` (`periode_bulan`, `status`),
          CONSTRAINT `fk_payments_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE,
          CONSTRAINT `fk_payments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    seedInitialData($pdo);
}

/**
 * Migrasi otomatis dari skema lama ('memanjang') ke skema terpisah ('memanjang_4' & 'memanjang_2')
 */
function migrateBlocksIfNeeded(PDO $pdo): void
{
    $col = $pdo->query("SHOW COLUMNS FROM units LIKE 'blok'")->fetch();
    if (!$col) {
        return;
    }
    $type = (string)($col['Type'] ?? '');
    if (strpos($type, 'memanjang_4') !== false) {
        return;
    }

    // Perluas ENUM sementara agar bisa memindahkan data dengan aman
    $pdo->exec("ALTER TABLE units MODIFY COLUMN `blok` ENUM('memanjang', 'memanjang_4', 'memanjang_2', 'bertingkat') NOT NULL DEFAULT 'memanjang_4'");

    // Unit 1-4 -> memanjang_4 (urutan 1..4), Unit 5-6 (atau urutan > 4) -> memanjang_2 (urutan 1..2)
    $pdo->exec("UPDATE units SET blok = 'memanjang_4' WHERE blok = 'memanjang' AND urutan <= 4");
    $pdo->exec("UPDATE units SET blok = 'memanjang_2', urutan = urutan - 4 WHERE blok = 'memanjang' AND urutan > 4");

    // Rapikan ENUM final
    $pdo->exec("ALTER TABLE units MODIFY COLUMN `blok` ENUM('memanjang_4', 'memanjang_2', 'bertingkat') NOT NULL DEFAULT 'memanjang_4'");
}

function seedInitialData(PDO $pdo): void
{
    // 1. Seed default Admin: admin / admin123
    $adminStmt = $pdo->prepare("INSERT IGNORE INTO admins (username, password_hash, nama_lengkap) VALUES (?, ?, ?)");
    $adminStmt->execute([
        'admin',
        password_hash('admin123', PASSWORD_DEFAULT),
        'Teh Amoy (Admin)'
    ]);

    // 2. Seed 9 Kontrakan Awal:
    //    - Blok A: 4 memanjang di Lantai 1 (Unit 1 s/d 4)
    //    - Blok B: 2 memanjang TERPISAH di Lantai 1 (Unit 5 & 6)
    //    - Blok C: Gedung bertingkat -> 1 di bawah (Unit 7, Lt. 1) + 2 di atas (Unit 8 & 9, Lt. 2)
    $defaultUnits = [
        [1, 'Kontrakan 01', 'memanjang_4', 1, 1, 850000, 'terisi', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik', 'Unit terdepan Blok A (deret 4 memanjang), akses dekat gerbang utama.', '#2563eb'],
        [2, 'Kontrakan 02', 'memanjang_4', 1, 2, 850000, 'terisi', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik', 'Unit Blok A (deret 4 memanjang), sirkulasi udara lancar dan bersih.', '#0d9488'],
        [3, 'Kontrakan 03', 'memanjang_4', 1, 3, 850000, 'kosong', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik', 'Unit kosongan bersih siap huni di Blok A (deret 4 memanjang).', '#16a34a'],
        [4, 'Kontrakan 04', 'memanjang_4', 1, 4, 900000, 'terisi', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik 1300W', 'Unit pojok Blok A (deret 4 memanjang) dengan privasi lebih nyaman.', '#d97706'],
        [5, 'Kontrakan 05', 'memanjang_2', 1, 1, 900000, 'kosong', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik 1300W', 'Unit kosongan di Blok B (bangunan 2 unit terpisah dari deret 4), lebih tenang.', '#7c3aed'],
        [6, 'Kontrakan 06', 'memanjang_2', 1, 2, 950000, 'terisi', '3.5 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik 1300W', 'Unit Blok B (bangunan 2 unit terpisah), akses teras lega dan nyaman.', '#e11d48'],
        [7, 'Kontrakan 07 (Bawah)', 'bertingkat', 1, 1, 1000000, 'terisi', '4 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Teras Teduh', 'Unit lantai bawah bangunan bertingkat, teduh sepanjang hari tanpa tangga.', '#0284c7'],
        [8, 'Kontrakan 08 (Atas)', 'bertingkat', 2, 1, 900000, 'terisi', '3.8 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Balkon Atas', 'Unit lantai 2 dengan balkon menghadap halaman, sejuk dan bebas bising.', '#ea580c'],
        [9, 'Kontrakan 09 (Atas)', 'bertingkat', 2, 2, 950000, 'kosong', '3.8 x 7 m', 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Balkon Sudut', 'Unit kosongan lantai 2 pojok atas dengan ventilasi sejuk dan terbuka.', '#4f46e5'],
    ];

    $unitStmt = $pdo->prepare("
        INSERT INTO units (nomor_unit, nama_unit, blok, lantai, urutan, harga_bulanan, status, ukuran, fasilitas, deskripsi, warna_aksen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $unitIdByNumber = [];
    foreach ($defaultUnits as $u) {
        $unitStmt->execute($u);
        $unitIdByNumber[$u[0]] = (int)$pdo->lastInsertId();
    }

    // 3. Seed penghuni awal untuk unit yang berstatus terisi
    $currentMonth = date('Y-m');
    $currentYear = (int)date('Y');
    $currentMonNum = (int)date('m');

    $defaultTenants = [
        // [nomor_unit, nama_penghuni, no_hp, tgl_masuk, jatuh_tempo_hari, status_bayar_bulan_ini, metode]
        [1, 'Ahmad Fauzi', '081234567801', '2025-03-05', 5, 'lunas', 'Transfer BCA'],
        [2, 'Siti Rahmawati', '081234567802', '2025-06-10', 10, 'lunas', 'Tunai'],
        [4, 'Budi Santoso', '081234567804', '2025-08-12', 12, 'belum_bayar', null],
        [6, 'Dewi Lestari', '081234567806', '2025-01-03', 3, 'telat', null],
        [7, 'Rizky Pratama', '081234567807', '2025-09-18', 18, 'belum_bayar', null],
        [8, 'Nadia Putri', '081234567808', '2025-05-07', 7, 'lunas', 'Transfer Mandiri'],
    ];

    $tenantStmt = $pdo->prepare("
        INSERT INTO tenants (unit_id, nama_penghuni, no_hp, tanggal_masuk, tanggal_jatuh_tempo, status, catatan)
        VALUES (?, ?, ?, ?, ?, 'aktif', 'Penghuni awal terdaftar')
    ");
    $paymentStmt = $pdo->prepare("
        INSERT INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, tanggal_bayar, metode_bayar, status, catatan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $priceByNumber = [];
    foreach ($defaultUnits as $u) {
        $priceByNumber[$u[0]] = $u[5];
    }

    foreach ($defaultTenants as $t) {
        [$num, $nama, $hp, $tglMasuk, $dueDay, $payStatus, $metode] = $t;
        $unitId = $unitIdByNumber[$num];
        $tenantStmt->execute([$unitId, $nama, $hp, $tglMasuk, $dueDay]);
        $tenantId = (int)$pdo->lastInsertId();

        $maxDays = (int)date('t', mktime(0, 0, 0, $currentMonNum, 1, $currentYear));
        $safeDay = min($dueDay, $maxDays);
        $jatuhTempoDate = sprintf('%04d-%02d-%02d', $currentYear, $currentMonNum, $safeDay);
        $tglBayar = ($payStatus === 'lunas') ? $jatuhTempoDate : null;
        $catatan = $payStatus === 'lunas' ? 'Pembayaran tepat waktu' : ($payStatus === 'telat' ? 'Mohon segera dikonfirmasi' : 'Jadwal tagihan bulan berjalan');

        $paymentStmt->execute([
            $unitId,
            $tenantId,
            $currentMonth,
            $jatuhTempoDate,
            $priceByNumber[$num],
            $tglBayar,
            $metode,
            $payStatus,
            $catatan
        ]);
    }
}
