import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Clipboard,
  Music,
  Video,
  FolderOpen,
  Loader2,
  Check,
  Coffee,
  Film,
  Square,
  CheckCircle2,
  XCircle,
  ChevronDown
} from 'lucide-react'
import logo from './assets/logo.png'

const spring = { type: 'spring', stiffness: 420, damping: 34 }

/* -------------------------------------------------------------------------- */
/*  URL helpers                                                               */
/* -------------------------------------------------------------------------- */

const YT_HOSTS = [
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com'
]

function toUrl(value) {
  let v = String(value ?? '').trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    return new URL(v)
  } catch {
    return null
  }
}

// A real single YouTube video link (lenient about a missing scheme).
function isYouTubeUrl(value) {
  const u = toUrl(value)
  if (!u) return false
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!YT_HOSTS.includes(host)) return false
  if (host === 'youtu.be') return u.pathname.length > 1
  if (u.pathname === '/watch') return u.searchParams.has('v')
  return /^\/(shorts|live|embed|v)\/[\w-]+/.test(u.pathname)
}

// A playlist / mix link.
function isPlaylistUrl(value) {
  const u = toUrl(value)
  if (!u) return false
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!YT_HOSTS.includes(host)) return false
  if (u.pathname === '/playlist' && u.searchParams.has('list')) return true
  return u.searchParams.has('list') || u.searchParams.has('start_radio')
}

/* -------------------------------------------------------------------------- */
/*  Duration + size helpers                                                   */
/* -------------------------------------------------------------------------- */

const pad2 = (n) => String(n).padStart(2, '0')

function fmtClock(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

function fmtLong(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${pad2(m)}min` : `${m}min`
}

// Auto-insert colons as the user types digits: "001030" -> "00:10:30".
function formatTimeInput(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 6)
  if (d.length > 4) return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4)}`
  if (d.length > 2) return `${d.slice(0, 2)}:${d.slice(2)}`
  return d
}

// Compact view/like counts: 1200000 -> "1.2M".
function formatCount(n) {
  if (n == null || !Number.isFinite(n)) return null
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

// yt-dlp upload_date is "YYYYMMDD" — turn it into a rough "x months ago".
function relativeDate(yyyymmdd) {
  const s = String(yyyymmdd ?? '')
  if (!/^\d{8}$/.test(s)) return null
  const then = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days < 0) return null
  if (days < 1) return 'today'
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return `${w} week${w > 1 ? 's' : ''} ago`
  }
  if (days < 365) {
    const mo = Math.floor(days / 30)
    return `${mo} month${mo > 1 ? 's' : ''} ago`
  }
  const y = Math.floor(days / 365)
  return `${y} year${y > 1 ? 's' : ''} ago`
}

// Classify a console line by yt-dlp/ffmpeg severity *prefix* only — matching
// substrings like "missing" or "failed" would wrongly flag benign WARNING lines
// (e.g. "…formats have been skipped as they are missing a url") as errors.
function logTone(line) {
  if (/\bERROR\b\s*:?/.test(line)) return 'error'
  if (/\bWARNING\b\s*:?/i.test(line)) return 'warn'
  return 'info'
}

const TONE = {
  error: 'text-error',
  warn: 'text-amber-400',
  info: 'text-success/85'
}

