/* asm-share.js — send a copy of saved projects to another Pro user.
   Load BEFORE app-asm.js:

       <script src="js/asm-share.js"></script>

   Split out of app-asm.js unchanged. Pro-to-Pro only; the server enforces
   that, this file just collects an email and a set of project ids.

       ASMShare.init({ apiBase, getToken, showToast, escapeHtml });
       ASMShare.open();
*/

(function () {
  'use strict';

  var ctx = {
    apiBase: function () { return ''; },
    getToken: function () { return null; },
    showToast: function () {},
    escapeHtml: function (s) { return String(s == null ? '' : s); }
  };

  function init(c) { if (c) Object.assign(ctx, c); }

  async function open() {
    var token = ctx.getToken();
    if (!token) { ctx.showToast('Please login first', 'error'); return; }

    // Load the user's saved projects to choose from.
    var projects = [];
    try {
      var res = await fetch(ctx.apiBase() + '/asm/projects', { headers: { 'Authorization': 'Bearer ' + token } });
      var data = await res.json();
      if (data.success) projects = data.projects || [];
    } catch (e) { ctx.showToast('Could not load your projects', 'error'); return; }
    if (!projects.length) { ctx.showToast('Save a project first, then share it', 'error'); return; }

    var esc = ctx.escapeHtml;
    var modal = document.getElementById('asm-share-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-share-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10006;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px';

    var html = '<div style="background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:100%;max-width:440px;max-height:88vh;overflow-y:auto;padding:20px">';
    html += '<h3 style="margin:0 0 4px;color:#ECB22E;font-size:16px">Share Cutlist</h3>';
    html += '<p style="margin:0 0 14px;color:#9A9DA2;font-size:12px">Sends a copy to another Pro user. They can edit and export their own copy.</p>';
    html += '<label style="display:block;font-size:11px;color:#9A9DA2;margin-bottom:4px">Recipient email (Pro user)</label>';
    html += '<input id="asm-share-email" type="email" placeholder="name@example.com" style="width:100%;box-sizing:border-box;background:#222529;border:1px solid #3A3D42;color:#fff;border-radius:6px;padding:9px;font-size:13px;margin-bottom:14px">';
    html += '<div style="font-size:11px;color:#9A9DA2;margin-bottom:6px">Select projects to share</div>';
    html += '<div style="max-height:230px;overflow-y:auto;border:1px solid #2A2D31;border-radius:8px">';
    projects.forEach(function (p) {
      html += '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border-bottom:1px solid #26282C;cursor:pointer;font-size:12.5px;color:#fff">' +
        '<input type="checkbox" class="asm-share-chk" value="' + p.id + '" style="width:16px;height:16px;accent-color:#ECB22E">' +
        '<span>' + esc(p.name || 'Untitled') + (p.clientName ? ' <span style="color:#7A7D82">· ' + esc(p.clientName) + '</span>' : '') + '</span></label>';
    });
    html += '</div>';
    html += '<div id="asm-share-status" style="font-size:12px;margin:12px 0 0;min-height:16px"></div>';
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">';
    html += '<button class="asm-btn asm-btn-ghost" id="asm-share-cancel">Cancel</button>';
    html += '<button class="asm-btn asm-btn-primary" id="asm-share-send">Share</button>';
    html += '</div></div>';

    modal.innerHTML = html;
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('asm-share-cancel').onclick = function () { modal.remove(); };
    document.getElementById('asm-share-send').onclick = function () { send(modal); };
  }

  async function send(modal) {
    var email = (document.getElementById('asm-share-email').value || '').trim();
    var ids = Array.prototype.map.call(document.querySelectorAll('.asm-share-chk:checked'), function (c) { return c.value; });
    var st = document.getElementById('asm-share-status');
    if (!email) { st.textContent = 'Enter a recipient email'; st.style.color = '#E01E5A'; return; }
    if (!ids.length) { st.textContent = 'Select at least one project'; st.style.color = '#E01E5A'; return; }
    st.textContent = 'Sharing…'; st.style.color = '#7A7D82';

    try {
      var res = await fetch(ctx.apiBase() + '/asm/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ctx.getToken() },
        body: JSON.stringify({ recipientEmail: email, projectIds: ids })
      });
      var data = await res.json();
      if (!res.ok || !data.success) { st.textContent = data.error || 'Share failed'; st.style.color = '#E01E5A'; return; }
      st.textContent = '✓ ' + (data.message || 'Shared'); st.style.color = '#2EB67D';
      setTimeout(function () { modal.remove(); }, 1200);
    } catch (e) { st.textContent = e.message; st.style.color = '#E01E5A'; }
  }

  window.ASMShare = { init: init, open: open };
})();