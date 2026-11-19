// ═════════════ 🔀 دمج بيانات جهازين بدل اختيار أحدهما (1.7.0) ═════════════
// عند وجود بيانات في الجهازين (أول ربط، أو تعديل في الجهازين قبل أن يتزامنا) يظهر خيار «دمج البيانات»:
// - القوائم ذات المعرّف (المعلمات، المهام، الطالبات، الغياب…): يُجمع ما في الجهازين، والسجل الموجود في الاثنين تؤخذ نسخته الأحدث.
// - السجلات المتطابقة (مثل المناسبات الافتراضية المضافة تلقائياً في كل جهاز) لا تتكرر.
// - الإعدادات والكائنات: تُدمج حقلاً حقلاً، والقيمة الفارغة لا تمحو قيمة موجودة.
// - قبل أي دمج أو استبدال تُحفظ نسخة كاملة من بيانات الجهاز (آخر 5 نسخ) يمكن تنزيلها من الإعدادات.
// ملاحظة: سجلّ حُذف في جهاز وبقي في الآخر يعود بعد الدمج (الأسلم من ضياع بيانات).

const MG_SKIP = new Set(['meta', 'version', '_backup']);
const MG = { quiet: false, busy: false };
const mgIsObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const mgEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (mgIsObj(v) && !Object.keys(v).length);
const mgSig = (o) => { try { const { id, ...r } = o; return JSON.stringify(r, Object.keys(r).sort()); } catch { return Math.random() + ''; } };
// مفتاح «طبيعي» لبعض القوائم حتى لا تتكرر السجلات الافتراضية المولّدة في كل جهاز بمعرّف مختلف
const MG_KEY = {
  occasions: (o) => `${o.name}|${o.month}|${o.day}|${o.cal || 'g'}`,
};
const mgTouched = (k, o) => (k === 'occasions' ? o.status !== 'todo' || !!(o.initiative || o.responsible || o.notes || o.year) : true);

