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
  if (isChess) normalizedSport = 'scacchi';
  else if (isPadel) normalizedSport = 'padel';
  else if (isBeach) normalizedSport = 'beach_volley';

  const hasGoals   = isCalcio;
  const hasGames   = (isPadel || isBeach) && !isSetBased;
  const hasScorers = isCalcio;

  return {
    isChess,
    isSetBased,
    isCalcio,
    isPadel,
    isBeach,
    normalizedSport,
    hasGoals,
    hasGames,
    hasScorers,
  };
}


// ===============================
// HELPER: Check if format has finals
// ===============================
function formatHasFinals(formatType) {
  const formatsWithFinals = ['round_robin_finals', 'double_round_robin_finals'];
  return formatsWithFinals.includes(String(formatType || '').toLowerCase());
}


// ===============================
// HELPER: Primitive safe parsers
// ===============================
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

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}


// ===============================
// HELPER: Criteri pareggio cross-group
// ===============================
function areEquivalentForCrossGroup(A, B, standingsIsSetBased, standingsIsChess) {
  if (!A || !B) return false;

  if (standingsIsChess) {
    return A.points === B.points;
  }

  if (standingsIsSetBased) {
    return (
      A.points === B.points &&
      A.set_diff === B.set_diff &&
      A.sets_for === B.sets_for &&
      A.game_diff === B.game_diff &&
      A.games_for === B.games_for
    );
  }

  return (
    A.points === B.points &&
    A.goal_diff === B.goal_diff &&
    A.goals_for === B.goals_for
  );
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
// HELPER: Raggruppa standings per gruppo
// ===============================
function buildGroups(standings) {
  const byGroup = {};

  standings.forEach(s => {
    const groupId = toStringSafe(s.group_id);
    if (!groupId) {
      throw new Error('E_INVALID_GROUP_ID');
    }
    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push(s);
  });

  return byGroup;
}


// ===============================
// HELPER: Validazioni standings
// ===============================
function validateStandings(standings) {
  if (!Array.isArray(standings) || standings.length === 0) {
    throw new Error('E_NO_STANDINGS');
  }

  for (const s of standings) {
    const teamId = toStringSafe(s.team_id);
    const groupId = toStringSafe(s.group_id);
    const teamName = toStringSafe(s.team_name);
    const rank = toNumber(s.rank_level, NaN);

    if (!teamId) throw new Error('E_INVALID_STANDING_TEAM_ID');
    if (!groupId) throw new Error('E_INVALID_STANDING_GROUP_ID');
    if (!teamName) throw new Error('E_INVALID_STANDING_TEAM_NAME');
    if (!Number.isFinite(rank) || rank <= 0) throw new Error('E_INVALID_STANDING_RANK');
  }
}

function validateStandingsFlagsConsistency(standings) {
  const standingsIsSetBased = toBool(standings[0]?.is_set_based);
  const standingsIsChess    = toBool(standings[0]?.is_chess);

  for (const s of standings) {
    if (toBool(s.is_set_based) !== standingsIsSetBased) {
      throw new Error('E_INCONSISTENT_IS_SET_BASED');
    }
    if (toBool(s.is_chess) !== standingsIsChess) {
      throw new Error('E_INCONSISTENT_IS_CHESS');
    }
  }

  return { standingsIsSetBased, standingsIsChess };
}


// ===============================
// HELPER: Seleziona qualificati in modo corretto
// ===============================
function selectQualifiedTeams(byGroup, slots, standingsIsSetBased, standingsIsChess) {
  const groups = Object.entries(byGroup);
  const numGroups = groups.length;

  if (numGroups === 0) {
    throw new Error('E_NO_GROUPS');
  }

  const maxRankPresent = Math.max(
    ...Object.values(byGroup).flat().map(s => toNumber(s.rank_level, 0))
  );

  let qualified = [];
  let remainingSlots = slots;

  for (let rank = 1; rank <= maxRankPresent && remainingSlots > 0; rank++) {
    const candidatesAtRank = [];

    for (const [groupId, group] of groups) {
      const sameRank = group.filter(s => toNumber(s.rank_level, 0) === rank);

      if (sameRank.length > 1) {
        // Questo rank è ambiguo DENTRO il girone.
        // Blocchiamo solo se questo rank ci serve davvero per completare la griglia finals.
        console.error(
          `❌ Intra-group ambiguity at rank ${rank} in group ${groupId}: ${sameRank.map(t => t.team_name).join(', ')}`
        );
        throw new Error(`E_INTRA_GROUP_TIE_AT_USED_RANK_${rank}`);
      }

      if (sameRank.length === 1) {
        candidatesAtRank.push(sameRank[0]);
      }
    }

    if (candidatesAtRank.length === 0) {
      continue;
    }

    // Se tutto questo rank entra, non serve nessun controllo cross-group:
    // stiamo prendendo tutti i rank-r disponibili.
    if (candidatesAtRank.length <= remainingSlots) {
      qualified = qualified.concat(candidatesAtRank);
      remainingSlots -= candidatesAtRank.length;
      continue;
    }

    // Qui invece questo rank entra solo in parte.
    // Serve ordinare e verificare se il cutoff è ambiguo.
    const sorted = sortCrossGroup(candidatesAtRank, standingsIsSetBased, standingsIsChess);
    const A = sorted[remainingSlots - 1];
    const B = sorted[remainingSlots];

    if (areEquivalentForCrossGroup(A, B, standingsIsSetBased, standingsIsChess)) {
      console.error(
        `❌ Cross-group ambiguity at rank ${rank}, cutoff position ${remainingSlots}: ${A.team_name} vs ${B.team_name}`
      );
      throw new Error(`E_CROSS_GROUP_TIE_AT_RANK_${rank}`);
    }

    qualified = qualified.concat(sorted.slice(0, remainingSlots));
    remainingSlots = 0;
  }

  if (qualified.length !== slots) {
    throw new Error(`E_NOT_ENOUGH_TEAMS qualified=${qualified.length} slots=${slots}`);
  }

  const qualifiedIds = qualified.map(q => toStringSafe(q.team_id)).filter(Boolean);

  if (qualifiedIds.length !== slots) {
    throw new Error('E_INVALID_QUALIFIED_TEAM_IDS');
  }

  if (new Set(qualifiedIds).size !== qualifiedIds.length) {
    throw new Error('E_DUPLICATE_QUALIFIED_TEAMS');
  }

  return qualified;
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

    const sport = profile.normalizedSport;
    const matchFormatFinals = toStringSafe(tournament.match_format_finals).toLowerCase();
    const isSetBased = profile.isSetBased;
    const isChess = profile.isChess;

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

    validateStandings(standings);

    const { standingsIsSetBased, standingsIsChess } = validateStandingsFlagsConsistency(standings);

    const slots = toNumber(tournament.teams_in_final, 0);
    if (!slots || slots <= 0) throw new Error('E_INVALID_SLOTS');
    if (!isPowerOfTwo(slots)) throw new Error('E_SLOTS_NOT_POWER_OF_TWO');
    if (has3x4 && slots < 4) throw new Error('E_3X4_REQUIRES_AT_LEAST_4_TEAMS');

    const byGroup = buildGroups(standings);

    const teamNamesMap = {};
    standings.forEach(s => {
      teamNamesMap[s.team_id] = s.team_name;
    });

    const qualified = selectQualifiedTeams(byGroup, slots, standingsIsSetBased, standingsIsChess);

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
      doc.team_a = teamA;
      doc.team_b = teamB;
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
        console.log('⚠️ Not enough semi-final matches to generate 3/4 place match');
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

    if (!toBool(completed.played)) {
      console.log('⚠️ Match not yet played');
      return;
    }

    const winner = completed.winner_team_id;

    const winnerIsA = toStringSafe(winner) !== '' && toStringSafe(winner) === toStringSafe(completed.team_a);
    const loser = winnerIsA ? completed.team_b : completed.team_a;
    const winnerName = winnerIsA ? completed.team_a_name : completed.team_b_name;
    const loserName = winnerIsA ? completed.team_b_name : completed.team_a_name;

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
  console.log('⚠️ [DEPRECATED] tryGenerateNextFinalRound is no longer needed.');
  console.log('   All rounds are now pre-generated by generateFinalsIfReady.');
  console.log('   Use propagateFinalsResult to populate team names as matches are played.');
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

    const winner = toStringSafe(finalMatch.winner_team_id);
    const winnerIsA = winner !== '' && winner === toStringSafe(finalMatch.team_a);
    const runnerUp = toStringSafe(winnerIsA ? finalMatch.team_b : finalMatch.team_a);

    const finalRankMap = {};
    finalRankMap[winner] = 1;
    finalRankMap[runnerUp] = 2;

    const thirdPlaceMatch = finals.find(f => toBool(f.is_third_place_match));

    if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id) {
      const thirdWinner = toStringSafe(thirdPlaceMatch.winner_team_id);
      const thirdIsA = thirdWinner !== '' && thirdWinner === toStringSafe(thirdPlaceMatch.team_a);
      const fourthPlace = toStringSafe(thirdIsA ? thirdPlaceMatch.team_b : thirdPlaceMatch.team_a);
      finalRankMap[thirdWinner] = 3;
      finalRankMap[fourthPlace] = 4;
    } else {
      const semiMatches = regularFinals.filter(
        f => toNumber(f.round_id, 0) === maxRound - 1
      );
      semiMatches.forEach(m => {
        const mWinner = toStringSafe(m.winner_team_id);
        const mIsA = mWinner !== '' && mWinner === toStringSafe(m.team_a);
        const loser = toStringSafe(mIsA ? m.team_b : m.team_a);
        if (loser && !finalRankMap[loser]) {
          finalRankMap[loser] = 3;
        }
      });
    }

    console.log('🏅 Final rank map:', finalRankMap);

    const batch = db.batch();
    let updateCount = 0;

    for (const [teamId, rank] of Object.entries(finalRankMap)) {
      if (!teamId) continue;
      const standingId = `standings_${tournamentId}_${teamId}`;
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