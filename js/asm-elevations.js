/* asm-elevations.js — the "Elevations" tab of a Size Builder item.
   Exposes window.ASMElev. Load AFTER asm-3d-core.js, BEFORE app-asm.js.

   The drawings are not drawn by hand per item. They are projections of the
   same parts list the 3D view builds (ASM3D.solveOnly → res.parts), so they
   are exact, follow every input change, and keep any shelf the user moved in
   the 3D view.

     Front  — looking from the front (x across, y up). Doors on or off.
     Side   — a section: outer sides and verticals left out so the shelves,
              back, drawers and doors read (z across, front on the right).
     Plan   — a section from above: shelves, top and bottom left out.

   Shown only when the admin switch (asm_ui_settings.showElevations) is on;
   app-asm.js / asm-3d-view.js decide that, this file just draws.

       ASMElev.mount(el, { id, ruleCode, inputs, item })
 */
(function () {
  'use strict';

  var cssDone = false;
  var ST = {};                       // per item: which views, doors, dims

  function opts(id) {
    return ST[id] || (ST[id] = { front: true, side: true, top: false, doors: false, dims: true });
  }

  function css() {
    if (cssDone) return;
    cssDone = true;
    var s = document.createElement('style');
    s.id = 'asm-elev-style';
    s.textContent = [
      '.ael-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:#1A1D21;border:1px solid #2A2D31;border-radius:8px;margin-bottom:10px}',
      '.ael-bar .lb{font-size:11px;color:#8B8E94;margin-right:2px}',
      '.ael-bar button{height:28px;padding:0 10px;border:1px solid #3A3D42;border-radius:6px;background:#222529;color:#D1D2D3;font:600 12px inherit;font-family:inherit;cursor:pointer}',
      '.ael-bar button.on{border-color:#ECB22E;color:#ECB22E;background:rgba(236,178,46,.10)}',
      '.ael-bar .sp{width:1px;height:18px;background:#3A3D42;margin:0 4px}',
      '.ael-bar .gr{flex-grow:1}',
      '.ael-grid{display:flex;flex-wrap:wrap;gap:10px}',
      '.ael-fig{margin:0;flex:1 1 300px;min-width:0;background:#fff;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;color:#1A1D21}',
      '.ael-fig.front{flex:1.6 1 380px}',
      '.ael-fig figcaption{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;letter-spacing:.02em}',
      '.ael-fig figcaption span{font-weight:500;color:#5B636B;font-family:ui-monospace,Menlo,Consolas,monospace}',
      '.ael-fig svg{width:100%;height:auto;max-height:520px;display:block}',
      '.ael-msg{padding:24px;color:#8B8E94;font-size:13px}',
      '.ael-foot{margin-top:8px;font-size:11px;color:#8B8E94}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── parts → boxes in world mm ─────────────────────────────────────── */

  var DOOR_ROLES = { door: 1, border: 1, glass: 1 };

  function boxes(res, doors) {
    var out = [];
    (res.parts || []).forEach(function (pt) {
      var isDoor = DOOR_ROLES[pt.role] || (pt.role === 'knob' && pt.pivot);
      if (!doors && isDoor) return;
      var x = pt.x, y = pt.y, z = pt.z, w = pt.w, h = pt.h, d = pt.d;
      // a hinged part is placed relative to its hinge; drawn closed
      if (pt.pivot) { x += pt.pivot.x || 0; y += pt.pivot.y || 0; z += pt.pivot.z || 0; }
      if (pt.shape === 'cyl-z') h = w;            // knob: round, w across, d deep
      if (pt.shape === 'cyl-x') d = h;            // rod: along x, h across
      if (!(w > 0 && h > 0 && d > 0)) return;
      out.push({ role: pt.role || '', tag: pt.tag || pt.role || '', door: !!isDoor,
                 x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2,
                 z0: z - d / 2, z1: z + d / 2, round: !!pt.shape });
    });
    return out;
  }

  function extent(bs) {
    var e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    bs.forEach(function (b) {
      e.x0 = Math.min(e.x0, b.x0); e.x1 = Math.max(e.x1, b.x1);
      e.y0 = Math.min(e.y0, b.y0); e.y1 = Math.max(e.y1, b.y1);
      e.z0 = Math.min(e.z0, b.z0); e.z1 = Math.max(e.z1, b.z1);
    });
    return e;
  }

  /* ── styling by role ───────────────────────────────────────────────── */

  function look(b) {
    if (b.role === 'knob' || b.role === 'rod') return { f: '#6B7178', s: '#3A3D42' };
    if (b.door) return { f: '#F4F7FB', s: '#1A1D21' };
    if (b.role === 'back') return { f: '#F7F7F5', s: '#8B9097' };
    if (/drawer|lockerdoor/.test(b.role) && b.role !== 'drawerbox') return { f: '#FFFFFF', s: '#1A1D21' };
    if (b.role === 'skirting') return { f: '#D9DDE2', s: '#1A1D21' };
    return { f: '#E8EBEE', s: '#1A1D21' };
  }

  function R(n) { return Math.round(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── one projected view ────────────────────────────────────────────
     A view maps a box to (u0,u1,v0,v1) on paper plus a depth key; boxes are
     painted back to front. v is "up", so the SVG flips it. */

  var VIEWS = {
    front: {
      title: 'FRONT ELEVATION',
      map: function (b) { return [b.x0, b.x1, b.y0, b.y1, b.z1]; },
      skip: function () { return false; }
    },
    side: {
      title: 'SIDE SECTION',
      // front of the unit on the right, as seen from its left side
      map: function (b) { return [b.z0, b.z1, b.y0, b.y1, -b.x0]; },
      // outer sides and partitions would hide everything: leave out every
      // panel that is thin across x and stands tall
      skip: function (b, e) { return (b.x1 - b.x0) <= 40 && (b.y1 - b.y0) >= 0.3 * (e.y1 - e.y0); }
    },
    top: {
      title: 'PLAN SECTION',
      // front at the bottom of the sheet
      map: function (b) { return [b.x0, b.x1, -b.z1, -b.z0, b.y1]; },
      skip: function (b, e) { return (b.y1 - b.y0) <= 40 && (b.x1 - b.x0) >= 0.2 * (e.x1 - e.x0); }
    }
  };

  function dimH(out, u0, u1, v, txt, k, up) {        // horizontal dim line at paper v
    var t = 6 * k, ty = up ? v - 4 * k : v + 13 * k;
    out.push('<g class="dm"><line x1="' + u0 + '" y1="' + v + '" x2="' + u1 + '" y2="' + v + '"/>' +
      '<line x1="' + u0 + '" y1="' + (v - t) + '" x2="' + u0 + '" y2="' + (v + t) + '"/>' +
      '<line x1="' + u1 + '" y1="' + (v - t) + '" x2="' + u1 + '" y2="' + (v + t) + '"/></g>' +
      '<text class="dt" x="' + ((u0 + u1) / 2) + '" y="' + ty + '">' + txt + '</text>');
  }
  function dimV(out, u, v0, v1, txt, k, left) {        // vertical dim line at paper u
    var t = 6 * k, tx = left ? u - 5 * k : u + 13 * k, cy = (v0 + v1) / 2;
    out.push('<g class="dm"><line x1="' + u + '" y1="' + v0 + '" x2="' + u + '" y2="' + v1 + '"/>' +
      '<line x1="' + (u - t) + '" y1="' + v0 + '" x2="' + (u + t) + '" y2="' + v0 + '"/>' +
      '<line x1="' + (u - t) + '" y1="' + v1 + '" x2="' + (u + t) + '" y2="' + v1 + '"/></g>' +
      '<text class="dt" x="' + tx + '" y="' + cy + '" transform="rotate(-90 ' + tx + ' ' + cy + ')">' + txt + '</text>');
  }

  /* Openings of the front view: the bays between full-height panels, and in
     each bay the clear heights between the horizontal panels crossing it. */
  function frontDims(all, e, P, k, out) {
    var H = e.y1 - e.y0;
    var verts = all.filter(function (b) {
      return !b.door && (b.x1 - b.x0) <= 40 && (b.y1 - b.y0) >= 0.45 * H && (b.z1 - b.z0) >= 100;
    }).sort(function (a, b) { return a.x0 - b.x0; });
    // merge panels that overlap across x (a side and a partition touching)
    var cols = [];
    verts.forEach(function (v) {
      var l = cols[cols.length - 1];
      if (l && v.x0 <= l.x1 + 1) l.x1 = Math.max(l.x1, v.x1); else cols.push({ x0: v.x0, x1: v.x1 });
    });
    var bays = [];
    for (var i = 0; i + 1 < cols.length; i++) {
      var a = cols[i].x1, b = cols[i + 1].x0;
      if (b - a > 60) bays.push([a, b]);
    }
    if (bays.length > 1 || (bays.length === 1 && R(bays[0][1] - bays[0][0]) !== R(e.x1 - e.x0))) {
      var vb = P.v(e.y0) + 34 * k;
      bays.forEach(function (bb) { dimH(out, P.u(bb[0]), P.u(bb[1]), vb, R(bb[1] - bb[0]), k, false); });
    }
    // clear heights inside each bay
    var horiz = all.filter(function (b) {
      return !b.door && (b.y1 - b.y0) <= 40 && (b.x1 - b.x0) >= 80 && (b.z1 - b.z0) >= 100;
    });
    bays.forEach(function (bb) {
      var cx = (bb[0] + bb[1]) / 2;
      var hs = horiz.filter(function (h) { return h.x0 <= cx && h.x1 >= cx; })
        .sort(function (a, b) { return a.y0 - b.y0; });
      var u = P.u(bb[0]) + Math.min(46 * k, (P.u(bb[1]) - P.u(bb[0])) * 0.22);
      for (var j = 0; j + 1 < hs.length; j++) {
        var g0 = hs[j].y1, g1 = hs[j + 1].y0;
        if (g1 - g0 < 90) continue;
        if (Math.abs(P.v(g0) - P.v(g1)) < 22 * k) continue;      // too tight to read
        dimV(out, u, P.v(g0), P.v(g1), R(g1 - g0), k, false);
      }
    });
  }

  function draw(res, view, o, meta) {
    var V = VIEWS[view];
    var all = boxes(res, o.doors);
    if (!all.length) return '';
    var e = extent(all);
    var shown = all.filter(function (b) { return !V.skip(b, e); });
    // overall outline in this view; handles and knobs stick out and are left out of it
    var full = all.filter(function (b) { return b.role !== 'knob'; }).map(V.map);
    if (!full.length) full = all.map(V.map);
    var U0 = Infinity, U1 = -Infinity, V0 = Infinity, V1 = -Infinity;
    full.forEach(function (m) { U0 = Math.min(U0, m[0]); U1 = Math.max(U1, m[1]); V0 = Math.min(V0, m[2]); V1 = Math.max(V1, m[3]); });
    var wU = U1 - U0, wV = V1 - V0, big = Math.max(wU, wV);
    var k = big / 600;                        // 1 "paper px" in mm
    var mL = 60 * k, mR = (view === 'front' ? 30 : 40) * k, mT = 50 * k, mB = (view === 'front' ? 70 : 30) * k;
    var P = {
      u: function (u) { return +(u - U0 + mL).toFixed(1); },
      v: function (v) { return +(V1 - v + mT).toFixed(1); }
    };
    var VW = wU + mL + mR, VH = wV + mT + mB;

    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + R(VW) + ' ' + R(VH) + '" role="img" aria-label="' +
      esc(V.title + ' of ' + (meta.item || 'item')) + '">');
    out.push('<style>.pt{stroke-width:1;vector-effect:non-scaling-stroke}' +
      '.dm line{stroke:#1F6FD1;stroke-width:.8;vector-effect:non-scaling-stroke}' +
      '.dt{fill:#1F6FD1;font:500 ' + (15 * k).toFixed(1) + 'px ui-monospace,Menlo,Consolas,monospace;text-anchor:middle}' +
      '.ol{fill:none;stroke:#1A1D21;stroke-width:1.6;vector-effect:non-scaling-stroke}</style>');
    out.push('<rect width="100%" height="100%" fill="#ffffff"/>');

    var list = shown.map(function (b) { return { b: b, m: V.map(b) }; })
      .sort(function (a, b) { return a.m[4] - b.m[4]; });
    list.forEach(function (it) {
      var m = it.m, L = look(it.b);
      var x = P.u(m[0]), y = P.v(m[3]), w = +(P.u(m[1]) - P.u(m[0])).toFixed(1), h = +(P.v(m[2]) - P.v(m[3])).toFixed(1);
      if (w <= 0 || h <= 0) return;
      var shape = (it.b.round && view === 'front' && it.b.role === 'knob')
        ? '<ellipse class="pt" cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + (w / 2) + '" ry="' + (h / 2) + '"'
        : '<rect class="pt" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"';
      out.push(shape + ' fill="' + L.f + '" stroke="' + L.s + '"' +
        '><title>' + esc(it.b.tag) + ' · ' + R(it.b.x1 - it.b.x0) + ' × ' + R(it.b.y1 - it.b.y0) + ' × ' + R(it.b.z1 - it.b.z0) + '</title></' +
        (shape.indexOf('<ellipse') === 0 ? 'ellipse' : 'rect') + '>');
    });
    // a section still needs its outer shape
    if (view !== 'front') {
      out.push('<rect class="ol" x="' + P.u(U0) + '" y="' + P.v(V1) + '" width="' + (P.u(U1) - P.u(U0)) + '" height="' + (P.v(V0) - P.v(V1)) + '"/>');
    }

    if (o.dims) {
      var top = P.v(V1) - 22 * k, left = P.u(U0) - 26 * k;
      dimH(out, P.u(U0), P.u(U1), top, R(wU), k, true);
      dimV(out, left, P.v(V1), P.v(V0), R(wV), k, true);
      // behind closed doors the openings are not visible, so only overall sizes
      if (view === 'front' && !o.doors) frontDims(all, e, P, k, out);
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ── export ─────────────────────────────────────────────────────────── */

  function download(name, href) {
    var a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function toPng(svgText, name) {
    var blob = new Blob([svgText], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob), img = new Image();
    img.onload = function () {
      var vb = (svgText.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []);
      var w = +vb[1] || img.width, h = +vb[2] || img.height;
      var sc = 2400 / Math.max(w, h);
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      download(name + '.png', cv.toDataURL('image/png'));
    };
    img.src = url;
  }

  /* ── the tab ────────────────────────────────────────────────────────── */

  var _last = {};                    // id → { res, svgs } for export

  function bar(id) {
    var o = opts(id);
    function b(key, label) {
      return '<button class="' + (o[key] ? 'on' : '') + '" onclick="ASMElev.toggle(\'' + id + '\',\'' + key + '\')">' + label + '</button>';
    }
    return '<div class="ael-bar"><span class="lb">Show</span>' +
      b('front', 'Front') + b('side', 'Side') + b('top', 'Plan') +
      '<span class="sp"></span>' + b('doors', o.doors ? 'Doors: On' : 'Doors: Off') + b('dims', 'Dims') +
      '<span class="gr"></span>' +
      '<button onclick="ASMElev.exportPng(\'' + id + '\')">Download PNG</button>' +
      '<button onclick="ASMElev.exportSvg(\'' + id + '\')">SVG</button></div>';
  }

  function paint(el, ctx, res) {
    var o = opts(ctx.id), meta = { item: ctx.item };
    var svgs = {}, figs = [];
    ['front', 'side', 'top'].forEach(function (v) {
      if (!o[v]) return;
      var s = draw(res, v, o, meta);
      if (!s) return;
      svgs[v] = s;
      var sub = v === 'front' ? (o.doors ? 'doors on' : 'doors off') : (v === 'side' ? 'front on the right' : 'front at the bottom');
      figs.push('<figure class="ael-fig ' + v + '"><figcaption>' + VIEWS[v].title + ' · ' + sub +
        '<span>mm</span></figcaption>' + s + '</figure>');
    });
    _last[ctx.id] = { svgs: svgs, item: ctx.item || 'item' };
    el.innerHTML = bar(ctx.id) +
      (figs.length ? '<div class="ael-grid">' + figs.join('') + '</div>' : '<div class="ael-msg">Pick a view to show.</div>') +
      '<div class="ael-foot">Drawn from the 3D model of this item. Hover a part for its size. Shelves moved in 3D View show here too.</div>';
  }

  var _ctx = {};                     // id → last mount ctx, so toggles can redraw

  function mount(el, ctx) {
    if (!el || !ctx) return;
    css();
    _ctx[ctx.id] = { el: el, ctx: ctx };
    if (!window.ASM3D || !ASM3D.solveOnly) { el.innerHTML = '<div class="ael-msg">Elevations need the 3D engine.</div>'; return; }
    if (!el.firstChild) el.innerHTML = '<div class="ael-msg">Drawing elevations…</div>';
    ASM3D.solveOnly({ ruleCode: ctx.ruleCode, inputs: ctx.inputs, item: ctx.item })
      .then(function (r) { paint(el, ctx, r.res); })
      .catch(function (err) {
        el.innerHTML = '<div class="ael-msg">Could not draw elevations: ' + esc(err && err.message ? err.message : err) + '</div>';
      });
  }

  function toggle(id, key) {
    var o = opts(id);
    o[key] = !o[key];
    var m = _ctx[id];
    if (m && m.el && m.el.isConnected) mount(m.el, m.ctx);
  }

  function fname(id, v) {
    var L = _last[id];
    return String((L && L.item) || 'item').replace(/[^\w\-]+/g, '_') + '_' + v;
  }

  function exportPng(id) {
    var L = _last[id]; if (!L) return;
    Object.keys(L.svgs).forEach(function (v, i) {
      setTimeout(function () { toPng(L.svgs[v], fname(id, v)); }, i * 400);
    });
  }

  function exportSvg(id) {
    var L = _last[id]; if (!L) return;
    Object.keys(L.svgs).forEach(function (v, i) {
      setTimeout(function () {
        download(fname(id, v) + '.svg', URL.createObjectURL(new Blob([L.svgs[v]], { type: 'image/svg+xml' })));
      }, i * 400);
    });
  }

  /* For the PDF: front (doors off) + side section as SVG strings, from the
     same parts list. Resolves {} when the item has no 3D rule. */
  function pdfSvgs(ctx) {
    if (!window.ASM3D || !ASM3D.solveOnly || !ctx || !ctx.ruleCode) return Promise.resolve({});
    var o = { front: true, side: true, top: false, doors: false, dims: true };
    return ASM3D.solveOnly({ ruleCode: ctx.ruleCode, inputs: ctx.inputs, item: ctx.item })
      .then(function (r) {
        var out = {};
        ['front', 'side'].forEach(function (v) { var s = draw(r.res, v, o, { item: ctx.item }); if (s) out[v] = s; });
        return out;
      })
      .catch(function () { return {}; });
  }

  window.ASMElev = { mount: mount, toggle: toggle, exportPng: exportPng, exportSvg: exportSvg, pdfSvgs: pdfSvgs,
                     _draw: draw, _boxes: boxes };
})();
