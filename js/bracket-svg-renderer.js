// ===============================
// SVG BRACKET RENDERER v2
// Layout simmetrico a specchio — sinistra/destra convergono al centro
// Finale 1°/2° al centro con palette oro, 3°/4° sotto centrato
// ===============================

// ── Layout constants ──────────────────────────────────────────────
const MATCH_W         = 240;   // larghezza card squadra
const MATCH_H         = 48;    // altezza singola riga
const MATCH_GAP       = 3;     // separatore tra riga A e B
const ROUND_GAP       = 56;    // gap orizzontale tra colonne
const COL_W           = MATCH_W + ROUND_GAP;
const LABEL_H         = 30;    // altezza pill label
const LABEL_MB        = 16;    // margine sotto label
const TOP_PAD         = 16;
const BOT_PAD         = 36;
const CHAMP_GAP       = 20;
const CHAMP_H         = 46;
const THIRD_GAP_V     = 52;    // distanza verticale tra champion box e label 3/4
const THIRD_LABEL_GAP = 14;

function matchH() { return MATCH_H * 2 + MATCH_GAP; }

// ── Palette ───────────────────────────────────────────────────────
const C = {
  cardBg:             'rgba(20,27,38,0.97)',
  cardBgAlt:          'rgba(13,18,28,0.99)',
  cardBorder:         'rgba(255,255,255,0.08)',
  cardBorderTbd:      'rgba(255,255,255,0.06)',
  text:               '#d1d5db',
  textWin:            '#ffffff',
  textTbd:            '#6b7280',
  textScore:          'rgba(255,255,255,0.22)',
  // Oro — finale 1/2
  goldAccent:         '#fbbf24',
  goldBar:            '#f59e0b',
  goldBg:             'rgba(251,191,36,0.09)',
  goldBorder:         'rgba(251,191,36,0.50)',
  goldChampBg:        'rgba(251,191,36,0.13)',
  goldChampBorder:    'rgba(251,191,36,0.55)',
  goldLabel:          'rgba(251,191,36,0.75)',
  goldLabelBg:        'rgba(251,191,36,0.07)',
  goldLabelBorder:    'rgba(251,191,36,0.20)',
  // Azzurro — round normali
  blueAccent:         '#38bdf8',
  blueBar:            '#0ea5e9',
  blueBg:             'rgba(56,189,248,0.07)',
  blueBorder:         'rgba(56,189,248,0.40)',
  blueLabel:          'rgba(56,189,248,0.65)',
  blueLabelBg:        'rgba(56,189,248,0.06)',
  blueLabelBorder:    'rgba(56,189,248,0.15)',
  blueConn:           'rgba(56,189,248,0.22)',
  // Bronzo — 3/4
  bronzeAccent:       'rgba(205,127,50,0.88)',
  bronzeBar:          'rgba(205,127,50,0.92)',
  bronzeBg:           'rgba(205,127,50,0.07)',
  bronzeBorder:       'rgba(205,127,50,0.40)',
  bronzeLabel:        'rgba(205,127,50,0.78)',
  bronzeLabelBg:      'rgba(205,127,50,0.06)',
  bronzeLabelBorder:  'rgba(205,127,50,0.20)',
  bronzeConn:         'rgba(205,127,50,0.18)',
  bronzeChampBg:      'rgba(205,127,50,0.11)',
  bronzeChampBorder:  'rgba(205,127,50,0.48)',
};

