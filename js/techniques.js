/* techniques.js — technique detectors.
 *
 * Every detector returns "findings" with the same shape, and nothing returns prose that
 * the caller can't reconstruct. That uniformity is what lets one piece of code serve the
 * lesson player, the drill checker, and the free-solve hint button:
 *
 *   {
 *     technique: 'x-wing',
 *     digits:    [5],
 *     cells:     [i, ...]              // the pattern
 *     houses:    [houseIndex, ...]     // where the logic lives
 *     links:     [{a, b, digit, kind}] // 'strong' | 'weak', drawn as lines
 *     eliminations: [{cell, digit}]
 *     extra:     {...}                 // technique-specific roles (pivot, fin, ...)
 *   }
 *
 * A finding is only reported if it eliminates something. A pattern that exists but does
 * no work is not a deduction, and showing one to a learner teaches the wrong lesson.
 */
(function (root, factory) {
  var S = (typeof require === 'function' && typeof module === 'object')
    ? require('./sudoku.js') : root.Sudoku;
  var mod = factory(S);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Techniques = mod;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  var HOUSES = S.HOUSES, HOUSE_META = S.HOUSE_META;

  /**
   * Work counter. Each detector bumps this once per candidate configuration it actually
   * examines — a cell, a house/digit pair, a combination of cells. It is off by default
   * and costs nothing; the "watch a solve" page turns it on to show how much looking a
   * move really took, rather than implying that finding an X-Wing is as cheap as
   * spotting a naked single.
   */
  var WORK = { on: false, n: 0 };
  function work(k) { if (WORK.on) WORK.n += (k === undefined ? 1 : k); }
  function measure(fn) {
    var was = WORK.on, before = WORK.n;
    WORK.on = true; WORK.n = 0;
    var out = fn();
    var used = WORK.n;
    WORK.on = was; WORK.n = before;
    return { result: out, work: used };
  }

  // ---------------------------------------------------------------- helpers

  function combinations(arr, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  function uniqCells(a) {
    var seen = Object.create(null), out = [];
    a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function elimKey(e) { return e.cell + ':' + e.digit; }

  function dedupeElims(elims) {
    var seen = Object.create(null), out = [];
    elims.forEach(function (e) { var k = elimKey(e); if (!seen[k]) { seen[k] = 1; out.push(e); } });
    return out;
  }

  function finding(o) {
    o.digits = o.digits || [];
    o.cells = uniqCells(o.cells || []);
    o.houses = o.houses || [];
    o.links = o.links || [];
    o.eliminations = dedupeElims(o.eliminations || []);
    o.extra = o.extra || {};
    return o;
  }

  /** Cells outside `exclude` that can hold d and see every cell of `group`. */
  function elimsSeeing(board, group, d, exclude) {
    var out = [];
    S.commonPeers(group).forEach(function (c) {
      if (exclude && exclude.indexOf(c) >= 0) return;
      if (board.has(c, d)) out.push({ cell: c, digit: d });
    });
    return out;
  }

  /** Houses in which digit d has exactly two possible cells (i.e. strong links). */
  function strongLinks(board, d) {
    var out = [];
    for (var h = 0; h < 27; h++) {
      var cells = board.cellsFor(h, d);
      if (cells.length === 2) out.push({ house: h, a: cells[0], b: cells[1], digit: d });
    }
    return out;
  }

  // ------------------------------------------------------------- A1 singles

  function nakedSingles(board) {
    var out = [];
    for (var i = 0; i < 81; i++) {
      work();
      if (board.values[i] || board.count(i) !== 1) continue;
      var d = board.candidates(i)[0];
      out.push(finding({
        technique: 'naked-single', digits: [d], cells: [i],
        houses: S.housesOf[i], placements: [{ cell: i, digit: d }],
        eliminations: [{ cell: i, digit: d, placement: true }]
      }));
    }
    return out;
  }

  function hiddenSingles(board) {
    var out = [];
    for (var h = 0; h < 27; h++) {
      for (var d = 1; d <= 9; d++) {
        work();
        var cells = board.cellsFor(h, d);
        if (cells.length !== 1) continue;
        if (board.count(cells[0]) === 1) continue; // that's just a naked single
        out.push(finding({
          technique: 'hidden-single', digits: [d], cells: cells, houses: [h],
          placements: [{ cell: cells[0], digit: d }],
          eliminations: [{ cell: cells[0], digit: d, placement: true }]
        }));
      }
    }
    return out;
  }

  // ------------------------------------------------------------- A2 subsets

  function nakedSubsets(board, size) {
    var out = [];
    for (var h = 0; h < 27; h++) {
      // The "nothing left to eliminate from" test must count ALL empty cells in the
      // house. Applying it to the filtered list meant a house with, say, 4 empties of
      // which exactly 2 were bi-value was skipped outright — a plain naked pair, missed.
      var empties = board.emptyCells(h);
      if (empties.length <= size) continue;
      var small = empties.filter(function (c) { return board.count(c) <= size; });
      if (small.length < size) continue;
      combinations(small, size).forEach(function (combo) {
        work();
        var mask = 0;
        combo.forEach(function (c) { mask |= board.cands[c]; });
        if (S.popcount(mask) !== size) return;
        var digits = S.digitsOf(mask), elims = [];
        HOUSES[h].forEach(function (c) {
          if (combo.indexOf(c) >= 0) return;
          digits.forEach(function (d) { if (board.has(c, d)) elims.push({ cell: c, digit: d }); });
        });
        if (!elims.length) return;
        out.push(finding({
          technique: 'naked-' + ['', '', 'pair', 'triple', 'quad'][size],
          digits: digits, cells: combo, houses: [h], eliminations: elims
        }));
      });
    }
    return out;
  }

  function hiddenSubsets(board, size) {
    var out = [];
    for (var h = 0; h < 27; h++) {
      var live = [];
      for (var d = 1; d <= 9; d++) {
        var cells = board.cellsFor(h, d);
        if (cells.length >= 2 && cells.length <= size) live.push({ digit: d, cells: cells });
      }
      if (live.length < size) continue;
      combinations(live, size).forEach(function (combo) {
        work();
        var set = Object.create(null);
        combo.forEach(function (e) { e.cells.forEach(function (c) { set[c] = 1; }); });
        var cells = Object.keys(set).map(Number);
        if (cells.length !== size) return;
        var digits = combo.map(function (e) { return e.digit; });
        var keep = S.maskOf(digits), elims = [];
        cells.forEach(function (c) {
          S.digitsOf(board.cands[c] & ~keep).forEach(function (d) { elims.push({ cell: c, digit: d }); });
        });
        if (!elims.length) return;
        out.push(finding({
          technique: 'hidden-' + ['', '', 'pair', 'triple', 'quad'][size],
          digits: digits, cells: cells, houses: [h], eliminations: elims
        }));
      });
    }
    return out;
  }

  // --------------------------------------------------- A3 locked candidates

  function lockedCandidates(board) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      for (var b = 0; b < 9; b++) {
        work();
        var cells = board.cellsFor(18 + b, d);
        if (cells.length < 2) continue;
        // pointing: box -> line
        ['row', 'col'].forEach(function (kind) {
          var f = kind === 'row' ? S.rowOf : S.colOf;
          var lines = uniqCells(cells.map(f));
          if (lines.length !== 1) return;
          var line = (kind === 'row' ? 0 : 9) + lines[0];
          var elims = board.cellsFor(line, d)
            .filter(function (c) { return cells.indexOf(c) < 0; })
            .map(function (c) { return { cell: c, digit: d }; });
          if (!elims.length) return;
          out.push(finding({
            technique: 'pointing', digits: [d], cells: cells, houses: [18 + b, line],
            eliminations: elims, extra: { box: 18 + b, line: line, intersection: cells }
          }));
        });
      }
      for (var li = 0; li < 18; li++) {
        var lcells = board.cellsFor(li, d);
        if (lcells.length < 2) continue;
        var boxes = uniqCells(lcells.map(S.boxOf));
        if (boxes.length !== 1) continue;
        var bh = 18 + boxes[0];
        var belims = board.cellsFor(bh, d)
          .filter(function (c) { return lcells.indexOf(c) < 0; })
          .map(function (c) { return { cell: c, digit: d }; });
        if (!belims.length) continue;
        out.push(finding({
          technique: 'claiming', digits: [d], cells: lcells, houses: [li, bh],
          eliminations: belims, extra: { box: bh, line: li, intersection: lcells }
        }));
      }
    }
    return out;
  }

  // ----------------------------------------------------------------- A4 fish

  var FISH_NAME = { 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' };

  function fish(board, size) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      [0, 1].forEach(function (orient) {
        // orient 0: base = rows, cover = columns.  orient 1: the transpose.
        var baseOffset = orient ? 9 : 0, coverOffset = orient ? 0 : 9;
        var posOf = orient ? S.rowOf : S.colOf;
        var pool = [];
        for (var k = 0; k < 9; k++) {
          var cells = board.cellsFor(baseOffset + k, d);
          if (cells.length >= 2 && cells.length <= size) {
            var m = 0;
            cells.forEach(function (c) { m |= S.bit(posOf(c) + 1); });
            pool.push({ house: baseOffset + k, cells: cells, mask: m });
          }
        }
        if (pool.length < size) return;
        combinations(pool, size).forEach(function (combo) {
          work();
          var mask = 0, cells = [];
          combo.forEach(function (e) { mask |= e.mask; cells = cells.concat(e.cells); });
          if (S.popcount(mask) !== size) return;
          var covers = S.digitsOf(mask).map(function (p) { return coverOffset + p - 1; });
          var elims = [];
          covers.forEach(function (ch) {
            board.cellsFor(ch, d).forEach(function (c) {
              if (cells.indexOf(c) < 0) elims.push({ cell: c, digit: d });
            });
          });
          if (!elims.length) return;
          out.push(finding({
            technique: FISH_NAME[size], digits: [d], cells: cells,
            houses: combo.map(function (e) { return e.house; }).concat(covers),
            eliminations: elims,
            extra: {
              orientation: orient ? 'col' : 'row',
              base: combo.map(function (e) { return e.house; }),
              cover: covers
            }
          }));
        });
      });
    }
    return out;
  }

  /**
   * Finned fish: the base houses would form a fish except one house has extra cells,
   * all inside a single box. The fish eliminations survive only where they also see
   * the fin — because either the fish is real, or the fin is the digit.
   */
  function finnedFish(board, size) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      [0, 1].forEach(function (orient) {
        var baseOffset = orient ? 9 : 0, coverOffset = orient ? 0 : 9;
        var posOf = orient ? S.rowOf : S.colOf;
        var pool = [];
        for (var k = 0; k < 9; k++) {
          var cells = board.cellsFor(baseOffset + k, d);
          if (cells.length >= 2 && cells.length <= size + 2) {
            var m = 0;
            cells.forEach(function (c) { m |= S.bit(posOf(c) + 1); });
            pool.push({ house: baseOffset + k, cells: cells, mask: m });
          }
        }
        if (pool.length < size) return;
        combinations(pool, size).forEach(function (combo) {
          var mask = 0;
          combo.forEach(function (e) { mask |= e.mask; });
          if (S.popcount(mask) <= size) return; // that's a plain fish, handled elsewhere
          // try every cover set of `size` positions drawn from the union
          combinations(S.digitsOf(mask), size).forEach(function (positions) {
            var coverMask = S.maskOf(positions);
            var fins = [], body = [];
            combo.forEach(function (e) {
              e.cells.forEach(function (c) {
                if (coverMask & S.bit(posOf(c) + 1)) body.push(c); else fins.push(c);
              });
            });
            if (!fins.length || fins.length > 3) return;
            var finBoxes = uniqCells(fins.map(S.boxOf));
            if (finBoxes.length !== 1) return;
            // each base house must still contribute to the cover
            var ok = combo.every(function (e) { return (e.mask & coverMask) !== 0; });
            if (!ok) return;
            var covers = positions.map(function (p) { return coverOffset + p - 1; });
            var all = body.concat(fins);
            var elims = [];
            covers.forEach(function (ch) {
              board.cellsFor(ch, d).forEach(function (c) {
                if (all.indexOf(c) >= 0) return;
                if (fins.every(function (f) { return S.sees(c, f); })) elims.push({ cell: c, digit: d });
              });
            });
            if (!elims.length) return;
            out.push(finding({
              technique: 'finned-' + FISH_NAME[size], digits: [d], cells: all,
              houses: combo.map(function (e) { return e.house; }).concat(covers),
              eliminations: elims,
              extra: {
                orientation: orient ? 'col' : 'row', fins: fins, body: body,
                base: combo.map(function (e) { return e.house; }), cover: covers
              }
            }));
          });
        });
      });
    }
    return out;
  }

  // -------------------------------------------------- A5 single-digit chains

  /**
   * Skyscraper: two strong links on d in parallel lines, with one end of each in the
   * same perpendicular line. The two far ends must contain d between them.
   */
  function skyscraper(board) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var links = strongLinks(board, d).filter(function (l) { return l.house < 18; });
      combinations(links, 2).forEach(function (pair) {
        work();
        var A = pair[0], B = pair[1];
        var sameKind = (A.house < 9) === (B.house < 9);
        if (!sameKind || A.house === B.house) return;
        var perp = A.house < 9 ? S.colOf : S.rowOf;
        var ends = [[A.a, A.b], [A.b, A.a]];
        ends.forEach(function (ea) {
          [[B.a, B.b], [B.b, B.a]].forEach(function (eb) {
            // ea[0]/eb[0] are the "base" (aligned) ends; ea[1]/eb[1] are the roof.
            if (perp(ea[0]) !== perp(eb[0])) return;
            if (perp(ea[1]) === perp(eb[1])) return;   // that would be an X-Wing
            if (S.boxOf(ea[0]) === S.boxOf(eb[0]) && S.boxOf(ea[1]) === S.boxOf(eb[1])) return;
            var elims = elimsSeeing(board, [ea[1], eb[1]], d, [ea[0], eb[0], ea[1], eb[1]]);
            if (!elims.length) return;
            out.push(finding({
              technique: 'skyscraper', digits: [d],
              cells: [ea[0], ea[1], eb[0], eb[1]],
              houses: [A.house, B.house],
              // ordered as a path (roof - base = base - roof) so chain notation reads off it
              links: [
                { a: ea[1], b: ea[0], digit: d, kind: 'strong' },
                { a: ea[0], b: eb[0], digit: d, kind: 'weak' },
                { a: eb[0], b: eb[1], digit: d, kind: 'strong' }
              ],
              eliminations: elims,
              extra: { base: [ea[0], eb[0]], roof: [ea[1], eb[1]] }
            }));
          });
        });
      });
    }
    return out;
  }

  /** 2-String Kite: a row strong link and a column strong link meeting in one box. */
  function twoStringKite(board) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var links = strongLinks(board, d);
      var rows = links.filter(function (l) { return l.house < 9; });
      var cols = links.filter(function (l) { return l.house >= 9 && l.house < 18; });
      rows.forEach(function (R) {
        cols.forEach(function (C) {
          [[R.a, R.b], [R.b, R.a]].forEach(function (er) {
            [[C.a, C.b], [C.b, C.a]].forEach(function (ec) {
              // er[0] and ec[0] share a box (and are different cells): the hinge.
              if (er[0] === ec[0]) return;
              if (S.boxOf(er[0]) !== S.boxOf(ec[0])) return;
              if (S.boxOf(er[1]) === S.boxOf(ec[1])) return;
              if (S.rowOf(er[1]) === S.rowOf(ec[1]) || S.colOf(er[1]) === S.colOf(ec[1])) return;
              var all = [er[0], er[1], ec[0], ec[1]];
              if (uniqCells(all).length !== 4) return;
              var elims = elimsSeeing(board, [er[1], ec[1]], d, all);
              if (!elims.length) return;
              out.push(finding({
                technique: 'two-string-kite', digits: [d], cells: all,
                houses: [R.house, C.house, 18 + S.boxOf(er[0])],
                links: [
                  { a: er[1], b: er[0], digit: d, kind: 'strong' },
                  { a: er[0], b: ec[0], digit: d, kind: 'weak' },
                  { a: ec[0], b: ec[1], digit: d, kind: 'strong' }
                ],
                eliminations: elims,
                extra: { hinge: [er[0], ec[0]], ends: [er[1], ec[1]] }
              }));
            });
          });
        });
      });
    }
    return out;
  }

  /**
   * Simple coloring. Paint each strong-link network in two alternating colors, then:
   *   trap  — two cells of one color see each other  -> that whole color is false
   *   wrap  — an uncolored cell sees both colors    -> it cannot hold the digit
   */
  function simpleColoring(board) {
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var links = strongLinks(board, d);
      var adj = Object.create(null);
      links.forEach(function (l) {
        (adj[l.a] = adj[l.a] || []).push(l.b);
        (adj[l.b] = adj[l.b] || []).push(l.a);
      });
      var color = Object.create(null), done = Object.create(null);
      Object.keys(adj).map(Number).forEach(function (start) {
        if (done[start]) return;
        var comp = [], queue = [start];
        color[start] = 0; done[start] = 1;
        while (queue.length) {
          var cur = queue.shift();
          comp.push(cur);
          (adj[cur] || []).forEach(function (nx) {
            if (done[nx]) return;
            color[nx] = 1 - color[cur]; done[nx] = 1; queue.push(nx);
          });
        }
        if (comp.length < 4) return;
        var groups = [comp.filter(function (c) { return color[c] === 0; }),
                      comp.filter(function (c) { return color[c] === 1; })];
        var chainLinks = [];
        links.forEach(function (l) {
          if (comp.indexOf(l.a) >= 0 && comp.indexOf(l.b) >= 0)
            chainLinks.push({ a: l.a, b: l.b, digit: d, kind: 'strong' });
        });

        // rule 2 — a color that sees itself is false
        [0, 1].forEach(function (g) {
          var bad = null;
          combinations(groups[g], 2).forEach(function (p) {
            if (!bad && S.sees(p[0], p[1])) bad = p;
          });
          if (!bad) return;
          var elims = groups[g].map(function (c) { return { cell: c, digit: d }; })
            .filter(function (e) { return board.has(e.cell, e.digit); });
          if (!elims.length) return;
          out.push(finding({
            technique: 'coloring-trap', digits: [d], cells: comp, houses: [],
            links: chainLinks, eliminations: elims,
            extra: { colors: groups, falseColor: g, clash: bad }
          }));
        });

        // rule 4 — an outsider seeing both colors is false
        var elims4 = [];
        for (var i = 0; i < 81; i++) {
          if (!board.has(i, d) || comp.indexOf(i) >= 0) continue;
          var s0 = groups[0].some(function (c) { return S.sees(i, c); });
          var s1 = groups[1].some(function (c) { return S.sees(i, c); });
          if (s0 && s1) elims4.push({ cell: i, digit: d });
        }
        if (elims4.length) {
          out.push(finding({
            technique: 'coloring-wrap', digits: [d], cells: comp, houses: [],
            links: chainLinks, eliminations: elims4, extra: { colors: groups }
          }));
        }
      });
    }
    return out;
  }

  /**
   * X-Chain: an alternating chain on one digit, starting and ending with strong links.
   * Whatever happens, one of the two endpoints holds the digit, so cells seeing both
   * endpoints cannot.  Skyscrapers and kites are the length-3 cases; this finds longer.
   */
  function xChain(board, maxLinks) {
    maxLinks = maxLinks || 7;
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var strong = Object.create(null);
      strongLinks(board, d).forEach(function (l) {
        (strong[l.a] = strong[l.a] || []).push(l.b);
        (strong[l.b] = strong[l.b] || []).push(l.a);
      });
      var starts = Object.keys(strong).map(Number);
      starts.forEach(function (start) {
        // DFS: odd steps are strong links, even steps weak (peer) links.
        var stack = [{ cell: start, path: [start], links: [] }];
        while (stack.length) {
          var node = stack.pop();
          var depth = node.links.length;
          if (depth >= maxLinks) continue;
          var wantStrong = depth % 2 === 0;
          var nexts = wantStrong
            ? (strong[node.cell] || [])
            : allSeeing(board, node.cell, d);
          for (var k = 0; k < nexts.length; k++) {
            var nx = nexts[k];
            if (node.path.indexOf(nx) >= 0) continue;
            var links = node.links.concat([{ a: node.cell, b: nx, digit: d, kind: wantStrong ? 'strong' : 'weak' }]);
            var path = node.path.concat([nx]);
            if (wantStrong && links.length >= 3) {
              var elims = elimsSeeing(board, [start, nx], d, path);
              if (elims.length) {
                out.push(finding({
                  technique: 'x-chain', digits: [d], cells: path, houses: [],
                  links: links, eliminations: elims,
                  extra: { ends: [start, nx], length: links.length }
                }));
              }
            }
            stack.push({ cell: nx, path: path, links: links });
          }
        }
      });
    }
    // shortest chains first — they are the ones worth showing
    out.sort(function (a, b) { return a.links.length - b.links.length; });
    return out;
  }

  function allSeeing(board, cell, d) {
    return S.peers[cell].filter(function (c) { return board.has(c, d); });
  }

  // ------------------------------------------------------------- A6 wings

  function bivalueCells(board) {
    var out = [];
    for (var i = 0; i < 81; i++) if (!board.values[i] && board.count(i) === 2) out.push(i);
    return out;
  }

  function xyWing(board) {
    var out = [], biv = bivalueCells(board);
    biv.forEach(function (pivot) {
      var pd = board.candidates(pivot);
      var wings = biv.filter(function (c) { return c !== pivot && S.sees(c, pivot); });
      combinations(wings, 2).forEach(function (pair) {
        work();
        var A = pair[0], B = pair[1];
        var ad = board.candidates(A), bd = board.candidates(B);
        if (board.cands[A] === board.cands[B]) return;
        // wings must each share exactly one digit with the pivot, and one with each other
        var sharedA = ad.filter(function (x) { return pd.indexOf(x) >= 0; });
        var sharedB = bd.filter(function (x) { return pd.indexOf(x) >= 0; });
        if (sharedA.length !== 1 || sharedB.length !== 1) return;
        if (sharedA[0] === sharedB[0]) return;
        var z = ad.filter(function (x) { return bd.indexOf(x) >= 0; });
        if (z.length !== 1 || pd.indexOf(z[0]) >= 0) return;
        var elims = elimsSeeing(board, [A, B], z[0], [pivot, A, B]);
        if (!elims.length) return;
        out.push(finding({
          technique: 'xy-wing', digits: pd.concat(z), cells: [pivot, A, B], houses: [],
          links: [
            { a: pivot, b: A, digit: sharedA[0], kind: 'weak' },
            { a: pivot, b: B, digit: sharedB[0], kind: 'weak' }
          ],
          eliminations: elims,
          extra: { pivot: pivot, wings: [A, B], z: z[0], x: sharedA[0], y: sharedB[0] }
        }));
      });
    });
    return out;
  }

  function xyzWing(board) {
    var out = [], biv = bivalueCells(board);
    for (var pivot = 0; pivot < 81; pivot++) {
      if (board.values[pivot] || board.count(pivot) !== 3) continue;
      var pd = board.candidates(pivot);
      var wings = biv.filter(function (c) { return S.sees(c, pivot); });
      combinations(wings, 2).forEach(function (pair) {
        var A = pair[0], B = pair[1];
        if (board.cands[A] === board.cands[B]) return;
        if ((board.cands[A] & ~board.cands[pivot]) || (board.cands[B] & ~board.cands[pivot])) return;
        var z = board.candidates(A).filter(function (x) { return board.has(B, x); });
        if (z.length !== 1) return;
        var elims = elimsSeeing(board, [pivot, A, B], z[0], [pivot, A, B]);
        if (!elims.length) return;
        out.push(finding({
          technique: 'xyz-wing', digits: pd, cells: [pivot, A, B], houses: [],
          links: [
            { a: pivot, b: A, digit: z[0], kind: 'weak' },
            { a: pivot, b: B, digit: z[0], kind: 'weak' }
          ],
          eliminations: elims,
          extra: { pivot: pivot, wings: [A, B], z: z[0] }
        }));
      });
    }
    return out;
  }

  /** W-Wing: two matching bi-value cells joined by a strong link on one of their digits. */
  function wWing(board) {
    var out = [], biv = bivalueCells(board);
    combinations(biv, 2).forEach(function (pair) {
      var A = pair[0], B = pair[1];
      if (board.cands[A] !== board.cands[B]) return;
      if (S.sees(A, B)) return;
      var ds = board.candidates(A);
      ds.forEach(function (x) {
        var y = ds[0] === x ? ds[1] : ds[0];
        strongLinks(board, x).forEach(function (l) {
          var ok = (S.sees(l.a, A) && S.sees(l.b, B)) || (S.sees(l.b, A) && S.sees(l.a, B));
          if (!ok) return;
          if ([l.a, l.b].indexOf(A) >= 0 || [l.a, l.b].indexOf(B) >= 0) return;
          var elims = elimsSeeing(board, [A, B], y, [A, B, l.a, l.b]);
          if (!elims.length) return;
          out.push(finding({
            technique: 'w-wing', digits: ds, cells: [A, B, l.a, l.b], houses: [l.house],
            links: [
              { a: A, b: S.sees(l.a, A) ? l.a : l.b, digit: x, kind: 'weak' },
              { a: l.a, b: l.b, digit: x, kind: 'strong' },
              { a: S.sees(l.a, A) ? l.b : l.a, b: B, digit: x, kind: 'weak' }
            ],
            eliminations: elims,
            extra: { pair: [A, B], link: [l.a, l.b], x: x, y: y }
          }));
        });
      });
    });
    return out;
  }

  // ------------------------------------------------------------- A7 chains

  /** Remote pairs: a chain of identical bi-value cells; even-length ends constrain peers. */
  function remotePairs(board) {
    var out = [], biv = bivalueCells(board);
    var byMask = Object.create(null);
    biv.forEach(function (c) { (byMask[board.cands[c]] = byMask[board.cands[c]] || []).push(c); });
    Object.keys(byMask).forEach(function (mk) {
      var group = byMask[mk];
      if (group.length < 4) return;
      var ds = S.digitsOf(+mk);
      group.forEach(function (start) {
        var stack = [{ path: [start] }];
        while (stack.length) {
          var node = stack.pop();
          if (node.path.length > 7) continue;
          var last = node.path[node.path.length - 1];
          group.forEach(function (nx) {
            if (node.path.indexOf(nx) >= 0 || !S.sees(last, nx)) return;
            var path = node.path.concat([nx]);
            if (path.length >= 4 && path.length % 2 === 0) {
              var elims = ds.reduce(function (acc, d) {
                return acc.concat(elimsSeeing(board, [path[0], nx], d, path));
              }, []);
              if (elims.length) {
                out.push(finding({
                  technique: 'remote-pairs', digits: ds, cells: path, houses: [],
                  links: path.slice(1).map(function (c, k) {
                    return { a: path[k], b: c, digit: 0, kind: k % 2 ? 'weak' : 'strong' };
                  }),
                  eliminations: elims, extra: { ends: [path[0], nx] }
                }));
              }
            }
            stack.push({ path: path });
          });
        }
      });
    });
    out.sort(function (a, b) { return a.cells.length - b.cells.length; });
    return out;
  }

  /**
   * XY-Chain: a chain of bi-value cells where each link shares a digit with the next.
   * If both ends can be the same digit z, every cell seeing both ends loses z.
   */
  function xyChain(board, maxCells) {
    maxCells = maxCells || 6;
    var out = [], biv = bivalueCells(board);
    biv.forEach(function (start) {
      board.candidates(start).forEach(function (z) {
        // enter the chain "as not-z", i.e. the start is the other digit
        var other = board.candidates(start).filter(function (x) { return x !== z; })[0];
        var stack = [{ path: [start], carry: other, links: [] }];
        while (stack.length) {
          var node = stack.pop();
          if (node.path.length >= maxCells) continue;
          var last = node.path[node.path.length - 1];
          for (var k = 0; k < biv.length; k++) {
            var nx = biv[k];
            if (node.path.indexOf(nx) >= 0 || !S.sees(last, nx)) continue;
            if (!board.has(nx, node.carry)) continue;
            var nd = board.candidates(nx).filter(function (x) { return x !== node.carry; })[0];
            var links = node.links.concat([{ a: last, b: nx, digit: node.carry, kind: 'weak' }]);
            var path = node.path.concat([nx]);
            if (nd === z && path.length >= 3) {
              var elims = elimsSeeing(board, [start, nx], z, path);
              if (elims.length) {
                out.push(finding({
                  technique: 'xy-chain', digits: [z], cells: path, houses: [],
                  links: links, eliminations: elims,
                  extra: { ends: [start, nx], z: z }
                }));
              }
            }
            stack.push({ path: path, carry: nd, links: links });
          }
        }
      });
    });
    out.sort(function (a, b) { return a.cells.length - b.cells.length; });
    return out;
  }

  // -------------------------------------------------------- A8 uniqueness

  /** The four corners of every rectangle spanning exactly two boxes. */
  function rectangles() {
    var out = [];
    for (var r1 = 0; r1 < 9; r1++) for (var r2 = r1 + 1; r2 < 9; r2++)
      for (var c1 = 0; c1 < 9; c1++) for (var c2 = c1 + 1; c2 < 9; c2++) {
        var cells = [S.cellAt(r1, c1), S.cellAt(r1, c2), S.cellAt(r2, c1), S.cellAt(r2, c2)];
        var boxes = uniqCells(cells.map(S.boxOf));
        if (boxes.length === 2) out.push(cells);
      }
    return out;
  }
  var RECTS = rectangles();

  function uniqueRectangles(board) {
    var out = [];
    RECTS.forEach(function (cells) {
      work();
      if (cells.some(function (c) { return board.values[c]; })) return;
      // the pair must be a subset of all four cells
      for (var a = 1; a <= 9; a++) for (var b = a + 1; b <= 9; b++) {
        var pm = S.bit(a) | S.bit(b);
        if (!cells.every(function (c) { return (board.cands[c] & pm) === pm; })) continue;
        var extras = cells.filter(function (c) { return board.cands[c] !== pm; });
        if (extras.length === 1) {
          var elims = [a, b].filter(function (d) { return board.has(extras[0], d); })
            .map(function (d) { return { cell: extras[0], digit: d }; });
          if (!elims.length) continue;
          out.push(finding({
            technique: 'unique-rectangle-1', digits: [a, b], cells: cells, houses: [],
            eliminations: elims, extra: { pair: [a, b], extraCells: extras }
          }));
        } else if (extras.length === 2 && S.sees(extras[0], extras[1])) {
          var m0 = board.cands[extras[0]] & ~pm, m1 = board.cands[extras[1]] & ~pm;
          if (m0 !== m1 || S.popcount(m0) !== 1) continue;
          var z = S.digitsOf(m0)[0];
          var elims2 = elimsSeeing(board, extras, z, cells);
          if (!elims2.length) continue;
          out.push(finding({
            technique: 'unique-rectangle-2', digits: [a, b, z], cells: cells, houses: [],
            eliminations: elims2, extra: { pair: [a, b], extraCells: extras, z: z }
          }));
        }
      }
    });
    return out;
  }

  /**
   * BUG+1: if every unsolved cell is bi-value except one with three candidates, the grid
   * would have two solutions unless that cell takes the digit appearing three times in
   * one of its houses.
   */
  function bugPlusOne(board) {
    var tri = null;
    for (var i = 0; i < 81; i++) {
      if (board.values[i]) continue;
      var n = board.count(i);
      if (n === 2) continue;
      if (n === 3 && tri === null) { tri = i; continue; }
      return [];
    }
    if (tri === null) return [];
    // every digit must appear exactly twice in every house, bar the odd one out
    var answer = null;
    board.candidates(tri).forEach(function (d) {
      var thrice = S.housesOf[tri].every(function (h) { return board.cellsFor(h, d).length === 3; });
      if (thrice) answer = d;
    });
    if (answer === null) return [];
    var elims = board.candidates(tri).filter(function (d) { return d !== answer; })
      .map(function (d) { return { cell: tri, digit: d }; });
    if (!elims.length) return [];
    return [finding({
      technique: 'bug-plus-one', digits: [answer], cells: [tri], houses: S.housesOf[tri],
      eliminations: elims, placements: [{ cell: tri, digit: answer }],
      extra: { cell: tri, digit: answer }
    })];
  }

  // ---------------------------------------------------------- the registry

  var REGISTRY = [
    { id: 'naked-single', rank: 1, run: nakedSingles },
    { id: 'hidden-single', rank: 2, run: hiddenSingles },
    { id: 'naked-pair', rank: 3, run: function (b) { return nakedSubsets(b, 2); } },
    { id: 'hidden-pair', rank: 4, run: function (b) { return hiddenSubsets(b, 2); } },
    { id: 'pointing', rank: 5, run: function (b) { return lockedCandidates(b).filter(byId('pointing')); } },
    { id: 'claiming', rank: 5, run: function (b) { return lockedCandidates(b).filter(byId('claiming')); } },
    { id: 'naked-triple', rank: 6, run: function (b) { return nakedSubsets(b, 3); } },
    { id: 'hidden-triple', rank: 7, run: function (b) { return hiddenSubsets(b, 3); } },
    { id: 'naked-quad', rank: 8, run: function (b) { return nakedSubsets(b, 4); } },
    { id: 'x-wing', rank: 9, run: function (b) { return fish(b, 2); } },
    { id: 'skyscraper', rank: 10, run: skyscraper },
    { id: 'two-string-kite', rank: 10, run: twoStringKite },
    { id: 'xy-wing', rank: 11, run: xyWing },
    { id: 'w-wing', rank: 11, run: wWing },
    { id: 'xyz-wing', rank: 12, run: xyzWing },
    { id: 'swordfish', rank: 13, run: function (b) { return fish(b, 3); } },
    { id: 'coloring-trap', rank: 14, run: function (b) { return simpleColoring(b).filter(byId('coloring-trap')); } },
    { id: 'coloring-wrap', rank: 14, run: function (b) { return simpleColoring(b).filter(byId('coloring-wrap')); } },
    // `uniqueness: true` marks a deduction that is sound only because the puzzle is known
    // to have exactly one solution. Valid on any published puzzle — but not on a grid the
    // user has edited, which may no longer be a proper puzzle at all.
    { id: 'unique-rectangle-1', rank: 15, uniqueness: true, run: function (b) { return uniqueRectangles(b).filter(byId('unique-rectangle-1')); } },
    { id: 'unique-rectangle-2', rank: 15, uniqueness: true, run: function (b) { return uniqueRectangles(b).filter(byId('unique-rectangle-2')); } },
    { id: 'bug-plus-one', rank: 15, uniqueness: true, run: bugPlusOne },
    { id: 'finned-x-wing', rank: 16, run: function (b) { return finnedFish(b, 2); } },
    { id: 'jellyfish', rank: 17, run: function (b) { return fish(b, 4); } },
    { id: 'remote-pairs', rank: 18, run: remotePairs },
    { id: 'xy-chain', rank: 19, run: xyChain },
    { id: 'x-chain', rank: 20, run: xChain }
  ];

  function byId(id) { return function (f) { return f.technique === id; }; }

  function detector(id) {
    for (var i = 0; i < REGISTRY.length; i++) if (REGISTRY[i].id === id) return REGISTRY[i];
    return null;
  }

  function findAll(board, id) {
    var d = detector(id);
    return d ? d.run(board) : [];
  }

  /**
   * The easiest available deduction, by registry rank. Used for hints and for solving.
   * Pass {noUniqueness: true} when the grid is not known to have exactly one solution —
   * the uniqueness techniques assume it does, and are unsound without it.
   */
  function nextStep(board, maxRank, opts) {
    var cap = (maxRank === undefined || maxRank === null) ? Infinity : maxRank;
    for (var i = 0; i < REGISTRY.length; i++) {
      var entry = REGISTRY[i];
      if (entry.rank > cap) continue;         // cap 0 means "apply nothing" — the raw grid
      if (opts && opts.noUniqueness && entry.uniqueness) continue;
      var found = entry.run(board);
      if (found.length) return found[0];
    }
    return null;
  }

  function applyFinding(board, f) {
    var changed = false;
    (f.placements || []).forEach(function (p) { board.place(p.cell, p.digit); changed = true; });
    if (!f.placements || !f.placements.length) {
      f.eliminations.forEach(function (e) { if (board.eliminate(e.cell, e.digit)) changed = true; });
    }
    return changed;
  }

  /**
   * Solve as far as techniques of rank <= maxRank allow, optionally stopping after
   * `stepLimit` deductions. Returns {board, steps, solved, hardest}.
   *
   * The (maxRank, stepLimit) pair is how the site addresses a position: replaying it is
   * deterministic, so generated lesson content is just a puzzle plus these two numbers.
   */
  function solveWith(board, maxRank, stepLimit) {
    var b = board.clone(), steps = [], hardest = 0, guard = 0;
    var cap = (stepLimit === undefined || stepLimit === null) ? Infinity : stepLimit;
    while (guard++ < 400 && steps.length < cap) {
      var f = nextStep(b, maxRank);
      if (!f) break;
      var entry = detector(f.technique);
      hardest = Math.max(hardest, entry ? entry.rank : 0);
      if (!applyFinding(b, f)) break;
      steps.push(f);
      if (b.isSolved()) break;
    }
    return { board: b, steps: steps, solved: b.isSolved(), hardest: hardest };
  }

  return {
    REGISTRY: REGISTRY, detector: detector, findAll: findAll,
    measure: measure, WORK: WORK,
    nextStep: nextStep, applyFinding: applyFinding, solveWith: solveWith,
    strongLinks: strongLinks, bivalueCells: bivalueCells, combinations: combinations,
    nakedSingles: nakedSingles, hiddenSingles: hiddenSingles,
    nakedSubsets: nakedSubsets, hiddenSubsets: hiddenSubsets,
    lockedCandidates: lockedCandidates, fish: fish, finnedFish: finnedFish,
    skyscraper: skyscraper, twoStringKite: twoStringKite, simpleColoring: simpleColoring,
    xChain: xChain, xyWing: xyWing, xyzWing: xyzWing, wWing: wWing,
    remotePairs: remotePairs, xyChain: xyChain,
    uniqueRectangles: uniqueRectangles, bugPlusOne: bugPlusOne
  };
});
