import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import Store from 'electron-store'
import appIcon from '../../resources/icon.ico?asset'

const store = new Store({
  defaults: {
    outputFolder: ''
  }
})

let mainWindow = null
let currentChild = null
let cancelRequested = false

const CANCELLED = '__CANCELLED__'

// Forcefully terminate a child process AND its descendants (yt-dlp spawns
// ffmpeg for merging), which a plain child.kill() would leave running on Windows.
function killTree(child) {
  if (!child || child.killed) return
  try {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } else {
      child.kill('SIGKILL')
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Resolve the absolute path to a bundled binary (yt-dlp.exe / ffmpeg.exe).
 * In dev the binaries live in <projectRoot>/resources/bin.
 * In a packaged build they are extracted (via extraResources) to
 * process.resourcesPath/bin.
 */
function getBinPath(name) {
  const root = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  return join(root, 'bin', name)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 780,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    title: 'Audio/Video YouTube Downloader',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------
function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function sendLog(line) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-log', `[${timestamp()}] ${line}`)
  }
}

function sendComplete(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-complete', payload)
  }
}

// Parse a flexible time string into seconds. Accepts "ss", "mm:ss",
// "hh:mm:ss" and optional decimals (e.g. "1:23.5"). Returns null if invalid.
function parseTimeToSeconds(value) {
  const str = String(value == null ? '' : value).trim()
  if (!str) return null
  const parts = str.split(':')
  if (parts.length > 3) return null
  let seconds = 0
  for (const part of parts) {
    if (!/^\d*\.?\d+$/.test(part)) return null
    seconds = seconds * 60 + parseFloat(part)
  }
  return seconds
}

// Normalize seconds into an ffmpeg-friendly hh:mm:ss(.ms) string.
function secondsToStamp(totalSeconds) {
  const whole = Math.floor(totalSeconds)
  const ms = Math.round((totalSeconds - whole) * 1000)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const pad = (n) => String(n).padStart(2, '0')
  const base = `${pad(h)}:${pad(m)}:${pad(s)}`
  return ms ? `${base}.${String(ms).padStart(3, '0')}` : base
}

// Compact stamp for filenames (no ":" — invalid on Windows).
function safeStamp(value) {
  const secs = parseTimeToSeconds(value)
  if (secs == null) return '0'
  return secondsToStamp(secs).replace(/[:.]/g, '')
}

/**
 * Spawn a bundled binary and stream stdout/stderr line by line to the renderer.
 * Resolves with the process exit code.
 */
