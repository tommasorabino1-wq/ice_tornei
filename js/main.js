// ===============================
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");

// URL della Web App (doGet)
const API_URL =
  "https://script.google.com/macros/s/AKfycbzmxdKwYz5Q-6llgXWukNKoXjYgSEnG0qjuVfA8AymUTZiF8kmnntYpcIBGNC3RWvnj8g/exec";

// ===============================
// FETCH TORNEI DAL BACKEND
// ===============================
fetch(API_URL)
  .then(res => res.json())
  .then(tournaments => {
    if (!Array.isArray(tournaments)) {
      throw new Error("Formato dati non valido");
    }

    renderTournaments(tournaments);
  })
  .catch(err => {
    console.error(err);
    container.innerHTML =
      "<p>Errore nel caricamento dei tornei.</p>";
  });

// ===============================
// RENDER CARD TORNEI
// ===============================
function renderTournaments(tournaments) {
  container.innerHTML = "";

  tournaments.forEach(t => {
    const card = document.createElement("a");
    card.className = "tournament-card";
    card.href = `tournament.html?id=${t.tournament_id}`;

    // Stato torneo
    let statusLabel = "";
    if (t.status === "open") statusLabel = "ISCRIZIONI APERTE";
    if (t.status === "full") statusLabel = "COMPLETO";
    if (t.status === "live") statusLabel = "IN CORSO";

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
            ? `<span class="btn primary">Iscriviti</span>`
            : `<span class="btn primary disabled">Iscriviti</span>`
        }
        <span class="btn secondary">Dettagli</span>
        <span class="btn secondary">Classifica</span>
      </div>
    `;

    container.appendChild(card);
  });
}
