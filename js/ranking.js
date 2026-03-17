// ===============================
// SIDEBAR NAVIGATION
// (identica a standings.js)
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
let currentOrderBy = 'pct_vittorie';

// Cache in memoria: chiave = "sport__type__orderBy" → array di risultati
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
// HELPER: Formato percentuale
// ===============================
function formatPct(val) {
  const n = Number(val);
  if (isNaN(n)) return "0%";
  return `${n % 1 === 0 ? n : n.toFixed(1)}%`;
}



// ===============================
// HELPER: hasDraws per sport
// ===============================
function sportHasDraws(sport) {
  return sport === 'calcio' || sport === 'scacchi';
}



// ===============================
// PREFETCH BACKGROUND
// Carica in background gli altri tab dopo che il default è già visibile.
// Non tocca mai l'UI — scrive solo nella cache.
// ===============================
async function prefetchRankingInBackground() {
  const sports = ['calcio', 'padel', 'beach_volley', 'scacchi'];
  const types  = ['teams', 'players'];
  const orderBy = 'pct_vittorie'; // prefetch solo il default orderBy

  for (const sport of sports) {
    for (const type of types) {
      // Skip scacchi teams (non esiste)
      if (sport === 'scacchi' && type === 'teams') continue;

      const key = cacheKey(sport, type, orderBy);

      // Skip se già in cache (es. il default caricato da loadRanking)
      if (rankingCache[key]) continue;

      try {
        const url = type === 'teams'
          ? `${API_URLS.getRankingTeams}?sport=${encodeURIComponent(sport)}&orderBy=${encodeURIComponent(orderBy)}`
          : `${API_URLS.getRankingPlayers}?sport=${encodeURIComponent(sport)}&orderBy=${encodeURIComponent(orderBy)}`;

        const res = await fetch(url);
        if (!res.ok) continue; // fail silenzioso in background

        const data = await res.json();
        rankingCache[key] = Array.isArray(data) ? data : [];

      } catch {
        // Prefetch fallito silenziosamente — non blocca nulla
      }

      // Piccola pausa tra un fetch e l'altro per non saturare la connessione
      await new Promise(r => setTimeout(r, 300));
    }
  }
}



// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  await loadRanking(); // aspetta che il default sia visibile
  prefetchRankingInBackground(); // poi parte in background senza await
});



// ===============================
// INIT TABS
// ===============================
function initTabs() {

  // Sport tabs
  document.querySelectorAll(".ranking-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ranking-tab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");

      currentSport = tab.dataset.sport;
      handleSubtabsVisibility();
      loadRanking();
    });
  });

  // Subtabs (squadre / giocatori)
  document.querySelectorAll(".ranking-subtab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ranking-subtab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");

      currentType = tab.dataset.type;
      currentOrderBy = 'pct_vittorie';
      loadRanking();
    });
  });

}

// ===============================
// HANDLE SUBTABS VISIBILITY
// Scacchi → mostra solo "Giocatori", nasconde "Squadre"
// ===============================
function handleSubtabsVisibility() {
  const teamsSubtab   = document.querySelector('.ranking-subtab[data-type="teams"]');
  const playersSubtab = document.querySelector('.ranking-subtab[data-type="players"]');

  if (currentSport === 'scacchi') {
    if (teamsSubtab)   teamsSubtab.classList.add("hidden");
    if (playersSubtab) {
      playersSubtab.classList.remove("hidden");
      playersSubtab.classList.add("active");
      playersSubtab.setAttribute("aria-selected", "true");
      if (teamsSubtab) {
        teamsSubtab.classList.remove("active");
        teamsSubtab.setAttribute("aria-selected", "false");
      }
    }
    currentType = 'players';
  } else {
    if (teamsSubtab)   teamsSubtab.classList.remove("hidden");
    if (playersSubtab) playersSubtab.classList.remove("hidden");

    // Rispecchia il currentType nei tab
    document.querySelectorAll(".ranking-subtab").forEach(t => {
      const isActive = t.dataset.type === currentType;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", String(isActive));
    });
  }
}






