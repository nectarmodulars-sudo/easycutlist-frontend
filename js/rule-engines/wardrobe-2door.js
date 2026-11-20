/* rule-engines/wardrobe-2door.js — 2 door openable wardrobe. Rule code: 2dw.

   One column, no centre partition (the sheet's fix shelf is the full interior
   width), so there are no quarters: an upper zone and a lower zone, each split
   into bays by its vertical. Two hinged doors on the outer edges. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  function doors(add, p, g) {
    var W = p.W, H = p.H, D = p.D, t = p.ply;
    var dw = (g.IW + 2 * t) / 2, dh = H - p.skirt - 4;
    var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
    [[-1, 'DOOR 1'], [1, 'DOOR 2']].forEach(function (s) {
      var sgn = s[0], piv = { x: sgn * (W / 2), y: p.skirt + dh / 2, z: D / 2, ry: sgn * ang };
      add({ role: 'door', w: dw, h: dh, d: 18, x: -sgn * dw / 2, y: 0, z: 9, tag: s[1], pivot: piv });
      WB.handle(add, { x: -sgn * (dw - 55), y: 0, z: 18, out: 1, dir: 'v',
                       len: Math.min(600, dh * 0.35), pivot: piv });
    });
  }

  var DEF = {
    label: '2-Door Openable Wardrobe',
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
    // Sheet: fix shelf d-50.
    solve: function (p, S) {
      return WB.column(p, S, { doors: doors, nDoors: 2,
        SD: function (q) { return q.D - 50; },
        carcD: function (q) { return q.D - q.ply - 2; } });
    },
    targets: WB.targets, moveTo: WB.moveTo, drag: WB.drag
  };

  window.ASM3D.register('2dw', DEF);
  // The Master Sheet may still say "wb2d" on this item; same engine either way.
  window.ASM3D.register('wb2d', DEF);
})();
