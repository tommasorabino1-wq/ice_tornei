// ===================================
// API CONFIGURATION
// ===================================
const API_URLS = {
  getTeamInfo: "https://us-central1-ice-tournaments-ba14a.cloudfunctions.net/getTeamInfo",
  submitTeamInfo: "https://us-central1-ice-tournaments-ba14a.cloudfunctions.net/submitTeamInfo"
};

// ===================================
// STATE
// ===================================
let teamData = null;
let tournamentData = null;
let logoFile = null;
let certificateFiles = [];

// ===================================
// DOM ELEMENTS
// ===================================
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const content = document.getElementById('content');
const form = document.getElementById('team-info-form');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// ===================================
// INIT: Get URL params
// ===================================
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');
const tournamentId = params.get('tournament_id');

if (!teamId || !tournamentId) {
  showError(
    'Link non valido',
    'Il link che hai utilizzato non è corretto. Controlla l\'email ricevuta e riprova.'
  );
} else {
  loadTeamInfo();
}

// ===================================
// LOAD TEAM INFO
// ===================================
async function loadTeamInfo() {
  try {
    const url = `${API_URLS.getTeamInfo}?team_id=${encodeURIComponent(teamId)}&tournament_id=${encodeURIComponent(tournamentId)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 409) {
        showError(
          'Registrazione già completata',
          'Hai già completato la registrazione per questo torneo. Se hai bisogno di modificare le informazioni, contattaci via WhatsApp.'
        );
        return;
      }
      
      throw new Error(errorText);
    }

    const data = await response.json();
    
    teamData = data.team;
    tournamentData = data.tournament;

    // Popola UI
    document.getElementById('tournament-name').textContent = tournamentData.name;
    document.getElementById('team-name').textContent = teamData.team_name;
    document.getElementById('sport-name').textContent = tournamentData.sport;
    document.getElementById('min-players').textContent = tournamentData.team_size_min;
    document.getElementById('max-players').textContent = tournamentData.team_size_max;

    // Genera campi giocatori
    generatePlayerFields(tournamentData.team_size_min, tournamentData.team_size_max);

    // Mostra contenuto
    loadingSkeleton.classList.add('hidden');
    content.classList.remove('hidden');

  } catch (error) {
    console.error('Load error:', error);
    showError(
      'Errore di caricamento',
      'Non siamo riusciti a caricare i dati. Riprova più tardi o contattaci via WhatsApp.'
    );
  }
}

// ===================================
// GENERA CAMPI GIOCATORI
// ===================================
function generatePlayerFields(min, max) {
  const container = document.getElementById('players-container');
  container.innerHTML = '';

  for (let i = 1; i <= max; i++) {
    const div = document.createElement('div');
    div.className = 'player-input-group';

    const label = document.createElement('label');
    label.setAttribute('for', `player_${i}`);
    label.textContent = `Giocatore ${i}${i <= min ? ' *' : ' (Facoltativo)'}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `player_${i}`;
    input.name = `player_${i}`;
    input.placeholder = 'Nome e Cognome';
    input.required = i <= min;

    if (i > min) {
      input.classList.add('optional');
    }

    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  }
}

// ===================================
// LOGO UPLOAD HANDLER
// ===================================
document.getElementById('logo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validazione dimensione
  if (file.size > 5 * 1024 * 1024) {
    alert('Il logo deve essere massimo 5MB');
    e.target.value = '';
    return;
  }

  // Validazione tipo
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    alert('Formato non valido. Usa PNG, JPG o SVG.');
    e.target.value = '';
    return;
  }

  logoFile = file;

  // Preview
  const preview = document.getElementById('logo-preview');
  preview.classList.add('active');
  preview.innerHTML = `
    <div class="file-preview-item">
      <span class="file-preview-name">📁 ${escapeHTML(file.name)}</span>
      <span class="file-preview-remove" onclick="removeLogo()">✕ Rimuovi</span>
    </div>
  `;
});

window.removeLogo = function() {
  logoFile = null;
  document.getElementById('logo-input').value = '';
  document.getElementById('logo-preview').classList.remove('active');
  document.getElementById('logo-preview').innerHTML = '';
};

