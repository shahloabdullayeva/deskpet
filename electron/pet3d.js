import * as THREE from "../node_modules/three/build/three.module.min.js";

const PALETTES = {
  maomao: {
    hair: "#1f4a45", hairShine: "#3c7f74", eyes: "#5b5fcf", eyesLight: "#a9b0f5", skin: "#fcebe1", outfit: "#6fae6c", outfitDark: "#4d8a52",
    collar: "#a6dbb1", cuff: "#cfe07c", skirt: "#7a2f4a", ribbon: "#7f98e0", ink: "#232a2a", shoe: "#3b2b2b", blush: "#ff8fab",
  },
  catgirl: {
    hair: "#4a3355", hairShine: "#7a5a8c", eyes: "#8a5cf0", eyesLight: "#c7b2fa", skin: "#ffe6d8", outfit: "#ffb8cf", outfitDark: "#f08fb0",
    collar: "#ffd6e3", cuff: "#ffe08f", skirt: "#5a3d6b", ribbon: "#f08fb0", ink: "#3a2a3f", shoe: "#3b2b3f", blush: "#ff7fa0",
  },
};

const FACE_W = 608;
const FACE_H = 422;
const FACE_PHI = 1.9;
const FACE_THETA0 = 1.13;
const FACE_THETA = 1.32;
const HEAD_R = 0.6;
const HEAD_C = new THREE.Vector3(0, 0.46, 0);
const HEAD_SCALE = [1.06, 0.97, 1];

