// بناء نسخة الجوال (تطبيق ويب يُثبَّت على الشاشة الرئيسية) في المجلد dist-web
// الاستخدام: node web/build-web.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-web');
const ver = require(path.join(ROOT, 'package.json')).version;

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'app'), OUT, { recursive: true, filter: (p) => !/voice\.html$/.test(p) });
for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'hudhud-icon.png']) fs.copyFileSync(path.join(__dirname, f), path.join(OUT, f));

// index.html: بيانات التثبيت على الشاشة الرئيسية
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
html = html.replace('width=device-width, initial-scale=1"', 'width=device-width, initial-scale=1, viewport-fit=cover"')
  .replace('<link rel="icon" href="icon.png">', `<link rel="icon" href="icon.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#0f6b5c">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="المساعد الإداري">
<meta name="robots" content="noindex, nofollow">`)
  .replace('<script src="relay.js"></script>', '<script src="relay.js"></script>\n<script src="sw-reg.js"></script>');
if (!html.includes('workers.dev') || !html.includes('manifest.webmanifest') || !html.includes('sw-reg.js')) throw new Error('تعذّر تعديل index.html');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'المساعد الإداري', short_name: 'المساعد الإداري', lang: 'ar', dir: 'rtl',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#f4f6f5', theme_color: '#0f6b5c',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
}, null, 2));

fs.writeFileSync(path.join(OUT, 'sw-reg.js'), `if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'activated' && navigator.serviceWorker.controller) toast('تم تحديث التطبيق — أعيدي فتحه لتظهر الإضافات الجديدة', 'ok'); }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
// عامل الخدمة: يعمل التطبيق دون إنترنت، ويُحدَّث تلقائياً عند نشر نسخة جديدة
const files = [];
(function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; e.isDirectory() ? walk(path.join(d, e.name), r) : files.push(r); } })(OUT, '');
const shell = ['./', ...files.filter((f) => !/^(sw\.js|\.nojekyll)$/.test(f))];
fs.writeFileSync(path.join(OUT, 'sw.js'), `// المساعد الإداري ${ver}
const CACHE = 'madrasa-${ver}-${Date.now().toString(36)}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'hud-push').map((k) => caches.delete(k)))).then(() => self.clients.claim())));
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
`);
console.log(`✓ نسخة الجوال ${ver} جاهزة في dist-web (${files.length + 4} ملفات)`);
