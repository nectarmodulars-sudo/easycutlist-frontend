/* asm-laminates.js — the user's own laminate code list, and the ☰ menu of the
   Cutlist Builder.

   · List lives in Supabase (API GET/PUT /asm/laminates), one row per user, so
     it follows the user to every browser. localStorage is only a cache.
   · Material inputs (except Edge band / Profile handle) get a search-as-you-type
     list of saved codes. Any typed value is still accepted; a new one offers
     "+ Add … to Laminate list".
   · The ☰ menu holds Laminates, My ASM Projects, Messages and Logout.
   Needs: API_URL, authHeader(), CURRENT_USER (app-auth / app-engine), ASMModule. */
(function () {
  'use strict';

  var items = [];            // [{code, name, brand}]
  var loadedFor = null;      // user id the list belongs to
  var saveTimer = null;

  function uid() { return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.id) || null; }
  function cacheKey() { return 'ecl_laminates_' + (uid() || 'anon'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api() { return (typeof API_URL !== 'undefined' ? API_URL : 'https://api.easycutlist.com') + '/asm/laminates'; }
  function hdr(json) {
    var h = (typeof authHeader === 'function') ? authHeader() : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  function toast(msg, type) { if (window.ASMModule && ASMModule.showToast) ASMModule.showToast(msg, type || 'success'); else if (typeof showToast === 'function') showToast(msg, type || 'success'); }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function has(code) { var c = norm(code); return !!c && items.some(function (l) { return norm(l.code) === c; }); }
  // "MATERIAL" is the catalogue's placeholder, not a laminate: never offer to add it
  function isPlaceholder(v) { return /^material$/i.test(String(v || '').trim()); }

  /* ── data ── */
  function load(force) {
    var u = uid();
    if (!force && loadedFor === u) return Promise.resolve(items);
    loadedFor = u;
    try { items = JSON.parse(localStorage.getItem(cacheKey()) || '[]'); } catch (e) { items = []; }
    if (!u) return Promise.resolve(items);
    return fetch(api(), { headers: hdr(false), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (uid() !== u) return items;
        if (Array.isArray(j.items)) { items = j.items; try { localStorage.setItem(cacheKey(), JSON.stringify(items)); } catch (e) {} }
        renderPanel();
        return items;
      })
      .catch(function (e) { console.warn('[laminates] using cached list:', e.message); return items; });
  }
  function save() {
    try { localStorage.setItem(cacheKey(), JSON.stringify(items)); } catch (e) {}
    if (!uid()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      fetch(api(), { method: 'PUT', headers: hdr(true), body: JSON.stringify({ items: items }) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
        .catch(function (e) { toast('Laminate list not saved to your account (' + e.message + '). It is kept on this device.', 'error'); });
    }, 400);
  }
  function add(code, name, brand) {
    code = String(code || '').trim();
    if (!code || isPlaceholder(code)) return false;
    if (has(code)) { toast('"' + code + '" is already in your Laminate list', 'info'); return false; }
    items.unshift({ code: code.slice(0, 80), name: String(name || '').trim().slice(0, 80), brand: String(brand || '').trim().slice(0, 60) });
    save(); renderPanel();
    toast('"' + code + '" added to your Laminate list');
    return true;
  }
  function remove(code) {
    items = items.filter(function (l) { return l.code !== code; });
    save(); renderPanel();
  }

  /* ── styles ── */
  var css = [
    '.asm-menu-btn{display:inline-flex!important;align-items:center;justify-content:center;width:38px;padding:6px 0!important;position:relative}',
    '.asm-menu-btn .asm-menu-dot{position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:4px;background:#E01E5A;display:none}',
    '.lam-scrim[hidden],.lam-drawer[hidden]{display:none!important}',
    '.lam-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000}',
    '.lam-drawer{position:fixed;top:0;right:0;bottom:0;width:min(340px,100%);background:#1E1A20;border-left:1px solid #45454D;z-index:100001;display:flex;flex-direction:column;color:#F1F1F3;font-family:inherit;box-shadow:-10px 0 30px rgba(0,0,0,.4)}',
    '.lam-drawer header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #45454D}',
    '.lam-drawer header b{font-size:13px;color:#B2B2BA}',
    '.lam-x{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:7px;width:34px;height:34px;cursor:pointer}',
    '.lam-menu{display:flex;flex-direction:column;padding:8px}',
    '.lam-menu button{all:unset;display:flex;align-items:center;gap:12px;padding:12px;border-radius:9px;cursor:pointer;font-weight:700;font-size:14px}',
    '.lam-menu button:hover,.lam-menu button:focus-visible{background:#2A242D}',
    '.lam-menu svg{width:18px;height:18px;flex:0 0 auto;color:#B2B2BA}',
    '.lam-menu .lam-new{margin-left:auto;font-size:10px;font-weight:800;background:#ECB22E;color:#2A0A2C;padding:2px 6px;border-radius:5px}',
    '.lam-menu hr{border:0;border-top:1px solid #45454D;margin:6px 0}',
    '.lam-panel{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}',
    '.lam-tools{display:flex;gap:8px;padding:12px 16px}',
    '.lam-tools input,.lam-add input{background:#2A2D31;border:1px solid #45454D;color:#F1F1F3;border-radius:7px;padding:8px 10px;font:inherit;font-size:13px;min-width:0}',
    '.lam-tools input{flex:1 1 auto}',
    '.lam-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:7px;padding:7px 12px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}',
    '.lam-btn.gold{background:#ECB22E;color:#2A0A2C;border-color:#ECB22E}',
    '.lam-list{list-style:none;margin:0;padding:0 8px 12px;overflow:auto;flex:1 1 auto}',
    '.lam-list li{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px}',
    '.lam-list li:hover{background:#26212A}',
    '.lam-list .nm{flex:1 1 auto;min-width:0}',
    '.lam-list .nm b{display:block;font-family:Inconsolata,monospace;font-size:14px}',
    '.lam-list .nm small{color:#B2B2BA;font-size:11px}',
    '.lam-list .del{all:unset;cursor:pointer;color:#B2B2BA;padding:6px 8px;border-radius:6px}',
    '.lam-list .del:hover{color:#E0245E;background:#2A242D}',
    '.lam-empty{padding:14px 10px;color:#B2B2BA;font-size:13px}',
    '.lam-add{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px;border-top:1px solid #45454D}',
    '.lam-add .full{grid-column:1/-1}',
    '.lam-dd{position:fixed;background:#121214;border:1px solid #45454D;border-radius:8px;box-shadow:0 14px 30px rgba(0,0,0,.5);z-index:100002;max-height:260px;overflow:auto;padding:4px;font-size:13px;color:#F1F1F3}',
    '.lam-opt{display:flex;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:6px;cursor:pointer}',
    '.lam-opt small{color:#B2B2BA;font-size:11px;white-space:nowrap}',
    '.lam-opt.act,.lam-opt:hover{background:#2A2A30}',
    '.lam-opt mark{background:none;color:#ECB22E;font-weight:800}',
    '.lam-opt.add{color:#38BDF8;font-weight:800;border-top:1px solid #45454D;margin-top:4px}',
    '.asm-input-row input.lam-unsaved,input.asm-cell.lam-unsaved{border-color:#38BDF8!important}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ── ☰ menu + Laminates panel ── */
  var scrim, drawer, view = 'menu';
  function ic(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  function ensureDrawer() {
    if (drawer) return;
    scrim = document.createElement('div'); scrim.className = 'lam-scrim'; scrim.hidden = true;
    scrim.onclick = closeMenu;
    drawer = document.createElement('aside'); drawer.className = 'lam-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Menu');
    document.body.appendChild(scrim); document.body.appendChild(drawer);
    drawer.addEventListener('click', onDrawerClick);
    drawer.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (add(f.code.value, f.name.value, f.brand.value)) { f.reset(); f.code.focus(); }
    });
    drawer.addEventListener('input', function (e) { if (e.target.id === 'lam-search') renderPanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer && !drawer.hidden) closeMenu(); });
  }
  function renderDrawer() {
    var logged = !!uid();
    if (view === 'menu') {
      drawer.innerHTML = '<header><b>Menu</b><button class="lam-x" type="button" data-a="close" aria-label="Close menu">✕</button></header>' +
        '<nav class="lam-menu">' +
        '<button type="button" data-a="lam">' + ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/>') + 'Laminates<span class="lam-new">NEW</span></button>' +
        '<button type="button" data-a="projects">' + ic('<path d="M3 7h6l2 2h10v10H3z"/>') + 'My ASM Projects</button>' +
        (logged ? '<button type="button" data-a="msgs">' + ic('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>') + 'Messages</button>' : '') +
        '<hr>' +
        (logged
          ? '<button type="button" data-a="logout" style="color:#FF8A9A">' + ic('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>') + 'Logout</button>'
          : '<button type="button" data-a="login" style="color:#8AB4F8">' + ic('<path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8"/>') + 'Login with Google</button>') +
        '</nav>';
    } else {
      drawer.innerHTML = '<header><b id="lam-title">Laminates</b><button class="lam-x" type="button" data-a="close" aria-label="Close menu">✕</button></header>' +
        '<section class="lam-panel">' +
        '<div class="lam-tools"><button class="lam-btn" type="button" data-a="menu">‹ Menu</button><input id="lam-search" type="search" placeholder="Search codes…" aria-label="Search laminates"></div>' +
        '<ul class="lam-list" id="lam-list"></ul>' +
        '<form class="lam-add" autocomplete="off">' +
        '<input name="code" class="full" placeholder="Laminate code, e.g. 21521 SF" required aria-label="Laminate code">' +
        '<input name="name" placeholder="Shade / name (optional)" aria-label="Shade or name">' +
        '<input name="brand" placeholder="Brand (optional)" aria-label="Brand">' +
        '<button class="lam-btn gold full" type="submit">+ Add laminate</button>' +
        '</form>' +
        (uid() ? '' : '<p class="lam-empty" style="padding:0 16px 14px">Log in to keep this list on every device. Until then it is saved in this browser only.</p>') +
        '</section>';
      renderPanel();
      setTimeout(function () { var s = document.getElementById('lam-search'); s && s.focus(); }, 30);
    }
  }
  function renderPanel() {
    var ul = document.getElementById('lam-list'); if (!ul) return;
    var s = document.getElementById('lam-search'), q = norm(s ? s.value : '');
    var hits = items.filter(function (l) { return !q || norm(l.code + ' ' + l.name + ' ' + l.brand).indexOf(q) !== -1; });
    var t = document.getElementById('lam-title'); if (t) t.textContent = 'Laminates · ' + items.length;
    ul.innerHTML = hits.length ? hits.map(function (l) {
      return '<li><span class="nm"><b>' + esc(l.code) + '</b><small>' + (esc([l.name, l.brand].filter(Boolean).join(' · ')) || '—') + '</small></span>' +
        '<button class="del" type="button" data-del="' + esc(l.code) + '" aria-label="Delete ' + esc(l.code) + '">✕</button></li>';
    }).join('') : '<li class="lam-empty">' + (items.length ? 'No laminate matches.' : 'No laminates yet. Add your codes below, or type a new code in any Material box.') + '</li>';
  }
  function onDrawerClick(e) {
    var d = e.target.closest('[data-del]');
    if (d) { remove(d.getAttribute('data-del')); return; }
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a'), M = window.ASMModule || {};
    if (a === 'close') return closeMenu();
    if (a === 'lam') { view = 'lam'; load(); return renderDrawer(); }
    if (a === 'menu') { view = 'menu'; return renderDrawer(); }
    closeMenu();
    if (a === 'projects' && M.showProjects) M.showProjects();
    if (a === 'msgs' && M.openMyProblems) M.openMyProblems();
    if (a === 'logout' && M.asmLogout) M.asmLogout();
    if (a === 'login' && M.asmLogin) M.asmLogin();
  }
  function openMenu(which) {
    ensureDrawer(); view = which === 'lam' ? 'lam' : 'menu';
    if (view === 'lam') load();
    renderDrawer(); scrim.hidden = false; drawer.hidden = false;
    var btn = document.querySelector('.asm-menu-btn'); btn && btn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    if (!drawer) return;
    scrim.hidden = true; drawer.hidden = true;
    var btn = document.querySelector('.asm-menu-btn'); btn && btn.setAttribute('aria-expanded', 'false');
  }

  /* ── search-as-you-type on Material inputs (input[data-lam]) ── */
  var dd = null, ddFor = null;
  function hl(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function place() {
    if (!dd || !ddFor) return;
    var r = ddFor.getBoundingClientRect();
    dd.style.left = Math.max(8, r.left) + 'px';
    dd.style.width = Math.max(r.width, 240) + 'px';
    var below = window.innerHeight - r.bottom;
    if (below < 200 && r.top > below) { dd.style.top = ''; dd.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    else { dd.style.bottom = ''; dd.style.top = (r.bottom + 4) + 'px'; }
  }
  function showList(input, filterText) {
    if (!dd) { dd = document.createElement('div'); dd.className = 'lam-dd'; dd.setAttribute('role', 'listbox'); document.body.appendChild(dd);
      dd.addEventListener('mousedown', function (e) { var o = e.target.closest('.lam-opt'); if (!o) return; e.preventDefault(); pick(o); }); }
    ddFor = input;
    var q = String(filterText || '').trim(), qq = q.toLowerCase();
    var hits = items.filter(function (l) { return !qq || norm(l.code + ' ' + l.name + ' ' + l.brand).indexOf(qq) !== -1; }).slice(0, 40);
    var html = hits.map(function (l, k) {
      return '<div class="lam-opt' + (k === 0 && q ? ' act' : '') + '" role="option" data-v="' + esc(l.code) + '"><span>' + hl(l.code, q) + '</span><small>' + esc([l.name, l.brand].filter(Boolean).join(' · ')) + '</small></div>';
    }).join('');
    if (q && !has(q) && !isPlaceholder(q)) html += '<div class="lam-opt add" role="option" data-add="' + esc(q) + '">+ Add “' + esc(q) + '” to Laminate list</div>';
    if (!html) html = '<div class="lam-empty">' + (items.length ? 'No saved laminate matches. Your typed value is kept.' : 'Save laminate codes in ☰ › Laminates to pick them here.') + '</div>';
    dd.innerHTML = html; dd.hidden = false; place();
  }
  function hideList() { if (dd) dd.hidden = true; ddFor = null; }
  function setValue(input, v) {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));     // runs the item's own updateInput
    // Output-table cells save on change, not input
    if (input.dataset.lamChange) input.dispatchEvent(new Event('change', { bubbles: true }));
    mark(input);
  }
  function mark(input) {
    var v = String(input.value || '').trim();
    input.classList.toggle('lam-unsaved', !!v && !isPlaceholder(v) && !has(v));
    input.title = input.classList.contains('lam-unsaved') ? 'Not in your Laminate list' : '';
  }
  function pick(o) {
    var input = ddFor; if (!input) return;
    if (o.hasAttribute('data-add')) { add(o.getAttribute('data-add')); setValue(input, o.getAttribute('data-add')); }
    else setValue(input, o.getAttribute('data-v'));
    hideList();
  }
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[data-lam]')) {
      showList(t, '');
      // first focus: the list may still be on its way from the server
      load().then(function () { if (ddFor === t && dd && !dd.hidden && document.activeElement === t) showList(t, t === document.activeElement && t.dataset.lamTyped ? t.value : ''); });
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[data-lam]') && e.isTrusted) { t.dataset.lamTyped = '1'; showList(t, t.value); mark(t); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('input[data-lam]') || !dd || dd.hidden) return;
    var opts = [].slice.call(dd.querySelectorAll('.lam-opt')), cur = opts.findIndex(function (o) { return o.classList.contains('act'); });
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!opts.length) return;
      var n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach(function (o, k) { o.classList.toggle('act', k === n); }); opts[n].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cur >= 0) pick(opts[cur]); else hideList();       // no highlight: the typed value stays
    } else if (e.key === 'Escape') { hideList(); }
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target; if (t && t.matches && t.matches('input[data-lam]')) setTimeout(function () { if (document.activeElement !== t) { hideList(); mark(t); } }, 150);
  });
  window.addEventListener('resize', place);
  document.addEventListener('scroll', function () { if (dd && !dd.hidden) place(); }, true);

  window.ASMLaminates = { load: load, list: function () { return items.slice(); }, add: add, remove: remove, openMenu: openMenu, closeMenu: closeMenu };
})();
