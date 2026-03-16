const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// HELPER: Normalizza stringa per usarla come chiave
// "  Rossoneri FC  " → "rossoneri fc"
// ===============================
function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// ===============================
// HELPER: Genera document ID sicuro per Firestore
// Rimuove caratteri non validi (slash, etc.)
// ===============================
function makeDocId(sport, name) {
  const norm = normalizeKey(name).replace(/[^a-z0-9 _-]/g, '').replace(/\s/g, '_');
  return `${sport}__${norm}`;
}

// ===============================
// HELPER: Determina V/P/S per team_a e team_b da un singolo match
// Restituisce { resultA: 'win'|'draw'|'loss', resultB: 'win'|'draw'|'loss' }
// ===============================
function getMatchResult(match) {
  if (!match.played || match.score_a === null || match.score_b === null) return null;

  // Per le finals: se c'è winner_team_id, è sempre vittoria netta
  // (gestisce rigori, golden set, ecc.)
  if (match.winner_team_id) {
    const winnerIsA = match.winner_team_id === match.team_a;
    return {
      resultA: winnerIsA ? 'win' : 'loss',
      resultB: winnerIsA ? 'loss' : 'win',
    };
  }

  // Gironi standard
  const scoreA = Number(match.score_a);
  const scoreB = Number(match.score_b);
  if (scoreA > scoreB) return { resultA: 'win',  resultB: 'loss' };
  if (scoreA < scoreB) return { resultA: 'loss', resultB: 'win'  };
  return { resultA: 'draw', resultB: 'draw' };
}

// ===============================
// HELPER: Parsa scorers string in array di nomi normalizzati
// "Mario Rossi, Luigi Bianchi" → ["mario rossi", "luigi bianchi"]
// ===============================
function parseScorers(scorersStr) {
  if (!scorersStr || typeof scorersStr !== 'string') return [];
  return scorersStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => normalizeKey(s));
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
// HELPER: Estrae nomi giocatori da documento teams
// Legge name_player_1, name_player_2, ... fino a trovare null
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
    if (i > 20) break; // safety cap
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
    ...(hasDraws  && { pareggi: 0 }),
    ...(isCalcio  && { gol: 0 }),
  };
}

// ===============================
// HELPER: Applica risultato a un'entry stats
// ===============================
function applyResult(stats, result) {
  stats.presenze++;
  if (result === 'win')       stats.vittorie++;
  else if (result === 'draw') stats.pareggi = (stats.pareggi || 0) + 1;
  else                        stats.sconfitte++;
}

