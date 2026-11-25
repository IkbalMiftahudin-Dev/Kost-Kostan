<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

$adminNama = htmlspecialchars((string)($_SESSION['admin_nama'] ?? 'Admin'), ENT_QUOTES, 'UTF-8');
$currentMonth = date('Y-m');
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Admin — Kontrakan Teh Amoy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="../assets/css/app.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex">

  <!-- Sidebar Navigation -->
  <aside id="admin-sidebar"
    class="fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-white/10 flex flex-col transition-transform duration-200 -translate-x-full lg:translate-x-0">
    <div class="p-5 border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
          <i class="fa-solid fa-house-chimney-user"></i>
        </div>
        <div>
          <div class="font-extrabold text-sm text-white leading-tight">Kontrakan Teh Amoy</div>
          <div class="text-[11px] text-sky-400 font-medium">Admin Management</div>
        </div>
      </div>
      <button id="btn-close-nav" type="button" class="lg:hidden text-slate-400 hover:text-white">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <nav class="flex-1 p-3 space-y-1.5">
      <button type="button" data-tab="overview"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 transition">
        <i class="fa-solid fa-chart-pie w-5 text-center"></i>
        <span>Ringkasan</span>
      </button>
      <button type="button" data-tab="units"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-building w-5 text-center"></i>
        <span>Kontrakan & Harga</span>
      </button>
      <button type="button" data-tab="tenants"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-users w-5 text-center"></i>
        <span>Data Penghuni</span>
      </button>
      <button type="button" data-tab="payments"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-calendar-check w-5 text-center"></i>
        <span>Jadwal Pembayaran</span>
      </button>
    </nav>

    <div class="p-4 border-t border-white/10 space-y-2">
      <a href="../index.php" target="_blank"
        class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition">
        <i class="fa-solid fa-cube"></i>
        <span>Buka Tampilan 3D User</span>
      </a>
      <div class="flex items-center justify-between px-2 pt-2">
        <div class="text-xs">
          <div class="font-bold text-white truncate max-w-[140px]"><?= $adminNama ?></div>
          <div class="text-[11px] text-slate-400">Administrator</div>
        </div>
        <button id="btn-logout" type="button" title="Logout"
          class="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- Main Workspace -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top Bar -->
    <header class="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button id="btn-open-nav" type="button" class="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div>
          <h1 id="page-title" class="text-lg font-extrabold text-white">Ringkasan Kontrakan</h1>
          <p id="page-subtitle" class="text-xs text-slate-400">Pantau status kontrakan, penghuni, dan pembayaran secara real-time</p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5">
          <i class="fa-regular fa-calendar text-sky-400 text-xs"></i>
          <input id="global-periode" type="month" value="<?= $currentMonth ?>"
            class="bg-transparent text-xs font-semibold text-white focus:outline-none">
        </div>
        <button id="btn-open-add-unit" type="button"
          class="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition">
          <i class="fa-solid fa-plus"></i>
          <span class="hidden sm:inline">Tambah Kontrakan</span>
        </button>
      </div>
    </header>

    <!-- Content Container -->
    <main class="flex-1 p-4 lg:p-8 space-y-6 overflow-y-auto">

      <!-- TAB 1: OVERVIEW -->
      <section id="tab-overview" class="tab-panel space-y-6">
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400">Total Kontrakan</span>
              <span class="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center"><i class="fa-solid fa-house"></i></span>
            </div>
            <div id="kpi-total-units" class="text-2xl font-extrabold text-white mt-3">-</div>
            <div id="kpi-occupancy-sub" class="text-xs text-slate-400 mt-1">- terisi • - kosong</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400">Pemasukan Lunas</span>
              <span class="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><i class="fa-solid fa-wallet"></i></span>
            </div>
            <div id="kpi-paid-amount" class="text-2xl font-extrabold text-emerald-400 mt-3">Rp 0</div>
            <div id="kpi-paid-count" class="text-xs text-slate-400 mt-1">0 unit sudah lunas</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400">Belum Dibayar / Telat</span>
              <span class="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center"><i class="fa-solid fa-clock"></i></span>
            </div>
            <div id="kpi-unpaid-amount" class="text-2xl font-extrabold text-amber-400 mt-3">Rp 0</div>
            <div id="kpi-unpaid-count" class="text-xs text-slate-400 mt-1">0 belum • 0 telat</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400">Potensi Bulanan</span>
              <span class="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center"><i class="fa-solid fa-coins"></i></span>
            </div>
            <div id="kpi-potential" class="text-2xl font-extrabold text-white mt-3">Rp 0</div>
            <div class="text-xs text-slate-400 mt-1">Jika seluruh unit terisi</div>
          </div>
        </div>

        <!-- Two Columns: Pending Payments & Quick Unit Status Map -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div class="xl:col-span-7 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 class="font-bold text-white text-sm">Tagihan Perlu Perhatian</h2>
                <p class="text-xs text-slate-400 mt-0.5">Daftar kontrakan yang belum bayar atau melewati jatuh tempo</p>
              </div>
              <button type="button" data-goto-tab="payments" class="text-xs font-semibold text-sky-400 hover:text-sky-300">
                Lihat Semua →
              </button>
            </div>
            <div id="overview-pending-list" class="divide-y divide-white/10"></div>
          </div>

          <div class="xl:col-span-5 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 class="font-bold text-white text-sm">Peta Cepat Unit Kontrakan</h2>
                <p class="text-xs text-slate-400 mt-0.5">Klik unit untuk ubah harga atau atur penghuni</p>
              </div>
            </div>
            <div id="overview-units-grid" class="p-4 grid grid-cols-3 gap-2.5"></div>
          </div>
        </div>
      </section>

      <!-- TAB 2: KONTRAKAN & HARGA -->
      <section id="tab-units" class="tab-panel hidden space-y-4">
        <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Manajemen Unit & Harga Sewa</h2>
              <p class="text-xs text-slate-400 mt-0.5">Setiap perubahan harga, penghuni, atau penambahan kontrakan baru langsung tersinkron ke tampilan 3D.</p>
            </div>
            <button type="button" id="btn-add-unit-secondary"
              class="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
              <i class="fa-solid fa-plus"></i>
              <span>Tambah Kontrakan Baru</span>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th class="px-5 py-3.5">No. & Nama Unit</th>
                  <th class="px-4 py-3.5">Posisi 3D</th>
                  <th class="px-4 py-3.5">Status</th>
                  <th class="px-4 py-3.5">Penghuni</th>
                  <th class="px-4 py-3.5">Harga / Bulan</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="units-table-body" class="divide-y divide-white/10"></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 3: DATA PENGHUNI -->
      <section id="tab-tenants" class="tab-panel hidden space-y-4">
        <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Daftar Penghuni Kontrakan</h2>
              <p class="text-xs text-slate-400 mt-0.5">Nama lengkap hanya tampil di Admin. Halaman publik otomatis hanya menampilkan nama depan + inisial.</p>
            </div>
            <div class="flex items-center gap-2">
              <select id="tenant-status-filter" class="bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                <option value="aktif">Penghuni Aktif</option>
                <option value="keluar">Riwayat Keluar</option>
                <option value="all">Semua</option>
              </select>
              <button type="button" id="btn-assign-tenant-top"
                class="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                <i class="fa-solid fa-user-plus"></i>
                <span>Tambah Penghuni</span>
              </button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th class="px-5 py-3.5">Kontrakan</th>
                  <th class="px-4 py-3.5">Nama Lengkap (Admin)</th>
                  <th class="px-4 py-3.5">Tampilan Publik 3D</th>
                  <th class="px-4 py-3.5">No. HP / WA</th>
                  <th class="px-4 py-3.5">Tgl Masuk & Jatuh Tempo</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="tenants-table-body" class="divide-y divide-white/10"></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 4: JADWAL PEMBAYARAN -->
      <section id="tab-payments" class="tab-panel hidden space-y-4">
        <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Jadwal & Status Pembayaran Bulanan</h2>
              <p class="text-xs text-slate-400 mt-0.5">Kelola jadwal jatuh tempo tiap nomor kontrakan, tandai lunas, atau kirim pengingat WhatsApp.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select id="payment-status-filter" class="bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                <option value="all">Semua Status</option>
                <option value="telat">Telat</option>
                <option value="belum_bayar">Belum Bayar</option>
                <option value="lunas">Lunas</option>
              </select>
              <button type="button" id="btn-generate-payments"
                class="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Generate Jadwal Bulan Ini</span>
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th class="px-5 py-3.5">Unit & Penghuni</th>
                  <th class="px-4 py-3.5">Periode</th>
                  <th class="px-4 py-3.5">Jatuh Tempo</th>
                  <th class="px-4 py-3.5">Nominal</th>
                  <th class="px-4 py-3.5">Status</th>
                  <th class="px-4 py-3.5">Tgl Bayar</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="payments-table-body" class="divide-y divide-white/10"></tbody>
            </table>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- MODAL: TAMBAH / EDIT UNIT KONTRAKAN -->
  <div id="modal-unit" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 id="modal-unit-title" class="font-bold text-white text-base">Tambah Kontrakan Baru</h3>
        <button type="button" data-close-modal="modal-unit" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-unit" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <input type="hidden" id="unit-id">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nomor Kontrakan *</label>
            <input id="unit-nomor" type="number" min="1" required
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Harga Sewa / Bulan (Rp) *</label>
            <input id="unit-harga" type="number" min="0" step="10000" required
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Nama Unit</label>
          <input id="unit-nama" type="text" placeholder="Contoh: Kontrakan 10"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Posisi Bangunan 3D</label>
            <select id="unit-layout-pos" class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
              <option value="memanjang_4:1">Blok A: Deret 4 Memanjang (Lt. 1)</option>
              <option value="memanjang_2:1">Blok B: Deret 2 Terpisah (Lt. 1)</option>
              <option value="bertingkat:1">Blok C: Gedung Bertingkat (Lt. 1 / Bawah)</option>
              <option value="bertingkat:2">Blok C: Gedung Bertingkat (Lt. 2 / Atas)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Ukuran & Warna Aksen 3D</label>
            <div class="flex gap-2">
              <input id="unit-ukuran" type="text" value="3.5 x 6 m"
                class="flex-1 bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
              <input id="unit-warna" type="color" value="#2563eb" title="Warna Aksen Interior 3D"
                class="w-11 h-10 bg-slate-950 border border-white/15 rounded-xl p-1 cursor-pointer">
            </div>
          </div>
        </div>

        <div id="unit-status-wrap">
          <label class="block text-xs font-semibold text-slate-300 mb-1">Status Unit</label>
          <select id="unit-status" class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
            <option value="kosong">Kosong (Tersedia)</option>
            <option value="terisi">Terisi</option>
            <option value="maintenance">Sedang Perbaikan (Maintenance)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Fasilitas (pisahkan dengan koma)</label>
          <input id="unit-fasilitas" type="text" placeholder="Kamar Mandi Dalam, Dapur Mini, Token Listrik 1300W"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Deskripsi</label>
          <textarea id="unit-deskripsi" rows="2" placeholder="Keterangan singkat unit kontrakan..."
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-400"></textarea>
        </div>

        <label id="sync-price-wrap" class="hidden flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input id="unit-sync-price" type="checkbox" checked class="rounded bg-slate-950 border-white/20 text-sky-500">
          <span>Ikut perbarui nominal tagihan bulan ini yang belum lunas</span>
        </label>

        <div class="pt-2 flex justify-end gap-2">
          <button type="button" data-close-modal="modal-unit" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white shadow-lg shadow-sky-500/20">Simpan Unit</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: ASSIGN / EDIT PENGHUNI -->
  <div id="modal-tenant" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 id="modal-tenant-title" class="font-bold text-white text-base">Atur Penghuni Kontrakan</h3>
        <button type="button" data-close-modal="modal-tenant" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-tenant" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Pilih Nomor Kontrakan *</label>
          <select id="tenant-unit-id" required class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"></select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap Penghuni *</label>
          <input id="tenant-nama" type="text" required placeholder="Contoh: Ahmad Fauzi"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          <p class="text-[11px] text-slate-400 mt-1">Di halaman publik 3D otomatis disamarkan menjadi nama depan + inisial.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">No. HP / WhatsApp</label>
            <input id="tenant-hp" type="text" placeholder="0812xxxxxxxx"
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Tgl Jatuh Tempo Rutin (1-28) *</label>
            <input id="tenant-due-day" type="number" min="1" max="28" value="5" required
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Tanggal Masuk</label>
          <input id="tenant-tgl-masuk" type="date" value="<?= date('Y-m-d') ?>"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Catatan</label>
          <input id="tenant-catatan" type="text" placeholder="Contoh: Kerja shift pagi, bawa 1 motor"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>
        <div class="pt-2 flex justify-end gap-2">
          <button type="button" data-close-modal="modal-tenant" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white shadow-lg shadow-emerald-500/20">Simpan Penghuni</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: EDIT JADWAL & STATUS PEMBAYARAN -->
  <div id="modal-payment" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 class="font-bold text-white text-base">Atur Jadwal & Pembayaran</h3>
        <button type="button" data-close-modal="modal-payment" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-payment" class="p-6 space-y-4">
        <input type="hidden" id="pay-id">
        <div id="pay-header-info" class="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300"></div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Tanggal Jatuh Tempo *</label>
            <input id="pay-due-date" type="date" required
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nominal Tagihan (Rp) *</label>
            <input id="pay-nominal" type="number" min="0" step="10000" required
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
        </div>

        <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input id="pay-sync-due" type="checkbox" class="rounded bg-slate-950 border-white/20 text-sky-500">
          <span>Jadikan tanggal ini sebagai jadwal jatuh tempo rutin tiap bulan</span>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Status Pembayaran</label>
            <select id="pay-status" class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
              <option value="belum_bayar">Belum Bayar</option>
              <option value="lunas">Lunas</option>
              <option value="telat">Telat</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Metode Pembayaran</label>
            <select id="pay-metode" class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
              <option value="Tunai">Tunai</option>
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Transfer BRI">Transfer BRI</option>
              <option value="Transfer Mandiri">Transfer Mandiri</option>
              <option value="QRIS / E-Wallet">QRIS / E-Wallet</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Tanggal Bayar (jika Lunas)</label>
          <input id="pay-paid-date" type="date"
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Catatan</label>
          <input id="pay-catatan" type="text" placeholder="Catatan pembayaran..."
            class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button type="button" data-close-modal="modal-payment" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white">Simpan Jadwal</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Container -->
  <div id="toast-container" class="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none"></div>

  <script src="../assets/js/admin-app.js"></script>
</body>
</html>
