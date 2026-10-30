/* asm-import.js — bring your own sizes into Ready Items from CSV or Excel.
   Load BEFORE app-asm.js:

       <script src="js/asm-import.js"></script>

   Split out of app-asm.js unchanged. The parsed item is handed back through
   onImport rather than pushed onto readyItems here, so this file never touches
   ASM state.

       ASMImport.open({ catalogueKey, showToast, onImport });
*/

(function () {
  'use strict';

  var ctx = null;   // set on open(), read by the modal's inline handlers

  function open(c) {
    ctx = Object.assign({ catalogueKey: '', showToast: function () {}, onImport: function () {} }, c || {});

    var old = document.getElementById('asm-import-modal');
    if (old) old.remove();

    var m = document.createElement('div');
    m.id = 'asm-import-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    m.innerHTML =
      '<div style="background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:440px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:15px;font-weight:700;color:#fff">Import your own Sizes in RIS</div>' +
          '<button onclick="document.getElementById(\'asm-import-modal\').remove()" style="background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer">&#10005;</button>' +
        '</div>' +
        '<div style="padding:20px">' +
          '<div style="font-size:12px;color:#ABABAD;margin-bottom:12px">Columns: Component | W | H | Qty | Material | Remark. Component optional. Item name = file name.</div>' +
          '<input type="file" id="asm-import-file" accept=".csv,.xlsx,.xls" style="width:100%;padding:10px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">' +
          '<div id="asm-import-status" style="margin-top:10px;font-size:12px"></div>' +
        '</div>' +
        '<div style="padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">' +
          '<button onclick="ASMImport.downloadSample()" style="background:none;border:none;color:#ECB22E;font-size:12px;cursor:pointer;text-decoration:underline">Download sample file</button>' +
          '<button onclick="ASMImport.run()" style="padding:8px 16px;background:#ECB22E;border:none;border-radius:6px;color:#1A1D21;font-weight:700;font-size:13px;cursor:pointer">Import</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
  }

  function downloadSample() {
    var csv = 'Component,W,H,Qty,Material,Remark\nTOP,600,400,1,MDF,-\nSIDE,400,720,2,PLY,edge band\n';
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'asm-sample.csv';
    a.click();
  }

  // SheetJS is only needed for .xlsx, so it is fetched on first use rather
  // than shipped on every page load.
  function loadXLSX() {
    return new Promise(function (res, rej) {
      if (window.XLSX) return res();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function rowsToItem(rows, name, catalogueKey) {
    var hdr = -1;
    for (var i = 0; i < rows.length; i++) {
      var r = (rows[i] || []).map(function (c) { return String(c || '').toLowerCase(); });
      if (r.some(function (c) { return c === 'w'; }) && r.some(function (c) { return c === 'h'; })) { hdr = i; break; }
    }
    if (hdr < 0) throw new Error('No header row (need W and H columns)');

    var cols = rows[hdr].map(function (c) { return String(c || '').toLowerCase().trim(); });
    var ci = function (n) { return cols.indexOf(n); };
    var iw = ci('w'), ih = ci('h'), iq = ci('qty'), ic = ci('component'),
        im = ci('material'), ir = ci('remark');

    var outputs = [];
    for (var j = hdr + 1; j < rows.length; j++) {
      var row = rows[j];
      if (!row || row.every(function (c) { return c === '' || c == null; })) continue;
      var w = parseFloat(row[iw]), h = parseFloat(row[ih]);
      if (isNaN(w) || isNaN(h)) continue;
      outputs.push({
        component: (ic >= 0 ? row[ic] : '') || 'PART',
        w: w, h: h,
        qty: iq >= 0 ? (parseInt(row[iq], 10) || 1) : 1,
        material: im >= 0 ? (row[im] || '') : '',
        remark: ir >= 0 ? (row[ir] || '') : ''
      });
    }
    if (!outputs.length) throw new Error('No valid size rows found');

    return {
      readyId: 'ready_' + Date.now(),
      itemId: 'imported',
      itemName: name,
      catalogueKey: catalogueKey,
      imported: true,
      inputs: {},
      outputs: outputs
    };
  }

  async function run() {
    if (!ctx) return;
    var inp = document.getElementById('asm-import-file');
    var status = document.getElementById('asm-import-status');
    var f = inp.files[0];
    if (!f) { status.innerHTML = '<span style="color:#E01E5A">Choose a file</span>'; return; }

    var name = f.name.replace(/\.(csv|xlsx|xls)$/i, '');
    try {
      var rows;
      if (/\.csv$/i.test(f.name)) {
        var text = await f.text();
        rows = text.split(/\r?\n/).map(function (l) { return l.split(','); });
      } else {
        await loadXLSX();
        var buf = await f.arrayBuffer();
        var wb = XLSX.read(buf, { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      }
      var item = rowsToItem(rows, name, ctx.catalogueKey);
      ctx.onImport(item);
      var modal = document.getElementById('asm-import-modal');
      if (modal) modal.remove();
      ctx.showToast('Imported "' + name + '" (' + item.outputs.length + ' parts)', 'success');
    } catch (e) {
      status.innerHTML = '<span style="color:#E01E5A">' + String(e.message).replace(/</g, '&lt;') + '</span>';
    }
  }

  window.ASMImport = { open: open, downloadSample: downloadSample, run: run };
})();