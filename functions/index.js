const functions = require("firebase-functions");
const admin = require("firebase-admin");

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const axios = require("axios");


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
// GET TOURNAMENTS (FIXED)
// ===============================
exports.getTournaments = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const snapshot = await db.collection('tournaments').get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const tournaments = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // ✅ FIX: Usa doc.id se tournament_id non esiste
      const tournamentId = data.tournament_id || doc.id;
      
      // Conta teams_current
      const subsSnapshot = await db.collection('subscriptions')
        .where('tournament_id', '==', tournamentId)
        .get();
      
      // ✅ Aggiungi tournament_id ai dati se manca
      data.tournament_id = tournamentId;
      data.teams_current = subsSnapshot.size;
      
      tournaments.push(data);
    }

    res.status(200).json(tournaments);

  } catch (error) {
    console.error('getTournaments error:', error);
    res.status(500).json([]);
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

    // ✅ Rimuovi orderBy, ordina in memoria
    const snapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    const standings = snapshot.docs.map(doc => doc.data());

    // ✅ Ordina in memoria
    standings.sort((a, b) => {
      // Prima per group_id
      const groupCompare = String(a.group_id || '').localeCompare(String(b.group_id || ''));
      if (groupCompare !== 0) return groupCompare;
      
      // Poi per rank_level
      return Number(a.rank_level || 0) - Number(b.rank_level || 0);
    });

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

    // ✅ Rimuovi orderBy, ordina in memoria
    const snapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = snapshot.docs.map(doc => doc.data());

    // ✅ Ordina in memoria
    matches.sort((a, b) => {
      // Prima per group_id
      const groupCompare = String(a.group_id || '').localeCompare(String(b.group_id || ''));
      if (groupCompare !== 0) return groupCompare;
      
      // Poi per round_id
      return Number(a.round_id || 0) - Number(b.round_id || 0);
    });

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

    // ✅ Rimuovi orderBy, ordina in memoria
    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    const finals = snapshot.docs.map(doc => doc.data());

    // ✅ Ordina in memoria
    finals.sort((a, b) => Number(a.round_id || 0) - Number(b.round_id || 0));

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

    // ✅ Rimuovi orderBy, ordina dopo
    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
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

    // ✅ Ordina paths per round in memoria
    Object.keys(paths).forEach(teamId => {
      paths[teamId].sort((a, b) => a.round - b.round);
    });

    // ✅ Ordina anche i rounds
    Object.keys(rounds).forEach(roundId => {
      rounds[roundId].sort((a, b) => {
        return String(a.match_id || '').localeCompare(String(b.match_id || ''));
      });
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


// ===============================
// IMPORT HELPERS
// ===============================
const { generateMatchesIfReady } = require('./helpers/matchGenerator');
const { generateStandingsBackend } = require('./helpers/standingsCalculator');
const { generateFinalsIfReady, tryGenerateNextFinalRound } = require('./helpers/finalsGenerator');
const { updateTournamentStatus } = require('./helpers/tournamentStatus');



// ===============================
// POST: SUBMIT SUBSCRIPTION
// ===============================
exports.submitSubscription = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).send('METHOD_NOT_ALLOWED');
  }

  try {
    const { tournament_id, team_name, email, phone, preferred_zone, preferred_days, preferred_hours } = req.body;

    // Validazione base
    if (!tournament_id || !team_name || !email) {
      return res.status(400).send('INVALID_DATA');
    }

    // 1) Verifica torneo esistente
    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return res.status(404).send('TOURNAMENT_NOT_FOUND');
    }

    const tournament = tournamentDoc.data();
    const fixedCourt = tournament.fixed_court !== false; // default true

    // 2) Blocco email duplicata
    const duplicateCheck = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .where('email', '==', email)
      .get();

    if (!duplicateCheck.empty) {
      return res.status(409).send('DUPLICATE');
    }

    // ✅ 3) Conta subscriptions esistenti per generare ID incrementale
    const existingSubsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .get();

    const subsCount = existingSubsSnapshot.size + 1;
    const subscriptionId = `${tournament_id}_sub${subsCount}`;

    // 4) Crea subscription con ID deterministico
    const subscriptionData = {
      subscription_id: subscriptionId, // ✅ Aggiungi anche nei dati
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      tournament_id,
      team_name,
      email,
      phone: phone || ''
    };

    // Campi extra se fixed_court = false
    if (!fixedCourt) {
      subscriptionData.preferred_zone = preferred_zone || '';
      subscriptionData.preferred_days = preferred_days || '';
      subscriptionData.preferred_hours = preferred_hours || '';
    }

    // ✅ Usa .doc(subscriptionId).set() invece di .add()
    await db.collection('subscriptions').doc(subscriptionId).set(subscriptionData);

    // 5) Crea/aggiorna team
    const normalizedTeam = team_name.trim().toLowerCase();
    const teamId = `${tournament_id}_${normalizedTeam}`;

    await db.collection('teams').doc(teamId).set({
      team_id: teamId,
      tournament_id,
      team_name
    });

    // 6) Genera match se pronto
    await generateMatchesIfReady(tournament_id);
    await generateStandingsBackend(tournament_id);
    await updateTournamentStatus(tournament_id);

    res.status(200).send('SUBSCRIPTION_SAVED');

  } catch (error) {
    console.error('submitSubscription error:', error);
    res.status(500).send('ERROR');
  }
});


