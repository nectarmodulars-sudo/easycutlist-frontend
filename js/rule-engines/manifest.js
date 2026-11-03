/* rule-engines/manifest.js — the only file that has to be loaded up front.
   Maps a Master Sheet rule code to the file(s) that register it, so the core
   can lazy-load exactly what one item needs instead of every rule set.

   A code may name one file or a LIST loaded in order: the wardrobes share
   their carcass, so those list the common files first and the engine last.

   To add a category:   drop js/rule-engines/<name>.js in, add its codes below,
                        bump `version` so browsers re-fetch.
   To change a rule:    edit that one file and bump `version`.

   `version` is appended as ?v= to every rule file request — without it a
   cached engine can sit in a customer's browser for days after a rule fix. */
window.ASM3D_RULES = {
  version: '2.7.0',
  base: 'js/rule-engines/',

  files: {
    // wardrobes — one engine per door configuration, shared carcass
    slwb: ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-sliding.js'],
    '4dw': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-4door.js'],
    '2dw': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-2door.js'],
    '1dw': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-1door.js'],
    '1dwf': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-1door-drawers.js'],
    '2dwb': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-2door-bottom.js'],
    'cp2d': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-center-partition.js'],
    '3dw': ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-3door.js'],

    // kitchen — its own shared file; the level machinery comes from
    // wardrobe-common.js, which is not wardrobe-specific
    kcp:  ['wardrobe-common.js', 'kitchen-common.js', 'kitchen-carcass.js'],
    ktsu: ['wardrobe-common.js', 'kitchen-common.js', 'kitchen-strip-units.js'],
    ksnk: ['wardrobe-common.js', 'kitchen-common.js', 'kitchen-strip-units.js'],

    // service tables / shoe racks — one family, one file
    st1d:  ['wardrobe-common.js', 'service-tables.js'],
    st2d:  ['wardrobe-common.js', 'service-tables.js'],
    st3d:  ['wardrobe-common.js', 'service-tables.js'],
    st4d:  ['wardrobe-common.js', 'service-tables.js'],
    st2dr: ['wardrobe-common.js', 'service-tables.js'],
    st3dr: ['wardrobe-common.js', 'service-tables.js'],

    // tv units — one drawer line, two width rules
    tvde: ['wardrobe-common.js', 'tv-units.js'],
    tvdm: ['wardrobe-common.js', 'tv-units.js'],

    cab:  'cabinets.js',      // 1-4 door, hydraulic, rolling shutter, purifier box

    // superseded: wb2d was the old 2-door engine, kept so an existing Master
    // Sheet cell reading "wb2d" still opens something until it is changed.
    wb2d: ['wardrobe-common.js', 'wardrobe-carcass.js', 'wardrobe-2door.js']
  },

  // Shown in the admin UI and in the viewer's "no rule" message.
  labels: {
    slwb: 'Sliding Wardrobe',
    '4dw': '4-Door Openable Wardrobe',
    '2dw': '2-Door Openable Wardrobe',
    '1dw': '1-Door Open Wardrobe',
    '1dwf': '1-Door Open + Front Drawers',
    '2dwb': '2 Doors Open Wardrobe + Bottom Drawers',
    '3dw': '3-Door Open Wardrobe',
    'cp2d': '2-Door Open-Centre Partition Wardrobe',
    wb2d: '2-Door Openable Wardrobe (old code)',
    kcp:  'Kitchen Carcass with Partition',
    ktsu: 'Kitchen Top Strip Unit with Back',
    ksnk: 'Kitchen Sink Unit',
    st1d:  '1-Door Service Table / Shoe Rack',
    st2d:  '2-Door Service Table / Shoe Rack',
    st3d:  '3-Door Service Table / Shoe Rack',
    st4d:  '4-Door Service Table / Shoe Rack',
    st2dr: '2 Drawers + 2 Doors Service Table',
    st3dr: '3 Drawers + 3 Doors Service Table',
    tvde: 'TV Unit \u00b7 Drawer Line, equal drawers',
    tvdm: 'TV Unit \u00b7 Drawer Line, small & big',
    cab:  'Cabinet'
  }
};
