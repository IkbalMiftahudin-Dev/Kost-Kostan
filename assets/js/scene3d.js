import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Kontrakan3DScene
 * Engine 3D Interaktif Kontrakan Teh Amoy:
 * - Layout 3 Bangunan Terpisah (9 Unit Awal + Dinamis):
 *   • Blok A (memanjang_4): 4 unit berderet memanjang di Lantai 1 (#01 - #04)
 *   • Blok B (memanjang_2): 2 unit memanjang TERPISAH di Lantai 1 (#05 - #06) — tidak gabung dengan yang 4
 *   • Blok C (bertingkat):
 *       - Lantai 1 (Bawah): Area Tangga & Carport + 1 unit di bawah (#07)
 *       - Lantai 2 (Atas): 2 unit bertingkat (#08 - #09) + Balkon & Railing Besi
 * - Interior 3D Persis Video Asli:
 *   • Dinding krem peach hangat + plint keramik abu-abu gelap + lantai keramik putih kotak mengkilap
 *   • Jendela 2 daun kusen cokelat tua + 2 ventilasi boven di atasnya
 *   • Ruang Depan -> Sekat Kusen Cokelat Tua -> Ruang Tengah -> Lorong Meja Dapur Beton Cor + Backsplash Keramik -> Kamar Mandi Belakang berkeramik motif biru-abu
 *   • Unit KOSONG 100% kosongan polos tanpa kasur, lemari, atau peralatan apapun
 */
export class Kontrakan3DScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.unitObjects = new Map();
    this.clickableMeshes = [];
    this.porchLights = [];
    this.windowGlowMats = [];
    this.blockRoofs = [];
    this.isNightMode = false;
    this.isCutawayMode = false;
    this.activeUnitId = null;
    this.hoveredUnitId = null;

    this.transition = null;
    this.lastComplexWidth = 38;
    this.overviewCamPos = new THREE.Vector3(0, 11.5, 29.5);
    this.overviewTarget = new THREE.Vector3(0, 2.2, 0.5);

    // Dimensi ruangan proporsional dengan video asli (memanjang ke belakang)
    this.ROOM_W = 4.0;
    this.ROOM_H = 3.15;
    this.ROOM_D = 7.0;
    this.TERRACE_D = 1.65;
    this.FLOOR_SLAB = 0.28;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDownPos = { x: 0, y: 0 };

    this._initRenderer();
    this._initSceneAndLights();
    this._initTextures();
    this._initEvents();

    this.clock = new THREE.Clock();
    this._animate();
  }

  _initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93c5fd);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0095);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.08, 200);
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

  _initSceneAndLights() {
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

  _initTextures() {
    // 1. Lantai Keramik Putih Mengkilap 40x40cm (persis video 00:00 - 00:14)
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 256;
    tileCanvas.height = 256;
    const tctx = tileCanvas.getContext('2d');
    tctx.fillStyle = '#f5f7fa';
    tctx.fillRect(0, 0, 256, 256);
    tctx.strokeStyle = '#9ca3af';
    tctx.lineWidth = 2.5;
    for (let i = 0; i <= 256; i += 64) {
      tctx.beginPath();
      tctx.moveTo(i, 0);
      tctx.lineTo(i, 256);
      tctx.stroke();
      tctx.beginPath();
      tctx.moveTo(0, i);
      tctx.lineTo(256, i);
      tctx.stroke();
    }
    this.tileTexture = new THREE.CanvasTexture(tileCanvas);
    this.tileTexture.wrapS = THREE.RepeatWrapping;
    this.tileTexture.wrapT = THREE.RepeatWrapping;
    this.tileTexture.repeat.set(3.5, 6);

    // 2. Keramik Backsplash Dinding Dapur (persis video 00:03, 00:05, 00:09)
    const bsCanvas = document.createElement('canvas');
    bsCanvas.width = 256;
    bsCanvas.height = 256;
    const bctx = bsCanvas.getContext('2d');
    bctx.fillStyle = '#e5e7eb';
    bctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 64) {
        bctx.fillStyle = ((x / 64 + y / 32) % 2 === 0) ? '#f3f4f6' : '#dbe3e0';
        bctx.fillRect(x + 1, y + 1, 62, 30);
        // Garis tipis motif keramik dapur
        bctx.fillStyle = '#cbd5e1';
        bctx.fillRect(x + 4, y + 14, 56, 2);
      }
    }
    this.kitchenBacksplashTex = new THREE.CanvasTexture(bsCanvas);
    this.kitchenBacksplashTex.wrapS = THREE.RepeatWrapping;
    this.kitchenBacksplashTex.wrapT = THREE.RepeatWrapping;
    this.kitchenBacksplashTex.repeat.set(2, 2);

    // 3. Keramik Lantai Kamar Mandi Motif Kotak Biru-Abu (persis video 00:09 - 00:10)
    const bathFloorCanvas = document.createElement('canvas');
    bathFloorCanvas.width = 256;
    bathFloorCanvas.height = 256;
    const bfctx = bathFloorCanvas.getContext('2d');
    bfctx.fillStyle = '#dbeafe';
    bfctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 64) {
        bfctx.strokeStyle = '#64748b';
        bfctx.lineWidth = 3;
        bfctx.strokeRect(x + 2, y + 2, 60, 60);
        // Kotak biru di tengah ubin (persis keramik lantai KM di video)
        bfctx.strokeStyle = '#60a5fa';
        bfctx.lineWidth = 6;
        bfctx.strokeRect(x + 12, y + 12, 40, 40);
        bfctx.fillStyle = '#bfdbfe';
        bfctx.fillRect(x + 20, y + 20, 24, 24);
      }
    }
    this.bathFloorTex = new THREE.CanvasTexture(bathFloorCanvas);
    this.bathFloorTex.wrapS = THREE.RepeatWrapping;
    this.bathFloorTex.wrapT = THREE.RepeatWrapping;
    this.bathFloorTex.repeat.set(2.2, 2.2);

    // 4. Keramik Dinding Kamar Mandi Motif Abu-Abu (persis video 00:09 - 00:10)
    const bathWallCanvas = document.createElement('canvas');
    bathWallCanvas.width = 256;
    bathWallCanvas.height = 256;
    const bwctx = bathWallCanvas.getContext('2d');
    bwctx.fillStyle = '#cbd5e1';
    bwctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 64) {
        bwctx.fillStyle = ((x + y) % 128 === 0) ? '#e2e8f0' : '#cbd5e1';
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
    this.bathWallTex = new THREE.CanvasTexture(bathWallCanvas);
    this.bathWallTex.wrapS = THREE.RepeatWrapping;
    this.bathWallTex.wrapT = THREE.RepeatWrapping;
    this.bathWallTex.repeat.set(2.5, 2.5);

    // 5. Genteng Atap
    const roofCanvas = document.createElement('canvas');
    roofCanvas.width = 256;
    roofCanvas.height = 256;
    const rctx = roofCanvas.getContext('2d');
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
    const pctx = paveCanvas.getContext('2d');
    pctx.fillStyle = '#cbd5e1';
    pctx.fillRect(0, 0, 256, 256);
    pctx.strokeStyle = '#94a3b8';
    pctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = -32; x < 256; x += 64) {
        pctx.fillStyle = ((x + y) % 128 === 0) ? '#cbd5e1' : '#dbe3ec';
        pctx.fillRect(x + offset + 1, y + 1, 62, 30);
        pctx.strokeRect(x + offset, y, 64, 32);
      }
    }
    this.paveTexture = new THREE.CanvasTexture(paveCanvas);
    this.paveTexture.wrapS = THREE.RepeatWrapping;
    this.paveTexture.wrapT = THREE.RepeatWrapping;
    this.paveTexture.repeat.set(18, 10);
  }

  _makeNumberPlateTexture(nomorUnit, status) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const bg = status === 'kosong' ? '#059669' : (status === 'maintenance' ? '#d97706' : '#1e293b');
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

  _makeSignboardTexture(title, subtitle) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

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

  /**
   * Membangun kompleks 3D dengan 3 bangunan terpisah:
   * - Blok A: 4 Kontrakan Memanjang (#1-#4)
   * - [Gang Pemisah]
   * - Blok B: 2 Kontrakan Memanjang Terpisah (#5-#6)
   * - [Gang Pemisah]
   * - Blok C: Gedung Bertingkat (1 Bawah #7 + 2 Atas #8-#9)
   */
  buildComplex(units) {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.unitObjects.clear();
    this.clickableMeshes = [];
    this.porchLights = [];
    this.windowGlowMats = [];
    this.blockRoofs = [];

    const block4Units = units
      .filter(u => u.blok === 'memanjang_4' || u.blok === 'memanjang')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const block2Units = units
      .filter(u => u.blok === 'memanjang_2')
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const tieredGroundUnits = units
      .filter(u => u.blok === 'bertingkat' && Number(u.lantai) === 1)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const tieredUpperUnits = units
      .filter(u => u.blok === 'bertingkat' && Number(u.lantai) >= 2)
      .sort((a, b) => a.urutan - b.urutan || a.nomor_unit - b.nomor_unit);

    const W = this.ROOM_W;
    const H = this.ROOM_H;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const SLAB = this.FLOOR_SLAB;

    const gapBetweenBlocks = 3.0; // Gang pemisah jelas antara blok 4, blok 2, dan blok bertingkat

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

    // =========================================================================
    // 1. TANAH & HALAMAN PAVING
    // =========================================================================
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

    // =========================================================================
    // 2. BLOK A — DERET 4 MEMANJANG (#01 - #04)
    // =========================================================================
    if (block4Units.length > 0) {
      const b4CenterX = cursorX + block4Width / 2;
      const b4Roof = this._createPitchedRoof(b4CenterX, H + 0.14, baseZ + TD * 0.35, block4Width + 0.85, D + TD + 1.1, 1.5);
      const b4Fascia = this._createFascia(b4CenterX, H + 0.08, baseZ + D / 2 + TD + 0.1, block4Width + 0.55);
      b4Roof.add(b4Fascia);
      this.blockRoofs.push(b4Roof);

      block4Units.forEach((unit, idx) => {
        const ux = cursorX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), { blockRoof: b4Roof });
      });

      cursorX += block4Width;

      // Gang taman pemisah antara Blok 4 & Blok 2
      if (block2Units.length > 0 || hasTiered) {
        this._createWalkwayGarden(cursorX + gapBetweenBlocks / 2, 0.06, baseZ + 0.8);
        cursorX += gapBetweenBlocks;
      }
    }

    // =========================================================================
    // 3. BLOK B — DERET 2 MEMANJANG TERPISAH (#05 - #06)
    // =========================================================================
    if (block2Units.length > 0) {
      const b2CenterX = cursorX + block2Width / 2;
      const b2Roof = this._createPitchedRoof(b2CenterX, H + 0.14, baseZ + TD * 0.35, block2Width + 0.85, D + TD + 1.1, 1.45);
      const b2Fascia = this._createFascia(b2CenterX, H + 0.08, baseZ + D / 2 + TD + 0.1, block2Width + 0.55);
      b2Roof.add(b2Fascia);
      this.blockRoofs.push(b2Roof);

      block2Units.forEach((unit, idx) => {
        const ux = cursorX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), { blockRoof: b2Roof });
      });

      cursorX += block2Width;

      // Gang taman pemisah antara Blok 2 & Gedung Bertingkat
      if (hasTiered) {
        this._createWalkwayGarden(cursorX + gapBetweenBlocks / 2, 0.06, baseZ + 0.8);
        cursorX += gapBetweenBlocks;
      }
    }

    // =========================================================================
    // 4. BLOK C — GEDUNG BERTINGKAT (1 Bawah #07 + 2 Atas #08, #09)
    // =========================================================================
    if (hasTiered) {
      const tieredStartX = cursorX;
      const tieredCenterX = tieredStartX + tieredWidth / 2;
      const floor2Y = 0.08 + H + SLAB;

      // Atap Gedung Bertingkat (Lantai 2)
      const upperRoof = this._createPitchedRoof(tieredCenterX, floor2Y + H + 0.06, baseZ + TD * 0.35, tieredWidth + 0.85, D + TD + 1.1, 1.65);
      const upperFascia = this._createFascia(tieredCenterX, floor2Y + H, baseZ + D / 2 + TD + 0.1, tieredWidth + 0.55);
      upperRoof.add(upperFascia);
      this.blockRoofs.push(upperRoof);

      // Bay-0 Lantai 1: Area Tangga + Carport Teduh di bawah Unit #8
      this._createStaircaseAndCarport(tieredStartX + W / 2, 0.08, baseZ, floor2Y);

      // Unit Lantai 1 Blok Bertingkat (#07 di bawah #09)
      tieredGroundUnits.forEach((unit, idx) => {
        const bayIdx = idx + 1;
        const ux = tieredStartX + bayIdx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, 0.08, baseZ), { blockRoof: null });
      });

      // Pilar penyangga otomatis jika unit lantai 2 melebihi lantai 1 + 1
      for (let bay = tieredGroundUnits.length + 1; bay < tieredBays; bay++) {
        const px = tieredStartX + bay * W + W / 2;
        this._createSupportBay(px, 0.08, baseZ, H + SLAB);
      }

      // Plat Lantai 2 + Balkon & Railing Besi
      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(tieredWidth + 0.35, SLAB, D + TD + 0.4),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 })
      );
      slabMesh.position.set(tieredCenterX, 0.08 + H + SLAB / 2, baseZ + TD / 2);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      this.worldGroup.add(slabMesh);

      this._createBalconyRailing(tieredStartX, floor2Y, baseZ + D / 2 + TD - 0.06, tieredWidth);

      // Unit Lantai 2 (#08 & #09)
      tieredUpperUnits.forEach((unit, idx) => {
        const ux = tieredStartX + idx * W + W / 2;
        this._createUnitRoom(unit, new THREE.Vector3(ux, floor2Y, baseZ), { blockRoof: upperRoof });
      });

      cursorX += tieredWidth;
    }

    const rightMostX = cursorX;

    // =========================================================================
    // 5. PAPAN NAMA, POHON, & LAMPU TAMAN
    // =========================================================================
    this._createMainSignboard(0, 0.04, D / 2 + TD + 9.2);

    this._createTree(leftMostX - 3.6, 0, baseZ + 5.6, 1.15);
    this._createTree(leftMostX - 4.4, 0, baseZ - 2.6, 1.35);
    this._createTree(rightMostX + 3.8, 0, baseZ + 5.2, 1.2);
    this._createTree(rightMostX + 4.2, 0, baseZ - 2.8, 1.4);

    this._createGardenLamp(leftMostX + 1.5, 0.04, D / 2 + TD + 7.6);
    this._createGardenLamp(0, 0.04, D / 2 + TD + 7.6);
    this._createGardenLamp(rightMostX - 1.5, 0.04, D / 2 + TD + 7.6);

    // Simpan lebar kompleks dan hitung framing adaptif untuk Mobile, Tablet, dan Desktop
    this.lastComplexWidth = totalComplexWidth;
    this._updateResponsiveCameraFraming(!this.activeUnitId);

    this.setNightMode(this.isNightMode);
  }

  /**
   * Menyesuaikan FOV & jarak kamera overview secara otomatis untuk Mobile (portrait), Tablet, dan Desktop
   */
  _updateResponsiveCameraFraming(applyImmediately = false) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const complexW = this.lastComplexWidth || 38;

    let fov = 46;
    let camY = 11.2;
    let camZ = Math.max(27.5, complexW * 0.72);
    let targetY = 2.2;

    if (aspect < 0.72) {
      // Smartphone Portrait: lebarkan FOV & mundurkan kamera agar 3 blok terlihat utuh
      fov = 56;
      camY = 15.5;
      camZ = Math.max(44, complexW * 1.18);
      targetY = 1.6;
    } else if (aspect < 1.15) {
      // Tablet Portrait / Square
      fov = 52;
      camY = 13.0;
      camZ = Math.max(34, complexW * 0.90);
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

  /**
   * Membangun 1 unit kontrakan sesuai bentuk & material asli di video:
   * - Dinding krem peach hangat + plint keramik abu-abu gelap
   * - Lantai keramik putih kotak mengkilap
   * - Kusen cokelat tua + Jendela 2 daun + 2 ventilasi boven atas
   * - 3 Zona Ruang: Ruang Depan -> Sekat Kusen Cokelat Tua -> Ruang Tengah -> Lorong Meja Dapur Beton Cor + Backsplash Keramik -> Kamar Mandi Belakang
   * - Unit KOSONG 100% kosongan polos tanpa kasur/peralatan apapun!
   */
  _createUnitRoom(unit, origin, opts = {}) {
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
    // Warna dinding interior krem peach hangat persis video!
    const wallIntMat = new THREE.MeshStandardMaterial({ color: 0xefd2a7, roughness: 0.9 });
    // Plint / skirting keramik abu-abu gelap di bawah dinding (persis video)
    const skirtingMat = new THREE.MeshStandardMaterial({ color: 0x525860, roughness: 0.55 });
    // Kusen kayu cokelat tua gelap (persis video)
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.58 });
    const trimMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55 });

    // --- LANTAI KERAMIK PUTIH KOTAK MENGKILAP (Persis Video) ---
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.tileTexture,
      roughness: 0.28,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.12, D), floorMat);
    floor.position.set(0, 0.06, 0);
    floor.receiveShadow = true;
    unitGroup.add(floor);

    // Teras Depan
    const terrace = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.12, TD),
      new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.78 })
    );
    terrace.position.set(0, 0.05, D / 2 + TD / 2);
    terrace.receiveShadow = true;
    unitGroup.add(terrace);

    // Pilar Teras Depan
    this._addBox(unitGroup, 0.18, H, 0.18, W / 2 - 0.12, H / 2, D / 2 + TD - 0.14, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 }), true);

    // Strip aksen tipis luar bawah dinding depan
    this._addBox(unitGroup, W - 0.02, 0.24, 0.05, 0, 0.16, D / 2 + 0.04, trimMat);

    // --- DINDING UTAMA (BELAKANG, KIRI, KANAN) ---
    this._addBox(unitGroup, W, H, wallT, 0, H / 2, -D / 2 + wallT / 2, wallIntMat, true);
    this._addBox(unitGroup, wallT, H, D, -W / 2 + wallT / 2, H / 2, 0, wallIntMat, true);
    this._addBox(unitGroup, wallT, H, D, W / 2 - wallT / 2, H / 2, 0, wallIntMat, true);

    // Plint keramik abu-abu gelap keliling tepi bawah dinding interior (tinggi 12 cm, persis video!)
    const skH = 0.12;
    const skY = 0.12 + skH / 2;
    this._addBox(unitGroup, 0.02, skH, D - 0.2, -W / 2 + wallT + 0.01, skY, 0, skirtingMat);
    this._addBox(unitGroup, 0.02, skH, D - 0.2, W / 2 - wallT - 0.01, skY, 0, skirtingMat);
    this._addBox(unitGroup, W - 0.2, skH, 0.02, 0, skY, -D / 2 + wallT + 0.01, skirtingMat);

    // Plafon putih polos (bisa disembunyikan saat Mode Denah 3D)
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.04, 0.1, D - 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 })
    );
    ceiling.position.set(0, H - 0.05, 0);
    unitGroup.add(ceiling);

    // --- DINDING DEPAN: PINTU KIRI + JENDELA 2 DAUN + 2 VENTILASI BOVEN (Persis Video!) ---
    const fz = D / 2 - wallT / 2;
    // Pintu depan: x dari -1.52 s/d -0.56 (lebar 0.96, tinggi 2.14)
    // Jendela 2 daun: x dari 0.12 s/d 1.48 (lebar 1.36, y 1.02..2.18)
    // 2 Lubang ventilasi boven tepat di atas jendela: y 2.34..2.52
    this._addBox(unitGroup, 0.48, H, wallT, -W / 2 + 0.24, H / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.96, H - 2.14, wallT, -1.04, 2.14 + (H - 2.14) / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.68, H, wallT, -0.22, H / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 1.36, 1.02, wallT, 0.80, 0.51, fz, wallExtMat, true);
    this._addBox(unitGroup, 1.36, H - 2.18, wallT, 0.80, 2.18 + (H - 2.18) / 2, fz, wallExtMat, true);
    this._addBox(unitGroup, 0.52, H, wallT, W / 2 - 0.26, H / 2, fz, wallExtMat, true);

    // Kusen pintu depan cokelat tua
    this._addBox(unitGroup, 0.06, 2.14, 0.17, -1.52, 1.07, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 2.14, 0.17, -0.56, 1.07, fz, darkWoodMat);
    this._addBox(unitGroup, 1.02, 0.06, 0.17, -1.04, 2.14, fz, darkWoodMat);

    // Kusen Jendela 2 Daun Cokelat Tua + 2 Ventilasi Boven (Persis video 00:07 & 00:12!)
    this._addBox(unitGroup, 1.42, 0.06, 0.17, 0.80, 1.02, fz, darkWoodMat);
    this._addBox(unitGroup, 1.42, 0.06, 0.17, 0.80, 2.18, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.16, 0.17, 0.12, 1.60, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.16, 0.17, 1.48, 1.60, fz, darkWoodMat);
    this._addBox(unitGroup, 0.06, 1.14, 0.16, 0.80, 1.60, fz, darkWoodMat); // pembagi 2 daun

    // 2 Kotak Ventilasi Boven di atas jendela
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
    glassPane.position.set(0.80, 1.60, fz + 0.02);
    unitGroup.add(glassPane);

    // --- PINTU DEPAN BERENGSEL ---
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-1.50, 0.12, fz);
    unitGroup.add(doorPivot);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4b3326, roughness: 0.55 });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.02, 0.06), doorMat);
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

    // Plat Nomor Unit
    const plateTex = this._makeNumberPlateTexture(unit.nomor_unit, unit.status);
    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 })
    );
    plateMesh.position.set(-1.04, 2.52, fz + 0.08);
    unitGroup.add(plateMesh);

    // Lampu Teras Depan
    const sconceBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde047,
      emissiveIntensity: 0.25,
    });
    const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), sconceBulbMat);
    sconce.position.set(-0.22, 2.48, fz + 0.13);
    unitGroup.add(sconce);

    const porchLight = new THREE.PointLight(0xffedd5, 0.0, 6.5);
    porchLight.position.set(-0.22, 2.35, fz + 0.45);
    unitGroup.add(porchLight);
    this.porchLights.push({ light: porchLight, bulbMat: sconceBulbMat });

    // Fitting & Bohlam Lampu Plafon (2 titik: ruang depan & ruang tengah)
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

    // =========================================================================
    // STRUKTUR INTERIOR ASLI SESUAI VIDEO (SEKAT + MEJA DAPUR COR + KAMAR MANDI)
    // =========================================================================
    this._buildRealVideoStructure(unitGroup, W, H, D, wallIntMat, skirtingMat, darkWoodMat);

    // Unit KOSONG & MAINTENANCE: 100% KOSONGAN POLOS tanpa kasur atau peralatan apapun!
    // Unit TERISI: Struktur ruangan identik, hanya tambah perlengkapan minimalis penghuni
    if (unit.status === 'terisi') {
      this._buildMinimalOccupiedItems(unitGroup, accentColor);
    }

    // --- HITBOX INTERAKTIF ---
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.06, H - 0.06, D + TD * 0.6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, H / 2, TD * 0.25);
    hitBox.userData.unitId = unit.id;
    unitGroup.add(hitBox);
    this.clickableMeshes.push(hitBox);

    // Highlight strip di teras saat hover
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
    });
    const highlightStrip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.05, 0.16), highlightMat);
    highlightStrip.position.set(0, 0.13, D / 2 + TD - 0.08);
    unitGroup.add(highlightStrip);

    // Anchor kamera (masuk melewati pintu depan ke ruang depan, bisa lihat lurus menembus sekat ke ruang tengah & dapur!)
    const worldOrigin = origin.clone();
    const labelAnchor = new THREE.Vector3(worldOrigin.x, worldOrigin.y + H + 0.55, worldOrigin.z + D / 2 + 0.65);
    const doorApproachPos = new THREE.Vector3(worldOrigin.x - 0.9, worldOrigin.y + 1.62, worldOrigin.z + D / 2 + TD + 2.6);
    const doorApproachTarget = new THREE.Vector3(worldOrigin.x - 0.5, worldOrigin.y + 1.4, worldOrigin.z + 0.5);
    const interiorCamPos = new THREE.Vector3(worldOrigin.x - 0.65, worldOrigin.y + 1.62, worldOrigin.z + D / 2 - 0.75);
    const interiorTarget = new THREE.Vector3(worldOrigin.x + 0.15, worldOrigin.y + 1.25, worldOrigin.z - 1.45);
    const cutawayCamPos = new THREE.Vector3(worldOrigin.x + 0.2, worldOrigin.y + 8.6, worldOrigin.z + 5.6);
    const cutawayTarget = new THREE.Vector3(worldOrigin.x, worldOrigin.y + 0.6, worldOrigin.z - 0.2);

    this.unitObjects.set(unit.id, {
      unit,
      group: unitGroup,
      blockRoof: opts.blockRoof || null,
      doorPivot,
      doorTargetAngle: 0,
      ceiling,
      interiorLight,
      highlightMat,
      labelAnchor,
      doorApproachPos,
      doorApproachTarget,
      interiorCamPos,
      interiorTarget,
      cutawayCamPos,
      cutawayTarget,
    });
  }

  /**
   * Struktur ruangan 100% persis video:
   * 1. Ruang Depan (kosong) + Saklar lampu putih
   * 2. Sekat Dinding + Bukaan Kusen Cokelat Tua (tanpa daun pintu)
   * 3. Ruang Tengah (kosong) + Stopkontak dinding
   * 4. Lorong Dapur: Meja Dapur Beton Cor permanen (top keramik cokelat tua, bawah putih terbuka) + Keramik Backsplash Kotak
   * 5. Kamar Mandi Belakang: Kusen PVC putih/abu terbuka + Lantai Keramik Motif Biru-Abu + Dinding Keramik Motif Abu-Abu + Kloset & Bak Mandi permanen
   */
  _buildRealVideoStructure(group, W, H, D, wallIntMat, skirtingMat, darkWoodMat) {
    const skH = 0.12;
    const skY = 0.12 + skH / 2;

    // 1. SEKAT ANTARA RUANG DEPAN (z: +3.5..+1.35) & RUANG TENGAH (z: +1.35..-1.30)
    // Bukaan kusen cokelat tua di sisi kiri-tengah: x dari -1.35 s/d -0.35 (lebar 1.0, tinggi 2.15)
    const partZ = 1.35;
    const pT = 0.12;
    // Dinding kiri bukaan
    this._addBox(group, 0.55, H, pT, -1.625, H / 2, partZ, wallIntMat, true);
    // Dinding atas bukaan
    this._addBox(group, 1.0, H - 2.15, pT, -0.85, 2.15 + (H - 2.15) / 2, partZ, wallIntMat, true);
    // Dinding kanan bukaan (memanjang ke dinding kanan)
    this._addBox(group, 2.25, H, pT, 0.775, H / 2, partZ, wallIntMat, true);

    // Plint abu-abu gelap pada kedua sisi sekat
    this._addBox(group, 2.22, skH, 0.02, 0.77, skY, partZ + pT / 2 + 0.01, skirtingMat);
    this._addBox(group, 2.22, skH, 0.02, 0.77, skY, partZ - pT / 2 - 0.01, skirtingMat);
    this._addBox(group, 0.52, skH, 0.02, -1.62, skY, partZ + pT / 2 + 0.01, skirtingMat);
    this._addBox(group, 0.52, skH, 0.02, -1.62, skY, partZ - pT / 2 - 0.01, skirtingMat);

    // Kusen bukaan sekat cokelat tua (persis frame 00:05 - 00:08 & 00:12)
    this._addBox(group, 0.06, 2.15, 0.16, -1.35, 1.075, partZ, darkWoodMat);
    this._addBox(group, 0.06, 2.15, 0.16, -0.35, 1.075, partZ, darkWoodMat);
    this._addBox(group, 1.06, 0.06, 0.16, -0.85, 2.15, partZ, darkWoodMat);

    // Saklar lampu putih & stopkontak dinding (persis video 00:00 & 00:09)
    const switchMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    this._addBox(group, 0.03, 0.11, 0.10, W / 2 - 0.14, 1.45, 2.55, switchMat);
    this._addBox(group, 0.03, 0.11, 0.10, -W / 2 + 0.14, 0.48, 0.15, switchMat);
    this._addBox(group, 0.03, 0.11, 0.10, 0.25, 1.38, -1.35, switchMat);

    // 2. LORONG DAPUR DI BELAKANG KANAN (z: -1.30 s/d -3.38, x: +0.25 s/d +1.87)
    // Meja Dapur Beton Cor Permanen di dinding kanan belakang (persis video 00:05, 00:09-00:10!)
    const counterBaseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
    const counterTopMat = new THREE.MeshStandardMaterial({ color: 0x4b382d, roughness: 0.35 });
    // Top keramik cokelat tua
    this._addBox(group, 0.56, 0.07, 1.65, 1.56, 0.80, -2.25, counterTopMat, true);
    // Kaki/sisi beton putih bawah meja dapur (bagian tengah terbuka seperti di video)
    this._addBox(group, 0.54, 0.68, 0.08, 1.56, 0.44, -1.46, counterBaseMat, true);
    this._addBox(group, 0.54, 0.68, 0.08, 1.56, 0.44, -3.04, counterBaseMat, true);
    // Rak tengah beton bawah
    this._addBox(group, 0.48, 0.05, 1.50, 1.56, 0.26, -2.25, counterBaseMat);

    // Keramik Backsplash Dinding Dapur di atas meja cor (persis video 00:03, 00:05, 00:09)
    const backsplash = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 1.22),
      new THREE.MeshStandardMaterial({ map: this.kitchenBacksplashTex, roughness: 0.35 })
    );
    backsplash.rotation.y = -Math.PI / 2;
    backsplash.position.set(W / 2 - 0.145, 1.46, -2.25);
    group.add(backsplash);

    // 3. KAMAR MANDI BELAKANG KIRI (x: -1.87 s/d +0.18, z: -1.55 s/d -3.38)
    // Dinding depan kamar mandi menghadap Ruang Tengah (solid krem peach)
    const bmFrontZ = -1.55;
    const bmRightX = 0.18;
    this._addBox(group, 2.08, H, 0.12, -0.84, H / 2, bmFrontZ, wallIntMat, true);
    this._addBox(group, 2.04, skH, 0.02, -0.84, skY, bmFrontZ + 0.07, skirtingMat);

    // Dinding kanan kamar mandi menghadap Lorong Dapur dengan PINTU PVC TERBUKA (z: -1.70 s/d -2.50)
    // Kolom atas pintu kamar mandi
    this._addBox(group, 0.12, H - 1.98, 0.78, bmRightX, 1.98 + (H - 1.98) / 2, -2.10, wallIntMat, true);
    // Dinding sisa kanan belakang kamar mandi
    this._addBox(group, 0.12, H, 0.96, bmRightX, H / 2, -2.97, wallIntMat, true);
    this._addBox(group, 0.02, skH, 0.94, bmRightX + 0.07, skY, -2.97, skirtingMat);

    // Kusen Pintu Kamar Mandi PVC Putih/Abu-Abu (persis video 00:09 - 00:10)
    const pvcMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    this._addBox(group, 0.14, 1.98, 0.05, bmRightX, 0.99, -1.70, pvcMat);
    this._addBox(group, 0.14, 1.98, 0.05, bmRightX, 0.99, -2.48, pvcMat);
    this._addBox(group, 0.14, 0.05, 0.82, bmRightX, 1.98, -2.09, pvcMat);

    // Daun Pintu PVC sedikit terbuka ke dalam kamar mandi agar lantai & dinding keramik terlihat!
    const bmDoor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.92, 0.72), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 }));
    bmDoor.position.set(bmRightX - 0.34, 0.98, -1.76);
    bmDoor.rotation.y = Math.PI / 2 - 0.25;
    group.add(bmDoor);

    // Lantai Keramik Kamar Mandi Motif Kotak Biru-Abu (persis video 00:09 - 00:10!)
    const bmFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.96, 1.76),
      new THREE.MeshStandardMaterial({ map: this.bathFloorTex, roughness: 0.4 })
    );
    bmFloor.rotation.x = -Math.PI / 2;
    bmFloor.position.set(-0.85, 0.128, -2.47);
    group.add(bmFloor);

    // Dinding Keramik Kamar Mandi Motif Batu Abu-Abu (setinggi 1.75m di dinding belakang & kiri dalam KM)
    const bmWallMat = new THREE.MeshStandardMaterial({ map: this.bathWallTex, roughness: 0.35 });
    const bmBackTile = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.75), bmWallMat);
    bmBackTile.position.set(-0.85, 1.0, -3.35);
    group.add(bmBackTile);

    const bmLeftTile = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.75), bmWallMat);
    bmLeftTile.rotation.y = Math.PI / 2;
    bmLeftTile.position.set(-1.85, 1.0, -2.47);
    group.add(bmLeftTile);

    // Perlengkapan Permanen Bawaan Kamar Mandi (Bak Mandi Keramik & Kloset Jongkok)
    this._addBox(group, 0.62, 0.68, 0.68, -1.50, 0.46, -2.98, new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.35 }), true);
    this._addBox(group, 0.44, 0.08, 0.56, -0.62, 0.17, -2.95, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }));
  }

  /**
   * Hanya ditambahkan pada unit berstatus TERISI (unit KOSONG tetap 100% kosongan polos!)
   */
  _buildMinimalOccupiedItems(group, accentColor) {
    const fabricMat = new THREE.MeshStandardMaterial({
      color: accentColor.clone().lerp(new THREE.Color(0x1e293b), 0.25),
      roughness: 0.9,
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });

    // Kasur busa di Ruang Tengah (z: +1.10 .. -1.25)
    this._addBox(group, 1.32, 0.18, 1.90, 1.05, 0.21, -0.10, whiteMat, true);
    this._addBox(group, 1.34, 0.05, 1.20, 1.05, 0.32, 0.22, fabricMat, true);
    this._addBox(group, 0.48, 0.12, 0.32, 0.80, 0.36, -0.82, whiteMat, true);
    this._addBox(group, 0.48, 0.12, 0.32, 1.30, 0.36, -0.82, whiteMat, true);

    // Lemari pakaian 2 pintu di dinding kiri Ruang Tengah
    this._addBox(group, 0.48, 1.80, 1.05, -1.58, 1.02, -0.20, woodMat, true);

    // Kompor 2 tungku di atas meja dapur beton cor
    this._addBox(group, 0.36, 0.08, 0.68, 1.56, 0.88, -2.15, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.3 }));
  }

  _createPitchedRoof(cx, y, cz, width, depth, ridgeHeight) {
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

    const roofMat = new THREE.MeshStandardMaterial({
      map: this.roofTexture,
      color: 0xc2410c,
      roughness: 0.78,
    });

    const roofMesh = new THREE.Mesh(extrudeGeo, roofMat);
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

  _createFascia(cx, y, z, width) {
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.24, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    // Dipasang sebagai child dari roofGroup? Kita posisikan lokal terhadap worldGroup saja
    fascia.position.set(0, -0.06, this.ROOM_D / 2 + this.TERRACE_D * 0.65 + 0.1);
    fascia.castShadow = true;
    return fascia;
  }

  _createStaircaseAndCarport(cx, y, cz, floor2Y) {
    const W = this.ROOM_W;
    const D = this.ROOM_D;
    const TD = this.TERRACE_D;
    const totalRise = floor2Y - y;

    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    this.worldGroup.add(grp);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.12, D + TD),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 })
    );
    floor.position.set(0, 0.05, TD / 2);
    floor.receiveShadow = true;
    grp.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(W, totalRise, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 })
    );
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
      const sy = (i + 0.5) * stepH;
      const sz = stairStartZ - i * stepD;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH * 0.95, stepD + 0.05), stepMat);
      step.position.set(-W / 2 + stepW / 2 + 0.24, sy, sz);
      step.castShadow = true;
      step.receiveShadow = true;
      grp.add(step);
    }

    const railLen = Math.hypot(stairRun, totalRise);
    const railAngle = Math.atan2(totalRise, stairRun);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 });
    const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, railLen), railMat);
    handrail.position.set(-W / 2 + stepW + 0.24, totalRise / 2 + 0.85, stairStartZ - stairRun / 2);
    handrail.rotation.x = railAngle;
    grp.add(handrail);
  }

  _createSupportBay(cx, y, cz, height) {
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

  _createBalconyRailing(startX, floorY, frontZ, totalWidth) {
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
      const bx = startX + opening + (i / count) * railW;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, 0.04), railMat);
      post.position.set(bx, floorY + railH / 2, frontZ);
      this.worldGroup.add(post);
    }

    const sideDepth = this.TERRACE_D;
    const rightSideBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, sideDepth), railMat);
    rightSideBar.position.set(startX + totalWidth - 0.06, floorY + railH, frontZ - sideDepth / 2);
    this.worldGroup.add(rightSideBar);
  }

  _createWalkwayGarden(cx, y, cz) {
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

  _createPottedPlant(x, y, z) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.17, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 })
    );
    pot.position.set(x, y + 0.18, z);
    pot.castShadow = true;
    this.worldGroup.add(pot);

    const bush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.34, 1),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 })
    );
    bush.position.set(x, y + 0.56, z);
    bush.castShadow = true;
    this.worldGroup.add(bush);
  }

  _createTree(x, y, z, scale = 1) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.scale.setScalar(scale);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
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

  _createMainSignboard(x, y, z) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
    this._addBox(grp, 0.12, 2.25, 0.12, -1.75, 1.12, 0, postMat, true);
    this._addBox(grp, 0.12, 2.25, 0.12, 1.75, 1.12, 0, postMat, true);

    const tex = this._makeSignboardTexture('KONTRAKAN TEH AMOY', 'Hunian Nyaman & Asri • Klik Pintu Untuk Masuk 3D');
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 1.0, 0.14),
      [
        postMat, postMat, postMat, postMat,
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }),
        postMat,
      ]
    );
    board.position.set(0, 1.85, 0);
    board.castShadow = true;
    grp.add(board);

    this.worldGroup.add(grp);
  }

  _createGardenLamp(x, y, z) {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.35 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 10), postMat);
    post.position.set(x, y + 1.3, z);
    post.castShadow = true;
    this.worldGroup.add(post);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde047,
      emissiveIntensity: 0.25,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bulbMat);
    globe.position.set(x, y + 2.68, z);
    this.worldGroup.add(globe);

    const light = new THREE.PointLight(0xfef08a, 0.0, 10);
    light.position.set(x, y + 2.6, z);
    this.worldGroup.add(light);
    this.porchLights.push({ light, bulbMat });
  }

  _addBox(parent, w, h, d, x, y, z, material, castShadow = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    if (castShadow) {
      mesh.castShadow = true;
    }
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _restoreAllRoofsAndCeilings() {
    this.blockRoofs.forEach(r => { r.visible = true; });
    for (const item of this.unitObjects.values()) {
      item.ceiling.visible = true;
    }
  }

  enterUnit(unitId) {
    const obj = this.unitObjects.get(unitId);
    if (!obj) return;

    this._restoreAllRoofsAndCeilings();

    for (const [id, item] of this.unitObjects.entries()) {
      item.doorTargetAngle = (id === unitId) ? -1.48 : 0;
      item.interiorLight.intensity = (id === unitId) ? 1.55 : (this.isNightMode ? 0.9 : 0.45);
    }

    this.activeUnitId = unitId;
    this.isCutawayMode = false;

    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    this.transition = {
      type: 'enter',
      unitId,
      elapsed: 0,
      duration: 1.45,
      waypointsPos: [startPos, obj.doorApproachPos.clone(), obj.interiorCamPos.clone()],
      waypointsTarget: [startTarget, obj.doorApproachTarget.clone(), obj.interiorTarget.clone()],
    };

    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.72;

    if (this.callbacks.onEnterUnit) {
      this.callbacks.onEnterUnit(obj.unit);
    }
  }

  exitUnit() {
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

    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const midPos = prevObj ? prevObj.doorApproachPos.clone() : startPos.clone();

    this.activeUnitId = null;
    this.isCutawayMode = false;

    this.transition = {
      type: 'exit',
      elapsed: 0,
      duration: 1.25,
      waypointsPos: [startPos, midPos, this.overviewCamPos.clone()],
      waypointsTarget: [startTarget, this.overviewTarget.clone(), this.overviewTarget.clone()],
    };

    if (this.callbacks.onExitUnit) {
      this.callbacks.onExitUnit();
    }
  }

  toggleCutawayMode() {
    if (!this.activeUnitId) return false;
    const obj = this.unitObjects.get(this.activeUnitId);
    if (!obj) return false;

    this.isCutawayMode = !this.isCutawayMode;
    obj.ceiling.visible = !this.isCutawayMode;
    if (obj.blockRoof) {
      obj.blockRoof.visible = !this.isCutawayMode;
    }

    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos = this.isCutawayMode ? obj.cutawayCamPos.clone() : obj.interiorCamPos.clone();
    const endTarget = this.isCutawayMode ? obj.cutawayTarget.clone() : obj.interiorTarget.clone();

    this.transition = {
      type: 'cutaway',
      unitId: this.activeUnitId,
      elapsed: 0,
      duration: 0.85,
      waypointsPos: [startPos, endPos],
      waypointsTarget: [startTarget, endTarget],
    };

    return this.isCutawayMode;
  }

  resetCamera() {
    this.transition = {
      type: 'reset',
      elapsed: 0,
      duration: 0.9,
      waypointsPos: [this.camera.position.clone(), this.overviewCamPos.clone()],
      waypointsTarget: [this.controls.target.clone(), this.overviewTarget.clone()],
    };
  }

  setNightMode(isNight) {
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
      this.windowGlowMats.forEach(m => { m.emissiveIntensity = 0.42; });
      for (const [id, obj] of this.unitObjects.entries()) {
        obj.interiorLight.intensity = (id === this.activeUnitId) ? 1.85 : 0.95;
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
      this.windowGlowMats.forEach(m => { m.emissiveIntensity = 0.0; });
      for (const [id, obj] of this.unitObjects.entries()) {
        obj.interiorLight.intensity = (id === this.activeUnitId) ? 1.45 : 0.45;
      }
    }
  }

  getProjectedLabels() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const results = [];

    for (const [id, obj] of this.unitObjects.entries()) {
      const vec = obj.labelAnchor.clone();
      vec.project(this.camera);

      const visible = vec.z < 1 && vec.x >= -1.15 && vec.x <= 1.15 && vec.y >= -1.15 && vec.y <= 1.15;
      const x = (vec.x * 0.5 + 0.5) * width;
      const y = (-vec.y * 0.5 + 0.5) * height;

      results.push({ id, x, y, visible });
    }
    return results;
  }

  _initEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      if (this.activeUnitId) {
        dom.style.cursor = 'grab';
        return;
      }
      this._updatePointer(e);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);

      const hitId = hits.length > 0 ? hits[0].object.userData.unitId : null;
      if (hitId !== this.hoveredUnitId) {
        if (this.hoveredUnitId && this.unitObjects.has(this.hoveredUnitId)) {
          this.unitObjects.get(this.hoveredUnitId).highlightMat.opacity = 0;
        }
        this.hoveredUnitId = hitId;
        if (hitId && this.unitObjects.has(hitId)) {
          this.unitObjects.get(hitId).highlightMat.opacity = 0.85;
          dom.style.cursor = 'pointer';
        } else {
          dom.style.cursor = 'grab';
        }
      }
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return;
      if (this.activeUnitId) return;

      this._updatePointer(e);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
      if (hits.length > 0) {
        this.enterUnit(hits[0].object.userData.unitId);
      }
    });

    window.addEventListener('resize', () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h);
      this._updateResponsiveCameraFraming(!this.activeUnitId);
    });
  }

  _updatePointer(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _samplePath(points, t) {
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

  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
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
          this.controls.maxDistance = 60;
          this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (this.callbacks.onFrameUpdate) {
      this.callbacks.onFrameUpdate();
    }
  }
}
