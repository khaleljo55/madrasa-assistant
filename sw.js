// المساعد الإداري 1.8.0
const CACHE = 'madrasa-1.8.0-mwnkmuhj';
const SHELL = ["./","acad.js","acct.js","app.js","apple-touch-icon.png","assembly.js","bkmail.js","comms.js","custom.js","extras.js","hudhud-art.js","hudhud-icon.png","hudhud.js","icon-192.png","icon-512.png","icon.png","index.html","kits-data.js","kits.js","lib/docx.js","lib/jszip.js","lib/licenses/pptxgenjs-LICENSE.txt","lib/pdf-lib.js","lib/pdf.js","lib/pdf.worker.js","lib/pptxgen.bundle.js","manifest.webmanifest","merge.js","mobile.js","notify.js","office.js","org.js","perf.js","phase2.js","present.js","push.js","quran.js","radio-data.js","relay-cfg.js","relay.js","robots.txt","search.js","sms.js","stats.js","students.js","styles.css","subs.js","sw-reg.js","tools.js"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'hud-push' && !k.startsWith('staff') && !k.startsWith('student')).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// إشعارات هدهد: التنبيه يصل دون محتوى، ثم يُجلب نصه من صندوق هذا الجوال في خادم المزامنة
self.addEventListener('push', (e) => e.waitUntil((async () => {
  let items = [];
  try {
    const r = await (await caches.open('hud-push')).match('cfg'), cfg = r && await r.json();
    if (cfg) { const res = await fetch(cfg.url + '/push/inbox/' + cfg.sid, { cache: 'no-store' }); if (res.ok) items = (await res.json()).items || []; }
  } catch (err) { }
  if (!items.length) items = [{ title: 'هدهد 👧', body: 'عندي لك شيء في المساعد الإداري 💜', url: './', tag: 'hud' }];
  await Promise.all(items.slice(-3).map((m) => self.registration.showNotification(m.title || 'هدهد 👧', { body: m.body || '', icon: 'hudhud-icon.png', tag: m.tag || 'hud', lang: 'ar', dir: 'rtl', data: { url: m.url || './' } })));
})()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) { c.postMessage({ hudGo: url }); return c.focus(); }
    return clients.openWindow(url);
  }));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // طلبات مايكروسوفت تمر مباشرة
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
