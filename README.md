# deskpet 🌿

A little Maomao (fan-art nod to *The Apothecary Diaries*) who lives in the corner of his
work screen, talks like you, and checks in on him on Telegram.

![Maomao: idle, talking, happy, annoyed, sleepy, sniffing herbs, being carried, yawning](docs/maomao.png)

- **Check-ins** on work days: good morning, "how's your day", lunch, water, home time.
- **"You said checking 👀"**: when he writes "checking", "one sec", "brb"… in your Telegram
  group and then goes quiet for 20 minutes, she replies to that message to nudge him.
- **Sounds like you**: your own recordings (made right in the setup page), your cloned voice
  (ElevenLabs), and your texting style (your lines, or Claude learning from your real chats).
- **You can talk through her**: send the bot a text or voice note and it pops up on his desk.
- **He can talk to her**: he can DM the bot; she answers like you and forwards it to you.
- **She's alive**: blinks, breathes, braids swing, she walks along the bottom of the screen,
  looks around, sniffs her herbs, yawns, stretches, dangles when he drags her, hops when poked,
  gives him the deadpan stare when he forgets to reply, and dozes off after work.

## Setting it up (no coding)

Everything is on the download page:
**[github.com/shahloabdullayeva/deskpet/releases/latest](https://github.com/shahloabdullayeva/deskpet/releases/latest)**

### You (5 minutes)

1. Download **Maomao-Setup-Page.html** and open it in Chrome or Edge.
2. Fill it in: names, his work hours, when she checks in, and her lines in your words.
   Press 🎙 next to a line to record yourself saying it.
3. *(Optional)* Telegram bot: in Telegram open **@BotFather** → `/newbot` → copy the token into
   the page. Then `/setprivacy` → your bot → **Disable**. Skip it and she lives only on his desk
   (see below).
4. Press **Download setup file** and send **maomao-setup.maomao** to him privately
   (it contains your bot token).

### Him (2 minutes)

1. Download **Maomao-Setup.exe** from the same page and run it. It installs just for him,
   so it needs no admin rights.
   If Windows says *"Windows protected your PC"*: **More info → Run anyway** (the app isn't
   code-signed).
2. Double-click the **maomao-setup.maomao** file you sent. Maomao appears in the corner of the
   screen and will start with Windows from now on.

> Office PC locked down? Use **Maomao-Portable.exe** instead (no install at all): run it,
> right-click Maomao → **Load setup file…**. Check that your company allows small apps like
> this, and that Telegram isn't blocked on the office network.

### Without a Telegram bot

Leave the bot token empty and everything happens on his screen only:

| | Without a bot | With a bot |
|---|---|---|
| Check-ins on his desk in your voice | ✅ | ✅ |
| Pokes, walking, herbs, all her moves | ✅ | ✅ |
| Check-ins also sent to his Telegram | — | ✅ |
| "You said checking 👀" reminders | — | ✅ (needs to see your group chat) |
| You send text / voice notes to his desk | — | ✅ |
| He talks to her, you get his messages | — | ✅ |

You can add a bot any time later: put the token in the setup page and send him the new file.

### Then, together (only with a bot)

- You send the bot `/pair <code> me`, he sends `/pair <code> him` (the code is on the setup page).
- Add the bot to a group with the two of you.
- Try `/test howsYourDay` and `/test checking`.

To change anything later, open the setup page → **Open a setup file to change it…**, edit, and
send him the new file. He just double-clicks it again.

### His controls

Right-click Maomao (or the tray icon by the clock): mute, quiet for 1 hour (meetings),
show/hide, start with Windows, load setup file, quit. Drag her anywhere.

## Making her look exactly like Maomao

The built-in Maomao is a cute chibi drawing. For something closer to the anime, use real art:
in the setup page → *Extras* → **Use my own drawings of her**, add transparent pictures for
normal, talking, happy, sleepy, annoyed and walking. **Animated GIF/WebP works**, so a
fan-made animated sprite will move. Anything you leave out uses the built-in drawing.

Keep official art and anything copied from the show out of this public repo. Use it only in
your own setup file.

## Be nice 💕

He should know she's there. She's in your group chat where he can see her, only sees chats
she's been added to, never reads his other chats or his screen, and gives up after the daily
nudge limit.

## For developers

```bash
npm install
npm start          # run the pet (settings from me/, or me.example/)
npm run bot        # Telegram only, no window
npm run learn -- result.json "Your Name"   # style examples from a Telegram export
npm test
```

`src/` is the brain (Telegram, schedule, voice, Claude, setup files), `electron/` is the
window, and `setup/index.html` is the setup page. Pushing to GitHub builds the Windows
installer (`.github/workflows/windows.yml`) and updates the release page.
