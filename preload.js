// جسر صغير وآمن بين الواجهة وخدمات ويندوز
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('madrasaNative', {
  voiceStart: (lang) => ipcRenderer.invoke('voice:start', lang),
  onVoice: (cb) => ipcRenderer.on('voice:text', (_e, msg) => cb(msg)),
  onDownloadDone: (cb) => ipcRenderer.on('download:done', (_e, info) => cb(info)),
  openPath: (p) => ipcRenderer.invoke('open:path', p),
  showInFolder: (p) => ipcRenderer.invoke('show:folder', p),
  appVersion: () => ipcRenderer.invoke('app:version'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: (url) => ipcRenderer.invoke('update:install', url),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, p) => cb(p)),
  onFlush: (cb) => ipcRenderer.on('app:flush', () => Promise.resolve(cb()).finally(() => ipcRenderer.send('app:flushed'))),
});
