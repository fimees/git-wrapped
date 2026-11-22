'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isRepo(repo) {
  try {
    return git(repo, ['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
}

function defaultAuthor(repo) {
  try {
    return git(repo, ['config', 'user.email']).trim();
  } catch {
    return '';
  }
}

function repoName(repo) {
  try {
    return path.basename(git(repo, ['rev-parse', '--show-toplevel']).trim());
  } catch {
    return path.basename(path.resolve(repo));
  }
}

// "src/{old => new}/f.js" and "old.js => new.js" both become the new path.
function cleanPath(p) {
  return p
    .replace(/\{([^}]*) => ([^}]*)\}/g, '$2')
    .replace(/^.* => /, '')
    .replace(/\/\//g, '/');
}

function collect(repo, { year, author }) {
  const y = Number(year);
  const args = [
    'log',
    '--all',
    '--no-merges',
    '--numstat',
    '--date=iso-strict',
    // widen the window a little, exact filtering happens on the author date
    `--since=${y - 1}-12-30`,
    `--until=${y + 1}-01-02`,
    '--format=%x1e%H%x1f%an%x1f%aI%x1f%s',
  ];
  if (author) args.push(`--author=${author}`);

  const out = git(repo, args);
  const name = repoName(repo);
  const commits = [];

  for (const rec of out.split('\x1e')) {
    if (!rec.trim()) continue;
    const lines = rec.split('\n');
    const [hash, authorName, date, subject] = lines[0].split('\x1f');
    if (!hash || !date) continue;

    const files = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      files.push({
        file: cleanPath(parts.slice(2).join('\t')),
        add: parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0,
        del: parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0,
      });
    }

    commits.push({
      hash,
      repo: name,
      author: authorName,
      day: date.slice(0, 10), // author-local day, straight from the ISO string
      hour: Number(date.slice(11, 13)),
      subject: subject || '',
      files,
    });
  }
  return commits;
}

function findRepos(root, maxDepth = 3) {
  const found = [];
  const skip = new Set(['node_modules', 'Library', 'AppData', 'target', 'dist', 'build', 'venv', '__pycache__']);
  (function walk(dir, depth) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === '.git')) {
      found.push(dir);
      return;
    }
    if (depth >= maxDepth) return;
    for (const e of entries) {
      if (e.isDirectory() && !skip.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), depth + 1);
    }
  })(path.resolve(root), 0);
  return found;
}

module.exports = { collect, isRepo, defaultAuthor, findRepos, repoName };
