// ═════════════ 🎁 حقائب المبادرات الجاهزة للأيام العالمية والوطنية (1.0.7) ═════════════
// بضغطة: عرض تقديمي + بروشور في المصمم + برنامج إذاعة مدرسية + مهام تنفيذ مؤرخة + رسالة بالبريد للمعلمات وأولياء الأمور.

const kitOf = (o) => KITS[o.name] || kitGeneric(o.name, o.type);
const KIT_THEME = { '#7a4b23': 'sand', '#8a5a2b': 'sand', '#0b6b3a': 'emerald', '#0f6b5c': 'emerald', '#2f7d32': 'emerald', '#2fa38c': 'emerald', '#1e3a5f': 'navy', '#1b6ca8': 'navy', '#3f7cc9': 'navy', '#5b2a86': 'plum', '#a63d5e': 'rose', '#c2410c': 'rose', '#e0a43a': 'rose', '#5b6b78': 'slate' };
const kitDate = (o) => occNextDate(o);
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ───── البروشور (A4 عمودي في المصمم) ─────
function kitBrochure(o, k) {
  const [W, H] = DSIZES.portrait, c = k.color, school = db.settings.schoolName || '', d = kitDate(o);
  const T = (text, x, y, size, color = '#1d2b28', bold = false) => ({ t: 'text', text, x, y, size, color, bold });
  const R = (x, y, w, h, fill, r = 0, stroke = '', lw = 0) => ({ t: 'rect', x, y, w, h, color: stroke || fill, lw, fill, r });
  const wrap = (s, px, bold, w) => prWrap(s, px, bold, w);
  const objs = [];
  objs.push(R(0, 0, W, 270, c), { t: 'ellipse', x: -120, y: -140, w: 360, h: 360, color: '#ffffff', lw: 0, fill: 'rgba(255,255,255,.08)' }, { t: 'ellipse', x: W - 170, y: 150, w: 260, h: 260, color: '#ffffff', lw: 0, fill: 'rgba(255,255,255,.07)' });
  objs.push(T(school, W / 2, 46, 18, 'rgba(255,255,255,.85)'));
  const ts = Math.min(44, Math.floor(1250 / Math.max(10, o.name.length)));
  objs.push(T(o.name, W / 2, 112, ts, '#ffffff', true));
  objs.push(T(`${dayName(d)} ${fmtH(d)}`, W / 2, 162, 18, 'rgba(255,255,255,.9)'));
  const sw = Math.min(W - 160, 60 + k.slogan.length * 22);
  objs.push(R(W / 2 - sw / 2, 196, sw, 52, '#ffffff', 26), T(k.slogan, W / 2, 223, 26, c, true));
  // كتل متتابعة: كل كتلة تبدأ بعد نهاية السابقة
  let y = 315;
  const block = (lines, size, color, bold = false) => { objs.push(T(lines.join('\n'), W / 2, y, size, color, bold)); y += (lines.length - 1) * size * 1.35 + size; };
  const head = (txt) => { y += 26; objs.push(R(W / 2 - 90, y, 180, 40, hexA(c, 0.12), 20), T(txt, W / 2, y + 20, 22, c, true)); y += 72; };
  block(wrap(k.idea, 20, false, W - 130), 20, '#1d2b28');
  head('أهدافنا');
  block(k.goals.flatMap((g) => wrap('◆ ' + g, 19, false, W - 120)), 19, '#1d2b28');
  head('نصائح وفوائد');
  const bw = (W - 110) / 2, bh = Math.max(96, Math.min(126, (H - 110 - y) / 2 - 18));
  k.tips.slice(0, 4).forEach((tip, i) => {
    const x = W - 40 - (i % 2 + 1) * bw - (i % 2) * 30, yy = y - 14 + Math.floor(i / 2) * (bh + 18), L = wrap(tip, 19, true, bw - 40);
    objs.push(R(x, yy, bw, bh, hexA(c, 0.08), 18, hexA(c, 0.35), 2), T(L.join('\n'), x + bw / 2, yy + bh / 2 - ((L.length - 1) * 19 * 1.35) / 2, 19, '#1d2b28', true));
  });
  objs.push(R(0, H - 80, W, 80, c), T(`${school ? school + ' · ' : ''}${k.target}`, W / 2, H - 40, 17, '#ffffff'));
  return { size: 'portrait', bg: '#ffffff', objs };
}
// ───── برنامج الإذاعة المدرسية ─────
function kitRadio(o, k) {
  const d = kitDate(o);
  return `${letterhead()}<h1 style="text-align:center">برنامج الإذاعة المدرسية</h1><h2 style="text-align:center">${esc(o.name)} — «${esc(k.slogan)}»</h2>
    <p style="text-align:center">${dayName(d)} ${fmtH(d)} (${fmtG(d)})</p>
    <h3>١. المقدمة</h3><p>بسم الله الرحمن الرحيم، والصلاة والسلام على أشرف الأنبياء والمرسلين. صباح العلم والإيمان، نرحب بكم في إذاعتنا الصباحية التي نخصصها اليوم لـ«${esc(o.name)}» تحت شعار «${esc(k.slogan)}».</p>
    <h3>٢. القرآن الكريم</h3><p>تلاوة آيات مناسبة من القرآن الكريم تقدمها إحدى الطالبات المتميزات في الحفظ.</p>
    <h3>٣. كلمة الصباح</h3><p>${esc(k.broadcast)}</p>
    <h3>٤. هل تعلمين؟</h3><ul>${k.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>٥. فقرة المبادرة</h3><p>${esc(k.idea)}</p><p><b>أنشطة اليوم:</b></p><ul>${k.acts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <h3>٦. الختام</h3><p>وفي الختام نشكر لكم حسن الاستماع، ونسأل الله أن يوفقنا لما يحب ويرضى. والسلام عليكم ورحمة الله وبركاته.</p>
    <p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%"><b>المقدّمات:</b> ..........................</td><td style="width:50%"><b>المشرفة:</b> ${esc(db.settings.employeeName || '..........................')}</td></tr></tbody></table>`;
}
// ───── إنشاء الحقيبة ─────
function kitCreate(o) {
  const k = kitOf(o), d = kitDate(o), t = todayISO();
  // 1) العرض التقديمي
  const f = { title: o.name, subtitle: `مبادرة «${k.slogan}»`, presenter: db.settings.employeeName || '', date: fmtH(d), idea: k.idea, goals: k.goals.join('\n'), target: k.target, duration: 'أسبوع المناسبة',
    partners: '', phases: ['التحضير — تجهيز الأركان والمواد قبل المناسبة', 'الإعلان — نشر البروشور وإرسال الرسالة للمعلمات وأولياء الأمور', 'التنفيذ — الإذاعة الصباحية والأنشطة يوم المناسبة', 'التقويم — توثيق المبادرة بالصور وتكريم المشاركات'].join('\n'), indicators: '', team: '', closingNote: k.slogan, theme: KIT_THEME[k.color] || 'emerald' };
  const slides = prKeep(PR_KINDS.initiative.gen(f));
  slides.splice(3, 0, { id: uid(), layout: 'cards', title: 'أنشطة المبادرة', body: k.acts.join('\n'), image: null, chart: null, notes: '' });
  slides.splice(slides.length - 1, 0, { id: uid(), layout: 'cards', title: 'نصائح وفوائد', body: k.tips.join('\n'), image: null, chart: null, notes: '' }, { id: uid(), layout: 'quote', title: k.slogan, body: k.broadcast.split(/[.!؟]\s/).slice(0, 2).join('. ') + '.', image: null, chart: null, notes: '' });
  const pres = { id: uid(), kind: 'initiative', logo: db.settings.presLogo || null, createdAt: new Date().toISOString(), title: o.name, theme: f.theme, fields: f, school: db.settings.schoolName || '', slides, updatedAt: new Date().toISOString() };
  db.presentations.push(pres);
  // 2) البروشور
  db.designs = db.designs || [];
  const design = { id: uid(), name: `بروشور — ${o.name}`, data: kitBrochure(o, k), updatedAt: t };
  db.designs.unshift(design);
  // 3) برنامج الإذاعة
  db.documents = db.documents || [];
  const doc = { id: uid(), title: `الإذاعة المدرسية — ${o.name}`, html: kitRadio(o, k), updatedAt: t };
  db.documents.push(doc);
  // 4) مهام التنفيذ
  const due = (n) => { const x = addDays(d, -n); return x < t ? t : x; };
  [[7, 'تجهيز الأركان والمواد وتوزيع الأدوار'], [2, 'طباعة البروشور وإرسال الرسالة للمعلمات وأولياء الأمور'], [0, 'تنفيذ المبادرة والإذاعة الصباحية وتوثيقها بالصور']]
    .forEach(([n, x]) => db.tasks.push({ id: uid(), createdAt: t, title: `${o.name}: ${x}`, due: due(n), priority: n === 0 ? 'high' : 'med', status: 'todo', category: 'المناسبات', notes: `من حقيبة مبادرة «${k.slogan}»` }));
  // 5) المناسبة نفسها
  if (!o.initiative) o.initiative = `مبادرة «${k.slogan}»`;
  if (occStatus(o) === 'todo') o.status = 'prep';
  o.kit = { pres: pres.id, design: design.id, doc: doc.id, at: t };
  commit(false);
}
const kitExists = (o) => o.kit && (db.presentations.some((p) => p.id === o.kit.pres) || (db.designs || []).some((x) => x.id === o.kit.design));
function kitModal(o) {
  const k = kitOf(o), d = kitDate(o), has = kitExists(o), generic = !KITS[o.name];
  const tEmails = db.teachers.map((t) => t.email).filter(Boolean), gEmails = [...new Set((db.students || []).map((s) => s.guardianEmail).filter(Boolean))];
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>🎁 حقيبة مبادرة — ${esc(o.name)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">
      <div class="kit-head" style="--kc:${k.color}"><div><div class="kit-slogan">«${esc(k.slogan)}»</div><div>${dayName(d)} ${fmtH(d)} · ${fmtG(d)}</div></div></div>
      ${generic ? '<div class="muted" style="margin:8px 0">هذه المناسبة ليس لها محتوى مُعدّ مسبقاً، فأُعدّت لها حقيبة عامة يمكنكِ تعديلها بعد الإنشاء.</div>' : ''}
      <div class="section-title">💡 فكرة المبادرة</div><p style="margin:0">${esc(k.idea)}</p>
      <div class="grid g2" style="margin-top:10px;align-items:start"><div><div class="section-title" style="margin-top:6px">🎯 الأهداف</div><ul class="kit-ul">${k.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>
        <div><div class="section-title" style="margin-top:6px">🧩 الأنشطة</div><ul class="kit-ul">${k.acts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div></div>
      ${has ? `<div class="section-title">📂 ملفات الحقيبة (أُنشئت ${fmtH(o.kit.at)})</div>
        <div class="kit-files">
          <button class="kit-file" data-act="kitGo" data-k="pres" data-id="${o.id}"><span>🎞️</span><b>العرض التقديمي</b><small>PowerPoint أو PDF</small></button>
          <button class="kit-file" data-act="kitGo" data-k="design" data-id="${o.id}"><span>🎨</span><b>البروشور</b><small>للطباعة أو النشر</small></button>
          <button class="kit-file" data-act="kitGo" data-k="doc" data-id="${o.id}"><span>🎙️</span><b>برنامج الإذاعة</b><small>Word أو طباعة</small></button>
          <button class="kit-file" data-act="kitGo" data-k="tasks" data-id="${o.id}"><span>✅</span><b>مهام التنفيذ</b><small>3 مهام بمواعيدها</small></button>
        </div>` : `<div class="kit-create"><b>بضغطة واحدة يُنشأ:</b> 🎞️ عرض تقديمي · 🎨 بروشور مصمم · 🎙️ برنامج الإذاعة المدرسية · ✅ ثلاث مهام تنفيذ بمواعيدها · 📧 رسالة جاهزة</div>`}
      <div class="section-title">📧 الرسالة</div><div class="card" style="background:#f8faf9;margin:0">${esc(k.msg)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn sm" data-act="kitMail" data-k="t" data-id="${o.id}" ${tEmails.length ? '' : 'disabled title="لا توجد معلمات لهن بريد"'}>📧 للمعلمات (${tEmails.length})</button>
        <button class="btn sm" data-act="kitMail" data-k="g" data-id="${o.id}" ${gEmails.length ? '' : 'disabled title="لا توجد بريد لأولياء الأمور"'}>📧 لأولياء الأمور (${gEmails.length})</button>
        <button class="btn sm" data-act="kitCopy" data-id="${o.id}">📋 نسخ النص</button></div>
    </div>
    <div class="modal-f">${has ? `<button class="btn" data-act="kitMake" data-id="${o.id}">↻ إنشاء نسخة جديدة من الملفات</button>` : `<button class="btn primary" data-act="kitMake" data-id="${o.id}">✨ أنشئي الحقيبة كاملة</button>`}<button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = { kit: true };
}
const occById = (id) => db.occasions.find((x) => x.id === id);
Object.assign(ACTIONS, {
  kitOpen: (el) => kitModal(occById(el.dataset.id)),
  kitMake: (el) => { const o = occById(el.dataset.id); kitCreate(o); toast('🎁 أُنشئت الحقيبة: عرض، وبروشور، وبرنامج إذاعة، وثلاث مهام', 'ok'); kitModal(o); },
  kitGo: (el) => {
    const o = occById(el.dataset.id), k = el.dataset.k; closeModal();
    if (k === 'pres') { ui.prId = o.kit.pres; ui.prSlide = 0; go('present'); }
    else if (k === 'design') { ui.tool = 'designer'; go('tools'); ACTIONS.dLoad({ dataset: { id: o.kit.design } }); }
    else if (k === 'doc') { DOCS.id = o.kit.doc; go('letters'); }
    else { ui.taskFilter = 'all'; go('tasks'); }
  },
  kitMail: (el) => {
    const o = occById(el.dataset.id), k = kitOf(o), to = el.dataset.k === 't' ? db.teachers.map((t) => t.email).filter(Boolean) : [...new Set(db.students.map((s) => s.guardianEmail).filter(Boolean))];
    const body = `${el.dataset.k === 't' ? 'الزميلات الفاضلات' : 'أولياء الأمور الكرام'}\nالسلام عليكم ورحمة الله وبركاته\n\n${k.msg}\n\n${k.tips.map((x) => '• ' + x).join('\n')}\n\n${db.settings.schoolName || ''}`;
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to.join(','))}&su=${encodeURIComponent(`${o.name} — «${k.slogan}»`)}&body=${encodeURIComponent(body)}`);
    toast('فُتحت الرسالة في Gmail (العناوين في «نسخة مخفية» حفاظاً على الخصوصية)', 'ok');
  },
  kitCopy: async (el) => { const o = occById(el.dataset.id), k = kitOf(o); try { await navigator.clipboard.writeText(`${o.name} — «${k.slogan}»\n\n${k.msg}`); toast('نُسخ النص', 'ok'); } catch { toast('تعذّر النسخ', 'err'); } },
});
// زر الحقيبة في بطاقات الأيام العالمية
const _occAfter = VIEWS.occasions.after;
VIEWS.occasions.after = function () {
  _occAfter?.call(this);
  $$('#view [data-act=occEdit]').forEach((b) => { const o = occById(b.dataset.id); if (!o) return; b.insertAdjacentHTML('beforebegin', `<button class="btn sm ${kitExists(o) ? '' : 'primary'}" data-act="kitOpen" data-id="${o.id}">🎁 ${kitExists(o) ? 'الحقيبة جاهزة' : 'حقيبة المبادرة'}</button>`); });
};
// لوحة اليوم: أقرب مناسبة خلال أسبوعين بلا حقيبة
addHook('dashCards', (t) => {
  const n = db.occasions.map((o) => ({ o, d: occNextDate(o) })).filter(({ o, d }) => diffDays(t, d) >= 0 && diffDays(t, d) <= 14 && !kitExists(o) && occStatus(o) !== 'done').sort((a, b) => a.d.localeCompare(b.d))[0];
  if (!n) return '';
  const dd = diffDays(t, n.d);
  return `<div class="card"><h3>🎁 مبادرة قادمة</h3><div><b>${esc(n.o.name)}</b> <span class="muted">· ${dd === 0 ? 'اليوم' : 'بعد ' + daysLabel(dd)}</span></div><div class="muted" style="margin:6px 0 10px">حقيبتها جاهزة للإنشاء: عرض، وبروشور، وبرنامج إذاعة، ومهام.</div><button class="btn sm primary" data-act="kitOpen" data-id="${n.o.id}">🎁 فتح الحقيبة</button></div>`;
});
