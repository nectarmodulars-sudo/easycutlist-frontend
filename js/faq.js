/* faq.js — user-facing Help & FAQs modal for EasyCutList Optimizer.
   Self-contained: injects its own modal on first open, fetches the public
   GET /asm/faqs route. All functions global (no modules), matches app style.
   Wire-up in index.html:
     1) a menu item:  <button class="mob-nav-item" onclick="openFAQ();toggleMobNav()">❓ FAQs</button>
     2) a script tag:  <script src="js/faq.js"></script>
*/
(function () {
  var API_ROOT = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001' : 'https://api.easycutlist.com';

  var CATS = [['optimizer', 'Cut Optimizer'], ['size_builder', 'Size Builder'], ['general', 'General']];
  var built = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    if (built) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal-overlay" id="faq-modal" style="display:none" onclick="if(event.target===this)closeFAQ()">' +
        '<div class="modal" style="width:640px;max-width:94vw;max-height:85vh;overflow:auto">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
            '<div class="modal-title" style="margin:0">❓ Help &amp; FAQs</div>' +
            '<button class="btn btn-ghost" onclick="closeFAQ()" style="padding:4px 10px">✕</button>' +
          '</div>' +
          '<div id="faq-body" style="font-size:13px;line-height:1.55">Loading…</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap.firstChild);
    built = true;
  }

  function render(faqs) {
    var body = document.getElementById('faq-body');
    if (!faqs || !faqs.length) { body.innerHTML = '<div style="color:var(--sl-muted,#8A8F98)">No FAQs available yet.</div>'; return; }
    var html = '';
    CATS.forEach(function (c) {
      var rows = faqs.filter(function (f) { return f.category === c[0]; });
      if (!rows.length) return;
      html += '<div style="font-weight:800;color:var(--sl-yellow,#ECB22E);margin:14px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em">' + c[1] + '</div>';
      rows.forEach(function (f) {
        html +=
          '<div class="faq-item" style="border:1px solid var(--sl-border2,#3A3D42);border-radius:8px;margin-bottom:6px;overflow:hidden">' +
            '<button class="faq-q" onclick="faqToggleItem(this)" style="width:100%;text-align:left;background:var(--sl-bg2,#14161A);color:var(--sl-text,#e7ecf1);border:none;padding:11px 14px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;display:flex;justify-content:space-between;gap:10px">' +
              '<span>' + esc(f.question) + '</span><span class="faq-caret" style="color:var(--sl-yellow,#ECB22E);flex:0 0 auto">+</span>' +
            '</button>' +
            '<div class="faq-a" style="display:none;padding:12px 14px;color:var(--sl-text,#cfd6dd);white-space:pre-wrap;border-top:1px solid var(--sl-border2,#3A3D42)">' + esc(f.answer) + '</div>' +
          '</div>';
      });
    });
    body.innerHTML = html || '<div style="color:#8A8F98">No FAQs available yet.</div>';
  }

  window.faqToggleItem = function (btn) {
    var a = btn.parentNode.querySelector('.faq-a');
    var caret = btn.querySelector('.faq-caret');
    var open = a.style.display === 'none';
    a.style.display = open ? 'block' : 'none';
    if (caret) caret.textContent = open ? '–' : '+';
  };

  window.openFAQ = function () {
    build();
    document.getElementById('faq-modal').style.display = 'flex';
    var body = document.getElementById('faq-body');
    body.innerHTML = 'Loading…';
    fetch(API_ROOT + '/asm/faqs')
      .then(function (r) { return r.json(); })
      .then(function (j) { render((j && j.faqs) || []); })
      .catch(function () { body.innerHTML = '<div style="color:#e66">Could not load FAQs. Please try again.</div>'; });
  };

  window.closeFAQ = function () {
    var m = document.getElementById('faq-modal');
    if (m) m.style.display = 'none';
  };
})();
