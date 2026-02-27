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

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      console.log('⚠️ Tournament not found');
      return;
    }

    const tournament = tournamentDoc.data();
    const currentStatus = tournament.status;
    const formatType = tournament.format_type;

    console.log(`ℹ️ Current status: ${currentStatus}, format: ${formatType}`);

    // ⚠️ NON modificare se lo status è "open" (gestito manualmente)
    if (currentStatus === 'open') {
      console.log('ℹ️ Status is "open" - no automatic update (manual trigger required)');
      return;
    }

    // ⚠️ NON modificare mai automaticamente verso final_phase o finished.
    // Queste transizioni sono sempre manuali.
    // L'unica transizione automatica permessa è: full/live → live (quando iniziano i match).
    if (currentStatus === 'final_phase' || currentStatus === 'finished') {
      console.log(`ℹ️ Status is "${currentStatus}" - no automatic update allowed from this state`);
      return;
    }

    // 2) Recupera matches (gironi)
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = matchesSnapshot.docs.map(doc => doc.data());
    const someMatchesPlayed = matches.some(m => m.played === true);

    console.log(`📋 Matches: ${matches.length} total, somePlayed: ${someMatchesPlayed}`);

    let newStatus = currentStatus;

    // Unica transizione automatica: full → live quando almeno un match è giocato
    if (currentStatus === 'full' && someMatchesPlayed) {
      newStatus = 'live';
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