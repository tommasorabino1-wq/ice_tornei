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
// HELPER: Calcola configurazione gironi ottimale
// ===============================
function calculateGroupConfig(totalTeams, preferredTeamsPerGroup) {
  if (preferredTeamsPerGroup && preferredTeamsPerGroup > 0) {
    if (totalTeams % preferredTeamsPerGroup === 0 && preferredTeamsPerGroup % 2 === 0) {
      return {
        teamsPerGroup: preferredTeamsPerGroup,
        numGroups: totalTeams / preferredTeamsPerGroup
      };
    }
  }

  const possibleSizes = [4, 6, 8, 10, 12];
  
  for (const size of possibleSizes) {
    if (totalTeams % size === 0 && totalTeams >= size) {
      return {
        teamsPerGroup: size,
        numGroups: totalTeams / size
      };
    }
  }

  if (totalTeams % 2 === 0 && totalTeams >= 2) {
    return {
      teamsPerGroup: totalTeams,
      numGroups: 1
    };
  }

  throw new Error(`Cannot create groups with ${totalTeams} teams (odd number)`);
}

// ===============================
// MAIN: Genera match (trigger manuale via status change)
// ===============================
async function generateMatchesIfReady(tournamentId) {
  try {
    console.log(`⚽ [START] Generating matches for ${tournamentId}`);

    // 1) Leggi torneo
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const preferredTeamsPerGroup = Number(tournament.teams_per_group) || 0;

    // 2) Verifica se match già esistono
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!matchesSnapshot.empty) {
      console.log('✅ Matches already generated (skipping)');
      return;
    }

    // 3) ✅ Recupera teams da SUBSCRIPTIONS (non più da collection "teams")
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournamentId)
      .get();

    const totalTeams = subscriptionsSnapshot.size;
    console.log(`👥 Teams registered: ${totalTeams}`);

    if (totalTeams < 2) {
      console.log('⚠️ Not enough teams to generate matches (minimum 2)');
      return;
    }

    // 4) Calcola configurazione gironi
    let groupConfig;
    try {
      groupConfig = calculateGroupConfig(totalTeams, preferredTeamsPerGroup);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      throw err;
    }

    const { teamsPerGroup, numGroups } = groupConfig;
    console.log(`📊 Group config: ${numGroups} groups × ${teamsPerGroup} teams each`);

    // 5) ✅ Estrai team_id e team_name da subscriptions
    const teamIds = [];
    const teamNamesMap = {};
    
    subscriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      teamIds.push(data.team_id);
      teamNamesMap[data.team_id] = data.team_name;
    });

    console.log(`📝 Team IDs before shuffle: ${teamIds.join(', ')}`);

    // Shuffle
    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }

    console.log(`🔀 Team IDs after shuffle: ${teamIds.join(', ')}`);

    // 6) Genera match per ogni gruppo + traccia assegnazione gruppi
    const batch = db.batch();
    let globalMatchCounter = 1;
    const teamGroupAssignment = {};

    for (let g = 0; g < numGroups; g++) {
      const groupId = `G${g + 1}`;
      const groupTeams = teamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);

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

    // 7) Genera standings iniziali (tutti a 0)
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

    // 8) Aggiorna teams_current e teams_per_group nel torneo
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    batch.update(tournamentRef, {
      teams_current: totalTeams,
      teams_per_group: teamsPerGroup
    });

    // 9) Commit batch
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