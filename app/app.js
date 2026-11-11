/* المساعد الإداري — منطق الواجهة */
'use strict';

// ═════════════ أدوات عامة ═════════════
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const DOW = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const fmtHijriObj = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtHijriDay = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric' });
const fmtHijriMonth = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long', year: 'numeric' });
const fmtHijriMonthOnly = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long' });
const fmtG = (s) => { if (!s) return ''; const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtGShort = (s) => { if (!s) return ''; const d = parse(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
const fmtH = (s) => (s ? fmtHijriObj.format(parse(s)).replace(' هـ', 'هـ') : '');
const dayName = (s) => DOW[parse(s).getDay()];
const isWeekend = (s) => [5, 6].includes(parse(s).getDay());
const inRange = (d, a, b) => d >= a && d <= (b || a);
const workDays = (a, b) => { let n = 0; for (let d = a; d <= (b || a); d = addDays(d, 1)) if (!isWeekend(d)) n++; return n; };
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const daysLabel = (n) => plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً');

// ═════════════ واجهة التخزين (تعمل على سطح المكتب أو المتصفح للمعاينة) ═════════════
// ───── التخزين: قاعدة بيانات المتصفح (IndexedDB) — تعمل دون تثبيت أي شيء ─────
const IDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('madrasa-assistant', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (store, mode, fn) => open().then((d) => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const q = fn(t.objectStore(store));
    t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error);
  }));
  return {
    get: (store, k) => tx(store, 'readonly', (s) => s.get(k)),
    put: (store, k, v) => tx(store, 'readwrite', (s) => s.put(v, k)),
    del: (store, k) => tx(store, 'readwrite', (s) => s.delete(k)),
    keys: (store) => tx(store, 'readonly', (s) => s.getAllKeys()),
  };
})();
try { navigator.storage?.persist?.(); } catch { }
const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataUrlToBlob = async (u) => {
  const [head, b64] = u.split(','); const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};
