// export-files.js — unified "Export Files" modal for EasyCutList
// Formats: PDF (routed), CSV, Excel (.xlsx via SheetJS), .saw (Cut Rite, unsigned/experimental)
// Location-agnostic: callers pass a normalized data object and a pdf callback.
//
// Data shape expected:
//   {
//     title:    'Project name',
//     panels:   [ { label, length, width, qty, material, grain, ebL, ebR, ebT, ebB } ],  // mm
//     stock:    [ { material, length, width, qty, thickness } ],   // optional, for .saw BRD2
//     onPdf:    function(){}    // called when user picks PDF (reuse existing export)
//   }
//
// SheetJS (XLSX) is loaded lazily from CDN only when Excel is chosen.

window.ExportFiles = (function () {

  function esc(s){ return String(s==null?'':s); }

  // ---------- CSV ----------
  function toCSV(data) {
    const rows = [['Label','Length(mm)','Width(mm)','Qty','Material','Grain','EB Left','EB Right','EB Top','EB Bottom']];
    (data.panels || []).forEach(p => {
      rows.push([
        p.label||'', p.length||'', p.width||'', p.qty||'', p.material||'',
        (p.grain?'Yes':'No'), p.ebL||'', p.ebR||'', p.ebT||'', p.ebB||''
      ]);
    });
    return rows.map(r => r.map(cell => {
      const s = String(cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  // ---------- Excel (.xlsx) via SheetJS ----------
  function loadSheetJS() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error('Could not load Excel library'));
      document.head.appendChild(s);
    });
  }
  async function toExcel(data) {
    const XLSX = await loadSheetJS();
    const aoa = [['Label','Length (mm)','Width (mm)','Qty','Material','Grain','EB Left','EB Right','EB Top','EB Bottom']];
    (data.panels || []).forEach(p => aoa.push([
      p.label||'', Number(p.length)||0, Number(p.width)||0, Number(p.qty)||0, p.material||'',
      (p.grain?'Yes':'No'), p.ebL||'', p.ebR||'', p.ebT||'', p.ebB||''
    ]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Panels');
    XLSX.writeFile(wb, filename(data, 'xlsx'));
  }

  // ---------- .saw (Cut Rite, unsigned — EXPERIMENTAL) ----------
  // Produces BRD2 (stock) + PNL2 (panels) + MAT2 (material params).
  // No PTN (saw auto-optimizes) and no signature/CHK (unsigned — client must test import).
  function toSAW(data, thicknessMap) {
    thicknessMap = thicknessMap || {};
    const CRLF = '\r\n';
    const lines = [];
    lines.push('1,0');
    lines.push('');

    // Collect materials present
    const mats = {};
    (data.panels || []).forEach(p => { const m = p.material || 'MATERIAL'; mats[m] = true; });
    (data.stock || []).forEach(s => { const m = s.material || 'MATERIAL'; mats[m] = true; });
    const matList = Object.keys(mats);

    // BRD2 — stock boards (one per material; default 2438x1219x16 if no stock given)
    lines.push('BRD1,');
    matList.forEach(m => {
      const st = (data.stock || []).find(s => (s.material||'') === m);
      const L = st ? st.length : 2438.0;
      const W = st ? st.width  : 1219.0;
      const qty = st ? (st.qty || 9999) : 9999;
      const th = (thicknessMap[m] != null && thicknessMap[m] !== '') ? thicknessMap[m] : (st ? (st.thickness || 18) : 18);
      // BRD2,<mat>,<L>,<W>,<qty>,,<th>,<mat>,,,1,,0,,
      lines.push(`BRD2,${m},${fnum(L)},${fnum(W)},${qty},,${th},${m},,,1,,0,,`);
    });
    lines.push('');

    // PNL2 — panels
    lines.push('PNL1,');
    (data.panels || []).forEach(p => {
      const m = p.material || 'MATERIAL';
      const L = fnum(p.length), W = fnum(p.width), q = p.qty || 1;
      const grain = p.grain ? 1 : 0;
      // edge-band: client format is "<n>MM" (e.g. 2MM, 1.3MM). Blank if no band.
      const eb = v => {
        if (v === '' || v === null || v === undefined) return '';
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return '';
        // already has MM/text? keep; else append MM
        return /mm/i.test(String(v)) ? String(v) : (n + 'MM');
      };
      // PNL2,<label>,<mat>,<L>,<W>,<qty>,<grain>,,,,,,,,,,,,<ebL>,<ebR>,<ebT>,<ebB>, (trailing empties)
      lines.push(
        `PNL2,${p.label||''},${m},${L},${W},${q},${grain},,,,,,,,,,,,${eb(p.ebL)},${eb(p.ebR)},${eb(p.ebT)},${eb(p.ebB)},,,,,,,,,,,,,,,,,,,,,`
      );
    });
    lines.push('');
    lines.push('');

    // MAT2 — material params (static template per material; kerf 4.4, trims 15, etc.)
    matList.forEach(m => {
      const th = (thicknessMap[m] != null && thicknessMap[m] !== '') ? thicknessMap[m] : 18;
      lines.push(`MAT2,${m},,${th},1,4,4.4,4.4,4.4,0,0,0,15,15,15,15,8,8,8,0,500,500,0.3,0,76,0,0,9999.9,,9999.9,100,1,1,0,0,0,0,0,0,0,0,0,0,0,,,,,,,,,,,,,,,,0,,,,,,,,`);
    });
    lines.push('');

    // NOTE: no PTN/PTNR (saw re-optimizes), no signature/CHK1 (unsigned).
    return '\uFEFF' + lines.join(CRLF) + CRLF;   // BOM + CRLF like real files
  }

  // guess thickness from material name (e.g. "6mm Back"->6, "18MM BOARD"->18); default 18
  function guessThickness(mat){
    const m = String(mat||'').match(/(\d+(?:\.\d+)?)\s*mm/i);
    return m ? parseFloat(m[1]) : 18;
  }

  function fnum(v){ const n = Number(v); return (isNaN(n) ? 0 : n).toFixed(1); }
  function filename(data, ext){
    const base = (data.title || 'easycutlist').replace(/[^\w\-]+/g,'_').slice(0,60) || 'export';
    return base + '.' + ext;
  }
  function download(content, name, mime){
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  // ---------- Thickness modal (before .saw generation) ----------
  function openThicknessModal(data) {
    // unique materials from panels (+ stock)
    const mats = {};
    (data.panels || []).forEach(p => { const m = p.material || 'MATERIAL'; mats[m] = true; });
    (data.stock  || []).forEach(s => { const m = s.material || 'MATERIAL'; mats[m] = true; });
    const matList = Object.keys(mats);

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100002';
    const rows = matList.map((m,i) =>
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #2A2D31">'+
        '<span style="color:#fff;font-size:13px">'+String(m).replace(/</g,"&lt;")+'</span>'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<input type="number" min="1" step="0.1" id="th-'+i+'" value="'+guessThickness(m)+'" '+
            'style="width:70px;text-align:center;background:#111;border:1px solid #3A3D42;color:#fff;border-radius:5px;padding:6px">'+
          '<span style="color:#8A8F98;font-size:12px">mm</span>'+
        '</div>'+
      '</div>'
    ).join('');
    ov.innerHTML =
      '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:22px;max-width:460px;width:92%;max-height:82vh;overflow-y:auto">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<div style="font-size:16px;font-weight:700;color:#fff">Sheet thickness per material</div>'+
          '<button id="th-close" style="background:none;border:none;color:#8A8F98;font-size:20px;cursor:pointer">×</button>'+
        '</div>'+
        '<div style="font-size:12px;color:#8A8F98;margin-bottom:12px">Enter the board thickness for each material used in this cutlist.</div>'+
        rows +
        '<button id="th-gen" class="asm-btn asm-btn-primary" style="margin-top:16px;width:100%;padding:10px;background:#ECB22E;color:#2A1500;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit">Generate .saw</button>'+
      '</div>';
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#th-close').onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector('#th-gen').onclick = () => {
      const map = {};
      matList.forEach((m,i) => {
        const v = parseFloat(document.getElementById('th-'+i).value);
        map[m] = (isNaN(v) || v <= 0) ? 18 : v;
      });
      download(toSAW(data, map), filename(data,'saw'), 'text/plain;charset=utf-8');
      close();
    };
  }

  // ---------- Modal ----------
  function open(data) {
    if (!data || !(data.panels && data.panels.length)) {
      (window.showToast ? showToast('Nothing to export', 'error') : alert('Nothing to export'));
      return;
    }
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100001';
    const opt = (id,label,sub,color) =>
      '<button data-fmt="'+id+'" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:#1A1D21;border:1px solid #3A3D42;border-radius:9px;padding:13px 16px;cursor:pointer;text-align:left;font-family:inherit;transition:all .15s" '+
      'onmouseover="this.style.borderColor=\''+color+'\'" onmouseout="this.style.borderColor=\'#3A3D42\'">'+
        '<span style="color:'+color+';font-weight:700;font-size:14px">'+label+'</span>'+
        '<span style="color:#8A8F98;font-size:11px">'+sub+'</span>'+
      '</button>';
    ov.innerHTML =
      '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:22px;max-width:420px;width:92%">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'+
          '<div style="font-size:16px;font-weight:700;color:#fff">Export Files</div>'+
          '<button id="ef-close" style="background:none;border:none;color:#8A8F98;font-size:20px;cursor:pointer">×</button>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
          opt('pdf','PDF','Printable cut plan','#E01E5A')+
          opt('csv','CSV','Part list (universal)','#2EB67D')+
          opt('xlsx','Excel','.xlsx spreadsheet','#36C5F0')+
          opt('saw','.saw','Beam saw (experimental)','#ECB22E')+
        '</div>'+
        '<div id="ef-status" style="font-size:12px;color:#8A8F98;margin-top:12px;min-height:16px"></div>'+
      '</div>';
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#ef-close').onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    const status = ov.querySelector('#ef-status');

    ov.querySelectorAll('[data-fmt]').forEach(btn => {
      btn.onclick = async () => {
        const fmt = btn.getAttribute('data-fmt');
        try {
          if (fmt === 'pdf') {
            close();
            if (typeof data.onPdf === 'function') data.onPdf();
            else if (window.showToast) showToast('PDF export not available here', 'error');
          } else if (fmt === 'csv') {
            download(toCSV(data), filename(data,'csv'), 'text/csv;charset=utf-8'); close();
          } else if (fmt === 'xlsx') {
            status.textContent = 'Preparing Excel…';
            await toExcel(data); close();
          } else if (fmt === 'saw') {
            close();
            openThicknessModal(data);
          }
        } catch (e) {
          status.textContent = e.message || 'Export failed';
          status.style.color = '#E01E5A';
        }
      };
    });
  }

  return { open: open, toCSV: toCSV, toSAW: toSAW };
})();
