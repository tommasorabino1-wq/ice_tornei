const admin = require('firebase-admin');
const db = admin.firestore();



// ===============================
// HELPER: Match profile (sport + format)
// ===============================
function getMatchProfile(sport, matchFormat) {
  const s = String(sport || '').toLowerCase().trim();
  const f = String(matchFormat || '').toLowerCase().trim();

  const isChess    = s.includes('scacchi') || s.includes('chess');
  const isSetBased = f.includes('su'); // 1su1, 2su3, 3su5
  const isCalcio   = !isChess && (s.includes('calcio') || s.includes('football') || s.includes('soccer'));
  const isPadel    = s.includes('padel');
  const isBeach    = s.includes('beach') || s.includes('volley');

  let normalizedSport = 'calcio';
  if (isChess)      normalizedSport = 'scacchi';
  else if (isPadel) normalizedSport = 'padel';
  else if (isBeach) normalizedSport = 'beach_volley';

  const hasGoals   = isCalcio;
  const hasGames   = (isPadel || isBeach) && !isSetBased;
  const hasScorers = isCalcio;

  return { isChess, isSetBased, isCalcio, isPadel, isBeach, normalizedSport, hasGoals, hasGames, hasScorers };
}



// ===============================
// HELPER: Check if format has finals
// ===============================
function formatHasFinals(formatType) {
  const formatsWithFinals = ['round_robin_finals', 'double_round_robin_finals'];
  return formatsWithFinals.includes(String(formatType || '').toLowerCase());
}

// ===============================
// HELPER: Controlla parità intra-girone nelle standings
// ===============================
function checkIntraGroupTies(byGroup, standingsIsSetBased) {
  for (const [groupId, group] of Object.entries(byGroup)) {
    const byRank = {};
    group.forEach(s => {
      const rank = s.rank_level;
      if (!byRank[rank]) byRank[rank] = [];
      byRank[rank].push(s);
    });
    for (const [rank, teams] of Object.entries(byRank)) {
      if (teams.length > 1) {
        console.error(`❌ Tie at rank ${rank} in group ${groupId}: ${teams.map(t => t.team_name).join(', ')}`);
        throw new Error('E6');
      }
    }
  }
}

// ===============================
// HELPER: Controlla parità cross-girone
// ===============================
function checkCrossGroupTie(sorted, need, standingsIsSetBased, standingsIsChess) {
  if (need <= 0 || sorted.length <= need) return;
  const A = sorted[need - 1];
  const B = sorted[need];
  let same;

  if (standingsIsChess) {
    // Scacchi: parità solo su punti totali → sorteggio manuale, non bloccante
    same = A.points === B.points;
  } else if (standingsIsSetBased) {
    same =
      A.points === B.points &&
      A.set_diff === B.set_diff &&
      A.sets_for === B.sets_for &&
      A.game_diff === B.game_diff &&
      A.games_for === B.games_for;
  } else {
    same =
      A.points === B.points &&
      A.goal_diff === B.goal_diff &&
      A.goals_for === B.goals_for;
  }

  if (same) {
    console.error(`❌ Ambiguity in cross-group selection at position ${need}`);
    throw new Error('E4');
  }
}

// ===============================
// HELPER: Ordina squadre per criteri cross-girone
// ===============================
function sortCrossGroup(teams, standingsIsSetBased, standingsIsChess) {
  if (standingsIsChess) {
    // Scacchi: solo punti totali, parità residua → stesso rank (sorteggio manuale)
    return [...teams].sort((a, b) =>
      b.points - a.points ||
      String(a.team_id).localeCompare(String(b.team_id))
    );
  }
  if (standingsIsSetBased) {
    return [...teams].sort((a, b) =>
      b.points - a.points ||
      b.set_diff - a.set_diff ||
      b.sets_for - a.sets_for ||
      b.game_diff - a.game_diff ||
      b.games_for - a.games_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );
  }
  return [...teams].sort((a, b) =>
    b.points - a.points ||
    b.goal_diff - a.goal_diff ||
    b.goals_for - a.goals_for ||
    String(a.team_id).localeCompare(String(b.team_id))
  );
}

