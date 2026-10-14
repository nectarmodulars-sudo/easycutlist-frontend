/* rule-engines/wardrobe-common.js — everything the wardrobe engines share.
   Loaded BEFORE the engine file that needs it (the manifest lists an array of
   files per rule code). Exposes window.ASM3D_WB. Registers nothing itself.

   Why a shared file: the sliding wardrobe and the 4-door wardrobe are the same
   carcass with different doors, and the 2-door is that carcass with one column
   instead of two. Keeping one copy of the geometry means a rule fix lands in
   every wardrobe at once instead of three times, badly.

   THE RULES, as given:
     1  Fixed shelves. Two appear above the drawer line (one per column). Each
        group of 2 small drawers carries one sitting on top of it. Any beyond
        that go in a quarter and may be moved to ANY quarter — a fixed shelf is
        structural, so a vertical standing on it is fine.
     2  Removable shelves sit on pins, so they may go in any quarter that has
        NO vertical in it, and may only be moved to such a quarter.
     3  Verticals. 1 upper vertical goes in the centre of Q1 or Q2; 2 puts one
        in each; 3 splits one quarter in three; 4 splits both. Same for the
        lower verticals across Q3/Q4. More than 2 in a band raises the note
        "Please check half shelf sizes".
     4  Half shelves live in the bays a vertical creates. One quarter of the
        band has a vertical, so they stay in that quarter's bays; both have
        one, so they may jump between quarters too.
     5  Small drawers move as a pair between the lower quarters; the big drawer
        moves between the lower quarters and between rows of the band.

   All dimensions in mm. Origin: x = 0 at the centre, y = 0 at the floor,
   z = 0 mid-depth, +z toward the viewer. */
