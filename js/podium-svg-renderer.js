// ===============================
// SVG PODIUM RENDERER v3 - PREMIUM
// Design: effetti glassmorphism, ombre, gradients, animazioni
// ===============================

(function() {
  'use strict';

  // ── Layout constants ──────────────────────────────────────────────
  const PODIUM_W = 675;
  const PODIUM_H = 420;
  const PLACE_W = 195;
  const PLACE_GAP = 22;
  const MEDAL_SIZE = 70;          // ✅ Più grande
  const LOGO_SIZE = 60;           // ✅ Più grande
  const BAR_HEIGHT_1ST = 200;     // ✅ Aumentato
  const BAR_HEIGHT_2ND = 160;
  const BAR_HEIGHT_3RD = 130;
  const LABEL_H = 55;
  const TOP_PAD = 50;
  const BOT_PAD = 65;

  // ── Palette Premium ───────────────────────────────────────────────
  const P = {
    // Oro con gradient premium
    gold1: '#FFD700',
    gold2: '#FFA500',
    goldGlow: 'rgba(255, 215, 0, 0.5)',
    goldShadow: 'rgba(255, 215, 0, 0.25)',
    
    // Argento con gradient
    silver1: '#E8E8E8',
    silver2: '#A8A8A8',
    silverGlow: 'rgba(232, 232, 232, 0.4)',
    silverShadow: 'rgba(192, 192, 192, 0.2)',
    
    // Bronzo con gradient
    bronze1: '#E5A05D',
    bronze2: '#B87333',
    bronzeGlow: 'rgba(229, 160, 93, 0.4)',
    bronzeShadow: 'rgba(205, 127, 50, 0.2)',
    
    // Barre con glassmorphism
    bar1st: 'rgba(255, 215, 0, 0.08)',
    bar1stBorder: 'rgba(255, 215, 0, 0.5)',
    bar1stGlow: 'rgba(255, 215, 0, 0.15)',
    
    bar2nd: 'rgba(232, 232, 232, 0.06)',
    bar2ndBorder: 'rgba(232, 232, 232, 0.4)',
    bar2ndGlow: 'rgba(232, 232, 232, 0.12)',
    
    bar3rd: 'rgba(229, 160, 93, 0.06)',
    bar3rdBorder: 'rgba(229, 160, 93, 0.4)',
    bar3rdGlow: 'rgba(229, 160, 93, 0.12)',
    
    // Testo
    text: '#e5e7eb',
    textBright: '#ffffff',
    
    // Label premium
    labelBg: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 165, 0, 0.08) 100%)',
    labelBorder: 'rgba(255, 215, 0, 0.5)',
    labelGlow: 'rgba(255, 215, 0, 0.3)',
    labelText: '#FFD700',
  };

  // ── SVG helpers ───────────────────────────────────────────────────
  function svgElPodium(tag, attrs, children = '') {
    const a = Object.entries(attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}>${children}</${tag}>`;
  }

  function escHPodium(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Gradients & Filters (definiti una sola volta) ─────────────────
  function defineGradientsAndFilters() {
    return `
      <defs>
        <!-- Gradient Oro -->
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${P.gold1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${P.gold2};stop-opacity:1" />
        </linearGradient>
        
        <!-- Gradient Argento -->
        <linearGradient id="silverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${P.silver1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${P.silver2};stop-opacity:1" />
        </linearGradient>
        
        <!-- Gradient Bronzo -->
        <linearGradient id="bronzeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${P.bronze1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${P.bronze2};stop-opacity:1" />
        </linearGradient>
        
        <!-- Glow Filter -->
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Shadow Filter -->
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="4" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    `;
  }

  // ── Disegna medaglia premium ──────────────────────────────────────
  function drawMedal(x, y, place) {
    let gradient, glowColor, emoji;
    
    if (place === 1) {
      gradient = 'url(#goldGradient)';
      glowColor = P.goldGlow;
      emoji = '🥇';
    } else if (place === 2) {
      gradient = 'url(#silverGradient)';
      glowColor = P.silverGlow;
      emoji = '🥈';
    } else {
      gradient = 'url(#bronzeGradient)';
      glowColor = P.bronzeGlow;
      emoji = '🥉';
    }
    
    let o = '';
    
    // Glow multiplo (3 layer)
    o += svgElPodium('circle', {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2 + 12,
      fill: glowColor,
      opacity: 0.3
    });
    
    o += svgElPodium('circle', {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2 + 8,
      fill: glowColor,
      opacity: 0.5
    });
    
    // Cerchio esterno con ombra
    o += svgElPodium('circle', {
      cx: x,
      cy: y + 2,
      r: MEDAL_SIZE / 2 + 2,
      fill: 'rgba(0,0,0,0.15)',
      filter: 'url(#shadow)'
    });
    
    // Medaglia principale con gradient
    o += svgElPodium('circle', {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2,
      fill: gradient,
      stroke: gradient,
      'stroke-width': 3,
      filter: 'url(#glow)'
    });
    
    // Riflesso interno
    o += svgElPodium('ellipse', {
      cx: x - MEDAL_SIZE / 6,
      cy: y - MEDAL_SIZE / 6,
      rx: MEDAL_SIZE / 4,
      ry: MEDAL_SIZE / 5,
      fill: 'rgba(255,255,255,0.3)',
      opacity: 0.6
    });
    
    // Emoji
    o += svgElPodium('text', {
      x: x,
      y: y + 10,
      'font-size': 36,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    }, emoji);
    
    return o;
  }

  // ── Disegna logo squadra con bordo premium ────────────────────────
  function drawTeamLogo(x, y, logoUrl, place) {
    let borderColor;
    if (place === 1) borderColor = P.gold1;
    else if (place === 2) borderColor = P.silver1;
    else borderColor = P.bronze1;
    
    let o = '';
    
    if (!logoUrl) {
      // Fallback icon con bordo
      o += svgElPodium('circle', {
        cx: x,
        cy: y,
        r: LOGO_SIZE / 2 + 4,
        fill: 'none',
        stroke: borderColor,
        'stroke-width': 2,
        opacity: 0.4
      });
      
      o += svgElPodium('text', {
        x: x,
        y: y + 8,
        'font-size': 36,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle'
      }, '👥');
    } else {
      // Cerchio dietro il logo
      o += svgElPodium('circle', {
        cx: x,
        cy: y,
        r: LOGO_SIZE / 2 + 4,
        fill: 'rgba(255,255,255,0.05)',
        stroke: borderColor,
        'stroke-width': 2,
        opacity: 0.5
      });
      
      // Clip path circolare per il logo
      const clipId = `logo-clip-${place}`;
      o += `<clipPath id="${clipId}"><circle cx="${x}" cy="${y}" r="${LOGO_SIZE / 2}"/></clipPath>`;
      
      // Logo
      o += svgElPodium('image', {
        x: x - LOGO_SIZE / 2,
        y: y - LOGO_SIZE / 2,
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        href: logoUrl,
        'clip-path': `url(#${clipId})`,
        preserveAspectRatio: 'xMidYMid meet'
      });
    }
    
    return o;
  }

  // ── Disegna barra podio premium con glassmorphism ─────────────────
  function drawPodiumBar(x, y, width, height, place) {
    let barColor, borderColor, glowColor;
    
    if (place === 1) {
      barColor = P.bar1st;
      borderColor = P.bar1stBorder;
      glowColor = P.bar1stGlow;
    } else if (place === 2) {
      barColor = P.bar2nd;
      borderColor = P.bar2ndBorder;
      glowColor = P.bar2ndGlow;
    } else {
      barColor = P.bar3rd;
      borderColor = P.bar3rdBorder;
      glowColor = P.bar3rdGlow;
    }
    
    let o = '';
    
    // Glow esterno
    o += svgElPodium('rect', {
      x: x - 2,
      y: y - 2,
      width: width + 4,
      height: height + 4,
      rx: 10,
      ry: 10,
      fill: glowColor,
      opacity: 0.6
    });
    
    // Barra principale con glassmorphism
    o += svgElPodium('rect', {
      x: x,
      y: y,
      width: width,
      height: height,
      rx: 8,
      ry: 8,
      fill: barColor,
      stroke: borderColor,
      'stroke-width': 2,
      filter: 'url(#shadow)'
    });
    
    // Riflesso superiore (glass effect)
    o += svgElPodium('rect', {
      x: x + 4,
      y: y + 4,
      width: width - 8,
      height: 20,
      rx: 6,
      fill: 'rgba(255,255,255,0.1)'
    });
    
    // Linea superiore accent
    o += svgElPodium('rect', {
      x: x,
      y: y,
      width: width,
      height: 3,
      rx: 8,
      ry: 8,
      fill: borderColor,
      opacity: 0.8
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
    
    const medalY = barY - MEDAL_SIZE / 2 - 20;
    
    let o = '';
    
    // Barra podio
    o += drawPodiumBar(x, barY, PLACE_W, barHeight, place);
    
    // Logo centrato
    const logoY = centerY - 15;
    o += drawTeamLogo(centerX, logoY, logoUrl, place);
    
    // Nome squadra
    const nameY = logoY + LOGO_SIZE / 2 + 35;
    const clipId = `clip-name-${place}`;
    o += `<clipPath id="${clipId}"><rect x="${x + 10}" y="${nameY - 18}" width="${PLACE_W - 20}" height="40"/></clipPath>`;
    o += svgElPodium('text', {
      x: centerX,
      y: nameY,
      fill: P.textBright,
      'font-size': 19,
      'font-weight': '700',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'clip-path': `url(#${clipId})`,
      'letter-spacing': '0.02em'
    }, escHPodium(team.team_name || ''));
    
    // Medaglia sopra
    o += drawMedal(centerX, medalY, place);
    
    return o;
  }

  // ── Disegna label campione premium ────────────────────────────────
  function drawChampionLabel(x, y, width, championName) {
    let o = '';
    
    const labelW = width * 0.75;
    const labelX = x + (width - labelW) / 2;
    
    // Glow esterno
    o += svgElPodium('rect', {
      x: labelX - 3,
      y: y - 3,
      width: labelW + 6,
      height: LABEL_H + 6,
      rx: LABEL_H / 2 + 3,
      ry: LABEL_H / 2 + 3,
      fill: P.labelGlow,
      opacity: 0.4
    });
    
    // Background con gradient (simulato con rect)
    o += svgElPodium('rect', {
      x: labelX,
      y: y,
      width: labelW,
      height: LABEL_H,
      rx: LABEL_H / 2,
      ry: LABEL_H / 2,
      fill: 'rgba(255, 215, 0, 0.12)',
      stroke: P.labelBorder,
      'stroke-width': 2,
      filter: 'url(#glow)'
    });
    
    // Riflesso interno
    o += svgElPodium('rect', {
      x: labelX + 8,
      y: y + 6,
      width: labelW - 16,
      height: 16,
      rx: 8,
      fill: 'rgba(255,255,255,0.08)'
    });
    
    // Icona trofeo
    o += svgElPodium('text', {
      x: labelX + 35,
      y: y + LABEL_H / 2 + 7,
      'font-size': 26,
      'text-anchor': 'middle',
      filter: 'url(#glow)'
    }, '🏆');
    
    // Testo "CAMPIONE"
    o += svgElPodium('text', {
      x: labelX + labelW / 2,
      y: y + LABEL_H / 2 - 9,
      fill: P.labelText,
      'font-size': 14,
      'font-weight': '800',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'letter-spacing': '0.15em'
    }, 'CAMPIONE');
    
    // Nome campione
    const clipId = 'clip-champion';
    o += `<clipPath id="${clipId}"><rect x="${labelX + 75}" y="${y + LABEL_H / 2}" width="${labelW - 110}" height="28"/></clipPath>`;
    o += svgElPodium('text', {
      x: labelX + labelW / 2,
      y: y + LABEL_H / 2 + 20,
      fill: P.textBright,
      'font-size': 17,
      'font-weight': '800',
      'font-family': 'Inter,sans-serif',
      'text-anchor': 'middle',
      'clip-path': `url(#${clipId})`,
      'letter-spacing': '0.02em'
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
    
    const totalWidth = PODIUM_W;
    const baseY = PODIUM_H - BOT_PAD;
    const svgH = PODIUM_H + LABEL_H + 50;
    
    let body = '';
    
    // Gradients & Filters
    body += defineGradientsAndFilters();
    
    // Disposizione: 2° - 1° - 3°
    const positions = [
      { team: top3[1], place: 2, x: (totalWidth / 2 - PLACE_W - PLACE_GAP / 2) - PLACE_W / 2 },
      { team: top3[0], place: 1, x: totalWidth / 2 - PLACE_W / 2 },
      { team: top3[2], place: 3, x: (totalWidth / 2 + PLACE_W + PLACE_GAP / 2) - PLACE_W / 2 }
    ];
    
    positions.forEach(pos => {
      if (pos.team) {
        const logoUrl = teamsLogosMap[pos.team.team_id] || null;
        body += drawPlace(pos.x, baseY, pos.team, pos.place, logoUrl);
      }
    });
    
    // Label campione
    const championName = top3[0]?.team_name || 'TBD';
    const labelY = baseY + 25;
    body += drawChampionLabel(0, labelY, totalWidth, championName);
    
    // Assembla SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgH}" viewBox="0 0 ${totalWidth} ${svgH}" style="display:block;margin:0 auto;overflow:visible;">${body}</svg>`;
    
    const wrap = document.createElement('div');
    wrap.className = 'podium-svg-wrapper';
    wrap.innerHTML = svg;
    container.appendChild(wrap);
  };

})();