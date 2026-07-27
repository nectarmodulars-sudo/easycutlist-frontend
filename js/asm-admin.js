// ============================================================================
// ASM ADMIN — Master Sheet Upload & JSON Generator
// Mount this as: app.use('/asm/admin', require('./asm-admin'))
// ============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');  // For extracting images
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
let _catalogues = null;
try { _catalogues = require('./catalogues'); } catch (e) {}
const _sb = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY) : null;

// File upload config
const uploadDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created uploads directory:', uploadDir);
}
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// ============================================================================
// 1. GET /asm/admin — Serve the admin UI page
// ============================================================================
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-ui', 'admin.html'));
});

// Serve admin UI static assets (css + client js modules)
router.use('/ui', express.static(path.join(__dirname, 'admin-ui')));

// Git push tool (self-contained, local only)
try { router.use('/git', require('./git-routes')); } catch (e) { console.error('git-routes not loaded:', e.message); }

// ============================================================================
// 2. POST /asm/admin/upload — Upload Excel, return Range Config items
// ============================================================================
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[ASM Admin] File uploaded:', req.file.originalname, 'Size:', req.file.size, 'Path:', req.file.path);

    const wb = XLSX.readFile(req.file.path);
    
    // Find Range Config sheet
    const rcSheet = wb.Sheets['Range Config'];
    if (!rcSheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No "Range Config" sheet found in Excel file' });
    }

    // Parse Range Config
    const rcData = XLSX.utils.sheet_to_json(rcSheet, { header: 1 });
    const items = [];
    
    for (let i = 1; i < rcData.length; i++) {
      const row = rcData[i];
      if (row[0] && row[1] && row[2]) {
        items.push({
          sheet: String(row[0]).trim(),
          name: String(row[1]).trim(),
          range: String(row[2]).trim()
        });
      }
    }

    // Store file path for later use
    const uploadId = path.basename(req.file.path);

    // Persist as "current master sheet" so it can be re-downloaded later
    try {
      fs.copyFileSync(req.file.path, path.join(uploadDir, 'current-ms.xlsx'));
      fs.writeFileSync(path.join(uploadDir, 'current-ms.name'), req.file.originalname || 'master-sheet.xlsx');
    } catch (e) { console.error('[ASM Admin] Could not persist current MS:', e.message); }

    res.json({
      success: true,
      uploadId,
      fileName: req.file.originalname,
      sheets: wb.SheetNames,
      itemCount: items.length,
      items
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 2b. GET /asm/admin/download-ms — Download the current working Master Sheet
// ============================================================================
router.get('/download-ms', (req, res) => {
  const filePath = path.join(uploadDir, 'current-ms.xlsx');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'No master sheet uploaded yet' });
  }
  let name = 'master-sheet.xlsx';
  try { name = fs.readFileSync(path.join(uploadDir, 'current-ms.name'), 'utf8').trim() || name; } catch (e) {}
  res.download(filePath, name);
});

// GET /asm/admin/ms-status — Whether a current MS exists (for button state)
router.get('/ms-status', (req, res) => {
  const filePath = path.join(uploadDir, 'current-ms.xlsx');
  const exists = fs.existsSync(filePath);
  let name = null;
  if (exists) { try { name = fs.readFileSync(path.join(uploadDir, 'current-ms.name'), 'utf8').trim(); } catch (e) {} }
  res.json({ exists, fileName: name });
});

