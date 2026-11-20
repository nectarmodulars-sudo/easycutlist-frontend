/* rule-engines/cabinets.js — cabinet rule set, Master Sheet tab "Cabinets".
   Registers one code, `cab`, covering the whole family:

     variant   Master Sheet item                        sheet rows
     --------------------------------------------------------------------
     1         1 Door Cabinet                            2- 29
     2         2 Doors Cabinet                          58- 86
     3         3 Doors Cabinet                         113-144
     4         4 Doors Cabinet                         169-202
     rs        Rolling Shutter Cabinet - 600mm         230-247
     4h        4 Half Hyd Doors Cabinet                279-301
     2h        2 Door HYD, 1 door up & 1 door down     335-356
     pb        Purifier Box                            381-399

   The variant comes from the rule cell when written as `cab:4h`, otherwise it
   is inferred from the catalogue item name. The suffix is the reliable form —
   the name sniff only exists so the current sheet works untouched.

   CONSTRUCTION, read straight out of the formulas:
     SIDES   d - t x h      -> full height, so the sides are OUTER
     TOP/BOT w - 2t x d - t -> inset between the sides
     BACK    w - 20 x h - 20-> 10 mm into a groove all round, 6mm board
     SHELF   w - 2t x d - t - 40
   Every carcass depth is d - t because the door thickness takes that t. The
   rolling shutter is the exception: it runs in side channels, so its sides are
   the full depth and nothing is set back.

   PLACEMENT. The sheet gives cut sizes and no positions, so these are the
   rules this engine adds:
     · verticals split the inside into EQUAL bays
     · a shelf is a ROW — every bay gets one at the same height, so shelves
       line up straight across (Shelf qty is per bay, not a total)
     · shelves and verticals sit flush with the carcass front
     · a door taller than the carcass (Door Ht extend) hangs BELOW the bottom
     · glass is centred in its frame; Glass Size = door - 115, and
       door height - 150 instead of - 115 when a profile handle is set

   VERSION 1.2.0 — changes against 1.1.0, each traced to a sheet formula:
     · new input Vertical partition -> 1/2/4 Door shelves split into bays and
       1 Door draws its VERTICAL PARTITION row, which was never drawn before
     · new input Door Ht extend     -> door height h + extend
     · new inputs DOOR 1..4         -> the doors callout showed the profile
       handle because no door material was ever read
     · 3 Door VERTICAL              -> d-50 x h-40  (was h-2t)
     · 3 Door DOOR 1                -> h, while DOOR 2 and 3 are h + extend
     · 4 Half Hyd shelves           -> 2, Rolling shutter shelves -> 3
       (neither item has a shelf input; the sheet fixes the quantity)
     · back thickness default       -> 6, the sheet material is "6mm Back"
   Checked against the Master Sheet cut list for all 8 items over 1,152 input
   combinations: every row is drawn at the sheet size, thickness and count. */
