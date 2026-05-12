const admin = require('firebase-admin');
const db = admin.firestore();




// ===============================
// HELPERS SAFE (per Firestore)
// ===============================
function toStringSafe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function toNumberSafe(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const n = Number(String(val).trim());
  return isNaN(n) ? fallback : n;
}



// ===============================
// HELPER: Valida input per Round Robin
// ===============================
function validateTeamIds(teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length < 2) {
    throw new Error(`buildRoundRobinPairs: servono almeno 2 squadre, ricevute ${teamIds?.length ?? 0}`);
  }
  const unique = new Set(teamIds);
  if (unique.size !== teamIds.length) {
    const duplicates = teamIds.filter((id, idx) => teamIds.indexOf(id) !== idx);
    throw new Error(`buildRoundRobinPairs: team_id duplicati rilevati: ${duplicates.join(', ')}`);
  }
}




// ===============================
// HELPER: Circle Method (Berger) — N pari
// Genera N-1 round per N squadre.
// Ogni round è un array di [home, away].
// Elemento fisso in posizione 0, gli altri ruotano in senso orario.
// ===============================
function circleMethodEven(teamIds) {
  const n   = teamIds.length; // garantito pari dal chiamante
  const fixed    = teamIds[0];
  let rotating   = teamIds.slice(1); // n-1 elementi che ruotano
  const rounds   = [];

  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rotating];
    const pairs  = [];

    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];

      if (i === 0) {
        // Coppia con il fixed: alterna casa/trasferta ogni round
        pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      } else {
        // Coppie interne: alterna in base a (round + posizione)
        pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
    }

    rounds.push(pairs);

    // Rotazione oraria: l'ultimo elemento entra in testa ai rotanti,
    // tutti gli altri scalano di una posizione verso destra.
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return rounds;
}


// ===============================
// HELPER: Circle Method — N dispari
// Aggiunge un BYE virtuale per rendere N pari,
// genera i round, poi filtra le coppie col BYE.
// Verifica che la distribuzione dei bye sia uniforme (1 per squadra).
// ===============================
function circleMethodOdd(teamIds) {
  const BYE      = '__BYE__';
  const extended = [...teamIds, BYE];
  const rounds   = circleMethodEven(extended);

  // Filtra prima, poi verifica sui round già puliti
  const filteredRounds = rounds.map(pairs =>
    pairs.filter(([a, b]) => a !== BYE && b !== BYE)
  );

  const byeCount = Object.fromEntries(teamIds.map(id => [id, 0]));
  filteredRounds.forEach(pairs => {
    const playing = new Set(pairs.flatMap(([a, b]) => [a, b]));
    teamIds.forEach(id => { if (!playing.has(id)) byeCount[id]++; });
  });

  const uneven = Object.entries(byeCount).filter(([, v]) => v !== 1);
  if (uneven.length > 0) {
    console.error('❌ Distribuzione bye non uniforme:', uneven);
    throw new Error(`circleMethodOdd: distribuzione bye anomala per: ${uneven.map(([id]) => id).join(', ')}`);
  }

  return filteredRounds;
}



// ===============================
// HELPER: Dispatcher Round Robin
// Valida l'input e smista a Even/Odd in base alla parità di N.
// ===============================
function buildRoundRobinPairs(teamIds) {
  validateTeamIds(teamIds);
  return teamIds.length % 2 === 0
    ? circleMethodEven(teamIds)
    : circleMethodOdd(teamIds);
}


// ===============================
// HELPER: Double Round Robin (andata + ritorno)
// Il ritorno inverte home/away rispetto all'andata.
// Aggiunge il campo `leg` (1 = andata, 2 = ritorno) a ogni coppia,
// così Firestore può distinguere le due fasi.
// ===============================
function buildDoubleRoundRobinPairs(teamIds) {
  // validateTeamIds già chiamata dentro buildRoundRobinPairs
  const firstLeg  = buildRoundRobinPairs(teamIds);
  const secondLeg = firstLeg.map(roundPairs =>
    roundPairs.map(([home, away]) => [away, home])
  );

  const taggedFirst  = firstLeg.map(roundPairs  => ({ leg: 1, pairs: roundPairs }));
  const taggedSecond = secondLeg.map(roundPairs => ({ leg: 2, pairs: roundPairs }));

  return [...taggedFirst, ...taggedSecond];
}



