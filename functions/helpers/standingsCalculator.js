const admin = require('firebase-admin');
const db = admin.firestore();



function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function toNumberSafe(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function toBooleanSafe(val, fallback = false) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return fallback;
}



// ===============================
// HELPER: Match profile (sport + format)
// ===============================
function getMatchProfile(sport, matchFormat) {
  const s = String(sport || '').toLowerCase().trim();
  const f = String(matchFormat || '').toLowerCase().trim();

  const isChess    = s.includes('scacchi') || s.includes('chess');
  const isSetBased = f.includes('su');
  const isCalcio   = !isChess && (s.includes('calcio') || s.includes('football') || s.includes('soccer'));
  const isPadel    = s.includes('padel');
  const isBeach    = s.includes('beach') || s.includes('volley');

  let normalizedSport = 'calcio';
  if (isChess)      normalizedSport = 'scacchi';
  else if (isPadel) normalizedSport = 'padel';
  else if (isBeach) normalizedSport = 'beach_volley';

  return { isChess, isSetBased, isCalcio, isPadel, isBeach, normalizedSport };
}



// ===============================
// HELPER: Parse sets_detail string
// ===============================
function parseSetsDetail(setsDetail) {
  if (!setsDetail || typeof setsDetail !== 'string') {
    return [];
  }
  
  const sets = [];
  const parts = setsDetail.split(',').map(s => s.trim());
  
  for (const part of parts) {
    const match = part.match(/^(\d+)-(\d+)$/);
    if (match) {
      sets.push({
        a: parseInt(match[1], 10),
        b: parseInt(match[2], 10)
      });
    }
  }
  
  return sets;
}

// ===============================
// HELPER: Calcola totale game da sets_detail
// ===============================
function calculateGamesFromSets(setsDetail) {
  const sets = parseSetsDetail(setsDetail);
  let gamesA = 0;
  let gamesB = 0;
  
  for (const set of sets) {
    gamesA += set.a;
    gamesB += set.b;
  }
  
  return { gamesA, gamesB };
}



// ===============================
// HELPER: H2H per format a TEMPO
// ===============================
function buildH2HStatsTempo(teamIds, matches, winPoints, drawPoints = 1) {
  const set = new Set(teamIds);
  const h2h = {};

  teamIds.forEach(id => {
    h2h[id] = { 
      h2h_points:    0, 
      h2h_goal_diff: 0, 
      h2h_goals_for: 0 
    };
  });

  matches.forEach(m => {
    // FIX BUG 1: toBooleanSafe per gestire sia boolean sia stringa "true"
    if (!toBooleanSafe(m.played)) return;
    if (!set.has(m.team_a) || !set.has(m.team_b)) return;

    const a = m.team_a;
    const b = m.team_b;

    // FIX BUG 4: toNumberSafe per gestire null, "null", stringhe vuote
    const sa = toNumberSafe(m.score_a, 0);
    const sb = toNumberSafe(m.score_b, 0);

    h2h[a].h2h_goals_for += sa;
    h2h[b].h2h_goals_for += sb;
    h2h[a].h2h_goal_diff += (sa - sb);
    h2h[b].h2h_goal_diff += (sb - sa);

    if (sa > sb) {
      h2h[a].h2h_points += winPoints;
    } else if (sa < sb) {
      h2h[b].h2h_points += winPoints;
    } else {
      h2h[a].h2h_points += drawPoints;
      h2h[b].h2h_points += drawPoints;
    }
  });

  return h2h;
}



// ===============================
// HELPER: H2H per format a SET
// ===============================
function buildH2HStatsSet(teamIds, matches, winPoints) {
  const set = new Set(teamIds);
  const h2h = {};

  teamIds.forEach(id => {
    h2h[id] = { 
      h2h_points:    0,
      h2h_set_diff:  0,
      h2h_sets_for:  0,
      h2h_game_diff: 0,
      h2h_games_for: 0
    };
  });

  matches.forEach(m => {
    // FIX BUG 1: toBooleanSafe per gestire sia boolean sia stringa "true"
    if (!toBooleanSafe(m.played)) return;
    if (!set.has(m.team_a) || !set.has(m.team_b)) return;

    const a = m.team_a;
    const b = m.team_b;
    
    // FIX BUG 4: toNumberSafe per gestire null, "null", stringhe vuote
    const setsA = toNumberSafe(m.score_a, 0);
    const setsB = toNumberSafe(m.score_b, 0);
    
    let gamesA = toNumberSafe(m.games_a, 0);
    let gamesB = toNumberSafe(m.games_b, 0);
    
    if (gamesA === 0 && gamesB === 0 && m.sets_detail) {
      const calculated = calculateGamesFromSets(m.sets_detail);
      gamesA = calculated.gamesA;
      gamesB = calculated.gamesB;
    }

    h2h[a].h2h_sets_for  += setsA;
    h2h[b].h2h_sets_for  += setsB;
    h2h[a].h2h_set_diff  += (setsA - setsB);
    h2h[b].h2h_set_diff  += (setsB - setsA);

    h2h[a].h2h_games_for  += gamesA;
    h2h[b].h2h_games_for  += gamesB;
    h2h[a].h2h_game_diff  += (gamesA - gamesB);
    h2h[b].h2h_game_diff  += (gamesB - gamesA);

    if (setsA > setsB) {
      h2h[a].h2h_points += winPoints;
    } else if (setsB > setsA) {
      h2h[b].h2h_points += winPoints;
    }
  });

  return h2h;
}

