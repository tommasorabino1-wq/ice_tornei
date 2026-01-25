// ===============================
// STANDINGS JS
// ===============================

// ⚠️ INSERISCI QUI L’URL DELLA TUA WEB APP
const API_URL = "https://script.google.com/macros/s/AKfycbzXD6iAY1MCMDAbAGjqABqMwsvYB3vR5EgqlmaFyNEU-1tyUUWqC-W68YM6zmYtIwCJgA/exec";

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
  loadMatches(tournamentId);
  loadStandings(tournamentId);
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
  } else {
    hideSkeletons();      // 👈 AGGIUNGI QUESTO
    showTournamentFilter();
  }
});






// ===============================
// GET TOURNAMENT ID
// ===============================
function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tournament_id") || params.get("id");
}

// ===============================
// SHOW TOURNAMENT FILTER
// ===============================
function showTournamentFilter() {
  const filterBox = document.getElementById("tournament-filter");
  const select = document.getElementById("tournament-select");

  filterBox.classList.remove("hidden");

  fetch(`${API_URL}?action=get_tournaments`)
    .then(res => res.json())
    .then(tournaments => {
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
    history.replaceState(null, "", `?tournament_id=${tournamentId}`);

    
    document
      .querySelectorAll(".standings-results-box, .standings-table-box")
      .forEach(box => {
        box.classList.remove("hidden", "fade-out");
      });


    loadStandingsPage(tournamentId);
    hideTournamentFilter();
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
  standingsEl.classList.remove("hidden"); // ⚠️ fondamentale

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
    container.innerHTML =
      "<p class='placeholder'>Nessun match disponibile</p>";
    return;
  }

  // 1️⃣ Raggruppa per round
  const roundsMap = {};
  matches.forEach(match => {
    if (!roundsMap[match.round_id]) {
      roundsMap[match.round_id] = [];
    }
    roundsMap[match.round_id].push(match);
  });

  Object.entries(roundsMap).forEach(([roundId, roundMatches], index) => {
    const roundGroup = document.createElement("div");
    roundGroup.className = "round-group";
    if (index !== 0) roundGroup.classList.add("collapsed");

    const roundTitle = document.createElement("div");
    roundTitle.className = "round-title";
    roundTitle.textContent = roundId;

    roundTitle.addEventListener("click", () => {
      container.querySelectorAll(".round-group")
        .forEach(g => g !== roundGroup && g.classList.add("collapsed"));
      roundGroup.classList.toggle("collapsed");
    });

    roundGroup.appendChild(roundTitle);

    const matchesWrapper = document.createElement("div");
    matchesWrapper.className = "round-matches";
    roundGroup.appendChild(matchesWrapper);

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
          <span class="team">${formatTeam(match.team_a)}</span>
          <input type="number" class="score-input" value="${isPlayed ? match.score_a : ""}">
          <span class="dash">-</span>
          <input type="number" class="score-input" value="${isPlayed ? match.score_b : ""}">
          <span class="team">${formatTeam(match.team_b)}</span>
        </div>
        <button class="btn ${isPlayed ? "secondary" : "primary"} submit-result">
          ${isPlayed ? "Modifica risultato" : "Invia risultato"}
        </button>
      `;

      card.querySelector(".submit-result")
        .addEventListener("click", () =>
          submitResult(card, match.match_id, tournamentId)
        );

      matchesWrapper.appendChild(card);
    });

    container.appendChild(roundGroup);
  });
}






// ===============================
// SUBMIT RESULT
// ===============================
function submitResult(card, matchId, tournamentId) {
  const inputs = card.querySelectorAll(".score-input");

  const scoreA = inputs[0].value;
  const scoreB = inputs[1].value;

  if (scoreA === "" || scoreB === "") {
    alert("Inserisci entrambi i punteggi");
    return;
  }

  const formData = new URLSearchParams();
  formData.append("action", "submit_result");
  formData.append("tournament_id", tournamentId);
  formData.append("match_id", matchId);
  formData.append("score_a", scoreA);
  formData.append("score_b", scoreB);

  fetch(API_URL, {
    method: "POST",
    body: formData
  })
    .then(res => res.text())
    .then(response => {
      if (response === "RESULT_SAVED") {
        card.classList.add("played");

        const btn = card.querySelector(".submit-result");
        btn.classList.remove("primary");
        btn.classList.add("secondary");
        btn.textContent = "Modifica risultato";

        showToast("Risultato salvato ✔️");
      } else {
        alert("Errore: " + response);
      }
    })
    .catch(() => {
      alert("Errore di rete");
    });
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
function renderStandings(data) {
  const standingsEl = document.getElementById("standings");

  if (!Array.isArray(data) || data.length === 0) {
    standingsEl.innerHTML =
      "<p class='placeholder'>Nessuna classifica disponibile</p>";
    return;
  }

  const roundsMap = {};
  data.forEach(row => {
    if (!roundsMap[row.round_id]) {
      roundsMap[row.round_id] = [];
    }
    roundsMap[row.round_id].push(row);
  });

  Object.entries(roundsMap).forEach(([roundId, teams]) => {
    teams.sort((a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.matches_played - a.matches_played
    );

    const group = document.createElement("div");
    group.className = "standings-group";

    group.innerHTML = `
      <h3 class="standings-title">${roundId}</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Squadra</th>
            <th>Pts</th>
            <th>PG</th>
            <th>V</th>
            <th>P</th>
            <th>S</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          ${teams.map(team => `
            <tr>
              <td>${team.team_name}</td>
              <td>${team.points}</td>
              <td>${team.matches_played ?? 0}</td>
              <td>${team.wins}</td>
              <td>${team.draws}</td>
              <td>${team.losses}</td>
              <td>${team.goal_diff}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    standingsEl.appendChild(group);
  });
}
