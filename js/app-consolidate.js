// ══ MATERIAL CONSOLIDATION ══
// Detects compound material names (e.g. "DW UPTO 400; SDL-1013 SF ABOVE 400")
// and lets the user map them onto a base material so they share stock sheets
// instead of each burning a near-empty sheet. Mapping persists in localStorage.

const MatConsolidate = (function () {
  const LS_KEY = 'ecl_mat_map';

  function loadMap() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMap(m) { localStorage.setItem(LS_KEY, JSON.stringify(m)); }

  function isCompound(name) {
    return /;|UPTO|ABOVE/i.test(name || '');
  }

  // materials present in panels that look compound and have no mapping yet
  function unmappedCompounds() {
    const map = loadMap();
    const mats = [...new Set(panelRows.map(p => (p.material || '').trim()).filter(Boolean))];
    return mats.filter(m => isCompound(m) && !(m in map));
  }

  function needsPrompt() { return unmappedCompounds().length > 0; }

  // effective material for payload
  function mapMaterial(name) {
    const map = loadMap();
    const t = (name || '').trim();
    return (map[t] && map[t] !== '__separate__') ? map[t] : t;
  }

  function open(onDone) {
    const compounds = unmappedCompounds();
    const allMats = [...new Set([
      ...stockRows.map(s => (s.material || '').trim()),
      ...panelRows.map(p => (p.material || '').trim()),
    ].filter(m => m && !isCompound(m)))];

    let modal = document.getElementById('matcons-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'matcons-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10006;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--sl-bg2,#3b1f3f);color:var(--text,#f3e9f5);border:1px solid var(--sl-line,#5e3565);border-radius:10px;padding:20px;width:560px;max-width:100%;font-family:system-ui,sans-serif">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Combine materials to save sheets?</div>
        <div style="font-size:12px;color:var(--text2,#c9a7d0);margin-bottom:14px">
          These conditional materials each use their own sheet. If they're cut from the same
          physical board as another material, combine them — often saves 1+ sheet per job.
        </div>
        ${compounds.map((m, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="flex:1;font-size:12px;word-break:break-all">${esc(m)}</span>
            <select id="mc-sel-${i}" style="padding:6px;background:#2e1832;border:1px solid #5e3565;color:#f3e9f5;border-radius:5px;font-size:12px;max-width:200px">
              <option value="__separate__">Keep separate</option>
              ${allMats.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
            </select>
          </div>`).join('')}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button id="mc-skip" style="padding:8px 14px;border:1px solid var(--sl-line,#5e3565);border-radius:6px;background:transparent;color:inherit;cursor:pointer">Keep all separate</button>
          <button id="mc-apply" style="padding:8px 14px;border:0;border-radius:6px;background:var(--sl-yellow,#f5b301);color:#3a2400;font-weight:700;cursor:pointer">Apply &amp; Optimize</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('mc-skip').onclick = () => {
      const map = loadMap();
      compounds.forEach(m => { map[m] = '__separate__'; });
      saveMap(map);
      modal.remove();
      onDone && onDone();
    };
    document.getElementById('mc-apply').onclick = () => {
      const map = loadMap();
      compounds.forEach((m, i) => { map[m] = document.getElementById('mc-sel-' + i).value; });
      saveMap(map);
      modal.remove();
      onDone && onDone();
    };
  }

  // allow user to reset mappings (call from console or wire to a small link)
  function reset() { localStorage.removeItem(LS_KEY); }

  return { needsPrompt, open, mapMaterial, reset, isCompound };
})();
