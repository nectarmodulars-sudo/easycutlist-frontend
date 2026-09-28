/* rule-engines/cabinets.js — cabinet rule set, Master Sheet tab "Cabinets".
   Registers one code, `cab`, covering the whole family:

     variant   Master Sheet item                        sheet rows
     --------------------------------------------------------------------
     1         1 Door Cabinet                            2- 23
     2         2 Doors Cabinet                          52- 73
     3         3 Doors Cabinet                         100-124
     4         4 Doors Cabinet                         149-173   (no Range Config row)
     4h        4 Half Hyd Doors Cabinet                250-272
     2h        2 Door HYD, 1 up & 1 down                306-327
     rs        Rolling Shutter Cabinet                 201-218   (no Range Config row)
     pb        Purifier Box                            352-370

   The variant comes from the rule cell when written as `cab:4h`, otherwise it
   is inferred from the catalogue item name. The suffix is the reliable form —
   the name sniff only exists so the current sheet works untouched.

   CONSTRUCTION, read straight out of the formulas:
     SIDES   d - t x h      -> full height, so the sides are OUTER
     TOP/BOT w - 2t x d - t -> inset between the sides
     BACK    w - 20 x h - 20-> 10 mm into a groove all round
     SHELF   w - 2t x d - t - 40
   Every carcass depth is d - t because the door thickness takes that t. The
   rolling shutter is the exception: it runs in side channels, so its sides are
   the full depth and nothing is set back.

   VERSION 1.1.0 */
