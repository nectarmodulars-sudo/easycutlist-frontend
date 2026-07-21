/* asm-quotation.js — Quotation module for EasyCutList ASM.
 * Two modes:
 *   Item-wise  — one row per RIS item, sqft from outer W×H, rate per item.
 *   Panel-wise — one row per output panel, sqft from panel W×H, rate per material.
 * Areas: sqft (default) or sq.m, toggle in the modal. Dimensions in mm are canonical;
 * area is always computed from mm. Exports: PDF (print) + Excel (SheetJS).
 * Depends on globals: readyItems (from app-asm.js), UNITS (optional, for dim display).
 * Load AFTER app-asm.js and units.js.
 */
(function (global) {
  'use strict';

  var MM2_PER_SQFT = 92903.04;   // 1 sqft = 92903.04 mm²
  var MM2_PER_SQM  = 1000000;    // 1 m²  = 1,000,000 mm²

  var _mode = 'item';   // 'item' | 'panel'
  var _areaUnit = 'sqft'; // 'sqft' | 'sqm'
  var _itemRates = {};    // readyId/index -> rate
  var _matRates = {};     // material -> rate
  var _clientName = '';

  function areaDivisor() { return _areaUnit === 'sqft' ? MM2_PER_SQFT : MM2_PER_SQM; }
  function areaLabel() { return _areaUnit === 'sqft' ? 'sq.ft' : 'sq.m'; }
  function round2(n) { return Math.round((+n || 0) * 100) / 100; }
  function money(n) { return '₹' + round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dimShow(mm) { return (global.UNITS ? UNITS.fromMMNum(mm) : Math.round(mm)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var _ready = [];
  function getReady() { return _ready; }

  // ---- data builders ----
  function itemRows() {
    return getReady().map(function (it, i) {
      var inp = it.inputs || {};
      var w = +(inp.width || inp.w || inp.W || 0);
      var h = +(inp.ht || inp.h || inp.H || inp.height || 0);
      var d = +(inp.depth || inp.d || inp.D || 0);
      var qty = +(inp.qty || 1) || 1;
      var areaMM2 = w * h * qty;
      var area = areaMM2 / areaDivisor();
      var key = it.readyId || ('idx' + i);
      var rate = _itemRates[key] != null ? _itemRates[key] : 0;
      return {
        key: key, name: it.itemName || ('Item ' + (i + 1)), room: it.roomName || '',
        w: w, h: h, d: d, qty: qty, area: round2(area), rate: rate, amount: round2(area * rate)
      };
    });
  }

  function panelRows() {
    var rows = [];
    getReady().forEach(function (it, i) {
      (it.outputs || []).forEach(function (o) {
        var w = +o.w || 0, h = +o.h || 0, qty = +o.qty || 0;
        var mat = o.color || o.material || o.component || '—';
        var areaMM2 = w * h * qty;
        var area = areaMM2 / areaDivisor();
        var rate = _matRates[mat] != null ? _matRates[mat] : 0;
        rows.push({
          item: it.itemName || ('Item ' + (i + 1)),
          panel: o.component || '', w: w, h: h, qty: qty, material: mat,
          area: round2(area), rate: rate, amount: round2(area * rate)
        });
      });
    });
    return rows;
  }

  function materials() {
    var set = {};
    getReady().forEach(function (it) {
      (it.outputs || []).forEach(function (o) {
        var mat = o.color || o.material || o.component || '—';
        set[mat] = true;
      });
    });
    return Object.keys(set);
  }

  // ---- rendering ----
  function render() {
    var body = document.getElementById('quote-body');
    if (!body) return;
    if (!getReady().length) { body.innerHTML = '<div style="padding:30px;text-align:center;color:#888">No items in Ready Items. Build and save items first.</div>'; return; }
    body.innerHTML = _mode === 'item' ? renderItemTable() : renderPanelTable();
  }

  function renderItemTable() {
    var rows = itemRows();
    var total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    var au = areaLabel();
    var h = '<table class="q-table"><thead><tr>' +
      '<th>Item</th><th>Room</th><th>W</th><th>H</th><th>D</th><th>Qty</th>' +
      '<th>' + au + '</th><th>Rate/' + au + '</th><th>Amount</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' +
        '<td>' + esc(r.name) + '</td><td>' + esc(r.room) + '</td>' +
        '<td>' + dimShow(r.w) + '</td><td>' + dimShow(r.h) + '</td><td>' + (r.d ? dimShow(r.d) : '—') + '</td>' +
        '<td>' + r.qty + '</td><td>' + r.area + '</td>' +
        '<td><input type="number" min="0" step="1" value="' + (r.rate || '') + '" data-itemrate="' + esc(r.key) + '" oninput="ASMQuote._setItemRate(this)" style="width:80px"></td>' +
        '<td class="q-amt">' + money(r.amount) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><td colspan="8" style="text-align:right;font-weight:700">Grand Total</td><td class="q-amt" style="font-weight:700">' + money(total) + '</td></tr></tfoot></table>';
    return h;
  }

  function renderPanelTable() {
    var mats = materials();
    var h = '<div class="q-matbox"><div style="font-weight:700;color:#ECB22E;margin-bottom:8px">Material rates (per ' + areaLabel() + ')</div><div class="q-matgrid">';
    mats.forEach(function (m) {
      h += '<label class="q-matrow"><span>' + esc(m) + '</span>' +
        '<input type="number" min="0" step="1" value="' + (_matRates[m] || '') + '" data-matrate="' + esc(m) + '" oninput="ASMQuote._setMatRate(this)" style="width:90px"></label>';
    });
    h += '</div></div>';

    var rows = panelRows();
    var total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    var au = areaLabel();
    h += '<table class="q-table"><thead><tr>' +
      '<th>Item</th><th>Panel</th><th>W</th><th>H</th><th>Qty</th><th>Material</th>' +
      '<th>' + au + '</th><th>Rate</th><th>Amount</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' +
        '<td>' + esc(r.item) + '</td><td>' + esc(r.panel) + '</td>' +
        '<td>' + dimShow(r.w) + '</td><td>' + dimShow(r.h) + '</td><td>' + r.qty + '</td>' +
        '<td>' + esc(r.material) + '</td><td>' + r.area + '</td>' +
        '<td>' + (r.rate ? money(r.rate) : '—') + '</td>' +
        '<td class="q-amt">' + money(r.amount) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><td colspan="8" style="text-align:right;font-weight:700">Grand Total</td><td class="q-amt" style="font-weight:700">' + money(total) + '</td></tr></tfoot></table>';
    return h;
  }

  // ---- handlers ----
  function _setItemRate(el) {
    _itemRates[el.getAttribute('data-itemrate')] = +el.value || 0;
    recalcInPlace();
  }
  function _setMatRate(el) {
    _matRates[el.getAttribute('data-matrate')] = +el.value || 0;
    recalcInPlace();
  }

  // Recompute amounts + grand total WITHOUT rebuilding inputs (preserves focus).
  function recalcInPlace() {
    var rows = _mode === 'item' ? itemRows() : panelRows();
    var body = document.getElementById('quote-body');
    if (!body) return;
    var amtCells = body.querySelectorAll('tbody .q-amt');
    var total = 0;
    rows.forEach(function (r, i) {
      total += r.amount;
      if (amtCells[i]) amtCells[i].textContent = money(r.amount);
    });
    // panel-wise: also refresh the Rate column (driven by material table)
    if (_mode === 'panel') {
      var rateCells = body.querySelectorAll('tbody tr td:nth-child(8)');
      rows.forEach(function (r, i) { if (rateCells[i]) rateCells[i].textContent = r.rate ? money(r.rate) : '—'; });
    }
    var foot = body.querySelector('tfoot .q-amt');
    if (foot) foot.textContent = money(total);
  }
  function setMode(m) { _mode = m; syncToggle(); render(); }
  function setAreaUnit(u) { _areaUnit = u; syncToggle(); render(); }
  function setClient(v) { _clientName = v; }

  function syncToggle() {
    var im = document.getElementById('q-mode-item'), pm = document.getElementById('q-mode-panel');
    if (im && pm) {
      im.className = 'q-tab' + (_mode === 'item' ? ' active' : '');
      pm.className = 'q-tab' + (_mode === 'panel' ? ' active' : '');
    }
    var sf = document.getElementById('q-area-sqft'), sm = document.getElementById('q-area-sqm');
    if (sf && sm) {
      sf.className = 'q-tab' + (_areaUnit === 'sqft' ? ' active' : '');
      sm.className = 'q-tab' + (_areaUnit === 'sqm' ? ' active' : '');
    }
  }

  // ---- modal open/close ----
  function open(readyItemsData) {
    _ready = readyItemsData || [];
    if (!getReady().length) { alert('No items in Ready Items. Build and save items first.'); return; }
    var ov = document.getElementById('quote-overlay');
    if (!ov) { ov = buildModal(); document.body.appendChild(ov); }
    ov.classList.add('show');
    syncToggle();
    render();
  }
  function close() { var ov = document.getElementById('quote-overlay'); if (ov) ov.classList.remove('show'); }

  function buildModal() {
    var ov = document.createElement('div');
    ov.id = 'quote-overlay';
    ov.innerHTML =
      '<style>' +
      '#quote-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px}' +
      '#quote-overlay.show{display:flex}' +
      '.q-modal{background:#1E2126;border:1px solid #31353D;border-radius:12px;width:min(1000px,96vw);margin:auto;color:#D7D9DC}' +
      '.q-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #31353D}' +
      '.q-head h2{margin:0;color:#ECB22E;font-size:17px}' +
      '.q-x{background:none;border:none;color:#888;font-size:22px;cursor:pointer}' +
      '.q-controls{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid #31353D}' +
      '.q-tabs{display:flex;gap:4px;background:#14161A;padding:3px;border-radius:8px}' +
      '.q-tab{padding:6px 14px;border:none;background:transparent;color:#aaa;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer}' +
      '.q-tab.active{background:#ECB22E;color:#2A1500}' +
      '.q-client{margin-left:auto;display:flex;align-items:center;gap:8px}' +
      '.q-client input{padding:6px 10px;background:#111;border:1px solid #444;color:#fff;border-radius:6px}' +
      '.q-body{padding:16px 20px;max-height:60vh;overflow:auto}' +
      '.q-table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.q-table th{background:#14161A;color:#ECB22E;padding:8px;text-align:left;position:sticky;top:0;font-weight:700}' +
      '.q-table td{padding:7px 8px;border-bottom:1px solid #2A2D31}' +
      '.q-table input{background:#111;border:1px solid #444;color:#fff;border-radius:4px;padding:4px 6px}' +
      '.q-amt{text-align:right;font-family:monospace}' +
      '.q-matbox{background:#14161A;border:1px solid #31353D;border-radius:8px;padding:12px;margin-bottom:14px}' +
      '.q-matgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}' +
      '.q-matrow{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#1E2126;padding:6px 10px;border-radius:6px;font-size:12px}' +
      '.q-foot{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #31353D}' +
      '.q-btn{padding:9px 18px;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer}' +
      '.q-pdf{background:#4A154B;color:#fff}.q-xls{background:#2EB67D;color:#fff}.q-close{background:#3A3D42;color:#ddd}' +
      '</style>' +
      '<div class="q-modal">' +
      '<div class="q-head"><h2>Make Quotation</h2><button class="q-x" onclick="ASMQuote.close()">×</button></div>' +
      '<div class="q-controls">' +
      '<div class="q-tabs"><button id="q-mode-item" class="q-tab active" onclick="ASMQuote.setMode(\'item\')">Item-wise</button>' +
      '<button id="q-mode-panel" class="q-tab" onclick="ASMQuote.setMode(\'panel\')">Panel-wise</button></div>' +
      '<div class="q-tabs"><button id="q-area-sqft" class="q-tab active" onclick="ASMQuote.setAreaUnit(\'sqft\')">sq.ft</button>' +
      '<button id="q-area-sqm" class="q-tab" onclick="ASMQuote.setAreaUnit(\'sqm\')">sq.m</button></div>' +
      '<div class="q-client"><span style="font-size:12px;color:#888">Client</span><input type="text" placeholder="Client name (optional)" oninput="ASMQuote.setClient(this.value)"></div>' +
      '</div>' +
      '<div id="quote-body" class="q-body"></div>' +
      '<div class="q-foot">' +
      '<button class="q-btn q-close" onclick="ASMQuote.close()">Close</button>' +
      '<button class="q-btn q-xls" onclick="ASMQuote.exportExcel()">Export Excel</button>' +
      '<button class="q-btn q-pdf" onclick="ASMQuote.exportPDF()">Export PDF</button>' +
      '</div></div>';
    return ov;
  }

  // ---- exports ----
  function buildExportData() {
    var au = areaLabel();
    if (_mode === 'item') {
      var rows = itemRows();
      var header = ['Item', 'Room', 'W', 'H', 'D', 'Qty', au, 'Rate/' + au, 'Amount'];
      var data = rows.map(function (r) { return [r.name, r.room, r.w, r.h, r.d, r.qty, r.area, r.rate, r.amount]; });
      var total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
      return { header: header, data: data, total: round2(total), title: 'Item-wise Quotation' };
    } else {
      var prows = panelRows();
      var pheader = ['Item', 'Panel', 'W', 'H', 'Qty', 'Material', au, 'Rate', 'Amount'];
      var pdata = prows.map(function (r) { return [r.item, r.panel, r.w, r.h, r.qty, r.material, r.area, r.rate, r.amount]; });
      var ptotal = prows.reduce(function (a, r) { return a + r.amount; }, 0);
      return { header: pheader, data: pdata, total: round2(ptotal), title: 'Panel-wise Quotation' };
    }
  }

  function exportExcel() {
    if (typeof XLSX === 'undefined') {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = _doExcel; document.head.appendChild(s);
    } else { _doExcel(); }
  }
  function _doExcel() {
    var ed = buildExportData();
    var aoa = [];
    aoa.push([ed.title]);
    if (_clientName) aoa.push(['Client:', _clientName]);
    aoa.push(['Date:', new Date().toLocaleDateString('en-IN')]);
    aoa.push([]);
    aoa.push(ed.header);
    ed.data.forEach(function (r) { aoa.push(r); });
    aoa.push([]);
    aoa.push(['', '', '', '', '', '', '', 'Grand Total', ed.total]);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    XLSX.writeFile(wb, 'quotation_' + _mode + '.xlsx');
  }

  function exportPDF() {
    var ed = buildExportData();
    var au = areaLabel();
    var rowsHtml = ed.data.map(function (r) {
      return '<tr>' + r.map(function (c, i) {
        var isNum = i >= (_mode === 'item' ? 2 : 2);
        var isMoney = i === r.length - 1 || (_mode === 'item' && i === 7) || (_mode === 'panel' && i === 7);
        var val = isMoney && typeof c === 'number' ? '₹' + round2(c).toLocaleString('en-IN') : c;
        return '<td' + (isNum ? ' style="text-align:right"' : '') + '>' + esc(val) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var win = window.open('', '_blank');
    win.document.write(
      '<html><head><title>' + ed.title + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:24px}' +
      'h1{font-size:18px;margin:0 0 4px}.meta{color:#666;font-size:11px;margin-bottom:16px}' +
      'table{width:100%;border-collapse:collapse}th{background:#4A154B;color:#fff;padding:7px;text-align:left;font-size:11px}' +
      'td{padding:6px 7px;border-bottom:1px solid #ddd}tfoot td{font-weight:bold;border-top:2px solid #333}' +
      '.tot{text-align:right}</style></head><body>' +
      '<h1>' + ed.title + '</h1>' +
      '<div class="meta">' + (_clientName ? 'Client: ' + esc(_clientName) + ' &nbsp;·&nbsp; ' : '') +
      'Date: ' + new Date().toLocaleDateString('en-IN') + ' &nbsp;·&nbsp; Area unit: ' + au + '</div>' +
      '<table><thead><tr>' + ed.header.map(function (hh, i) { return '<th' + (i >= 2 ? ' style="text-align:right"' : '') + '>' + esc(hh) + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '<tfoot><tr><td colspan="' + (ed.header.length - 1) + '" class="tot">Grand Total</td><td class="tot">₹' + round2(ed.total).toLocaleString('en-IN') + '</td></tr></tfoot>' +
      '</table></body></html>');
    win.document.close();
    setTimeout(function () { win.print(); }, 300);
  }

  global.ASMQuote = {
    open: open, close: close, setMode: setMode, setAreaUnit: setAreaUnit,
    setClient: setClient, _setItemRate: _setItemRate, _setMatRate: _setMatRate,
    exportPDF: exportPDF, exportExcel: exportExcel
  };
})(typeof window !== 'undefined' ? window : this);
