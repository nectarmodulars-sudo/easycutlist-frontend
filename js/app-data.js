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
function addPanel(remark='',l=600,w=400,qty=1,material='Plywood',canRotate=true,srNo=null){
  const sr = srNo !== null ? srNo : (panelRows.length + 1);
  panelRows.push({id:uid(),srNo:sr,remark,l,w,qty,material,canRotate});
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

// ══ CSV — Format: W  H  QTY  Material  Label ══
const CSV_SAMPLES={
  panels:`Sr. No.,W,H,QTY,Material,Remark\n1,1980,350,1,9172 SH,1980 GROVE\n2,280,330,2,9172 SH,280 GROVE\n3,394,287,4,9172 SH,394 GROVE\n4,540,2370,2,SDL 1020 SHG,\n5,130,470,3,SDL 1020 SHG,\n`,
  stock:`W,H,QTY,Material,Label,Price\n1210,2430,100,DW,,1800\n1210,2430,100,MDF,,1200\n1210,2430,100,SDL 1020 SHG,,2100\n1210,2430,100,SDL 1020 SHG 18MM BOARD,,2500\n`
};
const CSV_HINTS={
  panels:`Tab, comma or Excel file. Header row skipped automatically.\nColumns: Sr. No.  W  H  QTY  Material  Remark\n\nSr. No. is optional — auto-assigned if blank.\nRemark is optional — appears on stickers.\n\nExample:\n1\t1980\t350\t1\t9172 SH\t1980 GROVE\n2\t280\t330\t2\t9172 SH\t280 GROVE`,
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

function applyCSV(){
  const raw=document.getElementById('csv-textarea').value.trim();if(!raw){closeCSV();return}
  let imported=0,errors=0,autoSr=0;
  const lines=raw.split('\n');
  const errCheck=document.getElementById('error-check-toggle')?.checked!==false;
  const hardErrors=[];const warnings=[];

  // Detect column order: new format has Sr.No as col[0] (non-numeric header or number)
  // We detect by checking if the first data row's col[0] is numeric and col[2]/col[3] are also numeric
  // New: Sr.No, Remark, W, H, QTY, Material
  // Old: W, H, QTY, Material, Label

  for(let i=0;i<lines.length;i++){
    const t=lines[i].trim();if(!t)continue;
    const cols=parseLine(t);
    if(isHeaderRow(cols))continue;

    let srNo,remark,W,H,qty,mat;

    const col0n=parseFloat(cols[0]), col1n=parseFloat(cols[1]);
    const col2n=parseFloat(cols[2]), col3n=parseFloat(cols[3]);

    // New format: Sr.No(int), W, H, QTY, Material, Remark
    // Col[0] is a small positive integer (serial number)
    // Col[1] and col[2] are positive numbers (W and H)
    const col0isSerial = Number.isInteger(col0n) && col0n > 0 && col0n < 10000;
    const isNewFormat = col0isSerial && !isNaN(col1n) && col1n > 0 && !isNaN(col2n) && col2n > 0;
    // Old format: W, H, QTY, Material, Remark — col[0] is W (large number, not serial)
    const isOldFormat = !col0isSerial && !isNaN(col0n) && col0n > 0 && !isNaN(col1n) && col1n > 0;

    if(csvTarget==='panels'){
      if(isNewFormat){
        // New: Sr.No, W, H, QTY, Material, Remark
        srNo=cols[0]?cols[0].trim():null;
        W=col1n;H=col2n;qty=Math.max(1,parseInt(cols[3])||1);
        mat=(cols[4]||'Plywood').trim()||'Plywood';
        remark=(cols[5]||'').trim();
      } else {
        // Old format: W, H, QTY, Material, Remark
        W=col0n;H=col1n;qty=Math.max(1,parseInt(cols[2])||1);
        mat=(cols[3]||'Plywood').trim()||'Plywood';
        remark=(cols[4]||'').trim();srNo=null;
      }
    } else {
      // Stock: W,H,QTY,Material,Label,Price
      W=col0n;H=col1n;qty=Math.max(1,parseInt(cols[2])||1);mat=(cols[3]||'Plywood').trim()||'Plywood';
      const lbl=(cols[4]||'').trim(),price=parseFloat(cols[5])||0;
      if(W>0&&H>0){addStock(lbl,d2mm(W),d2mm(H),qty,mat,price);imported++;}else errors++;
      continue;
    }

    // Error check (panels only)
    if(errCheck){
      const rowNum=i+1;
      if(!W||!H||W<=0||H<=0){hardErrors.push(`Row ${rowNum} — Size is 0 or missing`);errors++;continue;}
      if(isNaN(W)||isNaN(H)){hardErrors.push(`Row ${rowNum} — Non-numeric size`);errors++;continue;}
      // Warn: looks like inches (only meaningful in mm mode)
      if(optUnit()==='mm' && W<100&&H<100) warnings.push(`Row ${rowNum} — Size ${W}×${H} looks like inches, not mm`);
      // Warn: too small (mm mode only — small numbers are normal in inch/cm)
      if(optUnit()==='mm' && (W<50||H<50)) warnings.push(`Row ${rowNum} — Very small panel (${W}×${H}mm) — typo?`);
      // Warn: very high qty
      if(qty>50) warnings.push(`Row ${rowNum} — Qty ${qty} is unusually high`);
    }

    if(W>0&&H>0){
      const finalSr=srNo||(++autoSr);
      addPanel(remark,d2mm(W),d2mm(H),qty,mat,true,finalSr);
      imported++;
    } else errors++;
  }

  closeCSV();
  if(csvTarget==='panels') autoPopulateStock();

  // Show validation results
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
      ['Sr. No.','W','H','QTY','Material','Remark'],
      [1,1980,350,1,'9172 SH','1980 GROVE'],
      [2,280,330,2,'9172 SH','280 GROVE'],
      [3,394,287,4,'9172 SH','394 GROVE'],
      [4,540,2370,2,'SDL 1020 SHG',''],
      [5,130,470,3,'SDL 1020 SHG',''],
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

