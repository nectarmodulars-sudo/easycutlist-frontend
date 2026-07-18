// ══ PRINT MODAL ══
function openPrint(){
  // Map each PDF branding checkbox to its own admin flag
  const pdfFlagMap = {
    'po-logo':         'pdfLogoHeader',
    'po-companyname':  'pdfCompanyName',
    'po-clientname':   'pdfClientName',
    'po-header':       'pdfCustomText',
  };
  Object.entries(pdfFlagMap).forEach(([id, flag])=>{
    const el=document.getElementById(id);
    if(!el) return;
    const row=el.closest('.print-opt-row');
    if(!hasFeature(flag)){
      el.disabled=true; el.checked=false;
      if(row){ row.style.opacity='.5'; row.title='Upgrade to Pro'; }
    } else {
      el.disabled=false;
      if(row){ row.style.opacity=''; row.title=''; }
    }
  });
  // Hide the section-level "PRO" badge if ALL 4 PDF features are free (or user is pro)
  const allPdfFree = Object.values(pdfFlagMap).every(k => hasFeature(k));
  const lockEl=document.getElementById('pdf-branding-lock');
  if(lockEl) lockEl.style.display = allPdfFree ? 'none' : 'inline';
  document.getElementById('print-modal').style.display='flex';
  // Gate pro-only print controls
  ['po-srno-font','po-badge-size','po-cutseq'].forEach(id=>{
    const el=document.getElementById(id);
    const row=el?.closest('.print-opt-row');
    if(row){
      if(!hasFeature('cutSequenceTable')){
        row.style.opacity='0.4';row.style.pointerEvents='none';
        if(!row.querySelector('.pro-tag'))row.insertAdjacentHTML('beforeend','<span class="pro-tag" style="color:#ECB22E;font-size:10px;font-weight:700;margin-left:8px">⭐ PRO</span>');
      } else {
        row.style.opacity='';row.style.pointerEvents='';
        row.querySelectorAll('.pro-tag').forEach(t=>t.remove());
      }
    }
  });
  document.getElementById('po-header').onchange=function(){
    document.getElementById('po-header-opts').style.display=this.checked?'block':'none';
  };
  document.getElementById('po-clientname').onchange=function(){
    document.getElementById('po-clientname-opts').style.display=this.checked?'block':'none';
  };
}
function closePrint(){document.getElementById('print-modal').style.display='none'}

