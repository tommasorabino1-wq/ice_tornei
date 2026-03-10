// ===============================
// SVG PODIUM RENDERER v4 - LIGHT DESIGN SYSTEM
// Coerente con Design System 2.0
// ===============================

(function () {
  "use strict";

  const PODIUM_W = 675;
  const PODIUM_H = 420;

  const PLACE_W = 195;
  const PLACE_GAP = 22;

  const MEDAL_SIZE = 90;
  const LOGO_SIZE = 60;

  const BAR_HEIGHT_1ST = 200;
  const BAR_HEIGHT_2ND = 160;
  const BAR_HEIGHT_3RD = 130;

  const LABEL_H = 80;
  const BOT_PAD = 65;

  // ─────────────────────────────
  // Palette LIGHT (Design System)
  // ─────────────────────────────

  const P = {

    // medaglie
    gold1: "#f5c542",
    gold2: "#d4a017",

    silver1: "#e5e7eb",
    silver2: "#9ca3af",

    bronze1: "#d4a373",
    bronze2: "#a47148",

    // glow molto soft
    goldGlow: "rgba(212,160,23,0.25)",
    silverGlow: "rgba(156,163,175,0.2)",
    bronzeGlow: "rgba(164,113,72,0.2)",

    // podio
    bar1st: "rgba(176,138,90,0.08)",
    bar2nd: "rgba(0,0,0,0.03)",
    bar3rd: "rgba(164,113,72,0.06)",

    barBorder: "#e1d8cc",

    // testo
    text: "#2f2a24",
    textBright: "#1f1b16",

    // brand
    brand: "#b08a5a",
    brandSoft: "rgba(176,138,90,0.12)",

    // label campione
    labelBg: "rgba(176,138,90,0.08)",
    labelBorder: "#b08a5a"
  };

  // ─────────────────────────────
  // SVG helpers
  // ─────────────────────────────

  function svgEl(tag, attrs, children = "") {
    const a = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    return `<${tag} ${a}>${children}</${tag}>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ─────────────────────────────
  // Gradients
  // ─────────────────────────────

  function gradients() {
    return `
<defs>

<linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
<stop offset="0%" stop-color="${P.gold1}"/>
<stop offset="100%" stop-color="${P.gold2}"/>
</linearGradient>

<linearGradient id="silverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
<stop offset="0%" stop-color="${P.silver1}"/>
<stop offset="100%" stop-color="${P.silver2}"/>
</linearGradient>

<linearGradient id="bronzeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
<stop offset="0%" stop-color="${P.bronze1}"/>
<stop offset="100%" stop-color="${P.bronze2}"/>
</linearGradient>

<filter id="shadow">
<feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.15"/>
</filter>

</defs>
`;
  }

  // ─────────────────────────────
  // Medaglia
  // ─────────────────────────────

  function medal(x, y, place) {

    let gradient;
    let glow;
    let emoji;

    if (place === 1) {
      gradient = "url(#goldGradient)";
      glow = P.goldGlow;
      emoji = "🥇";
    } else if (place === 2) {
      gradient = "url(#silverGradient)";
      glow = P.silverGlow;
      emoji = "🥈";
    } else {
      gradient = "url(#bronzeGradient)";
      glow = P.bronzeGlow;
      emoji = "🥉";
    }

    let o = "";

    o += svgEl("circle", {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2 + 10,
      fill: glow,
      opacity: 0.4
    });

    o += svgEl("circle", {
      cx: x,
      cy: y,
      r: MEDAL_SIZE / 2,
      fill: gradient,
      filter: "url(#shadow)"
    });

    o += svgEl(
      "text",
      {
        x: x,
        y: y + 10,
        "font-size": 46,
        "text-anchor": "middle"
      },
      emoji
    );

    return o;
  }

  // ─────────────────────────────
  // Logo
  // ─────────────────────────────

  function teamLogo(x, y, logoUrl) {

    let o = "";

    if (!logoUrl) {

      o += svgEl(
        "text",
        {
          x: x,
          y: y + 8,
          "font-size": 36,
          "text-anchor": "middle"
        },
        "👥"
      );

    } else {

      const clip = `clip-${Math.random()}`;

      o += `<clipPath id="${clip}">
<circle cx="${x}" cy="${y}" r="${LOGO_SIZE / 2}"/>
</clipPath>`;

      o += svgEl("image", {
        x: x - LOGO_SIZE / 2,
        y: y - LOGO_SIZE / 2,
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        href: logoUrl,
        "clip-path": `url(#${clip})`
      });
    }

    return o;
  }

  // ─────────────────────────────
  // Podio bar
  // ─────────────────────────────

  function podiumBar(x, y, w, h, place) {

    let color;

    if (place === 1) color = P.bar1st;
    else if (place === 2) color = P.bar2nd;
    else color = P.bar3rd;

    return svgEl("rect", {
      x: x,
      y: y,
      width: w,
      height: h,
      rx: 8,
      fill: color,
      stroke: P.barBorder,
      "stroke-width": 1.5,
      filter: "url(#shadow)"
    });
  }

  // ─────────────────────────────
  // Singolo posto
  // ─────────────────────────────

  function place(x, baseY, team, placeN, logo) {

    let height;

    if (placeN === 1) height = BAR_HEIGHT_1ST;
    else if (placeN === 2) height = BAR_HEIGHT_2ND;
    else height = BAR_HEIGHT_3RD;

    const barY = baseY - height;
    const cx = x + PLACE_W / 2;

    let o = "";

    o += podiumBar(x, barY, PLACE_W, height, placeN);

    const logoY = barY + height / 2 - 15;

    o += teamLogo(cx, logoY, logo);

    const nameY = logoY + LOGO_SIZE / 2 + 35;

    o += svgEl(
      "text",
      {
        x: cx,
        y: nameY,
        fill: P.textBright,
        "font-size": 24,
        "font-weight": "700",
        "text-anchor": "middle"
      },
      esc(team.team_name)
    );

    const medalY = barY - MEDAL_SIZE / 2 - 28;

    o += medal(cx, medalY, placeN);

    return o;
  }

  // ─────────────────────────────
  // Champion label 
  // ─────────────────────────────

  function championLabel(x, y, width, name) {

    const w = width * 0.7;
    const lx = x + (width - w) / 2;

    let o = "";

    o += svgEl("rect", {
      x: lx,
      y: y,
      width: w,
      height: LABEL_H,
      rx: 28,
      fill: P.labelBg,
      stroke: P.labelBorder,
      "stroke-width": 1.5
    });

    o += svgEl(
      "text",
      {
        x: lx + 40,
        y: y + LABEL_H / 2 + 7,
        "font-size": 24
      },
      "🏆"
    );

    o += svgEl(
      "text",
      {
        x: lx + w / 2,
        y: y + LABEL_H / 2 - 6,
        fill: P.brand,
        "font-size": 18,
        "font-weight": "800",
        "text-anchor": "middle",
        "letter-spacing": "0.18em"
      },
      "CAMPIONE"
    );

    o += svgEl(
      "text",
      {
        x: lx + w / 2,
        y: y + LABEL_H / 2 + 24,
        fill: P.text,
        "font-size": 24,
        "font-weight": "700",
        "text-anchor": "middle"
      },
      esc(name)
    );

    return o;
  }

  // ─────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────

  window.renderPodiumSVG = function (podiumData, container) {

    container.innerHTML = "";

    const { standings, teamsLogosMap } = podiumData;

    if (!standings?.length) {
      container.innerHTML =
        "<p class='placeholder'>Nessun dato disponibile</p>";
      return;
    }

    const sorted = [...standings].sort(
      (a, b) => (a.rank_level || 99) - (b.rank_level || 99)
    );

    const top3 = sorted.slice(0, 3);

    const baseY = PODIUM_H - BOT_PAD;
    const svgH = PODIUM_H + LABEL_H + 60;

    let body = "";

    body += gradients();

    const CENTER = PODIUM_W / 2;

    const pos = [
      {
        t: top3[1],
        p: 2,
        x: CENTER - PLACE_W - PLACE_GAP - PLACE_W / 2
      },
      {
        t: top3[0],
        p: 1,
        x: CENTER - PLACE_W / 2
      },
      {
        t: top3[2],
        p: 3,
        x: CENTER + PLACE_W / 2 + PLACE_GAP
      }
    ];

    pos.forEach(i => {
      if (!i.t) return;
      const logo = teamsLogosMap?.[i.t.team_id] || null;
      body += place(i.x, baseY, i.t, i.p, logo);
    });

    const champ = top3[0]?.team_name || "TBD";

    body += championLabel(0, baseY + 55, PODIUM_W, champ);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
width="${PODIUM_W}"
height="${svgH}"
viewBox="0 0 ${PODIUM_W} ${svgH}"
style="display:block;margin:0 auto;">${body}</svg>`;

    const wrap = document.createElement("div");
    wrap.className = "podium-svg-wrapper";
    wrap.innerHTML = svg;

    container.appendChild(wrap);
  };

})();