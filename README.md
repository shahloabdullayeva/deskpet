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
2. Maomao appears in the bottom corner and opens **Settings**. It's already filled in for John
   (Eastern time, 7am to 4pm, Monday to Friday). Paste the Claude API key, then click **Save**.

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
  Settings. She only says them when he's actually at his computer (he's moved the mouse or typed
  in the last 5 minutes). If he comes in late, she says good morning when he arrives, not at
  7:15 to an empty desk. If he's away at lunch or water time, she waits for him to come back
  (up to an hour and a half).
- **Working late:** after 4pm she stays awake as long as he's still working. If he's still there
  an hour later, she tells him once not to stay too long. She only gets sleepy once he's
  actually gone.
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

## Settings

- **His name**, her name and look (Maomao or cat-girl), her size, and whether she has a soft
  dark glow behind her (so she stands out on busy wallpapers) or nothing.
- **Claude API key**: needed for chatting, memories and reminders. It stays on your computer.
- **She texts like** and **How she should talk**: optional, to give her someone's texting style.
- **Work day**: hours, days, which check-ins and when, time zone.
- **Chime** on/off, and whether she walks around.

## For developers

```bash
npm install
npm start          # run the app (settings from me/, or me.example/)
npm test
```

`src/` is the brain (chat with memory and reminder tools, the work-day schedule, settings),
`electron/` is the pet, chat and settings windows. `electron/pet3d.js` builds her 3D model from
simple shapes with toon shading and an ink outline, and draws her face onto a texture so it can
change expression; `electron/pet.js` handles the mouse (petting, clicks, carrying, throwing,
resizing) and talks to `electron/main.js`, which moves the window, does the falling and
bouncing, and tells her where the mouse is so she can look at it. Custom pictures in
`me/character/` (idle.png, talk.png, ...) still replace the 3D model if you add them. Pushing to GitHub builds the Windows
installer (`.github/workflows/windows.yml`) and updates the release page.