// ===============================
// POST: SUBMIT RESULT
// ===============================
exports.submitResult = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).send('METHOD_NOT_ALLOWED');
  }

  try {
    const { tournament_id, match_id, score_a, score_b, phase, winner_team_id } = req.body;

    const isFinal = String(phase).toLowerCase() === 'final';
    const scoreA = Number(score_a);
    const scoreB = Number(score_b);

    // Validazione
    if (!tournament_id || !match_id || isNaN(scoreA) || isNaN(scoreB)) {
      return res.status(400).send('INVALID_DATA');
    }

    if (scoreA < 0 || scoreB < 0) {
      return res.status(400).send('INVALID_SCORE');
    }

    // BLOCCO: torneo finished
    if (isFinal) {
      const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
      if (tournamentDoc.exists && tournamentDoc.data().status === 'finished') {
        return res.status(403).send('TOURNAMENT_FINISHED_LOCKED');
      }
    }

    // Selezione collezione
    const collection = isFinal ? 'finals' : 'matches';
    const matchRef = db.collection(collection).doc(match_id);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return res.status(404).send('MATCH_NOT_FOUND');
    }

    const matchData = matchDoc.data();

    // ✅ BLOCCO: round successivo esiste (solo finals) - VERSIONE SENZA INDICE COMPOSITO
    if (isFinal) {
      const currentRound = matchData.round_id;
      
      // FETCH ALL finals e controlla in memoria (evita indice composito)
      const allFinalsSnapshot = await db.collection('finals')
        .where('tournament_id', '==', tournament_id)
        .get();
      
      const allFinals = allFinalsSnapshot.docs.map(doc => doc.data());
      
      // Controlla se esiste un round successivo
      const hasNextRound = allFinals.some(f => Number(f.round_id) > Number(currentRound));
      
      if (hasNextRound) {
        return res.status(403).send('FINAL_ROUND_LOCKED');
      }
    }

    // INVALIDAZIONE FINALS (se modifica risultato gironi)
    if (!isFinal && matchData.played) {
      const prevScoreA = matchData.score_a;
      const prevScoreB = matchData.score_b;

      if (prevScoreA !== scoreA || prevScoreB !== scoreB) {
        // Cancella finals
        const finalsToDelete = await db.collection('finals')
          .where('tournament_id', '==', tournament_id)
          .get();

        const batch = db.batch();
        finalsToDelete.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // SCRITTURA RISULTATO
    const updateData = {
      score_a: scoreA,
      score_b: scoreB,
      played: true
    };

    if (isFinal) {
      const teamA = matchData.team_a;
      const teamB = matchData.team_b;

      let winner = '';

      if (scoreA !== scoreB) {
        winner = scoreA > scoreB ? teamA : teamB;
      } else {
        // Pareggio → serve spareggio
        if (!winner_team_id) {
          return res.status(400).send('FINAL_WINNER_REQUIRED');
        }

        if (winner_team_id !== teamA && winner_team_id !== teamB) {
          return res.status(400).send('INVALID_WINNER');
        }

        winner = winner_team_id;
      }

      updateData.winner_team_id = winner;
    }

    await matchRef.update(updateData);

    // LOGICA POST-SCRITTURA
    if (!isFinal) {
      // Gironi
      await generateStandingsBackend(tournament_id);
      await updateTournamentStatus(tournament_id);

      // Verifica se tutti i match sono giocati
      const allMatchesSnapshot = await db.collection('matches')
        .where('tournament_id', '==', tournament_id)
        .get();

      const allMatches = allMatchesSnapshot.docs.map(doc => doc.data());
      const allPlayed = allMatches.every(m => m.played === true);

      if (!allPlayed) {
        // Cancella finals se esistono
        const finalsToDelete = await db.collection('finals')
          .where('tournament_id', '==', tournament_id)
          .get();

        if (!finalsToDelete.empty) {
          const batch = db.batch();
          finalsToDelete.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      } else {
        // Genera finals
        try {
          // Cancella vecchie finals prima
          const finalsToDelete = await db.collection('finals')
            .where('tournament_id', '==', tournament_id)
            .get();

          if (!finalsToDelete.empty) {
            const batch = db.batch();
            finalsToDelete.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }

          await generateFinalsIfReady(tournament_id);
        } catch (err) {
          if (['E4', 'E6', 'E_HEADER'].includes(err.message)) {
            // Errori attesi: ambiguità classifiche
            console.log('Finals generation skipped:', err.message);
          } else {
            throw err;
          }
        }
      }
    } else {
      // Finals
      await tryGenerateNextFinalRound(tournament_id);
      await updateTournamentStatus(tournament_id);
    }

    res.status(200).send('RESULT_SAVED');

  } catch (error) {
    console.error('submitResult error:', error);
    res.status(500).send('ERROR');
  }
});