// ===============================
// HELPER: Verifica bilanciamento casa/trasferta
// Ritorna { teamId: { home: N, away: N } } per ogni squadra.
// Lancia un warning se una squadra ha uno sbilanciamento > 1.
// ===============================
function checkHomeAwayBalance(allRounds) {
  const balance = {};

  // allRounds può contenere sia array di pairs (single)
  // che oggetti { leg, pairs } (double) → normalizziamo
  const normalizedRounds = allRounds.map(r =>
    Array.isArray(r) ? r : r.pairs
  );

  normalizedRounds.forEach(pairs => {
    pairs.forEach(([home, away]) => {
      if (!balance[home]) balance[home] = { home: 0, away: 0 };
      if (!balance[away]) balance[away] = { home: 0, away: 0 };
      balance[home].home++;
      balance[away].away++;
    });
  });

  // Segnala squadre con sbilanciamento > 1 partita
  Object.entries(balance).forEach(([teamId, b]) => {
    const diff = Math.abs(b.home - b.away);
    if (diff > 1) {
      console.warn(`⚠️ Home/Away sbilanciato per ${teamId}: casa=${b.home}, trasferta=${b.away} (diff=${diff})`);
    }
  });

  return balance;
}



// ===============================
// HELPER: Converte rounds in struttura { roundNumber, leg, matches }
// Gestisce sia il formato single (array di pairs)
// che il formato double ({ leg, pairs }).
// ===============================
function formatRounds(allRounds) {
  return allRounds.map((roundData, idx) => {
    const isTagged = !Array.isArray(roundData); // oggetto { leg, pairs }
    const pairs    = isTagged ? roundData.pairs : roundData;
    const leg      = isTagged ? roundData.leg   : 1;

    return {
      roundNumber: idx + 1,
      leg,                        // 1 = andata, 2 = ritorno (sempre 1 per single)
      matches: pairs.map(([home, away]) => ({ home, away }))
    };
  });
}






// ===============================
// HELPER: Calcola configurazione gironi ottimale
// ===============================
function calculateGroupConfig(totalTeams, preferredTeamsPerGroup) {
  const total = Number(totalTeams);
  if (!Number.isInteger(total) || total < 2) {
    throw new Error(`calculateGroupConfig: totalTeams deve essere un intero >= 2, ricevuto: ${totalTeams}`);
  }

  if (preferredTeamsPerGroup && preferredTeamsPerGroup > 0) {
    if (total % preferredTeamsPerGroup === 0) {
      return {
        teamsPerGroup: preferredTeamsPerGroup,
        numGroups: total / preferredTeamsPerGroup
      };
    }
    console.warn(`⚠️ preferredTeamsPerGroup=${preferredTeamsPerGroup} non divide esattamente ${total} squadre — uso configurazione automatica`);
  }

  const possibleSizes = [4, 3, 6, 5, 8, 2, 10, 12];

  for (const size of possibleSizes) {
    if (total % size === 0 && total >= size) {
      return {
        teamsPerGroup: size,
        numGroups: total / size
      };
    }
  }

  console.warn(`⚠️ Nessuna dimensione standard per ${total} squadre — creato 1 girone unico da ${total}`);
  return {
    teamsPerGroup: total,
    numGroups: 1
  };
}




// ===============================
// HELPER: Normalizza sport
// ===============================
function normalizeSport(sport) {
  const s = String(sport || '').toLowerCase().trim();

  if (s.includes('calcio') || s.includes('football') || s.includes('soccer')) return 'calcio';
  if (s.includes('padel'))                                                      return 'padel';
  if (s.includes('beach volley') || s.includes('beach_volley'))                 return 'beach_volley';
  if (s.includes('scacchi') || s.includes('chess'))                             return 'scacchi';

  console.warn(`⚠️ normalizeSport: sport non riconosciuto "${sport}" — fallback su 'calcio'`);
  return 'calcio';
}


