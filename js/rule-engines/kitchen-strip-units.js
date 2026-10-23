/* rule-engines/kitchen-strip-units.js — the two Kitchen Carcass units that
   have no top panel. Rule codes: ktsu, ksnk.

   Both are the same box as the partition carcass with the top left off: the
   worktop sits on strips laid flat across the front and the back, which is
   how a base unit under a granite or quartz top is built. Neither has a
   vertical, so neither has bays.

   ── Top Strip Unit with Back  (A65:H126) · ktsu
     Upper strip back     w-2ply  x back_strip_w
     Upper strip front    w-2ply  x front_strip_w
     Bottom               w-2ply  x d
     Back                 Zari: w-18 x h-18-skirting · Outer: w x h
     Left / Right side    d       x h
     Skirting             skirting x w-2ply
     Shelf                w-2ply  x (Zari: d-30 · Outer: d)
     4" / 6" Innotech     w-104 x 490, backs w-104-12 at 66 and 144

   ── SINK UNIT  (A131:H184) · ksnk
     Front strip          w-2ply  x back_strip_w     qty 2
     Back strip           w-2ply  x front_strip_w    qty 2
     Bottom               w-2ply  x d
     Shelf                w-2ply  x d
     Skirting, sides      as above
     The bottom is a PLAIN panel: no strips under it.
     NO BACK of any kind, and no Innotech — the plumbing comes through the
     open back, which is why the unit exists as its own item.

   Three things in the sheet are reported rather than obeyed, because obeying
   them would draw something wrong:
     · ktsu's "Upper strip front" has its width formula pointing at
       back_strip_w, so both strips come out the same size whatever the front
       strip input says
     · ktsu's 6" Innotech rows are counted by hettich_4in_innotech_qty
     · ksnk cuts TWO of each strip; the bottom is a plain panel with nothing
       under it, so only one pair is drawn, closing the top */
