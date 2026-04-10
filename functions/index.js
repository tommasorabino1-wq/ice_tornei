const functions = require("firebase-functions");
const admin = require("firebase-admin");

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");

const OpenAI = require("openai");
const { defineSecret } = require("firebase-functions/params");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const sharp = require("sharp");


// Inizializza Firebase Admin (IMPORTANTE: va fatto UNA VOLTA SOLA)
admin.initializeApp();

// Riferimento al database Firestore
const db = admin.firestore();




function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function toNumberSafe(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function toBooleanSafe(val, fallback = false) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  if (typeof val === 'number') return val === 1;
  return fallback;
}

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
// HELPER: Normalizza nome squadra per controlli di unicità
// ===============================
function normalizeTeamNameForCheck(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}


// ===============================
// HELPER: Normalizza email per controlli di unicità
// ===============================
function normalizeEmailForCheck(email) {
  return String(email || '')
    .toLowerCase()
    .trim();
}

// ===============================
// HELPER: Cerca stesso nome squadra in altri tornei dello stesso sport
// ===============================
async function findSameTeamNameInSameSportOtherTournaments({
  currentTournamentId,
  sport,
  normalizedTeamName
}) {
  const tournamentsSnap = await db.collection('tournaments')
    .where('sport', '==', sport)
    .get();

  const sameSportTournaments = tournamentsSnap.docs
    .map(doc => {
      const data = doc.data();
      return {
        tournament_id: toStringSafe(data.tournament_id, doc.id),
        name: toStringSafe(data.name, doc.id)
      };
    })
    .filter(t => t.tournament_id && t.tournament_id !== currentTournamentId);

  if (sameSportTournaments.length === 0) {
    return {
      found: false,
      tournaments: []
    };
  }

  const sameSportTournamentIds = sameSportTournaments.map(t => t.tournament_id);
  const tournamentsById = Object.fromEntries(
    sameSportTournaments.map(t => [t.tournament_id, t])
  );

  const BATCH_SIZE = 30;
  const matchedTournaments = [];

  for (let i = 0; i < sameSportTournamentIds.length; i += BATCH_SIZE) {
    const batchIds = sameSportTournamentIds.slice(i, i + BATCH_SIZE);

    const subsSnap = await db.collection('subscriptions')
      .where('tournament_id', 'in', batchIds)
      .get();

    for (const doc of subsSnap.docs) {
      const sub = doc.data();
      const subTeamNameNorm = normalizeTeamNameForCheck(sub.team_name);

      if (subTeamNameNorm === normalizedTeamName) {
        const tId = toStringSafe(sub.tournament_id);
        const tournamentInfo = tournamentsById[tId];

        if (
          tournamentInfo &&
          !matchedTournaments.some(t => t.tournament_id === tId)
        ) {
          matchedTournaments.push({
            tournament_id: tournamentInfo.tournament_id,
            tournament_name: tournamentInfo.name
          });
        }
      }
    }
  }

  return {
    found: matchedTournaments.length > 0,
    tournaments: matchedTournaments
  };
}




