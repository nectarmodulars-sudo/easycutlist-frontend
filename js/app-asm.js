// ============================================================================
// ASM MODULE — Auto Size Module
// 3-Panel Layout: Catalogue | Size Building Space (SBS) | Ready Items (RIS)
// ============================================================================

const ASMModule = (() => {
  // ── Configuration ──
  // Auto-detect API base: localhost in dev, production URL when deployed
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/asm'
    : 'https://api.easycutlist.com/asm';

  // ── State ──
  let catalogue = [];          // All available items (left panel)
  let currentCatalogue = '';   // active catalogue key
  let catalogueList = [];      // accessible catalogues
  let sbsItems = [];           // Items currently being built (middle panel)
  let readyItems = [];         // Saved/finalized items (right panel)
  let risSortMode = 'none';    // 'none' | 'room' | 'item'

  function getSortedReady() {
    if (risSortMode === 'none') return readyItems.map((it, i) => ({ it, origIdx: i }));
    const arr = readyItems.map((it, i) => ({ it, origIdx: i }));
    const key = risSortMode === 'room'
      ? (x => (x.it.roomName || '\uffff').toLowerCase())   // blank rooms sort last
      : (x => (x.it.itemName || '').toLowerCase());
    return arr.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.origIdx - b.origIdx);
  }

  function setRisSort(mode) {
    risSortMode = mode;
    renderReadyItems();
  }
  let activeItemSchemas = {};  // Cache of item schemas by id
  let currentProjectId = null;
  let currentProjectName = '';
  let currentClientName = '';
  function syncProjectName() {
    const el = document.getElementById('asm-project-name');
    if (!el) return;
    const nm = currentProjectName || 'Untitled';
    el.textContent = currentClientName ? (currentClientName + ' · ' + nm) : nm;
  }
  let asmPlan = 'free'; // 'free' | 'pro' | 'expired'
  const FREE_ITEM_ID = 'standard-sliding-wardrobe'; // Only this item is free

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  function init() {
    console.log('ASMModule v5 initialized — auth fix applied');
  }

  // ========================================================================
  // OPEN / CLOSE
  // ========================================================================

  async function openASM() {
    let container = document.getElementById('asm-fullpage');
    if (!container) {
      container = buildPageShell();
      document.body.appendChild(container);
      injectStyles();
    }
    container.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Backup binding for Review Check (in case inline handler is stripped/cached)
    if (!container._reviewBound) {
      container.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-review-check]');
        if (btn) { e.preventDefault(); reviewCheck(); }
      });
      container._reviewBound = true;
    }

    await loadCatalogueList();
    await loadCatalogue();
    renderCatalogue();
    renderSBS();
    renderReadyItems();

    // Show user email if logged in
    const emailEl = document.getElementById('asm-user-email');
    if (emailEl && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
      emailEl.textContent = CURRENT_USER.email || '';
    }

    // Check ASM plan status
    await checkASMPlan();
  }

  function closeASM() {
    const container = document.getElementById('asm-fullpage');
    if (container) container.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ========================================================================
  // PAGE SHELL (3-panel layout)
  // ========================================================================

  function buildPageShell() {
    const el = document.createElement('div');
    el.id = 'asm-fullpage';
    el.innerHTML = `
      <div class="asm-topbar">
        <div class="asm-title">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAIAAAD9b0jDAAAD1UlEQVR42o1Vz2sdVRg95947P/KDvhTTSjCSFlNLhBbtsquCrkQ3iiiImyIIuhFcKbhxIV2IO7sQseBWBKH+Da5KF6UQxJ9Nk0pTheQlTWbezHzHxbyZN/OShcMsZu7c79zvO9/5zvDy4AqOXAQA6Lh1/Y9tbrwoSQLU7FOzVZ0b6iOoh6h2LUAAAZLjsDodEhgvHVMDxnn0cp2UEer1GqgJlCeqipX1UabgCe+lcVHs4ob6SU0WjsoLjnIOTpjzqnM+ltyywnDo40RJLLO2SAIKHVrkiCzn6VPl+1f/vfhcFrljG1QHozTcWU+vf/vEw+2QJjJNqAjtbhJlycGJ6vq1rZW1DI/9pBFsodoVAVw+l184n139cHlv34cgjXHh6i6BcA77B+71V4Yra1n2KCpyliXhML494AjWr6pKV4x4uO2fPp+98eru4wM6TjoZevpyeubMSIVzDlGMssRfGzGP6FPC8lIRxTKjCrd6duRcj6fQp40QKDiv3X330adLd9bTNBnXpbrNDnnuLqxlX362NZeKAkCyJ5LQ5b7tRJixWz/Pr/+W3PzuXpqYGQRCAuEd8hFfu7py6/bciy8Na3GrkZU6oGMtsCNCE+MIt+/OkJAQRQBQjEBHQFHUjhzR5CmIYFs+p0dYCEG7Q3f9xkkz0mH7UQBw+lQpg3PYHfrgNVUhm5fQh2qPV1Hg1GL5440NEm6h+uTjpyB9fu2B7XgAL799ZlRw7Bzqh6sHSk7OZf3ZDHRwxqoCABis7syxg4u6bQrd8e5bDgGaSIPZOMoqmE1z1Z7Q0MHQgevtFBC8kkSAkJhzAORSxZlAed9Vrbr4agxl6kgACNTO0N27H0eR/H51mBHgw8242vOlcXfPe9dlalqnmuaIKA/cpRcOVs+O3npvOU0ksCwB4M13zpDIc6yezS89f1geuDBr6vCndkwbYajxblUVTg7s6y+2NjajmhZ2dkhcWS6SGY0yqCuZRpqh03GY4c/7MWPIWOQIQeeezY+4qUBUuStymJEx/rgXVTaxMAJu4qbi3Kz98NNg89ckXSyiWN4BBVACJVG2D0RB7xVFSheLB78n398czM2a1TZQp3x5cIUTl8JhxqUniw/e/efiWh5c56d15CqNd39JvvpmcfPvaCY1M06S7YKOTWjEYsSFhcr7CV8iWHtKo5yqws6OjyIkicy6Hs7Q0acImiGOlMbKM07aKjUC6elvft4kNqPRaL2dqPbHV/fPBOenpkutttsQGTt/YrWDGto0NGWrmqJzgqgjHsxmCOsI1/oe+wHHVNCxJDV2qinfkAT8B++6/aS1MZ2hAAAAAElFTkSuQmCC" width="28" height="28" style="border-radius:6px">
          <span>Easy<span style="color:#ECB22E">CutList</span> AUTO SIZE MODULE (ASM)</span>
          <span id="asm-project-name" style="margin-left:14px;padding-left:14px;border-left:1px solid rgba(255,255,255,.2);font-size:13px;font-weight:500;color:rgba(255,255,255,.75)">Untitled</span>
        </div>
        <div class="asm-topbar-actions">
          <span id="asm-user-email" style="font-size:11px;color:rgba(255,255,255,.5);margin-right:8px"></span>
          <span id="asm-plan-badge" style="font-size:10px;padding:2px 8px;border-radius:3px;font-weight:700;margin-right:4px"></span>
          <button class="asm-top-btn" onclick="ASMModule.closeASM()">← Optimizer</button>
          <button class="asm-top-btn" onclick="ASMModule.showProjects()">My ASM Projects</button>
          <button class="asm-top-btn asm-save-btn" onclick="ASMModule.saveProject()">Save</button>
          <button class="asm-top-btn" id="asm-upgrade-btn" onclick="ASMModule.showPricing()" style="background:rgba(236,178,46,.3);color:#ECB22E">UPGRADE</button>
          <button class="asm-close" onclick="ASMModule.closeASM()" title="Close">✕</button>
        </div>
      </div>

      <div class="asm-body">
        <!-- LEFT: Catalogue -->
        <div class="asm-col asm-catalogue">
          <div class="asm-col-head" style="display:block">
            <div style="margin-bottom:6px">CATALOGUE SPACE (CS)</div>
            <select id="asm-cat-select" onchange="ASMModule.switchCatalogue(this.value)" style="width:100%;background:#222529;border:0.5px solid #3A3D42;border-radius:8px;color:#fff;font-size:13px;font-family:inherit;padding:8px 10px;box-sizing:border-box;cursor:pointer"></select>
          </div>
          <input type="text" id="asm-cat-search" class="asm-search"
                 placeholder="Search items…" oninput="ASMModule.filterCatalogue(this.value)">
          <div id="asm-catalogue-list" class="asm-cat-list"></div>
        </div>

        <!-- MIDDLE: Size Building Space -->
        <div class="asm-col asm-sbs">
          <div class="asm-col-head" style="display:flex;align-items:center;justify-content:space-between">
            <span>SIZE BUILDING SPACE (SBS)</span>
            <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#7A7D82">font
              <button onclick="ASMModule.sbsFont(-1)" style="width:22px;height:22px;background:#2A2D31;border:1px solid #3A3D42;border-radius:4px;color:#fff;cursor:pointer">−</button>
              <span id="asm-sbs-font-val" style="min-width:20px;text-align:center;color:#ECB22E;font-weight:700">14</span>
              <button onclick="ASMModule.sbsFont(1)" style="width:22px;height:22px;background:#2A2D31;border:1px solid #3A3D42;border-radius:4px;color:#fff;cursor:pointer">+</button>
            </span>
          </div>
          <div id="asm-cat-banner" style="padding:14px 16px;border-bottom:1px solid #2A2D31;display:none;align-items:center;gap:14px;flex-wrap:wrap">
            <div id="asm-cat-banner-name" style="font-size:21px;font-weight:700;color:#fff;letter-spacing:-.2px"></div>
            <span id="asm-cat-banner-desc" style="display:none;background:rgba(236,178,46,.14);color:#ECB22E;font-size:14px;font-weight:600;padding:5px 14px;border-radius:20px"></span>
          </div>
          <div id="asm-sbs-body" class="asm-sbs-body"></div>
        </div>

        <!-- RIGHT: Ready Items -->
        <div class="asm-col asm-ris">
          <div class="asm-col-head" style="display:flex;align-items:center;justify-content:space-between">
            <span>READY ITEMS SPACE (RIS)</span>
            <span style="display:flex;align-items:center;gap:6px">
              <select id="asm-ris-sort" onchange="ASMModule.setRisSort(this.value)" title="Sort" style="background:#2A2D31;border:1px solid #3A3D42;color:#E8E8E8;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer">
                <option value="none">Sort: Default</option>
                <option value="room">Sort: Room</option>
                <option value="item">Sort: Item</option>
              </select>
              <button onclick="ASMModule.showImportModal()" title="Import sizes from file" style="background:rgba(236,178,46,.2);color:#ECB22E;border:none;border-radius:6px;width:26px;height:26px;font-size:18px;line-height:1;cursor:pointer">+</button>
            </span>
          </div>
          <div id="asm-ris-list" class="asm-ris-list"></div>
          <div class="asm-ris-foot">
            <button class="asm-btn" data-review-check style="background:#ECB22E;color:#111;font-weight:700;transition:background .15s" onmouseover="this.style.background='#F5C443'" onmouseout="this.style.background='#ECB22E'" onclick="ASMModule.reviewCheck()">Review Check</button>
            <button class="asm-btn asm-btn-ghost" onclick="ASMModule.clearReady()">Clear</button>
            <button class="asm-btn asm-btn-secondary" onclick="ASMModule.exportToPDF()">Export to PDF</button>
            <button class="asm-btn asm-btn-primary" onclick="ASMModule.exportReady()">Export to Optimizer</button>
          </div>
        </div>
      </div>

      <!-- Image Modal -->
      <div class="asm-modal-overlay" id="asm-modal" onclick="if(event.target===this)ASMModule.closeImageModal()">
        <div class="asm-modal-content">
          <button class="asm-modal-close" onclick="ASMModule.closeImageModal()">✕</button>
          <button id="asm-modal-prev" onclick="ASMModule.modalNav(-1)" style="display:none;position:absolute;left:10px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;font-size:22px;cursor:pointer;align-items:center;justify-content:center;z-index:2">‹</button>
          <button id="asm-modal-next" onclick="ASMModule.modalNav(1)" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;font-size:22px;cursor:pointer;align-items:center;justify-content:center;z-index:2">›</button>
          <img id="asm-modal-image" class="asm-modal-image" src="" alt="Reference">
        </div>
      </div>
    `;
    return el;
  }

  // ========================================================================
  // CATALOGUE (Left Panel)
  // ========================================================================

  function authH() {
    try { const h = (typeof authHeader === 'function') ? authHeader() : null; return h || {}; } catch(e) { return {}; }
  }

  async function loadCatalogueList() {
    try {
      const res = await fetch(`${API_BASE}/catalogues`, { headers: authH() });
      const data = await res.json();
      if (data.success) {
        catalogueList = data.catalogues || [];
        if (!currentCatalogue && catalogueList.length) currentCatalogue = catalogueList[0].key;
        renderCatalogueDropdown();
        updateCatBanner();
      }
    } catch (err) { console.error('loadCatalogueList error:', err); }
  }

  function updateCatBanner() {
    const banner = document.getElementById('asm-cat-banner');
    if (!banner) return;
    const cat = catalogueList.find(c => c.key === currentCatalogue);
    const nameEl = document.getElementById('asm-cat-banner-name');
    const descEl = document.getElementById('asm-cat-banner-desc');
    if (!cat) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    nameEl.textContent = cat.name || '';
    descEl.textContent = cat.description || '';
    descEl.style.display = cat.description ? 'inline-block' : 'none';
  }

  function renderCatalogueDropdown() {
    const sel = document.getElementById('asm-cat-select');
    if (!sel) return;
    sel.innerHTML = catalogueList.map(c =>
      `<option value="${c.key}" ${c.key===currentCatalogue?'selected':''}>${c.name}${c.standard?'':' ⭐'}</option>`
    ).join('');
  }

  async function switchCatalogue(key) {
    if (key === currentCatalogue) return;
    currentCatalogue = key;
    catalogue = [];
    updateCatBanner();
    await loadCatalogue(true);
    renderCatalogue();
  }

  async function loadCatalogue(force) {
    if (catalogue.length > 0 && !force) return;
    if (!currentCatalogue) { await loadCatalogueList(); }
    try {
      const res = await fetch(`${API_BASE}/items?catalogue=${encodeURIComponent(currentCatalogue)}`, { headers: authH() });
      const data = await res.json();
      if (data.success) {
        catalogue = data.items;
      } else {
        showToast('Failed to load catalogue', 'error');
      }
    } catch (err) {
      console.error('loadCatalogue error:', err);
      showToast('Cannot reach server. Is backend running?', 'error');
    }
  }

  function renderCatalogue(filter = '') {
    const list = document.getElementById('asm-catalogue-list');
    if (!list) return;

    // Group items by category
    const groups = {};
    catalogue
      .filter(it => !filter || it.name.toLowerCase().includes(filter.toLowerCase()))
      .forEach(it => {
        const cat = (it.category || 'other').toUpperCase();
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(it);
      });

    if (Object.keys(groups).length === 0) {
      list.innerHTML = `<div class="asm-empty">No items found</div>`;
      return;
    }

    let html = '';
    for (const [cat, items] of Object.entries(groups)) {
      html += `<div class="asm-cat-group-label" style="cursor:pointer" onclick="ASMModule.showCategoryGallery('${cat.replace(/'/g,"")}')" title="Click to view all ${cat}">${cat} <span style="font-size:10px;color:#7A7D82">▦</span></div>`;
      items.forEach(it => {
        const isFree = !!it.is_free;
        const isLocked = asmPlan !== 'pro' && !isFree;
        html += `
          <div class="asm-cat-item ${isLocked ? 'asm-cat-locked' : ''}" onclick="ASMModule.addToSBS('${it.id}')" title="${isLocked ? 'PRO only — click to upgrade' : (it.description || '')}">
            <span class="asm-cat-item-name">${isLocked ? '🔒 ' : ''}${it.name}</span>
            <span class="asm-cat-item-add">${isLocked ? '🔒' : '+'}</span>
          </div>`;
      });
    }
    list.innerHTML = html;
  }

  function filterCatalogue(value) {
    renderCatalogue(value);
  }

  // ========================================================================
  // SIZE BUILDING SPACE (Middle Panel)
  // ========================================================================

  function showCategoryGallery(cat) {
    const body = document.getElementById('asm-sbs-body');
    if (!body) return;
    const items = catalogue.filter(it => (it.category || 'other').toUpperCase() === cat);
    if (!items.length) { body.innerHTML = '<div class="asm-sbs-empty">No items in ' + cat + '</div>'; return; }
    let html = '<div style="padding:16px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><button onclick="ASMModule.exitGallery()" style="background:#2A2D31;border:1px solid #3A3D42;color:#fff;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">← Back</button><span style="font-size:14px;font-weight:700;color:#ECB22E">' + cat + '</span></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">';
    items.forEach(it => {
      const isLocked = asmPlan !== 'pro' && !it.is_free;
      const thumb = it.mainImage && it.mainImage.base64
        ? `<img src="${it.mainImage.base64}" style="width:100%;height:110px;object-fit:contain;background:#fff;border-radius:6px">`
        : `<div style="width:100%;height:110px;display:flex;align-items:center;justify-content:center;background:#222529;border-radius:6px;color:#555;font-size:30px">📦</div>`;
      html += `<div onclick="ASMModule.addToSBS('${it.id}')" style="cursor:pointer;background:#1e2024;border:1px solid #2A2D31;border-radius:8px;padding:10px;transition:border-color .15s" onmouseover="this.style.borderColor='#ECB22E'" onmouseout="this.style.borderColor='#2A2D31'">
        ${thumb}
        <div style="margin-top:8px;font-size:13px;color:#E8E8E8;text-align:center">${isLocked ? '🔒 ' : ''}${it.name}</div>
      </div>`;
    });
    html += '</div></div>';
    body.innerHTML = html;
  }

  function exitGallery() { renderSBS(); }

  async function addToSBS(itemId) {
    // Plan gating — free users can only use free-flagged items
    const catItem = catalogue.find(x => x.id === itemId);
    const itemIsFree = catItem ? !!catItem.is_free : false;
    if (asmPlan !== 'pro' && !itemIsFree) {
      showPricing();
      return;
    }

    // Fetch schema if not cached
    if (!activeItemSchemas[itemId]) {
      try {
        const res = await fetch(`${API_BASE}/item/${itemId}?catalogue=${encodeURIComponent(currentCatalogue)}`, { headers: authH() });
        if (res.status === 403) { showPricing(); return; }
        const data = await res.json();
        if (!data.success) {
          showToast('Failed to load item', 'error');
          return;
        }
        activeItemSchemas[itemId] = data;
      } catch (err) {
        console.error('addToSBS error:', err);
        showToast('Cannot load item', 'error');
        return;
      }
    }

    const schema = activeItemSchemas[itemId];

    // Build a fresh instance with default inputs
    const instanceId = 'sbs_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const inputs = {};
    schema.inputs.forEach(inp => { inputs[inp.key] = inp.default; });

    const instance = {
      instanceId,
      itemId,
      itemName: schema.name,
      catalogueKey: currentCatalogue,
      inputs,
      outputs: []
    };

    sbsItems.push(instance);
    renderSBS();

    // Calculate immediately with defaults
    await recalc(instanceId);

    // Scroll to the new item
    setTimeout(() => {
      const el = document.getElementById(instanceId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  let _sbsFont = 14;
  function sbsFont(delta) {
    _sbsFont = Math.max(10, Math.min(22, _sbsFont + delta));
    const body = document.getElementById('asm-sbs-body');
    if (body) body.style.setProperty('--sbs-font', _sbsFont + 'px');
    const v = document.getElementById('asm-sbs-font-val');
    if (v) v.textContent = _sbsFont;
  }

  function renderSBS() {
    const body = document.getElementById('asm-sbs-body');
    if (!body) return;

    if (sbsItems.length === 0) {
      body.innerHTML = `
        <div class="asm-sbs-empty">
          <div class="asm-sbs-empty-icon">📐</div>
          <div>Click an item from the Catalogue<br>to start building sizes</div>
        </div>`;
      return;
    }

    body.innerHTML = sbsItems.map(inst => renderSBSItem(inst)).join('');
  }

  function renderManualItem(inst, schema) {
    if (!inst.manualRows) inst.manualRows = Array.from({ length: 15 }, () => ({ w:'', h:'', qty:'', material:'', remark:'' }));
    const inputsHtml = schema.inputs.map(inp => {
      const val = inst.inputs[inp.key];
      let control;
      if (inp.type === 'number') control = `<input type="number" value="${val}" oninput="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.value,'number')">`;
      else control = `<input type="text" value="${val == null ? '' : val}" oninput="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.value,'text')">`;
      return `<div class="asm-input-row"><label>${inp.label}</label>${control}</div>`;
    }).join('');

    const imagesHtml = schema.referenceImages && schema.referenceImages.length > 0
      ? `<div class="asm-ref-images">${schema.referenceImages.map((img, ii) => `<div class="asm-ref-image-item" onclick="ASMModule.openImageModal('${inst.instanceId}',${ii})"><img src="${img.base64}"><div class="asm-ref-label">${img.label}</div></div>`).join('')}</div>` : '';

    const rowsHtml = inst.manualRows.map((row, idx) => `
      <tr>
        <td style="text-align:center;color:#7A7D82">${idx+1}</td>
        <td><input class="asm-cell asm-cell-num" type="number" value="${row.w}" onchange="ASMModule.editManualRow('${inst.instanceId}',${idx},'w',this.value)"></td>
        <td><input class="asm-cell asm-cell-num" type="number" value="${row.h}" onchange="ASMModule.editManualRow('${inst.instanceId}',${idx},'h',this.value)"></td>
        <td><input class="asm-cell asm-cell-num" type="number" value="${row.qty}" onchange="ASMModule.editManualRow('${inst.instanceId}',${idx},'qty',this.value)"></td>
        <td><input class="asm-cell" value="${row.material||''}" readonly style="color:#9A9DA2"></td>
        <td><input class="asm-cell asm-cell-remark" value="${row.remark||''}" readonly style="color:#9A9DA2"></td>
      </tr>`).join('');

    return `
      <div class="asm-sbs-item" id="${inst.instanceId}">
        <div class="asm-sbs-item-head">
          <span class="asm-sbs-item-title">${inst.itemName}</span>
          <button class="asm-sbs-item-remove" onclick="ASMModule.removeFromSBS('${inst.instanceId}')">✕</button>
        </div>
        <div class="asm-sbs-item-diagram-section" id="diagram_${inst.instanceId}">${imagesHtml}</div>
        <div style="margin:10px 16px"><label style="font-size:12px;color:#9A9DA2;margin-right:8px">Room Name (optional)</label><input type="text" value="${inst.roomName ? String(inst.roomName).replace(/"/g,'&quot;') : ''}" placeholder="e.g. Master Bedroom" oninput="ASMModule.setRoomName('${inst.instanceId}',this.value)" style="background:#2A2D31;border:1px solid #3A3D42;color:#E8E8E8;border-radius:6px;padding:6px 10px;font-size:13px;width:240px"></div>
        ${schema.notes ? `<div style="margin:10px 16px;padding:10px 12px;background:rgba(236,178,46,.1);border-left:3px solid #ECB22E;border-radius:4px;font-size:13px;color:#E8E8E8"><strong style="color:#ECB22E">Note:</strong> ${schema.notes}</div>` : ''}
        <div class="asm-sbs-item-inputs">${inputsHtml}</div>
        <div class="asm-sbs-item-outputs">
          <table class="asm-out-table" id="manual_tbody_wrap_${inst.instanceId}">
            <thead><tr><th>Sr</th><th>W</th><th>H</th><th>Qty</th><th>Material</th><th>Remark</th></tr></thead>
            <tbody id="manual_tbody_${inst.instanceId}">${rowsHtml}</tbody>
          </table>
          <button onclick="ASMModule.addManualRow('${inst.instanceId}')" style="margin:10px 0;background:#2A2D31;border:1px solid #3A3D42;color:#ECB22E;border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer">+ Add Row</button>
        </div>
        <div class="asm-sbs-item-actions">
          <button class="asm-btn asm-btn-ghost" onclick="ASMModule.removeFromSBS('${inst.instanceId}')">Cancel</button>
          <button class="asm-btn asm-btn-primary" onclick="ASMModule.saveToReady('${inst.instanceId}')">Save → Ready</button>
        </div>
      </div>`;
  }

  function addManualRow(instanceId) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;
    if (!inst.manualRows) inst.manualRows = [];
    inst.manualRows.push({ w:'', h:'', qty:'', material:'', remark:'' });
    renderSBS();
  }

  async function editManualRow(instanceId, idx, field, value) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst || !inst.manualRows[idx]) return;
    inst.manualRows[idx][field] = value;
    const row = inst.manualRows[idx];
    if (row.w && row.h) {
      try {
        const res = await fetch(`${API_BASE}/manual-row`, {
          method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authH()),
          body: JSON.stringify({ itemId: inst.itemId, inputs: inst.inputs, row, catalogue: inst.catalogueKey || currentCatalogue })
        });
        const data = await res.json();
        if (data.success) {
          row.material = data.material; row.remark = data.remark;
          // update only this row's material/remark cells
          const tbody = document.getElementById('manual_tbody_' + instanceId);
          if (tbody && tbody.rows[idx]) {
            tbody.rows[idx].cells[4].querySelector('input').value = data.material;
            tbody.rows[idx].cells[5].querySelector('input').value = data.remark;
          }
        }
      } catch (e) {}
    }
  }

  function renderSBSItem(inst) {
    const schema = activeItemSchemas[inst.itemId];
    if (!schema) return '';
    if (schema.manualEntry) return renderManualItem(inst, schema);

    // Build input fields
    const inputsHtml = schema.inputs.map(inp => {
      const val = inst.inputs[inp.key];
      let control = '';

      if (inp.type === 'number') {
        control = `<input type="number" value="${val}"
          min="${inp.min ?? ''}" max="${inp.max ?? ''}"
          oninput="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.value,'number')">`;
      } else if (inp.type === 'select') {
        control = `<select onchange="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.value,'select')">
          ${inp.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
        </select>`;
      } else if (inp.type === 'boolean') {
        control = `<label class="asm-switch">
          <input type="checkbox" ${val ? 'checked' : ''}
            onchange="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.checked,'boolean')">
          <span class="asm-slider"></span>
        </label>`;
      } else {
        control = `<input type="text" value="${val == null ? '' : val}"
          oninput="ASMModule.updateInput('${inst.instanceId}','${inp.key}',this.value,'text')">`;
      }

      return `
        <div class="asm-input-row">
          <label title="${inp.help || ''}">${inp.label}</label>
          ${control}
        </div>`;
    }).join('');

    // Build output table (with sub-item headings)
    const subDims = {};
    (inst.subItems || []).forEach(si => { subDims[si.name] = si; });
    let lastSub = undefined;
    const outputsHtml = inst.outputs.length === 0
      ? `<tr><td colspan="6" class="asm-out-empty">Fill inputs to calculate…</td></tr>`
      : inst.outputs.map((o, idx) => {
          let headerRow = '';
          if (o.subItem !== lastSub && o.subItem) {
            const d = subDims[o.subItem];
            const dimLine = d ? `${d.w||'-'} × ${d.h||'-'}${d.d? ' × '+d.d : ''}${d.qty? ' · Qty '+d.qty : ''}` : '';
            headerRow = `<tr><td colspan="6" style="background:#2A2D31;padding:8px 10px;border-top:2px solid #ECB22E">
              <span style="color:#ECB22E;font-weight:700;font-size:13px">${o.subItem}</span>
              ${dimLine ? `<span style="color:#9A9DA2;font-size:11px;margin-left:10px">${dimLine}</span>` : ''}
            </td></tr>`;
          }
          lastSub = o.subItem;
          return headerRow + `
          <tr class="${o.conditional ? 'asm-out-conditional' : ''}">
            <td class="asm-out-name"><input class="asm-cell" value="${o.component}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'component',this.value)"></td>
            <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.w}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'w',this.value)"></td>
            <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.h}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'h',this.value)"></td>
            <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.qty}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'qty',this.value)"></td>
            <td><input class="asm-cell" value="${o.color || ''}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'color',this.value)"></td>
            <td class="asm-out-remark"><input class="asm-cell asm-cell-remark" value="${o.remark || ''}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'remark',this.value)"></td>
          </tr>`;
        }).join('');

    // Build reference images HTML
    const imagesHtml = schema.referenceImages && schema.referenceImages.length > 0
      ? `<div class="asm-ref-images">
           ${schema.referenceImages.map((img, ii) => `
             <div class="asm-ref-image-item" onclick="ASMModule.openImageModal('${inst.instanceId}',${ii})">
               <img src="${img.base64}" alt="${img.label}" title="Click to enlarge">
               <div class="asm-ref-label">${img.label}</div>
             </div>
           `).join('')}
         </div>`
      : '';

    return `
      <div class="asm-sbs-item" id="${inst.instanceId}">
        <div class="asm-sbs-item-head">
          <span class="asm-sbs-item-title">${inst.itemName}</span>
          <button class="asm-sbs-item-remove" onclick="ASMModule.removeFromSBS('${inst.instanceId}')" title="Remove">✕</button>
        </div>

        <div class="asm-sbs-item-diagram-section" id="diagram_${inst.instanceId}">
          ${imagesHtml}
        </div>

        <div style="margin:10px 16px"><label style="font-size:12px;color:#9A9DA2;margin-right:8px">Room Name (optional)</label><input type="text" value="${inst.roomName ? String(inst.roomName).replace(/"/g,'&quot;') : ''}" placeholder="e.g. Master Bedroom" oninput="ASMModule.setRoomName('${inst.instanceId}',this.value)" style="background:#2A2D31;border:1px solid #3A3D42;color:#E8E8E8;border-radius:6px;padding:6px 10px;font-size:13px;width:240px"></div>

        ${schema.notes ? `<div style="margin:10px 16px;padding:10px 12px;background:rgba(236,178,46,.1);border-left:3px solid #ECB22E;border-radius:4px;font-size:13px;color:#E8E8E8"><strong style="color:#ECB22E">Note:</strong> ${schema.notes}</div>` : ''}

        <div class="asm-sbs-item-inputs">
          ${inputsHtml}
        </div>

        <div class="asm-sbs-item-outputs">
          <table class="asm-out-table">
            <thead>
              <tr>
                <th>Component</th><th>W</th><th>H</th><th>Qty</th><th>Color</th><th>Remark</th>
              </tr>
            </thead>
            <tbody>${outputsHtml}</tbody>
          </table>
          <div class="asm-sbs-item-summary">
            ${inst.outputs.length} components ·
            ${inst.outputs.reduce((a, o) => a + (o.qty || 0), 0)} total panels
          </div>
        </div>

        <div class="asm-sbs-item-actions">
          <button class="asm-btn asm-btn-ghost" onclick="ASMModule.removeFromSBS('${inst.instanceId}')">Cancel</button>
          <button class="asm-btn asm-btn-primary" onclick="ASMModule.saveToReady('${inst.instanceId}')">Save → Ready</button>
        </div>
      </div>`;
  }

  // Update a single input and recalc live (debounced)
  let recalcTimers = {};
  function setRoomName(instanceId, value) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;
    inst.roomName = value;
    // no re-render (avoid input focus loss); value persists on inst
  }
  function updateInput(instanceId, key, value, type) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;

    if (type === 'number') value = parseFloat(value) || 0;
    if (type === 'boolean') value = !!value;

    inst.inputs[key] = value;

    // Debounce recalc per instance (live on keystroke, but not flooding)
    clearTimeout(recalcTimers[instanceId]);
    recalcTimers[instanceId] = setTimeout(() => recalc(instanceId), 150);
  }

  async function recalc(instanceId) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;

    try {
      const res = await fetch(`${API_BASE}/calculate`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authH()),
        body: JSON.stringify({ itemId: inst.itemId, inputs: inst.inputs, catalogue: inst.catalogueKey || currentCatalogue })
      });
      const data = await res.json();

      if (data.success) {
        inst.outputs = data.outputs;
        inst.subItems = data.subItems || [];
        updateSBSItemOutputs(inst);
      } else {
        showToast(data.details || data.error || 'Calculation failed', 'error');
      }
    } catch (err) {
      console.error('recalc error:', err);
    }
  }

  // Update only the output table (don't re-render whole item — keeps focus in inputs)
  function updateSBSItemOutputs(inst) {
    const itemEl = document.getElementById(inst.instanceId);
    if (!itemEl) return;

    const tbody = itemEl.querySelector('.asm-out-table tbody');
    const summary = itemEl.querySelector('.asm-sbs-item-summary');

    if (tbody) {
      const subDims2 = {};
      (inst.subItems || []).forEach(si => { subDims2[si.name] = si; });
      let lastSub2 = undefined;
      tbody.innerHTML = inst.outputs.length === 0
        ? `<tr><td colspan="6" class="asm-out-empty">Fill inputs to calculate…</td></tr>`
        : inst.outputs.map((o, idx) => {
            let hr = '';
            if (o.subItem !== lastSub2 && o.subItem) {
              const d = subDims2[o.subItem];
              const dl = d ? `${d.w||'-'} × ${d.h||'-'}${d.d? ' × '+d.d : ''}${d.qty? ' · Qty '+d.qty : ''}` : '';
              hr = `<tr><td colspan="6" style="background:#2A2D31;padding:8px 10px;border-top:2px solid #ECB22E"><span style="color:#ECB22E;font-weight:700;font-size:13px">${o.subItem}</span>${dl?`<span style="color:#9A9DA2;font-size:11px;margin-left:10px">${dl}</span>`:''}</td></tr>`;
            }
            lastSub2 = o.subItem;
            return hr + `
            <tr class="${o.conditional ? 'asm-out-conditional' : ''}">
              <td class="asm-out-name"><input class="asm-cell" value="${o.component}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'component',this.value)"></td>
              <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.w}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'w',this.value)"></td>
              <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.h}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'h',this.value)"></td>
              <td class="asm-out-num"><input class="asm-cell asm-cell-num" type="number" value="${o.qty}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'qty',this.value)"></td>
              <td><input class="asm-cell" value="${o.color || ''}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'color',this.value)"></td>
              <td class="asm-out-remark"><input class="asm-cell asm-cell-remark" value="${o.remark || ''}" onchange="ASMModule.editOutput('${inst.instanceId}',${idx},'remark',this.value)"></td>
            </tr>`;
          }).join('');
    }

    if (summary) {
      summary.textContent =
        `${inst.outputs.length} components · ${inst.outputs.reduce((a, o) => a + (o.qty || 0), 0)} total panels`;
    }

    // Update diagram with reference images
    const diagramEl = document.getElementById('diagram_' + inst.instanceId);
    if (diagramEl) {
      const schema = activeItemSchemas[inst.itemId];
      const imagesHtml = schema && schema.referenceImages && schema.referenceImages.length > 0
        ? `<div class="asm-ref-images">
             ${schema.referenceImages.map((img, ii) => `
               <div class="asm-ref-image-item" onclick="ASMModule.openImageModal('${inst.instanceId}',${ii})">
                 <img src="${img.base64}" alt="${img.label}" title="Click to enlarge">
                 <div class="asm-ref-label">${img.label}</div>
               </div>
             `).join('')}
           </div>`
        : '';
      diagramEl.innerHTML = imagesHtml;
    }
  }

  // Edit a single output cell (manual override)
  async function recalcDependents(inst, idx, field, value) {
    const fmap = { w: 'w', h: 'h', qty: 'q' };
    const editedCell = inst.outputs[idx].cellRefs[fmap[field]];
    // Build current cellValues map from all outputs
    const cellValues = {};
    inst.outputs.forEach(o => {
      if (!o.cellRefs) return;
      if (o.cellRefs.w) cellValues[o.cellRefs.w] = o.w;
      if (o.cellRefs.h) cellValues[o.cellRefs.h] = o.h;
      if (o.cellRefs.q) cellValues[o.cellRefs.q] = o.qty;
    });
    cellValues[editedCell] = value;
    try {
      const res = await fetch(`${API_BASE}/recalc`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authH()),
        body: JSON.stringify({
          itemId: inst.itemId, inputs: inst.inputs, cellValues,
          editedCell, catalogue: inst.catalogueKey || currentCatalogue
        })
      });
      const data = await res.json();
      if (data.success && data.updates) {
        data.updates.forEach(u => {
          if (u.value === '' || u.value == null) return;
          // don't overwrite the just-edited cell
          if (inst.outputs[u.idx].cellRefs && inst.outputs[u.idx].cellRefs[fmap[u.field]] === editedCell) return;
          inst.outputs[u.idx][u.field] = u.value;
        });
        updateSBSItemOutputs(inst);
      }
    } catch (e) { console.error('recalc failed', e); }
  }

  function editOutput(instanceId, idx, field, value) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst || !inst.outputs[idx]) return;

    if (field === 'w' || field === 'h' || field === 'qty') {
      value = parseFloat(value) || 0;
      if (field === 'qty') value = Math.round(value);
    }

    inst.outputs[idx][field] = value;
    inst.outputs[idx]._edited = true;

    // Propagate to dependent cells (only for w/h/qty numeric edits)
    if ((field === 'w' || field === 'h' || field === 'qty') && inst.outputs[idx].cellRefs) {
      recalcDependents(inst, idx, field, value);
    }

    // Update summary
    const itemEl = document.getElementById(instanceId);
    if (itemEl) {
      const summary = itemEl.querySelector('.asm-sbs-item-summary');
      if (summary) {
        summary.textContent =
          `${inst.outputs.length} components · ${inst.outputs.reduce((a, o) => a + (o.qty || 0), 0)} total panels`;
      }
    }
  }

  function removeFromSBS(instanceId) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;

    if (inst._readyId) {
      // This was opened from RIS for editing — show options
      showCloseEditModal(instanceId, inst._readyId);
    } else {
      // New item, just remove
      sbsItems = sbsItems.filter(i => i.instanceId !== instanceId);
      renderSBS();
    }
  }

  function showCloseEditModal(instanceId, readyId) {
    let modal = document.getElementById('asm-close-edit-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-close-edit-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:380px;overflow:hidden';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42';
    hdr.innerHTML = '<h3 style="margin:0;color:#ECB22E;font-size:15px">Close Editing</h3>';
    box.appendChild(hdr);

    const body = document.createElement('div');
    body.style.cssText = 'padding:20px;color:#ABABAD;font-size:13px';
    body.textContent = 'What do you want to do with this item?';
    box.appendChild(body);

    const foot = document.createElement('div');
    foot.style.cssText = 'padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'asm-btn asm-btn-ghost';
    deleteBtn.style.cssText = 'color:#E01E5A;border-color:#E01E5A';
    deleteBtn.textContent = 'Delete from RIS';
    deleteBtn.onclick = function() {
      sbsItems = sbsItems.filter(i => i.instanceId !== instanceId);
      readyItems = readyItems.filter(i => i.readyId !== readyId);
      renderSBS(); renderReadyItems(); modal.remove();
    };

    const keepBtn = document.createElement('button');
    keepBtn.className = 'asm-btn asm-btn-ghost';
    keepBtn.textContent = 'Keep in RIS';
    keepBtn.onclick = function() {
      const ri = readyItems.find(i => i.readyId === readyId);
      if (ri) { ri._editing = false; ri._editInstanceId = null; }
      sbsItems = sbsItems.filter(i => i.instanceId !== instanceId);
      renderSBS(); renderReadyItems(); modal.remove();
    };

    const saveBtn = document.createElement('button');
    saveBtn.className = 'asm-btn asm-btn-primary';
    saveBtn.textContent = 'Save & Close';
    saveBtn.onclick = function() {
      const inst = sbsItems.find(i => i.instanceId === instanceId);
      const ri = readyItems.find(i => i.readyId === readyId);
      if (inst && ri) {
        ri.inputs = { ...inst.inputs };
        ri.outputs = inst.outputs.map(o => ({ ...o }));
        ri._editing = false; ri._editInstanceId = null;
      }
      sbsItems = sbsItems.filter(i => i.instanceId !== instanceId);
      renderSBS(); renderReadyItems(); modal.remove();
      showToast('Item updated', 'success');
    };

    foot.appendChild(deleteBtn);
    foot.appendChild(keepBtn);
    foot.appendChild(saveBtn);
    box.appendChild(foot);
    modal.appendChild(box);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ========================================================================
  // READY ITEMS (Right Panel)
  // ========================================================================

  function saveToReady(instanceId) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    if (!inst) return;

    const schema = activeItemSchemas[inst.itemId];
    // Manual items: convert filled manualRows -> outputs format so RIS/PDF/export work
    if (schema && schema.manualEntry) {
      const rows = (inst.manualRows || []).filter(r =>
        Number(r.w) > 0 && Number(r.h) > 0 && Number(r.qty) > 0);
      if (rows.length === 0) {
        showToast('Nothing to save — fill at least one row (W, H, Qty)', 'error');
        return;
      }
      inst.outputs = rows.map(r => ({
        component: r.material || inst.itemName,
        w: Number(r.w), h: Number(r.h), qty: Number(r.qty),
        color: r.material || '', remark: r.remark || ''
      }));
    }

    if (!inst.outputs || inst.outputs.length === 0) {
      showToast('Nothing to save — fill inputs first', 'error');
      return;
    }

    // Check if this was an edited item (has _readyId linking back to RIS)
    if (inst._readyId) {
      // Update existing ready item
      const existing = readyItems.find(i => i.readyId === inst._readyId);
      if (existing) {
        existing.inputs = { ...inst.inputs };
        existing.outputs = inst.outputs.map(o => ({ ...o }));
        existing.roomName = inst.roomName || '';
        existing._editing = false;
        existing._editInstanceId = null;
      }
    } else {
      // New item — add to ready
      readyItems.push({
        readyId: 'ready_' + Date.now(),
        itemId: inst.itemId,
        itemName: inst.itemName,
        roomName: inst.roomName || '',
        catalogueKey: inst.catalogueKey || currentCatalogue,
        inputs: { ...inst.inputs },
        outputs: inst.outputs.map(o => ({ ...o }))
      });
    }

    // Remove from SBS
    sbsItems = sbsItems.filter(i => i.instanceId !== instanceId);

    renderSBS();
    renderReadyItems();
    showToast(`${inst.itemName} saved to Ready Items`, 'success');
  }

  function renderReadyItems() {
    const list = document.getElementById('asm-ris-list');
    if (!list) return;

    if (readyItems.length === 0) {
      list.innerHTML = `<div class="asm-empty">No saved items yet.<br>Build items in SBS, then Save.</div>`;
      return;
    }

    list.innerHTML = getSortedReady().map(({ it, origIdx }) => {
      const totalPanels = it.outputs.reduce((a, o) => a + (o.qty || 0), 0);
      const isEditing = it._editing ? true : false;
      return `
        <div class="asm-ris-item" style="${isEditing ? 'border-color:#ECB22E;background:#2C2D30' : ''}">
          <div class="asm-ris-item-head">
            <span class="asm-ris-num">${origIdx + 1}</span>
            <span class="asm-ris-name" style="cursor:pointer" onclick="ASMModule.reopenReady('${it.readyId}')" title="Click to edit">${it.itemName}${it.roomName ? ' <span style="font-size:10px;background:rgba(236,178,46,.16);color:#ECB22E;padding:2px 7px;border-radius:10px;font-weight:700">'+it.roomName+'</span>' : ''}${isEditing ? ' <span style="font-size:9px;background:#ECB22E;color:#1A1D21;padding:1px 5px;border-radius:3px;font-weight:700">EDITING</span>' : ''}</span>
            <button class="asm-ris-remove" onclick="ASMModule.removeReady('${it.readyId}')" title="Remove">✕</button>
          </div>
          <div class="asm-ris-meta">
            ${it.imported ? 'Imported file' : (() => { const i = it.inputs; const w = i.width || i.w || i.W || '?'; const h = i.ht || i.h || i.H || i.height || '?'; const d = i.depth || i.d || i.D || '?'; return w + '×' + h + '×' + d + 'mm'; })()}
            · ${it.outputs.length} parts · ${totalPanels} panels
          </div>
        </div>`;
    }).join('');
  }

  async function reopenReady(readyId) {
    const it = readyItems.find(i => i.readyId === readyId);
    if (!it) return;
    if (it._editing) return; // Already editing

    if (!activeItemSchemas[it.itemId]) {
      try {
        const res = await fetch(`${API_BASE}/item/${it.itemId}?catalogue=${encodeURIComponent(it.catalogueKey||currentCatalogue)}`, { headers: authH() });
        const data = await res.json();
        if (data.success) activeItemSchemas[it.itemId] = data;
      } catch (e) { console.error(e); }
    }
    const instanceId = 'sbs_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // Mark as editing (keep in RIS but show status)
    it._editing = true;
    it._editInstanceId = instanceId;

    const newInst = { instanceId, itemId: it.itemId, itemName: it.itemName, roomName: it.roomName || '', catalogueKey: it.catalogueKey || currentCatalogue, inputs: { ...it.inputs }, outputs: it.outputs.map(o => ({ ...o })), _readyId: readyId };
    const rSchema = activeItemSchemas[it.itemId];
    if (rSchema && rSchema.manualEntry) {
      newInst.manualRows = it.outputs.map(o => ({ w: o.w, h: o.h, qty: o.qty, material: o.color || o.component || '', remark: o.remark || '' }));
    }
    sbsItems.push(newInst);
    renderSBS();
    renderReadyItems();
  }

  function removeReady(readyId) {
    readyItems = readyItems.filter(i => i.readyId !== readyId);
    renderReadyItems();
  }

  function reviewCheck(sortBy) {
    console.log('[reviewCheck] fired. readyItems =', readyItems.length);
    if (!readyItems || !readyItems.length) {
      const m = document.createElement('div');
      m.className = 'asm-review-overlay';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';
      m.innerHTML = '<div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;padding:28px 32px;text-align:center;max-width:360px"><div style="font-size:16px;color:#fff;margin-bottom:6px">No saved items yet</div><div style="font-size:13px;color:#9A9DA2;margin-bottom:18px">Build an item in SBS and click <b style="color:#ECB22E">Save to Ready</b> first.</div><button class="asm-btn asm-btn-primary" onclick="this.closest(\'.asm-review-overlay\').remove()">OK</button></div>';
      m.addEventListener('click', e => { if (e.target === m) m.remove(); });
      document.body.appendChild(m);
      return;
    }

    const mode = sortBy || risSortMode || 'none';
    let entries = readyItems.map((it, i) => ({ it, origIdx: i }));
    if (mode === 'room') entries.sort((a, b) => ((a.it.roomName || '\uffff').toLowerCase() < (b.it.roomName || '\uffff').toLowerCase() ? -1 : 1));
    else if (mode === 'item') entries.sort((a, b) => ((a.it.itemName || '').toLowerCase() < (b.it.itemName || '').toLowerCase() ? -1 : 1));

    const rows = entries.map(({ it, origIdx }) => {
      const i = it.inputs || {};
      const w = i.width || i.w || i.W || '-';
      const h = i.ht || i.h || i.H || i.height || '-';
      const d = i.depth || i.d || i.D || '-';
      const q = i.qty || i.Qty || i.quantity || 1;
      const room = it.roomName || '-';
      return `<tr>
        <td style="padding:8px 10px;color:#9A9DA2">${origIdx + 1}</td>
        <td style="padding:8px 10px;color:${it.roomName ? '#ECB22E' : '#666'}">${room}</td>
        <td style="padding:8px 10px;color:#fff">${it.itemName}</td>
        <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${w}</td>
        <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${h}</td>
        <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${d}</td>
        <td style="padding:8px 10px;text-align:right;color:#E8E8E8">${q}</td>
      </tr>`;
    }).join('');
    const arrow = m => mode === m ? ' <span style="color:#ECB22E">▼</span>' : '';

    const modal = document.createElement('div');
    modal.className = 'asm-review-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000';
    modal.innerHTML = `
      <div style="background:#1E2124;border:1px solid #3A3D42;border-radius:12px;width:min(720px,92vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid #2A2D31;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:17px;font-weight:700;color:#fff">Review Check — ${readyItems.length} item${readyItems.length > 1 ? 's' : ''}</div>
          <button onclick="this.closest('.asm-review-overlay').remove()" style="background:none;border:none;color:#9A9DA2;font-size:22px;cursor:pointer;line-height:1">✕</button>
        </div>
        <div style="overflow:auto;padding:0 4px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="position:sticky;top:0;background:#232629">
                <th style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600">#</th>
                <th onclick="this.closest('.asm-review-overlay').remove();ASMModule.reviewCheck('room')" style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600;cursor:pointer;user-select:none">Room${arrow('room')}</th>
                <th onclick="this.closest('.asm-review-overlay').remove();ASMModule.reviewCheck('item')" style="padding:10px;text-align:left;color:#9A9DA2;font-weight:600;cursor:pointer;user-select:none">Item${arrow('item')}</th>
                <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">W</th>
                <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">H</th>
                <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">D</th>
                <th style="padding:10px;text-align:right;color:#9A9DA2;font-weight:600">Qty</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="padding:14px 20px;border-top:1px solid #2A2D31;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:#666">${mode === 'none' ? 'Default order' : 'Sorted by ' + mode}</span>
          <span style="display:flex;gap:8px">
            ${mode !== 'none' ? '<button class="asm-btn asm-btn-ghost" onclick="this.closest(\'.asm-review-overlay\').remove();ASMModule.reviewCheck(\'none\')">Default order</button>' : ''}
            <button class="asm-btn asm-btn-primary" onclick="this.closest('.asm-review-overlay').remove()">Close</button>
          </span>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function clearReady() {
    if (readyItems.length === 0) return;
    if (!confirm('Clear all ready items?')) return;
    readyItems = [];
    renderReadyItems();
  }

  // ========================================================================
  // EXPORT TO PROJECT (push panels into EasyCutList's panel list)
  // ========================================================================

  function exportReady() {
    if (readyItems.length === 0) {
      showToast('No items to export', 'error');
      return;
    }

    // Check if addPanel function exists (from app-data.js)
    if (typeof window.addPanel !== 'function') {
      showToast('EasyCutList panel system not found', 'error');
      return;
    }

    let totalPanels = 0;

    readyItems.forEach(it => {
      it.outputs.forEach(o => {
        if (o.w > 0 && o.h > 0 && o.qty > 0) {
          // addPanel(remark, l, w, qty, material, canRotate, srNo)
          // l = width (larger dim), w = height (smaller dim)
          const remark = o.remark || '';
          const material = o.material || o.color || 'DW';
          window.addPanel(remark, o.w, o.h, o.qty, material, true, null);
          totalPanels++;
        }
      });
    });

    // Auto-populate stock sheets for new materials
    if (typeof window.autoPopulateStock === 'function') {
      window.autoPopulateStock();
    }

    showToast(totalPanels + ' panels exported to optimizer', 'success');
    // Keep readyItems so user can return to ASM and edit
    showExportSuccessModal(totalPanels);
  }

  function showExportSuccessModal(totalPanels) {
    let modal = document.getElementById('asm-export-success');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-export-success';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    
    const box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #2EB67D;border-radius:12px;width:400px;overflow:hidden;text-align:center';
    
    const body = document.createElement('div');
    body.style.cssText = 'padding:30px';
    body.innerHTML = '<div style="font-size:40px;margin-bottom:12px">✅</div>' +
      '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:6px">' + totalPanels + ' panels exported!</div>' +
      '<div style="font-size:12px;color:#7A7D82">Panels have been added to the optimizer panel list</div>';
    box.appendChild(body);
    
    const foot = document.createElement('div');
    foot.style.cssText = 'padding:16px;background:#222529;border-top:1px solid #3A3D42;display:flex;gap:10px;justify-content:center';
    
    const stayBtn = document.createElement('button');
    stayBtn.className = 'asm-btn asm-btn-ghost';
    stayBtn.textContent = 'Stay in ASM';
    stayBtn.onclick = function() { modal.remove(); };
    
    const goBtn = document.createElement('button');
    goBtn.className = 'asm-btn asm-btn-primary';
    goBtn.textContent = 'Go to Optimizer →';
    goBtn.onclick = function() { modal.remove(); closeASM(); };
    
    foot.appendChild(stayBtn);
    foot.appendChild(goBtn);
    box.appendChild(foot);
    
    modal.appendChild(box);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ========================================================================
  // PROJECT SAVE / LOAD (Supabase)
  // ========================================================================

  function getAuthToken() {
    // authHeader() is defined in app-auth.js as a global function
    try { var hdr = authHeader(); if (hdr && hdr.Authorization) return hdr.Authorization.replace('Bearer ', ''); } catch(e) {}
    try { if (CURRENT_SESSION && CURRENT_SESSION.access_token) return CURRENT_SESSION.access_token; } catch(e) {}
    return null;
  }

  function apiBase() { return API_BASE.replace('/asm', ''); }

  async function saveProject() {
    if (readyItems.length === 0 && sbsItems.length === 0) { showToast('Nothing to save', 'error'); return; }
    const token = getAuthToken();
    if (!token) { showToast('Please login first', 'error'); return; }
    showSaveModal();
    return;
    if (currentProjectId) {
      // Update existing — no modal needed
      try {
        const res = await fetch(apiBase() + '/asm/projects/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ projectId: currentProjectId, name: currentProjectName, readyItems })
        });
        const data = await res.json();
        if (data.success) showToast('Updated: ' + currentProjectName, 'success');
        else showToast(data.error || 'Save failed', 'error');
      } catch (err) { showToast('Save failed', 'error'); }
    } else {
      // New project — show save modal
      showSaveModal();
    }
  }

  function showSaveModal() {
    let modal = document.getElementById('asm-save-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-save-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:420px;overflow:hidden';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42';
    hdr.innerHTML = '<h3 style="margin:0;color:#ECB22E;font-size:16px">Save ASM Project</h3>';
    box.appendChild(hdr);

    const body = document.createElement('div');
    body.style.cssText = 'padding:20px';
    const clientOpts = (typeof clients !== 'undefined' && Array.isArray(clients))
      ? clients.map(c => '<option value="' + (c.name||'').replace(/"/g,'&quot;') + '">' + (c.name||'') + (c.biz?(' · '+c.biz):'') + '</option>').join('')
      : '';
    body.innerHTML = '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">Client Name</label>' +
      '<select id="asm-save-client-sel" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:6px">' +
        '<option value="">— Select client —</option>' + clientOpts +
        '<option value="__new__">＋ Add new client</option>' +
      '</select>' +
      '<input id="asm-save-client" type="text" placeholder="e.g. Mr. Sharma" style="display:none;width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">ASM Name</label>' +
      '<input id="asm-save-name" type="text" placeholder="e.g. Master Bedroom Set" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:12px;color:#ABABAD;margin-bottom:4px">Remarks (optional)</label>' +
      '<input id="asm-save-remarks" type="text" placeholder="Any notes..." style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box">' +
      '</div>';
    box.appendChild(body);

    const foot = document.createElement('div');
    foot.style.cssText = 'padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'asm-btn asm-btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() { modal.remove(); };
    const saveBtn = document.createElement('button');
    saveBtn.className = 'asm-btn asm-btn-primary';
    saveBtn.textContent = 'Save Project';
    saveBtn.onclick = function() { doSaveProject(); };
    foot.appendChild(cancelBtn);
    foot.appendChild(saveBtn);
    box.appendChild(foot);

    modal.appendChild(box);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    const sel = document.getElementById('asm-save-client-sel');
    const inp = document.getElementById('asm-save-client');
    sel.onchange = function() {
      if (sel.value === '__new__') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
      else { inp.style.display = 'none'; inp.value = sel.value; }
    };
    sel.focus();
    // Pre-fill when editing an existing project
    if (currentProjectId) {
      hdr.querySelector('h3').textContent = 'Edit ASM Project';
      const nameEl = document.getElementById('asm-save-name');
      if (nameEl && currentProjectName && currentProjectName !== 'Untitled') nameEl.value = currentProjectName;
      if (currentClientName) {
        const match = Array.from(sel.options).some(o => o.value === currentClientName);
        if (match) { sel.value = currentClientName; }
        else { sel.value = '__new__'; inp.style.display = 'block'; inp.value = currentClientName; }
      }
    }
  }

  async function doSaveProject() {
    const sel = document.getElementById('asm-save-client-sel');
    const inp = document.getElementById('asm-save-client');
    const clientName = (sel && sel.value === '__new__') ? inp.value.trim() : (sel ? sel.value.trim() : inp.value.trim());
    if (clientName && typeof clients !== 'undefined' && Array.isArray(clients)
        && !clients.some(c => (c.name||'').toLowerCase() === clientName.toLowerCase())) {
      clients.unshift({ id: 'c' + Date.now(), name: clientName, biz: '', phone: '' });
      if (typeof saveClients === 'function') saveClients();
    }
    const name = document.getElementById('asm-save-name').value.trim() || 'Untitled';
    const remarks = document.getElementById('asm-save-remarks').value.trim();
    const token = getAuthToken();
    if (!token) { showToast('Please login first', 'error'); return; }

    try {
      const res = await fetch(apiBase() + '/asm/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ projectId: currentProjectId, name, clientName, remarks, readyItems })
      });
      const data = await res.json();
      if (data.success) {
        currentProjectId = data.project.id;
        currentProjectName = name; currentClientName = clientName; syncProjectName();
        const sb = document.querySelector('.asm-save-btn'); if (sb) sb.textContent = 'Edit';
        showToast('Saved: ' + name, 'success');
        const modal = document.getElementById('asm-save-modal');
        if (modal) modal.remove();
      } else showToast(data.error || 'Save failed', 'error');
    } catch (err) { showToast('Save failed', 'error'); }
  }

  async function showProjects() {
    const token = getAuthToken();
    if (!token) { showToast('Please login first', 'error'); return; }
    try {
      const res = await fetch(apiBase() + '/asm/projects', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Failed', 'error'); return; }
      showProjectsModal(data.projects);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  function showProjectsModal(projects) {
    let modal = document.getElementById('asm-projects-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-projects-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:480px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column';
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center';
    hdr.innerHTML = '<h3 style="margin:0;color:#ECB22E;font-size:16px">My ASM Projects</h3>';
    const xBtn = document.createElement('button');
    xBtn.style.cssText = 'background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer';
    xBtn.textContent = 'X';
    xBtn.onclick = function() { modal.remove(); };
    hdr.appendChild(xBtn);
    box.appendChild(hdr);
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:10px 16px;background:#1A1D21;border-bottom:1px solid #2A2D31';
    searchWrap.innerHTML = '<input id="asm-proj-search" type="text" placeholder="Search projects or clients…" style="width:100%;padding:8px 12px;background:#14161A;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">';
    box.appendChild(searchWrap);
    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'padding:16px;overflow-y:auto;flex:1';
    const renderList = function(filter) {
      filter = (filter || '').toLowerCase();
      listDiv.innerHTML = '';
      const shown = projects.filter(p =>
        !filter || (p.name||'').toLowerCase().includes(filter) || (p.clientName||'').toLowerCase().includes(filter));
      if (shown.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center;color:#7A7D82;padding:30px">No matching projects</div>';
        return;
      }
      shown.forEach(function(p) {
        const date = new Date(p.updatedAt).toLocaleDateString();
        const card = document.createElement('div');
        card.style.cssText = 'background:#222529;border:1px solid #3A3D42;border-radius:8px;padding:12px;margin:8px 0;cursor:pointer';
        card.onmouseover = function() { card.style.borderColor = '#ECB22E'; };
        card.onmouseout = function() { card.style.borderColor = '#3A3D42'; };
        card.onclick = function() { ASMModule.loadProject(p.id); };
        let info = '<div style="font-weight:700;color:#fff">' + p.name + '</div>';
        if (p.clientName) info += '<div style="font-size:11px;color:#ECB22E">' + p.clientName + '</div>';
        info += '<div style="font-size:11px;color:#7A7D82">' + p.itemCount + ' items | ' + p.totalPanels + ' panels | ' + date + '</div>';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        row.innerHTML = '<div>' + info + '</div>';
        const del = document.createElement('button');
        del.style.cssText = 'background:none;border:none;color:#E01E5A;cursor:pointer;font-size:12px;padding:4px 8px';
        del.textContent = 'DEL';
        del.onclick = function(e) { e.stopPropagation(); ASMModule.deleteProject(p.id); };
        row.appendChild(del);
        card.appendChild(row);
        listDiv.appendChild(card);
      });
    };
    if (projects.length === 0) {
      listDiv.innerHTML = '<div style="text-align:center;color:#7A7D82;padding:30px">No saved projects yet</div>';
    } else {
      renderList('');
    }
    box.appendChild(listDiv);
    modal.appendChild(box);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    const si = document.getElementById('asm-proj-search');
    if (si) si.oninput = function() { renderList(si.value); };
  }


  async function loadProject(projectId) {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(apiBase() + '/asm/projects/' + projectId, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Load failed', 'error'); return; }
      sbsItems = [];
      readyItems = data.project.readyItems || [];
      currentProjectId = data.project.id;
      currentProjectName = data.project.name; currentClientName = data.project.clientName || ''; syncProjectName();
      { const sb = document.querySelector('.asm-save-btn'); if (sb) sb.textContent = 'Edit'; }
      renderSBS();
      renderReadyItems();
      const m = document.getElementById('asm-projects-modal');
      if (m) m.remove();
      showToast('Loaded: ' + data.project.name, 'success');
    } catch (err) { showToast('Load error', 'error'); }
  }

  async function deleteProject(projectId) {
    if (!confirm('Delete this project?')) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(apiBase() + '/asm/projects/' + projectId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (data.success) {
        if (currentProjectId === projectId) { currentProjectId = null; currentProjectName = ''; syncProjectName(); }
        showToast('Deleted', 'success');
        showProjects();
      } else showToast(data.error || 'Failed', 'error');
    } catch (err) { showToast('Error', 'error'); }
  }

  // ========================================================================
  // SVG DIAGRAM GENERATOR
  // ========================================================================

  function generateItemDiagram(inst) {
    if (!inst.outputs || inst.outputs.length === 0) return '';

    const inp = inst.inputs;
    const W = inp.width || inp.w || inp.W || 1000;
    const H = inp.ht || inp.h || inp.H || inp.height || 800;
    const D = inp.depth || inp.d || inp.D || 400;
    const category = (inst.itemId || '').toLowerCase();

    // Detect item type from name/id
    if (category.includes('wardrobe') || category.includes('sliding')) return wardrobeDiagram(inst, W, H, D);
    if (category.includes('cab') || category.includes('cabinet') || category.includes('shutter')) return cabinetDiagram(inst, W, H, D);
    if (category.includes('bed')) return bedDiagram(inst, W, H, D);
    if (category.includes('loft') || category.includes('bl')) return loftDiagram(inst, W, H, D);
    if (category.includes('dressing') || category.includes('table')) return cabinetDiagram(inst, W, H, D);

    // Generic fallback
    return genericDiagram(inst, W, H, D);
  }

  function wardrobeDiagram(inst, W, H, D) {
    // Scale to fit in ~400x300 SVG
    const scale = Math.min(360 / W, 260 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2); // offset x
    const oy = 20; // offset y
    const svgH = sh + 70;

    // Find components
    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const shelf = find('SHELF');
    const halfShelf = find('HALF');
    const vertical = find('VERTICAL PART') || find('PARTITION');
    const locker = find('LOCKER');
    const drawer = find('DRAWER') || find('FACE');
    const door = find('DOOR');
    const shelfCount = shelf ? shelf.qty : 0;
    const halfCount = halfShelf ? halfShelf.qty : 0;
    const hasLocker = locker && locker.qty > 0;
    const hasDrawers = drawer && drawer.qty > 0;

    // Panel thickness scaled
    const pt = Math.max(2, Math.round(18 * scale));
    const midX = ox + Math.round(sw / 2);

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:300px">`;

    // Back panel (dashed)
    svg += `<rect x="${ox + pt}" y="${oy + pt}" width="${sw - pt * 2}" height="${sh - pt * 2}" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.4"/>`;

    // Top
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    // Bottom
    svg += `<rect x="${ox + pt}" y="${oy + sh - pt}" width="${sw - pt * 2}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    // Left side
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    // Right side
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Vertical partition (center)
    if (vertical && vertical.qty > 0) {
      svg += `<rect x="${midX - 1}" y="${oy + pt}" width="${3}" height="${sh - pt * 2 - (hasDrawers ? sh * 0.2 : 0)}" fill="#7F77DD" fill-opacity="0.5" stroke="#7F77DD" stroke-width="0.5"/>`;
    }

    // Shelves (left compartment)
    const shelfArea = sh - pt * 2 - (hasDrawers ? sh * 0.25 : 0) - (hasLocker ? sh * 0.15 : 0);
    const leftW = midX - ox - pt - 2;
    for (let i = 0; i < Math.min(shelfCount, 6); i++) {
      const sy = oy + pt + Math.round(shelfArea * (i + 1) / (shelfCount + 1));
      svg += `<rect x="${ox + pt}" y="${sy}" width="${leftW}" height="2" fill="#639922" fill-opacity="0.6" stroke="#639922" stroke-width="0.5"/>`;
    }

    // Half shelves (right compartment, upper)
    const rightX = midX + 3;
    const rightW = ox + sw - pt - rightX;
    const upperH = Math.round(shelfArea * 0.5);
    for (let i = 0; i < Math.min(halfCount, 4); i++) {
      const sy = oy + pt + Math.round(upperH * (i + 1) / (Math.min(halfCount, 4) + 1));
      // Half shelf = two halves
      svg += `<rect x="${rightX}" y="${sy}" width="${Math.round(rightW / 2) - 2}" height="2" fill="#BA7517" fill-opacity="0.5" stroke="#BA7517" stroke-width="0.5"/>`;
      svg += `<rect x="${rightX + Math.round(rightW / 2) + 2}" y="${sy}" width="${Math.round(rightW / 2) - 2}" height="2" fill="#BA7517" fill-opacity="0.5" stroke="#BA7517" stroke-width="0.5"/>`;
    }

    // Drawers (bottom left)
    if (hasDrawers) {
      const drawerY = oy + sh - pt - Math.round(sh * 0.22);
      const drawerH = Math.round(sh * 0.18);
      const rows = Math.min(drawer.qty, 4);
      const rowH = Math.round(drawerH / rows);
      for (let i = 0; i < rows; i++) {
        svg += `<rect x="${ox + pt + 4}" y="${drawerY + i * rowH + 2}" width="${leftW - 8}" height="${rowH - 4}" rx="2" fill="#D85A30" fill-opacity="0.2" stroke="#D85A30" stroke-width="0.5"/>`;
        // Handle
        const hy = drawerY + i * rowH + Math.round(rowH / 2);
        svg += `<line x1="${ox + pt + leftW / 2 - 8}" y1="${hy}" x2="${ox + pt + leftW / 2 + 8}" y2="${hy}" stroke="#D85A30" stroke-width="1.5" stroke-linecap="round"/>`;
      }
    }

    // Locker (bottom right)
    if (hasLocker) {
      const lockerY = oy + sh - pt - Math.round(sh * 0.18);
      const lockerH = Math.round(sh * 0.14);
      svg += `<rect x="${rightX + 2}" y="${lockerY}" width="${rightW - 4}" height="${lockerH}" rx="2" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2"/>`;
      svg += `<text x="${rightX + rightW / 2}" y="${lockerY + lockerH / 2 + 4}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">LOCKER</text>`;
    }

    // Sliding doors (overlay)
    svg += `<rect x="${ox + 2}" y="${oy + pt + 2}" width="${Math.round(sw / 2) - 4}" height="${sh - pt * 2 - 4}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="8 4" opacity="0.4"/>`;
    svg += `<rect x="${midX + 2}" y="${oy + pt + 2}" width="${Math.round(sw / 2) - 4}" height="${sh - pt * 2 - 4}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="8 4" opacity="0.4"/>`;

    // Skirting
    svg += `<rect x="${ox}" y="${oy + sh}" width="${sw}" height="${Math.max(3, Math.round(8 * scale))}" rx="1" fill="var(--text-muted)" fill-opacity="0.3" stroke="var(--text-muted)" stroke-width="0.5"/>`;

    // Dimension labels
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;

    // Component count
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;

    svg += '</svg>';
    return svg;
  }

  function cabinetDiagram(inst, W, H, D) {
    const scale = Math.min(360 / W, 260 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;
    const pt = Math.max(2, Math.round(18 * scale));

    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const shelf = find('SHELF');
    const door = find('DOOR');
    const shelfCount = shelf ? shelf.qty : 0;
    const doorCount = door ? door.qty : 1;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:280px">`;

    // Back (dashed)
    svg += `<rect x="${ox + pt}" y="${oy + pt}" width="${sw - pt * 2}" height="${sh - pt * 2}" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.4"/>`;

    // Top, Bottom
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + pt}" y="${oy + sh - pt}" width="${sw - pt * 2}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;

    // Sides
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Shelves
    const innerW = sw - pt * 2;
    for (let i = 0; i < Math.min(shelfCount, 6); i++) {
      const sy = oy + pt + Math.round((sh - pt * 2) * (i + 1) / (shelfCount + 1));
      svg += `<rect x="${ox + pt}" y="${sy}" width="${innerW}" height="2" fill="#639922" fill-opacity="0.6" stroke="#639922" stroke-width="0.5"/>`;
    }

    // Doors overlay
    const doorW = Math.round(innerW / Math.min(doorCount, 4));
    for (let i = 0; i < Math.min(doorCount, 4); i++) {
      const dx = ox + pt + i * doorW;
      svg += `<rect x="${dx + 3}" y="${oy + pt + 3}" width="${doorW - 6}" height="${sh - pt * 2 - 6}" rx="3" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="6 3" opacity="0.4"/>`;
      // Handle
      const hx = dx + doorW - 12;
      svg += `<line x1="${hx}" y1="${oy + sh / 2 - 8}" x2="${hx}" y2="${oy + sh / 2 + 8}" stroke="var(--text-accent)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function bedDiagram(inst, W, H, D) {
    // Bed is wide and short
    const scale = Math.min(360 / W, 180 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 30;
    const svgH = sh + 90;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:240px">`;

    // Mattress area
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="6" fill="var(--text-muted)" fill-opacity="0.08" stroke="var(--text-muted)" stroke-width="1"/>`;

    // Headboard
    svg += `<rect x="${ox}" y="${oy - 16}" width="${sw}" height="18" rx="3" fill="#7F77DD" fill-opacity="0.3" stroke="#7F77DD" stroke-width="0.5"/>`;
    svg += `<text x="${ox + sw / 2}" y="${oy - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="var(--font-sans)">HEADBOARD</text>`;

    // Side rails
    svg += `<rect x="${ox}" y="${oy}" width="6" height="${sh}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - 6}" y="${oy}" width="6" height="${sh}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Bottom panel
    svg += `<rect x="${ox + 6}" y="${oy + sh - 6}" width="${sw - 12}" height="6" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;

    // Storage (if trolley/flap)
    const hasTrolley = (inst.itemId || '').toLowerCase().includes('trl') || (inst.itemId || '').toLowerCase().includes('trolley');
    if (hasTrolley) {
      svg += `<rect x="${ox + 10}" y="${oy + 10}" width="${sw - 20}" height="${sh - 20}" rx="3" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="4 2"/>`;
      svg += `<text x="${ox + sw / 2}" y="${oy + sh / 2 + 3}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">STORAGE</text>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function loftDiagram(inst, W, H, D) {
    // Loft is wide and short (overhead cabinet)
    const scale = Math.min(360 / W, 160 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;
    const pt = Math.max(2, Math.round(14 * scale));

    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const door = find('DOOR');
    const doorCount = door ? door.qty : 1;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:220px">`;

    // Structure
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="3" fill="var(--text-muted)" fill-opacity="0.06" stroke="var(--text-muted)" stroke-width="1"/>`;
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox}" y="${oy + sh - pt}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt * 2}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt * 2}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Doors
    const innerW = sw - pt * 2;
    const dw = Math.round(innerW / Math.min(doorCount, 3));
    for (let i = 0; i < Math.min(doorCount, 3); i++) {
      svg += `<rect x="${ox + pt + i * dw + 3}" y="${oy + pt + 3}" width="${dw - 6}" height="${sh - pt * 2 - 6}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.5"/>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 25}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 40}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function genericDiagram(inst, W, H, D) {
    const scale = Math.min(360 / W, 240 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:260px">`;
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="4" fill="var(--text-muted)" fill-opacity="0.06" stroke="var(--text-muted)" stroke-width="1"/>`;

    // Show component names inside
    const maxShow = Math.min(inst.outputs.length, 8);
    for (let i = 0; i < maxShow; i++) {
      const o = inst.outputs[i];
      const ty = oy + 20 + i * 16;
      svg += `<text x="${ox + 12}" y="${ty}" fill="var(--text-secondary)" font-size="9" font-family="var(--font-sans)">${o.component}: ${o.w}×${o.h} (${o.qty})</text>`;
    }
    if (inst.outputs.length > maxShow) {
      svg += `<text x="${ox + 12}" y="${oy + 20 + maxShow * 16}" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">+ ${inst.outputs.length - maxShow} more...</text>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 25}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += '</svg>';
    return svg;
  }

  // ========================================================================
  // EXPORT TO PDF
  // ========================================================================

  function exportToPDF() {
    if (readyItems.length === 0) { showToast('No items to export', 'error'); return; }
    if (asmPlan !== 'pro') {
      const hasLockedItems = readyItems.some(it => {
        const ci = catalogue.find(x => x.id === it.itemId);
        return ci ? !ci.is_free : true;
      });
      if (hasLockedItems) { showToast('PDF export with PRO items requires upgrade', 'error'); showPricing(); return; }
    }
    showExportOptions();
  }

  function hf(flag){ try { return (typeof hasFeature==='function') ? hasFeature(flag) : (asmPlan==='pro'); } catch(e){ return asmPlan==='pro'; } }

  function showExportOptions() {
    const old = document.getElementById('asm-export-modal'); if (old) old.remove();
    const gp = (typeof profile!=='undefined' && profile) ? profile : {};
    const overlay = document.createElement('div');
    overlay.id = 'asm-export-modal';
    overlay.dataset.client = currentClientName || '';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const row = (id, label, sub, checked, locked) =>
      `<label class="asm-eo-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2A2D31;${locked?'opacity:.45':''}">
         <div><div style="font-size:13px;color:#E8E8E8">${label}${locked?' <span style="color:#ECB22E;font-size:10px">⭐PRO</span>':''}</div>
         <div style="font-size:11px;color:#7A7D82">${sub}</div></div>
         <input type="checkbox" id="${id}" ${checked?'checked':''} ${locked?'disabled':''} style="width:18px;height:18px;accent-color:#2EB67D">
       </label>`;
    overlay.innerHTML = `
      <div style="background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:440px;max-height:85vh;overflow:auto">
        <div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:15px;font-weight:700;color:#fff">📄 Export PDF Options</div>
          <button onclick="document.getElementById('asm-export-modal').remove()" style="background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div style="padding:16px 20px">
          ${row('eo-logo','Company Logo','Your logo from My Profile', false, !hf('pdfLogoHeader')||!gp.logo)}
          ${row('eo-company','Company Name','Business name from My Profile', false, !hf('pdfCompanyName')||!gp.biz)}
          <div style="padding:12px 0;border-bottom:1px solid #2A2D31">
            <div style="font-size:13px;color:#E8E8E8;margin-bottom:6px">Client Name</div>
            <input type="text" id="eo-client-text" value="${(currentClientName||'').replace(/"/g,'&quot;')}" placeholder="Type client name" style="width:100%;padding:8px 10px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">
          </div>
          ${row('eo-outer','Print Outer Details','Input values grid atop each item', true, false)}
          ${row('eo-summary','Panel Summary','Components / panels line per item', true, false)}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 4px">
            <div><div style="font-size:13px;color:#E8E8E8">W×H×Qty×Material font (pt)</div>
            <div style="font-size:11px;color:#7A7D82">Component table text size</div></div>
            <input type="number" id="eo-font" value="14" min="8" max="24" style="width:60px;padding:6px 8px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;text-align:center">
          </div>
        </div>
        <div style="padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px">
          <button onclick="document.getElementById('asm-export-modal').remove()" style="padding:8px 16px;background:#3A3D42;border:none;border-radius:6px;color:#ABABAD;font-size:13px;cursor:pointer">Cancel</button>
          <button onclick="ASMModule._runExport()" style="padding:8px 16px;background:#ECB22E;border:none;border-radius:6px;color:#1A1D21;font-weight:700;font-size:13px;cursor:pointer">Export PDF</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function _runExport() {
    const gp = (typeof profile!=='undefined' && profile) ? profile : {};
    const modalEl = document.getElementById('asm-export-modal');
    const opt = {
      logo:    document.getElementById('eo-logo')?.checked && gp.logo,
      company: document.getElementById('eo-company')?.checked && gp.biz,
      phone:   document.getElementById('eo-company')?.checked && gp.phone,
      client:  (document.getElementById('eo-client-text')?.value || '').trim(),
      outer:   document.getElementById('eo-outer')?.checked,
      summary: document.getElementById('eo-summary')?.checked,
      font:    parseInt(document.getElementById('eo-font')?.value) || 14,
      biz: gp.biz, logoSrc: gp.logo, phoneNum: gp.phone
    };
    document.getElementById('asm-export-modal')?.remove();
    _doExportPDF(opt);
  }

  function _doExportPDF(opt) {
    opt = opt || {};
    const fs = opt.font || 14;
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>EasyCutList ASM - Size Sheet</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 15px; }
        .header { text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #333; }
        .header h1 { font-size: 16px; margin-bottom: 3px; }
        .header p { font-size: 10px; color: #666; }
        .item { margin-bottom: 18px; }
        .item-title { background: #333; color: #fff; padding: 6px 10px; font-size: 13px; font-weight: bold; page-break-after: avoid; }
        .run-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 8px; position: running(hdr); width: 100%; }
        @page { margin: 34mm 12mm 16mm 12mm; @top-center { content: element(hdr); } @bottom-left { content: "Generated by EasyCutList ASM"; font-size: 9px; color: #999; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #999; } }
        .item-inputs { background: #f5f5f5; padding: 6px 10px; font-size: 10px; color: #555; border-bottom: 1px solid #ddd; page-break-after: avoid; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { background: #eee; padding: 4px 6px; text-align: left; font-size: ${fs}px; border: 1px solid #ccc; font-weight: 700; }
        td { padding: 4px 6px; border: 1px solid #ccc; font-size: ${fs}px; }
        td.num { text-align: right; font-weight: 600; }
        .summary { font-size: 10px; color: #666; text-align: right; padding: 4px; }
        .footer { margin-top: 20px; text-align: left; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
        @media print { body { padding: 10px; } tr { page-break-inside: avoid; } thead { display: table-header-group; } }
      </style>
    </head><body>`;

    const escH = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    if (opt.logo || opt.company || opt.client) {
      const center = [];
      if (opt.company && opt.biz) center.push(`<div style="font-weight:900;font-size:16px">${escH(opt.biz)}</div>`);
      if (opt.phone && opt.phoneNum) center.push(`<div style="font-size:11px;color:#666">${escH(opt.phoneNum)}</div>`);
      const logoImg = (opt.logo && opt.logoSrc) ? `<img src="${opt.logoSrc}" style="max-height:40px;max-width:90px;object-fit:contain">` : '';
      const clientHtml = opt.client ? `<div style="font-size:15px;font-weight:700;color:#c0392b;margin-top:2px">${escH(opt.client)}</div>` : '';
      html += `<div class="run-header">
        <div style="flex:1;display:flex;align-items:center;gap:12px">${logoImg}${clientHtml}</div>
        <div style="flex:1;text-align:center">${center.join('')}</div>
        <div style="flex:1;text-align:right;font-size:9px;color:#aaa">${new Date().toLocaleDateString('en-IN')}<div style="font-size:8px;color:#bbb">Generated by EasyCutList ASM</div></div>
      </div>`;
    } else {
      html += `<div class="header">
        <h1>EasyCutList - Auto Size Module (ASM)</h1>
        <p>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      </div>`;
    }

    let grandTotalPanels = 0;
    let globalSrNo = 0;

    readyItems.forEach((it, idx) => {
      const inp = it.inputs;
      const w = inp.width || inp.w || inp.W || '?';
      const h = inp.ht || inp.h || inp.H || inp.height || '?';
      const d = inp.depth || inp.d || inp.D || '?';
      const dims = w + ' x ' + h + ' x ' + d + ' mm';
      const totalPanels = it.outputs.reduce((a, o) => a + (o.qty || 0), 0);
      grandTotalPanels += totalPanels;

      // Input summary as clean table
      const inputRows = Object.entries(it.inputs)
        .filter(([k, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => '<td style="padding:2px 8px;border:1px solid #ddd;font-weight:600;background:#f9f9f9;font-size:9px">' + k + '</td><td style="padding:2px 8px;border:1px solid #ddd;font-size:9px">' + v + '</td>')
      
      // Show inputs in rows of 4 pairs each
      let inputTable = '<table style="width:100%;border-collapse:collapse;margin:2px 0"><tr>';
      inputRows.forEach((cell, i) => {
        inputTable += cell;
        if ((i + 1) % 4 === 0 && i < inputRows.length - 1) inputTable += '</tr><tr>';
      });
      inputTable += '</tr></table>';

      html += '<div class="item">';
      const roomPrefix = it.roomName ? (String(it.roomName).trim() + ' — ') : '';
      html += '<div class="item-title">' + (idx + 1) + '. ' + roomPrefix + it.itemName + '  |  ' + dims + '  |  Qty: ' + (inp.qty || inp.Qty || 1) + '</div>';
      if (opt.outer) html += '<div class="item-inputs">' + inputTable + '</div>';
      html += '<table><thead><tr><th>Sr</th><th>Component</th><th>W</th><th>H</th><th>Qty</th><th>Color</th><th>Remark</th><th>Box No</th></tr></thead><tbody>';

      it.outputs.forEach((o) => {
        globalSrNo++;
        // Clean up color and remark - remove formula artifacts
        let color = String(o.color || '-');
        let remark = String(o.remark || '-');
        // Remove JS formula text (anything with ===, ?, ||, etc.)
        if (color.includes('===') || color.includes('?') || color.includes('||')) color = '-';
        if (remark.includes('===') || remark.includes('?') || remark.includes('||')) remark = '-';
        // Remove wrapping quotes
        color = color.replace(/^["']|["']$/g, '');
        remark = remark.replace(/^["']|["']$/g, '');

        html += '<tr>';
        html += '<td>' + globalSrNo + '</td>';
        html += '<td>' + (o.component || '-') + '</td>';
        html += '<td class="num">' + (o.w || 0) + '</td>';
        html += '<td class="num">' + (o.h || 0) + '</td>';
        html += '<td class="num">' + (o.qty || 0) + '</td>';
        html += '<td>' + color + '</td>';
        html += '<td>' + remark + '</td>';
        html += '<td></td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      if (opt.summary) html += '<div class="summary">' + it.outputs.length + ' components | ' + totalPanels + ' panels</div>';
      html += '</div>';
    });

    html += '<div class="footer">Total: ' + readyItems.length + ' items | ' + grandTotalPanels + ' panels<br>Generated and calculated with EasyCutList ASM</div>';
    html += '<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"><\/script>';
    html += '<script>window.PagedConfig={auto:true,after:()=>{setTimeout(()=>window.print(),200);}};<\/script>';
    html += '</body></html>';

    // Open print window
    const printWin = window.open('', '_blank');
    if (!printWin) { showToast('Allow popups to export PDF', 'error'); return; }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
  }

  // ========================================================================
  // ASM PLAN & PRICING
  // ========================================================================

  async function checkASMPlan() {
    const token = getAuthToken();
    const badge = document.getElementById('asm-plan-badge');
    const upgradeBtn = document.getElementById('asm-upgrade-btn');

    if (!token) {
      asmPlan = 'free';
      if (badge) { badge.textContent = 'FREE'; badge.style.background = '#3A3D42'; badge.style.color = '#ABABAD'; }
      if (upgradeBtn) upgradeBtn.style.display = '';
      return;
    }

    try {
      const res = await fetch(apiBase() + '/asm/payments/status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();

      if (data.active) {
        asmPlan = 'pro';
        if (badge) { badge.textContent = 'PRO'; badge.style.background = '#2EB67D'; badge.style.color = '#fff'; }
        if (upgradeBtn) upgradeBtn.style.display = 'none';
      } else if (data.plan === 'expired') {
        asmPlan = 'expired';
        if (badge) { badge.textContent = 'EXPIRED'; badge.style.background = '#E01E5A'; badge.style.color = '#fff'; }
        if (upgradeBtn) upgradeBtn.style.display = '';
      } else {
        asmPlan = 'free';
        if (badge) { badge.textContent = 'FREE'; badge.style.background = '#3A3D42'; badge.style.color = '#ABABAD'; }
        if (upgradeBtn) upgradeBtn.style.display = '';
      }
    } catch (e) {
      asmPlan = 'free';
    }
    // Re-render catalogue to update lock icons
    renderCatalogue();
  }

  async function showPricing() {
    const token = getAuthToken();
    if (!token) { showToast('Please login first', 'error'); return; }

    let plans = [];
    let keyId = '';
    try {
      const res = await fetch(apiBase() + '/asm/payments/plans');
      const data = await res.json();
      if (data.success) { plans = data.plans; keyId = data.keyId; }
    } catch (e) {
      showToast('Could not load pricing', 'error');
      return;
    }

    let modal = document.getElementById('asm-pricing-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-pricing-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:16px;width:580px;overflow:hidden';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:24px 28px 16px;text-align:center';
    hdr.innerHTML = '<h2 style="margin:0 0 6px;color:#ECB22E;font-size:20px">Upgrade to ASM Pro</h2><p style="margin:0;color:#7A7D82;font-size:12px">Unlock all furniture items, unlimited projects, PDF export</p>';
    box.appendChild(hdr);

    // Plans
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;gap:12px;padding:0 28px 24px;justify-content:center';

    plans.forEach(function(p) {
      const isPopular = p.months === 12;
      const perMonth = Math.round(p.price / p.months);
      const card = document.createElement('div');
      card.style.cssText = 'flex:1;background:#222529;border:2px solid ' + (isPopular ? '#ECB22E' : '#3A3D42') + ';border-radius:12px;padding:20px 16px;text-align:center;cursor:pointer;transition:all .2s;position:relative';
      card.onmouseover = function() { card.style.borderColor = '#ECB22E'; card.style.transform = 'translateY(-2px)'; };
      card.onmouseout = function() { card.style.borderColor = isPopular ? '#ECB22E' : '#3A3D42'; card.style.transform = ''; };

      let inner = '';
      if (isPopular) inner += '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#ECB22E;color:#1A1D21;font-size:9px;font-weight:800;padding:2px 10px;border-radius:10px">BEST VALUE</div>';
      inner += '<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px">' + p.label + '</div>';
      inner += '<div style="font-size:28px;font-weight:900;color:#ECB22E;margin:10px 0">₹' + p.price.toLocaleString() + '</div>';
      inner += '<div style="font-size:11px;color:#7A7D82;margin-bottom:16px">₹' + perMonth.toLocaleString() + '/month</div>';
      inner += '<button class="asm-btn asm-btn-primary" style="width:100%;padding:10px" onclick="ASMModule.startASMPayment(\'' + p.id + '\')">Choose Plan</button>';

      card.innerHTML = inner;
      grid.appendChild(card);
    });

    box.appendChild(grid);

    // Features list
    const features = document.createElement('div');
    features.style.cssText = 'padding:0 28px 20px;font-size:11px;color:#7A7D82;text-align:center';
    features.innerHTML = 'Includes: All 93+ furniture items | Unlimited projects | Save to cloud | PDF export | Export to optimizer | Priority support';
    box.appendChild(features);

    // Close
    const closeDiv = document.createElement('div');
    closeDiv.style.cssText = 'padding:12px 28px;background:#222529;border-top:1px solid #3A3D42;text-align:center';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'asm-btn asm-btn-ghost';
    closeBtn.textContent = 'Maybe Later';
    closeBtn.onclick = function() { modal.remove(); };
    closeDiv.appendChild(closeBtn);
    box.appendChild(closeDiv);

    modal.appendChild(box);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function startASMPayment(planId) {
    const token = getAuthToken();
    if (!token) { showToast('Please login first', 'error'); return; }

    // Get user info
    let userId = '', email = '';
    try {
      if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
        userId = CURRENT_USER.id;
        email = CURRENT_USER.email || '';
      }
    } catch(e) {}

    if (!userId) {
      try {
        if (typeof supa !== 'undefined' && supa) {
          const { data } = await supa.auth.getUser(token);
          if (data && data.user) { userId = data.user.id; email = data.user.email || ''; }
        }
      } catch(e) {}
    }

    if (!userId) { showToast('Could not identify user', 'error'); return; }

    try {
      // Create order
      const res = await fetch(apiBase() + '/asm/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ planId, userId, email })
      });
      const order = await res.json();

      if (!order.orderId) {
        showToast(order.error || 'Could not create order', 'error');
        return;
      }

      // Close pricing modal
      const pricingModal = document.getElementById('asm-pricing-modal');
      if (pricingModal) pricingModal.remove();

      // Open Razorpay checkout
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'EasyCutList',
        description: 'ASM Pro - ' + order.planLabel,
        order_id: order.orderId,
        handler: async function(response) {
          // Verify payment
          try {
            const verifyRes = await fetch(apiBase() + '/asm/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId, planId
              })
            });
            const result = await verifyRes.json();
            if (result.ok) {
              showToast('ASM Pro activated! Expires: ' + new Date(result.expiresAt).toLocaleDateString(), 'success');
              asmPlan = 'pro';
              await checkASMPlan();
            } else {
              showToast('Payment verification failed', 'error');
            }
          } catch (e) {
            showToast('Verification error', 'error');
          }
        },
        prefill: { email },
        theme: { color: '#4A154B' }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function() {
        showToast('Payment failed', 'error');
      });
      rzp.open();

    } catch (err) {
      showToast('Payment error: ' + err.message, 'error');
    }
  }

  // ========================================================================
  // TOAST NOTIFICATIONS
  // ========================================================================

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `asm-toast asm-toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ========================================================================
  // STYLES
  // ========================================================================

  function injectStyles() {
    if (document.getElementById('asm-fullpage-styles')) return;
    const style = document.createElement('style');
    style.id = 'asm-fullpage-styles';
    style.textContent = ASM_CSS;
    document.head.appendChild(style);
  }

  let _modalImages = [];
  let _modalIndex = 0;
  function openImageModal(instanceId, index) {
    const inst = sbsItems.find(i => i.instanceId === instanceId);
    const schema = inst ? activeItemSchemas[inst.itemId] : null;
    _modalImages = (schema && schema.referenceImages) ? schema.referenceImages.map(im => im.base64) : [];
    if (!_modalImages.length && typeof instanceId === 'string' && instanceId.startsWith('data:')) {
      _modalImages = [instanceId]; // fallback: raw base64 passed
    }
    _modalIndex = index || 0;
    _showModalImage();
    const modal = document.getElementById('asm-modal');
    if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
  }
  function _showModalImage() {
    const img = document.getElementById('asm-modal-image');
    if (img && _modalImages[_modalIndex]) img.src = _modalImages[_modalIndex];
    const prev = document.getElementById('asm-modal-prev');
    const next = document.getElementById('asm-modal-next');
    const multi = _modalImages.length > 1;
    if (prev) prev.style.display = multi ? 'flex' : 'none';
    if (next) next.style.display = multi ? 'flex' : 'none';
  }
  function modalNav(dir) {
    if (!_modalImages.length) return;
    _modalIndex = (_modalIndex + dir + _modalImages.length) % _modalImages.length;
    _showModalImage();
  }

  function closeImageModal() {
    const modal = document.getElementById('asm-modal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
  }

  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('asm-modal');
    if (!modal || !modal.classList.contains('show')) return;
    if (e.key === 'Escape') closeImageModal();
    else if (e.key === 'ArrowLeft') modalNav(-1);
    else if (e.key === 'ArrowRight') modalNav(1);
  });

  function showImportModal() {
    const old = document.getElementById('asm-import-modal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'asm-import-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    m.onclick = e => { if (e.target === m) m.remove(); };
    m.innerHTML = `
      <div style="background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:440px;overflow:hidden">
        <div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:15px;font-weight:700;color:#fff">Import your own Sizes in RIS</div>
          <button onclick="document.getElementById('asm-import-modal').remove()" style="background:none;border:none;color:#7A7D82;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div style="padding:20px">
          <div style="font-size:12px;color:#ABABAD;margin-bottom:12px">Columns: Component | W | H | Qty | Material | Remark. Component optional. Item name = file name.</div>
          <input type="file" id="asm-import-file" accept=".csv,.xlsx,.xls" style="width:100%;padding:10px;background:#222529;border:1px solid #3A3D42;border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box">
          <div id="asm-import-status" style="margin-top:10px;font-size:12px"></div>
        </div>
        <div style="padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:space-between;align-items:center">
          <button onclick="ASMModule.downloadSample()" style="background:none;border:none;color:#ECB22E;font-size:12px;cursor:pointer;text-decoration:underline">Download sample file</button>
          <button onclick="ASMModule.doImport()" style="padding:8px 16px;background:#ECB22E;border:none;border-radius:6px;color:#1A1D21;font-weight:700;font-size:13px;cursor:pointer">Import</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  function downloadSample() {
    const csv = 'Component,W,H,Qty,Material,Remark\nTOP,600,400,1,MDF,-\nSIDE,400,720,2,PLY,edge band\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'asm-sample.csv'; a.click();
  }

  function _loadXLSX() {
    return new Promise((res, rej) => {
      if (window.XLSX) return res();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  function _rowsToItem(rows, name) {
    let hdr = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = (rows[i] || []).map(c => String(c || '').toLowerCase());
      if (r.some(c => c === 'w') && r.some(c => c === 'h')) { hdr = i; break; }
    }
    if (hdr < 0) throw new Error('No header row (need W and H columns)');
    const cols = rows[hdr].map(c => String(c || '').toLowerCase().trim());
    const ci = n => cols.indexOf(n);
    const iw = ci('w'), ih = ci('h'), iq = ci('qty'), ic = ci('component'),
          im = ci('material'), ir = ci('remark');
    const outputs = [];
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || r.every(c => c === '' || c == null)) continue;
      const w = parseFloat(r[iw]), h = parseFloat(r[ih]);
      if (isNaN(w) || isNaN(h)) continue;
      outputs.push({
        component: (ic >= 0 ? r[ic] : '') || 'PART',
        w, h, qty: iq >= 0 ? (parseInt(r[iq]) || 1) : 1,
        material: im >= 0 ? (r[im] || '') : '',
        remark: ir >= 0 ? (r[ir] || '') : ''
      });
    }
    if (!outputs.length) throw new Error('No valid size rows found');
    return { readyId: 'ready_' + Date.now(), itemId: 'imported', itemName: name,
             catalogueKey: currentCatalogue, imported: true, inputs: {}, outputs };
  }

  async function doImport() {
    const inp = document.getElementById('asm-import-file');
    const status = document.getElementById('asm-import-status');
    const f = inp.files[0];
    if (!f) { status.innerHTML = '<span style="color:#E01E5A">Choose a file</span>'; return; }
    const name = f.name.replace(/\.(csv|xlsx|xls)$/i, '');
    try {
      let rows;
      if (/\.csv$/i.test(f.name)) {
        const text = await f.text();
        rows = text.split(/\r?\n/).map(l => l.split(','));
      } else {
        await _loadXLSX();
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      }
      const item = _rowsToItem(rows, name);
      readyItems.push(item);
      renderReadyItems();
      document.getElementById('asm-import-modal').remove();
      showToast(`Imported "${name}" (${item.outputs.length} parts)`, 'success');
    } catch (e) {
      status.innerHTML = '<span style="color:#E01E5A">' + e.message + '</span>';
    }
  }

  // ── Public API ──
  return {
    init, openASM, closeASM,
    showImportModal, downloadSample, doImport,
    filterCatalogue, addToSBS, removeFromSBS,
    updateInput, setRoomName, editOutput, saveToReady, reviewCheck, setRisSort,
    reopenReady, removeReady, clearReady, exportReady, exportToPDF, _runExport, sbsFont, switchCatalogue, showCategoryGallery, exitGallery, addManualRow, editManualRow,
    saveProject, showProjects, loadProject, deleteProject,
    showPricing, startASMPayment,
    openImageModal, closeImageModal, modalNav
  };
})();

document.addEventListener('DOMContentLoaded', () => ASMModule.init());

// ============================================================================
// CSS (injected on first open)
// ============================================================================
const ASM_CSS = `
#asm-fullpage {
  position: fixed; inset: 0; z-index: 9999;
  background: #1A1D21;
  display: none; flex-direction: column;
  font-family: 'Lato', -apple-system, sans-serif;
  color: #D1D2D3;
}

.asm-topbar {
  height: 56px; flex-shrink: 0;
  background: #350D36;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
}
.asm-logo-svg { flex-shrink: 0; }
.asm-title { font-size: 18px; font-weight: 900; letter-spacing: .5px; display: flex; align-items: center; gap: 10px; }
.asm-topbar-actions { display: flex; align-items: center; gap: 8px; }
.asm-top-btn { background: rgba(255,255,255,.1); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background .2s; font-family: inherit; }
.asm-top-btn:hover { background: rgba(255,255,255,.2); }
.asm-save-btn { background: rgba(236,178,46,.2); color: #ECB22E; }
.asm-save-btn:hover { background: rgba(236,178,46,.3); }
.asm-close {
  background: rgba(255,255,255,.12); border: none; color: #fff;
  width: 34px; height: 34px; border-radius: 6px; font-size: 18px; cursor: pointer;
  transition: background .2s;
}
.asm-close:hover { background: rgba(255,255,255,.25); }

.asm-body {
  flex: 1; display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: 1px; background: #2C2D30; overflow: hidden;
}

.asm-col { background: #1A1D21; display: flex; flex-direction: column; overflow: hidden; }
.asm-col-head {
  padding: 12px 16px; font-size: 12px; font-weight: 800; letter-spacing: .8px;
  color: #ECB22E; background: #222529; border-bottom: 2px solid #4A154B; flex-shrink: 0;
}

/* CATALOGUE (left) */
.asm-search {
  margin: 10px 12px; padding: 8px 12px; border-radius: 6px;
  border: 1px solid #3A3D42; background: #222529; color: #D1D2D3; font-size: 13px;
}
.asm-search:focus { outline: none; border-color: #ECB22E; }
.asm-cat-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
.asm-cat-group-label {
  font-size: 10px; font-weight: 800; color: #7A7D82; letter-spacing: 1px;
  padding: 12px 8px 6px; text-transform: uppercase;
}
.asm-cat-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; margin: 2px 0; border-radius: 6px; cursor: pointer;
  font-size: 13px; transition: background .15s;
  border-left: 3px solid transparent;
}
.asm-cat-item:hover { background: #2C2D30; border-left-color: #ECB22E; }
.asm-cat-locked { opacity: .5; }
.asm-cat-locked:hover { border-left-color: #E01E5A; }
.asm-cat-locked .asm-cat-item-name { color: #7A7D82; }
.asm-cat-item-name { color: #D1D2D3; }
.asm-cat-item-add {
  width: 20px; height: 20px; border-radius: 4px; background: #4A154B; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700;
  opacity: 0; transition: opacity .15s;
}
.asm-cat-item:hover .asm-cat-item-add { opacity: 1; }

/* SBS (middle) */
.asm-sbs-body { flex: 1; overflow-y: auto; padding: 16px; }
.asm-sbs-body .asm-out-table, .asm-sbs-body .asm-out-table input { font-size: var(--sbs-font, 14px); }
.asm-sbs-empty {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #5A5D62; text-align: center; gap: 12px; font-size: 14px;
}
.asm-sbs-empty-icon { font-size: 48px; opacity: .4; }

.asm-sbs-item {
  background: #222529; border: 1px solid #3A3D42; border-radius: 10px;
  margin-bottom: 18px; overflow: hidden;
}
.asm-sbs-item-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #2C2D30; border-bottom: 1px solid #3A3D42;
}
.asm-sbs-item-title { font-size: 15px; font-weight: 800; color: #fff; }
.asm-sbs-item-remove {
  background: none; border: none; color: #7A7D82; cursor: pointer; font-size: 16px;
  width: 28px; height: 28px; border-radius: 5px; transition: all .15s;
}
.asm-sbs-item-remove:hover { background: rgba(224,30,90,.15); color: #E01E5A; }

.asm-sbs-item-inputs {
  padding: 14px 16px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 18px;
  background: #1E2125;
}
.asm-input-row { display: flex; align-items: center; gap: 10px; }
.asm-input-row label { flex: 1; font-size: 12px; color: #ABABAD; }
.asm-input-row input[type=number], .asm-input-row select {
  width: 90px; padding: 6px 8px; border-radius: 5px;
  border: 1px solid #3A3D42; background: #14161A; color: #fff; font-size: 13px; text-align: right;
}
.asm-input-row select { width: 130px; text-align: left; }
.asm-input-row input:focus, .asm-input-row select:focus { outline: none; border-color: #ECB22E; }

/* toggle switch */
.asm-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.asm-switch input { opacity: 0; width: 0; height: 0; }
.asm-slider {
  position: absolute; inset: 0; cursor: pointer; background: #3A3D42;
  border-radius: 22px; transition: .2s;
}
.asm-slider:before {
  content: ""; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px;
  background: #fff; border-radius: 50%; transition: .2s;
}
.asm-switch input:checked + .asm-slider { background: #ECB22E; }
.asm-switch input:checked + .asm-slider:before { transform: translateX(18px); }

.asm-sbs-item-outputs { padding: 0 16px 14px; }

.asm-sbs-item-diagram-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 16px;
  background: #1A1D21;
  border-bottom: 1px solid #292B2F;
  align-items: stretch;
}

.asm-ref-images {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px;
  background: rgba(0,0,0,.2);
  border-radius: 6px;
}

.asm-ref-image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all .2s;
}

.asm-ref-image-item:hover {
  opacity: .85;
  transform: scale(1.04);
}

.asm-ref-image-item img {
  width: 280px;
  height: 220px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #3A3D42;
  background: #14161A;
  padding: 4px;
  cursor: pointer;
}

.asm-ref-label {
  font-size: 11px;
  color: #7A7D82;
  text-align: center;
  max-width: 280px;
  word-break: break-word;
  font-weight: 600;
}

.asm-sbs-item-diagram {
  width: 100%;
  text-align: center;
  padding: 16px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.2);
  border: 1px solid #3A3D42;
  border-radius: 6px;
}

.asm-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000; opacity: 0; visibility: hidden; transition: all .3s;
}
.asm-modal-overlay.show { opacity: 1; visibility: visible; }
.asm-modal-content {
  position: relative; background: #1A1D21; border-radius: 8px;
  max-width: 90vw; max-height: 90vh; overflow: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.6);
}
.asm-modal-image {
  width: auto; height: auto; display: block;
  max-width: 90vw; max-height: 85vh; object-fit: contain;
}
.asm-modal-close {
  position: absolute; top: 12px; right: 12px; width: 32px; height: 32px;
  background: rgba(0,0,0,.6); border: none; border-radius: 4px; color: #fff;
  font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  z-index: 10001; transition: all .2s;
}
.asm-modal-close:hover { background: rgba(0,0,0,.9); }

.asm-out-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.asm-out-table th {
  text-align: left; padding: 8px 10px; color: #7A7D82; font-weight: 700;
  border-bottom: 1px solid #3A3D42; font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
}
.asm-out-table td { padding: 7px 10px; border-bottom: 1px solid #292B2F; }
.asm-out-name { font-weight: 700; color: #D1D2D3; }
.asm-out-num { text-align: right; font-family: 'Inconsolata', monospace; color: #ECB22E; font-weight: 600; }
.asm-out-remark { color: #8A8D92; font-size: 11px; }

/* editable output cells */
.asm-cell {
  background: #222529; border: 1px solid #3A3D42; color: inherit; font: inherit;
  padding: 4px 6px; width: 100%; border-radius: 4px; box-sizing: border-box;
}
.asm-cell:hover { border-color: #3A3D42; }
.asm-cell:focus { outline: none; border-color: #ECB22E; background: #14161A; }
.asm-cell-num { text-align: right; width: 70px; color: #ECB22E; font-family: 'Inconsolata', monospace; font-weight: 600; }
.asm-cell-remark { color: #8A8D92; font-size: 11px; }
td .asm-cell { font-weight: 700; color: #D1D2D3; }
td .asm-cell-num { font-weight: 600; color: #ECB22E; }
.asm-out-conditional { background: rgba(74,21,75,.18); }
.asm-out-empty { text-align: center; color: #5A5D62; padding: 16px; font-style: italic; }
.asm-sbs-item-summary { margin-top: 10px; font-size: 11px; color: #7A7D82; text-align: right; }

.asm-sbs-item-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 12px 16px; background: #1E2125; border-top: 1px solid #3A3D42;
}

/* RIS (right) */
.asm-ris-list { flex: 1; overflow-y: auto; padding: 12px; }
.asm-ris-item {
  background: #222529; border: 1px solid #3A3D42; border-radius: 8px;
  padding: 10px 12px; margin-bottom: 8px;
}
.asm-ris-item-head { display: flex; align-items: center; gap: 8px; }
.asm-ris-num {
  width: 22px; height: 22px; border-radius: 50%; background: #4A154B; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.asm-ris-name { flex: 1; font-size: 13px; font-weight: 700; color: #fff; }
.asm-ris-remove {
  background: none; border: none; color: #7A7D82; cursor: pointer; font-size: 14px;
  width: 24px; height: 24px; border-radius: 4px;
}
.asm-ris-remove:hover { background: rgba(224,30,90,.15); color: #E01E5A; }
.asm-ris-meta { font-size: 11px; color: #7A7D82; margin-top: 5px; padding-left: 30px; }
.asm-ris-foot {
  flex-shrink: 0; padding: 12px; border-top: 1px solid #3A3D42;
  display: flex; flex-direction: column; gap: 8px;
}

.asm-empty { text-align: center; color: #5A5D62; padding: 30px 16px; font-size: 13px; line-height: 1.6; }

/* buttons */
.asm-btn {
  padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700;
  cursor: pointer; border: none; transition: all .15s; font-family: inherit;
}
.asm-btn-primary { background: #ECB22E; color: #1A1D21; }
.asm-btn-primary:hover { background: #f5c044; }
.asm-btn-secondary { background: #4A154B; color: #fff; }
.asm-btn-secondary:hover { background: #611f64; }
.asm-btn-ghost { background: transparent; color: #ABABAD; border: 1px solid #3A3D42; }
.asm-btn-ghost:hover { background: #2C2D30; color: #fff; }

/* toast */
.asm-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
  padding: 12px 22px; border-radius: 8px; font-size: 13px; font-weight: 600;
  z-index: 10001; opacity: 0; transition: all .3s; color: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
}
.asm-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.asm-toast-success { background: #2EB67D; }
.asm-toast-error { background: #E01E5A; }
.asm-toast-info { background: #36C5F0; color: #1A1D21; }

/* responsive */
@media (max-width: 900px) {
  .asm-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .asm-catalogue { max-height: 180px; }
  .asm-ris { max-height: 200px; }
  .asm-sbs-item-inputs { grid-template-columns: 1fr; }
}
`;
