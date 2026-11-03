/* rule-engines/service-tables.js — the Service Table / Shoe Rack family.
   Rule codes: st1d, st2d, st3d, st4d, st2dr, st3dr.

   Six items, one box. A low cabinet with a worktop that OVERHANGS the front
   by `extend_top_by`, doors across the whole front, an optional skirting, and
   — on the wider ones — a single vertical. The handle is a bought aluminium
   profile, so it has no cut part and the sheet carries it only as a material
   name.

   What every one of them cuts (Service Table OR Shoe Rack tab):
     Top            w              x d + extend_top_by   ← overhangs the front
     Bottom         w-2ply         x d-ply
     Back           w-20           x h-20-skirting
     Sides          d-ply          x h-ply               ← they stop under the top
     Skirting       skirting x w-2ply, and BLANK means none at all
     Doors          w/n-2          x h-skirting-20+10 (or h-32 with no skirting)

   What varies, and only this:
     st1d    1 door,  no vertical,  shelf qty
     st2d    2 doors, no vertical,  shelf qty
     st3d    3 doors, ONE vertical at the 1/3 line — small side 1 door wide,
             big side 2 — with its own shelf count each
     st4d    4 doors, ONE vertical in the middle, shelf (w-3ply)/2 per bay
     st2dr   2 drawers across the top, 2 doors under them, no vertical
     st3dr   3 drawers across the top, 3 doors under them, vertical at 1/3

   The 1/3 vertical is fixed by the sheet's own shelf widths: the small side's
   shelf is w/3-ply and the big side's is w*2/3-2ply, which only fits a
   divider one third of the way across. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  function hasSkirt(p) { return (p.skirt || 0) > 0; }

  /* The doors (and, when the item has them, the drawer facias above). Door
     heights come straight off the sheet, which measures from the skirting up
     and leaves 10 of the top edge covered by the handle profile. */
  function front(add, p, cfg, g) {
    var W = p.W, H = p.H, D = p.D, t = p.ply;
    var sk = hasSkirt(p) ? p.skirt : 0;
    var n = cfg.doors, nd = cfg.drawers || 0;
    var dh = nd ? Math.max(60, p.sdh) : 0;
    /* Measured off the sample model (1d st.dae, W500 D400 H800):
         skirting board   0 .. sk-ply
         bottom panel     sk-ply .. sk        <- its TOP face is the skirting
         door             sk-ply .. h-2ply    <- stands on the skirting board,
                                                 stops under the top panel
         top panel        h-2ply .. h-ply     <- the unit tops out at h-ply
         door depth       d-ply .. d          <- flush with the front face,
                                                 the top overhanging it by ext
       The whole unit is therefore h-ply tall, not h: the sheet cuts the sides
       h-ply and the top sits inside them. */
    var doorH = (H - 2 * t) - (sk - t) - dh;
    var y0 = sk - t, zF = D / 2 - t / 2;
    var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);

    for (var i = 0; i < n; i++) {
      // one door spans the whole front; several are cut w/n - 2
      var dw = (n === 1) ? W : W / n - 2;
      var cx = -W / 2 + W * (i + 0.5) / n;
      /* Hinged on the OUTER edge of its half of the front: the left-hand
         doors swing from the left edge, the right-hand ones from the right.
         The hinge sits on the sgn side of the door, so it is cx + sgn*dw/2 —
         subtracting put every pivot on the far edge and the doors crossed
         through each other as they opened. */
      var sgn = (i < n / 2) ? -1 : 1;
      var hx = cx + sgn * dw / 2;
      var piv = { x: hx, y: y0 + doorH / 2, z: D / 2 - 18, ry: sgn * ang };
      add({ role: 'door', w: dw, h: doorH, d: 18, x: -sgn * dw / 2, y: 0, z: 9,
            tag: 'DOOR ' + (i + 1), pivot: piv });
      /* The profile handle runs along the TOP edge of the door. It is a thin
         aluminium lip you hook your fingers behind, not a rail: drawn 18 tall
         and 22 deep it stood out like a little shelf over the door and past
         the carcass side. A 10-tall, 6-deep strip, inset from the door's own
         width and barely proud of its face, is what it actually looks like.
         Bought, not cut, which is why the sheet carries only its colour. */
      add({ role: 'filler', w: dw - 8, h: 10, d: 6, x: -sgn * dw / 2, y: doorH / 2 - 7,
            z: 19, tag: 'PROFILE HANDLE · ' + (p.phandle || 'bought, not cut'),
            pivot: piv });
    }

    if (nd) {
      /* These units are 400 deep, not 600: the shared slide works off the
         interior depth and pulled a 270-deep box 229 forward, which left it
         hanging in the air in front of the table with almost nothing still in
         the carcass. Travel is measured off the BOX here and capped at 60% of
         it, so the drawer opens and still sits on its runners. */
      var boxD = Math.max(120, D - 90);
      var slide = ((p.draw || 0) / 100) * Math.max(80, boxD - 60) * 0.6;
      for (var j = 0; j < nd; j++) {
        var fw = W / nd - 2, fx = -W / 2 + W * (j + 0.5) / nd;
        var fy = y0 + doorH + dh / 2;
        add({ role: 'drawer', w: fw, h: dh, d: t, x: fx, y: fy, z: zF + slide,
              tag: 'DRAWER ' + (j + 1) + ' · facia' });
        WB.drawerBox(add, p, { x: fx, y: fy, zF: zF + slide, fw: fw - 6, fh: dh,
                               SD: boxD, tag: 'DRAWER ' + (j + 1) });
        add({ role: 'filler', w: fw - 8, h: 10, d: 6, x: fx, y: fy + dh / 2 - 7,
              z: zF + 12 + slide,
              tag: 'PROFILE HANDLE · ' + (p.phandle || 'bought, not cut') });
      }
      g.drawerBot = y0 + doorH;
      g.drawerH = dh;
    }
    g.doorH = doorH;
  }

  function build(p, S, cfg) {
    var notes = [], parts = [], t = p.ply;
    function add(o) { parts.push(o); }
    var W = p.W, H = p.H, D = p.D;
    var sk = hasSkirt(p) ? p.skirt : 0;
    var IW = W - 2 * t, yB = sk, yT = H - 2 * t, IH = yT - yB;
    var backT = p.backT, zBack = -D / 2 + backT;
    var ext = Math.max(0, p.topExt);

    /* the box. The top is the only part that is full width and it hangs over
       the front; the sides stop beneath it. */
    /* The unit tops out at h-ply: the sheet cuts the sides h-ply and the top
       panel sits inside them, not on top of them. */
    add({ role: 'carcass', w: W, h: t, d: D + ext, x: 0, y: H - t - t / 2, z: ext / 2,
          tag: 'TOP · ' + Math.round(W) + '×' + Math.round(D + ext) +
               (ext ? ' (overhangs ' + Math.round(ext) + ')' : '') });
    /* The carcass stops one ply short of the front and the DOOR fills that
       last ply, closing flush with the face. The bottom is set back one ply
       further again, which is what the sample model shows. */
    var cD = Math.max(80, D - t), cZ = (D / 2 - t) - cD / 2;
    var bD = Math.max(60, D - 2 * t), bZ = (D / 2 - t) - bD / 2;
    add({ role: 'side', w: t, h: H - t, d: cD, x: -(W - t) / 2, y: (H - t) / 2,
          z: cZ, tag: 'LEFT SIDE' });
    add({ role: 'side', w: t, h: H - t, d: cD, x: (W - t) / 2, y: (H - t) / 2,
          z: cZ, tag: 'RIGHT SIDE' });
    add({ role: 'carcass', w: IW, h: t, d: bD, x: 0, y: sk - t / 2, z: bZ,
          tag: 'BOTTOM' });
    if (sk > t)
      add({ role: 'skirting', w: IW, h: sk - t, d: t, x: 0, y: (sk - t) / 2,
            z: bZ + bD / 2 - t / 2, tag: 'SKIRTING ' + Math.round(sk) });
    else
      notes.push(['ok', 'No skirting — the sheet leaves every skirting part blank ' +
        'and the doors are cut h-32 instead.']);
    add({ role: 'back', w: W - 20, h: H - 20 - sk, d: backT, x: 0,
          y: (sk - t) + (H - 20 - sk) / 2, z: zBack - backT / 2,
          tag: 'BACK (' + Math.round(W - 20) + '×' + Math.round(H - 20 - sk) + ')' });

    var g = {};
    front(add, p, cfg, g);

    /* ── the bays ──
       One vertical at most. "third" puts it a third of the way across, which
       is what the sheet's two shelf widths demand; "half" puts it in the
       middle. Without one there is a single bay the full width. */
    var ceil = cfg.drawers ? g.drawerBot : yT;
    var bays = [], vD = Math.max(100, D - 52);
    if (cfg.vert) {
      var vx = cfg.vert === 'third' ? (-W / 2 + W / 3) : 0;
      add({ role: 'vertical', w: t, h: ceil - yB, d: vD, x: vx, y: yB + (ceil - yB) / 2,
            z: (D / 2 - t) - vD / 2, noV: true,
            tag: 'VERTICAL (' + Math.round(ceil - yB) + '×' + Math.round(vD) + ')' });
      var lx = -W / 2 + t, rx = W / 2 - t;
      bays.push({ i: 0, x: (lx + vx - t / 2) / 2, w: (vx - t / 2) - lx, nm: 'Small side' });
      bays.push({ i: 1, x: (vx + t / 2 + rx) / 2, w: rx - (vx + t / 2), nm: 'Big side' });
      if (cfg.vert === 'half') { bays[0].nm = 'Left bay'; bays[1].nm = 'Right bay'; }
    } else {
      bays.push({ i: 0, x: 0, w: IW, nm: 'Bay' });
    }

    /* shelves: counted per side when the sheet counts them per side */
    var items = [], j, shelfD = Math.max(100, cD - 30);
    S.shCol = S.shCol || {};
    if (cfg.perSide) {
      for (j = 0; j < Math.max(0, p.sSh); j++)
        items.push({ key: 'ss|' + j, kind: 'shelf', h: t, n: j + 1, defBay: 0 });
      for (j = 0; j < Math.max(0, p.bSh); j++)
        items.push({ key: 'bs|' + j, kind: 'shelf', h: t, n: j + 1, defBay: 1 });
    } else {
      for (j = 0; j < Math.max(0, p.fix); j++)
        items.push({ key: 'sh|' + j, kind: 'shelf', h: t, n: j + 1,
                     defBay: j % bays.length });
    }
    items.forEach(function (e) { e.col = WB.bayOf(S, e, bays.length); });

    var LV = [];
    bays.forEach(function (b) {
      var lv = items.filter(function (e) { return e.col === b.i; });
      lv.forEach(function (e, k) {
        e.def = yB + (ceil - yB) * (k + 1) / (lv.length + 1);
      });
      WB.layoutLevels(S, lv, yB, ceil);
      lv.forEach(function (e) { LV.push(e); });
      lv.forEach(function (e) {
        add({ role: 'shelf', w: b.w, h: t, d: shelfD, x: b.x, y: e.y,
              z: (D / 2 - t) - shelfD / 2,
              tag: (bays.length > 1 ? b.nm.toUpperCase() + ' ' : '') + 'SHELF ' + e.n +
                   ' (' + Math.round(b.w) + '×' + Math.round(shelfD) + ')',
              move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
              note: 'Right-click to move it up or down' +
                    (bays.length > 1 ? ', or to the other side.' : '.') });
      });
    });

    return {
      parts: parts, notes: notes,
      callouts: WB.callouts(p, W, H, D / 2, cfg.doors),
      LV: LV, floor: yB, ceil: ceil, nBays: bays.length,
      bayName: function (i) { return bays[i] ? bays[i].nm : 'Bay ' + (i + 1); },
      zones: {}, zoneKeys: [], vM: {}, CM: {},
      HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: bays.length > 1,
      bandOf: function () { return []; },
      geo: { IW: IW, IH: IH, colW: bays[0].w, SD: shelfD, yB: yB, yT: yT },
      hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) +
           '</b> · depth <b>' + Math.round(D) + '</b> · top <b>' +
           Math.round(D + ext) + '</b> (overhang <b>' + Math.round(ext) + '</b>)<br><b>' +
           cfg.doors + '</b> door' + (cfg.doors === 1 ? '' : 's') + ' <b>' +
           Math.round(g.doorH) + '</b> tall' +
           (cfg.drawers ? ' · <b>' + cfg.drawers + '</b> drawers <b>' +
                          Math.round(g.drawerH) + '</b>' : '') +
           '<br>' + (bays.length > 1
             ? bays.map(function (b) { return b.nm + ' <b>' + Math.round(b.w) + '</b>'; }).join(' · ')
             : 'one bay <b>' + Math.round(IW) + '</b>') +
           ' · shelves <b>' + LV.length + '</b><br>skirting <b>' +
           (sk ? Math.round(sk) : 'none') + '</b> · handle <b>' +
           (p.phandle || 'profile') + '</b>'
    };
  }

  var CTL = [{ id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Door open' },
             WB.DRAW_CTL,
             { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }];

  function reg(code, label, cfg) {
    window.ASM3D.register(code, {
      label: label, category: 'service', version: WB.VERSION,
      inputs: WB.INPUTS, controls: CTL,
      newState: WB.fresh, onInputChange: WB.onInputChange,
      solve: function (p, S) { return build(p, S, cfg); },
      targets: WB.bayTargets, moveTo: WB.bayMoveTo, drag: WB.drag
    });
  }

  reg('st1d',  '1-Door Service Table / Shoe Rack',  { doors: 1, vert: null });
  reg('st2d',  '2-Door Service Table / Shoe Rack',  { doors: 2, vert: null });
  reg('st3d',  '3-Door Service Table / Shoe Rack',  { doors: 3, vert: 'third', perSide: true });
  reg('st4d',  '4-Door Service Table / Shoe Rack',  { doors: 4, vert: 'half' });
  reg('st2dr', '2 Drawers + 2 Doors Service Table', { doors: 2, vert: null, drawers: 2 });
  reg('st3dr', '3 Drawers + 3 Doors Service Table',
      { doors: 3, vert: 'third', drawers: 3, perSide: true });
})();
