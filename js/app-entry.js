// ══ ENTRY INTENTS FROM THE LANDER (welcome.html) ══
//   /?app=1                          open the optimizer (no login needed)
//   /?login=1                        start Google sign-in
//   /?tab=asm                        open the Cutlist Builder (ASM)
//   /?buy=opt&tier=<id>&months=<n>   open optimizer pricing on that plan
//   /?buy=asm&plan=<id>              open ASM pricing (needs login)
// Sign-in leaves the page, so the intent is kept in localStorage and finished
// after Google returns the user here.
(function(){
  'use strict';
  var KEY = 'ecl_entry_intent';
  var q = new URLSearchParams(location.search);
  var fromUrl = {
    login: q.get('login') === '1',
    tab:   q.get('tab') || '',
    buy:   q.get('buy') || '',
    tier:  q.get('tier') || '',
    months: Number(q.get('months')) || 0,
    plan:  q.get('plan') || ''
  };
  var urlHasIntent = fromUrl.login || fromUrl.tab || fromUrl.buy;

  // Clean the address bar (keep ?code= for Supabase to finish sign-in).
  if (urlHasIntent && !q.get('code')) {
    ['app','login','tab','buy','tier','months','plan'].forEach(function(k){ q.delete(k); });
    var rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }

  function saved(){
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && Date.now() - (s.t || 0) < 10 * 60 * 1000) return s;
    } catch (e) {}
    return null;
  }
  function save(i){ try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, i, { login: false, t: Date.now() }))); } catch (e) {} }
  function clear(){ try { localStorage.removeItem(KEY); } catch (e) {} }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  async function session(){
    if (typeof supa === 'undefined' || !supa) return null;
    try { var r = await supa.auth.getSession(); return r.data.session; } catch (e) { return null; }
  }

  async function run(){
    var intent = urlHasIntent ? fromUrl : saved();
    if (!intent) return;
    var s = await session();
    var needsLogin = intent.login || intent.buy === 'asm';

    if (needsLogin && !s) {
      save(intent);                 // finished after Google sends the user back
      if (typeof signInGoogle === 'function') signInGoogle();
      return;
    }
    clear();

    var asm = (typeof ASMModule !== 'undefined') ? ASMModule : null;   // top-level const, not on window
    if ((intent.tab === 'asm' || intent.buy === 'asm') && asm && typeof asm.openASM === 'function') {
      await asm.openASM();
    }
    if (intent.buy === 'asm' && asm && typeof asm.showPricing === 'function') {
      await wait(300);
      asm.showPricing();            // inits ASMPricing with token + api base, then shows it
    }
    if (intent.buy === 'opt' && typeof openPricing === 'function') {
      if (intent.tier)   { try { _selectedTier = intent.tier; } catch (e) {} }
      if (intent.months) { try { _selectedMonths = intent.months; } catch (e) {} }
      openPricing();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(run, 300); });
  else setTimeout(run, 300);
})();
