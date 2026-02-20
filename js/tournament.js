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
// 7. RENDER TORNEO SPECIFICO
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
  const row8 = `${tournament.teams_current || 0} squadre iscritte`;

  container.innerHTML = `
    <div class="info-row"><span class="info-row-icon">🏐</span><span>${escapeHTML(row1)}</span></div>
    <div class="info-row"><span class="info-row-icon">👥</span><span>${row2}</span></div>
    <div class="info-row"><span class="info-row-icon">💰</span><span>${row3}</span></div>
    <div class="info-row"><span class="info-row-icon">🏆</span><span>${row4}</span></div>
    <div class="info-row"><span class="info-row-icon">📋</span><span>${row5}</span></div>
    <div class="info-row"><span class="info-row-icon">📅</span><span>${row6}</span></div>
    <div class="info-row"><span class="info-row-icon">⏰</span><span>${row7}</span></div>
    <div class="info-row"><span class="info-row-icon">✅</span><span>${row8}</span></div>
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
// 7e. BUILD AWARD INFO TEXT
// ===============================
function buildAwardInfoText(t) {
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
  const fixed = String(t.fixed_court_days_hours || "").toLowerCase();
  const days = String(t.available_days || "").toLowerCase();
  const hours = String(t.available_hours || "").toLowerCase();

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
// 9. RENDER SPECIFIC COURT RULE
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
// 10. BUILD COURT RULE (REGOLA 2 - AGGIORNATA CON TIME_RANGE)
// ===============================
function buildCourtRule(tournament, ruleNumber) {
  const fixedCourt = tournament.fixed_court === true || String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim().toLowerCase();
  const hours = String(tournament.available_hours || "").trim().toLowerCase();
  const timeRange = String(tournament.time_range || "").trim().toLowerCase();
  const location = String(tournament.location || "");
  const date = String(tournament.date || "");

  let ruleText = "";

  // Frase introduttiva basata su time_range
  let timeRangeIntro = "";
  if (timeRange === "short") {
    timeRangeIntro = `<p>Tutte le partite di questo torneo si svolgeranno in un <strong>singolo giorno</strong>, a <strong>${date}</strong>, a <strong>${location}</strong>.</p>`;
  } else if (timeRange === "long") {
    timeRangeIntro = `<p>Questo torneo si svolge <strong>su più settimane</strong>. Generalmente, ogni squadra giocherà una partita a settimana fino al termine del torneo.</p>`;
  }

  if (fixedCourt) {
    ruleText = `
      ${timeRangeIntro}
      <p>
        Campo, giorno e orari definitivi delle partite saranno comunicati dall’organizzazione prima dell’inizio del torneo.
      </p>
    `;
  } else {
    const availabilityPhrase = buildAvailabilityPhrase(days, hours);

    ruleText = `
      ${timeRangeIntro}
      <p>
        ${availabilityPhrase}<br>In fase di iscrizione, le squadre potranno esprimere le proprie preferenze
        relative a zona, giorni e orari di gioco.
      </p>
      <p>
        L'organizzazione provvederà alla prenotazione dei campi per le partite casalinghe di ciascuna squadra, 
        tenendo conto delle preferenze indicate.
      </p>
    `;
  }

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Campi, giorni e orari</strong></p>
        ${ruleText}
      </div>
    </div>
  `;
}



// ===============================
// 11. BUILD AVAILABILITY PHRASE
// ===============================
function buildAvailabilityPhrase(days, hours) {
  const daysPhrase = mapDaysToPhrase(days);
  const hoursPhrase = mapHoursToPhrase(hours);

  if (!daysPhrase && !hoursPhrase) {
    return "";
  }

  if (daysPhrase && !hoursPhrase) {
    return `Le partite potranno essere disputate <strong>${daysPhrase}</strong>. `;
  }

  if (!daysPhrase && hoursPhrase) {
    return `Le partite potranno essere disputate <strong>${hoursPhrase}</strong>. `;
  }

  return `Le partite potranno essere disputate <strong>${daysPhrase}</strong>, <strong>${hoursPhrase}</strong>. `;
}

// ===============================
// 12. MAP DAYS TO PHRASE
// ===============================
function mapDaysToPhrase(days) {
  if (!days || days === "na") {
    return null;
  }

  const mapping = {
    "lun-dom": "in qualsiasi giorno della settimana",
    "lun-ven": "dal lunedì al venerdì",
    "sab-dom": "il sabato e la domenica"
  };

  return mapping[days] || null;
}

