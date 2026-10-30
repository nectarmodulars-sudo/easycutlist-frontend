/* split-step1.js — first pass of breaking app-asm.js apart.

   Moves out, into files that already exist beside it:
     • the Edge Band modal            → asm-eband.js
     • problem reporting + My Messages
       + the screenshot attach helpers → asm-support.js

   Nothing is renamed. Both modules take what they need as arguments, the same
   way asm-pdf-export.js and ASMQuote already do, so no shared-state surgery is
   involved and the public ASMModule API is unchanged — every inline onclick in
   the generated HTML keeps working.

   Run from the frontend repo root:

       node split-step1.js

   Writes app-asm.js.bak, edits app-asm.js, then parses the result and rolls
   back if it does not compile. Re-running is safe; it detects the work is done.

   Optional argument: path to app-asm.js if it is not at js/app-asm.js. */

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

if (src.indexOf('ASMSupport.init') !== -1) {
  console.log('Already split — nothing to do.');
  process.exit(0);
}

/* Sanity: the modules must be on disk, or the patched app breaks at runtime. */
const dir = path.dirname(FILE);
['asm-eband.js', 'asm-support.js'].forEach(function (f) {
  if (!fs.existsSync(path.join(dir, f))) {
    console.error('Missing ' + path.join(dir, f) + ' — put both new modules in place first.');
    process.exit(1);
  }
});

/* ── helpers ───────────────────────────────────────────────────────────
   Regions are cut between two markers rather than by matching a whole
   function body, so a stray whitespace change inside a function does not
   break the patch. Both markers must appear exactly once. */

const ops = [];

function region(label, startMark, endMark, replacement) {
  ops.push({ label, startMark, endMark, replacement });
}
function line(label, oldStr, newStr) {
  ops.push({ label, oldStr, newStr });
}

/* ── 1. Edge Band modal out, stub in ──────────────────────────────────── */

region('adjustEBand → ASMEBand',
  '  // ── Per-item Edge Band modal (L/R/T/B per panel + Auto-fill all) ──',
  '  function removeFromSBS(instanceId) {',
  L([
    '  // Edge Band modal lives in asm-eband.js. It writes o.band straight onto',
    '  // this instance\'s output rows, so it needs the instance, not a copy.',
    '  function adjustEBand(instanceId) {',
    '    const inst = sbsItems.find(i => i.instanceId === instanceId);',
    '    if (!inst) return;',
    '    if (!window.ASMEBand) { showToast(\'Edge band module not loaded\', \'error\'); return; }',
    '    ASMEBand.open(inst, showToast);',
    '  }',
    '',
    ''
  ])
);

/* ── 2. Attachment helpers + compressImage out ────────────────────────── */

region('attachment helpers → ASMSupport',
  '  // ── image compression: File -> data URL (JPEG, max 1600px, q0.7) ──',
  '  // Unified "Export Files" — collects RIS panels, opens ExportFiles modal',
  ''
);

/* ── 3. reportProblem out, stub in ────────────────────────────────────── */

region('reportProblem → ASMSupport',
  '  function reportProblem(instanceId) {',
  '  async function refreshMyProblemsBadge() {',
  L([
    '  // Support UI lives in asm-support.js — it only needs the item name.',
    '  function reportProblem(instanceId) {',
    '    const inst = sbsItems.find(i => i.instanceId === instanceId);',
    '    if (!window.ASMSupport) { showToast(\'Support module not loaded\', \'error\'); return; }',
    '    ASMSupport.report(inst ? (inst.itemName || \'Item\') : \'Item\');',
    '  }',
    '',
    ''
  ])
);

/* ── 4. Badge + My Messages + reply + attach shims ────────────────────── */

region('my-messages → ASMSupport',
  '  async function refreshMyProblemsBadge() {',
  "  function showToast(msg, type = 'info') {",
  L([
    '  // Thin delegates. They stay on ASMModule because the public API is part',
    '  // of the contract with every inline onclick this file generates.',
    '  function refreshMyProblemsBadge() {',
    '    return window.ASMSupport ? ASMSupport.refreshBadge() : Promise.resolve([]);',
    '  }',
    '  function openMyProblems() {',
    '    if (window.ASMSupport) ASMSupport.openMessages();',
    '    else showToast(\'Support module not loaded\', \'error\');',
    '  }',
    '  function replyMyProblem(id) { if (window.ASMSupport) ASMSupport.reply(id); }',
    '  function _onAttach(ev, previewId) { if (window.ASMSupport) ASMSupport._onAttach(ev, previewId); }',
    '  function _rmAttach(previewId, idx, el) { if (window.ASMSupport) ASMSupport._rmAttach(previewId, idx, el); }',
    '',
    ''
  ])
);

/* ── 5. Dead state ────────────────────────────────────────────────────── */

line('drop _myProblemsOverlay',
  L([
    '  let _notifs = [];',
    '  let _myProblemsOverlay = null;'
  ]),
  '  let _notifs = [];'
);

/* ── 6. Wire the support module once ──────────────────────────────────── */

line('ASMSupport.init in openASM',
  L([
    '  async function openASM() {',
    "    let container = document.getElementById('asm-fullpage');"
  ]),
  L([
    '  async function openASM() {',
    '    // asm-support.js holds no reference to this closure; hand it the three',
    '    // things it needs the first time the page is opened.',
    '    if (window.ASMSupport) ASMSupport.init({ apiBase: apiBase, authH: authH, showToast: showToast });',
    "    let container = document.getElementById('asm-fullpage');"
  ])
);

/* ── verify everything before touching the file ───────────────────────── */

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
    console.error('  x ' + op.label + ' — end marker comes before start marker');
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
            '  (' + kb(before - src.length) + ' moved out). Backup: ' + FILE + '.bak');
console.log('Add these to index.html BEFORE app-asm.js:');
console.log('  <script src="js/asm-eband.js"></script>');
console.log('  <script src="js/asm-support.js"></script>');