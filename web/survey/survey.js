// ═════════════ 📝 صفحة تعبئة استبيان برابط عام (1.9.0) ═════════════
// الرابط: …/survey/#s=<المدرسة>&q=<الاستبيان>&k=<مفتاح الرابط>&r=<الخادم>&n=<اسم المدرسة>
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = new URLSearchParams(location.hash.replace(/^#/, ''));
const C = { s: H.get('s') || '', q: H.get('q') || '', k: H.get('k') || '', r: (H.get('r') || '').replace(/\/+$/, ''), n: (H.get('n') || '').slice(0, 80) };
const OK = /^[0-9a-f]{32}$/.test(C.s) && /^[0-9a-f]{16}$/.test(C.q) && /^[0-9a-f]{16}$/.test(C.k) && /^(https:\/\/[a-z0-9.-]+\.workers\.dev|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/i.test(C.r);
const ERR = { required: 'أكملي الإجابات الإلزامية', bad_email: 'البريد الإلكتروني غير صحيح', closed: 'انتهى استقبال الإجابات لهذا الاستبيان', too_many: 'محاولات كثيرة من هذا الجهاز، حاولي لاحقاً', full: 'اكتمل عدد الإجابات', empty: 'لم تُكتب أي إجابة', not_found: 'الاستبيان غير موجود أو الرابط غير صحيح' };
// العنوان القديم للخادم ← الجديد (يُجرَّب الجديد أولاً، والقديم ما دام الجديد لم يعمل بعد)
async function bestRelay(u) {
  let alt = ''; try { const x = new URL(u); if (/\.khaleljo55-519\.workers\.dev$/i.test(x.hostname)) { x.hostname = x.hostname.replace(/\.khaleljo55-519\.workers\.dev$/i, '.madrasa-assistant.workers.dev'); alt = x.origin; } } catch { }
  if (!alt) return u;
  try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000); const r = await fetch(alt + '/', { cache: 'no-store', signal: ctl.signal }); clearTimeout(t); if (r.ok && (await r.json()).app === 'madrasa-sync') return alt; } catch { }
  return u;
}
let S = null, state = 'load', err = '';
function field(f, v = '') {
  const req = f.required ? ' required' : '', star = f.required ? ' <span class="err">*</span>' : '';
  let c;
  if (f.type === 'textarea') c = `<textarea name="${f.id}" rows="4" maxlength="2000"${req}>${esc(v)}</textarea>`;
  else if (f.type === 'select') c = `<select name="${f.id}"${req}><option value="">اختاري…</option>${(f.options || []).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else c = `<input name="${f.id}" type="${f.type === 'tel' ? 'tel' : f.type}" value="${esc(v)}" maxlength="300"${f.type === 'email' || f.type === 'tel' || f.type === 'number' ? ' dir="ltr"' : ''}${f.type === 'tel' ? ' inputmode="tel"' : ''}${req}>`;
  return `<label>${esc(f.label)}${star}${c}</label>`;
}
function render() {
  const app = $('#app'), school = C.n ? `<div class="school">${esc(C.n)}</div>` : '';
  if (!OK) { app.innerHTML = `<div class="center"><div class="logo">📝</div><h1>استبيان</h1><p class="muted">الرابط غير مكتمل. افتحي الرابط كما وصلكِ.</p></div>`; return; }
  if (state === 'load') { app.innerHTML = `<div class="center"><div class="logo">⏳</div><p class="muted">جارٍ التحميل…</p></div>`; return; }
  if (state === 'error') { app.innerHTML = `<div class="center"><div class="logo">📝</div><h1>استبيان</h1>${school}<p class="err">${esc(err)}</p></div>`; return; }
  if (state === 'done') { app.innerHTML = `<div class="center"><div class="logo">✅</div><h1>شكراً لكِ</h1>${school}<p class="muted">وصلت إجابتكِ على «${esc(S.title)}».</p><button class="btn link" data-act="again">إرسال إجابة أخرى</button></div>`; return; }
  document.title = S.title;
  app.innerHTML = `<header><div><b>📝 ${esc(S.title)}</b>${C.n ? `<span>${esc(C.n)}</span>` : ''}</div></header><main>
    ${S.intro ? `<div class="card">${esc(S.intro).replace(/\n/g, '<br>')}</div>` : ''}
    ${S.open ? `<form id="svForm" class="card">${S.fields.map((f) => field(f)).join('')}<button class="btn primary" type="submit">إرسال</button>${err ? `<p class="err">${esc(err)}</p>` : ''}</form>` : '<div class="card err">انتهى استقبال الإجابات لهذا الاستبيان.</div>'}</main>`;
}
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target)), btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const r = await fetch(`${C.r}/sv/${C.s}/${C.q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: C.k, data }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(ERR[j.error] || 'تعذّر الإرسال (' + r.status + ')');
    state = 'done'; err = '';
  } catch (x) { err = x.message === 'Failed to fetch' ? 'تعذّر الاتصال، تأكدي من الإنترنت' : x.message; }
  render();
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-act=again]')) { state = 'form'; render(); } });
render();
if (OK) bestRelay(C.r).then((b) => { C.r = b; return fetch(`${C.r}/sv/${C.s}/${C.q}?k=${C.k}`, { cache: 'no-store' }).then((r) => r.json().then((j) => ({ r, j }))).then(({ r, j }) => {
  if (!r.ok) { state = 'error'; err = ERR[j.error] || 'تعذّر فتح الاستبيان'; } else { S = j.survey; state = 'form'; }
  render();
}); }).catch(() => { state = 'error'; err = 'تعذّر الاتصال، تأكدي من الإنترنت'; render(); });
