/* rule-engines/wardrobes.js — wardrobe rule sets.
   Registers:  slwb  sliding · sliding + bottom wheels · 4 door openable
               wb2d  2 door openable

   A rule engine is PURE DATA IN, PURE DATA OUT. It never touches THREE, the DOM
   or the network — it takes resolved inputs plus the interaction state and
   returns a list of parts. That is what lets this one file be re-uploaded on its
   own when a rule changes, with nothing else in the system rebuilt.

   Part record:
     { role, w, h, d, x, y, z, tag,
       move:'sh'|'hs'|'bd', key, lo, hi, lineYs,   (interactive parts only)
       shape:'box'|'cyl-x'|'cyl-z',                 (default box)
       pivot:{x,y,z,ry} }                           (hinged doors)

   All dimensions in mm. Origin: x = 0 at the centre of the item, y = 0 at the
   floor, z = 0 at the middle of the depth, +z toward the viewer.

   VERSION 1.0.0 — verified against the SketchUp rules model
   (2100 x 2100 x 600, 20 ply, skirting 50, reveal 90, back 20):
   IW 2060 · IH 2010 · colW 1020 · SD 490. */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ── shared helpers ──────────────────────────────────────────────── */

  // Shell common to every wardrobe: two sides, skirting, bottom, top, back.
  function shell(add, p, g) {
    var t = p.ply, W = p.W, H = p.H, D = p.D;
    add({ role: 'side', w: t, h: H, d: D, x: -(W - t) / 2, y: H / 2, z: 0, tag: 'LEFT SIDE' });
    add({ role: 'side', w: t, h: H, d: D, x: (W - t) / 2, y: H / 2, z: 0, tag: 'RIGHT SIDE' });
    add({ role: 'skirting', w: g.IW, h: p.skirt, d: t, x: 0, y: p.skirt / 2, z: (D - t) / 2, tag: 'SKIRTING' });
    add({ role: 'carcass', w: g.IW, h: t, d: D, x: 0, y: p.skirt + t / 2, z: 0, tag: 'BOTTOM' });
    add({ role: 'carcass', w: g.IW, h: t, d: D, x: 0, y: H - t / 2, z: 0, tag: 'TOP' });
  }

  // Evenly spaced, draggable full-width shelves inside one zone.
  function shelves(add, S, p, list, zoneOf, count) {
    var recs = [], t = p.ply;
    if (count <= 0 || !list.length) return recs;
    var per = Math.ceil(count / list.length), done = 0;
    list.forEach(function (zk) {
      var z = zoneOf(zk), n = Math.min(per, count - done);
      if (n <= 0) return;
      for (var i = 1; i <= n; i++) {
        var key = 'sh|' + zk + '|' + i;
        var base = z.y0 + (z.y1 - z.y0) * i / (n + 1);
        var lo = z.y0 + 40, hi = z.y1 - 40;
        var yy = Math.max(lo, Math.min(hi, (S.shY[key] != null) ? S.shY[key] : base));
        add({ role: 'shelf', w: z.w, h: t, d: z.SD, x: z.x, y: yy, z: z.zS,
              tag: 'SHELF · ' + zk.toUpperCase(), move: 'sh', key: key, lo: lo, hi: hi });
        recs.push({ zone: zk, y: yy, x: z.x, w: z.w });
        done++;
      }
    });
    return recs;
  }

  // Index of the sub-cell furthest from the item centre — the default home for a
  // half shelf, which always starts on the outer side.
  function outerIdx(list) {
    var bi = 0, bv = -1;
    list.forEach(function (c, i) { if (Math.abs(c.x) > bv) { bv = Math.abs(c.x); bi = i; } });
    return bi;
  }

  // A locker is never free-standing: it sits ON a shelf or half shelf.
  function locker(add, notes, p, cands, zoneTop, SD, zBack, colW, where) {
    var t = p.ply;
    if (!cands.length) {
      notes.push(['err', 'LOCKER cannot go in ' + where +
        ' — it must sit above a shelf or half shelf, and there is none there.']);
      return;
    }
    cands.sort(function (a, b) { return a.y - b.y; });
    var base = cands[0];
    var lh = Math.min(353, Math.max(180, zoneTop - base.y - 40));
    var lw = Math.min(353, base.w - 20);
    var lkD = Math.min(424, SD);
    var sx = base.x + (base.w / 2 - lw / 2) - 8;
    var y0 = base.y + t / 2, zl = zBack + lkD / 2;
    add({ role: 'locker', w: t, h: lh, d: lkD, x: sx - lw / 2, y: y0 + lh / 2, z: zl, tag: 'LOCKER VERTICAL' });
    add({ role: 'locker', w: lw, h: t, d: lkD, x: sx, y: y0 + lh, z: zl, tag: 'LOCKER HORIZONTAL' });
    add({ role: 'lockerdoor', w: lw - 10, h: lh - 10, d: t, x: sx, y: y0 + lh / 2, z: zBack + lkD + t / 2, tag: 'LOCKER DOOR' });
    add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 14, x: sx + lw / 4, y: y0 + lh / 2, z: zBack + lkD + t - 6 });
    notes.push(['ok', 'Locker sits on a ' + (base.w < colW - 1 ? 'half shelf' : 'shelf') + ' in ' + where + '.']);
  }

  function callouts(p, W, H, zF) {
    return [
      { from: [-(W / 2) + 8, H * 0.74, 0], to: [-(W / 2) - 520, H * 0.80, zF + 120], text: 'LEFT SIDE · ' + p.lside },
      { from: [(W / 2) - 8, H * 0.74, 0],  to: [(W / 2) + 520, H * 0.80, zF + 120], text: 'RIGHT SIDE · ' + p.rside },
      { from: [-W / 4, H * 0.34, zF],      to: [-W * 0.42, H * 0.16, zF + 520], text: 'DOOR 1 · ' + p.door1 },
      { from: [W / 4, H * 0.34, zF],       to: [W * 0.42, H * 0.16, zF + 520], text: 'DOOR 2 · ' + p.door2 },
      { from: [0, H - 50, zF],             to: [0, H + 300, zF + 320], text: 'BORDER · ' + p.bmat },
      { from: [W * 0.30, 60, zF],          to: [W * 0.30, -420, zF + 320], text: 'EDGE BAND · ' + p.eband }
    ];
  }

  /* Input declarations. `from` lists the Master Sheet input keys this value may
     arrive under — the key the parser derives is the label lowercased with every
     run of non-alphanumerics turned into '_'. First match wins; `def` is used
     when the item declares none of them. */
  var COMMON_INPUTS = {
    W:      { from: ['width', 'wardrobe_width', 'w'], def: 2100, min: 700 },
    H:      { from: ['ht', 'height', 'h'], def: 2100, min: 1000 },
    D:      { from: ['depth', 'dep', 'd'], def: 600, min: 300 },
    ply:    { from: ['ply_thickness', 'ply', 'panel_thickness', 'thickness'], def: 18, min: 6 },
    skirt:  { from: ['skirting', 'skirting_ht', 'skirting_height'], def: 50, min: 0 },
    reveal: { from: ['door_reveal', 'reveal'], def: 90, min: 0 },
    backT:  { from: ['back_thickness', 'back_thk', 'back'], def: 8, min: 3 },
    hang:   { from: ['hanger_space', 'hanging_space', 'hanger'], def: 950, min: 250 },
    shelf:  { from: ['shelf', 'shelves', 'shelf_qty'], def: 0, round: true },
    uhs:    { from: ['upper_half_shelf', 'upper_half_shelves'], def: 0, round: true },
    lhs:    { from: ['lower_half_shelf', 'lower_half_shelves'], def: 0, round: true },
    // Fallback for a Master Sheet that has ONE "Half shelf" input rather than a
    // separate upper and lower one. Split across the two bands when the split
    // inputs are absent.
    hsAll:  { from: ['half_shelf', 'half_shelves', 'half_shelf_qty'], def: 0, round: true },
    uv:     { from: ['upper_vertical', 'upper_verticals'], def: 0, round: true, max: 4 },
    lv:     { from: ['lower_vertical', 'lower_verticals'], def: 0, round: true, max: 4 },
    locker: { from: ['locker', 'locker_qty'], def: 0, round: true },
    sdq:    { from: ['small_drawer_qty', 'small_drawer', 'small_drawers'], def: 0, round: true },
    sdh:    { from: ['small_drawer_ht', 'small_drawer_height'], def: 150, min: 60 },
    bdq:    { from: ['big_drawer_qty', 'big_drawer', 'big_drawers'], def: 0, round: true },
    bdh:    { from: ['big_drawer_ht', 'big_drawer_height'], def: 250, min: 60 },
    lside:  { from: ['left_side', 'side_material', 'carcass_material'], def: 'MATERIAL', type: 'str' },
    rside:  { from: ['right_side', 'side_material', 'carcass_material'], def: 'MATERIAL', type: 'str' },
    door1:  { from: ['door1', 'door_1', 'door_material'], def: 'MATERIAL', type: 'str' },
    door2:  { from: ['door2', 'door_2', 'door_material'], def: 'MATERIAL', type: 'str' },
    bmat:   { from: ['border', 'border_material'], def: 'MATERIAL', type: 'str' },
    eband:  { from: ['edge_band', 'edgeband', 'edge_banding'], def: 'MATERIAL', type: 'str' }
  };

  function fresh() { return { bdCol: 'R', bdRow: 0, shY: {}, hs: null, hsKey: '' }; }

  /* ════════════════════════════════════════════════════════════════════
     slwb — two columns: Q1|Q2 · quarter divider · drawer band · Q3|Q4
     ════════════════════════════════════════════════════════════════════ */

  window.ASM3D.register('slwb', {
    label: 'Sliding / 4-Door Wardrobe',
    category: 'wardrobes',
    version: VERSION,
    inputs: COMMON_INPUTS,
    // Viewer-only controls; the core renders these in the toolbar and merges
    // their values into p. They are NOT Master Sheet inputs.
    controls: [
      { id: 'doorLR', type: 'range', min: -100, max: 100, val: 0, label: 'Door slide' },
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }
    ],
    newState: fresh,
    onInputChange: function (S, key) { if (key === 'uhs' || key === 'lhs' || key === 'hsAll') S.hs = null; },

    solve: function (p, S) {
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D;
      var IW = W - 2 * t, yB = p.skirt + t, yT = H - t, IH = yT - yB;
      var backT = p.backT, zBack = -D / 2 + backT;
      var SD = Math.max(150, D - p.reveal - backT), zS = zBack + SD / 2;
      var colW = (IW - t) / 2, Lx = -(t / 2 + colW / 2), Rx = (t / 2 + colW / 2);
      var slotW = (colW - 2 * t) / 2;   // channel filler each end, then 2 equal faces
      var slotX = [Lx - slotW / 2, Lx + slotW / 2, Rx - slotW / 2, Rx + slotW / 2];
      var SLOT = ['DL-1', 'DL-2', 'DR-1', 'DR-2'];

      /* ── drawer band ──
         Each COLUMN keeps its own stack of rows, pinned to the top of the band
         and stacking downward. A row holds 2 small drawers (that column's two
         slots) or one big drawer spanning the column. Moving anything in one
         column never touches the other, and the band height comes from the
         inputs alone — which is what stops any vertical changing height when a
         drawer is dragged. */
      function rowH(r) { return r.type === 'big' ? p.bdh : p.sdh; }
      function total(a) { var v = 0; a.forEach(function (r) { v += rowH(r); }); return v; }

      function canonical() {
        var L = [], R = [], sm = Math.max(0, p.sdq), turn = 0;
        while (sm > 0) {                       // DL-1, DL-2 → DR-1, DR-2 → next row
          var n = Math.min(2, sm); sm -= n;
          (turn % 2 === 0 ? L : R).push({ type: 'small', n: n }); turn++;
        }
        for (var b = 0; b < Math.max(0, p.bdq); b++)
          (R.length <= L.length ? R : L).push({ type: 'big' });   // fewer rows wins
        return { L: L, R: R };
      }
      var can = canonical();
      var bandH = Math.max(total(can.L), total(can.R));           // FIXED by inputs
      var cols = { L: can.L.slice(), R: can.R.slice() };

      if (p.bdq > 0) {
        var from = null, fi = -1, cc = ['R', 'L'];
        for (var ci0 = 0; ci0 < cc.length && !from; ci0++) {
          var a0 = cols[cc[ci0]];
          for (var i0 = 0; i0 < a0.length; i0++)
            if (a0[i0].type === 'big') { from = cc[ci0]; fi = i0; break; }
        }
        if (from) {
          var to = (S.bdCol === 'L' || S.bdCol === 'R') ? S.bdCol : from;
          var tri = { L: cols.L.slice(), R: cols.R.slice() };
          var item = tri[from].splice(fi, 1)[0];
          tri[to].splice(Math.max(0, Math.min(tri[to].length, S.bdRow)), 0, item);
          if (Math.max(total(tri.L), total(tri.R)) <= bandH) cols = tri;  // never grow
        }
        // exactly one big drawer is draggable, so a move is never ambiguous
        var tagged = false, order = (S.bdCol === 'L') ? ['L', 'R'] : ['R', 'L'];
        for (var o = 0; o < order.length && !tagged; o++) {
          var ar = cols[order[o]];
          for (var q0 = 0; q0 < ar.length; q0++)
            if (ar[q0].type === 'big') { ar[q0].drag = true; ar[q0].col = order[o]; tagged = true; break; }
        }
      }
      var dlH = bandH;

      /* ── bands ── */
      var hang = Math.max(300, Math.min(p.hang, IH - t - dlH - 250));
      var upTop = yT, upBot = yT - hang;
      var divBot = upBot - t;                  // quarter divider shelf
      var dlTop = divBot;
      var totL = total(cols.L), totR = total(cols.R);
      // Each lower quarter ends under ITS OWN column's stack — a column with
      // fewer rows keeps its full height rather than floating short.
      var q3Top = dlTop - totL, q4Top = dlTop - totR;
      var loTop = Math.min(q3Top, q4Top), loBot = yB;
      if (loTop - loBot < 150)
        notes.push(['warn', 'Lower quarters are very short — reduce drawer lines or the hanger space.']);

      var Q = {
        q1: { x: Lx, y0: upBot, y1: upTop, w: colW, band: 'upper' },
        q2: { x: Rx, y0: upBot, y1: upTop, w: colW, band: 'upper' },
        q3: { x: Lx, y0: loBot, y1: q3Top, w: colW, band: 'lower' },
        q4: { x: Rx, y0: loBot, y1: q4Top, w: colW, band: 'lower' }
      };
      function span(q) { return { y0: Q[q].y0, y1: Q[q].y1 }; }

      /* ── verticals: always centred; >2 in a quarter splits it in 3 ── */
      function alloc(c, qa, qb, pref) {
        var m = {}; m[qa] = 0; m[qb] = 0;
        if (c <= 0) return m;
        if (c === 1) m[pref === qb ? qb : qa] = 1;
        else if (c === 2) { m[qa] = 1; m[qb] = 1; }
        else if (c === 3) { var pk = (pref === qb) ? qb : qa; m[pk] = 2; m[pk === qa ? qb : qa] = 1; }
        else { m[qa] = 2; m[qb] = 2; }
        return m;
      }
      var uvM = alloc(p.uv, 'q1', 'q2', S.uvQ || 'q1');
      var lvM = alloc(p.lv, 'q3', 'q4', S.lvQ || 'q3');

      // a big drawer and a lower vertical cannot share a quarter
      var bdQ = (S.bdCol === 'L') ? 'q3' : 'q4', oth = (bdQ === 'q3') ? 'q4' : 'q3';
      if (p.bdq > 0 && lvM[bdQ] > 0) {
        if (p.lv === 1) {
          lvM[oth] = lvM[bdQ]; lvM[bdQ] = 0;
          notes.push(['ok', 'Lower vertical auto-shifted to ' + oth.toUpperCase() +
            ' — the big drawer sits over ' + bdQ.toUpperCase() + '.']);
        } else {
          notes.push(['err', 'Big drawer over ' + bdQ.toUpperCase() +
            ' conflicts with lower verticals in both quarters. Reduce LOWER VERTICAL to 1.']);
        }
      }
      if (p.uv > 2 || p.lv > 2) notes.push(['warn', 'Please check half shelf sizes.']);

      var vM = { q1: uvM.q1, q2: uvM.q2, q3: lvM.q3, q4: lvM.q4 };
      function cells(q) {
        var n = vM[q], Qd = Q[q], cw = (Qd.w - n * t) / (n + 1), a = [];
        for (var i = 0; i <= n; i++)
          a.push({ q: q, x: Qd.x - Qd.w / 2 + cw / 2 + i * (cw + t), w: cw, id: 'abc'.charAt(i) });
        return a;
      }
      var CM = { q1: cells('q1'), q2: cells('q2'), q3: cells('q3'), q4: cells('q4') };

      /* ── shell ── */
      shell(add, p, { IW: IW });
      var bw = (IW + 16) / 2;
      add({ role: 'back', w: bw - 4, h: IH + 16, d: backT, x: -bw / 2, y: yB + (IH + 16) / 2 - 8, z: zBack - backT / 2 });
      add({ role: 'back', w: bw - 4, h: IH + 16, d: backT, x: bw / 2, y: yB + (IH + 16) / 2 - 8, z: zBack - backT / 2 });
      var zF = D / 2 - t / 2;
      add({ role: 'border', w: W, h: 100, d: t, x: 0, y: H - 50, z: zF, tag: 'TOP BORDER' });
      add({ role: 'border', w: W, h: 100, d: t, x: 0, y: 50, z: zF, tag: 'BOTTOM BORDER' });
      add({ role: 'border', w: 50, h: H, d: t, x: -(W - 50) / 2, y: H / 2, z: zF });
      add({ role: 'border', w: 50, h: H, d: t, x: (W - 50) / 2, y: H / 2, z: zF });
      add({ role: 'partition', w: t, h: IH, d: SD, x: 0, y: yB + IH / 2, z: zS, tag: 'VERTICAL PARTITION' });
      // The panel above the drawer band is NOT a fixed divider: it is the first
      // one or two shelves off the SHELF count, one per column. SHELF 0 leaves
      // that line open. The band's own position never moves either way, so no
      // vertical changes height when the count changes.
      var topShelves = Math.min(2, Math.max(0, p.shelf));
      [Lx, Rx].forEach(function (cx, i) {
        if (i >= topShelves) return;
        add({ role: 'shelf', w: colW, h: t, d: SD, x: cx, y: divBot + t / 2, z: zS,
              tag: 'SHELF ' + (i + 1) + ' \u00b7 above drawer line \u00b7 ' +
                   (i === 0 ? 'LEFT' : 'RIGHT') });
      });
      if (vM.q1 === 0)
        add({ role: 'rod', shape: 'cyl-x', w: colW - 40, h: 26, d: 26, x: Q.q1.x, y: upTop - 90, z: zS, tag: 'HANGING ROD' });
      if (vM.q2 === 0)
        add({ role: 'rod', shape: 'cyl-x', w: colW - 40, h: 26, d: 26, x: Q.q2.x, y: upTop - 90, z: zS, tag: 'HANGING ROD' });

      // verticals span the full height of their quarter
      ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
        var n = vM[q]; if (!n) return;
        var Qd = Q[q], cw = (Qd.w - n * t) / (n + 1), h = Qd.y1 - Qd.y0;
        for (var i = 1; i <= n; i++)
          add({ role: 'vertical', w: t, h: h, d: SD, x: Qd.x - Qd.w / 2 + i * (cw + t) - t / 2,
                y: Qd.y0 + h / 2, z: zS,
                tag: (Qd.band === 'upper' ? 'UPPER' : 'LOWER') + ' VERTICAL · ' +
                     q.toUpperCase() + ' (' + Math.round(h) + ')' });
      });

      /* ── the drawer band, each column independent ── */
      var dz = D / 2 - p.reveal - t / 2;
      var COLI = { L: { cx: Lx, sl: [0, 1] }, R: { cx: Rx, sl: [2, 3] } };
      var bdRowYs = [], bdCol = null;
      ['L', 'R'].forEach(function (cK) {
        var ci = COLI[cK], y = dlTop;
        cols[cK].forEach(function (r) {
          var h = rowH(r), cy = y - h / 2;
          add({ role: 'filler', w: t, h: h, d: SD, x: ci.cx - colW / 2 + t / 2, y: cy, z: zS, tag: 'CHANNEL FILLER · ' + cK });
          add({ role: 'filler', w: t, h: h, d: SD, x: ci.cx + colW / 2 - t / 2, y: cy, z: zS, tag: 'CHANNEL FILLER · ' + cK });
          if (r.type === 'big') {
            add({ role: 'bigdrawer', w: colW - 2 * t - 4, h: h - 8, d: t, x: ci.cx, y: cy, z: dz,
                  tag: 'BIG DRAWER · ' + (cK === 'L' ? 'DL-1+DL-2' : 'DR-1+DR-2'),
                  move: r.drag ? 'bd' : null, key: r.drag ? 'bd' : null });
            add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 14, x: ci.cx, y: cy, z: dz - t });
            if (r.drag) bdCol = cK;
          } else {
            for (var k = 0; k < r.n; k++) {
              var si = ci.sl[k];
              add({ role: 'drawer', w: slotW - 3, h: h - 8, d: t, x: slotX[si], y: cy, z: dz,
                    tag: 'SMALL DRAWER · ' + SLOT[si] });
              add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 14, x: slotX[si], y: cy, z: dz - t });
            }
          }
          y -= h;
        });
      });
      // the only snap targets a big-drawer drag may use: rows of its OWN column
      if (bdCol) {
        var yy = dlTop;
        cols[bdCol].forEach(function (r) { var h = rowH(r); bdRowYs.push(yy - h / 2); yy -= h; });
        parts.forEach(function (pt) { if (pt.move === 'bd') { pt.lineYs = bdRowYs; pt.bdCol = bdCol; } });
      }

      /* ── full-width shelves: quarters with no vertical ── */
      var plain = [];
      ['q4', 'q3', 'q2', 'q1'].forEach(function (q) { if (vM[q] === 0) plain.push(q); });
      var shelfRecs = shelves(add, S, p, plain, function (q) {
        return { y0: Q[q].y0, y1: Q[q].y1, x: Q[q].x, w: Q[q].w, SD: SD, zS: zS };
      }, Math.max(0, p.shelf - topShelves));   // 1st and 2nd already used above the band

      /* ── half shelves: upper → Q1/Q2, lower → Q3/Q4 ── */
      function bandCells(band) {
        var out = [];
        (band === 'upper' ? ['q1', 'q2'] : ['q3', 'q4']).forEach(function (q) {
          if (vM[q] > 0) CM[q].forEach(function (c) { out.push(c); });
        });
        return out;
      }
      var upCells = bandCells('upper'), loCells = bandCells('lower');
      // One combined HALF SHELF input splits evenly, upper first.
      var uhsN = p.uhs, lhsN = p.lhs;
      if (!uhsN && !lhsN && p.hsAll > 0) {
        uhsN = Math.ceil(p.hsAll / 2); lhsN = p.hsAll - uhsN;
        notes.push(['ok', 'HALF SHELF ' + p.hsAll + ' split ' + uhsN + ' upper / ' + lhsN +
          ' lower. Add separate UPPER HALF SHELF and LOWER HALF SHELF inputs in the Master Sheet to place them yourself.']);
      }
      var hsKey = uhsN + '/' + lhsN;
      if (S.hs === null || S.hsKey !== hsKey) {
        S.hs = []; S.hsKey = hsKey;
        for (var a1 = 0; a1 < uhsN; a1++) S.hs.push({ band: 'upper', cell: -1, y: null });
        for (var a2 = 0; a2 < lhsN; a2++) S.hs.push({ band: 'lower', cell: -1, y: null });
      }
      var hsRecs = [], warned = {};
      S.hs.forEach(function (st, j) {
        var list = (st.band === 'upper') ? upCells : loCells;
        if (!list.length) {
          if (!warned[st.band]) {
            warned[st.band] = 1;
            notes.push(['warn', (st.band === 'upper' ? 'UPPER' : 'LOWER') +
              ' HALF SHELF has nowhere to sit — ' + (st.band === 'upper' ? 'Q1/Q2' : 'Q3/Q4') +
              ' needs a vertical to create sub-columns.']);
          }
          return;
        }
        if (st.cell < 0 || st.cell >= list.length) st.cell = outerIdx(list);
        var c = list[st.cell], sp = span(c.q);
        var sib = S.hs.filter(function (o) { return o.band === st.band && o.cell === st.cell; });
        var ord = sib.indexOf(st) + 1, cnt = sib.length;
        var base = sp.y0 + (sp.y1 - sp.y0) * ord / (cnt + 1);
        var lo = sp.y0 + 40, hi = sp.y1 - 40;
        var yy2 = Math.max(lo, Math.min(hi, (st.y != null) ? st.y : base));
        add({ role: 'halfshelf', w: c.w, h: t, d: SD, x: c.x, y: yy2, z: zS,
              tag: (st.band === 'upper' ? 'UPPER' : 'LOWER') + ' HALF SHELF · ' +
                   c.q.toUpperCase() + c.id, move: 'hs', key: String(j), lo: lo, hi: hi });
        hsRecs.push({ zone: c.q, y: yy2, x: c.x, w: c.w });
      });

      /* ── locker: Q3/Q4 only, and only on a shelf or half shelf ── */
      if (p.locker > 0) {
        // The Master Sheet has no "which quarter" input, so prefer the chosen
        // one but fall back to whichever lower quarter actually has a shelf —
        // erroring because Q3 happens to hold the vertical is not useful.
        var all = shelfRecs.concat(hsRecs);
        var order = (S.lkQ === 'q4') ? ['q4', 'q3'] : ['q3', 'q4'], lq = order[0];
        for (var li = 0; li < order.length; li++) {
          if (all.some(function (r) { return r.zone === order[li]; })) { lq = order[li]; break; }
        }
        locker(add, notes, p,
          all.filter(function (r) { return r.zone === lq; }),
          Q[lq].y1, SD, zBack, colW, lq.toUpperCase());
      }

      /* ── sliding doors, two tracks ──
         Control centred = shut. Positive slides the LEFT door right (opens the
         left bay); negative slides the RIGHT door left. */
      var sl = (p.doorLR || 0) / 100, dw = W / 2, dh = H - 129, tr = dw * 0.96;
      var d1x = -dw / 2, d2x = dw / 2;
      if (sl > 0) d1x += sl * tr;
      if (sl < 0) d2x += sl * tr;
      add({ role: 'door', w: dw, h: dh, d: 25, x: d1x, y: H / 2 - 14, z: D / 2 - 16, tag: '25MM DOOR 1' });
      add({ role: 'door', w: dw, h: dh, d: 25, x: d2x, y: H / 2 - 14, z: D / 2 - 48, tag: '25MM DOOR 2' });

      return {
        parts: parts, notes: notes,
        callouts: callouts(p, W, H, D / 2),
        zones: Q, vM: vM, CM: CM, cols: cols,
        geo: { IW: IW, IH: IH, colW: colW, slotW: slotW, hang: hang, dlH: dlH,
               SD: SD, yB: yB, yT: yT, upBot: upBot, divBot: divBot,
               q3Top: q3Top, q4Top: q4Top, q3H: q3Top - loBot, q4H: q4Top - loBot },
        hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · depth <b>' +
             Math.round(SD) + '</b><br>column <b>' + Math.round(colW) + '</b> · slot <b>' +
             Math.round(slotW) + '</b> · band <b>' + Math.round(dlH) + '</b><br>Q3 <b>' +
             Math.round(q3Top - loBot) + '</b> · Q4 <b>' + Math.round(q4Top - loBot) + '</b>'
      };
    },

    // left / right arrow on the hover widget
    lateral: function (S, dir, u, res) {
      if (u.move === 'bd') { S.bdCol = (S.bdCol === 'R') ? 'L' : 'R'; S.bdRow = 0; return true; }
      if (u.move === 'hs' && u.key != null) {
        var st = S.hs && S.hs[+u.key]; if (!st) return false;
        var qs = (st.band === 'upper') ? ['q1', 'q2'] : ['q3', 'q4'], cells = [];
        qs.forEach(function (q) {
          if (res.vM[q] > 0) res.CM[q].forEach(function (c) { cells.push(c); });
        });
        if (!cells.length) return false;
        st.cell = (st.cell + (dir > 0 ? 1 : cells.length - 1)) % cells.length;
        st.y = null;
        return true;
      }
      return false;
    },


    // One step up or down from the hover widget. Shelves and half shelves nudge
    // in 25mm; a big drawer jumps a whole row in its OWN column, which is the
    // only movement that keeps the band height fixed.
    vstep: function (S, dir, u) {
      var NUDGE = 25;
      if (u.move === 'sh') {
        var cur = (S.shY[u.key] != null) ? S.shY[u.key] : (u.lo + u.hi) / 2;
        var nv = Math.max(u.lo, Math.min(u.hi, cur + dir * NUDGE));
        if (nv === S.shY[u.key]) return false;
        S.shY[u.key] = nv; return true;
      }
      if (u.move === 'hs') {
        var st = S.hs && S.hs[+u.key]; if (!st) return false;
        var c2 = (st.y != null) ? st.y : (u.lo + u.hi) / 2;
        var n2 = Math.max(u.lo, Math.min(u.hi, c2 + dir * NUDGE));
        if (n2 === st.y) return false;
        st.y = n2; return true;
      }
      if (u.move === 'bd') {
        var rows = (u.lineYs || []).length; if (rows < 2) return false;
        // row 0 is the top of the band, so "up" is one index lower
        var want = Math.max(0, Math.min(rows - 1, (S.bdRow || 0) - dir));
        if (want === S.bdRow) return false;
        S.bdRow = want; return true;
      }
      return false;
    },

    // vertical drag; y is the pointer's world height
    drag: function (S, d, y) {
      if (d.move === 'sh') { S.shY[d.key] = Math.max(d.lo, Math.min(d.hi, y)); return true; }
      if (d.move === 'hs') {
        var st = S.hs && S.hs[+d.key]; if (!st) return false;
        st.y = Math.max(d.lo, Math.min(d.hi, y)); return true;
      }
      if (d.move === 'bd') {
        var LY = d.lineYs || []; if (!LY.length) return false;
        var bi = 0, bmin = 1e12;
        LY.forEach(function (v, i) { var dd = Math.abs(v - y); if (dd < bmin) { bmin = dd; bi = i; } });
        if (bi === S.bdRow) return false;
        S.bdRow = bi; return true;
      }
      return false;
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     wb2d — one column: Upper part · divider · drawer line · Lower part
     ════════════════════════════════════════════════════════════════════ */

  window.ASM3D.register('wb2d', {
    label: '2-Door Openable Wardrobe',
    category: 'wardrobes',
    version: VERSION,
    inputs: COMMON_INPUTS,
    controls: [
      { id: 'dopen', type: 'range', min: 0, max: 100, val: 0, label: 'Door open' },
      { id: 'op', type: 'range', min: 5, max: 100, val: 34, label: 'Door opacity' }
    ],
    newState: fresh,
    onInputChange: function (S, key) { if (key === 'uhs' || key === 'lhs' || key === 'hsAll') S.hs = null; },

    solve: function (p, S) {
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D;
      var IW = W - 2 * t, yB = p.skirt + t, yT = H - t, IH = yT - yB;
      var backT = p.backT, zBack = -D / 2 + backT;
      var SD = Math.max(150, D - backT - 24), zS = zBack + SD / 2;
      var colW = IW;                        // single column, no partition
      var slotW = (colW - 2 * t) / 2;       // two slots: D-1, D-2
      var slotX = [-slotW / 2, slotW / 2], SLOT = ['D-1', 'D-2'];

      function rowH(r) { return r.type === 'big' ? p.bdh : p.sdh; }
      function total(a) { var v = 0; a.forEach(function (r) { v += rowH(r); }); return v; }

      var rows = [], sm = Math.max(0, p.sdq);
      while (sm > 0) { var n = Math.min(2, sm); sm -= n; rows.push({ type: 'small', n: n }); }
      for (var b = 0; b < Math.max(0, p.bdq); b++) rows.push({ type: 'big' });
      var stackH = total(rows);             // fixed by inputs alone
      // a drag REORDERS the stack — it never adds a row, so no zone height shifts
      if (p.bdq > 0 && rows.length > 1) {
        var bi = -1;
        for (var i = 0; i < rows.length; i++) if (rows[i].type === 'big') { bi = i; break; }
        if (bi >= 0) {
          var want = Math.max(0, Math.min(rows.length - 1, S.bdRow));
          if (want !== bi) rows.splice(want, 0, rows.splice(bi, 1)[0]);
        }
      }
      var dragRow = -1;
      for (var d0 = 0; d0 < rows.length; d0++) if (rows[d0].type === 'big') { dragRow = d0; break; }

      var hang = Math.max(250, Math.min(p.hang, IH - t - stackH - 200));
      var upTop = yT, upBot = yT - hang;
      var divBot = upBot - t;
      var dlTop = divBot, lTop = dlTop - stackH, lBot = yB;
      if (lTop - lBot < 120)
        notes.push(['warn', 'Lower part is very short — reduce drawers or the hanger space.']);

      var Z = { U: { y0: upBot, y1: upTop }, L: { y0: lBot, y1: lTop } };
      function span(z) { return { y0: Z[z].y0, y1: Z[z].y1 }; }

      var uvN = Math.max(0, p.uv), lvN = Math.max(0, p.lv);
      // one column, so a big drawer and a lower vertical have nowhere to separate
      if (p.bdq > 0 && lvN > 0) {
        notes.push(['err', 'A big drawer and a LOWER VERTICAL cannot share the lower part, ' +
          'and with one column there is no other column to shift to. The lower vertical is ' +
          'suppressed — remove the big drawer or set LOWER VERTICAL to 0.']);
        lvN = 0;
      }
      if (uvN > 2 || lvN > 2) notes.push(['warn', 'Please check half shelf sizes.']);

      var vN = { U: uvN, L: lvN };
      function cells(z) {
        var nn = vN[z], cw = (colW - nn * t) / (nn + 1), a = [];
        for (var i2 = 0; i2 <= nn; i2++)
          a.push({ z: z, x: -colW / 2 + cw / 2 + i2 * (cw + t), w: cw, id: 'abc'.charAt(i2) });
        return a;
      }
      var CM = { U: cells('U'), L: cells('L') };

      /* ── shell ── */
      shell(add, p, { IW: IW });
      add({ role: 'back', w: IW + 12, h: IH + 12, d: backT, x: 0, y: yB + (IH + 12) / 2 - 6, z: zBack - backT / 2 });
      // Same rule as slwb, but one column so the line above the drawer band
      // takes a single shelf, and SHELF 0 leaves it open.
      var topShelves = Math.min(1, Math.max(0, p.shelf));
      if (topShelves) {
        add({ role: 'shelf', w: IW, h: t, d: SD, x: 0, y: divBot + t / 2, z: zS,
              tag: 'SHELF 1 \u00b7 above drawer line' });
      }
      if (vN.U === 0)
        add({ role: 'rod', shape: 'cyl-x', w: colW - 40, h: 26, d: 26, x: 0, y: upTop - 90, z: zS, tag: 'HANGING ROD' });

      ['U', 'L'].forEach(function (z) {
        var nn = vN[z]; if (!nn) return;
        var Zd = Z[z], cw = (colW - nn * t) / (nn + 1), h = Zd.y1 - Zd.y0;
        for (var i3 = 1; i3 <= nn; i3++)
          add({ role: 'vertical', w: t, h: h, d: SD, x: -colW / 2 + i3 * (cw + t) - t / 2,
                y: Zd.y0 + h / 2, z: zS,
                tag: (z === 'U' ? 'UPPER' : 'LOWER') + ' VERTICAL (' + Math.round(h) + ')' });
      });

      /* ── drawer line ── */
      var dz = D / 2 - t / 2 - 12, y = dlTop, rowYs = [];
      rows.forEach(function (r) { rowYs.push(y - rowH(r) / 2); y -= rowH(r); });
      y = dlTop;
      rows.forEach(function (r, ri) {
        var h = rowH(r), cy = y - h / 2;
        add({ role: 'filler', w: t, h: h, d: SD, x: -colW / 2 + t / 2, y: cy, z: zS, tag: 'CHANNEL FILLER' });
        add({ role: 'filler', w: t, h: h, d: SD, x: colW / 2 - t / 2, y: cy, z: zS, tag: 'CHANNEL FILLER' });
        if (r.type === 'big') {
          add({ role: 'bigdrawer', w: colW - 2 * t - 4, h: h - 8, d: t, x: 0, y: cy, z: dz,
                tag: 'BIG DRAWER · D-1+D-2',
                move: (ri === dragRow) ? 'bd' : null, key: (ri === dragRow) ? 'bd' : null,
                lineYs: rowYs });
          add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 14, x: 0, y: cy, z: dz - t });
        } else {
          for (var k = 0; k < r.n; k++) {
            add({ role: 'drawer', w: slotW - 3, h: h - 8, d: t, x: slotX[k], y: cy, z: dz,
                  tag: 'SMALL DRAWER · ' + SLOT[k] });
            add({ role: 'knob', shape: 'cyl-z', w: 22, h: 22, d: 14, x: slotX[k], y: cy, z: dz - t });
          }
        }
        y -= h;
      });

      /* ── shelves / half shelves / locker ── */
      var plain = [];
      ['L', 'U'].forEach(function (z) { if (vN[z] === 0) plain.push(z); });
      var shelfRecs = shelves(add, S, p, plain, function (z) {
        return { y0: Z[z].y0, y1: Z[z].y1, x: 0, w: colW, SD: SD, zS: zS };
      }, Math.max(0, p.shelf - topShelves));   // the 1st is above the band

      // One combined HALF SHELF input splits evenly, upper first.
      var uhsN = p.uhs, lhsN = p.lhs;
      if (!uhsN && !lhsN && p.hsAll > 0) {
        uhsN = Math.ceil(p.hsAll / 2); lhsN = p.hsAll - uhsN;
        notes.push(['ok', 'HALF SHELF ' + p.hsAll + ' split ' + uhsN + ' upper / ' + lhsN +
          ' lower. Add separate UPPER HALF SHELF and LOWER HALF SHELF inputs in the Master Sheet to place them yourself.']);
      }
      var hsKey = uhsN + '/' + lhsN;
      if (S.hs === null || S.hsKey !== hsKey) {
        S.hs = []; S.hsKey = hsKey;
        for (var b1 = 0; b1 < uhsN; b1++) S.hs.push({ zone: 'U', cell: -1, y: null });
        for (var b2 = 0; b2 < lhsN; b2++) S.hs.push({ zone: 'L', cell: -1, y: null });
      }
      var hsRecs = [], warned = {};
      S.hs.forEach(function (st, j) {
        var list = vN[st.zone] > 0 ? CM[st.zone] : [];
        if (!list.length) {
          if (!warned[st.zone]) {
            warned[st.zone] = 1;
            notes.push(['warn', (st.zone === 'U' ? 'UPPER' : 'LOWER') +
              ' HALF SHELF has nowhere to sit — the ' + (st.zone === 'U' ? 'upper' : 'lower') +
              ' part needs a vertical to create sub-zones.']);
          }
          return;
        }
        if (st.cell < 0 || st.cell >= list.length) st.cell = outerIdx(list);
        var c = list[st.cell], sp = span(c.z);
        var sib = S.hs.filter(function (o) { return o.zone === st.zone && o.cell === st.cell; });
        var ord = sib.indexOf(st) + 1, cnt = sib.length;
        var base = sp.y0 + (sp.y1 - sp.y0) * ord / (cnt + 1);
        var lo = sp.y0 + 40, hi = sp.y1 - 40;
        var yy = Math.max(lo, Math.min(hi, (st.y != null) ? st.y : base));
        add({ role: 'halfshelf', w: c.w, h: t, d: SD, x: c.x, y: yy, z: zS,
              tag: (st.zone === 'U' ? 'UPPER' : 'LOWER') + ' HALF SHELF · ' + c.z + c.id,
              move: 'hs', key: String(j), lo: lo, hi: hi });
        hsRecs.push({ zone: c.z, y: yy, x: c.x, w: c.w });
      });

      if (p.locker > 0) {
        locker(add, notes, p,
          shelfRecs.concat(hsRecs).filter(function (r) { return r.zone === 'L'; }),
          Z.L.y1, SD, zBack, colW, 'the lower part');
      }

      /* ── two hinged doors, pivoting at the outer edge ── */
      var dw = (IW + 2 * t) / 2, dh = H - p.skirt - 4;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      [[-1, 'DOOR 1'], [1, 'DOOR 2']].forEach(function (s) {
        var sgn = s[0];
        add({ role: 'door', w: dw, h: dh, d: 18, x: -sgn * dw / 2, y: 0, z: 9, tag: s[1],
              pivot: { x: sgn * (W / 2), y: p.skirt + dh / 2, z: D / 2, ry: sgn * ang } });
        add({ role: 'knob', shape: 'cyl-z', w: 24, h: 24, d: 26, x: -sgn * (dw - 70), y: 0, z: 24,
              pivot: { x: sgn * (W / 2), y: p.skirt + dh / 2, z: D / 2, ry: sgn * ang } });
      });

      return {
        parts: parts, notes: notes,
        callouts: callouts(p, W, H, D / 2),
        zones: Z, vN: vN, CM: CM, rows: rows,
        geo: { IW: IW, IH: IH, colW: colW, slotW: slotW, hang: hang, stackH: stackH,
               SD: SD, uH: upTop - upBot, lH: lTop - lBot, yB: yB, yT: yT },
        hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · depth <b>' +
             Math.round(SD) + '</b><br>upper <b>' + Math.round(upTop - upBot) +
             '</b> · drawers <b>' + Math.round(stackH) + '</b> · lower <b>' +
             Math.round(lTop - lBot) + '</b>'
      };
    },

    lateral: function (S, dir, u, res) {
      // one column: the big drawer has nowhere sideways to go
      if (u.move === 'hs' && u.key != null) {
        var st = S.hs && S.hs[+u.key]; if (!st) return false;
        var list = res.vN[st.zone] > 0 ? res.CM[st.zone] : [];
        if (!list.length) return false;
        st.cell = (st.cell + (dir > 0 ? 1 : list.length - 1)) % list.length;
        st.y = null;
        return true;
      }
      return false;
    },

    // One step up or down from the hover widget. Shelves and half shelves nudge
    // in 25mm; a big drawer jumps a whole row in its OWN column, which is the
    // only movement that keeps the band height fixed.
    vstep: function (S, dir, u) {
      var NUDGE = 25;
      if (u.move === 'sh') {
        var cur = (S.shY[u.key] != null) ? S.shY[u.key] : (u.lo + u.hi) / 2;
        var nv = Math.max(u.lo, Math.min(u.hi, cur + dir * NUDGE));
        if (nv === S.shY[u.key]) return false;
        S.shY[u.key] = nv; return true;
      }
      if (u.move === 'hs') {
        var st = S.hs && S.hs[+u.key]; if (!st) return false;
        var c2 = (st.y != null) ? st.y : (u.lo + u.hi) / 2;
        var n2 = Math.max(u.lo, Math.min(u.hi, c2 + dir * NUDGE));
        if (n2 === st.y) return false;
        st.y = n2; return true;
      }
      if (u.move === 'bd') {
        var rows = (u.lineYs || []).length; if (rows < 2) return false;
        // row 0 is the top of the band, so "up" is one index lower
        var want = Math.max(0, Math.min(rows - 1, (S.bdRow || 0) - dir));
        if (want === S.bdRow) return false;
        S.bdRow = want; return true;
      }
      return false;
    },

    drag: function (S, d, y) {
      if (d.move === 'sh') { S.shY[d.key] = Math.max(d.lo, Math.min(d.hi, y)); return true; }
      if (d.move === 'hs') {
        var st = S.hs && S.hs[+d.key]; if (!st) return false;
        st.y = Math.max(d.lo, Math.min(d.hi, y)); return true;
      }
      if (d.move === 'bd') {
        var LY = d.lineYs || []; if (!LY.length) return false;
        var bi = 0, bmin = 1e12;
        LY.forEach(function (v, i) { var dd = Math.abs(v - y); if (dd < bmin) { bmin = dd; bi = i; } });
        if (bi === S.bdRow) return false;
        S.bdRow = bi; return true;
      }
      return false;
    }
  });
})();