const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('xuebadi', {
  getModelInfo:      () => ipcRenderer.invoke('get-model-info'),
  openModelDir:      () => ipcRenderer.invoke('open-model-dir'),
  openUrl:           url => ipcRenderer.invoke('open-url', url),
  startServer:       () => ipcRenderer.invoke('start-server'),
  stopServer:        () => ipcRenderer.invoke('stop-server'),
  serverStatus:      () => ipcRenderer.invoke('server-status'),
  ocrImage:          p   => ipcRenderer.invoke('ocr-image', p),
  selectImage:       ()   => ipcRenderer.invoke('select-image'),
  readImageBase64:   p   => ipcRenderer.invoke('read-image-base64', p),
  chat:              (msgs, img) => ipcRenderer.invoke('chat', msgs, img),
  onServerStatus:    cb  => ipcRenderer.on('server-status', (_, d) => cb(d)),
});
