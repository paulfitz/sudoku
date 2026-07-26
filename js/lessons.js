/* lessons.js — curriculum content and the stepped walkthrough scripts.
 *
 * Two things live here:
 *
 *   LESSONS  — prose: the hook, the rule, the common mistakes, the drill wording.
 *   SCRIPTS  — a function per technique that turns a *real finding on a real grid* into
 *              a sequence of narrated frames.
 *
 * Scripts never hard-code a cell. They read the finding produced by the detector, so the
 * narration is generated from the same structure the drill checker uses and cannot drift
 * away from what is actually on screen.
 *
 * Frame shape: {text, view} where view is merged over the lesson's base view.
 */
(function (root, factory) {
  var S = (typeof require === 'function' && typeof module === 'object')
    ? require('./sudoku.js') : root.Sudoku;
  var mod = factory(S);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Lessons = mod;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  // ------------------------------------------------------------- utilities

  function frame(text, view) { return { text: text, view: view || {} }; }
  function cn(i) { return '<b class="rc">' + S.cellName(i) + '</b>'; }
  function cl(cells) {
    return cells.slice().sort(function (a, b) { return a - b; }).map(cn).join(' ');
  }
  function hn(h) { return '<b class="rc">' + S.houseName(S.HOUSE_META[h]) + '</b>'; }
  function dg(d) { return '<b class="dig">' + d + '</b>'; }
  function elimMarks(f) {
    return f.eliminations.map(function (e) { return { cell: e.cell, digit: e.digit, kind: 'elim' }; });
  }
  function elimCells(f) {
    return f.eliminations.map(function (e) { return e.cell; });
  }
  function patternMarks(f, digits) {
    var out = [];
    (digits || f.digits).forEach(function (d) {
      f.cells.forEach(function (c) { out.push({ cell: c, digit: d, kind: 'pattern' }); });
    });
    return out;
  }
  function elimSummary(f) {
    var by = {};
    f.eliminations.forEach(function (e) { (by[e.digit] = by[e.digit] || []).push(e.cell); });
    return Object.keys(by).map(function (d) {
      return dg(d) + ' from ' + cl(by[d]);
    }).join('; ');
  }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  /**
   * "Cells seeing both ends" is the payoff of every chain technique and was never drawn —
   * the learner had to verify house membership in their head. This frame tints the
   * intersection of the two endpoints' peers before any elimination is named.
   */
  function zoneFrame(f, ends, digit, extra) {
    var zone = S.commonPeers(ends);
    var cls = {};
    ends.forEach(function (c) { cls[c] = 'a'; });
    zone.forEach(function (c) { cls[c] = 'zone'; });
    var view = {
      focus: ends, keep: zone, dim: true, cellClass: cls,
      links: f.links, solo: digit || null
    };
    Object.keys(extra || {}).forEach(function (k) { view[k] = extra[k]; });
    return frame('So the useful question is: which cells can see <em>both</em> ' +
      cl(ends) + '? Those are shaded here — anything in that zone is hit whichever end ' +
      'turns out to be true.', view);
  }

  // ---------------------------------------------------------------- SCRIPTS

  var SCRIPTS = {};

  SCRIPTS['naked-single'] = function (f) {
    var cell = f.cells[0], d = f.digits[0];
    var tinted = S.housesOf[cell].map(function (x) { return { house: x, kind: 'base' }; });
    return [
      // The first lesson anyone sees: do not dim the grid to nothing. The tinted houses
      // carry the meaning, and the learner needs to be able to read the marks.
      frame('Start with ' + cn(cell) + '. Tinted here are its <b>peers</b> — the row, ' +
        'column and box it belongs to.',
        { focus: [cell], houses: tinted }),
      // Step 2 used to reuse step 1's picture exactly; now the rest of the grid drops away
      // so the peers being talked about are the only thing left lit.
      frame('Those peers are not empty. Between them they already use eight of the nine ' +
        'digits — everything else has faded out here.',
        { focus: [cell], keep: S.peers[cell], dim: true, houses: tinted }),
      frame('So eight of the nine possibilities are gone. Look at what is left in ' +
        cn(cell) + '.',
        { focus: [cell], houses: tinted, dim: true, keep: S.peers[cell],
          marks: [{ cell: cell, digit: d, kind: 'pattern' }] }),
      frame('Only the ' + dg(d) + '. Nothing else fits, so that is the answer — a ' +
        '<b>naked single</b>.',
        { focus: [cell], marks: [{ cell: cell, digit: d, kind: 'true' }] })
    ];
  };

  SCRIPTS['hidden-single'] = function (f) {
    var cell = f.cells[0], h = f.houses[0], d = f.digits[0];
    return [
      frame('Forget "what goes in this cell?" for a moment. Ask the other question: ' +
        '<em>in ' + S.houseName(S.HOUSE_META[h]) + ', where can the ' + dg(d) + ' go?</em>',
        { houses: [{ house: h, kind: 'base' }], focus: S.HOUSES[h], dim: true, solo: d }),
      frame('Exactly one square in that ' + S.HOUSE_META[h].type + ' still has room for it: ' +
        cn(cell) + '.',
        { houses: [{ house: h, kind: 'base' }], focus: [cell], keep: S.HOUSES[h],
          dim: true, solo: d,
          marks: [{ cell: cell, digit: d, kind: 'pattern' }] }),
      frame('So ' + cn(cell) + ' is ' + dg(d) + ' — even though it still shows other ' +
        'candidates. That is what makes it <em>hidden</em>: the cell doesn\'t look decided, ' +
        'the house does.',
        { focus: [cell], marks: [{ cell: cell, digit: d, kind: 'true' }] })
    ];
  };

  SCRIPTS['naked-pair'] = function (f) {
    var h = f.houses[0], ds = f.digits;
    return [
      frame('Two cells in ' + S.houseName(S.HOUSE_META[h]) + ' have shrunk to the same two ' +
        'candidates, ' + dg(ds[0]) + ' and ' + dg(ds[1]) + ': ' + cl(f.cells) + '.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, dim: true,
          marks: patternMarks(f) }),
      frame('It could be this way round…',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, dim: true,
          cellClass: (function () { var c = {}; c[f.cells[0]] = 'a'; c[f.cells[1]] = 'b'; return c; })(),
          marks: [{ cell: f.cells[0], digit: ds[0], kind: 'true' },
                  { cell: f.cells[1], digit: ds[1], kind: 'true' }] }),
      frame('…or this way. We never find out which — and it does not matter, because ' +
        'either way both digits are used up inside these two cells.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, dim: true,
          cellClass: (function () { var c = {}; c[f.cells[0]] = 'b'; c[f.cells[1]] = 'a'; return c; })(),
          marks: [{ cell: f.cells[0], digit: ds[1], kind: 'true' },
                  { cell: f.cells[1], digit: ds[0], kind: 'true' }] }),
      frame('Which leaves none of either digit for the rest of ' +
        S.houseName(S.HOUSE_META[h]) + '. Out they go: ' + elimSummary(f) + '.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  };
  function nakedSubsetScript(f, word) {
    var h = f.houses[0], ds = f.digits;
    return [
      frame(f.cells.length + ' cells in ' + S.houseName(S.HOUSE_META[h]) + ' — ' + cl(f.cells) +
        ' — and between them only ' + ds.length + ' different candidates: ' +
        ds.map(dg).join(', ') + '.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, dim: true,
          marks: patternMarks(f) }),
      frame('Note that they do <em>not</em> each hold all ' + ds.length + ' digits, and ' +
        'they don\'t need to. ' + f.cells.length + ' cells, ' + ds.length +
        ' digits between them, is enough.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, marks: patternMarks(f), dim: true }),
      frame('Those ' + ds.length + ' cells will use up all ' + ds.length + ' digits ' +
        'between them, so there is none left for the rest of ' +
        S.houseName(S.HOUSE_META[h]) + '. Other cells there still <em>show</em> those ' +
        'digits — that is not a problem, it is the point: ' + elimSummary(f) + '.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  }
  SCRIPTS['naked-triple'] = function (f) { return nakedSubsetScript(f, 'triple'); };
  SCRIPTS['naked-quad'] = function (f) { return nakedSubsetScript(f, 'quad'); };

  function hiddenSubsetScript(f, word) {
    var h = f.houses[0], ds = f.digits;
    var marks = patternMarks(f, ds);
    return [
      frame('In ' + S.houseName(S.HOUSE_META[h]) + ', track just these ' + ds.length +
        ' digits: ' + ds.map(dg).join(', ') + '. Where can each of them go?',
        { houses: [{ house: h, kind: 'base' }], focus: S.HOUSES[h], dim: true, marks: marks }),
      frame('All of them are confined to the same ' + ds.length + ' cells: ' + cl(f.cells) +
        '. So those cells will be filled by exactly those digits.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells, dim: true, marks: marks }),
      frame('Which means everything <em>else</em> in those cells is dead — even though ' +
        'each cell still looked busy: ' + elimSummary(f) + '.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells,
          marks: marks.concat(elimMarks(f)) }),
      frame('Same theorem, other side: a hidden ' + word + ' in a house with <em>n</em> ' +
        'empty cells is a naked (n&minus;' + ds.length + ') among the rest. Hidden subsets ' +
        'are harder to <em>see</em>, not harder to justify.',
        { houses: [{ house: h, kind: 'base' }], focus: f.cells,
          marks: marks.concat(elimMarks(f)) })
    ];
  }
  SCRIPTS['hidden-pair'] = function (f) { return hiddenSubsetScript(f, 'pair'); };
  SCRIPTS['hidden-triple'] = function (f) { return hiddenSubsetScript(f, 'triple'); };

  SCRIPTS['pointing'] = function (f) {
    var d = f.digits[0], box = f.extra.box, line = f.extra.line;
    var lineWord = S.HOUSE_META[line].type === 'row' ? 'row' : 'column';
    return [
      frame('One digit at a time. Here are the ' + dg(d) + 's in ' +
        S.houseName(S.HOUSE_META[box]) + '.',
        { houses: [{ house: box, kind: 'base' }], solo: d, focus: S.HOUSES[box], dim: true }),
      frame('They all sit in the same ' + lineWord + ': ' + cl(f.cells) + '. That overlap ' +
        'between the box and the ' + lineWord + ' is the whole trick.',
        { houses: [{ house: box, kind: 'base' }, { house: line, kind: 'cover' }],
          solo: d, focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('The box needs a ' + dg(d) + ' somewhere, and every candidate is in that ' +
        lineWord + '. So the ' + lineWord + '’s ' + dg(d) + ' <em>is</em> in the box — ' +
        'and can’t be anywhere else along it: ' + elimSummary(f) + '.',
        { houses: [{ house: box, kind: 'base' }, { house: line, kind: 'cover' }],
          solo: d, focus: f.cells, marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['claiming'] = function (f) {
    var d = f.digits[0], box = f.extra.box, line = f.extra.line;
    var lineWord = S.HOUSE_META[line].type === 'row' ? 'row' : 'column';
    return [
      frame('The same idea, pointed the other way. Here are the ' + dg(d) + 's in ' +
        S.houseName(S.HOUSE_META[line]) + '.',
        { houses: [{ house: line, kind: 'base' }], solo: d, focus: S.HOUSES[line], dim: true }),
      frame('They are all inside one box: ' + cl(f.cells) + '.',
        { houses: [{ house: line, kind: 'base' }, { house: box, kind: 'cover' }],
          solo: d, focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('So the ' + lineWord + ' <em>claims</em> the box’s ' + dg(d) + ': it must ' +
        'be in the overlap, and the rest of the box loses it — ' + elimSummary(f) + '.',
        { houses: [{ house: line, kind: 'base' }, { house: box, kind: 'cover' }],
          solo: d, focus: f.cells, marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  };

  function fishScript(f, sizeWord) {
    var d = f.digits[0], base = f.extra.base, cover = f.extra.cover;
    var baseWord = f.extra.orientation === 'row' ? 'rows' : 'columns';
    var coverWord = f.extra.orientation === 'row' ? 'columns' : 'rows';
    var n = base.length;
    var steps = [
      frame('Single-digit technique, so drop everything else. Only the ' + dg(d) +
        's are on screen now.',
        { solo: d, dim: false }),
      frame('Look at these ' + n + ' ' + baseWord + ': ' +
        base.map(function (h) { return S.houseName(S.HOUSE_META[h]); }).join(', ') +
        '. In each one the ' + dg(d) + ' has at most ' + n + ' possible homes.',
        { solo: d, houses: base.map(function (h) { return { house: h, kind: 'base' }; }),
          focus: f.cells, dim: true, marks: patternMarks(f),
          links: base.map(function (h) {
            var cs = f.cells.filter(function (c) { return S.HOUSES[h].indexOf(c) >= 0; });
            return cs.length === 2 ? { a: cs[0], b: cs[1], digit: d, kind: 'strong' } : null;
          }).filter(Boolean) }),
      frame('And every one of those homes falls inside the same ' + n + ' ' + coverWord +
        '. That is the whole pattern — nothing about the <em>shape</em>, everything about ' +
        'the count.',
        { solo: d,
          houses: base.map(function (h) { return { house: h, kind: 'base' }; })
            .concat(cover.map(function (h) { return { house: h, kind: 'cover' }; })),
          focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('Now count. ' + n + ' ' + baseWord + ' each need a ' + dg(d) + '. They have only ' +
        n + ' ' + coverWord + ' to put them in, and no ' + coverWord.slice(0, -1) +
        ' can take two. So the ' + n + ' ' + coverWord + ' are used up entirely by these ' +
        baseWord + '.',
        { solo: d,
          houses: cover.map(function (h) { return { house: h, kind: 'cover' }; }),
          focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('Any other ' + dg(d) + ' in those ' + coverWord + ' has nowhere to live: ' +
        elimSummary(f) + '.',
        { solo: d,
          houses: cover.map(function (h) { return { house: h, kind: 'cover' }; }),
          focus: f.cells.concat(elimCells(f)),
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];

    // The X-Wing gets the two-parities demonstration; larger fish would be a mess.
    if (n === 2) {
      var byCover = cover.map(function (h) {
        return f.cells.filter(function (c) { return S.HOUSES[h].indexOf(c) >= 0; });
      });
      var diagA = {}, diagB = {};
      diagA[byCover[0][0]] = 'a'; diagA[byCover[1][1]] = 'a';
      diagB[byCover[0][1]] = 'b'; diagB[byCover[1][0]] = 'b';
      steps.splice(4, 0,
        frame('Check it by hand. Suppose the ' + dg(d) + ' in the first ' +
          baseWord.slice(0, -1) + ' is on this diagonal — then the other ' +
          baseWord.slice(0, -1) + '’s ' + dg(d) + ' is forced to the opposite corner.',
          { solo: d, focus: f.cells, dim: true, cellClass: diagA,
            marks: patternMarks(f) }),
        frame('Or the other diagonal. Those are the only two options — and in both, one ' +
          dg(d) + ' lands in each of the two ' + coverWord + '.',
          { solo: d, focus: f.cells, dim: true, cellClass: diagB,
            marks: patternMarks(f) }));
    }
    return steps;
  }
  SCRIPTS['x-wing'] = function (f) { return fishScript(f, 'X-Wing'); };
  SCRIPTS['swordfish'] = function (f) { return fishScript(f, 'Swordfish'); };
  SCRIPTS['jellyfish'] = function (f) { return fishScript(f, 'Jellyfish'); };

  SCRIPTS['finned-x-wing'] = function (f) {
    var d = f.digits[0], fins = f.extra.fins, body = f.extra.body;
    var cover = f.extra.cover, base = f.extra.base;
    var coverWord = f.extra.orientation === 'row' ? 'columns' : 'rows';
    var finClass = {};
    fins.forEach(function (c) { finClass[c] = 'b'; });
    return [
      frame('Only the ' + dg(d) + 's again. These four cells ' + cl(body) +
        ' look like an X-Wing.',
        { solo: d, focus: body, dim: true, marks: patternMarks({ cells: body, digits: [d] }) }),
      frame('But it isn’t one. One base line has ' +
        plural(fins.length, 'an extra cell', 'extra cells') + ' outside the pattern: ' +
        cl(fins) + '. That is the <em>fin</em>.',
        { solo: d, focus: body.concat(fins), dim: true, cellClass: finClass,
          houses: base.map(function (h) { return { house: h, kind: 'base' }; }),
          marks: patternMarks({ cells: body, digits: [d] }) }),
      frame('Split into two cases. <b>Case 1:</b> the fin is the ' + dg(d) +
        '. Then everything the fin sees loses the ' + dg(d) + '.',
        { solo: d, focus: fins, dim: true, cellClass: finClass,
          marks: [{ cell: fins[0], digit: d, kind: 'true' }] }),
      frame('<b>Case 2:</b> the fin is not the ' + dg(d) + '. Then the X-Wing is genuine, ' +
        'and the two ' + coverWord + ' are cleared as usual.',
        { solo: d, focus: body, dim: true,
          houses: cover.map(function (h) { return { house: h, kind: 'cover' }; }),
          marks: patternMarks({ cells: body, digits: [d] }) }),
      frame('So only cells caught by <em>both</em> cases die — the normal X-Wing ' +
        'eliminations that also see the fin: ' + elimSummary(f) + '.',
        { solo: d, focus: body.concat(fins).concat(elimCells(f)), cellClass: finClass,
          marks: patternMarks({ cells: body.concat(fins), digits: [d] }).concat(elimMarks(f)) })
    ];
  };

  function turbotScript(f, opts) {
    var d = f.digits[0];
    var ends = opts.ends, hinge = opts.hinge;
    var cls = {};
    ends.forEach(function (c) { cls[c] = 'a'; });
    return [
      frame('One digit: the ' + dg(d) + 's. Two of the houses here have only two places ' +
        'left for it.',
        { solo: d, dim: false, links: f.links.filter(function (l) { return l.kind === 'strong'; }),
          houses: f.houses.filter(function (h) { return h < 18; })
            .map(function (h) { return { house: h, kind: 'base' }; }) }),
      frame('A solid line is a <b>strong link</b>: one end or the other <em>must</em> be ' +
        'the ' + dg(d) + '. Read it as "at least one of these two is true".',
        { solo: d, focus: f.cells, dim: true, links: f.links, marks: patternMarks(f) }),
      frame(opts.hingeText, { solo: d, focus: f.cells, dim: true, links: f.links,
        cellClass: (function () { var c = {}; hinge.forEach(function (x) { c[x] = 'b'; }); return c; })(),
        marks: patternMarks(f) }),
      // One hop per frame. Four inferences in a single static picture was where readers
      // reported losing the thread.
      frame('Chase it through. Suppose ' + cn(ends[0]) + ' is <em>not</em> the ' + dg(d) + '.',
        { solo: d, focus: [ends[0]], dim: true, links: f.links,
          marks: [{ cell: ends[0], digit: d, kind: 'elim' }] }),
      frame('Then its strong link forces ' + cn(hinge[0]) + ' to be the ' + dg(d) + '.',
        { solo: d, focus: [ends[0], hinge[0]], dim: true, links: f.links,
          marks: [{ cell: ends[0], digit: d, kind: 'elim' },
                  { cell: hinge[0], digit: d, kind: 'true' }] }),
      frame('Which kills the ' + dg(d) + ' in ' + cn(hinge[1]) + ' — the weak link.',
        { solo: d, focus: [hinge[0], hinge[1]], dim: true, links: f.links,
          marks: [{ cell: hinge[0], digit: d, kind: 'true' },
                  { cell: hinge[1], digit: d, kind: 'elim' }] }),
      frame('And that forces ' + cn(ends[1]) + '. So <b>at least one of ' + cl(ends) +
        ' is a ' + dg(d) + '</b> — we just never learn which.',
        { solo: d, focus: f.cells, dim: true, links: f.links, cellClass: cls,
          marks: [{ cell: hinge[1], digit: d, kind: 'elim' },
                  { cell: ends[1], digit: d, kind: 'true' }] }),
      zoneFrame(f, ends, d),
      frame('Every ' + dg(d) + ' in that zone is doomed either way — ' + elimSummary(f) + '.',
        { solo: d, focus: f.cells.concat(elimCells(f)), links: f.links, cellClass: cls,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  }

  SCRIPTS['skyscraper'] = function (f) {
    var base = f.extra.base, roof = f.extra.roof;
    var lineType = S.HOUSE_META[f.houses[0]].type === 'row' ? 'column' : 'row';
    return turbotScript(f, {
      ends: roof, hinge: base,
      hingeText: 'The two <em>base</em> cells ' + cl(base) + ' share a ' + lineType +
        ', so they can’t both hold the digit. That dashed line is a <b>weak link</b>: ' +
        '"at most one of these is true".'
    });
  };

  SCRIPTS['two-string-kite'] = function (f) {
    var hinge = f.extra.hinge, ends = f.extra.ends;
    return turbotScript(f, {
      ends: ends, hinge: hinge,
      hingeText: 'One link runs along a row, the other along a column, and they meet in a ' +
        'box: ' + cl(hinge) + ' share it, so at most one of those two is the digit.'
    });
  };

  SCRIPTS['x-chain'] = function (f) {
    var d = f.digits[0], ends = f.extra.ends;
    var cls = {};
    ends.forEach(function (c) { cls[c] = 'a'; });
    return [
      // Build the chain up a layer at a time: strong links, then the weak ones that
      // interleave them. Showing the finished chain twice taught nothing.
      frame('The ' + dg(d) + 's only. Start with the <b>strong</b> links — houses where ' +
        'the ' + dg(d) + ' has just two homes, so one of the pair is true.',
        { solo: d, focus: f.cells, dim: true, marks: patternMarks(f),
          links: f.links.filter(function (l) { return l.kind === 'strong'; }) }),
      frame('Now the <b>weak</b> links that join them, dashed: cells sharing a house, so ' +
        'at most one of each pair is a ' + dg(d) + '. Strong, weak, strong, weak — that ' +
        'alternation is the whole chain.',
        { solo: d, links: f.links, focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('Start at one end and assume the worst: suppose ' + cn(ends[0]) +
        ' is <em>not</em> a ' + dg(d) + '.',
        { solo: d, links: f.links, focus: f.cells, dim: true, cellClass: cls,
          marks: [{ cell: ends[0], digit: d, kind: 'elim' }] }),
      frame('The alternation carries down the chain and forces the far end: ' + cn(ends[1]) +
        ' must be a ' + dg(d) + '. So at least one of the two ends is one.',
        { solo: d, links: f.links, focus: f.cells, dim: true, cellClass: cls,
          marks: [{ cell: ends[0], digit: d, kind: 'elim' },
                  { cell: ends[1], digit: d, kind: 'true' }] }),
      zoneFrame(f, ends, d),
      frame('And so: ' + elimSummary(f) + '.',
        { solo: d, links: f.links, focus: f.cells.concat(elimCells(f)), cellClass: cls,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  };

  function coloringScript(f, rule) {
    var d = f.digits[0], groups = f.extra.colors;
    var cls = {};
    groups[0].forEach(function (c) { cls[c] = 'a'; });
    groups[1].forEach(function (c) { cls[c] = 'b'; });
    var base = [
      frame('One digit, and every strong link it has. Each solid line means "one end or ' +
        'the other is the ' + dg(d) + '".',
        { solo: d, links: f.links, focus: f.cells, dim: true, marks: patternMarks(f) }),
      frame('Now paint. Pick a cell, color it; color its strong-link partner the other ' +
        'color; repeat. The network ends up strictly alternating — and one color is ' +
        'the truth, the other is all false.',
        { solo: d, links: f.links, focus: f.cells, dim: true, cellClass: cls,
          marks: patternMarks(f) })
    ];
    if (rule === 'trap') {
      var clash = f.extra.clash;
      base.push(frame('Look at ' + cl(clash) + '. Same color — and they share a house. ' +
        'They can’t both be the ' + dg(d) + ', so that color cannot be the true one.',
        { solo: d, links: f.links, focus: clash, dim: true, cellClass: cls,
          marks: patternMarks(f) }));
      base.push(frame('One color false means <em>every</em> cell of that color is false: ' +
        elimSummary(f) + '. This is why coloring is worth the effort — one clash clears ' +
        'several cells at once.',
        { solo: d, links: f.links, focus: f.cells, cellClass: cls,
          marks: patternMarks(f).concat(elimMarks(f)) }));
    } else {
      base.push(frame('Now look outside the network, at ' + cl(elimCells(f)) + '. ' +
        plural(elimCells(f).length, 'It sees', 'Each sees') + ' a cell of <em>both</em> colors.',
        { solo: d, links: f.links, focus: elimCells(f), dim: true, cellClass: cls,
          marks: patternMarks(f) }));
      base.push(frame('One of the two colors is true, whichever it turns out to be. So a ' +
        'cell seeing both is dead either way: ' + elimSummary(f) + '.',
        { solo: d, links: f.links, focus: f.cells.concat(elimCells(f)), cellClass: cls,
          marks: patternMarks(f).concat(elimMarks(f)) }));
    }
    return base;
  }
  SCRIPTS['coloring-trap'] = function (f) { return coloringScript(f, 'trap'); };
  SCRIPTS['coloring-wrap'] = function (f) { return coloringScript(f, 'wrap'); };

  SCRIPTS['xy-wing'] = function (f) {
    var p = f.extra.pivot, w = f.extra.wings, z = f.extra.z, x = f.extra.x, y = f.extra.y;
    var pc = {}; pc[p] = 'pivot';
    var ca = {}; ca[p] = 'a'; ca[w[0]] = 'a';
    var cb = {}; cb[p] = 'b'; cb[w[1]] = 'b';
    return [
      frame('Three cells, each with exactly two candidates. ' + cn(p) + ' is the ' +
        '<b>pivot</b> — it sees both of the others.',
        { focus: [p].concat(w), dim: true, cellClass: pc,
          links: [{ a: p, b: w[0], digit: 0, kind: 'weak' }, { a: p, b: w[1], digit: 0, kind: 'weak' }] }),
      frame('The pivot is ' + dg(x) + ' or ' + dg(y) + ' — nothing else. So just try both.',
        { focus: [p].concat(w), dim: true, cellClass: pc,
          marks: [{ cell: p, digit: x, kind: 'pattern' }, { cell: p, digit: y, kind: 'pattern' }] }),
      frame('<b>Branch 1:</b> pivot is ' + dg(x) + '. Then ' + cn(w[0]) + ' can’t be ' +
        dg(x) + ', so it is ' + dg(z) + '.',
        { focus: [p, w[0]], dim: true, cellClass: ca,
          marks: [{ cell: p, digit: x, kind: 'true' }, { cell: w[0], digit: x, kind: 'elim' },
                  { cell: w[0], digit: z, kind: 'true' }] }),
      frame('<b>Branch 2:</b> pivot is ' + dg(y) + '. Then ' + cn(w[1]) + ' can’t be ' +
        dg(y) + ', so <em>it</em> is ' + dg(z) + '.',
        { focus: [p, w[1]], dim: true, cellClass: cb,
          marks: [{ cell: p, digit: y, kind: 'true' }, { cell: w[1], digit: y, kind: 'elim' },
                  { cell: w[1], digit: z, kind: 'true' }] }),
      frame('Both branches end in the same place: <b>one of the two wings is a ' + dg(z) +
        '</b>. The pivot has served its purpose and can be forgotten.',
        { focus: w, dim: true,
          marks: [{ cell: w[0], digit: z, kind: 'pattern' }, { cell: w[1], digit: z, kind: 'pattern' }] }),
      zoneFrame(f, w, z),
      frame('So every cell in that zone loses its ' + dg(z) + ': ' + elimSummary(f) + '.',
        { focus: [p].concat(w).concat(elimCells(f)),
          marks: [{ cell: w[0], digit: z, kind: 'pattern' }, { cell: w[1], digit: z, kind: 'pattern' }]
            .concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['xyz-wing'] = function (f) {
    var p = f.extra.pivot, w = f.extra.wings, z = f.extra.z;
    var pc = {}; pc[p] = 'pivot'; w.forEach(function (c) { pc[c] = 'a'; });
    return [
      frame('Almost an XY-Wing, but the pivot ' + cn(p) + ' has <em>three</em> candidates, ' +
        'and the ' + dg(z) + ' is one of them.',
        { focus: [p].concat(w), dim: true, cellClass: pc,
          marks: [{ cell: p, digit: z, kind: 'pattern' },
                  { cell: w[0], digit: z, kind: 'pattern' },
                  { cell: w[1], digit: z, kind: 'pattern' }] }),
      frame('Three branches now instead of two — but all three of them put a ' + dg(z) +
        ' somewhere in these three cells. Whichever digit the pivot takes, a ' + dg(z) +
        ' appears in ' + cl([p].concat(w)) + '.',
        { focus: [p].concat(w), dim: true, cellClass: pc,
          marks: [{ cell: p, digit: z, kind: 'pattern' },
                  { cell: w[0], digit: z, kind: 'pattern' },
                  { cell: w[1], digit: z, kind: 'pattern' }] }),
      frame('The cost of the extra branch: the elimination zone shrinks. A cell must now ' +
        'see <em>all three</em> cells, not just the two wings — ' + elimSummary(f) + '.',
        { focus: [p].concat(w).concat(elimCells(f)), cellClass: pc,
          marks: [{ cell: p, digit: z, kind: 'pattern' },
                  { cell: w[0], digit: z, kind: 'pattern' },
                  { cell: w[1], digit: z, kind: 'pattern' }].concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['w-wing'] = function (f) {
    var pair = f.extra.pair, link = f.extra.link, x = f.extra.x, y = f.extra.y;
    var cls = {}; pair.forEach(function (c) { cls[c] = 'a'; });
    link.forEach(function (c) { cls[c] = 'b'; });
    return [
      frame('Two cells with the <em>same</em> two candidates, ' + dg(x) + dg(y) + ': ' +
        cl(pair) + '. They do not see each other, so on their own they say nothing.',
        { focus: pair, dim: true, cellClass: cls,
          marks: patternMarks({ cells: pair, digits: [x, y] }) }),
      frame('What connects them is a strong link on the ' + dg(x) + ': in ' +
        hn(f.houses[0]) + ' the ' + dg(x) + ' has only two homes, ' + cl(link) +
        ' — and one of those sees each of our pair cells.',
        { focus: pair.concat(link), dim: true, cellClass: cls,
          links: f.links, marks: patternMarks({ cells: link, digits: [x] })
            .concat(patternMarks({ cells: pair, digits: [x, y] })) }),
      frame('One end of that link is the ' + dg(x) + '. Whichever end it is, it removes ' +
        'the ' + dg(x) + ' from the pair cell it sees — and that cell, having only ' +
        dg(x) + ' and ' + dg(y) + ', becomes ' + dg(y) + '.',
        { focus: pair.concat(link), dim: true, cellClass: cls, links: f.links,
          marks: patternMarks({ cells: pair, digits: [y] }) }),
      frame('So one of ' + cl(pair) + ' is a ' + dg(y) + ', and cells seeing both lose it: ' +
        elimSummary(f) + '.',
        { focus: pair.concat(link).concat(elimCells(f)), cellClass: cls, links: f.links,
          marks: patternMarks({ cells: pair, digits: [y] }).concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['remote-pairs'] = function (f) {
    var ends = f.extra.ends, ds = f.digits;
    var cls = {};
    f.cells.forEach(function (c, k) { cls[c] = k % 2 ? 'b' : 'a'; });
    return [
      frame('A run of cells that all hold the same pair, ' + dg(ds[0]) + dg(ds[1]) + ': ' +
        cl(f.cells) + '. Each one sees the next.',
        { focus: f.cells, dim: true, links: f.links, marks: patternMarks(f) }),
      frame('Because neighbors see each other, they must alternate: if one is ' +
        dg(ds[0]) + ', the next is ' + dg(ds[1] ) + ', the next ' + dg(ds[0]) + ' again...',
        { focus: f.cells, dim: true, links: f.links, cellClass: cls, marks: patternMarks(f) }),
      frame('The chain has an even number of cells, so the two ends ' + cl(ends) +
        ' are <em>opposite</em> colors. Between them they hold both digits.',
        { focus: ends, dim: true, links: f.links, cellClass: cls, marks: patternMarks(f) }),
      frame('So any cell seeing both ends loses both digits: ' + elimSummary(f) + '.',
        { focus: f.cells.concat(elimCells(f)), links: f.links, cellClass: cls,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['xy-chain'] = function (f) {
    var ends = f.extra.ends, z = f.extra.z;
    var cls = {}; ends.forEach(function (c) { cls[c] = 'a'; });
    var walk = f.links.map(function (l) {
      return cn(l.a) + ' &rarr; ' + cn(l.b) + ' <span class="carry">(' + l.digit + ')</span>';
    }).join(' ');
    return [
      frame('Every cell in this chain is bi-value, and each shares a digit with the next: ' +
        cl(f.cells) + '.',
        { focus: f.cells, dim: true, links: f.links, marks: patternMarks({ cells: f.cells, digits: [] }) }),
      frame('Assume the first cell ' + cn(ends[0]) + ' is <em>not</em> ' + dg(z) +
        '. Then it must be its other digit — and that forces its neighbor, which forces ' +
        'the next, all the way along: ' + walk,
        { focus: f.cells, dim: true, links: f.links, cellClass: cls }),
      frame('The far end ' + cn(ends[1]) + ' is forced to be ' + dg(z) + '. So either the ' +
        'first cell is ' + dg(z) + ', or the last one is — one of the two ends is a ' +
        dg(z) + ' no matter what.',
        { focus: ends, dim: true, links: f.links, cellClass: cls,
          marks: [{ cell: ends[0], digit: z, kind: 'pattern' }, { cell: ends[1], digit: z, kind: 'pattern' }] }),
      frame('Same conclusion as always, so the same elimination: cells seeing both ends ' +
        'lose the ' + dg(z) + ' — ' + elimSummary(f) + '.',
        { focus: f.cells.concat(elimCells(f)), links: f.links, cellClass: cls,
          marks: [{ cell: ends[0], digit: z, kind: 'pattern' }, { cell: ends[1], digit: z, kind: 'pattern' }]
            .concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['unique-rectangle-1'] = function (f) {
    var ds = f.extra.pair, extra = f.extra.extraCells[0];
    var floor = f.cells.filter(function (c) { return c !== extra; });
    var cls = {}; floor.forEach(function (c) { cls[c] = 'a'; }); cls[extra] = 'b';
    return [
      frame('Four cells forming a rectangle: two rows, two columns, and — this part ' +
        'matters — only two boxes. ' + cl(f.cells) + '.',
        { focus: f.cells, dim: true, cellClass: cls }),
      frame('All four contain ' + dg(ds[0]) + ' and ' + dg(ds[1]) + '. Three of them ' +
        'contain <em>nothing else</em>.',
        { focus: f.cells, dim: true, cellClass: cls, marks: patternMarks({ cells: f.cells, digits: ds }) }),
      frame('Now the strange step. Imagine ' + cn(extra) + ' also came down to just ' +
        dg(ds[0]) + dg(ds[1]) + '. Then you could fill the rectangle two ways — swap the ' +
        'digits diagonally — and both would be legal. Two solutions.',
        { focus: f.cells, dim: true, cellClass: cls,
          marks: patternMarks({ cells: f.cells, digits: ds }) }),
      frame('A published puzzle has exactly one solution. So that can never happen: ' +
        cn(extra) + ' must end up using one of its <em>other</em> candidates. ' +
        elimSummary(f) + '.',
        { focus: f.cells, cellClass: cls,
          marks: patternMarks({ cells: floor, digits: ds }).concat(elimMarks(f)) }),
      frame('Note what this argument rests on: a fact about the <em>puzzle</em> — that it ' +
        'was published with one solution — not about the rules of sudoku. Some solvers ' +
        'refuse it on principle. It is always valid on real puzzles.',
        { focus: f.cells, cellClass: cls,
          marks: patternMarks({ cells: floor, digits: ds }).concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['unique-rectangle-2'] = function (f) {
    var ds = f.extra.pair, extras = f.extra.extraCells, z = f.extra.z;
    var floor = f.cells.filter(function (c) { return extras.indexOf(c) < 0; });
    var cls = {}; floor.forEach(function (c) { cls[c] = 'a'; });
    extras.forEach(function (c) { cls[c] = 'b'; });
    return [
      frame('Same rectangle shape, ' + cl(f.cells) + ', all four holding ' + dg(ds[0]) +
        dg(ds[1]) + '. Two of them are exactly that pair.',
        { focus: f.cells, dim: true, cellClass: cls,
          marks: patternMarks({ cells: f.cells, digits: ds }) }),
      frame('The other two, ' + cl(extras) + ', each carry the same single extra ' +
        'candidate: ' + dg(z) + '.',
        { focus: extras, dim: true, cellClass: cls,
          marks: patternMarks({ cells: extras, digits: [z] }) }),
      frame('If neither of them were the ' + dg(z) + ', all four cells would be down to ' +
        dg(ds[0]) + dg(ds[1]) + ' — the deadly pattern, two solutions. Impossible.',
        { focus: f.cells, dim: true, cellClass: cls,
          marks: patternMarks({ cells: extras, digits: [z] }) }),
      frame('So one of ' + cl(extras) + ' <em>is</em> the ' + dg(z) + '. Which is the ' +
        'familiar "one of these two" conclusion: cells seeing both lose the ' + dg(z) +
        ' — ' + elimSummary(f) + '.',
        { focus: f.cells.concat(elimCells(f)), cellClass: cls,
          marks: patternMarks({ cells: extras, digits: [z] }).concat(elimMarks(f)) })
    ];
  };

  SCRIPTS['bug-plus-one'] = function (f) {
    var cell = f.extra.cell, d = f.extra.digit;
    return [
      frame('Something odd about this position: <em>every</em> unsolved cell has exactly ' +
        'two candidates — except one. ' + cn(cell) + ' has three.',
        { focus: [cell], dim: true }),
      frame('If that cell also had two, every digit would appear exactly twice in every ' +
        'row, column and box. Grids like that always have an even number of solutions — ' +
        'you can always swap a loop of digits and get another valid fill.',
        { focus: [cell], dim: true }),
      frame('Our puzzle has one solution, so the position cannot be like that. The extra ' +
        'candidate has to be the one that breaks the pattern: in this cell’s row, ' +
        'column and box, the ' + dg(d) + ' appears three times rather than twice.',
        { focus: [cell], keep: S.peers[cell], dim: true,
          houses: S.housesOf[cell].map(function (h) {
            return { house: h, kind: 'base' }; }), solo: d }),
      frame('So ' + cn(cell) + ' is ' + dg(d) + ', and its other candidates go: ' +
        elimSummary(f) + '.',
        { focus: [cell], marks: [{ cell: cell, digit: d, kind: 'true' }].concat(elimMarks(f)) })
    ];
  };

  // Fallback for any technique without bespoke narration.
  function genericScript(f) {
    return [
      frame('The pattern sits in ' + cl(f.cells) + ', on ' +
        plural(f.digits.length, 'digit', 'digits') + ' ' + f.digits.map(dg).join(', ') + '.',
        { focus: f.cells, dim: true, links: f.links, marks: patternMarks(f) }),
      frame('It eliminates ' + elimSummary(f) + '.',
        { focus: f.cells.concat(elimCells(f)), links: f.links,
          marks: patternMarks(f).concat(elimMarks(f)) })
    ];
  }

  function scriptFor(f) {
    return (SCRIPTS[f.technique] || genericScript)(f);
  }

  // ---------------------------------------------------------------- LESSONS

  var GROUPS = [
    { id: 'foundations', title: 'Foundations' },
    { id: 'subsets', title: 'Subsets' },
    { id: 'intersections', title: 'Intersections' },
    { id: 'links', title: 'Strong links' },
    { id: 'fish', title: 'Fish' },
    { id: 'chains', title: 'Chains & coloring' },
    { id: 'wings', title: 'Wings' },
    { id: 'uniqueness', title: 'Uniqueness' },
    { id: 'beyond', title: 'Beyond' }
  ];

  var LESSONS = [
    {
      id: 'geometry', group: 'foundations', skippable: true, title: 'Houses, peers, candidates',
      tagline: 'The vocabulary everything else is built from.',
      custom: 'geometry',
      intro: '<p>A <b>house</b> is any row, column or box. A cell’s <b>peers</b> are the 20 ' +
        'cells sharing a house with it — the ones it <em>sees</em>. A <b>candidate</b> is a ' +
        'digit a cell could still take.</p>' +
        '<p class="muted">On every grid here, <b class="legend-given">heavy digits on a ' +
        'shaded square</b> are the puzzle’s original clues; <span class="legend-solved">' +
        'lighter ones</span> have been worked out already, to bring the puzzle to the ' +
        'position being discussed. Colour is never used to tell those apart — it is ' +
        'reserved for the pattern under discussion.</p>' +
        '<p>Click any cell.</p>'
    },
    {
      id: 'naked-single', group: 'foundations', skippable: true, title: 'Naked singles', se: 'SE 1.2',
      technique: 'naked-single',
      tagline: 'The whole game in one move — and where pencil marks come from.',
      intro: '<p>The small digits in every empty cell are its <b>candidates</b> — pencil ' +
        'marks. A <b>naked single</b> is a cell down to just one. Nothing else fits.</p>' +
        '<p class="muted">They are kept updated for you here, since you cannot discuss an ' +
        'X-Wing without seeing them — but that does cost you scanning practice.</p>',
      rule: '<p>One candidate left in a cell &rarr; that is its digit.</p>',
      mistakes: [
        'Not re-checking the peers afterwards. Each placement frees up 20 other cells.',
        'Hunting for these in a hard puzzle. They run out fast.'
      ],
      drill: { find: 'a cell with only one candidate left' }
    },
    {
      id: 'hidden-single', group: 'foundations', skippable: true, title: 'Hidden singles', se: 'SE 1.5',
      technique: 'hidden-single',
      tagline: 'The mental flip that everything later depends on.',
      intro: '<p>Stop asking <em>"what goes in this cell?"</em> and ask <em>"where in this ' +
        'house does this digit go?"</em></p>' +
        '<p>That flip is the most important habit in sudoku — every technique from here on ' +
        'is phrased in the second language, not the first.</p>',
      huntWidget: 'scan',
      hunt: '<p>Two things fall out of doing that a few times.</p>' +
        '<p><b>Boxes run out of room first</b>, because a box is squeezed by three rows ' +
        'and three columns at once. 56% of hidden singles show up in a box, and one in ten ' +
        'is box-only — invisible if you scan rows and columns alone.</p>' +
        '<p><b>A digit sitting in two boxes of a band is the loudest signal on the grid.</b> ' +
        'Four out of five box hidden singles already have that digit in both of the other ' +
        'boxes of their band or stack — the two strike-out lines are already drawn for you.</p>' +
        '<p><b>After a placement, stop scanning.</b> Re-check only the digit you just ' +
        'placed, plus the three houses the new cell touches. That is not a shortcut you get ' +
        'away with — it is exhaustive. Placing a digit can only remove that digit from cells ' +
        'that see it, so a newly forced single must either be the same digit or sit in a ' +
        'house that just lost a cell.</p>',
      rule: '<p>A digit with only one possible cell in a house goes there — whatever else ' +
        'that cell was showing.</p>',
      mistakes: [
        'Forgetting the cell may still show four other candidates. Hidden means hidden.',
        'Stopping at the box. Half of them turn up in a row or column instead.'
      ],
      drill: { find: 'a cell that is the only place some digit can still go in its row, column or box' }
    },
    {
      id: 'naked-pairs', group: 'subsets', title: 'Naked pairs & triples', se: 'SE 2.6',
      technique: 'naked-pair',
      tagline: 'Two cells, two digits, one deduction.',
      intro: '<p><em>n</em> cells holding only <em>n</em> candidates between them use those ' +
        'digits up. The counting is the point — you never need to know which cell takes ' +
        'which.</p>',
      rule: '<p><em>n</em> cells in one house holding <em>n</em> candidates between them &rarr; ' +
        'remove those candidates from every other cell of that house.</p>',
      mistakes: [
        'Expecting each cell to show all the digits. {1,2} {2,3} {1,3} is a fine triple.',
        'Spotting the pattern and forgetting to do the eliminations.',
        'Worrying that another cell in the house still shows one of the pair\'s digits. ' +
        'That is not a problem, it is the payoff — the two cells use both digits up, so ' +
        'that candidate is exactly what gets struck.'
      ],
      drill: { find: 'two cells in one house with the same two candidates — one that still clears something' }
    },
    {
      id: 'naked-triples', group: 'subsets', title: 'Naked triples in the wild', se: 'SE 3.6',
      technique: 'naked-triple', hideFromGroups: false,
      tagline: 'The same counting, one size up — and much harder to see.',
      intro: '<p>Same rule as pairs; only the spotting is harder, because the three cells ' +
        'rarely look alike.</p>' +
        '<p>The trick: take the cells with 2 or 3 candidates and union their sets.</p>',
      rule: '<p>Three cells whose candidates union to exactly three digits lock those ' +
        'digits in.</p>',
      mistakes: [
        'Pattern-matching the shapes. Union the sets instead.',
        'Including a cell with four candidates — every cell must fit inside the three.',
        'Expecting the rest of the house to be clear of those digits. It usually is not, ' +
        'and that is the whole point — those are the candidates the triple strikes. A ' +
        'triple with nothing left to remove is not a move. Needing the house to be clear ' +
        'is the <em>hidden</em> subset\'s condition, not this one.'
      ],
      drill: { find: 'three cells in one house whose candidates add up to only three digits, with those digits still to clear' }
    },
    {
      id: 'hidden-pairs', group: 'subsets', title: 'Hidden pairs & triples', se: 'SE 3.4',
      technique: 'hidden-pair',
      tagline: 'The same theorem, seen from the other side.',
      intro: '<p>A naked subset wearing a coat. <em>n</em> digits that fit in only <em>n</em> ' +
        'cells own those cells — everything else in them dies.</p>' +
        '<p>Harder to see, because the evidence is spread across the house rather than ' +
        'sitting in one cell.</p>',
      huntWidget: 'table',
      hunt: '<p><b>Exhaust naked subsets first.</b> A hidden pair in a house with ' +
        '<em>k</em> empty cells <em>is</em> a naked (k&minus;2) among the other cells — the ' +
        'same fact from the other side. In a small house the naked reading is far easier to ' +
        'see, so hidden-pair vision only earns its keep in busy houses.</p>' +
        '<p><b>Boxes first</b> — half of them turn up in a box.</p>' +
        '<p><b>Do not bother ranking digits.</b> For hidden <em>singles</em>, digits with ' +
        'three to five already placed give two thirds of all finds. For hidden pairs the ' +
        'distribution is flat, so that habit buys you nothing here.</p>' +
        '<p><b>Snyder notation</b> makes this nearly free: mark a digit in a box only when ' +
        'it has exactly two homes there. A hidden pair is then two marks sitting in the ' +
        'same two cells — the table above, drawn on the grid itself. Those pencilled pairs ' +
        'are also strong links, which is what the chain lessons are built on.</p>',
      rule: '<p><em>n</em> digits confined to <em>n</em> cells &rarr; strip every other ' +
        'candidate from those cells.</p>',
      mistakes: [
        'Cleaning out the rest of the house. A hidden subset cleans the pattern cells.',
        'Not noticing you already had one — in a house with 5 empties, a naked triple <em>is</em> a hidden pair.'
      ],
      drill: { find: 'the two cells that two digits are confined to' }
    },
    {
      id: 'pointing', group: 'intersections', title: 'Pointing pairs', se: 'SE 2.6',
      technique: 'pointing',
      tagline: 'Box tells line.',
      intro: '<p>A row and a box overlap in three cells, and that overlap is a lever. If a ' +
        'digit’s only homes in a box all sit in one row, it lives in the overlap — so it is ' +
        'nowhere else along that row.</p>',
      rule: '<p>Digit confined within a box to a single row or column &rarr; remove it from ' +
        'the rest of that row or column.</p>',
      mistakes: [
        'Eliminating inside the box. The digit stays there; the <em>line</em> gets cleaned.',
        'Only checking boxes with two candidate cells. Three in a line works too.'
      ],
      drill: { find: 'the cells in one box where a digit is trapped in a single row or column' }
    },
    {
      id: 'claiming', group: 'intersections', title: 'Claiming', se: 'SE 2.8',
      technique: 'claiming',
      tagline: 'Line tells box. Same lever, other direction.',
      intro: '<p>Pointing in reverse, and the same single idea: <b>a digit trapped in the ' +
        'overlap of two houses is excluded from the rest of both.</b> Here the row’s homes ' +
        'all fall in one box, so the box is cleared.</p>',
      rule: '<p>Digit confined within a row or column to a single box &rarr; remove it from ' +
        'the rest of that box.</p>',
      mistakes: [
        'Memorising pointing and claiming as two unrelated tricks.',
        'Not re-checking both directions after a placement.'
      ],
      drill: { find: 'the cells in one row or column where a digit is trapped in a single box' }
    },
    {
      id: 'strong-links', group: 'links', title: 'Strong links: the atom',
      custom: 'strong-links',
      tagline: 'Learn this one object and a dozen named techniques collapse into one idea.',
      intro: '<p>Everything from here on is built from one object.</p>' +
        '<p class="callout"><b>Strong link:</b> a digit with exactly two homes in a house — ' +
        '<em>at least one is true</em>. <b>Weak link:</b> two cells sharing a house — ' +
        '<em>at most one is true</em>. Chains alternate the two. That is the whole theory.</p>' +
        '<p>Pick a digit and see every strong link it has.</p>'
    },
    {
      id: 'x-wing', group: 'fish', title: 'X-Wing', se: 'SE 3.2',
      technique: 'x-wing',
      tagline: 'Not a shape. A counting argument that happens to look like a rectangle.',
      intro: '<p><em>Two rows each need this digit; between them they reach only two ' +
        'columns; so those columns are spoken for.</em> That sentence generalizes. The ' +
        'picture of four corners does not.</p>' +
        '<p class="muted">Solvers call this family <b>fish</b>: <em>n</em> lines needing ' +
        'one digit, covered by <em>n</em> crossing lines. X-Wing is n=2, Swordfish n=3, ' +
        'Jellyfish n=4. The names are whimsical; the counting is not. Every fish works on ' +
        'a single digit, which is why the other eight vanish from the grid here.</p>',
      huntWidget: 'fish',
      rule: '<p>Two homes in each of two rows, in the same two columns &rarr; clear both ' +
        'columns. And the same with rows and columns swapped.</p>',
      mistakes: [
        'Only scanning rows. Every X-Wing is visible both ways; scan one way, find half.',
        'Giving up when a row has a third candidate — see finned fish.'
      ],
      drill: { find: 'the four corners of the X-Wing' }
    },
    {
      id: 'swordfish', group: 'fish', title: 'Swordfish & Jellyfish', se: 'SE 3.8',
      technique: 'swordfish',
      tagline: 'Three rows, three columns — and usually not a tidy shape at all.',
      intro: '<p>Same counting, one size up: three rows whose homes for a digit all fall in ' +
        'the same three columns.</p>' +
        '<p>Do not expect a neat 3&times;3. Real swordfish are ragged — rows with only two of ' +
        'the columns still count.</p>',
      rule: '<p><em>n</em> rows whose candidates for a digit all fall within <em>n</em> ' +
        'columns &rarr; clear the digit from the rest of those columns. n=2 X-Wing, ' +
        'n=3 Swordfish, n=4 Jellyfish.</p>',
      mistakes: [
        'Looking for a full 3&times;3 of candidates. Ragged is the norm.',
        'Bothering past n=4. On a 9&times;9 a bigger fish is always a smaller one sideways.'
      ],
      drill: { find: 'the swordfish cells — one digit, three rows, three columns' }
    },
    {
      id: 'finned-fish', group: 'fish', title: 'Finned & sashimi fish', se: 'SE 4.0',
      technique: 'finned-x-wing',
      tagline: 'What to do with the X-Wing that is almost there.',
      intro: '<p>You will find far more <em>almost</em>-X-Wings than real ones — spoiled by ' +
        'one extra candidate, the <b>fin</b>.</p>' +
        '<p>Split into cases: either the fin is the digit, or the fish is genuine. Keep only ' +
        'what both cases agree on.</p>',
      rule: '<p>Fish + extra candidates confined to one box &rarr; keep only the eliminations ' +
        'that also see every fin.</p>',
      mistakes: [
        'Taking the full fish eliminations. Only cells that also see the fin survive.',
        'Allowing fins in two boxes — then the cases agree on nothing.'
      ],
      drill: { find: 'the fish cells and the fin' }
    },
    {
      id: 'skyscraper', group: 'chains', title: 'Skyscraper', se: 'SE 4.0',
      technique: 'skyscraper',
      tagline: 'Two strong links, joined at the base. Your first real chain.',
      intro: '<p>The smallest thing that is genuinely a chain.</p>' +
        '<p>Two parallel lines each have two homes for a digit, and two of those homes line ' +
        'up — so they cannot both be it. Follow that through and one of the other two ends ' +
        'must be the digit.</p>',
      rule: '<p>Two strong links in parallel lines, aligned in one perpendicular line &rarr; ' +
        'cells seeing both far ends lose the digit.</p>',
      mistakes: [
        'Trying to work out <em>which</em> end is the digit. You cannot, and need not.',
        'Forgetting the zone is "sees both ends" — usually a couple of cells, not a line.'
      ],
      drill: { find: 'the four cells of the skyscraper' }
    },
    {
      id: 'kite', group: 'chains', title: '2-String Kite', se: 'SE 4.0',
      technique: 'two-string-kite',
      tagline: 'Same logic, hinged in a box instead.',
      intro: '<p>A row link and a column link, with one end of each in the same box.</p>' +
        '<p>Skyscraper and kite are one technique — two strong links joined by a weak one — ' +
        'differing only in which house joins them. Together: <b>turbot fish</b>.</p>',
      rule: '<p>Strong link in a row + strong link in a column, with one end of each in a ' +
        'shared box &rarr; the cell seeing both far ends loses the digit.</p>',
      mistakes: [
        'Requiring the hinge cells to be one cell. They just need to share a box.',
        'Learning kite, skyscraper and turbot fish as three rules.'
      ],
      drill: { find: 'the four cells of the kite' }
    },
    {
      id: 'coloring', group: 'chains', title: 'Simple coloring', se: 'SE 4.5',
      technique: 'coloring-wrap',
      tagline: 'Chain logic with no insight required — just paint and look.',
      intro: '<p>The mechanical way into chain reasoning — reach for it when you are stuck. ' +
        'One color ends up entirely true and the other entirely false; you never find out ' +
        'which, and it never matters.</p>',
      huntWidget: 'paint',
      rule: '<p><b>Wrap:</b> any cell seeing both colors loses the digit. <b>Trap:</b> if ' +
        'two cells of the same color share a house, that entire color is false.</p>',
      mistakes: [
        'Coloring across a weak link. Only strong links propagate color.',
        'Stopping at the first elimination. Once painted, sweep the whole grid.'
      ],
      drill: { find: 'the cells linked into the colored network' }
    },
    {
      id: 'coloring-trap', group: 'chains', title: 'Coloring: the trap', se: 'SE 4.5',
      technique: 'coloring-trap',
      tagline: 'When a color contradicts itself, it dies wholesale.',
      intro: '<p>If two cells of one color share a house, that color wants the digit twice ' +
        'in one house — impossible.</p>' +
        '<p>So the whole color dies at once and the other is true everywhere. The closest ' +
        'thing to a jackpot in classic sudoku.</p>',
      rule: '<p>Two same-colored cells sharing a house &rarr; every cell of that color ' +
        'loses the digit, and every cell of the other color <em>is</em> the digit.</p>',
      mistakes: [
        'Only eliminating the two clashing cells. The entire color goes.',
        'Forgetting to place the other color — this gives placements, not just eliminations.'
      ],
      drill: { find: 'the cells of the color that contradicts itself' }
    },
    {
      id: 'x-chain', group: 'chains', title: 'X-Chains', se: 'SE 5.6',
      technique: 'x-chain',
      tagline: 'The general single-digit chain. Skyscrapers with more links.',
      intro: '<p>Nothing new — just longer. Alternate the links, start and end strong, and ' +
        'at least one endpoint is the digit.</p>' +
        '<p>Written <span class="chain">(5)r1c1 = (5)r1c5 - (5)r7c5 = (5)r7c9</span>: ' +
        '<span class="chain">=</span> strong, <span class="chain">-</span> weak. Reading ' +
        'that is what unlocks forum posts and solver output.</p>',
      rule: '<p>An alternating chain on one digit, strong at both ends &rarr; cells seeing ' +
        'both endpoints lose the digit.</p>',
      mistakes: [
        'Ending on a weak link. Start and end strong or the conclusion fails.',
        'Chasing length. A long chain is not better, just harder to check.'
      ],
      drill: { find: 'the cells along the chain' }
    },
    {
      id: 'xy-wing', group: 'wings', title: 'XY-Wing', se: 'SE 3.6',
      technique: 'xy-wing',
      tagline: 'A case split with two branches that agree.',
      intro: '<p>A <b>pivot</b> {X,Y} seeing two wings, {X,Z} and {Y,Z}.</p>' +
        '<p>Do not look for a shape — it barely has one. It is a case split: the pivot is X ' +
        'or Y, and both cases put a Z in one of the wings.</p>',
      rule: '<p>Pivot {X,Y} seeing {X,Z} and {Y,Z} &rarr; cells seeing both wings lose Z.</p>',
      mistakes: [
        'Expecting the three cells to be arranged somehow. The pivot just has to see both wings.',
        'Eliminating Z from cells that see only one wing.'
      ],
      drill: { find: 'the pivot and both wings' }
    },
    {
      id: 'xyz-wing', group: 'wings', title: 'XYZ-Wing', se: 'SE 4.4',
      technique: 'xyz-wing',
      tagline: 'One more branch, one smaller elimination zone.',
      intro: '<p>The pivot now holds {X,Y,Z}. Three branches instead of two — and every one ' +
        'still puts a Z among the three cells.</p>' +
        '<p>The price: a victim must see all three cells, not just the wings.</p>',
      rule: '<p>Pivot {X,Y,Z} seeing {X,Z} and {Y,Z} &rarr; cells seeing all three lose Z.</p>',
      mistakes: [
        'Using the XY-Wing elimination zone. Seeing both wings is no longer enough.',
        'Missing that the wings must both be subsets of the pivot\'s candidates.'
      ],
      drill: { find: 'the pivot and both wings' }
    },
    {
      id: 'w-wing', group: 'wings', title: 'W-Wing', se: 'SE 4.4',
      technique: 'w-wing',
      tagline: 'Two identical pairs, joined by a strong link.',
      intro: '<p>Two cells with the <em>same</em> pair {X,Y}, not seeing each other. Alone ' +
        'they say nothing.</p>' +
        '<p>Add a strong link on X touching each of them: one end is X, which kills the X in ' +
        'the cell it sees, forcing that cell to Y.</p>',
      rule: '<p>Two cells both {X,Y}, joined by a strong link on X touching each &rarr; ' +
        'cells seeing both lose Y.</p>',
      mistakes: [
        'Mixing up which digit dies. The strong link is on X; the elimination is on Y.',
        'Letting the two pair cells see each other — then they are just a naked pair.'
      ],
      drill: { find: 'the two matching cells and the strong link' }
    },
    {
      id: 'remote-pairs', group: 'chains', title: 'Remote pairs', se: 'SE 5.0',
      technique: 'remote-pairs',
      tagline: 'A chain of identical pairs that alternates all by itself.',
      intro: '<p>A run of cells all holding the same pair, each seeing the next — so they ' +
        'are forced to alternate.</p>' +
        '<p>Count them. An even-length chain has ends of opposite parity, so between them ' +
        'they take both digits.</p>',
      rule: '<p>Even-length chain of identical bi-value cells &rarr; cells seeing both ends ' +
        'lose both digits.</p>',
      mistakes: [
        'Using an odd-length chain. Then both ends are the same parity and nothing follows.',
        'Forgetting that <em>both</em> digits are eliminated, not just one.'
      ],
      drill: { find: 'the cells of the remote pair chain' }
    },
    {
      id: 'xy-chain', group: 'chains', title: 'XY-Chains', se: 'SE 6.6',
      technique: 'xy-chain',
      tagline: 'Bi-value cells strung end to end.',
      intro: '<p>Where named patterns stop being worth naming. A chain of bi-value cells, ' +
        'each sharing a digit with the next: if the first is not Z, the far end is forced to ' +
        'be.</p>' +
        '<p>An XY-Wing is this with three cells. Remote pairs is this with one repeated pair.</p>',
      rule: '<p>Chain of bi-value cells whose two ends can both be Z &rarr; cells seeing ' +
        'both ends lose Z.</p>',
      mistakes: [
        'Breaking the "shares exactly one digit with the next" requirement.',
        'Building a long chain when a shorter one exists. Always check the short ones first.'
      ],
      drill: { find: 'the cells of the chain' }
    },
    {
      id: 'aic', group: 'chains', title: 'AIC: what all of that was',
      custom: 'aic',
      tagline: 'One notation and one idea behind every technique above.',
      intro: '<p>Here is the payoff for learning strong links as an object rather than as ' +
        'trivia.</p>' +
        '<p>An <b>Alternating Inference Chain</b> is any chain of nodes joined by links ' +
        'that alternate strong and weak, starting and ending strong. Its conclusion is ' +
        'always the same: <em>at least one endpoint is true, so anything incompatible with ' +
        'both endpoints is false.</em></p>' +
        '<p>Every technique below is that one theorem wearing a different hat. Pick one ' +
        'and compare the chain string with the grid: the shape of the argument is ' +
        'identical every time, only the nodes change.</p>' +
        '<p class="muted">An X-Wing is the same thing again, stated as a count rather ' +
        'than a chain: two rows needing a digit, two columns to put it in.</p>'
    },
    {
      id: 'unique-rectangle', group: 'uniqueness', title: 'Unique rectangles', se: 'SE 4.2',
      technique: 'unique-rectangle-1',
      tagline: 'Reasoning from the fact that the puzzle was published.',
      intro: '<p>These feel illegitimate, and here is why: they follow not from the rules, ' +
        'but from the fact that a published puzzle has exactly one solution.</p>' +
        '<p>The <b>deadly pattern</b>: four rectangle corners spanning two boxes, all down to ' +
        'the same pair. Swap the pair diagonally and both fills are legal — two solutions. So ' +
        'it can never happen.</p>',
      rule: '<p>Four cells in two rows, two columns and <em>two boxes</em> all containing ' +
        '{X,Y}, with extras in only one of them &rarr; that cell cannot be X or Y.</p>',
      mistakes: [
        'Forgetting the two-box requirement. Across four boxes it proves nothing.',
        'Using it on a puzzle that might not have a unique solution.'
      ],
      drill: { find: 'the four corners of the rectangle' }
    },
    {
      id: 'ur-type-2', group: 'uniqueness', title: 'Unique rectangle type 2', se: 'SE 4.5',
      technique: 'unique-rectangle-2',
      tagline: 'Two extras, one shared digit, the familiar conclusion.',
      intro: '<p>Same rectangle, but two corners carry the <em>same</em> extra candidate Z.</p>' +
        '<p>If neither took the Z, all four would collapse to the deadly pair. So one of them ' +
        'is Z — the "one of these two" shape yet again.</p>',
      rule: '<p>Rectangle on {X,Y} with two corners carrying the same single extra Z &rarr; ' +
        'cells seeing both of those corners lose Z.</p>',
      mistakes: [
        'Applying it when the two extras differ. They must be the same digit.',
        'Eliminating Z from the rectangle itself rather than from cells seeing both corners.'
      ],
      drill: { find: 'the four corners of the rectangle' }
    },
    {
      id: 'bug', group: 'uniqueness', title: 'BUG+1', se: 'SE 5.6',
      technique: 'bug-plus-one',
      tagline: 'When the grid goes almost entirely bi-value, one cell gives itself away.',
      intro: '<p>A grid where every unsolved cell is bi-value and every digit appears twice ' +
        'in every house always has an <em>even</em> number of solutions — so a proper puzzle ' +
        'can never reach one.</p>' +
        '<p>If you are one candidate away, that candidate is what prevents it.</p>',
      rule: '<p>All cells bi-value except one with three &rarr; that cell takes whichever of ' +
        'its three candidates appears three times in its houses.</p>',
      mistakes: [
        'Checking only the cell counts and not the digit counts. Both must hold.',
        'Trying to apply it while several cells still have three or more candidates.'
      ],
      drill: { find: 'the cell with three candidates' }
    },
    {
      id: 'frontier', group: 'beyond', title: 'Where technique runs out',
      custom: 'frontier',
      tagline: 'ALS, forcing nets, and the point where pattern-finding becomes searching.',
      intro: ''
    }
  ];

  var BY_ID = Object.create(null);
  LESSONS.forEach(function (l, i) { BY_ID[l.id] = l; l.index = i; });

  return {
    GROUPS: GROUPS, LESSONS: LESSONS, byId: function (id) { return BY_ID[id]; },
    scriptFor: scriptFor, SCRIPTS: SCRIPTS,
    helpers: { frame: frame, cn: cn, cl: cl, hn: hn, dg: dg, elimSummary: elimSummary }
  };
});
