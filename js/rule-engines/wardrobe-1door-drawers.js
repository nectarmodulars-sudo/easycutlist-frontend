/* rule-engines/wardrobe-1door-drawers.js — 1 door open + front drawers.
   Rule code: 1dwf.

   A 1-door wardrobe standing on a bank of drawers whose facias are OUTSIDE the
   door, full width, so they are part of the front elevation rather than hidden
   behind it. Above them, one door over an interior holding an inner drawer or
   two, fixed shelves and removable shelves.

   From the sheet (A753:H826):
     Outer drawer facia   w            × outer_drawer_ht     ← full width, exposed
     Inner drawer facia   w-4·ply-4    × inner_drawer_ht-2   ← behind the door
     Fix shelf            w-36         × d-50                ← full depth
     Removable shelf      w-36         × (d-50)-shelf_push   ← pushed in at the front
     Channel filler       (d-50)-shelf_push × drawer ht, qty 2 per drawer
                                                             ← one per side, per drawer
     Door                 w            × h-skirting

   Two things the sheet says that the carcass cannot do, both reported as notes
   rather than quietly obeyed:
     · the door is cut h-skirting, which is the whole front — it would cover the
       outer drawers it is supposed to sit above. Drawn above them instead.
     · `Top out` and `Internal` are read by the sheet and produce no component,
       so there is nothing to draw for them. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  window.ASM3D.register('1dwf', {
    label: '1-Door Open + Front Drawers',
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
      var IW = W - 2 * t, yB = p.skirt + t, yT = H - t;
      var backT = p.backT, zBack = -D / 2 + backT;
      var SD = Math.max(150, D - 50), zS = zBack + SD / 2;
      var remD = Math.max(100, SD - p.push);          // removable shelf depth
      /* Two facia planes, and they are not the same one.
         The front drawers are full overlay, like the door: their faces sit IN
         FRONT of the carcass, in the same plane as the door's outer skin, so
         the elevation reads as one flat front. Drawing them at the carcass
         face put them 18 behind the door, which showed from the side at once.
         The inner drawers live behind the door and keep their own plane. */
      var zFront = D / 2 + t / 2;                      // front drawers + door
      var dz = D / 2 - t / 2 - 12;                     // inner drawers

      WB.shell(add, p, IW, D - 20);
      add({ role: 'back', w: IW + 12, h: H - 12, d: backT, x: 0, y: H / 2, z: zBack - backT / 2 });

      /* ── the front drawers, on the floor, facia the full width ──
         These are the plinth bank: they are the bottom of the elevation and do
         not move. `Drawers out` pulls them forward, facia and box together, so
         the opening can be seen. */
      var nOut = Math.max(0, p.odq), oh = p.odh, outH = nOut * oh;
      var slide = WB.slideOf(p, SD);
      for (var i = 0; i < nOut; i++) {
        var oy = yB + oh * i + oh / 2;
        // one channel filler each side, per drawer (sheet qty = qty x 2) —
        // these are fixed to the carcass, so they do not slide
        [-1, 1].forEach(function (s2) {
          add({ role: 'filler', w: t, h: oh, d: remD, x: s2 * (IW / 2 - t / 2),
                y: oy, z: zBack + remD / 2, tag: 'CHANNEL FILLER \u00b7 outer' });
        });
        add({ role: 'drawer', w: W, h: oh - 4, d: t, x: 0, y: oy, z: zFront + slide,
              tag: 'FRONT DRAWER ' + (i + 1) + ' \u00b7 facia full width' });
        WB.drawerBox(add, p, { x: 0, y: oy, zF: zFront + slide, fw: IW - 2 * t, fh: oh,
                               SD: SD, tag: 'FRONT DRAWER ' + (i + 1) });
        WB.handle(add, { x: 0, y: oy, z: zFront + slide, out: 1, dir: 'h',
                         len: Math.min(320, W * 0.45) });
      }

      /* ── behind the door: inner drawers and shelves are LEVELS ──
         Same rules as the 1-door wardrobe: each holds its own height, nothing
         can be dragged through anything else, and the right-click menu
         reorders — a shelf under the inner drawers, between two of them, and
         so on. wardrobe-common.js owns all of it. */
      var floor = yB + outH, ceil = yT;
      var nIn = Math.max(0, p.sdq), ih = p.sdh;
      var nFix = Math.max(0, p.fix), nRem = Math.max(0, p.rem);
      var lv = [], j;
      var dl0 = floor + (ceil - floor) * 0.32;
      for (j = 0; j < nIn; j++)
        lv.push({ key: 'dr|' + j, kind: 'drawer', h: ih, n: j + 1,
                  def: dl0 - ih * j - ih / 2 });
      var sLo = dl0 + 40, sHi = ceil - t / 2 - 40, nS = nFix + nRem;
      for (j = 0; j < nFix; j++)
        lv.push({ key: 'sh|' + j, kind: 'shelf', h: t, n: j + 1,
                  def: nS === 1 ? (sLo + sHi) / 2 : sLo + (sHi - sLo) * j / Math.max(1, nS - 1) });
      for (j = 0; j < nRem; j++)
        lv.push({ key: 'rs|' + j, kind: 'rshelf', h: t, n: j + 1,
                  def: nS === 1 ? (sLo + sHi) / 2
                                : sLo + (sHi - sLo) * (nFix + j) / Math.max(1, nS - 1) });
      WB.layoutLevels(S, lv, floor, ceil);

      var shelfRecs = [], topMost = floor;
      lv.forEach(function (e) {
        topMost = Math.max(topMost, e.y + e.h / 2);
        if (e.kind === 'drawer') {
          [-1, 1].forEach(function (s2) {
            add({ role: 'filler', w: t, h: ih, d: remD, x: s2 * (IW / 2 - t / 2),
                  y: e.y, z: zBack + remD / 2, tag: 'CHANNEL FILLER \u00b7 inner ' + e.n });
          });
          var fw = IW - 2 * t - 4;
          add({ role: 'drawer', w: fw, h: ih - 2, d: t, x: 0, y: e.y, z: dz + slide,
                tag: 'INNER DRAWER ' + e.n, move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                note: 'Right-click to put it above or below another level.' });
          WB.drawerBox(add, p, { x: 0, y: e.y, zF: dz + slide, fw: fw, fh: ih, SD: SD,
                                 tag: 'INNER DRAWER ' + e.n });
          WB.handle(add, { x: 0, y: e.y, z: dz + slide, out: 1, dir: 'h',
                           len: Math.min(260, fw * 0.45) });
        } else {
          var rem = (e.kind === 'rshelf');
          var dep = rem ? remD : SD;
          add({ role: 'shelf', w: IW, h: t, d: dep, x: 0, y: e.y, z: zBack + dep / 2,
                tag: (rem ? 'REMOVABLE' : 'FIX') + ' SHELF ' + e.n,
                move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                note: rem ? 'Pushed in ' + Math.round(p.push) + ' at the front. Right-click to reorder.'
                          : 'Right-click to put it below the inner drawers, or between two of them.' });
          shelfRecs.push({ zone: 'U', y: e.y, x: 0, w: IW });
        }
      });

      if (ceil - topMost > 900)
        add({ role: 'rod', shape: 'cyl-x', w: IW - 40, h: 26, d: 26, x: 0,
              y: ceil - 90, z: zS, tag: 'HANGING ROD' });
      if (p.locker > 0)
        WB.locker(add, notes, p, shelfRecs, ceil, SD, zBack, IW, 'the wardrobe');

      /* ── the door, above the front drawers ── */
      var dh = ceil - floor + t, dw = W;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      var piv = { x: -W / 2, y: floor + dh / 2 - t / 2, z: D / 2, ry: -ang };
      add({ role: 'door', w: dw, h: dh, d: 18, x: dw / 2, y: 0, z: 9, tag: 'DOOR', pivot: piv });
      WB.handle(add, { x: dw - 55, y: 0, z: 18, out: 1, dir: 'v',
                       len: Math.min(600, dh * 0.35), pivot: piv });
      if (nOut > 0)
        notes.push(['warn', 'The sheet cuts the door at ' + Math.round(H - p.skirt) +
          ' (h - skirting), which is the whole front and would cover the front drawers. ' +
          'Drawn at ' + Math.round(dh) + ', above them.']);

      return {
        parts: parts, notes: notes,
        callouts: WB.callouts(p, W, H, D / 2, 1),
        LV: lv, floor: floor, ceil: ceil,
        zones: { U: { x: 0, y0: floor, y1: ceil, w: IW } }, zoneKeys: [],
        vM: { U: 0 }, CM: { U: [] }, HS: { upper: [], lower: [] },
        cols: { L: [], R: [] }, twoCol: false,
        bandOf: function () { return ['U']; },
        geo: { IW: IW, SD: SD, outH: outH, yB: yB, yT: yT },
        hud: 'interior <b>' + Math.round(IW) + '</b> wide · depth <b>' + Math.round(SD) +
             '</b> (removable <b>' + Math.round(remD) + '</b>)<br>front drawers <b>' + nOut +
             '</b> = <b>' + Math.round(outH) + '</b> tall · inner drawers <b>' + nIn +
             '</b><br>fix <b>' + nFix + '</b> · removable <b>' + nRem +
             '</b> · highest level <b>' + Math.round(topMost - floor) + '</b> of <b>' +
             Math.round(ceil - floor) + '</b>'
      };
    },

    targets: WB.levelTargets, moveTo: WB.levelMoveTo, drag: WB.drag
  });
})();
