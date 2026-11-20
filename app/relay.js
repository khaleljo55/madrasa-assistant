// ═════════════ 🔐 المزامنة المشفّرة بين الكمبيوتر والجوال (1.1.0) ═════════════
// خادم صغير على Cloudflare يحفظ نسخة مشفّرة من البيانات. التشفير AES-256-GCM يتم في الجهاز،
// والمفتاح لا يغادر الأجهزة المرتبطة (يُنقل بينها داخل «رمز الربط» فقط). لا حسابات ولا كلمات مرور.
// الملفات في الخادم: head (وقت آخر تعديل) و data.json (البيانات كاملة) و library/* (المرفقات).
const RELAY = { cfg: null, key: null, id: '', tok: '', last: 0, timer: null, off: false };
const RL_MAGIC = [77, 65, 49]; // MA1
const RL_PART = 20 * 1024 * 1024;
const rlB64u = (u8) => { let s = ''; u8.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const rlUnb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const rlHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rlSha = (s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
const RL_URL = /^(https:\/\/[^\s/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/; // http للاختبار المحلي فقط
const rlCanGz = typeof CompressionStream === 'function';
const rlGz = async (u8, mode) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(mode === 'd' ? new DecompressionStream('gzip') : new CompressionStream('gzip'))).arrayBuffer());

// رمز الربط: MA1-<base64url(JSON {u: رابط الخادم, k: المفتاح})>
function rlCode(cfg = RELAY.cfg) { return 'MA1-' + rlB64u(new TextEncoder().encode(JSON.stringify({ u: cfg.url, k: cfg.k }))); }
function rlParse(code) {
  const m = String(code || '').replace(/\s+/g, '').match(/MA1-([A-Za-z0-9_-]{40,})/);
  if (!m) return null;
  try { const o = JSON.parse(new TextDecoder().decode(rlUnb64u(m[1]))); const u = String(o.u).replace(/\/+$/, ''); return RL_URL.test(u) && rlUnb64u(o.k).length === 32 ? { url: u, k: o.k } : null; } catch { return null; }
}
async function rlActivate(cfg) {
  // الانتقال إلى عنوان الخادم الجديد تلقائياً (brand.js)، مع حفظه حتى لا يُعاد الفحص في كل مرة
  if (typeof rlBestUrl === 'function') { const best = await rlBestUrl(cfg.url); if (best && best !== cfg.url) { cfg = { ...cfg, url: best }; IDB.get('kv', 'relayCfg').then((c) => { if (c && c.k === cfg.k) IDB.put('kv', 'relayCfg', cfg); }).catch(() => { }); } }
  RELAY.cfg = cfg;
  RELAY.key = await crypto.subtle.importKey('raw', rlUnb64u(cfg.k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  RELAY.id = rlHex(await rlSha('madrasa-id:' + cfg.k)).slice(0, 32);
  RELAY.tok = rlB64u(new Uint8Array(await rlSha('madrasa-token:' + cfg.k)));
}
async function rlEnc(u8, gz) {
  if (gz && rlCanGz) u8 = await rlGz(u8); else gz = false;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, RELAY.key, u8));
  const out = new Uint8Array(4 + 12 + c.length);
  out.set(RL_MAGIC); out[3] = gz ? 1 : 0; out.set(iv, 4); out.set(c, 16);
  return out;
}
async function rlDec(u8) {
  if (u8[0] !== RL_MAGIC[0] || u8[1] !== RL_MAGIC[1] || u8[2] !== RL_MAGIC[2]) throw new Error('ملف غير معروف في الخادم');
  let p;
  try { p = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(4, 16) }, RELAY.key, u8.slice(16))); }
  catch { throw new Error('تعذّر فك التشفير — رمز الربط لا يطابق'); }
  return u8[3] === 1 ? rlGz(p, 'd') : p;
}
async function rlFetch(path, opt = {}) {
  let r;
  try { r = await fetch(`${RELAY.cfg.url}/v1/${RELAY.id}/${path}`, { ...opt, cache: 'no-store', headers: { Authorization: 'Bearer ' + RELAY.tok, ...(opt.headers || {}) } }); }
  catch { throw new Error(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الوصول إلى خادم المزامنة'); }
  if (r.status === 403) { let e = ''; try { e = (await r.json()).error; } catch { } throw new Error(e === 'channels_full' ? 'الخادم لا يقبل أجهزة جديدة (اكتمل العدد)' : 'رمز الربط مرفوض من الخادم'); }
  return r;
}
const rlObj = (name) => 'o/' + name.split('/').map(encodeURIComponent).join('/');
async function rlGet(name) {
  const r = await rlFetch(rlObj(name));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('خادم المزامنة ' + r.status);
  const u8 = new Uint8Array(await r.arrayBuffer());
  const t = new TextDecoder().decode(u8.slice(0, 6));
  if (t === 'PARTS:') { // ملف كبير مقسّم
    const n = Number(new TextDecoder().decode(u8.slice(6)));
    const parts = [];
    for (let i = 0; i < n; i++) { const p = await rlFetch(rlObj(`${name}.part${i}`)); if (!p.ok) throw new Error('جزء مفقود من الملف'); parts.push(new Uint8Array(await p.arrayBuffer())); }
    const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
    return rlDec(all);
  }
  return rlDec(u8);
}
async function rlPutRaw(name, body) {
  const r = await rlFetch(rlObj(name), { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } });
  if (!r.ok) { let e = ''; try { e = (await r.json()).error; } catch { } throw new Error(e === 'too_large' ? 'الملف أكبر من المسموح' : 'خادم المزامنة ' + r.status); }
}
async function rlPut(name, u8, gz) {
  const enc = await rlEnc(u8, gz);
  if (enc.length <= RL_PART) return rlPutRaw(name, enc);
  const n = Math.ceil(enc.length / RL_PART);
  for (let i = 0; i < n; i++) await rlPutRaw(`${name}.part${i}`, enc.slice(i * RL_PART, (i + 1) * RL_PART));
  return rlPutRaw(name, new TextEncoder().encode('PARTS:' + n));
}
const rlJSON = async (name) => { const u8 = await rlGet(name); return u8 ? JSON.parse(new TextDecoder().decode(u8)) : null; };
SyncFS.relay = {
  readText: async (n) => { const u8 = await rlGet(n); return u8 ? new TextDecoder().decode(u8) : null; },
  writeText: (n, t) => rlPut(n, new TextEncoder().encode(t), true),
  list: async (sub) => {
    const r = await rlFetch(`list?prefix=${encodeURIComponent(sub + '/')}`);
    if (!r.ok) throw new Error('خادم المزامنة ' + r.status);
    return (await r.json()).names.map((n) => n.slice(sub.length + 1)).filter((n) => !/\.part\d+$/.test(n));
  },
  readBlob: async (sub, n) => { const u8 = await rlGet(`${sub}/${n}`); return u8 ? new Blob([u8]) : null; },
  writeBlob: async (sub, n, blob) => rlPut(`${sub}/${n}`, new Uint8Array(await blob.arrayBuffer()), false),
};

// ───── ربطها بنظام المزامنة القائم ─────
const RL_BASE = {
  supported: Sync.supported, init: Sync.init, readRemote: Sync.readRemote, push: Sync.push, load: Sync.load, check: Sync.check, stop: Sync.stop,
  fs: Object.getOwnPropertyDescriptor(Sync, 'fs').get, label: Object.getOwnPropertyDescriptor(Sync, 'label').get,
};
const rlOn = () => !!RELAY.cfg;
const IS_WEBAPP = !window.madrasaNative;
Sync.supported = () => true;
Object.defineProperty(Sync, 'fs', { get() { return rlOn() ? SyncFS.relay : RL_BASE.fs.call(this); }, configurable: true });
Object.defineProperty(Sync, 'label', { get() { return rlOn() ? 'المزامنة المشفّرة' : RL_BASE.label.call(this); }, configurable: true });
// قراءة خفيفة: «head» فقط لمعرفة هل توجد بيانات أحدث، ثم البيانات كاملة عند الحاجة.
// أي خطأ شبكة يُرفع ولا يُعامل كـ«لا توجد بيانات» حتى لا تُكتب بيانات فارغة فوق بيانات الجهاز الآخر.
Sync.readRemote = async function (full) {
  if (!rlOn()) return RL_BASE.readRemote.call(this);
  const h = await rlJSON('head');
  if (!h) return null;
  if (!full && (h.updatedAt || 0) <= this.base) return { meta: { updatedAt: h.updatedAt, device: h.device }, _stub: true };
  const d = await rlJSON('data.json');
  if (!d) throw new Error('البيانات غير مكتملة في الخادم بعد');
  if ((d.meta?.updatedAt || 0) < (h.updatedAt || 0)) throw new Error('البيانات لم تكتمل في الخادم بعد'); // تأخر بسيط في التخزين المؤقت
  return d;
};
Sync.load = async function (remote, quiet) {
  if (remote?._stub) throw new Error('stub');
  return RL_BASE.load.call(this, remote, quiet);
};
// رفع البيانات: بعد 15 ثانية من آخر تعديل (يجمع التعديلات المتتالية في رفعة واحدة)
Sync.push = async function (force) {
  if (!rlOn()) return RL_BASE.push.call(this, force);
  if (force) return rlPushNow.call(this, true);
  clearTimeout(RELAY.timer);
  RELAY.timer = setTimeout(() => rlPushNow.call(Sync, false), Math.max(0, 15000 - (Date.now() - RELAY.last)));
};
async function rlPushNow(force) {
  clearTimeout(RELAY.timer); RELAY.timer = null;
  if (this.status !== 'on' || this.busy) return;
  this.busy = true;
  try {
    if (!force) {
      const remote = await this.readRemote();
      if (remote && (remote.meta?.updatedAt || 0) > this.base) { this.busy = false; return this.setConflict(remote._stub ? await this.readRemote(true) : remote); }
    }
    await SyncFS.relay.writeText('data.json', JSON.stringify(db));
    await SyncFS.relay.writeText('head', JSON.stringify({ updatedAt: db.meta?.updatedAt || 0, device: deviceId() }));
    await this.setBase(db.meta?.updatedAt || 0);
    RELAY.last = Date.now();
    await this.pushAttachments();
    this.lastOk = new Date(); this.error = '';
  } catch (e) { this.status = 'error'; this.error = e.message; renderSyncBar(); }
  this.busy = false;
}
const rlFlush = () => { if (RELAY.timer && Sync.status === 'on') rlPushNow.call(Sync, false); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') rlFlush(); else Sync.check(); });
window.addEventListener('online', () => Sync.check());
Sync.check = async function () {
  if (rlOn() && this.status === 'error' && navigator.onLine !== false) { this.status = 'on'; this.error = ''; }
  return RL_BASE.check.call(this);
};
// الانضمام إلى مزامنة موجودة (جهاز جديد): البيانات الأحدث تُحمَّل، وعند الشك تُسأل المستخدمة
async function rlJoin(cfg, how) {
  await rlActivate(cfg);
  const remote = await Sync.readRemote(true);
  await IDB.put('kv', 'relayCfg', cfg); await IDB.del('kv', 'relayOff').catch(() => { });
  if (window.madrasaNative?.sync && Sync.cfg) await window.madrasaNative.sync.clear().catch(() => { });
  Sync.cfg = null; Sync.dir = null; Sync.status = 'on'; Sync.known = null; Sync.mismatch = null; Sync.error = '';
  const local = db.meta?.updatedAt || 0;
  if (!remote) { await Sync.setBase(0); await rlPushNow.call(Sync, true); }
  else if (!Sync.hasLocalData()) await Sync.load(remote, true);
  else if (how === 'auto' && (remote.meta?.updatedAt || 0) >= local && local <= Sync.base) await Sync.load(remote, true);
  else { await Sync.setBase(Math.min(Sync.base, local - 1)); Sync.setConflict(remote); }
  render();
}
Sync.init = async function () {
  const cfg = await IDB.get('kv', 'relayCfg').catch(() => null);
  this.appCfg = this.appCfg || {};
  if (window.madrasaNative && !this.appCfg.syncRelay) { try { this.appCfg = (await window.madrasaNative.appConfig?.()) || {}; } catch { } }
  if (cfg) {
    try {
      this.base = (await IDB.get('kv', 'syncBase')) || 0;
      await rlActivate(cfg);
      this.status = 'on'; this.cfg = null; this.dir = null; this.mismatch = null;
      await this.reconcile();
    } catch (e) { this.status = 'error'; this.error = e.message; }
    renderSyncBar(); return;
  }
  RELAY.cfg = null;
  if (IS_WEBAPP) { this.status = 'off'; renderSyncBar(); return; }
  await RL_BASE.init.call(this);
  // كمبيوتر آخر على OneDrive نفسه: ينضم تلقائياً إلى المزامنة المشفّرة إذا فُعّلت من جهاز سابق
  if (this.status === 'on' && this.cfg && !(await IDB.get('kv', 'relayOff').catch(() => null))) {
    try { const t = await SyncFS.native.readText('relay.json'); const c = t && rlParse(JSON.parse(t).code); if (c) { await rlJoin(c, 'auto'); toast('🔐 انتقلت المزامنة إلى الطريقة المشفّرة الجديدة تلقائياً', 'ok'); } } catch { }
  }
};
Sync.stop = async function () {
  if (!rlOn()) return RL_BASE.stop.call(this);
  RELAY.cfg = null; this.status = 'off'; this.conflict = null;
  await IDB.del('kv', 'relayCfg').catch(() => { }); await IDB.put('kv', 'relayOff', true).catch(() => { });
  render();
};

// ───── الواجهة ─────
const _rlBar = renderSyncBar;
renderSyncBar = function () {
  const el = $('#syncBar'); if (!el) return;
  if (!rlOn() || Sync.conflict) return _rlBar();
  if (Sync.status === 'error') el.innerHTML = `<div class="banner" style="margin:0 28px 10px;padding:10px 16px"><span>⚠️</span><div><b>تعذّرت المزامنة</b><div class="muted">${esc(Sync.error || '')}. تعديلاتكِ محفوظة في هذا الجهاز وتُرفع عند عودة الاتصال.</div></div><span class="spacer"></span><button class="btn sm primary" data-act="syncNow">إعادة المحاولة</button></div>`;
  else el.innerHTML = '';
};
function relayCard() {
  const last = Sync.lastOk ? ' · آخر مزامنة: ' + Sync.lastOk.toLocaleTimeString('ar-SA-u-nu-latn', { timeStyle: 'short' }) : '';
  if (rlOn()) return `<div class="card" style="grid-column:1/-1"><h3>🔐 المزامنة المشفّرة (الكمبيوتر والجوال)</h3>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="chip ${Sync.status === 'on' ? 'green' : 'red'}">${Sync.status === 'on' ? 'تعمل تلقائياً ✓' : 'متوقفة مؤقتاً'}</span><span class="muted">${last}</span></div>
    <div class="muted" style="margin-top:8px">البيانات تُشفَّر في هذا الجهاز قبل رفعها، ولا يستطيع أحد قراءتها إلا الأجهزة المرتبطة.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm" data-act="syncNow">🔄 مزامنة الآن</button><button class="btn sm primary" data-act="rlShowCode">📲 ربط جهاز جديد</button><button class="btn sm danger" data-act="rlUnlink">فصل هذا الجهاز</button></div></div>`;
  const url = Sync.appCfg?.syncRelay || '';
  return `<div class="card" style="grid-column:1/-1"><h3>🔐 المزامنة المشفّرة (الكمبيوتر والجوال)</h3>
    <div class="muted" style="margin-bottom:10px">${IS_WEBAPP ? 'لربط الجوال ببرنامج الكمبيوتر: في الكمبيوتر افتحي الإعدادات ← المزامنة ← «ربط جهاز جديد»، ثم انسخي الرمز هنا.' : 'تربط هذا الكمبيوتر بالجوال وبأي كمبيوتر آخر دون حسابات أو كلمات مرور، والبيانات مشفّرة لا يقرؤها أحد غيركِ.'}</div>
    ${IS_WEBAPP ? '' : url ? `<button class="btn primary" data-act="rlCreate">🔐 تفعيل المزامنة المشفّرة</button>` : `<div class="field" style="max-width:520px"><label>رابط خادم المزامنة</label><input class="input" dir="ltr" id="rlUrl" placeholder="https://madrasa-sync.xxxx.workers.dev"></div><button class="btn primary" data-act="rlCreate">🔐 تفعيل المزامنة المشفّرة</button>`}
    <div class="field" style="margin-top:${IS_WEBAPP ? 0 : 14}px;max-width:520px"><label>${IS_WEBAPP ? 'رمز الربط' : 'أو: لديّ رمز ربط من جهاز آخر'}</label><textarea class="input" id="rlCode" dir="ltr" rows="3" placeholder="MA1-…" style="font-size:13px"></textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${navigator.clipboard?.readText ? '<button class="btn sm" data-act="rlPaste">📋 لصق</button>' : ''}<button class="btn sm ${IS_WEBAPP ? 'primary' : ''}" data-act="rlJoin">🔗 ربط</button></div></div>`;
}
const _rlCard = syncCard;
syncCard = function () {
  if (rlOn() || IS_WEBAPP) return relayCard();
  return relayCard() + _rlCard();
};
// الجوال: لا تظهر فيه بطاقات خاصة ببرنامج الكمبيوتر (التحديث فيه تلقائي عند فتح التطبيق)
if (IS_WEBAPP) {
  const _sa = VIEWS.settings.after;
  VIEWS.settings.after = function () {
    [...$$('#view .card')].forEach((c) => { if (/التحديثات|الإدخال الصوتي/.test(c.querySelector('h3')?.textContent || '')) c.remove(); });
    return _sa?.call(this);
  };
}
function rlCodeModal() {
  const code = rlCode(), mail = Sync.wantEmail() || db.settings.bkMailTo || '';
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal"><div class="modal-h"><h2>📲 ربط جهاز جديد</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><ol style="margin:0 0 12px;padding-inline-start:20px;line-height:2">
      <li>أرسلي هذا الرمز إلى نفسكِ (زر «إرسال إلى بريدي» أو انسخيه).</li>
      <li>في الجوال افتحي التطبيق ← الإعدادات ← المزامنة، والصقي الرمز ثم «ربط».</li></ol>
      <textarea class="input" dir="ltr" rows="4" readonly style="font-size:12.5px">${esc(code)}</textarea>
      <div class="muted" style="margin-top:8px;color:var(--red)">🔒 هذا الرمز هو مفتاح بياناتكِ: لا ترسليه لأحد غيركِ.</div></div>
    <div class="modal-f"><button class="btn" data-act="rlCopy">📋 نسخ الرمز</button><button class="btn primary" data-act="rlMail">📧 إرسال إلى بريدي</button></div></div></div>`;
  modalCtx = { rlCode: code, mail };
}
Object.assign(ACTIONS, {
  rlCreate: async () => {
    const url = (Sync.appCfg?.syncRelay || $('#rlUrl')?.value || '').trim().replace(/\/+$/, '');
    if (!RL_URL.test(url)) return toast('أدخلي رابط الخادم الصحيح (يبدأ بـ https://)', 'err');
    toast('جارٍ التفعيل…');
    try {
      const ok = await fetch(url + '/').then((r) => r.json()).then((j) => j.app === 'madrasa-sync').catch(() => false);
      if (!ok) return toast('تعذّر الوصول إلى خادم المزامنة — تأكدي من الرابط والإنترنت', 'err');
      const cfg = { url, k: rlB64u(crypto.getRandomValues(new Uint8Array(32))) };
      // الكمبيوتر الآخر المرتبط بـ OneDrive نفسه ينضم تلقائياً (الملف في OneDrive الخاص بالحساب نفسه)
      if (Sync.status === 'on' && Sync.cfg) { try { await window.madrasaNative.sync.writeText('relay.json', JSON.stringify({ code: rlCode(cfg), note: 'رمز المزامنة المشفّرة — لا تشاركيه' })); } catch { } }
      await rlJoin(cfg, 'create');
      toast('🔐 تفعّلت المزامنة المشفّرة', 'ok'); rlCodeModal();
    } catch (e) { toast('تعذّر التفعيل: ' + e.message, 'err'); }
  },
  rlPaste: async () => { try { $('#rlCode').value = await navigator.clipboard.readText(); } catch { toast('اضغطي مطولاً على الخانة واختاري «لصق»'); } },
  rlJoin: async () => {
    const cfg = rlParse($('#rlCode')?.value);
    if (!cfg) return toast('رمز الربط غير صحيح — تأكدي من نسخه كاملاً', 'err');
    toast('جارٍ الربط…');
    try { await rlJoin(cfg, 'manual'); toast(Sync.conflict ? 'تم الربط — اختاري أي البيانات تحتفظين بها' : '🔐 تم الربط وتحميل البيانات ✓', 'ok'); }
    catch (e) { RELAY.cfg = null; toast('تعذّر الربط: ' + e.message, 'err'); }
  },
  rlShowCode: () => rlCodeModal(),
  rlCopy: async () => { try { await navigator.clipboard.writeText(modalCtx.rlCode); toast('نُسخ الرمز ✓', 'ok'); } catch { toast('حدّدي الرمز وانسخيه يدوياً'); } },
  rlMail: () => api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(modalCtx.mail)}&su=${encodeURIComponent('رمز ربط المساعد الإداري')}&body=${encodeURIComponent('انسخي الرمز التالي والصقيه في التطبيق (الإعدادات ← المزامنة):\n\n' + modalCtx.rlCode + '\n\nلا تشاركي هذا الرمز مع أحد.')}`),
  rlUnlink: () => confirmBox('فصل هذا الجهاز عن المزامنة المشفّرة؟ تبقى البيانات هنا وفي الأجهزة الأخرى، ويمكن الربط من جديد برمز الربط.', () => Sync.stop(), 'نعم، افصليه'),
});
window.__relay = RELAY; // للاختبار
