const admin = require('firebase-admin');
const db = admin.firestore();

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

    // ⚠️ NON modificare se lo status è "open" o "full" (gestiti manualmente)
    // Questa funzione gestisce solo le transizioni automatiche:
    // full → live → final_phase → finished

    if (currentStatus === 'open') {
      console.log('ℹ️ Status is "open" - no automatic update (manual trigger required)');
      return;
    }

    let newStatus = currentStatus; // Mantieni lo status corrente come default

    // 2) Conta finals
    const finalsSnapshot = await db.collection('finals')
      .where('tournament_id', '==', tournamentId)
      .get();

    // 3) FINISHED → tutte le finals giocate
    if (!finalsSnapshot.empty) {
      const finals = finalsSnapshot.docs.map(doc => doc.data());
      const allFinalsPlayed = finals.every(f => f.played === true);

      if (allFinalsPlayed) {
        newStatus = 'finished';
        await tournamentRef.update({ status: newStatus });
        console.log(`✅ Status updated to: ${newStatus}`);
        return;
      }
    }

    // 4) Controlla matches
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (!matchesSnapshot.empty) {
      const matches = matchesSnapshot.docs.map(doc => doc.data());
      const allMatchesPlayed = matches.every(m => m.played === true);
      const someMatchesPlayed = matches.some(m => m.played === true);

      // FINAL_PHASE → tutti i gironi finiti (e finals esistono)
      if (allMatchesPlayed && !finalsSnapshot.empty) {
        newStatus = 'final_phase';
      }
      // LIVE → almeno un match giocato
      else if (someMatchesPlayed) {
        newStatus = 'live';
      }
      // Se ci sono match ma nessuno giocato, mantieni "full"
      else if (currentStatus === 'full') {
        newStatus = 'full';
      }
    }

    // 5) Aggiorna status solo se cambiato
    if (newStatus !== currentStatus) {
      await tournamentRef.update({ status: newStatus });
      console.log(`✅ Status updated to: ${newStatus}`);
    } else {
      console.log(`ℹ️ Status unchanged: ${currentStatus}`);
    }

  } catch (error) {
    console.error('updateTournamentStatus error:', error);
    throw error;
  }
}

module.exports = { updateTournamentStatus };