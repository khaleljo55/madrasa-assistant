// ═════════════ 📱 تخطيط شاشة الجوال (1.1.0) ═════════════
// يعمل فقط على الشاشات الصغيرة: القائمة الجانبية تصبح درجاً يُفتح بزر ☰.
(function mobileNav() {
  const btn = document.createElement('button');
  btn.className = 'm-menu'; btn.setAttribute('aria-label', 'القائمة'); btn.textContent = '☰';
  btn.onclick = () => document.body.classList.toggle('nav-open');
  document.getElementById('topbar')?.prepend(btn);
  const shade = document.createElement('div'); shade.className = 'm-shade'; shade.onclick = () => document.body.classList.remove('nav-open');
  document.getElementById('app')?.append(shade);
  // اختيار قسم من القائمة يغلق الدرج
  document.addEventListener('click', (e) => { if (e.target.closest('#nav [data-act=nav], #nav [data-act=gsOpen], .side-search')) document.body.classList.remove('nav-open'); }, true);
})();
