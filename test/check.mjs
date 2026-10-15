// Answer check for OA drills. Run: node test/check.mjs
// It loads the question generators from index.html, generates thousands of questions per level,
// and recomputes every answer independently (brute-force counting, exact arithmetic).
// It also checks every equation written in the info cards and worked solutions.
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pure = html.slice(html.indexOf('/*PURE-START*/'), html.indexOf('/*PURE-END*/'));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(pure + '\n;globalThis.__=({LEVELS,LV,factQ,fmt,parseAns,near,genSeq,SEQ_SETS,genSeqFrom,levelOfKey});', ctx);
const { LEVELS, factQ, parseAns } = ctx.__;

let fails = 0, checks = 0;
const failMsgs = new Map();
function ok(cond, msg) { checks++; if (!cond) { fails++; failMsgs.set(msg, (failMsgs.get(msg) || 0) + 1); } }
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const unsup = s => s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '**' + [...m].map(c => SUP[c]).join(''));
const M = s => s.replace(/−/g, '-');

/* ---------- equation checker for cards and worked solutions ---------- */
function evalPart(p) {
  let s = p.trim();
  if (!s) return null;
  if (!/^[\d.+\-×÷/()\s%⁰¹²³⁴⁵⁶⁷⁸⁹]+$/.test(s)) return null;
  if (/^[+\-×÷/)]/.test(s) || /[+\-×÷/(]$/.test(s)) return null;
  s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  s = unsup(s).replace(/×/g, '*').replace(/÷/g, '/');
  try { const v = Function('return (' + s + ')')(); return Number.isFinite(v) ? v : null; } catch { return null; }
}
const decimalsOf = p => { const m = p.trim().match(/^-?\d+\.(\d+)%?$/); return m ? m[1].length + (p.trim().endsWith('%') ? 2 : 0) : null; };
function checkEquations(text, where) {
  const t = M(text.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  // split into runs of arithmetic characters; anything else ends a chain
  const runs = t.split(/[^\d.+\-×÷/()\s%=⁰¹²³⁴⁵⁶⁷⁸⁹]|\.(?!\d)|,/);
  let n = 0;
  for (const run of runs) {
    if (!run.includes('=')) continue;
    const parts = run.split('=');
    for (let i = 0; i + 1 < parts.length; i++) {
      const a = evalPart(parts[i]), b = evalPart(parts[i + 1]);
      if (a === null || b === null) continue;
      const da = decimalsOf(parts[i]), db = decimalsOf(parts[i + 1]);
      const d = Math.min(da ?? 99, db ?? 99);
      const tol = d < 99 ? 0.5 * 10 ** -d + 1e-9 : 1e-9;
      n++;
      ok(Math.abs(a - b) <= tol * (d < 99 ? 1 : Math.max(1, Math.abs(b))), `${where}: "${parts[i].trim()} = ${parts[i + 1].trim()}" is false`);
    }
  }
  return n;
}

/* ---------- sample spaces for independent counting ---------- */
const D6 = [1, 2, 3, 4, 5, 6];
const DECK = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) DECK.push({ r, s, red: s < 2, heart: s === 0 });
const dieLabel = l => ({
  'an even number': f => f % 2 === 0, 'an odd number': f => f % 2 === 1, 'a prime number': f => [2, 3, 5].includes(f), 'a multiple of 3': f => f % 3 === 0,
})[l] || (l.startsWith('a number above ') ? f => f > +l.split(' ').pop() : l.startsWith('a number below ') ? f => f < +l.split(' ').pop() : null);
const cardLabel = l => ({
  'a heart': c => c.heart, 'an ace': c => c.r === 1, 'a face card (J, Q or K)': c => c.r >= 11, 'a red card': c => c.red, 'a red king': c => c.red && c.r === 13,
  'a number card from 2 to 10': c => c.r >= 2 && c.r <= 10, 'a king or a queen': c => c.r === 12 || c.r === 13,
  'hearts': c => c.heart, 'aces': c => c.r === 1, 'red cards': c => c.red, 'face cards': c => c.r >= 11,
  'heart': c => c.heart, 'ace': c => c.r === 1, 'face card': c => c.r >= 11,
})[l];
const frac = (pred, space) => space.filter(pred).length / space.length;
const pairs = (A, B) => { const o = []; for (const a of A) for (const b of B) o.push([a, b]); return o; };
const DD = pairs(D6, D6);
const coins = n => { const o = []; for (let m = 0; m < 2 ** n; m++) o.push([...Array(n)].map((_, i) => (m >> i) & 1)); return o; };
function balls(r, b, g = 0) { return [...Array(r).fill('red'), ...Array(b).fill('blue'), ...Array(g).fill('green')]; }
function noRepPairs(L) { const o = []; for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) if (i !== j) o.push([L[i], L[j]]); return o; }
function choose(n, k) { let f = x => x <= 1 ? 1 : x * f(x - 1); return f(n) / (f(k) * f(n - k)); }

