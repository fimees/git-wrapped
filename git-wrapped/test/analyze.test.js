'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/analyze');
const { renderTerminal } = require('../src/render-terminal');
const { renderSvg } = require('../src/render-svg');
const { renderHtml } = require('../src/render-html');

function commit(day, hour = 12, subject = 'feat: thing', files = [{ file: 'a.js', add: 10, del: 2 }]) {
  return { hash: day + hour + subject, repo: 'demo', author: 'Ada', day, hour, subject, files };
}

test('counts commits and active days only for the requested year', () => {
  const s = analyze([commit('2026-01-01'), commit('2026-01-01', 13), commit('2025-12-31')], { year: 2026 });
  assert.equal(s.commits, 2);
  assert.equal(s.activeDays, 1);
});

test('finds the longest streak', () => {
  const days = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-10', '2026-03-11'];
  const s = analyze(days.map((d) => commit(d)), { year: 2026 });
  assert.equal(s.streak.len, 3);
  assert.equal(s.streak.start, '2026-03-01');
  assert.equal(s.streak.end, '2026-03-03');
});

test('ignores lockfiles and minified bundles in line counts', () => {
  const s = analyze(
    [
      commit('2026-02-02', 12, 'chore: deps', [
        { file: 'package-lock.json', add: 5000, del: 100 },
        { file: 'dist/app.min.js', add: 900, del: 0 },
        { file: 'src/x.ts', add: 7, del: 3 },
      ]),
    ],
    { year: 2026 }
  );
  assert.equal(s.lines.add, 7);
  assert.equal(s.lines.del, 3);
});

test('picks the night owl persona for late commits', () => {
  const s = analyze(Array.from({ length: 10 }, (_, i) => commit(`2026-04-${String(i + 1).padStart(2, '0')}`, 1)), { year: 2026 });
  assert.equal(s.persona.id, 'owl');
});

test('survives an empty year and every renderer', () => {
  const s = analyze([], { year: 2026 });
  assert.equal(s.commits, 0);
  assert.ok(renderTerminal(s, { color: false }).includes('git wrapped 2026'));
  assert.ok(renderSvg(s).endsWith('</svg>'));
  assert.ok(renderHtml(s).startsWith('<!doctype html>'));
});

test('escapes hostile commit subjects in HTML and SVG', () => {
  const evil = '<script>alert(1)</script>';
  const s = analyze([commit('2026-05-05', 12, evil, [{ file: '<b>.js', add: 500, del: 0 }])], { year: 2026, name: evil });
  assert.ok(!renderHtml(s).includes(evil));
  assert.ok(!renderSvg(s, { name: evil }).includes(evil));
});
