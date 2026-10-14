/* asm-3d-core.js — the engine kernel for the live 3D view in Size Builder.
   Exposes window.ASM3D.

   What it owns
     · the registry  — a rule file calls ASM3D.register(code, def) whenever it
       happens to load, so load order stops mattering
     · lazy loading  — Three.js and one rule-engine file per category are fetched
       only when a 3D-capable item is actually opened
     · one renderer  — a single WebGL context and canvas, reused for every item,
       because browsers cap the number of live contexts
     · input mapping — SBS input keys → the values a rule engine asked for
     · parts → meshes, hover, pointer-capture drag, annotations, the render loop

   What it does NOT own
     · appearance  → asm-3d-room.js
     · annotations → asm-3d-notations.js
     · any rule    → js/rule-engines/<category>.js

   Public API
     ASM3D.available(ruleCode)       is there an engine for this rule code
     ASM3D.open(el, ctx)             mount the viewer into el; ctx = {ruleCode, inputs, item}
     ASM3D.update(inputs)            new SBS values for the item already open
     ASM3D.close()                   unmount, keep the renderer alive
     ASM3D.resize()                  call after the container changes size
     ASM3D.register(code, def)       called by rule files
*/
window.ASM3D = (function () {
  'use strict';

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

  var REG = {};              // ruleCode → rule definition
  var loading = {};          // url → promise, so nothing is fetched twice
  var cssDone = false;
  var THREE = null;

  /* ── viewer singletons ───────────────────────────────────────────── */
  var root = null, wrap = null, host = null, canvas = null, labHost = null,
      notesEl = null, noteBtn = null, hudEl = null, barEl = null, infoEl = null;
  // Right-click menu, and the badge naming what is selected. There is no hover
  // widget: hovering used to arm a part and disable the orbit, which made the
  // view feel sticky and fought the drag. Interaction is now explicit — click
  // to select, right-click for the move options, drag for height.
  var menuEl = null, badgeEl = null;
  var renderer = null, scene = null, camera = null, controls = null,
      group = null, roomG = null, annG = null, selG = null;
  var labels = [], movables = [];
  var looping = false, _wired = false;

  /* ── current item ────────────────────────────────────────────────── */
  var cur = null;            // {code, def, state, inputs, res, ui}
  var view = { room: true, real: true, dim: true, mat: false, doors: true, zones: false };

  /* ── loaders ─────────────────────────────────────────────────────── */

  function injectCss() {
    if (cssDone || !window.ASM3D_CSS) return;
    var s = document.createElement('style');
    s.id = 'asm3d-style';
    s.textContent = window.ASM3D_CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function script(url) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = url; s.async = false;
      s.onload = function () { ok(); };
      s.onerror = function () { delete loading[url]; fail(new Error('load failed: ' + url)); };
      document.head.appendChild(s);
    });
    return loading[url];
  }

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    return script(THREE_URL).then(function () {
      return script(ORBIT_URL);
    }).then(function () {
      THREE = window.THREE;
      if (!THREE || !THREE.OrbitControls) throw new Error('Three.js did not initialise');
      return THREE;
    });
  }

  // Pulls in the one category file that owns this rule code, cache-busted by the
  // manifest version so a rule fix reaches browsers the moment it is deployed.
  function loadRule(code) {
    if (REG[code]) return Promise.resolve(REG[code]);
    var M = window.ASM3D_RULES;
    if (!M || !M.files || !M.files[code])
      return Promise.reject(new Error('no rule engine registered for "' + code + '"'));
    // A code may name ONE file or a LIST: shared carcass code first, the engine
    // itself last. They load in order, because the engine reads what the
    // shared files put on the window.
    var list = M.files[code];
    if (typeof list === 'string') list = [list];
    var base = M.base || 'js/rule-engines/', v = '?v=' + (M.version || '1');
    return list.reduce(function (chain, f) {
      return chain.then(function () { return script(base + f + v); });
    }, Promise.resolve()).then(function () {
      if (!REG[code]) throw new Error('"' + list[list.length - 1] + '" did not register "' + code + '"');
      return REG[code];
    });
  }

  /* ── input mapping ───────────────────────────────────────────────── */

  // Master Sheet labels become input keys by lowercasing and collapsing every
  // run of non-alphanumerics to '_' — the same rule the parser uses.
  function norm(k) { return String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  function resolve(spec, inputs) {
    var src = {}, p = {};
    Object.keys(inputs || {}).forEach(function (k) { src[norm(k)] = inputs[k]; });
    Object.keys(spec || {}).forEach(function (name) {
      var d = spec[name], raw;
      for (var i = 0; i < d.from.length; i++) {
        var k = norm(d.from[i]);
        if (src[k] !== undefined && src[k] !== null && src[k] !== '') { raw = src[k]; break; }
      }
      if (d.type === 'str') { p[name] = (raw === undefined) ? d.def : String(raw); return; }
      var v = parseFloat(raw);
      if (!isFinite(v)) v = d.def;
      if (d.round) v = Math.round(v);
      if (d.min != null) v = Math.max(d.min, v);
      if (d.max != null) v = Math.min(d.max, v);
      p[name] = v;
    });
    return p;
  }

  /* ── the viewer shell ────────────────────────────────────────────── */

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildShell(mount) {
    if (wrap && wrap.parentElement === mount) return;
    injectCss();
    // root stacks the viewer and the toolbar; the toolbar is NOT inside the
    // 3D view any more. Floating over the model it covered the thing it was
    // there to control, and on a phone it covered most of it.
    root = el('div', 'asm3d-root');
    wrap = el('div', 'asm3d-wrap');
    host = el('div', 'asm3d-host');
    // The renderer is bound to ONE canvas for the life of the page. Making a
    // fresh one here on a remount left the renderer drawing into the old,
    // detached canvas — the view came back blank after Image → 3D → Image → 3D.
    if (!canvas) canvas = document.createElement('canvas');
    host.appendChild(canvas);
    labHost = el('div', 'asm3d-labels');
    hudEl = el('div', 'asm3d-hud');
    notesEl = el('div', 'asm3d-notes');
    barEl = el('div', 'asm3d-bar');
    menuEl = el('div', 'asm3d-menu');
    badgeEl = el('div', 'asm3d-sel');
    // The notes are behind a button. Printed in full they covered the model,
    // and the ones that matter are the ones you go and read.
    noteBtn = el('button', 'asm3d-notebtn', '');
    noteBtn.style.display = 'none';
    noteBtn.onclick = function (e) {
      e.stopPropagation();
      var on = notesEl.classList.toggle('open');
      noteBtn.classList.toggle('on', on);
    };

    // The figures and the selection go UNDER the view, not over it. Floating
    // at the corners they sat on top of the model, and on a phone the
    // selection card covered the part it was describing.
    infoEl = el('div', 'asm3d-info');
    infoEl.appendChild(hudEl); infoEl.appendChild(badgeEl);

    wrap.appendChild(host); wrap.appendChild(labHost);
    wrap.appendChild(noteBtn); wrap.appendChild(notesEl);
    wrap.appendChild(menuEl);
    root.appendChild(wrap); root.appendChild(infoEl); root.appendChild(barEl);
    mount.innerHTML = '';
    mount.appendChild(root);

    initThree();
    // The canvas is reused across mounts, so its listeners must be attached
    // exactly once — otherwise every reopen stacks another copy of them.
    if (!_wired) { wireInput(); _wired = true; }
  }

  function initThree() {
    if (renderer) { host.appendChild(canvas); return; }
    /* preserveDrawingBuffer so the canvas can be read back as an image after
       the frame has been presented — without it toDataURL comes back blank on
       most drivers, and the PDF needs a picture of the view the user framed. */
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true,
                                         preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;              // no shadows, deliberate
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);
    camera = new THREE.PerspectiveCamera(40, 2, 10, 60000);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;        // never orbit under the floor
    group = new THREE.Group(); scene.add(group);
    selG = new THREE.Group(); scene.add(selG);
    roomG = new THREE.Group(); scene.add(roomG);
    annG = new THREE.Group(); scene.add(annG);
    window.ASM3DRoom.lights(THREE, scene);
    if (!looping) { looping = true; loop(); }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!renderer || !wrap || !wrap.isConnected) return;
    controls.update();
    window.ASM3DNotes.sync(labels, camera, canvas);
    renderer.render(scene, camera);
  }

  /* ── toolbar ─────────────────────────────────────────────────────── */

  function toggle(label, key, on) {
    var b = el('button', on ? 'on' : null, label);
    b.onclick = function () {
      view[key] = !view[key];
      b.classList.toggle('on', view[key]);
      if (key === 'real') b.textContent = view.real ? 'Realistic' : 'Schematic';
      rebuild();
    };
    return b;
  }

  function buildBar(def) {
    barEl.innerHTML = '';
    barEl.appendChild(toggle(view.real ? 'Realistic' : 'Schematic', 'real', view.real));
    barEl.appendChild(toggle('Room', 'room', view.room));
    barEl.appendChild(toggle('Dims', 'dim', view.dim));
    barEl.appendChild(toggle('Materials', 'mat', view.mat));
    barEl.appendChild(toggle('Doors', 'doors', view.doors));
    var rst = el('button', null, 'Reset view');
    rst.onclick = frameCamera;
    barEl.appendChild(rst);

    // controls the rule engine asked for (door slide, opacity, …)
    cur.ui = {};
    (def.controls || []).forEach(function (c) {
      cur.ui[c.id] = c.val;
      // A <button> wrapper swallows the pointer drag, so the slider never
      // moved. It lives in a span styled to match the other toolbar buttons.
      var b = el('span', 'asm3d-ctl');
      var lab = el('span', 'lb', c.label);
      var out = el('span', 'val', String(c.val));
      var r = document.createElement('input');
      r.type = 'range'; r.min = c.min; r.max = c.max; r.value = c.val;
      b.appendChild(lab); b.appendChild(r); b.appendChild(out);
      r.addEventListener('input', function () {
        cur.ui[c.id] = +r.value;
        out.textContent = r.value;
        rebuild();
      });
      barEl.appendChild(b);
    });
  }

  /* ── build ───────────────────────────────────────────────────────── */

  function clearGroup(g) {
    for (var i = g.children.length - 1; i >= 0; i--) {
      var c = g.children[i]; g.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
  }

  var _edge = null, _edgeSoft = null, _doorEdge = null, _zoneMat = null,
      _selMat = null, _selFill = null;
  function edgeMats() {
    if (!_selMat) {
      // depthTest off: the selected part is usually behind a door or a side
      // panel, and an outline you cannot see is the same as no selection.
      _selMat = new THREE.LineBasicMaterial({ color: 0x4DA3FF, depthTest: false,
                                              transparent: true, opacity: 1 });
      _selFill = new THREE.MeshBasicMaterial({ color: 0x4DA3FF, depthTest: false,
                                               transparent: true, opacity: 0.45 });
    }
    if (!_edge) {
      _edge = new THREE.LineBasicMaterial({ color: 0x2b2f36, transparent: true, opacity: 0.55 });
      _edgeSoft = new THREE.LineBasicMaterial({ color: 0x5a5148, transparent: true, opacity: 0.22 });
      _doorEdge = new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.9 });
      _zoneMat = new THREE.LineBasicMaterial({ color: 0xECB22E, transparent: true, opacity: 0.5 });
    }
  }

  function meshFor(pt, p, mode) {
    var g, m;
    if (pt.shape === 'cyl-z') {
      g = new THREE.CylinderGeometry(pt.w / 2, pt.w / 2, pt.d, 18);
      g.rotateX(Math.PI / 2);
      m = new THREE.Mesh(g, window.ASM3DRoom.material(THREE, 'knob', mode));
    } else if (pt.shape === 'cyl-x') {
      g = new THREE.CylinderGeometry(pt.h / 2, pt.h / 2, pt.w, 16);
      g.rotateZ(Math.PI / 2);
      m = new THREE.Mesh(g, window.ASM3DRoom.material(THREE, 'rod', mode));
    } else {
      g = new THREE.BoxGeometry(Math.max(pt.w, 1), Math.max(pt.h, 1), Math.max(pt.d, 1));
      m = new THREE.Mesh(g, (pt.role === 'door')
        ? window.ASM3DRoom.material(THREE, 'door', mode, cur.ui.op)
        : window.ASM3DRoom.faces(THREE, pt, p.H, mode, cur.ui.op));
    }
    m.position.set(pt.x, pt.y, pt.z);
    return { mesh: m, geo: g };
  }

  function rebuild() {
    if (!cur || !cur.def) return;
    var p = cur.p = resolve(cur.def.inputs, cur.inputs);
    Object.keys(cur.ui || {}).forEach(function (k) { p[k] = cur.ui[k]; });
    p._variant = cur.variant || '';     // from the rule code, e.g. "cab:4h"
    p._item = cur.itemName || '';       // the catalogue name, for engines that
                                        // infer their variant from it

    var res;
    try {
      res = cur.def.solve(p, cur.state);
    } catch (err) {
      notesEl.innerHTML = '<div class="asm3d-note err">Rule engine "' + cur.code +
        '" failed: ' + (err && err.message ? err.message : err) + '</div>';
      return;
    }
    cur.res = res;

    var mode = view.real ? 'real' : 'schem';
    edgeMats();
    clearGroup(group);
    movables = [];

    res.parts.forEach(function (pt) {
      if (pt.role === 'door' && !view.doors) return;
      if (pt.role === 'knob' && pt.pivot && !view.doors) return;
      var built = meshFor(pt, p, mode);
      var m = built.mesh;
      m.userData = { tag: pt.tag || pt.role, move: pt.move, key: pt.key,
                     lo: pt.lo, hi: pt.hi, lineYs: pt.lineYs, noV: pt.noV, noL: pt.noL,
                     row: pt.row, note: pt.note };
      var edge = new THREE.LineSegments(new THREE.EdgesGeometry(built.geo),
        (pt.role === 'door') ? _doorEdge : (mode === 'real' ? _edgeSoft : _edge));
      edge.position.copy(m.position);

      if (pt.pivot) {                         // hinged door: rotate about its stile
        var piv = new THREE.Object3D();
        piv.position.set(pt.pivot.x, pt.pivot.y, pt.pivot.z);
        piv.rotation.y = pt.pivot.ry || 0;
        piv.rotation.x = pt.pivot.rx || 0;   // flap / hydraulic doors
        piv.add(m); piv.add(edge);
        group.add(piv);
      } else {
        group.add(m); group.add(edge);
      }
      if (pt.move) movables.push(m);
    });

    // A rule engine returns `mount` when its item hangs rather than stands.
    window.ASM3DRoom.build(THREE, roomG, { W: p.W, H: p.H, D: p.D, show: view.room,
                                           mount: res.mount || 0 });
    scene.background = view.room
      ? window.ASM3DRoom.sky(THREE)
      : new THREE.Color(0x111318);

    labels = window.ASM3DNotes.build(THREE, annG, labHost, {
      W: p.W, H: p.H, D: p.D, zF: p.D / 2,
      showDim: view.dim, showMat: view.mat,
      callouts: res.callouts || [], dims: res.dims || []
    });

    paintSel();
    hudEl.innerHTML = res.hud || '';
    var ns = res.notes || [];
    notesEl.innerHTML = ns.map(function (n) {
      return '<div class="asm3d-note ' + n[0] + '">' + n[1] + '</div>';
    }).join('');
    // The button takes the worst severity and says how many there are.
    var worst = ns.some(function (n) { return n[0] === 'err'; }) ? 'err'
              : ns.some(function (n) { return n[0] === 'warn'; }) ? 'warn' : 'ok';
    noteBtn.className = 'asm3d-notebtn ' + worst + (notesEl.classList.contains('open') ? ' on' : '');
    noteBtn.innerHTML = (worst === 'ok' ? '\u2713' : '\u26a0') + ' ' + ns.length;
    noteBtn.title = ns.length + ' note' + (ns.length === 1 ? '' : 's') + ' \u2014 click to read';
    noteBtn.style.display = ns.length ? 'block' : 'none';
    if (!ns.length) notesEl.classList.remove('open');
  }

  function frameCamera() {
    if (!cur || !cur.p) return;
    var p = cur.p;
    controls.target.set(0, p.H * 0.42, 0);
    camera.position.set(p.W * 0.85, p.H * 0.62, p.D + p.W * 1.6 + 2600);
    controls.update();
  }

  function resize() {
    hideMenu();
    if (!renderer || !wrap) return;
    var r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }

  /* ── selection + right-click menu ─────────────────────────────────
     The hover arrows are a quick nudge; the menu is the explicit one. A click
     selects a part (blue outline, kept across rebuilds by matching move+key,
     because every rebuild throws the meshes away), then a right-click lists the
     places the RULE ENGINE says that part may go — the core knows nothing about
     quarters or bays, it only renders def.targets() and calls def.moveTo(). */

  var sel = null;          // {move, key, tag, …} — the selected part's userData

  function sameAsSel(u) {
    return !!(sel && u && u.move === sel.move && String(u.key) === String(sel.key));
  }

  function paintSel() {
    if (!selG) return;
    clearGroup(selG);
    if (badgeEl) badgeEl.style.display = 'none';
    if (!sel) return;
    edgeMats();
    var n = 0;
    // A pair that moves together (two small drawers, say) shares one move+key,
    // so both light up and it is clear what the menu will shift.
    movables.forEach(function (m) {
      if (!sameAsSel(m.userData) || !m.geometry) return;
      n++;
      // A glowing skin over the part — a thin shelf gives an outline almost
      // nothing to draw, so the fill is what actually reads at a glance.
      // The geometry is CLONED: clearGroup() disposes what it removes, and
      // sharing the part's own geometry would destroy the part itself the next
      // time the selection changed without a rebuild.
      var g = m.geometry.clone();
      g.computeBoundingBox();
      var bb = g.boundingBox, PAD = 10;
      function gr(a, b) { var d = Math.max(0.001, b - a); return (d + PAD) / d; }
      var sc = [gr(bb.min.x, bb.max.x), gr(bb.min.y, bb.max.y), gr(bb.min.z, bb.max.z)];
      var fill = new THREE.Mesh(g, _selFill);
      fill.position.copy(m.position);
      fill.scale.set(sc[0], sc[1], sc[2]);
      fill.renderOrder = 998;
      selG.add(fill);
      var ln = new THREE.LineSegments(new THREE.EdgesGeometry(g), _selMat);
      ln.position.copy(m.position);
      ln.scale.set(sc[0], sc[1], sc[2]);
      ln.renderOrder = 999;
      selG.add(ln);
    });
    if (badgeEl && n) {
      // A part may carry a note of its own — a rule that applies to it only
      // where it currently stands. It shows while that part is selected.
      var cur2 = movables.filter(function (m) { return sameAsSel(m.userData); })[0];
      var note = cur2 && cur2.userData.note;
      badgeEl.innerHTML = '<b>' + (sel.tag || sel.move) + '</b>' +
        '<span>right-click to move' + (sel.lo != null ? ' \u00b7 drag for height' : '') + '</span>' +
        (note ? '<em>' + note + '</em>' : '');
      badgeEl.style.display = 'block';
    }
  }

  function select(u) {
    if (u && u.move) {
      if (sameAsSel(u)) { paintSel(); return; }
      sel = { move: u.move, key: u.key, tag: u.tag, lo: u.lo, hi: u.hi,
              lineYs: u.lineYs, noV: u.noV, noL: u.noL, row: u.row, note: u.note };
    } else {
      if (!sel) { hideMenu(); return; }
      sel = null;
    }
    hideMenu();
    paintSel();
  }

  function hideMenu() { if (menuEl) { menuEl.style.display = 'none'; menuEl.innerHTML = ''; } }

  function showMenu(e) {
    if (!menuEl || !sel || !cur || !cur.def) return;
    var list = [];
    if (cur.def.targets) {
      try { list = cur.def.targets(cur.state, sel, cur.res, cur.p) || []; }
      catch (err) { list = []; }
    }
    menuEl.innerHTML = '';
    var h = el('div', 'hd', 'Move \u00b7 ' + (sel.tag || sel.move));
    menuEl.appendChild(h);
    if (!list.length) {
      menuEl.appendChild(el('div', 'none', 'This part has nowhere else to go.'));
    } else {
      list.forEach(function (o) {
        var b = el('button', (o.current ? 'cur' : null), o.label +
          (o.current ? ' <span class="tick">\u25cf here</span>' : ''));
        if (o.disabled || o.current) b.disabled = true;
        b.onclick = function () {
          hideMenu();
          if (!cur.def.moveTo) return;
          if (cur.def.moveTo(cur.state, sel, o.id, cur.res)) rebuild();
        };
        menuEl.appendChild(b);
      });
    }
    // Placed against the wrapper, then pulled back inside it if it would spill.
    var pr = wrap.getBoundingClientRect();
    menuEl.style.display = 'block';
    menuEl.style.left = '0px'; menuEl.style.top = '0px';
    var mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    var x = e.clientX - pr.left, y = e.clientY - pr.top;
    menuEl.style.left = Math.max(4, Math.min(pr.width - mw - 4, x)) + 'px';
    menuEl.style.top = Math.max(4, Math.min(pr.height - mh - 4, y)) + 'px';
  }

  var ray = null, mouse = null;

  /* ── drag ────────────────────────────────────────────────────────── */
  /* The viewer can sit inside an iframe or a scrolled panel, where a mouseup
     released outside never arrives and the drag would stay live for ever.
     Pointer capture guarantees the release, and the extra listeners below are
     belt and braces for the cases capture itself is lost. */

  var dragging = null, dragPtr = null, dragPending = false, downXY = null;
  var dPlane = null, dPt = null, dNorm = null;

  function endDrag() {
    if (!dragging && dragPtr === null) return;
    dragging = null; dragPending = false;
    canvas.style.cursor = '';
    controls.enabled = true;
    if (dragPtr !== null) {
      try { canvas.releasePointerCapture(dragPtr); } catch (e) { /* already gone */ }
      dragPtr = null;
    }
  }

  function refreshDragRefs() {
    if (!dragging) return;
    for (var i = 0; i < movables.length; i++) {
      var u = movables[i].userData;
      if (u.move === dragging.move && String(u.key) === String(dragging.key)) {
        dragging.lo = u.lo; dragging.hi = u.hi; dragging.lineYs = u.lineYs;
        return;
      }
    }
  }

  function castAt(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
  }

  function wireInput() {
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    dPlane = new THREE.Plane(); dPt = new THREE.Vector3(); dNorm = new THREE.Vector3();

    // Cursor only — nothing is armed and the orbit is never disabled by a
    // hover, so the view stays free until a press actually lands on a part.
    canvas.addEventListener('mousemove', function (e) {
      if (dragging || e.buttons !== 0) return;
      castAt(e);
      var h = ray.intersectObjects(movables, false);
      canvas.style.cursor = h.length ? (h[0].object.userData.noV ? 'pointer' : 'ns-resize') : '';
    });

    canvas.addEventListener('pointerdown', function (e) {
      hideMenu();
      if (notesEl) { notesEl.classList.remove('open'); }
      if (noteBtn) { noteBtn.classList.remove('on'); }
      // Where the press started, so pointerup can tell a click from a drag.
      downXY = { x: e.clientX, y: e.clientY };
      if (e.button !== 0) return;
      // Raycast at the press itself. Nothing is armed by hovering any more, so
      // a press can only ever pick up the part actually under the pointer.
      castAt(e);
      var hit = ray.intersectObjects(movables, false);
      if (!hit.length) { controls.enabled = true; return; }   // orbit the room
      var obj = hit[0].object, u = obj.userData;
      // noV parts (a full-height vertical, a drawer pinned to its row) have no
      // height to drag, so the press is left to OrbitControls and only the
      // click-to-select on pointerup applies.
      if (!u.move || u.noV) { controls.enabled = true; return; }
      e.preventDefault(); e.stopPropagation();   // capture phase: beat OrbitControls
      controls.enabled = false;
      camera.getWorldDirection(dNorm);
      dPlane.setFromNormalAndCoplanarPoint(dNorm, obj.position.clone());
      dragging = { move: u.move, key: u.key, lo: u.lo, hi: u.hi, lineYs: u.lineYs };
      dragPtr = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
      canvas.style.cursor = 'grabbing';
    }, true);

    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (e.buttons === 0) { endDrag(); return; }   // released where we never heard
      castAt(e);
      if (!ray.ray.intersectPlane(dPlane, dPt)) return;
      if (cur.def.drag) cur.def.drag(cur.state, dragging, dPt.y);
      if (!dragPending) {                            // one rebuild per frame
        dragPending = true;
        requestAnimationFrame(function () {
          dragPending = false;
          if (!dragging) return;
          rebuild(); refreshDragRefs();
        });
      }
    });

    // A press that did not travel is a click, and a click selects. Registered
    // before endDrag so the selection is set whatever endDrag clears.
    canvas.addEventListener('pointerup', function (e) {
      if (e.button !== 0 || !downXY) return;
      var moved = Math.abs(e.clientX - downXY.x) + Math.abs(e.clientY - downXY.y);
      downXY = null;
      if (moved > 5) return;                     // that was a drag
      castAt(e);
      var h = ray.intersectObjects(movables, false);
      // NOTHING is stopped here. OrbitControls listens for pointermove and
      // pointerup on the DOCUMENT, not on the canvas, so swallowing this event
      // left its drag armed and the model kept orbiting with the bare mouse.
      select(h.length ? h[0].object.userData : null);
    });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      castAt(e);
      var h = ray.intersectObjects(movables, false);
      if (h.length) select(h[0].object.userData);   // right-click also selects
      if (!sel) { hideMenu(); return; }
      showMenu(e);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideMenu(); select(null); }
    });
    window.addEventListener('scroll', hideMenu, true);

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    // A button released anywhere, including over another element or outside
    // the window, must not leave the drag armed.
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    document.addEventListener('visibilitychange', function () { if (document.hidden) endDrag(); });
    window.addEventListener('resize', resize);
  }

  /* ── public API ──────────────────────────────────────────────────── */

  // A Master Sheet rule cell may name a variant: "cab:4h" loads the "cab"
  // engine and hands it "4h", so one engine can cover a family of items.
  function splitRule(code) {
    var c = String(code || '').trim().toLowerCase();
    var i = c.indexOf(':');
    return (i < 0) ? { code: c, arg: '' } : { code: c.slice(0, i), arg: c.slice(i + 1) };
  }

  function register(code, def) {
    if (!code || !def || typeof def.solve !== 'function') return;
    REG[code] = def;
  }

  function available(code) {
    if (!code) return false;
    var base = splitRule(code).code;
    if (REG[base]) return true;
    var M = window.ASM3D_RULES;
    return !!(M && M.files && M.files[base]);
  }

  function msg(mount, title, body) {
    injectCss();
    mount.innerHTML = '<div class="asm3d-wrap"><div class="asm3d-msg"><div><b>' +
      title + '</b>' + (body || '') + '</div></div></div>';
  }

  function spinner(mount, text) {
    injectCss();
    mount.innerHTML = '<div class="asm3d-wrap"><div class="asm3d-msg"><div>' +
      '<div class="asm3d-spin"></div>' + text + '</div></div></div>';
  }

  /* ctx = { ruleCode, inputs, item }  — inputs is the flat SBS key/value object */
  function open(mount, ctx) {
    if (!mount) return Promise.resolve(false);
    var code = ctx && ctx.ruleCode;
    if (!available(code)) {
      msg(mount, 'No 3D for this item',
        'Add a rule code in the Master Sheet to switch this item to a live 3D model.');
      return Promise.resolve(false);
    }
    spinner(mount, 'Loading 3D…');
    var rule = splitRule(code);
    return loadThree()
      .then(function () { return loadRule(rule.code); })
      .then(function (def) {
        cur = { code: rule.code, variant: rule.arg, itemName: ctx.item || '',
                def: def, inputs: ctx.inputs || {},
                state: def.newState ? def.newState() : {}, ui: {} };
        buildShell(mount);
        buildBar(def);
        resize();
        rebuild();
        frameCamera();
        return true;
      })
      .catch(function (err) {
        msg(mount, 'Could not load the 3D view',
          '<span style="font-size:11px;opacity:.8">' +
          (err && err.message ? err.message : String(err)) + '</span>');
        return false;
      });
  }

  /* New SBS values for the item already open. Only keys whose value actually
     changed are reported to the rule engine, so it can reset any interaction
     state that the change invalidates (half-shelf placement, for one). */
  function update(inputs) {
    if (!cur || !cur.def) return;
    var before = resolve(cur.def.inputs, cur.inputs);
    cur.inputs = inputs || {};
    var after = resolve(cur.def.inputs, cur.inputs);
    if (cur.def.onInputChange) {
      Object.keys(after).forEach(function (k) {
        if (before[k] !== after[k]) cur.def.onInputChange(cur.state, k, after[k], before[k]);
      });
    }
    rebuild();
  }

  function close() {
    endDrag();
    hideMenu(); sel = null;
    if (group) clearGroup(group);
    if (selG) clearGroup(selG);
    if (roomG) clearGroup(roomG);
    if (annG) clearGroup(annG);
    if (labHost) labHost.innerHTML = '';
    labels = []; movables = [];
    if (root && root.parentElement) root.parentElement.removeChild(root);
    cur = null;
  }

  /* A PNG of the view exactly as it stands — same camera, same door/drawer
     positions, and with the dimension and material labels painted in.

     Those labels are HTML divs sitting OVER the canvas, not geometry in the
     scene, so toDataURL on its own returns the model with every chip missing:
     the yellow dimension lines come out, the 2000 / 520 figures on them do
     not, and neither do the material callouts. They are drawn back on here,
     at the same screen positions, in the same colours. */
  function roundRect(cx, x, y, w, h, r) {
    if (cx.roundRect) { cx.beginPath(); cx.roundRect(x, y, w, h, r); return; }
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r);
    cx.closePath();
  }

  function snapshot(maxW) {
    if (!renderer || !scene || !camera || !canvas) return '';
    try {
      renderer.render(scene, camera);
      var k = (maxW && canvas.width > maxW) ? maxW / canvas.width : 1;
      var cv = document.createElement('canvas');
      cv.width = Math.round(canvas.width * k);
      cv.height = Math.round(canvas.height * k);
      var cx = cv.getContext('2d');
      // the WebGL canvas draws straight onto the 2D one: synchronous, with no
      // Image decode to wait on (an <img> from a data URL is not decoded when
      // src is assigned, which would have produced a blank picture)
      cx.drawImage(canvas, 0, 0, cv.width, cv.height);

      var cr = canvas.getBoundingClientRect();
      var sx = cr.width ? cv.width / cr.width : 1;
      var sy = cr.height ? cv.height / cr.height : 1;
      if (labHost) {
        Array.prototype.forEach.call(labHost.children, function (e) {
          var txt = (e.textContent || '').trim();
          if (!txt) return;
          var cs = window.getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          var r = e.getBoundingClientRect();
          if (!r.width || !r.height) return;
          var x = (r.left - cr.left) * sx, y = (r.top - cr.top) * sy;
          var w = r.width * sx, h = r.height * sy;
          if (x + w < 0 || y + h < 0 || x > cv.width || y > cv.height) return;
          var dim = e.classList.contains('dim');
          cx.fillStyle = dim ? 'rgba(17,19,26,.86)' : 'rgba(255,255,255,.95)';
          cx.strokeStyle = dim ? 'rgba(236,178,46,.55)' : 'rgba(0,0,0,.28)';
          cx.lineWidth = Math.max(1, sx);
          roundRect(cx, x, y, w, h, 4 * sx);
          cx.fill(); cx.stroke();
          var fpx = (parseFloat(cs.fontSize) || 11) * sy;
          cx.fillStyle = dim ? '#ECB22E' : '#1A1D21';
          cx.font = '700 ' + fpx.toFixed(1) + 'px ' +
                    (dim ? 'ui-monospace, Menlo, Consolas, monospace'
                         : 'system-ui, Arial, sans-serif');
          cx.textBaseline = 'middle';
          cx.textAlign = 'center';
          cx.fillText(txt, x + w / 2, y + h / 2);
        });
      }
      return cv.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  return {
    register: register, available: available,
    open: open, update: update, close: close, resize: resize,
    rebuild: rebuild, frame: frameCamera, snapshot: snapshot,
    get current() { return cur; }
  };
})();