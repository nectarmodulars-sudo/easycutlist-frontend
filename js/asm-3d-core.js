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
  var wrap = null, host = null, canvas = null, labHost = null, notesEl = null,
      hudEl = null, barEl = null, mover = null, moverLbl = null;
  var renderer = null, scene = null, camera = null, controls = null,
      group = null, roomG = null, annG = null;
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
    var url = (M.base || 'js/rule-engines/') + M.files[code] + '?v=' + (M.version || '1');
    return script(url).then(function () {
      if (!REG[code]) throw new Error('"' + M.files[code] + '" did not register "' + code + '"');
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
    mover = el('div', 'asm3d-mover');
    moverLbl = el('div', 'lbl', '');
    // Up/down as buttons as well as drag. Dragging is fiddly on a trackpad and
    // the widget itself can sit over the part you are trying to press, so the
    // arrows are the reliable path and the drag is the quick one.
    var padV = el('div', 'pad');
    var bu = el('button', null, '\u25b2'), bd = el('button', null, '\u25bc');
    padV.appendChild(bu); padV.appendChild(bd);
    var pad = el('div', 'pad');
    var bl = el('button', null, '\u25c0'), br = el('button', null, '\u25b6');
    pad.appendChild(bl); pad.appendChild(br);
    mover.appendChild(moverLbl); mover.appendChild(padV); mover.appendChild(pad);

    wrap.appendChild(host); wrap.appendChild(labHost); wrap.appendChild(hudEl);
    wrap.appendChild(notesEl); wrap.appendChild(barEl); wrap.appendChild(mover);
    mount.innerHTML = '';
    mount.appendChild(wrap);

    bl.onclick = function () { lateral(-1); };
    br.onclick = function () { lateral(1); };
    bu.onclick = function () { vstep(1); };
    bd.onclick = function () { vstep(-1); };
    mover.addEventListener('mouseenter', function () { overW = true; clearHide(); });
    mover.addEventListener('mouseleave', function () { overW = false; scheduleHide(); });

    initThree();
    // The canvas is reused across mounts, so its listeners must be attached
    // exactly once — otherwise every reopen stacks another copy of them.
    if (!_wired) { wireInput(); _wired = true; }
  }

  function initThree() {
    if (renderer) { host.appendChild(canvas); return; }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
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

  var _edge = null, _edgeSoft = null, _doorEdge = null, _zoneMat = null;
  function edgeMats() {
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
                     lo: pt.lo, hi: pt.hi, lineYs: pt.lineYs };
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

    window.ASM3DRoom.build(THREE, roomG, { W: p.W, H: p.H, D: p.D, show: view.room });
    scene.background = view.room
      ? window.ASM3DRoom.sky(THREE)
      : new THREE.Color(0x111318);

    labels = window.ASM3DNotes.build(THREE, annG, labHost, {
      W: p.W, H: p.H, D: p.D, zF: p.D / 2,
      showDim: view.dim, showMat: view.mat,
      callouts: res.callouts || [], dims: res.dims || []
    });

    hudEl.innerHTML = res.hud || '';
    notesEl.innerHTML = (res.notes || []).map(function (n) {
      return '<div class="asm3d-note ' + n[0] + '">' + n[1] + '</div>';
    }).join('');
  }

  function frameCamera() {
    if (!cur || !cur.p) return;
    var p = cur.p;
    controls.target.set(0, p.H * 0.42, 0);
    camera.position.set(p.W * 0.85, p.H * 0.62, p.D + p.W * 1.6 + 2600);
    controls.update();
  }

  function resize() {
    if (!renderer || !wrap) return;
    var r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }

  /* ── hover widget ────────────────────────────────────────────────── */

  var ray = null, mouse = null, active = null, overW = false, hideT = null;

  function clearHide() { if (hideT) { clearTimeout(hideT); hideT = null; } }
  function scheduleHide() {
    clearHide();
    hideT = setTimeout(function () {
      hideT = null;
      if (overW || dragging) return;
      mover.style.display = 'none'; active = null; controls.enabled = true;
    }, 420);
  }
  function screenOf(o) {
    var v = o.position.clone();
    if (o.parent && o.parent !== group) o.parent.localToWorld(v);
    v.project(camera);
    var r = canvas.getBoundingClientRect(), pr = wrap.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + (r.left - pr.left),
             y: (-v.y * 0.5 + 0.5) * r.height + (r.top - pr.top) };
  }

  // One step up or down, for parts the engine can move vertically without a drag.
  function vstep(dir) {
    if (!active || !cur.def.vstep) return;
    if (cur.def.vstep(cur.state, dir, active.userData, cur.res)) rebuild();
  }

  function lateral(dir) {
    if (!active || !cur.def.lateral) return;
    if (cur.def.lateral(cur.state, dir, active.userData, cur.res)) rebuild();
    mover.style.display = 'none'; active = null; controls.enabled = true;
  }

  /* ── drag ────────────────────────────────────────────────────────── */
  /* The viewer can sit inside an iframe or a scrolled panel, where a mouseup
     released outside never arrives and the drag would stay live for ever.
     Pointer capture guarantees the release, and the extra listeners below are
     belt and braces for the cases capture itself is lost. */

  var dragging = null, dragPtr = null, dragPending = false;
  var dPlane = null, dPt = null, dNorm = null;

  function endDrag() {
    if (!dragging && dragPtr === null) return;
    dragging = null; dragPending = false;
    canvas.style.cursor = '';
    active = null; mover.style.display = 'none';
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

    canvas.addEventListener('mousemove', function (e) {
      if (dragging || e.buttons !== 0) return;
      castAt(e);
      var h = ray.intersectObjects(movables, false);
      if (h.length) {
        active = h[0].object;
        moverLbl.textContent = active.userData.tag || '';
        canvas.style.cursor = 'ns-resize';
        controls.enabled = false;            // stop OrbitControls stealing the drag
        var lr = (active.userData.move !== 'sh') && !!cur.def.lateral;
        var vs = !!cur.def.vstep;
        bl.disabled = br.disabled = !lr;
        bu.disabled = bd.disabled = !vs;
        var s = screenOf(active);
        mover.style.left = s.x + 'px';
        mover.style.top = (s.y - 62) + 'px';
        mover.style.display = 'block';
        clearHide();
      } else if (!overW) {
        canvas.style.cursor = '';
        if (!hideT) scheduleHide();
      }
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !active) return;
      var u = active.userData;
      if (!u.move) return;
      e.preventDefault(); e.stopPropagation();   // capture phase: beat OrbitControls
      controls.enabled = false;
      camera.getWorldDirection(dNorm);
      dPlane.setFromNormalAndCoplanarPoint(dNorm, active.position.clone());
      dragging = { move: u.move, key: u.key, lo: u.lo, hi: u.hi, lineYs: u.lineYs };
      dragPtr = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
      mover.style.display = 'none';
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

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('pointerup', endDrag);
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
    if (group) clearGroup(group);
    if (roomG) clearGroup(roomG);
    if (annG) clearGroup(annG);
    if (labHost) labHost.innerHTML = '';
    labels = []; movables = []; active = null;
    if (wrap && wrap.parentElement) wrap.parentElement.removeChild(wrap);
    cur = null;
  }

  return {
    register: register, available: available,
    open: open, update: update, close: close, resize: resize,
    rebuild: rebuild, frame: frameCamera,
    get current() { return cur; }
  };
})();