function openBlob(blob, name, download) {
  const url = URL.createObjectURL(blob);
  if (download) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
  else window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const api = window.api || {
  isDesktop: false,
  load: async () => {
    try {
      let d = await IDB.get('kv', 'db');
      if (!d) { const old = localStorage.getItem('madrasa-db'); if (old) d = JSON.parse(old); }
      return d || null;
    } catch { try { return JSON.parse(localStorage.getItem('madrasa-db') || 'null'); } catch { return null; } }
  },
  save: async (d) => {
    try { await IDB.put('kv', 'db', JSON.parse(JSON.stringify(d))); }
    catch { try { localStorage.setItem('madrasa-db', JSON.stringify(d)); } catch { } }
    return true;
  },
  // النسخة الاحتياطية تشمل البيانات وملفات مكتبة المعرفة
  exportData: async (d) => {
    const files = {};
    for (const x of [...(d.library || []), ...(d.correspondence || [])]) if (x.file?.stored) { const b = await IDB.get('files', x.file.stored); if (b) files[x.file.stored] = await blobToDataUrl(b); }
    downloadBlob(JSON.stringify({ ...d, _files: files }), `نسخة-احتياطية-المساعد-الإداري-${todayISO()}.json`, 'application/json');
    toast('حُفظت النسخة في مجلد «التنزيلات» — انسخها إلى فلاش أو Drive');
    return false;
  },
  importData: () => new Promise((res) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return res(null);
      try {
        const d = JSON.parse(await f.text());
        for (const [k, u] of Object.entries(d._files || {})) await IDB.put('files', k, await dataUrlToBlob(u));
        delete d._files; res(d);
      } catch { res(null); }
    };
    inp.click();
  }),
  saveCsv: async (name, content) => { downloadBlob('﻿' + content, name, 'text/csv'); toast('حُفظ الملف في مجلد «التنزيلات»'); return false; },
  sendMail: async () => ({ ok: false, error: '' }),
  testMail: async () => ({ ok: false, error: '' }),
  openUrl: async (u) => window.open(u, '_blank'),
  openDataFolder: async () => { },
  libPick: () => new Promise((res) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.doc,.docx,image/*';
    inp.onchange = () => { const f = inp.files[0]; f ? fileToAtt(f).then(res) : res(null); };
    inp.click();
  }),
  libDrop: (f) => fileToAtt(f),
  libOpen: async (att) => {
    const b = await getFileBlob(att.stored);
    if (!b) return 'الملف غير موجود';
    // PDF والصور تُفتح للعرض، وملفات Word تُنزَّل لتفتح في Word
    openBlob(b, att.name, /docx?/.test(att.ext));
    return '';
  },
  libPreview: async (att) => { if (!/^(png|jpe?g|gif|webp|bmp)$/.test(att.ext)) return null; const b = await getFileBlob(att.stored); return b ? URL.createObjectURL(b) : null; },
  libDelete: async (att) => { try { await IDB.del('files', att.stored); } catch { } return true; },
  libSaveAs: async (att) => { const b = await getFileBlob(att.stored); if (b) openBlob(b, att.name, true); return !!b; },
  // في البرنامج المثبَّت: الإملاء الصوتي يمر عبر نافذة صغيرة في Edge (محرّك التعرّف على الصوت العربي)
  voiceStart: window.madrasaNative ? (lang) => window.madrasaNative.voiceStart(lang) : null,
  onVoice: window.madrasaNative ? (cb) => window.madrasaNative.onVoice(cb) : () => { },
};
// ملف مرفق: من هذا الجهاز، أو من مجلد المزامنة إذا أُضيف من جهاز آخر
async function getFileBlob(stored) {
  let b = await IDB.get('files', stored).catch(() => null);
  if (!b && Sync.status === 'on') { b = await Sync.readAttachment(stored); if (b) IDB.put('files', stored, b).catch(() => { }); }
  return b || null;
}

// ═════════════ المزامنة بين الأجهزة (عبر مجلد OneDrive أو Google Drive) ═════════════
// طريقتان للوصول إلى مجلد المزامنة:
// - البرنامج المثبَّت: يكتشف OneDrive / Google Drive تلقائياً ويكتب عبر البرنامج نفسه (دون اختيار مجلد)
// - نسخة المتصفح: مجلد يختاره المستخدم (File System Access)
const NSync = window.madrasaNative?.sync || null;
const SyncFS = {
  native: {
    readText: (n) => NSync.readText(n),
    writeText: (n, t) => NSync.writeText(n, t),
    list: (sub) => NSync.list(sub),
    readBlob: async (sub, n) => { const b = await NSync.readBin(`${sub}/${n}`); return b ? new Blob([b]) : null; },
    writeBlob: async (sub, n, blob) => NSync.writeBin(`${sub}/${n}`, new Uint8Array(await blob.arrayBuffer())),
  },
  fsa: {
    readText: async (n) => { try { const fh = await Sync.dir.getFileHandle(n); return await (await fh.getFile()).text(); } catch { return null; } },
    writeText: (n, t) => SyncFS.fsa._write(Sync.dir, n, t),
    _write: async (dir, n, data) => { const fh = await dir.getFileHandle(n, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); },
    _sub: (sub) => Sync.dir.getDirectoryHandle(sub, { create: true }),
    list: async (sub) => { const out = []; for await (const k of (await SyncFS.fsa._sub(sub)).keys()) out.push(k); return out; },
    readBlob: async (sub, n) => { try { return await (await (await SyncFS.fsa._sub(sub)).getFileHandle(n)).getFile(); } catch { return null; } },
    writeBlob: async (sub, n, blob) => SyncFS.fsa._write(await SyncFS.fsa._sub(sub), n, blob),
  },
};
const CLOUD_ICON = { onedrive: '☁️', gdrive: '🟢', custom: '📁' };
const Sync = {
  dir: null, cfg: null, status: 'off', base: 0, known: null, busy: false, conflict: null, clouds: [], appCfg: {}, mismatch: null,
  // الإيميل المطلوب للمزامنة: من الإعدادات، أو من ملف إعداد المدرسة المرفق بالبرنامج
  wantEmail() { return String(db?.settings?.syncEmail || this.appCfg.syncEmail || '').trim().toLowerCase(); },
  emailOk(c) { const w = this.wantEmail(); return !w || (c && c.email && c.email.toLowerCase() === w); },
  supported: () => !!NSync || (!window.api && typeof window.showDirectoryPicker === 'function'),
  get fs() { return this.cfg ? SyncFS.native : SyncFS.fsa; },
  get label() { return this.cfg ? `${this.cfg.label}` : this.dir?.name || ''; },
  hasLocalData: () => db.teachers.length + db.tasks.length + db.absences.length + db.library.length + (db.classEntries?.length || 0) > 0,
  async init() {
    if (!this.supported()) return;
    try {
      this.base = (await IDB.get('kv', 'syncBase')) || 0;
      if (NSync) {
        this.status = 'off'; this.mismatch = null;
        try { this.appCfg = (await window.madrasaNative.appConfig?.()) || {}; } catch { this.appCfg = {}; }
        this.clouds = await NSync.detect();
        const want = this.wantEmail();
        const cfg = await IDB.get('kv', 'syncNative');
        if (cfg) {
          // نتحقق في كل تشغيل أن المجلد ما زال لحساب الإيميل المطلوب
          const c = this.clouds.find((x) => x.base === cfg.base);
          if (want && !this.emailOk(c)) { this.cfg = cfg; this.status = 'mismatch'; this.mismatch = { found: c?.email || '' }; await NSync.clear(); }
          else await this.connect({ ...cfg, email: c?.email || cfg.email || '' }, false);
        } else if (!(await IDB.get('kv', 'syncAutoOff'))) {
          // أول تشغيل: تفعيل تلقائي عبر OneDrive المسجّل بالإيميل المطلوب (أو أول سحابة إن لم يُحدَّد إيميل)
          const c = want ? this.clouds.find((x) => x.kind === 'onedrive' && this.emailOk(x)) : this.clouds.find((x) => x.kind === 'onedrive') || this.clouds[0];
          if (c) await this.connect({ base: c.base, kind: c.kind, label: c.label, email: c.email }, true);
          else if (want) { this.status = 'mismatch'; this.mismatch = { found: this.clouds.filter((x) => x.kind === 'onedrive').map((x) => x.email).filter(Boolean).join('، ') }; }
        }
      } else {
        this.dir = await IDB.get('kv', 'syncDir');
        if (this.dir) {
          const p = await this.dir.queryPermission({ mode: 'readwrite' });
          this.status = p === 'granted' ? 'on' : 'paused';
          if (this.status === 'on') await this.reconcile();
        }
      }
    } catch (e) { this.status = 'error'; this.error = e.message; }
    renderSyncBar();
  },
  // ربط مجلد سحابة على هذا الجهاز (البرنامج المثبَّت)
  async connect(cfg, first) {
    const r = await NSync.setRoot(cfg.base);
    if (!r?.ok) { this.cfg = cfg; this.status = 'error'; this.error = r?.error || ''; return; }
    this.cfg = { ...cfg, path: r.path }; this.status = 'on'; this.known = null;
    await IDB.put('kv', 'syncNative', { base: cfg.base, kind: cfg.kind, label: cfg.label, email: cfg.email || '' });
    await IDB.del('kv', 'syncAutoOff').catch(() => { });
    if (!first) return this.reconcile();
    const remote = await this.readRemote();
    if (remote && this.hasLocalData()) return this.setConflict(remote);
    if (remote) { await this.load(remote, true); toast(`🔄 رُبط البرنامج بـ${cfg.label} وحُمّلت بياناتكِ`, 'ok'); }
    else { await this.push(true); toast(`🔄 المزامنة تعمل تلقائياً عبر ${cfg.label}`, 'ok'); }
    render();
  },
  async setBase(v) { this.base = v; try { await IDB.put('kv', 'syncBase', v); } catch { } },
  async readRemote() { try { const t = await this.fs.readText('data.json'); return t ? JSON.parse(t) : null; } catch { return null; } },
  async readAttachment(stored) { try { return await this.fs.readBlob('library', stored); } catch { return null; } },
  async pushAttachments() {
    if (!this.known) this.known = new Set(await this.fs.list('library'));
    for (const x of [...db.library, ...(db.correspondence || [])]) {
      const st = x.file?.stored;
      if (!st || this.known.has(st)) continue;
      const b = await IDB.get('files', st).catch(() => null);
      if (b) { await this.fs.writeBlob('library', st, b); this.known.add(st); }
    }
  },
  // مقارنة بيانات هذا الجهاز مع المجلد واختيار الأحدث
  async reconcile() {
    const remote = await this.readRemote();
    const local = db.meta?.updatedAt || 0;
    if (!remote) return this.push(true);
    const rt = remote.meta?.updatedAt || 0;
    if (rt > this.base) {
      if (local <= this.base) return this.load(remote, true);
      return this.setConflict(remote);
    }
    if (local > this.base) return this.push();
  },
  async push(force) {
    if (this.status !== 'on' || this.busy) return;
    this.busy = true;
    try {
      if (!force) {
        const remote = await this.readRemote();
        if (remote && (remote.meta?.updatedAt || 0) > this.base) { this.busy = false; return this.setConflict(remote); }
      }
      await this.fs.writeText('data.json', JSON.stringify(db));
      await this.setBase(db.meta?.updatedAt || 0);
      await this.pushAttachments();
      this.lastOk = new Date();
    } catch (e) { this.status = 'error'; this.error = e.message; renderSyncBar(); }
    this.busy = false;
  },
  async load(remote, quiet) {
    db = migrate(remote);
    for (const f of HOOKS.beforeStart || []) { try { await f(); } catch { } }
    await api.save(db);
    await this.setBase(db.meta?.updatedAt || 0);
    this.conflict = null; this.lastOk = new Date();
    render();
    if (!quiet || remote.meta?.device !== deviceId()) toast('🔄 تم تحديث البيانات من الجهاز الآخر', 'ok');
  },
  setConflict(remote) { this.conflict = remote; renderSyncBar(); },
  async check() {
    if (this.status !== 'on' || this.busy || modalCtx) return;
    try { await this.reconcile(); } catch { }
    renderSyncBar();
  },
  async choose(base) {
    if (NSync) {
      if (!base) { base = await NSync.pick(); if (!base) return; }
      const c = this.clouds.find((x) => x.base === base);
      const go = () => this.connect({ base, kind: c?.kind || 'custom', label: c?.label || base.split(/[\\/]/).pop() || base, email: c?.email || '' }, true);
      if (!this.emailOk(c)) return confirmBox(`هذا المجلد ${c?.email ? `لحساب ${c.email}` : 'غير مرتبط بحساب معروف'} وليس للحساب المطلوب ${this.wantEmail()}. هل تريدين المزامنة معه رغم ذلك؟`, go, 'نعم، تابعي');
      return go();
    }
    let root;
    try { root = await window.showDirectoryPicker({ id: 'madrasa-sync', mode: 'readwrite' }); } catch { return; }
    const dir = await root.getDirectoryHandle('بيانات المساعد الإداري', { create: true });
    this.dir = dir; this.status = 'on'; this.known = null;
    await IDB.put('kv', 'syncDir', dir);
    const remote = await this.readRemote();
    if (remote && this.hasLocalData()) return this.setConflict(remote);
    if (remote) await this.load(remote);
    else { await this.push(true); toast('تم تفعيل المزامنة ✓', 'ok'); }
    render();
  },
  async resume() {
    if (NSync && this.cfg) { await this.connect(this.cfg, false); render(); return; }
    try { const p = await this.dir.requestPermission({ mode: 'readwrite' }); this.status = p === 'granted' ? 'on' : 'paused'; } catch { this.status = 'paused'; }
    if (this.status === 'on') { await this.reconcile(); toast('المزامنة تعمل ✓', 'ok'); }
    render();
  },
  async stop() {
    this.dir = null; this.cfg = null; this.status = 'off'; this.conflict = null;
    try { await IDB.del('kv', 'syncDir'); await IDB.del('kv', 'syncNative'); await IDB.put('kv', 'syncAutoOff', true); } catch { }
    if (NSync) NSync.clear();
    render();
  },
};
function deviceId() {
  let id = null;
  try { id = localStorage.getItem('madrasa-device'); if (!id) { id = uid(); localStorage.setItem('madrasa-device', id); } } catch { }
  return id;
}
function syncEmailField() {
  const w = Sync.wantEmail();
  return `<div class="field" style="margin-top:12px;max-width:420px"><label>الحساب المطلوب للمزامنة (إيميل OneDrive)</label>
    <input class="input" dir="ltr" type="email" value="${esc(db.settings.syncEmail || Sync.appCfg.syncEmail || '')}" placeholder="name@hotmail.com" data-change="syncEmail">
    <span class="hint">لا تعمل المزامنة إلا إذا كان OneDrive على الجهاز مسجّلاً بهذا الإيميل.${!db.settings.syncEmail && Sync.appCfg.syncEmail ? ' (مضبوط من ملف إعداد البرنامج)' : ''}${!w ? ' اتركيه فارغاً للمزامنة مع أي حساب.' : ''}</span></div>`;
}
function syncCard() {
  const last = Sync.lastOk ? ' · آخر مزامنة: ' + Sync.lastOk.toLocaleTimeString('ar-SA-u-nu-latn', { timeStyle: 'short' }) : '';
  if (NSync) {
    const C = Sync.clouds || [];
    if (Sync.status === 'mismatch') return `<div class="card" style="grid-column:1/-1"><h3>🔄 المزامنة بين الأجهزة</h3>
      <div><span class="chip red">متوقفة — حساب غير مطابق</span></div>
      <div class="muted" style="margin-top:8px">الحسابات المسجّلة في OneDrive على هذا الجهاز: <b dir="ltr">${esc(C.filter((c) => c.kind === 'onedrive').map((c) => c.email || '—').join('، ') || 'لا يوجد')}</b><br>سجّلي الدخول إلى OneDrive بالحساب المطلوب (أيقونة السحابة بجانب الساعة ← الإعدادات ← الحساب ← إضافة حساب)، ثم اضغطي «إعادة الفحص».</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primary sm" data-act="syncRecheck">إعادة الفحص</button>${C.map((c) => `<button class="btn sm" data-act="syncCloud" data-id="${esc(c.base)}">المزامنة مع ${esc(c.label)}${c.email ? ` (${esc(c.email)})` : ''} رغم ذلك</button>`).join('')}</div>${syncEmailField()}</div>`;
    if (Sync.status === 'off') return `<div class="card" style="grid-column:1/-1"><h3>🔄 المزامنة بين الأجهزة</h3>
      ${C.length ? `<div class="muted">اضغطي على السحابة المسجّلة على هذا الجهاز، فتعمل المزامنة فوراً دون اختيار أي مجلد. على الجهاز الآخر تُفعَّل تلقائياً إذا كان مسجّلاً بالحساب نفسه.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${C.map((c) => `<button class="btn ${Sync.emailOk(c) ? 'primary' : ''}" data-act="syncCloud" data-id="${esc(c.base)}">${CLOUD_ICON[c.kind] || '☁️'} تفعيل عبر ${esc(c.label)}${c.email ? ` <span dir="ltr" style="opacity:.8">(${esc(c.email)})</span>` : ''}</button>`).join('')}<button class="btn" data-act="syncChoose">📁 مجلد آخر</button></div>`
      : `<div class="muted">لم يُعثر على OneDrive أو Google Drive على هذا الجهاز. سجّلي الدخول إلى OneDrive (أيقونة السحابة بجانب الساعة) ثم أعيدي فتح البرنامج، فتعمل المزامنة تلقائياً.</div>
        <button class="btn" style="margin-top:12px" data-act="syncChoose">📁 اختيار مجلد يدوياً</button>`}${syncEmailField()}</div>`;
    return `<div class="card" style="grid-column:1/-1"><h3>🔄 المزامنة بين الأجهزة</h3>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="chip ${Sync.status === 'on' ? 'green' : 'red'}">${Sync.status === 'on' ? 'تعمل تلقائياً ✓' : 'متوقفة'}</span>
        <span>${CLOUD_ICON[Sync.cfg?.kind] || '☁️'} <b>${esc(Sync.label)}</b>${Sync.cfg?.email ? ` · <span dir="ltr">${esc(Sync.cfg.email)}</span>` : ''}</span><span class="muted">${last}</span>
        <span class="spacer" style="flex:1"></span>
        ${Sync.status === 'on' ? '<button class="btn sm" data-act="syncNow">مزامنة الآن</button>' : '<button class="btn sm primary" data-act="syncResume">إعادة المحاولة</button>'}
        ${C.filter((c) => c.base !== Sync.cfg?.base).map((c) => `<button class="btn sm" data-act="syncCloud" data-id="${esc(c.base)}">التبديل إلى ${esc(c.label)}</button>`).join('')}
        <button class="btn sm danger" data-act="syncStop">إيقاف المزامنة</button></div>
      <div class="muted" style="margin-top:8px;font-size:12px" dir="auto">مكان الحفظ: ${esc(Sync.cfg?.path || '')}</div>
      <div class="muted" style="margin-top:4px">تُحفظ البيانات والمرفقات في حسابكِ على السحابة باستمرار، وتنتقل إلى أي جهاز آخر مسجّل بالحساب نفسه ومثبّت عليه البرنامج.</div>${syncEmailField()}</div>`;
  }
  return `<div class="card" style="grid-column:1/-1"><h3>🔄 المزامنة بين الأجهزة</h3>
    ${Sync.status === 'off' ? `<div class="muted">لاستخدام التطبيق من أكثر من جهاز: اختاري مجلداً داخل <b>OneDrive</b> أو <b>Google Drive</b>، وكرّري الأمر نفسه على الجهاز الآخر واختاري المجلد ذاته. بعدها تنتقل البيانات والمرفقات بين الأجهزة تلقائياً.</div>
      <button class="btn primary" style="margin-top:12px" data-act="syncChoose">اختيار مجلد المزامنة</button>`
    : `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="chip ${Sync.status === 'on' ? 'green' : 'amber'}">${Sync.status === 'on' ? 'تعمل ✓' : Sync.status === 'paused' ? 'بانتظار التفعيل' : 'متوقفة'}</span>
        <span class="muted">المجلد: ${esc(Sync.dir?.name || '')}${last}</span>
        <span class="spacer" style="flex:1"></span>
        ${Sync.status === 'on' ? '<button class="btn sm" data-act="syncNow">مزامنة الآن</button>' : '<button class="btn sm primary" data-act="syncResume">تفعيل</button>'}
        <button class="btn sm" data-act="syncChoose">تغيير المجلد</button>
        <button class="btn sm danger" data-act="syncStop">إيقاف المزامنة</button></div>
      <div class="muted" style="margin-top:8px">عند فتح التطبيق قد يطلب المتصفح الموافقة على الوصول للمجلد؛ اختاري «السماح في كل زيارة» حتى لا يتكرر الطلب.</div>`}
  </div>`;
}
function renderSyncBar() {
  const el = $('#syncBar'); if (!el) return;
  const c = Sync.conflict;
  if (c) {
    const when = c.meta?.updatedAt ? new Date(c.meta.updatedAt).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    el.innerHTML = `<div class="banner" style="margin:0 28px 10px"><span class="big">🔄</span><div><b>توجد بيانات أحدث محفوظة من جهاز آخر</b><div class="muted">آخر تعديل عليها: ${when}. اختاري أي نسخة تريدين الاحتفاظ بها.</div></div><span class="spacer"></span>
      <button class="btn primary" data-act="syncUseRemote">تحميل بيانات الجهاز الآخر</button><button class="btn" data-act="syncUseLocal">الاحتفاظ ببيانات هذا الجهاز</button></div>`;
  } else if (Sync.status === 'mismatch') {
    const f = Sync.mismatch?.found;
    el.innerHTML = `<div class="banner" style="margin:0 28px 10px;padding:10px 16px"><span>🔒</span><div><b>المزامنة متوقفة لحماية البيانات</b><div class="muted">${f ? `OneDrive على هذا الجهاز مسجّل بحساب <span dir="ltr">${esc(f)}</span>` : 'لا يوجد OneDrive مسجّل على هذا الجهاز'}، والحساب المطلوب <span dir="ltr">${esc(Sync.wantEmail())}</span>. سجّلي الدخول إلى OneDrive بالحساب المطلوب ثم اضغطي «إعادة الفحص».</div></div><span class="spacer"></span><button class="btn sm primary" data-act="syncRecheck">إعادة الفحص</button><button class="btn sm" data-act="nav" data-id="settings">الإعدادات</button></div>`;
  } else if (Sync.status === 'paused') {
    el.innerHTML = `<div class="banner brand" style="margin:0 28px 10px;padding:10px 16px"><span>🔄</span><div>المزامنة بانتظار موافقتكِ</div><span class="spacer"></span><button class="btn sm primary" data-act="syncResume">تفعيل المزامنة</button></div>`;
  } else if (Sync.status === 'error') {
    el.innerHTML = `<div class="banner" style="margin:0 28px 10px;padding:10px 16px"><span>⚠️</span><div>تعذّرت المزامنة${NSync ? ` عبر ${esc(Sync.label)} — تأكدي أن السحابة مسجّلة ومتصلة على هذا الجهاز` : '. تأكدي أن مجلد المزامنة موجود.'}</div><span class="spacer"></span>${NSync && Sync.cfg ? '<button class="btn sm primary" data-act="syncResume">إعادة المحاولة</button>' : ''}<button class="btn sm" data-act="syncChoose">اختيار مجلد آخر</button></div>`;
  } else el.innerHTML = '';
}

function fileToAtt(f) {
  return new Promise((res) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!/^(pdf|docx?|png|jpe?g|gif|webp|bmp)$/.test(ext)) return res({ error: 'نوع الملف غير مدعوم. المسموح: PDF وWord والصور' });
    if (f.size > 50e6) return res({ error: 'حجم الملف أكبر من 50 ميجابايت' });
    if (window.api) return res(null);
    const stored = uid() + '.' + ext;
    IDB.put('files', stored, f).then(() => res({ stored, name: f.name, ext, size: f.size })).catch(() => res({ error: 'تعذّر حفظ الملف' }));
  });
}
function downloadBlob(content, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ═════════════ البيانات الافتراضية ═════════════
const ABSENCE_TYPES = [
  'غياب بدون عذر', 'غياب بعذر', 'إجازة مرضية', 'إجازة اضطرارية', 'إجازة مرافقة مريض',
  'إجازة وضع', 'إجازة أمومة', 'إجازة عدّة', 'إجازة استثنائية', 'إجازة رعاية مولود',
  'تأخر صباحي', 'خروج أثناء الدوام', 'دورة تدريبية', 'انتداب / تكليف',
];
const ENTRY_STATUS = {
  early: { label: 'حضرت مبكراً', cls: 'green' },
  ontime: { label: 'في الوقت', cls: 'brand' },
  late: { label: 'متأخرة', cls: 'amber' },
  absent: { label: 'لم تحضر', cls: 'red' },
};
const PRIORITY = { high: 'عالية', med: 'متوسطة', low: 'منخفضة' };
const TASK_CATS = ['عام', 'الغياب', 'الإشراف اليومي', 'الفسحة', 'المناسبات', 'الزيارات', 'اجتماعات', 'مراسلات'];
const OCC_STATUS = { todo: { label: 'لم تبدأ', cls: '' }, prep: { label: 'قيد التحضير', cls: 'amber' }, done: { label: 'نُفّذت', cls: 'green' } };
const VISIT_STATUS = { planned: { label: 'مجدولة', cls: 'blue' }, ready: { label: 'جاهزة', cls: 'brand' }, done: { label: 'تمّت', cls: 'green' } };
const BREAK_LOCS = ['الساحة', 'المقصف', 'الممرات', 'المصلى', 'دورات المياه', 'الملعب', 'المكتبة', 'أخرى'];
const BREAK_CATS = { general: 'ملاحظة عامة', positive: 'ملاحظة إيجابية', behavior: 'سلوك', safety: 'سلامة', hygiene: 'نظافة', health: 'صحية' };
const BREAK_CAT_CLS = { general: '', positive: 'green', behavior: 'amber', safety: 'red', hygiene: 'blue', health: 'purple' };
const VISIT_CHECKLIST = [
  'إبلاغ القائدة والمعلمات بموعد الزيارة',
  'التأكد من نظافة وترتيب المدرسة والفصول',
  'تجهيز مكان الاستقبال والضيافة',
  'تجهيز لوحة / عبارة ترحيبية',
  'تجهيز السجلات والملفات المطلوبة',
  'تجهيز جدول الحصص وخريطة الفصول',
  'تعيين مرافقة لفريق الزيارة',
  'استقبال الفريق وتسجيل الحضور',
  'تسجيل ملاحظات وتوصيات الفريق',
  'متابعة تنفيذ التوصيات بعد الزيارة',
];
// المناسبات: [الاسم، الشهر، اليوم، النوع]
const DEFAULT_OCCASIONS = [
  ['يوم التأسيس', 2, 22, 'national'],
  ['يوم العلم', 3, 11, 'national'],
  ['اليوم الوطني السعودي', 9, 23, 'national'],
  ['يوم بيعة خادم الحرمين الشريفين', 1, 23, 'national'],
  ['اليوم العالمي للمعلم', 10, 5, 'global'],
  ['اليوم العالمي للغة العربية', 12, 18, 'global'],
  ['اليوم العالمي للصحة النفسية', 10, 10, 'global'],
  ['اليوم العالمي للغذاء', 10, 16, 'global'],
  ['اليوم العالمي للسكري', 11, 14, 'global'],
  ['اليوم العالمي للتسامح', 11, 16, 'global'],
  ['اليوم العالمي للطفل', 11, 20, 'global'],
  ['اليوم العالمي لذوي الإعاقة', 12, 3, 'global'],
  ['اليوم العالمي للتطوع', 12, 5, 'global'],
  ['اليوم الدولي للتعليم', 1, 24, 'global'],
  ['اليوم الدولي للمرأة', 3, 8, 'global'],
  ['اليوم العالمي للمياه', 3, 22, 'global'],
  ['يوم الصحة العالمي', 4, 7, 'global'],
  ['اليوم العالمي للكتاب', 4, 23, 'global'],
  ['اليوم العالمي للأسرة', 5, 15, 'global'],
  ['اليوم العالمي للامتناع عن التدخين', 5, 31, 'global'],
  ['اليوم العالمي للبيئة', 6, 5, 'global'],
  ['اليوم العالمي لمحو الأمية', 9, 8, 'global'],
  ['اليوم العالمي للعطاء', 11, 13, 'global'],
];

function freshDb() {
  return {
    version: 2,
    settings: {
      schoolName: '', employeeName: '', senderName: '', gmailUser: '', gmailPass: '',
      supervisionDay: 1, periods: 7, voiceLang: 'ar-SA', notify: true,
      earlySubject: 'شكر وتقدير — الحضور المبكر للحصة',
      earlyBody: 'الأستاذة الفاضلة {المعلمة}\nالسلام عليكم ورحمة الله وبركاته\n\nنشكر لكِ حرصكِ والتزامكِ بالحضور المبكر إلى الحصة {الحصة} في فصل {الفصل} يوم {اليوم} الموافق {التاريخ}، فهذا الالتزام يعكس روح المسؤولية ويعدّ قدوة حسنة لطالباتنا.\n\nدمتِ متميزة،\n{الموظفة}\n{المدرسة}',
    },
    teachers: [], tasks: [], events: [], absences: [], classEntries: [],
    breakNotes: [], visits: [], library: [], timetable: [],
    occasions: DEFAULT_OCCASIONS.map(([name, month, day, type]) => ({ id: uid(), name, month, day, type, initiative: '', responsible: '', status: 'todo', notes: '', year: null })),
  };
}

let db = null;
let saveTimer = null;
function commit(rerender = true) {
  db.meta = { ...(db.meta || {}), updatedAt: Date.now(), device: deviceId() };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { await api.save(db); Sync.push(); }, 400);
  if (rerender) render();
}

// نقاط ربط تضيف إليها الملفات الأخرى (extras.js) أجزاءها دون تعديل هذا الملف
const HOOKS = {};
const addHook = (name, fn) => (HOOKS[name] = HOOKS[name] || []).push(fn);
const hook = (name, ...a) => (HOOKS[name] || []).map((f) => { try { return f(...a) || ''; } catch (e) { console.warn(e); return ''; } }).join('');

// ═════════════ حالة الواجهة ═════════════
const ui = {
  view: 'dashboard',
  taskFilter: 'open', taskCat: '',
  calMonth: null, calSel: null,
  absTeacher: '', absType: '', absMonth: '',
  entryDate: null,
  breakFilter: '',
  occFilter: 'upcoming',
  visitSel: null,
  libKind: '', libCat: '',
};

// القائمة: أقسام رئيسية تنطوي تحتها الأقسام الفرعية
const taskBadge = () => db.tasks.filter((t) => t.status !== 'done' && t.due && t.due <= todayISO()).length;
const NAV_TREE = [
  { id: 'dashboard', ic: '🏠', label: 'لوحة اليوم' },
  { group: 'org', ic: '🗂️', label: 'التنظيم', items: [
    { id: 'tasks', ic: '✅', label: 'المهام', badge: taskBadge },
    { id: 'calendar', ic: '📅', label: 'التقويم' },
  ] },
  { group: 'teachers', ic: '👩‍🏫', label: 'شؤون المعلمات', items: [
    { id: 'teachers', ic: '👥', label: 'المعلمات' },
    { id: 'absence', ic: '📋', label: 'سجل الغياب (فارس)' },
    { id: 'entries', ic: '🚪', label: 'متابعة دخول الحصص' },
  ] },
  { group: 'super', ic: '🔔', label: 'الإشراف', items: [
    { id: 'break', ic: '🧒', label: 'الإشراف على الفسحة' },
    { id: 'occasions', ic: '🎉', label: 'الأيام العالمية والوطنية' },
    { id: 'visits', ic: '🤝', label: 'الزيارات' },
  ] },
  { group: 'know', ic: '📚', label: 'المعرفة والأدوات', items: [
    { id: 'library', ic: '🗃️', label: 'مكتبة المعرفة' },
    { id: 'quran', ic: '📖', label: 'المصحف (تبارك وعمّ)' },
    { id: 'tools', ic: '🧰', label: 'الأدوات المساعدة' },
  ] },
  { id: 'settings', ic: '⚙️', label: 'الإعدادات' },
];
const NAV = NAV_TREE.flatMap((n) => (n.items ? n.items : [n]));
const navOpen = new Set();

// ═════════════ مساعدات بيانات ═════════════
const teacher = (id) => db.teachers.find((t) => t.id === id);
const tName = (id) => teacher(id)?.name || '—';
const sortedTeachers = () => [...db.teachers].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
const OCC_TYPES = { national: ['وطني', 'green'], global: ['عالمي', 'purple'], islamic: ['إسلامي', 'brand'] };
function occNextDate(o, from = todayISO()) {
  if (o.cal === 'h' && typeof hijriToG === 'function') {
    const hy = hParts(parse(from))[0];
    let d = hijriToG(hy, o.month, Math.min(o.day, 30)) || hijriToG(hy, o.month, 29);
    if (!d || d < from) d = hijriToG(hy + 1, o.month, Math.min(o.day, 30)) || hijriToG(hy + 1, o.month, 29);
    return d || from;
  }
  const y = parse(from).getFullYear();
  let d = `${y}-${pad(o.month)}-${pad(o.day)}`;
  if (d < from) d = `${y + 1}-${pad(o.month)}-${pad(o.day)}`;
  return d;
}
function occStatus(o) {
  // الحالة خاصة بسنة واحدة؛ تعود تلقائياً لـ"لم تبدأ" في السنة التالية
  const next = occNextDate(o);
  const yr = parse(next).getFullYear();
  if (o.year && o.year !== yr) return 'todo';
  return o.status || 'todo';
}
function nextSupervisionDate(from = todayISO()) {
  const target = Number(db.settings.supervisionDay);
  let d = from;
  for (let i = 0; i < 7; i++) { if (parse(d).getDay() === target) return d; d = addDays(d, 1); }
  return from;
}
function itemsForDate(d) {
  const out = [];
  db.tasks.filter((t) => t.due === d).forEach((t) => out.push({ kind: 'task', label: t.title, ref: t }));
  db.events.filter((e) => e.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')).forEach((e) => out.push({ kind: 'event', label: (e.time ? e.time + ' ' : '') + e.title, ref: e }));
  const dt = parse(d);
  const hp = typeof hParts === 'function' && db.occasions.some((o) => o.cal === 'h') ? hParts(dt) : null;
  db.occasions.filter((o) => (o.cal === 'h' ? hp && o.month === hp[1] && o.day === hp[2] : o.month === dt.getMonth() + 1 && o.day === dt.getDate())).forEach((o) => out.push({ kind: 'occ', label: o.name, ref: o }));
  db.visits.filter((v) => v.date === d).forEach((v) => out.push({ kind: 'visit', label: 'زيارة: ' + v.team, ref: v }));
  const abs = db.absences.filter((a) => inRange(d, a.date, a.dateTo));
  if (abs.length) out.push({ kind: 'abs', label: `غياب: ${abs.length}`, ref: abs });
  if (dt.getDay() === Number(db.settings.supervisionDay) && !isWeekend(d)) out.push({ kind: 'sup', label: 'إشراف الفسحة', ref: null });
  return out;
}

// ═════════════ الرسم الرئيسي ═════════════
function render() {
  if ((db.settings.hidden || []).includes(ui.view)) ui.view = 'dashboard';
  renderNav();
  const v = VIEWS[ui.view] || VIEWS.dashboard;
  const t = todayISO();
  $('#pageTitle').textContent = NAV.find((n) => n.id === ui.view)?.label || '';
  $('#pageDate').textContent = `${dayName(t)} ${fmtG(t)} — ${fmtH(t)}`;
  $('#topActions').innerHTML = v.actions ? v.actions() : '';
  const scroll = $('#view').scrollTop;
  $('#view').innerHTML = v.render();
  $('#view').scrollTop = scroll;
  v.after?.();
  $('#schoolNameSide').textContent = db.settings.schoolName || 'اضبطي اسم المدرسة من الإعدادات';
  renderSyncBar();
  $('#sideFoot').textContent = db.settings.employeeName ? `مرحباً، ${db.settings.employeeName}` : '';
}
function renderNav() {
  const item = (n, sub) => {
    const b = n.badge ? n.badge() : 0;
    return `<button class="nav-item ${sub ? 'sub' : ''} ${ui.view === n.id ? 'active' : ''}" data-act="nav" data-id="${n.id}"><span class="ic">${n.ic}</span>${n.label}${b ? `<span class="badge">${b}</span>` : ''}</button>`;
  };
  // القسم الذي فيه الصفحة الحالية يبقى مفتوحاً
  NAV_TREE.forEach((g) => { if (g.items?.some((i) => i.id === ui.view) && !navOpen.has('_auto_' + ui.view)) { navOpen.add(g.group); navOpen.add('_auto_' + ui.view); } });
  const hidden = new Set(db.settings.hidden || []);
  $('#nav').innerHTML = NAV_TREE.map((g0) => {
    if (!g0.items) return item(g0);
    const g = { ...g0, items: g0.items.filter((i) => !hidden.has(i.id)) };
    if (!g.items.length) return '';
    const open = navOpen.has(g.group);
    const hasActive = g.items.some((i) => i.id === ui.view);
    const badge = g.items.reduce((s, i) => s + (i.badge ? i.badge() : 0), 0);
    return `<div class="nav-sec ${open ? 'open' : ''}">
      <button class="nav-item nav-head ${hasActive && !open ? 'active-in' : ''}" data-act="navToggle" data-id="${g.group}"><span class="ic">${g.ic}</span>${g.label}${badge && !open ? `<span class="badge">${badge}</span>` : ''}<span class="chev">‹</span></button>
      <div class="nav-sub">${open ? g.items.map((i) => item(i, true)).join('') : ''}</div>
    </div>`;
  }).join('');
}
function go(view) { ui.view = view; $('#view').scrollTop = 0; render(); }

const emptyState = (ic, msg) => `<div class="empty"><span class="e-ic">${ic}</span>${msg}</div>`;

// ═════════════ لوحة اليوم ═════════════
const VIEWS = {};
VIEWS.dashboard = {
  actions: () => `<button class="btn primary" data-act="taskNew">＋ مهمة</button><button class="btn" data-act="absNew">＋ غياب</button><button class="btn" data-act="breakNew">＋ ملاحظة إشراف</button>`,
  render() {
    const t = todayISO(), s = db.settings;
    const open = db.tasks.filter((x) => x.status !== 'done');
    const dueToday = open.filter((x) => x.due === t);
    const overdue = open.filter((x) => x.due && x.due < t);
    const absToday = db.absences.filter((a) => inRange(t, a.date, a.dateTo));
    const evToday = db.events.filter((e) => e.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const entries = db.classEntries.filter((e) => e.date === t);
    const isSup = parse(t).getDay() === Number(s.supervisionDay) && !isWeekend(t);
    const nextSup = nextSupervisionDate(addDays(t, 1));
    const occs = db.occasions.map((o) => ({ o, d: occNextDate(o) })).filter((x) => diffDays(t, x.d) <= 30).sort((a, b) => a.d.localeCompare(b.d));
    const nextVisit = db.visits.filter((v) => v.date >= t && v.status !== 'done').sort((a, b) => a.date.localeCompare(b.date))[0];

    let html = '';
    if (!s.schoolName || !db.teachers.length) {
      html += `<div class="banner brand"><span class="big">👋</span><div><b>أهلاً بكِ في المساعد الإداري</b><div class="muted">ابدئي بإدخال اسم المدرسة واسمكِ، ثم أضيفي قائمة المعلمات وبريدهن الإلكتروني.</div></div><span class="spacer"></span>
        <button class="btn" data-act="nav" data-id="settings">الإعدادات</button><button class="btn primary" data-act="nav" data-id="teachers">إضافة المعلمات</button></div>`;
    }
    if (isSup) {
      const n = db.breakNotes.filter((b) => b.date === t).length;
      html += `<div class="banner"><span class="big">🔔</span><div><b>اليوم يوم إشرافكِ على الفسحة</b><div class="muted">${n ? `سجّلتِ ${n} ملاحظة اليوم` : 'لم تُسجَّل ملاحظات بعد'}</div></div><span class="spacer"></span><button class="btn primary" data-act="breakNew">تسجيل ملاحظة</button></div>`;
    }
    if (nextVisit && diffDays(t, nextVisit.date) <= 3) {
      const done = nextVisit.checklist.filter((c) => c.done).length;
      html += `<div class="banner" style="background:linear-gradient(90deg,#fff1e6,#fff9f3)"><span class="big">🤝</span><div><b>زيارة ${diffDays(t, nextVisit.date) === 0 ? 'اليوم' : 'بعد ' + daysLabel(diffDays(t, nextVisit.date))}: ${esc(nextVisit.team)}</b><div class="muted">التجهيزات: ${done} من ${nextVisit.checklist.length}</div></div><span class="spacer"></span><button class="btn" data-act="visitOpen" data-id="${nextVisit.id}">فتح</button></div>`;
    }

    html += `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat clickable" data-act="nav" data-id="tasks"><span class="n">${dueToday.length}</span><span class="l">مهام اليوم</span></div>
      <div class="card stat clickable" data-act="nav" data-id="tasks"><span class="n" style="color:${overdue.length ? 'var(--red)' : 'inherit'}">${overdue.length}</span><span class="l">مهام متأخرة</span></div>
      <div class="card stat clickable" data-act="nav" data-id="absence"><span class="n">${absToday.length}</span><span class="l">غياب / إجازات اليوم</span></div>
      <div class="card stat clickable" data-act="nav" data-id="entries"><span class="n">${entries.length}</span><span class="l">متابعات دخول الحصص اليوم</span></div>
    </div>`;

    const taskList = [...overdue, ...dueToday].slice(0, 8);
    html += `<div class="grid g2">
      <div class="card"><h3>✅ مهام تحتاج انتباهكِ <span class="more"><button class="btn sm ghost" data-act="nav" data-id="tasks">الكل</button></span></h3>
        ${taskList.length ? `<div class="list">${taskList.map(taskRow).join('')}</div>` : emptyState('🎯', 'لا مهام متأخرة أو مستحقة اليوم')}
      </div>
      <div class="card"><h3>📅 جدول اليوم <span class="more"><button class="btn sm ghost" data-act="eventNew" data-date="${t}">＋ موعد</button></span></h3>
        ${evToday.length ? `<div class="list">${evToday.map((e) => `<div class="li"><span class="chip brand">${esc(e.time || 'طوال اليوم')}</span><div class="grow"><div class="t">${esc(e.title)}</div>${e.notes ? `<div class="s">${esc(e.notes)}</div>` : ''}</div></div>`).join('')}</div>` : emptyState('☕', 'لا مواعيد مسجّلة اليوم')}
      </div>
      <div class="card"><h3>📋 الغياب والإجازات اليوم</h3>
        ${absToday.length ? `<div class="list">${absToday.map((a) => `<div class="li"><div class="grow"><div class="t">${esc(tName(a.teacherId))}</div><div class="s">${a.dateTo && a.dateTo !== a.date ? `حتى ${fmtG(a.dateTo)}` : 'يوم واحد'}</div></div><span class="chip ${absChipCls(a.type)}">${esc(a.type)}</span></div>`).join('')}</div>` : emptyState('🌿', 'لا غياب مسجّل اليوم')}
      </div>
      ${hook('dashCards', t)}
      <div class="card"><h3>🎉 مناسبات قادمة (30 يوماً) <span class="more"><button class="btn sm ghost" data-act="nav" data-id="occasions">الكل</button></span></h3>
        ${occs.length ? `<div class="list">${occs.slice(0, 5).map(({ o, d }) => { const st = OCC_STATUS[occStatus(o)]; const dd = diffDays(t, d); return `<div class="li"><div class="grow"><div class="t">${esc(o.name)}</div><div class="s">${fmtG(d)} · ${dd === 0 ? 'اليوم' : 'بعد ' + daysLabel(dd)}${o.initiative ? ' · ' + esc(o.initiative) : ' · لا توجد مبادرة بعد'}</div></div><span class="chip ${st.cls}">${st.label}</span></div>`; }).join('')}</div>` : emptyState('🗓️', 'لا مناسبات خلال الشهر القادم')}
      </div>
    </div>
    <div class="muted" style="margin-top:14px">موعد إشرافكِ القادم على الفسحة: ${isSup ? 'اليوم، ثم ' : ''}${dayName(nextSup)} ${fmtG(nextSup)}</div>`;
    return html;
  },
};

function absChipCls(type) {
  if (/بدون عذر/.test(type)) return 'red';
  if (/تأخر|خروج/.test(type)) return 'amber';
  if (/مرضية|مرافقة/.test(type)) return 'purple';
  if (/دورة|انتداب/.test(type)) return 'blue';
  return '';
}

// ═════════════ المهام ═════════════
function taskRow(t) {
  const today = todayISO();
  const late = t.status !== 'done' && t.due && t.due < today;
  return `<div class="li ${t.status === 'done' ? 'done' : ''}">
    <span class="prio ${t.priority || 'med'}"></span>
    <span class="check ${t.status === 'done' ? 'on' : ''}" data-act="taskToggle" data-id="${t.id}">${t.status === 'done' ? '✓' : ''}</span>
    <div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="s">${t.category ? esc(t.category) + ' · ' : ''}${t.due ? (late ? `<span style="color:var(--red)">متأخرة — ${fmtG(t.due)}</span>` : t.due === today ? 'اليوم' : `${fmtG(t.due)} · ${fmtH(t.due)}`) : 'بدون موعد'}${t.status === 'doing' ? ' · <span style="color:var(--amber)">قيد التنفيذ</span>' : ''}</div>
      ${t.notes ? `<div class="s">${esc(t.notes)}</div>` : ''}
    </div>
    <button class="icon-btn" data-act="taskEdit" data-id="${t.id}" title="تعديل">✏️</button>
    <button class="icon-btn" data-act="taskDel" data-id="${t.id}" title="حذف">🗑️</button>
  </div>`;
}
VIEWS.tasks = {
  actions: () => `<button class="btn primary" data-act="taskNew">＋ مهمة جديدة</button>`,
  render() {
    const t = todayISO();
    const f = ui.taskFilter;
    let list = db.tasks.filter((x) => !ui.taskCat || x.category === ui.taskCat);
    const counts = {
      open: list.filter((x) => x.status !== 'done').length,
      today: list.filter((x) => x.status !== 'done' && x.due === t).length,
      overdue: list.filter((x) => x.status !== 'done' && x.due && x.due < t).length,
      week: list.filter((x) => x.status !== 'done' && x.due && x.due >= t && x.due <= addDays(t, 7)).length,
      done: list.filter((x) => x.status === 'done').length,
    };
    if (f === 'open') list = list.filter((x) => x.status !== 'done');
    if (f === 'today') list = list.filter((x) => x.status !== 'done' && x.due === t);
    if (f === 'overdue') list = list.filter((x) => x.status !== 'done' && x.due && x.due < t);
    if (f === 'week') list = list.filter((x) => x.status !== 'done' && x.due && x.due >= t && x.due <= addDays(t, 7));
    if (f === 'done') list = list.filter((x) => x.status === 'done');
    const pr = { high: 0, med: 1, low: 2 };
    list.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || pr[a.priority || 'med'] - pr[b.priority || 'med']);
    const segs = [['open', 'المفتوحة'], ['today', 'اليوم'], ['overdue', 'المتأخرة'], ['week', 'هذا الأسبوع'], ['done', 'المنجزة']];
    return `<div class="toolbar"><div class="seg">${segs.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="taskFilter" data-id="${k}">${l} (${counts[k]})</button>`).join('')}</div>
      <span class="spacer"></span>
      <select class="input" data-change="taskCat"><option value="">كل التصنيفات</option>${TASK_CATS.map((c) => `<option ${ui.taskCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    <div class="card">${list.length ? `<div class="list">${list.map(taskRow).join('')}</div>` : emptyState('📝', 'لا توجد مهام هنا')}</div>`;
  },
};
const taskFields = () => [
  { key: 'title', label: 'عنوان المهمة', type: 'text', full: true, voice: true, required: true },
  { key: 'due', label: 'تاريخ الاستحقاق', type: 'date' },
  { key: 'priority', label: 'الأولوية', type: 'select', options: Object.entries(PRIORITY) },
  { key: 'category', label: 'التصنيف', type: 'select', options: TASK_CATS },
  { key: 'status', label: 'الحالة', type: 'select', options: [['todo', 'لم تبدأ'], ['doing', 'قيد التنفيذ'], ['done', 'منجزة']] },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, voice: true },
];
function openTask(t, preset = {}) {
  formModal({
    title: t ? 'تعديل المهمة' : 'مهمة جديدة',
    fields: taskFields(),
    values: t || { priority: 'med', status: 'todo', category: 'عام', due: todayISO(), ...preset },
    onSave: (v) => {
      if (t) Object.assign(t, v); else db.tasks.push({ id: uid(), createdAt: todayISO(), ...v });
      commit(); toast('تم حفظ المهمة', 'ok');
    },
  });
}

// ═════════════ التقويم ═════════════
VIEWS.calendar = {
  actions: () => `<button class="btn primary" data-act="eventNew" data-date="${ui.calSel || todayISO()}">＋ موعد</button>`,
  render() {
    const t = todayISO();
    if (!ui.calMonth) ui.calMonth = t.slice(0, 7);
    if (!ui.calSel) ui.calSel = t;
    const [y, m] = ui.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = addDays(iso(first), -first.getDay());
    const hijriTitle = (() => { const a = fmtHijriMonth.format(first), b = fmtHijriMonth.format(new Date(y, m, 0)); return a === b ? a : `${fmtHijriMonthOnly.format(first)} – ${b}`; })();
    let cells = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const dt = parse(d);
      if (i >= 35 && dt.getMonth() !== m - 1) break;
      const items = itemsForDate(d);
      const cls = ['cal-day', dt.getMonth() !== m - 1 && 'other', isWeekend(d) && 'weekend', d === t && 'today', d === ui.calSel && 'sel'].filter(Boolean).join(' ');
      cells += `<div class="${cls}" data-act="calSel" data-id="${d}">
        <div class="dn"><b>${dt.getDate()}</b><span class="hj">${fmtHijriDay.format(dt)}</span></div>
        ${items.slice(0, 3).map((it) => `<div class="cal-tag ${it.kind}">${esc(it.label)}</div>`).join('')}
        ${items.length > 3 ? `<div class="muted" style="font-size:11px">+${items.length - 3} أخرى</div>` : ''}
      </div>`;
    }
    const sel = ui.calSel;
    const items = itemsForDate(sel);
    const panel = `<div class="card"><h3>${dayName(sel)} ${fmtG(sel)}</h3><div class="muted" style="margin-top:-8px;margin-bottom:10px">${fmtH(sel)}</div>
      ${items.length ? `<div class="list">${items.map((it) => {
        if (it.kind === 'event') return `<div class="li"><span class="cal-tag event">موعد</span><div class="grow"><div class="t">${esc(it.ref.title)}</div><div class="s">${esc(it.ref.time || '')} ${esc(it.ref.notes || '')}</div></div><button class="icon-btn" data-act="eventEdit" data-id="${it.ref.id}">✏️</button><button class="icon-btn" data-act="eventDel" data-id="${it.ref.id}">🗑️</button></div>`;
        if (it.kind === 'task') return `<div class="li ${it.ref.status === 'done' ? 'done' : ''}"><span class="cal-tag task">مهمة</span><div class="grow"><div class="t">${esc(it.ref.title)}</div></div><button class="icon-btn" data-act="taskEdit" data-id="${it.ref.id}">✏️</button></div>`;
        if (it.kind === 'occ') return `<div class="li"><span class="cal-tag occ">مناسبة</span><div class="grow"><div class="t">${esc(it.ref.name)}</div><div class="s">${esc(it.ref.initiative || 'لا توجد مبادرة بعد')}</div></div><button class="icon-btn" data-act="occEdit" data-id="${it.ref.id}">✏️</button></div>`;
        if (it.kind === 'visit') return `<div class="li"><span class="cal-tag visit">زيارة</span><div class="grow"><div class="t">${esc(it.ref.team)}</div><div class="s">${esc(it.ref.time || '')}</div></div><button class="icon-btn" data-act="visitOpen" data-id="${it.ref.id}">↗</button></div>`;
        if (it.kind === 'abs') return it.ref.map((a) => `<div class="li"><span class="cal-tag abs">غياب</span><div class="grow"><div class="t">${esc(tName(a.teacherId))}</div><div class="s">${esc(a.type)}</div></div></div>`).join('');
        if (it.kind === 'sup') return `<div class="li"><span class="cal-tag sup">إشراف</span><div class="grow"><div class="t">يوم الإشراف على الفسحة</div></div></div>`;
        return '';
      }).join('')}</div>` : emptyState('🗓️', 'لا شيء في هذا اليوم')}
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm primary" data-act="eventNew" data-date="${sel}">＋ موعد</button><button class="btn sm" data-act="taskNewDate" data-date="${sel}">＋ مهمة</button></div>
    </div>`;
    return `<div class="cal-layout"><div>
      <div class="cal-head"><button class="btn sm" data-act="calNav" data-id="-1">→</button><h2>${MONTHS[m - 1]} ${y}</h2><button class="btn sm" data-act="calNav" data-id="1">←</button>
        <span class="muted">${hijriTitle}</span><span style="flex:1"></span><button class="btn sm" data-act="calToday">اليوم</button></div>
      <div class="cal-grid">${cells}</div>
      <div class="toolbar" style="margin-top:10px;font-size:12px"><span class="cal-tag event">موعد</span><span class="cal-tag task">مهمة</span><span class="cal-tag occ">مناسبة</span><span class="cal-tag visit">زيارة</span><span class="cal-tag abs">غياب</span><span class="cal-tag sup">إشراف الفسحة</span></div>
    </div>${panel}</div>`;
  },
};
function openEvent(e, date) {
  formModal({
    title: e ? 'تعديل الموعد' : 'موعد جديد',
    fields: [
      { key: 'title', label: 'العنوان', type: 'text', full: true, voice: true, required: true },
      { key: 'date', label: 'التاريخ', type: 'date', required: true },
      { key: 'time', label: 'الوقت', type: 'time' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, voice: true },
    ],
    values: e || { date: date || todayISO() },
    onSave: (v) => { if (e) Object.assign(e, v); else db.events.push({ id: uid(), ...v }); commit(); toast('تم حفظ الموعد', 'ok'); },
  });
}

// ═════════════ المعلمات ═════════════
VIEWS.teachers = {
  actions: () => `<button class="btn" data-act="teacherBulk">إضافة قائمة</button><button class="btn primary" data-act="teacherNew">＋ معلمة</button>`,
  render() {
    const list = sortedTeachers();
    if (!list.length) return `<div class="card">${emptyState('👩‍🏫', 'أضيفي المعلمات لتظهر أسماؤهن في سجل الغياب ومتابعة الحصص.<br>يمكنكِ لصق القائمة كاملة دفعة واحدة من زر «إضافة قائمة».')}</div>`;
    return `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>#</th><th>الاسم</th><th>التخصص</th><th>البريد الإلكتروني</th><th>الجوال</th><th>أيام الغياب هذا العام</th><th></th></tr></thead>
      <tbody>${list.map((t, i) => {
        const days = db.absences.filter((a) => a.teacherId === t.id && !/تأخر|خروج/.test(a.type)).reduce((s, a) => s + workDays(a.date, a.dateTo), 0);
        return `<tr><td>${i + 1}</td><td><b class="link" data-act="tProfile" data-id="${t.id}">${esc(t.name)}</b></td><td>${esc(t.subject)}</td><td>${t.email ? esc(t.email) : '<span class="chip amber">بلا بريد</span>'}</td><td>${esc(t.phone)}</td><td>${days}</td>
        <td class="actions"><button class="icon-btn" data-act="teacherEdit" data-id="${t.id}">✏️</button><button class="icon-btn" data-act="teacherDel" data-id="${t.id}">🗑️</button></td></tr>`;
      }).join('')}</tbody></table></div><div class="muted" style="margin-top:8px">عدد المعلمات: ${list.length}</div></div>`;
  },
};
function openTeacher(t) {
  formModal({
    title: t ? 'تعديل بيانات المعلمة' : 'إضافة معلمة',
    fields: [
      { key: 'name', label: 'اسم المعلمة', type: 'text', full: true, required: true },
      { key: 'subject', label: 'التخصص', type: 'text' },
      { key: 'phone', label: 'الجوال', type: 'text' },
      { key: 'email', label: 'البريد الإلكتروني', type: 'email', full: true },
    ],
    values: t || {},
    onSave: (v) => { if (t) Object.assign(t, v); else db.teachers.push({ id: uid(), ...v }); commit(); toast('تم الحفظ', 'ok'); },
  });
}

// ═════════════ سجل الغياب ═════════════
function filteredAbsences() {
  return db.absences.filter((a) =>
    (!ui.absTeacher || a.teacherId === ui.absTeacher) &&
    (!ui.absType || a.type === ui.absType) &&
    (!ui.absMonth || a.date.slice(0, 7) === ui.absMonth || (a.dateTo || '').slice(0, 7) === ui.absMonth)
  ).sort((a, b) => b.date.localeCompare(a.date));
}
VIEWS.absence = {
  actions: () => `<button class="btn" data-act="absCsv">⬇ تصدير Excel</button><button class="btn" data-act="absPrint">🖨 طباعة</button><button class="btn primary" data-act="absNew">＋ تسجيل غياب</button>`,
  render() {
    const list = filteredAbsences();
    const months = [...new Set(db.absences.map((a) => a.date.slice(0, 7)))].sort().reverse();
    // ملخص حسب النوع
    const byType = {};
    list.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + workDays(a.date, a.dateTo); });
    // ملخص حسب المعلمة
    const byT = {};
    list.forEach((a) => { byT[a.teacherId] = (byT[a.teacherId] || 0) + workDays(a.date, a.dateTo); });
    const topT = Object.entries(byT).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<div class="toolbar">
      <select class="input" data-change="absTeacher"><option value="">كل المعلمات</option>${sortedTeachers().map((t) => `<option value="${t.id}" ${ui.absTeacher === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <select class="input" data-change="absType"><option value="">كل الأنواع</option>${ABSENCE_TYPES.map((x) => `<option ${ui.absType === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <select class="input" data-change="absMonth"><option value="">كل الأشهر</option>${months.map((mm) => `<option value="${mm}" ${ui.absMonth === mm ? 'selected' : ''}>${MONTHS[Number(mm.slice(5)) - 1]} ${mm.slice(0, 4)}</option>`).join('')}</select>
      ${ui.absTeacher || ui.absType || ui.absMonth ? '<button class="btn sm ghost" data-act="absClear">مسح الفلاتر</button>' : ''}
    </div>
    <div class="grid" style="grid-template-columns:1fr 280px;align-items:start">
      <div class="card"><div class="table-wrap">${list.length ? `<table>
        <thead><tr><th>المعلمة</th><th>من</th><th>إلى</th><th>المدة</th><th>النوع</th><th>ملاحظات</th><th>فارس</th><th></th></tr></thead>
        <tbody>${list.map((a) => `<tr>
          <td><b class="link" data-act="tProfile" data-id="${a.teacherId}">${esc(tName(a.teacherId))}</b></td>
          <td>${dayName(a.date)}<br><span class="muted">${fmtG(a.date)}</span><br><span class="muted">${fmtH(a.date)}</span></td>
          <td>${a.dateTo && a.dateTo !== a.date ? `${dayName(a.dateTo)}<br><span class="muted">${fmtG(a.dateTo)}</span>` : '—'}</td>
          <td>${/تأخر|خروج/.test(a.type) ? (a.duration || '—') : daysLabel(workDays(a.date, a.dateTo))}</td>
          <td><span class="chip ${absChipCls(a.type)}">${esc(a.type)}</span></td>
          <td style="max-width:220px">${esc(a.notes)}</td>
          <td><span class="check ${a.faris ? 'on' : ''}" data-act="absFaris" data-id="${a.id}" title="تم الإدخال في نظام فارس">${a.faris ? '✓' : ''}</span></td>
          <td class="actions"><button class="icon-btn" data-act="absEdit" data-id="${a.id}">✏️</button><button class="icon-btn" data-act="absDel" data-id="${a.id}">🗑️</button></td></tr>`).join('')}
        </tbody></table>` : emptyState('📋', 'لا توجد سجلات غياب')}</div></div>
      <div class="grid">
        ${hook('absenceSide')}
        <div class="card"><h3>حسب النوع (أيام عمل)</h3>${Object.keys(byType).length ? `<div class="list">${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="li"><div class="grow">${esc(k)}</div><b>${v}</b></div>`).join('')}</div>` : '<div class="muted">—</div>'}</div>
        <div class="card"><h3>الأكثر غياباً</h3>${topT.length ? `<div class="list">${topT.map(([id, v]) => `<div class="li"><div class="grow">${esc(tName(id))}</div><b>${v}</b></div>`).join('')}</div>` : '<div class="muted">—</div>'}</div>
        <div class="card"><div class="muted">✓ عمود «فارس» لتعليم السجلات التي أُدخلت في نظام فارس. ${db.absences.filter((a) => !a.faris).length ? `<br><b style="color:var(--amber)">${db.absences.filter((a) => !a.faris).length} سجل لم يُدخل بعد.</b>` : ''}</div></div>
      </div>
    </div>`;
  },
};
function openAbsence(a) {
  if (!db.teachers.length) { toast('أضيفي المعلمات أولاً من قسم «المعلمات»', 'err'); return go('teachers'); }
  formModal({
    title: a ? 'تعديل سجل الغياب' : 'تسجيل غياب / إجازة',
    fields: [
      { key: 'teacherId', label: 'اسم المعلمة', type: 'select', full: true, required: true, options: [['', '— اختاري —'], ...sortedTeachers().map((t) => [t.id, t.name])] },
      { key: 'date', label: 'تاريخ الغياب (من)', type: 'date', required: true },
      { key: 'dateTo', label: 'إلى تاريخ (اختياري)', type: 'date', hint: 'اتركيه فارغاً إذا كان يوماً واحداً' },
      { key: 'type', label: 'نوع الغياب', type: 'select', options: ABSENCE_TYPES, required: true },
      { key: 'duration', label: 'المدة (للتأخر / الخروج)', type: 'text', hint: 'مثال: 45 دقيقة' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, voice: true },
      { key: 'faris', label: 'تم إدخاله في نظام فارس', type: 'checkbox', full: true },
    ],
    values: a || { date: todayISO(), type: ABSENCE_TYPES[0] },
    validate: (v) => (v.dateTo && v.dateTo < v.date ? 'تاريخ النهاية قبل تاريخ البداية' : null),
    onSave: (v) => { if (v.dateTo === v.date) v.dateTo = ''; if (a) Object.assign(a, v); else db.absences.push({ id: uid(), ...v }); commit(); toast('تم حفظ سجل الغياب', 'ok'); hook('absenceSaved', v); },
  });
}

// ═════════════ متابعة دخول الحصص ═════════════
VIEWS.entries = {
  actions: () => `${db.classEntries.some((e) => e.date === (ui.entryDate || todayISO()) && e.status === 'early') ? '<button class="btn primary" data-act="entryMailAll">💌 رسائل الشكر</button>' : ''}<button class="btn" data-act="entryCsv">⬇ تصدير Excel</button><button class="btn" data-act="entryPrint">🖨 طباعة الاستمارة</button>`,
  render() {
    if (!ui.entryDate) ui.entryDate = todayISO();
    const d = ui.entryDate;
    const list = db.classEntries.filter((e) => e.date === d).sort((a, b) => a.period - b.period || tName(a.teacherId).localeCompare(tName(b.teacherId), 'ar'));
    const early = list.filter((e) => e.status === 'early');
    const unsent = early.filter((e) => !e.emailed);
    const periods = Array.from({ length: Number(db.settings.periods) || 7 }, (_, i) => i + 1);
    const counts = Object.fromEntries(Object.keys(ENTRY_STATUS).map((k) => [k, list.filter((e) => e.status === k).length]));
    const monthEarly = {};
    db.classEntries.filter((e) => e.status === 'early' && e.date.slice(0, 7) === d.slice(0, 7)).forEach((e) => { monthEarly[e.teacherId] = (monthEarly[e.teacherId] || 0) + 1; });
    const top = Object.entries(monthEarly).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<div class="toolbar">
      <button class="btn sm" data-act="entryDay" data-id="-1">→</button>
      <input type="date" class="input" value="${d}" data-change="entryDate">
      <button class="btn sm" data-act="entryDay" data-id="1">←</button>
      <b>${dayName(d)}</b><span class="muted">${fmtH(d)}</span>
      <span class="spacer"></span>
      ${Object.entries(ENTRY_STATUS).map(([k, s]) => `<span class="chip ${s.cls}">${s.label}: ${counts[k]}</span>`).join('')}
    </div>
    ${hook('entriesTop', d)}
    <div class="card" style="margin-bottom:16px"><h3>➕ تسجيل متابعة</h3>
      <div class="inline-form" id="entryForm">
        <div class="field"><label>الحصة</label><select class="input" name="period">${periods.map((p) => `<option value="${p}" ${ui.lastPeriod == p ? 'selected' : ''}>الحصة ${p}</option>`).join('')}</select></div>
        <div class="field" style="min-width:200px;flex:1"><label>المعلمة</label><select class="input" name="teacherId"><option value="">— اختاري —</option>${sortedTeachers().map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>الفصل</label><input class="input" name="className" placeholder="مثال: 2/3" style="width:100px"></div>
        <div class="field"><label>الحالة</label><select class="input" name="status">${Object.entries(ENTRY_STATUS).map(([k, s]) => `<option value="${k}" ${k === 'ontime' ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div class="field"><label>وقت الدخول</label><input type="time" class="input" name="time" value="${d === todayISO() ? `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}` : ''}"></div>
        <div class="field" style="min-width:180px;flex:1"><label>ملاحظة</label><input class="input" name="notes"></div>
        <button class="btn primary" data-act="entryAdd">إضافة</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 280px;align-items:start">
      <div class="card">
        ${unsent.length ? `<div class="banner" style="margin-bottom:12px;padding:10px 14px"><span>💌</span><div><b>${new Set(unsent.map((e) => e.teacherId)).size}</b> معلمة حضرت مبكراً ولم يُرسل لها شكر</div><span class="spacer"></span><button class="btn sm primary" data-act="entryMailAll">💌 اختيار المعلمات وإرسال الشكر</button></div>` : ''}
        <div class="table-wrap">${list.length ? `<table>
        <thead><tr><th>الحصة</th><th>المعلمة</th><th>الفصل</th><th>الحالة</th><th>الوقت</th><th>ملاحظة</th><th>الشكر</th><th></th></tr></thead>
        <tbody>${list.map((e) => { const st = ENTRY_STATUS[e.status]; return `<tr>
          <td>${e.period}</td><td><b>${esc(tName(e.teacherId))}</b></td><td>${esc(e.className)}</td>
          <td><select class="input" style="padding:3px 6px" data-change="entryStatus" data-id="${e.id}">${Object.entries(ENTRY_STATUS).map(([k, s]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></td>
          <td>${esc(e.time)}</td><td>${esc(e.notes)}</td>
          <td>${e.status === 'early' ? (e.emailed ? `<span class="chip green" data-act="entryMail" data-id="${e.id}" style="cursor:pointer" title="إعادة الإرسال">✓ أُرسل${e.thanksVia === 'wa' ? ' 💬' : ''}</span>` : `<button class="btn sm" data-act="entryMail" data-id="${e.id}">💌 شكر</button>`) : ''}</td>
          <td class="actions"><button class="icon-btn" data-act="entryDel" data-id="${e.id}">🗑️</button></td></tr>`; }).join('')}
        </tbody></table>` : emptyState('🚪', 'لا متابعات مسجّلة في هذا اليوم')}</div>
      </div>
      <div class="card"><h3>⭐ الأكثر حضوراً مبكراً هذا الشهر</h3>${top.length ? `<div class="list">${top.map(([id, n]) => `<div class="li"><div class="grow">${esc(tName(id))}</div><span class="chip green">${n}</span></div>`).join('')}</div>` : '<div class="muted">لا يوجد بعد</div>'}</div>
    </div>`;
  },
};
// ═════════════ 💌 رسائل الشكر (رسالة مستقلة باسم كل معلمة) ═════════════
const joinAr = (arr) => (arr.length <= 1 ? arr[0] ?? '' : arr.slice(0, -1).join('، ') + ' و' + arr[arr.length - 1]);
function thanksGroups(date) {
  const m = new Map();
  db.classEntries.filter((e) => e.date === date && e.status === 'early').sort((a, b) => a.period - b.period).forEach((e) => {
    if (!m.has(e.teacherId)) m.set(e.teacherId, { teacherId: e.teacherId, date, entries: [] });
    m.get(e.teacherId).entries.push(e);
  });
  return [...m.values()].sort((a, b) => tName(a.teacherId).localeCompare(tName(b.teacherId), 'ar'));
}
function fillGroup(tpl, g) {
  const s = db.settings, uniq = (a) => [...new Set(a.filter(Boolean).map(String))];
  return String(tpl || '').replace(/\{المعلمة\}/g, tName(g.teacherId))
    .replace(/\{الحصة\}/g, joinAr(uniq(g.entries.map((e) => e.period))))
    .replace(/\{الفصل\}/g, joinAr(uniq(g.entries.map((e) => e.className))))
    .replace(/\{اليوم\}/g, dayName(g.date)).replace(/\{التاريخ\}/g, `${fmtG(g.date)} (${fmtH(g.date)})`)
    .replace(/\{الموظفة\}/g, s.employeeName || '').replace(/\{المدرسة\}/g, s.schoolName || '');
}
const fillTemplate = (tpl, e) => fillGroup(tpl, { teacherId: e.teacherId, date: e.date, entries: [e] });
const TH = { date: null, groups: [], sel: new Set(), focus: null, edits: {}, queue: null, qi: 0, channel: 'email' };
// رقم الجوال بصيغة واتساب الدولية (السعودية افتراضياً)
function waNumber(phone) {
  let n = String(phone || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('05') && n.length === 10) n = '966' + n.slice(1);
  else if (n.startsWith('5') && n.length === 9) n = '966' + n;
  return n.length >= 10 ? n : '';
}
const thContact = (id) => (TH.channel === 'wa' ? waNumber(teacher(id)?.phone) : teacher(id)?.email || '');
const TH_CH = { email: { ic: '📧', name: 'البريد', none: 'بلا بريد', app: 'Gmail' }, wa: { ic: '💬', name: 'واتساب', none: 'بلا جوال', app: 'واتساب' } };
const thSent = (g) => g.entries.every((e) => e.emailed);
const thMsg = (g) => ({ subject: TH.edits[g.teacherId]?.subject ?? db.settings.earlySubject, body: TH.edits[g.teacherId]?.body ?? fillGroup(db.settings.earlyBody, g) });
function openThanks(date, only) {
  TH.date = date; TH.groups = thanksGroups(date); TH.edits = {}; TH.queue = null; TH.qi = 0; TH.channel = db.settings.thanksChannel || 'email'; TH.only = only;
  if (!TH.groups.length) return toast('لا توجد معلمات مسجّلات «حضرت مبكراً» في هذا اليوم');
  const can = (g) => !!thContact(g.teacherId);
  TH.sel = new Set(TH.groups.filter((g) => (only ? only.includes(g.teacherId) : !thSent(g)) && can(g)).map((g) => g.teacherId));
  TH.focus = (only && only[0]) || [...TH.sel][0] || TH.groups[0].teacherId;
  renderThanks();
}
function renderThanks() {
  const date = TH.date;
  let body, foot;
  if (TH.queue) {
    const q = TH.queue, cur = q[TH.qi];
    body = `<div class="th-steps">${q.map((g, i) => `<div class="th-step ${i < TH.qi ? 'done' : i === TH.qi ? 'cur' : ''}"><span>${i < TH.qi ? '✓' : i + 1}</span>${esc(tName(g.teacherId))}</div>`).join('')}</div>
      ${cur ? `<div class="th-now"><div class="muted">رسالة ${TH.qi + 1} من ${q.length}</div><div class="th-now-name">${esc(tName(cur.teacherId))}</div><div class="muted" dir="ltr">${esc(TH.channel === 'wa' ? '+' + thContact(cur.teacherId) : thContact(cur.teacherId))}</div>
        <button class="btn primary th-big" data-act="thOpen">${TH_CH[TH.channel].ic} فتح رسالتها في ${TH_CH[TH.channel].app}</button>
        <div class="muted" style="margin-top:8px">بعد الضغط على «إرسال» في ${TH_CH[TH.channel].app}، عودي هنا للرسالة التالية.</div></div>`
      : `<div class="th-now"><div style="font-size:44px">🌷</div><div class="th-now-name">تم تجهيز كل رسائل الشكر</div><div class="muted">${q.length === 1 ? 'رسالة واحدة' : q.length === 2 ? 'رسالتان' : q.length <= 10 ? q.length + ' رسائل' : q.length + ' رسالة'}، كل واحدة باسم صاحبتها</div></div>`}`;
    foot = cur ? `<button class="btn" data-act="thSkip">تخطّي هذه المعلمة</button><button class="btn ghost" data-act="thBack">→ رجوع للاختيار</button>` : `<button class="btn primary" data-act="modalClose">إغلاق</button>`;
  } else {
    const g = TH.groups.find((x) => x.teacherId === TH.focus) || TH.groups[0];
    const t = teacher(g.teacherId), m = thMsg(g), edited = !!TH.edits[g.teacherId];
    const nSel = TH.sel.size, selectable = TH.groups.filter((x) => thContact(x.teacherId)), C = TH_CH[TH.channel], contact = thContact(g.teacherId);
    body = `<div class="th-grid">
      <div class="th-list">
        <div class="seg th-ch">${Object.entries(TH_CH).map(([k, c]) => `<button class="${TH.channel === k ? 'on' : ''}" data-act="thChannel" data-id="${k}">${c.ic} ${c.name}</button>`).join('')}</div>
        <div class="th-tools"><span class="muted">حضرن مبكراً: ${TH.groups.length}</span><span style="flex:1"></span>
          <button class="btn sm ghost" data-act="thAll">تحديد الكل</button><button class="btn sm ghost" data-act="thNone">إلغاء التحديد</button></div>
        ${TH.groups.map((x) => { const em = thContact(x.teacherId); const sent = thSent(x);
          return `<div class="th-row ${x.teacherId === g.teacherId ? 'on' : ''}" data-act="thFocus" data-id="${x.teacherId}">
            <input type="checkbox" ${TH.sel.has(x.teacherId) ? 'checked' : ''} ${em ? '' : 'disabled'} data-change="thSel" data-id="${x.teacherId}" title="${em ? 'تحديد' : C.none}">
            <div class="grow"><div class="t">${esc(tName(x.teacherId))}</div><div class="s">الحصة ${esc(joinAr([...new Set(x.entries.map((e) => String(e.period)))]))}${x.entries.some((e) => e.className) ? ' · فصل ' + esc(joinAr([...new Set(x.entries.map((e) => e.className).filter(Boolean))])) : ''}</div></div>
            ${!em ? `<span class="chip red">${C.none}</span>` : sent ? '<span class="chip green">✓ أُرسل</span>' : TH.edits[x.teacherId] ? '<span class="chip brand">معدّلة</span>' : ''}
          </div>`; }).join('')}
      </div>
      <div class="th-preview">
        <div class="th-to"><span class="muted">إلى:</span> <b>${esc(tName(g.teacherId))}</b> ${contact ? `<span class="muted" dir="ltr">&lt;${esc(TH.channel === 'wa' ? '+' + contact : contact)}&gt;</span>` : ''}</div>
        ${contact ? '' : TH.channel === 'wa'
          ? `<div class="th-noemail">لا يوجد رقم جوال صحيح لهذه المعلمة. أضيفيه الآن:<div style="display:flex;gap:6px;margin-top:6px"><input class="input" id="thEmail" dir="ltr" placeholder="05xxxxxxxx" style="flex:1"><button class="btn sm primary" data-act="thAddEmail" data-id="${g.teacherId}">حفظ الجوال</button></div></div>`
          : `<div class="th-noemail">لا يوجد بريد لهذه المعلمة. أضيفيه الآن:<div style="display:flex;gap:6px;margin-top:6px"><input class="input" id="thEmail" dir="ltr" placeholder="name@gmail.com" style="flex:1"><button class="btn sm primary" data-act="thAddEmail" data-id="${g.teacherId}">حفظ البريد</button></div></div>`}
        ${TH.channel === 'wa' ? '' : `<div class="field" style="margin-top:10px"><label>الموضوع</label><input class="input" value="${esc(m.subject)}" data-change="thSubj" data-id="${g.teacherId}"></div>`}
        <div class="field" style="margin-top:10px"><label>نص الرسالة <span class="muted" style="font-weight:400">— خاص بـ${esc(tName(g.teacherId))} فقط</span></label>
          <textarea class="input" rows="11" data-change="thBody" data-id="${g.teacherId}">${esc(m.body)}</textarea></div>
        ${edited ? `<button class="btn sm ghost" data-act="thRevert" data-id="${g.teacherId}">↺ إرجاع النص الأصلي</button>` : '<div class="muted" style="font-size:12px">القالب العام يُعدَّل من الإعدادات ← رسالة الشكر للحضور المبكر</div>'}
      </div>
    </div>`;
    foot = `<button class="btn primary" data-act="thStart" ${nSel ? '' : 'disabled'}>${C.ic} ${nSel === 0 ? 'اختاري المعلمات أولاً' : nSel === 1 ? `إرسال الشكر إلى ${esc(tName([...TH.sel][0]))}` : `إرسال ${nSel === 2 ? 'رسالتين' : nSel <= 10 ? nSel + ' رسائل' : nSel + ' رسالة'} — كل رسالة باسم معلمتها`}</button><button class="btn" data-act="modalClose">إلغاء</button>
      <span style="flex:1"></span><span class="muted">${selectable.length < TH.groups.length ? `${TH.groups.length - selectable.length} ${C.none}` : ''}</span>`;
  }
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal th-modal">
    <div class="modal-h"><h2>💌 رسائل الشكر — ${dayName(date)} ${fmtG(date)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">${body}</div><div class="modal-f">${foot}</div></div></div>`;
  modalCtx = { thanks: true };
}
async function thOpenCurrent() {
  const g = TH.queue[TH.qi], t = teacher(g.teacherId), m = thMsg(g), s = db.settings;
  if (TH.channel === 'wa') {
    api.openUrl(`https://wa.me/${thContact(g.teacherId)}?text=${encodeURIComponent(m.body)}`);
  } else if (api.isDesktop && s.gmailUser && s.gmailPass) {
    const r = await api.sendMail({ settings: s, to: t.email, subject: m.subject, text: m.body });
    if (!r.ok) return toast(`تعذّر الإرسال إلى ${tName(g.teacherId)}: ${r.error}`, 'err');
  } else {
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.email)}&su=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`);
  }
  g.entries.forEach((e) => { e.emailed = true; e.emailedAt = todayISO(); e.thanksVia = TH.channel; });
  commit(false); TH.qi++; renderThanks();
  if (TH.qi >= TH.queue.length) render();
}
const TH_CHANGES = ({
  thSel: (el) => { el.checked ? TH.sel.add(el.dataset.id) : TH.sel.delete(el.dataset.id); renderThanks(); },
  thSubj: (el) => { const g = TH.groups.find((x) => x.teacherId === el.dataset.id); TH.edits[g.teacherId] = { ...thMsg(g), subject: el.value }; },
  thBody: (el) => { const g = TH.groups.find((x) => x.teacherId === el.dataset.id); TH.edits[g.teacherId] = { ...thMsg(g), body: el.value }; const row = $(`.th-row[data-id="${g.teacherId}"]`); if (row && !row.querySelector('.chip')) row.insertAdjacentHTML('beforeend', '<span class="chip brand">معدّلة</span>'); },
});

// ═════════════ الإشراف على الفسحة ═════════════
VIEWS.break = {
  actions: () => `<button class="btn" data-act="breakPrint">🖨 طباعة</button><button class="btn primary" data-act="breakNew">＋ ملاحظة إشراف</button>`,
  render() {
    const t = todayISO();
    const supDay = Number(db.settings.supervisionDay);
    const isToday = parse(t).getDay() === supDay && !isWeekend(t);
    const next = nextSupervisionDate(isToday ? addDays(t, 1) : t);
    let list = db.breakNotes.filter((b) => !ui.breakFilter || b.category === ui.breakFilter).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
    const groups = {};
    list.forEach((b) => (groups[b.date] = groups[b.date] || []).push(b));
    const supDates = [...new Set(db.breakNotes.map((b) => b.date))].length;
    return `<div class="grid g3" style="margin-bottom:16px">
      <div class="card"><div class="muted">يوم الإشراف الأسبوعي</div>
        <select class="input" data-change="supDay" style="margin-top:6px;width:100%">${DOW.slice(0, 5).map((d, i) => `<option value="${i}" ${supDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="card stat"><span class="l">${isToday ? 'اليوم يوم إشرافكِ 🔔' : 'الإشراف القادم'}</span><span class="n" style="font-size:20px">${isToday ? fmtG(t) : `${dayName(next)} ${fmtG(next)}`}</span></div>
      <div class="card stat"><span class="n">${db.breakNotes.length}</span><span class="l">ملاحظة في ${supDates} يوم إشراف</span></div>
    </div>
    <div class="toolbar"><div class="seg"><button class="${!ui.breakFilter ? 'on' : ''}" data-act="breakFilter" data-id="">الكل</button>${Object.entries(BREAK_CATS).map(([k, l]) => `<button class="${ui.breakFilter === k ? 'on' : ''}" data-act="breakFilter" data-id="${k}">${l}</button>`).join('')}</div></div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([d, arr]) => `<div class="date-group">${dayName(d)} ${fmtG(d)} <span class="muted">— ${fmtH(d)}</span></div>
      ${arr.map((b) => `<div class="note-card" style="border-right-color:var(--${BREAK_CAT_CLS[b.category] || 'brand'}, var(--brand))">
        <div class="meta"><span class="chip ${BREAK_CAT_CLS[b.category]}">${BREAK_CATS[b.category] || ''}</span><span>📍 ${esc(b.location)}</span>${b.time ? `<span>🕘 ${esc(b.time)}</span>` : ''}${b.student ? `<span>👧 ${esc(b.student)}</span>` : ''}
          <span style="flex:1"></span><button class="icon-btn" data-act="breakEdit" data-id="${b.id}">✏️</button><button class="icon-btn" data-act="breakDel" data-id="${b.id}">🗑️</button></div>
        <div class="txt">${esc(b.notes)}</div>
        ${b.action ? `<div class="muted" style="margin-top:4px">الإجراء المتخذ: ${esc(b.action)}</div>` : ''}
      </div>`).join('')}`).join('') : `<div class="card">${emptyState('🔔', 'لا ملاحظات إشراف بعد. اضغطي «＋ ملاحظة إشراف» وجرّبي الإدخال بالصوت 🎤')}</div>`}`;
  },
};
function openBreak(b) {
  const now = new Date();
  formModal({
    title: b ? 'تعديل ملاحظة الإشراف' : 'ملاحظة إشراف على الفسحة',
    fields: [
      { key: 'date', label: 'التاريخ', type: 'date', required: true },
      { key: 'time', label: 'الوقت', type: 'time' },
      { key: 'location', label: 'الموقع', type: 'select', options: BREAK_LOCS },
      { key: 'category', label: 'نوع الملاحظة', type: 'select', options: Object.entries(BREAK_CATS) },
      { key: 'student', label: 'اسم الطالبة / الفصل (اختياري)', type: 'text', full: true, voice: true },
      { key: 'notes', label: 'الملاحظة', type: 'textarea', full: true, voice: true, required: true, rows: 5 },
      { key: 'action', label: 'الإجراء المتخذ', type: 'text', full: true, voice: true },
    ],
    values: b || { date: todayISO(), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, location: BREAK_LOCS[0], category: 'general' },
    onSave: (v) => { if (b) Object.assign(b, v); else db.breakNotes.push({ id: uid(), ...v }); commit(); toast('تم حفظ الملاحظة', 'ok'); },
  });
}

// ═════════════ الأيام العالمية والوطنية ═════════════
VIEWS.occasions = {
  actions: () => `<button class="btn primary" data-act="occNew">＋ مناسبة</button>`,
  render() {
    const t = todayISO();
    let list = db.occasions.map((o) => ({ o, d: occNextDate(o), st: occStatus(o) }));
    const f = ui.occFilter;
    if (f === 'upcoming') list = list.filter((x) => diffDays(t, x.d) <= 60);
    if (f === 'national') list = list.filter((x) => x.o.type === 'national');
    if (f === 'global') list = list.filter((x) => x.o.type === 'global');
    if (f === 'islamic') list = list.filter((x) => x.o.type === 'islamic');
    if (f === 'noinit') list = list.filter((x) => !x.o.initiative);
    list.sort((a, b) => a.d.localeCompare(b.d));
    const segs = [['upcoming', 'خلال شهرين'], ['all', 'الكل'], ['national', 'وطنية'], ['global', 'عالمية'], ['islamic', 'إسلامية'], ['noinit', 'بدون مبادرة']];
    return `<div class="toolbar"><div class="seg">${segs.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="occFilter" data-id="${k}">${l}</button>`).join('')}</div>
      <span class="spacer"></span><span class="muted">يمكنكِ تعديل أي تاريخ أو إضافة مناسبات، أو تحديث القائمة كاملة من ملف Excel</span></div>
    ${list.length ? `<div class="grid g2">${list.map(({ o, d, st }) => {
      const dd = diffDays(t, d); const S = OCC_STATUS[st];
      return `<div class="card occ-card">
        <div class="occ-date ${o.type}"><b>${o.day}</b><span>${o.cal === 'h' ? HMONTHS[o.month - 1] : MONTHS[o.month - 1]}</span></div>
        <div class="occ-body">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="t">${esc(o.name)}</span><span class="chip ${(OCC_TYPES[o.type] || OCC_TYPES.global)[1]}">${(OCC_TYPES[o.type] || OCC_TYPES.global)[0]}</span><span class="chip ${S.cls}">${S.label}</span></div>
          <div class="muted">${dayName(d)} · ${dd === 0 ? '<b style="color:var(--brand)">اليوم</b>' : 'بعد ' + daysLabel(dd)} · ${fmtH(d)}</div>
          <div class="ini">${o.initiative ? `💡 <b>المبادرة:</b> ${esc(o.initiative)}` : '<span class="muted">لم تُحدَّد مبادرة بعد</span>'}${o.responsible ? `<br>👤 <b>المسؤولة:</b> ${esc(o.responsible)}` : ''}${o.notes ? `<br><span class="muted">${esc(o.notes)}</span>` : ''}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <button class="btn sm" data-act="occEdit" data-id="${o.id}">✏️ المبادرة والتفاصيل</button>
            <button class="btn sm" data-act="occTask" data-id="${o.id}">＋ مهمة تحضير</button>
            ${st !== 'done' ? `<button class="btn sm" data-act="occDone" data-id="${o.id}">✓ نُفّذت</button>` : ''}
          </div>
        </div></div>`;
    }).join('')}</div>` : `<div class="card">${emptyState('🎉', 'لا توجد مناسبات في هذا العرض')}</div>`}`;
  },
};
function openOcc(o) {
  const year = o ? parse(occNextDate(o)).getFullYear() : null;
  formModal({
    title: o ? o.name : 'مناسبة جديدة',
    fields: [
      { key: 'name', label: 'اسم المناسبة', type: 'text', full: true, required: true },
      { key: 'type', label: 'النوع', type: 'select', options: Object.entries(OCC_TYPES).map(([k, v]) => [k, v[0]]) },
      { key: 'cal', label: 'التقويم', type: 'select', options: [['g', 'ميلادي'], ['h', 'هجري']] },
      { key: 'status', label: 'الحالة', type: 'select', options: Object.entries(OCC_STATUS).map(([k, v]) => [k, v.label]) },
      { key: 'day', label: 'اليوم', type: 'number', min: 1, max: 31, required: true },
      { key: 'month', label: 'الشهر', type: 'select', options: MONTHS.map((m, i) => [String(i + 1), `${i + 1} — ${m} / ${HMONTHS[i]}`]) },
      { key: 'initiative', label: 'المبادرة / دوركِ في هذا اليوم', type: 'textarea', full: true, voice: true, rows: 3 },
      { key: 'responsible', label: 'المسؤولة عن التنفيذ', type: 'text', full: true, voice: true },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, voice: true, rows: 2 },
    ],
    values: o ? { ...o, cal: o.cal || 'g', status: occStatus(o), month: String(o.month) } : { type: 'global', cal: 'g', status: 'todo', month: String(new Date().getMonth() + 1), day: new Date().getDate() },
    onSave: (v) => {
      v.month = Number(v.month); v.day = Number(v.day);
      if (o) { Object.assign(o, v); o.year = parse(occNextDate(o)).getFullYear(); }
      else { const n = { id: uid(), ...v }; n.year = parse(occNextDate(n)).getFullYear(); db.occasions.push(n); }
      commit(); toast('تم الحفظ', 'ok');
    },
    extraButtons: o ? `<button class="btn danger" data-act="occDel" data-id="${o.id}">حذف المناسبة</button>` : '',
  });
  void year;
}

// ═════════════ الزيارات ═════════════
VIEWS.visits = {
  actions: () => (ui.visitSel ? `<button class="btn" data-act="visitBack">→ كل الزيارات</button><button class="btn" data-act="visitPrint" data-id="${ui.visitSel}">🖨 تقرير الزيارة</button>` : '') + `<button class="btn primary" data-act="visitNew">＋ زيارة</button>`,
  render() {
    const t = todayISO();
    if (ui.visitSel) {
      const v = db.visits.find((x) => x.id === ui.visitSel);
      if (v) return visitDetail(v);
      ui.visitSel = null;
    }
    const up = db.visits.filter((v) => v.date >= t && v.status !== 'done').sort((a, b) => a.date.localeCompare(b.date));
    const past = db.visits.filter((v) => !(v.date >= t && v.status !== 'done')).sort((a, b) => b.date.localeCompare(a.date));
    const card = (v) => { const done = v.checklist.filter((c) => c.done).length; const pct = v.checklist.length ? Math.round((done / v.checklist.length) * 100) : 0; const S = VISIT_STATUS[v.status] || VISIT_STATUS.planned; const dd = diffDays(t, v.date);
      return `<div class="card clickable" style="cursor:pointer" data-act="visitOpen" data-id="${v.id}">
        <div style="display:flex;gap:8px;align-items:center"><b style="font-size:15.5px">${esc(v.team)}</b><span class="chip ${S.cls}">${S.label}</span><span style="flex:1"></span>${dd >= 0 && v.status !== 'done' ? `<span class="chip ${dd <= 2 ? 'amber' : ''}">${dd === 0 ? 'اليوم' : 'بعد ' + daysLabel(dd)}</span>` : ''}</div>
        <div class="muted">${dayName(v.date)} ${fmtG(v.date)} ${v.time ? '· ' + esc(v.time) : ''}</div>
        ${v.purpose ? `<div style="margin:6px 0">${esc(v.purpose)}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px"><div class="progress" style="flex:1"><div style="width:${pct}%"></div></div><span class="muted">${done}/${v.checklist.length}</span></div>
      </div>`; };
    return `<div class="section-title" style="margin-top:0">الزيارات القادمة</div>
      ${up.length ? `<div class="grid g2">${up.map(card).join('')}</div>` : `<div class="card">${emptyState('🤝', 'لا زيارات قادمة')}</div>`}
      ${past.length ? `<div class="section-title">الزيارات السابقة</div><div class="grid g2">${past.map(card).join('')}</div>` : ''}`;
  },
};
function visitDetail(v) {
  const done = v.checklist.filter((c) => c.done).length;
  const S = VISIT_STATUS[v.status] || VISIT_STATUS.planned;
  return `<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
    <div class="grid">
      <div class="card"><h3>🤝 ${esc(v.team)} <span class="chip ${S.cls}">${S.label}</span><span class="more"><button class="btn sm" data-act="visitEdit" data-id="${v.id}">✏️ تعديل</button></span></h3>
        <div class="kv">
          <span class="k">التاريخ</span><span>${dayName(v.date)} ${fmtG(v.date)} — ${fmtH(v.date)}</span>
          <span class="k">الوقت</span><span>${esc(v.time || '—')}</span>
          <span class="k">أعضاء الفريق</span><span style="white-space:pre-wrap">${esc(v.members || '—')}</span>
          <span class="k">الهدف</span><span style="white-space:pre-wrap">${esc(v.purpose || '—')}</span>
          <span class="k">المرافقة</span><span>${esc(v.escort || '—')}</span>
        </div>
      </div>
      <div class="card"><h3>📝 خطة الاستقبال وتنظيم المدرسة</h3><div style="white-space:pre-wrap">${esc(v.reception) || '<span class="muted">لم تُكتب بعد — من زر «تعديل»</span>'}</div></div>
      <div class="card"><h3>💬 ملاحظات وتوصيات الفريق</h3><div style="white-space:pre-wrap">${esc(v.notes) || '<span class="muted">—</span>'}</div></div>
    </div>
    <div class="card"><h3>✅ قائمة التجهيز <span class="muted" style="font-weight:400">${done} من ${v.checklist.length}</span></h3>
      <div class="progress" style="margin-bottom:10px"><div style="width:${v.checklist.length ? (done / v.checklist.length) * 100 : 0}%"></div></div>
      <div class="list">${v.checklist.map((c, i) => `<div class="li ${c.done ? 'done' : ''}"><span class="check ${c.done ? 'on' : ''}" data-act="visitCheck" data-id="${v.id}" data-i="${i}">${c.done ? '✓' : ''}</span><div class="grow"><div class="t" style="font-weight:500">${esc(c.text)}</div></div><button class="icon-btn" data-act="visitCheckDel" data-id="${v.id}" data-i="${i}">✕</button></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><input class="input" id="newCheck" placeholder="إضافة بند تجهيز…" style="flex:1"><button class="btn" data-act="visitCheckAdd" data-id="${v.id}">إضافة</button></div>
    </div>
  </div>`;
}
function openVisit(v) {
  formModal({
    title: v ? 'تعديل الزيارة' : 'زيارة جديدة',
    wide: true,
    fields: [
      { key: 'team', label: 'جهة / فريق الزيارة', type: 'text', full: true, required: true, voice: true, hint: 'مثال: فريق الإشراف التربوي — مكتب التعليم' },
      { key: 'date', label: 'تاريخ الزيارة', type: 'date', required: true },
      { key: 'time', label: 'وقت الوصول', type: 'time' },
      { key: 'status', label: 'الحالة', type: 'select', options: Object.entries(VISIT_STATUS).map(([k, s]) => [k, s.label]) },
      { key: 'escort', label: 'المرافقة للفريق', type: 'text' },
      { key: 'members', label: 'أعضاء الفريق', type: 'textarea', full: true, rows: 2, voice: true },
      { key: 'purpose', label: 'هدف الزيارة', type: 'textarea', full: true, rows: 2, voice: true },
      { key: 'reception', label: 'خطة الاستقبال وتنظيم المدرسة', type: 'textarea', full: true, rows: 4, voice: true },
      { key: 'notes', label: 'ملاحظات وتوصيات الفريق', type: 'textarea', full: true, rows: 4, voice: true },
    ],
    values: v || { date: todayISO(), status: 'planned' },
    onSave: (val) => {
      if (v) Object.assign(v, val);
      else {
        const nv = { id: uid(), ...val, checklist: VISIT_CHECKLIST.map((text) => ({ text, done: false })) };
        db.visits.push(nv); ui.visitSel = nv.id; ui.view = 'visits';
        // إضافة مهمة تذكير قبل الزيارة بيومين
        db.tasks.push({ id: uid(), title: `تجهيز المدرسة لزيارة: ${val.team}`, due: addDays(val.date, -2) < todayISO() ? todayISO() : addDays(val.date, -2), priority: 'high', category: 'الزيارات', status: 'todo', notes: '' });
      }
      commit(); toast(v ? 'تم الحفظ' : 'تمت إضافة الزيارة مع قائمة التجهيز ومهمة تذكير', 'ok');
    },
    extraButtons: v ? `<button class="btn danger" data-act="visitDel" data-id="${v.id}">حذف الزيارة</button>` : '',
  });
}

// ═════════════ مكتبة المعرفة ═════════════
const LIB_KINDS = { circular: { label: 'تعميم', cls: 'blue', ic: '📜' }, card: { label: 'بطاقة معرفية', cls: 'purple', ic: '💡' } };
const fileIcon = (ext) => (ext === 'pdf' ? '📕' : /docx?/.test(ext) ? '📘' : /png|jpe?g|gif|webp|bmp/.test(ext) ? '🖼️' : '📎');
const isImage = (att) => att && /^(png|jpe?g|gif|webp|bmp)$/.test(att.ext);
const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1e3)) + ' ك.ب');
const libCats = () => [...new Set(db.library.map((x) => x.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
VIEWS.library = {
  actions: () => `<button class="btn" data-act="libNew" data-id="card">＋ بطاقة معرفية</button><button class="btn primary" data-act="libNew" data-id="circular">＋ تعميم</button>`,
  render() {
    const all = db.library;
    let list = all.filter((x) => (!ui.libKind || x.kind === ui.libKind) && (!ui.libCat || x.category === ui.libCat));
    list.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    const segs = [['', `الكل (${all.length})`], ['circular', `التعاميم (${all.filter((x) => x.kind === 'circular').length})`], ['card', `البطاقات المعرفية (${all.filter((x) => x.kind === 'card').length})`]];
    const cats = libCats();
    const card = (x) => {
      const K = LIB_KINDS[x.kind] || LIB_KINDS.card;
      const search = [x.title, x.description, x.number, x.source, x.category, x.file?.name].join(' ').toLowerCase();
      return `<div class="card lib-card" data-search="${esc(search)}">
        ${isImage(x.file) ? `<div class="lib-thumb" data-act="libOpen" data-id="${x.id}"><img data-preview="${x.id}" alt=""></div>` : ''}
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="chip ${K.cls}">${K.ic} ${K.label}</span>${x.category ? `<span class="chip">${esc(x.category)}</span>` : ''}${x.important ? '<span class="chip red">مهم</span>' : ''}</div>
        <div class="lib-title">${esc(x.title)}</div>
        ${x.kind === 'circular' && (x.number || x.date || x.source) ? `<div class="muted">${x.number ? `رقم ${esc(x.number)}` : ''}${x.number && x.date ? ' · ' : ''}${x.date ? `${fmtG(x.date)} — ${fmtH(x.date)}` : ''}${x.source ? ` · ${esc(x.source)}` : ''}</div>` : ''}
        ${x.description ? `<div class="lib-desc">${esc(x.description)}</div>` : ''}
        <div class="lib-foot">
          ${x.file ? `<button class="btn sm" data-act="libOpen" data-id="${x.id}" title="${esc(x.file.name)}">${fileIcon(x.file.ext)} فتح الملف</button><button class="icon-btn" data-act="libSave" data-id="${x.id}" title="حفظ نسخة">⬇</button>` : '<span class="muted">بدون مرفق</span>'}
          <span style="flex:1"></span>
          <button class="icon-btn" data-act="libView" data-id="${x.id}" title="عرض">👁</button>
          <button class="icon-btn" data-act="libEdit" data-id="${x.id}" title="تعديل">✏️</button>
          <button class="icon-btn" data-act="libDel" data-id="${x.id}" title="حذف">🗑️</button>
        </div>
      </div>`;
    };
    return `<div class="toolbar">
      <div class="seg">${segs.map(([k, l]) => `<button class="${ui.libKind === k ? 'on' : ''}" data-act="libKind" data-id="${k}">${l}</button>`).join('')}</div>
      ${cats.length ? `<select class="input" data-change="libCat"><option value="">كل التصنيفات</option>${cats.map((c) => `<option ${ui.libCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
      <span class="spacer"></span>
      <input class="input" id="libSearch" placeholder="🔍 بحث في العنوان والوصف ورقم التعميم…" style="width:300px">
    </div>
    ${list.length ? `<div class="lib-grid" id="libGrid">${list.map(card).join('')}</div><div id="libNoMatch" class="card" style="display:none">${emptyState('🔍', 'لا توجد نتائج مطابقة')}</div>`
      : `<div class="card">${emptyState('📚', all.length ? 'لا توجد عناصر في هذا التصنيف' : 'مكتبة المعرفة فارغة.<br>أضف التعاميم والبطاقات المعرفية مع ملفاتها (PDF أو Word أو صورة) لتكون مرجعاً سريعاً.')}</div>`}`;
  },
  after() {
    $$('img[data-preview]').forEach(async (img) => {
      const x = db.library.find((i) => i.id === img.dataset.preview);
      const src = x && (await api.libPreview(x.file));
      if (src) img.src = src; else img.parentElement.remove();
    });
    const q = $('#libSearch');
    if (q) { q.value = ui.libQuery || ''; filterLib(); }
  },
};
function filterLib() {
  const q = (ui.libQuery || '').trim().toLowerCase();
  let shown = 0;
  $$('.lib-card').forEach((c) => { const ok = !q || q.split(/\s+/).every((w) => c.dataset.search.includes(w)); c.style.display = ok ? '' : 'none'; if (ok) shown++; });
  const nm = $('#libNoMatch'); if (nm) nm.style.display = shown ? 'none' : '';
}
function openLib(x, kind) {
  const k = x ? x.kind : kind;
  const circ = k === 'circular';
  formModal({
    title: x ? 'تعديل' : circ ? 'إضافة تعميم' : 'إضافة بطاقة معرفية',
    wide: true,
    fields: [
      { key: 'kind', label: 'النوع', type: 'select', options: Object.entries(LIB_KINDS).map(([v, o]) => [v, o.label]) },
      { key: 'category', label: 'التصنيف', type: 'text', list: libCats(), hint: 'مثال: شؤون المعلمات، الاختبارات، الصحة المدرسية' },
      { key: 'title', label: 'العنوان', type: 'text', full: true, required: true, voice: true },
      { key: 'number', label: 'رقم التعميم', type: 'text' },
      { key: 'date', label: 'تاريخ التعميم', type: 'date' },
      { key: 'source', label: 'جهة الإصدار', type: 'text', full: true, hint: 'مثال: وزارة التعليم، إدارة التعليم، مكتب التعليم' },
      { key: 'description', label: 'الوصف', type: 'textarea', full: true, rows: 5, voice: true },
      { key: 'file', label: 'الملف المرفق (PDF أو Word أو صورة)', type: 'file', full: true },
      { key: 'important', label: 'تمييز كعنصر مهم', type: 'checkbox', full: true },
    ],
    values: x || { kind: k, date: circ ? todayISO() : '' },
    onSave: (v) => {
      if (x) {
        if (x.file && x.file !== v.file) api.libDelete(x.file);
        Object.assign(x, v);
      } else db.library.push({ id: uid(), createdAt: todayISO(), ...v });
      commit(); toast('تم الحفظ في مكتبة المعرفة', 'ok');
    },
  });
}
function viewLib(x) {
  const K = LIB_KINDS[x.kind] || LIB_KINDS.card;
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide">
    <div class="modal-h"><h2>${K.ic} ${esc(x.title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="chip ${K.cls}">${K.label}</span>${x.category ? `<span class="chip">${esc(x.category)}</span>` : ''}${x.important ? '<span class="chip red">مهم</span>' : ''}</div>
      ${x.number || x.date || x.source ? `<div class="kv" style="margin-bottom:12px">${x.number ? `<span class="k">رقم التعميم</span><span>${esc(x.number)}</span>` : ''}${x.date ? `<span class="k">التاريخ</span><span>${fmtG(x.date)} — ${fmtH(x.date)}</span>` : ''}${x.source ? `<span class="k">جهة الإصدار</span><span>${esc(x.source)}</span>` : ''}</div>` : ''}
      <div style="white-space:pre-wrap;line-height:1.9">${esc(x.description) || '<span class="muted">لا يوجد وصف</span>'}</div>
      ${isImage(x.file) ? `<img id="libBig" style="max-width:100%;border-radius:10px;margin-top:14px;display:block">` : ''}
      ${x.file ? `<div class="file-pick" style="margin-top:14px"><span style="font-size:22px">${fileIcon(x.file.ext)}</span><div class="grow"><b>${esc(x.file.name)}</b><div class="muted">${fmtSize(x.file.size || 0)}</div></div><button class="btn sm primary" data-act="libOpen" data-id="${x.id}">فتح</button><button class="btn sm" data-act="libSave" data-id="${x.id}">حفظ نسخة</button></div>` : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="libEdit" data-id="${x.id}">✏️ تعديل</button><button class="btn" data-act="modalClose">إغلاق</button></div>
  </div></div>`;
  modalCtx = {};
  if (isImage(x.file)) api.libPreview(x.file).then((src) => { const im = $('#libBig'); if (im && src) im.src = src; });
}

// ═════════════ الإعدادات ═════════════
VIEWS.settings = {
  render() {
    const s = db.settings;
    const f = (key, label, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input class="input" type="${type}" value="${esc(s[key])}" data-change="setting" data-id="${key}" ${extra}></div>`;
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><h3>🏫 بيانات المدرسة</h3><div class="form">
        ${f('schoolName', 'اسم المدرسة')}${f('employeeName', 'اسم الموظفة')}
        <div class="field"><label>يوم الإشراف على الفسحة</label><select class="input" data-change="supDay">${DOW.slice(0, 5).map((d, i) => `<option value="${i}" ${Number(s.supervisionDay) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        ${f('periods', 'عدد الحصص اليومية', 'number', 'min="1" max="10"')}
        <div class="field full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${s.notify ? 'checked' : ''} data-change="settingBool" data-id="notify"> تنبيه عند فتح التطبيق بالمهام المستحقة ويوم الإشراف</label></div>
        <div class="field full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${s.cheerOn !== false ? 'checked' : ''} data-change="settingBool" data-id="cheerOn"> 🌷 لمسات لطيفة أثناء العمل (رمز جميل وعبارة لطيفة كل ٥ دقائق)</label></div>
      </div></div>
      ${api.isDesktop ? `<div class="card"><h3>📧 البريد (Gmail)</h3><div class="form">
        ${f('gmailUser', 'بريد Gmail المُرسِل', 'email', 'dir="ltr"')}${f('senderName', 'اسم المرسل الظاهر')}
        <div class="field full"><label>كلمة مرور التطبيقات (App Password)</label><input class="input" type="password" dir="ltr" value="${esc(s.gmailPass)}" data-change="setting" data-id="gmailPass" placeholder="xxxx xxxx xxxx xxxx">
          <span class="hint">أنشئيها من حساب Google ← الأمان ← التحقق بخطوتين ← كلمات مرور التطبيقات. <a href="#" data-act="openUrl" data-id="https://myaccount.google.com/apppasswords">فتح الصفحة</a></span></div>
        <div class="field full"><button class="btn" data-act="mailTest" style="align-self:flex-start">اختبار الاتصال</button></div>
      </div></div>` : `<div class="card"><h3>📧 البريد (Gmail)</h3>
        <div class="muted">عند الضغط على «إرسال» بجانب المعلمة، تُفتح الرسالة جاهزة في Gmail (المستلمة والعنوان والنص)، وما عليكِ إلا الضغط على «إرسال».</div>
        <div class="muted" style="margin-top:8px">في أول مرة سيطلب Gmail تسجيل الدخول بحسابكِ داخل نافذة التطبيق، ويبقى مسجلاً بعدها.</div>
        <button class="btn" style="margin-top:12px" data-act="openUrl" data-id="https://mail.google.com">تسجيل الدخول إلى Gmail الآن</button>
      </div>`}
      ${Sync.supported() ? syncCard() : ''}
      <div class="card" style="grid-column:1/-1"><h3>💌 رسالة الشكر للحضور المبكر</h3><div class="form">
        <div class="field full"><label>عنوان الرسالة</label><input class="input" value="${esc(s.earlySubject)}" data-change="setting" data-id="earlySubject"></div>
        <div class="field full"><label>نص الرسالة</label><textarea class="input" rows="8" data-change="setting" data-id="earlyBody">${esc(s.earlyBody)}</textarea>
        <span class="hint">المتغيرات المتاحة: {المعلمة} {الحصة} {الفصل} {اليوم} {التاريخ} {الموظفة} {المدرسة}</span></div>
      </div></div>
      ${typeof phrasesCard === 'function' ? phrasesCard() : ''}
      ${hook('settingsCards')}
      <div class="card" style="grid-column:1/-1"><details class="adv" ${ui.advOpen ? 'open' : ''}><summary data-act="advToggle"><h3 style="display:inline-flex;margin:0">🛠️ إعدادات متقدمة</h3></summary>
        <div class="section-title" style="margin-top:14px">إظهار الأقسام في القائمة</div>
        <div class="muted" style="margin-bottom:10px">أزيلي العلامة عن أي قسم لإخفائه من القائمة. البيانات لا تُحذف، ويعود القسم بمحتواه كاملاً عند إظهاره.</div>
        <div class="adv-grid">${NAV_TREE.filter((g) => g.items).map((g) => `<div class="adv-group"><div class="adv-head">${g.ic} ${g.label}</div>${g.items.map((i) => `<label class="adv-item"><input type="checkbox" ${(s.hidden || []).includes(i.id) ? '' : 'checked'} data-change="navShow" data-id="${i.id}"> ${i.ic} ${i.label}</label>`).join('')}</div>`).join('')}</div>
        ${(s.hidden || []).length ? `<button class="btn sm" style="margin-top:12px" data-act="navShowAll">إظهار كل الأقسام</button>` : ''}
        ${(s.hidden || []).includes('quran') ? '<div class="muted" style="margin-top:8px">📖 مع إخفاء المصحف يتوقف تذكير الورد اليومي أيضاً.</div>' : ''}
      </details></div>
      <div class="card"><h3>💾 النسخ الاحتياطي</h3>
        <div class="muted" style="margin-bottom:10px">${api.isDesktop ? 'يحفظ التطبيق نسخة احتياطية تلقائية يومياً على الجهاز (آخر 30 يوماً). يُنصح أيضاً بحفظ نسخة على فلاش أو Google Drive أسبوعياً.' : 'البيانات محفوظة داخل التطبيق على هذا الجهاز. احفظي نسخة احتياطية أسبوعياً (تشمل ملفات مكتبة المعرفة) وانسخيها إلى فلاش أو Google Drive، وسيذكّركِ التطبيق بذلك.'}${db.settings.lastBackup ? `<br><b>آخر نسخة احتياطية: ${fmtG(db.settings.lastBackup)}</b>` : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="backupExport">حفظ نسخة احتياطية</button><button class="btn" data-act="backupImport">استعادة نسخة</button>${api.isDesktop ? '<button class="btn" data-act="openDataFolder">فتح مجلد البيانات</button>' : ''}</div>
      </div>
      <div class="card"><h3>🎤 الإدخال الصوتي</h3>
        <div class="muted">اضغطي زر 🎤 بجانب أي حقل نصي. ${api.isDesktop ? 'ستُفتح نافذة صغيرة في متصفح Edge — تحدّثي وسيظهر النص في الحقل مباشرة.' : 'تحدّثي وسيظهر النص في الحقل، ثم اضغطي الزر مرة أخرى للإيقاف.'} في أول مرة اسمحي باستخدام الميكروفون. يتطلب اتصالاً بالإنترنت.</div>
        <div class="field" style="margin-top:10px"><label>لغة الإملاء</label><select class="input" data-change="setting" data-id="voiceLang"><option value="ar-SA" ${s.voiceLang === 'ar-SA' ? 'selected' : ''}>العربية (السعودية)</option><option value="en-US" ${s.voiceLang === 'en-US' ? 'selected' : ''}>English</option></select></div>
      </div>
    </div>`;
  },
};

// ═════════════ نافذة النموذج العامة ═════════════
let modalCtx = null;
function formModal({ title, fields, values = {}, onSave, validate, wide, extraButtons = '' }) {
  const ctl = (f) => {
    const v = values[f.key] ?? '';
    const name = `name="${f.key}"`;
    let c;
    if (f.type === 'textarea') c = `<textarea class="input" ${name} rows="${f.rows || 3}">${esc(v)}</textarea>`;
    else if (f.type === 'select') c = `<select class="input" ${name}>${f.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
    else if (f.type === 'file') return `<div class="field full"><label>${f.label}</label><div class="file-pick drop" data-fkey="${f.key}">${filePickInner(values[f.key])}</div></div>`;
    else if (f.type === 'checkbox') return `<div class="field ${f.full ? 'full' : ''}"><label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" ${name} ${v ? 'checked' : ''}> ${f.label}</label></div>`;
    else c = `<input class="input" type="${f.type}" ${name} value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.list ? `list="dl_${f.key}"` : ''}>${f.list ? `<datalist id="dl_${f.key}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
    if (f.voice) c = `<div class="with-mic">${c}<button type="button" class="mic-btn" data-act="mic" title="إدخال بالصوت">🎤</button></div>`;
    return `<div class="field ${f.full ? 'full' : ''}"><label>${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label>${c}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}</div>`;
  };
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><form class="form" id="mform">${fields.map(ctl).join('')}</form></div>
    <div class="modal-f"><button class="btn primary" data-act="modalSave">حفظ</button><button class="btn" data-act="modalClose">إلغاء</button><span style="flex:1"></span>${extraButtons}</div>
  </div></div>`;
  modalCtx = { fields, onSave, validate, files: Object.fromEntries(fields.filter((f) => f.type === 'file').map((f) => [f.key, values[f.key] || null])), original: Object.fromEntries(fields.filter((f) => f.type === 'file').map((f) => [f.key, values[f.key] || null])), saved: false };
  setTimeout(() => $('#mform .input')?.focus(), 30);
}
function closeModal() {
  // حذف ملف اختير ثم أُلغي الحفظ
  if (modalCtx?.files && !modalCtx.saved) for (const k in modalCtx.files) { const f = modalCtx.files[k]; if (f && f !== modalCtx.original[k]) api.libDelete(f); }
  $('#modalRoot').innerHTML = ''; modalCtx = null; stopBrowserVoice();
}
function filePickInner(att) {
  if (att) return `<span style="font-size:22px">${fileIcon(att.ext)}</span><div class="grow"><b>${esc(att.name)}</b><div class="muted">${fmtSize(att.size || 0)}</div></div><button type="button" class="btn sm" data-act="pickFile">استبدال</button><button type="button" class="btn sm danger" data-act="clearFile">إزالة</button>`;
  return `<span style="font-size:22px">📎</span><div class="grow muted">اسحب الملف وأفلته هنا، أو</div><button type="button" class="btn sm primary" data-act="pickFile">اختيار ملف</button>`;
}
function setModalFile(box, att) {
  if (!att) return;
  if (att.error) return toast(att.error, 'err');
  const k = box.dataset.fkey, old = modalCtx.files[k];
  if (old && old !== modalCtx.original[k]) api.libDelete(old);
  modalCtx.files[k] = att;
  box.innerHTML = filePickInner(att);
  const t = $('#mform [name=title]'); if (t && !t.value) t.value = att.name.replace(/\.[^.]+$/, '');
}
function saveModal() {
  const form = $('#mform');
  const v = {};
  for (const f of modalCtx.fields) {
    const el = form.elements[f.key];
    if (f.type === 'file') { v[f.key] = modalCtx.files[f.key] || null; continue; }
    v[f.key] = f.type === 'checkbox' ? el.checked : el.value.trim();
    if (f.required && !v[f.key]) { el.focus(); el.style.borderColor = 'var(--red)'; toast(`الحقل «${f.label}» مطلوب`, 'err'); return; }
  }
  const err = modalCtx.validate?.(v);
  if (err) return toast(err, 'err');
  const cb = modalCtx.onSave;
  modalCtx.saved = true;
  closeModal();
  cb(v);
}
function confirmBox(msg, onYes, yesLabel = 'نعم، احذفي') {
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:420px">
    <div class="modal-b" style="padding:22px 20px 10px"><b>${esc(msg)}</b></div>
    <div class="modal-f"><button class="btn primary" style="background:var(--red);border-color:var(--red)" data-act="confirmYes">${yesLabel}</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = { onYes };
}

// ═════════════ الإشعارات ═════════════
function toast(msg, kind = '') {
  // في البرنامج المثبَّت يظهر إشعار التنزيل الخاص (مع زر فتح) بدلاً من هذا
  if (window.madrasaNative && /^حُفظ/.test(msg) && msg.includes('التنزيلات')) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = msg;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3500);
}

// ═════════════ الإدخال الصوتي ═════════════
let voiceTarget = null, browserRec = null;
function insertText(el, text) {
  if (!el || !text) return;
  if (el.isContentEditable) { el._insert ? el._insert(text) : document.execCommand('insertText', false, ' ' + text); return; }
  const v = el.value, start = el.selectionStart ?? v.length, end = el.selectionEnd ?? v.length;
  const before = v.slice(0, start), after = v.slice(end);
  const sep = before && !/\s$/.test(before) ? ' ' : '';
  el.value = before + sep + text + after;
  const pos = (before + sep + text).length;
  try { el.setSelectionRange(pos, pos); } catch { }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function stopBrowserVoice() { if (browserRec) { try { browserRec.stop(); } catch { } browserRec = null; } $$('.mic-btn.on').forEach((b) => b.classList.remove('on')); }
async function startVoice(btn) {
  const el = btn.dataset.target ? $(btn.dataset.target) : btn.parentElement.querySelector('.input');
  if (!el) return;
  if (btn.classList.contains('on')) { stopBrowserVoice(); return; }
  stopBrowserVoice();
  voiceTarget = el; if (!el.isContentEditable) el.focus();
  btn.classList.add('on');
  if (api.voiceStart) {
    await api.voiceStart(db.settings.voiceLang || 'ar-SA');
    toast('تحدّثي في نافذة الإملاء، وسيظهر النص هنا');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { btn.classList.remove('on'); return toast('المتصفح لا يدعم الإدخال الصوتي — استخدمي Edge أو Chrome', 'err'); }
  browserRec = new SR();
  browserRec.lang = db.settings.voiceLang || 'ar-SA'; browserRec.continuous = true; browserRec.interimResults = false;
  browserRec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) insertText(voiceTarget, e.results[i][0].transcript.trim()); };
  browserRec.onerror = (e) => { toast('خطأ في الإدخال الصوتي: ' + e.error, 'err'); stopBrowserVoice(); };
  browserRec.onend = () => stopBrowserVoice();
  browserRec.start();
}
api.onVoice((msg) => {
  if (msg.text && voiceTarget && document.body.contains(voiceTarget)) insertText(voiceTarget, msg.text);
  if (msg.done) { $$('.mic-btn.on').forEach((b) => b.classList.remove('on')); voiceTarget?.focus(); }
});

// ═════════════ الطباعة والتصدير ═════════════
function printDoc(title, bodyHtml) {
  const s = db.settings;
  $('#print').innerHTML = `<div class="ph"><div><h1>${esc(title)}</h1><div>${esc(s.schoolName)}</div></div><div style="text-align:left">${fmtG(todayISO())}<br>${fmtH(todayISO())}</div></div>${bodyHtml}
    <div class="sign"><div>الموظفة: ${esc(s.employeeName)}<br><br>التوقيع: ............</div><div>قائدة المدرسة:<br><br>التوقيع: ............</div></div>`;
  setTimeout(() => window.print(), 50);
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

// ═════════════ معالجات الأحداث ═════════════
const ACTIONS = {
  advToggle: (el, e) => { e.preventDefault(); ui.advOpen = !ui.advOpen; render(); },
  navShowAll: () => { db.settings.hidden = []; commit(); toast('أُظهرت كل الأقسام', 'ok'); },
  navToggle: (el) => { const k = el.dataset.id; if (navOpen.has(k)) navOpen.delete(k); else { NAV_TREE.forEach((g) => g.group && navOpen.delete(g.group)); navOpen.add(k); } renderNav(); },
  nav: (el) => { if (el.dataset.id !== 'visits') ui.visitSel = null; go(el.dataset.id); },
  openUrl: (el, e) => { e.preventDefault(); api.openUrl(el.dataset.id); },
  modalClose: closeModal,
  modalBack: (el, e) => { if (e.target === el) closeModal(); },
  modalSave: saveModal,
  confirmYes: () => { const f = modalCtx.onYes; closeModal(); f(); },
  mic: (el) => startVoice(el),

  taskNew: () => openTask(null),
  taskNewDate: (el) => openTask(null, { due: el.dataset.date }),
  taskEdit: (el) => openTask(db.tasks.find((t) => t.id === el.dataset.id)),
  taskDel: (el) => confirmBox('حذف هذه المهمة؟', () => { db.tasks = db.tasks.filter((t) => t.id !== el.dataset.id); commit(); }),
  taskToggle: (el) => { const t = db.tasks.find((x) => x.id === el.dataset.id); t.status = t.status === 'done' ? 'todo' : 'done'; t.doneAt = t.status === 'done' ? todayISO() : null; commit(); },
  taskFilter: (el) => { ui.taskFilter = el.dataset.id; render(); },

  calSel: (el) => { ui.calSel = el.dataset.id; render(); },
  calNav: (el) => { const [y, m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.id), 1); ui.calMonth = iso(d).slice(0, 7); render(); },
  calToday: () => { ui.calMonth = todayISO().slice(0, 7); ui.calSel = todayISO(); render(); },
  eventNew: (el) => openEvent(null, el.dataset.date),
  eventEdit: (el) => openEvent(db.events.find((x) => x.id === el.dataset.id)),
  eventDel: (el) => confirmBox('حذف هذا الموعد؟', () => { db.events = db.events.filter((x) => x.id !== el.dataset.id); commit(); }),

  teacherNew: () => openTeacher(null),
  teacherEdit: (el) => openTeacher(teacher(el.dataset.id)),
  teacherDel: (el) => {
    const used = db.absences.some((a) => a.teacherId === el.dataset.id) || db.classEntries.some((a) => a.teacherId === el.dataset.id);
    confirmBox(used ? 'لهذه المعلمة سجلات غياب أو متابعة ستظهر بدون اسم. حذفها؟' : 'حذف هذه المعلمة؟', () => { db.teachers = db.teachers.filter((t) => t.id !== el.dataset.id); commit(); });
  },
  teacherBulk: () => formModal({
    title: 'إضافة قائمة معلمات', wide: true,
    fields: [{ key: 'list', label: 'الصقي الأسماء — كل معلمة في سطر. يمكن إضافة البريد والتخصص مفصولة بفاصلة', type: 'textarea', full: true, rows: 12, hint: 'مثال: اسم المعلمة, teachername@gmail.com, التخصص' }],
    onSave: (v) => {
      let n = 0;
      v.list.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
        const parts = line.split(/[,،\t]/).map((x) => x.trim());
        const name = parts[0]; if (!name || db.teachers.some((t) => t.name === name)) return;
        const email = parts.find((p) => /@/.test(p)) || '';
        const subject = parts.slice(1).find((p) => p && !/@/.test(p) && !/^\d+$/.test(p)) || '';
        const phone = parts.slice(1).find((p) => /^0?5\d{8}$|^\+?\d{9,}$/.test(p)) || '';
        db.teachers.push({ id: uid(), name, email, subject, phone }); n++;
      });
      commit(); toast(`تمت إضافة ${n} معلمة`, 'ok');
    },
  }),

  absNew: () => openAbsence(null),
  absEdit: (el) => openAbsence(db.absences.find((a) => a.id === el.dataset.id)),
  absDel: (el) => confirmBox('حذف سجل الغياب؟', () => { db.absences = db.absences.filter((a) => a.id !== el.dataset.id); commit(); }),
  absFaris: (el) => { const a = db.absences.find((x) => x.id === el.dataset.id); a.faris = !a.faris; commit(); },
  absClear: () => { ui.absTeacher = ui.absType = ui.absMonth = ''; render(); },
  absCsv: () => {
    const rows = [['اسم المعلمة', 'من تاريخ', 'من (هجري)', 'إلى تاريخ', 'عدد الأيام', 'نوع الغياب', 'المدة', 'ملاحظات', 'أُدخل في فارس']];
    filteredAbsences().forEach((a) => rows.push([tName(a.teacherId), a.date, fmtH(a.date), a.dateTo || a.date, workDays(a.date, a.dateTo), a.type, a.duration || '', a.notes || '', a.faris ? 'نعم' : 'لا']));
    api.saveCsv(`سجل-الغياب-${todayISO()}.csv`, toCsv(rows)).then((ok) => ok && toast('تم التصدير', 'ok'));
  },
  absPrint: () => {
    const list = filteredAbsences();
    printDoc('سجل غياب وإجازات المعلمات', `<table><thead><tr><th>م</th><th>اسم المعلمة</th><th>من</th><th>إلى</th><th>الأيام</th><th>النوع</th><th>ملاحظات</th></tr></thead><tbody>${list.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(tName(a.teacherId))}</td><td>${fmtG(a.date)}<br>${fmtH(a.date)}</td><td>${a.dateTo ? fmtG(a.dateTo) : '—'}</td><td>${/تأخر|خروج/.test(a.type) ? esc(a.duration || '—') : workDays(a.date, a.dateTo)}</td><td>${esc(a.type)}</td><td>${esc(a.notes)}</td></tr>`).join('')}</tbody></table>`);
  },

  entryDay: (el) => { ui.entryDate = addDays(ui.entryDate, Number(el.dataset.id)); render(); },
  entryAdd: () => {
    const f = $('#entryForm');
    const g = (n) => f.querySelector(`[name=${n}]`).value.trim();
    if (!g('teacherId')) return toast('اختاري المعلمة', 'err');
    const e = { id: uid(), date: ui.entryDate, period: Number(g('period')), teacherId: g('teacherId'), className: g('className'), status: g('status'), time: g('time'), notes: g('notes'), emailed: false };
    db.classEntries.push(e); ui.lastPeriod = e.period;
    commit();
    if (e.status === 'early') toast('حضرت مبكراً ✓ — يمكنكِ إرسال رسالة شكر من الجدول');
  },
  entryDel: (el) => { db.classEntries = db.classEntries.filter((e) => e.id !== el.dataset.id); commit(); },
  entryMail: (el) => { const e = db.classEntries.find((x) => x.id === el.dataset.id); openThanks(e.date, [e.teacherId]); },
  entryMailAll: () => openThanks(ui.entryDate),
  thFocus: (el, e) => { if (e.target.closest('input')) return; TH.focus = el.dataset.id; renderThanks(); },
  thAll: () => { TH.groups.forEach((g) => teacher(g.teacherId)?.email && TH.sel.add(g.teacherId)); renderThanks(); },
  thNone: () => { TH.sel.clear(); renderThanks(); },
  thRevert: (el) => { delete TH.edits[el.dataset.id]; renderThanks(); },
  thChannel: (el) => {
    TH.channel = el.dataset.id; db.settings.thanksChannel = TH.channel; commit(false);
    TH.sel = new Set(TH.groups.filter((g) => (TH.only ? TH.only.includes(g.teacherId) : !thSent(g)) && thContact(g.teacherId)).map((g) => g.teacherId));
    renderThanks();
  },
  thAddEmail: (el) => {
    const v = $('#thEmail').value.trim();
    if (TH.channel === 'wa') {
      if (!waNumber(v)) return toast('رقم الجوال غير صحيح', 'err');
      teacher(el.dataset.id).phone = v; TH.sel.add(el.dataset.id); commit(false); renderThanks(); return toast('حُفظ الجوال في بيانات المعلمة ✓', 'ok');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('البريد غير صحيح', 'err');
    teacher(el.dataset.id).email = v; TH.sel.add(el.dataset.id); commit(false); renderThanks(); toast('حُفظ البريد في بيانات المعلمة ✓', 'ok');
  },
  thStart: () => { $$('.th-modal [data-change]').forEach((x) => x === document.activeElement && x.blur()); TH.queue = TH.groups.filter((g) => TH.sel.has(g.teacherId)); TH.qi = 0; renderThanks(); },
  thOpen: () => thOpenCurrent(),
  thSkip: () => { TH.qi++; renderThanks(); },
  thBack: () => { TH.queue = null; renderThanks(); },
  entryCsv: () => {
    const rows = [['التاريخ', 'اليوم', 'الحصة', 'المعلمة', 'الفصل', 'الحالة', 'وقت الدخول', 'ملاحظة', 'أُرسل شكر']];
    db.classEntries.filter((e) => e.date.slice(0, 7) === ui.entryDate.slice(0, 7)).sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)
      .forEach((e) => rows.push([e.date, dayName(e.date), e.period, tName(e.teacherId), e.className, ENTRY_STATUS[e.status].label, e.time, e.notes, e.emailed ? 'نعم' : '']));
    api.saveCsv(`متابعة-دخول-الحصص-${ui.entryDate.slice(0, 7)}.csv`, toCsv(rows)).then((ok) => ok && toast('تم تصدير شهر كامل', 'ok'));
  },
  entryPrint: () => {
    const d = ui.entryDate;
    const list = db.classEntries.filter((e) => e.date === d).sort((a, b) => a.period - b.period);
    const blank = Array.from({ length: Math.max(0, 14 - list.length) }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    printDoc(`استمارة متابعة دخول المعلمات للحصص — ${dayName(d)} ${fmtG(d)}`, `<table><thead><tr><th>الحصة</th><th>اسم المعلمة</th><th>الفصل</th><th>وقت الدخول</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${list.map((e) => `<tr><td>${e.period}</td><td>${esc(tName(e.teacherId))}</td><td>${esc(e.className)}</td><td>${esc(e.time)}</td><td>${ENTRY_STATUS[e.status].label}</td><td>${esc(e.notes)}</td></tr>`).join('')}${blank}</tbody></table>`);
  },

  breakNew: () => openBreak(null),
  breakEdit: (el) => openBreak(db.breakNotes.find((b) => b.id === el.dataset.id)),
  breakDel: (el) => confirmBox('حذف هذه الملاحظة؟', () => { db.breakNotes = db.breakNotes.filter((b) => b.id !== el.dataset.id); commit(); }),
  breakFilter: (el) => { ui.breakFilter = el.dataset.id; render(); },
  breakPrint: () => {
    const list = db.breakNotes.filter((b) => !ui.breakFilter || b.category === ui.breakFilter).sort((a, b) => b.date.localeCompare(a.date));
    printDoc('سجل الإشراف على الطالبات وقت الفسحة', `<table><thead><tr><th>التاريخ</th><th>الوقت</th><th>الموقع</th><th>النوع</th><th>الطالبة</th><th>الملاحظة</th><th>الإجراء</th></tr></thead><tbody>${list.map((b) => `<tr><td>${dayName(b.date)} ${fmtGShort(b.date)}</td><td>${esc(b.time)}</td><td>${esc(b.location)}</td><td>${BREAK_CATS[b.category] || ''}</td><td>${esc(b.student)}</td><td>${esc(b.notes)}</td><td>${esc(b.action)}</td></tr>`).join('')}</tbody></table>`);
  },

  occFilter: (el) => { ui.occFilter = el.dataset.id; render(); },
  occNew: () => openOcc(null),
  occEdit: (el) => openOcc(db.occasions.find((o) => o.id === el.dataset.id)),
  occDel: (el) => confirmBox('حذف هذه المناسبة نهائياً؟', () => { db.occasions = db.occasions.filter((o) => o.id !== el.dataset.id); commit(); }),
  occDone: (el) => { const o = db.occasions.find((x) => x.id === el.dataset.id); o.status = 'done'; o.year = parse(occNextDate(o)).getFullYear(); commit(); toast('أحسنتِ! تم تسجيل تنفيذ المناسبة 🎉', 'ok'); },
  occTask: (el) => {
    const o = db.occasions.find((x) => x.id === el.dataset.id);
    const d = occNextDate(o);
    const due = addDays(d, -7) < todayISO() ? todayISO() : addDays(d, -7);
    openTask(null, { title: `التحضير لـ${o.name}${o.initiative ? ': ' + o.initiative : ''}`, due, category: 'المناسبات', priority: 'med' });
    if (occStatus(o) === 'todo') { o.status = 'prep'; o.year = parse(d).getFullYear(); api.save(db); }
  },

  visitNew: () => openVisit(null),
  visitOpen: (el) => { ui.visitSel = el.dataset.id; ui.view = 'visits'; render(); },
  visitBack: () => { ui.visitSel = null; render(); },
  visitEdit: (el) => openVisit(db.visits.find((v) => v.id === el.dataset.id)),
  visitDel: (el) => confirmBox('حذف هذه الزيارة؟', () => { db.visits = db.visits.filter((v) => v.id !== el.dataset.id); ui.visitSel = null; commit(); }),
  visitCheck: (el) => { const v = db.visits.find((x) => x.id === el.dataset.id); const c = v.checklist[Number(el.dataset.i)]; c.done = !c.done; if (v.status === 'planned' && v.checklist.every((x) => x.done)) v.status = 'ready'; commit(); },
  visitCheckDel: (el) => { const v = db.visits.find((x) => x.id === el.dataset.id); v.checklist.splice(Number(el.dataset.i), 1); commit(); },
  visitCheckAdd: (el) => { const inp = $('#newCheck'); if (!inp.value.trim()) return; db.visits.find((x) => x.id === el.dataset.id).checklist.push({ text: inp.value.trim(), done: false }); commit(); },
  visitPrint: (el) => {
    const v = db.visits.find((x) => x.id === el.dataset.id);
    printDoc(`تقرير زيارة — ${v.team}`, `<table><tbody>
      <tr><th style="width:150px">التاريخ</th><td>${dayName(v.date)} ${fmtG(v.date)} — ${fmtH(v.date)} ${v.time ? '— ' + esc(v.time) : ''}</td></tr>
      <tr><th>أعضاء الفريق</th><td style="white-space:pre-wrap">${esc(v.members)}</td></tr>
      <tr><th>هدف الزيارة</th><td style="white-space:pre-wrap">${esc(v.purpose)}</td></tr>
      <tr><th>المرافقة</th><td>${esc(v.escort)}</td></tr>
      <tr><th>خطة الاستقبال</th><td style="white-space:pre-wrap">${esc(v.reception)}</td></tr>
      <tr><th>التجهيزات</th><td>${v.checklist.map((c) => `${c.done ? '☑' : '☐'} ${esc(c.text)}`).join('<br>')}</td></tr>
      <tr><th>الملاحظات والتوصيات</th><td style="white-space:pre-wrap;height:120px;vertical-align:top">${esc(v.notes)}</td></tr>
    </tbody></table>`);
  },

  mailTest: async () => {
    const s = db.settings;
    if (!s.gmailUser || !s.gmailPass) return toast('أدخلي بريد Gmail وكلمة مرور التطبيقات أولاً', 'err');
    toast('جارٍ الاختبار…');
    const r = await api.testMail(s);
    r.ok ? toast('الاتصال بـ Gmail ناجح ✓', 'ok') : toast('فشل الاتصال: ' + r.error, 'err');
  },
  backupExport: async () => { db.settings.lastBackup = todayISO(); await api.save(db); const ok = await api.exportData(db); if (ok) toast('تم حفظ النسخة الاحتياطية', 'ok'); render(); },
  backupImport: async () => {
    const d = await api.importData();
    if (!d || !d.settings || !Array.isArray(d.teachers)) { if (d) toast('الملف غير صالح', 'err'); return; }
    confirmBox('ستُستبدل جميع البيانات الحالية بالنسخة المختارة. متابعة؟', () => { db = migrate(d); commit(); toast('تمت الاستعادة', 'ok'); }, 'نعم، استعيديها');
  },
  openDataFolder: () => api.openDataFolder(),

  syncChoose: () => Sync.choose(),
  syncCloud: (el) => Sync.choose(el.dataset.id),
  syncRecheck: async () => { await IDB.del('kv', 'syncAutoOff').catch(() => { }); await Sync.init(); render(); toast(Sync.status === 'on' ? 'المزامنة تعمل ✓' : 'ما زال الحساب غير مطابق', Sync.status === 'on' ? 'ok' : ''); },
  syncResume: () => Sync.resume(),
  syncNow: async () => { await Sync.check(); toast(Sync.conflict ? 'توجد بيانات أحدث من جهاز آخر' : 'تمت المزامنة ✓', Sync.conflict ? '' : 'ok'); render(); },
  syncStop: () => confirmBox('إيقاف المزامنة على هذا الجهاز؟ تبقى البيانات محفوظة هنا وفي السحابة، ولن تُفعَّل تلقائياً مرة أخرى حتى تفعّليها من الإعدادات.', () => Sync.stop(), 'نعم، أوقفيها'),
  syncUseRemote: () => Sync.load(Sync.conflict),
  syncUseLocal: async () => { await Sync.setBase(Sync.conflict.meta?.updatedAt || 0); Sync.conflict = null; db.meta = { ...(db.meta || {}), updatedAt: Date.now(), device: deviceId() }; await api.save(db); await Sync.push(true); toast('تم حفظ بيانات هذا الجهاز في المجلد', 'ok'); render(); },
  libNew: (el) => openLib(null, el.dataset.id),
  libEdit: (el) => openLib(db.library.find((x) => x.id === el.dataset.id)),
  libView: (el) => viewLib(db.library.find((x) => x.id === el.dataset.id)),
  libDel: (el) => confirmBox('حذف هذا العنصر وملفه المرفق من المكتبة؟', () => { const x = db.library.find((i) => i.id === el.dataset.id); if (x?.file) api.libDelete(x.file); db.library = db.library.filter((i) => i.id !== el.dataset.id); commit(); }),
  libOpen: async (el) => { const x = db.library.find((i) => i.id === el.dataset.id); if (!x?.file) return; const r = await api.libOpen(x.file); if (r) toast('تعذّر فتح الملف: ' + r, 'err'); },
  libSave: (el) => { const x = db.library.find((i) => i.id === el.dataset.id); if (x?.file) api.libSaveAs(x.file).then((ok) => ok && toast('تم حفظ النسخة', 'ok')); },
  libKind: (el) => { ui.libKind = el.dataset.id; render(); },
  pickFile: async (el) => { const box = el.closest('.file-pick'); setModalFile(box, await api.libPick()); },
  clearFile: (el) => { const box = el.closest('.file-pick'); const k = box.dataset.fkey; const old = modalCtx.files[k]; if (old && old !== modalCtx.original[k]) api.libDelete(old); modalCtx.files[k] = null; box.innerHTML = filePickInner(null); },
};

const CHANGES = {
  syncEmail: async (el) => {
    const v = el.value.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('الإيميل غير صحيح', 'err');
    db.settings.syncEmail = v; commit(false);
    if (NSync) { await Sync.init(); render(); toast(v ? `المزامنة مقصورة على ${v}` : 'المزامنة مع أي حساب', 'ok'); }
  },
  ...TH_CHANGES,
  navShow: (el) => { const h = new Set(db.settings.hidden || []); el.checked ? h.delete(el.dataset.id) : h.add(el.dataset.id); db.settings.hidden = [...h]; commit(); toast(el.checked ? 'أُظهر القسم في القائمة' : 'أُخفي القسم من القائمة', 'ok'); },
  libCat: (el) => { ui.libCat = el.value; render(); },
  taskCat: (el) => { ui.taskCat = el.value; render(); },
  absTeacher: (el) => { ui.absTeacher = el.value; render(); },
  absType: (el) => { ui.absType = el.value; render(); },
  absMonth: (el) => { ui.absMonth = el.value; render(); },
  entryDate: (el) => { if (el.value) { ui.entryDate = el.value; render(); } },
  entryStatus: (el) => { const e = db.classEntries.find((x) => x.id === el.dataset.id); e.status = el.value; commit(); },
  supDay: (el) => { db.settings.supervisionDay = Number(el.value); commit(); },
  setting: (el) => { const k = el.dataset.id; db.settings[k] = k === 'periods' ? Math.max(1, Math.min(10, Number(el.value) || 7)) : el.value; commit(k === 'schoolName' || k === 'employeeName' || k === 'periods' || k === 'voiceLang'); },
  settingBool: (el) => { db.settings[el.dataset.id] = el.checked; commit(false); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'libSearch') { ui.libQuery = e.target.value; filterLib(); }
});
// السحب والإفلات لملفات المكتبة
document.addEventListener('dragover', (e) => { e.preventDefault(); const box = e.target.closest?.('.file-pick.drop'); $$('.file-pick.over').forEach((b) => b !== box && b.classList.remove('over')); box?.classList.add('over'); });
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const box = e.target.closest?.('.file-pick.drop');
  if (!box) return;
  box.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) setModalFile(box, await api.libDrop(f));
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalCtx) closeModal();
  if (e.key === 'Enter' && modalCtx?.fields && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); saveModal(); }
  if (e.key === 'Enter' && e.target.id === 'newCheck') $('[data-act=visitCheckAdd]')?.click();
  if (e.key === 'Enter' && e.target.closest('#entryForm') && e.target.tagName === 'INPUT') ACTIONS.entryAdd();
});

// ═════════════ التشغيل ═════════════
function migrate(d) {
  const base = freshDb();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  for (const k of ['teachers', 'tasks', 'events', 'absences', 'classEntries', 'breakNotes', 'visits', 'occasions', 'library', 'timetable']) if (!Array.isArray(out[k])) out[k] = base[k];
  if (out.settings.voiceLang === 'ar-EG') out.settings.voiceLang = 'ar-SA';
  out.flags = out.flags || {};
  if (!out.flags.islamicOcc) {
    out.flags.islamicOcc = true;
    [['رأس السنة الهجرية', 1, 1], ['بداية شهر رمضان', 9, 1], ['عيد الفطر', 10, 1], ['يوم عرفة', 12, 9], ['عيد الأضحى', 12, 10]].forEach(([name, month, day]) => {
      if (!out.occasions.some((o) => o.name === name)) out.occasions.push({ id: uid(), name, month, day, cal: 'h', type: 'islamic', initiative: '', responsible: '', status: 'todo', notes: '', year: null });
    });
  }
  return out;
}
function startupNotify() {
  const t = todayISO();
  if (!db.settings.notify) return;
  const due = db.tasks.filter((x) => x.status !== 'done' && x.due && x.due <= t).length;
  const isSup = parse(t).getDay() === Number(db.settings.supervisionDay) && !isWeekend(t);
  const msgs = [];
  if (isSup) msgs.push('اليوم يوم إشرافكِ على الفسحة');
  if (due) msgs.push(`لديكِ ${due} مهمة مستحقة`);
  const occ = db.occasions.find((o) => occNextDate(o) === t);
  if (occ) msgs.push(`اليوم: ${occ.name}`);
  const lb = db.settings.lastBackup;
  if (!api.isDesktop && (db.teachers.length || db.absences.length) && (!lb || diffDays(lb, t) >= 7)) setTimeout(() => toast('💾 مرّ أسبوع على آخر نسخة احتياطية — احفظي نسخة من الإعدادات'), 1500);
  if (!msgs.length) return;
  try { if ('Notification' in window && Notification.permission !== 'denied') new Notification('المساعد الإداري', { body: msgs.join(' • ') }); } catch { }
}
(async function init() {
  // ننتظر تحميل كل ملفات البرنامج (الأدوات والإضافات) قبل البدء
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  const d = await api.load();
  // نسخة احتياطية تلقائية قبل ترقية بنية البيانات (لا يُحذف أي شيء، وتمكن استعادتها من الإعدادات)
  if (d && (d.version || 1) < 2) {
    try { await IDB.put('kv', 'backup-before-v2', { date: new Date().toISOString(), data: JSON.parse(JSON.stringify(d)) }); d.flags = { ...(d.flags || {}), preUpgradeBackup: 'backup-before-v2' }; } catch (e) { console.warn('pre-upgrade backup failed', e); }
    d.version = 2;
  }
  db = migrate(d || freshDb());
  if (!d) api.save(db);
  for (const f of HOOKS.beforeStart || []) await f();
  render();
  await Sync.init();
  startupNotify();
  // فحص التحديثات من الجهاز الآخر: عند العودة للنافذة وكل دقيقتين
  window.addEventListener('focus', () => Sync.check());
  setInterval(() => Sync.check(), 120000);
  // تحديث تلقائي عند تغيّر اليوم (إذا بقي التطبيق مفتوحاً)
  let lastDay = todayISO();
  setInterval(() => { if (todayISO() !== lastDay) { lastDay = todayISO(); render(); } }, 60000);
})();

// ═════════════ البرنامج المثبَّت: إشعار اكتمال التنزيل مع زر فتح الملف ═════════════
if (window.madrasaNative) {
  window.madrasaNative.onDownloadDone(({ name, path }) => {
    const el = document.createElement('div'); el.className = 'toast ok';
    el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '10px';
    el.innerHTML = `<span>⬇ حُفظ «${esc(name)}» في التنزيلات</span>`;
    const open = document.createElement('button'); open.className = 'btn sm'; open.textContent = 'فتح';
    open.onclick = () => { window.madrasaNative.openPath(path); el.remove(); };
    const show = document.createElement('button'); show.className = 'btn sm'; show.textContent = 'إظهار في المجلد';
    show.onclick = () => { window.madrasaNative.showInFolder(path); el.remove(); };
    el.append(open, show); $('#toasts').appendChild(el); setTimeout(() => el.remove(), 9000);
  });
}
