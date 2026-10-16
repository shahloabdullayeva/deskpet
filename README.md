# deskpet

A little Maomao (fan-art nod to *The Apothecary Diaries*) who lives in the corner of your
screen. Click her to chat. She remembers things you tell her, sets reminders, and checks in on
you during the work day.

![Maomao: idle, talking, happy, annoyed, sleepy, sniffing herbs, being carried, yawning](docs/maomao.png)

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
- **Drag her** anywhere. Now and then she walks around, sniffs her herbs or yawns, and she
  falls asleep after work.
- **Right-click her** (or the tray icon by the clock): Chat, Show/hide, Mute chime, Quiet for
  1 hour, Settings, Start with Windows, Quit.

## Settings

- **Your name**, her name and look (Maomao or cat-girl).
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
`electron/` is the pet, chat and settings windows. Pushing to GitHub builds the Windows
installer (`.github/workflows/windows.yml`) and updates the release page.
