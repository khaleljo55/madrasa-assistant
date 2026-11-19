// ═════════════ 🔔 إشعارات «هدهد» على الجوال (1.4.0) ═════════════
// تصل حتى والبرنامج مغلق والجوال مقفل (Web Push). في الآيفون: بعد إضافة البرنامج إلى الشاشة الرئيسية (iOS 16.4+).
// الخصوصية: الأجهزة ترفع إلى خادم المزامنة «خطة» إشعارات بالأرقام فقط (عدد المهام والمواعيد) دون عناوين أو أسماء،
// والخادم يرسلها في وقتها. أي جهاز مرتبط يحدّث الخطة عند تغيّر البيانات، فتبقى صحيحة من الكمبيوتر أو الجوال.
const HP = { last: '', lastAt: 0, sid: '', sub: null, busy: false, err: '' };
const hpCfg = () => ({ on: true, morning: '06:45', mOn: true, lateOn: true, lateTime: '12:30', evOn: true, ...(db.settings.hudPush || {}) });
const hpSet = (patch) => { db.settings.hudPush = { ...hpCfg(), ...patch }; commit(false); HP.last = ''; setTimeout(hpSync, 500); };
const hpReady = () => !!(typeof RELAY !== 'undefined' && RELAY.cfg && RELAY.id && RELAY.tok);
const hpStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const hpIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hpCan = () => IS_WEBAPP && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const hpN = (n, one, two, many) => (n === 1 ? one : n === 2 ? two : `${n} ${many}`);
async function hpFetch(path, opt = {}) {
  return fetch(`${RELAY.cfg.url}/v1/${RELAY.id}/push/${path}`, { ...opt, cache: 'no-store', headers: { Authorization: 'Bearer ' + RELAY.tok, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
}

// ───── بناء خطة الإشعارات للأيام السبعة القادمة (أرقام فقط) ─────
function hpDay(d, c) {
  const items = [], nm = typeof hudName === 'function' ? hudName() : 'أستاذتي';
  const off = typeof acadOff === 'function' && acadOff(d), school = !isWeekend(d) && !off;
  const open = (db.tasks || []).filter((x) => x.status !== 'done');
  const due = open.filter((x) => x.due === d).length, late = open.filter((x) => x.due && x.due < d).length;
  const ev = (db.events || []).filter((e) => e.date === d);
  let occ = 0; try { occ = (db.occasions || []).filter((o) => occStatus(o) !== 'done' && occNextDate(o, d) === d).length; } catch { }
  let msg = 0; try { msg = typeof acadMsgs === 'function' && db.acad?.start ? acadMsgs().filter((m) => !(db.acad.sent || {})[m.key] && addDays(m.date, -2) === d).length : 0; } catch { }
  let pf = 0; try { pf = typeof PERF_STAGES !== 'undefined' && db.perf ? PERF_STAGES.filter(([k]) => { const s = db.perf.stages?.[k]; return s?.date && !s.done && (addDays(s.date, -14) === d || addDays(s.date, -1) === d); }).length : 0; } catch { }
  let holSoon = ''; try { if (school && typeof acadNextHoliday === 'function' && db.acad?.start) { const h = acadNextHoliday(addDays(d, 1)); if (h && h.from > d && acadPrevSchool(h.from) === d) holSoon = h.name; } } catch { }
  const at = (hm) => { const [h, m] = String(hm || '07:00').split(':').map(Number); const x = parse(d); x.setHours(h || 0, m || 0, 0, 0); return x.getTime(); };
  if (c.mOn && (school || due || ev.length)) {
    const parts = [];
    if (due) parts.push(hpN(due, 'مهمة واحدة', 'مهمتان', 'مهام'));
    if (ev.length) parts.push(hpN(ev.length, 'موعد واحد', 'موعدان', 'مواعيد'));
    const hr = Number(String(c.morning).split(':')[0]);
    let body = `${hr < 12 ? 'صباح الخير' : 'مساء الخير'} يا ${nm} 🌷 ` + (parts.length ? `عندك اليوم ${parts.join(' و')}.` : 'يومك اليوم خفيف ☀️');
    if (late) body += ` وفيه ${hpN(late, 'مهمة متأخرة', 'مهمتان متأخرتان', 'مهام متأخرة')} 👀`;
    if (occ) body += ' واليوم مناسبة 🎉';
    if (msg) body += ' وحان وقت رسالة للمعلمات 💌';
    if (pf) body += ' وموعد الأداء الوظيفي قريب 📈';
    if (holSoon) body += ` وبعد اليوم تبدأ ${holSoon} 🏖️`;
    items.push({ at: at(c.morning), title: 'هدهد 👧', body, url: due || late ? './#go=tasks' : './#go=dashboard', tag: 'm' + d });
  }
  const left = open.filter((x) => x.due && x.due <= d).length;
  if (c.lateOn && school && left) items.push({ at: at(c.lateTime), title: 'هدهد 👧', body: `طق طق طق! 👀 باقي ${hpN(left, 'مهمة واحدة', 'مهمتان', 'مهام')} ما خلصت. تقدرين! 💪`, url: './#go=tasks', tag: 'l' + d });
  if (c.evOn) ev.filter((e) => /^\d{1,2}:\d{2}$/.test(e.time || '')).forEach((e, i) => items.push({ at: at(e.time) - 15 * 60000, title: 'هدهد 👧', body: `⏰ عندك موعد الساعة ${e.time}، باقي ربع ساعة`, url: './#go=calendar', tag: `e${d}${i}` }));
  return items;
}
function hpPlan() {
  const c = hpCfg(), t = todayISO(), now = Date.now();
  if (!c.on) return [];
  let out = [];
  for (let i = 0; i < 7; i++) out = out.concat(hpDay(addDays(t, i), c));
  return out.filter((x) => x.at > now + 60000).sort((a, b) => a.at - b.at);
}
async function hpSync(force) {
  if (!db || !hpReady() || HP.busy) return;
  if (IS_WEBAPP && typeof Sync !== 'undefined' && Sync.status && Sync.status !== 'on') return; // الجوال ينتظر وصول أحدث البيانات أولاً
  const items = hpPlan(), j = JSON.stringify(items);
  if (!force && (j === HP.last || Date.now() - HP.lastAt < 120000)) return;
  HP.busy = true;
  try { const r = await hpFetch('plan', { method: 'PUT', body: JSON.stringify({ items }) }); if (r.ok) { HP.last = j; HP.lastAt = Date.now(); HP.err = ''; } else HP.err = r.status === 404 ? '' : 'خادم الإشعارات ' + r.status; }
  catch (e) { HP.err = e.message; }
  HP.busy = false;
}

// ───── الاشتراك في هذا الجوال ─────
async function hpState() {
  if (!hpCan()) return;
  try { HP.sid = (await IDB.get('kv', 'hudPushSid')) || ''; const reg = await navigator.serviceWorker.getRegistration(); HP.sub = reg ? await reg.pushManager.getSubscription() : null; } catch { }
}
async function hpSubscribe() {
  if (!hpReady()) return toast('اربطي الجوال بالمزامنة المشفّرة أولاً', 'err');
  if (!hpCan()) return toast(hpIOS() ? 'أضيفي البرنامج إلى الشاشة الرئيسية ثم افتحيه من الأيقونة' : 'المتصفح لا يدعم الإشعارات', 'err');
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('لم تُسمح الإشعارات. فعّليها من إعدادات الجوال ← الإشعارات', 'err');
    const reg = await navigator.serviceWorker.ready;
    const { key } = await (await fetch(RELAY.cfg.url + '/push/key', { cache: 'no-store' })).json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: rlUnb64u(key) });
    const sid = HP.sid || rlHex(crypto.getRandomValues(new Uint8Array(16)));
    const r = await hpFetch('sub/' + sid, { method: 'PUT', body: JSON.stringify(sub.toJSON()) });
    if (!r.ok) throw new Error('الخادم ' + r.status + (r.status === 404 ? ' — حدّثي خادم المزامنة' : ''));
    await IDB.put('kv', 'hudPushSid', sid);
    await (await caches.open('hud-push')).put('cfg', new Response(JSON.stringify({ url: RELAY.cfg.url, sid })));
    HP.sid = sid; HP.sub = sub;
    await hpSync(true);
    await hpFetch('test', { method: 'POST', body: JSON.stringify({ body: `هلا ${typeof hudName === 'function' ? hudName() : ''}! من الحين بوصلك إشعاراتي هنا 💜` }) });
    toast('✓ تفعّلت إشعارات هدهد في هذا الجوال', 'ok');
  } catch (e) { toast('تعذّر التفعيل: ' + e.message, 'err'); }
  render();
}
async function hpUnsub() {
  try { if (HP.sid && hpReady()) await hpFetch('sub/' + HP.sid, { method: 'DELETE' }); } catch { }
  try { await HP.sub?.unsubscribe(); await caches.delete('hud-push'); await IDB.put('kv', 'hudPushSid', ''); } catch { }
  HP.sid = ''; HP.sub = null; toast('أُوقفت الإشعارات في هذا الجوال'); render();
}

