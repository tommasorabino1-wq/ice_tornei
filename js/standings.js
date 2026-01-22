// ===============================
// STANDINGS JS
// ===============================

// ⚠️ INSERISCI QUI L’URL DELLA TUA WEB APP
const API_URL = "https://script.google.com/macros/s/AKfycbxadjrMF3-F3UAVxS5iKw1VhcusaXOVHGu7sNVCAy7ELTmRYayDeTWKzePwMSyJK-DNYQ/exec";

document.addEventListener("DOMContentLoaded", () => {
  const tournamentId = getTournamentIdFromUrl();
  const matchesListEl = document.getElementById("matches-list");

  if (!tournamentId) {
    matchesListEl.innerHTML = "<p class='error'>Torneo non specificato</p>";
    return;
  }

  loadMatches(tournamentId);
});

// ===============================
// GET TOURNAMENT ID
// ===============================
function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tournament_id");
}

// ===============================
// LOAD MATCHES
// ===============================
function loadMatches(tournamentId) {
  fetch(`${API_URL}?action=get_matches&tournament_id=${encodeURIComponent(tournamentId)}`)
    .then(res => res.json())
    .then(matches => renderMatches(matches, tournamentId))
    .catch(() => {
      document.getElementById("matches-list").innerHTML =
        "<p class='error'>Errore caricamento match</p>";
    });
}

// ===============================
// RENDER MATCH LIST
// ===============================
function renderMatches(matches, tournamentId) {
  const container = document.getElementById("matches-list");

  if (!matches.length) {
    container.innerHTML = "<p class='placeholder'>Nessun match disponibile</p>";
    return;
  }

  container.innerHTML = "";

  matches.forEach(match => {
    const card = document.createElement("div");
    card.className = "match-card";

    card.innerHTML = `
      <div class="match-header">
        <strong>${match.round_id}</strong>
      </div>

      <div class="match-teams">
        <span class="team">${formatTeam(match.team_a)}</span>

        <input type="number" min="0" class="score-input" placeholder="0" data-side="a">

        <span class="dash">-</span>

        <input type="number" min="0" class="score-input" placeholder="0" data-side="b">

        <span class="team">${formatTeam(match.team_b)}</span>
      </div>

      <button class="btn primary submit-result">
        Invia risultato
      </button>
    `;

    const button = card.querySelector(".submit-result");
    button.addEventListener("click", () => {
      submitResult(card, match.match_id, tournamentId);
    });

    container.appendChild(card);
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
        card.remove();
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
