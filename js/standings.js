// ===============================
// STANDINGS JS
// ===============================

// ===============================
// API URLS (FIREBASE FUNCTIONS)
// ===============================
const API_URLS = {
  getTournaments: "https://gettournaments-dzvezz2yhq-uc.a.run.app",
  getMatches: "https://getmatches-dzvezz2yhq-uc.a.run.app",
  getStandings: "https://getstandings-dzvezz2yhq-uc.a.run.app",
  getFinals: "https://getfinals-dzvezz2yhq-uc.a.run.app",
  getBracket: "https://getbracket-dzvezz2yhq-uc.a.run.app",
  submitResult: "https://submitresult-dzvezz2yhq-uc.a.run.app"
};

let TOURNAMENT_STATUS = null;
let ALL_MATCHES = [];
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
// SKELETON HELPERS
// ===============================
function fadeOutSkeleton(wrapper) {
  wrapper.classList.add("fade-out");

  setTimeout(() => {
    wrapper.classList.add("hidden");
  }, 350);
}


function loadStandingsPage(tournamentId) {
  fetch(API_URLS.getTournaments)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(tournaments => {
      const t = tournaments.find(t => t.tournament_id === tournamentId);
      
      if (!t) {
        // Torneo non trovato
        showTournamentNotFound();
        return;
      }

      TOURNAMENT_STATUS = t?.status || null;

      // Se il torneo è ancora in fase di iscrizioni (open)
      // NOTA: "full" ora ha match e standings, quindi può essere visualizzato
      if (TOURNAMENT_STATUS === "open") {
        showTournamentNotStarted(t);
        return;
      }

      // Popola titolo e sottotitolo
      renderStandingsHeader(t);

      const layout = document.querySelector(".standings-layout");
      if (layout) {
        layout.classList.toggle("finished", TOURNAMENT_STATUS === "finished");
      }

      loadMatches(tournamentId);
      loadStandings(tournamentId);

      if (TOURNAMENT_STATUS === "final_phase" || TOURNAMENT_STATUS === "finished") {
        loadFinalsBracket(tournamentId).then(bracket => {
          if (bracket) renderFinalsBracket(bracket, tournamentId);
          applyLayoutByStatus();
        });
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

  if (titleEl) {
    titleEl.textContent = `Classifica ${tournament.name}`;
  }

  if (subtitleEl) {
    subtitleEl.textContent = `${tournament.location} · ${tournament.date} · ${tournament.sport}`;
  }
}



function hideSkeletons() {
  document
    .querySelectorAll(".standings-skeleton")
    .forEach(s => s.classList.add("hidden"));
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const tournamentId = getTournamentIdFromUrl();

  if (tournamentId) {
    // Mostra standings specifiche
    standingsSelectSection.classList.add("hidden");
    standingsSpecificSection.classList.remove("hidden");

    document
      .querySelector(".standings-results-box-fullwidth")
      ?.classList.add("loading");

    loadStandingsPage(tournamentId);
  } else {
    // Mostra selezione torneo
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
// LOAD TOURNAMENT SELECT (NUOVO)
// ===============================
function loadTournamentSelect() {
  fetch(API_URLS.getTournaments)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(tournaments => {
      if (!Array.isArray(tournaments)) {
        throw new Error("Formato dati non valido");
      }

      // Reset select
      standingsTournamentSelect.innerHTML = `<option value="">Seleziona un torneo</option>`;

      tournaments.forEach(t => {
        const option = document.createElement("option");
        option.value = t.tournament_id;
        option.textContent = `${t.name} · ${t.date}`;
        standingsTournamentSelect.appendChild(option);
      });

      // Redirect su selezione
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
  // Nascondi skeleton e sezioni specifiche
  hideSkeletons();
  
  const specificSection = document.getElementById("standings-specific-section");
  
  // Svuota il contenuto esistente e mostra il placeholder
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
        <a href="tournament.html?tournament_id=${tournament.tournament_id}" class="btn secondary">
          📋 Vai al regolamento
        </a>
        <a href="standings.html" class="btn secondary">
          ← Torna alla selezione
        </a>
      </div>

      <div class="standings-not-started-info">
        <div class="info-item">
          <span class="info-icon">📍</span>
          <span>${escapeHTML(tournament.location)}</span>
        </div>
        <div class="info-item">
          <span class="info-icon">👥</span>
          <span>${tournament.teams_current} / ${tournament.teams_max} squadre iscritte</span>
        </div>
        <div class="info-item">
          <span class="info-icon">🏐</span>
          <span>${escapeHTML(tournament.sport)}</span>
        </div>
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
      
      <a href="standings.html" class="btn secondary">
        ← Torna alla selezione tornei
      </a>
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
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(matches => {
      fadeOutSkeleton(skeleton);

      ALL_MATCHES = Array.isArray(matches) ? matches : [];

      AVAILABLE_ROUNDS = [
        ...new Set(
          ALL_MATCHES.map(m => Number(m.round_id)).filter(Boolean)
        )
      ].sort((a, b) => a - b);

      renderRoundFilter(AVAILABLE_ROUNDS);
      renderMatchesByRound(AVAILABLE_ROUNDS[0]);

      document
        .querySelector(".standings-results-box-fullwidth")
        ?.classList.remove("loading");
    })
    .catch(err => {
      console.error("Errore caricamento match:", err);
      list.innerHTML = "<p class='error'>Errore caricamento match</p>";
    });
}

function renderMatchesByRound(roundId) {
  const container = document.getElementById("matches-list");
  container.innerHTML = "";

  const matches = ALL_MATCHES.filter(
    m => Number(m.round_id) === Number(roundId)
  );

  if (matches.length === 0) {
    container.innerHTML =
      "<p class='placeholder'>Nessun match per questa giornata</p>";
    return;
  }

  // ✅ SOLO torneo "finished" blocca i match dei gironi
  const tournamentLocked = TOURNAMENT_STATUS === "finished";

  matches.forEach(match => {
    const isPlayed =
      match.played === true ||
      String(match.played).toUpperCase() === "TRUE";

    const locked = tournamentLocked;  // ✅ Rimosso "finalsStarted"

    const card = document.createElement("div");
    card.className = "match-card";
    if (isPlayed) card.classList.add("played");
    if (locked) card.classList.add("locked");

    card.innerHTML = `
      <div class="match-meta">
        <span class="match-round">Giornata ${roundId}</span>
        <span class="match-group">Girone ${escapeHTML(match.group_id || "?")}</span>
      </div>

      <div class="match-teams">
        <span class="team">${escapeHTML(formatTeam(match.team_a))}</span>

        <input type="number"
          class="score-input"
          ${locked ? "disabled" : ""}
          value="${isPlayed ? match.score_a ?? "" : ""}">

        <span class="dash">-</span>

        <input type="number"
          class="score-input"
          ${locked ? "disabled" : ""}
          value="${isPlayed ? match.score_b ?? "" : ""}">

        <span class="team">${escapeHTML(formatTeam(match.team_b))}</span>
      </div>

      <button class="btn secondary submit-result" ${locked ? "disabled" : ""}>
        ${
          tournamentLocked
            ? "Torneo concluso"
            : isPlayed
              ? "Modifica risultato"
              : "Invia risultato"
        }
      </button>
    `;

    if (!locked) {
      card.querySelector(".submit-result")
        .addEventListener("click", () =>
          submitResult(card, match.match_id, getTournamentIdFromUrl())
        );
    }

    container.appendChild(card);
  });
}

function onRoundChange(value) {
  if (!value) return;
  renderMatchesByRound(Number(value));
}

// ===============================
// LOAD STANDINGS
// ===============================
function loadStandings(tournamentId) {
  const skeleton = document.querySelector(
    ".standings-table-box-fullwidth .standings-skeleton"
  );
  const standingsEl = document.getElementById("standings");

  standingsEl.innerHTML = "";
  standingsEl.classList.remove("hidden");

  const url = `${API_URLS.getStandings}?tournament_id=${encodeURIComponent(tournamentId)}`;

  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      fadeOutSkeleton(skeleton);
      renderStandings(data);
    })
    .catch(err => {
      console.error("Errore caricamento standings:", err);
      standingsEl.innerHTML =
        "<p class='error'>Errore caricamento classifica</p>";
    });
}

// ===============================
// SUBMIT RESULT (GROUP MATCHES)
// ===============================
function submitResult(card, matchId, tournamentId, phase = "group") {
  if (TOURNAMENT_STATUS === "finished") {
    showToast("Torneo concluso 🔒");
    return;
  }

  const inputs = card.querySelectorAll(".score-input");
  const btn = card.querySelector(".submit-result");

  const scoreA = inputs[0].value;
  const scoreB = inputs[1].value;

  if (scoreA === "" || scoreB === "") {
    showToast("Inserisci entrambi i punteggi ⚠️");
    return;
  }

  const payload = {
    tournament_id: tournamentId,
    match_id: matchId,
    score_a: Number(scoreA),
    score_b: Number(scoreB),
    phase: phase
  };

  // STATO LOADING
  btn.innerHTML = `
    <span class="spinner"></span>
    Salvataggio...
  `;
  btn.classList.add("disabled");
  btn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  fetch(API_URLS.submitResult, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(res => res.text())
    .then(response => {
      if (response === "RESULT_SAVED") {
        card.classList.add("played");

        btn.classList.remove("primary");
        btn.classList.add("secondary");
        btn.textContent = "Modifica risultato";

        showToast("Risultato salvato ✔️");

        inputs.forEach(input => input.disabled = false);
        btn.disabled = false;
        btn.classList.remove("disabled");

        loadStandings(tournamentId);

        fetch(API_URLS.getTournaments)
          .then(r => r.json())
          .then(tournaments => {
            const t = tournaments.find(x => x.tournament_id === tournamentId);
            TOURNAMENT_STATUS = t?.status || TOURNAMENT_STATUS;

            if (TOURNAMENT_STATUS === "final_phase") {
              loadMatches(tournamentId);
            }
          })
          .catch(() => {});

        return;
      }

      showToast("Errore nel salvataggio ❌");
      restoreUI();
    })
    .catch(err => {
      console.error("Errore submit:", err);
      showToast("Errore di rete ❌");
      restoreUI();
    });

  function restoreUI() {
    btn.textContent = card.classList.contains("played")
      ? "Modifica risultato"
      : "Invia risultato";

    btn.disabled = false;
    btn.classList.remove("disabled");

    inputs.forEach(input => input.disabled = false);
  }
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

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// ===============================
// RENDER STANDINGS
// ===============================
function renderStandings(data) {
  const standingsEl = document.getElementById("standings");

  if (!Array.isArray(data) || data.length === 0) {
    standingsEl.innerHTML =
      "<p class='placeholder'>Nessuna classifica disponibile</p>";
    return;
  }

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

  Object.keys(groupsMap)
    .sort(groupSort)
    .forEach(groupId => {
      const teams = groupsMap[groupId];

      const group = document.createElement("div");
      group.className = "standings-group";

      group.innerHTML = `
        <h3 class="standings-title">Girone ${escapeHTML(groupId)}</h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th>Squadra</th>
              <th>Pts</th>
              <th>PG</th>
              <th>V</th>
              <th>N</th>
              <th>P</th>
              <th>GF</th>
              <th>GS</th>
              <th>Diff</th>
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
                <td>${Number(team.goal_diff) || 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      standingsEl.appendChild(group);
    });
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

  select.addEventListener("change", e => {
    onRoundChange(e.target.value);
  });
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

    if (Number(roundId) === Number(FINALS_SELECTED_ROUND_ID)) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  if (select.dataset.initialized === "true") return;
  select.dataset.initialized = "true";

  select.addEventListener("change", e => {
    onFinalsRoundChange(e.target.value);
  });
}

function onFinalsRoundChange(value) {
  if (!value) return;

  FINALS_SELECTED_ROUND_ID = Number(value);

  const tournamentId = getTournamentIdFromUrl();
  if (!tournamentId) return;

  loadFinalsBracket(tournamentId).then(bracket => {
    if (bracket) renderFinalsBracket(bracket, tournamentId);
  });
}

function renderFinalsMatchesByRound(roundId, bracket, tournamentId) {
  const container = document.getElementById("finals-bracket-content");
  if (!container) return;

  container.innerHTML = "";

  const matchesInRound = bracket.rounds?.[roundId] || [];
  const roundLabel = getRoundLabel(matchesInRound.length);

  if (matchesInRound.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match per questa fase</p>";
    return;
  }

  const roundBox = document.createElement("div");
  roundBox.className = "finals-round";
  roundBox.innerHTML = `<h3>${escapeHTML(roundLabel)}</h3>`;

  matchesInRound.forEach(match => {
    const card = renderFinalsMatchCard(match, tournamentId, roundLabel);
    roundBox.appendChild(card);
  });

  container.appendChild(roundBox);
}

function loadFinalsBracket(tournamentId) {
  const url = `${API_URLS.getBracket}?tournament_id=${encodeURIComponent(tournamentId)}`;

  return fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
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

function applyLayoutByStatus() {
  const finals = document.getElementById("finals-container");

  finals.classList.add("hidden");

  if (TOURNAMENT_STATUS === "final_phase" || TOURNAMENT_STATUS === "finished") {
    finals.classList.remove("hidden");
  }
}

function getRoundLabel(matchCount) {
  switch (matchCount) {
    case 16:
      return "Sedicesimi di Finale";
    case 8:
      return "Ottavi di Finale";
    case 4:
      return "Quarti di Finale";
    case 2:
      return "Semifinali";
    case 1:
      return "Finale";
    default:
      return `Round (${matchCount} partite)`;
  }
}

function renderFinalsBracket(bracket, tournamentId) {
  const container = document.getElementById("finals-bracket-content");
  const visualContainer = document.getElementById("finals-bracket-visual");

  if (!container) return;

  const finalsSkeleton = document.querySelector(".finals-section .finals-skeleton");
  if (finalsSkeleton) {
    finalsSkeleton.classList.add("hidden");
  }

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
  renderFinalsMatchesByRound(FINALS_SELECTED_ROUND_ID, bracket, tournamentId);

  if (visualContainer) {
    renderBracketVisual(bracket, visualContainer);
  }
}

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
}

function renderLinearBracket(bracket, rounds, container) {
  const bracketEl = document.createElement("div");
  bracketEl.className = "bracket-container bracket-linear";

  rounds.forEach((roundId, index) => {
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

function renderSymmetricBracket(bracket, rounds, container) {
  const bracketEl = document.createElement("div");
  bracketEl.className = "bracket-container bracket-symmetric";

  const leftSide = document.createElement("div");
  leftSide.className = "bracket-side bracket-left";

  const rightSide = document.createElement("div");
  rightSide.className = "bracket-side bracket-right";

  const centerEl = document.createElement("div");
  centerEl.className = "bracket-final";

  rounds.forEach((roundId, roundIndex) => {
    const matches = bracket.rounds[roundId];
    const roundLabel = getRoundLabel(matches.length);
    const isFinal = matches.length === 1;

    if (isFinal) {
      centerEl.innerHTML = `
        <div class="bracket-trophy">🏆</div>
        <div class="bracket-round-label">Finale</div>
      `;
      const matchEl = createBracketMatch(matches[0]);
      centerEl.appendChild(matchEl);

      if (matches[0].winner_team_id) {
        const championEl = document.createElement("div");
        championEl.className = "bracket-champion";
        championEl.textContent = formatTeam(matches[0].winner_team_id);
        centerEl.appendChild(championEl);
      }
    } else {
      const leftMatches = matches.slice(0, Math.ceil(matches.length / 2));
      const rightMatches = matches.slice(Math.ceil(matches.length / 2));

      if (leftMatches.length > 0) {
        const leftRoundEl = document.createElement("div");
        leftRoundEl.className = "bracket-round left";
        leftRoundEl.innerHTML = `<div class="bracket-round-label">${escapeHTML(roundLabel)}</div>`;
        
        leftMatches.forEach(match => {
          const matchEl = createBracketMatch(match);
          leftRoundEl.appendChild(matchEl);
        });
        
        leftSide.appendChild(leftRoundEl);
      }

      if (rightMatches.length > 0) {
        const rightRoundEl = document.createElement("div");
        rightRoundEl.className = "bracket-round right";
        rightRoundEl.innerHTML = `<div class="bracket-round-label">${escapeHTML(roundLabel)}</div>`;
        
        rightMatches.forEach(match => {
          const matchEl = createBracketMatch(match);
          rightRoundEl.appendChild(matchEl);
        });
        
        rightSide.appendChild(rightRoundEl);
      }
    }
  });

  bracketEl.appendChild(leftSide);
  bracketEl.appendChild(centerEl);
  bracketEl.appendChild(rightSide);

  container.appendChild(bracketEl);
}

function createBracketMatch(match) {
  const matchEl = document.createElement("div");
  matchEl.className = "bracket-match";

  const isPlayed = match.played === true || String(match.played).toUpperCase() === "TRUE";
  const scoreA = match.score_a;
  const scoreB = match.score_b;

  let winnerTeam = null;
  if (isPlayed) {
    if (match.winner_team_id) {
      winnerTeam = match.winner_team_id;
    } else if (scoreA !== "" && scoreB !== "" && scoreA !== null && scoreB !== null) {
      const numA = Number(scoreA);
      const numB = Number(scoreB);
      if (numA > numB) {
        winnerTeam = match.team_a;
      } else if (numB > numA) {
        winnerTeam = match.team_b;
      }
    }
  }

  const teamAEl = document.createElement("div");
  teamAEl.className = "bracket-team";
  
  if (match.team_a) {
    if (winnerTeam === match.team_a) {
      teamAEl.classList.add("winner");
    } else if (winnerTeam && winnerTeam !== match.team_a) {
      teamAEl.classList.add("loser");
    }
    
    teamAEl.innerHTML = `
      <span class="bracket-team-name">${escapeHTML(formatTeam(match.team_a))}</span>
      <span class="bracket-team-score">${isPlayed && scoreA !== "" && scoreA !== null ? scoreA : "−"}</span>
    `;
  } else {
    teamAEl.classList.add("tbd");
    teamAEl.innerHTML = `
      <span class="bracket-team-name">TBD</span>
      <span class="bracket-team-score">−</span>
    `;
  }

  const teamBEl = document.createElement("div");
  teamBEl.className = "bracket-team";
  
  if (match.team_b) {
    if (winnerTeam === match.team_b) {
      teamBEl.classList.add("winner");
    } else if (winnerTeam && winnerTeam !== match.team_b) {
      teamBEl.classList.add("loser");
    }
    
    teamBEl.innerHTML = `
      <span class="bracket-team-name">${escapeHTML(formatTeam(match.team_b))}</span>
      <span class="bracket-team-score">${isPlayed && scoreB !== "" && scoreB !== null ? scoreB : "−"}</span>
    `;
  } else {
    teamBEl.classList.add("tbd");
    teamBEl.innerHTML = `
      <span class="bracket-team-name">TBD</span>
      <span class="bracket-team-score">−</span>
    `;
  }

  matchEl.appendChild(teamAEl);
  matchEl.appendChild(teamBEl);

  return matchEl;
}

function renderFinalsMatchCard(match, tournamentId, roundLabel = "Fase Finale") {
  const card = document.createElement("div");
  card.className = "match-card finals";

  const isPlayed =
    match.played === true ||
    String(match.played).toUpperCase() === "TRUE";

  const tournamentLocked = TOURNAMENT_STATUS === "finished";

  if (isPlayed) card.classList.add("played");
  if (tournamentLocked) card.classList.add("locked");

  let btnText = "Invia risultato";
  let btnClass = "btn primary submit-result";

  if (tournamentLocked) {
    btnText = "Torneo concluso";
    btnClass = "btn secondary submit-result";
  } else if (isPlayed) {
    btnText = "Modifica risultato";
    btnClass = "btn secondary submit-result";
  }

  const scoreA = match.score_a;
  const scoreB = match.score_b;

  const isTieWithWinner =
    isPlayed &&
    scoreA !== "" &&
    scoreB !== "" &&
    String(scoreA) === String(scoreB) &&
    match.winner_team_id;

  card.innerHTML = `
    <div class="match-meta">
      <span class="match-round">${escapeHTML(roundLabel)}</span>
      <span class="match-group">Fase Finale</span>
    </div>

    <div class="match-teams">
      <span class="team">${escapeHTML(formatTeam(match.team_a))}</span>

      <input type="number"
        class="score-input"
        ${tournamentLocked ? "disabled" : ""}
        value="${isPlayed ? (match.score_a ?? "") : ""}">

      <span class="dash">-</span>

      <input type="number"
        class="score-input"
        ${tournamentLocked ? "disabled" : ""}
        value="${isPlayed ? (match.score_b ?? "") : ""}">

      <span class="team">${escapeHTML(formatTeam(match.team_b))}</span>
    </div>

    <div class="winner-select ${isTieWithWinner ? "" : "hidden"}">
      <label>Vincitore spareggio</label>
      <select ${tournamentLocked ? "disabled" : ""}>
        <option value="">Seleziona</option>
        <option value="${match.team_a}" ${match.winner_team_id === match.team_a ? "selected" : ""}>${formatTeam(match.team_a)}</option>
        <option value="${match.team_b}" ${match.winner_team_id === match.team_b ? "selected" : ""}>${formatTeam(match.team_b)}</option>
      </select>
    </div>

    <button class="${btnClass}" ${tournamentLocked ? "disabled" : ""}>
      ${btnText}
    </button>
  `;

  if (tournamentLocked) return card;

  const inputs = card.querySelectorAll(".score-input");
  const selectBox = card.querySelector(".winner-select");
  const select = selectBox.querySelector("select");

  inputs.forEach(i =>
    i.addEventListener("input", () => {
      if (inputs[0].value !== "" && inputs[0].value === inputs[1].value) {
        selectBox.classList.remove("hidden");
      } else {
        selectBox.classList.add("hidden");
        select.value = "";
      }
    })
  );

  card.querySelector(".submit-result")
    .addEventListener("click", () =>
      submitFinalResult(card, match, tournamentId, select.value)
    );

  return card;
}

function submitFinalResult(card, match, tournamentId, winnerTeamId) {
  if (TOURNAMENT_STATUS === "finished") {
    showToast("Torneo concluso 🔒");
    return;
  }

  const inputs = card.querySelectorAll(".score-input");
  const btn = card.querySelector(".submit-result");
  const scoreA = inputs[0].value;
  const scoreB = inputs[1].value;

  if (scoreA === "" || scoreB === "") {
    showToast("Inserisci entrambi i punteggi ⚠️");
    return;
  }

  if (scoreA === scoreB && !winnerTeamId) {
    showToast("Seleziona il vincitore dello spareggio ⚠️");
    return;
  }

  const payload = {
    tournament_id: tournamentId,
    match_id: match.match_id,
    score_a: Number(scoreA),
    score_b: Number(scoreB),
    phase: "final"
  };

  if (winnerTeamId) {
    payload.winner_team_id = winnerTeamId;
  }

  // STATO LOADING
  btn.innerHTML = `
    <span class="spinner"></span>
    Salvataggio...
  `;
  btn.classList.add("disabled");
  btn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  fetch(API_URLS.submitResult, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(res => res.text())
    .then(resp => {
      if (resp === "RESULT_SAVED") {
        card.classList.add("played");

        btn.className = "btn secondary submit-result";
        btn.textContent = "Modifica risultato";
        btn.disabled = false;
        btn.classList.remove("disabled");

        inputs.forEach(input => input.disabled = false);

        showToast("Risultato finale salvato ✔️");

        fetch(API_URLS.getTournaments)
          .then(r => r.json())
          .then(tournaments => {
            const t = tournaments.find(x => x.tournament_id === tournamentId);
            const oldStatus = TOURNAMENT_STATUS;
            TOURNAMENT_STATUS = t?.status || TOURNAMENT_STATUS;

            loadFinalsBracket(tournamentId)
              .then(bracket => {
                if (bracket) {
                  renderFinalsBracket(bracket, tournamentId);
                }
              });

            if (TOURNAMENT_STATUS === "finished" && oldStatus !== "finished") {
              applyLayoutByStatus();
            }
          })
          .catch(() => {
            loadFinalsBracket(tournamentId)
              .then(bracket => {
                if (bracket) {
                  renderFinalsBracket(bracket, tournamentId);
                }
              });
          });

      } else if (resp === "FINAL_ROUND_LOCKED") {
        showToast("Round bloccato: esiste già un round successivo 🔒");
        restoreUI();
      } else if (resp === "TOURNAMENT_FINISHED_LOCKED") {
        showToast("Torneo concluso 🔒");
        restoreUI();
      } else {
        showToast("Errore nel salvataggio ❌");
        restoreUI();
      }
    })
    .catch(err => {
      console.error("Errore submit final:", err);
      showToast("Errore di rete ❌");
      restoreUI();
    });

  function restoreUI() {
    btn.className = card.classList.contains("played")
      ? "btn secondary submit-result"
      : "btn primary submit-result";

    btn.textContent = card.classList.contains("played")
      ? "Modifica risultato"
      : "Invia risultato";

    btn.disabled = false;
    btn.classList.remove("disabled");

    inputs.forEach(input => input.disabled = false);
  }
}