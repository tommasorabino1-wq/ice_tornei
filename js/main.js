// ===============================
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");

// URL della Web App (doGet)
const API_URL =
  "https://script.google.com/macros/s/AKfycbzUiub5CtKe7Ct37UhMQyZh9XMzdnxbF99ezksfSskXyV_NJ0d-5DXM2WXNyR7rscE8Ow/exec";

// ===============================
// FETCH TORNEI DAL BACKEND
// ===============================
fetch(API_URL)
  .then(res => res.json())
  .then(tournaments => {
    if (!Array.isArray(tournaments)) {
      throw new Error("Formato dati non valido");
    }

    // ✅ ora è sicuro rimuovere la skeleton
    // 1️⃣ seleziono tutte le skeleton card
    const skeletons = container.querySelectorAll(".tournament-card.skeleton");

    // 2️⃣ attivo fade-out
    skeletons.forEach(card => card.classList.add("fade-out"));

    // 3️⃣ aspetto la fine dell’animazione
    setTimeout(() => {
      container.innerHTML = "";
      renderTournaments(tournaments);
    }, 350);

  })

  .catch(err => {
    console.error(err);
    container.innerHTML = "<p>Errore nel caricamento dei tornei.</p>";
  });

// ===============================
// RENDER CARD TORNEI
// ===============================
// ===============================
// RENDER CARD TORNEI (ORDERED)
// ===============================
function renderTournaments(tournaments) {

  // 1️⃣ priorità stati
  const statusPriority = {
    needs_attention: 0,
    open: 1,
    live: 2,
    final_phase: 3,
    full: 4,
    finished: 5
  };



  // 2️⃣ ordina tornei
  tournaments.sort((a, b) => {
    return statusPriority[a.status] - statusPriority[b.status];
  });

  // 3️⃣ render normale
  tournaments.forEach(t => {
    const card = document.createElement("div");
    card.className = "tournament-card";
    card.dataset.id = t.tournament_id;

    if (t.status === "finished") {
      card.classList.add("finished");
    }

    card.className = "tournament-card";
    card.dataset.id = t.tournament_id;

    let statusLabel = "";

    if (t.status === "open") statusLabel = "ISCRIZIONI APERTE";
    if (t.status === "live") statusLabel = "IN CORSO";
    if (t.status === "final_phase") statusLabel = "FASE FINALE";
    if (t.status === "full") statusLabel = "COMPLETO";
    if (t.status === "needs_attention") statusLabel = "FINALS IN FASE DI DECISIONE";
    if (t.status === "finished") statusLabel = "TORNEO CONCLUSO";




    const iscrizioniAperte = t.status === "open";

    card.innerHTML = `
      <div class="card-header">
        <span class="badge ${t.status}">${statusLabel}</span>
      </div>

      <h3>${t.name}</h3>

      <div class="card-meta">
        <span>🏐 ${t.sport}</span>
        <span>📍 ${t.location}</span>
        <span>📅 ${t.date}</span>
      </div>

      <div class="card-stats">
        <span>👥 ${t.teams_current} / ${t.teams_max} squadre</span>
        <span>💰 €${t.price}</span>
      </div>

      <div class="card-actions">
        ${
          iscrizioniAperte
            ? `<a href="tournament.html?tournament_id=${t.tournament_id}" class="btn primary">Iscriviti</a>`
            : `<span class="btn primary disabled">Iscriviti</span>`
        }
        <a href="tournament.html?tournament_id=${t.tournament_id}" class="btn secondary">Dettagli</a>
        <a href="standings.html?tournament_id=${t.tournament_id}" class="btn secondary">Classifica</a>
      </div>
    `;

    container.appendChild(card);
  });
}


// ===============================
// CLICK HANDLING (EVENT DELEGATION)
// ===============================
container.addEventListener("click", e => {
  // Se clicco su un bottone o un link → NON apro la card
  if (e.target.closest("a") || e.target.closest(".btn")) {
    return;
  }

  // Se clicco su una card → apro il torneo
  const card = e.target.closest(".tournament-card");
  if (!card) return;

  const tournamentId = card.dataset.id;
  window.location.href = `tournament.html?tournament_id=${tournamentId}`;
});
