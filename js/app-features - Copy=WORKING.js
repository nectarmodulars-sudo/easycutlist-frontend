// ══ CUTTING SEQUENCE ══
// Compute the order in which cuts should be made on a panel saw.
// Uses recursive guillotine tree: full-width H cuts first, then V cuts per strip.
function computeCutSequence(sheet){
  const placed = sheet.placed;
  const W = sheet.L, H = sheet.W;
  const seq = []; // [{type:'H'|'V', pos, section, stepNum}]

  function findCuts(pieces, rx, ry, rw, rh){
    if(pieces.length <= 1) return;

    // Try full horizontal cuts within region
    const ys = [...new Set(pieces.map(p=>[Math.round(p.y),Math.round(p.y+p.ph)]).flat())]
      .filter(y => y > ry+1 && y < ry+rh-1)
      .sort((a,b)=>a-b);

    for(const y of ys){
      const top = pieces.filter(p => p.y+p.ph <= y+0.5);
      const bot = pieces.filter(p => p.y >= y-0.5);
      if(top.length + bot.length === pieces.length && top.length > 0 && bot.length > 0){
        seq.push({type:'H', pos:y, rx, ry, rw, rh, section:`${Math.round(rx)},${Math.round(ry)}`});
        findCuts(top, rx, ry, rw, y-ry);
        findCuts(bot, rx, y, rw, ry+rh-y);
        return;
      }
    }

    // Try full vertical cuts within region
    const xs = [...new Set(pieces.map(p=>[Math.round(p.x),Math.round(p.x+p.pw)]).flat())]
      .filter(x => x > rx+1 && x < rx+rw-1)
      .sort((a,b)=>a-b);

    for(const x of xs){
      const lft = pieces.filter(p => p.x+p.pw <= x+0.5);
      const rgt = pieces.filter(p => p.x >= x-0.5);
      if(lft.length + rgt.length === pieces.length && lft.length > 0 && rgt.length > 0){
        seq.push({type:'V', pos:x, rx, ry, rw, rh, section:`${Math.round(rx)},${Math.round(ry)}`});
        findCuts(lft, rx, ry, x-rx, rh);
        findCuts(rgt, x, ry, rx+rw-x, rh);
        return;
      }
    }
  }

  findCuts(placed, 0, 0, W, H);
  return seq.map((c,i)=>({...c, stepNum:i+1}));
}

function buildCutSequenceSVG(sheet, scale, cutSeq, badgeR){
  // Returns SVG overlay elements with numbered cut lines
  // badgeR: radius of the red circle badge (default 10)
  const r = badgeR || 10;
  const fs = Math.max(6, Math.round(r * 1.1)); // font size scales with badge
  const ML=8, MT=8, MR=8, MB=24;
  const s = Math.min(scale, 580/sheet.L);
  let o = '';

  cutSeq.forEach(cut => {
    const num = cut.stepNum;
    if(cut.type === 'H'){
      const sy = MT + Math.round(cut.pos * s);
      const sx1 = ML + Math.round(cut.rx * s);
      const sx2 = ML + Math.round((cut.rx + cut.rw) * s);
      o += `<line x1="${sx1}" y1="${sy}" x2="${sx2}" y2="${sy}" stroke="#CC2200" stroke-width="1.5" stroke-dasharray="5,3" opacity=".9"/>`;
      o += `<circle cx="${sx1+r+1}" cy="${sy}" r="${r}" fill="#CC2200"/>`;
      o += `<text x="${sx1+r+1}" y="${sy}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="monospace" font-size="${fs}" font-weight="900">${num}</text>`;
      o += `<text x="${sx1+r*2+4}" y="${sy-2}" fill="#CC2200" font-family="monospace" font-size="7" opacity=".8">↔ ${Math.round(cut.pos)}</text>`;
    } else {
      const sx = ML + Math.round(cut.pos * s);
      const sy1 = MT + Math.round(cut.ry * s);
      const sy2 = MT + Math.round((cut.ry + cut.rh) * s);
      o += `<line x1="${sx}" y1="${sy1}" x2="${sx}" y2="${sy2}" stroke="#CC2200" stroke-width="1.5" stroke-dasharray="5,3" opacity=".9"/>`;
      o += `<circle cx="${sx}" cy="${sy1+r+1}" r="${r}" fill="#CC2200"/>`;
      o += `<text x="${sx}" y="${sy1+r+1}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="monospace" font-size="${fs}" font-weight="900">${num}</text>`;
      o += `<text transform="rotate(-90,${sx+r+2},${sy1+r*2+4})" x="${sx+r+2}" y="${sy1+r*2+7}" fill="#CC2200" font-family="monospace" font-size="7" opacity=".8">↕ ${Math.round(cut.pos)}</text>`;
    }
  });
  return o;
}

