/* asm-export.js — Ready Items → Optimizer (with the Replace / Add question)
   and Ready Items → Export Files (PDF, CSV, Excel, .saw, Factory CSV).
   Load BEFORE app-asm.js.

   Split out of app-asm.js.

       const E = ASMExport.create({ getReady, getOrderName, showToast, trackAsm,
                                    closeASM, exportToPDF });
 */

(function () {
  'use strict';

  function create(ctx) {
    // ========================================================================
    // EXPORT TO PROJECT (push panels into EasyCutList's panel list)
    // ========================================================================

    function exportReady() {
      if (ctx.getReady().length === 0) {
        ctx.showToast('No items to export', 'error');
        return;
      }

      // Check if addPanel function exists (from app-data.js)
      if (typeof window.addPanel !== 'function') {
        ctx.showToast('EasyCutList panel system not found', 'error');
        return;
      }

      // Optimizer already holds panels (earlier work, or an earlier export of
      // this same project) → ask, never mix silently. Replace is the default.
      const existing = (typeof window.panelCount === 'function') ? window.panelCount() : 0;
      if (existing > 0) { showExportChoiceModal(existing); return; }
      _doExport(false);
    }

    function showExportChoiceModal(existing) {
      let modal = document.getElementById('asm-export-choice');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'asm-export-choice';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
      const box = document.createElement('div');
      box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:420px;max-width:92vw;overflow:hidden';
      box.innerHTML =
        '<div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42">' +
          '<h3 style="margin:0;color:#ECB22E;font-size:15px">Optimizer already has panels</h3></div>' +
        '<div style="padding:18px 20px;color:#D1D2D3;font-size:13px;line-height:1.5">' +
          'The optimizer already has <b style="color:#fff">' + existing + ' panel' + (existing > 1 ? 's' : '') +
          '</b> from earlier work.<br>What should happen to them?</div>';
      const foot = document.createElement('div');
      foot.style.cssText = 'padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap';
      const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'asm-btn ' + cls; b.textContent = txt; b.onclick = () => { modal.remove(); fn && fn(); }; return b; };
      foot.appendChild(mk('Cancel', 'asm-btn-ghost'));
      foot.appendChild(mk('Add to existing', 'asm-btn-ghost', () => _doExport(false)));
      foot.appendChild(mk('Replace them', 'asm-btn-primary', () => _doExport(true)));
      box.appendChild(foot);
      modal.appendChild(box);
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    function _doExport(replace) {
      if (replace && typeof window.replacePanelsQuiet === 'function') window.replacePanelsQuiet();
      let totalPanels = 0;

      ctx.getReady().forEach(it => {
        it.outputs.forEach(o => {
          if (o.w > 0 && o.h > 0 && o.qty > 0) {
            // addPanel(remark, l, w, qty, material, canRotate, srNo, component)
            // l = width (larger dim), w = height (smaller dim)
            const remark = o.remark || '';
            const material = o.material || o.color || 'DW';
            const component = o.component || '';
            const band = (o.band && (o.band.l||o.band.r||o.band.t||o.band.b)) ? o.band : null;
            window.addPanel(remark, o.w, o.h, o.qty, material, true, null, component, band);
            totalPanels++;
          }
        });
      });

      // Auto-populate stock sheets for new materials
      if (typeof window.autoPopulateStock === 'function') {
        window.autoPopulateStock();
      }

      ctx.trackAsm('export_optimizer');
      ctx.showToast(totalPanels + ' panels exported to optimizer', 'success');
      // Keep ctx.getReady() so user can return to ASM and edit
      showExportSuccessModal(totalPanels, replace);
    }

    function showExportSuccessModal(totalPanels, replaced) {
      let modal = document.getElementById('asm-export-success');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'asm-export-success';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    
      const box = document.createElement('div');
      box.style.cssText = 'background:#1A1D21;border:1px solid #2EB67D;border-radius:12px;width:400px;overflow:hidden;text-align:center';
    
      const body = document.createElement('div');
      body.style.cssText = 'padding:30px';
      body.innerHTML = '<div style="font-size:40px;margin-bottom:12px">✅</div>' +
        '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:6px">' + totalPanels + ' panels exported!</div>' +
        '<div style="font-size:12px;color:#7A7D82">' + (replaced ? 'The old optimizer panels were replaced' : 'Panels have been added to the optimizer panel list') + '</div>';
      box.appendChild(body);
    
      const foot = document.createElement('div');
      foot.style.cssText = 'padding:16px;background:#222529;border-top:1px solid #3A3D42;display:flex;gap:10px;justify-content:center';
    
      const stayBtn = document.createElement('button');
      stayBtn.className = 'asm-btn asm-btn-ghost';
      stayBtn.textContent = 'Stay in ASM';
      stayBtn.onclick = function() { modal.remove(); };
    
      const goBtn = document.createElement('button');
      goBtn.className = 'asm-btn asm-btn-primary';
      goBtn.textContent = 'Go to Optimizer →';
      goBtn.onclick = function() { modal.remove(); ctx.closeASM(); };
    
      foot.appendChild(stayBtn);
      foot.appendChild(goBtn);
      box.appendChild(foot);
    
      modal.appendChild(box);
      modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }


    // Unified "Export Files" — collects RIS panels, opens ExportFiles modal
    function exportFilesRIS() {
      if (!ctx.getReady() || !ctx.getReady().length) { ctx.showToast('No items in Ready — build and save first', 'error'); return; }
      if (!window.ExportFiles) { ctx.showToast('Export module not loaded', 'error'); return; }
      const panels = [];
      ctx.getReady().forEach(it => {
        (it.outputs || []).forEach(o => {
          if (o.w > 0 && o.h > 0 && o.qty > 0) {
            const b = o.band || {};
            panels.push({
              label: o.component || o.remark || 'Panel',
              length: o.w, width: o.h, qty: o.qty,
              material: o.material || o.color || 'DW',
              grain: !!o.grainLocked,
              ebL: b.l || '', ebR: b.r || '', ebT: b.t || '', ebB: b.b || '',
              // extra fields for the factory CSV (one row per piece)
              pos: it.roomName || '', article: it.itemName || '', remark: o.remark || ''
            });
          }
        });
      });
      window.ExportFiles.open({
        title: (ctx.getReady()[0] && ctx.getReady()[0].roomName) || 'ASM_Export',
        orderName: ctx.getOrderName(),
        panels: panels,
        stock: [],
        onPdf: function(){ ctx.exportToPDF(); }
      });
    }

    return { exportReady: exportReady, exportFilesRIS: exportFilesRIS };
  }

  window.ASMExport = { create: create };
})();