// ============================================================================
// 3. POST /asm/admin/extract — Extract raw data for a specific item range
// ============================================================================
router.post('/extract', express.json({ limit: '25mb' }), (req, res) => {
  try {
    const { uploadId, sheet, range } = req.body;
    
    if (!uploadId || !sheet || !range) {
      return res.status(400).json({ error: 'Missing uploadId, sheet, or range' });
    }

    const filePath = path.join(__dirname, 'data/uploads', uploadId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Upload not found. Re-upload the file.' });
    }

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[sheet];
    if (!ws) {
      return res.status(404).json({ error: `Sheet "${sheet}" not found` });
    }

    // Parse range (e.g., "A1:H49")
    const rangeRef = XLSX.utils.decode_range(range);
    
    const rows = [];
    for (let r = rangeRef.s.r; r <= rangeRef.e.r; r++) {
      const rowData = [];
      for (let c = rangeRef.s.c; c <= rangeRef.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        
        rowData.push({
          col: XLSX.utils.encode_col(c),
          row: r + 1,
          ref: cellRef,
          value: cell ? (cell.v !== undefined ? cell.v : null) : null,
          formula: cell ? (cell.f || null) : null,
          type: cell ? cell.t : null // s=string, n=number, b=boolean
        });
      }
      rows.push(rowData);
    }

    res.json({
      success: true,
      sheet,
      range,
      totalRows: rows.length,
      rows
    });

  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 4. POST /asm/admin/generate — Generate JSON from user-defined mappings
// ============================================================================
router.post('/generate', express.json({ limit: '25mb' }), (req, res) => {
  try {
    const { uploadId, itemConfig } = req.body;
    
    // itemConfig structure:
    // {
    //   id: "sliding-wardrobe-standard",
    //   name: "Standard Sliding Wardrobe",
    //   type: "wardrobe",
    //   category: "wardrobes",
    //   sheet: "WARDROBES",
    //   range: "A1:H49",
    //   inputMappings: [
    //     { cellRef: "C3", key: "width", label: "Width (Outer) mm", type: "number", default: 2100, min: 500, max: 3000 },
    //     ...
    //   ],
    //   headerRow: 18,     // Row number of "BOX NO. | w | h | qty | COLOR | REMARK" header
    //   outputStartRow: 19, // First output row
    //   outputEndRow: 44    // Last output row
    // }

    if (!uploadId || !itemConfig) {
      return res.status(400).json({ error: 'Missing uploadId or itemConfig' });
    }

    const filePath = path.join(__dirname, 'data/uploads', uploadId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Upload not found. Re-upload the file.' });
    }

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[itemConfig.sheet];
    if (!ws) {
      return res.status(404).json({ error: `Sheet "${itemConfig.sheet}" not found` });
    }

    // Build cell-to-variable mapping from inputMappings
    const cellMap = {};
    itemConfig.inputMappings.forEach(m => {
      cellMap[m.cellRef.toUpperCase()] = m.key;
    });

    // Build a map of ALL cell formulas AND values in the range (for resolving output-to-output refs)
    const allCellFormulas = {};
    const allCellValues = {};
    const rangeRef2 = XLSX.utils.decode_range(itemConfig.range);
    for (let r = rangeRef2.s.r; r <= rangeRef2.e.r; r++) {
      for (let c = rangeRef2.s.c; c <= rangeRef2.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddr];
        const ref = XLSX.utils.encode_col(c) + (r + 1);
        if (cell) {
          if (cell.f) {
            allCellFormulas[ref] = cell.f;
          }
          if (cell.v !== undefined && cell.v !== null) {
            allCellValues[ref] = cell.v;
          }
        }
      }
    }

    // Extract outputs
    const outputs = [];
    for (let r = itemConfig.outputStartRow - 1; r < itemConfig.outputEndRow; r++) {
      // Column A = component name (may be a formula like =A51)
      const compCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      let component = '';
      if (compCell) {
        if (compCell.f) {
          // Formula component name (e.g., =A51 means copy from that row)
          const refMatch = compCell.f.match(/^A(\d+)$/);
          if (refMatch) {
            const refRow = parseInt(refMatch[1]) - 1;
            const refCell = ws[XLSX.utils.encode_cell({ r: refRow, c: 0 })];
            component = refCell ? (refCell.v || '') : '';
          } else {
            component = compCell.v || '';
          }
        } else {
          component = compCell.v || '';
        }
      }
      
      if (!component) continue; // Skip empty rows

      // Column C = width formula
      const wCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      // Column D = height formula  
      const hCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      // Column E = qty formula
      const qCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
      // Column F = color
      const colorCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      // Column G = remark
      const remarkCell = ws[XLSX.utils.encode_cell({ r, c: 6 })];

      const wFormula = convertFormula(wCell, cellMap, ws, allCellFormulas, allCellValues);
      const hFormula = convertFormula(hCell, cellMap, ws, allCellFormulas, allCellValues);
      const qFormula = convertFormula(qCell, cellMap, ws, allCellFormulas, allCellValues);
      
      // Color: could be a cell reference or literal
      let colorField = colorCell ? (colorCell.f ? convertFormula(colorCell, cellMap, ws, allCellFormulas, allCellValues) : (colorCell.v || 'DW')) : 'DW';
      
      // Remark
      let remarkTemplate = remarkCell ? (remarkCell.v || '') : '';

      // Skip label/description rows that don't have numeric data or formulas
      const wIsText = wCell && !wCell.f && wCell.t === 's' && isNaN(parseFloat(wCell.v));
      const noFormulas = !wCell?.f && !hCell?.f && !qCell?.f;
      const isLabelRow = wIsText || (noFormulas && !hCell?.v && !qCell?.v);
      
      if (wFormula && hFormula && qFormula && !isLabelRow) {
        outputs.push({
          component: String(component),
          widthFormula: wFormula,
          heightFormula: hFormula,
          qtyFormula: qFormula,
          colorField: String(colorField),
          remarkTemplate: String(remarkTemplate)
        });
      }
    }

    // Build the item JSON
    const itemJson = {
      id: itemConfig.id,
      name: itemConfig.name,
      type: itemConfig.type || 'furniture',
      category: itemConfig.category || 'general',
      sourceSheet: itemConfig.sheet,
      sourceRange: itemConfig.range,
      description: itemConfig.description || '',
      inputs: itemConfig.inputMappings.map(m => ({
        key: m.key,
        label: m.label,
        cellRef: m.cellRef,
        type: m.type || 'number',
        unit: m.unit || (m.type === 'number' ? 'mm' : undefined),
        default: m.default,
        min: m.min,
        max: m.max,
        required: m.required !== false,
        options: m.options,
        help: m.help
      })),
      outputs,
      conditionalOutputs: [],
      notes: `Auto-generated from ${itemConfig.sheet} ${itemConfig.range}`
    };

    // Validate by test-running formulas
    const testInputs = {};
    itemConfig.inputMappings.forEach(m => {
      testInputs[m.key] = m.default;
    });

    const testResults = [];
    let errors = 0;
    outputs.forEach(out => {
      try {
        const keys = Object.keys(testInputs);
        const vals = Object.values(testInputs);
        const w = new Function(...keys, `return (${out.widthFormula});`)(...vals);
        const h = new Function(...keys, `return (${out.heightFormula});`)(...vals);
        const q = new Function(...keys, `return (${out.qtyFormula});`)(...vals);
        testResults.push({ component: out.component, w: Math.round(w), h: Math.round(h), q, status: 'ok' });
      } catch (e) {
        testResults.push({ component: out.component, error: e.message, status: 'error' });
        errors++;
      }
    });

    res.json({
      success: true,
      item: itemJson,
      testResults,
      errors,
      totalOutputs: outputs.length
    });

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 5. POST /asm/admin/save — Save generated item to asm-items.json
// ============================================================================
router.post('/save', express.json({ limit: '25mb' }), (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.id) {
      return res.status(400).json({ error: 'Missing item data' });
    }

    const jsonPath = path.join(__dirname, 'data/asm-items.json');
    let data;
    
    if (fs.existsSync(jsonPath)) {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      data = { version: '1.0', items: [] };
    }

    // Check if item with same id already exists
    const existingIdx = data.items.findIndex(i => i.id === item.id);
    if (existingIdx >= 0) {
      data.items[existingIdx] = item; // Replace
    } else {
      data.items.push(item); // Add new
    }

    // Backup current file
    if (fs.existsSync(jsonPath)) {
      const backupPath = jsonPath.replace('.json', `.backup-${Date.now()}.json`);
      fs.copyFileSync(jsonPath, backupPath);
    }

    // Save
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

    res.json({
      success: true,
      message: `Item "${item.name}" saved. Total items: ${data.items.length}`,
      totalItems: data.items.length
    });

  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// IMAGE EXTRACTION (ported)
async function extractImagesFromXLSX(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const itemImages = {};  // { itemId: [{ base64, label }] }
    
    for (const worksheet of workbook.worksheets) {
      // Step 1: Find text markers
      const imageRanges = {};  // { itemName: { startRow, endRow } }
      let currentItem = null;
      let startRow = null;
      
      worksheet.eachRow((row, rowNumber) => {
        // Check cells A and B for markers
        for (let col = 1; col <= 2; col++) {
          const cellVal = row.getCell(col).value;
          if (!cellVal) continue;
          const text = String(cellVal).toLowerCase().trim();
          
          if (text.includes('image start')) {
            // Extract item name: "sliding wardrobe" from "sliding wardrobe image start"
            // Or from cell A when "image start" is in cell B
            if (text === 'image start') {
              // Item name is in column A
              const nameCell = row.getCell(1).value;
              if (nameCell) currentItem = String(nameCell).trim();
            } else {
              const match = String(cellVal).match(/^(.+?)\s*image\s*start/i);
              if (match) currentItem = match[1].trim();
            }
            startRow = rowNumber;
          }
          
          if (text.includes('image end') && currentItem && startRow) {
            imageRanges[currentItem.toLowerCase()] = {
              name: currentItem,
              startRow: startRow,
              endRow: rowNumber
            };
            currentItem = null;
            startRow = null;
          }
        }
      });
      
      console.log(`[ASM] Sheet "${worksheet.name}": found ${Object.keys(imageRanges).length} image sections`);
      
      // Step 2: Get all images from worksheet
      const wsImages = worksheet.getImages().slice().sort((a, b) => {
        const ar = a.range?.tl?.nativeRow ?? 0, br = b.range?.tl?.nativeRow ?? 0;
        if (ar !== br) return ar - br;
        const ac = a.range?.tl?.nativeCol ?? 0, bc = b.range?.tl?.nativeCol ?? 0;
        return ac - bc;
      });
      if (wsImages.length === 0) continue;
      
      console.log(`[ASM] Sheet "${worksheet.name}": ${wsImages.length} embedded images`);
      
      // Step 3: Match images to sections by row position
      for (const img of wsImages) {
        const imgRow = img.range?.tl?.nativeRow;
        if (imgRow === undefined) continue;
        
        // Find which image section this belongs to
        for (const [itemKey, range] of Object.entries(imageRanges)) {
          if (imgRow >= range.startRow - 1 && imgRow <= range.endRow) {
            // Get image buffer from workbook media
            const media = workbook.model.media[img.imageId];
            if (!media || !media.buffer) continue;
            
            const ext = media.extension || 'png';
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            const base64 = media.buffer.toString('base64');
            
            // Create item ID same way as autoParseItem
            const itemId = itemKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
            
            if (!itemImages[itemId]) itemImages[itemId] = [];
            
            // No cap on images per item
            if (true) {
              itemImages[itemId].push({
                base64: `data:${mimeType};base64,${base64}`,
                label: `${range.name} Image ${itemImages[itemId].length + 1}`
              });
              console.log(`[ASM] Extracted image for "${itemKey}" (row ${imgRow}, ${Math.round(media.buffer.length/1024)}KB)`);
            }
          }
        }
      }
    }
    
    return itemImages;
  } catch (error) {
    console.warn('[ASM] Image extraction failed:', error.message);
    return {};
  }
}


// 6. POST /asm/admin/auto-generate — Auto-detect inputs, convert ALL items
// ============================================================================
router.post('/auto-generate', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ error: 'Missing uploadId' });

    const filePath = path.join(__dirname, 'data', 'uploads', uploadId);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Upload not found' });

    const wb = XLSX.readFile(filePath);
    const rcSheet = wb.Sheets['Range Config'];
    if (!rcSheet) return res.status(400).json({ error: 'No Range Config sheet' });

    const rcData = XLSX.utils.sheet_to_json(rcSheet, { header: 1 });
    const rangeItems = [];
    for (let i = 1; i < rcData.length; i++) {
      const row = rcData[i];
      if (row[0] && row[1] && row[2]) {
        rangeItems.push({ sheet: String(row[0]).trim(), name: String(row[1]).trim(), range: String(row[2]).trim() });
      }
    }

    // Extract images using ExcelJS and text markers
    const itemImages = await extractImagesFromXLSX(filePath);

    const results = [];
    const allItems = [];

    for (const ri of rangeItems) {
      const ws = wb.Sheets[ri.sheet];
      if (!ws) {
        results.push({ name: ri.name, status: 'error', error: 'Sheet not found: ' + ri.sheet });
        continue;
      }

      try {
        const parsed = autoParseItem(wb, ws, ri);
        if (!parsed) {
          results.push({ name: ri.name, status: 'skip', error: 'Could not detect structure' });
          continue;
        }

        // Attach reference images by item name (exact, then fuzzy)
        const itemKey = parsed.id;
        let matchedImages = itemImages[itemKey];
        if (!matchedImages) {
          for (const [imgKey, imgs] of Object.entries(itemImages)) {
            if (itemKey.includes(imgKey) || imgKey.includes(itemKey)) {
              matchedImages = imgs;
              break;
            }
          }
        }
        parsed.referenceImages = matchedImages || [];
        console.log(`[ASM] Item "${parsed.id}": ${parsed.referenceImages.length} images attached`);

        // Test all formulas
        const testInputs = {};
        parsed.inputs.forEach(inp => { testInputs[inp.key] = inp.default; });

        let ok = 0, err = 0;
        const testDetails = [];
        parsed.outputs.forEach(out => {
          try {
            const keys = Object.keys(testInputs);
            const vals = Object.values(testInputs);
            const w = new Function(...keys, 'return (' + out.widthFormula + ');')(...vals);
            const h = new Function(...keys, 'return (' + out.heightFormula + ');')(...vals);
            const q = new Function(...keys, 'return (' + out.qtyFormula + ');')(...vals);
            ok++;
            testDetails.push({ component: out.component, w: Math.round(w), h: Math.round(h), q, status: 'ok' });
          } catch (e) {
            err++;
            testDetails.push({ component: out.component, error: e.message, status: 'error' });
          }
        });

        allItems.push(parsed);
        results.push({
          name: ri.name, 
          id: parsed.id,
          status: err === 0 ? 'ok' : 'partial',
          outputs: ok,
          errors: err,
          testDetails
        });
      } catch (e) {
        results.push({ name: ri.name, status: 'error', error: e.message });
      }
    }

    res.json({
      success: true,
      totalItems: rangeItems.length,
      processed: results.length,
      results,
      items: allItems
    });

  } catch (error) {
    console.error('Auto-generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 7. POST /asm/admin/save-all — Save all generated items to asm-items.json
// ============================================================================
router.post('/save-all', express.json({ limit: '25mb' }), (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items to save' });
    }

    const jsonPath = path.join(__dirname, 'data', 'asm-items.json');
    
    // Backup current file
    if (fs.existsSync(jsonPath)) {
      const backupPath = jsonPath.replace('.json', '.backup-' + Date.now() + '.json');
      fs.copyFileSync(jsonPath, backupPath);
    }

    const data = { version: '1.0', exportDate: new Date().toISOString(), items };
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

    res.json({
      success: true,
      message: items.length + ' items saved to asm-items.json. Restart server to load.',
      totalItems: items.length
    });
  } catch (error) {
    console.error('Save-all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 8. POST /asm/admin/push-catalogue — Push items to Supabase catalogue
// ============================================================================
router.post('/push-catalogue', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured (check .env)' });
    const { key, name, description, is_standard, items } = req.body;
    if (!key || !name) return res.status(400).json({ error: 'key and name required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });
    if (!/^[a-z0-9-]+$/.test(key)) return res.status(400).json({ error: 'key must be lowercase letters/numbers/hyphens' });

    const { error } = await _sb.from('catalogues').upsert({
      key, name, description: description || '', items, is_standard: !!is_standard
    });
    if (error) throw error;
    if (_catalogues) _catalogues.invalidate(key);
    res.json({ success: true, message: `Pushed ${items.length} items to "${key}"` });
  } catch (e) {
    console.error('push-catalogue error:', e);
    res.status(500).json({ error: e.message });
  }
});

// List auth users (admin)
router.get('/users', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { data, error } = await _sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    res.json({ success: true, users: data.users.map(u => ({ id: u.id, email: u.email })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Detailed users: email + ASM plan + expiry + signup date
router.get('/users-detailed', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const [{ data: authData, error: authErr }, { data: subs, error: subErr }] = await Promise.all([
      _sb.auth.admin.listUsers({ perPage: 1000 }),
      _sb.from('asm_subscriptions').select('user_id,plan,expires_at,starts_at,months,amount_paid')
    ]);
    if (authErr) throw authErr;
    if (subErr) throw subErr;

    const subMap = {};
    (subs || []).forEach(s => { subMap[s.user_id] = s; });
    const now = new Date();

    const users = authData.users.map(u => {
      const s = subMap[u.id];
      let plan = 'free', active = false, expiresAt = null;
      if (s) {
        expiresAt = s.expires_at;
        active = s.plan === 'pro' && new Date(s.expires_at) > now;
        plan = active ? 'pro' : (s.plan === 'pro' ? 'expired' : 'free');
      }
      return {
        id: u.id,
        email: u.email || '(no email)',
        createdAt: u.created_at || null,
        plan, active, expiresAt,
        months: s ? s.months : null,
        amountPaid: s ? s.amount_paid : null
      };
    });

    // sort: active pro first, then expired, then free; by expiry desc
    users.sort((a, b) => {
      const rank = p => p === 'pro' ? 0 : p === 'expired' ? 1 : 2;
      if (rank(a.plan) !== rank(b.plan)) return rank(a.plan) - rank(b.plan);
      return (new Date(b.expiresAt || 0)) - (new Date(a.expiresAt || 0));
    });

    const stats = {
      total: users.length,
      pro: users.filter(u => u.plan === 'pro').length,
      expired: users.filter(u => u.plan === 'expired').length,
      free: users.filter(u => u.plan === 'free').length
    };
    res.json({ success: true, stats, users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /broadcast — send a notification to all pro users and/or all free users.
// Body: { proMessage, freeMessage }  (either may be blank/omitted)
router.post('/broadcast', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const proMsg  = (req.body && req.body.proMessage  || '').trim();
    const freeMsg = (req.body && req.body.freeMessage || '').trim();
    if (!proMsg && !freeMsg) return res.status(400).json({ error: 'Enter a message for pro and/or free users' });

    const [{ data: authData, error: authErr }, { data: subs, error: subErr }] = await Promise.all([
      _sb.auth.admin.listUsers({ perPage: 1000 }),
      _sb.from('asm_subscriptions').select('user_id,plan,expires_at')
    ]);
    if (authErr) throw authErr;
    if (subErr) throw subErr;

    const now = new Date();
    const proSet = new Set();
    (subs || []).forEach(s => {
      if (s.plan === 'pro' && new Date(s.expires_at) > now) proSet.add(s.user_id);
    });

    const rows = [];
    (authData.users || []).forEach(u => {
      const isPro = proSet.has(u.id);
      if (isPro && proMsg) {
        rows.push({ recipient_id: u.id, type: 'broadcast', title: 'Announcement', body: proMsg });
      } else if (!isPro && freeMsg) {
        rows.push({ recipient_id: u.id, type: 'broadcast', title: 'Announcement', body: freeMsg });
      }
    });

    if (!rows.length) return res.json({ success: true, sent: 0, message: 'No matching recipients' });

    // Insert in chunks to stay well under payload limits.
    let sent = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await _sb.from('asm_notifications').insert(chunk);
      if (error) throw error;
      sent += chunk.length;
    }
    res.json({ success: true, sent, message: `Sent ${sent} notification(s)` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.post('/grant-access', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { user_id, catalogue_key } = req.body;
    let { display_name } = req.body;
    if (!user_id || !catalogue_key) return res.status(400).json({ error: 'user_id and catalogue_key required' });
    display_name = (display_name == null || String(display_name).trim() === '') ? null : String(display_name).trim();
    const { error } = await _sb.from('asm_custom_access')
      .upsert({ user_id, catalogue_key, display_name }, { onConflict: 'user_id,catalogue_key' });
    if (error) throw error;
    if (_catalogues) _catalogues.invalidate(catalogue_key);
    res.json({ success: true, message: 'Access granted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List who has access to one catalogue (+ their alias + email)
router.get('/catalogue-access/:key', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const key = req.params.key;
    if (!key) return res.status(400).json({ error: 'key required' });
    const { data: grants, error } = await _sb.from('asm_custom_access')
      .select('user_id, display_name').eq('catalogue_key', key);
    if (error) throw error;
    // Map user_id -> email
    let emailMap = {};
    try {
      const { data: authData } = await _sb.auth.admin.listUsers({ perPage: 1000 });
      (authData.users || []).forEach(u => { emailMap[u.id] = u.email || '(no email)'; });
    } catch (e) { /* emails optional */ }
    const users = (grants || []).map(g => ({
      user_id: g.user_id,
      display_name: g.display_name || null,
      email: emailMap[g.user_id] || g.user_id
    }));
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Revoke one user's access to one catalogue
router.post('/revoke-access', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { user_id, catalogue_key } = req.body || {};
    if (!user_id || !catalogue_key) return res.status(400).json({ error: 'user_id and catalogue_key required' });
    const { error } = await _sb.from('asm_custom_access')
      .delete().eq('user_id', user_id).eq('catalogue_key', catalogue_key);
    if (error) throw error;
    if (_catalogues) _catalogues.invalidate(catalogue_key);
    res.json({ success: true, message: 'Access revoked' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List catalogues (admin view)
router.post('/delete-catalogue', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await _sb.from('asm_custom_access').delete().eq('catalogue_key', key);
    const { error } = await _sb.from('catalogues').delete().eq('key', key);
    if (error) throw error;
    if (_catalogues) _catalogues.invalidate(key);
    res.json({ success: true, message: `Deleted "${key}"` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Full items (with images) for one catalogue — for image manager
router.get('/catalogue-items/:key', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { data, error } = await _sb.from('catalogues').select('items').eq('key', req.params.key).single();
    if (error) throw error;
    const items = (data.items || []).map(it => ({
      id: it.id, name: it.name,
      is_free: !!it.is_free,
      images: (it.referenceImages || []).map(img => img.base64 || img)
    }));
    res.json({ success: true, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save reordered images (main first) for multiple items
router.post('/set-main-images', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { key, mains } = req.body; // mains: { itemId: mainIndex, ... }
    if (!key || !mains) return res.status(400).json({ error: 'key and mains required' });
    const { data, error } = await _sb.from('catalogues').select('items').eq('key', key).single();
    if (error) throw error;
    const items = (data.items || []).map(it => {
      const mi = mains[it.id];
      if (mi != null && it.referenceImages && it.referenceImages[mi]) {
        const imgs = it.referenceImages.slice();
        const [main] = imgs.splice(mi, 1);
        imgs.unshift(main);
        it.referenceImages = imgs;
      }
      return it;
    });
    const { error: upErr } = await _sb.from('catalogues').update({ items }).eq('key', key);
    if (upErr) throw upErr;
    if (_catalogues) _catalogues.invalidate(key);
    res.json({ success: true, message: 'Main images saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save free/paid flags for items in a saved catalogue
router.post('/set-free-items', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { key, freeMap } = req.body; // freeMap: { itemId: true/false, ... }
    if (!key || !freeMap) return res.status(400).json({ error: 'key and freeMap required' });
    const { data, error } = await _sb.from('catalogues').select('items').eq('key', key).single();
    if (error) throw error;
    const items = (data.items || []).map(it => {
      if (Object.prototype.hasOwnProperty.call(freeMap, it.id)) it.is_free = !!freeMap[it.id];
      return it;
    });
    const { error: upErr } = await _sb.from('catalogues').update({ items }).eq('key', key);
    if (upErr) throw upErr;
    if (_catalogues) _catalogues.invalidate(key);
    res.json({ success: true, message: 'Free items saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/catalogues', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { data, error } = await _sb.from('catalogues').select('key,name,is_standard');
    if (error) throw error;
    res.json({ success: true, catalogues: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Sentence-case for DISPLAY strings only (labels, component/item names).
// First letter upper, rest lower. Never used for keys/ids or formula refs.
function toSentence(s) {
  s = String(s == null ? '' : s).trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function autoParseItem(wb, ws, rangeInfo) {  const rangeRef = XLSX.utils.decode_range(rangeInfo.range);
  const startRow = rangeRef.s.r; // 0-indexed
  const endRow = rangeRef.e.r;

  // Scan for a "Note" label cell (col A) → adjacent (col B) is the note text
  let itemNote = '';
  for (let r = startRow; r <= endRow; r++) {
    const labelCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (labelCell && String(labelCell.v || '').trim().toLowerCase() === 'note') {
      const valCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      itemNote = valCell ? String(valCell.v || '').trim() : '';
      break;
    }
  }

  // Detect manual-entry item: any cell in cols A-D (rows of this item block)
  // containing 'manual' (tolerant of spacing/case/typos like 'manual item', 'manual-item', 'manual').
  let isManual = false;
  for (let r = startRow; r <= endRow && !isManual; r++) {
    for (let c = 0; c <= 3; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const txt = cell ? String(cell.v || '').trim().toLowerCase() : '';
      if (txt.includes('manual')) { isManual = true; break; }
    }
  }

  // Step 1: Find the header row (contains "BOX NO." or "w" + "h" + "qty")
  let headerRow = -1;
  for (let r = startRow; r <= endRow; r++) {
    const vals = [];
    for (let c = 0; c < 8; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      vals.push(cell ? String(cell.v || '').toLowerCase().trim() : '');
    }
    if (vals.includes('box no.') || (vals.includes('w') && vals.includes('h') && vals.includes('qty'))) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return null;

  // Step 2: Everything above header = inputs. Scan for cells with values.
  // Column model: A = label, B = value, C = "input" tag, D = unit marker (e.g. "mm").
  // (Legacy D-label/E-value second column removed — D is now the unit marker.)
  const inputMappings = [];
  const cellMap = {};

  for (let r = startRow; r < headerRow; r++) {
    const valueCols = [
      { labelCol: 0, valueCol: 1, ref: 'B' },  // Column A label → Column B value
    ];

    for (const vc of valueCols) {
      const labelCell = ws[XLSX.utils.encode_cell({ r, c: vc.labelCol })];
      const rawLabel = labelCell ? String(labelCell.v || '').trim() : '';
      const label = toSentence(rawLabel); // display only
      if (!rawLabel || rawLabel.startsWith('(')) continue; // Skip notes/instructions

      const cell = ws[XLSX.utils.encode_cell({ r, c: vc.valueCol })];

      const tagCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      const isTagged = tagCell && String(tagCell.v || '').trim().toLowerCase() === 'input';
      if (!isTagged) {
        if (!cell || cell.v === undefined || cell.v === null) continue;
        if (cell.f) continue;
      }

      // Unit marker from Column D (e.g. "mm"). Blank = non-dimension (count/text).
      const unitCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      const unit = unitCell ? String(unitCell.v || '').trim().toLowerCase() : '';

      const cellRef = vc.ref + (r + 1);
      const key = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!key || key === 'room' || key === 'item' || key === 'note') continue;

      // Determine type
      let type = 'number';
      let def = (cell && cell.v !== undefined && cell.v !== null) ? cell.v : '';
      if (def === '') {
        type = 'text';
      } else if (typeof def === 'boolean') {
        type = 'boolean';
      } else if (typeof def === 'string' && isNaN(parseFloat(def))) {
        type = 'text';
      } else {
        def = parseFloat(def) || 0;
      }

      // Avoid duplicate keys
      let uniqueKey = key;
      let counter = 2;
      while (inputMappings.some(m => m.key === uniqueKey)) {
        uniqueKey = key + '_' + counter;
        counter++;
      }

      const mapping = {
        key: uniqueKey,
        label: label,
        cellRef,
        type,
        default: def,
        required: ['width', 'ht', 'depth', 'qty', 'w', 'h', 'd'].includes(uniqueKey)
      };
      // Tag dimension inputs so production converts only these when units change.
      if (unit === 'mm') mapping.unit = 'mm';

      inputMappings.push(mapping);

      cellMap[cellRef] = uniqueKey;
    }
  }

  if (inputMappings.length === 0) return null;

  // Step 3: Build allCellFormulas and allCellValues maps
  const allCellFormulas = {};
  const allCellValues = {};
  for (let r = rangeRef.s.r; r <= rangeRef.e.r; r++) {
    for (let c = rangeRef.s.c; c <= rangeRef.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellAddr];
      const ref = XLSX.utils.encode_col(c) + (r + 1);
      if (cell) {
        if (cell.f) allCellFormulas[ref] = cell.f;
        if (cell.v !== undefined && cell.v !== null) allCellValues[ref] = cell.v;
      }
    }
  }

  // Manual-entry item: user types W/H/QTY, material/remark auto per row
  if (isManual) {
    const dataRow = headerRow + 1;
    const matCell = ws[XLSX.utils.encode_cell({ r: dataRow, c: 4 })];
    const remCell = ws[XLSX.utils.encode_cell({ r: dataRow, c: 5 })];
    const relConv = (cell) => {
      if (!cell || !cell.f) return cell && cell.v != null ? JSON.stringify(String(cell.v)) : '""';
      let f = cell.f.startsWith('=') ? cell.f.substring(1) : cell.f;
      f = f.replace(/ISBLANK\(([^)]+)\)/gi, '($1 === "" || $1 === null || $1 === undefined)');
      f = convertIfToTernary(f);
      f = f.replace(/&/g, '+');
      f = f.replace(/\$?([A-Z]+)\$?(\d+)/g, (m, col, row) => {
        const rowNum = parseInt(row);
        // This row's own cells → relative w/h/qty
        if (rowNum === dataRow + 1 || rowNum === dataRow) {
          if (col === 'B') return 'w';
          if (col === 'C') return 'h';
          if (col === 'D') return 'qty';
        }
        const ref = col + row;
        if (cellMap[ref]) return cellMap[ref];      // absolute input
        if (allCellValues[ref] !== undefined) {
          const v = allCellValues[ref];
          return typeof v === 'string' ? JSON.stringify(v) : String(v);
        }
        return '""';
      });
      return f;
    };
    return {
      id: rangeInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: toSentence(rangeInfo.name),
      category: rangeInfo.sheet.toLowerCase(),
      manualEntry: true,
      materialFormula: relConv(matCell),
      remarkFormula: relConv(remCell),
      inputs: inputMappings.map(m => ({
        key: m.key, label: m.label, cellRef: m.cellRef, type: m.type, default: m.default, required: m.required,
        unit: m.unit,
        min: m.type === 'number' ? 0 : undefined, max: m.type === 'number' ? 10000 : undefined
      })),
      outputs: [], subItems: [], conditionalOutputs: [],
      notes: itemNote || ''
    };
  }

  // Step 4: Extract outputs (everything below header row)
  const outputs = [];
  const subItems = [];           // {name, subW, subH, subD, subQty}
  let currentSubItem = null;     // name of active sub-item
  for (let r = headerRow + 1; r <= endRow; r++) {
    const compCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const rawLabel = compCell ? String(compCell.v || '').trim() : '';
    const lowLabel = rawLabel.toLowerCase();

    // Sub-item boundaries
    if (lowLabel === 'sub item start') {
      const nameCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      currentSubItem = nameCell ? String(nameCell.v || '').trim() : 'Sub Item';
      subItems.push({ name: currentSubItem, subW: '', subH: '', subD: '', subQty: '' });
      continue;
    }
    if (lowLabel === 'sub item end') { currentSubItem = null; continue; }

    // Sub dimension rows (sub w / sub h / sub d / sub qty)
    if (currentSubItem && /^sub\s+(w|h|d|qty)$/.test(lowLabel)) {
      const dimCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      const dimFormula = convertFormula(dimCell, cellMap, ws, allCellFormulas, allCellValues);
      const si = subItems[subItems.length - 1];
      const which = lowLabel.split(/\s+/)[1];
      if (which === 'w') si.subW = dimFormula;
      else if (which === 'h') si.subH = dimFormula;
      else if (which === 'd') si.subD = dimFormula;
      else if (which === 'qty') si.subQty = dimFormula;
      continue;
    }
    // Skip a sub-item's own output header row (w|h|qty / w|d|qty)
    if (currentSubItem) {
      const c1 = String((ws[XLSX.utils.encode_cell({ r, c: 1 })] || {}).v || '').toLowerCase().trim();
      const c2 = String((ws[XLSX.utils.encode_cell({ r, c: 2 })] || {}).v || '').toLowerCase().trim();
      const c3 = String((ws[XLSX.utils.encode_cell({ r, c: 3 })] || {}).v || '').toLowerCase().trim();
      if ((c1 === 'w') && (c2 === 'h' || c2 === 'd') && (c3 === 'qty')) continue;
    }

    let component = '';
    if (compCell) {
      if (compCell.f) {
        const refMatch = compCell.f.match(/^A(\d+)$/);
        if (refMatch) {
          const refRow = parseInt(refMatch[1]) - 1;
          const refCell = ws[XLSX.utils.encode_cell({ r: refRow, c: 0 })];
          component = refCell ? toSentence(refCell.v || '') : '';
        } else {
          component = compCell.v ? toSentence(compCell.v) : '';
        }
      } else {
        component = compCell.v ? toSentence(compCell.v) : '';
      }
    }
    if (!component) continue;

    const wCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];  // Column B
    const hCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];  // Column C
    const qCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];  // Column D
    const colorCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];  // Column E
    const remarkCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];  // Column F

    // Skip label/text rows
    const wIsText = wCell && !wCell.f && wCell.t === 's' && isNaN(parseFloat(wCell.v));
    const noData = !wCell?.f && !hCell?.f && !qCell?.f && !hCell?.v && !qCell?.v;
    if (wIsText || noData) continue;

    const wFormula = convertFormula(wCell, cellMap, ws, allCellFormulas, allCellValues);
    const hFormula = convertFormula(hCell, cellMap, ws, allCellFormulas, allCellValues);
    const qFormula = convertFormula(qCell, cellMap, ws, allCellFormulas, allCellValues);
    let colorField = colorCell ? (colorCell.f ? convertFormula(colorCell, cellMap, ws, allCellFormulas, allCellValues) : String(colorCell.v || 'DW')) : 'DW';
    let remarkTemplate = remarkCell ? String(remarkCell.v || '') : '';
    let remarkFormula = '';
    if (remarkCell && remarkCell.f) {
      remarkFormula = convertFormula(remarkCell, cellMap, ws, allCellFormulas, allCellValues) || '';
    }

    if (wFormula && hFormula && qFormula) {
      const wRef = 'B' + (r + 1), hRef = 'C' + (r + 1), qRef = 'D' + (r + 1);
      outputs.push({
        component, subItem: currentSubItem || null, widthFormula: wFormula, heightFormula: hFormula, qtyFormula: qFormula,
        colorField, remarkTemplate, remarkFormula,
        cellRefs: { w: wRef, h: hRef, q: qRef },
        depW: convertFormulaDep(wCell, cellMap, allCellFormulas, allCellValues),
        depH: convertFormulaDep(hCell, cellMap, allCellFormulas, allCellValues),
        depQ: convertFormulaDep(qCell, cellMap, allCellFormulas, allCellValues)
      });
    }
  }

  // Build item JSON
  const itemId = rangeInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  return {
    id: itemId,
    name: toSentence(rangeInfo.name),
    type: 'furniture',
    category: rangeInfo.sheet.toLowerCase(),
    sourceSheet: rangeInfo.sheet,
    sourceRange: rangeInfo.range,
    description: rangeInfo.name + ' (auto-generated)',
    inputs: inputMappings.map(m => ({
      key: m.key, label: m.label, cellRef: m.cellRef, type: m.type,
      default: m.default, required: m.required,
      unit: m.unit,
      min: m.type === 'number' ? 0 : undefined,
      max: m.type === 'number' ? 10000 : undefined
    })),
    outputs,
    subItems,
    conditionalOutputs: [],
    notes: itemNote || ''
  };
}


// Dependency-aware conversion: output-cell refs become cell.XXX (not inlined)
function convertFormulaDep(cell, cellMap, allCellFormulas, allCellValues) {
  if (!cell || !cell.f) {
    if (cell && cell.v !== undefined && cell.v !== null) {
      return typeof cell.v === 'string' ? JSON.stringify(cell.v) : String(cell.v);
    }
    return '""';
  }
  let f = cell.f;
  if (f.startsWith('=')) f = f.substring(1);
  f = f.replace(/ROUND\(/gi, 'Math.round(').replace(/ABS\(/gi, 'Math.abs(')
       .replace(/MAX\(/gi, 'Math.max(').replace(/MIN\(/gi, 'Math.min(');
  f = f.replace(/ISBLANK\(([^)]+)\)/gi, '($1 === "" || $1 === null || $1 === undefined)');
  f = convertIfToTernary(f);
  f = f.replace(/&/g, '+');
  f = f.replace(/\$?([A-Z]+)\$?(\d+)/g, (match, col, row) => {
    const ref = col + row;
    if (cellMap[ref]) return cellMap[ref];            // input key
    if (allCellFormulas && allCellFormulas[ref]) return 'cell["' + ref + '"]'; // output ref → live
    if (allCellValues && allCellValues[ref] !== undefined) {
      const v = allCellValues[ref];
      return typeof v === 'string' ? JSON.stringify(v) : String(v);
    }
    return '""';
  });
  return f;
}

// ============================================================================
// HELPER: Convert Excel formula to JS formula using cell mappings
// ============================================================================
function convertFormula(cell, cellMap, ws, allCellFormulas, allCellValues) {
  if (!cell) return '0';
  
  // If it's a formula
  if (cell.f) {
    let formula = cell.f;
    
    // Remove leading =
    if (formula.startsWith('=')) formula = formula.substring(1);
    
    // Convert Excel functions to JS FIRST (before cell ref replacement)
    formula = formula.replace(/ROUND\(/gi, 'Math.round(');
    formula = formula.replace(/ABS\(/gi, 'Math.abs(');
    formula = formula.replace(/MAX\(/gi, 'Math.max(');
    formula = formula.replace(/MIN\(/gi, 'Math.min(');
    
    // Convert ISBLANK
    formula = formula.replace(/ISBLANK\(([^)]+)\)/gi, '($1 === "" || $1 === null || $1 === undefined)');
    
    // Convert IF to ternary
    formula = convertIfToTernary(formula);
    
    // Replace & (Excel string concat) with + (JS)
    formula = formula.replace(/&/g, '+');
    
    // Replace cell references with variable names OR resolved formulas
    formula = formula.replace(/\$?([A-Z]+)\$?(\d+)/g, (match, col, row) => {
      const ref = col + row;
      // If it maps to an input variable, use the variable name
      if (cellMap[ref]) {
        return cellMap[ref];
      }
      // If it references another output cell, try to resolve it
      if (allCellFormulas && allCellFormulas[ref]) {
        const resolved = resolveOutputRef(ref, cellMap, allCellFormulas, 0);
        if (resolved) return '(' + resolved + ')';
      }
      // If it's a plain value in the sheet, use that value directly
      if (allCellValues && allCellValues[ref] !== undefined) {
        const v = allCellValues[ref];
        if (typeof v === 'string') return '"' + v.replace(/"/g, '\\"') + '"';
        return String(v);
      }
      // Unmapped/blank cell (e.g. optional input left empty) → treat as empty string
      return '""';
    });
    
    return formula;
  }
  
  // If it's a plain value
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v);
  }
  
  return '0';
}

// Resolve an output cell reference by substituting its formula
function resolveOutputRef(ref, cellMap, allCellFormulas, depth) {
  if (depth > 5) return null; // Prevent infinite recursion
  
  const cellFormula = allCellFormulas[ref];
  if (!cellFormula) return null; // Will be handled by allCellValues fallback
  
  let formula = cellFormula;
  if (formula.startsWith('=')) formula = formula.substring(1);
  
  // Convert Excel functions
  formula = formula.replace(/ROUND\(/gi, 'Math.round(');
  formula = formula.replace(/ABS\(/gi, 'Math.abs(');
  formula = formula.replace(/MAX\(/gi, 'Math.max(');
  formula = formula.replace(/MIN\(/gi, 'Math.min(');
  formula = formula.replace(/ISBLANK\(([^)]+)\)/gi, '($1 === "" || $1 === null || $1 === undefined)');
  formula = convertIfToTernary(formula);
  formula = formula.replace(/&/g, '+');
  
  // Replace cell references
  formula = formula.replace(/\$?([A-Z]+)\$?(\d+)/g, (match, col, row) => {
    const innerRef = col + row;
    if (cellMap[innerRef]) return cellMap[innerRef];
    if (allCellFormulas[innerRef] && innerRef !== ref) {
      const resolved = resolveOutputRef(innerRef, cellMap, allCellFormulas, depth + 1);
      if (resolved) return '(' + resolved + ')';
    }
    return match;
  });
  
  return formula;
}

function convertIfToTernary(formula) {
  let result = formula;
  let maxIterations = 10;
  
  while (maxIterations > 0) {
    maxIterations--;
    const ifIdx = result.search(/IF\s*\(/i);
    if (ifIdx === -1) break;
    
    const openParen = result.indexOf('(', ifIdx);
    if (openParen === -1) break;
    
    let depth = 1;
    let closeParen = -1;
    for (let i = openParen + 1; i < result.length; i++) {
      if (result[i] === '(') depth++;
      else if (result[i] === ')') {
        depth--;
        if (depth === 0) { closeParen = i; break; }
      }
    }
    if (closeParen === -1) break;
    
    const innerContent = result.substring(openParen + 1, closeParen);
    const parts = splitByComma(innerContent);
    
    let replacement;
    if (parts.length >= 3) {
      replacement = '((' + parts[0].trim() + ') ? (' + parts[1].trim() + ') : (' + parts[2].trim() + '))';
    } else if (parts.length === 2) {
      replacement = '((' + parts[0].trim() + ') ? (' + parts[1].trim() + ') : 0)';
    } else {
      break;
    }
    
    result = result.substring(0, ifIdx) + replacement + result.substring(closeParen + 1);
  }
  
  return result;
}

function splitByComma(str) {
  const parts = [];
  let current = '';
  let depth = 0;
  
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}


// ── ASM Pricing management ──
router.get('/pricing', async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { data, error } = await _sb.from('asm_pricing').select('*').order('months', { ascending: true });
    if (error) throw error;
    res.json({ success: true, plans: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pricing/save', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { id, months, price, label, active } = req.body || {};
    if (!id || !/^[a-z0-9_]+$/.test(id)) return res.status(400).json({ error: 'id required (lowercase letters/numbers/underscore)' });
    if (!(Number(months) > 0)) return res.status(400).json({ error: 'months must be a positive number' });
    if (!(Number(price) >= 0)) return res.status(400).json({ error: 'price must be >= 0' });
    const { error } = await _sb.from('asm_pricing').upsert({
      id, months: Number(months), price: Number(price),
      label: label || (months + ' Months'), active: active !== false
    }, { onConflict: 'id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pricing/delete', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await _sb.from('asm_pricing').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Manual subscription override (admin) ──
router.post('/user-set-plan', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    let { user_id, plan, months, planId, extend } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    // If planId given, pull months from asm_pricing
    if (planId) {
      const { data: pr } = await _sb.from('asm_pricing').select('months').eq('id', planId).single();
      if (pr && pr.months) months = pr.months;
    }
    plan = plan || 'pro';

    if (plan === 'free') {
      // downgrade: expire now
      const { error } = await _sb.from('asm_subscriptions').upsert({
        user_id, plan: 'free', expires_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      return res.json({ success: true, plan: 'free' });
    }

    const m = Number(months);
    if (!(m > 0)) return res.status(400).json({ error: 'months (or valid planId) required' });

    // extend = add months to existing expiry if still active; else from now
    let base = new Date();
    if (extend) {
      const { data: cur } = await _sb.from('asm_subscriptions').select('expires_at').eq('user_id', user_id).single();
      if (cur && new Date(cur.expires_at) > base) base = new Date(cur.expires_at);
    }
    const expiresAt = new Date(base);
    expiresAt.setMonth(expiresAt.getMonth() + m);

    const { error } = await _sb.from('asm_subscriptions').upsert({
      user_id, plan: 'pro', months: m,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_id: 'ADMIN_MANUAL'
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true, plan: 'pro', expiresAt: expiresAt.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/user-revoke', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!_sb) return res.status(500).json({ error: 'Supabase not configured' });
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const { error } = await _sb.from('asm_subscriptions').upsert({
      user_id, plan: 'free', expires_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
