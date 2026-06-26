'use strict';

/* ──────────────────────────────────────────────────────────────────────────
   EdgebandShow — EasyCutList integration module
   Loaded by index.html via <script src="eband.js"></script>.

   Field-name note for this app:
     panelRows[i].l = WIDTH  (the "W" column)
     panelRows[i].w = HEIGHT (the "H" column)
   So edge mapping is:  Left/Right band → reduce .l ;  Top/Bottom band → reduce .w

   index.html calls:
     EBand.init({ getPanels, onSaved })   once at startup
     EBand.open()                          → EBand button onclick
     EBand.deductForPayload(p)             → {l, w} cut values for the optimize payload
     EBand.drawBands({x,y,pw,ph,band,rotated,print})  → SVG string, inside buildSVG
   ────────────────────────────────────────────────────────────────────────── */

const EBand = (function () {

  const BAND_COLOR    = '#1f9e3a';
  const LINE_W        = 2.5;
  const INSET         = 11;
  const BADGE_R       = 8;

  let getPanels = () => [];
  let onSaved   = () => {};
  let deductEnabled = true;

  function init(opts) {
    getPanels = opts.getPanels;
    onSaved   = opts.onSaved || (() => {});
    ensureModal();
  }

  function band(p) {
    if (!p.band) p.band = { l: 0, r: 0, t: 0, b: 0 };
    return p.band;
  }

  // Returns the deducted {l, w} for THIS app's field convention.
  //   l = width  → subtract (left + right)
  //   w = height → subtract (top + bottom)
  function deductForPayload(p) {
    const l0 = parseFloat(p.l) || 0;
    const w0 = parseFloat(p.w) || 0;
    if (!deductEnabled || !p.band) return { l: l0, w: w0 };
    const b = p.band;
    return {
      l: Math.max(1, l0 - ((+b.l || 0) + (+b.r || 0))),
      w: Math.max(1, w0 - ((+b.t || 0) + (+b.b || 0))),
    };
  }

  function isDeductOn() { return deductEnabled; }

  // Draw band lines+badges for one placed piece.
  function drawBands(ctx) {
    const { x, y, pw, ph, rotated } = ctx;
    let b = ctx.band || { l:0, r:0, t:0, b:0 };
    if (!b || (!b.l && !b.r && !b.t && !b.b)) return '';

    // packer rotates piece -90° (w/h swap). Physical edges remap:
    //   L→T, T→R, R→B, B→L
    if (rotated) b = { t: b.l, r: b.t, b: b.r, l: b.b };

    const col = BAND_COLOR;
    let o = '';
    const ins = Math.min(INSET, pw * 0.28, ph * 0.28);

    // Size of the gap left in the band line so the dimension text reads through.
    const GAP = 26;

    function badge(mx, my, val) {
      const txt = String(val);
      if (txt.length <= 1) {
        o += `<circle cx="${mx}" cy="${my}" r="${BADGE_R}" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      } else {
        const w = 8 + txt.length * 6;
        o += `<rect x="${mx - w/2}" y="${my - BADGE_R}" width="${w}" height="${BADGE_R*2}" rx="${BADGE_R}" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      }
      o += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-size="9" font-family="sans-serif" font-weight="700" fill="#fff">${txt}</text>`;
    }

    // Horizontal line from a→b at height yy, with a gap centred at gapAt (skip gap if 0 width).
    function hLine(a, bX, yy, gapAt) {
      if (gapAt == null) { o += `<line x1="${a}" y1="${yy}" x2="${bX}" y2="${yy}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`; return; }
      const g1 = gapAt - GAP/2, g2 = gapAt + GAP/2;
      if (g1 > a)  o += `<line x1="${a}" y1="${yy}" x2="${g1}" y2="${yy}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
      if (g2 < bX) o += `<line x1="${g2}" y1="${yy}" x2="${bX}" y2="${yy}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
    }
    // Vertical line from a→b at xx, with a gap centred at gapAt.
    function vLine(a, bY, xx, gapAt) {
      if (gapAt == null) { o += `<line x1="${xx}" y1="${a}" x2="${xx}" y2="${bY}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`; return; }
      const g1 = gapAt - GAP/2, g2 = gapAt + GAP/2;
      if (g1 > a)  o += `<line x1="${xx}" y1="${a}" x2="${xx}" y2="${g1}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
      if (g2 < bY) o += `<line x1="${xx}" y1="${g2}" x2="${xx}" y2="${bY}" stroke="${col}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
    }

    const cxMid = x + pw/2;   // where the width dimension sits (top edge, centred)
    const cyMid = y + ph/2;   // where the height dimension sits (right edge, centred)

    // TOP band: horizontal line, gap at horizontal centre (width dim)
    if (b.t > 0) {
      const yy = y + ins;
      hLine(x + ins, x + pw - ins, yy, cxMid);
      if (pw > 40) badge(x + pw * 0.25, yy, b.t);
    }
    // BOTTOM band: horizontal line, no dim there → no gap
    if (b.b > 0) {
      const yy = y + ph - ins;
      hLine(x + ins, x + pw - ins, yy, null);
      if (pw > 40) badge(x + pw * 0.25, yy, b.b);
    }
    // LEFT band: vertical line, gap at vertical centre (height dim is on the right,
    //   but the centre label runs vertically through the middle — gap keeps it clear)
    if (b.l > 0) {
      const xx = x + ins;
      vLine(y + ins, y + ph - ins, xx, cyMid);
      if (ph > 40) badge(xx, y + ph * 0.25, b.l);
    }
    // RIGHT band: vertical line, gap at vertical centre (height dim)
    if (b.r > 0) {
      const xx = x + pw - ins;
      vLine(y + ins, y + ph - ins, xx, cyMid);
      if (ph > 40) badge(xx, y + ph * 0.25, b.r);
    }
    return o;
  }

  // ── Modal (dark theme matching EasyCutList) ──
  function ensureModal() {
    if (document.getElementById('eband-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'eband-modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:flex-start;justify-content:center;padding:30px;overflow:auto;z-index:9999';
    wrap.innerHTML = `
      <div style="background:var(--sl-bg2,#3b1f3f);color:var(--text,#f3e9f5);border:1px solid var(--sl-line,#5e3565);border-radius:10px;padding:20px;width:560px;max-width:100%;font-family:system-ui,sans-serif">
        <div style="font-size:16px;font-weight:700;margin:0 0 14px">Edge Banding Setup</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" id="eb-deduct" checked style="width:18px;height:18px;accent-color:#2e9e4e">
          Deduct edge band thickness from cut size before optimizing
        </label>
        <div style="font-size:11px;color:var(--text2,#c9a7d0);margin:4px 0 0">L+R subtracted from W, T+B from H. Piece is cut smaller; final size + band = original.</div>
        <div style="height:1px;background:var(--sl-line,#5e3565);margin:14px 0"></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text2,#c9a7d0);min-width:140px">Default thickness (mm)</span>
          ${['L','R','T','B'].map(k=>`
            <span style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <span style="font-size:10px;color:var(--text2,#c9a7d0)">${k}</span>
              <input id="eb-def-${k}" value="${k==='B'?'0':'2'}" style="width:48px;text-align:center;padding:3px;border:1px solid var(--sl-line,#5e3565);border-radius:4px;background:var(--sl-input,#2e1832);color:#f3e9f5">
            </span>`).join('')}
          <button id="eb-fill" style="padding:5px 10px;border:1px solid var(--sl-line,#5e3565);border-radius:5px;background:var(--sl-bg2,#4a2850);color:inherit;cursor:pointer">Auto-fill all ↓</button>
        </div>
        <div style="font-size:11px;color:var(--text2,#c9a7d0);margin:6px 0 0">Editing a default fills every panel below. You can still override any panel.</div>
        <div style="height:1px;background:var(--sl-line,#5e3565);margin:14px 0"></div>
        <div style="max-height:300px;overflow:auto;border:1px solid var(--sl-line,#5e3565);border-radius:6px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="position:sticky;top:0;background:var(--sl-bg2,#4a2850)">
              <th style="padding:5px 8px;text-align:left;color:var(--text2,#c9a7d0);font-size:11px">#</th>
              <th style="padding:5px 8px;text-align:left;color:var(--text2,#c9a7d0);font-size:11px">W</th>
              <th style="padding:5px 8px;text-align:left;color:var(--text2,#c9a7d0);font-size:11px">H</th>
              <th style="padding:5px 8px;color:var(--text2,#c9a7d0);font-size:11px">L</th>
              <th style="padding:5px 8px;color:var(--text2,#c9a7d0);font-size:11px">R</th>
              <th style="padding:5px 8px;color:var(--text2,#c9a7d0);font-size:11px">T</th>
              <th style="padding:5px 8px;color:var(--text2,#c9a7d0);font-size:11px">B</th>
            </tr></thead>
            <tbody id="eb-body"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button id="eb-cancel" style="padding:7px 14px;border:1px solid var(--sl-line,#5e3565);border-radius:6px;background:transparent;color:inherit;cursor:pointer">Cancel</button>
          <button id="eb-save" style="padding:7px 14px;border:0;border-radius:6px;background:var(--sl-yellow,#f5b301);color:#3a2400;font-weight:700;cursor:pointer">Save</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('eb-cancel').onclick = close;
    document.getElementById('eb-save').onclick   = save;
    document.getElementById('eb-fill').onclick    = applyDefaults;
    ['L','R','T','B'].forEach(k=>{ document.getElementById('eb-def-'+k).oninput = applyDefaults; });
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  }

  function open() {
    const panels = getPanels();
    if (!panels || !panels.length) { alert('Add or import panels first.'); return; }
    ensureModal();
    renderGrid();
    document.getElementById('eb-deduct').checked = deductEnabled;
    document.getElementById('eband-modal').style.display = 'flex';
  }
  function close() { document.getElementById('eband-modal').style.display = 'none'; }

  function renderGrid() {
    const panels = getPanels();
    document.getElementById('eb-body').innerHTML = panels.map((p,i)=>{
      const b = band(p);
      const cell = (edge,v)=>`<td style="padding:3px 6px;text-align:center"><input id="eb-${edge}-${i}" value="${v}" style="width:50px;text-align:center;padding:3px;border:1px solid var(--sl-line,#5e3565);border-radius:4px;background:var(--sl-input,#2e1832);color:#f3e9f5"></td>`;
      return `<tr>
        <td style="padding:3px 8px;color:var(--text2,#c9a7d0)">${i+1}</td>
        <td style="padding:3px 8px">${p.l ?? ''}</td>
        <td style="padding:3px 8px">${p.w ?? ''}</td>
        ${cell('l',b.l)}${cell('r',b.r)}${cell('t',b.t)}${cell('b',b.b)}
      </tr>`;
    }).join('');
  }

  function applyDefaults() {
    const panels = getPanels();
    const d = k => { const v = parseFloat(document.getElementById('eb-def-'+k).value); return isNaN(v)?0:v; };
    const dl=d('L'), dr=d('R'), dt=d('T'), db=d('B');
    panels.forEach((p,i)=>{
      setV(`eb-l-${i}`,dl); setV(`eb-r-${i}`,dr); setV(`eb-t-${i}`,dt); setV(`eb-b-${i}`,db);
    });
  }

  function save() {
    const panels = getPanels();
    deductEnabled = document.getElementById('eb-deduct').checked;
    panels.forEach((p,i)=>{
      p.band = { l:numV(`eb-l-${i}`), r:numV(`eb-r-${i}`), t:numV(`eb-t-${i}`), b:numV(`eb-b-${i}`) };
    });
    close();
    onSaved();
  }

  function setV(id,v){ const el=document.getElementById(id); if(el) el.value=v; }
  function numV(id){ const el=document.getElementById(id); const v=el?parseFloat(el.value):0; return isNaN(v)?0:v; }

  return { init, open, close, deductForPayload, isDeductOn, drawBands };
})();
