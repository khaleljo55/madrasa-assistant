/* المساعد الإداري — المصحف (جزء تبارك وجزء عم) والورد اليومي */
'use strict';

// النص القرآني يُجلب مرة واحدة من موقع alquran.cloud (رسم عثماني) ثم يُحفظ على الجهاز للقراءة دون إنترنت
const QURAN_API = 'https://api.alquran.cloud/v1';
const Q = { data: null, loading: false, error: '', surah: 67, fs: 30 };
const AR_DIGITS = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

async function quranLoad(force) {
  if (Q.data && !force) return Q.data;
  if (!force) { try { const c = await IDB.get('kv', 'quran-29-30'); if (c?.surahs?.length === 48) { Q.data = c; if (ui.view === 'quran') render(); return c; } } catch { } }
  Q.loading = true; Q.error = ''; if (ui.view === 'quran') render();
  try {
    const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.code !== 200) throw new Error(j.status || 'خطأ'); return j.data; };
    const [b, j29, j30] = await Promise.all([get(`${QURAN_API}/ayah/1/quran-uthmani`), get(`${QURAN_API}/juz/29/quran-uthmani`), get(`${QURAN_API}/juz/30/quran-uthmani`)]);
    const clean = (t) => String(t).replace(/^﻿/, '').trim();
    const basmala = clean(b.text);
    const map = new Map();
    for (const a of [...j29.ayahs, ...j30.ayahs]) {
      const s = a.surah;
      if (!map.has(s.number)) map.set(s.number, { n: s.number, name: s.name, count: s.numberOfAyahs, type: s.revelationType, ayahs: [] });
      let text = clean(a.text);
      if (a.numberInSurah === 1 && text.startsWith(basmala)) text = text.slice(basmala.length).trim();
      map.get(s.number).ayahs.push({ n: a.numberInSurah, t: text, page: a.page });
    }
    const surahs = [...map.values()].sort((x, y) => x.n - y.n);
    // التحقق من اكتمال السور قبل الحفظ
    if (surahs.length !== 48 || surahs.some((s) => s.ayahs.length !== s.count)) throw new Error('البيانات غير مكتملة');
    Q.data = { basmala, surahs, source: 'alquran.cloud — quran-uthmani', fetched: todayISO() };
    await IDB.put('kv', 'quran-29-30', Q.data);
  } catch (e) { Q.error = e.message; }
  Q.loading = false; if (ui.view === 'quran') render();
  return Q.data;
}
function ensureQuranFont() {
  if (document.getElementById('quranFont')) return;
  const l = document.createElement('link'); l.id = 'quranFont'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap';
  document.head.appendChild(l);
}
const wird = () => {
  const s = db.settings;
  if (!s.wird) s.wird = { on: true, mode: 'rest', time: '09:30', style: 'popup', text: 'حان موعد وردك اليومي 📖 ﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾', pos: 67, last: '' };
  return s.wird;
};
const surahName = (n) => (Q.data?.surahs.find((s) => s.n === n)?.name || `سورة رقم ${n}`).replace(/^سُورَةُ\s*/, 'سورة ');

