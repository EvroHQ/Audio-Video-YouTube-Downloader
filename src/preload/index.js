import { contextBridge, ipcRenderer } from 'electron'

const api = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (cfg) => ipcRenderer.invoke('set-config', cfg),
  startDownload: (params) => ipcRenderer.invoke('start-download', params),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  getChapters: (url) => ipcRenderer.invoke('get-chapters', url),
  checkYtdlpUpdate: () => ipcRenderer.invoke('check-ytdlp-update'),
  updateYtdlp: () => ipcRenderer.invoke('update-ytdlp'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onAppUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('app-update', listener)
    return () => ipcRenderer.removeListener('app-update', listener)
  },
  onLog: (callback) => {
    const listener = (_event, line) => callback(line)
    ipcRenderer.on('download-log', listener)
    return () => ipcRenderer.removeListener('download-log', listener)
  },
  onComplete: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('download-complete', listener)
    return () => ipcRenderer.removeListener('download-complete', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}
