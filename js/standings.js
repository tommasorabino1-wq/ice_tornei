// ===============================
// STANDINGS JS
// ===============================

// ⚠️ INSERISCI QUI L’URL DELLA TUA WEB APP
const API_URL = "https://script.google.com/macros/s/AKfycbwdnHY6tmQpXHoDP5mXVJ5mbjEym_jndYLlFKGoI3Kx2pF06IfKXQUNPCi5eoj7D3VD1A/exec";

let TOURNAMENT_STATUS = null;


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

      loadMatches(tournamentId);
      loadStandings(tournamentId);
    });
}


function hideSkeletons() {
  document
    .querySelectorAll(".standings-skeleton")
    .forEach(s => s.classList.add("hidden"));
}





document.addEventListener("DOMContentLoaded", () => {
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
      renderMatches(matches, tournamentId);
    })
    .catch(() => {
      list.innerHTML = "<p class='error'>Errore caricamento match</p>";
    });
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
// RENDER MATCH LIST
// ===============================
function renderMatches(matches, tournamentId) {
  const container = document.getElementById("matches-list");

  if (!Array.isArray(matches) || matches.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match disponibile</p>";
    return;
  }

  // ✅ 1) raggruppa per GIORNATA (round_id)
  // daysMap[round_id][group_id] = [matches]
  const daysMap = {};
  matches.forEach(m => {
    const day = Number(m.round_id) || 0;       // giornata
    const gid = m.group_id || "G?";            // girone

    if (!daysMap[day]) daysMap[day] = {};
    if (!daysMap[day][gid]) daysMap[day][gid] = [];
    daysMap[day][gid].push(m);
  });

  container.innerHTML = "";

  const dayIds = Object.keys(daysMap)
    .map(Number)
    .sort((a, b) => a - b);

  dayIds.forEach((day, dayIndex) => {
    const dayGroup = document.createElement("div");
    dayGroup.className = "round-group";
    if (dayIndex !== 0) dayGroup.classList.add("collapsed");

    const dayTitle = document.createElement("div");
    dayTitle.className = "round-title";
    dayTitle.textContent = `Giornata ${day}`;
    dayTitle.addEventListener("click", () => {
      container.querySelectorAll(".round-group")
        .forEach(g => g !== dayGroup && g.classList.add("collapsed"));
      dayGroup.classList.toggle("collapsed");
    });

    dayGroup.appendChild(dayTitle);

    const dayWrapper = document.createElement("div");
    dayWrapper.className = "round-matches";
    dayGroup.appendChild(dayWrapper);

    // ✅ 2) dentro la giornata, separa per girone
    const groupIds = Object.keys(daysMap[day]).sort((a, b) => {
      const na = parseInt(String(a).replace(/[^\d]/g, ""), 10) || 0;
      const nb = parseInt(String(b).replace(/[^\d]/g, ""), 10) || 0;
      return na - nb;
    });

    groupIds.forEach(groupId => {
      const groupBlock = document.createElement("div");
      groupBlock.className = "matches-subgroup";

      groupBlock.innerHTML = `
        <div class="matches-subgroup-title">Girone ${escapeHTML(groupId)}</div>
      `;

      const list = document.createElement("div");
      list.className = "matches-subgroup-list";
      groupBlock.appendChild(list);

      const roundMatches = daysMap[day][groupId];

      const toPlay = [];
      const played = [];

      roundMatches.forEach(match => {
        const isPlayed =
          match.played === true ||
          match.played === "TRUE" ||
          match.played === "true" ||
          match.played === 1;

        isPlayed ? played.push(match) : toPlay.push(match);
      });

      const locked = TOURNAMENT_STATUS === "final_phase";

      [...toPlay, ...played].forEach(match => {
        const isPlayed =
          match.played === true ||
          match.played === "TRUE" ||
          match.played === "true" ||
          match.played === 1;

        const card = document.createElement("div");
        card.className = "match-card";
        if (isPlayed) card.classList.add("played");

        card.innerHTML = `
          <div class="match-teams">
            <span class="team">${escapeHTML(formatTeam(match.team_a))}</span>

            <input type="number"
              class="score-input"
              ${locked ? "disabled" : ""}
              value="${isPlayed ? (match.score_a ?? "") : ""}">

            <span class="dash">-</span>

            <input type="number"
              class="score-input"
              ${locked ? "disabled" : ""}
              value="${isPlayed ? (match.score_b ?? "") : ""}">

            <span class="team">${escapeHTML(formatTeam(match.team_b))}</span>
          </div>

          <button class="btn secondary submit-result" ${locked ? "disabled" : ""}>
            ${
              locked
                ? "Fase finale"
                : isPlayed
                  ? "Modifica risultato"
                  : "Invia risultato"
            }
          </button>
        `;

        if (!locked) {
          card.querySelector(".submit-result")
            .addEventListener("click", () =>
              submitResult(card, match.match_id, tournamentId)
            );
        }

        list.appendChild(card);
      });

      dayWrapper.appendChild(groupBlock);
    });

    container.appendChild(dayGroup);
  });
}






// ===============================
// SUBMIT RESULT
// ===============================
// ===============================
// SUBMIT RESULT (WITH LOADING STATE)
// ===============================
function submitResult(card, matchId, tournamentId) {
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

