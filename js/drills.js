/* drills.js — practice, because reading a worked example produces recognition, not recall.
 *
 * Two kinds:
 *   Drill      — one technique, fresh grid: find the pattern, then find the eliminations.
 *   MixedDrill — a position where *some* technique applies; name it. Choosing the
 *                technique is the actual skill, and isolation drills never train it.
 *
 * Answers are checked against live detector output, not stored coordinates, so any valid
 * instance the learner finds is accepted — including one the author never saw.
 */
(function (root, factory) {
  var req = (typeof require === 'function' && typeof module === 'object');
  var S = req ? require('./sudoku.js') : root.Sudoku;
  var T = req ? require('./techniques.js') : root.Techniques;
  var BANK = req ? require('./puzzles.js') : root.PuzzleBank;
  var mod = factory(S, T, BANK, root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Drills = mod;
})(typeof self !== 'undefined' ? self : this, function (S, T, BANK, root) {
  'use strict';

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort(function (x, y) { return x - y; });
    var sb = b.slice().sort(function (x, y) { return x - y; });
    return sa.every(function (v, i) { return v === sb[i]; });
  }

  function subsetOf(a, b) {
    return a.every(function (v) { return b.indexOf(v) >= 0; });
  }

  /** Rebuild the exact position an entry refers to. */
  function positionOf(entry) {
    var puzzle = S.Board.fromString(entry.puzzle);
    var pos = T.solveWith(puzzle, entry.prep);
    return { board: pos.board, puzzle: puzzle, givens: puzzle.values.map(Boolean) };
  }

  function entriesFor(technique) { return (BANK && BANK[technique]) || []; }

  /**
   * A drill instance. `index` selects which stored example, so a lesson can use example 0
   * for its walkthrough and hand the rest to practice.
   */
  function makeDrill(technique, index) {
    var list = entriesFor(technique);
    if (!list.length) return null;
    var entry = list[index % list.length];
    var pos = positionOf(entry);
    var findings = T.findAll(pos.board, technique);
    if (!findings.length) return null;
    findings.sort(function (a, b) {
      return (a.cells.length - b.cells.length) || (b.eliminations.length - a.eliminations.length);
    });
    return {
      entry: entry, board: pos.board, givens: pos.givens,
      findings: findings, primary: findings[0]
    };
  }

  /** All distinct valid answers, so "find one of them" is checkable. */
  function checkPattern(drill, selection) {
    if (!selection.length) return { state: 'empty' };
    var exact = drill.findings.filter(function (f) { return sameSet(f.cells, selection); });
    if (exact.length) return { state: 'correct', finding: exact[0] };

    var partial = drill.findings.filter(function (f) { return subsetOf(selection, f.cells); });
    if (partial.length) {
      var f = partial[0];
      return {
        state: 'partial', finding: f,
        message: 'Every cell you have picked belongs to a real ' + label(drill.entry, f) +
          ' — but the pattern needs ' + f.cells.length + ' cells and you have ' +
          selection.length + '.'
      };
    }
    var inert = inertPattern(drill.board, selection);
    if (inert) {
      var names = S.cellList(selection);
      return {
        state: 'inert',
        message: 'That <em>is</em> a genuine ' + (inert.kind === 'naked' ? 'naked' : 'hidden') +
          ' ' + (selection.length === 2 ? 'pair' : selection.length === 3 ? 'triple' : 'subset') +
          ' — ' + names + ' on ' + inert.digits.join(' and ') + ' in ' +
          S.houseName(S.HOUSE_META[inert.house]) + '. ' +
          (inert.emptyOthers === 0
            ? 'But they are the only empty cells left in that house, so there is nothing for it to remove.'
            : 'But nothing else in that house still holds those digits, so it removes nothing.') +
          ' A pattern that eliminates nothing is not a move. Find one with work left to do.'
      };
    }

    // find the most-nearly-right finding to give specific feedback about
    var best = null, bestHits = -1;
    drill.findings.forEach(function (f) {
      var hits = selection.filter(function (c) { return f.cells.indexOf(c) >= 0; }).length;
      if (hits > bestHits) { bestHits = hits; best = f; }
    });
    var strays = best ? selection.filter(function (c) { return best.cells.indexOf(c) < 0; }) : selection;
    return {
      state: 'wrong', finding: best,
      message: bestHits > 0
        ? bestHits + ' of your cells ' + (bestHits === 1 ? 'is' : 'are') + ' part of a real ' +
          'pattern, but ' + S.cellList(strays.slice(0, 3)) + ' ' +
          (strays.length === 1 ? 'is' : 'are') + ' not.'
        : 'None of those cells are part of a pattern here. Try a different part of the grid.'
    };
  }

  /**
   * What a finding actually *does*, split by kind. Singles carry their conclusion as a
   * placement rather than an elimination, and conflating the two asks the learner to
   * click the digit that survives while telling them to click the ones that die.
   */
  function consequences(f) {
    var kills = [], places = [];
    function addPlace(cell, digit) {
      if (!places.some(function (p) { return p.cell === cell && p.digit === digit; })) {
        places.push({ cell: cell, digit: digit });
      }
    }
    (f.placements || []).forEach(function (p) { addPlace(p.cell, p.digit); });
    f.eliminations.forEach(function (e) {
      if (e.placement) addPlace(e.cell, e.digit);
      else kills.push({ cell: e.cell, digit: e.digit });
    });
    // A pattern that kills candidates is asked about that way; one whose only outcome is
    // a placement (the singles) is asked the question it actually answers.
    return { kills: kills, places: places, mode: kills.length ? 'kills' : 'places' };
  }

  /** The phase-2 question, worded from the finding rather than from the lesson. */
  function consequencePrompt(finding) {
    var c = consequences(finding);
    return c.mode === 'kills'
      ? 'Now mark every candidate this kills.'
      : 'Now mark the digit that has to go in.';
  }

  function checkConsequences(finding, picks) {
    var c = consequences(finding);
    var target = c.mode === 'kills' ? c.kills : c.places;
    if (!picks.length) {
      return {
        state: 'empty', mode: c.mode,
        message: c.mode === 'kills'
          ? 'Nothing marked yet — tap the candidates this kills (' + target.length + ' of them).'
          : 'Nothing chosen yet — pick the digit that goes in.'
      };
    }
    var want = target.map(function (e) { return e.cell * 10 + e.digit; });
    var got = picks.map(function (p) { return p.cell * 10 + p.digit; });
    var missing = want.filter(function (k) { return got.indexOf(k) < 0; });
    var wrong = got.filter(function (k) { return want.indexOf(k) < 0; });

    if (!missing.length && !wrong.length) return { state: 'correct', mode: c.mode };
    if (wrong.length) {
      var w = wrong[0], cell = (w / 10) | 0, digit = w % 10;
      return {
        state: 'wrong', mode: c.mode,
        message: c.mode === 'kills'
          ? 'The ' + digit + ' in ' + S.cellName(cell) + ' survives this pattern — the ' +
            'logic has to actually reach a cell before it can kill anything there.'
          : 'The ' + digit + ' is not what this forces in ' + S.cellName(cell) + '.'
      };
    }
    return {
      state: 'partial', mode: c.mode,
      message: c.mode === 'kills'
        ? 'Right so far — but ' + missing.length + ' more ' +
          (missing.length === 1 ? 'candidate dies' : 'candidates die') + '.'
        : 'Not quite — mark the digit the pattern forces.'
    };
  }

  /** "5" / "5 and 7" / "3, 4 and 8" — the hint is the first thing a stuck learner reads. */
  function listOf(items) {
    var a = items.slice().sort(function (x, y) { return x - y; });
    if (a.length <= 1) return String(a[0] === undefined ? '' : a[0]);
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  /**
   * A structurally genuine subset that happens to remove nothing — typically the last two
   * empty cells of a house. Detectors ignore these (a pattern that does no work is not a
   * deduction), but a learner who finds one has done exactly what was asked and deserves
   * to be told what is actually wrong with it, not "that is not a pattern".
   */
  function inertPattern(board, cells) {
    if (cells.length < 2) return null;
    if (cells.some(function (c) { return board.values[c]; })) return null;

    var house = -1;
    for (var h = 0; h < 27; h++) {
      if (cells.every(function (c) { return S.HOUSES[h].indexOf(c) >= 0; })) { house = h; break; }
    }
    if (house < 0) return null;

    var others = S.HOUSES[house].filter(function (c) {
      return !board.values[c] && cells.indexOf(c) < 0;
    });

    // naked: n cells holding n candidates between them
    var mask = 0;
    cells.forEach(function (c) { mask |= board.cands[c]; });
    if (S.popcount(mask) === cells.length) {
      var digits = S.digitsOf(mask), kills = 0;
      others.forEach(function (c) {
        digits.forEach(function (d) { if (board.has(c, d)) kills++; });
      });
      if (!kills) {
        return {
          kind: 'naked', house: house, digits: digits,
          emptyOthers: others.length
        };
      }
    }

    // hidden: n digits that can only go in these n cells
    var confined = [];
    for (var d2 = 1; d2 <= 9; d2++) {
      var spots = board.cellsFor(house, d2);
      if (spots.length && spots.every(function (c) { return cells.indexOf(c) >= 0; })) confined.push(d2);
    }
    if (confined.length === cells.length) {
      var keep = S.maskOf(confined), extra = 0;
      cells.forEach(function (c) { extra += S.popcount(board.cands[c] & ~keep); });
      if (!extra) return { kind: 'hidden', house: house, digits: confined, emptyOthers: others.length };
    }
    return null;
  }

  function label(entry, f) {
    return f && f.technique ? prettyName(f.technique) : 'pattern';
  }

  /** A hint: reveal one house, or one cell of the answer. */
  function hintFor(drill, level, phase) {
    var f = drill.primary;
    if (phase === 'consequence') {
      // Once the pattern is found, hinting at the pattern again is misdirection: the
      // question has changed to "what does it kill?".
      var c = consequences(f);
      var target = c.mode === 'kills' ? c.kills : c.places;
      if (level === 0) {
        return {
          text: c.mode === 'kills'
            ? 'There ' + (target.length === 1 ? 'is 1 candidate' : 'are ' + target.length +
              ' candidates') + ' to remove.'
            : 'It is one of the digits still showing in that cell.',
          view: {}
        };
      }
      if (level === 1 && target.length) {
        return {
          text: 'Look at ' + S.cellName(target[0].cell) + '.',
          view: { focus: [target[0].cell] }
        };
      }
      return {
        text: target.length
          ? 'The ' + target[0].digit + ' in ' + S.cellName(target[0].cell) + ' is one of them.'
          : 'Press Show me.',
        view: { focus: target.map(function (e) { return e.cell; }) }
      };
    }
    if (level === 0) {
      if (f.digits.length && f.digits[0]) {
        // show every digit the pattern is about — naming three and revealing one made a
        // naked triple look like three unrelated singles
        return { text: 'It is about the ' + listOf(f.digits) + '.',
                 view: { solo: f.digits.slice() } };
      }
      return { text: 'Look for bi-value cells.', view: {} };
    }
    if (level === 1 && f.houses.length) {
      return {
        text: 'Start in ' + S.houseName(S.HOUSE_META[f.houses[0]]) + '.',
        view: { houses: [{ house: f.houses[0], kind: 'base' }] }
      };
    }
    return {
      text: 'One of the cells is ' + S.cellName(f.cells[0]) + '.',
      view: { focus: [f.cells[0]] }
    };
  }

  // ------------------------------------------------------------ mixed drill

  /** Techniques worth asking about in the interleaved drill, in curriculum order. */
  var MIXED_POOL = [
    // naked-single only ever fires on the untouched grids (prep 0); every other stored
    // position has already had singles played out, so it never becomes the trivial answer.
    'naked-single', 'hidden-single', 'naked-pair', 'hidden-pair', 'pointing', 'claiming',
    'naked-triple', 'x-wing', 'skyscraper', 'two-string-kite', 'xy-wing',
    'w-wing', 'xyz-wing', 'swordfish', 'coloring-wrap', 'unique-rectangle-1'
  ];

  var PRETTY = {
    'hidden-single': 'Hidden single', 'naked-pair': 'Naked pair', 'hidden-pair': 'Hidden pair',
    'pointing': 'Pointing', 'claiming': 'Claiming', 'naked-triple': 'Naked triple',
    'hidden-triple': 'Hidden triple', 'x-wing': 'X-Wing', 'swordfish': 'Swordfish',
    'skyscraper': 'Skyscraper', 'two-string-kite': '2-String Kite', 'xy-wing': 'XY-Wing',
    'xyz-wing': 'XYZ-Wing', 'w-wing': 'W-Wing', 'coloring-wrap': 'Simple coloring',
    'coloring-trap': 'Coloring trap', 'unique-rectangle-1': 'Unique rectangle',
    'unique-rectangle-2': 'Unique rectangle 2', 'bug-plus-one': 'BUG+1',
    'finned-x-wing': 'Finned X-Wing', 'remote-pairs': 'Remote pairs',
    'xy-chain': 'XY-Chain', 'x-chain': 'X-Chain', 'jellyfish': 'Jellyfish',
    'naked-quad': 'Naked quad', 'naked-single': 'Naked single'
  };

  function prettyName(id) { return PRETTY[id] || id; }

  /**
   * Pick a random position and ask which technique applies. The answer is "the simplest
   * technique that fires here", which is also the right habit: always take the easiest
   * available move.
   */
  /**
   * @param allowed  optional list of technique ids to draw from — normally the ones the
   *                 learner has actually finished. Being asked to name a technique you
   *                 have not met yet teaches nothing except that the site is unfair.
   */
  function makeMixed(seedIndex, allowed) {
    var scope = (allowed && allowed.length)
      ? MIXED_POOL.filter(function (t) { return allowed.indexOf(t) >= 0; })
      : MIXED_POOL;
    if (scope.length < 2) scope = MIXED_POOL;
    var pool = scope.filter(function (t) { return entriesFor(t).length; });
    if (!pool.length) return null;
    var technique = pool[seedIndex % pool.length];
    var list = entriesFor(technique);
    var entry = list[((seedIndex / pool.length) | 0) % list.length];
    var pos = positionOf(entry);

    // The true answer is the easiest technique available in this position — which is also
    // the move that should actually be played.
    var simplest = null, simplestRank = Infinity;
    T.REGISTRY.forEach(function (e) {
      if (e.rank >= simplestRank) return;
      if (scope.indexOf(e.id) < 0 && e.id !== technique) return;
      if (e.run(pos.board).length) { simplest = e.id; simplestRank = e.rank; }
    });
    var answer = simplest || technique;

    // The answer always comes from what the learner has met; the wrong options need not.
    // Otherwise someone two lessons in gets a two-way guess instead of a question.
    var distractors = scope.filter(function (t) { return t !== answer; })
      .concat(MIXED_POOL.filter(function (t) { return t !== answer && scope.indexOf(t) < 0; }))
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    var options = [answer];
    for (var k = 0; k < distractors.length && options.length < 4; k++) {
      var pick = distractors[(seedIndex * 7 + k * 3) % distractors.length];
      if (options.indexOf(pick) < 0) options.push(pick);
    }
    for (var j = 0; j < distractors.length && options.length < 4; j++) {
      if (options.indexOf(distractors[j]) < 0) options.push(distractors[j]);
    }
    // deterministic shuffle
    options.sort(function (a, b) {
      return ((a.charCodeAt(0) * 31 + seedIndex) % 17) - ((b.charCodeAt(0) * 31 + seedIndex) % 17);
    });

    return {
      board: pos.board, givens: pos.givens, answer: answer, options: options,
      finding: T.findAll(pos.board, answer)[0]
    };
  }

  return {
    makeDrill: makeDrill, checkPattern: checkPattern,
    consequences: consequences, consequencePrompt: consequencePrompt,
    checkConsequences: checkConsequences,
    hintFor: hintFor, positionOf: positionOf, entriesFor: entriesFor,
    inertPattern: inertPattern,
    makeMixed: makeMixed, prettyName: prettyName, MIXED_POOL: MIXED_POOL
  };
});
