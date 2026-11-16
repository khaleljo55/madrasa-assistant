// ═════════════ 🔍 البحث الشامل + 🛟 النسخة الاحتياطية اليومية (1.0.6) ═════════════

// ───── البحث الشامل (Ctrl+K) ─────
const GS = { q: '', sel: 0, res: [] };
function gsSources() {
  const out = [];
  const add = (ic, cat, title, sub, hay, open) => out.push({ ic, cat, title, sub, hay: normName(`${title} ${sub} ${hay || ''}`), open });
  db.teachers.forEach((t) => add('👩‍🏫', 'المعلمات', t.name, t.subject || '', `${t.email || ''} ${t.phone || ''}`, () => { ui.teacherId = t.id; go('teacher'); }));
  (db.students || []).forEach((s) => add('👧', 'الطالبات', s.name, sClass(s), `${s.idNo || ''} ${s.guardian || ''} ${s.halaqa || ''}`, () => { ui.studentId = s.id; go('student'); }));
  db.tasks.forEach((t) => add('✅', 'المهام', t.title, t.due ? fmtH(t.due) : '', `${t.notes || ''} ${t.category || ''}`, () => { go('tasks'); setTimeout(() => openTask(t), 30); }));
  (db.documents || []).forEach((d) => add('✉️', 'الخطابات والمستندات', d.title, d.outNumber ? 'صادر ' + d.outNumber : fmtG(d.updatedAt), '', () => { DOCS.id = d.id; go('letters'); }));
  (db.correspondence || []).forEach((c) => add('📨', 'الصادر والوارد', c.subject || c.number || 'معاملة', [c.number, c.party].filter(Boolean).join(' · '), c.notes || '', () => { go('mail'); setTimeout(() => openCorr(c), 30); }));
  db.library.forEach((x) => add('🗃️', 'مكتبة المعرفة', x.title, x.category || '', x.desc || '', () => { ui.libQuery = x.title; go('library'); }));
  db.occasions.forEach((o) => add('🎉', 'الأيام العالمية', o.name, o.initiative || '', '', () => { go('occasions'); setTimeout(() => openOcc(o), 30); }));
  (db.sheets || []).forEach((s) => add('📈', 'الجداول والإحصائيات', s.title, `${s.rows.length - 1} صف`, s.rows.slice(1, 200).map((r) => r.join(' ')).join(' '), () => { ui.stId = s.id; ui.stChart = null; go('stats'); }));
  (db.presentations || []).forEach((p) => add('🎞️', 'العروض', p.title, `${p.slides.length} شرائح`, p.slides.map((x) => x.title).join(' '), () => { ui.prId = p.id; ui.prSlide = 0; go('present'); }));
  (db.designs || []).forEach((d) => add('🎨', 'التصاميم', d.name, fmtG(d.updatedAt), '', () => { ui.tool = 'designer'; go('tools'); ACTIONS.dLoad({ dataset: { id: d.id } }); }));
  (db.customSections || []).forEach((s) => s.records.forEach((r) => { const vals = s.fields.map((f) => csFmt(f, r.values[f.id])).filter(Boolean); add(s.icon || '📁', s.name, vals[0] || s.name, vals.slice(1, 3).join(' · '), vals.join(' '), () => { go('cs_' + s.id); setTimeout(() => csRecordForm(s, r), 30); }); }));
  NAV.forEach((n) => add(n.ic, 'الأقسام', n.label, 'فتح القسم', '', () => go(n.id)));
  return out;
}
function gsRun() {
  const words = normName(GS.q).split(/\s+/).filter(Boolean);
  GS.res = words.length ? gsSources().filter((x) => words.every((w) => x.hay.includes(w))).slice(0, 60) : [];
  GS.sel = Math.min(GS.sel, Math.max(0, GS.res.length - 1));
  const box = $('#gsRes'); if (!box) return;
  let last = '';
  box.innerHTML = GS.q.trim() ? (GS.res.length ? GS.res.map((r, i) => { const h = r.cat !== last ? `<div class="gs-cat">${esc(r.cat)}</div>` : ''; last = r.cat; return `${h}<button class="gs-item ${i === GS.sel ? 'on' : ''}" data-act="gsGo" data-id="${i}"><span class="gs-ic">${r.ic}</span><span class="grow"><b>${esc(r.title)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span></button>`; }).join('') : '<div class="muted gs-empty">لا توجد نتائج</div>')
    : '<div class="muted gs-empty">ابحثي عن معلمة، طالبة، مهمة، خطاب، معاملة، مناسبة، عرض، جدول، أو أي قسم…<br><small>↑↓ للتنقل · Enter للفتح · Esc للإغلاق</small></div>';
  box.querySelector('.gs-item.on')?.scrollIntoView({ block: 'nearest' });
}
function gsOpen() {
  if (modalCtx && !modalCtx.gs) return;
  $('#modalRoot').innerHTML = `<div class="modal-back gs-back" data-act="modalBack"><div class="modal gs-modal"><input class="input gs-input" id="gsInput" placeholder="🔍 بحث شامل في البرنامج…" value="${esc(GS.q)}" autocomplete="off"><div id="gsRes" class="gs-res"></div></div></div>`;
  modalCtx = { gs: true }; gsRun(); setTimeout(() => { const i = $('#gsInput'); i?.focus(); i?.select(); }, 20);
}
ACTIONS.gsOpen = gsOpen;
ACTIONS.gsGo = (el) => { const r = GS.res[+el.dataset.id]; if (!r) return; closeModal(); r.open(); };
document.addEventListener('input', (e) => { if (e.target.id === 'gsInput') { GS.q = e.target.value; GS.sel = 0; gsRun(); } });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); gsOpen(); return; }
  if (!modalCtx?.gs) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); GS.sel = Math.max(0, Math.min(GS.res.length - 1, GS.sel + (e.key === 'ArrowDown' ? 1 : -1))); gsRun(); }
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ACTIONS.gsGo({ dataset: { id: GS.sel } }); }
}, true);
(function addSearchButton() {
  const b = document.createElement('button'); b.className = 'side-search'; b.dataset.act = 'gsOpen';
  b.innerHTML = '<span>🔍 بحث شامل</span><kbd>Ctrl+K</kbd>';
  document.getElementById('nav')?.before(b);
})();

