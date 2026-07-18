// ══ RENDER ══
// Unit display helpers (dimensions stored in mm; convert for display only).
function _ru(){ return (window.UNITS?UNITS.get():'mm'); }
function _ud(mm){ return (window.UNITS?UNITS.fromMMNum(mm):Math.round(mm)); }         // number in display unit
function _uSuffix(){ return {mm:'mm',cm:'cm',m:'m',in:'in',generic:''}[_ru()]||''; }
function _dim(w,h){ return _ud(w)+' × '+_ud(h); }                                       // "1200 × 600"
function renderResults(sheets,unfitted,scale){
  _lastSheets=sheets; _lastUnfitted=unfitted; // save for export
  document.getElementById('empty-state').style.display='none';
  const el=document.getElementById('results');el.style.display='block';
  let totArea=0,usedArea=0,totPieces=0,totCuts=0,totCutLen=0;
  for(const s of sheets){totArea+=s.L*s.W;for(const p of s.placed){usedArea+=p.pw*p.ph;totPieces++}const cs=calcCuts(s);totCuts+=cs.count;totCutLen+=cs.length}
  const wastedA=totArea-usedArea,wPct=totArea>0?wastedA/totArea*100:0,wc=wPct<15?'good':wPct<30?'warn':'danger';
  const cur=getCurrency();
  const cost=calcCost(sheets);

  // Build per-material breakdown
  const matMap={};
  for(const s of sheets){
    const m=s.material;
    if(!matMap[m])matMap[m]={sheets:0,pieces:0,usedArea:0,totalArea:0,size:`${_dim(s.L,s.W)}`,ebMm:0};
    matMap[m].sheets++;
    matMap[m].totalArea+=s.L*s.W;
    for(const p of s.placed){
      matMap[m].usedArea+=p.pw*p.ph;
      matMap[m].pieces++;
      matMap[m].ebMm+=2*(p.pw+p.ph);
    }
  }
  const matEntries=Object.entries(matMap);

  // Color palette for material rows (cycles)
  const MAT_COLORS=['#1264A3','#007A5A','#E8912D','#E01E5A','#611F69','#0F7173','#895129','#1F6B75'];

  // Inner laminate state — persisted per material name
  if(!window._innerLam) window._innerLam={};

  let matRowsHtml=matEntries.map(([mat,d],i)=>{
    const wp=d.totalArea>0?((d.totalArea-d.usedArea)/d.totalArea*100):0;
    const wc=wp<15?'waste-good':wp<30?'waste-warn':'waste-bad';
    const col=MAT_COLORS[i%MAT_COLORS.length];
    const ebMtr=+(d.ebMm/1000).toFixed(1);
    const ebOrder=+(ebMtr*1.10).toFixed(1);
    const mid=`il_${i}`;
    const il1=window._innerLam[mat+'_1']!==false; // 1-side default checked
    const il2=window._innerLam[mat+'_2']===true;  // 2-side default unchecked
    return `<div class="mat-row" id="matrow_${i}">
      <div class="mat-row-color" style="background:${col}"></div>
      <div class="mat-row-name">${esc(mat)}</div>
      <div class="mat-row-size">${d.size} mm</div>
      <div class="mat-row-sheets"><span class="mat-sheets-badge" style="background:${col}18;color:${col};border-color:${col}30">${d.sheets} sheet${d.sheets!==1?'s':''}</span></div>
      <div class="mat-row-pieces">${d.pieces} pieces</div>
      <div class="mat-row-eb no-print" title="Edge banding — exact: ${ebMtr} mtr · order +10%: ${ebOrder} mtr">
        <span style="font-family:var(--mono);font-size:11px;color:var(--sl-green);font-weight:700">${ebOrder} mtr</span>
        <span style="font-size:9px;color:var(--sl-text3);margin-left:2px">EB</span>
      </div>
      <div class="mat-row-waste"><span class="sheet-waste-badge ${wc}">${wp.toFixed(1)}% waste</span></div>
      <div class="mat-row-il no-print" style="display:flex;gap:6px;align-items:center;margin-left:8px">
        <label title="1 side inner laminate" style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--sl-text2);cursor:pointer;white-space:nowrap">
          <input type="radio" name="il_${i}" value="1" ${(window._innerLam?.[mat]??1)!==2&&(window._innerLam?.[mat])!==0?'checked':''} onchange="setInnerLam('${mat}',1,true)" style="width:auto"> 1
        </label>
        <label title="2 sides inner laminate" style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--sl-text2);cursor:pointer;white-space:nowrap">
          <input type="radio" name="il_${i}" value="2" ${(window._innerLam?.[mat])===2?'checked':''} onchange="setInnerLam('${mat}',2,true)" style="width:auto"> 2
        </label>
        <label title="No inner laminate" style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--sl-text2);cursor:pointer;white-space:nowrap">
          <input type="radio" name="il_${i}" value="0" ${(window._innerLam?.[mat])===0?'checked':''} onchange="setInnerLam('${mat}',0,true)" style="width:auto"> 0
        </label>
      </div>
    </div>`;
  }).join('');

  // Total row
  const totSheets = matEntries.reduce((a,[,d])=>a+d.sheets,0);
  const totPcs    = matEntries.reduce((a,[,d])=>a+d.pieces,0);
  const totEB     = +(matEntries.reduce((a,[,d])=>a+d.ebMm,0)/1000*1.10).toFixed(1);
  matRowsHtml += `<div class="mat-row" style="background:var(--sl-bg2);border-top:2px solid var(--sl-border2);font-weight:700">
    <div class="mat-row-color" style="background:transparent"></div>
    <div class="mat-row-name" style="font-weight:900;color:var(--sl-text)">TOTAL</div>
    <div class="mat-row-size"></div>
    <div class="mat-row-sheets"><span class="mat-sheets-badge" style="background:#1D1C1D18;color:var(--sl-text);border-color:#1D1C1D30;font-weight:900">${totSheets} sheets</span></div>
    <div class="mat-row-pieces" style="font-weight:900;color:var(--sl-text)">${totPcs} pieces</div>
    <div class="mat-row-eb no-print"><span style="font-family:var(--mono);font-size:11px;color:var(--sl-green);font-weight:900">${totEB} mtr</span><span style="font-size:9px;color:var(--sl-text3);margin-left:2px">EB</span></div>
    <div class="mat-row-waste"></div>
    <div class="mat-row-il no-print" id="il-total-cell" style="font-family:var(--mono);font-size:11px;font-weight:900;color:var(--sl-text);margin-left:8px;min-width:60px"></div>
  </div>`;

  // Estimate sheets without optimization (naive: 1 piece per sheet worst case, or area-based)
  const naiveSheets = Math.ceil(totPieces * 0.7); // rough estimate — random placement would need ~40% more
  const savedSheets = Math.max(0, naiveSheets - sheets.length);
  const savedCost = cost.hasPrice && savedSheets > 0
    ? Math.round(cost.total / sheets.length * savedSheets)
    : 0;

  let html=`<div class="results-header">
    <div class="results-title">Results</div>
    <button class="btn-print-pdf no-print" onclick="openPrint()">📄 Export PDF</button>
  </div>

  <div class="no-print" style="display:flex;align-items:center;gap:8px;margin-bottom:14px;background:var(--sl-bg2);border:1px solid var(--sl-border);border-radius:var(--radius);padding:10px 14px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sl-text3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    <input type="text" id="result-client-name" placeholder="Customer name (appears on all exports & prints)" oninput="onResultClientInput(this.value)"
      style="flex:1;background:transparent;border:none;outline:none;color:var(--sl-text);font-size:13px;font-family:var(--sans)" autocomplete="off">
    <div id="result-client-suggestions" style="position:relative"></div>
  </div>
  <div id="result-client-dropdown" style="display:none;position:absolute;z-index:150;background:#fff;border:1px solid var(--sl-border2);border-radius:var(--radius);box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:260px;max-height:200px;overflow-y:auto"></div>

  <div class="algo-badge no-print">
    <div class="algo-badge-icon">⚡</div>
    <div class="algo-badge-text">
      <div class="algo-badge-title">NesCut™ AI Engine — 32-Strategy Optimization</div>
      <div class="algo-badge-sub">Multi-pass recursive optimizer · Panel-saw safe · Zero uncuttable layouts</div>
      <div class="algo-badge-stats">
        <span class="algo-stat">✓ ${sheets.length} sheets optimized</span>
        <span class="algo-stat">✓ ${totCuts} guillotine cuts</span>
        <span class="algo-stat">✓ 32 strategies tried</span>
        <span class="algo-stat">✓ 0 uncuttable layouts</span>
      </div>
    </div>
  </div>

  ${savedSheets>0?`<div class="sheets-saved-banner no-print">
    <div class="ssb-icon">✂</div>
    <div class="ssb-text">
      <div class="ssb-title">Saved ${savedSheets} sheets vs unoptimized cutting</div>
      <div class="ssb-sub">${savedCost>0?`Estimated material cost saved: ${cur}${savedCost.toLocaleString('en-IN')}`:'Enter sheet prices to see cost savings'}</div>
    </div>
    <div class="ssb-val" style="font-size:32px;font-weight:900;font-family:var(--mono);color:#4fffb0">+${savedSheets}</div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);margin-left:-8px;margin-top:4px">sheets</div>
  </div>`:''}

  <div style="font-size:15px;font-weight:900;color:var(--sl-text);letter-spacing:0;margin-bottom:8px;padding:10px 14px;border:2px solid var(--sl-border2);border-radius:var(--radius);background:var(--sl-bg2);display:flex;align-items:center;gap:8px" class="no-print">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    Material Procurement
  </div>
  <div class="export-btns no-print">
    <button class="btn-export" style="border-color:#7c3aed!important;color:#7c3aed!important;background:#f5f3ff!important" onclick="requirePro('exportOrder', openExportOrder)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      Material Order ${hasFeature('exportOrder')?'':'⭐'}
    </button>
    <button class="btn-export" style="border-color:#0891b2!important;color:#0891b2!important;background:#ecfeff!important" onclick="requirePro('exportLabels', openLabelExport)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>
      Export Labels ${hasFeature('exportLabels')?'':'⭐'}
    </button>
  </div>

  <div class="stats-bar">
    <div class="stat-card"><div class="stat-label">Total Sheets</div><div class="stat-value">${sheets.length}</div></div>
    <div class="stat-card"><div class="stat-label">Materials</div><div class="stat-value">${matEntries.length}</div></div>
    <div class="stat-card"><div class="stat-label">Pieces</div><div class="stat-value">${totPieces}</div></div>
    <div class="stat-card"><div class="stat-label">Waste</div><div class="stat-value ${wc}">${wPct.toFixed(1)}%</div></div>
    <div class="stat-card"><div class="stat-label">Cuts</div><div class="stat-value">${totCuts}</div></div>
    <div class="stat-card"><div class="stat-label">Cut Length</div><div class="stat-value">${totCutLen.toLocaleString()} mm</div></div>
    ${unfitted.length?`<div class="stat-card"><div class="stat-label">Unfitted</div><div class="stat-value danger">${unfitted.length}</div></div>`:''}
  </div>
  ${cost.hasPrice?`
  ${hasFeature('costEstimation')?`
  <div class="cost-summary no-print">
    <div class="cost-title">💰 Cost Estimation</div>
    <div class="cost-main">${cur}${cost.total.toLocaleString('en-IN')}</div>
    <div class="cost-rows">
      ${cost.rows.filter(r=>r.price>0).map(r=>`
        <div class="cost-row">${esc(r.mat)}: <span>${r.count} sheets × ${cur}${r.price.toLocaleString('en-IN')} = ${cur}${r.cost.toLocaleString('en-IN')}</span></div>
      `).join('')}
      ${cost.rows.some(r=>r.price===0)?`<div class="cost-row" style="opacity:.6">Some materials have no price set</div>`:''}
    </div>
  </div>`:`
  <div class="cost-summary no-print" style="filter:blur(6px);pointer-events:none;user-select:none">
    <div class="cost-title">💰 Cost Estimation</div>
    <div class="cost-main">${cur}XX,XXX</div>
  </div>
  <div class="no-print" style="text-align:center;margin:-10px 0 12px;font-size:12px">⭐ <a href="#" onclick="showUpgrade('Cost Estimation');return false" style="color:#ECB22E;text-decoration:none;font-weight:700">Upgrade to Pro</a> to view cost</div>`}
  `:''}
  <div class="mat-summary no-print">
    <div class="mat-summary-title">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      Sheets by Material
      <span style="margin-left:auto;display:flex;gap:16px;font-size:9px;color:var(--sl-text3);font-weight:600;letter-spacing:.5px;text-transform:uppercase">
        <span style="min-width:80px;text-align:center">Sheets</span>
        <span style="min-width:70px">Pieces</span>
        <span style="min-width:72px">Edge Band</span>
        <span style="min-width:50px">Waste</span>
        <span class="no-print" style="min-width:70px;text-align:center">Inner Lam</span>
      </span>
    </div>
    <div class="mat-rows" ${isPro()?'':`style="filter:blur(5px);pointer-events:none;user-select:none"`}>${matRowsHtml}</div>
  </div>
  ${!isPro()?'<div class="no-print" style="text-align:center;margin:-8px 0 12px;font-size:12px">⭐ <a href="#" onclick="showUpgrade(\'Material Summary\');return false" style="color:#ECB22E;text-decoration:none;font-weight:700">Upgrade to Pro</a> to view details</div>':''}`;
  if(unfitted.length)html+=`<div class="unfitted-box"><div class="unfitted-title">⚠ ${unfitted.length} piece(s) could not be placed</div>${unfitted.map(p=>`<div class="unfitted-item">${esc(p.label)} — ${_dim(p.l,p.w)} ${_uSuffix()} · ${esc(p.material)}</div>`).join('')}</div>`;

  let si=0;
  for(const s of sheets){
    si++;
    const ua=s.placed.reduce((a,p)=>a+p.pw*p.ph,0),shW=s.L*s.W-ua,wp=(shW/(s.L*s.W)*100).toFixed(1);
    const wclass=+wp<15?'waste-good':+wp<30?'waste-warn':'waste-bad';
    const cs=calcCuts(s);

    // Compute cut sequence
    const cutSeq = computeCutSequence(s);
    s._cutSeq = cutSeq; // attach to sheet for buildSVG

    const cutRows=s.placed.map((p,i)=>{
      const matPanelsCR = panelRows.filter(pr => pr.material === s.material);
      const crMatch = matPanelsCR[p.piece.colorIdx] || null;
      const crRemark = crMatch ? (crMatch.remark || crMatch.label || '') : (p.piece.label || '');
      const crGlobalIdx = crMatch ? panelRows.indexOf(crMatch) : -1;
      const crBaseSr = crGlobalIdx >= 0 ? crGlobalIdx + 1 : p.piece.colorIdx + 1;
      const crSrDisplay = p.piece.instance > 1 ? `${crBaseSr}-${p.piece.instance}` : `${crBaseSr}`;
      // Show entered dims (from original row), oriented to placement, not round-tripped geometry.
      let cw=p.pw, ch=p.ph;
      if(crMatch){ const rot=Math.abs(p.pw-crMatch.w)<Math.abs(p.pw-crMatch.l); cw=rot?crMatch.w:crMatch.l; ch=rot?crMatch.l:crMatch.w; }
      return `<tr><td><span class="piece-dot" style="background:${PRINT_STROKES[p.piece.colorIdx%PRINT_STROKES.length]};-webkit-print-color-adjust:exact;print-color-adjust:exact"></span><strong>#${crSrDisplay}</strong></td><td>${_dim(cw,ch)}</td><td>${esc(s.material)}</td><td>${esc(crRemark)}</td></tr>`;
    }).join('');

    // Cut sequence section — numbers on diagram FREE, detailed table PRO only
    const cutSeqHtml = cutSeq.length > 0
      ? hasFeature('cutSequenceTable')
        ? buildCutSeqTable(cutSeq, s)
        : `<div class="cut-seq-wrap no-print">
            <div class="cut-seq-title">
              <span class="cut-seq-badge-inline">✂</span>
              Cutting Sequence
              <span class="premium-lock" onclick="showUpgrade('Cut Sequence Table')">⭐ PRO</span>
            </div>
            <div style="background:var(--sl-bg3);border:1px dashed var(--sl-border2);border-radius:6px;padding:12px 14px;display:flex;align-items:center;gap:12px">
              <div style="font-size:24px">🔒</div>
              <div>
                <div style="font-weight:700;font-size:12px;color:var(--sl-text);margin-bottom:3px">${cutSeq.length} numbered cuts shown on diagram above</div>
                <div style="font-size:11px;color:var(--sl-text2)">Upgrade to Pro to see the full cut sequence table with cut order, direction and position for your workshop operator.</div>
                <button onclick="showUpgrade('Cut Sequence Table')" style="margin-top:8px;background:var(--sl-yellow);color:#1D1C1D;border:none;border-radius:4px;padding:5px 12px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:11px">⭐ Upgrade to Pro</button>
              </div>
            </div>
           </div>`
      : '';

    // Build panel list for this sheet
      const panelListRows = s.placed.map((p,ri) => {
      const matPanels = panelRows.filter(pr => pr.material === s.material);
      const plMatch = matPanels[p.piece.colorIdx] || null;
      const plGlobalIdx = plMatch ? panelRows.indexOf(plMatch) : -1;
      const plBaseSr = plGlobalIdx >= 0 ? plGlobalIdx + 1 : p.piece.colorIdx + 1;
      const srDisplay = p.piece.instance > 1 ? (plBaseSr+'-'+p.piece.instance) : (''+plBaseSr);
      const remark = plMatch ? (plMatch.remark || plMatch.label || '') : (p.piece.label || '');
      const bg = ri%2===0 ? '#fff' : '#f9f4f9';
      const cellStyle = `padding:3px 5px;border-bottom:1px solid #eee;vertical-align:top`;
      let plw=p.pw, plh=p.ph;
      if(plMatch){ const rot=Math.abs(p.pw-plMatch.w)<Math.abs(p.pw-plMatch.l); plw=rot?plMatch.w:plMatch.l; plh=rot?plMatch.l:plMatch.w; }
      return '<tr style="background:'+bg+'">'
        + '<td style="'+cellStyle+';border-right:1px solid #ddd;font-weight:700;color:#3F0E40;font-family:monospace;white-space:nowrap">#'+srDisplay+'</td>'
        + '<td style="'+cellStyle+';border-right:1px solid #ddd;font-family:monospace;white-space:nowrap;font-size:7.5pt">'+_dim(plw,plh)+'</td>'
        + '<td style="'+cellStyle+';word-break:break-word;white-space:normal;font-size:7.5pt;line-height:1.4">'+(remark?esc(remark):'')+'</td>'
        + '</tr>';
    }).join('');

    html+=`<div class="sheet-block">
      <div class="print-custom-header"></div>
      <div class="sheet-header">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <span class="sh-name" style="font-weight:700;font-size:14px">Sheet ${si}</span>
          <span class="sh-size" style="font-family:var(--mono);font-size:11px;color:var(--sl-text2)">${_dim(s.L,s.W)} ${_uSuffix()}</span>
          <span class="sheet-material-banner">${esc(s.material)}</span>
          <span class="sheet-waste-badge ${wclass}">${wp}% waste</span>
        </div>
      </div>
      <div class="sheet-stats">
        <div class="sstat"><div class="sstat-label">Used</div><div class="sstat-val">${(ua/1e6).toFixed(4)} m² (${(100-+wp).toFixed(1)}%)</div></div>
        <div class="sstat"><div class="sstat-label">Waste</div><div class="sstat-val">${(shW/1e6).toFixed(4)} m²</div></div>
        <div class="sstat"><div class="sstat-label">Cuts</div><div class="sstat-val">${cs.count}</div></div>
        <div class="sstat"><div class="sstat-label">Cut Len</div><div class="sstat-val">${cs.length.toLocaleString()} mm</div></div>
        <div class="sstat"><div class="sstat-label">Panels</div><div class="sstat-val">${s.placed.length}</div></div>
      </div>
      <div class="sheet-layout-wrap">
        <div class="sheet-svg-wrap">${buildSVG(s,scale)}</div>
        <div class="sheet-panel-list no-screen" style="flex:1;min-width:0;border:1.5px solid #3F0E40;border-radius:4px;overflow:hidden">
          <div style="background:#3F0E40;color:#fff;font-size:8pt;font-weight:700;padding:4px 8px;letter-spacing:.5px;text-transform:uppercase">Panels — ${esc(s.material)}</div>
          <table style="border-collapse:collapse;width:100%;font-size:8pt;color:#111;table-layout:fixed">
            <colgroup>
              <col style="width:18%">
              <col style="width:34%">
              <col style="width:48%">
            </colgroup>
            <thead><tr style="background:#f0e8f0">
              <th style="padding:3px 5px;text-align:left;font-size:7pt;color:#3F0E40;font-weight:700;border-bottom:1px solid #ccc;border-right:1px solid #ddd;white-space:nowrap">#</th>
              <th style="padding:3px 5px;text-align:left;font-size:7pt;color:#3F0E40;font-weight:700;border-bottom:1px solid #ccc;border-right:1px solid #ddd;white-space:nowrap">W × H mm</th>
              <th style="padding:3px 5px;text-align:left;font-size:7pt;color:#3F0E40;font-weight:700;border-bottom:1px solid #ccc;">Remark</th>
            </tr></thead>
            <tbody>${panelListRows}</tbody>
          </table>
        </div>
      </div>
      ${cutSeqHtml}
      <div class="cuts-wrap">
        <div class="cuts-title">Cut List</div>
        <table class="cuts-table"><thead><tr><th>Sr.No</th><th>Size (mm)</th><th>Material</th><th>Remark</th></tr></thead><tbody>${cutRows}</tbody></table>
      </div>
      <div class="sheet-pg-num" style="display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;font-size:7pt;color:#555;padding-top:4pt;border-top:1.5pt solid #ECB22E;margin-top:4pt"><span style="display:flex;align-items:center;gap:4pt"><img src="data:image/png;base64,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" style="width:14pt;height:14pt;border-radius:3pt"> <strong style="color:#3F0E40">EasyCutList</strong> &nbsp;·&nbsp; easycutlist.com</span><span>Sheet ${si} of ${sheets.length} &nbsp;·&nbsp; ${esc(s.material)} &nbsp;·&nbsp; ${_dim(s.L,s.W)} ${_uSuffix()}</span></div>
    </div>`;
  }
  el.innerHTML=html;
  renderTrialBar();
  setTimeout(updateInnerLamTotal, 50);
}