// ── SVG helpers ───────────────────────────────────────────────────
function svgEl(tag, attrs, children = '') {
  const a = Object.entries(attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
  return `<${tag} ${a}>${children}</${tag}>`;
}
function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatTeamSvg(id) {
  return String(id || '').split('_').slice(1).join(' ');
}
function resolveWinner(match) {
  const played = match.played === true || String(match.played||'').toUpperCase() === 'TRUE';
  if (!played) return null;
  if (match.winner_team_id) return match.winner_team_id;
  const na = Number(match.score_a), nb = Number(match.score_b);
  if (na > nb) return match.team_a;
  if (nb > na) return match.team_b;
  return null;
}
function roundLabel(count) {
  if (count >= 8) return 'Quarti di Finale';
  if (count === 4) return 'Quarti';
  if (count === 2) return 'Semifinali';
  if (count === 1) return 'Finale';
  return 'Round';
}

// ── Disegna una card match ────────────────────────────────────────
// palette: 'blue' | 'gold' | 'bronze'
// flip: true → barra e allineamento testo specchiati (lato sx del bracket)
function drawMatch(x, y, match, palette, flip) {
  const mh     = matchH();
  const played = match.played === true || String(match.played||'').toUpperCase() === 'TRUE';
  const winner = resolveWinner(match);
  const teamA  = match.team_a_name || (match.team_a ? formatTeamSvg(match.team_a) : null);
  const teamB  = match.team_b_name || (match.team_b ? formatTeamSvg(match.team_b) : null);
  const aTbd   = !match.team_a;
  const bTbd   = !match.team_b;
  const aWin   = winner === match.team_a;
  const bWin   = winner === match.team_b;
  const sA     = played && match.score_a !== null && match.score_a !== '' ? String(match.score_a) : '−';
  const sB     = played && match.score_b !== null && match.score_b !== '' ? String(match.score_b) : '−';

  const accent = palette==='gold' ? C.goldAccent : palette==='bronze' ? C.bronzeAccent : C.blueAccent;
  const bar    = palette==='gold' ? C.goldBar    : palette==='bronze' ? C.bronzeBar    : C.blueBar;
  const winBg  = palette==='gold' ? C.goldBg     : palette==='bronze' ? C.bronzeBg     : C.blueBg;
  const winBrd = palette==='gold' ? C.goldBorder : palette==='bronze' ? C.bronzeBorder : C.blueBorder;
  const barW   = 4;

  let o = '';

  const drawRow = (rowY, name, score, isTbd, isWin, isAlt) => {
    const bg   = isWin ? winBg : (isTbd ? 'rgba(255,255,255,0.015)' : (isAlt ? C.cardBgAlt : C.cardBg));
    const brd  = isWin ? winBrd : (isTbd ? C.cardBorderTbd : C.cardBorder);
    const dash = isTbd ? {'stroke-dasharray':'4 4'} : {};
    const nC   = isWin ? C.textWin : (isTbd ? C.textTbd : C.text);
    const sC   = isWin ? accent : (isTbd ? C.textTbd : C.textScore);
    const fw   = isWin ? '700' : (isTbd ? '400' : '500');
    const fi   = isTbd ? 'italic' : 'normal';
    const fs   = isTbd ? 15 : 17;

    // flip=true: nome a destra, score a sinistra (per lato sinistro del bracket)
    const nameX    = flip ? x + MATCH_W - (isWin ? 14 : 12) : x + (isWin ? 14 : 12);
    const scoreX   = flip ? x + 14 : x + MATCH_W - 14;
    const nameAnchor  = flip ? 'end' : 'start';
    const scoreAnchor = flip ? 'start' : 'end';

    let r = '';
    r += svgEl('rect', { x, y:rowY, width:MATCH_W, height:MATCH_H, rx:7, ry:7, fill:bg, stroke:brd, 'stroke-width':1, ...dash });
    if (isWin) {
      const barX = flip ? x + MATCH_W - barW : x;
      r += svgEl('rect', { x:barX, y:rowY, width:barW, height:MATCH_H, rx:2, fill:bar });
    }
    const clipId = `c${Math.round(x*10)}-${Math.round(rowY*10)}`;
    const clipXs = flip ? x + 38 : x + 8;
    const clipW  = MATCH_W - 52;
    r += `<defs><clipPath id="${clipId}"><rect x="${clipXs}" y="${rowY}" width="${clipW}" height="${MATCH_H}"/></clipPath></defs>`;
    r += svgEl('text', { x:nameX, y:rowY+MATCH_H/2+6, fill:nC, 'font-size':fs, 'font-weight':fw, 'font-style':fi, 'font-family':'Inter,sans-serif', 'text-anchor':nameAnchor, 'clip-path':`url(#${clipId})` }, isTbd ? 'TBD' : escH(name||''));
    r += svgEl('text', { x:scoreX, y:rowY+MATCH_H/2+6, fill:sC, 'font-size':18, 'font-weight':isWin?'800':'500', 'font-family':'Inter,sans-serif', 'text-anchor':scoreAnchor }, escH(score));
    return r;
  };

  const yA = y, yB = y + MATCH_H + MATCH_GAP;
  o += drawRow(yA, teamA, sA, aTbd, aWin, false);
  o += svgEl('rect', { x, y:yA+MATCH_H, width:MATCH_W, height:MATCH_GAP, fill:'rgba(0,0,0,0.55)' });
  o += drawRow(yB, teamB, sB, bTbd, bWin, true);
  o += svgEl('rect', { x, y:yA, width:MATCH_W, height:mh, rx:7, ry:7, fill:'none', stroke: aWin||bWin ? winBrd : C.cardBorder, 'stroke-width':1, 'pointer-events':'none' });
  return o;
}

// ── Pill label ────────────────────────────────────────────────────
function drawLabel(x, y, text, palette) {
  const lc = palette==='gold' ? C.goldLabel : palette==='bronze' ? C.bronzeLabel : C.blueLabel;
  const lb = palette==='gold' ? C.goldLabelBg : palette==='bronze' ? C.bronzeLabelBg : C.blueLabelBg;
  const lbr= palette==='gold' ? C.goldLabelBorder : palette==='bronze' ? C.bronzeLabelBorder : C.blueLabelBorder;
  let o = '';
  o += svgEl('rect', { x, y, width:MATCH_W, height:LABEL_H, rx:LABEL_H/2, ry:LABEL_H/2, fill:lb, stroke:lbr, 'stroke-width':1 });
  o += svgEl('text', { x:x+MATCH_W/2, y:y+LABEL_H/2+5, fill:lc, 'font-size':11, 'font-weight':'800', 'font-family':'Inter,sans-serif', 'text-anchor':'middle', 'letter-spacing':'0.1em' }, escH(text.toUpperCase()));
  return o;
}

// ── Connettore a L ────────────────────────────────────────────────
// dir='right': esce dal lato destro di src, arriva al lato sinistro di dst
// dir='left':  esce dal lato sinistro di src, arriva al lato destro di dst
function drawConn(srcX, srcY, dstX, dstY, color, dir) {
  const mh = matchH();
  const sm = srcY + mh / 2;
  const dm = dstY + mh / 2;
  let x1, x2, x3;
  if (dir === 'right') {
    x1 = srcX + MATCH_W; x2 = x1 + ROUND_GAP / 2; x3 = dstX;
  } else {
    x1 = srcX; x2 = x1 - ROUND_GAP / 2; x3 = dstX + MATCH_W;
  }
  return svgEl('path', { d:`M ${x1} ${sm} H ${x2} V ${dm} H ${x3}`, fill:'none', stroke:color, 'stroke-width':1.5, 'stroke-linecap':'round', 'stroke-linejoin':'round' });
}

// ── Calcola posizioni Y per un lato ──────────────────────────────
function computeSidePositions(roundIds, matchesByRound) {
  const mh = matchH();
  const BASE = mh + 28;
  const firstCount = matchesByRound[roundIds[0]].length;
  const totalH = firstCount * BASE - (BASE - mh);
  const pos = {};
  roundIds.forEach((rid, ri) => {
    const count = matchesByRound[rid].length;
    pos[rid] = [];
    if (count === 1) {
      pos[rid][0] = totalH / 2 - mh / 2;
    } else {
      const spacing = Math.pow(2, ri) * BASE;
      const used    = count * spacing - (spacing - mh);
      const startY  = (totalH - used) / 2;
      for (let i = 0; i < count; i++) pos[rid][i] = startY + i * spacing;
    }
  });
  return { pos, totalH };
}

// ── MAIN ─────────────────────────────────────────────────────────
function renderBracketSVG(bracket, container) {
  container.innerHTML = '';
  const allRoundIds = Object.keys(bracket.rounds).map(Number).sort((a,b)=>a-b);
  if (allRoundIds.length === 0) {
    container.innerHTML = "<p class='placeholder'>Nessun match disponibile</p>";
    return;
  }

  const allMatches = bracket.rounds;
  const mh         = matchH();
  const hasThird   = !!bracket.thirdPlaceMatch;
  const numRounds  = allRoundIds.length;
  const finalRound = allRoundIds[numRounds - 1];
  const sideRounds = allRoundIds.slice(0, numRounds - 1);

  // Se non ci sono round laterali (solo finale) → layout lineare
  if (sideRounds.length === 0) {
    return renderLinearSVG(bracket, container);
  }

  // ── Dividi match di ogni round laterale in sx e dx ───────────────
  const leftMs  = {}, rightMs = {};
  sideRounds.forEach(rid => {
    const ms   = allMatches[rid];
    const half = Math.ceil(ms.length / 2);
    leftMs[rid]  = ms.slice(0, half);
    rightMs[rid] = ms.slice(half);
  });

  const { pos: leftPos, totalH } = computeSidePositions(sideRounds, leftMs);

  // ── Indici colonne ────────────────────────────────────────────────
  // Colonne da sinistra: 0…(n-1) = round laterali sx (0=più esterno)
  // Colonna n = finale (centro)
  // Colonne n+1…2n = round laterali dx (specchio, n+1=più interno)
  const n          = sideRounds.length;
  const finalColI  = n;
  const totalCols  = n * 2 + 1;
  const colX       = ci => ci * COL_W;

  const LOFF = TOP_PAD + LABEL_H + LABEL_MB; // offset verticale per i match
  const finalMatchY = LOFF + totalH / 2 - mh / 2;
  const champY      = finalMatchY + mh + CHAMP_GAP;
  const champBot    = champY + CHAMP_H + 16;

  let thirdLabelY = 0, thirdMatchY = 0, thirdChampY = 0;
  if (hasThird) {
    thirdLabelY = champBot + THIRD_GAP_V;
    thirdMatchY = thirdLabelY + LABEL_H + THIRD_LABEL_GAP;
    thirdChampY = thirdMatchY + mh + CHAMP_GAP;
  }

  const svgW = totalCols * COL_W + 40;
  const svgH = hasThird ? thirdChampY + CHAMP_H + BOT_PAD : champBot + BOT_PAD;

  let body = '';

  // ── CONNETTORI ───────────────────────────────────────────────────
  sideRounds.forEach((rid, ri) => {
    const isInner = ri === n - 1;
    // Lato sinistro
    leftMs[rid].forEach((_, mi) => {
      const srcX = colX(ri);
      const srcY = LOFF + leftPos[rid][mi];
      if (isInner) {
        body += drawConn(srcX, srcY, colX(finalColI), finalMatchY, C.blueConn, 'right');
      } else {
        const nextRid = sideRounds[ri + 1];
        const dstY    = LOFF + leftPos[nextRid][Math.floor(mi / 2)];
        body += drawConn(srcX, srcY, colX(ri + 1), dstY, C.blueConn, 'right');
      }
    });
    // Lato destro (colonna specchio)
    const dxColI = finalColI + (n - ri);
    rightMs[rid].forEach((_, mi) => {
      const srcX = colX(dxColI);
      const srcY = LOFF + leftPos[rid][mi]; // stesse posizioni Y del lato sx
      if (isInner) {
        body += drawConn(srcX, srcY, colX(finalColI), finalMatchY, C.blueConn, 'left');
      } else {
        const nextRid  = sideRounds[ri + 1];
        const nextColI = finalColI + (n - ri - 1);
        const dstY     = LOFF + leftPos[nextRid][Math.floor(mi / 2)];
        body += drawConn(srcX, srcY, colX(nextColI), dstY, C.blueConn, 'left');
      }
    });
  });

  // Connettore bronzo tratteggiato: dalle semifinali verso il 3/4
  if (hasThird && n >= 1) {
    const innerRid = sideRounds[n - 1];
    const thirdX   = colX(finalColI);
    const thirdCX  = thirdX + MATCH_W / 2;

    [
      { ms: leftMs[innerRid],  colI: n - 1,          dir: 'right' },
      { ms: rightMs[innerRid], colI: finalColI + 1,   dir: 'left'  },
    ].forEach(({ ms, colI, dir }) => {
      if (!ms.length) return;
      const srcX   = dir === 'right' ? colX(colI) + MATCH_W : colX(colI);
      const srcMidY= LOFF + leftPos[innerRid][0] + mh / 2;
      const midX   = dir === 'right' ? srcX + 20 : srcX - 20;
      const d = `M ${srcX} ${srcMidY} H ${midX} V ${thirdMatchY - 12} H ${thirdCX} V ${thirdMatchY}`;
      body += svgEl('path', { d, fill:'none', stroke:C.bronzeConn, 'stroke-width':1.5, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'stroke-dasharray':'5 4' });
    });
  }

  // ── LABEL ────────────────────────────────────────────────────────
  sideRounds.forEach((rid, ri) => {
    const count = allMatches[rid].length;
    body += drawLabel(colX(ri),                    TOP_PAD, roundLabel(count), 'blue');
    body += drawLabel(colX(finalColI + (n - ri)),  TOP_PAD, roundLabel(count), 'blue');
  });
  body += drawLabel(colX(finalColI), TOP_PAD, 'Finale', 'gold');

  // ── CARD MATCH ───────────────────────────────────────────────────
  sideRounds.forEach((rid, ri) => {
    const dxColI = finalColI + (n - ri);
    leftMs[rid].forEach((m, mi) => {
      body += drawMatch(colX(ri),      LOFF + leftPos[rid][mi], m, 'blue', true);  // sx: flip
    });
    rightMs[rid].forEach((m, mi) => {
      body += drawMatch(colX(dxColI),  LOFF + leftPos[rid][mi], m, 'blue', false); // dx: no flip
    });
  });

  // Finale
  const finalMatch = allMatches[finalRound][0];
  body += drawMatch(colX(finalColI), finalMatchY, finalMatch, 'gold', false);

  // ── CHAMPION BOX ─────────────────────────────────────────────────
  const cx = colX(finalColI);
  if (finalMatch?.winner_team_id) {
    const cn = finalMatch.winner_team_id === finalMatch.team_a
      ? (finalMatch.team_a_name || formatTeamSvg(finalMatch.team_a))
      : (finalMatch.team_b_name || formatTeamSvg(finalMatch.team_b));
    body += svgEl('rect', { x:cx, y:champY, width:MATCH_W, height:CHAMP_H, rx:CHAMP_H/2, ry:CHAMP_H/2, fill:C.goldChampBg, stroke:C.goldChampBorder, 'stroke-width':1.5 });
    body += svgEl('text', { x:cx+MATCH_W/2, y:champY+CHAMP_H/2+6, fill:C.goldAccent, 'font-size':15, 'font-weight':'700', 'font-family':'Inter,sans-serif', 'text-anchor':'middle', 'letter-spacing':'0.03em' }, `🏆 ${escH(cn)}`);
  } else {
    body += svgEl('rect', { x:cx, y:champY, width:MATCH_W, height:CHAMP_H, rx:CHAMP_H/2, ry:CHAMP_H/2, fill:'rgba(251,191,36,0.03)', stroke:'rgba(251,191,36,0.15)', 'stroke-width':1, 'stroke-dasharray':'5 4' });
    body += svgEl('text', { x:cx+MATCH_W/2, y:champY+CHAMP_H/2+6, fill:'rgba(251,191,36,0.28)', 'font-size':13, 'font-weight':'600', 'font-family':'Inter,sans-serif', 'text-anchor':'middle' }, '🏆 Campione');
  }

  // ── 3°/4° POSTO ──────────────────────────────────────────────────
  if (hasThird) {
    const tx = colX(finalColI);
    const tm = bracket.thirdPlaceMatch;
    body += drawLabel(tx, thirdLabelY, '3° / 4° Posto', 'bronze');
    body += drawMatch(tx, thirdMatchY, tm, 'bronze', false);
    if (tm.winner_team_id) {
      const tn = tm.winner_team_id === tm.team_a
        ? (tm.team_a_name || formatTeamSvg(tm.team_a))
        : (tm.team_b_name || formatTeamSvg(tm.team_b));
      body += svgEl('rect', { x:tx, y:thirdChampY, width:MATCH_W, height:CHAMP_H, rx:CHAMP_H/2, ry:CHAMP_H/2, fill:C.bronzeChampBg, stroke:C.bronzeChampBorder, 'stroke-width':1.5 });
      body += svgEl('text', { x:tx+MATCH_W/2, y:thirdChampY+CHAMP_H/2+6, fill:C.bronzeAccent, 'font-size':15, 'font-weight':'700', 'font-family':'Inter,sans-serif', 'text-anchor':'middle' }, `🥉 ${escH(tn)}`);
    } else {
      body += svgEl('rect', { x:tx, y:thirdChampY, width:MATCH_W, height:CHAMP_H, rx:CHAMP_H/2, ry:CHAMP_H/2, fill:'rgba(205,127,50,0.03)', stroke:'rgba(205,127,50,0.15)', 'stroke-width':1, 'stroke-dasharray':'5 4' });
      body += svgEl('text', { x:tx+MATCH_W/2, y:thirdChampY+CHAMP_H/2+6, fill:'rgba(205,127,50,0.28)', 'font-size':13, 'font-weight':'600', 'font-family':'Inter,sans-serif', 'text-anchor':'middle' }, '🥉 3° Posto');
    }
  }

  // ── Assembla ─────────────────────────────────────────────────────
  const realH = hasThird ? thirdChampY + CHAMP_H + BOT_PAD : champBot + BOT_PAD;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${realH}" viewBox="0 0 ${svgW} ${realH}" style="display:block;overflow:visible;">${body}</svg>`;
  const wrap = document.createElement('div');
  wrap.className = 'bracket-svg-wrapper';
  wrap.innerHTML = svg;
  container.appendChild(wrap);
}

// ── Fallback lineare (solo finale, o 1 round) ─────────────────────
function renderLinearSVG(bracket, container) {
  const allRoundIds = Object.keys(bracket.rounds).map(Number).sort((a,b)=>a-b);
  const allMatches  = bracket.rounds;
  const mh          = matchH();
  const hasThird    = !!bracket.thirdPlaceMatch;
  const LOFF        = TOP_PAD + LABEL_H + LABEL_MB;
  const BASE        = mh + 28;

  const firstCount = allMatches[allRoundIds[0]].length;
  const totalH     = Math.max(firstCount * BASE - (BASE - mh), mh);

  let body = '';
  let maxY = 0;

  // Posizioni per ogni round
  const pos = {};
  allRoundIds.forEach((rid, ri) => {
    const ms = allMatches[rid];
    pos[rid] = ms.map((_, mi) => {
      if (ms.length === 1) return totalH / 2 - mh / 2;
      const spacing = Math.pow(2, ri) * BASE;
      const used    = ms.length * spacing - (spacing - mh);
      return (totalH - used) / 2 + mi * spacing;
    });
  });

  allRoundIds.forEach((rid, ri) => {
    const ms    = allMatches[rid];
    const isFin = ms.length === 1;
    const pal   = isFin ? 'gold' : 'blue';
    const x     = ri * COL_W;

    body += drawLabel(x, TOP_PAD, roundLabel(ms.length), pal);
    ms.forEach((m, mi) => {
      const y = LOFF + pos[rid][mi];
      body += drawMatch(x, y, m, pal, false);
      maxY = Math.max(maxY, y + mh);
    });

    // Connettori verso round successivo
    if (ri < allRoundIds.length - 1) {
      const nextRid = allRoundIds[ri + 1];
      ms.forEach((_, mi) => {
        const srcY = LOFF + pos[rid][mi];
        const dstY = LOFF + pos[nextRid][Math.floor(mi / 2)];
        body += drawConn(x, srcY, x + COL_W, dstY, C.blueConn, 'right');
      });
    }
  });

  const finalRid   = allRoundIds[allRoundIds.length - 1];
  const finalMatch = allMatches[finalRid][0];
  const finalX     = (allRoundIds.length - 1) * COL_W;
  const finalY     = LOFF + pos[finalRid][0];
  const champY     = finalY + mh + CHAMP_GAP;

  if (finalMatch?.winner_team_id) {
    const n = finalMatch.winner_team_id === finalMatch.team_a
      ? (finalMatch.team_a_name || formatTeamSvg(finalMatch.team_a))
      : (finalMatch.team_b_name || formatTeamSvg(finalMatch.team_b));
    body += svgEl('rect', { x:finalX, y:champY, width:MATCH_W, height:CHAMP_H, rx:CHAMP_H/2, ry:CHAMP_H/2, fill:C.goldChampBg, stroke:C.goldChampBorder, 'stroke-width':1.5 });
    body += svgEl('text', { x:finalX+MATCH_W/2, y:champY+CHAMP_H/2+6, fill:C.goldAccent, 'font-size':15, 'font-weight':'700', 'font-family':'Inter,sans-serif', 'text-anchor':'middle' }, `🏆 ${escH(n)}`);
  }

  const svgW = allRoundIds.length * COL_W + 40;
  const svgH = champY + CHAMP_H + BOT_PAD;
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block;overflow:visible;">${body}</svg>`;
  const wrap = document.createElement('div');
  wrap.className = 'bracket-svg-wrapper';
  wrap.innerHTML = svg;
  container.appendChild(wrap);
}


