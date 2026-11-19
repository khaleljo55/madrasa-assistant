// ═════════════ 👧 هدهد: الشخصية المساعدة (1.3.0) ═════════════
// طفلة كرتونية في زاوية الشاشة: تحيّي الأستاذة، وتطلّ بعبارات لطيفة، وتطرق الشاشة للتنبيهات المهمة،
// وتحتفل بإنجاز المهام، وعند الضغط عليها تفتح بطاقة «اسألي هدهد». شكلها (الشعر واللبس والنظارة)
// يُضبط من «إعدادات هدهد»، مع لبس لكل يوم من أيام الأسبوع ولبس لكل مزاج.
// الرسومات في hudhud-art.js: 7 وضعيات + قناع تلوين لكل وضعية (أحمر=الشعر، أخضر=الفستان والإكسسوار، أزرق=القميص).
// 0 ترحيب بذراع ممدودة · 1 تلويح · 2 إعجاب وغمزة · 3 تفكير · 4 تصفيق · 5 قراءة · 6 قفزة مع كتاب
const HUD = { el: null, cache: new Map(), key: '', urls: null, pose: 5, hideT: null, lastPop: Date.now(), greeted: false, ac: null, painting: null };
const HUD_REF = [[18, 0.69, 0.455], [284, 0.41, 0.40], [297, 0.52, 0.91]]; // متوسط لون الشعر والفستان والقميص في الرسم الأصلي
const HUD_HAIR = [
  { id: 'orig', name: 'كستنائي', c: '#b5552a' }, { id: 'gold', name: 'أشقر ذهبي', c: '#e9b949' }, { id: 'blond', name: 'أشقر فاتح', c: '#f2d68a' },
  { id: 'brown', name: 'بني', c: '#7a4a2a' }, { id: 'black', name: 'أسود', c: '#2b2220' }, { id: 'orange', name: 'برتقالي', c: '#e8782a' }, { id: 'pink', name: 'وردي', c: '#f29bbd' },
];
const HUD_OUTFITS = [
  { id: 'purple', name: 'بنفسجي', dress: '#6f3aa0', shirt: '#eedff7', orig: true },
  { id: 'pink', name: 'وردي', dress: '#e0569a', shirt: '#fde4ef' }, { id: 'sky', name: 'سماوي', dress: '#3b8fd9', shirt: '#e4f1fc' },
  { id: 'mint', name: 'نعناعي', dress: '#22a07f', shirt: '#e1f6ef' }, { id: 'red', name: 'أحمر', dress: '#d0433d', shirt: '#fff1ee' },
  { id: 'yellow', name: 'أصفر مشمس', dress: '#e8b21f', shirt: '#fff8dc' }, { id: 'navy', name: 'كحلي', dress: '#2c3f78', shirt: '#f4f6fb' },
  { id: 'orange', name: 'برتقالي', dress: '#ec7a2c', shirt: '#fff1e3' }, { id: 'custom', name: 'ألواني', custom: true },
];
const HUD_GLASSES = [{ id: 'none', name: 'بدون' }, { id: 'round', name: '👓 دائرية' }, { id: 'heart', name: '💗 قلوب' }, { id: 'star', name: '⭐ نجوم' }, { id: 'sun', name: '🕶️ شمسية' }];
const HUD_MOODS = [
  { id: 'happy', ic: '😊', name: 'رايقة', outfit: 'yellow', say: 'يا سلام! مزاجك رايق اليوم، ولبست الأصفر عشانك ☀️' },
  { id: 'excited', ic: '🤩', name: 'متحمسة', outfit: 'pink', say: 'وأنا متحمسة معك! يلا ننجز 💪' },
  { id: 'busy', ic: '⏳', name: 'مشغولة', outfit: 'navy', say: 'فهمت! بكون هادئة اليوم وما أزعجك إلا للمهم 🤫' },
  { id: 'tired', ic: '😴', name: 'متعبة', outfit: 'mint', say: 'سلامتك 🤍 خذيها بهدوء، وأنا معك' },
];
const HUD_SIZES = { s: 130, m: 170, l: 215 };
const hudCfg = () => {
  const c = db.settings.hudhud || {};
  return {
    on: true, mode: 'peek', size: 'm', freq: 25, knock: true,
    hair: 'orig', hairCustom: '#c98b4a', outfit: 'purple', customDress: '#7b3fb5', customShirt: '#efe3fb', glasses: 'none', glassesColor: '#c0392b',
    weekOn: true, ...c,
    week: { 0: 'purple', 1: 'sky', 2: 'mint', 3: 'pink', 4: 'yellow', ...(c.week || {}) },
    moodOutfit: Object.fromEntries(HUD_MOODS.map((m) => [m.id, (c.moodOutfit || {})[m.id] || m.outfit])),
  };
};
const hudSet = (patch, rerender = false) => { db.settings.hudhud = { ...(db.settings.hudhud || {}), ...patch }; commit(rerender); hudRefresh(); };
const hudMood = () => { const m = db.settings.hudhud?.mood; return m && m.day === todayISO() ? HUD_MOODS.find((x) => x.id === m.id) : null; };
const hudName = () => { const n = String(db.settings.employeeName || '').trim().split(/\s+/)[0]; return n ? `أستاذة ${n}` : 'أستاذتي'; };
const hudPick = (a) => a[Math.floor(Math.random() * a.length)];
const hudFill = (s) => String(s).replace(/\{n\}/g, hudName());