function mgArray(a, b, aNewer, key) {
  const A = a || [], B = b || [];
  if (!A.length) return B.slice(); if (!B.length) return A.slice();
  const withId = (arr) => arr.every((x) => mgIsObj(x) && x.id != null);
  if (!withId(A) || !withId(B)) {
    // قائمة بلا معرّفات: النسخة الأحدث، مع إضافة ما لا يتكرر من الأخرى إن كانت قيماً بسيطة
    const [n, o] = aNewer ? [A, B] : [B, A];
    if (n.every((x) => typeof x !== 'object') && o.every((x) => typeof x !== 'object')) return [...new Set([...n, ...o])];
    return n.slice();
  }
  const [first, second] = aNewer ? [A, B] : [B, A]; // الأحدث أولاً
  const byId = new Map(), out = [];
  for (const x of first) { byId.set(String(x.id), out.length); out.push(x); }
  const nat = MG_KEY[key], sigs = new Map(out.map((x, i) => [nat ? nat(x) : mgSig(x), i]));
  for (const y of second) {
    const id = String(y.id);
    if (byId.has(id)) { const i = byId.get(id); out[i] = mgObj(out[i], y, true, key + '[]'); continue; } // الموجود في الاثنين: الأحدث مع إكمال الحقول الناقصة
    const s = nat ? nat(y) : mgSig(y);
    if (sigs.has(s)) { // سجل مكرر بمعرّف مختلف (افتراضي في الجهازين): نُبقي المعدَّل منهما
      const i = sigs.get(s);
      if (nat && !mgTouched(key, out[i]) && mgTouched(key, y)) out[i] = y;
      continue;
    }
    byId.set(id, out.length); sigs.set(s, out.length); out.push(y);
  }
  return out;
}
function mgObj(a, b, aNewer, key = '') {
  if (!mgIsObj(a) || !mgIsObj(b)) {
    if (Array.isArray(a) || Array.isArray(b)) return mgArray(Array.isArray(a) ? a : [], Array.isArray(b) ? b : [], aNewer, key);
    if (mgEmpty(a)) return b; if (mgEmpty(b)) return a;
    return aNewer ? a : b;
  }
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in b)) { out[k] = a[k]; continue; }
    if (!(k in a)) { out[k] = b[k]; continue; }
    out[k] = mgObj(a[k], b[k], aNewer, key ? key + '.' + k : k);
  }
  return out;
}
function mergeDb(local, remote) {
  const lt = local.meta?.updatedAt || 0, rt = remote.meta?.updatedAt || 0, localNewer = lt >= rt;
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (MG_SKIP.has(k)) continue;
    out[k] = k in local && k in remote ? mgObj(local[k], remote[k], localNewer, k) : k in local ? local[k] : remote[k];
  }
  out.version = Math.max(local.version || 1, remote.version || 1);
  out.meta = { ...(localNewer ? local.meta : remote.meta), updatedAt: Date.now(), device: deviceId(), merged: true };
  return out;
}
// ───── الدمج الثلاثي (1.10.0): بمقارنة الجهازين بآخر نسخة اتفقا عليها (الأساس) ─────
// فيُعرف ما أُضيف وما عُدّل وما حُذف في كل جهاز، فلا يعود المحذوف ولا يضيع المضاف، ودون أي سؤال.
const mgEq = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };
function mg3(l, r, b, lNewer, key) {
  if (mgEq(l, r)) return l;
  if (b !== undefined) { if (mgEq(l, b)) return r; if (mgEq(r, b)) return l; }
  if (Array.isArray(l) && Array.isArray(r)) return mg3Arr(l, r, Array.isArray(b) ? b : undefined, lNewer, key);
  if (mgIsObj(l) && mgIsObj(r)) {
    const out = {}, B = mgIsObj(b) ? b : undefined;
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const inL = k in l, inR = k in r, inB = B && k in B;
      if (inL && inR) out[k] = mg3(l[k], r[k], B ? B[k] : undefined, lNewer, key + '.' + k);
      else if (inL) { if (!(inB && mgEq(l[k], B[k]))) out[k] = l[k]; } // حُذف في الآخر ولم يُعدَّل هنا ← يُحذف
      else if (!(inB && mgEq(r[k], B[k]))) out[k] = r[k];
    }
    return out;
  }
  if (b === undefined) return mgObj(l, r, lNewer, key); // لا أساس: الدمج العادي
  return lNewer ? l : r;
}
function mg3Arr(L, R, B, lNewer, key) {
  const withId = (a) => a.every((x) => mgIsObj(x) && x.id != null);
  if (!B || !withId(L) || !withId(R) || !withId(B)) return B ? (lNewer ? L : R) : mgArray(L, R, lNewer, key);
  const mL = new Map(L.map((x) => [String(x.id), x])), mR = new Map(R.map((x) => [String(x.id), x])), mB = new Map(B.map((x) => [String(x.id), x]));
  const out = [];
  for (const x of L) {
    const id = String(x.id);
    if (mR.has(id)) out.push(mg3(x, mR.get(id), mB.get(id), lNewer, key + '[]'));
    else if (!(mB.has(id) && mgEq(x, mB.get(id)))) out.push(x); // أُضيف هنا، أو عُدّل هنا بعد حذفه هناك ← يبقى
  }
  for (const y of R) { const id = String(y.id); if (!mL.has(id) && !(mB.has(id) && mgEq(y, mB.get(id)))) out.push(y); }
  return out;
}
function mergeDb3(local, remote, base) {
  const lt = local.meta?.updatedAt || 0, rt = remote.meta?.updatedAt || 0, ln = lt >= rt, out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (MG_SKIP.has(k)) continue;
    const inL = k in local, inR = k in remote;
    out[k] = inL && inR ? mg3(local[k], remote[k], base ? base[k] : undefined, ln, k) : inL ? local[k] : remote[k];
  }
  out.version = Math.max(local.version || 1, remote.version || 1);
  out.meta = { ...(ln ? local.meta : remote.meta), updatedAt: Date.now(), device: deviceId(), merged: true };
  return out;
}
// «الأساس»: آخر نسخة متفق عليها مع الخادم لهذه القناة (يُحفظ بعد كل رفع أو تحميل ناجح)
async function mgSaveBase() { try { if (typeof RELAY !== 'undefined' && RELAY.id) await IDB.put('kv', 'syncBaseData', { ch: RELAY.id, at: db.meta?.updatedAt || 0, json: JSON.stringify(db) }); } catch { } }
async function mgGetBase() { try { const b = await IDB.get('kv', 'syncBaseData'); return b && b.ch === RELAY.id ? JSON.parse(b.json) : null; } catch { return null; } }
const mgCount = (d) => Object.entries(d || {}).filter(([k, v]) => Array.isArray(v) && k !== 'occasions').reduce((a, [, v]) => a + v.length, 0);

// ───── نسخ ما قبل المزامنة ─────
async function mgSnapshot(reason) {
  try {
    const list = (await IDB.get('kv', 'syncSnaps')) || [];
    list.unshift({ at: new Date().toISOString(), reason, n: mgCount(db), data: JSON.parse(JSON.stringify(db)) });
    await IDB.put('kv', 'syncSnaps', list.slice(0, 5));
  } catch (e) { console.warn('snapshot failed', e); }
}
// بيانات حقيقية في هذا الجهاز؟ (أي قائمة غير فارغة، وليس فقط المعلمات والمهام كما كان سابقاً)
Sync.hasLocalData = () => mgCount(db) > 0 || (db.occasions || []).some((o) => mgTouched('occasions', o));

