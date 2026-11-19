// المساعد الإداري 1.3.0
const CACHE = 'madrasa-1.3.0-mwn6p4g7';
const SHELL = ["./","acad.js","app.js","apple-touch-icon.png","assembly.js","bkmail.js","custom.js","extras.js","hudhud-art.js","hudhud.js","icon-192.png","icon-512.png","icon.png","index.html","kits-data.js","kits.js","lib/docx.js","lib/jszip.js","lib/licenses/pptxgenjs-LICENSE.txt","lib/pdf-lib.js","lib/pdf.js","lib/pdf.worker.js","lib/pptxgen.bundle.js","manifest.webmanifest","mobile.js","notify.js","office.js","org.js","perf.js","phase2.js","present.js","quran.js","radio-data.js","relay.js","robots.txt","search.js","sms.js","stats.js","students.js","styles.css","subs.js","sw-reg.js","tools.js"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // طلبات مايكروسوفت تمر مباشرة
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
