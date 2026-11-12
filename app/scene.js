// The 3D picture of the building. Everything here is in feet, Y up, with the
// front wall facing +Z and the building centered on the origin.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';

const PANEL_FT = 3;          // one steel panel covers 36 inches
const ROW_FT = 2;            // screw rows follow the girts and purlins
const TINT_PANELS = 8;       // panels before the shade pattern repeats
const WAINSCOT_FT = 3;
const UP = new THREE.Vector3(0, 1, 0);
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UPRIGHT = new THREE.PlaneGeometry(1, 1);
const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const TRUNK = new THREE.CylinderGeometry(0.5, 0.7, 1, 8);
const CUPOLA_CAP = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).toNonIndexed();
CUPOLA_CAP.computeVertexNormals();
const SHARED = new Set([UNIT, UPRIGHT, FLAT, TRUNK, CUPOLA_CAP]);

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function canvasTexture(w, h, paint, color = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  paint(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A ribbed steel panel: a tall rib every 9 inches with two low ribs between,
// a screw beside each tall rib on every row, and a lap line where panels meet.
function panelTextures() {
  const rib = (s, at, half, top, tall) => {
    const d = Math.abs(s - at);
    return d < top ? tall : d < half ? tall * (half - d) / (half - top) : 0;
  };
  const profile = (u) => {
    const s = (((u * 4 + 0.5) % 1) + 1) % 1;
    return Math.max(rib(s, 0.5, 0.13, 0.05, 1), rib(s, 0.17, 0.05, 0.02, 0.28), rib(s, 0.83, 0.05, 0.02, 0.28));
  };
  // Distance in inches from the nearest screw, measured on one panel.
  const screw = (xIn, yIn) => {
    let best = 99;
    for (let k = 0; k < 4; k++) {
      let dx = Math.abs(xIn - ((k * 9 - 1.85 + 36) % 36));
      dx = Math.min(dx, 36 - dx);
      best = Math.min(best, Math.hypot(dx, yIn - 12));
    }
    return best;
  };
  const HEAD = 0.36;

  const nw = 512, nh = 128;
  const height = (x, y) => {
    const xx = (x + nw) % nw, yy = (y + nh) % nh;
    const d = screw(xx * 36 / nw, yy * 24 / nh);
    return profile(xx / nw) + (d < HEAD ? 0.5 * Math.sqrt(1 - (d / HEAD) ** 2) : 0);
  };
  const normal = canvasTexture(nw, nh, (d) => {
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const sx = (height(x + 1, y) - height(x - 1, y)) * 5;
      const sy = (height(x, y + 1) - height(x, y - 1)) * 1.875;
      const len = Math.hypot(sx, sy, 1);
      d.set([127.5 - 127.5 * sx / len, 127.5 + 127.5 * sy / len, 127.5 + 127.5 / len, 255], (y * nw + x) * 4);
    }
  }, false);

  const pw = 256, sw = pw * TINT_PANELS, sh = 128;
  const rand = seeded(23);
  const tint = Array.from({ length: TINT_PANELS }, () => 1 - rand() * 0.07);
  const shade = canvasTexture(sw, sh, (d) => {
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const px = x % pw, u = px / pw;
      const s = (profile(u + 1 / 512) - profile(u - 1 / 512)) * 5;
      let v = (255 - Math.min(70, Math.abs(s) * 55)) * tint[Math.floor(x / pw)];
      if (px === 4) v *= 0.74;
      const near = screw(px * 36 / pw, y * 24 / sh);
      if (near < HEAD) v *= y * 24 / sh > 12 ? 0.6 : 0.82;
      d.set([v, v, v, 255], (y * sw + x) * 4);
    }
  });
  return { normal, shade };
}

function speckle(base, spread, blotches = 0, size = 256) {
  const rand = seeded(7);
  return canvasTexture(size, size, (d, w, h) => {
    for (let p = 0; p < w * h; p++) {
      const k = 1 + (rand() - 0.5) * spread;
      d.set([base[0] * k, base[1] * k, base[2] * k, 255], p * 4);
    }
    for (let n = 0; n < blotches; n++) {
      const cx = rand() * w, cy = rand() * h, r = 8 + rand() * 22, k = 1 + (rand() - 0.5) * spread * 0.7;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        const p = (((Math.round(cy + y) + h) % h) * w + ((Math.round(cx + x) + w) % w)) * 4;
        d[p] *= k; d[p + 1] *= k; d[p + 2] *= k;
      }
    }
  });
}

// Soft see-through patches laid over the grass: darker lush spots and drier
// yellow ones, so the lawn is not one flat green.
function mottle(size = 256) {
  const rand = seeded(11);
  const layer = (g) => {
    const v = Array.from({ length: g * g }, rand);
    const at = (i, j) => v[(j % g) * g + (i % g)];
    return (x, y) => {
      const fx = x * g, fy = y * g, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const low = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return top + (low - top) * sy;
    };
  };
  const big = layer(4), mid = layer(9);
  return canvasTexture(size, size, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = big(x / w, y / h) * 0.6 + mid(x / w, y / h) * 0.4;
      const t = Math.max(-1, Math.min(1, (n - 0.5) * 2.6));
      d.set(t < 0 ? [46, 76, 32, -t * 150] : [138, 140, 76, t * 105], (y * w + x) * 4);
    }
  });
}

