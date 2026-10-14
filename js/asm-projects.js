/* asm-projects.js — save, list, load, delete and duplicate ASM projects.
   Load BEFORE app-asm.js:

       <script src="js/asm-projects.js"></script>

   Split out of app-asm.js. This file owns the HTTP calls and the modals. It
   does NOT own state: currentProjectId / readyItems / sbsItems are reassigned
   in the core, so loading hands the project back through applyProject() and
   naming goes back through setMeta(). That keeps the one place that owns ASM
   state the one place that changes it.

       ASMProjects.init({
         apiBase, getToken, showToast,
         hasWork, getReadyItems, getMeta, setMeta, applyProject
       });
*/

(function () {
  'use strict';

  var ctx = {
    apiBase: function () { return ''; },
    getToken: function () { return null; },
    showToast: function () {},
    hasWork: function () { return false; },
    getReadyItems: function () { return []; },
    getMeta: function () { return { id: null, name: '', client: '' }; },
    setMeta: function () {},
    applyProject: function () {}
  };

  function init(c) { if (c) Object.assign(ctx, c); }

  function auth() { return { 'Authorization': 'Bearer ' + ctx.getToken() }; }
  function authJson() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ctx.getToken() }; }

  /* ── save ─────────────────────────────────────────────────────────────
     Always opens the modal, including for an existing project, so the client
     and name can be corrected on the way through. */

  function save() {
    if (!ctx.hasWork()) { ctx.showToast('Nothing to save', 'error'); return; }
    if (!ctx.getToken()) { ctx.showToast('Please login first', 'error'); return; }
    showSaveModal();
  }

  function showSaveModal() {
    var meta = ctx.getMeta();

    var modal = document.getElementById('asm-save-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-save-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:420px;overflow:hidden';

    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42';
    hdr.innerHTML = '<h3 style="margin:0;color:#ECB22E;font-size:16px">Save ASM Project</h3>';
    box.appendChild(hdr);

    var body = document.createElement('div');
    body.style.cssText = 'padding:20px';
    var clientOpts = (typeof clients !== 'undefined' && Array.isArray(clients))
      ? clients.map(function (c) {
          return '<option value="' + (c.name || '').replace(/"/g, '&quot;') + '">' + (c.name || '') + (c.biz ? (' · ' + c.biz) : '') + '</option>';
        }).join('')
      : '';
    body.innerHTML = '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">Client Name</label>' +
      '<select id="asm-save-client-sel" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:6px">' +
        '<option value="">— Select client —</option>' + clientOpts +
        '<option value="__new__">＋ Add new client</option>' +
      '</select>' +
      '<input id="asm-save-client" type="text" placeholder="e.g. Mr. Sharma" style="display:none;width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">ASM Name</label>' +
      '<input id="asm-save-name" type="text" placeholder="e.g. Master Bedroom Set" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">Remarks (optional)</label>' +
      '<input id="asm-save-remarks" type="text" placeholder="Any notes..." style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>';
    box.appendChild(body);

    var foot = document.createElement('div');
    foot.style.cssText = 'padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'asm-btn asm-btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function () { modal.remove(); };
    var saveBtn = document.createElement('button');
    saveBtn.className = 'asm-btn asm-btn-primary';
    saveBtn.textContent = 'Save Project';
    saveBtn.onclick = function () { doSave(); };
    foot.appendChild(cancelBtn);
    foot.appendChild(saveBtn);
    box.appendChild(foot);

    modal.appendChild(box);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    var sel = document.getElementById('asm-save-client-sel');
    var inp = document.getElementById('asm-save-client');
    sel.onchange = function () {
      if (sel.value === '__new__') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
      else { inp.style.display = 'none'; inp.value = sel.value; }
    };
    sel.focus();

    if (meta.id) {
      hdr.querySelector('h3').textContent = 'Edit ASM Project';
      var nameEl = document.getElementById('asm-save-name');
      if (nameEl && meta.name && meta.name !== 'Untitled') nameEl.value = meta.name;
      if (meta.client) {
        var match = Array.prototype.some.call(sel.options, function (o) { return o.value === meta.client; });
        if (match) sel.value = meta.client;
        else { sel.value = '__new__'; inp.style.display = 'block'; inp.value = meta.client; }
      }
    }
  }

  async function doSave() {
    var sel = document.getElementById('asm-save-client-sel');
    var inp = document.getElementById('asm-save-client');
    var clientName = (sel && sel.value === '__new__') ? inp.value.trim() : (sel ? sel.value.trim() : inp.value.trim());

    // A name typed here becomes a client in the optimizer's own list too.
    if (clientName && typeof clients !== 'undefined' && Array.isArray(clients)
        && !clients.some(function (c) { return (c.name || '').toLowerCase() === clientName.toLowerCase(); })) {
      clients.unshift({ id: 'c' + Date.now(), name: clientName, biz: '', phone: '' });
      if (typeof saveClients === 'function') saveClients();
    }

    var name = document.getElementById('asm-save-name').value.trim() || 'Untitled';
    var remarks = document.getElementById('asm-save-remarks').value.trim();
    if (!ctx.getToken()) { ctx.showToast('Please login first', 'error'); return; }

    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects/save', {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({
          projectId: ctx.getMeta().id, name: name, clientName: clientName,
          remarks: remarks, readyItems: ctx.getReadyItems()
        })
      });
      var data = await res.json();
      if (data.success) {
        ctx.setMeta({ id: data.project.id, name: name, client: clientName });
        ctx.showToast('Saved: ' + name, 'success');
        var modal = document.getElementById('asm-save-modal');
        if (modal) modal.remove();
      } else ctx.showToast(data.error || 'Save failed', 'error');
    } catch (err) { ctx.showToast('Save failed', 'error'); }
  }

  /* ── list ─────────────────────────────────────────────────────────────── */

  async function list() {
    if (!ctx.getToken()) { ctx.showToast('Please login first', 'error'); return; }
    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects', { headers: auth() });
      var data = await res.json();
      if (!data.success) { ctx.showToast(data.error || 'Failed', 'error'); return; }
      showListModal(data.projects);
    } catch (err) { ctx.showToast('Error: ' + err.message, 'error'); }
  }

  function showListModal(projects) {
    var modal = document.getElementById('asm-projects-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-projects-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:480px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column';

    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center';
    hdr.innerHTML = '<h3 style="margin:0;color:#ECB22E;font-size:16px">My ASM Projects</h3>';
    var xBtn = document.createElement('button');
    xBtn.style.cssText = 'background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer';
    xBtn.textContent = 'X';
    xBtn.onclick = function () { modal.remove(); };
    hdr.appendChild(xBtn);
    box.appendChild(hdr);

    var searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:10px 16px;background:#1A1D21;border-bottom:1px solid #2A2D31';
    searchWrap.innerHTML = '<input id="asm-proj-search" type="text" placeholder="Search projects or clients…" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">';
    box.appendChild(searchWrap);

    var listDiv = document.createElement('div');
    listDiv.style.cssText = 'padding:16px;overflow-y:auto;flex:1';

    function renderList(filter) {
      filter = (filter || '').toLowerCase();
      listDiv.innerHTML = '';
      var shown = projects.filter(function (p) {
        return !filter || (p.name || '').toLowerCase().indexOf(filter) >= 0 || (p.clientName || '').toLowerCase().indexOf(filter) >= 0;
      });
      if (!shown.length) {
        listDiv.innerHTML = '<div style="text-align:center;color:#7A7D82;padding:30px">No matching projects</div>';
        return;
      }
      shown.forEach(function (p) {
        var date = new Date(p.updatedAt).toLocaleDateString();
        var card = document.createElement('div');
        card.style.cssText = 'background:#222529;border:1px solid #3A3D42;border-radius:8px;padding:12px;margin:8px 0;cursor:pointer';
        card.onmouseover = function () { card.style.borderColor = '#ECB22E'; };
        card.onmouseout = function () { card.style.borderColor = '#3A3D42'; };
        card.onclick = function () { load(p.id); };

        var info = '<div style="font-weight:700;color:#fff">' + p.name + '</div>';
        if (p.clientName) info += '<div style="font-size:11px;color:#ECB22E">' + p.clientName + '</div>';
        info += '<div style="font-size:11px;color:#7A7D82">' + p.itemCount + ' items | ' + p.totalPanels + ' panels | ' + date + '</div>';

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        row.innerHTML = '<div>' + info + '</div>';

        var acts = document.createElement('div');
        acts.style.cssText = 'display:flex;align-items:center;gap:4px;flex:0 0 auto';

        var dup = document.createElement('button');
        dup.style.cssText = 'background:none;border:1px solid #3A3D42;color:#ECB22E;cursor:pointer;font-size:11px;font-weight:700;padding:4px 9px;border-radius:5px';
        dup.textContent = 'DUP';
        dup.title = 'Duplicate this project';
        dup.onclick = function (e) { e.stopPropagation(); duplicate(p.id); };

        var del = document.createElement('button');
        del.style.cssText = 'background:none;border:none;color:#E01E5A;cursor:pointer;font-size:12px;padding:4px 8px';
        del.textContent = 'DEL';
        del.onclick = function (e) { e.stopPropagation(); remove(p.id); };

        acts.appendChild(dup);
        acts.appendChild(del);
        row.appendChild(acts);
        card.appendChild(row);
        listDiv.appendChild(card);
      });
    }

    if (!projects.length) {
      listDiv.innerHTML = '<div style="text-align:center;color:#7A7D82;padding:30px">No saved projects yet</div>';
    } else {
      renderList('');
    }

    box.appendChild(listDiv);
    modal.appendChild(box);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    var si = document.getElementById('asm-proj-search');
    if (si) si.oninput = function () { renderList(si.value); };
  }

  /* ── load / delete / duplicate ────────────────────────────────────────── */

  async function load(projectId) {
    if (!ctx.getToken()) return;
    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects/' + projectId, { headers: auth() });
      var data = await res.json();
      if (!data.success) { ctx.showToast(data.error || 'Load failed', 'error'); return; }
      ctx.applyProject(data.project);        // the core owns the state swap
      var m = document.getElementById('asm-projects-modal');
      if (m) m.remove();
      ctx.showToast('Loaded: ' + data.project.name, 'success');
    } catch (err) { ctx.showToast('Load error', 'error'); }
  }

  async function remove(projectId) {
    if (!confirm('Delete this project?')) return;
    if (!ctx.getToken()) return;
    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects/' + projectId, { method: 'DELETE', headers: auth() });
      var data = await res.json();
      if (data.success) {
        if (ctx.getMeta().id === projectId) ctx.setMeta({ id: null, name: '', client: '' });
        ctx.showToast('Deleted', 'success');
        list();
      } else ctx.showToast(data.error || 'Failed', 'error');
    } catch (err) { ctx.showToast('Error', 'error'); }
  }

  // Read the project back and re-save it with no id, which creates a new row.
  // No new endpoint needed.
  async function duplicate(projectId) {
    if (!ctx.getToken()) { ctx.showToast('Please login first', 'error'); return; }
    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects/' + projectId, { headers: auth() });
      var data = await res.json();
      if (!data.success) { ctx.showToast(data.error || 'Could not read that project', 'error'); return; }

      var p = data.project;
      var name = prompt('Name for the copy:', (p.name || 'Untitled') + ' (copy)');
      if (name === null) return;

      var out = await (await fetch(ctx.apiBase() + '/asm/projects/save', {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({
          name: String(name).trim() || ((p.name || 'Untitled') + ' (copy)'),
          clientName: p.clientName || '',
          readyItems: p.readyItems || []
        })
      })).json();

      if (!out.success) { ctx.showToast(out.error || 'Duplicate failed', 'error'); return; }
      ctx.showToast('Duplicated', 'success');
      list();
    } catch (e) { ctx.showToast('Duplicate failed', 'error'); }
  }

  window.ASMProjects = {
    init: init, save: save, list: list,
    load: load, remove: remove, duplicate: duplicate
  };
})();