// ===============================
// TOURNAMENT PAGE LOGIC (ICE)
// ===============================


// ===============================
// SIDEBAR NAVIGATION
// ===============================

const menuToggle   = document.querySelector(".mobile-menu-toggle");
const mainNav      = document.getElementById("main-navigation");
const navOverlay   = document.getElementById("nav-overlay");

function openNav() {
  mainNav.classList.add("active");
  navOverlay.classList.add("active");
  menuToggle.classList.add("active");
  menuToggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden"; // blocca scroll pagina
}

function closeNav() {
  mainNav.classList.remove("active");
  navOverlay.classList.remove("active");
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

if (menuToggle && mainNav && navOverlay) {

  // apri con hamburger
  menuToggle.addEventListener("click", () => {
    mainNav.classList.contains("active") ? closeNav() : openNav();
  });

  // chiudi cliccando l'overlay
  navOverlay.addEventListener("click", closeNav);

  // chiudi con ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("active")) {
      closeNav();
    }
  });

}

// ===============================
// NAV DROPDOWN LIVELLO 1 (TORNEI)
// ===============================
const dropdownTornei = document.getElementById("dropdown-tornei");
const toggleTornei   = dropdownTornei?.querySelector(":scope > .nav-dropdown-toggle");

if (toggleTornei && dropdownTornei) {
  toggleTornei.addEventListener("click", () => {
    const isActive = dropdownTornei.classList.toggle("active");
    toggleTornei.setAttribute("aria-expanded", String(isActive));
  });
}

// ===============================
// NAV SUBDROPDOWN LIVELLO 2 (CALCIO)
// ===============================
const subdropdownCalcio = document.getElementById("subdropdown-calcio");
const toggleCalcio      = subdropdownCalcio?.querySelector(":scope > .nav-subdropdown-toggle");

