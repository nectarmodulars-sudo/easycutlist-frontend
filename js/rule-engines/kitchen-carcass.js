/* rule-engines/kitchen-carcass.js — Kitchen Carcass · "Carcass With Partition;
   FULL TOP. Skirting optional." Rule code: kcp.

   The base box of a kitchen run: a full-depth top and bottom, sides cut the
   whole height, any number of verticals cutting it into equal bays, shelves
   among those bays, and Hettich Innotech drawer boxes. No shutter — shutters
   are their own catalogue item — so nothing here has a facia.

   From the sheet (Kitchen Carcass A1:H59):
     Top              w-2ply x (Gola: d-30 · No: d)     ← 30 at the FRONT
     Bottom           w-2ply                          x d          ← FULL depth
     Left / Right     d                               x h          ← FULL height
     Back             Zari: w-20 x h-20-skirting      ┐ one or the other
                      Outer Back: w x h               ┘
     Skirting         skirting x w-2ply               ← blank cell = none at all
     Vertical         h-2ply-skirting x d-ply-10      qty = vertical
     Shelf            (w-2ply-vertical*ply)/(vertical+1)
                      x (Zari: d-30 · Outer Back: d)  qty = shelf qty
     4" Innotech      bay-68 x 490, back 66           qty = hettich 4in qty
     6" Innotech      bay-68 x 490, back 144          qty = hettich 6in qty

   The shelf width is what fixes the bays: it is the interior less the
   verticals, divided equally, so n verticals make n+1 bays of equal width and
   every shelf belongs to one of them. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB, KC = window.ASM3D_KC;

  window.ASM3D.register('kcp', {
    label: 'Kitchen Carcass with Partition',
    category: 'kitchen',
    version: KC.VERSION,
    inputs: WB.INPUTS,
    controls: [
      WB.DRAW_CTL,
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Opacity' }
    ],
    newState: WB.fresh,
    onInputChange: WB.onInputChange,

    solve: function (p, S) {
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D;

      var g = KC.shell(add, p, {});
      var yB = g.yB, yT = g.yT, IH = yT - yB;
      var nV = Math.max(0, Math.round(p.vcount));
      var bays = KC.bays(p, nV, g);
      var shelfD = g.outer ? D : D - 30;
      var slide = WB.slideOf(p, 490);

      if (!KC.hasSkirt(p))
        notes.push(['ok', 'No skirting — the sheet leaves every skirting part blank ' +
          'and the box sits on the floor.']);

      /* the verticals: full interior height, slightly shallower than the box */
      var vD = Math.max(100, D - t - 10);
      for (var i = 1; i <= nV; i++) {
        var vx = bays[i].x - bays[i].w / 2 - t / 2;
        add({ role: 'vertical', w: t, h: IH, d: vD, x: vx, y: yB + IH / 2,
              z: D / 2 - vD / 2, noV: true,
              tag: 'VERTICAL ' + i + ' (' + Math.round(IH) + '×' + Math.round(vD) + ')' });
      }

      /* ── what lives in the bays ──
         Shelves are shared out one per bay in turn, and the drawer boxes stack
         on the floor of the first bay. Both are LEVELS, so each one moves on
         its own and the right-click menu sends it to another bay. */
      var nSh = Math.max(0, p.fix), n4 = Math.max(0, p.h4q), n6 = Math.max(0, p.h6q);
      S.shCol = S.shCol || {};
      var items = [], j;
      for (j = 0; j < n4; j++)
        items.push({ key: 'd4|' + j, kind: 'drawer', h: 66 + 6, n: j + 1,
                     defBay: 0, in4: true });
      for (j = 0; j < n6; j++)
        items.push({ key: 'd6|' + j, kind: 'drawer', h: 144 + 6, n: j + 1,
                     defBay: 0, in6: true });
      for (j = 0; j < nSh; j++)
        items.push({ key: 'sh|' + j, kind: 'shelf', h: t, n: j + 1,
                     defBay: bays.length ? j % bays.length : 0 });
      items.forEach(function (e) { e.col = KC.bayOf(S, e, bays.length); });

      var LV = [];
      bays.forEach(function (b) {
        var lv = items.filter(function (e) { return e.col === b.i; });
        // drawers stack from the floor, shelves spread over whatever is left
        var y = yB;
        lv.forEach(function (e) { if (e.kind === 'drawer') { e.def = y + e.h / 2; y += e.h; } });
        var sh = lv.filter(function (e) { return e.kind !== 'drawer'; });
        sh.forEach(function (e, k) {
          e.def = y + (yT - 40 - y) * (k + 1) / (sh.length + 1);
        });
        WB.layoutLevels(S, lv, yB, yT);
        if (lv.over > 1)
          notes.push(['err', 'Bay ' + (b.i + 1) + ' needs ' + Math.round(IH + lv.over) +
            ' and the interior is ' + Math.round(IH) +
            '. Move something to another bay, or reduce it.']);
        lv.forEach(function (e) { LV.push(e); });

        lv.forEach(function (e) {
          if (e.kind === 'drawer') {
            var hh = e.in4 ? 66 : 144;
            KC.innotech(add, p, { x: b.x, y: e.y - e.h / 2, w: b.w - 68, h: hh,
                                  slide: slide, narrowBack: e.in4,
                                  tag: (e.in4 ? '4" ' : '6" ') + 'INNOTECH ' + e.n });
            // one clickable face for the whole box, so it can be selected
            add({ role: 'drawer', w: b.w - 68, h: hh, d: 2, x: b.x, y: e.y,
                  z: p.D / 2 - 18 + slide,
                  tag: (e.in4 ? '4" ' : '6" ') + 'INNOTECH ' + e.n + ' · bay ' + (b.i + 1),
                  move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                  note: 'Innotech box, ' + Math.round(b.w - 68) + '×490, back ' + hh +
                        '. Right-click to move it up or down, or into another bay.' });
          } else {
            add({ role: 'shelf', w: b.w, h: t, d: shelfD, x: b.x, y: e.y,
                  z: D / 2 - shelfD / 2,
                  tag: 'SHELF ' + e.n + ' · bay ' + (b.i + 1) + ' (' +
                       Math.round(b.w) + '×' + Math.round(shelfD) + ')',
                  move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                  note: 'Cut ' + Math.round(b.w) + ' wide — every bay is the same ' +
                        'width, so it fits any of them. Right-click to move it.' });
          }
        });
      });

      if (nSh > 0 && bays.length > 1 && nSh % bays.length !== 0)
        notes.push(['warn', 'SHELF QTY ' + nSh + ' does not divide evenly between ' +
          bays.length + ' bays — they are shared out one per bay in turn. ' +
          'Right-click a shelf to put it somewhere else.']);

      return {
        parts: parts, notes: notes,
        callouts: WB.callouts(p, W, H, D / 2, 0),
        LV: LV, floor: yB, ceil: yT, nBays: bays.length,
        zones: {}, zoneKeys: [], vM: {}, CM: {},
        HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: false,
        bandOf: function () { return []; },
        geo: { IW: g.IW, IH: IH, colW: bays.length ? bays[0].w : g.IW, SD: shelfD,
               yB: yB, yT: yT },
        hud: 'interior <b>' + Math.round(g.IW) + '×' + Math.round(IH) +
             '</b> · depth <b>' + Math.round(D) + '</b><br><b>' + nV +
             '</b> vertical' + (nV === 1 ? '' : 's') + ' → <b>' + bays.length +
             '</b> bays of <b>' + Math.round(bays.length ? bays[0].w : g.IW) +
             '</b><br>shelves <b>' + nSh + '</b> (depth <b>' + Math.round(shelfD) +
             '</b>) · innotech <b>' + n4 + '</b>×4" <b>' + n6 + '</b>×6"' +
             '<br>back <b>' + (g.outer ? 'outer' : 'zari') + '</b> · skirting <b>' +
             (KC.hasSkirt(p) ? Math.round(p.skirt) : 'none') + '</b> · gola <b>' +
             (g.gola ? 'yes — top ' + Math.round(g.topD) : 'no') + '</b>'
      };
    },

    targets: KC.targets, moveTo: KC.moveTo, drag: WB.drag
  });
})();
