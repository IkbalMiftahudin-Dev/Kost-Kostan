(() => {
  const formatRupiah = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  const escapeHtml = (str) =>
    String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const formatWaNumber = (hp) => {
    const digits = String(hp || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  };

  const state = {
    tab: 'overview',
    periode: document.getElementById('global-periode').value,
    units: [],
    tenants: [],
    payments: [],
    paymentSummary: {},
  };

  const tabMeta = {
    overview: ['Ringkasan Kontrakan', 'Pantau status seluruh kontrakan, penghuni, dan pembayaran secara real-time'],
    units: ['Kontrakan & Harga', 'Tambah kontrakan baru, ubah harga per nomor, dan atur posisi bangunan 3D'],
    tenants: ['Data Penghuni', 'Kelola nama lengkap penghuni (hanya terlihat di Admin) & tanggal jatuh tempo rutin'],
    payments: ['Jadwal Pembayaran', 'Atur jadwal jatuh tempo bulanan, konfirmasi lunas, dan kirim pengingat WhatsApp'],
  };

  function setMobileNavOpen(open) {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-backdrop');
    if (open) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    const colors =
      type === 'error'
        ? 'bg-rose-600 border-rose-400/50 text-white'
        : 'bg-slate-800 border-emerald-400/50 text-emerald-100';
    div.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${colors}`;
    div.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check text-emerald-400'} shrink-0"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 300);
    }, 3400);
  }

  async function api(path, options = {}) {
    const reqOptions = { ...options };
    const method = String(reqOptions.method || 'GET').toUpperCase();

    // Gunakan POST + _method override agar 100% aman di shared hosting (InfinityFree)
    if (method === 'PUT' || method === 'DELETE') {
      reqOptions.method = 'POST';
      let bodyObj = {};
      if (typeof reqOptions.body === 'string' && reqOptions.body.trim()) {
        try { bodyObj = JSON.parse(reqOptions.body); } catch (_) { bodyObj = {}; }
      }
      bodyObj._method = method;
      reqOptions.body = JSON.stringify(bodyObj);
    }

    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(reqOptions.headers || {}) },
      ...reqOptions,
    });
    if (res.status === 401) {
      window.location.href = 'login.php';
      throw new Error('Sesi berakhir, silakan login ulang.');
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Permintaan gagal diproses.');
    }
    return data;
  }

  function switchTab(tabName) {
    state.tab = tabName;
    document.querySelectorAll('.tab-panel').forEach((sec) => {
      sec.classList.toggle('hidden', sec.id !== `tab-${tabName}`);
    });

    // Sync Desktop Sidebar tabs
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === tabName;
      btn.className = active
        ? 'nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 transition'
        : 'nav-tab w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition';
    });

    // Sync Mobile/Tablet Bottom Tab Bar
    document.querySelectorAll('.bottom-nav-tab').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === tabName;
      btn.className = active
        ? 'bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-sky-400 bg-sky-500/15 transition'
        : 'bottom-nav-tab flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-400 hover:text-white transition';
    });

    const [title, sub] = tabMeta[tabName] || tabMeta.overview;
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = sub;
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadAllData() {
    try {
      const tenantStatus = document.getElementById('tenant-status-filter').value;
      const payStatus = document.getElementById('payment-status-filter').value;

      const [unitsRes, tenantsRes, paymentsRes] = await Promise.all([
        api(`../api/units.php?periode=${encodeURIComponent(state.periode)}`),
        api(`../api/tenants.php?status=${encodeURIComponent(tenantStatus)}`),
        api(`../api/payments.php?periode=${encodeURIComponent(state.periode)}&status=${encodeURIComponent(payStatus)}`),
      ]);

      state.units = unitsRes.units || [];
      state.tenants = tenantsRes.tenants || [];
      state.payments = paymentsRes.payments || [];
      state.paymentSummary = paymentsRes.summary || {};

      renderOverview();
      renderUnitsViews();
      renderTenantsViews();
      renderPaymentsViews();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderOverview() {
    const total = state.units.length;
    const terisi = state.units.filter((u) => u.status === 'terisi').length;
    const kosong = state.units.filter((u) => u.status === 'kosong').length;
    const potensi = state.units.reduce((acc, u) => acc + Number(u.harga_bulanan || 0), 0);

    document.getElementById('kpi-total-units').textContent = `${total} Unit`;
    document.getElementById('kpi-occupancy-sub').textContent = `${terisi} terisi • ${kosong} kosong`;
    document.getElementById('kpi-paid-amount').textContent = formatRupiah(state.paymentSummary.total_lunas || 0);
    document.getElementById('kpi-paid-count').textContent = `${state.paymentSummary.count_lunas || 0} unit lunas`;
    document.getElementById('kpi-unpaid-amount').textContent = formatRupiah(state.paymentSummary.total_belum || 0);
    document.getElementById('kpi-unpaid-count').textContent = `${state.paymentSummary.count_belum || 0} belum • ${state.paymentSummary.count_telat || 0} telat`;
    document.getElementById('kpi-potential').textContent = formatRupiah(potensi);

    const pending = state.payments.filter((p) => p.status !== 'lunas');
    const pendingEl = document.getElementById('overview-pending-list');
    if (pending.length === 0) {
      pendingEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Semua tagihan periode ${escapeHtml(state.periode)} sudah lunas atau belum digenerate.</div>`;
    } else {
      pendingEl.innerHTML = pending
        .map((p) => {
          const isLate = p.status === 'telat';
          return `
            <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02]">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-9 h-9 rounded-xl ${isLate ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'} font-extrabold text-xs flex items-center justify-center shrink-0">
                  #${String(p.nomor_unit).padStart(2, '0')}
                </span>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-white truncate">${escapeHtml(p.nama_penghuni)}</div>
                  <div class="text-[11px] sm:text-xs text-slate-400 truncate">
                    Tempo: <span class="${isLate ? 'text-rose-400 font-semibold' : 'text-slate-300'}">${escapeHtml(p.jatuh_tempo)}</span> • ${formatRupiah(p.nominal)}
                  </div>
                </div>
              </div>
              <button type="button" data-quick-pay="${p.id}"
                class="px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold shrink-0 transition">
                Lunas
              </button>
            </div>
          `;
        })
        .join('');
    }

    const gridEl = document.getElementById('overview-units-grid');
    gridEl.innerHTML = state.units
      .map((u) => {
        const cls =
          u.status === 'kosong'
            ? 'bg-emerald-500/15 border-emerald-500/35 hover:border-emerald-400'
            : u.status === 'maintenance'
            ? 'bg-amber-500/15 border-amber-500/35 hover:border-amber-400'
            : 'bg-sky-500/15 border-sky-500/35 hover:border-sky-400';
        return `
          <button type="button" data-edit-unit="${u.id}" class="p-3 rounded-xl border text-left transition ${cls}">
            <div class="flex items-center justify-between gap-1">
              <span class="font-extrabold text-sm text-white">#${String(u.nomor_unit).padStart(2, '0')}</span>
              <span class="text-[10px] font-semibold uppercase ${u.status === 'kosong' ? 'text-emerald-300' : u.status === 'maintenance' ? 'text-amber-300' : 'text-sky-300'}">${u.status === 'kosong' ? 'Kosong' : u.status === 'maintenance' ? 'Renov' : 'Terisi'}</span>
            </div>
            <div class="text-[11px] text-slate-200 truncate mt-1">${escapeHtml(u.nama_penghuni || 'Tersedia')}</div>
            <div class="text-[11px] font-bold text-slate-300 mt-0.5 truncate">${formatRupiah(u.harga_bulanan)}</div>
          </button>
        `;
      })
      .join('');
  }

  function getUnitMeta(u) {
    const blokLabel =
      u.blok === 'memanjang_4'
        ? 'Blok A: Deret 4 • Lt. 1'
        : u.blok === 'memanjang_2'
        ? 'Blok B: Deret 2 Terpisah • Lt. 1'
        : `Blok C: Bertingkat • Lt. ${u.lantai}`;

    const stBadge =
      u.status === 'kosong'
        ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Kosong</span>`
        : u.status === 'maintenance'
        ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Perbaikan</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">Terisi</span>`;

    return { blokLabel, stBadge };
  }

  function renderUnitsViews() {
    const tbody = document.getElementById('units-table-body');
    const cardsEl = document.getElementById('units-mobile-cards');

    tbody.innerHTML = state.units
      .map((u) => {
        const { blokLabel, stBadge } = getUnitMeta(u);
        const occupantHtml = u.nama_penghuni
          ? `<div class="font-semibold text-white text-xs">${escapeHtml(u.nama_penghuni)}</div>
             <div class="text-[11px] text-slate-400">Publik: ${escapeHtml(u.penghuni_publik)} • Tempo tgl ${u.tanggal_jatuh_tempo}</div>`
          : `<span class="text-xs text-slate-500 italic">Belum ditempati</span>`;

        return `
          <tr class="hover:bg-white/[0.02]">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <span class="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shrink-0" style="background:${escapeHtml(u.warna_aksen || '#2563eb')}">
                  #${String(u.nomor_unit).padStart(2, '0')}
                </span>
                <div>
                  <div class="font-bold text-white text-sm">${escapeHtml(u.nama_unit)}</div>
                  <div class="text-[11px] text-slate-400">${escapeHtml(u.ukuran || '3.5 x 7 m')}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3.5 text-xs text-slate-300">${blokLabel}</td>
            <td class="px-4 py-3.5">${stBadge}</td>
            <td class="px-4 py-3.5">${occupantHtml}</td>
            <td class="px-4 py-3.5">
              <div class="font-extrabold text-sky-300 text-sm">${formatRupiah(u.harga_bulanan)}</div>
            </td>
            <td class="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
              <button type="button" data-edit-unit="${u.id}" title="Edit Harga & Detail Unit"
                class="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition">
                <i class="fa-solid fa-pen-to-square mr-1"></i>Edit/Harga
              </button>
              <button type="button" data-assign-unit="${u.id}" title="Atur Penghuni"
                class="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-semibold transition">
                <i class="fa-solid fa-user-pen mr-1"></i>Penghuni
              </button>
              <button type="button" data-delete-unit="${u.id}" title="Hapus Unit"
                class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold transition">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    // Mobile Cards
    cardsEl.innerHTML = state.units
      .map((u) => {
        const { blokLabel, stBadge } = getUnitMeta(u);
        return `
          <div class="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0" style="background:${escapeHtml(u.warna_aksen || '#2563eb')}">
                  #${String(u.nomor_unit).padStart(2, '0')}
                </span>
                <div class="min-w-0">
                  <div class="font-bold text-white text-sm truncate">${escapeHtml(u.nama_unit)}</div>
                  <div class="text-[11px] text-slate-400 truncate">${blokLabel}</div>
                </div>
              </div>
              <div class="shrink-0">${stBadge}</div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <div class="text-[10px] text-slate-400 uppercase tracking-wider">Harga / Bulan</div>
                <div class="font-extrabold text-sky-300 text-sm mt-0.5">${formatRupiah(u.harga_bulanan)}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400 uppercase tracking-wider">Penghuni</div>
                <div class="font-semibold text-white truncate mt-0.5">${escapeHtml(u.nama_penghuni || 'Kosong')}</div>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <button type="button" data-edit-unit="${u.id}"
                class="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition">
                <i class="fa-solid fa-pen-to-square mr-1"></i>Edit / Harga
              </button>
              <button type="button" data-assign-unit="${u.id}"
                class="flex-1 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition">
                <i class="fa-solid fa-user-pen mr-1"></i>Penghuni
              </button>
              <button type="button" data-delete-unit="${u.id}" aria-label="Hapus Unit"
                class="w-10 h-10 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs flex items-center justify-center shrink-0 transition">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderTenantsViews() {
    const tbody = document.getElementById('tenants-table-body');
    const cardsEl = document.getElementById('tenants-mobile-cards');

    if (state.tenants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-xs text-slate-400">Belum ada data penghuni untuk filter ini.</td></tr>`;
      cardsEl.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">Belum ada data penghuni untuk filter ini.</div>`;
      return;
    }

    tbody.innerHTML = state.tenants
      .map((t) => {
        const wa = formatWaNumber(t.no_hp);
        const isAktif = t.status === 'aktif';
        return `
          <tr class="hover:bg-white/[0.02]">
            <td class="px-5 py-3.5">
              <span class="font-extrabold text-sky-300">#${String(t.nomor_unit).padStart(2, '0')}</span>
              <span class="text-xs text-slate-300 ml-1.5">${escapeHtml(t.nama_unit)}</span>
            </td>
            <td class="px-4 py-3.5">
              <div class="font-bold text-white text-sm">${escapeHtml(t.nama_penghuni)}</div>
              <div class="text-[11px] text-slate-400">${escapeHtml(t.catatan || '-')}</div>
            </td>
            <td class="px-4 py-3.5">
              <span class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-sky-200 font-semibold">
                <i class="fa-solid fa-eye-slash text-slate-400 mr-1"></i>${escapeHtml(t.penghuni_publik || '-')}
              </span>
            </td>
            <td class="px-4 py-3.5 text-xs">
              ${
                wa
                  ? `<a href="https://wa.me/${wa}" target="_blank" class="text-emerald-400 hover:text-emerald-300 font-semibold"><i class="fa-brands fa-whatsapp mr-1"></i>${escapeHtml(t.no_hp)}</a>`
                  : `<span class="text-slate-500">-</span>`
              }
            </td>
            <td class="px-4 py-3.5 text-xs text-slate-300">
              <div>Masuk: ${escapeHtml(t.tanggal_masuk)}</div>
              <div class="text-amber-300 font-semibold">Jatuh tempo tiap tgl ${t.tanggal_jatuh_tempo}</div>
            </td>
            <td class="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
              ${
                isAktif
                  ? `<button type="button" data-assign-unit="${t.unit_id}" class="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition">Edit</button>
                     <button type="button" data-checkout-unit="${t.unit_id}" data-tenant-name="${escapeHtml(t.nama_penghuni)}" class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold transition">Checkout</button>`
                  : `<span class="text-[11px] text-slate-500">Keluar ${escapeHtml(t.tanggal_keluar || '')}</span>`
              }
            </td>
          </tr>
        `;
      })
      .join('');

    cardsEl.innerHTML = state.tenants
      .map((t) => {
        const wa = formatWaNumber(t.no_hp);
        const isAktif = t.status === 'aktif';
        return `
          <div class="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-extrabold">#${String(t.nomor_unit).padStart(2, '0')}</span>
                  <span class="font-bold text-white text-sm truncate">${escapeHtml(t.nama_penghuni)}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">Tampilan Publik 3D: <span class="text-sky-200 font-semibold">${escapeHtml(t.penghuni_publik || '-')}</span></div>
              </div>
              ${
                wa
                  ? `<a href="https://wa.me/${wa}" target="_blank" class="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"><i class="fa-brands fa-whatsapp text-base"></i></a>`
                  : ''
              }
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <div class="text-[10px] text-slate-400">Masuk</div>
                <div class="text-slate-200 font-medium">${escapeHtml(t.tanggal_masuk)}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400">Jatuh Tempo</div>
                <div class="text-amber-300 font-bold">Tiap tgl ${t.tanggal_jatuh_tempo}</div>
              </div>
            </div>

            ${
              isAktif
                ? `<div class="flex items-center gap-2 pt-1">
                     <button type="button" data-assign-unit="${t.unit_id}" class="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition">Edit Penghuni</button>
                     <button type="button" data-checkout-unit="${t.unit_id}" data-tenant-name="${escapeHtml(t.nama_penghuni)}" class="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold transition">Checkout</button>
                   </div>`
                : `<div class="text-[11px] text-slate-500 pt-1">Status: Keluar (${escapeHtml(t.tanggal_keluar || '-')})</div>`
            }
          </div>
        `;
      })
      .join('');
  }

  function renderPaymentsViews() {
    const tbody = document.getElementById('payments-table-body');
    const cardsEl = document.getElementById('payments-mobile-cards');

    if (state.payments.length === 0) {
      const emptyMsg = `Belum ada jadwal pembayaran untuk periode ${escapeHtml(state.periode)}. Ketuk tombol <strong>"Generate"</strong> di atas.`;
      tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-xs text-slate-400">${emptyMsg}</td></tr>`;
      cardsEl.innerHTML = `<div class="py-8 px-4 text-center text-xs text-slate-400">${emptyMsg}</div>`;
      return;
    }

    tbody.innerHTML = state.payments
      .map((p) => {
        const badge =
          p.status === 'lunas'
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Lunas</span>`
            : p.status === 'telat'
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">Telat</span>`
            : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Belum Bayar</span>`;

        const wa = formatWaNumber(p.no_hp);
        const waText = encodeURIComponent(
          `Halo Kak ${p.nama_penghuni}, izin mengingatkan jadwal pembayaran sewa Kontrakan Teh Amoy Unit #${String(p.nomor_unit).padStart(2, '0')} untuk periode ${p.periode_bulan} sebesar ${formatRupiah(p.nominal)} dengan jatuh tempo tanggal ${p.jatuh_tempo}. Terima kasih.`
        );

        return `
          <tr class="hover:bg-white/[0.02]">
            <td class="px-5 py-3.5">
              <div class="font-bold text-white text-sm">#${String(p.nomor_unit).padStart(2, '0')} • ${escapeHtml(p.nama_penghuni)}</div>
              <div class="text-[11px] text-slate-400">${escapeHtml(p.catatan || p.nama_unit)}</div>
            </td>
            <td class="px-4 py-3.5 text-xs font-semibold text-slate-300">${escapeHtml(p.periode_bulan)}</td>
            <td class="px-4 py-3.5 text-xs font-semibold ${p.status === 'telat' ? 'text-rose-400' : 'text-slate-200'}">${escapeHtml(p.jatuh_tempo)}</td>
            <td class="px-4 py-3.5 font-extrabold text-sky-300 text-sm">${formatRupiah(p.nominal)}</td>
            <td class="px-4 py-3.5">${badge}</td>
            <td class="px-4 py-3.5 text-xs text-slate-300">
              ${p.tanggal_bayar ? `<div>${escapeHtml(p.tanggal_bayar)}</div><div class="text-[10px] text-slate-400">${escapeHtml(p.metode_bayar || '')}</div>` : '<span class="text-slate-500">-</span>'}
            </td>
            <td class="px-5 py-3.5 text-right whitespace-nowrap space-x-1">
              ${
                p.status !== 'lunas'
                  ? `<button type="button" data-quick-pay="${p.id}" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition">Lunas</button>`
                  : ''
              }
              <button type="button" data-edit-pay="${p.id}" class="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-semibold transition">
                <i class="fa-solid fa-calendar-pen mr-1"></i>Atur
              </button>
              ${
                wa && p.status !== 'lunas'
                  ? `<a href="https://wa.me/${wa}?text=${waText}" target="_blank" title="Kirim Pengingat WA" class="inline-block px-2.5 py-1.5 rounded-lg bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-white text-xs font-semibold transition"><i class="fa-brands fa-whatsapp"></i></a>`
                  : ''
              }
            </td>
          </tr>
        `;
      })
      .join('');

    cardsEl.innerHTML = state.payments
      .map((p) => {
        const badge =
          p.status === 'lunas'
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Lunas</span>`
            : p.status === 'telat'
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">Telat</span>`
            : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Belum Bayar</span>`;

        const wa = formatWaNumber(p.no_hp);
        const waText = encodeURIComponent(
          `Halo Kak ${p.nama_penghuni}, izin mengingatkan jadwal pembayaran sewa Kontrakan Teh Amoy Unit #${String(p.nomor_unit).padStart(2, '0')} untuk periode ${p.periode_bulan} sebesar ${formatRupiah(p.nominal)} dengan jatuh tempo tanggal ${p.jatuh_tempo}. Terima kasih.`
        );

        return `
          <div class="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-white text-sm truncate">#${String(p.nomor_unit).padStart(2, '0')} • ${escapeHtml(p.nama_penghuni)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">Periode ${escapeHtml(p.periode_bulan)}</div>
              </div>
              <div class="shrink-0">${badge}</div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <div class="text-[10px] text-slate-400">Nominal</div>
                <div class="font-extrabold text-sky-300 text-sm">${formatRupiah(p.nominal)}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400">Jatuh Tempo</div>
                <div class="font-bold ${p.status === 'telat' ? 'text-rose-400' : 'text-slate-200'}">${escapeHtml(p.jatuh_tempo)}</div>
              </div>
            </div>

            ${
              p.tanggal_bayar
                ? `<div class="text-[11px] text-emerald-300/90"><i class="fa-solid fa-check-double mr-1"></i>Dibayar ${escapeHtml(p.tanggal_bayar)} (${escapeHtml(p.metode_bayar || 'Tunai')})</div>`
                : ''
            }

            <div class="flex items-center gap-2 pt-1">
              ${
                p.status !== 'lunas'
                  ? `<button type="button" data-quick-pay="${p.id}" class="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition">Tandai Lunas</button>`
                  : ''
              }
              <button type="button" data-edit-pay="${p.id}" class="flex-1 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition">
                <i class="fa-solid fa-calendar-pen mr-1"></i>Atur Jadwal
              </button>
              ${
                wa && p.status !== 'lunas'
                  ? `<a href="https://wa.me/${wa}?text=${waText}" target="_blank" aria-label="Pengingat WA" class="w-10 h-10 rounded-xl bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-white flex items-center justify-center shrink-0 transition"><i class="fa-brands fa-whatsapp text-base"></i></a>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  // =========================================================================
  // MODAL HANDLERS
  // =========================================================================
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function openAddUnitModal() {
    const maxNum = state.units.reduce((m, u) => Math.max(m, Number(u.nomor_unit || 0)), 0);
    document.getElementById('modal-unit-title').textContent = 'Tambah Kontrakan Baru';
    document.getElementById('unit-id').value = '';
    document.getElementById('unit-nomor').value = maxNum + 1;
    document.getElementById('unit-nama').value = `Kontrakan ${String(maxNum + 1).padStart(2, '0')}`;
    document.getElementById('unit-harga').value = 850000;
    document.getElementById('unit-layout-pos').value = 'memanjang_4:1';
    document.getElementById('unit-ukuran').value = '3.5 x 7 m';
    document.getElementById('unit-warna').value = '#2563eb';
    document.getElementById('unit-status').value = 'kosong';
    document.getElementById('unit-fasilitas').value = 'Ruang Depan, Ruang Tengah, Dapur Meja Cor, Kamar Mandi Dalam, Token Listrik';
    document.getElementById('unit-deskripsi').value = 'Unit kontrakan baru nyaman dan siap huni.';
    document.getElementById('sync-price-wrap').classList.add('hidden');
    openModal('modal-unit');
  }

  function openEditUnitModal(unitId) {
    const u = state.units.find((x) => x.id === Number(unitId));
    if (!u) return;
    document.getElementById('modal-unit-title').textContent = `Edit Kontrakan #${String(u.nomor_unit).padStart(2, '0')}`;
    document.getElementById('unit-id').value = u.id;
    document.getElementById('unit-nomor').value = u.nomor_unit;
    document.getElementById('unit-nama').value = u.nama_unit;
    document.getElementById('unit-harga').value = u.harga_bulanan;
    document.getElementById('unit-layout-pos').value = `${u.blok}:${u.lantai}`;
    document.getElementById('unit-ukuran').value = u.ukuran || '3.5 x 7 m';
    document.getElementById('unit-warna').value = u.warna_aksen || '#2563eb';
    document.getElementById('unit-status').value = u.status;
    document.getElementById('unit-fasilitas').value = u.fasilitas || '';
    document.getElementById('unit-deskripsi').value = u.deskripsi || '';
    document.getElementById('sync-price-wrap').classList.remove('hidden');
    openModal('modal-unit');
  }

  function openTenantModal(preselectUnitId = null) {
    const sel = document.getElementById('tenant-unit-id');
    sel.innerHTML = state.units
      .map((u) => {
        const label = `#${String(u.nomor_unit).padStart(2, '0')} — ${u.nama_unit} (${u.nama_penghuni ? 'Diisi: ' + u.nama_penghuni : 'Kosong'})`;
        return `<option value="${u.id}">${escapeHtml(label)}</option>`;
      })
      .join('');

    const targetUnit = preselectUnitId
      ? state.units.find((u) => u.id === Number(preselectUnitId))
      : state.units.find((u) => u.status === 'kosong') || state.units[0];

    if (targetUnit) {
      sel.value = String(targetUnit.id);
      fillTenantFormFromUnit(targetUnit);
    }
    openModal('modal-tenant');
  }

  function fillTenantFormFromUnit(u) {
    document.getElementById('tenant-nama').value = u.nama_penghuni || '';
    document.getElementById('tenant-hp').value = u.no_hp || '';
    document.getElementById('tenant-due-day').value = u.tanggal_jatuh_tempo || 5;
    document.getElementById('tenant-tgl-masuk').value = u.tanggal_masuk || new Date().toISOString().slice(0, 10);
    document.getElementById('tenant-catatan').value = u.tenant_catatan || '';
  }

  function openPaymentModal(payId) {
    const p = state.payments.find((x) => x.id === Number(payId));
    if (!p) return;
    document.getElementById('pay-id').value = p.id;
    document.getElementById('pay-header-info').innerHTML = `
      <div class="font-bold text-white">Kontrakan #${String(p.nomor_unit).padStart(2, '0')} — ${escapeHtml(p.nama_penghuni)}</div>
      <div class="text-slate-400 mt-0.5">Periode: ${escapeHtml(p.periode_bulan)}</div>
    `;
    document.getElementById('pay-due-date').value = p.jatuh_tempo;
    document.getElementById('pay-nominal').value = p.nominal;
    document.getElementById('pay-sync-due').checked = false;
    document.getElementById('pay-status').value = p.status;
    document.getElementById('pay-metode').value = p.metode_bayar || 'Tunai';
    document.getElementById('pay-paid-date').value = p.tanggal_bayar || new Date().toISOString().slice(0, 10);
    document.getElementById('pay-catatan').value = p.catatan || '';
    openModal('modal-payment');
  }

  // =========================================================================
  // EVENTS
  // =========================================================================
  document.querySelectorAll('.nav-tab, .bottom-nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  document.querySelectorAll('[data-goto-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-goto-tab')));
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
  });

  document.getElementById('btn-open-nav').addEventListener('click', () => setMobileNavOpen(true));
  document.getElementById('btn-close-nav').addEventListener('click', () => setMobileNavOpen(false));
  document.getElementById('admin-backdrop').addEventListener('click', () => setMobileNavOpen(false));

  document.getElementById('btn-open-add-unit').addEventListener('click', openAddUnitModal);
  document.getElementById('btn-add-unit-secondary').addEventListener('click', openAddUnitModal);
  document.getElementById('btn-assign-tenant-top').addEventListener('click', () => openTenantModal());

  document.getElementById('tenant-unit-id').addEventListener('change', (e) => {
    const u = state.units.find((x) => x.id === Number(e.target.value));
    if (u) fillTenantFormFromUnit(u);
  });

  document.getElementById('global-periode').addEventListener('change', (e) => {
    state.periode = e.target.value;
    loadAllData();
  });
  document.getElementById('tenant-status-filter').addEventListener('change', loadAllData);
  document.getElementById('payment-status-filter').addEventListener('change', loadAllData);

  document.addEventListener('click', async (e) => {
    const editUnitBtn = e.target.closest('[data-edit-unit]');
    if (editUnitBtn) {
      openEditUnitModal(editUnitBtn.getAttribute('data-edit-unit'));
      return;
    }

    const assignBtn = e.target.closest('[data-assign-unit]');
    if (assignBtn) {
      openTenantModal(assignBtn.getAttribute('data-assign-unit'));
      return;
    }

    const delUnitBtn = e.target.closest('[data-delete-unit]');
    if (delUnitBtn) {
      const id = Number(delUnitBtn.getAttribute('data-delete-unit'));
      const u = state.units.find((x) => x.id === id);
      if (!confirm(`Hapus ${u ? u.nama_unit : 'unit ini'}? Data penghuni & riwayat pembayarannya juga akan terhapus.`)) return;
      try {
        const res = await api(`../api/units.php?id=${id}`, { method: 'DELETE' });
        showToast(res.message);
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const checkoutBtn = e.target.closest('[data-checkout-unit]');
    if (checkoutBtn) {
      const unitId = Number(checkoutBtn.getAttribute('data-checkout-unit'));
      const name = checkoutBtn.getAttribute('data-tenant-name');
      if (!confirm(`Checkout penghuni "${name}" dan ubah status kontrakan menjadi Kosong?`)) return;
      try {
        const res = await api('../api/tenants.php', {
          method: 'POST',
          body: JSON.stringify({ action: 'checkout', unit_id: unitId }),
        });
        showToast(res.message);
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const quickPayBtn = e.target.closest('[data-quick-pay]');
    if (quickPayBtn) {
      const payId = Number(quickPayBtn.getAttribute('data-quick-pay'));
      try {
        const res = await api('../api/payments.php', {
          method: 'PUT',
          body: JSON.stringify({
            id: payId,
            status: 'lunas',
            tanggal_bayar: new Date().toISOString().slice(0, 10),
            metode_bayar: 'Tunai',
          }),
        });
        showToast(res.message);
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const editPayBtn = e.target.closest('[data-edit-pay]');
    if (editPayBtn) {
      openPaymentModal(editPayBtn.getAttribute('data-edit-pay'));
    }
  });

  document.getElementById('form-unit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('unit-id').value;
    const [blok, lantai] = document.getElementById('unit-layout-pos').value.split(':');
    const payload = {
      id: id ? Number(id) : undefined,
      nomor_unit: Number(document.getElementById('unit-nomor').value),
      nama_unit: document.getElementById('unit-nama').value.trim(),
      harga_bulanan: Number(document.getElementById('unit-harga').value),
      blok,
      lantai: Number(lantai),
      ukuran: document.getElementById('unit-ukuran').value.trim(),
      warna_aksen: document.getElementById('unit-warna').value,
      status: document.getElementById('unit-status').value,
      fasilitas: document.getElementById('unit-fasilitas').value.trim(),
      deskripsi: document.getElementById('unit-deskripsi').value.trim(),
      sync_unpaid_price: document.getElementById('unit-sync-price').checked,
    };

    try {
      const res = await api('../api/units.php', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      closeModal('modal-unit');
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-tenant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      action: 'assign',
      unit_id: Number(document.getElementById('tenant-unit-id').value),
      nama_penghuni: document.getElementById('tenant-nama').value.trim(),
      no_hp: document.getElementById('tenant-hp').value.trim(),
      tanggal_jatuh_tempo: Number(document.getElementById('tenant-due-day').value),
      tanggal_masuk: document.getElementById('tenant-tgl-masuk').value,
      catatan: document.getElementById('tenant-catatan').value.trim(),
    };
    try {
      const res = await api('../api/tenants.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      closeModal('modal-tenant');
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: Number(document.getElementById('pay-id').value),
      jatuh_tempo: document.getElementById('pay-due-date').value,
      nominal: Number(document.getElementById('pay-nominal').value),
      sync_tenant_due_day: document.getElementById('pay-sync-due').checked,
      status: document.getElementById('pay-status').value,
      metode_bayar: document.getElementById('pay-metode').value,
      tanggal_bayar: document.getElementById('pay-paid-date').value,
      catatan: document.getElementById('pay-catatan').value.trim(),
    };
    try {
      const res = await api('../api/payments.php', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal('modal-payment');
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-generate-payments').addEventListener('click', async () => {
    try {
      const res = await api('../api/payments.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', periode_bulan: state.periode }),
      });
      showToast(res.message);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('../api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    window.location.href = 'login.php';
  });

  loadAllData();
})();
