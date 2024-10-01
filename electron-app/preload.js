// main/preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getChargerData: () => ipcRenderer.invoke('get-charger-data'),
  onChargerData: (callback) => ipcRenderer.on('charger-data', (event, message) => callback(message)),
});
