// ══ COST CALCULATION ══
function calcCost(sheets){
  // Build price map from stock rows: material → price per sheet
  const priceMap={};
  for(const s of stockRows){
    if(s.price>0) priceMap[s.material]=s.price;
  }
  // Count sheets used per material
  const matSheets={};
  for(const sh of sheets){
    matSheets[sh.material]=(matSheets[sh.material]||0)+1;
  }
  let total=0,hasPrice=false;
  const rows=[];
  for(const[mat,count] of Object.entries(matSheets)){
    const price=priceMap[mat]||0;
    const cost=price*count;
    total+=cost;
    if(price>0)hasPrice=true;
    rows.push({mat,count,price,cost});
  }
  return{total,rows,hasPrice};
}

// ══ API CONFIG ══
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : 'https://api.easycutlist.com';

// ══ CALCULATE — calls backend API ══
async function calculate() {
  if (!stockRows.length) { alert('Add at least one stock sheet.'); return; }
  if (!panelRows.length) { alert('Add at least one panel.'); return; }

  const kerf        = +document.getElementById('kerf').value || 0;
  const matchMat    = document.getElementById('mat-toggle').checked;
  const scale       = +document.getElementById('scale').value || 1;

  // Show loading with cold-start awareness
  document.getElementById('empty-state').style.display = 'none';
  const el = document.getElementById('results');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="empty-state" style="min-height:300px">
      <div class="empty-icon" style="font-size:28px;border:none">⚙️</div>
      <h2 style="color:var(--sl-text)" id="loading-title">Optimizing...</h2>
      <p id="loading-msg">Running packing algorithm</p>
    </div>`;

  // After 4 seconds if still loading, hint about cold start
  const coldStartTimer = setTimeout(() => {
    const t = document.getElementById('loading-title');
    const m = document.getElementById('loading-msg');
    if (t) t.textContent = 'Almost ready...';
    if (m) m.innerHTML = 'Server is waking up — this takes ~15 seconds on first use.<br>Subsequent requests will be instant.';
  }, 4000);

  try {
    // Build payload matching API contract
    const payload = {
      panels: panelRows.map(p => {
        const cut = EBand.deductForPayload(p);  // {l,w} after band deduction (no-op if off)
        return {
          id:        p.id,
          label:     p.remark || p.label || '',  // remark is the new label field
          w:         Math.round(cut.l),
          h:         Math.round(cut.w),
          qty:       p.qty,
          material:  p.material,
          canRotate: true,
          srNo:      p.srNo || null,
        };
      }),
      stocks: stockRows.map(s => ({
        label:    s.label || '',
        w:        Math.round(s.l),
        h:        Math.round(s.w),
        qty:      s.qty,
        material: s.material,
        grainLocked: s.grainLocked || false,
      })),
      kerf,
      matchMaterial: matchMat,
      allowRotate: true,
    };

    const res = await fetch(`${API_URL}/optimize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const data = await res.json();
    clearTimeout(coldStartTimer);

    // Remap API response → renderResults format
    // API returns: { sheets: [{sheetIndex,material,sheetW,sheetH,placed:[{label,colorIdx,instance,x,y,pw,ph}]},...], unfitted, summary }
    const sheets = data.sheets.map(s => ({
      label:    s.sheetLabel || '',
      L:        s.sheetW,
      W:        s.sheetH,
      material: s.material,
      idx:      s.sheetIndex,
      placed:   s.placed.map(p => ({
        x: p.x, y: p.y, pw: p.pw, ph: p.ph,
        piece: {
          label:    p.label,
          colorIdx: p.colorIdx,
          instance: p.instance,
          canRotate: true,
        }
      }))
    }));

    const unfitted = (data.unfitted || []).map(p => ({
      label: p.label, l: p.w, w: p.h, material: p.material, qty: 1
    }));

    renderResults(sheets, unfitted, scale);

    // On mobile, scroll to results automatically
    if(window.innerWidth <= 768){
      setTimeout(()=>{
        document.getElementById('results')?.scrollIntoView({behavior:'smooth', block:'start'});
      }, 300);
    }

  } catch (err) {
    clearTimeout(coldStartTimer);
    el.innerHTML = `
      <div class="empty-state" style="min-height:300px">
        <div class="empty-icon" style="font-size:28px;border:none">⚠️</div>
        <h2 style="color:var(--sl-red)">Error</h2>
        <p>${esc(err.message)}</p>
        <p style="margin-top:8px;font-size:11px;color:var(--sl-text3)">
          Make sure the API server is running at ${API_URL}
        </p>
      </div>`;
  }
}

function calcCuts(sheet){const xC=new Set(),yC=new Set();for(const p of sheet.placed){if(p.x>0)xC.add(Math.round(p.x));if(p.x+p.pw<sheet.L)xC.add(Math.round(p.x+p.pw));if(p.y>0)yC.add(Math.round(p.y));if(p.y+p.ph<sheet.W)yC.add(Math.round(p.y+p.ph))}return{count:xC.size+yC.size,length:xC.size*sheet.W+yC.size*sheet.L}}