function buildCutSeqTable(cutSeq, sheet){
  if(!cutSeq.length) return '';
  const rows = cutSeq.map(c=>`
    <tr>
      <td><span class="cut-num-cell">${c.stepNum}</span></td>
      <td>${c.type==='H'?'Horizontal ↔':'Vertical ↕'}</td>
      <td>${Math.round(c.pos)} mm</td>
      <td style="font-size:10px;color:var(--sl-text3)">${c.type==='H'?`Full width of section`:`Full height of section`}</td>
    </tr>`).join('');
  return `
    <div class="cut-seq-wrap">
      <div class="cut-seq-title">
        <span class="cut-seq-badge-inline">✂</span>
        Cutting Sequence — Follow in Order
      </div>
      <table class="cut-seq-table">
        <thead><tr><th>#</th><th>Cut Type</th><th>Position</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ══ PRICE BOOK ══
let priceBook = JSON.parse(localStorage.getItem('ecl_pricebook')||'{}');
function savePriceBook(){ localStorage.setItem('ecl_pricebook', JSON.stringify(priceBook)); }
function openPriceBook(){ renderPriceBookList(); document.getElementById('pricebook-modal').style.display='flex'; }
function closePriceBook(){ document.getElementById('pricebook-modal').style.display='none'; }
function renderPriceBookList(){
  const cur=getCurrency();
  const entries=Object.entries(priceBook);
  const el=document.getElementById('pricebook-list');
  if(!entries.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--sl-text3)">No materials saved yet. Add below.</div>`;return;}
  el.innerHTML=entries.map(([mat,price])=>`
    <div class="pb-row">
      <div class="pb-mat">${esc(mat)}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--sl-text3)">${cur}</span>
        <input type="number" value="${price}" min="0" step="50"
          onchange="priceBook['${esc(mat)}']=+this.value;savePriceBook()"
          style="width:90px;background:var(--sl-bg2);border:1px solid var(--sl-border2);color:var(--sl-text);border-radius:4px;padding:4px 6px;font-family:var(--mono);font-size:12px;text-align:right">
        <button onclick="deletePriceEntry('${esc(mat)}')" class="del-btn" style="color:var(--sl-red)">✕</button>
      </div>
    </div>`).join('');
}
function addPriceBookEntry(){
  const mat=document.getElementById('pb-new-mat').value.trim();
  const price=+document.getElementById('pb-new-price').value||0;
  if(!mat){alert('Enter material name');return;}
  priceBook[mat]=price; savePriceBook();
  document.getElementById('pb-new-mat').value='';
  document.getElementById('pb-new-price').value='';
  renderPriceBookList();
  stockRows.forEach(r=>{if(r.material===mat&&!r.price)r.price=price;});
  renderStock();
}
function deletePriceEntry(mat){ delete priceBook[mat]; savePriceBook(); renderPriceBookList(); }

