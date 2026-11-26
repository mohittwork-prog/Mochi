# Mochi: a floating desktop cat for your Mac

Mochi sits in a small see-through window that floats above all your apps, including full-screen ones and every desktop Space. It presses the same keys you type, anywhere on your Mac. The face, ears and mouth react to what you type. There are no pop-up marks and no key-name bubbles.

## Run it (about 2 minutes)

1. Install **Node.js 18 or newer** from https://nodejs.org (the LTS download).
2. Unzip this folder, open **Terminal**, and go into it:
   ```
   cd ~/Downloads/mochi-widget
   ```
3. Install and start:
   ```
   npm install
   npm start
   ```
4. Mochi appears in the bottom-right corner, and a small cat icon appears in the menu bar.

## Let Mochi see your typing (one time)

macOS only lets an app see keys typed in other apps if you allow it:

1. Open **System Settings → Privacy & Security → Accessibility**, and turn on **Terminal** (or **Mochi**, if you built the app).
2. If macOS also lists it under **Input Monitoring**, turn it on there too.
3. Quit Mochi from the menu bar and run `npm start` again.

Keys are used only to animate the paws and face. Nothing is saved, logged or sent anywhere.

## Using it

- **Move it:** drag the cat anywhere.
- **Pat it:** click or stroke its head.
- **Settings:** click the cat icon in the menu bar and choose **Settings…** to change the look (2D, 2.5D, 3D, Drawn), coat, size and opacity, let clicks pass through to apps underneath, turn on open at login, and check that keyboard access is working.
- The eyes follow your cursor across the whole screen.

## Make the .dmg installer

**Option A: on your Mac (one command)**
```
npm install
npm run dist
```
Two installers appear in the `dist` folder:
- `Mochi-0.1.0-arm64.dmg` for Apple Silicon Macs (M1, M2, M3, M4)
- `Mochi-0.1.0.dmg` for Intel Macs

**Option B: let GitHub build it (no Node needed on your Mac)**
1. Create a new GitHub repository and upload everything in this folder, including the hidden `.github` folder.
2. Open the repo's **Actions** tab, choose **Build Mochi .dmg**, then click **Run workflow**.
3. After about 5 minutes, open the finished run and download **Mochi-dmg** under Artifacts.

**Installing the .dmg**
1. Open the .dmg and drag **Mochi** into **Applications**.
2. The app isn't notarised by Apple, so the first time you open it, right-click Mochi and choose **Open**, then **Open** again. If macOS says the app is "damaged", run this once in Terminal, then open it again:
   ```
   xattr -cr /Applications/Mochi.app
   ```
3. Turn on Mochi under **System Settings → Privacy & Security → Accessibility** (and **Input Monitoring**, if it's listed there), then reopen Mochi.

## Files

- `widget.html`: the cat (the same one as the browser prototype, minus the settings page and pop-ups)
- `main.js`: the floating window, menu bar icon and global key listener
- `preload.js`: passes keys and cursor position safely to the cat
