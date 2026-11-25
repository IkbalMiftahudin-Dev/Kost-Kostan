<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

requireAdminApi();
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    if ($method === 'GET') {
        $statusFilter = $_GET['status'] ?? 'aktif';
        $sql = "
            SELECT t.*, u.nomor_unit, u.nama_unit, u.harga_bulanan
            FROM tenants t
            INNER JOIN units u ON u.id = t.unit_id
        ";
        $params = [];
        if (in_array($statusFilter, ['aktif', 'keluar'], true)) {
            $sql .= " WHERE t.status = ? ";
            $params[] = $statusFilter;
        }
        $sql .= " ORDER BY u.nomor_unit ASC, t.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $tenants = array_map(function (array $r): array {
            $r['id'] = (int)$r['id'];
            $r['unit_id'] = (int)$r['unit_id'];
            $r['nomor_unit'] = (int)$r['nomor_unit'];
            $r['harga_bulanan'] = (int)$r['harga_bulanan'];
            $r['tanggal_jatuh_tempo'] = (int)$r['tanggal_jatuh_tempo'];
            $r['penghuni_publik'] = maskTenantName($r['nama_penghuni']);
            return $r;
        }, $rows);

        jsonResponse(['success' => true, 'tenants' => $tenants]);
    }

    if ($method === 'POST') {
        $body = getJsonBody();
        $action = $body['action'] ?? 'assign';

        if ($action === 'checkout') {
            $unitId = (int)($body['unit_id'] ?? 0);
            if ($unitId <= 0) {
                jsonResponse(['success' => false, 'message' => 'Unit tidak valid.'], 422);
            }

            $pdo->beginTransaction();
            $stmt = $pdo->prepare("UPDATE tenants SET status = 'keluar', tanggal_keluar = CURDATE() WHERE unit_id = ? AND status = 'aktif'");
            $stmt->execute([$unitId]);

            $uStmt = $pdo->prepare("UPDATE units SET status = 'kosong' WHERE id = ?");
            $uStmt->execute([$unitId]);
            $pdo->commit();

            jsonResponse(['success' => true, 'message' => 'Penghuni berhasil checkout dan kontrakan sekarang berstatus Kosong.']);
        }

        // Assign atau update penghuni aktif pada unit tertentu
        $unitId = (int)($body['unit_id'] ?? 0);
        $nama = trim((string)($body['nama_penghuni'] ?? ''));
        $noHp = trim((string)($body['no_hp'] ?? ''));
        $tglMasuk = trim((string)($body['tanggal_masuk'] ?? date('Y-m-d')));
        $dueDay = max(1, min(28, (int)($body['tanggal_jatuh_tempo'] ?? 5)));
        $catatan = trim((string)($body['catatan'] ?? ''));

        if ($unitId <= 0 || $nama === '') {
            jsonResponse(['success' => false, 'message' => 'Unit kontrakan dan nama penghuni wajib diisi.'], 422);
        }

        $unitStmt = $pdo->prepare("SELECT id, nomor_unit, harga_bulanan FROM units WHERE id = ?");
        $unitStmt->execute([$unitId]);
        $unit = $unitStmt->fetch();
        if (!$unit) {
            jsonResponse(['success' => false, 'message' => 'Unit tidak ditemukan.'], 404);
        }

        $pdo->beginTransaction();

        // Cek apakah sudah ada penghuni aktif di unit ini
        $activeStmt = $pdo->prepare("SELECT id FROM tenants WHERE unit_id = ? AND status = 'aktif' LIMIT 1");
        $activeStmt->execute([$unitId]);
        $activeTenant = $activeStmt->fetch();

        if ($activeTenant && empty($body['replace_tenant'])) {
            $tenantId = (int)$activeTenant['id'];
            $upd = $pdo->prepare("
                UPDATE tenants
                SET nama_penghuni = ?, no_hp = ?, tanggal_masuk = ?, tanggal_jatuh_tempo = ?, catatan = ?
                WHERE id = ?
            ");
            $upd->execute([$nama, $noHp, $tglMasuk, $dueDay, $catatan, $tenantId]);

            // Update juga jadwal jatuh tempo bulan ini jika belum lunas
            $currentPeriod = date('Y-m');
            $newDueDate = buildDueDateForPeriod($currentPeriod, $dueDay);
            $updPay = $pdo->prepare("
                UPDATE payments SET jatuh_tempo = ?
                WHERE unit_id = ? AND tenant_id = ? AND periode_bulan = ? AND status != 'lunas'
            ");
            $updPay->execute([$newDueDate, $unitId, $tenantId, $currentPeriod]);
        } else {
            if ($activeTenant) {
                $pdo->prepare("UPDATE tenants SET status = 'keluar', tanggal_keluar = CURDATE() WHERE id = ?")
                    ->execute([(int)$activeTenant['id']]);
            }

            $ins = $pdo->prepare("
                INSERT INTO tenants (unit_id, nama_penghuni, no_hp, tanggal_masuk, tanggal_jatuh_tempo, status, catatan)
                VALUES (?, ?, ?, ?, ?, 'aktif', ?)
            ");
            $ins->execute([$unitId, $nama, $noHp, $tglMasuk, $dueDay, $catatan]);
            $tenantId = (int)$pdo->lastInsertId();

            // Buat otomatis jadwal tagihan bulan berjalan
            $currentPeriod = date('Y-m');
            $dueDate = buildDueDateForPeriod($currentPeriod, $dueDay);
            $payStatus = (date('Y-m-d') > $dueDate) ? 'telat' : 'belum_bayar';

            $payIns = $pdo->prepare("
                INSERT IGNORE INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, status, catatan)
                VALUES (?, ?, ?, ?, ?, ?, 'Jadwal otomatis saat penghuni masuk')
            ");
            $payIns->execute([$unitId, $tenantId, $currentPeriod, $dueDate, (int)$unit['harga_bulanan'], $payStatus]);
        }

        // Pastikan status unit = terisi
        $pdo->prepare("UPDATE units SET status = 'terisi' WHERE id = ?")->execute([$unitId]);
        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => "Penghuni {$nama} berhasil disimpan pada Kontrakan #{$unit['nomor_unit']}.",
            'penghuni_publik' => maskTenantName($nama),
        ]);
    }

    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(['success' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500);
}
