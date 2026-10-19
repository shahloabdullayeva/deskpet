const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Brain, clean } = require("../src/brain");
const { Memory } = require("../src/memory");

function fakeClient(turns) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (request) => (calls.push(structuredClone(request)), turns.shift()) } },
  };
}

test("chat uses the memory and reminder tools, then answers with emojis kept", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-"));
  const memory = new Memory(dir, "Asia/Tashkent");
  const brain = new Brain({ config: { me: "", him: "Ali", petName: "Maomao", brain: {} }, phrases: {}, style: "", env: {} });
  brain.client = fakeClient([
    {
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "remember", input: { text: "Likes matcha" } },
        { type: "tool_use", id: "t2", name: "set_reminder", input: { text: "time to stretch", in_minutes: 20 } },
      ],
    },
    { stop_reason: "end_turn", content: [{ type: "text", text: "noted, and I'll remind you in 20 min 💕" }] },
  ]);
  const tools = {
    context: () => "Right now it is Friday.",
    run: (name, input) => {
      if (name === "remember") return `Saved as memory ${memory.remember(input.text).id}.`;
      if (name === "set_reminder") return `Reminder ${memory.remind(input.text, { inMinutes: input.in_minutes }).id} set.`;
      throw new Error("unexpected");
    },
  };

  const reply = await brain.chat([{ role: "him", text: "I love matcha, remind me to stretch in 20 min" }], tools);

  assert.strictEqual(reply.text, "noted, and I'll remind you in 20 min 💕");
  assert.deepStrictEqual(memory.memories.map((m) => m.text), ["Likes matcha"]);
  assert.deepStrictEqual(memory.reminders.map((r) => r.text), ["time to stretch"]);
  const second = brain.client.calls[1];
  assert.deepStrictEqual(second.messages.at(-1).content.map((r) => r.tool_use_id), ["t1", "t2"]);
  assert.match(second.system[0].text, /never more than one per message/);
  assert.strictEqual(second.system[1].text, "Right now it is Friday.");
});

test("chat without a key falls back to saved lines", async () => {
  const brain = new Brain({ config: { petName: "Maomao", brain: {} }, phrases: { reply: [{ text: "add a key" }] }, style: "", env: {} });
  assert.deepStrictEqual(await brain.chat([{ role: "him", text: "hi" }], { context: () => "" }), { text: "add a key", offline: true });
});

test("replies wrapped in answer tags show only the message", async () => {
  const brain = new Brain({ config: { me: "", him: "Ali", petName: "Maomao", brain: {} }, phrases: {}, style: "", env: {} });
  brain.client = fakeClient([{ stop_reason: "end_turn", content: [{ type: "text", text: "<answer>\neat something </answer>" }] }]);
  const reply = await brain.chat([{ role: "him", text: "hi" }], { context: () => "", run: () => "" });
  assert.strictEqual(reply.text, "eat something");
  assert.strictEqual(clean("<thinking>he is tired</thinking>i <3 tea"), "i <3 tea");
});