function expectedProb(q) {
  const t = q.q;
  switch (q.tpl) {
    case 'p1die': return frac(dieLabel(q.ev), D6);
    case 'p1card': return frac(cardLabel(q.ev), DECK);
    case 'p1bag': { const B = balls(...q.bag); return frac(x => x === q.col, B); }
    case 'p2': {
      const s = q.spec, P = {
        sum: ([a, b]) => a + b === s.s, ge: ([a, b]) => a + b >= s.s, le: ([a, b]) => a + b <= s.s, dbl: ([a, b]) => a === b,
        one: ([a, b]) => a === s.k || b === s.k, diff: ([a, b]) => Math.abs(a - b) === s.d, ee: ([a, b]) => a % 2 === 0 && b % 2 === 0,
        pe: ([a, b]) => (a * b) % 2 === 0, os: ([a, b]) => (a + b) % 2 === 1,
      }[s.t];
      return DD.filter(P).length;
    }
    case 'p3die': return frac(f => f !== q.k, D6);
    case 'p3sum': return frac(([a, b]) => a + b !== q.s, DD);
    case 'p3card': return frac(c => !cardLabel(q.ev)(c), DECK);
    case 'p3dbl': return frac(([a, b]) => a !== b, DD);
    case 'p3bag': return frac(x => x !== 'red', balls(...q.bag));
    case 'p4coin': { const side = t.includes(' heads and ') ? 1 : 0; return frac(([c, f]) => c === side && dieLabel(q.ev)(f), pairs([0, 1], D6)); }
    case 'p4coins': return frac(c => c.every(x => x === 1), coins(q.n));
    case 'p4dice': return frac(([a, b]) => dieLabel(q.ev)(a) && dieLabel(q.ev)(b), DD);
    case 'p4cards': return frac(([a, b]) => cardLabel(q.ev)(a) && cardLabel(q.ev)(b), pairs(DECK, DECK));
    case 'p4two': return frac(([a, b]) => a === q.a && dieLabel(q.ev)(b), DD);
    case 'p5die': return frac(([a, b]) => a >= q.k || b >= q.k, DD);
    case 'p5coin': return frac(c => c.some(x => x === 1), coins(q.n));
    case 'p5card': return frac(([a, b]) => cardLabel(q.ev)(a) || cardLabel(q.ev)(b), pairs(DECK, DECK));
    case 'p5ev': { const [n, d] = q.p; const S = [...Array(d).keys()]; return frac(([a, b]) => a < n || b < n, pairs(S, S)); }
    case 'p7': { const P = noRepPairs(balls(q.bag[0], q.bag[1])); return frac({ rr: ([a, b]) => a === 'red' && b === 'red', bb: ([a, b]) => a === 'blue' && b === 'blue', rb: ([a, b]) => a !== b }[q.w], P); }
    case 'p7card': { const P = noRepPairs(DECK); return frac({ hh: ([a, b]) => a.heart && b.heart, rr: ([a, b]) => a.red && b.red, ss: ([a, b]) => a.s === b.s, aa: ([a, b]) => a.r === 1 && b.r === 1 }[q.w], P); }
    case 'p8': return choose(q.n, q.k);
    case 'p9': { const a = Math.round(q.p * 100); return (a * q.W - (100 - a) * q.L) / 100; }
    case 'p10': {
      if (q.t === 0) return D6.reduce((s, f) => s + f, 0) / 6 - q.c;
      if (q.t === 1) return D6.reduce((s, f) => s + (f === 6 ? q.W : 0), 0) / 6 - q.c;
      if (q.t === 2) return D6.reduce((s, f) => s + (f >= q.k ? f : 0), 0) / 6;
      if (q.t === 3) return DD.reduce((s, [a, b]) => s + a + b, 0) / 36 - q.c;
      if (q.t === 4) return DD.reduce((s, [a, b]) => s + (a + b === 7 ? q.W : 0), 0) / 36 - q.c;
      return D6.reduce((s, f) => s + (f % 2 === 0 ? q.m * f : 0), 0) / 6;
    }
    case 'p6': {
      const n = q.n;
      return [1 - (5 / 6) ** n, (5 / 6) ** n, 1 - 0.5 ** n, 1 - 0.75 ** n, 1 - (2 / 3) ** n][q.t];
    }
  }
  throw new Error('no solver for ' + q.tpl);
}

