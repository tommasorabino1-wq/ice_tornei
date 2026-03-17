// ===============================
// SIDEBAR NAVIGATION
// ===============================

const menuToggle = document.querySelector(".mobile-menu-toggle");
const mainNav    = document.getElementById("main-navigation");
const navOverlay = document.getElementById("nav-overlay");

function openNav() {
  mainNav.classList.add("active");
  navOverlay.classList.add("active");
  menuToggle.classList.add("active");
  menuToggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeNav() {
  mainNav.classList.remove("active");
  navOverlay.classList.remove("active");
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

if (menuToggle && mainNav && navOverlay) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.contains("active") ? closeNav() : openNav();
  });
  navOverlay.addEventListener("click", closeNav);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("active")) closeNav();
  });
}

// ===============================
// NAV DROPDOWN (TORNEI)
// ===============================

const dropdownToggle = document.querySelector(".nav-dropdown-toggle");
const dropdown       = document.querySelector(".nav-dropdown");

if (dropdownToggle && dropdown) {
  dropdownToggle.addEventListener("click", () => {
    const isActive = dropdown.classList.toggle("active");
    dropdownToggle.setAttribute("aria-expanded", String(isActive));
  });
}


// ===============================
// API URLS
// ===============================
const API_URLS = {
  getRankingTeams:   "https://getrankingteams-dzvezz2yhq-uc.a.run.app",
  getRankingPlayers: "https://getrankingplayers-dzvezz2yhq-uc.a.run.app",
};

// ===============================
// STATE
// ===============================
let currentSport   = 'calcio';
let currentType    = 'teams';
let currentOrderBy = 'punti';

const rankingCache = {};

function cacheKey(sport, type, orderBy) {
  return `${sport}__${type}__${orderBy}`;
}


// ===============================
// HELPER: escapeHTML
// ===============================
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// HELPER: skeleton fade-out
// ===============================
function fadeOutSkeleton(wrapper) {
  wrapper.classList.add("fade-out");
  setTimeout(() => { wrapper.classList.add("hidden"); }, 350);
}

// ===============================
// HELPER: Formatta punti (interi senza decimali, float con max 1 decimale)
// ===============================
function formatPunti(val) {
  const n = Number(val);
  if (isNaN(n)) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ===============================
// HELPER: hasDraws per sport
// ===============================
function sportHasDraws(sport) {
  return sport === 'calcio' || sport === 'scacchi';
}


// ===============================
// PREFETCH BACKGROUND
// ===============================
async function prefetchRankingInBackground() {
  const sports  = ['calcio', 'padel', 'beach_volley', 'scacchi'];
  const types   = ['teams', 'players'];
  const orderBy = 'punti';

  for (const sport of sports) {
    for (const type of types) {
      if (sport === 'scacchi' && type === 'teams') continue;

      const key = cacheKey(sport, type, orderBy);
      if (rankingCache[key]) continue;

      try {
        const url = type === 'teams'
          ? `${API_URLS.getRankingTeams}?sport=${encodeURIComponent(sport)}&orderBy=${encodeURIComponent(orderBy)}`
          : `${API_URLS.getRankingPlayers}?sport=${encodeURIComponent(sport)}&orderBy=${encodeURIComponent(orderBy)}`;

        const res  = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        rankingCache[key] = Array.isArray(data) ? data : [];
      } catch {
        // fail silenzioso
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }
}


// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  await loadRanking();
  prefetchRankingInBackground();
});


// ===============================
// INIT TABS
// ===============================
function initTabs() {

  // Sport tabs
  document.querySelectorAll(".rk-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".rk-tab").forEach(t => {
        t.classList.remove("rk-tab--active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("rk-tab--active");
      tab.setAttribute("aria-selected", "true");

      currentSport = tab.dataset.sport;
      handleSubtabsVisibility();
      loadRanking();
    });
  });

  // Subtabs
  document.querySelectorAll(".rk-subtab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".rk-subtab").forEach(t => {
        t.classList.remove("rk-subtab--active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("rk-subtab--active");
      tab.setAttribute("aria-selected", "true");

      currentType    = tab.dataset.type;
      currentOrderBy = 'punti';
      loadRanking();
    });
  });
}