// See-through black pictures used for soft shading. `alpha` gets x and y from 0 to 1.
function shadeTexture(w, h, alpha) {
  const t = canvasTexture(w, h, (d) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      d.set([0, 0, 0, 255 * alpha(x / (w - 1 || 1), y / (h - 1 || 1))], (y * w + x) * 4);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function shadeMaterial(map, opacity) {
  return new THREE.MeshBasicMaterial({
    map, opacity, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// Flat panels drawn as rectangles with their texture coordinates in feet,
// so ribs stay 9 inches apart however big the wall is.
function sheet() {
  const p = [], n = [], t = [], i = [];
  const vert = (u, v, z) => { p.push(u, v, z); n.push(0, 0, 1); t.push(u, v); };
  return {
    quad(u0, v0, u1, v1, z = 0) {
      const k = p.length / 3;
      vert(u0, v0, z); vert(u1, v0, z); vert(u1, v1, z); vert(u0, v1, z);
      i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    },
    tri(a, b, c) {
      const k = p.length / 3;
      for (const [u, v] of [a, b, c]) vert(u, v, 0);
      i.push(k, k + 1, k + 2);
    },
    get empty() { return i.length === 0; },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2));
      g.setIndex(i);
      return g;
    },
  };
}

function box(parent, mat, sx, sy, sz, x, y, z, rx = 0) {
  const m = new THREE.Mesh(UNIT, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A patch of ground cover lying flat, with its texture measured in feet.
function pad(parent, mat, w, d, y) {
  const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A lumpy ball for a tree crown. The normals stay those of the smooth ball,
// which keeps the shading soft.
function crownGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.16 * Math.sin(x * 5.1 + 1.3) * Math.sin(y * 4.3 + 0.4) + 0.12 * Math.sin(z * 6.2 + x * 3.1);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}

// A plain work pickup, about 19 feet long, nose toward +X, wheels on the ground.
function buildTruck(mats) {
  const t = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xd9dbd6, metalness: 0.4, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.9, roughness: 0.25 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf4f1e4, roughness: 0.2, metalness: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x8e1b16, roughness: 0.3 });
  box(t, paint, 19, 2, 6.4, 0, 2.4, 0);
  box(t, paint, 5.2, 0.9, 6.2, 6.6, 3.85, 0);
  box(t, paint, 6.6, 2.7, 6.1, 0.9, 4.75, 0);
  box(t, paint, 7.2, 1.5, 6.4, -5.9, 4.15, 0);
  box(t, mats.dark, 6.6, 0.05, 5.6, -5.9, 4.9, 0);
  box(t, mats.glass, 5.6, 1.35, 6.14, 0.9, 5.25, 0);
  box(t, mats.glass, 6.64, 1.35, 5.3, 0.9, 5.25, 0);
  box(t, paint, 0.3, 1.4, 6.18, 0.5, 5.25, 0);
  box(t, chrome, 0.5, 0.7, 6.6, 9.6, 2.1, 0);
  box(t, chrome, 0.5, 0.7, 6.6, -9.6, 2.1, 0);
  box(t, mats.dark, 0.1, 1.3, 4.2, 9.52, 3.2, 0);
  for (const side of [1, -1]) {
    box(t, lamp, 0.1, 0.6, 0.9, 9.52, 3.3, side * 2.65);
    box(t, tail, 0.1, 0.9, 0.4, -9.52, 3.7, side * 2.9);
    for (const x of [5.9, -5.6]) {
      box(t, mats.dark, 3.5, 1.75, 0.08, x, 2.28, side * 3.18);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.85, 20).rotateX(Math.PI / 2), tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 16).rotateX(Math.PI / 2), chrome);
      for (const m of [wheel, hub]) { m.position.set(x, 1.35, side * 2.85); m.castShadow = true; t.add(m); }
    }
  }
  return t;
}

