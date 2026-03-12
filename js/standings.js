// ===============================
// HAMBURGER MENU TOGGLE
// ===============================
const menuToggle = document.querySelector(".mobile-menu-toggle");
const mainNavEl = document.querySelector(".main-nav");

if (menuToggle && mainNavEl) {
  menuToggle.addEventListener("click", () => {
    menuToggle.classList.toggle("active");
    mainNavEl.classList.toggle("active");

    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
  });
}

// ===============================
// STANDINGS JS (READ-ONLY VERSION)
// ===============================

// ===============================
// API URLS (FIREBASE FUNCTIONS)
// ===============================
const API_URLS = {
  getTournaments: "https://gettournaments-dzvezz2yhq-uc.a.run.app",
  getStandings: "https://getstandings-dzvezz2yhq-uc.a.run.app",
  getMatches: "https://getmatches-dzvezz2yhq-uc.a.run.app",
  getFinals: "https://getfinals-dzvezz2yhq-uc.a.run.app",
  getBracket: "https://getbracket-dzvezz2yhq-uc.a.run.app",
  getTeamsLogosMap: "https://getteamslogosmap-dzvezz2yhq-uc.a.run.app"
};

// ===============================
// GLOBAL STATE
// ===============================
let TOURNAMENT_STATUS = null;
let TOURNAMENT_FORMAT = null;
let TOURNAMENT_SPORT = null;
let TOURNAMENT_IS_INDIVIDUAL = false;
let TOURNAMENT_MATCH_FORMAT_GIRONI = null;
let TOURNAMENT_MATCH_FORMAT_FINALS = null;
let TOURNAMENT_HAS_3X4 = false;
let currentTournamentData = null;
let ALL_MATCHES = [];
let ALL_STANDINGS = [];
let AVAILABLE_ROUNDS = [];
let FINALS_MATCHES = [];
let FINALS_SELECTED_ROUND_ID = null;
let teamsLogosMap = {};


// ===============================
// ELEMENTI DOM
// ===============================
const standingsSelectSection = document.getElementById("standings-select-section");
const standingsSpecificSection = document.getElementById("standings-specific-section");
const standingsTournamentSelect = document.getElementById("standings-tournament-select");


// ===============================
// HELPER: Match profile (sport + format)
// ===============================
function getMatchProfile(sport, matchFormat) {
  const s = String(sport || '').toLowerCase().trim();
  const f = String(matchFormat || '').toLowerCase().trim();

  const isChess     = s.includes('scacchi') || s.includes('chess');
  const isSetBased  = f.includes('su'); // 1su1, 2su3, 3su5
  const isCalcio    = !isChess && (s.includes('calcio') || s.includes('football') || s.includes('soccer'));
  const isPadel     = s.includes('padel');
  const isBeach     = s.includes('beach') || s.includes('volley');

  // sport normalizzato (compatibilità con codice esistente)
  let normalizedSport = 'calcio';
  if (isChess)      normalizedSport = 'scacchi';
  else if (isPadel) normalizedSport = 'padel';
  else if (isBeach) normalizedSport = 'beach_volley';

  return { isChess, isSetBased, isCalcio, isPadel, isBeach, normalizedSport };
}


// ===============================
// HELPER: Ottieni label per lo sport
// ===============================
function getSportLabels(profile) {
  if (profile.isChess) {
    return { scoreLabel: 'Punti', forLabel: 'Pts', drawLabel: 'Patta' };
  }
  if (profile.isCalcio) {
    return { scoreLabel: 'Gol', forLabel: 'GF', againstLabel: 'GS', diffLabel: 'Diff' };
  }
  if (profile.isSetBased) {
    return {
      scoreLabel: 'Set',
      forLabel: 'SF',
      againstLabel: 'SS',
      diffLabel: 'DS',
      gamesForLabel: 'GmF',
      gamesAgainstLabel: 'GmS',
      gamesDiffLabel: 'DG'
    };
  }
  // padel / beach volley game-based
  return { scoreLabel: 'Game', forLabel: 'GmF', againstLabel: 'GmS', diffLabel: 'Diff' };
}



// ===============================
// SKELETON HELPERS
// ===============================
function fadeOutSkeleton(wrapper) {
  wrapper.classList.add("fade-out");
  setTimeout(() => { wrapper.classList.add("hidden"); }, 350);
}

