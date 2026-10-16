const petEl = document.getElementById("pet");
const bubble = document.getElementById("bubble");
const art = document.getElementById("art");
const drawn = document.getElementById("drawn");

let base = "idle";
let images = {};
let volume = 0.7;
let talkTimer;
let flapTimer;
let audio;

function setMood(mood) {
  petEl.className = mood;
  const image = images[mood] || images.idle;
  art.hidden = !image;
  drawn.hidden = Boolean(image);
  if (image) art.src = image;
}

function stopTalking() {
  clearTimeout(talkTimer);
  clearInterval(flapTimer);
  bubble.hidden = true;
  setMood(base);
}

function say({ text, mood, sound }) {
  stopTalking();
  bubble.textContent = text;
  bubble.hidden = false;
  const talking = mood === "talk" || !mood;
  setMood(talking ? "talk" : mood);

  // Flap the mouth while talking (swaps idle/talk art when custom images are used).
  if (talking) {
    let shut = false;
    flapTimer = setInterval(() => {
      shut = !shut;
      petEl.classList.toggle("mouth-shut", shut);
      if (images.talk && images.idle) art.src = shut ? images.idle : images.talk;
    }, 160);
  }

  let duration = Math.min(14000, 3500 + text.length * 70);
  if (audio) audio.pause();
  if (sound) {
    audio = new Audio(sound);
    audio.volume = volume;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        clearTimeout(talkTimer);
        talkTimer = setTimeout(stopTalking, Math.max(duration, audio.duration * 1000 + 1500));
      }
    };
    audio.onended = () => clearInterval(flapTimer);
    audio.play().catch(() => {});
  } else if (talking) {
    setTimeout(() => clearInterval(flapTimer), Math.min(duration, 2500));
  }
  talkTimer = setTimeout(stopTalking, duration);
}

// Click = poke, drag = move, right click = menu. Clicks pass through empty space.
let down = null;
for (const el of [petEl, bubble]) {
  el.addEventListener("mouseenter", () => window.pet.hover(true));
  el.addEventListener("mouseleave", () => !down && window.pet.hover(false));
}
bubble.addEventListener("click", stopTalking);
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
  down.moved = true;
  window.pet.drag(dx, dy);
  down.x = event.screenX;
  down.y = event.screenY;
});
window.addEventListener("mouseup", () => {
  if (down && !down.moved) window.pet.tap();
  down = null;
  if (!petEl.matches(":hover") && !bubble.matches(":hover")) window.pet.hover(false);
});

window.pet.on("say", say);
window.pet.on("mood", (mood) => {
  base = mood;
  if (bubble.hidden) setMood(mood);
});
window.pet.on("look", (look) => {
  images = look.images || {};
  document.documentElement.classList.toggle("maomao", look.character === "maomao");
  volume = look.volume;
  const names = {
    hair: "--hair", hairShine: "--hair-shine", eyes: "--eyes", skin: "--skin", outfit: "--outfit", outfitDark: "--outfit-dark",
    collar: "--collar", sash: "--sash", leaf: "--leaf",
  };
  for (const [key, value] of Object.entries(look.colors || {})) {
    if (names[key]) document.documentElement.style.setProperty(names[key], value);
  }
  setMood(base);
});
window.pet.ready();
