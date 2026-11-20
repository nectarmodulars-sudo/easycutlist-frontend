/* rule-engines/wardrobe-3door.js — 3 door open wardrobe. Rule code: 3dw.

   The only wardrobe whose two halves are not halves. ONE vertical, full
   height, at the 2/3 line: a BIG side behind doors 1 and 2 and a SMALL side
   behind door 3. Every count in the sheet is stated per side — fix shelf,
   removable shelf, drawer height, drawer quantity — so the two sides are two
   independent stacks that never exchange parts: a big-side shelf is cut
   2w/3-2ply and simply does not fit the small side.

   From the sheet (A251:H335):
     Top / Bottom          w-2ply                  x d-20
     Left / Right side     d-20                    x h
     Vertical              d-50                    x h-2ply-skirting   qty 1
     Big side back         2/3 of (w-20)           x h-20-skirting     ┐ split
     Small side back       1/3 of (w-20)           x h-20-skirting     ┘ over 1200
     Big side fix shelf    (w*2/3)-2ply            x d-50
     Small side fix shelf  w/3-ply                 x d-50
     ...removable shelves  same, less shelf_push
     Door1/2/3             w/3-2                   x h-skirting
     Skirting              skirting                x w-2ply
     BIG SIDE drawers      facia ((w*2/3-2ply)-4ply)/2-2   ← a PAIR per row
                           centre filler qty 1, channel filler qty 4
     SMALL SIDE drawers    facia (w/3-ply)-4ply-4          ← one per row
                           channel filler qty 4

   Two things the sheet says that are reported rather than obeyed:
     · both removable shelf rows carry the quantity formula `0`, so the inputs
       ask for them and the cut list never produces any
     · `Locker qty` is read and no locker component exists in the range */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* Each side is its own stack of LEVELS below the DRAWER LINE, and
     wardrobe-common.js owns the stacking, the clamping and the right-click
     reorder. Nothing crosses the vertical: the parts are cut to one side's
     width and do not fit the other.

     The arrangement is the one the 4-door and the sliding wardrobe already
     use: hanger space across the top, a drawer line under it with that side's
     drawers hanging from it, and the shelves in the space below. So the
     drawers DEFAULT to the top of the zone, packed under the line, instead of
     sitting on the floor — and from there they move like any other level. */
  function sideLevels(S, side, p, zone, dlTop) {
    var t = p.ply, lv = [], i, big = (side === 'B');
    var nD = Math.max(0, big ? p.bDq : p.sDq);
    var dh = big ? p.bDh : p.sDh;
    var nF = Math.max(0, (big ? p.bFix : p.sFix) - 1);   // one fix shelf IS the line
    var nR = Math.max(0, big ? p.bRem : p.sRem);
    /* DRAWER QTY is a count of DRAWERS, not of rows — the sheet cuts one
       facia per drawer. The big side takes two to a row, so its rows are half
       the quantity (an odd one left over makes a row of its own with a single
       drawer in it); the small side takes one to a row. */
    var per = big ? 2 : 1, rows = Math.ceil(nD / per);
    for (i = 0; i < rows; i++)
      lv.push({ key: side + '|dr|' + i, kind: 'drawer', h: dh, n: i + 1, col: side,
                wide: Math.min(per, nD - i * per) });
    for (i = 0; i < nF; i++)
      lv.push({ key: side + '|fs|' + i, kind: 'shelf', h: t, n: i + 1, col: side });
    for (i = 0; i < nR; i++)
      lv.push({ key: side + '|rs|' + i, kind: 'rshelf', h: t, n: i + 1, col: side });
    /* The drawer line itself is a level, so the stack runs the WHOLE height of
       the side and a shelf can be sent above the line into the hanger space.
       Stopping the zone at the line left the shelves trapped under it. It is
       pinned: it is the one level that stays where the hanger space puts it. */
    var dlKey = side + '|dl';
    if ((big ? p.bFix : p.sFix) > 0) {
      lv.push({ key: dlKey, kind: 'dline', h: t, n: 0, col: side, line: true,
                def: dlTop + t / 2 });
      S.pin = S.pin || {}; S.pin[dlKey] = 1;
    }
    var y = dlTop;                         // pack the drawers down from the line
    lv.forEach(function (e) {
      if (e.kind === 'drawer') { y -= e.h; e.def = y + e.h / 2; }
    });
    var sh = lv.filter(function (e) { return e.kind !== 'drawer'; });
    sh = sh.filter(function (e) { return !e.line; });
    sh.forEach(function (e, k) {
      e.def = zone.y0 + (y - 40 - zone.y0) * (sh.length - k) / (sh.length + 1);
    });
    WB.layoutLevels(S, lv, zone.y0, zone.y1);
    return lv;
  }

  window.ASM3D.register('3dw', {
    label: '3-Door Open Wardrobe',
    category: 'wardrobes',
    version: WB.VERSION,
    inputs: WB.INPUTS,
    controls: [
      { id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Door open' },
      WB.DRAW_CTL,
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }
    ],
    newState: WB.fresh,
    onInputChange: WB.onInputChange,

    solve: function (p, S) {
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D;
      var IW = W - 2 * t, yB = p.skirt + t, yT = H - t, IH = yT - yB;
      var backT = p.backT, zBack = -D / 2 + backT;
      var SD = Math.max(150, D - 50), zS = zBack + SD / 2;
      var remD = Math.max(100, SD - p.push);
      var dzF = D / 2 - t / 2;
      var slide = WB.slideOf(p, SD);

      /* The 2/3 line. The sheet's own shelf widths fix it: a big-side shelf is
         w*2/3-2ply and a small-side shelf w/3-ply, and the two plus the
         vertical come to exactly the interior. */
      var bigW = W * 2 / 3 - 2 * t, smlW = W / 3 - t;
      var xL = -W / 2 + t;                       // inside face of the left side
      var bigX = xL + bigW / 2;
      var vX = xL + bigW + t / 2;
      var smlX = vX + t / 2 + smlW / 2;

      WB.shell(add, p, IW, D - 20);
      /* The back is cut in two panels over 1200 — a sheet is not wide enough
         for one — and the split falls on the vertical. */
      var split = (W - t) > 1200;
      var bh = H - 20 - p.skirt, byc = p.skirt + bh / 2;
      if (split) {
        add({ role: 'back', w: Math.round((W - 20) * 2 / 3), h: bh, d: backT,
              x: bigX, y: byc, z: zBack - backT / 2, tag: 'BIG SIDE BACK' });
        add({ role: 'back', w: Math.round((W - 20) * 1 / 3), h: bh, d: backT,
              x: smlX, y: byc, z: zBack - backT / 2, tag: 'SMALL SIDE BACK' });
      } else {
        add({ role: 'back', w: W - 20, h: bh, d: backT, x: 0, y: byc,
              z: zBack - backT / 2, tag: 'BACK' });
      }

      add({ role: 'vertical', w: t, h: IH, d: SD, x: vX, y: yB + IH / 2, z: zS,
            noV: true, tag: 'VERTICAL (' + Math.round(IH) + ')' });

      /* Hanger space across the top, the drawer line under it. Both sides
         share the line, so the front reads as one horizontal right across the
         wardrobe — the same as the 4-door and the sliding. */
      var hang = Math.max(250, Math.min(p.hang, IH - 300));
      var dlTop = yT - hang - t;
      var Z = { B: { x: bigX, y0: yB, y1: yT, w: bigW },
                S: { x: smlX, y0: yB, y1: yT, w: smlW } };
      var LV = [];

      ['B', 'S'].forEach(function (side) {
        var z = Z[side], lv = sideLevels(S, side, p, z, dlTop), big = (side === 'B');
        var name = big ? 'BIG' : 'SMALL';
        if ((big ? p.bFix : p.sFix) === 0)
          notes.push(['warn', 'The ' + name.toLowerCase() + ' side has no fix shelf, so ' +
            'nothing caps its drawer line.']);
        if (lv.over > 1)
          notes.push(['err', 'The ' + name.toLowerCase() + ' side needs ' +
            Math.round(IH + lv.over) + ' and the interior is ' + Math.round(IH) +
            '. Reduce its shelves or drawers.']);
        lv.forEach(function (e) { LV.push(e); });

        lv.forEach(function (e) {
          if (e.kind === 'drawer') {
            /* The big side takes TWO drawers to a row, with a centre filler
               between them — its facia is half the side. The small side takes
               one across its whole width. */
            var pair = (e.wide === 2);
            var fw = big ? (z.w - 4 * t) / 2 - 2 : z.w - 4 * t - 4;
            var xs = pair ? [z.x - (fw + t) / 2, z.x + (fw + t) / 2]
                   : big   ? [z.x - (fw + t) / 2]      // odd one out, keeps its slot
                           : [z.x];
            [-1, 1].forEach(function (s2) {
              for (var ff = 0; ff < 2; ff++)
                add({ role: 'filler', w: t, h: e.h, d: remD,
                      x: z.x + s2 * (z.w / 2 - t / 2 - ff * t), y: e.y,
                      z: zBack + remD / 2, tag: 'CHANNEL FILLER · ' + name + ' SIDE' });
            });
            if (pair)
              add({ role: 'filler', w: t, h: e.h, d: remD - 25, x: z.x, y: e.y,
                    z: zBack + (remD - 25) / 2, tag: 'CENTRE FILLER · BIG SIDE' });
            xs.forEach(function (cx, j) {
              var tag = name + ' SIDE DRAWER ' + (big ? (e.n - 1) * 2 + j + 1 : e.n) +
                        (big ? ' · ' + (j ? 'right' : 'left') : '');
              add({ role: 'drawer', w: fw, h: e.h - 4, d: t, x: cx, y: e.y, z: dzF + slide,
                    tag: tag, move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                    note: pair ? 'The two drawers of a row move together. Right-click to ' +
                                 'put the row elsewhere on this side.'
                               : 'Right-click to put it elsewhere on this side.' });
              WB.drawerBox(add, p, { x: cx, y: e.y, zF: dzF + slide, fw: fw, fh: e.h,
                                     SD: SD, tag: tag });
              WB.handle(add, { x: cx, y: e.y, z: dzF + slide, out: 1, dir: 'h',
                               len: Math.min(240, fw * 0.45) });
            });
          } else if (e.line) {
            add({ role: 'shelf', w: z.w, h: t, d: SD, x: z.x, y: e.y, z: zS,
                  tag: name + ' SIDE FIX SHELF \u00b7 drawer line' });
          } else {
            var rem = (e.kind === 'rshelf'), dep = rem ? remD : SD;
            add({ role: 'shelf', w: z.w, h: t, d: dep, x: z.x, y: e.y,
                  z: zBack + dep / 2,
                  tag: name + ' SIDE ' + (rem ? 'REMOVABLE' : 'FIX') + ' SHELF ' + e.n,
                  move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                  note: 'Cut ' + Math.round(z.w) + ' wide — it fits this side only. ' +
                        'Right-click to put it elsewhere on this side.' });
          }
        });

        add({ role: 'rod', shape: 'cyl-x', w: z.w - 40, h: 26, d: 26, x: z.x,
              y: yT - 90, z: zS, tag: name + ' SIDE HANGING ROD' });
      });

      /* ── three doors: two over the big side, one over the small ── */
      var dw = W / 3 - 2, dh = H - p.skirt;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      [[-1, 'DOOR 1', -W / 2], [1, 'DOOR 2', -W / 2 + 2 * W / 3],
       [1, 'DOOR 3', W / 2]].forEach(function (s2) {
        var sgn = s2[0], hx = s2[2];
        var piv = { x: hx, y: p.skirt + dh / 2, z: D / 2, ry: sgn * ang };
        add({ role: 'door', w: dw, h: dh, d: 18, x: -sgn * dw / 2, y: 0, z: 9,
              tag: s2[1], pivot: piv });
        WB.handle(add, { x: -sgn * (dw - 55), y: 0, z: 18, out: 1, dir: 'v',
                         len: Math.min(600, dh * 0.35), pivot: piv });
      });

      if (p.bRem > 0 || p.sRem > 0)
        notes.push(['warn', 'Both REMOVABLE SHELF rows carry the quantity formula 0 in the ' +
          'Master Sheet, so the ' + (p.bRem + p.sRem) + ' asked for are drawn here but will ' +
          'not appear in the cut list. Fix the qty formula if they are real.']);
      if (p.locker > 0)
        notes.push(['warn', 'LOCKER QTY is ' + p.locker + ' and this item cuts no locker ' +
          'parts, so none is drawn.']);

      return {
        parts: parts, notes: notes,
        callouts: WB.callouts(p, W, H, D / 2, 3),
        LV: LV, floor: yB, ceil: yT,
        zones: { B: Z.B, S: Z.S, U: { x: 0, y0: dlTop, y1: yT, w: IW } },
        zoneKeys: [], vM: { B: 0, S: 0 }, CM: { B: [], S: [] },
        HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: true,
        bandOf: function () { return ['B']; },
        geo: { IW: IW, IH: IH, colW: bigW, SD: SD, yB: yB, yT: yT,
               bigW: bigW, smlW: smlW, hang: hang, dlTop: dlTop },
        hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) +
             '</b> · depth <b>' + Math.round(SD) + '</b><br>big side <b>' +
             Math.round(bigW) + '</b> · small side <b>' + Math.round(smlW) +
             '</b> · vertical <b>' + Math.round(IH) +
             '</b><br>hanger space <b>' + Math.round(hang) +
             '</b> · drawer line at <b>' + Math.round(dlTop - yB) +
             '</b> of <b>' + Math.round(IH) + '</b><br>big: <b>' +
             Math.max(0, p.bDq) + '</b> drawers in <b>' + Math.ceil(Math.max(0, p.bDq) / 2) +
             '</b> row(s) · <b>' + Math.max(0, p.bFix) +
             '</b> fix · small: <b>' + Math.max(0, p.sDq) + '</b> drawers · <b>' +
             Math.max(0, p.sFix) + '</b> fix'
      };
    },

    /* A level reorders inside its OWN side and nowhere else: the parts are cut
       to that side's width. */
    targets: function (S, u, res) {
      var side = String(u.key).split('|')[0];
      return WB.levelTargets(S, u, {
        LV: (res.LV || []).filter(function (e) { return e.col === side; }),
        floor: res.floor, ceil: res.ceil });
    },
    moveTo: function (S, u, id, res) {
      var side = String(u.key).split('|')[0];
      return WB.levelMoveTo(S, u, id, {
        LV: (res.LV || []).filter(function (e) { return e.col === side; }),
        floor: res.floor, ceil: res.ceil });
    },
    drag: WB.drag
  });
})();
