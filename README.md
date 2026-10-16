# deskpet 🌿

A little Maomao (fan-art nod to *The Apothecary Diaries*) who lives in the corner of his
work screen, talks like you, and checks in on him on Telegram.

![Maomao: idle, talking, happy, annoyed, sleepy, sniffing herbs, being carried, yawning](docs/maomao.png)

- **Check-ins** on work days: good morning, "how's your day", lunch, water, home time.
- **"You said checking 👀"**: when he writes "checking", "one sec", "brb"… in your Telegram
  group and then goes quiet for 20 minutes, she replies to that message to nudge him.
- **Writes like you**: your own lines, or Claude learning your texting style from your real chats.
- **A soft chime** when a message pops up (he can mute it from her right-click menu).
- **You can talk through her**: send the bot a message and it pops up on his desk.
- **He can talk to her**: he can DM the bot; she answers like you and forwards it to you.
- **She's alive**: blinks, breathes, braids swing, she walks along the bottom of the screen,
  looks around, sniffs her herbs, yawns, stretches, dangles when he drags her, hops when poked,
  gives him the deadpan stare when he forgets to reply, and dozes off after work.

## How to use it

Everything starts from one download page:
**[github.com/shahloabdullayeva/deskpet/releases/latest](https://github.com/shahloabdullayeva/deskpet/releases/latest)**

### What you do (once, about 10 minutes)

1. On that page, click **Maomao-Setup-Page.html** to download it, then open it (it opens in
   Chrome or Edge).
2. Fill it in from top to bottom:
   - **You two:** your name and what you call him.
   - **His work day:** when he starts and finishes, and the times Maomao checks on him.
   - **What she says:** change the example lines to how *you* actually text him. This is the
     part that makes her feel like you.
   - **Telegram:** skip it for now. You can add it later.
3. Click **⬇ Download setup file**. You get a file called **maomao-setup.maomao**.
4. Send him two things: that file, and the download page link.

### What he does (once, about 2 minutes)

1. On the download page, click **Maomao-Setup.exe** and run it.
   If Windows says *"Windows protected your PC"*, click **More info**, then **Run anyway**.
   That's normal for small apps made by people instead of big companies.
2. Double-click the **maomao-setup.maomao** file she sent.
3. Maomao appears in the bottom corner of the screen and opens by herself every time the
   computer turns on.

If the work computer won't allow installing, download **Maomao-Portable.exe** instead, run it,
right-click Maomao and pick **Load setup file…**

### Every day (he doesn't have to do anything)

- At the times you chose, she says your lines in a little bubble with a soft *ding*.
- **Click her:** she reacts with one of your "poke" lines.
- **Drag her:** move her anywhere on the screen.
- **Right-click her** (or the tray icon by the clock): **Mute chime**, **Quiet for 1 hour**
  (meetings), show/hide, start with Windows, load setup file, **Quit**.
- Now and then she walks around, sniffs her herbs or yawns. After work she falls asleep.

### Changing something later

Open the setup page, click **Open a setup file to change it…**, pick your
`maomao-setup.maomao`, change what you want and download it again. Send him the new file; he
double-clicks it. That's it.

## Optional: Telegram

Without Telegram, everything happens on his screen only. With a Telegram bot you also get:

| | Without | With Telegram |
|---|---|---|
| Check-ins on his screen, with a chime | ✅ | ✅ |
| Pokes, walking, herbs, all her moves | ✅ | ✅ |
| Check-ins also sent to his Telegram | — | ✅ |
| "You said checking 👀" reminders in your group chat | — | ✅ |
| You send messages to his screen from your phone | — | ✅ |
| He talks to her, and you get his messages | — | ✅ |

To add it:

1. In Telegram open **@BotFather**, send `/newbot`, pick a name, and copy the token it gives you.
2. Still in BotFather: `/setprivacy` → your bot → **Disable** (so she can see "checking").
3. Put the token in the setup page, download the file again and send it to him (privately,
   since it has the token in it). He double-clicks it.
4. You send the bot `/pair <code> me`, he sends `/pair <code> him` (the code is on the setup page).
5. Add the bot to a group with the two of you. Try `/test howsYourDay` and `/test checking`.

> Some offices block Telegram on their network. If nothing arrives, that's probably why.

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

`src/` is the brain (Telegram, schedule, Claude, setup files), `electron/` is the
window, and `setup/index.html` is the setup page. Pushing to GitHub builds the Windows
installer (`.github/workflows/windows.yml`) and updates the release page.
