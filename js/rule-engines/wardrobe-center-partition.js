/* rule-engines/wardrobe-center-partition.js — 2 door open-centre partition
   wardrobe. Rule code: cp2d.

   The shape of this item, as the drawing gives it:

     FULL-WIDTH LEVELS run the whole interior — the full shelves and the big
     drawers. They stack, they drag, and the right-click menu reorders them.

     THE PARTITION rests on them. Its lower end sits on a full shelf, a big
     drawer or the carcass bottom; its upper end meets a full shelf or the
     carcass top. So it never floats: it fills one GAP between two full-width
     levels, and selecting it offers every gap it could move to. Move a full
     shelf and the partition moves with it, which is how "a full shelf above
     the partition moves below it".

     THE COLUMNS exist only inside that gap. Half shelves, the small drawers
     and the locker are levels within their own column and cannot cross the
     partition or leave the gap.

   From the sheet (A572:H654):
     Vertical partition  (Partial ? vertical_partition_ht : h-2ply-skirting) x d-50
     Fix shelf           IW x d-50                      <- full width
     Half shelf          (IW-ply)/2 x (d-50)-push       <- one column
     Small drawer facia  colW-2ply-4 x drawer_ht          filler qty x2, one per side
     Big drawer facia    IW-4ply-4 x big_drawer_ht        filler qty x4, two per side
     Locker door         colW-50-4 x locker_door_ht-4
     Locker filler       50 x locker_door_ht            <- a FRONT strip beside the door
*/
(function () {
  'use strict';
  var WB = window.ASM3D_WB;

  /* A level reorders only inside its own zone, which its key names:
       W     the full-width stack — full shelves and big drawers
       L, R  the two columns, which live inside the partition's gap */
  function recOf(u, res) {
    var lv = res.LV || [];
    for (var i = 0; i < lv.length; i++)
      if (String(lv[i].key) === String(u.key)) return lv[i];
    return null;
  }
  function zoneOf(u, res, col) {
    var rec = recOf(u, res);
    var z = col || (rec ? rec.col : 'W');
    var w = (z === 'W');
    return { LV: (res.LV || []).filter(function (e) { return e.col === z; }),
             floor: w ? res.wFloor : res.floor,
             ceil: w ? res.wCeil : res.ceil };
  }

  /* ── where the partition sits in the full-width stack ──────────────────
     Three arrangements, and they are really three answers to one question:
     where does the LEFTOVER full-width space go?

       top   partition's top on the carcass top, one full shelf under it,
             everything else packed on the base — leftover in the middle.
       bot   partition flush on the base, one full shelf over it, everything
             else packed under the carcass top. Impossible with a big drawer,
             which owns the base.
       mid   partition centred, a full shelf under AND over it, drawers packed
             on the base and any extra shelves under the top — leftover split.

     `put` is the only difference between using this for the DEFAULT layout
     (writes e.def, so the user's own positions still win) and for the
     right-click presets (writes S.shY, which is the user's position). */
  function fwArrange(S, g, floor, ceil, mode, put) {
    var vp = g.vp, sh = g.sh, dr = g.dr, y;
    if (!vp) return false;
    if (mode !== 'none' && !sh.length) return false;
    if (mode === 'mid' && sh.length < 2) return false;
    if (mode === 'bot' && dr.length) return false;
    /* The partition and the shelf or shelves that BOUND it are anchored: they
       are meant to be flush against it, so the shelf-spreading pass must not
       float them off it. Only the extra shelves are free to spread. */
    S.pin = S.pin || {};
    // this arrangement decides the anchors, so the previous one's are cleared
    sh.forEach(function (e) { delete S.pin[e.key]; });
    S.pin[vp.key] = 1;
    if (sh[0]) S.pin[sh[0].key] = 1;
    if (mode === 'mid' && sh[1]) S.pin[sh[1].key] = 1;

    if (mode === 'top') {
      put(vp, ceil - vp.h / 2);
      put(sh[0], ceil - vp.h - sh[0].h / 2);
      y = floor;
      dr.concat(sh.slice(1)).forEach(function (e) { put(e, y + e.h / 2); y += e.h; });
    } else if (mode === 'bot') {
      put(vp, floor + vp.h / 2);
      put(sh[0], floor + vp.h + sh[0].h / 2);
      y = ceil;
      sh.slice(1).reverse().forEach(function (e) { put(e, y - e.h / 2); y -= e.h; });
    } else if (mode === 'mid') {
      var c = (floor + ceil) / 2;
      put(vp, c);
      put(sh[0], c - vp.h / 2 - sh[0].h / 2);
      put(sh[1], c + vp.h / 2 + sh[1].h / 2);
      y = floor;
      dr.forEach(function (e) { put(e, y + e.h / 2); y += e.h; });
      y = ceil;
      sh.slice(2).reverse().forEach(function (e) { put(e, y - e.h / 2); y -= e.h; });
    } else {                                   // no full shelf at all
      y = floor;
      dr.forEach(function (e) { put(e, y + e.h / 2); y += e.h; });
      put(vp, y + vp.h / 2);
    }
    return true;
  }

  /* the full-width pieces, split by kind and in cut order */
  function fwGroups(list) {
    function byN(a, b) { return (a.n || 0) - (b.n || 0); }
    return { vp: list.filter(function (e) { return e.kind === 'vp'; })[0],
             sh: list.filter(function (e) { return e.kind === 'shelf'; }).sort(byN),
             dr: list.filter(function (e) { return e.kind === 'drawer'; }).sort(byN) };
  }

  var VP_MODES = [
    { id: 'top', label: 'Partition at the TOP \u2014 full shelf under it, space at the base' },
    { id: 'mid', label: 'Partition in the CENTRE \u2014 a full shelf under and over it' },
    { id: 'bot', label: 'Partition at the BOTTOM \u2014 flush on the base, full shelf over it' }
  ];

  window.ASM3D.register('cp2d', {
    label: '2-Door Open-Centre Partition Wardrobe',
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
      var notes = [], parts = [], t = p.ply;
      function add(o) { parts.push(o); }
      var W = p.W, H = p.H, D = p.D;
      var IW = W - 2 * t, yB = p.skirt + t, yT = H - t, IH = yT - yB;
      var backT = p.backT, zBack = -D / 2 + backT;
      var SD = Math.max(150, D - 50), zS = zBack + SD / 2;
      var remD = Math.max(100, SD - p.push);
      var colW = (IW - t) / 2, Lx = -(t / 2 + colW / 2), Rx = (t / 2 + colW / 2);
      var dzF = D / 2 - t / 2;
      var slide = WB.slideOf(p, SD);

      WB.shell(add, p, IW, D - t - 2);
      add({ role: 'back', w: IW + 12, h: IH + 12, d: backT, x: 0,
            y: yB + (IH + 12) / 2 - 6, z: zBack - backT / 2 });

      var partial = /^p/i.test(String(p.vpMode || ''));
      var nFull = Math.max(0, p.fix), nBig = Math.max(0, p.bdq), bh = p.bdh;
      var bfw = IW - 4 * t - 4;
      var LV = [];

      /* ── the full-width stack ──
         The big drawers, the full shelves AND THE PARTITION are all levels in
         one stack. The partition being a level is the whole point: levels are
         clamped against each other, so its ends always rest on the thing below
         and meet the thing above, and nothing can be dragged into it. When it
         was merely placed in a gap, dragging a big drawer upward moved the
         drawer straight through the columns.
         Default order from the floor: big drawers, a full shelf, the
         partition, a full shelf, then any further shelves. */
      var vpH = partial ? Math.max(100, p.vpH) : IH;
      /* A Full partition runs floor to ceiling, so NOTHING full width can
         exist beside it — not a full shelf, not a big drawer, both of which the
         sheet cuts at the full interior width. Drawing them anyway piled them
         into the same space as the columns, which is the "why are they
         merging" at the foot of the wardrobe. They are left out, and said so. */
      if (!partial && (nFull > 0 || nBig > 0)) {
        notes.push(['err', 'VERTICAL PARTITION is Full — floor to ceiling — so the ' +
          (nFull ? nFull + ' full shelf' + (nFull === 1 ? '' : 'ves') : '') +
          (nFull && nBig ? ' and ' : '') +
          (nBig ? nBig + ' big drawer' + (nBig === 1 ? '' : 's') : '') +
          ' cannot fit beside it: both are cut at the full interior width. They are ' +
          'not drawn. Set VERTICAL PARTITION to Partial.']);
        nFull = 0; nBig = 0;
      }
      var fw = [], i;
      for (i = 0; i < nBig; i++)
        fw.push({ key: 'W|bd|' + i, kind: 'drawer', h: bh, n: i + 1, col: 'W', def: yB });
      for (i = 0; i < nFull; i++)
        fw.push({ key: 'W|fs|' + i, kind: 'shelf', h: t, n: i + 1, col: 'W', def: yB });
      fw.push({ key: 'W|vp', kind: 'vp', h: vpH, col: 'W', def: yB });
      /* Default: one full shelf puts the partition at the top, two or more
         centre it — which is what the three sketched cases say. This runs ONLY
         on a stack nothing has been placed in yet; re-running it on every solve
         re-anchored the shelves of the default arrangement and quietly undid
         the position the user had picked from the menu. */
      S.shY = S.shY || {};
      var virgin = fw.every(function (e) { return S.shY[e.key] == null; });
      if (virgin)
        fwArrange(S, fwGroups(fw), yB, yT,
                  nFull >= 2 ? 'mid' : nFull === 1 ? 'top' : 'none',
                  function (e, v) { e.def = v; });
      WB.layoutLevels(S, fw, yB, yT);
      if (fw.over > 1)
        notes.push(['err', 'The partition, full shelves and big drawers need ' +
          Math.round(IH + fw.over) + ' and the interior is ' + Math.round(IH) +
          '. Reduce VERTICAL PARTITION HT, FULL SHELF or BIG DRAWER.']);
      fw.forEach(function (e) { LV.push(e); });

      var vp = fw.filter(function (e) { return e.kind === 'vp'; })[0];
      var pBot = vp.y - vp.h / 2, pTop = vp.y + vp.h / 2;
      var ix = fw.indexOf(vp), under = fw[ix - 1], over = fw[ix + 1];
      function nm(e, d) {
        return e ? (e.kind === 'drawer' ? 'big drawer ' + e.n : 'full shelf ' + e.n) : d;
      }
      if (Math.round(pTop - pBot) !== Math.round(vpH))
        notes.push(['warn', 'VERTICAL PARTITION HT is ' + Math.round(vpH) + ' but only ' +
          Math.round(pTop - pBot) + ' is free. Reduce FULL SHELF or BIG DRAWER.']);

      add({ role: 'partition', w: t, h: pTop - pBot, d: SD, x: 0, y: vp.y, z: zS,
            tag: 'CENTRE PARTITION \u00b7 ' + (partial ? 'partial' : 'full') +
                 ' (' + Math.round(pTop - pBot) + ')',
            move: 'sh', key: vp.key, lo: vp.lo, hi: vp.hi, noV: !partial,
            note: 'Rests on ' + nm(under, 'the carcass bottom') + ', meets ' +
                  nm(over, 'the carcass top') +
                  '. Right-click for the three partition positions: top, centre, bottom.' });

      /* ── draw the full-width stack ── */
      fw.forEach(function (e) {
        if (e.kind === 'vp') return;        // the partition is drawn above
        if (e.kind === 'drawer') {
          for (var ff = 0; ff < 2; ff++) {        // two channel fillers each side
            var off = t / 2 + ff * t;
            [-1, 1].forEach(function (s2) {
              add({ role: 'filler', w: t, h: bh, d: remD, x: s2 * (IW / 2 - off),
                    y: e.y, z: zBack + remD / 2, tag: 'CHANNEL FILLER · big drawer' });
            });
          }
          add({ role: 'bigdrawer', w: bfw, h: bh - 8, d: t, x: 0, y: e.y, z: dzF + slide,
                tag: 'BIG DRAWER ' + e.n + ' · full width', move: 'sh', key: e.key,
                lo: e.lo, hi: e.hi,
                note: 'Drag it, or right-click to put it elsewhere in the full-width stack.' });
          WB.drawerBox(add, p, { x: 0, y: e.y, zF: dzF + slide, fw: bfw, fh: bh, SD: SD,
                                 tag: 'BIG DRAWER ' + e.n });
          WB.handle(add, { x: 0, y: e.y, z: dzF + slide, out: 1, dir: 'h',
                           len: Math.min(420, bfw * 0.4) });
        } else {
          add({ role: 'shelf', w: IW, h: t, d: SD, x: 0, y: e.y, z: zS,
                tag: 'FULL SHELF ' + e.n + ' · full width', move: 'sh', key: e.key,
                lo: e.lo, hi: e.hi,
                note: 'Full width — the partition rests on these. Move it and the ' +
                      'gap the partition sits in changes with it.' });
        }
      });

      /* ── the columns, inside the partition's gap ── */
      var nSh = Math.max(0, p.uhs + p.lhs) || Math.max(0, p.hsAll);
      var nDr = Math.max(0, p.sdq), dh = p.sdh;
      var nLk = Math.max(0, p.locker), lkH = Math.max(120, p.lkdh);
      /* The bay is NOT part of the key. Each column piece carries the bay it
         starts in and the bay the user has moved it to, so the right-click
         menu can offer the other bay and the piece keeps its identity when it
         crosses over. Keying the bay into the name (L|sh|0) made a piece a
         different piece in each bay, which is why there was no option to
         change it. */
      S.shCol = S.shCol || {};
      var items = [], jj;
      for (jj = 0; jj < nDr; jj++)
        items.push({ key: 'C|dr|' + jj, kind: 'drawer', h: dh, n: jj + 1, defCol: 'R' });
      // the locker is ONE level: both shelves, the door and the 50 filler
      for (jj = 0; jj < nLk; jj++)
        items.push({ key: 'C|lk|' + jj, kind: 'locker', h: lkH + 2 * t, n: jj + 1,
                     defCol: 'R' });
      for (jj = 0; jj < nSh; jj++)
        items.push({ key: 'C|sh|' + jj, kind: 'shelf', h: t, n: jj + 1,
                     defCol: jj < Math.ceil(nSh / 2) ? 'L' : 'R' });
      items.forEach(function (e) {
        var c = S.shCol[e.key];
        e.col = (c === 'L' || c === 'R') ? c : e.defCol;
      });

      var plan = { L: { x: Lx, n: 0 }, R: { x: Rx, n: 0 } };

      ['L', 'R'].forEach(function (cK) {
        var c = plan[cK];
        var lv = items.filter(function (e) { return e.col === cK; });
        var top = pTop - t / 2 - 40, bot = pBot + 60, n = lv.length;
        c.n = n;
        lv.forEach(function (e, k) {
          e.def = n <= 1 ? (bot + top) / 2 : bot + (top - bot) * k / (n - 1);
        });
        WB.layoutLevels(S, lv, pBot, pTop);
        if (lv.over > 1)
          notes.push(['err', 'The ' + (cK === 'L' ? 'left' : 'right') + ' bay needs ' +
            Math.round(pTop - pBot + lv.over) + ' and the partition gap is ' +
            Math.round(pTop - pBot) + '. Nothing is drawn outside the partition — move the ' +
            'partition to a taller gap, or reduce what is in that bay.']);
        lv.forEach(function (e) { LV.push(e); });

        lv.forEach(function (e) {
          if (e.kind === 'drawer') {
            var fwd = colW - 2 * t - 4;
            [-1, 1].forEach(function (s2) {          // ONE filler per side here
              add({ role: 'filler', w: t, h: dh, d: remD, x: c.x + s2 * (colW / 2 - t / 2),
                    y: e.y, z: zBack + remD / 2, tag: 'CHANNEL FILLER · ' + cK });
            });
            add({ role: 'drawer', w: fwd, h: dh - 4, d: t, x: c.x, y: e.y, z: dzF + slide,
                  tag: 'DRAWER ' + e.n + ' · ' + cK, move: 'sh', key: e.key,
                  lo: e.lo, hi: e.hi,
                  note: 'Right-click to move it up or down, or into the other bay.' });
            WB.drawerBox(add, p, { x: c.x, y: e.y, zF: dzF + slide, fw: fwd, fh: dh, SD: SD,
                                   tag: 'DRAWER ' + e.n });
            WB.handle(add, { x: c.x, y: e.y, z: dzF + slide, out: 1, dir: 'h',
                             len: Math.min(240, fwd * 0.45) });
          } else if (e.kind === 'locker') {
            var lY = e.y - e.h / 2 + t / 2, uY = e.y + e.h / 2 - t / 2;
            [['LOWER', lY], ['UPPER', uY]].forEach(function (q) {
              add({ role: 'locker', w: colW, h: t, d: remD, x: c.x, y: q[1],
                    z: zBack + remD / 2, tag: 'LOCKER ' + q[0] + ' SHELF · ' + cK,
                    move: 'sh', key: e.key, lo: e.lo, hi: e.hi,
                    note: 'The locker moves as one block — both shelves, the door and ' +
                          'the 50 filler together.' });
            });
            // the door and its 50 filler are FRONT pieces, in the facia plane
            add({ role: 'lockerdoor', w: 50, h: lkH - 4, d: t,
                  x: c.x - colW / 2 + 25, y: e.y, z: dzF, tag: 'LOCKER FILLER 50 · ' + cK });
            add({ role: 'lockerdoor', w: colW - 50 - 4, h: lkH - 4, d: t,
                  x: c.x + 25 - 2, y: e.y, z: dzF, tag: 'LOCKER DOOR · ' + cK,
                  move: 'sh', key: e.key, lo: e.lo, hi: e.hi });
            WB.handle(add, { x: c.x + 25 - 2, y: e.y, z: dzF, out: 1, dir: 'v',
                             len: Math.min(220, lkH * 0.4) });
          } else {
            add({ role: 'shelf', w: colW, h: t, d: remD, x: c.x, y: e.y, z: zBack + remD / 2,
                  tag: 'HALF SHELF ' + e.n + ' · ' + cK, move: 'sh', key: e.key,
                  lo: e.lo, hi: e.hi,
                  note: 'Right-click to move it up or down, or into the other bay.' });
          }
        });
      });

      /* ── two hinged doors, one per column ── */
      var dw = W / 2 - 2, ddh = H - p.skirt;
      var ang = ((p.dopen || 0) / 100) * (Math.PI * 0.62);
      [[-1, 'DOOR 1'], [1, 'DOOR 2']].forEach(function (s2) {
        var sgn = s2[0];
        var piv = { x: sgn * (W / 2), y: p.skirt + ddh / 2, z: D / 2, ry: sgn * ang };
        add({ role: 'door', w: dw, h: ddh, d: 18, x: -sgn * dw / 2, y: 0, z: 9,
              tag: s2[1], pivot: piv });
        WB.handle(add, { x: -sgn * (dw - 55), y: 0, z: 18, out: 1, dir: 'v',
                         len: Math.min(600, ddh * 0.35), pivot: piv });
      });

      return {
        parts: parts, notes: notes,
        callouts: WB.callouts(p, W, H, D / 2, 2),
        LV: LV,
        floor: pBot, ceil: pTop, wFloor: yB, wCeil: yT,
        zones: { W: { x: 0, y0: yB, y1: yT, w: IW },
                 L: { x: Lx, y0: pBot, y1: pTop, w: colW },
                 R: { x: Rx, y0: pBot, y1: pTop, w: colW } },
        zoneKeys: [], vM: { L: 0, R: 0 }, CM: { L: [], R: [] },
        HS: { upper: [], lower: [] }, cols: { L: [], R: [] }, twoCol: true,
        bandOf: function () { return ['L']; },
        geo: { IW: IW, IH: IH, colW: colW, SD: SD, yB: yB, yT: yT },
        hud: 'interior <b>' + Math.round(IW) + '×' + Math.round(IH) + '</b> · column <b>' +
             Math.round(colW) + '</b> · depth <b>' + Math.round(SD) +
             '</b><br>full width: <b>' + nFull + '</b> shelves · <b>' + nBig +
             '</b> big drawers<br>partition <b>' + Math.round(pTop - pBot) +
             '</b> · left bay <b>' + plan.L.n + '</b> pieces · right bay <b>' + plan.R.n +
             '</b><br>right-click a column piece to move it inside its bay or to the other bay'
      };
    },

    /* A full-width piece has one zone and keeps the plain menu. A column
       piece gets BOTH bays: its own, and the other one, where it is offered
       as a piece not yet in that zone (mvIn). */
    targets: function (S, u, res) {
      var rec = recOf(u, res);
      if (rec && rec.kind === 'vp') {
        var g = fwGroups((res.LV || []).filter(function (e) { return e.col === 'W'; }));
        var why = { top: g.sh.length < 1 ? ' \u2014 needs 1 full shelf' : '',
                    mid: g.sh.length < 2 ? ' \u2014 needs 2 full shelves' : '',
                    bot: g.dr.length ? ' \u2014 not possible with a big drawer'
                       : g.sh.length < 1 ? ' \u2014 needs 1 full shelf' : '' };
        /* ONLY the three positions. The generic slot list was offering the
           partition a place between two drawers or over a shelf, which is not
           a thing a centre partition can be. */
        return VP_MODES.map(function (m) {
          return { id: 'vp:' + m.id, label: m.label + why[m.id],
                   disabled: !!why[m.id], current: false };
        });
      }
      if (!rec || rec.col === 'W') return WB.levelTargets(S, u, zoneOf(u, res));
      var out = [];
      ['L', 'R'].forEach(function (cK) {
        var mine = (cK === rec.col);
        var z = zoneOf(u, res, cK);
        WB.levelTargets(S, u, z, mine ? null : rec).forEach(function (o) {
          out.push({ id: 'bay:' + cK + ':' + o.id,
                     current: mine && o.current, disabled: o.disabled,
                     label: (cK === 'L' ? 'Left bay' : 'Right bay') + ' · ' + o.label });
        });
      });
      return out;
    },

    moveTo: function (S, u, id, res) {
      var a = String(id || '').split(':');
      if (a[0] === 'vp') {
        S.shY = S.shY || {};
        // a new arrangement re-places the free shelves, so let them spread
        S.zsig = {};
        return fwArrange(S, fwGroups((res.LV || []).filter(function (e) { return e.col === 'W'; })),
                         res.wFloor, res.wCeil, a[1],
                         function (e, v) { S.shY[e.key] = v; });
      }
      if (a[0] !== 'bay') return WB.levelMoveTo(S, u, id, zoneOf(u, res));
      var cK = a[1], rest = a.slice(2).join(':');
      var rec = recOf(u, res);
      if (!rec) return false;
      var mine = (cK === rec.col);
      var ok = WB.levelMoveTo(S, u, rest, zoneOf(u, res, cK), mine ? null : rec);
      if (ok && !mine) S.shCol[u.key] = cK;
      return ok;
    },

    drag: WB.drag
  });
})();