// ===============================
// HELPER: Confronta due team per ex-aequo (TEMPO)
// ===============================
function sameTupleTempo(a, b) {
  return (
    a.points         === b.points         &&
    a.h2h_points     === b.h2h_points     &&
    a.h2h_goal_diff  === b.h2h_goal_diff  &&
    a.h2h_goals_for  === b.h2h_goals_for  &&
    a.goal_diff      === b.goal_diff      &&
    a.goals_for      === b.goals_for
  );
}

// ===============================
// HELPER: Confronta due team per ex-aequo (SET)
// ===============================
function sameTupleSet(a, b) {
  return (
    a.points         === b.points         &&
    a.h2h_points     === b.h2h_points     &&
    a.h2h_set_diff   === b.h2h_set_diff   &&
    a.h2h_game_diff  === b.h2h_game_diff  &&
    a.set_diff       === b.set_diff       &&
    a.sets_for       === b.sets_for       &&
    a.game_diff      === b.game_diff      &&
    a.games_for      === b.games_for
  );
}

// ===============================
// HELPER: Confronta due giocatori per ex-aequo (SCACCHI)
// ===============================
function sameTupleChess(a, b) {
  return (
    a.points     === b.points     &&
    a.h2h_points === b.h2h_points
  );
}


// ===============================
// HELPER: Ranking con H2H (TEMPO)
// ===============================
function rankGroupTeamsTempo(teamsStats, groupMatches, winPoints) {
  const buckets = {};
  teamsStats.forEach(t => {
    const p = t.points;
    if (!buckets[p]) buckets[p] = [];
    buckets[p].push(t);
  });

  const pointsDesc = Object.keys(buckets).map(Number).sort((a, b) => b - a);
  const finalOrdered = [];

  pointsDesc.forEach(p => {
    const bucket = buckets[p];

    if (bucket.length === 1) {
      const t = bucket[0];
      t.h2h_points    = 0;
      t.h2h_goal_diff = 0;
      t.h2h_goals_for = 0;
      finalOrdered.push(t);
      return;
    }

    const ids    = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsTempo(ids, groupMatches, winPoints);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { h2h_points: 0, h2h_goal_diff: 0, h2h_goals_for: 0 };
      t.h2h_points    = h.h2h_points;
      t.h2h_goal_diff = h.h2h_goal_diff;
      t.h2h_goals_for = h.h2h_goals_for;
    });

    bucket.sort((a, b) =>
      b.h2h_points    - a.h2h_points    ||
      b.h2h_goal_diff - a.h2h_goal_diff ||
      b.h2h_goals_for - a.h2h_goals_for ||
      b.goal_diff     - a.goal_diff     ||
      b.goals_for     - a.goals_for     ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  let rank = 1;
  let i = 0;
  while (i < finalOrdered.length) {
    const base = finalOrdered[i];
    base.rank_level = rank;

    let j = i + 1;
    while (j < finalOrdered.length && sameTupleTempo(base, finalOrdered[j])) {
      finalOrdered[j].rank_level = rank;
      j++;
    }

    rank += (j - i);
    i = j;
  }

  return finalOrdered;
}

// ===============================
// HELPER: Ranking con H2H (SET)
// ===============================
function rankGroupTeamsSet(teamsStats, groupMatches, winPoints) {
  const buckets = {};
  teamsStats.forEach(t => {
    const p = t.points;
    if (!buckets[p]) buckets[p] = [];
    buckets[p].push(t);
  });

  const pointsDesc = Object.keys(buckets).map(Number).sort((a, b) => b - a);
  const finalOrdered = [];

  pointsDesc.forEach(p => {
    const bucket = buckets[p];

    if (bucket.length === 1) {
      const t = bucket[0];
      t.h2h_points    = 0;
      t.h2h_set_diff  = 0;
      t.h2h_sets_for  = 0;
      t.h2h_game_diff = 0;
      t.h2h_games_for = 0;
      finalOrdered.push(t);
      return;
    }

    const ids    = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsSet(ids, groupMatches, winPoints);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { 
        h2h_points: 0, h2h_set_diff: 0, h2h_sets_for: 0,
        h2h_game_diff: 0, h2h_games_for: 0
      };
      t.h2h_points    = h.h2h_points;
      t.h2h_set_diff  = h.h2h_set_diff;
      t.h2h_sets_for  = h.h2h_sets_for;
      t.h2h_game_diff = h.h2h_game_diff;
      t.h2h_games_for = h.h2h_games_for;
    });

    bucket.sort((a, b) =>
      b.h2h_points    - a.h2h_points    ||
      b.h2h_set_diff  - a.h2h_set_diff  ||
      b.h2h_game_diff - a.h2h_game_diff ||
      b.set_diff      - a.set_diff      ||
      b.sets_for      - a.sets_for      ||
      b.game_diff     - a.game_diff     ||
      b.games_for     - a.games_for     ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  let rank = 1;
  let i = 0;
  while (i < finalOrdered.length) {
    const base = finalOrdered[i];
    base.rank_level = rank;

    let j = i + 1;
    while (j < finalOrdered.length && sameTupleSet(base, finalOrdered[j])) {
      finalOrdered[j].rank_level = rank;
      j++;
    }

    rank += (j - i);
    i = j;
  }

  return finalOrdered;
}



// ===============================
// HELPER: Ranking con H2H (SCACCHI)
// ===============================
function rankGroupTeamsChess(teamsStats, groupMatches, winPoints) {
  const buckets = {};
  teamsStats.forEach(t => {
    const p = t.points;
    if (!buckets[p]) buckets[p] = [];
    buckets[p].push(t);
  });

  const pointsDesc = Object.keys(buckets).map(Number).sort((a, b) => b - a);
  const finalOrdered = [];

  pointsDesc.forEach(p => {
    const bucket = buckets[p];

    if (bucket.length === 1) {
      const t = bucket[0];
      t.h2h_points = 0;
      finalOrdered.push(t);
      return;
    }

    const ids    = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsTempo(ids, groupMatches, winPoints, 0.5);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { h2h_points: 0 };
      t.h2h_points = h.h2h_points;
    });

    bucket.sort((a, b) =>
      b.h2h_points - a.h2h_points ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  let rank = 1;
  let i = 0;
  while (i < finalOrdered.length) {
    const base = finalOrdered[i];
    base.rank_level = rank;

    let j = i + 1;
    while (j < finalOrdered.length && sameTupleChess(base, finalOrdered[j])) {
      finalOrdered[j].rank_level = rank;
      j++;
    }

    rank += (j - i);
    i = j;
  }

  return finalOrdered;
}




// ===============================
// HELPER: Parse point_system
// ===============================
function parsePointSystem(pointSystem, isSetBased, isChess) {
  const defaultPointsTempo = { win: 3,   draw: 1,   loss: 0 };
  const defaultPointsSet   = { win: 2,   draw: 0,   loss: 0 };
  const defaultPointsChess = { win: 1,   draw: 0.5, loss: 0 };

  const defaultPoints = isChess
    ? defaultPointsChess
    : (isSetBased ? defaultPointsSet : defaultPointsTempo);

  if (!pointSystem || typeof pointSystem !== 'string') {
    return defaultPoints;
  }

  const parts = pointSystem.split('-').map(p => parseFloat(p.trim()));

  if (parts.length < 2 || parts.some(isNaN)) {
    console.log(`⚠️ Invalid point_system "${pointSystem}", using default`);
    return defaultPoints;
  }

  return {
    win:  parts[0],
    draw: parts[1] ?? 0,
    loss: parts[2] ?? 0
  };
}



// ===============================
// MAIN: Genera Standings
// ===============================
async function generateStandingsBackend(tournamentId) {
  try {
    console.log(`📊 [START] Generating standings for ${tournamentId}`);

    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found:', tournamentId);
      return;
    }

    const tournament = tournamentDoc.data();
    
    const rawSport       = toStringSafe(tournament.sport);
    const rawMatchFormat = toStringSafe(tournament.match_format_gironi);

    const profile = getMatchProfile(rawSport, rawMatchFormat);

    const sport             = profile.normalizedSport;
    const matchFormatGironi = rawMatchFormat.toLowerCase();
    const isSetBased        = profile.isSetBased;
    const isChess           = profile.isChess;

    const rawPointSystem = toStringSafe(tournament.point_system);

    const pointSystem = parsePointSystem(rawPointSystem, isSetBased, isChess);

    console.log(`🏆 Sport: ${sport}, Format: ${matchFormatGironi}, Set-based: ${isSetBased}, Chess: ${isChess}`);
    console.log(`⚙️ Point system: Win=${pointSystem.win}, Draw=${pointSystem.draw}, Loss=${pointSystem.loss}`);

    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (matchesSnapshot.empty) {
      console.log('⚠️ No matches found for', tournamentId);
      return;
    }

    const matches = matchesSnapshot.docs.map(doc => doc.data());
    console.log(`📋 Found ${matches.length} matches`);

    const teamGroupMap = {};
    matches.forEach(m => {
      // FIX BUG 3: toStringSafe su team_a/team_b per evitare chiavi
      // errate quando i valori sono di tipo diverso da stringa
      if (m.team_a) teamGroupMap[toStringSafe(m.team_a)] = toStringSafe(m.group_id);
      if (m.team_b) teamGroupMap[toStringSafe(m.team_b)] = toStringSafe(m.group_id);
    });

    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('⚠️ No subscriptions found for', tournamentId);
      return;
    }

    const teams = subscriptionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        team_id:   toStringSafe(data.team_id),
        team_name: toStringSafe(data.team_name)
      };
    });

    console.log(`👥 Found ${teams.length} teams`);

    const byGroup = {};

    teams.forEach(t => {
      const teamId   = t.team_id;
      const teamName = t.team_name;
      const groupId  = teamGroupMap[teamId];

      if (!teamId || !groupId) {
        console.log(`⚠️ Skipping team without ID or group: ${teamName}`);
        return;
      }

      const stats = {
        team_id:        teamId,
        tournament_id:  tournamentId,
        group_id:       groupId,
        team_name:      teamName,
        matches_played: 0,
        points:         0,
        wins:           0,
        draws:          0,
        losses:         0,
        goals_for:      0,
        goals_against:  0,
        goal_diff:      0,
        sets_for:       0,
        sets_against:   0,
        set_diff:       0,
        games_for:      0,
        games_against:  0,
        game_diff:      0,
        h2h_points:     0,
        h2h_goal_diff:  0,
        h2h_goals_for:  0,
        h2h_set_diff:   0,
        h2h_sets_for:   0,
        h2h_game_diff:  0,
        h2h_games_for:  0,
        rank_level:     0,
        sport:                sport,
        match_format_gironi:  matchFormatGironi,
        is_set_based:         isSetBased,
        is_chess:             isChess,
        individual_or_team:   toStringSafe(tournament.individual_or_team, 'team')
      };

      matches.forEach(m => {
        // FIX BUG 1: toBooleanSafe per gestire sia boolean sia stringa "true"
        if (!toBooleanSafe(m.played)) return;

        // FIX BUG 3: confronto tramite toStringSafe su entrambi i lati
        const isTeamA = toStringSafe(m.team_a) === teamId;
        const isTeamB = toStringSafe(m.team_b) === teamId;
        if (!isTeamA && !isTeamB) return;

        stats.matches_played++;

        if (isChess) {
          // FIX BUG 4: toNumberSafe al posto di Number() || 0
          const scoreFor     = isTeamA ? toNumberSafe(m.score_a, 0) : toNumberSafe(m.score_b, 0);
          const scoreAgainst = isTeamA ? toNumberSafe(m.score_b, 0) : toNumberSafe(m.score_a, 0);

          if (scoreFor > scoreAgainst) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (scoreFor === scoreAgainst) {
            stats.draws++;
            stats.points += pointSystem.draw;
          } else {
            stats.losses++;
            stats.points += pointSystem.loss;
          }

        } else if (isSetBased) {
          // FIX BUG 4: toNumberSafe al posto di Number() || 0
          const setsFor     = isTeamA ? toNumberSafe(m.score_a, 0) : toNumberSafe(m.score_b, 0);
          const setsAgainst = isTeamA ? toNumberSafe(m.score_b, 0) : toNumberSafe(m.score_a, 0);

          stats.sets_for     += setsFor;
          stats.sets_against += setsAgainst;
          stats.set_diff     += (setsFor - setsAgainst);

          let gamesA = toNumberSafe(m.games_a, 0);
          let gamesB = toNumberSafe(m.games_b, 0);

          if (gamesA === 0 && gamesB === 0 && m.sets_detail) {
            const calculated = calculateGamesFromSets(m.sets_detail);
            gamesA = calculated.gamesA;
            gamesB = calculated.gamesB;
          }

          const gamesFor     = isTeamA ? gamesA : gamesB;
          const gamesAgainst = isTeamA ? gamesB : gamesA;

          stats.games_for     += gamesFor;
          stats.games_against += gamesAgainst;
          stats.game_diff     += (gamesFor - gamesAgainst);

          if (setsFor > setsAgainst) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (setsFor < setsAgainst) {
            stats.losses++;
            stats.points += pointSystem.loss;
          }

        } else {
          // FIX BUG 4: toNumberSafe al posto di Number() || 0
          const gf = isTeamA ? toNumberSafe(m.score_a, 0) : toNumberSafe(m.score_b, 0);
          const ga = isTeamA ? toNumberSafe(m.score_b, 0) : toNumberSafe(m.score_a, 0);

          stats.goals_for     += gf;
          stats.goals_against += ga;
          stats.goal_diff     += (gf - ga);

          if (gf > ga) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (gf === ga) {
            stats.draws++;
            stats.points += pointSystem.draw;
          } else {
            stats.losses++;
            stats.points += pointSystem.loss;
          }
        }
      });

      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push(stats);
    });

    console.log(`📊 Groups found: ${Object.keys(byGroup).join(', ')}`);

    const batch = db.batch();

    const existingStandings = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    console.log(`🗑️ Deleting ${existingStandings.size} existing standings`);
    existingStandings.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    let standingsCount = 0;

    Object.keys(byGroup).forEach(groupId => {
      const groupTeams = byGroup[groupId];
      const anyPlayed  = groupTeams.some(t => t.matches_played > 0);

      console.log(`🏟️ Processing ${groupId}: ${groupTeams.length} teams, anyPlayed=${anyPlayed}`);

      if (!anyPlayed) {
        groupTeams.forEach(t => {
          // FIX BUG 2: standingId include tournamentId per evitare
          // collisioni tra tornei diversi che condividono gli stessi team_id
          const standingId  = `standings_${tournamentId}_${t.team_id}`;
          const standingRef = db.collection('standings').doc(standingId);

          batch.set(standingRef, {
            standing_id: standingId,
            ...t,
            rank_level: 1,
            rank_group: 'INIT'
          });

          console.log(`   ✓ Standing ${standingId}: ${t.team_name} (rank 1, INIT)`);
          standingsCount++;
        });
        return;
      }

      const groupMatches = matches.filter(m => m.group_id === groupId);
      const ordered = isChess
        ? rankGroupTeamsChess(groupTeams, groupMatches, pointSystem.win)
        : isSetBased
          ? rankGroupTeamsSet(groupTeams, groupMatches, pointSystem.win)
          : rankGroupTeamsTempo(groupTeams, groupMatches, pointSystem.win);

      ordered.forEach(t => {
        let rankGroupKey;
        if (isChess) {
          rankGroupKey = [
            t.points,
            `H${t.h2h_points}`
          ].join('|');
        } else if (isSetBased) {
          rankGroupKey = [
            t.points,
            `H${t.h2h_points}`,
            `HS${t.h2h_set_diff}`,
            `HG${t.h2h_game_diff}`,
            `S${t.set_diff}`,
            `SF${t.sets_for}`,
            `G${t.game_diff}`,
            `GF${t.games_for}`
          ].join('|');
        } else {
          rankGroupKey = [
            t.points,
            `H${t.h2h_points}`,
            t.h2h_goal_diff,
            t.h2h_goals_for,
            t.goal_diff,
            t.goals_for
          ].join('|');
        }

        // FIX BUG 2: standingId include tournamentId per evitare
        // collisioni tra tornei diversi che condividono gli stessi team_id
        const standingId  = `standings_${tournamentId}_${t.team_id}`;
        const standingRef = db.collection('standings').doc(standingId);

        batch.set(standingRef, {
          standing_id: standingId,
          ...t,
          rank_group: rankGroupKey
        });

        console.log(`   ✓ Standing ${standingId}: ${t.team_name} (rank ${t.rank_level}, ${t.points} pts)`);
        standingsCount++;
      });
    });

    console.log(`💾 Committing ${standingsCount} standings...`);
    await batch.commit();
    console.log(`✅ [SUCCESS] Generated ${standingsCount} standings for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] generateStandingsBackend failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = { generateStandingsBackend };