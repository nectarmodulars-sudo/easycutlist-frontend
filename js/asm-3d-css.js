/* asm-3d-css.js — styles for the SBS 3D viewer.
   Exposes window.ASM3D_CSS; injected once by asm-3d-core.js.
   Deploy on its own whenever only the viewer chrome changes. */
window.ASM3D_CSS = `
/* ── viewer shell ─────────────────────────────────────────────── */
/* The mount holds the 3D view and, under it, the toolbar. */
.asm3d-root{display:flex; flex-direction:column; width:100%; height:100%; min-height:300px; gap:7px;}
.asm3d-root > .asm3d-wrap{flex:1 1 auto; min-height:0;}
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
  position:static; flex:0 0 auto;
  display:flex; gap:5px; flex-wrap:wrap; align-items:center;
  background:#111318; border:1px solid #3A3D42; border-radius:9px; padding:6px;
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
/* The figures and the selection sit in a strip under the view. */
.asm3d-info{
  display:flex; flex:0 0 auto; gap:7px; align-items:stretch; flex-wrap:wrap;
}
.asm3d-hud{
  flex:1 1 240px; min-width:0;
  background:#111318; border:1px solid #3A3D42; border-radius:8px;
  padding:7px 10px; font-size:10.5px; line-height:1.5; color:#9AA0AB;
}
.asm3d-hud b{color:#E8EAF0;}
/* Notes live behind a button. Printed in full across the top right they
   covered the model they were describing. */
.asm3d-notebtn{
  position:absolute; right:10px; top:10px; z-index:15;
  background:#111318; border:1px solid #3A3D42; color:#E8EAF0;
  border-radius:8px; padding:5px 10px; cursor:pointer;
  font:800 11.5px/1 inherit; letter-spacing:.04em;
  box-shadow:0 3px 12px rgba(0,0,0,.5);
}
.asm3d-notebtn:hover{border-color:#9AA0AB;}
.asm3d-notebtn.warn{color:#ECB22E; border-color:rgba(236,178,46,.6);}
.asm3d-notebtn.err {color:#F6889F; border-color:rgba(224,30,90,.65);}
.asm3d-notebtn.ok  {color:#7fe0b4; border-color:rgba(46,182,125,.5);}
.asm3d-notebtn.on{background:#1E2125; border-color:#ECB22E;}
.asm3d-notes{
  position:absolute; right:10px; top:44px; z-index:14;
  width:min(320px, calc(100% - 20px)); max-height:calc(100% - 60px); overflow-y:auto;
  display:none; flex-direction:column; gap:5px;
}
.asm3d-notes.open{display:flex;}
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

/* ── selection badge ───────────────────────────── */
/* There is no hover widget. A click selects, and this says what is selected
   and what can be done with it. */
.asm3d-sel{
  display:none; flex:1 1 240px; min-width:0;
  background:rgba(14,22,34,.94); border:1px solid #4DA3FF; border-radius:8px;
  padding:6px 10px; pointer-events:none;
}
.asm3d-sel b{
  display:block; font-size:11px; font-weight:800; letter-spacing:.04em;
  text-transform:uppercase; color:#9ED0FF;
}
.asm3d-sel span{display:block; font-size:10.5px; color:#7A8795; margin-top:2px;}
.asm3d-sel em{
  display:block; font-style:normal; font-size:11px; line-height:1.4; margin-top:5px;
  padding-top:5px; border-top:1px solid rgba(77,163,255,.35); color:#ECB22E;
}

/* ── right-click move menu ─────────────────────── */
.asm3d-menu{
  position:absolute; display:none; z-index:26; min-width:184px; max-width:260px;
  background:#15181d; border:1px solid #3A3D42; border-radius:9px; padding:5px;
  box-shadow:0 10px 30px rgba(0,0,0,.65);
}
.asm3d-menu .hd{
  font-size:9.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
  color:#4DA3FF; padding:4px 7px 6px; border-bottom:1px solid #2b2e33; margin-bottom:4px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.asm3d-menu button{
  display:block; width:100%; text-align:left; background:none; border:0;
  color:#E8EAF0; font:12px/1.3 inherit; padding:7px 9px; border-radius:6px; cursor:pointer;
}
.asm3d-menu button:hover:not(:disabled){background:#4DA3FF; color:#0f1217;}
.asm3d-menu button:disabled{cursor:default;}
.asm3d-menu button.cur{color:#9AA0AB;}
.asm3d-menu button:disabled:not(.cur){opacity:.34;}
.asm3d-menu .tick{font-size:10px; color:#4DA3FF; margin-left:4px;}
.asm3d-menu .none{padding:7px 9px; font-size:11.5px; color:#7A7D82;}

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