// ══ CLIENT MANAGEMENT ══
let clients = JSON.parse(localStorage.getItem('ecl_clients')||'[]');
function saveClients(){ localStorage.setItem('ecl_clients', JSON.stringify(clients)); }
function openClients(){
  // Clear search first, then render
  const s = document.getElementById('client-search');
  if(s) s.value = '';
  renderClientsList();
  document.getElementById('clients-modal').style.display='flex';
}
function closeClients(){ document.getElementById('clients-modal').style.display='none'; }
function openAddClient(id=null){
  const c=id?clients.find(c=>c.id===id):null;
  document.getElementById('add-client-title').textContent=c?'Edit Client':'Add Client';
  document.getElementById('cl-name').value=c?.name||'';
  document.getElementById('cl-biz').value=c?.biz||'';
  document.getElementById('cl-phone').value=c?.phone||'';
  document.getElementById('cl-email').value=c?.email||'';
  document.getElementById('cl-notes').value=c?.notes||'';
  document.getElementById('cl-edit-id').value=id||'';
  document.getElementById('add-client-modal').style.display='flex';
  setTimeout(()=>document.getElementById('cl-name').focus(),100);
}
function closeAddClient(){
  document.getElementById('add-client-modal').style.display='none';
}
function saveClient(){
  const name=document.getElementById('cl-name').value.trim();
  if(!name){alert('Client name required');return;}
  const editId=+document.getElementById('cl-edit-id').value||0;
  const client={
    id:editId||Date.now(), name,
    biz:document.getElementById('cl-biz').value.trim(),
    phone:document.getElementById('cl-phone').value.trim(),
    email:document.getElementById('cl-email').value.trim(),
    notes:document.getElementById('cl-notes').value.trim(),
    date:new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
  };
  if(editId){clients=clients.map(c=>c.id===editId?client:c);}else{clients.unshift(client);}
  saveClients();
  closeAddClient();
  // Clear search and re-render so new client is visible
  const s=document.getElementById('client-search');
  if(s) s.value='';
  renderClientsList();
}
function deleteClient(id){
  const c=clients.find(c=>c.id===id);
  if(!c||!confirm(`Delete "${c.name}"?`))return;
  clients=clients.filter(c=>c.id!==id); saveClients(); renderClientsList();
}
function renderClientsList(){
  const q=(document.getElementById('client-search')?.value||'').toLowerCase().trim();
  const filtered=q
    ? clients.filter(c=>c.name.toLowerCase().includes(q)||(c.biz||'').toLowerCase().includes(q)||(c.phone||'').includes(q))
    : clients; // show ALL when search is empty
  const el=document.getElementById('clients-list');
  if(!el) return;
  if(!filtered.length){
    el.innerHTML=`<div style="text-align:center;padding:30px;color:var(--sl-text3)">
      <div style="font-size:15px;color:var(--sl-text2);font-weight:700;margin-bottom:6px">${clients.length&&q?'No matches':'No clients yet'}</div>
      <div style="font-size:13px">${clients.length&&q?'Try a different name or phone number':'Click "+ Add Client" to add your first client'}</div>
    </div>`;
    return;
  }
  el.innerHTML=filtered.map(c=>`
    <div class="client-card">
      <div class="client-avatar">${c.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1">
        <div class="client-name">${esc(c.name)}${c.biz?` <span style="font-weight:400;color:var(--sl-text2)">· ${esc(c.biz)}</span>`:''}</div>
        <div class="client-meta">${c.phone?`📞 ${esc(c.phone)} `:''} ${c.email?`✉ ${esc(c.email)}`:''} ${c.notes?`· ${esc(c.notes.substring(0,40))}${c.notes.length>40?'...':''}`:''}</div>
        <div style="font-size:10px;color:var(--sl-text3);margin-top:2px">Added: ${c.date||''}</div>
      </div>
      <div class="client-actions">
        <button class="proj-act-btn proj-act-load" onclick="useClientInProject(${c.id})">Use</button>
        <button class="proj-act-btn proj-act-dup" onclick="openAddClient(${c.id})">Edit</button>
        <button class="proj-act-btn proj-act-del" onclick="deleteClient(${c.id})">Delete</button>
      </div>
    </div>`).join('');
}
function useClientInProject(id){
  const c=clients.find(c=>c.id===id);if(!c)return;
  closeClients(); openSaveProject();
  document.getElementById('sp-client').value=c.name;
}

