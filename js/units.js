/* units.js — shared unit conversion for EasyCutList (ASM + Optimizer).
 * CANON: everything is stored/computed in millimetres. This module only
 * converts at the input/output edge. Formulas, packer, DB stay in mm.
 * Load this BEFORE app-asm.js (and before optimizer code) in index.html.
 */
(function (global) {
  'use strict';

  var MM_PER_IN = 25.4;      // exact
  var MM_PER_FT = 304.8;     // exact (12 * 25.4)
  var STORAGE_KEY = 'ecl_unit';

  // Count-input keys that are NOT dimensions — never convert these.
  // Interim denylist (until schema emits unit:"mm"). Match is case-insensitive.
  var COUNT_KEYS = [
    'qty', 'qty_2', 'item_no', 'shelf', 'half_shelf', 'locker', 'locker_qty',
    'upper_vertical', 'lower_vertical', 'no_of_doors', 'big_side_shelf',
    'small_side_shelf', 'patti'
  ];
  // Pattern fallback: keys that look like counts (no_of_*, *_qty, *_count, *_shelf)
  var COUNT_PATTERNS = [/^no_of_/i, /_qty$/i, /_count$/i, /_shelf$/i, /^shelf/i];

  var MODES = {
    generic:     { label: 'Generic',                 sample: '16.5' },
    mm:          { label: 'Millimeters',             sample: '16.5 mm' },
    cm:          { label: 'Centimeters',             sample: '16.5 cm' },
    m:           { label: 'Meters',                  sample: '16.5 m' },
    in:          { label: 'Inches',                  sample: '16.5"' },
    in_frac:     { label: 'Fractional Inches',       sample: '16 1/2"' },
    ft_in:       { label: 'Decimal Feet & Inches',   sample: "1' 4.5\"" },
    ft_in_frac:  { label: 'Fractional Feet & Inches',sample: "1' 4 1/2\"" }
  };

  var current = null;

  function get() {
    if (current) return current;
    try { current = localStorage.getItem(STORAGE_KEY) || 'mm'; }
    catch (e) { current = 'mm'; }
    if (!MODES[current]) current = 'mm';
    return current;
  }

  function set(mode) {
    if (!MODES[mode]) mode = 'mm';
    current = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
    try {
      global.dispatchEvent(new CustomEvent('ecl-unit-change', { detail: { mode: mode } }));
    } catch (e) {}
  }

  function isCountKey(key) {
    if (!key) return false;
    var k = String(key).toLowerCase();
    if (COUNT_KEYS.indexOf(k) !== -1) return true;
    for (var i = 0; i < COUNT_PATTERNS.length; i++) {
      if (COUNT_PATTERNS[i].test(k)) return true;
    }
    return false;
  }

  // Should this input be unit-converted? Prefers the schema's `unit` field
  // (emitted by the parser as unit:"mm" on dimensions). Falls back to the
  // denylist for items parsed before the unit field existed.
  //   inp: the input schema object (may be undefined) OR a key string.
  function isDimension(inp) {
    if (inp && typeof inp === 'object') {
      if (inp.unit === 'mm') return true;          // explicit dimension
      if (inp.unit) return false;                  // explicit non-mm unit
      // no unit field on this input → fall back to denylist by key
      return inp.type === 'number' && !isCountKey(inp.key);
    }
    // called with a bare key (no schema available) → denylist only
    return !isCountKey(inp);
  }

  // ---- display -> mm (INPUT). Returns a Number in mm. ----
  // Only pass dimension values here. Counts must bypass this.
  function toMM(displayVal, mode) {
    mode = mode || get();
    var n = parseFloat(displayVal);
    if (!isFinite(n)) return 0;
    switch (mode) {
      case 'cm': return n * 10;
      case 'm':  return n * 1000;
      case 'in':
      case 'in_frac':     return n * MM_PER_IN;
      case 'ft_in':
      case 'ft_in_frac':  return n * MM_PER_IN; // decimal-input build: value is inches
      case 'mm':
      case 'generic':
      default:   return n;
    }
  }

  // ---- mm -> display string (OUTPUT). Returns a String. ----
  function fromMM(mm, mode) {
    mode = mode || get();
    var n = parseFloat(mm);
    if (!isFinite(n)) return '';
    switch (mode) {
      case 'cm': return round(n / 10, 2);
      case 'm':  return round(n / 1000, 3);
      case 'in': return round(n / MM_PER_IN, 2);
      case 'in_frac':    return fmtInchFrac(n);
      case 'ft_in':      return fmtFtInDecimal(n);
      case 'ft_in_frac': return fmtFtInFrac(n);
      case 'mm':
      case 'generic':
      default:   return round(n, 1);
    }
  }

  // numeric form of fromMM (for inputs where a bare number is needed)
  function fromMMNum(mm, mode) {
    mode = mode || get();
    var n = parseFloat(mm);
    if (!isFinite(n)) return 0;
    switch (mode) {
      case 'cm': return round(n / 10, 2);
      case 'm':  return round(n / 1000, 3);
      case 'in':
      case 'in_frac':
      case 'ft_in':
      case 'ft_in_frac': return round(n / MM_PER_IN, 2);
      case 'mm':
      case 'generic':
      default:   return round(n, 1);
    }
  }

  function round(v, dp) {
    var f = Math.pow(10, dp);
    return Math.round(v * f) / f;
  }

  // ---- fractional formatters (OUTPUT only, snap 1/8") ----
  function toFrac8(inches) {
    var whole = Math.floor(inches);
    var frac = Math.round((inches - whole) * 8); // eighths
    if (frac === 8) { whole += 1; frac = 0; }
    if (frac === 0) return { whole: whole, num: 0, den: 8 };
    // reduce
    var g = gcd(frac, 8);
    return { whole: whole, num: frac / g, den: 8 / g };
  }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }

  function fmtInchFrac(mm) {
    var inches = mm / MM_PER_IN;
    var f = toFrac8(inches);
    var s = f.num ? (f.whole + ' ' + f.num + '/' + f.den) : ('' + f.whole);
    return s + '"';
  }
  function fmtFtInDecimal(mm) {
    var inches = mm / MM_PER_IN;
    var ft = Math.floor(inches / 12);
    var rem = round(inches - ft * 12, 2);
    return ft + "' " + rem + '"';
  }
  function fmtFtInFrac(mm) {
    var inches = mm / MM_PER_IN;
    var ft = Math.floor(inches / 12);
    var remIn = inches - ft * 12;
    var f = toFrac8(remIn);
    if (f.whole === 12) { /* guard */ }
    var inStr = f.num ? (f.whole + ' ' + f.num + '/' + f.den) : ('' + f.whole);
    return ft + "' " + inStr + '"';
  }

  // dropdown option HTML (live sample in label, matches CutList Optimizer style)
  function optionsHTML(selected) {
    selected = selected || get();
    var order = ['generic', 'mm', 'cm', 'm', 'in'];
    return order.map(function (k) {
      var m = MODES[k];
      var sel = k === selected ? ' selected' : '';
      return '<option value="' + k + '"' + sel + '>' + m.label + ' (' + m.sample + ')</option>';
    }).join('');
  }

  global.UNITS = {
    get: get, set: set,
    toMM: toMM, fromMM: fromMM, fromMMNum: fromMMNum,
    isCountKey: isCountKey, isDimension: isDimension, optionsHTML: optionsHTML,
    MODES: MODES
  };
})(typeof window !== 'undefined' ? window : this);
