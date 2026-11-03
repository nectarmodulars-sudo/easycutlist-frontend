/* rule-engines/tv-units.js — the TV Units tab. Rule codes: tvde, tvdm.

   Both items are ONE DRAWER LINE: a long low box, about 400 tall and 350
   deep, with drawers side by side across the whole front and a vertical
   between each pair. There is no door, no shelf and nothing stacked, so
   nothing in here moves up or down — the only arrangement question is how
   wide each drawer is.

   From the sheet (TV Units tab):
     Top            w                x d + top_extend     ← overhangs the front
     Bottom         w-2ply           x d-20
     Left / Right   h-ply            x d-20
     Skirting       skirting x w-2ply
     Back           w-20             x h-20-skirting
     Vertical       h-2ply-skirting  x (d-20)-32          qty = drawers-1
     Facia          (see below)      x h-ply-2+facia_ht_extend-skirting
     Drawer box     front h-2ply-skirting-50, sides d-70

   tvde  EQUAL DRAWERS      facia w/drawers_qty - 2
   tvdm  SMALL & BIG        big facia  big_drawers_w - 2
                            small facia (w - big_qty*big_w)/(small count) - 2

   The sheet never says WHERE the big drawers sit in the line. They are drawn
   in the middle, which is how a TV unit is usually built — two big ones under
   the screen with the small ones to either side — and the note says so. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* The widths of every drawer in the line, left to right. */
  function widths(p, cfg) {
    var W = p.W, n = Math.max(1, p.dqty), out = [];
    if (!cfg.mixed) {
      for (var i = 0; i < n; i++) out.push({ w: W / n, big: false });
      return out;
    }
    var nb = Math.max(0, Math.min(n, p.bdq)), bw = Math.max(100, p.bdw);
    var ns = Math.max(0, n - nb);
    var sw = ns > 0 ? (W - nb * bw) / ns : 0;
    /* big ones in the middle, smalls split either side — the extra small on
       the left when they do not divide evenly */
    var left = Math.ceil(ns / 2), right = ns - left, k;
    for (k = 0; k < left; k++) out.push({ w: sw, big: false });
    for (k = 0; k < nb; k++) out.push({ w: bw, big: true });
    for (k = 0; k < right; k++) out.push({ w: sw, big: false });
    return out;
  }

  function build(p, S, cfg) {
    var notes = [], parts = [], t = p.ply;
    function add(o) { parts.push(o); }
    var W = p.W, H = p.H, D = p.D;
    var sk = Math.max(0, p.skirt), ext = Math.max(0, p.topExt);
    var IW = W - 2 * t, yB = sk + t, yT = H - t, IH = yT - yB;
    var backT = p.backT, zBack = -D / 2 + backT;
    var carcD = Math.max(100, D - 20);

    add({ role: 'carcass', w: W, h: t, d: D + ext, x: 0, y: H - t / 2, z: ext / 2,
          tag: 'TOP · ' + Math.round(W) + '×' + Math.round(D + ext) +
               (ext ? ' (overhangs ' + Math.round(ext) + ')' : '') });
    add({ role: 'side', w: t, h: H - t, d: carcD, x: -(W - t) / 2, y: (H - t) / 2,
          z: D / 2 - carcD / 2, tag: 'LEFT SIDE' });
    add({ role: 'side', w: t, h: H - t, d: carcD, x: (W - t) / 2, y: (H - t) / 2,
          z: D / 2 - carcD / 2, tag: 'RIGHT SIDE' });
    add({ role: 'carcass', w: IW, h: t, d: carcD, x: 0, y: sk + t / 2,
          z: D / 2 - carcD / 2, tag: 'BOTTOM' });
    if (sk > 0)
      add({ role: 'skirting', w: IW, h: sk, d: t, x: 0, y: sk / 2, z: D / 2 - t / 2,
            tag: 'SKIRTING ' + Math.round(sk) });
    add({ role: 'back', w: W - 20, h: H - 20 - sk, d: backT, x: 0,
          y: sk + (H - 20 - sk) / 2, z: zBack - backT / 2,
          tag: 'BACK (' + Math.round(W - 20) + '×' + Math.round(H - 20 - sk) + ')' });

    /* ── the line ── */
    var ws = widths(p, cfg), n = ws.length;
    var facH = H - t - 2 + Math.max(0, p.fhx) - sk;
    var boxH = Math.max(60, IH - 50);
    var boxD = Math.max(120, D - 70);
    var slide = ((p.draw || 0) / 100) * Math.max(80, boxD - 60) * 0.6;
    var vD = Math.max(100, carcD - 32);
    var zF = D / 2 + 9;

    var x = -W / 2;
    ws.forEach(function (dr, i) {
      var cx = x + dr.w / 2;
      // the vertical between this drawer and the next
      if (i < n - 1)
        add({ role: 'vertical', w: t, h: IH, d: vD, x: x + dr.w, y: yB + IH / 2,
              z: D / 2 - vD / 2, noV: true,
              tag: 'VERTICAL ' + (i + 1) + ' (' + Math.round(IH) + '×' +
                   Math.round(vD) + ')' });

      var tag = (cfg.mixed ? (dr.big ? 'BIG' : 'SMALL') + ' DRAWER ' : 'DRAWER ') + (i + 1);
      add({ role: 'drawer', w: dr.w - 2, h: facH, d: t, x: cx, y: sk + facH / 2,
            z: zF + slide,
            tag: tag + ' · facia ' + Math.round(dr.w - 2) + '×' + Math.round(facH) });
      WB.drawerBox(add, p, { x: cx, y: sk + facH / 2, zF: zF + slide,
                             fw: dr.w - 2, fh: boxH + 30, SD: boxD, tag: tag });
      WB.handle(add, { x: cx, y: sk + facH / 2, z: zF + slide, out: 1, dir: 'h',
                       len: Math.min(300, dr.w * 0.45) });
      x += dr.w;
    });

    if (cfg.mixed) {
      var nb = Math.max(0, Math.min(n, p.bdq));
      if (nb > 0 && nb < n)
        notes.push(['warn', 'The sheet does not say where the big drawers sit in the line. ' +
          'They are drawn in the middle with the small ones either side. Say if they ' +
          'belong at one end instead.']);
      if (ws.some(function (d) { return d.w < 120; }))
        notes.push(['err', 'The small drawers come out under 120 wide: ' +
          Math.round(W) + ' less ' + nb + ' big at ' + Math.round(p.bdw) +
          ' leaves too little for the rest. Reduce BIG DRAWERS W or the quantity.']);
    }
    if (p.dqty < 1)
      notes.push(['err', 'DRAWERS QTY is 0 — nothing to draw in the line.']);

    return {
      parts: parts, notes: notes,
      callouts: WB.callouts(p, W, H, D / 2, 0),
      LV: [], floor: yB, ceil: yT, nBays: 1,
      zones: {}, zoneKeys: [], vM: {}, CM: {},
      HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: false,
      bandOf: function () { return []; },
      geo: { IW: IW, IH: IH, colW: ws.length ? ws[0].w : IW, SD: boxD, yB: yB, yT: yT },
      hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) +
           '</b> · depth <b>' + Math.round(D) + '</b> · top <b>' +
           Math.round(D + ext) + '</b><br><b>' + n + '</b> drawers · facia <b>' +
           Math.round(facH) + '</b> tall · <b>' + (n - 1) + '</b> verticals<br>' +
           ws.map(function (d) { return Math.round(d.w - 2); }).join(' · ') +
           '<br>skirting <b>' + (sk ? Math.round(sk) : 'none') + '</b>'
    };
  }

  var CTL = [WB.DRAW_CTL,
             { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Opacity' }];

  function reg(code, label, cfg) {
    window.ASM3D.register(code, {
      label: label, category: 'tv', version: WB.VERSION,
      inputs: WB.INPUTS, controls: CTL,
      newState: WB.fresh, onInputChange: WB.onInputChange,
      solve: function (p, S) { return build(p, S, cfg); },
      // one line of drawers side by side: nothing stacks, so nothing reorders
      targets: function () { return []; },
      moveTo: function () { return false; },
      drag: function () { return false; }
    });
  }

  reg('tvde', 'TV Unit · Drawer Line, equal drawers', { mixed: false });
  reg('tvdm', 'TV Unit · Drawer Line, small & big', { mixed: true });
})();
