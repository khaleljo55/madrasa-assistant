/* المساعد الإداري — الأدوات المساعدة وتذكير الراحة */
'use strict';

// ═════════════ تحميل المكتبات عند الحاجة ═════════════
const _scripts = {};
function loadScript(src) {
  return _scripts[src] || (_scripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل ' + src));
    document.head.appendChild(s);
  }));
}
async function loadPdfJs() { await loadScript('lib/pdf.worker.js'); await loadScript('lib/pdf.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.js'; return pdfjsLib; }
const loadPdfLib = () => loadScript('lib/pdf-lib.js').then(() => PDFLib);
const loadDocx = () => loadScript('lib/docx.js').then(() => docx);
const fmtBytes = (n) => (n >= 1e6 ? (n / 1048576).toFixed(2) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب');
const pickFiles = (accept, multiple) => new Promise((res) => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
  inp.onchange = () => res([...inp.files]); inp.click();
});
const readAsDataURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

// ═════════════ قائمة الأدوات ═════════════
const TOOLS = [
  { id: 'designer', ic: '🎨', name: 'المصمم', desc: 'رسم وتصميم شهادات الشكر واللوحات الترحيبية والإعلانات، وتصديرها صورة أو PDF' },
  { id: 'docs', ic: '📝', name: 'محرر المستندات', desc: 'خطابات ومحاضر وتعاميم بترويسة رسمية، وتصديرها ملف Word' },
  { id: 'compress', ic: '🗜️', name: 'ضغط PDF', desc: 'تقليل حجم ملفات PDF لإرسالها بالبريد أو رفعها على الأنظمة' },
  { id: 'merge', ic: '📎', name: 'دمج PDF', desc: 'جمع عدة ملفات PDF في ملف واحد بالترتيب الذي تريدينه' },
  { id: 'img2pdf', ic: '🖼️', name: 'صور إلى PDF', desc: 'تحويل صور المستندات الممسوحة بالجوال إلى ملف PDF واحد' },
  { id: 'dates', ic: '📆', name: 'محوّل التاريخ', desc: 'تحويل بين الهجري والميلادي، وحساب الأيام بين تاريخين' },
  { id: 'random', ic: '🎲', name: 'القرعة', desc: 'اختيار عشوائي عادل من قائمة أسماء المعلمات أو الطالبات' },
  { id: 'rest', ic: '☕', name: 'تذكير الراحة', desc: 'تذكير كل 25 دقيقة بعبارات مريحة ومحفّزة' },
];
const TOOL_VIEWS = {};

VIEWS.tools = {
  actions: () => (ui.tool ? `<button class="btn" data-act="toolBack">→ كل الأدوات</button>` : '') + (TOOL_VIEWS[ui.tool]?.actions?.() || ''),
  render() {
    if (ui.tool && TOOL_VIEWS[ui.tool]) return TOOL_VIEWS[ui.tool].render();
    return `<div class="tool-grid">${TOOLS.map((t) => `<button class="card tool-card" data-act="toolOpen" data-id="${t.id}">
      <span class="tool-ic">${t.ic}</span><span class="tool-name">${t.name}</span><span class="muted">${t.desc}</span></button>`).join('')}</div>`;
  },
  after() { if (ui.tool) TOOL_VIEWS[ui.tool]?.mount?.(); },
};
const _navAct = ACTIONS.nav;
Object.assign(ACTIONS, {
  nav: (el, e) => { if (el.dataset.id === 'tools') ui.tool = null; _navAct(el, e); },
  toolOpen: (el) => { ui.tool = el.dataset.id; ui.view = 'tools'; render(); },
  toolBack: () => { ui.tool = null; render(); },
});
// عنوان الصفحة يتبع الأداة المفتوحة
const _baseRender = render;
render = function () {
  _baseRender();
  try { restInfo(); } catch { }
  if (ui.view === 'tools' && ui.tool) { const t = TOOLS.find((x) => x.id === ui.tool); if (t) $('#pageTitle').textContent = `${t.ic} ${t.name}`; }
};

// ═════════════ 🎨 المصمم ═════════════
const DSIZES = { landscape: [1123, 794, 'A4 أفقي'], portrait: [794, 1123, 'A4 عمودي'], square: [1080, 1080, 'مربع (للتواصل)'], banner: [1500, 500, 'لوحة عريضة'] };
const DFONT = '"Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif';
const DS = { size: 'landscape', bg: '#ffffff', objs: [], sel: null, tool: 'select', color: '#0f6b5c', fill: '', lw: 4, fs: 44, bold: true, undo: [], redo: [], id: null, name: '' };
const D_TOOLS = [['select', '🖱️', 'تحديد وتحريك'], ['pen', '✏️', 'قلم'], ['marker', '🖍️', 'قلم تمييز'], ['text', '🔤', 'نص'], ['rect', '▭', 'مستطيل'], ['ellipse', '◯', 'دائرة'], ['line', '╱', 'خط'], ['arrow', '➜', 'سهم'], ['eraser', '🧽', 'حذف عنصر']];
const D_COLORS = ['#0f6b5c', '#1d2b28', '#ffffff', '#b8892b', '#c2410c', '#b42318', '#1d4ed8', '#7e22ce', '#15803d', '#f0b429', '#e85d3f', '#6b7c78'];

function dSnapshot() { DS.undo.push(JSON.stringify(DS.objs.map(stripImg))); if (DS.undo.length > 60) DS.undo.shift(); DS.redo = []; }
function stripImg(o) { const c = { ...o }; delete c._el; return c; }
function dRestore(json) { DS.objs = JSON.parse(json); DS.sel = null; dHydrate(); dDraw(); }
function dHydrate() { DS.objs.forEach((o) => { if (o.t === 'img' && !o._el) { o._el = new Image(); o._el.onload = dDraw; o._el.src = o.src; } }); }

function dTemplate(name) {
  const [w, h] = DSIZES[DS.size];
  const s = db.settings, school = s.schoolName || 'اسم المدرسة', t = todayISO();
  const T = (text, x, y, size, color = '#1d2b28', bold = false) => ({ t: 'text', text, x, y, size, color, bold });
  const R = (x, y, ww, hh, stroke, lw, fill = '', r = 0) => ({ t: 'rect', x, y, w: ww, h: hh, color: stroke, lw, fill, r });
  const cx = w / 2;
  if (name === 'cert') return { bg: '#fffdf6', objs: [
    R(28, 28, w - 56, h - 56, '#b8892b', 10), R(52, 52, w - 104, h - 104, '#0f6b5c', 2),
    T(school, cx, 120, 24, '#6b7c78'),
    T('شهادة شكر وتقدير', cx, h * 0.27, Math.round(w / 17), '#0f6b5c', true),
    T('يسرّ إدارة المدرسة أن تتقدم بخالص الشكر والتقدير', cx, h * 0.42, Math.round(w / 38)),
    T('للأستاذة / ............................', cx, h * 0.52, Math.round(w / 28), '#b8892b', true),
    T('نظير جهودها المتميزة وعطائها المستمر', cx, h * 0.62, Math.round(w / 38)),
    T('سائلين المولى لها دوام التوفيق والسداد', cx, h * 0.69, Math.round(w / 40), '#6b7c78'),
    T('قائدة المدرسة', w * 0.25, h * 0.83, 24, '#1d2b28', true), T('..........................', w * 0.25, h * 0.88, 22, '#6b7c78'),
    T(`التاريخ: ${fmtH(t)}`, w * 0.75, h * 0.85, 22, '#1d2b28'),
  ] };
  if (name === 'welcome') return { bg: '#0f6b5c', objs: [
    R(30, 30, w - 60, h - 60, '#f0d48a', 4, '', 24),
    T('أهلاً وسهلاً', cx, h * 0.33, Math.round(w / 12), '#ffffff', true),
    T('بفريق الزيارة الكرام', cx, h * 0.5, Math.round(w / 26), '#f0d48a', true),
    T(`${school} تتشرف بزيارتكم`, cx, h * 0.64, Math.round(w / 34), '#ffffff'),
    T('حياكم الله', cx, h * 0.8, Math.round(w / 40), '#cde8e1'),
  ] };
  if (name === 'notice') return { bg: '#ffffff', objs: [
    R(0, 0, w, Math.round(h * 0.2), '#0f6b5c', 0, '#0f6b5c'),
    T('إعلان', cx, Math.round(h * 0.1), Math.round(w / 16), '#ffffff', true),
    T('عنوان الإعلان هنا', cx, h * 0.34, Math.round(w / 26), '#0f6b5c', true),
    T('اكتبي تفاصيل الإعلان هنا\nويمكن إضافة أكثر من سطر', cx, h * 0.5, Math.round(w / 40), '#1d2b28'),
    R(0, h - Math.round(h * 0.1), w, Math.round(h * 0.1), '#e3f1ee', 0, '#e3f1ee'),
    T(school, cx, h - Math.round(h * 0.05), Math.round(w / 48), '#0f6b5c', true),
  ] };
  if (name === 'national') return { bg: '#0b5d3b', objs: [
    R(24, 24, w - 48, h - 48, '#ffffff', 3, '', 20),
    T('كل عام والوطن بخير', cx, h * 0.38, Math.round(w / 15), '#ffffff', true),
    T('دام عزّك يا وطن', cx, h * 0.55, Math.round(w / 28), '#cde8e1', true),
    T(school, cx, h * 0.78, Math.round(w / 42), '#ffffff'),
  ] };
  if (name === 'thanks-card') return { bg: '#f3e8ff', objs: [
    R(30, 30, w - 60, h - 60, '#7e22ce', 3, '#ffffff', 30),
    T('شكراً لكِ 💜', cx, h * 0.35, Math.round(w / 13), '#7e22ce', true),
    T('على عطائكِ وتميّزكِ', cx, h * 0.52, Math.round(w / 30), '#1d2b28'),
    T('الأستاذة / ............', cx, h * 0.66, Math.round(w / 30), '#7e22ce', true),
  ] };
  return { bg: '#ffffff', objs: [] };
}
const D_TEMPLATES = [['blank', 'صفحة فارغة'], ['cert', 'شهادة شكر وتقدير'], ['welcome', 'ترحيب بفريق الزيارة'], ['notice', 'إعلان'], ['national', 'تهنئة وطنية'], ['thanks-card', 'بطاقة شكر']];

TOOL_VIEWS.designer = {
  actions: () => `<button class="btn" data-act="dSave">💾 حفظ التصميم</button><button class="btn" data-act="dPng">⬇ صورة PNG</button><button class="btn primary" data-act="dPdf">⬇ PDF</button>`,
  render() {
    const designs = db.designs || [];
    return `<div class="designer">
      <div class="card d-side">
        <div class="field"><label>قالب جاهز</label><select class="input" data-change="dTpl"><option value="">— اختاري قالباً —</option>${D_TEMPLATES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="field"><label>مقاس اللوحة</label><select class="input" data-change="dSize">${Object.entries(DSIZES).map(([k, v]) => `<option value="${k}" ${DS.size === k ? 'selected' : ''}>${v[2]}</option>`).join('')}</select></div>
        <div class="field"><label>لون الخلفية</label><input type="color" class="input color-in" value="${DS.bg}" data-change="dBg"></div>
        <button class="btn" data-act="dImage">🖼️ إدراج صورة / شعار</button>
        <div class="section-title" style="margin:10px 0 4px">تصاميمي المحفوظة</div>
        ${designs.length ? `<div class="list">${designs.map((d) => `<div class="li"><div class="grow" style="cursor:pointer" data-act="dLoad" data-id="${d.id}"><div class="t">${esc(d.name)}</div><div class="s">${fmtG(d.updatedAt)}</div></div><button class="icon-btn" data-act="dDel" data-id="${d.id}">🗑️</button></div>`).join('')}</div>` : '<div class="muted">لا توجد تصاميم محفوظة</div>'}
      </div>
      <div class="d-main">
        <div class="card d-bar">
          <div class="d-tools">${D_TOOLS.map(([k, ic, l]) => `<button class="d-tool ${DS.tool === k ? 'on' : ''}" data-act="dTool" data-id="${k}" title="${l}">${ic}</button>`).join('')}</div>
          <span class="d-sep"></span>
          <div class="d-colors">${D_COLORS.map((c) => `<button class="d-color ${DS.color === c ? 'on' : ''}" style="background:${c}" data-act="dColor" data-id="${c}" title="${c}"></button>`).join('')}<input type="color" class="d-custom" value="${DS.color}" data-change="dColorCustom" title="لون آخر"></div>
          <span class="d-sep"></span>
          <label class="d-prop">السُّمك <input type="range" min="1" max="30" value="${DS.lw}" data-change="dLw"></label>
          <label class="d-prop">حجم الخط <input type="number" class="input" min="10" max="200" value="${DS.fs}" data-change="dFs" style="width:70px;padding:4px 6px"></label>
          <label class="d-prop"><input type="checkbox" ${DS.fill ? 'checked' : ''} data-change="dFill"> تعبئة</label>
          <label class="d-prop"><input type="checkbox" ${DS.bold ? 'checked' : ''} data-change="dBold"> عريض</label>
          <span class="d-sep"></span>
          <button class="icon-btn" data-act="dUndo" title="تراجع">↶</button><button class="icon-btn" data-act="dRedo" title="إعادة">↷</button>
          <button class="icon-btn" data-act="dDup" title="نسخ العنصر">⧉</button><button class="icon-btn" data-act="dFront" title="إلى الأمام">⬆</button><button class="icon-btn" data-act="dBack" title="إلى الخلف">⬇</button>
          <button class="icon-btn" data-act="dRemove" title="حذف العنصر">🗑️</button><button class="icon-btn" data-act="dClear" title="مسح الكل">🧹</button>
        </div>
        <div class="d-stage"><canvas id="dCanvas"></canvas></div>
        <div class="muted" style="margin-top:6px">نقرتان على أي نص لتعديله · اسحبي المربع الصغير في زاوية العنصر لتكبيره · مفتاح Delete لحذف العنصر المحدد</div>
      </div>
    </div>`;
  },
  mount() {
    const cv = $('#dCanvas'); if (!cv) return;
    const [w, h] = DSIZES[DS.size]; cv.width = w; cv.height = h;
    dHydrate(); dDraw();
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (w / r.width), (e.clientY - r.top) * (h / r.height)]; };
    let drag = null;
    cv.onpointerdown = (e) => {
      cv.setPointerCapture(e.pointerId);
      const [x, y] = pt(e);
      const tool = DS.tool;
      if (tool === 'select') {
        if (DS.sel && dHandleHit(DS.sel, x, y)) { dSnapshot(); drag = { mode: 'resize', x, y, o: DS.sel, orig: { ...stripImg(DS.sel), pts: DS.sel.pts && DS.sel.pts.map((p) => [...p]) } }; return; }
        const o = dHit(x, y); DS.sel = o; dSyncProps();
        if (o) { dSnapshot(); drag = { mode: 'move', x, y, o }; }
        dDraw(); return;
      }
      if (tool === 'eraser') { const o = dHit(x, y); if (o) { dSnapshot(); DS.objs = DS.objs.filter((i) => i !== o); DS.sel = null; dDraw(); } return; }
      if (tool === 'text') { dAddText(x, y); return; }
      dSnapshot();
      let o;
      if (tool === 'pen' || tool === 'marker') o = { t: 'path', pts: [[x, y]], color: DS.color, lw: tool === 'marker' ? Math.max(14, DS.lw * 3) : DS.lw, alpha: tool === 'marker' ? 0.35 : 1 };
      else if (tool === 'rect' || tool === 'ellipse') o = { t: tool, x, y, w: 1, h: 1, color: DS.color, lw: DS.lw, fill: DS.fill ? DS.color : '', r: 0 };
      else o = { t: 'line', x1: x, y1: y, x2: x, y2: y, color: DS.color, lw: DS.lw, arrow: tool === 'arrow' };
      DS.objs.push(o); drag = { mode: 'create', x, y, o };
    };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const [x, y] = pt(e); const o = drag.o;
      if (drag.mode === 'move') { const dx = x - drag.x, dy = y - drag.y; dMove(o, dx, dy); drag.x = x; drag.y = y; }
      else if (drag.mode === 'resize') dResize(o, drag, x, y);
      else if (o.t === 'path') o.pts.push([x, y]);
      else if (o.t === 'line') { o.x2 = x; o.y2 = y; }
      else { o.w = x - drag.x; o.h = y - drag.y; o.x = drag.x; o.y = drag.y; if (e.shiftKey) o.h = Math.sign(o.h || 1) * Math.abs(o.w); }
      dDraw();
    };
    cv.onpointerup = () => {
      if (drag?.mode === 'create') {
        const o = drag.o;
        if (o.t === 'rect' || o.t === 'ellipse') { if (o.w < 0) { o.x += o.w; o.w = -o.w; } if (o.h < 0) { o.y += o.h; o.h = -o.h; } if (o.w < 4 && o.h < 4) { DS.objs.pop(); DS.undo.pop(); } }
        if (o.t === 'path' && o.pts.length < 2) o.pts.push([o.pts[0][0] + 0.5, o.pts[0][1] + 0.5]);
        DS.sel = o.t === 'path' ? null : o;
      }
      drag = null; dDraw();
    };
    cv.ondblclick = (e) => { const [x, y] = pt(e); const o = dHit(x, y); if (o?.t === 'text') dEditText(o); };
  },
};
function dBBox(o) {
  if (o.t === 'rect' || o.t === 'ellipse' || o.t === 'img') return [o.x, o.y, o.w, o.h];
  if (o.t === 'line') return [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.abs(o.x2 - o.x1) || 1, Math.abs(o.y2 - o.y1) || 1];
  if (o.t === 'path') { const xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return [x, y, Math.max(...xs) - x || 1, Math.max(...ys) - y || 1]; }
  if (o.t === 'text') {
    const ctx = $('#dCanvas')?.getContext('2d'); if (!ctx) return [o.x, o.y, 1, 1];
    ctx.font = `${o.bold ? 'bold ' : ''}${o.size}px ${DFONT}`;
    const lines = String(o.text).split('\n'); const wd = Math.max(...lines.map((l) => ctx.measureText(l).width)); const lh = o.size * 1.35;
    return [o.x - wd / 2, o.y - lh / 2, wd, lh * lines.length];
  }
  return [0, 0, 0, 0];
}
function dHit(x, y) {
  for (let i = DS.objs.length - 1; i >= 0; i--) {
    const o = DS.objs[i]; let [bx, by, bw, bh] = dBBox(o); const pad = Math.max(8, (o.lw || 0) / 2 + 4);
    if (o.t === 'rect' && !o.fill && bw > 60 && bh > 60) { // إطار فارغ: يُحدَّد من حدوده فقط
      const near = Math.abs(x - bx) < pad || Math.abs(x - bx - bw) < pad || Math.abs(y - by) < pad || Math.abs(y - by - bh) < pad;
      if (near && x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad) return o; continue;
    }
    if (x >= bx - pad && x <= bx + bw + pad && y >= by - pad && y <= by + bh + pad) return o;
  }
  return null;
}
const dHandle = (o) => { const [x, y, w, h] = dBBox(o); return [x + w, y + h]; };
function dHandleHit(o, x, y) { const [hx, hy] = dHandle(o); return Math.abs(x - hx) < 14 && Math.abs(y - hy) < 14; }
function dMove(o, dx, dy) {
  if (o.t === 'line') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
  else if (o.t === 'path') o.pts.forEach((p) => { p[0] += dx; p[1] += dy; });
  else { o.x += dx; o.y += dy; }
}
function dResize(o, drag, x, y) {
  const g = drag.orig;
  if (o.t === 'rect' || o.t === 'ellipse') { o.w = Math.max(6, g.w + (x - drag.x)); o.h = Math.max(6, g.h + (y - drag.y)); }
  else if (o.t === 'img') { o.w = Math.max(20, g.w + (x - drag.x)); o.h = o.w * (g.h / g.w); }
  else if (o.t === 'text') { const [, , bw] = dBBox({ ...g }); o.size = Math.max(8, Math.round(g.size * (bw + (x - drag.x) * 2) / Math.max(bw, 1))); DS.fs = o.size; }
  else if (o.t === 'line') { o.x2 = g.x2 + (x - drag.x); o.y2 = g.y2 + (y - drag.y); }
}
function dDraw() {
  const cv = $('#dCanvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = DS.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  DS.objs.forEach((o) => dPaint(ctx, o));
  if (DS.sel && DS.objs.includes(DS.sel)) {
    const [x, y, w, h] = dBBox(DS.sel);
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
    ctx.setLineDash([]); const [hx, hy] = dHandle(DS.sel); ctx.fillStyle = '#fff'; ctx.fillRect(hx - 7, hy - 7, 14, 14); ctx.strokeRect(hx - 7, hy - 7, 14, 14); ctx.restore();
  }
}
function dPaint(ctx, o) {
  ctx.save();
  ctx.strokeStyle = o.color; ctx.fillStyle = o.fill || o.color; ctx.lineWidth = o.lw || 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.t === 'rect') {
    ctx.beginPath(); if (o.r && ctx.roundRect) ctx.roundRect(o.x, o.y, o.w, o.h, o.r); else ctx.rect(o.x, o.y, o.w, o.h);
    if (o.fill) ctx.fill(); if (o.lw > 0) ctx.stroke();
  } else if (o.t === 'ellipse') {
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.abs(o.w / 2), Math.abs(o.h / 2), 0, 0, Math.PI * 2);
    if (o.fill) ctx.fill(); if (o.lw > 0) ctx.stroke();
  } else if (o.t === 'line') {
    ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
    if (o.arrow) { const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), L = 14 + o.lw * 2.5; ctx.beginPath(); ctx.moveTo(o.x2, o.y2); ctx.lineTo(o.x2 - L * Math.cos(a - 0.45), o.y2 - L * Math.sin(a - 0.45)); ctx.lineTo(o.x2 - L * Math.cos(a + 0.45), o.y2 - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fillStyle = o.color; ctx.fill(); }
  } else if (o.t === 'path') {
    ctx.globalAlpha = o.alpha ?? 1; ctx.beginPath(); o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  } else if (o.t === 'text') {
    ctx.font = `${o.bold ? 'bold ' : ''}${o.size}px ${DFONT}`; ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    const lines = String(o.text).split('\n'), lh = o.size * 1.35;
    lines.forEach((l, i) => ctx.fillText(l, o.x, o.y + i * lh));
  } else if (o.t === 'img' && o._el?.complete) ctx.drawImage(o._el, o.x, o.y, o.w, o.h);
  ctx.restore();
}
function dSyncProps() {
  const o = DS.sel; if (!o) return;
  if (o.color) DS.color = o.color; if (o.lw) DS.lw = o.lw; if (o.t === 'text') { DS.fs = o.size; DS.bold = !!o.bold; }
  const bar = $('.d-bar'); if (!bar) return;
  $$('.d-color', bar).forEach((b) => b.classList.toggle('on', b.dataset.id === DS.color));
  const fs = $('[data-change=dFs]', bar); if (fs) fs.value = DS.fs;
  const lw = $('[data-change=dLw]', bar); if (lw) lw.value = DS.lw;
  const bd = $('[data-change=dBold]', bar); if (bd) bd.checked = DS.bold;
}
function dAddText(x, y) {
  formModal({ title: 'إضافة نص', fields: [{ key: 'text', label: 'النص', type: 'textarea', full: true, voice: true, required: true, rows: 3 }],
    onSave: (v) => { dSnapshot(); const o = { t: 'text', text: v.text, x, y, size: DS.fs, color: DS.color, bold: DS.bold }; DS.objs.push(o); DS.sel = o; DS.tool = 'select'; render(); } });
}
function dEditText(o) {
  formModal({ title: 'تعديل النص', fields: [{ key: 'text', label: 'النص', type: 'textarea', full: true, voice: true, required: true, rows: 3 }], values: { text: o.text },
    onSave: (v) => { dSnapshot(); o.text = v.text; DS.sel = o; render(); } });
}
function dApplyToSel(fn) { if (DS.sel) { dSnapshot(); fn(DS.sel); dDraw(); } }
function dExportCanvas() { const s = DS.sel; DS.sel = null; dDraw(); const c = $('#dCanvas'); DS.sel = s; return c; }
Object.assign(ACTIONS, {
  dTool: (el) => { DS.tool = el.dataset.id; if (DS.tool !== 'select') DS.sel = null; $$('.d-tool').forEach((b) => b.classList.toggle('on', b.dataset.id === DS.tool)); dDraw(); },
  dColor: (el) => { DS.color = el.dataset.id; $$('.d-color').forEach((b) => b.classList.toggle('on', b.dataset.id === DS.color)); dApplyToSel((o) => { o.color = DS.color; if (o.fill) o.fill = DS.color; }); },
  dUndo: () => { if (!DS.undo.length) return; DS.redo.push(JSON.stringify(DS.objs.map(stripImg))); dRestore(DS.undo.pop()); },
  dRedo: () => { if (!DS.redo.length) return; DS.undo.push(JSON.stringify(DS.objs.map(stripImg))); dRestore(DS.redo.pop()); },
  dRemove: () => { if (!DS.sel) return toast('حدّدي عنصراً أولاً'); dSnapshot(); DS.objs = DS.objs.filter((o) => o !== DS.sel); DS.sel = null; dDraw(); },
  dDup: () => { if (!DS.sel) return toast('حدّدي عنصراً أولاً'); dSnapshot(); const c = JSON.parse(JSON.stringify(stripImg(DS.sel))); dMove(c, 24, 24); DS.objs.push(c); DS.sel = c; dHydrate(); dDraw(); },
  dFront: () => { if (!DS.sel) return; DS.objs = DS.objs.filter((o) => o !== DS.sel).concat(DS.sel); dDraw(); },
  dBack: () => { if (!DS.sel) return; DS.objs = [DS.sel, ...DS.objs.filter((o) => o !== DS.sel)]; dDraw(); },
  dClear: () => confirmBox('مسح كل محتوى اللوحة؟', () => { dSnapshot(); DS.objs = []; DS.sel = null; render(); }, 'نعم، امسحي'),
  dImage: async () => {
    const [f] = await pickFiles('image/*'); if (!f) return;
    const src = await readAsDataURL(f); const im = new Image();
    im.onload = () => { const [w, h] = DSIZES[DS.size]; const sc = Math.min(1, (w * 0.4) / im.width, (h * 0.4) / im.height); dSnapshot(); const o = { t: 'img', src, x: (w - im.width * sc) / 2, y: (h - im.height * sc) / 2, w: im.width * sc, h: im.height * sc, _el: im }; DS.objs.push(o); DS.sel = o; DS.tool = 'select'; render(); };
    im.src = src;
  },
  dPng: () => { const c = dExportCanvas(); c.toBlob((b) => { openBlob(b, (DS.name || 'تصميم') + '.png', true); dDraw(); toast('حُفظت الصورة في «التنزيلات»'); }, 'image/png'); },
  dPdf: async () => {
    const L = await loadPdfLib(); const c = dExportCanvas();
    const png = await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer(); dDraw();
    const pdf = await L.PDFDocument.create(); const [w, h] = DSIZES[DS.size];
    const pw = DS.size === 'landscape' ? 842 : DS.size === 'portrait' ? 595 : w * 0.75, ph = DS.size === 'landscape' ? 595 : DS.size === 'portrait' ? 842 : h * 0.75;
    const pg = pdf.addPage([pw, ph]); const img = await pdf.embedPng(png); pg.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    openBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), (DS.name || 'تصميم') + '.pdf', true); toast('حُفظ ملف PDF في «التنزيلات»');
  },
  dSave: () => formModal({ title: 'حفظ التصميم', fields: [{ key: 'name', label: 'اسم التصميم', type: 'text', full: true, required: true }], values: { name: DS.name },
    onSave: (v) => {
      db.designs = db.designs || [];
      const data = { size: DS.size, bg: DS.bg, objs: DS.objs.map(stripImg) };
      let d = DS.id && db.designs.find((x) => x.id === DS.id);
      if (d) Object.assign(d, { name: v.name, data, updatedAt: todayISO() }); else { d = { id: uid(), name: v.name, data, updatedAt: todayISO() }; db.designs.unshift(d); }
      DS.id = d.id; DS.name = v.name; commit(); toast('تم حفظ التصميم', 'ok');
    } }),
  dLoad: (el) => { const d = (db.designs || []).find((x) => x.id === el.dataset.id); if (!d) return; Object.assign(DS, { size: d.data.size, bg: d.data.bg, objs: JSON.parse(JSON.stringify(d.data.objs)), sel: null, id: d.id, name: d.name, undo: [], redo: [] }); render(); },
  dDel: (el) => confirmBox('حذف هذا التصميم؟', () => { db.designs = db.designs.filter((x) => x.id !== el.dataset.id); if (DS.id === el.dataset.id) DS.id = null; commit(); }),
});
Object.assign(CHANGES, {
  dTpl: (el) => { if (!el.value) return; const go = () => { const t = dTemplate(el.value); dSnapshot(); DS.bg = t.bg; DS.objs = t.objs; DS.sel = null; DS.id = null; DS.name = ''; render(); }; DS.objs.length ? confirmBox('سيُستبدل محتوى اللوحة بالقالب. متابعة؟', go, 'نعم') : go(); el.value = ''; },
  dSize: (el) => { DS.size = el.value; render(); },
  dBg: (el) => { DS.bg = el.value; dDraw(); },
  dColorCustom: (el) => { DS.color = el.value; dApplyToSel((o) => { o.color = DS.color; if (o.fill) o.fill = DS.color; }); },
  dLw: (el) => { DS.lw = Number(el.value); dApplyToSel((o) => { if (o.t !== 'text' && o.t !== 'img') o.lw = DS.lw; }); },
  dFs: (el) => { DS.fs = Number(el.value) || 44; dApplyToSel((o) => { if (o.t === 'text') o.size = DS.fs; }); },
  dFill: (el) => { DS.fill = el.checked ? DS.color : ''; dApplyToSel((o) => { if (o.t === 'rect' || o.t === 'ellipse') o.fill = DS.fill; }); },
  dBold: (el) => { DS.bold = el.checked; dApplyToSel((o) => { if (o.t === 'text') o.bold = DS.bold; }); },
});
document.addEventListener('keydown', (e) => {
  if (ui.view !== 'tools' || ui.tool !== 'designer' || modalCtx) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && DS.sel && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); ACTIONS.dRemove(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); ACTIONS.dUndo(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); ACTIONS.dRedo(); }
});

