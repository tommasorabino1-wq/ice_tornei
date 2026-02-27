// ===============================
// STANDINGS JS (READ-ONLY VERSION)
// ===============================

// ===============================
// API URLS (FIREBASE FUNCTIONS)
// ===============================
const API_URLS = {
  getTournaments: "https://gettournaments-dzvezz2yhq-uc.a.run.app",
  getMatches: "https://getmatches-dzvezz2yhq-uc.a.run.app",
  getStandings: "https://getstandings-dzvezz2yhq-uc.a.run.app",
  getFinals: "https://getfinals-dzvezz2yhq-uc.a.run.app",
  getBracket: "https://getbracket-dzvezz2yhq-uc.a.run.app"
};

// ===============================
// GLOBAL STATE
// ===============================
let TOURNAMENT_STATUS = null;
let TOURNAMENT_FORMAT = null;
let TOURNAMENT_SPORT = null;
let TOURNAMENT_MATCH_FORMAT_GIRONI = null;
let TOURNAMENT_MATCH_FORMAT_FINALS = null;
let TOURNAMENT_HAS_3X4 = false;
let ALL_MATCHES = [];
let ALL_STANDINGS = [];
let AVAILABLE_ROUNDS = [];
let FINALS_MATCHES = [];
let FINALS_SELECTED_ROUND_ID = null;

// ===============================
// ELEMENTI DOM
// ===============================
const standingsSelectSection = document.getElementById("standings-select-section");
const standingsSpecificSection = document.getElementById("standings-specific-section");
const standingsTournamentSelect = document.getElementById("standings-tournament-select");

// ===============================
// HELPER: Normalizza sport
// ===============================
function normalizeSport(sport) {
  const s = String(sport || '').toLowerCase().trim();
  if (s.includes('calcio') || s.includes('football') || s.includes('soccer')) return 'calcio';
  if (s.includes('padel')) return 'padel';
  if (s.includes('beach') || s.includes('volley')) return 'beach_volley';
  return 'calcio';
}

// ===============================
// HELPER: Determina se il format è a set
// ===============================
function isSetBasedFormat(matchFormat) {
  const setFormats = ['1su1', '2su3', '3su5'];
  return setFormats.includes(String(matchFormat || '').toLowerCase());
}

// ===============================
// HELPER: Ottieni label per lo sport
// ===============================
function getSportLabels(sport, isSetBased) {
  if (sport === 'calcio') {
    return { scoreLabel: 'Gol', forLabel: 'GF', againstLabel: 'GS', diffLabel: 'Diff' };
  }
  if (isSetBased) {
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
function loadStandingsPage(tournamentId) {
  fetch(API_URLS.getTournaments)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(tournaments => {
      const t = tournaments.find(t => t.tournament_id === tournamentId);

      if (!t) {
        showTournamentNotFound();
        return;
      }

      TOURNAMENT_STATUS = t?.status || null;
      TOURNAMENT_FORMAT = t?.format_type || null;
      TOURNAMENT_SPORT = normalizeSport(t?.sport);
      TOURNAMENT_MATCH_FORMAT_GIRONI = String(t?.match_format_gironi || '').toLowerCase();
      TOURNAMENT_MATCH_FORMAT_FINALS = String(t?.match_format_finals || '').toLowerCase();
      TOURNAMENT_HAS_3X4 = t?.['3_4_posto'] === true;

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
    })
    .catch(err => {
      console.error("Errore caricamento tornei:", err);
    });
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
        window.location.href = `standings.html?tournament_id=${this.value}`;
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
        <a href="tournament.html?tournament_id=${tournament.tournament_id}" class="btn secondary">📋 Vai al regolamento</a>
        <a href="standings.html" class="btn secondary">← Torna alla selezione</a>
      </div>
      <div class="standings-not-started-info">
        <div class="info-item"><span class="info-icon">📍</span><span>${escapeHTML(tournament.location)}</span></div>
        <div class="info-item"><span class="info-icon">👥</span><span>${tournament.teams_current} / ${tournament.teams_max} squadre iscritte</span></div>
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
      <a href="standings.html" class="btn secondary">← Torna alla selezione tornei</a>
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

      renderRoundFilter(AVAILABLE_ROUNDS);
      renderMatchesByRound(AVAILABLE_ROUNDS[0]);

      document.querySelector(".standings-results-box-fullwidth")?.classList.remove("loading");
    })
    .catch(err => {
      console.error("Errore caricamento match:", err);
      list.innerHTML = "<p class='error'>Errore caricamento match</p>";
    });
}