// ===============================
// GET TOURNAMENTS
// ===============================
exports.getTournaments = onRequest(async (req, res) => {
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
      
      const tournamentId = toStringSafe(data.tournament_id, doc.id);
      
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
exports.getStandings = onRequest(async (req, res) => {
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
exports.getMatches = onRequest(async (req, res) => {
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
exports.getFinals = onRequest(async (req, res) => {
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
exports.getTeams = onRequest(async (req, res) => {
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
// ===============================
exports.getBracket = onRequest(async (req, res) => {
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
    let thirdPlaceMatch = null;

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      if (toBooleanSafe(data.is_third_place_match)) {
        thirdPlaceMatch = data;
        return;
      }

      const roundId = data.round_id;

      if (!rounds[roundId]) rounds[roundId] = [];
      rounds[roundId].push(data);

      if (data.team_a) {
        if (!paths[data.team_a]) paths[data.team_a] = [];
        paths[data.team_a].push({
          round: roundId,
          match_id: data.match_id,
          side: "A"
        });
      }

      if (data.team_b) {
        if (!paths[data.team_b]) paths[data.team_b] = [];
        paths[data.team_b].push({
          round: roundId,
          match_id: data.match_id,
          side: "B"
        });
      }
    });

    Object.keys(paths).forEach(teamId => {
      paths[teamId].sort((a, b) => a.round - b.round);
    });

    Object.keys(rounds).forEach(roundId => {
      rounds[roundId].sort((a, b) =>
        String(a.match_id || '').localeCompare(String(b.match_id || ''))
      );
    });

    res.status(200).json({
      tournament_id: tournamentId,
      rounds,
      paths,
      thirdPlaceMatch
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
const { generateFinalsIfReady, propagateFinalsResult } = require('./helpers/finalsGenerator');
const { updateTournamentStatus } = require('./helpers/tournamentStatus');
const { updateRanking } = require('./helpers/rankingCalculator');




// ===============================
// HELPER: Invia email richiesta info squadre
// ===============================
async function sendTeamInfoRequestEmails(tournamentId) {
  try {
    console.log(`📧 Checking team info request emails for ${tournamentId}`);
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) throw new Error('Tournament not found');

    const tournament = tournamentDoc.data();
    const mailConfig = toStringSafe(tournament.mail, "").toLowerCase();

    if (!mailConfig.includes("info")) {
      console.log(`ℹ️ Skipping team info emails: "info" not present in mail config (${mailConfig})`);
      return; 
    }

    const tournamentName   = toStringSafe(tournament.name);
    const teamSizeMin      = toNumberSafe(tournament.team_size_min, 2);
    const teamSizeMax      = toNumberSafe(tournament.team_size_max, 2);
    const sport            = toStringSafe(tournament.sport, "Sport");
    const individualOrTeam = toStringSafe(tournament.individual_or_team, 'team').toLowerCase();
    
    // MODIFICA QUI: Normalizziamo in stringa
    const certificateRequired = toStringSafe(tournament.certificate_required, 'na').toLowerCase();

    const subscriptionsSnapshot = await db.collection('subscriptions').where('tournament_id', '==', tournamentId).get();
    if (subscriptionsSnapshot.empty) return;

    const mailerUrl   = "https://script.google.com/macros/s/AKfycbzZCR67pfMZqESZrxAmTuGoJ4lUHCdY3czvsmZbuwuA3Kcor56eWSC-Q2r0p7FEDpVM/exec";
    const mailerToken = "wEcqf3I7RBhXUv2QXhyhkrvfwUZCGWt9IXLnGA6koyTKqHHD9phsP0sKV7kxJO";

    const emailPromises = subscriptionsSnapshot.docs.map(async (doc) => {
      const sub = doc.data();
      const payload = {
        token: mailerToken,
        to: sub.email,
        team_name: sub.team_name,
        team_id: sub.team_id,
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        team_size_min: teamSizeMin,
        team_size_max: teamSizeMax,
        sport: sport,
        individual_or_team: individualOrTeam,
        certificate_required: certificateRequired // Passa la stringa ("true", "false", "na")
      };

      try {
        const response = await axios.post(mailerUrl, payload, { timeout: 30000 });
        if (response.data === "OK") {
          await doc.ref.update({ teamInfoEmailStatus: "sent", teamInfoEmailSentAt: new Date().toISOString() });
        }
      } catch (error) { console.error(`❌ Email error for ${sub.email}:`, error.message); }
    });

    await Promise.all(emailPromises);
  } catch (error) { console.error('sendTeamInfoRequestEmails error:', error); throw error; }
}



// ===============================
// FIRESTORE TRIGGER: GENERATE MATCHES ON STATUS CHANGE
// ===============================
exports.onTournamentStatusChange = onDocumentUpdated(
  "tournaments/{tournamentId}",
  async (event) => {
    const tournamentId = event.params.tournamentId;
    
    const beforeData = event.data.before.data();
    const afterData  = event.data.after.data();
    
    const oldStatus = toStringSafe(beforeData?.status).toLowerCase();
    const newStatus = toStringSafe(afterData?.status).toLowerCase();
    
    console.log(`🔄 Tournament ${tournamentId} status change: ${oldStatus} → ${newStatus}`);
    
    if (oldStatus === 'open' && newStatus === 'wip') {
      console.log(`📧 Triggering team info email for ${tournamentId}`);
      try {
        await sendTeamInfoRequestEmails(tournamentId);
        console.log(`✅ Team info emails sent for ${tournamentId}`);
      } catch (error) {
        console.error(`❌ Team info email failed for ${tournamentId}:`, error);
      }
    }

    if (oldStatus === 'wip' && newStatus === 'full') {
      console.log(`🚀 Triggering match generation for ${tournamentId}`);
      try {
        await generateMatchesIfReady(tournamentId);
        await generateStandingsBackend(tournamentId);
        console.log(`✅ Match generation completed for ${tournamentId}`);
      } catch (error) {
        console.error(`❌ Match generation failed for ${tournamentId}:`, error);
      }
    }

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
    const afterData  = event.data.after.data();
    
    const tournamentId = afterData?.tournament_id;
    
    if (!tournamentId) {
      console.log(`⚠️ Match ${matchId} has no tournament_id`);
      return null;
    }
    
    const beforePlayed  = toBooleanSafe(beforeData?.played);
    const afterPlayed   = toBooleanSafe(afterData?.played);

    // FIX BUG 2 (applicato anche qui per coerenza):
    // confronto numerico per score_a/score_b per evitare falsi negativi
    // quando uno dei due è numero e l'altro stringa
    const scoreChanged =
      toNumberSafe(beforeData?.score_a, null) !== toNumberSafe(afterData?.score_a, null) ||
      toNumberSafe(beforeData?.score_b, null) !== toNumberSafe(afterData?.score_b, null);
    
    if (!afterPlayed && !scoreChanged) {
      console.log(`ℹ️ Match ${matchId} - no relevant changes`);
      return null;
    }
    
    console.log(`🔄 Match ${matchId} result updated: ${afterData.score_a} - ${afterData.score_b}`);
    
    try {
      await generateStandingsBackend(tournamentId);
      console.log(`✅ Standings recalculated for ${tournamentId}`);

      await updateRanking(tournamentId);
      console.log(`✅ Ranking updated for ${tournamentId}`);
      
      await updateTournamentStatus(tournamentId);
      
      const allMatchesSnapshot = await db.collection('matches')
        .where('tournament_id', '==', tournamentId)
        .get();
      
      const allMatches = allMatchesSnapshot.docs.map(doc => doc.data());
      const allPlayed  = allMatches.every(m => toBooleanSafe(m.played));
      
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
// ===============================
exports.onFinalResultUpdated = onDocumentUpdated(
  "finals/{matchId}",
  async (event) => {
    const matchId = event.params.matchId;
    
    const beforeData = event.data.before.data();
    const afterData  = event.data.after.data();
    
    const tournamentId = afterData?.tournament_id;
    
    if (!tournamentId) {
      console.log(`⚠️ Final ${matchId} has no tournament_id`);
      return null;
    }
    
    const beforePlayed = toBooleanSafe(beforeData?.played);
    const afterPlayed  = toBooleanSafe(afterData?.played);

    // FIX BUG 2: confronto numerico per score_a/score_b per evitare falsi
    // negativi quando uno dei due è numero e l'altro stringa (es. 2 vs "2")
    const scoreChanged =
      toNumberSafe(beforeData?.score_a, null) !== toNumberSafe(afterData?.score_a, null) ||
      toNumberSafe(beforeData?.score_b, null) !== toNumberSafe(afterData?.score_b, null) ||
      toStringSafe(beforeData?.winner_team_id) !== toStringSafe(afterData?.winner_team_id);
    
    const justBecamePlayed = !beforePlayed && afterPlayed;
    const resultCorrected  = beforePlayed && afterPlayed && scoreChanged;

    if (!justBecamePlayed && !resultCorrected) {
      console.log(`ℹ️ Final ${matchId} - no relevant changes`);
      return null;
    }
    
    console.log(`🔄 Final ${matchId} result updated: ${afterData.score_a} - ${afterData.score_b} (winner: ${afterData.winner_team_id})`);
    
    // FIX BUG 2: confronto numerico invece di === per rilevare il pareggio
    // Evita falsi negativi quando score_a/score_b sono di tipo diverso
    const scoreA = toNumberSafe(afterData.score_a, null);
    const scoreB = toNumberSafe(afterData.score_b, null);
    if (scoreA !== null && scoreB !== null && scoreA === scoreB && !afterData.winner_team_id) {
      console.log(`⚠️ Final ${matchId} is a tie but no winner_team_id specified`);
      return null;
    }
    
    try {
      await propagateFinalsResult(tournamentId, matchId);

      await updateRanking(tournamentId);
      console.log(`✅ Ranking updated after final for ${tournamentId}`);
      
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
exports.submitSubscription = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).send('METHOD_NOT_ALLOWED');
  }

  try {
    const {
      tournament_id,
      team_name,
      email,
      phone,
      preferred_zone,
      preferred_days,
      preferred_hours,
      additional_notes,
      confirm_same_team_name_other_tournament
    } = req.body;

    if (!tournament_id || !team_name || !email) {
      return res.status(400).send('INVALID_DATA');
    }

    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return res.status(404).send('TOURNAMENT_NOT_FOUND');
    }

    const tournament = tournamentDoc.data();
    const status = toStringSafe(tournament.status).toLowerCase();

    if (status !== 'open') {
      return res.status(403).send('REGISTRATIONS_CLOSED');
    }

    const fixedCourtDaysHours = toStringSafe(tournament.fixed_court_days_hours, 'false').toLowerCase();
    const needsPreferences    = fixedCourtDaysHours !== 'fixed_all';

    const isIndividual        = toStringSafe(tournament.individual_or_team, 'team').toLowerCase() === 'individual';
    const certValue = toStringSafe(tournament.certificate_required, 'na').toLowerCase();
    const isCertRequired = certValue !== 'na';
    const teamSizeMax         = toNumberSafe(tournament.team_size_max, 2);

    const normalizedTeamName  = normalizeTeamNameForCheck(team_name);
    const normalizedEmail     = normalizeEmailForCheck(email);
    const confirmSameNameOtherTournament = toBooleanSafe(confirm_same_team_name_other_tournament);

    if (!normalizedTeamName || !normalizedEmail) {
      return res.status(400).send('INVALID_DATA');
    }

    const teamId = `${tournament_id}_${normalizedTeamName}`;

    // ===============================
    // BLOCCO: stesso nome squadra nello stesso torneo
    // ===============================
    const sameTournamentSubsSnap = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .get();

    const sameTournamentDuplicateTeam = sameTournamentSubsSnap.docs.find(doc => {
      const data = doc.data();
      return normalizeTeamNameForCheck(data.team_name) === normalizedTeamName;
    });

    if (sameTournamentDuplicateTeam) {
      return res.status(409).send('DUPLICATE_TEAM');
    }

    // ===============================
    // BLOCCO: stessa email nello stesso torneo
    // ===============================
    const sameTournamentDuplicateEmail = sameTournamentSubsSnap.docs.find(doc => {
      const data = doc.data();
      return normalizeEmailForCheck(data.email) === normalizedEmail;
    });

    if (sameTournamentDuplicateEmail) {
      return res.status(409).send('DUPLICATE_EMAIL');
    }

    // ===============================
    // WARNING / CONFERMA:
    // stesso nome squadra in altro torneo dello stesso sport
    // ===============================
    const sameNameInOtherTournament = await findSameTeamNameInSameSportOtherTournaments({
      currentTournamentId: tournament_id,
      sport: tournament.sport,
      normalizedTeamName
    });

    if (sameNameInOtherTournament.found && !confirmSameNameOtherTournament) {
      return res.status(409).json({
        error: 'TEAM_NAME_ALREADY_USED_IN_OTHER_TOURNAMENT_SAME_SPORT',
        requires_confirmation: true,
        message: 'Esiste già una squadra con questo nome in un altro torneo dello stesso sport. Se sei davvero tu e vuoi usare di nuovo questo nome, conferma esplicitamente.',
        existing_tournaments: sameNameInOtherTournament.tournaments
      });
    }

    const existingSubsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .get();

    const subsCount      = existingSubsSnapshot.size + 1;
    const subscriptionId = `${tournament_id}_sub${subsCount}`;

    const subscriptionData = {
      subscription_id: subscriptionId,
      team_id: teamId,
      tournament_id,
      team_name: team_name.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : '',
      payment: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      confirm_same_team_name_other_tournament: confirmSameNameOtherTournament
    };

    if (needsPreferences) {
      if (preferred_zone)  subscriptionData.preferred_zone  = preferred_zone.trim();
      if (preferred_days)  subscriptionData.preferred_days  = preferred_days.trim();
      if (preferred_hours) subscriptionData.preferred_hours = preferred_hours.trim();
    }

    if (additional_notes && additional_notes.trim()) {
      subscriptionData.additional_notes = additional_notes.trim();
    }

    await db.collection('subscriptions').doc(subscriptionId).set(subscriptionData);

    const teamData = {
      team_id: teamId,
      tournament_id,
      team_name: team_name.trim(),
      team_logo: null
    };

    if (isIndividual) {
      teamData['name_player_1'] = team_name.trim();
      if (isCertRequired) teamData['certificato_player_1'] = null;
    } else {
      for (let i = 1; i <= teamSizeMax; i++) {
        teamData[`name_player_${i}`] = null;
        if (isCertRequired) teamData[`certificato_player_${i}`] = null;
      }
    }

    await db.collection('teams').doc(teamId).set(teamData);

    console.log(`✅ Team ${teamId} created (individual: ${isIndividual}, cert_config: ${certValue})`);

    return res.status(200).send('SUBSCRIPTION_SAVED');

  } catch (error) {
    console.error('submitSubscription error:', error);
    return res.status(500).send('ERROR');
  }
});


// ===============================
// POST: SUBMIT TEAM INFO
// ===============================
exports.submitTeamInfo = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).send('METHOD_NOT_ALLOWED');
  }

  try {
    console.log('📥 submitTeamInfo called');

    const {
      team_id,
      tournament_id,
      players,
      logo_base64,
      logo_filename
    } = req.body;

    console.log('📦 Received data:', {
      team_id,
      tournament_id,
      players_count: players ? players.length : 0,
      has_logo: !!logo_base64
    });

    if (!team_id || !tournament_id || !players) {
      console.error('❌ Validation failed: missing required fields');
      return res.status(400).send('INVALID_DATA');
    }

    if (!Array.isArray(players) || players.length === 0) {
      console.error('❌ Validation failed: invalid players array');
      return res.status(400).send('INVALID_PLAYERS');
    }

    console.log('✅ Validation passed');

    const teamDoc = await db.collection('teams').doc(team_id).get();
    if (!teamDoc.exists) {
      console.error('❌ Team not found:', team_id);
      return res.status(404).send('TEAM_NOT_FOUND');
    }

    const teamData = teamDoc.data();
    console.log('✅ Team found:', team_id);

    if (teamData.tournament_id !== tournament_id) {
      console.error('❌ Tournament mismatch');
      return res.status(403).send('TOURNAMENT_MISMATCH');
    }

    // FIX BUG 1: toBooleanSafe per gestire sia boolean sia stringa "true"
    // Evita che una squadra possa sovrascrivere i dati già inseriti
    if (toBooleanSafe(teamData.info_completed)) {
      console.error('❌ Already completed');
      return res.status(409).send('ALREADY_COMPLETED');
    }

    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      console.error('❌ Tournament not found:', tournament_id);
      return res.status(404).send('TOURNAMENT_NOT_FOUND');
    }

    const tournamentDataFromDb = tournamentDoc.data();
    const teamSizeMax     = toNumberSafe(tournamentDataFromDb.team_size_max, 2);
    const isIndividual    = toStringSafe(tournamentDataFromDb.individual_or_team, 'team').toLowerCase() === 'individual';
    const certValue       = toStringSafe(tournamentDataFromDb.certificate_required, 'na').toLowerCase();
    const isCertVisible   = certValue !== 'na';

    console.log('📋 Tournament info:', {
      name: tournamentDataFromDb.name,
      team_size_max: teamSizeMax,
      is_individual: isIndividual,
      cert_config: certValue
    });

    const updateData = {
      info_completed:    true,
      info_completed_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // ===============================
    // UPLOAD LOGO (se presente)
    // ===============================
    if (logo_base64 && logo_filename) {
      try {
        console.log('📤 Uploading logo:', logo_filename);

        const bucket    = admin.storage().bucket('ice-tournaments-ba14a.firebasestorage.app');
        const logoPath  = `teams/${team_id}/logo_${Date.now()}_${logo_filename}`;
        const logoFile  = bucket.file(logoPath);
        const logoBuffer = Buffer.from(logo_base64, 'base64');

        let contentType = 'image/png';
        if (logo_filename.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
        else if (logo_filename.match(/\.svg$/i))   contentType = 'image/svg+xml';

        await logoFile.save(logoBuffer, { metadata: { contentType }, public: true });

        const logoUrl = `https://storage.googleapis.com/${bucket.name}/${logoPath}`;
        updateData.team_logo = logoUrl;
        console.log(`✅ Logo uploaded: ${logoUrl}`);
      } catch (err) {
        console.error('❌ Logo upload error:', err.message);
      }
    }

    // ===============================
    // PROCESSA GIOCATORI + CERTIFICATI
    // ===============================
    const bucket = admin.storage().bucket('ice-tournaments-ba14a.firebasestorage.app');

    for (let i = 0; i < Math.min(players.length, teamSizeMax); i++) {
      const player      = players[i];
      const playerIndex = i + 1;

      console.log(`👤 Processing player ${playerIndex}:`, player.name);

      if (!isIndividual) {
        if (player.name && player.name.trim()) {
          updateData[`name_player_${playerIndex}`] = player.name.trim();
          console.log(`✅ Player ${playerIndex} name saved`);
        }
      } else {
        console.log(`ℹ️ Individual tournament - skipping name update for player ${playerIndex}`);
      }

      if (isCertVisible) {
        if (player.certificate_base64 && player.certificate_filename) {
          try {
            console.log(`📤 Uploading certificate for player ${playerIndex}:`, player.certificate_filename);

            const certPath   = `teams/${team_id}/certificates/player_${playerIndex}_${Date.now()}_${player.certificate_filename}`;
            const certFile   = bucket.file(certPath);
            const certBuffer = Buffer.from(player.certificate_base64, 'base64');

            let contentType = 'application/pdf';
            if (player.certificate_filename.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
            else if (player.certificate_filename.match(/\.png$/i))   contentType = 'image/png';

            await certFile.save(certBuffer, { metadata: { contentType }, public: true });

            const certUrl = `https://storage.googleapis.com/${bucket.name}/${certPath}`;
            updateData[`certificato_player_${playerIndex}`] = certUrl;
            console.log(`✅ Certificate uploaded for player ${playerIndex}`);
          } catch (err) {
            console.error(`❌ Certificate upload error for player ${playerIndex}:`, err.message);
          }
        } else {
          console.warn(`⚠️ Player ${playerIndex} missing certificate data (certificate_required = true)`);
        }
      }
    }

    console.log('💾 Updating Firestore...');
    await db.collection('teams').doc(team_id).update(updateData);
    console.log(`✅ Team info completed for ${team_id}`);

    res.status(200).send('INFO_SAVED');

  } catch (error) {
    console.error('❌ submitTeamInfo FATAL error:', error);
    res.status(500).send('ERROR');
  }
});



// ===============================
// FIRESTORE TRIGGER: SEND PAYMENT EMAIL ON NEW SUBSCRIPTION
// ===============================
exports.onSubscriptionCreated = onDocumentCreated(
  "subscriptions/{subscriptionId}",
  async (event) => {
    const subscription   = event.data.data();
    const subscriptionId = event.params.subscriptionId;

    // 1. Controllo se l'email è già stata inviata (prevenzione doppioni)
    if (toBooleanSafe(subscription.emailStatus) ||
        toStringSafe(subscription.emailStatus).toLowerCase() === 'sent') {
      console.log(`Email già inviata per subscription ${subscriptionId}`);
      return null;
    }

    const tournamentId = subscription.tournament_id;
    const teamName     = subscription.team_name;
    const email        = subscription.email;

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

      // =====================================================
      // 2. LOGICA DI FILTRO BASATA SULLA VARIABILE "MAIL"
      // =====================================================
      const mailConfig = toStringSafe(tournament.mail, "").toLowerCase().trim();
      
      // Se la parola "pay" non è presente nella configurazione, usciamo senza inviare
      if (!mailConfig.includes("pay")) {
        console.log(`ℹ️ Invio mail pagamento saltato: configurazione mail "${mailConfig}" non include "pay"`);
        // Aggiorniamo comunque lo stato per evitare che il trigger riparta o sembri in errore
        await event.data.ref.update({ emailStatus: "skipped_by_config" });
        return null;
      }

      const amount          = toNumberSafe(tournament.price, null);
      const tournamentName  = toStringSafe(tournament.name);
      const individualOrTeam = toStringSafe(tournament.individual_or_team, 'team').toLowerCase();

      if (amount === null) {
        console.error(`Prezzo non definito per tournament ${tournamentId}`);
        await event.data.ref.update({ emailStatus: "error", emailError: "price_not_defined" });
        return null;
      }

      const paymentConfig = {
        iban: "IT36T0200820097000105204736",
        paypalLink: `https://paypal.me/TommasoRabino/${amount}`,
        satispayLink: "https://web.satispay.com/download/qrcode/S6Y-CON--3CE36B7D-DE23-4026-8995-5F35569E3CF4"
      };

      const mailerUrl   = "https://script.google.com/macros/s/AKfycbxVl6Yr1BhnUCS6rt9BAvRmm_fa4SYvacpEw-7-EyQ-3vtImJ-i9RrUbegPukh_lfgL7w/exec";
      const mailerToken = "wEcqf3I7RBhXUv2QXhyhkrvfwUZCGWt9IXLnGA6koyTKqHHD9phsP0sKV7kxJO";

      const payload = {
        token: mailerToken,
        to: email,
        team_name: teamName,
        tournament_name: tournamentName,
        amount: amount,
        iban: paymentConfig.iban,
        paypalLink: paymentConfig.paypalLink,
        satispayLink: paymentConfig.satispayLink,
        individual_or_team: individualOrTeam
      };

      const response = await axios.post(mailerUrl, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      });

      if (response.data === "OK") {
        console.log(`✅ Email inviata con successo a ${email} per subscription ${subscriptionId}`);
        await event.data.ref.update({
          emailStatus: "sent",
          emailSentAt: new Date().toISOString()
        });
      } else {
        console.error(`❌ Risposta mailer non OK: ${response.data}`);
        await event.data.ref.update({
          emailStatus: "error",
          emailError: `mailer_response_${response.data}`
        });
      }

    } catch (error) {
      console.error(`❌ Errore invio email per subscription ${subscriptionId}:`, error.message);
      await event.data.ref.update({
        emailStatus: "error",
        emailError: error.message
      });
    }

    return null;
  }
);


// ===============================
// GET: TEAM INFO (per form pre-compilazione)
// ===============================
exports.getTeamInfo = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const teamId       = req.query.team_id;
    const tournamentId = req.query.tournament_id;

    if (!teamId || !tournamentId) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
    }

    const teamData = teamDoc.data();

    if (teamData.tournament_id !== tournamentId) {
      return res.status(403).json({ error: 'TOURNAMENT_MISMATCH' });
    }

    // FIX BUG 1: toBooleanSafe per gestire sia boolean sia stringa "true"
    if (toBooleanSafe(teamData.info_completed)) {
      return res.status(409).json({
        error: 'ALREADY_COMPLETED',
        message: 'Hai già completato la registrazione per questo torneo.'
      });
    }

    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
    }

    const tournamentData = tournamentDoc.data();
    const isIndividual   = toStringSafe(tournamentData.individual_or_team, 'team').toLowerCase() === 'individual';

    const response = {
      team: {
        team_id:       teamData.team_id,
        team_name:     teamData.team_name,
        tournament_id: teamData.tournament_id,
        ...(isIndividual && { name_player_1: teamData.name_player_1 || teamData.team_name })
      },
      tournament: {
        tournament_id:        tournamentData.tournament_id || tournamentId,
        name:                 tournamentData.name,
        sport:                toStringSafe(tournamentData.sport, 'Sport'),
        team_size_min:        toNumberSafe(tournamentData.team_size_min, 2),
        team_size_max:        toNumberSafe(tournamentData.team_size_max, 2),
        individual_or_team:   toStringSafe(tournamentData.individual_or_team, 'team'),
        // MODIFICA QUI: Forza stringa per NA, true, false
        certificate_required: toStringSafe(tournamentData.certificate_required, 'na')
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('getTeamInfo error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});



// ===============================
// GET TEAMS WITH LOGOS (from teams collection)
// ===============================
exports.getTeamsWithLogos = onRequest(async (req, res) => {
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

    const teams = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        team_id:   data.team_id,
        team_name: data.team_name,
        team_logo: data.team_logo || null
      };
    });

    teams.sort((a, b) => 
      String(a.team_name || '').localeCompare(String(b.team_name || ''))
    );

    res.status(200).json(teams);
  } catch (error) {
    console.error('getTeamsWithLogos error:', error);
    res.status(500).json([]);
  }
});



// ===============================
// GET TEAMS LOGOS MAP (lightweight)
// ===============================
exports.getTeamsLogosMap = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const tournamentId = req.query.tournament_id;
    
    if (!tournamentId) {
      return res.status(200).json({});
    }

    const snapshot = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    const logosMap = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.team_id) {
        logosMap[data.team_id] = data.team_logo || null;
      }
    });

    res.status(200).json(logosMap);
  } catch (error) {
    console.error('getTeamsLogosMap error:', error);
    res.status(500).json({});
  }
});




