#!/usr/bin/env node
/* generate.js — the build step.
 *
 * Searches randomly generated puzzles for positions where each technique actually fires,
 * validates every proposed elimination against the puzzle's true solution, and writes
 * site/js/puzzles.js.
 *
 * Content is stored as {puzzle, prep} rather than as a candidate grid: the site replays
 * the same solveWith(prep) to reach the same position, so lesson data can never drift out
 * of sync with the solver. Deterministic (seeded PRNG) so rebuilds are reproducible.
 *
 *   node tools/generate.js [--count N] [--seed N]
 */
'use strict';

var path = require('path');
var fs = require('fs');
var S = require(path.join(__dirname, '..', 'site', 'js', 'sudoku.js'));
var T = require(path.join(__dirname, '..', 'site', 'js', 'techniques.js'));

// ------------------------------------------------------------------- random

function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// ---------------------------------------------------------------- generator

function randomSolution(rng) {
  var b = new S.Board();
  function fill(i) {
    if (i >= 81) return true;
    var ds = shuffle(S.digitsOf(b.cands[i]), rng);
    for (var k = 0; k < ds.length; k++) {
      var snapshotV = b.values.slice(), snapshotC = b.cands.slice();
      b.place(i, ds[k]);
      if (fill(i + 1)) return true;
      b.values = snapshotV; b.cands = snapshotC;
    }
    return false;
  }
  fill(0);
  return b;
}

/** Dig holes out of a full grid while keeping the solution unique. */
function makePuzzle(rng, keepAtLeast) {
  var full = randomSolution(rng);
  var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }), rng);
  var vals = full.values.slice(), given = 81;
  for (var k = 0; k < order.length && given > keepAtLeast; k++) {
    var i = order[k], saved = vals[i];
    if (!saved) continue;
    vals[i] = 0;
    var probe = new S.Board(vals);
    if (S.solve(probe, 2).count !== 1) { vals[i] = saved; } else { given--; }
  }
  return new S.Board(vals);
}

// -------------------------------------------------------------- validation

/**
 * The safety net: a technique that eliminates a digit which the true solution needs is
 * a bug, and must never reach a learner. Everything generated passes through here.
 */
function validate(finding, solution) {
  var bad = [];
  finding.eliminations.forEach(function (e) {
    if (e.placement) {
      if (+solution[e.cell] !== e.digit) bad.push('bad placement ' + S.cellName(e.cell) + '=' + e.digit);
    } else if (+solution[e.cell] === e.digit) {
      bad.push('removed the true digit ' + e.digit + ' from ' + S.cellName(e.cell));
    }
  });
  (finding.placements || []).forEach(function (p) {
    if (+solution[p.cell] !== p.digit) bad.push('bad placement ' + S.cellName(p.cell) + '=' + p.digit);
  });
  return bad;
}

// ----------------------------------------------------------------- targets
//
// prep  = solve with everything of this rank or lower before presenting the position.
// want  = how many examples to collect.
// pick  = optional extra quality filter, so the lesson instance is a clean one.

var TARGETS = [
  // prep 0 is the untouched puzzle — the only position where a naked single can still be
  // the next thing to see, since rank 1 is the naked-single detector itself.
  { id: 'naked-single', preps: [0], want: 6 },
  { id: 'hidden-single', preps: [1], want: 6 },
  { id: 'naked-pair', preps: [2], want: 6 },
  { id: 'hidden-pair', preps: [3], want: 6 },
  { id: 'pointing', preps: [4], want: 6 },
  { id: 'claiming', preps: [4], want: 6 },
  { id: 'naked-triple', preps: [5], want: 6 },
  { id: 'hidden-triple', preps: [6], want: 5 },
  { id: 'x-wing', preps: [8], want: 6, pick: function (f) { return f.eliminations.length >= 2; } },
  { id: 'skyscraper', preps: [9], want: 6 },
  { id: 'two-string-kite', preps: [9], want: 6 },
  { id: 'xy-wing', preps: [9, 10], want: 6 },
  { id: 'w-wing', preps: [9, 10], want: 5 },
  { id: 'xyz-wing', preps: [10, 11], want: 5 },
  { id: 'swordfish', preps: [10, 12], want: 5, pick: function (f) { return f.eliminations.length >= 2; } },
  { id: 'coloring-trap', preps: [12, 13], want: 5 },
  { id: 'coloring-wrap', preps: [12, 13], want: 5 },
  { id: 'unique-rectangle-1', preps: [10, 12, 14], want: 5 },
  { id: 'unique-rectangle-2', preps: [10, 12, 14], want: 4 },
  { id: 'bug-plus-one', preps: [8, 10, 12, 14], want: 4 },
  { id: 'finned-x-wing', preps: [12, 15], want: 5 },
  { id: 'remote-pairs', preps: [10, 12, 14], want: 4, pick: function (f) { return f.cells.length >= 4; } },
  { id: 'xy-chain', preps: [12, 14], want: 5, pick: function (f) { return f.cells.length >= 4; } },
  { id: 'x-chain', preps: [12, 14], want: 5, pick: function (f) { return f.links.length >= 5; } }
];

// -------------------------------------------------------------------- main

var args = process.argv.slice(2);
function arg(name, dflt) {
  var i = args.indexOf('--' + name);
  return i >= 0 ? +args[i + 1] : dflt;
}

var COUNT = arg('count', 900);
var SEED = arg('seed', 20260725);
var rng = makeRng(SEED);

var collected = Object.create(null);   // instances that pass the quality filter
var fallback = Object.create(null);    // valid but less pretty; used only to top up
var stats = { puzzles: 0, skippedEasy: 0, checked: 0, rejected: 0 };
TARGETS.forEach(function (t) { collected[t.id] = []; fallback[t.id] = []; });

