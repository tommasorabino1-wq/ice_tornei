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
    return "Solo premi simbolici (coppe, medaglie)";
  }

  const perc = t.award_amount_perc;
  const price = Number(t.price) || 0;
  const teamsMax = Number(t.teams_max) || 0;
  
  if (perc && perc !== "NA" && !isNaN(Number(perc)) && price > 0 && teamsMax > 0) {
    const percValue = Number(perc) / 100;
    const totalPrize = Math.round(teamsMax * price * percValue);
    return `€${totalPrize} (con ${teamsMax} squadre iscritte)`;
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
  
  // REGOLA 3: Premi e riconoscimenti (award, mvp_award, upsell)
  rules.push(buildAwardsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 4: Formato e durata (format_type, time_range)
  rules.push(buildFormatTimeRangeRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 5: Campi, giorni e orari (fixed_court_days_hours, available_days, available_hours)
  rules.push(buildCourtDaysHoursRule(tournament, ruleNumber));
  ruleNumber++;
  
  // TODO: Aggiungere altre regole qui
  
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
  
  // === COURT PRICE ===
  let courtText = "";
  
  switch (courtPrice) {
    case "compreso_gironi_finals":
      courtText = `
        <p>
          La quota include la <strong>prenotazione dei campi</strong> per tutte le partite del torneo 
          (sia fase a gironi che fasi finali). Le squadre non dovranno sostenere alcun costo aggiuntivo 
          per l'utilizzo delle strutture sportive.
        </p>
      `;
      break;
      
    case "compreso_gironi":
      courtText = `
        <p>
          La quota include la <strong>prenotazione dei campi per le partite della fase a gironi</strong>. 
          Per le eventuali partite delle fasi finali, le squadre partecipanti dovranno 
          <strong>dividere equamente</strong> il costo del campo.
        </p>
      `;
      break;
      
    case "compreso_finals":
      courtText = `
        <p>
          La quota include la <strong>prenotazione dei campi per le partite delle fasi finali</strong>. 
          Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> 
          il costo del campo presso la struttura sportiva prenotata.
        </p>
      `;
      break;
      
    case "non_compreso":
    default:
      courtText = `
        <p>
          La quota <strong>non include</strong> il costo dei campi. Per ogni partita, le squadre dovranno 
          <strong>dividere equamente</strong> il costo del campo presso la struttura sportiva prenotata.
        </p>
      `;
      break;
  }
  
  // === REFEREE PRICE ===
  let refereeText = "";
  
  // Se NA, non c'è arbitro, quindi non menzioniamo nulla (gestito altrove)
  if (refereePrice !== "na") {
    switch (refereePrice) {
      case "compreso_gironi_finals":
        refereeText = `
          <p>
            La quota include il <strong>costo dell'arbitro</strong> per tutte le partite del torneo 
            (sia fase a gironi che fasi finali).
          </p>
        `;
        break;
        
      case "compreso_gironi":
        refereeText = `
          <p>
            La quota include il <strong>costo dell'arbitro per le partite della fase a gironi</strong>. 
            Per le eventuali partite delle fasi finali, le squadre partecipanti dovranno 
            <strong>dividere equamente</strong> il compenso arbitrale.
          </p>
        `;
        break;
        
      case "compreso_finals":
        refereeText = `
          <p>
            La quota include il <strong>costo dell'arbitro per le partite delle fasi finali</strong>. 
            Per le partite della fase a gironi, le squadre dovranno <strong>dividere equamente</strong> 
            il compenso arbitrale.
          </p>
        `;
        break;
        
      case "non_compreso":
      default:
        refereeText = `
          <p>
            La quota <strong>non include</strong> il compenso arbitrale. Per ogni partita, le squadre dovranno 
            <strong>dividere equamente</strong> il costo dell'arbitro.
          </p>
        `;
        break;
    }
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Quota di iscrizione</strong></p>
        ${introText}
        ${courtText}
        ${refereeText}
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
  const teamSizeMin = Number(tournament.team_size_min) || 0;
  const teamSizeMax = Number(tournament.team_size_max) || 0;
  
  // === GENDER TEXT ===
  let genderText = "";
  switch (gender) {
    case "only_male":
      genderText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da soli uomini</strong>.
        </p>
      `;
      break;
    case "only_female":
      genderText = `
        <p>
          Possono partecipare esclusivamente <strong>squadre composte da sole donne</strong>.
        </p>
      `;
      break;
    case "mixed_strict":
      genderText = `
        <p>
          Ogni squadra deve essere <strong>obbligatoriamente mista</strong>, composta da 
          <strong>almeno un uomo e almeno una donna</strong>.
        </p>
      `;
      break;
    case "mixed_female_allowed":
      genderText = `
        <p>
          Ogni squadra deve essere <strong>mista</strong> (almeno un uomo e una donna) 
          oppure composta da <strong>sole donne</strong>. Non sono ammesse squadre composte da soli uomini.
        </p>
      `;
      break;
    case "open":
    default:
      genderText = `
        <p>
          Possono partecipare squadre di <strong>qualsiasi composizione</strong>: 
          maschili, femminili o miste.
        </p>
      `;
      break;
  }
  
  // === AGE TEXT ===
  let ageText = "";
  switch (age) {
    case "under_18":
      ageText = `
        <p>
          Il torneo è riservato a giocatori <strong>Under 18</strong>. 
          Tutti i componenti della squadra devono avere meno di 18 anni alla data di inizio del torneo.
        </p>
      `;
      break;
    case "over_35":
      ageText = `
        <p>
          Il torneo è riservato a giocatori <strong>Over 35</strong>. 
          Tutti i componenti della squadra devono avere almeno 35 anni alla data di inizio del torneo.
        </p>
      `;
      break;
    case "open":
      ageText = `
        <p>
          Il torneo è aperto a giocatori di <strong>qualsiasi età</strong>.
        </p>
      `;
      break;
  }
  
  // === EXPERTISE TEXT ===
  let expertiseText = "";
  switch (expertise) {
    case "expert":
      expertiseText = `
        <p>
          Questo torneo è rivolto a <strong>giocatori esperti</strong> con un livello di gioco medio-alto. 
          Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico.
        </p>
      `;
      break;
    case "open":
    default:
      expertiseText = `
        <p>
          Questo torneo è <strong>aperto a tutti</strong>, indipendentemente dal livello di esperienza. 
          È pensato per chi vuole divertirsi e mettersi in gioco in un contesto amatoriale.
        </p>
      `;
      break;
  }
  
  // === TEAM SIZE TEXT ===
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
        ${genderText}
        ${ageText}
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
  const expertise = String(tournament.expertise || "open").toLowerCase();
  const hasAward = tournament.award === true || String(tournament.award).toUpperCase() === "TRUE";
  const awardPerc = String(tournament.award_amount_perc || "NA");
  const mvpAward = String(tournament.mvp_award || "none").toLowerCase();
  const upsell = String(tournament.upsell || "none").toLowerCase();
  
  // === MAIN AWARD TEXT ===
  let mainAwardText = "";
  
  if (hasAward && expertise === "expert") {
    if (awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc))) {
      mainAwardText = `
        <p>
          Essendo un torneo pensato per <strong>giocatori esperti</strong>, è previsto un 
          <strong>montepremi</strong> corrispondente al <strong>${awardPerc}% delle quote totali</strong> 
          raccolte dalle iscrizioni. Il montepremi sarà suddiviso tra le prime 3 squadre classificate.
        </p>
      `;
    } else {
      mainAwardText = `
        <p>
          Essendo un torneo pensato per <strong>giocatori esperti</strong>, è previsto un 
          <strong>montepremi</strong> per le squadre vincitrici. 
          L'importo e la suddivisione saranno comunicati prima dell'inizio del torneo.
        </p>
      `;
    }
  } else {
    mainAwardText = `
      <p>
        Essendo un torneo pensato per <strong>giocatori amatoriali</strong>, sono previsti 
        esclusivamente <strong>premi simbolici</strong> per le squadre vincitrici: 
        coppe, medaglie, gadget e altri riconoscimenti.
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
// 9e. BUILD FORMAT & TIME RANGE RULE (REGOLA 4)
// ===============================
function buildFormatTimeRangeRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  const timeRange = String(tournament.time_range || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
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
  
  // === TIME RANGE TEXT (COMBINATO CON FORMAT) ===
  let timeRangeText = "";
  
  switch (timeRange) {
    case "short":
      timeRangeText = `
        <p>
          Si tratta di un <strong>torneo giornaliero</strong>: tutte le partite si svolgeranno nell’arco di una singola giornata.
        </p>
      `;
      break;
      
    case "mid":
      if (hasFinals) {
        timeRangeText = `
          <p>
            La prima fase si svolgerà <strong>su più settimane</strong>, con generalmente una partita a settimana per squadra. 
            La fase finale sarà invece concentrata in un <strong>unico giorno conclusivo</strong>.
          </p>
        `;
      } else {
        timeRangeText = `
          <p>
            Le partite si svolgeranno <strong>su più settimane</strong>, con generalmente una partita a settimana per squadra fino al termine del torneo.
          </p>
        `;
      }
      break;
      
    case "long":
      if (hasFinals) {
        timeRangeText = `
          <p>
            L’intero torneo si svilupperà <strong>su più settimane</strong>. 
            Sia la prima fase sia la fase finale saranno distribuite nel tempo, con generalmente una partita a settimana per squadra.
          </p>
        `;
      } else {
        timeRangeText = `
          <p>
            Il torneo si svolgerà <strong>su più settimane</strong>, con generalmente una partita a settimana per squadra fino alla conclusione.
          </p>
        `;
      }
      break;
      
    default:
      timeRangeText = `
        <p>
          La durata e la distribuzione delle partite saranno comunicate prima dell'inizio del torneo.
        </p>
      `;
      break;
  }
  
  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato e durata del torneo</strong></p>
        ${formatText}
        ${timeRangeText}
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
  const date = String(tournament.date || "");
  const formatType = String(tournament.format_type || "").toLowerCase();
  const hasFinals = formatType.includes("finals");
  
  // Determina cosa è fisso e per quale fase
  const courtFixedAll = fixed.includes("court_all") || fixed === "court_days_hours_all" || fixed === "court_days_all" || fixed === "court_hours_all";
  const courtFixedFinals = fixed.includes("court_finals") || fixed === "court_days_hours_finals" || fixed === "court_days_finals" || fixed === "court_hours_finals";
  const courtFixed = courtFixedAll || courtFixedFinals;
  
  const daysFixedAll = fixed.includes("days_all") || fixed === "court_days_hours_all" || fixed === "court_days_all" || fixed === "days_hours_all";
  const daysFixedFinals = fixed.includes("days_finals") || fixed === "court_days_hours_finals" || fixed === "court_days_finals" || fixed === "days_hours_finals";
  const daysFixed = daysFixedAll || daysFixedFinals;
  
  const hoursFixedAll = fixed.includes("hours_all") || fixed === "court_days_hours_all" || fixed === "court_hours_all" || fixed === "days_hours_all";
  const hoursFixedFinals = fixed.includes("hours_finals") || fixed === "court_days_hours_finals" || fixed === "court_hours_finals" || fixed === "days_hours_finals";
  const hoursFixed = hoursFixedAll || hoursFixedFinals;
  
  // Mapping giorni per testo leggibile
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
  
  // Mapping orari per testo leggibile
  const hoursMap = {
    "10-22": "tra le 10:00 e le 22:00",
    "10-19": "tra le 10:00 e le 19:00 (fascia diurna)",
    "19-22": "tra le 19:00 e le 22:00 (fascia serale)"
  };
  
  const daysText = daysMap[days] || days || "";
  const hoursText = hoursMap[hours] || hours || "";
  
  // Intro comune: location e date
  const locationDateText = `
    <p>
      Tutte le partite del torneo si svolgeranno a <strong>${location}</strong>, 
      a partire dal <strong>${date}</strong>.
    </p>
  `;
  
  let ruleContent = locationDateText;
  
  // =====================================================
  // CASO: TUTTO VARIABILE (false)
  // =====================================================
  if (fixed === "false" || fixed === "") {
    ruleContent += `
      <p>
        <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
        dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre in fase di iscrizione.
      </p>
      <p>
        Le partite potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>. 
        In fase di iscrizione sarà possibile indicare la <strong>zona preferita</strong>, 
        i <strong>giorni</strong> e le <strong>fasce orarie</strong> di disponibilità.
      </p>
      <p>
        Le preferenze indicate verranno considerate dall'organizzazione per la prenotazione dei campi 
        delle <strong>partite in casa</strong> di ciascuna squadra.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: TUTTO FISSO PER TUTTO IL TORNEO (court_days_hours_all)
  // =====================================================
  else if (fixed === "court_days_hours_all") {
    ruleContent += `
      <p>
        <strong>Campi, giorni e orari</strong> di tutte le partite del torneo saranno 
        <strong>stabiliti dall'organizzazione</strong> e comunicati prima dell'inizio del torneo.
      </p>
      <p>
        Le partite si svolgeranno <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: TUTTO FISSO SOLO PER LE FINALI (court_days_hours_finals)
  // =====================================================
  else if (fixed === "court_days_hours_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>. 
          In fase di iscrizione sarà possibile indicare la <strong>zona preferita</strong>, 
          i <strong>giorni</strong> e le <strong>fasce orarie</strong> di disponibilità.
        </p>
        <p>
          <strong>Fase finale:</strong> campi, giorni e orari delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong> e comunicati al termine della fase a gironi.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: SOLO CAMPI FISSI PER TUTTO IL TORNEO (court_all)
  // =====================================================
  else if (fixed === "court_all") {
    ruleContent += `
      <p>
        I <strong>campi</strong> dove si svolgeranno tutte le partite del torneo saranno 
        <strong>stabiliti dall'organizzazione</strong> e comunicati prima dell'inizio del torneo.
      </p>
      <p>
        <strong>Giorni e orari</strong> delle partite saranno invece definiti di volta in volta, 
        tenendo conto delle preferenze espresse dalle squadre in fase di iscrizione.
      </p>
      <p>
        Le partite potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>. 
        In fase di iscrizione sarà possibile indicare i <strong>giorni</strong> e le <strong>fasce orarie</strong> preferiti.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: SOLO CAMPI FISSI PER LE FINALI (court_finals)
  // =====================================================
  else if (fixed === "court_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>. 
          In fase di iscrizione sarà possibile indicare la <strong>zona preferita</strong>, 
          i <strong>giorni</strong> e le <strong>fasce orarie</strong> di disponibilità.
        </p>
        <p>
          <strong>Fase finale:</strong> i <strong>campi</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. Giorni e orari saranno comunicati al termine della fase a gironi.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: SOLO GIORNI FISSI PER TUTTO IL TORNEO (days_all)
  // =====================================================
  else if (fixed === "days_all") {
    ruleContent += `
      <p>
        I <strong>giorni</strong> in cui si svolgeranno tutte le partite del torneo saranno 
        <strong>stabiliti dall'organizzazione</strong>: le partite si disputeranno <strong>${daysText}</strong>.
      </p>
      <p>
        <strong>Campi e orari</strong> saranno invece prenotati di volta in volta dall'organizzazione, 
        tenendo conto delle preferenze espresse dalle squadre.
      </p>
      <p>
        In fase di iscrizione sarà possibile indicare la <strong>zona preferita</strong> 
        e le <strong>fasce orarie</strong> di disponibilità (${hoursText}).
      </p>
    `;
  }
  
  // =====================================================
  // CASO: SOLO GIORNI FISSI PER LE FINALI (days_finals)
  // =====================================================
  else if (fixed === "days_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          <strong>Fase finale:</strong> i <strong>giorni</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. Campi e orari saranno comunicati al termine della fase a gironi.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: SOLO ORARI FISSI PER TUTTO IL TORNEO (hours_all)
  // =====================================================
  else if (fixed === "hours_all") {
    ruleContent += `
      <p>
        Tutte le partite del torneo si svolgeranno nella <strong>fascia oraria</strong> stabilita dall'organizzazione: 
        <strong>${hoursText}</strong>.
      </p>
      <p>
        <strong>Campi e giorni</strong> saranno invece prenotati di volta in volta dall'organizzazione, 
        tenendo conto delle preferenze espresse dalle squadre.
      </p>
      <p>
        In fase di iscrizione sarà possibile indicare la <strong>zona preferita</strong> 
        e i <strong>giorni</strong> di disponibilità (${daysText}).
      </p>
    `;
  }
  
  // =====================================================
  // CASO: SOLO ORARI FISSI PER LE FINALI (hours_finals)
  // =====================================================
  else if (fixed === "hours_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          <strong>Fase finale:</strong> gli <strong>orari</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. Campi e giorni saranno comunicati al termine della fase a gironi.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: CAMPI E GIORNI FISSI PER TUTTO IL TORNEO (court_days_all)
  // =====================================================
  else if (fixed === "court_days_all") {
    ruleContent += `
      <p>
        <strong>Campi e giorni</strong> di tutte le partite del torneo saranno <strong>stabiliti dall'organizzazione</strong>. 
        Le partite si svolgeranno <strong>${daysText}</strong>, presso strutture comunicate prima dell'inizio del torneo.
      </p>
      <p>
        Gli <strong>orari</strong> delle singole partite potranno essere concordati tra le squadre, 
        nella fascia oraria disponibile: <strong>${hoursText}</strong>.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: CAMPI E GIORNI FISSI SOLO PER LE FINALI (court_days_finals)
  // =====================================================
  else if (fixed === "court_days_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          <strong>Fase finale:</strong> <strong>campi e giorni</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. Gli orari saranno comunicati al termine della fase a gironi, 
          nella fascia oraria disponibile (${hoursText}).
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: CAMPI E ORARI FISSI PER TUTTO IL TORNEO (court_hours_all)
  // =====================================================
  else if (fixed === "court_hours_all") {
    ruleContent += `
      <p>
        <strong>Campi e orari</strong> di tutte le partite del torneo saranno <strong>stabiliti dall'organizzazione</strong>. 
        Le partite si svolgeranno <strong>${hoursText}</strong>, presso strutture comunicate prima dell'inizio del torneo.
      </p>
      <p>
        I <strong>giorni</strong> delle singole partite potranno essere concordati tra le squadre, 
        nel rispetto della disponibilità: <strong>${daysText}</strong>.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: CAMPI E ORARI FISSI SOLO PER LE FINALI (court_hours_finals)
  // =====================================================
  else if (fixed === "court_hours_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          <strong>Fase finale:</strong> <strong>campi e orari</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. I giorni saranno comunicati al termine della fase a gironi 
          (${daysText}).
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // CASO: GIORNI E ORARI FISSI PER TUTTO IL TORNEO (days_hours_all)
  // =====================================================
  else if (fixed === "days_hours_all") {
    ruleContent += `
      <p>
        <strong>Giorni e orari</strong> di tutte le partite del torneo saranno <strong>stabiliti dall'organizzazione</strong>: 
        le partite si svolgeranno <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
      </p>
      <p>
        I <strong>campi</strong> saranno invece prenotati di volta in volta dall'organizzazione, 
        tenendo conto della zona preferita indicata dalle squadre in fase di iscrizione.
      </p>
      <p>
        Le preferenze sulla zona verranno considerate per la prenotazione dei campi 
        delle <strong>partite in casa</strong> di ciascuna squadra.
      </p>
    `;
  }
  
  // =====================================================
  // CASO: GIORNI E ORARI FISSI SOLO PER LE FINALI (days_hours_finals)
  // =====================================================
  else if (fixed === "days_hours_finals") {
    if (hasFinals) {
      ruleContent += `
        <p>
          <strong>Fase a gironi:</strong> campi, giorni e orari delle partite saranno 
          <strong>prenotati di volta in volta</strong> dall'organizzazione, tenendo conto delle preferenze 
          espresse dalle squadre in fase di iscrizione.
        </p>
        <p>
          Le partite dei gironi potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
        </p>
        <p>
          <strong>Fase finale:</strong> <strong>giorni e orari</strong> delle partite ad eliminazione diretta saranno 
          <strong>stabiliti dall'organizzazione</strong>. I campi saranno prenotati tenendo conto delle preferenze 
          espresse dalle squadre qualificate.
        </p>
      `;
    } else {
      ruleContent += `
        <p>
          <strong>Campi, giorni e orari</strong> delle partite saranno <strong>prenotati di volta in volta</strong> 
          dall'organizzazione, tenendo conto delle preferenze espresse dalle squadre.
        </p>
      `;
    }
  }
  
  // =====================================================
  // FALLBACK
  // =====================================================
  else {
    ruleContent += `
      <p>
        Le modalità di assegnazione di campi, giorni e orari saranno comunicate prima dell'inizio del torneo.
      </p>
      <p>
        Le partite potranno svolgersi <strong>${daysText}</strong>, <strong>${hoursText}</strong>.
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
// OLD SPECIFIC TOURNAMENTS RULES (solo per avere esempi per le nuove).
// ===============================


// ===============================
// 16. BUILD RANKING RULE (REGOLA 4 - AGGIORNATA CON ruleNumber)
// ===============================
function buildRankingRule(tournament, ruleNumber) {
  const teamsPerGroup = Number(tournament.teams_per_group) || 0;
  const teamsInFinal = Number(tournament.teams_in_final) || 0;
  const teamsMax = Number(tournament.teams_max) || 0;

  if (teamsPerGroup === 0) {
    return "";
  }

  const numGroups = Math.ceil(teamsMax / teamsPerGroup);

  const intraGroupText = `
    <p>
      <strong>Classifica all'interno dello stesso girone:</strong> in caso di parità di punti tra due o più squadre 
      dello stesso girone, l'ordine in classifica sarà determinato dai seguenti criteri, in ordine di importanza: 
      scontri diretti, differenza reti, gol fatti.
    </p>
  `;

  const crossGroupText = buildCrossGroupComparisonText(numGroups, teamsInFinal);

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Criteri di classifica</strong></p>
        ${intraGroupText}
        ${crossGroupText}
      </div>
    </div>
  `;
}




// ===============================
// 17. BUILD CROSS GROUP COMPARISON TEXT
// ===============================
function buildCrossGroupComparisonText(numGroups, teamsInFinal) {
  const firstPlaceQualifiers = Math.min(numGroups, teamsInFinal);
  const secondPlaceQualifiers = Math.max(0, teamsInFinal - numGroups);

  const needsBestFirstComparison = teamsInFinal > 0 && teamsInFinal < numGroups;
  const needsBestSecondComparison = secondPlaceQualifiers > 0 && secondPlaceQualifiers < numGroups;

  if (!needsBestFirstComparison && !needsBestSecondComparison) {
    return "";
  }

  let comparisonTarget = "";

  if (needsBestFirstComparison) {
    const bestFirstCount = teamsInFinal;
    comparisonTarget = bestFirstCount === 1 
      ? `la migliore prima classificata` 
      : `le ${bestFirstCount} migliori prime classificate`;
  } else if (needsBestSecondComparison) {
    comparisonTarget = secondPlaceQualifiers === 1 
      ? `la migliore seconda classificata` 
      : `le ${secondPlaceQualifiers} migliori seconde classificate`;
  }

  return `
    <p>
      <strong>Confronto tra squadre di gironi diversi:</strong> per determinare ${comparisonTarget}, 
      in caso di parità di punti verranno considerati esclusivamente, e in questo ordine: 
      differenza reti e gol fatti.
    </p>
  `;
}






// ===============================
// 18. BUILD REFEREE RULE (AGGIORNATA CON ruleNumber)
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


