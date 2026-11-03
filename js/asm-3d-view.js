/* asm-3d-view.js — the Image | 3D View | Output sizes tabs of a Size
   Builder item and the single shared WebGL view (asm-3d-core.js / ASM3D).
   Load BEFORE app-asm.js.

   Split out of app-asm.js. Owns which item has the live 3D view and which tab
   each item is on; reads items and schemas through ctx.

       const V = ASMView.create({ getSbs, getSchemas, showToast, buildVideoBtn });
 */

(function () {
  'use strict';

  function create(ctx) {
    // === Live 3D view (rule-engine driven) ==================================
    // One WebGL context is shared by the whole page, so exactly one item can
    // show its 3D model at a time. Everything else keeps the image view.
    let _active3d = null;                    // instanceId currently showing 3D

    function has3D(schema) {
      return !!(schema && schema.ruleCode && window.ASM3D && ASM3D.available(schema.ruleCode));
    }

    // Diagram section contents: plain images when the item has no rule code,
    // tabbed Image | 3D when it has one.
    function buildDiagramBody(inst, schema, imagesHtml) {
      const imgPane = imagesHtml + ctx.buildVideoBtn(schema);
      if (!has3D(schema)) return imgPane;
      const id = inst.instanceId, on = (_active3d === id);
      return '<div class="asm-view-tabs">' +
          '<button class="asm-view-tab' + (on ? '' : ' on') + '" id="tabimg_' + id + '" ' +
            'onclick="ASMModule.showImageView(\'' + id + '\')"><span class="dot"></span>Image</button>' +
          '<button class="asm-view-tab' + (on ? ' on' : '') + '" id="tab3d_' + id + '" ' +
            'onclick="ASMModule.show3DView(\'' + id + '\')"><span class="dot"></span>3D View</button>' +
          '<button class="asm-view-tab" id="tabout_' + id + '" ' +
            'onclick="ASMModule.showOutView(\'' + id + '\')"><span class="dot"></span>Output sizes</button>' +
        '</div>' +
        '<div class="asm-view-pane" id="paneimg_' + id + '"' + (on ? ' style="display:none"' : '') + '>' + imgPane + '</div>' +
        '<div class="asm-view-pane asm3d-mount" id="pane3d_' + id + '"' + (on ? '' : ' style="display:none"') + '></div>' +
        /* the output table is parked here when its tab is picked; it lives
           further down the item until then */
        '<div class="asm-view-pane asm-out-pane" id="paneout_' + id + '" style="display:none"></div>';
    }

    /* Which tab each item is on. A full re-render rebuilds the item from the
       template, which puts the tabs back to their default and the output block
       back at its anchor — so the tab has to be re-applied afterwards, the same
       way the 3D canvas is remounted. Without this, typing a value made the
       Output sizes pane go blank. */
    const _viewMode = {};

    function setViewTabs(instanceId, mode) {
      _viewMode[instanceId] = mode;
      const t1 = document.getElementById('tabimg_' + instanceId);
      const t2 = document.getElementById('tab3d_' + instanceId);
      const t3 = document.getElementById('tabout_' + instanceId);
      const p1 = document.getElementById('paneimg_' + instanceId);
      const p2 = document.getElementById('pane3d_' + instanceId);
      const p3 = document.getElementById('paneout_' + instanceId);
      if (t1) t1.classList.toggle('on', mode === 'img');
      if (t2) t2.classList.toggle('on', mode === '3d');
      if (t3) t3.classList.toggle('on', mode === 'out');
      if (p1) p1.style.display = (mode === 'img') ? '' : 'none';
      if (p2) p2.style.display = (mode === '3d') ? '' : 'none';
      if (p3) p3.style.display = (mode === 'out') ? '' : 'none';
      parkOutputs(instanceId, mode === 'out');
    }

    /* The output table is one block in the item. For the Output sizes tab it is
       MOVED into the tab pane and moved back when another tab is picked, so
       there is only ever one copy of it and every id and handler on its rows
       keeps working. `outhome_` is the empty anchor it came from. */
    function parkOutputs(instanceId, inPane) {
      const blk = document.getElementById('out_' + instanceId);
      const home = document.getElementById('outhome_' + instanceId);
      const pane = document.getElementById('paneout_' + instanceId);
      if (!blk || !home || !pane) return;
      if (inPane) { if (blk.parentNode !== pane) pane.appendChild(blk); blk.style.display = ''; }
      else {
        if (blk.parentNode !== home.parentNode) home.parentNode.insertBefore(blk, home.nextSibling);
        blk.style.display = 'none';
      }
    }

    /* Leaving the 3D tab only HIDES the pane. Closing the viewer would throw
       away the camera angle and every shelf the user had moved, so coming back
       showed a freshly solved model in default positions. The canvas stays
       alive in the hidden pane; it is closed only when another item takes the
       single WebGL context, or when the DOM is rebuilt. */
    function showOutView(instanceId) {
      setViewTabs(instanceId, 'out');
    }

    function showImageView(instanceId) {
      setViewTabs(instanceId, 'img');
    }

    function show3DView(instanceId) {
      const inst = ctx.getSbs().find(i => i.instanceId === instanceId);
      if (!inst) return;
      const schema = ctx.getSchemas()[inst.itemId];
      if (!has3D(schema)) { ctx.showToast('No 3D rule set for this item', 'error'); return; }
      // only one live WebGL view at a time
      if (_active3d && _active3d !== instanceId) {
        try { ASM3D.close(); } catch (e) {}
        setViewTabs(_active3d, 'img');
      }
      const mount = document.getElementById('pane3d_' + instanceId);
      if (!mount) return;
      /* the viewer is still alive in the hidden pane — show it as the user left
         it instead of solving the item again from scratch */
      if (_active3d === instanceId && ASM3D.current && mount.firstChild) {
        setViewTabs(instanceId, '3d');
        setTimeout(function () { try { ASM3D.resize(); } catch (e) {} }, 0);
        return;
      }
      _active3d = instanceId;
      setViewTabs(instanceId, '3d');
      ASM3D.open(mount, { ruleCode: schema.ruleCode, inputs: inst.inputs, item: inst.itemName })
        .then(function (ok) { if (!ok) { _active3d = null; } });
    }

    // Called after any full re-render, which throws the canvas away with the DOM.
    function remount3D() {
      // every item that was showing its output table gets it back
      ctx.getSbs().forEach(function (i) {
        if (_viewMode[i.instanceId] === 'out') setViewTabs(i.instanceId, 'out');
      });
      if (!_active3d) return;
      const id = _active3d;
      if (!ctx.getSbs().some(i => i.instanceId === id)) {   // the item is gone
        try { ASM3D.close(); } catch (e) {}
        _active3d = null;
        return;
      }
      _active3d = null;
      show3DView(id);
    }

    // Push new SBS values into the open model. No rebuild of the DOM, so the
    // user's camera angle and any dragged shelf positions survive.
    function push3D(instanceId) {
      if (_active3d !== instanceId || !window.ASM3D) return;
      const inst = ctx.getSbs().find(i => i.instanceId === instanceId);
      if (inst) { try { ASM3D.update(inst.inputs); } catch (e) {} }
    }

    return {
      has3D: has3D, buildDiagramBody: buildDiagramBody, setViewTabs: setViewTabs,
      showOutView: showOutView, showImageView: showImageView, show3DView: show3DView,
      remount3D: remount3D, push3D: push3D,
      active: function () { return _active3d; },          // instanceId with the live 3D view
      mode: function (id) { return _viewMode[id]; }       // 'img' | '3d' | 'out' | undefined
    };
  }

  window.ASMView = { create: create };
})();
