#!/usr/bin/env node
/* test.js — fuzz the detectors against ground truth.
 *
 * Generates random puzzles, walks each one to every stuck position, runs every detector,
 * and checks that no finding ever removes a candidate the true solution needs. A single
 * failure here means a learner would be taught a false deduction, so this gates the build.
 *
 *   node tools/test.js [--count N] [--seed N]
 */
'use strict';

var path = require('path');
var S = require(path.join(__dirname, '..', 'site', 'js', 'sudoku.js'));
var T = require(path.join(__dirname, '..', 'site', 'js', 'techniques.js'));

var args = process.argv.slice(2);
function arg(name, dflt) { var i = args.indexOf('--' + name); return i >= 0 ? +args[i + 1] : dflt; }

var COUNT = arg('count', 150);
var SEED = arg('seed', 987654321);

function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
var rng = makeRng(SEED);

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function randomPuzzle() {
  var b = new S.Board();
  (function fill(i) {
    if (i >= 81) return true;
    var ds = shuffle(S.digitsOf(b.cands[i]));
    for (var k = 0; k < ds.length; k++) {
      var v = b.values.slice(), c = b.cands.slice();
      b.place(i, ds[k]);
      if (fill(i + 1)) return true;
      b.values = v; b.cands = c;
    }
    return false;
  })(0);
  var vals = b.values.slice();
  shuffle(Array.from({ length: 81 }, function (_, i) { return i; })).forEach(function (i) {
    var saved = vals[i];
    vals[i] = 0;
    if (S.solve(new S.Board(vals), 2).count !== 1) vals[i] = saved;
  });
  return new S.Board(vals);
}

