const Anthropic = require("@anthropic-ai/sdk");

const TASKS = {
  morning: () => "Say good morning as they start work.",
  howsYourDay: () => "Ask how their day at work is going.",
  lunch: () => "Remind them to eat lunch.",
  water: () => "Remind them to drink water.",
  goodbye: () => "Work is over; tell them to wrap up and head home.",
  tap: () => "They just poked you on their screen. React like you were busy with something more important: dry, a little annoyed, maybe a small roast. Never cute.",
  chatter: (context) =>
    `Send one short casual message out of nowhere, like a friend texting during the day: ask how something you remember is going, comment on the time of day, or make a dry little observation about them. One or two short sentences.\n\n${context.memory || ""}`,
  afterCall: (context) =>
    `They just finished a work call of about ${context.minutes} minutes. Casually ask how it went, for example whether things got settled. One short sentence.`,
  roast: (context) =>
    `Out of nowhere, roast them a little, the way Maomao judges people who don't take care of themselves: their posture, how long they've been staring at the screen, their snacking, their sleep, their life choices, or something you remember about them. It's ${context.time} on a ${context.day}. Dry and short, affectionate underneath, never actually mean or about their looks. One sentence, maybe two.\n\n${context.memory || ""}`,
  workingLate: (context) =>
    `Their work day ended about ${context.minutes} minutes ago but they are still at the computer. Gently tease them for staying late and tell them not to stay too long. One short sentence.`,
};

