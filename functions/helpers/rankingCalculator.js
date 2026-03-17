const admin = require('firebase-admin');
const db = admin.firestore();



// ===============================
// HELPERS SAFE (per Firestore)
// ===============================
function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

// ===============================
// HELPER: Normalizza stringa per usarla come chiave di lookup
// ===============================
function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// ===============================
// HELPER: Normalizzazione aggressiva per matching scorer ↔ giocatore
// ===============================
function normalizeForMatch(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

// ===============================
// HELPER: Genera document ID sicuro per Firestore
// ===============================
function makeDocId(sport, name) {
  const norm = normalizeKey(name).replace(/[^a-z0-9 _-]/g, '').replace(/\s/g, '_');
  return `${sport}__${norm}`;
}

// ===============================
// HELPER: Determina V/P/S per team_a e team_b da un singolo match
// ===============================
function getMatchResult(match) {
  if (!match.played || match.score_a === null || match.score_b === null) return null;

  if (match.winner_team_id) {
    const winnerIsA = match.winner_team_id === match.team_a;
    return {
      resultA: winnerIsA ? 'win' : 'loss',
      resultB: winnerIsA ? 'loss' : 'win',
    };
  }

  const scoreA = Number(match.score_a);
  const scoreB = Number(match.score_b);
  if (scoreA > scoreB) return { resultA: 'win',  resultB: 'loss' };
  if (scoreA < scoreB) return { resultA: 'loss', resultB: 'win'  };
  return { resultA: 'draw', resultB: 'draw' };
}

// ===============================
// HELPER: Parsa scorers string in array di chiavi normalizzate
// ===============================
function parseScorers(scorersStr) {
  if (!scorersStr || typeof scorersStr !== 'string') return [];
  return scorersStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => normalizeForMatch(s));
}

// ===============================
// HELPER: Normalizza sport dal documento torneo
// ===============================
function normalizeSportFromTournament(sport) {
  const s = String(sport || '').toLowerCase().trim();
  if (s.includes('calcio') || s.includes('football') || s.includes('soccer')) return 'calcio';
  if (s.includes('padel')) return 'padel';
  if (s.includes('beach') || s.includes('volley')) return 'beach_volley';
  if (s.includes('scacchi') || s.includes('chess')) return 'scacchi';
  return 'calcio';
}

// ===============================
// HELPER: Parsa point_system "3-1-0" → { win: 3, draw: 1, loss: 0 }
// Fallback per sport se stringa assente o malformata:
//   calcio        → 3-1-0
//   padel         → 2-1-0
//   beach_volley  → 2-1-0
//   scacchi       → 1-0.5-0
// ===============================
function parsePointSystem(raw, sport) {
  const fallbacks = {
    calcio:       { win: 3,   draw: 1,   loss: 0 },
    padel:        { win: 2,   draw: 1,   loss: 0 },
    beach_volley: { win: 2,   draw: 1,   loss: 0 },
    scacchi:      { win: 1,   draw: 0.5, loss: 0 },
  };

  if (raw && typeof raw === 'string') {
    const parts = raw.split('-').map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      return { win: parts[0], draw: parts[1], loss: parts[2] };
    }
    console.warn(`⚠️ [RANKING] point_system malformato: "${raw}" — uso fallback per ${sport}`);
  }

  return fallbacks[sport] || fallbacks['calcio'];
}

// ===============================
// HELPER: Estrae nomi giocatori da documento teams
// ===============================
function extractPlayers(teamDoc) {
  const players = [];
  let i = 1;
  while (true) {
    const key = `name_player_${i}`;
    if (!(key in teamDoc)) break;
    const name = teamDoc[key];
    if (name && typeof name === 'string' && name.trim()) {
      players.push(name.trim());
    }
    i++;
    if (i > 20) break;
  }
  return players;
}

// ===============================
// HELPER: Calcola percentuale con 1 decimale
// ===============================
function pct(n, tot) {
  return tot > 0 ? Math.round((n / tot) * 1000) / 10 : 0;
}

// ===============================
// HELPER: Entry vuota per statistiche
// ===============================
function emptyStats(hasDraws, isCalcio) {
  return {
    presenze:  0,
    vittorie:  0,
    sconfitte: 0,
    punti:     0,
    ...(hasDraws && { pareggi: 0 }),
    ...(isCalcio && { gol: 0 }),
  };
}

// ===============================
// HELPER: Applica risultato a un'entry stats
// Ora accumula anche i punti in base al pointSystem
// ===============================
function applyResult(stats, result, pointSystem) {
  stats.presenze++;
  if (result === 'win') {
    stats.vittorie++;
    stats.punti += pointSystem.win;
  } else if (result === 'draw') {
    stats.pareggi = (stats.pareggi || 0) + 1;
    stats.punti += pointSystem.draw;
  } else {
    stats.sconfitte++;
    stats.punti += pointSystem.loss;
  }
}

