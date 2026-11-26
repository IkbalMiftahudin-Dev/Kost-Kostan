import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PublicUnit } from './types';

export type InteriorRoomKey = 'depan' | 'tengah' | 'dapur' | 'kamar_mandi';

export interface RoomSpotInfo {
  key: InteriorRoomKey;
  label: string;
}

export const INTERIOR_ROOMS: RoomSpotInfo[] = [
  { key: 'depan', label: 'Ruang Depan' },
  { key: 'tengah', label: 'Ruang Tengah' },
  { key: 'dapur', label: 'Lorong Dapur' },
  { key: 'kamar_mandi', label: 'Kamar Mandi' },
];

interface RoomCameraPreset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  hotspotPos: THREE.Vector3;
}

interface UnitObjectEntry {
  unit: PublicUnit;
  group: THREE.Group;
  origin: THREE.Vector3;
  rotationY: number;
  blockRoof: THREE.Group | null;
  doorPivot: THREE.Group;
  doorTargetAngle: number;
  ceiling: THREE.Mesh;
  interiorLight: THREE.PointLight;
  highlightMat: THREE.MeshBasicMaterial;
  labelAnchor: THREE.Vector3;
  doorApproachPos: THREE.Vector3;
  doorApproachTarget: THREE.Vector3;
  cutawayCamPos: THREE.Vector3;
  cutawayTarget: THREE.Vector3;
  rooms: Record<InteriorRoomKey, RoomCameraPreset>;
  hotspots: Map<InteriorRoomKey, THREE.Group>;
}

interface TransitionState {
  type: 'enter' | 'exit' | 'cutaway' | 'reset' | 'room';
  unitId?: number;
  roomKey?: InteriorRoomKey;
  elapsed: number;
  duration: number;
  waypointsPos: THREE.Vector3[];
  waypointsTarget: THREE.Vector3[];
}

export interface ProjectedLabel {
  id: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface ProjectedLandmark {
  key: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface SceneCallbacks {
  onEnterUnit?: (unit: PublicUnit) => void;
  onExitUnit?: () => void;
  onRoomChange?: (room: InteriorRoomKey) => void;
  onFrameUpdate?: () => void;
}

/**
 * Kontrakan3DScene (Next.js / TypeScript)
 * Layout Lingkungan Asli:
 * - Paling Kiri (depan): Gedung Bertingkat (#07 bawah + tangga, #08 & #09 atas + balkon)
 * - Sebelah Kanan Bertingkat (depan): Deret 4 Memanjang (#01 - #04)
 * - Sebelah Kanan Deret 4 (depan): Rumah Pemilik Kost (Rumah Teh Amoy)
 * - Di Belakang Rumah Pemilik Kost: 2 Rumah Penghalang/Tetangga
 * - Di Belakang 2 Rumah Tersebut (terpisah via gang akses samping): Blok 2 Terpisah (#05 & #06)
 *
 * Fitur Interior Multi-Ruangan:
 * - 4 Spot Ruangan (Ruang Depan, Ruang Tengah, Lorong Dapur, Kamar Mandi) via tombol HUD & titik lantai 3D
 * - Putar 360° mulus di setiap ruangan tanpa tembus tembok + kontrol gerak bebas WASD / Arrow keys
 * - Mode Denah 3D (Cutaway)
 */
export class Kontrakan3DScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private worldGroup!: THREE.Group;

  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  private tileTexture!: THREE.CanvasTexture;
  private kitchenBacksplashTex!: THREE.CanvasTexture;
  private bathFloorTex!: THREE.CanvasTexture;
  private bathWallTex!: THREE.CanvasTexture;
  private roofTexture!: THREE.CanvasTexture;
  private paveTexture!: THREE.CanvasTexture;

  private unitObjects = new Map<number, UnitObjectEntry>();
  private clickableMeshes: THREE.Mesh[] = [];
  private hotspotMeshes: THREE.Mesh[] = [];
  private porchLights: Array<{ light: THREE.PointLight; bulbMat: THREE.MeshStandardMaterial }> = [];
  private windowGlowMats: THREE.MeshPhysicalMaterial[] = [];
  private blockRoofs: THREE.Group[] = [];
  private landmarkAnchors = new Map<string, THREE.Vector3>();

  public isNightMode = false;
  public isCutawayMode = false;
  public activeUnitId: number | null = null;
  public activeRoom: InteriorRoomKey = 'depan';
  private hoveredUnitId: number | null = null;
  private hoveredHotspot: THREE.Mesh | null = null;

  private transition: TransitionState | null = null;
  private lastComplexWidth = 42;
  private lastComplexCenterX = 0;
  private lastComplexCenterZ = -5;
  private overviewCamPos = new THREE.Vector3(0, 19, 32);
  private overviewTarget = new THREE.Vector3(0, 1.5, -5);

  private readonly ROOM_W = 4.0;
  private readonly ROOM_H = 3.15;
  private readonly ROOM_D = 7.0;
  private readonly TERRACE_D = 1.65;
  private readonly FLOOR_SLAB = 0.28;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private keysPressed = new Set<string>();

  private clock = new THREE.Clock();
  private elapsedTotal = 0;
  private animFrameId = 0;
  private disposed = false;

  private handleResizeBound: () => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, callbacks: SceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.handleResizeBound = this._onResize.bind(this);
    this.handlePointerDownBound = this._onPointerDown.bind(this);
    this.handlePointerMoveBound = this._onPointerMove.bind(this);
    this.handlePointerUpBound = this._onPointerUp.bind(this);
    this.handleKeyDownBound = this._onKeyDown.bind(this);
    this.handleKeyUpBound = this._onKeyUp.bind(this);

    this._initRenderer();
    this._initSceneAndLights();
    this._initTextures();
    this._initEvents();
    this._animate();
  }