// ===============================
// FIRESTORE TRIGGER: SEND PAYMENT EMAIL ON NEW SUBSCRIPTION
// ===============================
exports.onSubscriptionCreated = onDocumentCreated(
  "subscriptions/{subscriptionId}",
  async (event) => {
    const subscription = event.data.data();
    const subscriptionId = event.params.subscriptionId;

    // Skip se email già inviata
    if (subscription.emailStatus === "sent") {
      console.log(`Email già inviata per subscription ${subscriptionId}`);
      return null;
    }

    const tournamentId = subscription.tournament_id;
    const teamName = subscription.team_name;
    const email = subscription.email;

    if (!tournamentId || !teamName || !email) {
      console.error("Dati mancanti nella subscription:", subscriptionId);
      await event.data.ref.update({ emailStatus: "error", emailError: "missing_data" });
      return null;
    }

    try {
      // 1. Leggi tournament per ottenere price e name
      const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();

      if (!tournamentDoc.exists) {
        console.error(`Tournament ${tournamentId} non trovato`);
        await event.data.ref.update({ emailStatus: "error", emailError: "tournament_not_found" });
        return null;
      }

      const tournament = tournamentDoc.data();
      const amount = tournament.price;
      const tournamentName = tournament.name;

      if (!amount) {
        console.error(`Prezzo non definito per tournament ${tournamentId}`);
        await event.data.ref.update({ emailStatus: "error", emailError: "price_not_defined" });
        return null;
      }

      // 2. Configura dati pagamento
      const paymentConfig = {
        iban: "IT36T0200820097000105204736", // ← SOSTITUISCI CON IL TUO IBAN
        paypalLink: `https://paypal.me/TommasoRabino/${amount}`, // ← SOSTITUISCI CON IL TUO USERNAME PAYPAL
      };

      // 3. Chiama Apps Script Webhook
      const mailerUrl = "https://script.google.com/macros/s/AKfycbwCy7dgq3Xs-TLXtQpuGPLYuNqFHtlNC46ZcGELNB4dWMMICluB5nC2_ucAYfoYzQY07g/exec";
      const mailerToken = "wEcqf3I7RBhXUv2QXhyhkrvfwUZCGWt9IXLnGA6koyTKqHHD9phsP0sKV7kxJO";

      const payload = {
        token: mailerToken,
        to: email,
        team_name: teamName,
        tournament_name: tournamentName,
        amount: amount,
        iban: paymentConfig.iban,
        paypalLink: paymentConfig.paypalLink
      };

      const response = await axios.post(mailerUrl, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      });

      if (response.data === "OK") {
        console.log(`Email inviata con successo a ${email} per subscription ${subscriptionId}`);
        await event.data.ref.update({
          emailStatus: "sent",
          emailSentAt: new Date().toISOString()
        });
      } else {
        console.error(`Risposta mailer non OK: ${response.data}`);
        await event.data.ref.update({
          emailStatus: "error",
          emailError: `mailer_response_${response.data}`
        });
      }

    } catch (error) {
      console.error(`Errore invio email per subscription ${subscriptionId}:`, error.message);
      await event.data.ref.update({
        emailStatus: "error",
        emailError: error.message
      });
    }

    return null;
  }
);






