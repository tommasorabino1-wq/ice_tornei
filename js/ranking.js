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
let currentType    = 'teams';   // 'teams' | 'players'
let currentOrderBy = 'pct_vittorie';


// ===============================
// HELPER: escapeHTML (identica a standings.js)
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
// HELPER: skeleton fade-out (identica a standings.js)
// ===============================
function fadeOutSkeleton(wrapper) {
  wrapper.classList.add("fade-out");
  setTimeout(() => { wrapper.classList.add("hidden"); }, 350);
}

// ===============================
// HELPER: Formato percentuale
// Es: 66.7 → "66.7%"
// ===============================
function formatPct(val) {
  const n = Number(val);
  if (isNaN(n)) return "0%";
  return `${n % 1 === 0 ? n : n.toFixed(1)}%`;
}

// ===============================
// HELPER: Opzioni orderBy in base a sport e tipo
// Restituisce array di { value, label }
// ===============================
function getOrderByOptions(sport, type) {
  const base = [
    { value: 'pct_vittorie', label: '% Vittorie' },
    { value: 'vittorie',     label: 'Vittorie'   },
    { value: 'presenze',     label: 'Presenze'   },
  ];

  // Gol: solo calcio, solo giocatori
  if (sport === 'calcio' && type === 'players') {
    base.push({ value: 'gol',       label: 'Gol'       });
    base.push({ value: 'media_gol', label: 'Media Gol' });
  }

  // Gol: solo calcio, squadre
  if (sport === 'calcio' && type === 'teams') {
    base.push({ value: 'gol', label: 'Gol' });
  }

  return base;
}

// ===============================
// HELPER: hasDraws per sport
// ===============================
function sportHasDraws(sport) {
  return sport === 'calcio' || sport === 'scacchi';
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadRanking();
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

      // Scacchi: forza tipo = players, nasconde tab squadre
      handleSubtabsVisibility();

      // Reset orderBy al default quando cambia sport
      currentOrderBy = 'pct_vittorie';

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

      // Reset orderBy al default quando cambia tipo
      currentOrderBy = 'pct_vittorie';

      loadRanking();
    });
  });

  // OrderBy select
  const orderBySelect = document.getElementById("ranking-orderby");
  if (orderBySelect) {
    orderBySelect.addEventListener("change", (e) => {
      currentOrderBy = e.target.value;
      loadRanking();
    });
  }
}

// ===============================
// HANDLE SUBTABS VISIBILITY
// Scacchi → mostra solo "Giocatori", nasconde "Squadre"
// ===============================
function handleSubtabsVisibility() {
  const teamsSubtab   = document.querySelector('.ranking-subtab[data-type="teams"]');
  const playersSubtab = document.querySelector('.ranking-subtab[data-type="players"]');

  if (currentSport === 'scacchi') {
    // Nasconde il tab squadre e forza giocatori
    if (teamsSubtab)   teamsSubtab.classList.add("hidden");
    if (playersSubtab) {
      playersSubtab.classList.remove("hidden");
      playersSubtab.classList.add("active");
      playersSubtab.setAttribute("aria-selected", "true");
    }
    currentType = 'players';
  } else {
    // Mostra entrambi, ripristina selezione corrente
    if (teamsSubtab)   teamsSubtab.classList.remove("hidden");
    if (playersSubtab) playersSubtab.classList.remove("hidden");

    // Se il currentType era rimasto 'players' per scacchi, resetta a 'teams'
    if (currentType === 'players' && currentSport !== 'scacchi') {
      // mantieni la selezione utente, non forzare reset
    }

    // Rispecchia il currentType nei tab
    document.querySelectorAll(".ranking-subtab").forEach(t => {
      const isActive = t.dataset.type === currentType;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", String(isActive));
    });
  }
}

// ===============================
// RENDER ORDERBY SELECT
// ===============================
function renderOrderBySelect(sport, type) {
  const select = document.getElementById("ranking-orderby");
  if (!select) return;

  const options = getOrderByOptions(sport, type);

  select.innerHTML = "";
  options.forEach(opt => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === currentOrderBy) el.selected = true;
    select.appendChild(el);
  });

  // Se currentOrderBy non è tra le opzioni valide per questo sport/tipo, reset al default
  const validValues = options.map(o => o.value);
  if (!validValues.includes(currentOrderBy)) {
    currentOrderBy = 'pct_vittorie';
    select.value = 'pct_vittorie';
  }
}