  private _initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93c5fd);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0075);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.08, 240);
    this.camera.position.copy(this.overviewCamPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.75;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.controls.target.copy(this.overviewTarget);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 85;
    this.controls.update();

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
  }

  private _initSceneAndLights() {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x64748b, 0.88);
    this.hemiLight.position.set(0, 36, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.5);
    this.sunLight.position.set(22, 36, 26);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 130;
    const d = 46;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.48);
    this.fillLight.position.set(-20, 14, 18);
    this.scene.add(this.fillLight);
  }

  private _initTextures() {
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 256;
    tileCanvas.height = 256;
    const tctx = tileCanvas.getContext('2d')!;
    tctx.fillStyle = '#f5f7fa';
    tctx.fillRect(0, 0, 256, 256);
    tctx.strokeStyle = '#9ca3af';
    tctx.lineWidth = 2.5;
    for (let i = 0; i <= 256; i += 64) {
      tctx.beginPath(); tctx.moveTo(i, 0); tctx.lineTo(i, 256); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(0, i); tctx.lineTo(256, i); tctx.stroke();
    }
    this.tileTexture = new THREE.CanvasTexture(tileCanvas);
    this.tileTexture.wrapS = THREE.RepeatWrapping;
    this.tileTexture.wrapT = THREE.RepeatWrapping;
    this.tileTexture.repeat.set(3.5, 6);

    const bsCanvas = document.createElement('canvas');
    bsCanvas.width = 256;
    bsCanvas.height = 256;
    const bctx = bsCanvas.getContext('2d')!;
    bctx.fillStyle = '#e5e7eb';
    bctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 64) {
        bctx.fillStyle = (x / 64 + y / 32) % 2 === 0 ? '#f3f4f6' : '#dbe3e0';
        bctx.fillRect(x + 1, y + 1, 62, 30);
        bctx.fillStyle = '#cbd5e1';
        bctx.fillRect(x + 4, y + 14, 56, 2);
      }
    }
    this.kitchenBacksplashTex = new THREE.CanvasTexture(bsCanvas);
    this.kitchenBacksplashTex.wrapS = THREE.RepeatWrapping;
    this.kitchenBacksplashTex.wrapT = THREE.RepeatWrapping;
    this.kitchenBacksplashTex.repeat.set(2, 2);

    const bfCanvas = document.createElement('canvas');
    bfCanvas.width = 256;
    bfCanvas.height = 256;
    const bfctx = bfCanvas.getContext('2d')!;
    bfctx.fillStyle = '#dbeafe';
    bfctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 64) {
        bfctx.strokeStyle = '#64748b';
        bfctx.lineWidth = 3;
        bfctx.strokeRect(x + 2, y + 2, 60, 60);
        bfctx.strokeStyle = '#60a5fa';
        bfctx.lineWidth = 6;
        bfctx.strokeRect(x + 12, y + 12, 40, 40);
        bfctx.fillStyle = '#bfdbfe';
        bfctx.fillRect(x + 20, y + 20, 24, 24);
      }
    }
    this.bathFloorTex = new THREE.CanvasTexture(bfCanvas);
    this.bathFloorTex.wrapS = THREE.RepeatWrapping;
    this.bathFloorTex.wrapT = THREE.RepeatWrapping;
    this.bathFloorTex.repeat.set(2.2, 2.2);

    const bwCanvas = document.createElement('canvas');
    bwCanvas.width = 256;
    bwCanvas.height = 256;
    const bwctx = bwCanvas.getContext('2d')!;
    bwctx.fillStyle = '#cbd5e1';
    bwctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 64) {
        bwctx.fillStyle = (x + y) % 128 === 0 ? '#e2e8f0' : '#cbd5e1';
        bwctx.fillRect(x + 2, y + 2, 60, 60);
        bwctx.fillStyle = '#94a3b8';
        bwctx.beginPath();
        bwctx.arc(x + 32, y + 32, 12, 0, Math.PI * 2);
        bwctx.fill();
        bwctx.strokeStyle = '#64748b';
        bwctx.lineWidth = 2;
        bwctx.strokeRect(x, y, 64, 64);
      }
    }
    this.bathWallTex = new THREE.CanvasTexture(bwCanvas);
    this.bathWallTex.wrapS = THREE.RepeatWrapping;
    this.bathWallTex.wrapT = THREE.RepeatWrapping;
    this.bathWallTex.repeat.set(2.5, 2.5);

    const roofCanvas = document.createElement('canvas');
    roofCanvas.width = 256;
    roofCanvas.height = 256;
    const rctx = roofCanvas.getContext('2d')!;
    rctx.fillStyle = '#9a3412';
    rctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 24) {
      rctx.fillStyle = y % 48 === 0 ? '#b45309' : '#9a3412';
      rctx.fillRect(0, y, 256, 12);
      rctx.fillStyle = 'rgba(0,0,0,0.18)';
      rctx.fillRect(0, y + 20, 256, 4);
    }
    for (let x = 0; x < 256; x += 32) {
      rctx.fillStyle = 'rgba(0,0,0,0.12)';
      rctx.fillRect(x, 0, 2, 256);
    }
    this.roofTexture = new THREE.CanvasTexture(roofCanvas);
    this.roofTexture.wrapS = THREE.RepeatWrapping;
    this.roofTexture.wrapT = THREE.RepeatWrapping;
    this.roofTexture.repeat.set(5, 2);

    const paveCanvas = document.createElement('canvas');
    paveCanvas.width = 256;
    paveCanvas.height = 256;
    const pctx = paveCanvas.getContext('2d')!;
    pctx.fillStyle = '#cbd5e1';
    pctx.fillRect(0, 0, 256, 256);
    pctx.strokeStyle = '#94a3b8';
    pctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = -32; x < 256; x += 64) {
        pctx.fillStyle = (x + y) % 128 === 0 ? '#cbd5e1' : '#dbe3ec';
        pctx.fillRect(x + offset + 1, y + 1, 62, 30);
        pctx.strokeRect(x + offset, y, 64, 32);
      }
    }
    this.paveTexture = new THREE.CanvasTexture(paveCanvas);
    this.paveTexture.wrapS = THREE.RepeatWrapping;
    this.paveTexture.wrapT = THREE.RepeatWrapping;
    this.paveTexture.repeat.set(20, 14);
  }

  private _makeNumberPlateTexture(nomorUnit: number, status: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const bg = status === 'kosong' ? '#059669' : status === 'maintenance' ? '#d97706' : '#1e293b';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 112);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(nomorUnit).padStart(2, '0'), 128, 68);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private _makeSignboardTexture(title: string, subtitle: string, bgTop = '#0f172a', bgBot = '#1e3a8a', border = '#38bdf8'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 256);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = border;
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 996, 228);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 512, 102);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 34px sans-serif';
    ctx.fillText(subtitle, 512, 180);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Membangun Denah Lingkungan 100% Sesuai 3 Foto Google Maps & Street View:
   * - LINGKARAN KANAN-ATAS (z = -15, sisi kanan jalan):
   *     • Kiri: Gedung Bertingkat modern abu-putih + tangga besi hitam + pagar besi hitam (Foto 3: #07 bawah, #08 & #09 atas)
   *     • Kanan Bertingkat: 4 Kontrakan Melebar 1 Lantai tidak bertingkat (#01 - #04)
   * - JALAN BETON UTAMA membentang vertikal (Utara-Selatan) menghubungkan area Rumah Utama & Area Kost
   * - LINGKARAN TENGAH (z = +5, pinggir kiri jalan):
   *     • Rumah Utama Pemilik Kost 2 lantai abu-abu + toren biru + Warung Bubur Ayam Barokah (Foto 2)
   * - DI BELAKANG RUMAH UTAMA (ke arah kiri, z = +5):
   *     • 2 Rumah Warga Penghalang
   * - LINGKARAN KIRI (di belakang 2 rumah penghalang dari Rumah Utama):
   *     • Blok 2 Kontrakan Terpisah (#05 & #06) terhubung gang akses
   */
  public buildComplex(units: PublicUnit[]) {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.unitObjects.clear();
    this.clickableMeshes = [];
    this.hotspotMeshes = [];
    this.porchLights = [];
    this.windowGlowMats = [];
    this.blockRoofs = [];
    this.landmarkAnchors.clear();

    const tieredGroundUnits = units
      .filter((u) => u.blok === 'bertingkat' && Number(u.lantai) === 1)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const tieredUpperUnits = units
      .filter((u) => u.blok === 'bertingkat' && Number(u.lantai) >= 2)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const block4Units = units
      .filter((u) => u.blok === 'memanjang_4')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const block2Units = units
      .filter((u) => u.blok === 'memanjang_2')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const W = this.ROOM_W;
    const H = this.ROOM_H;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const SLAB = this.FLOOR_SLAB;

    const hasTiered = tieredGroundUnits.length > 0 || tieredUpperUnits.length > 0;
    const tieredBays = hasTiered ? Math.max(tieredUpperUnits.length, tieredGroundUnits.length + 1, 2) : 0;
    const tieredWidth = tieredBays * W;
    const block4Width = block4Units.length > 0 ? block4Units.length * W : 0;
    const block2Width = block2Units.length > 0 ? block2Units.length * W : 8.0;

    // =========================================================================
    // 1. TANAH, SAWAH UTARA, JALAN BETON UTAMA, DAN GANG PENGHUBUNG
    // =========================================================================
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 170),
      new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.05, -4);
    grass.receiveShadow = true;
    this.worldGroup.add(grass);

    // Petak sawah hijau di bagian jauh utara (persis bagian atas Foto 1 Google Earth)
    this._createDistantRiceFields();

    // Jalan Gang Beton di pinggir Rumah Punya Kost (diperkecil jadi 2.8m — gang lingkungan seperti Foto 2)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.88 });
    const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 70), roadMat);
    mainRoad.position.set(2.9, 0.0, 4);
    mainRoad.receiveShadow = true;
    this.worldGroup.add(mainRoad);

    // Gang sempit di depan Kontrakan 4 & Gedung Bertingkat (diperkecil jadi 2.4m!)
    const kostRoadZ = -7.2;
    const kostRoadW = Math.max(W + D + TD + block4Width + 6, 32);
    const kostRoad = new THREE.Mesh(
      new THREE.BoxGeometry(kostRoadW, 0.06, 2.4),
      new THREE.MeshStandardMaterial({ map: this.paveTexture, color: 0xe2e8f0, roughness: 0.85 })
    );
    kostRoad.position.set(2.0 + kostRoadW / 2 - 4.0, 0.01, kostRoadZ);
    kostRoad.receiveShadow = true;
    this.worldGroup.add(kostRoad);

    // Gang akses selatan Rumah Utama & Gang Barat depan Blok 2 (diperkecil jadi 2.2m)
    const frontGangZ = 15.6;
    const frontGang = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.06, 2.2),
      new THREE.MeshStandardMaterial({ map: this.paveTexture, color: 0xdbe3ec, roughness: 0.85 })
    );
    frontGang.position.set(-14.5, 0.01, frontGangZ);
    frontGang.receiveShadow = true;
    this.worldGroup.add(frontGang);

    const westAlleyX = -31.6;
    const westAlley = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.06, 24),
      new THREE.MeshStandardMaterial({ map: this.paveTexture, color: 0xdbe3ec, roughness: 0.85 })
    );
    westAlley.position.set(westAlleyX, 0.01, 7.8);
    westAlley.receiveShadow = true;
    this.worldGroup.add(westAlley);

    // =========================================================================
    // 2. LINGKARAN KANAN-ATAS: GEDUNG BERTINGKAT LETER L ASLI (PERSIS FOTO 3) + 4 KONTRAKAN BERPAGAR
    //    Bentuk Leter L Sejati:
    //    - Sayap Kiri-Belakang (x: -1.2..+2.8, z = -16.8):
    //        Lt.1: Halaman sudut L + Tangga Besi Hitam + Pagar Besi Hitam Berjaring (depan gang)
    //        Lt.2: Unit #08 menghadap DEPAN (+Z) di puncak tangga
    //    - Sayap Kanan-Depan (x = +8.0, z = -10.8, ROTASI -90° -> PINTU MENGHADAP KIRI -X ke halaman L!):
    //        Lt.1: Unit #07 (pintu ke kiri -X, dinding abu-abu + ventilasi kecil menghadap depan +Z persis Foto 3!)
    //        Lt.2: Unit #09 (pintu ke kiri -X ke koridor balkon L, parapet putih-abu berjenjang menghadap +Z!)
    // =========================================================================
    const upperBlockZ = -14.8;
    const tieredStartX = -1.2;
    const lBackZ = -16.8;
    const lWingX = tieredStartX + W + TD + D / 2 + 0.05; // = -1.2 + 4.0 + 1.65 + 3.5 + 0.05 = 8.0
    const lWingBaseZ = -10.8; // sisi depan sayap kanan di z = -8.8 (segaris pagar halaman!)
    const rightWingDepthX = D + TD; // 8.65m along X
    const extraRightWings = Math.max(1, tieredUpperUnits.length - 1, tieredGroundUnits.length);
    const tieredTotalFootprintW = W + rightWingDepthX; // 12.65m total X width of the L-building

    if (hasTiered) {
      const floor2Y = 0.08 + H + SLAB;
      const rightWingLenZ = extraRightWings * W;
      const rightWingCenterZ = lWingBaseZ - ((extraRightWings - 1) * W) / 2;

      // 1. Atap Modern Leter L Presisi (sambungan rapi tepat di x = +2.80, elevasi rata di atas tembok -> 0% nembus dinding!)
      const lRoofGroup = new THREE.Group();
      this.worldGroup.add(lRoofGroup);

      // Sayap kiri-belakang (x: -1.45 .. +2.80, z: -20.55 .. -11.45)
      const backWingRoof = this._createCleanFlatModernRoof(
        0.675,
        floor2Y + H + 0.04,
        -16.0,
        4.25,
        9.1
      );
      // Sayap kanan-depan (x: +2.80 .. +11.80, z: mencakup seluruh unit kanan #09)
      const rightWingRoof = this._createCleanFlatModernRoof(
        7.3,
        floor2Y + H + 0.04,
        rightWingCenterZ,
        9.0,
        rightWingLenZ + 0.55
      );
      lRoofGroup.add(backWingRoof, rightWingRoof);
      this.blockRoofs.push(lRoofGroup);

      // Sayap Kiri Lantai 1: Halaman sudut L + Tangga Besi Hitam terbuka + Pagar Besi Hitam Berjaring
      this._createPhoto3StaircaseAndGate(tieredStartX + W / 2, 0.08, lBackZ, floor2Y, W, 4.1);

      // Sayap Kanan Lantai 1: Unit #07 dengan PINTU MENGHADAP KIRI (-X) membentuk Leter L!
      tieredGroundUnits.forEach((unit, idx) => {
        const uz = lWingBaseZ - idx * W;
        this._createUnitRoom(unit, new THREE.Vector3(lWingX, 0.08, uz), null, {
          modernGreyExterior: true,
          rotationY: -Math.PI / 2,
          photo3SideVent: idx === 0,
        });
      });

      // Plat Lantai 2 berbentuk LETER L Presisi (sambungan rata di x = +2.80 tanpa tumpang tindih!)
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x525860, roughness: 0.7 });
      const backSlab = new THREE.Mesh(new THREE.BoxGeometry(4.15, SLAB + 0.06, 8.95), slabMat);
      backSlab.position.set(0.725, 0.08 + H + SLAB / 2, -16.0);
      backSlab.castShadow = true;
      backSlab.receiveShadow = true;
      this.worldGroup.add(backSlab);

      const rightSlab = new THREE.Mesh(new THREE.BoxGeometry(8.9, SLAB + 0.06, rightWingLenZ + 0.35), slabMat);
      rightSlab.position.set(7.25, 0.08 + H + SLAB / 2, rightWingCenterZ);
      rightSlab.castShadow = true;
      rightSlab.receiveShadow = true;
      this.worldGroup.add(rightSlab);

      // Balkon Parapet Putih-Abu berjenjang pada huruf L (persis Foto 3!)
      // 1. Parapet di puncak tangga sayap kiri-belakang (depan #08)
      this._createPhoto3BalconyParapet(tieredStartX, floor2Y, lBackZ + D / 2 + TD - 0.02, W, 1.35);
      // 2. Parapet besar menonjol menghadap depan gang (+Z) di sisi depan Unit #09 (sayap kanan L!)
      this._createPhoto3BalconyParapet(tieredStartX + W, floor2Y, lWingBaseZ + W / 2 - 0.04, rightWingDepthX, 0);
      // 3. Parapet koridor L sepanjang sisi kiri teras Unit #09 menghadap tangga (-X)
      const whiteWall = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
      const greyTrim = new THREE.MeshStandardMaterial({ color: 0x525860, roughness: 0.65 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
      const sideCorrLen = rightWingLenZ - 1.2;
      if (sideCorrLen > 0.5) {
        const sideCorrX = tieredStartX + W + 0.08;
        const sideCorrZ = lWingBaseZ + W / 2 - sideCorrLen / 2 - 0.1;
        this._addBox(this.worldGroup, 0.16, 0.74, sideCorrLen, sideCorrX, floor2Y + 0.37, sideCorrZ, whiteWall, true);
        this._addBox(this.worldGroup, 0.2, 0.08, sideCorrLen + 0.06, sideCorrX, floor2Y + 0.76, sideCorrZ, greyTrim);
        this._addBox(this.worldGroup, 0.05, 0.05, sideCorrLen, sideCorrX, floor2Y + 0.98, sideCorrZ, ironMat);
      }

      // Unit Lantai 2:
      // - Unit #08 (pertama): di sayap kiri-belakang menghadap DEPAN (+Z)
      // - Unit #09 (dan selanjutnya): di sayap kanan-depan dengan PINTU MENGHADAP KIRI (-X) membentuk Leter L!
      tieredUpperUnits.forEach((unit, idx) => {
        if (idx === 0) {
          this._createUnitRoom(unit, new THREE.Vector3(tieredStartX + W / 2, floor2Y, lBackZ), lRoofGroup, {
            modernGreyExterior: true,
          });
        } else {
          const uz = lWingBaseZ - (idx - 1) * W;
          this._createUnitRoom(unit, new THREE.Vector3(lWingX, floor2Y, uz), lRoofGroup, {
            modernGreyExterior: true,
            rotationY: -Math.PI / 2,
          });
        }
      });
    }

    // SEBELAH KANAN YANG BERTINGKAT: 4 Kontrakan Melebar 1 Lantai + PAGAR DEPAN (#01 - #04)
    const block4StartX = tieredStartX + tieredTotalFootprintW + 0.9;
    if (block4Units.length > 0) {
      const b4CenterX = block4StartX + block4Width / 2;
      const b4Roof = this._createPitchedRoof(b4CenterX, H + 0.14, upperBlockZ + TD * 0.35, block4Width + 0.85, D + TD + 1.1, 1.45);
      b4Roof.add(this._createFascia(block4Width + 0.55));
      this.blockRoofs.push(b4Roof);

      block4Units.forEach((unit, idx) => {
        const ux = block4StartX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, upperBlockZ), b4Roof, {
          modernGreyExterior: true,
          withFrontFence: true,
        });
      });
    }

    // =========================================================================
    // 3. LINGKARAN TENGAH: RUMAH UTAMA MENGHADAP KANAN (+X) — PENAMAAN PAKAI FLOATING BADGE SEPERTI KONTRAKAN
    // =========================================================================
    const lowerRowZ = 8.4;
    this._createPhoto2MainHouse(-2.6, 0.08, lowerRowZ);
    this.landmarkAnchors.set('rumah_utama', new THREE.Vector3(-2.6, 8.2, lowerRowZ));

    // =========================================================================
    // 4. 2 RUMAH PENGHALANG DI BELAKANG RUMAH UTAMA (ANTARA RUMAH UTAMA & BLOK 2)
    // =========================================================================
    this._createDecorativeHouse(-11.4, 0.08, lowerRowZ - 0.2, 4.8, 3.2, 6.8, {
      wallColor: 0xe2e8f0,
      roofColor: 0x7c2d12,
      trimColor: 0x64748b,
      signTitle: '',
      signSub: '',
    });
    this._createDecorativeHouse(-17.4, 0.08, lowerRowZ - 0.2, 4.8, 3.3, 6.8, {
      wallColor: 0xf1f5f9,
      roofColor: 0x9a3412,
      trimColor: 0x78716c,
      signTitle: '',
      signSub: '',
    });

    // =========================================================================
    // 5. LINGKARAN KIRI: BLOK 2 KONTRAKAN TERPISAH (#05 & #06) MENGHADAP KE KIRI (-X)
    // =========================================================================
    if (block2Units.length > 0) {
      const b2X = -25.2;
      const actualB2Len = block2Units.length * W;
      const b2StartZ = lowerRowZ - actualB2Len / 2;
      const b2CenterZ = lowerRowZ;

      const b2Roof = this._createPitchedRoof(b2X - TD * 0.35, H + 0.14, b2CenterZ, actualB2Len + 0.85, D + TD + 1.1, 1.45);
      b2Roof.rotation.y = -Math.PI / 2;
      b2Roof.add(this._createFascia(actualB2Len + 0.55));
      this.blockRoofs.push(b2Roof);

      block2Units.forEach((unit, idx) => {
        const uz = b2StartZ + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(b2X, 0.08, uz), b2Roof, {
          rotationY: -Math.PI / 2,
          withFrontFence: false,
        });
      });
    }

    // =========================================================================
    // 6. RUMAH-RUMAH WARGA SEKITAR (DIRAPATKAN KE TEPI GANG PERSIS GOOGLE MAPS!)
    // =========================================================================
    this._createSurroundingVillage(block4StartX + block4Width);

    // =========================================================================
    // 7. PAPAN NAMA UTAMA & LAMPU GANG
    // =========================================================================
    this._createMainSignboard(10.5, 0.04, kostRoadZ + 2.3);

    this._createGardenLamp(4.8, 0.04, 15.0);
    this._createGardenLamp(4.8, 0.04, 4.0);
    this._createGardenLamp(4.8, 0.04, -5.5);
    this._createGardenLamp(-14.0, 0.04, frontGangZ + 1.4);
    this._createGardenLamp(westAlleyX - 1.4, 0.04, 8.4);

    const totalSpanW = Math.max(54, block4StartX + block4Width + 30);
    this.lastComplexWidth = totalSpanW;
    this.lastComplexCenterX = -2.0;
    this.lastComplexCenterZ = -2.0;
    this._updateResponsiveCameraFraming(!this.activeUnitId);
    this.setNightMode(this.isNightMode);
  }

  /**
   * Rumah Utama Pemilik Kost (Persis Foto 2) — MENGHADAP KE KANAN (+X) ke gang beton
   * Tanpa banner 3D besar (penamaan memakai floating badge konsisten seperti kontrakan!)
   */
  private _createPhoto2MainHouse(cx: number, y: number, cz: number) {
    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    grp.rotation.y = Math.PI / 2;
    this.worldGroup.add(grp);

    const greyLight = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 });
    const greyDark = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 });
    const darkGlass = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.3 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 });

    const w = 6.2;
    const d = 7.4;
    const h1 = 3.2;
    const h2 = 3.1;
    const totalH = h1 + h2;

    this._addBox(grp, w, totalH, d - 1.4, 0, totalH / 2, -0.7, greyLight, true);

    this._addBox(grp, w, 0.16, 1.8, 0, 0.08, d / 2 - 0.5, new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 }), true);
    this._addBox(grp, 0.28, h1, 0.28, -w / 2 + 0.18, h1 / 2, d / 2 + 0.25, greyDark, true);
    this._addBox(grp, 0.28, h1, 0.28, 0.2, h1 / 2, d / 2 + 0.25, greyDark, true);
    this._addBox(grp, 0.28, h1, 0.28, w / 2 - 0.18, h1 / 2, d / 2 + 0.25, greyDark, true);
    this._addBox(grp, 2.8, 1.05, 0.08, -1.2, 0.62, d / 2 + 0.22, ironMat, true);

    this._addBox(grp, w + 0.15, 0.36, 1.9, 0, h1 + 0.18, d / 2 - 0.5, greyDark, true);
    this._addBox(grp, 0.32, h2, 1.7, -w / 2 + 0.16, h1 + h2 / 2, d / 2 - 0.5, greyDark, true);
    this._addBox(grp, 0.32, h2, 1.7, w / 2 - 0.16, h1 + h2 / 2, d / 2 - 0.5, greyDark, true);
    this._addBox(grp, 0.26, h2 - 0.2, 0.26, 0.15, h1 + h2 / 2, d / 2 + 0.22, greyDark, true);
    this._addBox(grp, w + 0.2, 0.55, 1.95, 0, totalH + 0.15, d / 2 - 0.48, greyDark, true);
    this._addBox(grp, 3.6, 2.0, 0.1, 0.6, h1 + 1.45, d / 2 - 1.38, darkGlass);

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-d / 2, 0);
    roofShape.lineTo(0, 1.8);
    roofShape.lineTo(d / 2, 0);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.3, bevelEnabled: false });
    roofGeo.center();
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ map: this.roofTexture, color: 0xc2410c, roughness: 0.78 }));
    roofMesh.rotation.y = Math.PI / 2;
    roofMesh.position.set(0, totalH + 0.9, -0.4);
    roofMesh.castShadow = true;
    grp.add(roofMesh);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 1.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 })
    );
    tank.position.set(1.3, totalH + 1.05, d / 2 - 0.7);
    tank.castShadow = true;
    grp.add(tank);

    // Warung "BUBUR AYAM BAROKAH" menempel di samping Rumah Utama
    const kioskX = -w / 2 - 1.75;
    this._addBox(grp, 3.3, 2.75, 4.6, kioskX, 1.375, 0.6, new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.85 }), true);
    this._addBox(grp, 2.3, 2.1, 0.08, kioskX, 1.05, 2.92, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.5 }));
    const kioskRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 5.4), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 }));
    kioskRoof.position.set(kioskX, 2.9, 0.85);
    kioskRoof.rotation.x = 0.14;
    kioskRoof.castShadow = true;
    grp.add(kioskRoof);

    const bannerTex = this._makeSignboardTexture('BUBUR AYAM', 'BAROKAH', '#fef2f2', '#fee2e2', '#dc2626');
    const banner = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.68, 0.06), [
      greyDark, greyDark, greyDark, greyDark,
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.4 }),
      greyDark,
    ]);
    banner.position.set(kioskX, 2.38, 3.05);
    grp.add(banner);
  }

  /**
   * Membangun lingkungan rumah-rumah warga padat rapat ke pinggir gang (persis Google Maps Foto 1 & Foto 2)
   */
  private _createSurroundingVillage(eastEdgeX: number) {
    const houseConfigs: Array<{ x: number; z: number; w: number; h: number; d: number; wall: number; roof: number; ry?: number }> = [
      // Sisi kanan gang utama (rapat ke pinggir gang 2.8m — termasuk rumah hijau 2 lantai Foto 2!)
      { x: 8.2, z: 3.5, w: 5.4, h: 5.4, d: 6.2, wall: 0x86efac, roof: 0x3f6212, ry: -Math.PI / 2 },
      { x: 8.4, z: 11.2, w: 5.6, h: 3.2, d: 6.2, wall: 0xfef3c7, roof: 0x9a3412, ry: -Math.PI / 2 },
      { x: 8.4, z: 18.8, w: 5.4, h: 3.3, d: 6.2, wall: 0xe2e8f0, roof: 0x7c2d12, ry: -Math.PI / 2 },
      // Rumah warga seberang gang depan Kontrakan 4 (z = -2.2, membentuk koridor gang 2.4m yang realistis!)
      { x: 15.6, z: -2.0, w: 6.0, h: 3.2, d: 5.8, wall: 0xf1f5f9, roof: 0xb45309 },
      { x: 22.4, z: -2.0, w: 5.8, h: 3.3, d: 5.8, wall: 0xe2e8f0, roof: 0x78350f },
      { x: 16.0, z: 5.6, w: 6.0, h: 3.2, d: 6.2, wall: 0xfde68a, roof: 0x9a3412 },
      { x: 16.2, z: 13.4, w: 5.8, h: 3.1, d: 6.0, wall: 0xf8fafc, roof: 0x9a3412 },
      { x: 23.0, z: 5.6, w: 5.8, h: 3.2, d: 6.2, wall: 0xfef3c7, roof: 0x7c2d12 },
      { x: 23.0, z: 13.4, w: 6.0, h: 3.2, d: 6.2, wall: 0xe2e8f0, roof: 0x9a3412 },

      // Barisan rumah warga selatan (rapat ke gang selatan 2.2m)
      { x: -3.0, z: 20.6, w: 6.2, h: 3.3, d: 6.0, wall: 0xfef3c7, roof: 0x9a3412 },
      { x: -10.8, z: 20.6, w: 5.8, h: 3.1, d: 5.8, wall: 0xe2e8f0, roof: 0x7c2d12 },
      { x: -18.2, z: 20.6, w: 5.8, h: 3.2, d: 6.0, wall: 0xf1f5f9, roof: 0xb45309 },
      { x: -25.8, z: 20.6, w: 6.0, h: 3.1, d: 5.8, wall: 0xfde68a, roof: 0x9a3412 },
      // Seberang gang barat Blok 2 (rapat ke gang barat 2.2m)
      { x: -36.8, z: 15.8, w: 5.6, h: 3.2, d: 6.2, wall: 0xe2e8f0, roof: 0x7c2d12, ry: Math.PI / 2 },
      { x: -36.8, z: 8.2, w: 5.6, h: 3.4, d: 6.2, wall: 0xfef3c7, roof: 0x9a3412, ry: Math.PI / 2 },
      { x: -36.8, z: 0.4, w: 5.6, h: 3.1, d: 6.0, wall: 0xf1f5f9, roof: 0xb45309, ry: Math.PI / 2 },

      // Rumah warga barat-utara (antara Blok 2 & Gedung Bertingkat seperti Foto 1)
      { x: -11.4, z: -2.4, w: 5.8, h: 3.2, d: 6.2, wall: 0xf8fafc, roof: 0x9a3412 },
      { x: -18.8, z: -2.4, w: 5.8, h: 3.3, d: 6.2, wall: 0xfef3c7, roof: 0x7c2d12 },
      { x: -26.2, z: -2.6, w: 5.6, h: 3.1, d: 6.0, wall: 0xe2e8f0, roof: 0xb45309 },
      { x: -10.8, z: -13.5, w: 6.2, h: 3.3, d: 6.4, wall: 0xf1f5f9, roof: 0x9a3412 },
      { x: -18.8, z: -13.5, w: 6.0, h: 3.2, d: 6.4, wall: 0xfde68a, roof: 0x7c2d12 },
      { x: -26.8, z: -13.5, w: 5.8, h: 3.1, d: 6.0, wall: 0xe2e8f0, roof: 0x9a3412 },

      // Rumah warga belakang utara area kost (z = -25.5)
      { x: -2.0, z: -25.5, w: 6.2, h: 3.2, d: 6.0, wall: 0xe2e8f0, roof: 0x9a3412 },
      { x: 6.0, z: -25.5, w: 6.0, h: 3.3, d: 6.0, wall: 0xfef3c7, roof: 0x7c2d12 },
      { x: 14.0, z: -25.5, w: 6.2, h: 3.1, d: 6.0, wall: 0xf1f5f9, roof: 0xb45309 },
      { x: 22.0, z: -25.5, w: 5.8, h: 3.2, d: 6.0, wall: 0xe2e8f0, roof: 0x9a3412 },
      { x: eastEdgeX + 5.6, z: -14.8, w: 5.6, h: 3.3, d: 6.4, wall: 0xfef3c7, roof: 0x7c2d12 },
      { x: eastEdgeX + 5.6, z: -5.5, w: 5.6, h: 3.1, d: 6.0, wall: 0xf1f5f9, roof: 0x9a3412 },
    ];

    const winMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });

    houseConfigs.forEach((h) => {
      const grp = new THREE.Group();
      grp.position.set(h.x, 0.06, h.z);
      if (h.ry) grp.rotation.y = h.ry;
      this.worldGroup.add(grp);

      const wallMat = new THREE.MeshStandardMaterial({ color: h.wall, roughness: 0.9 });
      this._addBox(grp, h.w, h.h, h.d, 0, h.h / 2, 0, wallMat, true);
      this._addBox(grp, 0.95, 1.95, 0.06, -h.w * 0.2, 1.0, h.d / 2 + 0.03, doorMat);
      this._addBox(grp, 1.1, 0.95, 0.06, h.w * 0.22, 1.55, h.d / 2 + 0.03, winMat);
      if (h.h > 4.5) {
        this._addBox(grp, 1.3, 1.0, 0.06, 0, h.h - 1.3, h.d / 2 + 0.03, winMat);
      }

      const rDepth = h.d + 1.0;
      const rHeight = 1.45;
      const shape = new THREE.Shape();
      shape.moveTo(-rDepth / 2, 0);
      shape.lineTo(0, rHeight);
      shape.lineTo(rDepth / 2, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h.w + 0.6, bevelEnabled: false });
      geo.center();
      const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.roofTexture, color: h.roof, roughness: 0.82 }));
      roof.rotation.y = Math.PI / 2;
      roof.position.set(0, h.h + rHeight / 2, 0);
      roof.castShadow = true;
      roof.receiveShadow = true;
      grp.add(roof);
    });

    this._createTree(-6.2, 0, -2.5, 1.1);
    this._createTree(-34.0, 0, 21.0, 1.2);
    this._createTree(eastEdgeX + 4.0, 0, -22.0, 1.3);
    this._createTree(-16.0, 0, -24.0, 1.2);
  }

  private _createDistantRiceFields() {
    const fieldColors = [0x4d7c0f, 0x65a30d, 0x3f6212, 0x84cc16];
    for (let i = 0; i < 6; i++) {
      const plot = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 22),
        new THREE.MeshStandardMaterial({ color: fieldColors[i % fieldColors.length], roughness: 0.96 })
      );
      plot.rotation.x = -Math.PI / 2;
      plot.position.set(-45 + i * 19, -0.02, -46);
      plot.receiveShadow = true;
      this.worldGroup.add(plot);
    }
  }

  /**
   * Atap datar-modern rapi dengan lisplang abu gelap (tinggi merata di atas plafon -> 0% menembus dinding!)
   */
  private _createCleanFlatModernRoof(cx: number, y: number, cz: number, width: number, depth: number) {
    const roofGroup = new THREE.Group();
    roofGroup.position.set(cx, y, cz);

    // Plafon / soffit bawah putih-abu
    const soffit = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.14, depth),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
    );
    soffit.position.set(0, 0.07, 0);
    soffit.castShadow = true;
    soffit.receiveShadow = true;
    roofGroup.add(soffit);

    // Lisplang beton modern abu-abu gelap rapi mengelilingi atap (tepat di batas width agar sambungan L mulus tanpa z-fighting)
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.36, depth),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55 })
    );
    fascia.position.set(0, 0.32, 0);
    fascia.castShadow = true;
    fascia.receiveShadow = true;
    roofGroup.add(fascia);

    // Penutup atap baja gelap di bagian paling atas (rapi & seragam pada kedua sayap huruf L)
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.24, 0.12, depth - 0.24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    cap.position.set(0, 0.55, 0);
    cap.castShadow = true;
    cap.receiveShadow = true;
    roofGroup.add(cap);

    return roofGroup;
  }

  /**
   * Tangga besi hitam terbuka di sudut L + pagar besi hitam berjaring sejajar sayap depan (persis Foto 3!)
   */
  private _createPhoto3StaircaseAndGate(cx: number, y: number, cz: number, floor2Y: number, totalTieredW: number, lFrontOffset = 3.0) {
    const W = this.ROOM_W;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const totalRise = floor2Y - y;

    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    this.worldGroup.add(grp);

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
    const wallGrey = new THREE.MeshStandardMaterial({ color: 0x7c8288, roughness: 0.85 });

    // Lantai halaman sudut L memanjang sampai garis pagar depan
    const courtD = D + TD + lFrontOffset + 0.5;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, courtD), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 }));
    floor.position.set(0, 0.05, (TD + lFrontOffset + 0.5) / 2);
    floor.receiveShadow = true;
    grp.add(floor);

    // Tembok pembatas kiri abu-abu penuh sampai garis pagar depan (persis Foto 3)
    this._addBox(grp, 0.18, totalRise, D + TD, -W / 2 + 0.09, totalRise / 2, TD / 2, wallGrey, true);
    this._addBox(grp, 0.18, 2.25, lFrontOffset + 0.5, -W / 2 + 0.09, 1.125, D / 2 + TD + (lFrontOffset + 0.5) / 2, wallGrey, true);
    this._addBox(grp, W, totalRise, 0.18, 0, totalRise / 2, -D / 2 + 0.09, wallGrey, true);
    this._addBox(grp, 0.28, totalRise, 0.28, W / 2 - 0.14, totalRise / 2, D / 2 + TD - 0.18, wallGrey, true);

    // Tangga Besi Hitam Terbuka menempel tembok kiri naik ke lantai 2 sayap belakang (#08)
    const steps = 13;
    const stepW = 1.15;
    const stepH = totalRise / steps;
    const stairStartZ = D / 2 + TD + lFrontOffset - 0.35;
    const stairRun = 4.5;
    const stepD = stairRun / steps;

    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, 0.07, stepD * 0.9), ironMat);
      step.position.set(-W / 2 + stepW / 2 + 0.24, (i + 0.8) * stepH, stairStartZ - i * stepD);
      step.castShadow = true;
      grp.add(step);
    }

    const railLen = Math.hypot(stairRun, totalRise);
    const angle = Math.atan2(totalRise, stairRun);
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, railLen), ironMat);
    stringer.position.set(-W / 2 + stepW + 0.24, totalRise / 2, stairStartZ - stairRun / 2);
    stringer.rotation.x = angle;
    grp.add(stringer);

    const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, railLen), ironMat);
    handrail.position.set(-W / 2 + stepW + 0.24, totalRise / 2 + 0.92, stairStartZ - stairRun / 2);
    handrail.rotation.x = angle;
    grp.add(handrail);

    // Pagar Besi Hitam Berjaring Depan sejajar sayap depan huruf L (persis Foto 3!)
    const gateZ = D / 2 + TD + lFrontOffset + 0.35;
    const gateH = 1.28;
    const panelW = W - 1.25;
    const panelCenterX = 0.55;
    this._addBox(grp, panelW, 0.06, 0.06, panelCenterX, gateH, gateZ, ironMat);
    this._addBox(grp, panelW, 0.06, 0.06, panelCenterX, 0.18, gateZ, ironMat);
    for (let gx = panelCenterX - panelW / 2; gx <= panelCenterX + panelW / 2 + 0.01; gx += 0.42) {
      this._addBox(grp, 0.04, gateH, 0.04, gx, gateH / 2 + 0.06, gateZ, ironMat);
    }
    const meshPane = new THREE.Mesh(
      new THREE.PlaneGeometry(panelW - 0.1, gateH - 0.16),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    meshPane.position.set(panelCenterX, gateH / 2 + 0.06, gateZ);
    grp.add(meshPane);

    // Daun gerbang kiri terbuka ke depan (persis Foto 3!)
    const openLeaf = new THREE.Group();
    openLeaf.position.set(-W / 2 + 0.18, 0, gateZ);
    openLeaf.rotation.y = 1.15;
    grp.add(openLeaf);
    this._addBox(openLeaf, 0.95, 0.06, 0.06, 0.48, gateH, 0, ironMat);
    this._addBox(openLeaf, 0.95, 0.06, 0.06, 0.48, 0.18, 0, ironMat);
    this._addBox(openLeaf, 0.05, gateH, 0.05, 0.02, gateH / 2 + 0.06, 0, ironMat);
    this._addBox(openLeaf, 0.05, gateH, 0.05, 0.94, gateH / 2 + 0.06, 0, ironMat);

    if (totalTieredW > W) {
      this._addBox(grp, 0.16, gateH + 0.1, 0.16, W / 2 - 0.08, (gateH + 0.1) / 2, gateZ, ironMat, true);
    }
  }

  /**
   * Balkon Parapet Putih dengan Lis Abu-Abu Tua & Railing Besi Hitam Inset (Persis Foto 3!)
   */
  private _createPhoto3BalconyParapet(startX: number, floorY: number, frontZ: number, totalWidth: number, opening = 1.45) {
    const whiteWall = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
    const greyTrim = new THREE.MeshStandardMaterial({ color: 0x525860, roughness: 0.65 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });

    const parapetW = Math.max(1.2, totalWidth - opening);
    const centerX = startX + opening + parapetW / 2;

    this._addBox(this.worldGroup, parapetW, 0.74, 0.16, centerX, floorY + 0.37, frontZ, whiteWall, true);
    this._addBox(this.worldGroup, parapetW + 0.08, 0.09, 0.2, centerX, floorY + 0.04, frontZ, greyTrim);
    this._addBox(this.worldGroup, parapetW + 0.08, 0.09, 0.2, centerX, floorY + 0.76, frontZ, greyTrim);

    const pillarCount = Math.max(1, Math.floor(parapetW / 2.2));
    for (let i = 0; i <= pillarCount; i++) {
      const px = startX + opening + (i / pillarCount) * parapetW;
      this._addBox(this.worldGroup, 0.46, 1.08, 0.18, px, floorY + 0.54, frontZ, whiteWall, true);
      this._addBox(this.worldGroup, 0.52, 0.09, 0.22, px, floorY + 1.08, frontZ, greyTrim);
    }

    this._addBox(this.worldGroup, parapetW - 0.1, 0.05, 0.05, centerX, floorY + 1.0, frontZ, ironMat);
    this._addBox(this.worldGroup, parapetW - 0.1, 0.04, 0.04, centerX, floorY + 0.87, frontZ, ironMat);

    const sideDepth = this.TERRACE_D;
    this._addBox(this.worldGroup, 0.16, 0.96, sideDepth, startX + totalWidth - 0.08, floorY + 0.48, frontZ - sideDepth / 2, whiteWall, true);
  }

  /**
   * Membangun rumah non-sewa (Rumah Pemilik Kost & 2 Rumah Warga Penghalang di belakangnya)
   */
  private _createDecorativeHouse(
    cx: number,
    y: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    opts: { wallColor: number; roofColor: number; trimColor: number; signTitle: string; signSub: string }
  ) {
    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    this.worldGroup.add(grp);

    const wallMat = new THREE.MeshStandardMaterial({ color: opts.wallColor, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: opts.trimColor, roughness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45, roughness: 0.15 });

    // Badan rumah
    this._addBox(grp, w, h, d, 0, h / 2, 0, wallMat, true);
    // Teras kecil depan
    this._addBox(grp, w, 0.16, 1.4, 0, 0.08, d / 2 + 0.7, new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 }), true);
    // Pilar teras
    this._addBox(grp, 0.22, h, 0.22, -w / 2 + 0.2, h / 2, d / 2 + 1.25, trimMat, true);
    this._addBox(grp, 0.22, h, 0.22, w / 2 - 0.2, h / 2, d / 2 + 1.25, trimMat, true);

    // Pintu & jendela depan
    this._addBox(grp, 1.15, 2.15, 0.08, 0, 1.12, d / 2 + 0.03, woodMat);
    if (w >= 6.5) {
      this._addBox(grp, 1.3, 1.15, 0.08, -w * 0.28, 1.65, d / 2 + 0.03, woodMat);
      this._addBox(grp, 1.2, 1.05, 0.09, -w * 0.28, 1.65, d / 2 + 0.04, glassMat);
      this._addBox(grp, 1.3, 1.15, 0.08, w * 0.28, 1.65, d / 2 + 0.03, woodMat);
      this._addBox(grp, 1.2, 1.05, 0.09, w * 0.28, 1.65, d / 2 + 0.04, glassMat);
    } else {
      this._addBox(grp, 0.95, 1.05, 0.08, w * 0.26, 1.65, d / 2 + 0.03, woodMat);
      this._addBox(grp, 0.85, 0.95, 0.09, w * 0.26, 1.65, d / 2 + 0.04, glassMat);
    }

    // Atap pelana tersendiri
    const roofDepth = d + 2.0;
    const ridgeH = Math.min(1.85, w * 0.24);
    const shape = new THREE.Shape();
    shape.moveTo(-roofDepth / 2, 0);
    shape.lineTo(0, ridgeH);
    shape.lineTo(roofDepth / 2, 0);
    shape.closePath();
    const extrude = new THREE.ExtrudeGeometry(shape, { depth: w + 0.7, bevelEnabled: false });
    extrude.center();
    const roof = new THREE.Mesh(extrude, new THREE.MeshStandardMaterial({ color: opts.roofColor, roughness: 0.78 }));
    roof.rotation.y = Math.PI / 2;
    roof.position.set(0, h + ridgeH / 2, 0.55);
    roof.castShadow = true;
    roof.receiveShadow = true;
    grp.add(roof);

    // Papan label kecil hanya jika ada signTitle
    if (opts.signTitle) {
      const signTex = this._makeSignboardTexture(opts.signTitle, opts.signSub, '#1e293b', '#334155', '#94a3b8');
      const signW = Math.min(3.0, w * 0.68);
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(signW, 0.72, 0.06),
        [
          trimMat, trimMat, trimMat, trimMat,
          new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 }),
          trimMat,
        ]
      );
      signBoard.position.set(0, h - 0.48, d / 2 + 1.38);
      grp.add(signBoard);
    }
  }

  private _updateResponsiveCameraFraming(applyImmediately = false) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const complexW = this.lastComplexWidth || 42;

    // Sudut tinggi ala Google Earth agar 3 area (Kanan-Atas Kost, Tengah Rumah Utama, Kiri Blok 2) terlihat jelas
    let fov = 46;
    let camY = 26.5;
    let camZ = Math.max(36, complexW * 0.72);

    if (aspect < 0.72) {
      fov = 56;
      camY = 34.0;
      camZ = Math.max(54, complexW * 1.08);
    } else if (aspect < 1.15) {
      fov = 52;
      camY = 30.0;
      camZ = Math.max(44, complexW * 0.88);
    }

    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.overviewTarget.set(this.lastComplexCenterX, 1.0, this.lastComplexCenterZ);
    this.overviewCamPos.set(this.lastComplexCenterX - 2.0, camY, camZ);
    this.controls.maxDistance = Math.max(95, camZ + 32);

    if (applyImmediately && !this.activeUnitId && !this.transition) {
      this.camera.position.copy(this.overviewCamPos);
      this.controls.target.copy(this.overviewTarget);
      this.controls.update();
    }
  }

  private _localToWorld(origin: THREE.Vector3, rotationY: number, lx: number, ly: number, lz: number): THREE.Vector3 {
    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    return new THREE.Vector3(
      origin.x + lx * c + lz * s,
      origin.y + ly,
      origin.z - lx * s + lz * c
    );
  }

  private _createUnitRoom(
    unit: PublicUnit,
    origin: THREE.Vector3,
    blockRoof: THREE.Group | null,
    opts: { modernGreyExterior?: boolean; withFrontFence?: boolean; photo3SideVent?: boolean; rotationY?: number } = {}
  ) {
    const W = this.ROOM_W;
    const H = this.ROOM_H;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const wallT = 0.13;
    const rotationY = opts.rotationY ?? 0;

    const unitGroup = new THREE.Group();
    unitGroup.position.copy(origin);
    unitGroup.rotation.y = rotationY;
    this.worldGroup.add(unitGroup);

    const accentColor = new THREE.Color(unit.warna_aksen || '#2563eb');
    // Eksterior abu-abu modern untuk area bertingkat & 4 melebar (persis Foto 3), krem hangat untuk Blok 2
    const wallExtMat = new THREE.MeshStandardMaterial({
      color: opts.modernGreyExterior ? 0x8b9197 : 0xf5e6cc,
      roughness: 0.85,
    });
    const wallIntMat = new THREE.MeshStandardMaterial({ color: 0xefd2a7, roughness: 0.9 });
    const skirtingMat = new THREE.MeshStandardMaterial({ color: 0x525860, roughness: 0.55 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.58 });
    const trimMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55 });

    // Lantai Keramik Putih Mengkilap
    const floorMat = new THREE.MeshStandardMaterial({ map: this.tileTexture, roughness: 0.28, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.12, D), floorMat);
    floor.position.set(0, 0.06, 0);
    floor.receiveShadow = true;
    unitGroup.add(floor);

    const terrace = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.12, TD),
      new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.78 })
    );
    terrace.position.set(0, 0.05, D / 2 + TD / 2);
    terrace.receiveShadow = true;
    unitGroup.add(terrace);

    // Pilar Teras Depan
    this._addBox(unitGroup, 0.18, H, 0.18, W / 2 - 0.12, H / 2, D / 2 + TD - 0.14, new THREE.MeshStandardMaterial({ color: opts.modernGreyExterior ? 0x64748b : 0xe2e8f0, roughness: 0.7 }), true);

    // Pagar Depan untuk Kontrakan 4 Melebar (tembok pendek abu + pagar besi hitam + bukaan gerbang di depan pintu)
    if (opts.withFrontFence) {
      const fzFence = D / 2 + TD + 0.08;
      const wallLowMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });

      // Tiang pagar kiri & kanan
      this._addBox(unitGroup, 0.22, 1.32, 0.22, -W / 2 + 0.11, 0.66, fzFence, wallLowMat, true);
      this._addBox(unitGroup, 0.22, 1.32, 0.22, W / 2 - 0.11, 0.66, fzFence, wallLowMat, true);
      // Tiang pemisah gerbang pintu (pintu di x: -1.52..-0.56, jadi pagar utama menutup sisi kanan x: -0.35..+1.88)
      this._addBox(unitGroup, 0.16, 1.28, 0.16, -0.38, 0.64, fzFence, wallLowMat, true);

      // Tembok bawah pagar sisi kanan
      this._addBox(unitGroup, 2.15, 0.52, 0.12, 0.76, 0.26, fzFence, wallLowMat, true);
      // Kisi besi hitam atas tembok pagar
      this._addBox(unitGroup, 2.16, 0.05, 0.05, 0.76, 1.24, fzFence, ironMat);
      this._addBox(unitGroup, 2.16, 0.05, 0.05, 0.76, 0.56, fzFence, ironMat);
      for (let gx = -0.25; gx <= 1.76; gx += 0.25) {
        this._addBox(unitGroup, 0.035, 0.7, 0.035, gx, 0.9, fzFence, ironMat);
      }

      // Daun gerbang besi terbuka ke dalam di depan pintu
      const gateLeaf = new THREE.Group();
      gateLeaf.position.set(-W / 2 + 0.22, 0, fzFence);
      gateLeaf.rotation.y = -1.15;
      unitGroup.add(gateLeaf);
      this._addBox(gateLeaf, 1.22, 0.05, 0.05, 0.61, 1.22, 0, ironMat);
      this._addBox(gateLeaf, 1.22, 0.05, 0.05, 0.61, 0.18, 0, ironMat);
      for (let bx = 0.06; bx <= 1.2; bx += 0.28) {
        this._addBox(gateLeaf, 0.035, 1.06, 0.035, bx, 0.7, 0, ironMat);
      }
    }

    // Jendela ventilasi kecil horizontal di dinding luar abu-abu lantai 1 (pada #07 yang menghadap kiri, dinding +X lokal menghadap depan +Z persis Foto 3!)
    if (opts.photo3SideVent) {
      const ventFrame = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.6 });
      this._addBox(unitGroup, 0.08, 0.3, 0.72, W / 2 + 0.02, 2.18, 0.45, ventFrame);
      // Warna abu-abu modern untuk dinding luar kanan (+X lokal = tampak depan +Z saat rotasi -90°)
      this._addBox(unitGroup, 0.04, H, D, W / 2 + 0.005, H / 2, 0, new THREE.MeshStandardMaterial({ color: 0x8b9197, roughness: 0.85 }));
    }

    this._addBox(unitGroup, W - 0.02, 0.24, 0.05, 0, 0.16, D / 2 + 0.04, trimMat);

    // Dinding Utama & Plint Keramik Abu Gelap
    this._addBox(unitGroup, W, H, wallT, 0, H / 2, -D / 2 + wallT / 2, wallIntMat, true);
    this._addBox(unitGroup, wallT, H, D, -W / 2 + wallT / 2, H / 2, 0, wallIntMat, true);
    this._addBox(unitGroup, wallT, H, D, W / 2 - wallT / 2, H / 2, 0, wallIntMat, true);

    const skH = 0.12;
    const skY = 0.12 + skH / 2;
    this._addBox(unitGroup, 0.02, skH, D - 0.2, -W / 2 + wallT + 0.01, skY, 0, skirtingMat);
    this._addBox(unitGroup, 0.02, skH, D - 0.2, W / 2 - wallT - 0.01, skY, 0, skirtingMat);
    this._addBox(unitGroup, W - 0.2, skH, 0.02, 0, skY, -D / 2 + wallT + 0.01, skirtingMat);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.04, 0.1, D - 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 })
    );
    ceiling.position.set(0, H - 0.05, 0);
    unitGroup.add(ceiling);

    // Dinding Depan: Pintu Kiri + Jendela 2 Daun + 2 Boven
    const fz = D / 2 - wallT / 2;
    this._addBox(unitGroup, 0.48, H, wallT, -W / 2 + 0.24, H / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.96, H - 2.14, wallT, -1.04, 2.14 + (H - 2.14) / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.68, H, wallT, -0.22, H / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 1.36, 1.02, wallT, 0.8, 0.51, fz, wallExtMat, true);
    this._addBox(unitGroup, 1.36, H - 2.18, wallT, 0.8, 2.18 + (H - 2.18) / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.52, H, wallT, W / 2 - 0.26, H / 2, fz, wallExtMat, true);

    this._addBox(unitGroup, 0.06, 2.14, 0.17, -1.52, 1.07, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 2.14, 0.17, -0.56, 1.07, fz, darkWoodMat);
    this._addBox(unitGroup, 1.02, 0.06, 0.17, -1.04, 2.14, fz, darkWoodMat);

    this._addBox(unitGroup, 1.42, 0.06, 0.17, 0.8, 1.02, fz, darkWoodMat);
    this._addBox(unitGroup, 1.42, 0.06, 0.17, 0.8, 2.18, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.16, 0.17, 0.12, 1.6, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.16, 0.17, 1.48, 1.6, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.14, 0.16, 0.8, 1.6, fz, darkWoodMat);

    const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.7 });
    this._addBox(unitGroup, 0.52, 0.16, 0.16, 0.44, 2.42, fz, ventMat);
    this._addBox(unitGroup, 0.52, 0.16, 0.16, 1.16, 2.42, fz, ventMat);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.36,
      roughness: 0.1,
      metalness: 0.08,
      emissive: new THREE.Color(0xfef08a),
      emissiveIntensity: 0.0,
    });
    this.windowGlowMats.push(glassMat);
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.12), glassMat);
    glassPane.position.set(0.8, 1.6, fz + 0.02);
    unitGroup.add(glassPane);

    // Pintu Berengsel
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-1.5, 0.12, fz);
    unitGroup.add(doorPivot);

    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.02, 0.06), new THREE.MeshStandardMaterial({ color: 0x4b3326, roughness: 0.55 }));
    doorMesh.position.set(0.46, 1.01, 0);
    doorMesh.castShadow = true;
    doorPivot.add(doorMesh);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
    const handleFront = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), handleMat);
    handleFront.position.set(0.82, 0.96, 0.055);
    doorPivot.add(handleFront);
    const handleBack = handleFront.clone();
    handleBack.position.set(0.82, 0.96, -0.055);
    doorPivot.add(handleBack);

    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ map: this._makeNumberPlateTexture(unit.nomor_unit, unit.status), roughness: 0.4 })
    );
    plateMesh.position.set(-1.04, 2.52, fz + 0.08);
    unitGroup.add(plateMesh);

    const sconceBulbMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde047, emissiveIntensity: 0.25 });
    const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), sconceBulbMat);
    sconce.position.set(-0.22, 2.48, fz + 0.13);
    unitGroup.add(sconce);

    const porchLight = new THREE.PointLight(0xffedd5, 0.0, 6.5);
    porchLight.position.set(-0.22, 2.35, fz + 0.45);
    unitGroup.add(porchLight);
    this.porchLights.push({ light: porchLight, bulbMat: sconceBulbMat });

    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbeb, emissiveIntensity: 0.9 });
    const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), bulbMat);
    lamp1.position.set(0, H - 0.16, 2.35);
    unitGroup.add(lamp1);
    const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), bulbMat);
    lamp2.position.set(-0.2, H - 0.16, -0.2);
    unitGroup.add(lamp2);

    const interiorLight = new THREE.PointLight(0xfff7ed, 0.65, 12);
    interiorLight.position.set(0, H - 0.45, 0.35);
    unitGroup.add(interiorLight);

    // Struktur Ruangan Persis Video
    this._buildRealVideoStructure(unitGroup, W, H, wallIntMat, skirtingMat, darkWoodMat);

    // Unit KOSONG 100% kosongan polos; unit TERISI ada perabotan minimalis
    if (unit.status === 'terisi') {
      this._buildMinimalOccupiedItems(unitGroup, accentColor);
    }

    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.06, H - 0.06, D + TD * 0.6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, H / 2, TD * 0.25);
    hitBox.userData.unitId = unit.id;
    unitGroup.add(hitBox);
    this.clickableMeshes.push(hitBox);

    const highlightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0 });
    const highlightStrip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.05, 0.16), highlightMat);
    highlightStrip.position.set(0, 0.13, D / 2 + TD - 0.08);
    unitGroup.add(highlightStrip);

    // =========================================================================
    // 4 TITIK RUANGAN INTERAKTIF (Mendukung rotasi unit ke segala arah!)
    // =========================================================================
    const worldOrigin = origin.clone();
    const mkPoint = (lx: number, ly: number, lz: number) => this._localToWorld(worldOrigin, rotationY, lx, ly, lz);
    const mkLookTarget = (pos: THREE.Vector3, lookAt: THREE.Vector3) => {
      const dir = lookAt.clone().sub(pos).normalize();
      return pos.clone().addScaledVector(dir, 0.42);
    };

    const pDepan = mkPoint(0.2, 1.56, 2.48);
    const pTengah = mkPoint(-0.25, 1.56, 0.12);
    const pDapur = mkPoint(0.86, 1.54, -1.92);
    const pKamarMandi = mkPoint(-0.42, 1.5, -2.18);

    const rooms: Record<InteriorRoomKey, RoomCameraPreset> = {
      depan: {
        pos: pDepan,
        target: mkLookTarget(pDepan, mkPoint(-0.65, 1.4, 0.9)),
        hotspotPos: new THREE.Vector3(0.2, 0.135, 2.45),
      },
      tengah: {
        pos: pTengah,
        target: mkLookTarget(pTengah, mkPoint(0.6, 1.35, -1.8)),
        hotspotPos: new THREE.Vector3(-0.25, 0.135, 0.12),
      },
      dapur: {
        pos: pDapur,
        target: mkLookTarget(pDapur, mkPoint(1.5, 1.2, -2.35)),
        hotspotPos: new THREE.Vector3(0.86, 0.135, -1.92),
      },
      kamar_mandi: {
        pos: pKamarMandi,
        target: mkLookTarget(pKamarMandi, mkPoint(-1.35, 1.08, -2.95)),
        hotspotPos: new THREE.Vector3(-0.55, 0.145, -2.22),
      },
    };

    const hotspots = new Map<InteriorRoomKey, THREE.Group>();
    (Object.keys(rooms) as InteriorRoomKey[]).forEach((roomKey) => {
      const hsGroup = this._createFloorHotspot(unit.id, roomKey, rooms[roomKey].hotspotPos);
      hsGroup.visible = false;
      unitGroup.add(hsGroup);
      hotspots.set(roomKey, hsGroup);
    });

    this.unitObjects.set(unit.id, {
      unit,
      group: unitGroup,
      origin: worldOrigin,
      rotationY,
      blockRoof,
      doorPivot,
      doorTargetAngle: 0,
      ceiling,
      interiorLight,
      highlightMat,
      labelAnchor: mkPoint(0, H + 0.55, D / 2 + 0.65),
      doorApproachPos: mkPoint(-0.9, 1.62, D / 2 + TD + 2.5),
      doorApproachTarget: mkPoint(-0.5, 1.4, 0.5),
      cutawayCamPos: mkPoint(0.2, 8.8, 5.6),
      cutawayTarget: mkPoint(0, 0.6, -0.2),
      rooms,
      hotspots,
    });
  }

  private _createFloorHotspot(unitId: number, roomKey: InteriorRoomKey, localPos: THREE.Vector3): THREE.Group {
    const grp = new THREE.Group();
    grp.position.copy(localPos);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.29, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
    );
    outerRing.rotation.x = -Math.PI / 2;
    grp.add(outerRing);

    const innerDisk = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 24),
      new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide, transparent: true, opacity: 0.42 })
    );
    innerDisk.rotation.x = -Math.PI / 2;
    innerDisk.position.y = 0.005;
    innerDisk.userData = { hotspotUnitId: unitId, hotspotRoom: roomKey };
    grp.add(innerDisk);
    this.hotspotMeshes.push(innerDisk);

    return grp;
  }

  private _updateHotspotsVisibility() {
    for (const [id, obj] of this.unitObjects.entries()) {
      const isCurrentUnit = id === this.activeUnitId && !this.isCutawayMode;
      for (const [roomKey, hsGrp] of obj.hotspots.entries()) {
        hsGrp.visible = isCurrentUnit && roomKey !== this.activeRoom;
      }
    }
  }

  private _buildRealVideoStructure(
    group: THREE.Group,
    W: number,
    H: number,
    wallIntMat: THREE.Material,
    skirtingMat: THREE.Material,
    darkWoodMat: THREE.Material
  ) {
    const skH = 0.12;
    const skY = 0.12 + skH / 2;
    const partZ = 1.35;
    const pT = 0.12;

    this._addBox(group, 0.55, H, pT, -1.625, H / 2, partZ, wallIntMat, true);
    this._addBox(group, 1.0, H - 2.15, pT, -0.85, 2.15 + (H - 2.15) / 2, partZ, wallIntMat, true);
    this._addBox(group, 2.25, H, pT, 0.775, H / 2, partZ, wallIntMat, true);

    this._addBox(group, 2.22, skH, 0.02, 0.77, skY, partZ + pT / 2 + 0.01, skirtingMat);
    this._addBox(group, 2.22, skH, 0.02, 0.77, skY, partZ - pT / 2 - 0.01, skirtingMat);
    this._addBox(group, 0.52, skH, 0.02, -1.62, skY, partZ + pT / 2 + 0.01, skirtingMat);
    this._addBox(group, 0.52, skH, 0.02, -1.62, skY, partZ - pT / 2 - 0.01, skirtingMat);

    this._addBox(group, 0.06, 2.15, 0.16, -1.35, 1.075, partZ, darkWoodMat);
    this._addBox(group, 0.06, 2.15, 0.16, -0.35, 1.075, partZ, darkWoodMat);
    this._addBox(group, 1.06, 0.06, 0.16, -0.85, 2.15, partZ, darkWoodMat);

    const switchMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    this._addBox(group, 0.03, 0.11, 0.1, W / 2 - 0.14, 1.45, 2.55, switchMat);
    this._addBox(group, 0.03, 0.11, 0.1, -W / 2 + 0.14, 0.48, 0.15, switchMat);
    this._addBox(group, 0.03, 0.11, 0.1, 0.25, 1.38, -1.35, switchMat);

    // Meja Dapur Beton Cor Permanen + Backsplash Keramik
    const counterBaseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
    const counterTopMat = new THREE.MeshStandardMaterial({ color: 0x4b382d, roughness: 0.35 });
    this._addBox(group, 0.56, 0.07, 1.65, 1.56, 0.8, -2.25, counterTopMat, true);
    this._addBox(group, 0.54, 0.68, 0.08, 1.56, 0.44, -1.46, counterBaseMat, true);
    this._addBox(group, 0.54, 0.68, 0.08, 1.56, 0.44, -3.04, counterBaseMat, true);
    this._addBox(group, 0.48, 0.05, 1.5, 1.56, 0.26, -2.25, counterBaseMat);

    const backsplash = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 1.22),
      new THREE.MeshStandardMaterial({ map: this.kitchenBacksplashTex, roughness: 0.35 })
    );
    backsplash.rotation.y = -Math.PI / 2;
    backsplash.position.set(W / 2 - 0.145, 1.46, -2.25);
    group.add(backsplash);

    // Kamar Mandi Belakang + Pintu PVC Terbuka
    const bmFrontZ = -1.55;
    const bmRightX = 0.18;
    this._addBox(group, 2.08, H, 0.12, -0.84, H / 2, bmFrontZ, wallIntMat, true);
    this._addBox(group, 2.04, skH, 0.02, -0.84, skY, bmFrontZ + 0.07, skirtingMat);

    this._addBox(group, 0.12, H - 1.98, 0.78, bmRightX, 1.98 + (H - 1.98) / 2, -2.1, wallIntMat, true);
    this._addBox(group, 0.12, H, 0.96, bmRightX, H / 2, -2.97, wallIntMat, true);
    this._addBox(group, 0.02, skH, 0.94, bmRightX + 0.07, skY, -2.97, skirtingMat);

    const pvcMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    this._addBox(group, 0.14, 1.98, 0.05, bmRightX, 0.99, -1.7, pvcMat);
    this._addBox(group, 0.14, 1.98, 0.05, bmRightX, 0.99, -2.48, pvcMat);
    this._addBox(group, 0.14, 0.05, 0.82, bmRightX, 1.98, -2.09, pvcMat);

    const bmDoor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.92, 0.72), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 }));
    bmDoor.position.set(bmRightX - 0.34, 0.98, -1.76);
    bmDoor.rotation.y = Math.PI / 2 - 0.25;
    group.add(bmDoor);

    const bmFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.96, 1.76),
      new THREE.MeshStandardMaterial({ map: this.bathFloorTex, roughness: 0.4 })
    );
    bmFloor.rotation.x = -Math.PI / 2;
    bmFloor.position.set(-0.85, 0.128, -2.47);
    group.add(bmFloor);

    const bmWallMat = new THREE.MeshStandardMaterial({ map: this.bathWallTex, roughness: 0.35 });
    const bmBackTile = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.75), bmWallMat);
    bmBackTile.position.set(-0.85, 1.0, -3.35);
    group.add(bmBackTile);

    const bmLeftTile = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.75), bmWallMat);
    bmLeftTile.rotation.y = Math.PI / 2;
    bmLeftTile.position.set(-1.85, 1.0, -2.47);
    group.add(bmLeftTile);

    this._addBox(group, 0.62, 0.68, 0.68, -1.5, 0.46, -2.98, new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.35 }), true);
    this._addBox(group, 0.44, 0.08, 0.56, -0.62, 0.17, -2.95, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }));
  }

  private _buildMinimalOccupiedItems(group: THREE.Group, accentColor: THREE.Color) {
    const fabricMat = new THREE.MeshStandardMaterial({
      color: accentColor.clone().lerp(new THREE.Color(0x1e293b), 0.25),
      roughness: 0.9,
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });

    this._addBox(group, 1.32, 0.18, 1.9, 1.05, 0.21, -0.1, whiteMat, true);
    this._addBox(group, 1.34, 0.05, 1.2, 1.05, 0.32, 0.22, fabricMat, true);
    this._addBox(group, 0.48, 0.12, 0.32, 0.8, 0.36, -0.82, whiteMat, true);
    this._addBox(group, 0.48, 0.12, 0.32, 1.3, 0.36, -0.82, whiteMat, true);
    this._addBox(group, 0.48, 1.8, 1.05, -1.58, 1.02, -0.2, woodMat, true);
    this._addBox(group, 0.36, 0.08, 0.68, 1.56, 0.88, -2.15, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.3 }));
  }

  private _createPitchedRoof(cx: number, y: number, cz: number, width: number, depth: number, ridgeHeight: number) {
    const roofGroup = new THREE.Group();
    roofGroup.position.set(cx, y, cz);

    const halfD = depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-halfD, 0);
    shape.lineTo(0, ridgeHeight);
    shape.lineTo(halfD, 0);
    shape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    extrudeGeo.center();

    const roofMesh = new THREE.Mesh(
      extrudeGeo,
      new THREE.MeshStandardMaterial({ map: this.roofTexture, color: 0xc2410c, roughness: 0.78 })
    );
    roofMesh.rotation.y = Math.PI / 2;
    roofMesh.position.y = ridgeHeight / 2;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofGroup.add(roofMesh);

    const ridgeCap = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.12, 0.16, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7 })
    );
    ridgeCap.position.set(0, ridgeHeight + 0.04, 0);
    roofGroup.add(ridgeCap);

    this.worldGroup.add(roofGroup);
    return roofGroup;
  }

  private _createFascia(width: number) {
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.24, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    fascia.position.set(0, -0.06, this.ROOM_D / 2 + this.TERRACE_D * 0.65 + 0.1);
    fascia.castShadow = true;
    return fascia;
  }

  private _createStaircaseAndCarport(cx: number, y: number, cz: number, floor2Y: number) {
    const W = this.ROOM_W;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const totalRise = floor2Y - y;

    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    this.worldGroup.add(grp);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D + TD), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 }));
    floor.position.set(0, 0.05, TD / 2);
    floor.receiveShadow = true;
    grp.add(floor);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, totalRise, 0.18), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 }));
    backWall.position.set(0, totalRise / 2, -D / 2 + 0.09);
    backWall.castShadow = true;
    grp.add(backWall);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
    this._addBox(grp, 0.28, totalRise, 0.28, -W / 2 + 0.18, totalRise / 2, D / 2 + TD - 0.18, pillarMat, true);
    this._addBox(grp, 0.28, totalRise, 0.28, -W / 2 + 0.18, totalRise / 2, -D / 2 + 0.18, pillarMat, true);
    this._addBox(grp, 0.28, totalRise, 0.28, W / 2 - 0.14, totalRise / 2, D / 2 + TD - 0.18, pillarMat, true);

    const steps = 12;
    const stepW = 1.2;
    const stepH = totalRise / steps;
    const stairStartZ = D / 2 + TD + 0.4;
    const stairRun = 4.2;
    const stepD = stairRun / steps;

    const stepMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75 });
    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH * 0.95, stepD + 0.05), stepMat);
      step.position.set(-W / 2 + stepW / 2 + 0.24, (i + 0.5) * stepH, stairStartZ - i * stepD);
      step.castShadow = true;
      step.receiveShadow = true;
      grp.add(step);
    }

    const railLen = Math.hypot(stairRun, totalRise);
    const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, railLen), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 }));
    handrail.position.set(-W / 2 + stepW + 0.24, totalRise / 2 + 0.85, stairStartZ - stairRun / 2);
    handrail.rotation.x = Math.atan2(totalRise, stairRun);
    grp.add(handrail);
  }

  private _createSupportBay(cx: number, y: number, cz: number, height: number) {
    const W = this.ROOM_W;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    this.worldGroup.add(grp);

    this._addBox(grp, 0.28, height, 0.28, W / 2 - 0.16, height / 2, D / 2 + TD - 0.16, pillarMat, true);
    this._addBox(grp, 0.28, height, 0.28, W / 2 - 0.16, height / 2, -D / 2 + 0.16, pillarMat, true);
  }

  private _createBalconyRailing(startX: number, floorY: number, frontZ: number, totalWidth: number) {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
    const railH = 0.96;
    const opening = 1.5;
    const railW = Math.max(1.0, totalWidth - opening);
    const railCenterX = startX + opening + railW / 2;

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(railW, 0.06, 0.06), railMat);
    topBar.position.set(railCenterX, floorY + railH, frontZ);
    this.worldGroup.add(topBar);

    const midBar = new THREE.Mesh(new THREE.BoxGeometry(railW, 0.04, 0.04), railMat);
    midBar.position.set(railCenterX, floorY + railH * 0.5, frontZ);
    this.worldGroup.add(midBar);

    const count = Math.floor(railW / 0.42);
    for (let i = 0; i <= count; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, 0.04), railMat);
      post.position.set(startX + opening + (i / count) * railW, floorY + railH / 2, frontZ);
      this.worldGroup.add(post);
    }

    const sideDepth = this.TERRACE_D;
    const rightSideBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, sideDepth), railMat);
    rightSideBar.position.set(startX + totalWidth - 0.06, floorY + railH, frontZ - sideDepth / 2);
    this.worldGroup.add(rightSideBar);
  }

  private _createWalkwayGarden(cx: number, y: number, cz: number, count = 7) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    for (let i = 0; i < count; i++) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.45), stoneMat);
      stone.position.set(cx, y, cz + 4.2 - i * 1.35);
      stone.receiveShadow = true;
      this.worldGroup.add(stone);
    }
    this._createPottedPlant(cx - 0.72, y, cz + 4.3);
    this._createPottedPlant(cx + 0.72, y, cz + 4.3);
  }

  private _createPottedPlant(x: number, y: number, z: number) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.36, 12), new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }));
    pot.position.set(x, y + 0.18, z);
    pot.castShadow = true;
    this.worldGroup.add(pot);

    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 }));
    bush.position.set(x, y + 0.56, z);
    bush.castShadow = true;
    this.worldGroup.add(bush);
  }

  private _createTree(x: number, y: number, z: number, scale = 1) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    grp.add(trunk);

    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 1), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 }));
    c1.position.set(0, 3.1, 0);
    c1.castShadow = true;
    grp.add(c1);

    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85 }));
    c2.position.set(0.75, 2.6, 0.5);
    c2.castShadow = true;
    grp.add(c2);

    this.worldGroup.add(grp);
  }

  private _createMainSignboard(x: number, y: number, z: number) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
    this._addBox(grp, 0.12, 2.25, 0.12, -1.75, 1.12, 0, postMat, true);
    this._addBox(grp, 0.12, 2.25, 0.12, 1.75, 1.12, 0, postMat, true);

    const tex = this._makeSignboardTexture('KONTRAKAN TEH AMOY', 'Klik Unit Untuk Masuk & Keliling Per Ruangan 3D');
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.0, 0.14), [
      postMat, postMat, postMat, postMat,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }),
      postMat,
    ]);
    board.position.set(0, 1.85, 0);
    board.castShadow = true;
    grp.add(board);

    this.worldGroup.add(grp);
  }

  private _createGardenLamp(x: number, y: number, z: number) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.35 }));
    post.position.set(x, y + 1.3, z);
    post.castShadow = true;
    this.worldGroup.add(post);

    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde047, emissiveIntensity: 0.25 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bulbMat);
    globe.position.set(x, y + 2.68, z);
    this.worldGroup.add(globe);

    const light = new THREE.PointLight(0xfef08a, 0.0, 10);
    light.position.set(x, y + 2.6, z);
    this.worldGroup.add(light);
    this.porchLights.push({ light, bulbMat });
  }

  private _addBox(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    castShadow = false
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    if (castShadow) mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private _restoreAllRoofsAndCeilings() {
    this.blockRoofs.forEach((r) => { r.visible = true; });
    for (const item of this.unitObjects.values()) {
      item.ceiling.visible = true;
    }
  }

  public enterUnit(unitId: number) {
    const obj = this.unitObjects.get(unitId);
    if (!obj) return;

    this._restoreAllRoofsAndCeilings();
    for (const [id, item] of this.unitObjects.entries()) {
      item.doorTargetAngle = id === unitId ? -1.48 : 0;
      item.interiorLight.intensity = id === unitId ? 1.6 : this.isNightMode ? 0.9 : 0.45;
    }

    this.activeUnitId = unitId;
    this.activeRoom = 'depan';
    this.isCutawayMode = false;
    this._updateHotspotsVisibility();

    const firstRoom = obj.rooms.depan;
    this.transition = {
      type: 'enter',
      unitId,
      roomKey: 'depan',
      elapsed: 0,
      duration: 1.45,
      waypointsPos: [this.camera.position.clone(), obj.doorApproachPos.clone(), firstRoom.pos.clone()],
      waypointsTarget: [this.controls.target.clone(), obj.doorApproachTarget.clone(), firstRoom.target.clone()],
    };

    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.78;
    this.callbacks.onEnterUnit?.(obj.unit);
    this.callbacks.onRoomChange?.('depan');
  }

  /**
   * Berpindah mulus ke ruangan tertentu di dalam kontrakan (melewati bukaan pintu sekat!)
   */
  public goToRoom(roomKey: InteriorRoomKey) {
    if (!this.activeUnitId) return;
    const obj = this.unitObjects.get(this.activeUnitId);
    if (!obj) return;

    // Jika sedang Mode Denah 3D, kembalikan ke Mode 360° Dalam ruangan
    if (this.isCutawayMode) {
      this.isCutawayMode = false;
      this._restoreAllRoofsAndCeilings();
    }

    const prevRoom = this.activeRoom;
    this.activeRoom = roomKey;
    this._updateHotspotsVisibility();

    const dest = obj.rooms[roomKey];
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    // Hitung titik tengah pintu sekat dalam koordinat dunia sesuai rotasi unit
    const partitionDoorway = this._localToWorld(obj.origin, obj.rotationY, -0.82, 1.56, 1.35);
    const bathDoorway = this._localToWorld(obj.origin, obj.rotationY, 0.35, 1.52, -2.08);

    let waypointsPos: THREE.Vector3[] = [startPos, dest.pos.clone()];
    let waypointsTarget: THREE.Vector3[] = [startTarget, dest.target.clone()];

    if ((prevRoom === 'depan' && roomKey !== 'depan') || (prevRoom !== 'depan' && roomKey === 'depan')) {
      waypointsPos = [startPos, partitionDoorway, dest.pos.clone()];
      waypointsTarget = [startTarget, dest.pos.clone(), dest.target.clone()];
    } else if (roomKey === 'kamar_mandi' || prevRoom === 'kamar_mandi') {
      waypointsPos = [startPos, bathDoorway, dest.pos.clone()];
      waypointsTarget = [startTarget, dest.pos.clone(), dest.target.clone()];
    }

    this.transition = {
      type: 'room',
      unitId: this.activeUnitId,
      roomKey,
      elapsed: 0,
      duration: 0.9,
      waypointsPos,
      waypointsTarget,
    };

    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 2.0;
    this.callbacks.onRoomChange?.(roomKey);
  }

  public exitUnit() {
    this._restoreAllRoofsAndCeilings();
    if (!this.activeUnitId) {
      this.resetCamera();
      return;
    }

    const prevObj = this.unitObjects.get(this.activeUnitId);
    if (prevObj) {
      prevObj.doorTargetAngle = 0;
      prevObj.interiorLight.intensity = this.isNightMode ? 0.9 : 0.45;
    }

    const midPos = prevObj ? prevObj.doorApproachPos.clone() : this.camera.position.clone();
    this.activeUnitId = null;
    this.isCutawayMode = false;
    this._updateHotspotsVisibility();

    this.transition = {
      type: 'exit',
      elapsed: 0,
      duration: 1.25,
      waypointsPos: [this.camera.position.clone(), midPos, this.overviewCamPos.clone()],
      waypointsTarget: [this.controls.target.clone(), this.overviewTarget.clone(), this.overviewTarget.clone()],
    };
    this.callbacks.onExitUnit?.();
  }

  public toggleCutawayMode(): boolean {
    if (!this.activeUnitId) return false;
    const obj = this.unitObjects.get(this.activeUnitId);
    if (!obj) return false;

    this.isCutawayMode = !this.isCutawayMode;
    obj.ceiling.visible = !this.isCutawayMode;
    if (obj.blockRoof) obj.blockRoof.visible = !this.isCutawayMode;
    this._updateHotspotsVisibility();

    const activePreset = obj.rooms[this.activeRoom];
    this.transition = {
      type: 'cutaway',
      unitId: this.activeUnitId,
      elapsed: 0,
      duration: 0.85,
      waypointsPos: [this.camera.position.clone(), this.isCutawayMode ? obj.cutawayCamPos.clone() : activePreset.pos.clone()],
      waypointsTarget: [this.controls.target.clone(), this.isCutawayMode ? obj.cutawayTarget.clone() : activePreset.target.clone()],
    };
    return this.isCutawayMode;
  }

  public resetCamera() {
    this.transition = {
      type: 'reset',
      elapsed: 0,
      duration: 0.9,
      waypointsPos: [this.camera.position.clone(), this.overviewCamPos.clone()],
      waypointsTarget: [this.controls.target.clone(), this.overviewTarget.clone()],
    };
  }

  public setNightMode(isNight: boolean) {
    this.isNightMode = isNight;
    if (isNight) {
      this.scene.background = new THREE.Color(0x0f172a);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.011);
      this.hemiLight.color.setHex(0x334155);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.55;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.42;
      this.fillLight.intensity = 0.22;
      this.porchLights.forEach(({ light, bulbMat }) => {
        light.intensity = 1.65;
        bulbMat.emissiveIntensity = 1.65;
      });
      this.windowGlowMats.forEach((m) => { m.emissiveIntensity = 0.42; });
      for (const [id, obj] of this.unitObjects.entries()) {
        obj.interiorLight.intensity = id === this.activeUnitId ? 1.85 : 0.95;
      }
    } else {
      this.scene.background = new THREE.Color(0x93c5fd);
      this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0075);
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x64748b);
      this.hemiLight.intensity = 0.88;
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 1.5;
      this.fillLight.intensity = 0.48;
      this.porchLights.forEach(({ light, bulbMat }) => {
        light.intensity = 0.0;
        bulbMat.emissiveIntensity = 0.2;
      });
      this.windowGlowMats.forEach((m) => { m.emissiveIntensity = 0.0; });
      for (const [id, obj] of this.unitObjects.entries()) {
        obj.interiorLight.intensity = id === this.activeUnitId ? 1.55 : 0.45;
      }
    }
  }

  public getProjectedLabels(): ProjectedLabel[] {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const results: ProjectedLabel[] = [];

    for (const [id, obj] of this.unitObjects.entries()) {
      const vec = obj.labelAnchor.clone();
      vec.project(this.camera);
      const visible = vec.z < 1 && vec.x >= -1.15 && vec.x <= 1.15 && vec.y >= -1.15 && vec.y <= 1.15;
      results.push({
        id,
        x: (vec.x * 0.5 + 0.5) * width,
        y: (-vec.y * 0.5 + 0.5) * height,
        visible,
      });
    }
    return results;
  }

  public getProjectedLandmarks(): ProjectedLandmark[] {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const results: ProjectedLandmark[] = [];

    for (const [key, anchor] of this.landmarkAnchors.entries()) {
      const vec = anchor.clone();
      vec.project(this.camera);
      const visible = vec.z < 1 && vec.x >= -1.15 && vec.x <= 1.15 && vec.y >= -1.15 && vec.y <= 1.15;
      results.push({
        key,
        x: (vec.x * 0.5 + 0.5) * width,
        y: (-vec.y * 0.5 + 0.5) * height,
        visible,
      });
    }
    return results;
  }

  private _initEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDownBound);
    dom.addEventListener('pointermove', this.handlePointerMoveBound);
    dom.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
    this.keysPressed.add(e.key.toLowerCase());
  }

  private _onKeyUp(e: KeyboardEvent) {
    this.keysPressed.delete(e.key.toLowerCase());
  }

  private _onPointerDown(e: PointerEvent) {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private _onPointerMove(e: PointerEvent) {
    const dom = this.renderer.domElement;
    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Saat berada di dalam unit: deteksi hover pada Floor Hotspot 3D
    if (this.activeUnitId && !this.isCutawayMode) {
      const visibleHotspots = this.hotspotMeshes.filter((m) => m.parent?.visible);
      const hsHits = this.raycaster.intersectObjects(visibleHotspots, false);
      const hitMesh = hsHits.length > 0 ? (hsHits[0].object as THREE.Mesh) : null;
      if (hitMesh !== this.hoveredHotspot) {
        if (this.hoveredHotspot) this.hoveredHotspot.parent?.scale.setScalar(1);
        this.hoveredHotspot = hitMesh;
        if (hitMesh) {
          hitMesh.parent?.scale.setScalar(1.22);
          dom.style.cursor = 'pointer';
        } else {
          dom.style.cursor = 'grab';
        }
      }
      return;
    }

    if (this.activeUnitId) {
      dom.style.cursor = 'grab';
      return;
    }

    const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
    const hitId: number | null = hits.length > 0 ? (hits[0].object.userData.unitId as number) : null;
    if (hitId !== this.hoveredUnitId) {
      if (this.hoveredUnitId && this.unitObjects.has(this.hoveredUnitId)) {
        this.unitObjects.get(this.hoveredUnitId)!.highlightMat.opacity = 0;
      }
      this.hoveredUnitId = hitId;
      if (hitId && this.unitObjects.has(hitId)) {
        this.unitObjects.get(hitId)!.highlightMat.opacity = 0.85;
        dom.style.cursor = 'pointer';
      } else {
        dom.style.cursor = 'grab';
      }
    }
  }

  private _onPointerUp(e: PointerEvent) {
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 6) return;

    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Klik Floor Hotspot di dalam ruangan -> pindah ruangan halus!
    if (this.activeUnitId && !this.isCutawayMode) {
      const visibleHotspots = this.hotspotMeshes.filter((m) => m.parent?.visible);
      const hsHits = this.raycaster.intersectObjects(visibleHotspots, false);
      if (hsHits.length > 0) {
        const roomKey = hsHits[0].object.userData.hotspotRoom as InteriorRoomKey;
        this.goToRoom(roomKey);
      }
      return;
    }

    if (this.activeUnitId) return;

    const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
    if (hits.length > 0) {
      this.enterUnit(hits[0].object.userData.unitId as number);
    }
  }

  private _onResize() {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this._updateResponsiveCameraFraming(!this.activeUnitId);
  }

  private _updatePointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private _samplePath(points: THREE.Vector3[], t: number): THREE.Vector3 {
    if (points.length === 2) {
      return new THREE.Vector3().lerpVectors(points[0], points[1], t);
    }
    const [p0, p1, p2] = points;
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z
    );
  }

  private _easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private _handleFreeWalk(delta: number) {
    if (!this.activeUnitId || this.isCutawayMode || this.transition) return;
    if (this.keysPressed.size === 0) return;

    const obj = this.unitObjects.get(this.activeUnitId);
    if (!obj) return;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) return;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();

    if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) move.add(forward);
    if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) move.sub(forward);
    if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) move.add(right);
    if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) move.sub(right);

    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(delta * 2.5);

    // Transformasikan posisi ke koordinat lokal unit agar batas dinding akurat meski unit dirotasi
    const nextWorldX = this.camera.position.x + move.x;
    const nextWorldZ = this.camera.position.z + move.z;
    const relX = nextWorldX - obj.origin.x;
    const relZ = nextWorldZ - obj.origin.z;
    const cos = Math.cos(-obj.rotationY);
    const sin = Math.sin(-obj.rotationY);
    const localX = THREE.MathUtils.clamp(relX * cos + relZ * sin, -this.ROOM_W / 2 + 0.35, this.ROOM_W / 2 - 0.35);
    const localZ = THREE.MathUtils.clamp(-relX * sin + relZ * cos, -this.ROOM_D / 2 + 0.35, this.ROOM_D / 2 - 0.35);

    const clampedWorld = this._localToWorld(obj.origin, obj.rotationY, localX, this.camera.position.y - obj.origin.y, localZ);
    const dx = clampedWorld.x - this.camera.position.x;
    const dz = clampedWorld.z - this.camera.position.z;

    this.camera.position.x += dx;
    this.camera.position.z += dz;
    this.controls.target.x += dx;
    this.controls.target.z += dz;
  }

  private _animate() {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsedTotal += delta;

    // 1. Animasi pintu berengsel
    for (const obj of this.unitObjects.values()) {
      const diff = obj.doorTargetAngle - obj.doorPivot.rotation.y;
      if (Math.abs(diff) > 0.004) {
        obj.doorPivot.rotation.y += diff * Math.min(1, delta * 6.5);
      }
    }

    // 2. Animasi denyut lembut Floor Hotspot di dalam ruangan
    if (this.activeUnitId && !this.isCutawayMode) {
      const pulse = 1 + Math.sin(this.elapsedTotal * 3.5) * 0.08;
      const obj = this.unitObjects.get(this.activeUnitId);
      if (obj) {
        for (const hsGrp of obj.hotspots.values()) {
          if (hsGrp.visible && this.hoveredHotspot?.parent !== hsGrp) {
            hsGrp.scale.setScalar(pulse);
          }
        }
      }
    }

    // 3. Gerak bebas keyboard WASD / Panah di dalam ruangan
    this._handleFreeWalk(delta);

    // 4. Transisi kamera mulus
    if (this.transition) {
      this.transition.elapsed += delta;
      const rawT = Math.min(1, this.transition.elapsed / this.transition.duration);
      const t = this._easeInOutCubic(rawT);

      this.camera.position.copy(this._samplePath(this.transition.waypointsPos, t));
      this.controls.target.copy(this._samplePath(this.transition.waypointsTarget, t));

      if (rawT >= 1) {
        const finishedType = this.transition.type;
        this.transition = null;
        if (finishedType === 'enter' || finishedType === 'room') {
          // Mode 360° Look-around di tempat (jarak target pendek agar bebas putar 360° tanpa tembus dinding!)
          this.controls.minDistance = 0.25;
          this.controls.maxDistance = 0.75;
          this.controls.maxPolarAngle = Math.PI * 0.78;
        } else if (finishedType === 'cutaway') {
          if (this.isCutawayMode) {
            this.controls.minDistance = 4.0;
            this.controls.maxDistance = 14;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
          } else {
            this.controls.minDistance = 0.25;
            this.controls.maxDistance = 0.75;
            this.controls.maxPolarAngle = Math.PI * 0.78;
          }
        } else {
          this.controls.minDistance = 6;
          this.controls.maxDistance = Math.max(80, this.overviewCamPos.z + 28);
          this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.callbacks.onFrameUpdate?.();
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDownBound);
    dom.removeEventListener('pointermove', this.handlePointerMoveBound);
    dom.removeEventListener('pointerup', this.handlePointerUpBound);
    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
