const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const { load } = require("./config");
const { localParts, isWorkTime, isDue } = require("./clock");
const { saidChecking } = require("./checking");
const { Telegram } = require("./telegram");
const { Brain } = require("./brain");

const MOODS = { tap: "happy", reply: "happy", goodbye: "happy", morning: "happy", checking: "pout" };

class Deskpet {
  constructor() {
    const loaded = load();
    this.dir = loaded.dir;
    this.isExample = loaded.isExample;
    this.config = loaded.config;
    this.env = loaded.env;
    this.statePath = path.join(loaded.dataDir, "state.json");
    this.brain = new Brain(loaded);
    this.telegram = loaded.env.telegramToken ? new Telegram(loaded.env.telegramToken) : null;
    this.events = new EventEmitter();
    this.waiting = new Map();
    this.history = [];
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
    if (pet) this.events.emit("say", { text: line.text, chime, mood: MOODS[kind] || "talk" });
    if (chatId && this.telegram) await this.telegram.sendText(chatId, line.text, replyTo);
    return line;
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
      await this.say("chatter", {}, { chime: false });
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
        if (!this.petRunning) return this.telegram.sendText(chatId, "The pet isn't open on his computer right now 🥺");
        this.events.emit("say", { text, chime: true, mood: "happy" });
        return this.telegram.sendText(chatId, `${this.config.petName} said it on his desk 🐾`);
      }
    }
  }

  async chatWithHim(chatId, text) {
    this.history.push({ role: "user", content: text });
    this.history = this.history.slice(-12);
    if (this.history[0].role !== "user") this.history.shift();
    if (this.config.telegram?.forwardHisMessagesToMe && this.state.me?.chatId) {
      await this.telegram.sendText(this.state.me.chatId, `💬 ${this.config.him} told ${this.config.petName}: ${text}`);
    }
    const line = await this.say("reply", { history: this.history }, { chatId });
    this.history.push({ role: "assistant", content: line.text });
  }

  async command(message, text, { isMe, isPrivate }) {
    const chatId = message.chat.id;
    const [command, ...args] = text.trim().split(/\s+/);
    const name = command.split("@")[0].toLowerCase();

    if (name === "/start" || name === "/help") {
      return this.telegram.sendText(
        chatId,
        `Hi, I'm ${this.config.petName} 🐾\n\nTo set me up, each of you sends me once in private:\n/pair <code> me  (her)\n/pair <code> him  (him)\n\nShe can then:\n/test <kind> — send a check-in now (morning, howsYourDay, lunch, water, goodbye, checking)\n/status — see what I'm up to\nor just send me a message and I'll show it on his desk.`
      );
    }

    if (name === "/pair") {
      if (!isPrivate) return this.telegram.sendText(chatId, "Send /pair to me in a private chat 🙈");
      const [code, who] = args;
      if (!this.env.pairCode || code !== this.env.pairCode || !["me", "him"].includes(who)) {
        return this.telegram.sendText(chatId, "Hmm, that code doesn't look right.");
      }
      this.state[who] = { userId: message.from.id, chatId, name: message.from.first_name };
      this.saveState();
      return this.telegram.sendText(chatId, who === "me" ? "Got you 💕 I'll tell you when he talks to me." : `Hiii ${this.config.him} 🥰 I'll keep you company at work.`);
    }

    if (!isMe) return;

    if (name === "/status") {
      const parts = this.now();
      return this.telegram.sendText(
        chatId,
        [
          `Paired: you ${this.state.me ? "✅" : "❌"} · him ${this.state.him ? "✅" : "❌"}`,
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
        await this.telegram.sendText(chatId, "He hasn't paired yet, so here's a preview 👇");
        return this.say(kind, { text: "checking", minutes: 20 }, { chatId, pet: false });
      }
      await this.say(kind, { text: "checking", minutes: 20 }, { chatId: this.state.him.chatId });
      return this.telegram.sendText(chatId, `Sent "${kind}" to him ✅`);
    }
  }
}

module.exports = { Deskpet };
