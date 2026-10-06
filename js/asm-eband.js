/* asm-eband.js — per-item Edge Band modal.
   Load BEFORE app-asm.js:

       <script src="js/asm-eband.js"></script>

   Split out of app-asm.js. It owns the whole modal and writes o.band back onto
   the instance's output rows; it holds no state of its own between calls.

       ASMEBand.open(inst, toast)

   inst   the SBS instance (needs .itemName and .outputs)
   toast  app-asm's showToast, passed in so this file needs nothing from the
          ASM closure. */

(function () {
  'use strict';

  function open(inst, toast) {
    toast = toast || function () {};
    if (!inst || !inst.outputs || !inst.outputs.length) {
      toast('No panels to edge-band', 'error');
      return;
    }

    let modal = document.getElementById('asm-eband-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-eband-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10004;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:30px;overflow:auto';

    const rowsHtml = inst.outputs.map((o, i) => {
      const b = o.band || { l: 0, r: 0, t: 0, b: 0 };
      const cell = (edge, v) => `<td style="padding:3px 6px;text-align:center"><input id="aeb-${edge}-${i}" value="${v}" style="width:50px;text-align:center;padding:3px;border:1px solid #5e3565;border-radius:4px;background:#2e1832;color:#f3e9f5"></td>`;
      return `<tr>
        <td style="padding:3px 8px;color:#c9a7d0">${i + 1}</td>
        <td style="padding:3px 8px;color:#f3e9f5">${o.component || ''}</td>
        <td style="padding:3px 8px">${o.w ?? ''}</td>
        <td style="padding:3px 8px">${o.h ?? ''}</td>
        ${cell('l', b.l || 0)}${cell('r', b.r || 0)}${cell('t', b.t || 0)}${cell('b', b.b || 0)}
      </tr>`;
    }).join('');

    modal.innerHTML = `
      <div style="background:#3b1f3f;color:#f3e9f5;border:1px solid #5e3565;border-radius:10px;padding:20px;width:620px;max-width:100%;font-family:system-ui,sans-serif">
        <div style="font-size:16px;font-weight:700;margin:0 0 6px">Edge Banding — ${inst.itemName || 'Item'}</div>
        <div style="font-size:11px;color:#c9a7d0;margin-bottom:12px">L+R subtracted from W, T+B from H at export. Piece cut smaller; final size + band = entered size.</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:13px;color:#c9a7d0;min-width:130px">Default thickness (mm)</span>
          ${['L', 'R', 'T', 'B'].map(k => `<span style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:10px;color:#c9a7d0">${k}</span>
            <input id="aeb-def-${k}" value="${k === 'B' ? '0' : '2'}" style="width:48px;text-align:center;padding:3px;border:1px solid #5e3565;border-radius:4px;background:#2e1832;color:#f3e9f5">
          </span>`).join('')}
          <button id="aeb-fill" style="padding:5px 10px;border:1px solid #5e3565;border-radius:5px;background:#4a2850;color:inherit;cursor:pointer">Auto-fill all ↓</button>
        </div>
        <div style="max-height:320px;overflow:auto;border:1px solid #5e3565;border-radius:6px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="position:sticky;top:0;background:#4a2850">
              ${['#', 'Component', 'W', 'H', 'L', 'R', 'T', 'B'].map(h => `<th style="padding:5px 8px;text-align:left;color:#c9a7d0;font-size:11px">${h}</th>`).join('')}
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button id="aeb-cancel" style="padding:7px 14px;border:1px solid #5e3565;border-radius:6px;background:transparent;color:inherit;cursor:pointer">Cancel</button>
          <button id="aeb-save" style="padding:7px 14px;border:0;border-radius:6px;background:#f5b301;color:#3a2400;font-weight:700;cursor:pointer">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const numV = id => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : 0; return isNaN(v) ? 0 : v; };
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const fill = () => {
      const d = k => { const v = parseFloat(document.getElementById('aeb-def-' + k).value); return isNaN(v) ? 0 : v; };
      const dl = d('L'), dr = d('R'), dt = d('T'), db = d('B');
      inst.outputs.forEach((o, i) => { setV(`aeb-l-${i}`, dl); setV(`aeb-r-${i}`, dr); setV(`aeb-t-${i}`, dt); setV(`aeb-b-${i}`, db); });
    };
    document.getElementById('aeb-fill').onclick = fill;
    ['L', 'R', 'T', 'B'].forEach(k => { document.getElementById('aeb-def-' + k).oninput = fill; });
    document.getElementById('aeb-cancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('aeb-save').onclick = () => {
      inst.outputs.forEach((o, i) => {
        o.band = { l: numV(`aeb-l-${i}`), r: numV(`aeb-r-${i}`), t: numV(`aeb-t-${i}`), b: numV(`aeb-b-${i}`) };
      });
      modal.remove();
      toast('Edge banding saved', 'success');
    };
  }

  window.ASMEBand = { open: open };
})();