/* -------------------------------------------------------------------------- */
/*  App                                                                       */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState('single') // 'single' | 'playlist'
  const [format, setFormat] = useState('audio')
  const [audioFormat, setAudioFormat] = useState('wav')
  const [videoQuality, setVideoQuality] = useState('1080')
  const [useRange, setUseRange] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [embedMeta, setEmbedMeta] = useState(true)
  const [outputFolder, setOutputFolder] = useState('')
  const [version, setVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const [playlistPos, setPlaylistPos] = useState(null)
  const [toast, setToast] = useState(null)
  const [ytdlpUpdate, setYtdlpUpdate] = useState(null)
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false)
  const [appUpdate, setAppUpdate] = useState(null)

  // Real metadata for the preview panel (fetched via yt-dlp).
  const [videoInfo, setVideoInfo] = useState(null)
  const [playlistInfo, setPlaylistInfo] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())

  const logRef = useRef(null)
  const previewReq = useRef(0)
  const readyLogged = useRef(false)

  const pushLog = (msg) => {
    const t = new Date().toTimeString().slice(0, 8)
    setLogs((prev) => [...prev, `[${t}] ${msg}`])
  }

  const urlState = useMemo(() => {
    if (!url.trim()) return null
    if (isPlaylistUrl(url)) return 'playlist'
    if (isYouTubeUrl(url)) return 'single'
    return 'invalid'
  }, [url])

  /* --- lifecycle --------------------------------------------------------- */
  useEffect(() => {
    window.api?.getConfig().then((cfg) => {
      if (cfg?.outputFolder) setOutputFolder(cfg.outputFolder)
      if (cfg?.version) setVersion(cfg.version)
    })

    const offLog = window.api?.onLog((line) => {
      const match = line.match(/(\d+(?:\.\d+)?)%/)
      if (match) setProgress(parseFloat(match[1]))
      const item = line.match(/Downloading (?:item|video) (\d+) of (\d+)/i)
      if (item) setPlaylistPos({ current: Number(item[1]), total: Number(item[2]) })
      const clean = line.replace(/(\d+(?:\.\d+)?)%/g, (_m, n) => `${Math.round(parseFloat(n))}%`)
      setLogs((prev) => [...prev, clean])
    })

    const offComplete = window.api?.onComplete((payload) => {
      setDownloading(false)
      setStopping(false)
      setProgress(payload.success ? 100 : 0)
      setPlaylistPos(null)
      setToast({ success: payload.success, message: payload.message })
    })

    const offAppUpdate = window.api?.onAppUpdate((payload) => setAppUpdate(payload))

    window.api?.checkYtdlpUpdate().then((res) => {
      if (!readyLogged.current) {
        readyLogged.current = true
        if (res?.current) pushLog(`yt-dlp ${res.current} ready — paste a YouTube link to begin.`)
        else pushLog('Ready — paste a YouTube link to begin.')
      }
      if (res?.updateAvailable) setYtdlpUpdate(res)
    })

    return () => {
      offLog && offLog()
      offComplete && offComplete()
      offAppUpdate && offAppUpdate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the pasted URL into the matching preview mode.
  useEffect(() => {
    if (urlState === 'playlist') setMode('playlist')
    else if (urlState === 'single') setMode('single')
  }, [urlState])

  // Fetch real preview metadata whenever a valid URL settles (debounced, with a
  // request guard so a slow response can't overwrite a newer URL).
  useEffect(() => {
    const reqId = ++previewReq.current
    setPreviewError(null)
    if (urlState !== 'single' && urlState !== 'playlist') {
      setVideoInfo(null)
      setPlaylistInfo(null)
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    if (urlState === 'single') {
      setVideoInfo(null)
    } else {
      setPlaylistInfo(null)
      setSelected(new Set())
    }

    const link = url.trim()
    const t = setTimeout(async () => {
      try {
        if (urlState === 'single') {
          const info = await window.api?.getVideoInfo(link)
          if (previewReq.current !== reqId) return
          if (info && !info.error) setVideoInfo(info)
          else setPreviewError('Could not load video details.')
        } else {
          const info = await window.api?.getPlaylistInfo(link)
          if (previewReq.current !== reqId) return
          if (info && !info.error && info.tracks?.length) {
            setPlaylistInfo(info)
            setSelected(new Set(info.tracks.map((tr) => tr.id)))
          } else {
            setPreviewError('Could not load playlist details.')
          }
        }
      } catch (e) {
        if (previewReq.current === reqId) setPreviewError(e.message)
      } finally {
        if (previewReq.current === reqId) setPreviewLoading(false)
      }
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, urlState])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  /* --- derived ----------------------------------------------------------- */
  const perHourMB =
    format === 'video'
      ? videoQuality === '4k'
        ? 6000
        : videoQuality === '2k'
          ? 2800
          : 1400
      : audioFormat === 'wav'
        ? 620
        : 145

  const formatLabel = format === 'video' ? 'MP4' : audioFormat === 'wav' ? 'WAV' : 'MP3'

  const estSizeLabel = (seconds) => {
    const mb = (seconds / 3600) * perHourMB
    const gb = mb / 1024
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(mb)} MB`
  }

  const playlistTracks = playlistInfo?.tracks ?? []
  const totalSecs = playlistTracks.reduce((a, t) => a + (t.duration || 0), 0)
  const selectedSecs = playlistTracks
    .filter((t) => selected.has(t.id))
    .reduce((a, t) => a + (t.duration || 0), 0)

  const singleValid = Boolean(url.trim()) && isYouTubeUrl(url)
  const canDownload =
    mode === 'playlist' ? selected.size > 0 && !downloading : singleValid && !downloading

  const formatWord =
    format === 'video' ? 'MP4' : audioFormat === 'wav' ? 'WAV' : 'MP3'
  const statusText = downloading
    ? stopping
      ? 'Stopping…'
      : mode === 'playlist'
        ? `Downloading ${playlistPos ? `${playlistPos.current}/${playlistPos.total}` : `0/${selected.size}`} · ${formatWord}`
        : `Downloading · ${format === 'video'
          ? 'preparing MP4'
          : audioFormat === 'wav'
            ? 'converting to WAV'
            : 'converting to MP3'
        }`
    : 'Idle — ready to download'

  const activeBanner =
    appUpdate?.status === 'downloading'
      ? {
        key: 'app-dl',
        title: 'Downloading update…',
        subtitle: `Version ${appUpdate.version || ''} — installing automatically when ready.`.trim(),
        progress: appUpdate.percent ?? 0
      }
      : appUpdate?.status === 'downloaded'
        ? {
          key: 'app',
          title: 'App update ready',
          subtitle: `Version ${appUpdate.version} downloaded — restart to install.`,
          actionLabel: 'Restart now',
          onAction: () => window.api?.installUpdate()
        }
        : ytdlpUpdate
          ? {
            key: 'ytdlp',
            title: 'yt-dlp update available',
            subtitle: `Installed ${ytdlpUpdate.current} · latest ${ytdlpUpdate.latest} — keeps YouTube downloads working.`,
            actionLabel: updatingYtdlp ? 'Updating…' : 'Update now',
            busy: updatingYtdlp,
            onAction: handleUpdateYtdlp
          }
          : null

  /* --- handlers ---------------------------------------------------------- */
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch (e) {
      pushLog(`Could not read clipboard: ${e.message}`)
    }
  }

  const handleChangeFolder = async () => {
    const folder = await window.api?.selectFolder()
    if (folder) setOutputFolder(folder)
  }

  const handleDownload = async () => {
    if (!canDownload) return
    if (mode === 'playlist') {
      const items = playlistTracks
        .map((t, i) => (selected.has(t.id) ? i + 1 : null))
        .filter(Boolean)
        .join(',')
      setDownloading(true)
      setStopping(false)
      setProgress(0)
      setPlaylistPos({ current: 0, total: selected.size })
      pushLog(`Sending playlist request — ${selected.size} of ${playlistTracks.length} track(s)…`)
      await window.api?.startPlaylistDownload({
        url: url.trim(),
        playlistItems: items,
        format,
        audioFormat,
        videoQuality,
        embedMeta
      })
      return
    }
    setDownloading(true)
    setStopping(false)
    setProgress(0)
    pushLog('Sending request…')
    await window.api?.startDownload({
      url: url.trim(),
      format,
      audioFormat,
      videoQuality,
      useRange,
      embedMeta,
      start: start || '00:00:00',
      end: end || '00:00:00'
    })
  }

  const handleStop = async () => {
    setStopping(true)
    await window.api?.cancelDownload()
  }

  async function handleUpdateYtdlp() {
    setUpdatingYtdlp(true)
    const res = await window.api?.updateYtdlp()
    setUpdatingYtdlp(false)
    if (res?.success) {
      setYtdlpUpdate(null)
      setToast({ success: true, message: `yt-dlp updated to ${res.version || 'latest'}` })
    } else {
      setToast({ success: false, message: 'yt-dlp update failed — see console' })
    }
  }

  const handleClearLogs = () => {
    setLogs([])
    setProgress(0)
  }

  const toggleTrack = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () => setSelected(new Set(playlistTracks.map((t) => t.id)))
  const deselectAll = () => setSelected(new Set())

  const urlRing =
    urlState === null
      ? 'rgba(255,255,255,0.10)'
      : urlState === 'invalid'
        ? 'rgba(239,68,68,0.45)'
        : 'rgba(52,211,153,0.40)'

  const downloadLabel =
    mode === 'playlist'
      ? selected.size > 0
        ? `DOWNLOAD ALL (${selected.size} TRACKS)`
        : 'SELECT TRACKS TO DOWNLOAD'
      : 'DOWNLOAD'

  // Embed toggle is available for audio (single) and playlists. It's hidden while
  // Trim is open — embedding isn't applied to trimmed audio anyway — which also
  // frees the room the START/END fields need.
  const showEmbed = (mode === 'single' && format === 'audio') || mode === 'playlist'
  const embedHiddenByTrim = mode === 'single' && useRange

  /* ---------------------------------------------------------------------- */
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-base text-text-primary">
      {/* Ambient background */}
      <div className="amb">
        <span className="blob blob1" />
        <span className="blob blob2" />
        <span className="blob blob3" />
      </div>
      <div className="grain" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 px-6 pb-4 pt-4">
        {/* Update banner */}
        <AnimatePresence>
          {activeBanner && <UpdateBanner key={activeBanner.key} {...activeBanner} />}
        </AnimatePresence>

        {/* Everything below the banner is blocked while an update is pending */}
        <div className="relative flex min-h-0 flex-1 flex-col gap-3">
          <AnimatePresence>
            {activeBanner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute -bottom-4 -left-6 -right-6 -top-3 z-20 cursor-not-allowed bg-black/72 backdrop-blur-[4px]"
              />
            )}
          </AnimatePresence>

          {/* Top bar — brand on the left, version on the right */}
          <header className="flex shrink-0 items-center gap-3">
            <img
              src={logo}
              alt="EvroHQ YouTube Downloader"
              draggable={false}
              className="h-[46px] w-[46px] shrink-0 select-none rounded-2xl shadow-glow ring-1 ring-white/15"
            />
            <div className="min-w-0">
              <h1 className="text-[20px] font-extrabold leading-tight tracking-tight">
                <span className="bg-accent-gradient bg-clip-text font-black text-transparent">
                  EvroHQ
                </span>{' '}
                <span className="text-text-primary font-black">YouTube Downloader</span>
              </h1>
              <p className="text-[11px] font-medium text-text-secondary">
                Audio &amp; video · powered by yt-dlp &amp; ffmpeg
              </p>
            </div>
            {version && (
              <span className="ml-auto self-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] font-medium text-text-secondary">
                v{version}
              </span>
            )}
          </header>

          {/* Main two-column grid */}
          <div className="grid min-h-0 flex-1 grid-cols-[420px_1fr] gap-5">
            {/* LEFT — controls */}
            <div className="flex min-h-0 flex-col gap-3">
              {/* Controls — compact enough to fit without scrolling, even with Trim open */}
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                {/* URL field */}
                <div
                  className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-4 py-2 transition-colors focus-within:bg-white/[0.06]"
                  style={{ border: `1px solid ${urlRing}` }}
                >
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste a YouTube video or playlist link…"
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <button
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
                  >
                    <Clipboard size={15} />
                  </button>
                </div>

                {/* Format */}
                <div>
                  <SectionLabel>Format</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <FormatCard
                      active={format === 'audio'}
                      onClick={() => setFormat('audio')}
                      icon={<Music size={16} />}
                      title="Audio"
                      subtitle={audioFormat === 'wav' ? 'WAV · 44.1 kHz' : 'MP3 · 320 kbps'}
                    />
                    <FormatCard
                      active={format === 'video'}
                      onClick={() => setFormat('video')}
                      icon={<Video size={16} />}
                      title="Video"
                      subtitle="MP4 · up to 4K"
                    />
                  </div>
                </div>

                {/* Quality pills */}
                {format === 'audio' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Pill group="a" active={audioFormat === 'wav'} onClick={() => setAudioFormat('wav')}>
                      WAV · Lossless
                    </Pill>
                    <Pill group="a" active={audioFormat === 'mp3'} onClick={() => setAudioFormat('mp3')}>
                      MP3 · 320 kbps
                    </Pill>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Pill group="v" active={videoQuality === '1080'} onClick={() => setVideoQuality('1080')}>
                      1080p
                    </Pill>
                    <Pill group="v" active={videoQuality === '2k'} onClick={() => setVideoQuality('2k')}>
                      2K · 1440p
                    </Pill>
                    <Pill group="v" active={videoQuality === '4k'} onClick={() => setVideoQuality('4k')}>
                      4K · 2160p
                    </Pill>
                  </div>
                )}

                {/* Trim (single) / disabled note (playlist) */}
                {mode === 'single' ? (
                  <div>
                    <button
                      onClick={() => setUseRange((v) => !v)}
                      className="glass-soft flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left transition-colors hover:border-white/10"
                    >
                      <span className="text-sm font-medium">Trim a specific range</span>
                      <Switch on={useRange} />
                    </button>
                    <AnimatePresence initial={false}>
                      {useRange && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 grid grid-cols-2 gap-2.5">
                            <RangeInput label="Start" value={start} onChange={setStart} />
                            <RangeInput label="End" value={end} onChange={setEnd} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-white/[0.20] px-4 py-2.5 text-sm font-medium text-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                    Trimming is unavailable in playlist mode
                  </div>
                )}

                {/* Embed metadata — hidden while Trim is open (not applied to trims) */}
                {showEmbed && !embedHiddenByTrim && (
                  <EmbedToggle
                    on={embedMeta}
                    onToggle={() => setEmbedMeta((v) => !v)}
                    audioFormat={audioFormat}
                  />
                )}

              </div>

              {/* Output + download pinned to bottom */}
              <div className="flex shrink-0 flex-col gap-3">
                <div>
                  <SectionLabel>Output folder</SectionLabel>
                  <div className="glass-soft flex items-center gap-2 rounded-2xl px-3 py-2">
                    <FolderOpen size={15} className="shrink-0 text-text-secondary" />
                    <input
                      readOnly
                      value={outputFolder}
                      className="flex-1 truncate bg-transparent text-sm text-text-secondary focus:outline-none"
                    />
                    <button
                      onClick={handleChangeFolder}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {downloading ? (
                  <div className="flex gap-2">
                    <div className="glass-soft flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wide text-text-secondary">
                      <Loader2 size={16} className="animate-spin" />
                      DOWNLOADING…
                    </div>
                    <button
                      onClick={handleStop}
                      disabled={stopping}
                      className={`flex h-[52px] items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-medium transition-colors ${stopping
                        ? 'cursor-not-allowed border-white/10 bg-white/5 text-text-muted'
                        : 'border-white/10 bg-white/5 text-text-secondary hover:border-error/60 hover:text-error'
                        }`}
                    >
                      <Square size={13} />
                      {stopping ? 'Stopping…' : 'Stop'}
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={canDownload ? { scale: 0.985 } : {}}
                    onClick={handleDownload}
                    disabled={!canDownload}
                    className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wide transition-[filter,box-shadow] ${canDownload
                      ? 'bg-accent-gradient text-white shadow-glow hover:brightness-110'
                      : 'glass-soft cursor-not-allowed text-text-muted'
                      }`}
                  >
                    <Download size={16} />
                    <span>{downloadLabel}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* RIGHT — preview */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl glass p-5">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <SectionLabel className="mb-0">Preview</SectionLabel>
                <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-medium">
                  <ModeTab active={mode === 'single'} onClick={() => setMode('single')}>
                    Single video
                  </ModeTab>
                  <ModeTab active={mode === 'playlist'} onClick={() => setMode('playlist')}>
                    Playlist
                  </ModeTab>
                </div>
              </div>

              {mode === 'single' ? (
                <SinglePreview
                  info={videoInfo}
                  loading={previewLoading}
                  error={previewError}
                  empty={urlState === null}
                  sizeLabel={
                    videoInfo?.duration
                      ? `~${estSizeLabel(videoInfo.duration)} ${formatLabel}`
                      : null
                  }
                />
              ) : (
                <PlaylistPreview
                  info={playlistInfo}
                  loading={previewLoading}
                  error={previewError}
                  empty={urlState === null}
                  selected={selected}
                  onToggle={toggleTrack}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  totalSecs={totalSecs}
                  selectedSecs={selectedSecs}
                  sizeLabel={`~${estSizeLabel(selectedSecs)} ${formatLabel}`}
                />
              )}
            </div>
          </div>

          {/* Progress row — bar aligned with the preview column */}
          <div className="grid shrink-0 grid-cols-[420px_1fr] items-center gap-5">
            <span className="truncate text-right text-[11px] font-medium text-text-secondary">
              {statusText}
            </span>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-accent-gradient"
                  animate={{ width: `${downloading ? Math.max(progress, 2) : 0}%` }}
                  transition={{ ease: 'linear', duration: 0.2 }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] font-semibold text-text-secondary">
                {(downloading ? progress : 0).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Console */}
          <div className="shrink-0 overflow-hidden rounded-2xl glass-soft">
            <div className="flex items-center gap-3 border-b border-white/5 px-3.5 py-2">
              <span className="flex items-center gap-2 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-error/70" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                  <span className="h-2 w-2 rounded-full bg-success/70" />
                </span>
                &gt; Console
              </span>
              <span className="min-w-0 flex-1" />
              <span className="shrink-0 font-mono text-[10px] text-text-muted">
                {logs.length} {logs.length === 1 ? 'line' : 'lines'}
              </span>
              <button
                onClick={handleClearLogs}
                disabled={downloading || logs.length === 0}
                className={`shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium transition-colors ${downloading || logs.length === 0
                  ? 'cursor-not-allowed text-text-muted/50'
                  : 'text-text-secondary hover:border-white/20 hover:text-text-primary'
                  }`}
              >
                Clear
              </button>
            </div>
            <div
              ref={logRef}
              className="log-scroll h-[92px] overflow-y-auto px-3.5 py-2 font-mono text-[11px] leading-relaxed"
            >
              {logs.length === 0 ? (
                <span className="text-text-muted">No output yet.</span>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className={TONE[logTone(line)]}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between">
            <p className="text-[11px] text-text-muted">
              Made by{' '}
              <a
                href="https://github.com/EvroHQ"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.api?.trackLink('madeby')}
                className="bg-accent-gradient bg-clip-text font-semibold text-transparent"
              >
                @EvroHQ
              </a>
            </p>
            <a
              href="https://buymeacoffee.com/evrohq"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => window.api?.trackLink('coffee')}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-accentMid/50 hover:text-text-primary"
            >
              <Coffee size={13} className="text-accentMid" />
              Buy me a coffee
            </a>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={spring}
              className="glass flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium"
              style={{
                boxShadow: `0 0 0 1px ${toast.success ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'
                  }, 0 20px 60px -12px rgba(0,0,0,0.7)`
              }}
            >
              {toast.success ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <XCircle size={16} className="text-error" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Preview panels                                                            */
/* -------------------------------------------------------------------------- */

function PreviewMessage({ icon, children, spinning }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-text-muted">
      {spinning ? <Loader2 size={26} className="animate-spin opacity-60" /> : icon}
      <p className="text-sm font-medium">{children}</p>
    </div>
  )
}

function SinglePreview({ info, loading, error, empty, sizeLabel }) {
  if (empty) {
    return (
      <PreviewMessage icon={<Film size={28} className="opacity-50" />}>
        Paste a link to preview the video
      </PreviewMessage>
    )
  }
  if (loading && !info) {
    return <PreviewMessage spinning>Fetching video details…</PreviewMessage>
  }
  if (!info) {
    return (
      <PreviewMessage icon={<Film size={28} className="opacity-50" />}>
        {error || 'No preview available'}
      </PreviewMessage>
    )
  }
  const meta = [info.channel, formatCount(info.views) && `${formatCount(info.views)} views`, relativeDate(info.uploadDate)]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="striped relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10">
        {info.thumbnail ? (
          <img src={info.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/25">
            Video thumbnail
          </span>
        )}
        {info.duration != null && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
            {fmtClock(info.duration)}
          </span>
        )}
      </div>
      <h2 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-text-primary">
        {info.title || 'Untitled video'}
      </h2>
      {meta && <p className="mt-1 text-[12px] text-text-secondary">{meta}</p>}
      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3 text-[11px]">
        <span className="text-text-secondary">
          {info.duration != null ? `Full length · ${fmtLong(info.duration)}` : 'Length unknown'}
        </span>
        {sizeLabel && <span className="font-medium text-text-body">{sizeLabel}</span>}
      </div>
    </div>
  )
}

function PlaylistPreview({
  info,
  loading,
  error,
  empty,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
  totalSecs,
  selectedSecs,
  sizeLabel
}) {
  if (empty) {
    return (
      <PreviewMessage icon={<Film size={28} className="opacity-50" />}>
        Paste a playlist link to preview
      </PreviewMessage>
    )
  }
  if (loading && !info) {
    return <PreviewMessage spinning>Fetching playlist…</PreviewMessage>
  }
  if (!info) {
    return (
      <PreviewMessage icon={<Film size={28} className="opacity-50" />}>
        {error || 'No playlist preview available'}
      </PreviewMessage>
    )
  }
  const tracks = info.tracks
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center gap-3">
        {info.cover ? (
          <img
            src={info.cover}
            alt=""
            draggable={false}
            className="h-11 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="striped h-11 w-16 shrink-0 rounded-md ring-1 ring-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-text-primary">{info.title}</h2>
          <p className="text-[12px] text-text-secondary">
            {tracks.length} tracks{totalSecs > 0 ? ` · ${fmtLong(totalSecs)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <GhostBtn onClick={onSelectAll}>Select all</GhostBtn>
          <GhostBtn onClick={onDeselectAll}>Deselect all</GhostBtn>
        </div>
      </div>

      {/* Tracks */}
      <div className="list-scroll -mr-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-2">
        {tracks.map((t, i) => {
          const checked = selected.has(t.id)
          return (
            <button
              key={t.id}
              onClick={() => onToggle(t.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              style={{ opacity: checked ? 1 : 0.45 }}
            >
              <span
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] transition-colors ${checked ? 'bg-accent-gradient' : 'border border-white/25'
                  }`}
              >
                {checked && <Check size={12} className="text-white" strokeWidth={3} />}
              </span>
              <span className="w-5 shrink-0 text-right font-mono text-[11px] text-text-muted">
                {pad2(i + 1)}
              </span>
              {t.thumbnail ? (
                <img
                  src={t.thumbnail}
                  alt=""
                  draggable={false}
                  className="h-7 w-11 shrink-0 rounded object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="striped h-7 w-11 shrink-0 rounded ring-1 ring-white/10" />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                {t.title}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-text-secondary">
                {t.duration != null ? fmtClock(t.duration) : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex shrink-0 items-center justify-between border-t border-white/5 pt-3 text-[11px]">
        <span className="text-text-secondary">
          {selected.size} of {tracks.length} selected{selectedSecs > 0 ? ` · ${fmtLong(selectedSecs)}` : ''}
        </span>
        <span className="font-medium text-text-body">{sizeLabel}</span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function UpdateBanner({ title, subtitle, actionLabel, onAction, busy, progress }) {
  const showBar = typeof progress === 'number'
  const pct = showBar ? Math.round(progress) : 0
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="relative z-30 shrink-0 overflow-hidden"
    >
      <div className="banner-grad flex items-center gap-3 rounded-2xl px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-gradient shadow-glow">
          <ChevronDown size={18} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-primary">{title}</p>
          <p className="truncate text-[11px] text-text-secondary">{subtitle}</p>
        </div>
        <div className="shrink-0">
          {showBar ? (
            <div className="flex w-[150px] items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent-gradient transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-secondary">
                {pct}%
              </span>
            </div>
          ) : (
            actionLabel && (
              <button
                onClick={onAction}
                disabled={busy}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity ${busy ? 'cursor-not-allowed bg-white/10 text-text-muted' : 'bg-accent-gradient shadow-glow'
                  }`}
              >
                {actionLabel}
              </button>
            )
          )}
        </div>
      </div>
    </motion.div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <label
      className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted ${className}`}
    >
      {children}
    </label>
  )
}

function FormatCard({ active, onClick, icon, title, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${active ? '' : 'bg-white/[0.04]'
        }`}
    >
      {active && (
        <motion.span
          layoutId="format-pill"
          transition={spring}
          className="absolute inset-0 rounded-2xl bg-accent-gradient shadow-glow"
        />
      )}
      <span
        className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary'
          }`}
      >
        {icon}
      </span>
      <span className="relative z-10">
        <span className={`block text-sm font-semibold ${active ? 'text-white' : 'text-text-primary'}`}>
          {title}
        </span>
        <span className={`block text-[11px] ${active ? 'text-white/80' : 'text-text-secondary'}`}>
          {subtitle}
        </span>
      </span>
    </button>
  )
}

function Pill({ active, onClick, group, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl py-3 text-center text-[13px] font-semibold transition-colors ${active ? 'text-white' : 'bg-white/[0.04] text-text-secondary'
        }`}
    >
      {active && (
        <motion.span
          layoutId={`pill-${group}`}
          transition={spring}
          className="absolute inset-0 rounded-xl bg-accent-gradient shadow-glow"
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function ModeTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-full px-3 py-1 transition-colors ${active ? 'text-white' : 'text-text-secondary hover:text-text-primary'
        }`}
    >
      {active && (
        <motion.span
          layoutId="mode-tab"
          transition={spring}
          className="absolute inset-0 rounded-full bg-accent-gradient"
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function GhostBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
    >
      {children}
    </button>
  )
}

function EmbedToggle({ on, onToggle, audioFormat }) {
  return (
    <button
      onClick={onToggle}
      className="glass-soft flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:border-white/10"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">Embed metadata &amp; cover art</span>
        <span className="block text-[11px] text-text-secondary">
          {audioFormat === 'mp3'
            ? 'Tags + thumbnail written into the MP3'
            : 'Tags written into the file (cover art needs MP3)'}
        </span>
      </span>
      <Switch on={on} />
    </button>
  )
}

function Switch({ on }) {
  return (
    <span
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-accent-gradient' : 'bg-white/10'
        }`}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? '18px' : '2px' }}
      />
    </span>
  )
}

function RangeInput({ label, value, onChange }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <input
        value={value}
        onChange={(e) => onChange(formatTimeInput(e.target.value))}
        inputMode="numeric"
        maxLength={8}
        placeholder="hh:mm:ss"
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-mono text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accentMid/70 focus:outline-none"
      />
    </div>
  )
}
