// YesDocu 2.1.0 / WEB 1.0.8 — Mise en page: champs Date & Nom flex-compact (140–240px) sur une seule ligne.

let currentUser = null;
const PAGE_SIZE = 10;

const stateImp = {
  all: [], filtered: [], page: 1,
  sortKey: 'date', sortDir: 'desc',
  pagination: true,
  suggestions: new Set(),       // non utilisés (suggestions désactivées)
  dateSuggestions: new Set(),   // non utilisés (suggestions désactivées)
};

const selectedImp = new Set();

const tabs = {
  imp:  { tab: document.getElementById('tab-imp'),  sec: document.getElementById('sec-imp') },
  reimp:{ tab: document.getElementById('tab-reimp'),sec: document.getElementById('sec-reimp') },
  suivi:{ tab: document.getElementById('tab-suivi'), sec: document.getElementById('sec-suivi') },
  admin:{ tab: document.getElementById('tab-admin'), sec: document.getElementById('sec-admin') },
};
Object.values(tabs).forEach(t => t.tab.addEventListener('click', () => { setActiveTab(t); refreshActiveTab(); }));
function setActiveTab(t){ Object.values(tabs).forEach(x=>{x.tab.classList.remove('active');x.sec.classList.remove('active')}); t.tab.classList.add('active'); t.sec.classList.add('active'); }
function activeKey(){ return Object.entries(tabs).find(([k,v])=>v.tab.classList.contains('active'))?.[0]; }

async function refreshMe() {
  const r = await fetch('/auth/me');
  const { user, versions } = await r.json();
  currentUser = user;

  const who = document.getElementById('whoami');
  const logout = document.getElementById('btnLogout');
  const loginBtn = document.getElementById('btnLogin');
  const u = document.getElementById('loginUser');
  const p = document.getElementById('loginPass');

  if (user) {
    who.textContent = `Connecté : ${user.username} (${user.role}) • ${versions.web}`;
    logout.style.display = ''; loginBtn.style.display = 'none'; u.style.display = 'none'; p.style.display = 'none';
  } else {
    who.textContent = ''; logout.style.display = 'none'; loginBtn.style.display = ''; u.style.display = ''; p.style.display = '';
  }

  enforceTabsByRole(user?.role || null);
  await loadHotfolders();
  await refreshActiveTab();
}
document.getElementById('btnLogin').addEventListener('click', async () => {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const r = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
  if (!r.ok) { alert('Login invalide'); return; }
  await refreshMe();
});
document.getElementById('btnLogout').addEventListener('click', async () => { await fetch('/auth/logout', { method:'POST' }); location.reload(); });

function enforceTabsByRole(role){
  const show = { imp:false, reimp:false, suivi:false, admin:false };
  if (role === 'admin') show.imp=show.reimp=show.suivi=show.admin=true;
  else if (role === 'responsable') show.imp=show.reimp=show.suivi=true;
  else if (role === 'operateur') show.imp=show.suivi=true;
  else if (role === 'superviseur') show.suivi=true;

  Object.entries({imp:'tab-imp', reimp:'tab-reimp', suivi:'tab-suivi', admin:'tab-admin'}).forEach(([k,id])=>{
    const el=document.getElementById(id); el.style.display = show[k] ? '' : 'none';
  });
  Object.entries({imp:'sec-imp', reimp:'sec-reimp', suivi:'sec-suivi', admin:'sec-admin'}).forEach(([k,id])=>{
    const el=document.getElementById(id);
    if (!show[k]) el.classList.remove('active'), el.style.display='none'; else el.style.display='';
  });

  const key = activeKey();
  if (!key || !show[key]){
    if (show.imp) setActiveTab(tabs.imp);
    else if (show.suivi) setActiveTab(tabs.suivi);
    else if (show.reimp) setActiveTab(tabs.reimp);
    else setActiveTab(tabs.admin);
  }
}