(function () {
  'use strict';
  var WB = window.ASM3D_WB, KC = window.ASM3D_KC;

  /* Both units are one bay, so this is the partition carcass without the
     verticals: shelves and Innotech boxes stacked in a single column. */
  function build(p, S, cfg) {
    var notes = [], parts = [], t = p.ply;
    function add(o) { parts.push(o); }
    var W = p.W, H = p.H, D = p.D;

    var fS = Math.max(0, p.fstrip), bS = Math.max(0, p.bstrip);
    var g = KC.shell(add, p, { noTop: true, fStrip: fS, bStrip: bS,
                               pairs: cfg.pairs, noBack: cfg.noBack });
    var yB = g.yB, yT = g.yT - (cfg.pairs ? 0 : 0), IH = yT - yB;
    var bayW = g.IW;
    var shelfD = cfg.shelfFull ? D : (g.outer ? D : D - 30);
    var slide = WB.slideOf(p, 490);

    if (!KC.hasSkirt(p))
      notes.push(['ok', 'No skirting — the box sits on the floor.']);

    var nSh = Math.max(0, p.fix);
    var n4 = cfg.innotech ? Math.max(0, p.h4q) : 0;
    var n6 = cfg.innotech ? Math.max(0, p.h6q) : 0;
    var lv = [], j;
    for (j = 0; j < n4; j++)
      lv.push({ key: 'd4|' + j, kind: 'drawer', h: 66 + 6, n: j + 1, col: 0, in4: true });
    for (j = 0; j < n6; j++)
      lv.push({ key: 'd6|' + j, kind: 'drawer', h: 144 + 6, n: j + 1, col: 0 });
    for (j = 0; j < nSh; j++)
      lv.push({ key: 'sh|' + j, kind: 'shelf', h: t, n: j + 1, col: 0 });

    var y = yB;
    lv.forEach(function (e) { if (e.kind === 'drawer') { e.def = y + e.h / 2; y += e.h; } });
    var sh = lv.filter(function (e) { return e.kind !== 'drawer'; });
    sh.forEach(function (e, k) { e.def = y + (yT - 40 - y) * (k + 1) / (sh.length + 1); });
    WB.layoutLevels(S, lv, yB, yT);
    if (lv.over > 1)
      notes.push(['err', 'The unit needs ' + Math.round(IH + lv.over) +
        ' and the interior is ' + Math.round(IH) + '. Reduce the shelves or the drawers.']);

    lv.forEach(function (e) {
      if (e.kind === 'drawer') {
        var hh = e.in4 ? 66 : 144;
        KC.innotech(add, p, { x: 0, y: e.y - e.h / 2, w: W - 104, h: hh,
                              slide: slide, narrowBack: true,
                              tag: (e.in4 ? '4" ' : '6" ') + 'INNOTECH ' + e.n });
        add({ role: 'drawer', w: W - 104, h: hh, d: 2, x: 0, y: e.y,
              z: D / 2 - 18 + slide,
              tag: (e.in4 ? '4" ' : '6" ') + 'INNOTECH ' + e.n,
              move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
              note: 'Innotech box, ' + Math.round(W - 104) + '×490, back ' + hh +
                    '. Right-click to move it up or down.' });
      } else {
        add({ role: 'shelf', w: bayW, h: t, d: shelfD, x: 0, y: e.y,
              z: D / 2 - shelfD / 2,
              tag: 'SHELF ' + e.n + ' (' + Math.round(bayW) + '×' +
                   Math.round(shelfD) + ')',
              move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
              note: 'Right-click to move it up or down.' });
      }
    });

    cfg.notes(notes, p, g);

    return {
      parts: parts, notes: notes,
      callouts: WB.callouts(p, W, H, D / 2, 0),
      LV: lv, floor: yB, ceil: yT, nBays: 1,
      zones: {}, zoneKeys: [], vM: {}, CM: {},
      HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: false,
      bandOf: function () { return []; },
      geo: { IW: g.IW, IH: IH, colW: bayW, SD: shelfD, yB: yB, yT: yT },
      hud: 'interior <b>' + Math.round(g.IW) + '×' + Math.round(IH) +
           '</b> · depth <b>' + Math.round(D) + '</b><br>strips front <b>' +
           Math.round(fS) + '</b> · back <b>' + Math.round(bS) + '</b>' +
           (cfg.pairs === 2 ? ' · <b>two</b> pairs' : '') +
           '<br>shelves <b>' + nSh + '</b> (depth <b>' + Math.round(shelfD) + '</b>)' +
           (cfg.innotech ? ' · innotech <b>' + n4 + '</b>×4" <b>' + n6 +
                           '</b>×6"' : '') +
           '<br>back <b>' + (cfg.noBack ? 'none — open' : g.outer ? 'outer' : 'zari') +
           '</b> · skirting <b>' +
           (KC.hasSkirt(p) ? Math.round(p.skirt) : 'none') + '</b>'
    };
  }

  var CTL = [WB.DRAW_CTL,
             { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Opacity' }];

  window.ASM3D.register('ktsu', {
    label: 'Kitchen Top Strip Unit with Back',
    category: 'kitchen', version: KC.VERSION, inputs: WB.INPUTS, controls: CTL,
    newState: WB.fresh, onInputChange: WB.onInputChange,
    solve: function (p, S) {
      return build(p, S, {
        pairs: 1, noBack: false, innotech: true, shelfFull: false,
        notes: function (notes, q) {
          if (q.fstrip !== q.bstrip)
            notes.push(['warn', 'The sheet cuts UPPER STRIP FRONT from back_strip_w, not ' +
              'front_strip_w, so both strips come out ' + Math.round(q.bstrip) +
              ' in the cut list. Drawn at the sizes you asked for — ' +
              Math.round(q.fstrip) + ' front, ' + Math.round(q.bstrip) + ' back.']);
          if (q.h6q > 0)
            notes.push(['warn', 'The 6" INNOTECH rows are counted by ' +
              'hettich_4in_innotech_qty in the sheet, so the 6" quantity never reaches ' +
              'the cut list. Drawn from the 6" input here.']);
        }
      });
    },
    targets: KC.targets, moveTo: KC.moveTo, drag: WB.drag
  });

  window.ASM3D.register('ksnk', {
    label: 'Kitchen Sink Unit',
    category: 'kitchen', version: KC.VERSION, inputs: WB.INPUTS, controls: CTL,
    newState: WB.fresh, onInputChange: WB.onInputChange,
    solve: function (p, S) {
      return build(p, S, {
        pairs: 1, noBack: true, innotech: false, shelfFull: true,
        notes: function (notes) {
          notes.push(['ok', 'No back panel — the sheet cuts none, which is what makes ' +
            'this a sink unit: the waste and the stop cocks come through the open back.']);
          notes.push(['warn', 'The sheet cuts TWO front strips and TWO back strips. The ' +
            'bottom is a plain panel with nothing under it, so only one pair is drawn, ' +
            'closing the top.']);
        }
      });
    },
    targets: KC.targets, moveTo: KC.moveTo, drag: WB.drag
  });
})();
