# deskpet

A little Maomao (fan-art nod to *The Apothecary Diaries*) who lives in the corner of your
screen. Click her to chat. She remembers things you tell her, sets reminders, and checks in on
you during the work day.

![Maomao in 3D: idle, talking, happy, annoyed, sleepy, and the cat-girl look](docs/maomao.png)

She is a small 3D character drawn live with three.js: a little person with a neck, shoulders,
arms that bend at the elbow, hands tucked in her sleeves and legs that step when she walks, lit
with soft shading so she looks round. She turns her head to follow your mouse, breathes, shifts
her weight, blinks and bounces instead of being a flat picture.

## Install (Windows)

1. Download **[Maomao-Setup.exe](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/Maomao-Setup.exe)**
   and run it. It installs for your user only, so no admin rights are needed.
   If Windows says "Windows protected your PC", click **More info**, then **Run anyway**.
2. Maomao appears in the bottom corner and opens **Settings**. Put in your name, your work hours
   and a Claude API key, then click **Save**. (Time zone defaults to your computer's.)

Can't install on this computer? Use
**[Maomao-Portable.exe](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/Maomao-Portable.exe)**,
the same app without installing.

## Install (Linux)

**Ubuntu, Debian, Mint, Pop!_OS:** download
**[maomao.deb](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/maomao.deb)**, then

```bash
sudo apt install ./maomao.deb
```

and open **Maomao** from your apps menu. This is the one to use on Ubuntu 24.04.

**Fedora:** download
**[maomao.rpm](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/maomao.rpm)**, then

```bash
sudo dnf install ./maomao.rpm
```

**Any other distro:** download
**[Maomao.AppImage](https://github.com/shahloabdullayeva/deskpet/releases/latest/download/Maomao.AppImage)**, then

```bash
chmod +x Maomao.AppImage
./Maomao.AppImage
```

(On Ubuntu 22.04 the AppImage needs `sudo apt install libfuse2` first.)

Notes for Linux:
- She needs a desktop with a compositor for the see-through window (GNOME, KDE, Cinnamon and
  most others have one). Without it she sits on a dark square.
- On Wayland she opens through XWayland automatically, because Wayland doesn't let a window
  move itself, and she has to walk and fall.
- The tray icon is in the top bar. On stock GNOME it needs the "AppIndicator and KStatusNotifierItem
  Support" extension; without it, right-click her for the same menu.
- **Start with my computer** adds her to `~/.config/autostart`.
- If the graphics card can't do 3D, she shows as a flat picture instead of not showing at all.
- Clicks only land on her (and her speech bubble); everywhere else in her little window goes straight
  through to whatever is underneath. On Linux this is done with the window's input shape, because
  Linux doesn't tell apps where the mouse is while it's over other windows.

## Updates

She updates herself. Every 10 minutes (and 30 seconds after she starts) she checks the
[release page](https://github.com/shahloabdullayeva/deskpet/releases/latest), downloads a newer
version in the background, and restarts into it the next time nobody has touched the computer for
two minutes ("brb, getting an update"). Right-click her for **Check for updates**: she says what she
found ("checking…", "found 0.2.9, downloading it now", "i'm already the newest version"), the menu
shows the download percentage, and once it's downloaded the menu says **Restart to update**. The menu shows which version is running.

- Windows installer and Linux AppImage: fully automatic.
- Linux .deb and .rpm: automatic too, but Linux asks for your password to install it.
- Maomao-Portable.exe doesn't update itself; download it again.

Every push to GitHub builds a new version (0.2.&lt;build number&gt;), so any change to her reaches
everyone on their own.

## Using her

- **Click her** (or her speech bubble) to open the chat. Ask her anything.
- **Memories:** tell her things ("my sister's birthday is 3 March", "I hate meetings on
  Mondays") and she remembers them in later chats. See or delete them under **Memories** in
  the chat window.
- **Reminders:** "remind me at 3 to call mom", "in 20 minutes tell me to stretch". She pops up
  with a chime when it's time. See or cancel them under **Reminders**.
- **Check-ins:** good morning, how's your day, lunch, water and home time, at the times set in
  Settings. She only says them when you're actually at your computer (you've moved the mouse or typed
  in the last 5 minutes). If you come in late, she says good morning when you arrive, not at
  9:15 to an empty desk. If you're away at lunch or water time, she waits for you to come back
  (up to an hour and a half).
- **Working late:** after your work day ends she stays awake as long as you're still working. If
  you're still there an hour later, she tells you once not to stay too long. She only gets sleepy
  once you've actually gone.
- **Double-click her** and she spins and does a little jump.
- **Stroke her head** with the mouse (move it back and forth over her hair): she closes her eyes,
  blushes and little hearts float up. Sometimes she says something about it.
- **Scroll on her** to make her bigger or smaller. She remembers the size. Settings also has
  Small, Medium and Large.
- **Pick her up and throw her.** Drag her and she dangles and kicks; let go and she falls to the
  bottom of the screen and bounces. Throw her sideways and she can fly onto your other screen.
  When she's pinned she stays exactly where you drop her.
- **She watches you:** her head and eyes follow the mouse while it's near her.
- Now and then she walks a few steps, does a little hop where she stands, sniffs her herbs,
  stretches or yawns. She never jumps off to somewhere else on the screen by herself.
- **Asleep** after work: she walks to the nearest bottom corner of the screen and lies down
  there on her side, head toward the wall, eyes shut, little Zs, perfectly still. No walking,
  hopping or following the mouse until she wakes up and gets back on her feet. If she's pinned
  she lies down right where she is. Pick her up and she wakes enough to dangle; put her down and
  she lies down again wherever you drop her. (She can't nap on top of other windows: Wayland and
  Electron don't let an app see where other apps' windows are.)
- **Right-click her** (or the tray icon by the clock): Chat, Show/hide, Mute chime,
  I'm on a call / Call's over (she stays quiet, then sometimes asks how it went), Quiet for
  1 hour, Pin her here (no walking, and she stays put after restarts), Settings,
  Start with my computer, Quit. The top of the menu shows how she's feeling.
- **Feelings:** happy after you talk to her (smiling and blushing), a bit lonely if you ignore
  her for hours (she pouts and stops wandering off), sleepy after work. Her face shows it, and
  the chat and the menu say how she's feeling.

## Settings

- **Your name**, her name and look (Maomao or cat-girl), her size, and whether she has a soft
  dark glow behind her (so she stands out on busy wallpapers) or nothing.
- **Claude API key**: needed for chatting, memories and reminders. It stays on your computer.
- **She texts like** and **How she should talk**: optional. Leave them empty and she talks as
  Maomao: calm, a little deadpan, into herbs and medicine, and makes sure you eat and drink water.
  Fill them in and she texts in that person's style instead. That lives only in that computer's
  settings, never in the app itself.
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
installer and the Linux AppImage, .deb and .rpm (`.github/workflows/build.yml`), stamps them
version 0.2.&lt;run number&gt; and updates the release page together with `latest.yml` and
`latest-linux.yml`, which is what the installed copies check (electron-updater, generic provider
pointed at `releases/latest/download`). `npm run dist:linux` builds the Linux ones locally (the
.rpm needs `rpmbuild`).

Claude's reply text is cleaned before it's shown: emojis are removed, and so are wrapper tags like
`<answer>` and any `<thinking>` block that sometimes come back with the reply.
