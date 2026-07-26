/* sudoku.js — grid model, candidate bookkeeping, and a brute-force solver.
 *
 * Loadable both in the browser (attaches window.Sudoku) and in Node (module.exports),
 * so the offline puzzle generator and the test suite run the exact same code the site
 * uses. No ES modules: the site must work when opened from a file:// URL.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Sudoku = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- geometry

  var N = 81;

  function rowOf(i) { return (i / 9) | 0; }
  function colOf(i) { return i % 9; }
  function boxOf(i) { return ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0); }
  function cellAt(r, c) { return r * 9 + c; }

  // The 27 houses, in a fixed order: rows 0-8, cols 9-17, boxes 18-26.
  var HOUSES = [];
  var HOUSE_META = [];
  (function buildHouses() {
    var h, i, r, c, b;
    for (r = 0; r < 9; r++) {
      h = [];
      for (c = 0; c < 9; c++) h.push(cellAt(r, c));
      HOUSES.push(h); HOUSE_META.push({ type: 'row', index: r });
    }
    for (c = 0; c < 9; c++) {
      h = [];
      for (r = 0; r < 9; r++) h.push(cellAt(r, c));
      HOUSES.push(h); HOUSE_META.push({ type: 'col', index: c });
    }
    for (b = 0; b < 9; b++) {
      h = [];
      var br = ((b / 3) | 0) * 3, bc = (b % 3) * 3;
      for (i = 0; i < 9; i++) h.push(cellAt(br + ((i / 3) | 0), bc + (i % 3)));
      HOUSES.push(h); HOUSE_META.push({ type: 'box', index: b });
    }
  })();

  var ROW_HOUSE = function (r) { return r; };
  var COL_HOUSE = function (c) { return 9 + c; };
  var BOX_HOUSE = function (b) { return 18 + b; };

  // housesOf[i] = [rowHouse, colHouse, boxHouse] indices for cell i
  var housesOf = [];
  for (var i = 0; i < N; i++) housesOf.push([rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);

  // peers[i] = sorted array of the 20 cells sharing a house with i
  var peers = [];
  var peerSet = [];
  (function buildPeers() {
    for (var i = 0; i < N; i++) {
      var s = Object.create(null);
      housesOf[i].forEach(function (h) {
        HOUSES[h].forEach(function (j) { if (j !== i) s[j] = true; });
      });
      var arr = Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
      peers.push(arr);
      peerSet.push(s);
    }
  })();

  function sees(a, b) { return a !== b && !!peerSet[a][b]; }

  /** Cells that see every cell in `group` (excluding the group itself). */
  function commonPeers(group) {
    var out = [];
    for (var i = 0; i < N; i++) {
      if (group.indexOf(i) >= 0) continue;
      var all = true;
      for (var k = 0; k < group.length; k++) if (!sees(i, group[k])) { all = false; break; }
      if (all) out.push(i);
    }
    return out;
  }

  // ------------------------------------------------------------------ masks

  function bit(d) { return 1 << (d - 1); }
  var ALL = 0x1ff; // digits 1..9

  function maskOf(digits) {
    var m = 0;
    for (var k = 0; k < digits.length; k++) m |= bit(digits[k]);
    return m;
  }

  function digitsOf(mask) {
    var out = [];
    for (var d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
    return out;
  }

  function popcount(m) {
    var n = 0;
    while (m) { m &= m - 1; n++; }
    return n;
  }

  // ------------------------------------------------------------------ board

  /**
   * A puzzle position: solved values plus the live candidate set of each unsolved cell.
   *
   * Candidates start as "everything not excluded by a peer's value" and are then whittled
   * down by technique eliminations. That mutability is the point — a lesson position is
   * "the puzzle after basic techniques have been exhausted", which only exists as a
   * candidate state, not as a set of placements.
   */
  function Board(values, cands) {
    this.values = values ? values.slice() : new Array(N).fill(0);
    this.cands = cands ? cands.slice() : new Array(N).fill(0);
    if (!cands) this.recomputeCandidates();
  }

  Board.fromString = function (s) {
    var vals = new Array(N).fill(0);
    var clean = String(s).replace(/[^0-9.\-*]/g, '');
    if (clean.length < N) throw new Error('puzzle string too short: ' + clean.length);
    for (var i = 0; i < N; i++) {
      var ch = clean[i];
      vals[i] = ch >= '1' && ch <= '9' ? +ch : 0;
    }
    return new Board(vals);
  };

  Board.prototype.clone = function () { return new Board(this.values, this.cands); };

  Board.prototype.toString = function () {
    return this.values.map(function (v) { return v ? String(v) : '.'; }).join('');
  };

  Board.prototype.recomputeCandidates = function () {
    for (var i = 0; i < N; i++) {
      if (this.values[i]) { this.cands[i] = 0; continue; }
      var m = ALL;
      var p = peers[i];
      for (var k = 0; k < p.length; k++) {
        var v = this.values[p[k]];
        if (v) m &= ~bit(v);
      }
      this.cands[i] = m;
    }
  };

  Board.prototype.candidates = function (i) { return digitsOf(this.cands[i]); };
  Board.prototype.has = function (i, d) { return !this.values[i] && (this.cands[i] & bit(d)) !== 0; };
  Board.prototype.count = function (i) { return popcount(this.cands[i]); };
  Board.prototype.isEmpty = function (i) { return !this.values[i]; };

  /** Remove digit d from cell i. Returns true if something changed. */
  Board.prototype.eliminate = function (i, d) {
    if (!this.has(i, d)) return false;
    this.cands[i] &= ~bit(d);
    return true;
  };

  /** Place digit d in cell i and strip it from peers. */
  Board.prototype.place = function (i, d) {
    this.values[i] = d;
    this.cands[i] = 0;
    var p = peers[i];
    for (var k = 0; k < p.length; k++) this.cands[p[k]] &= ~bit(d);
  };

  /** Cells of house h (by index) that can still hold digit d. */
  Board.prototype.cellsFor = function (h, d) {
    var out = [], cells = HOUSES[h];
    for (var k = 0; k < 9; k++) if (this.has(cells[k], d)) out.push(cells[k]);
    return out;
  };

  /** Cells of house h that are still unsolved. */
  Board.prototype.emptyCells = function (h) {
    var out = [], cells = HOUSES[h];
    for (var k = 0; k < 9; k++) if (!this.values[cells[k]]) out.push(cells[k]);
    return out;
  };

  Board.prototype.unsolvedCount = function () {
    var n = 0;
    for (var i = 0; i < N; i++) if (!this.values[i]) n++;
    return n;
  };

  Board.prototype.isSolved = function () { return this.unsolvedCount() === 0; };

  /** A cell with no value and no candidates means the position is dead. */
  Board.prototype.isBroken = function () {
    for (var i = 0; i < N; i++) if (!this.values[i] && !this.cands[i]) return true;
    for (var h = 0; h < 27; h++) {
      var seen = 0;
      for (var k = 0; k < 9; k++) {
        var v = this.values[HOUSES[h][k]];
        if (!v) continue;
        if (seen & bit(v)) return true;
        seen |= bit(v);
      }
      // every digit must be placeable somewhere in the house
      var need = ALL & ~seen;
      var avail = 0;
      for (var k2 = 0; k2 < 9; k2++) avail |= this.cands[HOUSES[h][k2]];
      if ((need & ~avail) !== 0) return true;
    }
    return false;
  };

  // ----------------------------------------------------------------- solver

  /**
   * Brute-force solve with constraint propagation. Returns {count, solution}.
   * `limit` caps the search at 1 or 2 solutions — 2 is enough to test uniqueness.
   */
  function solve(board, limit) {
    limit = limit || 1;
    var found = [];
    var work = board.clone();

    function propagate(b) {
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < N; i++) {
          if (b.values[i]) continue;
          if (!b.cands[i]) return false;
          if (popcount(b.cands[i]) === 1) { b.place(i, digitsOf(b.cands[i])[0]); changed = true; }
        }
        for (var h = 0; h < 27; h++) {
          for (var d = 1; d <= 9; d++) {
            var placed = false, spots = [];
            for (var k = 0; k < 9; k++) {
              var c = HOUSES[h][k];
              if (b.values[c] === d) { placed = true; break; }
              if (b.has(c, d)) spots.push(c);
            }
            if (placed) continue;
            if (spots.length === 0) return false;
            if (spots.length === 1) { b.place(spots[0], d); changed = true; }
          }
        }
      }
      return true;
    }

    function search(b) {
      if (found.length >= limit) return;
      if (!propagate(b)) return;
      var best = -1, bestN = 10;
      for (var i = 0; i < N; i++) {
        if (b.values[i]) continue;
        var n = popcount(b.cands[i]);
        if (n < bestN) { bestN = n; best = i; if (n === 2) break; }
      }
      if (best < 0) { found.push(b.toString()); return; }
      var ds = digitsOf(b.cands[best]);
      for (var k = 0; k < ds.length; k++) {
        var nb = b.clone();
        nb.place(best, ds[k]);
        search(nb);
        if (found.length >= limit) return;
      }
    }

    search(work);
    return { count: found.length, solution: found[0] || null };
  }

  function isUnique(board) { return solve(board, 2).count === 1; }

  // ------------------------------------------------------------- rc notation

  function cellName(i) { return 'r' + (rowOf(i) + 1) + 'c' + (colOf(i) + 1); }

  function cellList(cells) {
    return cells.slice().sort(function (a, b) { return a - b; }).map(cellName).join(', ');
  }

  /** "r1c2,r1c8" -> [1, 7]. Accepts compact forms like r15c2 (rows 1 and 5, col 2). */
  function parseCells(str) {
    var out = [];
    var re = /r([1-9]+)c([1-9]+)/gi, m;
    while ((m = re.exec(str))) {
      for (var a = 0; a < m[1].length; a++)
        for (var b = 0; b < m[2].length; b++)
          out.push(cellAt(+m[1][a] - 1, +m[2][b] - 1));
    }
    return out;
  }

  function houseName(meta) {
    if (meta.type === 'row') return 'row ' + (meta.index + 1);
    if (meta.type === 'col') return 'column ' + (meta.index + 1);
    return 'box ' + (meta.index + 1);
  }

  function houseIndexOf(meta) {
    return meta.type === 'row' ? meta.index : meta.type === 'col' ? 9 + meta.index : 18 + meta.index;
  }

  return {
    N: N, ALL: ALL, HOUSES: HOUSES, HOUSE_META: HOUSE_META,
    rowOf: rowOf, colOf: colOf, boxOf: boxOf, cellAt: cellAt,
    housesOf: housesOf, peers: peers, sees: sees, commonPeers: commonPeers,
    ROW_HOUSE: ROW_HOUSE, COL_HOUSE: COL_HOUSE, BOX_HOUSE: BOX_HOUSE,
    bit: bit, maskOf: maskOf, digitsOf: digitsOf, popcount: popcount,
    Board: Board, solve: solve, isUnique: isUnique,
    cellName: cellName, cellList: cellList, parseCells: parseCells,
    houseName: houseName, houseIndexOf: houseIndexOf
  };
});
