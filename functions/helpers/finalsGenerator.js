const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// MAIN: Genera Finals se pronto
// ===============================
async function generateFinalsIfReady(tournamentId) {
  try {
    console.log(`🏆 [START] Checking if finals can be generated for ${tournamentId}`);

    // 1) Recupera standings
    const standingsSnapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (standingsSnapshot.empty) {
      console.log('⚠️ No standings found');
      return;
    }

    const standings = standingsSnapshot.docs.map(doc => doc.data());
    console.log(`📊 Found ${standings.length} standings`);

    // Crea mappa team_id -> team_name
    const teamNamesMap = {};
    standings.forEach(s => {
      teamNamesMap[s.team_id] = s.team_name;
    });

    // 2) Raggruppa per girone
    const byGroup = {};
    standings.forEach(s => {
      const groupId = s.group_id;
      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push(s);
    });

    console.log(`🏟️ Groups: ${Object.keys(byGroup).join(', ')}`);

    // 3) Estrai primi e secondi
    const firsts = [];
    const seconds = [];

    Object.values(byGroup).forEach(group => {
      const byRank = {};
      group.forEach(s => {
        const rank = s.rank_level;
        if (!byRank[rank]) byRank[rank] = [];
        byRank[rank].push(s);
      });

      // Deve esserci esattamente 1 primo
      if (!byRank[1] || byRank[1].length !== 1) {
        console.error('❌ Multiple teams at rank 1 in a group');
        throw new Error('E6');
      }
      firsts.push(byRank[1][0]);

      // Secondi (opzionale)
      if (byRank[2]) {
        if (byRank[2].length !== 1) {
          console.error('❌ Multiple teams at rank 2 in a group');
          throw new Error('E6');
        }
        seconds.push(byRank[2][0]);
      }
    });

    console.log(`🥇 First-placed teams: ${firsts.length}`);
    console.log(`🥈 Second-placed teams: ${seconds.length}`);

    // 4) Recupera torneo per sapere quanti slot
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const slots = Number(tournament.teams_in_final);

    if (!slots || slots <= 0) {
      console.log('⚠️ Invalid teams_in_final');
      return;
    }

    console.log(`🎯 Finals slots: ${slots}`);

    let qualified = [...firsts];

    if (qualified.length > slots) {
      console.log('⚠️ Too many first-placed teams');
      return;
    }

    // 5) Ordina seconde (criteri cross-girone)
    seconds.sort((a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    const need = slots - qualified.length;

    console.log(`📊 Need ${need} more teams from second-placed`);

    // 6) Controllo ambiguità E4 (solo se serve almeno 1 seconda)
    if (need > 0 && seconds.length > need) {
      const A = seconds[need - 1];
      const B = seconds[need];

      const same =
        A.points === B.points &&
        A.goal_diff === B.goal_diff &&
        A.goals_for === B.goals_for;

      if (same) {
        console.error('❌ Ambiguity in second-placed teams selection');
        throw new Error('E4');
      }
    }

    qualified = qualified.concat(seconds.slice(0, need));

    console.log(`✅ Qualified teams: ${qualified.map(q => q.team_name).join(', ')}`);

    // 7) Verifica se finals già esistono
    const existingFinals = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!existingFinals.empty) {
      console.log('⚠️ Finals already exist');
      return;
    }

    // 8) Crea finals (primo round)
    const batch = db.batch();
    const teams = qualified.map(q => q.team_id);
    const roundId = 1;
    let matchIndex = 1;

    console.log(`🏗️ Creating ${teams.length / 2} finals matches (Round ${roundId})`);

    for (let i = 0; i < teams.length / 2; i++) {
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
        played: false
      });

      console.log(`   ✓ Match ${matchId}: ${teamNamesMap[teamA]} vs ${teamNamesMap[teamB]}`);

      matchIndex++;
    }

    await batch.commit();
    console.log(`✅ [SUCCESS] Finals generated for ${tournamentId}: ${teams.length / 2} matches`);

  } catch (error) {
    console.error('❌ [ERROR] generateFinalsIfReady failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}



// ===============================
// HELPER: Genera prossimo round Finals
// ===============================
async function tryGenerateNextFinalRound(tournamentId) {
  try {
    console.log(`🏆 [START] Checking if next final round can be generated for ${tournamentId}`);

    // ✅ RIMUOVI orderBy, ordina in memoria
    const finalsSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (finalsSnapshot.empty) {
      console.log('⚠️ No finals found');
      return;
    }

    const finals = finalsSnapshot.docs.map(doc => doc.data());

    // ✅ Ordina in memoria per round_id
    finals.sort((a, b) => Number(a.round_id || 0) - Number(b.round_id || 0));

    console.log(`📋 Found ${finals.length} finals matches`);

    // Crea mappa team_id -> team_name da tutti i match esistenti
    const teamNamesMap = {};
    finals.forEach(f => {
      if (f.team_a && f.team_a_name) teamNamesMap[f.team_a] = f.team_a_name;
      if (f.team_b && f.team_b_name) teamNamesMap[f.team_b] = f.team_b_name;
    });

    // 2) Trova ultimo round
    const rounds = finals.map(f => f.round_id).filter(r => Number.isFinite(r));
    const lastRound = Math.max(...rounds);

    console.log(`🎯 Last round: ${lastRound}`);

    const lastRoundMatches = finals.filter(f => f.round_id === lastRound);

    console.log(`📊 Matches in last round: ${lastRoundMatches.length}`);

    if (lastRoundMatches.length < 2) {
      console.log('✅ Already at final match (only 1 match in last round)');
      return;
    }

    // 3) Verifica che siano tutti giocati
    const allPlayed = lastRoundMatches.every(f => f.played === true);

    console.log(`✔️ All matches played: ${allPlayed}`);

    if (!allPlayed) {
      console.log('⚠️ Not all matches in last round are played');
      return;
    }

    // 4) Evita doppia generazione
    const nextRound = lastRound + 1;
    const nextRoundExists = finals.some(f => f.round_id === nextRound);

    if (nextRoundExists) {
      console.log('⚠️ Next round already exists');
      return;
    }

    console.log(`🏗️ Generating next round: ${nextRound}`);

    // 5) Estrai vincitori (ordine stabile)
    const winners = lastRoundMatches.map(f => {
      if (!f.winner_team_id) {
        console.error(`❌ Match ${f.match_id} has no winner_team_id`);
        throw new Error('FINAL_WINNER_MISSING');
      }
      return f.winner_team_id;
    });

    console.log(`🏆 Winners: ${winners.join(', ')}`);

    // 6) Crea nuovi match
    const batch = db.batch();
    let matchIndex = 1;

    for (let i = 0; i < winners.length; i += 2) {
      if (!winners[i + 1]) {
        console.log(`⚠️ Skipping odd winner at index ${i}`);
        break;
      }

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
        played: false
      });

      console.log(`   ✓ Match ${matchId}: ${teamNamesMap[teamA] || teamA} vs ${teamNamesMap[teamB] || teamB}`);

      matchIndex++;
    }

    await batch.commit();
    console.log(`✅ [SUCCESS] Next final round (R${nextRound}) generated for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] tryGenerateNextFinalRound failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}



module.exports = {
  generateFinalsIfReady,
  tryGenerateNextFinalRound
};