// ───── النسخة الاحتياطية اليومية ─────
const BK = { last: 0, dirs: [], error: '', busy: false };
const NB = window.madrasaNative?.backup;
async function bkText() {
  const files = {};
  for (const x of attItems(db)) if (x.file?.stored && !files[x.file.stored]) { const b = await IDB.get('files', x.file.stored).catch(() => null); if (b) files[x.file.stored] = await blobToDataUrl(b); }
  return JSON.stringify({ ...db, _files: files, _backup: { at: new Date().toISOString(), device: deviceId(), version: UPD?.version || '' } });
}
async function bkRun(manual) {
  if (!NB || BK.busy) return;
  BK.busy = true; if (manual) toast('جارٍ حفظ النسخة الاحتياطية…');
  try {
    const r = await NB.daily(todayISO(), await bkText());
    if (r.ok) { BK.last = Date.now(); BK.dirs = r.dirs; BK.error = r.error || ''; await IDB.put('kv', 'dailyBackup', { last: BK.last, dirs: BK.dirs }).catch(() => { }); if (manual) toast('🛟 حُفظت النسخة الاحتياطية', 'ok'); }
    else { BK.error = r.error; if (manual) toast('تعذّر حفظ النسخة: ' + r.error, 'err'); }
  } catch (e) { BK.error = e.message; if (manual) toast('تعذّر حفظ النسخة: ' + e.message, 'err'); }
  BK.busy = false; if (ui.view === 'settings') render();
}
async function bkCheck() {
  if (!NB || db?.settings.dailyBackup === false) return;
  if (Date.now() - BK.last >= 24 * 3600 * 1000) bkRun(false);
}
if (NB) {
  IDB.get('kv', 'dailyBackup').then((v) => { if (v) Object.assign(BK, v); }).catch(() => { }).finally(() => { setTimeout(bkCheck, 60000); setInterval(bkCheck, 30 * 60000); });
}
const bkWhere = (d) => (/OneDrive/i.test(d) ? '☁️ OneDrive' : /Drive|ملفاتي/i.test(d) ? '🟢 Google Drive' : '💻 هذا الجهاز');
addHook('settingsCards', () => {
  if (!NB) return '';
  const on = db.settings.dailyBackup !== false;
  return `<div class="card"><h3>🛟 النسخة الاحتياطية اليومية</h3>
    <div class="muted" style="margin-bottom:10px">كل 24 ساعة تُحفظ نسخة كاملة (البيانات والمرفقات) بتاريخ اليوم في السحابة، ويُحتفظ بآخر 30 نسخة. لاستعادة يوم سابق: «استعادة نسخة» واختاري الملف من مجلد النسخ.</div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${on ? 'checked' : ''} data-change="bkToggle"> تفعيل النسخة اليومية التلقائية</label>
    <div style="margin-top:10px">${BK.last ? `<span class="chip green">آخر نسخة: ${dayName(iso(new Date(BK.last)))} ${fmtH(iso(new Date(BK.last)))} · ${new Date(BK.last).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>` : '<span class="chip amber">لم تُحفظ نسخة بعد</span>'}
      ${BK.dirs.length ? `<div class="muted" style="margin-top:6px;font-size:12.5px">${[...new Set(BK.dirs.map(bkWhere))].join(' + ')}</div>` : ''}
      ${BK.error ? `<div style="color:var(--red);font-size:12.5px;margin-top:6px">⚠️ ${esc(BK.error)}</div>` : ''}</div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm primary" data-act="bkNow" ${BK.busy ? 'disabled' : ''}>🛟 نسخة الآن</button><button class="btn sm" data-act="bkOpen">📂 فتح مجلد النسخ</button></div></div>`;
});
ACTIONS.bkNow = () => bkRun(true);
ACTIONS.bkOpen = () => NB?.open();
CHANGES.bkToggle = (el) => { db.settings.dailyBackup = el.checked; commit(false); if (el.checked) bkCheck(); };
