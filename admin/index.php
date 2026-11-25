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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Dashboard Admin — Kontrakan Teh Amoy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="../assets/css/app.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-[100dvh] flex">

  <!-- Backdrop for Mobile/Tablet Slide-Over Sidebar -->
  <div id="admin-backdrop" class="hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] lg:hidden"></div>

  <!-- Sidebar Navigation (Slide-over on Mobile/Tablet | Persistent on Desktop) -->
  <aside id="admin-sidebar"
    class="fixed lg:sticky lg:top-0 lg:h-[100dvh] inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-900 border-r border-white/10 flex flex-col transition-transform duration-200 ease-out -translate-x-full lg:translate-x-0 shrink-0">
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
      <button id="btn-close-nav" type="button" class="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <nav class="flex-1 p-3 space-y-1.5 overflow-y-auto">
      <button type="button" data-tab="overview"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 transition">
        <i class="fa-solid fa-chart-pie w-5 text-center"></i>
        <span>Ringkasan</span>
      </button>
      <button type="button" data-tab="units"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-building w-5 text-center"></i>
        <span>Kontrakan & Harga</span>
      </button>
      <button type="button" data-tab="tenants"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-users w-5 text-center"></i>
        <span>Data Penghuni</span>
      </button>
      <button type="button" data-tab="payments"
        class="nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition">
        <i class="fa-solid fa-calendar-check w-5 text-center"></i>
        <span>Jadwal Pembayaran</span>
      </button>
    </nav>

    <div class="p-4 border-t border-white/10 space-y-2 safe-bottom">
      <a href="../index.php" target="_blank"
        class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition">
        <i class="fa-solid fa-cube"></i>
        <span>Buka Tampilan 3D User</span>
      </a>
      <div class="flex items-center justify-between px-2 pt-2">
        <div class="text-xs min-w-0">
          <div class="font-bold text-white truncate max-w-[155px]"><?= $adminNama ?></div>
          <div class="text-[11px] text-slate-400">Administrator</div>
        </div>
        <button id="btn-logout" type="button" title="Logout"
          class="p-2.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- Main Workspace -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Responsive Sticky Header -->
    <header class="sticky top-0 z-30 bg-slate-950/88 backdrop-blur-md border-b border-white/10 px-3.5 sm:px-6 lg:px-8 py-3 sm:py-4">
      <div class="flex items-center justify-between gap-2.5 sm:gap-4">
        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button id="btn-open-nav" type="button" aria-label="Menu"
            class="lg:hidden w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center shrink-0 transition">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="min-w-0">
            <h1 id="page-title" class="text-base sm:text-lg font-extrabold text-white truncate">Ringkasan Kontrakan</h1>
            <p id="page-subtitle" class="hidden sm:block text-xs text-slate-400 truncate">Pantau status kontrakan, penghuni, dan pembayaran secara real-time</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <div class="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-white/10 rounded-xl px-2.5 sm:px-3 py-2">
            <i class="fa-regular fa-calendar text-sky-400 text-xs"></i>
            <input id="global-periode" type="month" value="<?= $currentMonth ?>"
              class="bg-transparent text-xs font-semibold text-white focus:outline-none w-[112px] sm:w-auto">
          </div>
          <button id="btn-open-add-unit" type="button"
            class="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition">
            <i class="fa-solid fa-plus"></i>
            <span class="hidden md:inline">Tambah Kontrakan</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Content Container (extra bottom padding on Mobile/Tablet for Bottom Tab Bar) -->
    <main class="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-5 sm:space-y-6">

      <!-- TAB 1: OVERVIEW -->
      <section id="tab-overview" class="tab-panel space-y-5 sm:space-y-6">
        <!-- KPI Cards: 2x2 on Mobile/Tablet, 4-col on Desktop -->
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] sm:text-xs font-semibold text-slate-400">Total Unit</span>
              <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-house text-xs sm:text-sm"></i></span>
            </div>
            <div id="kpi-total-units" class="text-xl sm:text-2xl font-extrabold text-white mt-2.5 sm:mt-3">-</div>
            <div id="kpi-occupancy-sub" class="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">- terisi • - kosong</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] sm:text-xs font-semibold text-slate-400">Lunas Bulan Ini</span>
              <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-wallet text-xs sm:text-sm"></i></span>
            </div>
            <div id="kpi-paid-amount" class="text-lg sm:text-2xl font-extrabold text-emerald-400 mt-2.5 sm:mt-3 truncate">Rp 0</div>
            <div id="kpi-paid-count" class="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">0 unit lunas</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] sm:text-xs font-semibold text-slate-400">Belum / Telat</span>
              <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-clock text-xs sm:text-sm"></i></span>
            </div>
            <div id="kpi-unpaid-amount" class="text-lg sm:text-2xl font-extrabold text-amber-400 mt-2.5 sm:mt-3 truncate">Rp 0</div>
            <div id="kpi-unpaid-count" class="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">0 belum • 0 telat</div>
          </div>

          <div class="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] sm:text-xs font-semibold text-slate-400">Potensi / Bln</span>
              <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-coins text-xs sm:text-sm"></i></span>
            </div>
            <div id="kpi-potential" class="text-lg sm:text-2xl font-extrabold text-white mt-2.5 sm:mt-3 truncate">Rp 0</div>
            <div class="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">Jika semua terisi</div>
          </div>
        </div>

        <!-- Two Columns on Desktop, Stacked cleanly on Mobile/Tablet -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
          <div class="xl:col-span-7 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-2">
              <div>
                <h2 class="font-bold text-white text-sm">Tagihan Perlu Perhatian</h2>
                <p class="text-[11px] sm:text-xs text-slate-400 mt-0.5">Belum bayar atau lewat jatuh tempo</p>
              </div>
              <button type="button" data-goto-tab="payments" class="text-xs font-semibold text-sky-400 hover:text-sky-300 shrink-0">
                Lihat Semua →
              </button>
            </div>
            <div id="overview-pending-list" class="divide-y divide-white/10"></div>
          </div>

          <div class="xl:col-span-5 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-4 sm:p-5 border-b border-white/10">
              <h2 class="font-bold text-white text-sm">Peta Cepat Unit Kontrakan</h2>
              <p class="text-[11px] sm:text-xs text-slate-400 mt-0.5">Ketuk unit untuk ubah harga atau detail</p>
            </div>
            <div id="overview-units-grid" class="p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5"></div>
          </div>
        </div>
      </section>

      <!-- TAB 2: KONTRAKAN & HARGA -->
      <section id="tab-units" class="tab-panel hidden space-y-4">
        <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Manajemen Unit & Harga Sewa</h2>
              <p class="text-xs text-slate-400 mt-0.5">Perubahan harga, posisi blok, dan penambahan unit baru langsung sinkron ke 3D.</p>
            </div>
            <button type="button" id="btn-add-unit-secondary"
              class="w-full sm:w-auto justify-center bg-sky-500 hover:bg-sky-400 text-white px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0">
              <i class="fa-solid fa-plus"></i>
              <span>Tambah Kontrakan Baru</span>
            </button>
          </div>

          <!-- Mobile Card List (< 768px) -->
          <div id="units-mobile-cards" class="md:hidden p-3.5 space-y-3"></div>

          <!-- Tablet & Desktop Table (>= 768px) -->
          <div class="hidden md:block overflow-x-auto">
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
          <div class="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Daftar Penghuni Kontrakan</h2>
              <p class="text-xs text-slate-400 mt-0.5">Nama lengkap hanya di Admin. Tampilan 3D publik otomatis memakai nama depan + inisial.</p>
            </div>
            <div class="flex items-center gap-2">
              <select id="tenant-status-filter" class="flex-1 sm:flex-none bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 sm:py-2 text-xs text-white focus:outline-none">
                <option value="aktif">Penghuni Aktif</option>
                <option value="keluar">Riwayat Keluar</option>
                <option value="all">Semua</option>
              </select>
              <button type="button" id="btn-assign-tenant-top"
                class="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0">
                <i class="fa-solid fa-user-plus"></i>
                <span>Tambah</span>
              </button>
            </div>
          </div>

          <!-- Mobile Card List (< 768px) -->
          <div id="tenants-mobile-cards" class="md:hidden p-3.5 space-y-3"></div>

          <!-- Tablet & Desktop Table (>= 768px) -->
          <div class="hidden md:block overflow-x-auto">
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
          <div class="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-white text-base">Jadwal & Status Pembayaran</h2>
              <p class="text-xs text-slate-400 mt-0.5">Kelola jatuh tempo per nomor kontrakan, tandai lunas, dan kirim pengingat WhatsApp.</p>
            </div>
            <div class="flex items-center gap-2">
              <select id="payment-status-filter" class="flex-1 sm:flex-none bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 sm:py-2 text-xs text-white focus:outline-none">
                <option value="all">Semua Status</option>
                <option value="telat">Telat</option>
                <option value="belum_bayar">Belum Bayar</option>
                <option value="lunas">Lunas</option>
              </select>
              <button type="button" id="btn-generate-payments"
                class="bg-sky-500 hover:bg-sky-400 text-white px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Generate</span>
              </button>
            </div>
          </div>

          <!-- Mobile Card List (< 768px) -->
          <div id="payments-mobile-cards" class="md:hidden p-3.5 space-y-3"></div>

          <!-- Tablet & Desktop Table (>= 768px) -->
          <div class="hidden md:block overflow-x-auto">
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

  <!-- Mobile & Tablet Bottom Tab Navigation Bar (< 1024px) -->
  <nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 safe-bottom-bar">
    <div class="grid grid-cols-4 gap-1 max-w-lg mx-auto">
      <button type="button" data-tab="overview" class="bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-sky-400 bg-sky-500/15 transition">
        <i class="fa-solid fa-chart-pie text-sm"></i>
        <span class="text-[10px] font-bold mt-1">Ringkasan</span>
      </button>
      <button type="button" data-tab="units" class="bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-400 hover:text-white transition">
        <i class="fa-solid fa-building text-sm"></i>
        <span class="text-[10px] font-semibold mt-1">Unit</span>
      </button>
      <button type="button" data-tab="tenants" class="bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-400 hover:text-white transition">
        <i class="fa-solid fa-users text-sm"></i>
        <span class="text-[10px] font-semibold mt-1">Penghuni</span>
      </button>
      <button type="button" data-tab="payments" class="bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-400 hover:text-white transition">
        <i class="fa-solid fa-calendar-check text-sm"></i>
        <span class="text-[10px] font-semibold mt-1">Bayar</span>
      </button>
    </div>
  </nav>

  <!-- MODAL: TAMBAH / EDIT UNIT KONTRAKAN (Bottom sheet on mobile, centered on tablet/desktop) -->
  <div id="modal-unit" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div class="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
      <div class="sm:hidden flex justify-center pt-2.5">
        <span class="w-10 h-1.5 rounded-full bg-white/20"></span>
      </div>
      <div class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 id="modal-unit-title" class="font-bold text-white text-base">Tambah Kontrakan Baru</h3>
        <button type="button" data-close-modal="modal-unit" class="text-slate-400 hover:text-white p-1.5"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-unit" class="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
        <input type="hidden" id="unit-id">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <input id="unit-ukuran" type="text" value="3.5 x 7 m"
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
          <input id="unit-fasilitas" type="text" placeholder="Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam"
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
          <button type="button" data-close-modal="modal-unit" class="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white shadow-lg shadow-sky-500/20">Simpan Unit</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: ASSIGN / EDIT PENGHUNI -->
  <div id="modal-tenant" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div class="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
      <div class="sm:hidden flex justify-center pt-2.5">
        <span class="w-10 h-1.5 rounded-full bg-white/20"></span>
      </div>
      <div class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 id="modal-tenant-title" class="font-bold text-white text-base">Atur Penghuni Kontrakan</h3>
        <button type="button" data-close-modal="modal-tenant" class="text-slate-400 hover:text-white p-1.5"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-tenant" class="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">No. HP / WhatsApp</label>
            <input id="tenant-hp" type="tel" placeholder="0812xxxxxxxx"
              class="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Tgl Jatuh Tempo (1-28) *</label>
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
          <button type="button" data-close-modal="modal-tenant" class="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white shadow-lg shadow-emerald-500/20">Simpan Penghuni</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: EDIT JADWAL & STATUS PEMBAYARAN -->
  <div id="modal-payment" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div class="bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
      <div class="sm:hidden flex justify-center pt-2.5">
        <span class="w-10 h-1.5 rounded-full bg-white/20"></span>
      </div>
      <div class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 class="font-bold text-white text-base">Atur Jadwal & Pembayaran</h3>
        <button type="button" data-close-modal="modal-payment" class="text-slate-400 hover:text-white p-1.5"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="form-payment" class="p-5 sm:p-6 space-y-4 overflow-y-auto safe-bottom">
        <input type="hidden" id="pay-id">
        <div id="pay-header-info" class="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300"></div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <button type="button" data-close-modal="modal-payment" class="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200">Batal</button>
          <button type="submit" class="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white">Simpan Jadwal</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Container (Positioned above mobile bottom tab bar on small screens) -->
  <div id="toast-container" class="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 space-y-2 pointer-events-none"></div>

  <script src="../assets/js/admin-app.js"></script>
</body>
</html>
