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
// 3. API URL
// ===============================
const API_URL =
  "https://script.google.com/macros/s/AKfycbxxgJnLoxkP_XDhQxRtqrZ0M_trOlVOmjIpsVACug1dlfSmfZz0fWXcdADvI0XcP7W3-A/exec";


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
// 4. FETCH TORNEI (WITH SKELETON FADE)
// ===============================
fetch(API_URL)
  .then(res => res.json())
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
    console.error(err);
    genericSection.classList.remove("hidden");
    tournamentSkeleton.classList.add("hidden");
    tournamentSection.classList.add("hidden");
    showToast("Errore nel caricamento dei dati ❌");

  });


// ===============================
// 5. REGOLAMENTO GENERALE + SELECT
// ===============================
function renderGenericRegulation(tournaments) {
  genericSection.classList.remove("hidden");
  tournamentSection.classList.add("hidden");
  tournamentSkeleton.classList.add("hidden");

  // ✅ NASCONDI regolamento full-width (non serve nella vista generale)
  const regulationBlock = document.querySelector(".tournament-general-regulation");
  if (regulationBlock) {
    regulationBlock.classList.add("hidden"); // ✅ Questo è corretto
  }

  // Reset select
  tournamentSelect.innerHTML =
    `<option value="">Seleziona un torneo</option>`;

  tournaments.forEach(t => {
    const option = document.createElement("option");
    option.value = t.tournament_id;
    option.textContent = `${t.name} · ${t.date} · ${t.location}`;
    tournamentSelect.appendChild(option);
  });

  // Redirect su torneo
  tournamentSelect.onchange = function () {
    if (!this.value) return;
    window.location.href = `tournament.html?tournament_id=${this.value}`;
  };
}





// ===============================
// 6. RENDER TORNEO SPECIFICO
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

  // ✅ NUOVO: Court info message
  const courtInfo = buildCourtInfoMessage(tournament);
  document.getElementById("info-court").textContent = courtInfo;

  // ✅ NUOVO: Regola specifica campi
  renderSpecificCourtRule(tournament);

  // Existing counter (already in your UI)
  teamsInfo.textContent = `${tournament.teams_current} / ${tournament.teams_max}`;

  // Apply state & form behavior
  applyTournamentState(tournament);

  if (tournament.status === "open") {
    populateExtraFields(tournament);
    handleFormSubmit(tournament);
  }

  // Load + render teams list block
  loadAndRenderTeamsList(tournament);

  // ✅ NUOVO: Mostra regolamento generale full-width
  showGeneralRegulation();
}

// ===============================
// SHOW GENERAL REGULATION (FULL WIDTH) (NEW)
// ===============================
function showGeneralRegulation() {
  const regulationBlock = document.querySelector(".tournament-general-regulation");
  if (regulationBlock) {
    regulationBlock.classList.remove("hidden"); // ✅ Mostra il blocco
  }
}

// ===============================
// BUILD COURT INFO MESSAGE
// ===============================
function buildCourtInfoMessage(tournament) {
  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";
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
// RENDER SPECIFIC COURT RULE (NEW)
// ===============================
// ===============================
// RENDER SPECIFIC COURT RULE
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
  
  // ✅ RENDER FINALE CON STRUTTURA A BLOCCHI
  container.innerHTML = `
    <div class="specific-regulation-cards">
      ${rules.join('')}
    </div>
  `;
}


