// ══ ASM PDF EXPORT ══
// Extracted from app-asm.js. Exposed as window.ASMPdf.
// All ASM state is passed in via a context object (ctx) so this module holds
// no shared state of its own:
//   _ctx.readyItems, _ctx.catalogue, _ctx.asmPlan, _ctx.currentClientName,
//   _ctx.showToast(msg,type), _ctx.showPricing()
// Globals used directly (same as app-asm): UNITS, profile, hasFeature.
//
// app-asm.js delegates:
//   exportToPDF()  -> ASMPdf.exportToPDF(ctx)
//   _runExport()   -> ASMPdf.runExport(ctx)
// showExportOptions / _doExportPDF are internal to this module.

window.ASMPdf = (function () {
  let _ctx = {};   // set by entry points (exportToPDF / runExport)
  function exportToPDF(ctx) {
    _ctx = ctx || _ctx;
    if (_ctx.readyItems.length === 0) { _ctx.showToast('No items to export', 'error'); return; }
    if (_ctx.asmPlan !== 'pro') {
      const hasLockedItems = _ctx.readyItems.some(it => {
        const ci = _ctx.catalogue.find(x => x.id === it.itemId);
        return ci ? !ci.is_free : true;
      });
      if (hasLockedItems) { _ctx.showToast('PDF export with PRO items requires upgrade', 'error'); _ctx.showPricing(); return; }
    }
    showExportOptions();
  }

  function hf(flag){ try { return (typeof hasFeature==='function') ? hasFeature(flag) : (_ctx.asmPlan==='pro'); } catch(e){ return _ctx.asmPlan==='pro'; } }

  function showExportOptions() {
    const old = document.getElementById('asm-export-modal'); if (old) old.remove();
    const gp = (typeof profile!=='undefined' && profile) ? profile : {};
    const overlay = document.createElement('div');
    overlay.id = 'asm-export-modal';
    overlay.dataset.client = _ctx.currentClientName || '';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const row = (id, label, sub, checked, locked) =>
      `<label class="asm-eo-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2A2D31;${locked?'opacity:.45':''}">
         <div><div style="font-size:13px;color:#E8E8E8">${label}${locked?' <span style="color:#ECB22E;font-size:10px">⭐PRO</span>':''}</div>
         <div style="font-size:11px;color:#7A7D82">${sub}</div></div>
         <input type="checkbox" id="${id}" ${checked?'checked':''} ${locked?'disabled':''} style="width:18px;height:18px;accent-color:#2EB67D">
       </label>`;
    overlay.innerHTML = `
      <div style="background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:440px;max-height:85vh;overflow:auto">
        <div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:15px;font-weight:700;color:#fff">📄 Export PDF Options</div>
          <button onclick="document.getElementById('asm-export-modal').remove()" style="background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer">&#10005;</button>
        </div>
        <div style="padding:16px 20px">
          ${row('eo-logo','Company Logo','Your logo from My Profile', false, !hf('pdfLogoHeader')||!gp.logo)}
          ${row('eo-company','Company Name','Business name from My Profile', false, !hf('pdfCompanyName')||!gp.biz)}
          <div style="padding:12px 0;border-bottom:1px solid #2A2D31">
            <div style="font-size:13px;color:#E8E8E8;margin-bottom:6px">Client Name</div>
            <input type="text" id="eo-client-text" value="${(_ctx.currentClientName||'').replace(/"/g,'&quot;')}" placeholder="Type client name" style="width:100%;padding:8px 10px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">
          </div>
          ${row('eo-outer','Print Outer Details','Input values grid atop each item', true, false)}
          ${row('eo-summary','Panel Summary','Components / panels line per item', true, false)}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 4px">
            <div><div style="font-size:13px;color:#E8E8E8">W×H×Qty×Material font (pt)</div>
            <div style="font-size:11px;color:#7A7D82">Component table text size</div></div>
            <input type="number" id="eo-font" value="14" min="8" max="24" style="width:60px;padding:6px 8px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;text-align:center">
          </div>
        </div>
        <div style="padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px">
          <button onclick="document.getElementById('asm-export-modal').remove()" style="padding:8px 16px;background:#3A3D42;border:none;border-radius:6px;color:#ABABAD;font-size:13px;cursor:pointer">Cancel</button>
          <button onclick="ASMModule._runExport()" style="padding:8px 16px;background:#ECB22E;border:none;border-radius:6px;color:#1A1D21;font-weight:700;font-size:13px;cursor:pointer">Export PDF</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function runExport(ctx) {
    _ctx = ctx || _ctx;
    const gp = (typeof profile!=='undefined' && profile) ? profile : {};
    const modalEl = document.getElementById('asm-export-modal');
    const opt = {
      logo:    document.getElementById('eo-logo')?.checked && gp.logo,
      company: document.getElementById('eo-company')?.checked && gp.biz,
      phone:   document.getElementById('eo-company')?.checked && gp.phone,
      client:  (document.getElementById('eo-client-text')?.value || '').trim(),
      outer:   document.getElementById('eo-outer')?.checked,
      summary: document.getElementById('eo-summary')?.checked,
      font:    parseInt(document.getElementById('eo-font')?.value) || 14,
      biz: gp.biz, logoSrc: gp.logo, phoneNum: gp.phone
    };
    document.getElementById('asm-export-modal')?.remove();
    doExportPDF(opt);
  }

  function doExportPDF(opt) {
    opt = opt || {};
    const fs = opt.font || 14;
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>EasyCutList ASM - Size Sheet</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 15px; }
        .header { text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #333; }
        .header h1 { font-size: 16px; margin-bottom: 3px; }
        .header p { font-size: 10px; color: #666; }
        .item { margin-bottom: 18px; }
        .item-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .item-table:first-of-type { margin-top: 0; }
        /* Title row (was .item-title) */
        .it-title-row td { background: #333; color: #fff; padding: 6px 10px; font-size: 13px; font-weight: bold; }
        /* Input rows (was .item-inputs) */
        .it-input-row td { background: #f5f5f5; padding: 3px 8px; font-size: 9px; color: #555; border: 1px solid #ddd; }
        .it-input-pad { background: #f5f5f5 !important; border: 1px solid #ddd; }
        /* Column-header row */
        .it-colhead th { background: #eee; padding: 4px 6px; text-align: left; font-size: ${fs}px; border: 1px solid #ccc; font-weight: 700; }
        /* Only keep the title row from being stranded alone at the very bottom
           of a page. Everything else (inputs, header, size rows) flows freely
           and fills the page — items continue immediately after one another. */
        .it-title-row { break-after: avoid; }
        .run-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 8px; position: running(hdr); width: 100%; }
        @page { margin: 34mm 12mm 16mm 12mm; @top-center { content: element(hdr); } @bottom-left { content: "Generated by EasyCutList ASM"; font-size: 9px; color: #999; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #999; } }
        table { width: 100%; border-collapse: collapse; }
        tr { break-inside: avoid; }
        th { background: #eee; padding: 4px 6px; text-align: left; font-size: ${fs}px; border: 1px solid #ccc; font-weight: 700; }
        td { padding: 4px 6px; border: 1px solid #ccc; font-size: ${fs}px; }
        td.num { text-align: right; font-weight: 600; }
        .summary { font-size: 10px; color: #666; text-align: right; padding: 4px; }
        .footer { margin-top: 20px; text-align: left; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
        @media print { body { padding: 10px; } tr { page-break-inside: avoid; } }
      </style>
    </head><body>`;

    const escH = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    if (opt.logo || opt.company || opt.client) {
      const center = [];
      if (opt.company && opt.biz) center.push(`<div style="font-weight:900;font-size:16px">${escH(opt.biz)}</div>`);
      if (opt.phone && opt.phoneNum) center.push(`<div style="font-size:11px;color:#666">${escH(opt.phoneNum)}</div>`);
      const logoImg = (opt.logo && opt.logoSrc) ? `<img src="${opt.logoSrc}" style="max-height:40px;max-width:90px;object-fit:contain">` : '';
      const clientHtml = opt.client ? `<div style="font-size:15px;font-weight:700;color:#c0392b;margin-top:2px">${escH(opt.client)}</div>` : '';
      html += `<div class="run-header">
        <div style="flex:1;display:flex;align-items:center;gap:12px">${logoImg}${clientHtml}</div>
        <div style="flex:1;text-align:center">${center.join('')}</div>
        <div style="flex:1;text-align:right;font-size:9px;color:#aaa">${new Date().toLocaleDateString('en-IN')}<div style="font-size:8px;color:#bbb">Generated by EasyCutList ASM</div></div>
      </div>`;
    } else {
      html += `<div class="header">
        <h1>EasyCutList - Auto Size Module (ASM)</h1>
        <p>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      </div>`;
    }

    let grandTotalPanels = 0;
    let globalSrNo = 0;

    _ctx.readyItems.forEach((it, idx) => {
      const inp = it.inputs;
      const _w = inp.width || inp.w || inp.W;
      const _h = inp.ht || inp.h || inp.H || inp.height;
      const _d = inp.depth || inp.d || inp.D;
      const w = _w != null ? UNITS.fromMM(_w) : '?';
      const h = _h != null ? UNITS.fromMM(_h) : '?';
      const d = _d != null ? UNITS.fromMM(_d) : '?';
      const _uLbl = (UNITS.MODES[UNITS.get()] || {}).label || '';
      const dims = w + ' x ' + h + ' x ' + d + ' (' + _uLbl + ')';
      const totalPanels = it.outputs.reduce((a, o) => a + (o.qty || 0), 0);
      grandTotalPanels += totalPanels;

      // Input summary as clean table
      const inputRows = Object.entries(it.inputs)
        .filter(([k, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => {
          let dv = v;
          if (typeof v === 'number' && !UNITS.isCountKey(k)) dv = UNITS.fromMM(v);
          return '<td style="padding:2px 8px;border:1px solid #ddd;font-weight:600;background:#f9f9f9;font-size:9px">' + k + '</td><td style="padding:2px 8px;border:1px solid #ddd;font-size:9px">' + dv + '</td>';
        })
      
      // Show inputs in rows of 4 pairs each
      let inputTable = '<table style="width:100%;border-collapse:collapse;margin:2px 0"><tr>';
      inputRows.forEach((cell, i) => {
        inputTable += cell;
        if ((i + 1) % 4 === 0 && i < inputRows.length - 1) inputTable += '</tr><tr>';
      });
      inputTable += '</tr></table>';

      const roomPrefix = it.roomName ? (String(it.roomName).trim() + ' — ') : '';
      const _uAbbr = { generic:'', mm:' (mm)', cm:' (cm)', m:' (m)', in:' (in)', in_frac:' (in)', ft_in:' (ft-in)', ft_in_frac:' (ft-in)' }[UNITS.get()] || '';

      // ONE continuous table per item: title row + input rows + column-header row
      // + size rows. paged.js flows this row-by-row, filling each page and
      // splitting between rows — no block-then-table gap.
      html += '<table class="item-table"><tbody>';

      // Title row (full width, spans all 8 columns)
      html += '<tr class="it-title-row"><td colspan="8">' + (idx + 1) + '. ' + roomPrefix + it.itemName + '  |  ' + dims + '  |  Qty: ' + (inp.qty || inp.Qty || 1) + '</td></tr>';

      // Input rows (each pair label/value; pack 4 pairs per row → 8 cells)
      if (opt.outer && inputRows.length) {
        for (let i = 0; i < inputRows.length; i += 4) {
          const chunk = inputRows.slice(i, i + 4).join('');
          // pad to 8 cells so colspan lines up
          const cellsInChunk = Math.min(4, inputRows.length - i) * 2;
          const pad = cellsInChunk < 8 ? '<td colspan="' + (8 - cellsInChunk) + '" class="it-input-pad"></td>' : '';
          html += '<tr class="it-input-row">' + chunk + pad + '</tr>';
        }
      }

      // Column header row (does not repeat across pages — acceptable per spec)
      html += '<tr class="it-colhead"><th>Sr</th><th>Component</th><th>W' + _uAbbr + '</th><th>H' + _uAbbr + '</th><th>Qty</th><th>Color</th><th>Remark</th><th>Box No</th></tr>';

      it.outputs.forEach((o) => {
        globalSrNo++;
        let color = String(o.color || '-');
        let remark = String(o.remark || '-');
        if (color.includes('===') || color.includes('?') || color.includes('||')) color = '-';
        if (remark.includes('===') || remark.includes('?') || remark.includes('||')) remark = '-';
        color = color.replace(/^["']|["']$/g, '');
        remark = remark.replace(/^["']|["']$/g, '');

        html += '<tr>';
        html += '<td>' + globalSrNo + '</td>';
        html += '<td>' + (o.component || '-') + '</td>';
        html += '<td class="num">' + UNITS.fromMM(o.w || 0) + '</td>';
        html += '<td class="num">' + UNITS.fromMM(o.h || 0) + '</td>';
        html += '<td class="num">' + (o.qty || 0) + '</td>';
        html += '<td>' + color + '</td>';
        html += '<td>' + remark + '</td>';
        html += '<td></td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      if (opt.summary) html += '<div class="summary">' + it.outputs.length + ' components | ' + totalPanels + ' panels</div>';
    });

    html += '<div class="footer">Total: ' + _ctx.readyItems.length + ' items | ' + grandTotalPanels + ' panels<br>Generated and calculated with EasyCutList ASM</div>';
    html += '<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"><\/script>';
    html += '<script>window.PagedConfig={auto:true,after:()=>{setTimeout(()=>window.print(),200);}};<\/script>';
    html += '</body></html>';

    // Open print window
    const printWin = window.open('', '_blank');
    if (!printWin) { _ctx.showToast('Allow popups to export PDF', 'error'); return; }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
  }

  // ========================================================================
  // ASM PLAN & PRICING
  // ========================================================================


  return { exportToPDF, runExport };
})();
