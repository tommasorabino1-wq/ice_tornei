// ===============================
// HAMBURGER MENU TOGGLE
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
// HOMEPAGE - TORNEI (ICE PLATFORM)
// ===============================

const container = document.getElementById("tournaments");
const sportFilter = document.getElementById("sport-filter");

const API_URL = "https://gettournaments-dzvezz2yhq-uc.a.run.app";

let ALL_TOURNAMENTS = [];

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

    ALL_TOURNAMENTS = tournaments;

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
    open: 1,
    wip: 2,                 
    live: 3,
    final_phase: 4,
    full: 5,
    finished: 6
  };

  tournaments.sort((a, b) => {
    return statusPriority[a.status] - statusPriority[b.status];
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

    if (t.status === "finished") {
      card.classList.add("finished");
    }

    const statusLabel = buildStatusLabel(t.status);
    const iscrizioniAperte = t.status === "open";
    const isIndividual = String(t.individual_or_team || 'team').toLowerCase() === 'individual';  

    const row1 = `${t.sport} · ${t.location} · ${t.date}`;
    const row2 = buildParticipantsInfoText(t);
    const row3 = buildPriceInfoText(t, isIndividual);  
    const row4 = buildAwardInfoText(t);
    const row5 = buildFormatInfoText(t);
    const row6 = buildTimeRangeInfoText(t);
    const row7 = buildCourtSchedulingModeText(t);
    const row8 = buildCourtDaysHoursRangeText(t);

    const teamsCurrent = t.teams_current || 0;
    const teamsMax = t.teams_max || 0;
    const row9 = `${teamsCurrent} / ${teamsMax} squadre iscritte`;

    card.innerHTML = `
      <div class="card-header">
        <h3>${escapeHTML(t.name)}</h3>
        <span class="badge ${t.status}">${statusLabel}</span>
      </div>

      <div class="card-body">
        <div class="card-info-rows">
          <div class="card-info-row"><span class="row-icon">🏐</span><span><strong>Sport, Luogo, Data:</strong> ${escapeHTML(row1)}</span></div>
          <div class="card-info-row"><span class="row-icon">👥</span><span><strong>Partecipanti:</strong> ${row2}</span></div>
          <div class="card-info-row"><span class="row-icon">💰</span><span><strong>Iscrizione:</strong> ${row3}</span></div>
          <div class="card-info-row"><span class="row-icon">🏆</span><span><strong>Montepremi:</strong> ${row4}</span></div>
          <div class="card-info-row"><span class="row-icon">📋</span><span><strong>Formato:</strong> ${row5}</span></div>
          <div class="card-info-row"><span class="row-icon">📅</span><span><strong>Durata:</strong> ${row6}</span></div>
          <div class="card-info-row"><span class="row-icon">🥅</span><span><strong>Gestione campi e orari:</strong> ${row7}</span></div>
          <div class="card-info-row"><span class="row-icon">🕒</span><span><strong>Giorni e fasce orarie disponibili:</strong> ${row8}</span></div>
          <div class="card-info-row"><span class="row-icon">✅</span><span><strong>Iscritti:</strong> ${row9}</span></div>
        </div>
      </div>

      <div class="card-actions">
        ${
          iscrizioniAperte
            ? `<a href="tournament.html?tournament_id=${t.tournament_id}" class="btn primary">Iscriviti</a>`
            : `<span class="btn primary disabled">Iscriviti</span>`
        }
        <a href="tournament.html?tournament_id=${t.tournament_id}" class="btn secondary">Dettagli</a>
        <a href="standings.html?tournament_id=${t.tournament_id}" class="btn secondary">Classifica</a>
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
    open: "ISCRIZIONI APERTE",
    wip: "IN DEFINIZIONE",
    live: "IN CORSO",
    final_phase: "FASE FINALE",
    full: "COMPLETO",
    needs_attention: "IN DEFINIZIONE",
    finished: "CONCLUSO"
  };
  return labels[status] || status.toUpperCase();
}

// ===============================
// BUILD PARTICIPANTS INFO
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
// BUILD PRICE INFO
// ===============================
function buildPriceInfoText(t, isIndividual = false) {
  const price = t.price || 0;
  const perLabel = isIndividual ? "a giocatore" : "a squadra";

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
    refereeText = "Arbitro non incluso";
  } else {
    refereeText = "Arbitro incluso";
  }

  const parts = [courtText];

  if (refereeText) {
    parts.push(refereeText);
  }

  return `€${price} ${perLabel} · ${parts.join(", ")}`;
}

// ===============================
// BUILD AWARD INFO
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
// BUILD FORMAT INFO
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
// BUILD TIME RANGE INFO
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
// BUILD COURT SCHEDULING MODE
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
// BUILD COURT DAYS & HOURS RANGE
// ===============================
function buildCourtDaysHoursRangeText(t) {

  const daysRaw = String(t.available_days || "").toLowerCase().trim();
  const hoursRaw = String(t.available_hours || "").toLowerCase().trim();

  const parts = [];

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
    parts.push(dayLabels[daysRaw]);
  }

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
  window.location.href = `tournament.html?tournament_id=${tournamentId}`;
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
// HERO COUNTER ANIMATION
// ===============================

const statNumbers = document.querySelectorAll(".stat-number");
function animateStats(){
  statNumbers.forEach(el => {
  const target = Number(el.dataset.target);
    gsap.fromTo(el,
    { innerText: 0 },
      {
      innerText: target,
      duration: 2,
      ease: "power1.out",
      snap:{ innerText:1 },
      onUpdate:function(){
        el.innerText = "+" + Math.floor(el.innerText);
        }
      }
    );
  });
}

ScrollTrigger.create({
  trigger: ".hero-stats",
  start: "top 85%",
  onEnter: animateStats,
  once:true
});






// ===============================
// SPORTS SLIDER — frecce only
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