// ===============================
// BUILD COURT RULE (REGOLA 1)
// ===============================
function buildCourtRule(tournament) {
  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim().toLowerCase();
  const hours = String(tournament.available_hours || "").trim().toLowerCase();

  let ruleText = "";

  if (fixedCourt) {
    // =============================================
    // CASO A: Programmazione stabilita dall'organizzazione
    // =============================================
    ruleText = `
      <p>
        In questo torneo, campi, giorni e orari delle partite vengono <strong>stabiliti dall'organizzazione</strong>, 
        che provvederà a pubblicare il calendario completo prima dell'inizio del torneo.
      </p>
    `;
  } else {
    // =============================================
    // CASO B: Programmazione concordata tra le squadre
    // =============================================
    const availabilityPhrase = buildAvailabilityPhrase(days, hours);

    ruleText = `
      <p>
        ${availabilityPhrase}In fase di iscrizione, le squadre potranno esprimere le proprie preferenze
        relative a campi, giorni e orari di gioco
      </p>
      <p>
        L’organizzazione provvederà alla prenotazione dei campi per le partite casalinghe di ciascuna squadra, 
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
// BUILD AVAILABILITY PHRASE
// ===============================
function buildAvailabilityPhrase(days, hours) {
  const daysPhrase = mapDaysToPhrase(days);
  const hoursPhrase = mapHoursToPhrase(hours);

  // Nessun vincolo specificato
  if (!daysPhrase && !hoursPhrase) {
    return "";
  }

  // Solo giorni specificati
  if (daysPhrase && !hoursPhrase) {
    return `In questo torneo, le partite potranno essere disputate <strong>${daysPhrase}</strong>. `;
  }

  // Solo orari specificati
  if (!daysPhrase && hoursPhrase) {
    return `In questo torneo, le partite potranno essere disputate <strong>${hoursPhrase}</strong>. `;
  }

  // Entrambi specificati
  return `In questo torneo, le partite potranno essere disputate <strong>${daysPhrase}</strong>, <strong>${hoursPhrase}</strong>. `;
}

// ===============================
// MAP DAYS TO PHRASE
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
// MAP HOURS TO PHRASE
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
// BUILD FORMAT RULE (REGOLA 2)
// ===============================
function buildFormatRule(tournament) {
  const teamsPerGroup = Number(tournament.teams_per_group) || 0;
  const teamsInFinal = Number(tournament.teams_in_final) || 0;
  const teamsMax = Number(tournament.teams_max) || 0;

  let formatText = "";

  // CASO 1: Gironi + Fase finale
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
  }
  // CASO 2: Solo fase finale (tutti contro tutti o eliminazione diretta)
  else if (teamsPerGroup === 0 && teamsInFinal > 0) {
    formatText = `
      <p>
        Il torneo si svolgerà con <strong>fase finale diretta</strong> tra le <strong>${teamsMax} squadre</strong> iscritte.
      </p>
    `;
  }
  // CASO 3: Solo gironi (nessuna fase finale)
  else if (teamsPerGroup > 0 && teamsInFinal === 0) {
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
  }
  // CASO 4: Formato sconosciuto (fallback)
  else {
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
// BUILD QUALIFICATION PHRASE
// ===============================
function buildQualificationPhrase(numGroups, teamsInFinal) {
  // Tutte le prime classificate si qualificano sempre
  const firstPlaceQualifiers = numGroups;
  
  // Quante seconde classificate servono per raggiungere il totale?
  const secondPlaceQualifiers = teamsInFinal - firstPlaceQualifiers;

  // CASO A: Solo le prime classificate (nessuna seconda)
  if (secondPlaceQualifiers <= 0) {
    if (numGroups === 1) {
      return `Solo la <strong>prima classificata</strong> del girone accederà alla fase finale.`;
    }
    return `Solo le <strong>prime classificate</strong> di ciascun girone accederanno alla fase finale.`;
  }

  // CASO B: Tutte le prime + tutte le seconde
  if (secondPlaceQualifiers === numGroups) {
    if (numGroups === 1) {
      return `La <strong>prima</strong> e la <strong>seconda classificata</strong> del girone accederanno alla fase finale.`;
    }
    return `Le <strong>prime</strong> e le <strong>seconde classificate</strong> di ciascun girone accederanno alla fase finale.`;
  }

  // CASO C: Tutte le prime + alcune migliori seconde
  if (numGroups === 1) {
    return `La <strong>prima classificata</strong> del girone e la <strong>migliore seconda</strong> accederanno alla fase finale.`;
  }
  
  const secondeText = secondPlaceQualifiers === 1 
    ? `la <strong>migliore seconda classificata</strong>` 
    : `le <strong>${secondPlaceQualifiers} migliori seconde classificate</strong>`;

  return `Le <strong>prime classificate</strong> di ciascun girone e ${secondeText} accederanno alla fase finale.`;
}


// ===============================
// BUILD RANKING RULE (REGOLA 3)
// ===============================
function buildRankingRule(tournament) {
  const teamsPerGroup = Number(tournament.teams_per_group) || 0;
  const teamsInFinal = Number(tournament.teams_in_final) || 0;
  const teamsMax = Number(tournament.teams_max) || 0;

  // Se non ci sono gironi, non mostrare questa regola
  if (teamsPerGroup === 0) {
    return "";
  }

  const numGroups = Math.ceil(teamsMax / teamsPerGroup);

  // Parte A: Classifica all'interno dello stesso girone (sempre presente)
  const intraGroupText = `
    <p>
      <strong>Classifica all'interno dello stesso girone:</strong> in caso di parità di punti tra due o più squadre 
      dello stesso girone, l'ordine in classifica sarà determinato dai seguenti criteri, in ordine di importanza: 
      scontri diretti, differenza reti, gol fatti.
    </p>
  `;

  // Parte B: Confronto tra gironi diversi (solo se necessario)
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
// BUILD CROSS GROUP COMPARISON TEXT
// ===============================
function buildCrossGroupComparisonText(numGroups, teamsInFinal) {
  // Calcola quante prime e quante seconde si qualificano
  const firstPlaceQualifiers = Math.min(numGroups, teamsInFinal);
  const secondPlaceQualifiers = Math.max(0, teamsInFinal - numGroups);

  // Calcola se serve un confronto tra gironi
  const needsBestFirstComparison = teamsInFinal > 0 && teamsInFinal < numGroups;
  const needsBestSecondComparison = secondPlaceQualifiers > 0 && secondPlaceQualifiers < numGroups;

  // Se non serve confronto tra gironi, non mostrare nulla
  if (!needsBestFirstComparison && !needsBestSecondComparison) {
    return "";
  }

  // Costruisci la frase descrittiva
  let comparisonTarget = "";

  if (needsBestFirstComparison) {
    // Caso: servono solo alcune prime (es. 5 gironi, 4 in finale)
    const bestFirstCount = teamsInFinal;
    comparisonTarget = bestFirstCount === 1 
      ? `la migliore prima classificata` 
      : `le ${bestFirstCount} migliori prime classificate`;
  } else if (needsBestSecondComparison) {
    // Caso: servono alcune migliori seconde (es. 6 gironi, 8 in finale → 2 migliori seconde)
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
// 6B. POPOLA CAMPI EXTRA FORM (NEW)
// ===============================
function populateExtraFields(tournament) {
  const container = document.getElementById("extra-fields-container");
  container.innerHTML = ""; // reset

  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";

  // CASO A: fixed_court = TRUE → nessun campo extra
  if (fixedCourt) return;

  // CASO B: fixed_court = FALSE → campi extra
  const availableDays = String(tournament.available_days || "").trim();
  const availableHours = String(tournament.available_hours || "").trim();

  // =============================
  // CAMPO 1: ZONA PREFERITA
  // =============================
  const zoneField = document.createElement("label");
  zoneField.innerHTML = `
    Zona preferita
    <span class="field-helper">Indica la zona di Torino e provincia dove preferisci giocare (es. Moncalieri, Zona Lingotto, Zona Crocetta)</span>
    <input type="text" name="preferred_zone" required placeholder="Es. Moncalieri">
  `;
  container.appendChild(zoneField);

  // =============================
  // CAMPO 2: GIORNI PREFERITI
  // =============================
  if (availableDays && availableDays !== "NA") {
    const daysField = buildDaysField(availableDays);
    container.appendChild(daysField);
  }

  // =============================
  // CAMPO 3: ORARIO PREFERITO
  // =============================
  if (availableHours && availableHours !== "NA") {
    const hoursField = buildHoursField(availableHours);
    container.appendChild(hoursField);
  }
}

// ===============================
// BUILD DAYS FIELD (NEW)
// ===============================
function buildDaysField(availableDays) {
  const wrapper = document.createElement("div");
  
  // Mappa giorni disponibili
  const daysMap = parseDaysRange(availableDays);
  
  // Determina quanti giorni servono
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
// BUILD HOURS FIELD (NEW)
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
// PARSE DAYS RANGE (NEW)
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
    return allDays.slice(0, 5); // lun → ven
  }
  
  if (rangeLower === "sab-dom") {
    return allDays.slice(5, 7); // sab, dom
  }
  
  if (rangeLower === "lun-dom") {
    return allDays; // tutti
  }

  return allDays;
}

// ===============================
// PARSE HOURS SLOTS (NEW)
// ===============================
function parseHoursSlots(range) {
  const rangeLower = range.toLowerCase();
  
  // Estrai ore di inizio e fine
  const [start, end] = rangeLower.split("-").map(Number);
  
  if (!start || !end || end <= start) return [];

  const slots = [];
  
  // Genera slot di 2 ore
  for (let h = start; h <= end - 2; h++) {
    slots.push({
      value: `${h}-${h + 2}`,
      label: `${String(h).padStart(2, "0")}:00 - ${String(h + 2).padStart(2, "0")}:00`
    });
  }

  return slots;
}





// ===============================
// 7. STATO TORNEO (UI)
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
// 8. SUBMIT ISCRIZIONE (WITH LOADING STATE)
// ===============================
// ===============================
// 8. SUBMIT ISCRIZIONE (WITH VALIDATION)
// ===============================
function handleFormSubmit(tournament) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // =============================
    // VALIDAZIONE GIORNI (SE PRESENTI)
    // =============================
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

    // ✅ CREA FORM DATA
    const formData = new FormData(form);
    formData.append("tournament_id", tournament.tournament_id);

    // --- STATO LOADING ---
    submitBtn.innerHTML = `
      <span class="spinner"></span>
      Iscrizione in corso...
    `;
    submitBtn.classList.add("disabled");
    submitBtn.disabled = true;

    inputs.forEach(input => input.disabled = true);

    fetch(API_URL, {
      method: "POST",
      body: formData
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
      .catch(() => {
        showToast("Errore inatteso ❌");
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
// 9. LOAD + RENDER TEAMS LIST (NEW)
// ===============================
function loadAndRenderTeamsList(tournament) {
  // If HTML block not present, avoid breaking the page
  if (!teamsListSection || !teamsListContainer || !teamsListCount) return;

  // Show block + reset UI
  teamsListSection.classList.remove("hidden");
  teamsListContainer.innerHTML = "";
  teamsListCount.textContent = `${tournament.teams_current} / ${tournament.teams_max}`;

  // Skeleton placeholders (simple, CSS later)
  renderTeamsSkeleton(8);

  const url = `${API_URL}?action=get_teams&tournament_id=${encodeURIComponent(
    tournament.tournament_id
  )}`;

  fetch(url)
    .then(res => res.json())
    .then(teams => {
      if (!Array.isArray(teams)) throw new Error("Formato teams non valido");

      // Clear skeleton
      teamsListContainer.innerHTML = "";

      if (teams.length === 0) {
        renderTeamsEmptyState();
        return;
      }

      renderTeamsChips(teams);
    })
    .catch(err => {
      console.error(err);
      teamsListContainer.innerHTML = "";
      renderTeamsErrorState();
    });
}

function renderTeamsChips(teams) {
  // teams: [{team_id, team_name}]
  const frag = document.createDocumentFragment();

  teams.forEach((t, idx) => {
    const chip = document.createElement("div");
    chip.className = "team-chip"; // CSS later

    chip.innerHTML = `
      <span class="team-chip-index">${idx + 1}</span>
      <span class="team-chip-name">${escapeHTML(t.team_name || "")}</span>
    `;

    frag.appendChild(chip);
  });

  teamsListContainer.appendChild(frag);
}

// ===============================
// TEAMS LIST STATES (NEW)
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
  el.className = "teams-empty"; // CSS later
  el.textContent = "Nessuna squadra iscritta al momento.";
  teamsListContainer.appendChild(el);
}

function renderTeamsErrorState() {
  const el = document.createElement("div");
  el.className = "teams-error"; // CSS later
  el.textContent = "Errore nel caricamento delle squadre ❌";
  teamsListContainer.appendChild(el);
}

// Minimal escaping to avoid HTML injection via team_name
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}






function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}




