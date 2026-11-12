// The 3D picture of the building. Everything here is in feet, Y up, with the
// front wall facing +Z and the building centered on the origin.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';

const RIB_FT = 0.75;
const WAINSCOT_FT = 3;
const UNIT = new THREE.BoxGeometry(1, 1, 1);

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

// One 9 inch slice of a ribbed panel: a tall rib in the middle, two low ones.
function ribTextures() {
  const w = 128;
  const rib = (u, at, half, top, tall) => {
    const d = Math.abs(u - at);
    return d < top ? tall : d < half ? tall * (half - d) / (half - top) : 0;
  };
  const height = Array.from({ length: w }, (_, i) => {
    const u = i / w;
    return Math.max(rib(u, 0.5, 0.13, 0.05, 1), rib(u, 0.17, 0.05, 0.02, 0.28), rib(u, 0.83, 0.05, 0.02, 0.28));
  });
  const slope = height.map((_, i) => (height[(i + 1) % w] - height[(i + w - 1) % w]) * 5);
  const normal = canvasTexture(w, 4, (d) => {
    for (let p = 0; p < w * 4; p++) {
      const s = slope[p % w];
      const len = Math.hypot(s, 1);
      d.set([127.5 - 127.5 * s / len, 127.5, 127.5 + 127.5 / len, 255], p * 4);
    }
  }, false);
  const shade = canvasTexture(w, 4, (d) => {
    for (let p = 0; p < w * 4; p++) {
      const v = 255 - Math.min(70, Math.abs(slope[p % w]) * 55) + height[p % w] * 0;
      d.set([v, v, v, 255], p * 4);
    }
  });
  for (const t of [normal, shade]) t.repeat.set(1 / RIB_FT, 1);
  return { normal, shade };
}

