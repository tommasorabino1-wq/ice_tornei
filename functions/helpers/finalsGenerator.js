const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// MAIN: Genera Finals se pronto
// ===============================
async function generateFinalsIfReady(tournamentId) {
  try {
    console.log(`🏆 Checking if finals can be generated for ${tournamentId}`);

    // 1) Recupera standings
    const standingsSnapshot = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (standingsSnapshot.empty) {
      console.log('⚠️ No standings found');
      return;
    }

    const standings = standingsSnapshot.docs.map(doc => doc.data());

    // 2) Raggruppa per girone
    const byGroup = {};
    standings.forEach(s => {
      const groupId = s.group_id;
      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push(s);
    });

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
        throw new Error('E6');
      }
      firsts.push(byRank[1][0]);

      // Secondi (opzionale)
      if (byRank[2]) {
        if (byRank[2].length !== 1) {
          throw new Error('E6');
        }
        seconds.push(byRank[2][0]);
      }
    });

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

    // 6) Controllo ambiguità E4 (solo se serve almeno 1 seconda)
    if (need > 0 && seconds.length > need) {
      const A = seconds[need - 1];
      const B = seconds[need];

      const same =
        A.points === B.points &&
        A.goal_diff === B.goal_diff &&
        A.goals_for === B.goals_for;

      if (same) {
        throw new Error('E4');
      }
    }

    qualified = qualified.concat(seconds.slice(0, need));

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

    for (let i = 0; i < teams.length / 2; i++) {
      const matchId = `${tournamentId}_FINAL_R${roundId}_M${matchIndex++}`;
      const finalRef = db.collection('finals').doc(matchId);

      batch.set(finalRef, {
        match_id: matchId,
        tournament_id: tournamentId,
        round_id: roundId,
        team_a: teams[i],
        team_b: teams[teams.length - 1 - i],
        score_a: null,
        score_b: null,
        winner_team_id: null,
        played: false
      });
    }

    await batch.commit();
    console.log(`✅ Finals generated for ${tournamentId}: ${teams.length / 2} matches`);

  } catch (error) {
    console.error('generateFinalsIfReady error:', error);
    throw error;
  }
}

// ===============================
// HELPER: Genera prossimo round Finals
// ===============================
async function tryGenerateNextFinalRound(tournamentId) {
  try {
    console.log(`🏆 Checking if next final round can be generated for ${tournamentId}`);

    // 1) Recupera tutte le finals
    const finalsSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .orderBy('round_id')
      .get();

    if (finalsSnapshot.empty) {
      console.log('⚠️ No finals found');
      return;
    }

    const finals = finalsSnapshot.docs.map(doc => doc.data());

    // 2) Trova ultimo round
    const rounds = finals.map(f => f.round_id).filter(r => Number.isFinite(r));
    const lastRound = Math.max(...rounds);

    const lastRoundMatches = finals.filter(f => f.round_id === lastRound);

    if (lastRoundMatches.length < 2) {
      console.log('✅ Already at final match');
      return;
    }

    // 3) Verifica che siano tutti giocati
    const allPlayed = lastRoundMatches.every(f => f.played === true);

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

    // 5) Estrai vincitori (ordine stabile)
    const winners = lastRoundMatches.map(f => {
      if (!f.winner_team_id) {
        throw new Error('FINAL_WINNER_MISSING');
      }
      return f.winner_team_id;
    });

    // 6) Crea nuovi match
    const batch = db.batch();
    let matchIndex = 1;

    for (let i = 0; i < winners.length; i += 2) {
      if (!winners[i + 1]) break;

      const matchId = `${tournamentId}_FINAL_R${nextRound}_M${matchIndex++}`;
      const finalRef = db.collection('finals').doc(matchId);

      batch.set(finalRef, {
        match_id: matchId,
        tournament_id: tournamentId,
        round_id: nextRound,
        team_a: winners[i],
        team_b: winners[i + 1],
        score_a: null,
        score_b: null,
        winner_team_id: null,
        played: false
      });
    }

    await batch.commit();
    console.log(`✅ Next final round (R${nextRound}) generated for ${tournamentId}`);

  } catch (error) {
    console.error('tryGenerateNextFinalRound error:', error);
    throw error;
  }
}

module.exports = {
  generateFinalsIfReady,
  tryGenerateNextFinalRound
};