// اللبس الحالي: مزاج اليوم ← لبس اليوم من الأسبوع ← اللبس الأساسي
function hudOutfitId(c = hudCfg()) {
  const m = hudMood(); if (m) return c.moodOutfit[m.id];
  const d = new Date().getDay();
  if (c.weekOn && d <= 4 && c.week[d]) return c.week[d];
  return c.outfit;
}
function hudLook(c = hudCfg(), outfitId = hudOutfitId(c)) {
  const o = HUD_OUTFITS.find((x) => x.id === outfitId) || HUD_OUTFITS[0];
  const hair = c.hair === 'custom' ? c.hairCustom : c.hair === 'orig' ? null : HUD_HAIR.find((h) => h.id === c.hair)?.c || null;
  return { hair, dress: o.custom ? c.customDress : o.orig ? null : o.dress, shirt: o.custom ? c.customShirt : o.orig ? null : o.shirt, glasses: c.glasses, gc: c.glassesColor };
}

// ───── التلوين: تغيير لون المناطق مع الحفاظ على الظل والإضاءة ─────
function hudHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hudRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const hudHex = (x) => { const n = parseInt(String(x).replace('#', ''), 16); return hudHsl((n >> 16) & 255, (n >> 8) & 255, n & 255); };
const hudImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function hudPaint(n, look) {
  const A = HUD_ART[n], T = [look.hair, look.dress, look.shirt].map((c) => (c ? hudHex(c) : null));
  if (!T.some(Boolean)) return A.img;
  const [im, mk] = await Promise.all([hudImg(A.img), hudImg(A.mask)]);
  const cv = document.createElement('canvas'); cv.width = A.w; cv.height = A.h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(mk, 0, 0); const M = x.getImageData(0, 0, A.w, A.h).data;
  x.clearRect(0, 0, A.w, A.h); x.drawImage(im, 0, 0);
  const D = x.getImageData(0, 0, A.w, A.h), P = D.data;
  for (let i = 0; i < P.length; i += 4) {
    if (!P[i + 3]) continue;
    let hsl = null;
    for (let k = 0; k < 3; k++) {
      const w = M[i + k] / 255, t = T[k];
      if (w < 0.03 || !t) continue;
      hsl = hsl || hudHsl(P[i], P[i + 1], P[i + 2]);
      const [rh, rs, rl] = HUD_REF[k];
      let dh = hsl[0] - rh; dh = ((dh + 540) % 360) - 180;
      const s = Math.min(1, hsl[1] * (t[1] / rs));
      const l = t[2] >= rl ? hsl[2] + (t[2] - rl) * (1 - hsl[2]) / (1 - rl) : hsl[2] * t[2] / rl;
      const [r, g, b] = hudRgb(t[0] + (k ? Math.max(-8, Math.min(8, dh * 0.3)) : dh * 0.6), s, Math.max(0, Math.min(1, l)));
      P[i] += (r - P[i]) * w; P[i + 1] += (g - P[i + 1]) * w; P[i + 2] += (b - P[i + 2]) * w;
    }
  }
  x.putImageData(D, 0, 0);
  return cv.toDataURL('image/png');
}
async function hudUrls(look) {
  const key = JSON.stringify([look.hair, look.dress, look.shirt]);
  if (!HUD.cache.has(key)) {
    HUD.cache.set(key, Promise.all(HUD_ART.map((_, n) => hudPaint(n, look).catch(() => HUD_ART[n].img))));
    if (HUD.cache.size > 4) HUD.cache.delete(HUD.cache.keys().next().value);
  }
  return HUD.cache.get(key);
}

// ───── النظارة: تُرسم فوق العينين بحسب الوضعية ─────
function hudGlassesSvg(n, look) {
  const A = HUD_ART[n], [lx, ly, rx, ry, r0] = A.eyes, kind = look.glasses;
  if (!kind || kind === 'none') return '';
  const c = esc(look.gc || '#c0392b'), r = r0 * (kind === 'star' ? 1.3 : 1.5), sw = Math.max(1.6, r0 * 0.28);
  const lens = (x, y) => {
    if (kind === 'heart') { const s = r * 1.05; return `<path d="M${x} ${y + s * 0.85} C${x - s * 1.5} ${y - s * 0.1} ${x - s * 0.75} ${y - s * 1.1} ${x} ${y - s * 0.4} C${x + s * 0.75} ${y - s * 1.1} ${x + s * 1.5} ${y - s * 0.1} ${x} ${y + s * 0.85}Z" fill="rgba(255,255,255,.18)" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"/>`; }
    if (kind === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.6 : r * 1.12; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); } return `<polygon points="${pts.join(' ')}" fill="rgba(255,255,255,.18)" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"/>`; }
    if (kind === 'sun') return `<ellipse cx="${x}" cy="${y}" rx="${r * 1.05}" ry="${r * 0.9}" fill="#1d1d24" fill-opacity=".86" stroke="${c}" stroke-width="${sw}"/><path d="M${x - r * 0.5} ${y - r * 0.35} q${r * 0.3} -${r * 0.3} ${r * 0.6} -${r * 0.25}" stroke="#fff" stroke-opacity=".6" stroke-width="${sw * 0.7}" fill="none" stroke-linecap="round"/>`;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.18)" stroke="${c}" stroke-width="${sw}"/>`;
  };
  const gap = Math.hypot(rx - lx, ry - ly) / 2 - r * 0.95;
  const bridge = gap > 0 ? `<path d="M${lx + r * 0.95} ${ly - r * 0.15} Q${(lx + rx) / 2} ${(ly + ry) / 2 - r * 0.55} ${rx - r * 0.95} ${ry - r * 0.15}" stroke="${c}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` : '';
  return `<svg class="hud-gl" viewBox="0 0 ${A.w} ${A.h}" aria-hidden="true">${bridge}${lens(lx, ly)}${lens(rx, ry)}</svg>`;
}
// شكل كامل (صورة + نظارة) لاستخدامه في المعاينة
async function hudFigure(n, look) { const urls = await hudUrls(look); return `<img src="${urls[n]}" alt="">${hudGlassesSvg(n, look)}`; }

