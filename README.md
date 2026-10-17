# deskpet

A little Maomao (fan-art nod to *The Apothecary Diaries*) who lives in the corner of your
screen. Click her to chat. She remembers things you tell her, sets reminders, and checks in on
you during the work day.

![Maomao in 3D: idle, talking, happy, annoyed, sleepy, and the cat-girl look](docs/maomao.png)

She is a small 3D character drawn live with three.js, so she turns her head to follow your
mouse, sways, blinks and bounces instead of being a flat picture.

## Install (Windows)

1. Download **[Maomao-Setup.exe](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/Maomao-Setup.exe)**
   and run it. It installs for your user only, so no admin rights are needed.
   If Windows says "Windows protected your PC", click **More info**, then **Run anyway**.
2. Maomao appears in the bottom corner and opens **Settings**. Fill in your name and paste a
   Claude API key (from console.anthropic.com), then click **Save**.

Can't install on this computer? Use
**[Maomao-Portable.exe](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/Maomao-Portable.exe)**,
the same app without installing.

## Using her

- **Click her** (or her speech bubble) to open the chat. Ask her anything.
- **Memories:** tell her things ("my sister's birthday is 3 March", "I hate meetings on
  Mondays") and she remembers them in later chats. See or delete them under **Memories** in
  the chat window.
- **Reminders:** "remind me at 3 to call mom", "in 20 minutes tell me to stretch". She pops up
  with a chime when it's time. See or cancel them under **Reminders**.
- **Check-ins:** good morning, how's your day, lunch, water and home time, at the times set in
  Settings.
- **Double-click her** and she spins and jumps.
- **Stroke her head** with the mouse (move it back and forth over her hair): she closes her eyes,
  blushes and little hearts float up. Sometimes she says something about it.
- **Scroll on her** to make her bigger or smaller. She remembers the size. Settings also has
  Small, Medium and Large.
- **Pick her up and throw her.** Drag her and she dangles and kicks; let go and she falls to the
  bottom of the screen and bounces. Throw her sideways and she can fly onto your other screen.
  When she's pinned she stays exactly where you drop her.
- **She watches you:** her head and eyes follow the mouse while it's near her.
- Now and then she walks around, sniffs her herbs, stretches or yawns, and she falls asleep
  after work.
- **Right-click her** (or the tray icon by the clock): Chat, Show/hide, Mute chime,
  I'm on a call / Call's over (she stays quiet, then sometimes asks how it went), Quiet for
  1 hour, Pin her here (no walking or hopping, and she stays put after restarts), Settings,
  Start with Windows, Quit.
- **Feelings:** happy after you talk to her, a bit lonely if you ignore her for hours, sleepy
  after work. Her face shows it and the chat says how she's feeling.

## On a phone instead (Telegram)

For a computer where nothing can be installed (like a work laptop), she can live in Telegram.
The best place to run her is a server that is always on (see **Running her on a server** below),
so nobody has to keep a laptop open. Or, from a computer:

1. Install Maomao on a computer that stays on during the day (your own laptop, not the work one).
2. In Telegram, open **@BotFather**, send `/newbot`, and copy the token it gives you.
3. In Settings choose **Where she lives: On his phone (Telegram)**, fill in his name, his work
   hours and time zone, the Claude API key and the bot token, then **Save**.
4. He opens the bot on his phone and sends `/pair <code> him` (the code is shown in Settings).

From then on her check-ins, reminders, casual messages and chats all happen in his Telegram.
She only runs while that computer is on and online, and the chats are saved on it (she tells
him that when he pairs).

## Running her on a server

The Telegram side runs without any window, so a Linux server can keep her going day and night:

```bash
git clone https://github.com/shahloabdullayeva/deskpet.git /root/deskpet
cd /root/deskpet
npm install --omit=dev
mkdir me && cp me.example/config.json me.example/phrases.json me/
```

In `me/config.json` set `"him"` (his name), `"timezone"` (his, like `"Asia/Tashkent"`),
`"workHours"`, and `"mode": "phone"` inside `"pet"`. Then put the keys in `me/secrets.json`:

```json
{ "anthropicKey": "sk-ant-...", "telegramToken": "123456789:AA...", "pairCode": "maomao1234" }
```

Start it, and have it start again after a reboot:

```bash
cp deploy/deskpet.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now deskpet
journalctl -u deskpet -f
```

He sends the bot `/pair maomao1234 him` once. One bot token can only be used by one place at a
time, so if the server runs her Telegram, leave the bot token empty in the desktop app.

## Settings

- **Your name**, her name and look (Maomao or cat-girl), her size, and whether she has a soft
  dark glow behind her (so she stands out on busy wallpapers) or nothing.
- **Claude API key**: needed for chatting, memories and reminders. It stays on your computer.
- **She texts like** and **How she should talk**: optional, to give her someone's texting style.
- **Work day**: hours, days, which check-ins and when, time zone.
- **Chime** on/off, and whether she walks around.
- **Telegram** (optional): paste a bot token from @BotFather to get her check-ins and reminders
  on your phone and chat with her there too.

## For developers

```bash
npm install
npm start          # run the app (settings from me/, or me.example/)
npm run bot        # Telegram only, no window
npm test
```

`src/` is the brain (chat with memory and reminder tools, schedule, Telegram, settings),
`electron/` is the pet, chat and settings windows. `electron/pet3d.js` builds her 3D model from
simple shapes with toon shading and an ink outline, and draws her face onto a texture so it can
change expression; `electron/pet.js` handles the mouse (petting, clicks, carrying, throwing,
resizing) and talks to `electron/main.js`, which moves the window, does the falling and
bouncing, and tells her where the mouse is so she can look at it. Custom pictures in
`me/character/` (idle.png, talk.png, ...) still replace the 3D model if you add them. Pushing to GitHub builds the Windows
installer (`.github/workflows/windows.yml`) and updates the release page.
