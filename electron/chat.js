const log = document.getElementById("log");
const input = document.getElementById("input");
const form = document.getElementById("form");
const send = document.getElementById("send");
const typing = document.getElementById("typing");
const panel = document.getElementById("panel");
let me = "her";
let lastDay = "";

function scrollDown() {
  log.scrollTop = log.scrollHeight;
}

function add({ role, text, at }) {
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
  if (!text || send.disabled) return;
  input.value = "";
  grow();
  send.disabled = true;
  typing.hidden = false;
  scrollDown();
  try {
    await window.chat.send(text);
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
document.getElementById("close").addEventListener("click", () => window.chat.close());
document.addEventListener("keydown", (event) => event.key === "Escape" && (open ? showPanel(open) : window.chat.close()));

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
  if (!info.history.length) add({ role: "pet", text: `hi ${info.him}, it's me, ${info.petName}. talk to me whenever you want, I'll remember things and remind you of stuff too`, at: Date.now() });
});
