// تواصل الطالبات 1.8.0-mwnkmuhk
const P = 'student', CACHE = P + '-1.8.0-mwnkmuhk';
const SHELL = ['./', 'index.html', 'mode.js', 'staff.js', 'staff.css', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(P + '-') && k !== CACHE && k !== P + '-push').map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true })).then((r) => r || fetch(e.request)));
});
self.addEventListener('push', (e) => e.waitUntil((async () => {
  let items = [];
  try {
    const r = await (await caches.open(P + '-push')).match('cfg'), cfg = r && await r.json();
    if (cfg && cfg.tok) { const res = await fetch(cfg.url + '/st/notes', { cache: 'no-store', headers: { Authorization: 'Bearer ' + cfg.tok } }); if (res.ok) items = (await res.json()).items || []; }
  } catch (err) { }
  if (!items.length) items = [{ title: '📬 تواصل الطالبات', body: 'وصلكِ جديد', url: './' }];
  await Promise.all(items.slice(-3).map((m, i) => self.registration.showNotification(m.title, { body: m.body || '', icon: 'icon-192.png', tag: 'st' + (m.id || i), lang: 'ar', dir: 'rtl', data: { url: m.url || './' } })));
})()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.url) || './';
  const url = new URL(go, self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.postMessage({ go }); return c.focus(); }
    return clients.openWindow(url);
  }));
});
