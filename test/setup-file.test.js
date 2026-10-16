const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { install } = require("../src/setup-file");

test("installs a setup file with phrases, pictures and secrets", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-"));
  const file = path.join(dir, "maomao-setup.maomao");
  const home = path.join(dir, "me");
  fs.writeFileSync(file, JSON.stringify({
    kind: "deskpet-setup",
    config: { me: "Me", petName: "Maomao" },
    phrases: { lunch: [{ text: "eat!!" }, { text: "drink water" }] },
    character: [{ name: "idle.gif", data: Buffer.from("gif").toString("base64") }, { name: "../evil.png", data: "" }],
    secrets: { telegramToken: "t" },
  }));

  install(file, home);

  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(home, "phrases.json"))), { lunch: [{ text: "eat!!" }, { text: "drink water" }] });
  assert.deepStrictEqual(fs.readdirSync(path.join(home, "character")), ["idle.gif"]);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(home, "secrets.json"))).telegramToken, "t");
  assert.ok(!fs.existsSync(path.join(dir, "evil.png")));
});

test("rejects files that are not setup files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskpet-"));
  const file = path.join(dir, "x.maomao");
  fs.writeFileSync(file, JSON.stringify({ hello: 1 }));
  assert.throws(() => install(file, path.join(dir, "me")), /isn't a Maomao setup file/);
});
