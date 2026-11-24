// Local-date helpers. A "day" is the PC's local calendar date as YYYY-MM-DD.
(function (root) {
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftKey(key, delta) { const p = key.split('-').map(Number); return todayKey(new Date(p[0], p[1] - 1, p[2] + delta)); }
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function pretty(key) { const p = key.split('-').map(Number); return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0]; }
  function canGoNext(viewKey, today) { return viewKey < today; } // tomorrow can never be opened
  const api = { todayKey, shiftKey, pretty, canGoNext };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.APDates = api;
})(typeof window !== 'undefined' ? window : globalThis);
