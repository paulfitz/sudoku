/* checks/hints.js — Invariants a hint must satisfy across every drill on the site.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  // --- a hint must never hide the pattern it names -------------------------
  // Hint 1 names the digits and filters the grid to them. When `solo` took a single digit,
  // a naked triple on {3,4,8} was filtered to just the 3s, so its three cells each showed
  // a lone 3 — the hint erased the pattern it was pointing at.
  var hintProblems = [];
  var techniques = await page.eval(
    'window.Lessons.LESSONS.filter(function(l){return l.technique;}).map(function(l){return l.id;})');
  for (const lid of techniques) {
    await page.hash('#/lesson/' + lid);
    await page.clickText('.drill .btn', 'Hint');
    var res = await page.eval(
      '(function(){' +
      ' var l=window.Lessons.byId("' + lid + '");' +
      ' var d=window.Drills.makeDrill(l.technique,1); if(!d) return null;' +
      ' var want=d.primary.digits.filter(function(x){return x;});' +
      ' if(!want.length) return null;' +
      ' var missing=[];' +
      ' d.primary.cells.forEach(function(c){' +
      '   var el=document.querySelector(\'.drill .cell[data-cell="\'+c+\'"]\');' +
      '   if(!el) return;' +
      '   var vis=[].map.call(el.querySelectorAll(".cand:not(.off)"),function(x){return +x.dataset.digit;});' +
      '   want.forEach(function(w){' +
      '     if (d.board.has(c,w) && vis.indexOf(w)<0) missing.push(c+":"+w);' +
      '   });' +
      ' });' +
      ' return JSON.stringify({want:want, missing:missing});})()');
    if (!res) continue;
    var R = JSON.parse(res);
    if (R.missing.length) {
      hintProblems.push(lid + ': hint names ' + R.want.join(',') +
        ' but hides ' + R.missing.length + ' of those marks in the pattern cells');
    }
  }
  if (hintProblems.length) hintProblems.forEach(function (p) { page.fail(p); });
  else page.log('hint keeps every named digit visible across ' + techniques.length + ' drills');

  // --- the filter row is the only thing that decides what is hidden --------
  // A hint mirrors its digits into the filter row. It used to ALSO keep its own copy, so
  // clearing the row handed control back to the stale copy: "all" showed nothing new.
  await page.hash('#/lesson/naked-triples');
  var everything = await page.eval(
    '(function(){var d=window.Drills.makeDrill("naked-triple",1);var n=0;' +
    ' for(var i=0;i<81;i++) n+=d.board.candidates(i).length; return n;})()');
  var shownAtStart = await page.count('.drill .cand:not(.off)');
  await page.clickText('.drill .btn', 'Hint');
  var shownAfterHint = await page.count('.drill .cand:not(.off)');
  await page.clickText('.filter-row .btn', 'all');
  var shownAfterAll = await page.count('.drill .cand:not(.off)');
  var stillActive = await page.eval(
    'document.querySelectorAll(".filter-row .btn.digit.active").length');
  page.log('filter: ' + shownAtStart + ' marks -> hint ' + shownAfterHint + ' -> all ' + shownAfterAll +
    ' (grid really has ' + everything + ')');
  if (shownAfterHint >= everything) page.fail('hint did not narrow the grid at all');
  if (shownAfterAll !== everything) {
    page.fail('"all" left ' + (everything - shownAfterAll) + ' marks hidden — something ' +
      'other than the filter row is still deciding what shows');
  }
  if (stillActive) page.fail('"all" left ' + stillActive + ' digit buttons active');
};