Object.assign(ACTIONS, {
  syncMerge: async () => {
    const remote = Sync.conflict; if (!remote) return;
    const full = remote._stub && typeof Sync.readRemote === 'function' ? await Sync.readRemote(true) : remote;
    const base = await mgGetBase();
    if (!base) await mgSnapshot('قبل الدمج');
    const before = { l: mgCount(db), r: mgCount(full) };
    const merged = base ? mergeDb3(db, full, base) : mergeDb(db, full);
    db = migrate(merged);
    for (const f of HOOKS.beforeStart || []) { try { await f(); } catch { } }
    await api.save(db);
    await Sync.setBase(full.meta?.updatedAt || 0);
    Sync.conflict = null;
    await Sync.push(true);
    render(); renderSyncBar();
    if (!MG.quiet) toast(base ? '🔀 دُمجت تعديلات الجهازين' : `🔀 دُمجت البيانات: ${mgCount(db)} سجلاً (هذا الجهاز ${before.l} + الآخر ${before.r} دون تكرار)`, 'ok');
  },
  mgDl: async (el) => {
    const list = (await IDB.get('kv', 'syncSnaps').catch(() => null)) || [], s = list[Number(el.dataset.id)];
    if (!s) return;
    openBlob(new Blob([JSON.stringify({ ...s.data, _backup: { at: s.at, reason: s.reason } })], { type: 'application/json' }), `نسخة ${s.reason} ${s.at.slice(0, 10)}.json`, true);
    toast('حُفظت النسخة في «التنزيلات»، ويمكن استعادتها من «استعادة نسخة»', 'ok');
  },
});
// نسخة احتياطية قبل الاستبدال بأي من الخيارين القديمين أيضاً
const _mgUseRemote = ACTIONS.syncUseRemote, _mgUseLocal = ACTIONS.syncUseLocal;
ACTIONS.syncUseRemote = async (...a) => { await mgSnapshot('قبل تحميل بيانات الجهاز الآخر'); return _mgUseRemote(...a); };
ACTIONS.syncUseLocal = async (...a) => { if (Sync.conflict) { const prev = db; db = Sync.conflict; await mgSnapshot('بيانات الجهاز الآخر قبل استبدالها'); db = prev; } return _mgUseLocal(...a); };

let MG_SNAPS = [];
addHook('settingsCards', () => {
  IDB.get('kv', 'syncSnaps').then((l) => { const n = (l || []).length; if (n !== MG_SNAPS.length) { MG_SNAPS = (l || []).map((x) => ({ at: x.at, reason: x.reason, n: x.n })); if (ui.view === 'settings') render(); } }).catch(() => { });
  if (!MG_SNAPS.length) return '';
  return `<div class="card"><h3>🛟 نسخ ما قبل المزامنة</h3><div class="muted" style="margin-bottom:8px">حفظها البرنامج تلقائياً قبل دمج البيانات أو استبدالها. نزّلي أيّها ثم استعيديها من «استعادة نسخة» عند الحاجة.</div>
    <div class="list">${MG_SNAPS.map((s, i) => `<div class="li"><div class="grow"><div class="t">${esc(s.reason)}</div><div class="s">${new Date(s.at).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })} · ${s.n} سجلاً</div></div><button class="btn sm" data-act="mgDl" data-id="${i}">⬇ تنزيل</button></div>`).join('')}</div></div>`;
});

// ───── الدمج التلقائي في المزامنة المشفّرة: لا أسئلة عند تعديل جهازين (1.10.0) ─────
if (typeof rlPushNow === 'function') {
  const _mgPush = rlPushNow;
  rlPushNow = async function (...a) { await _mgPush.apply(this, a); if (rlOn() && Sync.status === 'on' && !Sync.conflict && Sync.base === (db.meta?.updatedAt || 0)) await mgSaveBase(); };
}
const _mgLoad = Sync.load;
Sync.load = async function (...a) { const r = await _mgLoad.apply(this, a); if (rlOn()) await mgSaveBase(); return r; };
const _mgSetConflict = Sync.setConflict;
Sync.setConflict = function (remote) {
  if (!rlOn() || !remote || MG.busy) return _mgSetConflict.call(this, remote);
  this.conflict = remote;
  MG.busy = true;
  (async () => {
    try { if (remote._stub) this.conflict = await this.readRemote(true); const hasBase = !!(await mgGetBase()); MG.quiet = hasBase; await ACTIONS.syncMerge(); }
    catch (e) { console.warn('auto-merge failed', e); renderSyncBar(); }
    finally { MG.quiet = false; MG.busy = false; }
  })();
};
