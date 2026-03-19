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
// HELPER: Circle Method (Berger)
// Genera N-1 round per N squadre (N pari).
// Ritorna array di round, ogni round è array di [home, away].
// Garantisce distribuzione bilanciata casa/trasferta.
// ===============================
function circleMethodEven(teamIds) {
  const n = teamIds.length; // deve essere pari
  const arr = teamIds.slice();

  // Il primo elemento è fisso, gli altri ruotano
  const fixed = arr[0];
  let rotating = arr.slice(1); // n-1 elementi

  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rotating];
    const pairs = [];

    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];

      // Regola Berger: nei round pari il fixed gioca in casa,
      // nei round dispari gioca in trasferta.
      // Per le altre coppie, alterna in base alla posizione.
      if (i === 0) {
        // Coppia con il fixed
        if (r % 2 === 0) {
          pairs.push([a, b]); // fixed in casa
        } else {
          pairs.push([b, a]); // fixed in trasferta
        }
      } else {
        // Coppie interne: alterna in base a round + posizione
        if ((r + i) % 2 === 0) {
          pairs.push([a, b]);
        } else {
          pairs.push([b, a]);
        }
      }
    }

    rounds.push(pairs);

    // Rotazione: l'ultimo entra in seconda posizione, gli altri scalano
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return rounds;
}


// ===============================
// HELPER: Circle Method con bye (N dispari)
// Aggiunge un bye virtuale per rendere N pari,
// poi filtra le coppie che coinvolgono il bye.
// ===============================
function circleMethodOdd(teamIds) {
  const BYE = '__BYE__';
  const extended = [...teamIds, BYE];
  const rounds = circleMethodEven(extended);

  return rounds.map(pairs =>
    pairs.filter(([a, b]) => a !== BYE && b !== BYE)
  );
}


// ===============================
// HELPER: Dispatcher Circle Method
// ===============================
function buildRoundRobinPairs(teamIds) {
  if (teamIds.length % 2 === 0) {
    return circleMethodEven(teamIds);
  } else {
    return circleMethodOdd(teamIds);
  }
}


// ===============================
// HELPER: Double Round Robin
// Per il ritorno, inverte home/away di ogni coppia dell'andata.
// Garantisce che chi era in casa all'andata sia in trasferta al ritorno.
// ===============================
function buildDoubleRoundRobinPairs(teamIds) {
  const firstLeg  = buildRoundRobinPairs(teamIds);
  const secondLeg = firstLeg.map(roundPairs =>
    roundPairs.map(([home, away]) => [away, home])
  );
  return [...firstLeg, ...secondLeg];
}


// ===============================
// HELPER: Verifica bilanciamento casa/trasferta (utility di debug)
// Ritorna { teamId: { home: N, away: N } } per ogni squadra
// ===============================
function checkHomeAwayBalance(allRounds) {
  const balance = {};

  allRounds.forEach(pairs => {
    pairs.forEach(([home, away]) => {
      if (!balance[home]) balance[home] = { home: 0, away: 0 };
      if (!balance[away]) balance[away] = { home: 0, away: 0 };
      balance[home].home++;
      balance[away].away++;
    });
  });

  return balance;
}


// ===============================
// HELPER: Converte rounds in struttura { roundNumber, matches }
// ===============================
function formatRounds(allRounds) {
  return allRounds.map((pairs, idx) => ({
    roundNumber: idx + 1,
    matches: pairs.map(([home, away]) => ({ home, away }))
  }));
}


// ===============================
// HELPER: Calcola configurazione gironi ottimale
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

  const possibleSizes = [4, 3, 6, 5, 8, 10, 12];

  for (const size of possibleSizes) {
    if (totalTeams % size === 0 && totalTeams >= size) {
      return {
        teamsPerGroup: size,
        numGroups: totalTeams / size
      };
    }
  }

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
  const isSetBased  = fmt.includes('su');
  const isChess     = sport === 'scacchi';
  const hasGoals    = sport === 'calcio';
  const hasGames    = (sport === 'padel' || sport === 'beach_volley') && !isSetBased;
  const hasScorers  = sport === 'calcio';

  return { isSetBased, isChess, hasGoals, hasGames, hasScorers };
}


