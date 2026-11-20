/* asm-ris.js — the Ready Items Space (right panel): list, sort, duplicate,
   remove, clear and the Review Check table. Load BEFORE app-asm.js.

   Split out of app-asm.js. readyItems stays owned by the core; this module
   reads it with getReady() and replaces it with setReady().

       const R = ASMRis.create({ getReady, setReady, markDirty, showToast,
                                 updateRisBadge, getDimOrder });
 */

(function () {
  'use strict';

  function create(ctx) {
    const R = function () { return ctx.getReady(); };

    let risSortMode = 'none';    // 'none' | 'room' | 'item'

    function getSortedReady() {
      if (risSortMode === 'none') return R().map((it, i) => ({ it, origIdx: i }));
      const arr = R().map((it, i) => ({ it, origIdx: i }));
      const key = risSortMode === 'room'
        ? (x => (x.it.roomName || '\uffff').toLowerCase())   // blank rooms sort last
        : (x => (x.it.itemName || '').toLowerCase());
      return arr.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.origIdx - b.origIdx);
    }

    function setRisSort(mode) {
      risSortMode = mode;
      renderReadyItems();
    }

    function renderReadyItems() {
      ctx.updateRisBadge();
      const list = document.getElementById('asm-ris-list');
      if (!list) return;

      if (R().length === 0) {
        list.innerHTML = `<div class="asm-empty">No saved items yet.<br>Build items in SBS, then Save.</div>`;
        return;
      }

      list.innerHTML = getSortedReady().map(({ it, origIdx }) => {
        const totalPanels = it.outputs.reduce((a, o) => a + (o.qty || 0), 0);
        const isEditing = it._editing ? true : false;
        return `
          <div class="asm-ris-item" style="${isEditing ? 'border-color:#ECB22E;background:#2C2D30' : ''}">
            <div class="asm-ris-item-head">
              <span class="asm-ris-num">${origIdx + 1}</span>
              <span class="asm-ris-name" style="cursor:pointer" onclick="ASMModule.reopenReady('${it.readyId}')" title="Click to edit">${it.itemName}${it.roomName ? ' <span style="font-size:10px;background:rgba(236,178,46,.16);color:#ECB22E;padding:2px 7px;border-radius:10px;font-weight:700">'+it.roomName+'</span>' : ''}${isEditing ? ' <span style="font-size:9px;background:#ECB22E;color:#1A1D21;padding:1px 5px;border-radius:3px;font-weight:700">EDITING</span>' : ''}</span>
              <button class="asm-ris-remove" onclick="ASMModule.duplicateReady('${it.readyId}')" title="Duplicate" style="margin-right:2px">&#10697;</button>
              <button class="asm-ris-remove" onclick="ASMModule.removeReady('${it.readyId}')" title="Remove">&#10005;</button>
            </div>
            <div class="asm-ris-meta">
              ${it.imported ? 'Imported file' : (() => { const i = it.inputs; const w = i.width || i.w || i.W || '?'; const h = i.ht || i.h || i.H || i.height || '?'; const d = i.depth || i.d || i.D || '?'; return (ctx.getDimOrder()==='hw' ? (h + '×' + w) : (w + '×' + h)) + '×' + d + 'mm'; })()}
              · ${it.outputs.length} parts · ${totalPanels} panels
            </div>
          </div>`;
      }).join('');
    }


    // Duplicate a RIS item as a new independent entry (deep copy of inputs+outputs).
    function duplicateReady(readyId) {
      const it = R().find(i => i.readyId === readyId);
      if (!it) return;
      const idx = R().indexOf(it);
      const copy = {
        readyId: 'ready_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        itemId: it.itemId,
        itemName: it.itemName,
        roomName: it.roomName || '',
        catalogueKey: it.catalogueKey,
        inputs: { ...it.inputs },
        outputs: (it.outputs || []).map(o => ({ ...o })),
        deletedRows: Object.assign({}, it.deletedRows || {}),
        subItems: (it.subItems || []).map(s => ({ ...s })),
        imported: it.imported || false
      };
      R().splice(idx + 1, 0, copy);   // insert right after the original
      renderReadyItems();
      ctx.markDirty();
      ctx.showToast('Item duplicated', 'success');
    }

    function removeReady(readyId) {
      const it = R().find(i => i.readyId === readyId);
      const name = it ? (it.itemName || 'this item') : 'this item';
      if (!confirm('Do you want to delete ' + name + '?')) return;
      ctx.setReady(R().filter(i => i.readyId !== readyId));
      renderReadyItems();
      ctx.markDirty();
    }

    function reviewCheck(sortBy) {
      console.log('[reviewCheck] fired. R() =', R().length);
      if (!R() || !R().length) {
        const m = document.createElement('div');
        m.className = 'asm-review-overlay';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';
        m.innerHTML = '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:28px 32px;text-align:center;max-width:360px"><div style="font-size:16px;color:#fff;margin-bottom:6px">No saved items yet</div><div style="font-size:13px;color:#9A9DA2;margin-bottom:18px">Build an item in SBS and click <b style="color:#ECB22E">Save to Ready</b> first.</div><button class="asm-btn asm-btn-primary" onclick="this.closest(\'.asm-review-overlay\').remove()">OK</button></div>';
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
        document.body.appendChild(m);
        return;
      }

      const mode = sortBy || risSortMode || 'none';
      let entries = R().map((it, i) => ({ it, origIdx: i }));
      if (mode === 'room') entries.sort((a, b) => ((a.it.roomName || '\uffff').toLowerCase() < (b.it.roomName || '\uffff').toLowerCase() ? -1 : 1));
      else if (mode === 'item') entries.sort((a, b) => ((a.it.itemName || '').toLowerCase() < (b.it.itemName || '').toLowerCase() ? -1 : 1));

      const rows = entries.map(({ it, origIdx }) => {
        const i = it.inputs || {};
        const w = i.width || i.w || i.W || '-';
        const h = i.ht || i.h || i.H || i.height || '-';
        const d = i.depth || i.d || i.D || '-';
        const q = i.qty || i.Qty || i.quantity || 1;
        const room = it.roomName || '-';
        return `<tr>
          <td style="padding:8px 10px;color:#9A9DA2">${origIdx + 1}</td>
          <td style="padding:8px 10px;color:${it.roomName ? '#ECB22E' : '#666'}">${room}</td>
          <td style="padding:8px 10px;color:#fff">${it.itemName}</td>
          <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${ctx.getDimOrder()==='hw'?h:w}</td>
          <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${ctx.getDimOrder()==='hw'?w:h}</td>
          <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${d}</td>
          <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${q}</td>
        </tr>`;
      }).join('');
      const arrow = m => mode === m ? ' <span style="color:#ECB22E">▼</span>' : '';

      const modal = document.createElement('div');
      modal.className = 'asm-review-overlay';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';
      modal.innerHTML = `
        <div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;width:min(720px,92vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:16px 20px;border-bottom:1px solid #2A2D31;display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:17px;font-weight:700;color:#fff">Review Check — ${R().length} item${R().length > 1 ? 's' : ''}</div>
            <button onclick="this.closest('.asm-review-overlay').remove()" style="background:none;border:none;color:#9A9DA2;font-size:22px;cursor:pointer;line-height:1">&#10005;</button>
          </div>
          <div style="overflow:auto;padding:0 4px">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="position:sticky;top:0;background:#232629">
                  <th style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600">#</th>
                  <th onclick="this.closest('.asm-review-overlay').remove();ASMModule.reviewCheck('room')" style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600;cursor:pointer;user-select:none">Room${arrow('room')}</th>
                  <th onclick="this.closest('.asm-review-overlay').remove();ASMModule.reviewCheck('item')" style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600;cursor:pointer;user-select:none">Item${arrow('item')}</th>
                  <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">${ctx.getDimOrder()==='hw'?'H':'W'}</th>
                  <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">${ctx.getDimOrder()==='hw'?'W':'H'}</th>
                  <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">D</th>
                  <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">Qty</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="padding:14px 20px;border-top:1px solid #2A2D31;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:#666">${mode === 'none' ? 'Default order' : 'Sorted by ' + mode}</span>
            <span style="display:flex;gap:8px">
              ${mode !== 'none' ? '<button class="asm-btn asm-btn-ghost" onclick="this.closest(\'.asm-review-overlay\').remove();ASMModule.reviewCheck(\'none\')">Default order</button>' : ''}
              <button class="asm-btn asm-btn-primary" onclick="this.closest('.asm-review-overlay').remove()">Close</button>
            </span>
          </div>
        </div>`;
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    function clearReady() {
      if (R().length === 0) return;
      if (!confirm('Clear all ready items?')) return;
      ctx.setReady([]);
      renderReadyItems();
      ctx.markDirty();
    }

    return {
      renderReadyItems: renderReadyItems, setRisSort: setRisSort,
      duplicateReady: duplicateReady, removeReady: removeReady,
      reviewCheck: reviewCheck, clearReady: clearReady
    };
  }

  window.ASMRis = { create: create };
})();
