// ===================================
// API CONFIGURATION
// ===================================
const API_URLS = {
  getTeamInfo: "https://getteaminfo-dzvezz2yhq-uc.a.run.app",
  submitTeamInfo: "https://submitteaminfo-dzvezz2yhq-uc.a.run.app"
};

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
    
    teamData = data.team;
    tournamentData = data.tournament;

    // Popola UI
    document.getElementById('tournament-name').textContent = tournamentData.name;
    document.getElementById('team-name').textContent = teamData.team_name;
    document.getElementById('sport-name').textContent = tournamentData.sport;

    // Genera sezioni giocatori
    generatePlayerSections(tournamentData.team_size_min, tournamentData.team_size_max);

    // Mostra contenuto
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
// ===================================
function generatePlayerSections(min, max) {
  const container = document.getElementById('players-sections-container');
  container.innerHTML = '';

  playerData = [];

  for (let i = 1; i <= max; i++) {
    const isRequired = i <= min;
    
    playerData.push({ name: '', certificateFile: null });

    const section = document.createElement('div');
    section.className = 'form-section';
    
    section.innerHTML = `
      <h3 class="section-title">
        <span class="section-icon">👤</span>
        Giocatore ${i} ${isRequired ? '<span class="required-asterisk">*</span>' : '<span class="optional-label">(Facoltativo)</span>'}
      </h3>
      
      <!-- Nome Giocatore -->
      <div class="player-name-group">
        <label for="player-name-${i}">Nome e Cognome${isRequired ? ' <span class="required-asterisk">*</span>' : ''}</label>
        <input 
          type="text" 
          id="player-name-${i}" 
          placeholder="Es: Mario Rossi" 
          ${isRequired ? 'required' : ''}
        >
      </div>

      <!-- Certificato Giocatore -->
      <div class="player-certificate-group">
        <label for="player-cert-${i}">Certificato / Scarico Responsabilità${isRequired ? ' <span class="required-asterisk">*</span>' : ''}</label>
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
      </div>
    `;

    container.appendChild(section);

    // Event listeners
    const nameInput = document.getElementById(`player-name-${i}`);
    const certInput = document.getElementById(`player-cert-${i}`);

    nameInput.addEventListener('input', (e) => {
      playerData[i - 1].name = e.target.value.trim();
    });

    certInput.addEventListener('change', (e) => handleCertificateUpload(e, i - 1));
  }
}



// ===================================
// HANDLE CERTIFICATE UPLOAD
// ===================================
function handleCertificateUpload(e, playerIndex) {
  const file = e.target.files[0];
  if (!file) return;

  // Validazione dimensione
  if (file.size > 10 * 1024 * 1024) {
    alert('Il file deve essere massimo 10MB');
    e.target.value = '';
    return;
  }

  // Validazione tipo
  const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    alert('Formato non valido. Usa PDF, JPG o PNG.');
    e.target.value = '';
    return;
  }

  playerData[playerIndex].certificateFile = file;

  // Preview
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
// FORM SUBMIT
// ===================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  console.log('📤 Form submit started');

  // Validazione: almeno min giocatori con nome + certificato
  const validPlayers = playerData.filter(p => p.name && p.certificateFile);
  
  if (validPlayers.length < tournamentData.team_size_min) {
    alert(`Devi inserire almeno ${tournamentData.team_size_min} giocatori con nome e certificato`);
    return;
  }

  showLoading('Preparazione file...');

  try {
    // Converti logo
    let logoBase64 = null;
    let logoFilename = null;

    if (logoFile) {
      loadingText.textContent = 'Caricamento logo...';
      logoBase64 = await fileToBase64(logoFile);
      logoFilename = logoFile.name;
      console.log('🖼️ Logo converted');
    }

    // Converti giocatori + certificati
    loadingText.textContent = 'Caricamento certificati...';
    
    const players = [];
    for (const player of playerData) {
      if (player.name && player.certificateFile) {
        const certBase64 = await fileToBase64(player.certificateFile);
        players.push({
          name: player.name,
          certificate_base64: certBase64,
          certificate_filename: player.certificateFile.name
        });
      }
    }

    console.log('👥 Players converted:', players.length);

    // Invia dati
    loadingText.textContent = 'Salvataggio informazioni...';

    // ✅ DEBUG PRE-PAYLOAD
    console.log('🔍 Pre-payload check:', {
      teamId,
      tournamentId,
      playersLength: players.length,
      logoBase64: logoBase64 ? `${logoBase64.substring(0, 50)}...` : null,
      logoFilename
    });

    const payload = {
      team_id: teamId,
      tournament_id: tournamentId,
      players,
      logo_base64: logoBase64,
      logo_filename: logoFilename
    };

    // ✅ DEBUG PAYLOAD COMPLETO
    console.log('📦 Payload structure:', {
      team_id: payload.team_id,
      tournament_id: payload.tournament_id,
      players_count: payload.players.length,
      players_sample: payload.players.map(p => ({
        name: p.name,
        has_certificate: !!p.certificate_base64,
        cert_filename: p.certificate_filename,
        cert_size: p.certificate_base64 ? p.certificate_base64.length : 0
      })),
      has_logo: !!payload.logo_base64,
      logo_filename: payload.logo_filename
    });

    console.log('📡 Sending payload...');

    const response = await fetch(API_URLS.submitTeamInfo, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Submit error:', errorText);
      throw new Error(errorText);
    }

    console.log('✅ Submit success');
    hideLoading();
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}