// ===============================
// SIDEBAR NAVIGATION
// ===============================
const menuToggle = document.querySelector(".mobile-menu-toggle");
const mainNav    = document.getElementById("main-navigation");
const navOverlay = document.getElementById("nav-overlay");

function openNav() {
  mainNav.classList.add("active");
  navOverlay.classList.add("active");
  menuToggle.classList.add("active");
  menuToggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeNav() {
  mainNav.classList.remove("active");
  navOverlay.classList.remove("active");
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

if (menuToggle && mainNav && navOverlay) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.contains("active") ? closeNav() : openNav();
  });
  navOverlay.addEventListener("click", closeNav);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("active")) closeNav();
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
    e.stopPropagation(); // evita che il click risalga al dropdown Tornei
    const isActive = subdropdownCalcio.classList.toggle("active");
    toggleCalcio.setAttribute("aria-expanded", String(isActive));
  });
}











// ===============================
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");
const sportFilter = document.getElementById("sport-filter");

const API_URL = "https://gettournaments-dzvezz2yhq-uc.a.run.app";

let ALL_TOURNAMENTS = [];


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

    ALL_TOURNAMENTS = tournaments.filter(t => t.status !== "hidden");

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
    open:            1,
    wip:             2,
    live:            3,
    final_phase:     4,
    full:            5,
    finished:        6
  };

  tournaments.sort((a, b) => {
    const pa = statusPriority[a.status] ?? 99;
    const pb = statusPriority[b.status] ?? 99;
    return pa - pb;
  });

  container.innerHTML = "";

  if (tournaments.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun torneo trovato per questo sport.</p>";
    return;
  }

  tournaments.forEach(t => {

    const card = document.createElement("div");
    card.className = "tournament-card";
    card.dataset.id = t.tournament_id;

    if (t.status === "finished") card.classList.add("finished");

    const statusLabel       = buildStatusLabel(t.status);
    const iscrizioniAperte  = t.status === "open";
    const isIndividual      = String(t.individual_or_team || 'team').toLowerCase() === 'individual';

    const rowPrice          = buildPriceInfoText(t);
    const rowDiscount       = buildDiscountInfoText(t);
    const rowLocation       = buildLocationInfoText(t);
    const rowDateLines      = buildDateInfoText(t);
    const rowParticipants   = buildParticipantsInfoText(t);
    const rowAward          = buildAwardInfoText(t);
    const rowFormat         = buildFormatInfoText(t);

    const teamsCurrent      = toNum(t.teams_current, 0);
    const teamsMax          = toNum(t.teams_max, 0);
    const participantsIcon  = isIndividual ? "👤" : "👥";
    const participantsLabel = isIndividual ? "giocatori iscritti" : "squadre iscritte";
    const rowSignups        = `${teamsCurrent} / ${teamsMax} ${participantsLabel}`;

    const primaryDateHTML = rowDateLines.length === 2
      ? `
        <div class="card-primary-item primary-date">
          <span class="row-icon">📅</span>
          <div class="card-primary-text">
            <span class="card-primary-label">Data</span>
            <span class="card-primary-value">${rowDateLines[0]}</span>
            <span class="card-primary-subvalue">Disponibilità: ${rowDateLines[1]}</span>
          </div>
        </div>
      `
      : `
        <div class="card-primary-item primary-date">
          <span class="row-icon">📅</span>
          <div class="card-primary-text">
            <span class="card-primary-label">Data</span>
            <span class="card-primary-value">${rowDateLines[0]}</span>
          </div>
        </div>
      `;

    const discountPrimaryHTML = rowDiscount
      ? `
        <div class="card-primary-item">
          <span class="row-icon">🏷️</span>
          <div class="card-primary-text">
            <span class="card-primary-label">Sconti</span>
            <span class="card-primary-value">${rowDiscount}</span>
          </div>
        </div>
      `
      : "";

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-box">
          <h3>${escapeHTML(t.name)}</h3>
        </div>
        <span class="badge ${t.status}">${statusLabel}</span>
      </div>

      <div class="card-body">
        <div class="card-primary-info">
          <div class="card-primary-item">
            <span class="row-icon">💰</span>
            <div class="card-primary-text">
              <span class="card-primary-label">Quota</span>
              <span class="card-primary-value">${rowPrice}</span>
            </div>
          </div>

          ${discountPrimaryHTML}

          <div class="card-primary-item primary-location">
            <span class="row-icon">📍</span>
            <div class="card-primary-text">
              <span class="card-primary-label">Luogo</span>
              <span class="card-primary-value">${rowLocation}</span>
            </div>
          </div>

          ${primaryDateHTML}
        </div>

        <div class="card-secondary-info">
          <div class="card-info-rows">
            <div class="card-info-row"><span class="row-icon">${participantsIcon}</span><span><strong>Partecipanti:</strong> ${rowParticipants}</span></div>
            <div class="card-info-row"><span class="row-icon">🏆</span><span><strong>Montepremi:</strong> ${rowAward}</span></div>
            <div class="card-info-row"><span class="row-icon">📋</span><span><strong>Formato:</strong> ${rowFormat}</span></div>
            <div class="card-info-row"><span class="row-icon">✅</span><span><strong>Iscritti:</strong> ${rowSignups}</span></div>
          </div>
        </div>
      </div>

      <div class="card-actions">
        ${
          iscrizioniAperte
            ? `<a href="/regolamento?tournament_id=${t.tournament_id}" class="btn primary">Iscriviti</a>`
            : `<span class="btn primary disabled">Iscriviti</span>`
        }
        <a href="/regolamento?tournament_id=${t.tournament_id}" class="btn secondary">Dettagli</a>
        <a href="/classifica?tournament_id=${t.tournament_id}" class="btn secondary">Classifica</a>
      </div>
    `;

    container.appendChild(card);
  });

  animateCards();
}




// ===============================
// BUILD STATUS LABEL
// ===============================
function buildStatusLabel(status) {
  const labels = {
    open:            "ISCRIZIONI APERTE",
    wip:             "IN DEFINIZIONE",
    live:            "IN CORSO",
    final_phase:     "FASE FINALE",
    full:            "COMPLETO",
    needs_attention: "IN DEFINIZIONE",
    finished:        "CONCLUSO"
  };
  return labels[status] || String(status || '').toUpperCase();
}


// ===============================
// BUILD PRICE INFO TEXT
// ===============================
function buildPriceInfoText(t) {
  const isIndividual   = String(t.individual_or_team || 'team').toLowerCase() === 'individual';
  const price          = toNum(t.price, 0);
  const perLabel       = isIndividual ? 'a giocatore' : 'a squadra';
  const courtPrice     = String(t.court_price     || "non_compreso").toLowerCase().trim();
  const refereePrice   = String(t.referee_price   || "na").toLowerCase().trim();
  const aperitivoPrice = String(t.aperitivo_price || "na").toLowerCase().trim();
  
  // Gestione variabile pranzo/cena
  const mealPrice      = String(t.pranzo_cena_price || "na").toLowerCase().trim();

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

  // Mapping per pranzo e cena
  const mealMap = {
    pranzo_compreso_gironi:        "Pranzo incluso (solo gironi)",
    pranzo_compreso_finals:        "Pranzo incluso (solo finali)",
    pranzo_compreso_gironi_finals: "Pranzo incluso",
    cena_compreso_gironi:          "Cena inclusa (solo gironi)",
    cena_compreso_finals:          "Cena inclusa (solo finali)",
    cena_compreso_gironi_finals:   "Cena inclusa",
    non_compreso:                  "",
    na:                            ""
  };
  const mealText = mealMap[mealPrice] || "";

  // Integrazione di mealText nell'array degli extra
  const extras     = [courtText, refereeText, aperitivoText, mealText].filter(Boolean);
  const extrasText = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";

  return `€${price} ${perLabel}${extrasText}`;
}



// ===============================
// BUILD DISCOUNT INFO TEXT
// ===============================
function buildDiscountInfoText(t) {
  const raw = t?.discount;

  if (raw === undefined || raw === null) return "";

  const discountRaw = String(raw).trim();
  if (!discountRaw || discountRaw.toLowerCase() === "false") return "";

  const parts = discountRaw
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);

  // Ammessi solo:
  // 1) "25"
  // 2) "25; 0"
  // 3) "25; 12"
  if (parts.length !== 1 && parts.length !== 2) return "";
  if (parts.some(p => isNaN(Number(p)))) return "";

  const isIndividual = String(t.individual_or_team || "team").toLowerCase() === "individual";

  const entity = isIndividual ? "giocatore" : "squadra";
  const entityPlural = isIndividual ? "giocatori" : "squadre";

  const formatPrice = (value) => Number(value) === 0 ? "gratis" : `€${Number(value)}`;

  const d1 = Number(parts[0]);

  // Caso: "25"
  if (parts.length === 1) {
    return `Porti 1 ${entity}: ${formatPrice(d1)}`;
  }

  // Caso: "25; 0" oppure "25; 12"
  const d2 = Number(parts[1]);
  return `Porti 1 ${entity}: ${formatPrice(d1)} · Porti 2 ${entityPlural}: ${formatPrice(d2)}`;
}





// ===============================
// BUILD LOCATION INFO TEXT
// ===============================
function buildLocationInfoText(t) {
  const location   = escapeHTML(String(t.location || "").trim());
  const fixed      = String(t.fixed_court_days_hours || "false").toLowerCase().trim();
  const courtLabel = fixed === "fixed_all" ? "Campo prestabilito" : "Campi a scelta";
  return `${location} · ${courtLabel}`;
}


// ===============================
// BUILD DATE INFO TEXT
// Restituisce un array di 1 o 2 stringhe.
// 2 stringhe solo nel caso b2 (fixed_all + mid/long).
// ===============================
function buildDateInfoText(t) {
  const fixed     = String(t.fixed_court_days_hours || "false").toLowerCase().trim();
  const timeRange = String(t.time_range || "").toLowerCase().trim();
  const date      = escapeHTML(String(t.date || "").trim());

  const durationLabel = timeRange === "short" ? "Giornaliero" : "Stagionale";

  // --- Parse available_days ---
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

  // --- Parse available_hours ---
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
// BUILD PARTICIPANTS INFO
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
// BUILD AWARD INFO
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
// BUILD FORMAT INFO
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
  window.location.href = `/regolamento?tournament_id=${tournamentId}`;
});



// ===============================
// FAQ ACCORDION (single open)
// ===============================

document.querySelectorAll(".faq-question").forEach(btn => {

  btn.addEventListener("click", () => {

    const item = btn.parentElement;

    document.querySelectorAll(".faq-item").forEach(faq => {

      if (faq !== item) {
        faq.classList.remove("active");
      }

    });

    item.classList.toggle("active");

  });

});


// ===============================
// HERO TYPING ANIMATION
// ===============================

document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector(".typed-sport")) {
    new Typed(".typed-sport", {
      strings: [
        "Padel",
        "Beach Volley",
        "Calcio",
        "Scacchi"
      ],
      typeSpeed: 70,
      backSpeed: 45,
      backDelay: 1400,
      startDelay: 400,
      loop: true,
      showCursor: true,
      cursorChar: "|",
      onStringTyped: () => {
        const el = document.querySelector(".typed-sport");
        void el.offsetWidth;
      }
    });
  }
});



// ===============================
// CARD STAGGER ANIMATION
// ===============================

function animateCards() {
  const cards = document.querySelectorAll(".tournament-card");
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add("visible");
    }, index * 120);
  });
}


// ===============================
// SCROLL REVEAL (section only)
// ===============================

gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray(".reveal-section").forEach(section => {

  gsap.fromTo(
    section,
    {
      opacity: 0,
      y: 40
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
        once: true
      }
    }
  );

});






// ===============================
// SPORTS SLIDER
// ===============================

const sportsTrackInner = document.getElementById("sports-track-inner");
const sportsSlider     = document.getElementById("sports-slider");
const sportsPrev       = document.getElementById("sports-prev");
const sportsNext       = document.getElementById("sports-next");

if (sportsTrackInner && sportsSlider && sportsPrev && sportsNext) {

  const CARD_WIDTH  = 240 + 18;
  const TOTAL_CARDS = sportsTrackInner.querySelectorAll(".sport-box").length;
  let currentIndex  = 0;

  function updateButtons() {
    const trackWidth  = TOTAL_CARDS * CARD_WIDTH - 18;
    const sliderWidth = sportsSlider.clientWidth;
    const maxIndex    = Math.ceil((trackWidth - sliderWidth) / CARD_WIDTH);

    sportsPrev.style.opacity       = currentIndex <= 0          ? "0.3" : "1";
    sportsNext.style.opacity       = currentIndex >= maxIndex   ? "0.3" : "1";
    sportsPrev.style.pointerEvents = currentIndex <= 0          ? "none" : "auto";
    sportsNext.style.pointerEvents = currentIndex >= maxIndex   ? "none" : "auto";
  }

  function goTo(index) {
    const trackWidth  = TOTAL_CARDS * CARD_WIDTH - 18;
    const sliderWidth = sportsSlider.clientWidth;
    const maxIndex    = Math.ceil((trackWidth - sliderWidth) / CARD_WIDTH);

    currentIndex = Math.max(0, Math.min(index, maxIndex));
    sportsTrackInner.style.transform = `translateX(${-currentIndex * CARD_WIDTH}px)`;
    updateButtons();
  }

  sportsPrev.addEventListener("click", () => goTo(currentIndex - 1));
  sportsNext.addEventListener("click", () => goTo(currentIndex + 1));

  window.addEventListener("resize", () => goTo(currentIndex));

  goTo(0);

  // ===============================
  // SWIPE TOUCH (mobile)
  // ===============================
  let touchStartX = 0;
  let touchDeltaX = 0;

  sportsTrackInner.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
  }, { passive: true });

  sportsTrackInner.addEventListener("touchmove", e => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
  }, { passive: true });

  sportsTrackInner.addEventListener("touchend", () => {
    const THRESHOLD = 40; // px minimi per considerare uno swipe
    if (touchDeltaX < -THRESHOLD) {
      goTo(currentIndex + 1); // swipe sinistra → avanti
    } else if (touchDeltaX > THRESHOLD) {
      goTo(currentIndex - 1); // swipe destra → indietro
    }
    touchDeltaX = 0;
  });

}