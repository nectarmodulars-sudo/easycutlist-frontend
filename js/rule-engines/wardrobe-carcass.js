/* rule-engines/wardrobe-carcass.js — the two carcass shapes, shared.
   Extends window.ASM3D_WB with:
     quarters(p, S, cfg)  two columns + a centre partition → Q1..Q4
                          (sliding wardrobe, 4-door wardrobe)
     column(p, S, cfg)    one column → an upper and a lower zone
                          (2-door wardrobe, and the 1-door later)
   cfg = { doors: fn(add, p, g), nDoors, front: fn|null }
   Loaded after wardrobe-common.js and before the engine file. */
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* ════════════════════════════════════════════════════════════════════
     Two columns: Q1 | Q2 above, drawer band, Q3 | Q4 below
     ════════════════════════════════════════════════════════════════════ */
  WB.quarters = function (p, S, cfg) {
    var notes = [], parts = [], t = p.ply;
    function add(o) { parts.push(o); }
    var W = p.W, H = p.H, D = p.D;
    var IW = W - 2 * t, yB = p.skirt + t, yT = H - t, IH = yT - yB;
    var backT = p.backT, zBack = -D / 2 + backT;
    // Interior depth is the engine's to state, because the sheet gives each
    // wardrobe its own: a sliding wardrobe loses 120 to the door tracks, an
    // openable one loses 50. Guessing it put every shelf at the wrong depth.
    var SD = Math.max(150, cfg.SD ? cfg.SD(p) : D - p.reveal - backT), zS = zBack + SD / 2;
    var partD = Math.max(150, cfg.partD ? cfg.partD(p) : SD);
    var colW = (IW - t) / 2, Lx = -(t / 2 + colW / 2), Rx = (t / 2 + colW / 2);
    var slotW = (colW - 4 * t) / 2;          // double channel filler each side
    var slotOff = [-slotW / 2, slotW / 2];

    /* ── drawer band ── */
    var L = WB.layout(p, S, true);
    var dlH = L.bandH;

    /* ── bands. The upper vertical is 950 tall in the sheet, so the hanger
          space is what sets the line between the upper and lower quarters. ── */
    var hang = Math.max(300, Math.min(p.hang, IH - t - dlH - 250));
    var upTop = yT, upBot = yT - hang, divBot = upBot - t, dlTop = divBot;
    var totL = L.total(L.cols.L), totR = L.total(L.cols.R);
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
    var KEYS = ['q1', 'q2', 'q3', 'q4'];

    /* ── verticals ── */
    var uvM = WB.alloc(p.uv, 'q1', 'q2', S.uvQ || 'q1');
    var lvM = WB.alloc(p.lv, 'q3', 'q4', S.lvQ || 'q3');
    /* A lower vertical MAY stand under a big drawer. It does not carry the
       drawer, so a fixed shelf goes in between — one shelf per quarter where
       this happens, taken off the fixed-shelf count. The quarter loses that
       shelf's thickness off its top, which is why the vertical's height needs
       checking; the part says so itself when it is selected. Move the vertical
       to a quarter with no big drawer over it and it is an ordinary vertical
       again, with no shelf and no note. */
    var busy = { q3: L.bigCols.L, q4: L.bigCols.R };
    var lvShelfQ = ['q3', 'q4'].filter(function (q) { return lvM[q] > 0 && busy[q]; });
    lvShelfQ.forEach(function (q) { Q[q].y1 -= t; });
    var LV_NOTE = 'Please check this lower vertical ht — a fix shelf will be used here.';
    // Rule 3: more than 2 in a band splits a quarter in three.
    if (p.uv > 2 || p.lv > 2) notes.push(['warn', 'Please check half shelf sizes.']);
    var vM = { q1: uvM.q1, q2: uvM.q2, q3: lvM.q3, q4: lvM.q4 };

    function cells(q) {
      var n = vM[q], Qd = Q[q], cw = (Qd.w - n * t) / (n + 1), a = [];
      for (var i = 0; i <= n; i++)
        a.push({ q: q, x: Qd.x - Qd.w / 2 + cw / 2 + i * (cw + t), w: cw, id: 'abc'.charAt(i) });
      return a;
    }
    var CM = { q1: cells('q1'), q2: cells('q2'), q3: cells('q3'), q4: cells('q4') };

    /* ── shell, back, centre partition ── */
    WB.shell(add, p, IW, cfg.carcD ? cfg.carcD(p) : 0);
    var bw = (IW + 16) / 2;
    add({ role: 'back', w: bw - 4, h: IH + 16, d: backT, x: -bw / 2, y: yB + (IH + 16) / 2 - 8, z: zBack - backT / 2 });
    add({ role: 'back', w: bw - 4, h: IH + 16, d: backT, x: bw / 2, y: yB + (IH + 16) / 2 - 8, z: zBack - backT / 2 });
    add({ role: 'partition', w: t, h: IH, d: partD, x: 0, y: yB + IH / 2,
          z: zBack + partD / 2, tag: 'CENTRE PARTITION (CP)' });

    /* ── fixed shelves ──
       One per column caps the drawer line. That is both "2 fixed shelves appear
       above the drawer line" and "a group of 2 small drawers has a fixed shelf
       sitting on them", because the group sits directly under it. It is pinned
       to the LINE, not to a drawer row, so reordering the drawers slides them
       under a shelf that does not move. The rest go loose in a quarter. */
    var fix = Math.max(0, p.fix);
    // A vertical under a big drawer needs its shelf before anything else does.
    var lvShelf = lvShelfQ.length;
    lvShelfQ.forEach(function (q) {
      add({ role: 'shelf', w: Q[q].w, h: t, d: SD, x: Q[q].x, y: Q[q].y1 + t / 2, z: zS,
            tag: 'FIX SHELF · under the big drawer · ' + q.toUpperCase() });
    });
    var aboveLine = Math.min(Math.max(0, fix - lvShelf), 2);
    var loose = Math.max(0, fix - lvShelf - aboveLine);
    if (lvShelf > fix)
      notes.push(['warn', 'A lower vertical stands under a big drawer, so ' + lvShelf +
        ' fixed shelf' + (lvShelf > 1 ? 'ves are' : ' is') + ' needed there, but FIX SHELF is ' +
        fix + '. Raise it or the cut list will be short.']);
    [Lx, Rx].forEach(function (cx, i) {
      if (i >= aboveLine) return;
      add({ role: 'shelf', w: colW, h: t, d: SD, x: cx, y: divBot + t / 2, z: zS,
            tag: 'FIX SHELF · drawer line · ' + (i === 0 ? 'LEFT' : 'RIGHT') });
    });

    ['q1', 'q2'].forEach(function (q) {
      if (vM[q] === 0)
        add({ role: 'rod', shape: 'cyl-x', w: colW - 40, h: 26, d: 26, x: Q[q].x,
              y: upTop - 90, z: zS, tag: 'HANGING ROD' });
    });

    // Only the odd one out can swap quarters: with 2 or 4 both quarters
    // already hold the same number and there is nowhere to go.
    var uvSwap = (p.uv === 1 || p.uv === 3), lvSwap = (p.lv === 1 || p.lv === 3);
    KEYS.forEach(function (q) {
      var n = vM[q]; if (!n) return;
      var Qd = Q[q], cw = (Qd.w - n * t) / (n + 1), h = Qd.y1 - Qd.y0;
      var up = (Qd.band === 'upper'), swap = up ? uvSwap : lvSwap;
      for (var i = 1; i <= n; i++) {
        var rec = { role: 'vertical', w: t, h: h, d: SD,
                    x: Qd.x - Qd.w / 2 + i * (cw + t) - t / 2, y: Qd.y0 + h / 2, z: zS,
                    tag: (up ? 'UPPER' : 'LOWER') + ' VERTICAL · ' + q.toUpperCase() +
                         ' (' + Math.round(h) + ')' };
        if (swap && i === n) { rec.move = up ? 'uv' : 'lv'; rec.key = q; rec.noV = true; }
        if (!up && lvShelfQ.indexOf(q) >= 0) rec.note = LV_NOTE;
        add(rec);
      }
    });

    /* ── the band itself ── */
    var dz = D / 2 - p.reveal - t / 2;
    var rowsOf = {};
    ['L', 'R'].forEach(function (cK) {
      var cx = (cK === 'L') ? Lx : Rx;
      rowsOf[cK] = WB.drawBand(add, p, L, cK, cx, colW, slotOff, [0, 1], dlTop, SD, zS, dz);
    });
    // Each big drawer's snap lines are the rows of ITS OWN column, and its row
    // index is where it actually ended up — not a single shared one.
    ['L', 'R'].forEach(function (cK) {
      L.cols[cK].forEach(function (r, i) {
        if (r.type !== 'big') return;
        parts.forEach(function (pt) {
          if (pt.move === 'bd' && String(pt.key) === 'bd|' + r.bid + '|' + cK) {
            pt.lineYs = rowsOf[cK]; pt.row = i;
          }
        });
      });
    });

    /* ── loose fixed shelves and removable shelves ── */
    function zoneOf(q) { return { y0: Q[q].y0, y1: Q[q].y1, x: Q[q].x, w: Q[q].w, SD: SD, zS: zS }; }
    var open = KEYS.filter(function (q) { return vM[q] === 0; });
    var fixRecs = WB.place(add, S, p, 'sh', loose, open.length ? open : KEYS, zoneOf, KEYS);
    var remRecs = WB.place(add, S, p, 'rs', Math.max(0, p.rem), open, zoneOf, open);
    if (p.rem > 0 && !open.length)
      notes.push(['warn', 'Every quarter holds a vertical, so the removable shelves have nowhere to rest.']);

    /* ── half shelves ── */
    function bandOf(b) { return (b === 'upper') ? ['q1', 'q2'] : ['q3', 'q4']; }
    /* Where a half shelf of this band may sit.
       A vertical anywhere in the band → only the bays of the quarters that HAVE
       one: that is the rule, one quarter has a vertical so the half shelf stays
       in that quarter, both have one so it may jump.
       No vertical in the band at all → the half shelf still exists (the sheet
       cuts it at (IW-ply)/2 whatever the vertical count), so each quarter
       offers its left and right half. */
    function bandCells(b) {
      var qs = bandOf(b), out = [];
      var any = qs.some(function (q) { return vM[q] > 0; });
      qs.forEach(function (q) {
        if (any) { if (vM[q] > 0) CM[q].forEach(function (x) { out.push(x); }); return; }
        var Qd = Q[q], hw = (Qd.w - t) / 2;
        out.push({ q: q, x: Qd.x - Qd.w / 2 + hw / 2, w: hw, id: 'left half' });
        out.push({ q: q, x: Qd.x + Qd.w / 2 - hw / 2, w: hw, id: 'right half' });
      });
      return out;
    }
    var HS = { upper: bandCells('upper'), lower: bandCells('lower') };
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
    // Every half shelf picks its cell BEFORE any of them is placed. Done inside
    // the placement loop, shelf 1 counted only the shelves already assigned and
    // the spacing came out lopsided on the first render.
    S.hs.forEach(function (st) {
      var L2 = HS[st.band];
      if (L2.length && (st.cell < 0 || st.cell >= L2.length)) st.cell = WB.outerIdx(L2);
    });
    var hsRecs = [];
    S.hs.forEach(function (st, j) {
      var list = HS[st.band];
      if (!list.length) return;
      if (st.cell < 0 || st.cell >= list.length) st.cell = WB.outerIdx(list);
      var c = list[st.cell], z = Q[c.q];
      var sib = S.hs.filter(function (o) { return o.band === st.band && o.cell === st.cell; });
      var lo = z.y0 + 40, hi = z.y1 - 40;
      var base = z.y0 + (z.y1 - z.y0) * (sib.indexOf(st) + 1) / (sib.length + 1);
      var yy = WB.clampY(lo, hi, st.y, base);
      var dep = Math.max(100, SD - p.push);
      add({ role: 'halfshelf', w: c.w, h: t, d: dep, x: c.x, y: yy, z: zS - (SD - dep) / 2,
            tag: (st.band === 'upper' ? 'UPPER' : 'LOWER') + ' HALF SHELF · ' +
                 c.q.toUpperCase() + ' ' + c.id, move: 'hs', key: String(j), lo: lo, hi: hi });
      hsRecs.push({ zone: c.q, y: yy, x: c.x, w: c.w });
    });

    /* ── locker ── */
    if (p.locker > 0) {
      var all = fixRecs.concat(remRecs, hsRecs);
      var order = (S.lkQ === 'q4') ? ['q4', 'q3'] : ['q3', 'q4'], lq = order[0];
      for (var li = 0; li < order.length; li++)
        if (all.some(function (r) { return r.zone === order[li]; })) { lq = order[li]; break; }
      WB.locker(add, notes, p, all.filter(function (r) { return r.zone === lq; }),
                Q[lq].y1, SD, zBack, colW, lq.toUpperCase());
    }

    /* ── doors, supplied by the engine ── */
    cfg.doors(add, p, { IW: IW, IH: IH, colW: colW, yB: yB, yT: yT, Lx: Lx, Rx: Rx, SD: SD, zS: zS });

    return {
      parts: parts, notes: notes,
      callouts: WB.callouts(p, W, H, D / 2, cfg.nDoors),
      zones: Q, zoneKeys: KEYS, vM: vM, CM: CM, HS: HS, cols: L.cols, twoCol: true, bandOf: bandOf,
      geo: { IW: IW, IH: IH, colW: colW, slotW: slotW, hang: hang, dlH: dlH, SD: SD,
             yB: yB, yT: yT, upBot: upBot, divBot: divBot, q3Top: q3Top, q4Top: q4Top },
      hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · depth <b>' +
           Math.round(SD) + '</b><br>column <b>' + Math.round(colW) + '</b> · slot <b>' +
           Math.round(slotW) + '</b> · band <b>' + Math.round(dlH) + '</b><br>fix <b>' +
           aboveLine + '</b> on the drawer line · <b>' + loose + '</b> loose · removable <b>' +
           Math.max(0, p.rem) + '</b>'
    };
  };

  /* ════════════════════════════════════════════════════════════════════
     One column: upper zone, drawer band, lower zone. Q1/Q2 and Q3/Q4 have
     no meaning here, so the zones are U and L and nothing jumps sideways.
     ════════════════════════════════════════════════════════════════════ */
  WB.column = function (p, S, cfg) {
    var notes = [], parts = [], t = p.ply;
    function add(o) { parts.push(o); }
    var W = p.W, H = p.H, D = p.D;
    /* cfg.base raises the carcass floor — what a bank of drawers under the
       doors does. Everything inside is measured from it, so the zones, the
       back and the doors follow without a special case anywhere else. */
    var base = cfg.base ? cfg.base(p) : 0;
    var IW = W - 2 * t, yB = p.skirt + t + base, yT = H - t, IH = yT - yB;
    var backT = p.backT, zBack = -D / 2 + backT;
    var SD = Math.max(150, cfg.SD ? cfg.SD(p) : D - backT - 24), zS = zBack + SD / 2;
    var colW = IW, slotW = (colW - 4 * t) / 2;   // double channel filler each side
    var slotOff = [-slotW / 2, slotW / 2];

    var L = WB.layout(p, S, false);
    var stackH = L.bandH;
    // cfg.hang: the upper band stated by the sheet (an upper vertical cut to
    // a given height) rather than taken from the hanger-space input.
    var hWant = (cfg.hang ? cfg.hang(p) : 0) || p.hang;
    var hang = Math.max(250, Math.min(hWant, IH - t - stackH - 200));
    var upTop = yT, upBot = yT - hang, divBot = upBot - t, dlTop = divBot;
    var lTop = dlTop - stackH, lBot = yB;
    if (lTop - lBot < 120)
      notes.push(['warn', 'Lower part is very short — reduce drawers or the hanger space.']);

    var Z = { U: { x: 0, y0: upBot, y1: upTop, w: colW, band: 'upper' },
              L: { x: 0, y0: lBot, y1: lTop, w: colW, band: 'lower' } };
    var KEYS = ['U', 'L'];

    // No big-drawer conflict here, unlike the two-column carcass: with one
    // column the lower zone sits BELOW the drawer band, not beside it, so a
    // lower vertical and a big drawer never occupy the same space.
    var uvN = Math.max(0, p.uv), lvN = Math.max(0, p.lv);
    if (uvN > 2 || lvN > 2) notes.push(['warn', 'Please check half shelf sizes.']);
    var vM = { U: uvN, L: lvN };

    function cells(z) {
      var n = vM[z], cw = (colW - n * t) / (n + 1), a = [];
      for (var i = 0; i <= n; i++)
        a.push({ q: z, x: -colW / 2 + cw / 2 + i * (cw + t), w: cw, id: 'abc'.charAt(i) });
      return a;
    }
    var CM = { U: cells('U'), L: cells('L') };

    WB.shell(add, p, IW, cfg.carcD ? cfg.carcD(p) : 0, base);
    add({ role: 'back', w: IW + 12, h: IH + 12, d: backT, x: 0, y: yB + (IH + 12) / 2 - 6, z: zBack - backT / 2 });

    // One column, so one shelf caps the drawer line. Pinned to the line, not
    // to a drawer row: the rows reorder underneath it and it does not move.
    var fix = Math.max(0, p.fix);
    var aboveLine = Math.min(fix, 1);
    var loose = Math.max(0, fix - aboveLine);
    if (aboveLine)
      add({ role: 'shelf', w: IW, h: t, d: SD, x: 0, y: divBot + t / 2, z: zS,
            tag: 'FIX SHELF · drawer line' });
    if (vM.U === 0)
      add({ role: 'rod', shape: 'cyl-x', w: colW - 40, h: 26, d: 26, x: 0, y: upTop - 90, z: zS, tag: 'HANGING ROD' });

    KEYS.forEach(function (z) {
      var n = vM[z]; if (!n) return;
      var Zd = Z[z], cw = (colW - n * t) / (n + 1), h = Zd.y1 - Zd.y0;
      for (var i = 1; i <= n; i++)
        add({ role: 'vertical', w: t, h: h, d: SD, x: -colW / 2 + i * (cw + t) - t / 2,
              y: Zd.y0 + h / 2, z: zS, noV: true,
              tag: (z === 'U' ? 'UPPER' : 'LOWER') + ' VERTICAL (' + Math.round(h) + ')' });
    });

    var dz = D / 2 - t / 2 - 12;
    var rowYs = WB.drawBand(add, p, L, 'L', 0, colW, slotOff, [0, 1], dlTop, SD, zS, dz);
    L.cols.L.forEach(function (r, i) {
      if (r.type !== 'big') return;
      parts.forEach(function (pt) {
        if (pt.move === 'bd' && String(pt.key) === 'bd|' + r.bid + '|L') {
          pt.lineYs = rowYs; pt.row = i;
        }
      });
    });

    function zoneOf(z) { return { y0: Z[z].y0, y1: Z[z].y1, x: 0, w: colW, SD: SD, zS: zS }; }
    var open = KEYS.filter(function (z) { return vM[z] === 0; });
    var fixRecs = WB.place(add, S, p, 'sh', loose, open.length ? open : KEYS, zoneOf, KEYS);
    var remRecs = WB.place(add, S, p, 'rs', Math.max(0, p.rem), open, zoneOf, open);
    if (p.rem > 0 && !open.length)
      notes.push(['warn', 'Both zones hold a vertical, so the removable shelves have nowhere to rest.']);

    function bandOf(b) { return (b === 'upper') ? ['U'] : ['L']; }
    // Same rule as the two-column carcass: the vertical's bays when there is
    // one, otherwise the two halves of the zone, because a half shelf is half
    // the width whether or not a vertical exists.
    function bandCells(b) {
      var zk = bandOf(b)[0];
      if (vM[zk] > 0) return CM[zk];
      var hw = (colW - t) / 2;
      return [{ q: zk, x: -colW / 2 + hw / 2, w: hw, id: 'left half' },
              { q: zk, x: colW / 2 - hw / 2, w: hw, id: 'right half' }];
    }
    var HS = { upper: bandCells('upper'), lower: bandCells('lower') };
    var uhsN = p.uhs, lhsN = p.lhs;
    if (!uhsN && !lhsN && p.hsAll > 0) { uhsN = Math.ceil(p.hsAll / 2); lhsN = p.hsAll - uhsN; }
    var hsKey = uhsN + '/' + lhsN;
    if (S.hs === null || S.hsKey !== hsKey) {
      S.hs = []; S.hsKey = hsKey;
      for (var b1 = 0; b1 < uhsN; b1++) S.hs.push({ band: 'upper', cell: -1, y: null });
      for (var b2 = 0; b2 < lhsN; b2++) S.hs.push({ band: 'lower', cell: -1, y: null });
    }
    // Every half shelf picks its cell BEFORE any of them is placed. Done inside
    // the placement loop, shelf 1 counted only the shelves already assigned and
    // the spacing came out lopsided on the first render.
    S.hs.forEach(function (st) {
      var L2 = HS[st.band];
      if (L2.length && (st.cell < 0 || st.cell >= L2.length)) st.cell = WB.outerIdx(L2);
    });
    var hsRecs = [];
    S.hs.forEach(function (st, j) {
      var zk = bandOf(st.band)[0], list = HS[st.band];
      if (!list.length) return;
      if (st.cell < 0 || st.cell >= list.length) st.cell = WB.outerIdx(list);
      var c = list[st.cell], z = Z[zk];
      var sib = S.hs.filter(function (o) { return o.band === st.band && o.cell === st.cell; });
      var lo = z.y0 + 40, hi = z.y1 - 40;
      var base = z.y0 + (z.y1 - z.y0) * (sib.indexOf(st) + 1) / (sib.length + 1);
      var yy = WB.clampY(lo, hi, st.y, base);
      var dep = Math.max(100, SD - p.push);
      add({ role: 'halfshelf', w: c.w, h: t, d: dep, x: c.x, y: yy, z: zS - (SD - dep) / 2,
            tag: (st.band === 'upper' ? 'UPPER' : 'LOWER') + ' HALF SHELF · ' + zk + ' ' + c.id,
            move: 'hs', key: String(j), lo: lo, hi: hi });
      hsRecs.push({ zone: zk, y: yy, x: c.x, w: c.w });
    });

    if (p.locker > 0)
      WB.locker(add, notes, p, fixRecs.concat(remRecs, hsRecs).filter(function (r) { return r.zone === 'L'; }),
                Z.L.y1, SD, zBack, colW, 'the lower part');

    cfg.doors(add, p, { IW: IW, IH: IH, colW: colW, yB: yB, yT: yT, SD: SD, zS: zS });

    return {
      parts: parts, notes: notes,
      callouts: WB.callouts(p, W, H, D / 2, cfg.nDoors),
      zones: Z, zoneKeys: KEYS, vM: vM, CM: CM, HS: HS, cols: L.cols, twoCol: false, bandOf: bandOf,
      geo: { IW: IW, IH: IH, colW: colW, slotW: slotW, hang: hang, dlH: stackH, SD: SD,
             yB: yB, yT: yT, base: base, uH: upTop - upBot, lH: lTop - lBot },
      hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · depth <b>' +
           Math.round(SD) + '</b><br>upper <b>' + Math.round(upTop - upBot) + '</b> · drawers <b>' +
           Math.round(stackH) + '</b> · lower <b>' + Math.round(lTop - lBot) + '</b><br>fix <b>' +
           aboveLine + '</b> on the drawer line · <b>' + loose + '</b> loose · removable <b>' +
           Math.max(0, p.rem) + '</b>'
    };
  };
})();
