import * as THREE from "../node_modules/three/build/three.module.min.js";

const PALETTES = {
  maomao: {
    hair: "#1f4a45", hairShine: "#3c7f74", eyes: "#5b5fcf", eyesLight: "#a9b0f5", skin: "#f3d9c8", outfit: "#6fae6c", outfitDark: "#4d8a52",
    collar: "#a6dbb1", cuff: "#cfe07c", skirt: "#7a2f4a", ribbon: "#7f98e0", ink: "#232a2a", shoe: "#3b2b2b", blush: "#ff8fab",
  },
  catgirl: {
    hair: "#4a3355", hairShine: "#7a5a8c", eyes: "#8a5cf0", eyesLight: "#c7b2fa", skin: "#ffe6d8", outfit: "#ffb8cf", outfitDark: "#f08fb0",
    collar: "#ffd6e3", cuff: "#ffe08f", skirt: "#5a3d6b", ribbon: "#f08fb0", ink: "#3a2a3f", shoe: "#3b2b3f", blush: "#ff7fa0",
  },
};

const OUTFITS = {
  servant: {},
  jade: { outfit: "#eaa9ae", outfitDark: "#c86f7c", collar: "#fbe6da", cuff: "#e2b552", skirt: "#9b2335", ribbon: "#c8303a" },
  garden: { outfit: "#b6c4ec", outfitDark: "#8798d0", collar: "#f5f3fb", cuff: "#e4e7f0", skirt: "#46578f", ribbon: "#e4e7f0", lips: "#c8303a" },
  verdigris: { outfit: "#bd3442", outfitDark: "#8c1f2d", collar: "#f0c75e", cuff: "#f0c75e", skirt: "#2e2038", ribbon: "#f0c75e", shoe: "#2a1a22", lips: "#b81d35" },
  shop: { outfit: "#6f8193", outfitDark: "#55677a", collar: "#e6dcc8", cuff: "#a88a5c", skirt: "#5a4636", ribbon: "#a88a5c" },
};

const FACE_W = 608;
const FACE_H = 422;
const FACE_PHI = 1.9;
const FACE_THETA0 = 1.13;
const FACE_THETA = 1.32;
const HEAD_R = 0.6;
const HEAD_C = new THREE.Vector3(0, 0.46, 0);
const HEAD_SCALE = [0.9, 1.02, 0.93];

