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
    function dimV(x, z, y0, y1, txt) {
      pts.push(V(x, y0, z), V(x, y1, z));
      pts.push(V(x - TICK, y0, z), V(x + TICK, y0, z));
      pts.push(V(x - TICK, y1, z), V(x + TICK, y1, z));
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
        if (d.axis === 'y')      dimV(p[0], p[2], d.a, d.b, d.text);
        else if (d.axis === 'z') dimZ(p[0], p[1], d.a, d.b, d.text);
        else                     dimH(p[1], p[2], d.a, d.b, d.text);
      });
    }

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

  return { build: build, sync: sync, clear: clear };
})();