// ───── صوت الطرق ─────
// صوت الطرق «طق طق طق» يُولَّد داخل البرنامج دون ملفات صوتية
function hudKnockSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const A = HUD.ac || (HUD.ac = new AC()); A.resume?.();
    [0, 0.21, 0.42].forEach((dt) => {
      const T = A.currentTime + 0.02 + dt;
      const o = A.createOscillator(), g = A.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(210, T); o.frequency.exponentialRampToValueAtTime(70, T + 0.12);
      g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.9, T + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.17);
      o.connect(g).connect(A.destination); o.start(T); o.stop(T + 0.2);
      const len = Math.floor(A.sampleRate * 0.05), b = A.createBuffer(1, len, A.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const s = A.createBufferSource(), f = A.createBiquadFilter(), g2 = A.createGain();
      s.buffer = b; f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.9; g2.gain.value = 0.55;
      s.connect(f).connect(g2).connect(A.destination); s.start(T);
    });
  } catch { }
}

// ───── العبارات ─────
const HUD_TXT = {
  morning: ['صباح الخير {n}! كيف حالك اليوم؟ ☀️', 'صباح الورد يا {n} 🌷 كيف حالك اليوم؟', 'صباح النشاط يا {n}! نمتِ زين؟ 😊'],
  evening: ['مساء الخير {n}! كيف يومك إلى الحين؟ 🌤️', 'هلا والله {n}! مساء الورد 🌸'],
  night: ['مساء الخير {n}، تأخرتِ الليلة… لا تتعبين نفسك 🌙'],
  sun: 'بداية أسبوع جديد، وأنا متحمسة معك 💪', thu: 'اليوم خميس! يلا نخلّص الشغل ونرتاح 🎉', weekend: 'اليوم إجازة! حتى أنا بلعب اليوم 🎈',
  pop: ['أنا هنا إذا احتجتِ أي شيء! اضغطي عليّ 🙋‍♀️', 'لا تنسين تشربين ماء 💧', 'خذي نفس عميق… وابتسمي 😊', 'تدرين إنك رائعة؟ 💜', 'أنا أقرأ قصتي بهدوء… كمّلي شغلك 📖',
    'تبين توصلين لأي شيء بسرعة؟ اضغطي Ctrl + K 🔎', 'إذا تعبتِ قومي تمشّي شوي 🚶‍♀️', 'كل مهمة تخلّصينها نجمة جديدة ⭐', 'اسأليني: كيف أسوي كذا؟ وأنا أدلّك 🤔',
    'تعرفين إني أقدر أغيّر لبسي؟ من «إعدادات هدهد» 👗', 'يا حلو الشغل اليوم! 🌟', 'رتّبتِ مهام بكرة؟ 📝'],
  happy: ['مزاجك حلو اليوم وأنا مبسوطة! 🎈', 'يا سلام على الروقان ☀️', 'نرقص؟ 💃 لا لا… نشتغل أول 😄'],
  excited: ['هيا هيا! وش المهمة الجاية؟ 🚀', 'اليوم يومك يا {n}! 🌟'],
  tired: ['شوي شوي يا {n}، ما في شيء مستعجل 🤍', 'ارتاحي دقيقتين، وأنا أحرس الشاشة 😌', 'كوب شاي يعدّل المزاج ☕'],
  done: ['يااااي! خلّصتِ مهمة 👏', 'برافو يا {n}! ⭐', 'مهمة أقل… وابتسامة أكثر 😄', 'شطورة! كمّلي 💪'],
};
// سؤال وجواب: [السؤال، الجواب، القسم]
const HUD_FAQ = [
  ['كيف أضيف مهمة جديدة؟', 'من «المهام» اضغطي «＋ مهمة»، واكتبي العنوان والتاريخ ثم «حفظ». وإذا خلّصتِ المهمة اضغطي المربع بجانبها وأنا أصفّق لك 👏', 'tasks'],
  ['كيف أشوف مواعيدي في التقويم؟', 'من «التقويم» تظهر المهام والمواعيد والإجازات في شهر واحد، واضغطي أي يوم لتشوفين تفاصيله أو تضيفين موعداً.', 'calendar'],
  ['كيف أعرف الإجازة القادمة وأسبوع الدراسة؟', 'من «التقويم الدراسي» تظهر بداية العام والفصول والإجازات، والأسبوع الحالي، وكم باقي على الإجازة.', 'acad'],
  ['كيف أرسل تهنئة أو ترحيب للمعلمات؟', 'من «التقويم الدراسي» تظهر رسائل المناسبات قبل وقتها بيومين: تهنئة بالإجازة، والترحيب بالعودة، واستقبال أول يوم. افتحي الرسالة وعدّليها ثم أرسليها.', 'acad'],
  ['كيف أتابع الأداء الوظيفي والشواهد؟', 'من «الأداء الوظيفي»: الميثاق والأهداف، ثم «＋ شاهد» لإضافة الشواهد، وخطة العمل، ومراحل التقييم مع التذكيرات.', 'perf'],
  ['كيف أضيف معلمة؟', 'من «المعلمات» اضغطي «＋ معلمة» واكتبي اسمها وجوالها وبريدها.', 'teachers'],
  ['كيف أسجل غياب معلمة؟', 'من «سجل الغياب (فارس)» اضغطي «＋ تسجيل غياب» واختاري المعلمة والنوع والتاريخ.', 'absence'],
  ['كيف أوزّع حصص الانتظار؟', 'من «حصص الانتظار» يقترح البرنامج المعلمات المتاحات حسب جدول الحصص، وتقدرين تعتمدين التوزيع وتطبعينه.', 'subs'],
  ['كيف أدخل جدول الحصص؟', 'من «جدول الحصص» أدخلي حصص كل معلمة، ويستفيد منه توزيع الانتظار والمناوبة.', 'timetable'],
  ['كيف أوزّع المناوبة؟', 'من «المناوبة» اضغطي «✨ توزيع تلقائي» ثم راجعي التوزيع واطبعيه.', 'duties'],
  ['كيف أجهّز الإذاعة المدرسية؟', 'من «الإذاعة» تقدرين توزعين الإذاعة على الفصول تلقائياً وتجهزين فقراتها.', 'assembly'],
  ['كيف أسجل ملاحظة إشراف على الفسحة؟', 'من «الإشراف على الفسحة» اضغطي «＋ ملاحظة إشراف».', 'break'],
  ['كيف أضيف مناسبة عالمية أو وطنية؟', 'من «الأيام العالمية والوطنية» اضغطي «＋ مناسبة»، وتظهر لك قبل موعدها.', 'occasions'],
  ['كيف أسجل زائراً؟', 'من «سجل الزوار» اضغطي «＋ زائر».', 'visitors'],
  ['كيف أكتب خطاباً رسمياً؟', 'من «الخطابات» اختاري قالباً وعبّئي البيانات ثم اطبعيه أو صدّريه.', 'letters'],
  ['كيف أتابع التعاميم ومن اطّلعت عليها؟', 'من «التعاميم» اضغطي «＋ تعميم»، وتابعي اطلاع المعلمات، وأرسلي تذكيراً لمن لم تطّلع.', 'circulars'],
  ['كيف أكتب محضر اجتماع؟', 'من «محاضر الاجتماعات» اضغطي «＋ محضر اجتماع».', 'meetings'],
  ['كيف أطبع تقريراً؟', 'من «التقارير» اختاري نوع التقرير والفترة ثم «🖨 طباعة / PDF» أو صدّريه Word.', 'report'],
  ['كيف أشوف الإحصاءات؟', 'من «الإحصاءات» تظهر أرقام الغياب والمهام والمتابعة برسوم بيانية.', 'stats'],
  ['كيف أسوي عرضاً تقديمياً؟', 'من «العروض التقديمية» اضغطي «＋ عرض جديد»، ويمكن تنزيله PowerPoint.', 'present'],
  ['كيف أحفظ ملفاً في مكتبة المعرفة؟', 'من «مكتبة المعرفة» أضيفي الملفات والتعاميم، أو اسحبيها وأفلتيها في النافذة.', 'library'],
  ['كيف أبحث عن أي شيء بسرعة؟', 'اضغطي Ctrl + K من أي مكان واكتبي ما تبحثين عنه.', ''],
  ['كيف أحفظ نسخة احتياطية؟', 'من «الإعدادات» ← المزامنة والنسخ ← «حفظ نسخة احتياطية». ونسخة يومية تُرسل لبريدك تلقائياً إذا فعّلتِها.', 'settings'],
  ['كيف أفتح البرنامج من الجوال؟', 'من «الإعدادات» ← المزامنة المشفّرة ← اعرضي رمز الربط وافتحي رابط البرنامج في الجوال وأدخلي الرمز.', 'settings'],
  ['كيف أرسل رسالة للمعلمات على جوالاتهن؟', 'من «تطبيق التواصل» ← المعلمات والإداريات: أرسلي «رابط التسجيل» لهن، واقبلي طلباتهن، ثم «الرسائل» ← رسالة جديدة، وتابعي من اطّلعت.', 'comms'],
  ['كيف أطلب من الطالبات أوراقاً أو أذكّرهن؟', 'من «تطبيق التواصل» ← الطالبات ← «المطلوب»: اكتبي المطلوب وآخر موعد، وتابعي من سلّمت. ومن «التذكيرات» أرسلي تذكيراً يصل في يومه.', 'comms'],
  ['كيف أغيّر لبس هدهد أو لون شعرها؟', 'من «إعدادات هدهد»: لون الشعر، واللبس، والنظارة، ولبس لكل يوم، ولبس لكل مزاج 👗', 'hudset'],
];

