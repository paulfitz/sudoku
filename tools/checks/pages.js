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

  // --- strong links: three acts, each of which has to actually do something ------
  //
  // The claim this page makes is not a sentence, it is a behaviour: push one end of a
  // link down and the other comes up; push both down and the house breaks. Assert the
  // behaviour, because the sentence being present proves nothing.
  await page.hash('#/lesson/strong-links');

  // Act 1: the see-saw. Which link the widget opens on is its own decision (it ranks them
  // by how much elbow room the house has), so read the ends off the tinted house rather
  // than recomputing the ranking here — a test that duplicates the choice stops being able
  // to notice the choice going wrong.
  var seesaw = await page.eval(
    '(function(){' +
    ' var ends=[].filter.call(document.querySelectorAll(".stage .cell.house-base"),' +
    '   function(c){ return c.querySelector(".cand:not(.off)"); });' +
    ' if (ends.length !== 2) return JSON.stringify({bad: ends.length});' +
    ' var name=function(c){ return c.getAttribute("aria-label").split(",")[0].trim(); };' +
    ' var out={a:name(ends[0]), b:name(ends[1]),' +
    '   d:ends[0].querySelector(".cand:not(.off)").textContent.trim(),' +
    '   ai:ends[0].dataset.cell, bi:ends[1].dataset.cell,' +
    '   room:[].filter.call(document.querySelectorAll(".stage .cell.house-base"),' +
    '     function(c){ return !c.querySelector(".value").textContent; }).length};' +
    ' ends[0].click(); return JSON.stringify(out);})()');
  var SL = JSON.parse(seesaw);
  if (SL.bad !== undefined) {
    page.fail('strong links act 1: the tinted house shows ' + SL.bad +
      ' homes for the digit, not 2');
  }
  var lit = await page.text('.narrative .step-text');
  if (String(lit).indexOf(SL.b + ' is the ' + SL.d) < 0) {
    page.fail('strong links act 1: switching ' + SL.a + ' off did not light ' + SL.b +
      ' — got "' + String(lit).replace(/\s+/g, ' ').trim() + '"');
  } else page.log('strong links act 1: ' + SL.a + ' off -> ' + SL.b + ' is the ' + SL.d +
    ' (house has ' + SL.room + ' empty cells)');

  // A house with only two empty cells has a strong link on every digit it is missing, and
  // that link demonstrates nothing. The page opening on one of those was the first version
  // of this widget's real bug, so pin the ranking down.
  if (SL.room < 4) {
    page.fail('strong links act 1: opens on a link in a house with only ' + SL.room +
      ' empty cells — "two homes" there is a fact about the leftovers, not the digit');
  }

  // ...and switching the other one off too must be refused, not quietly accepted
  await page.eval('document.querySelector(\'.stage .board-grid .cell[data-cell="' +
    SL.bi + '"]\').click()');
  var both = await page.text('.narrative .verdict.bad');
  if (!both || both.indexOf('nowhere') < 0) {
    page.fail('strong links act 1: switching both ends off was not refused — "' + both + '"');
  } else page.log('strong links act 1: both off -> "' + both.replace(/\s+/g, ' ').trim().slice(0, 70) + '"');
  await page.shot('strong-links');

  // Whatever the panel wants tapped has to be marked as tappable. "Tap either one" with
  // nothing on the grid saying which two meant counting squares to find out.
  await page.clickText('.act-tab', 'Switch one off');
  var taps = await page.eval(
    '[].map.call(document.querySelectorAll(".stage .cell.tint-tap"),' +
    'function(c){return c.getAttribute("aria-label").split(",")[0];}).join(" ")');
  if (!taps || taps.split(' ').length !== 2) {
    page.fail('strong links act 1: the two tap targets are not marked on the grid (got "' +
      taps + '")');
  } else page.log('strong links act 1: tap targets outlined — ' + taps);

  // act 2: the chain, walked from one end, ending in an either-way elimination
  await page.clickText('.act-tab', 'Chain two');
  var taps2 = await page.eval(
    '[].map.call(document.querySelectorAll(".stage .cell.tint-tap"),' +
    'function(c){return c.getAttribute("aria-label").split(",")[0];}).join(" ")');
  if (!taps2 || taps2.split(' ').length !== 2) {
    page.fail('strong links act 2: the two far ends are not distinguished from the two ' +
      'middle cells (got "' + taps2 + '")');
  } else page.log('strong links act 2: far ends outlined — ' + taps2);

  // Before the chain is walked, the cells it will eventually eliminate must NOT be lit.
  // They were, from the moment the panel opened, with nothing saying what they were.
  var early = await page.eval(
    '(function(){var S=window.Sudoku,D=window.Drills;' +
    ' var f=D.makeDrill("skyscraper",0).primary;' +
    ' var pat=f.cells;' +
    ' return f.eliminations.filter(function(e){' +
    '   var c=document.querySelector(\'.stage .cell[data-cell="\'+e.cell+\'"]\');' +
    '   return c && !c.classList.contains("dimmed");})' +
    '  .map(function(e){return S.cellName(e.cell);}).join(" ");})()');
  if (early) {
    page.fail('strong links act 2: ' + early + ' are lit before the chain has introduced ' +
      'them — unexplained bright cells read as part of the pattern');
  } else page.log('strong links act 2: elimination targets stay dim until they are the subject');

  var chainEnds = await page.eval(
    '(function(){var S=window.Sudoku,D=window.Drills,f=D.makeDrill("skyscraper",0).primary;' +
    ' var ends=[f.links[0].a, f.links[2].b];' +
    ' document.querySelector(\'.stage .board-grid .cell[data-cell="\'+ends[0]+\'"]\').click();' +
    ' return JSON.stringify({names:ends.map(S.cellName), d:f.digits[0],' +
    '  victims:f.eliminations.map(function(e){return S.cellName(e.cell);})});})()');
  var CH = JSON.parse(chainEnds);
  for (var s = 0; s < 3; s++) await page.clickText('.controls .btn', 'Follow the link to');
  var conclusion = await page.text('.narrative .step-text');
  if (String(conclusion).indexOf('at least one of ' + CH.names[0]) < 0) {
    page.fail('strong links act 2: walking the chain did not conclude on both ends — "' +
      String(conclusion).replace(/\s+/g, ' ').trim().slice(-120) + '"');
  } else page.log('strong links act 2: chain concludes "at least one of ' +
    CH.names.join(' / ') + '"');

  // the payoff: claiming either end has to kill the same cells
  var killed = [];
  for (var e = 0; e < 2; e++) {
    await page.clickText('.controls .btn', 'Say ' + CH.names[e] + ' is the ' + CH.d);
    killed.push(await page.eval(
      '[].map.call(document.querySelectorAll(".stage .board-grid .cand.mark-elim"),' +
      'function(x){return x.dataset.cell+":"+x.dataset.digit;}).sort().join(",")'));
  }
  if (!killed[0] || killed[0] !== killed[1]) {
    page.fail('strong links act 2: the two ends do not kill the same cells — "' +
      killed[0] + '" vs "' + killed[1] + '"');
  } else page.log('strong links act 2: both ends kill ' + CH.victims.join(' ') + ' — identical');
  var closer = await page.text('.narrative .step-text');
  if (!closer || closer.indexOf('Same cells') < 0) {
    page.fail('strong links act 2: no "same cells either way" payoff after claiming both ends');
  }

  // act 3: counting practice — a real link is accepted, a three-home house is not
  await page.clickText('.act-tab', 'Find your own');
  var hunt = await page.eval(
    '(function(){var S=window.Sudoku,T=window.Techniques,D=window.Drills;' +
    ' var b=D.makeDrill("x-wing",0).board;' +
    ' var d=null; for (var k=1;k<=9;k++) if (T.strongLinks(b,k).length) { d=k; break; }' +
    ' var l=T.strongLinks(b,d)[0];' +
    ' var g=document.querySelector(".stage .board-grid");' +
    ' g.querySelector(\'.cell[data-cell="\'+l.a+\'"]\').click();' +
    ' g.querySelector(\'.cell[data-cell="\'+l.b+\'"]\').click();' +
    ' return d;})()');
  var verdict = await page.text('.narrative .verdict');
  if (!verdict || verdict.indexOf('Yes') < 0) {
    page.fail('strong links act 3: a genuine link on the ' + hunt + ' was rejected — "' +
      String(verdict).replace(/\s+/g, ' ').trim() + '"');
  } else page.log('strong links act 3: genuine link accepted');

  // A pair in a house with three or more homes must be told exactly why it fails — and
  // the pair has to be crowded in *every* house it shares, or the widget is right to
  // accept it and the assertion would be the thing that is wrong.
  var miss = await page.eval(
    '(function(){var S=window.Sudoku,T=window.Techniques,D=window.Drills;' +
    ' var b=D.makeDrill("x-wing",0).board;' +
    ' var d=null; for (var k=1;k<=9;k++) if (T.strongLinks(b,k).length) { d=k; break; }' +
    ' for (var hh=0;hh<27;hh++){ var homes=b.cellsFor(hh,d);' +
    '   if (homes.length<3) continue;' +
    '   for (var i=0;i<homes.length;i++) for (var j=i+1;j<homes.length;j++){' +
    '     var shared=S.housesOf[homes[i]].filter(function(x){' +
    '       return S.housesOf[homes[j]].indexOf(x)>=0;});' +
    '     var crowded=shared.every(function(x){return b.cellsFor(x,d).length>2;});' +
    '     if (!crowded) continue;' +
    '     var g=document.querySelector(".stage .board-grid");' +
    '     g.querySelector(\'.cell[data-cell="\'+homes[i]+\'"]\').click();' +
    '     g.querySelector(\'.cell[data-cell="\'+homes[j]+\'"]\').click();' +
    '     return homes.length; } } return 0;})()');
  if (miss) {
    var why = await page.text('.narrative .verdict.bad');
    if (!why || !/\bhomes\b/.test(why)) {
      page.fail('strong links act 3: a too-crowded house was rejected without the count — "' +
        String(why).replace(/\s+/g, ' ').trim() + '"');
    } else page.log('strong links act 3: crowded house explained — "' +
      why.replace(/\s+/g, ' ').trim().slice(0, 90) + '"');
  } else page.log('strong links act 3: no crowded house in this grid, skipped');

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
