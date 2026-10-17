const $ = (id) => document.getElementById(id);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHECKINS = { morning: "Good morning", howsYourDay: "How's your day", lunch: "Lunch reminder", water: "Drink water", goodbye: "Home time" };
const FIELDS = ["mode", "name", "petName", "character", "size", "background", "chatterMinutes", "anthropicKey", "talksLike", "style", "start", "end", "timezone", "telegramToken"];
let form;

function fill(values) {
  form = values;
  for (const id of FIELDS) $(id).value = values[id] || "";
  $("sound").checked = values.sound;
  $("wander").checked = values.wander;
  $("pair-hint").textContent = `/pair ${values.pairCode} him`;

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
  if ($("mode").value === "phone" && !$("telegramToken").value.trim()) {
    $("saved").textContent = "Phone mode needs a Telegram bot token.";
    return;
  }
  $("save").disabled = true;
  $("saved").textContent = "Saving…";
  await window.settings.save(collect());
});
$("cancel").addEventListener("click", () => window.settings.close());
$("close").addEventListener("click", () => window.settings.close());

function showMode() {
  const phone = $("mode").value === "phone";
  $("about").textContent = phone ? "About him" : "About you";
  $("name-label").textContent = phone ? "His name" : "Your name";
  $("name").placeholder = phone ? "What should she call him?" : "What should she call you?";
  $("mode-hint").textContent = phone
    ? "Keep this computer on and online during his day. Fill in the Telegram bot token below, and use his work hours and his time zone. He sends the bot the pair code once; his chats are saved on this computer."
    : "She sits on this screen. Telegram below is optional.";
  document.querySelector("#telegramToken").closest("section").querySelector("h2").textContent = phone ? "Telegram (needed)" : "Telegram (optional)";
}
$("mode").addEventListener("change", showMode);

window.settings.read().then((values) => {
  fill(values);
  showMode();
  if (!values.name) $("sub").textContent = "Welcome! Fill this in once and she's ready.";
});
