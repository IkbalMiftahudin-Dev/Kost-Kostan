<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

startSecureSession();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        if (isAdminLoggedIn()) {
            jsonResponse([
                'success' => true,
                'authenticated' => true,
                'admin' => [
                    'id' => (int)$_SESSION['admin_id'],
                    'username' => (string)$_SESSION['admin_username'],
                    'nama_lengkap' => (string)$_SESSION['admin_nama'],
                ],
            ]);
        }
        jsonResponse(['success' => true, 'authenticated' => false]);
    }

    if ($method === 'POST') {
        $body = getJsonBody();
        $action = $body['action'] ?? 'login';

        if ($action === 'logout') {
            $_SESSION = [];
            session_destroy();
            jsonResponse(['success' => true, 'message' => 'Berhasil logout.']);
        }

        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($username === '' || $password === '') {
            jsonResponse(['success' => false, 'message' => 'Username dan password wajib diisi.'], 422);
        }

        $pdo = getDB();
        $stmt = $pdo->prepare("SELECT id, username, password_hash, nama_lengkap FROM admins WHERE username = ? LIMIT 1");
        $stmt->execute([$username]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            jsonResponse(['success' => false, 'message' => 'Username atau password salah.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int)$admin['id'];
        $_SESSION['admin_username'] = $admin['username'];
        $_SESSION['admin_nama'] = $admin['nama_lengkap'];

        jsonResponse([
            'success' => true,
            'message' => 'Login berhasil.',
            'admin' => [
                'id' => (int)$admin['id'],
                'username' => $admin['username'],
                'nama_lengkap' => $admin['nama_lengkap'],
            ],
        ]);
    }

    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Terjadi kesalahan koneksi database. Pastikan MySQL di XAMPP menyala.',
        'error' => $e->getMessage(),
    ], 500);
}
