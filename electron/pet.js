const petEl = document.getElementById("pet");
const bubble = document.getElementById("bubble");
const art = document.getElementById("art");
const drawn = document.getElementById("drawn");

const ACTIONS = { look: 3000, sniff: 3000, yawn: 2600, stretch: 2400 };

let base = "idle";
let face = "idle";
let images = {};
let volume = 0.7;
let wander = true;
let pinned = false;
let talking = false;
let walking = false;
let hovered = false;
let talkTimer;
let flapTimer;
let chimes;

function render() {
  const keep = [...petEl.classList].filter((name) => ["walking", "held", "left", "mouth-shut", "hop-out", "hop-in"].includes(name) || name.startsWith("act-"));
  petEl.className = [face, ...keep].join(" ");
  const held = petEl.classList.contains("held");
  const image = (held && images.held) || (walking && images.walk) || images[face] || images.idle;
  art.hidden = !image;
  drawn.hidden = Boolean(image);
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
  petEl.classList.remove("mouth-shut");
  bubble.hidden = true;
  setFace(base);
}

// A soft two-note chime, made on the fly so there is no sound file to ship.
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

  // Flap the mouth while talking (swaps idle/talk pictures when custom art is used).
  if (speaking) {
    let shut = false;
    flapTimer = setInterval(() => {
      shut = !shut;
      petEl.classList.toggle("mouth-shut", shut);
      if (images.talk && images.idle) art.src = shut ? images.idle : images.talk;
    }, 160);
  }

  const duration = Math.min(14000, 3500 + text.length * 70);
  if (ring) chime();
  if (speaking) setTimeout(() => clearInterval(flapTimer), Math.min(duration, 2500));
  talkTimer = setTimeout(stopTalking, duration);
}

// Idle life: every so often she looks around, sniffs her herbs, yawns, stretches or goes for a walk.
function act(name) {
  petEl.classList.add(`act-${name}`);
  setTimeout(() => petEl.classList.remove(`act-${name}`), ACTIONS[name]);
}

function walk() {
  const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 380);
  walking = true;
  petEl.classList.add("walking");
  petEl.classList.toggle("left", dx < 0);
  render();
  window.pet.walk(dx);
}

// Jump up and out, reappear on another screen, land with a little bounce.
function hop() {
  walking = true;
  petEl.classList.add("hop-out");
  setTimeout(() => window.pet.hop(), 450);
}

function live() {
  setTimeout(live, 12000 + Math.random() * 25000);
  if (talking || walking || hovered || face !== "idle" || document.hidden) return;
  const roll = Math.random();
  if (wander && !pinned && roll < 0.12) return hop();
  if (wander && !pinned && roll < 0.4) return walk();
  const names = Object.keys(ACTIONS);
  act(names[Math.floor(Math.random() * names.length)]);
}

// Click = poke, drag = carry her around, right click = menu. Clicks pass through empty space.
let down = null;
for (const el of [petEl, bubble]) {
  el.addEventListener("mouseenter", () => {
    hovered = true;
    window.pet.hover(true);
  });
  el.addEventListener("mouseleave", () => {
    hovered = false;
    if (!down) window.pet.hover(false);
  });
}
bubble.addEventListener("click", () => {
  stopTalking();
  window.pet.openChat();
});
petEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.pet.menu();
});
petEl.addEventListener("mousedown", (event) => {
  if (event.button === 0) down = { x: event.screenX, y: event.screenY, moved: false };
});
window.addEventListener("mousemove", (event) => {
  if (!down) return;
  const dx = event.screenX - down.x;
  const dy = event.screenY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < 4) return;
  if (!down.moved) {
    petEl.classList.add("held");
    render();
  }
  down.moved = true;
  window.pet.drag(dx, dy);
  down.x = event.screenX;
  down.y = event.screenY;
});
window.addEventListener("mouseup", () => {
  if (down && !down.moved) window.pet.tap();
  if (down?.moved) {
    petEl.classList.remove("held");
    render();
  }
  down = null;
  if (!petEl.matches(":hover") && !bubble.matches(":hover")) window.pet.hover(false);
});

window.pet.on("say", say);
// A quick face (happy when he opens the chat, talking while she "types" a reply).
let flashTimer;
window.pet.on("flash", (mood) => {
  if (talking) return;
  clearTimeout(flashTimer);
  setFace(mood);
  flashTimer = setTimeout(() => !talking && setFace(base), mood === "talk" ? 8000 : 1600);
});

window.pet.on("pinned", (value) => (pinned = value));
window.pet.on("call", (on) => {
  document.getElementById("badge").hidden = !on;
  if (on) stopTalking();
});

window.pet.on("hopped", () => {
  petEl.classList.remove("hop-out");
  petEl.classList.add("hop-in");
  setTimeout(() => {
    petEl.classList.remove("hop-in");
    walking = false;
    render();
  }, 600);
});

window.pet.on("walked", () => {
  walking = false;
  petEl.classList.remove("walking");
  render();
});
window.pet.on("mood", (mood) => {
  base = mood;
  if (!talking) setFace(mood);
});
window.pet.on("look", (look) => {
  images = look.images || {};
  volume = look.volume;
  wander = look.wander !== false;
  document.documentElement.classList.toggle("bg-black", look.background !== "none");
  document.documentElement.classList.toggle("maomao", look.character === "maomao");
  const names = {
    hair: "--hair", hairShine: "--hair-shine", eyes: "--eyes", skin: "--skin", outfit: "--outfit", outfitDark: "--outfit-dark",
    collar: "--collar", cuff: "--cuff", skirt: "--skirt", ribbon: "--ribbon",
  };
  for (const [key, value] of Object.entries(look.colors || {})) {
    if (names[key]) document.documentElement.style.setProperty(names[key], value);
  }
  render();
});
window.pet.ready();
setTimeout(live, 8000);
