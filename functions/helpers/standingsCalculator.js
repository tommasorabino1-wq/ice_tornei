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

  // Allineato al file generateMatches
  const isSetBased =
    f.includes('su')          ||
    f.includes('set')         ||
    f.includes('best of')     ||
    /\bbo\d+\b/.test(f)       ||
    f.includes('al meglio');

  const isChess = s.includes('scacchi') || s.includes('chess');

  // hasGames: padel e beach in ENTRAMBI i formati (allineato a generateMatches)
  const hasGames = s.includes('padel') ||
                   s.includes('beach volley') ||
                   s.includes('beach_volley');

  let normalizedSport = 'calcio';
  if (isChess)           normalizedSport = 'scacchi';
  else if (s.includes('padel'))                                     normalizedSport = 'padel';
  else if (s.includes('beach volley') || s.includes('beach_volley')) normalizedSport = 'beach_volley';

  if (!['calcio','padel','beach_volley','scacchi'].includes(normalizedSport)) {
    console.warn(`⚠️ getMatchProfile: sport non riconosciuto "${sport}"`);
  }

  return { isSetBased, isChess, hasGames, normalizedSport };
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

  if (sets.length === 0) {
    console.warn(`⚠️ calculateGamesFromSets: nessun set parsato da "${setsDetail}"`);
    return { gamesA: 0, gamesB: 0 };
  }

  let gamesA = 0;
  let gamesB = 0;
  for (const set of sets) {
    gamesA += set.a;
    gamesB += set.b;
  }

  return { gamesA, gamesB };
}



// ===============================
// HELPER: Calcola punti H2H tra un gruppo di team
// Usata per tutti gli sport: calcio, padel/beach (tempo e set), scacchi.
// Restituisce solo h2h_points — gli altri criteri di spareggio
// usano i valori globali, non quelli degli scontri diretti.
// ===============================
function buildH2HPoints(teamIds, matches, winPoints, drawPoints) {
  const teamSet = new Set(teamIds);
  const h2h = {};
  teamIds.forEach(id => { h2h[id] = { h2h_points: 0 }; });

  matches.forEach(m => {
    if (!toBooleanSafe(m.played)) return;

    const a = toStringSafe(m.team_a);
    const b = toStringSafe(m.team_b);
    if (!teamSet.has(a) || !teamSet.has(b)) return;

    // Per tutti gli sport il punteggio di riferimento è score_a/score_b
    // (set per isSetBased, game per padel/beach a tempo, punti per scacchi)
    const sa = toNumberSafe(m.score_a, 0);
    const sb = toNumberSafe(m.score_b, 0);

    if (sa > sb) {
      h2h[a].h2h_points += winPoints;
    } else if (sb > sa) {
      h2h[b].h2h_points += winPoints;
    } else {
      // Pareggio: gestito esplicitamente per tutti gli sport
      if (drawPoints > 0) {
        h2h[a].h2h_points += drawPoints;
        h2h[b].h2h_points += drawPoints;
      }
      console.warn(`⚠️ buildH2HPoints: pareggio H2H tra ${a} e ${b} (score ${sa}-${sb})`);
    }
  });

  return h2h;
}



// ===============================
// HELPER: Ex-aequo CALCIO
// Criteri: punti → h2h_points → goal_diff globale → goals_for globale
// ===============================
function sameTupleCalcio(a, b) {
  return (
    a.points     === b.points     &&
    a.h2h_points === b.h2h_points &&
    a.goal_diff  === b.goal_diff  &&
    a.goals_for  === b.goals_for
  );
}


// ===============================
// HELPER: Ex-aequo PADEL / BEACH a TEMPO
// Criteri: punti → h2h_points → game_diff globale → games_for globale
// ===============================
function sameTupleGamesTempo(a, b) {
  return (
    a.points     === b.points     &&
    a.h2h_points === b.h2h_points &&
    a.game_diff  === b.game_diff  &&
    a.games_for  === b.games_for
  );
}


// ===============================
// HELPER: Ex-aequo PADEL / BEACH a SET
// Criteri: punti → h2h_points → set_diff → sets_for → game_diff → games_for
// ===============================
function sameTupleSet(a, b) {
  return (
    a.points     === b.points     &&
    a.h2h_points === b.h2h_points &&
    a.set_diff   === b.set_diff   &&
    a.sets_for   === b.sets_for   &&
    a.game_diff  === b.game_diff  &&
    a.games_for  === b.games_for
  );
}


// ===============================
// HELPER: Ex-aequo SCACCHI
// Criteri: punti → h2h_points
// ===============================
function sameTupleChess(a, b) {
  return (
    a.points     === b.points     &&
    a.h2h_points === b.h2h_points
  );
}