// ===============================
// 13. MAP HOURS TO PHRASE
// ===============================
function mapHoursToPhrase(hours) {
  if (!hours || hours === "na") {
    return null;
  }

  const mapping = {
    "10-22": "nella fascia oraria compresa tra le 10:00 e le 22:00",
    "10-19": "nella fascia oraria compresa tra le 10:00 e le 19:00",
    "19-22": "nella fascia serale, tra le 19:00 e le 22:00"
  };

  return mapping[hours] || null;
}

// ===============================
// 14. BUILD FORMAT RULE (REGOLA 3 - AGGIORNATA CON ruleNumber)
// ===============================
function buildFormatRule(tournament, ruleNumber) {
  const teamsPerGroup = Number(tournament.teams_per_group) || 0;
  const teamsInFinal = Number(tournament.teams_in_final) || 0;
  const teamsMax = Number(tournament.teams_max) || 0;

  let formatText = "";

  if (teamsPerGroup > 0 && teamsInFinal > 0) {
    const numGroups = Math.ceil(teamsMax / teamsPerGroup);
    const qualificationPhrase = buildQualificationPhrase(numGroups, teamsInFinal);
    
    formatText = `
      <p>
        Il torneo prevede una <strong>fase a gironi</strong> seguita da una <strong>fase finale</strong>, a cui accederanno <strong>${teamsInFinal} squadre</strong>.
      </p>
      <p>
        Le <strong>${teamsMax} squadre</strong> iscritte saranno suddivise in <strong>${numGroups} ${numGroups === 1 ? 'girone' : 'gironi'}</strong> 
        da <strong>${teamsPerGroup} squadre</strong> ciascuno.
      </p>
      <p>
        ${qualificationPhrase}
      </p>
    `;
  } else if (teamsPerGroup === 0 && teamsInFinal > 0) {
    formatText = `
      <p>
        Il torneo si svolgerà con <strong>fase finale diretta</strong> tra le <strong>${teamsMax} squadre</strong> iscritte.
      </p>
    `;
  } else if (teamsPerGroup > 0 && teamsInFinal === 0) {
    const numGroups = Math.ceil(teamsMax / teamsPerGroup);
    
    formatText = `
      <p>
        Il torneo prevede una <strong>fase a gironi</strong>.
      </p>
      <p>
        Le <strong>${teamsMax} squadre</strong> iscritte saranno suddivise in <strong>${numGroups} ${numGroups === 1 ? 'girone' : 'gironi'}</strong> 
        da <strong>${teamsPerGroup} squadre</strong> ciascuno.
      </p>
    `;
  } else {
    formatText = `
      <p>
        Il torneo prevede <strong>${teamsMax} squadre</strong> partecipanti.
      </p>
      <p>
        Il formato dettagliato sarà comunicato prima dell'inizio del torneo.
      </p>
    `;
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
// 15. BUILD QUALIFICATION PHRASE
// ===============================
function buildQualificationPhrase(numGroups, teamsInFinal) {
  const firstPlaceQualifiers = numGroups;
  const secondPlaceQualifiers = teamsInFinal - firstPlaceQualifiers;

  if (secondPlaceQualifiers <= 0) {
    if (numGroups === 1) {
      return `Solo la <strong>prima classificata</strong> del girone accederà alla fase finale.`;
    }
    return `Solo le <strong>prime classificate</strong> di ciascun girone accederanno alla fase finale.`;
  }

  if (secondPlaceQualifiers === numGroups) {
    if (numGroups === 1) {
      return `La <strong>prima</strong> e la <strong>seconda classificata</strong> del girone accederanno alla fase finale.`;
    }
    return `Le <strong>prime</strong> e le <strong>seconde classificate</strong> di ciascun girone accederanno alla fase finale.`;
  }

  if (numGroups === 1) {
    return `La <strong>prima classificata</strong> del girone e la <strong>migliore seconda</strong> accederanno alla fase finale.`;
  }
  
  const secondeText = secondPlaceQualifiers === 1 
    ? `la <strong>migliore seconda classificata</strong>` 
    : `le <strong>${secondPlaceQualifiers} migliori seconde classificate</strong>`;

  return `Le <strong>prime classificate</strong> di ciascun girone e ${secondeText} accederanno alla fase finale.`;
}

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