// ═════════════ 📝 محرر المستندات ═════════════
const DOCS = { id: null, timer: null, range: null };
function letterhead() {
  const s = db.settings, t = todayISO();
  return `<table class="noborder lh" style="width:100%"><tbody><tr>
    <td style="width:40%;text-align:center"><b>المملكة العربية السعودية</b><br><b>وزارة التعليم</b><br>إدارة التعليم بـ ..........<br>${esc(s.schoolName || 'اسم المدرسة')}</td>
    <td style="width:20%"></td>
    <td style="width:40%;text-align:center">التاريخ: ${fmtH(t)}<br>الموافق: ${fmtG(t)}<br>الرقم: ..........<br>المرفقات: ..........</td>
  </tr></tbody></table><hr>`;
}
function docTemplate(k) {
  const s = db.settings, emp = esc(s.employeeName || '..........'), t = todayISO();
  const sign = `<p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%"></td><td style="width:50%;text-align:center"><b>قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`;
  if (k === 'letter') return ['خطاب رسمي', `${letterhead()}<p><b>سعادة / ..........................   المحترم</b></p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>اكتبي نص الخطاب هنا...</p><p>وتقبلوا خالص التحية والتقدير.</p>${sign}`];
  if (k === 'minutes') return ['محضر اجتماع', `${letterhead()}<h1 style="text-align:center">محضر اجتماع</h1>
    <table><tbody><tr><td style="width:18%"><b>التاريخ</b></td><td style="width:32%">${dayName(t)} ${fmtH(t)}</td><td style="width:18%"><b>الوقت</b></td><td style="width:32%"></td></tr><tr><td><b>المكان</b></td><td></td><td><b>رئيسة الاجتماع</b></td><td></td></tr></tbody></table>
    <h2>الحاضرات</h2><ol><li></li><li></li><li></li></ol><h2>جدول الأعمال</h2><ol><li></li><li></li></ol>
    <h2>التوصيات</h2><table><tbody><tr><td><b>م</b></td><td><b>التوصية</b></td><td><b>المسؤولة</b></td><td><b>موعد التنفيذ</b></td></tr><tr><td>1</td><td></td><td></td><td></td></tr><tr><td>2</td><td></td><td></td><td></td></tr></tbody></table>${sign}`];
  if (k === 'circular') return ['تعميم داخلي', `${letterhead()}<h1 style="text-align:center">تعميم داخلي رقم (   )</h1><p><b>إلى:</b> جميع منسوبات المدرسة</p><p><b>الموضوع:</b> ..........................</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>اكتبي نص التعميم هنا...</p><p>شاكرين تعاونكن.</p>${sign}`];
  if (k === 'notice') return ['إشعار للمعلمة', `${letterhead()}<h1 style="text-align:center">إشعار</h1><p>المكرمة الأستاذة / ..........................   وفقها الله</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>نفيدكِ بأنه قد لوحظ بتاريخ ${fmtH(t)} ما يلي: ..........................</p><p>نأمل منكِ مراعاة ذلك مستقبلاً، شاكرين تعاونكِ.</p>${sign}<p><br></p><p>توقيع المعلمة بالعلم: ..........................</p>`];
  if (k === 'thanks') return ['خطاب شكر', `${letterhead()}<h1 style="text-align:center">شكر وتقدير</h1><p>المكرمة الأستاذة / ..........................   وفقها الله</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p>يسرّنا أن نتقدم لكِ بخالص الشكر والتقدير على جهودكِ المتميزة في ..........................، سائلين الله لكِ دوام التوفيق والسداد.</p>${sign}`];
  return ['مستند جديد', `<p><br></p>`];
}
const DOC_TEMPLATES = [['blank', 'مستند فارغ'], ['letter', 'خطاب رسمي'], ['circular', 'تعميم داخلي'], ['minutes', 'محضر اجتماع'], ['notice', 'إشعار للمعلمة'], ['thanks', 'خطاب شكر']];
const curDoc = () => (db.documents || []).find((d) => d.id === DOCS.id);
TOOL_VIEWS.docs = {
  actions: () => (DOCS.id ? `<button class="btn" data-act="docPrint">🖨 طباعة / PDF</button><button class="btn primary" data-act="docExport">⬇ تصدير Word</button>` : ''),
  render() {
    const docs = (db.documents || []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const d = curDoc();
    return `<div class="designer">
      <div class="card d-side">
        <div class="section-title" style="margin-top:0">مستند جديد</div>
        <div class="tpl-list">${DOC_TEMPLATES.map(([k, l]) => `<button class="btn sm" data-act="docNew" data-id="${k}">＋ ${l}</button>`).join('')}</div>
        <div class="section-title">مستنداتي</div>
        ${docs.length ? `<div class="list">${docs.map((x) => `<div class="li ${x.id === DOCS.id ? 'sel-row' : ''}"><div class="grow" style="cursor:pointer" data-act="docOpen" data-id="${x.id}"><div class="t">${esc(x.title)}</div><div class="s">${fmtG(x.updatedAt)}</div></div><button class="icon-btn" data-act="docDel" data-id="${x.id}">🗑️</button></div>`).join('')}</div>` : '<div class="muted">لا توجد مستندات بعد</div>'}
      </div>
      <div class="d-main">${docsMain()}</div>
    </div>`;
  },
  mount() {
    const page = $('#docPage'); if (!page) return;
    const save = () => { clearTimeout(DOCS.timer); DOCS.timer = setTimeout(() => { const d = curDoc(); if (!d) return; d.html = page.innerHTML; d.updatedAt = todayISO(); commit(false); }, 600); };
    page.addEventListener('input', save);
    const keep = () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) DOCS.range = s.getRangeAt(0).cloneRange(); };
    ['keyup', 'mouseup', 'input', 'blur'].forEach((ev) => page.addEventListener(ev, keep));
    page._insert = (text) => { docRestore(); document.execCommand('insertText', false, (DOCS.range ? ' ' : '') + text); keep(); save(); };
    $('#docTitle').addEventListener('input', (e) => { const d = curDoc(); if (d) { d.title = e.target.value || 'مستند'; save(); } });
    page.focus();
  },
};
function docsMain() {
  const d = curDoc();
  return d ? `
        <div class="card d-bar">
          <input class="input" id="docTitle" value="${esc(d.title)}" style="width:200px" title="اسم المستند">
          <span class="d-sep"></span>
          <select class="input" data-change="docBlock" style="padding:4px 6px"><option value="">نمط الفقرة</option><option value="h1">عنوان رئيسي</option><option value="h2">عنوان فرعي</option><option value="p">نص عادي</option></select>
          <button class="icon-btn" data-act="docCmd" data-id="bold" title="عريض"><b>B</b></button><button class="icon-btn" data-act="docCmd" data-id="italic" title="مائل"><i>I</i></button><button class="icon-btn" data-act="docCmd" data-id="underline" title="تسطير"><u>U</u></button>
          <span class="d-sep"></span>
          <button class="icon-btn" data-act="docCmd" data-id="justifyRight" title="محاذاة لليمين">⇶</button><button class="icon-btn" data-act="docCmd" data-id="justifyCenter" title="توسيط">≡</button><button class="icon-btn" data-act="docCmd" data-id="justifyLeft" title="محاذاة لليسار">⇇</button>
          <button class="icon-btn" data-act="docCmd" data-id="insertUnorderedList" title="قائمة نقطية">•≡</button><button class="icon-btn" data-act="docCmd" data-id="insertOrderedList" title="قائمة مرقمة">1≡</button>
          <span class="d-sep"></span>
          <button class="btn sm" data-act="docTable">▦ جدول</button><button class="btn sm" data-act="docDate">📅 التاريخ</button><button class="btn sm" data-act="docLetterhead">🏛 ترويسة</button>
          <button class="mic-btn" style="position:static" data-act="mic" data-target="#docPage" title="إملاء صوتي">🎤</button>
        </div>
        <div class="doc-wrap"><div class="doc-page" id="docPage" contenteditable="true" dir="rtl" spellcheck="true">${d.html}</div></div>`
      : `<div class="card">${emptyState('📝', 'اختاري قالباً من القائمة لإنشاء مستند جديد، أو افتحي مستنداً محفوظاً')}</div>`;
}
function docRestore() { const page = $('#docPage'); if (!page) return; page.focus(); if (DOCS.range) { const s = getSelection(); s.removeAllRanges(); s.addRange(DOCS.range); } }
function docExec(cmd, val) { docRestore(); document.execCommand(cmd, false, val); $('#docPage')?.dispatchEvent(new Event('input')); }
Object.assign(ACTIONS, {
  docNew: (el) => { const [title, html] = docTemplate(el.dataset.id); db.documents = db.documents || []; const d = { id: uid(), title, html, updatedAt: todayISO() }; db.documents.push(d); DOCS.id = d.id; DOCS.range = null; commit(); },
  docOpen: (el) => { DOCS.id = el.dataset.id; DOCS.range = null; render(); },
  docDel: (el) => confirmBox('حذف هذا المستند؟', () => { db.documents = db.documents.filter((x) => x.id !== el.dataset.id); if (DOCS.id === el.dataset.id) DOCS.id = null; commit(); }),
  docCmd: (el) => docExec(el.dataset.id),
  docDate: () => { const t = todayISO(); docExec('insertText', `${dayName(t)} ${fmtH(t)} الموافق ${fmtG(t)}`); },
  docLetterhead: () => { const page = $('#docPage'); page.insertAdjacentHTML('afterbegin', letterhead()); page.dispatchEvent(new Event('input')); },
  docTable: () => formModal({ title: 'إدراج جدول', fields: [{ key: 'r', label: 'عدد الصفوف', type: 'number', min: 1, max: 40 }, { key: 'c', label: 'عدد الأعمدة', type: 'number', min: 1, max: 10 }], values: { r: 3, c: 3 },
    onSave: (v) => { const r = Math.max(1, +v.r || 3), c = Math.max(1, +v.c || 3); const html = `<table><tbody>${Array.from({ length: r }, (_, i) => `<tr>${Array.from({ length: c }, () => (i === 0 ? '<td><b>عنوان</b></td>' : '<td>&nbsp;</td>')).join('')}</tr>`).join('')}</tbody></table><p><br></p>`; setTimeout(() => docExec('insertHTML', html), 30); } }),
  docPrint: () => { const page = $('#docPage'); if (!page) return; $('#print').innerHTML = `<div class="doc-print">${page.innerHTML}</div>`; setTimeout(() => window.print(), 50); },
  docExport: async () => {
    const page = $('#docPage'); const d = curDoc(); if (!page || !d) return;
    try { const blob = await htmlToDocx(page); openBlob(blob, (d.title || 'مستند') + '.docx', true); toast('حُفظ ملف Word في «التنزيلات»', 'ok'); }
    catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); }
  },
});
CHANGES.docBlock = (el) => { if (el.value) docExec('formatBlock', el.value); el.value = ''; };

