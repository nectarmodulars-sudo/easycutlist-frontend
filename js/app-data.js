// ══ UNITS (shared setting with ASM via localStorage 'ecl_unit') ══
// All stored panel/stock dimensions stay in mm. Convert only at entry + display.
function optUnit(){ return (window.UNITS ? UNITS.get() : 'mm'); }
function d2mm(v){ return window.UNITS ? UNITS.toMM(v) : (+v||0); }        // display -> mm
function mm2d(v){ return window.UNITS ? UNITS.fromMMNum(v) : v; }         // mm -> display number
function populateOptUnits(){
  const sel=document.getElementById('opt-units-select');
  if(sel && window.UNITS) sel.innerHTML=UNITS.optionsHTML(UNITS.get());
}
function setOptUnit(u){
  if(window.UNITS) UNITS.set(u);
  renderPanels(); renderStock();
  // re-render results if present
  if(typeof _lastSheets!=='undefined' && _lastSheets && _lastSheets.length && typeof renderResults==='function'){
    const scale=+document.getElementById('scale')?.value||1;
    renderResults(_lastSheets,_lastUnfitted||[],scale);
  }
}
// keep dropdown in sync if ASM changes the unit
if(typeof window!=='undefined'){
  window.addEventListener('ecl-unit-change',()=>{ populateOptUnits(); if(typeof renderPanels==='function'){renderPanels();renderStock();} });
  document.addEventListener('DOMContentLoaded',populateOptUnits);
}

// ══ CLEAR ══
function clearPanels(){if(panelRows.length&&!confirm('Clear all panels?'))return;panelRows=[];renderPanels()}
function clearStock(){if(stockRows.length&&!confirm('Clear all stock sheets?'))return;stockRows=[];renderStock()}

// ══ PANELS ══
function addPanel(remark='',l=600,w=400,qty=1,material='Plywood',canRotate=true,srNo=null,component='',band=null){
  const sr = srNo !== null ? srNo : (panelRows.length + 1);
  const row = {id:uid(),srNo:sr,component,remark,l,w,qty,material,canRotate};
  if(band && (band.l||band.r||band.t||band.b)) row.band = {l:+band.l||0,r:+band.r||0,t:+band.t||0,b:+band.b||0};
  panelRows.push(row);
  renderPanels();
  autoPopulateStock();
}
function removePanel(id){
  panelRows=panelRows.filter(r=>r.id!==id);
  // Re-assign Sr. No. sequentially after deletion
  panelRows.forEach((r,i)=>r.srNo=i+1);
  renderPanels();
  autoPopulateStock();
}
function updatePanel(id,f,v){
  const r=panelRows.find(r=>r.id===id);
  if(r){
    if(f==='l'||f==='w') r[f]=d2mm(v);        // display -> mm
    else if(f==='qty') r[f]=+v;
    else r[f]=v;
  }
  if(f==='material') autoPopulateStock();
}

// ── Auto-populate stock sheets from panel materials ──
function autoPopulateStock(){
  // Get all unique materials from panels
  const mats = [...new Set(panelRows.map(p=>p.material).filter(Boolean))];
  if(!mats.length) return;

  const defW = +(profile.defaultSheetW||1210);
  const defH = +(profile.defaultSheetH||2430);

  // Add stock for any material not already covered
  let added = false;
  for(const mat of mats){
    const already = stockRows.some(s=>s.material===mat);
    if(!already){
      const price = priceBook[mat]||0;
      stockRows.push({
        id: uid(),
        label: '',
        l: defW,
        w: defH,
        qty: 100,
        material: mat,
        price,
      });
      added = true;
    }
  }
  if(added) renderStock();
}
function toggleRot(id){const r=panelRows.find(r=>r.id===id);if(r){r.canRotate=!r.canRotate;renderPanels()}}
function renderPanels(){
  document.getElementById('panels-tbody').innerHTML=panelRows.map((r,i)=>`<tr>
    <td style="text-align:center;color:rgba(255,255,255,.4);font-family:var(--mono);font-size:10px;user-select:none">${i+1}</td>
    <td><input type="text" value="${esc(r.component||'')}" placeholder="Component" oninput="updatePanel(${r.id},'component',this.value)"></td>
    <td><input type="number" value="${mm2d(r.l)}" min="1" oninput="updatePanel(${r.id},'l',this.value)"></td>
    <td><input type="number" value="${mm2d(r.w)}" min="1" oninput="updatePanel(${r.id},'w',this.value)"></td>
    <td><input type="number" value="${r.qty}" min="1" max="999" oninput="updatePanel(${r.id},'qty',this.value)"></td>
    <td>${matSel(r.material,`updatePanel(${r.id},'material',this.value)`,'matlist_p'+r.id)}</td>
    <td><input type="text" value="${esc(r.remark||'')}" placeholder="Remark" oninput="updatePanel(${r.id},'remark',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();addPanel();const rows=document.querySelectorAll('#panels-tbody tr');const lastRow=rows[rows.length-1];if(lastRow)lastRow.querySelectorAll('input[type=number]')[0]?.focus()}"></td>
    <td><button class="del-btn" onclick="removePanel(${r.id})">&#215;</button></td>
  </tr>`).join('')}

