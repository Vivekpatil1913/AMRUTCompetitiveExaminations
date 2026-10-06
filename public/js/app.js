// Progressive enhancement only – every page works without JavaScript.
(function () {
  var root = document.documentElement;

  // Text size (A- / A / A+), remembered per browser
  try { var ts = localStorage.getItem('amrut-ts'); if (ts) root.classList.add(ts); } catch (e) {}
  document.querySelectorAll('[data-ts]').forEach(function (b) {
    b.addEventListener('click', function () {
      root.classList.remove('ts-sm', 'ts-lg');
      var v = b.getAttribute('data-ts');
      if (v) root.classList.add(v);
      try { localStorage.setItem('amrut-ts', v); } catch (e) {}
      document.querySelectorAll('[data-ts]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });

  // Public mobile navigation
  var navBtn = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('mainnav');
  if (navBtn && nav) navBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    navBtn.setAttribute('aria-expanded', String(open));
  });

  // Portal / admin off-canvas sidebar
  var shell = document.querySelector('.shell');
  document.querySelectorAll('[data-sidebar-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = shell.classList.toggle('nav-open');
      b.setAttribute('aria-expanded', String(open));
    });
  });
  if (shell) shell.addEventListener('click', function (e) {
    if (shell.classList.contains('nav-open') && e.target === shell) shell.classList.remove('nav-open');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shell) shell.classList.remove('nav-open'); });

  // Marquee pause / play (WCAG 2.2.2)
  document.querySelectorAll('[data-marquee-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.closest('.marquee');
      var paused = m.classList.toggle('paused');
      b.setAttribute('aria-pressed', String(paused));
      b.setAttribute('aria-label', paused ? 'Play announcements' : 'Pause announcements');
      b.innerHTML = paused ? b.getAttribute('data-play') : b.getAttribute('data-pause');
    });
  });

  // Show chosen file name in drop zones
  document.querySelectorAll('.file-drop input[type=file]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var out = inp.closest('.file-drop').querySelector('.name');
      if (out) out.textContent = inp.files.length ? inp.files[0].name : '';
    });
  });

  // Confirm destructive actions
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!confirm(f.getAttribute('data-confirm'))) e.preventDefault(); });
  });

  // Dialogs: <button data-open="id">
  document.querySelectorAll('[data-open]').forEach(function (b) {
    b.addEventListener('click', function () { var d = document.getElementById(b.getAttribute('data-open')); if (d && d.showModal) d.showModal(); });
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { var d = b.closest('dialog'); if (d) d.close(); });
  });

  // Conditional fields: <div data-show-when="name=value">
  function syncConditional() {
    document.querySelectorAll('[data-show-when]').forEach(function (el) {
      var parts = el.getAttribute('data-show-when').split('=');
      var checked = document.querySelector('[name="' + parts[0] + '"]:checked') || document.querySelector('select[name="' + parts[0] + '"]');
      var show = checked && checked.value === parts[1];
      el.hidden = !show;
      el.querySelectorAll('input,select,textarea').forEach(function (i) { if (i.hasAttribute('data-req')) i.required = !!show; });
    });
  }
  document.addEventListener('change', syncConditional);
  syncConditional();

  // Mark empty table cells (shown as “—”) so stacked mobile rows can hide them
  document.querySelectorAll('.table-stack td').forEach(function (td) {
    if (td.textContent.trim() === '—') td.classList.add('is-empty');
  });

  // Prevent double submit + loading state
  document.querySelectorAll('form[data-loading]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return; // e.g. user cancelled a data-confirm dialog
      var b = f.querySelector('[type=submit]');
      if (b) { b.disabled = true; b.insertAdjacentHTML('afterbegin', '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>'); }
    });
  });
})();
