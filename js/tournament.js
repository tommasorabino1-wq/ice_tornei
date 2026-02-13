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

  // Info
  document.getElementById("info-sport").textContent = tournament.sport;
  document.getElementById("info-location").textContent = tournament.location;
  document.getElementById("info-date").textContent = tournament.date;
  document.getElementById("info-price").textContent = tournament.price;

  // ✅ Court info message
  const courtInfo = buildCourtInfoMessage(tournament);
  document.getElementById("info-court").textContent = courtInfo;

  // ✅ Regola specifica campi
  renderSpecificCourtRule(tournament);

  // Teams counter
  teamsInfo.textContent = `${tournament.teams_current} / ${tournament.teams_max}`;

  // Apply state & form behavior
  applyTournamentState(tournament);

  if (tournament.status === "open") {
    populateExtraFields(tournament);
    handleFormSubmit(tournament);
  }

  // Load + render teams list block
  loadAndRenderTeamsList(tournament);

  // ✅ Mostra regolamento generale full-width
  showGeneralRegulation();
}

// ===============================
// 8. SHOW GENERAL REGULATION (FULL WIDTH)
// ===============================
function showGeneralRegulation() {
  const regulationBlock = document.querySelector(".tournament-general-regulation");
  if (regulationBlock) {
    regulationBlock.classList.remove("hidden");
  }
}

// ===============================
// 9. BUILD COURT INFO MESSAGE
// ===============================
function buildCourtInfoMessage(tournament) {
  const fixedCourt = tournament.fixed_court === true || String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim().toLowerCase();
  const hours = String(tournament.available_hours || "").trim().toLowerCase();

  if (fixedCourt) {
    return "Campi, giorni e orari prefissati";
  }

  const daysLabel = {
    "lun-dom": "tutti i giorni",
    "lun-ven": "lun-ven",
    "sab-dom": "weekend"
  }[days];

  const hoursLabel = {
    "10-22": "10-22",
    "10-19": "10-19",
    "19-22": "19-22"
  }[hours];

  if (daysLabel && hoursLabel) {
    return `Campi a scelta · ${daysLabel} · ${hoursLabel}`;
  }

  if (daysLabel) {
    return `Campi a scelta · ${daysLabel}`;
  }

  if (hoursLabel) {
    return `Campi a scelta · ${hoursLabel}`;
  }

  return "Campi a scelta";
}

// ===============================
// 10. RENDER SPECIFIC COURT RULE
// ===============================
function renderSpecificCourtRule(tournament) {
  const container = document.getElementById("specific-court-rule");
  
  // ✅ COSTRUISCI LE REGOLE SPECIFICHE
  const rules = [];
  
  // REGOLA 1: Campi, giorni, orari
  rules.push(buildCourtRule(tournament));
  
  // REGOLA 2: Formato torneo
  rules.push(buildFormatRule(tournament));
  
  // REGOLA 3: Criteri di classifica (solo se ci sono gironi)
  const rankingRule = buildRankingRule(tournament);
  if (rankingRule) {
    rules.push(rankingRule);
  }
  
  // ✅ REGOLA 4: Arbitraggio
  rules.push(buildRefereeRule(tournament));
  
  // REGOLA 5: Riferimento al regolamento generale
  rules.push(buildGeneralReferenceRule());
  
  // ✅ RENDER FINALE CON STRUTTURA A BLOCCHI
  container.innerHTML = `
    <div class="specific-regulation-cards">
      ${rules.join('')}
    </div>
  `;
}

// ===============================
// 11. BUILD COURT RULE (REGOLA 1)
// ===============================
function buildCourtRule(tournament) {
  const fixedCourt = tournament.fixed_court === true || String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim().toLowerCase();
  const hours = String(tournament.available_hours || "").trim().toLowerCase();

  let ruleText = "";

  if (fixedCourt) {
    ruleText = `
      <p>
        In questo torneo, campi, giorni e orari delle partite vengono <strong>stabiliti dall'organizzazione</strong>, 
        che provvederà a pubblicare il calendario completo prima dell'inizio del torneo.
      </p>
    `;
  } else {
    const availabilityPhrase = buildAvailabilityPhrase(days, hours);

    ruleText = `
      <p>
        ${availabilityPhrase}In fase di iscrizione, le squadre potranno esprimere le proprie preferenze
        relative a campi, giorni e orari di gioco
      </p>
      <p>
        L'organizzazione provvederà alla prenotazione dei campi per le partite casalinghe di ciascuna squadra, 
        tenendo conto delle preferenze indicate. 
      </p>
    `;
  }

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">1</div>
      <div class="specific-regulation-content">
        <p><strong>Campi, giorni e orari</strong></p>
        ${ruleText}
      </div>
    </div>
  `;
}

// ===============================
// 12. BUILD AVAILABILITY PHRASE
// ===============================
function buildAvailabilityPhrase(days, hours) {
  const daysPhrase = mapDaysToPhrase(days);
  const hoursPhrase = mapHoursToPhrase(hours);

  if (!daysPhrase && !hoursPhrase) {
    return "";
  }

  if (daysPhrase && !hoursPhrase) {
    return `In questo torneo, le partite potranno essere disputate <strong>${daysPhrase}</strong>. `;
  }

  if (!daysPhrase && hoursPhrase) {
    return `In questo torneo, le partite potranno essere disputate <strong>${hoursPhrase}</strong>. `;
  }

  return `In questo torneo, le partite potranno essere disputate <strong>${daysPhrase}</strong>, <strong>${hoursPhrase}</strong>. `;
}

// ===============================
// 13. MAP DAYS TO PHRASE
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
// 14. MAP HOURS TO PHRASE
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
// 15. BUILD FORMAT RULE (REGOLA 2)
// ===============================
function buildFormatRule(tournament) {
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
      <div class="specific-regulation-icon">2</div>
      <div class="specific-regulation-content">
        <p><strong>Formato del torneo</strong></p>
        ${formatText}
      </div>
    </div>
  `;
}

