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
// GET TOURNAMENTS
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
      
      const tournamentId = data.tournament_id || doc.id;
      
      const subsSnapshot = await db.collection('subscriptions')
        .where('tournament_id', '==', tournamentId)
        .get();
      
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

    const snapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    const standings = snapshot.docs.map(doc => doc.data());

    standings.sort((a, b) => {
      const groupCompare = String(a.group_id || '').localeCompare(String(b.group_id || ''));
      if (groupCompare !== 0) return groupCompare;
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

    const snapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = snapshot.docs.map(doc => doc.data());

    matches.sort((a, b) => {
      const groupCompare = String(a.group_id || '').localeCompare(String(b.group_id || ''));
      if (groupCompare !== 0) return groupCompare;
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

    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    const finals = snapshot.docs.map(doc => doc.data());

    finals.sort((a, b) => Number(a.round_id || 0) - Number(b.round_id || 0));

    res.status(200).json(finals);
  } catch (error) {
    console.error('getFinals error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET TEAMS (from subscriptions)
// ===============================
exports.getTeams = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json([]);
    }

    const snapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournamentId)
      .get();

    const teams = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        team_id: data.team_id,
        team_name: data.team_name
      };
    });

    res.status(200).json(teams);
  } catch (error) {
    console.error('getTeams error:', error);
    res.status(500).json([]);
  }
});



