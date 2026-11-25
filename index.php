<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Kontrakan Teh Amoy — Tur 3D Interaktif</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="assets/css/app.css">

  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 overflow-hidden h-[100dvh]">

  <!-- 3D WebGL Canvas -->
  <div id="scene-container"></div>

  <!-- 3D Projected Floating Unit Labels -->
  <div id="labels-layer"></div>

  <!-- Loading Overlay -->
  <div id="loading-overlay" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/92 backdrop-blur-md transition-opacity duration-300 px-6 text-center">
    <div class="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10">
      <i class="fa-solid fa-house-chimney text-2xl text-sky-400 animate-bounce"></i>
    </div>
    <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Kontrakan Teh Amoy 3D</h1>
    <p class="text-xs sm:text-sm text-slate-400 mt-1.5">Memuat 3 blok bangunan & ruangan 3D interaktif...</p>
  </div>

  <!-- Database Error Banner -->
  <div id="error-banner" class="hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] glass-panel-strong border-rose-500/50 rounded-2xl p-4 text-rose-100 shadow-2xl">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-triangle-exclamation text-rose-400 text-lg mt-0.5"></i>
      <div class="text-xs sm:text-sm">
        <div class="font-bold text-rose-300">Gagal Terhubung ke Database</div>
        <p id="error-text" class="text-rose-100/90 mt-0.5"></p>
      </div>
    </div>
  </div>

  <!-- Backdrop for Mobile/Tablet Drawers -->
  <div id="drawer-backdrop" class="hidden fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"></div>

  <!-- Top Navigation HUD (Adaptive: Mobile / Tablet / Desktop) -->
  <header class="fixed top-3 sm:top-4 left-3 right-3 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
    <!-- Left: Sidebar Toggle (Tablet/Desktop) & Brand -->
    <div class="flex items-center gap-2 pointer-events-auto min-w-0">
      <button id="btn-toggle-sidebar" type="button"
        class="hidden sm:inline-flex glass-panel hover:bg-slate-800/90 text-white px-3.5 py-2.5 rounded-xl items-center gap-2 text-xs font-bold shadow-lg transition shrink-0">
        <i class="fa-solid fa-bars-staggered text-sky-400"></i>
        <span>Daftar Unit</span>
      </button>

      <div class="glass-panel px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl shadow-lg flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow shrink-0">
          <i class="fa-solid fa-building-user text-sm"></i>
        </div>
        <div class="min-w-0">
          <div class="text-xs sm:text-sm font-extrabold text-white leading-tight truncate">Kontrakan Teh Amoy</div>
          <!-- Compact mobile stats subtitle -->
          <div class="flex sm:hidden items-center gap-1.5 text-[10px] text-slate-300 mt-0.5">
            <span class="inline-flex items-center gap-1 text-sky-300 font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span><span id="stat-terisi-m">-</span> Terisi</span>
            <span class="text-slate-500">•</span>
            <span class="inline-flex items-center gap-1 text-emerald-300 font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span id="stat-kosong-m">-</span> Kosong</span>
          </div>
          <div class="hidden sm:block text-[11px] text-sky-300/90 truncate">Klik bangunan 3D untuk masuk ruangan</div>
        </div>
      </div>
    </div>

    <!-- Center: Occupancy Counters (Tablet & Desktop) -->
    <div class="glass-panel px-3.5 py-2 rounded-xl shadow-lg hidden md:flex items-center gap-3.5 text-xs pointer-events-auto shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="text-slate-400">Total:</span>
        <span id="stat-total" class="font-extrabold text-white text-sm">-</span>
      </div>
      <div class="w-px h-4 bg-white/15"></div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-sky-400"></span>
        <span class="text-slate-300">Terisi:</span>
        <span id="stat-terisi" class="font-extrabold text-sky-300 text-sm">-</span>
      </div>
      <div class="w-px h-4 bg-white/15"></div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="text-slate-300">Kosong:</span>
        <span id="stat-kosong" class="font-extrabold text-emerald-300 text-sm">-</span>
      </div>
    </div>

    <!-- Right: 3D Controls (Tablet/Desktop) & Admin Link (All) -->
    <div class="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
      <button id="btn-toggle-labels" type="button" title="Tampilkan/Sembunyikan Label Harga & Penghuni"
        class="hidden sm:inline-flex items-center glass-panel bg-sky-500/40 border-sky-400 hover:bg-sky-500/50 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition">
        <i class="fa-solid fa-tags"></i>
        <span class="hidden lg:inline ml-1.5">Label</span>
      </button>

      <button id="btn-toggle-night" type="button" title="Mode Pencahayaan Siang / Malam"
        class="hidden sm:inline-flex items-center glass-panel hover:bg-slate-800/90 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition">
        <i class="fa-solid fa-moon text-sky-300"></i>
        <span class="hidden lg:inline ml-1.5">Malam</span>
      </button>

      <button id="btn-reset-cam" type="button" title="Reset Sudut Kamera"
        class="hidden sm:inline-flex items-center glass-panel hover:bg-slate-800/90 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition">
        <i class="fa-solid fa-compass text-emerald-300"></i>
      </button>

      <a href="admin/index.php"
        class="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition">
        <i class="fa-solid fa-user-shield"></i>
        <span>Admin</span>
      </a>
    </div>
  </header>

  <!-- Mobile Thumb-Friendly Exterior Bottom Dock (< 640px) -->
  <div id="mobile-exterior-dock" class="sm:hidden fixed bottom-3 inset-x-3 z-30 safe-bottom pointer-events-none">
    <div class="glass-panel-strong rounded-2xl p-1.5 shadow-2xl flex items-center justify-between gap-1.5 pointer-events-auto">
      <button id="btn-mobile-list" type="button"
        class="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition">
        <i class="fa-solid fa-list-ul"></i>
        <span>Daftar Unit (<span id="stat-total-m">-</span>)</span>
      </button>
      <button id="btn-mobile-labels" type="button" aria-label="Toggle Label"
        class="w-11 h-10 rounded-xl bg-sky-500/30 border border-sky-400/70 text-white flex items-center justify-center text-sm transition">
        <i class="fa-solid fa-tags"></i>
      </button>
      <button id="btn-mobile-night" type="button" aria-label="Toggle Siang Malam"
        class="w-11 h-10 rounded-xl bg-white/10 text-sky-300 flex items-center justify-center text-sm transition">
        <i class="fa-solid fa-moon"></i>
      </button>
      <button id="btn-mobile-reset" type="button" aria-label="Reset Kamera"
        class="w-11 h-10 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center text-sm transition">
        <i class="fa-solid fa-compass"></i>
      </button>
    </div>
  </div>

  <!-- Unit Directory: Bottom Sheet on Mobile (<640px) | Slide-Over Sidebar on Tablet | Persistent Collapsible Sidebar on Desktop -->
  <aside id="units-sidebar"
    class="fixed z-40 glass-panel-strong sm:glass-panel shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out
           inset-x-0 bottom-0 h-[76dvh] rounded-t-3xl translate-y-full
           sm:inset-x-auto sm:top-20 sm:left-4 sm:bottom-4 sm:h-auto sm:w-80 sm:rounded-2xl sm:translate-y-0 sm:-translate-x-[115%]
           lg:translate-x-0">
    <!-- Mobile Drag Handle -->
    <div class="sm:hidden flex justify-center pt-2.5 pb-1">
      <span class="w-10 h-1.5 rounded-full bg-white/25"></span>
    </div>

    <div class="p-4 border-b border-white/10">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-sm font-extrabold text-white">Daftar Kontrakan</h2>
          <p class="text-[11px] text-slate-400">4 Memanjang • 2 Terpisah • 1 Bawah + 2 Atas</p>
        </div>
        <button id="btn-close-sidebar" type="button" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition" title="Tutup panel">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input id="search-unit" type="text" placeholder="Cari nomor / penghuni..."
          class="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400">
      </div>

      <!-- Filter Pills -->
      <div class="grid grid-cols-3 gap-1.5 mt-2.5">
        <button type="button" data-filter="all" class="py-2 rounded-lg text-[11px] font-semibold bg-sky-500 text-white transition">Semua</button>
        <button type="button" data-filter="kosong" class="py-2 rounded-lg text-[11px] font-semibold bg-white/10 text-slate-300 hover:bg-white/15 transition">Kosong</button>
        <button type="button" data-filter="terisi" class="py-2 rounded-lg text-[11px] font-semibold bg-white/10 text-slate-300 hover:bg-white/15 transition">Terisi</button>
      </div>
    </div>

    <div id="sidebar-units-list" class="flex-1 overflow-y-auto p-3 space-y-2.5 safe-bottom">
      <!-- Populated by JS -->
    </div>
  </aside>

  <!-- Interior Navigation Dock (Visible when inside a 3D unit) -->
  <div id="interior-hud" class="hidden fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-1.5rem)] sm:w-auto max-w-xl safe-bottom">
    <div class="glass-panel-strong px-2 sm:px-3 py-2 rounded-2xl shadow-2xl flex items-center justify-between sm:justify-center gap-1.5 sm:gap-2">
      <button id="btn-exit-room" type="button"
        class="bg-rose-500 hover:bg-rose-400 text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
        <span>Keluar</span>
      </button>

      <button id="btn-toggle-cutaway" type="button"
        class="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0">
        <i class="fa-solid fa-cube text-sky-300"></i>
        <span>Denah 3D</span>
      </button>

      <!-- Toggle Info Sheet on Mobile & Tablet -->
      <button id="btn-toggle-detail" type="button"
        class="lg:hidden bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-200 px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0">
        <i class="fa-solid fa-circle-info"></i>
        <span>Info</span>
      </button>

      <div class="hidden sm:block w-px h-5 bg-white/15 mx-0.5"></div>

      <div class="flex items-center gap-1 shrink-0">
        <button id="btn-prev-unit" type="button" title="Kontrakan Sebelumnya"
          class="bg-white/10 hover:bg-white/20 text-white w-9 h-9 rounded-xl flex items-center justify-center transition">
          <i class="fa-solid fa-chevron-left text-xs"></i>
        </button>
        <button id="btn-next-unit" type="button" title="Kontrakan Berikutnya"
          class="bg-white/10 hover:bg-white/20 text-white w-9 h-9 rounded-xl flex items-center justify-center transition">
          <i class="fa-solid fa-chevron-right text-xs"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- Unit Detail Drawer: Bottom Sheet on Mobile (<640px) | Right Glass Panel on Tablet & Desktop -->
  <aside id="unit-detail-drawer"
    class="fixed z-40 glass-panel-strong sm:glass-panel shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out pointer-events-none opacity-0
           inset-x-0 bottom-0 max-h-[78dvh] rounded-t-3xl translate-y-full
           sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-20 lg:bottom-4 sm:max-h-none sm:w-80 sm:rounded-2xl sm:translate-y-0 sm:translate-x-[120%]">
    <!-- Mobile Drag Handle -->
    <div class="sm:hidden flex justify-center pt-2.5 pb-1">
      <span class="w-10 h-1.5 rounded-full bg-white/25"></span>
    </div>

    <div class="p-5 overflow-y-auto flex-1 flex flex-col safe-bottom">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0">
          <span id="detail-badge-nomor" class="w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-lg shrink-0">
            #01
          </span>
          <div class="min-w-0">
            <h3 id="detail-nama" class="text-base font-extrabold text-white leading-tight truncate">Kontrakan 01</h3>
            <p id="detail-blok" class="text-xs text-slate-400 mt-0.5 truncate">Blok A • Lantai 1</p>
          </div>
        </div>
        <button id="btn-close-detail" type="button" class="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition shrink-0">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between gap-2">
        <span id="detail-status" class="text-xs font-semibold px-2.5 py-1 rounded-full border"></span>
        <span class="text-[11px] text-slate-400"><i class="fa-solid fa-hand-pointer mr-1"></i>Geser 360°</span>
      </div>

      <!-- Price Box -->
      <div class="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-400/30">
        <div class="text-[11px] uppercase tracking-wider text-sky-300 font-semibold">Harga Sewa / Bulan</div>
        <div id="detail-harga" class="text-2xl font-extrabold text-white mt-0.5">Rp 850.000</div>
      </div>

      <!-- Info Grid -->
      <div class="mt-4 space-y-3 text-sm">
        <div class="grid grid-cols-2 sm:grid-cols-1 gap-2.5">
          <div class="p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="text-[11px] text-slate-400 font-medium">Penghuni Saat Ini</div>
            <div id="detail-penghuni" class="text-xs sm:text-sm font-bold text-white mt-0.5">-</div>
          </div>

          <div class="p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="text-[11px] text-slate-400 font-medium">Ukuran Ruangan</div>
            <div id="detail-ukuran" class="text-xs sm:text-sm font-semibold text-white mt-0.5">-</div>
          </div>
        </div>

        <div>
          <div class="text-xs font-bold text-slate-300 mb-1.5">Fasilitas Unit</div>
          <div id="detail-fasilitas" class="flex flex-wrap gap-1.5"></div>
        </div>

        <div>
          <div class="text-xs font-bold text-slate-300 mb-1">Deskripsi</div>
          <p id="detail-deskripsi" class="text-xs text-slate-300 leading-relaxed"></p>
        </div>
      </div>

      <div id="detail-cta-box" class="mt-auto pt-4"></div>
    </div>
  </aside>

  <!-- Subtle Bottom Hint (Desktop Exterior Mode) -->
  <div id="desktop-hint" class="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden lg:block">
    <div class="glass-panel px-4 py-1.5 rounded-full text-[11px] text-slate-300 shadow">
      <i class="fa-solid fa-computer-mouse text-sky-400 mr-1.5"></i>
      Drag untuk putar 3D • Scroll untuk zoom • <strong class="text-white">Klik unit / label</strong> untuk masuk ke dalam kontrakan
    </div>
  </div>

  <script type="module" src="assets/js/public-app.js"></script>
</body>
</html>
