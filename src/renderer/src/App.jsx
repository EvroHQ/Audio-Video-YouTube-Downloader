import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Clipboard,
  Music,
  Video,
  FolderOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  Square,
  ArrowUpCircle,
  Link2,
  Scissors,
  Terminal
} from 'lucide-react'

const spring = { type: 'spring', stiffness: 420, damping: 34 }

// Accept only real YouTube video links (lenient about a missing scheme).
function isYouTubeUrl(value) {
  let v = String(value ?? '').trim()
  if (!v) return false
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const allowed = [
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
      'youtube-nocookie.com'
    ]
    if (!allowed.includes(host)) return false
    if (host === 'youtu.be') return u.pathname.length > 1
    if (u.pathname === '/watch') return u.searchParams.has('v')
    return /^\/(shorts|live|embed|v)\/[\w-]+/.test(u.pathname)
  } catch {
    return false
  }
}

export default function App() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('audio')
  const [audioFormat, setAudioFormat] = useState('wav')
  const [videoQuality, setVideoQuality] = useState('1080')
  const [useRange, setUseRange] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [outputFolder, setOutputFolder] = useState('')
  const [version, setVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const [ytdlpUpdate, setYtdlpUpdate] = useState(null)
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false)
  const [appUpdate, setAppUpdate] = useState(null)

  const logRef = useRef(null)

  const urlValid = useMemo(() => (url.trim() ? isYouTubeUrl(url) : null), [url])

  useEffect(() => {
    window.api?.getConfig().then((cfg) => {
      if (cfg?.outputFolder) setOutputFolder(cfg.outputFolder)
      if (cfg?.version) setVersion(cfg.version)
    })

    const offLog = window.api?.onLog((line) => {
      const match = line.match(/(\d+(?:\.\d+)?)%/)
      if (match) setProgress(Math.round(parseFloat(match[1])))
      const clean = line.replace(/(\d+(?:\.\d+)?)%/g, (_m, n) => `${Math.round(parseFloat(n))}%`)
      setLogs((prev) => [...prev, clean])
    })

    const offComplete = window.api?.onComplete((payload) => {
      setDownloading(false)
      setStopping(false)
      setProgress(payload.success ? 100 : 0)
      setToast({ success: payload.success, message: payload.message })
    })

    const offAppUpdate = window.api?.onAppUpdate((payload) => {
      setAppUpdate(payload)
    })

    window.api?.checkYtdlpUpdate().then((res) => {
      if (res?.updateAvailable) setYtdlpUpdate(res)
    })

    return () => {
      offLog && offLog()
      offComplete && offComplete()
      offAppUpdate && offAppUpdate()
    }
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch (e) {
      setLogs((prev) => [...prev, `[--:--:--] Could not read clipboard: ${e.message}`])
    }
  }

  const handleChangeFolder = async () => {
    const folder = await window.api?.selectFolder()
    if (folder) setOutputFolder(folder)
  }

  const canDownload = urlValid === true && !downloading

  const handleDownload = async () => {
    if (!canDownload) return
    setDownloading(true)
    setStopping(false)
    setProgress(0)
    setLogs((prev) => [...prev, `[--:--:--] Sending request...`])
    await window.api?.startDownload({
      url: url.trim(),
      format,
      audioFormat,
      videoQuality,
      useRange,
      start: start || '00:00:00',
      end: end || '00:00:00'
    })
  }

  const handleStop = async () => {
    setStopping(true)
    await window.api?.cancelDownload()
  }

  const handleUpdateYtdlp = async () => {
    setUpdatingYtdlp(true)
    const res = await window.api?.updateYtdlp()
    setUpdatingYtdlp(false)
    if (res?.success) {
      setYtdlpUpdate(null)
      setToast({ success: true, message: `yt-dlp updated to ${res.version || 'latest'}` })
    } else {
      setToast({ success: false, message: 'yt-dlp update failed — see logs' })
    }
  }

  const handleInstallApp = async () => {
    await window.api?.installUpdate()
  }

  const urlRing =
    urlValid === null
      ? 'rgba(255,255,255,0.09)'
      : urlValid
        ? 'rgba(52,211,153,0.55)'
        : 'rgba(248,113,113,0.55)'

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-base text-text-primary">
      {/* Aurora background */}
      <div className="aurora">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
      </div>
      <div className="grain" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col px-6 py-5">
        {/* Header */}
        <header className="mb-6 flex shrink-0 items-center gap-3.5">
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16 }}
            className="relative h-[52px] w-[52px] shrink-0"
          >
            <div
              className="relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-2xl shadow-glow ring-1 ring-white/15 bg-accent-gradient animate-gradient-pan"
              style={{ backgroundSize: '200% 200%' }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent"
              />
              <Download size={24} strokeWidth={2.6} className="relative text-white" />
            </div>
          </motion.div>
          <div>
            <h1 className="text-[22px] font-extrabold leading-none tracking-tight">
              <span className="bg-accent-gradient bg-clip-text text-transparent">YouTube</span>{' '}
              <span className="text-text-primary">Downloader</span>
            </h1>
            <p className="mt-1 text-[11px] font-medium text-text-secondary">
              Audio &amp; video · powered by yt-dlp &amp; ffmpeg
            </p>
          </div>
          {version && (
            <span className="ml-auto self-start rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] font-medium text-text-secondary">
              v{version}
            </span>
          )}
        </header>

        {/* Update banners */}
        <AnimatePresence>
          {appUpdate?.status === 'downloaded' ? (
            <UpdateBanner
              key="app-update"
              text={`App update v${appUpdate.version} is ready.`}
              actionLabel="Restart & install"
              onAction={handleInstallApp}
            />
          ) : ytdlpUpdate ? (
            <UpdateBanner
              key="ytdlp-update"
              text={`yt-dlp update available (${ytdlpUpdate.latest}).`}
              actionLabel={updatingYtdlp ? 'Updating…' : 'Update now'}
              onAction={handleUpdateYtdlp}
              busy={updatingYtdlp}
            />
          ) : null}
        </AnimatePresence>

        {/* URL input */}
        <div className="mb-4 shrink-0">
          <div
            className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 transition-shadow"
            style={{ boxShadow: `0 0 0 1px ${urlRing}, 0 8px 32px -8px rgba(0,0,0,0.6)` }}
          >
            <Link2 size={16} className="shrink-0 text-text-secondary" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube link…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <AnimatePresence mode="wait">
              {urlValid === true && (
                <motion.span
                  key="ok"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                >
                  <CheckCircle2 size={16} className="text-success" />
                </motion.span>
              )}
              {urlValid === false && (
                <motion.span
                  key="bad"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                >
                  <XCircle size={16} className="text-error" />
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
            >
              <Clipboard size={13} />
              Paste
            </button>
          </div>
        </div>

        {/* Format segmented control */}
        <div className="mb-4 grid shrink-0 grid-cols-2 gap-2 rounded-2xl glass-soft p-1.5">
          <FormatOption
            active={format === 'audio'}
            onClick={() => setFormat('audio')}
            icon={<Music size={18} />}
            title="Audio"
            subtitle={audioFormat === 'wav' ? 'WAV · 44.1 kHz' : 'MP3 · 320 kbps'}
          />
          <FormatOption
            active={format === 'video'}
            onClick={() => setFormat('video')}
            icon={<Video size={18} />}
            title="Video"
            subtitle={
              'MP4 · ' +
              (videoQuality === '4k' ? '4K' : videoQuality === '2k' ? '2K' : '1080p')
            }
          />
        </div>

        {/* Quality sub-selection */}
        <div className="mb-4 shrink-0">
          {format === 'audio' ? (
            <motion.div
              key="audio-quality"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-2 gap-2"
            >
              <QualityPill
                group="audio"
                active={audioFormat === 'wav'}
                onClick={() => setAudioFormat('wav')}
                label="WAV"
                sub="Lossless"
              />
              <QualityPill
                group="audio"
                active={audioFormat === 'mp3'}
                onClick={() => setAudioFormat('mp3')}
                label="MP3"
                sub="320 kbps"
              />
            </motion.div>
          ) : (
            <motion.div
              key="video-quality"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-3 gap-2"
            >
                <QualityPill
                  group="video"
                  active={videoQuality === '1080'}
                  onClick={() => setVideoQuality('1080')}
                  label="1080p"
                  sub="Full HD"
                />
                <QualityPill
                  group="video"
                  active={videoQuality === '2k'}
                  onClick={() => setVideoQuality('2k')}
                  label="2K"
                  sub="1440p"
                />
                <QualityPill
                  group="video"
                  active={videoQuality === '4k'}
                  onClick={() => setVideoQuality('4k')}
                  label="4K"
                  sub="2160p"
                />
            </motion.div>
          )}
        </div>

        {/* Range toggle */}
        <div className="mb-4 shrink-0">
          <button
            onClick={() => setUseRange((v) => !v)}
            className="glass-soft flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left transition-colors hover:border-white/10"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <Scissors size={15} className="text-text-secondary" />
              Trim a specific range
            </span>
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                useRange ? 'bg-accent-gradient' : 'bg-white/10'
              }`}
            >
              <motion.span
                layout
                transition={spring}
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                style={{ left: useRange ? '18px' : '2px' }}
              />
            </span>
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
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <RangeInput label="Start" value={start} onChange={setStart} />
                  <RangeInput label="End" value={end} onChange={setEnd} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Output folder */}
        <div className="mb-4 shrink-0">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Output folder
          </label>
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

        {/* Download / Stop */}
        {downloading ? (
          <div className="mb-4 flex shrink-0 gap-2">
            <div className="glass-soft flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold tracking-wide text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Downloading…
            </div>
            <motion.button
              whileTap={!stopping ? { scale: 0.98 } : {}}
              onClick={handleStop}
              disabled={stopping}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-medium transition-colors ${
                stopping
                  ? 'cursor-not-allowed border-white/10 bg-white/5 text-text-muted'
                  : 'border-white/10 bg-white/5 text-text-secondary hover:border-error/60 hover:text-error'
              }`}
            >
              <Square size={13} />
              {stopping ? 'Stopping…' : 'Stop'}
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={canDownload ? { scale: 0.985 } : {}}
            onClick={handleDownload}
            disabled={!canDownload}
            className={`mb-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold tracking-wide transition-[filter,box-shadow] ${
              canDownload
                ? 'bg-accent-gradient text-white shadow-glow hover:brightness-110'
                : 'cursor-not-allowed glass-soft text-text-muted'
            }`}
          >
            <Download size={16} />
            <span>DOWNLOAD</span>
          </motion.button>
        )}

        {/* Progress bar */}
        <AnimatePresence>
          {downloading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.14] ring-1 ring-inset ring-white/10">
                <motion.div
                  className="h-full rounded-full bg-accent-gradient"
                  animate={{ width: `${Math.max(progress, 2)}%` }}
                  transition={{ ease: 'linear', duration: 0.2 }}
                />
              </div>
              <span className="w-9 text-right font-mono text-xs font-normal text-white/60">
                {Math.round(progress)}%
              </span>
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Log console */}
        <div className="flex min-h-[130px] flex-1 flex-col overflow-hidden rounded-2xl glass-soft">
          <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <Terminal size={12} />
            Console
          </div>
          <div
            ref={logRef}
            className="log-scroll flex-1 overflow-y-auto px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed"
          >
            {logs.length === 0 ? (
              <span className="text-text-muted">Waiting for a link…</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={/error/i.test(line) ? 'text-error' : 'text-success/90'}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-center pt-3">
          <p className="text-[11px] text-text-muted">
            made by{' '}
            <a
              href="https://github.com/EvroHQ"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent-gradient bg-clip-text font-semibold text-transparent"
            >
              @EvroHQ
            </a>
          </p>
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
              className="glass flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium shadow-glass"
              style={{ boxShadow: `0 0 0 1px ${toast.success ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)'}, 0 20px 60px -12px rgba(0,0,0,0.7)` }}
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

function UpdateBanner({ text, actionLabel, onAction, busy }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-accentMid/40 bg-accent-gradient-soft px-3.5 py-2.5">
        <ArrowUpCircle size={16} className="shrink-0 text-accentMid" />
        <span className="flex-1 text-xs text-text-primary">{text}</span>
        <button
          onClick={onAction}
          disabled={busy}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity ${
            busy ? 'cursor-not-allowed bg-white/10 text-text-muted' : 'bg-accent-gradient shadow-glow'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </motion.div>
  )
}

function FormatOption({ active, onClick, icon, title, subtitle }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors"
    >
      {active && (
        <motion.span
          layoutId="format-pill"
          transition={spring}
          className="absolute inset-0 rounded-xl bg-accent-gradient shadow-glow"
        />
      )}
      <span
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary'
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

function QualityPill({ active, onClick, label, sub, group }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-xl px-2 py-2 text-center transition-colors glass-soft"
    >
      {active && (
        <motion.span
          layoutId={`${group}-quality-pill`}
          transition={spring}
          className="absolute inset-0 rounded-xl bg-accent-gradient shadow-glow"
        />
      )}
      <span className="relative z-10 block">
        <span className={`block text-sm font-bold ${active ? 'text-white' : 'text-text-primary'}`}>
          {label}
        </span>
        <span className={`block text-[10px] ${active ? 'text-white/80' : 'text-text-secondary'}`}>
          {sub}
        </span>
      </span>
    </button>
  )
}

// Auto-insert colons as the user types digits: "001030" -> "00:10:30".
function formatTimeInput(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 6)
  if (d.length > 4) return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4)}`
  if (d.length > 2) return `${d.slice(0, 2)}:${d.slice(2)}`
  return d
}

function RangeInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </label>
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