function toonRamp() {
  const data = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a7c2, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-2.5, 4, 5);
  scene.add(sun);

  const ramp = toonRamp();
  const palette = { ...PALETTES.maomao };
  const mats = {};
  for (const key of ["hair", "skin", "outfit", "outfitDark", "collar", "cuff", "skirt", "ribbon", "shoe"]) {
    mats[key] = new THREE.MeshToonMaterial({ color: palette[key], gradientMap: ramp });
  }
  mats.hairBack = new THREE.MeshToonMaterial({ color: palette.hair, gradientMap: ramp, side: THREE.DoubleSide });
  mats.hairShine = new THREE.MeshBasicMaterial({ color: palette.hairShine });
  mats.beadRed = new THREE.MeshToonMaterial({ color: "#b9364b", gradientMap: ramp });
  mats.beadTeal = new THREE.MeshToonMaterial({ color: "#3aa29d", gradientMap: ramp });
  mats.leaf = new THREE.MeshToonMaterial({ color: "#6aa56a", gradientMap: ramp });
  mats.earInner = new THREE.MeshToonMaterial({ color: palette.outfitDark, gradientMap: ramp });
  const outline = outlineMaterial(palette.ink, 0.022);
  const thinOutline = outlineMaterial(palette.ink, 0.012);

  const root = new THREE.Group();
  const holder = new THREE.Group();
  const rig = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  holder.position.y = 2.3;
  rig.position.y = -2.3;
  head.position.y = 1.12;
  scene.add(root);
  root.add(holder);
  holder.add(rig);
  rig.add(body, head);
  body.userData.part = "body";
  head.userData.part = "head";

  const parts = { maomao: [], catgirl: [] };

  function add(parent, geometry, material, { pos, rot, scale, line = outline, only } = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    if (line) mesh.add(new THREE.Mesh(geometry, line));
    if (only) parts[only].push(mesh);
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

  const feet = [-1, 1].map((side) => add(body, new THREE.SphereGeometry(0.11, 16, 12), mats.shoe, { pos: [side * 0.14, 0.06, 0.06], scale: [1, 0.6, 1.4] }));
  add(body, new THREE.CylinderGeometry(0.34, 0.46, 0.42, 28), mats.skirt, { pos: [0, 0.27, 0] });
  const robe = [[0, 0.4], [0.46, 0.4], [0.44, 0.58], [0.39, 0.82], [0.31, 0.97], [0.17, 1.06], [0, 1.08]].map(([x, y]) => new THREE.Vector2(x, y));
  add(body, new THREE.LatheGeometry(robe, 32), mats.outfit);
  add(body, new THREE.CylinderGeometry(0.43, 0.445, 0.08, 32), mats.cuff, { pos: [0, 0.6, 0], line: null });
  add(body, new THREE.TorusGeometry(0.17, 0.045, 10, 28), mats.collar, { pos: [0, 1.03, 0.01], rot: [Math.PI / 2 + 0.25, 0, 0], line: thinOutline });
  add(body, new THREE.CylinderGeometry(0.08, 0.09, 0.16, 12), mats.skin, { pos: [0, 1.1, 0], line: null });
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.33, 0.95, 0);
    body.add(arm);
    between(arm, new THREE.CapsuleGeometry(0.12, 0.3, 6, 14), mats.outfit, [0, 0, 0], [-side * 0.2, -0.32, 0.34]);
    between(arm, new THREE.CylinderGeometry(0.13, 0.145, 0.07, 18), mats.outfitDark, [-side * 0.19, -0.3, 0.32], [-side * 0.225, -0.35, 0.39], { line: thinOutline });
    return arm;
  });

  const herb = new THREE.Group();
  herb.visible = false;
  body.add(herb);
  between(herb, new THREE.CylinderGeometry(0.008, 0.01, 0.3, 6), mats.leaf, [0, 0, 0], [0.03, 0.28, 0], { line: null });
  for (const [x, y, r] of [[0.05, 0.26, -0.7], [-0.03, 0.17, 0.6], [0.05, 0.1, -0.5]]) {
    add(herb, new THREE.SphereGeometry(0.05, 10, 8), mats.leaf, { pos: [x, y, 0], rot: [0, 0, r], scale: [1, 0.45, 0.6], line: thinOutline });
  }
  const herbRest = new THREE.Vector3(0.02, 0.55, 0.48);
  const herbNose = new THREE.Vector3(0.05, 1.38, 0.66);
  herb.position.copy(herbRest);

  const tail = new THREE.Group();
  tail.position.set(0, 0.45, -0.33);
  body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.12, 0.03, -0.25], [0.34, 0.3, -0.34], [0.42, 0.62, -0.22], [0.32, 0.8, -0.05]].map((p) => new THREE.Vector3(...p)));
  add(tail, new THREE.TubeGeometry(tailCurve, 32, 0.06, 10), mats.hair, { only: "catgirl" });

  const skull = add(head, new THREE.SphereGeometry(HEAD_R, 48, 36), mats.skin, { pos: HEAD_C.toArray(), scale: HEAD_SCALE });

  const faceCanvas = Object.assign(document.createElement("canvas"), { width: FACE_W, height: FACE_H });
  const faceCtx = faceCanvas.getContext("2d");
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthWrite: false });
  add(head, new THREE.SphereGeometry(HEAD_R + 0.004, 48, 32, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_THETA0, FACE_THETA), faceMat, { pos: HEAD_C.toArray(), scale: HEAD_SCALE, line: null });

  const cap = new THREE.Group();
  cap.position.copy(HEAD_C);
  cap.scale.set(...HEAD_SCALE);
  cap.rotation.x = 0.2;
  head.add(cap);
  add(cap, new THREE.SphereGeometry(HEAD_R + 0.05, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.4), mats.hairBack);
  add(cap, new THREE.SphereGeometry(HEAD_R + 0.054, 40, 3, Math.PI / 2 - 0.55, 1.1, Math.PI * 0.2, Math.PI * 0.035), mats.hairShine, { line: null });
  add(head, new THREE.SphereGeometry(HEAD_R + 0.045, 48, 24, Math.PI, Math.PI, 0, Math.PI * 0.8), mats.hairBack, { pos: HEAD_C.toArray(), scale: [1.07, 1.06, 1.03] });
  add(head, new THREE.CylinderGeometry(0.46, 0.55, 0.8, 32, 1, true, Math.PI / 2, Math.PI), mats.hairBack, { pos: [0, -0.12, -0.04], only: "maomao" });
  add(head, new THREE.CylinderGeometry(0.5, 0.55, 0.4, 32, 1, true, Math.PI / 2, Math.PI), mats.hairBack, { pos: [0, 0.08, -0.04], only: "catgirl" });

  const braids = [];
  for (const side of [-1, 1]) {
    add(head, new THREE.CapsuleGeometry(0.068, 0.36, 6, 12), mats.hair, { pos: [side * 0.64, 0.2, 0.03], rot: [0.06, 0, side * 0.06] });
    const braid = new THREE.Group();
    braid.position.set(side * 0.66, -0.08, 0.04);
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
  const spriteTextures = { heart: heartTexture("#ff6b93"), bang: textTexture("!", "#e2455f"), z: textTexture("z", "#7f86e8"), note: textTexture("?", "#5b8fd6") };
  function emit(kind, { at = [(Math.random() < 0.5 ? -1 : 1) * 0.5, 1.75, 0.3], scale = 0.26, life = 1.3, rise = 0.45, drift = 0.15 } = {}) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTextures[kind], transparent: true, depthWrite: false }));
    sprite.position.set(at[0] + (Math.random() - 0.5) * drift, at[1], at[2]);
    sprite.scale.setScalar(scale);
    sprite.userData = { age: 0, life, rise, sway: Math.random() * 6, base: sprite.position.clone(), scale };
    scene.add(sprite);
    sprites.push(sprite);
  }

  const state = {
    character: "maomao",
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
    pet: 0,
    petTime: 0,
    lastPetted: -99,
    nextHeart: 0,
    blush: 0,
    cursor: null,
    cursorSeen: -99,
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
  }

  function setColors(colors = {}) {
    Object.assign(palette, PALETTES[state.character], colors);
    for (const key of ["hair", "skin", "outfit", "outfitDark", "collar", "cuff", "skirt", "ribbon", "shoe"]) mats[key].color.set(palette[key]);
    mats.hairBack.color.set(palette.hair);
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
    const rx = 44 * (wide ? 1.06 : 1);
    const ry = 54 * (wide ? 1.12 : 1) * Math.max(open, 0.04);
    const lid = state.character === "maomao" && !wide ? -ry * 0.62 : -ry;
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
    ctx.ellipse(ix, iy, wide ? 28 : 35, wide ? 38 : 47, 0, 0, Math.PI * 2);
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
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 8;
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
    const recent = state.cursor && state.time - state.cursorSeen < 4;
    if (!recent) return [state.wanderYaw, 0];
    const dx = state.cursor.x - hx;
    const dy = state.cursor.y - hy;
    const reach = Math.max(width, 260);
    if (Math.hypot(dx, dy) > reach * 3.5) return [state.wanderYaw, 0];
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
      emit("z", { at: [0.5, 1.75, 0.2], scale: 0.2, life: 2.4, rise: 0.45, drift: 0.05 });
      state.nextZ = t + 1.4;
    }

    let [targetYaw, targetPitch] = lookTarget();
    if (action === "look") targetYaw = Math.sin(progress * Math.PI * 2) * 0.6;
    if (action === "yawn") targetPitch = -0.25 * bell;
    if (action === "sniff") [targetYaw, targetPitch] = [-0.15 * bell, 0.18 * bell];
    if (state.face === "sleepy") targetPitch = 0.22 + Math.sin(t * 1.6) * 0.06;
    if (state.pet > 0.6) targetPitch = 0.12;
    if (state.walking) targetYaw = 0;
    [state.yaw, state.yawV] = spring(state.yaw, targetYaw, state.yawV, 40, 9, dt);
    [state.pitch, state.pitchV] = spring(state.pitch, targetPitch, state.pitchV, 40, 9, dt);
    head.rotation.y = state.yaw;
    head.rotation.x = state.pitch;
    head.rotation.z = Math.sin(t * 1.05) * 0.035 + (state.pet > 0.6 ? Math.sin(t * 5) * 0.08 : 0) + (action === "sniff" ? -0.1 * bell : 0);

    state.gazeTarget = action === "look" ? [Math.sin(progress * Math.PI * 2), 0] : [Math.max(-1, Math.min(1, (targetYaw - state.yaw) * 3 + targetYaw * 0.6)), Math.max(-1, Math.min(1, targetPitch * 1.5))];
    state.gaze[0] += (state.gazeTarget[0] - state.gaze[0]) * Math.min(1, dt * 12);
    state.gaze[1] += (state.gazeTarget[1] - state.gaze[1]) * Math.min(1, dt * 12);

    const facingTarget = state.walking ? state.walking * 1.05 : 0.15 + state.yaw * 0.25;
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
    }

    const breathe = 1 + Math.sin(t * 2) * 0.012;
    body.scale.set(1, breathe, 1);
    let bob = 0;
    let wobble = 0;
    if (state.walking) {
      bob = Math.abs(Math.sin(t * 11)) * 0.07;
      wobble = Math.sin(t * 11) * 0.06;
      feet[0].position.z = 0.06 + Math.sin(t * 11) * 0.09;
      feet[1].position.z = 0.06 - Math.sin(t * 11) * 0.09;
    } else {
      feet[0].position.z = feet[1].position.z = 0.06;
    }
    if (state.held || state.airborne) {
      feet[0].position.y = 0.06 + Math.max(0, Math.sin(t * 9)) * 0.08;
      feet[1].position.y = 0.06 + Math.max(0, -Math.sin(t * 9)) * 0.08;
    } else {
      feet[0].position.y = feet[1].position.y = 0.06;
    }

    const armLift = action === "stretch" ? bell * 2.3 : state.airborne ? 1.6 + Math.sin(t * 18) * 0.3 : state.held ? 0.7 : 0;
    arms[0].rotation.z = -armLift * 0.55;
    arms[1].rotation.z = armLift * 0.55;
    arms[0].rotation.x = arms[1].rotation.x = -armLift * 0.5;

    herb.visible = action === "sniff";
    if (herb.visible) herb.position.lerpVectors(herbRest, herbNose, Math.min(1, bell * 1.6));

    for (const [i, braid] of braids.entries()) {
      braid.rotation.z = Math.sin(t * 2.1 + i * 1.4) * 0.12 - state.dangle * 0.8 + state.yawV * 0.02;
      braid.rotation.x = Math.sin(t * 1.7 + i) * 0.08 + (state.walking ? Math.sin(t * 11) * 0.15 : 0);
    }
    tail.rotation.y = Math.sin(t * 3.4) * 0.5;
    tail.rotation.z = Math.sin(t * 1.7) * 0.15;
    for (const [i, ear] of ears.entries()) {
      const side = i ? 1 : -1;
      ear.rotation.z = side * -0.42 + (t % 5 < 0.2 ? side * -0.25 : 0) + (state.pet > 0.6 ? side * 0.35 : 0);
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
    rig.position.y = -2.3 + bob + state.hopY;
    rig.rotation.z = wobble + (state.airborne ? Math.sin(t * 7) * 0.12 : 0);

    shadow.visible = !state.held && !state.airborne;
    const lift = Math.min(1, state.hopY / 1.2);
    shadow.scale.setScalar(1 - lift * 0.4);
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
    if (document.hidden) {
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
    setLook({ character, colors } = {}) {
      setCharacter(character);
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
      if (speed > 18) emit("bang", { at: [0.52, 1.85, 0.2], scale: 0.24, life: 0.9, rise: 0.2, drift: 0 });
    },
    poke() {
      bounce(0.35);
      state.surprise = 0.35;
    },
    spin() {
      state.spin = { age: 0 };
      state.hopV = 6.5;
      state.hopY = 0.001;
      emit("heart", { scale: 0.24 });
    },
    jump() {
      state.hopV = 2.6;
      state.hopY = 0.001;
    },
    wonder() {
      emit("note", { at: [0.52, 1.85, 0.2], scale: 0.22, life: 1.6, rise: 0.25, drift: 0 });
    },
    cursor,
    partAt,
  };
}
