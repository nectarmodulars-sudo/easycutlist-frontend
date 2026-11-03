/* meta-pixel.js — Meta (Facebook) Pixel for easycutlist.com.
   Pixel ID is set in local Admin → Fonts → "Meta Pixel ID" and served through
   GET /asm/ui-settings (settings.metaPixelId). Empty → pixel never loads.

   The ID is cached in localStorage so returning visitors fire PageView at once,
   even while the API is still waking up. First-time visitors wait for the API.

   Events sent:
     PageView              every page load
     CompleteRegistration  first Google sign-in of a NEW account (created < 15 min ago)
     Contact               WhatsApp support chip clicked
     Purchase              Razorpay payment verified (value + currency)
   Other modules call ECLPixel.track(name, params) — safe even when no pixel is set. */
(function () {
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001' : 'https://api.easycutlist.com';
  var KEY = 'ecl_meta_pixel';
  var queue = [], ready = false, loadedId = null;

  function valid(id) { return /^[0-9]{10,20}$/.test(String(id || '')); }

  function load(id) {
    if (loadedId || !valid(id)) return;
    loadedId = id;
    /* Meta's standard base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
    ready = true;
    queue.forEach(function (q) { window.fbq('track', q[0], q[1] || {}); });
    queue = [];
  }

  function track(name, params) {
    if (ready && window.fbq) window.fbq('track', name, params || {});
    else queue.push([name, params]);
  }

  // Called from app-auth.js on SIGNED_IN. Fires once per account, only if new.
  function signedIn(user) {
    if (!user || !user.id) return;
    var flag = 'ecl_px_reg_' + user.id;
    try { if (localStorage.getItem(flag)) return; } catch (e) {}
    var created = Date.parse(user.created_at || '');
    if (created && (Date.now() - created) < 15 * 60 * 1000) {
      track('CompleteRegistration', { method: 'google' });
    }
    try { localStorage.setItem(flag, '1'); } catch (e) {}
  }

  window.ECLPixel = { track: track, signedIn: signedIn };

  // 1) cached ID → fire now
  var cached = null;
  try { cached = localStorage.getItem(KEY); } catch (e) {}
  if (valid(cached)) load(cached);

  // 2) live ID from settings → load, or update / clear the cache
  fetch(API + '/asm/ui-settings').then(function (r) { return r.json(); }).then(function (j) {
    var id = String(((j && j.settings) || {}).metaPixelId || '').trim();
    try { if (valid(id)) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch (e) {}
    if (valid(id)) load(id);   // no-op if already loaded
  }).catch(function () {});
})();