function chin(geometry, radius) {
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).divideScalar(radius);
    const low = Math.max(0, -v.y - 0.05) / 0.95;
    const front = Math.max(0, v.z);
    v.x *= 1 - 0.3 * Math.pow(low, 1.4) - 0.05 * low * front;
    v.z *= 1 - 0.14 * Math.pow(low, 1.6) * (1 - front * 0.6);
    v.y -= 0.05 * Math.pow(low, 1.4) * (0.4 + front * 0.6);
    position.setXYZ(i, v.x * radius, v.y * radius, v.z * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function outlineMaterial(color, width) {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = position + normal * ${width.toFixed(4)};`);
  };
  return material;
}

function heartTexture(color) {
  const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(4, 34, 8, 8, 32, 20);
  ctx.bezierCurveTo(56, 8, 60, 34, 32, 54);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}

function textTexture(text, color) {
  const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
  const ctx = canvas.getContext("2d");
  ctx.font = "900 46px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, 32, 34);
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 34);
  return new THREE.CanvasTexture(canvas);
}

function angerTexture() {
  const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  for (const [width, color] of [[11, "#ffffff"], [6, "#e2364f"]]) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(6, -20);
      ctx.quadraticCurveTo(6, -6, 20, -6);
      ctx.stroke();
      ctx.restore();
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function shadowTexture() {
  const canvas = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,0.45)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const spring = (value, target, velocity, k, damping, dt) => {
  const accel = (target - value) * k - velocity * damping;
  velocity += accel * dt;
  return [value + velocity * dt, velocity];
};

export function createPet(canvas, { onPetted } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 1.45, 6.9);
  camera.lookAt(0, 1.15, 0);

  scene.add(new THREE.HemisphereLight(0xfff6ee, 0xc8bcd4, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1e4, 2.3);
  sun.position.set(-2.5, 4, 5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff4ec, 0.6);
  fill.position.set(0.5, 0.2, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(1.5, 3, -4);
  scene.add(rim);

  const ROUGH = { hair: 0.6, skin: 0.62, shoe: 0.5, ribbon: 0.55 };
  const shade = (color, key, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: ROUGH[key] ?? 0.82, metalness: 0, ...extra });
  const palette = { ...PALETTES.maomao };
  const mats = {};
  for (const key of ["hair", "skin", "outfit", "outfitDark", "collar", "cuff", "skirt", "ribbon", "shoe"]) {
    mats[key] = shade(palette[key], key, key === "skin" ? { emissive: palette.skin, emissiveIntensity: 0.22 } : {});
  }
  mats.hairBack = shade(palette.hair, "hair", { side: THREE.DoubleSide });
  mats.sleeve = shade(palette.outfit, "outfit", { side: THREE.DoubleSide });
  mats.sleeveDark = shade(palette.outfitDark, "outfit", { side: THREE.DoubleSide });
  mats.hairShine = new THREE.MeshBasicMaterial({ color: palette.hairShine });
  mats.beadRed = shade("#b9364b", "hair");
  mats.beadTeal = shade("#3aa29d", "hair");
  mats.leaf = shade("#6aa56a");
  mats.earInner = shade(palette.outfitDark);
  const outline = outlineMaterial(palette.ink, 0.018);
  const thinOutline = outlineMaterial(palette.ink, 0.012);

  const root = new THREE.Group();
  const holder = new THREE.Group();
  const rig = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  holder.position.y = 2.3;
  rig.position.y = -2.3;
  head.position.y = 1.63;
  head.scale.setScalar(0.58);
  scene.add(root);
  root.add(holder);
  holder.add(rig);
  rig.add(body, head);
  body.userData.part = "body";
  head.userData.part = "head";

  const parts = { maomao: [], catgirl: [] };
  const dress = { jade: [], garden: [], verdigris: [], shop: [] };

  function add(parent, geometry, material, { pos, rot, scale, line = outline, only, outfit } = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    if (line) mesh.add(new THREE.Mesh(geometry, line));
    if (only) parts[only].push(mesh);
    if (outfit) dress[outfit].push(mesh);
    parent.add(mesh);
    return mesh;
  }

  function between(parent, geometry, material, from, to, options = {}) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mesh = add(parent, geometry, material, { ...options, pos: a.clone().add(b).multiplyScalar(0.5).toArray() });
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  }

  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.085, 0.62, 0);
    body.add(leg);
    between(leg, new THREE.CapsuleGeometry(0.042, 0.34, 6, 12), mats.skin, [0, -0.08, 0], [0, -0.5, 0], { line: thinOutline });
    add(leg, new THREE.SphereGeometry(0.075, 16, 12), mats.shoe, { pos: [0, -0.57, 0.035], scale: [0.95, 0.6, 1.55], line: thinOutline });
    return leg;
  });
  add(body, new THREE.CylinderGeometry(0.22, 0.26, 0.22, 28), mats.skirt, { pos: [0, 0.3, 0], scale: [1, 1, 0.8] });
  const robe = [[0, 0.33], [0.27, 0.33], [0.24, 0.5], [0.2, 0.72], [0.16, 0.88], [0.17, 1.0], [0.2, 1.14], [0.21, 1.27], [0.2, 1.35], [0.16, 1.41], [0.07, 1.46], [0, 1.465]].map(([x, y]) => new THREE.Vector2(x, y));
  add(body, new THREE.LatheGeometry(robe, 40), mats.outfit, { scale: [1, 1, 0.78] });
  add(body, new THREE.CylinderGeometry(0.17, 0.165, 0.08, 32), mats.cuff, { pos: [0, 0.9, 0], scale: [1, 1, 0.8], line: thinOutline });
  add(body, new THREE.CylinderGeometry(0.27, 0.275, 0.035, 32), mats.outfitDark, { pos: [0, 0.345, 0], scale: [1, 1, 0.8], line: null });
  add(body, new THREE.TorusGeometry(0.085, 0.025, 10, 28), mats.collar, { pos: [0, 1.445, 0.02], rot: [Math.PI / 2 + 0.3, 0, 0], line: thinOutline });
  add(body, new THREE.CylinderGeometry(0.048, 0.056, 0.16, 14), mats.skin, { pos: [0, 1.52, 0], line: null });
  const apron = [[0.282, 0.38], [0.252, 0.5], [0.212, 0.72], [0.18, 0.88]].map(([x, y]) => new THREE.Vector2(x, y));
  add(body, new THREE.LatheGeometry(apron, 20, -0.85, 1.7), shade("#efe6d2", "paper", { side: THREE.DoubleSide }), { scale: [1, 1, 0.78], line: thinOutline, outfit: "shop" });
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.225, 1.36, 0);
    body.add(arm);
    add(arm, new THREE.SphereGeometry(0.065, 16, 12), mats.outfit, { line: null });
    between(arm, new THREE.CapsuleGeometry(0.058, 0.24, 6, 14), mats.outfit, [0, 0, 0], [0, -0.3, 0]);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.3, 0);
    arm.add(elbow);
    add(elbow, new THREE.CylinderGeometry(0.06, 0.11, 0.3, 18, 1, true), mats.sleeve, { pos: [0, -0.15, 0], line: thinOutline });
    add(elbow, new THREE.CylinderGeometry(0.113, 0.113, 0.04, 18, 1, true), mats.sleeveDark, { pos: [0, -0.3, 0], line: null });
    add(elbow, new THREE.SphereGeometry(0.042, 14, 10), mats.skin, { pos: [0, -0.33, 0.01], scale: [0.75, 1.1, 0.55], line: thinOutline });
    arm.userData.elbow = elbow;
    return arm;
  });

  const herb = new THREE.Group();
  herb.visible = false;
  body.add(herb);
  between(herb, new THREE.CylinderGeometry(0.008, 0.01, 0.3, 6), mats.leaf, [0, 0, 0], [0.03, 0.28, 0], { line: null });
  for (const [x, y, r] of [[0.05, 0.26, -0.7], [-0.03, 0.17, 0.6], [0.05, 0.1, -0.5]]) {
    add(herb, new THREE.SphereGeometry(0.05, 10, 8), mats.leaf, { pos: [x, y, 0], rot: [0, 0, r], scale: [1, 0.45, 0.6], line: thinOutline });
  }
  const herbRest = new THREE.Vector3(0.02, 0.86, 0.3);
  const herbNose = new THREE.Vector3(0.04, 1.55, 0.44);
  herb.position.copy(herbRest);

  const paper = shade("#f4ecd8", "paper");
  const stone = shade("#9c928a", "stone");
  const props = new THREE.Group();
  body.add(props);

  const book = new THREE.Group();
  props.add(book);
  for (const side of [-1, 1]) {
    const page = new THREE.Group();
    page.rotation.y = side * -0.28;
    book.add(page);
    add(page, new THREE.BoxGeometry(0.17, 0.22, 0.012), mats.skirt, { pos: [side * 0.085, 0, -0.006], line: thinOutline });
    add(page, new THREE.BoxGeometry(0.155, 0.2, 0.012), paper, { pos: [side * 0.085, 0, 0.006], line: null });
  }
  book.position.set(0, 1.02, 0.36);
  book.rotation.x = -0.8;

  const mortar = new THREE.Group();
  props.add(mortar);
  const bowl = [[0, 0], [0.08, 0], [0.11, 0.035], [0.12, 0.1], [0.105, 0.1], [0.09, 0.05], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
  add(mortar, new THREE.LatheGeometry(bowl, 24), stone, { line: thinOutline });
  const pestle = add(mortar, new THREE.CapsuleGeometry(0.02, 0.16, 4, 8), stone, { line: thinOutline });
  mortar.position.set(-0.03, 0.88, 0.34);

  const foods = { tea: new THREE.Group(), dumpling: new THREE.Group(), herb: new THREE.Group(), mushroom: new THREE.Group() };
  add(foods.tea, new THREE.CylinderGeometry(0.055, 0.042, 0.07, 18), paper, { line: thinOutline });
  add(foods.tea, new THREE.CylinderGeometry(0.05, 0.05, 0.006, 18), mats.leaf, { pos: [0, 0.03, 0], line: null });
  add(foods.dumpling, new THREE.SphereGeometry(0.065, 16, 12), paper, { scale: [1, 0.72, 0.85], line: thinOutline });
  add(foods.dumpling, new THREE.ConeGeometry(0.03, 0.04, 8), paper, { pos: [0, 0.055, 0], line: null });
  between(foods.herb, new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), mats.leaf, [0, -0.06, 0], [0.01, 0.1, 0], { line: null });
  for (const [x, y, r] of [[0.03, 0.08, -0.7], [-0.025, 0.03, 0.6], [0.03, -0.01, -0.5]]) add(foods.herb, new THREE.SphereGeometry(0.035, 10, 8), mats.leaf, { pos: [x, y, 0], rot: [0, 0, r], scale: [1, 0.45, 0.6], line: thinOutline });
  add(foods.mushroom, new THREE.CylinderGeometry(0.018, 0.024, 0.07, 10), paper, { pos: [0, -0.02, 0], line: thinOutline });
  add(foods.mushroom, new THREE.SphereGeometry(0.06, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shade("#c8303a"), { pos: [0, 0.01, 0], line: thinOutline });
  for (const [x, z] of [[0.025, 0.035], [-0.03, 0.02], [0.005, -0.04], [0.035, -0.015]]) add(foods.mushroom, new THREE.SphereGeometry(0.009, 6, 6), paper, { pos: [x, 0.045, z], line: null });
  for (const food of Object.values(foods)) {
    food.visible = false;
    props.add(food);
  }
  const foodRest = new THREE.Vector3(0.12, 0.98, 0.36);
  const foodMouth = new THREE.Vector3(0.03, 1.66, 0.4);

  const POSES = {
    wave: (side, t) => (side === 1 ? { ax: -0.25, az: 2.5, ex: 0, ez: 0.5 + Math.sin(t * 11) * 0.45 } : null),
    search: (side) => (side === 1 ? { ax: -2.0, az: 0.35, ex: -2.0, ez: 0.9 } : null),
    read: () => ({ ax: -0.75, az: 0.18, ex: -1.25, ez: 0.45 }),
    grind: (side, t) => (side === -1 ? { ax: -0.55, az: 0.12, ex: -1.25, ez: 0.6 } : { ax: -0.75 + Math.sin(t * 7) * 0.12, az: 0.15 + Math.cos(t * 7) * 0.1, ex: -1.35, ez: 0.75 }),
    eat: (side, t, reach) => (side === 1 ? { ax: -0.4 - 1.1 * reach, az: 0.2, ex: -1.4 - 0.4 * reach, ez: 0.9 } : null),
  };
  const reachOf = (p) => (p < 0.25 ? p / 0.25 : p < 0.8 ? 1 : Math.max(0, (1 - p) / 0.2));

  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.2);
  body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.12, 0.03, -0.25], [0.34, 0.3, -0.34], [0.42, 0.62, -0.22], [0.32, 0.8, -0.05]].map((p) => new THREE.Vector3(...p)));
  add(tail, new THREE.TubeGeometry(tailCurve, 32, 0.06, 10), mats.hair, { only: "catgirl" });

  add(head, new THREE.SphereGeometry(0.032, 12, 10), mats.skin, { pos: [0, 0.285, 0.535], scale: [0.7, 0.9, 0.6], line: null });
  const skull = add(head, chin(new THREE.SphereGeometry(HEAD_R, 48, 36), HEAD_R), mats.skin, { pos: HEAD_C.toArray(), scale: HEAD_SCALE });

  const faceCanvas = Object.assign(document.createElement("canvas"), { width: FACE_W, height: FACE_H });
  const faceCtx = faceCanvas.getContext("2d");
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthWrite: false });
  add(head, chin(new THREE.SphereGeometry(HEAD_R + 0.004, 48, 32, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_THETA0, FACE_THETA), HEAD_R + 0.004), faceMat, { pos: HEAD_C.toArray(), scale: HEAD_SCALE, line: null });

  const cap = new THREE.Group();
  cap.position.copy(HEAD_C);
  cap.scale.set(...HEAD_SCALE);
  cap.rotation.x = 0.21;
  head.add(cap);
  add(cap, new THREE.SphereGeometry(HEAD_R + 0.05, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), mats.hairBack);
  add(cap, new THREE.SphereGeometry(HEAD_R + 0.054, 40, 3, Math.PI / 2 - 0.55, 1.1, Math.PI * 0.2, Math.PI * 0.035), mats.hairShine, { line: null });
  add(head, new THREE.SphereGeometry(HEAD_R + 0.045, 48, 24, Math.PI, Math.PI, 0, Math.PI * 0.8), mats.hairBack, { pos: HEAD_C.toArray(), scale: [0.95, 1.1, 0.98] });
  add(head, new THREE.CylinderGeometry(0.44, 0.4, 0.7, 32, 1, true, Math.PI / 2, Math.PI), mats.hairBack, { pos: [0, -0.06, -0.06], scale: [1, 1, 0.9], only: "maomao" });
  add(head, new THREE.CylinderGeometry(0.46, 0.46, 0.4, 32, 1, true, Math.PI / 2, Math.PI), mats.hairBack, { pos: [0, 0.08, -0.05], only: "catgirl" });

  const braids = [];
  for (const side of [-1, 1]) {
    between(head, new THREE.CapsuleGeometry(0.065, 0.42, 6, 12), mats.hair, [side * 0.43, 0.68, 0.26], [side * 0.4, 0.05, 0.31], { scale: [0.75, 1, 0.45], only: "maomao" });
    add(head, new THREE.CapsuleGeometry(0.068, 0.36, 6, 12), mats.hair, { pos: [side * 0.55, 0.18, 0.08], rot: [0.06, 0, side * 0.1] });
    const braid = new THREE.Group();
    braid.position.set(side * 0.53, -0.1, 0.1);
    head.add(braid);
    braids.push(braid);
    parts.maomao.push(braid);
    add(braid, new THREE.SphereGeometry(0.055, 12, 10), mats.beadRed, { pos: [0, -0.02, 0], line: thinOutline });
    for (const [y, r] of [[-0.1, 0.07], [-0.2, 0.064], [-0.29, 0.056]]) add(braid, new THREE.SphereGeometry(r, 12, 10), mats.hair, { pos: [0, y, 0], scale: [1, 1.15, 1], line: thinOutline });
    add(braid, new THREE.SphereGeometry(0.05, 12, 10), mats.beadTeal, { pos: [0, -0.37, 0], line: thinOutline });
    add(braid, new THREE.ConeGeometry(0.04, 0.09, 10), mats.hair, { pos: [0, -0.44, 0], rot: [Math.PI, 0, 0], line: thinOutline });
  }

  add(head, new THREE.SphereGeometry(0.2, 20, 16), mats.hair, { pos: [0, 0.98, -0.3], only: "maomao" });
  for (const side of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.13, 16, 12), mats.ribbon, { pos: [side * 0.19, 1.03, -0.26], rot: [0, 0, side * -0.45], scale: [1, 0.55, 0.4], line: thinOutline, only: "maomao" });
  }
  add(head, new THREE.SphereGeometry(0.055, 12, 10), mats.ribbon, { pos: [0, 1.0, -0.12], line: thinOutline, only: "maomao" });

  const silver = shade("#dfe3ec", "ribbon", { metalness: 0.5, roughness: 0.35 });
  const gold = shade("#e8b84a", "ribbon", { metalness: 0.45, roughness: 0.4 });
  const pearl = shade("#fbf7f0", "ribbon");
  between(head, new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), silver, [-0.3, 1.13, -0.22], [0.28, 0.9, -0.36], { line: thinOutline, outfit: "garden" });
  add(head, new THREE.SphereGeometry(0.05, 12, 10), pearl, { pos: [-0.31, 1.135, -0.21], line: thinOutline, outfit: "garden" });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(head, new THREE.SphereGeometry(0.035, 10, 8), silver, { pos: [-0.31 + Math.cos(a) * 0.055, 1.135 + Math.sin(a) * 0.055, -0.23], scale: [1, 1, 0.5], line: null, outfit: "garden" });
  }
  for (const side of [-1, 1]) {
    between(head, new THREE.CylinderGeometry(0.014, 0.014, 0.56, 8), gold, [side * 0.3, 1.2, -0.2], [side * -0.2, 0.86, -0.38], { line: thinOutline, outfit: "verdigris" });
    add(head, new THREE.SphereGeometry(0.05, 12, 10), gold, { pos: [side * 0.31, 1.205, -0.19], line: thinOutline, outfit: "verdigris" });
    for (const [y, material] of [[1.12, mats.beadRed], [1.05, gold], [0.98, mats.beadRed]]) add(head, new THREE.SphereGeometry(0.026, 8, 8), material, { pos: [side * 0.34, y, -0.17], line: null, outfit: "verdigris" });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(head, new THREE.SphereGeometry(0.075, 10, 8), mats.ribbon, { pos: [0.37 + Math.cos(a) * 0.08, 1.0 + Math.sin(a) * 0.08, 0.3], rot: [0, 0, a], scale: [1, 0.6, 0.45], line: thinOutline, outfit: "jade" });
  }
  add(head, new THREE.SphereGeometry(0.045, 12, 10), gold, { pos: [0.37, 1.0, 0.34], line: thinOutline, outfit: "jade" });

  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.38, 0.98, -0.04);
    ear.rotation.z = side * -0.42;
    head.add(ear);
    parts.catgirl.push(ear);
    add(ear, new THREE.ConeGeometry(0.17, 0.34, 18), mats.hair, { pos: [0, 0.1, 0] });
    add(ear, new THREE.ConeGeometry(0.1, 0.22, 14), mats.earInner, { pos: [0, 0.08, 0.07], line: null });
    return ear;
  });

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);

  const sprites = [];
  const spriteTextures = { heart: heartTexture("#ff6b93"), bang: textTexture("!", "#e2455f"), z: textTexture("z", "#7f86e8"), note: textTexture("?", "#5b8fd6"), anger: angerTexture() };
  function emit(kind, { at = [(Math.random() < 0.5 ? -1 : 1) * 0.45, 2.1, 0.3], scale = 0.26, life = 1.3, rise = 0.45, drift = 0.15 } = {}) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTextures[kind], transparent: true, depthWrite: false }));
    sprite.position.set(at[0] + (Math.random() - 0.5) * drift, at[1], at[2]);
    sprite.scale.setScalar(scale);
    sprite.userData = { age: 0, life, rise, sway: Math.random() * 6, base: sprite.position.clone(), scale };
    scene.add(sprite);
    sprites.push(sprite);
  }

  const state = {
    character: "maomao",
    outfit: "servant",
    face: "idle",
    mouthOpen: false,
    action: null,
    actionAge: 0,
    actionLength: 0,
    walking: 0,
    held: false,
    airborne: false,
    surprise: 0,
    blink: 0,
    nextBlink: 2,
    gaze: [0, 0],
    gazeTarget: [0, 0],
    yaw: 0,
    pitch: 0,
    yawV: 0,
    pitchV: 0,
    facing: 0.18,
    facingV: 0,
    dangle: 0,
    dangleV: 0,
    squash: 0,
    squashV: 0,
    spin: null,
    hopY: 0,
    hopV: 0,
    asleep: false,
    hops: 0,
    lie: 0,
    lieV: 0,
    lieSide: 1,
    pet: 0,
    petTime: 0,
    lastPetted: -99,
    nextHeart: 0,
    blush: 0,
    cursor: null,
    cursorSeen: -99,
    glanceUntil: 0,
    ignoreUntil: 0,
    wanderYaw: 0,
    nextWander: 0,
    nextZ: 0,
    time: 0,
    lastFace: "",
  };

  function setCharacter(name) {
    state.character = name === "catgirl" ? "catgirl" : "maomao";
    for (const mesh of parts.maomao) mesh.visible = state.character === "maomao";
    for (const mesh of parts.catgirl) mesh.visible = state.character === "catgirl";
    for (const [name, meshes] of Object.entries(dress)) for (const mesh of meshes) mesh.visible = state.character === "maomao" && state.outfit === name;
  }

  function setColors(colors = {}) {
    const next = { ...PALETTES[state.character], ...(state.character === "maomao" ? OUTFITS[state.outfit] : {}), ...colors };
    for (const key of Object.keys(palette)) delete palette[key];
    Object.assign(palette, next);
    for (const key of ["hair", "skin", "outfit", "outfitDark", "collar", "cuff", "skirt", "ribbon", "shoe"]) mats[key].color.set(palette[key]);
    mats.skin.emissive.set(palette.skin);
    mats.hairBack.color.set(palette.hair);
    mats.sleeve.color.set(palette.outfit);
    mats.sleeveDark.color.set(palette.outfitDark);
    mats.hairShine.color.set(palette.hairShine);
    mats.earInner.color.set(palette.outfitDark);
    outline.color.set(palette.ink);
    thinOutline.color.set(palette.ink);
    state.lastFace = "";
  }

  const EYE_X = 112;
  const EYE_Y = 184;
  const MOUTH_Y = 292;

  function eyeOpen(ctx, cx, side, open, gx, gy, wide) {
    const rx = 54 * (wide ? 1.06 : 1);
    const ry = 64 * (wide ? 1.12 : 1) * Math.max(open, 0.04);
    const lid = state.character === "maomao" && !wide ? -ry * 0.86 : -ry;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, EYE_Y, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - rx - 4, EYE_Y + lid, rx * 2 + 8, ry * 3);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - rx, EYE_Y - ry, rx * 2, ry * 2);
    const ix = cx + gx * 9;
    const iy = EYE_Y + gy * 7 + 4;
    const iris = ctx.createLinearGradient(0, iy - 46, 0, iy + 46);
    iris.addColorStop(0, palette.ink);
    iris.addColorStop(0.45, palette.eyes);
    iris.addColorStop(1, palette.eyesLight);
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.ellipse(ix, iy, wide ? 34 : 42, wide ? 45 : 56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(ix, iy - 2, wide ? 10 : 15, wide ? 14 : 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ix + 12 * side, iy - 17, 11, 0, Math.PI * 2);
    ctx.moveTo(ix - 10 * side + 5, iy + 19);
    ctx.arc(ix - 10 * side, iy + 19, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = palette.ink;
    ctx.lineCap = "round";
    if (state.character === "maomao" && !wide) {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.92, EYE_Y + lid + 3);
      ctx.quadraticCurveTo(cx, EYE_Y + lid - 4, cx + rx * 0.92, EYE_Y + lid + 3);
      ctx.stroke();
    } else {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.ellipse(cx, EYE_Y, rx + 2, ry + 2, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx + side * (rx - 2), EYE_Y - ry * 0.55);
      ctx.lineTo(cx + side * (rx + 12), EYE_Y - ry * 0.85);
      ctx.stroke();
    }
  }

  function eyeLine(ctx, cx, kind) {
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (kind === "happy") {
      ctx.moveTo(cx - 36, EYE_Y + 14);
      ctx.quadraticCurveTo(cx, EYE_Y - 32, cx + 36, EYE_Y + 14);
    } else if (kind === "sleepy") {
      ctx.moveTo(cx - 36, EYE_Y + 4);
      ctx.quadraticCurveTo(cx, EYE_Y + 24, cx + 36, EYE_Y + 4);
    } else {
      ctx.moveTo(cx - 36, EYE_Y + 8);
      ctx.lineTo(cx + 36, EYE_Y + 8);
    }
    ctx.stroke();
  }

  function eyePout(ctx, cx, side) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, EYE_Y + 12, 42, 36, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - 50, EYE_Y - 4, 100, 70);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 50, EYE_Y - 30, 100, 100);
    ctx.fillStyle = palette.eyes;
    ctx.beginPath();
    ctx.ellipse(cx + side * 5, EYE_Y + 14, 27, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + side * 5 + 9, EYE_Y + 7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 42, EYE_Y - 6 - side * 5);
    ctx.lineTo(cx + 42, EYE_Y - 6 + side * 5);
    ctx.stroke();
  }

  function mouth(ctx, kind) {
    const cx = FACE_W / 2;
    ctx.strokeStyle = palette.lips || palette.ink;
    ctx.lineWidth = palette.lips ? 10 : 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (kind === "open" || kind === "yawn" || kind === "o") {
      const [rx, ry] = kind === "yawn" ? [18, 24] : kind === "o" ? [9, 11] : [14, 12];
      ctx.fillStyle = "#b8405f";
      ctx.ellipse(cx, MOUTH_Y + 4, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ef8aa2";
      ctx.beginPath();
      ctx.ellipse(cx, MOUTH_Y + 4 + ry * 0.45, rx * 0.6, ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (kind === "smile") {
      ctx.moveTo(cx - 16, MOUTH_Y);
      ctx.quadraticCurveTo(cx, MOUTH_Y + 14, cx + 16, MOUTH_Y);
    } else if (kind === "cat") {
      ctx.moveTo(cx - 22, MOUTH_Y - 2);
      ctx.quadraticCurveTo(cx - 11, MOUTH_Y + 12, cx, MOUTH_Y);
      ctx.quadraticCurveTo(cx + 11, MOUTH_Y + 12, cx + 22, MOUTH_Y - 2);
    } else if (kind === "pout") {
      ctx.moveTo(cx - 13, MOUTH_Y + 8);
      ctx.quadraticCurveTo(cx, MOUTH_Y - 4, cx + 13, MOUTH_Y + 8);
    } else {
      ctx.moveTo(cx - 10, MOUTH_Y + 4);
      ctx.lineTo(cx + 10, MOUTH_Y + 4);
    }
    ctx.stroke();
  }

  function drawFace() {
    const action = state.action;
    let eyes = "open";
    let mouthKind = state.character === "maomao" ? "flat" : "smile";
    const face = state.face;
    if (face === "happy" || state.pet > 0.6) [eyes, mouthKind] = ["happy", "cat"];
    if (face === "sleepy") [eyes, mouthKind] = ["sleepy", "flat"];
    if (face === "pout") [eyes, mouthKind] = ["pout", "pout"];
    if (face === "talk") mouthKind = state.mouthOpen ? "open" : mouthKind;
    if (action === "sniff") [eyes, mouthKind] = ["happy", "smile"];
    if (action === "yawn") [eyes, mouthKind] = ["sleepy", "yawn"];
    if (action === "wave") [eyes, mouthKind] = ["happy", "smile"];
    if (action === "eat") [eyes, mouthKind] = [state.food === "mushroom" || state.food === "herb" ? "happy" : eyes, state.mouthOpen ? "open" : "cat"];
    if (state.held) [eyes, mouthKind] = ["pout", "o"];
    if (state.airborne || state.surprise > 0) [eyes, mouthKind] = ["wide", "o"];
    const blink = eyes === "open" ? state.blink : 0;
    const gx = Math.round(state.gaze[0] * 10) / 10;
    const gy = Math.round(state.gaze[1] * 10) / 10;
    const blush = Math.round(state.blush * 10) / 10;
    const key = [state.character, eyes, mouthKind, blink > 0.5 ? 1 : blink > 0.15 ? 0.5 : 0, gx, gy, blush].join("|");
    if (key === state.lastFace) return;
    state.lastFace = key;

    const ctx = faceCtx;
    ctx.clearRect(0, 0, FACE_W, FACE_H);
    const left = FACE_W / 2 - EYE_X;
    const right = FACE_W / 2 + EYE_X;
    const blushAlpha = (state.character === "maomao" ? 0.22 : 0.42) + blush * 0.45;
    for (const x of [left - 22, right + 22]) {
      const gradient = ctx.createRadialGradient(x, 262, 0, x, 262, 40);
      gradient.addColorStop(0, palette.blush);
      gradient.addColorStop(1, "rgba(255,143,171,0)");
      ctx.globalAlpha = Math.min(1, blushAlpha);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, 262, 40, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state.character === "maomao") {
      ctx.fillStyle = "#c08a70";
      for (const [x, y] of [[-30, 256], [-20, 264], [-10, 258], [10, 258], [20, 264], [30, 256], [-40, 264], [40, 264]]) {
        ctx.beginPath();
        ctx.arc(FACE_W / 2 + x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const [cx, side] of [[left, -1], [right, 1]]) {
      if (eyes === "open" || eyes === "wide") {
        if (blink > 0.85) eyeLine(ctx, cx, "closed");
        else eyeOpen(ctx, cx, side, 1 - blink, gx, gy, eyes === "wide");
      } else if (eyes === "pout") eyePout(ctx, cx, side);
      else eyeLine(ctx, cx, eyes);
    }
    mouth(ctx, mouthKind);
    faceTexture.needsUpdate = true;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let width = 1;
  let height = 1;

  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fit = camera.aspect < 0.78 ? 0.78 / camera.aspect : 1;
    camera.position.set(0, 1.45, 6.9 * fit);
    camera.lookAt(0, 1.15, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function partAt(x, y) {
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(root, true).find((h) => h.object.visible && h.object.parent?.visible !== false);
    if (!hit) return null;
    for (let node = hit.object; node; node = node.parent) if (node.userData.part) return node.userData.part;
    return "body";
  }

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  function bounds() {
    box.setFromObject(rig);
    if (box.isEmpty()) return null;
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const px = ((corner.x + 1) / 2) * width;
      const py = ((1 - corner.y) / 2) * height;
      [left, top, right, bottom] = [Math.min(left, px), Math.min(top, py), Math.max(right, px), Math.max(bottom, py)];
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  const headWorld = new THREE.Vector3();
  const projected = new THREE.Vector3();

  function cursor(x, y) {
    const previous = state.cursor;
    state.cursor = { x, y };
    state.cursorSeen = state.time;
    const part = partAt(x, y);
    if (part === "head" && previous && !state.held && !state.airborne) {
      const moved = Math.hypot(x - previous.x, y - previous.y);
      if (moved > 1) state.pet = Math.min(2, state.pet + moved / 90);
    }
    return part;
  }

  function lookTarget() {
    if (state.held) return [0, 0.15];
    head.getWorldPosition(headWorld);
    headWorld.y += HEAD_C.y;
    projected.copy(headWorld).project(camera);
    const hx = ((projected.x + 1) / 2) * width;
    const hy = ((1 - projected.y) / 2) * height;
    const recent = state.cursor && state.time - state.cursorSeen < 2;
    if (!recent) return [state.wanderYaw, 0];
    const dx = state.cursor.x - hx;
    const dy = state.cursor.y - hy;
    const reach = Math.max(width, 260);
    if (Math.hypot(dx, dy) > reach * 1.3) return [state.wanderYaw, 0];
    const t = state.time;
    if (t > state.glanceUntil && t > state.ignoreUntil) {
      state.glanceUntil = t + 1.2 + Math.random() * 1.5;
      state.ignoreUntil = state.glanceUntil + 8 + Math.random() * 12;
    }
    if (t > state.glanceUntil) return [state.wanderYaw, 0];
    return [Math.max(-0.5, Math.min(0.5, Math.atan2(dx, reach * 1.1))), Math.max(-0.35, Math.min(0.4, Math.atan2(dy, reach * 1.2)))];
  }

  function step(dt) {
    state.time += dt;
    const t = state.time;

    if (t > state.nextBlink) {
      state.blink = 1;
      state.nextBlink = t + 2.5 + Math.random() * 4;
    }
    state.blink = Math.max(0, state.blink - dt * 7);

    if (t > state.nextWander) {
      state.wanderYaw = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 0.9;
      state.nextWander = t + 2 + Math.random() * 4;
    }

    if (state.action) {
      state.actionAge += dt;
      if (state.actionAge > state.actionLength) state.action = null;
    }
    const action = state.action;
    const progress = action ? state.actionAge / state.actionLength : 0;
    const bell = action ? Math.sin(Math.min(1, progress) * Math.PI) : 0;

    state.pet = Math.max(0, state.pet - dt * 0.9);
    if (state.pet > 0.6) {
      state.petTime += dt;
      if (t > state.nextHeart) {
        emit("heart", { scale: 0.34 });
        state.nextHeart = t + 0.35;
      }
      if (state.petTime > 1.2 && t - state.lastPetted > 8) {
        state.lastPetted = t;
        onPetted?.();
      }
    } else {
      state.petTime = 0;
    }
    state.blush += ((state.pet > 0.6 || state.face === "happy" ? 1 : 0) - state.blush) * Math.min(1, dt * 4);
    state.surprise = Math.max(0, state.surprise - dt);

    if (state.face === "sleepy" && t > state.nextZ) {
      const lying = state.lie > 0.5;
      emit("z", { at: lying ? [-state.lieSide * 0.75, 0.85, 0.2] : [0.42, 2.15, 0.2], scale: 0.2, life: 2.4, rise: 0.45, drift: 0.05 });
      state.nextZ = t + 1.4;
    }

    const still = state.asleep && !state.held && !state.airborne && state.face === "sleepy";
    const sway = still ? 0.15 : 1;
    [state.lie, state.lieV] = spring(state.lie, still ? 1 : 0, state.lieV, 18, 7, dt);
    const lie = Math.max(0, Math.min(1, state.lie));
    let [targetYaw, targetPitch] = still ? [0, 0.28 * (1 - lie)] : lookTarget();
    if (action === "look") targetYaw = Math.sin(progress * Math.PI * 2) * 0.6;
    if (action === "yawn") targetPitch = -0.25 * bell;
    if (action === "sniff") [targetYaw, targetPitch] = [-0.15 * bell, 0.18 * bell];
    if (action === "search") [targetYaw, targetPitch] = [Math.sin(progress * Math.PI * 3) * 0.65, -0.08];
    if (action === "read") [targetYaw, targetPitch] = [Math.sin(t * 0.7) * 0.05, 0.4];
    if (action === "grind") [targetYaw, targetPitch] = [0, 0.32];
    if (action === "wave") [targetYaw, targetPitch] = [0, -0.05];
    if (state.face === "sleepy" && !still) targetPitch = 0.22 + Math.sin(t * 1.6) * 0.06;
    if (state.pet > 0.6) targetPitch = 0.12;
    if (state.walking) targetYaw = 0;
    [state.yaw, state.yawV] = spring(state.yaw, targetYaw, state.yawV, 40, 9, dt);
    [state.pitch, state.pitchV] = spring(state.pitch, targetPitch, state.pitchV, 40, 9, dt);
    head.rotation.y = state.yaw;
    head.rotation.x = state.pitch;
    head.rotation.z = (still ? 0.06 : Math.sin(t * 1.05) * 0.035) + (state.pet > 0.6 ? Math.sin(t * 5) * 0.08 : 0) + (action === "sniff" ? -0.1 * bell : 0);

    state.gazeTarget = action === "look" ? [Math.sin(progress * Math.PI * 2), 0] : action === "read" || action === "grind" ? [0, 1] : [Math.max(-1, Math.min(1, (targetYaw - state.yaw) * 3 + targetYaw * 0.6)), Math.max(-1, Math.min(1, targetPitch * 1.5))];
    state.gaze[0] += (state.gazeTarget[0] - state.gaze[0]) * Math.min(1, dt * 12);
    state.gaze[1] += (state.gazeTarget[1] - state.gaze[1]) * Math.min(1, dt * 12);

    const facingTarget = state.walking ? state.walking * 1.05 : (0.15 + state.yaw * 0.25) * (1 - lie);
    [state.facing, state.facingV] = spring(state.facing, facingTarget, state.facingV, 30, 8, dt);
    root.rotation.y = state.facing;

    if (state.spin) {
      state.spin.age += dt;
      const p = Math.min(1, state.spin.age / 0.8);
      root.rotation.y += p * Math.PI * 2;
      if (p >= 1) state.spin = null;
    }

    [state.hopY, state.hopV] = [state.hopY + state.hopV * dt, state.hopV - 14 * dt];
    if (state.hopY <= 0) {
      if (state.hopV < -2) bounce(Math.min(1, -state.hopV / 8));
      state.hopY = 0;
      state.hopV = 0;
      if (state.hops > 0) {
        state.hops -= 1;
        state.hopV = 2.4;
        state.hopY = 0.001;
      }
    }

    const breath = Math.sin(t * (still ? 1.1 : 2));
    body.scale.set(1 + breath * 0.006, 1 + breath * 0.01, 1 + breath * 0.008);
    let bob = 0;
    let wobble = 0;
    const stride = Math.sin(t * 8);
    const kick = state.held || state.airborne;
    const shift = state.walking || kick || still ? 0 : Math.sin(t * 0.55);
    body.position.x = shift * 0.012;
    body.rotation.z = shift * 0.018;
    head.rotation.z += -shift * 0.02;
    if (state.walking) {
      bob = Math.abs(stride) * 0.025;
      wobble = stride * 0.025;
    }
    for (const [i, leg] of legs.entries()) {
      const side = i ? -1 : 1;
      if (state.walking) leg.rotation.x = stride * 0.42 * side;
      else if (kick) leg.rotation.x = Math.sin(t * 9 + i * Math.PI) * 0.5 - 0.2;
      else leg.rotation.x = 0;
      leg.position.y = 0.62 + (state.walking ? Math.max(0, stride * side) * 0.025 : 0);
    }

    const armLift = action === "stretch" ? bell * 2.3 : state.airborne ? 1.6 + Math.sin(t * 18) * 0.3 : state.held ? 0.7 : 0;
    const lifted = Math.min(1, armLift / 1.2);
    const swing = state.walking ? stride * 0.32 : 0;
    for (const [i, arm] of arms.entries()) {
      const side = i ? 1 : -1;
      const elbow = arm.userData.elbow;
      arm.rotation.z = side * (0.1 + armLift * 0.55);
      arm.rotation.x = -0.12 - armLift * 0.5 + swing * side;
      arm.position.y = 1.36 + breath * 0.006;
      const tucked = state.walking ? 0.4 : 1;
      elbow.rotation.x = -1.05 * tucked * (1 - lifted);
      elbow.rotation.z = -side * 0.55 * tucked * (1 - lifted);
    }

    const fade = action ? Math.max(0, Math.min(1, state.actionAge / 0.35, (state.actionLength - state.actionAge) / 0.35)) : 0;
    const reach = action === "eat" ? reachOf(progress) : 0;
    if (POSES[action]) {
      for (const [i, arm] of arms.entries()) {
        const side = i ? 1 : -1;
        const target = POSES[action](side, t, reach);
        if (!target) continue;
        const elbow = arm.userData.elbow;
        arm.rotation.x += (target.ax - arm.rotation.x) * fade;
        arm.rotation.z += (side * target.az - arm.rotation.z) * fade;
        elbow.rotation.x += (target.ex - elbow.rotation.x) * fade;
        elbow.rotation.z += (-side * target.ez - elbow.rotation.z) * fade;
      }
    }
    book.visible = action === "read";
    mortar.visible = action === "grind";
    if (mortar.visible) {
      pestle.position.set(Math.cos(t * 7) * 0.04, 0.12, Math.sin(t * 7) * 0.04);
      pestle.rotation.set(Math.sin(t * 7) * 0.35, 0, -Math.cos(t * 7) * 0.35);
    }
    for (const [kind, food] of Object.entries(foods)) {
      food.visible = action === "eat" && state.food === kind && progress < 0.97;
      if (!food.visible) continue;
      food.position.lerpVectors(foodRest, foodMouth, reach);
      food.scale.setScalar(1 - 0.75 * Math.max(0, Math.min(1, (progress - 0.35) / 0.45)));
    }
    if (action === "eat" && reach > 0.9) state.mouthOpen = Math.sin(t * 14) > 0;
    if (action === "eat" && progress > 0.8 && state.mouthOpen) state.mouthOpen = false;

    herb.visible = action === "sniff";
    if (herb.visible) herb.position.lerpVectors(herbRest, herbNose, Math.min(1, bell * 1.6));

    for (const [i, braid] of braids.entries()) {
      braid.rotation.z = Math.sin(t * 2.1 + i * 1.4) * 0.12 * sway - state.dangle * 0.8 + state.yawV * 0.02;
      braid.rotation.x = Math.sin(t * 1.7 + i) * 0.08 * sway + (state.walking ? Math.sin(t * 11) * 0.15 : 0);
    }
    tail.rotation.y = Math.sin(t * 3.4 * sway) * 0.5 * sway;
    tail.rotation.z = Math.sin(t * 1.7) * 0.15 * sway;
    for (const [i, ear] of ears.entries()) {
      const side = i ? 1 : -1;
      ear.rotation.z = side * -0.42 + (!still && t % 5 < 0.2 ? side * -0.25 : 0) + (state.pet > 0.6 ? side * 0.35 : 0);
    }

    if (state.held) {
      [state.dangle, state.dangleV] = spring(state.dangle, 0, state.dangleV, 28, 2.2, dt);
    } else {
      [state.dangle, state.dangleV] = spring(state.dangle, 0, state.dangleV, 60, 12, dt);
    }
    state.dangle = Math.max(-0.45, Math.min(0.45, state.dangle));
    holder.rotation.z = state.dangle;

    [state.squash, state.squashV] = spring(state.squash, 0, state.squashV, 260, 11, dt);
    const stretch = action === "stretch" ? bell * 0.06 : 0;
    rig.scale.set(1 + state.squash, 1 - state.squash + stretch, 1 + state.squash);
    rig.position.y = -2.3 + bob + state.hopY + lie * 0.27;
    rig.position.x = state.lieSide * lie * 1.1;
    rig.rotation.z = wobble + (state.airborne ? Math.sin(t * 7) * 0.12 : 0) + state.lieSide * lie * (Math.PI / 2);
    if (lie > 0.01) {
      for (const leg of legs) leg.rotation.x += -1.25 * lie;
      head.rotation.z += state.lieSide * -0.25 * lie;
    }

    shadow.visible = false;
    const lift = Math.min(1, state.hopY / 1.2);
    shadow.scale.setScalar(1 - lift * 0.4);
    shadow.scale.x *= 1 + lie * 0.9;
    shadow.position.x = state.lieSide * lie * 0.05;
    shadow.material.opacity = 1 - lift * 0.6;

    for (let i = sprites.length - 1; i >= 0; i--) {
      const sprite = sprites[i];
      const data = sprite.userData;
      data.age += dt;
      const p = data.age / data.life;
      sprite.position.set(data.base.x + Math.sin(data.sway + data.age * 4) * 0.08, data.base.y + p * data.rise, data.base.z);
      sprite.material.opacity = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      sprite.scale.setScalar(data.scale * (0.7 + Math.min(1, p * 4) * 0.3));
      if (p >= 1) {
        scene.remove(sprite);
        sprite.material.dispose();
        sprites.splice(i, 1);
      }
    }

    drawFace();
  }

  function bounce(strength = 0.5) {
    state.squash = Math.min(0.28, 0.08 + strength * 0.2);
    state.squashV = 0;
  }

  let last = performance.now();
  let lastRender = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (state.paused) {
      last = now;
      return;
    }
    const busy = state.walking || state.held || state.airborne || state.action || state.pet > 0 || state.spin || sprites.length || state.hopY > 0;
    const interval = busy ? 1000 / 60 : 1000 / 30;
    if (now - lastRender < interval - 1) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastRender = now;
    step(dt);
    renderer.render(scene, camera);
  }
  setCharacter("maomao");
  setColors();
  requestAnimationFrame(frame);

  return {
    setLook({ character, colors, outfit } = {}) {
      const changed = OUTFITS[outfit] && outfit !== state.outfit;
      if (OUTFITS[outfit]) state.outfit = outfit;
      setCharacter(character);
      if (changed && state.time > 1) this.spin();
      setColors(colors);
    },
    setFace(face) {
      state.face = face;
    },
    setMouth(open) {
      state.mouthOpen = open;
    },
    act(name, seconds) {
      state.action = name;
      state.actionAge = 0;
      state.actionLength = seconds;
    },
    setWalking(direction) {
      state.walking = direction;
    },
    setHeld(held) {
      state.held = held;
      if (held) state.pet = 0;
    },
    drag(dx) {
      state.dangleV = Math.max(-4, Math.min(4, state.dangleV - Math.max(-30, Math.min(30, dx)) * 0.05));
    },
    setAirborne(airborne) {
      state.airborne = airborne;
    },
    land(speed = 0) {
      state.airborne = false;
      bounce(Math.min(1, speed / 25));
      if (speed > 18) emit("bang", { at: [0.44, 2.2, 0.2], scale: 0.24, life: 0.9, rise: 0.2, drift: 0 });
    },
    poke() {
      bounce(0.35);
      state.surprise = 0.35;
    },
    spin() {
      state.spin = { age: 0 };
      state.hopV = 4.2;
      state.hopY = 0.001;
      emit("heart", { scale: 0.24 });
    },
    angry() {
      state.surprise = 0;
      bounce(0.6);
      state.hopV = 2.6;
      state.hopY = 0.001;
      for (const delay of [0, 900, 1800]) setTimeout(() => emit("anger", { at: [0.38, 2.12, 0.25], scale: 0.26, life: 1.4, rise: 0.12, drift: 0.04 }), delay);
    },
    feed(kind) {
      state.food = foods[kind] ? kind : "dumpling";
      state.action = "eat";
      state.actionAge = 0;
      state.actionLength = 3.4;
      if (kind === "mushroom") state.pet = 1.4;
    },
    jump() {
      if (state.hopY > 0) return;
      state.hopV = 2.2;
      state.hopY = 0.001;
    },
    hop() {
      if (state.hopY > 0 || state.asleep) return;
      state.hopV = 2.4;
      state.hopY = 0.001;
      state.hops = Math.random() < 0.5 ? 1 : 0;
    },
    setPaused(paused) {
      state.paused = paused;
    },
    setAsleep(asleep, side) {
      state.asleep = asleep;
      if (side) state.lieSide = side;
      if (asleep) state.hops = 0;
    },
    cheer() {
      emit("heart", { scale: 0.3 });
      if (state.hopY <= 0) {
        state.hopV = 3;
        state.hopY = 0.001;
      }
    },
    wonder() {
      emit("note", { at: [0.44, 2.2, 0.2], scale: 0.22, life: 1.6, rise: 0.25, drift: 0 });
    },
    cursor,
    partAt,
    bounds,
  };
}
