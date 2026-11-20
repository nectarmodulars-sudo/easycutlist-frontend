/* rule-engines/beds.js — Master Sheet tab "BEDS". Rule code: bed.

     variant  Master Sheet item                              sheet rows
     ------------------------------------------------------------------
     hyd      HYDRAULLIC BED AS PER MATTRESS SIZE                3- 28
     flap     Top Open Flap + Box Storage Bed                   55- 73
     hft      Hydraullic + half Front Trolley Bed              109-139
     s2t      Hydraullic + side 2 trolleys Bed                 174-202
     s1t      Hydraullic + Side 1 Trolley Bed                  233-262
     fft      Hydraullic + Front Full Trolley Bed              291-319

   `bed:hft` in the rule cell picks a variant; otherwise it is read from the
   item name. Every size comes from the mattress, as in the sheet:
     BW (headrest and top width) = mattress W + 100
     TOP   2 lids, BW/2 x mattress D + 50 (front full trolley: BW/2 - 50)
     SIDES box ht x mattress D          FRONT  box ht x BW - 136 (= mw - 36)
     BOTTOM in halves, PARTITION 290 high, TOP INSIDE FIX PATTA 300 wide
     BORDER PATTE 50: 2 lid edges, lid front, headrest top, 2 headrest sides
     FITTING PATTE 70 x side length, 4 per bed (2 per side)
   Top Open Flap is its own build: 4 flaps (mw/2-4 x md/2-4), a full-width
   front, a 270 partition along the length, no border.

   PLACEMENT the sheet does not give, so this engine decides:
     · box sides stand between the headrest and the front; the front panel
       sits between the sides; the lids overhang the front by 50
     · the bottom rests on the lower fitting pattes, 70 off the floor
     · hydraulic lids hinge at the headrest end; trolleys slide straight out
     · DESIGN pieces (front panel decoration) are listed, not drawn */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  var INPUTS = {
    mw:   { from: ['mattress_w', 'matress_w', 'mattresss_w', 'mattress_width', 'w'], def: 1500, min: 600 },
    md:   { from: ['mattress_d', 'matress_d', 'mattress_depth', 'd'], def: 1950, min: 1200 },
    bh:   { from: ['bed_box_ht', 'bed_box_h', 'bed_box_height', 'box_ht'], def: 400, min: 200 },
    hh:   { from: ['headrest_ht', 'headrest_h', 'headresst_h', 'backrest_ht', 'headrest_height'], def: 950, min: 300 },
    fdd:  { from: ['front_single_drawer_depth', 'drawer_depth', 'trolley_depth'], def: 600, min: 200 },
    qty:  { from: ['qty', 'quantity'], def: 1, round: true },
    hmat: { from: ['headrest_material'], def: 'MATERIAL', type: 'str' },
    smat: { from: ['sides_front_material', 'sides_material'], def: 'MATERIAL', type: 'str' },
    bmat: { from: ['border_material'], def: 'MATERIAL', type: 'str' }
  };

  var LABELS = {
    hyd: 'Hydraulic bed', flap: 'Top open flap + box storage', hft: 'Hydraulic + half front trolley',
    s2t: 'Hydraulic + 2 side trolleys', s1t: 'Hydraulic + 1 side trolley', fft: 'Hydraulic + front full trolley'
  };

  function variantOf(p) {
    var a = String(p._variant || '').trim().toLowerCase();
    if (LABELS[a]) return a;
    var n = String(p._item || '').toLowerCase();
    if (/flap/.test(n)) return 'flap';
    if (/full\s*trolley/.test(n)) return 'fft';
    if (/half\s*front/.test(n)) return 'hft';
    if (/2\s*trolley/.test(n)) return 's2t';
    if (/1\s*trolley/.test(n)) return 's1t';
    return 'hyd';
  }

  window.ASM3D.register('bed', {
    label: 'Storage bed',
    category: 'beds',
    version: VERSION,
    inputs: INPUTS,
    controls: [
      { id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Lid open' },
      { id: 'tout', type: 'range', min: 0, max: 100, val: 0, label: 'Trolley out' }
    ],
    newState: function () { return {}; },

    solve: function (p) {
      var notes = [], parts = [], R = Math.round, t = 18;
      function add(o) { parts.push(o); }
      var v = variantOf(p), mw = p.mw, md = p.md, bh = p.bh, hh = p.hh;
      var BW = mw + 100, ang = ((p.dopen || 0) / 100) * (Math.PI * 0.42), out = (p.tout || 0) / 100;
      var flap = (v === 'flap');
      var L = flap ? t + md + 20 + t : t + md + 50;        // overall length, headrest to lid front
      // The room, the camera and the labels read W/H/D: give them the outer bed.
      p.W = BW; p.H = Math.max(hh, bh + t); p.D = L;
      var z0 = -L / 2, zb0 = z0 + t;                      // headrest back face, box start
      var bx = mw / 2;                                     // box half width (sides outside)
      var IWb = mw - 2 * t;                                // between the sides (= mw - 36)
      var yBot = 70;                                       // bottom rests on the lower pattes

      /* ── headrest ── */
      // role 'skirting', not 'border': the elevations treat border as a door and hide it with the doors
      add({ role: 'skirting', w: BW, h: hh, d: t, x: 0, y: hh / 2, z: z0 + t / 2,
            tag: 'BACK / HEADREST ' + R(BW) + '×' + R(hh) + ' · Off White up to 400, ' + p.hmat + ' above' });

      if (flap) return flapBed();

      /* ── box ── */
      var sideL = md, zFrontPanel = zb0 + md - t / 2;
      [-1, 1].forEach(function (s) {
        var slots = (s > 0 && v === 's2t') ? ' + 2 SLOTS' : (s > 0 && v === 's1t') ? ' + 1 SLOT' : '';
        add({ role: 'skirting', w: t, h: bh, d: sideL, x: s * (bx - t / 2), y: bh / 2, z: zb0 + sideL / 2,
              tag: (s < 0 ? 'LEFT' : 'RIGHT') + ' SIDE ' + R(bh) + '×' + R(sideL) + ' · ' + p.smat + slots });
        // fitting pattes: one low (carries the bottom), one high (carries the lids)
        [yBot / 2, bh - 35].forEach(function (y) {
          add({ role: 'filler', w: t, h: 70, d: sideL, x: s * (bx - t - t / 2), y: y, z: zb0 + sideL / 2,
                tag: 'FITTING PATTE 70×' + R(sideL) });
        });
      });
      add({ role: 'skirting', w: IWb, h: bh, d: t, x: 0, y: bh / 2, z: zFrontPanel,
            tag: 'FRONT ' + R(bh) + '×' + R(IWb) + ' · ' + p.smat });

      /* ── what is inside depends on the trolleys ── */
      var inLen = md - 20, zIn0 = zb0 + 10, half = inLen / 2;
      function bottom(w, len, x, z, tag) {
        add({ role: 'shelf', w: w, h: t, d: len, x: x, y: yBot + t / 2, z: z, tag: tag + ' ' + R(len) + '×' + R(w) });
      }
      function crossPart(w, x, z, h, tag) {
        add({ role: 'partition', w: w, h: h, d: t, x: x, y: yBot + t + h / 2, z: z, tag: tag + ' ' + R(h) + '×' + R(w) });
      }
      function trolley(o) {   // o: facia {w,h} in its own plane, box size, slide axis
        var dx = o.axis === 'x' ? out * o.travel : 0, dz = o.axis === 'z' ? out * o.travel : 0;
        add({ role: 'drawer', w: o.fw, h: o.fh, d: o.fd, x: o.fx + dx, y: o.fy, z: o.fz + dz, tag: 'TROLLEY FACIA ' + R(o.fh) + '×' + R(o.axis === 'x' ? o.fd : o.fw) });
        add({ role: 'bigdrawer', w: o.bw, h: o.bhh, d: o.bd, x: o.bx + dx, y: yBot + 30 + o.bhh / 2, z: o.bz + dz,
              tag: 'TROLLEY BOX ' + R(o.bw) + '×' + R(o.bd) + '×' + R(o.bhh) });
      }

      if (v === 'hyd') {
        bottom(IWb, half, 0, zIn0 + half / 2, 'BOTTOM');
        bottom(IWb, half, 0, zIn0 + half * 1.5, 'BOTTOM');
        crossPart(IWb, 0, zIn0 + half, 290, 'PARTITION');
      } else if (v === 'hft') {
        bottom(IWb, half, 0, zIn0 + half / 2, 'HALF BOTTOM');
        bottom(IWb / 2, half, IWb / 4, zIn0 + half * 1.5, 'QUARTER BOTTOM');
        crossPart(IWb, 0, zIn0 + half, 290, 'HALF PARTITION');
        add({ role: 'partition', w: t, h: 360, d: half, x: 0, y: yBot + t + 180, z: zIn0 + half * 1.5,
              tag: 'QUARTER PARTITION ' + R(half) + '×360' });
        var ow = IWb / 2 - 80 - 35, oh = bh - 80;
        trolley({ axis: 'z', travel: half * 0.85,
                  fw: ow, fh: oh, fd: t, fx: -IWb / 4, fy: bh / 2, fz: zFrontPanel + 1,
                  bw: ow - 55, bhh: oh - 50, bd: half - 3, bx: -IWb / 4, bz: zFrontPanel - t / 2 - (half - 3) / 2 });
        notes.push(['ok', 'Front panel: the trolley face (' + R(oh) + '×' + R(ow) + ') is cut out of it, left half.']);
        notes.push(['warn', 'DESIGN pieces (70×' + R(mw - 150) + ' and 150×150, 2 each) are front decoration and are not drawn.']);
      } else if (v === 's2t' || v === 's1t') {
        var n = v === 's2t' ? 2 : 1;
        var fw = (md - 80 * 3) / 2 - 4, fh = bh - 80 - 4, bxIn = IWb / 2;
        bottom(bxIn, inLen, -IWb / 4, zIn0 + inLen / 2, v === 's1t' ? 'BOTTOM-BIG' : 'BOTTOM');
        if (n === 1) bottom(bxIn, half, IWb / 4, zIn0 + half / 2, 'BOTTOM-SMALL');
        crossPart(bxIn, -IWb / 4, zIn0 + half, 290, 'PARTITION');
        var zs = n === 2 ? [zb0 + 80 + fw / 2, zb0 + 160 + fw * 1.5] : [zb0 + 160 + fw * 1.5];
        zs.forEach(function (zc) {
          trolley({ axis: 'x', travel: bxIn * 0.85,
                    fw: t, fh: fh, fd: fw, fx: bx - t / 2 + 1, fy: bh / 2, fz: zc,
                    bw: bxIn - 39, bhh: fh - 53, bd: fw - 5, bx: bx - t - (bxIn - 39) / 2, bz: zc });
        });
        notes.push(['ok', 'Right side: ' + n + ' trolley slot' + (n > 1 ? 's' : '') + ', ' + R(fh) + '×' + R(fw) +
          ' each, 80 between and at the ends.']);
        if (v === 's2t') notes.push(['warn', 'DESIGN rows have no sizes in the Master Sheet, so they are not drawn.']);
      } else if (v === 'fft') {
        var tl = p.fdd, rear = inLen - tl - 20;
        bottom(IWb, rear, 0, zIn0 + rear / 2, 'HALF BOTTOM');
        crossPart(IWb, 0, zIn0 + rear, 290, 'HALF PARTITION');
        var fw2 = IWb - 160, fh2 = bh - 80;
        trolley({ axis: 'z', travel: tl * 0.85,
                  fw: fw2, fh: fh2, fd: t, fx: 0, fy: bh / 2, fz: zFrontPanel + 1,
                  bw: fw2 - 50, bhh: fh2 - 55, bd: tl, bx: 0, bz: zFrontPanel - t / 2 - tl / 2 });
        if (rear < 300) notes.push(['err', 'Front trolley depth ' + R(tl) + ' leaves only ' + R(rear) + 'mm of fixed box behind it.']);
      }

      /* ── top inside fix patta, lids, borders ── */
      add({ role: 'filler', w: 300, h: t, d: md - 100, x: 0, y: bh - t / 2, z: zb0 + 50 + (md - 100) / 2,
            tag: 'TOP INSIDE FIX PATTA 300×' + R(md - 100) });
      var lidW = v === 'fft' ? BW / 2 - 50 : BW / 2, lidL = md + 50;
      [-1, 1].forEach(function (s) {
        var piv = { x: 0, y: bh, z: zb0, rx: -ang };
        var cx = s * (v === 'fft' ? 50 + lidW / 2 : lidW / 2);
        add({ role: 'carcass', w: lidW - 2, h: t, d: lidL, x: cx, y: t / 2, z: lidL / 2, pivot: piv,
              tag: 'TOP (lid) ' + R(lidW) + '×' + R(lidL) + ' · Off White' });
        // the lid's outer edge border hangs down over the side
        add({ role: 'border', w: t, h: 50, d: lidL, x: s * (BW / 2 - t / 2), y: t - 25, z: lidL / 2, pivot: piv,
              tag: 'BORDER PATTE 50×' + R(lidL) + ' · ' + p.bmat });
      });
      add({ role: 'border', w: BW - 100, h: 50, d: t, x: 0, y: bh - 25, z: L / 2 - t / 2,
            tag: 'BORDER PATTE 50×' + R(BW - 100) + ' (front) · ' + p.bmat });
      add({ role: 'border', w: BW, h: 50, d: t, x: 0, y: hh - 25, z: z0 + t + t / 2,
            tag: 'BORDER PATTE 50×' + R(BW) + ' (headrest top) · ' + p.bmat });
      [-1, 1].forEach(function (s) {
        add({ role: 'border', w: 50, h: hh - 50, d: t, x: s * (BW / 2 - 25), y: (hh - 50) / 2, z: z0 + t + t / 2,
              tag: 'BORDER PATTE 50×' + R(hh - 50) + ' (headrest side) · ' + p.bmat });
      });
      if (hh < bh + 150) notes.push(['warn', 'Headrest ' + R(hh) + ' is barely above the ' + R(bh) + ' box.']);
      notes.push(['ok', LABELS[v] + ' for a ' + R(mw) + '×' + R(md) + ' mattress: bed ' + R(BW) + ' wide, ' + R(L) + ' long.']);
      return result();

      function flapBed() {
        var sideL2 = md + 20, zF = zb0 + sideL2 + t / 2;
        [-1, 1].forEach(function (s) {
          add({ role: 'skirting', w: t, h: bh, d: sideL2, x: s * (bx - t / 2), y: bh / 2, z: zb0 + sideL2 / 2,
                tag: (s < 0 ? 'LEFT' : 'RIGHT') + ' SIDE ' + R(bh) + '×' + R(sideL2) });
          add({ role: 'filler', w: t, h: 70, d: sideL2, x: s * (bx - t - t / 2), y: yBot / 2, z: zb0 + sideL2 / 2,
                tag: 'FITTING PATTE 70×' + R(sideL2) });
          add({ role: 'shelf', w: mw / 2 - 4, h: t, d: md, x: s * (mw / 4), y: yBot + t / 2, z: zb0 + 10 + md / 2,
                tag: 'BOTTOM ' + R(mw / 2 - 4) + '×' + R(md) });
        });
        add({ role: 'skirting', w: mw, h: bh, d: t, x: 0, y: bh / 2, z: zF, tag: 'FRONT ' + R(bh) + '×' + R(mw) });
        add({ role: 'partition', w: t, h: 270, d: md, x: 0, y: yBot + t + 135, z: zb0 + 10 + md / 2, tag: 'PARTITION 270×' + R(md) });
        [zb0 + 10 + md / 2, zb0 + md].forEach(function (z) {
          add({ role: 'filler', w: mw - 150, h: 70, d: t, x: 0, y: bh - 35, z: z, tag: 'SIDES (cross rail) 70×' + R(mw - 150) });
        });
        [zb0 + 20, zF - t].forEach(function (z) {
          add({ role: 'filler', w: mw - 40, h: 70, d: t, x: 0, y: yBot / 2, z: z, tag: 'FITTING PATTE 70×' + R(mw - 40) });
        });
        var fw = mw / 2 - 4, fl = md / 2 - 4;
        [-1, 1].forEach(function (sx) {
          [0, 1].forEach(function (row) {
            var zHinge = zb0 + 10 + row * (md / 2);
            var piv = { x: 0, y: bh, z: zHinge, rx: -ang };
            add({ role: 'carcass', w: fw, h: t, d: fl, x: sx * (mw / 4), y: t / 2, z: fl / 2 + 2, pivot: piv,
                  tag: 'TOP FLAP ' + R(fw) + '×' + R(fl) });
          });
        });
        notes.push(['ok', 'Four top flaps on a long partition; no hydraulic, no border patte.']);
        return result();
      }

      function result() {
        var zFr = L / 2;
        return {
          parts: parts, notes: notes,
          callouts: [
            { from: [0, hh * 0.8, z0 + t], to: [-BW * 0.7, hh * 1.15, z0 - 200], text: 'HEADREST · ' + p.hmat },
            { from: [-BW / 2 + 9, bh * 0.5, 0], to: [-BW * 0.85, bh * 0.4, zFr * 0.4], text: 'SIDES + FRONT · ' + p.smat },
            { from: [0, bh, zFr * 0.5], to: [BW * 0.75, bh + 500, zFr + 300], text: (flap ? '4 TOP FLAPS' : 'LIDS + BORDER · ' + p.bmat) }
          ],
          dims: [
            { axis: 'y', a: 0, b: bh, text: 'BOX ' + R(bh), at: [BW / 2 + 300, 0, zFr] },
            { axis: 'y', a: 0, b: hh, text: 'HEADREST ' + R(hh), at: [-BW / 2 - 300, 0, z0] }
          ],
          geo: { BW: BW, L: L, variant: v },
          hud: '<b>' + LABELS[v] + '</b> · mattress <b>' + R(mw) + '×' + R(md) + '</b><br>bed <b>' + R(BW) +
               '×' + R(L) + '</b> · box <b>' + R(bh) + '</b> · headrest <b>' + R(hh) + '</b>'
        };
      }
    }
  });
})();
