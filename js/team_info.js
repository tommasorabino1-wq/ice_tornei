// ===================================
// API CONFIGURATION
// ===================================
const API_URLS = {
  getTeamInfo: "https://getteaminfo-dzvezz2yhq-uc.a.run.app",
  submitTeamInfo: "https://submitteaminfo-dzvezz2yhq-uc.a.run.app"
};


function toBool(val) {
  if (val === true  || val === 1)  return true;
  if (val === false || val === 0)  return false;
  const s = String(val ?? '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

function toNum(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}




// ===================================
// STATE
// ===================================
let teamData = null;
let tournamentData = null;
let logoFile = null;
let playerData = []; // Array di { name: "", certificateFile: null }

// ===================================
// DOM ELEMENTS
// ===================================
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const successState = document.getElementById('success-state');
const content = document.getElementById('content');
const form = document.getElementById('team-info-form');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// ===================================
// INIT
// ===================================
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');
const tournamentId = params.get('tournament_id');

console.log('🔍 URL Params:', { teamId, tournamentId });

if (!teamId || !tournamentId) {
  console.error('❌ Missing params');
  showError(
    'Link non valido',
    'Il link che hai utilizzato non è corretto. Controlla l\'email ricevuta e riprova.'
  );
} else {
  console.log('✅ Params OK, loading team info...');
  loadTeamInfo();
}

// ===================================
// LOAD TEAM INFO
// ===================================
async function loadTeamInfo() {
  try {
    const url = `${API_URLS.getTeamInfo}?team_id=${encodeURIComponent(teamId)}&tournament_id=${encodeURIComponent(tournamentId)}`;

    console.log('📡 Fetching:', url);

    const response = await fetch(url);

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);

      if (response.status === 409) {
        showError(
          'Registrazione già completata',
          'Hai già completato la registrazione per questo torneo. Se hai bisogno di modificare le informazioni, contattaci via WhatsApp.'
        );
        return;
      }

      if (response.status === 404) {
        showError(
          'Squadra non trovata',
          'Non abbiamo trovato questa squadra. Verifica il link o contattaci via WhatsApp.'
        );
        return;
      }

      throw new Error(errorText);
    }

    const data = await response.json();

    console.log('✅ Data received:', data);

    teamData       = data.team;
    tournamentData = data.tournament;

    const isIndividual        = String(tournamentData.individual_or_team || 'team').toLowerCase() === 'individual';
    const certificateRequired = toBool(tournamentData.certificate_required);

    const teamSizeMin = toNum(tournamentData.team_size_min, 1);
    const teamSizeMax = toNum(tournamentData.team_size_max, 1);

    if (isIndividual) {
      document.getElementById('page-title').textContent = 'Completa Registrazione';
      document.getElementById('team-icon').textContent = '👤';
      document.getElementById('team-label').textContent = 'Giocatore';
      document.getElementById('logo-section-title').textContent = 'Logo Personale';
      document.getElementById('logo-section-description').textContent =
        'Carica un logo o avatar personale (PNG, JPG, SVG - max 5MB)';
    } else {
      document.getElementById('page-title').textContent = 'Completa Registrazione Squadra';
      document.getElementById('logo-section-title').textContent = 'Logo Squadra';
    }

    document.getElementById('tournament-name').textContent = tournamentData.name;
    document.getElementById('team-name').textContent       = teamData.team_name;
    document.getElementById('sport-name').textContent      = tournamentData.sport;

    generatePlayerSections(teamSizeMin, teamSizeMax, isIndividual, certificateRequired);

    loadingSkeleton.classList.add('hidden');
    content.classList.remove('hidden');

    console.log('✅ UI ready');

  } catch (error) {
    console.error('❌ Load error:', error);
    showError(
      'Errore di caricamento',
      'Non siamo riusciti a caricare i dati. Riprova più tardi o contattaci via WhatsApp.'
    );
  }
}



