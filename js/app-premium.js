// ══ PREMIUM / PLAN SYSTEM ══
// Plan fetched from API on load. Falls back to 'free' if API unavailable.
let PLAN = localStorage.getItem('ecl_plan') || 'free';
let FEATURE_FLAGS = JSON.parse(localStorage.getItem('ecl_flags')||'{}');
// Feature-set granted by the user's current plan (flag_key -> true).
// Empty for free users. Populated from /my-plan.
let PLAN_FEATURES = JSON.parse(localStorage.getItem('ecl_plan_features')||'{}');

// Fetch plan + flags from server (non-blocking)
async function fetchPlanAndFlags(){
  try {
    const [planRes, flagsRes] = await Promise.all([
      fetch(`${API_URL}/my-plan`, { headers: authHeader() }),
      fetch(`${API_URL}/flags`)
    ]);
    if(planRes.ok){
      const data = await planRes.json();
      const {plan, trialExportsUsed, planExpiresAt, trialLimit, features} = data;
      PLAN = plan;
      PLAN_FEATURES = features || {};
      localStorage.setItem('ecl_plan_features', JSON.stringify(PLAN_FEATURES));
      TRIAL_EXPORTS_USED = trialExportsUsed || 0;
      PLAN_EXPIRES_AT    = planExpiresAt || null;
      TRIAL_LIMIT        = trialLimit || 3;
      localStorage.setItem('ecl_plan', plan);
      const planEl = document.getElementById('hdr-user-plan');
      if(planEl) planEl.textContent = (plan||'free').toUpperCase();
      // Show UPGRADE button only for free users who are signed in
      const upgradeBtn = document.getElementById('hdr-upgrade-btn');
      if(upgradeBtn) upgradeBtn.style.display = (plan && plan !== 'free') ? 'none' : '';
      const mobUpgrade = document.getElementById('mob-upgrade-btn');
      if(mobUpgrade) mobUpgrade.style.display = (plan && plan !== 'free') ? 'none' : '';
    }
    updateUpgradeBtn();
    if(flagsRes.ok){
      FEATURE_FLAGS = await flagsRes.json();
      localStorage.setItem('ecl_flags', JSON.stringify(FEATURE_FLAGS));
    }
  } catch(e){ /* use cached values */ }
  // Resume a pending buy if the user just logged in via the Buy button.
  try {
    if(CURRENT_USER){
      const pend = JSON.parse(localStorage.getItem('ecl_pending_buy')||'null');
      // Only honour a recent intent (10 min) to avoid stale reopens.
      if(pend && pend.tierId && (Date.now() - (pend.t||0) < 600000)){
        localStorage.removeItem('ecl_pending_buy');
        _selectedTier   = pend.tierId;
        _selectedMonths = pend.months || 6;
        await openPricing();
        // Give the modal a tick to render, then start payment.
        setTimeout(()=>{ startPayment(); }, 400);
      } else if(pend){
        localStorage.removeItem('ecl_pending_buy');
      }
    }
  } catch(e){}
}

const PREMIUM_FEATURES = {
  cutSequence:   { name: 'Cutting Sequence Diagram', plan: 'pro' },
  exportExcelFn: { name: 'Excel Export',             plan: 'pro' },
  exportCSVFn:   { name: 'CSV Export',               plan: 'pro' },
  exportLabels:  { name: 'Export Panel Labels',      plan: 'pro' },
  exportOrder:   { name: 'Export Laminate Order',    plan: 'pro' },
  costEstimation:{ name: 'Cost Estimation',          plan: 'pro' },
  edgeBanding:   { name: 'Edge Banding',             plan: 'pro' },
  reviewCheck:   { name: 'Review (Error Check)',     plan: 'pro' },
  priceBook:     { name: 'Material Price Book',      plan: 'free' },
  clients:       { name: 'Client Management',        plan: 'free' },
  projects:      { name: 'Save Projects',            plan: 'free' },
};

