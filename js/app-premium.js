// ══ PREMIUM / PLAN SYSTEM ══
// Plan fetched from API on load. Falls back to 'free' if API unavailable.
let PLAN = localStorage.getItem('ecl_plan') || 'free';
let FEATURE_FLAGS = JSON.parse(localStorage.getItem('ecl_flags')||'{}');
// Feature-set granted by the user's current plan (flag_key -> true).
// Empty for free users. Populated from /my-plan.
let PLAN_FEATURES = JSON.parse(localStorage.getItem('ecl_plan_features')||'{}');

// Fetch /my-plan with retries. Returns server data, or null if every try failed.
// A signed-in user getting an anonymous answer (token not ready / expired)
// refreshes the session and retries instead of accepting 'free'.
let _planReqSeq = 0;
async function fetchMyPlan(){
  for(let attempt = 0; attempt < 4; attempt++){
    try {
      const res = await fetch(`${API_URL}/my-plan`, { headers: authHeader(), cache: 'no-store' });
      if(!res.ok) throw new Error('my-plan ' + res.status);
      const data = await res.json();
      if(CURRENT_SESSION && data.loggedIn === false){
        if(supa){
          const { data: r } = await supa.auth.refreshSession();
          if(r && r.session){ CURRENT_SESSION = r.session; CURRENT_USER = r.session.user; }
        }
        throw new Error('anonymous answer for signed-in user');
      }
      return data;
    } catch(e){
      console.warn('[plan] attempt', attempt + 1, e.message);
      if(attempt < 3) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

// Fetch plan + flags from server (non-blocking)
async function fetchPlanAndFlags(){
  const mySeq = ++_planReqSeq;
  try {
    const [data, flagsRes] = await Promise.all([
      fetchMyPlan(),
      fetch(`${API_URL}/flags`).catch(() => null)
    ]);
    if(mySeq !== _planReqSeq) return;   // a newer call is in charge; drop this stale answer
    if(data){
      const {plan, trialExportsUsed, planExpiresAt, trialLimit, features} = data;
      PLAN = plan;
      PLAN_TIER_ID = data.tierId || null;
      PLAN_VIA_ASM = !!data.viaAsm;
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
      // Optimizer-only users still see Upgrade (Cutlist Builder is the next step);
      // hide it once they have the full software.
      if(upgradeBtn) upgradeBtn.style.display = hasFullPlan() ? 'none' : '';
      const mobUpgrade = document.getElementById('mob-upgrade-btn');
      if(mobUpgrade) mobUpgrade.style.display = hasFullPlan() ? 'none' : '';
    }
    updateUpgradeBtn();
    if(flagsRes && flagsRes.ok){
      FEATURE_FLAGS = await flagsRes.json();
      localStorage.setItem('ecl_flags', JSON.stringify(FEATURE_FLAGS));
    }
  } catch(e){ /* use cached values */ }
  // Resume a pending buy if the user just logged in via the Buy button.
  try {
    if(CURRENT_USER){
      const pend = JSON.parse(localStorage.getItem('ecl_pending_buy')||'null');
      // Only honour a recent intent (10 min) to avoid stale reopens.
      if(pend && pend.asmPlanId && (Date.now() - (pend.t||0) < 600000)){
        localStorage.removeItem('ecl_pending_buy');
        setTimeout(()=>{ buyAsm(pend.asmPlanId); }, 400);
      } else if(pend && pend.tierId && (Date.now() - (pend.t||0) < 600000)){
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
  btn.style.display = hasFullPlan() ? 'none' : '';
}
// Full software = Cutlist Builder (ASM Pro), which brings the Optimizer tier with it
function hasFullPlan(){ return isPro() && PLAN_VIA_ASM; }

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
let PLAN_TIER_ID = null;      // Optimizer tier the user has (own or via ASM)
let PLAN_VIA_ASM = false;     // Optimizer tier comes with their Cutlist Builder plan
let _asmPlans  = [];          // [{id, months, price (₹), label}] from /asm/payments/plans
let _asmStatus = null;        // { active, expiresAt } for the signed-in user
let _asmCoupon = null;        // { code, finals: { planId: final ₹ } } after Apply
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
    // Optimizer tiers + Cutlist Builder (ASM) plans + the user's ASM status, together
    const [res, asmRes, stRes] = await Promise.all([
      fetch(`${API_URL}/tiers`),
      fetch(`${API_URL}/asm/payments/plans`).catch(() => null),
      CURRENT_USER ? fetch(`${API_URL}/asm/payments/status`, { headers: authHeader() }).catch(() => null) : null,
    ]);
    if(!res.ok) return;
    _tierData = await res.json();
    try { const a = asmRes && asmRes.ok ? await asmRes.json() : null; _asmPlans = (a && a.plans) || []; } catch(e){ _asmPlans = []; }
    try { _asmStatus = stRes && stRes.ok ? await stRes.json() : null; } catch(e){ _asmStatus = null; }
    if(!_tierData.tiers || !_tierData.tiers.length) return;

    // Available durations (from pricing rows + ASM plans), ascending
    const months = [...new Set((_tierData.pricing||[]).map(p => p.months).concat(_asmPlans.map(p => p.months)))].sort((a,b)=>a-b);
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
  const months = [...new Set((_tierData.pricing||[]).map(p => p.months).concat(_asmPlans.map(p => p.months)))].sort((a,b)=>a-b);
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

  const per = _selectedMonths===12 ? 'yr' : _selectedMonths+'mo';
  const inr = n => '₹' + Number(n).toLocaleString('en-IN');
  const topTier = tiers[0] || {};

  // ── Cutlist Builder (ASM Pro): the full software, shown first ──
  const ap = _asmPlans.find(p => Number(p.months) === _selectedMonths);
  const asmOn = !!(_asmStatus && _asmStatus.active);
  let asmCard = '';
  if(_asmPlans.length){
    const asmFeats = ['90+ ready furniture items','Auto cutlist from sizes','3D view + elevations','Quotation and PDF','Saved settings, projects','Sends cutlist to Optimizer',
      'Optimizer ' + esc(topTier.name || 'Pro Max') + ' included'];
    const fin = ap && _asmCoupon && _asmCoupon.finals[ap.id] != null ? _asmCoupon.finals[ap.id] : null;
    const priceHtml = !ap ? '<span style="font-size:13px;color:var(--sl-text2)">Not available</span>'
      : fin != null ? `<s>${inr(ap.price)}</s>${inr(Math.round(fin))}<span>/${per}</span>`
      : `${inr(ap.price)}<span>/${per}</span>`;
    const perMonth = ap && ap.months ? `<div class="tier-sub">≈ ${inr(Math.round((fin != null ? fin : ap.price) / ap.months))}/month${fin != null ? ' · <b style="color:#2EB67D">' + esc(_asmCoupon.code) + '</b>' : ''}</div>` : '';
    const btn = asmOn
      ? `<button class="tier-buy" disabled>✓ Active${_asmStatus.expiresAt ? ' till ' + new Date(_asmStatus.expiresAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : ''}</button>`
      : `<button class="tier-buy"${ap ? '' : ' disabled'} onclick="event.stopPropagation();buyAsm('${ap ? esc(ap.id) : ''}')">Buy Cutlist Builder</button>`;
    asmCard = `<div class="tier-col tier-asm">
      <div class="tier-badge">Full software</div>
      <div class="tier-kicker">CUTLIST BUILDER</div>
      <div class="tier-name">ASM Pro</div>
      <div class="tier-price">${priceHtml}</div>${perMonth}
      <div class="tier-feats">${asmFeats.map(f => `<div class="tier-feat on">✓ ${f}</div>`).join('')}</div>
      ${btn}
    </div>`;
  }

  wrap.innerHTML = asmCard + tiers.map(t => {
    const price = priceFor(t.tier_id, _selectedMonths);
    const feats = t.features || {};
    const sel = (t.tier_id === _selectedTier) ? ' selected' : '';
    const badge = t.badge ? `<div class="tier-badge">${esc(t.badge)}</div>` : '';
    const priceHtml = price != null
      ? `₹${price.toLocaleString('en-IN')}<span>/${_selectedMonths===12?'yr':_selectedMonths+'mo'}</span>`
      : '<span style="font-size:13px;color:var(--sl-text2)">Not available</span>';
    const mine = PLAN === 'pro' && PLAN_TIER_ID === t.tier_id;
    // with Cutlist Builder, lower Optimizer tiers are already covered
    const myTier = tiers.find(x => x.tier_id === PLAN_TIER_ID);
    const covered = !mine && PLAN === 'pro' && PLAN_VIA_ASM && myTier && (Number(t.rank)||0) <= (Number(myTier.rank)||0);
    const featRows = TIER_FEATURE_LIST.map(f => {
      const on = feats[f[0]] === true;
      return `<div class="tier-feat ${on?'on':'off'}">${on?'✓':'✗'} ${f[1]}</div>`;
    }).join('');
    const disabled = price == null ? ' disabled' : '';
    const buyBtn = mine
      ? `<button class="tier-buy" disabled>${PLAN_VIA_ASM ? '✓ Included with Cutlist Builder' : '✓ Your plan'}</button>`
      : covered ? `<button class="tier-buy tier-buy-alt" disabled>Covered by your plan</button>`
      : `<button class="tier-buy tier-buy-alt"${disabled} onclick="event.stopPropagation();selectTier('${t.tier_id}');startPayment()">Buy ${esc(t.name)}</button>`;
    return `<div class="tier-col${sel}" id="tier-${t.tier_id}" onclick="selectTier('${t.tier_id}')">
      ${badge}
      <div class="tier-kicker">OPTIMIZER ONLY</div>
      <div class="tier-name">${esc(t.name)}</div>
      ${t.subtitle?`<div class="tier-sub">${esc(t.subtitle)}</div>`:''}
      <div class="tier-price">${priceHtml}</div>
      <div class="tier-feats">${featRows}</div>
      ${buyBtn}
    </div>`;
  }).join('');
  const note = document.getElementById('pricing-note');
  if(note) note.style.display = asmCard ? '' : 'none';
}

function selectTier(tierId){
  _selectedTier = tierId;
  document.querySelectorAll('#pricing-tiers .tier-col').forEach(el => {
    el.classList.toggle('selected', el.id === 'tier-'+tierId);
  });
}

// Cutlist Builder (ASM Pro) purchase from the shared pricing popup
function buyAsm(planId){
  if(!planId) return;
  if(!CURRENT_USER){
    try { localStorage.setItem('ecl_pending_buy', JSON.stringify({ asmPlanId: planId, t: Date.now() })); } catch(e){}
    signInGoogle();
    return;
  }
  closePricing();
  // a coupon applied in this popup goes with the order (re-checked on the server)
  if(window.ASMPricing && ASMPricing.setCoupon) ASMPricing.setCoupon(_asmCoupon && _asmCoupon.finals[planId] != null ? _asmCoupon.code : '');
  if(typeof ASMModule !== 'undefined' && ASMModule.startASMPayment) ASMModule.startASMPayment(planId);
}

// Coupon box in the Upgrade popup. Coupons are for Cutlist Builder plans:
// check the code against every ASM plan and re-price the card.
async function applyPricingCoupon(){
  const inp = document.getElementById('pricing-coupon-in');
  const msg = document.getElementById('pricing-coupon-msg');
  const code = (inp && inp.value || '').trim().toUpperCase();
  const say = (t, ok) => { if(msg){ msg.textContent = t; msg.style.color = ok === true ? '#2EB67D' : ok === false ? '#E01E5A' : 'var(--sl-text3)'; } };
  if(!code){ _asmCoupon = null; say(''); renderTierColumns(); return; }
  if(!_asmPlans.length){ say('Coupons apply to Cutlist Builder plans', false); return; }
  say('Checking…');
  const finals = {}; let reason = '';
  await Promise.all(_asmPlans.map(async p => {
    try {
      const r = await fetch(`${API_URL}/asm/payments/validate-coupon`, {
        method:'POST', headers: Object.assign({'Content-Type':'application/json'}, CURRENT_USER ? authHeader() : {}),
        body: JSON.stringify({ code, planId: p.id, email: (CURRENT_USER && CURRENT_USER.email) || '' })
      });
      const d = await r.json();
      if(d.valid) finals[p.id] = Number(d.finalPrice);
      else reason = d.reason || d.error || reason;
    } catch(e){ reason = reason || 'Could not check the coupon'; }
  }));
  if(Object.keys(finals).length){
    _asmCoupon = { code, finals };
    const cur = _asmPlans.find(p => Number(p.months) === _selectedMonths);
    say(cur && finals[cur.id] == null
      ? '✓ ' + code + ' applied — valid for ' + _asmPlans.filter(p => finals[p.id] != null).map(p => p.label || (p.months + ' months')).join(', ')
      : '✓ ' + code + ' applied to Cutlist Builder', true);
  } else { _asmCoupon = null; say(reason || 'Invalid coupon', false); }
  renderTierColumns();
}
// "Have a coupon?" — the ASM checkout popup has the coupon field
function openAsmCoupon(){
  if(!CURRENT_USER){ signInGoogle(); return; }
  closePricing();
  if(typeof ASMModule !== 'undefined' && ASMModule.showASMCheckout) ASMModule.showASMCheckout();
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
        await verifyPayment(response, order.orderId, order);
      },
    });
    rzp.open();
  } catch(e){
    alert('Error: ' + e.message);
  }
}

async function verifyPayment(response, orderId, order){
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
    if(window.ECLPixel) ECLPixel.track('Purchase', { value: ((order && order.amount) || 0) / 100, currency: (order && order.currency) || 'INR', content_name: 'Optimizer ' + _selectedTier + ' ' + _selectedMonths + 'm' });
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