// ===============================
// HELPER: Funzione interna condivisa per il ranking
// Raggruppa per punti, calcola H2H, ordina, assegna rank_level.
// sortFn e sameFn variano per sport.
// ===============================
function rankGroupTeamsBase(teamsStats, groupMatches, winPoints, drawPoints, sortFn, sameFn) {
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
      bucket[0].h2h_points = 0;
      finalOrdered.push(bucket[0]);
    } else {
      const ids    = bucket.map(x => x.team_id);
      const h2hMap = buildH2HPoints(ids, groupMatches, winPoints, drawPoints);

      bucket.forEach(t => {
        t.h2h_points = h2hMap[t.team_id]?.h2h_points ?? 0;
      });

      bucket.sort(sortFn);
      finalOrdered.push(...bucket);
    }
  });

  // Assegna rank_level
  let rank = 1;
  let i = 0;
  while (i < finalOrdered.length) {
    const base = finalOrdered[i];
    base.rank_level = rank;
    let j = i + 1;
    while (j < finalOrdered.length && sameFn(base, finalOrdered[j])) {
      finalOrdered[j].rank_level = rank;
      j++;
    }
    rank += (j - i);
    i = j;
  }

  return finalOrdered;
}


// ===============================
// HELPER: Ranking CALCIO
// Criteri: punti → h2h_points → goal_diff → goals_for → localeCompare
// ===============================
function rankGroupTeamsCalcio(teamsStats, groupMatches, winPoints, drawPoints) {
  return rankGroupTeamsBase(
    teamsStats, groupMatches, winPoints, drawPoints,
    (a, b) =>
      b.h2h_points - a.h2h_points ||
      b.goal_diff  - a.goal_diff  ||
      b.goals_for  - a.goals_for  ||
      String(a.team_id).localeCompare(String(b.team_id)),
    sameTupleCalcio
  );
}


// ===============================
// HELPER: Ranking PADEL / BEACH a TEMPO
// Criteri: punti → h2h_points → game_diff → games_for → localeCompare
// ===============================
function rankGroupTeamsGamesTempo(teamsStats, groupMatches, winPoints, drawPoints) {
  return rankGroupTeamsBase(
    teamsStats, groupMatches, winPoints, drawPoints,
    (a, b) =>
      b.h2h_points - a.h2h_points ||
      b.game_diff  - a.game_diff  ||
      b.games_for  - a.games_for  ||
      String(a.team_id).localeCompare(String(b.team_id)),
    sameTupleGamesTempo
  );
}


// ===============================
// HELPER: Ranking PADEL / BEACH a SET
// Criteri: punti → h2h_points → set_diff → sets_for → game_diff → games_for → localeCompare
// ===============================
function rankGroupTeamsSet(teamsStats, groupMatches, winPoints, drawPoints) {
  return rankGroupTeamsBase(
    teamsStats, groupMatches, winPoints, drawPoints,
    (a, b) =>
      b.h2h_points - a.h2h_points ||
      b.set_diff   - a.set_diff   ||
      b.sets_for   - a.sets_for   ||
      b.game_diff  - a.game_diff  ||
      b.games_for  - a.games_for  ||
      String(a.team_id).localeCompare(String(b.team_id)),
    sameTupleSet
  );
}


// ===============================
// HELPER: Ranking SCACCHI
// Criteri: punti → h2h_points → localeCompare
// drawPoints = 0.5 per le patte
// ===============================
function rankGroupTeamsChess(teamsStats, groupMatches, winPoints) {
  return rankGroupTeamsBase(
    teamsStats, groupMatches, winPoints, 0.5,
    (a, b) =>
      b.h2h_points - a.h2h_points ||
      String(a.team_id).localeCompare(String(b.team_id)),
    sameTupleChess
  );
}