// ===============================
// RENDER MATCHES BY ROUND (READ-ONLY)
// ===============================
function renderMatchesByRound(roundId) {
  const container = document.getElementById("matches-list");
  container.innerHTML = "";

  const matches = ALL_MATCHES.filter(m => Number(m.round_id) === Number(roundId));

  if (matches.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match per questa giornata</p>";
    return;
  }

  const isSetBased = matches[0]?.is_set_based || isSetBasedFormat(TOURNAMENT_MATCH_FORMAT_GIRONI);
  matches.forEach(match => {
    const card = renderMatchCard(match, isSetBased, false);
    container.appendChild(card);
  });
}

// ===============================
// RENDER MATCH CARD (UNIFIED)
// ===============================
function renderMatchCard(match, isSetBased, isFinals, roundLabel = null) {
  const card = document.createElement("div");
  card.className = "match-card";
  if (isFinals) card.classList.add("finals");

  const isPlayed = match.played === true || String(match.played).toUpperCase() === "TRUE";
  if (isPlayed) card.classList.add("played");

  // Gestione TBD per match futuri
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

  // Label per tipo match
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

  card.innerHTML = `
    <div class="match-card-inner">
      <div class="match-main">
        <div class="match-team match-team-a ${teamAClass}${isTbd ? ' tbd' : ''}">
          <span class="team-name">${escapeHTML(teamAName)}</span>
        </div>
        <div class="match-score-block">
          <span class="score score-a">${scoreA}</span>
          <span class="score-separator">:</span>
          <span class="score score-b">${scoreB}</span>
        </div>
        <div class="match-team match-team-b ${teamBClass}${isTbd ? ' tbd' : ''}">
          <span class="team-name">${escapeHTML(teamBName)}</span>
        </div>
      </div>

      ${showSetsDetail ? `<div class="match-sets-detail">${formatSetsDetail(setsDetail)}</div>` : ''}

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
          ${isPlayed ? `<div class="match-status-badge played">✓</div>` : ''}
        </div>
      </div>
    </div>

    <div id="${collapseId}" class="match-details-panel" hidden>
      ${hasDetails ? `
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
      `}
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

      if (!formatHasFinals(TOURNAMENT_FORMAT) && TOURNAMENT_STATUS === "finished") {
        renderPodium(ALL_STANDINGS);
      }
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

  const isSetBased = data[0]?.is_set_based || isSetBasedFormat(TOURNAMENT_MATCH_FORMAT_GIRONI);
  const sport = data[0]?.sport || TOURNAMENT_SPORT;
  const labels = getSportLabels(sport, isSetBased);

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

    if (isSetBased) {
      group.innerHTML = `
        <h3 class="standings-title">Girone ${escapeHTML(groupId)}</h3>
        <table class="standings-table standings-table-set">
          <thead>
            <tr>
              <th>Squadra</th><th>Pts</th><th>PG</th><th>V</th><th>P</th>
              <th>${labels.forLabel}</th><th>${labels.againstLabel}</th><th>${labels.diffLabel}</th>
              <th>${labels.gamesForLabel}</th><th>${labels.gamesAgainstLabel}</th><th>${labels.gamesDiffLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => `
              <tr>
                <td class="team-cell">
                  <span class="rank-badge">${team.rank_level}</span>
                  <span class="team-name">${escapeHTML(team.team_name || "")}</span>
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
              <th>Squadra</th><th>Pts</th><th>PG</th><th>V</th><th>N</th><th>P</th>
              <th>${labels.forLabel}</th><th>${labels.againstLabel}</th><th>${labels.diffLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => `
              <tr>
                <td class="team-cell">
                  <span class="rank-badge">${team.rank_level}</span>
                  <span class="team-name">${escapeHTML(team.team_name || "")}</span>
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

function renderRoundFilter(rounds) {
  const select = document.getElementById("round-filter");
  if (!select || !Array.isArray(rounds)) return;

  select.innerHTML = "";
  rounds.forEach((round, index) => {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = `Giornata ${round}`;
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

  // Match normali del round
  const matchesInRound = bracket.rounds?.[roundId] || [];
  const roundLabel = getRoundLabel(matchesInRound.length);
  const isSetBased = matchesInRound[0]?.is_set_based || isSetBasedFormat(TOURNAMENT_MATCH_FORMAT_FINALS);

  if (matchesInRound.length === 0 && !bracket.thirdPlaceMatch) {
    container.innerHTML = "<p class='placeholder'>Nessun match per questa fase</p>";
    return;
  }

  if (matchesInRound.length > 0) {
    const roundBox = document.createElement("div");
    roundBox.className = "finals-round";
    roundBox.innerHTML = `<h3>${escapeHTML(roundLabel)}</h3>`;
    matchesInRound.forEach(match => {
      const card = renderMatchCard(match, isSetBased, true, roundLabel);
      roundBox.appendChild(card);
    });
    container.appendChild(roundBox);
  }

  // Mostra finale 3/4 se esiste e siamo nel round finale
  if (bracket.thirdPlaceMatch) {
    const maxRound = Math.max(...Object.keys(bracket.rounds).map(Number));
    if (Number(roundId) === maxRound) {
      const thirdBox = document.createElement("div");
      thirdBox.className = "finals-round finals-third-place";
      thirdBox.innerHTML = `<h3>Finale 3°/4° Posto</h3>`;
      const isSetBased3x4 = bracket.thirdPlaceMatch.is_set_based || isSetBasedFormat(TOURNAMENT_MATCH_FORMAT_FINALS);
      const card = renderMatchCard(bracket.thirdPlaceMatch, isSetBased3x4, true, "Finale 3°/4° Posto");
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
  const finals = document.getElementById("finals-container");
  const podium = document.getElementById("podium-container");

  finals.classList.add("hidden");
  if (podium) podium.classList.add("hidden");

  if (formatHasFinals(TOURNAMENT_FORMAT)) {
    if (TOURNAMENT_STATUS === "final_phase" || TOURNAMENT_STATUS === "finished") {
      finals.classList.remove("hidden");
    }
  } else {
    if (TOURNAMENT_STATUS === "finished" && podium) {
      podium.classList.remove("hidden");
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

  // I round del bracket principale (esclude il match 3/4 che è separato)
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
  container.innerHTML = "";

  const rounds = Object.keys(bracket.rounds)
    .map(Number)
    .sort((a, b) => a - b);

  if (rounds.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match disponibile</p>";
    return;
  }

  const totalRounds = rounds.length;
  const firstRoundMatches = bracket.rounds[rounds[0]].length;
  const isSymmetric = firstRoundMatches >= 4 || (firstRoundMatches === 2 && totalRounds >= 2);

  if (isSymmetric && totalRounds >= 2) {
    renderSymmetricBracket(bracket, rounds, container);
  } else {
    renderLinearBracket(bracket, rounds, container);
  }

  // Render finale 3°/4° separata sotto il bracket principale
  if (bracket.thirdPlaceMatch) {
    renderThirdPlaceSection(bracket.thirdPlaceMatch, container);
  }
}

// ===============================
// RENDER 3°/4° POSTO SECTION
// ===============================
function renderThirdPlaceSection(match, container) {
  const section = document.createElement("div");
  section.className = "bracket-third-place-section";

  const title = document.createElement("div");
  title.className = "bracket-third-place-title";
  title.innerHTML = `<span>🥉</span> Finale 3°/4° Posto`;
  section.appendChild(title);

  const matchEl = createBracketMatch(match);
  matchEl.classList.add("bracket-match-3x4");
  section.appendChild(matchEl);

  // Se c'è un vincitore, mostra il risultato
  if (match.winner_team_id) {
    const thirdName = match.winner_team_id === match.team_a
      ? (match.team_a_name || formatTeam(match.team_a))
      : (match.team_b_name || formatTeam(match.team_b));

    const resultEl = document.createElement("div");
    resultEl.className = "bracket-third-winner";
    resultEl.textContent = `🥉 3° posto: ${thirdName}`;
    section.appendChild(resultEl);
  }

  container.appendChild(section);
}

// ===============================
// RENDER LINEAR BRACKET
// ===============================
function renderLinearBracket(bracket, rounds, container) {
  const bracketEl = document.createElement("div");
  bracketEl.className = "bracket-container bracket-linear";

  rounds.forEach(roundId => {
    const matches = bracket.rounds[roundId];
    const roundLabel = getRoundLabel(matches.length);

    const roundEl = document.createElement("div");
    roundEl.className = "bracket-round";
    roundEl.innerHTML = `<div class="bracket-round-label">${escapeHTML(roundLabel)}</div>`;

    matches.forEach(match => {
      const matchEl = createBracketMatch(match);
      roundEl.appendChild(matchEl);
    });

    bracketEl.appendChild(roundEl);
  });

  container.appendChild(bracketEl);
}

// ===============================
// RENDER SYMMETRIC BRACKET
// ===============================
function renderSymmetricBracket(bracket, rounds, container) {
  const bracketEl = document.createElement("div");
  bracketEl.className = "bracket-container bracket-symmetric";

  const leftSide = document.createElement("div");
  leftSide.className = "bracket-side bracket-left";

  const rightSide = document.createElement("div");
  rightSide.className = "bracket-side bracket-right";

  const centerEl = document.createElement("div");
  centerEl.className = "bracket-final";

  rounds.forEach(roundId => {
    const matches = bracket.rounds[roundId];
    const roundLabel = getRoundLabel(matches.length);
    const isFinal = matches.length === 1;

    if (isFinal) {
      const finalMatch = matches[0];

      let championName = "";
      if (finalMatch.winner_team_id) {
        if (finalMatch.winner_team_id === finalMatch.team_a) {
          championName = finalMatch.team_a_name || formatTeam(finalMatch.team_a);
        } else if (finalMatch.winner_team_id === finalMatch.team_b) {
          championName = finalMatch.team_b_name || formatTeam(finalMatch.team_b);
        } else {
          championName = formatTeam(finalMatch.winner_team_id);
        }
      }

      centerEl.innerHTML = `<div class="bracket-trophy">🏆</div><div class="bracket-round-label">Finale</div>`;
      const matchEl = createBracketMatch(finalMatch);
      centerEl.appendChild(matchEl);

      if (championName) {
        const championEl = document.createElement("div");
        championEl.className = "bracket-champion";
        championEl.textContent = championName;
        centerEl.appendChild(championEl);
      }
    } else {
      const leftMatches = matches.slice(0, Math.ceil(matches.length / 2));
      const rightMatches = matches.slice(Math.ceil(matches.length / 2));

      if (leftMatches.length > 0) {
        const leftRoundEl = document.createElement("div");
        leftRoundEl.className = "bracket-round left";
        leftRoundEl.innerHTML = `<div class="bracket-round-label">${escapeHTML(roundLabel)}</div>`;
        leftMatches.forEach(match => leftRoundEl.appendChild(createBracketMatch(match)));
        leftSide.appendChild(leftRoundEl);
      }

      if (rightMatches.length > 0) {
        const rightRoundEl = document.createElement("div");
        rightRoundEl.className = "bracket-round right";
        rightRoundEl.innerHTML = `<div class="bracket-round-label">${escapeHTML(roundLabel)}</div>`;
        rightMatches.forEach(match => rightRoundEl.appendChild(createBracketMatch(match)));
        rightSide.appendChild(rightRoundEl);
      }
    }
  });

  bracketEl.appendChild(leftSide);
  bracketEl.appendChild(centerEl);
  bracketEl.appendChild(rightSide);

  container.appendChild(bracketEl);
}

// ===============================
// CREATE BRACKET MATCH ELEMENT
// ===============================
function createBracketMatch(match) {
  const matchEl = document.createElement("div");
  matchEl.className = "bracket-match";
  if (match.is_third_place_match) matchEl.classList.add("bracket-match-3x4");

  const isPlayed = match.played === true || String(match.played).toUpperCase() === "TRUE";
  const scoreA = match.score_a;
  const scoreB = match.score_b;

  const teamAName = match.team_a_name || (match.team_a ? formatTeam(match.team_a) : null);
  const teamBName = match.team_b_name || (match.team_b ? formatTeam(match.team_b) : null);

  let winnerTeam = null;
  if (isPlayed) {
    if (match.winner_team_id) {
      winnerTeam = match.winner_team_id;
    } else if (scoreA !== "" && scoreB !== "" && scoreA !== null && scoreB !== null) {
      const numA = Number(scoreA);
      const numB = Number(scoreB);
      if (numA > numB) winnerTeam = match.team_a;
      else if (numB > numA) winnerTeam = match.team_b;
    }
  }

  // Team A
  const teamAEl = document.createElement("div");
  teamAEl.className = "bracket-team";

  if (match.team_a && teamAName) {
    if (winnerTeam === match.team_a) teamAEl.classList.add("winner");
    else if (winnerTeam && winnerTeam !== match.team_a) teamAEl.classList.add("loser");

    teamAEl.innerHTML = `
      <span class="bracket-team-name">${escapeHTML(teamAName)}</span>
      <span class="bracket-team-score">${isPlayed && scoreA !== "" && scoreA !== null ? scoreA : "−"}</span>
    `;
  } else {
    teamAEl.classList.add("tbd");
    teamAEl.innerHTML = `<span class="bracket-team-name">TBD</span><span class="bracket-team-score">−</span>`;
  }

  // Team B
  const teamBEl = document.createElement("div");
  teamBEl.className = "bracket-team";

  if (match.team_b && teamBName) {
    if (winnerTeam === match.team_b) teamBEl.classList.add("winner");
    else if (winnerTeam && winnerTeam !== match.team_b) teamBEl.classList.add("loser");

    teamBEl.innerHTML = `
      <span class="bracket-team-name">${escapeHTML(teamBName)}</span>
      <span class="bracket-team-score">${isPlayed && scoreB !== "" && scoreB !== null ? scoreB : "−"}</span>
    `;
  } else {
    teamBEl.classList.add("tbd");
    teamBEl.innerHTML = `<span class="bracket-team-name">TBD</span><span class="bracket-team-score">−</span>`;
  }

  matchEl.appendChild(teamAEl);
  matchEl.appendChild(teamBEl);

  return matchEl;
}

// ===============================
// RENDER PODIUM
// ===============================
function renderPodium(standings) {
  const container = document.getElementById("podium-content");
  if (!container) return;

  const isSetBased = standings[0]?.is_set_based || isSetBasedFormat(TOURNAMENT_MATCH_FORMAT_GIRONI);

  const sorted = [...standings].sort((a, b) => {
    const rankDiff = (a.rank_level || 99) - (b.rank_level || 99);
    if (rankDiff !== 0) return rankDiff;
    const pointsDiff = (b.points || 0) - (a.points || 0);
    if (pointsDiff !== 0) return pointsDiff;
    if (isSetBased) return (b.set_diff || 0) - (a.set_diff || 0);
    return (b.goal_diff || 0) - (a.goal_diff || 0);
  });

  const top3 = sorted.slice(0, 3);

  if (top3.length === 0) {
    container.innerHTML = "<p class='placeholder'>Classifica non disponibile</p>";
    return;
  }

  const formatPodiumStats = (team) => {
    if (isSetBased) return `${team.points} pts · Set ${formatDiff(team.set_diff)}`;
    return `${team.points} pts · ${formatDiff(team.goal_diff)}`;
  };

  container.innerHTML = `
    <div class="podium">
      ${top3.length >= 2 ? `
        <div class="podium-place podium-second">
          <div class="podium-medal">🥈</div>
          <div class="podium-rank">2°</div>
          <div class="podium-team">${escapeHTML(top3[1].team_name)}</div>
          <div class="podium-stats">${formatPodiumStats(top3[1])}</div>
          <div class="podium-bar second"></div>
        </div>
      ` : ''}
      ${top3.length >= 1 ? `
        <div class="podium-place podium-first">
          <div class="podium-medal">🥇</div>
          <div class="podium-rank">1°</div>
          <div class="podium-team">${escapeHTML(top3[0].team_name)}</div>
          <div class="podium-stats">${formatPodiumStats(top3[0])}</div>
          <div class="podium-bar first"></div>
        </div>
      ` : ''}
      ${top3.length >= 3 ? `
        <div class="podium-place podium-third">
          <div class="podium-medal">🥉</div>
          <div class="podium-rank">3°</div>
          <div class="podium-team">${escapeHTML(top3[2].team_name)}</div>
          <div class="podium-stats">${formatPodiumStats(top3[2])}</div>
          <div class="podium-bar third"></div>
        </div>
      ` : ''}
    </div>
    <div class="podium-champion">
      <span class="champion-trophy">🏆</span>
      <span class="champion-label">Campione</span>
      <span class="champion-name">${escapeHTML(top3[0]?.team_name || 'TBD')}</span>
    </div>
  `;
}