function doPrint(){
  const showStats   = document.getElementById('po-stats').checked;
  const showLogo    = hasFeature('pdfLogoHeader')  && document.getElementById('po-logo').checked;
  const showCompany = hasFeature('pdfCompanyName') && document.getElementById('po-companyname').checked;
  const showClient  = hasFeature('pdfClientName')  && document.getElementById('po-clientname').checked;
  // Pre-fill client text from the result customer name box if empty
  const clientTextEl = document.getElementById('po-client-text');
  if(clientTextEl && !clientTextEl.value && _resultClientName) clientTextEl.value = _resultClientName;
  const clientText  = clientTextEl?.value.trim()||'';
  const showHdr     = hasFeature('pdfCustomText')  && document.getElementById('po-header').checked;
  const hdrText     = document.getElementById('po-header-text').value.trim();
  const matFont     = +document.getElementById('po-mat-font').value||18;
  const srNoFont    = +document.getElementById('po-srno-font').value||13;
  const remarkFont  = +document.getElementById('po-remark-font').value||11;
  const diagFont    = +document.getElementById('po-diag-font').value||11;
  const badgeSize   = +document.getElementById('po-badge-size').value||7;
  const colorText   = document.getElementById('po-colortext')?.checked === true; // off = black
  const showCutSeq  = document.getElementById('po-cutseq').checked;
  const showDims    = document.getElementById('po-dims')?.checked !== false;
  const showPanelList = document.getElementById('po-panellist')?.checked !== false;
  const showPanelSummary = document.getElementById('po-panelsummary')?.checked !== false;

  ['dyn-print'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove()});
  const sty=document.createElement('style');sty.id='dyn-print';
  let css=`
    .sheet-stats{display:${showStats?'flex':'none'}!important}
    .cuts-wrap{display:none!important}
    .cut-seq-wrap{display:${showCutSeq?'block':'none'}!important}
    .sheet-panel-list{display:${showPanelSummary?'block':'none'}!important}
    .sheet-material-banner{font-size:${matFont}pt!important;padding:3pt 10pt!important}
    .sh-name{font-size:${Math.round(matFont*0.7)}pt!important}
    .sh-size{font-size:${Math.round(matFont*0.5)}pt!important}
    .sheet-waste-badge{font-size:${Math.round(matFont*0.5)}pt!important}
  `;
  // Dimensions visibility (font sizes are baked into the regenerated SVG below)
  if(!showDims){
    css+=`.sv-sz{display:none!important}`;
    for(let i=0;i<COLORS.length;i++) css+=`.pc${i}s{display:none!important}`;
  }
  // Regenerate every sheet's SVG with the chosen font sizes.
  // Because buildSVG recomputes line spacing from these sizes, Sr.No and Remark
  // can never overlap regardless of the values chosen.
  const printFonts = { srNo: srNoFont, remark: remarkFont, dim: diagFont, blackText: !colorText };
  document.querySelectorAll('.sheet-block').forEach((block, idx) => {
    const wrap = block.querySelector('.sheet-svg-wrap');
    if (wrap && _lastSheets[idx]) {
      wrap.innerHTML = buildSVG(_lastSheets[idx], 999, printFonts); // 999 → buildSVG caps scale internally
    }
  });
  // Toggle no-summary class on layout wraps
  document.querySelectorAll('.sheet-layout-wrap').forEach(el=>{
    el.classList.toggle('no-summary', !showPanelSummary);
  });

  // Build PDF header HTML for each sheet
  document.querySelectorAll('.print-custom-header').forEach(el=>{
    const hasHeader = showLogo||showCompany||showClient||showHdr;
    if(!hasHeader){ el.style.cssText=''; el.innerHTML=''; return; }
    const logoHtml = (showLogo&&profile.logo)
      ? `<img src="${profile.logo}" style="max-height:30pt;max-width:80pt;object-fit:contain">` : '';
    const centerParts=[];
    if(showCompany&&profile.biz)  centerParts.push(`<div style="font-weight:900;font-size:11pt">${esc(profile.biz)}</div>`);
    if(showClient&&clientText)    centerParts.push(`<div style="font-size:9pt;color:#555">Client: ${esc(clientText)}</div>`);
    if(showHdr&&hdrText)          centerParts.push(`<div style="font-size:9pt">${esc(hdrText)}</div>`);
    if(showCompany&&profile.phone) centerParts.push(`<div style="font-size:8pt;color:#888">${esc(profile.phone)}</div>`);
    el.style.cssText=`padding:3pt 0;border-bottom:1pt solid #ccc;font-family:Arial;color:#000;margin-bottom:4pt;display:flex;align-items:center;justify-content:space-between`;
    el.innerHTML=`<div>${logoHtml}</div><div style="flex:1;text-align:center">${centerParts.join('')}</div><div style="font-size:7pt;color:#aaa">${new Date().toLocaleDateString('en-IN')}</div>`;
  });

  window._printBadgeSize = badgeSize;
  sty.textContent = css;
  document.head.appendChild(sty);

  // Build headers on current DOM
  document.querySelectorAll('.print-custom-header').forEach(el=>{
    const hasHeader = showLogo||showCompany||showClient||showHdr;
    if(!hasHeader){ el.style.cssText=''; el.innerHTML=''; return; }
    const logoHtml = (showLogo&&profile.logo)
      ? `<img src="${profile.logo}" style="max-height:30pt;max-width:80pt;object-fit:contain">` : '';
    const centerParts=[];
    if(showCompany&&profile.biz)  centerParts.push(`<div style="font-weight:900;font-size:11pt">${esc(profile.biz)}</div>`);
    if(showClient&&clientText)    centerParts.push(`<div style="font-size:9pt;color:#555">Client: ${esc(clientText)}</div>`);
    if(showHdr&&hdrText)          centerParts.push(`<div style="font-size:9pt">${esc(hdrText)}</div>`);
    if(showCompany&&profile.phone) centerParts.push(`<div style="font-size:8pt;color:#888">${esc(profile.phone)}</div>`);
    el.style.cssText='padding:3pt 0;border-bottom:1pt solid #ccc;font-family:Arial;color:#000;margin-bottom:4pt;display:flex;align-items:center;justify-content:space-between';
    el.innerHTML=`<div>${logoHtml}</div><div style="flex:1;text-align:center">${centerParts.join('')}</div><div style="font-size:7pt;color:#aaa">${new Date().toLocaleDateString('en-IN')}</div>`;
  });

  closePrint();

  // A4 at 96dpi: 210mm = ~794px, 297mm = ~1123px
  // Printable area with 10mm margins: 190mm wide × 277mm tall
  // Header ~20mm, stats ~8mm, footer ~6mm → available for content ~243mm
  // With summary: SVG gets 60% of 190mm = 114mm wide
  // Without summary: SVG gets 190mm wide
  const PAGE_H_MM = 243; // available content height in mm
  const SVG_W_WITH = 60;   // % of page width for SVG when summary shown
  const SVG_W_WITHOUT = 100; // % when no summary

  setTimeout(()=>{
    const printWin = window.open('','_blank');
    const sheets = document.querySelectorAll('.sheet-block');
    let sheetsHtml = '';
    sheets.forEach(s => { sheetsHtml += s.outerHTML; });

    const svgPct = showPanelSummary ? SVG_W_WITH : SVG_W_WITHOUT;
    const tablePct = 100 - svgPct - 2; // 2% gap

    const printHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<title>EasyCutList Cut Plan</title>'
      + '<style>'
      + 'html,body{margin:0;padding:0;background:#e8e8e8;font-family:Arial,sans-serif}'
      + '@page{size:A4 portrait;margin:10mm}'
      + '.toolbar{position:sticky;top:0;background:#3F0E40;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.2)}'
      + '.toolbar button{background:#ECB22E;color:#3F0E40;border:none;border-radius:6px;padding:8px 20px;font-weight:700;font-size:14px;cursor:pointer}'
      + '.toolbar .info{font-size:13px;opacity:.85}'
      + '.pages{padding:20px;display:flex;flex-direction:column;align-items:center;gap:20px}'
      + '.page{background:#fff;width:210mm;min-height:297mm;box-sizing:border-box;padding:10mm;box-shadow:0 2px 12px rgba(0,0,0,.15)}'
      + '@media print{body{background:#fff}.toolbar{display:none}.pages{padding:0;gap:0}.page{box-shadow:none;width:auto;min-height:auto;padding:0;page-break-after:always}.page:last-child{page-break-after:auto}}'
      + '.sheet-block{margin:0;padding:0;background:#fff}'
      + '.print-custom-header{display:block}'
      + '.sheet-header{display:flex;align-items:center;gap:6pt;padding:2pt 0;border-bottom:1pt solid #999;margin-bottom:2pt}'
      + '.sh-name{font-size:11pt;font-weight:700}'
      + '.sh-size{font-size:8pt;color:#666;font-family:monospace}'
      + '.sheet-material-banner{font-family:monospace;font-size:'+matFont+'pt;font-weight:700;color:#1264A3;background:#EBF4FB;padding:1pt 6pt;border-radius:2pt}'
      + '.sheet-waste-badge{font-size:7pt;padding:1pt 5pt;border-radius:2pt}'
      + '.waste-good{background:#d4edda;color:#155724}'
      + '.waste-warn{background:#fff3cd;color:#856404}'
      + '.waste-bad{background:#ffe0e0;color:#c0002a}'
      + '.sheet-stats{'+(showStats?'display:flex':'display:none')+';border-bottom:1pt solid #ccc;margin-bottom:2pt}'
      + '.sstat{padding:1pt 5pt;border-right:1pt solid #ccc}'
      + '.sstat-label{font-size:6pt;color:#999;text-transform:uppercase}'
      + '.sstat-val{font-weight:700;font-size:7pt}'
      + '.sheet-layout-wrap{display:flex;gap:'+( showPanelSummary?'2%':'0')+'}'
      // SVG wrapper — key: use height to constrain tall sheets
      + '.sheet-svg-wrap{flex:0 0 '+svgPct+'%;max-width:'+svgPct+'%}'
      + '.sheet-svg-wrap svg{width:100%;height:auto;max-height:'+PAGE_H_MM+'mm;display:block}'
      + (showPanelSummary
        ? '.sheet-panel-list{flex:0 0 '+tablePct+'%;max-width:'+tablePct+'%;border:1pt solid #3F0E40;border-radius:2pt;overflow:hidden;font-size:7.5pt}'
        : '.sheet-panel-list{display:none}')
      + '.no-screen{display:block!important}'
      + '.cut-seq-wrap{'+(showCutSeq?'display:block':'display:none')+'}'
      + '.cuts-wrap{display:none}'
      + '.sheet-pg-num{display:flex!important;align-items:center;justify-content:space-between;font-size:7pt;color:#555;padding-top:3pt;border-top:1.5pt solid #ECB22E;margin-top:3pt;font-family:Arial}'
      + '.piece-dot{display:inline-block;width:7pt;height:7pt;border-radius:50%;margin-right:2pt;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      // dims toggle
      + (showDims ? '' : '.sv-sz,[class*="pc"][class$="s"]{display:none!important}')
      + '</style>'
      + '</head><body>'
      + '<div class="toolbar"><button onclick="window.print()">\uD83D\uDDA8 Print / Save as PDF</button><span class="info">Preview — ' + sheets.length + ' sheet' + (sheets.length>1?'s':'') + ' · Click Print then choose Save as PDF</span></div>'
      + '<div class="pages">'
      + Array.from(sheets).map(s => '<div class="page">'+s.outerHTML+'</div>').join('')
      + '</div>'
      + '</body></html>';

    printWin.document.write(printHtml);
    printWin.document.close();
  }, 200);
}

