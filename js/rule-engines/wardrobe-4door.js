/* rule-engines/wardrobe-4door.js — 4 door openable wardrobe. Rule code: 4dw.

   The same two-column carcass as the sliding wardrobe (the sheet's `Cp` is the
   centre partition), with four hinged doors instead of two sliding ones: two
   per column, each pair hinged at that column's outer edges and meeting in the
   middle of the column. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  function doors(add, p, g) {
    var W = p.W, H = p.H, D = p.D;
    var dw = W / 4 - 2, dh = H - p.skirt - 4, yc = p.skirt + dh / 2;
    var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
    // hinge x, which way the door swings, and which leaf it is
    var leaf = [
      { hx: -W / 2,  sgn: -1, n: 1 },
      { hx: -2,      sgn: 1,  n: 2 },
      { hx: 2,       sgn: -1, n: 3 },
      { hx: W / 2,   sgn: 1,  n: 4 }
    ];
    leaf.forEach(function (L) {
      var piv = { x: L.hx, y: yc, z: D / 2, ry: L.sgn * ang };
      add({ role: 'door', w: dw, h: dh, d: 18, x: -L.sgn * dw / 2, y: 0, z: 9,
            tag: 'DOOR ' + L.n, pivot: piv });
      WB.handle(add, { x: -L.sgn * (dw - 55), y: 0, z: 18, out: 1, dir: 'v',
                       len: Math.min(600, dh * 0.35), pivot: piv });
    });
  }

  window.ASM3D.register('4dw', {
    label: '4-Door Openable Wardrobe',
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
    // Sheet: fix shelf d-50, Cp d-20.
    solve: function (p, S) {
      return WB.quarters(p, S, { doors: doors, nDoors: 4,
        SD: function (q) { return q.D - 50; },
        partD: function (q) { return q.D - 20; } });
    },
    targets: WB.targets, moveTo: WB.moveTo, drag: WB.drag
  });
})();