// ===============================
// HELPER: Costruisce documento match
// ===============================
function buildMatchData(matchId, tournamentId, groupId, roundNumber, teamA, teamB, teamAName, teamBName, sport, matchFormat, profile) {
  const base = {
    match_id:      matchId,
    tournament_id: tournamentId,
    group_id:      groupId,
    round_id:      roundNumber,
    team_a:        teamA,
    team_b:        teamB,
    team_a_name:   teamAName,
    team_b_name:   teamBName,
    score_a:       null,
    score_b:       null,
    played:        false,
    court:         'none',
    day:           'none',
    hour:          'none',
    sport:         sport,
    match_format:  matchFormat,
    is_set_based:  profile.isSetBased,
  };

  if (profile.isSetBased) {
    base.sets_detail = null;
    base.games_a     = null;
    base.games_b     = null;
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
    standing_id:    standingId,
    team_id:        teamId,
    tournament_id:  tournamentId,
    group_id:       groupId,
    team_name:      teamName,
    matches_played: 0,
    points:         0,
    wins:           0,
    losses:         0,
    rank_level:     1,
    rank_group:     'INIT',
    sport:          sport,
    match_format:   matchFormat,
    is_set_based:   profile.isSetBased,
  };

  if (!profile.isSetBased) {
    base.draws = 0;
  }

  if (profile.hasGoals) {
    base.goals_for    = 0;
    base.goals_against = 0;
    base.goal_diff    = 0;
    base.h2h_points   = 0;
    base.h2h_goal_diff = 0;
    base.h2h_goals_for = 0;
  }

  if (profile.hasGames) {
    base.games_for    = 0;
    base.games_against = 0;
    base.game_diff    = 0;
    base.h2h_points   = 0;
    base.h2h_game_diff = 0;
    base.h2h_games_for = 0;
  }

  if (profile.isSetBased) {
    base.sets_for     = 0;
    base.sets_against = 0;
    base.set_diff     = 0;
    base.games_for    = 0;
    base.games_against = 0;
    base.game_diff    = 0;
    base.h2h_points   = 0;
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
// MAIN: Genera match
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

    // 5) Estrai team_id e team_name + shuffle
    const teamIds = [];
    const teamNamesMap = {};

    subscriptionsSnapshot.docs.forEach(doc => {
      const data   = doc.data();
      const teamId = toStringSafe(data.team_id);
      if (!teamId) {
        console.warn(`⚠️ Subscription ${doc.id} has missing team_id - skipping`);
        return;
      }
      teamIds.push(teamId);
      teamNamesMap[teamId] = toStringSafe(data.team_name, teamId);
    });

    // Fisher-Yates shuffle
    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }

    console.log(`🔀 Teams after shuffle: ${teamIds.join(', ')}`);

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

      console.log(`🏟️ Group ${groupId}: ${groupTeams.join(', ')}`);

      // Genera le coppie con Circle Method (andata, o andata+ritorno)
      const allRoundPairs = isDouble
        ? buildDoubleRoundRobinPairs(groupTeams)
        : buildRoundRobinPairs(groupTeams);

      // Log bilanciamento per debug
      const balance = checkHomeAwayBalance(allRoundPairs);
      console.log(`   ⚖️ Home/Away balance for ${groupId}:`, JSON.stringify(balance));

      const rounds = formatRounds(allRoundPairs);

      rounds.forEach(rObj => {
        rObj.matches.forEach(m => {
          const matchId  = `${tournamentId}_${groupId}_R${String(rObj.roundNumber).padStart(2, '0')}_M${String(globalMatchCounter).padStart(3, '0')}`;
          const matchRef = db.collection('matches').doc(matchId);

          const matchData = buildMatchData(
            matchId, tournamentId, groupId, rObj.roundNumber,
            m.home, m.away,
            teamNamesMap[m.home] || m.home,
            teamNamesMap[m.away] || m.away,
            sport, matchFormatGironi, profile
          );

          batch.set(matchRef, matchData);
          console.log(`   ✓ R${rObj.roundNumber} | ${teamNamesMap[m.home]} (H) vs ${teamNamesMap[m.away]} (A)`);
          globalMatchCounter++;
        });
      });
    }

    // 7) Genera standings iniziali
    teamIds.forEach(teamId => {
      const groupId    = teamGroupAssignment[teamId];
      const teamName   = teamNamesMap[teamId] || teamId;
      const standingId = `standings_${tournamentId}_${teamId}`;
      const standingRef = db.collection('standings').doc(standingId);

      const standingData = buildStandingData(
        standingId, teamId, tournamentId, groupId, teamName,
        sport, matchFormatGironi, profile
      );

      batch.set(standingRef, standingData);
      console.log(`   ✓ Standing: ${teamName} (${groupId})`);
    });

    // 8) Aggiorna torneo
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    batch.update(tournamentRef, {
      teams_current:   totalTeams,
      teams_per_group: teamsPerGroup
    });

    // 9) Commit
    console.log(`💾 Committing ${globalMatchCounter - 1} matches + ${teamIds.length} standings...`);
    await batch.commit();
    console.log(`✅ [SUCCESS] Generated ${globalMatchCounter - 1} matches and ${teamIds.length} standings`);

  } catch (error) {
    console.error('❌ [ERROR] generateMatchesIfReady failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = { generateMatchesIfReady };