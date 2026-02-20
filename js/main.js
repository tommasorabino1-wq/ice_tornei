// ===============================
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");
const sportFilter = document.getElementById("sport-filter");

const API_URL = "https://gettournaments-dzvezz2yhq-uc.a.run.app";

let ALL_TOURNAMENTS = [];

// ===============================
// FETCH TORNEI DAL BACKEND
// ===============================
fetch(API_URL)
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

    ALL_TOURNAMENTS = tournaments;

    const skeletons = container.querySelectorAll(".tournament-card.skeleton");
    skeletons.forEach(card => card.classList.add("fade-out"));

    setTimeout(() => {
      container.innerHTML = "";
      renderTournaments(ALL_TOURNAMENTS);
      populateSportFilter(ALL_TOURNAMENTS);
    }, 350);

  })
  .catch(err => {
    console.error("Errore nel caricamento dei tornei:", err);
    container.innerHTML = "<p>Errore nel caricamento dei tornei. Riprova più tardi.</p>";
  });

// ===============================
// POPOLA FILTRO SPORT DINAMICAMENTE
// ===============================
function populateSportFilter(tournaments) {
  const sports = [...new Set(tournaments.map(t => t.sport))].filter(Boolean).sort();
  
  sportFilter.innerHTML = '<option value="all">Tutti</option>';
  
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
// RENDER CARD TORNEI
// ===============================
function renderTournaments(tournaments) {

  const statusPriority = {
    needs_attention: 0,
    open: 1,
    live: 2,
    final_phase: 3,
    full: 4,
    finished: 5
  };

  tournaments.sort((a, b) => {
    return statusPriority[a.status] - statusPriority[b.status];
  });

  container.innerHTML = "";

  if (tournaments.length === 0) {
    container.innerHTML = "<p class='placeholder' style='grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);'>Nessun torneo trovato per questo sport.</p>";
    return;
  }

  tournaments.forEach(t => {
    const card = document.createElement("div");
    card.className = "tournament-card";
    card.dataset.id = t.tournament_id;

    if (t.status === "finished") {
      card.classList.add("finished");
    }

    // STATUS BADGE
    const statusLabel = buildStatusLabel(t.status);
    const iscrizioniAperte = t.status === "open";

    // ROW 1: Name + Sport + Date + Location
    const row1 = `${t.sport} · ${t.location} · ${t.date}`;

    // ROW 2: Gender + Age + Expertise
    const row2 = buildParticipantsInfo(t);

    // ROW 3: Price + Court + Referee
    const row3 = buildPriceInfo(t);

    // ROW 4: Award
    const row4 = buildAwardInfo(t);

    // ROW 5: Format + Guaranteed Matches
    const row5 = buildFormatInfo(t);

    // ROW 6: Time Range
    const row6 = buildTimeRangeInfo(t);

    // ROW 7: Court/Days/Hours
    const row7 = buildCourtDaysHoursInfo(t);

    // ROW 8: Teams
    const row8 = `${t.teams_current || 0} squadre iscritte`;

    card.innerHTML = `
      <div class="card-header">
        <h3>${escapeHTML(t.name)}</h3>
        <span class="badge ${t.status}">${statusLabel}</span>
      </div>

      <div class="card-body">
        <div class="card-info-rows">
          <div class="card-info-row"><span class="row-icon">🏐</span><span>${escapeHTML(row1)}</span></div>
          <div class="card-info-row"><span class="row-icon">👥</span><span>${row2}</span></div>
          <div class="card-info-row"><span class="row-icon">💰</span><span>${row3}</span></div>
          <div class="card-info-row"><span class="row-icon">🏆</span><span>${row4}</span></div>
          <div class="card-info-row"><span class="row-icon">📋</span><span>${row5}</span></div>
          <div class="card-info-row"><span class="row-icon">📅</span><span>${row6}</span></div>
          <div class="card-info-row"><span class="row-icon">⏰</span><span>${row7}</span></div>
          <div class="card-info-row"><span class="row-icon">✅</span><span>${row8}</span></div>
        </div>
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
// BUILD STATUS LABEL
// ===============================
function buildStatusLabel(status) {
  const labels = {
    open: "ISCRIZIONI APERTE",
    live: "IN CORSO",
    final_phase: "FASE FINALE",
    full: "COMPLETO",
    needs_attention: "IN DEFINIZIONE",
    finished: "CONCLUSO"
  };
  return labels[status] || status.toUpperCase();
}

// ===============================
// BUILD PARTICIPANTS INFO (gender, age, expertise)
// ===============================
function buildParticipantsInfo(t) {
  const parts = [];

  // GENDER
  const genderMap = {
    only_male: "Maschile",
    only_female: "Femminile",
    mixed_strict: "Misto obbligatorio",
    mixed_female_allowed: "Misto o femminile",
    open: "Maschile, Femminile, Misto"
  };
  parts.push(genderMap[t.gender] || "Misto, Maschile, Femminile");

  // AGE
  const ageMap = {
    under_18: "Under 18",
    over_35: "Over 35",
    open: "Tutte le età"
  };
  parts.push(ageMap[t.age] || "Tutte le età");

  // EXPERTISE
  const expertiseMap = {
    open: "Livello amatoriale",
    expert: "Livello agonistico"
  };
  parts.push(expertiseMap[t.expertise] || "Livello amatoriale");

  return parts.join(" · ");
}

// ===============================
// BUILD PRICE INFO (price, court_price, referee_price)
// ===============================
function buildPriceInfo(t) {
  const price = t.price || 0;
  
  // Court price logic
  const courtIncluded = t.court_price && t.court_price !== "non_compreso";
  
  // Referee price logic (NA = no arbitro, quindi non menzionare)
  const hasReferee = t.referee === true || String(t.referee).toUpperCase() === "TRUE";
  const refereeIncluded = hasReferee && t.referee_price && t.referee_price !== "non_compreso" && t.referee_price !== "NA";
  const refereeNA = !hasReferee || t.referee_price === "NA";

  let inclusionText = "";

  if (courtIncluded && refereeIncluded) {
    inclusionText = "campi e arbitro inclusi";
  } else if (courtIncluded && refereeNA) {
    inclusionText = "campi inclusi";
  } else if (courtIncluded && !refereeIncluded) {
    inclusionText = "campi inclusi, arbitro non incluso";
  } else if (!courtIncluded && refereeIncluded) {
    inclusionText = "campi non inclusi, arbitro incluso";
  } else if (!courtIncluded && refereeNA) {
    inclusionText = "campi non inclusi";
  } else {
    inclusionText = "campi e arbitro non inclusi";
  }

  return `€${price} a squadra · ${inclusionText}`;
}

// ===============================
// BUILD AWARD INFO (award, award_amount_perc)
// ===============================
function buildAwardInfo(t) {
  const hasAward = t.award === true || String(t.award).toUpperCase() === "TRUE";
  
  if (!hasAward) {
    return "Premio simbolico (coppe, medaglie)";
  }

  const perc = t.award_amount_perc;
  
  if (perc && perc !== "NA" && !isNaN(Number(perc))) {
    return `Montepremi garantito · ${perc}% delle quote`;
  }

  return "Montepremi garantito";
}

// ===============================
// BUILD FORMAT INFO (format_type, guaranteed_match)
// ===============================
function buildFormatInfo(t) {
  const formatMap = {
    round_robin: "Girone unico solo andata",
    double_round_robin: "Girone unico andata e ritorno",
    round_robin_finals: "Gironi + fasi finali",
    double_round_robin_finals: "Gironi (A/R) + fasi finali"
  };

  const formatText = formatMap[t.format_type] || "Formato da definire";
  const guaranteed = t.guaranteed_match || 0;

  if (guaranteed > 0) {
    return `${formatText} · ${guaranteed} partite garantite`;
  }

  return formatText;
}

// ===============================
// BUILD TIME RANGE INFO
// ===============================
function buildTimeRangeInfo(t) {
  const timeMap = {
    short: "Torneo giornaliero",
    mid: "Gironi su più settimane · Finali in un giorno",
    long: "Gironi e finali su più settimane"
  };

  return timeMap[t.time_range] || "Durata da definire";
}

// ===============================
// BUILD COURT/DAYS/HOURS INFO
// ===============================
function buildCourtDaysHoursInfo(t) {
  const fixed = String(t.fixed_court_days_hours || "").toLowerCase();
  const days = String(t.available_days || "").toLowerCase();
  const hours = String(t.available_hours || "").toLowerCase();

  // Mappings
  const fixedMap = {
    false: "Campi, giorni e orari a scelta",
    only_court: "Campi fissi · Giorni e orari a scelta",
    only_days: "Campi a scelta · Giorni fissi · Orari a scelta",
    only_hours: "Campi a scelta · Giorni a scelta · Orari fissi",
    court_days: "Campi e giorni fissi · Orari a scelta",
    court_hours: "Campi e orari fissi · Giorni a scelta",
    days_hours: "Campi a scelta · Giorni e orari fissi",
    court_days_hours: "Campi, giorni e orari fissi"
  };

  const daysMap = {
    "lun-dom": "Tutti i giorni",
    "lun-ven": "Lun-Ven",
    "sab-dom": "Weekend"
  };

  const hoursMap = {
    "10-22": "10:00-22:00",
    "10-19": "10:00-19:00",
    "19-22": "19:00-22:00"
  };

  const fixedText = fixedMap[fixed] || "Campi, giorni e orari a scelta";
  const daysText = daysMap[days] || "";
  const hoursText = hoursMap[hours] || "";

  const parts = [fixedText];
  
  if (daysText) parts.push(daysText);
  if (hoursText) parts.push(hoursText);

  return parts.join(" · ");
}

// ===============================
// ESCAPE HTML
// ===============================
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// CLICK HANDLING (EVENT DELEGATION)
// ===============================
container.addEventListener("click", e => {
  if (e.target.closest("a") || e.target.closest(".btn")) {
    return;
  }

  const card = e.target.closest(".tournament-card");
  if (!card) return;

  const tournamentId = card.dataset.id;
  window.location.href = `tournament.html?tournament_id=${tournamentId}`;
});