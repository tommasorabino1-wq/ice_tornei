// ===============================
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");
const sportFilter = document.getElementById("sport-filter");

// URL della Web App (doGet)
const API_URL =
  "https://script.google.com/macros/s/AKfycbx_J7kEn3eI87crMvo6lKLBp5bmbT5ukCcYhYsl9DCIjFxEZjbgxPKCvj-kWNzJdWvhQA/exec";

// Variabile globale per conservare tutti i tornei
let ALL_TOURNAMENTS = [];

// ===============================
// FETCH TORNEI DAL BACKEND
// ===============================
fetch(API_URL)
  .then(res => res.json())
  .then(tournaments => {
    if (!Array.isArray(tournaments)) {
      throw new Error("Formato dati non valido");
    }

    // Salva tutti i tornei
    ALL_TOURNAMENTS = tournaments;

    // ✅ ora è sicuro rimuovere la skeleton
    // 1️⃣ seleziono tutte le skeleton card
    const skeletons = container.querySelectorAll(".tournament-card.skeleton");

    // 2️⃣ attivo fade-out
    skeletons.forEach(card => card.classList.add("fade-out"));

    // 3️⃣ aspetto la fine dell'animazione
    setTimeout(() => {
      container.innerHTML = "";
      renderTournaments(ALL_TOURNAMENTS);
      
      // ✅ Popola dinamicamente il filtro sport
      populateSportFilter(ALL_TOURNAMENTS);
    }, 350);

  })

  .catch(err => {
    console.error(err);
    container.innerHTML = "<p>Errore nel caricamento dei tornei.</p>";
  });

// ===============================
// POPOLA FILTRO SPORT DINAMICAMENTE
// ===============================
function populateSportFilter(tournaments) {
  // Estrai sport unici dai tornei
  const sports = [...new Set(tournaments.map(t => t.sport))].sort();
  
  // Rimuovi le opzioni esistenti tranne "Tutti gli sport"
  sportFilter.innerHTML = '<option value="all">Tutti gli sport</option>';
  
  // Aggiungi gli sport trovati
  sports.forEach(sport => {
    const option = document.createElement("option");
    option.value = sport;
    option.textContent = sport;
    sportFilter.appendChild(option);
  });
}

// ===============================
// EVENT LISTENER FILTRO SPORT
// ===============================
sportFilter.addEventListener("change", (e) => {
  const selectedSport = e.target.value;
  
  if (selectedSport === "all") {
    renderTournaments(ALL_TOURNAMENTS);
  } else {
    const filtered = ALL_TOURNAMENTS.filter(t => t.sport === selectedSport);
    renderTournaments(filtered);
  }
});

// ===============================
// RENDER CARD TORNEI (ORDERED)
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

  // Pulisci container
  container.innerHTML = "";

  // Controllo se non ci sono tornei
  if (tournaments.length === 0) {
    container.innerHTML = "<p class='placeholder' style='grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);'>Nessun torneo trovato per questo sport.</p>";
    return;
  }

  // 3️⃣ render normale
  tournaments.forEach(t => {
    const card = document.createElement("div");
    card.className = "tournament-card";
    card.dataset.id = t.tournament_id;

    if (t.status === "finished") {
      card.classList.add("finished");
    }

    let statusLabel = "";

    if (t.status === "open") statusLabel = "ISCRIZIONI APERTE";
    if (t.status === "live") statusLabel = "IN CORSO";
    if (t.status === "final_phase") statusLabel = "FASE FINALE";
    if (t.status === "full") statusLabel = "COMPLETO";
    if (t.status === "needs_attention") statusLabel = "FINALS IN FASE DI DECISIONE";
    if (t.status === "finished") statusLabel = "TORNEO CONCLUSO";

    const iscrizioniAperte = t.status === "open";

    // ✅ LOGICA CAMPI/GIORNI/ORARI
    const courtInfo = buildCourtInfoMessage(t);

    card.innerHTML = `
      <div class="card-header">
        <span class="badge ${t.status}">${statusLabel}</span>
      </div>

      <h3>${t.name}</h3>

      <div class="card-meta">
        <span>🏐 ${t.sport}</span>
        <span>📍 ${t.location}</span>
        <span>📅 ${t.date}</span>
        <span>⏰ ${courtInfo}</span>
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
// BUILD COURT INFO MESSAGE (NEW)
// ===============================
function buildCourtInfoMessage(tournament) {
  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim();
  const hours = String(tournament.available_hours || "").trim();

  // CASO 1: Campi fissi → organizzazione decide tutto
  if (fixedCourt) {
    return "Campi, giorni e orari prefissati";
  }

  // CASO 2: Campi a scelta
  let message = "Campi a scelta";

  // Se mancano info su giorni/orari → solo "Campi a scelta"
  if (!days || days === "NA" || !hours || hours === "NA") {
    return message;
  }

  // Mapping giorni
  const daysText = mapDaysToText(days);
  
  // Mapping orari
  const hoursText = mapHoursToText(hours);

  // Costruisci messaggio completo
  if (daysText && hoursText) {
    message += ` - ${daysText} ${hoursText}`;
  } else if (daysText) {
    message += ` - ${daysText}`;
  } else if (hoursText) {
    message += ` - ${hoursText}`;
  }

  return message;
}

// ===============================
// MAP DAYS TO TEXT (NEW)
// ===============================
function mapDaysToText(days) {
  const daysLower = days.toLowerCase();

  const mappings = {
    "lun-ven": "lun-ven",
    "lun-dom": "ogni giorno",
    "sab-dom": "weekend"
  };

  return mappings[daysLower] || days;
}

// ===============================
// MAP HOURS TO TEXT (NEW)
// ===============================
function mapHoursToText(hours) {
  const hoursLower = hours.toLowerCase();

  const mappings = {
    "10-19": "10-19",
    "19-22": "19-22",
    "10-22": "10-22"
  };

  const mapped = mappings[hoursLower];
  
  if (!mapped) return hours;

  // Estrai ore
  const [start, end] = mapped.split("-");
  return `dalle ${start} alle ${end}`;
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