import { createPet } from "./pet3d.js";

const petEl = document.getElementById("pet");
const bubble = document.getElementById("bubble");
const badge = document.getElementById("badge");
const art = document.getElementById("art");
const sceneEl = document.getElementById("scene");
const rootEl = document.documentElement;

const ACTIONS = { look: 3, sniff: 3.2, yawn: 2.6, stretch: 2.4, read: 7, grind: 5.5 };
const SECONDS = { ...ACTIONS, wave: 2.6, search: 4.5 };
const LONELY_AFTER = 10 * 60_000;

const model = start3d();

function start3d() {
  try {
    return createPet(sceneEl, { onPetted: () => window.pet.petted() });
  } catch (error) {
    console.warn(`3D failed, showing her picture instead: ${error.message}`);
    const still = () => {};
    const flat = { cursor: () => false, partAt: () => null, bounds: () => null };
    for (const name of ["setLook", "setFace", "setMouth", "act", "setWalking", "setHeld", "drag", "setAirborne", "land", "poke", "spin", "jump", "hop", "wonder", "setAsleep", "setPaused", "feed", "angry", "cheer"]) flat[name] = still;
    flat.flat = true;
    return flat;
  }
}

let base = "idle";
let face = "idle";
let images = {};
let volume = 0.7;
let wander = true;
let pinned = false;
let paused = false;
let napping = false;
let lastTouched = Date.now();
const touched = () => (lastTouched = Date.now());
let talking = false;
let walking = false;
let airborne = false;
let hovered = false;
let held = false;
let talkTimer;
let flapTimer;
let flashTimer;
let clickTimer;
let chimes;

function render() {
  model.setFace(face);
  const image = (held && images.held) || (walking && images.walk) || images[face] || images.idle || (model.flat && "icon.png");
  art.hidden = !image;
  sceneEl.hidden = Boolean(image);
  if (image && art.src !== image) art.src = image;
}

function setFace(next) {
  face = next;
  render();
}

function stopTalking() {
  clearTimeout(talkTimer);
  clearInterval(flapTimer);
  talking = false;
  model.setMouth(false);
  bubble.hidden = true;
  setFace(base);
}

function chime() {
  try {
    chimes ||= new AudioContext();
    const now = chimes.currentTime;
    for (const [i, freq] of [1318.5, 1760].entries()) {
      const osc = chimes.createOscillator();
      const gain = chimes.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25 * volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(chimes.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    }
  } catch {}
}

function say({ text, mood, chime: ring }) {
  stopTalking();
  talking = true;
  bubble.textContent = text;
  bubble.hidden = false;
  const speaking = mood === "talk" || !mood;
  setFace(speaking ? "talk" : mood);
  if (!asleep()) model.jump();

  if (speaking) {
    let open = false;
    flapTimer = setInterval(() => {
      open = !open;
      model.setMouth(open);
      if (images.talk && images.idle) art.src = open ? images.talk : images.idle;
    }, 150);
  }

  const duration = Math.min(14000, 3500 + text.length * 70);
  if (ring) chime();
  if (speaking) setTimeout(() => (clearInterval(flapTimer), model.setMouth(false)), Math.min(duration, 2500));
  talkTimer = setTimeout(stopTalking, duration);
}

function act(name) {
  model.act(name, SECONDS[name] || 3);
}

function walk() {
  const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 380);
  walking = true;
  model.setWalking(Math.sign(dx));
  petEl.classList.toggle("left", dx < 0);
  render();
  window.pet.walk(dx);
}

function asleep() {
  return base === "sleepy";
}

function live() {
  setTimeout(live, 15000 + Math.random() * 30000);
  if (talking || walking || hovered || held || airborne || asleep() || face !== base || paused) return;
  const roll = Math.random();
  if (Date.now() - lastTouched > LONELY_AFTER && roll < 0.35) return act("search");
  if (roll < 0.05) return model.hop();
  if (wander && !pinned && base !== "pout" && roll < 0.27) return walk();
  if (roll < 0.35) return model.wonder();
  const names = Object.keys(ACTIONS);
  act(names[Math.floor(Math.random() * names.length)]);
}

function inside(el, x, y) {
  if (el.hidden) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function track(x, y) {
  if (down || !art.hidden) return;
  const r = sceneEl.getBoundingClientRect();
  model.cursor(x - r.left, y - r.top);
}

function hitAt(x, y) {
  if (inside(bubble, x, y) || inside(badge, x, y)) return true;
  if (!art.hidden) return inside(art, x, y);
  const r = sceneEl.getBoundingClientRect();
  return Boolean(model.partAt(x - r.left, y - r.top));
}

function setHovered(over) {
  hovered = over;
  rootEl.classList.toggle("over", over);
}

function box(el, pad = 0) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left - pad), y: Math.round(r.top - pad), width: Math.round(r.width + pad * 2), height: Math.round(r.height + pad * 2) };
}

let lastShape = "";
function reportShape() {
  const rects = [];
  if (!art.hidden) rects.push(box(art));
  else {
    const sprite = model.bounds();
    const r = sceneEl.getBoundingClientRect();
    if (sprite) rects.push({ x: Math.round(r.left + sprite.x - 4), y: Math.round(r.top + sprite.y - 4), width: Math.round(sprite.width + 8), height: Math.round(sprite.height + 8) });
  }
  if (!bubble.hidden) rects.push(box(bubble, 2));
  if (!badge.hidden) rects.push(box(badge, 2));
  const key = JSON.stringify(rects);
  if (key === lastShape) return;
  lastShape = key;
  window.pet.shape(rects);
}
setInterval(reportShape, 100);

