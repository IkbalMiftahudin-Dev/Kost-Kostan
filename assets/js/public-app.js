import { Kontrakan3DScene } from './scene3d.js';

const formatRupiah = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);

const formatShortRupiah = (amount) => {
  const n = Number(amount || 0);
  if (n >= 1000000) {
    const jt = (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 2).replace(/\.?0+$/, '');
    return `Rp ${jt}jt`;
  }
  return `Rp ${Math.round(n / 1000)}rb`;
};

const isDesktop = () => window.innerWidth >= 1024;
const isMobile = () => window.innerWidth < 640;

const state = {
  units: [],
  filter: 'all',
  search: '',
  showLabels: true,
  activeUnit: null,
  sidebarOpen: isDesktop(),
  detailOpen: false,
  labelEls: new Map(),
};

const els = {
  sceneContainer: document.getElementById('scene-container'),
  labelsLayer: document.getElementById('labels-layer'),
  loadingOverlay: document.getElementById('loading-overlay'),
  errorBanner: document.getElementById('error-banner'),
  errorText: document.getElementById('error-text'),
  backdrop: document.getElementById('drawer-backdrop'),

  statTotal: document.getElementById('stat-total'),
  statTerisi: document.getElementById('stat-terisi'),
  statKosong: document.getElementById('stat-kosong'),
  statTotalM: document.getElementById('stat-total-m'),
  statTerisiM: document.getElementById('stat-terisi-m'),
  statKosongM: document.getElementById('stat-kosong-m'),

  sidebar: document.getElementById('units-sidebar'),
  sidebarList: document.getElementById('sidebar-units-list'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnCloseSidebar: document.getElementById('btn-close-sidebar'),
  searchInput: document.getElementById('search-unit'),
  filterBtns: document.querySelectorAll('[data-filter]'),

  // Desktop/Tablet top buttons
  btnToggleLabels: document.getElementById('btn-toggle-labels'),
  btnToggleNight: document.getElementById('btn-toggle-night'),
  btnResetCam: document.getElementById('btn-reset-cam'),

  // Mobile bottom exterior dock
  mobileExteriorDock: document.getElementById('mobile-exterior-dock'),
  btnMobileList: document.getElementById('btn-mobile-list'),
  btnMobileLabels: document.getElementById('btn-mobile-labels'),
  btnMobileNight: document.getElementById('btn-mobile-night'),
  btnMobileReset: document.getElementById('btn-mobile-reset'),
  desktopHint: document.getElementById('desktop-hint'),

  // Interior HUD
  interiorHud: document.getElementById('interior-hud'),
  btnExitRoom: document.getElementById('btn-exit-room'),
  btnToggleCutaway: document.getElementById('btn-toggle-cutaway'),
  btnToggleDetail: document.getElementById('btn-toggle-detail'),
  btnCloseDetail: document.getElementById('btn-close-detail'),
  btnPrevUnit: document.getElementById('btn-prev-unit'),
  btnNextUnit: document.getElementById('btn-next-unit'),

  // Detail Drawer
  detailDrawer: document.getElementById('unit-detail-drawer'),
  detailBadgeNomor: document.getElementById('detail-badge-nomor'),
  detailStatus: document.getElementById('detail-status'),
  detailNama: document.getElementById('detail-nama'),
  detailBlok: document.getElementById('detail-blok'),
  detailHarga: document.getElementById('detail-harga'),
  detailPenghuni: document.getElementById('detail-penghuni'),
  detailUkuran: document.getElementById('detail-ukuran'),
  detailDeskripsi: document.getElementById('detail-deskripsi'),
  detailFasilitas: document.getElementById('detail-fasilitas'),
  detailCtaBox: document.getElementById('detail-cta-box'),
};

let scene3d = null;

function syncBackdrop() {
  const needsBackdrop = !isDesktop() && (state.sidebarOpen || state.detailOpen);
  els.backdrop.classList.toggle('hidden', !needsBackdrop);
}

function setSidebarOpen(open) {
  state.sidebarOpen = open;
  if (open && !isDesktop()) {
    setDetailOpen(false);
  }

  if (open) {
    els.sidebar.classList.remove('translate-y-full', 'sm:-translate-x-[115%]', 'lg:-translate-x-[115%]');
    els.sidebar.classList.add('translate-y-0', 'sm:translate-x-0', 'lg:translate-x-0');
  } else {
    els.sidebar.classList.add('translate-y-full', 'sm:-translate-x-[115%]', 'lg:-translate-x-[115%]');
    els.sidebar.classList.remove('translate-y-0', 'sm:translate-x-0', 'lg:translate-x-0');
  }
  syncBackdrop();
}

function setDetailOpen(open) {
  state.detailOpen = open;
  if (open && !isDesktop()) {
    setSidebarOpen(false);
  }

  if (open) {
    els.detailDrawer.classList.remove('translate-y-full', 'sm:translate-x-[120%]', 'opacity-0', 'pointer-events-none');
    els.detailDrawer.classList.add('translate-y-0', 'sm:translate-x-0', 'opacity-100', 'pointer-events-auto');
  } else {
    els.detailDrawer.classList.add('translate-y-full', 'sm:translate-x-[120%]', 'opacity-0', 'pointer-events-none');
    els.detailDrawer.classList.remove('translate-y-0', 'sm:translate-x-0', 'opacity-100', 'pointer-events-auto');
  }
  syncBackdrop();
}

function createFloatingLabels(units) {
  els.labelsLayer.innerHTML = '';
  state.labelEls.clear();

  units.forEach((unit) => {
    const div = document.createElement('button');
    div.type = 'button';
    div.className = `unit-label-3d is-${unit.status} text-left`;

    const dotClass =
      unit.status === 'kosong'
        ? 'bg-emerald-400 status-dot-pulse'
        : unit.status === 'maintenance'
        ? 'bg-amber-400'
        : 'bg-sky-400';

    const occupantLabel =
      unit.status === 'terisi'
        ? (unit.penghuni_publik || 'Terisi')
        : unit.status === 'maintenance'
        ? 'Perbaikan'
        : 'Tersedia';

    div.innerHTML = `
      <div class="flex items-center justify-between gap-1.5">
        <span class="text-[11px] sm:text-xs font-extrabold tracking-wide text-white">#${String(unit.nomor_unit).padStart(2, '0')}</span>
        <span class="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${
          unit.status === 'kosong' ? 'text-emerald-300' : unit.status === 'maintenance' ? 'text-amber-300' : 'text-sky-300'
        }">
          <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
          <span class="label-status-text">${unit.status === 'kosong' ? 'Kosong' : unit.status === 'maintenance' ? 'Renov' : 'Terisi'}</span>
        </span>
      </div>
      <div class="text-[10px] sm:text-[11px] font-semibold text-slate-100 truncate mt-0.5">${escapeHtml(occupantLabel)}</div>
      <div class="text-[9px] sm:text-[10px] font-medium text-sky-200/90 mt-0.5">${formatShortRupiah(unit.harga_bulanan)}/bln</div>
    `;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      scene3d.enterUnit(unit.id);
    });

    els.labelsLayer.appendChild(div);
    state.labelEls.set(unit.id, div);
  });
}

