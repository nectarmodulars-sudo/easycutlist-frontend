/* asm-presets.js — "Load Setting" per catalogue item.
   Load AFTER app-asm.js:

       <script src="js/asm-presets.js"></script>

   Save the inputs you are looking at under a name, and pull them back on any
   later item of the same type. Stored: the inputs, plus (in inputs.__extra)
   edge banding, typed-over cells, deleted rows and rows added by hand.
   Reloading re-runs the formulas and lays those changes back on top.

   UI (Nov 2026): one yellow Settings button per item head. It opens a panel to
   load, update, rename or delete a setting and to save a new one (no browser
   prompt or confirm). A red dot + Update appear when the loaded setting has
   been changed.

   This module owns its own UI and styles. app-asm.js only has to
     (a) render an empty <span class="asm-preset-slot" data-inst="..."></span>
         in each SBS item head, and
     (b) expose getInstance() and applyInputs().
   Everything else lives here, so a change to presets never touches the ASM core. */

(function () {
  'use strict';

  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://api.easycutlist.com';

  var cache = {};        // itemId -> [preset]
  var base = {};         // instanceId -> values of inputs the loaded setting did not have
  var chosen = {};       // instanceId -> preset id currently selected

  function hdr() {
    try { return (typeof authHeader === 'function' && authHeader()) || {}; } catch (e) { return {}; }
  }
  function loggedIn() { var h = hdr(); return !!h.Authorization; }

  // app-asm.js declares `const ASMModule = ...` at the top level of a classic
  // script, which does NOT put it on window — `window.ASMModule` is undefined
  // while the bare name resolves. Always reach it through this.
  function asm() {
    try { return (typeof ASMModule !== 'undefined') ? ASMModule : null; } catch (e) { return null; }
  }

  function toast(msg, type) {
    var m = asm();
    if (m && m.toast) return m.toast(msg, type);
    // app-asm.js keeps showToast inside its closure; fall back to a bare element.
    var t = document.createElement('div');
    t.className = 'asm-toast asm-toast-' + (type || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- styles --------------------------------------------------------- */

  function injectCss() {
    if (document.getElementById('asm-presets-css')) return;
    var s = document.createElement('style');
    s.id = 'asm-presets-css';
    s.textContent = [
      '.asm-preset-slot{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:10px}',
      '.asm-set-btn{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 14px;border-radius:7px;border:1px solid #ECB22E;',
      '  background:#ECB22E;color:#2A0A2C;font:inherit;font-size:13px;font-weight:800;cursor:pointer;max-width:260px;line-height:1.3}',
      '.asm-set-btn:hover{background:#F5C451;border-color:#F5C451}',
      '.asm-set-btn svg{width:15px;height:15px;flex:0 0 auto}',
      '.asm-set-btn .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35;padding:1px 0 2px}',
      '.asm-set-btn .dot{width:8px;height:8px;border-radius:4px;background:#E0245E;box-shadow:0 0 0 2px #ECB22E;flex:0 0 auto}',
      '.asm-set-btn .car{font-size:9px;margin-left:2px}',
      '.asm-set-upd{min-height:36px;padding:0 14px;border-radius:7px;border:1px solid #ECB22E;background:transparent;color:#ECB22E;',
      '  font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}',
      '.asm-set-btn:focus-visible,.asm-set-upd:focus-visible,.asm-set-pop button:focus-visible,.asm-set-pop input:focus-visible,.asm-set-pop li:focus-visible{outline:2px solid #ECB22E;outline-offset:2px}',
      '.asm-set-pop{position:fixed;z-index:100002;width:min(360px,calc(100vw - 24px));background:#18181C;border:1px solid #3A3A42;border-radius:12px;',
      '  box-shadow:0 18px 40px rgba(0,0,0,.55);color:#F1F1F3;font-family:inherit;font-size:13px;overflow:hidden}',
      '.asm-set-pop h3{margin:0;padding:12px 14px 6px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:#A6A6AE}',
      '.asm-set-pop ul{list-style:none;margin:0;padding:0 6px 6px;max-height:260px;overflow:auto}',
      '.asm-set-pop li{display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:9px;cursor:pointer}',
      '.asm-set-pop li:hover{background:#2A2A2F}',
      '.asm-set-pop li.on{background:rgba(236,178,46,.10);box-shadow:inset 3px 0 0 #ECB22E}',
      '.asm-set-pop .meta{flex:1 1 auto;min-width:0}',
      '.asm-set-pop .meta b{display:block;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.asm-set-pop .meta span{font-size:11.5px;color:#A6A6AE}',
      '.asm-set-pop .tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}',
      '.asm-set-pop .tag{font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;border:1px solid #3A3A42;color:#A6A6AE}',
      '.asm-set-pop .tag.b{color:#38BDF8;border-color:rgba(56,189,248,.4)}',
      '.asm-set-pop .tag.m{color:#ECB22E;border-color:rgba(236,178,46,.4)}',
      '.asm-set-pop .ib{width:28px;height:28px;border-radius:7px;border:1px solid transparent;background:transparent;color:#A6A6AE;cursor:pointer;font-size:13px;flex:0 0 auto}',
      '.asm-set-pop .ib:hover{border-color:#3A3A42;color:#F1F1F3}',
      '.asm-set-pop .ib.del:hover{color:#FF6B8A;border-color:rgba(255,107,138,.4)}',
      '.asm-set-pop .empty{margin:0;padding:4px 14px 12px;color:#A6A6AE}',
      '.asm-set-pop .foot{border-top:1px solid #3A3A42;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:#1C1C21}',
      '.asm-set-pop .foot label{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#A6A6AE}',
      '.asm-set-pop form{display:flex;gap:8px;margin:0}',
      '.asm-set-pop input{flex:1 1 auto;min-width:0;background:#2A2A2F;border:1px solid #3A3A42;color:#F1F1F3;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px}',
      '.asm-set-pop .btn{height:34px;padding:0 13px;border-radius:8px;border:1px solid #3A3A42;background:#2A2A2F;color:#F1F1F3;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}',
      '.asm-set-pop .btn.gold{background:#ECB22E;border-color:#ECB22E;color:#2A0A2C}',
      '.asm-set-pop .btn.red{color:#FF6B8A;height:28px}',
      '.asm-set-pop .inc,.asm-set-pop .warn{font-size:11.5px;color:#A6A6AE}',
      '.asm-set-pop .warn{color:#ECB22E}',
      '.asm-set-pop .inc b{color:#F1F1F3}',
      '@media (max-width:900px){.asm-preset-slot{width:100%;margin:6px 0 0}.asm-set-btn{flex:1;max-width:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---- data ----------------------------------------------------------- */

  function load(itemId, force) {
    if (!loggedIn()) return Promise.resolve([]);
    if (cache[itemId] && !force) return Promise.resolve(cache[itemId]);
    return fetch(API + '/asm/presets?itemId=' + encodeURIComponent(itemId), { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (j) { cache[itemId] = (j && j.presets) || []; return cache[itemId]; })
      .catch(function () { return []; });
  }
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()),
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (!j.success) throw new Error(j.error || 'Failed'); return j; });
  }

  // What gets saved: the inputs plus edge banding, typed cells and row changes
  // (inputs.__extra — the API and table need no change; applyInputs ignores it).
  function snapshot(instanceId) {
    var m = asm(), inst = m && m.getInstance(instanceId);
    if (!inst) return null;
    return Object.assign({}, inst.inputs, inst.extra ? { __extra: inst.extra } : {});
  }
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
  }
  function presetOf(itemId, id) { return (cache[itemId] || []).find(function (x) { return x.id === id; }); }
  // Changed since loaded? Old settings (no __extra) compare on inputs only.
  function isDirty(instanceId, itemId) {
    var p = presetOf(itemId, chosen[instanceId]);
    if (!p) return false;
    var m = asm(), inst = m && m.getInstance(instanceId);
    if (!inst || inst.pending) return false;      // still applying: nothing changed yet
    var cur = snapshot(instanceId);
    if (!cur) return false;
    // inputs added to the catalogue after the setting was saved: their
    // value at load time counts as part of the setting
    var saved = Object.assign({}, base[instanceId] || {}, p.inputs || {});
    if (!saved.__extra) { cur = Object.assign({}, cur); delete cur.__extra; }
    return stable(cur) !== stable(saved);
  }
  function tagsHtml(p) {
    var x = (p.inputs && p.inputs.__extra) || null, h = '<span class="tag">Inputs</span>';
    if (x) {
      var rows = x.rows || {}, band = 0, man = 0;
      Object.keys(rows).forEach(function (k) {
        var r = rows[k];
        if (r.band && (r.band.l || r.band.r || r.band.t || r.band.b)) band++;
        if (r._editedFields) man += Object.keys(r._editedFields).length;
      });
      var ch = Object.keys(x.deletedRows || {}).length + (x.added || []).length;
      if (band) h += '<span class="tag b">Edge band</span>';
      if (man) h += '<span class="tag m">' + man + ' typed cell' + (man > 1 ? 's' : '') + '</span>';
      if (ch) h += '<span class="tag">' + ch + ' row change' + (ch > 1 ? 's' : '') + '</span>';
    }
    return '<div class="tags">' + h + '</div>';
  }
  function when(t) {
    if (!t) return '';
    var d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /* ---- the Settings button in each item head --------------------------- */

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>';

  function paint(slot, itemId, instanceId, presets) {
    var p = presetOf(itemId, chosen[instanceId]);
    if (chosen[instanceId] && !p) chosen[instanceId] = '';
    var dirty = p ? isDirty(instanceId, itemId) : false;
    slot.innerHTML =
      '<button type="button" class="asm-set-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="' +
        esc(p ? 'Setting: ' + p.name + (dirty ? ', changed' : '') : 'Saved settings') + '">' + ICON +
        '<span class="nm">' + esc(p ? p.name : (presets.length ? 'Settings (' + presets.length + ')' : 'Save setting')) + '</span>' +
        (dirty ? '<span class="dot" title="Changed since loaded"></span>' : '') +
        '<span class="car" aria-hidden="true">▾</span></button>' +
      (dirty ? '<button type="button" class="asm-set-upd" title="Save the changes into this setting">Update</button>' : '');
    slot.setAttribute('data-dirty', dirty ? '1' : '0');
    var btn = slot.querySelector('.asm-set-btn');
    btn.onclick = function (e) { e.stopPropagation(); togglePop(slot, itemId, instanceId, btn); };
    var upd = slot.querySelector('.asm-set-upd');
    if (upd) upd.onclick = function (e) { e.stopPropagation(); doSave(instanceId, itemId, p.name); };
  }

  function repaintSlots(instanceId) {
    Array.prototype.forEach.call(document.querySelectorAll('.asm-preset-slot[data-inst="' + instanceId + '"]'), function (sl) {
      var m = asm(), inst = m && m.getInstance(instanceId);
      if (inst) paint(sl, inst.itemId, instanceId, cache[inst.itemId] || []);
    });
  }

  function mountOne(slot) {
    var instanceId = slot.getAttribute('data-inst');
    if (!instanceId || slot.getAttribute('data-ready') === '1') return;
    var m = asm();
    var inst = (m && m.getInstance) ? m.getInstance(instanceId) : null;
    if (!inst) return;
    slot.setAttribute('data-ready', '1');
    if (!loggedIn()) { slot.style.display = 'none'; return; }
    load(inst.itemId).then(function (list) { paint(slot, inst.itemId, instanceId, list); });
  }

  function mountAll() {
    injectCss();
    Array.prototype.forEach.call(document.querySelectorAll('.asm-preset-slot'), mountOne);
  }

  /* ---- the panel ------------------------------------------------------- */

  var pop = null, popFor = null;      // popFor = { slot, itemId, instanceId, btn, confirmDel, confirmName, renaming }

  function closePop() {
    if (!pop) return;
    pop.remove(); pop = null;
    if (popFor && popFor.btn) popFor.btn.setAttribute('aria-expanded', 'false');
    popFor = null;
  }
  function place() {
    if (!pop || !popFor) return;
    var b = popFor.btn.isConnected ? popFor.btn : document.querySelector('.asm-preset-slot[data-inst="' + popFor.instanceId + '"] .asm-set-btn');
    if (!b) return closePop();
    popFor.btn = b;
    var r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function togglePop(slot, itemId, instanceId, btn) {
    if (popFor && popFor.instanceId === instanceId) return closePop();
    closePop();
    pop = document.createElement('div');
    pop.className = 'asm-set-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Saved settings');
    document.body.appendChild(pop);
    popFor = { slot: slot, itemId: itemId, instanceId: instanceId, btn: btn };
    btn.setAttribute('aria-expanded', 'true');
    pop.addEventListener('click', onPopClick);
    pop.addEventListener('keydown', onPopKey);
    pop.addEventListener('submit', onPopSubmit);
    pop.addEventListener('input', function (e) {
      if (popFor && popFor.confirmName && e.target.classList.contains('asm-set-name')) {
        popFor.confirmName = null;
        var b = pop.querySelector('form button'), w = pop.querySelector('.foot .warn');
        if (b) b.textContent = 'Save';
        if (w) { w.className = 'inc'; w.innerHTML = 'Saves <b>inputs</b>, <b>edge banding</b>, <b>typed cells</b> and <b>row changes</b>.'; }
      }
    });
    renderPop();
    load(itemId, true).then(function () { if (popFor && popFor.instanceId === instanceId) renderPop(); });
  }
  function renderPop() {
    if (!pop || !popFor) return;
    var f = popFor, list = cache[f.itemId] || [], cur = presetOf(f.itemId, chosen[f.instanceId]);
    var dirty = cur && isDirty(f.instanceId, f.itemId);
    var typed = (pop.querySelector('.asm-set-name') || {}).value || '';
    pop.innerHTML = (list.length
      ? '<h3>Saved for this item</h3><ul>' + list.map(function (p) {
          var on = p.id === chosen[f.instanceId];
          var right = f.confirmDel === p.id
            ? '<button type="button" class="btn red" data-del-yes="' + esc(p.id) + '">Delete</button><button type="button" class="ib" data-del-no aria-label="Cancel">↩</button>'
            : '<button type="button" class="ib" data-ren="' + esc(p.id) + '" aria-label="Rename ' + esc(p.name) + '">✎</button>' +
              '<button type="button" class="ib del" data-del="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + '">🗑</button>';
          var title = f.renaming === p.id
            ? '<input class="asm-set-ren" value="' + esc(p.name) + '" aria-label="New name" maxlength="80">'
            : '<b>' + esc(p.name) + '</b>';
          return '<li class="' + (on ? 'on' : '') + '" data-load="' + esc(p.id) + '" tabindex="0">' +
            '<div class="meta">' + title + '<span>' + (on ? 'Loaded · ' : '') + esc(when(p.updated_at)) + '</span>' + tagsHtml(p) + '</div>' + right + '</li>';
        }).join('') + '</ul>'
      : '<h3>Saved settings</h3><p class="empty">Nothing saved for this item yet. Save the current sizes, edge banding and edits to reuse them on the next one.</p>') +
      '<div class="foot">' +
        (dirty ? '<button type="button" class="btn gold" data-update>Update “' + esc(cur.name) + '”</button>' : '') +
        '<label for="asm-set-name">Save current as new</label>' +
        '<form><input id="asm-set-name" class="asm-set-name" placeholder="e.g. 600 wide · 2 shelves" maxlength="80" autocomplete="off">' +
        '<button class="btn' + (dirty ? '' : ' gold') + '" type="submit">' + (f.confirmName ? 'Replace' : 'Save') + '</button></form>' +
        (f.confirmName ? '<span class="warn">“' + esc(f.confirmName) + '” already exists. Press Replace to overwrite it.</span>'
                       : '<span class="inc">Saves <b>inputs</b>, <b>edge banding</b>, <b>typed cells</b> and <b>row changes</b>.</span>') +
      '</div>';
    var nameEl = pop.querySelector('.asm-set-name');
    if (typed) nameEl.value = typed;
    var ren = pop.querySelector('.asm-set-ren');
    if (ren) { ren.focus(); ren.select(); ren.onblur = function () { finishRename(ren); }; }
    place();
  }
  function finishRename(inp) {
    if (!popFor || !popFor.renaming) return;
    var f = popFor, p = presetOf(f.itemId, f.renaming), v = String(inp.value || '').trim().slice(0, 80);
    f.renaming = null;
    if (!p || !v || v === p.name) return renderPop();
    if ((cache[f.itemId] || []).some(function (x) { return x.id !== p.id && x.name.toLowerCase() === v.toLowerCase(); })) {
      toast('A setting named "' + v + '" already exists', 'error'); return renderPop();
    }
    var old = p.name; p.name = v; renderPop(); repaintSlots(f.instanceId);
    post('/asm/presets/rename', { id: p.id, name: v })
      .then(function () { toast('Renamed to ' + v, 'success'); })
      .catch(function (e) { p.name = old; renderPop(); repaintSlots(f.instanceId); toast(e.message, 'error'); });
  }
  function onPopKey(e) {
    if (e.target.classList.contains('asm-set-ren')) {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Escape') { e.stopPropagation(); popFor.renaming = null; renderPop(); }
      return;
    }
    var li = e.target.closest && e.target.closest('[data-load]');
    if (li && e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); li.click(); }
  }
  function onPopClick(e) {
    e.stopPropagation();
    var f = popFor, t = e.target, el;
    if (!f) return;
    if (t.closest('input')) return;
    if ((el = t.closest('[data-del]'))) { f.confirmDel = el.getAttribute('data-del'); return renderPop(); }
    if (t.closest('[data-del-no]')) { f.confirmDel = null; return renderPop(); }
    if ((el = t.closest('[data-del-yes]'))) return doDelete(f.instanceId, f.itemId, el.getAttribute('data-del-yes'));
    if ((el = t.closest('[data-ren]'))) { f.renaming = el.getAttribute('data-ren'); f.confirmDel = null; return renderPop(); }
    if (t.closest('[data-update]')) { var cur = presetOf(f.itemId, chosen[f.instanceId]); if (cur) doSave(f.instanceId, f.itemId, cur.name); return; }
    if ((el = t.closest('[data-load]'))) { var id = el.getAttribute('data-load'), iid = f.instanceId, itm = f.itemId; closePop(); apply(iid, itm, id); }
  }
  function onPopSubmit(e) {
    e.preventDefault();
    var f = popFor; if (!f) return;
    var inp = pop.querySelector('.asm-set-name'), v = String(inp.value || '').trim().slice(0, 80);
    if (!v) { inp.focus(); return; }
    var ex = (cache[f.itemId] || []).find(function (x) { return x.name.toLowerCase() === v.toLowerCase(); });
    if (ex && f.confirmName !== ex.name) { f.confirmName = ex.name; renderPop(); var i2 = pop.querySelector('.asm-set-name'); i2.focus(); return; }
    doSave(f.instanceId, f.itemId, ex ? ex.name : v);
  }

  document.addEventListener('click', function (e) {
    if (pop && !e.target.closest('.asm-set-pop') && !e.target.closest('.asm-preset-slot')) closePop();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pop) { var b = popFor && popFor.btn; closePop(); b && b.focus && b.focus(); }
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);

  /* ---- actions --------------------------------------------------------- */

  function apply(instanceId, itemId, presetId) {
    var p = presetOf(itemId, presetId);
    if (!p) return;
    var m = asm();
    if (!m || !m.applyInputs(instanceId, p.inputs, p.inputs && p.inputs.__extra)) {
      toast('Could not apply that setting', 'error');
      return;
    }
    chosen[instanceId] = presetId;
    var now = m.getInstance(instanceId), miss = {};
    if (now) Object.keys(now.inputs).forEach(function (k) { if (!(k in (p.inputs || {}))) miss[k] = now.inputs[k]; });
    base[instanceId] = miss;
    toast('Loaded: ' + p.name, 'success');
    // applyInputs re-renders the SBS, which replaces this slot with a fresh one.
    setTimeout(function () { mountAll(); repaintSlots(instanceId); }, 0);
  }

  function doSave(instanceId, itemId, name) {
    var m = asm(), inst = m && m.getInstance(instanceId);
    if (inst && inst.pending) { toast('Still calculating — try again in a moment', 'error'); return; }
    var inputs = snapshot(instanceId);
    if (!inputs) return;
    post('/asm/presets/save', { itemId: itemId, name: name, inputs: inputs })
      .then(function (j) { chosen[instanceId] = j.preset.id; base[instanceId] = {}; return load(itemId, true); })
      .then(function () { closePop(); repaintSlots(instanceId); toast('Saved: ' + name, 'success'); })
      .catch(function (e) { toast(e.message, 'error'); });
  }

  function doDelete(instanceId, itemId, id) {
    post('/asm/presets/delete', { id: id })
      .then(function () {
        if (chosen[instanceId] === id) chosen[instanceId] = '';
        return load(itemId, true);
      })
      .then(function () { if (popFor) popFor.confirmDel = null; renderPop(); repaintSlots(instanceId); toast('Setting deleted', 'success'); })
      .catch(function (e) { toast(e.message, 'error'); });
  }

  // Edits that don't re-render the head (typing a size, edge banding) still
  // need the dot and Update button: re-check loaded settings once a second.
  setInterval(function () {
    Object.keys(chosen).forEach(function (iid) {
      if (!chosen[iid]) return;
      var sl = document.querySelector('.asm-preset-slot[data-inst="' + iid + '"][data-ready="1"]');
      var m = asm(), inst = sl && m && m.getInstance(iid);
      if (!inst) return;
      var d = isDirty(iid, inst.itemId) ? '1' : '0';
      if (sl.getAttribute('data-dirty') !== d) paint(sl, inst.itemId, iid, cache[inst.itemId] || []);
    });
  }, 1000);

  /* ---- keep slots filled ----------------------------------------------
     renderSBS() rebuilds the whole panel on almost every interaction, so
     rather than asking app-asm.js to call back on each path, watch the panel
     and fill any slot that appears. The check is a querySelectorAll on a
     small subtree, and it is debounced to one pass per frame. */

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; mountAll(); });
  }

  function watch() {
    var body = document.getElementById('asm-sbs-body');
    if (!body) return false;
    new MutationObserver(schedule).observe(body, { childList: true, subtree: true });
    schedule();
    return true;
  }

  // #asm-sbs-body only exists once the ASM page shell is built.
  var tries = 0;
  var iv = setInterval(function () {
    if (watch() || ++tries > 600) clearInterval(iv);   // give up after ~5 min idle
  }, 500);

  window.ASMPresets = { mountAll: mountAll, reload: function (itemId) { return load(itemId, true); } };
})();
