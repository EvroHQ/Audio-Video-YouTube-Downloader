# Audio/Video YouTube Downloader

A minimalist Windows desktop app to download **audio** or **video** from a YouTube URL, with optional **time-range trimming**. Built with **Electron + React + Tailwind CSS**, powered by **yt-dlp** and **ffmpeg** which are fully bundled into the final installer — the end user installs nothing manually.

![App icon](resources/icon.ico)

## Features

- Paste a YouTube URL (with clipboard button + real-time validation)
- Choose **Audio** (WAV 48kHz stereo) or **Video** (MP4 1080p max)
- Optionally trim to a **specific start/end range**
- Pick and remember an **output folder** (persisted via `electron-store`)
- Live **terminal-style logs** with timestamps and a parsed **progress bar**
- Dark, modern UI with violet→fuchsia accents and subtle Framer Motion animations

---

## 1. Prerequisites (developer only)

- [Node.js](https://nodejs.org/) 18+ and npm
- Windows (for building the `.exe`)

## 2. Install dependencies

```bash
npm install
```

## 3. Add the bundled binaries (REQUIRED before building)

The app runs `yt-dlp.exe` and `ffmpeg.exe` as bundled external binaries. **Place both files** in `resources/bin/` **before your first build**:

```
resources/
  bin/
    yt-dlp.exe
    ffmpeg.exe
```

- **yt-dlp.exe** — download the Windows build from
  https://github.com/yt-dlp/yt-dlp/releases (grab the file named `yt-dlp.exe`).
- **ffmpeg.exe** — download a Windows build from
  https://www.gyan.dev/ffmpeg/builds/ (e.g. `ffmpeg-release-essentials.zip`),
  unzip it, and copy `bin/ffmpeg.exe` into `resources/bin/`.

> These binaries are git-ignored on purpose (they are large). They are bundled
> into the packaged app automatically via electron-builder's `extraResources`,
> so **end users never have to install anything** — no cmd, no winget, no PATH setup.

The app performs a silent check at startup and prints a clear error in the log
area if either binary is missing (instead of crashing).

## 4. Run in development

```bash
npm run dev
```

This launches the Electron app with hot-reload for the renderer.

## 5. Build the Windows `.exe`

```bash
npm run build:win
```

This produces both an **installer** and a **portable** executable in the `release/` folder:

- `release/Audio Video YouTube Downloader-Setup-1.0.0.exe` — NSIS installer (lets the user choose the install directory)
- `release/Audio Video YouTube Downloader-Portable-1.0.0.exe` — single-file portable app

Both include `yt-dlp.exe` and `ffmpeg.exe` inside, so the app works **out-of-the-box** after installation.

---

## How downloads work

| Format | Range | Command flow |
| ------ | ----- | ------------ |
| Audio  | No    | `yt-dlp -x --audio-format wav "URL"` |
| Audio  | Yes   | `yt-dlp -f 251 -o temp_%(id)s.%(ext)s "URL"` → `ffmpeg -ss START -to END → audio_START-END.wav` → delete temp |
| Video  | No    | `yt-dlp -f "bv*[height<=1080]+ba/b[height<=1080]" "URL"` (merged to mp4) |
| Video  | Yes   | `yt-dlp ... -o temp_%(id)s.%(ext)s "URL"` → `ffmpeg -ss START -to END -c copy → video_START-END.mp4` → delete temp |

All stdout/stderr from the binaries is streamed live to the in-app log via IPC.

## Project structure

```
resources/
  bin/            yt-dlp.exe + ffmpeg.exe (you provide these)
  icon.ico        app icon (256x256 placeholder — replace with your own)
src/
  main/index.js   Electron main process: window, IPC, download logic, getBinPath()
  preload/index.js contextBridge API (selectFolder/getConfig/setConfig/startDownload/onLog/onComplete)
  renderer/       React + Tailwind UI
electron-builder.yml  packaging config (nsis + portable, extraResources)
electron.vite.config.mjs
```

## Notes

- **Security**: the renderer runs with `nodeIntegration: false` and `contextIsolation: true`. `child_process` is never used in the renderer — everything goes through IPC in the preload.
- **Encoding**: child processes run with `PYTHONIOENCODING=utf-8` to keep log characters intact.
- **Default output folder**: your system `Downloads` folder if none is chosen.
- **Icon**: `resources/icon.ico` is a generated placeholder (violet→fuchsia gradient with a white download glyph). Replace it with your own branding if desired.

## License

MIT