// ===============================
// FIRESTORE TRIGGER: AUTO GENERATE TEAM LOGO
// ===============================
exports.onTeamInfoCompleted = onDocumentUpdated(
  {
    document: "teams/{teamId}",
    secrets: [OPENAI_API_KEY]
  },
  async (event) => {

    const teamId = event.params.teamId;

    const beforeData = event.data.before.data();
    const afterData  = event.data.after.data();

    const beforeCompleted = toBooleanSafe(beforeData?.info_completed);
    const afterCompleted  = toBooleanSafe(afterData?.info_completed);

    if (beforeCompleted || !afterCompleted) {
      return null;
    }

    // FIX BUG 4: toBooleanSafe per logo_generated per gestire sia
    // boolean sia stringa "true" in modo robusto
    if (afterData.team_logo || toBooleanSafe(afterData.logo_generated)) {
      console.log(`🖼️ Team ${teamId} already has logo`);
      return null;
    }

    const teamName     = afterData.team_name;
    const tournamentId = afterData.tournament_id;

    let isIndividual = false;
    try {
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
      if (tournamentDoc.exists) {
        const tournamentData = tournamentDoc.data();
        isIndividual = toStringSafe(tournamentData.individual_or_team, 'team').toLowerCase() === 'individual';
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch tournament data, defaulting to team prompt:', err.message);
    }

    let prompt;
    if (isIndividual) {
      const initials = teamName
        .trim()
        .split(/\s+/)
        .map(word => word[0]?.toUpperCase() || '')
        .join('');
      prompt = `Minimal flat vector avatar with the initials "${initials}" in bold letters, simple geometric background shape, bold contrasting colors, centered, no additional text, white background`;
      console.log(`🎨 Individual tournament — using initials prompt: "${initials}"`);
    } else {
      prompt = `Minimal flat vector emblem inspired by the name "${teamName}", simple geometric shapes, bold colors, centered symbol, no text, white background`;
      console.log(`🎨 Team tournament — using name prompt: "${teamName}"`);
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value()
    });

    try {
      const result = await openai.images.generate({
        model: "gpt-image-1-mini",
        size: "1024x1024",
        prompt
      });

      const base64Image = result.data[0].b64_json;
      const imageBuffer = Buffer.from(base64Image, "base64");

      console.log("🖼️ Image generated, resizing...");

      const resizedImage = await sharp(imageBuffer)
        .resize(128, 128)
        .png({ quality: 80 })
        .toBuffer();

      console.log("📦 Image resized to 128px");

      const bucket   = admin.storage().bucket("ice-tournaments-ba14a.firebasestorage.app");
      const logoPath = `teams/${teamId}/generated_logo.png`;
      const file     = bucket.file(logoPath);

      await file.save(resizedImage, {
        metadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000"
        },
        public: true
      });

      const logoUrl = `https://storage.googleapis.com/${bucket.name}/${logoPath}`;
      console.log(`✅ Logo uploaded: ${logoUrl}`);

      await db.collection("teams").doc(teamId).update({
        team_logo:      logoUrl,
        logo_generated: true
      });

      console.log(`🏁 Team ${teamId} updated with generated logo`);

    } catch (error) {
      console.error("❌ Logo generation error:", error);
    }

    return null;
  }
);




