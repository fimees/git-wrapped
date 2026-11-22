'use strict';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (n) => Math.round(n).toLocaleString('en-US');

const compact = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
};

const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const pad2 = (n) => String(n).padStart(2, '0');

const hourLabel = (h) => `${pad2(h)}:00`;

module.exports = { esc, fmt, compact, trunc, pad2, hourLabel };
