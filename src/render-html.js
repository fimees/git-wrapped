'use strict';

const { esc, fmt, compact, hourLabel } = require('./util');
const { renderSvg, heatmapSvg } = require('./render-svg');
const { WEEKDAYS } = require('./analyze');

function summaryText(s) {
  return (
    `My ${s.year} in git: ${fmt(s.commits)} commits, ${fmt(s.activeDays)} active days, ` +
    `a ${s.streak.len}-day streak, +${compact(s.lines.add)}/−${compact(s.lines.del)} lines. ` +
    `I'm ${s.persona.name} ${s.persona.emoji}  #gitwrapped  →  npx git-wrapped`
  );
}

const CSS = `
*{box-sizing:border-box;margin:0}
html{scroll-snap-type:y mandatory;scroll-behavior:smooth}
body{font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#fff;background:#0b0a1f}
.slide{min-height:100vh;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:center;align-items:center;
  text-align:center;padding:48px 24px;gap:14px;
  background:radial-gradient(1200px 700px at 80% 0%,hsl(calc(var(--h) + 50) 80% 30% / .55),transparent 60%),
  linear-gradient(160deg,hsl(var(--h) 60% 16%),hsl(calc(var(--h) + 40) 60% 7%))}
.slide>*{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
.slide.in>*{opacity:1;transform:none}
.slide.in>*:nth-child(2){transition-delay:.12s}.slide.in>*:nth-child(3){transition-delay:.24s}
.slide.in>*:nth-child(4){transition-delay:.36s}.slide.in>*:nth-child(5){transition-delay:.48s}
.kicker{letter-spacing:.28em;text-transform:uppercase;font-size:14px;color:#c9c6ff}
.big{font-size:clamp(64px,16vw,190px);font-weight:900;line-height:1.05;letter-spacing:-.04em;padding:0 .08em;
  background:linear-gradient(90deg,#fff,#f0b6ff 60%,#a06bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.emoji{font-size:clamp(48px,8vw,84px);line-height:1}
.mid{font-size:clamp(28px,5vw,56px);font-weight:800;letter-spacing:-.02em}
.sub{font-size:clamp(16px,2.2vw,22px);color:#d4d1ff;max-width:640px;line-height:1.45}
.add{color:#6ee7a8}.del{color:#ff8a9b}
.chart{display:flex;align-items:flex-end;gap:6px;height:220px;width:min(760px,92vw)}
.chart .b{flex:1;background:linear-gradient(#f0b6ff,#6d4fe0);border-radius:6px 6px 0 0;min-height:3px;transform-origin:bottom;transform:scaleY(0);transition:transform .9s cubic-bezier(.2,.8,.2,1)}
.slide.in .chart .b{transform:scaleY(1)}
.axis{display:flex;justify-content:space-between;width:min(760px,92vw);font-size:13px;color:#a9a5ee}
.rows{width:min(640px,92vw);display:flex;flex-direction:column;gap:10px;text-align:left}
.row{display:grid;grid-template-columns:110px 1fr 56px;align-items:center;gap:12px;font-size:16px}
.row .t{height:16px;border-radius:8px;background:rgba(255,255,255,.08);overflow:hidden}
.row .t i{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#6d4fe0,#f0b6ff);transition:width 1s cubic-bezier(.2,.8,.2,1)}
.slide.in .row .t i{width:var(--w)}
.row span:last-child{color:#b9b4f5;text-align:right;font-size:14px}
.files{width:min(680px,92vw);text-align:left;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;display:flex;flex-direction:column;gap:8px}
.files div{display:flex;justify-content:space-between;gap:16px;background:rgba(255,255,255,.07);padding:10px 14px;border-radius:12px}
.files b{color:#f0b6ff;white-space:nowrap}
.cloud{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;max-width:820px;line-height:1.1}
.cloud span{font-weight:800;color:#e6d9ff}
.pills{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.pill{background:rgba(255,255,255,.1);padding:8px 16px;border-radius:999px;font-size:15px}
.card{width:min(980px,94vw)}.card svg{width:100%;height:auto;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.btns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.btn{cursor:pointer;border:0;font:inherit;font-weight:700;color:#0b0a1f;background:#fff;padding:12px 22px;border-radius:999px;text-decoration:none}
.btn.alt{background:rgba(255,255,255,.14);color:#fff}
.hm{width:min(980px,94vw)}.hm svg{width:100%;height:auto}
.foot{font-size:13px;color:#8f89e8;margin-top:8px}
@media(prefers-reduced-motion:reduce){.slide>*{transition:none;opacity:1;transform:none}.chart .b{transform:none;transition:none}.row .t i{width:var(--w);transition:none}}
`;

