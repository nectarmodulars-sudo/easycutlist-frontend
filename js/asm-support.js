/* asm-support.js — item problem reporting and the user's message threads.
   Load BEFORE app-asm.js:

       <script src="js/asm-support.js"></script>

   Split out of app-asm.js. Everything here talks to /asm/problem*, and it owns
   the screenshot attach/compress helpers, which nothing else used.

   app-asm.js wires it once, at the top of openASM():

       ASMSupport.init({ apiBase: apiBase, authH: authH, showToast: showToast });

   then calls ASMSupport.report(itemName), ASMSupport.openMessages() and
   ASMSupport.refreshBadge(). The inline onclick handlers inside this file's
   HTML call ASMSupport.* directly, so nothing here depends on ASMModule. */

(function () {
  'use strict';

  var ctx = {
    apiBase: function () { return ''; },
    authH: function () { return {}; },
    showToast: function () {}
  };

  function init(c) { if (c) Object.assign(ctx, c); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function jsonH() { return Object.assign({ 'Content-Type': 'application/json' }, ctx.authH()); }

  /* ── attachments ─────────────────────────────────────────────────────
     Screenshots go up as compressed data URLs inside the JSON body. JPEG,
     longest edge 1600, q0.7 — a phone screenshot lands around 150 KB, which
     the 1mb body limit on /asm/problem comfortably takes six of. */

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png)$/.test(file.type)) { reject(new Error('Only JPG/PNG')); return; }
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function (e) { img.src = e.target.result; };
      reader.onerror = function () { reject(new Error('read failed')); };
      img.onload = function () {
        var MAX = 1600, w = img.width, h = img.height;
        if (w > MAX || h > MAX) { var s = Math.min(MAX / w, MAX / h); w = Math.round(w * s); h = Math.round(h * s); }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = function () { reject(new Error('bad image')); };
      reader.readAsDataURL(file);
    });
  }

  var stores = {};   // previewId -> [dataURL | null]

  function buildAttachUI(previewId) {
    return '<div style="margin-top:10px">' +
      '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#9A9DA2;cursor:pointer">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>' +
        'Attach screenshots' +
        '<input type="file" accept="image/png,image/jpeg" multiple style="display:none" ' +
          'onchange="ASMSupport._onAttach(event,\'' + previewId + '\')"></label>' +
      '<div id="' + previewId + '" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div></div>';
  }

  async function _onAttach(ev, previewId) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    var prev = document.getElementById(previewId);
    var store = stores[previewId] = stores[previewId] || [];
    for (var i = 0; i < files.length; i++) {
      if (store.filter(Boolean).length >= 6) { ctx.showToast('Max 6 images', 'error'); break; }
      try {
        var durl = await compressImage(files[i]);
        store.push(durl);
        var idx = store.length - 1;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;width:52px;height:52px';
        wrap.innerHTML = '<img src="' + durl + '" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #3A3D42">' +
          '<span style="position:absolute;top:-6px;right:-6px;background:#E01E5A;color:#fff;border-radius:50%;width:16px;height:16px;font-size:11px;line-height:16px;text-align:center;cursor:pointer" ' +
          'onclick="ASMSupport._rmAttach(\'' + previewId + '\',' + idx + ',this)">&times;</span>';
        prev.appendChild(wrap);
      } catch (e) { ctx.showToast(e.message, 'error'); }
    }
    ev.target.value = '';
  }

  // Tombstone rather than splice, so the indices baked into the other
  // thumbnails' onclick attributes keep pointing at the right entries.
  function _rmAttach(previewId, idx, el) {
    var store = stores[previewId];
    if (store && store[idx] !== undefined) store[idx] = null;
    if (el && el.parentElement) el.parentElement.remove();
  }
  function collect(previewId) { return (stores[previewId] || []).filter(Boolean); }
  function clear(previewId) { delete stores[previewId]; }

  function renderAttachments(atts) {
    if (!atts || !atts.length) return '';
    return '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">' +
      atts.map(function (u) {
        return '<a href="' + u + '" target="_blank" rel="noopener"><img src="' + u + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #3A3D42"></a>';
      }).join('') + '</div>';
  }

  /* ── report a problem ────────────────────────────────────────────────── */

  function report(itemName) {
    itemName = itemName || 'Item';
    var ov = document.createElement('div');
    ov.className = 'asm-review-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';
    ov.innerHTML =
      '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:24px;max-width:480px;width:92%">' +
        '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">Report a problem</div>' +
        '<div style="font-size:13px;color:#9A9DA2;margin-bottom:14px">Item: <b style="color:#ECB22E">' + esc(itemName) + '</b></div>' +
        '<textarea id="rpBody" rows="5" placeholder="Describe the problem…" style="width:100%;box-sizing:border-box;background:#14161A;border:1px solid #3A3D42;color:#fff;border-radius:8px;padding:10px;font-family:inherit;font-size:13px;resize:vertical"></textarea>' +
        buildAttachUI('rpAttach') +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
          '<button class="asm-btn asm-btn-ghost" id="rpCancel">Cancel</button>' +
          '<button class="asm-btn" style="background:#E01E5A;color:#fff" id="rpSend">Send</button>' +
        '</div>' +
        '<div id="rpStatus" style="font-size:12px;margin-top:8px"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var close = function () { ov.remove(); };
    ov.querySelector('#rpCancel').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    ov.querySelector('#rpSend').onclick = async function () {
      var body = ov.querySelector('#rpBody').value.trim();
      var st = ov.querySelector('#rpStatus');
      var images = collect('rpAttach');
      if (!body && !images.length) { st.textContent = 'Add a message or image.'; st.style.color = '#E01E5A'; return; }
      st.textContent = 'Sending…'; st.style.color = '#9A9DA2';
      try {
        var res = await fetch(ctx.apiBase() + '/asm/problem', {
          method: 'POST', headers: jsonH(),
          body: JSON.stringify({ itemName: itemName, body: body, images: images })
        });
        var d = await res.json();
        if (d.success) { clear('rpAttach'); ctx.showToast('Problem reported — we will reply soon', 'success'); close(); }
        else { st.textContent = d.error || 'Failed to send'; st.style.color = '#E01E5A'; }
      } catch (e) { st.textContent = e.message; st.style.color = '#E01E5A'; }
    };
  }

  /* ── my messages ─────────────────────────────────────────────────────── */

  var overlay = null;

  async function refreshBadge() {
    try {
      var res = await fetch(ctx.apiBase() + '/asm/my-problems', { headers: ctx.authH() });
      var d = await res.json();
      var probs = d.problems || [];
      var unread = probs.filter(function (p) { return p.unread_user; }).length;
      var badge = document.getElementById('asm-msgs-badge');
      if (badge) {
        if (unread > 0) { badge.textContent = unread; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
      }
      return probs;
    } catch (e) { return []; }
  }

  function threadHtml(p) {
    return (p.messages || []).map(function (m) {
      var mine = m.sender === 'user';
      return '<div style="margin:6px 0;display:flex;' + (mine ? 'justify-content:flex-end' : '') + '">' +
        '<div style="max-width:80%;background:' + (mine ? '#2B5C43' : '#26282C') + ';color:#eee;padding:8px 11px;border-radius:9px;font-size:13px">' +
          '<div style="font-size:10px;color:#9A9DA2;margin-bottom:2px">' + (mine ? 'You' : 'Support') + ' · ' + fmt(m.created_at) + '</div>' +
          (m.body ? esc(m.body) : '') + renderAttachments(m.attachments) + '</div></div>';
    }).join('');
  }

  async function openMessages() {
    var probs = await refreshBadge();
    var ov = document.createElement('div');
    ov.className = 'asm-review-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';

    var body = probs.length ? probs.map(function (p) {
      return '<div style="background:#1A1D21;border:1px solid #2A2D31;border-radius:10px;padding:14px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<div style="font-size:13px;color:#ECB22E;font-weight:700">' + esc(p.item_name || 'Item') +
            (p.status === 'closed' ? ' <span style="background:#555;color:#fff;font-size:9px;padding:1px 6px;border-radius:8px">CLOSED</span>' : '') + '</div>' +
          '<div style="font-size:11px;color:#9A9DA2">' + fmt(p.created_at) + '</div>' +
        '</div>' +
        '<div style="max-height:220px;overflow-y:auto;margin-bottom:8px">' + threadHtml(p) + '</div>' +
        (p.status === 'closed'
          ? '<div style="font-size:12px;color:#9A9DA2">This thread is closed.</div>'
          : '<div style="display:flex;gap:6px">' +
              '<input id="myreply-' + p.id + '" placeholder="Reply…" style="flex:1;background:#111;border:1px solid #3A3D42;color:#fff;border-radius:6px;padding:7px;font-size:13px;font-family:inherit">' +
              '<button class="asm-btn asm-btn-primary" onclick="ASMSupport.reply(' + p.id + ')">Send</button>' +
            '</div>' + buildAttachUI('myAttach-' + p.id)) +
        '<div id="myrepstatus-' + p.id + '" style="font-size:11px;margin-top:4px"></div>' +
      '</div>';
    }).join('') : '<div style="color:#9A9DA2;font-size:13px;text-align:center;padding:20px">No messages yet. Use "Report Problem" on an item to start.</div>';

    ov.innerHTML =
      '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:22px;max-width:560px;width:94%;max-height:82vh;overflow-y:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<div style="font-size:16px;font-weight:700;color:#fff">My Messages</div>' +
          '<button class="asm-btn asm-btn-ghost" id="myMsgClose">Close</button>' +
        '</div>' + body +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#myMsgClose').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    overlay = ov;

    // Clear the unread flag on anything the user is now looking at.
    try {
      for (var i = 0; i < probs.length; i++) {
        if (probs[i].unread_user) {
          await fetch(ctx.apiBase() + '/asm/problem/mark-read', {
            method: 'POST', headers: jsonH(),
            body: JSON.stringify({ problem_id: probs[i].id })
          });
        }
      }
      refreshBadge();
    } catch (e) {}
  }

  async function reply(id) {
    var inp = document.getElementById('myreply-' + id);
    var st = document.getElementById('myrepstatus-' + id);
    var body = (inp.value || '').trim();
    var images = collect('myAttach-' + id);
    if (!body && !images.length) { st.textContent = 'Add text or image.'; st.style.color = '#E01E5A'; return; }
    st.textContent = 'Sending…'; st.style.color = '#9A9DA2';
    try {
      var res = await fetch(ctx.apiBase() + '/asm/problem/reply', {
        method: 'POST', headers: jsonH(),
        body: JSON.stringify({ problem_id: id, body: body, images: images })
      });
      var d = await res.json();
      if (d.success) {
        clear('myAttach-' + id);
        if (overlay) overlay.remove();
        openMessages();          // reload the thread
      } else { st.textContent = d.error || 'Failed'; st.style.color = '#E01E5A'; }
    } catch (e) { st.textContent = e.message; st.style.color = '#E01E5A'; }
  }

  window.ASMSupport = {
    init: init,
    report: report,
    openMessages: openMessages,
    refreshBadge: refreshBadge,
    reply: reply,
    _onAttach: _onAttach,
    _rmAttach: _rmAttach
  };
})();