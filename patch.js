/* patch.js — a one-off patch runner you keep forever.

   Put this anywhere (repo root is easiest). It never changes. Each time a fix
   is needed, drop in a new patch.json beside it and run:

       node patch.js                 apply patch.json
       node patch.js my-fix.json     apply a different file
       node patch.js --dry           check every anchor, change nothing
       node patch.js --undo          restore from the .bak files of the last run

   Paths inside the patch are relative to the folder patch.json sits in, so the
   same runner works in the frontend repo, the api repo or asm-admin-local.

   ── patch.json shape ────────────────────────────────────────────────────

   {
     "name": "what this fixes",
     "files": [
       {
         "path": "js/app-asm.js",
         "edits": [
           { "label": "swap one string",
             "find":    "old text",
             "replace": "new text" },

           { "label": "replace a whole region",
             "from":    "marker where the region starts",
             "to":      "marker where it ends (kept)",
             "replace": "what goes in between" },

           { "label": "insert ahead of a marker",
             "before":  "marker",
             "insert":  "new lines" },

           { "label": "delete every occurrence",
             "find": "junk", "replace": "", "count": "all" }
         ]
       }
     ]
   }

   find / replace / from / to / before / insert may each be a string, or an
   array of strings which is joined with newlines — easier to read for code.

   "count" defaults to 1 and the edit is REFUSED unless the anchor appears
   exactly once. Set a number, or "all", when you mean it.

   ── guarantees ──────────────────────────────────────────────────────────

   • Every anchor in every file is checked before a single byte is written.
     One bad anchor and nothing changes anywhere.
   • Each touched file is copied to <file>.bak first.
   • A .js result is parsed; if it does not compile, every file in the run is
     rolled back, not just that one.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const flag = n => args.indexOf(n) !== -1;
const DRY = flag('--dry');
const UNDO = flag('--undo');
const HELP = flag('--help') || flag('-h');

if (HELP) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\* ?/, ''));
  process.exit(0);
}

const jsonArg = args.filter(a => a.indexOf('--') !== 0)[0];
const JSON_PATH = path.resolve(jsonArg || 'patch.json');
const ROOT = path.dirname(JSON_PATH);

/* ── undo ──────────────────────────────────────────────────────────────── */

if (UNDO) {
  if (!fs.existsSync(JSON_PATH)) { console.error('No ' + path.basename(JSON_PATH) + ' to read file list from.'); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  let n = 0;
  (spec.files || []).forEach(function (f) {
    const abs = path.resolve(ROOT, f.path);
    if (fs.existsSync(abs + '.bak')) {
      fs.copyFileSync(abs + '.bak', abs);
      console.log('  restored ' + f.path);
      n++;
    } else {
      console.log('  no backup for ' + f.path);
    }
  });
  console.log(n ? '\nRolled back ' + n + ' file(s).' : '\nNothing to roll back.');
  process.exit(0);
}

/* ── load ──────────────────────────────────────────────────────────────── */

if (!fs.existsSync(JSON_PATH)) {
  console.error('Not found: ' + JSON_PATH + '\nPut a patch.json beside patch.js, or pass its path.');
  process.exit(1);
}

let spec;
try {
  spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
} catch (e) {
  console.error('patch.json is not valid JSON:\n  ' + e.message);
  process.exit(1);
}
if (!spec.files || !spec.files.length) {
  console.error('patch.json has no "files" array.');
  process.exit(1);
}

const txt = v => Array.isArray(v) ? v.join('\n') : (v == null ? null : String(v));

console.log((spec.name ? spec.name : path.basename(JSON_PATH)) + (DRY ? '   [dry run]' : ''));

/* ── plan: resolve every file and check every anchor ───────────────────── */

const plan = [];
let bad = 0;

spec.files.forEach(function (f) {
  const abs = path.resolve(ROOT, f.path);
  console.log('\n' + f.path);

  if (!fs.existsSync(abs)) {
    console.error('  x file not found');
    bad++; return;
  }
  const original = fs.readFileSync(abs, 'utf8');
  let work = original;

  (f.edits || []).forEach(function (e, i) {
    const label = e.label || ('edit ' + (i + 1));

    // before / insert
    if (e.before != null) {
      const mark = txt(e.before);
      const hits = work.split(mark).length - 1;
      if (hits !== 1) { console.error('  x ' + label + ' — marker found ' + hits + 'x, expected 1'); bad++; return; }
      work = work.replace(mark, txt(e.insert) + mark);
      console.log('  ok ' + label);
      return;
    }

    // from / to region
    if (e.from != null && e.to != null) {
      const a = txt(e.from), b = txt(e.to);
      const na = work.split(a).length - 1, nb = work.split(b).length - 1;
      if (na !== 1 || nb !== 1) {
        console.error('  x ' + label + ' — from found ' + na + 'x, to found ' + nb + 'x, both must be 1');
        bad++; return;
      }
      const i0 = work.indexOf(a), i1 = work.indexOf(b);
      if (i0 > i1) { console.error('  x ' + label + ' — "to" appears before "from"'); bad++; return; }
      work = work.slice(0, i0) + txt(e.replace || '') + work.slice(i1);
      console.log('  ok ' + label);
      return;
    }

    // find / replace
    if (e.find != null) {
      const find = txt(e.find);
      const want = (e.count === 'all') ? 'all' : (e.count == null ? 1 : Number(e.count));
      const hits = work.split(find).length - 1;
      if (want === 'all') {
        if (!hits) { console.error('  x ' + label + ' — no match'); bad++; return; }
        work = work.split(find).join(txt(e.replace || ''));
        console.log('  ok ' + label + ' (' + hits + 'x)');
      } else {
        if (hits !== want) { console.error('  x ' + label + ' — ' + hits + ' matches, expected ' + want); bad++; return; }
        for (let k = 0; k < want; k++) work = work.replace(find, txt(e.replace || ''));
        console.log('  ok ' + label);
      }
      return;
    }

    console.error('  x ' + label + ' — needs find, from+to, or before+insert');
    bad++;
  });

  plan.push({ abs, rel: f.path, original, work });
});

if (bad) {
  console.error('\n' + bad + ' problem(s). Nothing was written.');
  process.exit(1);
}
if (DRY) {
  console.log('\nAll anchors matched. Nothing written (--dry).');
  process.exit(0);
}

/* ── write, verify, roll back as a set ─────────────────────────────────── */

plan.forEach(function (p) {
  fs.writeFileSync(p.abs + '.bak', p.original, 'utf8');
  fs.writeFileSync(p.abs, p.work, 'utf8');
});

let broke = null;
plan.forEach(function (p) {
  if (broke || !/\.(js|mjs|cjs)$/i.test(p.abs)) return;
  try { new vm.Script(p.work, { filename: p.abs }); }
  catch (err) { broke = { rel: p.rel, msg: err.message }; }
});

if (broke) {
  plan.forEach(function (p) { fs.copyFileSync(p.abs + '.bak', p.abs); });
  console.error('\n' + broke.rel + ' failed to parse — ALL files rolled back.\n' + broke.msg);
  process.exit(1);
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('');
plan.forEach(function (p) {
  const d = p.work.length - p.original.length;
  console.log('  ' + p.rel + '   ' + kb(p.original.length) + ' → ' + kb(p.work.length) +
              '  (' + (d >= 0 ? '+' : '') + kb(d) + ')');
});
console.log('\nDone. Backups written as <file>.bak — "node patch.js --undo" restores them.');