const JS = `
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');
e.target.querySelectorAll('.num').forEach(count);}})},{threshold:.15});
document.querySelectorAll('.slide').forEach(function(s){io.observe(s)});
function count(el){if(el.dataset.done)return;el.dataset.done=1;var to=+el.dataset.to,t0=performance.now(),d=1100;
(function f(t){var p=Math.min(1,(t-t0)/d);el.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString('en-US');if(p<1)requestAnimationFrame(f)})(t0)}
function copySummary(btn){navigator.clipboard.writeText(SUMMARY).then(function(){btn.textContent='Copied ✓'})}
`;

function renderHtml(s, { name } = {}) {
  const who = esc(name || s.name || '');
  const slides = [];
  const S = (hue, inner) =>
    slides.push(`<section class="slide" id="s${slides.length + 1}" style="--h:${hue}">${inner}</section>`);
  const num = (n) => `<span class="num" data-to="${n}">${fmt(n)}</span>`;

  S(265, `<div class="kicker">git wrapped</div><div class="big">${s.year}</div>
    <div class="mid">${who ? who + ', here' : 'Here'} is your year in git.</div>
    <div class="sub">Scroll down ↓ &nbsp;·&nbsp; computed locally, nothing left your machine.</div>`);

  S(285, `<div class="kicker">you made</div><div class="big">${num(s.commits)}</div>
    <div class="mid">commits</div>
    <div class="sub">across ${fmt(s.activeDays)} active days${s.activeDays ? ` — about ${(s.commits / s.activeDays).toFixed(1)} per day you showed up` : ''}.</div>`);

  S(160, `<div class="kicker">you wrote</div><div class="big add">+${num(s.lines.add)}</div>
    <div class="mid del">−${num(s.lines.del)}</div>
    <div class="sub">lines across ${fmt(s.filesTouched)} files. Lockfiles and build output excluded.</div>`);

  S(20, `<div class="kicker">longest streak</div><div class="big">${num(s.streak.len)}</div>
    <div class="mid">day${s.streak.len === 1 ? '' : 's'} in a row</div>
    <div class="sub">${s.streak.start ? `${esc(s.streak.start)} → ${esc(s.streak.end)}` : ''}${s.busiestDay ? ` &nbsp;·&nbsp; busiest day: ${esc(s.busiestDay.day)} (${s.busiestDay.count} commits)` : ''}</div>`);

  const hmax = Math.max(...s.byHour, 1);
  S(230, `<div class="kicker">when you code</div><div class="mid">Your peak hour is ${hourLabel(s.peakHour)}</div>
    <div class="chart">${s.byHour.map((v, h) => `<div class="b" title="${hourLabel(h)} · ${v}" style="height:${Math.max(1, (v / hmax) * 100)}%"></div>`).join('')}</div>
    <div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <div class="sub">Favorite day: <b>${s.peakWeekday}</b> · best month: <b>${s.peakMonth}</b></div>`);

  const wmax = Math.max(...s.byWeekday, 1);
  S(210, `<div class="kicker">your week</div><div class="mid">${s.peakWeekday}s are your day</div>
    <div class="rows">${[1, 2, 3, 4, 5, 6, 0]
      .map((i) => `<div class="row"><span>${WEEKDAYS[i]}</span><div class="t"><i style="--w:${(s.byWeekday[i] / wmax) * 100}%"></i></div><span>${s.byWeekday[i]}</span></div>`)
      .join('')}</div>`);

  S(300, `<div class="kicker">your year at a glance</div><div class="mid">${fmt(s.activeDays)} days of shipping</div>
    <div class="hm"><svg viewBox="0 0 ${s.heatmap.cols * 15} 102" xmlns="http://www.w3.org/2000/svg">${heatmapSvg(s)}</svg></div>`);

  if (s.languages.length) {
    const lmax = s.languages[0].lines;
    const ltot = s.languages.reduce((a, l) => a + l.lines, 0);
    S(180, `<div class="kicker">top language</div><div class="big" style="font-size:clamp(48px,11vw,130px)">${esc(s.languages[0].name)}</div>
      <div class="rows">${s.languages
        .map((l) => `<div class="row"><span>${esc(l.name)}</span><div class="t"><i style="--w:${(l.lines / lmax) * 100}%"></i></div><span>${Math.round((l.lines / ltot) * 100)}%</span></div>`)
        .join('')}</div>`);
  }

  if (s.topFiles.length) {
    S(35, `<div class="kicker">you keep coming back to</div><div class="mid">${esc(s.topFiles[0].file.split('/').pop())}</div>
      <div class="files">${s.topFiles.map((f) => `<div><span>${esc(f.file)}</span><b>${f.commits}×</b></div>`).join('')}</div>`);
  }

  if (s.topWords.length) {
    const wmaxN = s.topWords[0].n;
    S(330, `<div class="kicker">your vocabulary</div><div class="mid">What you talk about in commits</div>
      <div class="cloud">${s.topWords.map((w) => `<span style="font-size:${14 + Math.round((w.n / wmaxN) * 38)}px">${esc(w.word)}</span>`).join('')}</div>
      ${s.types.length ? `<div class="pills">${s.types.map((t) => `<span class="pill">${esc(t.type)} · ${t.n}</span>`).join('')}</div>` : ''}`);
  }

  S(0, `<div class="kicker">hall of fame · shame</div>
    ${s.biggest && s.biggest.add + s.biggest.del > 0 ? `<div class="mid">Biggest commit: <span class="add">+${compact(s.biggest.add)}</span> <span class="del">−${compact(s.biggest.del)}</span></div><div class="sub">“${esc(s.biggest.subject)}” — ${esc(s.biggest.repo)}, ${esc(s.biggest.day)}</div>` : ''}
    <div class="mid">${s.lazy} lazy commit messages</div><div class="sub">“wip”, “fix”, “.” — we all have those days.</div>`);

  const svg = renderSvg(s, { name });
  S(265, `<div class="kicker">your persona</div><div class="emoji">${s.persona.emoji}</div><div class="big" style="font-size:clamp(40px,9vw,100px)">${esc(s.persona.name)}</div>
    <div class="sub">${esc(s.persona.blurb)}</div>
    <div class="card">${svg}</div>
    <div class="btns"><a class="btn" download="git-wrapped-${s.year}.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">Download card</a>
    <button class="btn alt" onclick="copySummary(this)">Copy summary</button></div>
    <div class="foot">Made with <b>git-wrapped</b> · run <code>npx git-wrapped</code> on your own repos</div>`);

  const summary = JSON.stringify(summaryText(s)).replace(/</g, '\\u003c');
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>git wrapped ${s.year}${who ? ' · ' + who : ''}</title><style>${CSS}</style></head><body>${slides.join('')}` +
    `<script>var SUMMARY=${summary};${JS}</script></body></html>`
  );
}

module.exports = { renderHtml, summaryText };