function updateFloatingLabelsPosition() {
  if (!scene3d) return;
  const hideAll = !state.showLabels || Boolean(state.activeUnit);
  const projected = scene3d.getProjectedLabels();

  for (const item of projected) {
    const el = state.labelEls.get(item.id);
    if (!el) continue;

    if (hideAll || !item.visible) {
      el.classList.add('hidden-label');
    } else {
      el.classList.remove('hidden-label');
      el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) translate(-50%, -100%)`;
    }
  }
}

function renderSidebarList() {
  const q = state.search.trim().toLowerCase();
  const filtered = state.units.filter((u) => {
    if (state.filter !== 'all' && u.status !== state.filter) return false;
    if (!q) return true;
    const text = `${u.nomor_unit} ${u.nama_unit} ${u.penghuni_publik || 'kosong tersedia'} ${u.blok}`.toLowerCase();
    return text.includes(q);
  });

  if (filtered.length === 0) {
    els.sidebarList.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-sm">
        Tidak ada kontrakan yang sesuai filter.
      </div>
    `;
    return;
  }

  els.sidebarList.innerHTML = filtered
    .map((u) => {
      const isSelected = state.activeUnit && state.activeUnit.id === u.id;
      const badgeClass =
        u.status === 'kosong'
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : u.status === 'maintenance'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          : 'bg-sky-500/20 text-sky-300 border-sky-500/30';

      const blokText =
        u.blok === 'memanjang_4'
          ? 'Blok A (Deret 4) • Lt. 1'
          : u.blok === 'memanjang_2'
          ? 'Blok B (Deret 2 Terpisah) • Lt. 1'
          : `Blok C (Bertingkat) • Lt. ${u.lantai}`;

      return `
        <button type="button" data-enter-unit="${u.id}"
          class="w-full text-left p-3.5 sm:p-3 rounded-xl border transition-all duration-150 ${
            isSelected
              ? 'bg-sky-500/25 border-sky-400 shadow-lg shadow-sky-500/10'
              : 'bg-slate-800/65 border-white/10 hover:bg-slate-800/95 hover:border-sky-400/50'
          }">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-extrabold text-sm text-white shrink-0"
                style="background:${escapeHtml(u.warna_aksen || '#2563eb')}">
                ${String(u.nomor_unit).padStart(2, '0')}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-sm text-white leading-tight truncate">${escapeHtml(u.nama_unit)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5 truncate">${blokText}</div>
              </div>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}">
              ${u.status === 'kosong' ? 'Kosong' : u.status === 'maintenance' ? 'Perbaikan' : 'Terisi'}
            </span>
          </div>
          <div class="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="text-slate-300 truncate">
              ${
                u.status === 'terisi'
                  ? `<i class="fa-solid fa-user text-sky-400 mr-1"></i>${escapeHtml(u.penghuni_publik || 'Terisi')}`
                  : `<i class="fa-solid fa-door-open text-emerald-400 mr-1"></i>Siap Ditempati`
              }
            </span>
            <span class="font-bold text-sky-300 shrink-0">${formatRupiah(u.harga_bulanan)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  els.sidebarList.querySelectorAll('[data-enter-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-enter-unit'));
      if (!isDesktop()) {
        setSidebarOpen(false);
      }
      scene3d.enterUnit(id);
    });
  });
}

function showUnitDetail(unit) {
  state.activeUnit = unit;
  els.interiorHud.classList.remove('hidden');
  els.mobileExteriorDock.classList.add('hidden');
  if (els.desktopHint) els.desktopHint.classList.add('!hidden');

  els.detailBadgeNomor.textContent = `#${String(unit.nomor_unit).padStart(2, '0')}`;
  els.detailBadgeNomor.style.backgroundColor = unit.warna_aksen || '#2563eb';
  els.detailNama.textContent = unit.nama_unit;
  els.detailBlok.textContent =
    unit.blok === 'memanjang_4'
      ? 'Blok A (Deret 4 Memanjang) • Lantai 1'
      : unit.blok === 'memanjang_2'
      ? 'Blok B (Deret 2 Terpisah) • Lantai 1'
      : `Blok C (Gedung Bertingkat) • Lantai ${unit.lantai}`;

  const statusMap = {
    kosong: { label: 'Tersedia / Kosong', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
    terisi: { label: 'Sudah Ditempati', cls: 'bg-sky-500/20 text-sky-300 border-sky-400/40' },
    maintenance: { label: 'Sedang Perbaikan', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/40' },
  };
  const st = statusMap[unit.status] || statusMap.kosong;
  els.detailStatus.textContent = st.label;
  els.detailStatus.className = `text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cls}`;

  els.detailHarga.textContent = formatRupiah(unit.harga_bulanan);
  els.detailPenghuni.textContent =
    unit.status === 'terisi'
      ? `${unit.penghuni_publik || 'Terisi'} (Privasi Publik)`
      : unit.status === 'maintenance'
      ? 'Unit dalam perawatan'
      : 'Belum ada penghuni — Siap huni';

  els.detailUkuran.textContent = unit.ukuran || '3.5 x 7 m';
  els.detailDeskripsi.textContent = unit.deskripsi || 'Hunian nyaman, bersih, dan aman.';

  els.detailFasilitas.innerHTML = (unit.fasilitas || [])
    .map(
      (f) =>
        `<span class="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-slate-100 border border-white/10">${escapeHtml(f)}</span>`
    )
    .join('');

  if (unit.status === 'kosong') {
    els.detailCtaBox.innerHTML = `
      <div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200">
        <div class="font-bold text-emerald-300 mb-1"><i class="fa-solid fa-circle-check mr-1"></i>Kontrakan Ini Tersedia!</div>
        Tertarik menyewa ${escapeHtml(unit.nama_unit)}? Hubungi Ibu/Admin Kontrakan Teh Amoy untuk survei & pemesanan.
      </div>
    `;
  } else {
    els.detailCtaBox.innerHTML = `
      <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
        <i class="fa-solid fa-shield-halved text-sky-400 mr-1"></i>
        Demi privasi penghuni, hanya nama depan & inisial yang ditampilkan di halaman publik.
      </div>
    `;
  }

  els.btnToggleCutaway.innerHTML = `<i class="fa-solid fa-cube text-sky-300"></i><span>Denah 3D</span>`;

  // Di Desktop langsung tampilkan panel detail di sisi kanan; di Mobile/Tablet biarkan ruangan 3D lega & buka lewat tombol "Info"
  setDetailOpen(isDesktop());
  renderSidebarList();
}

function hideUnitDetail() {
  state.activeUnit = null;
  els.interiorHud.classList.add('hidden');
  els.mobileExteriorDock.classList.remove('hidden');
  if (els.desktopHint) els.desktopHint.classList.remove('!hidden');
  setDetailOpen(false);
  renderSidebarList();
}

function stepToSiblingUnit(delta) {
  if (!state.activeUnit || state.units.length === 0) return;
  const idx = state.units.findIndex((u) => u.id === state.activeUnit.id);
  if (idx === -1) return;
  const nextIdx = (idx + delta + state.units.length) % state.units.length;
  scene3d.enterUnit(state.units[nextIdx].id);
}

function toggleLabels() {
  state.showLabels = !state.showLabels;
  els.btnToggleLabels.classList.toggle('bg-sky-500/40', state.showLabels);
  els.btnToggleLabels.classList.toggle('border-sky-400', state.showLabels);
  els.btnMobileLabels.classList.toggle('bg-sky-500/30', state.showLabels);
  els.btnMobileLabels.classList.toggle('border-sky-400/70', state.showLabels);
  els.btnMobileLabels.classList.toggle('bg-white/10', !state.showLabels);
  els.btnMobileLabels.classList.toggle('border-transparent', !state.showLabels);
}

function toggleNight() {
  const nextNight = !scene3d.isNightMode;
  scene3d.setNightMode(nextNight);
  const icon = nextNight ? `<i class="fa-solid fa-sun text-amber-300"></i>` : `<i class="fa-solid fa-moon text-sky-300"></i>`;
  els.btnToggleNight.innerHTML = `${icon}<span class="hidden lg:inline ml-1.5">${nextNight ? 'Siang' : 'Malam'}</span>`;
  els.btnMobileNight.innerHTML = icon;
}

function resetCameraAction() {
  if (state.activeUnit) {
    scene3d.exitUnit();
  } else {
    scene3d.resetCamera();
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function init() {
  setSidebarOpen(isDesktop());

  scene3d = new Kontrakan3DScene(els.sceneContainer, {
    onEnterUnit: (unit) => showUnitDetail(unit),
    onExitUnit: () => hideUnitDetail(),
    onFrameUpdate: () => updateFloatingLabelsPosition(),
  });

  try {
    const res = await fetch('api/public_units.php');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Gagal mengambil data kontrakan.');
    }

    state.units = data.units || [];
    const total = data.stats?.total ?? state.units.length;
    const terisi = data.stats?.terisi ?? 0;
    const kosong = data.stats?.kosong ?? 0;

    els.statTotal.textContent = total;
    els.statTerisi.textContent = terisi;
    els.statKosong.textContent = kosong;
    els.statTotalM.textContent = total;
    els.statTerisiM.textContent = terisi;
    els.statKosongM.textContent = kosong;

    scene3d.buildComplex(state.units);
    createFloatingLabels(state.units);
    renderSidebarList();
  } catch (err) {
    els.errorBanner.classList.remove('hidden');
    els.errorText.textContent = err.message || 'Tidak dapat terhubung ke database MySQL XAMPP.';
  } finally {
    els.loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => els.loadingOverlay.remove(), 400);
  }

  // Event Listeners
  els.btnToggleSidebar.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));
  els.btnCloseSidebar.addEventListener('click', () => setSidebarOpen(false));
  els.btnMobileList.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));

  els.btnToggleDetail.addEventListener('click', () => setDetailOpen(!state.detailOpen));
  els.btnCloseDetail.addEventListener('click', () => setDetailOpen(false));

  els.backdrop.addEventListener('click', () => {
    setSidebarOpen(false);
    setDetailOpen(false);
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderSidebarList();
  });

  els.filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.getAttribute('data-filter');
      els.filterBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('bg-sky-500', active);
        b.classList.toggle('text-white', active);
        b.classList.toggle('bg-white/10', !active);
        b.classList.toggle('text-slate-300', !active);
      });
      renderSidebarList();
    });
  });

  els.btnToggleLabels.addEventListener('click', toggleLabels);
  els.btnMobileLabels.addEventListener('click', toggleLabels);
  els.btnToggleNight.addEventListener('click', toggleNight);
  els.btnMobileNight.addEventListener('click', toggleNight);
  els.btnResetCam.addEventListener('click', resetCameraAction);
  els.btnMobileReset.addEventListener('click', resetCameraAction);

  els.btnExitRoom.addEventListener('click', () => scene3d.exitUnit());
  els.btnPrevUnit.addEventListener('click', () => stepToSiblingUnit(-1));
  els.btnNextUnit.addEventListener('click', () => stepToSiblingUnit(1));

  els.btnToggleCutaway.addEventListener('click', () => {
    const isCutaway = scene3d.toggleCutawayMode();
    els.btnToggleCutaway.innerHTML = isCutaway
      ? `<i class="fa-solid fa-eye text-emerald-300"></i><span>360° Dalam</span>`
      : `<i class="fa-solid fa-cube text-sky-300"></i><span>Denah 3D</span>`;
  });

  window.addEventListener('resize', () => {
    if (isDesktop()) {
      syncBackdrop();
      if (state.activeUnit) setDetailOpen(true);
    } else if (isMobile() && state.activeUnit) {
      syncBackdrop();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!isDesktop() && (state.sidebarOpen || state.detailOpen)) {
        setSidebarOpen(false);
        setDetailOpen(false);
      } else if (state.activeUnit) {
        scene3d.exitUnit();
      }
    }
  });
}

init();