// ===============================
// HELPER: Crea documento vuoto per un match futuro
// ===============================
function createEmptyMatchDoc(matchId, tournamentId, roundId, sport, matchFormatFinals, profile) {
  const base = {
    match_id: matchId,
    tournament_id: tournamentId,
    round_id: roundId,
    team_a: null,
    team_b: null,
    team_a_name: null,
    team_b_name: null,
    score_a: null,
    score_b: null,
    winner_team_id: null,
    played: false,
    court: 'none',
    day: 'none',
    hour: 'none',
    sport,
    match_format: matchFormatFinals,
    is_set_based: profile.isSetBased,
    is_chess: profile.isChess,
    source_matches: [],
  };

  // Campi set (padel/beach set-based)
  if (profile.isSetBased) {
    base.sets_detail = null;
    base.games_a = null;
    base.games_b = null;
  }

  // Campi game (padel/beach a tempo)
  if (profile.hasGames) {
    base.games_a = null;
    base.games_b = null;
  }

  // Campi marcatori (solo calcio)
  if (profile.hasScorers) {
    base.scorers_a = null;
    base.scorers_b = null;
  }

  return base;
}



// ===============================
// HELPER: Calcola numero di round necessari
// ===============================
function computeRounds(numTeams) {
  // Restituisce il numero di round del bracket principale (potenza di 2 più vicina)
  let rounds = 0;
  let n = numTeams;
  while (n > 1) {
    n = Math.floor(n / 2);
    rounds++;
  }
  return rounds;
}

