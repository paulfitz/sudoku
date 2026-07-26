/* checks/widgets.js — the "how to hunt" widgets.
 *
 * These exist because a search procedure written as prose is not a search procedure. Each
 * one has to actually run the hunt: pick something, watch the grid respond, get told
 * whether it paid. The assertions below check the running, not the wording.
 *
 * Part of the inside-knowledge suite — see tools/smoke.js.
 */
'use strict';

module.exports = async function (page) {
  // --- hidden singles: the scanning trainer -------------------------------
  await page.hash('#/lesson/hidden-single');
  var counts = await page.count('.card.hunt .digit-strip .count');
  if (counts !== 9) page.fail('scan trainer: expected 9 digit counts, got ' + counts);
  var paid = 0;
  for (var d = 1; d <= 9; d++) {
    await page.clickText('.card.hunt .digit-strip .btn.digit', String(d));
    var strikes = await page.count('.card.hunt .strike');
    if (!strikes) page.fail('scan trainer: scanning ' + d + ' drew no cross-hatch');
    var r = await page.text('.card.hunt .step-text');
    if (!/Yes\.|Nothing forced/.test(r)) page.fail('scan trainer: no verdict for ' + d);
    if (/Yes\./.test(r)) paid++;
  }
  if (!paid) page.fail('scan trainer: no digit paid off in this position');
  var tally = await page.text('.card.hunt .tally');
  if (!/averaged/.test(String(tally))) page.fail('scan trainer: tally never compares the two groups');
  page.log('scan trainer: 9 digits scanned, ' + paid + ' paid — ' +
    String(tally).replace(/\s+/g, ' ').trim());

  // --- X-Wing: the fish scanner -------------------------------------------
  await page.hash('#/lesson/x-wing');
  var viable = await page.eval(
    '(function(){var picks=document.querySelectorAll(".card.hunt .digit-strip .pick");' +
    ' for(var i=0;i<picks.length;i++){' +
    '   if(parseInt(picks[i].querySelector(".count").textContent,10)>=2){' +
    '     picks[i].querySelector("button").click(); return i+1; } }' +
    ' return 0;})()');
  if (!viable) page.fail('fish scanner: no digit had two candidate lines');
  var rows = await page.count('.scan-row .btn.scan-pick');
  if (rows < 2) page.fail('fish scanner: fewer than two two-home lines listed');
  await page.eval('(function(){var b=document.querySelectorAll(".scan-row .btn.scan-pick");' +
    'b[0].click(); b[1].click();})()');
  var verdict = await page.text('.card.hunt .step-text');
  if (!/X-Wing|No fish/i.test(String(verdict))) page.fail('fish scanner: no verdict on a pair of lines');
  page.log('fish scanner: digit ' + viable + ', ' + rows + ' two-home lines — ' +
    String(verdict).replace(/\s+/g, ' ').trim().slice(0, 80));

  // --- colouring: paint it yourself ---------------------------------------
  await page.hash('#/lesson/coloring');
  var started = await page.eval(
    '(function(){var cells=document.querySelectorAll(".card.hunt .board-grid .cell");' +
    ' for(var i=0;i<cells.length;i++){ cells[i].click();' +
    '   if(/Started at/.test(document.querySelector(".card.hunt .step-text").textContent)) return true; }' +
    ' return false;})()');
  if (!started) page.fail('paint trainer: no cell could start a network');
  var done = await page.eval(
    '(function(){var cells=document.querySelectorAll(".card.hunt .board-grid .cell");' +
    ' for(var pass=0;pass<10;pass++){ for(var i=0;i<cells.length;i++){ cells[i].click();' +
    '   if(/Network complete/.test(document.querySelector(".card.hunt .step-text").textContent))' +
    '     return document.querySelector(".card.hunt .step-text").textContent; } }' +
    ' return null;})()');
  if (!done) page.fail('paint trainer: the network never completed');
  else if (!/sees\s+both|contradicted itself|pays nothing/i.test(done)) {
    page.fail('paint trainer: completed without reaching a conclusion');
  } else {
    page.log('paint trainer: ' + done.replace(/\s+/g, ' ').trim().slice(-95));
  }

  // --- hidden pairs: the digit-position table -----------------------------
  await page.hash('#/lesson/hidden-pairs');
  var trows = await page.count('.ptable tbody tr');
  var twospot = await page.count('.ptable tr.twospot');
  if (!trows) page.fail('position table: no rows rendered');
  if (twospot < 2) page.fail('position table: fewer than two digits with exactly two homes');
  var res = await page.eval(
    '(function(){' +
    ' var e=window.Drills.entriesFor("hidden-pair")[0];' +
    ' var f=window.Techniques.findAll(window.Drills.positionOf(e).board,"hidden-pair")[0];' +
    ' var want=f.digits, hit=0;' +
    ' [].forEach.call(document.querySelectorAll(".ptable tbody tr"),function(r){' +
    '   var d=+r.querySelector(".digit-cell").textContent;' +
    '   if(want.indexOf(d)>=0){ r.querySelector(".digit-cell").click(); hit++; } });' +
    ' return hit;})()');
  if (res < 2) page.fail('position table: the pair digits were not both selectable');
  var tv = await page.text('.card.hunt .step-text');
  if (!/that is a hidden pair/i.test(String(tv))) {
    page.fail('position table: selecting the real pair was not recognised — "' +
      String(tv).replace(/\s+/g, ' ').trim().slice(-90) + '"');
  }
  page.log('position table: ' + trows + ' digit rows, ' + twospot +
    ' with two homes; selecting the real pair is recognised');
};
