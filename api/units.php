<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

requireAdminApi();
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    if ($method === 'GET') {
        $periode = $_GET['periode'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $periode)) {
            $periode = date('Y-m');
        }

        $stmt = $pdo->prepare("
            SELECT
                u.*,
                t.id AS tenant_id,
                t.nama_penghuni,
                t.no_hp,
                t.tanggal_masuk,
                t.tanggal_jatuh_tempo,
                t.catatan AS tenant_catatan,
                p.id AS payment_id,
                p.status AS payment_status,
                p.jatuh_tempo AS payment_due_date,
                p.nominal AS payment_nominal,
                p.tanggal_bayar AS payment_paid_date
            FROM units u
            LEFT JOIN tenants t ON t.unit_id = u.id AND t.status = 'aktif'
            LEFT JOIN payments p ON p.unit_id = u.id AND p.tenant_id = t.id AND p.periode_bulan = ?
            ORDER BY u.nomor_unit ASC
        ");
        $stmt->execute([$periode]);
        $rows = $stmt->fetchAll();

        $units = array_map(function (array $row): array {
            $row['id'] = (int)$row['id'];
            $row['nomor_unit'] = (int)$row['nomor_unit'];
            $row['lantai'] = (int)$row['lantai'];
            $row['urutan'] = (int)$row['urutan'];
            $row['harga_bulanan'] = (int)$row['harga_bulanan'];
            $row['tenant_id'] = $row['tenant_id'] ? (int)$row['tenant_id'] : null;
            $row['tanggal_jatuh_tempo'] = $row['tanggal_jatuh_tempo'] ? (int)$row['tanggal_jatuh_tempo'] : null;
            $row['payment_id'] = $row['payment_id'] ? (int)$row['payment_id'] : null;
            $row['payment_nominal'] = $row['payment_nominal'] ? (int)$row['payment_nominal'] : null;
            $row['penghuni_publik'] = $row['nama_penghuni'] ? maskTenantName($row['nama_penghuni']) : null;
            return $row;
        }, $rows);

        jsonResponse(['success' => true, 'periode' => $periode, 'units' => $units]);
    }

    if ($method === 'POST') {
        $body = getJsonBody();

        $nomorUnit = (int)($body['nomor_unit'] ?? 0);
        if ($nomorUnit <= 0) {
            $maxNum = (int)$pdo->query("SELECT COALESCE(MAX(nomor_unit), 0) FROM units")->fetchColumn();
            $nomorUnit = $maxNum + 1;
        }

        // Cek duplikasi nomor unit
        $dup = $pdo->prepare("SELECT id FROM units WHERE nomor_unit = ?");
        $dup->execute([$nomorUnit]);
        if ($dup->fetch()) {
            jsonResponse(['success' => false, 'message' => "Nomor kontrakan #{$nomorUnit} sudah digunakan."], 422);
        }

        $blok = in_array(($body['blok'] ?? ''), ['memanjang_4', 'memanjang_2', 'bertingkat'], true) ? $body['blok'] : 'memanjang_4';
        $lantai = ($blok === 'bertingkat') ? max(1, min(2, (int)($body['lantai'] ?? 2))) : 1;

        $urutanStmt = $pdo->prepare("SELECT COALESCE(MAX(urutan), 0) FROM units WHERE blok = ? AND lantai = ?");
        $urutanStmt->execute([$blok, $lantai]);
        $urutan = (int)$urutanStmt->fetchColumn() + 1;

        $namaUnit = trim((string)($body['nama_unit'] ?? ''));
        if ($namaUnit === '') {
            $suffix = $blok === 'bertingkat' ? ($lantai === 2 ? ' (Atas)' : ' (Bawah)') : '';
            $namaUnit = sprintf('Kontrakan %02d%s', $nomorUnit, $suffix);
        }

        $harga = max(0, (int)($body['harga_bulanan'] ?? 850000));
        $status = in_array(($body['status'] ?? ''), ['kosong', 'maintenance'], true) ? $body['status'] : 'kosong';
        $ukuran = trim((string)($body['ukuran'] ?? '3.5 x 6 m')) ?: '3.5 x 6 m';
        $fasilitas = trim((string)($body['fasilitas'] ?? 'Kamar Mandi Dalam, Dapur Mini, Token Listrik'));
        $deskripsi = trim((string)($body['deskripsi'] ?? 'Unit kontrakan baru siap huni.'));
        $warna = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($body['warna_aksen'] ?? '')) ? $body['warna_aksen'] : '#2563eb';

        $stmt = $pdo->prepare("
            INSERT INTO units (nomor_unit, nama_unit, blok, lantai, urutan, harga_bulanan, status, ukuran, fasilitas, deskripsi, warna_aksen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$nomorUnit, $namaUnit, $blok, $lantai, $urutan, $harga, $status, $ukuran, $fasilitas, $deskripsi, $warna]);

        jsonResponse([
            'success' => true,
            'message' => "Kontrakan #{$nomorUnit} berhasil ditambahkan dan langsung muncul di tampilan 3D!",
            'id' => (int)$pdo->lastInsertId(),
        ], 201);
    }

    if ($method === 'PUT') {
        $body = getJsonBody();
        $id = (int)($body['id'] ?? 0);
        if ($id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID unit tidak valid.'], 422);
        }

        $existingStmt = $pdo->prepare("SELECT * FROM units WHERE id = ?");
        $existingStmt->execute([$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) {
            jsonResponse(['success' => false, 'message' => 'Unit tidak ditemukan.'], 404);
        }

        $nomorUnit = isset($body['nomor_unit']) ? (int)$body['nomor_unit'] : (int)$existing['nomor_unit'];
        if ($nomorUnit <= 0) {
            jsonResponse(['success' => false, 'message' => 'Nomor unit harus lebih dari 0.'], 422);
        }
        if ($nomorUnit !== (int)$existing['nomor_unit']) {
            $dup = $pdo->prepare("SELECT id FROM units WHERE nomor_unit = ? AND id != ?");
            $dup->execute([$nomorUnit, $id]);
            if ($dup->fetch()) {
                jsonResponse(['success' => false, 'message' => "Nomor kontrakan #{$nomorUnit} sudah digunakan unit lain."], 422);
            }
        }

        $namaUnit = isset($body['nama_unit']) ? trim((string)$body['nama_unit']) : $existing['nama_unit'];
        $blok = in_array(($body['blok'] ?? ''), ['memanjang_4', 'memanjang_2', 'bertingkat'], true) ? $body['blok'] : $existing['blok'];
        $lantai = ($blok === 'bertingkat')
            ? max(1, min(2, (int)($body['lantai'] ?? $existing['lantai'])))
            : 1;

        $urutan = (int)$existing['urutan'];
        if ($blok !== $existing['blok'] || $lantai !== (int)$existing['lantai']) {
            $urutanStmt = $pdo->prepare("SELECT COALESCE(MAX(urutan), 0) FROM units WHERE blok = ? AND lantai = ?");
            $urutanStmt->execute([$blok, $lantai]);
            $urutan = (int)$urutanStmt->fetchColumn() + 1;
        }

        $harga = isset($body['harga_bulanan']) ? max(0, (int)$body['harga_bulanan']) : (int)$existing['harga_bulanan'];
        $status = $existing['status'];
        if (isset($body['status']) && in_array($body['status'], ['kosong', 'terisi', 'maintenance'], true)) {
            $status = $body['status'];
        }
        $ukuran = isset($body['ukuran']) ? trim((string)$body['ukuran']) : $existing['ukuran'];
        $fasilitas = isset($body['fasilitas']) ? trim((string)$body['fasilitas']) : $existing['fasilitas'];
        $deskripsi = isset($body['deskripsi']) ? trim((string)$body['deskripsi']) : $existing['deskripsi'];
        $warna = (isset($body['warna_aksen']) && preg_match('/^#[0-9a-fA-F]{6}$/', (string)$body['warna_aksen']))
            ? $body['warna_aksen']
            : $existing['warna_aksen'];

        $stmt = $pdo->prepare("
            UPDATE units
            SET nomor_unit = ?, nama_unit = ?, blok = ?, lantai = ?, urutan = ?, harga_bulanan = ?, status = ?, ukuran = ?, fasilitas = ?, deskripsi = ?, warna_aksen = ?
            WHERE id = ?
        ");
        $stmt->execute([$nomorUnit, $namaUnit, $blok, $lantai, $urutan, $harga, $status, $ukuran, $fasilitas, $deskripsi, $warna, $id]);

        // Opsional: jika harga berubah, sinkronkan nominal tagihan bulan berjalan yang belum lunas
        if (!empty($body['sync_unpaid_price'])) {
            $syncStmt = $pdo->prepare("
                UPDATE payments SET nominal = ?
                WHERE unit_id = ? AND periode_bulan = ? AND status != 'lunas'
            ");
            $syncStmt->execute([$harga, $id, date('Y-m')]);
        }

        jsonResponse(['success' => true, 'message' => "Data {$namaUnit} berhasil diperbarui."]);
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? (getJsonBody()['id'] ?? 0));
        if ($id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID unit tidak valid.'], 422);
        }

        $stmt = $pdo->prepare("DELETE FROM units WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            jsonResponse(['success' => false, 'message' => 'Unit tidak ditemukan.'], 404);
        }

        jsonResponse(['success' => true, 'message' => 'Unit kontrakan berhasil dihapus.']);
    }

    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500);
}
