const test = require("node:test");
const assert = require("node:assert");
const { localParts, isWorkTime, isDue } = require("../src/clock");
const { Brain } = require("../src/brain");

const work = { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };

test("reads local time in a time zone", () => {
  const parts = localParts(new Date("2026-10-16T05:30:00Z"), "Asia/Tashkent");
  assert.deepStrictEqual(parts, { date: "2026-10-16", hhmm: "10:30", minutes: 630, weekday: 5 });
  assert.strictEqual(localParts(new Date("2026-10-16T19:00:00Z"), "Asia/Tashkent").hhmm, "00:00");
});

test("work hours and check-in window", () => {
  const friday = (hhmm) => ({ weekday: 5, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });
  assert.ok(isWorkTime(friday("09:00"), work));
  assert.ok(!isWorkTime(friday("18:00"), work));
  assert.ok(!isWorkTime({ ...friday("12:00"), weekday: 6 }, work));
  assert.ok(isDue(friday("13:05"), work, "13:00"));
  assert.ok(!isDue(friday("13:10"), work, "13:00"));
  assert.ok(!isDue(friday("12:59"), work, "13:00"));
  assert.ok(isDue(friday("14:20"), work, "13:00", 90));
  assert.ok(!isDue(friday("14:30"), work, "13:00", 90));
});

test("uses your phrases without Claude and does not repeat back to back", async () => {
  const brain = new Brain({
    config: { me: "Me", him: "babe", petName: "Mochi", brain: { useClaudeFor: ["reply"] } },
    phrases: { lunch: [{ text: "a" }, { text: "b" }] },
    style: "",
    env: {},
  });
  let previous = "";
  for (let i = 0; i < 20; i++) {
    const line = await brain.write("lunch");
    assert.notStrictEqual(line.text, previous);
    previous = line.text;
  }
  assert.strictEqual((await brain.write("workingLate", { minutes: 70 })).text.length > 0, true);
});
