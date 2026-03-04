// ===============================
// SVG PODIUM RENDERER v2
// Design: podio compatto in box, logo+nome centrati nelle colonne
// ===============================

(function() {
  'use strict';

  // ── Layout constants ──────────────────────────────────────────────
  const PODIUM_W = 675;           // ✅ +50% rispetto a 450
  const PODIUM_H = 400;           // ✅ Ridotto per compattezza
  const PLACE_W = 195;            // ✅ +50% rispetto a 130
  const PLACE_GAP = 22;           // ✅ +50% rispetto a 15
  const MEDAL_SIZE = 60;          // ✅ Aumentato
  const LOGO_SIZE = 50;           // ✅ Aumentato
  const BAR_HEIGHT_1ST = 180;     // ✅ Leggermente ridotto
  const BAR_HEIGHT_2ND = 140;     // ✅ Leggermente ridotto
  const BAR_HEIGHT_3RD = 110;     // ✅ Leggermente ridotto
  const LABEL_H = 50;
  const TOP_PAD = 40;
  const BOT_PAD = 60;

  // ── Palette (coerente con bracket) ────────────────────────────────
  const P = {
    // Medaglie
    goldBorder:         '#FFA500',
    goldGlow:           'rgba(255, 215, 0, 0.3)',
    
    silverBorder:       '#A8A8A8',
    silverGlow:         'rgba(192, 192, 192, 0.3)',
    
    bronzeBorder:       '#B87333',
    bronzeGlow:         'rgba(205, 127, 50, 0.3)',
    
    // Barre podio
    bar1st:             'rgba(255, 215, 0, 0.15)',
    bar1stBorder:       'rgba(255, 215, 0, 0.4)',
    bar1stTop:          'rgba(255, 215, 0, 0.25)',
    
    bar2nd:             'rgba(192, 192, 192, 0.12)',
    bar2ndBorder:       'rgba(192, 192, 192, 0.35)',
    bar2ndTop:          'rgba(192, 192, 192, 0.2)',
    
    bar3rd:             'rgba(205, 127, 50, 0.12)',
    bar3rdBorder:       'rgba(205, 127, 50, 0.35)',
    bar3rdTop:          'rgba(205, 127, 50, 0.2)',
    
    // Testo
    text:               '#d1d5db',
    textBright:         '#ffffff',
    
    // Label campione
    labelBg:            'rgba(255, 215, 0, 0.1)',
    labelBorder:        'rgba(255, 215, 0, 0.4)',
    labelText:          '#FFD700',
  };

  // ── SVG helpers ───────────────────────────────────────────────────
  function svgElPodium(tag, attrs, children = '') {
    const a = Object.entries(attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}>${children}</${tag}>`;
  }

  function escHPodium(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Disegna medaglia ──────────────────────────────────────────────
  function drawMedal(x, y, place) {
    let borderColor, glowColor, emoji;
    
    if (place === 1) {
      borderColor = P.goldBorder;
      glowColor = P.goldGlow;
      emoji = '🥇';
    } else if (place === 2) {
      borderColor = P.silverBorder;
      glowColor = P.silverGlow;
      emoji = '🥈';
    } else {
      borderColor = P.bronzeBorder;
      glowColor = P.bronzeGlow;
      emoji = '🥉';
    }
    
    let o = '';
    
    // Glow esterno
    o += svgElPodium('circle', {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2 + 6,
      fill: glowColor,
      opacity: 0.5
    });
    
    // Medaglia principale
    o += svgElPodium('circle', {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2,
      fill: borderColor,
      stroke: borderColor,
      'stroke-width': 3
    });
    
    // Emoji come testo
    o += svgElPodium('text', {
      x: x,
      y: y + 8,
      'font-size': 32,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    }, emoji);
    
    return o;
  }

  // ── Disegna logo squadra ──────────────────────────────────────────
  function drawTeamLogo(x, y, logoUrl) {
    if (!logoUrl) {
      // Fallback icon
      return svgElPodium('text', {
        x: x,
        y: y + 8,
        'font-size': 32,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle'
      }, '👥');
    }
    
    // Immagine logo
    return svgElPodium('image', {
      x: x - LOGO_SIZE / 2,
      y: y - LOGO_SIZE / 2,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      href: logoUrl,
      preserveAspectRatio: 'xMidYMid meet'
    });
  }

  // ── Disegna barra podio 3D ────────────────────────────────────────
  function drawPodiumBar(x, y, width, height, place) {
    let barColor, borderColor, topColor;
    
    if (place === 1) {
      barColor = P.bar1st;
      borderColor = P.bar1stBorder;
      topColor = P.bar1stTop;
    } else if (place === 2) {
      barColor = P.bar2nd;
      borderColor = P.bar2ndBorder;
      topColor = P.bar2ndTop;
    } else {
      barColor = P.bar3rd;
      borderColor = P.bar3rdBorder;
      topColor = P.bar3rdTop;
    }
    
    let o = '';
    
    // Barra principale
    o += svgElPodium('rect', {
      x: x,
      y: y,
      width: width,
      height: height,
      rx: 8,
      ry: 8,
      fill: barColor,
      stroke: borderColor,
      'stroke-width': 2
    });
    
    // Top 3D effect
    const topH = 8;
    o += svgElPodium('rect', {
      x: x,
      y: y,
      width: width,
      height: topH,
      rx: 8,
      ry: 8,
      fill: topColor
    });
    
    return o;
  }

  // ── Disegna un posto del podio ───────────────────────────────────
  function drawPlace(x, baseY, team, place, logoUrl) {
    let barHeight;
    if (place === 1) barHeight = BAR_HEIGHT_1ST;
    else if (place === 2) barHeight = BAR_HEIGHT_2ND;
    else barHeight = BAR_HEIGHT_3RD;
    
    const barY = baseY - barHeight;
    const centerX = x + PLACE_W / 2;
    const centerY = barY + barHeight / 2;
    
    // ✅ Medaglia sopra la barra
    const medalY = barY - MEDAL_SIZE / 2 - 15;
    
    let o = '';
    
    // Barra podio
    o += drawPodiumBar(x, barY, PLACE_W, barHeight, place);
    
    // ✅ Logo centrato verticalmente e orizzontalmente
    const logoY = centerY - 20;
    o += drawTeamLogo(centerX, logoY, logoUrl);
    
    // ✅ Nome squadra centrato sotto il logo
    const nameY = logoY + LOGO_SIZE / 2 + 30;
    const clipId = `clip-name-${place}`;
    o += `<defs><clipPath id="${clipId}"><rect x="${x + 10}" y="${nameY - 15}" width="${PLACE_W - 20}" height="35"/></clipPath></defs>`;
    o += svgElPodium('text', {
      x: centerX,
      y: nameY,
      fill: P.textBright,
      'font-size': 18,
      'font-weight': '700',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'clip-path': `url(#${clipId})`
    }, escHPodium(team.team_name || ''));
    
    // ✅ Medaglia sopra la barra
    o += drawMedal(centerX, medalY, place);
    
    return o;
  }

  // ── Disegna label campione ───────────────────────────────────────
  function drawChampionLabel(x, y, width, championName) {
    let o = '';
    
    const labelW = width * 0.8;
    const labelX = x + (width - labelW) / 2;
    
    // Background
    o += svgElPodium('rect', {
      x: labelX,
      y: y,
      width: labelW,
      height: LABEL_H,
      rx: LABEL_H / 2,
      ry: LABEL_H / 2,
      fill: P.labelBg,
      stroke: P.labelBorder,
      'stroke-width': 2
    });
    
    // Icona trofeo
    o += svgElPodium('text', {
      x: labelX + 30,
      y: y + LABEL_H / 2 + 6,
      'font-size': 22,
      'text-anchor': 'middle'
    }, '🏆');
    
    // Testo "CAMPIONE"
    o += svgElPodium('text', {
      x: labelX + labelW / 2 - 20,
      y: y + LABEL_H / 2 - 8,
      fill: P.labelText,
      'font-size': 13,
      'font-weight': '700',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'letter-spacing': '0.1em'
    }, 'CAMPIONE');
    
    // Nome campione (con clip)
    const clipId = 'clip-champion';
    o += `<defs><clipPath id="${clipId}"><rect x="${labelX + 70}" y="${y + LABEL_H / 2}" width="${labelW - 100}" height="25"/></clipPath></defs>`;
    o += svgElPodium('text', {
      x: labelX + labelW / 2 - 20,
      y: y + LABEL_H / 2 + 18,
      fill: P.textBright,
      'font-size': 16,
      'font-weight': '800',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'clip-path': `url(#${clipId})`
    }, escHPodium(championName));
    
    return o;
  }

  // ── MAIN RENDERER ─────────────────────────────────────────────────
  window.renderPodiumSVG = function(podiumData, container) {
    container.innerHTML = '';
    
    const { standings, isSetBased, sport, teamsLogosMap } = podiumData;
    
    if (!standings || standings.length === 0) {
      container.innerHTML = "<p class='placeholder'>Nessun dato disponibile</p>";
      return;
    }
    
    // Ordina per ranking
    const sorted = [...standings].sort((a, b) => {
      const rankDiff = (a.rank_level || 99) - (b.rank_level || 99);
      if (rankDiff !== 0) return rankDiff;
      const pointsDiff = (b.points || 0) - (a.points || 0);
      if (pointsDiff !== 0) return pointsDiff;
      if (isSetBased) return (b.set_diff || 0) - (a.set_diff || 0);
      return (b.goal_diff || 0) - (a.goal_diff || 0);
    });
    
    const top3 = sorted.slice(0, 3);
    
    if (top3.length === 0) {
      container.innerHTML = "<p class='placeholder'>Classifica non disponibile</p>";
      return;
    }
    
    // Calcola dimensioni SVG
    const totalWidth = PODIUM_W;
    const baseY = PODIUM_H - BOT_PAD;
    const svgH = PODIUM_H + LABEL_H + 40;
    
    let body = '';
    
    // Disposizione: 2° - 1° - 3°
    const positions = [
      { team: top3[1], place: 2, x: (totalWidth / 2 - PLACE_W - PLACE_GAP / 2) - PLACE_W / 2 },
      { team: top3[0], place: 1, x: totalWidth / 2 - PLACE_W / 2 },
      { team: top3[2], place: 3, x: (totalWidth / 2 + PLACE_W + PLACE_GAP / 2) - PLACE_W / 2 }
    ];
    
    // Disegna i 3 posti (se esistono)
    positions.forEach(pos => {
      if (pos.team) {
        const logoUrl = teamsLogosMap[pos.team.team_id] || null;
        body += drawPlace(pos.x, baseY, pos.team, pos.place, logoUrl);
      }
    });
    
    // Label campione in basso
    const championName = top3[0]?.team_name || 'TBD';
    const labelY = baseY + 20;
    body += drawChampionLabel(0, labelY, totalWidth, championName);
    
    // Assembla SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgH}" viewBox="0 0 ${totalWidth} ${svgH}" style="display:block;margin:0 auto;overflow:visible;">${body}</svg>`;
    
    const wrap = document.createElement('div');
    wrap.className = 'podium-svg-wrapper';
    wrap.innerHTML = svg;
    container.appendChild(wrap);
  };

})();