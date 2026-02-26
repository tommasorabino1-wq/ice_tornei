const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// HELPER: Check if format has finals
// ===============================
function formatHasFinals(formatType) {
  const formatsWithFinals = ['round_robin_finals', 'double_round_robin_finals'];
  return formatsWithFinals.includes(String(formatType || '').toLowerCase());
}

// ===============================
// MAIN: Aggiorna Status Torneo
// ===============================
async function updateTournamentStatus(tournamentId) {
  try {
    console.log(`📊 Updating status for ${tournamentId}`);

    // 1) Recupera torneo
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const currentStatus = tournament.status;
    const formatType = tournament.format_type;
    const hasFinals = formatHasFinals(formatType);

    console.log(`ℹ️ Current status: ${currentStatus}, format: ${formatType}, hasFinals: ${hasFinals}`);

    // ⚠️ NON modificare se lo status è "open" (gestito manualmente)
    if (currentStatus === 'open') {
      console.log('ℹ️ Status is "open" - no automatic update (manual trigger required)');
      return;
    }

    let newStatus = currentStatus;

    // 2) Recupera matches (gironi)
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = matchesSnapshot.docs.map(doc => doc.data());
    const allMatchesPlayed = matches.length > 0 && matches.every(m => m.played === true);
    const someMatchesPlayed = matches.some(m => m.played === true);

    console.log(`📋 Matches: ${matches.length} total, allPlayed: ${allMatchesPlayed}, somePlayed: ${someMatchesPlayed}`);

    // 3) Recupera finals (se il formato le prevede)
    let finals = [];
    let allFinalsPlayed = false;

    if (hasFinals) {
      const finalsSnapshot = await db.collection('finals')
        .where('tournament_id', '==', tournamentId)
        .get();

      finals = finalsSnapshot.docs.map(doc => doc.data());
      allFinalsPlayed = finals.length > 0 && finals.every(f => f.played === true);

      console.log(`🏆 Finals: ${finals.length} total, allPlayed: ${allFinalsPlayed}`);
    }

    // =====================================================
    // LOGICA TRANSIZIONI STATUS
    // =====================================================

    // CASO 1: Formato CON finals
    if (hasFinals) {
      
      // finished ← tutte le finals giocate
      if (allFinalsPlayed) {
        newStatus = 'finished';
      }
      // final_phase ← tutti i gironi giocati E finals esistono
      else if (allMatchesPlayed && finals.length > 0) {
        newStatus = 'final_phase';
      }
      // live ← almeno un match giocato
      else if (someMatchesPlayed) {
        newStatus = 'live';
      }
      // full ← nessun match giocato (mantieni)
      else if (currentStatus === 'full') {
        newStatus = 'full';
      }
    }
    
    // CASO 2: Formato SENZA finals
    else {
      
      // finished ← tutti i gironi giocati (non ci sono finals)
      if (allMatchesPlayed) {
        newStatus = 'finished';
      }
      // live ← almeno un match giocato
      else if (someMatchesPlayed) {
        newStatus = 'live';
      }
      // full ← nessun match giocato (mantieni)
      else if (currentStatus === 'full') {
        newStatus = 'full';
      }
    }

    // =====================================================
    // AGGIORNA STATUS SE CAMBIATO
    // =====================================================

    if (newStatus !== currentStatus) {
      await tournamentRef.update({ status: newStatus });
      console.log(`✅ Status updated: ${currentStatus} → ${newStatus}`);
    } else {
      console.log(`ℹ️ Status unchanged: ${currentStatus}`);
    }

  } catch (error) {
    console.error('❌ updateTournamentStatus error:', error);
    throw error;
  }
}

module.exports = { updateTournamentStatus };

