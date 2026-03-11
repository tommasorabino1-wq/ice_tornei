// ===============================
// TOURNAMENT PAGE LOGIC (ICE)
// ===============================


// ===============================
// 0. HAMBURGER MENU TOGGLE
// ===============================
const menuToggle = document.querySelector(".mobile-menu-toggle");
const mainNav = document.querySelector(".main-nav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    menuToggle.classList.toggle("active");
    mainNav.classList.toggle("active");

    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
  });
}


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
let form = document.getElementById("registration-form");  // ← CAMBIA const → let
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
  getTeamsWithLogos: "https://getteamswithlogos-dzvezz2yhq-uc.a.run.app",
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

  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  // ✅ Aggiorna elementi dinamici individual/team
  const capacityEntityLabel = document.getElementById("capacity-entity-label");
  if (capacityEntityLabel) {
    capacityEntityLabel.textContent = isIndividual ? "giocatori iscritti" : "squadre iscritte";
  }

  const teamsBlockTitle = document.getElementById("teams-block-title");
  if (teamsBlockTitle) {
    teamsBlockTitle.textContent = isIndividual ? "Giocatori iscritti" : "Squadre iscritte";
  }

  const teamsBlockIcon = document.getElementById("teams-block-icon");
  if (teamsBlockIcon) {
    teamsBlockIcon.textContent = isIndividual ? "👤" : "👥";
  }

  const formStep1Label = document.getElementById("form-step1-label");
  if (formStep1Label) {
    formStep1Label.textContent = isIndividual ? "Dati giocatore" : "Dati squadra";
  }

  const teamNameLabel = document.getElementById("team-name-label");
  if (teamNameLabel) {
    teamNameLabel.innerHTML = isIndividual
      ? 'Nome e Cognome <span class="required-asterisk">*</span>'
      : 'Nome squadra <span class="required-asterisk">*</span>';
  }

  // Header
  document.getElementById("tournament-name").textContent = tournament.name;

  document.getElementById("tournament-subtitle").textContent =
    `${tournament.location} · ${tournament.date} · ${tournament.sport}`;

  // ✅ Info torneo
  renderTournamentInfoRows(tournament);

  // ✅ AGGIORNA PROGRESS BAR POSTI
  updateTournamentCapacity(
    tournament.teams_current,
    tournament.teams_max
  );

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

  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const row1 = `${tournament.sport} · ${tournament.location} · ${tournament.date}`;
  const row2 = buildParticipantsInfoText(tournament);
  const row3 = buildPriceInfoText(tournament, isIndividual);
  const row4 = buildAwardInfoText(tournament);
  const row5 = buildFormatInfoText(tournament);
  const row6 = buildTimeRangeInfoText(tournament);
  const row7 = buildCourtSchedulingModeText(tournament);
  const row8 = buildCourtDaysHoursRangeText(tournament);

  const teamsCurrent = tournament.teams_current || 0;
  const teamsMax = tournament.teams_max || 0;
  const participantsLabel = isIndividual ? 'giocatori iscritti' : 'squadre iscritte';
  const participantsIcon = isIndividual ? '👤' : '👥';
  const row9 = `${teamsCurrent} / ${teamsMax} ${participantsLabel}`;

  container.innerHTML = `
    <div class="info-row"><span class="info-row-icon">🏐</span><span><strong>Sport, Luogo, Data:</strong> ${escapeHTML(row1)}</span></div>
    <div class="info-row"><span class="info-row-icon">${participantsIcon}</span><span><strong>Partecipanti:</strong> ${row2}</span></div>
    <div class="info-row"><span class="info-row-icon">💰</span><span><strong>Iscrizione:</strong> ${row3}</span></div>
    <div class="info-row"><span class="info-row-icon">🏆</span><span><strong>Montepremi:</strong> ${row4}</span></div>
    <div class="info-row"><span class="info-row-icon">📋</span><span><strong>Formato:</strong> ${row5}</span></div>
    <div class="info-row"><span class="info-row-icon">📅</span><span><strong>Durata:</strong> ${row6}</span></div>
    <div class="info-row"><span class="info-row-icon">🥅</span><span><strong>Gestione campi e orari:</strong> ${row7}</span></div>
    <div class="info-row"><span class="info-row-icon">🕒</span><span><strong>Giorni e fasce orarie disponibili:</strong> ${row8}</span></div>
    <div class="info-row"><span class="info-row-icon">✅</span><span><strong>Iscritti:</strong> ${row9}</span></div>
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
function buildPriceInfoText(t, isIndividual = false) {
  const price = t.price || 0;
  const perLabel = isIndividual ? 'a giocatore' : 'a squadra';

  const courtPrice = String(t.court_price || "non_compreso").toLowerCase();
  const refereePrice = String(t.referee_price || "na").toLowerCase();

  let courtText = "";

  switch (courtPrice) {
    case "compreso_gironi_finals":
      courtText = "Campi inclusi";
      break;
    case "compreso_gironi":
      courtText = "Campi inclusi solo per la fase a gironi";
      break;
    case "compreso_finals":
      courtText = "Campi inclusi solo per la fase finale";
      break;
    case "non_compreso":
    default:
      courtText = "Campi non inclusi";
  }

  let refereeText = "";

  if (refereePrice === "na") {
    refereeText = "";
  } else if (refereePrice === "non_compreso") {
    refereeText = "arbitro non incluso";
  } else {
    refereeText = "arbitro incluso";
  }

  const parts = [courtText];

  if (refereeText) {
    parts.push(refereeText);
  }

  return `€${price} ${perLabel} · ${parts.join(", ")}`;
}

// ===============================
// 7e. BUILD AWARD INFO TEXT
// ===============================
function buildAwardInfoText(t) {
  const hasAward = t.award === true || String(t.award).toUpperCase() === "TRUE";
  
  if (!hasAward) {
    return "Premi simbolici";
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
    mid: "Una partita a settimana per gironi · Finali in un giorno",
    long: "Una partita a settimana per gironi e finali"
  };

  return timeMap[t.time_range] || "Durata da definire";
}

// ===============================
// 7h. BUILD COURT SCHEDULING MODE TEXT
// ===============================
function buildCourtSchedulingModeText(t) {
  const fixed = String(t.fixed_court_days_hours || "false").toLowerCase();

  const fixedMap = {
    "false": "A scelta per tutte le partite",
    "fixed_finals": "A scelta (Gironi) · Prestabiliti (Finali)",
    "fixed_all": "Prestabiliti per tutte le partite"
  };

  return fixedMap[fixed] || "A scelta per tutte le partite";
}


// ===============================
// 7i. BUILD COURT DAYS & HOURS RANGE TEXT
// ===============================
function buildCourtDaysHoursRangeText(t) {

  const daysRaw = String(t.available_days || "").toLowerCase().trim();
  const hoursRaw = String(t.available_hours || "").toLowerCase().trim();

  const parts = [];

  // =====================================================
  // GIORNI
  // =====================================================

  const dayLabels = {
    lun: "Lunedì",
    mar: "Martedì",
    mer: "Mercoledì",
    gio: "Giovedì",
    giov: "Giovedì",
    ven: "Venerdì",
    sab: "Sabato",
    dom: "Domenica"
  };

  if (daysRaw.includes("-")) {

    // Range (es. lun-ven, sab-dom, ven-dom, lun-dom)
    const [start, end] = daysRaw.split("-");

    if (daysRaw === "lun-dom") {
      parts.push("Tutti i giorni");
    } 
    else if (daysRaw === "lun-ven") {
      parts.push("Lun-Ven");
    } 
    else if (daysRaw === "sab-dom") {
      parts.push("Weekend");
    } 
    else if (daysRaw === "ven-dom") {
      parts.push("Ven-Dom");
    } 
    else if (dayLabels[start] && dayLabels[end]) {
      parts.push(`${dayLabels[start]} - ${dayLabels[end]}`);
    }

  } else if (dayLabels[daysRaw]) {

    // Giorno singolo
    parts.push(dayLabels[daysRaw]);
  }

  // =====================================================
  // ORARI (DINAMICI)
  // =====================================================

  if (hoursRaw && hoursRaw.includes("-")) {

    const [startHour, endHour] = hoursRaw.split("-");

    const formatHour = (h) => {
      const hourNumber = Number(h);
      if (isNaN(hourNumber)) return null;
      return `${hourNumber.toString().padStart(2, "0")}:00`;
    };

    const formattedStart = formatHour(startHour);
    const formattedEnd = formatHour(endHour);

    if (formattedStart && formattedEnd) {
      parts.push(`${formattedStart}-${formattedEnd}`);
    }
  }

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
  
  // REGOLA 13: Rimborsi e spostamenti (sempre mostrata)
  rules.push(buildFairPlayAndFlexibilityRule(ruleNumber));
  ruleNumber++;
  
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  // === INTRO: Quota base ===
  const perLabel = isIndividual ? 'a giocatore' : 'a squadra';
  let introText = `
    <p>
      La quota di iscrizione per questo torneo è di <strong>€${price} ${perLabel}</strong>.
    </p>
  `;

  // === CASO NA: tornei individuali senza campi da prenotare (es. scacchi) ===
  if (courtPrice === 'na') {
    const inclusionText = `
      <p>
        La quota include l'utilizzo della location per tutte le partite del torneo.
        Non sono previsti costi aggiuntivi per i partecipanti.
      </p>
    `;
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

  // === TUTTI GLI ALTRI CASI: tornei a squadre con campi ===
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const fideRated = String(tournament.fide_rated || "NA").toLowerCase();

  // =====================================================
  // MAPPING SINGOLI ELEMENTI
  // =====================================================

  const genderMap = {
    "open": {
      team: "qualsiasi composizione (maschili, femminili o miste)",
      individual: "qualsiasi genere",
      teamRestriction: null,
      individualRestriction: null
    },
    "only_male": {
      team: "soli uomini",
      individual: "uomini",
      teamRestriction: "Possono partecipare esclusivamente squadre composte da soli uomini.",
      individualRestriction: "Possono partecipare esclusivamente giocatori di genere maschile."
    },
    "only_female": {
      team: "sole donne",
      individual: "donne",
      teamRestriction: "Possono partecipare esclusivamente squadre composte da sole donne.",
      individualRestriction: "Possono partecipare esclusivamente giocatrici di genere femminile."
    },
    "mixed_strict": {
      team: "miste",
      individual: "qualsiasi genere",
      teamRestriction: "Ogni squadra deve essere obbligatoriamente mista, composta da almeno un uomo e almeno una donna.",
      individualRestriction: null
    },
    "mixed_female_allowed": {
      team: "miste o femminili",
      individual: "qualsiasi genere",
      teamRestriction: "Ogni squadra deve essere mista (almeno un uomo e una donna) oppure composta da sole donne. Non sono ammesse squadre composte da soli uomini.",
      individualRestriction: null
    }
  };

  const ageMap = {
    "open": {
      text: "qualsiasi età",
      teamRestriction: null,
      individualRestriction: null
    },
    "under_18": {
      text: "Under 18",
      teamRestriction: "Tutti i componenti della squadra devono avere meno di 18 anni alla data di inizio del torneo.",
      individualRestriction: "Il partecipante deve avere meno di 18 anni alla data di inizio del torneo."
    },
    "over_35": {
      text: "Over 35",
      teamRestriction: "Tutti i componenti della squadra devono avere almeno 35 anni alla data di inizio del torneo.",
      individualRestriction: "Il partecipante deve avere almeno 35 anni alla data di inizio del torneo."
    }
  };

  const expertiseMap = {
    "open": {
      teamIntro: "aperto a giocatori e squadre di qualsiasi livello",
      individualIntro: "aperto a giocatori di qualsiasi livello",
      description: "È pensato per chi vuole divertirsi e mettersi in gioco in un contesto amatoriale."
    },
    "expert": {
      teamIntro: "rivolto a giocatori esperti con un livello di gioco medio-alto",
      individualIntro: "rivolto a giocatori esperti con un livello di gioco medio-alto",
      description: "Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico."
    }
  };

  // =====================================================
  // RECUPERA VALORI DAI MAPPING
  // =====================================================

  const genderData = genderMap[gender] || genderMap["open"];
  const ageData = ageMap[age] || ageMap["open"];
  const expertiseData = expertiseMap[expertise] || expertiseMap["open"];

  let categoryRestriction = null;
  if (maxCategory && maxCategory !== "na") {
    if (maxCategory.startsWith("elo_")) {
      const eloValue = maxCategory.replace("elo_", "");
      categoryRestriction = `Al fine di evitare squilibri, sono ammessi esclusivamente giocatori con un punteggio ELO pari o inferiore a ${eloValue}.`;
    } else if (maxCategory === "prima_categoria") {
      categoryRestriction = "Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in Prima Categoria o categorie inferiori.";
    } else if (maxCategory === "eccellenza") {
      categoryRestriction = "Al fine di evitare squilibri, sono ammessi esclusivamente giocatori tesserati in Eccellenza o categorie inferiori.";
    }
  }

  // =====================================================
  // COSTRUZIONE TESTO GENDER + AGE
  // =====================================================

  let genderAgeText = "";

  if (isIndividual) {
    const genderPart = genderData.individual || "qualsiasi genere";
    const genderRestr = genderData.individualRestriction;
    const ageRestr = ageData.individualRestriction;

    if (!genderRestr && !ageRestr) {
      genderAgeText = `Possono partecipare giocatori di ${genderPart} e di ${ageData.text}.`;
    } else if (genderRestr && !ageRestr) {
      genderAgeText = `${genderRestr} Non ci sono limiti di età per i partecipanti.`;
    } else if (!genderRestr && ageRestr) {
      genderAgeText = `Possono partecipare giocatori di ${genderPart}, ma il torneo è riservato a partecipanti ${ageData.text}. ${ageRestr}`;
    } else {
      genderAgeText = `${genderRestr} Il torneo è inoltre riservato a partecipanti ${ageData.text}: ${ageRestr.toLowerCase()}`;
    }
  } else {
    const genderRestr = genderData.teamRestriction;
    const ageRestr = ageData.teamRestriction;

    if (gender === "open" && age === "open") {
      genderAgeText = `Possono partecipare squadre di ${genderData.team} e giocatori di ${ageData.text}.`;
    } else if (gender === "open" && age !== "open") {
      genderAgeText = `Possono partecipare squadre di ${genderData.team}, ma il torneo è riservato a giocatori ${ageData.text}. ${ageRestr}`;
    } else if (gender !== "open" && age === "open") {
      genderAgeText = `${genderRestr} Non ci sono limiti di età per i partecipanti.`;
    } else {
      genderAgeText = `${genderRestr} Il torneo è riservato a giocatori ${ageData.text}: ${ageRestr.toLowerCase()}`;
    }
  }

  // =====================================================
  // COSTRUZIONE TESTO EXPERTISE + CATEGORY
  // =====================================================

  const expertiseIntro = isIndividual ? expertiseData.individualIntro : expertiseData.teamIntro;
  let expertiseText = `Questo torneo è ${expertiseIntro}. ${expertiseData.description}`;

  if (categoryRestriction) {
    expertiseText += ` ${categoryRestriction}`;
  }

  // =====================================================
  // COSTRUZIONE TESTO TEAM SIZE (solo per tornei a squadre)
  // =====================================================

  let teamSizeText = "";

  if (!isIndividual) {
    if (teamSizeMin > 0 && teamSizeMax > 0) {
      if (teamSizeMin === teamSizeMax) {
        teamSizeText = `Ogni squadra deve essere composta da esattamente ${teamSizeMin} giocatori.`;
      } else {
        teamSizeText = `Ogni squadra deve essere composta da un minimo di ${teamSizeMin} e un massimo di ${teamSizeMax} giocatori.`;
      }
    } else if (teamSizeMin > 0) {
      teamSizeText = `Ogni squadra deve essere composta da almeno ${teamSizeMin} giocatori.`;
    } else if (teamSizeMax > 0) {
      teamSizeText = `Ogni squadra può essere composta da un massimo di ${teamSizeMax} giocatori.`;
    } else {
      teamSizeText = `Il numero di giocatori per squadra sarà comunicato prima dell'inizio del torneo.`;
    }
  }

  // =====================================================
  // COSTRUZIONE TESTO FIDE
  // =====================================================

  let fideText = "";

  if (fideRated === "true") {
    fideText = `Questo torneo è <strong>omologato FIDE</strong>. I risultati saranno registrati ufficialmente e influenzeranno il punteggio ELO dei partecipanti.`;
  } else if (fideRated === "false") {
    fideText = `Questo torneo <strong>non è omologato FIDE</strong>. I risultati non influenzeranno il punteggio ELO ufficiale dei partecipanti.`;
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
          ${!isIndividual ? `<li><strong>Numero giocatori:</strong> ${teamSizeText}</li>` : ''}
          ${fideText ? `<li><strong>Omologazione FIDE:</strong> ${fideText}</li>` : ''}
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entityPlural = isIndividual ? 'i partecipanti' : 'le squadre';
  const entityWinners = isIndividual ? 'i primi 3 classificati' : 'le prime 3 squadre classificate';
  const entityWinnersGeneric = isIndividual ? 'i vincitori' : 'le squadre vincitrici';
  const entityCount = isIndividual ? 'giocatori iscritti' : 'squadre iscritte';

  // =====================================================
  // PUNTO 1: MONTEPREMI
  // =====================================================

  let mainAwardText = "";

  if (hasAward) {
    if (awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
      const percValue = Number(awardPerc) / 100;
      const totalPrize = Math.round(teamsMax * price * percValue);
      mainAwardText = `È previsto un montepremi pari a <strong>€${totalPrize}</strong>, che sarà suddiviso tra ${entityWinners}.`;
    } else {
      mainAwardText = `È previsto un montepremi per ${entityWinnersGeneric}. L'importo e la suddivisione saranno comunicati prima dell'inizio del torneo.`;
    }
  } else {
    mainAwardText = `Essendo un torneo aperto a giocatori di qualsiasi livello, al fine di evitare squilibri, sono previsti esclusivamente premi simbolici (coppe, medaglie, gadget e altri riconoscimenti) per ${entityWinnersGeneric}.`;
  }

  // =====================================================
  // PUNTO 2: GARANZIA MONTEPREMI
  // =====================================================

  let guaranteeText = "";

  if (hasAward && awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
    guaranteeText = `Il montepremi è garantito al raggiungimento di ${teamsMax} ${entityCount}. In ogni caso, anche nella rara eventualità in cui non si raggiungesse il numero previsto, il premio rimarrà comunque almeno uguale al ${awardPerc}% delle quote di iscrizione totali.`;
  } else if (hasAward) {
    guaranteeText = `Le condizioni per l'erogazione del montepremi saranno comunicate prima dell'inizio del torneo.`;
  } else {
    guaranteeText = `I premi simbolici saranno consegnati a ${entityWinnersGeneric} al termine del torneo.`;
  }

  // =====================================================
  // PUNTO 3: PREMI INDIVIDUALI
  // =====================================================

  let mvpAwardText = "";

  if (mvpAward !== "none") {
    const mvpPrizes = [];

    if (mvpAward.includes("mvp")) {
      mvpPrizes.push("Miglior Giocatore (MVP)");
    }
    if (mvpAward.includes("scorer")) {
      mvpPrizes.push("Capocannoniere");
    }
    if (mvpAward.includes("goalkeeper")) {
      mvpPrizes.push("Miglior Portiere");
    }
    if (mvpAward.includes("fairplay")) {
      mvpPrizes.push("Premio Fair Play");
    }

    if (mvpPrizes.length > 0) {
      const prizesList = mvpPrizes.length === 1
        ? mvpPrizes[0]
        : mvpPrizes.slice(0, -1).join(", ") + " e " + mvpPrizes[mvpPrizes.length - 1];

      mvpAwardText = `Saranno inoltre assegnati premi individuali per: ${prizesList}.`;
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entitySingular = isIndividual ? 'giocatore' : 'squadra';
  const entityPlural = isIndividual ? 'giocatori' : 'squadre';
  const entityWinner = isIndividual ? 'il giocatore' : 'la squadra';

  // =====================================================
  // MAPPING ELEMENTI DEL FORMATO
  // =====================================================

  let structureText = "";
  let phaseDetailsText = "";
  let teamsInfoText = "";

  switch (formatType) {

    case "round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di sola andata</strong>, in cui ogni ${entitySingular} affronterà una sola volta tutti gli altri partecipanti.`;
      phaseDetailsText = `Non essendo prevista una fase finale, ${entityWinner} che chiuderà il girone al primo posto sarà proclamato/a vincitore/vincitrice del torneo.`;
      teamsInfoText = `Il numero definitivo di ${entityPlural} partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;

    case "double_round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di andata e ritorno</strong>, in cui ogni ${entitySingular} affronterà due volte tutti gli altri partecipanti.`;
      phaseDetailsText = `Non essendo prevista una fase finale, ${entityWinner} che chiuderà il girone al primo posto sarà proclamato/a vincitore/vincitrice del torneo.`;
      teamsInfoText = `Il numero definitivo di ${entityPlural} partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;

    case "round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con sola andata, in cui ogni ${entitySingular} affronterà una sola volta gli altri del proprio gruppo. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per il/la ${entitySingular} vincente.`;
      teamsInfoText = `Il numero dei ${entityPlural} partecipanti, dei ${entityPlural} per girone e dei qualificati alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
      break;

    case "double_round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con andata e ritorno, in cui ogni ${entitySingular} affronterà due volte gli altri del proprio gruppo. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per il/la ${entitySingular} vincente.`;
      teamsInfoText = `Il numero dei ${entityPlural} partecipanti, dei ${entityPlural} per girone e dei qualificati alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
      break;

    default:
      structureText = `Il formato dettagliato del torneo sarà comunicato prima dell'inizio delle partite.`;
      phaseDetailsText = `Le informazioni sulle fasi del torneo saranno disponibili alla chiusura delle iscrizioni.`;
      teamsInfoText = `Il numero definitivo di ${entityPlural} partecipanti sarà comunicato alla chiusura delle iscrizioni.`;
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
          <li><strong>${isIndividual ? 'Partecipanti' : 'Squadre'}:</strong> ${teamsInfoText}</li>
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
  const daysRaw = String(tournament.available_days || "").toLowerCase().trim();
  const hoursRaw = String(tournament.available_hours || "").toLowerCase().trim();
  const location = String(tournament.location || "");
  const formatType = String(tournament.format_type || "").toLowerCase();
  const timeRange = String(tournament.time_range || "").toLowerCase();
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const hasFinals = formatType.includes("finals");

  const venueLabel = isIndividual ? 'location' : 'campi';
  const venueLabelCap = isIndividual ? 'Location' : 'Campi';
  const entityPlural = isIndividual ? 'partecipanti' : 'squadre';

  // =====================================================
  // GIORNI DINAMICI
  // =====================================================

  const dayLabels = {
    lun: "lunedì",
    mar: "martedì",
    mer: "mercoledì",
    gio: "giovedì",
    giov: "giovedì",
    ven: "venerdì",
    sab: "sabato",
    dom: "domenica"
  };

  let daysText = "";

  if (daysRaw === "lun-dom") {
    daysText = "qualsiasi giorno della settimana";
  } else if (daysRaw === "lun-ven") {
    daysText = "dal lunedì al venerdì";
  } else if (daysRaw === "sab-dom") {
    daysText = "nel weekend (sabato e domenica)";
  } else if (daysRaw === "ven-dom") {
    daysText = "dal venerdì alla domenica";
  } else if (daysRaw.includes("-")) {
    const [start, end] = daysRaw.split("-");
    if (dayLabels[start] && dayLabels[end]) {
      daysText = `dal ${dayLabels[start]} al ${dayLabels[end]}`;
    }
  } else if (dayLabels[daysRaw]) {
    daysText = `il ${dayLabels[daysRaw]}`;
  }

  // =====================================================
  // ORARI DINAMICI
  // =====================================================

  let hoursText = "";

  if (hoursRaw.includes("-")) {
    const [start, end] = hoursRaw.split("-");

    const formatHour = (h) => {
      const n = Number(h);
      if (isNaN(n)) return null;
      return `${n.toString().padStart(2, "0")}:00`;
    };

    const startFormatted = formatHour(start);
    const endFormatted = formatHour(end);

    if (startFormatted && endFormatted) {
      hoursText = `tra le ${startFormatted} e le ${endFormatted}`;
    }
  }

  const officialConstraints = `a <strong>${location}</strong>, <strong>${daysText}</strong>, <strong>${hoursText}</strong>`;

  // =====================================================
  // DURATA TORNEO
  // =====================================================

  let durationText = "";

  switch (timeRange) {

    case "short":
      durationText = hasFinals
        ? `Il torneo si svolgerà interamente in un'unica giornata, con fase a gironi e fase finale nello stesso giorno.`
        : `Il torneo si svolgerà interamente in un'unica giornata.`;
      break;

    case "mid":
      durationText = hasFinals
        ? `La fase a gironi si disputerà su più settimane (indicativamente una partita a settimana), mentre la fase finale si svolgerà in un'unica giornata conclusiva.`
        : `Il torneo si disputerà su più settimane (indicativamente una partita a settimana).`;
      break;

    case "long":
      durationText = hasFinals
        ? `Sia la fase a gironi che la fase finale si disputeranno su più settimane (indicativamente una partita a settimana).`
        : `Il torneo si disputerà su più settimane (indicativamente una partita a settimana).`;
      break;

    default:
      durationText = `La durata e la distribuzione delle partite saranno comunicate prima dell'inizio del torneo.`;
  }

  // =====================================================
  // ORGANIZZAZIONE
  // =====================================================

  let organizationText = "";

  if (fixed === "false") {
    organizationText = hasFinals
      ? `I ${venueLabel} per le partite del torneo (sia fase a gironi che fase finale) saranno prenotati dall'organizzazione di volta in volta, considerando le preferenze riguardo a zona, giorni e orari espresse dai ${entityPlural} in fase di iscrizione. Tutte le partite si svolgeranno comunque ${officialConstraints}.`
      : `I ${venueLabel} per le partite del torneo saranno prenotati dall'organizzazione di volta in volta, considerando le preferenze riguardo a zona, giorni e orari espresse dai ${entityPlural} in fase di iscrizione. Tutte le partite si svolgeranno comunque ${officialConstraints}.`;
  }

  else if (fixed === "fixed_all") {
    organizationText = hasFinals
      ? `I ${venueLabel}, giorni e orari di tutte le partite del torneo (sia fase a gironi che fase finale) saranno prestabiliti dall'organizzazione e comunicati in anticipo ai ${entityPlural}. Tutte le partite si svolgeranno ${officialConstraints}.`
      : `I ${venueLabel}, giorni e orari di tutte le partite del torneo saranno prestabiliti dall'organizzazione e comunicati in anticipo ai ${entityPlural}. Tutte le partite si svolgeranno ${officialConstraints}.`;
  }

  else if (fixed === "fixed_finals" && hasFinals) {
    organizationText = `
      <ul>
        <li><strong>Fase a gironi:</strong> I ${venueLabel} per le partite della fase a gironi saranno prenotati dall'organizzazione di volta in volta, considerando le preferenze riguardo a zona, giorni e orari espresse dai ${entityPlural} in fase di iscrizione.</li>
        <li><strong>Fase finale:</strong> I ${venueLabel}, giorni e orari delle partite della fase finale saranno prestabiliti dall'organizzazione e comunicati ai ${entityPlural} qualificati al termine della fase a gironi.</li>
      </ul>
      Tutte le partite si svolgeranno comunque ${officialConstraints}.
    `;
  }

  else {
    organizationText = `Le modalità organizzative saranno comunicate prima dell'inizio del torneo. Le partite si svolgeranno ${officialConstraints}.`;
  }

  // =====================================================
  // OUTPUT
  // =====================================================

  const cardTitle = isIndividual ? 'Location, giorni, orari e calendario' : 'Campi, giorni, orari e calendario';
  const bookingLabel = isIndividual ? "L'organizzazione delle partite sarà a carico dell'organizzazione." : "La prenotazione dei campi sarà sempre a carico dell'organizzazione.";

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>${cardTitle}</strong></p>
        <ul>
          <li><strong>Durata:</strong> ${durationText}</li>
          <li><strong>Organizzazione partite:</strong> ${bookingLabel} ${organizationText}</li>
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();
  const matchFormatFinals = String(tournament.match_format_finals || "na").toLowerCase();
  const guaranteedMatch = Number(tournament.guaranteed_match) || 0;
  const timeIncrement = String(tournament.time_increment_seconds || "NA");

  // =====================================================
  // SPORT DETECTION
  // =====================================================

  const isFootball = sport.includes("calcio");
  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const isChess = sport.includes("scacchi") || sport.includes("chess");

  const entitySingular = isIndividual ? 'giocatore' : 'squadra';
  const entityPlural = isIndividual ? 'giocatori' : 'squadre';

  // =====================================================
  // FORMATO SCACCHI: estrai minuti e classifica
  // =====================================================

  function buildChessFormatText(formatStr) {
    // Formato atteso: "1xN" dove N = minuti per giocatore
    const match = formatStr.match(/^1x(\d+)$/);
    if (!match) return "da comunicare";

    const minutes = Number(match[1]);

    let timeControl = "";
    if (minutes < 3) {
      timeControl = "Bullet";
    } else if (minutes <= 10) {
      timeControl = "Blitz";
    } else if (minutes <= 60) {
      timeControl = "Rapid";
    } else {
      timeControl = "Classical";
    }

    let text = `${minutes} minuti per giocatore (${timeControl})`;

    if (timeIncrement && timeIncrement !== "NA" && !isNaN(Number(timeIncrement))) {
      text += ` con incremento Fischer di ${timeIncrement} secondi per mossa`;
    }

    return text;
  }

  // =====================================================
  // MAPPING BASE (sport non-scacchi)
  // =====================================================

  const isSetBasedGironi = ["1su1", "2su3", "3su5"].includes(matchFormatGironi);
  const isSetBasedFinals = ["1su1", "2su3", "3su5"].includes(matchFormatFinals);

  const winConditionText = isGameBasedSport
    ? "al termine, vince la squadra con più game vinti"
    : "al termine, vince la squadra in vantaggio";

  const matchFormatMap = {
    "1x30": `un tempo unico da 30 minuti (${winConditionText})`,
    "1x60": `un tempo unico da 60 minuti (${winConditionText})`,
    "2x25": `due tempi da 25 minuti ciascuno (${winConditionText})`,
    "2x30": `due tempi da 30 minuti ciascuno (${winConditionText})`,
    "1x50": `un tempo unico da 50 minuti (${winConditionText})`,
    "1su1": "set singolo (vince chi si aggiudica il set)",
    "2su3": "due set su tre (vince chi si aggiudica per primo 2 set)",
    "3su5": "tre set su cinque (vince chi si aggiudica per primo 3 set)"
  };

  const matchFormatGironiText = isChess
    ? buildChessFormatText(matchFormatGironi)
    : (matchFormatMap[matchFormatGironi] || "da comunicare");

  const matchFormatFinalsText = isChess
    ? buildChessFormatText(matchFormatFinals)
    : (matchFormatMap[matchFormatFinals] || "da comunicare");

  // =====================================================
  // PARTITE GARANTITE
  // =====================================================

  let guaranteedText = guaranteedMatch > 0
    ? `L'organizzazione garantisce a ogni ${entitySingular} iscritto un minimo di <strong>${guaranteedMatch} partite</strong>, indipendentemente dai risultati ottenuti.`
    : `Il numero di partite dipenderà dal formato del torneo e dai risultati ottenuti.`;

  // =====================================================
  // FORMATO GIRONI
  // =====================================================

  let gironiFormatText = hasFinals
    ? `Le partite della fase a gironi si disputeranno con la seguente formula: <strong>${matchFormatGironiText}</strong>.`
    : `Tutte le partite del torneo si disputeranno con la seguente formula: <strong>${matchFormatGironiText}</strong>.`;

  if (isChess) {
    gironiFormatText += ` <em>In caso di patta (pareggio), entrambi i giocatori ricevono 0.5 punti.</em>`;
  } else if (isSetBasedGironi) {
    gironiFormatText += ` <em>In questo formato non sono previsti pareggi.</em>`;
  }

  // =====================================================
  // FORMATO FINALI
  // =====================================================

  let finalsFormatText = "";

  if (hasFinals) {
    if (matchFormatGironi === matchFormatFinals) {
      finalsFormatText = `Le partite delle fasi finali si disputeranno con la <strong>stessa formula</strong> della fase a gironi.`;
    } else if (matchFormatFinals !== "na") {
      finalsFormatText = `Le partite delle fasi finali si disputeranno con la seguente formula: <strong>${matchFormatFinalsText}</strong>.`;
      if (!isChess && isSetBasedFinals) {
        finalsFormatText += ` <em>In questo formato non sono previsti pareggi.</em>`;
      }
    } else {
      finalsFormatText = `Il formato delle partite delle fasi finali sarà comunicato al termine della fase a gironi.`;
    }
  } else {
    finalsFormatText = `Non essendo prevista una fase finale, tutte le partite seguiranno il formato sopra indicato.`;
  }

  // =====================================================
  // MANCATA PRESENTAZIONE
  // =====================================================

  let forfeitResultText = "";

  if (isChess) {
    forfeitResultText = `una sconfitta a tavolino con punteggio <strong>0</strong> per il ${entitySingular} assente`;
  } else if (isFootball) {
    forfeitResultText = "una sconfitta a tavolino per <strong>3-0</strong>";
  } else if (isGameBasedSport) {
    if (isSetBasedGironi) {
      forfeitResultText = "una sconfitta a tavolino per <strong>2 set a 0</strong> (6-0, 6-0)";
    } else {
      forfeitResultText = "una sconfitta a tavolino per <strong>6 game a 0</strong>";
    }
  } else {
    forfeitResultText = "una sconfitta a tavolino secondo il regolamento del torneo";
  }

  const forfeitText = isChess
    ? `In assenza di preavviso, la mancata presentazione di un ${entitySingular} ad una partita comporterà ${forfeitResultText}.`
    : `In assenza di preavviso, la mancata presentazione di una ${entitySingular} ad una partita comporterà ${forfeitResultText}.`;

  // =====================================================
  // OUTPUT
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
          <li><strong>Mancata presentazione:</strong> ${forfeitText}</li>
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
  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();

  const pointSystem = String(tournament.point_system || "").toLowerCase();
  const tieStandingGironi = String(tournament.tie_standing_gironi_criteria || "").toLowerCase();
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  // =====================================================
  // SPORT DETECTION
  // =====================================================

  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const isSetBased = ["1su1", "2su3", "3su5"].includes(matchFormatGironi);
  const isChess = sport.includes("scacchi") || sport.includes("chess");

  const entityPlural = isIndividual ? 'giocatori' : 'squadre';
  const entitySingular = isIndividual ? 'giocatore' : 'squadra';

  // =====================================================
  // SISTEMA PUNTI
  // =====================================================

  let pointSystemText;

  if (isChess) {
    pointSystemText = `<strong>1 punto</strong> per la vittoria, <strong>0.5 punti</strong> per la patta, <strong>0 punti</strong> per la sconfitta`;
  } else if (isSetBased) {
    const parsed = pointSystem.split("-").map(p => parseInt(p.trim(), 10));
    const winPts = parsed[0] || 2;
    pointSystemText = `<strong>${winPts} punti</strong> per la vittoria, <strong>0 punti</strong> per la sconfitta. <em>Non sono previsti pareggi in questo formato.</em>`;
  } else {
    const pointSystemMap = {
      "3-1-0": "<strong>3 punti</strong> per la vittoria, <strong>1 punto</strong> per il pareggio, <strong>0 punti</strong> per la sconfitta",
      "2-1-0": "<strong>2 punti</strong> per la vittoria, <strong>1 punto</strong> per il pareggio, <strong>0 punti</strong> per la sconfitta"
    };
    pointSystemText = pointSystemMap[pointSystem] || pointSystemMap["3-1-0"];
  }

  let pointsText = hasFinals
    ? `Il sistema di punteggio per la classifica della fase a gironi prevede: ${pointSystemText}.`
    : `Il sistema di punteggio per la classifica prevede: ${pointSystemText}.`;

  // =====================================================
  // TERMINOLOGIA (sport non-scacchi)
  // =====================================================

  let terminology;

  if (isSetBased) {
    terminology = {
      scoreType: "set",
      scorePlural: "set",
      secondaryType: "game",
      secondaryPlural: "game",
      forLabel: "set vinti",
      againstLabel: "set persi",
      diffLabel: "differenza set",
      secondaryForLabel: "game vinti",
      secondaryDiffLabel: "differenza game"
    };
  } else if (isGameBasedSport) {
    terminology = {
      scoreType: "game",
      scorePlural: "game",
      forLabel: "game vinti",
      againstLabel: "game subiti",
      diffLabel: "differenza game"
    };
  } else {
    terminology = {
      scoreType: "gol",
      scorePlural: "gol",
      forLabel: "gol fatti",
      againstLabel: "gol subiti",
      diffLabel: "differenza reti"
    };
  }

  // =====================================================
  // CRITERI PARITÀ STESSO GIRONE
  // =====================================================

  let sameGroupText;

  if (isChess) {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):
      <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
        <li><strong>Scontri diretti</strong> (punti negli scontri tra i ${entityPlural} a pari punti)</li>
        <li><strong>Partita di spareggio</strong> in caso di parità persistente</li>
      </ul>`;
  } else if (isSetBased) {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):
      <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
        <li><strong>Scontri diretti</strong> (punti, differenza set, differenza game)</li>
        <li><strong>Differenza set</strong> generale</li>
        <li><strong>Set vinti</strong> totali</li>
        <li><strong>Differenza game</strong> generale</li>
        <li><strong>Game vinti</strong> totali</li>
      </ul>`;
  } else {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):
      <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
        <li><strong>Scontri diretti</strong> (punti, ${terminology.diffLabel}, ${terminology.forLabel})</li>
        <li><strong>${capitalizeFirst(terminology.diffLabel)}</strong> generale</li>
        <li><strong>${capitalizeFirst(terminology.forLabel)}</strong> totali</li>
      </ul>`;
  }

  // =====================================================
  // CRITERI PARITÀ GIRONI DIVERSI
  // =====================================================

  let crossGroupText;

  if (hasFinals) {
    if (isChess) {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. migliori secondi), in caso di parità di punti si useranno (in ordine di priorità):
        <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
          <li><strong>Punti totali</strong> nel girone</li>
          <li><strong>Sorteggio</strong> in caso di parità persistente</li>
        </ul>`;
    } else if (isSetBased) {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. migliori seconde), in caso di parità di punti si useranno (in ordine di priorità):
        <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
          <li><strong>Differenza set</strong></li>
          <li><strong>Set vinti</strong></li>
          <li><strong>Differenza game</strong></li>
          <li><strong>Game vinti</strong></li>
        </ul>`;
    } else {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. migliori seconde), in caso di parità di punti si useranno (in ordine di priorità):
        <ul style="margin-top:8px; margin-bottom:0; padding-left:20px;">
          <li><strong>${capitalizeFirst(terminology.diffLabel)}</strong></li>
          <li><strong>${capitalizeFirst(terminology.forLabel)}</strong></li>
        </ul>`;
    }
  } else {
    crossGroupText = `Essendo un girone unico, non sarà necessario confrontare ${entityPlural} di gironi diversi.`;
  }

  // =====================================================
  // PARITÀ PERSISTENTE
  // =====================================================

  const tieStandingMap = {
    "moneta": "tramite lancio della moneta",
    "spareggio": "tramite una partita di spareggio",
    "sorteggio": "tramite sorteggio"
  };

  const tieStandingText = tieStandingMap[tieStandingGironi] || "";

  let persistentTieText;
  if (tieStandingText) {
    persistentTieText = `Se, dopo l'applicazione di tutti i criteri, dovesse persistere una situazione di parità, questa verrà risolta ${tieStandingText}.`;
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
// HELPER: Capitalize first letter
// ===============================
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}





