/* asm-3d-room.js — environment and materials for the SBS 3D viewer.
   Owns everything that decides how the scene LOOKS: lighting, the room
   (floor / walls / skirting) and the panel material set. Owns no rules and
   no geometry of the furniture itself, so it can be deployed on its own
   whenever only the appearance changes.

   Exposes window.ASM3DRoom.
   All textures are drawn procedurally in canvas — no external image files,
   which keeps the module drop-in with no asset pipeline in the repo. */
window.ASM3DRoom = (function () {
  'use strict';

  var _wood = null, _wall = null, _sky = null, _panel = null, _mats = {};

  /* ── procedural textures ──────────────────────────────────────── */

  // Oak plank floor at true scale: one tile spans 3200 mm over 1024 px,
  // so a 64 px plank = 200 mm wide and a 384 px plank = 1200 mm long.
  function woodTex(THREE) {
    if (_wood) return _wood;
    var c = document.createElement('canvas'); c.width = c.height = 1024;
    var x = c.getContext('2d');
    var tones = [[212,186,148],[204,177,139],[218,193,156],[198,170,132],[209,182,144]];
    var ph = 64, pl = 384;
    x.fillStyle = '#D2B694'; x.fillRect(0, 0, 1024, 1024);
    for (var row = 0; row < c.height / ph; row++) {
      var off = (row * 137) % pl;                       // staggered end joints
      for (var px = -pl; px < c.width + pl; px += pl) {
        var t = tones[(Math.random() * tones.length) | 0];
        x.fillStyle = 'rgb(' + t[0] + ',' + t[1] + ',' + t[2] + ')';
        x.fillRect(px + off, row * ph, pl - 1, ph - 1);
        for (var g = 0; g < 9; g++) {                   // lengthwise grain
          x.strokeStyle = 'rgba(150,118,80,' + (0.028 + Math.random() * 0.042) + ')';
          x.lineWidth = 0.5 + Math.random() * 1.1;
          var gy = row * ph + 3 + Math.random() * (ph - 6);
          x.beginPath(); x.moveTo(px + off, gy);
          x.bezierCurveTo(px + off + pl * 0.33, gy + (Math.random() * 2.4 - 1.2),
                          px + off + pl * 0.66, gy + (Math.random() * 2.4 - 1.2),
                          px + off + pl,        gy + (Math.random() * 1.6 - 0.8));
          x.stroke();
        }
        x.fillStyle = 'rgba(138,108,72,.34)'; x.fillRect(px + off + pl - 1, row * ph, 1, ph - 1);
      }
      x.fillStyle = 'rgba(132,103,68,.30)'; x.fillRect(0, row * ph + ph - 1, c.width, 1);
    }
    _wood = new THREE.CanvasTexture(c);
    _wood.wrapS = _wood.wrapT = THREE.RepeatWrapping;
    _wood.repeat.set(5, 5); _wood.anisotropy = 16;
    return _wood;
  }

  function wallTex(THREE) {
    if (_wall) return _wall;
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var x = c.getContext('2d');
    x.fillStyle = '#BFC0BD'; x.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 26000; i++) {
      x.fillStyle = 'rgba(120,108,92,' + (Math.random() * 0.05) + ')';
      x.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
    }
    _wall = new THREE.CanvasTexture(c);
    _wall.wrapS = _wall.wrapT = THREE.RepeatWrapping; _wall.repeat.set(5, 3);
    return _wall;
  }

  // Wardrobe veneer: vertical grain plus a little cathedral figure.
  function panelTex(THREE) {
    if (_panel) return _panel;
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var x = c.getContext('2d');
    x.fillStyle = '#8A6242'; x.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 260; i++) {
      var gx = Math.random() * 512;
      x.strokeStyle = 'rgba(' + (Math.random() < .5 ? '62,38,18,' : '176,126,78,') +
                      (0.05 + Math.random() * 0.16) + ')';
      x.lineWidth = 0.6 + Math.random() * 2.6;
      x.beginPath(); x.moveTo(gx, 0);
      x.bezierCurveTo(gx + (Math.random() * 16 - 8), 170,
                      gx + (Math.random() * 16 - 8), 340,
                      gx + (Math.random() * 12 - 6), 512);
      x.stroke();
    }
    for (var k = 0; k < 7; k++) {
      var cx = Math.random() * 512;
      x.strokeStyle = 'rgba(70,44,22,' + (0.05 + Math.random() * 0.07) + ')';
      x.lineWidth = 2 + Math.random() * 3;
      x.beginPath(); x.moveTo(cx, -20);
      x.quadraticCurveTo(cx + 40 + Math.random() * 50, 256, cx, 532); x.stroke();
    }
    _panel = new THREE.CanvasTexture(c);
    _panel.wrapS = _panel.wrapT = THREE.RepeatWrapping; _panel.anisotropy = 8;
    return _panel;
  }

  function skyTex(THREE) {
    if (_sky) return _sky;
    var c = document.createElement('canvas'); c.width = 4; c.height = 256;
    var x = c.getContext('2d');
    var gd = x.createLinearGradient(0, 0, 0, 256);
    gd.addColorStop(0, '#dfe4ea'); gd.addColorStop(.55, '#c6ccd3'); gd.addColorStop(1, '#b0b3a8');
    x.fillStyle = gd; x.fillRect(0, 0, 4, 256);
    _sky = new THREE.CanvasTexture(c);
    return _sky;
  }

  /* ── lighting (no shadows: deliberate, per spec) ──────────────── */
  function lights(THREE, scene) {
    scene.add(new THREE.HemisphereLight(0xeaf0f7, 0x9b8b78, 0.52));
    var k1 = new THREE.DirectionalLight(0xfff4e6, 0.62); k1.position.set(2800, 3600, 3200);
    var k2 = new THREE.DirectionalLight(0xd4e2f7, 0.30); k2.position.set(-3200, 1500, 2000);
    var k3 = new THREE.DirectionalLight(0xffffff, 0.20); k3.position.set(-600, 1400, -2600);
    scene.add(k1); scene.add(k2); scene.add(k3);
  }

  /* ── the room ─────────────────────────────────────────────────── */
  function build(THREE, group, o) {
    for (var i = group.children.length - 1; i >= 0; i--) {
      var c = group.children[i]; group.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    if (!o.show) return;
    var FL = 16000, WH = 3300;
    var zWall = -(o.D / 2 + 25), xWall = -(o.W / 2 + 1700);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(FL, FL),
      new THREE.MeshStandardMaterial({ map: woodTex(THREE), roughness: .72, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; group.add(floor);

    var wm = new THREE.MeshStandardMaterial({ map: wallTex(THREE), roughness: .97, metalness: 0 });
    var wa = new THREE.MeshStandardMaterial({ map: wallTex(THREE), color: o.accent || 0x4E7FA6,
                                              roughness: .97, metalness: 0 });
    var bw = new THREE.Mesh(new THREE.PlaneGeometry(FL, WH), wm);
    bw.position.set(0, WH / 2, zWall); group.add(bw);
    var lw = new THREE.Mesh(new THREE.PlaneGeometry(FL, WH), wa);
    lw.rotation.y = Math.PI / 2; lw.position.set(xWall, WH / 2, 0); group.add(lw);

    var sm = new THREE.MeshStandardMaterial({ color: 0xE4E1D9, roughness: .6 });
    var sb = new THREE.Mesh(new THREE.BoxGeometry(FL, 95, 22), sm);
    sb.position.set(0, 47, zWall + 11); group.add(sb);
    var sl = new THREE.Mesh(new THREE.BoxGeometry(22, 95, FL), sm);
    sl.position.set(xWall + 11, 47, 0); group.add(sl);
  }

  /* ── panel materials ──────────────────────────────────────────── */
  // Schematic palette: one colour per role, for checking rules.
  var COL = {
    carcass:0xc9a26b, side:0xbe9257, back:0x5b4a34, partition:0xa87a42, divider:0xCBAE7C,
    shelf:0xe0c48f, halfshelf:0xD6A94F, vertical:0xb98f57, drawer:0x8a5be0,
    bigdrawer:0xB07CF0, filler:0x8C7A5E, locker:0xE01E5A, lockerdoor:0xF0567F,
    border:0x9aa77a, skirting:0x8a6a3e, door:0x7cc4ff
  };
  var LEGEND = [
    ['Partition','#a87a42'], ['Divider shelf','#CBAE7C'], ['Vertical','#b98f57'],
    ['Shelf','#e0c48f'], ['Half shelf','#D6A94F'], ['Channel filler','#8C7A5E'],
    ['Small drawer','#8a5be0'], ['Big drawer','#B07CF0'], ['Locker','#E01E5A'], ['Door','#7cc4ff']
  ];
  // Roles that carry veneer on their outer face in realistic mode.
  var VENEER = { side:1, skirting:1, border:1, carcass:1 };

  function material(THREE, role, mode, op) {
    // Doors get ONE material per mode whose opacity is mutated, not a new
    // cached material per slider position — otherwise dragging the opacity
    // slider mints a material per step and the live door never updates.
    var k = mode + '|' + role;
    if (_mats[k]) {
      if (role === 'door' && op != null) _mats[k].opacity = Math.max(0.05, op / 100);
      return _mats[k];
    }
    var m;
    if (role === 'knob' || role === 'rod') {
      m = new THREE.MeshStandardMaterial({ color: 0xB9BDC4, roughness: .28, metalness: .8 });
    } else if (mode === 'real') {
      if (role === 'door') {
        m = new THREE.MeshStandardMaterial({ map: panelTex(THREE), color: 0xBE9B79,
          transparent: true, opacity: Math.max(.08, (op || 34) / 100),
          roughness: .45, metalness: .02, side: THREE.DoubleSide });
      } else if (VENEER[role]) {
        m = new THREE.MeshStandardMaterial({ map: panelTex(THREE), color: 0xC8B49C,
          roughness: .55, metalness: .02 });
      } else if (role === 'locker' || role === 'lockerdoor') {
        m = new THREE.MeshStandardMaterial({ color: 0xE2DED5, roughness: .5, metalness: .02 });
      } else if (role === 'back') {
        m = new THREE.MeshStandardMaterial({ color: 0xDCD7CC, roughness: .9, metalness: 0 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: 0xE7E3DA, roughness: .55, metalness: 0 });
      }
    } else {
      if (role === 'door') {
        m = new THREE.MeshStandardMaterial({ color: COL.door, transparent: true,
          opacity: (op || 14) / 100, roughness: .12, metalness: .15 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: COL[role] || 0x999999,
          roughness: .72, metalness: .02 });
      }
    }
    _mats[k] = m; return m;
  }

  // BoxGeometry face order: [+x, -x, +y, -y, +z, -z].
  // Sides, top and bottom take veneer on the OUTER face and the visible front
  // edge; every face looking into the cabinet is white laminate, as built.
  function faces(THREE, part, H, mode, op) {
    if (mode !== 'real') return material(THREE, part.role, mode, op);
    if (part.role !== 'side' && part.role !== 'carcass') return material(THREE, part.role, mode, op);
    var v = material(THREE, part.role, mode), w = material(THREE, 'inner', mode);
    var f = [w, w, w, w, w, w];
    if (part.role === 'side') f[part.x < 0 ? 1 : 0] = v;   // outer cheek
    else                      f[part.y > H / 2 ? 2 : 3] = v; // top up / bottom down
    f[4] = v;                                               // front edge
    return f;
  }

  return {
    lights: lights, build: build, sky: skyTex,
    material: material, faces: faces,
    COL: COL, LEGEND: LEGEND
  };
})();