VIEWS.quran = {
  actions: () => `<button class="btn" data-act="qFs" data-id="-2" title="تصغير الخط">ا−</button><button class="btn" data-act="qFs" data-id="2" title="تكبير الخط">ا+</button>`,
  render() {
    ensureQuranFont();
    const w = wird();
    if (!Q.data && !Q.loading && !Q.error) { setTimeout(() => quranLoad(), 0); }
    if (Q.loading) return `<div class="card">${emptyState('📖', 'جارٍ تحميل المصحف لأول مرة… (يحتاج اتصالاً بالإنترنت مرة واحدة فقط)')}</div>`;
    if (!Q.data) return `<div class="card">${emptyState('📖', `تعذّر تحميل المصحف${Q.error ? ` (${esc(Q.error)})` : ''}.<br>تأكدي من الاتصال بالإنترنت ثم أعيدي المحاولة — بعد التحميل الأول يعمل دون إنترنت.`)}<div style="text-align:center"><button class="btn primary" data-act="qRetry">إعادة المحاولة</button></div></div>`;
    const S = Q.data.surahs.find((s) => s.n === Q.surah) || Q.data.surahs[0];
    const doneToday = w.last === todayISO();
    const group = (title, from, to) => `<div class="section-title" style="margin:12px 0 6px">${title}</div><div class="q-list">${Q.data.surahs.filter((s) => s.n >= from && s.n <= to).map((s) => `<button class="q-item ${s.n === S.n ? 'on' : ''}" data-act="qOpen" data-id="${s.n}"><span class="q-num">${AR_DIGITS(s.n)}</span>${esc(surahName(s.n).replace('سورة ', ''))}${w.pos === s.n ? ' <span title="موضع وردك">🔖</span>' : ''}</button>`).join('')}</div>`;
    return `<div class="designer">
      <div class="d-side">
        <div class="card">
          <h3>📖 وردي اليومي</h3>
          <div class="muted">${doneToday ? '✅ قرأتِ وردكِ اليوم، بارك الله فيكِ' : `الورد التالي: <b>${esc(surahName(w.pos))}</b>`}</div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${doneToday ? '' : `<button class="btn sm primary" data-act="qOpen" data-id="${w.pos}">اقرئي الآن</button>`}<button class="btn sm" data-act="qWirdSettings">⚙️ إعدادات التذكير</button></div>
        </div>
        <div class="card" style="margin-top:12px;max-height:60vh;overflow:auto">${group('جزء تبارك', 67, 77)}${group('جزء عمّ', 78, 114)}</div>
      </div>
      <div class="d-main">
        <div class="card q-page">
          <div class="q-head"><span>${S.type === 'Meccan' ? 'مكية' : 'مدنية'}</span><h2>${esc(S.name)}</h2><span>آياتها ${AR_DIGITS(S.count)}</span></div>
          <div class="q-basmala">${esc(Q.data.basmala)}</div>
          <div class="q-text" style="font-size:${Q.fs}px">${S.ayahs.map((a) => `${esc(a.t)} <span class="q-aya">${AR_DIGITS(a.n)}</span> `).join('')}</div>
          <div class="q-nav">
            <button class="btn" data-act="qOpen" data-id="${S.n - 1}" ${S.n <= 67 ? 'disabled' : ''}>→ السورة السابقة</button>
            ${w.pos === S.n && !doneToday ? `<button class="btn primary" data-act="qWirdDone">✓ قرأتُ وردي</button>` : `<button class="btn" data-act="qMark" data-id="${S.n}">🔖 اجعليها موضع وردي</button>`}
            <button class="btn" data-act="qOpen" data-id="${S.n + 1}" ${S.n >= 114 ? 'disabled' : ''}>السورة التالية ←</button>
          </div>
        </div>
        <div class="muted" style="margin-top:6px">النص بالرسم العثماني من ${esc(Q.data.source.split(' — ')[0])} · محفوظ على الجهاز منذ ${fmtG(Q.data.fetched)}</div>
      </div>
    </div>`;
  },
};
Object.assign(ACTIONS, {
  qOpen: (el) => { const n = +el.dataset.id; if (n < 67 || n > 114) return; Q.surah = n; ui.view = 'quran'; render(); $('#view').scrollTop = 0; document.getElementById('restOverlay')?.remove(); },
  qRetry: () => { Q.error = ''; quranLoad(true); },
  qFs: (el) => { Q.fs = Math.min(56, Math.max(20, Q.fs + +el.dataset.id)); try { localStorage.setItem('madrasa-qfs', Q.fs); } catch { } render(); },
  qMark: (el) => { wird().pos = +el.dataset.id; commit(); toast('🔖 حُفظ موضع وردكِ', 'ok'); },
  qWirdDone: () => {
    const w = wird(); w.last = todayISO(); w.pos = w.pos >= 114 ? 67 : w.pos + 1;
    commit(); toast(w.pos === 67 ? 'ختمتِ جزأي تبارك وعمّ، تقبّل الله منكِ 🌷' : 'تقبّل الله منكِ 🌷', 'ok');
  },
  qWirdSettings: () => {
    const w = wird();
    formModal({
      title: 'إعدادات تذكير الورد', wide: true,
      fields: [
        { key: 'on', label: 'تفعيل تذكير الورد اليومي', type: 'checkbox', full: true },
        { key: 'mode', label: 'متى يظهر التذكير؟', type: 'select', options: [['rest', 'مع أول استراحة في اليوم'], ['time', 'في وقت محدد']] },
        { key: 'time', label: 'الوقت المحدد', type: 'time', hint: 'يُستخدم عند اختيار «في وقت محدد»' },
        { key: 'style', label: 'طريقة التذكير', type: 'select', options: [['popup', 'نافذة لطيفة في منتصف الشاشة'], ['gentle', 'تنبيه صغير في زاوية الشاشة'], ['sound', 'تنبيه صغير مع صوت هادئ']] },
        { key: 'text', label: 'العبارة التي تظهر', type: 'textarea', full: true, rows: 2, voice: true },
      ],
      values: { ...w },
      onSave: (v) => { Object.assign(wird(), v); commit(); toast('تم حفظ إعدادات الورد', 'ok'); },
    });
  },
});