// ===============================
// GET BRACKET (struttura finals)
// ✅ MODIFICATO: separa il match 3°/4° posto in thirdPlaceMatch
// ===============================
exports.getBracket = functions.https.onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json({ rounds: {}, paths: {}, thirdPlaceMatch: null });
    }

    const snapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ rounds: {}, paths: {}, thirdPlaceMatch: null });
    }

    const rounds = {};
    const paths = {};
    let thirdPlaceMatch = null; // ✅ NUOVO: match 3°/4° posto separato

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // ✅ NUOVO: il match 3°/4° viene estratto separatamente, non finisce in rounds
      if (data.is_third_place_match === true) {
        thirdPlaceMatch = data;
        return; // non aggiungerlo a rounds né a paths
      }

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

    // Ordina match dentro ogni round per match_id
    Object.keys(rounds).forEach(roundId => {
      rounds[roundId].sort((a, b) =>
        String(a.match_id || '').localeCompare(String(b.match_id || ''))
      );
    });

    res.status(200).json({
      tournament_id: tournamentId,
      rounds,
      paths,
      thirdPlaceMatch // ✅ null se non esiste, altrimenti il documento del match
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
// ✅ MODIFICATO: importa propagateFinalsResult invece di tryGenerateNextFinalRound
const { generateFinalsIfReady, propagateFinalsResult } = require('./helpers/finalsGenerator');
const { updateTournamentStatus } = require('./helpers/tournamentStatus');


// ===============================
// IMPORT per Firestore Triggers v2
// ===============================
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

// ===============================
// FIRESTORE TRIGGER: GENERATE MATCHES ON STATUS CHANGE TO "FULL"
// ===============================
exports.onTournamentStatusChange = onDocumentUpdated(
  "tournaments/{tournamentId}",
  async (event) => {
    const tournamentId = event.params.tournamentId;
    
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    const oldStatus = beforeData?.status;
    const newStatus = afterData?.status;
    
    console.log(`🔄 Tournament ${tournamentId} status change: ${oldStatus} → ${newStatus}`);
    
    // Trigger generazione match: open → full
    if (oldStatus === 'open' && newStatus === 'full') {
      console.log(`🚀 Triggering match generation for ${tournamentId}`);
      try {
        await generateMatchesIfReady(tournamentId);
        console.log(`✅ Match generation completed for ${tournamentId}`);
      } catch (error) {
        console.error(`❌ Match generation failed for ${tournamentId}:`, error);
      }
    }

    // Trigger generazione finals: qualsiasi status → final_phase
    if (oldStatus !== 'final_phase' && newStatus === 'final_phase') {
      console.log(`🏆 Triggering finals generation for ${tournamentId}`);
      try {
        await generateFinalsIfReady(tournamentId);
        console.log(`✅ Finals generation completed for ${tournamentId}`);
      } catch (error) {
        console.error(`❌ Finals generation failed for ${tournamentId}:`, error);
      }
    }
    
    return null;
  }
);



// ===============================
// FIRESTORE TRIGGER: ON MATCH RESULT UPDATED (GIRONI)
// ===============================
exports.onMatchResultUpdated = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const matchId = event.params.matchId;
    
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    const tournamentId = afterData?.tournament_id;
    
    if (!tournamentId) {
      console.log(`⚠️ Match ${matchId} has no tournament_id`);
      return null;
    }
    
    const beforePlayed = beforeData?.played === true;
    const afterPlayed = afterData?.played === true;
    const scoreChanged = 
      beforeData?.score_a !== afterData?.score_a || 
      beforeData?.score_b !== afterData?.score_b;
    
    if (!afterPlayed && !scoreChanged) {
      console.log(`ℹ️ Match ${matchId} - no relevant changes`);
      return null;
    }
    
    console.log(`🔄 Match ${matchId} result updated: ${afterData.score_a} - ${afterData.score_b}`);
    
    try {
      // 1) Ricalcola standings
      await generateStandingsBackend(tournamentId);
      console.log(`✅ Standings recalculated for ${tournamentId}`);
      
      // 2) Aggiorna status torneo
      await updateTournamentStatus(tournamentId);
      
      // 3) Verifica se tutti i match dei gironi sono giocati
      const allMatchesSnapshot = await db.collection('matches')
        .where('tournament_id', '==', tournamentId)
        .get();
      
      const allMatches = allMatchesSnapshot.docs.map(doc => doc.data());
      const allPlayed = allMatches.every(m => m.played === true);
      
      if (allPlayed) {
        console.log(`🏆 All group matches played for ${tournamentId} - checking finals generation`);
        
        const existingFinals = await db.collection('finals')
          .where('tournament_id', '==', tournamentId)
          .get();
        
        if (!existingFinals.empty) {
          const batch = db.batch();
          existingFinals.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log(`🗑️ Deleted ${existingFinals.size} existing finals`);
        }
        
        try {
          await generateFinalsIfReady(tournamentId);
          console.log(`✅ Finals generated for ${tournamentId}`);
        } catch (err) {
          if (['E4', 'E6', 'E_HEADER'].includes(err.message)) {
            console.log(`⚠️ Finals generation skipped: ${err.message}`);
          } else {
            throw err;
          }
        }
      } else {
        const existingFinals = await db.collection('finals')
          .where('tournament_id', '==', tournamentId)
          .get();
        
        if (!existingFinals.empty) {
          const batch = db.batch();
          existingFinals.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log(`🗑️ Finals invalidated - not all group matches played`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing match ${matchId}:`, error);
    }
    
    return null;
  }
);


// ===============================
// FIRESTORE TRIGGER: ON FINAL RESULT UPDATED
// ✅ MODIFICATO: usa propagateFinalsResult invece di tryGenerateNextFinalRound
// ===============================
exports.onFinalResultUpdated = onDocumentUpdated(
  "finals/{matchId}",
  async (event) => {
    const matchId = event.params.matchId;
    
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    const tournamentId = afterData?.tournament_id;
    
    if (!tournamentId) {
      console.log(`⚠️ Final ${matchId} has no tournament_id`);
      return null;
    }
    
    const beforePlayed = beforeData?.played === true;
    const afterPlayed = afterData?.played === true;
    const scoreChanged = 
      beforeData?.score_a !== afterData?.score_a || 
      beforeData?.score_b !== afterData?.score_b ||
      beforeData?.winner_team_id !== afterData?.winner_team_id;
    
    // ✅ Trigger se il match è appena diventato played, oppure se era già played
    // e i dati sono cambiati (correzione risultato)
    const justBecamePlayed = !beforePlayed && afterPlayed;
    const resultCorrected = beforePlayed && afterPlayed && scoreChanged;

    if (!justBecamePlayed && !resultCorrected) {
      console.log(`ℹ️ Final ${matchId} - no relevant changes`);
      return null;
    }
    
    console.log(`🔄 Final ${matchId} result updated: ${afterData.score_a} - ${afterData.score_b} (winner: ${afterData.winner_team_id})`);
    
    // Validazione: se pareggio, deve esserci winner_team_id
    if (afterData.score_a === afterData.score_b && !afterData.winner_team_id) {
      console.log(`⚠️ Final ${matchId} is a tie but no winner_team_id specified`);
      return null;
    }
    
    try {
      // 1) ✅ NUOVO: Propaga il risultato ai match futuri (popola team_a/team_b nei round successivi)
      await propagateFinalsResult(tournamentId, matchId);
      
      // 2) Aggiorna status torneo
      await updateTournamentStatus(tournamentId);
      
      console.log(`✅ Final processing completed for ${tournamentId}`);
      
    } catch (error) {
      console.error(`❌ Error processing final ${matchId}:`, error);
    }
    
    return null;
  }
);




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
    const { tournament_id, team_name, email, phone, preferred_zone, preferred_days, preferred_hours, additional_notes } = req.body;

    if (!tournament_id || !team_name || !email) {
      return res.status(400).send('INVALID_DATA');
    }

    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return res.status(404).send('TOURNAMENT_NOT_FOUND');
    }

    const tournament = tournamentDoc.data();
    
    if (tournament.status !== 'open') {
      return res.status(403).send('REGISTRATIONS_CLOSED');
    }
    
    const fixedCourtDaysHours = String(tournament.fixed_court_days_hours || 'false').toLowerCase();
    const needsPreferences = fixedCourtDaysHours !== 'fixed_all';

    const normalizedTeamName = team_name.trim().toLowerCase();
    const teamId = `${tournament_id}_${normalizedTeamName}`;

    const duplicateTeamCheck = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .where('team_id', '==', teamId)
      .limit(1)
      .get();

    if (!duplicateTeamCheck.empty) {
      return res.status(409).send('DUPLICATE_TEAM');
    }

    const duplicateEmailCheck = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!duplicateEmailCheck.empty) {
      return res.status(409).send('DUPLICATE_EMAIL');
    }

    const existingSubsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .get();

    const subsCount = existingSubsSnapshot.size + 1;
    const subscriptionId = `${tournament_id}_sub${subsCount}`;

    const subscriptionData = {
      subscription_id: subscriptionId,
      team_id: teamId,
      tournament_id,
      team_name,
      email,
      phone: phone || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    if (needsPreferences) {
      if (preferred_zone) subscriptionData.preferred_zone = preferred_zone.trim();
      if (preferred_days) subscriptionData.preferred_days = preferred_days.trim();
      if (preferred_hours) subscriptionData.preferred_hours = preferred_hours.trim();
    }
    
    if (additional_notes && additional_notes.trim()) {
      subscriptionData.additional_notes = additional_notes.trim();
    }

    await db.collection('subscriptions').doc(subscriptionId).set(subscriptionData);

    res.status(200).send('SUBSCRIPTION_SAVED');

  } catch (error) {
    console.error('submitSubscription error:', error);
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

      const paymentConfig = {
        iban: "IT36T0200820097000105204736",
        paypalLink: `https://paypal.me/TommasoRabino/${amount}`,
      };

      const mailerUrl = "https://script.google.com/macros/s/AKfycbxnAuMenN7bRSNIRcXPOCjEFX8Onj9-9qo5sVxEEAx_9odFGugsGkzBr2sNhTPI-en0qw/exec";
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