// تحويل محتوى المحرر إلى ملف Word
async function htmlToDocx(root) {
  const X = await loadDocx();
  const AL = (node) => {
    const a = (node.style?.textAlign || node.getAttribute?.('align') || '').toLowerCase();
    return a === 'center' ? X.AlignmentType.CENTER : a === 'left' ? X.AlignmentType.END : a === 'justify' ? X.AlignmentType.BOTH : X.AlignmentType.START;
  };
  const runs = (node, f = {}) => {
    const out = [];
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { const t = n.textContent.replace(/ /g, ' '); if (t) out.push(new X.TextRun({ text: t, bold: f.b, italics: f.i, underline: f.u ? {} : undefined, rightToLeft: true, size: f.size })); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { out.push(new X.TextRun({ text: '', break: 1 })); return; }
      const nf = { ...f };
      if (tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(n.style?.fontWeight || '')) nf.b = true;
      if (tag === 'I' || tag === 'EM' || n.style?.fontStyle === 'italic') nf.i = true;
      if (tag === 'U' || /underline/.test(n.style?.textDecoration || '')) nf.u = true;
      out.push(...runs(n, nf));
    });
    return out;
  };
  const para = (n, opt = {}) => new X.Paragraph({ bidirectional: true, alignment: AL(n), children: runs(n, opt.f || {}), heading: opt.heading, bullet: opt.bullet, spacing: { after: 120 } });
  const blocks = (container) => {
    const out = []; let inline = null;
    const flush = () => { if (inline) { out.push(new X.Paragraph({ bidirectional: true, alignment: container.nodeType === 1 ? AL(container) : undefined, children: inline })); inline = null; } };
    container.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.textContent.trim()) (inline = inline || []).push(new X.TextRun({ text: n.textContent, rightToLeft: true })); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (/^(B|STRONG|I|EM|U|SPAN|FONT|A)$/.test(tag)) { (inline = inline || []).push(...runs(n, { b: /B|STRONG/.test(tag), i: /^(I|EM)$/.test(tag), u: tag === 'U' })); return; }
      if (tag === 'BR') { flush(); return; }
      flush();
      if (tag === 'H1') out.push(para(n, { heading: X.HeadingLevel.HEADING_1, f: { b: true, size: 36 } }));
      else if (tag === 'H2' || tag === 'H3') out.push(para(n, { heading: X.HeadingLevel.HEADING_2, f: { b: true, size: 30 } }));
      else if (tag === 'UL') n.querySelectorAll(':scope > li').forEach((li) => out.push(para(li, { bullet: { level: 0 } })));
      else if (tag === 'OL') n.querySelectorAll(':scope > li').forEach((li, i) => { const p = para(li); out.push(new X.Paragraph({ bidirectional: true, children: [new X.TextRun({ text: `${i + 1}. `, rightToLeft: true }), ...runs(li)] })); void p; });
      else if (tag === 'HR') out.push(new X.Paragraph({ bidirectional: true, border: { bottom: { style: X.BorderStyle.SINGLE, size: 6, color: '0F6B5C', space: 1 } }, children: [] }));
      else if (tag === 'TABLE') {
        const nob = n.classList.contains('noborder');
        const none = { style: X.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const rows = [...n.querySelectorAll(':scope > tbody > tr, :scope > tr')].map((tr) => new X.TableRow({
          children: [...tr.children].map((td) => {
            const kids = blocks(td);
            return new X.TableCell({ children: kids.length ? kids : [new X.Paragraph({ children: [] })], ...(nob ? { borders: { top: none, bottom: none, left: none, right: none } } : {}) });
          }),
        }));
        if (rows.length) out.push(new X.Table({ rows, width: { size: 100, type: X.WidthType.PERCENTAGE }, visuallyRightToLeft: true }));
        out.push(new X.Paragraph({ children: [] }));
      } else if (/^(DIV|P|SECTION|ARTICLE|BLOCKQUOTE|LI)$/.test(tag)) {
        if (n.querySelector('table, ul, ol, h1, h2, p, div')) out.push(...blocks(n)); else out.push(para(n));
      } else out.push(para(n));
    });
    flush();
    return out;
  };
  const doc = new X.Document({
    styles: { default: { document: { run: { font: { ascii: 'Arial', hAnsi: 'Arial', cs: 'Arial' }, size: 28, rightToLeft: true }, paragraph: { bidirectional: true } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: blocks(root) }],
  });
  return X.Packer.toBlob(doc);
}

