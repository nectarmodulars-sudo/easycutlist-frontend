/* asm-autosave.js — unsaved-changes tracking, silent auto-save and the
   "Unsaved changes" warning for the Size Builder. Load BEFORE app-asm.js.

   Split out of app-asm.js. Holds only its own counters; project state is read
   through ctx so the core stays the one owner of readyItems / sbsItems.

       const S = ASMAutosave.create({ getProjectId, getReady, getSbs,
         syncProjectName, projectsCtx, useProjects, escapeHtml, showToast });
 */

(function () {
  'use strict';

  function create(ctx) {
    // _rev goes up on every RIS change; _savedRev is the rev the server has.
    // Once a project has an id, every RIS change is saved silently (debounced).
    let _rev = 0, _savedRev = 0, _dirty = false, _saveState = '';
    let _autoTimer = null, _autoBusy = false;

    function markDirty() {
      _rev++; _dirty = true;
      if (ctx.getProjectId()) autoSaveSoon();
      ctx.syncProjectName();
    }
    function markClean(rev) {
      _savedRev = (rev == null) ? _rev : rev;
      _dirty = _rev !== _savedRev;
      _saveState = '';
      ctx.syncProjectName();
    }
    function autoSaveSoon() {
      clearTimeout(_autoTimer);
      _autoTimer = setTimeout(runAutoSave, 700);
    }
    async function runAutoSave() {
      if (!ctx.getProjectId() || !_dirty) return;
      if (_autoBusy) { autoSaveSoon(); return; }   // one save at a time
      if (!window.ASMProjects || !ASMProjects.quickSave) return;
      _autoBusy = true; _saveState = 'saving'; ctx.syncProjectName();
      const rev = _rev;
      ASMProjects.init(ctx.projectsCtx());
      const ok = await ASMProjects.quickSave();
      _autoBusy = false;
      if (ok) markClean(rev);                       // newer edits stay dirty
      else { _saveState = 'error'; ctx.syncProjectName(); }
      if (_dirty && ctx.getProjectId() && ok) autoSaveSoon();
    }

    // Work that would be lost: RIS not on the server, or items open in SBS.
    function unsavedInfo() {
      const ris = ctx.getReady().length > 0 && (!ctx.getProjectId() || _dirty);
      const sbs = ctx.getSbs().length;
      return { ris: ris, sbs: sbs, any: ris || sbs > 0 };
    }

    // Ask before an action that drops or hides unsaved work. proceed() runs
    // when the user picks Save (after the save succeeds) or Discard.
    function guardUnsaved(actionLabel, proceed) {
      const u = unsavedInfo();
      if (!u.any) { proceed(); return; }

      let modal = document.getElementById('asm-unsaved-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'asm-unsaved-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10004;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';

      const lines = [];
      if (u.ris) lines.push(ctx.getProjectId()
        ? 'Latest changes to Ready Items are not saved yet.'
        : 'This project has not been saved.');
      if (u.sbs) lines.push(u.sbs + ' item' + (u.sbs > 1 ? 's are' : ' is') +
        ' still open in the builder and not saved to Ready Items. ' +
        (u.sbs > 1 ? 'They' : 'It') + ' will not be included.');

      const box = document.createElement('div');
      box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:12px;width:420px;max-width:92vw;overflow:hidden';
      box.innerHTML =
        '<div style="padding:16px 20px;background:#222529;border-bottom:1px solid #3A3D42">' +
          '<h3 style="margin:0;color:#ECB22E;font-size:15px">Unsaved changes</h3></div>' +
        '<div style="padding:18px 20px;color:#D1D2D3;font-size:13px;line-height:1.5">' +
          lines.map(l => '<div style="margin-bottom:6px">' + ctx.escapeHtml(l) + '</div>').join('') +
        '</div>';

      const foot = document.createElement('div');
      foot.style.cssText = 'padding:12px 20px;background:#222529;border-top:1px solid #3A3D42;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap';

      const cancel = document.createElement('button');
      cancel.className = 'asm-btn asm-btn-ghost';
      cancel.textContent = 'Cancel';
      cancel.onclick = () => modal.remove();

      const discard = document.createElement('button');
      discard.className = 'asm-btn asm-btn-ghost';
      discard.style.cssText = 'color:#E01E5A;border-color:#E01E5A';
      discard.textContent = (actionLabel || 'Continue') + ' without saving';
      discard.onclick = () => { modal.remove(); proceed(); };

      foot.appendChild(cancel);
      foot.appendChild(discard);

      if (ctx.getReady().length) {
        const save = document.createElement('button');
        save.className = 'asm-btn asm-btn-primary';
        save.textContent = 'Save & ' + (actionLabel || 'continue').toLowerCase();
        save.onclick = async () => {
          modal.remove();
          if (!ctx.useProjects()) return;
          if (ctx.getProjectId()) {                      // known project: save silently
            clearTimeout(_autoTimer);
            _saveState = 'saving'; ctx.syncProjectName();
            const rev = _rev;
            const ok = await ASMProjects.quickSave();
            if (ok) { markClean(rev); proceed(); }
            else { _saveState = 'error'; ctx.syncProjectName(); ctx.showToast('Save failed — nothing was closed', 'error'); }
          } else {
            ASMProjects.save(proceed);                 // first save: name it first
          }
        };
        foot.appendChild(save);
      }

      box.appendChild(foot);
      modal.appendChild(box);
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    // Browser close / refresh / navigate away: only the browser's own prompt is
    // allowed here, a custom dialog is not possible.
    window.addEventListener('beforeunload', function (e) {
      const page = document.getElementById('asm-fullpage');
      if (!page) return;
      if (unsavedInfo().any) { e.preventDefault(); e.returnValue = ''; return ''; }
    });

    return {
      markDirty: markDirty,
      markClean: markClean,
      unsavedInfo: unsavedInfo,
      guardUnsaved: guardUnsaved,
      cancel: function () { clearTimeout(_autoTimer); },
      isDirty: function () { return _dirty; },
      saveState: function () { return _saveState; },
      // project deleted on the server: dirty again if there is anything to lose
      setDirty: function (d) { _dirty = !!d; _saveState = ''; ctx.syncProjectName(); }
    };
  }

  window.ASMAutosave = { create: create };
})();