if (toggleCalcio && subdropdownCalcio) {
  toggleCalcio.addEventListener("click", (e) => {
    e.stopPropagation();
    const isActive = subdropdownCalcio.classList.toggle("active");
    toggleCalcio.setAttribute("aria-expanded", String(isActive));
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
let currentTournamentData = null;

// ===============================
// 3. API URLS (FIREBASE FUNCTIONS)
// ===============================

const API_URLS = {
  getTournaments:    "https://gettournaments-dzvezz2yhq-uc.a.run.app",
  getTeams:          "https://getteams-dzvezz2yhq-uc.a.run.app",
  getTeamsWithLogos: "https://getteamswithlogos-dzvezz2yhq-uc.a.run.app",
  submitSubscription:"https://submitsubscription-dzvezz2yhq-uc.a.run.app",
  checkTeamName:     "https://checkteamname-dzvezz2yhq-uc.a.run.app"
};



// ===============================
// HELPER: idempotente bool (frontend)
// ===============================
function toBool(val) {
  if (val === true  || val === 1)  return true;
  if (val === false || val === 0)  return false;
  const s = String(val ?? '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

// ===============================
// HELPER: idempotente number (frontend)
// ===============================
function toNum(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}




// ===============================
// 4. STATO INIZIALE UI
// ===============================
if (tournamentId) {
  genericSection.classList.add("hidden");
  tournamentSkeleton.classList.remove("hidden");
  tournamentSection.classList.add("hidden");

  // Nascondi il titolo generico "Regolamento Tornei ICE" quando si è su un torneo specifico
  const pageTitle = document.querySelector(".page-title.page-title-box");
  if (pageTitle) pageTitle.classList.add("hidden");

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

  tournaments
    .filter(t => t.status !== "hidden")
    .forEach(t => {
      const option = document.createElement("option");
      option.value = t.tournament_id;
      option.textContent = `${t.name} · ${t.date}`;
      tournamentSelect.appendChild(option);
    });

  // Redirect su torneo
  tournamentSelect.onchange = function () {
    if (!this.value) return;
    window.location.href = `/regolamento?tournament_id=${this.value}`;
  };
}














// ===============================
// 7. INFO-BOX TORNEO
// ===============================
function renderTournament(tournament) {

  currentTournamentData = tournament;

  genericSection.classList.add("hidden");
  tournamentSection.classList.remove("hidden");

  // ── BANNER EVENTO ─────────────────────────────────────────────────────────
  renderEventBanner(tournament);

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

  // ===============================
  // BREADCRUMB UPDATE
  // ===============================
  const breadcrumb = document.getElementById("breadcrumb-tournament");
  if (breadcrumb) {
    breadcrumb.textContent = tournament.name + " · Regolamento";
  }

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

    const teamNameInput = form?.querySelector('[name="team_name"]');
    if (teamNameInput && !teamNameInput.dataset.duplicateNameListenerAttached) {
      teamNameInput.addEventListener("input", () => {
        resetDuplicateNameConfirmation();
      });
      teamNameInput.dataset.duplicateNameListenerAttached = "true";
    }
  }

  // Load + render teams list block
  loadAndRenderTeamsList(tournament);

  // Riepilogo definitivo (se iscrizioni chiuse e dati compilati)
  renderFinalSummary(tournament);
}


// ===============================
// RENDER EVENT BANNER
// ===============================
function renderEventBanner(tournament) {
  const banner = document.getElementById("tournament-event-banner");
  if (!banner) return;

  const raw = tournament.event_description;
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    banner.classList.add("hidden");
    return;
  }

  const badge = tournament.event_badge || "Torneo Evento";

  banner.classList.remove("hidden");
  banner.innerHTML = `
    <div class="ev-badge">${escapeHTML(badge)}</div>
    <div class="ev-body">${sanitizeEventHTML(raw)}</div>
  `;
}


// ===============================
// SANITIZE EVENT HTML
// ===============================
function sanitizeEventHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const allowedTags = new Set(['P', 'STRONG', 'EM', 'BR', 'UL', 'LI', 'DIV', 'SPAN']);

  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (!allowedTags.has(node.tagName)) return null;

    const clean = document.createElement(node.tagName);

    if (node.hasAttribute('class')) {
      const safeClasses = node.getAttribute('class')
        .split(' ')
        .filter(c => c.startsWith('ev-'))
        .join(' ');
      if (safeClasses) clean.setAttribute('class', safeClasses);
    }

    for (const child of node.childNodes) {
      const sanitized = sanitizeNode(child);
      if (sanitized) clean.appendChild(sanitized);
    }

    return clean;
  }

  const result = document.createElement('div');
  for (const child of doc.body.childNodes) {
    const sanitized = sanitizeNode(child);
    if (sanitized) result.appendChild(sanitized);
  }

  return result.innerHTML;
}


// ===============================
// 7b. RENDER TOURNAMENT INFO ROWS
// ===============================
function renderTournamentInfoRows(tournament) {
  const container = document.getElementById("tournament-info-rows");
  if (!container) return;

  const isIndividual      = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const participantsIcon  = isIndividual ? '👤' : '👥';
  const participantsLabel = isIndividual ? 'giocatori iscritti' : 'squadre iscritte';

  const rowPrice        = buildPriceInfoText(tournament);
  const rowLocation     = buildLocationInfoText(tournament);
  const rowDateLines    = buildDateInfoText(tournament);
  const rowParticipants = buildParticipantsInfoText(tournament);
  const rowAward        = buildAwardInfoText(tournament);
  const rowFormat       = buildFormatInfoText(tournament);

  const teamsCurrent = toNum(tournament.teams_current, 0);
  const teamsMax     = toNum(tournament.teams_max, 0);
  const rowSignups   = `${teamsCurrent} / ${teamsMax} ${participantsLabel}`;

  const dateRowsHTML = rowDateLines.length === 2
    ? `
      <div class="card-info-row"><span class="row-icon">📅</span><span><strong>Data:</strong> ${rowDateLines[0]}</span></div>
      <div class="card-info-row"><span class="row-icon">🕒</span><span><strong>Disponibilità:</strong> ${rowDateLines[1]}</span></div>
    `
    : `
      <div class="card-info-row"><span class="row-icon">📅</span><span><strong>Data:</strong> ${rowDateLines[0]}</span></div>
    `;

  container.innerHTML = `
    <div class="card-info-row"><span class="row-icon">💰</span><span><strong>Quota:</strong> ${rowPrice}</span></div>
    <div class="card-info-row"><span class="row-icon">📍</span><span><strong>Luogo:</strong> ${rowLocation}</span></div>
    ${dateRowsHTML}
    <div class="card-info-row"><span class="row-icon">${participantsIcon}</span><span><strong>Partecipanti:</strong> ${rowParticipants}</span></div>
    <div class="card-info-row"><span class="row-icon">🏆</span><span><strong>Montepremi:</strong> ${rowAward}</span></div>
    <div class="card-info-row"><span class="row-icon">📋</span><span><strong>Formato:</strong> ${rowFormat}</span></div>
    <div class="card-info-row"><span class="row-icon">✅</span><span><strong>Iscritti:</strong> ${rowSignups}</span></div>
  `;
}


// ===============================
// 7c. BUILD PARTICIPANTS INFO TEXT
// ===============================
function buildParticipantsInfoText(t) {
  const parts = [];

  const genderMap = {
    only_male:            "Solo ragazzi",
    only_female:          "Solo ragazze",
    mixed_strict:         "Misto obbligatorio",
    mixed_female_allowed: "Misto o femminile",
    open:                 "Aperto a tutti"
  };
  parts.push(genderMap[String(t.gender || 'open').toLowerCase()] || "Aperto a tutti");

  const ageMap = {
    under_18: "Under 18",
    over_35:  "Over 35",
    open:     "Tutte le età"
  };
  parts.push(ageMap[String(t.age || 'open').toLowerCase()] || "Tutte le età");

  const expertiseMap = {
    open:   "Livello amatoriale",
    expert: "Livello agonistico"
  };
  parts.push(expertiseMap[String(t.expertise || 'open').toLowerCase()] || "Livello amatoriale");

  return parts.join(" · ");
}


// ===============================
// 7d. BUILD PRICE INFO TEXT
// ===============================
function buildPriceInfoText(t) {
  const isIndividual   = String(t.individual_or_team || 'team').toLowerCase() === 'individual';
  const price          = toNum(t.price, 0);
  const perLabel       = isIndividual ? 'a giocatore' : 'a squadra';
  const courtPrice     = String(t.court_price     || "non_compreso").toLowerCase().trim();
  const refereePrice   = String(t.referee_price   || "na").toLowerCase().trim();
  const aperitivoPrice = String(t.aperitivo_price || "na").toLowerCase().trim();

  const courtMap = {
    compreso_gironi_finals: "Campi inclusi",
    compreso_gironi:        "Campi inclusi (solo gironi)",
    compreso_finals:        "Campi inclusi (solo finali)",
    non_compreso:           "Campi non inclusi",
    na:                     ""
  };
  const courtText = courtMap[courtPrice] ?? "Campi non inclusi";

  let refereeText = "";
  if      (refereePrice === "compreso_gironi_finals") refereeText = "Arbitro incluso";
  else if (refereePrice === "compreso_gironi")        refereeText = "Arbitro incluso (solo gironi)";
  else if (refereePrice === "compreso_finals")        refereeText = "Arbitro incluso (solo finali)";
  else if (refereePrice === "non_compreso")           refereeText = "Arbitro non incluso";

  let aperitivoText = "";
  if      (aperitivoPrice === "compreso_gironi_finals") aperitivoText = "Aperitivo incluso";
  else if (aperitivoPrice === "compreso_gironi")        aperitivoText = "Aperitivo incluso (solo gironi)";
  else if (aperitivoPrice === "compreso_finals")        aperitivoText = "Aperitivo incluso (solo finali)";

  const extras     = [courtText, refereeText, aperitivoText].filter(Boolean);
  const extrasText = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";
  return `€${price} ${perLabel}${extrasText}`;
}


// ===============================
// 7e. BUILD LOCATION INFO TEXT
// ===============================
function buildLocationInfoText(t) {
  const location   = escapeHTML(String(t.location || "").trim());
  const fixed      = String(t.fixed_court_days_hours || "false").toLowerCase().trim();
  const courtLabel = fixed === "fixed_all" ? "Campo prestabilito" : "Campi a scelta";
  return `${location} · ${courtLabel}`;
}


// ===============================
// 7f. BUILD DATE INFO TEXT
// Restituisce un array di 1 o 2 stringhe.
// 2 stringhe solo nel caso b2 (fixed_all + mid/long).
// ===============================
function buildDateInfoText(t) {
  const fixed     = String(t.fixed_court_days_hours || "false").toLowerCase().trim();
  const timeRange = String(t.time_range || "").toLowerCase().trim();
  const date      = escapeHTML(String(t.date || "").trim());

  const durationLabel = timeRange === "short" ? "Giornaliero" : "Stagionale";

  const daysRaw = String(t.available_days || "").toLowerCase().trim();

  const dayLabels = {
    lun:  "Lunedì",
    mar:  "Martedì",
    mart: "Martedì",
    mer:  "Mercoledì",
    merc: "Mercoledì",
    gio:  "Giovedì",
    giov: "Giovedì",
    ven:  "Venerdì",
    sab:  "Sabato",
    dom:  "Domenica"
  };

  const shortRangeLabels = {
    "lun-dom": "Tutti i giorni",
    "lun-ven": "Lun-Ven",
    "sab-dom": "Weekend",
    "ven-dom": "Ven-Dom"
  };

  function parseDays(raw) {
    if (!raw) return "";
    if (shortRangeLabels[raw]) return shortRangeLabels[raw];
    if (raw.includes("-")) {
      const [start, end] = raw.split("-");
      const s = dayLabels[start];
      const e = dayLabels[end];
      if (s && e) return `${s}-${e}`;
    }
    return dayLabels[raw] || "";
  }

  const hoursRaw = String(t.available_hours || "").toLowerCase().trim();

  function parseHours(raw) {
    if (!raw || !raw.includes("-")) return "";
    const [startH, endH] = raw.split("-");
    const s = Number(startH);
    const e = Number(endH);
    if (isNaN(s) || isNaN(e)) return "";
    return `${String(s).padStart(2, "0")}:00-${String(e).padStart(2, "0")}:00`;
  }

  const daysText  = parseDays(daysRaw);
  const hoursText = parseHours(hoursRaw);

  // Caso a: fixed = "false" o "fixed_finals" + time_range = "mid" o "long"
  if ((fixed === "false" || fixed === "fixed_finals") && (timeRange === "mid" || timeRange === "long")) {
    const parts = [durationLabel, daysText, hoursText, "Giorni e orari a scelta"].filter(Boolean);
    return [parts.join(" · ")];
  }

  // Caso b1: fixed = "fixed_all" + time_range = "short"
  if (fixed === "fixed_all" && timeRange === "short") {
    const parts = [durationLabel, date, hoursText, "Giorni e orari prestabiliti"].filter(Boolean);
    return [parts.join(" · ")];
  }

  // Caso b2: fixed = "fixed_all" + time_range = "mid" o "long" → 2 righe
  if (fixed === "fixed_all" && (timeRange === "mid" || timeRange === "long")) {
    const row1 = [durationLabel, date].filter(Boolean).join(" · ");
    const row2 = [daysText, hoursText, "Giorni e orari prestabiliti"].filter(Boolean).join(" · ");
    return [row1, row2];
  }

  // Fallback
  return [durationLabel];
}


// ===============================
// 7g. BUILD AWARD INFO TEXT
// ===============================
function buildAwardInfoText(t) {
  const hasAward = toBool(t.award);

  if (!hasAward) return "Premi simbolici";

  const perc     = t.award_amount_perc;
  const price    = toNum(t.price, 0);
  const teamsMax = toNum(t.teams_max, 0);

  if (perc && perc !== "NA" && !isNaN(Number(perc)) && price > 0 && teamsMax > 0) {
    const percValue  = Number(perc) / 100;
    const totalPrize = Math.round(teamsMax * price * percValue);
    return `€${totalPrize}`;
  }

  return "Montepremi garantito";
}


// ===============================
// 7h. BUILD FORMAT INFO TEXT
// ===============================
function buildFormatInfoText(t) {
  const formatMap = {
    round_robin:               "Girone unico solo andata",
    double_round_robin:        "Girone unico andata e ritorno",
    round_robin_finals:        "Gironi + fasi finali",
    double_round_robin_finals: "Gironi (A/R) + fasi finali"
  };

  const formatText = formatMap[t.format_type] || "Formato da definire";
  const guaranteed = toNum(t.guaranteed_match, 0);

  if (guaranteed > 0) return `${formatText} · ${guaranteed} partite garantite`;

  return formatText;
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

  // REGOLA 2: Campi, giorni e orari
  rules.push(buildCourtDaysHoursRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 3: Partecipanti
  rules.push(buildParticipantsRequirementsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 4: Premi
  rules.push(buildAwardsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 5: Formato
  rules.push(buildFormatTimeRangeRule(tournament, ruleNumber));
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

  // REGOLA 12: Rimborso in caso di annullamento del torneo
  rules.push(buildRefundRule(ruleNumber));
  ruleNumber++;

  // REGOLA 13: Comunicazioni ufficiali (sempre mostrata)
  rules.push(buildCommunicationsRule(tournament, ruleNumber));
  ruleNumber++;
  
  // REGOLA 14: Rimborsi e spostamenti (sempre mostrata)
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
  const price = toNum(tournament.price, 0);

  const isIndividual =
    String(tournament.individual_or_team || "team").toLowerCase().trim() === "individual";
  const perLabel = isIndividual ? "a giocatore" : "a squadra";

  const courtTypeRaw = String(tournament.court_type || "court").toLowerCase().trim();
  const courtType = courtTypeRaw === "bar" ? "bar" : "court";

  const courtPrice = String(tournament.court_price || "NA").toLowerCase().trim();
  const refereePrice = String(tournament.referee_price || "NA").toLowerCase().trim();
  const aperitivoPrice = String(tournament.aperitivo_price || "NA").toLowerCase().trim();

  const courtIncludedLabel =
    courtType === "bar" ? "il costo della location" : "il costo dei campi";

  const introText = `
    <p>
      La quota di iscrizione per questo torneo è di <strong>€${price} ${perLabel}</strong>.
    </p>
  `;

  function joinWithCommaAndE(parts) {
    const clean = parts.filter(Boolean);
    if (clean.length === 0) return "";
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
    return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
  }

  function getIncludedService(type, value) {
    if (value === "na" || value === "non_compreso") return null;

    if (type === "court") {
      switch (value) {
        case "compreso_gironi":
          return `${courtIncludedLabel} per le partite della <strong>fase a gironi</strong>`;
        case "compreso_finals":
          return `${courtIncludedLabel} per le partite delle <strong>fasi finali</strong>`;
        case "compreso_gironi_finals":
          return `${courtIncludedLabel} per tutte le partite del torneo`;
        default:
          return null;
      }
    }

    if (type === "referee") {
      switch (value) {
        case "compreso_gironi":
          return `il compenso arbitrale per le partite della <strong>fase a gironi</strong>`;
        case "compreso_finals":
          return `il compenso arbitrale per le partite delle <strong>fasi finali</strong>`;
        case "compreso_gironi_finals":
          return `il compenso arbitrale per tutte le partite del torneo`;
        default:
          return null;
      }
    }

    return null;
  }

  function getAperitivoIncludedText(value) {
    switch (value) {
      case "compreso_gironi":
        return `La quota di iscrizione comprende inoltre un <strong>aperitivo offerto</strong> durante la <strong>fase a gironi</strong>.`;
      case "compreso_finals":
        return `La quota di iscrizione comprende inoltre un <strong>aperitivo offerto</strong> durante le <strong>fasi finali</strong>.`;
      case "compreso_gironi_finals":
        return `La quota di iscrizione comprende inoltre un <strong>aperitivo offerto</strong>, che potrà essere consumato prima o dopo il torneo.`;
      default:
        return null;
    }
  }

  const includedServices = [
    getIncludedService("court", courtPrice),
    getIncludedService("referee", refereePrice),
  ].filter(Boolean);

  let inclusionText = "";

  if (includedServices.length > 0) {
    inclusionText += `
      <p>
        La quota di iscrizione comprende ${joinWithCommaAndE(includedServices)}.
      </p>
    `;
  }

  const aperitivoIncludedText = getAperitivoIncludedText(aperitivoPrice);
  if (aperitivoIncludedText) {
    inclusionText += `
      <p>
        ${aperitivoIncludedText}
      </p>
    `;
  }

  if (!inclusionText.trim()) {
    inclusionText = `
      <p>
        La quota di iscrizione non comprende servizi o prestazioni aggiuntive rispetto alla sola partecipazione al torneo.
      </p>
    `;
  }

  const extraNotes = [];

  if (courtPrice === "non_compreso") {
    if (courtType === "bar") {
      extraNotes.push(
        `<p>La quota di iscrizione <strong>non comprende il costo della location</strong>, che resterà a carico dei partecipanti secondo le modalità comunicate dall'organizzazione.</p>`
      );
    } else {
      extraNotes.push(
        `<p>La quota di iscrizione <strong>non comprende il costo dei campi</strong>. Per le partite disputate, tale costo resterà a carico dei partecipanti secondo le modalità comunicate dall'organizzazione.</p>`
      );
    }
  }

  if (refereePrice === "non_compreso") {
    extraNotes.push(
      `<p>La quota di iscrizione <strong>non comprende il compenso arbitrale</strong>, che resterà a carico dei partecipanti secondo le modalità comunicate dall'organizzazione.</p>`
    );
  }

  if (aperitivoPrice === "non_compreso") {
    extraNotes.push(
      `<p>La quota di iscrizione <strong>non comprende aperitivi o consumazioni offerte</strong>.</p>`
    );
  }

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Quota di iscrizione</strong></p>
        ${introText}
        ${inclusionText}
        ${extraNotes.join("")}
      </div>
    </div>
  `;
}




// ===============================
// 9c. BUILD COURT/DAYS/HOURS RULE (REGOLA 2)
// ===============================
function buildCourtDaysHoursRule(tournament, ruleNumber) {
  const fixed = String(tournament.fixed_court_days_hours || "false").toLowerCase().trim();
  const daysRaw = String(tournament.available_days || "").toLowerCase().trim();
  const hoursRaw = String(tournament.available_hours || "").toLowerCase().trim();
  const location = String(tournament.location || "").trim();
  const dateText = String(tournament.date || "").trim();
  const formatType = String(tournament.format_type || "").toLowerCase().trim();
  const timeRange = String(tournament.time_range || "").toLowerCase().trim();
  const courtType = String(tournament.court_type || "court").toLowerCase().trim();
  const isIndividual =
    String(tournament.individual_or_team || "team").toLowerCase().trim() === "individual";

  const hasFinals = formatType.includes("finals");
  const isShort = timeRange === "short";
  const isMid = timeRange === "mid";
  const isLong = timeRange === "long";

  const isFixedAll = fixed === "fixed_all";
  const isFixedFinals = fixed === "fixed_finals" && hasFinals;
  const isFlexible = fixed === "false";

  const entityPlural = isIndividual ? "partecipanti" : "squadre";
  const qualifiedPlural = isIndividual ? "i partecipanti qualificati" : "le squadre qualificate";
  const venuePlural = courtType === "bar" ? "location" : "campi";
  const venueSingular = courtType === "bar" ? "location" : "campo";
  const placePrefix = courtType === "bar" ? "presso" : "presso il centro sportivo";

  // ===============================
  // HELPERS
  // ===============================
  const dayLabels = {
    lun: "lunedì",
    mar: "martedì",
    mer: "mercoledì",
    merc: "mercoledì",
    gio: "giovedì",
    giov: "giovedì",
    ven: "venerdì",
    sab: "sabato",
    dom: "domenica"
  };

  function parseDays(value) {
    const v = String(value || "").toLowerCase().trim();
    if (!v) return "";

    if (v === "lun-dom") return "dal lunedì alla domenica";
    if (v === "lun-ven") return "dal lunedì al venerdì";
    if (v === "sab-dom") return "nel weekend (sabato e domenica)";
    if (v === "ven-dom") return "dal venerdì alla domenica";

    if (v.includes("-")) {
      const [start, end] = v.split("-").map(s => s.trim());
      if (dayLabels[start] && dayLabels[end]) {
        return `dal ${dayLabels[start]} al ${dayLabels[end]}`;
      }
    }

    if (dayLabels[v]) return `il ${dayLabels[v]}`;

    return "";
  }

  function parseHours(value) {
    const v = String(value || "").toLowerCase().trim();
    if (!v || !v.includes("-")) return "";

    const [start, end] = v.split("-").map(s => s.trim());

    const formatHour = (h) => {
      const n = Number(h);
      if (isNaN(n)) return "";
      return `${String(n).padStart(2, "0")}:00`;
    };

    const startFormatted = formatHour(start);
    const endFormatted = formatHour(end);

    if (!startFormatted || !endFormatted) return "";
    return `tra le ${startFormatted} e le ${endFormatted}`;
  }

  function wrapStrong(text) {
    return text ? `<strong>${text}</strong>` : "";
  }

  function joinWithComma(parts) {
    return parts.filter(Boolean).join(", ");
  }

  function capitalizeFirst(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ===============================
  // TESTI "DOVE E QUANDO"
  // ===============================

  function buildSchedulingModeFixedAllText() {
    if (isIndividual) {
      return `La sede, il giorno e l'orario di tutte le partite del torneo sono prestabiliti e prenotati in anticipo dall'organizzazione.`;
    }
    return `I campi, i giorni e gli orari di tutte le partite del torneo sono prestabiliti e prenotati in anticipo dall'organizzazione.`;
  }

  function buildSchedulingModeFlexibleText() {
    if (isIndividual) {
      return `Le sedi delle partite verranno prenotate dall'organizzazione di volta in volta, tenendo conto delle preferenze espresse dai partecipanti in fase di iscrizione e nel rispetto dei vincoli su zona, giorni e orari delle partite indicati sotto.`;
    }
    return `I campi delle partite verranno prenotati dall'organizzazione di volta in volta, tenendo conto delle preferenze espresse dalle squadre in fase di iscrizione e nel rispetto dei vincoli su zona, giorni e orari delle partite indicati sotto.`;
  }

  function buildSchedulingModeFixedFinalsGironiText() {
    if (isIndividual) {
      return `Per la fase a gironi, le sedi delle partite verranno prenotate dall'organizzazione di volta in volta, tenendo conto delle preferenze espresse dai partecipanti in fase di iscrizione e nel rispetto dei vincoli su zona, giorni e orari delle partite indicati sotto.`;
    }
    return `Per la fase a gironi, campi delle partite verranno prenotati dall'organizzazione di volta in volta, tenendo conto delle preferenze espresse dalle squadre in fase di iscrizione e nel rispetto dei vincoli su zona, giorni e orari delle partite indicati sotto.`;
  }

  function buildSchedulingModeFixedFinalsFinalsText() {
    if (isIndividual) {
      return `Per la fase finale, sede, giorno e orario delle partite saranno stabiliti dall'organizzazione al termine della fase a gironi e definiti in accordo con ${qualifiedPlural}.`;
    }
    return `Per la fase finale, campi, giorni e orari delle partite saranno stabiliti dall'organizzazione al termine della fase a gironi e definiti in accordo con ${qualifiedPlural}.`;
  }

  function buildFlexibleConstraintsText() {
    const daysText = parseDays(daysRaw);
    const hoursText = parseHours(hoursRaw);

    const parts = [
      location ? wrapStrong(location) : "",
      daysText ? wrapStrong(daysText) : "",
      hoursText ? wrapStrong(hoursText) : ""
    ];

    const mainText = joinWithComma(parts);
    const dateSuffix = dateText ? ` a partire da ${wrapStrong(dateText)}` : "il ";

    if (!mainText) return "";

    return `Le partite potranno essere disputate esclusivamente a ${mainText}${dateSuffix}.`;
  }

  function buildFixedConstraintsText() {
    const hoursText = parseHours(hoursRaw);

    const parts = [
      location ? wrapStrong(location) : "",
      dateText ? wrapStrong(dateText) : "",
      hoursText ? wrapStrong(hoursText) : ""
    ];

    const mainText = joinWithComma(parts);
    if (!mainText) return "";

    return `Tutte le partite del torneo verranno disputate ${placePrefix} ${mainText}.`;
  }

  function buildDeferredFinalsConstraintsText() {
    return `${capitalizeFirst(venueSingular)}, data e orari delle partite della fase finale saranno comunicati dall'organizzazione al termine della fase a gironi e definiti in accordo con ${qualifiedPlural}.`;
  }

  // ===============================
  // TESTI "DURATA"
  // ===============================
  function buildSimpleDailyDurationText() {
    return `Torneo Giornaliero · Tutte le partite del torneo si disputeranno in un'unica giornata.`;
  }

  function buildSimpleSeasonalDurationText() {
    return `Torneo Stagionale · Le ${entityPlural} disputeranno indicativamente una partita a settimana.`;
  }

  function buildPhaseSeasonalDurationText() {
    return `Stagionale · Le ${entityPlural} disputeranno indicativamente una partita a settimana.`;
  }

  function buildPhaseDailyFinalsDurationText() {
    return `Giornaliera · La fase finale si svolgerà in un'unica giornata conclusiva.`;
  }

  function buildSeasonalBothPhasesDurationText() {
    return `Torneo Stagionale · Le ${entityPlural} disputeranno indicativamente una partita a settimana, sia durante la fase a gironi sia durante la fase finale.`;
  }

  function buildFallbackItems() {
    return [
      `<li><strong>Dove e quando:</strong>
        <ul>
          <li>Le modalità organizzative relative a ${venuePlural}, giorni e orari delle partite saranno comunicate prima dell'inizio del torneo.</li>
          <li>Ulteriori dettagli su luogo, giorni e orari delle partite saranno comunicati prima dell'inizio del torneo.</li>
        </ul>
      </li>`,
      `<li><strong>Durata:</strong> La durata e la distribuzione delle partite saranno comunicate prima dell'inizio del torneo.</li>`
    ];
  }

  // ===============================
  // COSTRUZIONE VOCI
  // ===============================
  let items = [];

  // -------------------------------
  // SCENARIO 1: FINALI + FIXED_FINALS
  // -------------------------------
  if (isFixedFinals) {
    const gironiConstraints = buildFlexibleConstraintsText();
    const finaliConstraints = buildDeferredFinalsConstraintsText();

    items.push(`
      <li><strong>Dove e quando:</strong>
        <ul>
          <li><strong>Organizzazione:</strong>
            <ul>
              <li><strong>Fase a gironi:</strong> ${buildSchedulingModeFixedFinalsGironiText()}</li>
              <li><strong>Fase finale:</strong> ${buildSchedulingModeFixedFinalsFinalsText()}</li>
            </ul>
          </li>
          <li><strong>Zona, giorni e orari:</strong>
            <ul>
              ${gironiConstraints ? `<li><strong>Fase a gironi:</strong> ${gironiConstraints}</li>` : ""}
              <li><strong>Fase finale:</strong> ${finaliConstraints}</li>
            </ul>
          </li>
        </ul>
      </li>
    `);

    if (isMid) {
      items.push(`
        <li><strong>Durata:</strong>
          <ul>
            <li><strong>Fase a gironi:</strong> ${buildPhaseSeasonalDurationText()}</li>
            <li><strong>Fase finale:</strong> ${buildPhaseDailyFinalsDurationText()}</li>
          </ul>
        </li>
      `);
    } else if (isLong) {
      items.push(`
        <li><strong>Durata:</strong> ${buildSeasonalBothPhasesDurationText()}</li>
      `);
    } else if (isShort) {
      items.push(`
        <li><strong>Durata:</strong> ${buildSimpleDailyDurationText()}</li>
      `);
    }
  }

  // -------------------------------
  // SCENARIO 2: TUTTO FIXED
  // -------------------------------
  else if (isFixedAll) {
    const fixedConstraints = buildFixedConstraintsText();

    if (!fixedConstraints) {
      items = buildFallbackItems();
    } else {
      if (isShort) {
        const schedulingText = buildSchedulingModeFixedAllText();
        const singleLineText = schedulingText && fixedConstraints
          ? `${schedulingText} ${fixedConstraints}`
          : schedulingText || fixedConstraints || "";

        if (!singleLineText) {
          items = buildFallbackItems();
        } else {
          items.push(`<li><strong>Dove e quando:</strong> ${singleLineText}</li>`);
        }
      } else {
        items.push(`
          <li><strong>Dove e quando:</strong>
            <ul>
              <li><strong>Organizzazione:</strong> ${buildSchedulingModeFixedAllText()}</li>
              <li><strong>Zona, giorni e orari:</strong> ${fixedConstraints}</li>
            </ul>
          </li>
        `);

        if (!hasFinals) {
          items.push(`<li><strong>Durata:</strong> ${buildSimpleSeasonalDurationText()}</li>`);
        } else if (isMid) {
          items.push(`
            <li><strong>Durata:</strong>
              <ul>
                <li><strong>Fase a gironi:</strong> ${buildPhaseSeasonalDurationText()}</li>
                <li><strong>Fase finale:</strong> ${buildPhaseDailyFinalsDurationText()}</li>
              </ul>
            </li>
          `);
        } else if (isLong) {
          items.push(`<li><strong>Durata:</strong> ${buildSeasonalBothPhasesDurationText()}</li>`);
        }
      }
    }
  }

  // -------------------------------
  // SCENARIO 3: TUTTO FLESSIBILE
  // -------------------------------
  else if (isFlexible) {
    const flexibleConstraints = buildFlexibleConstraintsText();

    if (!flexibleConstraints) {
      items = buildFallbackItems();
    } else {
      items.push(`
        <li><strong>Dove e quando:</strong>
          <ul>
            <li><strong>Organizzazione:</strong> ${buildSchedulingModeFlexibleText()}</li>
            <li><strong>Zona, giorni e orari:</strong> ${flexibleConstraints}</li>
          </ul>
        </li>
      `);

      if (isShort) {
        items.push(`<li><strong>Durata:</strong> ${buildSimpleDailyDurationText()}</li>`);
      } else if (!hasFinals) {
        items.push(`<li><strong>Durata:</strong> ${buildSimpleSeasonalDurationText()}</li>`);
      } else if (isMid) {
        items.push(`
          <li><strong>Durata:</strong>
            <ul>
              <li><strong>Fase a gironi:</strong> ${buildPhaseSeasonalDurationText()}</li>
              <li><strong>Fase finale:</strong> ${buildPhaseDailyFinalsDurationText()}</li>
            </ul>
          </li>
        `);
      } else if (isLong) {
        items.push(`<li><strong>Durata:</strong> ${buildSeasonalBothPhasesDurationText()}</li>`);
      }
    }
  }

  // -------------------------------
  // SCENARIO 4: FALLBACK
  // -------------------------------
  else {
    items = buildFallbackItems();
  }

  if (!items.length) {
    items = buildFallbackItems();
  }

  const cardTitle = isIndividual
    ? "Sede di gioco, giorni, orari e calendario"
    : "Campi, giorni, orari e calendario";

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>${cardTitle}</strong></p>
        <ul>
          ${items.join("")}
        </ul>
      </div>
    </div>
  `;
}






// ===============================
// 9d. BUILD PARTICIPANTS REQUIREMENTS RULE (REGOLA 3)
// ===============================
function buildParticipantsRequirementsRule(tournament, ruleNumber) {
  const gender       = String(tournament.gender      || "open").toLowerCase();
  const age          = String(tournament.age         || "open").toLowerCase();
  const expertise    = String(tournament.expertise   || "open").toLowerCase();
  const maxCategory  = String(tournament.max_category|| "NA").trim();
  // FIX BUG 7: toNum per team_size_min e team_size_max
  const teamSizeMin  = toNum(tournament.team_size_min, 0);
  const teamSizeMax  = toNum(tournament.team_size_max, 0);
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const fideRated    = String(tournament.fide_rated  || "NA").toLowerCase();

  const genderMap = {
    "open":                { team: "qualsiasi composizione (maschili, femminili o miste)", individual: "qualsiasi genere", teamRestriction: null, individualRestriction: null },
    "only_male":           { team: "soli uomini", individual: "uomini", teamRestriction: "Possono partecipare esclusivamente squadre composte da soli uomini.", individualRestriction: "Possono partecipare esclusivamente giocatori di genere maschile." },
    "only_female":         { team: "sole donne", individual: "donne", teamRestriction: "Possono partecipare esclusivamente squadre composte da sole donne.", individualRestriction: "Possono partecipare esclusivamente giocatrici di genere femminile." },
    "mixed_strict":        { team: "miste", individual: "qualsiasi genere", teamRestriction: "Ogni squadra deve essere obbligatoriamente mista, composta da almeno un uomo e almeno una donna.", individualRestriction: null },
    "mixed_female_allowed":{ team: "miste o femminili", individual: "qualsiasi genere", teamRestriction: "Ogni squadra deve essere mista (almeno un uomo e una donna) oppure composta da sole donne. Non sono ammesse squadre composte da soli uomini.", individualRestriction: null }
  };

  let ageData = { text: "qualsiasi età", teamRestriction: null, individualRestriction: null };
  if (age !== "open") {
    const underMatch = age.match(/^under_(\d+)$/);
    const overMatch  = age.match(/^over_(\d+)$/);

    if (underMatch) {
      const ageValue = underMatch[1];
      ageData = {
        text: `Under ${ageValue}`,
        teamRestriction: `Tutti i componenti della squadra devono avere meno di ${ageValue} anni alla data di inizio del torneo.`,
        individualRestriction: `Il partecipante deve avere meno di ${ageValue} anni alla data di inizio del torneo.`
      };
    } else if (overMatch) {
      const ageValue = overMatch[1];
      ageData = {
        text: `Over ${ageValue}`,
        teamRestriction: `Tutti i componenti della squadra devono avere almeno ${ageValue} anni alla data di inizio del torneo.`,
        individualRestriction: `Il partecipante deve avere almeno ${ageValue} anni alla data di inizio del torneo.`
      };
    }
  }

  const expertiseMap = {
    "open":   { teamIntro: "aperto a giocatori e squadre di qualsiasi livello", individualIntro: "aperto a giocatori di qualsiasi livello", description: "È pensato per chi vuole divertirsi e mettersi in gioco in un contesto amatoriale." },
    "expert": { teamIntro: "rivolto a giocatori esperti con un livello di gioco medio-alto", individualIntro: "rivolto a giocatori esperti con un livello di gioco medio-alto", description: "Si consiglia la partecipazione solo a chi ha esperienza agonistica o un buon livello tecnico." }
  };

  const genderData    = genderMap[gender] || genderMap["open"];
  const expertiseData = expertiseMap[expertise] || expertiseMap["open"];

  let categoryRestriction = null;
  if (maxCategory && maxCategory.toLowerCase() !== "na") {
    if (maxCategory.toLowerCase().startsWith("elo_")) {
      const eloValue = maxCategory.replace(/^elo_/i, "");
      categoryRestriction = `Al fine di evitare squilibri, sono ammessi esclusivamente giocatori con un punteggio ELO pari o inferiore a ${eloValue}.`;
    } else {
      categoryRestriction = `Al fine di evitare squilibri, sono ammessi esclusivamente giocatori di ${maxCategory} o inferiore.`;
    }
  }

  let genderAgeText = "";
  if (isIndividual) {
    const genderPart = genderData.individual || "qualsiasi genere";
    const genderRestr = genderData.individualRestriction;
    const ageRestr    = ageData.individualRestriction;
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
    const ageRestr    = ageData.teamRestriction;
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

  const expertiseIntro = isIndividual ? expertiseData.individualIntro : expertiseData.teamIntro;
  let expertiseText = `Questo torneo è ${expertiseIntro}. ${expertiseData.description}`;
  if (categoryRestriction) expertiseText += ` ${categoryRestriction}`;

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

  let fideText = "";
  if (fideRated === "true") {
    fideText = `Questo torneo è <strong>omologato FIDE</strong>. I risultati saranno registrati ufficialmente e influenzeranno il punteggio ELO dei partecipanti.`;
  } else if (fideRated === "false") {
    fideText = `Questo torneo <strong>non è omologato FIDE</strong>. I risultati non influenzeranno il punteggio ELO ufficiale dei partecipanti.`;
  }

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
// 9e. BUILD AWARDS RULE (REGOLA 4)
// ===============================
function buildAwardsRule(tournament, ruleNumber) {
  const hasAward   = toBool(tournament.award);
  const awardPerc  = String(tournament.award_amount_perc || "NA");
  const price      = toNum(tournament.price, 0);
  const teamsMax   = toNum(tournament.teams_max, 0);
  const mvpAward   = String(tournament.mvp_award || "none").trim();
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entityWinners        = isIndividual ? 'i primi 3 classificati' : 'le prime 3 squadre classificate';
  const entityWinnersGeneric = isIndividual ? 'i vincitori' : 'le squadre vincitrici';
  const entityCount          = isIndividual ? 'giocatori iscritti' : 'squadre iscritte';

  let mainAwardText = "";
  if (hasAward) {
    if (awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
      const percValue  = Number(awardPerc) / 100;
      const totalPrize = Math.round(teamsMax * price * percValue);
      mainAwardText = `È previsto un montepremi pari a <strong>€${totalPrize}</strong>, che sarà suddiviso tra ${entityWinners}.`;
    } else {
      mainAwardText = `È previsto un montepremi per ${entityWinnersGeneric}. L'importo e la suddivisione saranno comunicati prima dell'inizio del torneo.`;
    }
  } else {
    mainAwardText = `Essendo un torneo aperto a giocatori di qualsiasi livello, al fine di evitare squilibri, sono previsti esclusivamente premi simbolici (coppe, medaglie, gadget e altri riconoscimenti) per ${entityWinnersGeneric}.`;
  }

  let guaranteeText = "";
  if (hasAward && awardPerc && awardPerc !== "NA" && !isNaN(Number(awardPerc)) && price > 0 && teamsMax > 0) {
    guaranteeText = `Il montepremi è garantito al raggiungimento di ${teamsMax} ${entityCount}. In ogni caso, anche nella rara eventualità in cui non si raggiungesse il numero previsto, il premio rimarrà comunque almeno uguale al ${awardPerc}% delle quote di iscrizione totali.`;
  } else if (hasAward) {
    guaranteeText = `Le condizioni per l'erogazione del montepremi saranno comunicate prima dell'inizio del torneo.`;
  } else {
    guaranteeText = `I premi simbolici saranno consegnati a ${entityWinnersGeneric} al termine del torneo.`;
  }

  // =====================================================
  // MVP / premi individuali — se "none" o "NA" non mostrare nulla
  // =====================================================

    let mvpAwardText = "";
    if (mvpAward && mvpAward.toLowerCase() !== "none" && mvpAward.toLowerCase() !== "na") {
      const awardsList = mvpAward
        .split("||")
        .map(item => item.trim())
        .filter(Boolean);

      if (awardsList.length > 0) {
        mvpAwardText = `
          <ul>
            ${awardsList.map(item => `<li>${item}</li>`).join("")}
          </ul>
        `;
      }
    }

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Premi e riconoscimenti</strong></p>
        <ul>
          <li><strong>Montepremi:</strong> ${mainAwardText}</li>
          <li><strong>Garanzia:</strong> ${guaranteeText}</li>
          ${mvpAwardText ? `<li><strong>Premi individuali:</strong> ${mvpAwardText}</li>` : ''}
        </ul>
      </div>
    </div>
  `;
}






// ===============================
// 9f. BUILD FORMAT RULE (REGOLA 5)
// ===============================
function buildFormatTimeRangeRule(tournament, ruleNumber) {
  const formatType = String(tournament.format_type || "").toLowerCase();
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entitySingular = isIndividual ? 'giocatore' : 'squadra';
  const entityPlural = isIndividual ? 'giocatori' : 'squadre';
  const entityWinner = isIndividual ? 'il giocatore' : 'la squadra';
  const entityPluralArticle = isIndividual ? 'dei giocatori' : 'delle squadre';
  const entityPluralLabel = isIndividual ? 'Partecipanti' : 'Squadre';

  const entityEach = isIndividual ? 'ogni giocatore' : 'ogni squadra';
  const entityOthers = isIndividual ? 'gli altri partecipanti' : 'le altre squadre';
  const entityOthersGroup = isIndividual ? 'gli altri partecipanti del proprio gruppo' : 'le altre squadre del proprio gruppo';
  const entityWinnerDirect = isIndividual ? 'il giocatore vincente' : 'la squadra vincente';
  const entityDeclaredWinner = isIndividual
    ? 'sarà proclamato vincitore del torneo'
    : 'sarà proclamata vincitrice del torneo';

  // =====================================================
  // MAPPING ELEMENTI DEL FORMATO
  // =====================================================

  let structureText = "";
  let phaseDetailsText = "";
  let teamsInfoText = "";

  switch (formatType) {

    case "round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di sola andata</strong>, in cui ${entityEach} affronterà una sola volta ${entityOthers}.`;
      phaseDetailsText = `Non essendo prevista una fase finale, ${entityWinner} che chiuderà il girone al primo posto ${entityDeclaredWinner}.`;
      teamsInfoText = `Il numero definitivo di ${entityPlural} partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;

    case "double_round_robin":
      structureText = `Il torneo prevede un <strong>girone unico all'italiana con partite di andata e ritorno</strong>, in cui ${entityEach} affronterà due volte ${entityOthers}.`;
      phaseDetailsText = `Non essendo prevista una fase finale, ${entityWinner} che chiuderà il girone al primo posto ${entityDeclaredWinner}.`;
      teamsInfoText = `Il numero definitivo di ${entityPlural} partecipanti sarà comunicato alla chiusura delle iscrizioni, garantendo comunque il numero minimo di partite previsto.`;
      break;

    case "round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con sola andata, in cui ${entityEach} affronterà una sola volta ${entityOthersGroup}. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per ${entityWinnerDirect}.`;
      teamsInfoText = `Il numero ${entityPluralArticle} partecipanti, ${entityPluralArticle} per girone e dei qualificati alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
      break;

    case "double_round_robin_finals":
      structureText = `Il torneo prevede una <strong>fase a gironi</strong>, seguita da una <strong>fase finale ad eliminazione diretta</strong>.`;
      phaseDetailsText = `Sono previsti gironi all'italiana con andata e ritorno, in cui ${entityEach} affronterà due volte ${entityOthersGroup}. La fase finale prevede invece scontri diretti in gara unica, con passaggio del turno per ${entityWinnerDirect}.`;
      teamsInfoText = `Il numero ${entityPluralArticle} partecipanti, ${entityPluralArticle} per girone e dei qualificati alla fase finale sarà definito alla chiusura delle iscrizioni, garantendo in ogni caso il numero minimo di partite previsto.`;
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
          <li><strong>${entityPluralLabel}:</strong> ${teamsInfoText}</li>
        </ul>
      </div>
    </div>
  `;
}











// ===============================
// 9g. BUILD MATCH FORMAT RULE (REGOLA 6)
// ===============================
function buildMatchFormatRule(tournament, ruleNumber) {
  const formatType        = String(tournament.format_type        || "").toLowerCase();
  const hasFinals         = formatType.includes("finals");
  const sport             = String(tournament.sport              || "").toLowerCase();
  const isIndividual      = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();
  const matchFormatFinals = String(tournament.match_format_finals || "na").toLowerCase();
  const guaranteedMatch   = toNum(tournament.guaranteed_match, 0);
  const timeIncrement     = String(tournament.time_increment_seconds || "NA");

  const isFootball       = /calcio|calcetto|futsal/i.test(sport);
  const isPadel          = /padel/i.test(sport);
  const isVolley         = /volley|beach/i.test(sport);
  const isChess          = /scacchi|chess/i.test(sport);

  // =====================================================
  // COSTANTI ADATTIVE
  // =====================================================

  const entitySingular = isIndividual ? "giocatore" : "squadra";
  const entityPlural   = isIndividual ? "giocatori" : "squadre";

  const eachRegisteredEntity = isIndividual
    ? "ogni giocatore iscritto"
    : "ogni squadra iscritta";

  const allTournamentMatchesLabel = hasFinals
    ? "gironi e fasi finali"
    : "torneo";

  // =====================================================
  // HELPERS: PARSING DEL FORMATO NxM
  // =====================================================

  function parseTimeFormat(str) {
    const match = str.match(/^(\d+)x(\d+)$/);
    if (!match) return null;
    return { periods: Number(match[1]), minutes: Number(match[2]) };
  }

  function parseChessFormat(str) {
    const match = str.match(/^1x(\d+)$/);
    if (!match) return null;
    return { minutes: Number(match[1]) };
  }

  // =====================================================
  // BUILDERS PER SPORT
  // =====================================================

  function buildFootballFormatText(str) {
    const parsed = parseTimeFormat(str);
    if (!parsed) return "da comunicare";

    const { periods, minutes } = parsed;
    const total = periods * minutes;

    if (periods === 1) {
      return `un tempo unico da <strong>${minutes} minuti</strong> (al termine vince la squadra che ha segnato più gol)`;
    }

    return `${periods} tempi da <strong>${minutes} minuti</strong> ciascuno, per un totale di ${total} minuti (al termine vince la squadra che ha segnato più gol)`;
  }

  function buildChessFormatText(str) {
    const parsed = parseChessFormat(str);
    if (!parsed) return "da comunicare";

    const { minutes } = parsed;
    const timeControl =
      minutes < 3 ? "Bullet" :
      minutes <= 10 ? "Blitz" :
      minutes <= 60 ? "Rapid" :
      "Classical";

    let text = `ogni giocatore avrà a disposizione <strong>${minutes} minuti</strong> di tempo (${timeControl})`;

    if (timeIncrement && timeIncrement !== "NA" && !isNaN(Number(timeIncrement))) {
      text += ` con un incremento Fischer di <strong>${timeIncrement} secondi</strong> per mossa`;
    }

    return text;
  }

  function buildPadelFormatText(str) {
    const parsed = parseTimeFormat(str);
    if (parsed) {
      const { periods, minutes } = parsed;

      if (periods === 1) {
        return `un tempo unico da <strong>${minutes} minuti</strong> (al termine vince la coppia con più game vinti)`;
      }

      return `${periods} tempi da <strong>${minutes} minuti</strong> ciascuno (al termine vince la coppia con più game vinti)`;
    }

    return buildSetBasedFormatText(str) || "da comunicare";
  }

  function buildVolleyFormatText(str) {
    const parsed = parseTimeFormat(str);
    if (parsed) {
      const { periods, minutes } = parsed;

      if (periods === 1) {
        return `un tempo unico da <strong>${minutes} minuti</strong> (al termine vince la squadra con più punti segnati)`;
      }

      return `${periods} tempi da <strong>${minutes} minuti</strong> ciascuno (al termine vince la squadra con più punti segnati)`;
    }

    return buildSetBasedFormatText(str) || "da comunicare";
  }

  function buildSetBasedFormatText(str) {
    const setMap = {
      "1su1": "set singolo <strong>(vince chi si aggiudica il set)</strong>",
      "2su3": "al meglio dei 3 set <strong>(vince chi si aggiudica per primo 2 set)</strong>",
      "3su5": "al meglio dei 5 set <strong>(vince chi si aggiudica per primo 3 set)</strong>"
    };
    return setMap[str] || null;
  }

  // =====================================================
  // DISPATCHER PRINCIPALE
  // =====================================================

  function buildFormatText(str) {
    if (isChess)    return buildChessFormatText(str);
    if (isFootball) return buildFootballFormatText(str);
    if (isPadel)    return buildPadelFormatText(str);
    if (isVolley)   return buildVolleyFormatText(str);

    const parsed = parseTimeFormat(str);
    if (parsed) {
      const { periods, minutes } = parsed;
      return periods === 1
        ? `un tempo unico da <strong>${minutes} minuti</strong>`
        : `${periods} tempi da <strong>${minutes} minuti</strong> ciascuno`;
    }

    return buildSetBasedFormatText(str) || "da comunicare";
  }

  // =====================================================
  // NOTA AGGIUNTIVA SUL FORMATO
  // =====================================================

  function buildFormatNote(str) {
    const isSetBased = ["1su1", "2su3", "3su5"].includes(str);

    if (isChess) {
      return ` <em>In caso di patta (pareggio), entrambi i giocatori ricevono 0,5 punti.</em>`;
    }

    if (isSetBased) {
      return ` <em>In questo formato non sono previsti pareggi.</em>`;
    }

    return "";
  }

  // =====================================================
  // TESTI FINALI
  // =====================================================

  const matchFormatGironiText = buildFormatText(matchFormatGironi);
  const matchFormatFinalsText = buildFormatText(matchFormatFinals);

  const formatsCoincide =
    hasFinals &&
    matchFormatGironi &&
    matchFormatFinals !== "na" &&
    matchFormatGironi === matchFormatFinals;

  let guaranteedText = guaranteedMatch > 0
    ? `${eachRegisteredEntity.charAt(0).toUpperCase() + eachRegisteredEntity.slice(1)} ha diritto a disputare almeno <strong>${guaranteedMatch} ${guaranteedMatch === 1 ? "partita" : "partite"}</strong>, indipendentemente dai risultati ottenuti.`
    : `Il numero di partite effettivamente disputate da ciascun${isIndividual ? " giocatore" : "a squadra"} dipenderà dal formato del torneo e dai risultati ottenuti.`;

  let gironiFormatText = "";
  let finalsFormatText = "";

  if (hasFinals && formatsCoincide) {
    gironiFormatText = `Le partite di <strong>${allTournamentMatchesLabel}</strong> si disputeranno con la seguente formula: ${matchFormatGironiText}.`;
    gironiFormatText += buildFormatNote(matchFormatGironi);
    finalsFormatText = "";
  } else {
    gironiFormatText = hasFinals
      ? `Le partite della fase a gironi si disputeranno con la seguente formula: ${matchFormatGironiText}.`
      : `Tutte le partite del torneo si disputeranno con la seguente formula: ${matchFormatGironiText}.`;

    gironiFormatText += buildFormatNote(matchFormatGironi);

    if (hasFinals) {
      if (matchFormatFinals !== "na") {
        finalsFormatText = `Le partite delle fasi finali si disputeranno con la seguente formula: ${matchFormatFinalsText}.`;
        finalsFormatText += buildFormatNote(matchFormatFinals);
      } else {
        finalsFormatText = `Il formato delle partite delle fasi finali sarà comunicato al termine della fase a gironi.`;
      }
    }
  }

  // --- FORFEIT ---
  let forfeitResultText = "";
  if (isChess) {
    forfeitResultText = `una sconfitta a tavolino con punteggio <strong>0</strong> per il ${entitySingular} assente`;
  } else if (isFootball) {
    forfeitResultText = "una sconfitta a tavolino per <strong>3-0</strong>";
  } else if (isPadel || isVolley) {
    const isSetBased = ["1su1", "2su3", "3su5"].includes(matchFormatGironi);
    forfeitResultText = isSetBased
      ? "una sconfitta a tavolino per <strong>2 set a 0</strong> (6-0, 6-0)"
      : "una sconfitta a tavolino per <strong>6 game a 0</strong>";
  } else {
    forfeitResultText = "una sconfitta a tavolino secondo il regolamento del torneo";
  }

  const articleEntity = isChess || isIndividual ? `un ${entitySingular}` : `una ${entitySingular}`;
  const forfeitText = `In assenza di preavviso, la mancata presentazione di ${articleEntity} a una partita comporterà ${forfeitResultText}.`;

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Formato delle partite</strong></p>
        <ul>
          <li><strong>Partite garantite:</strong> ${guaranteedText}</li>
          <li><strong>${hasFinals && formatsCoincide ? "Formato partite" : "Formato gironi"}:</strong> ${gironiFormatText}</li>
          ${finalsFormatText ? `<li><strong>Formato finali:</strong> ${finalsFormatText}</li>` : ""}
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
  const sport         = String(tournament.sport              || "").toLowerCase();
  const formatType    = String(tournament.format_type        || "").toLowerCase();
  const hasFinals     = formatType.includes("finals");
  const matchFormatGironi = String(tournament.match_format_gironi || "").toLowerCase();
  const pointSystem   = String(tournament.point_system       || "").toLowerCase();
  const tieStandingGironi = String(tournament.tie_standing_gironi_criteria || "").toLowerCase();
  const isIndividual  = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const isGameBasedSport = sport.includes("padel") || sport.includes("volley") || sport.includes("beach");
  const isSetBased    = ["1su1", "2su3", "3su5"].includes(matchFormatGironi);
  const isChess       = sport.includes("scacchi") || sport.includes("chess");

  const entityPlural   = isIndividual ? 'giocatori' : 'squadre';
  const entitySingular = isIndividual ? 'giocatore'  : 'squadra';

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

  let terminology;
  if (isSetBased) {
    terminology = { scoreType: "set", forLabel: "set vinti", againstLabel: "set persi", diffLabel: "differenza set", secondaryForLabel: "game vinti", secondaryDiffLabel: "differenza game" };
  } else if (isGameBasedSport) {
    terminology = { scoreType: "game", forLabel: "game vinti", againstLabel: "game subiti", diffLabel: "differenza game" };
  } else {
    terminology = { scoreType: "gol", forLabel: "gol fatti", againstLabel: "gol subiti", diffLabel: "differenza reti" };
  }

  let sameGroupText;
  if (isChess) {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>Scontri diretti</strong> (punti negli scontri tra i ${entityPlural} a pari punti)</li><li><strong>Partita di spareggio</strong> in caso di parità persistente</li></ul>`;
  } else if (isSetBased) {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>Scontri diretti</strong> (punti, differenza set, differenza game)</li><li><strong>Differenza set</strong> generale</li><li><strong>Set vinti</strong> totali</li><li><strong>Differenza game</strong> generale</li><li><strong>Game vinti</strong> totali</li></ul>`;
  } else {
    sameGroupText = `In caso di parità di punti tra due o più ${entityPlural} dello stesso girone, l'ordine sarà determinato dai seguenti criteri (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>Scontri diretti</strong> (punti, ${terminology.diffLabel}, ${terminology.forLabel})</li><li><strong>${capitalizeFirst(terminology.diffLabel)}</strong> generale</li><li><strong>${capitalizeFirst(terminology.forLabel)}</strong> totali</li></ul>`;
  }

  let crossGroupText;
  if (hasFinals) {
    if (isChess) {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. per determinare migliori secondi), in caso di parità di punti si useranno (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>Punti totali</strong> nel girone</li><li><strong>Sorteggio</strong> in caso di parità persistente</li></ul>`;
    } else if (isSetBased) {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. per determinare migliori seconde), in caso di parità di punti si useranno (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>Differenza set</strong></li><li><strong>Set vinti</strong></li><li><strong>Differenza game</strong></li><li><strong>Game vinti</strong></li></ul>`;
    } else {
      crossGroupText = `Per confrontare ${entityPlural} di gironi diversi (es. per determinare migliori seconde), in caso di parità di punti si useranno (in ordine di priorità):<ul style="margin-top:8px;margin-bottom:0;padding-left:20px;"><li><strong>${capitalizeFirst(terminology.diffLabel)}</strong></li><li><strong>${capitalizeFirst(terminology.forLabel)}</strong></li></ul>`;
    }
  } else {
    crossGroupText = `Essendo un girone unico, non sarà necessario confrontare ${entityPlural} di gironi diversi.`;
  }

  const tieStandingMap = { "moneta": "tramite lancio della moneta", "spareggio": "tramite una partita di spareggio", "sorteggio": "tramite sorteggio" };
  const tieStandingText = tieStandingMap[tieStandingGironi] || "";
  const persistentTieText = tieStandingText
    ? `Se, dopo l'applicazione di tutti i criteri, dovesse persistere una situazione di parità, questa verrà risolta ${tieStandingText}.`
    : `In caso di parità persistente dopo l'applicazione di tutti i criteri, la modalità di risoluzione sarà comunicata dall'organizzazione.`;

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

  // =====================================================
  // PARSING SISTEMA PUNTI
  // =====================================================

  function parsePointSystem(str) {
    const parts = String(str || "").split("-");
    if (parts.length !== 3) return null;
    const win  = Number(parts[0]);
    const draw = Number(parts[1]);
    const loss = Number(parts[2]);
    if ([win, draw, loss].some(isNaN)) return null;
    return { win, draw, loss };
  }

  const pointSystem = parsePointSystem(tournament.point_system);
  const drawPoints  = pointSystem ? pointSystem.draw : null;

  const drawPointsText = drawPoints !== null
    ? `<strong>${drawPoints} ${drawPoints === 1 ? 'punto' : 'punti'}</strong> per ogni ${entitySingular}`
    : `i punti previsti dal regolamento per ogni ${entitySingular}`;

  // =====================================================
  // FORMATO A SET
  // =====================================================

  const setFormats = ["1su1", "2su3", "3su5"];
  const isSetBasedGironi = setFormats.includes(matchFormatGironi);
  const isSetBasedFinals = setFormats.includes(matchFormatFinals);

  // =====================================================
  // MAPPING BASE (RISCRITTO IN MODO PIÙ NATURALE)
  // =====================================================

  const tieMatchMap = {
    "tie_accettato": `il pareggio è un risultato valido: verranno assegnati ${drawPointsText}`,
    "moneta":        `in caso di parità al termine del tempo regolamentare, il vincitore sarà determinato tramite lancio della moneta`,
    "rigori":        `in caso di parità al termine del tempo regolamentare, si procederà con i calci di rigore`,
    "tiebreak":      `in caso di parità al termine del tempo regolamentare, si disputerà un tiebreak decisivo`,
    "spareggio":     `in caso di parità al termine del tempo regolamentare, si disputerà una partita supplementare di spareggio`
  };

  // =====================================================
  // FASE GIRONI
  // =====================================================

  let gironiTieText;

  if (isChess) {
    gironiTieText = `La patta è un risultato valido: in caso di pareggio, a ciascun ${entitySingular} verranno assegnati <strong>0,5 punti</strong>.`;
  } else if (isSetBasedGironi) {
    gironiTieText = `Il formato a set non prevede pareggi: ogni partita determina sempre una ${entitySingular} vincitrice.`;
  } else {
    const text = tieMatchMap[tieMatchGironi] || "la modalità di gestione dei pareggi sarà comunicata dall'organizzazione";
    gironiTieText = `${text}.`;
  }

  // =====================================================
  // FASE FINALE
  // =====================================================

  let finalsTieText;

  if (!hasFinals) {
    finalsTieText = `Poiché non è prevista una fase finale, la regola sopra descritta si applica a tutte le partite del torneo.`;
  } else if (isChess) {
    const text = tieMatchMap[tieMatchFinals] || "la modalità sarà comunicata dall'organizzazione";
    finalsTieText = `Nelle fasi finali è necessario determinare un vincitore: ${text}.`;
  } else if (isSetBasedFinals) {
    finalsTieText = `Anche nelle fasi finali, il formato a set non prevede pareggi: ogni partita determina una ${entitySingular} vincitrice.`;
  } else if (tieMatchGironi === tieMatchFinals) {
    finalsTieText = `Nelle fasi finali si applicherà la <strong>stessa regola</strong> prevista per la fase a gironi.`;
  } else {
    const text = tieMatchMap[tieMatchFinals] || "la modalità sarà comunicata dall'organizzazione";
    finalsTieText = `${text}.`;
  }

  // =====================================================
  // OUTPUT
  // =====================================================

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Gestione dei pareggi</strong></p>
        <ul>
          <li><strong>Fase a gironi:</strong> ${gironiTieText}</li>
          <li><strong>Fasi finali:</strong> ${finalsTieText}</li>
        </ul>
      </div>
    </div>
  `;
}



// ===============================
// 9j. REFEREE RULE (REGOLA 9)
// ===============================
function buildRefereeRule(tournament, ruleNumber) {
  // FIX BUG 2: toBool per referee
  const hasReferee   = toBool(tournament.referee);
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  const entityPlural      = isIndividual ? 'I partecipanti'  : 'Le squadre';
  const entityPluralLower = isIndividual ? 'i partecipanti'  : 'le squadre';

  let ruleText = "";
  if (hasReferee) {
    ruleText = `<p>Per tutte le partite del torneo, l'organizzazione provvederà a designare un <strong>arbitro ufficiale</strong> che sarà presente in campo per garantire il corretto svolgimento della gara.</p><p>Le decisioni arbitrali sono <strong>insindacabili</strong> e vincolanti per entrambe le squadre.</p>`;
  } else {
    ruleText = `<p>Le partite di questo torneo seguono la formula dell'<strong>auto-arbitraggio</strong>.</p><p>${entityPlural} sono tenuti a <strong>rispettare le regole del gioco</strong> e a <strong>risolvere eventuali controversie in modo sportivo e rispettoso</strong>, nel pieno spirito del fair play.</p><p>In caso di dispute irrisolvibili, ${entityPluralLower} potranno contattare l'organizzazione, che valuterà la situazione e adotterà i provvedimenti necessari.</p>`;
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
  // FIX BUG 1: toBool per insurance_included
  if (!toBool(tournament.insurance_included)) return "";

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Copertura assicurativa e certificato medico</strong></p>
        <p>Per questo torneo, l'organizzazione provvederà ad attivare una <strong>copertura assicurativa contro gli infortuni</strong> a favore dei partecipanti.</p>
        <p>La copertura assicurativa sarà valida esclusivamente per gli atleti in possesso di <strong>certificato medico (agonistico o non agonistico) in corso di validità</strong>. In assenza di certificato valido, eventuali infortuni non saranno coperti.</p>
      </div>
    </div>
  `;
}




// ===============================
// 9l. BUILD FACILITIES RULE (REGOLA 11)
// ===============================
function buildFacilitiesRule(tournament, ruleNumber) {
  const food      = String(tournament.food       || "none").toLowerCase();
  const upsell    = String(tournament.upsell     || "none").toLowerCase();
  const palla     = String(tournament.palla      || "false").toLowerCase();
  const racket    = String(tournament.racket     || "na").toLowerCase();
  const sport     = String(tournament.sport      || "").toLowerCase();
  const boardCron = String(tournament.board_cron || "na").toLowerCase();

  const isRacketSport    = sport.includes("padel") || sport.includes("tennis");
  const ballTerminology  = isRacketSport ? "le palline" : "i palloni";

  const items = [];

  const foodMap = {
    all_all:       "Pranzo/Cena offerto dall'organizzazione durante il torneo.",
    all_finals:    "Pranzo/Cena offerto dall'organizzazione durante la fase finale del torneo.",
    partial_all:   "Snack e bevande offerte dall'organizzazione durante il torneo.",
    partial_finals:"Snack e bevande offerte dall'organizzazione durante la fase finale del torneo.",
    none: null
  };
  if (foodMap[food]) items.push(`<li><strong>Ristoro:</strong> ${foodMap[food]}</li>`);

  if (palla !== "na") {
    const pallaMap = {
      true_all:    `L'organizzazione fornirà <strong>${ballTerminology}</strong> per tutte le partite del torneo.`,
      true_finals: `L'organizzazione fornirà <strong>${ballTerminology}</strong> per le partite della fase finale.`,
      false: null
    };
    if (pallaMap[palla]) items.push(`<li><strong>Materiale di gioco:</strong> ${pallaMap[palla]}</li>`);
  }

  if (boardCron !== "na" && boardCron !== "false") {
    const boardCronMap = {
      true_all:    "L'organizzazione fornirà <strong>scacchiere e cronometri professionali</strong> per tutte le partite del torneo.",
      true_finals: "L'organizzazione fornirà <strong>scacchiere e cronometri professionali</strong> per le partite della fase finale."
    };
    if (boardCronMap[boardCron]) items.push(`<li><strong>Scacchiere e cronometri:</strong> ${boardCronMap[boardCron]}</li>`);
  }

  if (isRacketSport) {
    const racketMap = {
      true_all:    "Saranno messe a disposizione racchette per tutta la durata del torneo, per chi ne avesse necessità.",
      true_finals: "Saranno messe a disposizione racchette durante le partite della fase finale, per chi ne avesse necessità.",
      na: null
    };
    if (racketMap[racket]) items.push(`<li><strong>Racchette:</strong> ${racketMap[racket]}</li>`);
  }

  const upsellMap = {
    kit_all:        { kit: "Durante il torneo, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.", photo: null },
    kit_finals:     { kit: "Durante le partite della fase finale, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.", photo: null },
    photo_all:      { kit: null, photo: "Durante tutte le partite del torneo, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti." },
    photo_finals:   { kit: null, photo: "Durante le partite della fase finale, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti." },
    kit_photo_all:  { kit: "Durante il torneo, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.", photo: "Durante tutte le partite del torneo, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti." },
    kit_photo_finals:{ kit: "Durante le partite della fase finale, sarà possibile acquistare un kit sportivo ufficiale \"Tornei ICE\" a prezzo di costo.", photo: "Durante le partite della fase finale, saranno presenti fotografi ufficiali. Foto e video delle partite saranno resi disponibili gratuitamente a tutti i partecipanti." },
    none: { kit: null, photo: null }
  };
  const upsellData = upsellMap[upsell] || upsellMap.none;
  if (upsellData.kit)   items.push(`<li><strong>Kit ufficiale:</strong> ${upsellData.kit}</li>`);
  if (upsellData.photo) items.push(`<li><strong>Foto e video:</strong> ${upsellData.photo}</li>`);

  if (items.length === 0) return null;

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Servizi e iniziative durante il torneo</strong></p>
        <ul>${items.join('\n')}</ul>
      </div>
    </div>
  `;
}





// ===============================
// 9m. BUILD REFUND RULE (RIMBORSI)
// ===============================
function buildRefundRule(ruleNumber) {

  const refundIntro = `Faremo <strong>sempre</strong> tutto il possibile per garantire che il torneo si svolga senza problemi. Ma nel caso in cui, per qualsiasi motivazione, il torneo venga annullato, l'organizzazione <strong>rimborserà l'intera quota di iscrizione</strong> a tutti i partecipanti.`; 

  const refundDetails = `Il rimborso avverrà <strong>entro 24 ore</strong> dall'annullamento, utilizzando lo stesso metodo di pagamento tramite cui è stata effettuata l'iscrizione.`; 

  return `
    <div class="specific-regulation-card">
      <div class="specific-regulation-icon">${ruleNumber}</div>
      <div class="specific-regulation-content">
        <p><strong>Rimborso in caso di annullamento del torneo</strong></p>
        <ul>
          <li>${refundIntro}</li>
          <li>${refundDetails}</li>
          <li>${finalText}</li>
        </ul>
      </div>
    </div>
  `;
}




// ===============================
// 9n. BUILD COMMUNICATIONS RULE
// ===============================
function buildCommunicationsRule(tournament, ruleNumber) {
  const isIndividual       = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  // FIX BUG 3: toBool per certificate_required
  const certificateRequired = toBool(tournament.certificate_required);

  const introText        = `Tutte le comunicazioni ufficiali relative al torneo verranno inviate all'indirizzo email indicato in fase di iscrizione.`;
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
  const whatsappText   = `A iscrizioni chiuse, i partecipanti verranno inseriti in un gruppo WhatsApp ufficiale del torneo, gestito dall'organizzazione, per comunicazioni operative e trasmissione dei risultati.`;

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
// 9o. BUILD REFUNDS & MATCH MANAGEMENT RULE
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

  let hasExtraFields = false;

  // CAMPO 1: ZONA PREFERITA (solo se non fixed_all)
  if (fixed !== "fixed_all") {
    const zoneField = buildZoneField(tournament);
    container.appendChild(zoneField);
    hasExtraFields = true;
  }

  // CAMPO 2: GIORNI PREFERITI (solo se non fixed_all e non è un giorno singolo)
  if (fixed !== "fixed_all" && availableDays && !isSingleDay(availableDays)) {
    const daysField = buildDaysField(availableDays);
    container.appendChild(daysField);
    hasExtraFields = true;
  }

  // CAMPO 3: ORARIO PREFERITO (solo se non fixed_all e c'è un range di orari)
  if (fixed !== "fixed_all" && availableHours && availableHours !== "na") {
    const hoursField = buildHoursField(availableHours);
    if (hoursField) {
      container.appendChild(hoursField);
      hasExtraFields = true;
    }
  }

  // ✅ Salva riferimento al pannello di conferma PRIMA che configureFormSteps
  // ne modifichi il data-step (da "3" a "2" nel caso senza campi extra)
  const confirmPanel = document.querySelector('.form-step-panel[data-step="3"]');

  // Configura form a 2 o 3 step
  configureFormSteps(hasExtraFields);

  // Note aggiuntive vanno nel pannello di conferma (ora potrebbe avere data-step="2")
  if (confirmPanel) {
    const notesField = buildNotesField();
    const regulationDiv = confirmPanel.querySelector('.regulation-acceptance');
    if (regulationDiv) {
      confirmPanel.insertBefore(notesField, regulationDiv);
    } else {
      confirmPanel.appendChild(notesField);
    }
  }
}




// ===============================
// CONFGIURA STEPS
// ===============================
function configureFormSteps(hasExtraFields) {
  const step2Indicator = document.querySelector('.form-step[data-step="2"]');
  const step3Indicator = document.querySelector('.form-step[data-step="3"]');
  const step2Panel     = document.querySelector('.form-step-panel[data-step="2"]');
  const step3Panel     = document.querySelector('.form-step-panel[data-step="3"]');

  if (!step2Indicator || !step3Indicator || !step2Panel || !step3Panel) {
    console.warn('configureFormSteps: elementi step non trovati nel DOM', {
      step2Indicator, step3Indicator, step2Panel, step3Panel
    });
    totalSteps = 2;
    currentStep = 1;
    updateStepUI(true); // ← solo inizializzazione: niente scroll
    return;
  }

  if (hasExtraFields) {
    step2Indicator.style.display = "";
    step2Indicator.dataset.step = "2";

    step3Indicator.style.display = "";
    step3Indicator.dataset.step = "3";
    step3Indicator.querySelector('.step-number').textContent = "3";

    step2Panel.style.display = "";
    step2Panel.dataset.step = "2";

    step3Panel.style.display = "";
    step3Panel.dataset.step = "3";

    totalSteps = 3;
  } else {
    step2Indicator.style.display = "none";
    step2Indicator.dataset.step = "hidden";

    step2Panel.style.display = "none";
    step2Panel.dataset.step = "hidden";

    step3Indicator.style.display = "";
    step3Indicator.dataset.step = "2";
    step3Indicator.querySelector('.step-number').textContent = "2";

    step3Panel.style.display = "";
    step3Panel.dataset.step = "2";

    totalSteps = 2;
  }

  currentStep = 1;
  updateStepUI(true); // ← solo inizializzazione: niente scroll
}




// ===============================
// 20b. CHECK IF SINGLE DAY
// ===============================
function isSingleDay(days) {
  const singleDays = ["lun", "mar", "mart", "mer", "merc", "gio", "giov", "ven", "sab", "dom"];
  return singleDays.includes(days.toLowerCase().trim());
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
  titleSpan.textContent = 'Zona preferita';
  wrapper.appendChild(titleSpan);

  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Indica la zona di ${location} e dintorni dove preferisci giocare le partite in casa (facoltativo)`;
  wrapper.appendChild(helperSpan);

  const input = document.createElement("input");
  input.type = "text";
  input.name = "preferred_zone";
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

  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.textContent = 'Giorni preferiti';
  wrapper.appendChild(titleSpan);

  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = 'Seleziona i giorni in cui preferisci giocare le partite in casa (facoltativo)';
  wrapper.appendChild(helperSpan);

  const checkboxGroup = document.createElement("div");
  checkboxGroup.className = "checkbox-group";

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
 
  // Se non ci sono slot (range < 2 ore) non mostrare il campo
  if (slots.length === 0) return null;
 
  // Se c'è un solo slot non ha senso mostrare una select con una sola opzione
  // ma la creiamo comunque perché handleFormSubmit cerca hoursSelect
  const wrapper = document.createElement("label");
 
  const titleSpan = document.createElement("span");
  titleSpan.className = "form-field-title";
  titleSpan.textContent = 'Fascia oraria preferita';
  wrapper.appendChild(titleSpan);
 
  const { start, end } = parseHoursRange(availableHours);
  const helperSpan = document.createElement("span");
  helperSpan.className = "field-helper";
  helperSpan.textContent = `Scegli la fascia oraria preferita (partite disponibili dalle ${String(start).padStart(2,'0')}:00 alle ${String(end).padStart(2,'0')}:00) (facoltativo)`;
  wrapper.appendChild(helperSpan);
 
  const select = document.createElement("select");
  select.name = "preferred_hours";
  select.id = "hours-select"; // ✅ id per poterlo trovare nel submit
 
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
    { value: "lun",  label: "Lunedì"    },
    { value: "mar",  label: "Martedì"   },
    { value: "mer",  label: "Mercoledì" },
    { value: "gio",  label: "Giovedì"   },
    { value: "ven",  label: "Venerdì"   },
    { value: "sab",  label: "Sabato"    },
    { value: "dom",  label: "Domenica"  }
  ];

  // Mappa sinonimi → indice in allDays
  const dayIndex = {
    lun:  0,
    mar:  1, mart: 1,
    mer:  2, merc: 2,
    gio:  3, giov: 3,
    ven:  4,
    sab:  5,
    dom:  6
  };

  // Shortcut per range comuni
  const shortcuts = {
    "lun-dom": allDays,
    "lun-ven": allDays.slice(0, 5),
    "sab-dom": allDays.slice(5, 7),
    "ven-dom": allDays.slice(4, 7)
  };

  const raw = range.toLowerCase().trim();

  if (shortcuts[raw]) return shortcuts[raw];

  // Range generico: "lun-giov", "mer-dom", "lun-merc", ecc.
  if (raw.includes("-")) {
    const [start, end] = raw.split("-");
    const si = dayIndex[start];
    const ei = dayIndex[end];
    if (si !== undefined && ei !== undefined && ei >= si) {
      return allDays.slice(si, ei + 1);
    }
  }

  // Giorno singolo (fallback difensivo — normalmente intercettato da isSingleDay)
  const idx = dayIndex[raw];
  if (idx !== undefined) return [allDays[idx]];

  // Fallback: tutti i giorni
  return allDays;
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
  const rangeLower = String(range || '').toLowerCase().trim();
  const parts = rangeLower.split("-");
 
  if (parts.length !== 2) {
    return { start: 10, end: 22 };
  }
 
  const start = parseInt(parts[0], 10);
  const end   = parseInt(parts[1], 10);
 
  if (isNaN(start) || isNaN(end)) {
    return { start: 10, end: 22 };
  }
 
  // Clamp: start tra 0 e 23, end tra 1 e 24
  const clampedStart = Math.max(0,  Math.min(start, 23));
  const clampedEnd   = Math.max(1,  Math.min(end,   24));
 
  return { start: clampedStart, end: clampedEnd };
}

// ===============================
// 26. PARSE HOURS SLOTS (DINAMICO)
// ✅ MODIFICATO: Gestisce correttamente range piccoli
// ===============================
function parseHoursSlots(range) {
  const { start, end } = parseHoursRange(range);
 
  const totalHours = end - start;
 
  // Range troppo piccolo → nessuno slot
  if (totalHours < 1) {
    return [];
  }
 
  const slotNames = {
    0:  "Notte",
    1:  "Notte",
    2:  "Notte",
    3:  "Notte",
    4:  "Prima mattina",
    5:  "Prima mattina",
    6:  "Prima mattina",
    7:  "Prima mattina",
    8:  "Mattina",
    9:  "Mattina",
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
    22: "Tarda serata",
    23: "Tarda serata"
  };
 
  // Se il range è esattamente 1 ora → un unico slot (edge case)
  if (totalHours === 1) {
    const startStr = String(start).padStart(2, '0');
    const endStr   = String(end).padStart(2, '0');
    return [{
      value: `${start}-${end}`,
      label: `${slotNames[start] || 'Fascia'} (${startStr}:00 - ${endStr}:00)`
    }];
  }
 
  const slots = [];
  const SLOT_DURATION = 2; // slot fissi da 2 ore
  let currentStart = start;
 
  while (currentStart + SLOT_DURATION <= end) {
    const slotEnd  = currentStart + SLOT_DURATION;
    const startStr = String(currentStart).padStart(2, '0');
    const endStr   = String(slotEnd).padStart(2, '0');
 
    slots.push({
      value: `${currentStart}-${slotEnd}`,
      label: `${slotNames[currentStart] || 'Fascia'} (${startStr}:00 - ${endStr}:00)`
    });
 
    currentStart = slotEnd;
  }
 
  // Gap finale (es. range dispari come 19-24 → dopo 19-21, 21-23 rimane 23-24)
  // Lo includiamo solo se è esattamente 1 ora (altrimenti non si verifica mai
  // con slot da 2h e range interi)
  if (currentStart < end) {
    const startStr = String(currentStart).padStart(2, '0');
    const endStr   = String(end).padStart(2, '0');
    slots.push({
      value: `${currentStart}-${end}`,
      label: `${slotNames[currentStart] || 'Fascia'} (${startStr}:00 - ${endStr}:00)`
    });
  }
 
  return slots;
}
 


// ===============================
// 27. SUBMIT ISCRIZIONE (FIREBASE)
// ===============================
let isSubmitting = false;

let duplicateNameConfirmationState = {
  needsConfirmation: false,
  confirmed: false,
  existingTournaments: []
};

// ===============================
// HELPER: reset warning stesso nome in altro torneo
// ===============================
function resetDuplicateNameConfirmation() {
  duplicateNameConfirmationState = {
    needsConfirmation: false,
    confirmed: false,
    existingTournaments: []
  };

  const existingBox = document.getElementById("duplicate-teamname-warning");
  if (existingBox) existingBox.remove();
}

// ===============================
// HELPER: render warning stesso nome in altro torneo
// ===============================
function renderDuplicateNameConfirmationBox(existingTournaments = []) {
  const step1Panel = document.querySelector('.form-step-panel[data-step="1"]');
  if (!step1Panel) return;

  const existingBox = document.getElementById("duplicate-teamname-warning");
  if (existingBox) existingBox.remove();

  const isIndividual = currentTournamentData?.individual_or_team?.toLowerCase() === 'individual';

  const wrapper = document.createElement("div");
  wrapper.id = "duplicate-teamname-warning";
  wrapper.className = "duplicate-teamname-warning";
  
  const tournamentsText = Array.isArray(existingTournaments) && existingTournaments.length > 0
    ? `<ul class="duplicate-teamname-warning-list">
         ${existingTournaments.map(t => `<li>${escapeHTML(t.tournament_name || t.tournament_id || "")}</li>`).join("")}
       </ul>`
    : "";

  wrapper.innerHTML = `
    <div class="duplicate-teamname-warning-inner">
      <div class="duplicate-teamname-warning-title">
        ⚠️ ${isIndividual ? "Nome già usato in un altro torneo dello stesso sport" : "Nome squadra già usato in un altro torneo dello stesso sport"}
      </div>
      <div class="duplicate-teamname-warning-text">
        ${
          isIndividual
            ? "Abbiamo trovato questo nome in un altro torneo dello stesso sport. Se sei davvero tu e vuoi usare di nuovo questo nome, puoi confermarlo qui sotto. Altrimenti modifica il nome."
            : "Abbiamo trovato una squadra con questo nome in un altro torneo dello stesso sport. Se siete davvero voi e volete usare di nuovo questo nome, potete confermarlo qui sotto. Altrimenti cambiate nome squadra."
        }
        ${tournamentsText}
      </div>
      <label class="duplicate-teamname-warning-checkbox">
        <input type="checkbox" id="confirm-same-team-name-other-tournament">
        <span>
          ${
            isIndividual
              ? "Confermo che avevo già partecipato a un altro torneo dello stesso sport con questo stesso nome"
              : "Confermo che la mia squadra aveva già partecipato a un altro torneo dello stesso sport con questo stesso nome"
          }
        </span>
      </label>
    </div>
  `;

  const teamNameField = step1Panel.querySelector('[name="team_name"]')?.closest("label, .form-field-wrapper, .field-optional") 
    || step1Panel.querySelector('[name="team_name"]');

  if (teamNameField && teamNameField.parentNode) {
    teamNameField.parentNode.insertBefore(wrapper, teamNameField.nextSibling);
  } else {
    step1Panel.appendChild(wrapper);
  }

  const checkbox = wrapper.querySelector('#confirm-same-team-name-other-tournament');
  if (checkbox) {
    checkbox.checked = !!duplicateNameConfirmationState.confirmed;
    checkbox.addEventListener('change', function () {
      duplicateNameConfirmationState.confirmed = this.checked;
    });
  }
}

// ===============================
// HELPER: applica risposta checkTeamName
// ===============================
function applyTeamNameCheckResult(checkData) {
  if (!checkData || typeof checkData !== "object") {
    resetDuplicateNameConfirmation();
    return true;
  }

  if (checkData.exact_duplicate_in_same_tournament === true || checkData.available === false) {
    resetDuplicateNameConfirmation();

    const isIndividual = currentTournamentData?.individual_or_team?.toLowerCase() === 'individual';
    showToast(
      isIndividual
        ? "Nome già in uso in questo torneo. Prova a modificarlo leggermente. ⚠️"
        : "Nome squadra già in uso in questo torneo. Prova con un altro nome. ⚠️"
    );
    return false;
  }

  if (checkData.duplicate_in_same_sport_other_tournament === true) {
    const wasAlreadyConfirmed =
      duplicateNameConfirmationState.needsConfirmation === true &&
      duplicateNameConfirmationState.confirmed === true;

    duplicateNameConfirmationState = {
      needsConfirmation: true,
      confirmed: wasAlreadyConfirmed,
      existingTournaments: Array.isArray(checkData.existing_tournaments)
        ? checkData.existing_tournaments
        : []
    };

    renderDuplicateNameConfirmationBox(duplicateNameConfirmationState.existingTournaments);

    // Se l'utente aveva già confermato, lo lasciamo proseguire
    if (duplicateNameConfirmationState.confirmed) {
      return true;
    }

    showToast("Nome già presente in un altro torneo dello stesso sport: conferma oppure cambia nome ⚠️");
    return false;
  }

  resetDuplicateNameConfirmation();
  return true;
}


 
function handleFormSubmit(tournament) {
  const isIndividual = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';

  if (form.dataset.submitHandlerAttached === "true") return;
  form.dataset.submitHandlerAttached = "true";
 
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
 
    if (isSubmitting) return;
 
    const acceptRegulation = form.querySelector('input[name="accept_regulation"]');
    if (!acceptRegulation || !acceptRegulation.checked) {
      showToast("Devi accettare il regolamento per iscriverti ⚠️");
      return;
    }

    const teamNameValue = form.querySelector('[name="team_name"]').value.trim();

    // Se esiste warning stesso nome in altro torneo, serve checkbox spuntata
    if (duplicateNameConfirmationState.needsConfirmation && !duplicateNameConfirmationState.confirmed) {
      showToast(
        isIndividual
          ? "Conferma prima che si tratta davvero dello stesso nome usato da te in un altro torneo ⚠️"
          : "Conferma prima che si tratta davvero dello stesso nome squadra usato in un altro torneo ⚠️"
      );
      return;
    }
 
    const payload = {
      tournament_id: tournament.tournament_id,
      team_name:     teamNameValue,
      email:         form.querySelector('[name="email"]').value.trim().toLowerCase(),
      phone:         form.querySelector('[name="phone"]').value.trim(),
      confirm_same_team_name_other_tournament:
        duplicateNameConfirmationState.needsConfirmation && duplicateNameConfirmationState.confirmed
    };
 
    const zoneInput = form.querySelector('[name="preferred_zone"]');
    if (zoneInput && zoneInput.value.trim()) {
      payload.preferred_zone = zoneInput.value.trim();
    }
 
    const daysChecked = form.querySelectorAll('[name="preferred_days[]"]:checked');
    if (daysChecked.length > 0) {
      payload.preferred_days = Array.from(daysChecked).map(cb => cb.value).join(", ");
    }
 
    const hoursSelect = form.querySelector('[name="preferred_hours"]');
    if (hoursSelect && hoursSelect.value) {
      payload.preferred_hours = hoursSelect.value;
    }
 
    const notesTextarea = form.querySelector('[name="additional_notes"]');
    if (notesTextarea && notesTextarea.value.trim()) {
      payload.additional_notes = notesTextarea.value.trim();
    }
 
    isSubmitting = true;
 
    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs    = form.querySelectorAll("input, select, textarea, button");
 
    submitBtn.innerHTML = `<span class="spinner"></span> Iscrizione in corso...`;
    submitBtn.classList.add("disabled");
    submitBtn.disabled = true;
    inputs.forEach(input => input.disabled = true);
 
    try {
      const res = await fetch(API_URLS.submitSubscription, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      let responseData;
      if (isJson) {
        responseData = await res.json();
      } else {
        responseData = await res.text();
      }

      // ===== SUCCESS =====
      if (res.ok && responseData === "SUBSCRIPTION_SAVED") {
        showToast("Iscrizione completata 🎉");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }

      // ===== CASO SPECIALE: stesso nome in altro torneo stesso sport =====
      if (
        res.status === 409 &&
        isJson &&
        responseData?.error === "TEAM_NAME_ALREADY_USED_IN_OTHER_TOURNAMENT_SAME_SPORT" &&
        responseData?.requires_confirmation === true
      ) {
        duplicateNameConfirmationState = {
          needsConfirmation: true,
          confirmed: false,
          existingTournaments: Array.isArray(responseData.existing_tournaments)
            ? responseData.existing_tournaments
            : []
        };

        renderDuplicateNameConfirmationBox(duplicateNameConfirmationState.existingTournaments);
        showToast("Conferma il riutilizzo del nome squadra prima di inviare l'iscrizione ⚠️");
        restoreForm();
        return;
      }

      // ===== ERRORI TESTUALI CLASSICI =====
      const responseText = typeof responseData === "string" ? responseData : "";

      const errorMessages = {
        "TOURNAMENT_NOT_FOUND": "Torneo non valido ❌",
        "REGISTRATIONS_CLOSED": "Le iscrizioni sono chiuse ⚠️",
        "INVALID_DATA": "Dati mancanti o non validi ⚠️",
        "DUPLICATE_TEAM": isIndividual
          ? "Questo nome è già iscritto a questo torneo. Prova ad aggiungere un secondo nome, un'iniziale o un soprannome (es. 'Mario R.' o 'MarioTheKing') ⚠️"
          : "Una squadra con questo nome è già iscritta a questo torneo. Scegli un nome diverso ⚠️",
        "DUPLICATE_EMAIL": "Questa email è già stata utilizzata per questo torneo ⚠️",
        "DUPLICATE": "Questa email è già iscritta ⚠️"
      };
 
      if (errorMessages[responseText]) {
        showToast(errorMessages[responseText]);
        restoreForm();
        return;
      }
 
      console.error("Risposta inattesa:", responseData);
      showToast("Errore inatteso ❌");
      restoreForm();

    } catch (err) {
      console.error("Errore submit:", err);
      showToast("Errore di connessione ❌");
      restoreForm();
    }
 
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
let totalSteps = 3;

const panels = document.querySelectorAll(".form-step-panel");
const steps = document.querySelectorAll(".form-step");
const progressFill = document.querySelector(".form-progress-fill");

const nextBtn = document.querySelector(".step-next");
const prevBtn = document.querySelector(".step-prev");

function updateStepUI(skipScroll = false) {
  panels.forEach(panel => {
    panel.classList.remove("active");
  });

  const activePanel = document.querySelector(`.form-step-panel[data-step="${currentStep}"]`);
  if (activePanel) activePanel.classList.add("active");

  steps.forEach(step => {
    step.classList.remove("active");
  });

  const activeStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
  if (activeStep) activeStep.classList.add("active");

  if (totalSteps > 1) {
    progressFill.style.width = ((currentStep - 1) / (totalSteps - 1)) * 100 + "%";
  }

  prevBtn.style.visibility = currentStep === 1 ? "hidden" : "visible";
  nextBtn.style.display = currentStep === totalSteps ? "none" : "inline-flex";

  if (!skipScroll) {
    const formEl = document.querySelector("#registration-form");
    if (formEl && formEl.offsetParent !== null) {
      window.scrollTo({
        top: formEl.offsetTop - 200,
        behavior: "smooth"
      });
    }
  }
}

nextBtn.addEventListener("click", async () => {
  const currentPanel = document.querySelector(`.form-step-panel[data-step="${currentStep}"]`);
  const requiredFields = currentPanel.querySelectorAll("[required]");

  let valid = true;
  requiredFields.forEach(field => {
    if (field.type === "checkbox") {
      if (!field.checked) valid = false;
    } else {
      if (!field.value.trim()) valid = false;
    }
  });

  if (!valid) {
    showToast("Compila tutti i campi obbligatori ⚠️");
    return;
  }

    if (currentStep === 1 && tournamentId) {
      const teamNameInput = currentPanel.querySelector('[name="team_name"]');

      if (teamNameInput && teamNameInput.value.trim()) {
        const originalText = nextBtn.textContent;
        nextBtn.disabled = true;
        nextBtn.textContent = "Verifica...";

        try {
          const checkUrl = `${API_URLS.checkTeamName}?team_name=${encodeURIComponent(teamNameInput.value.trim())}&tournament_id=${encodeURIComponent(tournamentId)}`;
          const checkRes = await fetch(checkUrl);

          if (!checkRes.ok) throw new Error(`HTTP error: ${checkRes.status}`);

          const checkData = await checkRes.json();
          const canProceed = applyTeamNameCheckResult(checkData);

          if (!canProceed) {
            nextBtn.disabled = false;
            nextBtn.textContent = originalText;
            return;
          }

        } catch (err) {
          console.error("checkTeamName error:", err);
        } finally {
          nextBtn.disabled = false;
          nextBtn.textContent = originalText;
        }
      }
    }

  if (currentStep < totalSteps) {
    currentStep++;
    updateStepUI();
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
});


// ── Inizializzazione minimale ────────────────────────────────────────────
panels.forEach(panel => panel.classList.remove("active"));
const firstPanel = document.querySelector('.form-step-panel[data-step="1"]');
if (firstPanel) firstPanel.classList.add("active");
if (prevBtn) prevBtn.style.visibility = "hidden";
if (nextBtn) nextBtn.style.display = "inline-flex";





// ===============================
// TOURNAMENT CAPACITY BAR
// ===============================
function updateTournamentCapacity(current, max) {
  const fill = document.getElementById("capacity-fill");
  const textEl = document.getElementById("capacity-inline-text");
  const inlineBlock = document.getElementById("capacity-inline");

  if (!fill || !textEl || !inlineBlock) return;

  const currentTeams = Number(current) || 0;
  const maxTeams = Number(max) || 0;

  if (maxTeams === 0) {
    inlineBlock.classList.add("hidden");
    return;
  }

  inlineBlock.classList.remove("hidden");

  const percentage = Math.min((currentTeams / maxTeams) * 100, 100);
  const remaining = maxTeams - currentTeams;
  const filledPerc = Math.round(percentage);

  fill.style.width = percentage + "%";

  // Reset urgency classes
  fill.classList.remove("urgency-high", "urgency-full");

  // Testo e stile dinamici
  if (remaining <= 0) {
    fill.classList.add("urgency-full");
    textEl.textContent = "🚫 Posti esauriti";
  } else if (remaining <= 2) {
    fill.classList.add("urgency-high");
    textEl.textContent = `⚠️ Solo ${remaining} ${remaining === 1 ? 'posto' : 'posti'} rimasti — iscriviti subito`;
  } else if (remaining <= 4) {
    fill.classList.add("urgency-high");
    textEl.textContent = `🔥 Ultimi ${remaining} posti disponibili`;
  } else if (filledPerc >= 50) {
    textEl.textContent = `${filledPerc}% dei posti occupati — ${remaining} posti rimasti`;
  } else if (currentTeams === 0) {
    textEl.textContent = "📢 I posti dell'ultimo torneo si sono esauriti in meno di due giorni";
  } else if (currentTeams <= 3) {
    textEl.textContent = `Le iscrizioni sono appena aperte — ${remaining} posti disponibili`;
  } else {
    textEl.textContent = `${remaining} posti ancora disponibili su ${maxTeams}`;
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
  const teamsBlock = document.getElementById("tournament-teams-section");
  const headerCta = document.getElementById("tournament-header-cta");
  const headerScroll = document.getElementById("tournament-header-scroll");
  const capacityInline = document.getElementById("capacity-inline");

  form.style.display = "none";
  form.classList.remove("skeleton");
  badge.className = "badge";

  if (headerCta) headerCta.classList.add("hidden");
  if (headerScroll) headerScroll.classList.add("hidden");
  if (capacityInline) capacityInline.classList.add("hidden");

  if (tournament.status === "open") {
    badge.textContent = "ISCRIZIONI APERTE";
    badge.classList.add("open");
    subscribeMessage.textContent = `Le iscrizioni sono aperte. Compila il form per iscrivere il tuo ${entityLabel}.`;
    form.style.display = "flex";
    registrationBlock.style.display = "block";
    if (capacityInline) capacityInline.classList.remove("hidden");
    teamsBlock.style.display = "block";
    if (headerCta) headerCta.classList.remove("hidden");
    if (headerScroll) headerScroll.classList.remove("hidden");
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
    if (capacityInline) capacityInline.classList.remove("hidden");
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


// FIX BUG 8: guard su null/undefined
function escapeHTML(str) {
  return String(str ?? '')
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}








// ===============================
// RIEPILOGO DEFINITIVO TORNEO
// ===============================
function renderFinalSummary(tournament) {
  const block   = document.getElementById("tournament-final-summary-block");
  const content = document.getElementById("tournament-final-summary-content");
  if (!block || !content) return;

  if (tournament.status !== 'full' && tournament.status !== 'wip') {
    block.classList.add('hidden');
    return;
  }

  const isIndividual    = String(tournament.individual_or_team || 'team').toLowerCase() === 'individual';
  const formatType      = String(tournament.format_type || '').toLowerCase();
  const hasFinals       = formatType.includes('finals');
  // FIX BUG 1: toBool per award
  const hasAward        = toBool(tournament.award);

  // FIX BUG 4: toNum per tutti i campi numerici
  const teamsCurrent    = toNum(tournament.teams_current, 0);
  const teamsPerGroup   = toNum(tournament.teams_per_group, 0);
  const teamsInFinal    = toNum(tournament.teams_in_final, 0);
  const price           = toNum(tournament.price, 0);
  const awardAmountPerc = String(tournament.award_amount_perc || 'NA');

  if (teamsCurrent === 0 || teamsPerGroup === 0) {
    block.classList.add('hidden');
    return;
  }

  if (hasFinals && teamsInFinal === 0) {
    block.classList.add('hidden');
    return;
  }

  block.classList.remove('hidden');

  const entityPlural   = isIndividual ? 'giocatori' : 'squadre';
  const entityPerGroup = isIndividual ? 'giocatori per girone' : 'squadre per girone';
  const numGroups      = Math.floor(teamsCurrent / teamsPerGroup);

  const items = [];

  items.push(`<div class="final-summary-row"><span class="final-summary-icon">👥</span><span><strong>${capitalizeFirst(entityPlural)} partecipanti:</strong> ${teamsCurrent}</span></div>`);
  items.push(`<div class="final-summary-row"><span class="final-summary-icon">📋</span><span><strong>Gironi:</strong> ${numGroups} ${numGroups !== 1 ? 'gironi' : 'girone'} da ${teamsPerGroup} ${entityPerGroup}</span></div>`);

  if (hasFinals) {
    items.push(`<div class="final-summary-row"><span class="final-summary-icon">🏆</span><span><strong>${capitalizeFirst(entityPlural)} qualificati alle fasi finali:</strong> ${teamsInFinal}</span></div>`);
  }

  if (hasAward) {
    let awardText = 'sarà comunicato a breve';
    if (awardAmountPerc !== 'NA' && !isNaN(Number(awardAmountPerc)) && price > 0 && teamsCurrent > 0) {
      const totalPrize = Math.round(teamsCurrent * price * Number(awardAmountPerc) / 100);
      awardText = `<strong>€${totalPrize}</strong>`;
    }
    items.push(`<div class="final-summary-row"><span class="final-summary-icon">💰</span><span><strong>Montepremi definitivo:</strong> ${awardText}</span></div>`);
  }

  content.innerHTML = `
    <div class="final-summary-intro">Le iscrizioni sono chiuse. Di seguito la struttura definitiva del torneo.</div>
    <div class="final-summary-rows">${items.join('')}</div>
  `;
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


