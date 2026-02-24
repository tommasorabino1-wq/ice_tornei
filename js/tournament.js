// ===============================
// TOURNAMENT PAGE LOGIC (ICE)
// ===============================

// ===============================
// 1. PARAMETRI URL
// ===============================
const params = new URLSearchParams(window.location.search);
const tournamentId = params.get("tournament_id");

// ===============================
// 2. ELEMENTI DOM
// ===============================

// Sezioni principali
const genericSection = document.getElementById("generic-regulation-section");
const tournamentSection = document.getElementById("tournament-specific-section");
const tournamentSkeleton = document.querySelector(".tournament-skeleton");

// Torneo UI
const badge = document.getElementById("tournament-status-badge");
const subscribeMessage = document.getElementById("subscribe-message");
const form = document.getElementById("registration-form");
const teamsInfo = document.getElementById("info-teams");

// Teams list UI
const teamsListSection = document.getElementById("tournament-teams-section");
const teamsListCount = document.getElementById("teams-list-count");
const teamsListContainer = document.getElementById("teams-list-container");

// Select tornei
const tournamentSelect = document.getElementById("tournament-select");

// ===============================
// 3. API URLS (FIREBASE FUNCTIONS)
// ===============================
const API_URLS = {
  getTournaments: "https://gettournaments-dzvezz2yhq-uc.a.run.app",
  getTeams: "https://getteams-dzvezz2yhq-uc.a.run.app",
  submitSubscription: "https://submitsubscription-dzvezz2yhq-uc.a.run.app"
};



// ===============================
// 4. STATO INIZIALE UI
// ===============================
if (tournamentId) {
  genericSection.classList.add("hidden");
  tournamentSkeleton.classList.remove("hidden");
  tournamentSection.classList.add("hidden");
} else {
  genericSection.classList.remove("hidden");
  tournamentSkeleton.classList.add("hidden");
  tournamentSection.classList.add("hidden");
}

// ===============================
// 5. FETCH TORNEI (WITH SKELETON FADE)
// ===============================
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

    // 🔥 fade-out skeleton
    if (tournamentId) {
      tournamentSkeleton.classList.add("fade-out");
    }

    setTimeout(() => {
      if (tournamentId) {
        const tournament = tournaments.find(
          t => t.tournament_id === tournamentId
        );

        if (!tournament) {
          tournamentSkeleton.classList.add("hidden");
          renderGenericRegulation(tournaments);
          return;
        }

        tournamentSkeleton.classList.add("hidden");
        tournamentSection.classList.remove("hidden");
        renderTournament(tournament);
        return;
      }

      renderGenericRegulation(tournaments);
    }, 350);

  })
  .catch(err => {
    console.error("Errore nel caricamento dei tornei:", err);
    genericSection.classList.remove("hidden");
    tournamentSkeleton.classList.add("hidden");
    tournamentSection.classList.add("hidden");
    showToast("Errore nel caricamento dei dati ❌");
  });

// ===============================
// 6. REGOLAMENTO GENERALE + SELECT
// ===============================
function renderGenericRegulation(tournaments) {
  genericSection.classList.remove("hidden");
  tournamentSection.classList.add("hidden");
  tournamentSkeleton.classList.add("hidden");

  // ✅ NASCONDI regolamento full-width duplicato (non serve nella vista generale)
  const regulationBlockDuplicate = document.querySelector("#tournament-specific-section + .tournament-general-regulation");
  if (regulationBlockDuplicate) {
    regulationBlockDuplicate.classList.add("hidden");
  }

  // Reset select
  tournamentSelect.innerHTML = `<option value="">Seleziona un torneo</option>`;

  tournaments.forEach(t => {
    const option = document.createElement("option");
    option.value = t.tournament_id;
    option.textContent = `${t.name} · ${t.date}`;
    tournamentSelect.appendChild(option);
  });

  // Redirect su torneo
  tournamentSelect.onchange = function () {
    if (!this.value) return;
    window.location.href = `tournament.html?tournament_id=${this.value}`;
  };
}














// ===============================
// 7. INFO-BOX TORNEO
// ===============================
function renderTournament(tournament) {
  genericSection.classList.add("hidden");
  tournamentSection.classList.remove("hidden");

  // Header
  document.getElementById("tournament-name").textContent = tournament.name;
  document.getElementById("tournament-subtitle").textContent =
    `${tournament.location} · ${tournament.date} · ${tournament.sport}`;

  // ✅ Info torneo (nuova versione con righe)
  renderTournamentInfoRows(tournament);

  // ✅ Regola specifica campi
  renderSpecificCourtRule(tournament);

  // Apply state & form behavior
  applyTournamentState(tournament);

  if (tournament.status === "open") {
    populateExtraFields(tournament);
    handleFormSubmit(tournament);
  }

  // Load + render teams list block
  loadAndRenderTeamsList(tournament);
}


// ===============================
// 7b. RENDER TOURNAMENT INFO ROWS
// ===============================
function renderTournamentInfoRows(tournament) {
  const container = document.getElementById("tournament-info-rows");
  if (!container) return;

  // ROW 1: Sport + Location + Date
  const row1 = `${tournament.sport} · ${tournament.location} · ${tournament.date}`;

  // ROW 2: Gender + Age + Expertise
  const row2 = buildParticipantsInfoText(tournament);

  // ROW 3: Price + Court + Referee
  const row3 = buildPriceInfoText(tournament);

  // ROW 4: Award
  const row4 = buildAwardInfoText(tournament);

  // ROW 5: Format + Guaranteed Matches
  const row5 = buildFormatInfoText(tournament);

  // ROW 6: Time Range
  const row6 = buildTimeRangeInfoText(tournament);

  // ROW 7: Court/Days/Hours
  const row7 = buildCourtDaysHoursInfoText(tournament);

  // ROW 8: Teams
  const teamsCurrent = tournament.teams_current || 0;
  const teamsMax = tournament.teams_max || 0;
  const row8 = `${teamsCurrent} / ${teamsMax} squadre iscritte`;

  container.innerHTML = `
    <div class="info-row"><span class="info-row-icon">🏐</span><span><strong>Sport, Luogo, Data:</strong> ${escapeHTML(row1)}</span></div>
    <div class="info-row"><span class="info-row-icon">👥</span><span><strong>Partecipanti:</strong> ${row2}</span></div>
    <div class="info-row"><span class="info-row-icon">💰</span><span><strong>Iscrizione:</strong> ${row3}</span></div>
    <div class="info-row"><span class="info-row-icon">🏆</span><span><strong>Montepremi:</strong> ${row4}</span></div>
    <div class="info-row"><span class="info-row-icon">📋</span><span><strong>Formato:</strong> ${row5}</span></div>
    <div class="info-row"><span class="info-row-icon">📅</span><span><strong>Durata:</strong> ${row6}</span></div>
    <div class="info-row"><span class="info-row-icon">⏰</span><span><strong>Partite:</strong> ${row7}</span></div>
    <div class="info-row"><span class="info-row-icon">✅</span><span><strong>Iscritti:</strong> ${row8}</span></div>
  `;
}

// ===============================
// 7c. BUILD PARTICIPANTS INFO TEXT
// ===============================
function buildParticipantsInfoText(t) {
  const parts = [];

  const genderMap = {
    only_male: "Solo ragazzi",
    only_female: "Solo ragazze",
    mixed_strict: "Misto obbligatorio",
    mixed_female_allowed: "Misto o femminile",
    open: "Aperto a tutti"
  };
  parts.push(genderMap[t.gender] || "Aperto a tutti");

  const ageMap = {
    under_18: "Under 18",
    over_35: "Over 35",
    open: "Tutte le età"
  };
  parts.push(ageMap[t.age] || "Tutte le età");

  const expertiseMap = {
    open: "Livello amatoriale",
    expert: "Livello agonistico"
  };
  parts.push(expertiseMap[t.expertise] || "Livello amatoriale");

  return parts.join(" · ");
}

