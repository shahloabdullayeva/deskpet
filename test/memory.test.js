const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Memory, zonedToEpoch } = require("../src/memory");
const { clean, tame, toMessages } = require("../src/brain");

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

test("keeps emojis and words, drops answer tags", () => {
  assert.strictEqual(clean("hiii 🥺 how's work 💕💕"), "hiii 🥺 how's work 💕💕");
  assert.strictEqual(clean("<answer>good job 👍🏽</answer>"), "good job 👍🏽");
  assert.strictEqual(clean("no emoji here"), "no emoji here");
});

test("attached pictures and text files reach Claude as content blocks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-files-"));
  fs.writeFileSync(path.join(dir, "1-0-a.png"), Buffer.from("png"));
  fs.writeFileSync(path.join(dir, "1-1-n.txt"), "notes");
  const [message] = toMessages([{ role: "him", text: "look", files: [{ name: "a.png", type: "image/png", file: "1-0-a.png" }, { name: "n.txt", type: "text/plain", file: "1-1-n.txt" }] }], "Me", dir);
  assert.deepStrictEqual(message.content.map((block) => block.type), ["image", "text", "text"]);
  assert.strictEqual(message.content[0].source.data, Buffer.from("png").toString("base64"));
  assert.match(message.content[1].text, /notes/);
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
    { role: "user", content: [{ type: "text", text: "hey" }, { type: "text", text: "busy day" }] },
    { role: "assistant", content: [{ type: "text", text: "[from Me] love you" }, { type: "text", text: "eat lunch" }] },
    { role: "user", content: [{ type: "text", text: "ok" }] },
  ]);
});

test("her lines keep at most one emoji and no hand emojis unless she's mad", () => {
  assert.strictEqual(tame("fine 😂😂 🔥"), "fine 😂");
  assert.strictEqual(tame("ok 👍🏽"), "ok");
  assert.strictEqual(tame("ok 🙏 😤"), "ok 😤");
  assert.strictEqual(tame("no 👍", true), "no 👍");
});
