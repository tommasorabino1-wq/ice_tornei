const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// HELPER: Normalizza sport
// ===============================
function normalizeSport(sport) {
  const s = String(sport || '').toLowerCase().trim();

  if (s.includes('calcio') || s.includes('football') || s.includes('soccer')) return 'calcio';
  if (s.includes('padel')) return 'padel';
  if (s.includes('beach') || s.includes('volley')) return 'beach_volley';

  return 'calcio';
}

// ===============================
// HELPER: Determina se il format è a set
// ===============================
function isSetBasedFormat(matchFormat) {
  const setFormats = ['1su1', '2su3', '3su5'];
  return setFormats.includes(String(matchFormat || '').toLowerCase());
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
    // Raggruppa per rank_level
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
// HELPER: Controlla parità tra seconde (o terze) cross-girone
// ===============================
function checkCrossGroupTie(sorted, need, standingsIsSetBased) {
  if (need <= 0 || sorted.length <= need) return; // nessuna ambiguità possibile

  const A = sorted[need - 1];
  const B = sorted[need];

  let same;
  if (standingsIsSetBased) {
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
function sortCrossGroup(teams, standingsIsSetBased) {
  if (standingsIsSetBased) {
    return [...teams].sort((a, b) =>
      b.points - a.points ||
      b.set_diff - a.set_diff ||
      b.sets_for - a.sets_for ||
      b.game_diff - a.game_diff ||
      b.games_for - a.games_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );
  } else {
    return [...teams].sort((a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );
  }
}

// ===============================
// MAIN: Genera Finals (triggerata da status → final_phase)
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

    // 3b) Verifica che il formato preveda finals
    if (!formatHasFinals(formatType)) {
      console.log(`⛔ Tournament format "${formatType}" does not support finals - blocked`);
      throw new Error('E_FORMAT_NO_FINALS');
    }

    console.log(`✅ Format "${formatType}" supports finals`);

    const sport = normalizeSport(tournament.sport);
    const matchFormatFinals = String(tournament.match_format_finals || '').toLowerCase();
    const isSetBased = isSetBasedFormat(matchFormatFinals);

    console.log(`🏆 Sport: ${sport}, Format Finals: ${matchFormatFinals}, Set-based: ${isSetBased}`);

    // 3d) Verifica che non esistano già finals per questo torneo
    const existingFinals = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!existingFinals.empty) {
      console.log('⚠️ Finals already exist for this tournament - skipping');
      return;
    }

    // 3c) Recupera standings e verifica esistenza
    const standingsSnapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (standingsSnapshot.empty) {
      console.log('⚠️ No standings found');
      throw new Error('E_NO_STANDINGS');
    }

    const standings = standingsSnapshot.docs.map(doc => doc.data());
    console.log(`📊 Found ${standings.length} standings entries`);

    const standingsIsSetBased = standings[0]?.is_set_based || false;

    // Crea mappa team_id -> team_name
    const teamNamesMap = {};
    standings.forEach(s => { teamNamesMap[s.team_id] = s.team_name; });

    // Raggruppa per girone
    const byGroup = {};
    standings.forEach(s => {
      if (!byGroup[s.group_id]) byGroup[s.group_id] = [];
      byGroup[s.group_id].push(s);
    });

    console.log(`🏟️ Groups: ${Object.keys(byGroup).join(', ')}`);

    // 3c) Controlla parità intra-girone
    checkIntraGroupTies(byGroup, standingsIsSetBased);

    // 3e) Estrai teams_in_final e determina quanti prendere per rank
    const slots = Number(tournament.teams_in_final);
    if (!slots || slots <= 0) {
      console.log('⚠️ Invalid or missing teams_in_final');
      throw new Error('E_INVALID_SLOTS');
    }

    console.log(`🎯 Finals slots: ${slots}`);

    // Estrai squadre per rank (primi, secondi, terzi, ...)
    const byRankGlobal = {}; // rank_level → [standings entry]
    Object.values(byGroup).forEach(group => {
      group.forEach(s => {
        const rank = s.rank_level;
        if (!byRankGlobal[rank]) byRankGlobal[rank] = [];
        byRankGlobal[rank].push(s);
      });
    });

    const numGroups = Object.keys(byGroup).length;
    let qualified = [];
    let remainingSlots = slots;

    // Prendi i primi (tutti i gironi hanno 1 primo)
    const firsts = byRankGlobal[1] || [];
    if (firsts.length > remainingSlots) {
      console.log(`⚠️ More first-placed teams (${firsts.length}) than available slots (${remainingSlots})`);
      throw new Error('E_TOO_MANY_FIRSTS');
    }
    qualified = qualified.concat(firsts);
    remainingSlots -= firsts.length;

    console.log(`🥇 First-placed: ${firsts.length}, remaining slots: ${remainingSlots}`);

    // Se restano slot, prendiamo dalla posizione successiva (secondi, poi terzi, ecc.)
    let currentRank = 2;
    while (remainingSlots > 0) {
      const rankTeams = byRankGlobal[currentRank] || [];

      if (rankTeams.length === 0) {
        console.log(`ℹ️ No more teams at rank ${currentRank}`);
        break;
      }

      const sorted = sortCrossGroup(rankTeams, standingsIsSetBased);

      // 3c) Controlla parità cross-girone per questo rank
      checkCrossGroupTie(sorted, remainingSlots, standingsIsSetBased);

      const toTake = Math.min(remainingSlots, sorted.length);
      qualified = qualified.concat(sorted.slice(0, toTake));
      remainingSlots -= toTake;

      console.log(`🥈 Rank ${currentRank}: took ${toTake}, remaining slots: ${remainingSlots}`);
      currentRank++;
    }

    if (qualified.length !== slots) {
      console.log(`⚠️ Could not fill all slots: needed ${slots}, got ${qualified.length}`);
      throw new Error('E_NOT_ENOUGH_TEAMS');
    }

    console.log(`✅ Qualified: ${qualified.map(q => q.team_name).join(', ')}`);

    // 3f) Genera il primo round delle finals
    const batch = db.batch();
    const teams = qualified.map(q => q.team_id);
    const roundId = 1;
    let matchIndex = 1;

    console.log(`🏗️ Creating ${Math.floor(teams.length / 2)} finals matches (Round ${roundId})`);

    for (let i = 0; i < Math.floor(teams.length / 2); i++) {
      const teamA = teams[i];
      const teamB = teams[teams.length - 1 - i];
      const matchId = `${tournamentId}_FINAL_R${roundId}_M${matchIndex}`;
      const finalRef = db.collection('finals').doc(matchId);

      batch.set(finalRef, {
        match_id: matchId,
        tournament_id: tournamentId,
        round_id: roundId,
        team_a: teamA,
        team_b: teamB,
        team_a_name: teamNamesMap[teamA] || teamA,
        team_b_name: teamNamesMap[teamB] || teamB,
        score_a: null,
        score_b: null,
        winner_team_id: null,
        played: false,
        court: 'none',
        day: 'none',
        hour: 'none',
        sets_detail: null,
        games_a: null,
        games_b: null,
        sport,
        match_format: matchFormatFinals,
        is_set_based: isSetBased,
      });

      console.log(`   ✓ ${matchId}: ${teamNamesMap[teamA]} vs ${teamNamesMap[teamB]}`);
      matchIndex++;
    }

    await batch.commit();
    console.log(`✅ [SUCCESS] Finals R1 generated for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] generateFinalsIfReady failed:', error.message);
    throw error;
  }
}

// ===============================
// 3g) Genera prossimo round Finals (automatico quando round precedente è completato)
// ===============================
async function tryGenerateNextFinalRound(tournamentId) {
  try {
    console.log(`🏆 [START] tryGenerateNextFinalRound for ${tournamentId}`);

    // Recupera torneo per sport e format
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const sport = normalizeSport(tournament.sport);
    const matchFormatFinals = String(tournament.match_format_finals || '').toLowerCase();
    const isSetBased = isSetBasedFormat(matchFormatFinals);

    // Recupera tutte le finals
    const finalsSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (finalsSnapshot.empty) {
      console.log('⚠️ No finals found');
      return;
    }

    const finals = finalsSnapshot.docs.map(doc => doc.data());
    finals.sort((a, b) => Number(a.round_id || 0) - Number(b.round_id || 0));

    console.log(`📋 Found ${finals.length} finals matches`);

    // Mappa team_id → team_name
    const teamNamesMap = {};
    finals.forEach(f => {
      if (f.team_a && f.team_a_name) teamNamesMap[f.team_a] = f.team_a_name;
      if (f.team_b && f.team_b_name) teamNamesMap[f.team_b] = f.team_b_name;
    });

    // Trova ultimo round
    const rounds = finals.map(f => f.round_id).filter(r => Number.isFinite(r));
    const lastRound = Math.max(...rounds);
    const lastRoundMatches = finals.filter(f => f.round_id === lastRound);

    console.log(`🎯 Last round: ${lastRound}, matches: ${lastRoundMatches.length}`);

    // Se c'è solo 1 match nell'ultimo round → siamo già alla finale secca
    if (lastRoundMatches.length < 2) {
      console.log('✅ Already at the final match - no further rounds to generate');
      return;
    }

    // Verifica che tutte le partite dell'ultimo round siano giocate
    const allPlayed = lastRoundMatches.every(f => f.played === true);
    if (!allPlayed) {
      console.log('⚠️ Not all matches in last round are played yet');
      return;
    }

    // Evita doppia generazione
    const nextRound = lastRound + 1;
    if (finals.some(f => f.round_id === nextRound)) {
      console.log('⚠️ Next round already exists');
      return;
    }

    console.log(`🏗️ Generating next round: R${nextRound}`);

    // Estrai vincitori (ordine stabile)
    const winners = lastRoundMatches.map(f => {
      if (!f.winner_team_id) {
        console.error(`❌ Match ${f.match_id} has no winner_team_id`);
        throw new Error('FINAL_WINNER_MISSING');
      }
      return f.winner_team_id;
    });

    console.log(`🏆 Winners: ${winners.join(', ')}`);

    // Crea nuovi match
    const batch = db.batch();
    let matchIndex = 1;

    for (let i = 0; i < winners.length - 1; i += 2) {
      const teamA = winners[i];
      const teamB = winners[i + 1];
      const matchId = `${tournamentId}_FINAL_R${nextRound}_M${matchIndex}`;
      const finalRef = db.collection('finals').doc(matchId);

      batch.set(finalRef, {
        match_id: matchId,
        tournament_id: tournamentId,
        round_id: nextRound,
        team_a: teamA,
        team_b: teamB,
        team_a_name: teamNamesMap[teamA] || teamA,
        team_b_name: teamNamesMap[teamB] || teamB,
        score_a: null,
        score_b: null,
        winner_team_id: null,
        played: false,
        court: 'none',
        day: 'none',
        hour: 'none',
        sets_detail: null,
        games_a: null,
        games_b: null,
        sport,
        match_format: matchFormatFinals,
        is_set_based: isSetBased,
      });

      console.log(`   ✓ ${matchId}: ${teamNamesMap[teamA] || teamA} vs ${teamNamesMap[teamB] || teamB}`);
      matchIndex++;
    }

    await batch.commit();
    console.log(`✅ [SUCCESS] Final round R${nextRound} generated for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] tryGenerateNextFinalRound failed:', error.message);
    throw error;
  }
}

module.exports = {
  generateFinalsIfReady,
  tryGenerateNextFinalRound,
};