// Utils
function fmtDate(d){ const date=new Date(d); const pad=n=>String(n).padStart(2,'0'); return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`; }
function norm(s){ return (s||'').toLowerCase(); }
function fmtKB(v){ return Math.round(Number(v||0)).toLocaleString('fr-FR'); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateTokensForRow(x){
  const iso = (x.updated_at || x.created_at || x.date || '').toString();
  let dt = new Date(iso);
  if (isNaN(dt.getTime())) dt = new Date();
  const pad = n => String(n).padStart(2,'0');
  const y = dt.getFullYear(), m = pad(dt.getMonth()+1), d = pad(dt.getDate());
  const H = pad(dt.getHours()), M = pad(dt.getMinutes()), S = pad(dt.getSeconds());
  const ddmmyyyy = `${d}/${m}/${y}`;
  const yyyymmdd = `${y}-${m}-${d}`;
  const hhmm = `${H}:${M}`;
  const full = `${ddmmyyyy} ${H}:${M}:${S}`;
  return { ddmmyyyy, yyyymmdd, hhmm, full, iso: iso };
}

// Hotfolders
let hotfolders = [];
async function loadHotfolders(){
  const r = await fetch('/hotfolders'); if (!r.ok) return;
  hotfolders = await r.json();
  fillHFSelect(document.getElementById('hfImpBatch'), true);
  const hfRe = document.getElementById('hfReimpBatch'); if (hfRe) fillHFSelect(hfRe, true);
}
function fillHFSelect(selectEl, withEmpty=true){
  if (!selectEl) return;
  selectEl.innerHTML='';
  if (withEmpty){ const op0=document.createElement('option'); op0.value=''; op0.textContent='(—)'; selectEl.appendChild(op0); }
  hotfolders.forEach(hf=>{ const op=document.createElement('option'); op.value=hf.name; op.textContent=hf.name; selectEl.appendChild(op); });
}

// Filtres Impressions
const impDocType = document.getElementById('impDocType');
const groupImpPrefix = document.getElementById('group-impPrefix');
function syncDocTypeUI(){ const v=impDocType?.value||'Liste'; groupImpPrefix.style.display = (v==='CEB') ? 'none' : ''; }
impDocType.addEventListener('change', ()=>{ syncDocTypeUI(); refreshImp(); }); syncDocTypeUI();

// NOM (tags, sans suggestions)
const impTagsWrap=document.getElementById('impTags');
const impNameInput=document.getElementById('impNameInput');
let impNameTags=[];
function renderNameTags(){
  impTagsWrap.innerHTML='';
  impNameTags.forEach((t,i)=>{
    const span=document.createElement('span'); span.className='tag';
    span.innerHTML = `${escapeHtml(t)} <button title="Supprimer">×</button>`;
    span.querySelector('button').addEventListener('click', ()=>{ impNameTags.splice(i,1); renderNameTags(); refreshImp(); });
    impTagsWrap.appendChild(span);
  });
}
impNameInput.addEventListener('keydown', (e)=>{
  if (e.key==='Enter'){
    e.preventDefault();
    const v = impNameInput.value.trim();
    if (v){
      const low=v.toLowerCase();
      if (!impNameTags.includes(low)) impNameTags.push(low);
      impNameInput.value=''; renderNameTags(); refreshImp();
    } else {
      document.getElementById('impSearch').click();
    }
  } else if (e.key==='Backspace' && !impNameInput.value && impNameTags.length>0){
    impNameTags.pop(); renderNameTags(); refreshImp();
  }
});
impNameInput.addEventListener('input', ()=>{/* suggestions désactivées */});

// DATE/HEURE (tags, sans suggestions)
const impDateTagsWrap=document.getElementById('impDateTags');
const impDateInput=document.getElementById('impDateInput');
let impDateTags=[];
function renderDateTags(){
  impDateTagsWrap.innerHTML='';
  impDateTags.forEach((t,i)=>{
    const span=document.createElement('span'); span.className='tag';
    span.innerHTML = `${escapeHtml(t)} <button title="Supprimer">×</button>`;
    span.querySelector('button').addEventListener('click', ()=>{ impDateTags.splice(i,1); renderDateTags(); refreshImp(); });
    impDateTagsWrap.appendChild(span);
  });
}
impDateInput.addEventListener('keydown', (e)=>{
  if (e.key==='Enter'){
    e.preventDefault();
    const v = impDateInput.value.trim();
    if (v){
      const low=v.toLowerCase();
      if (!impDateTags.includes(low)) impDateTags.push(low);
      impDateInput.value=''; renderDateTags(); refreshImp();
    } else {
      document.getElementById('impSearch').click();
    }
  } else if (e.key==='Backspace' && !impDateInput.value && impDateTags.length>0){
    impDateTags.pop(); renderDateTags(); refreshImp();
  }
});
impDateInput.addEventListener('input', ()=>{/* suggestions désactivées */});

// Entrée = Chercher (global filtres)
document.getElementById('filters-imp').addEventListener('keydown', (e)=>{
  if (e.key!=='Enter') return;
  if ((e.target===impNameInput && impNameInput.value.trim()) || (e.target===impDateInput && impDateInput.value.trim())) return;
  e.preventDefault(); document.getElementById('impSearch').click();
});

// Taille & Pages
const sizeOp=document.getElementById('impSizeOp'), sizeMin=document.getElementById('impSizeMin'), sizeMax=document.getElementById('impSizeMax'), sizeDash=document.getElementById('impSizeDash');
function refreshSizeInputs(){
  const op=sizeOp.value;
  if (op==='between'){ sizeMin.style.display=''; sizeDash.style.display=''; sizeMax.style.display=''; sizeMin.placeholder='min'; sizeMax.placeholder='max'; }
  else if (op==='ge'){ sizeMin.style.display=''; sizeMin.placeholder='≥ min'; sizeDash.style.display='none'; sizeMax.style.display='none'; sizeMax.value=''; }
  else if (op==='le'){ sizeMax.style.display=''; sizeMax.placeholder='≤ max'; sizeDash.style.display='none'; sizeMin.style.display='none'; sizeMin.value=''; }
  else { sizeMin.style.display=''; sizeMin.placeholder='min'; sizeDash.style.display='none'; sizeMax.style.display='none'; sizeMin.value=''; sizeMax.value=''; }
}
sizeOp.addEventListener('change', ()=>{ refreshSizeInputs(); refreshImp(); }); refreshSizeInputs();

const pagesOp=document.getElementById('impPagesOp'), pagesMin=document.getElementById('impPagesMin'), pagesMax=document.getElementById('impPagesMax'), pagesDash=document.getElementById('impPagesDash');
function refreshPagesInputs(){
  const op=pagesOp.value;
  if (op==='between'){ pagesMin.style.display=''; pagesDash.style.display=''; pagesMax.style.display=''; pagesMin.placeholder='min'; pagesMax.placeholder='max'; }
  else if (op==='ge'){ pagesMin.style.display=''; pagesMin.placeholder='≥ min'; pagesDash.style.display='none'; pagesMax.style.display='none'; pagesMax.value=''; }
  else if (op==='le'){ pagesMax.style.display=''; pagesMax.placeholder='≤ max'; pagesDash.style.display='none'; pagesMin.style.display='none'; pagesMin.value=''; }
  else { pagesMin.style.display=''; pagesMin.placeholder='min'; pagesDash.style.display='none'; pagesMax.style.display='none'; pagesMin.value=''; pagesMax.value=''; }
}
pagesOp.addEventListener('change', ()=>{ refreshPagesInputs(); refreshImp(); }); refreshPagesInputs();

// Pagination toggle
const impPagToggle=document.getElementById('impPagToggle');
impPagToggle.addEventListener('change', ()=>{ stateImp.pagination=!!impPagToggle.checked; stateImp.page=1; renderImp(); });

// Chercher / Reset
document.getElementById('impSearch').addEventListener('click', ()=>{ stateImp.page=1; refreshImp(); });
document.getElementById('impReset').addEventListener('click', ()=>{
  document.getElementById('impDocType').value='Liste'; syncDocTypeUI();
  document.getElementById('impPrefix').value='';
  ['impDpt','impSpr','impCom','impLvo','impBur','impRun'].forEach(id=> document.getElementById(id).value='');
  impNameTags=[]; renderNameTags(); impNameInput.value='';
  impDateTags=[]; renderDateTags(); impDateInput.value='';
  document.getElementById('impSizeOp').value=''; refreshSizeInputs();
  document.getElementById('impPagesOp').value=''; refreshPagesInputs();
  stateImp.page=1; refreshImp();
});

// Select-all en en-tête
const selectAllPageImp=document.getElementById('selectAllPageImp');
selectAllPageImp.addEventListener('change', ()=>{
  const tbody=document.getElementById('tb-imp');
  const boxes=[...tbody.querySelectorAll('input.row-select[type="checkbox"]')];
  const check=!!selectAllPageImp.checked;
  boxes.forEach(b=>{
    b.checked=check;
    const name=b.getAttribute('data-name');
    if (check) selectedImp.add(name); else selectedImp.delete(name);
  });
});

// Lot -> Soumettre
document.getElementById('submitImp').addEventListener('click', async ()=>{
  const names=[...selectedImp];
  if (names.length===0){ alert('Sélectionnez au moins un document.'); return; }
  const defaultHotfolder=document.getElementById('hfImpBatch').value||null;
  if (!defaultHotfolder){ alert('Choisissez une imprimante (lot)'); return; }
  const jobs=names.map(n=>({name:n}));
  try{
    const r=await fetch('/process/impressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs,defaultHotfolder})});
    const js=await r.json(); if(!r.ok) throw new Error(js.message||'Erreur soumission');
    selectedImp.clear();
    await loadImpressions(); // refresh
  }catch(e){ alert('Erreur: '+e.message); }
});

// Chargement Impressions
async function loadImpressions(){
  const r=await fetch('/impressions');
  if(!r.ok){
    document.getElementById('tb-imp').innerHTML='';
    document.getElementById('pag-imp').innerHTML='';
    document.getElementById('impRangeText').textContent='Documents 0 à 0 sur 0';
    return;
  }
  const rows=await r.json();
  stateImp.all = rows.map(x => ({ ...x, date:x.updated_at||x.created_at||new Date().toISOString() }));
  refreshImp();
}

function getImpFilters(){
  return {
    docType: document.getElementById('impDocType').value || 'Liste',
    prefix: (document.getElementById('impPrefix')?.value || '').trim(),
    dpt: (document.getElementById('impDpt').value || '').trim(),
    spr: (document.getElementById('impSpr').value || '').trim(),
    com: (document.getElementById('impCom').value || '').trim(),
    lvo: (document.getElementById('impLvo').value || '').trim(),
    bur: (document.getElementById('impBur').value || '').trim(),
    run: (document.getElementById('impRun').value || '').trim(),
    nameTags: impNameTags.slice(),
    dateTags: impDateTags.slice(),
    sizeOp: document.getElementById('impSizeOp').value || '',
    sizeMin: document.getElementById('impSizeMin').value ? Number(document.getElementById('impSizeMin').value) : null,
    sizeMax: document.getElementById('impSizeMax').value ? Number(document.getElementById('impSizeMax').value) : null,
    pagesOp: document.getElementById('impPagesOp').value || '',
    pagesMin: document.getElementById('impPagesMin').value ? Number(document.getElementById('impPagesMin').value) : null,
    pagesMax: document.getElementById('impPagesMax').value ? Number(document.getElementById('impPagesMax').value) : null,
  };
}

function applyNomenclatureFilters(rows, f){
  let out=rows;

  // DocType = CEB -> uniquement CEB, sinon "Liste" -> uniquement préfixes autorisés (et option CEB absente du select Type)
  if (f.docType==='CEB') {
    out = out.filter(x => (x.prefix||'')==='CEB');
  } else {
    const allowed = new Set(['LPVL','LPRC','LPRL','LPEC','LPEL','LDRC','LDRL','LDEC','LDEB']);
    out = out.filter(x => allowed.has((x.prefix||'')));
  }

  // Date/Heure tags (AND)
  if ((f.dateTags?.length||0) > 0){
    out = out.filter(x => {
      const t = dateTokensForRow(x);
      const joined = `${t.yyyymmdd} ${t.ddmmyyyy} ${t.hhmm} ${t.full} ${t.iso}`.toLowerCase();
      return f.dateTags.every(tag => joined.includes(tag.toLowerCase()));
    });
  }

  // Nom tags (AND)
  if ((f.nameTags?.length||0)>0){
    out = out.filter(x => {
      const nx=norm(x.name);
      return f.nameTags.every(t => nx.includes(norm(t)));
    });
  }

  // Champs
  out = out.filter(x =>
    (!f.prefix || (x.prefix||'')===f.prefix) &&
    (!f.dpt || (x.dpt||'').includes(f.dpt)) &&
    (!f.spr || (x.spr||'').includes(f.spr)) &&
    (!f.com || (x.com||'').includes(f.com)) &&
    (!f.lvo || (x.lvo||'').includes(f.lvo)) &&
    (!f.bur || (x.bur||'').includes(f.bur)) &&
    (!f.run || (x.run||'').includes(f.run))
  );

  // Taille (Ko)
  const size = x=>Number(x.size_kb||0);
  if (f.sizeOp==='ge' && f.sizeMin!=null && !Number.isNaN(f.sizeMin)) out=out.filter(x=> size(x)>=f.sizeMin);
  else if (f.sizeOp==='le' && f.sizeMax!=null && !Number.isNaN(f.sizeMax)) out=out.filter(x=> size(x)<=f.sizeMax);
  else if (f.sizeOp==='between') out=out.filter(x=>{
    const s=size(x); const okMin=(f.sizeMin==null||Number.isNaN(f.sizeMin))?true:s>=f.sizeMin;
    const okMax=(f.sizeMax==null||Number.isNaN(f.sizeMax))?true:s<=f.sizeMax; return okMin && okMax;
  });

  // Pages
  const pages = x=>Number(x.total_pages||0);
  if (f.pagesOp==='ge' && f.pagesMin!=null && !Number.isNaN(f.pagesMin)) out=out.filter(x=> pages(x)>=f.pagesMin);
  else if (f.pagesOp==='le' && f.pagesMax!=null && !Number.isNaN(f.pagesMax)) out=out.filter(x=> pages(x)<=f.pagesMax);
  else if (f.pagesOp==='between') out=out.filter(x=>{
    const s=pages(x); const okMin=(f.pagesMin==null||Number.isNaN(f.pagesMin))?true:s>=f.pagesMin;
    const okMax=(f.pagesMax==null||Number.isNaN(f.pagesMax))?true:s<=f.pagesMax; return okMin && okMax;
  });

  return out;
}

function sortRows(rows){
  const key=stateImp.sortKey, dir=stateImp.sortDir, mult=dir==='asc'?1:-1;
  return rows.slice().sort((a,b)=>{
    let va,vb;
    switch(key){
      case 'date': va=new Date(a.updated_at||a.created_at||a.date).getTime(); vb=new Date(b.updated_at||b.created_at||b.date).getTime(); break;
      case 'name': va=a.name; vb=b.name; break;
      case 'prefix': va=a.prefix||''; vb=b.prefix||''; break;
      case 'dpt': va=a.dpt||''; vb=b.dpt||''; break;
      case 'spr': va=a.spr||''; vb=b.spr||''; break;
      case 'com': va=a.com||''; vb=b.com||''; break;
      case 'lvo': va=a.lvo||''; vb=b.lvo||''; break;
      case 'bur': va=a.bur||''; vb=b.bur||''; break;
      case 'run': va=a.run||''; vb=b.run||''; break;
      case 'pages': va=Number(a.total_pages||0); vb=Number(b.total_pages||0); break;
      case 'sizekb': va=Number(a.size_kb||0); vb=Number(b.size_kb||0); break;
      default: va=a.name; vb=b.name;
    }
    if (va<vb) return -1*mult; if (va>vb) return 1*mult; return 0;
  });
}

function renderImp(){
  const f=getImpFilters();
  stateImp.filtered = sortRows(applyNomenclatureFilters(stateImp.all, f));

  const total = stateImp.filtered.length;
  const pagOn = !!(document.getElementById('impPagToggle')?.checked);
  stateImp.pagination = pagOn;
  const pageSize = pagOn ? PAGE_SIZE : total || 1;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  if (stateImp.page > maxPage) stateImp.page = maxPage;
  const start = (stateImp.page-1)*pageSize;
  const pageRows = stateImp.filtered.slice(start, start+pageSize);

  document.getElementById('impRangeText').textContent = total===0 ? 'Documents 0 à 0 sur 0' : `Documents ${start+1} à ${start+pageRows.length} sur ${total}`;

  const tb=document.getElementById('tb-imp');
  tb.innerHTML = pageRows.map(x=>{
    const checked=selectedImp.has(x.name)?'checked':'';
    const totalp=Number(x.total_pages||0);
    const viewHref=`/file/${encodeURIComponent(x.name)}`;
    const eyeSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#063b64" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    return `<tr data-name="${escapeHtml(x.name)}">
      <td>${fmtDate(x.updated_at||x.created_at||x.date)}</td>
      <td class="w-nom" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</td>
      <td>${escapeHtml(x.prefix||'')}</td>
      <td class="w-small">${escapeHtml(x.dpt||'')}</td>
      <td class="w-small">${escapeHtml(x.spr||'')}</td>
      <td class="w-small">${escapeHtml(x.com||'')}</td>
      <td class="w-small">${escapeHtml(x.lvo||'')}</td>
      <td class="w-small">${escapeHtml(x.bur||'')}</td>
      <td class="w-small">${escapeHtml(x.run||'')}</td>
      <td class="w-small">${totalp||0}</td>
      <td class="w-kb">${fmtKB(x.size_kb||0)}</td>
      <td><button class="btn small btn-print-one">Imprimer</button></td>
      <td><a class="icon-btn" target="_blank" href="${viewHref}" title="Voir le PDF">${eyeSVG}</a></td>
      <td style="text-align:right"><input class="row-select" type="checkbox" data-name="${escapeHtml(x.name)}" ${checked}></td>
    </tr>`;
  }).join('');

  // Select-all state
  const allChecked = pageRows.length>0 && pageRows.every(r=> selectedImp.has(r.name));
  const selectAllPageImp=document.getElementById('selectAllPageImp');
  selectAllPageImp.checked = allChecked;
  selectAllPageImp.indeterminate = !allChecked && pageRows.some(r=> selectedImp.has(r.name));

  // Listeners
  [...tb.querySelectorAll('input.row-select')].forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const name=cb.getAttribute('data-name');
      if (cb.checked) selectedImp.add(name); else selectedImp.delete(name);
      const currRows = stateImp.filtered.slice(start, start+pageSize);
      const all = currRows.length>0 && currRows.every(r=> selectedImp.has(r.name));
      const some = currRows.some(r=> selectedImp.has(r.name));
      selectAllPageImp.checked = all; selectAllPageImp.indeterminate = !all && some;
    });
  });

  // Délégation bouton Imprimer (ligne)
  tb.onclick = async (e)=>{
    const btn = e.target.closest('.btn-print-one'); if (!btn) return;
    const tr = btn.closest('tr'); const name = tr.getAttribute('data-name');
    const defaultHotfolder=document.getElementById('hfImpBatch').value||null;
    if (!defaultHotfolder){ alert("Choisissez une imprimante (lot)"); return; }
    try{
      const r=await fetch('/process/impressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs:[{name}],defaultHotfolder})});
      const js=await r.json(); if(!r.ok) throw new Error(js.message||'Erreur soumission');
      selectedImp.delete(name);
      await loadImpressions(); // refresh
    }catch(err){ alert('Erreur: '+err.message); }
  };

  // Pagination (toutes pages)
  renderPagination('pag-imp', stateImp.page, maxPage, (p)=>{ stateImp.page=p; renderImp(); });
  setupSortHeaders();
}

function renderPagination(containerId, page, maxPage, onGo){
  const wrap=document.getElementById(containerId); if(!wrap) return;
  if (maxPage<=1 || !stateImp.pagination){ wrap.innerHTML=''; return; }
  const parts=[];
  for(let i=1;i<=maxPage;i++){
    const active = (i===page) ? 'active' : '';
    parts.push(`<button class="page-btn ${active}" data-p="${i}">${i}</button>`);
  }
  wrap.innerHTML = parts.join('');
  [...wrap.querySelectorAll('.page-btn')].forEach(b=>{
    b.addEventListener('click', ()=> onGo(Number(b.getAttribute('data-p'))));
  });
}

function setupSortHeaders(){
  const ths=document.querySelectorAll('#sec-imp thead th.sortable');
  ths.forEach(th=>{
    th.onclick=()=>{
      const k=th.getAttribute('data-sort'); if(!k) return;
      if (stateImp.sortKey===k) stateImp.sortDir = (stateImp.sortDir==='asc'?'desc':'asc');
      else { stateImp.sortKey=k; stateImp.sortDir='asc'; }
      ths.forEach(t=> t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(stateImp.sortDir==='asc'?'sort-asc':'sort-desc');
      renderImp();
    };
  });
}

function refreshImp(){ renderImp(); }

// Réimpressions (inchangé)
async function loadReimpressions(){
  const r=await fetch('/reimpressions'); if(!r.ok){ document.getElementById('tb-reimp').innerHTML=''; return; }
  const rows=await r.json();
  const tb=document.getElementById('tb-reimp');
  tb.innerHTML = rows.map(x=>{
    const printed=Number(x.printed_pages||0), totalp=Number(x.total_pages||0);
    return `<tr data-name="${escapeHtml(x.name)}">
      <td>${fmtDate(x.updated_at||x.created_at||x.date)}</td>
      <td class="w-nom" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</td>
      <td>${escapeHtml(x.prefix||'')}</td>
      <td class="w-small">${escapeHtml(x.dpt||'')}</td>
      <td class="w-small">${escapeHtml(x.spr||'')}</td>
      <td class="w-small">${escapeHtml(x.com||'')}</td>
      <td class="w-small">${escapeHtml(x.lvo||'')}</td>
      <td class="w-small">${escapeHtml(x.bur||'')}</td>
      <td class="w-small">${escapeHtml(x.run||'')}</td>
      <td class="w-small">${totalp||0}</td>
      <td class="w-kb">${fmtKB(x.size_kb||0)}</td>
      <td class="w-size">${printed}/${totalp||0}</td>
      <td>${escapeHtml(x.dest_hotfolder||'')}</td>
      <td>${escapeHtml(x.status||'reprint_pending')}</td>
      <td><button class="btn small reprint-one">Réimpr.</button></td>
    </tr>`;
  }).join('');

  [...tb.querySelectorAll('.reprint-one')].forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const tr=btn.closest('tr'); const name=tr.getAttribute('data-name');
      const hf=document.getElementById('hfReimpBatch').value||null;
      if(!hf){ alert('Choisissez une imprimante (lot).'); return; }
      try{
        const r=await fetch('/process/reimpressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs:[{name,hotfolder:hf}],defaultHotfolder:hf})});
        const js=await r.json(); if(!r.ok) throw new Error(js.message||'Erreur réimpression');
        await loadReimpressions();
      }catch(e){ alert('Erreur: '+e.message); }
    });
  });

  document.getElementById('submitReimp')?.addEventListener('click', async ()=>{
    const hf=document.getElementById('hfReimpBatch').value||null;
    if(!hf){ alert('Choisissez une imprimante (lot).'); return; }
    const names=[...document.querySelectorAll('#tb-reimp tr')].map(tr=> tr.getAttribute('data-name'));
    if(names.length===0){ alert('Aucun document à soumettre.'); return; }
    try{
      const r=await fetch('/process/reimpressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ jobs:names.map(n=>({name:n,hotfolder:hf})), defaultHotfolder:hf })});
      const js=await r.json(); if(!r.ok) throw new Error(js.message||'Erreur réimpression');
      await loadReimpressions();
    }catch(e){ alert('Erreur: '+e.message); }
  });
}

// Suivi (inchangé)
async function loadSuivi(){
  const r=await fetch('/suivi'); if(!r.ok){ document.getElementById('tb-suivi').innerHTML=''; return; }
  const rows=await r.json();
  const tb=document.getElementById('tb-suivi');
  tb.innerHTML = rows.map(x=>{
    const printed=Number(x.printed_pages||0), totalp=Number(x.total_pages||0);
    return `<tr>
      <td>${fmtDate(x.updated_at||x.created_at||x.date)}</td>
      <td class="w-nom" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</td>
      <td>${escapeHtml(x.prefix||'')}</td>
      <td class="w-small">${escapeHtml(x.dpt||'')}</td>
      <td class="w-small">${escapeHtml(x.spr||'')}</td>
      <td class="w-small">${escapeHtml(x.com||'')}</td>
      <td class="w-small">${escapeHtml(x.lvo||'')}</td>
      <td class="w-small">${escapeHtml(x.bur||'')}</td>
      <td class="w-small">${escapeHtml(x.run||'')}</td>
      <td class="w-small">${Number(x.total_pages||0)}</td>
      <td class="w-kb">${fmtKB(x.size_kb||0)}</td>
      <td class="w-size">${printed}/${Number(x.total_pages||0)}</td>
      <td>${escapeHtml(x.status||'pending')}</td>
      <td>${escapeHtml(x.dest_hotfolder||'')}</td>
    </tr>`;
  }).join('');
}

// Admin
document.getElementById('admReset')?.addEventListener('click', async ()=>{
  const username=document.getElementById('admUser').value.trim();
  const newPassword=document.getElementById('admPass').value;
  if(!username||!newPassword){ alert('Utilisateur et nouveau mot de passe requis.'); return; }
  const r=await fetch('/admin/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ username, newPassword })});
  const js=await r.json(); if(!r.ok){ alert(js.message||'Erreur'); return; }
  alert('Mot de passe réinitialisé.');
});

document.getElementById('hfAdd')?.addEventListener('click', async ()=>{
  const name=document.getElementById('hfName').value.trim();
  const path=document.getElementById('hfPath').value.trim();
  if(!name||!path){ alert('Nom et chemin requis.'); return; }
  const r=await fetch('/admin/hotfolders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ name, path })});
  const js=await r.json(); if(!r.ok){ alert(js.message||'Erreur'); return; }
  await refreshHotfolderList(); await loadHotfolders(); alert('Imprimante ajoutée.');
});

async function refreshHotfolderList(){
  const r=await fetch('/hotfolders'); if(!r.ok) return;
  const list=await r.json();
  const ul=document.getElementById('hfList');
  ul.innerHTML = list.map(h=> `<li>${escapeHtml(h.name)} — <code>${escapeHtml(h.path)}</code></li>`).join('');
}

// Navigation
async function refreshActiveTab(){
  if(!currentUser) return;
  const key=activeKey();
  if(key==='imp')  return loadImpressions();
  if(key==='reimp')return loadReimpressions();
  if(key==='suivi')return loadSuivi();
  if(key==='admin')return refreshHotfolderList();
}

// Init
setActiveTab(tabs.imp);
refreshMe();