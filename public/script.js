// public/script.js
// YesDocu WEB 1.0.1 — IHM Impressions / Réimpressions + Auth (fallback)
// ---------------------------------------------------------------

(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Helpers génériques ----------
  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: e.message }) }));
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  function setText(el, s) { if (el) el.textContent = s; }
  function show(el, v) { if (!el) return; el.style.display = v ? '' : 'none'; }

  // ---------- AUTH avec fallback (si API absente) ----------
  const loginBox = {
    user: $('loginUser'),
    pass: $('loginPass'),
    btnLogin: $('btnLogin'),
    btnLogout: $('btnLogout'),
    whoami: $('whoami'),
  };

  // Rôles: admin | operateur | responsable | superviseur
  function applyRoleUI(role) {
    const tabImp = $('tab-imp'), secImp = $('sec-imp');
    const tabRei = $('tab-reimp'), secRei = $('sec-reimp');
    const tabSui = $('tab-suivi'), secSui = $('sec-suivi');
    const tabAdm = $('tab-admin'), secAdm = $('sec-admin');

    const perms = {
      administrateur: { imp: true, reimp: true, suivi: true, admin: true },
      admin:          { imp: true, reimp: true, suivi: true, admin: true },
      operateur:      { imp: true, reimp: false, suivi: true, admin: false },
      responsable:    { imp: true, reimp: true, suivi: true, admin: false },
      superviseur:    { imp: false, reimp: false, suivi: true, admin: false },
      // défaut si inconnu
      default:        { imp: true, reimp: true, suivi: true, admin: false },
    };
    const p = perms[role] || perms.default;

    show(tabImp, p.imp); show(secImp, p.imp); if (!p.imp) { tabImp?.classList.remove('active'); secImp?.classList.remove('active'); }
    show(tabRei, p.reimp); show(secRei, p.reimp); if (!p.reimp) { tabRei?.classList.remove('active'); secRei?.classList.remove('active'); }
    show(tabSui, p.suivi); show(secSui, p.suivi); if (!p.suivi) { tabSui?.classList.remove('active'); secSui?.classList.remove('active'); }
    show(tabAdm, p.admin); show(secAdm, p.admin); if (!p.admin) { tabAdm?.classList.remove('active'); secAdm?.classList.remove('active'); }

    // Si l’onglet actif n’est plus visible, bascule sur le premier dispo
    setTimeout(() => {
      const anyActiveVisible = document.querySelector('.tab.active:not([style*="display: none"])');
      if (!anyActiveVisible) {
        const firstVisible = document.querySelector('.tab:not([style*="display: none"])');
        if (firstVisible) firstVisible.click();
      }
    }, 0);
  }

  async function tryWhoAmI() {
    try {
      const me = await fetchJSON('/api/whoami');
      return me && me.user ? me.user : null;
    } catch {
      return null;
    }
  }

  async function login(username, password) {
    // 1) tentative via backend
    try {
      const res = await fetchJSON('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      // attend { ok:true, user:{username, role} }
      return res.user || { username, role: 'admin' };
    } catch {
      // 2) fallback local (sans backend) — pour travailler l’IHM
      const u = (username || '').toLowerCase();
      let role = 'admin';
      if (u.includes('oper')) role = 'operateur';
      else if (u.includes('super')) role = 'superviseur';
      else if (u.includes('resp')) role = 'responsable';
      else if (u.includes('admin')) role = 'admin';
      return { username, role };
    }
  }

  async function logout() {
    try { await fetchJSON('/api/logout', { method: 'POST' }); } catch {}
  }

  function persistAuth(user) {
    sessionStorage.setItem('yd_user', JSON.stringify(user || {}));
  }
  function readAuth() {
    try { return JSON.parse(sessionStorage.getItem('yd_user') || '{}'); } catch { return {}; }
  }
  function clearAuth() { sessionStorage.removeItem('yd_user'); }

  function setLoggedInUI(user) {
    if (user && user.username) {
      show(loginBox.btnLogin, false);
      show(loginBox.btnLogout, true);
      setText(loginBox.whoami, `${user.username} (${user.role})`);
    } else {
      show(loginBox.btnLogin, true);
      show(loginBox.btnLogout, false);
      setText(loginBox.whoami, '');
    }
  }

  async function bootstrapAuth() {
    const who = await tryWhoAmI();
    let user = who || readAuth();
    if (user && user.username) {
      setLoggedInUI(user);
      applyRoleUI(user.role);
    } else {
      setLoggedInUI(null);
      applyRoleUI('default');
    }

    loginBox.btnLogin?.addEventListener('click', async () => {
      const u = (loginBox.user?.value || '').trim();
      const p = (loginBox.pass?.value || '').trim();
      if (!u) return alert('Utilisateur requis');
      const me = await login(u, p);
      persistAuth(me);
      setLoggedInUI(me);
      applyRoleUI(me.role);
    });

    loginBox.btnLogout?.addEventListener('click', async () => {
      await logout();
      clearAuth();
      setLoggedInUI(null);
      applyRoleUI('default');
    });
  }

  // ---------- Hotfolders ----------
  async function loadHotfolders() {
    try {
      const hfs = await fetchJSON('/api/hotfolders');
      const fill = (selId) => {
        const el = $(selId);
        if (!el) return;
        el.innerHTML = '';
        (hfs || []).forEach((h) => {
          const o = document.createElement('option');
          o.value = h.name || h.path || h.id;
          o.textContent = h.name || h.path || 'HF';
          el.appendChild(o);
        });
      };
      fill('hfImpBatch');
      fill('hfReimpBatch');
    } catch (e) {
      console.warn('Hotfolders load error:', e.message);
    }
  }

  // ---------- Composants UI réutilisables ----------
  function initTagInput(inputEl, bagEl, onChange) {
    const tags = [];
    function render() {
      bagEl.innerHTML = '';
      tags.forEach((t, i) => {
        const s = document.createElement('span');
        s.className = 'tag';
        s.innerHTML = `${t} <button data-i="${i}">×</button>`;
        bagEl.appendChild(s);
      });
      bagEl.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          tags.splice(+b.dataset.i, 1);
          render();
          onChange();
        };
      });
    }
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = inputEl.value.trim();
        if (v) {
          tags.push(v);
          render();
          onChange();
          inputEl.value = '';
        }
        e.preventDefault();
      }
    });
    return {
      values: () => tags.slice(),
      clear: () => {
        tags.length = 0;
        render();
        onChange();
      },
      render,
    };
  }

  function initNumericOp(opEl, minEl, maxEl, dashEl) {
    function apply() {
      const op = opEl.value;
      if (op === 'between') {
        maxEl.style.display = '';
        dashEl.style.display = '';
      } else {
        maxEl.style.display = 'none';
        dashEl.style.display = 'none';
      }
    }
    opEl.addEventListener('change', apply);
    apply();
    return { apply };
  }

  // ---------- Page factorisée (Impressions / Réimpressions) ----------
  function initListPage(cfg) {
    const { scope, listUrl, processUrl } = cfg;

    // Filtres
    const docType = $(`${scope}DocType`);
    const gPrefix = $(`group-${scope}Prefix`);
    const prefix = $(`${scope}Prefix`);
    const dpt = $(`${scope}Dpt`);
    const spr = $(`${scope}Spr`);
    const com = $(`${scope}Com`);
    const lvo = $(`${scope}Lvo`);
    const bur = $(`${scope}Bur`);
    const run = $(`${scope}Run`);

    // Tags Date / Nom
    const dateInput = $(`${scope}DateInput`);
    const dateTagsBag = $(`${scope}DateTags`);
    const nameInput = $(`${scope}NameInput`);
    const nameTagsBag = $(`${scope}Tags`);
    const dateTags = initTagInput(dateInput, dateTagsBag, doSearch);
    const nameTags = initTagInput(nameInput, nameTagsBag, doSearch);

    // Taille (Ko)
    const sizeOp = $(`${scope}SizeOp`);
    const sizeMin = $(`${scope}SizeMin`);
    const sizeMax = $(`${scope}SizeMax`);
    const sizeDash = $(`${scope}SizeDash`);
    initNumericOp(sizeOp, sizeMin, sizeMax, sizeDash);

    // Pages
    const pagesOp = $(`${scope}PagesOp`);
    const pagesMin = $(`${scope}PagesMin`);
    const pagesMax = $(`${scope}PagesMax`);
    const pagesDash = $(`${scope}PagesDash`);
    initNumericOp(pagesOp, pagesMin, pagesMax, pagesDash);

    // UI éléments
    const searchBtn = $(`${scope}Search`);
    const resetBtn = $(`${scope}Reset`);
    const pagToggle = $(`${scope}PagToggle`);
    const rangeText = $(`${scope}RangeText`);
    const tbody = $(`tb-${scope}`);
    const paginator = $(`pag-${scope}`);
    const selectAll = $(`selectAllPage${scope[0].toUpperCase() + scope.slice(1)}`);
    const hfBatch = $(`hf${scope[0].toUpperCase() + scope.slice(1)}Batch`);
    const submitBtn = $(`submit${scope[0].toUpperCase() + scope.slice(1)}`);

    function refreshDocTypeVisibility() {
      if (!gPrefix) return;
      gPrefix.style.display = docType && docType.value === 'CEB' ? 'none' : '';
    }
    docType?.addEventListener('change', () => {
      refreshDocTypeVisibility();
      doSearch();
    });
    refreshDocTypeVisibility();

    // ENTER = Chercher
    dateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
      }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
      }
    });

    // État
    let all = []; // données filtrées
    let page = 1;
    const pageSize = 10;

    // Sélection persistante par scope
    const selectedKey = `yd_selected_${scope}`;
    const selected = new Set(
      (() => {
        try {
          return JSON.parse(sessionStorage.getItem(selectedKey) || '[]');
        } catch {
          return [];
        }
      })()
    );
    function persistSelected() {
      sessionStorage.setItem(selectedKey, JSON.stringify(Array.from(selected)));
    }

    async function loadRaw() {
      return await fetchJSON(listUrl);
    }

    function applyFilters(rows) {
      let list = rows.slice();

      // Document (Liste/CEB)
      const isCEB = docType && docType.value === 'CEB';
      if (isCEB) list = list.filter((x) => (x.prefix || '').toUpperCase() === 'CEB');

      // Type (Préfixe) si Liste
      if (!isCEB && prefix && prefix.value) {
        const pref = prefix.value.toUpperCase();
        list = list.filter((x) => (x.prefix || '').toUpperCase() === pref);
      }

      // DPT / SPR / COM / LVO / BUR / RUN (prefix match)
      [['dpt', dpt], ['spr', spr], ['com', com], ['lvo', lvo], ['bur', bur], ['run', run]].forEach(([k, el]) => {
        const v = (el?.value || '').trim();
        if (v) list = list.filter((x) => String(x[k] || '').startsWith(v));
      });

      // Nom (tags, ET)
      const nameTs = nameTags.values();
      if (nameTs.length) {
        list = list.filter((x) =>
          nameTs.every((t) => String(x.name || '').toLowerCase().includes(t.toLowerCase()))
        );
      }

      // Date/Heure (tags, ET) sur updated_at/created_at
      const dateTs = dateTags.values();
      if (dateTs.length) {
        list = list.filter((x) => {
          const s = (x.updated_at || x.created_at || '').replace('T', ' ').toLowerCase();
          return dateTs.every((t) => s.includes(String(t).toLowerCase()));
        });
      }

      // Taille (Ko)
      const sop = sizeOp.value, smin = +sizeMin.value || 0, smax = +sizeMax.value || 0;
      if (sop === 'ge') list = list.filter((x) => (x.size_kb || 0) >= smin);
      if (sop === 'le') list = list.filter((x) => (x.size_kb || 0) <= smin);
      if (sop === 'between') list = list.filter((x) => (x.size_kb || 0) >= smin && (x.size_kb || 0) <= smax);

      // Pages
      const pop = pagesOp.value, pmin = +pagesMin.value || 0, pmax = +pagesMax.value || 0;
      if (pop === 'ge') list = list.filter((x) => (x.total_pages || 0) >= pmin);
      if (pop === 'le') list = list.filter((x) => (x.total_pages || 0) <= pmin);
      if (pop === 'between') list = list.filter((x) => (x.total_pages || 0) >= pmin && (x.total_pages || 0) <= pmax);

      return list;
    }

    async function load() {
      try {
        const raw = await loadRaw();
        all = applyFilters(raw);
        page = 1;
        render();
      } catch (e) {
        console.error(`[${scope}] load error:`, e.message);
      }
    }

    function render() {
      const usePag = pagToggle.checked;
      const total = all.length;
      const start = usePag ? (page - 1) * pageSize : 0;
      const end = usePag ? Math.min(start + pageSize, total) : total;
      const rows = all.slice(start, end);

      setText(rangeText, `Documents ${total ? start + 1 : 0} à ${end} sur ${total}`);

      tbody.innerHTML = rows
        .map(
          (x) => `
        <tr>
          <td>${x.updated_at ? x.updated_at.slice(0, 16).replace('T', ' ') : ''}</td>
          <td class="w-nom">${x.name}</td>
          <td>${x.prefix || ''}</td>
          <td class="w-small">${x.dpt || ''}</td>
          <td class="w-small">${x.spr || ''}</td>
          <td class="w-small">${x.com || ''}</td>
          <td class="w-small">${x.lvo || ''}</td>
          <td class="w-small">${x.bur || ''}</td>
          <td class="w-small">${x.run || ''}</td>
          <td class="w-small">${x.total_pages || 0}</td>
          <td class="w-kb">${x.size_kb || 0}</td>
          <td><button class="btn small" data-print="${x.name}">Imprimer</button></td>
          <td><button class="btn small" data-view="${x.name}" title="Voir le PDF">👁️</button></td>
          <td style="text-align:center">
            <input type="checkbox" data-sel="${x.name}" ${selected.has(x.name) ? 'checked' : ''}>
          </td>
        </tr>`
        )
        .join('');

      // Actions ligne
      tbody.querySelectorAll('[data-view]').forEach((b) => {
        b.onclick = () => window.open(`/file/${encodeURIComponent(b.dataset.view)}`, '_blank');
      });
      tbody.querySelectorAll('[data-print]').forEach((b) => {
        b.onclick = () => submit([b.dataset.print]);
      });
      tbody.querySelectorAll('[data-sel]').forEach((chk) => {
        chk.onchange = () => {
          if (chk.checked) selected.add(chk.dataset.sel);
          else selected.delete(chk.dataset.sel);
          persistSelected();
        };
      });

      // Pagination
      const pages = usePag ? Math.max(1, Math.ceil(total / pageSize)) : 1;
      paginator.innerHTML = '';
      if (usePag && pages > 1) {
        for (let i = 1; i <= pages; i++) {
          const btn = document.createElement('button');
          btn.textContent = i;
          if (i === page) btn.disabled = true;
          btn.onclick = () => {
            page = i;
            render();
          };
          paginator.appendChild(btn);
        }
      }
    }

    async function submit(names) {
      const hf = hfBatch?.value;
      if (!hf) return alert('Choisir une imprimante (lot)');
      const jobs = (names && names.length ? names : Array.from(selected)).map((n) => ({ name: n }));
      if (!jobs.length) return alert('Aucun document sélectionné');

      try {
        const out = await fetchJSON(processUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs, defaultHotfolder: hf }),
        });
        alert(`Impression lancée (${out.count || jobs.length} job(s))`);
        // Vide la sélection et recharge
        selected.clear();
        persistSelected();
        await load();
      } catch (e) {
        alert(`Erreur impression: ${e.message}`);
      }
    }

    // Boutons
    searchBtn.onclick = () => load();
    resetBtn.onclick = () => {
      [prefix, dpt, spr, com, lvo, bur, run].forEach((i) => i && (i.value = ''));
      [sizeOp, pagesOp].forEach((s) => (s.value = ''));
      [sizeMin, sizeMax, pagesMin, pagesMax].forEach((n) => (n.value = ''));
      if (docType) docType.value = 'Liste';
      refreshDocTypeVisibility();
      nameTags.clear();
      dateTags.clear();
      load();
    };
    pagToggle.onchange = () => render();
    submitBtn.onclick = () => submit();

    // Select-all (page)
    if (selectAll) {
      selectAll.onchange = () => {
        const usePag = pagToggle.checked;
        const total = all.length;
        const start = usePag ? (page - 1) * pageSize : 0;
        const end = usePag ? Math.min(start + pageSize, total) : total;
        const rows = all.slice(start, end);
        rows.forEach((r) => (selectAll.checked ? selected.add(r.name) : selected.delete(r.name)));
        persistSelected();
        render();
      };
    }

    // Initial
    load();
  }

  // ---------- Tabs & Routing ----------
  function setupTabsRouting() {
    const tabs = [
      { id: 'tab-imp', sec: 'sec-imp', path: '/impressions' },
      { id: 'tab-reimp', sec: 'sec-reimp', path: '/reimpressions' },
      { id: 'tab-suivi', sec: 'sec-suivi', path: '/suivi' },
      { id: 'tab-admin', sec: 'sec-admin', path: '/admin' },
    ];

    function activate(pathname) {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.section').forEach((x) => x.classList.remove('active'));
      const t = tabs.find((t) => t.path === pathname) || tabs[0];
      $(t.id)?.classList.add('active');
      $(t.sec)?.classList.add('active');
      history.replaceState(null, '', t.path);
    }

    tabs.forEach((t) => {
      $(t.id)?.addEventListener('click', () => activate(t.path));
    });

    // Activation initiale selon l’URL
    const wanted = ['/', '/impressions', '/reimpressions', '/suivi', '/admin'].includes(location.pathname)
      ? location.pathname
      : '/impressions';
    activate(wanted === '/' ? '/impressions' : wanted);
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', async () => {
    setupTabsRouting();
    await bootstrapAuth();  // gère login / rôles (avec fallback)
    await loadHotfolders(); // remplit les sélecteurs d'imprimantes

    // Impressions
    initListPage({
      scope: 'imp',
      listUrl: '/api/impressions',
      processUrl: '/api/process/impressions',
    });

    // Réimpressions
    initListPage({
      scope: 'reimp',
      listUrl: '/api/reimpressions',
      processUrl: '/api/process/reimpressions',
    });
  });
})();