// ═════════════ 🗜️ ضغط PDF ═════════════
const PDFS = { file: null, level: 'mid', busy: false, result: null, progress: '', merge: [], images: [], imgFit: 'a4' };
const LEVELS = { low: ['ضغط خفيف (جودة عالية)', 150, 0.8], mid: ['ضغط متوسط (موصى به)', 110, 0.65], high: ['ضغط قوي (أصغر حجم)', 80, 0.5] };
TOOL_VIEWS.compress = {
  render() {
    const f = PDFS.file, r = PDFS.result;
    return `<div class="card tool-panel">
      <div class="file-pick drop pdf-drop" data-kind="compress">${f ? `<span style="font-size:22px">📕</span><div class="grow"><b>${esc(f.name)}</b><div class="muted">الحجم الحالي: ${fmtBytes(f.size)}</div></div><button class="btn sm" data-act="cmpPick">تغيير الملف</button>` : `<span style="font-size:22px">📕</span><div class="grow muted">اسحبي ملف PDF وأفلتيه هنا، أو</div><button class="btn sm primary" data-act="cmpPick">اختيار ملف PDF</button>`}</div>
      <div class="field" style="margin-top:14px"><label>مستوى الضغط</label><div class="seg">${Object.entries(LEVELS).map(([k, v]) => `<button class="${PDFS.level === k ? 'on' : ''}" data-act="cmpLevel" data-id="${k}">${v[0]}</button>`).join('')}</div></div>
      <button class="btn primary" style="margin-top:14px" data-act="cmpRun" ${!f || PDFS.busy ? 'disabled' : ''}>${PDFS.busy ? '⏳ جارٍ الضغط…' : '🗜️ ضغط الملف'}</button>
      ${PDFS.progress ? `<div class="muted" style="margin-top:8px">${PDFS.progress}</div>` : ''}
      ${r ? `<div class="banner brand" style="margin-top:16px"><span class="big">${r.size < f.size ? '✅' : 'ℹ️'}</span><div>${r.size < f.size ? `<b>تم تقليل الحجم من ${fmtBytes(f.size)} إلى ${fmtBytes(r.size)}</b><div class="muted">توفير ${Math.round((1 - r.size / f.size) * 100)}%</div>` : '<b>الملف مضغوط أصلاً</b><div class="muted">النسخة الناتجة ليست أصغر من الأصل، جرّبي «ضغط قوي»</div>'}</div><span class="spacer"></span>${r.size < f.size ? '<button class="btn primary" data-act="cmpSave">⬇ تنزيل الملف المضغوط</button>' : ''}</div>` : ''}
      <div class="muted" style="margin-top:14px">ملاحظة: الضغط يحوّل الصفحات إلى صور، فيصبح النص غير قابل للتحديد والنسخ. الملف الأصلي لا يتغيّر.</div>
    </div>`;
  },
};
async function compressPdf() {
  const f = PDFS.file; if (!f) return;
  PDFS.busy = true; PDFS.result = null; PDFS.progress = 'جارٍ تحميل أدوات PDF…'; render();
  try {
    const [pj, L] = await Promise.all([loadPdfJs(), loadPdfLib()]);
    const [, dpi, q] = LEVELS[PDFS.level];
    const src = await pj.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    const out = await L.PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      PDFS.progress = `جارٍ معالجة الصفحة ${i} من ${src.numPages}…`; const pe = $('.tool-panel .muted'); if (pe) pe.textContent = PDFS.progress;
      const page = await src.getPage(i); const base = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: dpi / 72 });
      const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
      const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
      const img = await out.embedJpg(await jpg.arrayBuffer());
      const p = out.addPage([base.width, base.height]); p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
    const bytes = await out.save();
    PDFS.result = new Blob([bytes], { type: 'application/pdf' }); PDFS.progress = '';
  } catch (e) { PDFS.progress = ''; toast('تعذّر ضغط الملف: ' + e.message, 'err'); }
  PDFS.busy = false; render();
}
Object.assign(ACTIONS, {
  cmpPick: async () => { const [f] = await pickFiles('application/pdf,.pdf'); if (f) { PDFS.file = f; PDFS.result = null; render(); } },
  cmpLevel: (el) => { PDFS.level = el.dataset.id; PDFS.result = null; render(); },
  cmpRun: () => compressPdf(),
  cmpSave: () => { openBlob(PDFS.result, 'مضغوط-' + PDFS.file.name, true); toast('حُفظ الملف في «التنزيلات»', 'ok'); },
});