// ===============================
// CHECK IF FORMAT HAS FINALS
// ===============================
function formatHasFinals(formatType) {
  const formatsWithFinals = ['round_robin_finals', 'double_round_robin_finals'];
  return formatsWithFinals.includes(String(formatType || '').toLowerCase());
}

// ===============================
// LOAD STANDINGS PAGE
// ===============================
async function loadStandingsPage(tournamentId) {
  try {
    const tournamentsRes = await fetch(API_URLS.getTournaments);
    if (!tournamentsRes.ok) throw new Error(`HTTP error! status: ${tournamentsRes.ok}`);
    const tournaments = await tournamentsRes.json();

    const t = tournaments.find(t => t.tournament_id === tournamentId);
    if (!t) {
      showTournamentNotFound();
      return;
    }

    TOURNAMENT_STATUS = t?.status || null;
    TOURNAMENT_FORMAT = t?.format_type || null;
    TOURNAMENT_SPORT = getMatchProfile(t?.sport, t?.match_format_gironi).normalizedSport;
    TOURNAMENT_IS_INDIVIDUAL = String(t?.individual_or_team || '').toLowerCase() === 'individual';
    TOURNAMENT_MATCH_FORMAT_GIRONI = String(t?.match_format_gironi || '').toLowerCase();
    TOURNAMENT_MATCH_FORMAT_FINALS = String(t?.match_format_finals || '').toLowerCase();
    TOURNAMENT_HAS_3X4 = t?.['3_4_posto'] === true;

    const tournamentProfile = getMatchProfile(t?.sport, t?.match_format_gironi);
    const gironiIcon = document.getElementById("gironi-section-icon");
    if (gironiIcon) {
      if (tournamentProfile.isChess)      gironiIcon.textContent = '♟️';
      else if (tournamentProfile.isBeach) gironiIcon.textContent = '🏐';
      else if (tournamentProfile.isPadel) gironiIcon.textContent = '🎾';
      else                                gironiIcon.textContent = '⚽';
    }

    try {
      const logosRes = await fetch(`${API_URLS.getTeamsLogosMap}?tournament_id=${encodeURIComponent(tournamentId)}`);
      if (logosRes.ok) {
        teamsLogosMap = await logosRes.json();
      }
    } catch (err) {
      console.error('Failed to load logos:', err);
      teamsLogosMap = {};
    }

    if (TOURNAMENT_STATUS === "open") {
      showTournamentNotStarted(t);
      return;
    }

    renderStandingsHeader(t);

    const layout = document.querySelector(".standings-layout");
    if (layout) {
      layout.classList.toggle("finished", TOURNAMENT_STATUS === "finished");
    }

    loadMatches(tournamentId);
    loadStandings(tournamentId);

    if (formatHasFinals(TOURNAMENT_FORMAT)) {
      if (TOURNAMENT_STATUS === "final_phase" || TOURNAMENT_STATUS === "finished") {
        loadFinalsBracket(tournamentId).then(bracket => {
          if (bracket) renderFinalsBracket(bracket);
          applyLayoutByStatus();
        });
      } else {
        FINALS_MATCHES = [];
        applyLayoutByStatus();
      }
    } else {
      FINALS_MATCHES = [];
      applyLayoutByStatus();
    }
  } catch (err) {
    console.error("Errore caricamento tornei:", err);
  }
}

// ===============================
// RENDER STANDINGS HEADER
// ===============================
function renderStandingsHeader(tournament) {
  const titleEl = document.getElementById("standings-tournament-title");
  const subtitleEl = document.getElementById("standings-tournament-subtitle");
  if (titleEl) titleEl.textContent = `Classifica ${tournament.name}`;
  if (subtitleEl) subtitleEl.textContent = `${tournament.location} · ${tournament.date} · ${tournament.sport}`;
}

function hideSkeletons() {
  document.querySelectorAll(".standings-skeleton").forEach(s => s.classList.add("hidden"));
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const tournamentId = getTournamentIdFromUrl();

  if (tournamentId) {
    standingsSelectSection.classList.add("hidden");
    standingsSpecificSection.classList.remove("hidden");
    document.querySelector(".standings-results-box-fullwidth")?.classList.add("loading");
    loadStandingsPage(tournamentId);
  } else {
    standingsSelectSection.classList.remove("hidden");
    standingsSpecificSection.classList.add("hidden");
    hideSkeletons();
    loadTournamentSelect();
  }
});

// ===============================
// GET TOURNAMENT ID
// ===============================
function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tournament_id");
}

