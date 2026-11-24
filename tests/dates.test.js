// Plain-node tests for src/dates.js: local day keys, shifting, pretty-print, next-day rule.
const path = require('path');
const D = require(path.join(__dirname, '..', 'src', 'dates.js'));

const out = { checks: {} };
const c = out.checks;

// todayKey formats a fixed date as local YYYY-MM-DD with zero padding
c.todaykey_fixed = D.todayKey(new Date(2026, 10, 24)) === '2026-11-24'; // Nov 24 2026
c.todaykey_pads = D.todayKey(new Date(2026, 0, 5)) === '2026-01-05';
c.todaykey_default_is_today = /^\d{4}-\d{2}-\d{2}$/.test(D.todayKey());

// shiftKey moves by whole local days, across month and year boundaries
c.shift_plus_one = D.shiftKey('2026-11-24', 1) === '2026-11-25';
c.shift_minus_one = D.shiftKey('2026-11-24', -1) === '2026-11-23';
c.shift_month_forward = D.shiftKey('2026-01-31', 1) === '2026-02-01';
c.shift_month_back = D.shiftKey('2026-03-01', -1) === '2026-02-28'; // 2026 not a leap year
c.shift_year_back = D.shiftKey('2026-01-01', -1) === '2025-12-31';
c.shift_year_forward = D.shiftKey('2025-12-31', 1) === '2026-01-01';
c.shift_leap_day = D.shiftKey('2024-02-28', 1) === '2024-02-29'; // 2024 is a leap year
c.shift_zero = D.shiftKey('2026-11-24', 0) === '2026-11-24';
c.shift_big_delta = D.shiftKey('2026-01-01', 365) === '2027-01-01';

// pretty renders "D Mon YYYY"
c.pretty_format = D.pretty('2026-11-24') === '24 Nov 2026';
c.pretty_single_digit = D.pretty('2026-01-05') === '5 Jan 2026';

// canGoNext: tomorrow can never be opened
c.next_allowed_for_past = D.canGoNext('2026-11-23', '2026-11-24') === true;
c.next_blocked_today = D.canGoNext('2026-11-24', '2026-11-24') === false;
c.next_blocked_future = D.canGoNext('2026-11-25', '2026-11-24') === false;

const failed = Object.keys(c).filter(k => !c[k]);
console.log(JSON.stringify(out, null, 2));
if (failed.length) { console.error('FAILED:', failed.join(', ')); process.exit(1); }
console.log('dates.test.js:', Object.keys(c).length, 'checks passed');