// ===================================
// CERTIFICATES UPLOAD HANDLER
// ===================================
document.getElementById('certificates-input').addEventListener('change', (e) => {
  const files = Array.from(e.target.files);

  if (files.length === 0) {
    return;
  }

  // Validazione dimensione totale
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > 20 * 1024 * 1024) {
    alert('I certificati devono essere massimo 20MB totali');
    e.target.value = '';
    return;
  }

  // Validazione tipo
  const invalidFiles = files.filter(f => f.type !== 'application/pdf');
  if (invalidFiles.length > 0) {
    alert('Tutti i file devono essere in formato PDF');
    e.target.value = '';
    return;
  }

  certificateFiles = files;

  // Preview
  const preview = document.getElementById('certificates-preview');
  preview.classList.add('active');
  preview.innerHTML = files.map((f, idx) => `
    <div class="file-preview-item">
      <span class="file-preview-name">📄 ${escapeHTML(f.name)}</span>
      <span class="file-preview-remove" onclick="removeCertificate(${idx})">✕ Rimuovi</span>
    </div>
  `).join('');
});

window.removeCertificate = function(index) {
  certificateFiles.splice(index, 1);
  
  const input = document.getElementById('certificates-input');
  input.value = '';

  const preview = document.getElementById('certificates-preview');
  
  if (certificateFiles.length === 0) {
    preview.classList.remove('active');
    preview.innerHTML = '';
  } else {
    preview.innerHTML = certificateFiles.map((f, idx) => `
      <div class="file-preview-item">
        <span class="file-preview-name">📄 ${escapeHTML(f.name)}</span>
        <span class="file-preview-remove" onclick="removeCertificate(${idx})">✕ Rimuovi</span>
      </div>
    `).join('');
  }
};

// ===================================
// FORM SUBMIT
// ===================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validazione certificati
  if (certificateFiles.length === 0) {
    alert('Devi caricare almeno un certificato medico o modulo di scarico responsabilità');
    return;
  }

  // Raccogli nomi giocatori
  const players = [];
  const maxPlayers = tournamentData.team_size_max;

  for (let i = 1; i <= maxPlayers; i++) {
    const input = document.getElementById(`player_${i}`);
    const name = input?.value?.trim();
    if (name) {
      players.push(name);
    }
  }

  // Validazione minimo giocatori
  if (players.length < tournamentData.team_size_min) {
    alert(`Devi inserire almeno ${tournamentData.team_size_min} giocatori`);
    return;
  }

  // Mostra loading
  showLoading('Caricamento file in corso...');

  try {
    // Converti logo a base64 (se presente)
    let logoBase64 = null;
    let logoFilename = null;

    if (logoFile) {
      loadingText.textContent = 'Caricamento logo...';
      logoBase64 = await fileToBase64(logoFile);
      logoFilename = logoFile.name;
    }

    // Converti certificati a base64
    loadingText.textContent = 'Caricamento certificati...';
    const certificates = await Promise.all(
      certificateFiles.map(async (file) => ({
        filename: file.name,
        base64: await fileToBase64(file)
      }))
    );

    // Invia dati
    loadingText.textContent = 'Salvataggio informazioni...';

    const payload = {
      team_id: teamId,
      tournament_id: tournamentId,
      players,
      logo_base64: logoBase64,
      logo_filename: logoFilename,
      certificates
    };

    const response = await fetch(API_URLS.submitTeamInfo, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    // Successo
    hideLoading();
    showSuccess();

  } catch (error) {
    console.error('Submit error:', error);
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
      // Rimuovi il prefisso "data:...,base64," 
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
  errorState.classList.remove('hidden');
  
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = message;
}

function showSuccess() {
  // Nascondi tutto
  content.classList.add('hidden');
  errorState.classList.add('hidden');
  loadingSkeleton.classList.add('hidden');

  // Mostra messaggio successo
  const successDiv = document.createElement('div');
  successDiv.className = 'success-state';
  successDiv.innerHTML = `
    <div class="success-icon">✅</div>
    <h2>Informazioni inviate con successo!</h2>
    <p>Grazie per aver completato la registrazione. Procederemo a breve con la creazione dei gironi.</p>
    <a href="index.html" class="btn primary">Torna alla home</a>
  `;

  document.querySelector('main.container').appendChild(successDiv);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}