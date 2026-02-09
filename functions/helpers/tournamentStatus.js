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
    const teamsMax = Number(tournament.teams_max);

    let newStatus = 'open';

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

    // 4) FINAL_PHASE → gironi finiti
    const matchesSnapshot = await db.collection('matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    if (!matchesSnapshot.empty) {
      const matches = matchesSnapshot.docs.map(doc => doc.data());
      const allMatchesPlayed = matches.every(m => m.played === true);
      const someMatchesPlayed = matches.some(m => m.played === true);

      if (allMatchesPlayed) {
        newStatus = 'final_phase';
      } else if (someMatchesPlayed) {
        newStatus = 'live';
      }
    }

    // 5) FULL → squadre complete
    if (newStatus === 'open') {
      const teamsSnapshot = await db.collection('teams')
        .where('tournament_id', '==', tournamentId)
        .get();

      if (teamsSnapshot.size === teamsMax) {
        newStatus = 'full';
      }
    }

    // 6) Aggiorna status
    await tournamentRef.update({ status: newStatus });
    console.log(`✅ Status updated to: ${newStatus}`);

  } catch (error) {
    console.error('updateTournamentStatus error:', error);
    throw error;
  }
}

module.exports = { updateTournamentStatus };



