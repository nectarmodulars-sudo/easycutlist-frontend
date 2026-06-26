// ══ REVIEW — Pre-optimize panel & stock validation ══

function openReview() {
  if (!panelRows.length) { alert('Add panels first.'); return; }

  // Free users see info-only modal
  if (typeof hasFeature === 'function' && !hasFeature('reviewCheck')) {
    showReviewInfoModal();
    return;
  }

  const errors = [];
  const warnings = [];

  // ── Build helper maps ──
  const stockMats = [...new Set(stockRows.map(s => s.material))];
  const matchMat = document.getElementById('mat-toggle')?.checked !== false;

  const grainMap = {};
  stockRows.forEach(s => { if (s.grainLocked) grainMap[s.material] = true; });

  const stockMaxW = {}, stockMaxH = {};
  stockRows.forEach(s => {
    const m = s.material;
    stockMaxW[m] = Math.max(stockMaxW[m] || 0, s.l);
    stockMaxH[m] = Math.max(stockMaxH[m] || 0, s.w);
  });

  // ── Panel checks ──
  panelRows.forEach((p, i) => {
    const row = i + 1;
    const w = parseFloat(p.l);
    const h = parseFloat(p.w);
    const qty = parseInt(p.qty);
    const mat = (p.material || '').trim();

    if (!w || isNaN(w) || w <= 0) errors.push({ row, msg: `Width is missing or zero` });
    if (!h || isNaN(h) || h <= 0) errors.push({ row, msg: `Height is missing or zero` });
    if (!qty || isNaN(qty)) errors.push({ row, msg: `Quantity is missing` });
    if (qty === 0) errors.push({ row, msg: `Quantity is 0` });

    if (w > 0 && w < 40) warnings.push({ row, msg: `Width is ${w}mm — very small panel` });
    if (h > 0 && h < 40) warnings.push({ row, msg: `Height is ${h}mm — very small panel` });
    if (qty > 20) warnings.push({ row, msg: `Qty is ${qty} — unusually high` });

    if (matchMat && mat && !stockMats.includes(mat)) {
      errors.push({ row, msg: `Material "${mat}" not found in stock sheets` });
    }

    if (w > 0 && h > 0 && mat && stockMaxW[mat] !== undefined) {
      const maxW = stockMaxW[mat];
      const maxH = stockMaxH[mat];
      const fitsNormal = w <= maxW && h <= maxH;
      const fitsRotated = h <= maxW && w <= maxH;

      if (grainMap[mat]) {
        if (!fitsNormal) {
          errors.push({ row, msg: `${w}×${h}mm won't fit in ${maxW}×${maxH}mm stock (grain locked)` });
        }
      } else {
        if (!fitsNormal && !fitsRotated) {
          errors.push({ row, msg: `${w}×${h}mm exceeds ${maxW}×${maxH}mm stock` });
        }
      }
    }
  });

  // ── Material typos ──
  const allMats = [...new Set([
    ...panelRows.map(p => p.material || ''),
    ...stockRows.map(s => s.material || '')
  ])].filter(Boolean);

  allMats.forEach(m => {
    if (m !== m.trim()) warnings.push({ row: '–', msg: `Material "${m}" has extra spaces` });
    if (/[.;,]$/.test(m)) warnings.push({ row: '–', msg: `Material "${m}" has trailing punctuation` });
  });

  const normalized = {};
  allMats.forEach(m => {
    const key = m.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized[key]) normalized[key] = [];
    normalized[key].push(m);
  });
  Object.values(normalized).forEach(group => {
    if (group.length > 1) {
      warnings.push({ row: '–', msg: `Similar materials found: "${group.join('" and "')}"` });
    }
  });

  // ── Stock checks ──
  stockRows.forEach((s, i) => {
    const row = `S${i + 1}`;
    if (!s.qty || parseInt(s.qty) === 0) errors.push({ row, msg: `Stock sheet quantity is 0` });
    if (!s.l || s.l <= 0) errors.push({ row, msg: `Stock sheet width is missing` });
    if (!s.w || s.w <= 0) errors.push({ row, msg: `Stock sheet height is missing` });
  });

  showReviewModal(errors, warnings);
}

