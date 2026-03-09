// ===============================
// SVG BRACKET RENDERER v4
// Mobile-first: dimensioni compatte, scrollabile
// ===============================

// ── Layout constants (mobile-first, compatte) ─────────────────────
const MATCH_W         = 120;
const MATCH_H         = 26;
const MATCH_GAP       = 4;
const ROUND_GAP       = 32;
const COL_W           = MATCH_W + ROUND_GAP;
const LABEL_H         = 20;
const LABEL_MB        = 9;
const TOP_PAD         = 9;
const BOT_PAD         = 18;
const THIRD_GAP_V     = 26;
const THIRD_LABEL_GAP = 9;
const CONN_OFFSET     = 12;

function matchH() { return MATCH_H * 2 + MATCH_GAP; }

// ── Palette LIGHT (Design System) ─────────────────────────────────
const C = {

  // card
  cardBg:        '#ffffff',
  cardBgAlt:     '#faf6f1',

  cardBorder:    '#e6ded3',
  cardBorderTbd: '#eee6db',

  // testo
  text:          '#2f2a24',
  textWin:       '#1f1b16',
  textLose:      '#8a8175',
  textTbd:       '#b0a79b',

  textScore:     '#8a8175',

  // winner styling
  winBg:         'rgba(176,138,90,0.08)',
  winBorder:     '#b08a5a',
  winBar:        '#b08a5a',
  winAccent:     '#9a764a',

  // loser
  loseBg:        '#faf6f1',
  loseBorder:    '#e6ded3',

  // label round
  labelText:     '#6b6258',
  labelBg:       '#f5efe6',
  labelBorder:   '#e6ded3',

  // connector lines
  connColor:     '#d6cec2'
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
function drawMatch(x, y, match, flip) {
  const mh     = matchH();
  const played = match.played === true || String(match.played||'').toUpperCase() === 'TRUE';
  const winner = resolveWinner(match);
  const teamA  = match.team_a_name || (match.team_a ? formatTeamSvg(match.team_a) : null);
  const teamB  = match.team_b_name || (match.team_b ? formatTeamSvg(match.team_b) : null);
  const aTbd   = !match.team_a;
  const bTbd   = !match.team_b;
  const aWin   = winner === match.team_a;
  const bWin   = winner === match.team_b;
  const aLose  = played && winner && !aWin;
  const bLose  = played && winner && !bWin;
  const sA     = played && match.score_a !== null && match.score_a !== '' ? String(match.score_a) : '−';
  const sB     = played && match.score_b !== null && match.score_b !== '' ? String(match.score_b) : '−';

  const barW = 3;
  let o = '';

  const drawRow = (rowY, name, score, isTbd, isWin, isLose, isAlt) => {
    const bg   = isWin ? C.winBg : (isLose ? C.loseBg : (isTbd ? 'rgba(255,255,255,0.015)' : (isAlt ? C.cardBgAlt : C.cardBg)));
    const brd  = isWin ? C.winBorder : (isLose ? C.loseBorder : (isTbd ? C.cardBorderTbd : C.cardBorder));
    const dash = isTbd ? {'stroke-dasharray':'3 3'} : {};
    const nC   = isWin ? C.textWin : (isLose ? C.textLose : (isTbd ? C.textTbd : C.text));
    const sC   = isWin ? C.winAccent : (isTbd ? C.textTbd : C.textScore);
    const fw   = isWin ? '700' : (isTbd ? '400' : '500');
    const fi   = isTbd ? 'italic' : 'normal';
    const fs   = isTbd ? 9 : 10;

    const nameX = x + MATCH_W / 2;
    const scoreX = flip ? x + 10 : x + MATCH_W - 10;

    const nameAnchor = 'middle';
    const scoreAnchor = flip ? 'start' : 'end';

    let r = '';
    r += svgEl('rect', { x, y:rowY, width:MATCH_W, height:MATCH_H, rx:5, ry:5, fill:bg, stroke:brd, 'stroke-width':1, ...dash });
    
    if (isWin) {
      const barX = flip ? x + MATCH_W - barW : x;
      r += svgEl('rect', { x:barX, y:rowY, width:barW, height:MATCH_H, rx:1, fill:C.winBar });
    }
    
    const clipId = `c${Math.round(x*10)}-${Math.round(rowY*10)}`;
    const clipXs = flip ? x + 30 : x + 6;
    const clipW  = MATCH_W - 42;
    r += `<defs><clipPath id="${clipId}"><rect x="${clipXs}" y="${rowY}" width="${clipW}" height="${MATCH_H}"/></clipPath></defs>`;
    r += svgEl('text', { 
      x:nameX, 
      y:rowY+MATCH_H/2+4, 
      fill:nC, 
      'font-size':fs, 
      'font-weight':fw, 
      'font-style':fi, 
      'font-family':'Inter,sans-serif', 
      'text-anchor':nameAnchor, 
      'clip-path':`url(#${clipId})` 
    }, isTbd ? 'TBD' : escH(name||''));
    
    r += svgEl('text', { 
      x:scoreX, 
      y:rowY+MATCH_H/2+4, 
      fill:sC, 
      'font-size':11, 
      'font-weight':isWin?'800':'500', 
      'font-family':'Inter,sans-serif', 
      'text-anchor':scoreAnchor 
    }, escH(score));
    
    return r;
  };

  const yA = y, yB = y + MATCH_H + MATCH_GAP;
  o += drawRow(yA, teamA, sA, aTbd, aWin, aLose, false);
  o += svgEl('rect', { x, y:yA+MATCH_H, width:MATCH_W, height:MATCH_GAP, fill:'#ffffff' });
  o += drawRow(yB, teamB, sB, bTbd, bWin, bLose, true);
  
  const borderColor = (aWin || bWin) ? C.winBorder : C.cardBorder;
  o += svgEl('rect', { x, y:yA, width:MATCH_W, height:mh, rx:5, ry:5, fill:'none', stroke:borderColor, 'stroke-width':1, 'pointer-events':'none' });
  
  return o;
}

// ── Pill label ────────────────────────────────────────────────────
function drawLabel(x, y, text) {
  let o = '';
  o += svgEl('rect', { 
    x, y, width:MATCH_W, height:LABEL_H, 
    rx:LABEL_H/2, ry:LABEL_H/2, 
    fill:C.labelBg, stroke:C.labelBorder, 'stroke-width':1 
  });
  o += svgEl('text', { 
    x:x+MATCH_W/2, y:y+LABEL_H/2+5, 
    fill:C.labelText, 'font-size':8, 'font-weight':'700', 
    'font-family':'Inter,sans-serif', 'text-anchor':'middle', 
    'letter-spacing':'0.05em' 
  }, escH(text.toUpperCase()));
  return o;
}

// ── Connettore a gomito ───────────────────────────────────────────
function drawElbowConn(srcX, srcY, dstX, dstY, dir) {
  const mh = matchH();
  const srcMidY = srcY + mh / 2;
  const dstMidY = dstY + mh / 2;
  
  let x1, x4;
  
  if (dir === 'right') {
    x1 = srcX + MATCH_W;
    x4 = dstX;
  } else {
    x1 = srcX;
    x4 = dstX + MATCH_W;
  }
  
  const xMid = dir === 'right' ? x1 + CONN_OFFSET : x1 - CONN_OFFSET;
  const d = `M ${x1} ${srcMidY} H ${xMid} V ${dstMidY} H ${x4}`;
  
  return svgEl('path', { 
    d, fill:'none', stroke:C.connColor, 'stroke-width':1.5, 
    'stroke-linecap':'round', 'stroke-linejoin':'round' 
  });
}

// ── Connettore a Y ────────────────────────────────────────────────
function drawYConn(srcX1, srcY1, srcX2, srcY2, dstX, dstY, dir) {
  const mh = matchH();
  const src1MidY = srcY1 + mh / 2;
  const src2MidY = srcY2 + mh / 2;
  const dstMidY  = dstY + mh / 2;
  
  let xMid, x4;
  
  if (dir === 'right') {
    xMid = srcX1 + MATCH_W + CONN_OFFSET;
    x4 = dstX;
  } else {
    xMid = srcX1 - CONN_OFFSET;
    x4 = dstX + MATCH_W;
  }
  
  const d1 = `M ${dir === 'right' ? srcX1 + MATCH_W : srcX1} ${src1MidY} H ${xMid}`;
  const d2 = `M ${dir === 'right' ? srcX2 + MATCH_W : srcX2} ${src2MidY} H ${xMid}`;
  const d3 = `M ${xMid} ${src1MidY} V ${dstMidY} H ${x4}`;
  
  let o = '';
  o += svgEl('path', { d:d1, fill:'none', stroke:C.connColor, 'stroke-width':1.5, 'stroke-linecap':'round' });
  o += svgEl('path', { d:d2, fill:'none', stroke:C.connColor, 'stroke-width':1.5, 'stroke-linecap':'round' });
  o += svgEl('path', { d:d3, fill:'none', stroke:C.connColor, 'stroke-width':1.5, 'stroke-linecap':'round', 'stroke-linejoin':'round' });
  
  return o;
}

// ── Calcola posizioni Y per un lato ──────────────────────────────
function computeSidePositions(roundIds, matchesByRound) {
  const mh = matchH();
  const BASE = mh + 24;
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

  if (sideRounds.length === 0) {
    return renderLinearSVG(bracket, container);
  }

  const leftMs  = {}, rightMs = {};
  sideRounds.forEach(rid => {
    const ms   = allMatches[rid];
    const half = Math.ceil(ms.length / 2);
    leftMs[rid]  = ms.slice(0, half);
    rightMs[rid] = ms.slice(half);
  });

  const { pos: leftPos, totalH } = computeSidePositions(sideRounds, leftMs);

  const n          = sideRounds.length;
  const finalColI  = n;
  const totalCols  = n * 2 + 1;
  const colX       = ci => ci * COL_W;

  const LOFF = TOP_PAD + LABEL_H + LABEL_MB;
  const finalMatchY = LOFF + totalH / 2 - mh / 2;

  let thirdLabelY = 0, thirdMatchY = 0;
  if (hasThird) {
    thirdLabelY = finalMatchY + mh + THIRD_GAP_V;
    thirdMatchY = thirdLabelY + LABEL_H + THIRD_LABEL_GAP;
  }

  const svgW = totalCols * COL_W + 40;
  const svgH = hasThird ? thirdMatchY + mh + BOT_PAD : finalMatchY + mh + BOT_PAD;

  let body = '';

  // Connettori
  sideRounds.forEach((rid, ri) => {
    const isInner = ri === n - 1;
    
    for (let mi = 0; mi < leftMs[rid].length; mi += 2) {
      const srcX1 = colX(ri);
      const srcY1 = LOFF + leftPos[rid][mi];
      
      if (isInner) {
        if (mi + 1 < leftMs[rid].length) {
          const srcY2 = LOFF + leftPos[rid][mi + 1];
          body += drawYConn(srcX1, srcY1, srcX1, srcY2, colX(finalColI), finalMatchY, 'right');
        } else {
          body += drawElbowConn(srcX1, srcY1, colX(finalColI), finalMatchY, 'right');
        }
      } else {
        const nextRid = sideRounds[ri + 1];
        const dstY    = LOFF + leftPos[nextRid][Math.floor(mi / 2)];
        if (mi + 1 < leftMs[rid].length) {
          const srcY2 = LOFF + leftPos[rid][mi + 1];
          body += drawYConn(srcX1, srcY1, srcX1, srcY2, colX(ri + 1), dstY, 'right');
        } else {
          body += drawElbowConn(srcX1, srcY1, colX(ri + 1), dstY, 'right');
        }
      }
    }
    
    const dxColI = finalColI + (n - ri);
    for (let mi = 0; mi < rightMs[rid].length; mi += 2) {
      const srcX1 = colX(dxColI);
      const srcY1 = LOFF + leftPos[rid][mi];
      
      if (isInner) {
        if (mi + 1 < rightMs[rid].length) {
          const srcY2 = LOFF + leftPos[rid][mi + 1];
          body += drawYConn(srcX1, srcY1, srcX1, srcY2, colX(finalColI), finalMatchY, 'left');
        } else {
          body += drawElbowConn(srcX1, srcY1, colX(finalColI), finalMatchY, 'left');
        }
      } else {
        const nextRid  = sideRounds[ri + 1];
        const nextColI = finalColI + (n - ri - 1);
        const dstY     = LOFF + leftPos[nextRid][Math.floor(mi / 2)];
        if (mi + 1 < rightMs[rid].length) {
          const srcY2 = LOFF + leftPos[rid][mi + 1];
          body += drawYConn(srcX1, srcY1, srcX1, srcY2, colX(nextColI), dstY, 'left');
        } else {
          body += drawElbowConn(srcX1, srcY1, colX(nextColI), dstY, 'left');
        }
      }
    }
  });

  // Connettore 3/4 posto
  if (hasThird) {
    const thirdX  = colX(finalColI);
    const thirdCX = thirdX + MATCH_W / 2;
    const finalEndY = finalMatchY + mh;
    const d = `M ${thirdCX} ${finalEndY} V ${thirdMatchY}`;
    body += svgEl('path', { 
      d, fill:'none', stroke:C.connColor, 'stroke-width':1.5, 
      'stroke-linecap':'round', 'stroke-dasharray':'5 3' 
    });
  }

  // Label
  sideRounds.forEach((rid, ri) => {
    const count = allMatches[rid].length;
    body += drawLabel(colX(ri), TOP_PAD, roundLabel(count));
    body += drawLabel(colX(finalColI + (n - ri)), TOP_PAD, roundLabel(count));
  });
  body += drawLabel(colX(finalColI), TOP_PAD, 'Finale');

  // Card match
  sideRounds.forEach((rid, ri) => {
    const dxColI = finalColI + (n - ri);
    leftMs[rid].forEach((m, mi) => {
      body += drawMatch(colX(ri), LOFF + leftPos[rid][mi], m, true);
    });
    rightMs[rid].forEach((m, mi) => {
      body += drawMatch(colX(dxColI), LOFF + leftPos[rid][mi], m, false);
    });
  });

  // Finale
  const finalMatch = allMatches[finalRound][0];
  body += drawMatch(colX(finalColI), finalMatchY, finalMatch, false);

  // 3/4 posto
  if (hasThird) {
    const tx = colX(finalColI);
    const tm = bracket.thirdPlaceMatch;
    body += drawLabel(tx, thirdLabelY, '3° / 4° Posto');
    body += drawMatch(tx, thirdMatchY, tm, false);
  }

  // Assembla
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block;overflow:visible;">${body}</svg>`;
  const wrap = document.createElement('div');
  wrap.className = 'bracket-svg-wrapper';
  wrap.innerHTML = svg;
  container.appendChild(wrap);
}

// ── Fallback lineare ──────────────────────────────────────────────
function renderLinearSVG(bracket, container) {
  const allRoundIds = Object.keys(bracket.rounds).map(Number).sort((a,b)=>a-b);
  const allMatches  = bracket.rounds;
  const mh          = matchH();
  const hasThird    = !!bracket.thirdPlaceMatch;
  const LOFF        = TOP_PAD + LABEL_H + LABEL_MB;
  const BASE        = mh + 24;

  const firstCount = allMatches[allRoundIds[0]].length;
  const totalH     = Math.max(firstCount * BASE - (BASE - mh), mh);

  let body = '';
  let maxY = 0;

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
    const ms = allMatches[rid];
    const x  = ri * COL_W;

    body += drawLabel(x, TOP_PAD, roundLabel(ms.length));
    ms.forEach((m, mi) => {
      const y = LOFF + pos[rid][mi];
      body += drawMatch(x, y, m, false);
      maxY = Math.max(maxY, y + mh);
    });

    if (ri < allRoundIds.length - 1) {
      const nextRid = allRoundIds[ri + 1];
      for (let mi = 0; mi < ms.length; mi += 2) {
        const srcY1 = LOFF + pos[rid][mi];
        const dstY  = LOFF + pos[nextRid][Math.floor(mi / 2)];
        if (mi + 1 < ms.length) {
          const srcY2 = LOFF + pos[rid][mi + 1];
          body += drawYConn(x, srcY1, x, srcY2, x + COL_W, dstY, 'right');
        } else {
          body += drawElbowConn(x, srcY1, x + COL_W, dstY, 'right');
        }
      }
    }
  });

  const svgW = allRoundIds.length * COL_W + 40;
  const svgH = maxY + BOT_PAD;
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block;overflow:visible;">${body}</svg>`;
  const wrap = document.createElement('div');
  wrap.className = 'bracket-svg-wrapper';
  wrap.innerHTML = svg;
  container.appendChild(wrap);
}