// ===============================
// MAIN: Aggiorna ranking per un torneo specifico
// ===============================
async function updateRanking(tournamentId) {
  try {
    console.log(`🏆 [RANKING] Start updateRanking for ${tournamentId}`);

    // ── 1) Leggi torneo ──────────────────────────────────────────────────────
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      console.log(`⚠️ [RANKING] Tournament ${tournamentId} not found`);
      return;
    }

    const tournament = tournamentDoc.data();

    // sport (safe)
    const sport = normalizeSportFromTournament(
      toStringSafe(tournament.sport)
    );

    const isChess    = sport === 'scacchi';
    const isCalcio   = sport === 'calcio';
    const hasDraws   = isCalcio || isChess;
    const writeTeams = !isChess;

    // point_system (safe)
    const rawPointSystem = toStringSafe(tournament.point_system);

    const pointSystem = parsePointSystem(rawPointSystem, sport);
    console.log(`📋 [RANKING] Sport: ${sport} | pointSystem: ${JSON.stringify(pointSystem)} | writeTeams: ${writeTeams}`);

    // ── 2) Leggi tutti i match giocati (gironi + finals) ─────────────────────
    const [matchesSnap, finalsSnap] = await Promise.all([
      db.collection('matches').where('tournament_id', '==', tournamentId).get(),
      db.collection('finals').where('tournament_id', '==', tournamentId).get(),
    ]);

    const allMatches = [
      ...matchesSnap.docs.map(d => d.data()),
      ...finalsSnap.docs.map(d => d.data()),
    ].filter(m => m.played === true);

    console.log(`📊 [RANKING] Played matches: ${allMatches.length}`);

    if (allMatches.length === 0) {
      console.log(`ℹ️ [RANKING] No played matches yet — nothing to update`);
      return;
    }

    // ── 3) Leggi teams del torneo (per logo + giocatori) ─────────────────────
    const teamsSnap = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    const teamsMap = {};
    teamsSnap.docs.forEach(d => {
      const data = d.data();
      teamsMap[data.team_id] = data;
    });

    // ── 4) Strutture di aggregazione ─────────────────────────────────────────
    const teamStats   = {};
    const playerStats = {};
    const scorerMatchKeyToPlayerNorm = {};

    function ensureTeam(teamId, teamName) {
      const norm = normalizeKey(teamName);
      if (!teamStats[norm]) {
        teamStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          team_name:      teamName,
          team_name_norm: norm,
          team_logo:      teamsMap[teamId]?.team_logo || null,
        };
      } else {
        const newLogo = teamsMap[teamId]?.team_logo || null;
        if (newLogo && !teamStats[norm].team_logo) {
          teamStats[norm].team_logo = newLogo;
        }
      }
      return norm;
    }

    function ensurePlayer(playerName) {
      const norm     = normalizeKey(playerName);
      const matchKey = normalizeForMatch(playerName);
      if (!norm) return null;

      if (!playerStats[norm]) {
        playerStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          player_name:      playerName,
          player_name_norm: norm,
        };
      }

      scorerMatchKeyToPlayerNorm[matchKey] = norm;
      return norm;
    }

    // ── 5) Processa ogni match ───────────────────────────────────────────────
    for (const match of allMatches) {
      const result = getMatchResult(match);
      if (!result) continue;

      const { resultA, resultB } = result;
      const teamAId   = match.team_a;
      const teamBId   = match.team_b;
      const teamAName = match.team_a_name || teamAId;
      const teamBName = match.team_b_name || teamBId;

      if (!teamAId || !teamBId) continue;

      // ── 5a) Ranking teams ──────────────────────────────────────────────────
      if (writeTeams) {
        const normA = ensureTeam(teamAId, teamAName);
        const normB = ensureTeam(teamBId, teamBName);
        applyResult(teamStats[normA], resultA, pointSystem);
        applyResult(teamStats[normB], resultB, pointSystem);

        if (isCalcio) {
          teamStats[normA].gol += Number(match.score_a) || 0;
          teamStats[normB].gol += Number(match.score_b) || 0;
        }
      }

      // ── 5b) Ranking players ────────────────────────────────────────────────
      if (isChess) {
        const normA = ensurePlayer(teamAName);
        const normB = ensurePlayer(teamBName);
        if (normA) applyResult(playerStats[normA], resultA, pointSystem);
        if (normB) applyResult(playerStats[normB], resultB, pointSystem);

      } else {
        const teamADoc = teamsMap[teamAId];
        if (teamADoc) {
          for (const playerName of extractPlayers(teamADoc)) {
            const pNorm = ensurePlayer(playerName);
            if (pNorm) applyResult(playerStats[pNorm], resultA, pointSystem);
          }
        }

        const teamBDoc = teamsMap[teamBId];
        if (teamBDoc) {
          for (const playerName of extractPlayers(teamBDoc)) {
            const pNorm = ensurePlayer(playerName);
            if (pNorm) applyResult(playerStats[pNorm], resultB, pointSystem);
          }
        }

        // ── 5c) Gol giocatori (solo calcio) ───────────────────────────────────
        if (isCalcio) {
          for (const matchKey of parseScorers(match.scorers_a)) {
            const playerNorm = scorerMatchKeyToPlayerNorm[matchKey];
            if (playerNorm && playerStats[playerNorm]) {
              playerStats[playerNorm].gol++;
            } else {
              console.warn(`⚠️ [RANKING] Scorer not matched: "${matchKey}" in match ${match.match_id}`);
            }
          }
          for (const matchKey of parseScorers(match.scorers_b)) {
            const playerNorm = scorerMatchKeyToPlayerNorm[matchKey];
            if (playerNorm && playerStats[playerNorm]) {
              playerStats[playerNorm].gol++;
            } else {
              console.warn(`⚠️ [RANKING] Scorer not matched: "${matchKey}" in match ${match.match_id}`);
            }
          }
        }
      }
    }

    // ── 6) Leggi loghi esistenti su Firestore (keep-if-null logic) ───────────
    const teamDocIds = Object.values(teamStats).map(s => makeDocId(sport, s.team_name_norm));

    const existingTeamLogos = {};
    if (writeTeams && teamDocIds.length > 0) {
      const refs = teamDocIds.map(id => db.collection('ranking_teams').doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach(doc => {
        if (doc.exists) {
          existingTeamLogos[doc.id] = doc.data().team_logo || null;
        }
      });
    }

    // ── 7) Scrivi su Firestore ───────────────────────────────────────────────
    const batch = db.batch();
    let writeCount = 0;

    if (writeTeams) {
      for (const [, stats] of Object.entries(teamStats)) {
        const docId        = makeDocId(sport, stats.team_name_norm);
        const ref          = db.collection('ranking_teams').doc(docId);
        const resolvedLogo = stats.team_logo || existingTeamLogos[docId] || null;

        const docData = {
          ranking_id:          docId,
          team_name:           stats.team_name,
          team_name_norm:      stats.team_name_norm,
          sport,
          presenze:            stats.presenze,
          vittorie:            stats.vittorie,
          sconfitte:           stats.sconfitte,
          punti:               stats.punti,
          punti_per_partita:   stats.presenze > 0
            ? Math.round((stats.punti / stats.presenze) * 100) / 100
            : 0,
          pct_vittorie:        pct(stats.vittorie,  stats.presenze),
          pct_sconfitte:       pct(stats.sconfitte, stats.presenze),
          updated_at:          admin.firestore.FieldValue.serverTimestamp(),
          ...(hasDraws && {
            pareggi:     stats.pareggi,
            pct_pareggi: pct(stats.pareggi, stats.presenze),
          }),
          ...(isCalcio && {
            gol:       stats.gol,
            media_gol: stats.presenze > 0
              ? Math.round((stats.gol / stats.presenze) * 100) / 100
              : 0,
          }),
          ...(resolvedLogo !== null && { team_logo: resolvedLogo }),
        };

        batch.set(ref, docData, { merge: true });
        writeCount++;
      }
    }

    for (const [, stats] of Object.entries(playerStats)) {
      const docId = makeDocId(sport, stats.player_name_norm);
      const ref   = db.collection('ranking_players').doc(docId);

      const docData = {
        ranking_id:          docId,
        player_name:         stats.player_name,
        player_name_norm:    stats.player_name_norm,
        sport,
        presenze:            stats.presenze,
        vittorie:            stats.vittorie,
        sconfitte:           stats.sconfitte,
        punti:               stats.punti,
        punti_per_partita:   stats.presenze > 0
          ? Math.round((stats.punti / stats.presenze) * 100) / 100
          : 0,
        pct_vittorie:        pct(stats.vittorie,  stats.presenze),
        pct_sconfitte:       pct(stats.sconfitte, stats.presenze),
        updated_at:          admin.firestore.FieldValue.serverTimestamp(),
        ...(hasDraws && {
          pareggi:     stats.pareggi,
          pct_pareggi: pct(stats.pareggi, stats.presenze),
        }),
        ...(isCalcio && {
          gol:       stats.gol,
          media_gol: stats.presenze > 0
            ? Math.round((stats.gol / stats.presenze) * 100) / 100
            : 0,
        }),
      };

      batch.set(ref, docData, { merge: true });
      writeCount++;
    }

    await batch.commit();
    console.log(`✅ [RANKING] Updated ${writeCount} docs for tournament ${tournamentId} (sport: ${sport})`);

  } catch (error) {
    console.error('❌ [RANKING] updateRanking failed:', error);
    throw error;
  }
}

module.exports = { updateRanking };