// ───── العنصر في الشاشة ─────
function hudMount() {
  if (HUD.el || !db) return;
  const el = document.createElement('div'); el.id = 'hud'; el.className = 'hud';
  el.innerHTML = `<div class="hud-bubble" hidden><button class="hud-x" title="إغلاق">×</button><div class="hud-txt"></div><div class="hud-acts"></div></div>
    <div class="hud-panel" hidden></div><div class="hud-fig" title="اضغطي عليّ 😊"><div class="hud-body"></div></div>`;
  document.body.appendChild(el); HUD.el = el;
  el.querySelector('.hud-fig').addEventListener('click', () => hudTogglePanel());
  el.querySelector('.hud-x').addEventListener('click', () => hudHideBubble());
  el.querySelector('.hud-bubble').addEventListener('mouseenter', () => clearTimeout(HUD.hideT));
  el.querySelector('.hud-bubble').addEventListener('mouseleave', () => { if (!el.querySelector('.hud-bubble').hidden) HUD.hideT = setTimeout(hudHideBubble, 4000); });
  el.addEventListener('input', (e) => { if (e.target.id === 'hudQ') hudFilterFaq(e.target.value); });
  hudRefresh();
}
async function hudRefresh() {
  if (!db) return;
  const c = hudCfg();
  document.body.classList.toggle('hud-on', !!c.on);
  if (!c.on) { if (HUD.el) HUD.el.hidden = true; return; }
  if (!HUD.el) return hudMount();
  HUD.el.hidden = false;
  HUD.el.style.setProperty('--hud-h', (window.innerWidth < 700 ? HUD_SIZES.s : HUD_SIZES[c.size] || 170) + 'px');
  HUD.el.classList.toggle('peek', c.mode === 'peek' && !HUD.el.classList.contains('up'));
  const look = hudLook(c), key = JSON.stringify(look);
  if (key === HUD.key && HUD.urls) return;
  HUD.key = key; HUD.look = look;
  const urls = await hudUrls(look);
  if (HUD.key !== key) return;
  HUD.urls = urls; hudPose(HUD.pose);
}
function hudPose(n) {
  HUD.pose = n; if (!HUD.el || !HUD.urls) return;
  const A = HUD_ART[n];
  HUD.el.querySelector('.hud-body').innerHTML = `<img src="${HUD.urls[n]}" alt="هدهد" style="aspect-ratio:${A.w}/${A.h}">${hudGlassesSvg(n, HUD.look)}`;
}
function hudAnim(cls, ms) { const b = HUD.el?.querySelector('.hud-fig'); if (!b) return; b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls); setTimeout(() => b.classList.remove(cls), ms); }
const hudRest = () => (hudMood()?.id === 'tired' ? 6 : 5);
function hudUp() { if (!HUD.el) return; HUD.el.classList.add('up'); HUD.el.classList.remove('peek'); }
function hudDown() { if (!HUD.el) return; HUD.el.classList.remove('up'); HUD.el.classList.toggle('peek', hudCfg().mode === 'peek'); }
const hudCanShow = () => db && hudCfg().on && HUD.el && !document.hidden && !modalCtx && !document.querySelector('.lock-screen') && !document.getElementById('restOverlay');