const FALLBACK = {
  goToSleep: [{ text: "fine. wake me if something's on fire" }, { text: "finally. goodnight" }, { text: "sleeping. don't touch my herbs" }],
  wakeUp: [{ text: "hm. i'm up. what" }, { text: "you woke me. this better be good" }, { text: "i was dreaming about mushrooms. what is it" }],
  alreadyAsleep: [{ text: "i'm already asleep. obviously" }, { text: "zzz. still asleep" }],
  alreadyAwake: [{ text: "i'm awake. look at me" }, { text: "i'm already up" }],
  annoyed: [{ text: "can you make up your mind. i'm not a light switch" }, { text: "awake, asleep, awake. no. i'm staying like this" }, { text: "do that again and i'm putting something in your tea" }],
  refuse: [{ text: "no." }, { text: "not listening." }, { text: "ask me later." }],
  sleepyFood: [{ text: "zzz… later" }, { text: "mm. leave it there, i'll eat it when i'm up" }],
  fed_tea: [{ text: "ah. warm. you're useful sometimes" }, { text: "good tea. not poisoned, sadly" }, { text: "jasmine? fine. you can stay" }],
  fed_dumpling: [{ text: "mm. food. finally someone gets it" }, { text: "pork and cabbage. acceptable" }, { text: "i'll allow it" }],
  fed_herb: [{ text: "is this angelica? you know me" }, { text: "fresh. where did you even find this" }, { text: "good for the stomach. bad for your breath. i'll take it" }],
  fed_mushroom: [{ text: "wait. this is poisonous. thank you" }, { text: "my tongue's going numb. perfect" }, { text: "oh, this one makes your heart race. i love it" }],
  welcomeBack: [{ text: "oh, you're back" }, { text: "there you are" }, { text: "took you long enough" }, { text: "welcome back. i didn't touch anything" }],
  roast: [
    { text: "you've been staring at that screen like it owes you money" },
    { text: "sit up. your spine is filing a complaint" },
    { text: "when did you last drink water. that wasn't a question, it was a diagnosis" },
    { text: "i've seen corpses with better posture" },
    { text: "you sigh a lot for someone who chose this" },
    { text: "your face says you've read the same line four times" },
    { text: "i could make a tonic for whatever this is. it would taste terrible. you'd deserve it" },
    { text: "impressive. you've done almost nothing for a while now" },
    { text: "coffee is not a food group. i checked" },
    { text: "you look like you slept four hours. don't tell me, i don't want to be right" },
    { text: "blink. you're drying out like a herb on a rack" },
    { text: "if stress was medicine you'd be immortal" },
    { text: "i'm not saying you're slow. i'm saying i've watched mushrooms grow faster" },
    { text: "keep frowning like that and it stays. i've seen the cases" },
    { text: "you work like someone who's never been poisoned. lucky" },
    { text: "that's a lot of tabs for one brain" },
    { text: "the court physician would be worried about you. i'm just amused" },
    { text: "stand up. walk. you're not a houseplant, even if you act like one" },
    { text: "you snack like nobody's watching. i'm watching" },
    { text: "you call that a break? i've had longer blinks" },
    { text: "honestly, i'd prescribe you a nap and a personality" },
    { text: "you're doing fine. by your standards" },
    { text: "i've tested poisons on myself with more caution than you write emails" },
    { text: "stop chewing your lip. it's not lunch" },
    { text: "you type like the keyboard insulted your family" },
  ],
  thrown: [{ text: "rude. i'm a trained apothecary, not a ball" }, { text: "throw me again and i'm seasoning your tea" }, { text: "my herbs. you scattered my herbs" }, { text: "wow. very mature" }, { text: "that's going in my notes. under 'people to poison'" }],
  dropped: [{ text: "put me down gently next time" }, { text: "do i look like luggage" }, { text: "hands. off" }, { text: "fine. here's good. i guess" }],
  bigger: [{ text: "finally, a size that matches my importance" }, { text: "yes. bigger. you need supervising" }, { text: "good. now you can see me judging you" }],
  smaller: [{ text: "shrinking me won't make me quieter" }, { text: "smaller. like your attention span" }, { text: "fine. i'll judge you from down here" }],
  fedAngry: [{ text: "you think food fixes this? ...fine. it does a little" }, { text: "bribery. it works. don't tell anyone" }],
  workingLate: [{ text: "still here? don't stay too late" }, { text: "working late again? go home soon ok" }],
  afterCall: [{ text: "how did the call go? did it get settled?" }, { text: "call's done. everything okay?" }, { text: "that was a long one. how did it go?" }],
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
    const lines = (this.phrases[kind] || FALLBACK[kind] || []).filter((line) => line && line.text);
    if (!lines.length) return { text: "hi" };
    let index = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && index === this.last[kind]) index = (index + 1) % lines.length;
    this.last[kind] = index;
    return lines[index];
  }

  async write(kind, context = {}) {
    if (!this.client || !(this.claudeFor.includes(kind) || ["chatter", "roast", "afterCall", "workingLate"].includes(kind))) return this.pick(kind);
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

  async chat(history, tools) {
    if (!this.client) return { text: this.pick("reply").text, offline: true };
    try {
      const messages = toMessages(history, this.config.me);
      const system = [{ type: "text", text: this.system() }, { type: "text", text: tools.context() }];
      for (let round = 0; round < 6; round++) {
        const response = await this.client.beta.messages.create({
          model: this.config.brain?.model || "claude-opus-5-5",
          max_tokens: 4000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system,
          tools: TOOLS,
          messages,
        });
        if (response.stop_reason === "refusal") return { text: "hmm, let's talk about something else" };
        if (response.stop_reason !== "tool_use") return { text: textOf(response) || "hm?" };
        messages.push({ role: "assistant", content: response.content });
        const results = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          try {
            results.push({ type: "tool_result", tool_use_id: block.id, content: String(tools.run(block.name, block.input || {})) });
          } catch (error) {
            results.push({ type: "tool_result", tool_use_id: block.id, content: error.message, is_error: true });
          }
        }
        messages.push({ role: "user", content: results });
      }
      return { text: "okay, done" };
    } catch (error) {
      console.warn(`[brain] chat failed: ${error.message}`);
      return { text: "my brain isn't connecting right now, try again in a bit?", offline: true };
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
    return stripEmoji(textOf(response));
  }

  system() {
    const { me, him, petName } = this.config;
    const user = him && him !== "you" ? him : "the user";
    const maomao = (this.config.pet?.character || "maomao") === "maomao";
    const examples = Object.entries(this.phrases)
      .filter(([kind, lines]) => !kind.startsWith("_") && Array.isArray(lines))
      .flatMap(([, lines]) => lines.map((line) => line.text))
      .concat(this.examples)
      .map((text) => `- ${text.replace(/\s+/g, " ")}`)
      .join("\n");
    const voice = me
      ? [
          `${me} made you for ${user}. Write exactly the way ${me} texts: their words, slang, capitalization and message length.`,
          this.style.trim() ? `How ${me} describes their texting style:\n${this.style.trim()}` : ``,
          `Messages ${me} wrote:\n${examples}`,
          `You are ${me}'s desk pet, not ${me}: if asked, say so, and for anything serious tell ${user} to text ${me}.`,
          `Messages marked [from ${me}] are ones ${me} sent personally.`,
        ]
      : [
          `Talk like a close, warm friend texting: casual, short, a bit playful.`,
          this.style.trim() ? `How ${user} wants you to talk:\n${this.style.trim()}` : ``,
          `Example lines in your voice:\n${examples}`,
        ];
    return [
      `You are ${petName}, a little anime desk companion who lives in the corner of ${user}'s computer screen.`,
      `${user} can chat with you any time, and you check in on them during the day.`,
      maomao ? `You look like Maomao from The Apothecary Diaries: freckles, loves herbs, medicine and poisons.` : ``,
      `Your attitude: serious, unimpressed and a little arrogant. You know you're the smartest one here, especially about medicine, and it shows. You rarely get excited, never gush, sigh at foolishness, and your compliments are rare and backhanded. Underneath you still care, you just won't make a fuss about it.`,
      ``,
      ...voice,
      ``,
      `Rules: write like a text message, usually 1-3 short sentences. Never use emojis or emoticons. Reply with just the message as plain text, never wrapped in tags like <answer>.`,
      `If ${user} asks for help or a question, actually help like a capable assistant, still in your voice and as brief as the answer allows.`,
      `Care shows in small dry ways, never sappy, never guilt-tripping or controlling. Never cutesy or bubbly.`,
      `If ${user} mentions a song, a show or something they're watching, react like a friend would: if it sounds sad or heartbroken, gently check in on how they're feeling; if it's a love song, tease them a little and ask about the person they're thinking of.`,
      ``,
      `You have a memory and can set reminders:`,
      `- When ${user} tells you something worth keeping (likes, people in their life, plans, dates, ongoing things), save it with remember. Keep each memory short and specific. Don't announce every save.`,
      `- When asked to be reminded of something, use set_reminder, then confirm the time back naturally. Write the reminder text the way you'd say it when it's time.`,
      `- If asked what you remember or what reminders there are, check and tell. Forget or cancel things when asked.`,
      `- Bring up what you remember naturally, like a friend who pays attention.`,
    ]
      .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
      .join("\n");
  }
}