// ══ EXPORT ══
let _lastSheets=[], _lastUnfitted=[];
function exportCSV(){
  if(!_lastSheets.length){alert('Run optimizer first');return;}
  let csv='Sheet,Material,Sheet Size,Panel Label,Width,Height,Pos X,Pos Y,Rotated\n';
  _lastSheets.forEach((s,si)=>{
    s.placed.forEach(p=>{
      csv+=`${si+1},"${s.material}","${s.L}×${s.W}","${p.piece.label||''}",${p.pw},${p.ph},${Math.round(p.x)},${Math.round(p.y)},${p.pw!==p.piece.l?'Yes':'No'}\n`;
    });
  });
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='easycutlist-results.csv';a.click();URL.revokeObjectURL(a.href);
}
function exportExcel(){
  if(!_lastSheets.length){alert('Run optimizer first');return;}
  const cur=getCurrency();
  const eclFooter=`<p style="font-family:Arial;font-size:10px;color:#888;margin-top:16px;border-top:1px solid #eee;padding-top:8px">
    <strong style="color:#3F0E40">✂ EasyCutList</strong> &nbsp;·&nbsp; easycutlist.com &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-IN')}
  </p>`;
  let html=`<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8">
  <style>th{background:#3F0E40;color:white;padding:6px 10px}td{padding:5px 10px;border:1px solid #ddd}</style></head><body>
  <p style="font-family:Arial;font-size:18px;font-weight:900;color:#3F0E40;margin-bottom:4px">✂ EasyCutList — Cut Plan</p>
  <p style="font-family:Arial;font-size:11px;color:#888">easycutlist.com &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-IN')}</p>`;
  // Summary
  html+=`<h3>Summary</h3><table border="1"><tr><th>Material</th><th>Sheets</th><th>Pieces</th><th>Waste %</th><th>Cost (${cur})</th></tr>`;
  const mm={};
  _lastSheets.forEach(s=>{
    if(!mm[s.material])mm[s.material]={sheets:0,pieces:0,used:0,total:0};
    mm[s.material].sheets++;mm[s.material].total+=s.L*s.W;
    s.placed.forEach(p=>{mm[s.material].used+=p.pw*p.ph;mm[s.material].pieces++;});
  });
  Object.entries(mm).forEach(([mat,d])=>{
    const waste=((d.total-d.used)/d.total*100).toFixed(1);
    const price=stockRows.find(r=>r.material===mat)?.price||0;
    html+=`<tr><td>${mat}</td><td>${d.sheets}</td><td>${d.pieces}</td><td>${waste}%</td><td>${price?cur+(price*d.sheets).toLocaleString('en-IN'):'-'}</td></tr>`;
  });
  // Detail
  html+=`</table><br><h3>Cut List Detail</h3><table border="1"><tr><th>Sheet</th><th>Material</th><th>Size</th><th>Panel</th><th>W</th><th>H</th><th>X</th><th>Y</th><th>Rotated</th></tr>`;
  _lastSheets.forEach((s,si)=>{
    s.placed.forEach(p=>{
      html+=`<tr><td>${si+1}</td><td>${s.material}</td><td>${s.L}×${s.W}</td><td>${p.piece.label||''}</td><td>${p.pw}</td><td>${p.ph}</td><td>${Math.round(p.x)}</td><td>${Math.round(p.y)}</td><td>${p.pw!==p.piece.l?'Yes':'No'}</td></tr>`;
    });
  });
  html+='</table>'+eclFooter+'</body></html>';
  const blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='easycutlist-results.xls';a.click();URL.revokeObjectURL(a.href);
}