// قول عبارة مع وضعية وأزرار
function hudSay(text, { pose = 1, acts = '', ms, anim = 'pop', info = '' } = {}) {
  if (!HUD.el || !hudCfg().on) return;
  const t = hudFill(text);
  const b = HUD.el.querySelector('.hud-bubble');
  b.querySelector('.hud-txt').innerHTML = `<b>${esc(t)}</b>${info ? `<div class="hud-info">${info}</div>` : ''}`;
  b.querySelector('.hud-acts').innerHTML = acts;
  b.hidden = false; b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
  HUD.el.querySelector('.hud-panel').hidden = true;
  hudUp(); hudPose(pose); if (anim) hudAnim(anim, 900);
  clearTimeout(HUD.hideT); HUD.hideT = setTimeout(hudHideBubble, ms || Math.max(9000, 6000 + t.length * 90 + (info ? 6000 : 0) + (acts ? 8000 : 0)));
  HUD.lastPop = Date.now();
}
function hudHideBubble() {
  clearTimeout(HUD.hideT); if (!HUD.el) return;
  const b = HUD.el.querySelector('.hud-bubble'); b.hidden = true;
  if (HUD.el.querySelector('.hud-panel').hidden) { hudDown(); hudPose(hudRest()); }
}
// الطرق على الشاشة للتنبيهات المهمة
function hudKnock(text, acts = '') {
  if (!HUD.el || !hudCfg().on) return;
  if (!hudCfg().knock) return hudSay(text, { pose: 3, acts });
  hudHideBubble(); hudUp(); hudPose(1);
  setTimeout(() => {
    hudKnockSound(); hudAnim('knock', 760);
    document.getElementById('app')?.classList.remove('hud-shake'); void document.getElementById('app')?.offsetWidth; document.getElementById('app')?.classList.add('hud-shake');
    setTimeout(() => document.getElementById('app')?.classList.remove('hud-shake'), 700);
    [0, 210, 420].forEach((d, i) => setTimeout(() => {
      const s = document.createElement('span'); s.className = 'hud-tq'; s.textContent = 'طق!'; s.style.setProperty('--dx', (i - 1) * 26 + 'px');
      HUD.el.appendChild(s); setTimeout(() => s.remove(), 1100);
    }, d));
    setTimeout(() => { hudSay('طق طق طق! ' + text, { pose: 0, acts, anim: '' }); }, 800);
  }, 450);
}
function hudCelebrate(allDone) {
  if (!hudCanShow()) return;
  hudSay(allDone ? 'خلّصتِ كل مهام اليوم! 🎉 تستاهلين استراحة' : hudPick(HUD_TXT.done), { pose: 4, anim: 'hop', ms: 6000 });
  const box = HUD.el; for (let i = 0; i < 14; i++) { const s = document.createElement('span'); s.className = 'hud-conf'; s.textContent = hudPick(['⭐', '✨', '💜', '🌸', '🎉']); s.style.setProperty('--x', (Math.random() * 160 - 30) + 'px'); s.style.setProperty('--d', (Math.random() * 0.4) + 's'); box.appendChild(s); setTimeout(() => s.remove(), 1700); }
}