// ===============================
// HELPER: Parse point_system
// Riceve anche `sport` per distinguere calcio da padel/beach a tempo.
// Formato atteso: "win-draw-loss" es. "3-1-0" oppure "2-1-0"
// ===============================
function parsePointSystem(pointSystem, isSetBased, isChess, sport) {
  // Default per sport set-based (padel/beach a set): no pareggio
  const defaultPointsSet = { win: 2, draw: 0, loss: 0 };

  // Default scacchi: vittoria=1, patta=0.5
  const defaultPointsChess = { win: 1, draw: 0.5, loss: 0 };

  // Default calcio a tempo
  const defaultPointsCalcio = { win: 3, draw: 1, loss: 0 };

  // Default padel/beach a tempo: stessa struttura calcio ma separato
  // per permettere futuri default diversi
  const defaultPointsGamesTempo = { win: 2, draw: 1, loss: 0 };

  let defaultPoints;
  if (isChess) {
    defaultPoints = defaultPointsChess;
  } else if (isSetBased) {
    defaultPoints = defaultPointsSet;
  } else if (sport === 'padel' || sport === 'beach_volley') {
    defaultPoints = defaultPointsGamesTempo;
  } else {
    defaultPoints = defaultPointsCalcio;
  }

  if (!pointSystem || typeof pointSystem !== 'string') {
    return defaultPoints;
  }

  const parts = pointSystem.split('-').map(p => parseFloat(p.trim()));

  if (parts.length < 3 || parts.some(isNaN)) {
    console.warn(`⚠️ parsePointSystem: formato non valido "${pointSystem}" (atteso "win-draw-loss") — uso default`);
    return defaultPoints;
  }

  const parsed = {
    win:  parts[0],
    draw: parts[1],
    loss: parts[2]
  };

  // Validazione logica: win >= draw >= loss
  if (parsed.win < parsed.draw || parsed.draw < parsed.loss) {
    console.warn(`⚠️ parsePointSystem: valori illogici "${pointSystem}" (win < draw o draw < loss) — uso default`);
    return defaultPoints;
  }

  return parsed;
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
    const profile        = getMatchProfile(rawSport, rawMatchFormat);

    const sport             = profile.normalizedSport;
    const matchFormatGironi = rawMatchFormat;
    const isSetBased        = profile.isSetBased;
    const isChess           = profile.isChess;
    const hasGames          = profile.hasGames;

    // BUG 1 FIX: passa sport a parsePointSystem
    const pointSystem = parsePointSystem(
      toStringSafe(tournament.point_system),
      isSetBased,
      isChess,
      sport
    );

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

    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('⚠️ No subscriptions found for', tournamentId);
      return;
    }

    // BUG 2 FIX: legge group_id direttamente dalle subscriptions
    const teams = subscriptionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        team_id:   toStringSafe(data.team_id),
        team_name: toStringSafe(data.team_name),
        group_id:  toStringSafe(data.group_id)
      };
    });

    console.log(`👥 Found ${teams.length} teams`);

    const byGroup = {};

    teams.forEach(t => {
      const { team_id: teamId, team_name: teamName, group_id: groupId } = t;

      if (!teamId || !groupId) {
        console.warn(`⚠️ Skipping team without ID or group: ${teamName}`);
        return;
      }

      // BUG 3 FIX: rimossi campi H2H non più necessari
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
        h2h_points:     0,
        rank_level:     0,
        sport,
        match_format_gironi:  matchFormatGironi,
        is_set_based:         isSetBased,
        is_chess:             isChess,
        individual_or_team:   toStringSafe(tournament.individual_or_team, 'team')
      };

      // Campi calcio
      if (!hasGames && !isSetBased && !isChess) {
        stats.goals_for     = 0;
        stats.goals_against = 0;
        stats.goal_diff     = 0;
      }

      // Campi game: padel/beach in entrambi i formati
      if (hasGames) {
        stats.games_for     = 0;
        stats.games_against = 0;
        stats.game_diff     = 0;
      }

      // Campi set: solo formato a set
      if (isSetBased) {
        stats.sets_for     = 0;
        stats.sets_against = 0;
        stats.set_diff     = 0;
        // game per set-based non-hasGames (es. calcio a set, raro)
        if (!hasGames) {
          stats.games_for     = 0;
          stats.games_against = 0;
          stats.game_diff     = 0;
        }
      }

      matches.forEach(m => {
        if (!toBooleanSafe(m.played)) return;

        const isTeamA = toStringSafe(m.team_a) === teamId;
        const isTeamB = toStringSafe(m.team_b) === teamId;
        if (!isTeamA && !isTeamB) return;

        stats.matches_played++;

        if (isChess) {
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

          // BUG 4 FIX: gestito esplicitamente il caso set pari
          if (setsFor > setsAgainst) {
            stats.wins++;
            stats.points += pointSystem.win;
          } else if (setsFor < setsAgainst) {
            stats.losses++;
            stats.points += pointSystem.loss;
          } else {
            stats.draws++;
            stats.points += pointSystem.draw;
            console.warn(`⚠️ Set pari in match ${m.match_id} — trattato come pareggio`);
          }

        } else {
          // BUG 5 FIX: distingue calcio (goals) da padel/beach (games)
          const scoreFor     = isTeamA ? toNumberSafe(m.score_a, 0) : toNumberSafe(m.score_b, 0);
          const scoreAgainst = isTeamA ? toNumberSafe(m.score_b, 0) : toNumberSafe(m.score_a, 0);

          if (hasGames) {
            // Padel / Beach a tempo
            stats.games_for     += scoreFor;
            stats.games_against += scoreAgainst;
            stats.game_diff     += (scoreFor - scoreAgainst);
          } else {
            // Calcio
            stats.goals_for     += scoreFor;
            stats.goals_against += scoreAgainst;
            stats.goal_diff     += (scoreFor - scoreAgainst);
          }

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
        }
      });

      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push(stats);
    });

    console.log(`📊 Groups found: ${Object.keys(byGroup).join(', ')}`);

    // BUG 8 FIX: raccoglie tutte le operazioni per batch chunking
    const allOperations = [];

    const existingStandings = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    console.log(`🗑️ Deleting ${existingStandings.size} existing standings`);
    existingStandings.docs.forEach(doc => {
      allOperations.push({ type: 'delete', ref: doc.ref });
    });

    Object.keys(byGroup).forEach(groupId => {
      const groupTeams = byGroup[groupId];
      const anyPlayed  = groupTeams.some(t => t.matches_played > 0);

      console.log(`🏟️ Processing ${groupId}: ${groupTeams.length} teams, anyPlayed=${anyPlayed}`);

      if (!anyPlayed) {
        groupTeams.forEach(t => {
          const standingId  = `standings_${tournamentId}_${t.team_id}`;
          const standingRef = db.collection('standings').doc(standingId);
          allOperations.push({ type: 'set', ref: standingRef, data: {
            standing_id: standingId, ...t, rank_level: 1, rank_group: 'INIT'
          }});
          console.log(`   ✓ Standing ${standingId}: ${t.team_name} (rank 1, INIT)`);
        });

      } else {

        const groupMatches = matches.filter(m => toStringSafe(m.group_id) === groupId);

        let ordered;
        if (isChess) {
          ordered = rankGroupTeamsChess(groupTeams, groupMatches, pointSystem.win);
        } else if (isSetBased) {
          ordered = rankGroupTeamsSet(groupTeams, groupMatches, pointSystem.win, pointSystem.draw);
        } else if (hasGames) {
          ordered = rankGroupTeamsGamesTempo(groupTeams, groupMatches, pointSystem.win, pointSystem.draw);
        } else {
          ordered = rankGroupTeamsCalcio(groupTeams, groupMatches, pointSystem.win, pointSystem.draw);
        }

        ordered.forEach(t => {
          let rankGroupKey;
          if (isChess) {
            rankGroupKey = [t.points, `H${t.h2h_points}`].join('|');
          } else if (isSetBased) {
            rankGroupKey = [
              t.points, `H${t.h2h_points}`,
              `S${t.set_diff}`, `SF${t.sets_for}`,
              `G${t.game_diff}`, `GF${t.games_for}`
            ].join('|');
          } else if (hasGames) {
            rankGroupKey = [
              t.points, `H${t.h2h_points}`,
              `G${t.game_diff}`, `GF${t.games_for}`
            ].join('|');
          } else {
            rankGroupKey = [
              t.points, `H${t.h2h_points}`,
              `GD${t.goal_diff}`, `GF${t.goals_for}`
            ].join('|');
          }

          const standingId  = `standings_${tournamentId}_${t.team_id}`;
          const standingRef = db.collection('standings').doc(standingId);
          allOperations.push({ type: 'set', ref: standingRef, data: {
            standing_id: standingId, ...t, rank_group: rankGroupKey
          }});
          console.log(`   ✓ Standing ${standingId}: ${t.team_name} (rank ${t.rank_level}, ${t.points} pts)`);
        });
      }
    });

    // BUG 8 FIX: commit in batch da 499 operazioni
    const BATCH_LIMIT = 499;
    let operationCount = 0;
    let currentBatch = db.batch();

    for (const op of allOperations) {
      if (op.type === 'delete') currentBatch.delete(op.ref);
      else                      currentBatch.set(op.ref, op.data);
      operationCount++;

      if (operationCount === BATCH_LIMIT) {
        await currentBatch.commit();
        console.log(`💾 Batch committed (${operationCount} ops)`);
        currentBatch   = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await currentBatch.commit();
      console.log(`💾 Final batch committed (${operationCount} ops)`);
    }

    console.log(`✅ [SUCCESS] Generated standings for ${tournamentId}`);

  } catch (error) {
    console.error('❌ [ERROR] generateStandingsBackend failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}



module.exports = { generateStandingsBackend };