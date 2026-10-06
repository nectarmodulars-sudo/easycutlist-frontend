/* fix-outputrows.js — two output-table bugs in app-asm.js.

   1. The delete ✕ vanishes after any full re-render.

      There are two renderers for the same table. updateSBSItemOutputs() emits
      seven cells per row, the last holding the delete button. renderSBSItem()
      emits only six — it was never updated when the delete column was added.
      A recalc goes through the first and the buttons appear; anything that
      calls renderSBS() (Add Rows, switching units, changing a dropdown) goes
      through the second and they disappear. The colspan on the empty row and
      the sub-item header row is 6 there and 7 in the other, for the same
      reason.

   2. Blank rows from "+ Add Rows" count as one panel each.

      addSBSRows() pushes qty: 1, so five blank rows silently add five to the
      panel total and to the optimizer export filter's view of the item. A
      blank row should be blank; the user types the qty along with the size.

   Run from the frontend repo root:

       node fix-outputrows.js
*/

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join('js', 'app-asm.js');

if (!fs.existsSync(FILE)) {
  console.error('Not found: ' + FILE);
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');
const edits = [];
const edit = (label, oldStr, newStr) => edits.push({ label, oldStr, newStr });

/* ── 1a. empty-state colspan ──────────────────────────────────────────── */

edit('empty row colspan 6 → 7',
  '<td colspan="6" class="asm-out-empty">',
  '<td colspan="7" class="asm-out-empty">'
);

/* ── 1b. sub-item header colspan ──────────────────────────────────────── */

edit('sub-item header colspan 6 → 7',
  '<td colspan="6" style="background:#2A2D31;padding:8px 10px;border-top:2px solid #ECB22E">',
  '<td colspan="7" style="background:#2A2D31;padding:8px 10px;border-top:2px solid #ECB22E">'
);

/* ── 1c. the missing delete cell in renderSBSItem ─────────────────────── */
/* Anchored on the remark cell, which differs from the one in
   updateSBSItemOutputs by its data-label and placeholder. */

edit('renderSBSItem · add delete cell',
  '            <td class="asm-out-remark" data-label="Remark"><input class="asm-cell asm-cell-remark" value="${o.remark || \'\'}" placeholder="remark" onchange="ASMModule.editOutput(\'${inst.instanceId}\',${idx},\'remark\',this.value)"></td>\n          </tr>`;',
  '            <td class="asm-out-remark" data-label="Remark"><input class="asm-cell asm-cell-remark" value="${o.remark || \'\'}" placeholder="remark" onchange="ASMModule.editOutput(\'${inst.instanceId}\',${idx},\'remark\',this.value)"></td>\n            <td style="text-align:center"><button class="asm-row-del" title="Delete row" onclick="ASMModule.deleteOutputRow(\'${inst.instanceId}\',${idx})">&#10005;</button></td>\n          </tr>`;'
);

/* ── 2. blank rows start blank ────────────────────────────────────────── */

edit('addSBSRows · blank qty',
  "      inst.outputs.push({ component: '', w: 0, h: 0, qty: 1, material: '', remark: '', _edited: true, _manual: true });",
  "      inst.outputs.push({ component: '', w: 0, h: 0, qty: '', material: '', remark: '', _edited: true, _manual: true });"
);

/* ── run ───────────────────────────────────────────────────────────────── */

let bad = 0;
edits.forEach(function (e) {
  const n = src.split(e.oldStr).length - 1;
  if (n !== 1) { console.error('  x ' + e.label + ' — ' + n + ' matches, expected 1'); bad++; }
});
if (bad) {
  console.error('\n' + bad + ' anchor(s) did not match. Nothing changed.');
  process.exit(1);
}

fs.writeFileSync(FILE + '.bak', src, 'utf8');
edits.forEach(function (e) { src = src.replace(e.oldStr, e.newStr); console.log('  ok ' + e.label); });
fs.writeFileSync(FILE, src, 'utf8');

try {
  new (require('vm').Script)(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  console.log('\nDone. Backup: ' + FILE + '.bak');
} catch (err) {
  fs.copyFileSync(FILE + '.bak', FILE);
  console.error('\nFailed to parse — rolled back.\n' + err.message);
  process.exit(1);
}