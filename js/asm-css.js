// asm-css.js — ASM full-page styles (extracted from app-asm.js)
// Loaded before app-asm.js; injectStyles() reads window-scoped ASM_CSS.

window.ASM_CSS = `
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
  font-size: 13px; font-weight: 800; color: #ECB22E; letter-spacing: .6px;
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
.asm-row-del {
  background: transparent; border: 1px solid #3A3D42; color: #E01E5A;
  width: 24px; height: 24px; border-radius: 5px; cursor: pointer;
  font-size: 12px; line-height: 1; padding: 0;
}
.asm-row-del:hover { background: rgba(224,30,90,.15); border-color: #E01E5A; }
.asm-cell {
  background: #222529; border: 1px solid #3A3D42; color: inherit; font: inherit;
  padding: 4px 6px; width: 100%; border-radius: 4px; box-sizing: border-box;
}
.asm-cell:hover { border-color: #3A3D42; }
.asm-cell:focus { outline: none; border-color: #ECB22E; background: #14161A; }
.asm-cell-num { text-align: right; width: 70px; color: #ECB22E; font-family: 'Inconsolata', monospace; font-weight: 600; }
/* Remove the tiny up/down stepper arrows on all ASM number inputs */
.asm-cell[type=number]::-webkit-outer-spin-button,
.asm-cell[type=number]::-webkit-inner-spin-button,
.asm-input-row input[type=number]::-webkit-outer-spin-button,
.asm-input-row input[type=number]::-webkit-inner-spin-button {
  -webkit-appearance: none; appearance: none; margin: 0;
}
.asm-cell[type=number], .asm-input-row input[type=number] {
  -moz-appearance: textfield; appearance: textfield;
}
.asm-cell-remark { color: #8A8D92; font-size: 11px; }
td .asm-cell { font-weight: 700; color: #D1D2D3; }
td .asm-cell-num { font-weight: 600; color: #ECB22E; }
.asm-out-conditional { background: rgba(74,21,75,.18); }
.asm-out-empty { text-align: center; color: #5A5D62; padding: 16px; font-style: italic; }
.asm-sbs-item-summary {
  margin-top: 10px; font-size: 14px; color: #9A9DA2; text-align: right;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  flex-wrap: wrap;
}
.asm-sbs-item-summary .asm-sum-reset {
  background: #2A2D31; border: 1px solid #3A3D42; color: #ECB22E;
  border-radius: 5px; padding: 4px 12px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.asm-sbs-item-summary .asm-sum-reset:hover { border-color: #ECB22E; background: #34383D; }

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
.asm-drawer-btn { display: none; }
.asm-scrim { display: none; }

@media (max-width: 900px) {
  .asm-drawer-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer;
    background: rgba(255,255,255,.12); border: none; color: #fff;
    height: 32px; padding: 0 10px; border-radius: 6px; font-size: 15px;
    flex: 0 0 auto;
  }
  .asm-drawer-cs { margin-right: 8px; }
  .asm-drawer-ris { background: rgba(236,178,46,.2); color: #ECB22E; font-size: 13px; }
  #asm-ris-badge { font-weight: 700; }

  /* Topbar: CS + title on the left, actions (incl. RIS) pinned hard right */
  .asm-topbar { gap: 6px; padding: 0 10px; }
  .asm-title {
    min-width: 0; overflow: hidden; flex: 1 1 auto; gap: 6px;
    font-size: 14px;
  }
  .asm-title > img, .asm-logo-svg { display: none; }   /* logo eats room on mobile */
  .asm-topbar-actions { flex: 0 0 auto; margin-left: auto; gap: 6px; }
  /* RIS is the rightmost control on mobile */
  .asm-drawer-ris { order: 99; margin-left: 4px; }
  .asm-title > span:first-of-type {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 14px; max-width: 120px;
  }
  #asm-project-name { display: none; } /* project name hidden on mobile to save room */

  /* Hide desktop-only topbar buttons on mobile; keep Save, New Project, Login/Logout */
  .asm-topbar-actions .asm-top-btn:not(.asm-save-btn):not(#asm-upgrade-btn):not(.asm-newproj-btn):not(#asm-login-btn):not(#asm-logout-btn) { display: none; }
  .asm-topbar-actions .asm-top-btn { padding: 5px 8px; font-size: 11px; }
  .asm-topbar-actions #asm-user-email, .asm-topbar-actions #asm-plan-badge { display: none; }

  /* SBS full-width; CS + RIS become slide-over drawers */
  .asm-body { display: block; position: relative; overflow: hidden; }
  .asm-col.asm-catalogue, .asm-col.asm-ris {
    position: absolute; top: 0; bottom: 0; z-index: 60;
    width: 84%; max-width: 330px; max-height: none;
    transition: transform .25s ease;
    background: #1A1D21;
  }
  .asm-catalogue { left: 0; transform: translateX(-100%); border-right: 1px solid rgba(255,255,255,.1); }
  .asm-ris { right: 0; transform: translateX(100%); border-left: 1px solid rgba(255,255,255,.1); }
  .asm-catalogue.drawer-open, .asm-ris.drawer-open { transform: translateX(0); }
  .asm-sbs { width: 100%; height: 100%; }

  .asm-scrim {
    display: block; position: absolute; inset: 0; z-index: 50;
    background: rgba(0,0,0,.5); opacity: 0; pointer-events: none;
    transition: opacity .25s;
  }
  .asm-scrim.show { opacity: 1; pointer-events: auto; }

  .asm-sbs-item-inputs { grid-template-columns: 1fr 1fr; }

  /* Catalogue name banner not needed on mobile — reclaim the vertical space */
  #asm-cat-banner { display: none !important; }

  /* ── Formula output as compact cards (mobile only) — R3, explicit grid ── */
  .asm-out-cards, .asm-out-cards tbody { display: block; width: 100%; }
  .asm-out-cards thead { display: none; }

  /* 12-col grid. Row 1: name | W | H | del.  Row 2: qty | color | remark. */
  .asm-out-cards tr {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 4px; row-gap: 4px;
    position: relative;
    background: #161619; border: 1px solid #262629; border-radius: 10px;
    padding: 8px 11px; margin: 0 0 6px;
  }
  .asm-out-cards tr.asm-out-conditional { border-color: #4A3D1A; }

  /* Sub-item header (colspan) — full-width band, revert grid */
  .asm-out-cards tr:has(> td[colspan]) {
    display: block; background: transparent; border: none; padding: 8px 0 2px; margin: 0;
  }
  .asm-out-cards tr > td[colspan] { display: block; border: none; background: transparent; padding: 0; }

  .asm-out-cards td { border: none; padding: 0; white-space: nowrap; display: flex; align-items: center; min-width: 0; }
  .asm-out-cards td::before { display: none; }
  .asm-out-cards td input { background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 2px 3px; min-width: 0; }
  .asm-out-cards td input:focus { outline: none; border-color: #ECB22E; background: #26292E; }

  /* Explicit placement (DOM order unchanged → patch logic safe). 12-col grid. */
  .asm-out-cards td:nth-child(1) { grid-column: 1 / 6; grid-row: 1; }           /* Component */
  .asm-out-cards td:nth-child(1) input { font-weight: 700; font-size: 15px; color: #fff; text-align: left; width: 100%; }

  .asm-out-cards td:nth-child(2) { grid-column: 8 / 10; grid-row: 1; justify-content: flex-end; }   /* W */
  .asm-out-cards td:nth-child(3) { grid-column: 10 / 12; grid-row: 1; justify-content: flex-start; }  /* H */
  .asm-out-cards td:nth-child(2) input { color: #F0A020; font-weight: 800; font-size: 15px; text-align: right; width: 100%; }
  .asm-out-cards td:nth-child(3) input { color: #F0A020; font-weight: 800; font-size: 15px; text-align: left; width: 100%; }
  .asm-out-cards td:nth-child(3)::before { display: inline; content: "\\00D7"; color: #6A6A6E; font-size: 13px; margin: 0 4px 0 0; flex: 0 0 auto; }

  .asm-out-cards td:nth-child(7) { grid-column: 12 / 13; grid-row: 1; justify-content: flex-end; }  /* delete */
  .asm-out-cards td:nth-child(7) .asm-row-del {
    width: 26px; height: 26px; font-size: 13px; padding: 0; line-height: 1;
    background: rgba(224,30,90,.15); border: 1px solid rgba(224,30,90,.55);
    color: #FF5C85; border-radius: 6px;
  }
  .asm-out-cards td:nth-child(7) .asm-row-del:hover {
    background: rgba(224,30,90,.28); color: #fff;
  }

  /* Row 2 — Qty | Color | Remark on 12-col grid, no collisions */
  .asm-out-cards td:nth-child(4) { grid-column: 1 / 3; grid-row: 2; justify-self: start;
    background: #232327; border-radius: 6px; padding: 2px 8px; gap: 3px; }        /* Qty */
  .asm-out-cards td:nth-child(5) { grid-column: 3 / 7; grid-row: 2; justify-self: start;
    background: #232327; border-radius: 6px; padding: 2px 8px; gap: 3px; max-width: 100%; }  /* Color */
  .asm-out-cards td:nth-child(6) { grid-column: 7 / 13; grid-row: 2; justify-self: stretch; min-width: 0; overflow: hidden; }  /* Remark */
  .asm-out-cards td:nth-child(4)::before { display: inline; content: "QTY"; color: #7A7D82; font-size: 10px; flex: 0 0 auto; }
  .asm-out-cards td:nth-child(5)::before { display: inline; content: "COL"; color: #7A7D82; font-size: 10px; flex: 0 0 auto; }
  .asm-out-cards td:nth-child(4) input { color: #F0A020; font-weight: 700; font-size: 12px; text-align: left; width: 28px; }
  .asm-out-cards td:nth-child(5) input { color: #C9A7FF; font-size: 12px; text-align: left; width: 100%; min-width: 0; }
  .asm-out-cards td:nth-child(6) input { color: #8A8D92; font-size: 12px; text-align: left; width: 100%; min-width: 0; text-overflow: ellipsis; }
  .asm-out-cards td:nth-child(6) input::placeholder { color: #3A3D42; }

  .asm-out-empty { display: block; text-align: center; padding: 20px; }

  /* Modals full-width on mobile, tables scroll horizontally */
  #quote-overlay .q-modal { width: 96vw; }
  .q-body, .asm-modal-body { overflow-x: auto; }
}
/* --- SBS input zone (brand purple) + section titles --- */
.asm-input-zone {
  background: #4A154B;
  border: 1px solid rgba(180,100,180,.35);
  border-radius: 10px;
  margin: 10px 16px 0;
  overflow: hidden;
}
.asm-zone-title {
  font-size: 13px; font-weight: 800; letter-spacing: .6px;
  color: #fff; text-transform: uppercase;
  padding: 11px 16px 2px;
}
.asm-input-zone .asm-sbs-item-inputs { background: transparent; }
.asm-out-head {
  font-size: 13px; font-weight: 800; letter-spacing: .6px;
  color: #ECB22E; text-transform: uppercase;
  padding: 10px 16px 2px; margin-top: 14px;
  border-top: 2px solid rgba(224,30,90,.55);
}

/* --- tighten input grid: label hugs its field, less dead space --- */
.asm-sbs-item-inputs {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 14px;
  padding: 12px 16px;
}
.asm-input-row { gap: 8px; align-items: center; }
.asm-input-row label { flex: 0 0 92px; line-height: 1.2; }
.asm-input-row input[type=number] { width: 82px; }
.asm-input-row select { width: 116px; }

/* --- thin red grid lines across the input cells --- */
.asm-sbs-item-inputs {
  gap: 0;
  border-top: 1px solid rgba(224,30,90,.45);
  border-left: 1px solid rgba(224,30,90,.45);
}
.asm-input-row {
  border-right: 1px solid rgba(224,30,90,.45);
  border-bottom: 1px solid rgba(224,30,90,.45);
  padding: 9px 10px;
  margin: 0;
}

/* --- fixed 4-col grid on desktop so filler cells complete every line --- */
@media (min-width: 901px) {
  .asm-sbs-item-inputs { grid-template-columns: repeat(4, minmax(150px, 1fr)); }
}
/* let the input grid scroll horizontally instead of clipping at high zoom */
#asm-fullpage .asm-sbs-item-inputs { overflow-x: auto; }

/* ===== Font controls (admin Fonts tab) — vars fall back to current values ===== */
#asm-fullpage .asm-sbs-item-title {
  font-size: var(--asm-title-size, 15px); font-weight: var(--asm-title-weight, 800); color: var(--asm-title-color, #fff);
}
#asm-fullpage .asm-zone-title {
  font-size: var(--asm-sect-size, 13px); font-weight: var(--asm-sect-weight, 800); color: var(--asm-sect-color, #fff);
}
#asm-fullpage .asm-out-head {
  font-size: var(--asm-sect-size, 13px); font-weight: var(--asm-sect-weight, 800); color: var(--asm-sect-color, #ECB22E);
}
#asm-fullpage .asm-input-row label {
  font-size: var(--asm-inlabel-size, 12px); font-weight: var(--asm-inlabel-weight, 400); color: var(--asm-inlabel-color, #ABABAD);
}
#asm-fullpage .asm-input-row input, #asm-fullpage .asm-input-row select {
  font-size: var(--asm-inbox-size, 13px); font-weight: var(--asm-inbox-weight, 400); color: var(--asm-inbox-color, #fff);
}
#asm-fullpage .asm-out-name,
#asm-fullpage .asm-out-table tbody td:first-child .asm-cell {
  font-size: var(--asm-outlabel-size, 12px); font-weight: var(--asm-outlabel-weight, 700); color: var(--asm-outlabel-color, #D1D2D3);
}
/* output value boxes: numbers keep amber default, text keeps grey default until overridden */
#asm-fullpage .asm-out-table tbody td:not(:first-child) .asm-cell,
#asm-fullpage .asm-out-num, #asm-fullpage .asm-out-remark {
  font-size: var(--asm-outbox-size, 12px); font-weight: var(--asm-outbox-weight, 600);
}
#asm-fullpage .asm-cell-num, #asm-fullpage .asm-out-num {
  color: var(--asm-outbox-color, #ECB22E);
}
#asm-fullpage .asm-out-table tbody td:not(:first-child) .asm-cell:not(.asm-cell-num) {
  color: var(--asm-outbox-color, #D1D2D3);
}

.asm-cat-explore { font-size: 10px; font-weight: 700; color: #ECB22E; letter-spacing: .3px; margin-left: 6px; text-transform: none; }
.asm-cat-group-label:hover { color: #ECB22E; }
.asm-cat-group-label:hover .asm-cat-explore { text-decoration: underline; }

/* --- per-item Video button + embed popup --- */
.asm-video-cta { display:flex; justify-content:center; margin-top:10px; }
.asm-video-btn {
  display:inline-flex; align-items:center; gap:8px;
  background:#E01E5A; color:#fff; border:none; cursor:pointer;
  padding:8px 18px; border-radius:8px; font-size:13px; font-weight:800;
  font-family:inherit; letter-spacing:.3px; transition:background .15s, transform .1s;
  box-shadow:0 2px 8px rgba(224,30,90,.35);
}
.asm-video-btn:hover { background:#f43d72; }
.asm-video-btn:active { transform:scale(.97); }
.asm-video-play {
  display:inline-flex; align-items:center; justify-content:center;
  width:18px; height:18px; border-radius:50%;
  background:rgba(255,255,255,.22); font-size:9px; line-height:1; padding-left:1px;
}
.asm-video-overlay {
  position:fixed; inset:0; z-index:10006;
  background:rgba(0,0,0,.85);
  display:flex; align-items:center; justify-content:center; padding:20px;
}
.asm-video-box { position:relative; width:min(900px,92vw); }
.asm-video-frame {
  position:relative; width:100%; padding-top:56.25%;
  background:#000; border-radius:10px; overflow:hidden;
  box-shadow:0 8px 32px rgba(0,0,0,.6);
}
.asm-video-frame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
.asm-video-close {
  position:absolute; top:-14px; right:-14px; width:36px; height:36px;
  border-radius:50%; background:#fff; color:#1A1D21; border:none; cursor:pointer;
  font-size:18px; font-weight:700; display:flex; align-items:center; justify-content:center;
  box-shadow:0 2px 10px rgba(0,0,0,.5); z-index:2;
}
.asm-video-close:hover { background:#eee; }
@media (max-width:900px){ .asm-video-close{ top:-12px; right:6px; } }



/* --- Collapsible Catalogue Space ---
   Collapsed it becomes a 34px rail; hovering it floats the full panel over the
   SBS instead of re-flowing the grid, so the 3D canvas is not resized on every
   pass of the mouse. */
.asm-cs-rail { display:none; }
@media (min-width:901px) {
  .asm-body { position:relative; }
  /* Pin every column to its own track. The collapsed catalogue is taken out of
     grid flow by position:absolute, and without explicit placement the grid
     auto-fills the gap: SBS slides into the 34px track and vanishes. */
  .asm-body > .asm-catalogue { grid-column: 1; }
  .asm-body > .asm-sbs       { grid-column: 2; }
  .asm-body > .asm-ris       { grid-column: 3; }
  #asm-fullpage.cs-collapsed .asm-body { grid-template-columns: 34px 1fr 300px; }
  #asm-fullpage.cs-collapsed .asm-catalogue {
    position:absolute; left:0; top:0; bottom:0; width:34px; z-index:80;
    overflow:hidden; transition:width .18s ease;
  }
  #asm-fullpage.cs-collapsed .asm-catalogue > .asm-col-head,
  #asm-fullpage.cs-collapsed .asm-catalogue > .asm-search,
  #asm-fullpage.cs-collapsed .asm-catalogue > .asm-cat-list { display:none; }
  #asm-fullpage.cs-collapsed .asm-catalogue .asm-cs-rail { display:flex; }
  #asm-fullpage.cs-collapsed .asm-catalogue:hover {
    width:275px; box-shadow:4px 0 22px rgba(0,0,0,.6);
  }
  #asm-fullpage.cs-collapsed .asm-catalogue:hover .asm-cs-rail { display:none; }
  #asm-fullpage.cs-collapsed .asm-catalogue:hover > .asm-col-head { display:block; }
  #asm-fullpage.cs-collapsed .asm-catalogue:hover > .asm-search { display:block; }
  #asm-fullpage.cs-collapsed .asm-catalogue:hover > .asm-cat-list { display:block; }

  /* --- same treatment for Ready Items, mirrored to the right edge --- */
  #asm-fullpage.ris-collapsed .asm-body { grid-template-columns: 240px 1fr 34px; }
  #asm-fullpage.cs-collapsed.ris-collapsed .asm-body { grid-template-columns: 34px 1fr 34px; }
  #asm-fullpage.ris-collapsed .asm-ris {
    position:absolute; right:0; top:0; bottom:0; width:34px; z-index:80;
    overflow:hidden; transition:width .18s ease;
  }
  #asm-fullpage.ris-collapsed .asm-ris > .asm-col-head,
  #asm-fullpage.ris-collapsed .asm-ris > .asm-ris-list,
  #asm-fullpage.ris-collapsed .asm-ris > .asm-ris-foot { display:none; }
  #asm-fullpage.ris-collapsed .asm-ris .asm-ris-rail { display:flex; }
  #asm-fullpage.ris-collapsed .asm-ris:hover {
    width:300px; box-shadow:-4px 0 22px rgba(0,0,0,.6);
  }
  #asm-fullpage.ris-collapsed .asm-ris:hover .asm-ris-rail { display:none; }
  #asm-fullpage.ris-collapsed .asm-ris:hover > .asm-col-head { display:flex; }
  #asm-fullpage.ris-collapsed .asm-ris:hover > .asm-ris-list { display:block; }
  #asm-fullpage.ris-collapsed .asm-ris:hover > .asm-ris-foot { display:flex; }
}
.asm-cs-rail {
  flex-direction:column; align-items:center; justify-content:flex-start;
  gap:10px; padding:12px 0; height:100%; cursor:pointer;
  background:#222529; border-right:1px solid #3A3D42; user-select:none;
}
.asm-cs-rail:hover { background:#2C2D30; }
.asm-cs-rail .ico { color:#ECB22E; font-size:14px; line-height:1; }
.asm-cs-rail .txt {
  writing-mode:vertical-rl; text-orientation:mixed;
  font-size:10.5px; font-weight:800; letter-spacing:.14em;
  text-transform:uppercase; color:#7A7D82;
}
.asm-ris-rail {
  display:none; flex-direction:column; align-items:center; justify-content:flex-start;
  gap:10px; padding:12px 0; height:100%; cursor:pointer;
  background:#222529; border-left:1px solid #3A3D42; user-select:none;
}
.asm-ris-rail:hover { background:#2C2D30; }
.asm-ris-rail .ico { color:#ECB22E; font-size:14px; line-height:1; }
.asm-ris-rail .txt {
  writing-mode:vertical-rl; text-orientation:mixed;
  font-size:10.5px; font-weight:800; letter-spacing:.14em;
  text-transform:uppercase; color:#7A7D82;
}
.asm-ris-rail .cnt {
  display:none; align-items:center; justify-content:center;
  min-width:20px; height:20px; border-radius:10px; padding:0 5px;
  background:#4A154B; color:#fff; font-size:10px; font-weight:800;
}
.asm-cs-toggle {
  background:rgba(255,255,255,.08); border:1px solid #3A3D42; color:#9AA0AB;
  border-radius:5px; width:24px; height:22px; cursor:pointer; font-size:12px;
  line-height:1; padding:0; font-family:inherit; flex:0 0 auto;
}
.asm-cs-toggle:hover { border-color:#ECB22E; color:#ECB22E; }

/* --- Input area beside the viewer, for items that have a 3D model ---
   DOM order is unchanged (diagram first, then inputs) so every existing id and
   selector still resolves; the columns are swapped with the order property instead. */
.asm-sbs-split:not(.on) { display:block; }
.asm-sbs-split.on {
  display:grid;
  grid-template-columns: minmax(290px, .8fr) minmax(540px, 1.7fr);
  gap:14px; align-items:start; padding:12px 16px;
}
.asm-sbs-split.on > .asm-sbs-inputs-col {
  order:1; align-self:stretch; min-width:0;
}
.asm-sbs-split.on > .asm-sbs-inputs-col > .asm-input-zone { margin:0 0 10px; }
.asm-sbs-split.on > .asm-sbs-item-diagram-section {
  order:2; padding:0; border-bottom:none;
  position:sticky; top:8px;          /* model stays put while inputs scroll */
}
/* the 4-across input grid does not fit a half-width column */
.asm-sbs-split.on .asm-sbs-item-inputs { grid-template-columns: repeat(2, minmax(130px,1fr)); }
.asm-sbs-split.on .asm-input-row label { flex:0 0 78px; }
.asm-sbs-split.on .asm-input-row input[type=number] { width:68px; }
.asm-sbs-split.on .asm-input-row select { width:100px; }
@media (max-width:1200px) {
  .asm-sbs-split.on { grid-template-columns:1fr; }
  .asm-sbs-split.on > .asm-sbs-inputs-col { order:2; }
  .asm-sbs-split.on > .asm-sbs-item-diagram-section { order:1; position:static; }
  .asm-sbs-split.on .asm-sbs-item-inputs { grid-template-columns:repeat(4,minmax(150px,1fr)); }
}

/* --- number steppers on the input rows ---
   The native spinners are suppressed further up (they are tiny and ignore the
   dark theme), so these are the replacement. */
.asm-num { display:inline-flex; align-items:stretch; }
#asm-fullpage .asm-num input[type=number] {
  width:64px; border-top-right-radius:0; border-bottom-right-radius:0; border-right:none;
}
.asm-num .asm-step { display:flex; flex-direction:column; width:18px; flex:0 0 18px; }
.asm-num .asm-step button {
  flex:1; min-height:11px; padding:0; cursor:pointer; font-family:inherit;
  background:#2A2D31; border:1px solid #3A3D42; color:#C9CDD4;
  font-size:7px; line-height:1;
}
.asm-num .asm-step button:first-child { border-radius:0 5px 0 0; border-bottom:none; }
.asm-num .asm-step button:last-child  { border-radius:0 0 5px 0; }
.asm-num .asm-step button:hover { background:#4A154B; border-color:#6B2A6C; color:#fff; }
.asm-num .asm-step button:active { background:#611f64; }
#asm-fullpage .asm-sbs-split.on .asm-num input[type=number] { width:54px; }

/* --- Input Area split into Dimensions and Material --- */
.asm-sbs-inputs-col { display:flex; flex-direction:column; min-width:0; }
.asm-input-zone.asm-zone-mat {
  background:#1E3A4A;
  border-color:rgba(100,170,200,.35);
}
.asm-zone-mat .asm-sbs-item-inputs {
  border-top-color:rgba(90,190,220,.42);
  border-left-color:rgba(90,190,220,.42);
}
.asm-zone-mat .asm-input-row {
  border-right-color:rgba(90,190,220,.42);
  border-bottom-color:rgba(90,190,220,.42);
}
#asm-fullpage .asm-zone-mat .asm-input-row label { color:#BFDCE8; }

/* --- SBS view tabs: Image | 3D --- */
.asm-view-tabs { display:flex; align-items:flex-end; gap:4px; padding:0 2px; margin-bottom:-1px; }
.asm-view-tab {
  display:inline-flex; align-items:center; gap:6px;
  background:#222529; border:1px solid #3A3D42; border-bottom:none; color:#9AA0AB;
  font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  padding:7px 16px 6px; cursor:pointer; border-radius:8px 8px 0 0;
  font-family:inherit; transition:background .15s, color .15s;
}
.asm-view-tab:hover { background:#2A2D31; color:#E8EAF0; }
.asm-view-tab.on {
  background:#1A1D21; color:#ECB22E; border-color:#ECB22E; border-bottom:1px solid #1A1D21;
}
.asm-view-tab .dot { width:7px; height:7px; border-radius:50%; background:#3A3D42; }
.asm-view-tab.on .dot { background:#ECB22E; }
.asm-view-pane { width:100%; }
/* the 3D canvas needs a real height — it has no intrinsic size */
.asm3d-mount { height:min(66vh, 720px); min-height:340px; }
@media (max-width:900px) { .asm3d-mount { height:340px; } }

`;