export function createView(canvas, stage) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.42;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd3d9d8, 260, 1450);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 18;
  controls.maxDistance = 420;
  controls.zoomSpeed = 0.7;

  // A late afternoon sun, low and off the front left corner, so the front wall
  // is lit, the right end sits in shade and the shadow lies across the ground.
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 30), THREE.MathUtils.degToRad(-66));
  const shadowDir = new THREE.Vector3(-sunDir.x, 0, -sunDir.z).normalize();
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const air = sky.material.uniforms;
  air.turbidity.value = 4.2;
  air.rayleigh.value = 1.7;
  air.mieCoefficient.value = 0.007;
  air.cloudCoverage.value = 0.46;
  air.cloudDensity.value = 0.5;
  air.sunPosition.value.copy(sunDir);
  sky.material.fog = false;

  const envScene = new THREE.Scene();
  envScene.add(sky);
  air.showSunDisc.value = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 10000).texture;
  scene.environmentIntensity = 0.42;
  air.showSunDisc.value = 1;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffe6c4, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x6b7350, 0.55));

  const grassMap = speckle([88, 118, 56], 0.55);
  grassMap.repeat.set(260, 260);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1600, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  const mottleMap = mottle();
  mottleMap.repeat.set(22, 22);
  const patches = new THREE.Mesh(ground.geometry, new THREE.MeshStandardMaterial({
    map: mottleMap, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  patches.position.y = 0.01;
  patches.receiveShadow = true;
  scene.add(ground, patches);

  const ribs = panelTextures();
  const roofRibs = { normal: ribs.normal.clone(), shade: ribs.shade.clone() };
  ribs.normal.repeat.set(1 / PANEL_FT, 1 / ROW_FT);
  ribs.shade.repeat.set(1 / PANEL_FT / TINT_PANELS, 1 / ROW_FT);
  // Painted steel: a little mirror in the metal under a glossy paint coat.
  const metal = (maps) => new THREE.MeshPhysicalMaterial({
    map: maps?.shade, normalMap: maps?.normal, normalScale: new THREE.Vector2(1.4, 1.4),
    metalness: 0.32, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3,
  });
  const gravelMap = speckle([150, 146, 138], 0.4, 40);
  gravelMap.repeat.set(1 / 7, 1 / 7);
  const mats = {
    wall: metal(ribs), wainscot: metal(ribs), roof: metal(roofRibs), shedRoof: metal(ribs), trim: metal(), cupolaRoof: metal(),
    door: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.55, metalness: 0.1 }),
    // Test-fit boxes: see-through so the framing behind still reads.
    fits: new THREE.MeshStandardMaterial({ color: 0x4772b3, roughness: 0.8, transparent: true, opacity: 0.4, depthWrite: false }),
    misfit: new THREE.MeshStandardMaterial({ color: 0xf0883a, roughness: 0.8, transparent: true, opacity: 0.45, depthWrite: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.7 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.5, metalness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xcaa46c, roughness: 0.85 }),
    treated: new THREE.MeshStandardMaterial({ color: 0x8c8656, roughness: 0.9 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xd9bd8c, roughness: 0.8, transparent: true, opacity: 0.55 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelMap, roughness: 1 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xb9b8b2, roughness: 0.9 }),
    skylight: new THREE.MeshStandardMaterial({ color: 0xf2f4ee, roughness: 0.25, metalness: 0, emissive: 0x3a3c36 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x8d8272, roughness: 0.95 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x4f4335, roughness: 1 }),
    leaves: [0x34492a, 0x3d532e, 0x2e4228].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 })),
  };
  for (const t of [ribs.normal, ribs.shade, roofRibs.normal, roofRibs.shade, grassMap, gravelMap, mottleMap]) {
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  // Soft shading that the sun shadow alone does not give.
  const fade = shadeTexture(4, 64, (x, y) => y ** 1.7);
  const blob = shadeTexture(64, 64, (x, y) => Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.5) * 2) ** 1.5);
  const shades = { base: shadeMaterial(fade, 0.34), eave: shadeMaterial(fade, 0.3), tree: shadeMaterial(blob, 0.5) };
  const contact = new THREE.Mesh(FLAT, shadeMaterial(null, 0.5));
  contact.position.y = 0.1;
  contact.renderOrder = 2;
  scene.add(contact);

  const finished = new THREE.Group();
  const framing = new THREE.Group();
  const site = new THREE.Group();
  const setting = new THREE.Group();
  const truck = buildTruck(mats);
  const crown = crownGeometry();
  SHARED.add(crown);
  scene.add(finished, framing, site, setting, truck);
  let wallMeshes = [];
  let bigDoors = [];
  let settingKey = '';
  let mode = 'finished';
  let fitted = false;
  let queued = false;
  let spinning = 0;

  const draw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
  };
  controls.addEventListener('change', draw);
  controls.addEventListener('start', () => { spinning++; });

  function clear(group) {
    group.traverse((o) => { if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose(); });
    group.clear();
  }

  // A group whose x runs along a wall as seen from outside, y up, z out from the wall.
  function wallGroup(b, wall) {
    const L = b.lengthIn / 12, W = b.widthIn / 12;
    const g = new THREE.Group();
    if (wall === 'front') g.position.set(-L / 2, 0, W / 2);
    if (wall === 'back') { g.position.set(L / 2, 0, -W / 2); g.rotation.y = Math.PI; }
    if (wall === 'left') { g.position.set(-L / 2, 0, -W / 2); g.rotation.y = -Math.PI / 2; }
    if (wall === 'right') { g.position.set(L / 2, 0, W / 2); g.rotation.y = Math.PI / 2; }
    return g;
  }

  // A lean-to or porch. The frame shows in the framing view, and under the
  // roof of an open one in the finished view.
  function buildShed(b, s) {
    const gable = s.wall === 'left' || s.wall === 'right';
    const Lw = (gable ? b.widthIn : b.lengthIn) / 12;
    const flip = s.wall === 'back' || s.wall === 'left';
    const at = (inches) => (flip ? Lw - inches / 12 : inches / 12);
    const u0 = Math.min(at(s.startIn), at(s.endIn)), u1 = Math.max(at(s.startIn), at(s.endIn));
    const len = u1 - u0, uc = (u0 + u1) / 2, D = s.depthIn / 12, hi = s.highIn / 12, lo = s.lowIn / 12, oh = b.overhangIn / 12;
    const a = Math.atan(s.pitch / 12), slope = s.slopeIn / 12, tan = Math.tan(a);
    const top = (z) => hi - z * tan;

    const fg = wallGroup(b, s.wall);
    const frame = (g) => {
      for (const p of s.posts) {
        const z = p.outIn / 12, u = Math.min(u1 - 0.23, Math.max(u0 + 0.23, at(p.atIn)));
        const h = top(z) - (p.line === 'outer' ? 0.8 : 0.2);
        box(g, mats.treated, 0.46, h, 0.46, u, h / 2, z - (p.line === 'outer' ? 0.23 : 0));
      }
      // Beam on the outer posts, ledger on the main wall, rafters between, purlins on top.
      box(g, mats.wood, len, 0.94, 0.25, uc, lo - 0.8 - 0.1, D - 0.23 + 0.36);
      box(g, mats.wood, len, 0.6, 0.125, uc, hi - 0.55, 0.07);
      for (const r of s.rafters) {
        const u = Math.min(u1 - 0.07, Math.max(u0 + 0.07, at(r)));
        box(g, mats.wood, 0.125, 0.6, slope, u, top((D + oh) / 2) - 0.47, (D + oh) / 2, a);
      }
      if (s.enclosed && g === fg) {
        box(g, mats.treated, len, 0.6, 0.125, uc, 0.3, D + 0.07);
        for (let h = 2.6; h < lo - 0.3; h += 2) box(g, mats.wood, len, 0.46, 0.125, uc, h, D + 0.07);
      }
      for (let i = 0; i < s.purlinRows; i++) {
        const along = 0.15 + (slope - 0.3) * i / (s.purlinRows - 1);
        box(g, mats.wood, len + 2 * oh, 0.125, 0.29, uc, hi - along * Math.sin(a) - 0.08, along * Math.cos(a), a);
      }
    };

    frame(fg);
    framing.add(fg);

    const g = wallGroup(b, s.wall);
    const lift = 0.02;
    const roof = sheet();
    roof.quad(u0 - oh, 0, u1 + oh, slope);
    const rm = new THREE.Mesh(roof.build(), mats.shedRoof);
    rm.rotation.x = a - Math.PI / 2;
    rm.position.set(0, top(D + oh) + lift, D + oh);
    rm.castShadow = rm.receiveShadow = true;
    g.add(rm);
    // Flashing against the main wall, fascia at the low eave, and a rake down each side.
    box(g, mats.trim, len + 2 * oh, 0.4, 0.06, uc, hi + lift + 0.17, 0.04);
    box(g, mats.trim, len + 2 * oh + 0.2, 0.6, 0.12, uc, top(D + oh) + lift - 0.24, D + oh + 0.04);
    for (const u of [u0 - oh - 0.05, u1 + oh + 0.05]) {
      box(g, mats.trim, 0.12, 0.6, slope, u, top((D + oh) / 2) + lift - 0.22, (D + oh) / 2, a);
    }
    if (!s.enclosed) frame(g);
    else {
      const add = (part, parent) => {
        const m = new THREE.Mesh(part.build(), mats.wall);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
      };
      const outer = sheet();
      outer.quad(u0, 0, u1, lo, D);
      add(outer, g);
      box(g, mats.trim, len, 0.34, 0.1, uc, 0.17, D + 0.05);
      for (const u of [u0 + 0.2, u1 - 0.2]) box(g, mats.trim, 0.42, lo, 0.1, u, lo / 2, D + 0.05);
      // Each side wall is a group of its own, turned to face away from the lean-to.
      for (const near of [true, false]) {
        const side = new THREE.Group();
        side.position.set(near ? u0 : u1, 0, near ? 0 : D);
        side.rotation.y = near ? -Math.PI / 2 : Math.PI / 2;
        const wall = sheet();
        wall.quad(0, 0, D, lo);
        wall.tri([0, lo], [D, lo], [near ? 0 : D, hi]);
        add(wall, side);
        box(side, mats.trim, D, 0.34, 0.1, D / 2, 0.17, 0.05);
        box(side, mats.trim, 0.42, lo, 0.1, near ? D - 0.2 : 0.2, lo / 2, 0.05);
        g.add(side);
      }
    }
    finished.add(g);
    const ground = pad(site, mats.gravel, len + 4, D + 2, 0.05);
    ground.position.copy(g.localToWorld(new THREE.Vector3(uc, 0.05, D / 2 + 1)));
    ground.rotation.y = g.rotation.y;
    if (s.enclosed) {
      const slab = box(site, mats.slab, len - 0.1, 0.3, D - 0.1, 0, 0, 0);
      slab.position.copy(g.localToWorld(new THREE.Vector3(uc, 0.15, D / 2)));
      slab.rotation.y = g.rotation.y;
    }
  }

  function buildWall(b, wall, hasWainscot) {
    const L = b.lengthIn / 12, W = b.widthIn / 12;
    const gable = wall === 'left' || wall === 'right';
    const Lw = gable ? W : L;
    const flip = wall === 'back' || wall === 'left';
    const g = wallGroup(b, wall);
    // A side wall stands as tall as the roof line over it. An end wall is square to the
    // lowest eave, and the roof line closes it in above that.
    const last = b.line[b.line.length - 1];
    const H = (gable ? b.eaveIn : wall === 'front' ? b.line[0].h : last.h) / 12;
    const crest = b.line.map((p) => [flip ? W - p.y / 12 : p.y / 12, p.h / 12]).sort((p, q) => p[0] - q[0]);

    const ops = b.openings.filter((o) => o.wall === wall).map((o) => {
      const s = o.startIn / 12, e = o.endIn / 12;
      return { type: o.type, u0: flip ? Lw - e : s, u1: flip ? Lw - s : e, v0: o.sillIn / 12, v1: (o.sillIn + o.heightIn) / 12 };
    });
    const wainsFt = (b.options?.wainscotIn || WAINSCOT_FT * 12) / 12;
    const wains = hasWainscot && H > wainsFt + 1 ? wainsFt : 0;
    const sorted = (list, max) => [...new Set(list.filter((v) => v >= 0 && v <= max).map((v) => +v.toFixed(4)))].sort((a, c) => a - c);
    const us = sorted([0, Lw, ...ops.flatMap((o) => [o.u0, o.u1])], Lw);
    // Eave lights: clear panels across the top 3 ft of a closed side wall.
    const lightFt = !gable && [wall, 'both'].includes(b.options?.eaveLights) && H > wains + 4 ? 3 : 0;
    const vs = sorted([0, H, wains, H - lightFt, ...ops.flatMap((o) => [o.v0, o.v1])], H);
    const open = (u, v) => ops.some((o) => u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1);

    const upper = sheet(), lower = sheet(), clear = sheet();
    for (let i = 0; i < us.length - 1; i++) {
      const du = us[i + 1] - us[i], mid = (us[i] + us[i + 1]) / 2;
      for (let j = 0; j < vs.length - 1; j++) {
        if (open(mid, (vs[j] + vs[j + 1]) / 2)) continue;
        (lightFt && vs[j] >= H - lightFt - 1e-6 ? clear : vs[j + 1] <= wains + 1e-6 ? lower : upper).quad(us[i], vs[j], us[i + 1], vs[j + 1]);
      }
      if (lightFt && !open(mid, H - lightFt)) box(g, mats.trim, du, 0.16, 0.07, mid, H - lightFt, 0.035);
      if (wains && !open(mid, wains)) box(g, mats.trim, du, 0.16, 0.07, mid, wains, 0.035);
      if (!open(mid, 0.05)) box(g, mats.trim, du, 0.34, 0.1, mid, 0.17, 0.05);
    }
    if (gable) {
      for (let i = 0; i < crest.length - 1; i++) {
        const [u0, h0] = crest[i], [u1, h1] = crest[i + 1];
        if (h1 > H + 1e-6) upper.tri([u0, H], [u1, H], [u1, h1]);
        if (h0 > H + 1e-6) upper.tri([u0, H], [u1, h1], [u0, h0]);
      }
    }

    for (const [part, mat] of [[upper, mats.wall], [lower, mats.wainscot], [clear, mats.skylight]]) {
      if (part.empty) continue;
      const m = new THREE.Mesh(part.build(), mat);
      m.castShadow = m.receiveShadow = true;
      m.userData = { wall, flip, Lw };
      g.add(m);
      wallMeshes.push(m);
    }
    const cornerTop = gable ? [crest[0][1], crest[crest.length - 1][1]] : [H, H];
    [0.2, Lw - 0.2].forEach((u, i) => box(g, mats.trim, 0.42, cornerTop[i], 0.1, u, cornerTop[i] / 2, 0.05));

    // Soft dark bands where the wall meets the ground and tucks under the eave.
    const band = (mat, tall, v, upsideDown) => {
      const m = new THREE.Mesh(UPRIGHT, mat);
      m.scale.set(Lw, tall, 1);
      m.position.set(Lw / 2, v, 0.012);
      if (upsideDown) m.rotation.z = Math.PI;
      g.add(m);
    };
    band(shades.base, 1.6, 0.8, false);
    if (!gable) band(shades.eave, 1.8, H - 0.9, true);

    for (const o of ops) {
      const w = o.u1 - o.u0, h = o.v1 - o.v0, uc = (o.u0 + o.u1) / 2, vc = (o.v0 + o.v1) / 2;
      // Frames run from behind the wall face to in front of it, so the opening has depth.
      const frame = (wide = 0.3, deep = 0.24, z = 0.04) => {
        box(g, mats.trim, w + wide * 2, wide, deep, uc, o.v1 + wide / 2, z);
        box(g, mats.trim, wide, h, deep, o.u0 - wide / 2, vc, z);
        box(g, mats.trim, wide, h, deep, o.u1 + wide / 2, vc, z);
      };
      if (o.type === 'window') {
        frame();
        box(g, mats.trim, w + 0.76, 0.2, 0.34, uc, o.v0 - 0.1, 0.09);
        box(g, mats.glass, w, h, 0.04, uc, vc, -0.07);
        box(g, mats.door, 0.12, h, 0.07, uc, vc, -0.035);
        box(g, mats.door, w, 0.12, 0.07, uc, vc, -0.035);
      } else if (o.type === 'walk') {
        frame();
        box(g, mats.door, w, h, 0.1, uc, vc, -0.05);
        box(g, mats.trim, w * 0.5 + 0.2, h * 0.3 + 0.2, 0.03, uc, o.v0 + h * 0.72, 0.005);
        box(g, mats.glass, w * 0.5, h * 0.3, 0.04, uc, o.v0 + h * 0.72, 0.01);
        box(g, mats.dark, 0.14, 0.5, 0.05, o.u0 + w * 0.87, o.v0 + h * 0.47, 0.02);
        box(g, mats.dark, 0.42, 0.09, 0.12, o.u0 + w * 0.8, o.v0 + h * 0.47, 0.07);
        for (const k of [0.1, 0.5, 0.9]) box(g, mats.dark, 0.07, 0.3, 0.06, o.u0 + 0.03, o.v0 + h * k, 0.01);
        box(g, mats.dark, w, 0.07, 0.32, uc, o.v0 + 0.035, 0.05);
      } else if (o.type === 'overhead') {
        frame();
        const rows = Math.max(3, Math.round(h / 2)), cols = Math.max(2, Math.round(w / 3.2));
        const rowH = h / rows, colW = w / cols;
        for (let r = 0; r < rows; r++) {
          const y = o.v0 + (r + 0.5) * rowH;
          box(g, mats.door, w, rowH - 0.04, 0.12, uc, y, -0.1);
          for (let c = 0; c < cols; c++) {
            box(g, mats.door, colW - 0.5, rowH - 0.5, 0.03, o.u0 + (c + 0.5) * colW, y, -0.03);
          }
        }
        box(g, mats.dark, w, h, 0.04, uc, vc, -0.18);
        box(g, mats.dark, 0.6, 0.1, 0.12, uc, o.v0 + 0.5, 0.0);
      } else {
        // A sliding door hangs outside the wall on a track twice its width.
        const z = 0.2, edge = 0.3;
        const leaf = sheet();
        leaf.quad(o.u0 - 0.2, o.v0 + 0.15, o.u1 + 0.2, o.v1 + 0.1, z);
        const m = new THREE.Mesh(leaf.build(), mats.wall);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        box(g, mats.dark, w, h, 0.04, uc, vc, -0.05);
        box(g, mats.trim, w + 0.4 + edge, edge, 0.08, uc, o.v1 + 0.1, z + 0.02);
        box(g, mats.trim, w + 0.4 + edge, edge, 0.08, uc, o.v0 + 0.25, z + 0.02);
        for (const u of [o.u0 - 0.2, uc, o.u1 + 0.2]) box(g, mats.trim, edge, h, 0.08, u, vc + 0.1, z + 0.02);
        const track = Math.min(w * 2 + 1, Lw - 0.4);
        const start = Math.max(0.2, Math.min(o.u0 - 0.5, Lw - 0.2 - track));
        box(g, mats.trim, track, 0.42, 0.36, start + track / 2, o.v1 + 0.55, 0.18);
        for (const k of [0.12, 0.38, 0.62, 0.88]) {
          box(g, mats.dark, 0.14, 0.5, 0.05, o.u0 + w * k, o.v1 + 0.22, z + 0.07);
          box(g, mats.dark, 0.34, 0.3, 0.08, o.u0 + w * k, o.v1 + 0.38, z + 0.07);
        }
        for (const side of [-1, 1]) {
          box(g, mats.dark, 0.1, 1.3, 0.06, uc + side * 0.45, o.v0 + 3.6, z + 0.09);
          for (const dv of [-0.6, 0.6]) box(g, mats.dark, 0.1, 0.1, 0.14, uc + side * 0.45, o.v0 + 3.6 + dv, z + 0.06);
        }
        for (const u of [o.u0 - 0.2, o.u1 + 0.2]) box(g, mats.dark, 0.3, 0.34, 0.34, u, 0.17, z);
      }
      if (o.v0 === 0 && w >= 6) {
        const apron = pad(site, mats.gravel, w + 6, 16, 0.07);
        apron.position.copy(g.localToWorld(new THREE.Vector3(uc, 0.07, 8)));
        apron.rotation.y = g.rotation.y;
        bigDoors.push({ g, w, uc, Lw });
      }
    }
    return g;
  }

  // Each flat piece of roof, in feet: where its low and high edges sit across the
  // building (z) and how high, with the overhangs already added on.
  function planeShape(b, p) {
    const W = b.widthIn / 12, tan = p.pitch / 12, a = Math.atan(tan);
    const zOf = (yIn) => W / 2 - yIn / 12;
    const lowY = p.lowY - p.dir * p.lowOverIn, highY = p.highY + p.dir * p.highOverIn;
    const lowH = (p.lowIn - p.lowOverIn * tan) / 12, highH = (p.highIn + p.highOverIn * tan) / 12;
    return {
      a, tan, dir: p.dir, slope: p.slopeIn / 12, lowZ: zOf(lowY), highZ: zOf(highY), lowH, highH,
      midZ: zOf((lowY + highY) / 2), midH: (lowH + highH) / 2, ridgeZ: zOf(p.highY), ridgeH: p.highIn / 12,
    };
  }

  function buildRoof(b, gutters, cupolas) {
    const L = b.lengthIn / 12, W = b.widthIn / 12, oh = b.endOverhangIn / 12;
    const len = L + 2 * oh, t = 0.12;
    const shapes = b.planes.map((p) => ({ ...planeShape(b, p), p }));
    const longest = Math.max(...shapes.map((s) => s.slope));
    roofRibs.normal.repeat.set(len / PANEL_FT, longest / ROW_FT);
    roofRibs.shade.repeat.set(len / PANEL_FT / TINT_PANELS, longest / ROW_FT);
    const liftOf = (s) => t / 2 / Math.cos(s.a) + 0.02;

    // Skylight panels share out between the slopes that reach the top of the roof.
    const lit = shapes.filter((s) => s.p.highEdge !== 'break');
    const lights = b.options?.skylights ?? 0, slots = Math.floor(len / PANEL_FT);
    lit.forEach((s, n) => {
      const share = lit.length === 1 ? lights : n === 0 ? Math.ceil(lights / 2) : Math.floor(lights / 2);
      const count = Math.min(slots, share);
      for (let k = 0; k < count; k++) {
        const x = (Math.floor((k + 0.5) * slots / count) + 0.5) * PANEL_FT - len / 2;
        box(finished, mats.skylight, PANEL_FT - 0.1, t + 0.03, s.slope - 1.2, x, s.midH + liftOf(s), s.midZ, s.dir * s.a);
      }
    });

    for (const s of shapes) {
      const lift = liftOf(s), out = s.dir;
      box(finished, mats.roof, len, t, s.slope, 0, s.midH + lift, s.midZ, s.dir * s.a);
      for (const end of [1, -1]) {
        box(finished, mats.trim, 0.12, 0.6, s.slope, end * (len / 2 + 0.05), s.midH + lift - 0.22, s.midZ, s.dir * s.a);
      }
      if (s.p.highEdge === 'ridge') {
        const top = s.ridgeH + lift;
        if (s.dir === 1) {
          box(finished, mats.trim, len + 0.16, 0.16, 0.26, 0, top + 0.09, s.ridgeZ);
          // A vented ridge stands taller than a plain cap, with a dark slot down each side.
          if (b.options?.ridgeVent) {
            box(finished, mats.trim, len - 0.6, 0.22, 0.5, 0, top + 0.25, s.ridgeZ);
            box(finished, mats.dark, len - 0.8, 0.07, 0.56, 0, top + 0.17, s.ridgeZ);
          }
        }
        box(finished, mats.trim, len + 0.12, 0.08, 0.95, 0, top + 0.08 - 0.475 * Math.sin(s.a), s.ridgeZ + out * 0.46 * Math.cos(s.a), s.dir * s.a);
      }
      if (s.p.highEdge === 'high') {
        // The top edge of a single slope: a fascia under it and a cap folded over it.
        box(finished, mats.trim, len + 0.2, 0.7, 0.12, 0, s.highH + lift - 0.28, s.highZ - out * 0.04);
        box(finished, mats.trim, len + 0.2, 0.08, 0.6, 0, s.highH + lift + 0.06 - 0.3 * Math.sin(s.a), s.highZ + out * 0.3 * Math.cos(s.a), s.dir * s.a);
      }
      if (s.p.highEdge === 'break') {
        // Flashing where the steep lower roof meets the flatter upper one.
        box(finished, mats.trim, len + 0.12, 0.1, 0.7, 0, s.highH + lift + 0.03, s.highZ - out * 0.1, s.dir * 0.75);
      }
      if (s.p.lowEdge !== 'eave') continue;
      const eaveY = s.lowH + lift;
      box(finished, mats.trim, len + 0.2, 0.6, 0.12, 0, eaveY - 0.24, s.lowZ + out * 0.04);
      if (!gutters) continue;
      const gz = Math.abs(s.lowZ) + 0.1 + 0.21;
      box(finished, mats.trim, len + 0.1, 0.38, 0.42, 0, eaveY - 0.24, out * gz);
      box(finished, mats.dark, len, 0.02, 0.3, 0, eaveY - 0.045, out * gz);
      for (const end of [1, -1]) {
        const x = end * (L / 2 - 0.7), wallZ = W / 2 + 0.17, reach = gz - wallZ;
        const elbowed = reach > 0.35;
        const pipeTop = elbowed ? eaveY - 1.25 : eaveY - 0.4;
        box(finished, mats.trim, 0.3, pipeTop - 0.35, 0.24, x, (pipeTop + 0.35) / 2, out * wallZ);
        if (elbowed) {
          box(finished, mats.trim, 0.3, 0.24, Math.hypot(reach, 0.82) + 0.2, x, pipeTop + 0.41, out * (wallZ + reach / 2), -out * Math.atan2(0.82, reach));
        }
        box(finished, mats.trim, 0.3, 0.24, 0.7, x, 0.36, out * (wallZ + 0.3), out * 0.5);
      }
    }

    // Cupolas sit astride the ridge: a square louvered box under a small hip roof.
    const ridge = shapes.find((s) => s.p.highEdge === 'ridge');
    for (const c of ridge ? cupolas : []) {
      const size = c.sizeIn / 12, x = c.x / 12 - L / 2, peak = ridge.ridgeH;
      const foot = peak - (size / 2) * ridge.tan - 0.1, body = size * 0.85;
      const topY = peak + body;
      box(finished, mats.trim, size + 0.3, 0.3 + (peak - foot), size + 0.3, x, (foot + peak + 0.3) / 2, ridge.ridgeZ);
      box(finished, mats.wall, size, body, size, x, peak + body / 2, ridge.ridgeZ);
      const slats = Math.max(3, Math.round(body / 0.35));
      for (let k = 0; k < slats; k++) {
        const y = peak + 0.45 + (body - 0.7) * k / (slats - 1);
        box(finished, mats.dark, size * 0.74, 0.1, size + 0.04, x, y, ridge.ridgeZ);
        box(finished, mats.dark, size + 0.04, 0.1, size * 0.74, x, y, ridge.ridgeZ);
      }
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        box(finished, mats.trim, 0.22, body, 0.22, x + dx * (size / 2 - 0.08), peak + body / 2, ridge.ridgeZ + dz * (size / 2 - 0.08));
      }
      box(finished, mats.trim, size + 0.7, 0.16, size + 0.7, x, topY + 0.08, ridge.ridgeZ);
      const cap = new THREE.Mesh(CUPOLA_CAP, mats.cupolaRoof);
      cap.scale.set((size + 0.9) / Math.SQRT2, size * 0.55, (size + 0.9) / Math.SQRT2);
      cap.position.set(x, topY + 0.16 + size * 0.275, ridge.ridgeZ);
      cap.castShadow = true;
      finished.add(cap);
      box(finished, mats.trim, 0.12, size * 0.35, 0.12, x, topY + 0.16 + size * 0.55 + size * 0.15, ridge.ridgeZ);
    }
  }

  // The frame. It fills the framing view, and when a wall is open a second copy
  // stands inside the finished building, pulled in so nothing shares a face with the steel.
  function buildFraming(result, group = framing, inside = false) {
    const { building: b, posts, trusses, girtRows, planes } = result.geometry;
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12;
    const zOf = (yIn) => W / 2 - yIn / 12;
    const isOpen = (wall) => !!b.walls?.[wall]?.open;
    const set = inside ? 0.3 : 0.23, off = inside ? -0.07 : 0.06, drop = inside ? 0.3 : 0;
    for (const p of posts) {
      const inset = { front: [0, -set], back: [0, set], left: [set, 0], right: [-set, 0] }[p.wall];
      box(group, mats.treated, 0.46, p.topIn / 12, 0.46, p.x / 12 - L / 2 + inset[0], p.topIn / 24, W / 2 - p.y / 12 + inset[1]);
    }
    const along = (wall, len, y, tall, mat, centered = 0, thick = 0.125, at = off) => {
      if (wall === 'front' || wall === 'back') box(group, mat, len, tall, thick, centered, y, (wall === 'front' ? 1 : -1) * (W / 2 + at));
      else box(group, mat, thick, tall, len, (wall === 'right' ? 1 : -1) * (L / 2 + at), y, centered);
    };
    for (const wall of ['front', 'back', 'left', 'right']) {
      const side = wall === 'front' || wall === 'back';
      if (!isOpen(wall)) along(wall, (side ? L : W) - (inside ? 0.3 : 0), 0.3, 0.6, mats.treated);
      // The beam that ties the posts of an open side wall together.
      else if (side) along(wall, L, (wall === 'front' ? b.line[0].h : b.line[b.line.length - 1].h) / 12 - 0.47, 0.94, mats.wood, 0, 0.25, -set);
    }
    for (const row of girtRows) {
      const full = (row.wall === 'front' || row.wall === 'back' ? L : W) - (inside ? 0.3 : 0);
      // Rows above the eave on an end wall stop where they meet the roof.
      const centered = row.lengthIn ? zOf(row.startIn + row.lengthIn / 2) : 0;
      along(row.wall, row.lengthIn ? row.lengthIn / 12 - (inside ? 0.6 : 0) : full, row.heightIn / 12 - 0.23, 0.46, mats.wood, centered);
    }
    const shapes = planes.map((p) => ({ ...planeShape(b, p), p }));
    // Uprights inside the truss: one under each break or peak, and one between.
    const webs = [];
    for (let i = 0; i < b.line.length - 1; i++) {
      const p = b.line[i], q = b.line[i + 1];
      if (i > 0) webs.push([p.y, p.h]);
      webs.push([(p.y + q.y) / 2, (p.h + q.h) / 2]);
    }
    if (b.roof === 'mono') webs.push([b.widthIn - 3, b.line[1].h]);
    for (const tr of trusses) {
      const x = inside ? Math.min(Math.max(tr.x / 12 - L / 2, -L / 2 + 0.3), L / 2 - 0.3) : tr.x / 12 - L / 2;
      box(group, mats.wood, 0.125, 0.46, W - (inside ? 0.4 : 0), x, H + 0.23, 0);
      for (const s of shapes) box(group, mats.wood, 0.125, 0.46, s.slope, x, s.midH - 0.1 - drop, s.midZ, s.dir * s.a);
      for (const [y, h] of webs) {
        const tall = h / 12 - H - drop;
        if (tall > 0.5) box(group, mats.wood, 0.125, tall, 0.3, x, H + tall / 2, zOf(y));
      }
    }
    const rowLen = inside ? L - 0.3 : result.geometry.purlinRowLengthIn / 12;
    for (const s of shapes) {
      const rows = s.p.purlinRows;
      for (let i = 0; i < rows; i++) {
        const k = rows > 1 ? i / (rows - 1) : 0.5;
        box(group, mats.wood, rowLen, 0.125, 0.29, 0, s.highH + (s.lowH - s.highH) * k + 0.2 - drop, s.highZ + (s.lowZ - s.highZ) * k, s.dir * s.a);
      }
    }
  }

  // Interior walls and the loft. They show in the framing view only, since the
  // finished view is closed in.
  function buildInterior(result, fits = []) {
    const { building: b, partitions = [], loft } = result.geometry;
    const L = b.lengthIn / 12, W = b.widthIn / 12;
    const X = (xIn) => xIn / 12 - L / 2, Z = (yIn) => W / 2 - yIn / 12;
    for (const t of fits) {
      const tall = Math.max(t.heightIn / 12, 0.1);
      box(framing, t.ok ? mats.fits : mats.misfit, (t.x1 - t.x0) / 12, tall, (t.y1 - t.y0) / 12, X((t.x0 + t.x1) / 2), tall / 2 + 0.02, Z((t.y0 + t.y1) / 2));
    }
    for (const p of partitions) {
      const across = p.axis === 'across', H = p.heightIn / 12, len = p.lengthIn / 12, mid = (p.startIn + p.endIn) / 2;
      const deep = p.studSize === '2x6' ? 0.46 : 0.29;
      const lay = (mat, alongFt, tall, atIn, y) => (across
        ? box(framing, mat, deep, tall, alongFt, X(p.atIn), y, Z(atIn))
        : box(framing, mat, alongFt, tall, deep, X(atIn), y, Z(p.atIn)));
      lay(mats.wood, len, 0.125, mid, H - 0.06);
      // The bottom plate is cut out of each doorway.
      let from = p.startIn;
      for (const d of [...p.doors, { startIn: p.endIn, endIn: p.endIn }]) {
        if (d.startIn > from) lay(mats.treated, (d.startIn - from) / 12, 0.125, (from + d.startIn) / 2, 0.06);
        from = d.endIn;
      }
      const inDoor = (at) => p.doors.some((d) => at > d.startIn + 0.5 && at < d.endIn - 0.5);
      const studAt = [...p.studs.filter((at) => !inDoor(at)), ...p.doors.flatMap((d) => [d.startIn - 0.75, d.endIn + 0.75])];
      for (const at of studAt) lay(mats.wood, 0.125, H - 0.25, at, H / 2);
      for (const d of p.doors) lay(mats.wood, (d.endIn - d.startIn + 3) / 12, 0.125, (d.startIn + d.endIn) / 2, 6.9);
    }
    if (!loft) return;
    const F = loft.heightIn / 12, jd = loft.joistIn / 12, dir = loft.end === 'left' ? 1 : -1;
    const xMid = X((loft.wallX + loft.edgeX) / 2), D = loft.depthIn / 12;
    for (const p of loft.posts) box(framing, mats.treated, 0.46, F - jd, 0.46, X(p.x), (F - jd) / 2, Z(Math.min(Math.max(p.y, 2.75), b.widthIn - 2.75)));
    // Ledger on the end wall posts, beam on the loft posts, joists between.
    box(framing, mats.wood, 0.125, jd, W - 0.3, X(loft.wallX) + dir * 0.55, F - jd / 2 - 0.06, 0);
    for (const side of [-1, 1]) box(framing, mats.wood, 0.125, 0.94, W - 0.1, X(loft.edgeX) + side * 0.29, F - 0.53, 0);
    for (const y of loft.joists) box(framing, mats.wood, D - 0.9, jd, 0.125, xMid, F - jd / 2 - 0.06, Z(Math.min(Math.max(y, 0.75), b.widthIn - 0.75)));
    const deck = box(framing, mats.wood, D, 0.06, W - 0.1, xMid, F - 0.03, 0);
    deck.material = mats.deck;
    // The stair runs down from the open edge along the front wall.
    const st = loft.stair, run = st.runIn / 12, rise = st.riseIn / 12, wide = st.widthIn / 12;
    const zs = [0.2, wide / 2, wide - 0.2].map((v) => Z(v * 12 + 1));
    const angle = Math.atan2(rise, run);
    for (const z of zs) {
      const m = box(framing, mats.wood, st.stringerIn / 12, 0.6, 0.125, X(st.x0) + dir * run / 2, rise / 2 - 0.35, z);
      m.rotation.z = -dir * angle;
    }
    for (let i = 1; i <= st.treads; i++) {
      box(framing, mats.wood, 0.9, 0.125, wide, X(st.x0) + dir * (i - 0.5) * (run / st.treads), rise - i * (rise / st.risers), Z(st.widthIn / 2 + 1));
    }
    // Guard along the open edge, past the head of the stair.
    const g0 = st.widthIn + 2, gl = (b.widthIn - g0) / 12, gz = Z((g0 + b.widthIn) / 2);
    box(framing, mats.wood, 0.125, 0.29, gl, X(loft.edgeX), F + 3, gz);
    box(framing, mats.wood, 0.125, 0.29, gl, X(loft.edgeX), F + 1.5, gz);
    for (const p of loft.posts) if (p.y > g0) box(framing, mats.wood, 0.29, 3, 0.29, X(loft.edgeX), F + 1.5, Z(Math.min(p.y, b.widthIn - 2)));
  }

  // The dark halo on the ground around the foot of the building.
  function buildContact(L, W) {
    const reach = 4.5, w = L + reach * 2, d = W + reach * 2;
    contact.material.map?.dispose();
    contact.material.map = shadeTexture(256, 256, (x, y) => {
      const dx = Math.max(Math.abs(x - 0.5) * w - L / 2, 0), dz = Math.max(Math.abs(y - 0.5) * d - W / 2, 0);
      return Math.max(0, 1 - Math.hypot(dx, dz) / reach) ** 2.2;
    });
    contact.material.needsUpdate = true;
    contact.scale.set(w, 1, d);
  }

  // Trees and a board fence well back from the building, to give it scale.
  function buildSetting(L, W) {
    clear(setting);
    const rand = seeded(41);
    const tree = (x, z) => {
      const r = 9 + rand() * 6, trunk = 9 + rand() * 5, leaf = mats.leaves[Math.floor(rand() * 3)];
      const t = new THREE.Group();
      t.position.set(x, 0, z);
      const stem = new THREE.Mesh(TRUNK, mats.bark);
      stem.scale.set(1.5, trunk + r * 0.5, 1.5);
      stem.position.y = (trunk + r * 0.5) / 2;
      t.add(stem);
      for (const [k, dx, dy, dz] of [[1, 0, 0.75, 0], [0.72, 0.6, 0.35, 0.3], [0.66, -0.55, 0.45, -0.35], [0.6, 0.1, 1.45, -0.1]]) {
        const c = new THREE.Mesh(crown, leaf);
        c.scale.set(r * k, r * k * 1.1, r * k);
        c.position.set(dx * r, trunk + dy * r, dz * r);
        c.rotation.y = rand() * 6;
        t.add(c);
      }
      const tall = trunk + r * 2, long = tall * 1.7;
      const shadow = new THREE.Mesh(FLAT, shades.tree);
      shadow.scale.set(long + r, 1, r * 2.6);
      shadow.rotation.y = Math.atan2(-shadowDir.z, shadowDir.x);
      shadow.position.set(x + shadowDir.x * long * 0.45, 0.05, z + shadowDir.z * long * 0.45);
      setting.add(t, shadow);
    };
    for (let i = 0; i < 12; i++) tree(-300 + i * 50 + rand() * 24, -(W / 2 + 190 + rand() * 70));
    for (let i = 0; i < 4; i++) tree(-(L / 2 + 190 + rand() * 60), -60 + i * 52 + rand() * 20);

    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const run = new THREE.Group();
      run.position.set(x0, 0, z0);
      run.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      for (let s = 0; s <= len + 0.1; s += 8) box(run, mats.fence, 0.4, 4.6, 0.4, s, 2.3, 0);
      for (const y of [1.3, 2.6, 3.9]) box(run, mats.fence, len, 0.46, 0.1, len / 2, y, 0.22);
      run.traverse((o) => { o.castShadow = false; });
      setting.add(run);
    };
    const back = -(W / 2 + 72), left = -(L / 2 + 104);
    fence(left, back, L / 2 + 184, back);
    fence(left, back, left, W / 2 + 144);
  }

  function frameCamera(b) {
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12;
    controls.target.set(0, H * 0.5, 0);
    if (!fitted) {
      // Start low and close, about eye height from the driveway corner.
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const tightest = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
      const reach = (Math.hypot(L, W) / 2 + H * 0.6) / Math.sin(tightest) * 0.9;
      camera.position.copy(new THREE.Vector3(0.7, 0.045, 1).normalize().multiplyScalar(reach)).add(controls.target);
      fitted = true;
    }
    const span = Math.max(L, W) * 0.8 + H * 2 + 34 + Math.max(0, ...b.sheds.map((s) => s.depthIn / 12));
    sun.position.copy(sunDir).multiplyScalar(260);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 20, far: 600 });
    sun.shadow.camera.updateProjectionMatrix();
    controls.update();
  }

  function update(result, colors, fits = []) {
    const b = result.geometry.building;
    for (const g of [finished, framing, site]) clear(g);
    wallMeshes = [];
    bigDoors = [];
    mats.wall.color.set(colors.walls);
    mats.roof.color.set(colors.roof);
    mats.cupolaRoof.color.set(colors.roof);
    mats.shedRoof.color.set(colors.roof);
    mats.shedRoof.side = THREE.DoubleSide;
    mats.trim.color.set(colors.trim);
    mats.wainscot.color.set(colors.wainscot);

    const L = b.lengthIn / 12, W = b.widthIn / 12;
    pad(site, mats.gravel, L + 4, W + 4, 0.05);
    if (b.options?.slab) box(site, mats.slab, L - 0.1, 0.3, W - 0.1, 0, 0.15, 0);
    // With a wall open the inside shows, so the steel is seen from both faces and the frame stands inside it.
    const anyOpen = ['front', 'back', 'left', 'right'].some((wall) => b.walls?.[wall]?.open);
    for (const m of [mats.wall, mats.wainscot]) {
      const side = anyOpen ? THREE.DoubleSide : THREE.FrontSide;
      if (m.side !== side) { m.side = side; m.needsUpdate = true; }
    }
    const frontRef = wallGroup(b, 'front');
    frontRef.updateMatrixWorld(true);
    for (const wall of ['front', 'back', 'left', 'right']) {
      if (b.walls?.[wall]?.open) continue;
      const g = buildWall(b, wall, colors.wainscotOn);
      g.updateMatrixWorld(true);
      finished.add(g);
    }
    buildRoof(b, colors.gutters, result.geometry.cupolas ?? []);
    buildFraming(result);
    if (anyOpen) buildFraming(result, finished, true);
    buildInterior(result, fits);
    for (const s of result.geometry.sheds) buildShed(b, s);
    if (settingKey !== `${L}x${W}`) {
      settingKey = `${L}x${W}`;
      buildContact(L, W);
      buildSetting(L, W);
    }

    // A gravel drive runs out from the widest big door, and the pickup parks beside it.
    const main = bigDoors.sort((a, c) => c.w - a.w)[0];
    if (main && main.w >= 8) {
      const drive = pad(site, mats.gravel, main.w + 3, 90, 0.06);
      drive.position.copy(main.g.localToWorld(new THREE.Vector3(main.uc, 0.06, 16 + 44)));
      drive.rotation.y = main.g.rotation.y;
    }
    truck.visible = !!colors.truck;
    if (truck.visible) {
      const g = main ? main.g : frontRef;
      const beside = main ? (main.uc - main.w / 2 - 8 > 2 ? main.uc - main.w / 2 - 8 : main.uc + main.w / 2 + 8) : L * 0.25;
      truck.position.copy(g.localToWorld(new THREE.Vector3(beside, 0.07, 15)));
      truck.rotation.y = g.rotation.y + Math.PI / 2 - 0.3;
    }
    frameCamera(b);
    setMode(mode);
  }

  function setMode(next) {
    mode = next;
    finished.visible = mode === 'finished';
    framing.visible = mode === 'framing';
    draw();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  }
  new ResizeObserver(resize).observe(stage);

  // Where on which wall a screen point lands, in feet along that wall.
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(wallMeshes, false)[0];
    if (!hit) return null;
    const { wall, flip, Lw } = hit.object.userData;
    const u = hit.object.parent.worldToLocal(hit.point.clone()).x;
    return { wall, at: flip ? Lw - u : u };
  }

  // A still picture of the current view, for the proposal.
  function snapshot() {
    renderer.render(scene, camera);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // One slow turn that settles on the corner view. It stops the moment the
  // viewer touches the picture, and does not run for people who ask for less motion.
  function spin() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const offset = camera.position.clone().sub(controls.target), began = performance.now(), run = ++spinning;
    const step = (now) => {
      if (run !== spinning) return;
      const t = Math.min(1, (now - began) / 9000);
      camera.position.copy(offset).applyAxisAngle(UP, -0.75 * (1 - t) ** 3).add(controls.target);
      camera.lookAt(controls.target);
      renderer.render(scene, camera);
      if (t < 1) requestAnimationFrame(step); else controls.update();
    };
    requestAnimationFrame(step);
  }

  return { update, setMode, pick, resize, snapshot, spin };
}