// ===============================
// LOAD TOURNAMENT SELECT
// ===============================
function loadTournamentSelect() {
  fetch(API_URLS.getTournaments)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(tournaments => {
      if (!Array.isArray(tournaments)) throw new Error("Formato dati non valido");

      standingsTournamentSelect.innerHTML = `<option value="">Seleziona un torneo</option>`;
      tournaments.forEach(t => {
        const option = document.createElement("option");
        option.value = t.tournament_id;
        option.textContent = `${t.name} · ${t.date}`;
        standingsTournamentSelect.appendChild(option);
      });

      standingsTournamentSelect.onchange = function () {
        if (!this.value) return;
        window.location.href = `/classifica?tournament_id=${this.value}`;
      };
    })
    .catch(err => {
      console.error("Errore caricamento tornei:", err);
      showToast("Errore nel caricamento dei tornei ❌");
    });
}

// ===============================
// TOURNAMENT NOT STARTED
// ===============================
function showTournamentNotStarted(tournament) {
  hideSkeletons();
  const specificSection = document.getElementById("standings-specific-section");

  const isIndividual = String(tournament.individual_or_team || '').toLowerCase() === 'individual';
  const entityIcon  = isIndividual ? '👤' : '👥';
  const entityLabel = isIndividual ? 'giocatori iscritti' : 'squadre iscritte';

  specificSection.innerHTML = `
    <div class="standings-not-started">
      <div class="standings-not-started-icon">🏁</div>
      <h3>Torneo non ancora iniziato</h3>
      <p class="tournament-name-label">${escapeHTML(tournament.name)}</p>
      <p class="tournament-info-text">
        Il torneo inizierà a <strong>${escapeHTML(tournament.date)}</strong>.<br>
        Classifiche, risultati e tabellone saranno disponibili non appena verranno disputate le prime partite.
      </p>
      <div class="standings-not-started-actions">
        <a href="/regolamento?tournament_id=${tournament.tournament_id}" class="btn secondary">
        <a href="/classifica" class="btn secondary">← Torna alla selezione</a>
      </div>
      <div class="standings-not-started-info">
        <div class="info-item"><span class="info-icon">📍</span><span>${escapeHTML(tournament.location)}</span></div>
        <div class="info-item"><span class="info-icon">${entityIcon}</span><span>${tournament.teams_current} / ${tournament.teams_max} ${entityLabel}</span></div>
        <div class="info-item"><span class="info-icon">🏐</span><span>${escapeHTML(tournament.sport)}</span></div>
      </div>
    </div>
  `;
  specificSection.classList.remove("hidden");
}


// ===============================
// TOURNAMENT NOT FOUND
// ===============================
function showTournamentNotFound() {
  hideSkeletons();
  const specificSection = document.getElementById("standings-specific-section");
  specificSection.innerHTML = `
    <div class="standings-not-found">
      <div class="standings-not-found-icon">❓</div>
      <h3>Torneo non trovato</h3>
      <p>Il torneo richiesto non esiste o è stato rimosso.</p>
      <a href="/classifica" class="btn secondary">← Torna alla selezione tornei</a>
    </div>
  `;
  specificSection.classList.remove("hidden");
}

