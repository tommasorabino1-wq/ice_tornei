const admin = require('firebase-admin');
const db = admin.firestore();


// ===============================
// HELPERS SAFE (per Firestore)
// ===============================
function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function toNumber(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const n = Number(String(val).trim());
  return isNaN(n) ? fallback : n;
}


// ===============================
// HELPER: Round-robin per N pari
// ===============================
function buildRoundRobinPairsEven(teamIds, isDouble = false) {
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

  if (isDouble) {
    const returnRounds = rounds.map(pairs =>
      pairs.map(([a, b]) => [b, a])
    );
    return [...rounds, ...returnRounds];
  }

  return rounds;
}

// ===============================
// HELPER: Round-robin per N dispari (con bye)
// ===============================
function buildRoundRobinPairsOdd(teamIds, isDouble = false) {
  // Aggiunge un "bye" virtuale per rendere N pari, poi filtra le coppie con bye
  const BYE = '__BYE__';
  const extended = [...teamIds, BYE];
  const n = extended.length; // pari

  const fixed = extended[0];
  let rot = extended.slice(1);

  const rounds = [];
  const totalRounds = n - 1;

  for (let r = 0; r < totalRounds; r++) {
    const lineup = [fixed, ...rot];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      // Filtra coppie con il bye
      if (a !== BYE && b !== BYE) {
        pairs.push([a, b]);
      }
    }
    rounds.push(pairs);
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }

  if (isDouble) {
    const returnRounds = rounds.map(pairs =>
      pairs.map(([a, b]) => [b, a])
    );
    return [...rounds, ...returnRounds];
  }

  return rounds;
}

// ===============================
// HELPER: Dispatcher round-robin (pari o dispari)
// ===============================
function buildRoundRobinPairs(teamIds, isDouble = false) {
  if (teamIds.length % 2 === 0) {
    return buildRoundRobinPairsEven(teamIds, isDouble);
  } else {
    return buildRoundRobinPairsOdd(teamIds, isDouble);
  }
}

