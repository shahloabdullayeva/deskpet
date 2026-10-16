const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Memory, zonedToEpoch } = require("../src/memory");
const { stripEmoji, toMessages } = require("../src/brain");

test("local times in his time zone become the right moment", () => {
  assert.strictEqual(new Date(zonedToEpoch("2026-10-17 15:00", "Asia/Tashkent")).toISOString(), "2026-10-17T10:00:00.000Z");
  assert.strictEqual(new Date(zonedToEpoch("2026-03-29 12:00", "Europe/London")).toISOString(), "2026-03-29T11:00:00.000Z");
  assert.ok(Number.isNaN(zonedToEpoch("tomorrow at 3", "Asia/Tashkent")));
});

test("remembers, forgets, and hands out reminders once when due", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-"));
  const memory = new Memory(dir, "Asia/Tashkent");
  const fact = memory.remember("Likes matcha");
  const soon = memory.remind("stretch", { inMinutes: 1 });
  memory.remind("call mom", { inMinutes: 60 });
  assert.throws(() => memory.remind("x", { at: "2020-01-01 10:00" }), /past/);

  const reloaded = new Memory(dir, "Asia/Tashkent");
  assert.deepStrictEqual(reloaded.memories.map((m) => m.text), ["Likes matcha"]);
  assert.deepStrictEqual(reloaded.due(Date.now() + 2 * 60_000).map((r) => r.id), [soon.id]);
  assert.deepStrictEqual(reloaded.due(Date.now() + 2 * 60_000), []);
  assert.ok(reloaded.forget(fact.id));
  assert.strictEqual(reloaded.reminders.length, 1);
});

test("strips emojis but keeps the words", () => {
  assert.strictEqual(stripEmoji("hiii 🥺 how's work 💕💕"), "hiii how's work");
  assert.strictEqual(stripEmoji("good job 👍🏽!"), "good job!");
  assert.strictEqual(stripEmoji("no emoji here"), "no emoji here");
});

test("chat history turns into alternating turns starting with him", () => {
  const messages = toMessages(
    [
      { role: "pet", text: "good morning" },
      { role: "him", text: "hey" },
      { role: "him", text: "busy day" },
      { role: "her", text: "love you" },
      { role: "pet", text: "eat lunch" },
      { role: "him", text: "ok" },
    ],
    "Me"
  );
  assert.deepStrictEqual(messages, [
    { role: "user", content: "hey\nbusy day" },
    { role: "assistant", content: "[from Me] love you\neat lunch" },
    { role: "user", content: "ok" },
  ]);
});