// ══ SVG ══
// Rulers show only total sheet L × W.
// Each placed piece shows its own L×H label inside the rectangle — no segment ticks.

function buildSVG(sheet, scale, customFonts={}) {
  // Unit display: geometry stays mm, only label TEXT converts.
  const _pu = (window.UNITS?UNITS.get():'mm');
  const _pd = (mm)=> (window.UNITS?UNITS.fromMMNum(mm):Math.round(mm));
  const _psuf = ({mm:'mm',cm:'cm',m:'m',in:'in',generic:''})[_pu]||'';
  const MAX_W = 580;
  const s  = Math.min(scale, MAX_W / sheet.L);
  const ML = 8, MT = 8, MR = 8, MB = 24;
  const bW = Math.round(sheet.L * s), bH = Math.round(sheet.W * s);
  const svgW = bW + ML + MR, svgH = bH + MT + MB;
  
  // Extract custom fonts or use defaults
  const customSrNoFont = customFonts.srNo || null;
  const customRemarkFont = customFonts.remark || null;
  const customDimFont = customFonts.dim || null;
  const blackText = customFonts.blackText === true;  // true = all label text black

  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="display:block;width:100%;height:auto" preserveAspectRatio="xMidYMid meet">
  <defs><style>
    .sv-bg{fill:#EFEFEF}.sv-bdr{stroke:#AAAAAA;fill:none}.sv-gr{stroke:#DCDCDC}
    .sv-sz{fill:#555555;font-family:'Inconsolata','Courier New',monospace;font-size:11px;font-weight:600}
    @media print{
      .sv-bg{fill:#f0f0f0}.sv-bdr{stroke:#999}.sv-gr{stroke:#ddd}
      .sv-sz{fill:#222;font-family:'Courier New',monospace;font-size:11px;font-weight:700}
    }
  </style></defs>`;

  // Sheet background
  o += `<rect x="${ML}" y="${MT}" width="${bW}" height="${bH}" class="sv-bg"/>`;
  // Faint 100mm grid
  for (let x = 100; x < sheet.L; x += 100) {
    const sx = ML + Math.round(x * s);
    o += `<line x1="${sx}" y1="${MT}" x2="${sx}" y2="${MT+bH}" class="sv-gr" stroke-width="0.4"/>`;
  }
  for (let y = 100; y < sheet.W; y += 100) {
    const sy = MT + Math.round(y * s);
    o += `<line x1="${ML}" y1="${sy}" x2="${ML+bW}" y2="${sy}" class="sv-gr" stroke-width="0.4"/>`;
  }

  // Pieces — width dim on top, height dim on right (inset), label orientation matches piece shape
  for (const p of sheet.placed) {
    const px = ML + Math.round(p.x  * s);
    const py = MT + Math.round(p.y  * s);
    const pw = Math.max(2, Math.round(p.pw * s));
    const ph = Math.max(2, Math.round(p.ph * s));
    const ci = p.piece.colorIdx % COLORS.length;
    const sc = COLORS[ci];
    const pf = PRINT_FILLS [ci % PRINT_FILLS.length];
    const ps = PRINT_STROKES[ci % PRINT_STROKES.length];

    // Sr.No — use colorIdx to find correct panel row within this material
    const matPanels = panelRows.filter(pr => pr.material === sheet.material);
    const svgPanelMatch = matPanels[p.piece.colorIdx] || null;
    const svgGlobalIdx = svgPanelMatch ? panelRows.indexOf(svgPanelMatch) : -1;
    const baseSr = svgGlobalIdx >= 0 ? svgGlobalIdx + 1 : p.piece.colorIdx + 1;
    const srDisplay = p.piece.instance > 1 ? `${baseSr}-${p.piece.instance}` : `${baseSr}`;
    const srLbl = `#${srDisplay}`;
    // Try to get remark from multiple sources
    const remarkText = (
      (p.label && String(p.label).trim()) ||
      (svgPanelMatch && svgPanelMatch.remark && String(svgPanelMatch.remark).trim()) ||
      (p.piece && p.piece.label && String(p.piece.label).trim()) ||
      ''
    );
    const lbl = remarkText ? `${srLbl}\n${remarkText}` : srLbl;

    // Font sizes relative to the smaller dimension, or use custom overrides
    const minDim = Math.min(pw, ph);
    const fs     = customSrNoFont || Math.min(13, Math.max(6, minDim / 6));
    const fsDim  = customDimFont || Math.max(6, fs * 0.88);

    // Show the ENTERED panel dimensions (from the original row), not the
    // packer's round-tripped geometry — avoids drift like 14" -> 356mm -> 14.02".
    // Orient to match placement: if the packer rotated the piece, swap w/h.
    let origW = p.pw, origH = p.ph; // fallback: packer geometry (mm)
    if (svgPanelMatch) {
      const ol = svgPanelMatch.l, ow = svgPanelMatch.w; // stored mm (entered)
      const rotated = Math.abs(p.pw - ow) < Math.abs(p.pw - ol);
      origW = rotated ? ow : ol;
      origH = rotated ? ol : ow;
    }
    const widthTxt  = String(_pd(origW));
    const heightTxt = String(_pd(origH));

    // Text fill: black when blackText is on, otherwise the panel's screen/print colour
    const txtFill   = blackText ? '#000' : sc;
    const dimFill   = blackText ? '#000' : `${sc}dd`;
    const txtFillPr = blackText ? '#000' : ps;

    o += `<g>`;
    o += `<style>
      .pc${ci}r{fill:${sc}20;stroke:${sc};stroke-width:1.2}
      .pc${ci}t{fill:${txtFill};font-family:'Inconsolata','Courier New',monospace;font-size:${fs}px;font-weight:700}
      .pc${ci}rem{fill:${txtFill};font-family:'Inconsolata','Courier New',monospace;font-weight:700}
      .pc${ci}s{fill:${dimFill};font-family:'Inconsolata','Courier New',monospace;font-size:${fsDim}px;font-weight:600}
      @media print{
        .pc${ci}r{fill:${pf};stroke:${ps};stroke-width:1pt}
        .pc${ci}t{fill:${txtFillPr};font-family:'Courier New',monospace;font-weight:700}
        .pc${ci}rem{fill:${txtFillPr};font-family:'Courier New',monospace;font-weight:700}
        .pc${ci}s{fill:${txtFillPr};font-family:'Courier New',monospace;opacity:1;font-weight:700}
      }
    </style>`;
    o += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="2" class="pc${ci}r"/>`;

    // ── Edge banding (drawn before text so Sr.No/remark/dims stay on top) ──
    if (typeof EBand !== 'undefined' && svgPanelMatch && svgPanelMatch.band) {
      const sheetIdx = typeof _lastSheets!=='undefined' && _lastSheets ? _lastSheets.indexOf(sheet) : 0;
      if (sheetIdx === 0 || hasFeature('edgeBanding')) {
        o += EBand.drawBands({
          x: px, y: py, pw, ph,
          band: svgPanelMatch.band,
          rotated: p.piece.rotated || false,
          print: !!(customFonts && customFonts.srNo),
        });
      }
    }

    if (pw > 28 && ph > 16) {
      const cx = px + pw / 2;
      const cy = py + ph / 2;

      // ── Width dim: top edge, centred, small ──
      const dimPadTop = fsDim + 3;
      const widthFits = pw > fsDim * widthTxt.length * 0.62 + 6;
      if (widthFits) {
        o += `<text x="${cx}" y="${py + dimPadTop}" text-anchor="middle" class="pc${ci}s">${widthTxt}</text>`;
      }

      // ── Height dim: right edge, well inset from border (min 12px), rotated ──
      // Place it far enough inside that it never overlaps the sheet border line
      const hInset = Math.max(12, Math.min(pw * 0.2, 20));
      const hdx = px + pw - hInset;
      const heightFits = ph > fsDim * heightTxt.length * 0.62 + 6;
      if (heightFits) {
        o += `<text transform="rotate(-90,${hdx},${cy})" x="${hdx}" y="${cy + fsDim * 0.35}" text-anchor="middle" class="pc${ci}s">${heightTxt}</text>`;
      }

      // ── Label: orientation based on piece aspect ratio ──
      if (lbl) {
        const isLandscape = pw >= ph;
        const topUsed = widthFits ? dimPadTop + 2 : 0;
        const lblCx = cx;

        // Split label into Sr.No and Remark
        const lines = lbl.split('\n');
        const remarkLine = lines.length > 1 ? lines[1] : '';  // Remark (top)
        const srNoLine = lines[0];                            // Sr.No (bottom)

        // Independent font sizes. Sr.No uses fs; remark uses its own override (falls back to fs).
        const srFs  = fs;
        const remFs = customRemarkFont || fs;
        // Gap is derived from BOTH sizes so the two lines never overlap, whatever the fonts.
        const gap = (srFs + remFs) * 0.7;

        if (isLandscape) {
          // LANDSCAPE: two separate <text> elements, stacked (remark top, Sr.No bottom)
          const centerY = py + topUsed + (ph - topUsed) / 2;
          if (remarkLine) {
            const remarkY = centerY - gap / 2;
            const srNoY   = centerY + gap / 2;
            o += `<text x="${lblCx}" y="${remarkY}" text-anchor="middle" dominant-baseline="central" font-size="${remFs}px" class="pc${ci}rem">${remarkLine}</text>`;
            o += `<text x="${lblCx}" y="${srNoY}" text-anchor="middle" dominant-baseline="central" font-size="${srFs}px" class="pc${ci}t">${srNoLine}</text>`;
          } else {
            o += `<text x="${lblCx}" y="${centerY}" text-anchor="middle" dominant-baseline="central" font-size="${srFs}px" class="pc${ci}t">${srNoLine}</text>`;
          }
        } else {
          // PORTRAIT: two separate rotated <text> elements, stacked.
          // Text is rotated -90°, so to stack the two lines side by side we must
          // offset them along X (the screen axis that becomes "vertical spacing"
          // once the text is rotated). Offsetting in Y here would push the long
          // strings along their own length and make them overlap.
          const hInsetP = Math.max(12, Math.min(pw * 0.2, 20));
          if (remarkLine) {
            const remarkX = cx - gap / 2;
            const srNoX   = cx + gap / 2;
            o += `<text transform="rotate(-90,${remarkX},${cy})" x="${remarkX}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${remFs}px" class="pc${ci}rem">${remarkLine}</text>`;
            o += `<text transform="rotate(-90,${srNoX},${cy})" x="${srNoX}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${srFs}px" class="pc${ci}t">${srNoLine}</text>`;
          } else {
            const lblX = cx - hInsetP * 0.4;
            o += `<text transform="rotate(-90,${lblX},${cy})" x="${lblX}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${srFs}px" class="pc${ci}t">${srNoLine}</text>`;
          }
        }
      }
    }

    o += `</g>`;
  }

  // ── Guillotine cut lines ──
  const placed = sheet.placed;
  const hCutSet = new Set(), vCutSet = new Set();
  for (const p of placed) {
    hCutSet.add(Math.round(p.y));
    hCutSet.add(Math.round(p.y + p.ph));
    vCutSet.add(Math.round(p.x));
    vCutSet.add(Math.round(p.x + p.pw));
  }

  // Deduplicate cuts within 5mm of each other (kerf duplicates)
  function dedupeCuts(cuts, sheetMax) {
    const sorted = [...cuts].filter(v => v > 1 && v < sheetMax - 1).sort((a,b) => a-b);
    const result = [];
    for (const v of sorted) {
      if (!result.length || v - result[result.length-1] > 5) result.push(v);
    }
    return result;
  }

  const hCuts = dedupeCuts(
    [...hCutSet].filter(y => !placed.some(p => p.y < y - 0.5 && p.y+p.ph > y + 0.5)),
    sheet.W
  );
  const vCuts = dedupeCuts(
    [...vCutSet].filter(x => !placed.some(p => p.x < x - 0.5 && p.x+p.pw > x + 0.5)),
    sheet.L
  );

  // Draw cut lines — always numbered (sequence numbers shown for all users)
  // Pro users additionally get the cut sequence TABLE below the diagram
  o += `<style>
    .sv-cut{stroke:#CC2200;stroke-width:1;stroke-dasharray:4,3;opacity:.75}
    .sv-cutl{fill:#CC2200;font-family:'Inconsolata','Courier New',monospace;font-size:7px;opacity:.8}
    @media print{.sv-cut{stroke:#CC0000;stroke-dasharray:3,2;opacity:.9}.sv-cutl{fill:#CC0000}}
  </style>`;

  if(sheet._cutSeq && sheet._cutSeq.length > 0){
    const sheetIdx = typeof _lastSheets!=='undefined' && _lastSheets ? _lastSheets.indexOf(sheet) : 0;
    if(sheetIdx === 0 || hasFeature('cutSequenceTable')){
      // Always show numbered cut sequence on diagram
      const bR = (typeof _printBadgeSize !== 'undefined') ? _printBadgeSize : 7;
      o += buildCutSequenceSVG(sheet, scale, sheet._cutSeq, bR);
    }
  } else {
    // Fallback: plain dashed lines (deduped, no kerf duplicates)
    const seenH = new Set(), seenV = new Set();
    for (const y of hCuts) {
      const yr = Math.round(y/10)*10; // round to nearest 10 to dedupe kerf variants
      if(seenH.has(yr)) continue; seenH.add(yr);
      const sy = MT + Math.round(y * s);
      o += `<line x1="${ML}" y1="${sy}" x2="${ML+bW}" y2="${sy}" class="sv-cut"/>`;
      o += `<text x="${ML+3}" y="${sy-2}" class="sv-cutl">↔ ${Math.round(y)}</text>`;
    }
    for (const x of vCuts) {
      const xr = Math.round(x/10)*10;
      if(seenV.has(xr)) continue; seenV.add(xr);
      const sx = ML + Math.round(x * s);
      o += `<line x1="${sx}" y1="${MT}" x2="${sx}" y2="${MT+bH}" class="sv-cut"/>`;
      o += `<text transform="rotate(-90,${sx+6},${MT+bH/2})" x="${sx+6}" y="${MT+bH/2}" text-anchor="middle" class="sv-cutl">↕ ${Math.round(x)}</text>`;
    }
  }

  // Sheet border on top
  o += `<rect x="${ML}" y="${MT}" width="${bW}" height="${bH}" class="sv-bdr" stroke-width="1.5"/>`;

  // Simple total dimension labels — just one number per axis, centred below/right
  o += `<text x="${ML + bW/2}" y="${MT + bH + 15}" text-anchor="middle" class="sv-sz">${_pd(sheet.L)} ${_psuf}</text>`;
  o += `<text transform="rotate(-90,${ML+bW+MR-2},${MT+bH/2})" x="${ML+bW+MR-2}" y="${MT+bH/2}" text-anchor="middle" class="sv-sz">${_pd(sheet.W)} ${_psuf}</text>`;

  o += `</svg>`;
  return o;
}

