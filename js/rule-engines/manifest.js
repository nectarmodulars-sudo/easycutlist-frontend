/* rule-engines/manifest.js — the only file that has to be loaded up front.
   Maps a Master Sheet rule code to the category file that registers it, so the
   core can lazy-load exactly one file per item instead of every rule set.

   To add a category:   drop js/rule-engines/<name>.js in, add its codes below,
                        bump `version` so browsers re-fetch.
   To change a rule:    edit that one category file and bump `version`.

   `version` is appended as ?v= to every rule file request — without it a cached
   wardrobes.js can sit in a customer's browser for days after a rule fix. */
window.ASM3D_RULES = {
  version: '1.2.0',
  base: 'js/rule-engines/',

  files: {
    slwb: 'wardrobes.js',     // sliding · sliding + wheels · 4 door openable
    wb2d: 'wardrobes.js',     // 2 door openable
    cab:  'cabinets.js'       // 1-4 door, hydraulic, rolling shutter, purifier box
    // st__ : 'service-tables.js'
  },

  // Shown in the admin UI and in the viewer's "no rule" message.
  labels: {
    slwb: 'Sliding / 4-Door Wardrobe',
    wb2d: '2-Door Openable Wardrobe',
    cab:  'Cabinet'
  }
};