function showReviewModal(errors, warnings) {
  let existing = document.getElementById('review-modal');
  if (existing) existing.remove();

  const hasIssues = errors.length > 0 || warnings.length > 0;
  const total = panelRows.length + stockRows.length;

  let issuesHtml = '';

  if (!hasIssues) {
    issuesHtml = `
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:40px;margin-bottom:10px">✅</div>
        <div style="font-size:15px;font-weight:700;color:#38a169">All Clear!</div>
        <div style="font-size:12px;color:#888;margin-top:4px">${panelRows.length} panels and ${stockRows.length} stock sheets checked — no issues found.</div>
      </div>`;
  }

  if (errors.length > 0) {
    issuesHtml += `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#e53e3e;display:inline-block"></span>
          <span style="font-size:12px;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:.5px">Errors — must fix (${errors.length})</span>
        </div>
        ${errors.map(e => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:rgba(229,62,62,.08);border-left:3px solid #e53e3e;border-radius:0 6px 6px 0;margin-bottom:4px">
            <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:#e53e3e;min-width:36px;padding-top:1px">#${e.row}</span>
            <span style="font-size:12px;color:#c53030">${esc(e.msg)}</span>
          </div>`).join('')}
      </div>`;
  }

  if (warnings.length > 0) {
    issuesHtml += `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:#d69e2e;display:inline-block"></span>
          <span style="font-size:12px;font-weight:700;color:#d69e2e;text-transform:uppercase;letter-spacing:.5px">Warnings — please review (${warnings.length})</span>
        </div>
        ${warnings.map(w => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:rgba(214,158,46,.08);border-left:3px solid #d69e2e;border-radius:0 6px 6px 0;margin-bottom:4px">
            <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:#d69e2e;min-width:36px;padding-top:1px">#${w.row}</span>
            <span style="font-size:12px;color:#975a16">${esc(w.msg)}</span>
          </div>`).join('')}
      </div>`;
  }

  const html = `
  <div class="modal-overlay" id="review-modal" style="display:flex;z-index:9999" onclick="if(event.target===this)closeReview()">
    <div style="background:var(--sl-bg2,#1D1C1D);color:var(--sl-text,#fff);border-radius:12px;width:480px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)">

      <div style="padding:20px 24px 0;flex-shrink:0">
        <div style="font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px">
          🔍 Review (Error Check)
        </div>
        <div style="font-size:12px;color:var(--sl-text3,#999);margin-top:4px">
          Validates your panels and stock sheets before optimizing to catch common mistakes.
        </div>
      </div>

      <div style="padding:16px 24px;overflow-y:auto;flex:1">
        ${issuesHtml}
      </div>

      <div style="padding:0 24px 16px;flex-shrink:0">
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-ghost" onclick="closeReview()">Close</button>
          ${!errors.length ? `<button class="btn btn-accent" onclick="closeReview();calculate()" style="font-weight:700">▶ Run Optimizer</button>` : ''}
        </div>
      </div>

    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeReview() {
  const m = document.getElementById('review-modal');
  if (m) m.remove();
}

function showReviewInfoModal() {
  let existing = document.getElementById('review-modal');
  if (existing) existing.remove();

  const html = `
  <div class="modal-overlay" id="review-modal" style="display:flex;z-index:9999" onclick="if(event.target===this)closeReview()">
    <div style="background:var(--sl-bg2,#1D1C1D);color:var(--sl-text,#fff);border-radius:12px;width:420px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="padding:24px">
        <div style="font-size:17px;font-weight:800;margin-bottom:12px">🔍 Review (Error Check)</div>
        <div style="font-size:13px;color:var(--sl-text2,#ccc);line-height:1.7;margin-bottom:16px">
          Review automatically checks your panels and stock sheets before optimizing to catch common mistakes and save time.
        </div>
        <div style="font-size:12px;color:var(--sl-text3,#999);line-height:1.8">
          <div style="font-weight:700;margin-bottom:6px;color:var(--sl-text2,#ccc)">What it checks:</div>
          <div>✓ Missing or zero dimensions & quantities</div>
          <div>✓ Very small panels (under 40mm)</div>
          <div>✓ Panels too large for stock sheets</div>
          <div>✓ Grain lock conflicts</div>
          <div>✓ Material name typos & mismatches</div>
          <div>✓ Unusually high quantities</div>
          <div>✓ Stock sheet issues</div>
        </div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-ghost" onclick="closeReview()">Close</button>
          <button class="btn btn-accent" onclick="closeReview();showUpgrade('Review (Error Check)')" style="font-weight:700">⭐ Upgrade to Pro</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}