// ═════════════ 📎 دمج PDF ═════════════
TOOL_VIEWS.merge = {
  render() {
    const L = PDFS.merge;
    return `<div class="card tool-panel">
      <div class="file-pick drop pdf-drop" data-kind="merge"><span style="font-size:22px">📎</span><div class="grow muted">اسحبي ملفات PDF هنا، أو</div><button class="btn sm primary" data-act="mrgPick">إضافة ملفات PDF</button></div>
      ${L.length ? `<div class="list" style="margin-top:12px">${L.map((f, i) => `<div class="li"><b style="width:24px">${i + 1}</b><span>📕</span><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${fmtBytes(f.size)}</div></div>
        <button class="icon-btn" data-act="mrgMove" data-id="${i}" data-d="-1" title="لأعلى" ${i === 0 ? 'disabled' : ''}>⬆</button><button class="icon-btn" data-act="mrgMove" data-id="${i}" data-d="1" title="لأسفل" ${i === L.length - 1 ? 'disabled' : ''}>⬇</button><button class="icon-btn" data-act="mrgDel" data-id="${i}">✕</button></div>`).join('')}</div>
        <button class="btn primary" style="margin-top:14px" data-act="mrgRun" ${L.length < 2 ? 'disabled' : ''}>📎 دمج ${L.length} ملفات</button>` : ''}
    </div>`;
  },
};
Object.assign(ACTIONS, {
  mrgPick: async () => { const fs = await pickFiles('application/pdf,.pdf', true); PDFS.merge.push(...fs); render(); },
  mrgMove: (el) => { const i = +el.dataset.id, j = i + +el.dataset.d; const a = PDFS.merge; [a[i], a[j]] = [a[j], a[i]]; render(); },
  mrgDel: (el) => { PDFS.merge.splice(+el.dataset.id, 1); render(); },
  mrgRun: async () => {
    try {
      const L = await loadPdfLib(); const out = await L.PDFDocument.create();
      for (const f of PDFS.merge) { const src = await L.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true }); (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p)); }
      openBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'ملف-مدموج.pdf', true); toast('حُفظ الملف المدموج في «التنزيلات»', 'ok');
    } catch (e) { toast('تعذّر الدمج: ' + e.message, 'err'); }
  },
});

