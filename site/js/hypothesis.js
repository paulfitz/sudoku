/* hypothesis.js — the "suppose this cell were a 5" engine.
 *
 * This is the site's answer to plan principle C2. Nearly every advanced technique is a
 * counterfactual, and counterfactuals are exactly what prose is worst at. So instead of
 * telling the learner "if r2c3 were 5 you would eventually contradict yourself", we place
 * the 5 and walk the consequences one forced move at a time until the grid either settles
 * or a cell is left with nothing at all — a contradiction they can see rather than accept.
 *
 * Only forced moves are used (naked and hidden singles). Nothing here guesses, so every
 * frame of the animation is something the learner could have worked out themselves.
 */
(function (root, factory) {
  var S = (typeof require === 'function' && typeof module === 'object')
    ? require('./sudoku.js') : root.Sudoku;
  var mod = factory(S);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Hypothesis = mod;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  /**
   * @param board     starting position (not modified)
   * @param assume    {cell, digit} — or {cell, digit, negate:true} for "suppose it is NOT"
   * @param maxSteps  stop after this many forced moves (default 30)
   *
   * @returns {frames, outcome, board}
   *   frames  — [{cell, digit, reason, kind}] in order; kind is 'assume'|'naked'|'hidden'
   *   outcome — 'contradiction' | 'settled' | 'solved' | 'truncated'
   *   dead    — the cell that ran out of candidates, when outcome is 'contradiction'
   */
  function run(board, assume, maxSteps) {
    maxSteps = maxSteps || 30;
    var b = board.clone();
    var frames = [];

    if (assume.negate) {
      b.eliminate(assume.cell, assume.digit);
      frames.push({
        cell: assume.cell, digit: assume.digit, kind: 'assume-not',
        reason: 'Suppose ' + S.cellName(assume.cell) + ' is <em>not</em> ' + assume.digit + '.'
      });
    } else {
      if (!b.has(assume.cell, assume.digit)) return { frames: [], outcome: 'impossible', board: b };
      b.place(assume.cell, assume.digit);
      frames.push({
        cell: assume.cell, digit: assume.digit, kind: 'assume',
        reason: 'Suppose ' + S.cellName(assume.cell) + ' is ' + assume.digit + '.'
      });
    }

    for (var step = 0; step < maxSteps; step++) {
      var dead = firstDeadCell(b);
      if (dead !== null) {
        return {
          frames: frames, outcome: 'contradiction', dead: dead, board: b,
          deadReason: deadReason(b, dead)
        };
      }
      var move = forcedMove(b);
      if (!move) break;
      b.place(move.cell, move.digit);
      frames.push(move);
      if (b.isSolved()) return { frames: frames, outcome: 'solved', board: b };
    }

    var dead2 = firstDeadCell(b);
    if (dead2 !== null) {
      return {
        frames: frames, outcome: 'contradiction', dead: dead2, board: b,
        deadReason: deadReason(b, dead2)
      };
    }
    return {
      frames: frames, board: b,
      outcome: frames.length >= maxSteps ? 'truncated' : 'settled'
    };
  }

  /** A cell with no value and no candidates, or a house missing a digit entirely. */
  function firstDeadCell(b) {
    for (var i = 0; i < 81; i++) if (!b.values[i] && !b.cands[i]) return i;
    for (var h = 0; h < 27; h++) {
      var placed = 0, avail = 0;
      for (var k = 0; k < 9; k++) {
        var c = S.HOUSES[h][k];
        if (b.values[c]) placed |= S.bit(b.values[c]); else avail |= b.cands[c];
      }
      var missing = S.ALL & ~placed & ~avail;
      if (missing) return S.HOUSES[h].filter(function (c) { return !b.values[c]; })[0];
    }
    return null;
  }

  function deadReason(b, cell) {
    if (!b.values[cell] && !b.cands[cell]) {
      return S.cellName(cell) + ' has no candidates left — nothing can go there. ' +
        'The assumption was wrong.';
    }
    for (var h = 0; h < 27; h++) {
      if (S.HOUSES[h].indexOf(cell) < 0) continue;
      var placed = 0, avail = 0;
      for (var k = 0; k < 9; k++) {
        var c = S.HOUSES[h][k];
        if (b.values[c]) placed |= S.bit(b.values[c]); else avail |= b.cands[c];
      }
      var missing = S.ALL & ~placed & ~avail;
      if (missing) {
        return 'In ' + S.houseName(S.HOUSE_META[h]) + ' there is now nowhere to put the ' +
          S.digitsOf(missing).join(' or ') + '. The assumption was wrong.';
      }
    }
    return 'The position is now impossible. The assumption was wrong.';
  }

  function forcedMove(b) {
    for (var i = 0; i < 81; i++) {
      if (b.values[i] || S.popcount(b.cands[i]) !== 1) continue;
      var d = S.digitsOf(b.cands[i])[0];
      return {
        cell: i, digit: d, kind: 'naked',
        reason: S.cellName(i) + ' has only the ' + d + ' left, so it must be ' + d + '.'
      };
    }
    for (var h = 0; h < 27; h++) {
      for (var d2 = 1; d2 <= 9; d2++) {
        var cells = b.cellsFor(h, d2);
        if (cells.length !== 1) continue;
        return {
          cell: cells[0], digit: d2, kind: 'hidden',
          reason: 'In ' + S.houseName(S.HOUSE_META[h]) + ' the ' + d2 +
            ' now fits only in ' + S.cellName(cells[0]) + '.'
        };
      }
    }
    return null;
  }

  /**
   * Both branches of a bi-value cell, side by side. This is the shape of an XY-Wing
   * argument, and being able to click between the two branches is what makes wings
   * click for people who bounce off the diagrams.
   */
  function branches(board, cell) {
    return board.candidates(cell).map(function (d) {
      var r = run(board, { cell: cell, digit: d }, 20);
      r.digit = d;
      return r;
    });
  }

  return { run: run, branches: branches, forcedMove: forcedMove };
});