// ===============================
// LOAD MATCHES
// ===============================
function loadMatches(tournamentId) {
  const skeleton = document.getElementById("matches-skeleton");
  const list = document.getElementById("matches-list");

  list.innerHTML = "";

  const url = `${API_URLS.getMatches}?tournament_id=${encodeURIComponent(tournamentId)}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(matches => {
      fadeOutSkeleton(skeleton);

      ALL_MATCHES = Array.isArray(matches) ? matches : [];
      AVAILABLE_ROUNDS = [
        ...new Set(ALL_MATCHES.map(m => Number(m.round_id)).filter(Boolean))
      ].sort((a, b) => a - b);

      renderRoundFilter(AVAILABLE_ROUNDS, getMatchProfile(TOURNAMENT_SPORT, TOURNAMENT_MATCH_FORMAT_GIRONI));
      renderMatchesByRound(AVAILABLE_ROUNDS[0]);

      document.querySelector(".standings-results-box-fullwidth")?.classList.remove("loading");
    })
    .catch(err => {
      console.error("Errore caricamento match:", err);
      list.innerHTML = "<p class='error'>Errore caricamento match</p>";
    });
}

// ===============================
// RENDER MATCHES BY ROUND
// ===============================
function renderMatchesByRound(roundId) {
  const container = document.getElementById("matches-list");
  container.innerHTML = "";

  const matches = ALL_MATCHES.filter(m => Number(m.round_id) === Number(roundId));

  if (matches.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match per questa giornata</p>";
    return;
  }

  const profile = getMatchProfile(TOURNAMENT_SPORT, TOURNAMENT_MATCH_FORMAT_GIRONI);
  matches.forEach(match => {
    const card = renderMatchCard(match, profile.isSetBased, false, TOURNAMENT_IS_INDIVIDUAL);
    container.appendChild(card);
  });
}



// ===============================
// RENDER MATCH CARD (UNIFIED)
// ===============================
function renderMatchCard(match, isSetBased, isFinals, isIndividual = false, roundLabel = null) {
  const card = document.createElement("div");
  card.className = "match-card";
  if (isFinals) card.classList.add("finals");

  const isPlayed = match.played === true || String(match.played).toUpperCase() === "TRUE";
  if (isPlayed) card.classList.add("played");

  const teamAName = match.team_a_name || (match.team_a ? formatTeam(match.team_a) : "TBD");
  const teamBName = match.team_b_name || (match.team_b ? formatTeam(match.team_b) : "TBD");
  const isTbd = !match.team_a || !match.team_b;

  if (isTbd) card.classList.add("tbd");

  const court = match.court || "none";
  const day = match.day || "none";
  const hour = match.hour || "none";
  const hasDetails = court !== "none" || day !== "none" || hour !== "none";

  const collapseId = `match-details-${match.match_id || match.final_id}`;
  const scoreA = isPlayed ? (match.score_a ?? "-") : "-";
  const scoreB = isPlayed ? (match.score_b ?? "-") : "-";

  let winnerTeamId = null;
  let isDraw = false;

  if (isPlayed) {
    const numA = Number(match.score_a);
    const numB = Number(match.score_b);
    if (match.winner_team_id) {
      winnerTeamId = match.winner_team_id;
      isDraw = numA === numB;
    } else if (numA > numB) {
      winnerTeamId = match.team_a;
    } else if (numB > numA) {
      winnerTeamId = match.team_b;
    }
  }

  const teamAClass = winnerTeamId === match.team_a ? "winner" : (winnerTeamId === match.team_b ? "loser" : "");
  const teamBClass = winnerTeamId === match.team_b ? "winner" : (winnerTeamId === match.team_a ? "loser" : "");

  const setsDetail = match.sets_detail || null;
  const showSetsDetail = isSetBased && isPlayed && setsDetail;

  const fallbackIcon = isIndividual ? '👤' : '👥';

  let metaInfo;
  if (isFinals) {
    if (match.is_third_place_match) {
      metaInfo = `<span class="meta-item meta-round meta-3x4">Finale 3°/4° Posto</span>`;
    } else {
      metaInfo = `<span class="meta-item meta-round">${escapeHTML(roundLabel || 'Fase Finale')}</span>`;
    }
  } else {
    metaInfo = `<span class="meta-item meta-group">Girone ${escapeHTML(match.group_id || "?")}</span>`;
  }

  const logoA = teamsLogosMap[match.team_a];
  const logoB = teamsLogosMap[match.team_b];

  const logoAHTML = logoA
    ? `<img src="${escapeHTML(logoA)}" alt="" class="team-logo-match">`
    : `<span class="team-logo-match-fallback">${fallbackIcon}</span>`;

  const logoBHTML = logoB
    ? `<img src="${escapeHTML(logoB)}" alt="" class="team-logo-match">`
    : `<span class="team-logo-match-fallback">${fallbackIcon}</span>`;

  // Pannello info: se giocata mostra set details (se presenti), altrimenti campo/giorno/ora
  let infoPanelContent;
  if (isPlayed) {
    if (showSetsDetail) {
      infoPanelContent = `
        <div class="match-details-sets">
          <span class="detail-icon">🎯</span>
          ${formatSetsDetail(setsDetail)}
        </div>
      `;
    } else if (hasDetails) {
      infoPanelContent = `
        <div class="match-details-grid">
          ${court !== "none" ? `<div class="match-detail-item"><span class="detail-icon">🥅</span><span class="detail-value">${escapeHTML(court)}</span></div>` : ''}
          ${day !== "none" ? `<div class="match-detail-item"><span class="detail-icon">📅</span><span class="detail-value">${escapeHTML(day)}</span></div>` : ''}
          ${hour !== "none" ? `<div class="match-detail-item"><span class="detail-icon">🕐</span><span class="detail-value">${escapeHTML(hour)}</span></div>` : ''}
        </div>
      `;
    } else {
      infoPanelContent = `
        <div class="match-details-pending">
          <span class="pending-icon">📋</span>
          <span class="pending-text">Nessun dettaglio aggiuntivo disponibile</span>
        </div>
      `;
    }
  } else {
    infoPanelContent = hasDetails ? `
      <div class="match-details-grid">
        ${court !== "none" ? `<div class="match-detail-item"><span class="detail-icon">🥅</span><span class="detail-value">${escapeHTML(court)}</span></div>` : ''}
        ${day !== "none" ? `<div class="match-detail-item"><span class="detail-icon">📅</span><span class="detail-value">${escapeHTML(day)}</span></div>` : ''}
        ${hour !== "none" ? `<div class="match-detail-item"><span class="detail-icon">🕐</span><span class="detail-value">${escapeHTML(hour)}</span></div>` : ''}
      </div>
    ` : `
      <div class="match-details-pending">
        <span class="pending-icon">⏳</span>
        <span class="pending-text">Campo, giorno e orario ancora da definire</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="match-card-inner">
      <div class="match-main">
        <div class="match-team match-team-a ${teamAClass}${isTbd ? ' tbd' : ''}">
          ${logoAHTML}
          <span class="team-name">${escapeHTML(teamAName)}</span>
        </div>
        <div class="match-score-block">
          <span class="score score-a">${scoreA}</span>
          <span class="score-separator">:</span>
          <span class="score score-b">${scoreB}</span>
        </div>
        <div class="match-team match-team-b ${teamBClass}${isTbd ? ' tbd' : ''}">
          <span class="team-name team-name-b">${escapeHTML(teamBName)}</span>
          ${logoBHTML}
        </div>
      </div>

      ${isDraw && winnerTeamId && isFinals ? `
        <div class="match-tiebreaker">
          <span class="tiebreaker-icon">⚡</span>
          <span class="tiebreaker-text">Spareggio: <strong>${escapeHTML(winnerTeamId === match.team_a ? teamAName : teamBName)}</strong></span>
        </div>
      ` : ''}

      <div class="match-card-footer">
        <div class="match-meta-inline">${metaInfo}</div>
        <div class="match-actions">
          <button class="match-details-toggle" aria-expanded="false" aria-controls="${collapseId}">
            <span class="toggle-icon">+</span>
            <span class="toggle-text">Info</span>
          </button>
        </div>
      </div>
    </div>

    <div id="${collapseId}" class="match-details-panel" hidden>
      ${infoPanelContent}
    </div>
  `;

  const toggleBtn = card.querySelector(".match-details-toggle");
  const panel = card.querySelector(".match-details-panel");
  toggleBtn.addEventListener("click", () => {
    const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", !isExpanded);
    panel.hidden = isExpanded;
  });

  return card;
}




// ===============================
// FORMAT SETS DETAIL
// ===============================
function formatSetsDetail(setsDetail) {
  if (!setsDetail) return '';
  const sets = setsDetail.split(',').map(s => s.trim());
  return `
    <div class="sets-badges">
      ${sets.map(set => `<span class="set-badge">${escapeHTML(set)}</span>`).join('')}
    </div>
  `;
}

function onRoundChange(value) {
  if (!value) return;
  renderMatchesByRound(Number(value));
}

// ===============================
// LOAD STANDINGS
// ===============================
function loadStandings(tournamentId) {
  const skeleton = document.querySelector(".standings-table-box-fullwidth .standings-skeleton");
  const standingsEl = document.getElementById("standings");

  standingsEl.innerHTML = "";
  standingsEl.classList.remove("hidden");

  const url = `${API_URLS.getStandings}?tournament_id=${encodeURIComponent(tournamentId)}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      fadeOutSkeleton(skeleton);
      ALL_STANDINGS = Array.isArray(data) ? data : [];
      renderStandings(data);
      handlePodiumRendering();
    })
    .catch(err => {
      console.error("Errore caricamento standings:", err);
      standingsEl.innerHTML = "<p class='error'>Errore caricamento classifica</p>";
    });
}