// ===============================
// LOAD RANKING
// ===============================
async function loadRanking() {
  const skeleton      = document.getElementById("ranking-skeleton");
  const placeholder   = document.getElementById("ranking-placeholder");
  const tableWrapper  = document.getElementById("ranking-table-wrapper");
  const tableTitle    = document.getElementById("ranking-table-title");

  // Reset UI
  skeleton.classList.remove("hidden", "fade-out");
  placeholder.classList.add("hidden");
  tableWrapper.classList.add("hidden");

  // Aggiorna orderBy select in base a sport/tipo corrente
  renderOrderBySelect(currentSport, currentType);

  // Aggiorna titolo box
  if (tableTitle) {
    const sportLabel  = getSportLabel(currentSport);
    const typeLabel   = currentType === 'teams' ? 'Squadre' : 'Giocatori';
    tableTitle.textContent = `Ranking ${typeLabel} — ${sportLabel}`;
  }

  try {
    const url = currentType === 'teams'
      ? `${API_URLS.getRankingTeams}?sport=${encodeURIComponent(currentSport)}&orderBy=${encodeURIComponent(currentOrderBy)}`
      : `${API_URLS.getRankingPlayers}?sport=${encodeURIComponent(currentSport)}&orderBy=${encodeURIComponent(currentOrderBy)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    fadeOutSkeleton(skeleton);

    if (!Array.isArray(data) || data.length === 0) {
      placeholder.classList.remove("hidden");
      return;
    }

    tableWrapper.classList.remove("hidden");
    renderRankingTable(data, currentSport, currentType);

  } catch (err) {
    console.error("Errore caricamento ranking:", err);
    fadeOutSkeleton(skeleton);
    placeholder.classList.remove("hidden");
  }
}

// ===============================
// RENDER RANKING TABLE
// ===============================
function renderRankingTable(data, sport, type) {
  const container   = document.getElementById("ranking-table-container");
  const isCalcio    = sport === 'calcio';
  const isChess     = sport === 'scacchi';
  const hasDraws    = isCalcio || isChess;
  const isPlayers   = type === 'players';

  // ── Colonne header ──────────────────────────────────────────────────────────
  let headers = [];

  if (isPlayers) {
    headers.push({ key: 'player_name', label: isChess ? 'Giocatore' : 'Giocatore' });
    if (!isChess) {
      // Per calcio/padel/beach: mostra anche la squadra di appartenenza
      headers.push({ key: 'team_name', label: 'Squadra' });
    }
  } else {
    headers.push({ key: 'team_name', label: 'Squadra' });
  }

  headers.push({ key: 'presenze',     label: 'PG'   });
  headers.push({ key: 'vittorie',     label: 'V'    });
  if (hasDraws) {
    headers.push({ key: 'pareggi',    label: isChess ? 'Patta' : 'N' });
  }
  headers.push({ key: 'sconfitte',    label: 'P'    });
  headers.push({ key: 'pct_vittorie', label: '% V'  });
  if (hasDraws) {
    headers.push({ key: 'pct_pareggi',  label: isChess ? '% Patta' : '% N' });
  }
  headers.push({ key: 'pct_sconfitte', label: '% P' });

  if (isCalcio) {
    if (isPlayers) {
      headers.push({ key: 'gol',       label: 'Gol'  });
      headers.push({ key: 'media_gol', label: 'xG'   });
    } else {
      headers.push({ key: 'gol',       label: 'Gol'  });
      headers.push({ key: 'media_gol', label: 'xG'   });
    }
  }

  // ── Costruisci tabella ──────────────────────────────────────────────────────
  const table = document.createElement("table");
  table.className = "standings-table ranking-table";

  // Thead
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th class="ranking-pos-col">#</th>
      ${headers.map(h => `<th data-key="${h.key}">${h.label}</th>`).join('')}
    </tr>
  `;
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement("tbody");

  data.forEach((row, index) => {
    const pos = index + 1;

    // Logo
    const logo = row.team_logo;
    const logoHTML = logo
      ? `<img src="${escapeHTML(logo)}" alt="" class="team-logo-mini">`
      : `<span class="team-logo-mini-fallback">${isPlayers ? '👤' : '👥'}</span>`;

    // Prima cella: nome entità con logo
    const nameValue = isPlayers ? (row.player_name || '—') : (row.team_name || '—');
    const nameCellHTML = `
      <td class="team-cell">
        <span class="rank-badge">${pos}</span>
        ${logoHTML}
        <span class="team-name-text">${escapeHTML(nameValue)}</span>
      </td>
    `;

    // Cella squadra (solo giocatori non-scacchi)
    const teamCellHTML = (isPlayers && !isChess)
      ? `<td class="ranking-team-ref">${escapeHTML(row.team_name || '—')}</td>`
      : '';

    // Statistiche base
    const presenze    = Number(row.presenze)     || 0;
    const vittorie    = Number(row.vittorie)      || 0;
    const pareggi     = Number(row.pareggi)       || 0;
    const sconfitte   = Number(row.sconfitte)     || 0;
    const pctV        = formatPct(row.pct_vittorie);
    const pctP        = formatPct(row.pct_pareggi);
    const pctS        = formatPct(row.pct_sconfitte);

    // Gol (solo calcio)
    const golHTML = isCalcio
      ? `<td>${Number(row.gol) || 0}</td><td>${Number(row.media_gol) ? Number(row.media_gol).toFixed(2) : '0.00'}</td>`
      : '';

    const tr = document.createElement("tr");

    // Badge posizione (top 3 evidenziati)
    const posClass = pos === 1 ? 'rank-gold' : pos === 2 ? 'rank-silver' : pos === 3 ? 'rank-bronze' : '';
    if (posClass) tr.classList.add(posClass);

    tr.innerHTML = `
      <td class="ranking-pos-col"><span class="ranking-pos-badge ${posClass}">${pos}</span></td>
      ${nameCellHTML}
      ${teamCellHTML}
      <td>${presenze}</td>
      <td>${vittorie}</td>
      ${hasDraws ? `<td>${pareggi}</td>` : ''}
      <td>${sconfitte}</td>
      <td class="pct-col">${pctV}</td>
      ${hasDraws ? `<td class="pct-col">${pctP}</td>` : ''}
      <td class="pct-col">${pctS}</td>
      ${golHTML}
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
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