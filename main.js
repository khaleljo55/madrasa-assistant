// المساعد الإداري — البرنامج المثبَّت (Electron)
// الواجهة كاملة داخل مجلد app وتعمل دون متصفح؛ البيانات محفوظة داخل البرنامج على الجهاز.
const { app, BrowserWindow, ipcMain, shell, Menu, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

const APP_ID = 'sa.school.madrasa-assistant';
const UPDATE_REPO = 'khaleljo55/madrasa-assistant'; // تُنشر ملفات التثبيت الجديدة في Releases بهذا المستودع
let win = null;

// نسخة واحدة فقط من البرنامج
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: 'المساعد الإداري',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#f4f6f5',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      plugins: true, // عارض PDF المدمج
    },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // قبل الإغلاق: نطلب من الواجهة حفظ آخر التعديلات ثم نغلق (حماية من فقد آخر تعديل)
  let flushed = false;
  win.on('close', (e) => {
    if (flushed || smokeArg) return;
    e.preventDefault();
    const done = () => { flushed = true; if (!win.isDestroyed()) win.close(); };
    ipcMain.once('app:flushed', done);
    win.webContents.send('app:flush');
    setTimeout(done, 1500);
  });

  // الروابط: صفحات الإنترنت (Gmail وغيرها) تُفتح في المتصفح الافتراضي، والملفات الداخلية (PDF وصور) في نافذة عرض
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, 'build', 'icon.ico'), webPreferences: { plugins: true, sandbox: true } },
    };
  });
  // منع الانتقال خارج البرنامج
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
}

// التنزيلات تُحفظ مباشرة في مجلد «التنزيلات» دون سؤال، باسم لا يستبدل ملفاً موجوداً
function uniquePath(dir, name) {
  const ext = path.extname(name), base = path.basename(name, ext);
  let p = path.join(dir, name), i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}
function setupDownloads() {
  session.defaultSession.on('will-download', (_e, item) => {
    const target = uniquePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(target);
    item.once('done', (_ev, state) => {
      if (state === 'completed' && win && !win.isDestroyed()) win.webContents.send('download:done', { name: path.basename(target), path: target });
    });
  });
}

// فحص آلي يُستخدم أثناء البناء فقط: يفتح البرنامج، ويتأكد أن الواجهة تعمل، ويحفظ تقريراً وصورة ثم يغلق
const smokeArg = process.argv.find((a) => a.startsWith('--smoke-test='));
function runSmokeTest(outDir) {
  const errors = [];
  const report = (data) => { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'smoke.json'), JSON.stringify(data, null, 2)); };
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });
  win.webContents.on('render-process-gone', (_e, d) => { report({ ok: false, reason: 'renderer gone', details: d }); app.exit(1); });
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const res = await win.webContents.executeJavaScript(`(async () => {
          const out = { title: document.title, navItems: document.querySelectorAll('.nav-item').length, hasDb: typeof db === 'object' && !!db };
          const views = ['dashboard','tasks','calendar','report','teachers','timetable','absence','entries','duties','break','occasions','visits','library','quran','tools','settings'];
          out.views = {};
          for (const v of views) { try { go(v); await new Promise(r => setTimeout(r, 150)); out.views[v] = document.querySelector('#view').innerHTML.length > 50; } catch (e) { out.views[v] = 'ERR ' + e.message; } }
          go('dashboard');
          // حفظ واسترجاع من قاعدة البيانات
          db.teachers.push({ id: 'smoke', name: 'اختبار' }); commit(); await new Promise(r => setTimeout(r, 900));
          const back = await IDB.get('kv', 'db'); out.persist = !!(back && back.teachers.some(t => t.id === 'smoke'));
          db.teachers = db.teachers.filter(t => t.id !== 'smoke'); commit(); await new Promise(r => setTimeout(r, 600));
          out.native = !!window.madrasaNative; out.voice = !!api.voiceStart; out.dirPicker = typeof showDirectoryPicker === 'function';
          return out;
        })()`);
        const img = await win.webContents.capturePage();
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'screenshot.png'), img.toPNG());
        const ok = res.hasDb && res.persist && res.native && Object.values(res.views).every((v) => v === true) && errors.filter((m) => !/Failed to load resource/.test(m)).length === 0;
        report({ ok, electron: process.versions.electron, ...res, errors });
        app.exit(ok ? 0 : 1);
      } catch (e) { report({ ok: false, reason: e.message, errors }); app.exit(1); }
    }, 2500);
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID); // لظهور الإشعارات باسم البرنامج في ويندوز
  Menu.setApplicationMenu(null);
  setupDownloads();
  createWindow();
  if (smokeArg) runSmokeTest(smokeArg.split('=')[1]);
});
app.on('window-all-closed', () => app.quit());