// ===============================
// HELPER: Assegna home/away
// ===============================
function assignHomeAwayGreedy(roundPairs, isDouble = false) {
  const firstLegCount = isDouble ? roundPairs.length / 2 : roundPairs.length;
  const lastWasHome = {};
  const out = [];

  for (let r = 0; r < roundPairs.length; r++) {
    const pairs = roundPairs[r];
    const matches = [];
    const isReturnLeg = isDouble && r >= firstLegCount;

    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];

      let home, away;

      if (isReturnLeg) {
        home = b;
        away = a;
      } else {
        const v1 = (lastWasHome[a] === true ? 1 : 0) + (lastWasHome[b] === false ? 1 : 0);
        const v2 = (lastWasHome[b] === true ? 1 : 0) + (lastWasHome[a] === false ? 1 : 0);

        if (v2 < v1) {
          home = b; away = a;
        } else if (v1 < v2) {
          home = a; away = b;
        } else {
          const flip = ((r + i) % 2 === 0);
          home = flip ? a : b;
          away = flip ? b : a;
        }
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
// FIX BUG 1: rimosso il vincolo % 2 === 0 su preferredTeamsPerGroup,
// così gironi da 3/5 squadre (con bye) sono ora supportati.
// ===============================
function calculateGroupConfig(totalTeams, preferredTeamsPerGroup) {
  if (preferredTeamsPerGroup && preferredTeamsPerGroup > 0) {
    if (totalTeams % preferredTeamsPerGroup === 0) {
      return {
        teamsPerGroup: preferredTeamsPerGroup,
        numGroups: totalTeams / preferredTeamsPerGroup
      };
    }
  }

  // Fallback: prova taglie standard (incluse dispari con bye)
  const possibleSizes = [4, 3, 6, 5, 8, 10, 12];

  for (const size of possibleSizes) {
    if (totalTeams % size === 0 && totalTeams >= size) {
      return {
        teamsPerGroup: size,
        numGroups: totalTeams / size
      };
    }
  }

  // Ultimo fallback: girone unico
  if (totalTeams >= 2) {
    return {
      teamsPerGroup: totalTeams,
      numGroups: 1
    };
  }

  throw new Error(`Cannot create groups with ${totalTeams} teams`);
}

// ===============================
// HELPER: Normalizza sport
// ===============================
function normalizeSport(sport) {
  const s = String(sport || '').toLowerCase().trim();

  if (s.includes('calcio') || s.includes('football') || s.includes('soccer')) return 'calcio';
  if (s.includes('padel')) return 'padel';
  if (s.includes('beach') || s.includes('volley')) return 'beach_volley';
  if (s.includes('scacchi') || s.includes('chess')) return 'scacchi';

  return 'calcio';
}

// ===============================
// HELPER: Profilo match (sport + format)
// ===============================
function getMatchProfile(sport, matchFormat) {
  const fmt = String(matchFormat || '').toLowerCase();
  const isSetBased = fmt.includes('su');
  const isChess = sport === 'scacchi';
  const hasGoals = sport === 'calcio';
  const hasGames = (sport === 'padel' || sport === 'beach_volley') && !isSetBased;
  const hasScorers = sport === 'calcio';

  return { isSetBased, isChess, hasGoals, hasGames, hasScorers };
}

// ===============================
// HELPER: Costruisce documento match
// ===============================
function buildMatchData(matchId, tournamentId, groupId, roundNumber, teamA, teamB, teamAName, teamBName, sport, matchFormat, profile) {
  const base = {
    match_id: matchId,
    tournament_id: tournamentId,
    group_id: groupId,
    round_id: roundNumber,
    team_a: teamA,
    team_b: teamB,
    team_a_name: teamAName,
    team_b_name: teamBName,
    score_a: null,
    score_b: null,
    played: false,
    court: 'none',
    day: 'none',
    hour: 'none',
    sport: sport,
    match_format: matchFormat,
    is_set_based: profile.isSetBased,
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
// HELPER: Costruisce documento standing iniziale
// ===============================
function buildStandingData(standingId, teamId, tournamentId, groupId, teamName, sport, matchFormat, profile) {
  const base = {
    standing_id: standingId,
    team_id: teamId,
    tournament_id: tournamentId,
    group_id: groupId,
    team_name: teamName,
    matches_played: 0,
    points: 0,
    wins: 0,
    losses: 0,
    rank_level: 1,
    rank_group: 'INIT',
    sport: sport,
    match_format: matchFormat,
    is_set_based: profile.isSetBased,
  };

  if (!profile.isSetBased) {
    base.draws = 0;
  }

  if (profile.hasGoals) {
    base.goals_for = 0;
    base.goals_against = 0;
    base.goal_diff = 0;
    base.h2h_points = 0;
    base.h2h_goal_diff = 0;
    base.h2h_goals_for = 0;
  }

  if (profile.hasGames) {
    base.games_for = 0;
    base.games_against = 0;
    base.game_diff = 0;
    base.h2h_points = 0;
    base.h2h_game_diff = 0;
    base.h2h_games_for = 0;
  }

  if (profile.isSetBased) {
    base.sets_for = 0;
    base.sets_against = 0;
    base.set_diff = 0;
    base.games_for = 0;
    base.games_against = 0;
    base.game_diff = 0;
    base.h2h_points = 0;
    base.h2h_set_diff = 0;
    base.h2h_sets_for = 0;
    base.h2h_game_diff = 0;
    base.h2h_games_for = 0;
  }

  if (profile.isChess) {
    base.h2h_points = 0;
  }

  return base;
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

    const preferredTeamsPerGroup = toNumber(tournament.teams_per_group, 0);
    const formatType             = toStringSafe(tournament.format_type).toLowerCase();
    const isDouble               = formatType.startsWith('double_');
    const sport                  = normalizeSport(toStringSafe(tournament.sport));
    const matchFormatGironi      = toStringSafe(tournament.match_format_gironi).toLowerCase();
    const profile                = getMatchProfile(sport, matchFormatGironi);

    console.log(`🏆 Sport: ${sport}, Format: ${matchFormatGironi}, isDouble: ${isDouble}, Profile:`, profile);

    // 2) Verifica se match già esistono
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .limit(1)
      .get();

    if (!matchesSnapshot.empty) {
      console.log('✅ Matches already generated (skipping)');
      return;
    }

    // 3) Recupera teams da SUBSCRIPTIONS
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

    // 5) Estrai team_id e team_name da subscriptions + shuffle
    // FIX BUG 3: toStringSafe su team_id per evitare chiavi undefined nella mappa
    const teamIds = [];
    const teamNamesMap = {};

    subscriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const teamId = toStringSafe(data.team_id);
      if (!teamId) {
        console.warn(`⚠️ Subscription ${doc.id} has missing team_id - skipping`);
        return;
      }
      teamIds.push(teamId);
      teamNamesMap[teamId] = toStringSafe(data.team_name, teamId);
    });

    console.log(`📝 Team IDs before shuffle: ${teamIds.join(', ')}`);

    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }

    console.log(`🔀 Team IDs after shuffle: ${teamIds.join(', ')}`);

    // 6) Genera match per ogni gruppo
    const batch = db.batch();
    let globalMatchCounter = 1;
    const teamGroupAssignment = {};

    for (let g = 0; g < numGroups; g++) {
      const groupId    = `G${g + 1}`;
      const groupTeams = teamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);

      groupTeams.forEach(teamId => {
        teamGroupAssignment[teamId] = groupId;
      });

      console.log(`🏟️ Generating matches for ${groupId}: ${groupTeams.join(', ')}`);

      // FIX BUG 2: usa buildRoundRobinPairs (dispatcher pari/dispari)
      // invece di buildRoundRobinPairsEven che crashava con N dispari
      const pairsByRound = buildRoundRobinPairs(groupTeams, isDouble);
      const rounds = assignHomeAwayGreedy(pairsByRound, isDouble);

      rounds.forEach(rObj => {
        const roundNumber = rObj.roundNumber;

        rObj.matches.forEach(m => {
          const matchId  = `${tournamentId}_${groupId}_R${String(roundNumber).padStart(2, '0')}_M${String(globalMatchCounter).padStart(3, '0')}`;
          const matchRef = db.collection('matches').doc(matchId);

          const matchData = buildMatchData(
            matchId, tournamentId, groupId, roundNumber,
            m.home, m.away,
            teamNamesMap[m.home] || m.home,
            teamNamesMap[m.away] || m.away,
            sport, matchFormatGironi, profile
          );

          batch.set(matchRef, matchData);
          console.log(`   ✓ Match ${matchId}: ${teamNamesMap[m.home]} vs ${teamNamesMap[m.away]}`);
          globalMatchCounter++;
        });
      });
    }

    // 7) Genera standings iniziali
    // FIX BUG 4: standingId include tournamentId per evitare collisioni
    // tra tornei diversi che condividono gli stessi team_id
    console.log(`📊 Generating initial standings...`);

    teamIds.forEach(teamId => {
      const groupId   = teamGroupAssignment[teamId];
      const teamName  = teamNamesMap[teamId] || teamId;
      const standingId = `standings_${tournamentId}_${teamId}`;
      const standingRef = db.collection('standings').doc(standingId);

      const standingData = buildStandingData(
        standingId, teamId, tournamentId, groupId, teamName,
        sport, matchFormatGironi, profile
      );

      batch.set(standingRef, standingData);
      console.log(`   ✓ Standing ${standingId}: ${teamName} (${groupId})`);
    });

    // 8) Aggiorna torneo
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    batch.update(tournamentRef, {
      teams_current: totalTeams,
      teams_per_group: teamsPerGroup
    });

    // 9) Commit
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