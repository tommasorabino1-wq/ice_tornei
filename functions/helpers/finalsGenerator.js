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
function checkIntraGroupTies(byGroup, slots, standingsIsSetBased) {
  const numGroups = Object.keys(byGroup).length;
  const maxRelevantRank = Math.ceil(slots / numGroups) + 1;

  for (const [groupId, group] of Object.entries(byGroup)) {
    const byRank = {};
    group.forEach(s => {
      const rank = s.rank_level;
      if (!byRank[rank]) byRank[rank] = [];
      byRank[rank].push(s);
    });
    for (const [rank, teams] of Object.entries(byRank)) {
      if (Number(rank) > maxRelevantRank) continue;
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

  if (profile.isSetBased) {
    base.sets_detail = null;
    base.games_a = null;
    base.games_b = null;
  }

  if (profile.hasGames) {
    base.games_a = null;
    base.games_b = null;
  }

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
  let rounds = 0;
  let n = numTeams;
  while (n > 1) {
    n = Math.floor(n / 2);
    rounds++;
  }
  return rounds;
}


function toBool(val) {
  if (val === true) return true;
  if (val === false) return false;

  const v = String(val ?? '').toLowerCase().trim();

  return v === 'true' || v === '1' || v === 'yes';
}

function toNumber(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;

  const n = Number(String(val).trim());
  return isNaN(n) ? fallback : n;
}

function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}



// ===============================
// MAIN: Genera tutte le Finals (triggerata da status → final_phase)
// ===============================
async function generateFinalsIfReady(tournamentId) {
  try {
    console.log(`🏆 [START] generateFinalsIfReady for ${tournamentId}`);

    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const formatType = toStringSafe(tournament.format_type).toLowerCase();
    const has3x4 = toBool(tournament['3_4_posto']);

    if (!formatHasFinals(formatType)) {
      console.log(`⛔ Tournament format "${formatType}" does not support finals - blocked`);
      throw new Error('E_FORMAT_NO_FINALS');
    }

    const profile = getMatchProfile(
      toStringSafe(tournament.sport),
      toStringSafe(tournament.match_format_finals)
    );
    const sport             = profile.normalizedSport;
    const matchFormatFinals = toStringSafe(tournament.match_format_finals).toLowerCase();
    const isSetBased        = profile.isSetBased;
    const isChess           = profile.isChess;

    console.log(`🏆 Sport: ${sport}, Format Finals: ${matchFormatFinals}, Set-based: ${isSetBased}, Chess: ${isChess}, 3/4 posto: ${has3x4}`);

    const existingFinals = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!existingFinals.empty) {
      console.log('⚠️ Finals already exist for this tournament - skipping');
      return;
    }

    const standingsSnapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (standingsSnapshot.empty) {
      console.log('⚠️ No standings found');
      throw new Error('E_NO_STANDINGS');
    }

    const standings = standingsSnapshot.docs.map(doc => doc.data());

    // FIX BUG 1: lettura is_set_based e is_chess dalle standings con toBool()
    // per gestire sia boolean nativi sia stringhe "true"/"false"
    const standingsIsSetBased = toBool(standings[0]?.is_set_based);
    const standingsIsChess    = toBool(standings[0]?.is_chess);

    const teamNamesMap = {};
    standings.forEach(s => { teamNamesMap[s.team_id] = s.team_name; });

    const byGroup = {};
    standings.forEach(s => {
      if (!byGroup[s.group_id]) byGroup[s.group_id] = [];
      byGroup[s.group_id].push(s);
    });

    const slots = toNumber(tournament.teams_in_final, 0);
    if (!slots || slots <= 0) throw new Error('E_INVALID_SLOTS');

    checkIntraGroupTies(byGroup, slots, standingsIsSetBased);

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

    const numRounds = computeRounds(slots);
    const batch = db.batch();
    const teams = qualified.map(q => q.team_id);

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
      doc.team_a      = teamA;
      doc.team_b      = teamB;
      doc.team_a_name = teamNamesMap[teamA] || teamA;
      doc.team_b_name = teamNamesMap[teamB] || teamB;
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

    // --- FINALE 3°/4° POSTO ---
    if (has3x4 && numRounds >= 2) {
      const semifinalRound = numRounds - 1;
      const semiMatches = roundMatchIds[semifinalRound];

      if (semiMatches && semiMatches.length >= 2) {
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
// ===============================
async function propagateFinalsResult(tournamentId, completedMatchId) {
  try {
    console.log(`🔄 [START] propagateFinalsResult for match ${completedMatchId}`);

    const completedDoc = await db.collection('finals').doc(completedMatchId).get();
    if (!completedDoc.exists) {
      console.log('⚠️ Completed match not found');
      return;
    }

    const completed = completedDoc.data();

    // FIX BUG 2: played letto con toBool() per gestire sia boolean sia stringa "true"
    if (!toBool(completed.played)) {
      console.log('⚠️ Match not yet played');
      return;
    }

    const winner = completed.winner_team_id;

    // FIX BUG 3: confronto esplicito con toStringSafe per evitare
    // falsi negativi quando team_a/winner_team_id sono null o tipi diversi
    const winnerIsA = toStringSafe(winner) !== '' && toStringSafe(winner) === toStringSafe(completed.team_a);
    const loser     = winnerIsA ? completed.team_b : completed.team_a;
    const winnerName = winnerIsA ? completed.team_a_name : completed.team_b_name;
    const loserName  = winnerIsA ? completed.team_b_name : completed.team_a_name;

    if (!winner) {
      console.log('⚠️ No winner set on completed match');
      return;
    }

    console.log(`🏆 Winner: ${winnerName}, Loser: ${loserName}`);

    const dependentSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    const batch = db.batch();
    let updateCount = 0;

    for (const doc of dependentSnapshot.docs) {
      const data = doc.data();
      if (!Array.isArray(data.source_matches) || data.source_matches.length === 0) continue;

      const sources = data.source_matches;
      const srcA = sources[0];
      const srcB = sources[1];

      let updates = {};

      if (srcA && srcA.match_id === completedMatchId) {
        const teamId   = srcA.role === 'winner' ? winner : loser;
        const teamName = srcA.role === 'winner' ? winnerName : loserName;
        updates.team_a      = teamId;
        updates.team_a_name = teamName;
        console.log(`   → ${doc.id}: team_a = ${teamName} (${srcA.role} of ${completedMatchId})`);
      }

      if (srcB && srcB.match_id === completedMatchId) {
        const teamId   = srcB.role === 'winner' ? winner : loser;
        const teamName = srcB.role === 'winner' ? winnerName : loserName;
        updates.team_b      = teamId;
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

    // ← AGGIUNGI QUESTE DUE RIGHE
    // Tenta aggiornamento rank finale (esce silenziosamente se non tutti i match sono giocati)
    await updateFinalRankings(tournamentId);

  } catch (error) {
    console.error('❌ [ERROR] propagateFinalsResult failed:', error.message);
    throw error;
  }
}

// ===============================
// DEPRECATED: tryGenerateNextFinalRound
// ===============================
async function tryGenerateNextFinalRound(tournamentId) {
  console.log(`⚠️ [DEPRECATED] tryGenerateNextFinalRound is no longer needed.`);
  console.log(`   All rounds are now pre-generated by generateFinalsIfReady.`);
  console.log(`   Use propagateFinalsResult to populate team names as matches are played.`);
}



async function updateFinalRankings(tournamentId) {
  try {
    console.log(`🏅 [START] updateFinalRankings for ${tournamentId}`);

    const finalsSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (finalsSnapshot.empty) {
      console.log('⚠️ No finals found');
      return;
    }

    const finals = finalsSnapshot.docs.map(doc => doc.data());

    // Esce silenziosamente se non tutti i match sono ancora giocati
    const allPlayed = finals.every(f => toBool(f.played));
    if (!allPlayed) {
      console.log('ℹ️ Not all finals matches played yet - skipping');
      return;
    }

    const regularFinals = finals.filter(f => !toBool(f.is_third_place_match));
    const maxRound = Math.max(...regularFinals.map(f => toNumber(f.round_id, 0)));

    const finalMatch = regularFinals.find(f => toNumber(f.round_id, 0) === maxRound);
    if (!finalMatch || !finalMatch.winner_team_id) {
      console.log('⚠️ Final match not found or winner not set');
      return;
    }

    const winner   = toStringSafe(finalMatch.winner_team_id);
    const winnerIsA = winner !== '' && winner === toStringSafe(finalMatch.team_a);
    const runnerUp  = toStringSafe(winnerIsA ? finalMatch.team_b : finalMatch.team_a);

    // Scrive su final_rank, NON su rank_level (quello resta dei gironi)
    const finalRankMap = {};
    finalRankMap[winner]   = 1;
    finalRankMap[runnerUp] = 2;

    const thirdPlaceMatch = finals.find(f => toBool(f.is_third_place_match));

    if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
      const thirdWinner = toStringSafe(thirdPlaceMatch.winner_team_id);
      const thirdIsA    = thirdWinner !== '' && thirdWinner === toStringSafe(thirdPlaceMatch.team_a);
      const fourthPlace = toStringSafe(thirdIsA ? thirdPlaceMatch.team_b : thirdPlaceMatch.team_a);
      finalRankMap[thirdWinner] = 3;
      finalRankMap[fourthPlace] = 4;
    } else {
      // Nessuna finale 3/4: i due semifinalisti eliminati sono 3° ex-aequo
      const semiMatches = regularFinals.filter(
        f => toNumber(f.round_id, 0) === maxRound - 1
      );
      semiMatches.forEach(m => {
        const mWinner = toStringSafe(m.winner_team_id);
        const mIsA    = mWinner !== '' && mWinner === toStringSafe(m.team_a);
        const loser   = toStringSafe(mIsA ? m.team_b : m.team_a);
        if (loser && !finalRankMap[loser]) {
          finalRankMap[loser] = 3;
        }
      });
    }

    console.log(`🏅 Final rank map:`, finalRankMap);

    const batch = db.batch();
    let updateCount = 0;

    for (const [teamId, rank] of Object.entries(finalRankMap)) {
      if (!teamId) continue;
      const standingId  = `standings_${tournamentId}_${teamId}`;
      const standingRef = db.collection('standings').doc(standingId);
      batch.update(standingRef, { final_rank: rank });
      console.log(`   ✓ ${teamId} → final_rank: ${rank}`);
      updateCount++;
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ [SUCCESS] Updated final_rank for ${updateCount} teams`);
    }

  } catch (error) {
    console.error('❌ [ERROR] updateFinalRankings failed:', error.message);
    throw error;
  }
}




module.exports = {
  generateFinalsIfReady,
  propagateFinalsResult,
  updateFinalRankings,
  tryGenerateNextFinalRound,
};