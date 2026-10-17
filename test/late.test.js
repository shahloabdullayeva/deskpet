const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function makePet(idle) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-"));
  fs.copyFileSync(path.join(__dirname, "..", "me.example", "config.json"), path.join(home, "config.json"));
  process.env.DESKPET_HOME = home;
  process.env.DESKPET_DATA = path.join(home, "data");
  delete require.cache[require.resolve("../src/config")];
  delete require.cache[require.resolve("../src/deskpet")];
  const { Deskpet } = require("../src/deskpet");
  const pet = new Deskpet();
  pet.idleSeconds = () => idle.seconds;
  const said = [];
  pet.say = async (kind) => said.push(kind);
  return { pet, said };
}

const at = (hhmm, weekday = 3) => ({ date: "2026-10-21", hhmm, weekday, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });

test("good morning waits until he actually shows up", async () => {
  const idle = { seconds: 3600 };
  const { pet, said } = makePet(idle);
  pet.now = () => at("07:20");
  await pet.tick();
  assert.deepStrictEqual(said, []);
  idle.seconds = 5;
  pet.now = () => at("08:40");
  await pet.tick();
  assert.deepStrictEqual(said, ["morning"]);
  await pet.tick();
  assert.deepStrictEqual(said, ["morning"]);
});

test("stays awake and teases him when he works late", async () => {
  const idle = { seconds: 5 };
  const { pet, said } = makePet(idle);
  pet.now = () => at("16:30");
  assert.strictEqual(pet.feel(at("16:30")).feeling, "calm");
  await pet.tick();
  assert.ok(!said.includes("workingLate"));
  pet.now = () => at("17:05");
  await pet.tick();
  assert.ok(said.includes("workingLate"));
  idle.seconds = 3600;
  assert.strictEqual(pet.feel(at("17:30")).feeling, "sleepy");
});
