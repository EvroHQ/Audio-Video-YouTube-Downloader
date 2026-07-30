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
  Square
} from 'lucide-react'

const YT_REGEX = /(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i

export default function App() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('audio')
  const [audioFormat, setAudioFormat] = useState('wav')
  const [videoQuality, setVideoQuality] = useState('1080')
  const [useRange, setUseRange] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [outputFolder, setOutputFolder] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(null)

  const logRef = useRef(null)

  const urlValid = useMemo(() => (url.trim() ? YT_REGEX.test(url.trim()) : null), [url])

  // Load persisted config + wire up log/complete listeners.
  useEffect(() => {
    window.api?.getConfig().then((cfg) => {
      if (cfg?.outputFolder) setOutputFolder(cfg.outputFolder)
    })

    const offLog = window.api?.onLog((line) => {
      const match = line.match(/(\d+(?:\.\d+)?)%/)
      if (match) setProgress(Math.round(parseFloat(match[1])))
      // Round any percentage in the log line to a whole number.
      const clean = line.replace(/(\d+(?:\.\d+)?)%/g, (_m, n) => `${Math.round(parseFloat(n))}%`)
      setLogs((prev) => [...prev, clean])
    })

    const offComplete = window.api?.onComplete((payload) => {
      setDownloading(false)
      setStopping(false)
      setProgress(payload.success ? 100 : 0)
      setToast({ success: payload.success, message: payload.message })
    })

    return () => {
      offLog && offLog()
      offComplete && offComplete()
    }
  }, [])

  // Auto-scroll the log to the bottom.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
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

  const [stopping, setStopping] = useState(false)

  const handleStop = async () => {
    setStopping(true)
    await window.api?.cancelDownload()
  }

  const borderColor =
    urlValid === null ? '#2a2a2a' : urlValid ? '#10b981' : '#ef4444'

  return (
    <div className="flex h-screen w-screen flex-col bg-base px-6 py-5 text-text-primary">
      {/* Header */}
      <header className="mb-3 flex items-center gap-3.5">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="relative h-14 w-14 shrink-0"
        >
          {/* animated flowing gradient squircle */}
          <motion.div
            className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.15rem] ring-1 ring-white/15"
            style={{
              backgroundImage:
                'linear-gradient(115deg, #6366f1, #a855f7, #ec4899, #a855f7, #6366f1)',
              backgroundSize: '300% 300%'
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          >
            {/* glass top highlight */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"
            />
            {/* subtle inner ring */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[1.15rem] ring-1 ring-inset ring-white/10"
            />
            <Download size={26} strokeWidth={2.6} className="relative text-white" />
          </motion.div>
        </motion.div>
        <div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight">
            <span className="bg-accent-gradient bg-clip-text text-transparent">YouTube</span>{' '}
            Downloader
          </h1>
          <p className="text-xs text-text-secondary">
            powered by yt-dlp & ffmpeg
          </p>
        </div>
      </header>

      {/* URL input */}
      <div className="mb-3">
        <div
          className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 transition-colors"
          style={{ borderColor }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your YouTube URL here..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          <button
            onClick={handlePaste}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-[#0f0f0f] px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accentStart hover:text-text-primary"
          >
            <Clipboard size={14} />
            Paste
          </button>
        </div>
      </div>

      {/* Format selection */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <FormatCard
          active={format === 'audio'}
          onClick={() => setFormat('audio')}
          icon={<Music size={20} />}
          title="Audio"
          subtitle={audioFormat === 'wav' ? 'WAV 44.1kHz stereo' : 'MP3 320 kbps'}
        />
        <FormatCard
          active={format === 'video'}
          onClick={() => setFormat('video')}
          icon={<Video size={20} />}
          title="Video"
          subtitle={
            'MP4 · ' +
            (videoQuality === '4k' ? '4K (2160p)' : videoQuality === '2k' ? '2K (1440p)' : '1080p')
          }
        />
      </div>

      {/* Quality sub-selection */}
      <div className="mb-3">
        <AnimatePresence mode="wait">
          {format === 'audio' ? (
            <motion.div
              key="audio-quality"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-2 gap-2.5"
            >
              <QualityPill
                active={audioFormat === 'wav'}
                onClick={() => setAudioFormat('wav')}
                label="WAV"
                sub="44.1 kHz · lossless"
              />
              <QualityPill
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
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-3 gap-2.5"
            >
              <QualityPill
                active={videoQuality === '1080'}
                onClick={() => setVideoQuality('1080')}
                label="1080p"
                sub="Full HD"
              />
              <QualityPill
                active={videoQuality === '2k'}
                onClick={() => setVideoQuality('2k')}
                label="2K"
                sub="1440p"
              />
              <QualityPill
                active={videoQuality === '4k'}
                onClick={() => setVideoQuality('4k')}
                label="4K"
                sub="2160p max"
              />
            </motion.div>
          )}
        </AnimatePresence>
        {format === 'video' && (
          <p className="mt-2 text-center text-[11px] text-text-secondary">
            Highest available up to the chosen resolution — video includes audio.
          </p>
        )}
      </div>

      {/* Range toggle */}
      <div className="mb-3">
        <button
          onClick={() => setUseRange((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-left"
        >
          <span className="text-sm font-medium">Download a specific range</span>
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${useRange ? 'bg-accent-gradient' : 'bg-[#3a3a3a]'
              }`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
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
              <div className="mt-3 grid grid-cols-2 gap-3">
                <RangeInput label="Start" value={start} onChange={setStart} />
                <RangeInput label="End" value={end} onChange={setEnd} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Output folder */}
      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
          Output folder
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={outputFolder}
            className="flex-1 truncate rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-text-secondary focus:outline-none"
          />
          <button
            onClick={handleChangeFolder}
            className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accentStart hover:text-text-primary"
          >
            <FolderOpen size={14} />
            Change
          </button>
        </div>
      </div>

      {/* Download / Stop buttons */}
      {downloading ? (
        <div className="mb-2 flex gap-2">
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2a2a2a] py-3 text-sm font-bold tracking-wide text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Downloading...
          </div>
          <motion.button
            whileTap={!stopping ? { scale: 0.98 } : {}}
            onClick={handleStop}
            disabled={stopping}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${stopping
              ? 'cursor-not-allowed border-surface-border bg-surface text-text-secondary'
              : 'border-surface-border bg-surface text-text-secondary hover:border-error hover:text-error'
              }`}
          >
            <Square size={14} />
            {stopping ? 'Stopping...' : 'Stop'}
          </motion.button>
        </div>
      ) : (
        <motion.button
          whileHover={canDownload ? { scale: 1.02 } : {}}
          whileTap={canDownload ? { scale: 0.99 } : {}}
          onClick={handleDownload}
          disabled={!canDownload}
          className={`mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold tracking-wide text-white transition-opacity ${canDownload
            ? 'bg-accent-gradient shadow-lg shadow-fuchsia-500/20'
            : 'cursor-not-allowed bg-[#2a2a2a] text-text-secondary'
            }`}
        >
          <Download size={16} />
          DOWNLOAD
        </motion.button>
      )}

      {/* Progress bar */}
      <AnimatePresence>
        {downloading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                <motion.div
                  className="h-full rounded-full bg-accent-gradient"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'linear', duration: 0.2 }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-text-secondary">
                {Math.round(progress)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log area */}
      <div
        ref={logRef}
        className="log-scroll mt-2 min-h-[110px] flex-1 overflow-y-auto rounded-xl border border-surface-border bg-[#050505] p-3 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <span className="text-text-secondary">Logs will appear here...</span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={
                /error/i.test(line) ? 'text-error' : 'text-success'
              }
            >
              {line}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-center pt-3 text-center">
        <p className="text-xs text-text-secondary">
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

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-xl"
            style={{
              backgroundColor: '#1a1a1a',
              borderColor: toast.success ? '#10b981' : '#ef4444'
            }}
          >
            {toast.success ? (
              <CheckCircle2 size={16} className="text-success" />
            ) : (
              <XCircle size={16} className="text-error" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FormatCard({ active, onClick, icon, title, subtitle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-xl p-[1.5px] text-left transition-all"
      style={{
        background: active
          ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
          : '#2a2a2a'
      }}
    >
      <div
        className={`flex items-center gap-3 rounded-[10px] bg-surface px-4 py-3 transition-shadow ${active ? 'shadow-[0_0_20px_rgba(168,85,247,0.25)]' : ''
          }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-accent-gradient text-white' : 'bg-[#0f0f0f] text-text-secondary'
            }`}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <div className="text-xs text-text-secondary">{subtitle}</div>
        </div>
      </div>
    </motion.button>
  )
}

function QualityPill({ active, onClick, label, sub }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="rounded-xl p-[1.5px] text-center transition-all"
      style={{
        background: active ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : '#2a2a2a'
      }}
    >
      <div
        className={`rounded-[10px] bg-surface px-2 py-2 ${active ? 'shadow-[0_0_16px_rgba(168,85,247,0.22)]' : ''
          }`}
      >
        <div
          className={`text-sm font-bold ${active ? 'text-text-primary' : 'text-text-secondary'}`}
        >
          {label}
        </div>
        <div className="text-[10px] text-text-secondary">{sub}</div>
      </div>
    </motion.button>
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
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(formatTimeInput(e.target.value))}
        inputMode="numeric"
        maxLength={8}
        placeholder="hh:mm:ss"
        className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-center font-mono text-sm text-text-primary placeholder:text-text-secondary focus:border-accentStart focus:outline-none"
      />
    </div>
  )
}