// ===============================
// LOAD RANKING
// ===============================
async function loadRanking() {
  const skeleton     = document.getElementById("ranking-skeleton");
  const placeholder  = document.getElementById("ranking-placeholder");
  const tableWrapper = document.getElementById("ranking-table-wrapper");
  const tableTitle   = document.getElementById("ranking-table-title");

  const key = cacheKey(currentSport, currentType, currentOrderBy);

  placeholder.classList.add("hidden");
  tableWrapper.classList.add("hidden");

  if (tableTitle) {
    const sportLabel = getSportLabel(currentSport);
    const typeLabel  = currentType === 'teams' ? 'Ranking Squadre' : 'Ranking Giocatori';
    tableTitle.innerHTML = `
      <span class="ranking-table-type">${typeLabel}</span>
      <span class="ranking-table-sport">${sportLabel}</span>
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

    const res = await fetch(url);
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
// Con ordinamento cliccabile sulle intestazioni e ricerca
// ===============================

let tableSort = { field: null, dir: 'desc' };

function renderRankingTable(data, sport, type) {
  const container = document.getElementById("ranking-table-container");
  const isCalcio  = sport === 'calcio';
  const isPlayers = type === 'players';

  const columns = [
    { key: 'presenze',     label: 'PG',  sortable: true },
    { key: 'pct_vittorie', label: '% V', sortable: true },
    ...(isCalcio ? [
      { key: 'gol',       label: 'Gol', sortable: true },
      { key: 'media_gol', label: 'G/P', sortable: true },
    ] : []),
  ];

  function normalize(str) {
    return String(str || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function getSortedData(rows) {
    if (!tableSort.field) return rows;
    return [...rows].sort((a, b) => {
      const va = Number(a[tableSort.field]) || 0;
      const vb = Number(b[tableSort.field]) || 0;
      return tableSort.dir === 'desc' ? vb - va : va - vb;
    });
  }

  function buildTbody(rows) {
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    getSortedData(rows).forEach((row, index) => {
      const pos      = index + 1;
      const posClass = pos === 1 ? 'rank-gold' : pos === 2 ? 'rank-silver' : pos === 3 ? 'rank-bronze' : '';

      let nameCellContent;
      if (isPlayers) {
        nameCellContent = `
          <td class="team-cell">
            <span class="team-name-text">${escapeHTML(row.player_name || '—')}</span>
          </td>
        `;
      } else {
        const logo = row.team_logo;
        const logoHTML = logo
          ? `<img src="${escapeHTML(logo)}" alt="" class="team-logo-mini">`
          : `<span class="team-logo-mini-fallback">👥</span>`;
        nameCellContent = `
          <td class="team-cell">
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
        <td class="ranking-pos-col">
          <span class="ranking-pos-badge ${posClass}">${pos}</span>
        </td>
        ${nameCellContent}
        <td>${Number(row.presenze) || 0}</td>
        <td class="pct-col">${formatPct(row.pct_vittorie)}</td>
        ${golCells}
      `;

      tbody.appendChild(tr);
    });
  }

  function updateHeaderArrows() {
    table.querySelectorAll('th[data-sort]').forEach(th => {
      const field = th.dataset.sort;
      if (field === tableSort.field) {
        th.classList.add('sort-active');
        th.classList.toggle('sort-desc', tableSort.dir === 'desc');
        th.classList.toggle('sort-asc',  tableSort.dir === 'asc');
      } else {
        th.classList.remove('sort-active', 'sort-desc', 'sort-asc');
      }
    });
  }

  const table = document.createElement("table");
  table.className = "standings-table ranking-table";

  const nameHeader = isPlayers ? 'Giocatore' : 'Squadra';

  const colHeaders = columns.map(col => {
    if (col.sortable) {
      const isActive = col.key === tableSort.field;
      const dirClass = isActive ? (tableSort.dir === 'desc' ? ' sort-desc' : ' sort-asc') : '';
      return `<th data-sort="${col.key}" class="sortable-col${isActive ? ' sort-active' : ''}${dirClass}"><span class="sort-label">${col.label}</span></th>`;
    }
    return `<th>${col.label}</th>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr>
        <th class="ranking-pos-col">#</th>
        <th>${nameHeader}</th>
        ${colHeaders}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  table.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (tableSort.field === field) {
        tableSort.dir = tableSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        tableSort.field = field;
        tableSort.dir   = 'desc';
      }
      // Applica sort tenendo conto del filtro di ricerca attivo
      const query = searchInput ? normalize(searchInput.value) : '';
      const filtered = query
        ? data.filter(row => normalize(isPlayers ? row.player_name : row.team_name).includes(query))
        : data;
      buildTbody(filtered);
      updateHeaderArrows();
    });
  });

  buildTbody(data);

  container.innerHTML = "";
  container.appendChild(table);

  // ── Ricerca ──────────────────────────────────────────────────────
  const searchToggle = document.getElementById('ranking-search-toggle');
  const searchBar    = document.getElementById('ranking-search-bar');
  const searchInput  = document.getElementById('ranking-search-input');

  searchInput.value = '';
  searchBar.classList.add('hidden');

  // Rimuovi vecchi listener clonando i nodi
  const newToggle = searchToggle.cloneNode(true);
  searchToggle.parentNode.replaceChild(newToggle, searchToggle);
  const newInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newInput, searchInput);

  newToggle.addEventListener('click', () => {
    const isHidden = searchBar.classList.toggle('hidden');
    if (!isHidden) {
      newInput.focus();
    } else {
      newInput.value = '';
      buildTbody(data);
    }
  });

  newInput.addEventListener('input', () => {
    const query = normalize(newInput.value);
    if (!query) {
      buildTbody(data);
      return;
    }
    const filtered = data.filter(row => {
      const name = normalize(isPlayers ? row.player_name : row.team_name);
      return name.includes(query);
    });
    buildTbody(filtered);
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