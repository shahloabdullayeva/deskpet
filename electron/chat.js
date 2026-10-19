const log = document.getElementById("log");
const input = document.getElementById("input");
const form = document.getElementById("form");
const send = document.getElementById("send");
const typing = document.getElementById("typing");
const panel = document.getElementById("panel");
let me = "her";
let pending = [];
const MAX_UPLOAD = 25_000_000;
const EMOJIS = "😂 🤣 😭 🥲 😅 😊 🙂 😉 😍 🥰 😘 😎 🤔 🙄 😏 😴 😤 😡 🥺 😳 😬 🤯 🤡 💀 👍 👎 👏 🙏 💪 👀 ❤️ 💔 🔥 ✨ 🎉 💯 ☕ 🍵 🥟 🍜 🌿 🍄 🐱 🌙 ☀️ 🌧️ 💤 📚".split(" ");
let lastDay = "";

function scrollDown() {
  log.scrollTop = log.scrollHeight;
}

function fileView(file) {
  if (file.type.startsWith("image/")) {
    const img = Object.assign(document.createElement("img"), { className: "pic", src: `maomao://files/${encodeURIComponent(file.file)}`, alt: file.name, title: file.name });
    img.onclick = () => window.chat.open(file.file);
    img.onload = scrollDown;
    return img;
  }
  const chip = Object.assign(document.createElement("button"), { type: "button", className: "file", title: "Open" });
  chip.append(Object.assign(document.createElement("b"), { textContent: file.name }), Object.assign(document.createElement("small"), { textContent: size(file.size) }));
  chip.onclick = () => window.chat.open(file.file);
  return chip;
}

function size(bytes = 0) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function showPending() {
  const box = document.getElementById("pending");
  box.textContent = "";
  box.hidden = !pending.length;
  pending.forEach((file, index) => {
    const item = Object.assign(document.createElement("div"), { className: "pend" });
    if (file.type.startsWith("image/")) item.append(Object.assign(document.createElement("img"), { src: file.preview }));
    else item.append(Object.assign(document.createElement("span"), { textContent: file.name }));
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "✕", title: "Remove" });
    remove.onclick = () => {
      URL.revokeObjectURL(file.preview);
      pending.splice(index, 1);
      showPending();
    };
    item.append(remove);
    box.append(item);
  });
}

async function attach(list) {
  for (const file of list) {
    if (pending.length >= 10) break;
    if (file.size > MAX_UPLOAD) {
      add({ role: "pet", text: `${file.name} is too big, 25 MB max`, at: Date.now() });
      continue;
    }
    pending.push({ name: file.name || "pasted.png", type: file.type, data: new Uint8Array(await file.arrayBuffer()), preview: URL.createObjectURL(file) });
  }
  showPending();
  input.focus();
}