// ══ STOCK ══
function addStock(label='',l=1210,w=2430,qty=1,material='Plywood',price=0,grainLocked=false){
  const def = profile.defaultSheetW ? parseInt(profile.defaultSheetW) : 1210;
  const defH = profile.defaultSheetH ? parseInt(profile.defaultSheetH) : 2430;
  // Auto-fill price from price book if not provided
  const autoPrice = price || priceBook[material] || 0;
  stockRows.push({id:uid(),label,l:l||def,w:w||defH,qty,material,price:autoPrice,grainLocked});
  renderStock();
}
function removeStock(id){stockRows=stockRows.filter(r=>r.id!==id);renderStock()}
function updateStock(id,f,v){const r=stockRows.find(r=>r.id===id);if(r){if(f==='l'||f==='w')r[f]=d2mm(v);else if(f==='qty'||f==='price')r[f]=+v;else r[f]=v;}}
function toggleGrain(id){const r=stockRows.find(r=>r.id===id);if(r){r.grainLocked=!r.grainLocked;renderStock()}}
function renderStock(){
  document.getElementById('stock-tbody').innerHTML=stockRows.map(r=>`<tr>
    <td><input type="text" value="${esc(r.label)}" oninput="updateStock(${r.id},'label',this.value)"></td>
    <td><input type="number" value="${mm2d(r.l)}" min="1" oninput="updateStock(${r.id},'l',this.value)"></td>
    <td><input type="number" value="${mm2d(r.w)}" min="1" oninput="updateStock(${r.id},'w',this.value)"></td>
    <td><input type="number" value="${r.qty}" min="1" max="99" oninput="updateStock(${r.id},'qty',this.value)"></td>
    <td>${matSel(r.material,`updateStock(${r.id},'material',this.value)`,'matlist_s'+r.id)}</td>
    <td><input type="number" value="${r.price||0}" min="0" step="50" placeholder="0" oninput="updateStock(${r.id},'price',this.value)" title="Price per sheet"></td>
    <td style="text-align:center"><button class="rot-btn" title="${r.grainLocked?'Grain locked — click to allow rotation':'Free rotation — click to lock grain'}" style="color:${r.grainLocked?'#ff8ab0':'rgba(255,255,255,.4)'};font-size:13px" onclick="toggleGrain(${r.id})">${r.grainLocked?'🔒':'↻'}</button></td>
    <td><button class="del-btn" onclick="removeStock(${r.id})">&#215;</button></td>
  </tr>`).join('')}

