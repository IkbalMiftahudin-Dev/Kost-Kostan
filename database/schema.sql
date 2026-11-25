-- Database Schema: Kontrakan Teh Amoy
-- Compatible with MySQL / MariaDB (XAMPP)

CREATE DATABASE IF NOT EXISTS `kontrakan_teh_amoy`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `kontrakan_teh_amoy`;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `nama_lengkap` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_id` INT UNSIGNED NOT NULL,
  `nama_penghuni` VARCHAR(120) NOT NULL,
  `no_hp` VARCHAR(30) NULL,
  `tanggal_masuk` DATE NOT NULL,
  `tanggal_keluar` DATE NULL,
  `tanggal_jatuh_tempo` TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Tanggal jatuh tempo setiap bulan (1-28)',
  `status` ENUM('aktif', 'keluar') NOT NULL DEFAULT 'aktif',
  `catatan` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tenants_unit_status` (`unit_id`, `status`),
  CONSTRAINT `fk_tenants_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_id` INT UNSIGNED NOT NULL,
  `tenant_id` INT UNSIGNED NOT NULL,
  `periode_bulan` CHAR(7) NOT NULL COMMENT 'Format YYYY-MM',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