/* ---------- independent arithmetic for typed prompts ---------- */
function expectedArith(q) {
  const s = M(q.q);
  let m;
  if ((m = s.match(/^(\d+) \+ (\d+)$/))) return +m[1] + +m[2];
  if ((m = s.match(/^(\d+) - (\d+)$/))) return +m[1] - +m[2];
  if ((m = s.match(/^(\d+) × (\d+)$/))) return +m[1] * +m[2];
  if ((m = s.match(/^(\d+) ÷ (\d+)$/))) { const v = +m[1] / +m[2]; ok(Number.isInteger(v), `${q.lv}: ${s} is not a whole number`); return v; }
  if ((m = s.match(/^(\d+)([²³])$/))) return (+m[1]) ** (m[2] === '²' ? 2 : 3);
  if ((m = s.match(/^2([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/))) return 2 ** +[...m[1]].map(c => SUP[c]).join('');
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return q.unit === '%' ? 100 * +m[1] / +m[2] : +m[1] / +m[2];
  if ((m = s.match(/^(\d+) = \?([²³])$/))) { const N = +m[1], p = m[2] === '²' ? 2 : 3; for (let r = 1; r < 200; r++) if (r ** p === N) return r; return NaN; }
  if ((m = s.match(/^(\d+) = 2\^\?$/))) { for (let r = 0; r < 40; r++) if (2 ** r === +m[1]) return r; return NaN; }
  if ((m = s.match(/^(\d+) choose (\d+)$/))) return choose(+m[1], +m[2]);
  throw new Error('cannot parse prompt ' + s);
}

/* ---------- sequence rule families, checked on the full sequence ---------- */
const diffs = a => a.slice(1).map((v, i) => v - a[i]);
const allEq = a => a.every(v => close(v, a[0]));
const isArith = a => allEq(diffs(a));
const isGeo = a => a.every(v => v !== 0) && allEq(a.slice(1).map((v, i) => v / a[i]));
function consecPow(a, p) { const r = Math.round(Math.sign(a[0]) * Math.abs(a[0]) ** (1 / p)); return a.every((v, i) => v === (r + i) ** p); }
const SEQ_RULE = {
  S1: a => isArith(a),
  S2: a => isGeo(a),
  S3: a => consecPow(a, 2) || consecPow(a, 3),
  S4: a => { for (let c = -9; c <= 9; c++) { if (!c) continue; const b = a.map(v => v - c); if (b[0] >= 1 && (consecPow(b, 2) || consecPow(b, 3))) return true; } return false; },
  S5: a => isArith(diffs(a)) && !isArith(a),
  S6: a => a.slice(2).every((v, i) => v === a[i] + a[i + 1]) || a.slice(3).every((v, i) => v === a[i] + a[i + 1] + a[i + 2]),
  S7: a => { const o = a.filter((_, i) => i % 2 === 0), e = a.filter((_, i) => i % 2 === 1); return ((isArith(o) || isGeo(o)) && (isArith(e) || isGeo(e))) || (a.every((v, i) => Math.sign(v) === (i % 2 ? -1 : 1) * Math.sign(a[0])) && isArith(a.map(Math.abs))); },
  S8: a => {
    const k = (a[2] - a[1]) / (a[1] - a[0]), c = a[1] - k * a[0];
    if (Number.isFinite(k) && a.slice(1).every((v, i) => close(v, k * a[i] + c))) return true; // multiply then add
    for (let st = 0; st < 2; st++) { let fine = true; const adds = [], muls = []; for (let i = 1; i < a.length; i++) { if ((i + st) % 2) adds.push(a[i] - a[i - 1]); else muls.push(a[i] / a[i - 1]); } if (adds.length && muls.length && allEq(adds) && allEq(muls)) return true; }
    if (isGeo(diffs(a))) return true; // gaps that multiply
    const r = a.slice(1).map((v, i) => v / a[i]); if (isArith(r) && Math.abs(r[1] - r[0] - 1) < 1e-9) return true; // growing multipliers
    if (a.slice(2).every((v, i) => v === a[i] * a[i + 1])) return true; // product of previous two
    return false;
  },
};

/* ---------- run ---------- */
let cardEq = 0;
for (const L of LEVELS) cardEq += checkEquations(L.card, `card ${L.id}`);

const ROUNDS = 3000;
for (const L of LEVELS) {
  if (L.keys) {
    for (const k of L.keys) {
      ok(ctx.__.levelOfKey(k) === L.id, `${L.id}: key ${k} maps to ${ctx.__.levelOfKey(k)}`);
      for (let r = 0; r < 4; r++) {
        const q = factQ(k); q.lv = L.id;
        ok(!!q, `${L.id}: no question for ${k}`);
        if (q.kind === 'mc') {
          const n = +q.q; let p = n >= 2; for (let d = 2; d * d <= n; d++) if (n % d === 0) p = false;
          ok(q.ans === (p ? 'Prime' : 'Not prime'), `${L.id}: ${n} marked ${q.ans}`);
          checkEquations(q.ex, `${L.id} ${k} ex`);
          continue;
        }
        const exp = expectedArith(q), ans = q.ans !== undefined ? +q.ans : q.x;
        ok(close(q.x, exp), `${L.id}: ${q.q} stored ${q.x}, expected ${exp}`);
        if (q.tol) { ok(Math.abs(ans - exp) <= q.tol, `${L.id}: shown answer ${q.ans} for ${q.q} is outside the tolerance`); ok(Math.abs(ans - exp) <= 0.5 * 10 ** -((String(q.ans).split('.')[1] || '').length) + 1e-12, `${L.id}: ${q.q} answer ${q.ans} is not correctly rounded`); }
        if (q.ex) checkEquations(q.ex, `${L.id} ${k} ex`);
      }
    }
    continue;
  }
  for (let r = 0; r < ROUNDS; r++) {
    const q = L.gen();
    if (q.ans === undefined) q.ans = ctx.__.fmt(q.x);
    if (q.tpl === 'seq') {
      const s = q.seq, all = s.vals;
      ok(close(q.x, all[s.hide]), `${L.id}: hidden value mismatch`);
      ok(all.every(Number.isInteger), `${L.id}: non-integer term`);
      ok(new Set(all).size >= 4, `${L.id}: too few distinct terms`);
      ok(SEQ_RULE[L.id](all), `${L.id}: sequence ${all.join(', ')} does not follow the level's rule`);
      ok(close(parseAns(q.ans), q.x), `${L.id}: shown answer ${q.ans} differs from value`);
      continue;
    }
    if (q.tpl && q.tpl !== 'p8') {
      const exp = expectedProb(q);
      if (q.kind === 'mc') {
        const vals = q.opts.map(o => parseFloat(o));
        ok(q.opts.length === 4, `${L.id}: needs 4 options`);
        ok(q.opts.includes(q.ans), `${L.id}: answer not among options`);
        const best = q.opts[vals.map(v => Math.abs(v - exp * 100)).reduce((bi, v, i, arr) => v < arr[bi] ? i : bi, 0)];
        ok(best === q.ans, `${L.id}: ${q.ans} is not the closest option to ${(exp * 100).toFixed(2)}%`);
        const sorted = vals.slice().sort((a, b) => a - b);
        ok(sorted.every((v, i) => i === 0 || v - sorted[i - 1] >= 6), `${L.id}: options closer than 6 points: ${q.opts}`);
        ok(close(q.v, exp), `${L.id}: stored value ${q.v} vs ${exp}`);
      } else {
        ok(close(q.x, exp, 1e-9), `${L.id} ${q.tpl}: "${q.q}" stored ${q.x}, expected ${exp}`);
        const shown = parseAns(q.ans);
        ok(q.tol ? Math.abs(shown - exp) <= q.tol : close(shown, exp), `${L.id} ${q.tpl}: shown answer ${q.ans} vs ${exp}`);
        ok(q.ex.includes(M(q.ans)) || M(q.ex).includes(M(q.ans)), `${L.id} ${q.tpl}: worked solution does not reach ${q.ans}: ${q.ex}`);
      }
      checkEquations(q.ex, `${L.id} ${q.tpl} ex`);
      continue;
    }
    // arithmetic levels and combinations
    const exp = expectedArith(q);
    ok(close(q.x, exp), `${L.id}: ${q.q} stored ${q.x}, expected ${exp}`);
    if (q.ex) { checkEquations(q.ex, `${L.id} ex`); ok(q.ex.endsWith(String(exp)), `${L.id}: ex does not end in ${exp}: ${q.ex}`); }
    if (L.id === 'A5') { const m = M(q.q).match(/(\d+) ([+-]) (\d+)/); const a = +m[1], b = +m[3]; ok(m[2] === '+' ? Math.floor(a / 10) !== Math.floor((a + b) / 10) : Math.floor(a / 10) !== Math.floor((a - b) / 10), `A5: ${q.q} does not cross a ten`); }
  }
}

console.log(`${checks} checks, ${cardEq} equations in info cards.`);
if (fails) {
  console.log(`${fails} FAILED:`);
  for (const [m, n] of failMsgs) console.log(`  ${n}× ${m}`);
  process.exit(1);
}
console.log('All answers, worked solutions and info-card equations check out.');