// ===================================
// GENERA SEZIONI GIOCATORI
// 4 casi: individual/team × cert/no-cert
// ===================================
function generatePlayerSections(min, max, isIndividual, certificateRequired) {
  const container = document.getElementById('players-sections-container');
  container.innerHTML = '';
  playerData = [];

  // -------------------------
  // BANNER INTRO CONTESTUALE
  // -------------------------
  const banner = document.createElement('div');
  banner.className = 'form-intro-banner';

  if (isIndividual && certificateRequired) {
    banner.innerHTML = `
      <p>Carica il tuo <strong>certificato medico</strong> (Agonistico o Non Agonistico) per completare l'iscrizione.
      Puoi anche caricare un logo personale, ma è facoltativo.</p>`;
  } else if (isIndividual && !certificateRequired) {
    banner.innerHTML = `
      <p>Per questo torneo non è richiesto nessun documento. Puoi caricare un <strong>logo personale</strong> opzionale,
      oppure inviare direttamente senza caricare nulla.</p>`;
  } else if (!isIndividual && certificateRequired) {
    banner.innerHTML = `
      <p>Inserisci i <strong>nomi</strong> di tutti i giocatori e carica il rispettivo <strong>certificato medico</strong>
      (Agonistico o Non Agonistico). Il logo squadra è facoltativo.</p>`;
  } else {
    banner.innerHTML = `
      <p>Inserisci i <strong>nomi</strong> di tutti i giocatori per completare la registrazione.
      Il logo squadra è facoltativo.</p>`;
  }

  container.appendChild(banner);

  // -------------------------
  // CASO 2b: nessuna sezione giocatori
  // -------------------------
  if (isIndividual && !certificateRequired) {
    playerData.push({ name: teamData.team_name, certificateFile: null });
    return;
  }

  // -------------------------
  // CASO 2a: individual + cert
  // -------------------------
  if (isIndividual && certificateRequired) {
    playerData.push({ name: teamData.team_name, certificateFile: null });

    const section = document.createElement('div');
    section.className = 'form-section';
    section.innerHTML = `
      <h3 class="section-title">
        <span class="section-icon">👤</span>
        ${teamData.team_name}
      </h3>

      <div class="player-name-group">
        <label>Nome e Cognome</label>
        <input
          type="text"
          value="${escapeHTML(teamData.team_name)}"
          disabled
          class="input-disabled"
        >
      </div>

      <div class="player-certificate-group">
        <label for="player-cert-1">Certificato Medico Agonistico o Non Agonistico <span class="required-asterisk">*</span></label>
        <p class="section-description">Formati accettati: PDF, JPG, PNG - max 10MB</p>
        <label class="file-upload-btn">
          <input
            type="file"
            id="player-cert-1"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
          >
          <span class="btn secondary">Seleziona file</span>
        </label>
        <div id="player-cert-preview-1" class="file-preview hidden"></div>
      </div>
    `;

    container.appendChild(section);

    document.getElementById('player-cert-1').addEventListener('change', (e) => handleCertificateUpload(e, 0));
    return;
  }

  // -------------------------
  // CASO 2c e 2d: team
  // -------------------------
  for (let i = 1; i <= max; i++) {
    const isRequired = i <= min;

    playerData.push({ name: '', certificateFile: null });

    const section = document.createElement('div');
    section.className = 'form-section';
    section.id = `player-section-${i}`;

    const certBlock = certificateRequired ? `
      <div class="player-certificate-group" id="player-cert-group-${i}">
        <label for="player-cert-${i}" id="player-cert-label-${i}">
          Certificato Medico Agonistico o Non Agonistico${isRequired ? ' <span class="required-asterisk">*</span>' : ''}
        </label>
        <p class="section-description">Formati accettati: PDF, JPG, PNG - max 10MB</p>
        <label class="file-upload-btn">
          <input
            type="file"
            id="player-cert-${i}"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            ${isRequired ? 'required' : ''}
          >
          <span class="btn secondary">Seleziona file</span>
        </label>
        <div id="player-cert-preview-${i}" class="file-preview hidden"></div>
      </div>` : '';

    section.innerHTML = `
      <h3 class="section-title">
        <span class="section-icon">👤</span>
        Giocatore ${i} ${isRequired ? '<span class="required-asterisk">*</span>' : '<span class="optional-label">(Facoltativo)</span>'}
      </h3>

      <div class="player-name-group">
        <label for="player-name-${i}">Nome e Cognome${isRequired ? ' <span class="required-asterisk">*</span>' : ''}</label>
        <input
          type="text"
          id="player-name-${i}"
          placeholder="Es: Mario Rossi"
          ${isRequired ? 'required' : ''}
        >
      </div>

      ${certBlock}
    `;

    container.appendChild(section);

    const nameInput = document.getElementById(`player-name-${i}`);
    nameInput.addEventListener('input', (e) => {
      playerData[i - 1].name = e.target.value.trim();

      // FIX 2: se il giocatore è facoltativo e ha il certificato richiesto,
      // rendere il certificato obbligatorio non appena viene inserito il nome
      if (certificateRequired && !isRequired) {
        updateCertificateRequirement(i);
      }
    });

    if (certificateRequired) {
      const certInput = document.getElementById(`player-cert-${i}`);
      certInput.addEventListener('change', (e) => handleCertificateUpload(e, i - 1));
    }
  }
}