// ===============================
// GET RANKING TEAMS
// ===============================
exports.getRankingTeams = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const sport    = toStringSafe(req.query.sport).toLowerCase();
    const orderBy  = req.query.orderBy || 'punti';

    if (!sport) {
      return res.status(400).json({ error: 'MISSING_SPORT' });
    }

    if (sport === 'scacchi') {
      return res.status(200).json([]);
    }

    const validOrderFields = ['punti', 'punti_per_partita', 'presenze', 'vittorie', 'gol', 'pct_vittorie'];
    const safeOrder = validOrderFields.includes(orderBy) ? orderBy : 'punti';

    const snapshot = await db.collection('ranking_teams')
      .where('sport', '==', sport)
      .get();

    const ranking = snapshot.docs.map(doc => doc.data());

    ranking.sort((a, b) =>
      (b[safeOrder] ?? 0) - (a[safeOrder] ?? 0) ||
      (b.punti ?? 0) - (a.punti ?? 0) ||
      String(a.team_name || '').localeCompare(String(b.team_name || ''))
    );

    res.status(200).json(ranking);
  } catch (error) {
    console.error('getRankingTeams error:', error);
    res.status(500).json([]);
  }
});

// ===============================
// GET RANKING PLAYERS
// ===============================
exports.getRankingPlayers = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const sport   = toStringSafe(req.query.sport).toLowerCase();
    const orderBy = req.query.orderBy || 'punti';

    if (!sport) {
      return res.status(400).json({ error: 'MISSING_SPORT' });
    }

    const validOrderFields = ['punti', 'punti_per_partita', 'presenze', 'vittorie', 'gol', 'media_gol', 'pct_vittorie'];
    const safeOrder = validOrderFields.includes(orderBy) ? orderBy : 'punti';

    const snapshot = await db.collection('ranking_players')
      .where('sport', '==', sport)
      .get();

    const ranking = snapshot.docs.map(doc => doc.data());

    ranking.sort((a, b) =>
      (b[safeOrder] ?? 0) - (a[safeOrder] ?? 0) ||
      (b.punti ?? 0) - (a.punti ?? 0) ||
      String(a.player_name || '').localeCompare(String(b.player_name || ''))
    );

    res.status(200).json(ranking);
  } catch (error) {
    console.error('getRankingPlayers error:', error);
    res.status(500).json([]);
  }
});


