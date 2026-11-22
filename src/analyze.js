'use strict';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Lockfiles, minified bundles and build output would drown out real work.
const IGNORE_FILE =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|go\.sum|Gemfile\.lock|composer\.lock)$|\.min\.(js|css)$|\.map$|(^|\/)(node_modules|dist|build|vendor|\.next)\//;

const LANGS = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', rs: 'Rust', go: 'Go',
  java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', cs: 'C#',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', html: 'HTML', css: 'CSS', scss: 'CSS',
  md: 'Markdown', json: 'JSON', yml: 'YAML', yaml: 'YAML', toml: 'TOML',
  sql: 'SQL', vue: 'Vue', svelte: 'Svelte', lua: 'Lua', dart: 'Dart',
  ex: 'Elixir', exs: 'Elixir', zig: 'Zig', hs: 'Haskell', scala: 'Scala',
  r: 'R', tf: 'Terraform', dockerfile: 'Docker',
};
const NONCODE = new Set(['Markdown', 'JSON', 'YAML', 'TOML']);

const STOP = new Set(
  ('the and for with from into this that them then than are was were has had have not but you your our out use used using ' +
    'add added adds new via per all any can its it\'s too more less one two get got set make made fix fixes fixed ' +
    'update updates updated remove removed change changed changes').split(' ')
);
const LAZY = new Set([
  'wip', 'fix', 'fixes', 'update', 'updates', 'test', 'tests', 'stuff', 'changes', 'misc', 'temp', 'tmp',
  '.', 'asdf', 'minor', 'cleanup', 'oops', 'typo', 'fix again', 'try again', 'more changes', 'fixes',
]);
const CC_TYPES = new Set([
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'tests', 'build', 'ci', 'chore', 'revert',
]);

const DAY_MS = 86400000;
const dayNum = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}
function top(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n);
}
function extOf(file) {
  const base = file.split('/').pop();
  const i = base.lastIndexOf('.');
  if (i <= 0) return base === 'Dockerfile' ? 'dockerfile' : '';
  return base.slice(i + 1).toLowerCase();
}

function buildHeatmap(year, byDay) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  const offset = new Date(start).getUTCDay(); // Sunday-first columns, like GitHub
  let max = 0;
  for (const v of byDay.values()) if (v > max) max = v;
  const cells = [];
  const months = [];
  let i = 0;
  for (let t = start; t <= end; t += DAY_MS, i++) {
    const d = new Date(t);
    const date = d.toISOString().slice(0, 10);
    const count = byDay.get(date) || 0;
    const col = Math.floor((offset + i) / 7);
    const row = (offset + i) % 7;
    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
    cells.push({ date, count, col, row, level });
    if (d.getUTCDate() === 1) months.push({ col, label: MONTHS[d.getUTCMonth()] });
  }
  return { cells, months, cols: Math.floor((offset + i - 1) / 7) + 1 };
}

function pickPersona(s) {
  const pct = (x) => Math.round(x * 100);
  if (s.streak.len >= 30)
    return { id: 'streak', emoji: '🔥', name: 'The Streak Machine', blurb: `${s.streak.len} days in a row. Please touch grass. (Then commit.)` };
  if (s.share.night >= 0.35)
    return { id: 'owl', emoji: '🦉', name: 'The Night Owl', blurb: `${pct(s.share.night)}% of your commits land between 10pm and 4am. The bugs fear you.` };
  if (s.share.morning >= 0.3)
    return { id: 'bird', emoji: '🌅', name: 'The Early Bird', blurb: `${pct(s.share.morning)}% of your commits land before 9am. Coffee is a build dependency.` };
  if (s.share.weekend >= 0.4)
    return { id: 'weekend', emoji: '⚔️', name: 'The Weekend Warrior', blurb: `${pct(s.share.weekend)}% of your commits happen on weekends. Side projects don't ship themselves.` };
  if (s.lines.add + s.lines.del > 100 && s.lines.del > s.lines.add * 0.9)
    return { id: 'janitor', emoji: '🧹', name: 'The Janitor', blurb: 'You delete almost as much as you write. The best code is no code.' };
  if (s.fixShare >= 0.4)
    return { id: 'fire', emoji: '🚒', name: 'The Firefighter', blurb: `${pct(s.fixShare)}% of your commits are fixes. Somebody has to put out the fires.` };
  if (s.activeDays > 0 && s.commits / s.activeDays >= 6)
    return { id: 'committer', emoji: '⚡', name: 'The Rapid Committer', blurb: `${(s.commits / s.activeDays).toFixed(1)} commits per active day. Small steps, constant motion.` };
  return { id: 'steady', emoji: '🚢', name: 'The Steady Shipper', blurb: 'Consistent, calm, shipping. The backbone of every good team.' };
}

