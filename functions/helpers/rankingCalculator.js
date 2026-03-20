const admin = require('firebase-admin');
const db = admin.firestore();

const { FieldValue } = admin.firestore;

// ===============================
// HELPERS SAFE (per Firestore)
// ===============================
function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function toBool(val) {
  if (val === true) return true;
  if (val === false) return false;
  const v = String(val ?? '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function toNumberSafe(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'null') return fallback;
  const n = Number(s);
  return isNaN(n) ? fallback : n;
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
  const norm = normalizeKey(name)
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/\s/g, '_');
  return `${sport}__${norm}`;
}

// ===============================
// HELPER: Genera doc ID contributo torneo
// ===============================
function makeContributionDocId(tournamentId, entityDocId) {
  return `${tournamentId}__${entityDocId}`;
}

// ===============================
// HELPER: Determina V/P/S per team_a e team_b da un singolo match
// ===============================
function getMatchResult(match) {
  if (!toBool(match.played)) return null;

  const scoreA = toNumberSafe(match.score_a);
  const scoreB = toNumberSafe(match.score_b);
  if (scoreA === null || scoreB === null) return null;

  if (match.winner_team_id) {
    const winnerIsA =
      toStringSafe(match.winner_team_id) !== '' &&
      toStringSafe(match.winner_team_id) === toStringSafe(match.team_a);

    return {
      resultA: winnerIsA ? 'win' : 'loss',
      resultB: winnerIsA ? 'loss' : 'win',
    };
  }

  if (scoreA > scoreB) return { resultA: 'win', resultB: 'loss' };
  if (scoreA < scoreB) return { resultA: 'loss', resultB: 'win' };
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
// HELPER: Parsa point_system "3-1-0"
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

  return fallbacks[sport] || fallbacks.calcio;
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
// HELPER: Arrotonda a 2 decimali
// ===============================
function round2(n) {
  return Math.round((Number(n || 0)) * 100) / 100;
}

// ===============================
// HELPER: Entry vuota per statistiche
// ===============================
function emptyStats(hasDraws, isCalcio) {
  return {
    presenze: 0,
    vittorie: 0,
    sconfitte: 0,
    punti: 0,
    ...(hasDraws && { pareggi: 0 }),
    ...(isCalcio && { gol: 0 }),
  };
}

// ===============================
// HELPER: Applica risultato a un'entry stats
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
// HELPER: Elenco campi numerici aggregabili
// ===============================
function getNumericFields(hasDraws, isCalcio) {
  return [
    'presenze',
    'vittorie',
    'sconfitte',
    'punti',
    ...(hasDraws ? ['pareggi'] : []),
    ...(isCalcio ? ['gol'] : []),
  ];
}

// ===============================
// HELPER: Converte stats in payload "contribution"
// ===============================
function serializeContributionBase(stats, hasDraws, isCalcio) {
  return {
    presenze: round2(stats.presenze || 0),
    vittorie: round2(stats.vittorie || 0),
    sconfitte: round2(stats.sconfitte || 0),
    punti: round2(stats.punti || 0),
    ...(hasDraws && { pareggi: round2(stats.pareggi || 0) }),
    ...(isCalcio && { gol: round2(stats.gol || 0) }),
  };
}

// ===============================
// HELPER: Costruisce global doc assoluto
// ===============================
function buildGlobalRankingDoc({
  baseDocId,
  sport,
  displayNameField,
  displayNameValue,
  normField,
  normValue,
  logo,
  totals,
  hasDraws,
  isCalcio,
}) {
  const presenze   = round2(totals.presenze || 0);
  const vittorie   = round2(totals.vittorie || 0);
  const sconfitte  = round2(totals.sconfitte || 0);
  const punti      = round2(totals.punti || 0);
  const pareggi    = round2(totals.pareggi || 0);
  const gol        = round2(totals.gol || 0);

  return {
    ranking_id: baseDocId,
    [displayNameField]: displayNameValue,
    [normField]: normValue,
    sport,
    presenze,
    vittorie,
    sconfitte,
    punti,
    punti_per_partita: presenze > 0 ? round2(punti / presenze) : 0,
    pct_vittorie: pct(vittorie, presenze),
    pct_sconfitte: pct(sconfitte, presenze),
    updated_at: FieldValue.serverTimestamp(),
    ...(hasDraws && {
      pareggi,
      pct_pareggi: pct(pareggi, presenze),
    }),
    ...(isCalcio && {
      gol,
      media_gol: presenze > 0 ? round2(gol / presenze) : 0,
    }),
    ...(logo ? { team_logo: logo } : {}),
  };
}

// ===============================
// HELPER: Estrae totale numerico da ranking/contribution doc
// ===============================
function readNumericTotals(docData, numericFields) {
  const totals = {};
  for (const field of numericFields) {
    totals[field] = round2(toNumberSafe(docData?.[field], 0) || 0);
  }
  return totals;
}

// ===============================
// HELPER: Somma vettoriale oldGlobal - oldContribution + newContribution
// ===============================
function computeUpdatedTotals(globalTotals, oldContributionTotals, newContributionTotals, numericFields) {
  const out = {};
  for (const field of numericFields) {
    const value =
      round2(globalTotals[field] || 0) -
      round2(oldContributionTotals[field] || 0) +
      round2(newContributionTotals[field] || 0);

    out[field] = round2(Math.max(0, value));
  }
  return out;
}

// ===============================
// HELPER: chunk array
// ===============================
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ===============================
// HELPER: batch commit con chunk
// ===============================
async function commitInChunks(ops, chunkSize = 400) {
  const chunks = chunkArray(ops, chunkSize);

  for (const chunk of chunks) {
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, op.options || {});
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
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

    const sport = normalizeSportFromTournament(toStringSafe(tournament.sport));
    const isChess = sport === 'scacchi';
    const isCalcio = sport === 'calcio';
    const hasDraws = isCalcio || isChess;
    const writeTeams = !isChess;

    // supporta sia point_system_gironi che point_system
    const rawPointSystem = toStringSafe(
      tournament.point_system_gironi,
      toStringSafe(tournament.point_system)
    );

    const pointSystem = parsePointSystem(rawPointSystem, sport);

    console.log(
      `📋 [RANKING] Sport: ${sport} | pointSystem: ${JSON.stringify(pointSystem)} | writeTeams: ${writeTeams}`
    );

    // ── 2) Leggi tutti i match del torneo (anche se zero played) ────────────
    const [matchesSnap, finalsSnap] = await Promise.all([
      db.collection('matches').where('tournament_id', '==', tournamentId).get(),
      db.collection('finals').where('tournament_id', '==', tournamentId).get(),
    ]);

    const allMatches = [
      ...matchesSnap.docs.map(d => d.data()),
      ...finalsSnap.docs.map(d => d.data()),
    ].filter(m => toBool(m.played));

    console.log(`📊 [RANKING] Played matches: ${allMatches.length}`);

    // ── 3) Leggi teams del torneo (per logo + giocatori) ────────────────────
    const teamsSnap = await db.collection('teams')
      .where('tournament_id', '==', tournamentId)
      .get();

    const teamsMap = {};
    teamsSnap.docs.forEach(d => {
      const data = d.data();
      teamsMap[data.team_id] = data;
    });

    // ── 4) Ricalcola il SOLO contributo del torneo corrente ──────────────────
    const teamStats = {};
    const playerStats = {};
    const scorerMatchKeyToPlayerNorm = {};

    function ensureTeam(teamId, teamName) {
      const norm = normalizeKey(teamName);
      if (!teamStats[norm]) {
        teamStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          team_name: teamName,
          team_name_norm: norm,
          team_logo: teamsMap[teamId]?.team_logo || null,
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
      const norm = normalizeKey(playerName);
      const matchKey = normalizeForMatch(playerName);
      if (!norm) return null;

      if (!playerStats[norm]) {
        playerStats[norm] = {
          ...emptyStats(hasDraws, isCalcio),
          player_name: playerName,
          player_name_norm: norm,
        };
      }

      scorerMatchKeyToPlayerNorm[matchKey] = norm;
      return norm;
    }

    for (const match of allMatches) {
      const result = getMatchResult(match);
      if (!result) continue;

      const { resultA, resultB } = result;
      const teamAId = toStringSafe(match.team_a);
      const teamBId = toStringSafe(match.team_b);
      const teamAName = toStringSafe(match.team_a_name) || teamAId;
      const teamBName = toStringSafe(match.team_b_name) || teamBId;

      if (!teamAId || !teamBId) continue;

      if (writeTeams) {
        const normA = ensureTeam(teamAId, teamAName);
        const normB = ensureTeam(teamBId, teamBName);

        applyResult(teamStats[normA], resultA, pointSystem);
        applyResult(teamStats[normB], resultB, pointSystem);

        if (isCalcio) {
          teamStats[normA].gol += toNumberSafe(match.score_a, 0) || 0;
          teamStats[normB].gol += toNumberSafe(match.score_b, 0) || 0;
        }
      }

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

    // ── 5) Costruisci nuove contribution map ────────────────────────────────
    const newTeamContributions = {};
    if (writeTeams) {
      for (const [, stats] of Object.entries(teamStats)) {
        const entityDocId = makeDocId(sport, stats.team_name_norm);
        const contributionDocId = makeContributionDocId(tournamentId, entityDocId);

        newTeamContributions[contributionDocId] = {
          contribution_id: contributionDocId,
          tournament_id: tournamentId,
          entity_doc_id: entityDocId,
          sport,
          team_name: stats.team_name,
          team_name_norm: stats.team_name_norm,
          team_logo: stats.team_logo || null,
          ...serializeContributionBase(stats, hasDraws, isCalcio),
          updated_at: FieldValue.serverTimestamp(),
        };
      }
    }

    const newPlayerContributions = {};
    for (const [, stats] of Object.entries(playerStats)) {
      const entityDocId = makeDocId(sport, stats.player_name_norm);
      const contributionDocId = makeContributionDocId(tournamentId, entityDocId);

      newPlayerContributions[contributionDocId] = {
        contribution_id: contributionDocId,
        tournament_id: tournamentId,
        entity_doc_id: entityDocId,
        sport,
        player_name: stats.player_name,
        player_name_norm: stats.player_name_norm,
        ...serializeContributionBase(stats, hasDraws, isCalcio),
        updated_at: FieldValue.serverTimestamp(),
      };
    }

    // ── 6) Leggi contribution docs precedenti di questo torneo ───────────────
    const [oldTeamContribSnap, oldPlayerContribSnap] = await Promise.all([
      writeTeams
        ? db.collection('ranking_team_contributions')
            .where('tournament_id', '==', tournamentId)
            .get()
        : Promise.resolve({ docs: [] }),
      db.collection('ranking_player_contributions')
        .where('tournament_id', '==', tournamentId)
        .get(),
    ]);

    const oldTeamContributions = {};
    oldTeamContribSnap.docs.forEach(doc => {
      oldTeamContributions[doc.id] = doc.data();
    });

    const oldPlayerContributions = {};
    oldPlayerContribSnap.docs.forEach(doc => {
      oldPlayerContributions[doc.id] = doc.data();
    });

    // ── 7) Determina entità toccate ──────────────────────────────────────────
    const affectedTeamEntityIds = new Set();
    if (writeTeams) {
      for (const doc of Object.values(oldTeamContributions)) {
        affectedTeamEntityIds.add(toStringSafe(doc.entity_doc_id));
      }
      for (const doc of Object.values(newTeamContributions)) {
        affectedTeamEntityIds.add(toStringSafe(doc.entity_doc_id));
      }
    }

    const affectedPlayerEntityIds = new Set();
    for (const doc of Object.values(oldPlayerContributions)) {
      affectedPlayerEntityIds.add(toStringSafe(doc.entity_doc_id));
    }
    for (const doc of Object.values(newPlayerContributions)) {
      affectedPlayerEntityIds.add(toStringSafe(doc.entity_doc_id));
    }

    // ── 8) Leggi ranking globali attuali delle entità toccate ────────────────
    async function getDocsMap(collectionName, ids) {
      const out = {};
      if (!ids.length) return out;

      const refs = ids.map(id => db.collection(collectionName).doc(id));
      const docs = await db.getAll(...refs);

      docs.forEach(doc => {
        out[doc.id] = doc.exists ? doc.data() : null;
      });

      return out;
    }

    const [currentGlobalTeamsMap, currentGlobalPlayersMap] = await Promise.all([
      writeTeams
        ? getDocsMap('ranking_teams', [...affectedTeamEntityIds])
        : Promise.resolve({}),
      getDocsMap('ranking_players', [...affectedPlayerEntityIds]),
    ]);

    // ── 9) Prepara operazioni batch ──────────────────────────────────────────
    const ops = [];
    const numericFields = getNumericFields(hasDraws, isCalcio);

    // ===== TEAMS =====
    if (writeTeams) {
      for (const entityDocId of affectedTeamEntityIds) {
        const currentGlobal = currentGlobalTeamsMap[entityDocId] || null;

        const oldContrib = Object.values(oldTeamContributions).find(
          d => toStringSafe(d.entity_doc_id) === entityDocId
        ) || null;

        const newContrib = Object.values(newTeamContributions).find(
          d => toStringSafe(d.entity_doc_id) === entityDocId
        ) || null;

        const globalTotals = readNumericTotals(currentGlobal, numericFields);
        const oldTotals = readNumericTotals(oldContrib, numericFields);
        const newTotals = readNumericTotals(newContrib, numericFields);

        const finalTotals = computeUpdatedTotals(
          globalTotals,
          oldTotals,
          newTotals,
          numericFields
        );

        const allZero = numericFields.every(f => round2(finalTotals[f] || 0) === 0);

        const fallbackTeamName =
          toStringSafe(newContrib?.team_name) ||
          toStringSafe(oldContrib?.team_name) ||
          toStringSafe(currentGlobal?.team_name);

        const fallbackTeamNameNorm =
          toStringSafe(newContrib?.team_name_norm) ||
          toStringSafe(oldContrib?.team_name_norm) ||
          toStringSafe(currentGlobal?.team_name_norm);

        const resolvedLogo =
          toStringSafe(newContrib?.team_logo) ||
          toStringSafe(currentGlobal?.team_logo) ||
          toStringSafe(oldContrib?.team_logo) ||
          null;

        const ref = db.collection('ranking_teams').doc(entityDocId);

        if (allZero) {
          ops.push({ type: 'delete', ref });
        } else {
          const docData = buildGlobalRankingDoc({
            baseDocId: entityDocId,
            sport,
            displayNameField: 'team_name',
            displayNameValue: fallbackTeamName,
            normField: 'team_name_norm',
            normValue: fallbackTeamNameNorm,
            logo: resolvedLogo,
            totals: finalTotals,
            hasDraws,
            isCalcio,
          });

          ops.push({
            type: 'set',
            ref,
            data: docData,
            options: { merge: true },
          });
        }
      }

      // write / delete contribution docs
      const oldIds = new Set(Object.keys(oldTeamContributions));
      const newIds = new Set(Object.keys(newTeamContributions));

      for (const [docId, data] of Object.entries(newTeamContributions)) {
        ops.push({
          type: 'set',
          ref: db.collection('ranking_team_contributions').doc(docId),
          data,
          options: { merge: true },
        });
      }

      for (const oldId of oldIds) {
        if (!newIds.has(oldId)) {
          ops.push({
            type: 'delete',
            ref: db.collection('ranking_team_contributions').doc(oldId),
          });
        }
      }
    }

    // ===== PLAYERS =====
    for (const entityDocId of affectedPlayerEntityIds) {
      const currentGlobal = currentGlobalPlayersMap[entityDocId] || null;

      const oldContrib = Object.values(oldPlayerContributions).find(
        d => toStringSafe(d.entity_doc_id) === entityDocId
      ) || null;

      const newContrib = Object.values(newPlayerContributions).find(
        d => toStringSafe(d.entity_doc_id) === entityDocId
      ) || null;

      const globalTotals = readNumericTotals(currentGlobal, numericFields);
      const oldTotals = readNumericTotals(oldContrib, numericFields);
      const newTotals = readNumericTotals(newContrib, numericFields);

      const finalTotals = computeUpdatedTotals(
        globalTotals,
        oldTotals,
        newTotals,
        numericFields
      );

      const allZero = numericFields.every(f => round2(finalTotals[f] || 0) === 0);

      const fallbackPlayerName =
        toStringSafe(newContrib?.player_name) ||
        toStringSafe(oldContrib?.player_name) ||
        toStringSafe(currentGlobal?.player_name);

      const fallbackPlayerNameNorm =
        toStringSafe(newContrib?.player_name_norm) ||
        toStringSafe(oldContrib?.player_name_norm) ||
        toStringSafe(currentGlobal?.player_name_norm);

      const ref = db.collection('ranking_players').doc(entityDocId);

      if (allZero) {
        ops.push({ type: 'delete', ref });
      } else {
        const docData = buildGlobalRankingDoc({
          baseDocId: entityDocId,
          sport,
          displayNameField: 'player_name',
          displayNameValue: fallbackPlayerName,
          normField: 'player_name_norm',
          normValue: fallbackPlayerNameNorm,
          logo: null,
          totals: finalTotals,
          hasDraws,
          isCalcio,
        });

        ops.push({
          type: 'set',
          ref,
          data: docData,
          options: { merge: true },
        });
      }
    }

    // write / delete player contribution docs
    {
      const oldIds = new Set(Object.keys(oldPlayerContributions));
      const newIds = new Set(Object.keys(newPlayerContributions));

      for (const [docId, data] of Object.entries(newPlayerContributions)) {
        ops.push({
          type: 'set',
          ref: db.collection('ranking_player_contributions').doc(docId),
          data,
          options: { merge: true },
        });
      }

      for (const oldId of oldIds) {
        if (!newIds.has(oldId)) {
          ops.push({
            type: 'delete',
            ref: db.collection('ranking_player_contributions').doc(oldId),
          });
        }
      }
    }

    // ── 10) Commit ───────────────────────────────────────────────────────────
    await commitInChunks(ops, 350);

    console.log(
      `✅ [RANKING] Updated rankings incrementally for tournament ${tournamentId} (sport: ${sport}) | ops: ${ops.length}`
    );

  } catch (error) {
    console.error('❌ [RANKING] updateRanking failed:', error);
    throw error;
  }
}

module.exports = { updateRanking };