// -------------------------------------------------------- completeness
//
// Everything else here checks that findings are TRUE. Nothing checked they were ALL
// found — and a missed finding is silent: no test fails, the learner is just shown a
// harder technique when a simpler one was sitting there. That is how a naked-subset guard
// that skipped whole houses survived. This brute-forces the subset definitions straight
// from the rules and demands the detector agree.
function checkSubsetCompleteness(board) {
  var missed = [];

  function combos(arr, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  for (var size = 2; size <= 4; size++) {
    var reported = {};
    T.nakedSubsets(board, size).forEach(function (f) {
      reported[f.houses[0] + '|' + f.cells.slice().sort(function (a, b) { return a - b; }).join(',')] = 1;
    });

    for (var h = 0; h < 27; h++) {
      var empties = board.emptyCells(h);
      if (empties.length <= size) continue;          // nothing left to eliminate from
      combos(empties, size).forEach(function (cells) {
        var mask = 0;
        cells.forEach(function (c) { mask |= board.cands[c]; });
        if (S.popcount(mask) !== size) return;        // not a naked subset
        var digits = S.digitsOf(mask), kills = 0;
        S.HOUSES[h].forEach(function (c) {
          if (cells.indexOf(c) >= 0) return;
          digits.forEach(function (d) { if (board.has(c, d)) kills++; });
        });
        if (!kills) return;                           // inert, correctly not reported
        var key = h + '|' + cells.slice().sort(function (a, b) { return a - b; }).join(',');
        if (!reported[key]) {
          missed.push('naked-' + size + ' missed in ' + S.houseName(S.HOUSE_META[h]) +
            ': ' + S.cellList(cells) + ' on ' + digits.join(',') + ' (' + kills + ' eliminations)');
        }
      });
    }
  }
  return missed;
}

var failures = [], stats = { puzzles: 0, positions: 0, findings: 0 };
var perTechnique = Object.create(null);

// ---------------------------------------------------------- bank integrity
//
// Lesson content is stored as {puzzle, prep} and replayed through solveWith(). That is
// only stable while the registry order and the detectors stay put — change either and
// every stored position silently shifts under the lessons. So check the bank still
// reproduces the exact findings it was generated for.
(function checkBank() {
  var BANK;
  try { BANK = require(path.join(__dirname, '..', 'site', 'js', 'puzzles.js')); }
  catch (e) { failures.push('bank: cannot load puzzles.js — ' + e.message); return; }

  var checked = 0;
  Object.keys(BANK).forEach(function (tech) {
    BANK[tech].forEach(function (e, i) {
      checked++;
      var board = T.solveWith(S.Board.fromString(e.puzzle), e.prep).board;
      var found = T.findAll(board, tech);
      if (!found.length) {
        failures.push('bank ' + tech + '[' + i + ']: ' + tech + ' no longer fires at prep ' +
          e.prep + ' — stored lesson positions have drifted from the detectors');
        return;
      }
      var match = found.some(function (f) {
        var c = f.cells.slice().sort(function (a, b) { return a - b; });
        return c.length === e.cells.length && c.every(function (v, k) { return v === e.cells[k]; });
      });
      if (!match) {
        failures.push('bank ' + tech + '[' + i + ']: stored cells no longer among the ' +
          found.length + ' findings at that position');
      }
    });
  });
  console.log('bank integrity: ' + checked + ' stored positions replayed, ' +
    failures.length + ' problems\n');
})();

var PREPS = [1, 3, 5, 8, 10, 12, 14, 16];

for (var n = 0; n < COUNT; n++) {
  var puzzle = randomPuzzle();
  var solution = S.solve(puzzle, 1).solution;
  if (!solution) continue;
  stats.puzzles++;

  PREPS.forEach(function (prep) {
    var pos = T.solveWith(puzzle, prep);
    if (pos.solved) return;
    stats.positions++;
    var board = pos.board;

    checkSubsetCompleteness(board).forEach(function (m) {
      failures.push('completeness: ' + m + '\n  ' + puzzle.toString());
    });

    T.REGISTRY.forEach(function (entry) {
      var found;
      try {
        found = entry.run(board);
      } catch (err) {
        failures.push(entry.id + ' threw: ' + err.message + '\n  ' + puzzle.toString());
        return;
      }
      // chain searches can return a lot; a sample is plenty for a fuzz test
      found.slice(0, 12).forEach(function (f) {
        stats.findings++;
        perTechnique[f.technique] = (perTechnique[f.technique] || 0) + 1;

        if (!f.eliminations.length) {
          failures.push(f.technique + ': finding with no eliminations\n  ' + puzzle.toString());
        }
        f.eliminations.forEach(function (e) {
          if (e.placement) {
            if (+solution[e.cell] !== e.digit) {
              failures.push(f.technique + ': claims ' + S.cellName(e.cell) + '=' + e.digit +
                ' but solution has ' + solution[e.cell] + '\n  puzzle ' + puzzle.toString() +
                '\n  prep ' + prep + ', cells ' + S.cellList(f.cells));
            }
          } else if (+solution[e.cell] === e.digit) {
            failures.push(f.technique + ': removes true digit ' + e.digit + ' from ' +
              S.cellName(e.cell) + '\n  puzzle ' + puzzle.toString() +
              '\n  prep ' + prep + ', cells ' + S.cellList(f.cells) +
              ', digits ' + f.digits.join(','));
          }
          if (!board.has(e.cell, e.digit) && !e.placement) {
            failures.push(f.technique + ': eliminates a candidate that is not there (' +
              S.cellName(e.cell) + ' ' + e.digit + ')');
          }
        });
      });
    });
  });

  if (n % 25 === 0) process.stderr.write('  ' + n + '/' + COUNT + ' puzzles, ' +
    stats.findings + ' findings, ' + failures.length + ' failures\n');
}

console.log('\n' + stats.puzzles + ' puzzles, ' + stats.positions + ' positions, ' +
  stats.findings + ' findings checked\n');

Object.keys(perTechnique).sort().forEach(function (k) {
  console.log('  ' + k.padEnd(22) + perTechnique[k]);
});

var never = T.REGISTRY.filter(function (e) { return !perTechnique[e.id]; });
if (never.length) {
  console.log('\nnot exercised by this sample: ' + never.map(function (e) { return e.id; }).join(', '));
}

if (failures.length) {
  console.log('\n' + failures.length + ' FAILURES:\n');
  failures.slice(0, 20).forEach(function (f) { console.log('  ' + f + '\n'); });
  process.exit(1);
}
console.log('\nall findings agree with the solution.');
