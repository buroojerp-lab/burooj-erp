// ============================================================
// BUROOJ HEIGHTS ERP - ELECTRON PRELOAD SCRIPT
// Exposes a safe, limited API to the renderer (React app)
// via contextBridge. No Node.js APIs are directly accessible.
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App version
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Auto-update events
  onUpdateAvailable: (callback) =>
    ipcRenderer.on('update-available', (_event, info) => callback(info)),

  onUpdateDownloaded: (callback) =>
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),

  // Trigger install of a downloaded update
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Remove a listener (cleanup)
  removeListener: (channel, callback) =>
    ipcRenderer.removeListener(channel, callback),
});
