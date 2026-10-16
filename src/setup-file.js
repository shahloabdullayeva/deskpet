// A .maomao setup file is one JSON document made by setup/index.html: settings,
// phrases, recordings and pictures together, so he only has to double-click it.
const fs = require("fs");
const path = require("path");

const SAFE = /^[\w.-]+$/;

function install(file, home) {
  const setup = JSON.parse(fs.readFileSync(file, "utf8"));
  if (setup.kind !== "deskpet-setup" || !setup.config) throw new Error("This isn't a Maomao setup file.");

  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, "voice"), { recursive: true });
  fs.mkdirSync(path.join(home, "character"), { recursive: true });

  const write = (name, value) => fs.writeFileSync(path.join(home, name), typeof value === "string" ? value : JSON.stringify(value, null, 2));
  const save = (folder, item) => {
    if (!item || !SAFE.test(item.name || "")) return null;
    fs.writeFileSync(path.join(home, folder, item.name), Buffer.from(item.data, "base64"));
    return item.name;
  };

  const phrases = {};
  for (const [kind, lines] of Object.entries(setup.phrases || {})) {
    phrases[kind] = lines.map((line) => {
      const audio = save("voice", line.audio);
      return audio ? { text: line.text, audio } : { text: line.text };
    });
  }
  for (const picture of setup.character || []) save("character", picture);

  write("config.json", setup.config);
  write("phrases.json", phrases);
  write("style.md", setup.style || "");
  write("examples.json", setup.examples || []);
  write("secrets.json", setup.secrets || {});
  return setup.config;
}

module.exports = { install };