// A lesson position must be *stuck*: no deduction of rank <= prep is available, so the
// target technique is genuinely the next thing to see. That means only the end position
// of solveWith(prep) qualifies. Targets may name several prep ranks (each yields a
// different legitimate stuck position), which is how the rare patterns get found.
TARGETS.forEach(function (t) { t.preps = t.preps || [t.prep]; });

var BY_PREP = {};
TARGETS.forEach(function (t) {
  t.preps.forEach(function (p) { (BY_PREP[p] = BY_PREP[p] || []).push(t); });
});

function needMore() {
  return TARGETS.some(function (t) { return collected[t.id].length < t.want; });
}

function have(t) { return collected[t.id].length + fallback[t.id].length; }

/** Consider one finding for one target at one position. */
function consider(t, f, puzzle, solution, prep) {
  stats.checked++;
  var bad = validate(f, solution);
  if (bad.length) {
    stats.rejected++;
    process.stderr.write('  REJECT ' + t.id + ' (' + puzzle + ' prep ' + prep + '): ' +
      bad.join('; ') + '\n');
    return false;
  }
  var entry = {
    puzzle: puzzle, solution: solution, prep: prep,
    cells: f.cells.slice().sort(function (a, b) { return a - b; }),
    digits: f.digits.slice(), elims: f.eliminations.length
  };
  if (t.pick && !t.pick(f)) {
    if (fallback[t.id].length < t.want) fallback[t.id].push(entry);
    return false;
  }
  // one example per puzzle per technique, so drills don't repeat the same grid
  if (collected[t.id].some(function (e) { return e.puzzle === puzzle; })) return false;
  collected[t.id].push(entry);
  return true;
}

process.stderr.write('generating puzzles (seed ' + SEED + ')...\n');

for (var n = 0; n < COUNT && needMore(); n++) {
  var puzzle = makePuzzle(rng, 24);
  var solution = S.solve(puzzle, 1).solution;
  if (!solution) continue;

  // Puzzles that fall to singles alone contain nothing worth teaching past the singles
  // lessons — but they are exactly where the singles lessons should get their examples.
  var easy = T.solveWith(puzzle, 2).solved;
  if (easy) stats.skippedEasy++;
  stats.puzzles++;
  var pstr = puzzle.toString();

  Object.keys(BY_PREP).forEach(function (prepKey) {
    var prep = +prepKey;
    if (easy && prep > 1) return;
    var group = BY_PREP[prepKey].filter(function (t) { return collected[t.id].length < t.want; });
    if (!group.length) return;

    var pos = T.solveWith(puzzle, prep);
    if (pos.solved) return;

    group.forEach(function (t) {
      var found = T.findAll(pos.board, t.id);
      if (!found.length) return;
      // smallest pattern first, then the one that eliminates most — the clearest example
      found.sort(function (a, b) {
        return (a.cells.length - b.cells.length) || (b.eliminations.length - a.eliminations.length);
      });
      for (var k = 0; k < found.length && k < 4; k++) {
        if (consider(t, found[k], pstr, solution, prep)) break;
      }
    });
  });

  if (n % 50 === 0) process.stderr.write('  ' + n + ' puzzles, ' + summary() + '\n');
}

// Top up anything short with the less-pretty-but-valid instances.
TARGETS.forEach(function (t) {
  while (collected[t.id].length < t.want && fallback[t.id].length) {
    collected[t.id].push(fallback[t.id].shift());
  }
});

function summary() {
  return TARGETS.filter(function (t) { return collected[t.id].length < t.want; })
    .map(function (t) { return t.id + ':' + collected[t.id].length + '/' + t.want; }).join(' ') || 'all targets met';
}

process.stderr.write('\ndone: ' + stats.puzzles + ' puzzles, ' + stats.checked +
  ' findings checked, ' + stats.rejected + ' rejected\n');

var missing = TARGETS.filter(function (t) { return !collected[t.id].length; });
TARGETS.forEach(function (t) {
  process.stderr.write('  ' + (collected[t.id].length >= t.want ? 'ok  ' : 'LOW ') +
    t.id + ': ' + collected[t.id].length + '/' + t.want + '\n');
});

if (stats.rejected) {
  process.stderr.write('\nFAIL: ' + stats.rejected + ' invalid findings — fix the detectors.\n');
  process.exit(1);
}
if (missing.length) {
  process.stderr.write('\nFAIL: no examples for ' + missing.map(function (t) { return t.id; }).join(', ') + '\n');
  process.exit(1);
}

var out = '/* GENERATED by tools/generate.js — do not edit by hand.\n' +
  ' * seed ' + SEED + ', ' + stats.puzzles + ' puzzles searched.\n' +
  ' * Each entry: the puzzle, its solution, and the rank to auto-solve to before\n' +
  ' * presenting it. The site replays solveWith(prep) to rebuild the exact position.\n' +
  ' */\n' +
  '(function (root) {\n' +
  '  var data = ' + JSON.stringify(collected, null, 1).replace(/\n/g, '\n  ') + ';\n' +
  '  if (typeof module === "object" && module.exports) module.exports = data;\n' +
  '  else root.PuzzleBank = data;\n' +
  '})(typeof self !== "undefined" ? self : this);\n';

var dest = path.join(__dirname, '..', 'site', 'js', 'puzzles.js');
fs.writeFileSync(dest, out);
process.stderr.write('\nwrote ' + dest + ' (' + (out.length / 1024).toFixed(1) + ' kB)\n');
