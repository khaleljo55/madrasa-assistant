// ═════════════ 📝 الاستبيانات: إنشاء، وجمع، وإضافة مباشرة لمكانها (1.9.0) ═════════════
// تنشئ الأستاذة استبياناً (من قالب أو فارغاً)، وتحدّد لكل سؤال «أين تُحفظ إجابته» (اسم المعلمة، جوالها…).
// يُوزَّع برابط عام (لأي شخص معه الرابط) أو عبر تطبيقي التواصل، ثم تُضاف الإجابات بضغطة إلى «المعلمات» أو «الطالبات»
// (تحديث الموجودة بالاسم أو البريد أو الجوال أو الهوية، وإضافة الجديدة). الإجابات في قاعدة الخادم (D1).
const SV = { list: [], at: 0, loading: false, err: '', cur: null, resp: [], draft: null };
const SURVEY_BASE = BRAND.pages + 'survey/';
const SV_TARGETS = {
  teacher: { label: '👩‍🏫 المعلمات', fields: [['name', 'اسم المعلمة'], ['subject', 'التخصص'], ['phone', 'الجوال'], ['email', 'البريد الإلكتروني']] },
  student: { label: '🎒 الطالبات', fields: STU_FIELDS.map(([k, l]) => [k, l]) },
};
const SV_TYPES = [['text', 'نص قصير'], ['textarea', 'نص طويل'], ['email', 'بريد إلكتروني'], ['tel', 'رقم جوال'], ['number', 'رقم'], ['date', 'تاريخ'], ['select', 'اختيار من قائمة']];
const SV_TPL = {
  teacher: { title: 'استبيان بيانات المعلمات', intro: 'نرجو تعبئة بياناتكِ لتحديث سجلات المدرسة.', target: 'teacher', fields: [
    { label: 'الاسم الكامل', type: 'text', required: true, map: 'name' }, { label: 'التخصص', type: 'text', map: 'subject' },
    { label: 'رقم الجوال', type: 'tel', required: true, map: 'phone' }, { label: 'البريد الإلكتروني', type: 'email', map: 'email' }] },
  student: { title: 'استبيان بيانات الطالبات', intro: 'نرجو من ولية الأمر تعبئة بيانات الطالبة.', target: 'student', fields: [
    { label: 'اسم الطالبة الرباعي', type: 'text', required: true, map: 'name' }, { label: 'الصف', type: 'select', options: ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'], map: 'grade' },
    { label: 'الفصل', type: 'text', map: 'cls' }, { label: 'رقم الهوية', type: 'number', map: 'idNo' }, { label: 'اسم ولي الأمر', type: 'text', map: 'guardian' },
    { label: 'جوال ولي الأمر', type: 'tel', required: true, map: 'guardianPhone' }, { label: 'بريد ولي الأمر', type: 'email', map: 'guardianEmail' }] },
  blank: { title: '', intro: '', target: '', fields: [{ label: '', type: 'text' }] },
};
const svLink = (s) => {
  const base = brandLink('survey');
  return `${base}#s=${RELAY.id}&q=${s.id}&k=${s.pkey}&r=${encodeURIComponent(RELAY.cfg.url)}&n=${encodeURIComponent(db.settings.schoolName || '')}`;
};
async function svLoad(force) {
  if (!cmReady() || SV.loading || (!force && Date.now() - SV.at < 15000)) return;
  SV.loading = true;
  try { SV.list = (await cmApi('surveys')).items || []; if (SV.cur) { const r = await cmApi('surveys/' + SV.cur.id); SV.cur = { ...SV.cur, ...r.survey }; SV.resp = r.items || []; } SV.err = ''; }
  catch (e) { SV.err = e.message; }
  SV.at = Date.now(); SV.loading = false;
  if (ui.view === 'surveys') render();
}
const svFieldMap = (S) => Object.fromEntries((S.fields || []).filter((f) => f.map).map((f) => [f.map, f.id]));
// السجل المطابق في البرنامج لإجابة ما
function svMatch(S, data) {
  const m = svFieldMap(S), g = (k) => String(data[m[k]] || '').trim();
  const digits = (x) => String(x || '').replace(/\D/g, '').slice(-9);
  if (S.target === 'teacher') {
    const em = g('email').toLowerCase(), ph = digits(g('phone')), nm = normName(g('name'));
    return db.teachers.find((t) => (em && String(t.email || '').toLowerCase() === em) || (ph && digits(t.phone) === ph) || (nm && normName(t.name) === nm));
  }
  if (S.target === 'student') {
    const id = g('idNo'), nm = normName(g('name'));
    return (db.students || []).find((s) => (id && s.idNo === id) || (nm && normName(s.name) === nm));
  }
  return null;
}
function svApply(S, r) {
  const m = svFieldMap(S), v = {};
  Object.entries(m).forEach(([k, fid]) => { const x = String(r.data[fid] || '').trim(); if (x) v[k] = x; });
  if (!v.name) return null;
  const ex = svMatch(S, r.data);
  if (ex) { Object.assign(ex, v); return 'upd'; }
  if (S.target === 'teacher') db.teachers.push({ id: uid(), ...v });
  else { db.students = db.students || []; db.students.push({ id: uid(), ...v, createdAt: todayISO() }); }
  return 'add';
}

NAV.push({ id: 'surveys', ic: '📝', label: 'الاستبيانات', badge: () => SV.list.reduce((a, s) => a + (s.target ? s.fresh : 0), 0) });
VIEWS.surveys = {
  render() {
    if (!cmReady()) return `<div class="card"><h3>📝 الاستبيانات</h3><div class="muted" style="margin-bottom:12px">أنشئي استبياناً، وأرسليه برابط أو عبر تطبيقي التواصل، ثم أضيفي الإجابات مباشرة إلى المعلمات أو الطالبات.</div><div class="banner"><span class="big">🔑</span><div>يعمل بعد الدخول بحساب المدرسة.</div><span class="spacer"></span><button class="btn primary" data-act="acLoginOpen">🔑 تسجيل الدخول</button></div></div>`;
    setTimeout(() => svLoad(false), 0);
    if (SV.draft) return svBuilder();
    if (SV.cur) return svResults();
    const err = SV.err ? `<div class="banner" style="margin-bottom:12px"><span>⚠️</span><div>${esc(SV.err)}</div></div>` : '';
    return `${err}<div class="grid g3" style="margin-bottom:16px">${[['teacher', '👩‍🏫', 'بيانات المعلمات', 'الاسم، التخصص، الجوال، البريد ← تُضاف إلى «المعلمات»'], ['student', '🎒', 'بيانات الطالبات', 'الاسم، الصف، الفصل، الهوية، ولي الأمر ← تُضاف إلى «الطالبات»'], ['blank', '✍️', 'استبيان جديد فارغ', 'أسئلتكِ أنتِ، لأي غرض (رأي، تسجيل في نشاط…)']].map(([k, ic, t, d]) => `<div class="card" style="cursor:pointer" data-act="svNew" data-id="${k}"><div style="font-size:30px">${ic}</div><b>${t}</b><div class="muted" style="font-size:13px">${d}</div></div>`).join('')}</div>
      <div class="card"><h3>📋 استبياناتي</h3>${SV.list.length ? `<div class="list">${SV.list.map((s) => `<div class="li" style="cursor:pointer" data-act="svOpen" data-id="${s.id}"><div class="grow"><div class="t">${esc(s.title)}</div><div class="s">${new Date(s.created).toLocaleDateString('ar-SA-u-nu-latn', { dateStyle: 'medium' })}${s.target ? ' · ← ' + SV_TARGETS[s.target].label : ''}${s.public ? ' · 🔗 رابط عام' : ''}</div></div>${s.open ? '<span class="chip green">مفتوح</span>' : '<span class="chip">مغلق</span>'}<span class="chip brand">${s.n} إجابة</span>${s.target && s.fresh ? `<span class="chip amber">${s.fresh} لم تُضف</span>` : ''}</div>`).join('')}</div>` : emptyState('📝', SV.loading ? 'جارٍ التحميل…' : 'لا استبيانات بعد. اختاري قالباً من الأعلى.')}</div>`;
  },
  actions: () => (cmReady() && (SV.cur || SV.draft) ? '<button class="btn" data-act="svBack">→ الاستبيانات</button>' : ''),
};
function svBuilder() {
  const d = SV.draft, T = d.target ? SV_TARGETS[d.target] : null;
  return `<div class="card"><h3>${d.target ? T.label.split(' ')[0] : '✍️'} إنشاء استبيان</h3><div class="form">
      <div class="field full"><label>عنوان الاستبيان</label><input class="input" data-change="svD" data-id="title" value="${esc(d.title)}" maxlength="150"></div>
      <div class="field full"><label>مقدمة قصيرة</label><textarea class="input" rows="2" data-change="svD" data-id="intro" maxlength="2000">${esc(d.intro)}</textarea></div>
      <div class="field"><label>تُضاف الإجابات إلى</label><select class="input" data-change="svD" data-id="target"><option value="">لا شيء (عرض وتصدير فقط)</option>${Object.entries(SV_TARGETS).map(([k, t]) => `<option value="${k}" ${d.target === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div></div></div>
    <div class="card"><h3>❓ الأسئلة</h3><div class="sv-fields">${d.fields.map((f, i) => `<div class="sv-f">
        <div class="sv-n">${i + 1}</div>
        <div class="form" style="flex:1">
          <div class="field"><label>السؤال</label><input class="input" data-change="svF" data-i="${i}" data-id="label" value="${esc(f.label)}" placeholder="مثال: رقم الجوال"></div>
          <div class="field"><label>نوع الإجابة</label><select class="input" data-change="svF" data-i="${i}" data-id="type">${SV_TYPES.map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          ${T ? `<div class="field"><label>تُحفظ في</label><select class="input" data-change="svF" data-i="${i}" data-id="map"><option value="">— لا تُحفظ —</option>${T.fields.map(([k, l]) => `<option value="${k}" ${f.map === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
          ${f.type === 'select' ? `<div class="field full"><label>الخيارات (كل خيار في سطر)</label><textarea class="input" rows="3" data-change="svF" data-i="${i}" data-id="options">${esc((f.options || []).join('\n'))}</textarea></div>` : ''}
          <div class="field"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${f.required ? 'checked' : ''} data-change="svF" data-i="${i}" data-id="required"> إجابة إلزامية</label></div>
        </div>
        <div class="sv-ctl"><button class="icon-btn" data-act="svMove" data-i="${i}" data-id="-1" title="أعلى">▲</button><button class="icon-btn" data-act="svMove" data-i="${i}" data-id="1" title="أسفل">▼</button><button class="icon-btn" data-act="svDelF" data-i="${i}" title="حذف">🗑️</button></div></div>`).join('')}</div>
      <button class="btn" data-act="svAddF">＋ سؤال</button>
      ${T && !d.fields.some((f) => f.map === 'name') ? '<div class="banner" style="margin-top:10px"><span>⚠️</span><div>لكي تُضاف الإجابات، يلزم سؤال «تُحفظ في: الاسم».</div></div>' : ''}</div>
    <div class="card"><h3>📤 التوزيع</h3>
      <label class="hud-row"><input type="checkbox" ${d.public ? 'checked' : ''} data-change="svD" data-id="public"> 🔗 رابط عام: يعبّئه أي شخص معه الرابط (مناسب لمن لم يسجّل في تطبيق التواصل)</label>
      <div class="field" style="max-width:380px;margin-top:8px"><label>وإرساله عبر تطبيق التواصل إلى</label><select class="input" data-change="svD" data-id="to"><option value="">لا</option><option value="all" ${d.to === 'all' ? 'selected' : ''}>كل المعلمات والإداريات</option><option value="teacher" ${d.to === 'teacher' ? 'selected' : ''}>المعلمات</option><option value="admin" ${d.to === 'admin' ? 'selected' : ''}>الإداريات</option><option value="students" ${d.to === 'students' ? 'selected' : ''}>كل الطالبات</option></select></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">الإجابات تُحفظ في خادم المدرسة. لا تطلبي بيانات حساسة غير لازمة.</div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-act="svCreate">✓ إنشاء الاستبيان</button><button class="btn" data-act="svBack">إلغاء</button></div></div>`;
}
function svResults() {
  const S = SV.cur, F = S.fields || [], R = SV.resp, T = S.target ? SV_TARGETS[S.target] : null;
  const rows = R.map((r) => ({ r, ex: T ? svMatch(S, r.data) : null }));
  const pending = rows.filter((x) => T && !x.r.imported).length;
  return `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="grow"><h3 style="margin:0">📝 ${esc(S.title)}</h3><div class="muted">${R.length} إجابة${T ? ` · تُضاف إلى ${T.label}` : ''}</div></div>
      ${S.open ? '<span class="chip green">مفتوح</span>' : '<span class="chip">مغلق</span>'}<button class="btn sm" data-act="svToggle">${S.open ? '⏸ إغلاق الاستقبال' : '▶ فتح الاستقبال'}</button><button class="btn sm" data-act="svXlsx">⬇ Excel</button><button class="btn sm danger" data-act="svDel">🗑️</button></div>
    ${S.public ? `<div style="margin-top:12px"><label class="muted">🔗 رابط الاستبيان</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px"><input class="input" readonly dir="ltr" id="svLinkBox" value="${esc(svLink(S))}" style="flex:1;min-width:240px;font-size:12.5px"><button class="btn sm primary" data-act="svCopy">📋 نسخ</button><button class="btn sm" data-act="svWa">🟢 واتساب</button></div></div>` : `<div style="margin-top:10px"><button class="btn sm" data-act="svPublic">🔗 إنشاء رابط عام لهذا الاستبيان</button></div>`}</div>
    <div class="card"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">📥 الإجابات</h3><span class="spacer"></span>${T && pending ? `<button class="btn primary" data-act="svImportAll">➕ إضافة وتحديث الكل في ${T.label} (${pending})</button>` : ''}<button class="btn sm" data-act="svReload">🔄 تحديث</button></div>
      ${R.length ? `<div class="table-wrap"><table><thead><tr><th>#</th>${F.map((f) => `<th>${esc(f.label)}${f.map && T ? `<div class="muted" style="font-weight:400;font-size:11px">← ${esc((T.fields.find(([k]) => k === f.map) || [])[1] || '')}</div>` : ''}</th>`).join('')}<th>المصدر</th>${T ? '<th></th>' : ''}</tr></thead><tbody>
        ${rows.map(({ r, ex }, i) => `<tr><td class="muted">${R.length - i}</td>${F.map((f) => `<td>${esc(r.data[f.id] || '')}</td>`).join('')}<td class="muted" style="font-size:12px">${r.uname ? esc(r.uname) : 'الرابط العام'}<br>${new Date(r.updated || r.created).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' })}</td>
          ${T ? `<td style="white-space:nowrap">${r.imported ? '<span class="chip green">✓ أُضيفت</span>' : `<button class="btn sm ${ex ? '' : 'primary'}" data-act="svImport" data-id="${r.id}">${ex ? '🔄 تحديث «' + esc(String(ex.name).split(' ').slice(0, 2).join(' ')) + '»' : '➕ إضافة'}</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : emptyState('📭', 'لا إجابات بعد')}</div>`;
}
const svBlankF = () => ({ label: '', type: 'text', required: false, map: '' });
Object.assign(ACTIONS, {
  svNew: (el) => { const t = JSON.parse(JSON.stringify(SV_TPL[el.dataset.id])); SV.draft = { ...t, public: true, to: el.dataset.id === 'teacher' ? 'teacher' : '', fields: t.fields.map((f) => ({ ...svBlankF(), ...f })) }; SV.cur = null; render(); },
  svBack: () => { SV.draft = null; SV.cur = null; render(); },
  svAddF: () => { SV.draft.fields.push(svBlankF()); render(); },
  svDelF: (el) => { SV.draft.fields.splice(+el.dataset.i, 1); render(); },
  svMove: (el) => { const i = +el.dataset.i, j = i + +el.dataset.id, F = SV.draft.fields; if (j < 0 || j >= F.length) return; [F[i], F[j]] = [F[j], F[i]]; render(); },
  svCreate: async (el) => {
    const d = SV.draft, fields = d.fields.filter((f) => f.label.trim()).map((f, i) => ({ ...f, id: 'f' + i, label: f.label.trim() }));
    if (!d.title.trim()) return toast('اكتبي عنوان الاستبيان', 'err');
    if (!fields.length) return toast('أضيفي سؤالاً واحداً على الأقل', 'err');
    if (fields.some((f) => f.type === 'select' && !(f.options || []).length)) return toast('أضيفي خيارات لسؤال «اختيار من قائمة»', 'err');
    if (!d.public && !d.to) return toast('اختاري طريقة التوزيع: رابط عام أو عبر تطبيق التواصل', 'err');
    el.disabled = true;
    try {
      const r = await cmApi('surveys', { method: 'POST', body: JSON.stringify({ title: d.title.trim(), intro: d.intro.trim(), fields, target: d.target, public: d.public, to: d.to || null, from: cmFrom() }) });
      SV.draft = null; SV.cur = { id: r.id, pkey: r.pkey, title: d.title, fields, target: d.target, public: d.public, open: true }; SV.resp = [];
      toast(r.n ? `✓ أُنشئ الاستبيان وأُرسل إلى ${r.n} عبر تطبيق التواصل` : '✓ أُنشئ الاستبيان، انسخي رابطه وأرسليه', 'ok');
      await svLoad(true);
    } catch (e) { toast(e.message, 'err'); el.disabled = false; }
  },
  svOpen: async (el) => { SV.cur = SV.list.find((s) => s.id === el.dataset.id); SV.resp = []; render(); await svLoad(true); },
  svReload: () => svLoad(true),
  svToggle: async () => { try { await cmApi('surveys/' + SV.cur.id, { method: 'POST', body: JSON.stringify({ open: !SV.cur.open }) }); await svLoad(true); } catch (e) { toast(e.message, 'err'); } },
  svPublic: async () => { try { await cmApi('surveys/' + SV.cur.id, { method: 'POST', body: JSON.stringify({ public: true }) }); await svLoad(true); } catch (e) { toast(e.message, 'err'); } },
  svDel: () => confirmBox(`حذف الاستبيان «${SV.cur.title}» وكل إجاباته؟ (ما أُضيف إلى البرنامج يبقى)`, async () => { try { await cmApi('surveys/' + SV.cur.id, { method: 'DELETE' }); SV.cur = null; await svLoad(true); } catch (e) { toast(e.message, 'err'); } }),
  svCopy: async () => { try { await navigator.clipboard.writeText(svLink(SV.cur)); toast('نُسخ الرابط ✓', 'ok'); } catch { $('#svLinkBox')?.select(); } },
  svWa: () => api.openUrl('https://wa.me/?text=' + encodeURIComponent(`السلام عليكم، نرجو تعبئة «${SV.cur.title}»:\n${svLink(SV.cur)}`)),
  svImport: async (el) => {
    const r = SV.resp.find((x) => x.id === Number(el.dataset.id)); if (!r) return;
    const res = svApply(SV.cur, r); if (!res) return toast('لا يوجد اسم في هذه الإجابة', 'err');
    commit(false);
    try { await cmApi(`surveys/${SV.cur.id}/imported`, { method: 'POST', body: JSON.stringify({ ids: [r.id] }) }); r.imported = 1; } catch { }
    toast(res === 'add' ? '➕ أُضيفت' : '🔄 حُدّثت البيانات', 'ok'); render();
  },
  svImportAll: async () => {
    let add = 0, upd = 0; const ids = [];
    for (const r of SV.resp.filter((x) => !x.imported)) { const res = svApply(SV.cur, r); if (res === 'add') add++; if (res === 'upd') upd++; if (res) ids.push(r.id); }
    commit(false);
    try { await cmApi(`surveys/${SV.cur.id}/imported`, { method: 'POST', body: JSON.stringify({ ids }) }); SV.resp.forEach((x) => { if (ids.includes(x.id)) x.imported = 1; }); } catch { }
    toast(`✓ أُضيفت ${add}${upd ? ` وحُدّثت ${upd}` : ''} في ${SV_TARGETS[SV.cur.target].label}`, 'ok'); render();
  },
  svXlsx: async () => {
    const S = SV.cur, F = S.fields || [];
    const rows = [[...F.map((f) => f.label), 'المصدر', 'التاريخ'], ...SV.resp.map((r) => [...F.map((f) => r.data[f.id] || ''), r.uname || 'الرابط العام', new Date(r.updated || r.created).toLocaleString('ar-SA-u-nu-latn')])];
    try { openBlob(await buildXlsx(rows, rows[0].map(() => 22), 'الإجابات'), `${S.title}.xlsx`, true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok'); } catch (e) { toast(e.message, 'err'); }
  },
});
Object.assign(CHANGES, {
  svD: (el) => { const k = el.dataset.id; SV.draft[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'target') { SV.draft.fields.forEach((f) => { f.map = ''; }); render(); } },
  svF: (el) => { const f = SV.draft.fields[+el.dataset.i], k = el.dataset.id; if (k === 'required') f.required = el.checked; else if (k === 'options') f.options = el.value.split('\n').map((x) => x.trim()).filter(Boolean); else f[k] = el.value; if (k === 'type' || k === 'map') render(); },
});
