/* rule-engines/wardrobe-1door.js — 1 door open wardrobe. Rule code: 1dw.

   The simplest wardrobe in the sheet and the only one that is not built on the
   shared carcass, because it has none of what that carcass is for: no centre
   partition, no quarters, no verticals, no half shelves, no upper/lower bands.

   What the sheet (A194:H248) actually gives it:
     Shelf              w-36        × d-50     × shelf qty   full-width shelves
     Internal drawers   w-4·ply-4   × ih       × qty         one stack, full width
     Channel filler     d-50-20     × ih·qty   × 2           ONE per side, and it
                                                             spans the whole stack
     Door               w           × h-skirting × 1
   Note the filler count: 2, not 4. An internal drawer runs on a single channel
   each side over the full height of the stack, unlike the big and small drawers
   in the other wardrobes, which take two fillers per side per row. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* Drawers and shelves here are LEVELS — see wardrobe-common.js, which owns
     the stacking, the clamping and the reorder menu. This file only says what
     levels this item has and what they look like. */

  window.ASM3D.register('1dw', {
    label: '1-Door Open Wardrobe',
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

      WB.shell(add, p, IW);
      add({ role: 'back', w: IW + 12, h: IH + 12, d: backT, x: 0,
            y: yB + (IH + 12) / 2 - 6, z: zBack - backT / 2 });

      /* ── the interior: drawers and shelves are all LEVELS ──
         Every drawer and every shelf holds its own absolute height, and each
         one is clamped between the two levels either side of it. That is what
         makes the three things true at once:
           · dragging a drawer moves THAT drawer, and nothing above it shifts
             (heights are absolute, not shares of whatever room is left)
           · nothing can be dragged through anything else, so a shelf cannot
             pass a drawer to reach the space below it
           · drawers are not glued into a block — each moves on its own */
      var nd = Math.max(0, p.sdq), ih = p.sdh, nSh = Math.max(0, p.fix);
      var dz = D / 2 - t / 2 - 12, fillD = Math.max(100, SD - 20);
      var slide = WB.slideOf(p, SD);
      S.shY = S.shY || {};

      // Default: the drawers make a line at 42% of the interior, shelves above.
      var dl0 = yB + IH * 0.42, lv = [];
      for (var i = 0; i < nd; i++)
        lv.push({ key: 'dr|' + i, kind: 'drawer', h: ih, n: i + 1, def: dl0 - ih * i - ih / 2 });
      var sTop = yT - t / 2 - 40, sBot = dl0 + 20 + t / 2;
      for (var j = 0; j < nSh; j++)
        lv.push({ key: 'sh|' + j, kind: 'shelf', h: t, n: j + 1,
                  def: nSh === 1 ? (sBot + sTop) / 2
                                 : sBot + (sTop - sBot) * j / (nSh - 1) });

      var floor = yB, ceil = yT;
      WB.layoutLevels(S, lv, floor, ceil);

      var shelfRecs = [], topMost = yB;
      lv.forEach(function (e, k) {
        topMost = Math.max(topMost, e.y + e.h / 2);
        if (e.kind === 'drawer') {
          var n = Number(e.key.split('|')[1]) + 1;
          [-1, 1].forEach(function (s2) {
            add({ role: 'filler', w: t, h: ih, d: fillD, x: s2 * (IW / 2 - t / 2),
                  y: e.y, z: zBack + fillD / 2, tag: 'CHANNEL FILLER · drawer ' + n });
          });
          var fw = IW - 2 * t - 4;
          add({ role: 'drawer', w: fw, h: ih - 8, d: t, x: 0, y: e.y, z: dz + slide,
                tag: 'DRAWER ' + n, move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                note: 'Right-click to put it above or below another level.' });
          WB.drawerBox(add, p, { x: 0, y: e.y, zF: dz + slide, fw: fw, fh: ih, SD: SD,
                                 tag: 'DRAWER ' + n });
          WB.handle(add, { x: 0, y: e.y, z: dz + slide, out: 1, dir: 'h',
                           len: Math.min(260, fw * 0.45) });
        } else {
          add({ role: 'shelf', w: IW, h: t, d: SD, x: 0, y: e.y, z: zS,
                tag: 'FIX SHELF ' + (Number(e.key.split('|')[1]) + 1),
                move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                note: 'Right-click to put it below the drawers, or between two of them.' });
          shelfRecs.push({ zone: 'U', y: e.y, x: 0, w: IW });
        }
      });

      if (p.rem > 0)
        notes.push(['warn', 'This item has no removable shelf in the Master Sheet — ' +
          'the ' + p.rem + ' asked for are not drawn.']);
      // A hanging rod only makes sense if something is left to hang in.
      if (yT - topMost > 900)
        add({ role: 'rod', shape: 'cyl-x', w: IW - 40, h: 26, d: 26, x: 0,
              y: yT - 90, z: zS, tag: 'HANGING ROD' });

      if (p.locker > 0)
        WB.locker(add, notes, p, shelfRecs, yT, SD, zBack, IW, 'the wardrobe');

      /* ── one door, full width, hinged on the left ── */
      var dw = W, dh = H - p.skirt;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      var piv = { x: -W / 2, y: p.skirt + dh / 2, z: D / 2, ry: -ang };
      add({ role: 'door', w: dw, h: dh, d: 18, x: dw / 2, y: 0, z: 9, tag: 'DOOR', pivot: piv });
      WB.handle(add, { x: dw - 55, y: 0, z: 18, out: 1, dir: 'v',
                       len: Math.min(600, dh * 0.35), pivot: piv });

      return {
        parts: parts, notes: notes,
        callouts: WB.callouts(p, W, H, D / 2, 1),
        // zoneKeys empty: there is exactly one zone, so a shelf has nowhere
        // else to be put and the menu says so rather than offering where it is.
        LV: lv, floor: floor, ceil: ceil,
        zones: { U: { x: 0, y0: yB, y1: yT, w: IW } }, zoneKeys: [],
        vM: { U: 0 }, CM: { U: [] }, HS: { upper: [], lower: [] },
        cols: { L: [], R: [] }, twoCol: false,
        bandOf: function () { return ['U']; },
        geo: { IW: IW, IH: IH, colW: IW, SD: SD, yB: yB, yT: yT },
        hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · depth <b>' +
             Math.round(SD) + '</b><br>drawers <b>' + nd + '</b> · shelves <b>' + nSh +
             '</b> · every level moves on its own<br>highest level <b>' +
             Math.round(topMost - yB) + '</b> of <b>' + Math.round(IH) + '</b>'
      };
    },

    /* The menu reorders. Dragging keeps a level between its neighbours, which
       is right for nudging but means a shelf can never travel past a drawer to
       reach the space underneath — so the menu offers every slot in the stack
       instead, and says when one is too tight to take the piece. */
    targets: WB.levelTargets,
    moveTo: WB.levelMoveTo,
    drag: WB.drag
  });
})();
