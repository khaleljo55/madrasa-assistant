// ═════════════ 🔀 دمج بيانات جهازين بدل اختيار أحدهما (1.7.0) ═════════════
// عند وجود بيانات في الجهازين (أول ربط، أو تعديل في الجهازين قبل أن يتزامنا) يظهر خيار «دمج البيانات»:
// - القوائم ذات المعرّف (المعلمات، المهام، الطالبات، الغياب…): يُجمع ما في الجهازين، والسجل الموجود في الاثنين تؤخذ نسخته الأحدث.
// - السجلات المتطابقة (مثل المناسبات الافتراضية المضافة تلقائياً في كل جهاز) لا تتكرر.
// - الإعدادات والكائنات: تُدمج حقلاً حقلاً، والقيمة الفارغة لا تمحو قيمة موجودة.
// - قبل أي دمج أو استبدال تُحفظ نسخة كاملة من بيانات الجهاز (آخر 5 نسخ) يمكن تنزيلها من الإعدادات.
// ملاحظة: سجلّ حُذف في جهاز وبقي في الآخر يعود بعد الدمج (الأسلم من ضياع بيانات).

const MG_SKIP = new Set(['meta', 'version', '_backup']);
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
    await mgSnapshot('قبل الدمج');
    const before = { l: mgCount(db), r: mgCount(full) };
    const merged = mergeDb(db, full);
    db = migrate(merged);
    for (const f of HOOKS.beforeStart || []) { try { await f(); } catch { } }
    await api.save(db);
    await Sync.setBase(full.meta?.updatedAt || 0);
    Sync.conflict = null;
    await Sync.push(true);
    render(); renderSyncBar();
    toast(`🔀 دُمجت البيانات: ${mgCount(db)} سجلاً (هذا الجهاز ${before.l} + الآخر ${before.r} دون تكرار)`, 'ok');
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