ipcMain.handle('open:path', (_e, p) => shell.openPath(String(p)));
ipcMain.handle('app:version', () => app.getVersion());

// ───────── التحديث التلقائي ─────────
// يقرأ أحدث إصدار منشور في GitHub Releases، ويقارنه بالإصدار الحالي، وينزّل ملف التثبيت ويشغّله.
const verParts = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
function isNewer(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
ipcMain.handle('update:check', async () => {
  try {
    const r = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { 'User-Agent': 'MadrasaAssistant', Accept: 'application/vnd.github+json' } });
    if (!r.ok) return { available: false, error: 'HTTP ' + r.status };
    const j = await r.json();
    const asset = (j.assets || []).find((a) => /\.exe$/i.test(a.name));
    const version = String(j.tag_name || '').replace(/^v/i, '');
    if (!asset || !isNewer(version, app.getVersion())) return { available: false, current: app.getVersion(), latest: version };
    return { available: true, version, url: asset.browser_download_url, size: asset.size, notes: j.body || '' };
  } catch (e) { return { available: false, error: e.message }; }
});
ipcMain.handle('update:install', async (_e, url) => {
  try {
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)\//.test(String(url))) throw new Error('رابط غير موثوق');
    const r = await net.fetch(url, { headers: { 'User-Agent': 'MadrasaAssistant' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = Number(r.headers.get('content-length')) || 0;
    const file = path.join(app.getPath('temp'), `Madrasa-Assistant-Update-${Date.now()}.exe`);
    const out = fs.createWriteStream(file);
    const reader = r.body.getReader(); let got = 0, lastPct = -1;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      got += value.length; out.write(Buffer.from(value));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== lastPct && win && !win.isDestroyed()) { lastPct = pct; win.webContents.send('update:progress', pct); }
    }
    await new Promise((res, rej) => out.end((err) => (err ? rej(err) : res())));
    if (total && got < total) throw new Error('التنزيل غير مكتمل');
    // نحفظ البيانات أولاً ثم نشغّل المثبّت ونغلق البرنامج
    setTimeout(() => { shell.openPath(file); setTimeout(() => app.quit(), 800); }, 600);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('show:folder', (_e, p) => shell.showItemInFolder(String(p)));

// ───────── الإملاء الصوتي ─────────
// محرّك التعرّف على الصوت العربي متاح في متصفح Edge، فيفتح البرنامج نافذة صغيرة فيه
// وترسل النص مباشرة إلى الحقل المحدد داخل البرنامج.
let voiceServer = null, voicePort = null;
function startVoiceServer() {
  return new Promise((resolve, reject) => {
    if (voiceServer) return resolve(voicePort);
    const html = fs.readFileSync(path.join(__dirname, 'app', 'voice.html'));
    voiceServer = http.createServer((req, res) => {
      if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      if (req.method === 'POST' && req.url === '/text') {
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
        req.on('end', () => {
          try {
            const msg = JSON.parse(body);
            if (win && !win.isDestroyed()) {
              win.webContents.send('voice:text', msg);
              if (msg.done) { if (win.isMinimized()) win.restore(); win.focus(); }
            }
          } catch { /* تجاهل */ }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        });
        return;
      }
      res.writeHead(404); res.end();
    });
    const tryListen = (port) => {
      voiceServer.once('error', (err) => { if (port !== 0) tryListen(0); else reject(err); });
      voiceServer.listen(port, '127.0.0.1', () => { voicePort = voiceServer.address().port; resolve(voicePort); });
    };
    tryListen(47321);
  });
}
ipcMain.handle('voice:start', async (_e, lang) => {
  const port = await startVoiceServer();
  const url = `http://127.0.0.1:${port}/?lang=${encodeURIComponent(lang || 'ar-SA')}`;
  if (process.platform === 'win32') exec(`start "" msedge "${url}"`, (err) => { if (err) shell.openExternal(url); });
  else shell.openExternal(url);
  return true;
});