// ===============================
// MAIN: Genera tutte le Finals (triggerata da status → final_phase)
// Genera TUTTI i round in anticipo, con i round futuri vuoti.
// Se 3_4_posto === true, genera anche il match per il 3°/4° posto.
// ===============================
async function generateFinalsIfReady(tournamentId) {
  try {
    console.log(`🏆 [START] generateFinalsIfReady for ${tournamentId}`);

    // 0) Recupera torneo
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const formatType = String(tournament.format_type || '').toLowerCase();
    const has3x4 = tournament['3_4_posto'] === true;

    // Verifica formato
    if (!formatHasFinals(formatType)) {
      console.log(`⛔ Tournament format "${formatType}" does not support finals - blocked`);
      throw new Error('E_FORMAT_NO_FINALS');
    }

    const profile        = getMatchProfile(tournament.sport, tournament.match_format_finals);
    const sport          = profile.normalizedSport;
    const matchFormatFinals = String(tournament.match_format_finals || '').toLowerCase();
    const isSetBased     = profile.isSetBased;
    const isChess        = profile.isChess;

    console.log(`🏆 Sport: ${sport}, Format Finals: ${matchFormatFinals}, Set-based: ${isSetBased}, Chess: ${isChess}, 3/4 posto: ${has3x4}`);

    // Verifica che non esistano già finals
    const existingFinals = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!existingFinals.empty) {
      console.log('⚠️ Finals already exist for this tournament - skipping');
      return;
    }

    // Recupera standings
    const standingsSnapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (standingsSnapshot.empty) {
      console.log('⚠️ No standings found');
      throw new Error('E_NO_STANDINGS');
    }

    const standings = standingsSnapshot.docs.map(doc => doc.data());
    const standingsIsSetBased = standings[0]?.is_set_based || false;
    const standingsIsChess    = standings[0]?.is_chess || false;

    // Mappa team_id -> team_name
    const teamNamesMap = {};
    standings.forEach(s => { teamNamesMap[s.team_id] = s.team_name; });

    // Raggruppa per girone
    const byGroup = {};
    standings.forEach(s => {
      if (!byGroup[s.group_id]) byGroup[s.group_id] = [];
      byGroup[s.group_id].push(s);
    });

    // Controlla parità intra-girone
    checkIntraGroupTies(byGroup, standingsIsSetBased);

    const slots = Number(tournament.teams_in_final);
    if (!slots || slots <= 0) throw new Error('E_INVALID_SLOTS');

    // Estrai teams qualificati (stessa logica di prima)
    const byRankGlobal = {};
    Object.values(byGroup).forEach(group => {
      group.forEach(s => {
        const rank = s.rank_level;
        if (!byRankGlobal[rank]) byRankGlobal[rank] = [];
        byRankGlobal[rank].push(s);
      });
    });

    let qualified = [];
    let remainingSlots = slots;

    const firsts = byRankGlobal[1] || [];
    if (firsts.length > remainingSlots) throw new Error('E_TOO_MANY_FIRSTS');
    qualified = qualified.concat(firsts);
    remainingSlots -= firsts.length;

    let currentRank = 2;
    while (remainingSlots > 0) {
      const rankTeams = byRankGlobal[currentRank] || [];
      if (rankTeams.length === 0) break;
      const sorted = sortCrossGroup(rankTeams, standingsIsSetBased, standingsIsChess);
      checkCrossGroupTie(sorted, remainingSlots, standingsIsSetBased, standingsIsChess);
      const toTake = Math.min(remainingSlots, sorted.length);
      qualified = qualified.concat(sorted.slice(0, toTake));
      remainingSlots -= toTake;
      currentRank++;
    }

    if (qualified.length !== slots) throw new Error('E_NOT_ENOUGH_TEAMS');

    console.log(`✅ Qualified: ${qualified.map(q => q.team_name).join(', ')}`);

    // ===============================
    // COSTRUISCI IL BRACKET COMPLETO
    // ===============================
    const numRounds = computeRounds(slots);
    const batch = db.batch();
    const teams = qualified.map(q => q.team_id);

    // Struttura: roundMatchIds[roundId] = [matchId, matchId, ...]
    // Serve per collegare source_matches nei round successivi
    const roundMatchIds = {};

    // --- ROUND 1: squadre reali ---
    roundMatchIds[1] = [];
    let matchIndex = 1;

    for (let i = 0; i < Math.floor(teams.length / 2); i++) {
      const teamA = teams[i];
      const teamB = teams[teams.length - 1 - i];
      const matchId = `${tournamentId}_FINAL_R1_M${matchIndex}`;
      roundMatchIds[1].push(matchId);

      const finalRef = db.collection('finals').doc(matchId);
      const doc = createEmptyMatchDoc(matchId, tournamentId, 1, sport, matchFormatFinals, profile);
      doc.team_a       = teamA;
      doc.team_b       = teamB;
      doc.team_a_name  = teamNamesMap[teamA] || teamA;
      doc.team_b_name  = teamNamesMap[teamB] || teamB;
      batch.set(finalRef, doc);

      console.log(`   ✓ R1_M${matchIndex}: ${teamNamesMap[teamA]} vs ${teamNamesMap[teamB]}`);
      matchIndex++;
    }

    // --- ROUND 2..N: vuoti, con source_matches ---
    for (let round = 2; round <= numRounds; round++) {
      const prevMatches = roundMatchIds[round - 1];
      roundMatchIds[round] = [];
      matchIndex = 1;

      for (let i = 0; i < Math.floor(prevMatches.length / 2); i++) {
        const srcA = prevMatches[i];
        const srcB = prevMatches[prevMatches.length - 1 - i];
        const matchId = `${tournamentId}_FINAL_R${round}_M${matchIndex}`;
        roundMatchIds[round].push(matchId);

        const finalRef = db.collection('finals').doc(matchId);
        const doc = createEmptyMatchDoc(matchId, tournamentId, round, sport, matchFormatFinals, profile);
        doc.source_matches = [
          { match_id: srcA, role: 'winner' },
          { match_id: srcB, role: 'winner' },
        ];
        batch.set(finalRef, doc);

        console.log(`   ✓ R${round}_M${matchIndex}: TBD vs TBD (src: ${srcA}, ${srcB})`);
        matchIndex++;
      }
    }

    // --- FINALE 3°/4° POSTO (se richiesta) ---
    // Prende i perdenti delle due semifinali (ultimo round prima della finale)
    if (has3x4 && numRounds >= 2) {
      const semifinalRound = numRounds - 1;
      const semiMatches = roundMatchIds[semifinalRound];

      if (semiMatches && semiMatches.length >= 2) {
        // Prendiamo i perdenti delle prime due semifinali
        const srcA = semiMatches[0];
        const srcB = semiMatches[1];
        const matchId = `${tournamentId}_FINAL_3X4`;

        const finalRef = db.collection('finals').doc(matchId);
        const doc = createEmptyMatchDoc(matchId, tournamentId, numRounds, sport, matchFormatFinals, profile);
        doc.source_matches = [
          { match_id: srcA, role: 'loser' },
          { match_id: srcB, role: 'loser' },
        ];
        doc.is_third_place_match = true;
        batch.set(finalRef, doc);

        console.log(`   ✓ 3x4: TBD vs TBD (loser of ${srcA}, loser of ${srcB})`);
      } else {
        console.log(`⚠️ Not enough semi-final matches to generate 3/4 place match`);
      }
    }

    await batch.commit();
    console.log(`✅ [SUCCESS] Full finals bracket generated for ${tournamentId} (${numRounds} rounds${has3x4 ? ' + 3/4 posto' : ''})`);

  } catch (error) {
    console.error('❌ [ERROR] generateFinalsIfReady failed:', error.message);
    throw error;
  }
}