// ===================================
// FIX 2: Aggiorna obbligatorietà certificato
// per giocatori facoltativi che hanno ricevuto un nome
// ===================================
function updateCertificateRequirement(playerIndex) {
  const nameValue = playerData[playerIndex - 1].name;
  const certInput = document.getElementById(`player-cert-${playerIndex}`);
  const certLabel = document.getElementById(`player-cert-label-${playerIndex}`);
  if (!certInput || !certLabel) return;

  if (nameValue) {
    // Nome inserito → certificato diventa obbligatorio
    certInput.setAttribute('required', '');
    certLabel.innerHTML = `Certificato Medico Agonistico o Non Agonistico <span class="required-asterisk">*</span>`;
  } else {
    // Nome rimosso → certificato torna facoltativo
    certInput.removeAttribute('required');
    certLabel.innerHTML = `Certificato Medico Agonistico o Non Agonistico`;
  }
}

// ===================================
// HANDLE CERTIFICATE UPLOAD
// ===================================
function handleCertificateUpload(e, playerIndex) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('Il file deve essere massimo 10MB');
    e.target.value = '';
    return;
  }

  const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    alert('Formato non valido. Usa PDF, JPG o PNG.');
    e.target.value = '';
    return;
  }

  playerData[playerIndex].certificateFile = file;

  const preview = document.getElementById(`player-cert-preview-${playerIndex + 1}`);
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="file-preview-item">
      <span class="file-preview-name">${escapeHTML(file.name)}</span>
      <span class="file-preview-remove" onclick="removeCertificate(${playerIndex})">✕ Rimuovi</span>
    </div>
  `;
}

window.removeCertificate = function(playerIndex) {
  playerData[playerIndex].certificateFile = null;
  document.getElementById(`player-cert-${playerIndex + 1}`).value = '';
  const preview = document.getElementById(`player-cert-preview-${playerIndex + 1}`);
  preview.classList.add('hidden');
  preview.innerHTML = '';
};

// ===================================
// LOGO UPLOAD HANDLER
// ===================================
document.getElementById('logo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Il logo deve essere massimo 5MB');
    e.target.value = '';
    return;
  }

  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    alert('Formato non valido. Usa PNG, JPG o SVG.');
    e.target.value = '';
    return;
  }

  logoFile = file;

  const preview = document.getElementById('logo-preview');
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="file-preview-item">
      <span class="file-preview-name">${escapeHTML(file.name)}</span>
      <span class="file-preview-remove" onclick="removeLogo()">✕ Rimuovi</span>
    </div>
  `;
});

window.removeLogo = function() {
  logoFile = null;
  document.getElementById('logo-input').value = '';
  const preview = document.getElementById('logo-preview');
  preview.classList.add('hidden');
  preview.innerHTML = '';
};

// ===================================
// FIX 3: Mostra errori campi obbligatori mancanti
// ===================================
function highlightMissingFields() {
  // Rimuovi errori precedenti
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  let firstError = null;

  // Controlla tutti gli input required visibili
  const requiredInputs = form.querySelectorAll('input[required]:not([disabled])');
  requiredInputs.forEach(input => {
    const isEmpty = input.type === 'file'
      ? !input.files || input.files.length === 0
      : !input.value.trim();

    if (isEmpty) {
      input.classList.add('input-error');

      const msg = document.createElement('p');
      msg.className = 'field-error-msg';
      msg.textContent = input.type === 'file'
        ? 'Carica il file richiesto.'
        : 'Questo campo è obbligatorio.';

      // Inserisci il messaggio dopo il genitore dell'input
      // (per i file input il genitore è la <label class="file-upload-btn">)
      const insertAfter = input.type === 'file'
        ? input.closest('.player-certificate-group') || input.parentElement
        : input.parentElement;

      insertAfter.appendChild(msg);

      if (!firstError) firstError = insertAfter;
    }
  });

  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return !firstError; // true = tutto ok
}

