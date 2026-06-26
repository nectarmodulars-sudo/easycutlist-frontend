// ══ PREMIUM / PLAN SYSTEM ══
// Plan fetched from API on load. Falls back to 'free' if API unavailable.
let PLAN = localStorage.getItem('ecl_plan') || 'free';
let FEATURE_FLAGS = JSON.parse(localStorage.getItem('ecl_flags')||'{}');

// Fetch plan + flags from server (non-blocking)
async function fetchPlanAndFlags(){
  try {
    const [planRes, flagsRes] = await Promise.all([
      fetch(`${API_URL}/my-plan`, { headers: authHeader() }),
      fetch(`${API_URL}/flags`)
    ]);
    if(planRes.ok){
      const data = await planRes.json();
      const {plan, trialExportsUsed, planExpiresAt, trialLimit} = data;
      PLAN = plan;
      TRIAL_EXPORTS_USED = trialExportsUsed || 0;
      PLAN_EXPIRES_AT    = planExpiresAt || null;
      TRIAL_LIMIT        = trialLimit || 3;
      localStorage.setItem('ecl_plan', plan);
      const planEl = document.getElementById('hdr-user-plan');
      if(planEl) planEl.textContent = (plan||'free').toUpperCase();
      // Show UPGRADE button only for free users who are signed in
      const upgradeBtn = document.getElementById('hdr-upgrade-btn');
      if(upgradeBtn) upgradeBtn.style.display = (plan === 'pro') ? 'none' : '';
    }
    updateUpgradeBtn();
    if(flagsRes.ok){
      FEATURE_FLAGS = await flagsRes.json();
      localStorage.setItem('ecl_flags', JSON.stringify(FEATURE_FLAGS));
    }
  } catch(e){ /* use cached values */ }
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

function isPro(){ return PLAN === 'pro'; }

// Returns true if the feature is currently accessible:
// either the user is Pro, OR the admin has set this flag to "free".
function hasFeature(flagKey){
  if(isPro()) return true;
  // Also check the feature flags from the server
  const flag = FEATURE_FLAGS && FEATURE_FLAGS[flagKey];
  return flag === 'free' || flag === true;
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
  if(CURRENT_USER){
    openPricing(featureName);
  } else {
    document.getElementById('upgrade-title').textContent = '⭐ Upgrade to Pro';
    document.getElementById('upgrade-sub').textContent =
      featureName
        ? `"${featureName}" is a Pro feature. Sign in to upgrade.`
        : 'Sign in to upgrade to EasyCutList Pro.';
    document.getElementById('upgrade-modal').style.display='flex';
  }
}
function closeUpgrade(){ document.getElementById('upgrade-modal').style.display='none'; }
function goUpgrade(){
  closeUpgrade();
  openPricing();
}

// ══ PRICING & PAYMENTS ══
let _selectedPlan = '6month';
let _pricingData  = null;
let TRIAL_EXPORTS_USED = 0;
let TRIAL_LIMIT = 3;
let PLAN_EXPIRES_AT = null;

async function openPricing(featureName=''){
  if(!CURRENT_USER){ signInGoogle(); return; }
  const sub = document.getElementById('pricing-sub');
  if(featureName && sub) sub.textContent = `"${featureName}" is a Pro feature. Upgrade to unlock it and much more.`;
  else if(sub) sub.textContent = 'Unlock all features. Pay once per period, cancel anytime.';
  document.getElementById('pricing-modal').style.display = 'flex';
  await loadPricing();
}

function closePricing(){
  document.getElementById('pricing-modal').style.display = 'none';
}

async function loadPricing(){
  try {
    const res = await fetch(`${API_URL}/payments/pricing`);
    if(!res.ok) return;
    _pricingData = await res.json();
    // Update price display
    const fmt = v => '₹' + Math.round(v/100).toLocaleString('en-IN');
    if(_pricingData['3month']) document.getElementById('price-3month').innerHTML = fmt(_pricingData['3month'].amountPaise) + '<span>/3mo</span>';
    if(_pricingData['6month']) document.getElementById('price-6month').innerHTML = fmt(_pricingData['6month'].amountPaise) + '<span>/6mo</span>';
    if(_pricingData['1year'])  document.getElementById('price-1year').innerHTML  = fmt(_pricingData['1year'].amountPaise)  + '<span>/yr</span>';
    // Calculate savings vs 3-month rate
    if(_pricingData['3month'] && _pricingData['6month']){
      const base6  = _pricingData['3month'].amountPaise * 2;
      const actual6 = _pricingData['6month'].amountPaise;
      if(base6 > actual6){
        const pct = Math.round((base6-actual6)/base6*100);
        const saveEl = document.getElementById('save-6month');
        if(saveEl) saveEl.textContent = `Save ${pct}%`;
      }
    }
    if(_pricingData['3month'] && _pricingData['1year']){
      const base12   = _pricingData['3month'].amountPaise * 4;
      const actual12 = _pricingData['1year'].amountPaise;
      if(base12 > actual12){
        const pct = Math.round((base12-actual12)/base12*100);
        const saveEl = document.getElementById('save-1year');
        if(saveEl) saveEl.textContent = `Save ${pct}%`;
      }
    }
  } catch(e){ console.error('loadPricing:', e); }
}

function selectPlan(planId){
  _selectedPlan = planId;
  ['3month','6month','1year'].forEach(id => {
    const el = document.getElementById('plan-'+id);
    if(el) el.className = 'plan-card' + (id===planId?' selected':'');
  });
}

async function startPayment(){
  if(!CURRENT_USER){ signInGoogle(); return; }
  const btn = document.getElementById('pricing-pay-btn');
  if(btn){ btn.disabled=true; btn.textContent='Creating order...'; }

  try {
    const res = await fetch(`${API_URL}/payments/create-order`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...authHeader()},
      body: JSON.stringify({
        planId:  _selectedPlan,
        userId:  CURRENT_USER.id,
        email:   CURRENT_USER.email,
      })
    });
    const order = await res.json();
    if(!res.ok) throw new Error(order.error || 'Failed to create order');

    // Launch Razorpay checkout
    const rzp = new Razorpay({
      key:         order.keyId,
      amount:      order.amount,
      currency:    order.currency,
      order_id:    order.orderId,
      name:        'EasyCutList Pro',
      description: _pricingData?.[_selectedPlan]?.label || 'Pro Plan',
      prefill:     { email: CURRENT_USER.email || '' },
      theme:       { color: '#3F0E40' },
      handler: async function(response){
        await verifyPayment(response, order.orderId);
      },
      modal: {
        ondismiss: function(){
          if(btn){ btn.disabled=false; btn.textContent='🚀 Pay & Upgrade Now'; }
        }
      }
    });
    rzp.open();
  } catch(e){
    alert('Error: ' + e.message);
    if(btn){ btn.disabled=false; btn.textContent='🚀 Pay & Upgrade Now'; }
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
        planId:  _selectedPlan,
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