// ===============================
// Popola automaticamente i match futuri quando un match viene completato
// Chiamare questa funzione ogni volta che un finale viene marcato come played: true
// ===============================
async function propagateFinalsResult(tournamentId, completedMatchId) {
  try {
    console.log(`🔄 [START] propagateFinalsResult for match ${completedMatchId}`);

    // Recupera il match completato
    const completedDoc = await db.collection('finals').doc(completedMatchId).get();
    if (!completedDoc.exists) {
      console.log('⚠️ Completed match not found');
      return;
    }

    const completed = completedDoc.data();
    if (!completed.played) {
      console.log('⚠️ Match not yet played');
      return;
    }

    const winner = completed.winner_team_id;
    const loser = winner === completed.team_a ? completed.team_b : completed.team_a;
    const winnerName = winner === completed.team_a ? completed.team_a_name : completed.team_b_name;
    const loserName = winner === completed.team_a ? completed.team_b_name : completed.team_a_name;

    if (!winner) {
      console.log('⚠️ No winner set on completed match');
      return;
    }

    console.log(`🏆 Winner: ${winnerName}, Loser: ${loserName}`);

    // Cerca tutti i match futuri che dipendono da questo match
    const dependentSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    const batch = db.batch();
    let updateCount = 0;

    for (const doc of dependentSnapshot.docs) {
      const data = doc.data();
      if (!Array.isArray(data.source_matches) || data.source_matches.length === 0) continue;

      const sources = data.source_matches;

      // Trova se questo match è una source per il documento corrente
      const srcA = sources[0]; // primo source → team_a nel match futuro
      const srcB = sources[1]; // secondo source → team_b nel match futuro

      let updates = {};

      if (srcA && srcA.match_id === completedMatchId) {
        const teamId = srcA.role === 'winner' ? winner : loser;
        const teamName = srcA.role === 'winner' ? winnerName : loserName;
        updates.team_a = teamId;
        updates.team_a_name = teamName;
        console.log(`   → ${doc.id}: team_a = ${teamName} (${srcA.role} of ${completedMatchId})`);
      }

      if (srcB && srcB.match_id === completedMatchId) {
        const teamId = srcB.role === 'winner' ? winner : loser;
        const teamName = srcB.role === 'winner' ? winnerName : loserName;
        updates.team_b = teamId;
        updates.team_b_name = teamName;
        console.log(`   → ${doc.id}: team_b = ${teamName} (${srcB.role} of ${completedMatchId})`);
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ [SUCCESS] Propagated result to ${updateCount} future match(es)`);
    } else {
      console.log('ℹ️ No dependent matches found to update');
    }

  } catch (error) {
    console.error('❌ [ERROR] propagateFinalsResult failed:', error.message);
    throw error;
  }
}

// ===============================
// DEPRECATED: tryGenerateNextFinalRound
// Mantenuta per retrocompatibilità ma non più necessaria con la nuova logica.
// I round vengono generati tutti in anticipo da generateFinalsIfReady.
// ===============================
async function tryGenerateNextFinalRound(tournamentId) {
  console.log(`⚠️ [DEPRECATED] tryGenerateNextFinalRound is no longer needed.`);
  console.log(`   All rounds are now pre-generated by generateFinalsIfReady.`);
  console.log(`   Use propagateFinalsResult to populate team names as matches are played.`);
}

module.exports = {
  generateFinalsIfReady,
  propagateFinalsResult,
  tryGenerateNextFinalRound, // mantenuta per retrocompatibilità
};