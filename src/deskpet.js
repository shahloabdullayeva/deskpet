const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const { load } = require("./config");
const { localParts, isWorkTime, isDue } = require("./clock");
const { saidChecking } = require("./checking");
const { Telegram } = require("./telegram");
const { Brain, stripEmoji } = require("./brain");
const { Memory } = require("./memory");

const MOODS = { tap: "happy", reply: "happy", goodbye: "happy", morning: "happy", checking: "pout" };

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
    this.telegram = loaded.env.telegramToken ? new Telegram(loaded.env.telegramToken) : null;
    this.events = new EventEmitter();
    this.waiting = new Map();
    this.state = this.readState();
    this.mood = null;
    this.lastChatter = Date.now();
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
    } catch {
      return { offset: 0, me: null, him: null, day: null, fired: [], nudges: 0 };
    }
  }

  readChat() {
    try {
      return JSON.parse(fs.readFileSync(this.chatPath, "utf8"));
    } catch {
      return [];
    }
  }

  // The chat: everything she says on his screen and everything he types to her.
  addToChat(role, text) {
    const entry = { role, text: stripEmoji(text), at: Date.now() };
    this.desk = [...this.desk, entry].slice(-300);
    fs.mkdirSync(path.dirname(this.chatPath), { recursive: true });
    fs.writeFileSync(this.chatPath, JSON.stringify(this.desk));
    this.events.emit("chat", entry);
    return entry;
  }

  // He talks to her, on his screen or on Telegram; both share one conversation and one memory.
  async deskChat(text) {
    this.addToChat("him", text);
    if (this.telegram && this.config.telegram?.forwardHisMessagesToMe && this.state.me?.chatId) {
      this.telegram.sendText(this.state.me.chatId, `${this.config.him} told ${this.config.petName}: ${text}`).catch(() => {});
    }
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
          `Right now for him it is ${day} ${parts.date} ${parts.hhmm}${this.config.timezone ? ` (${this.config.timezone})` : ""}.`,
          ``,
          `What you remember about him:`,
          memory.memories.length ? memory.memories.map((m) => `- [${m.id}] ${m.text}`).join("\n") : "- (nothing yet)",
          ``,
          `His upcoming reminders:`,
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

  get petRunning() {
    return this.events.listenerCount("say") > 0;
  }

  start({ bot = true } = {}) {
    this.running = true;
    this.tick();
    this.timer = setInterval(() => this.tick().catch((error) => console.error("[tick]", error)), 20_000);
    if (bot && this.telegram) this.poll();
    else if (bot) console.log("[deskpet] no TELEGRAM_BOT_TOKEN in .env, running without Telegram");
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.abort?.abort();
  }

  async poll() {
    let backoff = 1000;
    while (this.running) {
      try {
        this.abort = new AbortController();
        const updates = await this.telegram.getUpdates(this.state.offset, this.abort.signal);
        for (const update of updates) {
          this.state.offset = update.update_id + 1;
          if (update.message) await this.handle(update.message).catch((error) => console.error("[message]", error));
        }
        if (updates.length) this.saveState();
        backoff = 1000;
      } catch (error) {
        if (!this.running) return;
        console.error(`[telegram] ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
  }

  now() {
    return localParts(new Date(), this.config.timezone);
  }

  // Compose a line, show it on the desk (with a chime unless quiet) and/or send it on Telegram.
  async say(kind, context = {}, { chatId, replyTo, pet = true, chime = true } = {}) {
    const line = await this.brain.write(kind, context);
    const text = stripEmoji(line.text);
    if (pet) {
      this.events.emit("say", { text, chime, mood: MOODS[kind] || "talk" });
      if (kind !== "tap") this.addToChat("pet", text);
    }
    if (chatId && this.telegram) await this.telegram.sendText(chatId, text, replyTo);
    return { ...line, text };
  }

  tap() {
    return this.say("tap", {});
  }

  async tick() {
    const parts = this.now();
    const work = this.config.workHours;
    if (this.state.day !== parts.date) Object.assign(this.state, { day: parts.date, fired: [], nudges: 0 });

    const mood = isWorkTime(parts, work) ? "idle" : "sleepy";
    if (mood !== this.mood) this.events.emit("mood", (this.mood = mood));

    for (const checkin of this.config.checkins || []) {
      const key = `${checkin.time} ${checkin.kind}`;
      if (this.state.fired.includes(key) || !isDue(parts, work, checkin.time)) continue;
      this.state.fired.push(key);
      this.saveState();
      await this.say(checkin.kind, {}, { chatId: this.state.him?.chatId });
    }

    for (const reminder of this.memory.due()) {
      const text = `Reminder: ${stripEmoji(reminder.text)}`;
      this.events.emit("say", { text, chime: true, mood: "talk" });
      this.addToChat("pet", text);
      if (this.telegram && this.state.him?.chatId) await this.telegram.sendText(this.state.him.chatId, text).catch(() => {});
    }

    const rules = this.config.checking;
    for (const [chatId, wait] of this.waiting) {
      const minutes = Math.round((Date.now() - wait.at) / 60_000);
      if (minutes < rules.nudgeAfterMinutes) continue;
      this.waiting.delete(chatId);
      if (mood !== "idle" || this.state.nudges >= rules.maxNudgesPerDay) continue;
      this.state.nudges += 1;
      this.saveState();
      await this.say("checking", { text: wait.text, minutes }, { chatId, replyTo: wait.messageId });
    }

    const chatter = (this.config.pet?.chatterMinutes || 0) * 60_000;
    if (chatter && mood === "idle" && this.petRunning && Date.now() - this.lastChatter > chatter) {
      this.lastChatter = Date.now();
      await this.say("chatter", { memory: this.tools().context() });
    }
  }

  async handle(message) {
    const text = message.text || message.caption || "";
    const from = message.from?.id;
    const chatId = message.chat.id;
    const isPrivate = message.chat.type === "private";
    const isMe = from && from === this.state.me?.userId;
    const isHim = from && from === this.state.him?.userId;

    if (text.startsWith("/")) return this.command(message, text, { isMe, isPrivate });

    if (isHim) {
      this.waiting.delete(chatId);
      if (saidChecking(text, this.config.checking.words)) {
        this.waiting.set(chatId, { at: Date.now(), text, messageId: message.message_id });
      }
      if (isPrivate && text) return this.chatWithHim(chatId, text);
      return;
    }

    if (isMe && isPrivate) {
      if (text) {
        if (!this.petRunning) return this.telegram.sendText(chatId, "The pet isn't open on his computer right now.");
        this.events.emit("say", { text: stripEmoji(text), chime: true, mood: "happy" });
        this.addToChat("her", text);
        return this.telegram.sendText(chatId, `${this.config.petName} showed it on his screen.`);
      }
    }
  }

  async chatWithHim(chatId, text) {
    const reply = await this.deskChat(text);
    await this.telegram.sendText(chatId, reply.text);
  }

  async command(message, text, { isMe, isPrivate }) {
    const chatId = message.chat.id;
    const [command, ...args] = text.trim().split(/\s+/);
    const name = command.split("@")[0].toLowerCase();

    if (name === "/start" || name === "/help") {
      return this.telegram.sendText(
        chatId,
        `Hi, I'm ${this.config.petName}.\n\nTo set me up, each of you sends me once in private:\n/pair <code> me  (her)\n/pair <code> him  (him)\n\nShe can then:\n/test <kind> — send a check-in now (morning, howsYourDay, lunch, water, goodbye, checking)\n/status — see what I'm up to\nor just send me a message and I'll show it on his desk.`
      );
    }

    if (name === "/pair") {
      if (!isPrivate) return this.telegram.sendText(chatId, "Send /pair to me in a private chat.");
      const [code, who] = args;
      if (!this.env.pairCode || code !== this.env.pairCode || !["me", "him"].includes(who)) {
        return this.telegram.sendText(chatId, "Hmm, that code doesn't look right.");
      }
      this.state[who] = { userId: message.from.id, chatId, name: message.from.first_name };
      this.saveState();
      return this.telegram.sendText(chatId, who === "me" ? "Got you. I'll tell you when he talks to me." : `Hi ${this.config.him}, I'll keep you company at work.`);
    }

    if (!isMe) return;

    if (name === "/status") {
      const parts = this.now();
      return this.telegram.sendText(
        chatId,
        [
          `Paired: you ${this.state.me ? "yes" : "no"}, him ${this.state.him ? "yes" : "no"}`,
          `Pet window open: ${this.petRunning ? "yes" : "no"}`,
          `Local time ${parts.hhmm}, ${isWorkTime(parts, this.config.workHours) ? "work hours" : "off work"}`,
          `Check-ins sent today: ${this.state.fired.length}/${(this.config.checkins || []).length}`,
          `"Checking" nudges today: ${this.state.nudges}/${this.config.checking.maxNudgesPerDay}`,
          `Claude: ${this.brain.client ? `on for ${this.brain.claudeFor.join(", ")}` : "off"}`,
        ].join("\n")
      );
    }

    if (name === "/test") {
      const kind = args[0] || "howsYourDay";
      if (!this.state.him) {
        await this.telegram.sendText(chatId, "He hasn't paired yet, so here's a preview:");
        return this.say(kind, { text: "checking", minutes: 20 }, { chatId, pet: false });
      }
      await this.say(kind, { text: "checking", minutes: 20 }, { chatId: this.state.him.chatId });
      return this.telegram.sendText(chatId, `Sent "${kind}" to him.`);
    }
  }
}

module.exports = { Deskpet };
