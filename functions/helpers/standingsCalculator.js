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

  return { isChess, isSetBased, isCalcio, isPadel, isBeach, normalizedSport };
}



// ===============================
// HELPER: Parse sets_detail string
// Es: "6-4,3-6,7-5" → [{a: 6, b: 4}, {a: 3, b: 6}, {a: 7, b: 5}]
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
      h2h_points: 0, 
      h2h_goal_diff: 0, 
      h2h_goals_for: 0 
    };
  });

  matches.forEach(m => {
    if (!m.played) return;
    if (!set.has(m.team_a) || !set.has(m.team_b)) return;

    const a = m.team_a;
    const b = m.team_b;
    const sa = Number(m.score_a) || 0;
    const sb = Number(m.score_b) || 0;

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
      h2h_points: 0,
      h2h_set_diff: 0,
      h2h_sets_for: 0,
      h2h_game_diff: 0,
      h2h_games_for: 0
    };
  });

  matches.forEach(m => {
    if (!m.played) return;
    if (!set.has(m.team_a) || !set.has(m.team_b)) return;

    const a = m.team_a;
    const b = m.team_b;
    
    // Set vinti (score_a e score_b contengono i set vinti)
    const setsA = Number(m.score_a) || 0;
    const setsB = Number(m.score_b) || 0;
    
    // Game totali (da games_a/games_b o calcolati da sets_detail)
    let gamesA = Number(m.games_a) || 0;
    let gamesB = Number(m.games_b) || 0;
    
    // Se games non presenti, calcola da sets_detail
    if (gamesA === 0 && gamesB === 0 && m.sets_detail) {
      const calculated = calculateGamesFromSets(m.sets_detail);
      gamesA = calculated.gamesA;
      gamesB = calculated.gamesB;
    }

    // H2H Set
    h2h[a].h2h_sets_for += setsA;
    h2h[b].h2h_sets_for += setsB;
    h2h[a].h2h_set_diff += (setsA - setsB);
    h2h[b].h2h_set_diff += (setsB - setsA);

    // H2H Game
    h2h[a].h2h_games_for += gamesA;
    h2h[b].h2h_games_for += gamesB;
    h2h[a].h2h_game_diff += (gamesA - gamesB);
    h2h[b].h2h_game_diff += (gamesB - gamesA);

    // Punti (no pareggi nei format a set)
    if (setsA > setsB) {
      h2h[a].h2h_points += winPoints;
    } else if (setsB > setsA) {
      h2h[b].h2h_points += winPoints;
    }
    // No else: in format a set non ci sono pareggi
  });

  return h2h;
}

// ===============================
// HELPER: Confronta due team per ex-aequo (TEMPO)
// ===============================
function sameTupleTempo(a, b) {
  return (
    a.points === b.points &&
    a.h2h_points === b.h2h_points &&
    a.h2h_goal_diff === b.h2h_goal_diff &&
    a.h2h_goals_for === b.h2h_goals_for &&
    a.goal_diff === b.goal_diff &&
    a.goals_for === b.goals_for
  );
}

// ===============================
// HELPER: Confronta due team per ex-aequo (SET)
// ===============================
function sameTupleSet(a, b) {
  return (
    a.points === b.points &&
    a.h2h_points === b.h2h_points &&
    a.h2h_set_diff === b.h2h_set_diff &&
    a.h2h_game_diff === b.h2h_game_diff &&
    a.set_diff === b.set_diff &&
    a.sets_for === b.sets_for &&
    a.game_diff === b.game_diff &&
    a.games_for === b.games_for
  );
}