// ───── معلومات اليوم للتحية ─────
function hudToday() {
  const t = todayISO(), open = (db.tasks || []).filter((x) => x.status !== 'done');
  const today = open.filter((x) => x.due === t).length, late = open.filter((x) => x.due && x.due < t).length;
  const lines = [];
  if (today) lines.push(`📌 عندك ${today} ${today === 1 ? 'مهمة' : 'مهام'} اليوم`);
  try { const h = typeof acadNextHoliday === 'function' && db.acad?.start ? acadNextHoliday(t) : null; if (h && h.from > t) { const d = Math.round((parse(h.from) - parse(t)) / 864e5); lines.push(`🏖️ ${d === 1 ? 'بكرة تبدأ' : `باقي ${d === 2 ? 'يومان' : `${d} ${d <= 10 ? 'أيام' : 'يوماً'}`} على`} ${esc(h.name)}`); } } catch { }
  let due = 0; try { due = typeof acadDue === 'function' && db.acad?.start ? acadDue(t).length : 0; } catch { }
  return { today, late, due, lines };
}
function hudGreet() {
  if (HUD.greeted) return;
  if (!hudCanShow()) { if (db && hudCfg().on) setTimeout(hudGreet, 30000); return; }
  HUD.greeted = true;
  const h = new Date().getHours(), d = new Date().getDay(), t = todayISO();
  let s = hudPick(h < 12 ? HUD_TXT.morning : h < 19 ? HUD_TXT.evening : HUD_TXT.night);
  let extra = d === 0 ? HUD_TXT.sun : d === 4 ? HUD_TXT.thu : d >= 5 ? HUD_TXT.weekend : '';
  try { const hol = typeof acadHoliday === 'function' ? acadHoliday(t) : null; if (hol) extra = `نحن في ${hol.name}! استمتعي بإجازتك 🏖️`; } catch { }
  const info = hudToday();
  const lines = [extra && esc(extra), ...info.lines].filter(Boolean).map((x) => `<div>${x}</div>`).join('');
  const moodAsk = hudMood() ? '' : `<div class="hud-ask">كيف مزاجك اليوم؟</div>${HUD_MOODS.map((m) => `<button class="hud-chip" data-act="hudMood" data-id="${m.id}">${m.ic} ${m.name}</button>`).join('')}`;
  hudSay(s, { pose: 1, info: lines, acts: moodAsk });
  if (info.late || info.due) setTimeout(() => hudAlert(), 16000);
}
function hudAlert() {
  if (!hudCanShow()) { setTimeout(hudAlert, 60000); return; }
  const info = hudToday();
  if (info.late) hudKnock(`عندك ${info.late} ${info.late === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'} 👀`, '<button class="btn sm primary" data-act="hudGo" data-id="tasks">وريني إياها</button>');
  else if (info.due) hudKnock('حان وقت رسالة مناسبة للمعلمات 💌', '<button class="btn sm primary" data-act="hudGo" data-id="acad">افتحيها</button>');
}
function hudPop() {
  if (!hudCanShow() || !HUD.el.querySelector('.hud-bubble').hidden || !HUD.el.querySelector('.hud-panel').hidden) return;
  const m = hudMood();
  if (m?.id === 'busy') return;
  const info = hudToday();
  let pool = [...HUD_TXT.pop];
  if (m && HUD_TXT[m.id]) pool = [...HUD_TXT[m.id], ...HUD_TXT[m.id], ...pool];
  if (info.today) pool.push(`باقي عندك ${info.today} ${info.today === 1 ? 'مهمة' : 'مهام'} اليوم، تقدرين! 💪`);
  hudSay(hudPick(pool), { pose: hudPick([1, 2, 6, 0]), anim: hudPick(['pop', 'hop']), ms: 9000 });
}
function hudTick() {
  if (!db || !HUD.el) return;
  const c = hudCfg(); if (!c.on) return;
  if (HUD.el.querySelector('.hud-bubble').hidden && HUD.el.querySelector('.hud-panel').hidden && Math.random() < 0.35) hudPose(hudPick([5, 5, 3, 6, 2]));
  const f = Number(c.freq) || 0;
  if (f && Date.now() - HUD.lastPop > f * 60000) hudPop();
}

// ───── بطاقة «اسألي هدهد» ─────
function hudTogglePanel(force) {
  const p = HUD.el.querySelector('.hud-panel'), open = force ?? p.hidden;
  if (!open) { p.hidden = true; hudHideBubble(); return; }
  HUD.el.querySelector('.hud-bubble').hidden = true; clearTimeout(HUD.hideT);
  if (HUD.el.classList.contains('sleep')) { HUD.el.classList.remove('sleep'); HUD.lastPop = Date.now(); }
  const c = hudCfg(), m = hudMood();
  p.innerHTML = `<div class="hud-ph"><b>👧 اسألي هدهد</b><span class="spacer"></span><button class="hud-x" data-act="hudClose" title="إغلاق">×</button></div>
    <div class="hud-moods"><span class="muted">مزاجي اليوم:</span>${HUD_MOODS.map((x) => `<button class="hud-chip ${m?.id === x.id ? 'on' : ''}" data-act="hudMood" data-id="${x.id}">${x.ic} ${x.name}</button>`).join('')}</div>
    <input class="input" id="hudQ" placeholder="كيف أ… (اكتبي سؤالك)" autocomplete="off">
    <div class="hud-faq">${HUD_FAQ.map(([q, a, v], i) => `<details data-i="${i}"><summary>${esc(q)}</summary><div>${esc(a)}</div>${v ? `<button class="btn sm" data-act="hudGo" data-id="${v}">خذيني هناك ←</button>` : ''}</details>`).join('')}<div class="hud-none muted" hidden>ما لقيت سؤالك 🙈 جرّبي كلمة ثانية، أو ابحثي في البرنامج كله بـ Ctrl + K</div></div>
    <div class="hud-pf"><button class="btn sm" data-act="hudGo" data-id="hudset">👗 إعدادات هدهد</button><button class="btn sm" data-act="hudSleep">😴 نامي ساعة</button></div>`;
  p.hidden = false; hudUp(); hudPose(2); hudAnim('pop', 700);
  setTimeout(() => p.querySelector('#hudQ')?.focus(), 50);
}
function hudFilterFaq(q) {
  const words = String(q).replace(/[؟?]/g, ' ').trim().split(/\s+/).filter((w) => w.length > 1 && !/^(كيف|ابي|أبي|ابغى|أبغى|اسوي|أسوي|وش|ايش|هل|من|في|على)$/.test(w));
  const norm = (s) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  let shown = 0;
  HUD.el.querySelectorAll('.hud-faq details').forEach((d) => {
    const [qq, a] = HUD_FAQ[d.dataset.i], hay = norm(qq + ' ' + a);
    const ok = !words.length || words.some((w) => hay.includes(norm(w).replace(/^ال/, '')));
    d.hidden = !ok; if (ok) shown++;
    d.open = !!words.length && ok && shown === 1;
  });
  HUD.el.querySelector('.hud-none').hidden = shown > 0;
}