// ===============================
// HELPER: Profilo match (sport + format)
// Riceve sport già normalizzato da normalizeSport().
// ===============================
function getMatchProfile(sport, matchFormat) {
  const s = String(sport || '').toLowerCase().trim();
  const f = String(matchFormat || '').toLowerCase().trim();

  const isSetBased =
    f.includes('su')       ||
    f.includes('set')      ||
    f.includes('best of')  ||
    /\bbo\d+\b/.test(f)    ||
    f.includes('al meglio');

  const isChess    = s.includes('scacchi') || s.includes('chess');
  const hasGames   = s.includes('padel') ||
                     s.includes('beach volley') ||
                     s.includes('beach_volley');
  const hasGoals   = !isChess && !hasGames;
  const hasScorers = !isChess && !hasGames && !isSetBased;

  let normalizedSport = 'calcio';
  if (isChess)                                                         normalizedSport = 'scacchi';
  else if (s.includes('padel'))                                        normalizedSport = 'padel';
  else if (s.includes('beach volley') || s.includes('beach_volley'))  normalizedSport = 'beach_volley';

  if (!['calcio', 'padel', 'beach_volley', 'scacchi'].includes(normalizedSport)) {
    console.warn(`⚠️ getMatchProfile: sport non riconosciuto "${sport}"`);
  }

  return { isSetBased, isChess, hasGames, hasGoals, hasScorers, normalizedSport };
}






