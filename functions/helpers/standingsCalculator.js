const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// HELPER: H2H MINI-STANDINGS
// ===============================
function buildH2HStats(teamIds, matches) {
  const set = new Set(teamIds);
  const h2h = {};

  teamIds.forEach(id => {
    h2h[id] = { h2h_points: 0, h2h_goal_diff: 0, h2h_goals_for: 0 };
  });

  matches.forEach(m => {
    if (!m.played) return;
    if (!set.has(m.team_a) || !set.has(m.team_b)) return;

    const a = m.team_a;
    const b = m.team_b;
    const sa = Number(m.score_a);
    const sb = Number(m.score_b);

    // goals
    h2h[a].h2h_goals_for += sa;
    h2h[b].h2h_goals_for += sb;

    // diff
    h2h[a].h2h_goal_diff += (sa - sb);
    h2h[b].h2h_goal_diff += (sb - sa);

    // points
    if (sa > sb) {
      h2h[a].h2h_points += 3;
    } else if (sa < sb) {
      h2h[b].h2h_points += 3;
    } else {
      h2h[a].h2h_points += 1;
      h2h[b].h2h_points += 1;
    }
  });

  return h2h;
}

// ===============================
// HELPER: Confronta due team per ex-aequo
// ===============================
function sameTuple(a, b) {
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
// HELPER: Ranking con H2H
// ===============================
function rankGroupTeams(teamsStats, groupMatches) {
  // 1) Raggruppa per punti
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
      // Nessun tie: h2h = 0 per completezza
      const t = bucket[0];
      t.h2h_points = 0;
      t.h2h_goal_diff = 0;
      t.h2h_goals_for = 0;
      finalOrdered.push(t);
      return;
    }

    // 2) Mini-classifica H2H tra team con stessi punti
    const ids = bucket.map(x => x.team_id);
    const h2hMap = buildH2HStats(ids, groupMatches);

    bucket.forEach(t => {
      const h = h2hMap[t.team_id] || { h2h_points: 0, h2h_goal_diff: 0, h2h_goals_for: 0 };
      t.h2h_points = h.h2h_points;
      t.h2h_goal_diff = h.h2h_goal_diff;
      t.h2h_goals_for = h.h2h_goals_for;
    });

    // 3) Ordina il bucket con H2H
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

  // 4) Assegna rank_level con ex-aequo (1,2,2,4)
  let rank = 1;
  let i = 0;
  while (i < finalOrdered.length) {
    const base = finalOrdered[i];
    base.rank_level = rank;

    let j = i + 1;
    while (j < finalOrdered.length && sameTuple(base, finalOrdered[j])) {
      finalOrdered[j].rank_level = rank;
      j++;
    }

    rank += (j - i);
    i = j;
  }

  return finalOrdered;
}

// ===============================
// MAIN: Genera Standings
// ===============================
async function generateStandingsBackend(tournamentId) {
  try {
    // 1) Recupera match
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (matchesSnapshot.empty) {
      console.log('No matches found for', tournamentId);
      return;
    }

    const matches = matchesSnapshot.docs.map(doc => doc.data());

    // 2) Mappa team → group
    const teamGroupMap = {};
    matches.forEach(m => {
      if (m.team_a) teamGroupMap[m.team_a] = m.group_id;
      if (m.team_b) teamGroupMap[m.team_b] = m.group_id;
    });

    // 3) Recupera teams
    const teamsSnapshot = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (teamsSnapshot.empty) {
      console.log('No teams found for', tournamentId);
      return;
    }

    const teams = teamsSnapshot.docs.map(doc => doc.data());

    // 4) Calcola statistiche per gruppo
    const byGroup = {};

    teams.forEach(t => {
      const teamId = t.team_id;
      const teamName = t.team_name;
      const groupId = teamGroupMap[teamId];

      if (!teamId || !groupId) return;

      const stats = {
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
        rank_level: 0
      };

      matches.forEach(m => {
        if (!m.played) return;
        if (m.team_a !== teamId && m.team_b !== teamId) return;

        const gf = m.team_a === teamId ? m.score_a : m.score_b;
        const ga = m.team_a === teamId ? m.score_b : m.score_a;

        stats.matches_played++;
        stats.goals_for += gf;
        stats.goals_against += ga;
        stats.goal_diff += (gf - ga);

        if (gf > ga) {
          stats.wins++;
          stats.points += 3;
        } else if (gf === ga) {
          stats.draws++;
          stats.points += 1;
        } else {
          stats.losses++;
        }
      });

      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push(stats);
    });

    // 5) Ranking per girone + scrittura batch
    const batch = db.batch();

    // Prima cancella standings esistenti
    const existingStandings = await db.collection('standings')
      .where('tournament_id', '==', tournamentId)
      .get();

    existingStandings.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Poi crea nuove standings
    Object.keys(byGroup).forEach(groupId => {
      const groupTeams = byGroup[groupId];
      const anyPlayed = groupTeams.some(t => t.matches_played > 0);

      if (!anyPlayed) {
        // Nessun match giocato: tutti rank 1
        groupTeams.forEach(t => {
          const standingRef = db.collection('standings').doc();
          batch.set(standingRef, {
            ...t,
            rank_level: 1,
            rank_group: 'INIT'
          });
        });
        return;
      }

      // Ranking con H2H
      const groupMatches = matches.filter(m => m.group_id === groupId);
      const ordered = rankGroupTeams(groupTeams, groupMatches);

      ordered.forEach(t => {
        const rankGroupKey = [
          t.points,
          `H${t.h2h_points}`,
          t.h2h_goal_diff,
          t.h2h_goals_for,
          t.goal_diff,
          t.goals_for
        ].join('|');

        const standingRef = db.collection('standings').doc();
        batch.set(standingRef, {
          ...t,
          rank_group: rankGroupKey
        });
      });
    });

    await batch.commit();
    console.log(`✅ Standings generated for ${tournamentId}`);

  } catch (error) {
    console.error('generateStandingsBackend error:', error);
    throw error;
  }
}

module.exports = { generateStandingsBackend };