// ───── الإعدادات ─────
const hudSw = (act, id, on, style, title) => `<button class="hud-sw ${on ? 'on' : ''}" data-act="${act}" data-id="${id}" title="${esc(title)}" style="${style}"></button>`;
const hudOutSel = (change, val, id = '') => `<select class="input" data-change="${change}" data-id="${id}">${HUD_OUTFITS.map((o) => `<option value="${o.id}" ${o.id === val ? 'selected' : ''}>${o.name}</option>`).join('')}</select>`;
function hudSettingsCard() {
  const c = hudCfg();
  const outSw = (o) => o.custom ? `background:conic-gradient(${c.customDress} 0 50%, ${c.customShirt} 0)` : `background:linear-gradient(135deg, ${o.shirt} 0 34%, ${o.dress} 34%)`;
  setTimeout(hudPreview, 0);
  return `<div class="card" id="hudCard" style="grid-column:1/-1"><h3>👧 إعدادات هدهد</h3>
    <div class="hud-set">
      <div class="hud-prev"><div class="hud-prev-fig" id="hudPrev"></div><div class="muted" style="font-size:12px;text-align:center">لبس اليوم: <b>${esc(HUD_OUTFITS.find((o) => o.id === hudOutfitId(c))?.name || '')}</b>${hudMood() ? ` · مزاج ${hudMood().ic}` : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px"><button class="btn sm" data-act="hudTest" data-id="greet">👋 التحية</button><button class="btn sm" data-act="hudTest" data-id="knock">✊ طق طق</button><button class="btn sm" data-act="hudTest" data-id="done">👏 احتفال</button></div></div>
      <div class="hud-opts">
        <label class="hud-row"><input type="checkbox" ${c.on ? 'checked' : ''} data-change="hudBool" data-id="on"> إظهار هدهد في الشاشة</label>
        <div class="form">
          <div class="field"><label>طريقة الظهور</label><select class="input" data-change="hudVal" data-id="mode"><option value="peek" ${c.mode === 'peek' ? 'selected' : ''}>تختبئ في الزاوية وتطلّ فجأة</option><option value="stay" ${c.mode === 'stay' ? 'selected' : ''}>ظاهرة دائماً في الزاوية</option></select></div>
          <div class="field"><label>الحجم</label><select class="input" data-change="hudVal" data-id="size"><option value="s" ${c.size === 's' ? 'selected' : ''}>صغيرة</option><option value="m" ${c.size === 'm' ? 'selected' : ''}>متوسطة</option><option value="l" ${c.size === 'l' ? 'selected' : ''}>كبيرة</option></select></div>
          <div class="field"><label>تطلّ بعبارة لطيفة</label><select class="input" data-change="hudVal" data-id="freq">${[[10, 'كل ١٠ دقائق'], [25, 'كل ٢٥ دقيقة'], [45, 'كل ٤٥ دقيقة'], [90, 'كل ساعة ونصف'], [0, 'فقط للتحية والتنبيهات']].map(([v, l]) => `<option value="${v}" ${Number(c.freq) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <label class="hud-row"><input type="checkbox" ${c.knock ? 'checked' : ''} data-change="hudBool" data-id="knock"> تطرق الشاشة «طق طق» للتنبيهات المهمة (مهام متأخرة، رسائل مناسبات)</label>

        <h4>💇‍♀️ لون الشعر</h4>
        <div class="hud-sws">${HUD_HAIR.map((h) => hudSw('hudHair', h.id, c.hair === h.id, `background:${h.c}`, h.name)).join('')}<label class="hud-sw ${c.hair === 'custom' ? 'on' : ''}" title="لون آخر" style="background:${c.hairCustom}"><input type="color" value="${c.hairCustom}" data-change="hudHairCustom"></label></div>

        <h4>👗 اللبس الأساسي</h4>
        <div class="hud-sws">${HUD_OUTFITS.map((o) => hudSw('hudOutfit', o.id, c.outfit === o.id, outSw(o), o.name)).join('')}</div>
        <div class="hud-row" style="gap:14px;flex-wrap:wrap"><span class="muted">«ألواني»:</span><label>الفستان <input type="color" value="${c.customDress}" data-change="hudVal" data-id="customDress"></label><label>القميص <input type="color" value="${c.customShirt}" data-change="hudVal" data-id="customShirt"></label></div>

        <h4>👓 النظارة</h4>
        <div class="hud-row" style="flex-wrap:wrap;gap:6px">${HUD_GLASSES.map((g) => `<button class="btn sm ${c.glasses === g.id ? 'primary' : ''}" data-act="hudGlasses" data-id="${g.id}">${g.name}</button>`).join('')}<label style="margin-inline-start:8px">اللون <input type="color" value="${c.glassesColor}" data-change="hudVal" data-id="glassesColor"></label></div>

        <h4>📅 لبس أيام الأسبوع</h4>
        <label class="hud-row"><input type="checkbox" ${c.weekOn ? 'checked' : ''} data-change="hudBool" data-id="weekOn"> تغيّر لبسها حسب اليوم</label>
        <div class="hud-grid">${[0, 1, 2, 3, 4].map((d) => `<div class="field"><label>${DOW[d]}</label>${hudOutSel('hudWeek', c.week[d], d)}</div>`).join('')}</div>

        <h4>😊 لبس المزاج</h4>
        <div class="muted" style="font-size:12.5px;margin-bottom:6px">إذا اخترتِ مزاجك من بطاقة هدهد، تلبس لبس المزاج طوال ذلك اليوم.</div>
        <div class="hud-grid">${HUD_MOODS.map((m) => `<div class="field"><label>${m.ic} ${m.name}</label>${hudOutSel('hudMoodOutfit', c.moodOutfit[m.id], m.id)}</div>`).join('')}</div>
      </div></div></div>`;
}
async function hudPreview() {
  const box = $('#hudPrev'); if (!box) return;
  const look = hudLook();
  const html = await hudFigure(0, look);
  if ($('#hudPrev') === box) box.innerHTML = html;
}

// ───── الربط مع البرنامج ─────
addHook('settingsCards', () => (db ? hudSettingsCard() : ''));
const _hudTaskToggle = ACTIONS.taskToggle;
ACTIONS.taskToggle = (el, e) => {
  const t = db.tasks.find((x) => x.id === el.dataset.id), was = t?.status;
  _hudTaskToggle(el, e);
  if (t && was !== 'done' && t.status === 'done') {
    const left = db.tasks.filter((x) => x.status !== 'done' && x.due && x.due <= todayISO()).length;
    hudCelebrate(left === 0 && db.tasks.some((x) => x.due === todayISO()));
  }
};
Object.assign(ACTIONS, {
  hudClose: () => hudTogglePanel(false),
  hudGo: (el) => {
    const v = el.dataset.id; hudTogglePanel(false); hudHideBubble();
    if (v === 'hudset') { go('settings'); setTimeout(() => $('#hudCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
    else if (v) go(v);
  },
  hudMood: (el) => {
    const m = HUD_MOODS.find((x) => x.id === el.dataset.id); if (!m) return;
    db.settings.hudhud = { ...(db.settings.hudhud || {}), mood: { day: todayISO(), id: m.id } }; commit(ui.view === 'settings');
    HUD.key = ''; hudTogglePanel(false); hudRefresh().then(() => hudSay(m.say, { pose: m.id === 'tired' ? 6 : 4, anim: 'hop' }));
  },
  hudSleep: () => { hudTogglePanel(false); HUD.lastPop = Date.now() + 60 * 60000; HUD.el.classList.add('sleep'); setTimeout(() => HUD.el?.classList.remove('sleep'), 60 * 60000); toast('هدهد نايمة ساعة 😴 اضغطي عليها لتصحو'); },
  hudHair: (el) => hudSet({ hair: el.dataset.id }, true),
  hudOutfit: (el) => hudSet({ outfit: el.dataset.id }, true),
  hudGlasses: (el) => hudSet({ glasses: el.dataset.id }, true),
  hudTest: (el) => {
    const k = el.dataset.id; HUD.greeted = false;
    if (k === 'greet') { HUD.greeted = false; hudGreet(); }
    else if (k === 'knock') hudKnock('هذا مثال لتنبيه مهم 👀');
    else if (k === 'done') hudCelebrate(false);
    HUD.greeted = true;
  },
});
Object.assign(CHANGES, {
  hudBool: (el) => hudSet({ [el.dataset.id]: el.checked }, el.dataset.id === 'weekOn'),
  hudVal: (el) => { const k = el.dataset.id; let v = el.value; if (k === 'freq') v = Number(v); hudSet({ [k]: v }, /^(custom|glassesColor)/.test(k)); if (k === 'freq') HUD.lastPop = Date.now(); },
  hudHairCustom: (el) => hudSet({ hair: 'custom', hairCustom: el.value }, true),
  hudWeek: (el) => hudSet({ week: { ...hudCfg().week, [el.dataset.id]: el.value } }, true),
  hudMoodOutfit: (el) => hudSet({ moodOutfit: { ...hudCfg().moodOutfit, [el.dataset.id]: el.value } }, true),
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && HUD.el && !HUD.el.querySelector('.hud-panel').hidden) hudTogglePanel(false); });
document.addEventListener('click', (e) => { if (HUD.el && !HUD.el.contains(e.target) && !HUD.el.querySelector('.hud-panel').hidden) hudTogglePanel(false); });
window.addEventListener('resize', () => { if (HUD.el) HUD.el.style.setProperty('--hud-h', (window.innerWidth < 700 ? HUD_SIZES.s : HUD_SIZES[hudCfg().size] || 170) + 'px'); });
(function hudStart() {
  if (!db || !document.getElementById('app')) return setTimeout(hudStart, 400);
  hudMount();
  setTimeout(hudGreet, 2500);
  setInterval(hudTick, 60000);
  let day = todayISO(); setInterval(() => { if (todayISO() !== day) { day = todayISO(); HUD.key = ''; hudRefresh(); } }, 60000);
})();
