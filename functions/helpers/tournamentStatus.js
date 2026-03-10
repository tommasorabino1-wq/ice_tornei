const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// MAIN: Aggiorna Status Torneo
// ✅ MODIFICATO: supporta nuovo status "wip"
// ===============================
async function updateTournamentStatus(tournamentId) {
  try {
    console.log(`📊 Updating status for ${tournamentId}`);

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const currentStatus = tournament.status;

    console.log(`ℹ️ Current status: ${currentStatus}`);

    // ⚠️ NON modificare questi status (gestiti manualmente):
    // - open (apertura iscrizioni)
    // - wip (chiusura iscrizioni + richiesta info)
    // - final_phase (inizio fase finale)
    // - finished (torneo concluso)
    const manualStatuses = ['open', 'wip', 'full', 'final_phase', 'finished'];
    
    if (manualStatuses.includes(currentStatus)) {
      console.log(`ℹ️ Status "${currentStatus}" is manual - no automatic update`);
      return;
    }

    // Recupera matches
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = matchesSnapshot.docs.map(doc => doc.data());
    const someMatchesPlayed = matches.some(m => m.played === true);

    console.log(`📋 Matches: ${matches.length} total, somePlayed: ${someMatchesPlayed}`);

    let newStatus = currentStatus;

    // ✅ Unica transizione automatica: full → live quando almeno un match è giocato
    if (currentStatus === 'full' && someMatchesPlayed) {
      newStatus = 'live';
    }

    // Aggiorna status se cambiato
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