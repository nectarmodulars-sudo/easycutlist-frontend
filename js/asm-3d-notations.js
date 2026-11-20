/* asm-3d-notations.js — dimension lines and material callouts for the SBS 3D viewer.
   Exposes window.ASM3DNotes. Knows nothing about furniture rules: it is handed a
   plain spec and draws it, so it can be deployed on its own whenever only the
   annotation style changes.

   spec = {
     W, H, D      overall size of the item (mm)
     zF           front face z (usually D/2)
     showDim      draw the overall W / H / D dimension lines
     showMat      draw the material callouts
     callouts: [ { from:[x,y,z], to:[x,y,z], text:'LEFT SIDE - 18MM MDF' }, ... ]
     dims:     [ { axis:'x'|'y'|'z', a, b, at:[..], text } ]   optional extras
   }

   Only the OVERALL width, height and depth are dimensioned by default — internal
   structure is deliberately left undimensioned (it would bury the model in text).
   A rule engine that really wants an internal dimension adds it via spec.dims. */
window.ASM3DNotes = (function () {
  'use strict';

  var TICK = 90;            // half-length of the end ticks, mm
  var _dimMat = null, _leadMat = null;

  function dimMat(THREE) {
    if (!_dimMat) _dimMat = new THREE.LineBasicMaterial(
      { color: 0xECB22E, transparent: true, opacity: 0.85 });
    return _dimMat;
  }
  var _gapMat = null;
  function gapMat(THREE) {
    if (!_gapMat) _gapMat = new THREE.LineBasicMaterial({ color: 0x1F6FD1, transparent: true, opacity: 0.95 });
    return _gapMat;
  }
  function leadMat(THREE) {
    if (!_leadMat) _leadMat = new THREE.LineBasicMaterial(
      { color: 0x2b2f36, transparent: true, opacity: 0.6 });
    return _leadMat;
  }

  function clear(group) {
    for (var i = group.children.length - 1; i >= 0; i--) {
      var c = group.children[i]; group.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
  }

  /* Builds the 3D line work and the HTML label elements.
     Returns the label array, which sync() then positions every frame. */
  function build(THREE, group, host, spec) {
    clear(group);
    if (host) host.innerHTML = '';
    var labels = [];
    if (!spec) return labels;

    var W = spec.W, H = spec.H, D = spec.D;
    var zF = (spec.zF != null) ? spec.zF : D / 2;
    var pts = [], lead = [];

    function V(x, y, z) { return new THREE.Vector3(x, y, z); }
    function label(v, text, kind) { labels.push({ v: v, t: text, k: kind }); }

    // vertical dimension at (x, z), running y0 → y1
    function dimV(x, z, y0, y1, txt, tk) {
      var T = tk || TICK;
      pts.push(V(x, y0, z), V(x, y1, z));
      pts.push(V(x - T, y0, z), V(x + T, y0, z));
      pts.push(V(x - T, y1, z), V(x + T, y1, z));
      label(V(x, (y0 + y1) / 2, z), txt, 'dim');
    }
    // horizontal dimension at (y, z), running x0 → x1
    function dimH(y, z, x0, x1, txt) {
      pts.push(V(x0, y, z), V(x1, y, z));
      pts.push(V(x0, y - TICK, z), V(x0, y + TICK, z));
      pts.push(V(x1, y - TICK, z), V(x1, y + TICK, z));
      label(V((x0 + x1) / 2, y, z), txt, 'dim');
    }
    // depth dimension at (x, y), running z0 → z1
    function dimZ(x, y, z0, z1, txt) {
      pts.push(V(x, y, z0), V(x, y, z1));
      pts.push(V(x, y - TICK, z0), V(x, y + TICK, z0));
      pts.push(V(x, y - TICK, z1), V(x, y + TICK, z1));
      label(V(x, y, (z0 + z1) / 2), txt, 'dim');
    }

    if (spec.showDim) {
      var zd = zF + 260;
      dimH(-230, zd, -W / 2, W / 2, String(Math.round(W)));
      dimV(-(W / 2) - 360, zd, 0, H, String(Math.round(H)));
      dimZ((W / 2) + 360, 60, -D / 2, D / 2, String(Math.round(D)));

      (spec.dims || []).forEach(function (d) {
        var p = d.at || [0, 0, zd];
        // a shelf-height dimension sits inside the unit: short ticks
        if (d.axis === 'y')      dimV(p[0], p[2], d.a, d.b, d.text, d.kind === 'gap' ? 35 : 0);
        else if (d.axis === 'z') dimZ(p[0], p[1], d.a, d.b, d.text);
        else                     dimH(p[1], p[2], d.a, d.b, d.text);
      });
    }

    // clear shelf gaps: a blue dimension line shelf-to-shelf with end ticks, tag in the middle
    var gapPts = [];
    (spec.gaps || []).forEach(function (g) {
      if (g.y0 != null && g.y1 != null) {
        gapPts.push(V(g.x, g.y0, g.z), V(g.x, g.y1, g.z));
        gapPts.push(V(g.x - 30, g.y0, g.z), V(g.x + 30, g.y0, g.z));
        gapPts.push(V(g.x - 30, g.y1, g.z), V(g.x + 30, g.y1, g.z));
      }
      label(V(g.x, g.y, g.z), g.text, 'gap');
    });

    if (spec.showMat) {
      (spec.callouts || []).forEach(function (c) {
        if (!c || !c.text) return;
        var a = c.from, b = c.to;
        lead.push(V(a[0], a[1], a[2]), V(b[0], b[1], b[2]));
        label(V(b[0], b[1], b[2]), c.text, 'mat');
      });
    }

    if (pts.length)
      group.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts), dimMat(THREE)));
    if (gapPts.length)
      group.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(gapPts), gapMat(THREE)));
    if (lead.length)
      group.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(lead), leadMat(THREE)));

    if (host) {
      labels.forEach(function (l) {
        var e = document.createElement('div');
        e.className = 'lb ' + l.k;
        e.textContent = l.t;
        host.appendChild(e);
        l.el = e;
      });
    }
    return labels;
  }

  /* Projects each label to screen space. Called once per animation frame by the
     core. The canvas may be inset inside its wrapper, so the canvas rect is
     offset against the parent rect rather than assumed to fill it. */
  function sync(labels, camera, canvas) {
    if (!labels || !labels.length || !canvas) return;
    var r = canvas.getBoundingClientRect();
    var pr = canvas.parentElement.getBoundingClientRect();
    var ox = r.left - pr.left, oy = r.top - pr.top;
    for (var i = 0; i < labels.length; i++) {
      var l = labels[i]; if (!l.el) continue;
      var v = l.v.clone().project(camera);
      if (v.z > 1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = 'block';
      l.el.style.transform = 'translate(-50%,-50%) translate(' +
        ((v.x * 0.5 + 0.5) * r.width + ox).toFixed(1) + 'px,' +
        ((-v.y * 0.5 + 0.5) * r.height + oy).toFixed(1) + 'px)';
    }
  }

  /* Clear height between shelves in each bay — the same numbers the
     Elevations tab prints (asm-elevations.js frontDims). Pure geometry from
     res.parts; doors are ignored. Returns [{x, y, z, text}] in mm. */
  var DOOR_ROLES = { door: 1, border: 1, glass: 1 };
  function shelfGaps(res) {
    var bs = [];
    (res && res.parts || []).forEach(function (pt) {
      if (DOOR_ROLES[pt.role] || pt.role === 'knob' || pt.role === 'rod' || pt.pivot) return;
      var w = pt.w, h = pt.h, d = pt.d;
      if (pt.shape || !(w > 0 && h > 0 && d > 0)) return;
      bs.push({ x0: pt.x - w / 2, x1: pt.x + w / 2, y0: pt.y - h / 2, y1: pt.y + h / 2,
                z0: pt.z - d / 2, z1: pt.z + d / 2 });
    });
    if (!bs.length) return [];
    var y0 = Infinity, y1 = -Infinity;
    bs.forEach(function (b) { y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); });
    var H = y1 - y0;
    var verts = bs.filter(function (b) {
      return (b.x1 - b.x0) <= 40 && (b.y1 - b.y0) >= 0.45 * H && (b.z1 - b.z0) >= 100;
    }).sort(function (a, b) { return a.x0 - b.x0; });
    var cols = [];
    verts.forEach(function (v) {
      var l = cols[cols.length - 1];
      if (l && v.x0 <= l.x1 + 1) l.x1 = Math.max(l.x1, v.x1); else cols.push({ x0: v.x0, x1: v.x1 });
    });
    var horiz = bs.filter(function (b) {
      return (b.y1 - b.y0) <= 40 && (b.x1 - b.x0) >= 80 && (b.z1 - b.z0) >= 100;
    });
    var out = [];
    for (var i = 0; i + 1 < cols.length; i++) {
      var a = cols[i].x1, b = cols[i + 1].x0;
      if (b - a <= 60) continue;
      var cx = (a + b) / 2, lx = a + (b - a) * 0.3;
      var hs = horiz.filter(function (h) { return h.x0 <= cx && h.x1 >= cx; })
        .sort(function (p, q) { return p.y0 - q.y0; });
      for (var j = 0; j + 1 < hs.length; j++) {
        var g0 = hs[j].y1, g1 = hs[j + 1].y0;
        if (g1 - g0 < 90) continue;
        out.push({ x: lx, y: (g0 + g1) / 2, y0: g0, y1: g1, z: Math.max(hs[j].z1, hs[j + 1].z1) - 20,
                   text: String(Math.round(g1 - g0)) });
      }
    }
    return out;
  }

  return { build: build, sync: sync, clear: clear, shelfGaps: shelfGaps };
})();
