// ══ RESULT CLIENT NAME (customer name box in results) ══
let _resultClientName = '';

function onResultClientInput(val){
  _resultClientName = val.trim();
  const dropdown = document.getElementById('result-client-dropdown');
  if(!dropdown) return;
  if(!val.trim() || !clients.length){ dropdown.style.display='none'; return; }
  const q = val.toLowerCase();
  const matches = clients.filter(c =>
    c.name.toLowerCase().includes(q) || (c.biz||'').toLowerCase().includes(q)
  ).slice(0, 6);
  if(!matches.length){ dropdown.style.display='none'; return; }
  // Position dropdown under the input
  const inputEl = document.getElementById('result-client-name');
  const rect = inputEl ? inputEl.getBoundingClientRect() : null;
  if(rect){
    dropdown.style.position = 'fixed';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top  = (rect.bottom + 4) + 'px';
    dropdown.style.width = Math.max(260, rect.width) + 'px';
  }
  dropdown.style.display = 'block';
  dropdown.innerHTML = matches.map(c => `
    <div onclick="selectResultClient('${esc(c.name)}')"
      style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--sl-border);display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='var(--sl-bg2)'" onmouseout="this.style.background=''">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--sl-blue);color:#fff;display:grid;place-items:center;font-weight:900;font-size:11px;flex-shrink:0">${c.name.charAt(0).toUpperCase()}</div>
      <div>
        <div style="font-weight:700;color:var(--sl-text)">${esc(c.name)}</div>
        ${c.biz?`<div style="font-size:10px;color:var(--sl-text3)">${esc(c.biz)}</div>`:''}
      </div>
    </div>`).join('');
}

function selectResultClient(name){
  _resultClientName = name;
  const input = document.getElementById('result-client-name');
  if(input) input.value = name;
  const dropdown = document.getElementById('result-client-dropdown');
  if(dropdown) dropdown.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  const dropdown = document.getElementById('result-client-dropdown');
  const input    = document.getElementById('result-client-name');
  if(dropdown && input && !dropdown.contains(e.target) && e.target !== input){
    dropdown.style.display = 'none';
  }
});

// ══ EXPORT ORDER (laminate purchase order) ══
function openExportOrder(){
  if(!_lastSheets.length){ alert('Run optimizer first'); return; }
  document.getElementById('export-order-modal').style.display = 'flex';
  // Pre-fill customer from result-client-name box
  const clientEl = document.getElementById('result-client-name');
  const eoClient = document.getElementById('eo-client');
  if(eoClient && clientEl) eoClient.value = clientEl.value || _resultClientName || '';
  // Pre-fill company from profile
  const eoBiz = document.getElementById('eo-biz');
  if(eoBiz) eoBiz.value = profile.biz || '';
  renderOrderPreview();
}

function calcEdgeBanding(sheets){
  // Returns [{material, metres, orderMetres}] — all 4 edges per panel, +10% for wastage
  const ebMm = {};
  for(const s of sheets){
    const mat = s.material;
    if(!ebMm[mat]) ebMm[mat]=0;
    for(const p of s.placed) ebMm[mat] += 2*(p.pw + p.ph);
  }
  return Object.entries(ebMm).map(([mat,mm])=>({
    material:    mat,
    metres:      +(mm/1000).toFixed(2),
    orderMetres: +(mm/1000*1.10).toFixed(2), // +10% wastage
  }));
}

// ══ LABEL EXPORT ══
function openLabelExport(){
  if(!_lastSheets||!_lastSheets.length){alert('Run the optimizer first.');return;}
  // Populate material filter
  const sel=document.getElementById('lbl-matfilter');
  const mats=[...new Set(_lastSheets.map(s=>s.material))];
  sel.innerHTML='<option value="all">All materials</option>'+mats.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  // Pre-fill customer name from result box or profile
  const custEl=document.getElementById('lbl-customer-name');
  if(custEl) custEl.value = _resultClientName || profile.biz || '';
  // Font size slider live update
  const slider=document.getElementById('lbl-fontsize');
  const valEl=document.getElementById('lbl-fontsize-val');
  slider.oninput=()=>valEl.textContent=slider.value+'px';
  document.getElementById('label-modal').style.display='flex';
}
function closeLabelExport(){document.getElementById('label-modal').style.display='none';}

