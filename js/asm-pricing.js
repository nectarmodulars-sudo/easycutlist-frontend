/* asm-pricing.js — the ASM Pro pricing modal, coupons and Razorpay checkout.
   Load BEFORE app-asm.js:

       <script src="js/asm-pricing.js"></script>

   Split out of app-asm.js. checkASMPlan() stays in the core, because the plan
   it resolves is read all over the catalogue rendering; this file only sells
   the upgrade and tells the core to re-check once a payment clears.

       ASMPricing.init({ apiBase, getToken, showToast, onActivated });
       ASMPricing.show();          // the pricing modal
       ASMPricing.pay(planId);     // called from the modal's buttons

   The unused promptCoupon() dialog from the old file is not carried over — the
   coupon field inside the modal replaced it. */

(function () {
  'use strict';

  var ctx = {
    apiBase: function () { return ''; },
    getToken: function () { return null; },
    showToast: function () {},
    onActivated: function () {}
  };

  var coupon = '';      // the code the user applied, sent with create-order

  function init(c) { if (c) Object.assign(ctx, c); }

  function resetPlanPrices(box) {
    box.querySelectorAll('.asm-plan-price').forEach(function (el) {
      el.innerHTML = '₹' + Number(el.getAttribute('data-base')).toLocaleString();
    });
  }

  async function show() {
    var token = ctx.getToken();
    if (!token) { ctx.showToast('Please login first', 'error'); return; }
    coupon = '';

    var plans = [];
    try {
      var res = await fetch(ctx.apiBase() + '/asm/payments/plans');
      var data = await res.json();
      if (data.success) plans = data.plans;
    } catch (e) {
      ctx.showToast('Could not load pricing', 'error');
      return;
    }

    var modal = document.getElementById('asm-pricing-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'asm-pricing-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1A1D21;border:1px solid #3A3D42;border-radius:16px;width:580px;overflow:hidden';

    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:24px 28px 16px;text-align:center';
    hdr.innerHTML = '<h2 style="margin:0 0 6px;color:#ECB22E;font-size:20px">Upgrade to ASM Pro</h2>' +
      '<p style="margin:0;color:#7A7D82;font-size:12px">Unlock all furniture items, unlimited projects, PDF export</p>';
    box.appendChild(hdr);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:flex;gap:12px;padding:0 28px 24px;justify-content:center';

    plans.forEach(function (p) {
      var isPopular = p.months === 12;
      var perMonth = Math.round(p.price / p.months);
      var card = document.createElement('div');
      card.style.cssText = 'flex:1;background:#222529;border:2px solid ' + (isPopular ? '#ECB22E' : '#3A3D42') +
        ';border-radius:12px;padding:20px 16px;text-align:center;cursor:pointer;transition:all .2s;position:relative';
      card.onmouseover = function () { card.style.borderColor = '#ECB22E'; card.style.transform = 'translateY(-2px)'; };
      card.onmouseout = function () { card.style.borderColor = isPopular ? '#ECB22E' : '#3A3D42'; card.style.transform = ''; };

      var inner = '';
      if (isPopular) inner += '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#ECB22E;color:#1A1D21;font-size:9px;font-weight:800;padding:2px 10px;border-radius:10px">BEST VALUE</div>';
      inner += '<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px">' + p.label + '</div>';
      inner += '<div class="asm-plan-price" data-base="' + p.price + '" style="font-size:28px;font-weight:900;color:#ECB22E;margin:10px 0">₹' + p.price.toLocaleString() + '</div>';
      inner += '<div style="font-size:11px;color:#7A7D82;margin-bottom:16px">₹' + perMonth.toLocaleString() + '/month</div>';
      inner += '<button class="asm-btn asm-btn-primary" style="width:100%;padding:10px" onclick="ASMPricing.pay(\'' + p.id + '\')">Choose Plan</button>';

      card.innerHTML = inner;
      grid.appendChild(card);
    });

    box.appendChild(grid);

    var couponWrap = document.createElement('div');
    couponWrap.style.cssText = 'padding:0 28px 16px';
    couponWrap.innerHTML =
      '<div style="display:flex;gap:8px;max-width:340px;margin:0 auto">' +
        '<input id="asm-coupon-field" type="text" placeholder="Coupon code (optional)" style="flex:1;text-transform:uppercase;background:#222529;border:1px solid #3A3D42;color:#fff;border-radius:6px;padding:9px;font-size:13px">' +
        '<button id="asm-coupon-apply" class="asm-btn asm-btn-ghost" style="white-space:nowrap">Apply</button>' +
      '</div>' +
      '<div id="asm-coupon-msg" style="text-align:center;font-size:12px;margin-top:8px;min-height:15px"></div>';
    box.appendChild(couponWrap);

    var features = document.createElement('div');
    features.style.cssText = 'padding:0 28px 20px;font-size:11px;color:#7A7D82;text-align:center';
    features.innerHTML = 'Includes: All 93+ furniture items | Unlimited projects | Save to cloud | PDF export | Export to optimizer | Priority support';
    box.appendChild(features);

    // Apply re-prices every card, because a coupon can be restricted to some
    // plan ids and not others.
    var field = couponWrap.querySelector('#asm-coupon-field');
    var msg = couponWrap.querySelector('#asm-coupon-msg');
    couponWrap.querySelector('#asm-coupon-apply').onclick = async function () {
      var code = (field.value || '').trim().toUpperCase();
      if (!code) { coupon = ''; resetPlanPrices(box); msg.textContent = ''; return; }
      msg.textContent = 'Checking…'; msg.style.color = '#7A7D82';

      var anyValid = false, lastReason = '';
      var priceEls = box.querySelectorAll('.asm-plan-price');
      for (var i = 0; i < priceEls.length; i++) {
        var el = priceEls[i];
        var base = Number(el.getAttribute('data-base'));
        var btn = el.parentElement.querySelector('button[onclick*="ASMPricing.pay"]');
        var m = btn ? btn.getAttribute('onclick').match(/pay\('([^']+)'\)/) : null;
        var pid = m ? m[1] : null;
        try {
          var r = await fetch(ctx.apiBase() + '/asm/payments/validate-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ code: code, planId: pid, email: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.email) || '' })
          });
          var d = await r.json();
          if (d.valid) {
            anyValid = true;
            el.innerHTML = '<span style="text-decoration:line-through;color:#7A7D82;font-size:18px">₹' + base.toLocaleString() + '</span> ₹' + Math.round(d.finalPrice).toLocaleString();
          } else {
            lastReason = d.reason || 'Invalid coupon';
            el.innerHTML = '₹' + base.toLocaleString();
          }
        } catch (e) { lastReason = e.message; }
      }
      if (anyValid) { coupon = code; msg.textContent = '✓ Coupon applied'; msg.style.color = '#2EB67D'; }
      else { coupon = ''; msg.textContent = lastReason || 'Invalid coupon'; msg.style.color = '#E01E5A'; }
    };

    var closeDiv = document.createElement('div');
    closeDiv.style.cssText = 'padding:12px 28px;background:#222529;border-top:1px solid #3A3D42;text-align:center';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'asm-btn asm-btn-ghost';
    closeBtn.textContent = 'Maybe Later';
    closeBtn.onclick = function () { modal.remove(); };
    closeDiv.appendChild(closeBtn);
    box.appendChild(closeDiv);

    modal.appendChild(box);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function pay(planId) {
    var token = ctx.getToken();
    if (!token) { ctx.showToast('Please login first', 'error'); return; }

    var userId = '', email = '';
    try {
      if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
        userId = CURRENT_USER.id;
        email = CURRENT_USER.email || '';
      }
    } catch (e) {}

    if (!userId) {
      try {
        if (typeof supa !== 'undefined' && supa) {
          var u = await supa.auth.getUser(token);
          if (u && u.data && u.data.user) { userId = u.data.user.id; email = u.data.user.email || ''; }
        }
      } catch (e) {}
    }
    if (!userId) { ctx.showToast('Could not identify user', 'error'); return; }

    try {
      var res = await fetch(ctx.apiBase() + '/asm/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ planId: planId, userId: userId, email: email, coupon: coupon || '' })
      });
      var order = await res.json();
      if (!order.orderId) { ctx.showToast(order.error || 'Could not create order', 'error'); return; }

      var pricingModal = document.getElementById('asm-pricing-modal');
      if (pricingModal) pricingModal.remove();

      var options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'EasyCutList',
        description: 'ASM Pro - ' + order.planLabel,
        order_id: order.orderId,
        handler: async function (response) {
          try {
            var verifyRes = await fetch(ctx.apiBase() + '/asm/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: userId, planId: planId
              })
            });
            var result = await verifyRes.json();
            if (result.ok) {
              ctx.showToast('ASM Pro activated! Expires: ' + new Date(result.expiresAt).toLocaleDateString(), 'success');
              ctx.onActivated();          // core re-reads the plan and repaints
            } else {
              ctx.showToast('Payment verification failed', 'error');
            }
          } catch (e) { ctx.showToast('Verification error', 'error'); }
        },
        prefill: { email: email },
        theme: { color: '#4A154B' }
      };

      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function () { ctx.showToast('Payment failed', 'error'); });
      rzp.open();
    } catch (err) {
      ctx.showToast('Payment error: ' + err.message, 'error');
    }
  }

  window.ASMPricing = { init: init, show: show, pay: pay };
})();