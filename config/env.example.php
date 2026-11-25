<?php
/**
 * Template Konfigurasi Database untuk Hosting (InfinityFree / cPanel)
 *
 * Cara pakai di InfinityFree:
 * 1. Salin file ini menjadi `config/env.php` di folder `htdocs/config/` hosting Anda.
 * 2. Isi 5 nilai di bawah ini sesuai halaman "MySQL Databases" di panel InfinityFree.
 * 3. File `config/env.php` sudah masuk .gitignore sehingga aman & tidak ikut ter-push ke GitHub.
 */

return [
    'DB_HOST' => 'sqlXXX.infinityfree.com',       // Ganti dengan MySQL Hostname dari InfinityFree
    'DB_PORT' => '3306',
    'DB_NAME' => 'if0_XXXXXXXX_kontrakan',        // Ganti dengan MySQL Database Name
    'DB_USER' => 'if0_XXXXXXXX',                  // Ganti dengan MySQL Username
    'DB_PASS' => 'ISI_PASSWORD_VPANEL_DISINI',    // Ganti dengan MySQL / vPanel Password
];
