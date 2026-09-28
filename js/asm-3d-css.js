/* asm-3d-css.js — styles for the SBS 3D viewer.
   Exposes window.ASM3D_CSS; injected once by asm-3d-core.js.
   Deploy on its own whenever only the viewer chrome changes. */
window.ASM3D_CSS = `
/* ── viewer shell ─────────────────────────────────────────────── */
.asm3d-wrap{
  position:relative; width:100%; height:100%; min-height:260px;
  background:radial-gradient(120% 120% at 50% 16%,#23262e 0%,#111318 82%);
  border-radius:8px; overflow:hidden;
}
.asm3d-host{position:absolute; inset:0;}
.asm3d-host canvas{display:block; width:100%; height:100%;}

/* ── chrome-style tabs (Image | 3D) ───────────────────────────── */
.asm3d-tabs{display:flex; align-items:flex-end; gap:4px; padding:0 4px;}
.asm3d-tab{
  display:inline-flex; align-items:center; gap:6px;
  background:#222529; border:1px solid #3A3D42; border-bottom:none;
  color:#9AA0AB; font-size:11.5px; font-weight:700; letter-spacing:.04em;
  text-transform:uppercase; padding:7px 16px 6px; cursor:pointer;
  border-radius:8px 8px 0 0; font-family:inherit; transition:background .15s,color .15s;
}
.asm3d-tab:hover{background:#2A2D31; color:#E8EAF0;}
.asm3d-tab.on{background:#1A1D21; color:#ECB22E; border-color:#ECB22E; border-bottom:1px solid #1A1D21;}
.asm3d-tab .dot{width:7px; height:7px; border-radius:50%; background:#3A3D42;}
.asm3d-tab.on .dot{background:#ECB22E;}

/* ── floating toolbar ─────────────────────────────────────────── */
/* It sits over a bright room, so the bar carries its own near-black ground
   rather than relying on translucency. No amber anywhere: idle is white on
   black, active is white on brand purple. */
.asm3d-bar{
  position:absolute; left:10px; bottom:10px; z-index:14;
  display:flex; gap:5px; flex-wrap:wrap; align-items:center;
  max-width:calc(100% - 20px);
  background:#111318; border:1px solid #3A3D42; border-radius:9px;
  padding:6px; box-shadow:0 4px 18px rgba(0,0,0,.55);
}
.asm3d-bar button{
  background:#1E2125; border:1px solid #3A3D42; color:#E8EAF0;
  border-radius:6px; padding:5px 11px; font-size:10.5px; font-weight:700;
  cursor:pointer; font-family:inherit;
  letter-spacing:.03em; text-transform:uppercase;
  transition:background .15s, color .15s, border-color .15s;
}
.asm3d-bar button:hover{ background:#2A2D31; border-color:#5A5D62; color:#fff; }
.asm3d-bar button.on{ background:#4A154B; border-color:#7A3C7C; color:#fff; }
.asm3d-bar button.on:hover{ background:#611f64; }
.asm3d-ctl{
  display:inline-flex; align-items:center; gap:7px;
  background:#1E2125; border:1px solid #3A3D42; border-radius:6px;
  padding:4px 10px;
}
.asm3d-ctl .lb{
  font-size:10.5px; font-weight:700; letter-spacing:.03em;
  text-transform:uppercase; color:#E8EAF0;
}
.asm3d-ctl .val{
  font-size:10.5px; color:#fff; min-width:26px; text-align:right;
  font-family:'Inconsolata',ui-monospace,monospace;
}
.asm3d-ctl input[type=range]{ width:86px; accent-color:#7A3C7C; cursor:pointer; margin:0; }

/* ── hud + notes ──────────────────────────────────────────────── */
.asm3d-hud{
  position:absolute; left:10px; top:10px; z-index:13; max-width:270px;
  background:rgba(17,19,26,.86); border:1px solid #3A3D42; border-radius:8px;
  padding:7px 10px; font-size:10.5px; line-height:1.5; color:#9AA0AB;
  backdrop-filter:blur(6px); pointer-events:none;
}
.asm3d-hud b{color:#E8EAF0;}
.asm3d-notes{
  position:absolute; right:10px; top:10px; z-index:13; max-width:290px;
  display:flex; flex-direction:column; gap:5px;
}
.asm3d-note{
  font-size:11px; line-height:1.45; padding:6px 9px; border-radius:6px;
  border-left:3px solid; backdrop-filter:blur(6px);
}
.asm3d-note.warn{background:rgba(236,178,46,.14); border-color:#ECB22E; color:#F2E3C0;}
.asm3d-note.err {background:rgba(224,30,90,.16); border-color:#E01E5A; color:#F6C9D8;}
.asm3d-note.ok  {background:rgba(46,182,125,.14); border-color:#2EB67D; color:#BFE8D6;}

/* ── projected labels (dimensions + material codes) ───────────── */
.asm3d-labels{position:absolute; inset:0; pointer-events:none; z-index:12; overflow:hidden;}
.asm3d-labels .lb{
  position:absolute; left:0; top:0; white-space:nowrap;
  font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; letter-spacing:.02em;
}
.asm3d-labels .dim{
  background:rgba(17,19,26,.82); color:#ECB22E; border:1px solid rgba(236,178,46,.45);
  font-family:'Inconsolata',ui-monospace,monospace;
}
.asm3d-labels .mat{
  background:rgba(255,255,255,.93); color:#1A1D21; border:1px solid rgba(0,0,0,.25);
  font-size:10.5px;
}

/* ── hover move widget ────────────────────────────────────────── */
.asm3d-mover{
  position:absolute; display:none; z-index:20; transform:translate(-50%,-50%);
  border:14px solid transparent; background-clip:padding-box;
  background:rgba(17,19,26,.95); border-radius:9px; padding:5px;
  box-shadow:0 6px 20px rgba(0,0,0,.6);
}
.asm3d-mover .lbl{
  font-size:9.5px; color:#ECB22E; text-align:center; font-weight:800;
  letter-spacing:.05em; text-transform:uppercase; margin-bottom:3px; white-space:nowrap;
}
.asm3d-mover .pad{display:flex; gap:4px; justify-content:center;}
.asm3d-mover .pad + .pad{margin-top:4px;}
/* The body of the widget must not swallow a press meant for the part beneath
   it — only the buttons take the pointer. */
.asm3d-mover{pointer-events:none;}
.asm3d-mover button{pointer-events:auto;}
.asm3d-mover button{
  width:26px; height:24px; background:#2A2D31; border:1px solid #3A3D42; color:#E8EAF0;
  border-radius:5px; cursor:pointer; font-size:12px; line-height:1; padding:0; font-family:inherit;
}
.asm3d-mover button:hover:not(:disabled){background:#ECB22E; color:#1A1D21; border-color:#ECB22E;}
.asm3d-mover button:disabled{opacity:.22; cursor:default;}

/* ── states ───────────────────────────────────────────────────── */
.asm3d-msg{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  text-align:center; padding:24px; color:#7A7D82; font-size:12.5px; line-height:1.6;
}
.asm3d-msg b{display:block; color:#9AA0AB; font-size:13px; margin-bottom:5px;}
.asm3d-spin{
  width:22px; height:22px; border:2px solid #3A3D42; border-top-color:#ECB22E;
  border-radius:50%; animation:asm3dspin .8s linear infinite; margin:0 auto 10px;
}
@keyframes asm3dspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.asm3d-spin{animation:none}}
`;