// ───── الإعدادات ─────
addHook('settingsCards', () => {
  if (!db) return '';
  const c = hpCfg(), on = !!(HP.sid && HP.sub);
  let dev = '';
  if (!hpReady()) dev = '<div class="banner" style="margin:8px 0"><span>🔗</span><div>تعمل بعد ربط الجوال بالكمبيوتر من «المزامنة المشفّرة».</div></div>';
  else if (!IS_WEBAPP) dev = '<div class="muted" style="margin:6px 0">تُفعَّل من الجوال نفسه: افتحي البرنامج في الجوال ← الإعدادات ← «تفعيل إشعارات هدهد». هذا الكمبيوتر يحدّث مواعيدها تلقائياً.</div>';
  else if (hpIOS() && !hpStandalone()) dev = '<div class="banner" style="margin:8px 0"><span>📲</span><div>أضيفي البرنامج إلى الشاشة الرئيسية أولاً (زر المشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية»)، ثم افتحيه من الأيقونة وارجعي هنا.</div></div>';
  else if (!hpCan()) dev = '<div class="muted" style="margin:6px 0">هذا المتصفح لا يدعم الإشعارات. في الآيفون يلزم iOS 16.4 أو أحدث.</div>';
  else dev = on ? '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0"><span class="chip green">مفعّلة في هذا الجوال ✓</span><button class="btn sm" data-act="hpTest">🔔 تجربة</button><button class="btn sm danger" data-act="hpUnsub">إيقافها في هذا الجوال</button></div>'
    : '<button class="btn primary" style="margin:8px 0" data-act="hpSub">🔔 تفعيل إشعارات هدهد في هذا الجوال</button>';
  return `<div class="card"><h3>🔔 إشعارات هدهد على الجوال</h3>
    <div class="muted" style="margin-bottom:6px">تصلكِ من هدهد حتى والبرنامج مغلق. تحتوي أرقاماً فقط (عدد المهام والمواعيد) دون أي تفاصيل، حفاظاً على الخصوصية.</div>
    ${dev}
    <label class="hud-row"><input type="checkbox" ${c.on ? 'checked' : ''} data-change="hpBool" data-id="on"> تشغيل الإشعارات</label>
    <div class="form" style="margin-top:6px">
      <div class="field"><label><input type="checkbox" ${c.mOn ? 'checked' : ''} data-change="hpBool" data-id="mOn"> تحية الصباح مع ملخص اليوم</label><input class="input" type="time" value="${esc(c.morning)}" data-change="hpTime" data-id="morning"></div>
      <div class="field"><label><input type="checkbox" ${c.lateOn ? 'checked' : ''} data-change="hpBool" data-id="lateOn"> «طق طق» إذا بقيت مهام لم تُنجز</label><input class="input" type="time" value="${esc(c.lateTime)}" data-change="hpTime" data-id="lateTime"></div>
    </div>
    <label class="hud-row"><input type="checkbox" ${c.evOn ? 'checked' : ''} data-change="hpBool" data-id="evOn"> قبل كل موعد بربع ساعة</label>
    ${HP.err ? `<div style="color:var(--red);font-size:12.5px">⚠️ ${esc(HP.err)}</div>` : ''}</div>`;
});
Object.assign(ACTIONS, {
  hpSub: () => hpSubscribe(),
  hpUnsub: () => confirmBox('إيقاف إشعارات هدهد في هذا الجوال؟', hpUnsub, 'نعم، أوقفيها'),
  hpTest: async () => { try { const r = await (await hpFetch('test', { method: 'POST', body: '{}' })).json(); toast(r.sent ? 'أُرسل إشعار تجربة ✓ (قد يتأخر ثوانٍ)' : 'لم يُرسل: أعيدي التفعيل', r.sent ? 'ok' : 'err'); } catch (e) { toast(e.message, 'err'); } },
});
Object.assign(CHANGES, {
  hpBool: (el) => hpSet({ [el.dataset.id]: el.checked }),
  hpTime: (el) => { if (/^\d{2}:\d{2}$/.test(el.value)) hpSet({ [el.dataset.id]: el.value }); },
});

// فتح القسم المطلوب عند الضغط على الإشعار
function hpGoHash() {
  const m = location.hash.match(/go=([a-z]+)/); if (!m || !db) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (VIEWS[m[1]]) go(m[1]);
}
window.addEventListener('hashchange', hpGoHash);
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { const u = e.data?.hudGo; if (u) { const m = String(u).match(/go=([a-z]+)/); if (m && VIEWS[m[1]]) go(m[1]); } });
(function hpStart() {
  if (!db || typeof RELAY === 'undefined') return setTimeout(hpStart, 500);
  hpGoHash();
  hpState().then(() => { if (ui.view === 'settings') render(); });
  setTimeout(() => hpSync(true), 20000);
  setInterval(() => hpSync(false), 60000);
})();