// ===============================
// 7d. BUILD PRICE INFO TEXT
// ===============================
function buildPriceInfoText(t) {
  const price = t.price || 0;
  
  const courtIncluded = t.court_price && t.court_price !== "non_compreso";
  
  const refereePrice = String(t.referee_price || "NA").toLowerCase();
  const refereeIncluded = refereePrice !== "na" && refereePrice !== "non_compreso";
  const refereeNA = refereePrice === "na";

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
// 7e. BUILD AWARD INFO TEXT
// ===============================
function buildAwardInfoText(t) {
  const hasAward = t.award === true || String(t.award).toUpperCase() === "TRUE";
  
  if (!hasAward) {
    return "Solo premi simbolici";
  }

  const perc = t.award_amount_perc;
  const price = Number(t.price) || 0;
  const teamsMax = Number(t.teams_max) || 0;
  
  if (perc && perc !== "NA" && !isNaN(Number(perc)) && price > 0 && teamsMax > 0) {
    const percValue = Number(perc) / 100;
    const totalPrize = Math.round(teamsMax * price * percValue);
    return `€${totalPrize}`;
  }

  return "Montepremi garantito";
}

// ===============================
// 7f. BUILD FORMAT INFO TEXT
// ===============================
function buildFormatInfoText(t) {
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
// 7g. BUILD TIME RANGE INFO TEXT
// ===============================
function buildTimeRangeInfoText(t) {
  const timeMap = {
    short: "Torneo giornaliero",
    mid: "Gironi su più settimane · Finali in un giorno",
    long: "Gironi e finali su più settimane"
  };

  return timeMap[t.time_range] || "Durata da definire";
}

// ===============================
// 7h. BUILD COURT/DAYS/HOURS INFO TEXT
// ===============================
function buildCourtDaysHoursInfoText(t) {
  const fixed = String(t.fixed_court_days_hours || "false").toLowerCase();
  const days = String(t.available_days || "").toLowerCase();
  const hours = String(t.available_hours || "").toLowerCase();

  // Mapping per cosa è fisso/variabile
  const fixedMap = {
    "false": "Campi, giorni e orari a scelta",
    "court_all": "Campi fissi · Giorni e orari a scelta",
    "court_finals": "Campi fissi (solo finali) · Gironi a scelta",
    "days_all": "Giorni fissi · Campi e orari a scelta",
    "days_finals": "Giorni fissi (solo finali) · Gironi a scelta",
    "hours_all": "Orari fissi · Campi e giorni a scelta",
    "hours_finals": "Orari fissi (solo finali) · Gironi a scelta",
    "court_days_all": "Campi e giorni fissi · Orari a scelta",
    "court_days_finals": "Campi e giorni fissi (solo finali)",
    "court_hours_all": "Campi e orari fissi · Giorni a scelta",
    "court_hours_finals": "Campi e orari fissi (solo finali)",
    "days_hours_all": "Giorni e orari fissi · Campi a scelta",
    "days_hours_finals": "Giorni e orari fissi (solo finali)",
    "court_days_hours_all": "Campi, giorni e orari fissi",
    "court_days_hours_finals": "Tutto fisso (solo finali) · Gironi a scelta"
  };

  // Mapping giorni
  const daysMap = {
    "lun-dom": "Tutti i giorni",
    "lun-ven": "Lun-Ven",
    "sab-dom": "Weekend",
    "lun": "Lunedì",
    "mar": "Martedì",
    "mer": "Mercoledì",
    "gio": "Giovedì",
    "giov": "Giovedì",
    "ven": "Venerdì",
    "sab": "Sabato",
    "dom": "Domenica"
  };

  // Mapping orari
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
// 9. RENDER SPECIFIC TOURNAMENT RULE
// ===============================
function renderSpecificCourtRule(tournament) {
  const container = document.getElementById("specific-court-rule");
  
  const rules = [];
  let ruleNumber = 1;
  
  // REGOLA 1: Quota di iscrizione, costo campi e arbitro
  rules.push(buildPriceCourtRefereeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 2: Partecipanti (gender, age, expertise, team_size)
  rules.push(buildParticipantsRequirementsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 3: Premi e riconoscimenti (award, mvp_award)
  rules.push(buildAwardsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 4: Formato e durata (format_type, time_range)
  rules.push(buildFormatTimeRangeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 5: Campi, giorni e orari (fixed_court_days_hours, available_days, available_hours)
  rules.push(buildCourtDaysHoursRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 6: Formato partite (match_format, guaranteed_match)
  rules.push(buildMatchFormatRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 7: Classifica (point_system, tie_standing)
  rules.push(buildStandingsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 8: Gestione pareggi in partita (tie_match_gironi, tie_match_finals)
  rules.push(buildMatchTiebreakersRule(tournament, ruleNumber));
  ruleNumber++;

  // REGOLA 9: Arbitro (referee)
  rules.push(buildRefereeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA FINALE: Riferimento al regolamento generale
  rules.push(buildGeneralReferenceRule());
  
  container.innerHTML = `
    <div class="specific-regulation-cards">
      ${rules.join('')}
    </div>
  `;
}



// ===============================
// 9b. BUILD PRICE/COURT/REFEREE RULE (REGOLA 1)
// ===============================
function buildPriceCourtRefereeRule(tournament, ruleNumber) {
  const price = tournament.price || "N/A";
  const courtPrice = String(tournament.court_price || "non_compreso").toLowerCase();
  const refereePrice = String(tournament.referee_price || "NA").toLowerCase();
  
  // === INTRO: Quota base ===
  let introText = `
    <p>
      La quota di iscrizione per questo torneo è di <strong>€${price} a squadra</strong>.
    </p>
  `;
  
  // Creiamo una chiave combinata per gestire tutti i casi
  const comboKey = `${courtPrice}__${refereePrice}`;
  
  let inclusionText = "";
  
  switch (comboKey) {
    
    // =====================================================
    // ARBITRO NA (non presente nel torneo)
    // =====================================================
    
    case "compreso_gironi_finals__na":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per tutte le partite del torneo, 
          sia durante la fase a gironi che durante le fasi finali. 
          Le squadre non dovranno sostenere alcun costo aggiuntivo per l'utilizzo delle strutture sportive.
        </p>
      `;
      break;
      
    case "compreso_gironi__na":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi per le partite della fase a gironi</strong>. 
          Per le eventuali partite delle fasi finali, le squadre partecipanti dovranno 
          <strong>dividere equamente</strong> il costo del campo.
        </p>
      `;
      break;
      
    case "compreso_finals__na":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi per le partite delle fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> 
          il costo del campo presso la struttura sportiva prenotata.
        </p>
      `;
      break;
      
    case "non_compreso__na":
      inclusionText = `
        <p>
          La quota <strong>non include</strong> il costo dei campi. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> 
          il costo del campo presso la struttura sportiva prenotata.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI E ARBITRO ENTRAMBI INCLUSI OVUNQUE
    // =====================================================
    
    case "compreso_gironi_finals__compreso_gironi_finals":
      inclusionText = `
        <p>
          La quota include sia la <strong>prenotazione dei campi</strong> che il <strong>costo dell'arbitro</strong> 
          per tutte le partite del torneo, sia durante la fase a gironi che durante le fasi finali.
        </p>
        <p>
          Le squadre non dovranno sostenere alcun costo aggiuntivo.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI E ARBITRO ENTRAMBI NON INCLUSI
    // =====================================================
    
    case "non_compreso__non_compreso":
      inclusionText = `
        <p>
          La quota <strong>non include</strong> né il costo dei campi né il compenso arbitrale.
        </p>
        <p>
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> 
          sia il costo del campo che il compenso dell'arbitro.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI INCLUSI OVUNQUE + ARBITRO PARZIALE/NON INCLUSO
    // =====================================================
    
    case "compreso_gironi_finals__compreso_gironi":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è incluso solo per le partite della <strong>fase a gironi</strong>. 
          Per le partite delle fasi finali, le squadre dovranno <strong>dividere equamente</strong> il compenso arbitrale.
        </p>
      `;
      break;
      
    case "compreso_gironi_finals__compreso_finals":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è incluso solo per le partite delle <strong>fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> il compenso arbitrale.
        </p>
      `;
      break;
      
    case "compreso_gironi_finals__non_compreso":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
        <p>
          La quota <strong>non include</strong> il compenso arbitrale. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo dell'arbitro.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI INCLUSI SOLO GIRONI + VARIE COMBINAZIONI ARBITRO
    // =====================================================
    
    case "compreso_gironi__compreso_gironi_finals":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> solo per le partite della <strong>fase a gironi</strong>. 
          Per le partite delle fasi finali, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è invece incluso per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
      `;
      break;
      
    case "compreso_gironi__compreso_gironi":
      inclusionText = `
        <p>
          La quota include sia la <strong>prenotazione dei campi</strong> che il <strong>costo dell'arbitro</strong> 
          per le partite della <strong>fase a gironi</strong>.
        </p>
        <p>
          Per le partite delle fasi finali, le squadre dovranno <strong>dividere equamente</strong> 
          sia il costo del campo che il compenso arbitrale.
        </p>
      `;
      break;
      
    case "compreso_gironi__compreso_finals":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per le partite della <strong>fase a gironi</strong>, 
          e il <strong>costo dell'arbitro</strong> per le partite delle <strong>fasi finali</strong>.
        </p>
        <p>
          Per le partite dei gironi, le squadre dovranno dividere il compenso arbitrale. 
          Per le partite delle finali, dovranno dividere il costo del campo.
        </p>
      `;
      break;
      
    case "compreso_gironi__non_compreso":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> solo per le partite della <strong>fase a gironi</strong>. 
          Per le partite delle fasi finali, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          La quota <strong>non include</strong> il compenso arbitrale. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo dell'arbitro.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI INCLUSI SOLO FINALI + VARIE COMBINAZIONI ARBITRO
    // =====================================================
    
    case "compreso_finals__compreso_gironi_finals":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> solo per le partite delle <strong>fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è invece incluso per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
      `;
      break;
      
    case "compreso_finals__compreso_gironi":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per le partite delle <strong>fasi finali</strong>, 
          e il <strong>costo dell'arbitro</strong> per le partite della <strong>fase a gironi</strong>.
        </p>
        <p>
          Per le partite dei gironi, le squadre dovranno dividere il costo del campo. 
          Per le partite delle finali, dovranno dividere il compenso arbitrale.
        </p>
      `;
      break;
      
    case "compreso_finals__compreso_finals":
      inclusionText = `
        <p>
          La quota include sia la <strong>prenotazione dei campi</strong> che il <strong>costo dell'arbitro</strong> 
          per le partite delle <strong>fasi finali</strong>.
        </p>
        <p>
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> 
          sia il costo del campo che il compenso arbitrale.
        </p>
      `;
      break;
      
    case "compreso_finals__non_compreso":
      inclusionText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> solo per le partite delle <strong>fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          La quota <strong>non include</strong> il compenso arbitrale. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo dell'arbitro.
        </p>
      `;
      break;
    
    // =====================================================
    // CAMPI NON INCLUSI + VARIE COMBINAZIONI ARBITRO
    // =====================================================
    
    case "non_compreso__compreso_gironi_finals":
      inclusionText = `
        <p>
          La quota <strong>non include</strong> il costo dei campi. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          La quota include invece il <strong>costo dell'arbitro</strong> per tutte le partite del torneo 
          (sia fase a gironi che fasi finali).
        </p>
      `;
      break;
      
    case "non_compreso__compreso_gironi":
      inclusionText = `
        <p>
          La quota <strong>non include</strong> il costo dei campi. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è incluso solo per le partite della <strong>fase a gironi</strong>. 
          Per le partite delle fasi finali, le squadre dovranno <strong>dividere equamente</strong> anche il compenso arbitrale.
        </p>
      `;
      break;
      
    case "non_compreso__compreso_finals":
      inclusionText = `
        <p>
          La quota <strong>non include</strong> il costo dei campi. 
          Per ogni partita, le squadre dovranno <strong>dividere equamente</strong> il costo del campo.
        </p>
        <p>
          Il <strong>costo dell'arbitro</strong> è incluso solo per le partite delle <strong>fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> anche il compenso arbitrale.
        </p>
      `;
      break;
    
    // =====================================================
    // FALLBACK
    // =====================================================
    
    default:
      inclusionText = `
        <p>
          I dettagli su cosa è incluso nella quota (campi, arbitro) saranno comunicati prima dell'inizio del torneo.
        </p>
      `;
      break;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Quota di iscrizione</strong></p>
        ${introText}
        ${inclusionText}
      </div>
    </div>
  `;
}


// ===============================
// 9c. BUILD PARTICIPANTS REQUIREMENTS RULE (REGOLA 2)
// ===============================
function buildParticipantsRequirementsRule(tournament, ruleNumber) {
  const gender = String(tournament.gender || "open").toLowerCase();
  const age = String(tournament.age || "open").toLowerCase();
  const expertise = String(tournament.expertise || "open").toLowerCase();
  const maxCategory = String(tournament.max_category || "NA").toLowerCase();
  const teamSizeMin = Number(tournament.team_size_min) || 0;
  const teamSizeMax = Number(tournament.team_size_max) || 0;
  
  // Creiamo una chiave combinata per gender + age
  const genderAgeKey = `${gender}__${age}`;
  
  let genderAgeText = "";
  
  switch (genderAgeKey) {
    
    // =====================================================
    // OPEN (qualsiasi composizione)
    // =====================================================
    
    case "open__open":
      genderAgeText = `
        <p>
          Possono partecipare squadre di <strong>qualsiasi composizione</strong> (maschili, femminili o miste) 
          e giocatori di <strong>qualsiasi età</strong>.
        </p>
      `;
      break;
      
    case "open__under_18":
      genderAgeText = `
        <p>
          Possono partecipare squadre di <strong>qualsiasi composizione</strong> (maschili, femminili o miste), 
          ma il torneo è riservato a giocatori <strong>Under 18</strong>. 
          Tutti i componenti della squadra devono avere meno di 18 anni alla data di inizio del torneo.
        </p>
      `;
      break;
      
    case "open__over_35":
      genderAgeText = `
        <p>
          Possono partecipare squadre di <strong>qualsiasi composizione</strong> (maschili, femminili o miste), 
          ma il torneo è riservato a giocatori <strong>Over 35</strong>. 
          Tutti i componenti della squadra devono avere almeno 35 anni alla data di inizio del torneo.
        </p>
      `;
      break;
    
    // =====================================================
    // ONLY MALE (solo uomini)
    // =====================================================
    
    case "only_male__open":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da soli uomini</strong>, 
          di <strong>qualsiasi età</strong>.
        </p>
      `;
      break;
      
    case "only_male__under_18":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da soli uomini Under 18</strong>. 
          Tutti i componenti della squadra devono essere di sesso maschile e avere meno di 18 anni 
          alla data di inizio del torneo.
        </p>
      `;
      break;
      
    case "only_male__over_35":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da soli uomini Over 35</strong>. 
          Tutti i componenti della squadra devono essere di sesso maschile e avere almeno 35 anni 
          alla data di inizio del torneo.
        </p>
      `;
      break;
    
    // =====================================================
    // ONLY FEMALE (solo donne)
    // =====================================================
    
    case "only_female__open":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da sole donne</strong>, 
          di <strong>qualsiasi età</strong>.
        </p>
      `;
      break;
      
    case "only_female__under_18":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da sole donne Under 18</strong>. 
          Tutte le componenti della squadra devono essere di sesso femminile e avere meno di 18 anni 
          alla data di inizio del torneo.
        </p>
      `;
      break;
      
    case "only_female__over_35":
      genderAgeText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da sole donne Over 35</strong>. 
          Tutte le componenti della squadra devono essere di sesso femminile e avere almeno 35 anni 
          alla data di inizio del torneo.
        </p>
      `;
      break;
    
    // =====================================================
    // MIXED STRICT (misto obbligatorio)
    // =====================================================
    
    case "mixed_strict__open":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>obbligatoriamente mista</strong>, composta da 
          <strong>almeno un uomo e almeno una donna</strong>. 
          Non ci sono limiti di età per i partecipanti.
        </p>
      `;
      break;
      
    case "mixed_strict__under_18":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>obbligatoriamente mista</strong>, composta da 
          <strong>almeno un uomo e almeno una donna</strong>. 
          Il torneo è riservato a giocatori <strong>Under 18</strong>: tutti i componenti della squadra 
          devono avere meno di 18 anni alla data di inizio del torneo.
        </p>
      `;
      break;
      
    case "mixed_strict__over_35":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>obbligatoriamente mista</strong>, composta da 
          <strong>almeno un uomo e almeno una donna</strong>. 
          Il torneo è riservato a giocatori <strong>Over 35</strong>: tutti i componenti della squadra 
          devono avere almeno 35 anni alla data di inizio del torneo.
        </p>
      `;
      break;
    
    // =====================================================
    // MIXED FEMALE ALLOWED (misto o femminile)
    // =====================================================
    
    case "mixed_female_allowed__open":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>mista</strong> (almeno un uomo e una donna) 
          oppure composta da <strong>sole donne</strong>. 
          Non sono ammesse squadre composte da soli uomini. 
          Non ci sono limiti di età per i partecipanti.
        </p>
      `;
      break;
      
    case "mixed_female_allowed__under_18":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>mista</strong> (almeno un uomo e una donna) 
          oppure composta da <strong>sole donne</strong>. 
          Non sono ammesse squadre composte da soli uomini.
        </p>
        <p>
          Il torneo è riservato a giocatori <strong>Under 18</strong>: tutti i componenti della squadra 
          devono avere meno di 18 anni alla data di inizio del torneo.
        </p>
      `;
      break;
      
    case "mixed_female_allowed__over_35":
      genderAgeText = `
        <p>
          Ogni squadra deve essere <strong>mista</strong> (almeno un uomo e una donna) 
          oppure composta da <strong>sole donne</strong>. 
          Non sono ammesse squadre composte da soli uomini.
        </p>
        <p>
          Il torneo è riservato a giocatori <strong>Over 35</strong>: tutti i componenti della squadra 
          devono avere almeno 35 anni alla data di inizio del torneo.
        </p>
      `;
      break;
    
    // =====================================================
    // FALLBACK
    // =====================================================
    
    default:
      genderAgeText = `
        <p>
          I requisiti di partecipazione relativi a composizione delle squadre e limiti di età 
          saranno comunicati prima dell'inizio del torneo.
        </p>
      `;
      break;
  }
  
  // === EXPERTISE + MAX CATEGORY TEXT (combinato) ===
  const expertiseCategoryKey = `${expertise}__${maxCategory}`;
  
  let expertiseText = "";
  
  switch (expertiseCategoryKey) {
    
    // =====================================================
    // EXPERT (giocatori esperti)
    // =====================================================
    
    case "expert__na":
      expertiseText = `
        <p>
          Questo torneo è rivolto a <strong>giocatori esperti</strong> con un livello di gioco medio-alto. 
          Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico.
        </p>
      `;
      break;
      
    case "expert__prima_categoria":
      expertiseText = `
        <p>
          Questo torneo è rivolto a <strong>giocatori esperti</strong> con un livello di gioco medio-alto. 
          Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico. <br>
          Tuttavia, al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Prima Categoria</strong> o categorie inferiori. 
        </p>
      `;
      break;
      
    case "expert__eccellenza":
      expertiseText = `
        <p>
          Questo torneo è rivolto a <strong>giocatori esperti</strong> con un livello di gioco medio-alto. 
          Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico. <br>
          Tuttavia, al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Eccellenza</strong> o categorie inferiori. 
        </p>
      `;
      break;
    
    // =====================================================
    // OPEN (amatoriale)
    // =====================================================
    
    case "open__na":
      expertiseText = `
        <p>
          Questo torneo è <strong>aperto a giocatori e squadre di qualsiasi livello</strong>, ed è pensato per chi vuole 
          divertirsi e mettersi in gioco in un contesto amatoriale.
        </p>
      `;
      break;
      
    case "open__prima_categoria":
      expertiseText = `
        <p>
          Questo torneo è <strong>aperto a giocatori e squadre di qualsiasi livello</strong>, ed è pensato per chi vuole 
          divertirsi e mettersi in gioco in un contesto amatoriale. <br>
          Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Prima Categoria</strong> o categorie inferiori.
        </p>
      `;
      break;
      
    case "open__eccellenza":
      expertiseText = `
        <p>
          Questo torneo è <strong>aperto a giocatori e squadre di qualsiasi livello</strong>, ed è pensato per chi vuole 
          divertirsi e mettersi in gioco in un contesto amatoriale. <br>
          Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Eccellenza</strong> o categorie inferiori.
        </p>
      `;
      break;
    
    // =====================================================
    // FALLBACK
    // =====================================================
    
    default:
      expertiseText = `
        <p>
          Questo torneo è <strong>aperto a tutti i livelli</strong>, ed è pensato per chi vuole 
          divertirsi e mettersi in gioco in un contesto amatoriale.
        </p>
      `;
      break;
  }
  
  // === TEAM SIZE TEXT (separato) ===
  let teamSizeText = "";
  if (teamSizeMin > 0 && teamSizeMax > 0) {
    if (teamSizeMin === teamSizeMax) {
      teamSizeText = `
        <p>
          Ogni squadra deve essere composta da esattamente <strong>${teamSizeMin} giocatori</strong>.
        </p>
      `;
    } else {
      teamSizeText = `
        <p>
          Ogni squadra deve essere composta da un <strong>minimo di ${teamSizeMin}</strong> 
          e un <strong>massimo di ${teamSizeMax} giocatori</strong>.
        </p>
      `;
    }
  } else if (teamSizeMin > 0) {
    teamSizeText = `
      <p>
        Ogni squadra deve essere composta da almeno <strong>${teamSizeMin} giocatori</strong>.
      </p>
    `;
  } else if (teamSizeMax > 0) {
    teamSizeText = `
      <p>
        Ogni squadra può essere composta da un massimo di <strong>${teamSizeMax} giocatori</strong>.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Chi può partecipare</strong></p>
        ${genderAgeText}
        ${expertiseText}
        ${teamSizeText}
      </div>
    </div>
  `;
}






// ===============================
// 9d. BUILD AWARDS RULE (REGOLA 3)
// ===============================
function buildAwardsRule(tournament, ruleNumber) {
  const hasAward = tournament.award === true || String(tournament.award).toUpperCase() === "TRUE";
  const awardPerc = String(tournament.award_amount_perc || "NA");
  const price = Number(tournament.price) || 0;
  const teamsMax = Number(tournament.teams_max) || 0;
  const mvpAward = String(tournament.mvp_award || "none").toLowerCase();
  
  // === MAIN AWARD TEXT ===
  let mainAwardText = "";
  
  if (hasAward) {
    if (awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
      const percValue = Number(awardPerc) / 100;
      const totalPrize = Math.round(teamsMax * price * percValue);
      
      mainAwardText = `
        <p>
          È previsto un <strong>montepremi</strong> pari a <strong>€${totalPrize}</strong>, che sarà
          suddiviso tra le prime 3 squadre classificate.
        </p>
        <p>
          Questo premio è garantito al raggiungimento di <strong>${teamsMax} squadre</strong> iscritte. 
          In ogni caso, anche nella rara eventualità in cui non si raggiungesse il numero previsto di squadre, 
          il premio rimarrà comunque almeno uguale al <strong>${awardPerc}%</strong> delle quote di iscrizione totali.
        </p>
      `;
    } else {
      mainAwardText = `
        <p>
          È previsto un <strong>montepremi</strong> per le squadre vincitrici. 
          L'importo e la suddivisione saranno comunicati prima dell'inizio del torneo.
        </p>
      `;
    }
  } else {
    mainAwardText = `
      <p>
        Essendo un torneo aperto a giocatori e squadre di qualsiasi livello, al fine di evitare squilibri, sono 
        previsti esclusivamente <strong>premi simbolici</strong>, come coppe, medaglie, gadget e altri riconoscimenti, per le squadre vincitrici.
      </p>
    `;
  }
  
  // === MVP AWARD TEXT ===
  let mvpAwardText = "";
  
  if (mvpAward !== "none") {
    const mvpPrizes = [];
    
    if (mvpAward.includes("mvp")) {
      mvpPrizes.push("<strong>Miglior Giocatore (MVP)</strong>");
    }
    if (mvpAward.includes("scorer")) {
      mvpPrizes.push("<strong>Capocannoniere</strong>");
    }
    if (mvpAward.includes("goalkeeper")) {
      mvpPrizes.push("<strong>Miglior Portiere</strong>");
    }
    if (mvpAward.includes("fairplay")) {
      mvpPrizes.push("<strong>Premio Fair Play</strong>");
    }
    
    if (mvpPrizes.length > 0) {
      const prizesList = mvpPrizes.length === 1 
        ? mvpPrizes[0] 
        : mvpPrizes.slice(0, -1).join(", ") + " e " + mvpPrizes[mvpPrizes.length - 1];
      
      mvpAwardText = `
        <p>
          Saranno inoltre assegnati <strong>premi individuali</strong> per: ${prizesList}.
        </p>
      `;
    }
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Premi e riconoscimenti</strong></p>
        ${mainAwardText}
        ${mvpAwardText}
      </div>
    </div>
  `;
}








// ===============================
// 9e. BUILD FORMAT RULE (REGOLA 4)
// ===============================
function buildFormatTimeRangeRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  
  // === FORMAT TYPE TEXT ===
  let formatText = "";
  
  switch (formatType) {
    case "round_robin":
      formatText = `
        <p>
          Il torneo prevede un <strong>girone unico all’italiana con partite di sola andata</strong>, in cui ogni squadra affronterà una sola volta tutte le altre partecipanti.
        </p>

        <p>
          Non essendo prevista una fase finale, la squadra che chiuderà il girone al primo posto sarà proclamata vincitrice del torneo.
        </p>

        <p>
          Il numero definitivo di squadre partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.
        </p>        
      `;
      break;
      
    case "double_round_robin":
      formatText = `
        <p>
          Il torneo prevede un <strong>girone unico all’italiana con partite di andata e ritorno</strong>, in cui ogni squadra affronterà due volte tutte le altre partecipanti.
        </p>

        <p>
          Non essendo prevista una fase finale, la squadra che chiuderà il girone al primo posto sarà proclamata vincitrice del torneo.
        </p>

        <p>
          Il numero definitivo di squadre partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.
        </p>  
      `;
      break;
      
    case "round_robin_finals":
      formatText = `
        <p>
          Il torneo prevederà una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.
        </p>

        <p>
          Sono previsti gironi all’italiana con sola andata, in cui ogni squadra affronterà una sola volta le altre del proprio gruppo.  
          La fase finale prevedrà invece scontri diretti in gara unica, con passaggio del turno per la squadra vincente.
        </p>

        <p>
          Il numero delle squadre partecipanti, delle squadre per girone e delle qualificate alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.
        </p>        
      `;
      break;
      
    case "round_robin_finals":
      formatText = `
        <p>
          Il torneo prevederà una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.
        </p>

        <p>
          Sono previsti gironi all’italiana con andata e ritorno, in cui ogni squadra affronterà due volte le altre del proprio gruppo.  
          La fase finale prevedrà invece scontri diretti in gara unica, con passaggio del turno per la squadra vincente.
        </p>

        <p>
          Il numero delle squadre partecipanti, delle squadre per girone e delle qualificate alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.
        </p>        
      `;
      break;
      
    default:
      formatText = `
        <p>
          Il formato dettagliato del torneo sarà comunicato prima dell'inizio delle partite.
        </p>
      `;
      break;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato del torneo</strong></p>
        ${formatText}
      </div>
    </div>
  `;
}







// ===============================
// 9f. BUILD COURT/DAYS/HOURS RULE (REGOLA 5)
// ===============================
function buildCourtDaysHoursRule(tournament, ruleNumber) {
  const fixed = String(tournament.fixed_court_days_hours || "false").toLowerCase();
  const days = String(tournament.available_days || "").toLowerCase();
  const hours = String(tournament.available_hours || "").toLowerCase();
  const location = String(tournament.location || "");
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
  // Mapping giorni
  const daysMap = {
    "lun-dom": "qualsiasi giorno della settimana",
    "lun-ven": "dal lunedì al venerdì",
    "sab-dom": "nel weekend (sabato e domenica)",
    "lun": "il lunedì",
    "mar": "il martedì",
    "mer": "il mercoledì",
    "gio": "il giovedì",
    "giov": "il giovedì",
    "ven": "il venerdì",
    "sab": "il sabato",
    "dom": "la domenica"
  };
  
  // Mapping orari
  const hoursMap = {
    "10-22": "tra le 10:00 e le 22:00",
    "10-19": "tra le 10:00 e le 19:00 (fascia diurna)",
    "19-22": "tra le 19:00 e le 22:00 (fascia serale)"
  };
  
  const daysText = daysMap[days] || days || "";
  const hoursText = hoursMap[hours] || hours || "";

  let ruleContent = "";
  
  // =====================================================
  // CASO 1: TUTTO VARIABILE (false)
  // =====================================================
  if (fixed === "false") {
    ruleContent = `
      <p>
        Per tutta la durata del torneo, campi, giorni e orari delle partite verranno decisi dalle 
        squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
      </p>
      <p>
        In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
        in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
        potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
      <p>
        L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
        un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
      </p>
    `;
  }
  
  // =====================================================
  // CASO 2: TUTTO FISSO PER TUTTO IL TORNEO (court_days_hours_all)
  // =====================================================
  else if (fixed === "court_days_hours_all") {
    ruleContent = `
      <p>
        Per tutta la durata del torneo, campi, giorni e orari delle partite saranno 
        stabiliti dall'organizzazione e comunicati prima dell'inizio del torneo.
      </p>
      <p>
        Le partite si svolgeranno a <strong>${location}</strong>, <strong>${daysText}</strong>, 
        <strong>${hoursText}</strong>.
      </p>
      <p>
        Le squadre non dovranno quindi preoccuparsi della prenotazione dei campi: 
        l'organizzazione provvederà a comunicare in anticipo il calendario completo delle partite.
      </p>
    `;
  }
  
  // =====================================================
  // CASO 3: TUTTO FISSO SOLO PER LE FINALI (court_days_hours_finals)
  // =====================================================
  else if (fixed === "court_days_hours_finals") {
    if (hasFinals) {
      ruleContent = `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
          un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
        </p>
        <p>
          <strong>Fase finale:</strong> campi, giorni e orari delle partite ad eliminazione diretta saranno 
          stabiliti dall'organizzazione e comunicati al termine della fase a gironi.
        </p>
      `;
    } else {
      // Se non ci sono finali, trattiamo come "false"
      ruleContent = `
        <p>
          Per tutta la durata del torneo, campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
          un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO 4: SOLO CAMPI FISSI PER TUTTO IL TORNEO (court_all)
  // =====================================================
  else if (fixed === "court_all") {
    ruleContent = `
      <p>
        Per tutta la durata del torneo, i campi in cui si svolgeranno le partite saranno 
        stabiliti dall'organizzazione e comunicati prima dell'inizio del torneo.
      </p>
      <p>
        Le partite si svolgeranno a <strong>${location}</strong>.
      </p>
      <p>
        Giorni e orari delle partite verranno invece decisi dalle squadre partecipanti. 
        In fase di iscrizione, le squadre potranno esprimere le proprie preferenze, 
        considerando che le partite potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
      <p>
        L'organizzazione, per le partite in cui la squadra giocherà in casa, comunicherà 
        giorni e orari tenendo conto delle preferenze espresse in fase di iscrizione.
      </p>
    `;
  }
  
  // =====================================================
  // CASO 5: SOLO CAMPI FISSI PER LE FINALI (court_finals)
  // =====================================================
  else if (fixed === "court_finals") {
    if (hasFinals) {
      ruleContent = `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
          un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
        </p>
        <p>
          <strong>Fase finale:</strong> i campi in cui si svolgeranno le partite ad eliminazione diretta saranno 
          stabiliti dall'organizzazione e comunicati al termine della fase a gironi. 
          Giorni e orari verranno concordati con le squadre qualificate.
        </p>
      `;
    } else {
      ruleContent = `
        <p>
          Per tutta la durata del torneo, campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
          un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO 6: GIORNI E ORARI FISSI PER TUTTO IL TORNEO (days_hours_all)
  // =====================================================
  else if (fixed === "days_hours_all") {
    ruleContent = `
      <p>
        Per tutta la durata del torneo, giorni e orari delle partite saranno 
        stabiliti dall'organizzazione e comunicati prima dell'inizio del torneo.
      </p>
      <p>
        Le partite si svolgeranno <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
      <p>
        I campi verranno invece prenotati di volta in volta dall'organizzazione. 
        In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
        sulla zona in cui desiderano giocare, considerando che le partite 
        si svolgeranno a <strong>${location}</strong>.
      </p>
      <p>
        L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
        un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
      </p>
    `;
  }
  
  // =====================================================
  // CASO 7: GIORNI E ORARI FISSI SOLO PER LE FINALI (days_hours_finals)
  // =====================================================
  else if (fixed === "days_hours_finals") {
    if (hasFinals) {
      ruleContent = `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          L'organizzazione, per le partite in cui la squadra giocherà in casa, si occuperà quindi di prenotare
          un campo disponibile tenendo conto delle preferenze espresse in fase di iscrizione.
        </p>
        <p>
          <strong>Fase finale:</strong> giorni e orari delle partite ad eliminazione diretta saranno 
          stabiliti dall'organizzazione e comunicati al termine della fase a gironi. 
          I campi verranno prenotati tenendo conto delle preferenze delle squadre qualificate.
        </p>
      `;
    } else {
      ruleContent = `
        <p>
          Per tutta la durata del torneo, campi, giorni e orari delle partite verranno decisi dalle 
          squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.
        </p>
        <p>
          In fase di iscrizione, le squadre potranno esprimere le proprie preferenze 
          in merito a campi, giorni e orari in cui desiderano giocare, considerando che le partite
          potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
      `;
    }
  }
  
  // =====================================================
  // FALLBACK
  // =====================================================
  else {
    ruleContent = `
      <p>
        Le modalità di assegnazione di campi, giorni e orari saranno comunicate prima dell'inizio del torneo.
      </p>
      <p>
        Le partite si svolgeranno a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Campi, giorni e orari delle partite</strong></p>
        ${ruleContent}
      </div>
    </div>
  `;
}





// ===============================
// 9g. BUILD MATCH FORMAT RULE (REGOLA 6)
// ===============================
function buildMatchFormatRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  const sport = String(tournament.sport || "").toLowerCase();
  
  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();
  const matchFormatFinals = String(tournament.match_format_finals || "NA").toLowerCase();
  const guaranteedMatch = Number(tournament.guaranteed_match) || 0;
  
  // Determina il testo per "vince la squadra..."
  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const winConditionText = isGameBasedSport 
    ? "al termine, vince la squadra con più game vinti" 
    : "al termine, vince la squadra in vantaggio";
  
  // Mapping formato partita (dinamico in base allo sport)
  const matchFormatMap = {
    "1x30": `un tempo unico da 30 minuti: ${winConditionText}`,
    "1x60": `un tempo unico da 60 minuti: ${winConditionText}`,
    "2x25": `due tempi da 25 minuti ciascuno: ${winConditionText}`,
    "1x50": `un tempo unico da 50 minuti: ${winConditionText}`,
    "1su1": "vince la squadra che si aggiudica il primo set",
    "2su3": "vince la squadra che si aggiudica per prima 2 set"
  };
  
  const matchFormatGironiText = matchFormatMap[matchFormatGironi] || "";
  const matchFormatFinalsText = matchFormatMap[matchFormatFinals] || "";
  
  let ruleContent = "";
  
  // =====================================================
  // PARTITE GARANTITE
  // =====================================================
  if (guaranteedMatch > 0) {
    ruleContent += `
      <p>
        L'organizzazione garantisce alle squadre iscritte un minimo di <strong>${guaranteedMatch} partite</strong>.
      </p>
    `;
  }
  
  // =====================================================
  // FORMATO PARTITE - CON FINALI
  // =====================================================
  if (hasFinals) {
    // Stesso formato per gironi e finali
    if (matchFormatGironi === matchFormatFinals) {
      ruleContent += `
        <p>
          Tutte le partite del torneo, sia durante la fase a gironi che durante le fasi finali, 
          si disputeranno con la seguente formula: <strong>${matchFormatGironiText}</strong>.
        </p>
      `;
    } 
    // Formati diversi
    else {
      if (matchFormatGironiText) {
        ruleContent += `
          <p>
            Le partite della <strong>fase a gironi</strong> si disputeranno con la seguente formula: 
            <strong>${matchFormatGironiText}</strong>.
          </p>
        `;
      }
      if (matchFormatFinalsText && matchFormatFinals !== "na") {
        ruleContent += `
          <p>
            Le partite delle <strong>fasi finali</strong> si disputeranno con la seguente formula: 
            <strong>${matchFormatFinalsText}</strong>.
          </p>
        `;
      }
    }
  }
  // =====================================================
  // FORMATO PARTITE - SENZA FINALI
  // =====================================================
  else {
    if (matchFormatGironiText) {
      ruleContent += `
        <p>
          Tutte le partite del torneo si disputeranno con la seguente formula: 
          <strong>${matchFormatGironiText}</strong>.
        </p>
      `;
    }
  }
  
  // =====================================================
  // FALLBACK
  // =====================================================
  if (!ruleContent) {
    ruleContent = `
      <p>
        Il formato delle partite sarà comunicato prima dell'inizio del torneo.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato delle partite</strong></p>
        ${ruleContent}
      </div>
    </div>
  `;
}




// // ===============================
// 9h. BUILD STANDINGS RULE (REGOLA 7)
// ===============================
function buildStandingsRule(tournament, ruleNumber) {
  const sport = String(tournament.sport || "").toLowerCase();
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
  const pointSystemGironi = String(tournament.point_system_gironi || "3-1-0").toLowerCase();
  const tieStandingGironi = String(tournament.tie_standing_gironi_criteria || "").toLowerCase();
  
  // Determina terminologia in base allo sport
  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const goalTerminology = isGameBasedSport ? "game vinti" : "gol fatti";
  const goalDiffTerminology = isGameBasedSport ? "differenza game" : "differenza reti";
  
  // Mapping sistema punti
  const pointSystemMap = {
    "3-1-0": "3 punti per la vittoria, 1 punto per il pareggio, 0 punti per la sconfitta",
    "2-1-0": "2 punti per la vittoria, 1 punto per il pareggio, 0 punti per la sconfitta"
  };
  
  // Mapping criteri parità in classifica
  const tieStandingMap = {
    "moneta": "tramite lancio della moneta",
    "spareggio": "tramite una partita di spareggio"
  };
  
  const pointSystemText = pointSystemMap[pointSystemGironi] || "";
  const tieStandingText = tieStandingMap[tieStandingGironi] || "";
  
  let ruleContent = "";
  
  // =====================================================
  // SISTEMA PUNTI
  // =====================================================
  if (pointSystemText) {
    if (hasFinals) {
      ruleContent += `
        <p>
          Il sistema di punteggio per la classifica della fase a gironi prevede: 
          <strong>${pointSystemText}</strong>.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          Il sistema di punteggio per la classifica prevede: 
          <strong>${pointSystemText}</strong>.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CRITERI CLASSIFICA (parità punti in classifica)
  // =====================================================
  if (hasFinals) {
    ruleContent += `
      <p>
        <strong>Classifica gironi:</strong> in caso di parità di punti tra due o più squadre 
        dello stesso girone, l'ordine in classifica sarà determinato dai seguenti criteri, in ordine di importanza:
        <strong>scontri diretti</strong>, <strong>${goalDiffTerminology}</strong>, <strong>${goalTerminology}</strong>.
      </p>

      <p>
        <strong>Confronto tra squadre di gironi diversi:</strong> qualora fosse necessario confrontare squadre
        appartenenti a gironi diversi (ad esempio per determinare le migliori seconde), in caso di parità di punti,
        verranno considerati i seguenti criteri, in ordine di importanza:
        <strong>${goalDiffTerminology}</strong>, <strong>${goalTerminology}</strong>.
      </p>
    `;
  } else {
    ruleContent += `
      <p>
        In caso di parità di punti tra due o più squadre, l'ordine in classifica sarà determinato 
        dai seguenti criteri, in ordine di importanza:
        <strong>scontri diretti</strong>, <strong>${goalDiffTerminology}</strong>, <strong>${goalTerminology}</strong>.
      </p>
    `;
  }
  
  if (tieStandingText) {
    ruleContent += `
      <p>
        Se, dopo l'applicazione di tutti i criteri, dovesse persistere una situazione di parità, 
        questa verrà risolta <strong>${tieStandingText}</strong>.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Classifica</strong></p>
        ${ruleContent}
      </div>
    </div>
  `;
}


// ===============================
// 9i. BUILD MATCH TIEBREAKERS RULE (REGOLA 8)
// ===============================
function buildMatchTiebreakersRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
  const tieMatchGironi = String(tournament.tie_match_gironi_criteria || "").toLowerCase();
  const tieMatchFinals = String(tournament.tie_match_finals_criteria || "").toLowerCase();
  
  // Mapping criteri pareggio in partita (gironi)
  const tieMatchGironiMap = {
    "tie_accettato": "il pareggio è un risultato valido e verrà assegnato 1 punto a ciascuna squadra",
    "moneta": "in caso di parità al termine del tempo regolamentare, il vincitore sarà deciso tramite lancio della moneta",
    "rigori": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato dopo i calci di rigore",
    "tiebreak": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato con un tiebreak a 7 punti finale",
    "spareggio": "in caso di parità al termine del tempo regolamentare, si procederà con una partita supplementare di spareggio"
  };
  
  // Mapping criteri pareggio in partita (finali)
  const tieMatchFinalsMap = {
    "moneta": "in caso di parità al termine del tempo regolamentare, il vincitore sarà deciso tramite lancio della moneta",
    "rigori": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato dopo i calci di rigore",
    "tiebreak": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato con un tiebreak a 7 punti finale",
    "spareggio": "in caso di parità al termine del tempo regolamentare, si procederà con una partita supplementare di spareggio"
  };
  
  const tieMatchGironiText = tieMatchGironiMap[tieMatchGironi] || "";
  const tieMatchFinalsText = tieMatchFinalsMap[tieMatchFinals] || "";
  
  let ruleContent = "";
  
  // =====================================================
  // CRITERI PAREGGIO IN PARTITA - CON FINALI
  // =====================================================
  if (hasFinals) {
    // Stesso criterio per gironi e finali
    if (tieMatchGironi === tieMatchFinals) {
      if (tieMatchGironiText) {
        ruleContent += `
          <p>
            Per tutte le partite del torneo, sia durante la fase a gironi che durante le fasi finali: 
            ${tieMatchGironiText}.
          </p>
        `;
      }
    }
    // Criteri diversi
    else {
      if (tieMatchGironiText) {
        ruleContent += `
          <p>
            <strong>Fase a gironi:</strong> ${tieMatchGironiText}.
          </p>
        `;
      }
      if (tieMatchFinalsText) {
        ruleContent += `
          <p>
            <strong>Fasi finali:</strong> ${tieMatchFinalsText}.
          </p>
        `;
      }
    }
  }
  // =====================================================
  // CRITERI PAREGGIO IN PARTITA - SENZA FINALI
  // =====================================================
  else {
    if (tieMatchGironiText) {
      ruleContent += `
        <p>
          Per tutte le partite del torneo: ${tieMatchGironiText}.
        </p>
      `;
    }
  }
  
  // =====================================================
  // FALLBACK
  // =====================================================
  if (!ruleContent) {
    ruleContent = `
      <p>
        I criteri per la gestione dei pareggi saranno comunicati prima dell'inizio del torneo.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Gestione dei pareggi</strong></p>
        ${ruleContent}
      </div>
    </div>
  `;
}




// ===============================
// 9j. REFEREE RULE (REGOLA 9)
// ===============================
function buildRefereeRule(tournament, ruleNumber) {
  const hasReferee = tournament.referee === true || String(tournament.referee).toUpperCase() === "TRUE";
  
  let ruleText = "";
  
  if (hasReferee) {
    ruleText = `
      <p>
        Per tutte le partite del torneo, l'organizzazione provvederà a designare un <strong>arbitro ufficiale</strong> 
        che sarà presente in campo per garantire il corretto svolgimento della gara.
      </p>
      <p>
        Le decisioni arbitrali sono <strong>insindacabili</strong> e vincolanti per entrambe le squadre.
      </p>
    `;
  } else {
    ruleText = `
      <p>
        Le partite di questo torneo seguono la formula dell'<strong>auto-arbitraggio</strong>.
      </p>
      <p>
        Le squadre sono tenute a <strong>rispettare le regole del gioco</strong> e a <strong>risolvere eventuali 
        controversie in modo sportivo e rispettoso</strong>, nel pieno spirito del fair play.
      </p>
      <p>
        In caso di dispute irrisolvibili, le squadre potranno contattare l'organizzazione, 
        che valuterà la situazione e adotterà i provvedimenti necessari.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Arbitraggio</strong></p>
        ${ruleText}
      </div>
    </div>
  `;
}
































// ===============================
// OLD SPECIFIC TOURNAMENTS RULES (solo per avere esempi per le nuove).
// ===============================






// ===============================
// 18. BUILD REFEREE RULE (AGGIORNATA CON ruleNumber)
// ===============================





// ===============================
// 19. BUILD GENERAL REFERENCE RULE (REGOLA 4)
// ===============================
function buildGeneralReferenceRule() {
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">📄</div>
      <div class="specific-regulation-content">
        <p><strong>Altre disposizioni</strong></p>
        <p>
          Per tutte le altre norme relative a fair play, ritardi, rinvii e spostamenti delle partite, 
          si rimanda al <strong>regolamento generale dei tornei ICE</strong> riportato in fondo a questa pagina.
        </p>
      </div>
    </div>
  `;
}


// ===============================
// 19b. BUILD FOOD RULE (NUOVA - opzionale, sempre ultima)
// ===============================
function buildFoodRule(tournament) {
  const food = String(tournament.food || "").toLowerCase();
  
  // Se food è "none" o vuoto, non mostriamo la regola
  if (!food || food === "none") {
    return "";
  }
  
  let foodText = "";
  
  if (food === "all") {
    foodText = `
      <p>
        La quota di iscrizione include <strong>pranzo e/o cena</strong> per tutti i partecipanti. 
        I dettagli su orari e location verranno comunicati prima dell'inizio del torneo.
      </p>
    `;
  } else if (food === "partial") {
    foodText = `
      <p>
        Durante il torneo saranno offerti <strong>snack e bevande</strong> a tutti i partecipanti.
      </p>
    `;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">🍽️</div>
      <div class="specific-regulation-content">
        <p><strong>Ristoro</strong></p>
        ${foodText}
      </div>
    </div>
  `;
}






























// ===============================
// 20. POPOLA CAMPI EXTRA FORM
// ===============================
function populateExtraFields(tournament) {
  const container = document.getElementById("extra-fields-container");
  container.innerHTML = "";

  const fixedCourt = tournament.fixed_court === true || String(tournament.fixed_court).toUpperCase() === "TRUE";

  if (fixedCourt) return;

  const availableDays = String(tournament.available_days || "").trim();
  const availableHours = String(tournament.available_hours || "").trim();

  // CAMPO 1: ZONA PREFERITA
  const zoneField = document.createElement("label");
  
  const zoneTitleSpan = document.createElement("span");
  zoneTitleSpan.className = "form-field-title";
  zoneTitleSpan.innerHTML = 'Zona preferita <span class="required-asterisk">*</span>';
  zoneField.appendChild(zoneTitleSpan);

  const zoneHelperSpan = document.createElement("span");
  zoneHelperSpan.className = "field-helper";
  zoneHelperSpan.textContent = "Indica la zona di Torino e provincia dove preferisci giocare (es. Moncalieri, Zona Lingotto, Zona Crocetta)";
  zoneField.appendChild(zoneHelperSpan);

  const zoneInput = document.createElement("input");
  zoneInput.type = "text";
  zoneInput.name = "preferred_zone";
  zoneInput.required = true;
  zoneInput.placeholder = "Es. Moncalieri";
  zoneField.appendChild(zoneInput);

  container.appendChild(zoneField);

  // CAMPO 2: GIORNI PREFERITI
  if (availableDays && availableDays.toUpperCase() !== "NA") {
    const daysField = buildDaysField(availableDays);
    container.appendChild(daysField);
  }

  // CAMPO 3: ORARIO PREFERITO
  if (availableHours && availableHours.toUpperCase() !== "NA") {
    const hoursField = buildHoursField(availableHours);
    container.appendChild(hoursField);
  }
}



// ===============================
// 21. BUILD DAYS FIELD
// ===============================
function buildDaysField(availableDays) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field-wrapper";
  
  const daysMap = parseDaysRange(availableDays);
  const minDays = (availableDays.toLowerCase() === "sab-dom") ? 1 : 2;
  
  const labelText = (minDays === 1) 
    ? "Giorno preferito" 
    : `Giorni preferiti (seleziona almeno ${minDays})`;

  // Creo lo span per il titolo con asterisco
  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.innerHTML = `${labelText} <span class="required-asterisk">*</span>`;
  wrapper.appendChild(titleSpan);

  // Helper text
  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Seleziona ${minDays === 1 ? 'il giorno' : 'i giorni'} in cui preferisci giocare`;
  wrapper.appendChild(helperSpan);

  // Checkbox group
  const checkboxGroup = document.createElement("div");
  checkboxGroup.className = "checkbox-group";
  checkboxGroup.dataset.minDays = minDays;

  daysMap.forEach(day => {
    const item = document.createElement("div");
    item.className = "checkbox-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "preferred_days[]";
    checkbox.value = day.value;
    checkbox.id = `day-${day.value}`;
    
    const itemLabel = document.createElement("label");
    itemLabel.setAttribute("for", `day-${day.value}`);
    itemLabel.textContent = day.label;
    
    item.appendChild(checkbox);
    item.appendChild(itemLabel);
    checkboxGroup.appendChild(item);
  });

  wrapper.appendChild(checkboxGroup);
  return wrapper;
}



// ===============================
// 22. BUILD HOURS FIELD
// ===============================
function buildHoursField(availableHours) {
  const wrapper = document.createElement("label");
  
  const slots = parseHoursSlots(availableHours);

  // Titolo con asterisco
  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.innerHTML = 'Orario preferito <span class="required-asterisk">*</span>';
  wrapper.appendChild(titleSpan);

  // Helper
  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = "Scegli lo slot orario in cui preferisci giocare";
  wrapper.appendChild(helperSpan);

  // Select
  const select = document.createElement("select");
  select.name = "preferred_hours";
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seleziona uno slot";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  slots.forEach(slot => {
    const option = document.createElement("option");
    option.value = slot.value;
    option.textContent = slot.label;
    select.appendChild(option);
  });

  wrapper.appendChild(select);
  return wrapper;
}





// ===============================
// 23. PARSE DAYS RANGE
// ===============================
function parseDaysRange(range) {
  const allDays = [
    { value: "lun", label: "Lunedì" },
    { value: "mar", label: "Martedì" },
    { value: "mer", label: "Mercoledì" },
    { value: "gio", label: "Giovedì" },
    { value: "ven", label: "Venerdì" },
    { value: "sab", label: "Sabato" },
    { value: "dom", label: "Domenica" }
  ];

  const rangeLower = range.toLowerCase();

  if (rangeLower === "lun-ven") {
    return allDays.slice(0, 5);
  }
  
  if (rangeLower === "sab-dom") {
    return allDays.slice(5, 7);
  }
  
  if (rangeLower === "lun-dom") {
    return allDays;
  }

  return allDays;
}

// ===============================
// 24. PARSE HOURS SLOTS
// ===============================
function parseHoursSlots(range) {
  const rangeLower = range.toLowerCase();
  const [start, end] = rangeLower.split("-").map(Number);
  
  if (!start || !end || end <= start) return [];

  const slots = [];
  
  for (let h = start; h <= end - 2; h++) {
    slots.push({
      value: `${h}-${h + 2}`,
      label: `${String(h).padStart(2, "0")}:00 - ${String(h + 2).padStart(2, "0")}:00`
    });
  }

  return slots;
}














// ===============================
// 25. STATO TORNEO (UI)
// ===============================
function applyTournamentState(tournament) {
  const registrationBlock = document.querySelector(".tournament-registration-block");
  
  form.style.display = "none";
  form.classList.remove("skeleton");
  badge.className = "badge";

  if (tournament.status === "open") {
    badge.textContent = "ISCRIZIONI APERTE";
    badge.classList.add("open");
    subscribeMessage.textContent = "Le iscrizioni sono aperte. Compila il form per iscrivere la tua squadra.";
    form.style.display = "flex";
    registrationBlock.style.display = "block";
    return;
  }

  if (tournament.status === "full") {
    badge.textContent = "COMPLETO";
    badge.classList.add("full");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">🚫</span>
      <strong>Torneo al completo</strong><br>
      Il numero massimo di squadre è stato raggiunto. Non è più possibile effettuare nuove iscrizioni.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    return;
  }

  if (tournament.status === "final_phase") {
    badge.textContent = "FASE FINALE";
    badge.classList.add("final_phase");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">🏆</span>
      <strong>Fase finale in corso</strong><br>
      Il torneo è entrato nella fase finale. Le iscrizioni sono chiuse.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    return;
  }

  if (tournament.status === "live") {
    badge.textContent = "IN CORSO";
    badge.classList.add("live");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">⚽</span>
      <strong>Torneo in corso</strong><br>
      Le partite sono già iniziate. Le iscrizioni sono chiuse.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    return;
  }

  if (tournament.status === "finished") {
    badge.textContent = "CONCLUSO";
    badge.classList.add("finished");
    // Nascondi completamente il blocco iscrizione per tornei conclusi
    registrationBlock.style.display = "none";
    return;
  }
}
















// ===============================
// 26. SUBMIT ISCRIZIONE (FIREBASE)
// ===============================
function handleFormSubmit(tournament) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // VALIDAZIONE CHECKBOX REGOLAMENTO
    const acceptRegulation = form.querySelector('input[name="accept_regulation"]');
    if (!acceptRegulation.checked) {
      showToast("Devi accettare il regolamento per iscriverti ⚠️");
      return;
    }

    // VALIDAZIONE GIORNI (SE PRESENTI)
    const checkboxGroup = form.querySelector(".checkbox-group");
    if (checkboxGroup) {
      const minDays = Number(checkboxGroup.dataset.minDays);
      const checked = form.querySelectorAll('input[name="preferred_days[]"]:checked');
      
      if (checked.length < minDays) {
        showToast(`Devi selezionare almeno ${minDays} ${minDays === 1 ? 'giorno' : 'giorni'} ⚠️`);
        return;
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll("input, select, textarea");

    // Costruisci payload JSON
    const payload = {
      tournament_id: tournament.tournament_id,
      team_name: form.querySelector('[name="team_name"]').value,
      email: form.querySelector('[name="email"]').value,
      phone: form.querySelector('[name="phone"]').value
    };

    // Campi extra (se presenti)
    const zoneInput = form.querySelector('[name="preferred_zone"]');
    if (zoneInput) {
      payload.preferred_zone = zoneInput.value;
    }

    const daysChecked = form.querySelectorAll('[name="preferred_days[]"]:checked');
    if (daysChecked.length > 0) {
      payload.preferred_days = Array.from(daysChecked).map(cb => cb.value).join(", ");
    }

    const hoursSelect = form.querySelector('[name="preferred_hours"]');
    if (hoursSelect) {
      payload.preferred_hours = hoursSelect.value;
    }

    // Campo note aggiuntive
    const notesTextarea = form.querySelector('[name="additional_notes"]');
    if (notesTextarea && notesTextarea.value.trim()) {
      payload.additional_notes = notesTextarea.value.trim();
    }

    // STATO LOADING
    submitBtn.innerHTML = `
      <span class="spinner"></span>
      Iscrizione in corso...
    `;
    submitBtn.classList.add("disabled");
    submitBtn.disabled = true;
    inputs.forEach(input => input.disabled = true);

    fetch(API_URLS.submitSubscription, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.text())
      .then(response => {
        if (response === "TOURNAMENT_NOT_FOUND") {
          showToast("Torneo non valido ❌");
          restoreForm();
          return;
        }

        if (response === "REGISTRATIONS_CLOSED") {
          showToast("Le iscrizioni sono chiuse ⚠️");
          restoreForm();
          return;
        }

        if (response === "INVALID_DATA") {
          showToast("Dati mancanti o non validi ⚠️");
          restoreForm();
          return;
        }

        // ✅ NUOVO: Gestione errori duplicati separati
        if (response === "DUPLICATE_TEAM") {
          showToast("Una squadra con questo nome è già iscritta ⚠️");
          restoreForm();
          return;
        }

        if (response === "DUPLICATE_EMAIL") {
          showToast("Questa email è già stata utilizzata ⚠️");
          restoreForm();
          return;
        }

        // ✅ Mantieni retrocompatibilità con vecchio codice DUPLICATE
        if (response === "DUPLICATE") {
          showToast("Questa email è già iscritta ⚠️");
          restoreForm();
          return;
        }

        if (response === "SUBSCRIPTION_SAVED") {
          showToast("Iscrizione completata 🎉");
          setTimeout(() => window.location.reload(), 1200);
          return;
        }

        showToast("Errore inatteso ❌");
        restoreForm();
      })
      .catch(err => {
        console.error("Errore submit:", err);
        showToast("Errore di connessione ❌");
        restoreForm();
      });

    function restoreForm() {
      submitBtn.innerHTML = "Invia iscrizione";
      submitBtn.classList.remove("disabled");
      submitBtn.disabled = false;
      inputs.forEach(input => input.disabled = false);
    }

  }, { once: true });
}













// ===============================
// 27. LOAD + RENDER TEAMS LIST
// ===============================
function loadAndRenderTeamsList(tournament) {
  if (!teamsListSection || !teamsListContainer || !teamsListCount) return;

  teamsListSection.classList.remove("hidden");
  teamsListContainer.innerHTML = "";
  teamsListCount.textContent = `${tournament.teams_current} / ${tournament.teams_max}`;

  renderTeamsSkeleton(8);

  const url = `${API_URLS.getTeams}?tournament_id=${encodeURIComponent(tournament.tournament_id)}`;

  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(teams => {
      if (!Array.isArray(teams)) throw new Error("Formato teams non valido");

      teamsListContainer.innerHTML = "";

      if (teams.length === 0) {
        renderTeamsEmptyState();
        return;
      }

      renderTeamsChips(teams);
    })
    .catch(err => {
      console.error("Errore caricamento teams:", err);
      teamsListContainer.innerHTML = "";
      renderTeamsErrorState();
    });
}

function renderTeamsChips(teams) {
  const frag = document.createDocumentFragment();

  teams.forEach((t, idx) => {
    const chip = document.createElement("div");
    chip.className = "team-chip";

    chip.innerHTML = `
      <span class="team-chip-index">${idx + 1}</span>
      <span class="team-chip-name">${escapeHTML(t.team_name || "")}</span>
    `;

    frag.appendChild(chip);
  });

  teamsListContainer.appendChild(frag);
}

// ===============================
// 28. TEAMS LIST STATES
// ===============================
function renderTeamsSkeleton(count) {
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "team-chip team-chip--skeleton";
    sk.innerHTML = `
      <span class="team-chip-index">&nbsp;</span>
      <span class="team-chip-name">&nbsp;</span>
    `;
    frag.appendChild(sk);
  }

  teamsListContainer.appendChild(frag);
}

function renderTeamsEmptyState() {
  const el = document.createElement("div");
  el.className = "teams-empty";
  el.textContent = "Nessuna squadra iscritta al momento.";
  teamsListContainer.appendChild(el);
}

function renderTeamsErrorState() {
  const el = document.createElement("div");
  el.className = "teams-error";
  el.textContent = "Errore nel caricamento delle squadre ❌";
  teamsListContainer.appendChild(el);
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}













// ===============================
// 29. TOAST NOTIFICATION
// ===============================
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}