function doExportLabels(){
  const perPage  = +document.querySelector('input[name="lbl-layout"]:checked').value;
  const fs       = +document.getElementById('lbl-fontsize').value;
  const showSrNo    = document.getElementById('lbl-srno').checked;
  const showSize    = document.getElementById('lbl-size').checked;
  const showRemark  = document.getElementById('lbl-remark').checked;
  const showMat     = document.getElementById('lbl-material').checked;
  const showSheet   = document.getElementById('lbl-sheet').checked;
  const showCust    = document.getElementById('lbl-customer').checked;
  const matFilter   = document.getElementById('lbl-matfilter').value;
  const customer = (document.getElementById('lbl-customer-name')?.value.trim()) || _resultClientName || '';

  // Build a global panel counter for Sr.No
  let globalIdx = 0;
  const stickers=[];

  _lastSheets.forEach(sheet=>{
    if(matFilter!=='all'&&sheet.material!==matFilter)return;
    const matSheets=_lastSheets.filter(s=>s.material===sheet.material);
    const matSheetIdx=matSheets.indexOf(sheet)+1;

    sheet.placed.forEach(p=>{
      globalIdx++;
      // colorIdx is assigned sequentially per unique panel row in the material group
      // Use it directly to find the panel row within this material
      const matPanels = panelRows.filter(pr => pr.material === sheet.material);
      const panelMatch = matPanels[p.piece.colorIdx] || null;
      // Global Sr.No = index in full panelRows array
      const globalPanelIdx = panelMatch ? panelRows.indexOf(panelMatch) : -1;
      const baseSr = globalPanelIdx >= 0 ? globalPanelIdx + 1 : p.piece.colorIdx + 1;
      const srDisplay = p.piece.instance > 1 ? `${baseSr}-${p.piece.instance}` : `${baseSr}`;

      // Show original W×H from panel input
      const dispW = panelMatch ? panelMatch.l : p.pw;
      const dispH = panelMatch ? panelMatch.w : p.ph;
      const remark = panelMatch ? (panelMatch.remark || panelMatch.label || '') : (p.piece.label || '');

      stickers.push({
        srNo:     srDisplay,
        size:     `${dispW} × ${dispH}`,
        remark,
        material: sheet.material,
        sheet:    `Sheet ${matSheetIdx} of ${matSheets.length}`,
        customer,
      });
    });
  });

  if(!stickers.length){alert('No panels to export.');return;}

  // Sort: material alphabetically, then Sr.No numerically
  stickers.sort((a,b)=>{
    if(a.material < b.material) return -1;
    if(a.material > b.material) return 1;
    // Parse Sr.No: "42-2" → base=42, inst=2; "42" → base=42, inst=0
    const parse = s => { const p=s.split('-'); return [+p[0]||0, +p[1]||0]; };
    const [ab,ai] = parse(a.srNo);
    const [bb,bi] = parse(b.srNo);
    return ab!==bb ? ab-bb : ai-bi;
  });
  closeLabelExport();

  const sW = perPage===4 ? '48%' : '48%';
  const sH = perPage===4 ? '46%' : '22%';

  let pages='';
  for(let i=0;i<stickers.length;i+=perPage){
    const batch=stickers.slice(i,i+perPage);
    while(batch.length<perPage) batch.push(null);

    const stickerHtml=batch.map(s=>{
      if(!s) return `<div style="width:${sW};height:${sH};border:1px dashed #ddd;border-radius:8px;margin:1%;box-sizing:border-box;display:inline-block;vertical-align:top"></div>`;

      let html='';
      // Row 1: Sr.No (large, left) + Material (prominent, right)
      html+=`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">`;
      html+= showSrNo&&s.srNo ? `<div style="font-size:${fs*1.8}px;font-weight:900;color:#111;font-family:Arial">#${esc(s.srNo)}</div>` : `<div></div>`;
      html+= showMat ? `<div style="font-size:${fs*1.1}px;font-weight:900;color:#111;font-family:Arial;text-align:right;max-width:55%">${esc(s.material)}</div>` : '';
      html+=`</div>`;

      // Row 2: Size big (W × H)
      if(showSize) html+=`<div style="font-size:${fs*1.5}px;font-weight:700;color:#111;font-family:monospace;margin-bottom:6px">${esc(s.size)} <span style="font-size:${fs*0.9}px;font-weight:400;color:#555">mm</span></div>`;

      // Row 3: Remark — use piece label directly (it IS the remark)
      if(showRemark&&s.remark) html+=`<div style="font-size:${fs*1.1}px;font-weight:700;color:#111;margin-bottom:4px;padding:3px 0">${esc(s.remark)}</div>`;

      // Bottom row: Sheet + Customer — black bold
      html+=`<div style="margin-top:auto;padding-top:5px;border-top:1px solid #bbb;display:flex;justify-content:space-between;align-items:flex-end">`;
      html+= showSheet ? `<div style="font-size:${fs*0.9}px;color:#111;font-weight:700">${esc(s.sheet)}</div>` : `<div></div>`;
      html+= showCust&&customer ? `<div style="font-size:${fs*0.9}px;color:#111;font-weight:700;text-align:right">${esc(customer)}</div>` : '';
      html+=`</div>`;

      return `<div style="width:${sW};height:${sH};border:2px solid #222;border-radius:8px;margin:1%;box-sizing:border-box;padding:12px;display:inline-flex;flex-direction:column;vertical-align:top;page-break-inside:avoid">${html}</div>`;
    }).join('');

    pages+=`<div style="width:210mm;height:297mm;page-break-after:always;display:flex;flex-wrap:wrap;align-content:flex-start;padding:8mm;box-sizing:border-box">${stickerHtml}</div>`;
  }

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Panel Labels — EasyCutList</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff}
    @media print{@page{size:A4 portrait;margin:0}body{margin:0}}
    .no-print{display:flex;gap:10px;padding:12px 16px;background:#f5f5f5;border-bottom:1px solid #ddd;align-items:center}
    @media print{.no-print{display:none!important}}
    .ecl-footer{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:8px;color:#aaa;padding:4px;border-top:1px solid #eee;font-family:Arial;background:#fff}
    @media screen{.ecl-footer{display:none}}
  </style></head><body>
  <div class="no-print">
    <strong style="font-size:14px">Panel Labels — ${stickers.length} stickers</strong>
    <button onclick="window.print()" style="background:#007A5A;color:#fff;border:none;border-radius:4px;padding:7px 18px;font-weight:700;cursor:pointer;font-size:13px">🖨 Print</button>
    <span style="font-size:11px;color:#666">Print dialog: margins=None, uncheck Headers &amp; Footers</span>
  </div>
  <div class="ecl-footer" style="display:flex;align-items:center;justify-content:center;gap:8px"><img src="data:image/png;base64,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" style="width:18px;height:18px;border-radius:3px"> <strong style="color:#3F0E40">EasyCutList</strong> &nbsp;·&nbsp; easycutlist.com &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-IN')}</div>
  ${pages}</body></html>`);
  win.document.close();
}

// ══ INNER LAMINATE ══
if(!window._innerLam) window._innerLam={};

function setInnerLam(mat, side, checked){
  // side: 0=none, 1=one side, 2=two sides (radio — mutually exclusive)
  window._innerLam[mat] = +side;
  updateInnerLamTotal();
}

function updateInnerLamTotal(){
  if(!_lastSheets||!_lastSheets.length) return;
  const matMap={};
  for(const s of _lastSheets){
    if(!matMap[s.material]) matMap[s.material]=0;
    matMap[s.material]++;
  }
  let total=0;
  for(const [mat,sheets] of Object.entries(matMap)){
    const sides = window._innerLam?.[mat] ?? 1; // default 1 side
    total += sheets * sides;
  }
  const el=document.getElementById('il-total-cell');
  if(el) el.textContent = total > 0 ? total+' sheets' : '—';
}

function closeExportOrder(){
  document.getElementById('export-order-modal').style.display = 'none';
}

function renderOrderPreview(){
  const el = document.getElementById('eo-preview');
  if(!el) return;
  const matMap = {};
  for(const s of _lastSheets){
    if(!matMap[s.material]) matMap[s.material] = { sheets:0, size:`${s.L}×${s.W}` };
    matMap[s.material].sheets++;
  }
  const MAT_COLORS=['#1264A3','#007A5A','#E8912D','#E01E5A','#611F69','#0F7173','#895129','#1F6B75'];
  const ebData = calcEdgeBanding(_lastSheets);
  el.innerHTML = Object.entries(matMap).map(([mat,d],i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--sl-border)">
      <div style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:${MAT_COLORS[i%MAT_COLORS.length]}"></div>
      <div style="flex:1;font-weight:700;color:var(--sl-text)">${esc(mat)}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--sl-text2)">${d.size} mm</div>
      <div style="font-family:var(--mono);font-weight:900;font-size:14px;color:var(--sl-blue)">${d.sheets} sheet${d.sheets!==1?'s':''}</div>
    </div>`).join('')
  + (() => {
    const ilData = calcInnerLaminate(_lastSheets);
    const ilTotal = ilData.reduce((a,r)=>a+r.innerLamSheets,0);
    if(!ilTotal) return '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--sl-border);background:#fdf3e7;border-radius:4px;margin-top:2px">
      <div style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:#7c4a00"></div>
      <div style="flex:1;font-weight:700;color:#7c4a00">Inner Laminate</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--sl-text2)">—</div>
      <div style="font-family:var(--mono);font-weight:900;font-size:14px;color:#7c4a00">${ilTotal} sheets</div>
    </div>`;
  })()
  + (ebData.length ? `
    <div style="margin-top:12px;padding-top:10px;border-top:2px solid var(--sl-border)">
      <div style="font-size:10px;font-weight:700;color:var(--sl-text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Edge Banding Required</div>
      ${ebData.map(e=>`
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--sl-border)">
          <div style="flex:1;font-size:12px;color:var(--sl-text)">${esc(e.material)}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--sl-text2)">${e.metres} mtr exact</div>
          <div style="font-family:var(--mono);font-weight:900;font-size:13px;color:var(--sl-green)">${e.orderMetres} mtr</div>
        </div>`).join('')}
      <div style="font-size:10px;color:var(--sl-text3);margin-top:6px">Order quantity includes +10% for joins &amp; waste</div>
    </div>` : '');
}

function calcInnerLaminate(sheets){
  const matMap={};
  for(const s of sheets){
    if(!matMap[s.material]) matMap[s.material]={sheets:0,size:`${s.L}×${s.W}`};
    matMap[s.material].sheets++;
  }
  return Object.entries(matMap).map(([mat,d])=>{
    const sides = window._innerLam?.[mat] ?? 1; // default 1 side
    const innerLamSheets = d.sheets * sides;
    return{material:mat,sheets:d.sheets,size:d.size,sides,innerLamSheets};
  }).filter(r=>r.innerLamSheets>0);
}

function doExportOrderPDF(){
  const clientName = document.getElementById('eo-client')?.value.trim() || _resultClientName || '';
  const bizName    = document.getElementById('eo-biz')?.value.trim() || profile.biz || '';
  const matMap = {};
  for(const s of _lastSheets){
    if(!matMap[s.material]) matMap[s.material] = { sheets:0, size:`${s.L}×${s.W}` };
    matMap[s.material].sheets++;
  }
  const date = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  const MAT_COLORS=['#1264A3','#007A5A','#E8912D','#E01E5A','#611F69','#0F7173','#895129','#1F6B75'];

  const rows = Object.entries(matMap).map(([mat,d],i)=>`
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:2px;background:${MAT_COLORS[i%MAT_COLORS.length]};-webkit-print-color-adjust:exact;print-color-adjust:exact;flex-shrink:0"></div>
          <strong>${esc(mat)}</strong>
        </div>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-family:monospace;color:#555">${d.size} mm</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:900;font-size:18px;color:#1264A3;font-family:monospace">${d.sheets}</td>
    </tr>`).join('');

  const ebData = calcEdgeBanding(_lastSheets);
  const ilData = calcInnerLaminate(_lastSheets);
  const ilTotal = ilData.reduce((a,r)=>a+r.innerLamSheets,0);
  const ebRows = ebData.map(e=>`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #eee">${esc(e.material)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #eee;font-family:monospace;color:#555">${e.metres} mtr</td>
      <td style="padding:8px 14px;border-bottom:1px solid #eee;font-weight:900;font-size:16px;color:#007A5A;font-family:monospace">${e.orderMetres} mtr</td>
    </tr>`).join('');

  const win = window.open('','_blank','width=800,height:600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Laminate Order</title>
    <style>
      @media print{@page{margin:12mm 10mm}body{margin:0}}
      body{font-family:Arial,sans-serif;font-size:13px;color:#1D1C1D;max-width:700px;margin:24px auto;padding:0 16px}
      h1{font-size:22px;font-weight:900;margin:0 0 2px;color:#1D1C1D}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#3F0E40;color:#fff;text-align:left;padding:10px 14px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:flex;gap:8px;margin-top:20px}
      @media print{.no-print{display:none}} .no-screen{display:none} @media print{.no-screen{display:block!important}}
      button{padding:8px 18px;border:none;border-radius:5px;cursor:pointer;font-weight:700;font-size:13px}
      .ecl-brand{display:flex;align-items:center;gap:8px;margin-bottom:4px}
      .ecl-brand-logo{background:#ECB22E;border-radius:5px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
      .ecl-brand-name{font-size:13px;font-weight:900;color:#3F0E40}
      .ecl-footer{margin-top:32px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center}
      @media print{.ecl-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center}}
    </style>
  </head><body>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #3F0E40">
      <div>
        <div class="ecl-brand">
          <div class="ecl-brand-logo">✂</div>
          <span class="ecl-brand-name">EasyCutList</span>
          <span style="font-size:11px;color:#aaa">easycutlist.com</span>
        </div>
        ${bizName?`<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${esc(bizName)}</div>`:''}
        <h1>Laminate Purchase Order</h1>
        ${clientName?`<div style="font-size:13px;color:#555;margin-top:4px">Customer: <strong>${esc(clientName)}</strong></div>`:''}
      </div>
      <div style="text-align:right;font-size:11px;color:#888">
        <div>${date}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Material</th><th>Sheet Size</th><th>Qty (Sheets)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f8f8f8">
          <td colspan="2" style="padding:10px 14px;font-weight:900;text-align:right">TOTAL SHEETS:</td>
          <td style="padding:10px 14px;font-weight:900;font-size:20px;color:#1264A3;font-family:monospace">${_lastSheets.length}</td>
        </tr>
        ${ilTotal>0?`<tr style="background:#fdf3e7">
          <td colspan="2" style="padding:10px 14px;font-weight:700;color:#7c4a00">Inner Laminate</td>
          <td style="padding:10px 14px;font-weight:900;font-size:18px;color:#7c4a00;font-family:monospace">${ilTotal}</td>
        </tr>`:''}
      </tfoot>
    </table>
    ${ebRows?`
    <h2 style="font-size:16px;font-weight:900;margin:24px 0 6px">Edge Banding Required</h2>
    <table width="100%" style="border-collapse:collapse;margin-top:4px">
      <thead><tr>
        <th style="background:#1a7a4a;color:#fff;text-align:left;padding:8px 14px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact">Material</th>
        <th style="background:#1a7a4a;color:#fff;text-align:left;padding:8px 14px;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact">Exact (mtr)</th>
        <th style="background:#1a7a4a;color:#fff;text-align:left;padding:8px 14px;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact">Order Qty (+10%)</th>
      </tr></thead>
      <tbody>${ebRows}</tbody>
    </table>
    <p style="font-size:10px;color:#888;margin-top:6px">+10% added for joins and waste</p>`:''}
    <div class="ecl-footer" style="display:flex;align-items:center;justify-content:center;gap:8px"><img src="data:image/png;base64,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" style="width:18px;height:18px;border-radius:3px"> <strong style="color:#3F0E40">EasyCutList</strong> &nbsp;·&nbsp; easycutlist.com &nbsp;·&nbsp; Cut smarter. Waste less.</div>
    <div class="no-print">
      <button onclick="window.print()" style="background:#3F0E40;color:#fff">🖨 Print / Save PDF</button>
      <button onclick="window.close()" style="background:#f1f1f1;color:#333">Close</button>
    </div>
  </body></html>`);
  win.document.close();
  closeExportOrder();
}

