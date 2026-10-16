# deskpet 🐾

A little anime cat-girl that sits in the corner of his work screen, talks like you,
and checks in on him on Telegram.

![idle, talking, happy, pouting, sleepy](docs/moods.png)

- **Check-ins** on work days: good morning, "how's your day", lunch, water, home time.
- **"You said checking 👀"** — when he writes "checking", "one sec", "brb"… in your
  Telegram group and then goes quiet for 20 minutes, she nudges him with a reply to that message.
- **Sounds like you** — plays your own voice recordings, or your cloned voice (ElevenLabs),
  and writes in your texting style (your phrases, or Claude trained on your real messages).
- **You can talk through her** — send the bot a text or a voice note and it pops up and plays
  on his desk.
- **He can talk to her** — he can DM the bot; she answers in your style and forwards
  what he said to you.
- Blinks, sways, wags her tail, hops when poked, pouts when he forgets to reply, and sleeps
  outside work hours. Drag her anywhere; right-click to mute, quiet her for a meeting, or quit.

## Setup

You need [Node.js](https://nodejs.org) 20+ on his computer (Windows, Mac or Linux).

```bash
git clone https://github.com/shahloabdullayeva/deskpet
cd deskpet
npm install
cp -r me.example me        # your personal folder — never committed
cp .env.example .env
npm start
```

She works offline straight away with the example lines. Then make her yours:

### 1. Telegram

1. Open [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `.env` as `TELEGRAM_BOT_TOKEN`.
2. Still in BotFather: `/setprivacy` → pick your bot → **Disable**, so she can see "checking"
   in the group.
3. Put any secret word in `.env` as `PAIR_CODE`.
4. In a private chat with the bot: you send `/pair <code> me`, he sends `/pair <code> him`.
5. Add the bot to a group with the two of you. That's where the "checking" nudges happen.

Try it with `/test howsYourDay`, `/test checking`, and `/status`.

### 2. Your voice

Pick any mix:

- **Your real voice (best):** record yourself saying your lines, put the files in `me/voice/`,
  and link them in `me/phrases.json`:
  `{ "text": "drink water babe 💧", "audio": "water1.mp3" }`.
- **Cloned voice** for everything else: make an *Instant Voice Clone* of yourself on
  [ElevenLabs](https://elevenlabs.io) from a minute or two of clean recordings, then put
  `ELEVENLABS_API_KEY` in `.env` and the voice id in `me/config.json` → `voice.elevenlabsVoiceId`.
- **Neither:** she just shows text bubbles and sends text messages.

On Telegram, lines with sound go as voice notes (turn off with `telegram.sendAsVoice`).

### 3. Your words

- `me/phrases.json` — the lines she says for each moment. Write them the way you text.
- `me/style.md` — describe how you text (lowercase? which emoji? which languages?).
- **Learn from your real chats (optional):** in Telegram Desktop open your chat with him →
  ⋮ → *Export chat history* → JSON, no media. Then:
  ```bash
  npm run learn -- ~/Downloads/ChatExport/result.json "Your Name"
  ```
  This saves up to 300 of *your* messages to `me/examples.json` on this computer.
- Put `ANTHROPIC_API_KEY` in `.env` and Claude will write the "checking" nudges and her replies
  to him from your phrases, style and examples (`brain.useClaudeFor` in `me/config.json`).
  The fixed check-ins always use your own phrases and recordings.

> Your examples and style are sent to the Claude API to write those messages. Leave the key
> out if you'd rather keep everything local.

### 4. Her look

- Colours: `pet.look` in `me/config.json` (hair, eyes, skin, outfit).
- Your own art: drop transparent `idle.png`, `talk.png`, `happy.png`, `sleepy.png` into
  `me/character/`. An anime version of you from an artist or an image generator works great.

### 5. Schedule

In `me/config.json`: `workHours`, `timezone` (e.g. `"Asia/Tashkent"`, empty = computer's),
`checkins` (time + kind), and `checking` (trigger words, minutes to wait, max nudges per day).

Right-click her → **Start with my computer** to have her open every morning.

## Running the bot without the pet

If his computer is off a lot, run only the Telegram part on any always-on machine:

```bash
npm run bot
```

Then set `pet.runBot` to `false` on his computer so the two don't both send messages.
(Messages you send to show on his desk need the bot running inside the pet.)

## Be nice 💕

Make sure he knows about her. She's in your group chat where he can see her, she only sees
messages in chats she's been added to, she never reads his other chats or his screen, and she
gives up after `maxNudgesPerDay`.

## Development

```bash
npm test
```

`src/` is the brain (Telegram, schedule, voice, Claude), `electron/` is the window.