const FLAG_KEY_MAP = {
  exportExcelFn:    'exportExcel',
  exportCSVFn:      'exportCSV',
  exportLabels:     'exportLabels',
  cutSequence:      'cutSequenceTable',
  exportOrder:      'exportOrder',
  costEstimation:   'costEstimation',
  edgeBanding:      'edgeBanding',
  reviewCheck:      'reviewCheck',
};

function isPro(){ return PLAN && PLAN !== 'free'; }

// Feature access resolution (order matters):
// 1. Admin flag set to "free" → available to everyone (global override).
// 2. User's plan grants this specific feature → available.
// 3. Otherwise locked.
// Note: gating here is UX only; the server is the source of truth on
// paid actions (trial export counting, etc.).
function hasFeature(flagKey){
  // 1. Admin global "free" override — available to everyone
  const flag = FEATURE_FLAGS && FEATURE_FLAGS[flagKey];
  if(flag === 'free' || flag === true) return true;
  // 2. Granted only if the user's plan feature-set includes it.
  //    (Backend always returns a real tier feature-set for pro users,
  //     so there is no "empty = all-on" fallback — unchecked means locked.)
  if(isPro() && PLAN_FEATURES && PLAN_FEATURES[flagKey] === true) return true;
  // 3. Locked
  return false;
}

// Also show/hide upgrade button based on current plan
function toggleMobNav(){
  const nav = document.getElementById('mob-nav');
  nav.classList.toggle('open');
}

function updateUpgradeBtn(){
  const btn = document.getElementById('hdr-upgrade-btn');
  if(!btn) return;
  btn.style.display = isPro() ? 'none' : '';
}

function requirePro(featureKey, cb){
  const flagKey = FLAG_KEY_MAP[featureKey] || featureKey;
  if(hasFeature(flagKey)){ cb(); return; }
  const feat = PREMIUM_FEATURES[featureKey] || { name: featureKey };
  showUpgrade(feat.name);
}

function showUpgrade(featureName=''){
  // Open the pricing modal for everyone (logged in or not).
  openPricing(featureName);
}
function closeUpgrade(){ document.getElementById('upgrade-modal').style.display='none'; }
function goUpgrade(){
  closeUpgrade();
  openPricing();
}

// ══ PRICING & PAYMENTS (tier system) ══
let _selectedTier   = null;   // tier_id
let _selectedMonths = 6;      // duration toggle
let _tierData       = null;   // { tiers:[], pricing:[] }
let TRIAL_EXPORTS_USED = 0;
let TRIAL_LIMIT = 3;
let PLAN_EXPIRES_AT = null;

// The 11 gateable features, in display order. Must match admin OPT_FEATURES keys.
const TIER_FEATURE_LIST = [
  ['edgeBanding',      'Edge band effect'],
  ['exportLabels',     'Panel stickers print'],
  ['exportOrder',      'Export material order'],
  ['costEstimation',   'Cost estimation'],
  ['projects',         'Save projects'],
  ['pdfLogoHeader',    'PDF — Company logo'],
  ['pdfClientName',    'PDF — Client name'],
  ['pdfCompanyName',   'PDF — Company name'],
  ['pdfCustomText',    'PDF — Custom header'],
  ['cutSequenceTable', 'Cutting sequence badge'],
  ['reviewCheck',      'Review check'],
];

async function openPricing(featureName=''){
  // Open for everyone — logged-out users can browse plans.
  // Login is only required at Buy (see startPayment).
  const sub = document.getElementById('pricing-sub');
  if(featureName && sub) sub.textContent = `"${featureName}" is a Pro feature. Choose a plan to unlock it.`;
  else if(sub) sub.textContent = 'Choose the plan that fits you. Cancel anytime.';
  document.getElementById('pricing-modal').style.display = 'flex';
  await loadPricing();
}

function closePricing(){
  document.getElementById('pricing-modal').style.display = 'none';
}