// ===================================
// FORM SUBMIT
// ===================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  console.log('📤 Form submit started');

  const isIndividual        = String(tournamentData.individual_or_team || 'team').toLowerCase() === 'individual';
  const certificateRequired = toBool(tournamentData.certificate_required);
  const teamSizeMin         = toNum(tournamentData.team_size_min, 1);

  // FIX 3: valida e mostra errori prima di procedere
  const isValid = highlightMissingFields();
  if (!isValid) return;

  // Validazioni custom aggiuntive
  if (isIndividual && certificateRequired) {
    if (!playerData[0]?.certificateFile) {
      alert('Devi caricare il tuo certificato medico per completare la registrazione.');
      return;
    }
  } else if (!isIndividual) {
    const validPlayers = playerData.filter(p => p.name);
    if (validPlayers.length < teamSizeMin) {
      alert(`Devi inserire almeno ${teamSizeMin} giocatori`);
      return;
    }
    if (certificateRequired) {
      const validWithCert = playerData.filter(p => p.name && p.certificateFile);
      if (validWithCert.length < teamSizeMin) {
        alert(`Devi caricare il certificato medico per almeno ${teamSizeMin} giocatori`);
        return;
      }
    }
  }

  showLoading('Preparazione file...');

  try {
    let logoBase64   = null;
    let logoFilename = null;

    if (logoFile) {
      loadingText.textContent = 'Caricamento logo...';
      logoBase64   = await fileToBase64(logoFile);
      logoFilename = logoFile.name;
      console.log('🖼️ Logo converted');
    }

    loadingText.textContent = 'Caricamento dati...';

    const players = [];

    if (isIndividual) {
      const p      = playerData[0];
      const player = { name: p.name };
      if (p.certificateFile) {
        player.certificate_base64    = await fileToBase64(p.certificateFile);
        player.certificate_filename  = p.certificateFile.name;
      }
      players.push(player);
    } else {
      for (const player of playerData) {
        if (!player.name) continue;
        const p = { name: player.name };
        if (certificateRequired && player.certificateFile) {
          loadingText.textContent      = 'Caricamento certificati...';
          p.certificate_base64         = await fileToBase64(player.certificateFile);
          p.certificate_filename       = player.certificateFile.name;
        }
        players.push(p);
      }
    }

    console.log('👥 Players ready:', players.length);

    loadingText.textContent = 'Salvataggio informazioni...';

    const payload = {
      team_id:       teamId,
      tournament_id: tournamentId,
      players,
      logo_base64:   logoBase64,
      logo_filename: logoFilename
    };

    console.log('📦 Payload structure:', {
      team_id:       payload.team_id,
      tournament_id: payload.tournament_id,
      players_count: payload.players.length,
      has_logo:      !!payload.logo_base64
    });

    const response = await fetch(API_URLS.submitTeamInfo, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Submit error:', errorText);
      throw new Error(errorText);
    }

    console.log('✅ Submit success');
    hideLoading();

    // FIX 1: scroll in cima prima di mostrare il messaggio di successo
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showSuccess();

  } catch (error) {
    console.error('❌ Submit error:', error);
    hideLoading();
    alert('Errore durante l\'invio. Riprova più tardi o contattaci via WhatsApp.');
  }
});

// ===================================
// HELPER: File to Base64
// ===================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===================================
// UI HELPERS
// ===================================
function showLoading(text) {
  loadingText.textContent = text || 'Caricamento in corso...';
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function showError(title, message) {
  loadingSkeleton.classList.add('hidden');
  content.classList.add('hidden');
  successState.classList.add('hidden');
  errorState.classList.remove('hidden');

  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = message;
}

function showSuccess() {
  content.classList.add('hidden');
  errorState.classList.add('hidden');
  loadingSkeleton.classList.add('hidden');
  successState.classList.remove('hidden');
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}