// ══════════════════════════════════════════════════════════════
// eband-deduct.js — shared edge-band label deduction
//
// Single source of truth for "what size to DISPLAY on cutting surfaces
// (visual sheet, cut list, panel list) when edge banding is on".
//
// The packer already cuts the deducted size. These surfaces normally show
// the ENTERED dimensions; when a panel has edge bands AND deduction is on,
// they should instead show the ACTUAL CUT size = entered − band thickness.
//
// Used by: app-print.js (buildSVG), app-render.js (cut list + panel list).
// Keep this file self-contained. Do not add rendering here.
// ══════════════════════════════════════════════════════════════

var EBandDeduct = (function () {

  // Given a panel row (with .l = entered width, .w = entered height, .band),
  // the packed piece geometry (packedW/packedH in mm), return the oriented,
  // band-deducted { w, h } to display.
  //
  // panelMatch : the matched panelRows entry (or null)
  // packedW/H  : p.pw / p.ph from the packer (fallback + rotation reference)
  //
  // Returns { w, h } in mm. If no match / no band / deduction off, returns the
  // entered dims oriented to placement (i.e. the previous behaviour).
  function labelSize(panelMatch, packedW, packedH) {
    // No panel row → fall back to packer geometry.
    if (!panelMatch) return { w: packedW, h: packedH, rotated: false };

    var ol = panelMatch.l, ow = panelMatch.w; // entered mm (l = width, w = height)
    // Detect packer rotation: packedW closer to entered height ⇒ rotated.
    var rotated = Math.abs(packedW - ow) < Math.abs(packedW - ol);
    var w = rotated ? ow : ol;
    var h = rotated ? ol : ow;

    // Apply band deduction only when bands exist and deduction is enabled.
    var deductOn = (typeof EBand === 'undefined') ||
                   (typeof EBand.isDeductOn !== 'function') ||
                   EBand.isDeductOn();
    if (panelMatch.band && deductOn) {
      var b = panelMatch.band;
      var wCut = (+b.l || 0) + (+b.r || 0); // L+R reduce entered width
      var hCut = (+b.t || 0) + (+b.b || 0); // T+B reduce entered height
      if (rotated) {
        w = Math.max(1, w - hCut);
        h = Math.max(1, h - wCut);
      } else {
        w = Math.max(1, w - wCut);
        h = Math.max(1, h - hCut);
      }
    }
    return { w: w, h: h, rotated: rotated };
  }

  return { labelSize: labelSize };
})();

// Also expose on window for module-less script loading.
if (typeof window !== 'undefined') window.EBandDeduct = EBandDeduct;
