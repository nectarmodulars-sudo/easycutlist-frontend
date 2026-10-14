/* asm-presets.js — "Load Setting" per catalogue item.
   Load AFTER app-asm.js:

       <script src="js/asm-presets.js"></script>

   Save the inputs you are looking at under a name, and pull them back on any
   later item of the same type. Only the inputs are stored — reloading a
   setting re-runs the formulas, it does not restore a frozen output table.
   A frozen result is what Ready Items are for.

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
      '.asm-preset-sel{background:#14161A;border:1px solid #3A3D42;color:#E8E8E8;border-radius:6px;',
      '  padding:5px 8px;font-size:12px;font-family:inherit;cursor:pointer;max-width:200px}',
      '.asm-preset-sel:focus{outline:none;border-color:#ECB22E}',
      '.asm-preset-btn{background:#2A2D31;border:1px solid #3A3D42;color:#ECB22E;border-radius:6px;',
      '  padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;line-height:1}',
      '.asm-preset-btn:hover{border-color:#ECB22E;background:#34383D}',
      '.asm-preset-btn.del{color:#E01E5A}',
      '.asm-preset-btn.del:hover{border-color:#E01E5A;background:rgba(224,30,90,.12)}',
      '.asm-preset-btn[disabled]{opacity:.4;cursor:default}',
      '@media (max-width:900px){.asm-preset-slot{width:100%;margin:6px 0 0}.asm-preset-sel{flex:1}}'
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

  /* ---- render one slot ------------------------------------------------- */

  function paint(slot, itemId, instanceId, presets) {
    var sel = chosen[instanceId] || '';
    slot.innerHTML =
      '<select class="asm-preset-sel" title="Saved settings for this item">' +
        '<option value="">' + (presets.length ? 'Load setting…' : 'No saved settings') + '</option>' +
        presets.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        }).join('') +
      '</select>' +
      '<button class="asm-preset-btn save" title="Save the inputs above as a named setting">Save setting</button>' +
      '<button class="asm-preset-btn del" title="Delete the selected setting"' + (sel ? '' : ' disabled') + '>&#10005;</button>';

    var selEl = slot.querySelector('.asm-preset-sel');
    selEl.onclick = function (e) { e.stopPropagation(); };   // the head is a click target
    selEl.onchange = function () { apply(instanceId, itemId, selEl.value, slot); };
    slot.querySelector('.save').onclick = function (e) { e.stopPropagation(); save(instanceId, itemId, slot); };
    slot.querySelector('.del').onclick  = function (e) { e.stopPropagation(); del(instanceId, itemId, slot); };
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

  /* ---- actions --------------------------------------------------------- */

  function apply(instanceId, itemId, presetId, slot) {
    chosen[instanceId] = presetId;
    if (!presetId) { paint(slot, itemId, instanceId, cache[itemId] || []); return; }
    var p = (cache[itemId] || []).find(function (x) { return x.id === presetId; });
    if (!p) return;
    var m = asm();
    if (!m || !m.applyInputs(instanceId, p.inputs)) {
      toast('Could not apply that setting', 'error');
      return;
    }
    toast('Loaded: ' + p.name, 'success');
    // applyInputs re-renders the SBS, which replaces this slot with a fresh one.
    setTimeout(mountAll, 0);
  }

  function save(instanceId, itemId, slot) {
    var m = asm();
    var inst = m && m.getInstance(instanceId);
    if (!inst) return;
    var cur = (cache[itemId] || []).find(function (x) { return x.id === chosen[instanceId]; });
    var name = prompt('Name this setting (an existing name overwrites it):',
                      cur ? cur.name : (inst.itemName || 'Setting'));
    if (name === null) return;
    name = String(name).trim();
    if (!name) { toast('Give the setting a name', 'error'); return; }

    fetch(API + '/asm/presets/save', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()),
      body: JSON.stringify({ itemId: itemId, name: name, inputs: inst.inputs })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) throw new Error(j.error || 'Save failed');
        chosen[instanceId] = j.preset.id;
        return load(itemId, true);
      })
      .then(function (list) { paint(slot, itemId, instanceId, list); toast('Saved: ' + name, 'success'); })
      .catch(function (e) { toast(e.message, 'error'); });
  }

  function del(instanceId, itemId, slot) {
    var id = chosen[instanceId];
    if (!id) return;
    var p = (cache[itemId] || []).find(function (x) { return x.id === id; });
    if (!confirm('Delete saved setting "' + (p ? p.name : '') + '"?')) return;

    fetch(API + '/asm/presets/delete', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()),
      body: JSON.stringify({ id: id })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) throw new Error(j.error || 'Delete failed');
        chosen[instanceId] = '';
        return load(itemId, true);
      })
      .then(function (list) { paint(slot, itemId, instanceId, list); toast('Setting deleted', 'success'); })
      .catch(function (e) { toast(e.message, 'error'); });
  }

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
