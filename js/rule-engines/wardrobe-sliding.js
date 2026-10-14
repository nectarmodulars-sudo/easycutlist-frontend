/* rule-engines/wardrobe-sliding.js — sliding wardrobe (and sliding + bottom
   wheels). Rule code: slwb.

   Two columns behind two sliding doors on their own tracks. Everything about
   the carcass lives in wardrobe-carcass.js; this file is the doors, the border
   frame the sliding track needs, and the input list. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  function doors(add, p, g) {
    var t = p.ply, W = p.W, H = p.H, D = p.D, zF = D / 2 - t / 2;
    // the front border the track sits in — sliding doors need it, hinged do not
    add({ role: 'border', w: W, h: 100, d: t, x: 0, y: H - 50, z: zF, tag: 'TOP BORDER' });
    add({ role: 'border', w: W, h: 100, d: t, x: 0, y: 50, z: zF, tag: 'BOTTOM BORDER' });
    add({ role: 'border', w: 50, h: H, d: t, x: -(W - 50) / 2, y: H / 2, z: zF });
    add({ role: 'border', w: 50, h: H, d: t, x: (W - 50) / 2, y: H / 2, z: zF });
    // Control centred = shut. Positive slides DOOR 1 right, negative slides
    // DOOR 2 left, so either bay can be opened.
    var sl = (p.doorLR || 0) / 100, dw = W / 2, dh = H - 129, tr = dw * 0.96;
    var d1x = -dw / 2, d2x = dw / 2;
    if (sl > 0) d1x += sl * tr;
    if (sl < 0) d2x += sl * tr;
    add({ role: 'door', w: dw, h: dh, d: 25, x: d1x, y: H / 2 - 14, z: D / 2 - 16, tag: '25MM DOOR 1' });
    add({ role: 'door', w: dw, h: dh, d: 25, x: d2x, y: H / 2 - 14, z: D / 2 - 48, tag: '25MM DOOR 2' });
  }

  window.ASM3D.register('slwb', {
    label: 'Sliding Wardrobe',
    category: 'wardrobes',
    version: WB.VERSION,
    inputs: WB.INPUTS,
    controls: [
      { id: 'doorLR', type: 'range', min: -100, max: 100, val: 0, label: 'Door slide' },
      WB.DRAW_CTL,
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }
    ],
    newState: WB.fresh,
    onInputChange: WB.onInputChange,
    // Sheet: partition depth d-120 (the door tracks eat the front), shelves
    // and verticals one ply shallower again.
    solve: function (p, S) {
      return WB.quarters(p, S, { doors: doors, nDoors: 2,
        SD: function (q) { return q.D - 120 - q.ply; },
        partD: function (q) { return q.D - 120; },
        // Unlike the openables, the sliding carcass panels ARE the full depth:
        // the sheet cuts top, bottom and sides at d, not d-20.
        carcD: function (q) { return q.D; } });
    },
    targets: WB.targets, moveTo: WB.moveTo, drag: WB.drag
  });
})();
