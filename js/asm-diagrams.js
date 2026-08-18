// ══ ASM DIAGRAMS ══
// SVG item diagrams (wardrobe, cabinet, bed, loft, generic).
// Pure functions of (inst, W, H, D) — no shared ASM state.
// Exposed as window.ASMDiagrams. Currently not wired into the UI; kept as a
// standalone module so it can be enabled without bloating app-asm.js.
window.ASMDiagrams = (function () {
  function generateItemDiagram(inst) {
    if (!inst.outputs || inst.outputs.length === 0) return '';

    const inp = inst.inputs;
    const W = inp.width || inp.w || inp.W || 1000;
    const H = inp.ht || inp.h || inp.H || inp.height || 800;
    const D = inp.depth || inp.d || inp.D || 400;
    const category = (inst.itemId || '').toLowerCase();

    // Detect item type from name/id
    if (category.includes('wardrobe') || category.includes('sliding')) return wardrobeDiagram(inst, W, H, D);
    if (category.includes('cab') || category.includes('cabinet') || category.includes('shutter')) return cabinetDiagram(inst, W, H, D);
    if (category.includes('bed')) return bedDiagram(inst, W, H, D);
    if (category.includes('loft') || category.includes('bl')) return loftDiagram(inst, W, H, D);
    if (category.includes('dressing') || category.includes('table')) return cabinetDiagram(inst, W, H, D);

    // Generic fallback
    return genericDiagram(inst, W, H, D);
  }

  function wardrobeDiagram(inst, W, H, D) {
    // Scale to fit in ~400x300 SVG
    const scale = Math.min(360 / W, 260 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2); // offset x
    const oy = 20; // offset y
    const svgH = sh + 70;

    // Find components
    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const shelf = find('SHELF');
    const halfShelf = find('HALF');
    const vertical = find('VERTICAL PART') || find('PARTITION');
    const locker = find('LOCKER');
    const drawer = find('DRAWER') || find('FACE');
    const door = find('DOOR');
    const shelfCount = shelf ? shelf.qty : 0;
    const halfCount = halfShelf ? halfShelf.qty : 0;
    const hasLocker = locker && locker.qty > 0;
    const hasDrawers = drawer && drawer.qty > 0;

    // Panel thickness scaled
    const pt = Math.max(2, Math.round(18 * scale));
    const midX = ox + Math.round(sw / 2);

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:300px">`;

    // Back panel (dashed)
    svg += `<rect x="${ox + pt}" y="${oy + pt}" width="${sw - pt * 2}" height="${sh - pt * 2}" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.4"/>`;

    // Top
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    // Bottom
    svg += `<rect x="${ox + pt}" y="${oy + sh - pt}" width="${sw - pt * 2}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    // Left side
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    // Right side
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Vertical partition (center)
    if (vertical && vertical.qty > 0) {
      svg += `<rect x="${midX - 1}" y="${oy + pt}" width="${3}" height="${sh - pt * 2 - (hasDrawers ? sh * 0.2 : 0)}" fill="#7F77DD" fill-opacity="0.5" stroke="#7F77DD" stroke-width="0.5"/>`;
    }

    // Shelves (left compartment)
    const shelfArea = sh - pt * 2 - (hasDrawers ? sh * 0.25 : 0) - (hasLocker ? sh * 0.15 : 0);
    const leftW = midX - ox - pt - 2;
    for (let i = 0; i < Math.min(shelfCount, 6); i++) {
      const sy = oy + pt + Math.round(shelfArea * (i + 1) / (shelfCount + 1));
      svg += `<rect x="${ox + pt}" y="${sy}" width="${leftW}" height="2" fill="#639922" fill-opacity="0.6" stroke="#639922" stroke-width="0.5"/>`;
    }

    // Half shelves (right compartment, upper)
    const rightX = midX + 3;
    const rightW = ox + sw - pt - rightX;
    const upperH = Math.round(shelfArea * 0.5);
    for (let i = 0; i < Math.min(halfCount, 4); i++) {
      const sy = oy + pt + Math.round(upperH * (i + 1) / (Math.min(halfCount, 4) + 1));
      // Half shelf = two halves
      svg += `<rect x="${rightX}" y="${sy}" width="${Math.round(rightW / 2) - 2}" height="2" fill="#BA7517" fill-opacity="0.5" stroke="#BA7517" stroke-width="0.5"/>`;
      svg += `<rect x="${rightX + Math.round(rightW / 2) + 2}" y="${sy}" width="${Math.round(rightW / 2) - 2}" height="2" fill="#BA7517" fill-opacity="0.5" stroke="#BA7517" stroke-width="0.5"/>`;
    }

    // Drawers (bottom left)
    if (hasDrawers) {
      const drawerY = oy + sh - pt - Math.round(sh * 0.22);
      const drawerH = Math.round(sh * 0.18);
      const rows = Math.min(drawer.qty, 4);
      const rowH = Math.round(drawerH / rows);
      for (let i = 0; i < rows; i++) {
        svg += `<rect x="${ox + pt + 4}" y="${drawerY + i * rowH + 2}" width="${leftW - 8}" height="${rowH - 4}" rx="2" fill="#D85A30" fill-opacity="0.2" stroke="#D85A30" stroke-width="0.5"/>`;
        // Handle
        const hy = drawerY + i * rowH + Math.round(rowH / 2);
        svg += `<line x1="${ox + pt + leftW / 2 - 8}" y1="${hy}" x2="${ox + pt + leftW / 2 + 8}" y2="${hy}" stroke="#D85A30" stroke-width="1.5" stroke-linecap="round"/>`;
      }
    }

    // Locker (bottom right)
    if (hasLocker) {
      const lockerY = oy + sh - pt - Math.round(sh * 0.18);
      const lockerH = Math.round(sh * 0.14);
      svg += `<rect x="${rightX + 2}" y="${lockerY}" width="${rightW - 4}" height="${lockerH}" rx="2" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2"/>`;
      svg += `<text x="${rightX + rightW / 2}" y="${lockerY + lockerH / 2 + 4}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">LOCKER</text>`;
    }

    // Sliding doors (overlay)
    svg += `<rect x="${ox + 2}" y="${oy + pt + 2}" width="${Math.round(sw / 2) - 4}" height="${sh - pt * 2 - 4}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="8 4" opacity="0.4"/>`;
    svg += `<rect x="${midX + 2}" y="${oy + pt + 2}" width="${Math.round(sw / 2) - 4}" height="${sh - pt * 2 - 4}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="8 4" opacity="0.4"/>`;

    // Skirting
    svg += `<rect x="${ox}" y="${oy + sh}" width="${sw}" height="${Math.max(3, Math.round(8 * scale))}" rx="1" fill="var(--text-muted)" fill-opacity="0.3" stroke="var(--text-muted)" stroke-width="0.5"/>`;

    // Dimension labels
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;

    // Component count
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;

    svg += '</svg>';
    return svg;
  }

  function cabinetDiagram(inst, W, H, D) {
    const scale = Math.min(360 / W, 260 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;
    const pt = Math.max(2, Math.round(18 * scale));

    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const shelf = find('SHELF');
    const door = find('DOOR');
    const shelfCount = shelf ? shelf.qty : 0;
    const doorCount = door ? door.qty : 1;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:280px">`;

    // Back (dashed)
    svg += `<rect x="${ox + pt}" y="${oy + pt}" width="${sw - pt * 2}" height="${sh - pt * 2}" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.4"/>`;

    // Top, Bottom
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + pt}" y="${oy + sh - pt}" width="${sw - pt * 2}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;

    // Sides
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Shelves
    const innerW = sw - pt * 2;
    for (let i = 0; i < Math.min(shelfCount, 6); i++) {
      const sy = oy + pt + Math.round((sh - pt * 2) * (i + 1) / (shelfCount + 1));
      svg += `<rect x="${ox + pt}" y="${sy}" width="${innerW}" height="2" fill="#639922" fill-opacity="0.6" stroke="#639922" stroke-width="0.5"/>`;
    }

    // Doors overlay
    const doorW = Math.round(innerW / Math.min(doorCount, 4));
    for (let i = 0; i < Math.min(doorCount, 4); i++) {
      const dx = ox + pt + i * doorW;
      svg += `<rect x="${dx + 3}" y="${oy + pt + 3}" width="${doorW - 6}" height="${sh - pt * 2 - 6}" rx="3" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="6 3" opacity="0.4"/>`;
      // Handle
      const hx = dx + doorW - 12;
      svg += `<line x1="${hx}" y1="${oy + sh / 2 - 8}" x2="${hx}" y2="${oy + sh / 2 + 8}" stroke="var(--text-accent)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function bedDiagram(inst, W, H, D) {
    // Bed is wide and short
    const scale = Math.min(360 / W, 180 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 30;
    const svgH = sh + 90;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:240px">`;

    // Mattress area
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="6" fill="var(--text-muted)" fill-opacity="0.08" stroke="var(--text-muted)" stroke-width="1"/>`;

    // Headboard
    svg += `<rect x="${ox}" y="${oy - 16}" width="${sw}" height="18" rx="3" fill="#7F77DD" fill-opacity="0.3" stroke="#7F77DD" stroke-width="0.5"/>`;
    svg += `<text x="${ox + sw / 2}" y="${oy - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="var(--font-sans)">HEADBOARD</text>`;

    // Side rails
    svg += `<rect x="${ox}" y="${oy}" width="6" height="${sh}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - 6}" y="${oy}" width="6" height="${sh}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Bottom panel
    svg += `<rect x="${ox + 6}" y="${oy + sh - 6}" width="${sw - 12}" height="6" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;

    // Storage (if trolley/flap)
    const hasTrolley = (inst.itemId || '').toLowerCase().includes('trl') || (inst.itemId || '').toLowerCase().includes('trolley');
    if (hasTrolley) {
      svg += `<rect x="${ox + 10}" y="${oy + 10}" width="${sw - 20}" height="${sh - 20}" rx="3" fill="none" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="4 2"/>`;
      svg += `<text x="${ox + sw / 2}" y="${oy + sh / 2 + 3}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">STORAGE</text>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 30}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 45}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function loftDiagram(inst, W, H, D) {
    // Loft is wide and short (overhead cabinet)
    const scale = Math.min(360 / W, 160 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;
    const pt = Math.max(2, Math.round(14 * scale));

    const find = (name) => inst.outputs.find(o => o.component && o.component.toUpperCase().includes(name));
    const door = find('DOOR');
    const doorCount = door ? door.qty : 1;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:220px">`;

    // Structure
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="3" fill="var(--text-muted)" fill-opacity="0.06" stroke="var(--text-muted)" stroke-width="1"/>`;
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox}" y="${oy + sh - pt}" width="${sw}" height="${pt}" rx="1" fill="#1D9E75" fill-opacity="0.3" stroke="#1D9E75" stroke-width="0.5"/>`;
    svg += `<rect x="${ox}" y="${oy + pt}" width="${pt}" height="${sh - pt * 2}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;
    svg += `<rect x="${ox + sw - pt}" y="${oy + pt}" width="${pt}" height="${sh - pt * 2}" rx="1" fill="#378ADD" fill-opacity="0.3" stroke="#378ADD" stroke-width="0.5"/>`;

    // Doors
    const innerW = sw - pt * 2;
    const dw = Math.round(innerW / Math.min(doorCount, 3));
    for (let i = 0; i < Math.min(doorCount, 3); i++) {
      svg += `<rect x="${ox + pt + i * dw + 3}" y="${oy + pt + 3}" width="${dw - 6}" height="${sh - pt * 2 - 6}" rx="2" fill="none" stroke="var(--text-accent)" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.5"/>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 25}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 40}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">${inst.outputs.length} components</text>`;
    svg += '</svg>';
    return svg;
  }

  function genericDiagram(inst, W, H, D) {
    const scale = Math.min(360 / W, 240 / H);
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);
    const ox = Math.round((400 - sw) / 2);
    const oy = 20;
    const svgH = sh + 70;

    let svg = `<svg width="100%" viewBox="0 0 400 ${svgH}" style="max-height:260px">`;
    svg += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="4" fill="var(--text-muted)" fill-opacity="0.06" stroke="var(--text-muted)" stroke-width="1"/>`;

    // Show component names inside
    const maxShow = Math.min(inst.outputs.length, 8);
    for (let i = 0; i < maxShow; i++) {
      const o = inst.outputs[i];
      const ty = oy + 20 + i * 16;
      svg += `<text x="${ox + 12}" y="${ty}" fill="var(--text-secondary)" font-size="9" font-family="var(--font-sans)">${o.component}: ${o.w}×${o.h} (${o.qty})</text>`;
    }
    if (inst.outputs.length > maxShow) {
      svg += `<text x="${ox + 12}" y="${oy + 20 + maxShow * 16}" fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">+ ${inst.outputs.length - maxShow} more...</text>`;
    }

    svg += `<text x="${ox + sw / 2}" y="${oy + sh + 25}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="500">${W} × ${H} × ${D} mm</text>`;
    svg += '</svg>';
    return svg;
  }

  // ========================================================================
  // EXPORT TO PDF
  // ========================================================================


  return { generateItemDiagram, wardrobeDiagram, cabinetDiagram, bedDiagram, loftDiagram, genericDiagram };
})();
