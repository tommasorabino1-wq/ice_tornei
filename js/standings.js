// ===============================
// STANDINGS JS
// ===============================

// ⚠️ INSERISCI QUI L’URL DELLA TUA WEB APP
const API_URL = "https://script.google.com/macros/s/AKfycbzUiub5CtKe7Ct37UhMQyZh9XMzdnxbF99ezksfSskXyV_NJ0d-5DXM2WXNyR7rscE8Ow/exec";

let TOURNAMENT_STATUS = null;

let ALL_MATCHES = [];
let AVAILABLE_ROUNDS = [];
let FINALS_MATCHES = [];




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
  fetch(API_URL)
    .then(res => res.json())
    .then(tournaments => {
      const t = tournaments.find(t => t.tournament_id === tournamentId);
      TOURNAMENT_STATUS = t?.status || null;

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
    });
}




function hideSkeletons() {
  document
    .querySelectorAll(".standings-skeleton")
    .forEach(s => s.classList.add("hidden"));
}





document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelector(".standings-results-box")
    ?.classList.add("loading");

  const tournamentId = getTournamentIdFromUrl();

  if (tournamentId) {
    hideTournamentFilter();
    loadStandingsPage(tournamentId);
    return; // ⬅️ FONDAMENTALE
  }

  hideSkeletons();
  showTournamentFilter();
});







// ===============================
// GET TOURNAMENT ID
// ===============================
function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tournament_id");
}


// ===============================
// SHOW TOURNAMENT FILTER
// ===============================
function showTournamentFilter() {
  const filterBox = document.getElementById("tournament-filter");
  const select = document.getElementById("tournament-select");

  // 🔒 protezione: inizializza UNA SOLA VOLTA
  if (select.dataset.initialized === "true") return;
  select.dataset.initialized = "true";

  filterBox.classList.remove("hidden");

  fetch(API_URL)
    .then(res => res.json())
    .then(tournaments => {
      select.innerHTML = `<option value="">Seleziona torneo</option>`;

      tournaments.forEach(t => {
        const option = document.createElement("option");
        option.value = t.tournament_id;
        option.textContent = t.name;
        select.appendChild(option);
      });
    });

  select.addEventListener("change", () => {
    if (!select.value) return;

    const tournamentId = select.value;

    // ✅ URL coerente
    history.replaceState(
      null,
      "",
      `${window.location.pathname}?tournament_id=${tournamentId}`
    );

    document
      .querySelectorAll(".standings-results-box, .standings-table-box")
      .forEach(box => box.classList.remove("hidden"));

    hideTournamentFilter();
    loadStandingsPage(tournamentId);
  });
}



function hideTournamentFilter() {
  const filterBox = document.getElementById("tournament-filter");
  filterBox.classList.add("hidden");
}