// ═════════════ 🖼️ صور إلى PDF ═════════════
TOOL_VIEWS.img2pdf = {
  render() {
    const L = PDFS.images;
    return `<div class="card tool-panel">
      <div class="file-pick drop pdf-drop" data-kind="images"><span style="font-size:22px">🖼️</span><div class="grow muted">اسحبي الصور هنا، أو</div><button class="btn sm primary" data-act="imgPick">إضافة صور</button></div>
      ${L.length ? `<div class="img-strip">${L.map((im, i) => `<div class="img-thumb"><img src="${im.url}" alt=""><div class="img-tools"><button class="icon-btn" data-act="imgMove" data-id="${i}" data-d="-1">→</button><b>${i + 1}</b><button class="icon-btn" data-act="imgMove" data-id="${i}" data-d="1">←</button><button class="icon-btn" data-act="imgDel" data-id="${i}">✕</button></div></div>`).join('')}</div>
        <div class="field" style="margin-top:12px"><label>حجم الصفحة</label><div class="seg"><button class="${PDFS.imgFit === 'a4' ? 'on' : ''}" data-act="imgFit" data-id="a4">A4 بهوامش</button><button class="${PDFS.imgFit === 'fit' ? 'on' : ''}" data-act="imgFit" data-id="fit">بحجم الصورة</button></div></div>
        <button class="btn primary" style="margin-top:14px" data-act="imgRun">🖼️ إنشاء PDF من ${L.length} صورة</button>` : ''}
    </div>`;
  },
};
async function imageBytes(file) {
  // تُحوَّل كل الصور إلى JPEG مع تصغير الكبيرة منها
  const url = URL.createObjectURL(file); const im = new Image(); await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = url; });
  const sc = Math.min(1, 2200 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); return { bytes: await b.arrayBuffer(), w: c.width, h: c.height };
}
Object.assign(ACTIONS, {
  imgPick: async () => { const fs = await pickFiles('image/*', true); fs.forEach((f) => PDFS.images.push({ f, url: URL.createObjectURL(f) })); render(); },
  imgMove: (el) => { const i = +el.dataset.id, j = i + +el.dataset.d; const a = PDFS.images; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; render(); },
  imgDel: (el) => { PDFS.images.splice(+el.dataset.id, 1); render(); },
  imgFit: (el) => { PDFS.imgFit = el.dataset.id; render(); },
  imgRun: async () => {
    try {
      const L = await loadPdfLib(); const out = await L.PDFDocument.create();
      for (const { f } of PDFS.images) {
        const { bytes, w, h } = await imageBytes(f); const img = await out.embedJpg(bytes);
        if (PDFS.imgFit === 'fit') { const p = out.addPage([w * 0.75, h * 0.75]); p.drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 }); }
        else { const [pw, ph] = w > h ? [842, 595] : [595, 842]; const m = 28, sc = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h); const p = out.addPage([pw, ph]); p.drawImage(img, { x: (pw - w * sc) / 2, y: (ph - h * sc) / 2, width: w * sc, height: h * sc }); }
      }
      openBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'صور.pdf', true); toast('حُفظ ملف PDF في «التنزيلات»', 'ok');
    } catch (e) { toast('تعذّر إنشاء الملف: ' + e.message, 'err'); }
  },
});
// السحب والإفلات لأدوات PDF
document.addEventListener('drop', (e) => {
  const box = e.target.closest?.('.pdf-drop'); if (!box) return;
  const fs = [...e.dataTransfer.files]; if (!fs.length) return;
  const k = box.dataset.kind;
  if (k === 'compress') { const f = fs.find((x) => /pdf$/i.test(x.name)); if (f) { PDFS.file = f; PDFS.result = null; } }
  if (k === 'merge') PDFS.merge.push(...fs.filter((x) => /pdf$/i.test(x.name)));
  if (k === 'images') fs.filter((x) => /^image\//.test(x.type)).forEach((f) => PDFS.images.push({ f, url: URL.createObjectURL(f) }));
  render();
});

// ═════════════ 📆 محوّل التاريخ ═════════════
const HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const hParts = (d) => { const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d); const g = (t) => +p.find((x) => x.type === t).value; return [g('year'), g('month'), g('day')]; };
function hijriToG(hy, hm, hd) {
  const d = new Date(622, 6, 16);
  d.setDate(d.getDate() + Math.round((hy - 1) * 354.367 + (hm - 1) * 29.53 + (hd - 1)));
  for (let i = 0; i < 80; i++) {
    const [y, m, dd] = hParts(d);
    if (y === hy && m === hm && dd === hd) return iso(d);
    const diff = (hy - y) * 354.367 + (hm - m) * 29.53 + (hd - dd);
    d.setDate(d.getDate() + (Math.abs(diff) > 2 ? Math.round(diff) : Math.sign(diff)));
  }
  return null;
}
const DT = { g: null, hy: null, hm: null, hd: null, a: null, b: null, skipWeekend: true };
TOOL_VIEWS.dates = {
  render() {
    const t = todayISO();
    if (!DT.g) DT.g = t;
    if (!DT.hy) [DT.hy, DT.hm, DT.hd] = hParts(new Date());
    if (!DT.a) { DT.a = t; DT.b = addDays(t, 7); }
    const g2h = `${dayName(DT.g)} ${fmtH(DT.g)}`;
    const h2g = hijriToG(DT.hy, DT.hm, DT.hd);
    const total = DT.b >= DT.a ? diffDays(DT.a, DT.b) + 1 : 0, work = DT.b >= DT.a ? workDays(DT.a, DT.b) : 0;
    return `<div class="grid g3" style="align-items:start">
      <div class="card"><h3>ميلادي ← هجري</h3><input type="date" class="input" value="${DT.g}" data-change="dtG" style="width:100%">
        <div class="date-out">${g2h}</div></div>
      <div class="card"><h3>هجري ← ميلادي</h3>
        <div style="display:flex;gap:6px"><input type="number" class="input" min="1" max="30" value="${DT.hd}" data-change="dtHd" style="width:70px"><select class="input" data-change="dtHm" style="flex:1">${HMONTHS.map((m, i) => `<option value="${i + 1}" ${DT.hm === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select><input type="number" class="input" min="1300" max="1600" value="${DT.hy}" data-change="dtHy" style="width:90px"></div>
        <div class="date-out">${h2g ? `${dayName(h2g)} ${fmtG(h2g)}` : 'تاريخ غير صحيح'}</div></div>
      <div class="card"><h3>المدة بين تاريخين</h3>
        <div style="display:flex;gap:6px;align-items:center"><span class="muted">من</span><input type="date" class="input" value="${DT.a}" data-change="dtA" style="flex:1"></div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px"><span class="muted">إلى</span><input type="date" class="input" value="${DT.b}" data-change="dtB" style="flex:1"></div>
        <div class="date-out">${total ? `${daysLabel(total)}<div class="muted" style="font-size:14px">منها ${daysLabel(work)} عمل (دون الجمعة والسبت)</div>` : 'تاريخ النهاية قبل البداية'}</div></div>
    </div>`;
  },
};
Object.assign(CHANGES, {
  dtG: (el) => { if (el.value) { DT.g = el.value; render(); } },
  dtHd: (el) => { DT.hd = Math.min(30, Math.max(1, +el.value || 1)); render(); },
  dtHm: (el) => { DT.hm = +el.value; render(); },
  dtHy: (el) => { DT.hy = +el.value || DT.hy; render(); },
  dtA: (el) => { if (el.value) { DT.a = el.value; render(); } },
  dtB: (el) => { if (el.value) { DT.b = el.value; render(); } },
});

// ═════════════ 🎲 القرعة ═════════════
const RND = { names: '', count: 1, result: [], rolling: false };
TOOL_VIEWS.random = {
  render() {
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><h3>الأسماء <span class="more"><button class="btn sm" data-act="rndTeachers">أسماء المعلمات</button></span></h3>
        <textarea class="input" id="rndNames" rows="12" placeholder="اكتبي كل اسم في سطر">${esc(RND.names)}</textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><label class="muted">عدد الفائزات</label><input type="number" class="input" id="rndCount" min="1" value="${RND.count}" style="width:80px"><span style="flex:1"></span><button class="btn primary" data-act="rndRun">🎲 سحب</button></div>
      </div>
      <div class="card rnd-box"><h3>النتيجة</h3>
        <div id="rndOut">${RND.result.length ? RND.result.map((n, i) => `<div class="rnd-name"><span>${i + 1}</span>${esc(n)}</div>`).join('') : emptyState('🎲', 'اضغطي «سحب» لبدء القرعة')}</div>
      </div>
    </div>`;
  },
};
Object.assign(ACTIONS, {
  rndTeachers: () => { RND.names = sortedTeachers().map((t) => t.name).join('\n'); if (!RND.names) toast('لا توجد معلمات مسجّلات بعد', 'err'); render(); },
  rndRun: () => {
    RND.names = $('#rndNames').value; RND.count = Math.max(1, +$('#rndCount').value || 1);
    const list = [...new Set(RND.names.split('\n').map((x) => x.trim()).filter(Boolean))];
    if (!list.length) return toast('اكتبي الأسماء أولاً', 'err');
    const n = Math.min(RND.count, list.length);
    const pool = [...list]; const pick = [];
    const rand = (m) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % m; };
    for (let i = 0; i < n; i++) pick.push(pool.splice(rand(pool.length), 1)[0]);
    const out = $('#rndOut'); let k = 0;
    const spin = setInterval(() => { out.innerHTML = `<div class="rnd-name spin">${esc(list[rand(list.length)])}</div>`; if (++k > 14) { clearInterval(spin); RND.result = pick; render(); } }, 70);
  },
});

