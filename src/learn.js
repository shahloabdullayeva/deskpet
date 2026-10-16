// Learn how you text from a Telegram Desktop chat export.
//   Telegram Desktop → chat with him → ⋮ → Export chat history → JSON (no media needed)
//   npm run learn -- path/to/result.json "Your Name"
// Your messages are saved to me/examples.json on this computer only.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./config");

const [file, name] = process.argv.slice(2);
if (!file) {
  console.log('Usage: npm run learn -- path/to/result.json "Your Name"');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const messages = data.messages || (data.chats?.list || []).flatMap((chat) => chat.messages || []);
const plain = (text) => (Array.isArray(text) ? text.map((part) => (typeof part === "string" ? part : part.text || "")).join("") : text || "");

const senders = {};
for (const message of messages) if (message.type === "message" && message.from) senders[message.from] = (senders[message.from] || 0) + 1;

if (!name || !senders[name]) {
  console.log(name ? `No messages from "${name}". People in this export:` : "Who are you? People in this export:");
  for (const [who, count] of Object.entries(senders).sort((a, b) => b[1] - a[1])) console.log(`  "${who}" (${count} messages)`);
  process.exit(1);
}

const mine = [...new Set(
  messages
    .filter((message) => message.type === "message" && message.from === name && !message.forwarded_from)
    .map((message) => plain(message.text).trim())
    .filter((text) => text.length >= 2 && text.length <= 200 && !/https?:\/\//.test(text))
)];

// Keep a spread across the whole history, newest last.
const keep = 300;
const step = Math.max(1, mine.length / keep);
const examples = Array.from({ length: Math.min(keep, mine.length) }, (_, index) => mine[Math.floor(index * step)]);

const dir = path.join(ROOT, "me");
if (!fs.existsSync(path.join(dir, "config.json"))) {
  fs.cpSync(path.join(ROOT, "me.example"), dir, { recursive: true });
  console.log("Created me/ from me.example/ — edit me/config.json and me/phrases.json next.");
}
fs.writeFileSync(path.join(dir, "examples.json"), JSON.stringify(examples, null, 2));
console.log(`Saved ${examples.length} of your messages to me/examples.json`);