function speckle(base, spread, blotches = 0, size = 256) {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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

export function createView(canvas, stage) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.42;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4d2dc, 350, 1500);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 18;
  controls.maxDistance = 420;
  controls.zoomSpeed = 0.7;

  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 40), THREE.MathUtils.degToRad(38));
  const sky = new Sky();
  sky.scale.setScalar(4000);
  Object.assign(sky.material.uniforms.turbidity, { value: 2.2 });
  Object.assign(sky.material.uniforms.rayleigh, { value: 1.9 });
  Object.assign(sky.material.uniforms.cloudCoverage, { value: 0.32 });
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  sky.material.fog = false;

  const envScene = new THREE.Scene();
  envScene.add(sky);
  sky.material.uniforms.showSunDisc.value = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 10000).texture;
  scene.environmentIntensity = 0.55;
  sky.material.uniforms.showSunDisc.value = 1;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff1dd, 5.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x6b7350, 0.9));

  const grassMap = speckle([88, 118, 56], 0.55);
  grassMap.repeat.set(260, 260);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1600, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const ribs = ribTextures();
  const roofRibs = { normal: ribs.normal.clone(), shade: ribs.shade.clone() };
  const metal = (maps) => new THREE.MeshStandardMaterial({
    map: maps?.shade, normalMap: maps?.normal, normalScale: new THREE.Vector2(1.4, 1.4), metalness: 0.25, roughness: 0.48,
  });
  const gravelMap = speckle([150, 146, 138], 0.4, 40);
  gravelMap.repeat.set(0.12, 0.12);
  const mats = {
    wall: metal(ribs), wainscot: metal(ribs), roof: metal(roofRibs), trim: metal(),
    door: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.55, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.06, metalness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.5, metalness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xcaa46c, roughness: 0.85 }),
    treated: new THREE.MeshStandardMaterial({ color: 0x8c8656, roughness: 0.9 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelMap, roughness: 1 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xb9b8b2, roughness: 0.9 }),
  };
  for (const t of [ribs.normal, ribs.shade, roofRibs.normal, roofRibs.shade, grassMap, gravelMap]) {
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  const finished = new THREE.Group();
  const framing = new THREE.Group();
  const site = new THREE.Group();
  scene.add(finished, framing, site);
  let wallMeshes = [];
  let mode = 'finished';
  let fitted = false;
  let queued = false;

  const draw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
  };
  controls.addEventListener('change', draw);

  function clear(group) {
    group.traverse((o) => { if (o.geometry && o.geometry !== UNIT) o.geometry.dispose(); });
    group.clear();
  }

  function buildWall(b, wall, hasWainscot) {
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12, rise = b.riseIn / 12;
    const gable = wall === 'left' || wall === 'right';
    const Lw = gable ? W : L;
    const flip = wall === 'back' || wall === 'left';
    const g = new THREE.Group();
    if (wall === 'front') g.position.set(-L / 2, 0, W / 2);
    if (wall === 'back') { g.position.set(L / 2, 0, -W / 2); g.rotation.y = Math.PI; }
    if (wall === 'left') { g.position.set(-L / 2, 0, -W / 2); g.rotation.y = -Math.PI / 2; }
    if (wall === 'right') { g.position.set(L / 2, 0, W / 2); g.rotation.y = Math.PI / 2; }

    const ops = b.openings.filter((o) => o.wall === wall).map((o) => {
      const s = o.startIn / 12, e = o.endIn / 12;
      return { type: o.type, u0: flip ? Lw - e : s, u1: flip ? Lw - s : e, v0: o.sillIn / 12, v1: (o.sillIn + o.heightIn) / 12 };
    });
    const wains = hasWainscot && H > WAINSCOT_FT + 1 ? WAINSCOT_FT : 0;
    const sorted = (list, max) => [...new Set(list.filter((v) => v >= 0 && v <= max).map((v) => +v.toFixed(4)))].sort((a, c) => a - c);
    const us = sorted([0, Lw, ...ops.flatMap((o) => [o.u0, o.u1])], Lw);
    const vs = sorted([0, H, wains, ...ops.flatMap((o) => [o.v0, o.v1])], H);
    const open = (u, v) => ops.some((o) => u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1);

    const upper = sheet(), lower = sheet();
    for (let i = 0; i < us.length - 1; i++) {
      for (let j = 0; j < vs.length - 1; j++) {
        if (open((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue;
        (vs[j + 1] <= wains + 1e-6 ? lower : upper).quad(us[i], vs[j], us[i + 1], vs[j + 1]);
      }
      if (wains && !open((us[i] + us[i + 1]) / 2, wains)) {
        box(g, mats.trim, us[i + 1] - us[i], 0.14, 0.05, (us[i] + us[i + 1]) / 2, wains, 0.025);
      }
    }
    if (gable) upper.tri([0, H], [Lw, H], [Lw / 2, H + rise]);

    for (const [part, mat] of [[upper, mats.wall], [lower, mats.wainscot]]) {
      if (part.empty) continue;
      const m = new THREE.Mesh(part.build(), mat);
      m.castShadow = m.receiveShadow = true;
      m.userData = { wall, flip, Lw };
      g.add(m);
      wallMeshes.push(m);
    }
    for (const u of [0.17, Lw - 0.17]) box(g, mats.trim, 0.36, H, 0.06, u, H / 2, 0.03);

    for (const o of ops) {
      const w = o.u1 - o.u0, h = o.v1 - o.v0, uc = (o.u0 + o.u1) / 2, vc = (o.v0 + o.v1) / 2;
      const frame = (z = 0.05, wide = 0.28) => {
        box(g, mats.trim, w + wide * 2, wide, 0.1, uc, o.v1 + wide / 2, z);
        box(g, mats.trim, wide, h, 0.1, o.u0 - wide / 2, vc, z);
        box(g, mats.trim, wide, h, 0.1, o.u1 + wide / 2, vc, z);
      };
      if (o.type === 'window') {
        frame();
        box(g, mats.trim, w + 0.56, 0.28, 0.14, uc, o.v0 - 0.14, 0.07);
        box(g, mats.glass, w, h, 0.04, uc, vc, -0.03);
        box(g, mats.door, 0.12, h, 0.07, uc, vc, 0);
        box(g, mats.door, w, 0.12, 0.07, uc, vc, 0);
      } else if (o.type === 'walk') {
        frame();
        box(g, mats.door, w, h, 0.12, uc, vc, -0.02);
        box(g, mats.glass, w * 0.5, h * 0.3, 0.14, uc, o.v0 + h * 0.72, -0.02);
        box(g, mats.dark, 0.14, 0.14, 0.2, o.u0 + w * 0.86, o.v0 + h * 0.47, 0.02);
      } else if (o.type === 'overhead') {
        frame();
        const rows = Math.max(3, Math.round(h / 2));
        for (let r = 0; r < rows; r++) {
          box(g, mats.door, w, h / rows - 0.04, 0.12, uc, o.v0 + (r + 0.5) * h / rows, -0.04);
        }
        box(g, mats.dark, w, h, 0.04, uc, vc, -0.1);
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
        box(g, mats.trim, track, 0.42, 0.34, start + track / 2, o.v1 + 0.5, 0.17);
      }
      if (o.v0 === 0 && w >= 6) {
        const apron = box(site, mats.gravel, w + 6, 0.08, 16, 0, 0.05, 0);
        apron.castShadow = false;
        apron.position.copy(g.localToWorld(new THREE.Vector3(uc, 0.05, 8)));
        apron.rotation.y = g.rotation.y;
      }
    }
    return g;
  }

  function buildRoof(b) {
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12, rise = b.riseIn / 12, oh = b.overhangIn / 12;
    const a = Math.atan(b.pitch / 12), run = W / 2 + oh, slope = run / Math.cos(a), len = L + 2 * oh, t = 0.12;
    for (const tex of [roofRibs.normal, roofRibs.shade]) tex.repeat.set(len / RIB_FT, 1);
    const lift = t / 2 / Math.cos(a) + 0.02;
    for (const side of [1, -1]) {
      const midY = H + rise - (run / 2) * Math.tan(a) + lift;
      box(finished, mats.roof, len, t, slope, 0, midY, side * run / 2, side * a);
      box(finished, mats.trim, len + 0.1, 0.05, 0.75, 0, H + rise + lift + 0.06 - 0.375 * Math.sin(a), side * 0.36 * Math.cos(a), side * a);
      const eaveY = H - oh * Math.tan(a) + lift;
      box(finished, mats.trim, len + 0.16, 0.5, 0.08, 0, eaveY - 0.2, side * (run + 0.02));
      for (const end of [1, -1]) {
        box(finished, mats.trim, 0.08, 0.5, slope, end * (len / 2 + 0.03), midY - 0.2, side * run / 2, side * a);
      }
    }
  }

  function buildFraming(result) {
    const { building: b, posts, trusses, girtRows } = result.geometry;
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12, rise = b.riseIn / 12, oh = b.overhangIn / 12;
    const a = Math.atan(b.pitch / 12), slope = (W / 2 + oh) / Math.cos(a);
    for (const p of posts) {
      const inset = { front: [0, -0.23], back: [0, 0.23], left: [0.23, 0], right: [-0.23, 0] }[p.wall];
      box(framing, mats.treated, 0.46, p.topIn / 12, 0.46, p.x / 12 - L / 2 + inset[0], p.topIn / 24, W / 2 - p.y / 12 + inset[1]);
    }
    const along = (wall, len, y, tall, mat, centered = 0) => {
      if (wall === 'front' || wall === 'back') box(framing, mat, len, tall, 0.125, centered, y, (wall === 'front' ? 1 : -1) * (W / 2 + 0.06));
      else box(framing, mat, 0.125, tall, len, (wall === 'right' ? 1 : -1) * (L / 2 + 0.06), y, centered);
    };
    for (const wall of ['front', 'back', 'left', 'right']) {
      along(wall, wall === 'front' || wall === 'back' ? L : W, 0.3, 0.6, mats.treated);
    }
    for (const row of girtRows) {
      const full = row.wall === 'front' || row.wall === 'back' ? L : W;
      along(row.wall, row.lengthIn ? row.lengthIn / 12 : full, row.heightIn / 12 - 0.23, 0.46, mats.wood);
    }
    for (const tr of trusses) {
      const x = tr.x / 12 - L / 2;
      box(framing, mats.wood, 0.125, 0.46, W, x, H + 0.23, 0);
      box(framing, mats.wood, 0.125, rise, 0.3, x, H + rise / 2, 0);
      for (const side of [1, -1]) {
        box(framing, mats.wood, 0.125, 0.46, slope, x, H + rise - (W / 2 + oh) / 2 * Math.tan(a) - 0.1, side * (W / 2 + oh) / 2, side * a);
        box(framing, mats.wood, 0.125, rise / 2, 0.3, x, H + rise / 4, side * W / 4);
      }
    }
    const rows = result.summary.purlinRowsPerSide, rowLen = result.geometry.purlinRowLengthIn / 12;
    for (const side of [1, -1]) {
      for (let i = 0; i < rows; i++) {
        const s = slope * i / (rows - 1);
        box(framing, mats.wood, rowLen, 0.125, 0.29, 0, H + rise - s * Math.sin(a) + 0.2, side * s * Math.cos(a), side * a);
      }
    }
  }

  function frameCamera(b) {
    const L = b.lengthIn / 12, W = b.widthIn / 12, H = b.eaveIn / 12;
    controls.target.set(0, H * 0.45, 0);
    if (!fitted) {
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const tightest = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
      const reach = (Math.hypot(L, W) / 2 + H * 0.6) / Math.sin(tightest) * 0.9;
      camera.position.copy(new THREE.Vector3(0.62, 0.15, 1).normalize().multiplyScalar(reach)).add(controls.target);
      fitted = true;
    }
    const span = Math.max(L, W) * 0.8 + H * 2 + 24;
    sun.position.copy(sunDir).multiplyScalar(260);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 20, far: 600 });
    sun.shadow.camera.updateProjectionMatrix();
    controls.update();
  }

  function update(result, colors) {
    const b = result.geometry.building;
    for (const g of [finished, framing, site]) clear(g);
    wallMeshes = [];
    mats.wall.color.set(colors.walls);
    mats.roof.color.set(colors.roof);
    mats.trim.color.set(colors.trim);
    mats.wainscot.color.set(colors.wainscot);

    const L = b.lengthIn / 12, W = b.widthIn / 12;
    box(site, mats.gravel, L + 4, 0.06, W + 4, 0, 0.03, 0).castShadow = false;
    box(site, mats.slab, L - 0.1, 0.3, W - 0.1, 0, 0.15, 0);
    for (const wall of ['front', 'back', 'left', 'right']) {
      const g = buildWall(b, wall, colors.wainscotOn);
      g.updateMatrixWorld(true);
      finished.add(g);
    }
    // Aprons are placed from wall coordinates, so walls must be in the scene first.
    buildRoof(b);
    buildFraming(result);
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

  return { update, setMode, pick, resize, snapshot };
}