// ═════════════ ☕ تذكير الراحة ═════════════
const REST_PHRASES = [
  'خذي نفساً عميقاً… أنتِ تقومين بعمل عظيم 🌿',
  '﴿ألا بذكر الله تطمئن القلوب﴾',
  'قومي وتحرّكي قليلاً، جسدكِ يستحق الاهتمام',
  'اشربي كوب ماء، فالماء يجدد نشاطكِ',
  'انظري إلى شيء بعيد عشرين ثانية لتريحي عينيكِ 👀',
  'كل مهمة أنجزتِها اليوم خطوة نحو أثر جميل',
  'لا بأس أن تبطئي قليلاً، المهم أن تستمري',
  'ابتسامتكِ اليوم قد تكون سبب سعادة طالبة 😊',
  '«إن الله يحب إذا عمل أحدكم عملاً أن يتقنه»',
  'أنتِ أقدر مما تتخيلين 💪',
  'أرخي كتفيكِ… وحرّكي رقبتكِ برفق يميناً ويساراً',
  'الراحة ليست تضييعاً للوقت، بل وقود للإنجاز',
  'تذكّري: صحتكِ أولاً',
  'استغفري الله… فبالاستغفار تنفرج الهموم',
  'عملكِ المنظّم يصنع فرقاً في يوم مدرسة كاملة',
  'خمس دقائق من الهدوء تمنحكِ ساعة من التركيز',
  '﴿وقل ربِّ زدني علماً﴾',
  'كوني لطيفة مع نفسكِ كما أنتِ لطيفة مع الآخرين',
  'تنفّسي: شهيق ٤ ثوانٍ… احبسي ٤… زفير ٦',
  'كل يوم جديد فرصة لأثر طيب ✨',
  'قطرات الإنجاز اليومية تصنع نهراً من النجاح',
  'قفي وتمدّدي، فالجلوس الطويل يُتعب الظهر',
  'ما تزرعينه اليوم من خير ستحصدينه غداً 🌱',
  '﴿فإن مع العسر يسراً﴾',
  'إنجاز صغير متقن خيرٌ من كثير مستعجل',
  'أغمضي عينيكِ لحظات… واستمتعي بالهدوء',
  'أنتِ جزء مهم من نجاح هذه المدرسة 🌟',
  'صلّي على النبي ﷺ… وابدئي بنشاط جديد',
];
const REST_TIPS = ['🚶‍♀️ قومي وامشي قليلاً', '💧 اشربي ماء', '👀 انظري بعيداً عن الشاشة', '🙆‍♀️ تمدّدي وحرّكي كتفيكِ', '🌬️ تنفّسي بعمق ٣ مرات'];
const REST = { next: 0, hiddenAt: 0, breakEnd: 0, timer: null };
const restMins = () => Math.max(5, Number(db?.settings?.restMins) || 25);
function restReset(mins = restMins()) { REST.next = Date.now() + mins * 60000; restInfo(); }
function restInfo() {
  const el = $('#restInfo'); if (!el) return;
  if (!db?.settings?.restOn) { el.textContent = ''; return; }
  const m = Math.max(0, Math.ceil((REST.next - Date.now()) / 60000));
  el.innerHTML = `<button class="rest-chip" data-act="restNow" title="خذي استراحة الآن">☕ الاستراحة بعد ${m} د</button>`;
}
function restChime() {
  try {
    const A = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((f, i) => { const o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.value = f; const t = A.currentTime + i * 0.18; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2); o.connect(g).connect(A.destination); o.start(t); o.stop(t + 1.3); });
  } catch { }
}
function restShow() {
  if (document.getElementById('restOverlay')) return;
  const RP = phraseList('rest'), RT = phraseList('tips');
  const phrase = RP[Math.floor(Math.random() * RP.length)];
  const tip = RT[Math.floor(Math.random() * RT.length)];
  const name = (db.settings.employeeName || '').split(' ')[0];
  const el = document.createElement('div'); el.id = 'restOverlay'; el.className = 'rest-overlay';
  el.innerHTML = `<div class="rest-card">
    <div class="breath"><div></div></div>
    <div class="rest-hello">${name ? `استراحة قصيرة يا ${esc(name)} ☕` : 'حان وقت استراحة قصيرة ☕'}</div>
    <div class="rest-phrase">${esc(phrase)}</div>
    <div class="rest-tip">${tip}</div>
    <div id="restCount" class="rest-count"></div>
    <div class="rest-btns"><button class="btn primary" data-act="restBreak">أبدأ استراحة ٥ دقائق</button><button class="btn" data-act="restSnooze">ذكّريني بعد ٥ دقائق</button><button class="btn ghost" data-act="restSkip">أكمل عملي</button></div>
  </div>`;
  document.body.appendChild(el);
  restChime();
  if (document.hidden) { try { new Notification('☕ وقت الاستراحة', { body: phrase }); } catch { } const old = document.title; let f = 0; const fl = setInterval(() => { document.title = f++ % 2 ? old : '☕ وقت الاستراحة'; if (!document.hidden || f > 40) { clearInterval(fl); document.title = old; } }, 1000); }
}
function restClose() { document.getElementById('restOverlay')?.remove(); clearInterval(REST.timer); }
Object.assign(ACTIONS, {
  restNow: () => restShow(),
  restSkip: () => { restClose(); restReset(); },
  restSnooze: () => { restClose(); restReset(5); toast('سأذكّركِ بعد ٥ دقائق'); },
  restBreak: () => {
    REST.breakEnd = Date.now() + 5 * 60000;
    $('.rest-btns').innerHTML = '<button class="btn primary" data-act="restDone">عدتُ للعمل ✓</button>';
    const tick = () => { const s = Math.max(0, Math.round((REST.breakEnd - Date.now()) / 1000)); const c = $('#restCount'); if (c) c.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`; if (!s) { clearInterval(REST.timer); restChime(); if (c) c.textContent = 'انتهت الاستراحة — بالتوفيق 🌷'; } };
    tick(); REST.timer = setInterval(tick, 1000);
  },
  restDone: () => { restClose(); restReset(); toast('أهلاً بعودتكِ 🌷', 'ok'); },
  restTest: () => restShow(),
});
TOOL_VIEWS.rest = {
  render() {
    const s = db.settings;
    return `<div class="card tool-panel">
      <label style="display:flex;gap:10px;align-items:center;font-weight:700;font-size:15px"><input type="checkbox" ${s.restOn ? 'checked' : ''} data-change="restOn" style="width:20px;height:20px"> تفعيل تذكير الراحة</label>
      <div class="field" style="margin-top:14px;max-width:260px"><label>التذكير كل</label><select class="input" data-change="restMins">${[20, 25, 30, 45, 60].map((m) => `<option value="${m}" ${restMins() === m ? 'selected' : ''}>${m} دقيقة</option>`).join('')}</select></div>
      <div class="muted" style="margin-top:12px">يظهر التذكير داخل التطبيق مع صوت هادئ وعبارة مريحة أو محفّزة، ويمكنكِ بدء استراحة ٥ دقائق أو تأجيله. إذا ابتعدتِ عن الجهاز أكثر من ٥ دقائق يُحسب ذلك استراحة ويبدأ العدّ من جديد.</div>
      <button class="btn" style="margin-top:14px" data-act="restTest">جرّبي التذكير الآن</button>
    </div>`;
  },
};
Object.assign(CHANGES, {
  restOn: (el) => { db.settings.restOn = el.checked; commit(false); restReset(); },
  restMins: (el) => { db.settings.restMins = +el.value; commit(false); restReset(); },
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) REST.hiddenAt = Date.now();
  else if (REST.hiddenAt && Date.now() - REST.hiddenAt > 5 * 60000) restReset();
});
// يبدأ بعد تحميل البيانات
(function restLoop() {
  const start = () => {
    if (!db) return setTimeout(start, 300);
    if (db.settings.restOn === undefined) { db.settings.restOn = true; db.settings.restMins = 25; }
    restReset();
    setInterval(() => { if (db.settings.restOn && Date.now() >= REST.next && !document.getElementById('restOverlay')) restShow(); restInfo(); }, 15000);
  };
  start();
})();

// ═════════════ المناسبات: تصدير واستيراد Excel ═════════════
const loadZip = () => loadScript('lib/jszip.js').then(() => JSZip);
const OCC_COLS = ['المناسبة', 'اليوم', 'الشهر', 'التقويم', 'النوع', 'المبادرة', 'المسؤولة', 'ملاحظات'];
const xmlEsc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
async function buildXlsx(rows, widths) {
  const Z = await loadZip(); const z = new Z();
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
    return typeof v === 'number' ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="المناسبات" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="12"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F6B5C"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  z.file('xl/worksheets/sheet1.xml', sheet);
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
async function readSheetRows(file) {
  if (/\.csv$/i.test(file.name)) {
    const txt = (await file.text()).replace(/^﻿/, '');
    return txt.split(/\r?\n/).filter((l) => l.trim()).map((l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',' || c === ';' || c === '\t') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map((x) => x.trim()); });
  }
  const Z = await loadZip(); const z = await Z.loadAsync(await file.arrayBuffer());
  const P = (x) => new DOMParser().parseFromString(x, 'application/xml');
  const shared = z.file('xl/sharedStrings.xml') ? [...P(await z.file('xl/sharedStrings.xml').async('string')).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try {
    const wb = P(await z.file('xl/workbook.xml').async('string')); const rid = wb.getElementsByTagName('sheet')[0].getAttribute('r:id');
    const rels = P(await z.file('xl/_rels/workbook.xml.rels').async('string'));
    const t = [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
    if (t) sheetPath = 'xl/' + t.replace(/^\/?xl\//, '').replace(/^\//, '');
  } catch { }
  const sh = P(await z.file(sheetPath).async('string'));
  const colIdx = (ref) => { const l = ref.replace(/\d+/g, ''); let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  return [...sh.getElementsByTagName('row')].map((row) => {
    const out = [];
    [...row.getElementsByTagName('c')].forEach((c) => {
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = t === 's' ? shared[+v] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v;
      out[colIdx(c.getAttribute('r') || colName(out.length) + '1')] = String(val ?? '').trim();
    });
    return Array.from(out, (x) => x ?? '');
  }).filter((r) => r.some((x) => x));
}
function parseOccRows(rows) {
  const head = rows[0].map((h) => h.replace(/\s+/g, ''));
  const find = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const ix = { name: find('المناسبة', 'الاسم', 'اليوم العالمي'), day: find('اليوم'), month: find('الشهر'), cal: find('التقويم'), type: find('النوع'), ini: find('المبادرة'), resp: find('المسؤول'), notes: find('ملاحظ') };
  if (ix.name === ix.day) ix.day = head.findIndex((h, i) => i !== ix.name && h.includes('اليوم'));
  if (ix.name < 0 || ix.day < 0 || ix.month < 0) throw new Error('يجب أن يحتوي الملف على أعمدة: المناسبة، اليوم، الشهر');
  const monthOf = (v, hijri) => { const n = parseInt(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); if (n >= 1 && n <= 12) return n; const m = (hijri ? HMONTHS : MONTHS).findIndex((x) => String(v).includes(x)); return m >= 0 ? m + 1 : (HMONTHS.findIndex((x) => String(v).includes(x)) + 1 || MONTHS.findIndex((x) => String(v).includes(x)) + 1); };
  const out = [], bad = [];
  rows.slice(1).forEach((r, i) => {
    const name = r[ix.name]; if (!name) return;
    const calTxt = ix.cal >= 0 ? r[ix.cal] : '';
    const hijri = /هجري/.test(calTxt) || (!calTxt && HMONTHS.some((x) => String(r[ix.month]).includes(x)));
    const day = parseInt(String(r[ix.day]).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10), month = monthOf(r[ix.month], hijri);
    if (!(day >= 1 && day <= 31) || !(month >= 1 && month <= 12)) { bad.push(i + 2); return; }
    const tt = ix.type >= 0 ? r[ix.type] : '';
    out.push({ name, day, month, cal: hijri ? 'h' : 'g', type: /وطن/.test(tt) ? 'national' : /إسلام|اسلام|ديني/.test(tt) ? 'islamic' : 'global', initiative: ix.ini >= 0 ? r[ix.ini] || '' : null, responsible: ix.resp >= 0 ? r[ix.resp] || '' : null, notes: ix.notes >= 0 ? r[ix.notes] || '' : null });
  });
  return { out, bad };
}
const _occActions = VIEWS.occasions.actions;
VIEWS.occasions.actions = () => `<button class="btn" data-act="occXlsxOut">⬇ تصدير Excel</button><button class="btn" data-act="occXlsxIn">⬆ استيراد من Excel</button>` + _occActions();
Object.assign(ACTIONS, {
  occXlsxOut: async () => {
    const rows = [OCC_COLS, ...db.occasions.slice().sort((a, b) => (a.cal === 'h') - (b.cal === 'h') || a.month - b.month || a.day - b.day)
      .map((o) => [o.name, o.day, o.cal === 'h' ? HMONTHS[o.month - 1] : MONTHS[o.month - 1], o.cal === 'h' ? 'هجري' : 'ميلادي', (OCC_TYPES[o.type] || OCC_TYPES.global)[0], o.initiative || '', o.responsible || '', o.notes || ''])];
    openBlob(await buildXlsx(rows, [34, 8, 14, 10, 10, 40, 20, 24]), `الأيام-العالمية-والوطنية-${new Date().getFullYear()}.xlsx`, true);
    toast('حُفظ ملف Excel في «التنزيلات» — عدّليه ثم استورديه', 'ok');
  },
  occXlsxIn: async () => {
    const [f] = await pickFiles('.xlsx,.csv'); if (!f) return;
    let parsed; try { parsed = parseOccRows(await readSheetRows(f)); } catch (e) { return toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
    const { out, bad } = parsed;
    if (!out.length) return toast('لم يُعثر على مناسبات صالحة في الملف', 'err');
    const key = (n) => n.replace(/\s+/g, ' ').trim();
    const upd = out.filter((r) => db.occasions.some((o) => key(o.name) === key(r.name))).length;
    const extra = db.occasions.filter((o) => !out.some((r) => key(r.name) === key(o.name))).length;
    $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal"><div class="modal-h"><h2>استيراد المناسبات</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
      <div class="modal-b"><div class="list">
        <div class="li"><div class="grow">مناسبات جديدة ستُضاف</div><b>${out.length - upd}</b></div>
        <div class="li"><div class="grow">مناسبات موجودة سيُحدَّث تاريخها وبياناتها</div><b>${upd}</b></div>
        ${bad.length ? `<div class="li"><div class="grow" style="color:var(--red)">صفوف تم تجاهلها لخطأ في التاريخ: ${bad.join('، ')}</div></div>` : ''}
      </div>
      ${extra ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="occDelMissing"> حذف ${extra} مناسبة موجودة في التطبيق وليست في الملف</label>` : ''}
      <div class="muted" style="margin-top:10px">حالة التنفيذ للمناسبات الحالية تبقى كما هي.</div></div>
      <div class="modal-f"><button class="btn primary" data-act="occImportGo">استيراد</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
    modalCtx = { occImport: out };
  },
  occImportGo: () => {
    const out = modalCtx.occImport; const del = $('#occDelMissing')?.checked;
    const key = (n) => n.replace(/\s+/g, ' ').trim();
    out.forEach((r) => {
      const o = db.occasions.find((x) => key(x.name) === key(r.name));
      const patch = { name: r.name, day: r.day, month: r.month, cal: r.cal, type: r.type };
      ['initiative', 'responsible', 'notes'].forEach((k) => { if (r[k] !== null && r[k] !== '') patch[k] = r[k]; });
      if (o) Object.assign(o, patch); else db.occasions.push({ id: uid(), status: 'todo', initiative: '', responsible: '', notes: '', year: null, ...patch });
    });
    if (del) db.occasions = db.occasions.filter((o) => out.some((r) => key(r.name) === key(o.name)));
    closeModal(); commit(); toast(`تم استيراد ${out.length} مناسبة ✓`, 'ok');
  },
});

