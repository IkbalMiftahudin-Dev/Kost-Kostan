<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getDB();

    $sql = "
        SELECT
            u.id,
            u.nomor_unit,
            u.nama_unit,
            u.blok,
            u.lantai,
            u.urutan,
            u.harga_bulanan,
            u.status,
            u.ukuran,
            u.fasilitas,
            u.deskripsi,
            u.warna_aksen,
            t.nama_penghuni AS raw_tenant_name,
            t.tanggal_masuk
        FROM units u
        LEFT JOIN tenants t ON t.unit_id = u.id AND t.status = 'aktif'
        ORDER BY u.nomor_unit ASC
    ";

    $rows = $pdo->query($sql)->fetchAll();

    $units = [];
    $stats = [
        'total' => 0,
        'terisi' => 0,
        'kosong' => 0,
        'maintenance' => 0,
    ];

    foreach ($rows as $row) {
        $status = $row['status'];
        $stats['total']++;
        if (isset($stats[$status])) {
            $stats[$status]++;
        }

        // Privasi publik: hanya nama depan + inisial (tanpa no HP / data sensitif)
        $maskedName = ($status === 'terisi') ? maskTenantName($row['raw_tenant_name']) : null;

        $units[] = [
            'id' => (int)$row['id'],
            'nomor_unit' => (int)$row['nomor_unit'],
            'nama_unit' => $row['nama_unit'],
            'blok' => $row['blok'],
            'lantai' => (int)$row['lantai'],
            'urutan' => (int)$row['urutan'],
            'harga_bulanan' => (int)$row['harga_bulanan'],
            'status' => $status,
            'ukuran' => $row['ukuran'],
            'fasilitas' => $row['fasilitas'] ? array_values(array_filter(array_map('trim', explode(',', $row['fasilitas'])))) : [],
            'deskripsi' => $row['deskripsi'] ?? '',
            'warna_aksen' => $row['warna_aksen'] ?: '#3b82f6',
            'penghuni_publik' => $maskedName,
        ];
    }

    jsonResponse([
        'success' => true,
        'stats' => $stats,
        'units' => $units,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Gagal memuat data kontrakan. Pastikan MySQL di XAMPP sudah aktif.',
        'error' => $e->getMessage(),
    ], 500);
}
