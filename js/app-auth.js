// ══ AUTH (Supabase) ══
const SUPABASE_URL_FE  = 'https://reklrjwsvgtrliksodwu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nRwWXeWmRPKs6WqjPBm57w_MjfCP4zw';

const supa = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL_FE, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
  : null;

let CURRENT_SESSION = null;
let CURRENT_USER    = null;

async function refreshAuthUI(){
  if(!supa) return;
  const { data: { session } } = await supa.auth.getSession();
  CURRENT_SESSION = session;
  CURRENT_USER    = session?.user || null;

  const signinBtn  = document.getElementById('hdr-signin-btn');
  const userChip   = document.getElementById('hdr-user');
  const signoutBtn = document.getElementById('hdr-signout-btn');
  const profileBtn = document.getElementById('hdr-profile-btn');
  const emailEl    = document.getElementById('hdr-user-email');

  if(session){
    if(signinBtn)  signinBtn.style.display  = 'none';
    if(userChip)   userChip.style.display   = 'flex';
    if(signoutBtn) signoutBtn.style.display = '';
    if(profileBtn) profileBtn.style.display = '';
    if(emailEl)    emailEl.textContent      = session.user.email || '';
    const mobSignin  = document.getElementById('mob-signin-btn');
    const mobSignout = document.getElementById('mob-signout-btn');
    if(mobSignin)  mobSignin.style.display  = 'none';
    if(mobSignout) mobSignout.style.display = '';
  } else {
    if(signinBtn)  signinBtn.style.display  = '';
    if(userChip)   userChip.style.display   = 'none';
    if(signoutBtn) signoutBtn.style.display = 'none';
    if(profileBtn) profileBtn.style.display = 'none';
    const mobSignin  = document.getElementById('mob-signin-btn');
    const mobSignout = document.getElementById('mob-signout-btn');
    if(mobSignin)  mobSignin.style.display  = '';
    if(mobSignout) mobSignout.style.display = 'none';
  }
  if(typeof updateUpgradeBtn==='function') updateUpgradeBtn();
}

async function signInGoogle(){
  if(!supa){ alert('Sign-in is loading, please wait a moment and try again.'); return; }
  const { error } = await supa.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: window.location.origin }
  });
  if(error) alert('Sign-in failed: ' + error.message);
}

async function signOut(){
  if(!supa) return;
  await supa.auth.signOut();
  CURRENT_SESSION = null;
  CURRENT_USER    = null;
  PLAN = 'free';
  localStorage.removeItem('ecl_plan');
  refreshAuthUI();
  const planEl = document.getElementById('hdr-user-plan');
  if(planEl) planEl.textContent = 'FREE';
}

function authHeader(){
  return CURRENT_SESSION?.access_token
    ? { 'Authorization': 'Bearer ' + CURRENT_SESSION.access_token }
    : {};
}

// Per-user project storage key. Anonymous users share the legacy 'ecl_projects' key.
// Signed-in users get their own scoped key so their projects stay private.
function projectsKey(){
  return CURRENT_USER?.id
    ? 'ecl_projects_' + CURRENT_USER.id
    : 'ecl_projects';
}

// Reload the projects array from the storage key matching the current user.
// Re-renders the projects modal if it's currently open.
function reloadProjects(){
  if(typeof projects === 'undefined') return;
  projects = JSON.parse(localStorage.getItem(projectsKey()) || '[]');
  const modal = document.getElementById('projects-modal');
  if(modal && modal.style.display !== 'none' && typeof renderProjectsList === 'function'){
    renderProjectsList();
  }
}

if(supa){
  supa.auth.onAuthStateChange((event, session) => {
    CURRENT_SESSION = session;
    CURRENT_USER    = session?.user || null;
    refreshAuthUI();
    reloadProjects();
    if(event === 'SIGNED_IN' && typeof fetchPlanAndFlags === 'function') fetchPlanAndFlags();
  });
}

// Default badge size for screen rendering
window._printBadgeSize = 10;

// ══ STATE ══
let panelRows=[],stockRows=[],idC=0,csvTarget='panels';
let profile = JSON.parse(localStorage.getItem('ecl_profile')||'{}');
let projects = JSON.parse(localStorage.getItem(projectsKey())||'[]');
function getCurrency(){ return profile.currency||'₹'; }
const COLORS=['#4fffb0','#00d4ff','#ffb830','#ff6b9d','#a78bfa','#34d399','#fb923c','#60a5fa','#f472b6','#fbbf24','#4ade80','#c084fc','#38bdf8','#f87171','#a3e635','#e879f9','#22d3ee','#84cc16','#f97316','#818cf8'];
const PRINT_FILLS=['#d4f5e9','#cce8f5','#fdf0d0','#fad5e0','#e8e0fa','#d0f0e8','#fde5cc','#d0e6fa','#fad0e8','#fef3c7','#d0fadc','#ede0fa','#ccf0fa','#fad0d0','#edfacc','#fad5f5','#ccfaf5','#e5facc','#fde0cc','#dde0fa'];
const PRINT_STROKES=['#1a7a4a','#1260a0','#a05c00','#c0004a','#6040b0','#0a6040','#b05010','#1050a0','#900060','#a07800','#1a6030','#7040a0','#006080','#c03030','#506010','#900080','#006060','#407010','#a04010','#404090'];
const DEFAULT_MATS=['Plywood','MDF','Melamine','Chipboard','Solid Wood','OSB','HDF','Acrylic','Aluminium','Other'];
function uid(){return ++idC}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function allMats(){const s=new Set(DEFAULT_MATS);[...panelRows,...stockRows].forEach(r=>r.material&&s.add(r.material));return[...s]}
function matSel(val,cb,listId){
  const mats=allMats();
  return`<input type="text" value="${esc(val)}" list="${listId}" onchange="${cb}" autocomplete="off" style="font-size:11px;padding:4px 5px;width:100%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:4px;color:#fff;font-family:var(--mono)"><datalist id="${listId}">${mats.map(m=>`<option value="${esc(m)}">`).join('')}</datalist>`;
}