// ===============================
// 9i. BUILD MATCH TIEBREAKERS RULE (REGOLA 8)
// ===============================
function buildMatchTiebreakersRule(tournament, ruleNumber) {

  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  const sport = String(tournament.sport || "").toLowerCase();
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();
  const matchFormatFinals = String(tournament.match_format_finals || "").toLowerCase();

  const tieMatchGironi = String(tournament.tie_match_gironi_criteria || "").toLowerCase();
  const tieMatchFinals = String(tournament.tie_match_finals_criteria || "").toLowerCase();

  const isChess = sport.includes("scacchi") || sport.includes("chess");
  const entitySingular = isIndividual ? 'giocatore' : 'squadra';
  const entityPlural = isIndividual ? 'giocatori' : 'squadre';

  // =====================================================
  // DETERMINA SE È FORMATO A SET
  // =====================================================

  const setFormats = ["1su1", "2su3", "3su5"];
  const isSetBasedGironi = setFormats.includes(matchFormatGironi);
  const isSetBasedFinals = setFormats.includes(matchFormatFinals);

  // =====================================================
  // MAPPING BASE
  // =====================================================

  const tieMatchMap = {
    "tie_accettato": `il pareggio è un risultato valido e verrà assegnato 1 punto a ciascuna ${entitySingular}`,
    "moneta": `in caso di parità al termine del tempo regolamentare, il vincitore sarà deciso tramite lancio della moneta`,
    "rigori": `in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato ai calci di rigore`,
    "tiebreak": `in caso di parità al termine del tempo regolamentare, il vincitore verrà determinato con un tiebreak decisivo`,
    "spareggio": `in caso di parità al termine del tempo regolamentare, si procederà con un tempo supplementare di spareggio`
  };

  // =====================================================
  // FASE GIRONI
  // =====================================================

  let gironiTieText;

  if (isChess) {
    gironiTieText = `La patta è un risultato regolare. In caso di patta, a ciascun ${entitySingular} vengono assegnati <strong>0.5 punti</strong>.`;
  } else if (isSetBasedGironi) {
    gironiTieText = `Non essendo previsti pareggi in questo formato (a set), ogni partita determinerà automaticamente una ${entitySingular} vincitrice.`;
  } else {
    const text = tieMatchMap[tieMatchGironi] || "la modalità di gestione sarà comunicata dall'organizzazione";
    gironiTieText = `${text}.`;
  }

  // =====================================================
  // FASE FINALE
  // =====================================================

  let finalsTieText;

  if (!hasFinals) {

    finalsTieText = `Non essendo prevista una fase finale, la regola sopra indicata si applica a tutte le partite.`;

  } else if (isChess) {

    const text = tieMatchMap[tieMatchFinals] || "la modalità sarà comunicata dall'organizzazione";
    finalsTieText = `Nelle fasi finali è necessario determinare un vincitore: ${text}.`;

  } else if (isSetBasedFinals) {

    finalsTieText = `Anche nelle fasi finali, il formato a set non prevede pareggi: ogni partita determinerà una ${entitySingular} vincitrice.`;

  } else if (tieMatchGironi === tieMatchFinals) {

    finalsTieText = `Durante le fasi finali si applicherà la <strong>stessa regola</strong> prevista per la fase a gironi.`;

  } else {

    const text = tieMatchMap[tieMatchFinals] || "la modalità sarà comunicata dall'organizzazione";
    finalsTieText = `${text}.`;
  }

  // =====================================================
  // NOTA GENERALE
  // =====================================================

  let noteText;

  if (isChess) {

    noteText = `<strong>Nota:</strong> la patta è un risultato regolare negli scacchi e contribuisce alla classifica con 0.5 punti per ciascun ${entitySingular}. Nelle fasi finali sarà invece sempre necessario determinare un vincitore.`;

  } else if (isSetBasedGironi && (!hasFinals || isSetBasedFinals)) {

    noteText = `<strong>Nota:</strong> il formato a set non consente risultati di pareggio.`;

  } else if (tieMatchGironi === "tie_accettato" && hasFinals && tieMatchFinals !== "tie_accettato") {

    noteText = `<strong>Nota:</strong> mentre nella fase a gironi il pareggio è ammesso, nelle fasi finali sarà sempre necessario determinare un vincitore.`;

  } else if (tieMatchGironi !== "tie_accettato") {

    noteText = `<strong>Nota:</strong> ogni partita dovrà avere un vincitore, salvo diversa indicazione per la fase a gironi.`;

  } else {

    noteText = `<strong>Nota:</strong> il pareggio è ammesso nei casi sopra indicati e contribuisce alla classifica secondo il sistema punti previsto.`;
  }

  // =====================================================
  // OUTPUT
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
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entityPlural = isIndividual ? 'I partecipanti' : 'Le squadre';
  const entityPluralLower = isIndividual ? 'i partecipanti' : 'le squadre';

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
        ${entityPlural} sono tenuti a <strong>rispettare le regole del gioco</strong> e a <strong>risolvere eventuali 
        controversie in modo sportivo e rispettoso</strong>, nel pieno spirito del fair play.
      </p>
      <p>
        In caso di dispute irrisolvibili, ${entityPluralLower} potranno contattare l'organizzazione, 
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
          Per questo torneo, l'organizzazione provvederà ad attivare 
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
  const upsell = String(tournament.upsell || "none").toLowerCase();
  const palla = String(tournament.palla || "false").toLowerCase();
  const racket = String(tournament.racket || "na").toLowerCase();
  const sport = String(tournament.sport || "").toLowerCase();
  const boardCron = String(tournament.board_cron || "na").toLowerCase();
  const foodBar = String(tournament.food_bar || "na").toLowerCase();
  const price = Number(tournament.price) || 0;

  const isRacketSport = sport.includes("padel") || sport.includes("tennis");
  const ballTerminology = isRacketSport ? "le palline" : "i palloni";

  const items = [];

  // =====================================================
  // FOOD
  // =====================================================

  const foodMap = {
    all_all: "Pranzo/Cena offerto dall'organizzazione durante il torneo.",
    all_finals: "Pranzo/Cena offerto dall'organizzazione durante la fase finale del torneo.",
    partial_all: "Snack e bevande offerte dall'organizzazione durante il torneo.",
    partial_finals: "Snack e bevande offerte dall'organizzazione durante la fase finale del torneo.",
    none: null
  };

  if (foodMap[food]) {
    items.push(`<li><strong>Ristoro:</strong> ${foodMap[food]}</li>`);
  }

  // =====================================================
  // FOOD BAR
  // =====================================================

  if (foodBar !== "na" && foodBar !== "false" && !isNaN(Number(foodBar)) && price > 0) {
    const foodBarPerc = Number(foodBar);
    const foodBarValue = Math.round(price * foodBarPerc / 100);
    items.push(`<li><strong>Bar / Sala:</strong> Ogni partecipante potrà usufruire dei prodotti del bar/sala (drink, snack, ecc.) per un valore di <strong>€${foodBarValue}</strong> incluso nella quota di iscrizione.</li>`);
  }

  // =====================================================
  // PALLA (NA = sport senza palla, skip)
  // =====================================================

  if (palla !== "na") {
    const pallaMap = {
      true_all: `L'organizzazione fornirà <strong>${ballTerminology}</strong> per tutte le partite del torneo.`,
      true_finals: `L'organizzazione fornirà <strong>${ballTerminology}</strong> per le partite della fase finale.`,
      false: null
    };

    if (pallaMap[palla]) {
      items.push(`<li><strong>Materiale di gioco:</strong> ${pallaMap[palla]}</li>`);
    }
  }

  // =====================================================
  // BOARD & CRON (scacchi)
  // =====================================================

  if (boardCron !== "na" && boardCron !== "false") {
    const boardCronMap = {
      true_all: "L'organizzazione fornirà <strong>scacchiere e cronometri professionali</strong> per tutte le partite del torneo.",
      true_finals: "L'organizzazione fornirà <strong>scacchiere e cronometri professionali</strong> per le partite della fase finale."
    };

    if (boardCronMap[boardCron]) {
      items.push(`<li><strong>Scacchiere e cronometri:</strong> ${boardCronMap[boardCron]}</li>`);
    }
  }

  // =====================================================
  // RACKET
  // =====================================================

  if (isRacketSport) {
    const racketMap = {
      true_all: "Saranno messe a disposizione racchette per tutta la durata del torneo, per chi ne avesse necessità.",
      true_finals: "Saranno messe a disposizione racchette durante le partite della fase finale, per chi ne avesse necessità.",
      na: null
    };

    if (racketMap[racket]) {
      items.push(`<li><strong>Racchette:</strong> ${racketMap[racket]}</li>`);
    }
  }

  // =====================================================
  // UPSELL
  // =====================================================

  const upsellMap = {
    kit_all: {
      kit: "Durante il torneo, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.",
      photo: null
    },
    kit_finals: {
      kit: "Durante le partite della fase finale, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.",
      photo: null
    },
    photo_all: {
      kit: null,
      photo: "Durante tutte le partite del torneo, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti."
    },
    photo_finals: {
      kit: null,
      photo: "Durante le partite della fase finale, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti."
    },
    kit_photo_all: {
      kit: "Durante il torneo, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.",
      photo: "Durante tutte le partite del torneo, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti."
    },
    kit_photo_finals: {
      kit: "Durante le partite della fase finale, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.",
      photo: "Durante le partite della fase finale, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti."
    },
    none: {
      kit: null,
      photo: null
    }
  };

  const upsellData = upsellMap[upsell] || upsellMap.none;

  if (upsellData.kit) {
    items.push(`<li><strong>Kit ufficiale:</strong> ${upsellData.kit}</li>`);
  }

  if (upsellData.photo) {
    items.push(`<li><strong>Foto e video:</strong> ${upsellData.photo}</li>`);
  }

  // =====================================================
  // SE NON CI SONO SERVIZI → NON MOSTRARE REGOLA
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
        <p><strong>Servizi e iniziative durante il torneo</strong></p>
        <ul>
          ${items.join('\n')}
        </ul>
      </div>
    </div>
  `;
}







// ===============================
// 9m. BUILD COMMUNICATIONS RULE
// ===============================
function buildCommunicationsRule(tournament, ruleNumber) {
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const certificateRequired = tournament.certificate_required === true || String(tournament.certificate_required).toUpperCase() === 'TRUE';

  // =====================================================
  // TESTI BASE
  // =====================================================

  const introText = `Tutte le comunicazioni ufficiali relative al torneo verranno inviate all'indirizzo email indicato in fase di iscrizione.`;

  const emailPaymentText = `<strong>Email per il pagamento</strong> della quota di iscrizione, inviata dopo il completamento del form di iscrizione.`;

  let emailTeamText;
  if (isIndividual && certificateRequired) {
    emailTeamText = `<strong>Email per i dati del giocatore</strong> e per l'invio del certificato medico, inviata circa 2 settimane prima dell'inizio del torneo.`;
  } else if (isIndividual && !certificateRequired) {
    emailTeamText = `<strong>Email per i dati del giocatore</strong>, inviata circa 2 settimane prima dell'inizio del torneo.`;
  } else if (!isIndividual && certificateRequired) {
    emailTeamText = `<strong>Email per i componenti della squadra</strong> e per l'invio dei certificati medici, inviata circa 2 settimane prima dell'inizio del torneo.`;
  } else {
    emailTeamText = `<strong>Email per i componenti della squadra</strong>, inviata circa 2 settimane prima dell'inizio del torneo.`;
  }

  const emailRulesText = `<strong>Email riepilogativa delle regole</strong> del torneo, inviata nei giorni precedenti all'inizio delle partite.`;

  const whatsappText = `A iscrizioni chiuse, i partecipanti verranno inseriti in un gruppo WhatsApp ufficiale del torneo, gestito dall'organizzazione, per comunicazioni operative e trasmissione dei risultati.`;

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
// 9n. BUILD REFUNDS & MATCH MANAGEMENT RULE
// ===============================
function buildFairPlayAndFlexibilityRule(ruleNumber) {

  const introText = `L'organizzazione si impegna a garantire un torneo serio e ben strutturato, chiedendo a tutte le squadre rispetto degli impegni presi, puntualità e correttezza.`;

  const flexibilityText = `Allo stesso tempo, siamo ragazzi come voi. Sappiamo che possono capitare imprevisti, cambi di programma, infortuni, ecc. e vogliamo essere il più possibile flessibili per venire incontro alle esigenze delle squadre.`;

  const finalText = `Saremo quindi disposti a venire incontro alle vostre richieste, se ritenute valide e compatibili con il corretto svolgimento del torneo.`;

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Richieste particolari</strong></p>
        <ul>
          <li>${introText}</li>
          <li>${flexibilityText}</li>
          <li>${finalText}</li>
        </ul>
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

  const fixed = String(tournament.fixed_court_days_hours || "false").toLowerCase();
  
  const availableDays = String(tournament.available_days || "").trim().toLowerCase();
  const availableHours = String(tournament.available_hours || "").trim().toLowerCase();

  // CAMPO 1: ZONA PREFERITA (solo se non fixed_all)
  if (fixed !== "fixed_all") {
    const zoneField = buildZoneField(tournament);
    container.appendChild(zoneField);
  }

  // CAMPO 2: GIORNI PREFERITI (solo se non fixed_all e non è un giorno singolo)
  if (fixed !== "fixed_all" && availableDays && !isSingleDay(availableDays)) {
    const daysField = buildDaysField(availableDays);
    container.appendChild(daysField);
  }

  // CAMPO 3: ORARIO PREFERITO (solo se non fixed_all e c'è un range di orari)
  if (fixed !== "fixed_all" && availableHours && availableHours !== "na") {
    const hoursField = buildHoursField(availableHours);
    if (hoursField) {
      container.appendChild(hoursField);
    }
  }

  // CAMPO FINALE: NOTE AGGIUNTIVE (sempre presente, ultimo campo)
  const notesField = buildNotesField();
  container.appendChild(notesField);
}

// ===============================
// 20b. CHECK IF SINGLE DAY
// ===============================
function isSingleDay(days) {
  const singleDays = ["lun", "mar", "mer", "gio", "giov", "ven", "sab", "dom"];
  return singleDays.includes(days.toLowerCase());
}

// ===============================
// 20c. BUILD NOTES FIELD
// ===============================
function buildNotesField() {
  const wrapper = document.createElement("label");
  wrapper.className = "field-optional";
  
  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.textContent = "Note aggiuntive";
  wrapper.appendChild(titleSpan);

  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = "Hai richieste particolari o informazioni da comunicarci? Scrivile qui (facoltativo)";
  wrapper.appendChild(helperSpan);

  const textarea = document.createElement("textarea");
  textarea.name = "additional_notes";
  textarea.rows = 3;
  textarea.placeholder = "Es. Preferenze specifiche, richieste, informazioni utili...";
  wrapper.appendChild(textarea);

  return wrapper;
}

// ===============================
// 21. BUILD ZONE FIELD
// ===============================
function buildZoneField(tournament) {
  const location = String(tournament.location || "la tua città");
  
  const wrapper = document.createElement("label");
  
  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.innerHTML = 'Zona preferita <span class="required-asterisk">*</span>';
  wrapper.appendChild(titleSpan);

  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Indica la zona di ${location} e dintorni dove preferisci giocare le partite in casa`;
  wrapper.appendChild(helperSpan);

  const input = document.createElement("input");
  input.type = "text";
  input.name = "preferred_zone";
  input.required = true;
  input.placeholder = "Es. Zona Lingotto, Moncalieri, ecc.";
  wrapper.appendChild(input);

  return wrapper;
}

// ===============================
// 22. BUILD DAYS FIELD
// ===============================
function buildDaysField(availableDays) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field-wrapper";
  
  const daysOptions = parseDaysRange(availableDays);
  const minDays = calculateMinDays(availableDays);
  
  const labelText = (minDays === 1) 
    ? "Giorno preferito" 
    : `Giorni preferiti (seleziona almeno ${minDays})`;

  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.innerHTML = `${labelText} <span class="required-asterisk">*</span>`;
  wrapper.appendChild(titleSpan);

  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Seleziona ${minDays === 1 ? 'il giorno' : 'i giorni'} in cui preferisci giocare le partite in casa`;
  wrapper.appendChild(helperSpan);

  const checkboxGroup = document.createElement("div");
  checkboxGroup.className = "checkbox-group";
  checkboxGroup.dataset.minDays = minDays;

  daysOptions.forEach(day => {
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
// 23. BUILD HOURS FIELD
// ===============================
function buildHoursField(availableHours) {
  const slots = parseHoursSlots(availableHours);
  
  // Se c'è solo uno slot o nessuno, non mostrare il campo
  if (slots.length <= 1) return null;

  const wrapper = document.createElement("label");

  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.innerHTML = 'Fascia oraria preferita <span class="required-asterisk">*</span>';
  wrapper.appendChild(titleSpan);

  // Helper dinamico basato sul range
  const { start, end } = parseHoursRange(availableHours);
  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Scegli la fascia oraria preferita (partite disponibili dalle ${start}:00 alle ${end}:00)`;
  wrapper.appendChild(helperSpan);

  const select = document.createElement("select");
  select.name = "preferred_hours";
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seleziona una fascia oraria";
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
// 24. PARSE DAYS RANGE
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

  switch (rangeLower) {
    case "lun-ven":
      return allDays.slice(0, 5); // Lunedì - Venerdì
    case "sab-dom":
      return allDays.slice(5, 7); // Sabato - Domenica
    case "ven-dom":
      return allDays.slice(4, 7); // Venerdì - Domenica
    case "lun-dom":
      return allDays; // Tutti i giorni
    default:
      return allDays;
  }
}

// ===============================
// 24b. CALCULATE MIN DAYS
// ===============================
function calculateMinDays(availableDays) {
  const rangeLower = availableDays.toLowerCase();
  
  switch (rangeLower) {
    case "sab-dom":
      return 1; // Weekend: basta 1 giorno
    case "ven-dom":
      return 1; // Ven-Dom: basta 1 giorno
    case "lun-ven":
      return 2; // Settimana: almeno 2 giorni
    case "lun-dom":
      return 2; // Tutti: almeno 2 giorni
    default:
      return 1;
  }
}

// ===============================
// 25. PARSE HOURS RANGE
// ===============================
function parseHoursRange(range) {
  const rangeLower = range.toLowerCase().trim();
  const parts = rangeLower.split("-");
  
  if (parts.length !== 2) {
    return { start: 10, end: 22 }; // Default
  }
  
  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);
  
  if (isNaN(start) || isNaN(end)) {
    return { start: 10, end: 22 }; // Default
  }
  
  return { start, end };
}

// ===============================
// 26. PARSE HOURS SLOTS (DINAMICO)
// ✅ MODIFICATO: Gestisce correttamente range piccoli
// ===============================
function parseHoursSlots(range) {
  const { start, end } = parseHoursRange(range);
  
  const totalHours = end - start;
  
  // Se il range è troppo piccolo (meno di 2 ore), nessuno slot
  if (totalHours < 2) {
    return [];
  }
  
  const slots = [];
  
  // =====================================================
  // CASO 1: Range piccolo (2-4 ore) → Slot unico
  // =====================================================
  
  if (totalHours <= 4) {
    const slotNames = {
      6: "Prima mattina",
      7: "Prima mattina",
      8: "Mattina",
      9: "Mattina",
      10: "Mattina",
      11: "Tarda mattina",
      12: "Mezzogiorno",
      13: "Primo pomeriggio",
      14: "Primo pomeriggio",
      15: "Pomeriggio",
      16: "Tardo pomeriggio",
      17: "Tardo pomeriggio",
      18: "Pre-serata",
      19: "Sera",
      20: "Sera",
      21: "Sera",
      22: "Tarda serata"
    };
    
    const slotName = slotNames[start] || "Fascia";
    
    slots.push({
      value: `${start}-${end}`,
      label: `${slotName} (${String(start).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00)`
    });
    
    return slots;
  }
  
  // =====================================================
  // CASO 2: Range medio/grande (5+ ore) → Slot multipli da 3 ore
  // =====================================================
  
  const slotDuration = 3; // Ogni slot dura 3 ore
  
  const slotNames = {
    6: "Prima mattina",
    7: "Prima mattina",
    8: "Mattina",
    9: "Mattina",
    10: "Mattina",
    11: "Tarda mattina",
    12: "Mezzogiorno",
    13: "Primo pomeriggio",
    14: "Primo pomeriggio",
    15: "Pomeriggio",
    16: "Tardo pomeriggio",
    17: "Tardo pomeriggio",
    18: "Pre-serata",
    19: "Sera",
    20: "Sera",
    21: "Sera",
    22: "Tarda serata"
  };
  
  // Genera slot da 3 ore ciascuno
  let currentStart = start;
  
  while (currentStart + slotDuration <= end) {
    const slotEnd = currentStart + slotDuration;
    const slotName = slotNames[currentStart] || "Fascia";
    
    slots.push({
      value: `${currentStart}-${slotEnd}`,
      label: `${slotName} (${String(currentStart).padStart(2, '0')}:00 - ${String(slotEnd).padStart(2, '0')}:00)`
    });
    
    currentStart = slotEnd;
  }
  
  // Se rimane un gap finale (es. da 21 a 22), aggiungilo come slot ridotto
  // solo se è almeno 2 ore
  if (currentStart < end && (end - currentStart) >= 2) {
    const slotName = slotNames[currentStart] || "Fascia";
    slots.push({
      value: `${currentStart}-${end}`,
      label: `${slotName} (${String(currentStart).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00)`
    });
  }
  
  return slots;
}


// ===============================
// 27. SUBMIT ISCRIZIONE (FIREBASE)
// ===============================
let isSubmitting = false;

function handleFormSubmit(tournament) {
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    
    // Evita submit multipli
    if (isSubmitting) return;

    // =====================================================
    // VALIDAZIONI
    // =====================================================

    // Validazione checkbox regolamento
    const acceptRegulation = form.querySelector('input[name="accept_regulation"]');
    if (!acceptRegulation || !acceptRegulation.checked) {
      showToast("Devi accettare il regolamento per iscriverti ⚠️");
      return;
    }

    // Validazione giorni (se presenti)
    const checkboxGroup = form.querySelector(".checkbox-group");
    if (checkboxGroup) {
      const minDays = Number(checkboxGroup.dataset.minDays) || 1;
      const checkedDays = form.querySelectorAll('input[name="preferred_days[]"]:checked');
      
      if (checkedDays.length < minDays) {
        const dayWord = minDays === 1 ? 'giorno' : 'giorni';
        showToast(`Devi selezionare almeno ${minDays} ${dayWord} ⚠️`);
        return;
      }
    }

    // Validazione orari (se presenti e required)
    const hoursSelect = form.querySelector('[name="preferred_hours"]');
    if (hoursSelect && hoursSelect.required && !hoursSelect.value) {
      showToast("Devi selezionare una fascia oraria ⚠️");
      return;
    }

    // =====================================================
    // COSTRUZIONE PAYLOAD
    // =====================================================

    const payload = {
      tournament_id: tournament.tournament_id,
      team_name: form.querySelector('[name="team_name"]').value.trim(),
      email: form.querySelector('[name="email"]').value.trim().toLowerCase(),
      phone: form.querySelector('[name="phone"]').value.trim()
    };

    // Campo zona (se presente)
    const zoneInput = form.querySelector('[name="preferred_zone"]');
    if (zoneInput && zoneInput.value.trim()) {
      payload.preferred_zone = zoneInput.value.trim();
    }

    // Campo giorni (se presente)
    const daysChecked = form.querySelectorAll('[name="preferred_days[]"]:checked');
    if (daysChecked.length > 0) {
      payload.preferred_days = Array.from(daysChecked).map(cb => cb.value).join(", ");
    }

    // Campo orari (se presente)
    if (hoursSelect && hoursSelect.value) {
      payload.preferred_hours = hoursSelect.value;
    }

    // Campo note aggiuntive (se presente)
    const notesTextarea = form.querySelector('[name="additional_notes"]');
    if (notesTextarea && notesTextarea.value.trim()) {
      payload.additional_notes = notesTextarea.value.trim();
    }

    // =====================================================
    // STATO LOADING
    // =====================================================

    isSubmitting = true;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll("input, select, textarea, button");

    submitBtn.innerHTML = `
      <span class="spinner"></span>
      Iscrizione in corso...
    `;
    submitBtn.classList.add("disabled");
    submitBtn.disabled = true;
    inputs.forEach(input => input.disabled = true);

    // =====================================================
    // INVIO RICHIESTA
    // =====================================================

    fetch(API_URLS.submitSubscription, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.text())
      .then(response => {
        
        // Mapping risposte errore
        const errorMessages = {
          "TOURNAMENT_NOT_FOUND": "Torneo non valido ❌",
          "REGISTRATIONS_CLOSED": "Le iscrizioni sono chiuse ⚠️",
          "INVALID_DATA": "Dati mancanti o non validi ⚠️",
          "DUPLICATE_TEAM": isIndividual ? "Un giocatore con questo nome è già iscritto ⚠️" : "Una squadra con questo nome è già iscritta ⚠️",
          "DUPLICATE_EMAIL": "Questa email è già stata utilizzata ⚠️",
          "DUPLICATE": "Questa email è già iscritta ⚠️"
        };

        // Gestione errori
        if (errorMessages[response]) {
          showToast(errorMessages[response]);
          restoreForm();
          return;
        }

        // Successo
        if (response === "SUBSCRIPTION_SAVED") {
          showToast("Iscrizione completata 🎉");
          setTimeout(() => window.location.reload(), 1200);
          return;
        }

        // Errore inatteso
        console.error("Risposta inattesa:", response);
        showToast("Errore inatteso ❌");
        restoreForm();
      })
      .catch(err => {
        console.error("Errore submit:", err);
        showToast("Errore di connessione ❌");
        restoreForm();
      });

    // =====================================================
    // RIPRISTINO FORM
    // =====================================================

    function restoreForm() {
      isSubmitting = false;
      submitBtn.innerHTML = "Invia iscrizione";
      submitBtn.classList.remove("disabled");
      submitBtn.disabled = false;
      inputs.forEach(input => input.disabled = false);
    }

  });
}



// ===============================
// FORM STEP SYSTEM
// ===============================

let currentStep = 1;

const panels = document.querySelectorAll(".form-step-panel");
const steps = document.querySelectorAll(".form-step");
const progressFill = document.querySelector(".form-progress-fill");

const nextBtn = document.querySelector(".step-next");
const prevBtn = document.querySelector(".step-prev");

function updateStepUI() {

  panels.forEach(panel => {
    panel.classList.remove("active");
  });

  document
    .querySelector(`.form-step-panel[data-step="${currentStep}"]`)
    .classList.add("active");

  steps.forEach(step => {
    step.classList.remove("active");
  });

  document
    .querySelector(`.form-step[data-step="${currentStep}"]`)
    .classList.add("active");

  progressFill.style.width = ((currentStep - 1) / 2) * 100 + "%";

  if (currentStep === 1) {
    prevBtn.style.visibility = "hidden";
  } else {
    prevBtn.style.visibility = "visible";
  }

  if (currentStep === 3) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = "inline-flex";
  }

  window.scrollTo({
    top: document.querySelector("#registration-form").offsetTop - 200,
    behavior: "smooth"
  });

}


// ===============================
// NEXT STEP
// ===============================

nextBtn.addEventListener("click", () => {

  const currentPanel =
    document.querySelector(`.form-step-panel[data-step="${currentStep}"]`);

  const requiredFields =
    currentPanel.querySelectorAll("[required]");

  let valid = true;

  requiredFields.forEach(field => {

    if (field.type === "checkbox") {

      if (!field.checked) {
        valid = false;
      }

    } else {

      if (!field.value.trim()) {
        valid = false;
      }

    }

  });

  if (!valid) {
    showToast("Compila tutti i campi obbligatori ⚠️");
    return;
  }

  if (currentStep < 3) {
    currentStep++;
    updateStepUI();
  }

});


// ===============================
// PREVIOUS STEP
// ===============================

prevBtn.addEventListener("click", () => {

  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }

});


// ===============================
// INIT
// ===============================

updateStepUI();





// ===============================
// TOURNAMENT CAPACITY BAR
// ===============================
function updateTournamentCapacity(current, max) {

  const fill = document.getElementById("capacity-fill");
  const currentText = document.getElementById("capacity-current");
  const maxText = document.getElementById("capacity-max");
  const capacityBlock = document.querySelector(".tournament-capacity");

  if (!fill || !currentText || !maxText || !capacityBlock) return;

  const currentTeams = Number(current) || 0;
  const maxTeams = Number(max) || 0;

  if (maxTeams === 0) return;

  const percentage = Math.min((currentTeams / maxTeams) * 100, 100);

  fill.style.width = percentage + "%";

  currentText.textContent = currentTeams;
  maxText.textContent = maxTeams;

  const remaining = maxTeams - currentTeams;

  // ===============================
  // MESSAGGIO DINAMICO SCARSITÀ
  // ===============================

  let warning = capacityBlock.querySelector(".capacity-warning");

  if (!warning) {
    warning = document.createElement("div");
    warning.className = "capacity-warning";
    capacityBlock.appendChild(warning);
  }

  // ===============================
  // STILI DINAMICI
  // ===============================

  if (remaining <= 0) {

    fill.style.background = "linear-gradient(90deg,#ff3b3b,#c40000)";
    warning.textContent = "🚫 Torneo completo";

  }

  else if (remaining <= 3) {

    fill.style.background = "linear-gradient(90deg,#ff6b6b,#ff3b3b)";
    warning.textContent = `⚠️ Restano solo ${remaining} posti`;

  }

  else if (remaining <= 6) {

    warning.textContent = `🔥 Restano ${remaining} posti`;

  }

  else {

    warning.textContent = "";

  }

}










// ===============================
// 28. STATO TORNEO (UI)
// ===============================
function applyTournamentState(tournament) {
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const entityLabel = isIndividual ? 'giocatore' : 'squadra';
  const entityLabelPlural = isIndividual ? 'giocatori' : 'squadre';

  const registrationBlock = document.querySelector(".tournament-registration-block");
  const capacityBlock = document.querySelector(".tournament-capacity-block");
  const teamsBlock = document.getElementById("tournament-teams-section");

  form.style.display = "none";
  form.classList.remove("skeleton");
  badge.className = "badge";

  if (tournament.status === "open") {
    badge.textContent = "ISCRIZIONI APERTE";
    badge.classList.add("open");
    subscribeMessage.textContent = `Le iscrizioni sono aperte. Compila il form per iscrivere il tuo ${entityLabel}.`;
    form.style.display = "flex";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "block";
    teamsBlock.style.display = "block";
    return;
  }

  if (tournament.status === "wip") {
    badge.textContent = "IN DEFINIZIONE";
    badge.classList.add("wip");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">⏳</span>
      <strong>Iscrizioni chiuse</strong><br>
      Il torneo è in fase di definizione. I gironi saranno comunicati a breve.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "none";
    teamsBlock.style.display = "block";
    return;
  }

  if (tournament.status === "full") {
    badge.textContent = "COMPLETO";
    badge.classList.add("full");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">🚫</span>
      <strong>Torneo al completo</strong><br>
      Il numero massimo di ${entityLabelPlural} è stato raggiunto.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "block";
    teamsBlock.style.display = "block";
    return;
  }

  if (tournament.status === "final_phase") {
    badge.textContent = "FASE FINALE";
    badge.classList.add("final_phase");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">🏆</span>
      <strong>Fase finale in corso</strong><br>
      Il torneo è entrato nella fase finale.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "none";
    teamsBlock.style.display = "none";
    return;
  }

  if (tournament.status === "live") {
    badge.textContent = "IN CORSO";
    badge.classList.add("live");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">⚽</span>
      <strong>Torneo in corso</strong><br>
      Le partite sono già iniziate.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "none";
    teamsBlock.style.display = "none";
    return;
  }

  if (tournament.status === "finished") {
    badge.textContent = "CONCLUSO";
    badge.classList.add("finished");
    subscribeMessage.innerHTML = `
      <span class="registration-closed-icon">🏁</span>
      <strong>Torneo concluso</strong><br>
      Il torneo è terminato. Consulta la classifica finale.
    `;
    form.style.display = "none";
    registrationBlock.style.display = "block";
    capacityBlock.style.display = "none";
    teamsBlock.style.display = "none";
    return;
  }
}






























// ===============================
// 29. LOAD + RENDER TEAMS LIST
// ===============================
function loadAndRenderTeamsList(tournament) {
  if (!teamsListSection || !teamsListContainer || !teamsListCount) return;

  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  teamsListSection.classList.remove("hidden");
  teamsListContainer.innerHTML = "";
  teamsListCount.textContent = `${tournament.teams_current} / ${tournament.teams_max}`;

  renderTeamsSkeleton(8);

  const url = `${API_URLS.getTeamsWithLogos}?tournament_id=${encodeURIComponent(tournament.tournament_id)}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(teams => {
      if (!Array.isArray(teams)) throw new Error("Formato teams non valido");
      teamsListContainer.innerHTML = "";
      if (teams.length === 0) {
        renderTeamsEmptyState(isIndividual);
        return;
      }
      renderTeamsChips(teams, isIndividual);
    })
    .catch(err => {
      console.error("Errore caricamento teams:", err);
      teamsListContainer.innerHTML = "";
      renderTeamsErrorState(isIndividual);
    });
}



// ===============================
// RENDER TEAMS CHIPS
// ✅ MODIFICATO: Mostra logo squadra invece del numero
// ===============================
function renderTeamsChips(teams, isIndividual = false) {
  const frag = document.createDocumentFragment();
  const fallbackIcon = isIndividual ? '👤' : '👥';

  teams.forEach((t) => {
    const chip = document.createElement("div");
    chip.className = "team-chip";

    const logoHTML = t.team_logo
      ? `<img src="${escapeHTML(t.team_logo)}" alt="${escapeHTML(t.team_name)}" class="team-chip-logo">`
      : `<span class="team-chip-logo-fallback">${fallbackIcon}</span>`;

    chip.innerHTML = `
      ${logoHTML}
      <span class="team-chip-name">${escapeHTML(t.team_name || "")}</span>
    `;

    frag.appendChild(chip);
  });

  teamsListContainer.appendChild(frag);
}




// ===============================
// 30. TEAMS LIST STATES
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

function renderTeamsEmptyState(isIndividual = false) {
  const el = document.createElement("div");
  el.className = "teams-empty";
  el.textContent = isIndividual
    ? "Nessun giocatore iscritto al momento."
    : "Nessuna squadra iscritta al momento.";
  teamsListContainer.appendChild(el);
}

function renderTeamsErrorState(isIndividual = false) {
  const el = document.createElement("div");
  el.className = "teams-error";
  el.textContent = isIndividual
    ? "Errore nel caricamento dei giocatori ❌"
    : "Errore nel caricamento delle squadre ❌";
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
// 31. TOAST NOTIFICATION
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


