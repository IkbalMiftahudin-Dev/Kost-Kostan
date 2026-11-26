'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Building2,
  ChevronLeft,
  ChevronRight,
  Compass,
  DoorOpen,
  Eye,
  Home,
  Info,
  List,
  LogOut,
  MapPin,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Sun,
  Tag,
  User,
  X,
} from 'lucide-react';
import { formatBlockLabel, formatRupiah, formatShortRupiah } from '@/lib/helpers';
import { INTERIOR_ROOMS, Kontrakan3DScene, type InteriorRoomKey } from '@/lib/scene3d';
import type { PublicUnit } from '@/lib/types';

export default function Public3DShowcase() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Kontrakan3DScene | null>(null);
  const labelElsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const ownerLabelRef = useRef<HTMLDivElement | null>(null);
  const showLabelsRef = useRef(true);
  const activeUnitRef = useRef<PublicUnit | null>(null);

  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [stats, setStats] = useState({ total: 0, terisi: 0, kosong: 0, maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'kosong' | 'terisi'>('all');
  const [search, setSearch] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [isNight, setIsNight] = useState(false);
  const [isCutaway, setIsCutaway] = useState(false);

  const [activeUnit, setActiveUnit] = useState<PublicUnit | null>(null);
  const [activeRoom, setActiveRoom] = useState<InteriorRoomKey>('depan');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  showLabelsRef.current = showLabels;
  activeUnitRef.current = activeUnit;

  // Detect desktop viewport on mount & resize
  useEffect(() => {
    const syncViewport = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktopViewport(desktop);
    };
    syncViewport();
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  // Update 3D projected label coordinates every frame without React re-renders
  const updateLabelPositions = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const hideAll = !showLabelsRef.current || Boolean(activeUnitRef.current);
    const projected = scene.getProjectedLabels();

    for (const item of projected) {
      const el = labelElsRef.current.get(item.id);
      if (!el) continue;
      if (hideAll || !item.visible) {
        el.classList.add('hidden-label');
      } else {
        el.classList.remove('hidden-label');
        el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) translate(-50%, -100%)`;
      }
    }

    // Update posisi floating badge Rumah Utama (seragam dengan label kontrakan!)
    const ownerEl = ownerLabelRef.current;
    if (ownerEl) {
      const lm = scene.getProjectedLandmarks().find((l) => l.key === 'rumah_utama');
      if (hideAll || !lm || !lm.visible) {
        ownerEl.classList.add('hidden-label');
      } else {
        ownerEl.classList.remove('hidden-label');
        ownerEl.style.transform = `translate3d(${lm.x}px, ${lm.y}px, 0) translate(-50%, -100%)`;
      }
    }
  }, []);

  // Mount Three.js scene and fetch public units
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new Kontrakan3DScene(container, {
      onEnterUnit: (unit) => {
        setActiveUnit(unit);
        setActiveRoom('depan');
        setIsCutaway(false);
        const desktop = window.innerWidth >= 1024;
        setDetailOpen(desktop);
        if (!desktop) setSidebarOpen(false);
      },
      onExitUnit: () => {
        setActiveUnit(null);
        setActiveRoom('depan');
        setIsCutaway(false);
        setDetailOpen(false);
      },
      onRoomChange: (room) => {
        setActiveRoom(room);
        setIsCutaway(false);
      },
      onFrameUpdate: () => updateLabelPositions(),
    });
    sceneRef.current = scene;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/units', { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Gagal memuat data kontrakan.');
        if (cancelled) return;

        setUnits(data.units || []);
        setStats(data.stats || { total: 0, terisi: 0, kosong: 0, maintenance: 0 });
        scene.buildComplex(data.units || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      scene.dispose();
      sceneRef.current = null;
    };
  }, [updateLabelPositions]);

  // Escape key handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isDesktopViewport && (sidebarOpen || detailOpen)) {
        setSidebarOpen(false);
        setDetailOpen(false);
      } else if (activeUnit) {
        sceneRef.current?.exitUnit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeUnit, detailOpen, isDesktopViewport, sidebarOpen]);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (filter !== 'all' && u.status !== filter) return false;
      if (!q) return true;
      return `${u.nomor_unit} ${u.nama_unit} ${u.penghuni_publik || 'kosong tersedia'} ${u.blok}`.toLowerCase().includes(q);
    });
  }, [units, filter, search]);

  const handleEnterUnit = (unitId: number) => {
    if (!isDesktopViewport) setSidebarOpen(false);
    sceneRef.current?.enterUnit(unitId);
  };

  const handleStepUnit = (delta: number) => {
    if (!activeUnit || units.length === 0) return;
    const idx = units.findIndex((u) => u.id === activeUnit.id);
    if (idx === -1) return;
    const nextIdx = (idx + delta + units.length) % units.length;
    sceneRef.current?.enterUnit(units[nextIdx].id);
  };

  const handleToggleNight = () => {
    const next = !isNight;
    setIsNight(next);
    sceneRef.current?.setNightMode(next);
  };

  const handleResetCam = () => {
    if (activeUnit) {
      sceneRef.current?.exitUnit();
    } else {
      sceneRef.current?.resetCamera();
    }
  };

  const handleToggleCutaway = () => {
    const next = sceneRef.current?.toggleCutawayMode() ?? false;
    setIsCutaway(next);
  };

  const needsBackdrop = !isDesktopViewport && (sidebarOpen || detailOpen);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 3D WebGL Canvas */}
      <div id="scene-container" ref={containerRef} />

      {/* 3D Projected Floating Labels */}
      <div id="labels-layer">
        {/* Label Rumah Utama (desain seragam dengan penamaan kontrakan) */}
        <div
          ref={ownerLabelRef}
          className="unit-label-3d hidden-label text-left !cursor-default !border-amber-400/60"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-extrabold tracking-wide text-amber-300">RUMAH</span>
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="label-status-text">Utama</span>
            </span>
          </div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-white truncate mt-0.5">Rumah Punya Kost</div>
          <div className="text-[9px] sm:text-[10px] font-medium text-amber-200/85 mt-0.5">Teh Amoy</div>
        </div>

        {units.map((unit) => {
          const dotClass =
            unit.status === 'kosong'
              ? 'bg-emerald-400 status-dot-pulse'
              : unit.status === 'maintenance'
              ? 'bg-amber-400'
              : 'bg-sky-400';
          const occupant =
            unit.status === 'terisi'
              ? unit.penghuni_publik || 'Terisi'
              : unit.status === 'maintenance'
              ? 'Perbaikan'
              : 'Tersedia';

          return (
            <button
              key={unit.id}
              type="button"
              ref={(el) => {
                if (el) labelElsRef.current.set(unit.id, el);
                else labelElsRef.current.delete(unit.id);
              }}
              onClick={() => handleEnterUnit(unit.id)}
              className={`unit-label-3d is-${unit.status} hidden-label text-left`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] sm:text-xs font-extrabold tracking-wide text-white">
                  #{String(unit.nomor_unit).padStart(2, '0')}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${
                    unit.status === 'kosong'
                      ? 'text-emerald-300'
                      : unit.status === 'maintenance'
                      ? 'text-amber-300'
                      : 'text-sky-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  <span className="label-status-text">
                    {unit.status === 'kosong' ? 'Kosong' : unit.status === 'maintenance' ? 'Renov' : 'Terisi'}
                  </span>
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-100 truncate mt-0.5">{occupant}</div>
              <div className="text-[9px] sm:text-[10px] font-medium text-sky-200/90 mt-0.5">
                {formatShortRupiah(unit.harga_bulanan)}/bln
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/92 backdrop-blur-md px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10">
            <Home className="w-7 h-7 text-sky-400 animate-bounce" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Kontrakan Teh Amoy 3D</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">Memuat 3 blok bangunan & ruangan 3D interaktif...</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] glass-panel-strong border-rose-500/50 rounded-2xl p-4 text-rose-100 shadow-2xl">
          <div className="text-xs sm:text-sm">
            <div className="font-bold text-rose-300">Terjadi Kesalahan</div>
            <p className="text-rose-100/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Drawer Backdrop */}
      {needsBackdrop && (
        <div
          onClick={() => {
            setSidebarOpen(false);
            setDetailOpen(false);
          }}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-[2px]"
        />
      )}

      {/* Top Navigation HUD */}
      <header className="fixed top-3 sm:top-4 left-3 right-3 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto min-w-0">
          <button
            type="button"
            onClick={() => {
              const next = !sidebarOpen;
              setSidebarOpen(next);
              if (next && !isDesktopViewport) setDetailOpen(false);
            }}
            className="hidden sm:inline-flex glass-panel hover:bg-slate-800/90 text-white px-3.5 py-2.5 rounded-xl items-center gap-2 text-xs font-bold shadow-lg transition shrink-0"
          >
            <List className="w-4 h-4 text-sky-400" />
            <span>Daftar Unit</span>
          </button>

          <div className="glass-panel px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl shadow-lg flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-white leading-tight truncate">Kontrakan Teh Amoy</div>
              <div className="flex sm:hidden items-center gap-1.5 text-[10px] text-slate-300 mt-0.5">
                <span className="inline-flex items-center gap-1 text-sky-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  {stats.terisi} Terisi
                </span>
                <span className="text-slate-500">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {stats.kosong} Kosong
                </span>
              </div>
              <div className="hidden sm:block text-[11px] text-sky-300/90 truncate">Klik bangunan 3D untuk masuk ruangan</div>
            </div>
          </div>
        </div>

        {/* Center Live Counters (Tablet & Desktop) */}
        <div className="glass-panel px-3.5 py-2 rounded-xl shadow-lg hidden md:flex items-center gap-3.5 text-xs pointer-events-auto shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Total:</span>
            <span className="font-extrabold text-white text-sm">{stats.total}</span>
          </div>
          <div className="w-px h-4 bg-white/15" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-slate-300">Terisi:</span>
            <span className="font-extrabold text-sky-300 text-sm">{stats.terisi}</span>
          </div>
          <div className="w-px h-4 bg-white/15" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300">Kosong:</span>
            <span className="font-extrabold text-emerald-300 text-sm">{stats.kosong}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            title="Tampilkan/Sembunyikan Label"
            className={`hidden sm:inline-flex items-center glass-panel text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition ${
              showLabels ? 'bg-sky-500/40 border-sky-400' : 'hover:bg-slate-800/90'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden lg:inline ml-1.5">Label</span>
          </button>

          <button
            type="button"
            onClick={handleToggleNight}
            title="Mode Siang / Malam"
            className="hidden sm:inline-flex items-center glass-panel hover:bg-slate-800/90 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            {isNight ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-sky-300" />}
            <span className="hidden lg:inline ml-1.5">{isNight ? 'Siang' : 'Malam'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetCam}
            title="Reset Kamera"
            className="hidden sm:inline-flex items-center glass-panel hover:bg-slate-800/90 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-300" />
          </button>

          <a
            href="https://maps.app.goo.gl/jueJMjUPuNPdtNwk9"
            target="_blank"
            rel="noreferrer"
            title="Buka Lokasi di Google Maps"
            className="inline-flex items-center glass-panel hover:bg-slate-800/90 text-white px-2.5 sm:px-3 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            <MapPin className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline ml-1.5">Maps</span>
          </a>

          <Link
            href="/admin"
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        </div>
      </header>

      {/* Mobile Thumb-Friendly Exterior Bottom Dock (< 640px) */}
      {!activeUnit && (
        <div className="sm:hidden fixed bottom-3 inset-x-3 z-30 safe-bottom pointer-events-none">
          <div className="glass-panel-strong rounded-2xl p-1.5 shadow-2xl flex items-center justify-between gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
            >
              <List className="w-4 h-4" />
              <span>Daftar Unit ({stats.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              aria-label="Toggle Label"
              className={`w-11 h-10 rounded-xl border flex items-center justify-center transition ${
                showLabels ? 'bg-sky-500/30 border-sky-400/70 text-white' : 'bg-white/10 border-transparent text-slate-300'
              }`}
            >
              <Tag className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleNight}
              aria-label="Toggle Siang Malam"
              className="w-11 h-10 rounded-xl bg-white/10 text-sky-300 flex items-center justify-center transition"
            >
              {isNight ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-300" />}
            </button>
            <button
              type="button"
              onClick={handleResetCam}
              aria-label="Reset Kamera"
              className="w-11 h-10 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center transition"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Unit Directory: Bottom Sheet (Mobile) | Slide-Over Sidebar (Tablet) | Collapsible Sidebar (Desktop) */}
      <aside
        className={`fixed z-40 glass-panel-strong sm:glass-panel shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out
          inset-x-0 bottom-0 h-[76dvh] rounded-t-3xl
          sm:inset-x-auto sm:top-20 sm:left-4 sm:bottom-4 sm:h-auto sm:w-80 sm:rounded-2xl
          ${sidebarOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:-translate-x-[115%]'}`}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-white/25" />
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-extrabold text-white">Daftar Kontrakan</h2>
              <p className="text-[11px] text-slate-400">Bertingkat + 4 Kanan • 2 Belakang Rumah Utama</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Tutup panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor / penghuni..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-2.5">
            {(['all', 'kosong', 'terisi'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`py-2 rounded-lg text-[11px] font-semibold transition ${
                  filter === f ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'kosong' ? 'Kosong' : 'Terisi'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 safe-bottom">
          {filteredUnits.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Tidak ada kontrakan yang sesuai filter.</div>
          ) : (
            filteredUnits.map((u) => {
              const isSelected = activeUnit?.id === u.id;
              const badgeClass =
                u.status === 'kosong'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : u.status === 'maintenance'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30';

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleEnterUnit(u.id)}
                  className={`w-full text-left p-3.5 sm:p-3 rounded-xl border transition-all duration-150 ${
                    isSelected
                      ? 'bg-sky-500/25 border-sky-400 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-800/65 border-white/10 hover:bg-slate-800/95 hover:border-sky-400/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-extrabold text-sm text-white shrink-0"
                        style={{ backgroundColor: u.warna_aksen || '#2563eb' }}
                      >
                        {String(u.nomor_unit).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white leading-tight truncate">{u.nama_unit}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">{formatBlockLabel(u.blok, u.lantai)}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
                      {u.status === 'kosong' ? 'Kosong' : u.status === 'maintenance' ? 'Perbaikan' : 'Terisi'}
                    </span>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate flex items-center gap-1.5">
                      {u.status === 'terisi' ? (
                        <>
                          <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate">{u.penghuni_publik || 'Terisi'}</span>
                        </>
                      ) : (
                        <>
                          <DoorOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Siap Ditempati</span>
                        </>
                      )}
                    </span>
                    <span className="font-bold text-sky-300 shrink-0">{formatRupiah(u.harga_bulanan)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Interior Navigation Dock + Per-Room Walkthrough Switcher */}
      {activeUnit && (
        <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-1.25rem)] sm:w-auto max-w-xl safe-bottom space-y-2">
          {/* Baris 1: Pilih Ruangan (Ruang Depan / Ruang Tengah / Lorong Dapur / Kamar Mandi) */}
          <div className="glass-panel-strong px-2 py-1.5 rounded-2xl shadow-xl flex items-center justify-between sm:justify-center gap-1 overflow-x-auto">
            {INTERIOR_ROOMS.map((room, idx) => {
              const isCurrent = !isCutaway && activeRoom === room.key;
              return (
                <button
                  key={room.key}
                  type="button"
                  onClick={() => sceneRef.current?.goToRoom(room.key)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition shrink-0 ${
                    isCurrent
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="opacity-70 mr-1">{idx + 1}.</span>
                  {room.label}
                </button>
              );
            })}
          </div>

          {/* Baris 2: Aksi Utama (Keluar, Denah 3D, Info Mobile, Unit Prev/Next) */}
          <div className="glass-panel-strong px-2 sm:px-3 py-2 rounded-2xl shadow-2xl flex items-center justify-between sm:justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => sceneRef.current?.exitUnit()}
              className="bg-rose-500 hover:bg-rose-400 text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>

            <button
              type="button"
              onClick={handleToggleCutaway}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
            >
              {isCutaway ? <Eye className="w-3.5 h-3.5 text-emerald-300" /> : <Box className="w-3.5 h-3.5 text-sky-300" />}
              <span>{isCutaway ? '360° Dalam' : 'Denah 3D'}</span>
            </button>

            <button
              type="button"
              onClick={() => setDetailOpen((v) => !v)}
              className="lg:hidden bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-200 px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Info</span>
            </button>

            <div className="hidden sm:block w-px h-5 bg-white/15 mx-0.5" />

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleStepUnit(-1)}
                title="Kontrakan Sebelumnya"
                className="bg-white/10 hover:bg-white/20 text-white w-9 h-9 rounded-xl flex items-center justify-center transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleStepUnit(1)}
                title="Kontrakan Berikutnya"
                className="bg-white/10 hover:bg-white/20 text-white w-9 h-9 rounded-xl flex items-center justify-center transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Detail Drawer: Bottom Sheet (Mobile) | Right Glass Panel (Tablet & Desktop) */}
      <aside
        className={`fixed z-40 glass-panel-strong sm:glass-panel shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out
          inset-x-0 bottom-0 max-h-[78dvh] rounded-t-3xl
          sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-20 lg:bottom-4 sm:max-h-none sm:w-80 sm:rounded-2xl
          ${
            activeUnit && detailOpen
              ? 'translate-y-0 sm:translate-x-0 opacity-100 pointer-events-auto'
              : 'translate-y-full sm:translate-y-0 sm:translate-x-[120%] opacity-0 pointer-events-none'
          }`}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-white/25" />
        </div>

        {activeUnit && (
          <div className="p-5 overflow-y-auto flex-1 flex flex-col safe-bottom">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-lg shrink-0"
                  style={{ backgroundColor: activeUnit.warna_aksen || '#2563eb' }}
                >
                  #{String(activeUnit.nomor_unit).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-white leading-tight truncate">{activeUnit.nama_unit}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{formatBlockLabel(activeUnit.blok, activeUnit.lantai)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  activeUnit.status === 'kosong'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : activeUnit.status === 'maintenance'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                }`}
              >
                {activeUnit.status === 'kosong'
                  ? 'Tersedia / Kosong'
                  : activeUnit.status === 'maintenance'
                  ? 'Sedang Perbaikan'
                  : 'Sudah Ditempati'}
              </span>
              <span className="text-[11px] text-slate-400">360° • Klik titik lantai / WASD</span>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-400/30">
              <div className="text-[11px] uppercase tracking-wider text-sky-300 font-semibold">Harga Sewa / Bulan</div>
              <div className="text-2xl font-extrabold text-white mt-0.5">{formatRupiah(activeUnit.harga_bulanan)}</div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-slate-400 font-medium">Penghuni Saat Ini</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    {activeUnit.status === 'terisi'
                      ? `${activeUnit.penghuni_publik || 'Terisi'} (Privasi)`
                      : activeUnit.status === 'maintenance'
                      ? 'Dalam perawatan'
                      : 'Kosong — Siap huni'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-slate-400 font-medium">Ukuran Ruangan</div>
                  <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">{activeUnit.ukuran || '3.5 x 7 m'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">Fasilitas Unit</div>
                <div className="flex flex-wrap gap-1.5">
                  {(activeUnit.fasilitas || []).map((f, idx) => (
                    <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-slate-100 border border-white/10">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1">Deskripsi</div>
                <p className="text-xs text-slate-300 leading-relaxed">{activeUnit.deskripsi}</p>
              </div>
            </div>

            <div className="mt-auto pt-4">
              {activeUnit.status === 'kosong' ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200">
                  <div className="font-bold text-emerald-300 mb-1">Kontrakan Ini Tersedia!</div>
                  Ruangan kosongan bersih siap huni. Hubungi Admin Kontrakan Teh Amoy untuk survei & sewa.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Demi privasi penghuni, hanya nama depan & inisial yang ditampilkan di halaman publik.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Desktop Bottom Hint */}
      {!activeUnit && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden lg:block">
          <div className="glass-panel px-4 py-1.5 rounded-full text-[11px] text-slate-300 shadow">
            Drag untuk putar 3D • Scroll untuk zoom • <strong className="text-white">Klik unit / label</strong> untuk masuk ke dalam kontrakan
          </div>
        </div>
      )}
    </div>
  );
}