function add({ role, text, at, files }) {
  const when = new Date(at || Date.now());
  const day = when.toDateString();
  if (day !== lastDay) {
    lastDay = day;
    const today = new Date().toDateString() === day;
    log.append(Object.assign(document.createElement("div"), { className: "day", textContent: today ? "Today" : when.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) }));
  }
  const bubble = document.createElement("div");
  bubble.className = `msg ${role}`;
  if (role === "her") bubble.dataset.from = `from ${me}`;
  bubble.textContent = text;
  for (const file of files || []) bubble.append(fileView(file));
  bubble.append(Object.assign(document.createElement("span"), { className: "time", textContent: when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
  log.append(bubble);
  scrollDown();
}

function grow() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
}

const PANELS = {
  memories: { title: "What she remembers", empty: "Nothing yet. Tell her about your day, what you like, your plans.", remove: "Forget", call: (id) => window.chat.forget(id) },
  reminders: { title: "Upcoming reminders", empty: 'None. Try "remind me at 3 to call mom".', remove: "Cancel", call: (id) => window.chat.cancel(id) },
};
let open = null;

function renderPanel(name, lists) {
  const spec = PANELS[name];
  const items = lists[name];
  document.getElementById("panel-title").textContent = spec.title;
  document.getElementById("panel-empty").textContent = items.length ? "" : spec.empty;
  const list = document.getElementById("panel-list");
  list.textContent = "";
  for (const item of items) {
    const text = document.createElement("span");
    text.textContent = item.text;
    if (item.when) text.append(Object.assign(document.createElement("small"), { textContent: item.when }));
    const remove = Object.assign(document.createElement("button"), { textContent: spec.remove });
    remove.onclick = async () => renderPanel(name, await spec.call(item.id));
    const row = document.createElement("li");
    row.append(text, remove);
    list.append(row);
  }
}

async function showPanel(name) {
  open = open === name ? null : name;
  for (const tab of document.querySelectorAll(".tab")) tab.classList.toggle("on", tab.dataset.panel === open);
  panel.hidden = !open;
  if (open) renderPanel(open, await window.chat.lists());
  else input.focus();
}

for (const tab of document.querySelectorAll(".tab")) tab.addEventListener("click", () => showPanel(tab.dataset.panel));
document.getElementById("panel-close").addEventListener("click", () => showPanel(open));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if ((!text && !pending.length) || send.disabled) return;
  const uploads = pending.map(({ name, type, data }) => ({ name, type, data }));
  pending.forEach((file) => URL.revokeObjectURL(file.preview));
  pending = [];
  showPending();
  input.value = "";
  grow();
  send.disabled = true;
  typing.hidden = false;
  scrollDown();
  try {
    await window.chat.send(text, uploads);
  } finally {
    typing.hidden = true;
    send.disabled = false;
    input.focus();
  }
});
input.addEventListener("input", grow);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
const emojis = document.getElementById("emojis");
for (const emoji of EMOJIS) {
  const button = Object.assign(document.createElement("button"), { type: "button", textContent: emoji });
  button.onclick = () => {
    const at = input.selectionStart ?? input.value.length;
    input.setRangeText(emoji, at, input.selectionEnd ?? at, "end");
    grow();
    input.focus();
  };
  emojis.append(button);
}
document.getElementById("emoji").addEventListener("click", () => {
  emojis.hidden = !emojis.hidden;
  input.focus();
});
const pick = document.getElementById("pick");
document.getElementById("attach").addEventListener("click", () => pick.click());
pick.addEventListener("change", () => {
  attach([...pick.files]);
  pick.value = "";
});
input.addEventListener("paste", (event) => {
  const files = [...(event.clipboardData?.files || [])];
  if (files.length) {
    event.preventDefault();
    attach(files);
  }
});
const drop = document.getElementById("drop");
let dragDepth = 0;
document.addEventListener("dragenter", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  dragDepth++;
  drop.hidden = false;
});
document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) drop.hidden = true;
});
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  attach([...event.dataTransfer.files]);
});

document.getElementById("close").addEventListener("click", () => window.chat.close());
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!emojis.hidden) emojis.hidden = true;
  else if (open) showPanel(open);
  else window.chat.close();
});

window.chat.onAdd(add);
window.chat.info().then((info) => {
  me = info.me;
  document.getElementById("name").textContent = info.petName;
  document.title = info.petName;
  input.placeholder = `Message ${info.petName}…`;
  const status = document.getElementById("status");
  const showFeeling = (feeling) => (status.textContent = info.online ? `online, feeling ${feeling}` : "offline, she can only use her saved lines");
  showFeeling(info.feeling);
  window.chat.onFeeling(showFeeling);
  status.classList.toggle("off", !info.online);
  for (const entry of info.history) add(entry);
  if (!info.history.length) add({ role: "pet", text: `${info.him && info.him !== "you" ? `hi ${info.him}` : "hi"}, it's me, ${info.petName}. talk to me whenever you want, I'll remember things and remind you of stuff too`, at: Date.now() });
});