// ===============================
// HANDLE SUBTABS VISIBILITY
// ===============================
function handleSubtabsVisibility() {
  const teamsSubtab   = document.querySelector('.rk-subtab[data-type="teams"]');
  const playersSubtab = document.querySelector('.rk-subtab[data-type="players"]');

  if (currentSport === 'scacchi') {
    if (teamsSubtab)   teamsSubtab.classList.add("hidden");
    if (playersSubtab) {
      playersSubtab.classList.remove("hidden");
      playersSubtab.classList.add("rk-subtab--active");
      playersSubtab.setAttribute("aria-selected", "true");
      if (teamsSubtab) {
        teamsSubtab.classList.remove("rk-subtab--active");
        teamsSubtab.setAttribute("aria-selected", "false");
      }
    }
    currentType = 'players';
  } else {
    if (teamsSubtab)   teamsSubtab.classList.remove("hidden");
    if (playersSubtab) playersSubtab.classList.remove("hidden");

    document.querySelectorAll(".rk-subtab").forEach(t => {
      const isActive = t.dataset.type === currentType;
      t.classList.toggle("rk-subtab--active", isActive);
      t.setAttribute("aria-selected", String(isActive));
    });
  }
}


// ===============================
// LOAD RANKING
// ===============================
async function loadRanking() {
  const skeleton     = document.getElementById("rk-skeleton");
  const placeholder  = document.getElementById("rk-placeholder");
  const tableWrapper = document.getElementById("rk-table-wrapper");
  const tableTitle   = document.getElementById("rk-table-title");

  const key = cacheKey(currentSport, currentType, currentOrderBy);

  placeholder.classList.add("hidden");
  tableWrapper.classList.add("hidden");

  if (tableTitle) {
    const sportLabel = getSportLabel(currentSport);
    const typeLabel  = currentType === 'teams' ? 'Ranking Squadre' : 'Ranking Giocatori';
    tableTitle.innerHTML = `
      <span class="rk-table-type">${typeLabel}</span>
      <span class="rk-table-sport">${sportLabel}</span>
    `;
  }

  if (rankingCache[key]) {
    skeleton.classList.add("hidden");
    const data = rankingCache[key];
    if (data.length === 0) {
      placeholder.classList.remove("hidden");
    } else {
      tableWrapper.classList.remove("hidden");
      renderRankingTable(data, currentSport, currentType);
    }
    return;
  }

  skeleton.classList.remove("hidden", "fade-out");

  try {
    const url = currentType === 'teams'
      ? `${API_URLS.getRankingTeams}?sport=${encodeURIComponent(currentSport)}&orderBy=${encodeURIComponent(currentOrderBy)}`
      : `${API_URLS.getRankingPlayers}?sport=${encodeURIComponent(currentSport)}&orderBy=${encodeURIComponent(currentOrderBy)}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    rankingCache[key] = Array.isArray(data) ? data : [];

    fadeOutSkeleton(skeleton);

    if (rankingCache[key].length === 0) {
      placeholder.classList.remove("hidden");
      return;
    }

    tableWrapper.classList.remove("hidden");
    renderRankingTable(rankingCache[key], currentSport, currentType);

  } catch (err) {
    console.error("Errore caricamento ranking:", err);
    fadeOutSkeleton(skeleton);
    placeholder.classList.remove("hidden");
  }
}


// ===============================
// RENDER RANKING TABLE
// ===============================

const PAGE_SIZE = 25;
let tableSort = { field: 'punti', dir: 'desc' };

function renderRankingTable(data, sport, type) {
  const container = document.getElementById("rk-table-container");
  const isCalcio  = sport === 'calcio';
  const isPlayers = type === 'players';

  // Stato paginazione locale alla render (reset a ogni nuova chiamata)
  let currentPage = 1;

  const columns = [
    { key: 'presenze',          label: 'PG',   sortable: true },
    { key: 'punti',             label: 'Pts',  sortable: true },
    { key: 'punti_per_partita', label: 'P/PG', sortable: true },
    ...(isCalcio ? [
      { key: 'gol',       label: 'Gol', sortable: true },
      { key: 'media_gol', label: 'G/P', sortable: true },
    ] : []),
  ];

  function normalize(str) {
    return String(str || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Restituisce tutti i dati ordinati con posizione reale pre-calcolata
  function getSortedWithRank(rows) {
    const sorted = [...rows].sort((a, b) => {
      if (!tableSort.field) return 0;
      const va = Number(a[tableSort.field]) || 0;
      const vb = Number(b[tableSort.field]) || 0;
      return tableSort.dir === 'desc' ? vb - va : va - vb;
    });
    // Aggiunge campo _rank (posizione reale nell'ordinamento globale)
    return sorted.map((row, i) => ({ ...row, _rank: i + 1 }));
  }

  function buildTbody(filteredRows, page) {
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    pageRows.forEach(row => {
      const pos      = row._rank; // posizione reale, invariante alla ricerca
      const posClass = pos === 1 ? 'rk-gold' : pos === 2 ? 'rk-silver' : pos === 3 ? 'rk-bronze' : '';

      let nameCellContent;
      if (isPlayers) {
        nameCellContent = `
          <td class="rk-name-cell">
            <span class="team-name-text">${escapeHTML(row.player_name || '—')}</span>
          </td>
        `;
      } else {
        const logo = row.team_logo;
        const logoHTML = logo
          ? `<img src="${escapeHTML(logo)}" alt="" class="team-logo-mini">`
          : `<span class="team-logo-mini-fallback">👥</span>`;
        nameCellContent = `
          <td class="rk-name-cell">
            ${logoHTML}
            <span class="team-name-text">${escapeHTML(row.team_name || '—')}</span>
          </td>
        `;
      }

      const golCells = isCalcio
        ? `<td>${Number(row.gol) || 0}</td><td>${Number(row.media_gol) ? Number(row.media_gol).toFixed(2) : '0.00'}</td>`
        : '';

      const tr = document.createElement("tr");
      if (posClass) tr.classList.add(posClass);

      tr.innerHTML = `
        <td class="rk-pos-col">
          <span class="rk-pos-badge ${posClass}">${pos}</span>
        </td>
        ${nameCellContent}
        <td>${Number(row.presenze) || 0}</td>
        <td><strong>${formatPunti(row.punti)}</strong></td>
        <td>${formatPunti(row.punti_per_partita)}</td>
        ${golCells}
      `;

      tbody.appendChild(tr);
    });
  }

  function buildPagination(filteredRows, page) {
    // Rimuovi paginazione esistente
    const existing = table.parentElement.querySelector('.rk-pagination');
    if (existing) existing.remove();

    const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'rk-pagination';

    // ← Prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'rk-pagination__btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = page === 1;
    prevBtn.addEventListener('click', () => {
      currentPage--;
      buildTbody(filteredRows, currentPage);
      buildPagination(filteredRows, currentPage);
    });
    nav.appendChild(prevBtn);

    // Numeri pagina (max 5 visibili, con ellissi)
    const range = getPaginationRange(page, totalPages);
    range.forEach(item => {
      if (item === '…') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'rk-pagination__info';
        ellipsis.textContent = '…';
        nav.appendChild(ellipsis);
      } else {
        const btn = document.createElement('button');
        btn.className = 'rk-pagination__btn' + (item === page ? ' rk-pagination__btn--active' : '');
        btn.textContent = String(item);
        btn.addEventListener('click', () => {
          currentPage = item;
          buildTbody(filteredRows, currentPage);
          buildPagination(filteredRows, currentPage);
        });
        nav.appendChild(btn);
      }
    });

    // → Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'rk-pagination__btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = page === totalPages;
    nextBtn.addEventListener('click', () => {
      currentPage++;
      buildTbody(filteredRows, currentPage);
      buildPagination(filteredRows, currentPage);
    });
    nav.appendChild(nextBtn);

    // Info "1–25 di 80"
    const info = document.createElement('span');
    info.className = 'rk-pagination__info';
    const from = (page - 1) * PAGE_SIZE + 1;
    const to   = Math.min(page * PAGE_SIZE, filteredRows.length);
    info.textContent = `${from}–${to} di ${filteredRows.length}`;
    nav.appendChild(info);

    table.parentElement.appendChild(nav);
  }

  function getPaginationRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
  }

  // Render completo: ordina globalmente (con rank), filtra, pagina
  function renderAll(query, page) {
    const sortedWithRank = getSortedWithRank(data);
    const filtered = query
      ? sortedWithRank.filter(row => {
          const name = normalize(isPlayers ? row.player_name : row.team_name);
          return name.includes(query);
        })
      : sortedWithRank;

    buildTbody(filtered, page);
    buildPagination(filtered, page);
    updateHeaderArrows();
  }

  function updateHeaderArrows() {
    table.querySelectorAll('th[data-sort]').forEach(th => {
      const field = th.dataset.sort;
      if (field === tableSort.field) {
        th.classList.add('rk-sortable--active');
        th.classList.toggle('rk-sort-desc', tableSort.dir === 'desc');
        th.classList.toggle('rk-sort-asc',  tableSort.dir === 'asc');
      } else {
        th.classList.remove('rk-sortable--active', 'rk-sort-desc', 'rk-sort-asc');
      }
    });
  }

  // ── Costruisci struttura tabella ──────────────────────────────────
  const table = document.createElement("table");
  table.className = "rk-table";

  const nameHeader = isPlayers ? 'Giocatore' : 'Squadra';

  const colHeaders = columns.map(col => {
    if (col.sortable) {
      const isActive = col.key === tableSort.field;
      const dirClass = isActive ? (tableSort.dir === 'desc' ? ' rk-sort-desc' : ' rk-sort-asc') : '';
      return `<th data-sort="${col.key}" class="rk-sortable${isActive ? ' rk-sortable--active' : ''}${dirClass}"><span class="rk-sort-label">${col.label}</span></th>`;
    }
    return `<th>${col.label}</th>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr>
        <th class="rk-pos-col">#</th>
        <th>${nameHeader}</th>
        ${colHeaders}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  // Click intestazioni → reset pagina a 1
  table.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (tableSort.field === field) {
        tableSort.dir = tableSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        tableSort.field = field;
        tableSort.dir   = 'desc';
      }
      currentPage = 1;
      const currentInput = document.getElementById('rk-search-input');
      const query = currentInput ? normalize(currentInput.value) : '';
      renderAll(query, currentPage);
    });
  });

  container.innerHTML = "";
  container.appendChild(table);

  // Primo render
  renderAll('', currentPage);

  // ── Ricerca ──────────────────────────────────────────────────────
  const searchToggle = document.getElementById('rk-search-toggle');
  const searchBar    = document.getElementById('rk-search-bar');
  const searchInput  = document.getElementById('rk-search-input');

  searchInput.value = '';
  searchBar.classList.add('hidden');

  const newToggle = searchToggle.cloneNode(true);
  searchToggle.parentNode.replaceChild(newToggle, searchToggle);
  const newInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newInput, searchInput);

  newToggle.addEventListener('click', () => {
    const isHidden = searchBar.classList.toggle('hidden');
    if (!isHidden) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          newInput.focus();
          const inputRect      = newInput.getBoundingClientRect();
          const viewportHeight = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;
          if (inputRect.bottom > viewportHeight * 0.6) {
            newInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 60);
      });
    } else {
      newInput.value = '';
      currentPage = 1;
      renderAll('', currentPage);
    }
  });

  newInput.addEventListener('input', () => {
    const query = normalize(newInput.value);
    currentPage = 1; // reset pagina a ogni ricerca
    renderAll(query, currentPage);
  });
}


// ===============================
// HELPER: Label leggibile per sport
// ===============================
function getSportLabel(sport) {
  const map = {
    calcio:       'Calcio',
    padel:        'Padel',
    beach_volley: 'Beach Volley',
    scacchi:      'Scacchi',
  };
  return map[sport] || sport;
}