<?php
declare(strict_types=1);

/**
 * Helper umum: Session, JSON Response, Auth Guard, dan Masking Privasi Nama Penghuni
 */

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody(): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $raw = file_get_contents('php://input');
    if (!$raw) {
        $cached = [];
        return $cached;
    }
    $decoded = json_decode($raw, true);
    $cached = is_array($decoded) ? $decoded : [];
    return $cached;
}

/**
 * Mendukung HTTP Method Override (POST + _method: PUT/DELETE) agar 100% kompatibel
 * di shared hosting seperti InfinityFree yang sering memblokir PUT/DELETE.
 */
function getEffectiveMethod(): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method === 'POST') {
        $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '';
        if ($override === '') {
            $body = getJsonBody();
            $override = (string)($body['_method'] ?? ($_POST['_method'] ?? ''));
        }
        $override = strtoupper(trim($override));
        if (in_array($override, ['PUT', 'DELETE', 'PATCH'], true)) {
            return $override;
        }
    }
    return $method;
}

function isAdminLoggedIn(): bool
{
    startSecureSession();
    return !empty($_SESSION['admin_id']);
}

function requireAdminApi(): array
{
    startSecureSession();
    if (empty($_SESSION['admin_id'])) {
        jsonResponse([
            'success' => false,
            'message' => 'Akses ditolak. Silakan login sebagai admin terlebih dahulu.'
        ], 401);
    }
    return [
        'id' => (int)$_SESSION['admin_id'],
        'username' => (string)($_SESSION['admin_username'] ?? ''),
        'nama_lengkap' => (string)($_SESSION['admin_nama'] ?? 'Admin'),
    ];
}

/**
 * Privasi Halaman Publik: Tampilkan nama depan + inisial nama belakang saja.
 * Contoh:
 *  - "Ahmad Fauzi"         -> "Ahmad F."
 *  - "Siti Nur Rahmawati"  -> "Siti R."
 *  - "Budi"                -> "Budi"
 */
function maskTenantName(?string $fullName): ?string
{
    if ($fullName === null) {
        return null;
    }
    $clean = trim(preg_replace('/\s+/', ' ', $fullName));
    if ($clean === '') {
        return null;
    }
    $parts = explode(' ', $clean);
    if (count($parts) === 1) {
        return $parts[0];
    }
    $firstName = $parts[0];
    $lastWord = end($parts);
    $initial = function_exists('mb_substr')
        ? mb_strtoupper(mb_substr($lastWord, 0, 1, 'UTF-8'), 'UTF-8')
        : strtoupper(substr($lastWord, 0, 1));
    return $firstName . ' ' . $initial . '.';
}

function buildDueDateForPeriod(string $periodeBulan, int $dueDay): string
{
    if (!preg_match('/^(\d{4})-(\d{2})$/', $periodeBulan, $m)) {
        $year = (int)date('Y');
        $month = (int)date('m');
    } else {
        $year = (int)$m[1];
        $month = (int)$m[2];
    }
    $maxDay = (int)date('t', mktime(0, 0, 0, $month, 1, $year));
    $day = max(1, min($dueDay, $maxDay));
    return sprintf('%04d-%02d-%02d', $year, $month, $day);
}