// ===============================
// HELPERS
// ===============================
function formatTeam(teamId) {
  return teamId.split("_").slice(1).join(" ");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 2500);
}

// ===============================
// RENDER STANDINGS (DYNAMIC)
// ===============================
function renderStandings(data) {
  const standingsEl = document.getElementById("standings");

  if (!Array.isArray(data) || data.length === 0) {
    standingsEl.innerHTML = "<p class='placeholder'>Nessuna classifica disponibile</p>";
    return;
  }

  const sport       = data[0]?.sport || TOURNAMENT_SPORT;
  const matchFormat = data[0]?.match_format_gironi || TOURNAMENT_MATCH_FORMAT_GIRONI;
  const profile     = getMatchProfile(sport, matchFormat);
  const labels      = getSportLabels(profile);
  const isIndividual = TOURNAMENT_IS_INDIVIDUAL;
  const fallbackIcon = isIndividual ? '👤' : '👥';
  const entityLabel  = isIndividual ? 'Giocatore' : 'Squadra';

  const groupsMap = {};
  data.forEach(row => {
    const gid = row.group_id || "G?";
    if (!groupsMap[gid]) groupsMap[gid] = [];
    groupsMap[gid].push(row);
  });

  const groupSort = (a, b) => {
    const na = parseInt(String(a).replace(/[^\d]/g, ""), 10) || 0;
    const nb = parseInt(String(b).replace(/[^\d]/g, ""), 10) || 0;
    return na - nb;
  };

  standingsEl.innerHTML = "";

  Object.keys(groupsMap).sort(groupSort).forEach(groupId => {
    const teams = groupsMap[groupId];
    const group = document.createElement("div");
    group.className = "standings-group";

    const logoHTML = (team) => {
      const logo = teamsLogosMap[team.team_id];
      return logo
        ? `<img src="${escapeHTML(logo)}" alt="" class="team-logo-mini">`
        : `<span class="team-logo-mini-fallback">${fallbackIcon}</span>`;
    };

    if (profile.isChess) {
      group.innerHTML = `
        <h3 class="standings-title">Girone ${escapeHTML(groupId)}</h3>
        <table class="standings-table standings-table-chess">
          <thead>
            <tr>
              <th>${entityLabel}</th><th>Pts</th><th>PG</th><th>V</th><th>Patta</th><th>P</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => `
              <tr>
                <td class="team-cell">
                  <span class="rank-badge">${team.rank_level}</span>
                  ${logoHTML(team)}
                  <span class="team-name-text">${escapeHTML(team.team_name || "")}</span>
                </td>
                <td>${formatChessPoints(team.points)}</td>
                <td>${Number(team.matches_played) || 0}</td>
                <td>${Number(team.wins) || 0}</td>
                <td>${Number(team.draws) || 0}</td>
                <td>${Number(team.losses) || 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else if (profile.isSetBased) {
      group.innerHTML = `
        <h3 class="standings-title">Girone ${escapeHTML(groupId)}</h3>
        <table class="standings-table standings-table-set">
          <thead>
            <tr>
              <th>${entityLabel}</th><th>Pts</th><th>PG</th><th>V</th><th>P</th>
              <th>${labels.forLabel}</th><th>${labels.againstLabel}</th><th>${labels.diffLabel}</th>
              <th>${labels.gamesForLabel}</th><th>${labels.gamesAgainstLabel}</th><th>${labels.gamesDiffLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => `
              <tr>
                <td class="team-cell">
                  <span class="rank-badge">${team.rank_level}</span>
                  ${logoHTML(team)}
                  <span class="team-name-text">${escapeHTML(team.team_name || "")}</span>
                </td>
                <td>${Number(team.points) || 0}</td>
                <td>${Number(team.matches_played) || 0}</td>
                <td>${Number(team.wins) || 0}</td>
                <td>${Number(team.losses) || 0}</td>
                <td>${Number(team.sets_for) || 0}</td>
                <td>${Number(team.sets_against) || 0}</td>
                <td>${formatDiff(team.set_diff)}</td>
                <td>${Number(team.games_for) || 0}</td>
                <td>${Number(team.games_against) || 0}</td>
                <td>${formatDiff(team.game_diff)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      group.innerHTML = `
        <h3 class="standings-title">Girone ${escapeHTML(groupId)}</h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th>${entityLabel}</th><th>Pts</th><th>PG</th><th>V</th><th>N</th><th>P</th>
              <th>${labels.forLabel}</th><th>${labels.againstLabel}</th><th>${labels.diffLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => `
              <tr>
                <td class="team-cell">
                  <span class="rank-badge">${team.rank_level}</span>
                  ${logoHTML(team)}
                  <span class="team-name-text">${escapeHTML(team.team_name || "")}</span>
                </td>
                <td>${Number(team.points) || 0}</td>
                <td>${Number(team.matches_played) || 0}</td>
                <td>${Number(team.wins) || 0}</td>
                <td>${Number(team.draws) || 0}</td>
                <td>${Number(team.losses) || 0}</td>
                <td>${Number(team.goals_for) || 0}</td>
                <td>${Number(team.goals_against) || 0}</td>
                <td>${formatDiff(team.goal_diff)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    standingsEl.appendChild(group);
  });
}




// ===============================
// FORMAT CHESS POINTS
// ===============================
function formatChessPoints(val) {
  const n = Number(val);
  if (isNaN(n)) return '0';
  // Mostra decimale solo se necessario (es. 1.5, 0.5 — non 1.0, 2.0)
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}


// ===============================
// FORMAT DIFF
// ===============================
function formatDiff(diff) {
  const n = Number(diff) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderRoundFilter(rounds, profile) {
  const select = document.getElementById("round-filter");
  if (!select || !Array.isArray(rounds)) return;

  const isChess = profile?.isChess || false;
  const roundWord = isChess ? 'Turno' : 'Giornata';

  const label = document.getElementById("round-filter-label");
  if (label) label.textContent = `Seleziona ${roundWord}`;

  select.innerHTML = "";
  rounds.forEach((round, index) => {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = `${roundWord} ${round}`;
    if (index === 0) option.selected = true;
    select.appendChild(option);
  });

  if (select.dataset.initialized === "true") return;
  select.dataset.initialized = "true";
  select.addEventListener("change", e => { onRoundChange(e.target.value); });
}

function renderFinalsRoundFilter(rounds, bracket) {
  const select = document.getElementById("finals-round-filter");
  if (!select || !Array.isArray(rounds)) return;

  select.innerHTML = "";
  rounds.forEach(roundId => {
    const matchCount = (bracket.rounds?.[roundId] || []).length;
    const label = getRoundLabel(matchCount);

    const option = document.createElement("option");
    option.value = roundId;
    option.textContent = label;
    if (Number(roundId) === Number(FINALS_SELECTED_ROUND_ID)) option.selected = true;
    select.appendChild(option);
  });

  if (select.dataset.initialized === "true") return;
  select.dataset.initialized = "true";
  select.addEventListener("change", e => { onFinalsRoundChange(e.target.value); });
}

function onFinalsRoundChange(value) {
  if (!value) return;
  FINALS_SELECTED_ROUND_ID = Number(value);
  const tournamentId = getTournamentIdFromUrl();
  if (!tournamentId) return;
  loadFinalsBracket(tournamentId).then(bracket => {
    if (bracket) renderFinalsBracket(bracket);
  });
}

function renderFinalsMatchesByRound(roundId, bracket) {
  const container = document.getElementById("finals-bracket-content");
  if (!container) return;

  container.innerHTML = "";

  const matchesInRound = bracket.rounds?.[roundId] || [];
  const roundLabel = getRoundLabel(matchesInRound.length);
  const profile = getMatchProfile(TOURNAMENT_SPORT, TOURNAMENT_MATCH_FORMAT_FINALS);

  if (matchesInRound.length === 0 && !bracket.thirdPlaceMatch) {
    container.innerHTML = "<p class='placeholder'>Nessun match per questa fase</p>";
    return;
  }

  if (matchesInRound.length > 0) {
    const roundBox = document.createElement("div");
    roundBox.className = "finals-round";
    roundBox.innerHTML = `<h3>${escapeHTML(roundLabel)}</h3>`;
    matchesInRound.forEach(match => {
      const card = renderMatchCard(match, profile.isSetBased, true, TOURNAMENT_IS_INDIVIDUAL, roundLabel);
      roundBox.appendChild(card);
    });
    container.appendChild(roundBox);
  }

  if (bracket.thirdPlaceMatch) {
    const maxRound = Math.max(...Object.keys(bracket.rounds).map(Number));
    if (Number(roundId) === maxRound) {
      const thirdBox = document.createElement("div");
      thirdBox.className = "finals-round finals-third-place";
      thirdBox.innerHTML = `<h3>Finale 3°/4° Posto</h3>`;
      const card = renderMatchCard(bracket.thirdPlaceMatch, profile.isSetBased, true, TOURNAMENT_IS_INDIVIDUAL, "Finale 3°/4° Posto");
      thirdBox.appendChild(card);
      container.appendChild(thirdBox);
    }
  }
}


function loadFinalsBracket(tournamentId) {
  const url = `${API_URLS.getBracket}?tournament_id=${encodeURIComponent(tournamentId)}`;

  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      return data && data.rounds ? data : null;
    })
    .catch(err => {
      console.error("Errore caricamento bracket:", err);
      return null;
    });
}

// ===============================
// APPLY LAYOUT BY STATUS
// ===============================
function applyLayoutByStatus() {
  const finalsSection = document.getElementById("finals-container");
  const podiumWrapper = document.getElementById("podium-subsection-wrapper");

  finalsSection.classList.add("hidden");
  if (podiumWrapper) podiumWrapper.classList.add("hidden");

  const hasFinals = formatHasFinals(TOURNAMENT_FORMAT);

  if (hasFinals && (TOURNAMENT_STATUS === "final_phase" || TOURNAMENT_STATUS === "finished")) {
    finalsSection.classList.remove("hidden");

    if (TOURNAMENT_STATUS === "finished" && podiumWrapper) {
      podiumWrapper.classList.remove("hidden");
    }
  }
}

// ===============================
// ROUND LABEL
// ===============================
function getRoundLabel(matchCount) {
  switch (matchCount) {
    case 16: return "Sedicesimi di Finale";
    case 8:  return "Ottavi di Finale";
    case 4:  return "Quarti di Finale";
    case 2:  return "Semifinali";
    case 1:  return "Finale";
    default: return `Round (${matchCount} partite)`;
  }
}

// ===============================
// RENDER FINALS BRACKET (ORCHESTRATOR)
// ===============================
function renderFinalsBracket(bracket) {
  const container = document.getElementById("finals-bracket-content");
  const visualContainer = document.getElementById("finals-bracket-visual");

  if (!container) return;

  const finalsSkeleton = document.querySelector(".finals-section .finals-skeleton");
  if (finalsSkeleton) finalsSkeleton.classList.add("hidden");

  const rounds = Object.keys(bracket.rounds)
    .map(Number)
    .sort((a, b) => a - b);

  if (rounds.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match disponibile</p>";
    if (visualContainer) visualContainer.innerHTML = "";
    return;
  }

  if (FINALS_SELECTED_ROUND_ID === null || !rounds.includes(Number(FINALS_SELECTED_ROUND_ID))) {
    FINALS_SELECTED_ROUND_ID = rounds[0];
  }

  renderFinalsRoundFilter(rounds, bracket);
  renderFinalsMatchesByRound(FINALS_SELECTED_ROUND_ID, bracket);

  if (visualContainer) {
    renderBracketVisual(bracket, visualContainer);
  }
}

// ===============================
// RENDER BRACKET VISUAL (router)
// ===============================
function renderBracketVisual(bracket, container) {
  renderBracketSVG(bracket, container);
}

// ===============================
// HANDLE PODIUM RENDERING
// ===============================
function handlePodiumRendering() {
  if (TOURNAMENT_STATUS === "finished" && ALL_STANDINGS.length > 0) {
    callPodiumRenderer();
  }
}

// ===============================
// CALL PODIUM RENDERER
// ===============================
function callPodiumRenderer() {
  const container = document.getElementById("podium-svg-container");
  const skeleton = document.getElementById("podium-skeleton");

  if (!container) return;

  if (skeleton) {
    fadeOutSkeleton(skeleton);
  }

  const sport       = ALL_STANDINGS[0]?.sport || TOURNAMENT_SPORT;
  const matchFormat = ALL_STANDINGS[0]?.match_format_gironi || TOURNAMENT_MATCH_FORMAT_GIRONI;
  const profile     = getMatchProfile(sport, matchFormat);

  const podiumData = {
    standings: ALL_STANDINGS,
    isSetBased: profile.isSetBased,
    isChess: profile.isChess,
    isIndividual: TOURNAMENT_IS_INDIVIDUAL,
    sport: profile.normalizedSport,
    teamsLogosMap: teamsLogosMap
  };

  if (typeof window.renderPodiumSVG === 'function') {
    window.renderPodiumSVG(podiumData, container);
  } else {
    console.warn('podium-svg-renderer.js non caricato');
  }
}