function analyze(allCommits, opts = {}) {
  const year = Number(opts.year);
  const commits = allCommits.filter((c) => c.day.startsWith(year + '-'));

  const byDay = new Map();
  const byHour = new Array(24).fill(0);
  const byWeekday = new Array(7).fill(0);
  const byMonth = new Array(12).fill(0);
  const files = new Map();
  const langs = new Map();
  const types = new Map();
  const words = new Map();
  const repos = new Map();
  const lines = { add: 0, del: 0 };
  let biggest = null;
  let longest = null;
  let lazy = 0;
  let fixes = 0;
  const filesTouched = new Set();

  for (const c of commits) {
    inc(byDay, c.day);
    byHour[c.hour]++;
    const [y, m, d] = c.day.split('-').map(Number);
    byWeekday[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]++;
    byMonth[m - 1]++;
    inc(repos, c.repo);

    let cAdd = 0;
    let cDel = 0;
    for (const f of c.files) {
      if (IGNORE_FILE.test(f.file)) continue;
      cAdd += f.add;
      cDel += f.del;
      inc(files, f.file);
      filesTouched.add(f.file);
      const lang = LANGS[extOf(f.file)];
      if (lang) inc(langs, lang, f.add + f.del);
    }
    lines.add += cAdd;
    lines.del += cDel;
    if (!biggest || cAdd + cDel > biggest.add + biggest.del) {
      biggest = { subject: c.subject, repo: c.repo, day: c.day, add: cAdd, del: cDel };
    }

    const subj = c.subject.trim();
    if (!longest || subj.length > longest.subject.length) longest = { subject: subj, day: c.day, repo: c.repo };
    if (LAZY.has(subj.toLowerCase()) || subj.length <= 3) lazy++;

    const m2 = subj.match(/^(\w+)(\([^)]*\))?!?:\s*(.*)$/);
    const type = m2 ? m2[1].toLowerCase() : null;
    const text = m2 && CC_TYPES.has(type) ? m2[3] : subj;
    if (type && CC_TYPES.has(type)) inc(types, type === 'tests' ? 'test' : type);
    if ((type === 'fix') || /^fix(e[sd])?\b/i.test(subj)) fixes++;
    for (const w of text.toLowerCase().match(/\p{L}[\p{L}'-]{2,}/gu) || []) {
      if (!STOP.has(w)) inc(words, w);
    }
  }

  const days = [...byDay.keys()].sort();
  let streak = { len: 0, start: null, end: null };
  let runStart = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && dayNum(days[i]) - dayNum(days[i - 1]) !== 1) runStart = i;
    const len = i - runStart + 1;
    if (len > streak.len) streak = { len, start: days[runStart], end: days[i] };
  }

  let busiestDay = null;
  for (const [day, count] of byDay) if (!busiestDay || count > busiestDay.count) busiestDay = { day, count };

  const total = commits.length;
  const share = {
    night: total ? [22, 23, 0, 1, 2, 3].reduce((a, h) => a + byHour[h], 0) / total : 0,
    morning: total ? [5, 6, 7, 8].reduce((a, h) => a + byHour[h], 0) / total : 0,
    weekend: total ? (byWeekday[0] + byWeekday[6]) / total : 0,
  };

  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakWeekday = byWeekday.indexOf(Math.max(...byWeekday));
  const peakMonth = byMonth.indexOf(Math.max(...byMonth));

  let langList = top(langs, 20);
  const codeLangs = langList.filter(([l]) => !NONCODE.has(l));
  if (codeLangs.length) langList = codeLangs;

  const s = {
    year,
    name: opts.name || '',
    commits: total,
    activeDays: days.length,
    lines,
    filesTouched: filesTouched.size,
    streak,
    busiestDay,
    byHour,
    byWeekday,
    byMonth,
    peakHour,
    peakWeekday: WEEKDAYS[peakWeekday],
    peakMonth: MONTHS[peakMonth],
    share,
    fixShare: total ? fixes / total : 0,
    lazy,
    biggest,
    longest,
    languages: langList.slice(0, 6).map(([name, n]) => ({ name, lines: n })),
    topFiles: top(files, 5).map(([file, n]) => ({ file, commits: n })),
    topWords: top(words, 24).map(([word, n]) => ({ word, n })),
    types: top(types, 6).map(([type, n]) => ({ type, n })),
    repos: top(repos, 5).map(([repo, n]) => ({ repo, commits: n })),
    first: days[0] || null,
    last: days[days.length - 1] || null,
    heatmap: buildHeatmap(year, byDay),
  };
  s.persona = pickPersona(s);
  return s;
}

module.exports = { analyze, WEEKDAYS, MONTHS };