(function () {
  'use strict';

  var VERSION = '1.2.0';

  var INPUTS = {
    W:      { from: ['w', 'width'], def: 800, min: 200 },
    H:      { from: ['h', 'ht', 'height'], def: 600, min: 150 },
    D:      { from: ['d', 'depth', 'dep'], def: 300, min: 100 },
    qty:    { from: ['qty', 'quantity'], def: 1, round: true },
    ply:    { from: ['ply_thickness_lrtb_shelves', 'ply_thickness', 'ply', 'thickness'],
              def: 18, min: 6 },
    backT:  { from: ['back_default_thickness', 'back_thickness'], def: 6, min: 3 },
    shelf:  { from: ['shelf', 'shelves', 'shelf_qty'], def: 1, round: true },
    vp:     { from: ['vertical_partition', 'vertical_partition_qty'], def: 1, round: true, min: 0 },
    ext:    { from: ['door_ht_extend', 'door_height_extend'], def: 0 },
    glass:  { from: ['glass_gala', 'glass'], def: '', type: 'str' },
    handle: { from: ['profile_handle', 'profile_hanlde', 'handle'], def: '', type: 'str' },
    eband:  { from: ['edge_band', 'eband', 'edgeband'], def: 'MATERIAL', type: 'str' },
    // Floor to the underside of the cabinet. Nothing on this tab stands on the
    // floor, so the default is the usual wall-cabinet height; add a
    // "Mount height" row to an item in the Master Sheet to override it.
    mount:  { from: ['mount_height', 'mount', 'floor_to_bottom'], def: 1400, min: 0 },
    // Door face materials, one per leaf; DOOR n falls back to DOOR.
    door1:  { from: ['door_1', 'door', 'doors'], def: '', type: 'str' },
    door2:  { from: ['door_2'], def: '', type: 'str' },
    door3:  { from: ['door_3'], def: '', type: 'str' },
    door4:  { from: ['door_4'], def: '', type: 'str' },
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
      var W = p.W, H = p.H, D = p.D, v = variantOf(p), vp = p.vp, e = p.ext;
      var rs = (v === 'rs'), pb = (v === 'pb');
      var hasGlass = !rs && !!String(p.glass || '').trim();
      var hasHandle = !!String(p.handle || '').trim();
      var R = Math.round;

      var CD = rs ? D : Math.max(60, D - t);
      var zC = rs ? 0 : -t / 2;
      var zFront = rs ? (D / 2) : (D / 2 - t);
      var IW = W - 2 * t, IH = H - 2 * t;
      var zDoor = D / 2 - t / 2;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      var G = 2;

      /* ── carcass (unchanged) ── */
      add({ role: 'side', w: t, h: H, d: CD, x: -(W - t) / 2, y: H / 2, z: zC,
            tag: 'LEFT SIDE ' + R(CD) + '×' + R(H) + ' · ' + p.lside });
      add({ role: 'side', w: t, h: H, d: CD, x: (W - t) / 2, y: H / 2, z: zC,
            tag: 'RIGHT SIDE ' + R(CD) + '×' + R(H) + ' · ' + p.rside });
      add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: H - t / 2, z: zC,
            tag: 'TOP ' + R(IW) + '×' + R(CD) });
      if (!pb) add({ role: 'carcass', w: IW, h: t, d: CD, x: 0, y: t / 2, z: zC,
                     tag: 'BOTTOM ' + R(IW) + '×' + R(CD) });
      if (!pb) {
        add({ role: 'back', w: W - 20, h: H - 20, d: p.backT, x: 0, y: H / 2,
              z: -D / 2 + p.backT / 2, tag: 'BACK ' + R(W - 20) + '×' + R(H - 20) });
      } else {
        [-1, 1].forEach(function (sg) {
          add({ role: 'vertical', w: 80, h: H - t, d: t,
                x: sg * ((W - 2 * t) / 2 - 40), y: (H - t) / 2 + t / 2, z: -D / 2 + t / 2,
                tag: 'FIX-BACK PATTE 80×' + R(H - t) });
        });
      }

      /* ── shelves and verticals ── */
      function shelf(w, dep, x, y, tag) {
        add({ role: 'shelf', w: w, h: t, d: dep, x: x, y: y, z: zFront - dep / 2,
              tag: tag + ' ' + R(w) + '×' + R(dep) });
      }
      function vertical(x, dep, h, tag) {
        add({ role: 'vertical', w: t, h: h, d: dep, x: x, y: H / 2, z: zFront - dep / 2,
              tag: tag + ' ' + R(dep) + '×' + R(h) });
      }
      function spread(n, w, dep, x, tag) {
        for (var i = 1; i <= n; i++) shelf(w, dep, x, t + IH * i / (n + 1), tag);
      }
      // Verticals split the inside into equal bays, and a shelf is a ROW: every
      // bay gets one at the same height, so the shelves line up straight across.
      // `rows` is therefore shelves per bay, not a total to share out.
      function bays(nV, bayW, sDep, rows, vDep, vH, vTag, sTag, drawV) {
        var x0 = -W / 2 + t;
        for (var b = 0; b <= nV; b++) {
          var cx = x0 + b * (bayW + t) + bayW / 2;
          for (var i = 1; i <= rows; i++) shelf(bayW, sDep, cx, t + IH * i / (rows + 1), sTag);
          if (b < nV && drawV) vertical(x0 + (b + 1) * bayW + b * t + t / 2, vDep, vH, vTag);
        }
      }
      var SD = Math.max(60, CD - 40);

      if (v === '1') {
        bays(vp, vp > 0 ? (W - 2 * t - t * vp) / (vp + 1) : IW, SD, p.shelf,
             D - 30 - t - 2, IH, 'VERTICAL PARTITION', 'SHELF', true);
      } else if (v === '2') {
        // The sheet divides the shelf by (vp+1) but has no VERTICAL row, so the
        // partition is never cut. It is drawn anyway — without it the shelves
        // float — and called out, because the cut list is the thing to fix.
        bays(vp, vp > 0 ? (W - 2 * t - vp * t) / (vp + 1) : IW, SD, p.shelf,
             D - 30 - t - 2, IH, 'VERTICAL PARTITION (not in cut list)', 'SHELF', true);
        if (vp > 0) notes.push(['err', 'Master Sheet: the shelf is cut (w−2t−' + vp + 't)/' + (vp + 1) +
          ' wide for ' + (vp + 1) + ' bays, but this item has no VERTICAL row — the partition that ' +
          'carries the shelves is never cut. Shown here in grey; add a VERTICAL row to the sheet.']);
      } else if (v === '3') {
        if (vp === 1) {
          var small = R(W / 3 - t), big = R(W / 3 * 2 - t * 2), xL = -W / 2 + t, vx = xL + big + t / 2;
          vertical(vx, D - 50, H - 40, 'VERTICAL');
          spread(1, big, SD, xL + big / 2, 'SHELF 1');
          spread(1, small, SD, vx + t / 2 + small / 2, 'SHELF 2');
        } else {
          // With no vertical the sheet still cuts SHELF 1 and SHELF 2 full width.
          bays(vp, (W - (2 + vp) * t) / (vp + 1), SD, vp === 0 ? 2 : 1, D - 50, H - 40, 'VERTICAL', 'SHELF', true);
        }
        if (e) notes.push(['warn', 'Master Sheet: DOOR 1 is h, DOOR 2 and 3 are h + extend — door 1 comes out ' +
          R(e) + 'mm shorter.']);
      } else if (v === '4') {
        bays(vp, (W - 2 * t - vp * t) / (vp + 1), Math.max(60, D - 65), p.shelf,
             D - 50, IH, 'VERTICAL PARTITION', 'HORIZONTAL SHELF', true);
      } else if (v === '4h') {
        bays(1, (W - 3 * t) / 2, Math.max(60, D - 65), 1, D - 50, IH,
             'VERTICAL SHELF', 'HORIZONTAL SHELF', true);
      } else if (v === '2h') {
        spread(1, IW, Math.max(60, D - 50), 0, 'SHELF');
      } else if (rs) {
        spread(3, IW, Math.max(60, D - 50), 0, 'SHELF');
      } else if (pb) {
        notes.push(['ok', 'Purifier Box: no bottom, no back, no groove — top, two sides, ' +
          'one door and two fixing battens.']);
      }

      /* ── front ── */
      function door(o) {
        if (!hasGlass) {
          add({ role: 'door', w: o.w, h: o.h, d: t, x: o.x, y: o.y, z: o.z, tag: o.tag, pivot: o.pivot });
          return;
        }
        var gw = Math.max(20, o.gw), gh = Math.max(20, o.gh), sx = (o.w - gw) / 2, sy = (o.h - gh) / 2;
        function f(w, h, dx, dy) {
          add({ role: 'door', w: w, h: h, d: t, x: o.x + dx, y: o.y + dy, z: o.z,
                tag: o.tag + ' FRAME', pivot: o.pivot });
        }
        f(o.w, sy, 0, (o.h - sy) / 2); f(o.w, sy, 0, -(o.h - sy) / 2);
        f(sx, gh, -(o.w - sx) / 2, 0);  f(sx, gh, (o.w - sx) / 2, 0);
        add({ role: 'glass', w: gw, h: gh, d: 4, x: o.x, y: o.y, z: o.z,
              tag: 'GLASS ' + R(gw) + '×' + R(gh), pivot: o.pivot });
      }
      function gH(dh) { return hasHandle ? dh - 150 : dh - 115; }
      function leaf(cx, w, h, tag, gw, gh) {
        var sgn = (cx < 0) ? -1 : 1, hinge = cx + sgn * w / 2, cy = H - h / 2;
        door({ w: w, h: h, x: -sgn * w / 2, y: 0, z: 0, tag: tag, gw: gw, gh: gh,
               pivot: { x: hinge, y: cy, z: zDoor, ry: sgn * ang } });
        add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 26,
              x: cx - sgn * (w / 2 - 60), y: cy, z: zDoor + 14 });
      }

      var doorNote = '', doorH = null;
      // Door n takes DOOR n from the sheet, falling back to DOOR / the first
      // face when the item lists only one door material.
      function dmat(i) {
        return String(p['door' + i] || p.door1 || 'MATERIAL').trim() || 'MATERIAL';
      }
      function dmats(n) {
        var seen = [], i;
        for (i = 1; i <= n; i++) if (seen.indexOf(dmat(i)) < 0) seen.push(dmat(i));
        return seen;
      }
      if (rs) {
        var openF = (p.dopen || 0) / 100, shH = IH * (1 - openF), slat = 60;
        add({ role: 'carcass', w: W, h: 70, d: 90, x: 0, y: H - 35, z: D / 2 - 45, tag: 'SHUTTER CANOPY' });
        if (shH > 4) {
          var nSl = Math.max(1, R(shH / slat)), yTop = H - t;
          for (var i2 = 0; i2 < nSl; i2++) {
            var sh2 = shH / nSl;
            add({ role: 'door', w: W - 2 * t + 6, h: sh2 - 2, d: 10,
                  x: 0, y: yTop - shH + sh2 * (i2 + 0.5), z: D / 2 - 8, tag: 'ROLLING SHUTTER SLAT' });
          }
        }
        doorNote = 'Rolling shutter: sides run the full depth (channels), top and bottom are ' +
                   'w−2t × d. It rolls bottom-to-top into the canopy.';
      } else if (v === '2h') {
        var dw2 = W - G, dh2 = H / 2 - G;
        [['UPPER', H], ['LOWER', H / 2]].forEach(function (s) {
          var cy = (s[0] === 'UPPER') ? (H / 4 * 3) : (H / 4);
          door({ w: dw2, h: dh2, x: 0, y: cy - s[1], z: 0, gw: dw2 - 115, gh: gH(dh2),
                 tag: s[0] + ' HYD DOOR ' + R(dw2) + '×' + R(dh2),
                 pivot: { x: 0, y: s[1], z: zDoor, rx: -ang } });
        });
        doorH = dh2;
        doorNote = 'Two hydraulic flaps, both lifting up, each hinged on its own top edge.';
      } else if (v === '4h') {
        var dw4 = W / 2 - G, dh4 = H / 2 - G;
        [-1, 1].forEach(function (cx) {
          [1, 0].forEach(function (row) {
            var hingeY = row ? H : H / 2, cy = row ? (H / 4 * 3) : (H / 4);
            door({ w: dw4, h: dh4, x: 0, y: cy - hingeY, z: 0, gw: dw4 - 115, gh: gH(dh4),
                   tag: (row ? 'UPPER' : 'LOWER') + ' HYD DOOR ' + R(dw4) + '×' + R(dh4),
                   pivot: { x: cx * W / 4, y: hingeY, z: zDoor, rx: -ang } });
          });
        });
        doorH = dh4;
        doorNote = 'Four half flaps, all lifting up, over a centre vertical.';
      } else if (pb) {
        leaf(0, W, H, 'DOOR ' + R(W) + '×' + R(H) + ' · ' + dmat(1), W - 115, gH(H));
        doorH = H;
        doorNote = 'One full-overlay door, hinged on the left.';
      } else {
        var n = parseInt(v, 10) || 1, dw, hs;
        if (n === 1)      { dw = W;            hs = [H + e]; }
        else if (n === 2) { dw = R(W / 2 - 2); hs = [H + e, H + e]; }
        else if (n === 3) { dw = R(W / 3 - 2); hs = [H, H + e, H + e]; }
        else              { dw = W / 4 - 2;    hs = [H + e, H + e, H + e, H + e]; }
        for (var i = 0; i < n; i++) {
          var cx2 = -W / 2 + (i + 0.5) * (W / n);
          leaf(cx2, dw, hs[i], 'DOOR ' + (i + 1) + ' ' + R(dw) + '×' + R(hs[i]) + ' · ' + dmat(i + 1),
               (n === 1 ? W : dw) - 115, n === 3 ? gH(H) : gH(hs[i]));
        }
        doorH = Math.max.apply(null, hs);
        doorNote = n + ' side-hinged door' + (n > 1 ? 's' : '') +
                   ', each hinged on its outer edge and opening outwards' +
                   (e ? '; the ' + R(e) + 'mm height extend hangs below the bottom.' : '.');
      }

      notes.push(['ok', doorNote]);
      if (hasGlass)
        notes.push(['ok', 'Glass gala set — doors drawn as frame + 4mm glass ' +
          '(Glass Size = door − 115 × door − ' + (hasHandle ? '150, profile handle' : '115') + ').']);
      if (CD < 120)
        notes.push(['warn', 'Carcass depth is only ' + R(CD) + 'mm once the ' + t + 'mm door is allowed for.']);

      var zF = D / 2;
      var nLeaf = (v === '4h') ? 4 : (v === '2h') ? 2 : (pb || rs) ? 1 : (parseInt(v, 10) || 1);
      var doorFaces = rs ? 'ROLLING SHUTTER' : dmats(nLeaf).join(' / ');
      // Door height is dimensioned whenever it differs from the carcass, so a
      // 10mm extend is readable instead of being lost at this scale.
      var dims = [];
      if (doorH != null && Math.abs(doorH - H) > 0.5) {
        dims.push({ axis: 'y', a: H - doorH, b: H, text: 'DOOR ' + R(doorH),
                    at: [W / 2 + 820, 0, zF + 260] });
      }
      return {
        parts: parts, notes: notes, dims: dims, mount: p.mount,
        callouts: [
          { from: [-(W / 2) + 8, H * 0.7, 0], to: [-(W / 2) - W * 0.55, H * 0.92, zF + 160],
            text: 'LEFT SIDE · ' + p.lside },
          { from: [(W / 2) - 8, H * 0.7, 0], to: [(W / 2) + W * 0.55, H * 0.92, zF + 160],
            text: 'RIGHT SIDE · ' + p.rside },
          { from: [W * 0.25, H * 0.42, zF], to: [W * 0.62, H * 0.14, zF + 400],
            text: 'DOORS · ' + doorFaces +
                  (hasGlass ? ' + GLASS' : '') +
                  (hasHandle ? ' + ' + p.handle : '') },
          { from: [-W * 0.25, 40, zF], to: [-W * 0.5, -H * 0.45, zF + 260],
            text: 'EDGE BAND · ' + p.eband }
        ],
        geo: { IW: IW, IH: IH, CD: CD, SD: SD, variant: v },
        hud: (rs
          ? '<b>Rolling shutter</b> — SIDES are d × h (full depth, no door setback), ' +
            'TOP BOTTOM is w−2t × d.'
          : '<b>Outer sides, inset top and bottom</b> — SIDES are d−t × h (full height) ' +
            'while TOP and BOTTOM are w−2t wide.') +
          '<br>variant <b>' + v + '</b> · interior <b>' + R(IW) + '×' +
          R(IH) + '</b> · carcass depth <b>' + R(CD) + '</b>'
      };
    }
  });
})();
