/* المساعد الإداري — المرحلة الثانية: التاريخ الهجري والإدخال اليدوي، الملف الموحد للمعلمة، مركز الخطابات والنماذج، الصادر والوارد */
'use strict';

// ═════════════ 📅 التاريخ الهجري والإدخال اليدوي ═════════════
// كل خانة تاريخ في البرنامج تحصل تلقائياً على خانة مرافقة تعرض التاريخ الهجري،
// ويمكن الكتابة فيها يدوياً بالهجري (1448/5/29) أو بالميلادي (2026/11/9) أو بالصيغة الكاملة (29 جمادى الأولى 1448).
const arDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const hijriStr = (isoDate) => { const [y, m, d] = hParts(parse(isoDate)); return `${y}/${pad(m)}/${pad(d)}`; };
const validG = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? iso(t) : null; };
function parseAnyDate(text) {
  let s = arDigits(text).trim(); if (!s) return null;
  const hasH = /هـ|ه$|هجري/.test(s), hasG = /م$|ميلادي/.test(s);
  const nm = normName(s);
  let hm = HMONTHS.findIndex((m) => nm.includes(normName(m)));
  if (hm >= 0 && HMONTHS[hm] === 'ربيع الأول' && nm.includes(normName('ربيع الآخر'))) hm = 3;
  if (hm >= 0 && HMONTHS[hm] === 'جمادى الأولى' && nm.includes(normName('جمادى الآخرة'))) hm = 5;
  let gm = hm < 0 ? MONTHS.findIndex((m) => nm.includes(normName(m))) : -1;
  const nums = (s.match(/\d+/g) || []).map(Number);
  let y, m, d;
  if (hm >= 0 || gm >= 0) {
    m = (hm >= 0 ? hm : gm) + 1;
    y = nums.find((n) => n > 31); d = nums.find((n) => n !== y && n >= 1 && n <= 31);
    if (!y || !d) return null;
  } else {
    if (nums.length !== 3) return null;
    if (nums[0] > 31) [y, m, d] = nums; else if (nums[2] > 31) [d, m, y] = nums; else return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const hijri = hm >= 0 || hasH || (!hasG && gm < 0 && y < 1700);
  if (hijri) { if (y < 1300 || y > 1600 || d > 30) return null; return hijriToG(y, m, d); }
  return validG(y, m, d);
}
function enhanceDateInput(inp) {
  if (inp.dataset.hj || inp.dataset.nohj !== undefined) return;
  inp.dataset.hj = '1';
  const wrap = document.createElement('span'); wrap.className = 'hj-wrap';
  const box = document.createElement('input');
  box.type = 'text'; box.className = 'input hj-in'; box.placeholder = 'هجري 1448/05/29';
  box.title = 'اكتبي التاريخ يدوياً بالهجري (مثل 1448/5/29 أو 29 جمادى الأولى 1448) أو بالميلادي (مثل 2026/11/9)';
  const sync = () => { box.value = inp.value ? hijriStr(inp.value) + 'هـ' : ''; box.classList.remove('bad'); };
  const apply = () => {
    const v = box.value.trim();
    if (!v) return;
    const g = parseAnyDate(v);
    if (!g) { box.classList.add('bad'); toast('التاريخ غير صحيح — اكتبيه مثل 1448/5/29 أو 2026/11/9', 'err'); return; }
    if (inp.value !== g) {
      inp.value = g;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (document.body.contains(box)) sync();
  };
  inp.addEventListener('input', sync); inp.addEventListener('change', sync);
  box.addEventListener('change', (e) => { e.stopPropagation(); apply(); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); } });
  inp.parentNode.insertBefore(wrap, inp); wrap.append(inp, box);
  sync();
}
const enhanceDates = (root = document) => root.querySelectorAll('input[type=date]:not([data-hj])').forEach(enhanceDateInput);
new MutationObserver(() => enhanceDates()).observe(document.body, { childList: true, subtree: true });
enhanceDates();