function runBinary(binPath, args, cwd) {
  return new Promise((resolve, reject) => {
    if (!existsSync(binPath)) {
      reject(new Error(`Binary not found: ${binPath}`))
      return
    }

    sendLog(`$ ${binPath.split(/[\\/]/).pop()} ${args.join(' ')}`)

    const child = spawn(binPath, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })
    currentChild = child

    let stdoutBuffer = ''
    let stderrBuffer = ''

    const flush = (buffer, chunk, isErr) => {
      buffer += chunk.toString('utf-8')
      const lines = buffer.split(/\r?\n/)
      const remainder = lines.pop()
      for (const line of lines) {
        if (line.trim().length) sendLog(isErr ? line : line)
      }
      return remainder
    }

    // yt-dlp emits carriage-return progress updates on stdout; split on \r too.
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf-8')
      const parts = text.split(/[\r\n]+/)
      stdoutBuffer = ''
      for (const part of parts) {
        if (part.trim().length) sendLog(part.trim())
      }
    })

    child.stderr.on('data', (chunk) => {
      stderrBuffer = flush(stderrBuffer, chunk, true)
    })

    child.on('error', (err) => {
      currentChild = null
      reject(err)
    })

    child.on('close', (code) => {
      currentChild = null
      if (stderrBuffer.trim().length) sendLog(stderrBuffer.trim())
      if (cancelRequested) {
        reject(new Error(CANCELLED))
      } else if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Process exited with code ${code}`))
      }
    })
  })
}

function findTempFile(folder, extensions) {
  const files = readdirSync(folder)
  for (const f of files) {
    if (f.startsWith('temp_') && extensions.some((ext) => f.toLowerCase().endsWith(ext))) {
      return join(folder, f)
    }
  }
  return null
}

// Probe a media file's duration (seconds) by parsing ffmpeg's stderr banner.
// Returns null if it can't be determined. ffmpeg exits non-zero here because
// no output is specified, which is expected — we only want the banner.
function getMediaDuration(ffmpegPath, file) {
  return new Promise((resolve) => {
    if (!existsSync(ffmpegPath)) {
      resolve(null)
      return
    }
    const child = spawn(ffmpegPath, ['-i', file], { windowsHide: true })
    let buf = ''
    child.stderr.on('data', (c) => (buf += c.toString('utf-8')))
    child.on('error', () => resolve(null))
    child.on('close', () => {
      const m = buf.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (!m) return resolve(null)
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]))
    })
  })
}

// ---------------------------------------------------------------------------
// Download orchestration
// ---------------------------------------------------------------------------
async function handleDownload(params) {
  const { url, format, useRange, start, end } = params
  const audioFormat = params.audioFormat === 'mp3' ? 'mp3' : 'wav'
  const videoQuality = ['4k', '2k', '1080'].includes(params.videoQuality)
    ? params.videoQuality
    : '1080'
  const ytdlp = getBinPath('yt-dlp.exe')
  const ffmpeg = getBinPath('ffmpeg.exe')

  const outputFolder = store.get('outputFolder') || app.getPath('downloads')

  if (!existsSync(ytdlp)) {
    throw new Error('yt-dlp.exe is missing from the bundled resources. The build is incomplete.')
  }

  // Max height per selected quality (yt-dlp picks the best available up to it).
  const maxHeight = videoQuality === '4k' ? 2160 : videoQuality === '2k' ? 1440 : 1080
  const videoSelector = `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]`

  // ffmpeg audio encode args for the chosen audio format.
  const audioEncodeArgs =
    audioFormat === 'mp3'
      ? ['-vn', '-c:a', 'libmp3lame', '-b:a', '320k']
      : ['-vn', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2']
  const audioExt = audioFormat === 'mp3' ? 'mp3' : 'wav'

  if (format === 'audio') {
    sendLog(`Audio format: ${audioFormat === 'mp3' ? 'MP3 320 kbps' : 'WAV 44.1 kHz stereo'}`)
  } else {
    sendLog(`Video quality: up to ${maxHeight}p (best available), with audio → MP4`)
  }

  // Validate & normalize the trim range up front so bad input fails clearly
  // instead of silently producing a tiny/empty file.
  let startSec = 0
  let endSec = 0
  if (useRange) {
    startSec = parseTimeToSeconds(start)
    endSec = parseTimeToSeconds(end)
    if (startSec == null) {
      throw new Error(`Invalid Start time "${start}". Use hh:mm:ss, mm:ss or seconds.`)
    }
    if (endSec == null) {
      throw new Error(`Invalid End time "${end}". Use hh:mm:ss, mm:ss or seconds.`)
    }
    if (endSec <= startSec) {
      throw new Error(
        `End (${secondsToStamp(endSec)}) must be greater than Start (${secondsToStamp(startSec)}).`
      )
    }
    sendLog(
      `Trim range: ${secondsToStamp(startSec)} → ${secondsToStamp(endSec)} ` +
        `(${secondsToStamp(endSec - startSec)} long)`
    )
  }

  const startStamp = secondsToStamp(startSec)
  const endStamp = secondsToStamp(endSec)
  const stamp = `${safeStamp(start)}-${safeStamp(end)}`

  // Warn (and clamp end) if the requested range exceeds the media length.
  const checkRangeAgainstMedia = async (file) => {
    const dur = await getMediaDuration(ffmpeg, file)
    if (dur == null) return endStamp
    sendLog(`Source length: ${secondsToStamp(dur)}`)
    if (startSec >= dur) {
      throw new Error(
        `Start (${startStamp}) is past the end of the media (${secondsToStamp(dur)}). ` +
          `Nothing to trim — check your time values (fields are hh:mm:ss).`
      )
    }
    if (endSec > dur + 0.5) {
      sendLog(
        `WARNING: End (${endStamp}) is beyond the media length (${secondsToStamp(dur)}). ` +
          `Clamping to ${secondsToStamp(dur)}.`
      )
      return secondsToStamp(dur)
    }
    return endStamp
  }

  if (format === 'audio' && !useRange) {
    // Direct audio extraction to the chosen format.
    const args = ['-x', '--audio-format', audioFormat, '--ffmpeg-location', ffmpeg]
    if (audioFormat === 'mp3') {
      args.push('--audio-quality', '320K')
    } else {
      // WAV: force 44.1 kHz / 16-bit stereo.
      args.push('--postprocessor-args', 'ffmpeg:-ar 44100 -ac 2 -c:a pcm_s16le')
    }
    args.push('-o', '%(title)s.%(ext)s', url)
    await runBinary(ytdlp, args, outputFolder)
    return
  }

  if (format === 'audio' && useRange) {
    // 1. download best audio stream to a temp file
    await runBinary(ytdlp, ['-f', '251', '-o', 'temp_%(id)s.%(ext)s', url], outputFolder)
    // 2. locate temp file
    const temp = findTempFile(outputFolder, ['.webm', '.m4a', '.opus'])
    if (!temp) throw new Error('Could not locate the downloaded temp audio file.')
    // 3. trim + convert to the chosen audio format
    const outName = join(outputFolder, `audio_${stamp}.${audioExt}`)
    if (!existsSync(ffmpeg)) throw new Error('ffmpeg.exe is missing from the bundled resources.')
    const effectiveEnd = await checkRangeAgainstMedia(temp)
    await runBinary(
      ffmpeg,
      ['-y', '-i', temp, '-ss', startStamp, '-to', effectiveEnd, ...audioEncodeArgs, outName],
      outputFolder
    )
    // 4. cleanup
    try {
      unlinkSync(temp)
      sendLog(`Removed temp file: ${temp.split(/[\\/]/).pop()}`)
    } catch (e) {
      sendLog(`Warning: could not remove temp file (${e.message})`)
    }
    return
  }

  if (format === 'video' && !useRange) {
    await runBinary(
      ytdlp,
      [
        '-f',
        videoSelector,
        '--ffmpeg-location',
        ffmpeg,
        '--merge-output-format',
        'mp4',
        '-o',
        '%(title)s.%(ext)s',
        url
      ],
      outputFolder
    )
    return
  }

  if (format === 'video' && useRange) {
    await runBinary(
      ytdlp,
      [
        '-f',
        videoSelector,
        '--merge-output-format',
        'mp4',
        '--ffmpeg-location',
        ffmpeg,
        '-o',
        'temp_%(id)s.%(ext)s',
        url
      ],
      outputFolder
    )
    const temp = findTempFile(outputFolder, ['.mp4', '.mkv', '.webm'])
    if (!temp) throw new Error('Could not locate the downloaded temp video file.')
    const outName = join(outputFolder, `video_${stamp}.mp4`)
    if (!existsSync(ffmpeg)) throw new Error('ffmpeg.exe is missing from the bundled resources.')
    const effectiveEnd = await checkRangeAgainstMedia(temp)
    await runBinary(
      ffmpeg,
      ['-y', '-i', temp, '-ss', startStamp, '-to', effectiveEnd, '-c', 'copy', outName],
      outputFolder
    )
    try {
      unlinkSync(temp)
      sendLog(`Removed temp file: ${temp.split(/[\\/]/).pop()}`)
    } catch (e) {
      sendLog(`Warning: could not remove temp file (${e.message})`)
    }
    return
  }

  throw new Error('Invalid download parameters.')
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths.length) return null
  const folder = result.filePaths[0]
  store.set('outputFolder', folder)
  return folder
})

ipcMain.handle('get-config', () => {
  return {
    outputFolder: store.get('outputFolder') || app.getPath('downloads')
  }
})

ipcMain.handle('set-config', (_event, cfg) => {
  if (cfg && typeof cfg.outputFolder === 'string') {
    store.set('outputFolder', cfg.outputFolder)
  }
  return true
})

ipcMain.handle('start-download', async (_event, params) => {
  cancelRequested = false
  try {
    sendLog(`Starting ${params.format} download...`)
    await handleDownload(params)
    sendLog('Download finished successfully.')
    sendComplete({ success: true, message: 'Download complete!' })
    return { success: true }
  } catch (err) {
    if (err.message === CANCELLED || cancelRequested) {
      sendLog('Download cancelled by user.')
      sendComplete({ success: false, cancelled: true, message: 'Download cancelled' })
      return { success: false, cancelled: true }
    }
    sendLog(`ERROR: ${err.message}`)
    sendComplete({ success: false, message: err.message })
    return { success: false, error: err.message }
  }
})

ipcMain.handle('cancel-download', () => {
  cancelRequested = true
  if (currentChild) {
    sendLog('Stopping download...')
    killTree(currentChild)
  }
  return true
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // Ensures Windows uses our icon (not the default Electron one) in the taskbar.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.evrohq.ytdownloader')
  }

  createWindow()

  // Silent startup check that both binaries exist.
  const ytdlp = getBinPath('yt-dlp.exe')
  const ffmpeg = getBinPath('ffmpeg.exe')
  setTimeout(() => {
    if (!existsSync(ytdlp)) {
      sendLog('ERROR: yt-dlp.exe not found at ' + ytdlp + ' — the build is incomplete.')
    }
    if (!existsSync(ffmpeg)) {
      sendLog('ERROR: ffmpeg.exe not found at ' + ffmpeg + ' — the build is incomplete.')
    }
    if (existsSync(ytdlp) && existsSync(ffmpeg)) {
      sendLog('Ready. Binaries detected. Paste a YouTube URL to begin.')
    }
  }, 800)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (currentChild) {
    try {
      currentChild.kill()
    } catch (e) {
      // ignore
    }
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
