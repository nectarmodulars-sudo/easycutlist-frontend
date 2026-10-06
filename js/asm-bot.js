/* asm-bot.js — Size Builder assistant (frontend).
   Load AFTER app-asm.js:

       <script src="js/asm-bot.js"></script>

   A floating Ask button inside the Size Builder, and a small panel. It sends
   the question plus the id of the item currently open in the SBS, so "what is
   this field" can be answered against the right schema.

   The server answers only from the authored glossary; when it has nothing, it
   says so. This file deliberately does not soften that — an "I don't know"
   shown plainly is the feature, not a failure. */

(function () {
  'use strict';

  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://api.easycutlist.com';

  var open = false;
  var busy = false;
  var enabled = null;      // null = not checked yet
  var mode = 'glossary';   // 'glossary' (free, exact lookups) | 'ai' (API key set)
  var greeting = '';       // set by the admin Bot tab; blank falls back to ours
  var lastCheck = 0;       // the on/off switch is re-read about once a minute

  // app-asm.js declares `const ASMModule`, which never lands on window.
  function asm() {
    try { return (typeof ASMModule !== 'undefined') ? ASMModule : null; } catch (e) { return null; }
  }
  function hdr() {
    try { return (typeof authHeader === 'function' && authHeader()) || {}; } catch (e) { return {}; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- what is the user looking at? ----------------------------------
     The topmost SBS item that is actually on screen. Falls back to the first
     one, so the bot still gets context when the list is scrolled oddly. */
  function currentItem() {
    var m = asm();
    if (!m || !m.getInstance) return null;
    var nodes = document.querySelectorAll('.asm-sbs-item');
    if (!nodes.length) return null;
    var best = nodes[0];
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.top >= 0 && r.top < window.innerHeight * 0.6) { best = nodes[i]; break; }
    }
    return m.getInstance(best.id);
  }

  /* ---- chrome ---------------------------------------------------------- */

  function injectCss() {
    if (document.getElementById('asm-bot-css')) return;
    var s = document.createElement('style');
    s.id = 'asm-bot-css';
    s.textContent = [
      // Default sits mid-right, clear of the Ready Items footer buttons. Once
      // the user drags it, left/top are set inline and win over these.
      '.asm-bot-fab{position:fixed;right:18px;top:46%;z-index:10007;display:flex;align-items:center;gap:8px;',
      '  background:#4A154B;color:#fff;border:1px solid #6B2A6C;border-radius:24px;padding:10px 18px;',
      '  font:700 13px/1 inherit;cursor:grab;box-shadow:0 6px 20px rgba(0,0,0,.45);',
      '  touch-action:none;user-select:none}',
      '.asm-bot-fab:hover{background:#611f64}',
      '.asm-bot-fab.dragging{cursor:grabbing;opacity:.85}',
      '.asm-bot-fab .grip{opacity:.5;font-size:11px;letter-spacing:-1px}',
      '.asm-bot-panel{position:fixed;z-index:10008;width:min(420px,94vw);',
      '  max-height:min(620px,86vh);display:flex;flex-direction:column;background:#1A1D21;',
      '  border:1px solid #3A3D42;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden}',
      '.asm-bot-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;',
      '  background:#222529;border-bottom:1px solid #3A3D42}',
      '.asm-bot-head b{color:#ECB22E;font-size:14px}',
      '.asm-bot-head .ctx{font-size:11px;color:#7A7D82;margin-left:8px}',
      '.asm-bot-x{background:none;border:none;color:#7A7D82;font-size:18px;cursor:pointer;line-height:1}',
      '.asm-bot-log{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}',
      '.asm-bot-msg{font-size:13px;line-height:1.5;border-radius:9px;padding:9px 11px;max-width:92%;white-space:pre-wrap}',
      '.asm-bot-me{align-self:flex-end;background:#2B5C43;color:#eee}',
      '.asm-bot-ai{align-self:flex-start;background:#26282C;color:#E8E8E8}',
      '.asm-bot-src{font-size:10px;color:#7A7D82;margin-top:6px}',
      '.asm-bot-warn{align-self:flex-start;background:#3A2A10;border:1px solid #ECB22E;color:#F3D9A8;',
      '  font-size:12px;border-radius:9px;padding:8px 11px}',
      '.asm-bot-foot{border-top:1px solid #3A3D42;padding:10px;display:flex;gap:8px;background:#1E2125}',
      '.asm-bot-in{flex:1;background:#14161A;border:1px solid #3A3D42;color:#fff;border-radius:8px;',
      '  padding:9px 11px;font:13px inherit;resize:none;max-height:90px}',
      '.asm-bot-in:focus{outline:none;border-color:#ECB22E}',
      '.asm-bot-send{background:#ECB22E;color:#1A1D21;border:none;border-radius:8px;padding:0 16px;',
      '  font:700 13px inherit;cursor:pointer}',
      '.asm-bot-send[disabled]{opacity:.5;cursor:default}',
      '.asm-bot-hint{font-size:11px;color:#5A5D62;padding:0 14px 10px}',
      '@media (max-width:900px){.asm-bot-fab{right:12px;bottom:12px;padding:9px 14px}',
      '  .asm-bot-panel{right:0;left:0;bottom:0;width:auto;max-height:80vh;border-radius:12px 12px 0 0}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* The button floats over the Size Builder, so wherever it sits by default it
     covers something. Make it movable and remember where the user put it. */

  var POS_KEY = 'asm_bot_fab_pos';

  function savedPos() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch (e) { return null; }
  }
  function placeFab(b, left, top) {
    var w = b.offsetWidth || 90, h = b.offsetHeight || 38;
    left = Math.max(6, Math.min(left, window.innerWidth - w - 6));
    top = Math.max(60, Math.min(top, window.innerHeight - h - 6));   // never under the topbar
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.style.right = 'auto';
    b.style.bottom = 'auto';
  }

  function makeDraggable(b) {
    var sx = 0, sy = 0, ox = 0, oy = 0, moved = false, id = null;

    b.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var r = b.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      moved = false; id = e.pointerId;
      b.setPointerCapture(id);
      b.classList.add('dragging');
    });

    b.addEventListener('pointermove', function (e) {
      if (id == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      // A few pixels of slop so a slightly shaky click still opens the panel.
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      placeFab(b, ox + dx, oy + dy);
    });

    function end() {
      if (id == null) return;
      try { b.releasePointerCapture(id); } catch (e) {}
      id = null;
      b.classList.remove('dragging');
      if (moved) {
        var r = b.getBoundingClientRect();
        try { localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top })); } catch (e) {}
      } else {
        show();            // a click, not a drag
      }
    }
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
  }

  function fab() {
    var b = document.getElementById('asm-bot-fab');
    if (b) return b;
    b = document.createElement('button');
    b.id = 'asm-bot-fab';
    b.className = 'asm-bot-fab';
    b.innerHTML = '<span class="grip">\u2237</span><span>&#9889;</span> Ask';
    b.title = 'Ask about the fields on this item \u2014 drag to move';
    document.body.appendChild(b);

    var p = savedPos();
    if (p) placeFab(b, p.left, p.top);
    makeDraggable(b);

    // Keep it on screen when the window is resized.
    window.addEventListener('resize', function () {
      if (b.style.left) placeFab(b, parseFloat(b.style.left), parseFloat(b.style.top));
    });
    return b;
  }

  function say(cls, html, sources) {
    var log = document.getElementById('asm-bot-log');
    if (!log) return;
    var d = document.createElement('div');
    d.className = 'asm-bot-msg ' + cls;
    d.innerHTML = html + (sources && sources.length
      ? '<div class="asm-bot-src">from glossary: ' + sources.map(esc).join(', ') + '</div>' : '');
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function show() {
    injectCss();
    if (document.getElementById('asm-bot-panel')) return;
    var f = document.getElementById('asm-bot-fab');
    if (f) f.style.display = 'none';
    open = true;

    var inst = currentItem();
    var p = document.createElement('div');
    p.id = 'asm-bot-panel';
    p.className = 'asm-bot-panel';
    p.innerHTML =
      '<div class="asm-bot-head"><span><b>Size Builder assistant</b>' +
        '<span class="ctx">' + (inst ? esc(inst.itemName) : 'no item open') + '</span></span>' +
        '<button class="asm-bot-x" title="Close">&#10005;</button></div>' +
      '<div class="asm-bot-log" id="asm-bot-log"></div>' +
      '<div class="asm-bot-hint" id="asm-bot-hint">' + hintText() + '</div>' +
      '<div class="asm-bot-foot">' +
        '<textarea class="asm-bot-in" id="asm-bot-in" rows="1" placeholder="e.g. what is Shelf push inside?"></textarea>' +
        '<button class="asm-bot-send" id="asm-bot-send">Ask</button>' +
      '</div>';
    document.body.appendChild(p);
    anchorPanel(p);

    p.querySelector('.asm-bot-x').onclick = hide;
    var input = document.getElementById('asm-bot-in');
    document.getElementById('asm-bot-send').onclick = ask;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
    });
    input.focus();

    if (greeting) say('asm-bot-ai', esc(greeting));
    else say('asm-bot-ai', inst
      ? (mode === 'ai'
          ? 'Ask me about any field on <b>' + esc(inst.itemName) + '</b>, or which item to use.'
          : 'Ask me what a field on <b>' + esc(inst.itemName) + '</b> means.')
      : 'Open an item first and I can explain its fields.');
  }

  /* Open from wherever the button is: drop down if it sits high, rise up if it
     sits low, and always stay inside the window. On a phone the CSS pins it to
     the bottom as a sheet, so leave it alone there. */
  function anchorPanel(p) {
    if (window.innerWidth <= 900) return;
    var b = document.getElementById('asm-bot-fab');
    var r = b ? b.getBoundingClientRect() : null;
    var pw = p.offsetWidth || 420, ph = p.offsetHeight || 480;

    var right = r ? Math.max(6, window.innerWidth - r.right) : 18;
    var top = r
      ? (r.top + r.height / 2 < window.innerHeight / 2 ? r.top : r.bottom - ph)
      : window.innerHeight - ph - 18;

    top = Math.max(60, Math.min(top, window.innerHeight - ph - 10));
    p.style.right = Math.min(right, window.innerWidth - pw - 6) + 'px';
    p.style.top = top + 'px';
    p.style.bottom = 'auto';
  }

  function hintText() {
    return mode === 'ai'
      ? 'Answers come from EasyCutList’s own glossary. If it isn’t covered, it will say so rather than guess.'
      : 'Looking up terms in EasyCutList’s glossary. Ask about one field at a time — e.g. “shelf push inside”.';
  }

  function hide() {
    var p = document.getElementById('asm-bot-panel');
    if (p) p.remove();
    var f = document.getElementById('asm-bot-fab');
    if (f) f.style.display = '';
    open = false;
  }

  /* ---- ask ------------------------------------------------------------- */

  async function ask() {
    if (busy) return;
    var input = document.getElementById('asm-bot-in');
    var q = (input.value || '').trim();
    if (!q) return;

    input.value = '';
    say('asm-bot-me', esc(q));
    busy = true;
    var btn = document.getElementById('asm-bot-send');
    if (btn) btn.disabled = true;
    var thinking = say('asm-bot-ai', '…');

    var inst = currentItem();
    try {
      var res = await fetch(API + '/asm/bot/ask', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()),
        body: JSON.stringify({
          question: q,
          itemId: inst ? inst.itemId : null,
          catalogue: (inst && inst.catalogueKey) || null
        })
      });
      var d = await res.json();
      if (thinking) thinking.remove();

      if (!res.ok || !d.success) {
        say('asm-bot-warn', esc(d.error || 'Something went wrong.'));
      } else {
        say('asm-bot-ai', esc(d.answer).replace(/\n/g, '<br>'), d.used);
        if (d.remaining != null && d.remaining <= 2) {
          say('asm-bot-warn', d.remaining + ' free question' + (d.remaining === 1 ? '' : 's') + ' left today.');
        }
      }
    } catch (e) {
      if (thinking) thinking.remove();
      say('asm-bot-warn', esc(e.message));
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
      input.focus();
    }
  }

  /* ---- show the button only while the Size Builder is open ------------- */

  function tick() {
    var page = document.getElementById('asm-fullpage');
    var live = page && page.style.display !== 'none';
    var b = document.getElementById('asm-bot-fab');
    if (live) {
      injectCss();
      if (!b) fab();
      else if (!open) b.style.display = '';
      if (enabled === false && b) b.style.display = 'none';
      if (enabled === null || Date.now() - lastCheck > 60000) {
        lastCheck = Date.now();
        if (enabled === null) enabled = false;
        fetch(API + '/asm/bot/status', { headers: hdr() })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            enabled = !!(j && j.enabled);
            if (j && j.mode) mode = j.mode;
            if (j && j.greeting) greeting = j.greeting;
            var h = document.getElementById('asm-bot-hint');
            if (h) h.textContent = hintText();
          })
          .catch(function () { enabled = false; });
      }
      if (enabled === false && open) hide();
    } else {
      if (b) b.style.display = 'none';
      if (open) hide();
    }
  }
  setInterval(tick, 700);

  window.ASMBot = { show: show, hide: hide };
})();
