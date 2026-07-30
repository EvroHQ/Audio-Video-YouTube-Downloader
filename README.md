# Audio/Video YouTube Downloader

A simple, modern Windows app to download **audio** or **video** from a YouTube link — with optional trimming to a specific time range.

Everything is built in: you don't need to install anything else, open a terminal, or configure anything. Just download, open, and go.

---

## Download

Grab the latest version from the [**Releases page**](https://github.com/EvroHQ/Audio-Video-YouTube-Downloader/releases/latest):

| File | For you if… |
| --- | --- |
| **…Setup-1.0.0.exe** | You want a normal install (Start-menu shortcut, choose the folder). |
| **…Portable-1.0.0.exe** | You want a single file to run directly, no installation. |

Both versions are identical in features.

---

## Install

- **Setup**: double-click it, choose where to install, and finish. A shortcut is created.
- **Portable**: just double-click the `.exe` — nothing gets installed.

> **Windows SmartScreen warning?** Because the app isn't code-signed, Windows may show a blue “Windows protected your PC” screen the first time. Click **More info → Run anyway**. This is normal for small independent apps.

---

## How to use

1. **Paste a YouTube link** into the field (or click **Paste**). The border turns green when the link is valid.
2. **Choose the format**:
   - **Audio** → **WAV** (44.1 kHz, lossless) or **MP3** (320 kbps)
   - **Video** → **1080p**, **2K**, or **4K** (it takes the best quality available up to your choice; video always includes sound)
3. *(Optional)* Turn on **“Download a specific range”** to grab only a portion.
   - Just type the digits — the field formats itself: typing `001030` becomes `00:10:30` (hh:mm:ss).
4. **Choose the output folder** with **Change** (it's remembered next time). By default it's your **Downloads** folder.
5. Click **DOWNLOAD**. You can follow progress in the log and the progress bar.
   - Need to cancel? Click **Stop**.

Your file appears in the chosen folder when the log says the download finished.

---

## Good to know

- **Nothing else to install** — the tools that do the work (yt-dlp and ffmpeg) are already inside the app.
- You need an **internet connection** to download from YouTube, of course.
- **Antivirus false positives**: some antivirus software flags download tools. The app is safe; if needed, allow it in your antivirus.
- Downloading copyrighted content may be against YouTube's Terms of Service — use responsibly and only for content you have the right to download.

---

## Credits

Made by [@EvroHQ](https://github.com/EvroHQ). Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/).

Developers: see [BUILDING.md](BUILDING.md) to build from source.

## License

MIT
