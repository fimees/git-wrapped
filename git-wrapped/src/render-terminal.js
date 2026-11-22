'use strict';

const { fmt, compact, trunc } = require('./util');
const { MONTHS } = require('./analyze');

function renderTerminal(s, { color = true } = {}) {
  const sgr = (code, t) => (color ? `\x1b[${code}m${t}\x1b[0m` : t);
  const fg = (n, t) => (color ? `\x1b[38;5;${n}m${t}\x1b[0m` : t);
  const bold = (t) => sgr('1', t);
  const dim = (t) => sgr('2', t);
  const accent = (t) => fg(141, t);
  const green = (t) => fg(78, t);
  const red = (t) => fg(203, t);

  const bar = (v, max, w = 22) => {
    if (!v || !max) return '';
    return '█'.repeat(Math.max(1, Math.round((v / max) * w)));
  };
  const spark = (arr) => {
    const max = Math.max(...arr, 1);
    const blocks = '▁▂▃▄▅▆▇█';
    return arr.map((v) => (v === 0 ? ' ' : blocks[Math.min(7, Math.floor((v / max) * 7.999))])).join('');
  };

  const out = [];
  const h = (t) => out.push('', bold(accent(t)));
  const who = s.name ? ` · ${s.name}` : '';

  out.push('');
  out.push(bold(accent(`  ╭─ git wrapped ${s.year}`)) + dim(who));
  out.push(dim('  ╰─ computed locally from your git history. nothing leaves your machine.'));

  h('The numbers');
  out.push(`  ${bold(fmt(s.commits))} commits across ${bold(fmt(s.activeDays))} active days`);
  out.push(
    `  ${green('+' + fmt(s.lines.add))} ${red('−' + fmt(s.lines.del))} lines · ${fmt(s.filesTouched)} files touched`
  );
  if (s.streak.len > 1) out.push(`  longest streak: ${bold(s.streak.len + ' days')} ${dim(`(${s.streak.start} → ${s.streak.end})`)}`);
  if (s.busiestDay) out.push(`  busiest day: ${bold(s.busiestDay.day)} with ${bold(s.busiestDay.count)} commits`);

  h('Contribution map');
  const { cells, months, cols } = s.heatmap;
  const glyph = color ? ['\x1b[38;5;238m■\x1b[0m', '\x1b[38;5;54m■\x1b[0m', '\x1b[38;5;98m■\x1b[0m', '\x1b[38;5;135m■\x1b[0m', '\x1b[38;5;219m■\x1b[0m'] : ['·', '░', '▒', '▓', '█'];
  const grid = Array.from({ length: 7 }, () => new Array(cols).fill(' '));
  for (const c of cells) grid[c.row][c.col] = glyph[c.level];
  const header = new Array(cols * 2 + 2).fill(' ');
  let lastEnd = -1;
  for (const m of months) {
    const pos = m.col * 2;
    if (pos > lastEnd) {
      for (let i = 0; i < m.label.length; i++) header[pos + i] = m.label[i];
      lastEnd = pos + m.label.length;
    }
  }
  out.push('  ' + dim(header.join('').trimEnd()));
  for (const row of grid) out.push('  ' + row.join(' '));

  h('When you code');
  out.push(`  ${spark(s.byHour)}`);
  out.push(dim('  ' + '0'.padEnd(6) + '6'.padEnd(6) + '12'.padEnd(6) + '18'));
  out.push(`  peak hour: ${bold(String(s.peakHour).padStart(2, '0') + ':00')} · favorite day: ${bold(s.peakWeekday)} · best month: ${bold(s.peakMonth)}`);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wmax = Math.max(...s.byWeekday, 1);
  for (const i of order) out.push(`  ${names[i]} ${accent(bar(s.byWeekday[i], wmax))} ${dim(s.byWeekday[i])}`);

  if (s.languages.length) {
    h('Languages (by lines changed)');
    const lmax = s.languages[0].lines;
    const ltot = s.languages.reduce((a, l) => a + l.lines, 0);
    for (const l of s.languages) {
      out.push(`  ${l.name.padEnd(12)} ${accent(bar(l.lines, lmax))} ${dim(Math.round((l.lines / ltot) * 100) + '%')}`);
    }
  }

  if (s.topFiles.length) {
    h('Most-edited files');
    for (const f of s.topFiles) out.push(`  ${String(f.commits).padStart(4)}×  ${trunc(f.file, 60)}`);
  }

  if (s.types.length) {
    h('Commit types');
    out.push('  ' + s.types.map((t) => `${t.type} ${dim(t.n)}`).join('   '));
  }
  if (s.topWords.length) {
    h('Your vocabulary');
    out.push('  ' + s.topWords.slice(0, 10).map((w) => w.word).join(' · '));
  }

  h('Hall of fame / shame');
  if (s.biggest && s.biggest.add + s.biggest.del > 0)
    out.push(`  biggest commit: ${green('+' + compact(s.biggest.add))} ${red('−' + compact(s.biggest.del))} "${trunc(s.biggest.subject, 50)}"`);
  if (s.longest) out.push(`  longest message: ${s.longest.subject.length} chars`);
  out.push(`  lazy messages ("wip", "fix", "."): ${bold(s.lazy)}`);

  out.push('');
  out.push(bold(`  ${s.persona.emoji}  You are ${s.persona.name}`));
  out.push(dim(`     ${s.persona.blurb}`));
  out.push('');
  out.push(dim('  share it: git-wrapped --format html,svg'));
  out.push('');
  return out.join('\n');
}

module.exports = { renderTerminal };
