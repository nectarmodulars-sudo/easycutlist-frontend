/* split-step2.js — second pass of breaking app-asm.js apart.

   Moves out:
     • Share                      → asm-share.js
     • CSV / Excel import         → asm-import.js
     • Pricing, coupons, Razorpay → asm-pricing.js
     • Save / list / load / delete / duplicate projects → asm-projects.js

   Deletes, as dead code:
     • the whole notifications block (startNotifications, fetchNotifications,
       markNotifRead, toggleNotifications's panel). Nothing calls it; the bell
       is force-hidden in updateAsmAuthUI with the comment "notifications
       retired — messaging replaces it". A no-op toggleNotifications is left
       behind so the public API keeps its shape.
     • promptCoupon(), written but never called — the coupon field inside the
       pricing modal replaced it.

   Still NOT split: catalogue, SBS and RIS. Those reassign sbsItems /
   readyItems / catalogue, so they need a shared-state seam and get their own
   pass.

   Run from the frontend repo root, AFTER split-step1.js:

       node split-step2.js
*/

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join('js', 'app-asm.js');
const L = a => a.join('\n');

if (!fs.existsSync(FILE)) {
  console.error('Not found: ' + FILE + '\nRun from the frontend repo root, or pass the path.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.indexOf('ASMProjects.init') !== -1) {
  console.log('Already split — nothing to do.');
  process.exit(0);
}
if (src.indexOf('ASMSupport.init') === -1) {
  console.error('Run split-step1.js first.');
  process.exit(1);
}
if (src.indexOf('duplicateProject') !== -1) {
  console.error('This file already has duplicateProject — it looks like apply-asm-patch.js was run.\n' +
                'Restore app-asm.js.bak, run this split first, then apply-features.js.');
  process.exit(1);
}

const dir = path.dirname(FILE);
['asm-share.js', 'asm-import.js', 'asm-pricing.js', 'asm-projects.js'].forEach(function (f) {
  if (!fs.existsSync(path.join(dir, f))) {
    console.error('Missing ' + path.join(dir, f) + ' — put all four new modules in place first.');
    process.exit(1);
  }
});

const ops = [];
const region = (label, startMark, endMark, replacement) => ops.push({ label, startMark, endMark, replacement });
const line = (label, oldStr, newStr) => ops.push({ label, oldStr, newStr });

/* ── 1. Notifications: delete ─────────────────────────────────────────── */

region('delete dead notifications',
  '  // ══ NOTIFICATIONS ══',
  '  function escapeHtml(s) {',
  L([
    '  // Notifications retired — the messaging thread replaced them and the bell',
    '  // is hidden in updateAsmAuthUI. Kept as a no-op so the public API, which',
    '  // every generated onclick depends on, does not change shape.',
    '  function toggleNotifications() {}',
    '',
    ''
  ])
);

/* ── 2. Share out ─────────────────────────────────────────────────────── */

region('openShare → ASMShare',
  '  // ══ SHARE ══',
  '  async function saveProject() {',
  L([
    '  // Share lives in asm-share.js.',
    '  function openShare() {',
    "    if (!window.ASMShare) { showToast('Share module not loaded', 'error'); return; }",
    '    ASMShare.init({ apiBase: apiBase, getToken: getAuthToken, showToast: showToast, escapeHtml: escapeHtml });',
    '    ASMShare.open();',
    '  }',
    '',
    ''
  ])
);

/* ── 3. Projects out ──────────────────────────────────────────────────── */

region('projects → ASMProjects',
  '  async function saveProject() {',
  L([
    '  // ========================================================================',
    '  // PDF EXPORT (delegated to asm-pdf-export.js / window.ASMPdf)'
  ]),
  L([
    '  // Projects live in asm-projects.js: it owns the modals and the HTTP. The',
    '  // state swap stays here, because loading a project REASSIGNS sbsItems and',
    '  // readyItems, and only this closure can do that.',
    '  function projectsCtx() {',
    '    return {',
    '      apiBase: apiBase,',
    '      getToken: getAuthToken,',
    '      showToast: showToast,',
    '      hasWork: function () { return readyItems.length > 0 || sbsItems.length > 0; },',
    '      getReadyItems: function () { return readyItems; },',
    '      getMeta: function () {',
    '        return { id: currentProjectId, name: currentProjectName, client: currentClientName };',
    '      },',
    '      setMeta: function (m) {',
    '        currentProjectId = m.id;',
    "        currentProjectName = m.name || '';",
    "        currentClientName = m.client || '';",
    '        syncProjectName();',
    "        const sb = document.querySelector('.asm-save-btn');",
    "        if (sb) sb.textContent = currentProjectId ? 'Edit' : 'Save';",
    '      },',
    '      applyProject: function (proj) {',
    '        sbsItems = [];',
    '        readyItems = proj.readyItems || [];',
    '        currentProjectId = proj.id;',
    '        currentProjectName = proj.name;',
    "        currentClientName = proj.clientName || '';",
    '        syncProjectName();',
    "        const sb = document.querySelector('.asm-save-btn');",
    "        if (sb) sb.textContent = 'Edit';",
    '        renderSBS();',
    '        renderReadyItems();',
    '      }',
    '    };',
    '  }',
    '',
    '  // Re-init on every call so the module always sees the current closure.',
    '  function useProjects() {',
    "    if (!window.ASMProjects) { showToast('Projects module not loaded', 'error'); return false; }",
    '    ASMProjects.init(projectsCtx());',
    '    return true;',
    '  }',
    '  function saveProject()        { if (useProjects()) ASMProjects.save(); }',
    '  function showProjects()       { if (useProjects()) ASMProjects.list(); }',
    '  function loadProject(id)      { if (useProjects()) ASMProjects.load(id); }',
    '  function deleteProject(id)    { if (useProjects()) ASMProjects.remove(id); }',
    '  function duplicateProject(id) { if (useProjects()) ASMProjects.duplicate(id); }',
    '',
    '  // ========================================================================',
    '  // PDF EXPORT (delegated to asm-pdf-export.js / window.ASMPdf)'
  ])
);

/* ── 4. Pricing out (and promptCoupon deleted with it) ────────────────── */

region('pricing → ASMPricing',
  "  let _asmCoupon = '';",
  L([
    '  // ========================================================================',
    '  // TOAST NOTIFICATIONS'
  ]),
  L([
    '  // Pricing, coupons and Razorpay live in asm-pricing.js. checkASMPlan()',
    '  // stays here: the plan it resolves drives the catalogue lock icons.',
    '  function pricingCtx() {',
    '    return {',
    '      apiBase: apiBase,',
    '      getToken: getAuthToken,',
    '      showToast: showToast,',
    "      onActivated: function () { asmPlan = 'pro'; checkASMPlan(); }",
    '    };',
    '  }',
    '  function showPricing() {',
    "    if (!window.ASMPricing) { showToast('Pricing module not loaded', 'error'); return; }",
    '    ASMPricing.init(pricingCtx());',
    '    ASMPricing.show();',
    '  }',
    '  function startASMPayment(planId) {',
    '    if (!window.ASMPricing) return;',
    '    ASMPricing.init(pricingCtx());',
    '    ASMPricing.pay(planId);',
    '  }',
    '',
    '  // ========================================================================',
    '  // TOAST NOTIFICATIONS'
  ])
);

/* ── 5. Import out ────────────────────────────────────────────────────── */

region('import → ASMImport',
  '  function showImportModal() {',
  '  // ── Public API ──',
  L([
    '  // Import lives in asm-import.js. It parses the file and hands the ready',
    '  // item back; pushing it onto readyItems stays here.',
    '  function showImportModal() {',
    "    if (!window.ASMImport) { showToast('Import module not loaded', 'error'); return; }",
    '    ASMImport.open({',
    '      catalogueKey: currentCatalogue,',
    '      showToast: showToast,',
    '      onImport: function (item) { readyItems.push(item); renderReadyItems(); }',
    '    });',
    '  }',
    '  function downloadSample() { if (window.ASMImport) ASMImport.downloadSample(); }',
    '  function doImport()       { if (window.ASMImport) ASMImport.run(); }',
    '',
    '  // ── Public API ──'
  ])
);

/* ── 6. Export the new name ───────────────────────────────────────────── */

line('public API · duplicateProject',
  '    saveProject, showProjects, loadProject, deleteProject,',
  '    saveProject, showProjects, loadProject, deleteProject, duplicateProject,'
);

/* ── verify, then write ───────────────────────────────────────────────── */

let bad = 0;
ops.forEach(function (op) {
  if (op.oldStr != null) {
    const n = src.split(op.oldStr).length - 1;
    if (n !== 1) { console.error('  x ' + op.label + ' — ' + n + ' matches, expected 1'); bad++; }
    return;
  }
  const a = src.split(op.startMark).length - 1;
  const b = src.split(op.endMark).length - 1;
  if (a !== 1 || b !== 1) {
    console.error('  x ' + op.label + ' — start ' + a + ', end ' + b + ' (both must be 1)');
    bad++; return;
  }
  if (src.indexOf(op.startMark) > src.indexOf(op.endMark)) {
    console.error('  x ' + op.label + ' — end marker precedes start marker');
    bad++;
  }
});
if (bad) {
  console.error('\n' + bad + ' anchor problem(s). Nothing was changed.');
  process.exit(1);
}

fs.writeFileSync(FILE + '.bak', src, 'utf8');
const before = src.length;

ops.forEach(function (op) {
  if (op.oldStr != null) { src = src.replace(op.oldStr, op.newStr); }
  else {
    const i = src.indexOf(op.startMark);
    const j = src.indexOf(op.endMark);
    src = src.slice(0, i) + op.replacement + src.slice(j);
  }
  console.log('  ok ' + op.label);
});

fs.writeFileSync(FILE, src, 'utf8');

try {
  new (require('vm').Script)(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
} catch (err) {
  fs.copyFileSync(FILE + '.bak', FILE);
  console.error('\nResult failed to parse — rolled back.\n' + err.message);
  process.exit(1);
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('\nDone. ' + kb(before) + ' → ' + kb(src.length) +
            '  (' + kb(before - src.length) + ' out). Backup: ' + FILE + '.bak');
console.log('Add to index.html BEFORE app-asm.js:');
['asm-share', 'asm-import', 'asm-pricing', 'asm-projects'].forEach(function (f) {
  console.log('  <script src="js/' + f + '.js"></script>');
});