window.ASM3D_WB = (function () {
  'use strict';

  var VERSION = '2.0.0';

  /* ── inputs ───────────────────────────────────────────────────────────
     `from` lists the Master Sheet keys a value may arrive under — the parser
     derives a key by lowercasing the label and collapsing each run of
     non-alphanumerics to '_'. First match wins. The wardrobes genuinely use
     different labels for the same thing (Shelf / Full shelf / Fix shelf qty),
     which is why each entry carries several. */
  var INPUTS = {
    /* The minimums are there to stop a blank cell drawing nonsense, nothing
       more. They used to be wardrobe-sized — H at least 1000 — which silently
       drew every kitchen carcass, service table and TV unit at 1000 tall
       however short the sheet said it was. A TV drawer line is 400. */
    W:      { from: ['width', 'w', 'wardrobe_width', 'w_side_view'], def: 2000, min: 150 },
    H:      { from: ['ht', 'h', 'height'], def: 2100, min: 150 },
    D:      { from: ['depth', 'd', 'dep'], def: 580, min: 100 },
    ply:    { from: ['ply_thickness_lrtb_shelves', 'ply_thickness', 'ply',
                     'panel_thickness', 'thickness'], def: 18, min: 6 },
    skirt:  { from: ['skirting', 'skirting_ht', 'skirting_height'], def: 70, min: 0 },
    push:   { from: ['shelf_push_inside', 'shelf_push'], def: 20, min: 0 },
    reveal: { from: ['door_reveal', 'reveal'], def: 90, min: 0 },
    backT:  { from: ['back_thickness', 'back_thk'], def: 8, min: 3 },
    hang:   { from: ['hanger_space', 'hanging_space', 'hanger'], def: 950, min: 250 },
    // Fixed shelves. "Shelf" and "Full shelf" are the same count under another
    // label on items that have no removable shelf at all.
    fix:    { from: ['fix_shelf_qty', 'fix_shelf', 'fixed_shelf_qty', 'full_shelf',
                     'shelf', 'shelves', 'shelf_qty', 'shelf_qqty'],
              def: 0, round: true, min: 0 },
    /* Kitchen Carcass. The back is one of two modes, the skirting cell may be
       blank (no skirting at all), the verticals are a plain count, and the
       Hettich Innotech boxes are counted by size. */
    backMode: { from: ['back'], def: 'Zari', type: 'str' },
    /* Gola: the aluminium profile under the front edge of the top. It is
       bought, not cut, so the sheet shows it only by shortening the top. */
    gola:   { from: ['gola'], def: 'No', type: 'str' },
    vcount: { from: ['vertical', 'verticals', 'vertical_qty'], def: 0, round: true, min: 0 },
    h4q:    { from: ['hettich_4in_innotech_qty', 'innotech_4in_qty'],
              def: 0, round: true, min: 0 },
    h6q:    { from: ['hettich_6in_innotech_qty', 'innotech_6in_qty'],
              def: 0, round: true, min: 0 },
    fstrip: { from: ['front_strip_w', 'front_strip'], def: 70, min: 0 },
    /* Service tables / shoe racks: the top overhangs the front by a stated
       amount, the handle is a bought profile, and the two-bay items count
       their shelves per side. */
    topExt: { from: ['extend_top_by', 'top_extend'], def: 0, min: 0 },
    phandle: { from: ['profile_handle'], def: '', type: 'str' },
    sSh:    { from: ['small_shelf_qty'], def: 0, round: true, min: 0 },
    /* TV units: a single drawer LINE. dqty is how many drawers are in it,
       bdw the stated width of a big one, and fhx the extra the facia takes
       over the opening so the line reads as one band across the front. */
    dqty:   { from: ['drawers_qty'], def: 0, round: true, min: 0 },
    bdw:    { from: ['big_drawers_w', 'big_drawer_w'], def: 600, min: 100 },
    fhx:    { from: ['facia_ht_extend'], def: 0, min: 0 },
    bSh:    { from: ['big_shelf_qty'], def: 0, round: true, min: 0 },
    bstrip: { from: ['back_strip_w', 'back_strip'], def: 70, min: 0 },
    rem:    { from: ['removable_shelf_qty', 'removable_shelf', 'removable_shelves',
                     'moveable_shelf', 'movable_shelf', 'moveable_shelf_qty'],
              def: 0, round: true, min: 0 },
    uhs:    { from: ['upper_half_shelf', 'upper_half_shelves'], def: 0, round: true, min: 0 },
    lhs:    { from: ['lower_half_shelf', 'lower_half_shelves'], def: 0, round: true, min: 0 },
    hsAll:  { from: ['half_shelf', 'half_shelves', 'half_shelf_qty'], def: 0, round: true, min: 0 },
    uv:     { from: ['upper_vertical', 'upper_verticals'], def: 0, round: true, min: 0, max: 4 },
    lv:     { from: ['lower_vertical', 'lower_verticals'], def: 0, round: true, min: 0, max: 4 },
    locker: { from: ['locker', 'locker_qty'], def: 0, round: true, min: 0 },
    /* The 3-door wardrobe is the only item whose two sides are counted apart:
       a BIG side (2/3 of the width, two doors) and a SMALL side (1/3, one
       door), each with its own shelves and its own drawers. */
    bFix:   { from: ['big_side_fix_shelf'], def: 0, round: true, min: 0 },
    bRem:   { from: ['big_side_removable_shelf'], def: 0, round: true, min: 0 },
    bDq:    { from: ['big_side_drawer_qty'], def: 0, round: true, min: 0 },
    bDh:    { from: ['big_side_drawer_ht'], def: 150, min: 60 },
    sFix:   { from: ['small_side_fix_shelf'], def: 0, round: true, min: 0 },
    sRem:   { from: ['small_side_removable_shelf'], def: 0, round: true, min: 0 },
    sDq:    { from: ['small_side_drawer_qty'], def: 0, round: true, min: 0 },
    sDh:    { from: ['small_side_drawer_ht'], def: 150, min: 60 },
    lkdh:   { from: ['locker_door_ht', 'locker_ht', 'locker_door_height'], def: 400, min: 120 },
    // The centre-partition wardrobe: the partition runs the whole height
    // ("Full") or hangs from the top by a given amount ("Partial").
    vpMode: { from: ['vertical_partition'], def: 'Full', type: 'str' },
    vpH:    { from: ['vertical_partition_ht', 'vertical_partition_height'], def: 0, min: 0 },
    sdq:    { from: ['small_drawer_qty', 'small_drawer', 'small_drawers',
                     'internal_drawer_qty', 'internal_drawers_qty', 'inner_drawer_qty',
                     'drawer_qty'], def: 0, round: true, min: 0 },
    sdh:    { from: ['small_drawer_ht', 'small_drawer_height', 'internal_drawer_ht',
                     'inernal_drawer_ht', 'inner_drawer_ht', 'drawer_ht'], def: 150, min: 60 },
    // Drawers whose facia is OUTSIDE the door, full width, at the foot of the
    // unit. Only the "1 door open + front drawers" has them so far.
    odq:    { from: ['outer_drawer_qty', 'front_drawer_qty', 'outer_drawers'],
              def: 0, round: true, min: 0 },
    odh:    { from: ['outer_drawer_ht', 'front_drawer_ht', 'outer_drawer_height',
                     'bottom_drawer_ht', 'bottom_drawer_height'], def: 200, min: 60 },
    /* "one" or "two": the bottom drawers of the 2-door + bottom drawers sit
       SIDE BY SIDE, not stacked, so this is a count across the width. */
    odSide: { from: ['bottom_drawers_qty', 'bottom_drawer_qty'], def: '', type: 'str' },
    /* The upper band's height stated outright, instead of derived from the
       hanger space: this item cuts the upper vertical at exactly that. */
    uvH:    { from: ['upper_vertical_ht', 'upper_vertical_height'], def: 0, min: 0 },
    bdq:    { from: ['big_drawer_qty', 'big_drawer', 'big_drawers', 'big_drawers_qty'],
              def: 0, round: true, min: 0 },
    bdh:    { from: ['big_drawer_ht', 'big_drawer_height'], def: 250, min: 60 },
    lside:  { from: ['left_side', 'side_material', 'carcass_material'], def: 'MATERIAL', type: 'str' },
    rside:  { from: ['right_side', 'side_material', 'carcass_material'], def: 'MATERIAL', type: 'str' },
    door1:  { from: ['door1', 'door_1', 'door', 'door_material'], def: 'MATERIAL', type: 'str' },
    door2:  { from: ['door2', 'door_2', 'door_material'], def: 'MATERIAL', type: 'str' },
    door3:  { from: ['door3', 'door_3'], def: 'MATERIAL', type: 'str' },
    door4:  { from: ['door4', 'door_4'], def: 'MATERIAL', type: 'str' },
    bmat:   { from: ['border', 'border_material'], def: 'MATERIAL', type: 'str' },
    eband:  { from: ['edge_band', 'edgeband', 'eband', 'edge_banding'], def: 'MATERIAL', type: 'str' }
  };

  /* Interaction state. Every engine starts here; nothing in it is geometry, so
     a change of inputs never has to clear more than the placement maps. */
  function fresh() {
    // bdC / bdR are per big drawer, keyed by its id — every one of them moves
    // on its own. sdCol is per small-drawer PAIR.
    // dlY: the height of a drawer line that rides as one block (1-door).
    return { bdC: {}, bdR: {}, sdCol: {}, dlY: null,
             shY: {}, shQ: {},          // fixed shelves: height and quarter, by id
             pin: {},                   // keys the user has placed by hand
             rsY: {}, rsQ: {},          // removable shelves, same
             hs: null, hsKey: '',       // half shelves
             uvQ: 'q1', lvQ: 'q3' };
  }

  function clampY(lo, hi, stored, def) {
    var v = (stored != null) ? stored : def;
    return Math.min(hi, Math.max(lo, v));
  }

  // Sub-cell furthest from the centre — where a half shelf starts.
  function outerIdx(list) {
    var bi = 0, bv = -1;
    list.forEach(function (c, i) { if (Math.abs(c.x) > bv) { bv = Math.abs(c.x); bi = i; } });
    return bi;
  }

  /* Shell common to every wardrobe: two sides, skirting, bottom, top.
     The panels are NOT the full depth — the sheet cuts top, bottom and sides
     at d-20 (the 2-door says d-ply-2, the same thing at 18 ply), set back from
     the front. Drawing them at D made every one of those rows read "not drawn"
     against the cut list. `cD` lets an engine state its own. */
  /* `base` raises the BOTTOM panel without moving the sides: a wardrobe that
     stands on a bank of drawers has full-height sides and its carcass floor at
     the top of that bank, which is what the sheet's own back height
     (h - bottom_drawer_ht - 20) says. */
  function shell(add, p, IW, cD, base) {
    var t = p.ply, W = p.W, H = p.H, D = p.D;
    // Flush at the FRONT, short at the BACK. The 20 the sheet takes off is the
    // rebate the back panel sits in, not a setback from the face — putting it
    // at the front left a 20mm slot between the panels and the door, visible
    // along the top as soon as the model was tipped over.
    var pd = Math.max(100, cD || (D - 20)), zc = D / 2 - pd / 2;
    add({ role: 'side', w: t, h: H, d: pd, x: -(W - t) / 2, y: H / 2, z: zc, tag: 'LEFT SIDE' });
    add({ role: 'side', w: t, h: H, d: pd, x: (W - t) / 2, y: H / 2, z: zc, tag: 'RIGHT SIDE' });
    add({ role: 'skirting', w: IW, h: p.skirt, d: t, x: 0, y: p.skirt / 2, z: (D - t) / 2, tag: 'SKIRTING' });
    add({ role: 'carcass', w: IW, h: t, d: pd, x: 0, y: p.skirt + (base || 0) + t / 2, z: zc,
          tag: 'BOTTOM' });
    add({ role: 'carcass', w: IW, h: t, d: pd, x: 0, y: H - t / 2, z: zc, tag: 'TOP' });
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

  function callouts(p, W, H, zF, nDoors) {
    var out = [
      { from: [-(W / 2) + 8, H * 0.74, 0], to: [-(W / 2) - 520, H * 0.80, zF + 120], text: 'LEFT SIDE · ' + p.lside },
      { from: [(W / 2) - 8, H * 0.74, 0], to: [(W / 2) + 520, H * 0.80, zF + 120], text: 'RIGHT SIDE · ' + p.rside },
      { from: [W * 0.30, 60, zF], to: [W * 0.30, -420, zF + 320], text: 'EDGE BAND · ' + p.eband }
    ];
    var mats = [p.door1, p.door2, p.door3, p.door4].slice(0, Math.max(1, nDoors || 2));
    mats.forEach(function (m, i) {
      var fx = -W / 2 + W * (i + 0.5) / mats.length;
      out.push({ from: [fx, H * 0.34, zF], to: [fx * 1.25, H * 0.16, zF + 520],
                 text: 'DOOR ' + (i + 1) + ' · ' + m });
    });
    return out;
  }

  /* ── the drawer band ──────────────────────────────────────────────────
     Rows are built per column. A small row holds that column's two slots and
     moves between columns as a PAIR (S.sdCol[id]); one big drawer is the
     big drawer keeps its own column and row (S.bdC / S.bdR, keyed by its id).
     The band is as tall as its taller column — stacking rows in one column does
     make it grow, which is allowed because silently refusing the move was worse.
     Returns { cols, bandH, bigCols, groups }; groups counts the small rows. */
  function layout(p, S, twoCol) {
    S.sdCol = S.sdCol || {};
    var smalls = [], sm = Math.max(0, p.sdq), sid = 0;
    while (sm > 0) {
      var n = Math.min(2, sm); sm -= n;
      var dflt = (!twoCol || sid % 2 === 0) ? 'L' : 'R';
      var use = twoCol && (S.sdCol[sid] === 'L' || S.sdCol[sid] === 'R') ? S.sdCol[sid] : dflt;
      smalls.push({ type: 'small', n: n, sid: sid, col: use });
      sid++;
    }
    var cols = { L: [], R: [] };
    smalls.forEach(function (r) { cols[r.col].push(r); });

    // Every big drawer is its own movable part. It was once the first one
    // only, because two draggable drawers made a drag ambiguous — the menu
    // asks which one, so that restriction is gone.
    S.bdC = S.bdC || {}; S.bdR = S.bdR || {};
    var nbig = Math.max(0, p.bdq), bigCols = { L: false, R: false };
    for (var b = 0; b < nbig; b++) {
      var dflt = twoCol ? ((b % 2 === 0) ? 'R' : 'L') : 'L';
      var col = (twoCol && (S.bdC[b] === 'L' || S.bdC[b] === 'R')) ? S.bdC[b] : dflt;
      var arr = cols[col];
      var at = S.bdR[b];
      if (at == null || at < 0 || at > arr.length) at = arr.length;   // default: bottom
      arr.splice(Math.min(at, arr.length), 0, { type: 'big', bid: b, col: col, drag: true });
      bigCols[col] = true;
    }
    function rowH(r) { return r.type === 'big' ? p.bdh : p.sdh; }
    function total(a) { var v = 0; a.forEach(function (r) { v += rowH(r); }); return v; }
    return { cols: cols, bandH: Math.max(total(cols.L), total(cols.R)),
             bigCols: bigCols, groups: smalls.length, rowH: rowH, total: total };
  }

  /* A bar handle: the length of bar standing clear of the face on two short
     legs, which is what the workshop actually fits. A round knob was only ever
     a placeholder. `dir` is 'v' for a door (upright, near the opening edge) or
     'h' for a drawer (across, centred).
       o = { x, y, z (face plane), out (which way the face points, +1/-1),
             len, dir, pivot } */
  function handle(add, o) {
    var BAR = 16, LEG = 26, out = (o.out == null ? 1 : o.out);
    var zb = o.z + out * (LEG + BAR / 2);        // the bar itself
    var zl = o.z + out * (LEG / 2);              // the legs
    var vert = (o.dir === 'v');
    var len = Math.max(90, o.len || 180);
    var rec = { role: 'knob', w: vert ? BAR : len, h: vert ? len : BAR, d: BAR,
                x: o.x, y: o.y, z: zb, tag: 'HANDLE' };
    if (o.pivot) rec.pivot = o.pivot;
    add(rec);
    [-1, 1].forEach(function (s2) {
      var leg = { role: 'knob', w: 10, h: 10, d: LEG,
                  x: o.x + (vert ? 0 : s2 * (len / 2 - 14)),
                  y: o.y + (vert ? s2 * (len / 2 - 14) : 0), z: zl };
      if (o.pivot) leg.pivot = o.pivot;
      add(leg);
    });
  }

  /* A drawer is a BOX, not a face: two sides, a back and a 6mm bottom behind
     the facia. The sheet cuts all four (side patti, back patti, lock patti,
     bottom 6mm), so drawing only the facia left the cut list unmatched and the
     drawer looking like a panel stuck to the front.
       o = { x, y, zF (facia plane), fw, fh, SD, zBack, tag }
     Proportions follow the sheet: the box is 30 narrower than the facia each
     side, 60 shallower than the interior, and 30 shorter than the facia. */
  /* How far the drawers are pulled out, in mm. One viewer control named
     `draw` drives every drawer in every wardrobe, so opening them is a single
     gesture rather than one slider per kind of drawer. */
  function slideOf(p, SD) {
    return ((p.draw || 0) / 100) * Math.max(80, SD - 60) * 0.85;
  }
  // The toolbar control itself, so no engine has to spell it out.
  var DRAW_CTL = { id: 'draw', type: 'range', min: 0, max: 100, val: 0, label: 'Drawers out' };

  function drawerBox(add, p, o) {
    var t = p.ply;
    // Sheet, for the 1-door: back patti (w-36)-135 and sides (d-50)-60 by
    // (drawer ht)-30 — so the box is 60 narrower than the facia, 60 shallower
    // than the interior, and 30 shorter than the drawer.
    var bw = Math.max(60, o.fw - 60);            // outside width of the box
    var bd = Math.max(80, o.SD - 60);            // depth of the box
    var bh = Math.max(40, o.fh - 30);            // height of the sides
    var zMid = o.zF - t / 2 - bd / 2;            // the box sits behind the facia
    var y0 = o.y - o.fh / 2 + 6;                 // box floor, just above the facia foot
    var cy = y0 + bh / 2;
    add({ role: 'drawerbox', w: t, h: bh, d: bd, x: o.x - bw / 2 + t / 2, y: cy, z: zMid,
          tag: o.tag + ' · side' });
    add({ role: 'drawerbox', w: t, h: bh, d: bd, x: o.x + bw / 2 - t / 2, y: cy, z: zMid,
          tag: o.tag + ' · side' });
    add({ role: 'drawerbox', w: bw - 2 * t, h: bh, d: t, x: o.x, y: cy, z: zMid - bd / 2 + t / 2,
          tag: o.tag + ' · back' });
    add({ role: 'drawerbox', w: bw, h: 6, d: bd, x: o.x, y: y0 + 3, z: zMid,
          tag: o.tag + ' · bottom 6mm' });
  }

  /* Draws one column of the band. The fixed shelf that caps a drawer band is
     NOT drawn here: it belongs to the drawer LINE, not to a particular row, so
     it must stay put when the rows are reordered under it. The caller draws it
     once per column at the top of the band. */
  function drawBand(add, p, L, cK, cx, colW, slotX, SLOT, dlTop, SD, zS, dz) {
    var t = p.ply, y = dlTop, rowYs = [];
    var slide = slideOf(p, SD);            // every facia and box moves together
    L.cols[cK].forEach(function (r) {
      var h = L.rowH(r), cy = y - h / 2;
      rowYs.push(cy);
      // TWO fillers at each end of every row, not one. The sheet cuts the
      // channel filler at qty *4 per drawer row — 2 per side — and every facia
      // width it gives is the column less FOUR ply, which is the same thing
      // said twice.
      for (var f = 0; f < 2; f++) {
        var off = t / 2 + f * t;
        add({ role: 'filler', w: t, h: h, d: SD, x: cx - colW / 2 + off, y: cy, z: zS,
              tag: 'CHANNEL FILLER · ' + cK });
        add({ role: 'filler', w: t, h: h, d: SD, x: cx + colW / 2 - off, y: cy, z: zS,
              tag: 'CHANNEL FILLER · ' + cK });
      }
      if (r.type === 'big') {
        var bfw = colW - 4 * t - 4;
        add({ role: 'bigdrawer', w: bfw, h: h - 8, d: t, x: cx, y: cy, z: dz + slide,
              tag: 'BIG DRAWER ' + (r.bid + 1) + ' · ' + cK,
              move: 'bd', key: 'bd|' + r.bid + '|' + cK });
        drawerBox(add, p, { x: cx, y: cy, zF: dz + slide, fw: bfw, fh: h - 8, SD: SD,
                            tag: 'BIG DRAWER ' + (r.bid + 1) });
            handle(add, { x: cx, y: cy, z: dz + slide, out: 1, dir: 'h',
                      len: Math.min(320, bfw * 0.45) });
      } else {
        for (var k = 0; k < r.n; k++) {
          var si = SLOT[k];
          // Both drawers of a row share one move key, so picking either picks
          // the pair and the menu carries them together.
          var sfw = Math.abs(slotX[1] - slotX[0]) - 3;
          add({ role: 'drawer', w: sfw, h: h - 8, d: t, x: cx + slotX[k], y: cy, z: dz + slide,
                tag: 'SMALL DRAWER PAIR · ' + cK, move: 'sd', key: 'sd|' + r.sid + '|' + cK,
                noV: true });
          drawerBox(add, p, { x: cx + slotX[k], y: cy, zF: dz + slide, fw: sfw, fh: h - 8,
                              SD: SD, tag: 'SMALL DRAWER' });
          handle(add, { x: cx + slotX[k], y: cy, z: dz + slide, out: 1, dir: 'h',
                        len: Math.min(220, sfw * 0.5) });
        }
      }
      y -= h;
    });
    return rowYs;
  }

  /* ── shelves ──────────────────────────────────────────────────────────
     One record per shelf with a STABLE id, so a shelf carried to another
     quarter keeps its identity and its height instead of inheriting whatever
     the next shelf in that quarter was using.
       kind  'sh' fixed (may sit in a quarter that has a vertical)
             'rs' removable (only a quarter with no vertical) */
  function place(add, S, p, kind, count, zones, zoneOf, allowed) {
    var recs = [], t = p.ply;
    if (count <= 0 || !allowed.length) return recs;
    var QM = (kind === 'sh') ? S.shQ : S.rsQ, YM = (kind === 'sh') ? S.shY : S.rsY;
    var home = zones.length ? zones : allowed;
    var byZone = {}, per = Math.ceil(count / home.length);
    for (var i = 0; i < count; i++) {
      var want = QM[i];
      if (allowed.indexOf(want) < 0) want = home[Math.min(home.length - 1, Math.floor(i / per))];
      QM[i] = want;
      (byZone[want] = byZone[want] || []).push(i);
    }
    Object.keys(byZone).forEach(function (zk) {
      var z = zoneOf(zk), ids = byZone[zk], n = ids.length;
      ids.forEach(function (id, k) {
        var key = kind + '|' + id;
        var lo = z.y0 + 40, hi = z.y1 - 40;
        var yy = clampY(lo, hi, YM[key], z.y0 + (z.y1 - z.y0) * (k + 1) / (n + 1));
        // A removable shelf is shorter than a fixed one by `shelf push inside`.
        // It is pushed in FROM THE FRONT — its back edge stays against the back
        // panel, exactly where a full-depth shelf's back edge is.
        var dep = (kind === 'rs') ? Math.max(100, z.SD - p.push) : z.SD;
        add({ role: 'shelf', w: z.w, h: t, d: dep, x: z.x,
              y: yy, z: z.zS - (z.SD - dep) / 2,
              tag: (kind === 'sh' ? 'FIX' : 'REMOVABLE') + ' SHELF · ' + zk.toUpperCase(),
              move: kind, key: key, lo: lo, hi: hi });
        recs.push({ zone: zk, y: yy, x: z.x, w: z.w });
      });
    });
    return recs;
  }

  /* ── verticals ─────────────────────────────────────────────────────── */
  function alloc(c, qa, qb, pref) {
    var m = {}; m[qa] = 0; m[qb] = 0;
    if (c <= 0) return m;
    if (c === 1) m[pref === qb ? qb : qa] = 1;
    else if (c === 2) { m[qa] = 1; m[qb] = 1; }
    else if (c === 3) { var pk = (pref === qb) ? qb : qa; m[pk] = 2; m[pk === qa ? qb : qa] = 1; }
    else { m[qa] = 2; m[qb] = 2; }
    return m;
  }

  /* ── LEVELS ─────────────────────────────────────────
     The single-column wardrobes stack drawers and shelves one above another
     with nothing beside them. Each is a LEVEL: it holds an absolute height of
     its own, and is clamped between the two levels either side of it. That is
     what makes dragging one move only that one, and stops anything being
     dragged through anything else.
     Reordering — a shelf under the drawers, say — is therefore not a drag but a
     menu action, and the menu will shift the other levels to open a slot that
     is too tight, because a drawer bank is flush and never has a gap to drop
     into. Levels sit FLUSH: a shelf over a drawer rests on it. */

  function gapBetween() { return 0; }
  function levelName(e) {
    return e.kind === 'drawer' ? 'drawer ' + e.n
         : e.kind === 'rshelf' ? 'removable shelf ' + e.n
         : e.kind === 'locker' ? 'the locker'
         : e.kind === 'vp'     ? 'the partition'
         : e.kind === 'dline'  ? 'the drawer line'
         : 'shelf ' + e.n;
  }

  /* lv: [{ key, kind, h, n, def }] — def is where it goes if the user has not
     moved it. Returns the same list sorted bottom-up, each with y, lo and hi. */
  /* A piece the user has never moved has only `def`, and `def` is worked out
     from an EMPTY stack — bottom up, in cut order. Once the user has dragged
     anything, the pieces that are already placed no longer sit where that walk
     assumed, so a newly added shelf arrived at a height that is now in the
     middle of the drawer bank: an 18mm sliver behind two drawer facias, which
     cannot be seen and cannot be clicked. A new piece goes into the largest
     free gap instead, which is open space by definition. Levels sit flush, so
     the gap between two drawers in a bank is zero and never wins — the bank
     stays contiguous on its own, and a shelf can still be put between two
     drawers deliberately from the menu. */
  function placeFresh(S, known, fresh, floor, ceil) {
    var occ = known.map(function (e) { return { y: S.shY[e.key], h: e.h }; })
                   .sort(function (a, b) { return a.y - b.y; });
    fresh.forEach(function (e) {
      var best = null, k;
      for (k = 0; k <= occ.length; k++) {
        var lo = k ? occ[k - 1].y + occ[k - 1].h / 2 : floor;
        var hi = (k < occ.length) ? occ[k].y - occ[k].h / 2 : ceil;
        if (hi - lo >= e.h && (!best || hi - lo > best.hi - best.lo))
          best = { lo: lo, hi: hi, k: k };
      }
      if (!best) return;                       // nothing open — keep its def
      e.def = (best.lo + best.hi) / 2;
      occ.splice(best.k, 0, { y: e.def, h: e.h });
    });
  }

  /* Shelves driven flush against each other read as ONE thick slab, and when
     that happens at the carcass top they look like they have disappeared: the
     wardrobe loses height, every shelf the clamp pushes up ends up welded to
     the ceiling, and the user asks where the shelves went. A run of shelves
     with free space around it is therefore spread evenly through that space,
     which keeps a gap at the top as well. Only shelves are spread, and only
     ones the user has not placed by hand: a drawer bank is meant to be flush,
     and a shelf dragged or sent somewhere on purpose stays where it was put.
     A pinned shelf is an ANCHOR: the run breaks at it, so the shelf resting on
     the partition keeps resting on it and the free shelves above it spread
     into the space that is left. */
  function spreadShelves(S, lv, floor, ceil) {
    var pin = S.pin || {}, i = 0;
    function isSh(e) {
      return e && (e.kind === 'shelf' || e.kind === 'rshelf') && !pin[e.key];
    }
    while (i < lv.length) {
      if (!isSh(lv[i])) { i++; continue; }
      var j = i;
      while (j + 1 < lv.length && isSh(lv[j + 1])) j++;
      var run = lv.slice(i, j + 1), tot = 0;
      run.forEach(function (e) { tot += e.h; });
      var lo = (i === 0) ? floor : lv[i - 1].y + lv[i - 1].h / 2;
      var hi = (j === lv.length - 1) ? ceil : lv[j + 1].y - lv[j + 1].h / 2;
      var slack = (hi - lo) - tot;
      if (slack > 60) {
        var step = slack / (run.length + 1), y = lo;
        run.forEach(function (e) { y += step; e.y = y + e.h / 2; y += e.h; });
      }
      i = j + 1;
    }
  }

  function layoutLevels(S, lv, floor, ceil) {
    S.shY = S.shY || {};
    var known = lv.filter(function (e) { return S.shY[e.key] != null; });
    /* A NEW DRAWER is the exception: it belongs on the end of its bank, which
       is what its `def` already says. Dropping it in the largest free gap sent
       the third big drawer to the top of the wardrobe, above the partition. */
    var fresh = lv.filter(function (e) {
      return S.shY[e.key] == null && e.kind !== 'drawer';
    });
    if (known.length && fresh.length) placeFresh(S, known, fresh, floor, ceil);
    lv.forEach(function (e) { e.y = (S.shY[e.key] != null) ? S.shY[e.key] : e.def; });
    lv.sort(function (a, b) { return a.y - b.y; });
    lv.forEach(function (e, k) {
      var min = (k === 0) ? floor + e.h / 2
                          : lv[k - 1].y + lv[k - 1].h / 2 + e.h / 2 + gapBetween(lv[k - 1], e);
      if (e.y < min) e.y = min;
    });
    for (var k2 = lv.length - 1; k2 >= 0; k2--) {
      var e2 = lv[k2];
      var max = (k2 === lv.length - 1) ? ceil - e2.h / 2
                                       : lv[k2 + 1].y - lv[k2 + 1].h / 2 - e2.h / 2 - gapBetween(e2, lv[k2 + 1]);
      if (e2.y > max) e2.y = max;
    }
    /* NOTHING may end up outside the zone. The two passes above push apart and
       then pull down, which is right while the content fits; when it does not,
       the pull-down drove the lowest levels straight through the floor of the
       zone — in the centre-partition wardrobe that showed as the locker and
       the drawers hanging out below the partition. Clamp inside and report how
       much did not fit, so the engine can say so instead of drawing a lie. */
    var need = 0;
    lv.forEach(function (e, k) {
      need += e.h + (k ? gapBetween(lv[k - 1], e) : 0);
    });
    lv.over = Math.max(0, need - (ceil - floor));
    lv.forEach(function (e) {
      e.y = Math.min(ceil - e.h / 2, Math.max(floor + e.h / 2, e.y));
    });
    /* Spreading is a PLACEMENT rule, not a layout rule: it runs when the set
       of pieces changes or the space they live in changes, and never on an
       ordinary redraw. Running it every solve meant that while one shelf was
       dragged, every other free shelf re-spread around it — which read as the
       shelves moving as a group. */
    var ids = lv.map(function (e) { return e.key; }).sort().join(',');
    var sg = Math.round(floor) + '/' + Math.round(ceil);
    S.zsig = S.zsig || {};
    if (S.zsig[ids] !== sg) { S.zsig[ids] = sg; spreadShelves(S, lv, floor, ceil); }
    lv.forEach(function (e, k) {
      e.y = Math.min(ceil - e.h / 2, Math.max(floor + e.h / 2, e.y));
      S.shY[e.key] = e.y;
      e.lo = (k === 0) ? floor + e.h / 2
                       : lv[k - 1].y + lv[k - 1].h / 2 + e.h / 2 + gapBetween(lv[k - 1], e);
      e.hi = (k === lv.length - 1) ? ceil - e.h / 2
                                   : lv[k + 1].y - lv[k + 1].h / 2 - e.h / 2 - gapBetween(e, lv[k + 1]);
      e.lo = Math.max(floor + e.h / 2, Math.min(ceil - e.h / 2, e.lo));
      e.hi = Math.max(floor + e.h / 2, Math.min(ceil - e.h / 2, e.hi));
      if (e.hi < e.lo) e.hi = e.lo;
    });
    return lv;
  }

  /* Every slot level `u` could be inserted into, with the shifts each would
     need. A slot too tight as it stands is not refused outright: the levels
     above can rise and the ones below can drop to open it. */
  /* `mvIn` lets a caller ask about a zone the piece is not in yet, which is
     how a shelf is offered the other column of a centre-partition wardrobe. */
  function slotsFor(res, u, mvIn) {
    var lv = res.LV || [], me = -1, i;
    for (i = 0; i < lv.length; i++) if (String(lv[i].key) === String(u.key)) { me = i; break; }
    if (me < 0 && !mvIn) return null;
    var mv = (me < 0) ? mvIn : lv[me];
    var rest = lv.filter(function (e, j) { return j !== me; }), out = [];
    /* What the zone must hold in total, the moving piece included. Whether a
       slot can take it is a question about the WHOLE zone, not about the two
       levels either side of it: measuring only the clearance above the topmost
       level and below the lowest called a slot "no room" whenever the slack sat
       in the middle of the stack — which is most of the time, and is what made a
       shelf at the top refuse to move down into plainly empty space. If the set
       fits in the zone at all, the others can be re-spread to open any slot,
       and layoutLevels does exactly that on the next pass. */
    var sum = mv.h, prv = null;
    rest.forEach(function (e) { sum += e.h + (prv ? gapBetween(prv, e) : 0); prv = e; });
    var fits = sum <= (res.ceil - res.floor) + 0.5;
    for (var k = 0; k <= rest.length; k++) {
      var below = rest[k - 1], above = rest[k];
      var lo = !below ? res.floor + mv.h / 2
                      : below.y + below.h / 2 + gapBetween(below, mv) + mv.h / 2;
      var hi = !above ? res.ceil - mv.h / 2
                      : above.y - above.h / 2 - gapBetween(mv, above) - mv.h / 2;
      var tight = (lo - hi) > 0.5;
      out.push({ k: k, lo: lo, hi: hi, below: below, above: above, me: me, mv: mv,
                 rest: rest, tight: tight, ok: fits, y: tight ? lo : hi });
    }
    return out;
  }

  function levelTargets(S, u, res, mvIn) {
    var sl = slotsFor(res, u, mvIn);
    if (!sl) return [];
    return sl.map(function (o) {
      var label;
      if (!o.below) label = o.above ? 'At the bottom, under ' + levelName(o.above) : 'At the bottom';
      else if (!o.above) label = 'At the top, over ' + levelName(o.below);
      else label = 'Between ' + levelName(o.below) + ' and ' + levelName(o.above);
      return { id: 'lvl:' + o.k, current: o.k === o.me, disabled: !o.ok,
               label: label + (!o.ok ? ' — the zone is full'
                                     : o.tight ? ' · shifts the others' : '') };
    });
  }

  function levelMoveTo(S, u, id, res, mvIn) {
    var a = String(id || '').split(':');
    if (a[0] !== 'lvl') return false;
    var sl = slotsFor(res, u, mvIn); if (!sl) return false;
    var o = sl[+a[1]];
    if (!o || !o.ok || (o.k === o.me && o.me >= 0)) return false;
    S.shY = S.shY || {};
    // Drop it against whatever sits below the slot. layoutLevels sorts, then
    // pushes everything apart from the floor up, so the levels above make way
    // on their own — no shift has to be worked out here.
    S.shY[u.key] = Math.max(res.floor + o.mv.h / 2,
                            Math.min(res.ceil - o.mv.h / 2, o.lo));
    S.pin = S.pin || {}; S.pin[u.key] = 1;
    return true;
  }

  /* ── bays ────────────────────────────────────────────────────────────
     A unit split by verticals into columns of levels. The bay is NOT part of
     a piece's key, so a piece keeps its identity when it is sent across — the
     rule the centre-partition wardrobe established. Any engine whose zones
     are side-by-side columns of equal standing can use these three. */
  function bayOf(S, e, nBays) {
    var c = (S.shCol || {})[e.key];
    c = (c == null) ? e.defBay : +c;
    return Math.max(0, Math.min(nBays - 1, c || 0));
  }

  function zoneForBay(res, bay) {
    return { LV: (res.LV || []).filter(function (e) { return e.col === bay; }),
             floor: res.floor, ceil: res.ceil };
  }

  function recIn(res, u) {
    var lv = res.LV || [];
    for (var i = 0; i < lv.length; i++)
      if (String(lv[i].key) === String(u.key)) return lv[i];
    return null;
  }

  function bayTargets(S, u, res) {
    var rec = recIn(res, u);
    if (!rec) return [];
    var n = res.nBays || 1, out = [];
    for (var b = 0; b < n; b++) {
      var mine = (b === rec.col);
      /* jshint loopfunc:true */
      (function (bb, mm) {
        levelTargets(S, u, zoneForBay(res, bb), mm ? null : rec).forEach(function (o) {
          out.push({ id: 'bay:' + bb + ':' + o.id, current: mm && o.current,
                     disabled: o.disabled,
                     label: (n > 1 ? (res.bayName ? res.bayName(bb) : 'Bay ' + (bb + 1)) +
                                     ' \u00b7 ' : '') + o.label });
        });
      })(b, mine);
    }
    return out;
  }

  function bayMoveTo(S, u, id, res) {
    var a = String(id || '').split(':');
    if (a[0] !== 'bay') return false;
    var b = +a[1], rest = a.slice(2).join(':');
    var rec = recIn(res, u);
    if (!rec) return false;
    var mine = (b === rec.col);
    var ok = levelMoveTo(S, u, rest, zoneForBay(res, b), mine ? null : rec);
    if (ok && !mine) { S.shCol = S.shCol || {}; S.shCol[u.key] = b; }
    return ok;
  }

  /* ── the right-click menu, shared by every wardrobe ─────────────────── */
  var QN = { q1: 'Q1 · upper left', q2: 'Q2 · upper right',
             q3: 'Q3 · lower left', q4: 'Q4 · lower right',
             U: 'Upper', L: 'Lower' };

  function targets(S, u, res) {
    var out = [];
    function put(id, label, cur, dis, why) {
      out.push({ id: id, label: label + (why ? ' — ' + why : ''), current: !!cur, disabled: !!dis });
    }
    var name = function (q) { return QN[q] || String(q).toUpperCase(); };

    if ((u.move === 'sh' || u.move === 'rs') && u.key != null) {
      var id = String(u.key).split('|')[1];
      var map = (u.move === 'sh') ? S.shQ : S.rsQ;
      res.zoneKeys.forEach(function (q) {
        // Rule 2: a removable shelf rests on pins, so a vertical blocks it. A
        // fixed shelf is structural and a vertical may stand on it.
        var blocked = (u.move === 'rs') && res.vM[q] > 0;
        put(u.move + ':' + q, name(q), map[id] === q, blocked, blocked ? 'vertical in the way' : '');
      });
      return out;
    }

    if (u.move === 'hs' && u.key != null) {
      var st = S.hs && S.hs[+u.key]; if (!st) return out;
      // The solve already worked out where a half shelf of this band may sit —
      // the bays of a vertical, or the two halves of the zone when there is no
      // vertical. Recomputing it here is how the two drift apart.
      var cells = (res.HS && res.HS[st.band]) || [];
      cells.forEach(function (c, i) { put('hs:' + i, name(c.q) + ' · ' + c.id, st.cell === i); });
      if (!cells.length) out.push({ id: '', disabled: true, label: 'Nowhere to put this half shelf' });
      return out;
    }

    if (u.move === 'bd' && u.key != null) {
      var bk = String(u.key).split('|'), bid = bk[1], bcol = bk[2];
      if (res.twoCol) ['L', 'R'].forEach(function (k) {
        put('bd:' + bid + ':col:' + k, name(k === 'L' ? 'q3' : 'q4'), bcol === k);
      });
      var rows = (u.lineYs || []).length;
      for (var i = 0; i < rows; i++)
        put('bd:' + bid + ':row:' + i, 'Row ' + (i + 1) + ' of the drawer band',
            (u.row != null) && u.row === i);
      return out;
    }

    if (u.move === 'sd' && u.key != null) {
      if (!res.twoCol) return out;
      var kp = String(u.key).split('|');
      ['L', 'R'].forEach(function (k) {
        put('sd:' + kp[1] + ':' + k, name(k === 'L' ? 'q3' : 'q4'), kp[2] === k);
      });
      return out;
    }

    if (u.move === 'dl') {
      // Presets, because dragging to an exact height is fiddly. The range is
      // the lower half of the wardrobe, which is where a drawer line belongs.
      [['bottom', 'On the floor of the carcass', 0],
       ['low', 'Low · a quarter up the lower half', 0.25],
       ['mid', 'Middle of the lower half', 0.5],
       ['high', 'Top of the lower half', 1]].forEach(function (o) {
        var at = u.lo + (u.hi - u.lo) * o[2];
        put('dl:' + o[0], o[1], Math.abs((S.dlY == null ? -1e9 : S.dlY) - at) < 1);
      });
      return out;
    }

    if (u.move === 'uv' || u.move === 'lv') {
      var band = (u.move === 'uv') ? ['q1', 'q2'] : ['q3', 'q4'];
      var now = (u.move === 'uv') ? (S.uvQ || 'q1') : (S.lvQ || 'q3');
      band.forEach(function (q) { put(u.move + ':' + q, name(q), now === q); });
      return out;
    }
    return out;
  }

  function moveTo(S, u, id) {
    var a = String(id || '').split(':');
    if (a[0] === 'sh' || a[0] === 'rs') {
      var key = String(u.key).split('|')[1];
      var map = (a[0] === 'sh') ? S.shQ : S.rsQ, ys = (a[0] === 'sh') ? S.shY : S.rsY;
      if (map[key] === a[1]) return false;
      map[key] = a[1]; delete ys[a[0] + '|' + key]; return true;
    }
    if (a[0] === 'hs') {
      var st = S.hs && S.hs[+u.key]; if (!st) return false;
      var i = +a[1]; if (st.cell === i) return false;
      st.cell = i; st.y = null; return true;
    }
    if (a[0] === 'bd') {
      S.bdC = S.bdC || {}; S.bdR = S.bdR || {};
      var bid = a[1];
      if (a[2] === 'col') {
        if (S.bdC[bid] === a[3]) return false;
        S.bdC[bid] = a[3]; delete S.bdR[bid]; S.hs = null; return true;
      }
      if (a[2] === 'row') {
        var r = +a[3]; if (S.bdR[bid] === r) return false;
        S.bdR[bid] = r; return true;
      }
      return false;
    }
    if (a[0] === 'sd') {
      S.sdCol = S.sdCol || {};
      var pid = a[1];
      if ((S.sdCol[pid] || ((+pid % 2 === 0) ? 'L' : 'R')) === a[2]) return false;
      S.sdCol[pid] = a[2]; return true;
    }
    if (a[0] === 'dl') {
      var f = { bottom: 0, low: 0.25, mid: 0.5, high: 1 }[a[1]];
      if (f == null || u.lo == null) return false;
      var ny = u.lo + (u.hi - u.lo) * f;
      if (S.dlY === ny) return false;
      S.dlY = ny; return true;
    }
    if (a[0] === 'uv') {
      if ((S.uvQ || 'q1') === a[1]) return false;
      S.uvQ = a[1]; S.hs = null; return true;
    }
    if (a[0] === 'lv') {
      if ((S.lvQ || 'q3') === a[1]) return false;
      // A lower vertical may now stand under a big drawer — the solve puts a
      // fixed shelf between them — so nothing has to give way.
      S.lvQ = a[1];
      S.hs = null; return true;
    }
    return false;
  }

  // Vertical drag: shelves and half shelves by height, the big drawer by row.
  function drag(S, d, y) {
    if (d.move === 'sh') { S.shY[d.key] = clampY(d.lo, d.hi, y, y);
                           S.pin = S.pin || {}; S.pin[d.key] = 1; return true; }
    if (d.move === 'rs') { S.rsY[d.key] = clampY(d.lo, d.hi, y, y); return true; }
    if (d.move === 'hs') {
      var st = S.hs && S.hs[+d.key]; if (!st) return false;
      st.y = clampY(d.lo, d.hi, y, y); return true;
    }
    // A whole drawer stack riding on one line (the 1-door wardrobe). The
    // dragged value is the TOP of the stack, which is the drawer line itself.
    if (d.move === 'dl') {
      var ny = clampY(d.lo, d.hi, y, y);
      if (S.dlY === ny) return false;
      S.dlY = ny; return true;
    }
    if (d.move === 'bd' && d.key != null) {
      var LY = d.lineYs || []; if (!LY.length) return false;
      var bid = String(d.key).split('|')[1];
      var bi = 0, bmin = 1e12;
      LY.forEach(function (v, i) { var dd = Math.abs(v - y); if (dd < bmin) { bmin = dd; bi = i; } });
      S.bdR = S.bdR || {};
      if (S.bdR[bid] === bi) return false;
      S.bdR[bid] = bi; return true;
    }
    return false;
  }

  function onInputChange(S, key) {
    if (key === 'uhs' || key === 'lhs' || key === 'hsAll' || key === 'uv' || key === 'lv') S.hs = null;
  }

  return { VERSION: VERSION, INPUTS: INPUTS, fresh: fresh, clampY: clampY, outerIdx: outerIdx,
           shell: shell, locker: locker, callouts: callouts, layout: layout, drawBand: drawBand,
           place: place, alloc: alloc, drawerBox: drawerBox, handle: handle,
           slideOf: slideOf, DRAW_CTL: DRAW_CTL,
           layoutLevels: layoutLevels, levelTargets: levelTargets,
           bayOf: bayOf, zoneForBay: zoneForBay, bayTargets: bayTargets,
           bayMoveTo: bayMoveTo,
           levelMoveTo: levelMoveTo, levelName: levelName,
           targets: targets, moveTo: moveTo, drag: drag,
           onInputChange: onInputChange, QN: QN };
})();
