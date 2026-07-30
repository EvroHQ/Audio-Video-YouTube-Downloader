# Building from source

Developer notes for building **Audio/Video YouTube Downloader** (Electron + React + Tailwind, packaged with electron-builder).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- Windows (to produce the `.exe`)

## Install

```bash
npm install
```

## Provide the bundled binaries (required before building)

The app runs `yt-dlp.exe` and `ffmpeg.exe` as bundled binaries. Put both in `resources/bin/` before building:

```
resources/bin/
  yt-dlp.exe    # https://github.com/yt-dlp/yt-dlp/releases  (the "yt-dlp.exe" file)
  ffmpeg.exe    # https://www.gyan.dev/ffmpeg/builds/  (ffmpeg-release-essentials.zip -> bin/ffmpeg.exe)
```

They are git-ignored (large) and bundled into the package via electron-builder's `extraResources`.

## Run in development

```bash
npm run dev
```

## Build the Windows installer + portable

```bash
npm run build:win
```

Output goes to `release/`:

- `Audio Video YouTube Downloader-Setup-1.0.0.exe` (NSIS installer)
- `Audio Video YouTube Downloader-Portable-1.0.0.exe` (portable)

### Known issue: winCodeSign symlink extraction on Windows

On Windows **without Developer Mode / admin rights**, electron-builder fails while extracting `winCodeSign-2.6.0.7z` with:

```
Cannot create symbolic link : ... darwin/.../libcrypto.dylib
```

Those are macOS-only files, irrelevant to a Windows build. The cleanest fix is to **enable Windows Developer Mode** (Settings → Privacy & security → For developers → Developer Mode) or run the terminal **as Administrator**, then run `npm run build:win`.

If you cannot enable either, the `scripts/` folder contains a no-admin workaround used to produce the current release:

1. `scripts/eb-mirror.py` — a tiny local mirror that serves a symlink-free `winCodeSign` archive and redirects every other artifact to GitHub.
2. `scripts/patch-appbuilder.py` — updates the checksum that `app-builder` expects, so it accepts the cleaned archive (a `.orig` backup is kept).

Workflow (from a fresh, working extraction of winCodeSign placed under `serve/winCodeSign-2.6.0/winCodeSign-2.6.0.7z`):

```bash
python scripts/patch-appbuilder.py
python scripts/eb-mirror.py 8788 &          # start the local mirror
export ELECTRON_BUILDER_BINARIES_MIRROR="http://127.0.0.1:8788/"
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:win
```

> Prefer Developer Mode when possible — it's the officially supported path.

## Publishing a GitHub release

`scripts/gh-release.sh` creates a release and uploads the two installers using the token already stored by git (no interactive login). Assets are >100 MB, so they must go to a Release, not into git.

## Icon

`resources/icon.ico` is generated from a 256×256 PNG via `scripts/make-ico.cjs`. Replace it to rebrand.

## Project structure

```
resources/bin/        yt-dlp.exe + ffmpeg.exe (you provide)
resources/icon.ico     app icon
src/main/index.js      Electron main: window, IPC, download logic, getBinPath()
src/preload/index.js   contextBridge API
src/renderer/          React + Tailwind UI
electron-builder.yml   packaging config
```
