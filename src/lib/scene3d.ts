import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PublicUnit } from './types';

interface UnitObjectEntry {
  unit: PublicUnit;
  group: THREE.Group;
  blockRoof: THREE.Group | null;
  doorPivot: THREE.Group;
  doorTargetAngle: number;
  ceiling: THREE.Mesh;
  interiorLight: THREE.PointLight;
  highlightMat: THREE.MeshBasicMaterial;
  labelAnchor: THREE.Vector3;
  doorApproachPos: THREE.Vector3;
  doorApproachTarget: THREE.Vector3;
  interiorCamPos: THREE.Vector3;
  interiorTarget: THREE.Vector3;
  cutawayCamPos: THREE.Vector3;
  cutawayTarget: THREE.Vector3;
}

interface TransitionState {
  type: 'enter' | 'exit' | 'cutaway' | 'reset';
  unitId?: number;
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

export interface SceneCallbacks {
  onEnterUnit?: (unit: PublicUnit) => void;
  onExitUnit?: () => void;
  onFrameUpdate?: () => void;
}

/**
 * Kontrakan3DScene (TypeScript / Next.js)
 * - 3 Bangunan Terpisah:
 *   • Blok A (memanjang_4): 4 unit memanjang Lt. 1 (#01 - #04)
 *   • Blok B (memanjang_2): 2 unit memanjang TERPISAH Lt. 1 (#05 - #06)
 *   • Blok C (bertingkat): 1 bawah (#07) + tangga & carport + 2 atas (#08 - #09) + balkon
 * - Interior Persis Video Asli (krem peach, plint abu gelap, keramik putih, sekat kusen cokelat tua,
 *   jendela 2 daun + 2 boven, meja dapur cor + keramik backsplash, kamar mandi keramik biru-abu)
 * - Unit KOSONG 100% kosongan polos tanpa kasur/peralatan apapun
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
  private porchLights: Array<{ light: THREE.PointLight; bulbMat: THREE.MeshStandardMaterial }> = [];
  private windowGlowMats: THREE.MeshPhysicalMaterial[] = [];
  private blockRoofs: THREE.Group[] = [];

  public isNightMode = false;
  public isCutawayMode = false;
  public activeUnitId: number | null = null;
  private hoveredUnitId: number | null = null;

  private transition: TransitionState | null = null;
  private lastComplexWidth = 38;
  private overviewCamPos = new THREE.Vector3(0, 11.5, 29.5);
  private overviewTarget = new THREE.Vector3(0, 2.2, 0.5);

  private readonly ROOM_W = 4.0;
  private readonly ROOM_H = 3.15;
  private readonly ROOM_D = 7.0;
  private readonly TERRACE_D = 1.65;
  private readonly FLOOR_SLAB = 0.28;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };

  private clock = new THREE.Clock();
  private animFrameId = 0;
  private disposed = false;

  private handleResizeBound: () => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;

  constructor(container: HTMLElement, callbacks: SceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.handleResizeBound = this._onResize.bind(this);
    this.handlePointerDownBound = this._onPointerDown.bind(this);
    this.handlePointerMoveBound = this._onPointerMove.bind(this);
    this.handlePointerUpBound = this._onPointerUp.bind(this);

    this._initRenderer();
    this._initSceneAndLights();
    this._initTextures();
    this._initEvents();
    this._animate();
  }

  private _initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93c5fd);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0095);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.08, 200);
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
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.75;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.controls.target.copy(this.overviewTarget);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 75;
    this.controls.update();

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
  }

  private _initSceneAndLights() {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x64748b, 0.88);
    this.hemiLight.position.set(0, 32, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.5);
    this.sunLight.position.set(20, 30, 24);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.48);
    this.fillLight.position.set(-18, 12, 18);
    this.scene.add(this.fillLight);
  }

  private _initTextures() {
    // 1. Lantai Keramik Putih 40x40cm
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

    // 2. Keramik Backsplash Dapur
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

    // 3. Lantai Kamar Mandi Motif Kotak Biru-Abu
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

    // 4. Dinding Kamar Mandi Motif Abu-Abu
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

    // 5. Genteng Atap
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

    // 6. Halaman Paving
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
    this.paveTexture.repeat.set(18, 10);
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

  private _makeSignboardTexture(title: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 256);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 996, 228);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 512, 105);

    ctx.fillStyle = '#93c5fd';
    ctx.font = '600 34px sans-serif';
    ctx.fillText(subtitle, 512, 180);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public buildComplex(units: PublicUnit[]) {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.unitObjects.clear();
    this.clickableMeshes = [];
    this.porchLights = [];
    this.windowGlowMats = [];
    this.blockRoofs = [];

    const block4Units = units
      .filter((u) => u.blok === 'memanjang_4')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const block2Units = units
      .filter((u) => u.blok === 'memanjang_2')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const tieredGroundUnits = units
      .filter((u) => u.blok === 'bertingkat' && Number(u.lantai) === 1)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const tieredUpperUnits = units
      .filter((u) => u.blok === 'bertingkat' && Number(u.lantai) >= 2)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const W = this.ROOM_W;
    const H = this.ROOM_H;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const SLAB = this.FLOOR_SLAB;
    const gapBetweenBlocks = 3.0;

    const block4Width = block4Units.length > 0 ? block4Units.length * W : 0;
    const block2Width = block2Units.length > 0 ? block2Units.length * W : 0;
    const hasTiered = tieredGroundUnits.length > 0 || tieredUpperUnits.length > 0;
    const tieredBays = hasTiered ? Math.max(tieredUpperUnits.length, tieredGroundUnits.length + 1, 2) : 0;
    const tieredWidth = tieredBays * W;

    let totalComplexWidth = 0;
    if (block4Width > 0) totalComplexWidth += block4Width;
    if (block2Width > 0) totalComplexWidth += (totalComplexWidth > 0 ? gapBetweenBlocks : 0) + block2Width;
    if (tieredWidth > 0) totalComplexWidth += (totalComplexWidth > 0 ? gapBetweenBlocks : 0) + tieredWidth;
    totalComplexWidth = Math.max(totalComplexWidth, 16);

    let cursorX = -totalComplexWidth / 2;
    const baseZ = 0;

    // 1. Tanah & Halaman Paving
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(totalComplexWidth + 64, 86),
      new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.04, 4);
    grass.receiveShadow = true;
    this.worldGroup.add(grass);

    const yardW = totalComplexWidth + 9;
    const yardD = 16.5;
    const yard = new THREE.Mesh(
      new THREE.BoxGeometry(yardW, 0.08, yardD),
      new THREE.MeshStandardMaterial({ map: this.paveTexture, roughness: 0.85 })
    );
    yard.position.set(0, 0, D / 2 + TD + yardD / 2 - 1.5);
    yard.receiveShadow = true;
    this.worldGroup.add(yard);

    const leftMostX = cursorX;

    // 2. BLOK A — 4 Memanjang (#01 - #04)
    if (block4Units.length > 0) {
      const b4CenterX = cursorX + block4Width / 2;
      const b4Roof = this._createPitchedRoof(b4CenterX, H + 0.14, baseZ + TD * 0.35, block4Width + 0.85, D + TD + 1.1, 1.5);
      b4Roof.add(this._createFascia(block4Width + 0.55));
      this.blockRoofs.push(b4Roof);

      block4Units.forEach((unit, idx) => {
        const ux = cursorX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), b4Roof);
      });

      cursorX += block4Width;
      if (block2Units.length > 0 || hasTiered) {
        this._createWalkwayGarden(cursorX + gapBetweenBlocks / 2, 0.06, baseZ + 0.8);
        cursorX += gapBetweenBlocks;
      }
    }

    // 3. BLOK B — 2 Memanjang TERPISAH (#05 - #06)
    if (block2Units.length > 0) {
      const b2CenterX = cursorX + block2Width / 2;
      const b2Roof = this._createPitchedRoof(b2CenterX, H + 0.14, baseZ + TD * 0.35, block2Width + 0.85, D + TD + 1.1, 1.45);
      b2Roof.add(this._createFascia(block2Width + 0.55));
      this.blockRoofs.push(b2Roof);

      block2Units.forEach((unit, idx) => {
        const ux = cursorX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), b2Roof);
      });

      cursorX += block2Width;
      if (hasTiered) {
        this._createWalkwayGarden(cursorX + gapBetweenBlocks / 2, 0.06, baseZ + 0.8);
        cursorX += gapBetweenBlocks;
      }
    }

    // 4. BLOK C — Gedung Bertingkat (1 Bawah #07 + 2 Atas #08, #09)
    if (hasTiered) {
      const tieredStartX = cursorX;
      const tieredCenterX = tieredStartX + tieredWidth / 2;
      const floor2Y = 0.08 + H + SLAB;

      const upperRoof = this._createPitchedRoof(tieredCenterX, floor2Y + H + 0.06, baseZ + TD * 0.35, tieredWidth + 0.85, D + TD + 1.1, 1.65);
      upperRoof.add(this._createFascia(tieredWidth + 0.55));
      this.blockRoofs.push(upperRoof);

      this._createStaircaseAndCarport(tieredStartX + W / 2, 0.08, baseZ, floor2Y);

      tieredGroundUnits.forEach((unit, idx) => {
        const bayIdx = idx + 1;
        const ux = tieredStartX + bayIdx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), null);
      });

      for (let bay = tieredGroundUnits.length + 1; bay < tieredBays; bay++) {
        const px = tieredStartX + bay * W + W / 2;
        this._createSupportBay(px, 0.08, baseZ, H + SLAB);
      }

      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(tieredWidth + 0.35, SLAB, D + TD + 0.4),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 })
      );
      slabMesh.position.set(tieredCenterX, 0.08 + H + SLAB / 2, baseZ + TD / 2);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      this.worldGroup.add(slabMesh);

      this._createBalconyRailing(tieredStartX, floor2Y, baseZ + D / 2 + TD - 0.06, tieredWidth);

      tieredUpperUnits.forEach((unit, idx) => {
        const ux = tieredStartX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, floor2Y, baseZ), upperRoof);
      });

      cursorX += tieredWidth;
    }

    const rightMostX = cursorX;

    // 5. Papan Nama, Pohon & Lampu Taman
    this._createMainSignboard(0, 0.04, D / 2 + TD + 9.2);
    this._createTree(leftMostX - 3.6, 0, baseZ + 5.6, 1.15);
    this._createTree(leftMostX - 4.4, 0, baseZ - 2.6, 1.35);
    this._createTree(rightMostX + 3.8, 0, baseZ + 5.2, 1.2);
    this._createTree(rightMostX + 4.2, 0, baseZ - 2.8, 1.4);

    this._createGardenLamp(leftMostX + 1.5, 0.04, D / 2 + TD + 7.6);
    this._createGardenLamp(0, 0.04, D / 2 + TD + 7.6);
    this._createGardenLamp(rightMostX - 1.5, 0.04, D / 2 + TD + 7.6);

    this.lastComplexWidth = totalComplexWidth;
    this._updateResponsiveCameraFraming(!this.activeUnitId);
    this.setNightMode(this.isNightMode);
  }

  private _updateResponsiveCameraFraming(applyImmediately = false) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const complexW = this.lastComplexWidth || 38;

    let fov = 46;
    let camY = 11.2;
    let camZ = Math.max(27.5, complexW * 0.72);
    let targetY = 2.2;

    if (aspect < 0.72) {
      fov = 56;
      camY = 15.5;
      camZ = Math.max(44, complexW * 1.18);
      targetY = 1.6;
    } else if (aspect < 1.15) {
      fov = 52;
      camY = 13.0;
      camZ = Math.max(34, complexW * 0.9);
      targetY = 2.0;
    }

    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.overviewTarget.set(0, targetY, 0.5);
    this.overviewCamPos.set(0, camY, camZ);
    this.controls.maxDistance = Math.max(65, camZ + 22);

    if (applyImmediately && !this.activeUnitId && !this.transition) {
      this.camera.position.copy(this.overviewCamPos);
      this.controls.target.copy(this.overviewTarget);
      this.controls.update();
    }
  }

  private _createUnitRoom(unit: PublicUnit, origin: THREE.Vector3, blockRoof: THREE.Group | null) {
    const W = this.ROOM_W;
    const H = this.ROOM_H;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const wallT = 0.13;

    const unitGroup = new THREE.Group();
    unitGroup.position.copy(origin);
    this.worldGroup.add(unitGroup);

    const accentColor = new THREE.Color(unit.warna_aksen || '#2563eb');
    const wallExtMat = new THREE.MeshStandardMaterial({ color: 0xf5e6cc, roughness: 0.85 });
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

    this._addBox(unitGroup, 0.18, H, 0.18, W / 2 - 0.12, H / 2, D / 2 + TD - 0.14, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 }), true);
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

    const interiorLight = new THREE.PointLight(0xfff7ed, 0.6, 10.5);
    interiorLight.position.set(0, H - 0.45, 0.5);
    unitGroup.add(interiorLight);

    // Struktur Ruangan Persis Video
    this._buildRealVideoStructure(unitGroup, W, H, wallIntMat, skirtingMat, darkWoodMat);

    // Kosongan polos untuk unit KOSONG / MAINTENANCE; minimalis hanya untuk unit TERISI
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

    const worldOrigin = origin.clone();
    this.unitObjects.set(unit.id, {
      unit,
      group: unitGroup,
      blockRoof,
      doorPivot,
      doorTargetAngle: 0,
      ceiling,
      interiorLight,
      highlightMat,
      labelAnchor: new THREE.Vector3(worldOrigin.x, worldOrigin.y + H + 0.55, worldOrigin.z + D / 2 + 0.65),
      doorApproachPos: new THREE.Vector3(worldOrigin.x - 0.9, worldOrigin.y + 1.62, worldOrigin.z + D / 2 + TD + 2.6),
      doorApproachTarget: new THREE.Vector3(worldOrigin.x - 0.5, worldOrigin.y + 1.4, worldOrigin.z + 0.5),
      interiorCamPos: new THREE.Vector3(worldOrigin.x - 0.65, worldOrigin.y + 1.62, worldOrigin.z + D / 2 - 0.75),
      interiorTarget: new THREE.Vector3(worldOrigin.x + 0.15, worldOrigin.y + 1.25, worldOrigin.z - 1.45),
      cutawayCamPos: new THREE.Vector3(worldOrigin.x + 0.2, worldOrigin.y + 8.6, worldOrigin.z + 5.6),
      cutawayTarget: new THREE.Vector3(worldOrigin.x, worldOrigin.y + 0.6, worldOrigin.z - 0.2),
    });
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

  private _createWalkwayGarden(cx: number, y: number, cz: number) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.45), stoneMat);
      stone.position.set(cx, y, cz + 4.2 - i * 1.35);
      stone.receiveShadow = true;
      this.worldGroup.add(stone);
    }
    this._createPottedPlant(cx - 0.85, y, cz + 4.3);
    this._createPottedPlant(cx + 0.85, y, cz + 4.3);
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

    const tex = this._makeSignboardTexture('KONTRAKAN TEH AMOY', 'Hunian Nyaman & Asri • Klik Pintu Untuk Masuk 3D');
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
      item.interiorLight.intensity = id === unitId ? 1.55 : this.isNightMode ? 0.9 : 0.45;
    }

    this.activeUnitId = unitId;
    this.isCutawayMode = false;

    this.transition = {
      type: 'enter',
      unitId,
      elapsed: 0,
      duration: 1.45,
      waypointsPos: [this.camera.position.clone(), obj.doorApproachPos.clone(), obj.interiorCamPos.clone()],
      waypointsTarget: [this.controls.target.clone(), obj.doorApproachTarget.clone(), obj.interiorTarget.clone()],
    };

    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.72;
    this.callbacks.onEnterUnit?.(obj.unit);
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

    this.transition = {
      type: 'cutaway',
      unitId: this.activeUnitId,
      elapsed: 0,
      duration: 0.85,
      waypointsPos: [this.camera.position.clone(), this.isCutawayMode ? obj.cutawayCamPos.clone() : obj.interiorCamPos.clone()],
      waypointsTarget: [this.controls.target.clone(), this.isCutawayMode ? obj.cutawayTarget.clone() : obj.interiorTarget.clone()],
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
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.013);
      this.hemiLight.color.setHex(0x334155);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.55;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.42;
      this.fillLight.intensity = 0.22;
      this.porchLights.forEach(({ light, bulbMat }) => {
        light.intensity = 1.6;
        bulbMat.emissiveIntensity = 1.6;
      });
      this.windowGlowMats.forEach((m) => { m.emissiveIntensity = 0.42; });
      for (const [id, obj] of this.unitObjects.entries()) {
        obj.interiorLight.intensity = id === this.activeUnitId ? 1.85 : 0.95;
      }
    } else {
      this.scene.background = new THREE.Color(0x93c5fd);
      this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0095);
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
        obj.interiorLight.intensity = id === this.activeUnitId ? 1.45 : 0.45;
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

  private _initEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDownBound);
    dom.addEventListener('pointermove', this.handlePointerMoveBound);
    dom.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('resize', this.handleResizeBound);
  }

  private _onPointerDown(e: PointerEvent) {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private _onPointerMove(e: PointerEvent) {
    const dom = this.renderer.domElement;
    if (this.activeUnitId) {
      dom.style.cursor = 'grab';
      return;
    }
    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
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
    if (dist > 6 || this.activeUnitId) return;

    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
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

  private _animate() {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);

    for (const obj of this.unitObjects.values()) {
      const diff = obj.doorTargetAngle - obj.doorPivot.rotation.y;
      if (Math.abs(diff) > 0.004) {
        obj.doorPivot.rotation.y += diff * Math.min(1, delta * 6.5);
      }
    }

    if (this.transition) {
      this.transition.elapsed += delta;
      const rawT = Math.min(1, this.transition.elapsed / this.transition.duration);
      const t = this._easeInOutCubic(rawT);

      this.camera.position.copy(this._samplePath(this.transition.waypointsPos, t));
      this.controls.target.copy(this._samplePath(this.transition.waypointsTarget, t));

      if (rawT >= 1) {
        const finishedType = this.transition.type;
        this.transition = null;
        if (finishedType === 'enter') {
          this.controls.minDistance = 0.35;
          this.controls.maxDistance = 4.2;
          this.controls.maxPolarAngle = Math.PI * 0.68;
        } else if (finishedType === 'cutaway') {
          if (this.isCutawayMode) {
            this.controls.minDistance = 4.0;
            this.controls.maxDistance = 14;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
          } else {
            this.controls.minDistance = 0.35;
            this.controls.maxDistance = 4.2;
            this.controls.maxPolarAngle = Math.PI * 0.68;
          }
        } else {
          this.controls.minDistance = 6;
          this.controls.maxDistance = Math.max(65, this.overviewCamPos.z + 22);
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
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