// ===============================
// HELPER: Confronta due giocatori per ex-aequo (SCACCHI)
// ===============================
function sameTupleChess(a, b) {
  return (
    a.points     === b.points &&
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
      t.h2h_points = 0;
      t.h2h_goal_diff = 0;
      t.h2h_goals_for = 0;
      finalOrdered.push(t);
      return;
    }

    const ids = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsTempo(ids, groupMatches, winPoints);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { h2h_points: 0, h2h_goal_diff: 0, h2h_goals_for: 0 };
      t.h2h_points = h.h2h_points;
      t.h2h_goal_diff = h.h2h_goal_diff;
      t.h2h_goals_for = h.h2h_goals_for;
    });

    // Ordina: H2H points → H2H goal diff → H2H goals for → general goal diff → general goals for → alfabetico
    bucket.sort((a, b) =>
      b.h2h_points - a.h2h_points ||
      b.h2h_goal_diff - a.h2h_goal_diff ||
      b.h2h_goals_for - a.h2h_goals_for ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  // Assegna rank_level
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
      t.h2h_points = 0;
      t.h2h_set_diff = 0;
      t.h2h_sets_for = 0;
      t.h2h_game_diff = 0;
      t.h2h_games_for = 0;
      finalOrdered.push(t);
      return;
    }

    const ids = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsSet(ids, groupMatches, winPoints);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { 
        h2h_points: 0, 
        h2h_set_diff: 0, 
        h2h_sets_for: 0,
        h2h_game_diff: 0,
        h2h_games_for: 0
      };
      t.h2h_points = h.h2h_points;
      t.h2h_set_diff = h.h2h_set_diff;
      t.h2h_sets_for = h.h2h_sets_for;
      t.h2h_game_diff = h.h2h_game_diff;
      t.h2h_games_for = h.h2h_games_for;
    });

    // Ordina: H2H points → H2H set diff → H2H game diff → general set diff → sets for → general game diff → games for → alfabetico
    bucket.sort((a, b) =>
      b.h2h_points - a.h2h_points ||
      b.h2h_set_diff - a.h2h_set_diff ||
      b.h2h_game_diff - a.h2h_game_diff ||
      b.set_diff - a.set_diff ||
      b.sets_for - a.sets_for ||
      b.game_diff - a.game_diff ||
      b.games_for - a.games_for ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  // Assegna rank_level
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

    // H2H: solo punti negli scontri diretti tra i pari punti
    const ids = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStatsTempo(ids, groupMatches, winPoints, 0.5);
    // Riusiamo buildH2HStatsTempo: per scacchi conta solo h2h_points

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { h2h_points: 0 };
      t.h2h_points = h.h2h_points;
    });

    // Ordina: H2H points → alfabetico (parità residua → stesso rank)
    bucket.sort((a, b) =>
      b.h2h_points - a.h2h_points ||
      String(a.team_id).localeCompare(String(b.team_id))
    );

    finalOrdered.push(...bucket);
  });

  // Assegna rank_level
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
  const defaultPointsTempo = { win: 3, draw: 1, loss: 0 };
  const defaultPointsSet   = { win: 2, draw: 0, loss: 0 };
  const defaultPointsChess = { win: 1, draw: 0.5, loss: 0 };

  const defaultPoints = isChess ? defaultPointsChess : (isSetBased ? defaultPointsSet : defaultPointsTempo);

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

    // 0) Recupera torneo
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    
    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found:', tournamentId);
      return;
    }

    const tournament = tournamentDoc.data();
    
    // Determina sport e format
    const profile           = getMatchProfile(tournament.sport, tournament.match_format_gironi);
    const sport             = profile.normalizedSport;
    const matchFormatGironi = String(tournament.match_format_gironi || '').toLowerCase();
    const isSetBased        = profile.isSetBased;
    const isChess           = profile.isChess;

    const pointSystem = parsePointSystem(tournament.point_system, isSetBased, isChess);

    console.log(`🏆 Sport: ${sport}, Format: ${matchFormatGironi}, Set-based: ${isSetBased}, Chess: ${isChess}`);
    console.log(`⚙️ Point system: Win=${pointSystem.win}, Draw=${pointSystem.draw}, Loss=${pointSystem.loss}`);

    // 1) Recupera match
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (matchesSnapshot.empty) {
      console.log('⚠️ No matches found for', tournamentId);
      return;
    }

    const matches = matchesSnapshot.docs.map(doc => doc.data());
    console.log(`📋 Found ${matches.length} matches`);

    // 2) Mappa team → group
    const teamGroupMap = {};
    matches.forEach(m => {
      if (m.team_a) teamGroupMap[m.team_a] = m.group_id;
      if (m.team_b) teamGroupMap[m.team_b] = m.group_id;
    });

    // 3) Recupera teams da SUBSCRIPTIONS
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
        team_id: data.team_id,
        team_name: data.team_name
      };
    });

    console.log(`👥 Found ${teams.length} teams`);

    // 4) Calcola statistiche per gruppo
    const byGroup = {};

    teams.forEach(t => {
      const teamId = t.team_id;
      const teamName = t.team_name;
      const groupId = teamGroupMap[teamId];

      if (!teamId || !groupId) {
        console.log(`⚠️ Skipping team without ID or group: ${teamName}`);
        return;
      }

      // Stats base (comuni a tutti)
      const stats = {
        team_id: teamId,
        tournament_id: tournamentId,
        group_id: groupId,
        team_name: teamName,
        matches_played: 0,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,

        // Stats per format a TEMPO (gol/game)
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,

        // Stats per format a SET
        sets_for: 0,
        sets_against: 0,
        set_diff: 0,
        games_for: 0,
        games_against: 0,
        game_diff: 0,

        // H2H (inizializzati a 0, calcolati dopo)
        h2h_points: 0,
        h2h_goal_diff: 0,
        h2h_goals_for: 0,
        h2h_set_diff: 0,
        h2h_sets_for: 0,
        h2h_game_diff: 0,
        h2h_games_for: 0,

        rank_level: 0,

        // Metadata
        sport: sport,
        match_format_gironi: matchFormatGironi,
        is_set_based: isSetBased,
        is_chess: isChess,
        individual_or_team: tournament.individual_or_team || 'team'
      };

      // Calcola statistiche dai match giocati
      matches.forEach(m => {
        if (!m.played) return;
        if (m.team_a !== teamId && m.team_b !== teamId) return;

        stats.matches_played++;

        if (isChess) {
          // === FORMAT SCACCHI ===
          // Niente gol né set — solo punti con decimali
          const scoreFor     = m.team_a === teamId ? Number(m.score_a) || 0 : Number(m.score_b) || 0;
          const scoreAgainst = m.team_a === teamId ? Number(m.score_b) || 0 : Number(m.score_a) || 0;

          if (scoreFor > scoreAgainst) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (scoreFor === scoreAgainst) {
            stats.draws++;
            stats.points += pointSystem.draw; // 0.5
          } else {
            stats.losses++;
            stats.points += pointSystem.loss;
          }

        } else if (isSetBased) {
          // === FORMAT A SET ===
          const setsFor     = m.team_a === teamId ? Number(m.score_a) || 0 : Number(m.score_b) || 0;
          const setsAgainst = m.team_a === teamId ? Number(m.score_b) || 0 : Number(m.score_a) || 0;

          stats.sets_for     += setsFor;
          stats.sets_against += setsAgainst;
          stats.set_diff     += (setsFor - setsAgainst);

          // Game totali (da games_a/games_b o calcolati da sets_detail)
          let gamesA = Number(m.games_a) || 0;
          let gamesB = Number(m.games_b) || 0;

          if (gamesA === 0 && gamesB === 0 && m.sets_detail) {
            const calculated = calculateGamesFromSets(m.sets_detail);
            gamesA = calculated.gamesA;
            gamesB = calculated.gamesB;
          }

          const gamesFor     = m.team_a === teamId ? gamesA : gamesB;
          const gamesAgainst = m.team_a === teamId ? gamesB : gamesA;

          stats.games_for     += gamesFor;
          stats.games_against += gamesAgainst;
          stats.game_diff     += (gamesFor - gamesAgainst);

          // Punti (no pareggi nei format a set)
          if (setsFor > setsAgainst) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (setsFor < setsAgainst) {
            stats.losses++;
            stats.points += pointSystem.loss;
          }

        } else {
          // === FORMAT A TEMPO ===
          const gf = m.team_a === teamId ? Number(m.score_a) || 0 : Number(m.score_b) || 0;
          const ga = m.team_a === teamId ? Number(m.score_b) || 0 : Number(m.score_a) || 0;

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

    // 5) Ranking per girone + scrittura batch
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
      const anyPlayed = groupTeams.some(t => t.matches_played > 0);

      console.log(`🏟️ Processing ${groupId}: ${groupTeams.length} teams, anyPlayed=${anyPlayed}`);

      if (!anyPlayed) {
        // Nessuna partita giocata: tutti rank 1
        groupTeams.forEach(t => {
          const standingId = `standings_${t.team_id}`;
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

      // Calcola ranking con H2H
      const groupMatches = matches.filter(m => m.group_id === groupId);
      const ordered = isChess
        ? rankGroupTeamsChess(groupTeams, groupMatches, pointSystem.win)
        : isSetBased
          ? rankGroupTeamsSet(groupTeams, groupMatches, pointSystem.win)
          : rankGroupTeamsTempo(groupTeams, groupMatches, pointSystem.win);

      ordered.forEach(t => {
        // Crea rank_group key per debug/tracciabilità
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

        const standingId = `standings_${t.team_id}`;
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
