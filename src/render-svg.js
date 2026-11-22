'use strict';

const { esc, fmt, compact, trunc } = require('./util');

const PALETTE = ['rgba(255,255,255,0.08)', '#4c3a9e', '#6d4fe0', '#a06bff', '#f0b6ff'];

function heatmapSvg(s, { cell = 12, gap = 3, x = 0, y = 0, palette = PALETTE } = {}) {
  let out = '';
  for (const c of s.heatmap.cells) {
    out += `<rect x="${x + c.col * (cell + gap)}" y="${y + c.row * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${palette[c.level]}"/>`;
  }
  return out;
}

function renderSvg(s, { name } = {}) {
  const W = 1200;
  const H = 630;
  const who = esc(trunc(name || s.name || '', 30));
  const font = "font-family=\"-apple-system, 'Segoe UI', Inter, Helvetica, Arial, sans-serif\"";

  const tiles = [
    [fmt(s.commits), 'commits'],
    [fmt(s.activeDays), 'active days'],
    [`${s.streak.len}d`, 'longest streak'],
    [compact(s.lines.add + s.lines.del), 'lines changed'],
  ];
  const tileSvg = tiles
    .map(([v, l], i) => {
      const x = 60 + i * 270;
      return (
        `<rect x="${x}" y="300" width="250" height="112" rx="22" fill="rgba(255,255,255,0.07)"/>` +
        `<text x="${x + 26}" y="362" ${font} font-size="52" font-weight="800" fill="#fff">${esc(v)}</text>` +
        `<text x="${x + 26}" y="394" ${font} font-size="20" fill="#b9b4f5">${esc(l)}</text>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="git wrapped ${s.year}">` +
    `<defs><linearGradient id="gw-bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#0f0c29"/><stop offset="0.55" stop-color="#302b63"/><stop offset="1" stop-color="#24243e"/></linearGradient>` +
    `<radialGradient id="gw-glow" cx="0.85" cy="0.1" r="0.6"><stop offset="0" stop-color="#ff5ecb" stop-opacity="0.35"/><stop offset="1" stop-color="#ff5ecb" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#gw-bg)"/><rect width="${W}" height="${H}" fill="url(#gw-glow)"/>` +
    `<text x="1140" y="120" text-anchor="end" ${font} font-size="120" font-weight="900" fill="rgba(255,255,255,0.07)">${s.year}</text>` +
    `<text x="60" y="76" ${font} font-size="26" font-weight="700" letter-spacing="3" fill="#c9c6ff">GIT WRAPPED${who ? ' · ' + who.toUpperCase() : ''}</text>` +
    `<text x="60" y="150" ${font} font-size="22" letter-spacing="4" fill="#8f89e8">YOU ARE</text>` +
    `<text x="60" y="226" ${font} font-size="68" font-weight="900" fill="#fff">${esc(s.persona.name)}</text>` +
    `<text x="60" y="270" ${font} font-size="25" fill="#c9c6ff">${esc(trunc(s.persona.blurb, 78))}</text>` +
    tileSvg +
    heatmapSvg(s, { x: 60, y: 452, cell: 12, gap: 3 }) +
    `<text x="1140" y="590" text-anchor="end" ${font} font-size="20" fill="#8f89e8">npx git-wrapped</text>` +
    `</svg>`
  );
}

module.exports = { renderSvg, heatmapSvg, PALETTE };
