// ═════════════ 🧩 أقسامي — أقسام تنشئها المستخدمة بنفسها (1.0.6) ═════════════
// تحدد اسم القسم وأيقونته وحقوله، فيظهر قسم كامل: إضافة وتعديل وبحث واستيراد/تصدير Excel ورسوم بيانية.

addHook('beforeStart', () => { if (!Array.isArray(db.customSections)) db.customSections = []; });
NAV_TREE.splice(NAV_TREE.findIndex((x) => x.id === 'settings'), 0, { group: 'custom', ic: '🧩', label: 'أقسامي', items: [] });
const CS_TYPES = [['text', 'نص قصير'], ['longtext', 'نص طويل'], ['number', 'رقم'], ['date', 'تاريخ'], ['select', 'قائمة اختيارات'], ['phone', 'جوال'], ['email', 'بريد'], ['check', 'نعم / لا'], ['file', 'ملف مرفق']];
const CS_ICONS = ['📁', '📦', '🛠️', '🏆', '📚', '🧾', '🎯', '🤝', '🩺', '🚌', '🍎', '💡', '📌', '🗳️', '🎨', '💰'];
const CS_TPL = [
  ['عهد المدرسة', '📦', [['البند', 'text'], ['الكمية', 'number'], ['المستلمة', 'text'], ['تاريخ الاستلام', 'date'], ['الحالة', 'select', 'جيدة، تحتاج صيانة، تالفة'], ['ملاحظات', 'longtext']]],
  ['طلبات الصيانة', '🛠️', [['الموقع', 'text'], ['وصف العطل', 'longtext'], ['تاريخ الطلب', 'date'], ['الأولوية', 'select', 'عاجلة، متوسطة، عادية'], ['الحالة', 'select', 'جديد، قيد التنفيذ، منجز'], ['صورة', 'file']]],
  ['المسابقات', '🏆', [['المسابقة', 'text'], ['الجهة', 'text'], ['التاريخ', 'date'], ['المشاركات', 'number'], ['النتيجة', 'select', 'مشاركة، مركز ثالث، مركز ثاني، مركز أول'], ['ملف', 'file']]],
  ['زيارات أولياء الأمور', '🤝', [['ولي الأمر', 'text'], ['الطالبة', 'text'], ['التاريخ', 'date'], ['سبب الزيارة', 'select', 'متابعة مستوى، سلوك، غياب، أخرى'], ['الجوال', 'phone'], ['الإجراء', 'longtext']]],
];
const CS = { edit: null, q: {} };
const csSec = (id) => db.customSections.find((s) => s.id === id);
const csFmt = (f, v) => (v == null || v === '' ? '' : f.type === 'date' ? fmtH(v) : f.type === 'check' ? (v ? '✔️' : '') : f.type === 'file' ? (v?.name ? '📎 ' + v.name : '') : String(v));
let _csSig = null;
function csSyncNav() {
  const secs = db?.customSections || [], sig = secs.map((s) => s.id + s.name + s.icon).join('|');
  if (sig === _csSig) return; _csSig = sig;
  const g = NAV_TREE.find((x) => x.group === 'custom');
  g.items = [...secs.map((s) => ({ id: 'cs_' + s.id, ic: s.icon || '📁', label: s.name })), { id: 'csManage', ic: '⚙️', label: secs.length ? 'إدارة أقسامي' : 'إنشاء قسم جديد' }];
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
  secs.forEach((s) => (VIEWS['cs_' + s.id] = csView(s.id)));
}
const _csRender = render;
render = function () { csSyncNav(); if (/^cs_/.test(ui.view) && !VIEWS[ui.view]) ui.view = 'csManage'; _csRender(); };