function doExportOrderExcel(){
  const clientName = document.getElementById('eo-client')?.value.trim() || _resultClientName || '';
  const bizName    = document.getElementById('eo-biz')?.value.trim() || profile.biz || '';
  const date = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  const matMap = {};
  for(const s of _lastSheets){
    if(!matMap[s.material]) matMap[s.material] = { sheets:0, size:`${s.L}×${s.W}` };
    matMap[s.material].sheets++;
  }
  const ebData = calcEdgeBanding(_lastSheets);
  const ilData = calcInnerLaminate(_lastSheets);
  const ilTotal2 = ilData.reduce((a,r)=>a+r.innerLamSheets,0);
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office">
  <head><meta charset="UTF-8">
  <style>
    th{background:#3F0E40;color:white;padding:8px 12px;font-size:12px}
    td{padding:7px 12px;border:1px solid #ddd}
    .total{font-weight:900;background:#f0f5ff}
    .eb-th{background:#1a7a4a;color:white;padding:8px 12px;font-size:12px}
    .eb-order{font-weight:900;color:#007A5A}
  </style></head><body>
  <p style="font-family:Arial;font-size:16px;font-weight:900;color:#3F0E40;margin-bottom:2px">✂ EasyCutList — Laminate Purchase Order</p>
  <p style="font-family:Arial;font-size:10px;color:#aaa">easycutlist.com &nbsp;·&nbsp; Generated: ${date}</p>
  ${bizName?`<p style="font-family:Arial;color:#555">Company: <strong>${esc(bizName)}</strong></p>`:''}
  ${clientName?`<p style="font-family:Arial;color:#555">Customer: <strong>${esc(clientName)}</strong></p>`:''}
  <p style="font-family:Arial;color:#888;font-size:11px"></p>
  <table border="1" style="font-family:Arial;border-collapse:collapse">
    <tr><th>Material</th><th>Sheet Size</th><th>Qty (Sheets)</th></tr>
    ${Object.entries(matMap).map(([mat,d])=>`<tr><td>${esc(mat)}</td><td>${d.size} mm</td><td style="font-weight:900;font-size:16px;color:#1264A3">${d.sheets}</td></tr>`).join('')}
    <tr class="total"><td colspan="2" style="text-align:right;font-weight:900">TOTAL SHEETS:</td><td style="font-weight:900;font-size:18px;color:#1264A3">${_lastSheets.length}</td></tr>
    ${ilTotal2>0?`<tr style="background:#fdf3e7"><td colspan="2" style="font-weight:700;color:#7c4a00">Inner Laminate</td><td style="font-weight:900;color:#7c4a00">${ilTotal2}</td></tr>`:''}
  </table>
  ${ebData.length?`
  <br><h3 style="font-family:Arial">Edge Banding Required</h3>
  <table border="1" style="font-family:Arial;border-collapse:collapse">
    <tr><th class="eb-th">Material</th><th class="eb-th">Exact (mtr)</th><th class="eb-th">Order Qty +10% (mtr)</th></tr>
    ${ebData.map(e=>`<tr><td>${esc(e.material)}</td><td>${e.metres}</td><td class="eb-order">${e.orderMetres}</td></tr>`).join('')}
  </table>
  <p style="font-family:Arial;font-size:10px;color:#888">+10% added for joins and waste</p>`:''}
  <p style="font-family:Arial;font-size:10px;color:#aaa;margin-top:16px;border-top:1px solid #eee;padding-top:8px">✂ EasyCutList &nbsp;·&nbsp; easycutlist.com &nbsp;·&nbsp; Cut smarter. Waste less.</p>
  </body></html>`;
  const blob = new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `laminate-order${clientName?'-'+clientName.replace(/\s+/g,'-'):''}${bizName?'-'+bizName.replace(/\s+/g,'-'):''}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  closeExportOrder();
}

// ══ INIT — Apply profile defaults ══
(function initApp(){
  if(profile.kerf) document.getElementById('kerf').value=profile.kerf;

  // ── Resizable sidebar ──
  const handle=document.getElementById('resize-handle');
  let dragging=false,startX=0,startW=0;
  const MIN_W=200,MAX_W=520;
  handle.addEventListener('mousedown',e=>{
    dragging=true;startX=e.clientX;
    startW=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')||'280');
    handle.classList.add('dragging');
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const newW=Math.min(MAX_W,Math.max(MIN_W,startW+e.clientX-startX));
    document.documentElement.style.setProperty('--sidebar-w',newW+'px');
    localStorage.setItem('ecl_sidebar_w',newW);
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging)return;
    dragging=false;handle.classList.remove('dragging');
    document.body.style.cursor='';document.body.style.userSelect='';
  });
  const savedW=localStorage.getItem('ecl_sidebar_w');
  if(savedW) document.documentElement.style.setProperty('--sidebar-w',savedW+'px');

  // ── Keep API warm + fetch plan/flags ──
  function pingAPI(){ fetch(API_URL+'/',{method:'GET',cache:'no-cache'}).catch(()=>{}); }
  pingAPI();
  refreshAuthUI().then(() => { reloadProjects(); fetchPlanAndFlags(); updateUpgradeBtn(); });
  setInterval(pingAPI,10*60*1000);

  // ── Edge banding module ──
  if (typeof EBand !== 'undefined') {
    EBand.init({
      getPanels: () => panelRows,
      onSaved:   () => { /* re-run optimize to reflect deduction + bands */ if (_lastSheets && _lastSheets.length) { try { calculate(); } catch(e){} } },
    });
  }
})();