// ═════════════ القائمة ═════════════
(function addNav2() {
  const org = NAV_TREE.find((x) => x.group === 'org');
  org.items.push({ id: 'letters', ic: '✉️', label: 'الخطابات والنماذج' }, { id: 'mail', ic: '📨', label: 'الصادر والوارد' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
addHook('beforeStart', () => { if (!Array.isArray(db.correspondence)) db.correspondence = []; if (!Array.isArray(db.documents)) db.documents = []; });

// ═════════════ ✉️ مركز الخطابات والنماذج ═════════════
const LETTER_CATS = { letter: 'خطابات', form: 'نماذج', minutes: 'محاضر', other: 'أخرى' };
const T_SLOT = 'الأستاذة / {{T}}';
const _docTemplate = docTemplate;
docTemplate = function (k) {
  const s = db.settings, t = todayISO(), lh = letterhead();
  const sig = (who = 'قائدة المدرسة') => `<p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%"></td><td style="width:50%;text-align:center"><b>${who}</b><br><br>..........................</td></tr></tbody></table>`;
  const sig2 = `<p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>${esc(db.settings.signerTitle || 'المساعد الإداري')}</b><br>${esc(db.settings.signerName ?? s.employeeName ?? '')}<br>..........................</td><td style="width:50%;text-align:center"><b>قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`;
  const T = {
    assign: ['تكليف', `${lh}<h1 style="text-align:center">تكليف</h1><p>المكرمة ${T_SLOT}   وفقها الله</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>بناءً على ما تقتضيه مصلحة العمل، فقد تقرر تكليفكِ بـ: ..........................................................</p><p>وذلك اعتباراً من تاريخ ${fmtH(t)} الموافق ${fmtG(t)}، ولمدة: ..........................</p><p>سائلين الله لكِ التوفيق والسداد.</p>${sig()}<p><br></p><p>توقيع المعلمة بالعلم: ..........................   التاريخ: ..........................</p>`],
    permission: ['نموذج استئذان', `${lh}<h1 style="text-align:center">نموذج استئذان أثناء الدوام</h1>
      <table><tbody><tr><td style="width:25%"><b>اسم المعلمة</b></td><td>${T_SLOT.replace('الأستاذة / ', '')}</td></tr><tr><td><b>اليوم والتاريخ</b></td><td>${dayName(t)} ${fmtH(t)}</td></tr><tr><td><b>وقت الخروج</b></td><td></td></tr><tr><td><b>وقت العودة</b></td><td></td></tr><tr><td><b>سبب الاستئذان</b></td><td><br><br></td></tr><tr><td><b>الحصص المتأثرة</b></td><td></td></tr><tr><td><b>البديلة</b></td><td></td></tr></tbody></table>
      <p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>توقيع المعلمة</b><br><br>..........................</td><td style="width:50%;text-align:center"><b>اعتماد قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`],
    inquiry: ['نموذج مساءلة', `${lh}<h1 style="text-align:center">نموذج مساءلة</h1><p>المكرمة ${T_SLOT}   وفقها الله</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>نظراً لـ ☐ غيابكِ ☐ تأخركِ ☐ خروجكِ أثناء الدوام يوم .......... الموافق ..........، نأمل إفادتنا عن الأسباب.</p>${sig()}
      <h2>إفادة المعلمة</h2><p>.................................................................................................</p><p>.................................................................................................</p><p>التوقيع: ..........................   التاريخ: ..........................</p>
      <h2>رأي قائدة المدرسة</h2><p>☐ يُقبل عذرها ☐ لا يُقبل عذرها ويُحسم عليها</p><p>التوقيع: ..........................</p>`],
    handover: ['محضر استلام وتسليم', `${lh}<h1 style="text-align:center">محضر استلام وتسليم</h1><p>إنه في يوم ${dayName(t)} الموافق ${fmtH(t)}، تم تسليم واستلام ما يلي:</p>
      <table><tbody><tr><td><b>م</b></td><td><b>البيان</b></td><td><b>العدد</b></td><td><b>ملاحظات</b></td></tr><tr><td>1</td><td></td><td></td><td></td></tr><tr><td>2</td><td></td><td></td><td></td></tr><tr><td>3</td><td></td><td></td><td></td></tr></tbody></table>
      <p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>المُسلِّمة</b><br><br>..........................</td><td style="width:50%;text-align:center"><b>المُستلِمة</b><br><br>..........................</td></tr></tbody></table>`],
    pledge: ['تعهد', `${lh}<h1 style="text-align:center">تعهد</h1><p>أتعهد أنا ${T_SLOT} بـ: ..........................................................</p><p>.................................................................................................</p><p>وعلى ذلك جرى التوقيع.</p><p><br></p><p>الاسم: ..........................   التوقيع: ..........................   التاريخ: ${fmtH(t)}</p>`],
    parent: ['دعوة ولي أمر', `${lh}<h1 style="text-align:center">دعوة ولي أمر</h1><p>المكرم ولي أمر الطالبة / ..........................   الصف: ..........</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>نأمل التكرم بزيارة المدرسة يوم .......... الموافق .......... الساعة ..........، لمناقشة: ..........................................</p><p>شاكرين حسن تعاونكم.</p>${sig()}`],
    achievement: ['تقرير إنجاز', `${lh}<h1 style="text-align:center">تقرير إنجاز</h1><table><tbody><tr><td style="width:25%"><b>الفترة</b></td><td></td></tr><tr><td><b>معدّة التقرير</b></td><td>${esc(s.employeeName || '')}</td></tr></tbody></table>
      <h2>الإنجازات</h2><ol><li></li><li></li><li></li></ol><h2>التحديات</h2><ul><li></li></ul><h2>المقترحات</h2><ul><li></li></ul>${sig2}`],
  };
  if (T[k]) return T[k];
  const r = _docTemplate(k);
  if (k === 'notice' || k === 'thanks') r[1] = r[1].replace('الأستاذة / ..........................', T_SLOT);
  return r;
};
const LETTER_TEMPLATES = [
  ['letter', 'خطاب رسمي', 'letter'], ['circular', 'تعميم داخلي', 'letter'], ['assign', 'تكليف', 'letter'], ['thanks', 'خطاب شكر', 'letter'], ['notice', 'إشعار للمعلمة', 'letter'], ['parent', 'دعوة ولي أمر', 'letter'],
  ['permission', 'نموذج استئذان', 'form'], ['inquiry', 'نموذج مساءلة', 'form'], ['pledge', 'تعهد', 'form'], ['handover', 'محضر استلام وتسليم', 'minutes'], ['minutes', 'محضر اجتماع', 'minutes'], ['achievement', 'تقرير إنجاز', 'other'], ['blank', 'مستند فارغ', 'other'],
];
// أضف القوالب الجديدة إلى محرر المستندات أيضاً
LETTER_TEMPLATES.forEach(([k, l]) => { if (!DOC_TEMPLATES.some((x) => x[0] === k)) DOC_TEMPLATES.push([k, l]); });
const OUT_KINDS = ['letter', 'circular', 'assign', 'thanks', 'notice', 'parent', 'inquiry'];
function newLetter(k, preTeacher) {
  const [title, html] = docTemplate(k);
  const needT = html.includes('{{T}}'), canOut = OUT_KINDS.includes(k);
  const create = (tid, out) => {
    let h = html.replace(/\{\{T\}\}/g, tid ? esc(tName(tid)) : '..........................');
    const d = { id: uid(), title: tid ? `${title} — ${tName(tid)}` : title, html: h, updatedAt: todayISO(), kind: k, teacherId: tid || '' };
    if (out) {
      const c = newOutgoing({ subject: d.title, party: tid ? tName(tid) : '', docId: d.id });
      d.html = d.html.replace('الرقم: ..........', `الرقم: ${esc(c.number)}`); d.outNumber = c.number;
    }
    db.documents.push(d); DOCS.id = d.id; DOCS.range = null; commit();
    toast(out ? `أُنشئ «${d.title}» وسُجّل في الصادر برقم ${d.outNumber}` : `أُنشئ «${d.title}»`, 'ok');
  };
  if (!needT && !canOut) return create('', false);
  formModal({
    title: title, fields: [
      ...(needT ? [{ key: 'tid', label: 'المعلمة', type: 'select', full: true, options: [['', '— بدون تحديد —'], ...sortedTeachers().map((t) => [t.id, t.name])] }] : []),
      ...(canOut ? [{ key: 'out', label: 'تسجيله في الصادر وإعطاؤه رقماً', type: 'checkbox', full: true }] : []),
    ],
    values: { tid: preTeacher || '', out: canOut && k !== 'notice' && k !== 'inquiry' },
    onSave: (v) => create(v.tid, v.out),
  });
}
const _docNew = ACTIONS.docNew;
ACTIONS.docNew = (el) => newLetter(el.dataset.id);
VIEWS.letters = {
  actions: () => TOOL_VIEWS.docs.actions(),
  render() {
    const docs = db.documents.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const q = normName(ui.letQ || '');
    const shown = docs.filter((d) => !q || normName(d.title + ' ' + (d.outNumber || '') + ' ' + tName(d.teacherId)).includes(q));
    const d = curDoc();
    const cat = ui.letCat || 'letter';
    return `<div class="designer">
      <div class="card d-side">
        <div class="section-title" style="margin-top:0">إنشاء جديد</div>
        <div class="seg" style="flex-wrap:wrap">${Object.entries(LETTER_CATS).map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-act="letCat" data-id="${k}">${l}</button>`).join('')}</div>
        <div class="tpl-list">${LETTER_TEMPLATES.filter((x) => x[2] === cat).map(([k, l]) => `<button class="btn sm" data-act="docNew" data-id="${k}">＋ ${l}</button>`).join('')}</div>
        <div class="section-title">الأرشيف (${docs.length})</div>
        <input class="input" id="letSearch" placeholder="🔍 بحث بالعنوان أو الرقم أو المعلمة" value="${esc(ui.letQ || '')}">
        ${shown.length ? `<div class="list" style="max-height:46vh;overflow:auto">${shown.map((x) => `<div class="li ${x.id === DOCS.id ? 'sel-row' : ''}"><div class="grow" style="cursor:pointer" data-act="docOpen" data-id="${x.id}"><div class="t">${esc(x.title)}</div><div class="s">${fmtG(x.updatedAt)}${x.outNumber ? ` · صادر ${esc(x.outNumber)}` : ''}</div></div><button class="icon-btn" data-act="docDel" data-id="${x.id}">🗑️</button></div>`).join('')}</div>` : '<div class="muted">لا توجد مستندات</div>'}
      </div>
      <div class="d-main">${d ? docsMain() : `<div class="card">${emptyState('✉️', 'اختاري نوع الخطاب أو النموذج من القائمة لإنشائه، أو افتحي مستنداً من الأرشيف.<br>الخطابات تُصدَّر Word أو تُطبع PDF، ويمكن تسجيلها في الصادر برقم تلقائي.')}</div>`}</div>
    </div>`;
  },
  after() {
    TOOL_VIEWS.docs.mount();
    const s = $('#letSearch'); if (s) s.oninput = () => { ui.letQ = s.value; const pos = s.selectionStart; render(); const n = $('#letSearch'); n.focus(); n.setSelectionRange(pos, pos); };
  },
};
ACTIONS.letCat = (el) => { ui.letCat = el.dataset.id; render(); };

// ═════════════ 📨 الصادر والوارد ═════════════
const CORR_STATUS = { new: ['جديدة', 'blue'], progress: ['قيد الإجراء', 'amber'], done: ['مكتملة', 'green'] };
const hYear = (d = todayISO()) => hParts(parse(d))[0];
function newOutgoing(extra = {}) {
  const y = hYear(), n = db.correspondence.filter((c) => c.kind === 'out' && String(c.number).startsWith(y + '/')).length + 1;
  const c = { id: uid(), kind: 'out', number: `${y}/${n}`, date: todayISO(), party: '', subject: '', action: '', status: 'done', due: '', notes: '', file: null, ...extra };
  db.correspondence.push(c); return c;
}
const corrLate = (c) => c.status !== 'done' && c.due && c.due < todayISO();
VIEWS.mail = {
  actions: () => `<button class="btn" data-act="mailCsv">⬇ تصدير Excel</button><button class="btn" data-act="mailPrint">🖨 طباعة السجل</button><button class="btn" data-act="mailNew" data-id="out">＋ صادر</button><button class="btn primary" data-act="mailNew" data-id="in">＋ وارد</button>`,
  render() {
    const f = ui.mailKind || '', st = ui.mailSt || '', q = normName(ui.mailQ || '');
    const all = db.correspondence;
    let list = all.filter((c) => (!f || c.kind === f) && (!st || (st === 'late' ? corrLate(c) : c.status === st)) && (!q || normName([c.number, c.party, c.subject, c.notes, c.action].join(' ')).includes(q)));
    list.sort((a, b) => b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number), 'ar', { numeric: true }));
    const late = all.filter(corrLate).length;
    return `<div class="toolbar">
      <div class="seg">${[['', `الكل (${all.length})`], ['in', `الوارد (${all.filter((c) => c.kind === 'in').length})`], ['out', `الصادر (${all.filter((c) => c.kind === 'out').length})`]].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="mailKind" data-id="${k}">${l}</button>`).join('')}</div>
      <select class="input" data-change="mailSt"><option value="">كل الحالات</option>${Object.entries(CORR_STATUS).map(([k, [l]]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${l}</option>`).join('')}<option value="late" ${st === 'late' ? 'selected' : ''}>متأخرة (${late})</option></select>
      <span class="spacer"></span><input class="input" id="mailSearch" placeholder="🔍 بحث بالرقم أو الجهة أو الموضوع" value="${esc(ui.mailQ || '')}" style="width:280px"></div>
    <div class="card"><div class="table-wrap">${list.length ? `<table><thead><tr><th>النوع</th><th>الرقم</th><th>التاريخ</th><th>الجهة</th><th>الموضوع</th><th>الإجراء</th><th>الحالة</th><th>مرفق</th><th></th></tr></thead><tbody>
      ${list.map((c) => { const S = CORR_STATUS[c.status] || CORR_STATUS.new; return `<tr>
        <td><span class="chip ${c.kind === 'in' ? 'purple' : 'brand'}">${c.kind === 'in' ? '📥 وارد' : '📤 صادر'}</span></td>
        <td><b dir="ltr">${esc(c.number)}</b></td>
        <td>${fmtH(c.date)}<br><span class="muted">${fmtG(c.date)}</span></td>
        <td>${esc(c.party)}</td><td style="max-width:240px"><b>${esc(c.subject)}</b>${c.notes ? `<div class="muted">${esc(c.notes)}</div>` : ''}</td>
        <td style="max-width:200px">${esc(c.action)}${c.due && c.status !== 'done' ? `<div class="muted">موعد الرد: ${fmtH(c.due)}</div>` : ''}</td>
        <td><span class="chip ${corrLate(c) ? 'red' : S[1]}">${corrLate(c) ? 'متأخرة' : S[0]}</span></td>
        <td>${c.file ? `<button class="icon-btn" data-act="mailFile" data-id="${c.id}" title="${esc(c.file.name)}">${fileIcon(c.file.ext)}</button>` : ''}${c.docId && db.documents.some((d) => d.id === c.docId) ? `<button class="icon-btn" data-act="mailDoc" data-id="${c.docId}" title="فتح الخطاب">✉️</button>` : ''}</td>
        <td class="actions"><button class="icon-btn" data-act="mailEdit" data-id="${c.id}">✏️</button><button class="icon-btn" data-act="mailDel" data-id="${c.id}">🗑️</button></td></tr>`; }).join('')}
      </tbody></table>` : emptyState('📨', all.length ? 'لا توجد معاملات مطابقة' : 'سجل الصادر والوارد فارغ.<br>سجّلي المعاملات الواردة من «＋ وارد»، والصادرة من «＋ صادر» أو من مركز الخطابات (يُعطى الخطاب رقماً تلقائياً).')}</div></div>`;
  },
  after() { const s = $('#mailSearch'); if (s) s.oninput = () => { ui.mailQ = s.value; const p = s.selectionStart; render(); const n = $('#mailSearch'); n.focus(); n.setSelectionRange(p, p); }; },
};
function openCorr(c, kind) {
  const k = c ? c.kind : kind;
  const auto = !c && k === 'out' ? (() => { const y = hYear(), n = db.correspondence.filter((x) => x.kind === 'out' && String(x.number).startsWith(y + '/')).length + 1; return `${y}/${n}`; })() : '';
  formModal({
    title: c ? 'تعديل المعاملة' : k === 'in' ? 'تسجيل معاملة واردة' : 'تسجيل معاملة صادرة', wide: true,
    fields: [
      { key: 'number', label: k === 'in' ? 'رقم المعاملة الواردة' : 'رقم الصادر', type: 'text', required: true, hint: k === 'out' ? 'يُقترح الرقم التالي تلقائياً' : '' },
      { key: 'date', label: 'التاريخ', type: 'date', required: true },
      { key: 'party', label: k === 'in' ? 'الجهة المرسِلة' : 'الجهة المرسَل إليها', type: 'text', full: true, required: true, list: [...new Set(db.correspondence.map((x) => x.party).filter(Boolean))] },
      { key: 'subject', label: 'الموضوع', type: 'text', full: true, required: true, voice: true },
      { key: 'action', label: 'الإجراء المتخذ', type: 'textarea', full: true, rows: 2, voice: true },
      { key: 'status', label: 'الحالة', type: 'select', options: Object.entries(CORR_STATUS).map(([v, [l]]) => [v, l]) },
      { key: 'due', label: 'موعد الرد / الإنجاز (اختياري)', type: 'date' },
      { key: 'notes', label: 'ملاحظات', type: 'text', full: true },
      { key: 'file', label: 'المرفق (PDF أو Word أو صورة)', type: 'file', full: true },
    ],
    values: c || { number: auto, date: todayISO(), status: k === 'in' ? 'new' : 'done' },
    onSave: (v) => {
      if (c) { if (c.file && c.file !== v.file) api.libDelete(c.file); Object.assign(c, v); }
      else db.correspondence.push({ id: uid(), kind: k, ...v });
      if (v.status !== 'done' && v.due && !c) db.tasks.push({ id: uid(), title: `الرد على: ${v.subject}`, due: v.due, priority: 'high', category: 'مراسلات', status: 'todo', notes: `${k === 'in' ? 'وارد' : 'صادر'} رقم ${v.number} — ${v.party}` });
      commit(); toast('تم حفظ المعاملة', 'ok');
    },
  });
}
Object.assign(ACTIONS, {
  mailKind: (el) => { ui.mailKind = el.dataset.id; render(); },
  mailNew: (el) => openCorr(null, el.dataset.id),
  mailEdit: (el) => openCorr(db.correspondence.find((x) => x.id === el.dataset.id)),
  mailDel: (el) => confirmBox('حذف هذه المعاملة من السجل؟', () => { const c = db.correspondence.find((x) => x.id === el.dataset.id); if (c?.file) api.libDelete(c.file); db.correspondence = db.correspondence.filter((x) => x.id !== el.dataset.id); commit(); }),
  mailFile: async (el) => { const c = db.correspondence.find((x) => x.id === el.dataset.id); if (c?.file) { const r = await api.libOpen(c.file); if (r) toast('تعذّر فتح الملف: ' + r, 'err'); } },
  mailDoc: (el) => { DOCS.id = el.dataset.id; go('letters'); },
  mailCsv: async () => {
    const rows = [['النوع', 'الرقم', 'التاريخ الهجري', 'التاريخ الميلادي', 'الجهة', 'الموضوع', 'الإجراء', 'الحالة', 'موعد الرد', 'ملاحظات'],
      ...db.correspondence.slice().sort((a, b) => a.date.localeCompare(b.date)).map((c) => [c.kind === 'in' ? 'وارد' : 'صادر', c.number, hijriStr(c.date), c.date, c.party, c.subject, c.action || '', (CORR_STATUS[c.status] || CORR_STATUS.new)[0], c.due || '', c.notes || ''])];
    openBlob(await buildXlsx(rows, [8, 12, 14, 12, 26, 36, 30, 12, 12, 24]), 'سجل-الصادر-والوارد.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok');
  },
  mailPrint: () => {
    const list = db.correspondence.filter((c) => !ui.mailKind || c.kind === ui.mailKind).sort((a, b) => a.date.localeCompare(b.date));
    printDoc(ui.mailKind === 'in' ? 'سجل الوارد' : ui.mailKind === 'out' ? 'سجل الصادر' : 'سجل الصادر والوارد', `<table><thead><tr><th>النوع</th><th>الرقم</th><th>التاريخ</th><th>الجهة</th><th>الموضوع</th><th>الإجراء</th><th>الحالة</th></tr></thead><tbody>${list.map((c) => `<tr><td>${c.kind === 'in' ? 'وارد' : 'صادر'}</td><td>${esc(c.number)}</td><td>${fmtH(c.date)}</td><td>${esc(c.party)}</td><td>${esc(c.subject)}</td><td>${esc(c.action || '')}</td><td>${(CORR_STATUS[c.status] || CORR_STATUS.new)[0]}</td></tr>`).join('')}</tbody></table>`);
  },
});
CHANGES.mailSt = (el) => { ui.mailSt = el.value; render(); };
addHook('dashCards', (t) => {
  const pend = db.correspondence.filter((c) => c.status !== 'done' && (corrLate(c) || (c.due && c.due <= addDays(t, 2)) || c.status === 'new'));
  if (!pend.length) return '';
  return `<div class="card"><h3>📨 معاملات تحتاج إجراء <span class="more"><button class="btn sm ghost" data-act="nav" data-id="mail">السجل</button></span></h3>
    <div class="list">${pend.slice(0, 5).map((c) => `<div class="li"><div class="grow"><div class="t">${esc(c.subject)}</div><div class="s">${c.kind === 'in' ? 'وارد' : 'صادر'} ${esc(c.number)} · ${esc(c.party)}${c.due ? ` · الرد قبل ${fmtH(c.due)}` : ''}</div></div><span class="chip ${corrLate(c) ? 'red' : (CORR_STATUS[c.status] || CORR_STATUS.new)[1]}">${corrLate(c) ? 'متأخرة' : (CORR_STATUS[c.status] || CORR_STATUS.new)[0]}</span></div>`).join('')}</div></div>`;
});

// ═════════════ 👤 الملف الموحد للمعلمة ═════════════
function teacherFile(tid) {
  const t = teacher(tid); if (!t) return null;
  const [ys, ye] = yearRange();
  const abs = db.absences.filter((a) => a.teacherId === tid && (a.dateTo || a.date) >= ys && a.date <= ye).sort((a, b) => b.date.localeCompare(a.date));
  const isShort = (a) => /تأخر|خروج/.test(a.type);
  const absDays = abs.filter((a) => !isShort(a)).reduce((n, a) => n + clipDays(a, ys, ye), 0);
  const byType = {}; abs.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + (isShort(a) ? 1 : clipDays(a, ys, ye)); });
  const ent = db.classEntries.filter((e) => e.teacherId === tid && e.date >= ys && e.date <= ye);
  const ec = Object.fromEntries(Object.keys(ENTRY_STATUS).map((k) => [k, ent.filter((e) => e.status === k).length]));
  const thanks = ent.filter((e) => e.emailed).sort((a, b) => b.date.localeCompare(a.date));
  const tt = db.timetable.filter((x) => x.teacherId === tid);
  const duties = []; WEEKDAYS.forEach((d) => db.duties.types.forEach((ty) => { if ((db.duties.roster[d]?.[ty.id] || []).includes(tid)) duties.push(`${TT_DAYS[d]}: ${ty.name}`); }));
  const md = { present: 0, late: 0, absent: 0, excused: 0 };
  Object.entries(db.morningLog || {}).filter(([k]) => k >= ys && k <= ye).forEach(([, v]) => { const r = v[tid]; if (r && md[r.status] !== undefined) md[r.status]++; });
  const nm = normName(t.name);
  const docs = db.documents.filter((d) => d.teacherId === tid || normName(d.title).includes(nm));
  const designs = (db.designs || []).filter((d) => (d.data?.objs || []).some((o) => o.t === 'text' && normName(o.text).includes(nm)));
  return { t, ys, ye, abs, absDays, byType, ent, ec, thanks, tt, duties, md, docs, designs, bal: balances(tid) };
}
VIEWS.teacher = {
  actions: () => `<button class="btn" data-act="nav" data-id="teachers">→ المعلمات</button><button class="btn" data-act="tpPrint">🖨 طباعة الملف</button><button class="btn" data-act="tpLetter">✉️ خطاب / نموذج</button><button class="btn primary" data-act="tpCert">🏅 شهادة شكر</button>`,
  render() {
    const F = teacherFile(ui.teacherId);
    if (!F) return `<div class="card">${emptyState('👤', 'اختاري معلمة من قائمة المعلمات')}</div>`;
    const { t } = F, wa = waNumber(t.phone);
    const stat = (n, l, c = '') => `<div class="card stat"><span class="n" ${c ? `style="color:${c}"` : ''}>${n}</span><span class="l">${l}</span></div>`;
    return `<div class="card tp-head"><div class="tp-avatar">${esc(t.name.trim()[0] || '؟')}</div><div class="grow"><div class="tp-name">${esc(t.name)}</div>
        <div class="muted">${esc(t.subject || 'بدون تخصص')}${t.phone ? ` · <span dir="ltr">${esc(t.phone)}</span>` : ''}${t.email ? ` · <span dir="ltr">${esc(t.email)}</span>` : ''}</div>
        <div class="muted" style="font-size:12px">العام الدراسي منذ ${fmtH(F.ys)} (${fmtG(F.ys)})</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${wa ? `<button class="btn sm" data-act="openUrl" data-id="https://wa.me/${wa}">💬 واتساب</button>` : ''}${t.email ? `<button class="btn sm" data-act="openUrl" data-id="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.email)}">📧 بريد</button>` : ''}<button class="btn sm" data-act="teacherEdit" data-id="${t.id}">✏️ تعديل</button></div></div>
      <div class="grid g4" style="margin:16px 0">${stat(F.absDays, 'أيام غياب وإجازات', F.absDays ? 'var(--red)' : '')}${stat(F.abs.filter((a) => /تأخر|خروج/.test(a.type)).length, 'تأخر وخروج')}${stat(F.ec.early, 'حضور مبكر للحصص', 'var(--green)')}${stat(F.thanks.length, 'رسائل شكر')}</div>
      <div class="grid g2" style="align-items:start">
        <div class="card"><h3>📋 الغياب والإجازات</h3>${F.abs.length ? `<div class="muted" style="margin-bottom:8px">${Object.entries(F.byType).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ')}</div><div class="list">${F.abs.slice(0, 10).map((a) => `<div class="li"><div class="grow"><div class="t">${esc(a.type)}</div><div class="s">${fmtH(a.date)}${a.dateTo && a.dateTo !== a.date ? ` ← ${fmtH(a.dateTo)}` : ''}${a.notes ? ' · ' + esc(a.notes) : ''}</div></div>${a.faris ? '<span class="chip green">فارس ✓</span>' : '<span class="chip amber">لم يُدخل في فارس</span>'}</div>`).join('')}</div>` : emptyState('🌿', 'لا يوجد غياب هذا العام')}</div>
        <div class="card"><h3>⚖️ الأرصدة</h3>${F.bal.length ? F.bal.map((x) => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(x.type)}</span><b style="color:${x.left < 0 ? 'var(--red)' : x.left <= 1 ? 'var(--amber)' : 'inherit'}">${x.used} من ${x.lim} (المتبقي ${Math.max(0, x.left)})</b></div><div class="progress"><div style="width:${Math.min(100, (x.used / x.lim) * 100)}%;background:${x.left < 0 ? 'var(--red)' : x.left <= 1 ? '#f0b429' : 'var(--brand)'}"></div></div></div>`).join('') : '<div class="muted">لم تُحدَّد أرصدة — من الإعدادات ← أرصدة الإجازات</div>'}</div>
        <div class="card"><h3>🚪 متابعة دخول الحصص</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(ENTRY_STATUS).map(([k, s]) => `<span class="chip ${s.cls}">${s.label}: ${F.ec[k]}</span>`).join('')}</div>
          ${F.thanks.length ? `<div class="section-title" style="margin:12px 0 6px">💌 رسائل الشكر</div><div class="muted">${F.thanks.slice(0, 8).map((e) => `${fmtH(e.date)}${e.thanksVia === 'wa' ? ' 💬' : ' 📧'}`).join(' · ')}</div>` : ''}</div>
        <div class="card"><h3>🗓️ الحصص والتكليفات</h3><div class="muted">النصاب: <b>${F.tt.length}</b> حصة أسبوعياً${F.tt.length ? ` · الفصول: ${esc([...new Set(F.tt.map((x) => x.className))].sort(classSort).join('، '))}` : ''}</div>
          ${F.duties.length ? `<div class="section-title" style="margin:12px 0 6px">🧭 الإشراف والمناوبة</div><div class="duty-load">${F.duties.map((d) => `<span class="chip brand">${esc(d)}</span>`).join('')}</div>` : '<div class="muted" style="margin-top:8px">لا توجد تكليفات إشراف</div>'}
          ${Object.values(F.md).some(Boolean) ? `<div class="section-title" style="margin:12px 0 6px">☀️ المناوبة الصباحية</div><div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(MD_STATUS).map(([k, [l, c]]) => `<span class="chip ${c}">${l}: ${F.md[k]}</span>`).join('')}</div>` : ''}</div>
        <div class="card" style="grid-column:1/-1"><h3>🏅 الشهادات والخطابات</h3>${F.docs.length || F.designs.length ? `<div class="list">${F.docs.map((d) => `<div class="li"><span>✉️</span><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">${fmtG(d.updatedAt)}${d.outNumber ? ` · صادر ${esc(d.outNumber)}` : ''}</div></div><button class="btn sm" data-act="mailDoc" data-id="${d.id}">فتح</button></div>`).join('')}${F.designs.map((d) => `<div class="li"><span>🎨</span><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${fmtG(d.updatedAt)}</div></div><button class="btn sm" data-act="tpDesign" data-id="${d.id}">فتح</button></div>`).join('')}</div>` : '<div class="muted">لا توجد شهادات أو خطابات مرتبطة بها بعد</div>'}</div>
      </div>`;
  },
  after() { const t = teacher(ui.teacherId); if (t) $('#pageTitle').textContent = `👤 ${t.name}`; },
};
Object.assign(ACTIONS, {
  tProfile: (el) => { ui.teacherId = el.dataset.id; go('teacher'); },
  tpCert: () => { const t = teacher(ui.teacherId); DS.teacherName = t.name; DS.tpl = 'cert'; const x = dTemplate('cert'); DS.bg = x.bg; DS.objs = x.objs; DS.sel = null; DS.id = null; DS.name = `شهادة شكر — ${t.name}`; ui.tool = 'designer'; go('tools'); toast('جُهّزت شهادة باسمها — اختاري القالب واللون ثم احفظيها', 'ok'); },
  tpDesign: (el) => { ui.tool = 'designer'; go('tools'); ACTIONS.dLoad(el); },
  tpLetter: () => {
    const tid = ui.teacherId;
    formModal({ title: `خطاب أو نموذج — ${tName(tid)}`, fields: [{ key: 'k', label: 'النوع', type: 'select', full: true, options: LETTER_TEMPLATES.filter(([k]) => docTemplate(k)[1].includes('{{T}}')).map(([k, l]) => [k, l]) }],
      values: { k: 'thanks' }, onSave: (v) => { go('letters'); setTimeout(() => newLetter(v.k, tid), 30); } });
  },
  tpPrint: () => {
    const F = teacherFile(ui.teacherId); if (!F) return;
    printDoc(`الملف الإداري للمعلمة — ${F.t.name}`, `<table><tbody><tr><th style="width:150px">الاسم</th><td>${esc(F.t.name)}</td><th style="width:110px">التخصص</th><td>${esc(F.t.subject || '')}</td></tr><tr><th>الجوال</th><td>${esc(F.t.phone || '')}</td><th>البريد</th><td>${esc(F.t.email || '')}</td></tr><tr><th>النصاب</th><td>${F.tt.length} حصة</td><th>العام منذ</th><td>${fmtH(F.ys)}</td></tr></tbody></table>
      <h3>الغياب والإجازات (${F.absDays} يوم)</h3><table><thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>ملاحظات</th></tr></thead><tbody>${F.abs.map((a) => `<tr><td>${esc(a.type)}</td><td>${fmtH(a.date)}</td><td>${a.dateTo ? fmtH(a.dateTo) : '—'}</td><td>${esc(a.notes || '')}</td></tr>`).join('') || '<tr><td colspan="4">لا يوجد</td></tr>'}</tbody></table>
      ${F.bal.length ? `<h3>الأرصدة</h3><table><tbody>${F.bal.map((x) => `<tr><td>${esc(x.type)}</td><td>المستخدم ${x.used} من ${x.lim}</td><td>المتبقي ${Math.max(0, x.left)}</td></tr>`).join('')}</tbody></table>` : ''}
      <h3>متابعة دخول الحصص</h3><table><tbody><tr>${Object.entries(ENTRY_STATUS).map(([k, s]) => `<td>${s.label}: ${F.ec[k]}</td>`).join('')}</tr></tbody></table>
      ${F.duties.length ? `<h3>التكليفات</h3><p>${F.duties.map(esc).join(' — ')}</p>` : ''}
      ${F.thanks.length || F.docs.length ? `<h3>الشكر والخطابات</h3><p>رسائل شكر: ${F.thanks.length}${F.docs.length ? ' — ' + F.docs.map((d) => esc(d.title)).join('، ') : ''}</p>` : ''}`);
  },
});