// ===============================
// HELPER: Costruisce documento match
// Riceve un oggetto params invece di 11 parametri posizionali.
// ===============================
function buildMatchData({ 
  matchId, tournamentId, groupId, roundNumber, leg,
  teamA, teamB, teamAName, teamBName,
  sport, matchFormat, profile 
}) {
  const base = {
    match_id:      matchId,
    tournament_id: tournamentId,
    group_id:      groupId,
    round_id:      roundNumber,
    leg:           leg ?? 1,        // 1 = andata, 2 = ritorno
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

  // Campi specifici per formato a set
  if (profile.isSetBased) {
    base.sets_detail = null;
  }

  // games_a/games_b: presenti per set-based E per padel/beach a tempo
  // (hasGames è true per padel/beach in entrambi i formati dopo fix Sezione D)
  if (profile.isSetBased || profile.hasGames) {
    base.games_a = null;
    base.games_b = null;
  }

  // Marcatori: solo calcio
  if (profile.hasScorers) {
    base.scorers_a = null;
    base.scorers_b = null;
  }

  return base;
}


// ===============================
// HELPER: Costruisce documento standing iniziale
// ===============================
function buildStandingData({
  standingId, teamId, tournamentId, groupId, teamName,
  sport, matchFormat, profile
}) {
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

  // Pareggi: calcio e scacchi (non set-based e non solo padel/beach)
  // Nota: per sport set-based il pareggio non esiste
  base.draws = 0;

  // Campi calcio
  if (profile.hasGoals) {
    base.goals_for     = 0;
    base.goals_against = 0;
    base.goal_diff     = 0;
  }

  // Campi game: padel e beach volley (entrambi i formati)
  if (profile.hasGames) {
    base.games_for     = 0;
    base.games_against = 0;
    base.game_diff     = 0;
  }

  // Campi set: solo formato a set
  if (profile.isSetBased) {
    base.sets_for     = 0;
    base.sets_against = 0;
    base.set_diff     = 0;

    // Per set-based, i game vanno aggiunti solo se non già presenti
    // (padel/beach a set li ha già da hasGames)
    if (!profile.hasGames) {
      base.games_for     = 0;
      base.games_against = 0;
      base.game_diff     = 0;
    }
  }

  // h2h_points: unico campo H2H, presente per tutti gli sport
  base.h2h_points = 0;

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

    const preferredTeamsPerGroup = toNumberSafe(tournament.teams_per_group, 0);
    const formatType             = toStringSafe(tournament.format_type).toLowerCase();
    const isDouble               = formatType.startsWith('double_');
    const sport                  = normalizeSport(toStringSafe(tournament.sport));
    const matchFormatGironi = toStringSafe(tournament.match_format_gironi);
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

    console.log(`👥 Teams registered: ${subscriptionsSnapshot.size}`);

    if (subscriptionsSnapshot.size < 2) {
      console.log('⚠️ Not enough teams to generate matches (minimum 2)');
      return;
    }

    // 5) Estrai team_id e team_name + shuffle
    // PRIMA del calculateGroupConfig: così la config usa il numero reale di team validi
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

    const totalTeams = teamIds.length; // usa il conteggio reale dopo filtering
    console.log(`👥 Valid teams after filtering: ${totalTeams}`);

    if (totalTeams < 2) {
      console.log('⚠️ Not enough valid teams after filtering (minimum 2)');
      return;
    }

    // 4) Calcola configurazione gironi (con totalTeams reale)
    let groupConfig;
    try {
      groupConfig = calculateGroupConfig(totalTeams, preferredTeamsPerGroup);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      throw err;
    }

    const { teamsPerGroup, numGroups } = groupConfig;
    console.log(`📊 Group config: ${numGroups} groups × ${teamsPerGroup} teams each`);

    // Fisher-Yates shuffle
    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }
    console.log(`🔀 Teams after shuffle: ${teamIds.join(', ')}`);

    // 6) Genera match per ogni gruppo
    // Raccoglie tutte le operazioni, poi le committa in batch da 499
    const allOperations = []; // { ref, data }
    let globalMatchCounter = 1;
    const teamGroupAssignment = {};

    for (let g = 0; g < numGroups; g++) {
      const groupId    = `G${g + 1}`;
      const groupTeams = teamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);

      groupTeams.forEach(teamId => {
        teamGroupAssignment[teamId] = groupId;
      });

      console.log(`🏟️ Group ${groupId}: ${groupTeams.join(', ')}`);

      const allRoundPairs = isDouble
        ? buildDoubleRoundRobinPairs(groupTeams)
        : buildRoundRobinPairs(groupTeams);

      const balance = checkHomeAwayBalance(allRoundPairs);
      console.log(`   ⚖️ Home/Away balance for ${groupId}:`, JSON.stringify(balance));

      const rounds = formatRounds(allRoundPairs);

      rounds.forEach(rObj => {
        rObj.matches.forEach(m => {
          const matchId  = `${tournamentId}_${groupId}_R${String(rObj.roundNumber).padStart(2, '0')}_M${String(globalMatchCounter).padStart(3, '0')}`;
          const matchRef = db.collection('matches').doc(matchId);

          // BUG 1 FIX: chiamata con oggetto + campo leg
          const matchData = buildMatchData({
            matchId,
            tournamentId,
            groupId,
            roundNumber: rObj.roundNumber,
            leg:         rObj.leg,           // ← aggiunto
            teamA:       m.home,
            teamB:       m.away,
            teamAName:   teamNamesMap[m.home] ?? m.home,
            teamBName:   teamNamesMap[m.away] ?? m.away,
            sport,
            matchFormat: matchFormatGironi,
            profile
          });

          allOperations.push({ ref: matchRef, data: matchData });

          console.log(`   ✓ R${rObj.roundNumber} L${rObj.leg} | ${teamNamesMap[m.home] ?? m.home} (H) vs ${teamNamesMap[m.away] ?? m.away} (A)`);
          globalMatchCounter++;
        });
      });
    }

    // 7) Genera standings iniziali
    teamIds.forEach(teamId => {
      const groupId    = teamGroupAssignment[teamId];
      const teamName   = teamNamesMap[teamId] ?? teamId;
      const standingId = `standings_${tournamentId}_${teamId}`;
      const standingRef = db.collection('standings').doc(standingId);

      // BUG 2 FIX: chiamata con oggetto
      const standingData = buildStandingData({
        standingId,
        teamId,
        tournamentId,
        groupId,
        teamName,
        sport,
        matchFormat: matchFormatGironi,
        profile
      });

      allOperations.push({ ref: standingRef, data: standingData });
      console.log(`   ✓ Standing: ${teamName} (${groupId})`);
    });

    // 8) Aggiorna torneo (aggiunta separata: è un update, non un set)
    const tournamentRef = db.collection('tournaments').doc(tournamentId);

    // BUG 5 FIX: commit in batch da 499 operazioni
    // (limite Firestore: 500 operazioni per batch)
    const BATCH_LIMIT = 499;
    let operationCount = 0;
    let currentBatch = db.batch();

    for (const op of allOperations) {
      currentBatch.set(op.ref, op.data);
      operationCount++;

      if (operationCount === BATCH_LIMIT) {
        await currentBatch.commit();
        console.log(`💾 Batch committed (${operationCount} ops)`);
        currentBatch = db.batch();
        operationCount = 0;
      }
    }

    // Aggiunta update torneo nell'ultimo batch
    currentBatch.update(tournamentRef, {
      teams_current:   totalTeams,
      teams_per_group: teamsPerGroup
    });
    operationCount++;

    // Commit del batch finale (o unico se tutto stava in 499)
    await currentBatch.commit();
    console.log(`💾 Final batch committed (${operationCount} ops)`);

    console.log(`✅ [SUCCESS] Generated ${globalMatchCounter - 1} matches and ${teamIds.length} standings`);

  } catch (error) {
    console.error('❌ [ERROR] generateMatchesIfReady failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}



module.exports = { generateMatchesIfReady };