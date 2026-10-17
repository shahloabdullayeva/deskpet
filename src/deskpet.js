const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const { load } = require("./config");
const { localParts, isWorkTime, isDue, toMinutes } = require("./clock");
const { Brain, stripEmoji } = require("./brain");
const { Memory } = require("./memory");

const FACES = { sleepy: "sleepy", lonely: "pout", happy: "happy", calm: "idle" };
const LONELY_AFTER_MINUTES = 150;

const MOODS = { tap: "happy", reply: "happy", goodbye: "happy", morning: "happy", workingLate: "pout" };
const AWAY_AFTER_SECONDS = 5 * 60;
const WORKING_LATE_AFTER_MINUTES = 60;

class Deskpet {
  constructor() {
    const loaded = load();
    this.dir = loaded.dir;
    this.isExample = loaded.isExample;
    this.config = loaded.config;
    this.env = loaded.env;
    this.statePath = path.join(loaded.dataDir, "state.json");
    this.chatPath = path.join(loaded.dataDir, "chat.json");
    this.desk = this.readChat();
    this.memory = new Memory(loaded.dataDir, loaded.config.timezone);
    this.brain = new Brain(loaded);
    this.events = new EventEmitter();
    this.idleSeconds = () => 0;
    this.state = this.readState();
    this.mood = null;
    this.lastChatter = Date.now();
    this.feeling = null;
    this.startedAt = Date.now();
  }

  atComputer() {
    return this.idleSeconds() < AWAY_AFTER_SECONDS;
  }

  workingLate(parts = this.now()) {
    const work = this.config.workHours;
    return work.days.includes(parts.weekday) && parts.minutes >= toMinutes(work.end) && this.atComputer();
  }

  feel(parts = this.now()) {
    if (this.workingLate(parts)) return { feeling: "calm", why: "they're still working after their usual hours" };
    if (!isWorkTime(parts, this.config.workHours)) return { feeling: "sleepy", why: "it's outside work hours" };
    const minutes = Math.round((Date.now() - Math.max(this.state.lastTalk || 0, this.startedAt)) / 60_000);
    if (this.state.lastTalk && Date.now() - this.state.lastTalk < 20 * 60_000) return { feeling: "happy", why: "you just talked" };
    if (minutes >= LONELY_AFTER_MINUTES) return { feeling: "lonely", why: `nobody has talked to you for about ${Math.round(minutes / 60)} hours` };
    return { feeling: "calm", why: "a normal moment of the day" };
  }

  updateFeeling() {
    const { feeling } = this.feel();
    if (feeling !== this.feeling) {
      this.feeling = feeling;
      this.events.emit("feeling", feeling);
    }
    const mood = FACES[feeling];
    if (mood !== this.mood) this.events.emit("mood", (this.mood = mood));
  }

  touch() {
    this.state.lastTalk = Date.now();
    this.saveState();
    this.updateFeeling();
  }

