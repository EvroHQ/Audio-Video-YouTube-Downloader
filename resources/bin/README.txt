Place the two required binaries in THIS folder before building:

  yt-dlp.exe   -> https://github.com/yt-dlp/yt-dlp/releases  (download "yt-dlp.exe")
  ffmpeg.exe   -> https://www.gyan.dev/ffmpeg/builds/         (grab "ffmpeg-release-essentials",
                                                               then copy bin/ffmpeg.exe here)

Final layout expected:

  resources/
    bin/
      yt-dlp.exe
      ffmpeg.exe

These are bundled into the packaged app via electron-builder's extraResources,
so the end user never has to install anything manually.
