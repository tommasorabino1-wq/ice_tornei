const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inizializza Firebase Admin (IMPORTANTE: va fatto UNA VOLTA SOLA)
admin.initializeApp();

// Riferimento al database Firestore
const db = admin.firestore();

// ===============================
// HELPER: CORS (permette chiamate dal frontend)
// ===============================
function setCORS(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).send('');
  }
  return false;
}

// ===============================
// GET TOURNAMENTS (DEBUG MODE)
// ===============================
exports.getTournaments = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    console.log('🔍 getTournaments called');

    // 1) Verifica connessione Firestore
    const snapshot = await db.collection('tournaments').get();
    console.log('📊 Snapshot size:', snapshot.size);
    console.log('📊 Snapshot empty:', snapshot.empty);

    if (snapshot.empty) {
      console.log('⚠️ No documents in tournaments collection');
      return res.status(200).json({
        debug: true,
        message: 'Collection tournaments is empty',
        size: 0,
        tournaments: []
      });
    }

    const tournaments = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log('📄 Document ID:', doc.id);
      console.log('📄 Document data:', JSON.stringify(data, null, 2));
      
      // Conta teams_current
      const subsSnapshot = await db.collection('subscriptions')
        .where('tournament_id', '==', data.tournament_id)
        .get();
      
      console.log(`👥 Subscriptions for ${data.tournament_id}:`, subsSnapshot.size);
      
      data.teams_current = subsSnapshot.size;
      tournaments.push(data);
    }

    console.log('✅ Returning tournaments:', tournaments.length);

    res.status(200).json({
      debug: true,
      count: tournaments.length,
      tournaments: tournaments
    });

  } catch (error) {
    console.error('❌ getTournaments error:', error);
    res.status(500).json({
      debug: true,
      error: error.message,
      stack: error.stack
    });
  }
});

// ===============================
// GET STANDINGS
// ===============================
exports.getStandings = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json([]);
    }

    const snapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .orderBy('group_id')
      .orderBy('rank_level')
      .get();

    const standings = snapshot.docs.map(doc => doc.data());
    res.status(200).json(standings);
  } catch (error) {
    console.error('getStandings error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET MATCHES (GIRONI)
// ===============================
exports.getMatches = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json([]);
    }

    const snapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .orderBy('group_id')
      .orderBy('round_id')
      .get();

    const matches = snapshot.docs.map(doc => doc.data());
    res.status(200).json(matches);
  } catch (error) {
    console.error('getMatches error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET FINALS
// ===============================
exports.getFinals = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json([]);
    }

    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .orderBy('round_id')
      .get();

    const finals = snapshot.docs.map(doc => doc.data());
    res.status(200).json(finals);
  } catch (error) {
    console.error('getFinals error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET TEAMS
// ===============================
exports.getTeams = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json([]);
    }

    const snapshot = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    const teams = snapshot.docs.map(doc => ({
      team_id: doc.data().team_id,
      team_name: doc.data().team_name
    }));

    res.status(200).json(teams);
  } catch (error) {
    console.error('getTeams error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET BRACKET (struttura finals)
// ===============================
exports.getBracket = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json({ rounds: {}, paths: {} });
    }

    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .orderBy('round_id')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ rounds: {}, paths: {} });
    }

    const rounds = {};
    const paths = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const roundId = data.round_id;

      // Aggiungi a rounds
      if (!rounds[roundId]) rounds[roundId] = [];
      rounds[roundId].push(data);

      // Aggiungi a paths per team_a
      if (data.team_a) {
        if (!paths[data.team_a]) paths[data.team_a] = [];
        paths[data.team_a].push({
          round: roundId,
          match_id: data.match_id,
          side: "A"
        });
      }

      // Aggiungi a paths per team_b
      if (data.team_b) {
        if (!paths[data.team_b]) paths[data.team_b] = [];
        paths[data.team_b].push({
          round: roundId,
          match_id: data.match_id,
          side: "B"
        });
      }
    });

    // Ordina paths per round
    Object.keys(paths).forEach(teamId => {
      paths[teamId].sort((a, b) => a.round - b.round);
    });

    res.status(200).json({
      tournament_id: tournamentId,
      rounds,
      paths
    });
  } catch (error) {
    console.error('getBracket error:', error);
    res.status(500).json({ error: error.message });
  }
});