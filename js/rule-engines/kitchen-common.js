/* rule-engines/kitchen-common.js — everything the kitchen units share.

   A kitchen carcass is not a wardrobe and almost none of the wardrobe's
   machinery applies: no doors (shutters are their own catalogue item), no
   hanging space, no bands, no quarters. What it does have, in every unit on
   the Kitchen Carcass tab:

     · full-depth top and bottom, and sides cut the FULL height, so the box is
       a plain rectangle with the bottom raised by the skirting
     · a back in one of two modes — "Zari", inset and cut w-20 x h-20-skirting,
       or "Outer Back", a full overlay cut w x h
     · skirting that is OPTIONAL: an empty cell means no skirting at all, and
       the sheet writes "" for every skirting part when that happens
     · Hettich Innotech drawer boxes, 4" and 6", which have no facia here: they
       are 490 deep, as wide as their bay less 68, and 66 or 144 tall

   The LEVEL machinery (stacking, clamping, the right-click reorder) lives in
   wardrobe-common.js and is not wardrobe-specific, so this file reuses it and
   only adds what is particular to a kitchen box. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;
  var KC = {};

  KC.VERSION = '1.0.0';

  /* `skirting` is read as a number everywhere else, so "no skirting" has to be
     recovered from the raw input: the sheet tests the cell for blank, not for
     zero, and 0 and blank mean the same thing in the model. */
  KC.hasSkirt = function (p) { return (p.skirt || 0) > 0; };
  KC.outerBack = function (p) {
    return String(p.backMode || '').toLowerCase().indexOf('outer') === 0;
  };
  /* Gola is the aluminium profile that runs under the front edge of the top
     and is gripped instead of a handle. It is bought, not cut, so the sheet
     shows it only by cutting the top d-30 instead of d: the 30 at the FRONT
     is the profile's room. */
  KC.gola = function (p) {
    return String(p.gola || '').toLowerCase().indexOf('y') === 0;
  };

  /* The box. Sides run the full height, the bottom is full depth, and the
     bottom sits on the skirting when there is one.

     o.noTop     no top panel — the unit is closed by strips instead
     o.fStrip    front strip depth (0 = none)
     o.bStrip    back strip depth
     o.pairs     2 draws a second pair of strips at the bottom
     o.noBack    no back panel at all (the sink unit: plumbing comes through) */
  KC.shell = function (add, p, o) {
    o = o || {};
    var t = p.ply, W = p.W, H = p.H, D = p.D;
    var IW = W - 2 * t, sk = KC.hasSkirt(p) ? p.skirt : 0;
    var outer = KC.outerBack(p), backT = p.backT;
    add({ role: 'side', w: t, h: H, d: D, x: -(W - t) / 2, y: H / 2, z: 0, tag: 'LEFT SIDE' });
    add({ role: 'side', w: t, h: H, d: D, x: (W - t) / 2, y: H / 2, z: 0, tag: 'RIGHT SIDE' });
    add({ role: 'carcass', w: IW, h: t, d: D, x: 0, y: sk + t / 2, z: 0, tag: 'BOTTOM' });
    var topD = KC.gola(p) ? Math.max(100, D - 30) : D;
    if (!o.noTop) {
      add({ role: 'carcass', w: IW, h: t, d: topD, x: 0, y: H - t / 2,
            z: -D / 2 + topD / 2,
            tag: 'TOP · ' + (KC.gola(p) ? 'gola (' + Math.round(topD) + ')' : 'full') });
      if (KC.gola(p))
        add({ role: 'filler', w: IW, h: t, d: 30, x: 0, y: H - t / 2, z: D / 2 - 15,
              tag: 'GOLA PROFILE 30 · bought, not cut' });
    } else {
      /* Strips instead of a top: one at the front edge and one at the back,
         laid flat, with the worktop resting on them. */
      var rows = [[H - t / 2, 'upper']];
      if (o.pairs === 2) rows.push([sk + t + t / 2, 'lower']);
      rows.forEach(function (r) {
        if (o.fStrip > 0)
          add({ role: 'carcass', w: IW, h: t, d: o.fStrip, x: 0, y: r[0],
                z: D / 2 - o.fStrip / 2,
                tag: r[1].toUpperCase() + ' FRONT STRIP ' + Math.round(o.fStrip) });
        if (o.bStrip > 0)
          add({ role: 'carcass', w: IW, h: t, d: o.bStrip, x: 0, y: r[0],
                z: -D / 2 + o.bStrip / 2,
                tag: r[1].toUpperCase() + ' BACK STRIP ' + Math.round(o.bStrip) });
      });
    }
    if (sk > 0)
      add({ role: 'skirting', w: IW, h: sk, d: t, x: 0, y: sk / 2, z: D / 2 - t / 2,
            tag: 'SKIRTING ' + Math.round(sk) });
    if (o.noBack) { /* nothing: the sheet cuts no back for this unit */ }
    else if (outer)
      add({ role: 'back', w: W, h: H, d: backT, x: 0, y: H / 2, z: -D / 2 - backT / 2,
            tag: 'BACK · outer (' + Math.round(W) + '×' + Math.round(H) + ')' });
    else
      add({ role: 'back', w: W - 18, h: H - 18 - sk, d: backT, x: 0,
            y: sk + (H - 18 - sk) / 2, z: -D / 2 + backT / 2,
            tag: 'BACK · zari (' + Math.round(W - 18) + '×' +
                 Math.round(H - 18 - sk) + ')' });
    return { IW: IW, sk: sk, yB: sk + t, yT: H - t, outer: outer,
             topD: topD, gola: KC.gola(p) && !o.noTop };
  };

  /* n verticals cut the interior into n+1 bays of equal width — the sheet's
     own shelf width, (w-2ply-n*ply)/(n+1), says so. */
  KC.bays = function (p, n, g) {
    var t = p.ply, bw = (g.IW - n * t) / (n + 1), out = [];
    var x = -g.IW / 2;
    for (var i = 0; i <= n; i++) {
      out.push({ i: i, x: x + bw / 2, w: bw, id: String(i) });
      x += bw + t;
    }
    return out;
  };

  /* A Hettich Innotech box: no facia on this item, since the shutter is a
     separate catalogue item. 490 deep, bay less 68 wide, and as tall as the
     back the sheet cuts for it. */
  KC.innotech = function (add, p, o) {
    var t = p.ply, bt = 6, sideT = 16;
    var bw = o.w, dep = 490, hh = o.h;
    var zF = p.D / 2 - 20 + (o.slide || 0), zc = zF - dep / 2;
    add({ role: 'drawer', w: sideT, h: hh, d: dep, x: o.x - bw / 2 + sideT / 2,
          y: o.y + hh / 2, z: zc, tag: o.tag + ' · side' });
    add({ role: 'drawer', w: sideT, h: hh, d: dep, x: o.x + bw / 2 - sideT / 2,
          y: o.y + hh / 2, z: zc, tag: o.tag + ' · side' });
    add({ role: 'drawer', w: bw - (o.narrowBack ? 12 : 0), h: hh, d: t, x: o.x,
          y: o.y + hh / 2, z: zc - dep / 2 + t / 2,
          tag: o.tag + ' · back ' + Math.round(hh) });
    add({ role: 'drawer', w: bw, h: bt, d: dep, x: o.x, y: o.y + bt / 2, z: zc,
          tag: o.tag + ' · bottom ' + Math.round(bw) + '×490' });
    add({ role: 'drawer', w: bw, h: hh, d: 20, x: o.x, y: o.y + hh / 2, z: zF + 10,
          tag: o.tag + ' · front rail' });
  };

  /* The bay helpers live in wardrobe-common.js now — they are not kitchen
     specific, and the service tables use them too. */
  KC.bayOf = WB.bayOf;
  KC.zoneFor = WB.zoneForBay;
  KC.targets = WB.bayTargets;
  KC.moveTo = WB.bayMoveTo;

  window.ASM3D_KC = KC;
})();