// ===============================
// GET: CHECK TEAM NAME AVAILABILITY
// ===============================
exports.checkTeamName = onRequest(async (req, res) => {
  setCORS(res);
  if (handleOptions(req, res)) return;

  try {
    const { team_name, tournament_id } = req.query;

    if (!team_name || !tournament_id) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
    }

    const tournament = tournamentDoc.data();

    const nameNorm = normalizeTeamNameForCheck(team_name);
    if (!nameNorm) {
      return res.status(400).json({ error: 'INVALID_TEAM_NAME' });
    }

    // ===============================
    // Controllo BLOCCANTE: stesso nome nello stesso torneo
    // ===============================
    const sameTournamentSubsSnap = await db.collection('subscriptions')
      .where('tournament_id', '==', tournament_id)
      .get();

    const duplicateInSameTournament = sameTournamentSubsSnap.docs.some(doc => {
      const sub = doc.data();
      return normalizeTeamNameForCheck(sub.team_name) === nameNorm;
    });

    if (duplicateInSameTournament) {
      return res.status(200).json({
        available: false,
        exact_duplicate_in_same_tournament: true,
        duplicate_in_same_sport_other_tournament: false
      });
    }

    // ===============================
    // Controllo NON BLOCCANTE: stesso nome in altro torneo stesso sport
    // ===============================
    const sameNameInOtherTournament = await findSameTeamNameInSameSportOtherTournaments({
      currentTournamentId: tournament_id,
      sport: tournament.sport,
      normalizedTeamName: nameNorm
    });

    return res.status(200).json({
      available: true,
      exact_duplicate_in_same_tournament: false,
      duplicate_in_same_sport_other_tournament: sameNameInOtherTournament.found,
      existing_tournaments: sameNameInOtherTournament.tournaments
    });

  } catch (error) {
    console.error('checkTeamName error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});