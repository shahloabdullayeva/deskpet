const $ = (id) => document.getElementById(id);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHECKINS = { morning: "Good morning", howsYourDay: "How's your day", lunch: "Lunch reminder", water: "Drink water", goodbye: "Home time" };
const FIELDS = ["name", "petName", "character", "size", "chatterMinutes", "anthropicKey", "talksLike", "style", "knows", "meTimezone", "start", "end", "timezone"];
let form;

function fill(values) {
  form = values;
  for (const id of FIELDS) $(id).value = values[id] || "";
  $("sound").checked = values.sound;
  $("wander").checked = values.wander;
  $("breaks").checked = values.breaks;
  $("health").checked = values.health;
  $("peek").checked = values.peek;

  $("days").textContent = "";
  for (const [index, day] of DAYS.entries()) {
    const box = Object.assign(document.createElement("input"), { type: "checkbox", value: index, checked: values.days.includes(index) });
    const label = document.createElement("label");
    label.append(box, day);
    $("days").append(label);
  }

  $("checkins").textContent = "";
  for (const [kind, title] of Object.entries(CHECKINS)) {
    const item = values.checkins[kind];
    const row = Object.assign(document.createElement("div"), { className: "checkin" });
    const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: item.on });
    const time = Object.assign(document.createElement("input"), { type: "time", value: item.time });
    box.dataset.kind = kind;
    time.dataset.kind = kind;
    const label = document.createElement("label");
    label.append(box, title);
    row.append(label, time);
    $("checkins").append(row);
  }
}

function collect() {
  const values = { ...form };
  for (const id of FIELDS) values[id] = $(id).value;
  values.sound = $("sound").checked;
  values.wander = $("wander").checked;
  values.breaks = $("breaks").checked;
  values.health = $("health").checked;
  values.peek = $("peek").checked;
  values.days = [...$("days").querySelectorAll("input:checked")].map((box) => Number(box.value));
  values.checkins = {};
  for (const kind of Object.keys(CHECKINS)) {
    values.checkins[kind] = {
      on: $("checkins").querySelector(`input[type=checkbox][data-kind=${kind}]`).checked,
      time: $("checkins").querySelector(`input[type=time][data-kind=${kind}]`).value || "12:00",
    };
  }
  return values;
}

$("save").addEventListener("click", async () => {
  $("save").disabled = true;
  $("saved").textContent = "Saving…";
  await window.settings.save(collect());
});
$("cancel").addEventListener("click", () => window.settings.close());
$("close").addEventListener("click", () => window.settings.close());

window.settings.read().then((values) => {
  fill(values);
  if (!values.name) $("sub").textContent = "Welcome! Fill this in once and she's ready.";
});