// ===============================
// LOAD MATCHES
// ===============================
function loadMatches(tournamentId) {
  const skeleton = document.querySelector(
    ".standings-results-box .standings-skeleton"
  );
  const list = document.getElementById("matches-list");

  list.innerHTML = "";

  fetch(`${API_URL}?action=get_matches&tournament_id=${encodeURIComponent(tournamentId)}`)
    .then(res => res.json())
    .then(matches => {
      fadeOutSkeleton(skeleton);

      ALL_MATCHES = Array.isArray(matches) ? matches : [];

      AVAILABLE_ROUNDS = [
        ...new Set(
          ALL_MATCHES.map(m => Number(m.round_id)).filter(Boolean)
        )
      ].sort((a, b) => a - b);

      renderRoundFilter(AVAILABLE_ROUNDS);
      renderMatchesByRound(AVAILABLE_ROUNDS[0]); // default: prima giornata

      // ✅ QUI è il punto GIUSTO
      document
        .querySelector(".standings-results-box")
        ?.classList.remove("loading");
    })
    .catch(() => {
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

  // 🔒 BLOCCO LOGICO
  const tournamentLocked = TOURNAMENT_STATUS === "finished";
  const finalsStarted = TOURNAMENT_STATUS === "final_phase";

  matches.forEach(match => {
    const isPlayed =
      match.played === true ||
      String(match.played).toUpperCase() === "TRUE";

    const locked = tournamentLocked || finalsStarted;

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
            : finalsStarted
              ? "Fase finale avviata"
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
    ".standings-table-box .standings-skeleton"
  );
  const standingsEl = document.getElementById("standings");

  standingsEl.innerHTML = "";
  standingsEl.classList.remove("hidden");

  fetch(`${API_URL}?action=get_standings&tournament_id=${encodeURIComponent(tournamentId)}`)
    .then(res => res.json())
    .then(data => {
      fadeOutSkeleton(skeleton);
      renderStandings(data);
    })
    .catch(() => {
      standingsEl.innerHTML =
        "<p class='error'>Errore caricamento classifica</p>";
    });
}







// ===============================
// SUBMIT RESULT (WITH LOADING STATE)
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

  // ✅ CREA PRIMA I DATI
  const formData = new URLSearchParams();
  formData.append("action", "submit_result");
  formData.append("tournament_id", tournamentId);
  formData.append("match_id", matchId);
  formData.append("score_a", scoreA);
  formData.append("score_b", scoreB);

  // --- STATO LOADING ---
  btn.innerHTML = `
    <span class="spinner"></span>
    Salvataggio...
  `;
  btn.classList.add("disabled");
  btn.disabled = true;

  inputs.forEach(input => input.disabled = true);

  formData.append("phase", phase);

  fetch(API_URL, {
    method: "POST",
    body: formData
  })
    .then(res => res.text())
    .then(response => {

      if (response === "RESULT_SAVED") {
        card.classList.add("played");

        btn.classList.remove("primary");
        btn.classList.add("secondary");
        btn.textContent = "Modifica risultato";

        showToast("Risultato salvato ✔️");

        // 🔁 riabilita input per eventuale modifica futura
        inputs.forEach(input => input.disabled = false);
        btn.disabled = false;
        btn.classList.remove("disabled");

        // ✅ aggiorna classifica subito
        loadStandings(tournamentId);

        // ✅ aggiorna status torneo (potrebbe diventare final_phase)
        fetch(API_URL)
          .then(r => r.json())
          .then(tournaments => {
            const t = tournaments.find(x => x.tournament_id === tournamentId);
            TOURNAMENT_STATUS = t?.status || TOURNAMENT_STATUS;

            // se è entrato in final_phase, ricarico i match per bloccare gli input
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
    .catch(() => {
      showToast("Errore di rete ❌");
      restoreUI();
    });

  // --- RIPRISTINO UI ---
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
  // ice-pad-1_squad8 → squad8
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
// ===============================
// RENDER STANDINGS (NEW)
// ===============================
function renderStandings(data) {
  const standingsEl = document.getElementById("standings");

  if (!Array.isArray(data) || data.length === 0) {
    standingsEl.innerHTML =
      "<p class='placeholder'>Nessuna classifica disponibile</p>";
    return;
  }

  // ✅ raggruppa per GIRONE (group_id)
  const groupsMap = {};
  data.forEach(row => {
    const gid = row.group_id || "G?";
    if (!groupsMap[gid]) groupsMap[gid] = [];
    groupsMap[gid].push(row);
  });

  // helper sort: "G1","G2"...
  const groupSort = (a, b) => {
    const na = parseInt(String(a).replace(/[^\d]/g, ""), 10) || 0;
    const nb = parseInt(String(b).replace(/[^\d]/g, ""), 10) || 0;
    return na - nb;
  };

  // pulisci e renderizza per girone
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

  // reset
  select.innerHTML = "";

  rounds.forEach((round, index) => {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = `Giornata ${round}`;

    // default selezionata = prima giornata
    if (index === 0) option.selected = true;

    select.appendChild(option);
  });

  // evita doppio binding
  if (select.dataset.initialized === "true") return;
  select.dataset.initialized = "true";

  select.addEventListener("change", e => {
    onRoundChange(e.target.value);
  });
}



function loadFinalsBracket(tournamentId) {
  return fetch(`${API_URL}?action=get_bracket&tournament_id=${encodeURIComponent(tournamentId)}`)
    .then(res => res.json())
    .then(data => {
      return data && data.rounds ? data : null;
    })
    .catch(() => null);
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
  const container = document.getElementById("finals-container");
  if (!container) return;

  container.innerHTML = "";

  const rounds = Object.keys(bracket.rounds)
    .map(Number)
    .sort((a, b) => a - b);

  rounds.forEach(roundId => {
    const matchesInRound = bracket.rounds[roundId];
    const matchCount = matchesInRound.length;
    const roundLabel = getRoundLabel(matchCount);

    const roundBox = document.createElement("div");
    roundBox.className = "finals-round";

    roundBox.innerHTML = `<h3>${escapeHTML(roundLabel)}</h3>`;

    matchesInRound.forEach(match => {
      const card = renderFinalsMatchCard(match, tournamentId);
      roundBox.appendChild(card);
    });

    container.appendChild(roundBox);
  });
}




function renderFinalsMatchCard(match, tournamentId) {
  const card = document.createElement("div");
  card.className = "match-card finals";

  const isPlayed =
    match.played === true ||
    String(match.played).toUpperCase() === "TRUE";

  const tournamentLocked = TOURNAMENT_STATUS === "finished";

  if (isPlayed) card.classList.add("played");
  if (tournamentLocked) card.classList.add("locked");

  // Determina testo e classe del bottone
  let btnText = "Invia risultato";
  let btnClass = "btn primary submit-result";

  if (tournamentLocked) {
    btnText = "Torneo concluso";
    btnClass = "btn secondary submit-result";
  } else if (isPlayed) {
    btnText = "Modifica risultato";
    btnClass = "btn secondary submit-result";
  }

  // Verifica se è un pareggio con vincitore già selezionato
  const scoreA = match.score_a;
  const scoreB = match.score_b;
  const isTieWithWinner = isPlayed && 
    scoreA !== "" && scoreB !== "" && 
    String(scoreA) === String(scoreB) && 
    match.winner_team_id;

  card.innerHTML = `
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

  const formData = new URLSearchParams();
  formData.append("action", "submit_result");
  formData.append("phase", "final");
  formData.append("tournament_id", tournamentId);
  formData.append("match_id", match.match_id);
  formData.append("score_a", scoreA);
  formData.append("score_b", scoreB);

  if (winnerTeamId) {
    formData.append("winner_team_id", winnerTeamId);
  }

  // --- STATO LOADING ---
  btn.innerHTML = `
    <span class="spinner"></span>
    Salvataggio...
  `;
  btn.classList.add("disabled");
  btn.disabled = true;
  inputs.forEach(input => input.disabled = true);

  fetch(API_URL, { method: "POST", body: formData })
    .then(res => res.text())
    .then(resp => {
      if (resp === "RESULT_SAVED") {
        card.classList.add("played");

        // Cambia bottone in "Modifica risultato" con classe secondary
        btn.className = "btn secondary submit-result";
        btn.textContent = "Modifica risultato";
        btn.disabled = false;
        btn.classList.remove("disabled");

        // Riabilita input per eventuale modifica futura
        inputs.forEach(input => input.disabled = false);

        showToast("Risultato finale salvato ✔️");

        // Aggiorna status torneo (potrebbe diventare finished)
        fetch(API_URL)
          .then(r => r.json())
          .then(tournaments => {
            const t = tournaments.find(x => x.tournament_id === tournamentId);
            const oldStatus = TOURNAMENT_STATUS;
            TOURNAMENT_STATUS = t?.status || TOURNAMENT_STATUS;

            // Ricarica bracket (potrebbe esserci un nuovo round)
            loadFinalsBracket(tournamentId)
              .then(bracket => {
                if (bracket) renderFinalsBracket(bracket, tournamentId);
              });

            // Se il torneo è diventato finished, applica layout
            if (TOURNAMENT_STATUS === "finished" && oldStatus !== "finished") {
              applyLayoutByStatus();
            }
          })
          .catch(() => {
            // Fallback: ricarica bracket comunque
            loadFinalsBracket(tournamentId)
              .then(bracket => {
                if (bracket) renderFinalsBracket(bracket, tournamentId);
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
    .catch(() => {
      showToast("Errore di rete ❌");
      restoreUI();
    });

  // --- RIPRISTINO UI ---
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



