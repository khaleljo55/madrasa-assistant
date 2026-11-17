// ═════════════ 🗂️ ترتيب البرنامج (1.0.9) ═════════════
// القائمة الجانبية في مجموعات أوضح، والإعدادات في تبويبات، ولوحة اليوم قابلة للتخصيص.

// ───── أقسام جديدة في القائمة ─────
const NEW_ITEMS = {
  circulars: { id: 'circulars', ic: '📜', label: 'التعاميم', badge: () => (db.circulars || []).filter((c) => { const [a, n] = cirProgress(c); return c.due && c.due < todayISO() && a < n; }).length },
  meetings: { id: 'meetings', ic: '📝', label: 'محاضر الاجتماعات' },
  visitors: { id: 'visitors', ic: '🚶', label: 'سجل الزوار' },
  sms: { id: 'sms', ic: '📱', label: 'الرسائل النصية' },
};
(function regroupNav() {
  const byId = Object.fromEntries(NAV.map((n) => [n.id, n]));
  Object.assign(byId, NEW_ITEMS);
  const custom = NAV_TREE.find((g) => g.group === 'custom');
  const pick = (ids) => ids.map((id) => byId[id]).filter(Boolean);
  const groups = [
    byId.dashboard,
    { group: 'org', ic: '🗂️', label: 'التنظيم والتقارير', items: pick(['tasks', 'calendar', 'report', 'stats']) },
    { group: 'teachers', ic: '👩‍🏫', label: 'شؤون المعلمات', items: pick(['teachers', 'timetable', 'absence', 'subs', 'entries', 'duties']) },
    byId.students,
    { group: 'super', ic: '🎙️', label: 'الإشراف والأنشطة', items: pick(['assembly', 'break', 'occasions', 'visits', 'visitors']) },
    { group: 'docs', ic: '📨', label: 'المراسلات والمستندات', items: pick(['letters', 'mail', 'circulars', 'meetings', 'sms', 'present']) },
    { group: 'know', ic: '📚', label: 'المعرفة والأدوات', items: pick(['library', 'quran', 'tools']) },
    custom,
    byId.settings,
  ].filter(Boolean);
  // أي قسم لم يُذكر يُضاف إلى «المعرفة والأدوات» حتى لا يختفي
  const placed = new Set(groups.flatMap((g) => (g.items ? g.items.map((i) => i.id) : [g.id])));
  NAV.forEach((n) => { if (!placed.has(n.id) && !/^cs_|^csManage$/.test(n.id)) groups.find((g) => g.group === 'know').items.push(n); });
  NAV_TREE.length = 0; NAV_TREE.push(...groups);
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();

// ───── تبويبات الإعدادات ─────
const SET_TABS = [['general', '🏫 عام'], ['sync', '☁️ المزامنة والنسخ'], ['comm', '📨 التواصل والتنبيهات'], ['certs', '🏅 الشهادات والتوقيع'], ['adv', '🛠️ متقدمة']];
function setTabOf(card) {
  const h = (card.querySelector('h3')?.textContent || card.querySelector('summary')?.textContent || '').trim();
  if (card.querySelector('.adv-group') || /قفل|أرصدة|الإدخال الصوتي|تخصيص لوحة/.test(h)) return 'adv';
  if (/المزامنة|النسخ|نسخة|التحديثات/.test(h)) return 'sync';
  if (/البريد|الرسائل النصية|تنبيهات|رسالة الشكر/.test(h)) return 'comm';
  if (/التوقيع|الشهادات/.test(h)) return 'certs';
  return 'general';
}
const _setAfter = VIEWS.settings.after;
VIEWS.settings.after = function () {
  _setAfter?.call(this);
  if (ui.setTab === 'all') return; // عرض كل البطاقات (للاختبارات الداخلية)
  const tab = SET_TABS.some(([k]) => k === ui.setTab) ? ui.setTab : 'general';
  const cards = [...$$('#view .card')].filter((c) => !c.parentElement.closest('.card'));
  const count = {}; cards.forEach((c) => { const t = setTabOf(c); count[t] = (count[t] || 0) + 1; c.style.display = t === tab ? '' : 'none'; });
  $('#view').insertAdjacentHTML('afterbegin', `<div class="seg set-tabs" style="margin-bottom:14px;flex-wrap:wrap">${SET_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="setTab" data-id="${k}">${l}${count[k] ? ` <span class="muted" style="font-size:11px">${count[k]}</span>` : ''}</button>`).join('')}</div>`);
};
ACTIONS.setTab = (el) => { ui.setTab = el.dataset.id; render(); };
ACTIONS.setGo = (el) => { ui.setTab = el.dataset.id; go('settings'); };

// ───── تخصيص لوحة اليوم ─────
const dashKey = (card) => (card.querySelector('h3')?.textContent || '').replace(/[\d٠-٩()（）:]+/g, '').replace(/\s+/g, ' ').trim();
const DASH = { seen: [] };
const _dashAfter = VIEWS.dashboard.after;
VIEWS.dashboard.after = function () {
  _dashAfter?.call(this);
  const hidden = new Set(db.settings.dashHidden || []);
  const cards = [...$$('#view .card')].filter((c) => !c.parentElement.closest('.card') && dashKey(c));
  DASH.seen = [...new Set(cards.map(dashKey))];
  cards.forEach((c) => { if (hidden.has(dashKey(c))) c.style.display = 'none'; });
  $('#view').insertAdjacentHTML('beforeend', `<div style="text-align:center;margin:18px 0 6px"><button class="btn sm ghost" data-act="dashCustom">⚙️ تخصيص لوحة اليوم${hidden.size ? ` (${hidden.size} مخفية)` : ''}</button></div>`);
};
ACTIONS.dashCustom = () => {
  const hidden = new Set(db.settings.dashHidden || []), all = [...new Set([...DASH.seen, ...hidden])];
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal"><div class="modal-h"><h2>⚙️ تخصيص لوحة اليوم</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:10px">اختاري البطاقات التي تظهر في لوحة اليوم. بعض البطاقات تظهر في أيام معيّنة فقط (مثل إذاعة اليوم أو تقرير الأسبوع).</div>
      <div class="cir-acks">${all.map((k) => `<label class="cir-ack ${hidden.has(k) ? '' : 'on'}"><input type="checkbox" data-change="dashShow" data-id="${esc(k)}" ${hidden.has(k) ? '' : 'checked'}><span class="grow">${esc(k)}</span></label>`).join('')}</div></div>
    <div class="modal-f"><button class="btn" data-act="dashAll">إظهار الكل</button><button class="btn primary" data-act="modalClose">تم</button></div></div></div>`;
  modalCtx = {};
};
ACTIONS.dashAll = () => { db.settings.dashHidden = []; commit(); closeModal(); };
CHANGES.dashShow = (el) => { const h = new Set(db.settings.dashHidden || []); el.checked ? h.delete(el.dataset.id) : h.add(el.dataset.id); db.settings.dashHidden = [...h]; el.parentElement.classList.toggle('on', el.checked); commit(); };