// ===============================
// 16. BUILD QUALIFICATION PHRASE
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
// 17. BUILD RANKING RULE (REGOLA 3)
// ===============================
function buildRankingRule(tournament) {
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
      <div class="specific-regulation-icon">3</div>
      <div class="specific-regulation-content">
        <p><strong>Criteri di classifica</strong></p>
        ${intraGroupText}
        ${crossGroupText}
      </div>
    </div>
  `;
}

// ===============================
// 18. BUILD CROSS GROUP COMPARISON TEXT
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
// 19. BUILD REFEREE RULE (REGOLA 4)
// ===============================
function buildRefereeRule(tournament) {
  const hasReferee = tournament.referee === true || String(tournament.referee).toUpperCase() === "TRUE";
  
  let ruleText = "";
  let ruleNumber = "4";
  
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
// 20. BUILD GENERAL REFERENCE RULE (REGOLA 4)
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
// 21. POPOLA CAMPI EXTRA FORM
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
  zoneField.innerHTML = `
    Zona preferita
    <span class="field-helper">Indica la zona di Torino e provincia dove preferisci giocare (es. Moncalieri, Zona Lingotto, Zona Crocetta)</span>
    <input type="text" name="preferred_zone" required placeholder="Es. Moncalieri">
  `;
  container.appendChild(zoneField);

  // CAMPO 2: GIORNI PREFERITI
  if (availableDays && availableDays !== "NA") {
    const daysField = buildDaysField(availableDays);
    container.appendChild(daysField);
  }

  // CAMPO 3: ORARIO PREFERITO
  if (availableHours && availableHours !== "NA") {
    const hoursField = buildHoursField(availableHours);
    container.appendChild(hoursField);
  }
}

// ===============================
// 22. BUILD DAYS FIELD
// ===============================
function buildDaysField(availableDays) {
  const wrapper = document.createElement("div");
  
  const daysMap = parseDaysRange(availableDays);
  const minDays = (availableDays === "sab-dom") ? 1 : 2;
  
  const label = (minDays === 1) 
    ? "Giorno preferito" 
    : `Giorni preferiti (seleziona almeno ${minDays})`;

  wrapper.innerHTML = `
    <label style="display: flex; flex-direction: column;">
      ${label}
      <span class="field-helper">Seleziona ${minDays === 1 ? 'il giorno' : 'i giorni'} in cui preferisci giocare</span>
    </label>
  `;

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
// 23. BUILD HOURS FIELD
// ===============================
function buildHoursField(availableHours) {
  const wrapper = document.createElement("label");
  
  const slots = parseHoursSlots(availableHours);
  
  wrapper.innerHTML = `
    Orario preferito
    <span class="field-helper">Scegli lo slot orario in cui preferisci giocare</span>
  `;

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
// 25. PARSE HOURS SLOTS
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
// 26. STATO TORNEO (UI)
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

  if (tournament.status === "final_phase") {
    badge.textContent = "FASE FINALE";
    badge.classList.add("final_phase");
    subscribeMessage.textContent =
      "Il torneo è entrato nella fase finale. Le iscrizioni sono chiuse.";
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
// 27. SUBMIT ISCRIZIONE (FIREBASE)
// ===============================
function handleFormSubmit(tournament) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

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
    const inputs = form.querySelectorAll("input, select");

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

        if (response === "INVALID_DATA") {
          showToast("Dati mancanti o non validi ⚠️");
          restoreForm();
          return;
        }

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
// 28. LOAD + RENDER TEAMS LIST
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
// 29. TEAMS LIST STATES
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
// 30. TOAST NOTIFICATION
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