// ══ CSV — Panels format: Sr.No, Component, W, H, QTY, Material, Remark, L, R, T, B ══
const CSV_SAMPLES={
  panels:`Sr. No.,Component,W,H,QTY,Material,Remark,L,R,T,B\n1,Top,1980,350,1,9172 SH,1980 GROVE,2,2,2,0\n2,Bottom,280,330,2,9172 SH,280 GROVE,2,2,0,0\n3,Shelf,394,287,4,9172 SH,394 GROVE,0,0,2,2\n4,Side,540,2370,2,SDL 1020 SHG,,2,2,2,2\n5,Back,130,470,3,SDL 1020 SHG,,0,0,0,0\n`,
  stock:`W,H,QTY,Material,Label,Price\n1210,2430,100,DW,,1800\n1210,2430,100,MDF,,1200\n1210,2430,100,SDL 1020 SHG,,2100\n1210,2430,100,SDL 1020 SHG 18MM BOARD,,2500\n`
};
const CSV_HINTS={
  panels:`Tab, comma or Excel file. Header row detected automatically.\nColumns: Sr. No.  Component  W  H  QTY  Material  Remark  L  R  T  B\n\nSr. No. is optional — auto-assigned if blank.\nComponent, Remark are optional — printed on stickers.\nL R T B = edge-band thickness (mm) per side. Optional; loads into the EBand modal.\n\nExample:\n1\tTop\t1980\t350\t1\t9172 SH\t1980 GROVE\t2\t2\t2\t0`,
  stock:`Tab or comma separated. First row (header) is skipped automatically.\nColumns: W  H  QTY  Material  Label  Price\n\nExample:\n1210\t2430\t100\tDW\t\t1800\n1210\t2430\t100\tMDF\t\t1200`
};
function openCSV(t){csvTarget=t;document.getElementById('csv-modal-title').textContent=t==='panels'?'Import Panels':'Import Stock Sheets';document.getElementById('csv-hint').textContent=CSV_HINTS[t];document.getElementById('csv-textarea').value='';document.getElementById('csv-file-input').value='';document.getElementById('csv-file-input').accept='.csv,.xlsx,.xls,.txt';document.getElementById('csv-modal').style.display='flex'}
function closeCSV(){document.getElementById('csv-modal').style.display='none'}
function loadCSVFile(e){
  const f=e.target.files[0];if(!f)return;
  const isXlsx=f.name.match(/\.(xlsx|xls)$/i);
  if(isXlsx){
    const doRead=()=>{
      const r=new FileReader();
      r.onload=ev=>{
        const wb=XLSX.read(ev.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        document.getElementById('csv-textarea').value=XLSX.utils.sheet_to_csv(ws);
      };
      r.readAsArrayBuffer(f);
    };
    if(typeof XLSX==='undefined'){
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload=doRead;
      document.head.appendChild(s);
    } else { doRead(); }
  } else {
    const r=new FileReader();
    r.onload=ev=>document.getElementById('csv-textarea').value=ev.target.result;
    r.readAsText(f);
  }
}
function parseLine(line){const delim=line.includes('\t')?'\t':',';const res=[];let cur='',inQ=false;for(const c of line){if(c==='"'){inQ=!inQ}else if(c===delim&&!inQ){res.push(cur.trim());cur=''}else{cur+=c}}res.push(cur.trim());return res}

function isHeaderRow(cols){
  // A row is a header if the first two columns are NOT parseable as positive numbers
  return isNaN(parseFloat(cols[0]))||isNaN(parseFloat(cols[1]))||parseFloat(cols[0])<=0||parseFloat(cols[1])<=0;
}

// Build a column-index map from a header row. Returns null if the row
// doesn't look like a header (i.e. no recognisable column names).
function mapHeader(cols){
  const norm = s => String(s||'').trim().toLowerCase().replace(/[\s._()]/g,'');
  const map = {};
  cols.forEach((c,i)=>{
    const k = norm(c);
    if(k==='srno'||k==='sr'||k==='serial'||k==='no'||k==='sno') map.srNo=i;
    else if(k==='component'||k==='comp'||k==='part') map.component=i;
    else if(k==='w'||k==='width') map.w=i;
    else if(k==='h'||k==='height') map.h=i;
    else if(k==='qty'||k==='quantity'||k==='q') map.qty=i;
    else if(k==='material'||k==='mat'||k==='board') map.material=i;
    else if(k==='remark'||k==='remarks'||k==='label'||k==='note') map.remark=i;
    // Edge-band columns. Accept "l","leband","ledgeband", etc. — leading letter wins.
    else if(k==='l'||k==='leband'||k==='ledgeband'||k==='left') map.l=i;
    else if(k==='r'||k==='reband'||k==='redgeband'||k==='right') map.r=i;
    else if(k==='t'||k==='teband'||k==='tedgeband'||k==='top') map.t=i;
    else if(k==='b'||k==='beband'||k==='bedgeband'||k==='bottom') map.b=i;
  });
  // Valid header must at least locate W and H.
  return (map.w!=null && map.h!=null) ? map : null;
}

function applyCSV(){
  const raw=document.getElementById('csv-textarea').value.trim();if(!raw){closeCSV();return}
  let imported=0,errors=0,autoSr=0;
  const lines=raw.split('\n');
  const errCheck=document.getElementById('error-check-toggle')?.checked!==false;
  const hardErrors=[];const warnings=[];

  // Try to read a header from the first non-empty line (panels only).
  let hdr=null, startLine=0;
  if(csvTarget==='panels'){
    for(let i=0;i<lines.length;i++){
      const t=lines[i].trim(); if(!t) continue;
      hdr=mapHeader(parseLine(t));
      startLine=i+ (hdr?1:0);
      break;
    }
  }

  for(let i=startLine;i<lines.length;i++){
    const t=lines[i].trim();if(!t)continue;
    const cols=parseLine(t);

    if(csvTarget!=='panels'){
      // Stock: W,H,QTY,Material,Label,Price
      if(isHeaderRow(cols))continue;
      const W=parseFloat(cols[0]),H=parseFloat(cols[1]);
      const qty=Math.max(1,parseInt(cols[2])||1),mat=(cols[3]||'Plywood').trim()||'Plywood';
      const lbl=(cols[4]||'').trim(),price=parseFloat(cols[5])||0;
      if(W>0&&H>0){addStock(lbl,d2mm(W),d2mm(H),qty,mat,price);imported++;}else errors++;
      continue;
    }

    // ── PANELS ──
    let srNo,component='',remark='',W,H,qty,mat,band={l:0,r:0,t:0,b:0};

    if(hdr){
      // Header-mapped columns (robust to new order + Component + LRTB).
      const g = k => hdr[k]!=null ? (cols[hdr[k]]||'').trim() : '';
      srNo      = g('srNo') || null;
      component = g('component');
      W         = parseFloat(g('w'));
      H         = parseFloat(g('h'));
      qty       = Math.max(1, parseInt(g('qty'))||1);
      mat       = g('material')||'Plywood';
      remark    = g('remark');
      band = { l:parseFloat(g('l'))||0, r:parseFloat(g('r'))||0, t:parseFloat(g('t'))||0, b:parseFloat(g('b'))||0 };
    } else {
      // No header — fall back to legacy positional detection.
      if(isHeaderRow(cols))continue;
      const col0n=parseFloat(cols[0]), col1n=parseFloat(cols[1]), col2n=parseFloat(cols[2]);
      const col0isSerial = Number.isInteger(col0n) && col0n>0 && col0n<10000;
      const isNewFormat = col0isSerial && !isNaN(col1n) && col1n>0 && !isNaN(col2n) && col2n>0;
      if(isNewFormat){
        // Legacy new: Sr.No, W, H, QTY, Material, Remark
        srNo=cols[0]?cols[0].trim():null;
        W=col1n;H=col2n;qty=Math.max(1,parseInt(cols[3])||1);
        mat=(cols[4]||'Plywood').trim()||'Plywood';remark=(cols[5]||'').trim();
      } else {
        // Legacy old: W, H, QTY, Material, Remark
        W=col0n;H=col1n;qty=Math.max(1,parseInt(cols[2])||1);
        mat=(cols[3]||'Plywood').trim()||'Plywood';remark=(cols[4]||'').trim();srNo=null;
      }
    }
    if(!mat) mat='Plywood';

    if(errCheck){
      const rowNum=i+1;
      if(!W||!H||W<=0||H<=0){hardErrors.push(`Row ${rowNum} — Size is 0 or missing`);errors++;continue;}
      if(isNaN(W)||isNaN(H)){hardErrors.push(`Row ${rowNum} — Non-numeric size`);errors++;continue;}
      if(optUnit()==='mm' && W<100&&H<100) warnings.push(`Row ${rowNum} — Size ${W}×${H} looks like inches, not mm`);
      if(optUnit()==='mm' && (W<50||H<50)) warnings.push(`Row ${rowNum} — Very small panel (${W}×${H}mm) — typo?`);
      if(qty>50) warnings.push(`Row ${rowNum} — Qty ${qty} is unusually high`);
    }

    if(W>0&&H>0){
      const finalSr=srNo||(++autoSr);
      addPanel(remark,d2mm(W),d2mm(H),qty,mat,true,finalSr,component,band);
      imported++;
    } else errors++;
  }

  closeCSV();
  if(csvTarget==='panels') autoPopulateStock();

  if(hardErrors.length||warnings.length){
    const msg=[];
    if(hardErrors.length) msg.push(`🔴 ${hardErrors.length} error(s):\n${hardErrors.slice(0,5).join('\n')}`);
    if(warnings.length) msg.push(`🟡 ${warnings.length} warning(s):\n${warnings.slice(0,5).join('\n')}`);
    if(imported) msg.push(`✓ ${imported} rows imported`);
    alert(msg.join('\n\n'));
  } else if(errors) {
    alert(`Imported ${imported}. ${errors} rows skipped (invalid data).`);
  }
}

function downloadSampleCSV(){
  if(csvTarget==='panels' && typeof XLSX !== 'undefined'){
    // Download as Excel for panels
    const data=[
      ['Sr. No.','Component','W','H','QTY','Material','Remark','L','R','T','B'],
      [1,'Top',1980,350,1,'9172 SH','1980 GROVE',2,2,2,0],
      [2,'Bottom',280,330,2,'9172 SH','280 GROVE',2,2,0,0],
      [3,'Shelf',394,287,4,'9172 SH','394 GROVE',0,0,2,2],
      [4,'Side',540,2370,2,'SDL 1020 SHG','',2,2,2,2],
      [5,'Back',130,470,3,'SDL 1020 SHG','',0,0,0,0],
    ];
    const ws=XLSX.utils.aoa_to_sheet(data);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,'Panels',ws);
    XLSX.writeFile(wb,'sample_panels.xlsx');
  } else {
    const data=CSV_SAMPLES[csvTarget];
    const fname=csvTarget==='panels'?'sample_panels.csv':'sample_stock.csv';
    const blob=new Blob([data],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();
    URL.revokeObjectURL(a.href);
  }
}