// ══ NEW PROJECT ══
function newProject(){
  if((panelRows.length||stockRows.length)&&!confirm('Start a new blank project? Current panels and stock will be cleared.'))return;
  panelRows=[];stockRows=[];idC=0;
  renderPanels();renderStock();
  document.getElementById('results').style.display='none';
  document.getElementById('empty-state').style.display='flex';
}
function openProfile(){
  const p=profile;
  document.getElementById('pf-name').value=p.name||'';
  document.getElementById('pf-biz').value=p.biz||'';
  document.getElementById('pf-phone').value=p.phone||'';
  document.getElementById('pf-currency').value=p.currency||'₹';
  document.getElementById('pf-kerf').value=p.kerf||3;
  document.getElementById('pf-sw').value=p.defaultSheetW||1210;
  document.getElementById('pf-sh').value=p.defaultSheetH||2430;
  const prev=document.getElementById('pf-logo-preview');
  prev.innerHTML=p.logo?`<img src="${p.logo}" style="max-height:50px;border-radius:4px;border:1px solid var(--sl-border2)">`:'' ;
  document.getElementById('profile-modal').style.display='flex';
}
function closeProfile(){document.getElementById('profile-modal').style.display='none'}
function loadLogo(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    document.getElementById('pf-logo-preview').innerHTML=`<img src="${ev.target.result}" style="max-height:50px;border-radius:4px;border:1px solid var(--sl-border2)">`;
    profile._pendingLogo=ev.target.result;
  };
  r.readAsDataURL(f);
}
function saveProfile(){
  profile={
    name:  document.getElementById('pf-name').value.trim(),
    biz:   document.getElementById('pf-biz').value.trim(),
    phone: document.getElementById('pf-phone').value.trim(),
    currency: document.getElementById('pf-currency').value,
    kerf:  +document.getElementById('pf-kerf').value||3,
    defaultSheetW: +document.getElementById('pf-sw').value||1210,
    defaultSheetH: +document.getElementById('pf-sh').value||2430,
    logo:  profile._pendingLogo||profile.logo||null,
  };
  localStorage.setItem('ecl_profile', JSON.stringify(profile));
  // Apply defaults
  document.getElementById('kerf').value=profile.kerf;
  closeProfile();
  alert('Profile saved!');
}

// ══ PROJECTS ══
function switchSaveTab(tab){
  const isNew = tab==='new';
  document.getElementById('sp-new-fields').style.display = isNew?'block':'none';
  document.getElementById('sp-existing-fields').style.display = isNew?'none':'block';
  const btnNew = document.getElementById('sp-tab-new');
  const btnEx  = document.getElementById('sp-tab-existing');
  btnNew.className = isNew ? 'btn btn-accent' : 'btn btn-ghost';
  btnNew.style.cssText = isNew ? '' : 'font-size:11px;padding:5px 12px;background:var(--sl-bg3);border:1px solid var(--sl-border2);color:var(--sl-text2)';
  btnEx.className  = isNew ? 'btn btn-ghost' : 'btn btn-accent';
  btnEx.style.cssText = isNew ? 'font-size:11px;padding:5px 12px;background:var(--sl-bg3);border:1px solid var(--sl-border2);color:var(--sl-text2)' : '';
}

function openSaveProject(){
  if(!hasFeature('saveProjects')){ showUpgrade('Save Projects'); return; }
  document.getElementById('sp-client').value = _resultClientName || '';
  document.getElementById('sp-status').value='draft';
  document.getElementById('sp-notes').value='';
  document.getElementById('sp-cutlist-name').value='';
  document.getElementById('sp-existing-cutlist-name').value='';
  // Populate existing projects dropdown — keyed by client name
  const sel = document.getElementById('sp-existing-proj');
  sel.innerHTML = '<option value="">-- Select a client/project --</option>' +
    projects.map(p=>`<option value="${p.id}">${esc(p.client||p.name)}${p.cutlists?.length?' ('+p.cutlists.length+' cut lists)':''}</option>`).join('');
  switchSaveTab('new');
  document.getElementById('save-proj-modal').style.display='flex';
  setTimeout(()=>document.getElementById('sp-client').focus(),100);
}
function closeSaveProject(){document.getElementById('save-proj-modal').style.display='none'}

