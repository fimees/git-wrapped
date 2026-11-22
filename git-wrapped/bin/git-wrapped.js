#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { collect, isRepo, defaultAuthor, findRepos, repoName } = require('../src/collect');
const { analyze } = require('../src/analyze');
const { renderTerminal } = require('../src/render-terminal');
const { renderSvg } = require('../src/render-svg');
const { renderHtml } = require('../src/render-html');

const HELP = `
git-wrapped ${pkg.version} — your year in git, Spotify-Wrapped style.

Usage
  git-wrapped [repo ...] [options]

Options
  -y, --year <YYYY>      year to analyze (default: current year)
      --author <email>   only count this author (default: your git user.email)
      --all-authors      count every author in the repo(s)
      --name <name>      display name on the card
      --scan <dir>       find every git repo under <dir> (depth 3) and combine them
  -f, --format <list>    terminal,html,svg,json or "all" (default: terminal)
  -o, --out <dir>        where to write files (default: ./git-wrapped-<year>)
      --no-color         disable colors
  -h, --help             show this help
  -v, --version          show version

Examples
  git-wrapped                          # this repo, your commits, this year
  git-wrapped --scan ~/code -f all     # all your projects, every output
  git-wrapped --year 2025 --all-authors
`;

function die(msg) {
  console.error(`git-wrapped: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const o = { repos: [], formats: ['terminal'], year: new Date().getFullYear(), all: false, color: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`missing value for ${a}`);
      return argv[++i];
    };
    switch (a) {
      case '-h': case '--help': o.help = true; break;
      case '-v': case '--version': o.version = true; break;
      case '-y': case '--year': o.year = parseInt(next(), 10); break;
      case '--author': o.author = next(); break;
      case '--all-authors': o.all = true; break;
      case '--name': o.name = next(); break;
      case '--scan': o.scan = next(); break;
      case '-f': case '--format': o.formats = next().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '-o': case '--out': o.out = next(); break;
      case '--no-color': o.color = false; break;
      default:
        if (a.startsWith('-')) die(`unknown option ${a} (try --help)`);
        o.repos.push(a);
    }
  }
  if (o.formats.includes('all')) o.formats = ['terminal', 'html', 'svg', 'json'];
  for (const f of o.formats) if (!['terminal', 'html', 'svg', 'json'].includes(f)) die(`unknown format "${f}"`);
  if (!Number.isInteger(o.year) || o.year < 1990 || o.year > 2100) die('invalid --year');
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return console.log(HELP);
  if (o.version) return console.log(pkg.version);

  let repos = o.scan ? findRepos(o.scan) : o.repos.length ? o.repos : ['.'];
  repos = repos.filter((r) => {
    const ok = isRepo(r);
    if (!ok) console.error(`git-wrapped: skipping ${r} (not a git repository)`);
    return ok;
  });
  if (!repos.length) die('no git repositories found');

  let author = o.author;
  if (!o.all && !author) {
    author = defaultAuthor(repos[0]);
    if (!author) console.error('git-wrapped: no user.email configured, counting all authors');
  }

  const seen = new Set();
  const commits = [];
  for (const r of repos) {
    for (const c of collect(r, { year: o.year, author: o.all ? '' : author })) {
      if (seen.has(c.hash)) continue;
      seen.add(c.hash);
      commits.push(c);
    }
  }

  const inYear = commits.filter((c) => c.day.startsWith(o.year + '-'));
  if (!inYear.length) {
    console.log(`No commits found for ${o.all || !author ? 'anyone' : author} in ${o.year}. Try --year or --all-authors.`);
    return;
  }

  let name = o.name;
  if (!name) {
    if (o.all || !author) name = repos.length === 1 ? repoName(repos[0]) : '';
    else {
      const counts = new Map();
      for (const c of inYear) counts.set(c.author, (counts.get(c.author) || 0) + 1);
      name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  const stats = analyze(commits, { year: o.year, name });
  const color = o.color && !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);

  if (o.formats.includes('terminal')) console.log(renderTerminal(stats, { color }));

  const files = [];
  const outDir = path.resolve(o.out || `git-wrapped-${o.year}`);
  const write = (file, content) => {
    fs.mkdirSync(outDir, { recursive: true });
    const p = path.join(outDir, file);
    fs.writeFileSync(p, content);
    files.push(p);
  };
  if (o.formats.includes('html')) write('wrapped.html', renderHtml(stats));
  if (o.formats.includes('svg')) write('wrapped-card.svg', `<?xml version="1.0" encoding="UTF-8"?>\n${renderSvg(stats)}\n`);
  if (o.formats.includes('json')) {
    const { heatmap, ...rest } = stats;
    write('wrapped.json', JSON.stringify(rest, null, 2) + '\n');
  }
  for (const f of files) console.log(`saved ${f}`);
}

try {
  main();
} catch (e) {
  die(e.message || String(e));
}