  afterCall(minutes) {
    return this.say("afterCall", { minutes });
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
    } catch {
      return { day: null, fired: [] };
    }
  }

  readChat() {
    try {
      return JSON.parse(fs.readFileSync(this.chatPath, "utf8")).map((entry) => ({ ...entry, text: stripEmoji(entry.text) }));
    } catch {
      return [];
    }
  }

  addToChat(role, text) {
    const entry = { role, text: stripEmoji(text), at: Date.now() };
    this.desk = [...this.desk, entry].slice(-300);
    fs.mkdirSync(path.dirname(this.chatPath), { recursive: true });
    fs.writeFileSync(this.chatPath, JSON.stringify(this.desk));
    this.events.emit("chat", entry);
    return entry;
  }

  async deskChat(text) {
    this.addToChat("him", text);
    this.touch();
    const reply = await this.brain.chat(this.desk.slice(-40), this.tools());
    this.addToChat("pet", reply.text);
    return reply;
  }

  tools() {
    const memory = this.memory;
    return {
      context: () => {
        const parts = this.now();
        const day = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: this.config.timezone || undefined });
        return [
          `Right now for them it is ${day} ${parts.date} ${parts.hhmm}${this.config.timezone ? ` (${this.config.timezone})` : ""}.`,
          `You're feeling ${this.feel(parts).feeling} right now, because ${this.feel(parts).why}. Let it color how you talk a little, without making a big deal of it.`,
          ``,
          `What you remember about them:`,
          memory.memories.length ? memory.memories.map((m) => `- [${m.id}] ${m.text}`).join("\n") : "- (nothing yet)",
          ``,
          `Their upcoming reminders:`,
          memory.reminders.length ? memory.reminders.map((r) => `- [${r.id}] ${memory.format(r.due)}: ${r.text}`).join("\n") : "- (none)",
        ].join("\n");
      },
      run: (name, input) => {
        if (name === "remember") return `Saved as memory ${memory.remember(input.text).id}.`;
        if (name === "forget") return memory.forget(input.id) ? "Forgotten." : "No memory with that id.";
        if (name === "set_reminder") {
          const reminder = memory.remind(input.text, { at: input.at, inMinutes: input.in_minutes });
          return `Reminder ${reminder.id} set for ${memory.format(reminder.due)}.`;
        }
        if (name === "list_reminders") {
          return memory.reminders.map((r) => `[${r.id}] ${memory.format(r.due)}: ${r.text}`).join("\n") || "No reminders.";
        }
        if (name === "cancel_reminder") return memory.cancel(input.id) ? "Cancelled." : "No reminder with that id.";
        throw new Error(`Unknown tool ${name}`);
      },
    };
  }

  saveState() {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  start() {
    this.running = true;
    this.tick();
    this.timer = setInterval(() => this.tick().catch((error) => console.error("[tick]", error)), 20_000);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
  }

  now() {
    return localParts(new Date(), this.config.timezone);
  }

  async say(kind, context = {}, { chime = true } = {}) {
    const line = await this.brain.write(kind, context);
    const text = stripEmoji(line.text);
    this.events.emit("say", { text, chime, mood: MOODS[kind] || "talk" });
    if (kind !== "tap") this.addToChat("pet", text);
    return { ...line, text };
  }

  tap() {
    return this.say("tap", {});
  }

  grace(checkin) {
    if (checkin.kind === "morning") return Math.max(10, toMinutes(this.config.workHours.end) - toMinutes(checkin.time));
    return checkin.kind === "goodbye" ? 120 : 90;
  }

  async tick() {
    const parts = this.now();
    const work = this.config.workHours;
    if (this.state.day !== parts.date) Object.assign(this.state, { day: parts.date, fired: [] });

    this.updateFeeling();
    const here = this.atComputer();

    for (const checkin of this.config.checkins || []) {
      const key = `${checkin.time} ${checkin.kind}`;
      if (this.state.fired.includes(key) || !here || !isDue(parts, work, checkin.time, this.grace(checkin))) continue;
      this.state.fired.push(key);
      this.saveState();
      await this.say(checkin.kind);
    }

    if (here && this.workingLate(parts) && parts.minutes - toMinutes(work.end) >= WORKING_LATE_AFTER_MINUTES && !this.state.fired.includes("workingLate")) {
      this.state.fired.push("workingLate");
      this.saveState();
      await this.say("workingLate", { minutes: parts.minutes - toMinutes(work.end) });
    }

    for (const reminder of this.memory.due()) {
      const text = `Reminder: ${stripEmoji(reminder.text)}`;
      this.events.emit("say", { text, chime: true, mood: "talk" });
      this.addToChat("pet", text);
    }

    const chatter = (this.config.pet?.chatterMinutes || 0) * 60_000;
    if (chatter && here && this.feeling !== "sleepy" && Date.now() - this.lastChatter > chatter) {
      this.lastChatter = Date.now();
      await this.say("chatter", { memory: this.tools().context() });
    }
  }
}

module.exports = { Deskpet };