function saveProject(){
  if(!hasFeature('saveProjects')){ showUpgrade('Save Projects'); return; }
  const cutlistData = {
    id: Date.now(),
    name: '',
    date: new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
    panels: JSON.parse(JSON.stringify(panelRows)),
    stocks: JSON.parse(JSON.stringify(stockRows)),
    kerf:   +document.getElementById('kerf').value||3,
    matchMat: document.getElementById('mat-toggle').checked,
  };

  const isNew = document.getElementById('sp-existing-fields').style.display==='none';

  if(isNew){
    const client = document.getElementById('sp-client').value.trim();
    if(!client){alert('Please enter a client name.');return;}
    // Auto-assign cut list name if blank
    const clNameEntered = document.getElementById('sp-cutlist-name').value.trim();
    cutlistData.name = clNameEntered || 'Cut List 1';
    const proj={
      id: Date.now()+1,
      name: client,           // project name = client name
      client,
      status: document.getElementById('sp-status').value,
      notes:  document.getElementById('sp-notes').value.trim(),
      date:   new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
      cutlists: [cutlistData],
    };
    projects.unshift(proj);
    localStorage.setItem(projectsKey(), JSON.stringify(projects));
    closeSaveProject();
    alert(`Saved: ${client} → "${cutlistData.name}"`);
  } else {
    const projId = +document.getElementById('sp-existing-proj').value;
    if(!projId){alert('Please select a client/project.');return;}
    const proj = projects.find(p=>p.id===projId);
    if(!proj){alert('Project not found.');return;}
    if(!proj.cutlists) proj.cutlists=[];
    // Auto-assign serial number if no name entered
    const clNameEntered = document.getElementById('sp-existing-cutlist-name').value.trim();
    const nextNum = proj.cutlists.length + 1;
    cutlistData.name = clNameEntered || `Cut List ${nextNum}`;
    proj.cutlists.push(cutlistData);
    localStorage.setItem(projectsKey(), JSON.stringify(projects));
    closeSaveProject();
    alert(`Saved: ${proj.client||proj.name} → "${cutlistData.name}"`);
  }
}

function openProjects(){
  const s=document.getElementById('proj-search');
  if(s) s.value='';
  renderProjectsList();
  document.getElementById('projects-modal').style.display='flex';
}
function closeProjects(){document.getElementById('projects-modal').style.display='none'}

function renderProjectsList(){
  const q=(document.getElementById('proj-search')?.value||'').toLowerCase();
  const filtered=projects.filter(p=>
    p.name.toLowerCase().includes(q)||
    (p.client||'').toLowerCase().includes(q)
  );
  const el=document.getElementById('projects-list');
  if(!filtered.length){
    el.innerHTML=`<div class="proj-empty"><h3>${projects.length?'No projects match':'No projects yet'}</h3><p>${projects.length?'Try a different search':'Save your first project using the Save Project button'}</p></div>`;
    return;
  }
  const statusLabel={draft:'Draft',inprogress:'In Progress',done:'Completed'};
  const statusClass={draft:'proj-status-draft',inprogress:'proj-status-inprogress',done:'proj-status-done'};

  el.innerHTML=filtered.map(p=>{
    const cutlists = p.cutlists||[];
    // Migrate old format (panels/stocks directly on project)
    if(!cutlists.length && p.panels){
      cutlists.push({id:p.id, name:'Cut List 1', date:p.date, panels:p.panels, stocks:p.stocks, kerf:p.kerf, matchMat:p.matchMat, allowRot:p.allowRot});
    }
    const cutlistHtml = cutlists.map((cl,i)=>`
      <div class="cutlist-item">
        <div style="font-size:18px">📋</div>
        <div style="flex:1">
          <div class="cutlist-name">${esc(cl.name||'Cut List '+(i+1))}</div>
          <div class="cutlist-meta">📦 ${cl.panels?.length||0} panels · 🪵 ${cl.stocks?.length||0} stocks · ${cl.date||''}</div>
        </div>
        <button class="proj-act-btn proj-act-load" onclick="loadCutList(${p.id},${cl.id})">▶ Load</button>
        <button class="proj-act-btn proj-act-del" onclick="deleteCutList(${p.id},${cl.id})">🗑</button>
      </div>`).join('');

    return `<div class="proj-card" id="proj-${p.id}">
      <div class="proj-card-top">
        <div>
          <div class="proj-card-name">${esc(p.name)}</div>
          ${p.client?`<div class="proj-card-client">👤 ${esc(p.client)}</div>`:''}
        </div>
        <span class="proj-status ${statusClass[p.status]||'proj-status-draft'}">${statusLabel[p.status]||'Draft'}</span>
      </div>
      <div class="proj-card-meta">
        <span class="proj-card-date">📅 ${p.date}</span>
        <span class="proj-card-counts">📋 ${cutlists.length} cut list${cutlists.length!==1?'s':''}</span>
      </div>
      ${p.notes?`<div class="proj-notes">${esc(p.notes)}</div>`:''}
      <div class="proj-expanded" id="proj-exp-${p.id}" style="display:none">
        ${cutlistHtml}
        <button class="add-cutlist-btn" onclick="addCutListToProject(${p.id})">+ Add Cut List</button>
      </div>
      <div class="proj-card-actions">
        <button class="proj-expand-btn" onclick="toggleProject(${p.id})">📋 Cut Lists (${cutlists.length})</button>
        <button class="proj-act-btn proj-act-dup" onclick="duplicateProject(${p.id})">⧉ Duplicate</button>
        <button class="proj-act-btn proj-act-del" onclick="deleteProject(${p.id})">🗑 Delete</button>
      </div>
    </div>`;
  }).join('');
}

