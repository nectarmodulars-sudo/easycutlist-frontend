/* rule-engines/tall-units.js — Master Sheet tab "TALLUNIT". Rule code: tu.

     variant  Master Sheet item                              sheet rows
     ------------------------------------------------------------------
     3l3r     Tall Unit - 3 Doors Left 3 Doors Right           2- 30
     3in1     Tall Unit - 3 Doors In 1 Line                   60- 87
     2l2r     Tall Unit - 2 Doors Left 2 Doors Right         118-144
     1l1r     Tall Unit - 1 Door Left 1 Door Right           174-198
     1in1     Tall Unit - 1 Door In 1 Line                   223-246
     2in1     Tall unit - 2 Doors in 1 Line                  277-302

   The variant comes from the rule cell when written as `tu:3l3r`, otherwise
   it is read from the item name (the sheet spells "Doos" in three of them).

   CONSTRUCTION, straight from the formulas (same for all six):
     SIDES     d-20 x h          full height to the floor -> OUTER sides
     TOP/BOT   d-20 x w-2t       inset between the sides
     BACK      h-20-skirting x w-20, 6mm, grooved; starts above the skirting
     SKIRTING  skirting x w-2t   between the sides, under the bottom
     SHELF     d-50 (or d-20-30) x w-2t, full width, Shelf Qty of them
     DOORS     2 columns: w/2-2 wide · 1 column: w wide
               rows from the top: Upper ht, Middle ht, and the last row takes
               the rest: h - upper - middle - skirting + 10
   Carcass depth is d-20: the 18mm door plus a 2mm gap make up the 20.

   PLACEMENT the sheet does not give, so this engine decides:
     · the bottom sits on the skirting; the doors start 10mm below the bottom
       panel's top face (that is the +10 in the lower door formula) and run
       to the top of the sides
     · shelves line up with the door joints first, the rest are spread evenly
     · no centre partition: the 2-column units have none in the cut list, so
       none is drawn and the shelves run full width */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  var INPUTS = {
    W:      { from: ['w', 'width'], def: 1000, min: 200 },
    H:      { from: ['h', 'ht', 'height'], def: 2000, min: 600 },
    D:      { from: ['d', 'depth'], def: 400, min: 150 },
    qty:    { from: ['qty', 'quantity'], def: 1, round: true },
    ply:    { from: ['ply_thickness', 'ply', 'thickness'], def: 18, min: 6 },
    skirt:  { from: ['skirting', 'skirting_ht', 'skirting_height'], def: 70, min: 0 },
    up:     { from: ['upper_door_ht', 'upper_door', 'upper_door_height'], def: 600, min: 50 },
    mid:    { from: ['middle_door_ht', 'middle_door', 'middle_door_height'], def: 700, min: 50 },
    shelf:  { from: ['shelf_qty', 'shelf', 'shelves', 'fix_shelf'], def: 5, round: true, min: 0 },
    handle: { from: ['profile_handles', 'profile_handle', 'handle'], def: '', type: 'str' },
    eband:  { from: ['edge_band', 'eband'], def: 'MATERIAL', type: 'str' },
    lside:  { from: ['left_side', 'sides'], def: 'MATERIAL', type: 'str' },
    rside:  { from: ['right_side', 'sides'], def: 'MATERIAL', type: 'str' }
  };

  // cols = door columns; rows = door rows (1 = full height, 2 = upper + lower, 3 = + middle)
  var VARIANTS = {
    '3l3r': { cols: 2, rows: 3, shelfD: 'd-50', label: '3 doors left, 3 doors right' },
    '3in1': { cols: 1, rows: 3, shelfD: 'd-50', label: '3 doors in 1 line' },
    '2l2r': { cols: 2, rows: 2, shelfD: 'd-50', label: '2 doors left, 2 doors right' },
    '1l1r': { cols: 2, rows: 1, shelfD: 'd-50', label: '1 door left, 1 door right' },
    '1in1': { cols: 1, rows: 1, shelfD: 'd-50', label: '1 door in 1 line' },
    '2in1': { cols: 1, rows: 2, shelfD: 'd-50', label: '2 doors in 1 line' }
  };

  function variantOf(p) {
    var a = String(p._variant || '').trim().toLowerCase();
    if (VARIANTS[a]) return a;
    var n = String(p._item || '').toLowerCase().replace(/doos/g, 'doors');
    var num = function (re) { var m = n.match(re); return m ? parseInt(m[1], 10) : 0; };
    var left = num(/(\d)\s*doors?\s*left/), inLine = num(/(\d)\s*doors?\s*in\s*1\s*line/);
    if (left === 3) return '3l3r';
    if (left === 2) return '2l2r';
    if (left === 1) return '1l1r';
    if (inLine === 3) return '3in1';
    if (inLine === 2) return '2in1';
    if (inLine === 1) return '1in1';
    return '1in1';
  }

  window.ASM3D.register('tu', {
    label: 'Tall Unit',
    category: 'tall units',
    version: VERSION,
    inputs: INPUTS,
    controls: [
      { id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Door open' },
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }
    ],
    newState: function () { return {}; },

    solve: function (p) {
      var notes = [], parts = [], R = Math.round;
      function add(o) { parts.push(o); }
      var v = variantOf(p), V = VARIANTS[v];
      var W = p.W, H = p.H, D = p.D, t = p.ply, sk = p.skirt, backT = 6;
      var CD = D - 20, zC = -D / 2 + CD / 2;              // carcass sits at the back
      var zFront = -D / 2 + CD;                           // carcass front face
      var IW = W - 2 * t;
      var yBot = sk, yTop = H;                            // bottom panel sits on the skirting
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);

      /* ── carcass ── */
      add({ role: 'side', w: t, h: H, d: CD, x: -(W - t) / 2, y: H / 2, z: zC,
            tag: 'LEFT SIDE ' + R(CD) + '×' + R(H) + ' · ' + p.lside });
      add({ role: 'side', w: t, h: H, d: CD, x: (W - t) / 2, y: H / 2, z: zC,
            tag: 'RIGHT SIDE ' + R(CD) + '×' + R(H) + ' · ' + p.rside });
      add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: H - t / 2, z: zC,
            tag: 'TOP ' + R(CD) + '×' + R(IW) });
      add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: yBot + t / 2, z: zC,
            tag: 'BOTTOM ' + R(CD) + '×' + R(IW) });
      add({ role: 'back', w: W - 20, h: H - 20 - sk, d: backT, x: 0, y: sk + (H - sk) / 2,
            z: -D / 2 + backT / 2, tag: 'BACK ' + R(H - 20 - sk) + '×' + R(W - 20) + ' · 6mm' });
      if (sk > 0)
        add({ role: 'skirting', w: IW, h: sk, d: t, x: 0, y: sk / 2, z: zFront - t / 2 - 30,
              tag: 'SKIRTING ' + R(sk) + '×' + R(IW) + ' · ' + p.eband });

      /* ── door rows, top down; the last row takes what is left ── */
      var total = H - sk + 10, hs;
      if (V.rows === 3) hs = [p.up, p.mid, total - p.up - p.mid];
      else if (V.rows === 2) hs = [p.up, total - p.up];
      else hs = [total];
      var last = hs[hs.length - 1];
      if (last < 150) {
        notes.push(['err', 'The lower door comes out ' + R(last) + 'mm: Upper' +
          (V.rows === 3 ? ' + Middle' : '') + ' door height is more than the unit can take (' +
          R(total) + 'mm of door in all).']);
        hs[hs.length - 1] = Math.max(40, last);
      }

      /* ── shelves: at the door joints first, then evenly in the tallest gaps ── */
      var sd = Math.max(80, D - 50), zS = zFront - sd / 2, nSh = Math.max(0, p.shelf);
      var joints = [], acc = H;
      for (var r = 0; r < hs.length - 1; r++) { acc -= hs[r]; joints.push(acc); }
      var ys = joints.filter(function (y) { return y > yBot + t + 120 && y < H - t - 120; }).slice(0, nSh);
      while (ys.length < nSh) {                           // split the tallest gap
        var bounds = [yBot + t].concat(ys.slice().sort(function (a, b) { return a - b; })).concat([H - t]);
        var bi = 0, bg = -1;
        for (var k = 0; k < bounds.length - 1; k++) if (bounds[k + 1] - bounds[k] > bg) { bg = bounds[k + 1] - bounds[k]; bi = k; }
        ys.push((bounds[bi] + bounds[bi + 1]) / 2);
      }
      ys.sort(function (a, b) { return a - b; }).forEach(function (y, i) {
        add({ role: 'shelf', w: IW, h: t, d: sd, x: 0, y: y, z: zS,
              tag: 'FIX SHELF ' + (i + 1) + ' · ' + R(sd) + '×' + R(IW) });
      });
      var gapMin = Infinity, bnd = [yBot + t].concat(ys).concat([H - t]);
      for (var q = 0; q < bnd.length - 1; q++) gapMin = Math.min(gapMin, bnd[q + 1] - bnd[q] - t);
      if (nSh && gapMin < 180) notes.push(['warn', nSh + ' shelves leave only ' + R(gapMin) + 'mm between two of them.']);

      /* ── doors ── */
      var dw = V.cols === 2 ? W / 2 - 2 : W, zDoor = zFront + 2 + t / 2, hasH = !!String(p.handle || '').trim();
      var yTopDoor = H;
      hs.forEach(function (dh, row) {
        var cy = yTopDoor - dh / 2;
        for (var c = 0; c < V.cols; c++) {
          var cx = V.cols === 2 ? (c === 0 ? -W / 4 : W / 4) : 0;
          var sgn = V.cols === 2 ? (c === 0 ? -1 : 1) : -1;      // single column: hinged on the left
          var hingeX = cx + sgn * dw / 2;
          var piv = { x: hingeX, y: cy, z: zDoor, ry: sgn * ang };
          var name = (hs.length === 1 ? 'DOOR' : ['UPPER', V.rows === 3 ? 'MIDDLE' : 'LOWER', 'LOWER'][row] + ' DOOR');
          add({ role: 'door', w: dw - 2, h: dh - 2, d: t, x: -sgn * dw / 2, y: 0, z: 0, pivot: piv,
                tag: name + (V.cols === 2 ? (c ? ' R ' : ' L ') : ' ') + R(dw) + '×' + R(dh) });
          // profile handle on the opening edge (top edge of the lower doors, bottom edge of the upper)
          var hy = row === 0 && hs.length > 1 ? -dh / 2 + 25 : (row === hs.length - 1 && hs.length > 1 ? dh / 2 - 25 : 0);
          if (hasH)
            add({ role: 'knob', w: 14, h: Math.min(260, dh * 0.4), d: 22, pivot: piv,
                  x: -sgn * (dw - 30), y: hy, z: t / 2 + 11 });
          else
            add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 26, pivot: piv,
                  x: -sgn * (dw - 55), y: hy, z: t / 2 + 13 });
        }
        yTopDoor -= dh;
      });

      if (v === '1in1' || v === '2in1')
        notes.push(['warn', 'Master Sheet: the DOORS remark formula reads $B$67, which is the ' +
          'Profile Handles cell of "3 Doors In 1 Line", not this item\'s own. Point it at this ' +
          'item\'s Profile Handles row.']);
      notes.push(['ok', V.label + ' · ' + hs.length + ' row' + (hs.length > 1 ? 's' : '') +
        ' of doors: ' + hs.map(R).join(' + ') + ' = ' + R(total) + ' (h − skirting + 10).']);
      if (V.cols === 2)
        notes.push(['ok', 'No centre partition in the cut list: the doors meet in the middle and ' +
          'the shelves run the full ' + R(IW) + 'mm.']);

      var dims = [], yy = H;
      hs.forEach(function (dh, i) {
        dims.push({ axis: 'y', a: yy - dh, b: yy, text: R(dh), at: [W / 2 + 300, 0, D / 2 + 200] });
        yy -= dh;
      });
      var zF = D / 2;
      return {
        parts: parts, notes: notes, dims: dims,
        callouts: [
          { from: [-(W / 2) + 8, H * 0.7, 0], to: [-(W / 2) - W * 0.6, H * 0.9, zF + 160], text: 'LEFT SIDE · ' + p.lside },
          { from: [(W / 2) - 8, H * 0.7, 0], to: [(W / 2) + W * 0.6, H * 0.9, zF + 160], text: 'RIGHT SIDE · ' + p.rside },
          { from: [0, H * 0.45, zF], to: [W * 0.7, H * 0.2, zF + 400], text: 'DOORS' + (hasH ? ' + ' + p.handle : '') },
          { from: [-W * 0.25, sk / 2, zF - 40], to: [-W * 0.6, -H * 0.12, zF + 260], text: 'EDGE BAND · ' + p.eband }
        ],
        geo: { IW: IW, CD: CD, variant: v },
        hud: '<b>' + V.label + '</b> · carcass <b>' + R(W) + '×' + R(H) + '×' + R(CD) + '</b><br>' +
             'doors ' + V.cols + ' × ' + hs.length + ' · shelves <b>' + nSh + '</b> · skirting <b>' + R(sk) + '</b>'
      };
    }
  });
})();