// ═════════════ 🌷 لمسات لطيفة أثناء العمل ═════════════
const CHEER_EMOJI = ['💗', '🌹', '🌷', '🌸', '🌻', '🌿', '🏞️', '🌅', '🌄', '🌈', '🦋', '🍃', '☀️', '🌙', '🌼', '💐', '🕊️', '🏝️', '🌺', '✨'];
const CHEER_TEXT = [
  'يومكِ جميل بوجودكِ', 'استمري… أنتِ رائعة', 'ابتسمي، فالحياة أجمل 😊', 'عملكِ يصنع فرقاً',
  'جزاكِ الله خيراً على جهودكِ', 'خطوة بخطوة تصلين', 'لكِ أجر كل خير تقدّمينه', 'نفَسٌ عميق… وأكملي بهدوء',
  'أسعد الله قلبكِ', 'أنتِ نجمة هذا اليوم ✨', 'أنجزتِ كثيراً اليوم، أحسنتِ', 'قلبٌ طيب وعملٌ متقن',
  'بارك الله في وقتكِ', 'التنظيم سرّ نجاحكِ', 'لطفكِ يترك أثراً جميلاً', 'كل يوم معكِ أجمل',
  'ثقي بنفسكِ، أنتِ قادرة', 'هدوؤكِ قوة', 'وجودكِ يضيء المدرسة 🌟', 'رتّبي يومكِ… وارتاحي قليلاً',
];
const CHEER = { last: -1, timer: null };
function cheerShow() {
  if (!db || db.settings.cheerOn === false || document.hidden) return;
  if (modalCtx || document.getElementById('restOverlay')) return;
  document.getElementById('cheer')?.remove();
  const CE = phraseList('emoji'), CT = phraseList('cheer');
  let i; do { i = Math.floor(Math.random() * CE.length); } while (i === CHEER.last && CE.length > 1); CHEER.last = i;
  const el = document.createElement('div'); el.id = 'cheer'; el.className = 'cheer'; 
  el.innerHTML = `<div class="cheer-emoji">${esc(CE[i])}</div><div class="cheer-text">${esc(CT[Math.floor(Math.random() * CT.length)])}</div>`;
  el.onclick = () => cheerHide();
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(CHEER.timer); CHEER.timer = setTimeout(cheerHide, 14000);
}
function cheerHide() { const el = document.getElementById('cheer'); if (!el) return; el.classList.remove('show'); setTimeout(() => el.remove(), 600); }
(function cheerLoop() {
  const start = () => {
    if (!db) return setTimeout(start, 400);
    setTimeout(cheerShow, 60000); // أول ظهور بعد دقيقة من فتح البرنامج
    setInterval(cheerShow, 5 * 60000);
  };
  start();
})();
// عند الإيقاف من الإعدادات يختفي فوراً
const _settingBool = CHANGES.settingBool;
CHANGES.settingBool = (el, e) => { _settingBool(el, e); if (el.dataset.id === 'cheerOn') { if (el.checked) cheerShow(); else cheerHide(); } };

// ═════════════ 💬 العبارات القابلة للتعديل ═════════════
const PHRASE_SETS = {
  cheer: { title: 'عبارات اللمسات اللطيفة', hint: 'عبارة في كل سطر', def: () => CHEER_TEXT },
  emoji: { title: 'رموز اللمسات اللطيفة', hint: 'رمز في كل سطر — مثل 💗 أو 🌹', def: () => CHEER_EMOJI },
  rest: { title: 'عبارات تذكير الراحة', hint: 'عبارة في كل سطر', def: () => REST_PHRASES },
  tips: { title: 'نصائح وقت الراحة', hint: 'نصيحة قصيرة في كل سطر', def: () => REST_TIPS },
};
function phraseList(k) {
  const own = db?.settings?.phrases?.[k];
  return own && own.length ? own : PHRASE_SETS[k].def();
}
function phrasesCard() {
  const custom = (k) => !!db.settings.phrases?.[k]?.length;
  return `<div class="card" style="grid-column:1/-1"><details class="adv" ${ui.phrasesOpen ? 'open' : ''}><summary data-act="phrasesToggle"><h3 style="display:inline-flex;margin:0">💬 العبارات</h3></summary>
    <div class="muted" style="margin:10px 0 12px">عدّلي أي قائمة: كل سطر عبارة مستقلة. تُحفظ التعديلات تلقائياً عند الخروج من المربع، ولا تضيع عند تحديث البرنامج. عبارة الورد اليومي تُعدَّل من صفحة المصحف.</div>
    <div class="phr-grid">${Object.entries(PHRASE_SETS).map(([k, P]) => `<div class="field">
      <label style="display:flex;align-items:center;gap:6px">${P.title} <span class="chip ${custom(k) ? 'brand' : ''}">${custom(k) ? 'معدّلة' : 'الافتراضية'}</span> <span class="muted" style="font-weight:400">(${phraseList(k).length})</span></label>
      <textarea class="input" rows="${k === 'emoji' ? 6 : 8}" data-change="phrases" data-id="${k}" ${k === 'emoji' ? 'style="font-size:20px;line-height:1.5"' : ''}>${esc(phraseList(k).join('\n'))}</textarea>
      <span class="hint">${P.hint}</span>
      <div style="display:flex;gap:6px;margin-top:4px">${k === 'cheer' || k === 'emoji' ? '<button class="btn sm" data-act="phrPreview" data-id="cheer">👁 معاينة</button>' : '<button class="btn sm" data-act="phrPreview" data-id="rest">👁 معاينة</button>'}${custom(k) ? `<button class="btn sm ghost" data-act="phrReset" data-id="${k}">↺ استعادة الافتراضية</button>` : ''}</div>
    </div>`).join('')}</div>
  </details></div>`;
}
CHANGES.phrases = (el) => {
  const k = el.dataset.id;
  const lines = el.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  db.settings.phrases = db.settings.phrases || {};
  if (!lines.length) { delete db.settings.phrases[k]; toast('القائمة فارغة — أُعيدت العبارات الافتراضية'); }
  else if (lines.join('\n') === PHRASE_SETS[k].def().join('\n')) delete db.settings.phrases[k];
  else { db.settings.phrases[k] = lines; toast(`حُفظت ${lines.length} عبارة ✓`, 'ok'); }
  commit();
};
Object.assign(ACTIONS, {
  phrasesToggle: (el, e) => { e.preventDefault(); ui.phrasesOpen = !ui.phrasesOpen; render(); },
  phrReset: (el) => confirmBox('استعادة العبارات الافتراضية لهذه القائمة؟', () => { delete db.settings.phrases[el.dataset.id]; commit(); }, 'نعم، استعيديها'),
  phrPreview: (el) => {
    // يحفظ ما كُتب قبل المعاينة
    $$('textarea[data-change=phrases]').forEach((t) => { if (t === document.activeElement) t.blur(); });
    if (el.dataset.id === 'cheer') { const on = db.settings.cheerOn; db.settings.cheerOn = true; cheerShow(); db.settings.cheerOn = on; }
    else restShow();
  },
});