function toggleProject(id){
  const el = document.getElementById(`proj-exp-${id}`);
  if(!el) return;
  const open = el.style.display==='none';
  el.style.display = open ? 'block' : 'none';
  // Update button text
  const card = document.getElementById(`proj-${id}`);
  const btn = card?.querySelector('.proj-expand-btn');
  const p = projects.find(p=>p.id===id);
  const count = (p?.cutlists||[]).length;
  if(btn) btn.textContent = (open?'▲':'📋') + ` Cut Lists (${count})`;
}

function loadCutList(projId, clId){
  const proj = projects.find(p=>p.id===projId);
  if(!proj) return;
  const cutlists = proj.cutlists || (proj.panels?[{...proj, id:proj.id}]:[]);
  const cl = cutlists.find(c=>c.id===clId);
  if(!cl) return;
  if(!confirm(`Load "${cl.name||'Cut List'}" from "${proj.name}"?`)) return;
  panelRows = JSON.parse(JSON.stringify(cl.panels||[]));
  stockRows = JSON.parse(JSON.stringify(cl.stocks||[]));
  idC = Math.max(...(panelRows.map(r=>r.id)||[0]),...(stockRows.map(r=>r.id)||[0]),idC)+1;
  document.getElementById('kerf').value = cl.kerf||3;
  document.getElementById('mat-toggle').checked = cl.matchMat!==false;
  renderPanels(); renderStock();
  closeProjects();
  document.getElementById('results').style.display='none';
  document.getElementById('empty-state').style.display='flex';
}

function deleteCutList(projId, clId){
  const proj = projects.find(p=>p.id===projId);
  if(!proj||!proj.cutlists) return;
  const cl = proj.cutlists.find(c=>c.id===clId);
  if(!cl||!confirm(`Delete cut list "${cl.name}"?`)) return;
  proj.cutlists = proj.cutlists.filter(c=>c.id!==clId);
  localStorage.setItem(projectsKey(), JSON.stringify(projects));
  renderProjectsList();
}

function addCutListToProject(projId){
  if(!hasFeature('multipleCutLists')){ showUpgrade('Multiple Cut Lists'); return; }
  // Pre-fill existing project tab and select this project
  openSaveProject();
  switchSaveTab('existing');
  const sel = document.getElementById('sp-existing-proj');
  if(sel) sel.value = projId;
}

function loadProject(id){
  // Legacy: load first cut list of project
  const p = projects.find(p=>p.id===id);
  if(!p) return;
  const cutlists = p.cutlists || (p.panels?[p]:[]);
  if(!cutlists.length){ alert('No cut lists in this project.'); return; }
  loadCutList(id, cutlists[0].id);
}

function duplicateProject(id){
  const p=projects.find(p=>p.id===id);if(!p)return;
  const copy={...JSON.parse(JSON.stringify(p)),id:Date.now(),name:p.name+' (Copy)',date:new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};
  projects.unshift(copy);
  localStorage.setItem(projectsKey(),JSON.stringify(projects));
  renderProjectsList();
}

function deleteProject(id){
  const p=projects.find(p=>p.id===id);if(!p)return;
  if(!confirm(`Delete "${p.name}" and all its cut lists? This cannot be undone.`))return;
  projects=projects.filter(p=>p.id!==id);
  localStorage.setItem(projectsKey(),JSON.stringify(projects));
  renderProjectsList();
}

