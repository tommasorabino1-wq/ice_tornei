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
  
  // REGOLA 2: Partecipanti
  rules.push(buildParticipantsRequirementsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 3: Premi
  rules.push(buildAwardsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 4: Formato
  rules.push(buildFormatTimeRangeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 5: Campi, giorni e orari
  rules.push(buildCourtDaysHoursRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 6: Formato partite
  rules.push(buildMatchFormatRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 7: Classifica
  rules.push(buildStandingsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 8: Gestione pareggi
  rules.push(buildMatchTiebreakersRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 9: Arbitro
  rules.push(buildRefereeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 10: Assicurazione sanitaria (se attiva)
  const insuranceRule = buildInsuranceRule(tournament, ruleNumber);
  if (insuranceRule) {
    rules.push(insuranceRule);
    ruleNumber++;
  }
  
  // REGOLA 11: Servizi e facilities (se presenti)
  const facilitiesRule = buildFacilitiesRule(tournament, ruleNumber);
  if (facilitiesRule) {
    rules.push(facilitiesRule);
    ruleNumber++;
  }
  
  // REGOLA 12: Comunicazioni ufficiali (sempre mostrata)
  rules.push(buildCommunicationsRule(ruleNumber));
  ruleNumber++;
  
  // REGOLA FINALE
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
  
  // =====================================================
  // MAPPING SINGOLI ELEMENTI
  // =====================================================
  
  // Gender mapping
  const genderMap = {
    "open": { 
      composition: "qualsiasi composizione (maschili, femminili o miste)",
      restriction: null 
    },
    "only_male": { 
      composition: "soli uomini",
      restriction: "Possono partecipare esclusivamente squadre composte da soli uomini." 
    },
    "only_female": { 
      composition: "sole donne",
      restriction: "Possono partecipare esclusivamente squadre composte da sole donne." 
    },
    "mixed_strict": { 
      composition: "miste",
      restriction: "Ogni squadra deve essere obbligatoriamente mista, composta da almeno un uomo e almeno una donna." 
    },
    "mixed_female_allowed": { 
      composition: "miste o femminili",
      restriction: "Ogni squadra deve essere mista (almeno un uomo e una donna) oppure composta da sole donne. Non sono ammesse squadre composte da soli uomini." 
    }
  };
  
  // Age mapping
  const ageMap = {
    "open": { 
      text: "qualsiasi età",
      restriction: null 
    },
    "under_18": { 
      text: "Under 18",
      restriction: "Tutti i componenti della squadra devono avere meno di 18 anni alla data di inizio del torneo." 
    },
    "over_35": { 
      text: "Over 35",
      restriction: "Tutti i componenti della squadra devono avere almeno 35 anni alla data di inizio del torneo." 
    }
  };
  
  // Expertise mapping
  const expertiseMap = {
    "open": {
      intro: "aperto a giocatori e squadre di qualsiasi livello",
      description: "È pensato per chi vuole divertirsi e mettersi in gioco in un contesto amatoriale."
    },
    "expert": {
      intro: "rivolto a giocatori esperti con un livello di gioco medio-alto",
      description: "Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico."
    }
  };
  
  // Max category mapping
  const maxCategoryMap = {
    "na": null,
    "prima_categoria": "Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Prima Categoria</strong> o categorie inferiori.",
    "eccellenza": "Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in <strong>Eccellenza</strong> o categorie inferiori."
  };
  
  // =====================================================
  // RECUPERA VALORI DAI MAPPING
  // =====================================================
  
  const genderData = genderMap[gender] || genderMap["open"];
  const ageData = ageMap[age] || ageMap["open"];
  const expertiseData = expertiseMap[expertise] || expertiseMap["open"];
  const categoryRestriction = maxCategoryMap[maxCategory] || null;
  
  // =====================================================
  // COSTRUZIONE TESTO GENDER + AGE
  // =====================================================
  
  let genderAgeText = "";
  
  if (gender === "open" && age === "open") {
    // Caso più semplice: tutto aperto
    genderAgeText = `Possono partecipare squadre di <strong>${genderData.composition}</strong> e giocatori di <strong>${ageData.text}</strong>.`;
  } 
  else if (gender === "open" && age !== "open") {
    // Composizione aperta, età limitata
    genderAgeText = `Possono partecipare squadre di <strong>${genderData.composition}</strong>, ma il torneo è riservato a giocatori <strong>${ageData.text}</strong>. ${ageData.restriction}`;
  }
  else if (gender !== "open" && age === "open") {
    // Composizione limitata, età aperta
    genderAgeText = `${genderData.restriction} Non ci sono limiti di età per i partecipanti.`;
  }
  else {
    // Entrambi limitati
    genderAgeText = `${genderData.restriction} Il torneo è riservato a giocatori <strong>${ageData.text}</strong>: ${ageData.restriction.toLowerCase()}`;
  }
  
  // =====================================================
  // COSTRUZIONE TESTO EXPERTISE + CATEGORY
  // =====================================================
  
  let expertiseText = `Questo torneo è <strong>${expertiseData.intro}</strong>. ${expertiseData.description}`;
  
  if (categoryRestriction) {
    expertiseText += ` ${categoryRestriction}`;
  }
  
  // =====================================================
  // COSTRUZIONE TESTO TEAM SIZE
  // =====================================================
  
  let teamSizeText = "";
  
  if (teamSizeMin > 0 && teamSizeMax > 0) {
    if (teamSizeMin === teamSizeMax) {
      teamSizeText = `Ogni squadra deve essere composta da esattamente <strong>${teamSizeMin} giocatori</strong>.`;
    } else {
      teamSizeText = `Ogni squadra deve essere composta da un <strong>minimo di ${teamSizeMin}</strong> e un <strong>massimo di ${teamSizeMax} giocatori</strong>.`;
    }
  } else if (teamSizeMin > 0) {
    teamSizeText = `Ogni squadra deve essere composta da almeno <strong>${teamSizeMin} giocatori</strong>.`;
  } else if (teamSizeMax > 0) {
    teamSizeText = `Ogni squadra può essere composta da un massimo di <strong>${teamSizeMax} giocatori</strong>.`;
  } else {
    teamSizeText = `Il numero di giocatori per squadra sarà comunicato prima dell'inizio del torneo.`;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Chi può partecipare</strong></p>
        <ul>
          <li><strong>Composizione e età:</strong> ${genderAgeText}</li>
          <li><strong>Livello:</strong> ${expertiseText}</li>
          <li><strong>Numero giocatori:</strong> ${teamSizeText}</li>
        </ul>
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
  
  // =====================================================
  // PUNTO 1: MONTEPREMI
  // =====================================================
  
  let mainAwardText = "";
  
  if (hasAward) {
    if (awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
      const percValue = Number(awardPerc) / 100;
      const totalPrize = Math.round(teamsMax * price * percValue);
      mainAwardText = `È previsto un <strong>montepremi</strong> pari a <strong>€${totalPrize}</strong>, che sarà suddiviso tra le prime 3 squadre classificate.`;
    } else {
      mainAwardText = `È previsto un <strong>montepremi</strong> per le squadre vincitrici. L'importo e la suddivisione saranno comunicati prima dell'inizio del torneo.`;
    }
  } else {
    mainAwardText = `Essendo un torneo aperto a giocatori e squadre di qualsiasi livello, al fine di evitare squilibri, sono previsti esclusivamente <strong>premi simbolici</strong> (coppe, medaglie, gadget e altri riconoscimenti) per le squadre vincitrici.`;
  }
  
  // =====================================================
  // PUNTO 2: GARANZIA MONTEPREMI
  // =====================================================
  
  let guaranteeText = "";
  
  if (hasAward && awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
    guaranteeText = `Il montepremi è garantito al raggiungimento di <strong>${teamsMax} squadre</strong> iscritte. In ogni caso, anche nella rara eventualità in cui non si raggiungesse il numero previsto di squadre, il premio rimarrà comunque almeno uguale al <strong>${awardPerc}%</strong> delle quote di iscrizione totali.`;
  } else if (hasAward) {
    guaranteeText = `Le condizioni per l'erogazione del montepremi saranno comunicate prima dell'inizio del torneo.`;
  } else {
    guaranteeText = `I premi simbolici saranno consegnati alle squadre vincitrici al termine del torneo.`;
  }
  
  // =====================================================
  // PUNTO 3: PREMI INDIVIDUALI
  // =====================================================
  
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
      
      mvpAwardText = `Saranno inoltre assegnati <strong>premi individuali</strong> per: ${prizesList}.`;
    } else {
      mvpAwardText = `Non sono previsti premi individuali per questo torneo.`;
    }
  } else {
    mvpAwardText = `Non sono previsti premi individuali per questo torneo.`;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Premi e riconoscimenti</strong></p>
        <ul>
          <li><strong>Montepremi:</strong> ${mainAwardText}</li>
          <li><strong>Garanzia:</strong> ${guaranteeText}</li>
          <li><strong>Premi individuali:</strong> ${mvpAwardText}</li>
        </ul>
      </div>
    </div>
  `;
}









// ===============================
// 9e. BUILD FORMAT RULE (REGOLA 4)
// ===============================
function buildFormatTimeRangeRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  
  // =====================================================
  // MAPPING ELEMENTI DEL FORMATO
  // =====================================================
  
  let structureText = "";
  let phaseDetailsText = "";
  let teamsInfoText = "";
  
  switch (formatType) {
    
    case "round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di sola andata</strong>, in cui ogni squadra affronterà una sola volta tutte le altre partecipanti.`;
      phaseDetailsText = `Non essendo prevista una fase finale, la squadra che chiuderà il girone al primo posto sarà proclamata vincitrice del torneo.`;
      teamsInfoText = `Il numero definitivo di squadre partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;
      
    case "double_round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di andata e ritorno</strong>, in cui ogni squadra affronterà due volte tutte le altre partecipanti.`;
      phaseDetailsText = `Non essendo prevista una fase finale, la squadra che chiuderà il girone al primo posto sarà proclamata vincitrice del torneo.`;
      teamsInfoText = `Il numero definitivo di squadre partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;
      
    case "round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con sola andata, in cui ogni squadra affronterà una sola volta le altre del proprio gruppo. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per la squadra vincente.`;
      teamsInfoText = `Il numero delle squadre partecipanti, delle squadre per girone e delle qualificate alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
      break;
      
    case "double_round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con andata e ritorno, in cui ogni squadra affronterà due volte le altre del proprio gruppo. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per la squadra vincente.`;
      teamsInfoText = `Il numero delle squadre partecipanti, delle squadre per girone e delle qualificate alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
      break;
      
    default:
      structureText = `Il formato dettagliato del torneo sarà comunicato prima dell'inizio delle partite.`;
      phaseDetailsText = `Le informazioni sulle fasi del torneo saranno disponibili alla chiusura delle iscrizioni.`;
      teamsInfoText = `Il numero definitivo di squadre partecipanti sarà comunicato alla chiusura delle iscrizioni.`;
      break;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato del torneo</strong></p>
        <ul>
          <li><strong>Struttura:</strong> ${structureText}</li>
          <li><strong>Fasi:</strong> ${phaseDetailsText}</li>
          <li><strong>Squadre:</strong> ${teamsInfoText}</li>
        </ul>
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
  
  // =====================================================
  // MAPPING GIORNI E ORARI
  // =====================================================
  
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
  
  const hoursMap = {
    "10-22": "tra le 10:00 e le 22:00",
    "10-19": "tra le 10:00 e le 19:00 (fascia diurna)",
    "19-22": "tra le 19:00 e le 22:00 (fascia serale)"
  };
  
  const daysText = daysMap[days] || days || "";
  const hoursText = hoursMap[hours] || hours || "";
  
  // =====================================================
  // FRASI BASE RIUTILIZZABILI
  // =====================================================
  
  // Disponibilità generale
  const availabilityText = `Le partite potranno svolgersi a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>.`;
  
  // Preferenze in fase di iscrizione
  const preferencesFullText = `In fase di iscrizione, le squadre potranno esprimere le proprie preferenze in merito a zona, giorni e orari in cui desiderano giocare.`;
  const preferencesDaysHoursText = `In fase di iscrizione, le squadre potranno esprimere le proprie preferenze in merito a giorni e orari in cui desiderano giocare.`;
  const preferencesZoneText = `In fase di iscrizione, le squadre potranno esprimere le proprie preferenze in merito alla zona in cui desiderano giocare.`;
  
  // Prenotazione da parte dell'organizzazione
  const bookingByOrgText = `L'organizzazione, per le partite in casa di ciascuna squadra, si occuperà di prenotare un campo disponibile tenendo conto delle preferenze espresse.`;
  
  // Comunicazione anticipata
  const advanceCommunicationText = `Le squadre non dovranno preoccuparsi della prenotazione: l'organizzazione provvederà a comunicare in anticipo il calendario completo.`;
  
  // =====================================================
  // MAPPING SCENARI
  // =====================================================
  
  const scenarios = {
    
    // TUTTO VARIABILE
    "false": {
      assignment: `Campi, giorni e orari delle partite verranno decisi dalle squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.`,
      availability: availabilityText,
      booking: `${preferencesFullText} ${bookingByOrgText}`
    },
    
    // TUTTO FISSO PER TUTTO IL TORNEO
    "court_days_hours_all": {
      assignment: `Campi, giorni e orari di tutte le partite saranno <strong>stabiliti dall'organizzazione</strong> e comunicati prima dell'inizio del torneo.`,
      availability: availabilityText,
      booking: advanceCommunicationText
    },
    
    // TUTTO FISSO SOLO PER LE FINALI
    "court_days_hours_finals": {
      assignment: hasFinals 
        ? `<strong>Fase a gironi:</strong> campi, giorni e orari verranno decisi dalle squadre e prenotati di volta in volta dall'organizzazione. <strong>Fase finale:</strong> campi, giorni e orari saranno stabiliti dall'organizzazione e comunicati al termine dei gironi.`
        : `Campi, giorni e orari delle partite verranno decisi dalle squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.`,
      availability: availabilityText,
      booking: hasFinals 
        ? `${preferencesFullText} ${bookingByOrgText}`
        : `${preferencesFullText} ${bookingByOrgText}`
    },
    
    // SOLO CAMPI FISSI PER TUTTO IL TORNEO
    "court_all": {
      assignment: `I <strong>campi</strong> in cui si svolgeranno le partite saranno stabiliti dall'organizzazione e comunicati prima dell'inizio del torneo. Giorni e orari verranno invece decisi dalle squadre.`,
      availability: availabilityText,
      booking: `${preferencesDaysHoursText} ${bookingByOrgText}`
    },
    
    // SOLO CAMPI FISSI PER LE FINALI
    "court_finals": {
      assignment: hasFinals 
        ? `<strong>Fase a gironi:</strong> campi, giorni e orari verranno decisi dalle squadre e prenotati di volta in volta dall'organizzazione. <strong>Fase finale:</strong> i campi saranno stabiliti dall'organizzazione; giorni e orari verranno concordati con le squadre qualificate.`
        : `Campi, giorni e orari delle partite verranno decisi dalle squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.`,
      availability: availabilityText,
      booking: `${preferencesFullText} ${bookingByOrgText}`
    },
    
    // GIORNI E ORARI FISSI PER TUTTO IL TORNEO
    "days_hours_all": {
      assignment: `<strong>Giorni e orari</strong> delle partite saranno stabiliti dall'organizzazione e comunicati prima dell'inizio del torneo. I campi verranno invece prenotati di volta in volta.`,
      availability: availabilityText,
      booking: `${preferencesZoneText} ${bookingByOrgText}`
    },
    
    // GIORNI E ORARI FISSI SOLO PER LE FINALI
    "days_hours_finals": {
      assignment: hasFinals 
        ? `<strong>Fase a gironi:</strong> campi, giorni e orari verranno decisi dalle squadre e prenotati di volta in volta dall'organizzazione. <strong>Fase finale:</strong> giorni e orari saranno stabiliti dall'organizzazione; i campi verranno prenotati tenendo conto delle preferenze delle squadre qualificate.`
        : `Campi, giorni e orari delle partite verranno decisi dalle squadre partecipanti e prenotati, di volta in volta, dall'organizzazione.`,
      availability: availabilityText,
      booking: `${preferencesFullText} ${bookingByOrgText}`
    }
  };
  
  // =====================================================
  // RECUPERA SCENARIO O FALLBACK
  // =====================================================
  
  const scenario = scenarios[fixed] || {
    assignment: `Le modalità di assegnazione di campi, giorni e orari saranno comunicate prima dell'inizio del torneo.`,
    availability: availabilityText,
    booking: `Ulteriori dettagli saranno comunicati agli iscritti.`
  };
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Campi, giorni e orari delle partite</strong></p>
        <ul>
          <li><strong>Assegnazione:</strong> ${scenario.assignment}</li>
          <li><strong>Disponibilità:</strong> ${scenario.availability}</li>
          <li><strong>Prenotazione:</strong> ${scenario.booking}</li>
        </ul>
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
  
  // =====================================================
  // MAPPING BASE
  // =====================================================
  
  // Determina il testo per "vince la squadra..."
  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const winConditionText = isGameBasedSport 
    ? "al termine, vince la squadra con più game vinti" 
    : "al termine, vince la squadra in vantaggio";
  
  // Mapping formato partita (dinamico in base allo sport)
  const matchFormatMap = {
    "1x30": `un tempo unico da 30 minuti (${winConditionText})`,
    "1x60": `un tempo unico da 60 minuti (${winConditionText})`,
    "2x25": `due tempi da 25 minuti ciascuno (${winConditionText})`,
    "1x50": `un tempo unico da 50 minuti (${winConditionText})`,
    "1su1": "set singolo (vince chi si aggiudica il set)",
    "2su3": "due set su tre (vince chi si aggiudica per primo 2 set)"
  };
  
  const matchFormatGironiText = matchFormatMap[matchFormatGironi] || "da comunicare";
  const matchFormatFinalsText = matchFormatMap[matchFormatFinals] || "da comunicare";
  
  // =====================================================
  // COSTRUZIONE TESTI
  // =====================================================
  
  // Partite garantite
  let guaranteedText = "";
  if (guaranteedMatch > 0) {
    guaranteedText = `L'organizzazione garantisce a ogni squadra iscritta un minimo di <strong>${guaranteedMatch} partite</strong>, indipendentemente dai risultati ottenuti.`;
  } else {
    guaranteedText = `Il numero di partite dipenderà dal formato del torneo e dai risultati ottenuti.`;
  }
  
  // Formato gironi
  let gironiFormatText = "";
  if (hasFinals) {
    gironiFormatText = `Le partite della fase a gironi si disputeranno con la seguente formula: <strong>${matchFormatGironiText}</strong>.`;
  } else {
    gironiFormatText = `Tutte le partite del torneo si disputeranno con la seguente formula: <strong>${matchFormatGironiText}</strong>.`;
  }
  
  // Formato finali
  let finalsFormatText = "";
  if (hasFinals) {
    if (matchFormatGironi === matchFormatFinals) {
      finalsFormatText = `Le partite delle fasi finali si disputeranno con la <strong>stessa formula</strong> della fase a gironi.`;
    } else if (matchFormatFinals !== "na" && matchFormatFinalsText) {
      finalsFormatText = `Le partite delle fasi finali si disputeranno con la seguente formula: <strong>${matchFormatFinalsText}</strong>.`;
    } else {
      finalsFormatText = `Il formato delle partite delle fasi finali sarà comunicato al termine della fase a gironi.`;
    }
  } else {
    finalsFormatText = `Non essendo prevista una fase finale, tutte le partite seguiranno il formato sopra indicato.`;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato delle partite</strong></p>
        <ul>
          <li><strong>Partite garantite:</strong> ${guaranteedText}</li>
          <li><strong>Formato gironi:</strong> ${gironiFormatText}</li>
          <li><strong>Formato finali:</strong> ${finalsFormatText}</li>
        </ul>
      </div>
    </div>
  `;
}





// ===============================
// 9h. BUILD STANDINGS RULE (REGOLA 7)
// ===============================
function buildStandingsRule(tournament, ruleNumber) {
  const sport = String(tournament.sport || "").toLowerCase();
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
  const pointSystemGironi = String(tournament.point_system_gironi || "3-1-0").toLowerCase();
  const tieStandingGironi = String(tournament.tie_standing_gironi_criteria || "").toLowerCase();
  
  // =====================================================
  // MAPPING BASE
  // =====================================================
  
  // Terminologia in base allo sport
  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const goalTerminology = isGameBasedSport ? "game vinti" : "gol fatti";
  const goalDiffTerminology = isGameBasedSport ? "differenza game" : "differenza reti";
  
  // Sistema punti
  const pointSystemMap = {
    "3-1-0": "3 punti per la vittoria, 1 punto per il pareggio, 0 punti per la sconfitta",
    "2-1-0": "2 punti per la vittoria, 1 punto per il pareggio, 0 punti per la sconfitta"
  };
  
  // Criteri parità finale
  const tieStandingMap = {
    "moneta": "tramite lancio della moneta",
    "spareggio": "tramite una partita di spareggio"
  };
  
  const pointSystemText = pointSystemMap[pointSystemGironi] || "da comunicare";
  const tieStandingText = tieStandingMap[tieStandingGironi] || "";
  
  // =====================================================
  // COSTRUZIONE TESTI
  // =====================================================
  
  // Sistema punti
  let pointsText = "";
  if (hasFinals) {
    pointsText = `Il sistema di punteggio per la classifica della fase a gironi prevede: <strong>${pointSystemText}</strong>.`;
  } else {
    pointsText = `Il sistema di punteggio per la classifica prevede: <strong>${pointSystemText}</strong>.`;
  }
  
  // Criteri parità stesso girone
  const sameGroupText = `In caso di parità di punti tra due o più squadre dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di importanza): <strong>scontri diretti</strong>, <strong>${goalDiffTerminology}</strong>, <strong>${goalTerminology}</strong>.`;
  
  // Criteri parità gironi diversi (solo se ci sono finali)
  let crossGroupText = "";
  if (hasFinals) {
    crossGroupText = `Per confrontare squadre di gironi diversi (es. migliori seconde), in caso di parità di punti si useranno: <strong>${goalDiffTerminology}</strong>, <strong>${goalTerminology}</strong>.`;
  } else {
    crossGroupText = `Essendo un girone unico, non sarà necessario confrontare squadre di gironi diversi.`;
  }
  
  // Parità persistente
  let persistentTieText = "";
  if (tieStandingText) {
    persistentTieText = `Se, dopo l'applicazione di tutti i criteri, dovesse persistere una situazione di parità, questa verrà risolta <strong>${tieStandingText}</strong>.`;
  } else {
    persistentTieText = `In caso di parità persistente dopo l'applicazione di tutti i criteri, la modalità di risoluzione sarà comunicata dall'organizzazione.`;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Classifica</strong></p>
        <ul>
          <li><strong>Sistema punti:</strong> ${pointsText}</li>
          <li><strong>Parità stesso girone:</strong> ${sameGroupText}</li>
          <li><strong>Parità gironi diversi:</strong> ${crossGroupText}</li>
          <li><strong>Parità persistente:</strong> ${persistentTieText}</li>
        </ul>
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
  
  // =====================================================
  // MAPPING BASE
  // =====================================================
  
  const tieMatchMap = {
    "tie_accettato": "il pareggio è un risultato valido e verrà assegnato 1 punto a ciascuna squadra",
    "moneta": "in caso di parità al termine del tempo regolamentare, il vincitore sarà deciso tramite lancio della moneta",
    "rigori": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato ai calci di rigore",
    "tiebreak": "in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato con un tiebreak a 7 punti",
    "spareggio": "in caso di parità al termine del tempo regolamentare, si procederà con un tempo supplementare di spareggio"
  };
  
  const tieMatchGironiText = tieMatchMap[tieMatchGironi] || "da comunicare";
  const tieMatchFinalsText = tieMatchMap[tieMatchFinals] || "da comunicare";
  
  // =====================================================
  // COSTRUZIONE TESTI
  // =====================================================
  
  // Pareggio in fase gironi
  let gironiTieText = "";
  if (hasFinals) {
    gironiTieText = `Durante la fase a gironi: ${tieMatchGironiText}.`;
  } else {
    gironiTieText = `Per tutte le partite del torneo: ${tieMatchGironiText}.`;
  }
  
  // Pareggio in fase finale
  let finalsTieText = "";
  if (hasFinals) {
    if (tieMatchGironi === tieMatchFinals) {
      finalsTieText = `Durante le fasi finali si applicherà la <strong>stessa regola</strong> della fase a gironi.`;
    } else {
      finalsTieText = `Durante le fasi finali: ${tieMatchFinalsText}.`;
    }
  } else {
    finalsTieText = `Non essendo prevista una fase finale, la regola sopra indicata si applica a tutte le partite.`;
  }
  
  // Nota importante
  let noteText = "";
  if (tieMatchGironi === "tie_accettato" && hasFinals && tieMatchFinals !== "tie_accettato") {
    noteText = `<strong>Nota:</strong> mentre nella fase a gironi il pareggio è ammesso, nelle fasi finali sarà sempre necessario determinare un vincitore.`;
  } else if (tieMatchGironi !== "tie_accettato") {
    noteText = `<strong>Nota:</strong> ogni partita dovrà avere un vincitore; non sono ammessi pareggi.`;
  } else {
    noteText = `<strong>Nota:</strong> il pareggio è ammesso e contribuisce alla classifica con 1 punto per squadra.`;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Gestione dei pareggi in partita</strong></p>
        <ul>
          <li><strong>Fase gironi:</strong> ${gironiTieText}</li>
          <li><strong>Fase finale:</strong> ${finalsTieText}</li>
          <li>${noteText}</li>
        </ul>
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
// 9k. BUILD INSURANCE RULE
// ===============================
function buildInsuranceRule(tournament, ruleNumber) {
  const insuranceIncluded =
    tournament.insurance_included === true ||
    String(tournament.insurance_included).toUpperCase() === "TRUE";

  if (!insuranceIncluded) return "";

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Copertura assicurativa e certificato medico</strong></p>

        <p>
          Per il presente torneo, l'organizzazione provvederà ad attivare 
          una <strong>copertura assicurativa contro gli infortuni</strong> 
          a favore dei partecipanti.
        </p>

        <p>
          La copertura assicurativa sarà valida esclusivamente per gli atleti 
          in possesso di <strong>certificato medico (agonistico o non agonistico) 
          in corso di validità</strong>.
          In assenza di certificato valido, eventuali infortuni non saranno coperti.
        </p>
      </div>
    </div>
  `;
}



// ===============================
// 9l. BUILD FACILITIES RULE (REGOLA 11)
// ===============================
function buildFacilitiesRule(tournament, ruleNumber) {
  const food = String(tournament.food || "none").toLowerCase();
  const palla = String(tournament.palla || "false").toLowerCase();
  const racket = String(tournament.racket || "NA").toLowerCase();
  const upsell = String(tournament.upsell || "none").toLowerCase();
  const sport = String(tournament.sport || "").toLowerCase();
  
  // =====================================================
  // MAPPING BASE
  // =====================================================
  
  // Terminologia in base allo sport
  const isRacketSport = sport.includes("padel") || sport.includes("tennis");
  const ballTerminology = isRacketSport ? "palline" : "palloni";
  
  // Food mapping
  const foodMap = {
    "all": "L'organizzazione offrirà un <strong>pasto completo</strong> a tutti i partecipanti.",
    "partial": "L'organizzazione offrirà <strong>snack e bevande</strong> a tutti i partecipanti.",
    "none": null
  };
  
  // Upsell mapping
  const upsellMap = {
    "kit": {
      kit: "Sarà possibile acquistare un <strong>kit sportivo \"Tornei ICE\"</strong> (magliette o altro materiale tecnico) a <strong>prezzo di costo</strong>.",
      photo: null
    },
    "photo": {
      kit: null,
      photo: "Saranno presenti <strong>fotografi professionali</strong> per foto e video delle partite, disponibili <strong>gratuitamente</strong> per chi condividerà i contenuti sui social taggando Tornei ICE."
    },
    "kit_photo": {
      kit: "Sarà possibile acquistare un <strong>kit sportivo \"Tornei ICE\"</strong> a <strong>prezzo di costo</strong>.",
      photo: "Saranno presenti <strong>fotografi professionali</strong> per foto e video delle partite, disponibili <strong>gratuitamente</strong> per chi condividerà i contenuti sui social taggando Tornei ICE."
    },
    "none": {
      kit: null,
      photo: null
    }
  };
  
  // =====================================================
  // COSTRUZIONE TESTI
  // =====================================================
  
  // Food
  const foodText = foodMap[food] || null;
  
  // Palla
  const hasPalla = palla === "true";
  const pallaText = hasPalla 
    ? `L'organizzazione fornirà i <strong>${ballTerminology}</strong> necessari per tutte le partite del torneo.`
    : null;
  
  // Racket
  let racketText = null;
  if (isRacketSport && racket !== "na" && racket !== "0") {
    const racketNumber = Number(racket) || 0;
    if (racketNumber === 1) {
      racketText = `L'organizzazione metterà a disposizione <strong>1 racchetta</strong> per i partecipanti che ne avessero bisogno.`;
    } else if (racketNumber > 1) {
      racketText = `L'organizzazione metterà a disposizione <strong>${racketNumber} racchette</strong> per i partecipanti che ne avessero bisogno.`;
    }
  }
  
  // Upsell
  const upsellData = upsellMap[upsell] || upsellMap["none"];
  const kitText = upsellData.kit;
  const photoText = upsellData.photo;
  
  // =====================================================
  // COSTRUZIONE LISTA
  // =====================================================
  
  const items = [];
  
  if (foodText) {
    items.push(`<li><strong>Ristoro:</strong> ${foodText}</li>`);
  }
  
  if (pallaText) {
    items.push(`<li><strong>Attrezzatura:</strong> ${pallaText}</li>`);
  }
  
  if (racketText) {
    items.push(`<li><strong>Racchette:</strong> ${racketText}</li>`);
  }
  
  if (kitText) {
    items.push(`<li><strong>Kit sportivo:</strong> ${kitText}</li>`);
  }
  
  if (photoText) {
    items.push(`<li><strong>Foto e video:</strong> ${photoText}</li>`);
  }
  
  // =====================================================
  // SE NON C'È NESSUN SERVIZIO, NON MOSTRARE LA REGOLA
  // =====================================================
  
  if (items.length === 0) {
    return null;
  }
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Servizi aggiuntivi</strong></p>
        <ul>
          ${items.join('\n          ')}
        </ul>
      </div>
    </div>
  `;
}


// ===============================
// 9m. BUILD COMMUNICATIONS RULE
// ===============================
function buildCommunicationsRule(ruleNumber) {
  
  // =====================================================
  // TESTI BASE
  // =====================================================
  
  const introText = `Tutte le comunicazioni ufficiali relative al torneo verranno inviate all'indirizzo email indicato in fase di iscrizione.`;
  
  const emailPaymentText = `<strong>Email per il pagamento</strong> della quota di iscrizione, inviata dopo il completamento del form di iscrizione.`;
  
  const emailTeamText = `<strong>Email per i componenti della squadra</strong> e per l'invio dei certificati medici (o moduli di scarico responsabilità), inviata circa 3 settimane prima dell'inizio del torneo.`;
  
  const emailRulesText = `<strong>Email riepilogativa delle regole</strong> del torneo, inviata nei giorni precedenti all'inizio delle partite.`;
  
  const whatsappText = `A iscrizioni chiuse, i partecipanti verranno inseriti in un <strong>gruppo WhatsApp ufficiale</strong> del torneo, gestito dall'organizzazione, per comunicazioni operative e trasmissione dei risultati.`;
  
  // =====================================================
  // OUTPUT FINALE
  // =====================================================
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Comunicazioni ufficiali</strong></p>
        <ul>
          <li><strong>Email:</strong> ${introText}
            <ul>
              <li>${emailPaymentText}</li>
              <li>${emailTeamText}</li>
              <li>${emailRulesText}</li>
            </ul>
          </li>
          <li><strong>Gruppo WhatsApp:</strong> ${whatsappText}</li>
        </ul>
      </div>
    </div>
  `;
}








// ===============================
// 9Final. BUILD GENERAL REFERENCE RULE (ULTIMA REGOLA)
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
// FORM DI ISCRIZIONE
// ===============================



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


