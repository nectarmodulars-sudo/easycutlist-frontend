// ══ OPTIMIZER PROJECTS — CLOUD SYNC ══
// Signed-in users: projects live in Supabase (API /opt/projects) and follow the
// user to any browser. localStorage is only a cache + offline queue.
// Anonymous users: unchanged, localStorage only.
// Loaded after app-engine.js (needs API_URL, authHeader, projectsKey, projects).

(function(){
  function uid(){ return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.id) || null; }
  function pendKey(){ return 'ecl_opt_pending_' + uid(); }        // { up:[ids], del:[ids] }
  function migKey(){  return 'ecl_opt_migrated_' + uid(); }
  function readJ(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } }
  function writeJ(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function getPend(){ const p = readJ(pendKey(), {}); return { up: p.up || [], del: p.del || [] }; }
  function setPend(p){ writeJ(pendKey(), p); }
  function cacheLocal(){ writeJ(projectsKey(), projects); }
  function hdrs(){ return Object.assign({ 'Content-Type': 'application/json' }, authHeader()); }

  async function putRemote(p){
    const r = await fetch(API_URL + '/opt/projects/' + p.id, {
      method: 'PUT', headers: hdrs(), body: JSON.stringify({ project: p })
    });
    if(!r.ok) throw new Error('save ' + r.status);
  }
  async function delRemote(id){
    const r = await fetch(API_URL + '/opt/projects/' + id, { method: 'DELETE', headers: authHeader() });
    if(!r.ok && r.status !== 404) throw new Error('delete ' + r.status);
  }

  // Push queued changes. Each id leaves the queue only after the server confirms.
  async function flush(){
    if(!uid()) return;
    const pend = getPend();
    for(const id of pend.del.slice()){
      try{ await delRemote(id); const q = getPend(); q.del = q.del.filter(x => x !== id); setPend(q); }
      catch(e){ console.warn('[opt-sync] delete queued', id, e.message); }
    }
    for(const id of pend.up.slice()){
      const p = projects.find(x => x.id === id);
      const q0 = getPend();
      if(!p){ q0.up = q0.up.filter(x => x !== id); setPend(q0); continue; }
      try{ await putRemote(p); const q = getPend(); q.up = q.up.filter(x => x !== id); setPend(q); }
      catch(e){ console.warn('[opt-sync] save queued', id, e.message); }
    }
  }

  // Call after any change to one project (new, edited, duplicated).
  window.persistProject = function(p){
    cacheLocal();
    if(!uid() || !p) return;
    const q = getPend();
    if(!q.up.includes(p.id)) q.up.push(p.id);
    q.del = q.del.filter(x => x !== p.id);
    setPend(q);
    flush();
  };

  // Call after a project is removed from `projects`.
  window.removeProjectRemote = function(id){
    cacheLocal();
    if(!uid()) return;
    const q = getPend();
    q.up = q.up.filter(x => x !== id);
    if(!q.del.includes(id)) q.del.push(id);
    setPend(q);
    flush();
  };

  let syncing = null;
  // Pull the server list and make it the source of truth.
  window.syncProjectsFromServer = function(){
    if(!uid()) return Promise.resolve();
    if(syncing) return syncing;
    const userAtStart = uid();
    syncing = (async () => {
      try{
        // First sync in this browser: upload projects saved before cloud sync existed.
        if(!localStorage.getItem(migKey())){
          const local = readJ(projectsKey(), []);
          const q = getPend();
          local.forEach(p => { if(p && p.id && !q.up.includes(p.id)) q.up.push(p.id); });
          setPend(q);
          projects = local;
          await flush();
          if(getPend().up.length === 0) localStorage.setItem(migKey(), '1');
        } else {
          await flush();
        }

        const r = await fetch(API_URL + '/opt/projects', { headers: authHeader() });
        if(!r.ok) throw new Error('list ' + r.status);
        const j = await r.json();
        if(uid() !== userAtStart) return;          // user switched mid-sync
        let list = Array.isArray(j.projects) ? j.projects : [];

        // Keep local changes the server hasn't confirmed yet.
        const pend = getPend();
        list = list.filter(p => !pend.del.includes(p.id));
        pend.up.forEach(id => {
          const lp = projects.find(x => x.id === id);
          if(!lp) return;
          const i = list.findIndex(x => x.id === id);
          if(i >= 0) list[i] = lp; else list.push(lp);
        });
        list.sort((a, b) => b.id - a.id);          // ids are Date.now(): newest first

        projects = list;
        cacheLocal();
        const modal = document.getElementById('projects-modal');
        if(modal && modal.style.display !== 'none' && typeof renderProjectsList === 'function') renderProjectsList();
      }catch(e){
        console.warn('[opt-sync] using cached projects:', e.message);
      }finally{
        syncing = null;
      }
    })();
    return syncing;
  };

  window.addEventListener('online', () => { if(uid()) flush(); });
})();