// ───── صفحة القسم ─────
function csRows(s) {
  const q = normName(CS.q[s.id] || '');
  return s.records.filter((r) => !q || normName(s.fields.map((f) => csFmt(f, r.values[f.id])).join(' ')).includes(q)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
function csView(id) {
  return {
    actions: () => `<button class="btn" data-act="csChart" data-id="${id}">📊 رسم بياني</button><button class="btn" data-act="csXlsxOut" data-id="${id}">⬇ Excel</button><button class="btn" data-act="csXlsxIn" data-id="${id}">⬆ استيراد</button><button class="btn" data-act="csEdit" data-id="${id}">⚙️ الحقول</button><button class="btn primary" data-act="csAdd" data-id="${id}">＋ إضافة</button>`,
    render() {
      const s = csSec(id); if (!s) return '';
      const cols = s.fields.filter((f) => f.type !== 'longtext').slice(0, 7), rows = csRows(s);
      const nums = cols.filter((f) => f.type === 'number');
      return `<div class="toolbar"><input class="input" id="csSearch" data-id="${id}" placeholder="🔍 بحث في ${esc(s.name)}" value="${esc(CS.q[id] || '')}" style="max-width:320px"><span class="spacer" style="flex:1"></span><span class="muted">${rows.length} سجل</span></div>
        ${s.records.length ? `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead><tbody>
          ${rows.map((r) => `<tr>${cols.map((f, i) => { const v = r.values[f.id]; return `<td ${['phone', 'email', 'number'].includes(f.type) ? 'dir="ltr" style="text-align:right"' : ''}>${f.type === 'file' && v?.stored ? `<a href="#" class="link" data-act="csFile" data-id="${r.id}" data-f="${f.id}" data-s="${id}">${esc(csFmt(f, v))}</a>` : f.type === 'select' && v ? `<span class="chip">${esc(v)}</span>` : i === 0 ? `<b>${esc(csFmt(f, v))}</b>` : esc(csFmt(f, v))}</td>`; }).join('')}
            <td class="actions"><button class="icon-btn" data-act="csRec" data-id="${r.id}" data-s="${id}">✏️</button><button class="icon-btn" data-act="csDel" data-id="${r.id}" data-s="${id}">🗑️</button></td></tr>`).join('')}
          </tbody>${nums.length ? `<tfoot><tr>${cols.map((f, i) => `<td><b>${f.type === 'number' ? stFmt(rows.reduce((a, r) => a + (stNum(r.values[f.id]) || 0), 0)) : i === 0 ? 'المجموع' : ''}</b></td>`).join('')}<td></td></tr></tfoot>` : ''}</table></div>`
          : `<div class="card">${emptyState(s.icon || '📁', `لا توجد سجلات في «${esc(s.name)}» بعد.`)}<div style="text-align:center;margin-top:12px"><button class="btn primary" data-act="csAdd" data-id="${id}">＋ إضافة أول سجل</button></div></div>`}`;
    },
    after() { const s = csSec(id); if (s) $('#pageTitle').textContent = `${s.icon || '📁'} ${s.name}`; },
  };
}
function csRecordForm(s, r) {
  formModal({
    title: `${s.icon || '📁'} ${r ? 'تعديل' : 'إضافة'} — ${s.name}`, wide: s.fields.length > 4,
    fields: s.fields.map((f) => ({ key: f.id, label: f.label, required: !!f.req, full: ['longtext', 'file'].includes(f.type),
      type: { longtext: 'textarea', phone: 'tel', check: 'checkbox' }[f.type] || f.type,
      ...(f.type === 'select' ? { options: ['', ...String(f.options || '').split(/[،,]\s*/).map((x) => x.trim()).filter(Boolean)] } : {}),
      ...(f.type === 'text' ? { list: [...new Set(s.records.map((x) => x.values[f.id]).filter(Boolean))].slice(0, 50) } : {}) })),
    values: r ? { ...r.values } : {},
    onSave: (v) => { if (r) r.values = v; else s.records.push({ id: uid(), values: v, createdAt: new Date().toISOString() }); commit(); toast('حُفظ', 'ok'); },
  });
}

// ───── إدارة الأقسام ─────
VIEWS.csManage = {
  actions: () => `<button class="btn primary" data-act="csNew">＋ قسم جديد</button>`,
  render() {
    const secs = db.customSections;
    return `<div class="card"><h3>🧩 أقسامي</h3><div class="muted" style="margin-bottom:12px">أنشئي قسماً لأي عمل تحتاجين متابعته، واختاري حقوله بنفسكِ. يظهر القسم في القائمة الجانبية تحت «أقسامي»، ويُحفظ ويُزامن مع بقية البيانات.</div>
      ${secs.length ? `<div class="list">${secs.map((s) => `<div class="li"><span style="font-size:22px">${s.icon || '📁'}</span><div class="grow"><a href="#" class="link t" data-act="nav" data-id="cs_${s.id}">${esc(s.name)}</a><div class="s">${s.fields.length} حقول · ${s.records.length} سجل</div></div><button class="btn sm" data-act="csEdit" data-id="${s.id}">⚙️ الحقول</button><button class="icon-btn" data-act="csSecDel" data-id="${s.id}">🗑️</button></div>`).join('')}</div>` : ''}</div>
      <div class="card" style="margin-top:14px"><h3>⚡ ابدئي من نموذج جاهز</h3><div class="pr-kinds">${CS_TPL.map(([n, ic, f], i) => `<button class="pr-kind" data-act="csTpl" data-id="${i}"><span>${ic}</span><b>${n}</b><small>${f.map((x) => x[0]).join('، ')}</small></button>`).join('')}
        <button class="pr-kind" data-act="csNew"><span>✨</span><b>قسم فارغ</b><small>تختارين اسمه وحقوله من البداية</small></button></div></div>`;
  },
};
function csEditor() {
  const E = CS.edit;
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>${E.id ? '⚙️ تعديل القسم' : '🧩 قسم جديد'}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">
      <div class="form"><div class="field"><label>اسم القسم <span style="color:var(--red)">*</span></label><input class="input" data-cse="name" value="${esc(E.name)}" placeholder="مثال: طلبات الصيانة"></div>
        <div class="field"><label>الأيقونة</label><div class="cs-icons">${CS_ICONS.map((ic) => `<button type="button" class="${E.icon === ic ? 'on' : ''}" data-act="csIcon" data-id="${ic}">${ic}</button>`).join('')}</div></div></div>
      <div class="section-title">الحقول</div>
      <div class="cs-fields">${E.fields.map((f, i) => `<div class="cs-field">
        <span class="muted">${i + 1}</span>
        <input class="input" data-csf="${i}" data-k="label" value="${esc(f.label)}" placeholder="اسم الحقل">
        <select class="input" data-csf="${i}" data-k="type">${CS_TYPES.map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${f.type === 'select' ? `<input class="input" data-csf="${i}" data-k="options" value="${esc(f.options || '')}" placeholder="الخيارات مفصولة بفاصلة">` : '<span></span>'}
        <label class="cs-req" title="حقل إلزامي"><input type="checkbox" data-csf="${i}" data-k="req" ${f.req ? 'checked' : ''}> إلزامي</label>
        <button type="button" class="icon-btn" data-act="csFMove" data-id="${i}" data-d="-1">▲</button><button type="button" class="icon-btn" data-act="csFMove" data-id="${i}" data-d="1">▼</button><button type="button" class="icon-btn" data-act="csFDel" data-id="${i}">🗑️</button></div>`).join('')}</div>
      <button type="button" class="btn sm" data-act="csFAdd" style="margin-top:8px">＋ حقل</button>
      <div class="muted" style="margin-top:10px;font-size:12.5px">الحقل الأول يظهر عنواناً لكل سجل. تغيير اسم حقل أو نوعه لا يحذف البيانات المدخلة.</div></div>
    <div class="modal-f"><button class="btn primary" data-act="csSave">حفظ القسم</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = { csEdit: true };
}
const csNewField = (label = '', type = 'text', options = '') => ({ id: uid(), label, type, options, req: false });
Object.assign(ACTIONS, {
  csNew: () => { CS.edit = { name: '', icon: '📁', fields: [csNewField('العنوان'), csNewField('التاريخ', 'date'), csNewField('ملاحظات', 'longtext')] }; csEditor(); },
  csTpl: (el) => { const [n, ic, f] = CS_TPL[+el.dataset.id]; CS.edit = { name: n, icon: ic, fields: f.map(([l, t, o]) => csNewField(l, t, o || '')) }; csEditor(); },
  csEdit: (el) => { const s = csSec(el.dataset.id); CS.edit = JSON.parse(JSON.stringify({ id: s.id, name: s.name, icon: s.icon, fields: s.fields })); csEditor(); },
  csIcon: (el) => { CS.edit.icon = el.dataset.id; csEditor(); },
  csFAdd: () => { CS.edit.fields.push(csNewField()); csEditor(); setTimeout(() => $$('.cs-field input[data-k=label]').pop()?.focus(), 30); },
  csFDel: (el) => { CS.edit.fields.splice(+el.dataset.id, 1); csEditor(); },
  csFMove: (el) => { const F = CS.edit.fields, i = +el.dataset.id, j = i + +el.dataset.d; if (j < 0 || j >= F.length) return; [F[i], F[j]] = [F[j], F[i]]; csEditor(); },
  csSave: () => {
    const E = CS.edit; E.name = E.name.trim(); E.fields = E.fields.filter((f) => f.label.trim());
    if (!E.name) return toast('اكتبي اسم القسم', 'err');
    if (!E.fields.length) return toast('أضيفي حقلاً واحداً على الأقل', 'err');
    let s = E.id && csSec(E.id);
    if (s) Object.assign(s, { name: E.name, icon: E.icon, fields: E.fields });
    else { s = { id: uid(), name: E.name, icon: E.icon, fields: E.fields, records: [], createdAt: new Date().toISOString() }; db.customSections.push(s); }
    closeModal(); ui.view = 'cs_' + s.id; commit(); toast(`القسم «${s.name}» جاهز في القائمة تحت «أقسامي»`, 'ok');
  },
  csSecDel: (el) => { const s = csSec(el.dataset.id); confirmBox(`حذف القسم «${s.name}» وكل سجلاته (${s.records.length})؟ لا يمكن التراجع.`, () => { s.records.forEach((r) => s.fields.forEach((f) => { if (f.type === 'file' && r.values[f.id]?.stored) api.libDelete(r.values[f.id]); })); db.customSections = db.customSections.filter((x) => x !== s); commit(); }); },
  csAdd: (el) => csRecordForm(csSec(el.dataset.id), null),
  csRec: (el) => { const s = csSec(el.dataset.s); csRecordForm(s, s.records.find((r) => r.id === el.dataset.id)); },
  csDel: (el) => { const s = csSec(el.dataset.s); confirmBox('حذف هذا السجل؟', () => { const r = s.records.find((x) => x.id === el.dataset.id); s.fields.forEach((f) => { if (f.type === 'file' && r.values[f.id]?.stored) api.libDelete(r.values[f.id]); }); s.records = s.records.filter((x) => x !== r); commit(); }); },
  csFile: async (el, e) => { e?.preventDefault(); const s = csSec(el.dataset.s), r = s.records.find((x) => x.id === el.dataset.id); const att = r?.values[el.dataset.f]; if (!att) return; const err = await api.libOpen(att); if (err) toast('تعذّر فتح الملف: ' + err, 'err'); },
  csXlsxOut: async (el) => { const s = csSec(el.dataset.id); const rows = [s.fields.map((f) => f.label), ...csRows(s).map((r) => s.fields.map((f) => { const v = r.values[f.id]; return f.type === 'number' && stNum(v) != null ? stNum(v) : f.type === 'date' && v ? `${v} (${fmtH(v)})` : csFmt(f, v); }))]; openBlob(await buildXlsx(rows, s.fields.map((f) => (f.type === 'longtext' ? 40 : 18)), s.name), stSafeName(s.name) + '.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok'); },
  csXlsxIn: async (el) => {
    const s = csSec(el.dataset.id); const [f] = await pickFiles('.xlsx,.csv'); if (!f) return;
    try {
      const wb = await readWorkbook(f); const rows = wb[0]?.rows || []; if (rows.length < 2) return toast('الملف لا يحتوي على بيانات', 'err');
      const head = rows[0].map((h) => normName(String(h)));
      const idx = s.fields.map((fl) => head.findIndex((h) => h && (h === normName(fl.label) || h.includes(normName(fl.label)) || normName(fl.label).includes(h))));
      if (idx.every((i) => i < 0)) return toast('لم تتطابق عناوين أعمدة الملف مع حقول القسم. صدّري Excel من القسم أولاً لتري العناوين المطلوبة.', 'err');
      const toISO = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); if (m) return m[0]; const n = Number(v); if (n > 20000 && n < 80000) return iso(new Date(Math.round((n - 25569) * 864e5))); return parseAnyDate ? parseAnyDate(v) || '' : ''; };
      let n = 0;
      rows.slice(1).forEach((r) => { const v = {}; s.fields.forEach((fl, k) => { if (idx[k] < 0 || fl.type === 'file') return; let x = String(r[idx[k]] ?? '').trim(); if (fl.type === 'date' && x) x = toISO(x); if (fl.type === 'check') x = /^(نعم|1|true|✔|✓|x)$/i.test(x); v[fl.id] = x; }); if (Object.values(v).some((x) => x)) { s.records.push({ id: uid(), values: v, createdAt: new Date().toISOString() }); n++; } });
      commit(); toast(`استُورد ${n} سجل`, 'ok');
    } catch (e) { toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
  },
  csChart: (el) => {
    const s = csSec(el.dataset.id), groups = s.fields.filter((f) => ['select', 'text', 'check'].includes(f.type)), nums = s.fields.filter((f) => f.type === 'number');
    if (!groups.length || !s.records.length) return toast('يحتاج الرسم حقلاً من نوع «قائمة اختيارات» أو «نص» وسجلات مدخلة');
    formModal({ title: '📊 رسم بياني من القسم', fields: [
      { key: 'g', label: 'التجميع حسب', type: 'select', options: groups.map((f) => [f.id, f.label]) },
      { key: 'v', label: 'القيمة', type: 'select', options: [['', 'عدد السجلات'], ...nums.map((f) => [f.id, 'مجموع ' + f.label])] }],
      values: { g: (groups.find((f) => f.type === 'select') || groups[0]).id }, onSave: (v) => {
        const gf = s.fields.find((f) => f.id === v.g), vf = s.fields.find((f) => f.id === v.v), m = {};
        s.records.forEach((r) => { const k = csFmt(gf, r.values[gf.id]) || 'غير محدد'; m[k] = (m[k] || 0) + (vf ? stNum(r.values[vf.id]) || 0 : 1); });
        const title = `${s.name} — ${vf ? 'مجموع ' + vf.label : 'العدد'} حسب ${gf.label}`;
        stAddSheet(title, [[gf.label, vf ? vf.label : 'العدد'], ...Object.entries(m).sort((a, b) => b[1] - a[1])], Object.keys(m).length <= 6 ? 'doughnut' : 'bar', 'app');
        go('stats'); commit(); toast('أُنشئ الرسم في «الجداول والإحصائيات»', 'ok');
      } });
  },
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset?.cse && CS.edit) CS.edit[el.dataset.cse] = el.value;
  if (el.dataset?.csf != null && CS.edit) { const f = CS.edit.fields[+el.dataset.csf]; if (f) f[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }
  if (el.id === 'csSearch') { clearTimeout(CS.t); CS.t = setTimeout(() => { CS.q[el.dataset.id] = el.value; const pos = el.selectionStart; render(); const n = $('#csSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.csf != null && CS.edit) { const f = CS.edit.fields[+el.dataset.csf]; if (f) { f[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.k === 'type') csEditor(); } }
});