// ===============================
// MAIN: Aggiorna ranking per un torneo specifico
// Da chiamare ogni volta che un match (gironi o finals) cambia risultato.
//
// Logica per sport:
//   - calcio, padel, beach_volley → scrive ranking_teams + ranking_players
//   - scacchi                     → scrive SOLO ranking_players
//                                   (team_name = player_name, torneo sempre individual)
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
    const sport    = normalizeSportFromTournament(tournament.sport);
    const isChess  = sport === 'scacchi';
    const isCalcio = sport === 'calcio';
    const hasDraws = isCalcio || isChess;

    // Scacchi: scrivi solo ranking_players, skip ranking_teams
    const writeTeams = !isChess;

    console.log(`📋 [RANKING] Sport: ${sport} | writeTeams: ${writeTeams} | hasDraws: ${hasDraws} | isCalcio: ${isCalcio}`);

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

    // ── 3) Leggi tutti i teams del torneo (per logo + giocatori) ─────────────
    const teamsSnap = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    const teamsMap = {};
    teamsSnap.docs.forEach(d => {
      const data = d.data();
      teamsMap[data.team_id] = data;
    });

    // ── 4) Strutture di aggregazione ─────────────────────────────────────────
    // teamStats[team_name_norm]     → stats squadra  (non usato per scacchi)
    // playerStats[player_name_norm] → stats giocatore (tutti gli sport)
    const teamStats   = {};
    const playerStats = {};

    function ensureTeam(teamId, teamName) {
      const norm = normalizeKey(teamName);
      if (!teamStats[norm]) {
        const teamDoc = teamsMap[teamId] || {};
        teamStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          team_name:      teamName,
          team_name_norm: norm,
          team_logo:      teamDoc.team_logo || null,
        };
      } else if (!teamStats[norm].team_logo && teamsMap[teamId]?.team_logo) {
        // Aggiorna logo se ora disponibile
        teamStats[norm].team_logo = teamsMap[teamId].team_logo;
      }
      return norm;
    }

    function ensurePlayer(playerName, teamId, teamName) {
      const norm = normalizeKey(playerName);
      if (!norm) return null;
      const teamDoc = teamsMap[teamId] || {};
      if (!playerStats[norm]) {
        playerStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          player_name:      playerName,
          player_name_norm: norm,
          team_name:        teamName,
          team_logo:        teamDoc.team_logo || null,
        };
      }
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

      // ── 5a) Ranking teams (skip per scacchi) ───────────────────────────────
      if (writeTeams) {
        const normA = ensureTeam(teamAId, teamAName);
        const normB = ensureTeam(teamBId, teamBName);
        applyResult(teamStats[normA], resultA);
        applyResult(teamStats[normB], resultB);

        if (isCalcio) {
          teamStats[normA].gol += Number(match.score_a) || 0;
          teamStats[normB].gol += Number(match.score_b) || 0;
        }
      }

      // ── 5b) Ranking players ────────────────────────────────────────────────
      if (isChess) {
        // Scacchi: team_name IS il nome del giocatore (torneo individual)
        const normA = ensurePlayer(teamAName, teamAId, teamAName);
        const normB = ensurePlayer(teamBName, teamBId, teamBName);
        if (normA) applyResult(playerStats[normA], resultA);
        if (normB) applyResult(playerStats[normB], resultB);

      } else {
        // Calcio, Padel, Beach Volley: leggi i giocatori dal documento teams
        const teamADoc = teamsMap[teamAId];
        if (teamADoc) {
          for (const playerName of extractPlayers(teamADoc)) {
            const pNorm = ensurePlayer(playerName, teamAId, teamAName);
            if (pNorm) applyResult(playerStats[pNorm], resultA);
          }
        }

        const teamBDoc = teamsMap[teamBId];
        if (teamBDoc) {
          for (const playerName of extractPlayers(teamBDoc)) {
            const pNorm = ensurePlayer(playerName, teamBId, teamBName);
            if (pNorm) applyResult(playerStats[pNorm], resultB);
          }
        }

        // ── 5c) Gol giocatori (solo calcio, da scorers_a/b) ─────────────────
        if (isCalcio) {
          for (const scorerNorm of parseScorers(match.scorers_a)) {
            if (playerStats[scorerNorm]) playerStats[scorerNorm].gol++;
          }
          for (const scorerNorm of parseScorers(match.scorers_b)) {
            if (playerStats[scorerNorm]) playerStats[scorerNorm].gol++;
          }
        }
      }
    }

    // ── 6) Scrivi su Firestore ───────────────────────────────────────────────
    const batch = db.batch();
    let writeCount = 0;

    // ranking_teams (skip per scacchi)
    if (writeTeams) {
      for (const [, stats] of Object.entries(teamStats)) {
        const docId = makeDocId(sport, stats.team_name_norm);
        const ref   = db.collection('ranking_teams').doc(docId);

        const docData = {
          ranking_id:     docId,
          team_name:      stats.team_name,
          team_name_norm: stats.team_name_norm,
          team_logo:      stats.team_logo,
          sport,
          presenze:       stats.presenze,
          vittorie:       stats.vittorie,
          sconfitte:      stats.sconfitte,
          pct_vittorie:   pct(stats.vittorie,  stats.presenze),
          pct_sconfitte:  pct(stats.sconfitte, stats.presenze),
          updated_at:     admin.firestore.FieldValue.serverTimestamp(),
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
    }

    // ranking_players (tutti gli sport, inclusi scacchi)
    for (const [, stats] of Object.entries(playerStats)) {
      const docId = makeDocId(sport, stats.player_name_norm);
      const ref   = db.collection('ranking_players').doc(docId);

      const docData = {
        ranking_id:       docId,
        player_name:      stats.player_name,
        player_name_norm: stats.player_name_norm,
        team_name:        stats.team_name,
        team_logo:        stats.team_logo,
        sport,
        presenze:         stats.presenze,
        vittorie:         stats.vittorie,
        sconfitte:        stats.sconfitte,
        pct_vittorie:     pct(stats.vittorie,  stats.presenze),
        pct_sconfitte:    pct(stats.sconfitte, stats.presenze),
        updated_at:       admin.firestore.FieldValue.serverTimestamp(),
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