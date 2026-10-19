import * as THREE from "three";
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "../node_modules/@pixiv/three-vrm/lib/three-vrm.module.min.js";
import { heartTexture, textTexture, angerTexture, spring } from "./pet3d.js";

const HEIGHT = 2.25;
const FACES = {
  idle: {},
  happy: { happy: 0.85 },
  pout: { angry: 0.45 },
  sleepy: { blink: 0.65, relaxed: 0.3 },
  talk: {},
};

export function createVrmPet(canvas, { url, onPetted, onFail } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1.5, 3, 4);
  scene.add(sun);

  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.y = 2.3;
  const rig = new THREE.Group();
  rig.position.y = -2.3;
  scene.add(root);
  root.add(holder);
  holder.add(rig);

  let vrm = null;
  const bones = {};
  const rest = {};
  let headY = 1.8;
  let neckY = 1.6;

  const state = {
    face: "idle", mouthOpen: false, action: null, actionAge: 0, actionLength: 0, walking: 0, climbing: false, held: false, airborne: false,
    surprise: 0, blink: 0, nextBlink: 2, yaw: 0, pitch: 0, yawV: 0, pitchV: 0, facing: 0.15, facingV: 0, dangle: 0, dangleV: 0,
    squash: 0, squashV: 0, spin: null, hopY: 0, hopV: 0, hops: 0, asleep: false, lie: 0, lieV: 0, lieSide: 1, pet: 0, petTime: 0,
    lastPetted: -99, nextHeart: 0, cursor: null, cursorSeen: -99, glanceUntil: 0, ignoreUntil: 0, wanderYaw: 0, nextWander: 0, nextZ: 0,
    time: 0, paused: false, mouth: 0, food: null, weights: {},
  };

  new GLTFLoader()
    .register((parser) => new VRMLoaderPlugin(parser))
    .loadAsync(url)
    .then((gltf) => {
      vrm = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons?.(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((node) => {
        node.frustumCulled = false;
      });
      const box = new THREE.Box3().setFromObject(vrm.scene);
      const scale = HEIGHT / Math.max(0.1, box.max.y - box.min.y);
      vrm.scene.scale.setScalar(scale);
      vrm.scene.position.y = -box.min.y * scale;
      rig.add(vrm.scene);
      for (const name of ["hips", "spine", "chest", "neck", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftHand", "rightHand", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg", "leftFoot", "rightFoot"]) {
        bones[name] = vrm.humanoid.getNormalizedBoneNode(name);
        if (bones[name]) rest[name] = bones[name].position.clone();
      }
      vrm.update(0);
      const at = new THREE.Vector3();
      headY = bones.head ? bones.head.getWorldPosition(at).y : headY;
      neckY = bones.neck ? bones.neck.getWorldPosition(at).y : neckY;
    })
    .catch((error) => onFail?.(error));

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

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function partAt(x, y) {
    if (!vrm) return null;
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(vrm.scene, true)[0];
    if (!hit) return null;
    const neck = bones.neck ? bones.neck.getWorldPosition(new THREE.Vector3()).y : neckY;
    return hit.point.y > neck ? "head" : "body";
  }

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  let cachedBounds = null;
  let boundsAt = -1;
  function bounds() {
    if (!vrm) return null;
    if (state.time - boundsAt < 0.25 && cachedBounds) return cachedBounds;
    boundsAt = state.time;
    box.setFromObject(vrm.scene, true);
    if (box.isEmpty()) return null;
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const px = ((corner.x + 1) / 2) * width;
      const py = ((1 - corner.y) / 2) * height;
      [left, top, right, bottom] = [Math.min(left, px), Math.min(top, py), Math.max(right, px), Math.max(bottom, py)];
    }
    cachedBounds = { x: left, y: top, width: right - left, height: bottom - top };
    return cachedBounds;
  }

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

  const projected = new THREE.Vector3();
  function lookTarget() {
    if (state.held || !state.cursor || state.time - state.cursorSeen > 2) return [state.wanderYaw, 0];
    projected.set(0, headY, 0).applyMatrix4(rig.matrixWorld).project(camera);
    const dx = state.cursor.x - ((projected.x + 1) / 2) * width;
    const dy = state.cursor.y - ((1 - projected.y) / 2) * height;
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

  function bounce(strength = 0.5) {
    state.squash = Math.min(0.28, 0.08 + strength * 0.2);
    state.squashV = 0;
  }

  function pose(name, x = 0, y = 0, z = 0) {
    const bone = bones[name];
    if (bone) bone.rotation.set(x, y, z);
  }

  function setExpressions(dt) {
    const manager = vrm.expressionManager;
    if (!manager) return;
    const action = state.action;
    let face = state.face;
    if (state.pet > 0.6 || action === "wave" || action === "sniff" || (action === "eat" && state.food !== "dumpling")) face = "happy";
    const target = { ...(FACES[face] || {}) };
    if (state.held) Object.assign(target, { sad: 0.5, oh: 0.4 });
    if (state.airborne || state.surprise > 0) Object.assign(target, { oh: 0.7, angry: 0 });
    if (state.asleep) Object.assign(target, { blink: 1, relaxed: 0.4 });
    if (action === "yawn") Object.assign(target, { oh: 0.9, blink: 0.7 });
    const talking = state.mouthOpen ? 0.65 : 0;
    state.mouth += (talking - state.mouth) * Math.min(1, dt * 25);
    target.aa = Math.max(target.aa || 0, state.mouth);
    if (!target.blink && !target.happy) target.blink = Math.min(1, state.blink);
    for (const name of ["happy", "angry", "sad", "relaxed", "oh", "aa", "blink"]) {
      const value = target[name] || 0;
      const now = state.weights[name] || 0;
      const next = name === "blink" ? value : now + (value - now) * Math.min(1, dt * 10);
      state.weights[name] = next;
      manager.setValue(name, next);
    }
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
    } else state.petTime = 0;
    state.surprise = Math.max(0, state.surprise - dt);
    if (state.asleep && t > state.nextZ) {
      emit("z", { at: [0.35 * state.lieSide, 0.9, 0.3], scale: 0.2, life: 2, rise: 0.4, drift: 0.05 });
      state.nextZ = t + 1.6;
    }

    for (let i = sprites.length - 1; i >= 0; i--) {
      const sprite = sprites[i];
      const data = sprite.userData;
      data.age += dt;
      const p = data.age / data.life;
      sprite.position.set(data.base.x + Math.sin(data.sway + data.age * 4) * 0.08, data.base.y + p * data.rise, data.base.z);
      sprite.material.opacity = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      if (p >= 1) {
        scene.remove(sprite);
        sprite.material.dispose();
        sprites.splice(i, 1);
      }
    }
    if (!vrm) return;

    [state.lie, state.lieV] = spring(state.lie, state.asleep ? 1 : 0, state.lieV, 18, 7, dt);
    const lie = Math.max(0, Math.min(1, state.lie));
    let [targetYaw, targetPitch] = lookTarget();
    if (action === "search") [targetYaw, targetPitch] = [Math.sin(progress * Math.PI * 3) * 0.65, -0.08];
    if (action === "read" || action === "grind") [targetYaw, targetPitch] = [0, 0.35];
    if (action === "look") targetYaw = Math.sin(progress * Math.PI * 2) * 0.5;
    if (state.face === "sleepy") targetPitch = 0.22;
    if (state.pet > 0.6) targetPitch = 0.15;
    if (state.walking || state.climbing) targetYaw = 0;
    [state.yaw, state.yawV] = spring(state.yaw, targetYaw, state.yawV, 40, 9, dt);
    [state.pitch, state.pitchV] = spring(state.pitch, targetPitch, state.pitchV, 40, 9, dt);

    const facingTarget = state.climbing ? Math.PI : state.walking ? state.walking * 1.05 : (0.15 + state.yaw * 0.25) * (1 - lie);
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
    [state.squash, state.squashV] = spring(state.squash, 0, state.squashV, 180, 10, dt);
    [state.dangle, state.dangleV] = spring(state.dangle, 0, state.dangleV, state.held ? 22 : 60, state.held ? 2.2 : 9, dt);

    const breath = Math.sin(t * 2);
    const stride = Math.sin(t * 8);
    const pull = Math.sin(t * 7);
    const kick = state.held || state.airborne;

    let ax = [0, 0];
    let az = [1.4, 1.4];
    let ay = [0, 0];
    let ex = [0, 0];
    let ey = [0, 0];
    let lx = [0, 0];
    let kx = [0, 0];
    if (state.walking) {
      ax = [stride * 0.35, -stride * 0.35];
      az = [1.25, 1.25];
      ey = [0.25, 0.25];
      lx = [-stride * 0.28, stride * 0.28];
      kx = [Math.max(0, stride) * 0.45, Math.max(0, -stride) * 0.45];
    }
    if (kick) {
      az = state.airborne ? [-0.3 + Math.sin(t * 18) * 0.2, -0.3 + Math.cos(t * 18) * 0.2] : [0.6, 0.6];
      lx = [Math.sin(t * 9) * 0.45 - 0.2, Math.sin(t * 9 + Math.PI) * 0.45 - 0.2];
      kx = [0.5, 0.5];
    }
    if (state.climbing) {
      const reach = [Math.sin(t * 7), Math.sin(t * 7 + Math.PI)];
      az = [-1.25 - reach[0] * 0.25, -1.25 - reach[1] * 0.25];
      ax = [-0.3, -0.3];
      ey = [0.8 * Math.max(0, -reach[0]), 0.8 * Math.max(0, -reach[1])];
      lx = [-0.7 - reach[0] * 0.5, -0.7 - reach[1] * 0.5];
      kx = [1 + reach[0] * 0.5, 1 + reach[1] * 0.5];
    }
    const fade = action ? Math.max(0, Math.min(1, state.actionAge / 0.35, (state.actionLength - state.actionAge) / 0.35)) : 0;
    const mix = (from, to) => from + (to - from) * fade;
    if (action === "wave") {
      az[1] = mix(az[1], -0.45);
      ey[1] = mix(ey[1], 1.1 + Math.sin(t * 11) * 0.35);
    }
    if (action === "stretch") {
      az = [mix(az[0], -1.3 * bell), mix(az[1], -1.3 * bell)];
    }
    if (action === "search") {
      az[1] = mix(az[1], 0.1);
      ax[1] = mix(ax[1], -1.2);
      ey[1] = mix(ey[1], 2.0);
    }
    if (action === "point") {
      az[1] = mix(az[1], 0.35);
      ay[1] = mix(ay[1], 1.2);
    }
    if (action === "read" || action === "grind" || action === "eat") {
      const stir = action === "grind" ? Math.sin(t * 7) * 0.12 : 0;
      az = [mix(az[0], 1.0), mix(az[1], 1.0 + stir)];
      ay = [mix(ay[0], -0.9), mix(ay[1], 0.9)];
      ey = [mix(ey[0], -1.2), mix(ey[1], 1.2 + (action === "eat" ? Math.max(0, Math.sin(t * 6)) * 0.6 : 0))];
    }
    if (state.asleep) {
      az = [1.3, 1.3];
      lx = [0, 0];
      kx = [0, 0];
    }

    pose("leftUpperArm", ax[0], ay[0], az[0]);
    pose("rightUpperArm", ax[1], ay[1], -az[1]);
    pose("leftLowerArm", ex[0], -ey[0], 0);
    pose("rightLowerArm", ex[1], ey[1], 0);
    pose("leftUpperLeg", lx[0], 0, 0);
    pose("rightUpperLeg", lx[1], 0, 0);
    pose("leftLowerLeg", kx[0], 0, 0);
    pose("rightLowerLeg", kx[1], 0, 0);
    pose("spine", breath * 0.015 + (state.climbing ? Math.abs(pull) * 0.06 : 0), 0, state.walking ? stride * 0.03 : Math.sin(t * 0.55) * 0.02);
    pose("chest", 0, 0, 0);
    pose("neck", state.pitch * 0.4, state.yaw * 0.4, 0);
    pose("head", state.pitch * 0.6, state.yaw * 0.6, (state.pet > 0.6 ? Math.sin(t * 5) * 0.08 : Math.sin(t * 1.05) * 0.03) + state.dangle * 0.2);
    if (bones.hips && rest.hips) bones.hips.position.y = rest.hips.y + (state.walking ? Math.abs(stride) * 0.01 : 0);

    const sideways = lie * state.lieSide * (Math.PI / 2);
    holder.rotation.z = state.dangle * 0.5 + sideways;
    holder.position.set(-state.lieSide * lie * 1.1, 2.3 - lie * 2.05, 0);
    rig.position.y = -2.3 + state.hopY + (state.climbing ? Math.abs(pull) * 0.04 : 0);
    rig.scale.set(1 + state.squash * 0.5, 1 - state.squash, 1 + state.squash * 0.5);

    setExpressions(dt);
    vrm.update(dt);
  }

  let last = performance.now();
  let lastRender = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (state.paused) {
      last = now;
      return;
    }
    const busy = state.walking || state.climbing || state.held || state.airborne || state.action || state.pet > 0 || state.spin || sprites.length || state.hopY > 0;
    const interval = busy ? 1000 / 60 : 1000 / 30;
    if (now - lastRender < interval - 1) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastRender = now;
    step(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    vrm: true,
    setLook() {},
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
    setClimbing(on) {
      state.climbing = Boolean(on);
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
      state.food = kind;
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
    dispose() {
      renderer.dispose();
    },
  };
}
