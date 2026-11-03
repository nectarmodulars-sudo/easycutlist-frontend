/* support-contact.js — WhatsApp support chip in the Optimizer header.
   Number comes from asm_ui_settings.settings.supportPhone (set in local
   Admin → Fonts → "Support WhatsApp number"). Missing key → DEFAULT below.
   Saved as an empty string → chip hidden. No other module depends on this. */
(function () {
  var DEFAULT = '+91 75077 44859';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001' : 'https://api.easycutlist.com';

  var css = '.sup-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;'
    + 'border-radius:5px;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.35);'
    + 'color:#fff;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;transition:background .15s}'
    + '.sup-chip:hover{background:rgba(37,211,102,.26)}'
    + '.sup-chip svg{flex:0 0 auto}'
    + '.sup-chip .sup-lbl{color:rgba(255,255,255,.6);font-weight:600}'
    + '@media (max-width:900px){.sup-chip .sup-lbl{display:none}}'
    + '@media (max-width:768px){.sup-chip .sup-num{display:none}.sup-chip{padding:0 7px}}';

  var ICON = '<svg width="15" height="15" viewBox="0 0 32 32" aria-hidden="true"><path fill="#25D366" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.4.7 4.7 1.9 6.7L3 29l6.9-2.1c1.9 1 4 1.6 6.1 1.6 7 0 12.7-5.6 12.7-12.6S23 3 16 3z"/><path fill="#fff" d="M23.1 19.3c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2-.3.4-1 1.2-1.2 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.1-.3 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.2 2.7 4.2 6.6 5.9 2.4 1 3.3 1.1 4.5.9.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.7-.5z"/></svg>';

  function digits(p) { return String(p).replace(/[^0-9]/g, ''); }

  function render(phone) {
    var old = document.getElementById('sup-chip');
    if (!phone || digits(phone).length < 8) { if (old) old.remove(); return; }
    var a = old || document.createElement('a');
    a.id = 'sup-chip';
    a.className = 'sup-chip';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = 'https://wa.me/' + digits(phone) + '?text=' + encodeURIComponent('Hi, I need help with EasyCutList.');
    a.title = 'WhatsApp support';
    a.onclick = function () { if (window.ECLPixel) ECLPixel.track('Contact', { content_name: 'whatsapp_support' }); };
    a.innerHTML = ICON + '<span class="sup-lbl">Support</span><span class="sup-num"></span>';
    a.querySelector('.sup-num').textContent = phone;
    if (!old) {
      var right = document.querySelector('header .hdr-right');
      if (!right) return;
      right.insertBefore(a, right.firstChild);
    }
  }

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    render(DEFAULT);
    fetch(API + '/asm/ui-settings').then(function (r) { return r.json(); }).then(function (j) {
      var s = (j && j.settings) || {};
      if (Object.prototype.hasOwnProperty.call(s, 'supportPhone')) render(String(s.supportPhone || '').trim());
    }).catch(function () { /* keep default */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
