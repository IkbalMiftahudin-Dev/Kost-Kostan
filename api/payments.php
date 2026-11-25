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
        if ($periode !== 'all' && !preg_match('/^\d{4}-\d{2}$/', $periode)) {
            $periode = date('Y-m');
        }
        $statusFilter = $_GET['status'] ?? 'all';

        // Auto-tandai 'telat' untuk tagihan belum_bayar yang sudah lewat jatuh tempo
        $pdo->exec("UPDATE payments SET status = 'telat' WHERE status = 'belum_bayar' AND jatuh_tempo < CURDATE()");

        $sql = "
            SELECT
                p.*,
                u.nomor_unit,
                u.nama_unit,
                u.harga_bulanan,
                t.nama_penghuni,
                t.no_hp,
                t.tanggal_jatuh_tempo
            FROM payments p
            INNER JOIN units u ON u.id = p.unit_id
            INNER JOIN tenants t ON t.id = p.tenant_id
            WHERE 1=1
        ";
        $params = [];

        if ($periode !== 'all') {
            $sql .= " AND p.periode_bulan = ? ";
            $params[] = $periode;
        }
        if (in_array($statusFilter, ['belum_bayar', 'lunas', 'telat'], true)) {
            $sql .= " AND p.status = ? ";
            $params[] = $statusFilter;
        }

        $sql .= " ORDER BY FIELD(p.status, 'telat', 'belum_bayar', 'lunas'), p.jatuh_tempo ASC, u.nomor_unit ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $summary = [
            'total_tagihan' => 0,
            'total_lunas' => 0,
            'total_belum' => 0,
            'count_lunas' => 0,
            'count_belum' => 0,
            'count_telat' => 0,
        ];

        $payments = array_map(function (array $r) use (&$summary): array {
            $r['id'] = (int)$r['id'];
            $r['unit_id'] = (int)$r['unit_id'];
            $r['tenant_id'] = (int)$r['tenant_id'];
            $r['nomor_unit'] = (int)$r['nomor_unit'];
            $r['nominal'] = (int)$r['nominal'];
            $r['harga_bulanan'] = (int)$r['harga_bulanan'];
            $r['tanggal_jatuh_tempo'] = (int)$r['tanggal_jatuh_tempo'];

            $summary['total_tagihan'] += $r['nominal'];
            if ($r['status'] === 'lunas') {
                $summary['total_lunas'] += $r['nominal'];
                $summary['count_lunas']++;
            } else {
                $summary['total_belum'] += $r['nominal'];
                if ($r['status'] === 'telat') {
                    $summary['count_telat']++;
                } else {
                    $summary['count_belum']++;
                }
            }
            return $r;
        }, $rows);

        jsonResponse([
            'success' => true,
            'periode' => $periode,
            'summary' => $summary,
            'payments' => $payments,
        ]);
    }

    if ($method === 'POST') {
        $body = getJsonBody();
        $action = $body['action'] ?? 'generate';
        $periode = (string)($body['periode_bulan'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $periode)) {
            jsonResponse(['success' => false, 'message' => 'Format periode bulan tidak valid (harus YYYY-MM).'], 422);
        }

        if ($action === 'generate') {
            $activeRows = $pdo->query("
                SELECT t.id AS tenant_id, t.unit_id, t.tanggal_jatuh_tempo, u.harga_bulanan
                FROM tenants t
                INNER JOIN units u ON u.id = t.unit_id
                WHERE t.status = 'aktif' AND u.status = 'terisi'
            ")->fetchAll();

            $created = 0;
            $ins = $pdo->prepare("
                INSERT IGNORE INTO payments (unit_id, tenant_id, periode_bulan, jatuh_tempo, nominal, status, catatan)
                VALUES (?, ?, ?, ?, ?, ?, 'Jadwal tagihan bulanan')
            ");

            $today = date('Y-m-d');
            foreach ($activeRows as $row) {
                $dueDate = buildDueDateForPeriod($periode, (int)$row['tanggal_jatuh_tempo']);
                $status = ($today > $dueDate) ? 'telat' : 'belum_bayar';
                $ins->execute([
                    (int)$row['unit_id'],
                    (int)$row['tenant_id'],
                    $periode,
                    $dueDate,
                    (int)$row['harga_bulanan'],
                    $status,
                ]);
                if ($ins->rowCount() > 0) {
                    $created++;
                }
            }

            jsonResponse([
                'success' => true,
                'created' => $created,
                'message' => $created > 0
                    ? "Berhasil membuat {$created} jadwal pembayaran untuk periode {$periode}."
                    : "Semua penghuni aktif sudah memiliki jadwal pembayaran pada periode {$periode}.",
            ]);
        }

        jsonResponse(['success' => false, 'message' => 'Action tidak dikenali.'], 422);
    }

    if ($method === 'PUT') {
        $body = getJsonBody();
        $id = (int)($body['id'] ?? 0);
        if ($id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID pembayaran tidak valid.'], 422);
        }

        $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            jsonResponse(['success' => false, 'message' => 'Data pembayaran tidak ditemukan.'], 404);
        }

        $jatuhTempo = !empty($body['jatuh_tempo']) ? (string)$body['jatuh_tempo'] : $existing['jatuh_tempo'];
        $nominal = isset($body['nominal']) ? max(0, (int)$body['nominal']) : (int)$existing['nominal'];
        $status = in_array(($body['status'] ?? ''), ['belum_bayar', 'lunas', 'telat'], true)
            ? $body['status']
            : $existing['status'];
        $metode = isset($body['metode_bayar']) ? trim((string)$body['metode_bayar']) : $existing['metode_bayar'];
        $catatan = isset($body['catatan']) ? trim((string)$body['catatan']) : $existing['catatan'];

        if ($status === 'lunas') {
            $tglBayar = !empty($body['tanggal_bayar']) ? (string)$body['tanggal_bayar'] : ($existing['tanggal_bayar'] ?: date('Y-m-d'));
            if (!$metode) {
                $metode = 'Tunai';
            }
        } else {
            $tglBayar = null;
            // Jika status belum_bayar tapi tanggal jatuh tempo sudah lewat, otomatis tandai telat
            if ($status === 'belum_bayar' && $jatuhTempo < date('Y-m-d')) {
                $status = 'telat';
            }
        }

        $upd = $pdo->prepare("
            UPDATE payments
            SET jatuh_tempo = ?, nominal = ?, status = ?, tanggal_bayar = ?, metode_bayar = ?, catatan = ?
            WHERE id = ?
        ");
        $upd->execute([$jatuhTempo, $nominal, $status, $tglBayar, $metode, $catatan, $id]);

        // Jika admin juga ingin menyinkronkan hari jatuh tempo rutin penghuni
        if (!empty($body['sync_tenant_due_day']) && preg_match('/^\d{4}-\d{2}-(\d{2})$/', $jatuhTempo, $m)) {
            $dueDay = max(1, min(28, (int)$m[1]));
            $pdo->prepare("UPDATE tenants SET tanggal_jatuh_tempo = ? WHERE id = ?")
                ->execute([$dueDay, (int)$existing['tenant_id']]);
        }

        jsonResponse(['success' => true, 'message' => 'Jadwal & status pembayaran berhasil diperbarui.']);
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? (getJsonBody()['id'] ?? 0));
        if ($id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID pembayaran tidak valid.'], 422);
        }
        $stmt = $pdo->prepare("DELETE FROM payments WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'message' => 'Data tagihan berhasil dihapus.']);
    }

    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500);
}
