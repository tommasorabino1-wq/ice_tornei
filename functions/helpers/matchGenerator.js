const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// HELPER: Round-robin per N pari
// ===============================
function buildRoundRobinPairsEven(teamIds) {
  const n = teamIds.length;
  if (n % 2 !== 0) {
    throw new Error("teams_per_group must be even");
  }
  if (n < 2) return [];

  const arr = teamIds.slice();
  const fixed = arr[0];
  let rot = arr.slice(1);

  const rounds = [];
  const totalRounds = n - 1;

  for (let r = 0; r < totalRounds; r++) {
    const lineup = [fixed, ...rot];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      pairs.push([a, b]);
    }
    rounds.push(pairs);
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }

  return rounds;
}

// ===============================
// HELPER: Assegna home/away
// ===============================
function assignHomeAwayGreedy(roundPairs) {
  const lastWasHome = {};
  const out = [];

  for (let r = 0; r < roundPairs.length; r++) {
    const pairs = roundPairs[r];
    const matches = [];

    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];

      const v1 = (lastWasHome[a] === true ? 1 : 0) + (lastWasHome[b] === false ? 1 : 0);
      const v2 = (lastWasHome[b] === true ? 1 : 0) + (lastWasHome[a] === false ? 1 : 0);

      let home, away;
      if (v2 < v1) {
        home = b; away = a;
      } else if (v1 < v2) {
        home = a; away = b;
      } else {
        const flip = ((r + i) % 2 === 0);
        home = flip ? a : b;
        away = flip ? b : a;
      }

      matches.push({ home, away });
      lastWasHome[home] = true;
      lastWasHome[away] = false;
    }

    out.push({ roundNumber: r + 1, matches });
  }

  return out;
}

// ===============================
// MAIN: Genera match se pronto
// ===============================

async function generateMatchesIfReady(tournamentId) {
  try {
    console.log(`⚽ [START] Checking if matches can be generated for ${tournamentId}`);

    // 1) Leggi torneo
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const teamsMax = Number(tournament.teams_max);
    const teamsPerGroup = Number(tournament.teams_per_group);

    console.log(`📋 Tournament config: teamsMax=${teamsMax}, teamsPerGroup=${teamsPerGroup}`);

    if (!teamsMax || !teamsPerGroup) {
      console.log('⚠️ Invalid teams_max or teams_per_group');
      return;
    }

    if (teamsMax % teamsPerGroup !== 0) {
      console.error(`❌ teams_max (${teamsMax}) not divisible by teams_per_group (${teamsPerGroup})`);
      throw new Error('teams_max not divisible by teams_per_group');
    }

    if (teamsPerGroup % 2 !== 0) {
      console.error(`❌ teams_per_group (${teamsPerGroup}) is odd`);
      throw new Error('teams_per_group must be even');
    }

    // 2) Conta teams iscritti
    const teamsSnapshot = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    console.log(`👥 Teams registered: ${teamsSnapshot.size}/${teamsMax}`);

    if (teamsSnapshot.size !== teamsMax) {
      console.log(`⏳ Waiting for more teams: ${teamsSnapshot.size}/${teamsMax}`);
      return;
    }

    // 3) Verifica se match già esistono
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!matchesSnapshot.empty) {
      console.log('✅ Matches already generated (skipping)');
      return;
    }

    console.log('🚀 All conditions met, generating matches...');

    // 4) Shuffle teams + crea mappa nomi
    const teamIds = teamsSnapshot.docs.map(doc => doc.data().team_id);
    const teamNamesMap = {};
    teamsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      teamNamesMap[data.team_id] = data.team_name;
    });

    console.log(`📝 Team IDs before shuffle: ${teamIds.join(', ')}`);

    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }

    console.log(`🔀 Team IDs after shuffle: ${teamIds.join(', ')}`);

    const numGroups = teamsMax / teamsPerGroup;
    console.log(`📊 Number of groups: ${numGroups}`);

    // 5) Genera match per ogni gruppo + traccia assegnazione gruppi
    const batch = db.batch();
    let globalMatchCounter = 1;
    const teamGroupAssignment = {}; // team_id -> group_id

    for (let g = 0; g < numGroups; g++) {
      const groupId = `G${g + 1}`;
      const groupTeams = teamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);

      // Traccia assegnazione gruppo
      groupTeams.forEach(teamId => {
        teamGroupAssignment[teamId] = groupId;
      });

      console.log(`🏟️ Generating matches for ${groupId}: ${groupTeams.join(', ')}`);

      const pairsByRound = buildRoundRobinPairsEven(groupTeams);
      const rounds = assignHomeAwayGreedy(pairsByRound);

      rounds.forEach(rObj => {
        const roundNumber = rObj.roundNumber;

        rObj.matches.forEach(m => {
          const matchId = `${tournamentId}_${groupId}_R${String(roundNumber).padStart(2, '0')}_M${String(globalMatchCounter).padStart(3, '0')}`;
          
          const matchRef = db.collection('matches').doc(matchId);
          batch.set(matchRef, {
            match_id: matchId,
            tournament_id: tournamentId,
            group_id: groupId,
            round_id: roundNumber,
            team_a: m.home,
            team_b: m.away,
            team_a_name: teamNamesMap[m.home] || m.home,
            team_b_name: teamNamesMap[m.away] || m.away,
            score_a: null,
            score_b: null,
            played: false
          });

          console.log(`   ✓ Match ${matchId}: ${teamNamesMap[m.home]} vs ${teamNamesMap[m.away]}`);

          globalMatchCounter++;
        });
      });
    }

    // 6) Genera standings iniziali (tutti a 0)
    console.log(`📊 Generating initial standings...`);

    teamIds.forEach(teamId => {
      const groupId = teamGroupAssignment[teamId];
      const teamName = teamNamesMap[teamId] || teamId;
      const standingId = `standings_${teamId}`;
      const standingRef = db.collection('standings').doc(standingId);

      batch.set(standingRef, {
        standing_id: standingId,
        team_id: teamId,
        tournament_id: tournamentId,
        group_id: groupId,
        team_name: teamName,
        matches_played: 0,
        points: 0,
        goal_diff: 0,
        goals_for: 0,
        goals_against: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        h2h_points: 0,
        h2h_goal_diff: 0,
        h2h_goals_for: 0,
        rank_level: 1,
        rank_group: 'INIT'
      });

      console.log(`   ✓ Standing ${standingId}: ${teamName} (${groupId})`);
    });

    // 7) Commit batch
    console.log(`💾 Committing ${globalMatchCounter - 1} matches + ${teamIds.length} standings...`);
    await batch.commit();
    console.log(`✅ [SUCCESS] Generated ${globalMatchCounter - 1} matches and ${teamIds.length} standings for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] generateMatchesIfReady failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}


module.exports = { generateMatchesIfReady };