(function () {
  'use strict';

  var VERSION = '1.1.0';

  var INPUTS = {
    W:      { from: ['w', 'width'], def: 800, min: 200 },
    H:      { from: ['h', 'ht', 'height'], def: 600, min: 150 },
    D:      { from: ['d', 'depth', 'dep'], def: 300, min: 100 },
    qty:    { from: ['qty', 'quantity'], def: 1, round: true },
    ply:    { from: ['ply_thickness_lrtb_shelves', 'ply_thickness', 'ply', 'thickness'],
              def: 18, min: 6 },
    backT:  { from: ['back_default_thickness', 'back_thickness', 'back'], def: 8, min: 3 },
    shelf:  { from: ['shelf', 'shelves', 'shelf_qty'], def: 1, round: true },
    bigshelf:   { from: ['big_shelf', 'big_shelves', 'big_shelf_qty'], def: 1, round: true },
    smallshelf: { from: ['small_shelf', 'small_shelves', 'small_shelf_qty'], def: 1, round: true },
    glass:  { from: ['glass_gala', 'glass'], def: '', type: 'str' },
    handle: { from: ['profile_handle', 'profile_hanlde', 'handle'], def: '', type: 'str' },
    eband:  { from: ['edge_band', 'eband', 'edgeband'], def: 'MATERIAL', type: 'str' },
    lside:  { from: ['left_side', 'lside'], def: 'Off White', type: 'str' },
    rside:  { from: ['right_side', 'rside'], def: 'Off White', type: 'str' }
  };

  function variantOf(p) {
    var a = String(p._variant || '').trim().toLowerCase();
    if (a) return a;
    var n = String(p._item || '').toLowerCase();
    if (/purifier/.test(n)) return 'pb';
    if (/rolling|shutter/.test(n)) return 'rs';
    if (/hyd/.test(n)) return (/half|\b4\b|four/.test(n)) ? '4h' : '2h';
    if (/\b4\b|four/.test(n))  return '4';
    if (/\b3\b|three/.test(n)) return '3';
    if (/\b2\b|two/.test(n))   return '2';
    return '1';
  }

  window.ASM3D.register('cab', {
    label: 'Cabinet (1-4 door, hydraulic, shutter)',
    category: 'cabinets',
    version: VERSION,
    inputs: INPUTS,
    controls: [
      { id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Door open' },
      { id: 'op', type: 'range', min: 5, max: 100, val: 40, label: 'Door opacity' }
    ],
    newState: function () { return {}; },

    solve: function (p) {
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D, v = variantOf(p);
      var hasGlass = !!String(p.glass || '').trim();
      var rs = (v === 'rs'), pb = (v === 'pb');

      var CD = rs ? D : Math.max(60, D - t);   // carcass depth
      var zC = rs ? 0 : -t / 2;
      var zFront = rs ? (D / 2) : (D / 2 - t);
      var IW = W - 2 * t, IH = H - 2 * t;
      var zDoor = D / 2 - t / 2;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      var G = 2;                               // the "-2" reveal in the door formulas

      /* ── carcass ── */
      add({ role: 'side', w: t, h: H, d: CD, x: -(W - t) / 2, y: H / 2, z: zC,
            tag: 'LEFT SIDE ' + Math.round(CD) + '×' + Math.round(H) + ' · ' + p.lside });
      add({ role: 'side', w: t, h: H, d: CD, x: (W - t) / 2, y: H / 2, z: zC,
            tag: 'RIGHT SIDE ' + Math.round(CD) + '×' + Math.round(H) + ' · ' + p.rside });
      add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: H - t / 2, z: zC,
            tag: 'TOP ' + Math.round(IW) + '×' + Math.round(CD) });
      if (!pb) {                               // the Purifier Box has no bottom
        add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: t / 2, z: zC,
              tag: 'BOTTOM ' + Math.round(IW) + '×' + Math.round(CD) });
      }
      if (!pb) {                               // ...and no back
        add({ role: 'back', w: W - 20, h: H - 20, d: p.backT, x: 0, y: H / 2,
              z: -D / 2 + p.backT / 2,
              tag: 'BACK ' + Math.round(W - 20) + '×' + Math.round(H - 20) });
      } else {
        // FIX-BACK PATTE: two 80mm battens down the rear corners, to screw to the wall
        [-1, 1].forEach(function (sg) {
          add({ role: 'vertical', w: 80, h: H - t, d: t,
                x: sg * ((W - 2 * t) / 2 - 40), y: (H - t) / 2 + t / 2, z: -D / 2 + t / 2,
                tag: 'FIX-BACK PATTE 80×' + Math.round(H - t) });
        });
      }

      /* ── shelves and verticals ── */
      var SD = Math.max(60, CD - 40);          // w-2t x d-t-40
      var zShelf = zFront - SD / 2;
      function shelf(w, dep, x, y, z, tag) {
        add({ role: 'shelf', w: w, h: t, d: dep, x: x, y: y, z: z,
              tag: tag + ' ' + Math.round(w) + '×' + Math.round(dep) });
      }
      // n shelves spread evenly over the clear height, which is how a shelf
      // count behaves for the person typing it. 0 leaves the cell open.
      function spread(n, w, dep, x, z, tag) {
        for (var i = 1; i <= n; i++) shelf(w, dep, x, t + IH * i / (n + 1), z, tag);
      }

      if (v === '3') {
        // The sheet's two shelf widths (w/3 - t and w/3*2 - 2t) plus the
        // vertical's own t add back to w - 2t, which fixes where it sits.
        var small = W / 3 - t, big = 2 * W / 3 - 2 * t;
        var xL = -(W / 2) + t, vx = xL + small + t / 2;
        add({ role: 'vertical', w: t, h: IH, d: D - 50, x: vx, y: H / 2,
              z: zFront - (D - 50) / 2,
              tag: 'VERTICAL ' + Math.round(D - 50) + '×' + Math.round(IH) });
        spread(p.smallshelf, small, SD, xL + small / 2, zShelf, 'SMALL SHELF');
        spread(p.bigshelf, big, SD, vx + t / 2 + big / 2, zShelf, 'BIG SHELF');
        if (!p.smallshelf && !p.bigshelf)
          notes.push(['warn', 'Both shelf counts are 0 — the cabinet is drawn open.']);
      } else if (v === '4' || v === '4h') {
        var hw = (W - 3 * t) / 2, hd = Math.max(60, D - 65);
        add({ role: 'vertical', w: t, h: IH, d: D - 50, x: 0, y: H / 2,
              z: zFront - (D - 50) / 2,
              tag: 'VERTICAL SHELF ' + Math.round(D - 50) + '×' + Math.round(IH) });
        // Shelf is a TOTAL, not per bay: each extra one goes to the bay with
        // fewer, so 1 -> left only, 2 -> one each, 3 -> two left and one right.
        var nL = Math.ceil(p.shelf / 2), nR = p.shelf - nL;
        spread(nL, hw, hd, -(t / 2 + hw / 2), zFront - hd / 2, 'HORIZONTAL SHELF L');
        spread(nR, hw, hd, (t / 2 + hw / 2), zFront - hd / 2, 'HORIZONTAL SHELF R');
        notes.push(['ok', 'Shelf = ' + p.shelf + ' in total: ' + nL + ' left, ' + nR + ' right.']);
      } else if (v === '2h') {
        var d2 = Math.max(60, D - 50);
        spread(p.shelf, IW, d2, 0, zFront - d2 / 2, 'SHELF');
      } else if (rs) {
        var sd = Math.max(60, D - 50);
        spread(p.shelf, IW, sd, 0, zFront - sd / 2, 'SHELF');
      } else if (pb) {
        notes.push(['ok', 'Purifier Box: no bottom, no back, no groove — top, two sides, ' +
          'one door and two fixing battens.']);
      } else {
        spread(p.shelf, IW, SD, 0, zShelf, 'SHELF');
      }

      /* ── front: doors, flaps or shutter ── */
      var RAIL = 57;                            // Glass Size = door - 115 on both axes
      function door(o) {
        if (!hasGlass || rs) {
          add({ role: 'door', w: o.w, h: o.h, d: t, x: o.x, y: o.y, z: o.z,
                tag: o.tag, pivot: o.pivot });
          return;
        }
        var gw = Math.max(20, o.w - 2 * RAIL), gh = Math.max(20, o.h - 2 * RAIL);
        function f(w, h, dx, dy) {
          add({ role: 'door', w: w, h: h, d: t, x: o.x + dx, y: o.y + dy, z: o.z,
                tag: o.tag + ' FRAME', pivot: o.pivot });
        }
        f(o.w, RAIL, 0, (o.h - RAIL) / 2); f(o.w, RAIL, 0, -(o.h - RAIL) / 2);
        f(RAIL, gh, -(o.w - RAIL) / 2, 0);  f(RAIL, gh, (o.w - RAIL) / 2, 0);
        add({ role: 'glass', w: gw, h: gh, d: 4, x: o.x, y: o.y, z: o.z,
              tag: 'GLASS ' + Math.round(gw) + '×' + Math.round(gh), pivot: o.pivot });
      }
      // A side-hinged leaf hinges on its OUTER edge, and opening has to carry
      // the free edge toward +z, out of the cabinet and into the room.
      function leaf(cx, w, h, cy, tag) {
        var sgn = (cx < 0) ? -1 : 1;
        var hinge = cx + sgn * w / 2;
        door({ w: w, h: h, x: -sgn * w / 2, y: 0, z: 0, tag: tag,
               pivot: { x: hinge, y: cy, z: zDoor, ry: sgn * ang } });
        add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 26,
              x: cx - sgn * (w / 2 - 60), y: cy, z: zDoor + 14 });
      }

      var doorNote = '';
      if (rs) {
        // The shutter rolls UP into a canopy: what still covers the opening
        // hangs from the top, so its bottom edge rises as it opens.
        var openF = (p.dopen || 0) / 100, shH = IH * (1 - openF), slat = 60;
        add({ role: 'carcass', w: W, h: 70, d: 90, x: 0, y: H - 35, z: D / 2 - 45,
              tag: 'SHUTTER CANOPY' });
        if (shH > 4) {
          var nSl = Math.max(1, Math.round(shH / slat)), yTop = H - t;
          for (var i2 = 0; i2 < nSl; i2++) {
            var sh2 = shH / nSl;
            add({ role: 'door', w: W - 2 * t + 6, h: sh2 - 2, d: 10,
                  x: 0, y: yTop - shH + sh2 * (i2 + 0.5), z: D / 2 - 8,
                  tag: 'ROLLING SHUTTER SLAT' });
          }
        }
        doorNote = 'Rolling shutter: sides run the full depth (channels), top and bottom are ' +
                   'w−2t × d. It rolls bottom-to-top into the canopy.';
      } else if (v === '2h') {
        var dw2 = W - G, dh2 = H / 2 - G;
        [['UPPER', H], ['LOWER', H / 2]].forEach(function (s) {
          // both flaps lift UP, each hinged on its own top edge
          var cy = (s[0] === 'UPPER') ? (H / 4 * 3) : (H / 4);
          door({ w: dw2, h: dh2, x: 0, y: cy - s[1], z: 0,
                 tag: s[0] + ' HYD DOOR ' + Math.round(dw2) + '×' + Math.round(dh2),
                 pivot: { x: 0, y: s[1], z: zDoor, rx: -ang } });
        });
        doorNote = 'Two hydraulic flaps, both lifting up, each hinged on its own top edge.';
      } else if (v === '4h') {
        var dw4 = W / 2 - G, dh4 = H / 2 - G;
        [-1, 1].forEach(function (cx) {
          [1, 0].forEach(function (row) {
            var hingeY = row ? H : H / 2, cy = row ? (H / 4 * 3) : (H / 4);
            door({ w: dw4, h: dh4, x: 0, y: cy - hingeY, z: 0,
                   tag: (row ? 'UPPER' : 'LOWER') + ' HYD DOOR ' +
                        Math.round(dw4) + '×' + Math.round(dh4),
                   pivot: { x: cx * W / 4, y: hingeY, z: zDoor, rx: -ang } });
          });
        });
        doorNote = 'Four half flaps, all lifting up, over a centre vertical.';
      } else if (pb) {
        leaf(0, W, H, H / 2, 'DOOR ' + Math.round(W) + '×' + Math.round(H));
        doorNote = 'One full-overlay door, hinged on the left.';
      } else {
        var n = parseInt(v, 10) || 1;
        var dw = (n === 1) ? W : Math.round(W / n - G);
        for (var i = 0; i < n; i++) {
          var cx2 = -W / 2 + (i + 0.5) * (W / n);
          leaf(cx2, dw, H, H / 2,
               'DOOR ' + (i + 1) + ' ' + Math.round(dw) + '×' + Math.round(H));
        }
        doorNote = n + ' side-hinged door' + (n > 1 ? 's' : '') +
                   ', each hinged on its outer edge and opening outwards.';
      }

      notes.push(['ok', doorNote]);
      if (hasGlass && !rs)
        notes.push(['ok', 'Glass gala set — doors drawn as frame + 4mm glass ' +
          '(57mm frame, from Glass Size = door − 115).']);
      if (hasGlass && rs)
        notes.push(['warn', 'A rolling shutter has no glass gala — that input is ignored here.']);
      if (CD < 120)
        notes.push(['warn', 'Carcass depth is only ' + Math.round(CD) +
          'mm once the ' + t + 'mm door is allowed for.']);

      var zF = D / 2;
      return {
        parts: parts, notes: notes,
        callouts: [
          { from: [-(W / 2) + 8, H * 0.7, 0], to: [-(W / 2) - W * 0.55, H * 0.92, zF + 160],
            text: 'LEFT SIDE · ' + p.lside },
          { from: [(W / 2) - 8, H * 0.7, 0], to: [(W / 2) + W * 0.55, H * 0.92, zF + 160],
            text: 'RIGHT SIDE · ' + p.rside },
          { from: [W * 0.25, H * 0.42, zF], to: [W * 0.62, H * 0.14, zF + 400],
            text: 'DOORS · ' + (hasGlass ? 'GLASS + ' : '') + (p.handle || p.eband) },
          { from: [-W * 0.25, 40, zF], to: [-W * 0.5, -H * 0.45, zF + 260],
            text: 'EDGE BAND · ' + p.eband }
        ],
        geo: { IW: IW, IH: IH, CD: CD, SD: SD, variant: v },
        hud: (rs
          ? '<b>Rolling shutter</b> — SIDES are d × h (full depth, no door setback), ' +
            'TOP BOTTOM is w−2t × d.'
          : '<b>Outer sides, inset top and bottom</b> — SIDES are d−t × h (full height) ' +
            'while TOP and BOTTOM are w−2t wide.') +
          '<br>variant <b>' + v + '</b> · interior <b>' + Math.round(IW) + '×' +
          Math.round(IH) + '</b> · carcass depth <b>' + Math.round(CD) + '</b>'
      };
    }
  });
})();
