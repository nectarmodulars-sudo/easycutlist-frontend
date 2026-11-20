/* rule-engines/wardrobe-2door-bottom.js — 2 doors open + bottom drawers.
   Rule code: 2dwb.

   A 2-door openable wardrobe standing on a bank of WHEEL drawers. The bank is
   one row, not a stack: `Bottom drawers qty` is a dropdown reading "one" or
   "two", and two means two drawers SIDE BY SIDE with a centre filler between
   them. Their facias are outside the doors, so they are part of the front
   elevation, and the doors start above them.

   From the sheet (A355:H436):
     Top / Bottom        w-2ply       x d-20
     Left / Right side   d-20         x h            ← full height, floor to top
     Back                w-20         x h-bottom_drawer_ht-20
     Doors               w/2-3        x h-bottom_drawer_ht-3   x2
     Fix shelf           w-2ply       x d-50
     Removable shelf     w-2ply       x (d-50)-shelf_push
     Upper half shelf    ((w-2ply)-ply)/2 x (d-50)-shelf_push
     Lower half shelf    same
     Upper vertical      upper_vertical_ht                x d-50
     Lower vertical      h-2ply-ply-bottom_drawer_ht-upper_vertical_ht x d-50
     Internal drawers    facia (w-4ply)/2-4               ← half width, in pairs
     WHEEL drawer        facia  one → w · two → w/2-4, qty 2
                         centre filler d-50 x bottom_drawer_ht, only when two
                         sides d-50-20, bottom 6mm

   The two verticals add up to the whole interior above the bank less one ply:
   the upper band is cut at `upper_vertical_ht` and the lower band takes the
   rest, with one fix shelf between them. So the upper band is stated by the
   sheet here, not taken from the hanger-space input — cfg.hang says so. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* The bank: one row of wheel drawers under the doors, their facias in the
     door plane so the front reads flat. They do not move — they are the foot
     of the unit — but they do pull out. */
  function bank(add, p, notes) {
    var t = p.ply, W = p.W, D = p.D, IW = W - 2 * t;
    var bh = Math.max(60, p.odh), y0 = p.skirt;
    var two = String(p.odSide || '').toLowerCase().indexOf('two') === 0;
    var n = two ? 2 : 1;
    var SD = Math.max(150, D - 50);
    var slide = WB.slideOf(p, SD);
    var zFront = D / 2 + t / 2;
    var y = y0 + bh / 2;

    if (two)                                   // the centre filler, fixed
      add({ role: 'filler', w: t, h: bh, d: Math.max(100, D - 50), x: 0, y: y,
            z: -D / 2 + p.backT + Math.max(100, D - 50) / 2,
            tag: 'CENTRE FILLER · bottom drawers' });

    for (var i = 0; i < n; i++) {
      var fw = two ? (W / 2 - 4) : W;          // facia, outside the doors
      var cx = two ? (i ? 1 : -1) * (W / 4) : 0;
      var boxW = two ? (IW - t) / 2 - 6 : IW - 6;
      add({ role: 'drawer', w: fw, h: bh - 8, d: t, x: cx, y: y, z: zFront + slide,
            tag: 'BOTTOM DRAWER ' + (i + 1) + (two ? ' · ' + (i ? 'right' : 'left') : '') +
                 ' · wheel' });
      WB.drawerBox(add, p, { x: cx, y: y, zF: zFront + slide, fw: boxW, fh: bh, SD: SD,
                             tag: 'BOTTOM DRAWER ' + (i + 1) });
      WB.handle(add, { x: cx, y: y, z: zFront + slide, out: 1, dir: 'h',
                       len: Math.min(320, fw * 0.45) });
    }
    if (!p.odSide)
      notes.push(['warn', 'BOTTOM DRAWERS QTY is empty — drawn as one full-width drawer.']);
    return bh;
  }

  /* Two doors, above the bank. The sheet cuts them h - bottom_drawer_ht - 3,
     which is exactly the front above the bank, so nothing has to be reported
     here the way the 1-door + front drawers item does. */
  function doors(add, p, g) {
    var W = p.W, H = p.H, D = p.D;
    var bh = Math.max(60, p.odh), y0 = p.skirt + bh;
    var dw = W / 2 - 3, dh = H - bh - p.skirt - 3;
    var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
    [[-1, 'DOOR 1'], [1, 'DOOR 2']].forEach(function (s) {
      var sgn = s[0];
      var piv = { x: sgn * (W / 2), y: y0 + dh / 2, z: D / 2, ry: sgn * ang };
      add({ role: 'door', w: dw, h: dh, d: 18, x: -sgn * dw / 2, y: 0, z: 9,
            tag: s[1], pivot: piv });
      WB.handle(add, { x: -sgn * (dw - 55), y: 0, z: 18, out: 1, dir: 'v',
                       len: Math.min(600, dh * 0.35), pivot: piv });
    });
  }

  window.ASM3D.register('2dwb', {
    label: '2 Doors Open Wardrobe + Bottom Drawers',
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
      /* The bank REPLACES the skirting — it is what the wardrobe stands on,
         and the sheet's own figures only balance with no skirting under it:
         h - 2ply - ply - bottom_drawer_ht - upper_vertical_ht leaves exactly
         the interior when the carcass starts at the floor. */
      var q = {}; for (var k in p) q[k] = p[k];
      q.skirt = 0;
      p = q;
      var res = WB.column(p, S, {
        doors: doors, nDoors: 2,
        base: function (q) { return Math.max(60, q.odh); },   // the drawer bank
        hang: function (q) { return q.uvH; },                 // upper vertical ht
        SD:   function (q) { return q.D - 50; },
        carcD: function (q) { return q.D - 20; }
      });
      var bh = bank(function (o) { res.parts.push(o); }, p, res.notes);

      /* What the sheet says the lower vertical is, against what is left after
         the upper band and the shelf between the bands. They should agree; if
         the inputs do not add up to the height, the model is right and the
         sheet's own figure is the one to look at. */
      var t = p.ply;
      var lvSheet = p.H - 2 * t - t - bh - p.uvH;
      if (p.uvH > 0 && res.geo && Math.abs(lvSheet - res.geo.lH) > 2)
        res.notes.push(['warn', 'The sheet cuts the LOWER VERTICAL at ' +
          Math.round(lvSheet) + ' (h - 2ply - ply - bottom drawer ht - upper vertical ht), ' +
          'which leaves no room for the internal drawer band. The lower band here is ' +
          Math.round(res.geo.lH) + ' \u2014 shorter by the ' + Math.round(res.geo.dlH) +
          ' the drawers take. Reduce UPPER VERTICAL HT by that much, or cut the lower ' +
          'vertical at ' + Math.round(res.geo.lH) + '.']);

      res.hud = 'interior <b>' + Math.round(res.geo.IW) + '×' + Math.round(res.geo.IH) +
                '</b> · depth <b>' + Math.round(res.geo.SD) +
                '</b><br>bottom drawers <b>' +
                (String(p.odSide || '').toLowerCase().indexOf('two') === 0 ? 'two, side by side'
                                                                          : 'one, full width') +
                '</b> = <b>' + Math.round(bh) + '</b> tall<br>upper band <b>' +
                Math.round(res.geo.uH) + '</b> · drawers <b>' + Math.round(res.geo.dlH) +
                '</b> · lower band <b>' + Math.round(res.geo.lH) + '</b>';
      return res;
    },

    targets: WB.targets, moveTo: WB.moveTo, drag: WB.drag
  });
})();