// التذكير بالورد: مرة واحدة يومياً
function wirdDue() { const w = wird(); return w.on && !(db.settings.hidden || []).includes('quran') && w.last !== todayISO() && w.shown !== todayISO(); }
function wirdHtml() {
  const w = wird();
  return `<div class="wird-box"><div class="wird-text">${esc(w.text)}</div><div class="muted">وردكِ: <b>${esc(surahName(w.pos))}</b></div>
    <button class="btn sm primary" data-act="qOpen" data-id="${w.pos}" style="margin-top:8px">📖 اقرئي وردكِ الآن</button></div>`;
}
function wirdNotify() {
  const w = wird(); w.shown = todayISO(); api.save(db);
  if (w.style === 'popup') {
    if (document.getElementById('restOverlay')) return;
    const el = document.createElement('div'); el.id = 'restOverlay'; el.className = 'rest-overlay';
    el.innerHTML = `<div class="rest-card"><div style="font-size:46px">📖</div>${wirdHtml()}<div class="rest-btns"><button class="btn ghost" data-act="wirdLater">لاحقاً</button></div></div>`;
    document.body.appendChild(el); restChime();
  } else {
    const t = document.createElement('div'); t.className = 'toast wird-toast';
    t.innerHTML = `📖 ${esc(w.text)} <button class="btn sm" data-act="qOpen" data-id="${w.pos}">اقرئي</button>`;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 20000);
    if (w.style === 'sound') restChime();
  }
}
ACTIONS.wirdLater = () => { document.getElementById('restOverlay')?.remove(); };
// دمج الورد مع نافذة الاستراحة
const _restShow = restShow;
restShow = function () {
  _restShow();
  const w = wird();
  if (wirdDue() && w.mode === 'rest') {
    if (w.style === 'popup') { const card = $('#restOverlay .rest-card'); if (card) { card.querySelector('.rest-tip')?.insertAdjacentHTML('afterend', wirdHtml()); w.shown = todayISO(); api.save(db); } }
    else wirdNotify();
  }
};
(function wirdLoop() {
  const start = () => {
    if (!db) return setTimeout(start, 400);
    try { Q.fs = +localStorage.getItem('madrasa-qfs') || 30; } catch { }
    wird();
    // تحميل المصحف مسبقاً في الخلفية ليكون جاهزاً
    setTimeout(() => { if (!Q.data) IDB.get('kv', 'quran-29-30').then((c) => { if (c?.surahs?.length === 48) Q.data = c; else quranLoad().catch(() => { }); }).catch(() => { }); }, 3000);
    setInterval(() => {
      const w = wird(); if (!wirdDue()) return;
      const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      // بوقت محدد، أو مع الاستراحة إذا كان تذكير الراحة متوقفاً
      if ((w.mode === 'time' && hm >= w.time) || (w.mode === 'rest' && !db.settings.restOn && hm >= (w.time || '09:30'))) wirdNotify();
    }, 30000);
  };
  start();
})();
