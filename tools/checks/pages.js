/* checks/pages.js — Pages that are not lessons: concept stages, the mixed drill, the playground.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  // --- concept pages can be completed -------------------------------------
  await page.hash('#/lesson/strong-links');
  var before = await page.count('.nav-link.done');
  await page.clickText('.done-card .btn', 'Mark as read');
  var after = await page.count('.nav-link.done');
  if (after <= before) page.fail('concept page: "Mark as read" did not record progress');
  else page.log('concept pages completable (' + before + ' -> ' + after + ' ticked)');

  // --- custom pages -------------------------------------------------------
  await page.hash('#/lesson/geometry');
  await page.click('.board-grid .cell[data-cell="40"]');
  var geo = await page.text('.narrative .step-text');
  if (!geo || geo.indexOf('peers') < 0) page.fail('geometry page: clicking a cell said nothing useful');
  else page.log('geometry: ' + geo.replace(/\s+/g, ' ').trim().slice(0, 80));

  await page.hash('#/lesson/strong-links');
  await page.clickText('.controls .btn.digit', '5');
  var sl = await page.text('.narrative .step-text');
  if (!sl || sl.indexOf('strong') < 0) page.fail('strong links page: digit picker did nothing');
  else page.log('strong links: ' + sl.replace(/\s+/g, ' ').trim().slice(0, 80));
  await page.shot('strong-links');

  await page.hash('#/lesson/aic');
  var aic = await page.text('.chain.big');
  if (!aic || aic.indexOf('r') < 0) page.fail('aic page: no chain notation rendered');
  else page.log('aic notation: ' + aic.replace(/\s+/g, ' ').trim());
  await page.clickText('.aic-item', 'XY-Chain');
  var aic2 = await page.text('.chain.big');
  if (aic2 === aic) page.fail('aic page: switching technique did not update');

  // --- mixed drill --------------------------------------------------------
  await page.hash('#/mixed');
  var scopeLabel = await page.text('.page .controls .btn');
  page.log('mixed drill scope toggle: "' + String(scopeLabel).trim() + '"');
  if (!scopeLabel) page.fail('mixed drill: no scope control');
  var answered = await page.eval(
    '(function(){var bs=[].slice.call(document.querySelectorAll(".option"));' +
    'if(!bs.length) return "no options"; bs[0].click(); return bs.length;})()');
  page.log('mixed drill: ' + answered + ' options');
  var mfb = await page.text('.feedback');
  if (!mfb || mfb.length < 5) page.fail('mixed drill: no feedback after answering');
  await page.clickText('.page .controls .btn', 'Include everything');
  page.log('mixed drill scope switched: "' + String(await page.text('.page .controls .hint-text')).trim() + '"');

  // --- playground ---------------------------------------------------------
  await page.hash('#/play');
  var padCount = await page.count('.board-pane .digit-pad .btn.digit');
  if (padCount < 10) page.fail('playground: expected a digit pad (1-9 + erase), got ' + padCount);
  else page.log('playground digit pad: ' + padCount + ' buttons');

  // digit-first entry must work with no keyboard at all
  var typed = await page.eval(
    '(function(){' +
    ' var cells=[].slice.call(document.querySelectorAll(".board-grid")[0].querySelectorAll(".cell"));' +
    ' var str=cells.map(function(c){var v=c.querySelector(".value").textContent.trim();return v||".";}).join("");' +
    ' var sol=window.Sudoku.solve(window.Sudoku.Board.fromString(str),1).solution;' +
    ' var i=str.indexOf("."); var d=+sol[i];' +
    ' var pads=[].slice.call(document.querySelectorAll(".board-pane .digit-pad .btn.digit"));' +
    ' pads.filter(function(b){return b.textContent==String(d);})[0].click();' +
    ' cells[i].click();' +
    ' var now=cells[i].querySelector(".value").textContent.trim();' +
    ' return now==String(d) ? "placed "+d+" by tapping" : "FAILED (cell shows \\""+now+"\\")";})()');
  page.log('playground: ' + typed);
  if (typed.indexOf('FAILED') >= 0) page.fail('playground: digit-first tap entry did not place a digit');

  await page.clickText('.controls .btn', 'Explain next step');
  var ex = await page.text('.narrative .step-text');
  if (!ex || ex.length < 20) page.fail('playground: Explain produced nothing');
  else page.log('playground explain: ' + ex.replace(/\s+/g, ' ').trim().slice(0, 90));
  await page.clickText('.controls .btn', 'Apply it');
  await page.clickText('.controls .btn', 'Explain next step');
  var ex2 = await page.text('.narrative .step-text');
  if (!ex2 || ex2.length < 20) page.fail('playground: second Explain produced nothing');
  await page.shot('playground');

  // A grid the user has broken must not get a deduction that assumes a unique solution.
  var placed = await page.eval(
    '(function(){' +
    ' var cells=[].slice.call(document.querySelectorAll(".board-grid")[0].querySelectorAll(".cell"));' +
    ' var str=cells.map(function(c){var v=c.querySelector(".value").textContent.trim();' +
    '   return v||".";}).join("");' +
    ' var sol=window.Sudoku.solve(window.Sudoku.Board.fromString(str),1).solution;' +
    ' if(!sol) return "already broken";' +
    ' var i=str.indexOf(".");' +
    ' var wrong=(+sol[i] % 9)+1;' +
    ' cells[i].click();' +
    ' document.dispatchEvent(new KeyboardEvent("keydown",{key:String(wrong)}));' +
    ' return "r"+((i/9|0)+1)+"c"+(i%9+1)+"="+wrong+" (true "+sol[i]+")";})()');
  page.log('playground: placed a wrong digit ' + placed);
  await page.clickText('.controls .btn', 'Explain next step');
  var broken = await page.text('.narrative .step-text');
  if (!broken || broken.indexOf('no solution') < 0) {
    page.fail('playground: gave a deduction on a broken grid instead of flagging it — "' +
      String(broken).replace(/\s+/g, ' ').slice(0, 120) + '"');
  } else {
    page.log('broken-grid guard: ' + broken.replace(/\s+/g, ' ').trim().slice(0, 70));
  }

  // --- watch a solve -------------------------------------------------------
  await page.hash('#/watch');

  // Step zero: the pencil marks have to be worked out before any technique can run, and
  // that cost was previously invisible because the site fills them silently.
  var bareMarks = await page.count('.board-grid .cand:not(.off)');
  if (bareMarks !== 0) page.fail('watch: the grid should start with no pencil marks shown');
  var setupStatus = await page.text('.watch-status');
  if (!/keeping the marks/.test(String(setupStatus))) {
    page.fail('watch: bookkeeping cost is not reported alongside search cost');
  }
  await page.clickText('.narrative .step-nav .btn', 'Fill the pencil marks');
  var filled = await page.count('.board-grid .cand:not(.off)');
  if (filled < 50) page.fail('watch: filling the marks produced only ' + filled);
  var costText = await page.text('.narrative');
  if (!/checks, before a single technique ran/.test(String(costText))) {
    page.fail('watch: the fill cost is not stated');
  }
  page.log('watch step zero: ' + filled + ' marks filled, ' +
    String(setupStatus).replace(/\s+/g, ' ').trim());
  await page.clickText('.narrative .step-nav .btn', 'Now start searching');

  var firstTech = await page.text('.narrative .eyebrow');
  if (!firstTech) page.fail('watch: no technique named for the first move');
  var link = await page.eval(
    '(function(){var a=document.querySelector(".teach-link");' +
    ' return a ? a.getAttribute("href") : null;})()');
  if (!link || link.indexOf('#/lesson/') !== 0) page.fail('watch: no link to the lesson that teaches it');

  // fast-forward the singles, then check the ladder shows the failed attempts too
  await page.clickText('.narrative .step-nav .btn', 'Play all the easy ones');
  var rows = await page.count('.ladder-row');
  var hits = await page.count('.ladder-row.hit');
  if (rows < 2) page.fail('watch: ladder shows only ' + rows + ' row — the rejected attempts are the point');
  if (hits !== 1) page.fail('watch: expected exactly one successful technique, got ' + hits);

  // the successful one must be last: the solver stops at the first thing that works
  var lastIsHit = await page.eval(
    '(function(){var r=document.querySelectorAll(".ladder-row");' +
    ' return r[r.length-1].classList.contains("hit");})()');
  if (!lastIsHit) page.fail('watch: the successful technique is not the last one tried');

  // work counts must be real numbers, and rise with technique complexity
  var work = await page.eval(
    '[].map.call(document.querySelectorAll(".ladder-row .ladder-n"),' +
    'function(e){return +e.textContent;})');
  if (work.some(function (w) { return !(w > 0); })) {
    page.fail('watch: a technique reported zero work — the counter is not wired up');
  }
  var status = await page.text('.watch-status');
  if (!/checks searching/.test(String(status))) page.fail('watch: no cumulative search cost shown');
  if (!/keeping the marks/.test(String(status))) page.fail('watch: no bookkeeping cost shown');
  page.log('watch: ' + rows + ' techniques tried for this move (' + work.join(', ') +
    ' checks), ' + String(status).replace(/\s+/g, ' ').trim());
};
