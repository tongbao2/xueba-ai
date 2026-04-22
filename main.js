const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const MODEL_DIR = path.join(app.getPath('home'), '.xuebadi-ai', 'models');
const MODEL_FILE = 'Qwen2.5-VL-3B-Instruct-q4_k_m.gguf';
const MMPROJ_FILE = 'Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf';
const MODEL_URL   = 'https://www.modelscope.cn/models/aplux/Qwen2.5-VL-3B-Instruct-q4_k_m/resolve/master/' + MODEL_FILE;
const MMPROJ_URL  = 'https://www.modelscope.cn/models/aplux/Qwen2.5-VL-3B-Instruct-q4_k_m/resolve/master/' + MMPROJ_FILE;

let mainWindow = null;
let llamaServer = null;
let serverReady = false;

function getBinPath(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin', name)
    : name;
}
function getOcrPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'ocr-helper', 'ocr-helper')
    : path.join(__dirname, 'ocr-helper', 'ocr-helper');
}
function modelExists() {
  return fs.existsSync(path.join(MODEL_DIR, MODEL_FILE))
      && fs.existsSync(path.join(MODEL_DIR, MMPROJ_FILE));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 800, minWidth: 900, minHeight: 650,
    title: '学霸帝AI',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function startLlamaServer() {
  if (llamaServer) return;
  const bin = getBinPath('llama-server');
  const args = [
    '-m', path.join(MODEL_DIR, MODEL_FILE),
    '--mmproj', path.join(MODEL_DIR, MMPROJ_FILE),
    '--host', '127.0.0.1', '--port', '8765',
    '-ngl', '0', '-c', '4096', '-t', '4',
  ];
  console.log('[学霸帝] Launching:', bin, args.join(' '));
  llamaServer = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  llamaServer.stdout.on('data', d => {
    const m = d.toString();
    if (m.includes('listening')) { serverReady = true; notifyReady(); }
  });
  llamaServer.stderr.on('data', d => {
    const m = d.toString();
    if (m.includes('listening')) { serverReady = true; notifyReady(); }
  });
  llamaServer.on('error', e => { console.error(e); notifyStatus(false, e.message); });
  llamaServer.on('exit', () => { llamaServer = null; serverReady = false; notifyStatus(false); });
  // Fallback
  setTimeout(() => { if (!serverReady) { serverReady = true; notifyReady(); } }, 15000);
}

function notifyReady()  { if (mainWindow) mainWindow.webContents.send('server-status', { ready: true }); }
function notifyStatus(r, e) { if (mainWindow) mainWindow.webContents.send('server-status', { ready: r, error: e }); }

function stopLlamaServer() {
  if (llamaServer) { llamaServer.kill('SIGTERM'); llamaServer = null; serverReady = false; }
}

function doOcr(imagePath) {
  return new Promise(resolve => {
    execFile(getOcrPath(), [imagePath], { timeout: 30000 }, (err, stdout) => {
      resolve({ success: !err, text: err ? `OCR失败: ${err.message}` : stdout.trim() });
    });
  });
}

function doChat(messages, imgB64) {
  return new Promise(resolve => {
    if (!serverReady) { resolve({ success: false, error: '服务未就绪' }); return; }
    if (imgB64 && messages.length) {
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        last.content = [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imgB64}` } },
          { type: 'text', text: last.content },
        ];
      }
    }
    const body = JSON.stringify({ messages, max_tokens: 2048, temperature: 0.7, stream: false });
    const http = require('http');
    const req = http.request({
      hostname: '127.0.0.1', port: 8765, path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 120000,
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          resolve({ success: true, text: p.choices?.[0]?.message?.content || '(无回复)' });
        } catch(e) { resolve({ success: false, error: '解析失败: ' + d.slice(0,100) }); }
      });
    });
    req.on('error', e => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: '请求超时' }); });
    req.write(body); req.end();
  });
}

// IPC
ipcMain.handle('get-model-info', async () => {
  let ms = 0, ps = 0;
  try { ms = fs.statSync(path.join(MODEL_DIR, MODEL_FILE)).size; } catch {}
  try { ps = fs.statSync(path.join(MODEL_DIR, MMPROJ_FILE)).size; } catch {}
  return { exists: modelExists(), mainSize: ms, mmprojSize: ps, mainUrl: MODEL_URL, mmprojUrl: MMPROJ_URL, modelDir: MODEL_DIR, mainFile: MODEL_FILE, mmprojFile: MMPROJ_FILE, homeDir: app.getPath('home') };
});
ipcMain.handle('open-model-dir', async () => { fs.mkdirSync(MODEL_DIR, { recursive: true }); shell.openPath(MODEL_DIR); });
ipcMain.handle('open-url', (_, url) => shell.openExternal(url));
ipcMain.handle('start-server', async () => {
  if (!modelExists()) return { success: false, error: '请先下载模型文件' };
  startLlamaServer();
  return { success: true };
});
ipcMain.handle('stop-server', async () => { stopLlamaServer(); return { success: true }; });
ipcMain.handle('server-status', async () => ({ ready: serverReady }));
ipcMain.handle('ocr-image', (_, p) => doOcr(p));
ipcMain.handle('select-image', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片', properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg','jpeg','png','bmp','tiff','webp','gif'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('read-image-base64', (_, p) => {
  try { return fs.readFileSync(p).toString('base64'); } catch { return null; }
});
ipcMain.handle('chat', (_, messages, imgB64) => doChat(messages, imgB64));

app.whenReady().then(() => { fs.mkdirSync(MODEL_DIR, { recursive: true }); createWindow(); });
app.on('window-all-closed', () => { stopLlamaServer(); app.quit(); });
app.on('before-quit', () => stopLlamaServer());