async function loadPricing(){
  try {
    const res = await fetch(`${API_URL}/tiers`);
    if(!res.ok) return;
    _tierData = await res.json();
    if(!_tierData.tiers || !_tierData.tiers.length) return;

    // Available durations (from pricing rows), ascending
    const months = [...new Set((_tierData.pricing||[]).map(p => p.months))].sort((a,b)=>a-b);
    if(!months.length) return;
    if(!months.includes(_selectedMonths)) _selectedMonths = months.includes(6) ? 6 : months[0];

    renderDurationToggle(months);
    renderTierColumns();
  } catch(e){ console.error('loadPricing:', e); }
}

function renderDurationToggle(months){
  const el = document.getElementById('pricing-duration-toggle');
  if(!el) return;
  const lbl = m => m === 12 ? '1 Year' : (m + ' Months');
  el.innerHTML = months.map(m =>
    `<button class="dur-btn${m===_selectedMonths?' active':''}" onclick="setDuration(${m})">${lbl(m)}</button>`
  ).join('');
}

function setDuration(m){
  _selectedMonths = m;
  const months = [...new Set((_tierData.pricing||[]).map(p => p.months))].sort((a,b)=>a-b);
  renderDurationToggle(months);
  renderTierColumns();
}

function priceFor(tierId, months){
  const row = (_tierData.pricing||[]).find(p => p.tier_id===tierId && p.months===months);
  return row ? Number(row.price_inr) : null;
}

function renderTierColumns(){
  const wrap = document.getElementById('pricing-tiers');
  if(!wrap) return;
  const tiers = _tierData.tiers || [];

  // Default selection = highest-rank tier that has a price for this duration
  if(!_selectedTier || !priceFor(_selectedTier, _selectedMonths)){
    const firstPriced = tiers.find(t => priceFor(t.tier_id, _selectedMonths) != null);
    _selectedTier = firstPriced ? firstPriced.tier_id : (tiers[0] && tiers[0].tier_id);
  }

  wrap.innerHTML = tiers.map(t => {
    const price = priceFor(t.tier_id, _selectedMonths);
    const feats = t.features || {};
    const sel = (t.tier_id === _selectedTier) ? ' selected' : '';
    const badge = t.badge ? `<div class="tier-badge">${esc(t.badge)}</div>` : '';
    const priceHtml = price != null
      ? `₹${price.toLocaleString('en-IN')}<span>/${_selectedMonths===12?'yr':_selectedMonths+'mo'}</span>`
      : '<span style="font-size:13px;color:var(--sl-text2)">Not available</span>';
    const featRows = TIER_FEATURE_LIST.map(f => {
      const on = feats[f[0]] === true;
      return `<div class="tier-feat ${on?'on':'off'}">${on?'✓':'✗'} ${f[1]}</div>`;
    }).join('');
    const disabled = price == null ? ' disabled' : '';
    return `<div class="tier-col${sel}" id="tier-${t.tier_id}" onclick="selectTier('${t.tier_id}')">
      ${badge}
      <div class="tier-name">${esc(t.name)}</div>
      ${t.subtitle?`<div class="tier-sub">${esc(t.subtitle)}</div>`:''}
      <div class="tier-price">${priceHtml}</div>
      <div class="tier-feats">${featRows}</div>
      <button class="tier-buy"${disabled} onclick="event.stopPropagation();selectTier('${t.tier_id}');startPayment()">Buy now</button>
    </div>`;
  }).join('');
}

function selectTier(tierId){
  _selectedTier = tierId;
  document.querySelectorAll('#pricing-tiers .tier-col').forEach(el => {
    el.classList.toggle('selected', el.id === 'tier-'+tierId);
  });
}