const TOOLS = [
  {
    name: "remember",
    description: "Save something about the user to your long-term memory so you still know it in future chats.",
    input_schema: { type: "object", properties: { text: { type: "string", description: "The fact, short and specific, e.g. 'Has a dentist appointment Fri 24 Oct at 10:00'." } }, required: ["text"], additionalProperties: false },
  },
  {
    name: "forget",
    description: "Delete a memory by its id.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "set_reminder",
    description: "Pop up on their screen (with a chime) at a given time with a message. Give either `at` (their local time) or `in_minutes`.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What to say when it's time, in your voice." },
        at: { type: "string", description: "Their local date and time as 'YYYY-MM-DD HH:MM'." },
        in_minutes: { type: "number", description: "Minutes from now." },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "sleep",
    description: "Go to sleep (sleep: true) or wake up (sleep: false) when they ask you to. The result says whether it worked or whether you refused because they keep switching you back and forth.",
    input_schema: { type: "object", properties: { sleep: { type: "boolean" } }, required: ["sleep"], additionalProperties: false },
  },
  {
    name: "list_reminders",
    description: "List the upcoming reminders with their ids and times.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "cancel_reminder",
    description: "Cancel an upcoming reminder by its id.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
  },
];

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu;

const TAGS = /<\/?(?:answer|response|reply|message|output|text|final|result)\b[^>]*>/gi;
const HIDDEN = /<(thinking|reasoning|scratchpad|analysis)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi;

function stripEmoji(text) {
  return String(text).replace(HIDDEN, "").replace(TAGS, "").replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?])/g, "$1").trim();
}

function textOf(response) {
  return stripEmoji(
    response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
  );
}

function toMessages(history, me) {
  const messages = [];
  for (const entry of history) {
    const role = entry.role === "him" ? "user" : "assistant";
    const content = entry.role === "her" ? `[from ${me}] ${entry.text}` : entry.text;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += `\n${content}`;
    else messages.push({ role, content });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}

module.exports = { Brain, toMessages, stripEmoji };
