const fs = require("fs");
const path = require("path");
const { localParts } = require("./clock");

class Memory {
  constructor(dataDir, timeZone) {
    this.file = path.join(dataDir, "memory.json");
    this.timeZone = timeZone;
    try {
      Object.assign(this, { memories: [], reminders: [], next: 1 }, JSON.parse(fs.readFileSync(this.file, "utf8")));
    } catch {
      Object.assign(this, { memories: [], reminders: [], next: 1 });
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ memories: this.memories, reminders: this.reminders, next: this.next }, null, 2));
  }

  remember(text) {
    const memory = { id: this.next++, text: String(text).trim(), at: Date.now() };
    this.memories.push(memory);
    this.memories = this.memories.slice(-200);
    this.save();
    return memory;
  }

  forget(id) {
    const before = this.memories.length;
    this.memories = this.memories.filter((memory) => memory.id !== Number(id));
    this.save();
    return before !== this.memories.length;
  }

  remind(text, { at, inMinutes } = {}) {
    const due = inMinutes != null ? Date.now() + Number(inMinutes) * 60_000 : zonedToEpoch(at, this.timeZone);
    if (!Number.isFinite(due)) throw new Error(`I couldn't understand the time "${at}". Use YYYY-MM-DD HH:MM.`);
    if (due < Date.now() - 60_000) throw new Error("That time is already in the past.");
    const reminder = { id: this.next++, text: String(text).trim(), due };
    this.reminders.push(reminder);
    this.save();
    return reminder;
  }

  cancel(id) {
    const before = this.reminders.length;
    this.reminders = this.reminders.filter((reminder) => reminder.id !== Number(id));
    this.save();
    return before !== this.reminders.length;
  }

  due(now = Date.now()) {
    const ready = this.reminders.filter((reminder) => reminder.due <= now);
    if (ready.length) {
      this.reminders = this.reminders.filter((reminder) => reminder.due > now);
      this.save();
    }
    return ready;
  }

  format(ms) {
    const parts = localParts(new Date(ms), this.timeZone);
    return `${parts.date} ${parts.hhmm}`;
  }
}

function zonedToEpoch(text, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(text || "").trim());
  if (!match) return NaN;
  const [, y, mo, d, h, mi] = match.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (ms) => {
    const p = localParts(new Date(ms), timeZone);
    const [py, pm, pd] = p.date.split("-").map(Number);
    return Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60) - ms;
  };
  const first = guess - offset(guess);
  return guess - offset(first);
}

module.exports = { Memory, zonedToEpoch };