async function startPayment(){
  if(!_selectedTier){ alert('Please select a plan.'); return; }
  const price = priceFor(_selectedTier, _selectedMonths);
  if(price == null){ alert('This plan is not available for the selected duration.'); return; }

  // Not logged in → stash selection, send to Google sign-in, resume after redirect.
  if(!CURRENT_USER){
    try {
      localStorage.setItem('ecl_pending_buy', JSON.stringify({
        tierId: _selectedTier, months: _selectedMonths, t: Date.now()
      }));
    } catch(e){}
    signInGoogle();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/payments/create-order`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...authHeader()},
      body: JSON.stringify({
        tierId:  _selectedTier,
        months:  _selectedMonths,
        userId:  CURRENT_USER.id,
        email:   CURRENT_USER.email,
      })
    });
    const order = await res.json();
    if(!res.ok) throw new Error(order.error || 'Failed to create order');

    const tierObj = (_tierData.tiers||[]).find(t => t.tier_id===_selectedTier);
    const rzp = new Razorpay({
      key:         order.keyId,
      amount:      order.amount,
      currency:    order.currency,
      order_id:    order.orderId,
      name:        'EasyCutList',
      description: (tierObj?.name || 'Pro') + ' — ' + (_selectedMonths===12?'1 Year':_selectedMonths+' Months'),
      prefill:     { email: CURRENT_USER.email || '' },
      theme:       { color: '#3F0E40' },
      handler: async function(response){
        await verifyPayment(response, order.orderId);
      },
    });
    rzp.open();
  } catch(e){
    alert('Error: ' + e.message);
  }
}

async function verifyPayment(response, orderId){
  try {
    const res = await fetch(`${API_URL}/payments/verify`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...authHeader()},
      body: JSON.stringify({
        razorpay_order_id:   orderId,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature:  response.razorpay_signature,
        userId:  CURRENT_USER.id,
        tierId:  _selectedTier,
        months:  _selectedMonths,
      })
    });
    const result = await res.json();
    if(!res.ok) throw new Error(result.error || 'Verification failed');

    // Success — update local state
    PLAN = 'pro';
    PLAN_EXPIRES_AT = result.expiresAt;
    localStorage.setItem('ecl_plan', 'pro');
    const planEl = document.getElementById('hdr-user-plan');
    if(planEl) planEl.textContent = 'PRO';
    updateUpgradeBtn();
    closePricing();
    closeUpgrade();

    // Refresh plan from server
    await fetchPlanAndFlags();

    const expDate = new Date(result.expiresAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    alert(`🎉 Welcome to EasyCutList Pro!\nYour plan is active until ${expDate}.`);
  } catch(e){
    alert('Payment verification failed: ' + e.message + '\nPlease contact support with your payment ID: ' + response.razorpay_payment_id);
  }
}

// Show trial bar in results if on free plan
function renderTrialBar(){
  const existing = document.getElementById('trial-bar');
  if(existing) existing.remove();
  if(isPro() || !CURRENT_USER) return;
  const remaining = Math.max(0, TRIAL_LIMIT - TRIAL_EXPORTS_USED);
  if(TRIAL_EXPORTS_USED === 0) return; // don't show before first export
  const bar = document.createElement('div');
  bar.id = 'trial-bar';
  bar.className = 'trial-bar no-print';
  bar.innerHTML = `
    <div class="trial-bar-icon">⏳</div>
    <div class="trial-bar-text">
      <strong>${remaining} free export${remaining!==1?'s':''} remaining</strong> — upgrade to Pro for unlimited access
    </div>
    <div class="trial-bar-count">${TRIAL_EXPORTS_USED}/${TRIAL_LIMIT}</div>
    <button onclick="openPricing()" style="background:var(--sl-yellow);color:#1D1C1D;border:none;border-radius:4px;padding:5px 12px;font-weight:900;cursor:pointer;font-family:var(--sans);font-size:11px;white-space:nowrap">⭐ Upgrade</button>`;
  const results = document.getElementById('results');
  if(results && results.firstChild) results.insertBefore(bar, results.firstChild);
}

