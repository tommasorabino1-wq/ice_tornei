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
// BUILD COURT INFO MESSAGE (NEW)
// ===============================
function buildCourtInfoMessage(tournament) {
  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim();
  const hours = String(tournament.available_hours || "").trim();

  if (fixedCourt) {
    return "Campi, giorni e orari prefissati";
  }

  let message = "Campi a scelta";

  if (!days || days === "NA" || !hours || hours === "NA") {
    return message;
  }

  const daysText = mapDaysToText(days);
  const hoursText = mapHoursToText(hours);

  if (daysText && hoursText) {
    message += ` - ${daysText} ${hoursText}`;
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

  const [start, end] = mapped.split("-");
  return `dalle ${start} alle ${end}`;
}

// ===============================
// RENDER SPECIFIC COURT RULE (NEW)
// ===============================
function renderSpecificCourtRule(tournament) {
  const container = document.getElementById("specific-court-rule");
  
  const fixedCourt = String(tournament.fixed_court).toUpperCase() === "TRUE";
  const days = String(tournament.available_days || "").trim();
  const hours = String(tournament.available_hours || "").trim();

  let ruleText = "";

  if (fixedCourt) {
    // CASO A: Campi fissi
    ruleText = `
      <p>
        Per questo torneo, <strong>i campi, i giorni e gli orari sono prefissati</strong> 
        dall'organizzazione. Il calendario completo delle partite sarà comunicato prima 
        dell'inizio del torneo.
      </p>
    `;
  } else {
    // CASO B: Campi a scelta
    const daysText = mapDaysToText(days);
    const hoursText = mapHoursToText(hours);

    let availabilityText = "";
    
    if (daysText && hoursText) {
      availabilityText = `<strong>${daysText}</strong> <strong>${hoursText}</strong>`;
    } else if (daysText) {
      availabilityText = `<strong>${daysText}</strong>`;
    } else if (hoursText) {
      availabilityText = `<strong>${hoursText}</strong>`;
    }

    ruleText = `
      <p>
        Per questo torneo, <strong>i campi sono a scelta delle squadre</strong>. 
        ${availabilityText ? `Le partite si svolgeranno ${availabilityText}.` : ''}
      </p>
      <p>
        L'organizzazione prenoterà i campi seguendo le preferenze indicate 
        dalle squadre in fase di iscrizione per le partite in cui giocano in casa.
      </p>
    `;
  }

  container.innerHTML = ruleText;
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




