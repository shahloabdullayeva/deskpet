const Anthropic = require("@anthropic-ai/sdk");

const TASKS = {
  morning: () => "Say good morning as he starts work.",
  howsYourDay: () => "Ask him how his day at work is going.",
  lunch: () => "Remind him to eat lunch.",
  water: () => "Remind him to drink water.",
  goodbye: () => "Work is over; tell him to wrap up and head home.",
  tap: () => "He just poked you on his desk. React cutely.",
  chatter: () => "Say a tiny random thing while sitting on his desk.",
  checking: (context) =>
    `He wrote "${context.text}" about ${context.minutes} minutes ago and then went quiet. Playfully remind him he said he'd check and still hasn't replied.`,
};

class Brain {
  constructor({ config, phrases, examples = [], style, env }) {
    this.config = config;
    this.examples = examples;
    this.phrases = phrases;
    this.style = style;
    this.claudeFor = config.brain?.useClaudeFor || [];
    this.client = env.anthropicKey ? new Anthropic({ apiKey: env.anthropicKey }) : null;
    this.last = {};
  }

  pick(kind) {
    const lines = (this.phrases[kind] || []).filter((line) => line && line.text);
    if (!lines.length) return { text: "🐾" };
    let index = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && index === this.last[kind]) index = (index + 1) % lines.length;
    this.last[kind] = index;
    return lines[index];
  }

  // Your own phrases (and recordings) by default; Claude only for the kinds listed in
  // config.brain.useClaudeFor, falling back to your phrases if it fails.
  async write(kind, context = {}) {
    if (!this.client || !this.claudeFor.includes(kind)) return this.pick(kind);
    try {
      const messages =
        kind === "reply"
          ? context.history
          : [{ role: "user", content: `${TASKS[kind] ? TASKS[kind](context) : `Write a "${kind}" message.`}\nReply with only the message.` }];
      const text = await this.ask(messages);
      return text ? { text } : this.pick(kind);
    } catch (error) {
      console.warn(`[brain] Claude failed, using your phrases: ${error.message}`);
      return this.pick(kind);
    }
  }

  async ask(messages) {
    const response = await this.client.beta.messages.create({
      model: this.config.brain?.model || "claude-opus-5-5",
      max_tokens: 1000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: this.system(),
      messages,
    });
    if (response.stop_reason === "refusal") return "";
    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }

  system() {
    const { me, him, petName } = this.config;
    const examples = Object.entries(this.phrases)
      .filter(([kind, lines]) => !kind.startsWith("_") && Array.isArray(lines))
      .flatMap(([, lines]) => lines.map((line) => line.text))
      .concat(this.examples)
      .map((text) => `- ${text.replace(/\s+/g, " ")}`)
      .join("\n");
    return [
      `You are ${petName}, a little anime desk pet that ${me} made for her boyfriend (she calls him "${him}").`,
      `You sit on his desk at work and text him on Telegram for her.`,
      `Write exactly the way ${me} texts: her words, slang, emoji, capitalization and message length.`,
      ``,
      `How she describes her texting style:`,
      this.style.trim(),
      ``,
      `Real messages she wrote:`,
      examples,
      ``,
      `Rules: one short message like a text (1-2 sentences). Sweet and playful, never guilt-tripping or controlling.`,
      `You are her desk pet, not ${me} herself: if he asks, say so, and for anything serious tell him to text her.`,
    ].join("\n");
  }
}

module.exports = { Brain };
