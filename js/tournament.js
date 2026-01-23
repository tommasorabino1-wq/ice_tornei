// ===============================
// TOURNAMENT PAGE LOGIC (ICE)
// ===============================

// ===============================
// 1. PARAMETRI URL
// ===============================
const params = new URLSearchParams(window.location.search);
const tournamentId = params.get("id");

// ===============================
// 2. ELEMENTI DOM
// ===============================
const container = document.querySelector(".container");

// Sezioni principali
const genericSection = document.getElementById("generic-regulation-section");
const tournamentSection = document.getElementById("tournament-specific-section");

// Torneo UI
const badge = document.getElementById("tournament-status-badge");
const subscribeMessage = document.getElementById("subscribe-message");
const form = document.getElementById("registration-form");
const teamsInfo = document.getElementById("info-teams");

// Select tornei
const tournamentSelect = document.getElementById("tournament-select");

// ===============================
// 3. API URL
// ===============================
const API_URL =
  "https://script.google.com/macros/s/AKfycbzXD6iAY1MCMDAbAGjqABqMwsvYB3vR5EgqlmaFyNEU-1tyUUWqC-W68YM6zmYtIwCJgA/exec";


if (tournamentId) {
  genericSection.style.display = "none";
  tournamentSection.style.display = "block";
}



// ===============================
// 4. FETCH TORNEI (WITH SKELETON FADE)
// ===============================
fetch(API_URL)
  .then(res => res.json())
  .then(tournaments => {
    if (!Array.isArray(tournaments)) {
      throw new Error("Formato dati non valido");
    }

    // 🔥 fade-out skeleton
    const skeletons = document.querySelectorAll(".skeleton, .skeleton-line, .skeleton-title");
    skeletons.forEach(el => el.classList.add("fade-out"));

    setTimeout(() => {

      // CASO 1: ID PRESENTE
      if (tournamentId) {
        const tournament = tournaments.find(
          t => t.tournament_id === tournamentId
        );

        if (!tournament) {
          renderGenericRegulation(tournaments);
          return;
        }

        renderTournament(tournament);
        return;
      }

      // CASO 2: NESSUN ID
      renderGenericRegulation(tournaments);

    }, 350); // allineato al CSS
  })
  .catch(err => {
    console.error(err);
    container.innerHTML = "<p>Errore nel caricamento dei dati.</p>";
  });


// ===============================
// 5. REGOLAMENTO GENERALE + SELECT
// ===============================
function renderGenericRegulation(tournaments) {
  // VISIBILITÀ
  genericSection.style.display = "block";
  tournamentSection.style.display = "none";

  // Reset select
  tournamentSelect.innerHTML =
    `<option value="">Seleziona un torneo</option>`;

  tournaments.forEach(t => {
    const option = document.createElement("option");
    option.value = t.tournament_id;
    option.textContent = `${t.name} · ${t.date} · ${t.location}`;
    tournamentSelect.appendChild(option);
  });

  // Redirect su torneo
  tournamentSelect.onchange = function () {
    if (!this.value) return;
    window.location.href = `tournament.html?id=${this.value}`;
  };
}

// ===============================
// 6. RENDER TORNEO SPECIFICO
// ===============================
function renderTournament(tournament) {
  // VISIBILITÀ
  genericSection.style.display = "none";
  tournamentSection.style.display = "block";

  // 🔥 rimuovo classi skeleton residue
  const skeletonElements = tournamentSection.querySelectorAll(".skeleton, .skeleton-line, .skeleton-title");
  skeletonElements.forEach(el => {
    el.classList.remove("skeleton", "skeleton-line", "skeleton-title", "fade-out");
  });

  // Header
  document.getElementById("tournament-name").textContent = tournament.name;
  document.getElementById("tournament-subtitle").textContent =
    `${tournament.location} · ${tournament.date} · ${tournament.sport}`;

  // Info
  document.getElementById("info-sport").textContent = tournament.sport;
  document.getElementById("info-location").textContent = tournament.location;
  document.getElementById("info-date").textContent = tournament.date;
  document.getElementById("info-price").textContent = tournament.price;

  teamsInfo.textContent =
    `${tournament.teams_current} / ${tournament.teams_max}`;

  applyTournamentState(tournament);

  if (tournament.status === "open") {
    handleFormSubmit(tournament);
  }
}


// ===============================
// 7. STATO TORNEO (UI)
// ===============================
function applyTournamentState(tournament) {
  form.style.display = "none";
  form.classList.remove("skeleton");

  badge.className = "badge";

  if (tournament.status === "open") {
    badge.textContent = "ISCRIZIONI APERTE";
    badge.classList.add("open");
    subscribeMessage.textContent = "Le iscrizioni sono aperte.";
    form.style.display = "flex";
    return;
  }

  if (tournament.status === "full") {
    badge.textContent = "COMPLETO";
    badge.classList.add("full");
    subscribeMessage.textContent =
      "Le iscrizioni sono chiuse. Numero massimo di squadre raggiunto.";
    return;
  }

  if (tournament.status === "live") {
    badge.textContent = "IN CORSO";
    badge.classList.add("live");
    subscribeMessage.textContent =
      "Il torneo è in corso. Le iscrizioni sono chiuse.";
  }
}


// ===============================
// 8. SUBMIT ISCRIZIONE
// ===============================
function handleFormSubmit(tournament) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(form);
    formData.append("tournament_id", tournament.tournament_id);

    fetch(API_URL, {
      method: "POST",
      body: formData
    })
      .then(res => res.text())
      .then(response => {
          if (response === "TOURNAMENT_NOT_FOUND") {
            showToast("Torneo non valido ❌");
            return;
          }

          if (response === "INVALID_DATA") {
            showToast("Dati mancanti o non validi ⚠️");
            return;
          }

          if (response === "DUPLICATE") {
            showToast("Questa email è già iscritta ⚠️");
            return;
          }

        if (response === "SUBSCRIPTION_SAVED") {
          showToast("Iscrizione completata 🎉");

          // ricarico per aggiornare teams_current / stato torneo
          setTimeout(() => {
            window.location.reload();
          }, 1200);

          return;
        }


        showToast("Errore inatteso ❌");
      })
      .catch(() => {
        showToast("Errore inatteso ❌");
      });
  });
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