let down = null;
let samples = [];

window.addEventListener("mousemove", (event) => {
  if (!down) return track(event.clientX, event.clientY);
  const dx = event.screenX - down.x;
  const dy = event.screenY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < 4) return;
  if (!down.moved) {
    held = true;
    rootEl.classList.add("grabbing", "flying");
    model.setHeld(true);
    model.setWalking(0);
    walking = false;
    render();
  }
  down.moved = true;
  model.drag(dx);
  window.pet.drag(dx, dy);
  samples.push({ x: event.screenX, y: event.screenY, t: performance.now() });
  samples = samples.filter((s) => performance.now() - s.t < 90);
  down.x = event.screenX;
  down.y = event.screenY;
});

petEl.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !(hovered || hitAt(event.clientX, event.clientY))) return;
  setHovered(true);
  touched();
  window.pet.hold(true);
  down = { x: event.screenX, y: event.screenY, moved: false };
  samples = [{ x: event.screenX, y: event.screenY, t: performance.now() }];
});

window.addEventListener("mouseup", (event) => {
  if (!down) return;
  window.pet.hold(false);
  if (down.moved) {
    held = false;
    rootEl.classList.remove("grabbing", "flying");
    model.setHeld(false);
    const first = samples[0];
    const last = samples[samples.length - 1];
    const ms = last && first ? Math.max(16, last.t - first.t) : 16;
    window.pet.drop(last ? (last.x - first.x) / ms : 0, last ? (last.y - first.y) / ms : 0);
    render();
  } else if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    model.spin();
    window.pet.spun();
  } else {
    model.poke();
    clickTimer = setTimeout(() => {
      clickTimer = null;
      window.pet.tap();
    }, 260);
  }
  down = null;
  track(event.clientX, event.clientY);
});

bubble.addEventListener("click", () => {
  stopTalking();
  window.pet.openChat();
});
petEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (hovered || hitAt(event.clientX, event.clientY)) window.pet.menu();
});
window.addEventListener("wheel", (event) => {
  if (hovered || hitAt(event.clientX, event.clientY)) window.pet.resize(event.deltaY < 0 ? 1 : -1);
});

window.pet.on("cursor", ({ x, y }) => {
  if (!down) track(x, y);
});
window.pet.on("hover", (over) => {
  if (!down) setHovered(over);
  if (over && Date.now() - lastTouched > LONELY_AFTER && !asleep() && !talking) act("wave");
  if (over) touched();
});
window.pet.on("feed", (kind) => {
  if (asleep() || held || airborne) return;
  touched();
  if (walking) window.pet.stopWalking();
  model.feed(kind);
  setTimeout(() => window.pet.ate(kind), 3000);
});
window.pet.on("welcome", () => {
  touched();
  if (!asleep() && !held && !airborne) act("wave");
});
window.pet.on("angry", () => model.angry());
window.pet.on("chase", (dir) => {
  touched();
  walking = Boolean(dir);
  model.setWalking(dir);
  if (dir) petEl.classList.toggle("left", dir < 0);
  render();
});
window.pet.on("reach", () => model.hop());
window.pet.on("caught", () => {
  touched();
  model.cheer();
});
document.documentElement.addEventListener("mouseleave", () => {
  if (!down) setHovered(false);
});
window.pet.on("say", say);
window.pet.on("flash", (mood) => {
  if (talking) return;
  clearTimeout(flashTimer);
  setFace(mood);
  flashTimer = setTimeout(() => !talking && setFace(base), mood === "talk" ? 8000 : 1600);
});
window.pet.on("pinned", (value) => (pinned = value));
window.pet.on("visible", (visible) => {
  paused = !visible;
  model.setPaused(paused);
});
window.pet.on("call", (on) => {
  badge.hidden = !on;
  if (on) stopTalking();
});
window.pet.on("size", (size) => {
  rootEl.style.setProperty("--size", `${size}px`);
});
window.pet.on("airborne", () => {
  airborne = true;
  rootEl.classList.add("flying");
  model.setAirborne(true);
});
window.pet.on("bounce", (speed) => model.land(speed));
window.pet.on("landed", (speed) => {
  airborne = false;
  rootEl.classList.remove("flying");
  model.land(speed);
});
window.pet.on("walked", (where) => {
  walking = false;
  model.setWalking(0);
  if (napping) {
    napping = false;
    if (asleep()) {
      model.setAsleep(true, where?.side || 1);
      rootEl.classList.add("lying");
    }
  }
  render();
});
window.pet.on("nap", (dx) => {
  if (!dx) return;
  walking = true;
  model.setWalking(Math.sign(dx));
  render();
});
window.pet.on("mood", (mood) => {
  const was = base;
  base = mood;
  if (!talking) setFace(mood);
  if (mood !== "sleepy") {
    napping = false;
    rootEl.classList.remove("lying");
    return model.setAsleep(false);
  }
  if (was === "sleepy") return;
  model.setAsleep(false);
  napping = true;
  window.pet.nap();
});
window.pet.on("look", (look) => {
  images = look.images || {};
  volume = look.volume;
  wander = look.wander !== false;
  rootEl.classList.toggle("catgirl", look.character === "catgirl");
  rootEl.style.setProperty("--size", `${look.size}px`);
  model.setLook({ character: look.character, colors: look.colors });
  render();
});
window.pet.ready();
setTimeout(live, 8000);
setTimeout(() => !asleep() && !talking && act("wave"), 3000);
